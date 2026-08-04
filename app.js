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

/* The ?v= must match index.html's on app.js, and must be bumped whenever
   ANY of the three files changes.

   index.html versions app.js and nothing else, so a browser holding a
   cached verify.js would fetch a new app.js and then refuse to run it:
   "does not provide an export named beyondLiving", and a blank page for
   everyone who had ever visited before. The imports carry the token so
   the whole module graph turns over together. */
import { survivors, beyondLiving, earliestLivingBirthYear, impossible } from './verify.js?v=55';
import { openCorpus } from './corpus.js?v=55';
import {
  CREW, IN_LIST, VALUES, KINDS, OCCUPATIONS, LANGS,
  nonLatin, nameFromArticle,
  CREDIT_NOUNS, qid, year, longDate, pickDemonym, path, sentence,
} from './shared.js?v=55';

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
SELECT (MIN(?y) AS ?year) (SAMPLE(?t) AS ?tmdb) (SAMPLE(?tv) AS ?tmdbTv)
       (SAMPLE(?tyl) AS ?type) (GROUP_CONCAT(DISTINCT ?dem; separator="|") AS ?demonyms)
       (GROUP_CONCAT(DISTINCT ?dl; separator=", ") AS ?directors) WHERE {
  BIND(wd:${id} AS ?f)
  OPTIONAL { ?f wdt:P4947 ?t }
  # P4947 is the TMDB *movie* id. A series carries P4983 instead, and asking
  # only for the first is why every television page ran on Wikidata alone —
  # six credited people for BoJack Horseman, where TMDB holds four hundred.
  OPTIONAL { ?f wdt:P4983 ?tv }
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

  /* Which TMDB endpoint this picture lives behind. A series id and a film
     id are different numbering systems; using one against the other
     answers about a different work entirely. */
  meta.media  = meta.tmdbTv ? 'tv' : 'movie';
  meta.tmdbId = meta.tmdbTv || meta.tmdb || null;

  const extra = await addCharacters(meta.tmdbId, meta.media, people);
  undated = extra.unknown;

  /* People TMDB credits and Wikidata knows, just not on this picture. They
     belong in the roster — they were in the film and we know their dates. */
  for (const person of extra.resolved) {
    if (!people.has(person.p)) people.set(person.p, person);
  }

  everyone = await repairNames([...people.values()], 'p', 'pLabel');

  /* Marked once, here, rather than checked at each place a name could be
     printed — a name is printed in five places and the sixth would be the
     one that leaked. */
  const withheld = await loadSuppressed();
  for (const person of everyone) {
    if (person.p && withheld.has(person.p.split('/').pop())) person.suppressed = true;
  }

  meta.qid = id;                     /* the roster needs it for the edit link */
  filmMeta = meta;

  /* Nobody credited here can be alive, whatever the absence of a death
     date suggests. This is the roster's own version of the rule the
     survivor test applies to everyone else, and it had no version of it
     at all: a missing P570 read as a pulse for ever. The Fortieth Door
     was held open by Bruce Gordon, born 1850.

     They leave the reckoning rather than move below the bar, because
     inferring a death does not produce a date and the rows below the bar
     are dates. The dash in the third zone is the whole disclosure: gone,
     and nobody wrote down when. */
  /* Rule 6, which this page did not have. Nobody worked on a picture
     released before they were born, and a credit that fails that test
     votes on nothing.

     It matters most exactly where it was missing. Someone dead is simply
     a wrong row; someone LIVING vetoes the wrap for ever and the page
     never says why. Gidget (1959) is the case: Wikidata's P58 points at
     Q5516102, an Australian politician born in 1964, and not at the
     Gabrielle Upton who wrote it and died in 2022. The Vault had the
     rule and the film page did not, so the same picture read two ways on
     one site — which is the disagreement this project keeps having, and
     it is always about which code read the data rather than the data.

     `impossible` takes a person shaped as verify.js shapes them; the
     roster's rows are flat. Adapted here rather than loosening the
     signature, because the poster passes real records and this is the
     only caller that does not.

     Same destination as the rule below, and for the same reason: they
     were credited, so the record should show it, and they are outside
     the reckoning, so they cannot sit above the bar. */
  const misattributed = everyone.filter(
    p => impossible({ wd: { born: p.dob } }, meta.year));

  /* Nobody credited here can be alive, whatever the absence of a death
     date suggests. This is the roster's own version of the rule the
     survivor test applies to everyone else, and it had no version of it
     at all: a missing P570 read as a pulse for ever. The Fortieth Door
     was held open by Bruce Gordon, born 1850.

     They leave the reckoning rather than move below the bar, because
     inferring a death does not produce a date and the rows below the bar
     are dates. The dash in the third zone is the whole disclosure: gone,
     and nobody wrote down when. */
  const beyond = everyone.filter(p => !p.dod && beyondLiving(p.dob, meta.year));

  const excluded = [...new Set([...misattributed, ...beyond])];
  if (excluded.length) {
    const out = new Set(excluded);
    everyone = everyone.filter(p => !out.has(p));
    undated = undated.concat(excluded.map(p => ({
      id: p.tmdbPerson, name: p.pLabel, character: p.credits[0] || '',
      p: p.p, img: p.img,
    })));
  }

  if (!everyone.length) {
    setTitle(filmName(meta));
    show(titleCard(meta, null, null) +
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
  tmdbFailed = false;


  /* The other reason to ask. Resolving a TMDB credit against Wikidata by
     id (above) finds an item and its dates; it does not decide anything.
     An item with a birth date and no death date is not a survivor — it is
     an item with a birth date and no death date, and verify.js is the only
     thing on this site allowed to turn that into 'alive'.

     W.T. McCulley, Red McLaren in The Sawdust Trail, is the case. Born
     1887, no death recorded, so the roster drew him as living and held the
     bar down, while the Vault — which asked verify.js, which will not call
     a man of 139 alive — had the picture closed. Same page, two answers.
     The disagreement was never about the data; it was about which code
     read it. */
  const unjudged = everyone.filter(p => p.fromTmdb && !p.dod);

  if ((everyone.every(p => p.dod) || unjudged.length) && meta.tmdbId) {
    state('Checking the cast against TMDB…');
    const found = await survivors({
      film: id, tmdbId: meta.tmdbId, media: meta.media, year: meta.year,
      sparql: sparqlRows, tmdb: tmdbGet,
    });

    /* They go INTO the list. They were in the picture and we know they are
       living, which is the entire qualification for a row above the bar —
       and the bar then falls to where it belongs without anything being
       told to move it.

       They were previously left in "Credited, no record" and explained in
       a sentence underneath, which was wrong twice over: there IS a record,
       it is why the picture is not in the Vault, and a person the page is
       about does not belong in a fold at the bottom. Nothing counts
       anything for you; the position of the bar is the reading. */
    const listed = new Set(everyone.map(p => String(p.tmdbPerson || '')));
    for (const person of found.alive) {
      if (listed.has(String(person.tmdbId))) continue;
      everyone.push({
        p: person.wikidata || '',
        pLabel: person.name,
        img: person.img || '',
        dob: person.born || '',
        dod: '',
        credits: person.role ? [person.role] : [],
        onScreen: person.onScreen,
      });
    }

    /* Not the same as finding nobody. Without an answer we decline to
       raise the bar rather than make the strongest claim on the site out
       of a failed request. */
    tmdbFailed = !found.ok;

    /* And the same test read the other way. A TMDB-resolved row the test
       did not name as living has been judged: dead by TMDB's dates or by
       Wikidata under another name, or too old for either word to mean
       anything. Whichever it was, the roster may not keep it above the
       bar. It moves to the third zone, which is exactly what that zone
       says — credited, and outside the reckoning.

       Only when the test actually ran. A failed lookup judges nobody, and
       these rows stay where they were. */
    if (found.ok) {
      const living = new Set(found.alive.map(a => String(a.tmdbId)));
      const demoted = unjudged.filter(p => !living.has(String(p.tmdbPerson)));

      if (demoted.length) {
        const out = new Set(demoted);
        everyone = everyone.filter(p => !out.has(p));
        undated = undated.concat(demoted.map(p => ({
          id: p.tmdbPerson,
          name: p.pLabel,
          character: p.credits[0] || '',
          p: p.p,
          img: p.img,
        })));
      }
    }

    /* Anyone now in the list is no longer unaccounted for. */
    const shown = new Set(found.alive.map(a => String(a.tmdbId)));
    undated = undated.filter(u => !shown.has(String(u.id)));
  }

  renderRoster();
}

/* Fill in character names from TMDB for anyone Wikidata didn't name.
   Joined on TMDB person id, so there's no fuzzy matching — a person
   either maps or is left alone. Wikidata's own P453 always wins when it
   exists; it's curated and this isn't.

   Entirely best-effort: no key, no film id, a network failure or a
   rate-limit all just leave the page as it was. */
async function addCharacters(tmdbId, media, people) {
  if (!TMDB_KEY || !tmdbId) return { resolved: [], unknown: [] };

  try {
    /* aggregate_credits for a series: its /credits is the billed regulars
       only, five people where the aggregate has 248. And its entries carry
       `roles` rather than `character`, because one actor may have played
       several parts across the run. */
    const data = await tmdbGet(media === 'tv'
      ? `/tv/${encodeURIComponent(tmdbId)}/aggregate_credits`
      : `/movie/${encodeURIComponent(tmdbId)}/credits`);
    if (!data) return { resolved: [], unknown: [] };

    const cast = (Array.isArray(data.cast) ? data.cast : []).map(c => ({
      ...c, character: c.character ?? c.roles?.[0]?.character ?? '',
    }));
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
        credits: roles2.get(r.tmdb) ? [roles2.get(r.tmdb)] : [],

        /* Where this row came from, and the key the survivor test answers
           by. Both matter later: an item found this way carries whatever
           dates Wikidata happens to hold and nothing has judged them yet,
           so the roster may not treat a missing death date as a pulse
           until verify.js has said so. */
        tmdbPerson: r.tmdb,
        fromTmdb: true,
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
let undated = [];

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

     Survivors TMDB knows and Wikidata did not attach to the film are in
     `everyone` by the time this runs, so they hold the bar down by being
     in the list, the same way anybody else does. */
  const allLiving = everyone.filter(p => !p.dod);
  const wrapDate = allLiving.length === 0 && !tmdbFailed
    ? everyone.map(p => p.dod).sort().pop()
    : null;

  const front = split(cast);
  const back  = split(crew);

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
     person outlived everyone else who made this.

     The cast is not automatically the answer. Preferring it put "Josie
     Sedgwick was the last of its makers" directly under a stamp reading 5
     October 1974 on The Sawdust Trail — she died in April 1973, and the
     man who outlived her was its cinematographer, Virgil Miller. Whoever
     died last, wherever they were credited: it is the same date the stamp
     is already showing. */
  const lastOne = wrapped
    ? [front.dead[0], back.dead[0]].filter(Boolean)
        .sort((a, b) => (b.dod || '').localeCompare(a.dod || ''))[0] || null
    : null;

  const bar =
    `<li class="bar" role="separator" aria-label="Above: living. Below: died."></li>`;

  /* The fold opens when it holds the person the page is talking about.

     Otherwise the page names somebody and hides them: The Sundial says
     "Iga Cembrzyńska was the last of its makers" and she is its composer,
     so she sat behind a click. The Wizard of Oz has the same problem from
     the other side — the one living person holding it open is a stand-in,
     which is a crew credit.

     Everywhere else it stays shut. A fold is for the people a reader has
     not asked about yet, and on a picture with forty crew that is still
     most of them. */
  const crewHoldsTheStory = wrapped
    ? Boolean(lastOne && back.dead[0] === lastOne)
    : back.living.length > 0;

  /* The divider separates living from dead, so it only means anything
     when there is one of each. With everyone gone it floats to the top of
     the fold and reads as a second wrap bar — which is the one mark on
     this site that is supposed to appear once. */
  const crewDivider = back.living.length && back.dead.length
    ? `<li class="hairline" role="separator" aria-label="Above: living. Below: died."></li>`
    : '';

  const crewFold = crew.length ? `
    <details class="fold"${crewHoldsTheStory ? ' open' : ''}>
      <summary>
        <span class="fold-title">Behind the camera</span>
        <span class="fold-hint">${crew.length}</span>
      </summary>
      <ul class="roster">
        ${back.living.map(personRow).join('')}
        ${crewDivider}
        ${back.dead.map(personRow).join('')}
      </ul>
    </details>` : '';

  show(
    titleCard(filmMeta, wrapDate, lastOne) +
    shareControls(shareText, location.hash) +
    sourcesNote(filmMeta) +

    /* The bar is under the title when the picture has wrapped, so nothing
       caps the roster any more. Still running: the crew card sits above,
       and the bar does its usual job inside the cast list. */
    crewFold +

    `<ul class="roster">` +
      front.living.map(personRow).join('') +
      (wrapped ? '' : bar) +
      front.dead.map(personRow).join('') +
    `</ul>` +

    /* The third zone. Above the bar, living; below it, gone; and below the
       credits entirely, people credited on the picture that nobody has
       recorded a date for.

       They are in the list because they were in the film, and they are
       outside the reckoning because a blank is neither a death nor a
       pulse. Set apart rather than folded away: no heading, no count, no
       note asking to be corrected — a label like "no record" turns an
       absence into a finding. The dash is the whole disclosure. */
    (undated.length
      ? `<ul class="roster unlisted">${undated.map(undatedRow).join('')}</ul>`
      : '') +

    /* The way to fix any of this. It points at Wikidata rather than at us
       because that is where a correction does the most good — the item is
       read by everything downstream, and this archive is only one of the
       things reading it. It used to live inside the fold that has just
       been removed, which meant the one affordance on the page was hidden
       behind a disclosure triangle. */
    (filmMeta.qid
      ? `<p class="correction">A name missing, or a date?
           <a href="https://www.wikidata.org/wiki/${esc(filmMeta.qid)}"
              rel="noopener">Edit this picture on Wikidata</a>.</p>`
      : '')
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

function titleCard(meta, wrappedOn, lastOne) {
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
    ? `<p class="card-wrapped">Final picture wrap &middot; ${esc(longDate(wrappedOn))}</p>`
    : '';

  /* Where the bar ends up. It rises as the living list shrinks, and when
     there is nobody left it leaves the roster entirely and comes to rest
     under the title — which is both the top of the page and the end of
     the journey the whole design is about.

     So there is exactly one bar per picture and its position is the
     entire answer. Under the title: wrapped. Anywhere else: not. Nothing
     needs a badge, a legend or a sentence, and a reader who has seen one
     wrapped picture can read every other page at a glance. */
  return `
    <section class="card${wrappedOn ? ' is-wrapped' : ''}">
      <h2>${esc(meta.label || 'Untitled')}</h2>
      ${wrappedOn
        ? `<hr class="bar bar-title" aria-label="This picture has wrapped.">`
        : ''}
      ${bits ? `<p class="card-meta">${bits}</p>` : ''}
      ${stamp}
      ${lastOne
        ? `<p class="closing-line">${esc(lastOne.pLabel)} was the last of its makers.</p>`
        : ''}
    </section>`;
}

/* How many databases could be asked about this picture.

   Derived from whether the picture has a TMDB record at all, not read off
   a stored flag — this page already knows, and a fact computed where it is
   shown cannot drift from one recorded somewhere else.

   Only shown when the answer is one, and phrased as a limit on the check
   rather than as a verdict on the picture. The Vault's version of this
   was two words, "Wikidata alone", and it was read as meaning we were
   confident enough not to look further. A sentence cannot be read that
   way. */
function sourcesNote(meta) {
  if (meta.tmdbId) return '';
  return `
    <p class="sources-note">
      TMDB has no record of this picture, so its cast list could not be
      checked against a second source. Wikidata&rsquo;s cast lists are
      routinely a fraction of the real cast, and anyone it has not
      recorded is not counted here.
    </p>`;
}

/* Same row, minus the one thing this zone cannot give: a date. Only a
   name, whatever they were credited as, and the dash. */
function undatedRow(p) {
  /* Most of this zone is people Wikidata has never heard of, and there is
     nowhere to send you. Some of it is people it has an item for whose
     dates still don't settle the question — they keep their portrait and
     their link, because the item is where a correction would go. */
  const qid = p.p ? p.p.split('/').pop() : '';
  return `
    <li${qid ? ` class="is-link" data-go="${esc(path(p.name, qid))}"` : ''}>
      ${p.img
        ? `<img class="portrait" src="${esc(thumb(p.img))}" alt=""
               loading="lazy" data-full="${esc(p.img)}"
               data-name="${esc(p.name || '')}">`
        : `<span class="portrait" aria-hidden="true"></span>`}
      <span class="who">
        <span class="who-name">${esc(p.name)}</span>
        ${p.character ? `<span class="who-role">${esc(p.character)}</span>` : ''}
      </span>
      <span class="when"><span class="when-span when-open">&mdash;</span></span>
    </li>`;
}

function personRow(p) {
  /* Somebody TMDB credits and Wikidata has no item for still gets a row —
     they were in the picture. There is just nowhere to send you. */
  const qid = p.p ? p.p.split('/').pop() : '';
  const gone = Boolean(p.dod);

  /* Asked not to be named. The row stays, holds its place, and says the
     only thing left to say. */
  if (p.suppressed) {
    return `
    <li class="${gone ? 'gone' : 'living'}">
      <span class="portrait" aria-hidden="true"></span>
      <span class="who"><span class="who-name who-withheld">Name withheld by request</span></span>
      <span class="when">${gone ? '' : `<span class="when-span when-open">&mdash;</span>`}</span>
    </li>`;
  }
  return `
    <li class="${qid ? 'is-link ' : ''}${gone ? 'gone' : 'living'}"${
      qid ? ` data-go="${esc(path(p.pLabel, qid))}"` : ''}>
      ${p.img
        ? `<img class="portrait" src="${esc(thumb(p.img))}" alt=""
               loading="lazy" data-full="${esc(p.img)}"
               data-name="${esc(p.pLabel || '')}">`
        : `<span class="portrait" aria-hidden="true"></span>`}
      <span class="who">
        <span class="who-name">${esc(p.pLabel || qid)}</span>
        ${p.credits.length
          ? `<span class="who-role">${esc(p.credits.join(' &middot; ').replace(/&middot;/g, '·'))}</span>`
          : ''}
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

  /* The film pages move these people out of the roster before this runs,
     so this is the belt to that braces: wherever else a row is drawn, the
     open dash is not written for someone who cannot be alive to be still
     going. The year alone, and nothing claimed on top of it. */
  if (born && beyondLiving(p.dob)) {
    return `<span class="when-span">${born}</span>`;
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
   any capacity, and everyone else credited on those films. Nothing this
   returns is shown — it decides which side of the bar a film falls on,
   and what date is written beneath it.

   It used to return that as arithmetic: a count of credits, a count of
   deaths, a count of the too-old, and MAX(death) for the date. Each of
   this project's rules then had to be expressible as another COUNT
   column, and two of them are not. So the query returns the people
   instead — one `person#birthyear#death` per credit — and every rule is
   applied once, in JavaScript, on the same facts verify.js is given.

   The rules this page was missing, both of which made it contradict the
   film pages it links to:

   Born after the picture was released. Philip Glass, born 1937, is
   credited on Dracula (1931) for a score he wrote in 1999. He held it
   open here while the Vault had it closed on Carla Laemmle in 2014 —
   and would have held it open forever, being alive.

   A death before the release cannot be the wrap. MAX(death) took it
   anyway: source authors and pre-existing composers date a picture to
   before it existed.

   Born before anyone now living was born stays, and is now a Set of
   people rather than a count of statements, so somebody with two
   recorded birth dates is one exclusion rather than two.

   The cost is a string per credit instead of four integers per film. It
   is paid once per page and it is the only shape in which the answers
   agree with the rest of the site. */
const filmographyQuery = id => `
SELECT ?film ?filmLabel (SAMPLE(?y) AS ?year) (COUNT(DISTINCT ?c) AS ?credited)
       (GROUP_CONCAT(DISTINCT ?who; separator="|") AS ?people)
       (GROUP_CONCAT(DISTINCT ?mine; separator="|") AS ?roles) WHERE {
  VALUES ?mine { ${VALUES} }
  ?film ?mine wd:${id} .
  ?film ?any ?c .
  FILTER(?any IN (${IN_LIST}))
  OPTIONAL { ?c wdt:P569 ?bv }
  OPTIONAL { ?c wdt:P570 ?dv }
  BIND(CONCAT(STR(?c), "#",
              COALESCE(STR(YEAR(?bv)), ""), "#",
              COALESCE(SUBSTR(STR(?dv), 1, 10), "")) AS ?who)
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

  /* An open span is a claim, and it is the strongest one this page makes:
     1928– says the person is here. So it is only written when they could
     be. Bruce Gordon, born 1850, had it — the page said he was living
     because nobody had recorded that he wasn't.

     What replaces it is the birth year alone. Not a dash, which would be
     read as the open span it just stopped being, and not a guess at a
     death nobody wrote down. The year he was born is the whole of what is
     known, so it is the whole of what the page says. */
  const stillCould = !meta.dod && !beyondLiving(meta.dob);
  const span = meta.dod ? year(meta.dod) : stillCould ? '' : null;

  const life = meta.dob
    ? year(meta.dob) + (span === null ? '' : '&ndash;' + span)
    : '';
  const sub = [life, meta.occupations].filter(Boolean).join(' &middot; ');

  /* Same dates as the card, in characters a title can hold. */
  const lifeText = meta.dob
    ? ` (${year(meta.dob)}${span === null ? '' : '–' + span})`
    : '';
  setTitle((meta.label || id) + lifeText);

  const card = `
    <section class="card card-person">
      ${meta.img
        ? `<img class="card-portrait" src="${esc(thumb(meta.img, 240))}" alt=""
               data-full="${esc(meta.img)}" data-name="${esc(meta.label || '')}">`
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

  /* The credits folded to people before anything is decided about them,
     because a person with two recorded birth dates arrives as two rows
     and has to count once. Then each person is classified exactly once,
     in the order verify.js classifies them:

     Born after the picture was released — excluded outright, alive or
     dead. This is the one that matters most: alive, they veto the wrap
     forever and nothing explains why.

     Otherwise a recorded death makes them dead, whatever their age. Born
     before anyone now living was born only decides the people no record
     says anything about; with a death date on file the age test has
     nothing left to settle.

     Otherwise, past any human life — dead, and not datable.

     The wrap is the latest death that is not older than the picture. An
     earlier one belongs to a source author or a composer whose music
     predates the film: they are dead, and they are not what closed it. */
  const readPeople = f => {
    const released = Number(String(f.year || '').slice(0, 4));
    const born = new Map(), died = new Map();

    for (const record of String(f.people || '').split('|')) {
      const [who, b, d] = record.split('#');
      if (!who) continue;
      if (b && Number(b)) born.set(who, Math.min(born.get(who) ?? Infinity, Number(b)));
      if (d) died.set(who, d > (died.get(who) || '') ? d : died.get(who));
    }

    let excluded = 0;
    const dates = [];
    for (const who of new Set([...born.keys(), ...died.keys()])) {
      const b = born.get(who), d = died.get(who);
      if (b && released && b > released) { excluded++; continue; }
      if (d) { dates.push(d); continue; }
      if (b && b < earliestLivingBirthYear()) excluded++;
    }

    const datable = dates.filter(d => !released || Number(d.slice(0, 4)) >= released).sort();
    return { excluded, dead: dates.length, wrapped: datable[datable.length - 1] || '' };
  };

  for (const f of films) f.people_ = readPeople(f);

  /* Which of these did this person close?

     The wrap date is the last death, so a picture whose wrap date is
     this person's death date is one they were the last of. No extra
     request is needed to know it — the page has already computed both
     sides for its own purposes, and this is the comparison nobody had
     made.

     It is the claim the whole archive exists to make, and until now a
     reader could only find it by opening each picture in turn and
     reading the sentence there. Carla Laemmle closed eight of her nine.

     Ties are marked as such rather than resolved. Two people who died on
     the same day were jointly the last of it, and the corpus naming one
     of them as the closer is a presentation choice, not a fact about who
     outlived whom. */
  const diedOn = meta.dod ? String(meta.dod).slice(0, 10) : null;
  for (const f of films) {
    f.closedIt_ = !!diedOn && /^\d{4}-\d{2}-\d{2}$/.test(diedOn) &&
      f.people_.wrapped === diedOn;
  }

  /* Recorded deaths plus the people no record can make living again —
     and, for a picture older than any human life, everybody, since
     nobody on it can have been born after it. */
  const wikidataClosed = f =>
    Number(f.credited) > 0 &&
    (beyondLiving(null, f.year) ||
      f.people_.dead + f.people_.excluded === Number(f.credited));

  /* Below the bar means verified, and the Vault is what verification
     produces. A filmography can hold sixty closed-looking pictures, and
     the survivor test is per-film — running it here would be hundreds of
     requests on a page load to re-derive an answer the poster already
     worked out offline. So we read that answer instead.

     Both conditions, not either. The Vault says a picture was closed when
     it was filed; Wikidata is live and may since have gained a living
     name. Whichever of them still says "running" wins, because the claim
     we must not make is the one that says everybody is gone.

     The cost is honest and worth naming: the corpus only reaches where the
     pass has run, so a picture judged outside it stays above the bar until
     somebody asks about its year. That reads as "we don't know", which is
     true, rather than "someone is alive", which we would be inventing.

     Membership used to be a Set built from a megabyte of quoted ids. It is
     now a binary search over sorted 32-bit integers — one fetch for the
     page, whatever the length of the filmography — so the answers are
     resolved together before anything is drawn. */
  const c = await corpus();
  const inCorpus = new Set();
  if (c) {
    await Promise.all(films.map(async f => {
      if (await c.has(qid(f.film))) inCorpus.add(qid(f.film));
    }));
  }
  const closed = f => wikidataClosed(f) && inCorpus.has(qid(f.film));

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
      ${/* A gutter down the left of the whole filmography, holding a dot
            on every picture this person was the last of.

            Furthest left, because that is the only column a reader scans
            rather than reads — beside the date it was a footnote to the
            date, and this is not a footnote. It is the claim.

            The slot is emitted on every row, filled or empty. Without it
            the marked rows would indent and the titles would no longer
            line up, which costs more than the mark is worth.

            A dot, not a miniature of the bar. The bar is a rule across
            the whole list and means "everything below this is over"; a
            mark that repeats its shape at the size of a tick reads as a
            small bar rather than as a different statement. */''}
      <span class="closed-slot">${wrapped && f.closedIt_
        ? `<span class="closed-dot" role="img"
                 aria-label="Last of this picture's makers"
                 title="Last of this picture's makers"></span>`
        : ''}</span>
      <span class="who">
        <span class="who-name">${esc(f.filmLabel || qid)}</span>
        ${roles.length ? `<span class="who-role">${esc(roles.join(' &middot; ').replace(/&middot;/g, '·'))}</span>` : ''}
      </span>
      <span class="when">${wrapped && f.people_?.wrapped
        ? esc(longDate(f.people_.wrapped)) : esc(f.year || '')}</span>
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

/* The Vault is served in pieces, and the page fetches only the piece its
   question needs.

   It used to pull archive.json whole — 1.5 MB on the landing page, on the
   Vault, and after this evening on every person page too — and the
   1946-65 backfill was on course to take that past 3.7 MB. Three shapes
   now, written by the poster whenever it writes the archive:

     summary.json   1 KB. Totals, decade counts, country counts and the
                    five most recent closings. Enough for the landing page
                    and for a Vault whose drawers are all shut.
     ids.json       40 KB of Q-ids and nothing else, which is the whole of
                    what a person page asks: is this film in the Vault.
     <decade>.json  the entries, fetched when that drawer is opened.

   Nothing here loads a decade the reader hasn't asked for. */
let summaryCache = null;
let suppressedCache = null;

async function loadJSON(path, fallback) {
  try {
    const res = await fetch(path, { cache: 'no-cache' });
    if (!res.ok) throw new Error(String(res.status));
    return await res.json();
  } catch {
    return fallback;
  }
}

/* People who asked not to be named here.

   A living person can want no part of this, and the answer has to be
   something better than "it is all public anyway". But removing them
   outright would change what the archive claims: a living maker is what
   holds a picture open, so deleting one silently closes a picture that
   has not closed. That is a false claim about a film and an erasure of
   their work in the same move.

   So suppression takes the NAME and never the vote. The person stays in
   the reckoning exactly as before — the bar sits where it sat, the
   picture stays open — and the row says only that somebody is there.

   A list of Q-ids, empty today, published so that honouring a request is
   a one-line commit rather than a migration. */
async function loadSuppressed() {
  suppressedCache ??= new Set(await loadJSON('vault/suppressed.json', []));
  return suppressedCache;
}

/* The corpus, which replaced the Vault.

   Three files used to be fetched from `vault/` — a summary, every closed
   id as quoted JSON, and a decade at a time. At 97,395 closings the
   second is a megabyte of quoted strings on every person page and the
   third is six megabytes for the 2010s. Neither survives the scale.

   `corpus.js` is the client for what `build-corpus.js` writes: one
   manifest, then immutable versioned files addressed by a key the page
   already holds. Membership arrives as sorted 32-bit integers and is
   answered by binary search; a drawer asks for one year rather than a
   decade.

   CORPUS_BASE is the one thing deployment changes, and the manifest
   indirection is why it can be one line: everything else is addressed
   relative to whatever this points at.

   It pointed at `corpus/` — a gitignored directory that exists only on
   the machine that built it — from the day the site was wired to the
   corpus until 2 August. The live site was serving 404s and drawing an
   empty Vault the whole time, which nothing reported because a corpus
   that will not open is caught and degrades quietly. If this is ever
   moved back to a relative path, check that the path is committed.

   Cloudflare Pages rather than R2. The corpus is 803 immutable static
   files; Pages bulk-uploads them, deploys atomically — so there is no
   half-finished state for the "manifest last" ordering to hide — and
   reads the `_headers` build-corpus.js writes, which is where the CORS
   header and the two cache policies now live. */
const CORPUS_BASE = 'https://picture-wrap-corpus.pages.dev/';

let corpusPromise = null;
function corpus() {
  corpusPromise ??= openCorpus(CORPUS_BASE).catch(err => {
    /* A corpus that will not open must not look like an empty one: an
       empty archive is a claim, and a failed fetch is not. */
    console.error('corpus unavailable:', err);
    return null;
  });
  return corpusPromise;
}

async function loadSummary() {
  const c = await corpus();
  summaryCache ??= c
    ? { ...c.summary, total: c.summary.closed }
    : { total: 0, decades: [], countries: [], recent: [], closingDecades: {} };
  return summaryCache;
}

/* Which pictures the Vault shows. Two facets, the same two the landing's
   doors offer, because a reader who arrives from one of those doors
   arrives having already asked the question.

   Breadth is the best thing about this archive and also the problem: a
   column of Italian titles is unreadable noise unless you came for it,
   and 97,395 closings is every column at once. */
const vaultFilter = { region: 'all', genre: 'all', sources: 'all' };

/* The unclassified keeps its own, because the two archives have
   different label sets and carrying a Vault genre across would land on
   a chip that does not exist here. */
const uFilter = { region: 'all', genre: 'all' };

/* The Vault, addressable. `#/archive/American/comedy film`, either side a
   bare `-`, so the landing can hand over what it was showing and a reader
   can send somebody the result.

   Encoded per segment rather than as one string: `British Raj` has a
   space in it and `20th-century` has a hyphen, so the separator has to be
   the one character a label cannot contain. */
const vaultPath = ({ region, genre }) =>
  `#/archive/${encodeURIComponent(region || '-')}/${encodeURIComponent(genre || '-')}`;

const readVaultPath = segments => {
  const at = segments.indexOf('archive');
  const read = i => {
    const raw = segments[at + i];
    if (!raw || raw === '-') return 'all';
    try { return decodeURIComponent(raw); } catch { return 'all'; }
  };
  return { region: read(1), genre: read(2) };
};

async function viewArchive(segments = []) {
  const summary = await loadSummary();

  /* The URL is the authority on arrival; after that the chips are, and
     they re-render without routing. */
  Object.assign(vaultFilter, readVaultPath(segments));

  if (!summary.total) {
    setTitle('The Vault');
    show(`
      <section class="card"><h2>The Vault</h2></section>
      <p class="state">Nothing here yet. It fills as pictures close &mdash;
      or all at once, if you run the backfill.</p>`);
    return;
  }

  renderArchive(summary);
}

/* Grouped by the decade a picture closed in, newest first. The sections are
   the navigation — no filter tells you anything scrolling doesn't.

   A shut drawer costs nothing now. The counts come from the summary, so
   the page can show the whole shape of the Vault — every decade, how many
   in each — while having fetched about a kilobyte. Opening one asks for
   that decade and nothing else.

   Which also means the first decade is no longer open on arrival. It used
   to be, because the data was already in memory and there was nothing to
   save by hiding it. Now opening it is a request, and making that request
   on behalf of somebody who came to look at the 1970s is the thing this
   change exists to stop. */
function renderArchive(summary) {
  setTitle(`The Vault — ${summary.total.toLocaleString('en')} pictures`);

  /* The same ten genres and ten regions the landing's doors offer, drawn
     from the same precomputed table, for two reasons that are really one.
     A reader arriving from a door must find the chip that door set
     already lit, or the Vault will look like it ignored them. And the
     table knows every crossing, so a chip can carry the count it would
     actually produce rather than its count over the whole archive.

     The order never moves — it is by size over the whole corpus — so the
     row stays a place even as its numbers change under a filter. Chips
     leading nowhere go quiet, exactly as the doors do. */
  /* The Vault's own tiles, not the landing's doors. A door is a curated
     way in and carries film picks; a tile is a filter and carries a
     count, which is why they are separate and why this row can afford to
     be complete. */
  const doors = summary.vaultDoors ?? {};
  const combinations = doors.picks ?? {};
  const countFor = (region, genre) => combinations[
    `${genre === 'all' ? '' : genre}||${region === 'all' ? '' : region}`] ?? 0;

  const chipRow = kind => {
    const entries = doors[kind] ?? [];
    if (!entries.length) return '';
    const countWith = label => kind === 'region'
      ? countFor(label, vaultFilter.genre)
      : countFor(vaultFilter.region, label);

    const chip = (value, label, n) => `
      <button data-vault="${esc(kind)}" data-label="${esc(value)}"${
        vaultFilter[kind] === value ? ' aria-current="true"' : ''}${
        n ? '' : ' disabled'}>
        ${esc(label)}<span>${n.toLocaleString('en')}</span>
      </button>`;

    /* "Romantic comedy film" and "romantic comedy" are two Wikidata
       labels, and trimming the suffix off both drew the same tile twice —
       865 beside 265, with nothing to tell a reader which was which. So
       the suffix comes off only where doing it leaves the label unique.
       This did not show at 22 tiles and does at 30, which is the usual
       shape of a display rule that was really a coincidence. */
    const trimmed = new Map();
    for (const d of entries) {
      const short = d.label.replace(/ films?$/i, '');
      trimmed.set(short, (trimmed.get(short) || 0) + 1);
    }
    const shown = label => {
      const short = label.replace(/ films?$/i, '');
      return sentence(trimmed.get(short) > 1 ? label : short);
    };

    return `<div class="vault-filters">
      ${chip('all', 'All', countWith('all') || summary.total)}
      ${entries.map(d => chip(d.label,
        kind === 'genre' ? shown(d.label) : d.label,
        countWith(d.label))).join('')}
    </div>`;
  };

  /* Stated as what was done, not as what was missing. "Checked against
     both" is the same fact as "Wikidata alone" and reads as a standard met
     rather than a shortfall confessed — which is the difference between a
     reader understanding it and a reader thinking well of us for admitting
     it. No count on the chip: an honest one would need every year file in
     the archive, which is the download the drawers exist to avoid. */
  const sourceRow = `<div class="vault-filters vault-sources">
    <button data-vault="sources" data-label="all"${
      vaultFilter.sources === 'all' ? ' aria-current="true"' : ''}>All</button>
    <button data-vault="sources" data-label="both"${
      vaultFilter.sources === 'both' ? ' aria-current="true"' : ''}
      title="Everyone credited was checked against Wikidata and TMDB, not Wikidata alone">Confirmed</button>
  </div>`;

  const filters = chipRow('region') + findRow('region', summary.allCountries, vaultFilter, 'vault')
    + chipRow('genre') + findRow('genre', summary.allGenres, vaultFilter, 'vault')
    + sourceRow;

  /* Closing decades, newest first — the axis the Vault has always
     browsed. `decades` in the corpus summary is by RELEASE year and is a
     different question. */
  /* The drawer counts are over the whole corpus, and there is no honest
     way to filter them: a decade's count would need every year file it
     holds, which is the download this drawer exists to avoid. So while a
     facet is on they are not shown at all. A number that says 12,142
     above a drawer holding four French silents is worse than no number —
     it is the wrong answer to the question the reader is asking. */
  /* Region and genre still blank the counts, because an honest one would
     need every year file in the archive. Sources does not: it is a flag
     rather than a crossing, so the count is precomputed and the filter
     changes the number instead of removing it. A filter that blanks every
     number it touches makes the archive look like it lost count. */
  const counted = vaultFilter.region === 'all' && vaultFilter.genre === 'all';
  const confirmedOnly = vaultFilter.sources === 'both';

  const sections = Object.entries(summary.closingDecades ?? {})
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([decade, d]) => [`${decade}s`, confirmedOnly ? (d.confirmed ?? d.total) : d.total])
    .map(([label, n]) => `
    <details class="decade" data-decade="${esc(label)}">
      <summary>
        <span class="decade-label">${esc(label)}</span>
        ${counted ? `<span class="decade-count">${n}</span>` : ''}
      </summary>
      <div class="decade-body"><p class="state">Opening&hellip;</p></div>
    </details>`).join('');

  show(`
    <section class="card">
      <h2>The Vault</h2>
      <p class="card-quote">&mdash; it&rsquo;s full of stars</p>
    </section>
    ${filters}
    ${sections}
    ${/* The other archive. Placed at the foot rather than beside the
          title because it is not a peer of the Vault — it is what the
          Vault could not answer for, and a reader should meet it after
          the thing it qualifies. */''}
  `);
}

/* Anything the tiles left out.

   A tile is earned by holding one picture in five hundred, which leaves
   451 genres and 228 countries below the line — Faroese, Manx, the
   long tail of co-productions and sub-genres. They are in the archive and
   a reader should be able to ask for them, but 679 tiles is not a filter
   row, it is a wall.

   So: a native `datalist`, which gives type-ahead with no script and no
   dropdown of our own to get wrong. It shows only when the label is not
   already a tile, and it shows the count, because a reader typing
   "Faroese" should learn there are three before they commit to it. */
function findRow(kind, labels, state, ns) {
  if (!labels?.length) return '';
  const id = `find-${ns}-${kind}`;
  const current = state[kind] === 'all' ? '' : state[kind];
  return `
    <div class="chip-find">
      <input list="${id}" data-find="${esc(kind)}" data-ns="${esc(ns)}"
             value="${esc(current)}"
             placeholder="${kind === 'region' ? 'another country' : 'another genre'}\u2026"
             aria-label="${kind === 'region' ? 'Find a country' : 'Find a genre'}">
      <datalist id="${id}">
        ${labels.map(l => `<option value="${esc(l.label)}">${esc(l.label)} — ${l.count}</option>`).join('')}
      </datalist>
    </div>`;
}

/* --- the unclassified ---------------------------------------------------- */

/* Pictures the archive cannot place.

   Not closed and not running: no death is recorded for anyone credited on
   them, and they are not old enough for arithmetic to settle it. The
   Vault used to hold them, on the strength of a rule that says unrecorded
   people never veto — which is right when a picture has thirty recorded
   deaths and two blanks, and produces a claim out of nothing when every
   single person is a blank.

   Browsed by RELEASE year, newest first. Every other surface on this site
   is ordered by a closing and these have none, so borrowing that axis
   would have meant inventing a date. The right-hand column is the release
   year, and there is nothing on the page that could be mistaken for a
   wrap.

   It is deliberately not ranked, not scored and not sorted by how close
   anything is to closing. Those would all be the same claim wearing a
   different hat. */
async function viewUnclassified(segments = []) {
  const c = await corpus();
  const summary = await loadSummary();
  const total = c?.counts?.unclassified ?? 0;

  setTitle(`Unclassified — ${total.toLocaleString('en')} pictures`);

  if (!total) {
    show(`<section class="card"><h2>Unclassified</h2></section>
      <p class="state">Nothing here.</p>`);
    return;
  }

  /* Its own labels, not the Vault's. Documentary is 64% of everything
     here that carries a genre and Australian is the second region, both
     of which are false of the Vault — a shared row would have been tiles
     nobody could use. */
  const doors = summary.unclassifiedDoors ?? {};
  const picks = doors.picks ?? {};
  const countFor = (region, genre) => picks[
    `${genre === 'all' ? '' : genre}||${region === 'all' ? '' : region}`] ?? 0;

  const chipRow = kind => {
    const entries = doors[kind] ?? [];
    if (!entries.length) return '';
    const countWith = label => kind === 'region'
      ? countFor(label, uFilter.genre)
      : countFor(uFilter.region, label);

    const chip = (value, label, n) => `
      <button data-unc="${esc(kind)}" data-label="${esc(value)}"${
        uFilter[kind] === value ? ' aria-current="true"' : ''}${
        n ? '' : ' disabled'}>
        ${esc(label)}<span>${n.toLocaleString('en')}</span>
      </button>`;

    /* Same rule as the Vault: trim the suffix only where it stays
       unique, so two labels never draw one tile. */
    const trimmed = new Map();
    for (const d of entries) {
      const short = d.label.replace(/ films?$/i, '');
      trimmed.set(short, (trimmed.get(short) || 0) + 1);
    }
    const shown = label => {
      const short = label.replace(/ films?$/i, '');
      return sentence(trimmed.get(short) > 1 ? label : short);
    };

    return `<div class="vault-filters">
      ${chip('all', 'All', countWith('all') || total)}
      ${entries.map(d => chip(d.label,
        kind === 'genre' ? shown(d.label) : d.label,
        countWith(d.label))).join('')}
    </div>`;
  };

  const filters = chipRow('region') + findRow('region', doors.allCountries, uFilter, 'unc')
    + chipRow('genre') + findRow('genre', doors.allGenres, uFilter, 'unc');
  const decades = summary.unclassifiedDecades ?? {};
  /* Same rule as the Vault: a drawer count that ignores the facet is the
     wrong answer to the question being asked, and an honest one would
     need every year file. */
  const counted = uFilter.region === 'all' && uFilter.genre === 'all';

  const sections = Object.entries(decades)
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .map(([decade, n]) => `
      <details class="decade" data-udecade="${esc(decade)}s">
        <summary>
          <span class="decade-label">${esc(decade)}s</span>
          ${counted ? `<span class="decade-count">${n.toLocaleString('en')}</span>` : ''}
        </summary>
        <div class="decade-body"><p class="state">Opening&hellip;</p></div>
      </details>`).join('');

  show(`
    <section class="card">
      <h2>Unclassified</h2>
      <p class="card-quote">&mdash; no death on record for anyone credited,
        so neither wrapped nor running</p>
    </section>
    ${filters}
    ${sections}
  `);
  if (segments.includes('open')) document.querySelector('.decade')?.setAttribute('open', '');
}

/* Years inside an unclassified decade, from counts the summary holds, so
   opening a drawer costs no request. */
function fillUnclassifiedDecade(details) {
  const key = details.dataset.udecade;
  const body = details.querySelector('.decade-body');
  const stamp = `${key}|${uFilter.region}|${uFilter.genre}`;
  if (!body || body.dataset.filled === stamp) return;

  const decade = Number(key.replace(/s$/, ''));
  const years = Object.entries(summaryCache?.unclassifiedYears ?? {})
    .filter(([y]) => Math.floor(Number(y) / 10) * 10 === decade)
    .sort((a, b) => Number(b[0]) - Number(a[0]));

  if (!years.length) {
    body.innerHTML = `<p class="state">Nothing from the ${esc(key)} here.</p>`;
    return;
  }

  body.dataset.filled = stamp;
  const counted = uFilter.region === 'all' && uFilter.genre === 'all';
  body.innerHTML = years.map(([y, n]) => `
    <details class="yr" data-uyear="${esc(y)}">
      <summary>
        <span class="yr-label">${esc(y)}</span>
        ${counted ? `<span class="yr-count">${n.toLocaleString('en')}</span>` : ''}
      </summary>
      <div class="yr-body"><p class="state">Opening&hellip;</p></div>
    </details>`).join('');
}

/* One release year of unclassified pictures.

   The row says what is missing rather than what is known, because what is
   missing IS the content: how many names are on record, and that none of
   them carries a date. */
async function fillUnclassifiedYear(details) {
  const y = details.dataset.uyear;
  const body = details.querySelector('.yr-body');
  if (!body) return;

  const c = await corpus();
  if (!c?.unclassified) {
    body.innerHTML = `<p class="state">The archive didn&rsquo;t answer.</p>`;
    return;
  }

  const all = await c.unclassified(y);
  const films = all.filter(f =>
    (uFilter.region === 'all' || (f.countries || []).includes(uFilter.region)) &&
    (uFilter.genre === 'all' || (f.genres || []).includes(uFilter.genre)));
  if (!films.length) {
    body.innerHTML = `<p class="state">Nothing from ${esc(y)} here.</p>`;
    return;
  }

  body.innerHTML = `<ul class="closing-films unclassified-list">${films.map(f => `
    <li class="is-link" data-go="${esc(path(f.title, f.id))}">
      <span class="closing-film">
        <span class="who-name">${esc(f.title)}</span>
        ${f.type ? `<span class="closing-kind">${esc(sentence(
          [(f.countries || [])[0], f.type].filter(Boolean).join(' ')))}</span>` : ''}
        ${/* Only what varies. The first draft of this row read "one name on
              record, undated · one source" on every line, which is three
              facts the page has already stated once at the top and which
              are true of all 23,161 — a badge repeated that often stops
              being information and becomes texture. What differs between
              these pictures is how many names are on record, so that is
              what the row says and nothing else. */''}
        <span class="closing-missing">${
          f.makers === 1 ? '1 name' : `${f.makers} names`}</span>
      </span>
      <span class="when-span">${esc(f.year || '')}</span>
    </li>`).join('')}</ul>`;
}

/* Fill a drawer the first time it is opened.

   It used to fetch the decade and group it into years in memory. At this
   scale a decade is six megabytes and a year is six hundred kilobytes, so
   the drawer now renders its years from counts the summary already holds
   — no request at all — and a year fetches itself when opened.

   Which means the shape of the whole archive is visible for the price of
   the summary, and nothing is downloaded on behalf of somebody who came
   to look at one year of it. */
function fillDecade(details) {
  const key = details.dataset.decade;
  const body = details.querySelector('.decade-body');
  /* Stamped with the filter as well as the decade, because whether the
     year rows carry counts depends on it — cached on the decade alone,
     an open drawer kept the counts it was drawn with. */
  const stamp = `${key}|${vaultFilter.region}|${vaultFilter.genre}|${vaultFilter.sources}`;
  if (!body || body.dataset.filled === stamp) return;

  const decade = summaryCache?.closingDecades?.[String(Number(key.replace(/s$/, '')))];
  const confirmedOnly = vaultFilter.sources === 'both';
  const counts = (confirmedOnly ? decade?.confirmedYears : decade?.years) ?? decade?.years ?? {};
  const years = Object.entries(counts).sort((a, b) => b[0].localeCompare(a[0]));

  if (!years.length) {
    body.innerHTML = `<p class="state">Nothing from the ${esc(key)} here.</p>`;
    return;
  }

  body.dataset.filled = stamp;
  const counted = vaultFilter.region === 'all' && vaultFilter.genre === 'all';
  body.innerHTML = years.map(([y, n]) => `
    <details class="yr" data-year="${esc(y)}">
      <summary>
        <span class="yr-label">${esc(y)}</span>
        ${counted ? `<span class="yr-count">${n}</span>` : ''}
      </summary>
      <div class="yr-body"><p class="state">Opening&hellip;</p></div>
    </details>`).join('');
}

/* One year of closings, newest first, grouped by the death that caused
   them. Re-rendered rather than re-fetched when the country filter moves. */
async function fillYear(details) {
  const y = details.dataset.year;
  const body = details.querySelector('.yr-body');
  if (!body) return;

  const c = await corpus();
  if (!c) {
    body.innerHTML = `<p class="state">The archive didn&rsquo;t answer. Try again in a moment.</p>`;
    return;
  }

  const films = await c.closed(y);
  const shown = films.filter(f =>
    (vaultFilter.region === 'all' || (f.countries || []).includes(vaultFilter.region)) &&
    (vaultFilter.genre === 'all' || (f.genres || []).includes(vaultFilter.genre)) &&
    (vaultFilter.sources === 'all' || !f.unverified));

  if (!shown.length) {
    body.innerHTML = `<p class="state">Nothing from ${esc(y)} here.</p>`;
    return;
  }

  body.innerHTML = `
    <ul class="roster archive">
      ${groupByClosing(shown).map(archiveRow).join('')}
    </ul>`;
}

/* `toggle` doesn't bubble, so it has to be caught on the way down. */
/* A typed label behaves exactly as a tile does, including clearing on an
   empty value — so the input is a way to reach the untiled rather than a
   second kind of filter with its own rules. An unknown label is left
   alone: the datalist offered what exists, and inventing a facet for
   something the archive does not hold would show an empty list with no
   explanation. */
document.addEventListener('change', e => {
  const find = e.target.closest('[data-find]');
  if (!find) return;
  const { find: kind, ns } = find.dataset;
  const state = ns === 'unc' ? uFilter : vaultFilter;
  const wanted = find.value.trim();
  const known = ns === 'unc'
    ? (summaryCache?.unclassifiedDoors?.[kind === 'region' ? 'allCountries' : 'allGenres'] ?? [])
    : (summaryCache?.[kind === 'region' ? 'allCountries' : 'allGenres'] ?? []);
  if (wanted && !known.some(l => l.label === wanted)) return;
  state[kind] = wanted || 'all';

  if (ns === 'unc') {
    viewUnclassified().then(() => {
      for (const d of document.querySelectorAll('details.decade[open]')) fillUnclassifiedDecade(d);
    });
  } else {
    loadSummary().then(summary => {
      renderArchive(summary);
      for (const d of document.querySelectorAll('details.decade[open]')) fillDecade(d);
    });
  }
});

document.addEventListener('toggle', e => {
  const details = e.target;
  if (!details.open) return;
  /* Same elements, different axis. The dataset key decides which archive
     a drawer belongs to, so one handler serves both without either
     needing to know the other exists. */
  if (details.dataset.udecade) fillUnclassifiedDecade(details);
  else if (details.matches?.('details.decade')) fillDecade(details);
  if (details.dataset.uyear) fillUnclassifiedYear(details);
  else if (details.matches?.('details.yr')) fillYear(details);
}, true);

/* One death can take several pictures over the line at once — Mary
   Carlisle's closed four. Those belong together: the event is the person,
   and the films are what it happened to. */
function groupByClosing(films) {
  /* Not a string key, because the identifier is not always there. Léonce
     Corne closed two pictures on 31 December 1977 and the archive holds a
     Wikidata id for one of them and not the other — older records lost it
     — so keying on `id || name` made him two people on the same day.

     Same name, same date, and no CONTRADICTING pair of ids: an id is used
     to tell two people apart, never to tell one person apart from
     himself. */
  const same = (a, b) =>
    a.name === b.name
    && (a.died || '').slice(0, 10) === (b.died || '').slice(0, 10)
    && !(a.id && b.id && a.id !== b.id);

  const groups = [];
  for (const f of films) {
    const open = groups[groups.length - 1];
    if (open && same(open.last, f.last)) {
      open.films.push(f);
      /* Keep whichever record knows the id, so the group can link. */
      if (!open.last.id && f.last.id) open.last = f.last;
    } else {
      groups.push({ last: f.last, films: [f] });
    }
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

        <span class="closing-date">${esc(longDate(last.died))}${
          /* Both databases record this death and they disagree. The date
             shown is the one the archive computed from; the mark says a
             second source says otherwise, and what it says. Publishing
             the disagreement is the same instinct as publishing an
             undated closing rather than inventing a day for it. */
          films.find(f => f.disputed)
            ? `<span class="closing-disputed" title="Sources disagree: ${
                esc(films.find(f => f.disputed).disputed.wikidata || 'unknown')
              } on Wikidata">disputed</span>`
            : ''}</span>
      </p>
      <ul class="closing-films">
        ${films.map(f => `
          <li class="is-link" data-go="${esc(path(f.title, f.id))}">
            <span class="closing-film">
              <span class="who-name">${esc(f.title)}</span>
              ${/* Whether a second database was asked used to be a
                   "Wikidata alone" badge here, on two rows in five. At
                   that frequency it is not an exception, it is a column —
                   and two words could not carry what it meant. It was read
                   as "the Wikidata signal was strong enough that we did
                   not need to check elsewhere", which is the exact
                   opposite: there was no TMDB record to check against.

                   So it is stated once above the list, offered as a filter
                   so a reader can act on it rather than be reminded of it
                   forty thousand times, and written out in full on the
                   picture's own page where there is room for a sentence
                   that cannot be misread. */''}
              ${[
                f.type ? `<span class="closing-kind">${esc(sentence(
                  [(f.countries || [])[0], f.type].filter(Boolean).join(' ')))}</span>` : '',
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
  setTitle('Methods and sources');
  show(`
    <section class="card">
      <h2>Methods and sources</h2>
    </section>

    <div class="prose">
      <h3>1. What this site states</h3>
      <p>
        For each picture, whether every person recorded as having worked on
        it has died, and if so, the date of the last recorded death. Nothing
        here is a claim about anyone&rsquo;s health, whereabouts or private
        life. Every date is copied from a public database and none is
        inferred from anything else.
      </p>

      <h3>2. How a person is classified</h3>
      <p>
        Each credited person is <strong>dead</strong>, <strong>living</strong>
        or <strong>unrecorded</strong>. The three are not interchangeable and
        an unrecorded person is never counted as dead.
      </p>
      <ul>
        <li><strong>Dead</strong> &mdash; a death date in Wikidata or TMDB,
          or a death asserted without a date; or an age past 122 years, the
          longest documented human lifespan.</li>
        <li><strong>Living</strong> &mdash; a usable birth date, no death
          recorded anywhere, and an age under 112. A birth date is usable if
          it is precise to the day, or if both databases give one and agree
          on the year.</li>
        <li><strong>Unrecorded</strong> &mdash; anything else, including an
          age between 112 and 122, and any case where a lookup failed.</li>
      </ul>
      <p>
        Two further rules are arithmetic rather than judgement. Nobody can
        have worked on a picture released before they were born, so such
        credits are set aside. And a picture cannot have closed before it was
        released, so a death earlier than the release date cannot date it &mdash;
        which is why source authors and composers of pre-existing music,
        both of whom are credited, never appear as the last of a
        picture&rsquo;s makers.
      </p>
      <p>
        Anyone born before ${earliestLivingBirthYear()} is therefore counted
        as dead whether or not a death was recorded, as is anyone credited on
        a picture older than that. This can close a picture. It cannot date
        one: a date is only ever a death recorded to the day.
      </p>

      <h3>3. How the page is drawn</h3>
      <p>
        A picture&rsquo;s page lists everyone credited, divided by a gold
        bar: living above, dead below. The bar rises as the living section
        shrinks. When it reaches the top, nobody recorded as having worked on
        the picture is still living.
      </p>
      <p>
        People whose dates cannot be established appear below the credits
        with a dash. They are neither counted as living nor as dead.
      </p>

      <h3>4. How a picture enters the Vault</h3>
      <p>
        Two conditions, and both must hold.
      </p>
      <ol>
        <li><strong>Every person on record has a death on record.</strong>
          Not a majority and not a threshold &mdash; one living person keeps
          a picture out, and a person whose dates are unknown is never
          counted as dead. A person credited on a picture released before
          they were born is set aside, since they cannot have worked on it.</li>
        <li><strong>Both databases were asked, wherever both could be
          asked.</strong> Wikidata&rsquo;s cast lists are routinely a
          fraction of the real cast, so a picture is not closed on
          Wikidata&rsquo;s word while TMDB has a record to check. Where TMDB
          has no record of the picture at all there is nothing to ask, and
          the closing rests on one source and is marked as doing so.</li>
      </ol>
      <p>
        A picture that meets both leaves the Vault again the moment either
        stops being true.
      </p>
      <p>
        A picture that meets neither &mdash; nobody on it recorded as
        living, nobody recorded as dead &mdash; is neither wrapped nor
        running. It is <a href="#/unclassified">unclassified</a>, and this
        archive says so rather than guessing. Absence of a record is not
        evidence of a death.
      </p>

      <h3>5. Sources</h3>
      <p>
        Credits and dates come from
        <a href="https://www.wikidata.org" rel="noopener">Wikidata</a>,
        which is published under CC0<span id="about-tmdb" hidden>, checked
        against <a href="https://www.themoviedb.org" rel="noopener">TMDB</a>,
        whose cast lists are frequently fuller. About one closing date in
        thirteen rests on a death only TMDB records; the rest are
        Wikidata&rsquo;s, most of them corroborated by both</span>. Portraits come from
        <a href="https://commons.wikimedia.org" rel="noopener">Wikimedia
        Commons</a> under the licence of each file. All are edited by
        volunteers and none is complete.
      </p>
      <p id="about-tmdb-2" hidden>
        This website uses TMDB and the TMDB APIs but is not endorsed,
        certified, or otherwise approved by TMDB.
      </p>

      <h3>6. Scope</h3>
      <p>
        A maker is anyone credited in cast, direction, writing,
        cinematography, music, editing, production or costume design.
        Below-the-line crew &mdash; grips, gaffers, second unit, sound
        &mdash; is not held in any free database and is therefore absent
        here. <strong>&ldquo;Everyone&rdquo; means everyone recorded</strong>,
        which is a smaller set than everyone who worked on a picture.
      </p>

      <h3>7. Known limits</h3>
      <ul>
        <li>A picture may be shown as closed while somebody who was never
          recorded is living.</li>
        <li><strong>The median closing rests on two recorded names, and
          41% of them rest on exactly one.</strong> A picture whose credit
          list holds one name closes when that person dies, while the
          dozens who actually made it were never in any free database.
          This is the largest limit on this page and the count of names is
          stated on every picture.</li>
        <li>Nineteen closings in twenty are dated to the day. The
          remainder carry a month, a year, or no usable date at all.</li>
        <li>Coverage varies by picture and is stated per entry. Where it
          can be measured, the median closing holds a third of the names
          TMDB does, and two in three rest on under half of TMDB&rsquo;s
          credit list.</li>
        <li>The corpus is what Wikidata holds, which is overwhelmingly
          American and European. Of pictures released between 1930 and 1945,
          it holds 9,520 American against 284 Japanese, from an industry then
          making around five hundred a year.</li>
        <li>Country is recorded as the state that existed at the time, so a
          search under a modern name misses everything before it. Of the same
          period we hold 901 South Asian pictures &mdash; 869 filed under
          British Raj and 32 under India. This site said &ldquo;37 Indian
          titles&rdquo; for months, having asked the wrong question.</li>
        <li>Two closings in five were never checked against a second
          database, because TMDB has no record of the picture and there is
          nothing to ask. They are the archive&rsquo;s weakest claims, each
          says so on its own page, and the Vault can filter them out. They
          are kept rather than withheld: the pictures without a TMDB record
          are overwhelmingly the obscure and the non-English, which is most
          of what closes.</li>
        <li>A death date may simply be wrong, or entered in error.</li>
      </ul>

      <h3>8. The Vault</h3>
      <p>
        Closed pictures, most recent first. It is the only part of this site
        not computed live: the result is worked out in advance and stored, so
        it can lag. If a living person is added to a picture in the Vault,
        that picture&rsquo;s own page will show it as open while the Vault
        still lists it as closed, until the next check.
      </p>
      <p>
        <strong>Confirmed</strong> closings were checked against both
        Wikidata and TMDB. The rest were checked against Wikidata alone,
        because TMDB has no record of the picture. Three in five are
        confirmed, and each picture says which it is.
      </p>
      <p>
        The country and genre tiles are not a selection. A label earns a
        tile by holding one picture in five hundred of the archive it
        belongs to, and every other label &mdash; 451 genres and 228
        countries in all &mdash; can be typed into the field beneath each
        row.
      </p>

      <h3>9. Corrections</h3>
      <p>
        Errors here are almost always errors upstream. Every picture and
        person links to its Wikidata item, which is where a correction should
        be made: it is fixed at the source and everyone benefits, and this
        site follows on its next pass.
      </p>


      <h3>10. Privacy</h3>
      <p>
        This site sets no cookies, runs no analytics and keeps no logs. It is
        static files served from a CDN and nothing about readers is collected.
      </p>
      <p>
        It does hold names and birth dates of living people, all of them
        already published by the sources above. Living people appear only as
        credits on a picture, never as a list, and are never ranked or
        ordered by age. A person who does not wish to be named here can say
        so &mdash; their name is withheld from the page while their credit
        continues to count, so no picture is wrongly reported as closed.
        Requests go to the address in the footer.
      </p>

      <h3>11. Citation</h3>
      <p>
        Cite the picture&rsquo;s Wikidata identifier and the date consulted,
        since the underlying databases change:
      </p>
      <p class="cite">
        Picture Wrap, &ldquo;The Sawdust Trail&rdquo; (Q18153746), wrapped
        5 October 1974. Consulted 1 August 2026. Derived from Wikidata and
        TMDB.
      </p>
      <p>
        <strong>No licence has been set for this archive yet.</strong>
        Wikidata is CC0 and TMDB&rsquo;s terms are their own; what this
        project adds on top of them has no stated terms, and until it does,
        assume nothing about reuse beyond quotation.
      </p>
    </div>`);
  revealTmdb();
}



/* --- landing ----------------------------------------------------------- */

/* The masthead tagline carries the idea; nothing else needs saying here.
   Once the poster has written an archive, the way in becomes the most
   recent closings — so the page keeps itself current. PICKS is only the
   fallback for an empty archive. */
/* Which way in the reader is looking. Sticky for the session, because
   somebody who chose "best known" once is telling you something.

   Two states, and they compose. `landingSort` says how to order;
   `landingDoors` says what to order. Neither clears the other, because
   they answer different questions — "the longest wait among French
   silents" needs both, and it is a better question than either half.

   A door toggles off when pressed again; a sort does not, because one of
   the three is always in force and turning the current one off would
   leave the page with no order at all. */
let landingSort = 'recent';
const landingDoors = { genre: null, region: null };

async function viewLanding() {
  /* The front door carries no qualifier — the site's own name is what's up. */
  setTitle('');
  const summary = await loadSummary();

  /* Three ways in, and the second exists because the first is honest but
     unwelcoming: closings are obscure by the arithmetic of the thing —
     the famous pictures close last — so "recently wrapped" shows five
     titles a first-time reader has never heard of. Sorting by how widely
     a picture is known is the only sort that guarantees recognition. */
  const lists = {
    recent: { label: 'Recently wrapped', films: summary.recent ?? [] },
    known: { label: 'Best known', films: (summary.bestKnown ?? []).slice(0, 5) },
    wait: { label: 'Longest wait', films: (summary.longestWait ?? []).slice(0, 5) },
  };

  /* And the doors, which are a different kind of thing and belong on the
     front page anyway.

     A sort is a way of ordering everything. A door is a way of naming the
     part of it you already care about, and readers arrive holding one:
     nobody likes "cinema", they like Danish documentaries, or Soviet war
     pictures, or Westerns.

     They stack, because that is how those phrases are built. "Danish
     documentaries" is two words, and a picker that made you choose one of
     them would be asking you to hold the other in your head while you
     scrolled. Every combination that has anything in it is precomputed,
     each ranked all three ways, out of the same one summary.json the page
     already fetches. */
  const doors = summary.doors ?? {};
  const combinations = doors.picks ?? {};
  const facetKey = (genre, region) => `${genre ?? ''}||${region ?? ''}`;

  const open = landingDoors.genre || landingDoors.region
    ? combinations[facetKey(landingDoors.genre, landingDoors.region)]
    : null;

  const sorts = ['recent', 'known', 'wait'].filter(k => lists[k].films.length);
  const chosen = lists[landingSort]?.films.length ? landingSort : sorts[0];

  /* The sort and the door are separate questions and the page now lets
     them be asked together: the door says which pictures, the sort says
     which five of them. Every crossing is ranked all three ways, so
     "the longest wait among French silents" is a lookup.

     Falling back to best-known where an ordering is empty — "longest
     wait" drops anything without both a release and a wrap year, and a
     small crossing can have none — because five titles under the wrong
     heading is a smaller wrong than none under the right one. */
  const table = doors.films ?? [];
  const fromTable = i => {
    const [id, title, year, wrapped] = table[i] ?? [];
    return { id, title, year, wrapped: /-/.test(wrapped || '') ? wrapped : '', wrappedYear: wrapped };
  };

  const films = open
    ? (open[chosen]?.length ? open[chosen] : open.known ?? []).map(fromTable)
    : chosen ? lists[chosen].films : [];

  /* Broken after the third when there are five, so the row reads 3+2
     rather than however many happen to fit and then the remainder. */
  const picks = films.length
    ? films.map((f, i) =>
        `<button data-go="${esc(path(f.title, f.id))}">${esc(f.title)}` +
        `<span class="pick-year">${esc(year(f.wrapped) || f.wrappedYear || f.year)}</span></button>` +
        (films.length === 5 && i === 2 ? '<span class="pick-break"></span>' : '')).join('')
    : PICKS.map(p => `<button data-go="${esc(path(p.name, p.id))}">${esc(p.name)}</button>`).join('');

  /* A switch, not a filter: three words, and one of them is always on —
     including while a door is open, because the sort is still what
     ordered the five you are looking at. */
  const switcher = sorts.length > 1
    ? `<p class="landing-label">${sorts.map(key =>
        `<button class="landing-sort" data-sort="${key}"${
          key === chosen ? ' aria-current="true"' : ''}>${esc(lists[key].label)}</button>`).join('')}</p>`
    : films.length ? `<p class="landing-label">${esc(lists[chosen].label)}</p>` : '';

  /* Wikidata's genre labels all end in "film" — drama film, war film,
     Western film — which is correct in a database and unreadable in a
     row, where it prints the same word nine times. Trimmed for display
     only; the label the data is keyed on is untouched, and anything that
     is not an X film ("cinematic fairy tale") keeps its whole name. */
  const doorName = label => sentence(label.replace(/ films?$/i, ''));

  /* One line naming what is open, in the order the phrase is said:
     "American comedy", not "comedy, American". It carries the count,
     which the doors themselves no longer do — with two of them lit, a
     number on each would read as two answers to a question with one.

     And it says *five of* that count, because the count is the larger
     number by three orders of magnitude and a reader is entitled to
     assume a list is the thing it is counting. French silent is 2,687
     pictures and five buttons. Which five is the sort's business, and the
     sort is named directly above — saying it twice would make the line
     longer to no end.

     Which makes the line the obvious way to the other 2,682, so it is a
     link: the Vault, with the same two facets already on. Nothing else on
     the page can offer that, because nothing else knows what you asked
     for. */
  const standingName = [
    landingDoors.region,
    landingDoors.genre && (landingDoors.region
      ? doorName(landingDoors.genre).toLowerCase()
      : doorName(landingDoors.genre)),
  ].filter(Boolean).join(' ');

  const standing = open
    ? `<p class="landing-standing"><a href="${esc(vaultPath(landingDoors))}">${
        esc(standingName)}${open.count > films.length
          ? `<span class="standing-of">${films.length === 5 ? 'five' : films.length} of</span>`
          : ''}<span class="door-count">${open.count.toLocaleString('en')}</span></a></p>`
    : '';

  /* A door that leads nowhere is shown and not offered. With a region
     chosen, the genres that have nothing in that region go quiet rather
     than disappearing — a row that reshuffles itself on every click
     stops being a place, and the gaps are informative: no Australian
     Westerns is a fact about the corpus. */
  const doorRow = kind => {
    const entries = doors[kind] ?? [];
    if (!entries.length) return '';
    const other = kind === 'genre' ? 'region' : 'genre';
    return `<p class="landing-doors">${entries.map(d => {
      const mine = landingDoors[kind] === d.label;
      const paired = landingDoors[other];
      const reachable = mine || !paired || combinations[
        kind === 'genre' ? facetKey(d.label, paired) : facetKey(paired, d.label)];
      return `<button class="landing-door" data-door="${esc(kind)}" data-label="${esc(d.label)}"${
        mine ? ' aria-current="true"' : ''}${reachable ? '' : ' disabled'
        }>${esc(doorName(d.label))}</button>`;
    }).join('')}</p>`;
  };

  /* The way through sits below the pictures — you should meet a few
     closings before you're offered all of them. It stays the small line
     it always was; only the number is given weight, because the number is
     where every hour of computation went and it should not read as a
     footnote to five titles.

     The doors sit between the two: you are shown five, then offered ways
     to re-aim at five more, and only then handed the whole archive. */
  show(`
    <section class="landing">
      ${switcher}
      ${standing}
      <div class="landing-picks">${picks}</div>
      ${doorRow('genre')}
      ${doorRow('region')}
      <p class="landing-more">
        <a href="#/archive">The Vault${summary.total
          ? ` &middot; <span class="landing-vault-count">${summary.total.toLocaleString('en')}</span> pictures`
          : ''}</a>
      </p>
    </section>`);
}


/* --- router ------------------------------------------------------------ */

/* One delegated handler for every navigable thing on the page. */
document.addEventListener('click', e => {
  /* A door you are already standing in closes, which is the only way to
     take one facet off without taking both. Choosing a sort clears them
     all, because a sort is a statement about the whole archive and it
     cannot be one about a tenth of it. */
  const door = e.target.closest('[data-door]');
  if (door) {
    const { door: kind, label } = door.dataset;
    landingDoors[kind] = landingDoors[kind] === label ? null : label;
    viewLanding();
    return;
  }

  const sort = e.target.closest('[data-sort]');
  if (sort) {
    landingSort = sort.dataset.sort;
    viewLanding();
    return;
  }

  /* Same behaviour, its own state. */
  const unc = e.target.closest('[data-unc]');
  if (unc) {
    const { unc: kind, label } = unc.dataset;
    uFilter[kind] = uFilter[kind] === label ? 'all' : label;
    viewUnclassified().then(() => {
      for (const d of document.querySelectorAll('details.decade[open]')) fillUnclassifiedDecade(d);
    });
    window.scrollTo(0, 0);
    return;
  }

  const vault = e.target.closest('[data-vault]');
  if (vault) {
    /* Each row toggles its own facet and leaves the other alone, so a
       reader can take the genre off an American comedy and still be
       looking at American pictures. */
    const { vault: kind, label } = vault.dataset;
    vaultFilter[kind] = vaultFilter[kind] === label ? 'all' : label;
    /* Re-render the chips, then re-fill any drawer that was already open.
       The year files are cached, so changing a filter costs nothing over
       the network — it only changes which rows are drawn. */
    loadSummary().then(summary => {
      renderArchive(summary);
      for (const d of document.querySelectorAll('details.decade[open]')) fillDecade(d);
    });
    window.scrollTo(0, 0);
    return;
  }

  /* A portrait sits inside a row that navigates, so it has to claim the
     click before the row sees it. Enlarging and going to the person's
     page are different intentions and the small picture is the only place
     you can express the first one. */
  const shot = e.target.closest('img[data-full]');
  if (shot) { e.stopPropagation(); openViewer(shot); return; }

  /* Already there: no navigation to do, so do the useful thing. */
  const colophon = e.target.closest('#colophon-link');
  if (colophon && location.hash.includes('/about')) {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }

  const el = e.target.closest('[data-go]');
  if (el) location.hash = el.dataset.go;
});

/* --- the viewer -------------------------------------------------------- */

/* Ask Commons for a size. The originals are not a safe thing to link: they
   run from 280 KB to, in Billie Holiday's case, 5.4 MB, and nothing about
   a portrait on this site needs that. 960px is 145-165 KB and larger than
   any screen will show it.

   No desaturation here. The grayscale on the roster exists because a
   column of portraits from across a century looks like an accident
   otherwise; one picture on its own has no such problem, and at this size
   you are looking AT the photograph rather than along a row of them. */
let viewer = null;

function openViewer(img) {
  const name = img.dataset.name || '';
  const file = img.dataset.full;

  closeViewer();
  viewer = document.createElement('div');
  viewer.className = 'viewer';
  viewer.tabIndex = -1;                /* focusable, but not in the tab order */
  viewer.setAttribute('role', 'dialog');
  viewer.setAttribute('aria-modal', 'true');
  viewer.setAttribute('aria-label', name ? `Portrait of ${name}` : 'Portrait');
  viewer.innerHTML = `
    <button class="viewer-close" aria-label="Close">&times;</button>
    <figure>
      <img src="${esc(thumb(file, 960))}" alt="${esc(name)}">
      <figcaption>
        ${esc(name)}
        <a href="${esc(file.replace(/^http:/, 'https:'))}" rel="noopener">Wikimedia Commons</a>
      </figcaption>
    </figure>`;

  /* Anywhere outside the picture closes it, which is what people try
     first, and the button is there for anyone who doesn't. */
  viewer.addEventListener('click', ev => {
    if (!ev.target.closest('figure') || ev.target.closest('.viewer-close')) closeViewer();
  });

  document.body.appendChild(viewer);
  document.body.classList.add('viewing');

  /* Focus the dialog, not the close button. Escape and the keyboard both
     need focus inside here, but putting it on the button made every
     mouse-driven open paint a system focus ring around the X — an
     accessibility affordance shown to the one person who didn't need it.
     Tab still reaches the button, and then the ring is wanted. */
  viewer.focus({ preventScroll: true });
}

function closeViewer() {
  viewer?.remove();
  viewer = null;
  document.body.classList.remove('viewing');
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeViewer();
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
/* The footer link is the way further in — except on the page it leads to,
   where it led nowhere at all: the hash was already #/about, so clicking
   it fired no hashchange, drew nothing and did not even scroll. A dead
   control at the bottom of the longest page on the site.

   It becomes what it can usefully be there instead. The label always
   describes what the click does, which is the only rule that keeps a
   control honest. */
function wireColophon(onAbout) {
  const link = document.getElementById('colophon-link');
  if (!link) return;
  link.textContent = onAbout ? 'Back to the top' : 'Methods and sources';
}

/* The way to the other archive, never a tab bar.

   This was one link — "The Vault" — and its whole job was getting back
   there. Adding "Unclassified" beside it turned it into two buttons with
   nothing saying which you were looking at, so on the Vault it offered to
   take you to the Vault.

   So it shows the place you are NOT. One link, the same as before, and
   the question it answers is still "where else can I go". */
function showNav(on, kind) {
  const nav = document.getElementById('nav');
  if (!nav) return;
  nav.hidden = !on;
  const here = kind === 'archive' ? '#/archive'
    : kind === 'unclassified' ? '#/unclassified' : null;
  for (const a of nav.querySelectorAll('a')) {
    a.hidden = here !== null && a.getAttribute('href') === here;
  }
}

async function route() {
  /* URLs are #/barbara-adolph/Q807328 — the readable part, then the id.
     The Q-id is found wherever it sits, so every URL ever published still
     works, including #/person/Q807328/barbara-adolph and bare #/film/Q…. */
  const segments = location.hash.split('/').slice(1);
  const id = segments.find(s => /^Q\d+$/.test(s));
  let kind = segments.find(s =>
    ['film', 'person', 'archive', 'about', 'unclassified'].includes(s));
  window.scrollTo(0, 0);

  try {
    /* Shown everywhere except the landing, which has its own way in.
       It used to appear only on a picture, a person or the About page,
       because it was one link and its whole job was getting back to the
       Vault. Now it is the only way to reach the unclassified from the
       Vault — and hiding it on the Vault is hiding the door from the room
       you would look for it in. */
    showNav(!!id || ['about', 'archive', 'unclassified'].includes(kind), kind);
    wireColophon(kind === 'about');

    if (kind === 'archive') { await viewArchive(segments); return; }
    if (kind === 'unclassified') { await viewUnclassified(segments); return; }
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
    /* This said "Wikidata didn't answer" for every kind of failure,
       including a ReferenceError of ours — which is how a typo on the
       landing page spent an evening looking like an outage at the query
       service. Blame the network only when it is the network. */
    const network = err instanceof TypeError
      || /Query service returned|NetworkError|Failed to fetch/i.test(err?.message || '');
    state(network
      ? 'Wikidata didn’t answer. Give it a moment and try again.'
      : 'Something went wrong drawing this page.');
    console.error(err);
  }
}

/* TMDB's terms require attribution wherever their data appears.

   This used to be conditional: both mentions stayed hidden until a TMDB
   key was set, because crediting a source we never called would be
   false. That was right when every page was computed live from the two
   databases and the browser either called TMDB or it did not.

   It stopped being right when the corpus landed. 27% of published
   closings were dated from TMDB, and even after provenance.js
   corroborated 19,614 of them against Wikidata, about 8% still rest on
   a date only TMDB recorded. Those dates are in the files this page
   fetches, on every page load, whether or not a key exists — so the
   credit is owed unconditionally, and the condition was hiding it on
   the live site, which has no key.

   `tmdb-credit` was also a dead id: nothing in the markup ever had it,
   so that line had been reaching for an element that did not exist.

   Still outstanding: the terms also require the TMDB logo, which is a
   brand asset this repository does not hold. See BACKLOG.md. */
function revealTmdb() {
  document.getElementById('about-tmdb')?.removeAttribute('hidden');
  document.getElementById('about-tmdb-2')?.removeAttribute('hidden');
}
revealTmdb();

window.addEventListener('hashchange', route);
route();
