/* ==========================================================================
   PICTURE WRAP — poster/bluesky.js

   AT Protocol posting. No SDK, two endpoints.

   Credentials come from the environment, never from a file in the repo:

     export BSKY_HANDLE="picture-wrap.bsky.social"
     export BSKY_APP_PASSWORD="xxxx-xxxx-xxxx-xxxx"

   Use an APP PASSWORD (Settings → Privacy and security → App passwords),
   not your account password. It can be revoked on its own.
   ========================================================================== */

const HOST = 'https://bsky.social';

export function credentials() {
  const identifier = process.env.BSKY_HANDLE;
  const password = process.env.BSKY_APP_PASSWORD;
  if (!identifier || !password) {
    throw new Error('Set BSKY_HANDLE and BSKY_APP_PASSWORD in the environment.');
  }
  return { identifier, password };
}

export async function login() {
  const res = await fetch(`${HOST}/xrpc/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials()),
  });
  if (!res.ok) {
    throw new Error(`Bluesky login failed (${res.status}). Check the app password.`);
  }
  return res.json();   // { accessJwt, did, handle, ... }
}

/* Bluesky counts and indexes in UTF-8 bytes, not JS characters. Links have
   to be described as byte ranges or they won't be clickable. */
function linkFacets(text) {
  const bytes = new TextEncoder().encode(text);
  const facets = [];
  const pattern = /https?:\/\/[^\s]+/g;

  for (const match of text.matchAll(pattern)) {
    const before = new TextEncoder().encode(text.slice(0, match.index)).length;
    const length = new TextEncoder().encode(match[0]).length;
    facets.push({
      index: { byteStart: before, byteEnd: before + length },
      features: [{ $type: 'app.bsky.richtext.facet#link', uri: match[0] }],
    });
  }

  return { facets, byteLength: bytes.length };
}

export const LIMIT = 300;

/* Bluesky's 300 limit counts GRAPHEMES, not bytes and not code units.
   Those diverge exactly where this project lives: "Le chemin des écoliers"
   is 22 graphemes but 23 bytes, and CJK titles diverge much further —
   "羅生門" is 3 graphemes and 9 bytes.

   Measuring bytes was safe (bytes >= graphemes, so it never overruns) but
   it truncated accented and non-Latin titles early for no reason. Count
   graphemes for the limit; bytes are still what facet offsets use. */
const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });

export function measure(text) {
  return [...segmenter.segment(text)].length;
}

export const byteLength = text => new TextEncoder().encode(text).length;

/* Bluesky stores images as blobs: upload the bytes first, then reference
   the returned blob in the post record. Max 4 per post, ~1 MB each — TMDB
   posters at w500 run 60-120 KB, so there is plenty of room. */
export async function uploadImage(url, session) {
  try {
    const img = await fetch(url);
    if (!img.ok) return null;
    const type = img.headers.get('content-type') || 'image/jpeg';
    const bytes = new Uint8Array(await img.arrayBuffer());
    if (bytes.length > 950_000) return null;

    const res = await fetch(`${HOST}/xrpc/com.atproto.repo.uploadBlob`, {
      method: 'POST',
      headers: {
        'Content-Type': type,
        Authorization: `Bearer ${session.accessJwt}`,
      },
      body: bytes,
    });
    if (!res.ok) return null;
    const { blob } = await res.json();
    return blob;
  } catch {
    return null;
  }
}

async function createRecord(text, session, reply, images) {
  const { facets } = linkFacets(text);
  const length = measure(text);
  if (length > LIMIT) {
    throw new Error(`Post is ${length} graphemes; the limit is ${LIMIT}.`);
  }

  const res = await fetch(`${HOST}/xrpc/com.atproto.repo.createRecord`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.accessJwt}`,
    },
    body: JSON.stringify({
      repo: session.did,
      collection: 'app.bsky.feed.post',
      record: {
        $type: 'app.bsky.feed.post',
        text,
        facets,
        langs: ['en'],
        createdAt: new Date().toISOString(),
        ...(reply ? { reply } : {}),
        ...(images?.length
          ? { embed: { $type: 'app.bsky.embed.images', images } }
          : {}),
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`Post failed (${res.status}): ${await res.text()}`);
  }

  return res.json();   // { uri, cid }
}

/* Accepts one string or an array, and threads an array as replies.

   A thread needs BOTH refs on every reply: `root` stays the first post
   throughout, `parent` is the post immediately above. Setting parent
   without root produces a reply that renders detached from its thread. */
/* `images` is an array matching `parts` — images[i] belongs to parts[i].
   Each entry is already-uploaded blobs with alt text. */
export async function post(text, session, images = []) {
  const parts = Array.isArray(text) ? text.filter(Boolean) : [text];
  if (!parts.length) throw new Error('Nothing to post.');

  const root = await createRecord(parts[0], session, null, images[0]);
  let parent = root;

  for (const [i, part] of parts.slice(1).entries()) {
    parent = await createRecord(part, session, {
      root:   { uri: root.uri, cid: root.cid },
      parent: { uri: parent.uri, cid: parent.cid },
    }, images[i + 1]);
  }

  /* at://did:plc:xxx/app.bsky.feed.post/ID -> a link you can open */
  const id = root.uri.split('/').pop();
  return { uri: root.uri, url: `https://bsky.app/profile/${session.handle}/post/${id}` };
}
