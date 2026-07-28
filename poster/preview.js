/* ==========================================================================
   PICTURE WRAP — poster/preview.js

   Renders the whole queue as a web page: every post exactly as it will
   read, with the real portrait and posters in place.

     node preview.js          write preview.html and open it

   Why this exists: the terminal shows text, and the images are half the
   post now. Bluesky added drafts in February 2026 but they live in the
   app's composer with no API to create one, and an intent link carries
   text without pictures. So we render it ourselves.

   Nothing here posts. review.js is still the only thing that does.
   ========================================================================== */

import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { load, paths, groupQueue, compose, imagesFor, posterFor,
         detailsFor, longDate, sleep, HERE } from './lib.js';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const queue = await load(paths.queue, []);
if (!queue.length) { console.log('Nothing queued.'); process.exit(0); }

const groups = groupQueue(queue)
  .sort((a, b) => (a.last.died || '').localeCompare(b.last.died || ''));

console.log(`Rendering ${groups.length} post(s)…`);

const cards = [];
for (const [i, group] of groups.entries()) {
  for (const item of group.items) {
    if (!item.stars) Object.assign(item, await detailsFor(item.id, group.last.id));
    if (item.poster === undefined) item.poster = await posterFor(item.tmdbId);
    await sleep(80);
  }

  const parts = compose(group);
  const [face, posters] = await imagesFor(group);

  const shot = (imgs) => imgs.length
    ? `<div class="imgs${imgs.length > 1 ? ' grid' : ''}">` +
      imgs.map(im => `<img src="${esc(im.url)}" alt="${esc(im.alt)}" title="${esc(im.alt)}">`).join('') +
      `</div>`
    : '';

  cards.push(`
    <article>
      <h2>${i + 1}. ${esc(group.last.name)} <span>${esc(longDate(group.last.died))}</span></h2>
      <div class="post">${shot(face)}<p>${esc(parts[0]).replace(/\n/g, '<br>')}</p></div>
      <div class="post reply">${shot(posters)}<p>${esc(parts[1]).replace(/\n/g, '<br>')}</p></div>
      <p class="meta">${group.items.length} picture(s) &middot;
        hover an image for its alt text</p>
    </article>`);
  process.stdout.write('.');
}

const html = `<!doctype html><meta charset="utf-8">
<title>Picture Wrap — queue preview</title>
<style>
  body { background:#12100c; color:#ece7db; font:16px/1.5 -apple-system,system-ui,sans-serif;
         max-width:44rem; margin:0 auto; padding:3rem 1.5rem 6rem; }
  h1 { font:400 1.8rem/1 "Iowan Old Style",Georgia,serif; letter-spacing:.02em; }
  h1 span { display:block; font-size:.62rem; letter-spacing:.28em; text-transform:uppercase;
            color:#635b4e; margin-top:.7rem; }
  article { margin:3.4rem 0; }
  article h2 { font:400 1.05rem/1.3 "Iowan Old Style",Georgia,serif; color:#c9a227; margin:0 0 .8rem; }
  article h2 span { color:#635b4e; font-size:.8rem; }
  .post { background:#1b1813; border:1px solid rgba(236,231,219,.14); border-radius:12px;
          padding:1rem; margin-bottom:.5rem; }
  .post.reply { margin-left:1.6rem; }
  .post p { margin:.7rem 0 0; white-space:pre-wrap; }
  .imgs img { width:100%; border-radius:8px; display:block; }
  .imgs.grid { display:grid; grid-template-columns:1fr 1fr; gap:4px; }
  .imgs.grid img { aspect-ratio:1; object-fit:cover; }
  .meta { font-size:.72rem; letter-spacing:.1em; text-transform:uppercase; color:#635b4e;
          margin:.6rem 0 0 1.6rem; }
</style>
<h1>Picture Wrap<span>queue preview &middot; nothing here is posted</span></h1>
${cards.join('')}
`;

const out = join(HERE, 'preview.html');
await writeFile(out, html);
console.log(`\n${out}`);
