/* ==========================================================================
   PICTURE WRAP — app.js

   No build step, no backend, no database. The browser talks straight to
   Wikidata; both endpoints send Access-Control-Allow-Origin: *.

   Routing is hash-based:  #/film/Q47703   #/person/Q171736

   The ordering rule, in one place, because it's the whole design:
     living first, then the bar, then the dead.
     Within the living, oldest sits LAST — closest to the bar, next to cross.
     Within the dead, most recent sits FIRST — also closest to the bar.
     So the two rows touching the bar are "just went" and "probably next."
     The bar rises as the living block shrinks. Reaching the top is the end.
   ========================================================================== */

import { survivors } from './verify.js';
import {
  CREW, CREDITS, CREDIT_PROPS, IN_LIST, VALUES, KINDS, OCCUPATIONS, LANGS,
  nonLatin, nameFromArticle,
  CREDIT_NOUNS, qid, year, longDate, pickDemonym, slug, path, sentence,
} from './shared.js';

const WDQS   = 'https://query.wikidata.org/sparql';
const WD_API = 'https://www.wikidata.org/w/api.php';

/* What counts as a picture. Television earns its place through age rather
   than through completeness: I Love Lucy has 17 cast on record and 16 of
   them dead, the bar one row from the top, and the survivor is the child
   who played Little Ricky.

/* TMDB fills in character names, which Wikidata barely records. The
   Umbrellas of Cherbourg has 0 of 29 characters on Wikidata; TMDB has
   them all. Wikidata carries TMDB ids for both films (P4947) and people
   (P4985), so the join is exact — no name matching.

   This key is PUBLIC. It ships in the page and anyone can read it. That's
   acceptable for a read-only TMDB key on a non-commercial site — the worst
   case is quota abuse, and you rotate it at themoviedb.org. Do not put any
   other service's key here.

   Leave it empty and the site works exactly as before, falling back to
   whatever characters Wikidata has. Nothing else depends on it.

   Using it brings TMDB's terms: non-commercial, attribution in the
   colophon, and no caching beyond six months. */
const TMDB_KEY = '6f0df4c801a86a2f009beac377bdf1e0';

/* Where corrections go. */
const BLUESKY = 'picture-wrap.bsky.social';

/* Occupations worth searching. This list has to be generous, because
   Wikidata carries a dozen overlapping occupation items and tagging is
   inconsistent between them.

   Catherine Deneuve is the case that proved it: she is tagged "film actor"
   (Q10800557) but NOT "actor" (Q33999), so a filter built on Q33999 alone
   returned nothing for her. Ennio Morricone was missing for the same
   reason. Searching Q33999 only also misses Roger Deakins entirely and
   won't return Stanley Kubrick.

/* A few films to start from. Verified QIDs. */
const PICKS = [
  { id: 'Q47703',  name: 'The Godfather' },
  { id: 'Q17738',  name: 'Star Wars' },
  { id: 'Q104123', name: 'Pulp Fiction' },
  { id: 'Q212129', name: 'A Streetcar Named Desire' },
  { id: 'Q132689', name: 'Casablanca' },
];

const stage = document.getElementById('stage');
const input = document.getElementById('q');
const sugEl = document.getElementById('suggestions');


/* --- plumbing ---------------------------------------------------------- */

async function sparql(query) {
  const res = await fetch(WDQS + '?query=' + encodeURIComponent(query), {
    headers: { Accept: 'application/sparql-results+json' },
  });
  if (!res.ok) throw new Error('Query service returned ' + res.status);
  const json = await res.json();
  return json.results.bindings;
}

/* Bindings come back as {var: {value: "..."}}. Flatten to plain strings. */
function flat(row) {
  const out = {};
  for (const k in row) out[k] = row[k].value;
  return out;
}

/* --- what verify.js needs from this half ------------------------------- */

/* verify.js does no fetching of its own, because fetching is the one thing
   the two halves genuinely cannot share — the poster sends a User-Agent
   and retries on 429, and a browser is allowed to do neither. It asks for
   these two instead. */

const sparqlRows = query => sparql(query).then(rows => rows.map(flat));

/* Memoised per page load: a film page asks for the same credits list twice
   over, once for character names and once for the survivor test, and a
   person is often credited on more than one film in a filmography. */
const tmdbCache = new Map();

async function tmdbGet(path) {
  if (tmdbCache.has(path)) return tmdbCache.get(path);
  let out = null;
  try {
    const join = path.includes('?') ? '&' : '?';
    const res = await fetch(
      `https://api.themoviedb.org/3${path}${join}` +
      `api_key=${encodeURIComponent(TMDB_KEY)}`);
    if (res.ok) out = await res.json();
  } catch { /* null — the caller reads an unanswerable person as unknown */ }
  tmdbCache.set(path, out);
  return out;
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/* Commons file URL -> a sensibly sized thumbnail. */
function thumb(url, w = 120) {
  return url ? url.replace(/^http:/, 'https:') + '?width=' + w : '';
}

function show(html) { stage.innerHTML = html; wireShare(); }

/* The tab is the only part of the page you can see while looking at
   something else, so it says which picture is open and whether it has
   wrapped — the same two facts the page leads with.

   Plain text, never markup: document.title shows "&ndash;" as those eight
   characters. Real dashes only. */
const SITE = 'Picture Wrap';
function setTitle(line) {
  document.title = line ? `${line} · ${SITE}` : SITE;
}

/* Named the same way in the tab as on the page and in the share text. */
function filmName(meta) {
  return `${meta.label || ''}${meta.year ? ` (${meta.year})` : ''}`;
}

/* A holding message goes to the tab too. A background tab on a slow
   query otherwise sits on the title of whatever you were reading last. */
function state(msg) {
  show(`<p class="state">${esc(msg)}</p>`);
  setTitle(msg.replace(/[.…]+$/, ''));
}


/* --- search ------------------------------------------------------------ */

/* One call returns films and people together, ranked by relevance. The
   snippet already carries life dates for people — "(1931–2026)" — so the
   dropdown shows who's gone before you click anything. */
async function search(term) {
  const filter = 'haswbstatement:' +
    KINDS.map(q => 'P31=' + q).concat(
      OCCUPATIONS.map(q => 'P106=' + q)).join('|');
  const url = WD_API + '?' + new URLSearchParams({
    action: 'query', list: 'search', format: 'json', origin: '*',
    srsearch: `${filter} ${term}`, srlimit: '8',
  });
  const res = await fetch(url);
  if (!res.ok) return [];
  const json = await res.json();
  return (json.query?.search ?? []).map(r => ({
    id: r.title,
    note: (r.snippet || '').replace(/<[^>]*>/g, ''),
  }));
}

/* The search API doesn't return types, but its description almost always
   implies one. Good enough for a chip; the router reads the real data. */
function kindOf(note) {
  if (/\bseries\b|\bsitcom\b|\bprogram|\bserial\b|\bmini-?series\b/i.test(note)) {
    return { label: 'Series', isTitle: true };
  }
  if (/\bfilm\b|\bmovie\b|\bshort\b|\bdocumentary\b/i.test(note)) {
    return { label: 'Film', isTitle: true };
  }
  return { label: 'Person', isTitle: false };
}

function renderSuggestions(items) {
  if (!items.length) {
    sugEl.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    return;
  }
  sugEl.innerHTML = items.map(it => {
    const kind = kindOf(it.note);
    return `
    <li role="option" data-id="${esc(it.id)}" data-film="${kind.isTitle ? '1' : ''}">
      <div class="sg-label">
        <span class="sg-kind">${kind.label}</span>${esc(it.note.match(/^\s*$/) ? it.id : '')}
      </div>
      <div class="sg-note">${esc(it.note)}</div>
    </li>`;
  }).join('');
  sugEl.hidden = false;
  input.setAttribute('aria-expanded', 'true');
}

/* Labels aren't in the search response, so fill them in afterwards. */
async function labelSuggestions(items) {
  const ids = items.map(i => i.id).join('|');
  /* languagefallback matters: some very well-known people have no English
     label at all. Meryl Streep (Q873) has an English *description* and no
     English label, so an en-only lookup showed her as "Q873". */
  const url = WD_API + '?' + new URLSearchParams({
    action: 'wbgetentities', props: 'labels', languages: 'en',
    languagefallback: '1', format: 'json', origin: '*', ids,
  });
  const res = await fetch(url);
  if (!res.ok) return;
  const json = await res.json();
  sugEl.querySelectorAll('li').forEach(li => {
    const label = json.entities?.[li.dataset.id]?.labels?.en?.value;
    if (label) li.querySelector('.sg-label').insertAdjacentText('beforeend', label);
  });
}

let searchTimer;
input.addEventListener('input', () => {
  clearTimeout(searchTimer);
  const term = input.value.trim();
  if (term.length < 2) { renderSuggestions([]); return; }
  searchTimer = setTimeout(async () => {
    const items = await search(term);
    renderSuggestions(items);
    if (items.length) labelSuggestions(items);
  }, 220);
});

sugEl.addEventListener('click', e => {
  const li = e.target.closest('li');
  if (!li) return;
  location.hash = `#/${li.dataset.film ? 'film' : 'person'}/${li.dataset.id}`;
  input.value = '';
  renderSuggestions([]);
});

document.addEventListener('click', e => {
  if (!e.target.closest('.search')) renderSuggestions([]);
});


/* --- film view --------------------------------------------------------- */

/* The country comes back as a demonym ("French", not "France"), taken from
   ONE country rather than every co-producer merged — otherwise The
   Umbrellas of Cherbourg reads as a "West German film". MIN on the QID is
   arbitrary but deterministic.

   NB: SPARQL comments start with '#'. A JS-style block comment inside one
   of these template literals is a 400 from the query service. */
const filmMetaQuery = id => `
SELECT (MIN(?y) AS ?year) (SAMPLE(?t) AS ?tmdb)
       (SAMPLE(?tyl) AS ?type) (GROUP_CONCAT(DISTINCT ?dem; separator="|") AS ?demonyms)
       (GROUP_CONCAT(DISTINCT ?dl; separator=", ") AS ?directors) WHERE {
  BIND(wd:${id} AS ?f)
  OPTIONAL { ?f wdt:P4947 ?t }
  OPTIONAL { ?f wdt:P31 ?ty . ?ty rdfs:label ?tyl . FILTER(LANG(?tyl) = "en") }
  OPTIONAL {
    { SELECT (MIN(?cc) AS ?c) WHERE { wd:${id} wdt:P495 ?cc } }
    ?c wdt:P1549 ?dem . FILTER(LANG(?dem) = "en")
  }
  OPTIONAL { ?f wdt:P577 ?rd . BIND(YEAR(?rd) AS ?y) }
  OPTIONAL { ?f wdt:P57 ?d . ?d rdfs:label ?dl . FILTER(LANG(?dl) = "en") }
}`;

/* Cast is queried separately from crew because only cast carries a
   character-name qualifier, and mixing the two shapes makes an uglier
   query than just running both. Both are fast. */
const filmCastQuery = id => `
SELECT ?p ?pLabel ?dob ?dod ?img ?charLabel ?tmdbPerson WHERE {
  {
    wd:${id} p:P161 ?st . ?st ps:P161 ?p .
    OPTIONAL { ?st pq:P453 ?char }
  } UNION {
    # Animation records its cast under P725, not P161. Without this an
    # animated series has no roster at all — The Simpsons has 0 cast
    # members and 16 voice actors.
    wd:${id} p:P725 ?vst . ?vst ps:P725 ?p .
    OPTIONAL { ?vst pq:P453 ?char }
  }
  OPTIONAL { ?p wdt:P4985 ?tmdbPerson }
  OPTIONAL { ?p wdt:P569 ?dob }
  OPTIONAL { ?p wdt:P570 ?dod }
  OPTIONAL { ?p wdt:P18 ?img }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,fr,de,it,es,pt,nl,sv,da,no,fi,is,pl,cs,sk,hu,ro,bg,sr,hr,sl,uk,ru,el,tr,he,ar,fa,hi,bn,ta,te,ml,kn,mr,ur,th,vi,id,ms,ja,ko,zh,ca,eu,gl,et,lv,lt,ga,cy,sq,mk,ka,hy,az,kk,uz,af,sw,yi,la". }
}`;

const filmCrewQuery = id => `
SELECT ?p ?pLabel ?dob ?dod ?img ?role WHERE {
  VALUES (?prop ?role) {
    ${CREW.map(([p, label]) => `(${p} "${label}")`).join('\n    ')}
  }
  wd:${id} ?prop ?p .
  OPTIONAL { ?p wdt:P569 ?dob }
  OPTIONAL { ?p wdt:P570 ?dod }
  OPTIONAL { ?p wdt:P18 ?img }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,fr,de,it,es,pt,nl,sv,da,no,fi,is,pl,cs,sk,hu,ro,bg,sr,hr,sl,uk,ru,el,tr,he,ar,fa,hi,bn,ta,te,ml,kn,mr,ur,th,vi,id,ms,ja,ko,zh,ca,eu,gl,et,lv,lt,ga,cy,sq,mk,ka,hy,az,kk,uz,af,sw,yi,la". }
}`;

async function viewFilm(id) {
  state('Pulling the call sheet…');

  const [metaRows, castRows, crewRows] = await Promise.all([
    sparql(filmMetaQuery(id)),
    sparql(filmCastQuery(id)),
    sparql(filmCrewQuery(id)),
  ]);

  const meta = flat(metaRows[0] || {});
  meta.label = await labelFor(id);
  meta.country = pickDemonym(meta.demonyms);

  /* One person, one row. Someone can be cast and crew both — Coppola wrote
     and directed The Godfather — so collect every credit they hold and
     show them once. Cast is read first so a role beats a job title. */
  const people = new Map();
  for (const row of castRows) {
    const r = flat(row);
    if (people.has(r.p)) {
      const seen = people.get(r.p);
      if (r.charLabel && !seen.credits.includes(r.charLabel)) {
        seen.credits.push(r.charLabel);
      }
    } else {
      people.set(r.p, { ...r, onScreen: true, credits: r.charLabel ? [r.charLabel] : [] });
    }
  }
  for (const row of crewRows) {
    const r = flat(row);
    if (people.has(r.p)) {
      /* Coppola wrote and directed as well as appearing — one row, both. */
      const seen = people.get(r.p);
      if (r.role && !seen.credits.includes(r.role)) seen.credits.push(r.role);
    } else {
      people.set(r.p, { ...r, onScreen: false, credits: r.role ? [r.role] : [] });
    }
  }

  const extra = await addCharacters(meta.tmdb, people);
  unrecorded = extra.unknown;

  /* People TMDB credits and Wikidata knows, just not on this picture. They
     belong in the roster — they were in the film and we know their dates. */
  for (const person of extra.resolved) {
    if (!people.has(person.p)) people.set(person.p, person);
  }

  everyone = await repairNames([...people.values()], 'p', 'pLabel');
  filmMeta = meta;

  if (!everyone.length) {
    setTitle(filmName(meta));
    show(titleCard(meta, null) +
      `<p class="state">Wikidata has no one credited on this one.</p>`);
    return;
  }

  /* Only ask when the answer could change what is drawn. If Wikidata
     already knows somebody living, the bar is not going to the top and no
     amount of TMDB agreement would move it — so the extra requests only
     happen on the pages where they can alter the claim.

     This is the check the poster runs before it will queue a closing, and
     until now the browser had its own version of it that quietly counted
     anyone TMDB named and Wikidata couldn't place as dead. Same file now.
     The Wizard of Oz is the page to test on: Caren Marsh is alive. */
  tmdbAlive = [];
  tmdbFailed = false;
  if (everyone.every(p => p.dod) && meta.tmdb) {
    state('Checking the cast against TMDB…');
    const found = await survivors({
      film: id, tmdbId: meta.tmdb, sparql: sparqlRows, tmdb: tmdbGet,
    });
    tmdbAlive = found.alive;

    /* A check that didn't run is not a check that found nobody. If we
       couldn't reach TMDB, we decline to raise the bar rather than make
       the strongest claim on the site out of a failed request. */
    tmdbFailed = !found.ok;
  }

  renderRoster();
}

/* Fill in character names from TMDB for anyone Wikidata didn't name.
   Joined on TMDB person id, so there's no fuzzy matching — a person
   either maps or is left alone. Wikidata's own P453 always wins when it
   exists; it's curated and this isn't.

   Entirely best-effort: no key, no film id, a network failure or a
   rate-limit all just leave the page as it was. */
async function addCharacters(tmdbFilm, people) {
  if (!TMDB_KEY || !tmdbFilm) return { resolved: [], unknown: [] };

  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/movie/${encodeURIComponent(tmdbFilm)}` +
      `/credits?api_key=${encodeURIComponent(TMDB_KEY)}`);
    if (!res.ok) return;

    const { cast = [] } = await res.json();
    const roles = new Map(cast.map(c => [String(c.id), c.character]));

    const known = new Set();
    for (const person of people.values()) {
      if (person.tmdbPerson) known.add(String(person.tmdbPerson));
      if (person.credits.length || !person.tmdbPerson) continue;
      const role = roles.get(String(person.tmdbPerson));
      if (role) person.credits.push(role);
    }

    /* Everyone TMDB credits who isn't in this film's Wikidata cast list.
       They are NOT unknown people — most have Wikidata entries, they just
       aren't attached to this picture. So ask Wikidata about them by TMDB
       id and find out. One query, ~0.2s, however many names. */
    const missing = cast.filter(c => !known.has(String(c.id)));
    if (!missing.length) return { resolved: [], unknown: [] };

    const roles2 = new Map(missing.map(c => [String(c.id), c.character || '']));
    const rows = await sparql(`
      SELECT ?tmdb ?p ?pLabel ?dob ?dod ?img WHERE {
        VALUES ?tmdb { ${missing.map(c => `"${c.id}"`).join(' ')} }
        ?p wdt:P4985 ?tmdb .
        OPTIONAL { ?p wdt:P569 ?dob }
        OPTIONAL { ?p wdt:P570 ?dod }
        OPTIONAL { ?p wdt:P18 ?img }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "en,fr,de,it,es,pt,nl,sv,da,no,fi,is,pl,cs,sk,hu,ro,bg,sr,hr,sl,uk,ru,el,tr,he,ar,fa,hi,bn,ta,te,ml,kn,mr,ur,th,vi,id,ms,ja,ko,zh,ca,eu,gl,et,lv,lt,ga,cy,sq,mk,ka,hy,az,kk,uz,af,sw,yi,la". }
      }`).catch(() => []);

    const resolved = [];
    const found = new Set();
    for (const row of rows) {
      const r = flat(row);
      if (found.has(r.tmdb)) continue;
      found.add(r.tmdb);
      resolved.push({
        ...r,
        onScreen: true,
        viaTmdb: true,
        credits: roles2.get(r.tmdb) ? [roles2.get(r.tmdb)] : [],
      });
    }

    /* What's left is genuinely uncertain: TMDB credits them, Wikidata has
       no record at all, and there is nowhere else to look. */
    const unknown = missing
      .filter(c => !found.has(String(c.id)))
      .map(c => ({ name: c.name, character: c.character || '' }));

    return { resolved, unknown };
  } catch {
    return { resolved: [], unknown: [] };   /* leave the page as it was */
  }
}


/* Held between renders. */
let everyone = [];
let filmMeta = {};
let unrecorded = [];

/* People TMDB records as living whom Wikidata never attached to this film.
   Non-empty means the picture has not wrapped, whatever Wikidata thinks. */
let tmdbAlive = [];

/* The TMDB check was needed and did not complete. Not the same as finding
   nobody, and it must not read as one. */
let tmdbFailed = false;

/* Living: oldest last, so the oldest is the row touching the divider.
   Unknown birth dates go to the top — a missing date shouldn't win the
   spot next to it, which is meant to say "probably next".
   Dead: most recent first, so it's also touching the divider. */
function split(group) {
  const living = group.filter(p => !p.dod).sort((a, b) => {
    if (!a.dob && !b.dob) return (a.pLabel || '').localeCompare(b.pLabel || '');
    if (!a.dob) return -1;
    if (!b.dob) return 1;
    return b.dob.localeCompare(a.dob);
  });
  const dead = group.filter(p => p.dod)
    .sort((a, b) => (b.dod || '').localeCompare(a.dod || ''));
  return { living, dead };
}

function renderRoster() {
  const cast = everyone.filter(p => p.onScreen);
  const crew = everyone.filter(p => !p.onScreen);

  /* The wrap is always judged on everyone credited, never on what happens
     to be unfolded. Collapsing the crew doesn't close a picture.

     And never on Wikidata alone. tmdbAlive holds people TMDB records as
     living whom Wikidata did not attach to this film; one of them is
     enough to keep the bar down, because they were in the picture and
     they are here. */
  const allLiving = everyone.filter(p => !p.dod);
  const wrapDate = allLiving.length === 0 && tmdbAlive.length === 0 && !tmdbFailed
    ? everyone.map(p => p.dod).sort().pop()
    : null;

  const front = split(cast);
  const back  = split(crew);

  /* The state worth naming: every face is gone, but someone who made it
     is still here. */
  const castComplete =
    cast.length > 0 && front.living.length === 0 && allLiving.length > 0;

  const shareText = wrapDate
    ? `Nobody who made ${filmName(filmMeta)} is left.`
    : `Who is still with us from ${filmName(filmMeta)}.`;

  /* The one thing worth carrying into the tab: whether the bar is at the
     top. Appended rather than prefixed, so the title survives truncation
     down to something still recognisable. */
  setTitle(filmName(filmMeta) + (wrapDate ? ' — wrapped' : ''));

  /* When a picture has wrapped, the bar rises above everything — the crew
     card included, since everyone in it is gone too. Nothing should sit
     above the bar once there is nobody left; a collapsed card up there
     softens the one moment the whole design exists to state. */
  const wrapped = !!wrapDate;

  /* The sentence the page was missing. The stamp gives a date and the
     roster gives an order, but nothing said the human thing: that one
     person outlived everyone else who made this. */
  const lastOne = wrapped ? front.dead[0] || back.dead[0] : null;

  const bar =
    `<li class="bar" role="separator" aria-label="Above: living. Below: died."></li>`;

  const crewFold = crew.length ? `
    <details class="fold">
      <summary>
        <span class="fold-title">Behind the camera</span>
        <span class="fold-hint">${crew.length}</span>
      </summary>
      <ul class="roster">
        ${back.living.map(personRow).join('')}
        <li class="hairline" role="separator" aria-label="Above: living. Below: died."></li>
        ${back.dead.map(personRow).join('')}
      </ul>
    </details>` : '';

  show(
    titleCard(filmMeta, wrapDate) +
    (lastOne
      ? `<p class="closing-line">${esc(lastOne.pLabel)} was the last of its makers.</p>`
      : '') +
    shareControls(shareText, location.hash) +

    /* Wrapped: the bar caps everything, then the crew card, then the cast.
       Still running: the crew card sits above, and the bar does its usual
       job inside the cast list. */
    (wrapped ? `<ul class="roster capped">${bar}</ul>` : '') +
    crewFold +

    (castComplete
      ? `<p class="card-thin">Everyone on screen is gone. Someone who worked
         behind the camera is still here.</p>`
      : '') +

    /* Said plainly, because otherwise the page looks like it simply failed
       to notice: Wikidata has everyone it lists as dead, and the bar is
       still down because somebody else was in the picture. */
    (tmdbFailed
      ? `<p class="card-thin">Everyone Wikidata lists has died, but the
         check against TMDB didn&rsquo;t complete, so this page won&rsquo;t
         call the picture wrapped. Reload to try again.</p>`
      : '') +

    (tmdbAlive.length
      ? `<p class="card-thin">Everyone Wikidata lists has died, but TMDB
         records ${tmdbAlive.length === 1 ? 'someone' : `${tmdbAlive.length} people`}
         on this picture who ${tmdbAlive.length === 1 ? 'is' : 'are'} still
         living: ${esc(tmdbAlive.slice(0, 4).join(', '))}${
           tmdbAlive.length > 4 ? ` and ${tmdbAlive.length - 4} more` : ''}.</p>`
      : '') +

    `<ul class="roster">` +
      front.living.map(personRow).join('') +
      (wrapped ? '' : bar) +
      front.dead.map(personRow).join('') +
    `</ul>` +

    /* People TMDB credits and Wikidata doesn't. Listed, never counted —
       we can't say whether they're living, and pretending otherwise in
       either direction would be a guess. */
    (unrecorded.length ? `
      <details class="fold">
        <summary>
          <span class="fold-title">Credited, no record</span>
          <span class="fold-hint">${unrecorded.length}</span>
        </summary>
        <p class="fold-note">
          <a href="https://bsky.app/profile/${esc(BLUESKY)}" rel="noopener">Corrections welcome</a>
        </p>
        <ul class="roster">
          ${unrecorded.map(p => `
            <li>
              <span class="portrait" aria-hidden="true"></span>
              <span class="who">
                <span class="who-name">${esc(p.name)}</span>
                ${p.character ? `<span class="who-role">${esc(p.character)}</span>` : ''}
              </span>
              <span class="when"><span class="when-span when-open">&mdash;</span></span>
            </li>`).join('')}
        </ul>
      </details>` : '')
  );
}

/* No completeness test here. On a film page the roster IS the evidence —
   a stamp above a list of one name says exactly what it's worth, and the
   reader can see it. The floor this used to carry was guarding a claim the
   page never really made on its own. */
/* Sentence case: Wikidata's type labels arrive lowercase ("television
   series") except where they start with a proper noun. */
/* Wikidata lists several demonym forms and we want the adjective:
   "Danish film", not "Dane film" or "Danes film". Prefer the longest form
   that isn't a plural — that gives Danish over Dane, American over
   Americans, British over Briton — falling back to whatever exists for
   countries with only a plural-looking form (Swiss). */
/* Labels get their own query. The label service walks the language list IN
   ORDER, which is the whole point — an earlier attempt aggregated three
   SAMPLE() tiers instead, and SAMPLE has no preference, so Meryl Streep
   (who has no English label at all) came out in Chinese. */
const labelQuery = id => `
SELECT ?xLabel ?article WHERE {
  # VALUES, not BIND — the label service resolves labels for variables bound
  # by VALUES and silently returns the Q-number for ones bound by BIND.
  VALUES ?x { wd:${id} }
  OPTIONAL { ?article schema:about ?x ; schema:isPartOf <https://en.wikipedia.org/> }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${LANGS}". }
}`;

async function labelFor(id) {
  try {
    const rows = await sparql(labelQuery(id));
    const r = flat(rows[0] || {});
    const label = r.xLabel && !/^Q\d+$/.test(r.xLabel) ? r.xLabel : '';
    if (!nonLatin(label)) return label;
    /* See repairNames: a name in another script when an English one exists
       on Wikipedia but not on Wikidata. */
    return nameFromArticle(r.article) || label;
  } catch {
    return '';
  }
}

/* Wikidata's language fallback is honest but occasionally absurd. Anyone
   whose name came back in a script an English reader can't sound out gets
   one more chance: the title of their English Wikipedia article, which is
   their English name even when the label field is empty.

   Batched — one query for a whole roster, and only when someone needs it,
   which on most pages is nobody. If there's no English article either, the
   original stands: that really is the only name we have. */
async function repairNames(rows, idKey, labelKey) {
  const needy = rows.filter(r => nonLatin(r[labelKey]));
  if (!needy.length) return rows;

  const ids = [...new Set(needy.map(r => qid(r[idKey])))];
  try {
    const found = await sparql(`
      SELECT ?x ?article WHERE {
        VALUES ?x { ${ids.map(i => `wd:${i}`).join(' ')} }
        ?article schema:about ?x ; schema:isPartOf <https://en.wikipedia.org/> .
      }`);
    const names = new Map(found.map(flat)
      .map(r => [qid(r.x), nameFromArticle(r.article)])
      .filter(([, n]) => n));
    for (const r of needy) {
      const better = names.get(qid(r[idKey]));
      if (better) r[labelKey] = better;
    }
  } catch { /* the original name stands */ }
  return rows;
}

function titleCard(meta, wrappedOn) {
  /* Type and country first, because on an obscure or foreign title they're
     the difference between recognising what you're looking at and not.
     "1962 · Japanese television series" says more than a director's name
     you've never heard. */
  const bits = [
    meta.year,
    sentence([meta.country, meta.type].filter(Boolean).join(' ')),
    meta.directors,
  ].filter(Boolean).join(' &middot; ');

  const stamp = wrappedOn
    /* No caveat line here. The "Credited, no record" fold below says the
       same thing and says it better, because it names the people it's
       talking about. Two versions of one disclosure is one too many. */
    ? `<p class="card-wrapped">Final picture wrap &middot; ${esc(longDate(wrappedOn))}</p>`
    : '';

  return `
    <section class="card">
      <h2>${esc(meta.label || 'Untitled')}</h2>
      ${bits ? `<p class="card-meta">${bits}</p>` : ''}
      ${stamp}
    </section>`;
}

function personRow(p) {
  const qid = p.p.split('/').pop();
  const gone = Boolean(p.dod);
  return `
    <li class="is-link ${gone ? 'gone' : 'living'}" data-go="${esc(path(p.pLabel, qid))}">
      ${p.img
        ? `<img class="portrait" src="${esc(thumb(p.img))}" alt="" loading="lazy">`
        : `<span class="portrait" aria-hidden="true"></span>`}
      <span class="who">
        <span class="who-name">${esc(p.pLabel || qid)}</span>
        ${p.credits.length
          ? `<span class="who-role">${esc(p.credits.join(' &middot; ').replace(/&middot;/g, '·'))}` +
            `${p.viaTmdb ? '<span class="via" title="Credited on TMDB; not in this film\'s Wikidata cast list">+</span>' : ''}</span>`
          : (p.viaTmdb ? `<span class="who-role"><span class="via">+</span></span>` : '')}
      </span>
      <span class="when">${lifespan(p)}</span>
    </li>`;
}

/* One format for everyone, and the difference between living and dead is
   simply whether the span closes:

       1940–              still going
       1924–2004          closed

   The open dash does the work no label or colour needs to. Under a closed
   span sits the exact death date, which is what earns a row its place
   next to the bar. */
function lifespan(p) {
  const born = year(p.dob);

  if (p.dod) {
    return `<span class="when-span">${born || '&#63;'}&ndash;${year(p.dod)}</span>` +
           `<span class="when-exact">${esc(longDate(p.dod))}</span>`;
  }
  return born ? `<span class="when-span when-open">${born}&ndash;</span>` : '';
}


/* --- verifying a filmography ------------------------------------------- */

/* survivingIds used to live here: the browser's own copy of the survivor
   test, and the last one standing. It resolved TMDB's cast against
   Wikidata and let anyone unresolved fall through as dead — the original
   bug, still here long after lib.js had been fixed twice.

   It is gone rather than ported. Person pages now read the Vault, which
   is that same test already run, and film pages call verify.js directly.
   There is one implementation again. */




/* --- person view ------------------------------------------------------- */

const personMetaQuery = id => `
SELECT (SAMPLE(?b) AS ?dob) (SAMPLE(?d) AS ?dod)
       (SAMPLE(?i) AS ?img) (GROUP_CONCAT(DISTINCT ?ol; separator=", ") AS ?occupations) WHERE {
  BIND(wd:${id} AS ?p)

  OPTIONAL { ?p wdt:P569 ?b }
  OPTIONAL { ?p wdt:P570 ?d }
  OPTIONAL { ?p wdt:P18 ?i }
  OPTIONAL { ?p wdt:P106 ?o . ?o rdfs:label ?ol . FILTER(LANG(?ol) = "en") }
}`;

/* Every credit type counts, on both sides: films this person worked on in
   any capacity, and everyone else credited on those films. Counts here are
   never shown — they only decide which side of the bar a film falls on,
   and MAX(death date) gives the film its wrap date. */
const filmographyQuery = id => `
SELECT ?film ?filmLabel (SAMPLE(?y) AS ?year) (COUNT(DISTINCT ?c) AS ?credited)
       (COUNT(DISTINCT ?cd) AS ?dead) (MAX(?dv) AS ?wrapped)
       (GROUP_CONCAT(DISTINCT ?mine; separator="|") AS ?roles) WHERE {
  VALUES ?mine { ${VALUES} }
  ?film ?mine wd:${id} .
  ?film ?any ?c .
  FILTER(?any IN (${IN_LIST}))
  OPTIONAL { ?c wdt:P570 ?dv . BIND(?c AS ?cd) }
  OPTIONAL { ?film wdt:P577 ?rd . BIND(YEAR(?rd) AS ?y) }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en,fr,de,it,es,pt,nl,sv,da,no,fi,is,pl,cs,sk,hu,ro,bg,sr,hr,sl,uk,ru,el,tr,he,ar,fa,hi,bn,ta,te,ml,kn,mr,ur,th,vi,id,ms,ja,ko,zh,ca,eu,gl,et,lv,lt,ga,cy,sq,mk,ka,hy,az,kk,uz,af,sw,yi,la". }
} GROUP BY ?film ?filmLabel`;

async function viewPerson(id) {
  state('Pulling the filmography…');

  const [metaRows, filmRows] = await Promise.all([
    sparql(personMetaQuery(id)),
    sparql(filmographyQuery(id)),
  ]);

  const meta = flat(metaRows[0] || {});
  meta.label = await labelFor(id);
  const films = await repairNames(filmRows.map(flat), 'film', 'filmLabel');

  const life = meta.dob
    ? year(meta.dob) + '&ndash;' + (meta.dod ? year(meta.dod) : '')
    : '';
  const sub = [life, meta.occupations].filter(Boolean).join(' &middot; ');

  /* Same dates as the card, in characters a title can hold. An open span
     — "(1928–)" — is the person still being here, which is the point. */
  const lifeText = meta.dob
    ? ` (${year(meta.dob)}–${meta.dod ? year(meta.dod) : ''})`
    : '';
  setTitle((meta.label || id) + lifeText);

  const card = `
    <section class="card card-person">
      ${meta.img
        ? `<img class="card-portrait" src="${esc(thumb(meta.img, 240))}" alt="" >`
        : ''}
      <span class="card-person-text">
        <h2>${esc(meta.label || id)}</h2>
        ${sub ? `<p class="card-meta">${sub}</p>` : ''}
      </span>
    </section>`;

  const share = shareControls(
    `${meta.label} on Picture Wrap — which of their pictures still have someone.`,
    location.hash);

  if (!films.length) {
    show(card + share + `<p class="state">No screen credits recorded.</p>`);
    return;
  }

  const wikidataClosed = f => Number(f.credited) > 0 && f.credited === f.dead;

  /* Below the bar means verified, and the Vault is what verification
     produces. A filmography can hold sixty closed-looking pictures, and
     the survivor test is per-film — running it here would be hundreds of
     requests on a page load to re-derive an answer the poster already
     worked out offline. So we read that answer instead.

     Both conditions, not either. The Vault says a picture was closed when
     it was filed; Wikidata is live and may since have gained a living
     name. Whichever of them still says "running" wins, because the claim
     we must not make is the one that says everybody is gone.

     The cost is honest and worth naming: the Vault only reaches where the
     backfill has run, so a picture that closed outside those years stays
     above the bar until somebody asks about its years. That reads as
     "we don't know", which is true, rather than "someone is alive", which
     we would be inventing. */
  const vault = new Set((await loadArchive()).map(e => e.id));
  const closed = f => wikidataClosed(f) && vault.has(qid(f.film));

  /* Newest first, both sides — which makes this bar mean what the bar
     means everywhere else. Running films newest-first put the OLDEST
     still-open picture directly above it: the one most likely to close
     next. Wrapped films newest-first put the most recently closed directly
     below. Same rule as a film page — "probably next" above, "just went"
     below — and the same direction as the Vault. */
  const byYear = (a, b) => (b.year || '0000').localeCompare(a.year || '0000');

  const running = films.filter(f => !closed(f)).sort(byYear);

  const done = films.filter(closed).sort(byYear);

  show(
    card + share +
    `<ul class="roster">` +
      running.map(f => filmRow(f, false)).join('') +
      `<li class="bar" role="separator" aria-label="Above: still running. Below: wrapped."></li>` +
      done.map(f => filmRow(f, true)).join('') +
    `</ul>`
  );
}

/* What they did on this picture. The filmography query already binds the
   property that links them; it was simply being thrown away. Several
   roles are possible on one film — Woody Allen directs, writes and
   appears — and all of them are worth showing. */
function rolesOn(f) {
  const held = new Set(String(f.roles || '').split('|')
    .map(u => 'wdt:' + u.split('/').pop()));
  const seen = new Set();
  return CREDIT_NOUNS
    .filter(([p]) => held.has(p))
    .map(([, noun]) => noun)
    .filter(n => !seen.has(n) && seen.add(n))
    .map(sentence);
}

function filmRow(f, wrapped) {
  const qid = f.film.split('/').pop();
  const roles = rolesOn(f);
  return `
    <li class="is-link ${wrapped ? 'gone' : 'living'}" data-go="${esc(path(f.filmLabel, qid))}">
      <span class="who">
        <span class="who-name">${esc(f.filmLabel || qid)}</span>
        ${roles.length ? `<span class="who-role">${esc(roles.join(' &middot; ').replace(/&middot;/g, '·'))}</span>` : ''}
      </span>
      <span class="when">${wrapped ? esc(longDate(f.wrapped)) : esc(f.year || '')}</span>
    </li>`;
}


/* --- sharing ----------------------------------------------------------- */

/* Three affordances, not a row of platform badges. The native sheet where
   the browser offers one — which on a phone covers everything — then copy
   and Bluesky, which is where this project actually lives.

   The share text carries the fact rather than just the title, because a
   link travels away from the page that explains it. */
let shareWhat = { text: '', url: '' };

function shareControls(text, path) {
  shareWhat = { text, url: `${location.origin}${location.pathname}${path}` };
  return `
    <div class="share">
      <button data-back>&larr; Back</button>
      <button data-share="native" hidden>Share</button>
      <button data-share="copy">Copy link</button>
      <button data-share="bsky">Bluesky</button>
    </div>`;
}

function wireShare() {
  const native = document.querySelector('[data-share="native"]');
  if (native && navigator.share) native.removeAttribute('hidden');
}

/* Back goes back when there is somewhere to go, and home when there
   isn't — arriving from a Bluesky link means no in-site history, and a
   Back button that throws you off the site is worse than none. */
document.addEventListener('click', e => {
  if (!e.target.closest('[data-back]')) return;
  if (window.history.length > 1 && document.referrer.startsWith(location.origin)) {
    window.history.back();
  } else if (window.history.length > 1 && !document.referrer) {
    window.history.back();
  } else {
    location.hash = '';
  }
});

document.addEventListener('click', async e => {
  const btn = e.target.closest('[data-share]');
  if (!btn) return;
  const { text, url } = shareWhat;
  const kind = btn.dataset.share;

  if (kind === 'native' && navigator.share) {
    try { await navigator.share({ text, url }); } catch { /* dismissed */ }
    return;
  }

  if (kind === 'copy') {
    try {
      await navigator.clipboard.writeText(`${text}\n\n${url}`);
      const was = btn.textContent;
      btn.textContent = 'Copied';
      setTimeout(() => { btn.textContent = was; }, 1600);
    } catch { /* clipboard refused */ }
    return;
  }

  if (kind === 'bsky') {
    window.open('https://bsky.app/intent/compose?text=' +
      encodeURIComponent(`${text}\n\n${url}`), '_blank', 'noopener');
  }
});


/* --- archive ----------------------------------------------------------- */

/* Written by the poster, read here. It can't be a live query — asking
   Wikidata which films have nobody left times out even for a six-year
   slice, so this file is the only way the page exists. */
let archiveCache = null;

async function loadArchive() {
  if (archiveCache) return archiveCache;
  try {
    const res = await fetch('archive.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error(String(res.status));
    archiveCache = await res.json();
  } catch {
    archiveCache = [];
  }
  return archiveCache;
}

/* Which country's pictures to show. The Vault runs to 2,135 titles and
   nearly half aren't American — 287 French, 181 German, 120 Italian, 49
   Polish. That breadth is the best thing about it and also the problem: a
   column of Italian titles is unreadable noise unless you came for it. */
let vaultFilter = 'all';

async function viewArchive() {
  state('Opening the vault…');
  const all = await loadArchive();

  if (!all.length) {
    setTitle('The Vault');
    show(`
      <section class="card"><h2>The Vault</h2></section>
      <p class="state">Nothing here yet. It fills as pictures close &mdash;
      or all at once, if you run the backfill.</p>`);
    return;
  }

  renderArchive(all);
}

/* Grouped by the decade a picture closed in, newest first. The sections are
   the navigation — no filter tells you anything scrolling doesn't.

   Decades rather than years because closings are sparse and lumpy: an early
   sample ran 71 closings across 28 years, averaging 2.5 each, with whole
   years missing. A heading above a single row reads as a mistake.

   This will want revisiting once the archive is large. A full 1930–1965
   backfill puts on the order of a thousand closings into six decades, and
   two hundred rows under one heading is its own problem. */
function renderArchive(all) {
  /* The whole Vault, not the filtered view — the tab shouldn't change size
     because you clicked "French". */
  setTitle(`The Vault — ${all.length.toLocaleString('en')} pictures`);

  /* Counts come from the whole Vault, not the filtered view, so the row
     doesn't rearrange itself as you click through it. */
  const tally = new Map();
  for (const f of all) {
    const k = f.country || 'Other';
    tally.set(k, (tally.get(k) || 0) + 1);
  }
  const kinds = [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7);

  const chip = (value, label, n) => `
    <button data-vault="${esc(value)}" ${vaultFilter === value ? 'aria-current="true"' : ''}>
      ${esc(label)}<span>${n}</span>
    </button>`;

  const filters = `
    <div class="vault-filters">
      ${chip('all', 'All', all.length)}
      ${kinds.map(([k, n]) => chip(k, k, n)).join('')}
    </div>`;

  const sorted = [...all]
    .filter(f => vaultFilter === 'all' || (f.country || 'Other') === vaultFilter)
    .sort((a, b) => (b.wrapped || '').localeCompare(a.wrapped || ''));

  const decades = new Map();
  for (const f of sorted) {
    const y = Number(year(f.wrapped));
    const key = y ? `${Math.floor(y / 10) * 10}s` : 'Undated';
    if (!decades.has(key)) decades.set(key, []);
    decades.get(key).push(f);
  }

  /* Two levels of folding. A decade holds hundreds of closings — the 1990s
     alone has 763, which is not a list, it's a filing cabinet — so years
     nest inside. Newest decade open, and its newest year open inside that,
     so the page lands on the most recent closings rather than on a wall of
     shut drawers. */
  const sections = [...decades.entries()].map(([label, films], di) => {
    const years = new Map();
    for (const f of films) {
      const y = year(f.wrapped) || 'Undated';
      if (!years.has(y)) years.set(y, []);
      years.get(y).push(f);
    }

    const inner = [...years.entries()].map(([y, yearFilms], yi) => `
      <details class="yr" ${di === 0 && yi === 0 ? 'open' : ''}>
        <summary>
          <span class="yr-label">${esc(y)}</span>
          <span class="yr-count">${yearFilms.length}</span>
        </summary>
        <ul class="roster archive">
          ${groupByClosing(yearFilms).map(archiveRow).join('')}
        </ul>
      </details>`).join('');

    return `
      <details class="decade" ${di === 0 ? 'open' : ''}>
        <summary>
          <span class="decade-label">${esc(label)}</span>
          <span class="decade-count">${films.length}</span>
        </summary>
        ${inner}
      </details>`;
  }).join('');

  show(`
    <section class="card">
      <h2>The Vault</h2>
      <p class="card-quote">&mdash; it&rsquo;s full of stars</p>
    </section>
    ${filters}
    ${sections}
  `);
}

/* One death can take several pictures over the line at once — Mary
   Carlisle's closed four. Those belong together: the event is the person,
   and the films are what it happened to. */
function groupByClosing(films) {
  const groups = [];
  for (const f of films) {
    const key = `${f.last.id}|${(f.last.died || '').slice(0, 10)}`;
    const open = groups[groups.length - 1];
    if (open && open.key === key) open.films.push(f);
    else groups.push({ key, last: f.last, films: [f] });
  }
  return groups;
}

/* The unit is the closing, not the film. Same shape whether it took one
   picture or four — the person leads either way. */
function archiveRow(group) {
  const { last, films } = group;
  return `
    <li class="closing">
      <p class="closing-who">
        <span class="closing-name">${esc(last.name)}</span>
        ${last.character ? `<span class="closing-role">${esc(last.character)}</span>` : ''}
        <span class="closing-date">${esc(longDate(last.died))}</span>
      </p>
      <ul class="closing-films">
        ${films.map(f => `
          <li class="is-link" data-go="${esc(path(f.title, f.id))}">
            <span class="closing-film">
              <span class="who-name">${esc(f.title)}</span>
              ${[
                f.type ? `<span class="closing-kind">${esc(sentence(
                  [f.country, f.type].filter(Boolean).join(' ')))}</span>` : '',
                f.stars?.length
                  ? `<span class="closing-stars">with ${esc(f.stars.join(', '))}</span>`
                  : '',
              ].filter(Boolean).join('')}
            </span>
            <span class="when-span">${esc(f.year || '')}</span>
          </li>`).join('')}
      </ul>
    </li>`;
}


/* --- about ------------------------------------------------------------- */

/* The explanation that doesn't fit anywhere else. It was briefly crammed
   into the colophon, where it was an essay nobody would read in a footer.
   The limits described here are real and a visitor deserves them stated
   plainly rather than discovered. */
function viewAbout() {
  setTitle('About');
  show(`
    <section class="card">
      <h2>About</h2>
    </section>

    <div class="prose">
      <p>
        Every picture wraps twice: first when the shooting stops, and
        finally when the last person who made it is gone. This is a record of the
        second one.
      </p>

      <h3>The bar</h3>
      <p>
        A film&rsquo;s page is one list of everyone credited on it, divided by
        a gold bar. The living sit above it, the dead below. As people die
        they cross, the living section shrinks, and the bar rises. When it
        reaches the top, the picture has wrapped.
      </p>
      <p>
        Nothing counts anything for you. The bar&rsquo;s position is the
        reading. The two rows either side of it are the most recent death
        and the oldest survivor &mdash; who just went, and who is probably next.
      </p>

      <h3>Where this comes from</h3>
      <p>
        Cast, credits and death dates come from
        <a href="https://www.wikidata.org" rel="noopener">Wikidata</a>, live,
        every time you load a page. Portraits come from
        <a href="https://commons.wikimedia.org" rel="noopener">Wikimedia
        Commons</a> and are desaturated, because they span a century of
        photographic processes and otherwise look like an accident.
      </p>
      <p>
        Both are written by volunteers. Neither is complete.
      </p>
      <p id="about-tmdb" hidden>
        <a href="https://www.themoviedb.org" rel="noopener">TMDB</a> is
        asked as well, and about more than one thing. Character names, which
        Wikidata barely records &mdash; it has none at all for <em>The
        Umbrellas of Cherbourg</em>, TMDB has the lot. A fuller cast list,
        so people who worked on a picture but were never linked to it here
        still appear. And its own birth and death dates.
      </p>
      <p id="about-tmdb-2" hidden>
        That last one decides things. Before any picture is called wrapped,
        both databases are asked whether the people on it are living, and
        one recorded death anywhere is enough to say someone has died &mdash;
        while a missing death date is never enough to say they haven&rsquo;t.
        Asking only Wikidata, and quietly counting everyone it couldn&rsquo;t
        place as dead, was this site&rsquo;s worst mistake. This product uses
        the TMDB API but is not endorsed or certified by TMDB.
      </p>

      <h3>What &ldquo;everyone&rdquo; means</h3>
      <p>
        Cast, direction, writing, camera, music, cutting, production and
        costume design. A picture is not finished while its director is
        alive, and counting cast alone gets this wrong often &mdash; of six
        films that looked closed on their cast lists, four reopened once
        crew were counted.
      </p>
      <p>
        Below-the-line crew &mdash; grips, gaffers, second unit, sound &mdash; is not
        recorded in any free database. It is not recorded here either.
        &ldquo;Everyone&rdquo; can only ever mean everyone written down.
      </p>

      <h3>Whose cinema is here</h3>
      <p>
        Overwhelmingly American and European, and that is a limit of the
        source rather than a judgement. Of films from 1930 to 1945, Wikidata
        holds 8,285 American titles and 1,681 French ones. It holds 399
        Japanese titles, from an industry making around five hundred pictures
        a year, and <strong>37 Indian titles across sixteen years</strong>.
      </p>
      <p>
        A picture cannot appear here without a cast list, so those absences
        compound. The archive is a map of what volunteers have chosen to
        record as much as a map of cinema.
      </p>

      <h3>The Vault</h3>
      <p>
        Pictures with no one left, newest closing first. It is the only part
        of this site that isn&rsquo;t live &mdash; asking Wikidata which films have
        no survivors takes longer than any page can wait, so the answer is
        worked out in advance and stored.
      </p>
      <p>
        Which means it can drift. If someone adds a living cast member to a
        film in the Vault, that film&rsquo;s own page will show it correctly as
        open while the Vault still lists it as closed, until the next check.
      </p>
      <p>
        It is also not the whole of cinema. Working out which pictures have
        closed has been done for <strong>1930 to 1945</strong> and, so far,
        no further &mdash; everything else here is a closing that happened
        while this site was watching. So a picture&rsquo;s absence from the
        Vault means one of two things, and the Vault cannot tell you which:
        somebody who made it is alive, or nobody has looked yet.
      </p>

      <h3>Mistakes</h3>
      <p>
        A film may show a bar at the top because everyone recorded has died,
        while people who were never recorded are alive. A death date may be
        wrong, or added by someone in error. Nothing is announced without a
        person reading it first, but the pages themselves are only as good as
        the record beneath them.
      </p>
      <p class="prose-close">
        Absence of a death date is not evidence of life.
      </p>
    </div>`);
  revealTmdb();
}



/* --- landing ----------------------------------------------------------- */

/* The masthead tagline carries the idea; nothing else needs saying here.
   Once the poster has written an archive, the way in becomes the most
   recent closings — so the page keeps itself current. PICKS is only the
   fallback for an empty archive. */
async function viewLanding() {
  /* The front door carries no qualifier — the site's own name is what's up. */
  setTitle('');
  const archive = await loadArchive();
  const recent = archive.slice(0, 5);

  const picks = recent.length
    ? recent.map(f => `<button data-go="${esc(path(f.title, f.id))}">${esc(f.title)}` +
        `<span class="pick-year">${esc(year(f.wrapped))}</span></button>`).join('')
    : PICKS.map(p => `<button data-go="${esc(path(p.name, p.id))}">${esc(p.name)}</button>`).join('');

  /* The way through sits below the pictures, not up in the masthead —
     you should meet a few closings before you're offered all of them. */
  show(`
    <section class="landing">
      ${recent.length ? `<p class="landing-label">Recently wrapped</p>` : ''}
      <div class="landing-picks">${picks}</div>
      <p class="landing-more">
        <a href="#/archive">The Vault${
          archive.length ? ` &middot; ${archive.length}` : ''}</a>
      </p>
    </section>`);
}


/* --- router ------------------------------------------------------------ */

/* One delegated handler for every navigable thing on the page. */
document.addEventListener('click', e => {
  const vault = e.target.closest('[data-vault]');
  if (vault) {
    vaultFilter = vault.dataset.vault;
    renderArchive(archiveCache || []);
    window.scrollTo(0, 0);
    return;
  }

  const el = e.target.closest('[data-go]');
  if (el) location.hash = el.dataset.go;
});

/* Is this Q-id a person or a picture? One query, ~0.16s, and it lands
   inside the loading state the page already shows — so the URL doesn't
   have to carry a word explaining itself. */
const kindCache = new Map();

async function kindOfId(id) {
  if (kindCache.has(id)) return kindCache.get(id);
  try {
    const rows = await sparql(`
      SELECT (IF(BOUND(?human), "person", "title") AS ?kind) WHERE {
        OPTIONAL { wd:${id} wdt:P31 wd:Q5 . BIND(1 AS ?human) }
      }`);
    const kind = flat(rows[0] || {}).kind || 'title';
    kindCache.set(id, kind);
    return kind;
  } catch {
    return 'title';
  }
}

/* The Vault needs a way back from a film or a person. The landing page
   already has one under the chips, so the masthead link only appears
   elsewhere — otherwise the same link sits twice on one screen. */
function showNav(on) {
  const nav = document.getElementById('nav');
  if (nav) nav.hidden = !on;
}

async function route() {
  /* URLs are #/barbara-adolph/Q807328 — the readable part, then the id.
     The Q-id is found wherever it sits, so every URL ever published still
     works, including #/person/Q807328/barbara-adolph and bare #/film/Q…. */
  const segments = location.hash.split('/').slice(1);
  const id = segments.find(s => /^Q\d+$/.test(s));
  let kind = segments.find(s => ['film', 'person', 'archive', 'about'].includes(s));
  window.scrollTo(0, 0);

  try {
    showNav(!!id || kind === 'about');

    if (kind === 'archive') { await viewArchive(); return; }
    if (kind === 'about') { viewAbout(); return; }
    if (!id) { await viewLanding(); return; }

    /* No kind in the URL: ask what the id is. */
    if (kind !== 'film' && kind !== 'person') {
      state('Looking…');
      kind = (await kindOfId(id)) === 'person' ? 'person' : 'film';
    }

    if (kind === 'film') await viewFilm(id);
    else await viewPerson(id);
  } catch (err) {
    state('Wikidata didn’t answer. Give it a moment and try again.');
    console.error(err);
  }
}

/* TMDB's terms require attribution wherever their data appears. The line
   is in the markup but hidden, and only revealed if a key is actually set
   — otherwise the site would be crediting a source it never called. */
/* TMDB's terms require attribution wherever their data appears, and it
   would be false to credit a source we never call — so both mentions stay
   hidden until a key is actually set. The About paragraph is written into
   the page by viewAbout, hence the check on each render rather than once. */
function revealTmdb() {
  if (!TMDB_KEY) return;
  document.getElementById('tmdb-credit')?.removeAttribute('hidden');
  document.getElementById('about-tmdb')?.removeAttribute('hidden');
  document.getElementById('about-tmdb-2')?.removeAttribute('hidden');
}
revealTmdb();

window.addEventListener('hashchange', route);
route();
