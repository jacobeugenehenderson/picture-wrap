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

const WDQS   = 'https://query.wikidata.org/sparql';
const WD_API = 'https://www.wikidata.org/w/api.php';

/* What counts as a picture. Television earns its place through age rather
   than through completeness: I Love Lucy has 17 cast on record and 16 of
   them dead, the bar one row from the top, and the survivor is the child
   who played Little Ricky.

   Incomplete cast lists are much less dangerous on old television than on
   recent — the actors Wikidata never recorded for a 1951 show are dead
   too. The risk sits with middle-aged series like Cheers, where the
   unrecorded are plausibly still alive. */
const KINDS = [
  'Q11424',      // film
  'Q5398426',    // television series
  'Q1259759',    // miniseries
  'Q117467246',  // animated television series — a SEPARATE item from
                 // Q5398426, which is why BoJack Horseman was invisible
  'Q202866',     // animated film
];

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

/* Label languages, in preference order. English first, then the major
   European languages, then everything else. Order matters: the label
   service walks this list and takes the first hit. */
const LANGS = 'en,fr,de,it,es,pt,nl,sv,da,no,fi,is,pl,cs,sk,hu,ro,bg,sr,hr,sl,uk,ru,el,tr,he,ar,fa,hi,bn,ta,te,ml,kn,mr,ur,th,vi,id,ms,ja,ko,zh,ca,eu,gl,et,lv,lt,ga,cy,sq,mk,ka,hy,az,kk,uz,af,sw,yi,la';

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

   If someone is missing from search, check their P106 first — it is almost
   always an occupation item nobody thought to include. */
const OCCUPATIONS = [
  'Q33999',     // actor
  'Q10800557',  // film actor        — commoner than Q33999 in practice
  'Q10798782',  // television actor
  'Q2259451',   // stage actor
  'Q2405480',   // voice actor
  'Q948329',    // character actor
  'Q2526255',   // film director
  'Q3455803',   // director
  'Q28389',     // screenwriter
  'Q222344',    // cinematographer
  'Q3282637',   // film producer
  'Q36834',     // composer
  'Q7042855',   // film editor
];

/* Credits Wikidata actually records. Below-the-line crew — grips, gaffers,
   the second unit — simply isn't in there, so "everyone" always means
   "everyone documented". The colophon says so plainly. */
const CREDITS = [
  ['wdt:P57',   'Director'],
  ['wdt:P58',   'Screenplay'],
  ['wdt:P344',  'Cinematography'],
  ['wdt:P86',   'Music'],
  ['wdt:P162',  'Producer'],
  ['wdt:P1040', 'Editor'],
  ['wdt:P2554', 'Production design'],
  ['wdt:P4805', 'Costume design'],
];

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

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

function year(iso) {
  return iso ? iso.slice(0, 4) : '';
}

/* "2004-07-01T00:00:00Z" -> "1 July 2004" */
function longDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return year(iso);
  return d.toLocaleDateString('en-GB',
    { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/* Commons file URL -> a sensibly sized thumbnail. */
function thumb(url, w = 120) {
  return url ? url.replace(/^http:/, 'https:') + '?width=' + w : '';
}

function show(html) { stage.innerHTML = html; }
function state(msg) { show(`<p class="state">${esc(msg)}</p>`); }


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
    ${CREDITS.map(([p, label]) => `(${p} "${label}")`).join('\n    ')}
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

  everyone = [...people.values()];
  filmMeta = meta;

  if (!everyone.length) {
    show(titleCard(meta, null) +
      `<p class="state">Wikidata has no one credited on this one.</p>`);
    return;
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
     to be unfolded. Collapsing the crew doesn't close a picture. */
  const allLiving = everyone.filter(p => !p.dod);
  const wrapDate = allLiving.length === 0
    ? everyone.map(p => p.dod).sort().pop()
    : null;

  const front = split(cast);
  const back  = split(crew);

  /* The state worth naming: every face is gone, but someone who made it
     is still here. */
  const castComplete =
    cast.length > 0 && front.living.length === 0 && allLiving.length > 0;

  show(
    titleCard(filmMeta, wrapDate) +

    /* Crew sits above the cast, the way a title card runs. Collapsed it's
       a single row, so it costs the cast list almost nothing — and on an
       old picture it's a who's who in its own right, which is why it's a
       card rather than a footnote. The gold bar stays unique to the cast;
       the crew's own divider is a hairline. */
    (crew.length ? `
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
      </details>` : '') +

    (castComplete
      ? `<p class="card-thin">Everyone on screen is gone. Someone who worked
         behind the camera is still with us.</p>`
      : '') +

    `<ul class="roster">` +
      front.living.map(personRow).join('') +
      `<li class="bar" role="separator" aria-label="Above: living. Below: died."></li>` +
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
          TMDB credits ${unrecorded.length} more ${unrecorded.length === 1 ? 'person' : 'people'}
          on this picture, and Wikidata has no record of ${unrecorded.length === 1 ? 'them' : 'any of them'}
          &mdash; no dates, living or otherwise. They are listed here and left out
          of everything above, because counting them either way would be a guess.
          <a href="https://bsky.app/profile/${esc(BLUESKY)}" rel="noopener">Corrections welcome</a>.
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
SELECT ?xLabel WHERE {
  # VALUES, not BIND — the label service resolves labels for variables bound
  # by VALUES and silently returns the Q-number for ones bound by BIND.
  VALUES ?x { wd:${id} }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${LANGS}". }
}`;

async function labelFor(id) {
  try {
    const rows = await sparql(labelQuery(id));
    const label = flat(rows[0] || {}).xLabel;
    return label && !/^Q\d+$/.test(label) ? label : '';
  } catch {
    return '';
  }
}

function pickDemonym(forms) {
  const all = String(forms || '').split('|').map(s => s.trim()).filter(Boolean);
  if (!all.length) return null;
  const singular = all.filter(f => !f.endsWith('s'));
  const pool = singular.length ? singular : all;
  /* Prefer an adjective ending. Length alone isn't enough — "Spaniard" is
     longer than "Spanish", and "Briton" competes with "British". */
  const adjective = pool.filter(f => /(ish|ian|ean|ese|an|ch|sh|ic)$/i.test(f));
  return (adjective.length ? adjective : pool)
    .reduce((a, b) => (b.length > a.length ? b : a));
}

const sentence = s => (s ? s[0].toUpperCase() + s.slice(1) : '');

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
    ? `<p class="card-wrapped">Picture wrapped ${esc(longDate(wrappedOn))}</p>` +
      (unrecorded.length
        ? `<p class="card-thin">Everyone with a record has died. ${unrecorded.length}
           further credited ${unrecorded.length === 1 ? 'name has' : 'names have'}
           no record at all, and could be either.</p>`
        : '')
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
    <li class="is-link ${gone ? 'gone' : 'living'}" data-go="#/person/${esc(qid)}">
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
/* Cast (P161) and voice cast (P725) join the crew properties here. The
   crew FOLD is built from CREDITS alone, so voice actors stay in the
   roster where they belong; this list is only for "what is this person
   credited on" and "is everyone credited dead". Keep it in step with
   CREDITS in poster/lib.js. */
const CREDIT_PROPS = CREDITS.map(([p]) => p).concat('wdt:P161', 'wdt:P725').join(', ');

const filmographyQuery = id => `
SELECT ?film ?filmLabel (SAMPLE(?y) AS ?year) (COUNT(DISTINCT ?c) AS ?credited)
       (COUNT(DISTINCT ?cd) AS ?dead) (MAX(?dv) AS ?wrapped) WHERE {
  VALUES ?mine { ${CREDIT_PROPS.split(', ').join(' ')} }
  ?film ?mine wd:${id} .
  ?film ?any ?c .
  FILTER(?any IN (${CREDIT_PROPS}))
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
  const films = filmRows.map(flat);

  const life = meta.dob
    ? year(meta.dob) + '&ndash;' + (meta.dod ? year(meta.dod) : '')
    : '';
  const sub = [life, meta.occupations].filter(Boolean).join(' &middot; ');

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

  if (!films.length) {
    show(card + `<p class="state">No screen credits recorded.</p>`);
    return;
  }

  const isWrapped = f => Number(f.credited) > 0 && f.credited === f.dead;

  /* Newest first, both sides — which makes this bar mean what the bar
     means everywhere else. Running films newest-first put the OLDEST
     still-open picture directly above it: the one most likely to close
     next. Wrapped films newest-first put the most recently closed directly
     below. Same rule as a film page — "probably next" above, "just went"
     below — and the same direction as the Vault. */
  const byYear = (a, b) => (b.year || '0000').localeCompare(a.year || '0000');

  const running = films.filter(f => !isWrapped(f)).sort(byYear);

  const done = films.filter(isWrapped).sort(byYear);

  show(
    card +
    `<ul class="roster">` +
      running.map(f => filmRow(f, false)).join('') +
      `<li class="bar" role="separator" aria-label="Above: still running. Below: wrapped."></li>` +
      done.map(f => filmRow(f, true)).join('') +
    `</ul>`
  );
}

function filmRow(f, wrapped) {
  const qid = f.film.split('/').pop();
  return `
    <li class="is-link ${wrapped ? 'gone' : 'living'}" data-go="#/film/${esc(qid)}">
      <span class="who">
        <span class="who-name">${esc(f.filmLabel || qid)}</span>
      </span>
      <span class="when">${wrapped ? esc(longDate(f.wrapped)) : esc(f.year || '')}</span>
    </li>`;
}


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
          <li class="is-link" data-go="#/film/${esc(f.id)}">
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
  show(`
    <section class="card">
      <h2>About</h2>
    </section>

    <div class="prose">
      <p>
        Every picture wraps twice. Once when the shooting stops, and once
        when the last person who made it is gone. This is a record of the
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
        Character names are filled in from
        <a href="https://www.themoviedb.org" rel="noopener">TMDB</a>, which
        records them far more thoroughly &mdash; Wikidata has none at all for
        <em>The Umbrellas of Cherbourg</em>, TMDB has the lot. Nothing else
        comes from there. Who is credited and who has died is Wikidata&rsquo;s
        answer alone. This product uses the TMDB API but is not endorsed or
        certified by TMDB.
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
  const archive = await loadArchive();
  const recent = archive.slice(0, 5);

  const picks = recent.length
    ? recent.map(f => `<button data-go="#/film/${esc(f.id)}">${esc(f.title)}` +
        `<span class="pick-year">${esc(year(f.wrapped))}</span></button>`).join('')
    : PICKS.map(p => `<button data-go="#/film/${p.id}">${esc(p.name)}</button>`).join('');

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

async function route() {
  const [, kind, id] = location.hash.split('/');
  window.scrollTo(0, 0);

  try {
    if (kind === 'archive') { await viewArchive(); return; }
    if (kind === 'about') { viewAbout(); return; }
    if (!id || !/^Q\d+$/.test(id)) { await viewLanding(); return; }

    if (kind === 'film') await viewFilm(id);
    else if (kind === 'person') await viewPerson(id);
    else await viewLanding();
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
}
revealTmdb();

window.addEventListener('hashchange', route);
route();
