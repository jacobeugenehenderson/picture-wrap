/* verify.js — is anyone who made this picture still alive?
   ==========================================================================

   The one implementation. Both halves import it: the poster before it will
   queue a closing, the browser before it will raise the bar to the top.

   It lived in poster/lib.js until now, and the browser carried its own
   copy. That copy kept every bug the original had after the original was
   fixed — three times, over three separate fixes, which is the whole
   argument for this file existing. If you find yourself writing a second
   version of anything below, that is the mistake happening again.

   Nothing here fetches on its own. The caller passes in how to reach
   Wikidata and TMDB, because that is the one thing the two halves cannot
   share: the poster sends a User-Agent and retries on 429, and the browser
   is not allowed to do either.

     sparql(query)  -> array of plain {var: value} rows
     tmdb(path)     -> parsed JSON, or null on any failure

   Everything else — what the answers mean — is identical on both sides,
   and must stay that way.                                                 */

import { VALUES, LANGS } from './shared.js';

/* TMDB person records, cached for the life of the page or process. The
   same bit player turns up across dozens of pictures in a single backfill
   year and there is no reason to ask twice. */
const personCache = new Map();

/* The age past which we stop claiming to know. Not "nobody has lived this
   long" — Jeanne Calment reached 122. It is the age past which a birth
   date and no death record stops being evidence in either direction, and
   the answer becomes 'unknown'.

   It is still a chosen number, which is the honest thing to say about it.
   It is defensible because of what it decides: it moves people from
   'alive' to 'unknown', never to 'dead'. Being wrong with it costs a
   picture its closing, not a false claim about a real person. */
const OLDEST = 112;

/* And the age past which we stop saying 'unknown', because there is
   nothing left to be unsure of. Jeanne Calment, 122 years and 164 days,
   is the longest life anyone has ever documented — so this is not a
   chosen number in the way OLDEST is. It is the record.

   The two lines do different jobs and the gap between them is the point.
   Past 112 a birth date no longer shows someone is living; past 122 it
   shows they are not. Between them we genuinely don't know.

   What it costs when it is wrong runs the other way from OLDEST, which is
   why it sits on the record rather than near it: being wrong here calls a
   living person dead. Nobody has ever been alive at 123.

   What it buys is not tidiness. Under 'unknown' alone, The Fortieth Door
   (1924) was held open by Bruce Gordon, born 1850, and would have been
   held open by him for ever — 14 of the 65 pictures from 1924 that
   Wikidata still shows as running are the same story. Those pictures
   never reached the Vault, never became candidates, and nothing anywhere
   reported them as a problem. */
const MAXIMUM_AGE = 122;

const thisYear = () => new Date().getUTCFullYear();

/* Could this person conceivably still be alive?

   Two facts, one sum. Nobody can have been born after the picture they
   worked on, so a missing birth date is not the absence of evidence it
   looks like — the release year is an upper bound on it, and the person
   is at least as old as the picture. Take whichever bound we have, ask
   how young the person could possibly be today, and compare that to the
   longest life on record.

   It answers 'no' or 'we can't say'. It never answers 'yes': being young
   enough to be alive is not being alive, and that is what the rest of
   this file is for. */
export function beyondLiving(born, releaseYear) {
  const year = Number(String(born || '').slice(0, 4))
    || Number(String(releaseYear || '').slice(0, 4)) || 0;
  return year > 0 && thisYear() - year > MAXIMUM_AGE;
}

/* Is there any evidence at all that this picture has closed?

   A picture closes when nobody on it is living. The rule that unrecorded
   people never veto is what makes that answerable: a picture with thirty
   recorded deaths and two blanks is closed, because holding it open for
   ever on two blanks would be a claim about the blanks that nothing
   supports.

   Run that rule on a picture where EVERYONE is a blank and it returns the
   strongest claim on the site out of no evidence whatsoever. Nobody was
   found living, so nothing vetoed; nobody was found dead, so nothing was
   shown. 23,161 pictures — 19% of what was published as the Vault — were
   in exactly that position, median release year 2007. Aanikoobijigan
   (2026) was among them, with Zack Khalil, born 1991, credited on it.

   This is the same shape as the worst bug this project has had, which the
   README describes as asking only Wikidata and counting everyone it could
   not place as dead. It survived because it was in the rule rather than
   in a copy of the code.

   So: a closing needs a death. One recorded death is enough — it is the
   difference between a weak claim and an unfounded one. Failing that,
   arithmetic will do, because nobody credited on a picture from before
   `earliestLivingBirthYear` can still be alive whatever any database
   holds.

   A picture that has neither is not closed and is not running. It is
   UNCLASSIFIED — a third state for pictures, mirroring the third state
   this project has always given a person and never gave a picture.

   The two words differ on purpose. A person with no dates is
   *unrecorded*, which is a fact about them. A picture is *unclassified*,
   which is a fact about us: the picture is recorded perfectly well, and
   what is missing is our ability to say anything about it. */
export function evidenced(judged, releaseYear) {
  if (beyondLiving(null, releaseYear)) return true;
  return (judged || [])
    .some(p => p.status === 'dead' && !outsideReckoning(p, releaseYear));
}

/* THE ROSTER'S OWN VERDICT — the film page's, expressed once so that
   something can check it.

   Canon rule 27 says the film and person pages ask Wikidata directly and
   apply the rules themselves, in the browser, in a second implementation
   no audit reaches. That second implementation has to exist: a filmography
   spans release years the pass may never have run, and the corpus is a
   snapshot while Wikidata is live, so the page cannot read a verdict off
   the corpus. It is a constraint, not a shortcut.

   What was never true is that it had to be UNINSPECTABLE. The page worked
   on flat SPARQL rows — `{dob, dod, credits}` — and did its classifying
   inline, so nothing outside a browser could run it and nothing ever did.
   It drifted three times: rule 6 missing on Gidget, the third state
   missing on Women of the World, and Philip Glass held open by counting
   instead of classifying.

   So the shape stays and the code moves here. `poster/check-pages.js`
   feeds it the corpus's own stored people and asks whether it reaches the
   corpus's verdict — same input, so any disagreement is drift rather than
   Wikidata having moved underneath.

   A ROW IS NOT A JUDGED PERSON, and the difference is the point. The pass
   has two databases, a precision and a status; the page has a birth date,
   a death date and a character string. This says what the page can
   conclude from what the page has. */
export function classifyRoster(rows, releaseYear) {
  const outside = [];
  const inPlay = [];
  /* Dead by arithmetic: no date to show, but evidence all the same. */
  const settled = [];

  for (const r of rows || []) {
    /* Born after the picture came out — rule 6. */
    const misattributed = impossible({ wd: { born: r.dob } }, releaseYear);
    /* Past any human life with no death recorded — rule 8. Leaves the
       reckoning rather than moving below the bar: inferring a death does
       not produce a date, and the rows below the bar are dates. */
    const beyond = !r.dod && beyondLiving(r.dob, releaseYear);
    /* Neither date on record — rule 3. Not living, not dead. */
    const unrecorded = !r.dod && !r.dob;
    /* And the band between OLDEST and MAXIMUM_AGE, where a birth date and
       no death stops being evidence in either direction — rule 2's ceiling.

       The page had no version of this. It excluded only people past 122
       and read everyone under that as living, so somebody aged 115 with no
       recorded death vetoed a picture the corpus had closed on them being
       'unknown'. 161 pictures disagreed that way, and the page was the one
       out of step: it is the same fact `statusOf` reads, and this is the
       file that is supposed to hold it once. */
    const bornYear = Number(String(r.dob || '').slice(0, 4)) || 0;
    const pastKnowing = !r.dod && bornYear > 0 && thisYear() - bornYear > OLDEST;
    /* In the picture, and the picture did not credit them — rule 4b. */
    const notCredited = uncredited({ roles: r.credits });

    if (misattributed || beyond || unrecorded || pastKnowing || notCredited) {
      outside.push(r);
      /* But `beyond` is not "we cannot say" — it is rule 8 saying DEAD.
         `statusOf` returns 'dead' for exactly this person, and the corpus
         counts them as evidence that a picture has closed.

         They leave the roster because there is no date to put below the
         bar; inferring a death does not produce one. That is a fact about
         where the row is DRAWN, and it was being read as a fact about what
         the row COUNTS AS. 288 pictures the corpus had closed on somebody
         born in 1880 read as unclassified on their own page.

         The same mistake as deriving "has wrapped" from "has a date", one
         level further down. */
      if (beyond && !misattributed && !notCredited) settled.push(r);
      continue;
    }
    inPlay.push(r);
  }

  return {
    outside,
    settled,
    living: inPlay.filter(r => !r.dod),
    gone: inPlay.filter(r => r.dod),
  };
}

/* And what that means for the picture. Deliberately the same three states
   the corpus has, so the two can be compared at all. */
export function rosterVerdict(rows, releaseYear) {
  const { living, gone, settled } = classifyRoster(rows, releaseYear);
  if (living.length) return 'open';
  /* Somebody past any human life is a death rule 8 infers, and it closes
     a picture even though it can never date one. */
  if (settled.length) return 'closed';
  /* The same arithmetic `evidenced()` applies: a picture released before
     anyone now living could have been born has closed, whether or not a
     single death was written down. Without this the page could not draw
     an 1896 picture as wrapped at all, and 339 of them contradicted the
     Vault. */
  if (beyondLiving(null, releaseYear)) return 'closed';
  if (!gone.length) return 'unclassified';
  return 'closed';
}

/* The verdict itself, which until 4 August 2026 was written out four
   times in four files and was therefore wrong in one of them.

   Given people already classified, the answer is three lines of
   arithmetic: anyone living holds it open, nobody recorded dead leaves it
   unclassified, and what is left has closed. `judge.js` had it,
   `rebuild.js` had half of it, `app.js` had a count that meant the same
   thing on a good day, and `audit.js` had a version that predated the
   third state — so the checker re-derived `closed` for all 23,583
   unclassified pictures and called 123 of 137 years unreproducible while
   the corpus was right.

   That is the bug this file exists to make impossible, and it happened
   anyway, because what was shared were the PARTS of the rule and not the
   rule. `evidenced` was exported and imported; the two lines that use it
   were retyped by everybody.

   `living` is an override, and it is the honest part of the signature.
   The pass knows who is alive from the TMDB survivor test, which is a
   population this function is never handed and could not re-derive. What
   it must not do is let each caller draw its own conclusion from that
   population — so the caller supplies the fact and this supplies the
   reasoning.

   It does NOT unify how people are gathered, which genuinely differs: the
   pass reads Wikidata and TMDB and writes the answer down, the browser
   asks Wikidata live and cannot afford the survivor test on a page load.
   That difference is why the film page is live, and it is what canon rule
   27 is about. This only guarantees that once you have the people, every
   surface draws the same conclusion from them. */
export function verdictFor(judged, releaseYear, { living } = {}) {
  const people = judged || [];
  const anyLiving = living
    ?? people.some(p => p.status === 'alive' && !outsideReckoning(p, releaseYear));

  if (anyLiving) return 'open';
  return evidenced(people, releaseYear) ? 'closed' : 'unclassified';
}

/* The same line drawn as a year, for the places that have to ask it of
   Wikidata rather than of a person we already hold: born before this and
   there is no living to be beyond. Exported so no query hard-codes a
   year that quietly stops being true next January. */
export const earliestLivingBirthYear = () => thisYear() - MAXIMUM_AGE;

/* And the same line again as SPARQL, because half the places that need it
   are asking Wikidata for a survivor rather than judging someone we
   already hold. Drop it into a block that is matching people with no
   death date, and the block stops matching the ones no absence of a
   record can bring back.

   It is here, not in the four queries that use it, for the reason this
   whole file is here: the copy always outlives the fix.

     ?film ?prop ?alive .
     FILTER NOT EXISTS { ?alive wdt:P570 ?dd }
     ${couldBeLivingSparql('?alive', '?film')}

   `film` is optional and does the other half of the arithmetic: pass it
   and a picture older than any human life stops producing survivors at
   all, whether or not anyone recorded a birth date. */
export const couldBeLivingSparql = (person, film) => {
  const cut = earliestLivingBirthYear();
  return `FILTER NOT EXISTS { ${person} wdt:P569 ?ageBorn . FILTER(YEAR(?ageBorn) < ${cut}) }` +
    (film ? `\n    FILTER NOT EXISTS { ${film} wdt:P577 ?ageOut . FILTER(YEAR(?ageOut) < ${cut}) }` : '');
};

/* Is this a date, or a year with a placeholder stapled to it?

   Wikidata answers properly: every time value carries a precision, where
   11 means "to the day" and 9 means "only the year is known" — and a
   year-only value still serialises as 1 January, because it has to
   serialise as something. We ask for the precision rather than guess.

   TMDB publishes no precision at all, so there the 1 January ending is the
   only signal available and it is a proxy, not a fact. That is a limit of
   the source, not a rule anyone chose. */
const WD_PRECISION_DAY = 11;
const WD_PRECISION_MONTH = 10;
const WD_PRECISION_YEAR = 9;
const toTheDay = date => !/-01-01$/.test(String(date));

/* How exactly a death is known, in the vocabulary the rest of the project
   speaks. Wikidata's precisions run past the year into decade (8),
   century (7) and coarser, and those are not blurry years — they are a
   different kind of statement. A death recorded as "20th century"
   serialises as 1901-01-01, and reading four characters off the front of
   it filed 548 pictures as having wrapped in 1901.

   So anything coarser than a year gives no position at all. The person is
   still dead, and the picture still closes; it simply cannot be placed on
   a timeline, which is the same answer as a death nobody dated. */
const resolutionOf = person => {
  if (person?.wd?.died) {
    const p = person.wd.diedPrecision;
    if (p >= WD_PRECISION_DAY) return 'day';
    if (p === WD_PRECISION_MONTH) return 'month';
    if (p === WD_PRECISION_YEAR) return 'year';
    return 'none';
  }
  /* TMDB publishes no precision, so the 1 January ending is the only
     signal and it can only ever separate "a day" from "a year". */
  if (person?.tmdb?.died) return toTheDay(person.tmdb.died) ? 'day' : 'year';
  return 'none';
};

/* Wikidata hands back "1944-01-02T00:00:00Z"; TMDB hands back
   "1944-01-02". Everything downstream wants the second shape.

   And sometimes Wikidata hands back neither. P570 can carry "unknown
   value" — the editor asserting a death without a date — which the query
   service returns as a skolem IRI. Slicing that to ten characters gave
   Yumeko Aizome a death date of "http://www". The verdict was right by
   accident, because a URI is truthy and truthy meant dead, and the whole
   point of this file is not deciding things by accident. */
const day = iso => {
  if (!iso) return null;
  const text = String(iso);
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : null;
};

/* Did Wikidata assert a death at all, date or no date? "Unknown value" is
   an assertion — it says this person is gone and nobody recorded when. */
const asserted = value => value != null && String(value) !== '';

/* A Wikidata query's raw columns, turned into the record `statusOf` reads.

   Exported because callers that judge Wikidata's own credits — the pass,
   and anything else that holds dates before this file sees them — were
   otherwise going to re-implement the three lines above: which slice is a
   date, what an undated death means, where precision lives. Those are not
   parsing details, they are the difference between a verdict and an
   accident, and this file exists so there is one copy of them.

   Two precisions, and they are not interchangeable. The first pilot run
   dated a wrap to 2000-01-01 on Mary Parker, whose BIRTH is recorded to
   the day and whose death is a bare year — because a single `precision`
   field was written by the birth and then read by the death. A record
   with one precision on it will always end up answering for the wrong
   date eventually. */
export const fromWikidata = (born, precision, died, diedPrecision) => ({
  born: day(born),
  precision: Number(precision ?? 0),
  died: day(died),
  diedPrecision: Number(diedPrecision ?? 0),
  deathAsserted: asserted(died),
});

/* Is a death date solid enough to date a wrap with?

   Vetoing on a shaky record is safe — it leaves a picture open. Dating on
   one is a claim the whole page is built around, and 2000-01-01 is a year
   wearing a date's clothes. Wikidata publishes precision, so we ask; TMDB
   does not, so the 1 January ending is the only signal there. */
export const datesAWrap = person => resolutionOf(person) === 'day';

/* When did a closed picture close, and who closed it?

   Here rather than in a caller, because within an hour of the rule being
   written there were three copies of it — the pass, the rebuild and the
   audit — and two of them already disagreed. That is the exact history
   this file exists to stop repeating.

   The rule: the LAST death decides, whatever precision it was recorded
   at. Taking the last precisely-recorded death instead is the tempting
   version, because it always yields a printable date — and it is wrong
   in a way that matters. Los misterios del turf argentino would have read
   "Julio Irigoyen was the last of its makers, 29 August 1967" while
   Aparicio Podestá, also credited, died in 1979. Twelve years and the
   wrong name, bought with a prettier date. 56 pictures in 1924 alone.

   So three answers, and the caller renders what it likes:

     day    a death recorded to the day. The only one that may print as a
            date, and the only one that may name a person in a wrap line.
     year   the last death is real but recorded only to the year. The
            picture wrapped that year, on a day nobody wrote down.
     none   no death recorded anywhere. Closed by arithmetic, and it has
            no place on a timeline at all. */
export function wrapDate(judged, releaseYear) {
  /* A picture cannot have wrapped before it existed.

     Pure arithmetic, no chosen number: whatever a credit means, the last
     person who made a picture did not die before it was released. It
     catches three different things at once — source authors and
     pre-existing composers whom Wikidata credits as writers and music
     (Edgar Allan Poe dating The Murders in the Rue Morgue to 1849, Franz
     Schubert dating a 1931 picture to 1828), people who appear only as
     archival footage (Frederik VIII of Denmark on a 1937 film), and
     plain bad dates.

     Note what it does NOT do: exclude them from the picture. Poe is
     credited and the record should say so. He simply cannot be the last
     of its makers. Dying shortly before release is ordinary and stays
     ordinary — an actor who does not live to the premiere still dates
     the wrap if nobody outlives them. */
  const floor = Number(String(releaseYear || '').slice(0, 4)) || 0;

  const dated = judged
    .filter(p => p.status === 'dead' && !outsideReckoning(p, releaseYear))
    .map(p => ({ person: p, died: p.wd?.died || p.tmdb?.died }))
    .filter(d => d.died && (!floor || Number(d.died.slice(0, 4)) >= floor))
    .sort((a, b) => b.died.localeCompare(a.died));

  if (!dated.length) {
    return {
      wrapped: null, wrappedMonth: null, wrappedYear: null,
      dateBasis: 'none', last: null,
    };
  }

  const last = dated[0];
  const basis = resolutionOf(last.person);

  /* Published at the resolution the source actually holds, and no finer.
     A month-precise death places a picture in a month; a year-precise one
     places it in a year; and anything coarser places it nowhere, which is
     a fact about the record rather than a gap in it. */
  return {
    wrapped: basis === 'day' ? last.died : null,
    wrappedMonth: basis === 'day' || basis === 'month' ? last.died.slice(0, 7) : null,
    wrappedYear: basis === 'none' ? null : last.died.slice(0, 4),
    dateBasis: basis,
    last: {
      wikidataId: last.person.wikidataId || null,
      tmdbId: last.person.tmdbId || null,
      name: last.person.name,
      died: last.died,
      source: last.person.source || null,
      /* In front of the camera or behind it. Derived from the credit
         where Wikidata supplied it and from TMDB's own billing
         otherwise; null when neither said. */
      onScreen: last.person.onScreen
        ?? (last.person.roles?.length
          ? last.person.roles.some(r => r === 'Cast' || r === 'Voice')
          : null),
    },
  };
}

/* The year either database gives, preferring Wikidata where both do. */
const bornYear = person =>
  Number(String(person?.wd?.born || person?.tmdb?.born || '').slice(0, 4)) || 0;

async function mapLimit(items, limit, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += limit) {
    out.push(...await Promise.all(items.slice(i, i + limit).map(fn)));
  }
  return out;
}

/* Dead, alive, or unknown — and the three are not interchangeable.

   'dead'    — a death date from either database, or an age no human has
               ever reached. Those are the only two ways in. The second
               infers a death but never a date, and the difference decides
               everything downstream: a picture can close on it, and no
               picture can be dated by it.
   'alive'   — a birth date we can credit, and no death anywhere.
   'unknown' — no usable evidence. Not an answer, never read as 'dead'.

   A birth date is creditable if it is precise, or if both databases give
   one and agree on the year. A lone imprecise date is a year somebody
   typed, and a year is not a person: Bill Alcorn, "Soldier (uncredited)"
   in Mildred Pierce, exists as `1920-01-01` in TMDB and nowhere else at
   all. That is not a survivor to set against a picture.

   Note which way the errors run. 'alive' is what vetoes a closing, so
   over-crediting a birth date costs a picture its wrap, while
   under-crediting one risks closing a picture on somebody's silence. The
   second is the expensive mistake, which is why corroboration is what
   moves someone out of 'alive' — evidence, not arithmetic.

   `releaseYear` is what lets the arithmetic reach someone with no birth
   date at all: they cannot have been born after the picture. */
export function statusOf(person, releaseYear) {
  if (!person) return 'unknown';

  /* A death Wikidata asserts without dating is still a death. Reading it
     off the date alone worked only because an undatable value happened to
     be a non-empty string. */
  if (person.wd?.deathAsserted) return 'dead';
  const died = person.wd?.died || person.tmdb?.died || null;
  if (died) return 'dead';

  const births = [
    person.wd?.born ? Number(person.wd.born.slice(0, 4)) : null,
    person.tmdb?.born ? Number(person.tmdb.born.slice(0, 4)) : null,
  ].filter(Boolean);

  /* The youngest they could possibly be. With no birth date on either
     side that is the picture's own age, since nobody worked on a film
     before they were born. */
  const youngest = births.length ? Math.max(...births) : null;

  if (beyondLiving(youngest, releaseYear)) return 'dead';

  /* Nothing on either side places this person in time at all. They are
     unrecorded, and rule 17 is that unrecorded people never veto — which
     is load-bearing: half of all closings hold at least one of them, and
     holding a picture open forever on a blank would be a claim about the
     blank that nothing supports. */
  if (!births.length) return 'unknown';

  /* And a placement has to come from somewhere that placed a PERSON.
     Where the only date is a lone imprecise one from TMDB, it does not.

     `1920-01-01` is what TMDB stores when it knows a year and no more, so
     it is not a birthday, it is a year in a date-shaped field. Bill
     Alcorn — "Soldier (uncredited)" in Mildred Pierce, existing as that
     string in TMDB and nowhere else at all — is the case, and he held
     that picture open at a notional 106 for exactly as long as this test
     was missing.

     A Wikidata item at year precision is a different object. Somebody
     catalogued a person and recorded the year they were born; the day is
     absent rather than invented. Mehrdad Jenabi and Vahid Nik-Khah Azad
     are that, born 1956, and they hold The Squeaking Shoes open
     correctly.

     Which is the distinction the rule that stood here until 4 August
     failed to draw. It demanded day precision from everybody, so it
     silenced Jenabi and Azad along with Alcorn, and 3,132 closings rested
     on people it had silenced. Removing it outright brought Alcorn back.
     The line is neither precision nor nothing: it is whether a source
     that records people recorded this one. */
  const placed = Boolean(person.wd?.born)
    || (person.tmdb?.born && toTheDay(person.tmdb.born))
    || births.length === 2 && births[0] === births[1];

  if (!placed) return 'unknown';

  /* Old enough that neither 'alive' nor 'dead' is a claim we can make. */
  const age = thisYear() - youngest;
  return age > OLDEST ? 'unknown' : 'alive';

  /* A DAY-PRECISION TEST STOOD HERE, AND IT WAS ASYMMETRIC.
     Removed 4 August 2026.

     It required a birth date to be exact to the day — or corroborated by
     both databases on the year — before anyone could be called *alive*.
     Anything less returned 'unknown', and unknown never vetoes, so the
     picture closed.

     The reasoning was that precision matters for 'alive' and not for the
     line above it, and that is true of the claim it was written for:
     whether a birth date is exact changes nothing about a man born in
     1850. But it was never examined against the claim it actually
     enabled. Precision was demanded to hold a picture OPEN, the safe
     direction, and not to let it CLOSE, which is the only claim here that
     can be wrong about a living person.

     The Squeaking Shoes (2004) is the case. Mehrdad Jenabi and Vahid
     Nik-Khah Azad are both born 1956 at Wikidata precision 9 — year only,
     the day a placeholder — with no death recorded anywhere and no TMDB
     record. Both came back 'unknown', neither vetoed, and the picture was
     published as wrapped on Akbar Abdi's death in July 2026 while its own
     page drew the two of them as living. Two men aged 70.

     Measured before it was changed: 3,132 closings — 3.2% — rested on
     somebody with a birth year, no recorded death, and an age under 112.
     846 of them on somebody who would be under 70 today.

     The line is now placement rather than precision. If the record can
     put you in time and shows no death, you are not evidence of a
     closing. If it cannot place you at all, rule 17 still applies — and
     it must, because 49.3% of closings hold at least one person with no
     birth year anywhere. */
}

/* Which of these people does Wikidata know to be dead, found by name?

   The gap this closes: a person is linked to Wikidata only through P4985,
   the TMDB person id. Plenty of people Wikidata knows perfectly well have
   no such link — so they fall past the id lookup to TMDB, TMDB has no
   death date, and we announce them as a survivor.

   Péter Eötvös is the case that found it. Died 24 March 2024, recorded on
   Wikidata, no P4985 — and we reopened Cats' Play on him. A name is not a
   good key, but it is the key we have, and it beats deciding from TMDB's
   silence alone.

   Guarded on the birth year matching exactly, which is why only people
   with a birth date are asked about. An exact name match is common enough
   to be dangerous on its own — there are several of most names — but a
   name and a birth year together is a different claim. If more than one
   person clears the guard we have found ambiguity, not an answer, and the
   caller keeps whatever it already believed.

   Any failure returns an empty set: this pass can only move someone out of
   'alive', so losing it costs a closing, never a claim. */
const NAME_BATCH = 60;

export async function deathsByName(people, sparql) {
  /* A map, not a set: which Wikidata item matched and what death it
     carried, so the burial can be checked later instead of taken on
     trust. It was a bare set of ids, which recorded THAT we had decided
     someone was dead and nothing about why — on an inference from a name
     and a birth year, which is the weakest evidence this file acts on.

     The date is kept for the record and is deliberately not allowed to
     date a wrap: a name match is good enough to stop claiming somebody
     is alive, and not good enough to put a day on the headline claim. */
  const buried = new Map();

  /* Quotes and backslashes would break out of the SPARQL literal, and a
     name that long is a data error rather than a person.

     Control characters too, and not only the newline that was named here
     — a tab or a carriage return inside a SPARQL literal is just as
     malformed, and TMDB's names are typed by members of the public. The
     failure was quiet rather than dangerous: a bad name made the whole
     batch of sixty 400, the error was swallowed, and fifty-nine people
     nobody could see went unburied. Rejecting the one name costs one
     lookup instead of sixty. */
  const unusable = /["\\\u0000-\u001F\u007F]/;
  const asking = people.filter(p =>
    p.name && p.name.length <= 60 && !unusable.test(p.name) && bornYear(p));
  if (!asking.length) return buried;

  for (let i = 0; i < asking.length; i += NAME_BATCH) {
    const batch = asking.slice(i, i + NAME_BATCH);
    const values = batch.map(p => `"${p.name}"@en`).join(' ');

    /* wdt:P31 wd:Q5 keeps films, characters and songs that share a name
       out of it. rdfs:label only, not altLabel: alt labels multiply the
       match set and the query time, and TMDB records the common form of a
       name, which is what rdfs:label holds. */
    const rows = await sparql(`
      SELECT ?name ?p ?dob ?dod WHERE {
        VALUES ?name { ${values} }
        ?p rdfs:label ?name ; wdt:P31 wd:Q5 .
        OPTIONAL { ?p wdt:P569 ?dob }
        OPTIONAL { ?p wdt:P570 ?dod }
      }`).catch(() => []);

    const byName = new Map();
    for (const r of rows) {
      if (!byName.has(r.name)) byName.set(r.name, []);
      byName.get(r.name).push(r);
    }

    for (const person of batch) {
      const born = bornYear(person);
      const candidates = (byName.get(person.name) || []).filter(r =>
        Number(String(r.dob || '').slice(0, 4)) === born);

      /* One match, and it has a death date. Anything else is a guess. */
      if (candidates.length === 1 && candidates[0].dod) {
        buried.set(person.id, {
          wikidataId: candidates[0].p ? String(candidates[0].p).split('/').pop() : null,
          died: day(candidates[0].dod),
          /* The FULL birth date the match landed on, not only the year it
             was matched by. The match is deliberately a year — that is
             rule 14 and it is not being tightened here — but a caller
             that wants to know how good the match was cannot ask without
             this, and one of them does: the disputes file is read by a
             person deciding whether to overwrite a date, and two people
             who merely share a name and a birth YEAR produce a dispute
             out of nothing. Paul J. Smith the animator, born 1906-03-15,
             was recorded as disagreeing with Paul J. Smith the Disney
             composer, born 1906-10-30. */
          born: candidates[0].dob ? day(candidates[0].dob) : null,
          matchedOn: `${person.name}, born ${born}`,
        });
      }
    }
  }

  return buried;
}

/* Everyone TMDB credits who might still be alive, and a count of the ones
   nobody can answer for.

   Three passes, because neither database is complete and they are
   incomplete in different places.

     1. Wikidata by TMDB id — birth and death dates for everyone it links.
     2. TMDB's own dates for everyone Wikidata has not buried.
     3. Wikidata again, by name, for whoever is still standing.

   Every one of those exists because of a specific wrong answer. Asking
   TMDB who was in a film and then asking only Wikidata whether they were
   alive counted everyone unmatched as dead, and put pictures with living
   bit players in the Vault. Stopping at pass one because Wikidata had
   heard of someone counted people TMDB had buried as survivors. Stopping
   at pass two counted people with no P4985 link — Péter Eötvös, dead in
   2024 and recorded — as survivors too.

   The rule underneath all three: an absent death date is not a pulse. It
   is an absent death date, and the answer to it is 'unknown'.

   Returns { alive, unknown }. A non-empty `alive` means the picture is not
   closed. A non-zero `unknown` is not a veto — for a 1935 picture almost
   every unknown really is dead — but it is the honest measure of how much
   of the claim rests on nothing.

   `ok` says whether the test actually ran. An empty `alive` with ok:false
   is not a finding of nobody — it is a lookup that failed, or a film with
   no TMDB id to ask about. The poster can live with the difference,
   because a human reads its queue. The browser cannot: there, an
   unchecked picture drawn as wrapped is a false claim on screen. Callers
   must decide what silence means for them rather than being handed a
   confident empty list. */
/* Nobody can have worked on a picture released before they were born.

   That is arithmetic, not a heuristic, and it catches a class of error we
   inherit rather than create: Wikidata name collisions. The Doctor Who
   William Russell, born 1924, is credited on Anna Christie (1923). A
   British character actor born 1942 is credited on Evangeline (1919). Rae
   Allen, born 1926, on The Misleading Lady (1920).

   About 0.4% of the Vault, but concentrated at the extremes — every one
   of the six longest gaps between release and closing turned out to be
   one of these, so they dominate exactly the lists a reader would find
   interesting.

   Two things it fixes. The closing date and the "last of its makers"
   line, which are the headline claims on every page and every post. And,
   more seriously, a *living* person misattributed to an old picture would
   veto it forever — the wrap could never happen, and nothing would ever
   explain why. */
/* Was this person credited on the picture at all?

   TMDB lists everyone who appeared, credited or not, and marks the
   difference in the character string: "Soldier (uncredited)". It is a
   convention rather than a field, which is worth saying plainly — there
   is no boolean to read, so this is a string test on somebody else's
   data.

   Why it matters here. This archive's claim is about people CREDITED on a
   picture: "everyone" has always meant everyone recorded, and an extra
   who was deliberately not recorded is outside that by definition. Bill
   Alcorn played a soldier in Mildred Pierce and was not credited for it;
   whether he is alive says nothing about whether the people who made
   Mildred Pierce are gone.

   IT CUTS BOTH WAYS, WHICH IS THE POINT. An uncredited person does not
   veto a closing and does not date one either. The second half is the
   part that is easy to forget and the part that changes wrap dates: if an
   uncredited extra outlived the cast, the picture closed when the last
   CREDITED person died, not when they did.

   And note the direction of the error, because it runs against this
   project's usual grain. Everywhere else, being wrong costs a picture its
   wrap. Here, a false match on "(uncredited)" REMOVES a veto and can
   close a picture on somebody still living — the expensive mistake. So
   the test is deliberately literal: the word TMDB uses, nothing inferred,
   no guessing from a blank role. A person whose role we never stored is
   not uncredited, they are unknown, and they keep their vote.

   THE WORD, NOT A FIXED SHAPE AROUND IT. This first matched `(uncredited)`
   exactly, on the reading that TMDB has one convention. It has several:
   Mel Blanc is `Bugs Bunny (voice / uncredited)` on Jasper Goes Hunting,
   and dated its closing for as long as this looked for the parentheses
   instead of the word. 228 roles in 144 forms sat outside the strict test
   — `(voice, uncredited)`, `(archive footage / uncredited)`, and plain
   `Uncredited` — and every one says the same thing.

   A whole word is the widest this should ever go. It is still TMDB's own
   word rather than an inference, and no character among the 75,659
   matching roles is NAMED anything like it.

   Crew are never matched: `job` carries "Director", not a credit
   convention, and a crew job IS the credit. */
export const uncredited = person =>
  (person?.roles || []).some(r => /\buncredited\b/i.test(String(r)))
  || /\buncredited\b/i.test(String(person?.role ?? ''));

/* Outside the reckoning: in the list because they were in the picture,
   but voting on nothing and dating nothing.

   Two ways in, and they are the same kind of fact. Born after it came out
   means they cannot have worked on it; uncredited means they did, and the
   picture did not say so. Both were being tested separately in four
   places, which is how one of them reached three of them. */
export const outsideReckoning = (person, releaseYear) =>
  (person?.impossible ?? impossible(person, releaseYear)) || uncredited(person);

export function impossible(person, releaseYear) {
  if (!releaseYear) return false;
  const born = Number(String(person?.wd?.born || person?.tmdb?.born || '').slice(0, 4));
  return born > 0 && born > releaseYear;
}

export async function survivors({ film, tmdbId, media = 'movie', year, sparql, tmdb, detail = false }) {
  if (!tmdbId) return { alive: [], unknown: 0, ok: false };

  try {
    /* A series is not a long film. TMDB keeps them apart, and so must we:
       /movie/{id}/credits against a series id answers about whatever film
       happens to hold that number.

       aggregate_credits, not credits, because a series' /credits is only
       the billed regulars — five people for BoJack Horseman, against 248
       cast and 179 crew in the aggregate. Everyone who ever appeared is
       the question this project asks. */
    const credits = await tmdb(media === 'tv'
      ? `/tv/${encodeURIComponent(tmdbId)}/aggregate_credits`
      : `/movie/${encodeURIComponent(tmdbId)}/credits`);
    if (!credits) return { alive: [], unknown: 0, ok: false };

    /* The two endpoints disagree about shape. A film credit carries
       `character` and `job` directly; an aggregate series credit carries
       `roles` and `jobs` arrays, because one person may have played three
       parts across nine years. Flattened here, once. */
    const flatten = (list, key) => (Array.isArray(list) ? list : []).map(c => ({
      ...c,
      character: c.character ?? c.roles?.[0]?.character ?? null,
      job: c.job ?? c.jobs?.[0]?.job ?? null,
      _cast: key === 'cast',
    }));

    const cast = flatten(credits.cast, 'cast');
    const crew = flatten(credits.crew, 'crew');
    const everyone = [...cast, ...crew];
    if (!everyone.length) return { alive: [], unknown: 0, ok: false };

    const ids = [...new Set(everyone.map(c => String(c.id)))];

    /* People Wikidata already ties to this film are somebody else's
       problem — the caller has tested them against Wikidata's own dates. */
    const known = await sparql(`
      SELECT ?tmdb WHERE {
        VALUES ?prop { ${VALUES} }
        wd:${film} ?prop ?p . ?p wdt:P4985 ?tmdb .
      }`);
    const have = new Set(known.map(r => r.tmdb));
    const missing = ids.filter(id => !have.has(id));

    /* Everyone TMDB names is already linked from the film's own Wikidata
       item, so Wikidata's test covered all of them. Nothing left to ask,
       and that IS a complete answer. */
    if (!missing.length) return { alive: [], unknown: 0, ok: true };

    /* Pass one — Wikidata by TMDB id.

       Birth date as well as death date. An item with no P570 is not a
       person who is alive, it is a person nobody has buried in public, and
       reading the one as the other is this project's oldest mistake with
       the two databases swapped. Helen Hunt — hairdresser on Cover Girl,
       1944 — has a Wikidata item carrying no dates at all, and used to
       veto the picture on the strength of it.

       LANGS, not "en": the label service hands back the bare Q-number when
       a person has no label in the language asked for, and this list is
       largely people who don't.

       The birth date comes through the full statement path rather than
       `wdt:`, because that is the only way to reach its precision. */
    const rows = await sparql(`
      SELECT ?tmdb ?p ?pLabel ?dob ?prec ?dod ?deathPrec ?img WHERE {
        VALUES ?tmdb { ${missing.map(i => `"${i}"`).join(' ')} }
        ?p wdt:P4985 ?tmdb .
        OPTIONAL {
          ?p p:P569/psv:P569 ?birth .
          ?birth wikibase:timeValue ?dob ; wikibase:timePrecision ?prec .
        }
        /* Both paths for the death, and both are needed. The truthy one
           still answers "is there a death at all", including the undated
           assertion that has no time value to reach. The statement path
           answers "how precisely is it known", which is what may date a
           wrap. Asking only the second would read an undated death as no
           death. */
        OPTIONAL { ?p wdt:P570 ?dod }
        OPTIONAL {
          ?p p:P570/psv:P570 ?death .
          ?death wikibase:timePrecision ?deathPrec .
        }
        OPTIONAL { ?p wdt:P18 ?img }
        SERVICE wikibase:label { bd:serviceParam wikibase:language "${LANGS}". }
      }`).catch(() => []);

    const names = new Map(everyone.map(c => [String(c.id), c.name]));

    /* What each person did on the picture, so a survivor can be shown as a
       row in the roster rather than described in a sentence underneath it.
       Cast entries carry a character, crew entries carry a job. */
    const billing = new Map();
    for (const c of everyone) {
      const id = String(c.id);
      if (billing.has(id)) continue;
      billing.set(id, {
        role: c.character || c.job || null,
        onScreen: !!c._cast,
      });
    }

    /* One TMDB id can be claimed by more than one Wikidata item, and when
       it is, taking the first row is not a choice — SPARQL does not order
       results, so it is a coin flip that lands differently between runs.

       TMDB person 31220 is "Jorge Busto", who edited a picture in 1940 and
       has no dates. Two Wikidata items claim him: one with no dates, one
       born in 1982. Whichever came back first decided whether a man born
       forty-two years after the picture vetoed it.

       Two items claiming one identifier is ambiguity, not evidence. We
       keep neither and let TMDB answer instead. */
    const claims = new Map();
    for (const r of rows) {
      if (!claims.has(r.tmdb)) claims.set(r.tmdb, new Map());
      claims.get(r.tmdb).set(r.p ?? r.pLabel ?? '', r);
    }

    const wikidata = new Map();
    for (const [id, items] of claims) {
      if (items.size !== 1) continue;       /* Contested. Nobody wins. */
      const r = [...items.values()][0];
      wikidata.set(id, {
        entity: r.p || null,
        name: r.pLabel || null,
        /* Only the site wants this, and only for someone it is about to
           put in a roster beside people who have one. Free here: the
           query is already asking this item about itself. */
        img: r.img || null,
        born: day(r.dob),
        precision: Number(r.prec ?? 0),
        died: day(r.dod),
        diedPrecision: Number(r.deathPrec ?? 0),
        deathAsserted: asserted(r.dod),
      });
    }

    /* Pass two — TMDB's own dates, for everyone Wikidata has not buried.
       That is a wider net than "everyone Wikidata has never heard of", and
       the difference is where the errors were living: Robert Amon has a
       Wikidata item with no dates and a TMDB record saying he died in
       November 1992. Wikidata had claimed him, so TMDB was never asked. */
    const unburied = missing.filter(id => wikidata.get(id)?.died == null);
    const fetched = await mapLimit(unburied, 8, async id => {
      if (personCache.has(id)) return [id, personCache.get(id)];
      const p = await tmdb(`/person/${encodeURIComponent(id)}`);
      const rec = p
        /* Through the same normaliser Wikidata's dates go through. TMDB
           publishes whatever an editor typed, and "7-9-1980" travelled
           all the way into a wrap date on El hombre de acero before
           anything looked at it. A date that is not a date is not a
           date, whichever database handed it over. */
        ? { name: p.name || null, born: day(p.birthday), died: day(p.deathday) }
        : null;
      personCache.set(id, rec);
      return [id, rec];
    });
    const tmdbDates = new Map(fetched);

    /* Both records, kept apart rather than merged. Whether two sources
       independently give the same birth year is itself evidence, and
       flattening them into one field throws that away. */
    const people = missing.map(id => ({
      id,
      name: wikidata.get(id)?.name || names.get(id) || id,
      wdEntity: wikidata.get(id)?.entity || null,
      wd: wikidata.get(id) || null,
      tmdb: tmdbDates.get(id) || null,
    }));

    /* Anyone Wikidata or TMDB says was born after the picture came out was
       not on it. Dropped before any of them can vote. */
    const releaseYear = Number(String(year || '').slice(0, 4)) || 0;
    const credible = people.filter(p => !impossible(p, releaseYear));

    /* Pass three — Wikidata again, by name, for anyone still standing. */
    const buried = await deathsByName(
      credible.filter(p => bornYear(p) && statusOf(p, releaseYear) !== 'dead'), sparql);

    /* `alive` carries people, not names. The poster only ever wanted the
       name, but the site has to put a survivor in the list beside everyone
       else — and a name alone cannot be a row. */
    const alive = [];
    let unknown = 0;
    for (const person of credible) {
      if (buried.has(person.id)) continue;   /* Wikidata knows better. */
      const status = statusOf(person, releaseYear);
      if (status === 'alive') {
        alive.push({
          tmdbId: person.id,
          name: person.name,
          born: person.wd?.born || person.tmdb?.born || null,
          wikidata: person.wdEntity || null,
          img: person.wd?.img || null,
          role: billing.get(person.id)?.role || null,
          onScreen: billing.get(person.id)?.onScreen ?? true,
        });
      } else if (status === 'unknown') unknown++;
    }

    /* Asked for by explain.js, so a verdict can be shown with its
       evidence rather than asserted. Off by default: the poster wants an
       answer, and building the working out for six thousand pictures
       nobody will read is waste. It is the SAME array the decision was
       made from — a separate diagnostic path would eventually disagree
       with the real one, which is the mistake this file exists to end. */
    const working = detail
      ? credible.map(p => ({
          name: p.name,
          tmdbId: p.id,
          wikidataId: p.wdEntity,
          /* Kept for everyone judged, not only for survivors. Whether the
             last of a picture's makers was in front of the camera or
             behind it separates the two ways of being last — the child on
             a crowded set, and the producer who was the whole of a
             one-reeler's record — and it was being computed and thrown
             away for the 28% of closers TMDB supplies. */
          role: billing.get(p.id)?.role ?? null,
          onScreen: billing.get(p.id)?.onScreen ?? null,
          status: buried.has(p.id) ? 'dead' : statusOf(p, releaseYear),
          buriedByName: buried.get(p.id) ?? false,
          /* Recorded so a stored verdict can be re-decided later without
             asking anybody again. Precision travels with the date: a
             later pass changing a threshold needs to know whether a year
             was a year or a placeholder. */
          datesAWrap: datesAWrap(p),
          wikidata: p.wd
            ? { born: p.wd.born, precision: p.wd.precision, died: p.wd.died,
                deathAsserted: p.wd.deathAsserted }
            : null,
          tmdb: p.tmdb ? { born: p.tmdb.born, died: p.tmdb.died } : null,
        }))
      : undefined;

    /* How many people TMDB credits at all — the denominator of coverage,
       free here because the credits list is already in hand, and needing
       a second fetch of the same endpoint anywhere else. */
    return {
      alive, unknown, ok: true, tmdbCredited: everyone.length,
      ...(detail ? { working } : {}),
    };
  } catch {
    return { alive: [], unknown: 0, ok: false };
  }
}
