/* ==========================================================================
   PICTURE WRAP — poster/judge.js

   Deciding one picture: who is on it, who is living, when it closed.

   Extracted from pass.js on 2 August 2026 because a second consumer
   appeared. retest.js re-examines pictures whose stored verdict predates
   a rule change, and the alternative was a second copy of this logic —
   which is the mistake verify.js exists to end and which this project has
   made three times.

   Nothing here fetches on its own. The caller passes `sparql` and `tmdb`,
   exactly as verify.js requires, so a script decides how it reaches the
   network and this file decides only what the answers mean.
   ========================================================================== */

import { qid } from './lib.js';
import { CREDITS, VALUES, LANGS } from '../shared.js';
import {
  survivors, statusOf, fromWikidata, datesAWrap, wrapDate, impossible,
} from '../verify.js';

const ROLE = new Map(CREDITS.map(([prop, label]) => [prop.replace('wdt:', ''), label]));

/* Everyone Wikidata puts on these pictures, with the dates and — this is
   the part the counting queries could never give — the people themselves.

   Birth comes through the full statement path because that is the only
   way to reach its precision, and precision is what separates a date from
   a year somebody typed.

   Batched: one query per twenty pictures rather than one per picture. */
export const creditsQuery = films => `
SELECT ?film ?p ?pLabel ?prop ?dob ?prec ?dod ?deathPrec ?tmdb WHERE {
  VALUES ?film { ${films.map(f => `wd:${f}`).join(' ')} }
  VALUES ?prop { ${VALUES} }
  ?film ?prop ?p .
  OPTIONAL {
    ?p p:P569/psv:P569 ?birth .
    ?birth wikibase:timeValue ?dob ; wikibase:timePrecision ?prec .
  }
  OPTIONAL { ?p wdt:P570 ?dod }
  OPTIONAL {
    ?p p:P570/psv:P570 ?death .
    ?death wikibase:timePrecision ?deathPrec .
  }
  OPTIONAL { ?p wdt:P4985 ?tmdb }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "${LANGS}". }
}`;

/* --- judging one picture ------------------------------------------------ */

/* Wikidata's own credits, judged by the same file that judges everyone
   else. This is the half the site used to do with `!p.dod` and no rule at
   all. */
export function judgeRecorded(rows, releaseYear) {
  const people = new Map();
  for (const r of rows) {
    const id = qid(r.p);
    if (!people.has(id)) {
      people.set(id, {
        wikidataId: id,
        name: r.pLabel || id,
        tmdbId: r.tmdb || null,
        roles: [],
        wd: fromWikidata(r.dob, r.prec, r.dod, r.deathPrec),
        tmdb: null,
      });
    }
    const role = ROLE.get(String(r.prop).split('/').pop());
    const person = people.get(id);
    if (role && !person.roles.includes(role)) person.roles.push(role);
  }

  /* Nobody worked on a picture before they were born, and Wikidata's own
     credits were never asked. The rule has existed since the backfill and
     was applied only to the people TMDB names — so Under Western Skies
     (1910) is dated 3 June 2024 by William Russell, born 1924, who is the
     Doctor Who actor and not the William Russell born 1884 who is also in
     its cast list. Every one of the longest release-to-wrap gaps in the
     corpus is this same collision.

     They stay in the evidence, flagged rather than deleted: the record
     should show that we saw this person and set them aside, not silently
     lose them. They do not vote and they cannot date a wrap. */
  return [...people.values()].map(p => ({
    ...p,
    source: 'wikidata',
    status: statusOf(p, releaseYear),
    datesAWrap: datesAWrap(p),
    impossible: impossible(p, releaseYear),
  }));
}

/* A picture arrives here in one of two shapes and this is the only place
   allowed to know that.

   The pass hands over the row its SPARQL query built — `tmdb` and `tv`,
   the two Wikidata properties, kept apart because they are different
   numbering systems. retest.js hands over the record that went to disk,
   where those two have already collapsed into `tmdbId` beside a `media`
   saying which one it was.

   Reading only the first pair is the worst bug this file has had. Both
   fields came back undefined for every picture retest.js passed, every
   one of them fell through to the no-id branch below, and 965 pictures
   were closed on Wikidata's word alone with their TMDB id sitting in the
   argument unread — 809 of them with an id that would have been answered.
   Gidget (1959) went into the Vault that way while Jo Morrow, who played
   Mary Lou, was alive and credited on TMDB.

   The tell was in the run: 965 re-tested, 965 closed, none reopened. A
   real test of that many pictures never comes back unanimous. */
export function tmdbRef(work) {
  if (work.tv) return { tmdbId: work.tv, media: 'tv' };
  if (work.tmdb) return { tmdbId: work.tmdb, media: 'movie' };
  if (work.tmdbId) return { tmdbId: work.tmdbId, media: work.media === 'tv' ? 'tv' : 'movie' };
  return { tmdbId: null, media: 'movie' };
}

export async function judge(work, creditRows, { sparql, tmdb }) {
  const releaseYear = Number(work.year) || 0;
  const recorded = judgeRecorded(creditRows, releaseYear);

  const living = recorded.filter(p => p.status === 'alive' && !p.impossible);
  const { tmdbId, media } = tmdbRef(work);

  /* Someone Wikidata records as living settles it, and no second opinion
     can overturn a person who is simply here. Skipping the TMDB call in
     that case is not an optimisation of the answer, it is the answer. */
  if (living.length) {
    /* Stopping here is what makes a corpus of this size affordable — the
       TMDB test is four seconds and this skips it for two pictures in
       three. But it is a memo, and its validity depends on the rule that
       produced `living`. Any later rule that makes `alive` stricter — a
       lower age ceiling, a tighter corroboration test, a new way to bury
       somebody — turns these pictures from open into UNTESTED, not into
       closed, because the population was never gathered.

       So the memo records its dependency. `heldOpenBy` names who the pass
       stopped on, which makes invalidation a local query — "which
       short-circuits rest on somebody no longer alive" — instead of a
       re-decision of the whole corpus followed by an audit inferring the
       class from the wreckage. 965 pictures were found that way on
       2 August, after the born-after-release rule reached Wikidata's own
       credits; they should have been findable in one line. */
    return {
      verdict: 'open', reason: 'wikidata-living', tested: false,
      heldOpenBy: living.map(p => ({
        wikidataId: p.wikidataId ?? null,
        name: p.name,
        born: p.wd?.born ?? null,
      })),
      recorded, resolved: [], unknownCount: null, tmdbCredited: null,
      wrapped: null, wrappedYear: null, dateBasis: null, last: null, ok: true,
    };
  }

  if (!tmdbId) {
    const dated = wrapDate(recorded, releaseYear);
    return {
      verdict: 'closed', reason: 'wikidata-only', tested: false, unverified: true,
      recorded, resolved: [], unknownCount: null, tmdbCredited: null,
      ...dated, ok: true,
    };
  }

  const found = await survivors({
    film: work.id, tmdbId, media, year: releaseYear,
    sparql, tmdb, detail: true,
  });

  if (!found.ok) {
    return {
      verdict: 'unchecked', reason: 'tmdb-no-answer', tested: true,
      recorded, resolved: [], unknownCount: null, tmdbCredited: null,
      wrapped: null, wrappedYear: null, dateBasis: null, last: null, ok: false,
    };
  }

  /* Everyone TMDB named that Wikidata had not attached to this picture,
     each with the verdict verify.js reached and the dates it used. */
  const resolved = (found.working || []).map(w => ({
    wikidataId: w.wikidataId ? qid(w.wikidataId) : null,
    tmdbId: w.tmdbId,
    name: w.name,
    roles: w.role ? [w.role] : [],
    onScreen: w.onScreen,
    wd: w.wikidata,
    tmdb: w.tmdb,
    source: 'tmdb',
    status: w.status,
    buriedByName: w.buriedByName,
    datesAWrap: w.datesAWrap,
  }));

  const alive = found.alive.length > 0;
  const dated = alive
    ? { wrapped: null, wrappedYear: null, dateBasis: null, last: null }
    : wrapDate([...recorded, ...resolved], releaseYear);

  return {
    verdict: alive ? 'open' : 'closed',
    reason: alive ? 'tmdb-survivor' : 'tested',
    tested: true,
    recorded, resolved,
    unknownCount: found.unknown,
    tmdbCredited: found.tmdbCredited ?? null,
    ...dated,
    ok: true,
  };
}
