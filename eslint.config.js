/* The one check a browser-only, build-step-free file never gets.
   ==========================================================================

   app.js is written for a browser, imported as a native module, and read
   by nothing else before a visitor loads it. `node --check` parses it and
   stops there — which is how `archive.length` survived into production
   on the landing page, three commits after the variable was deleted, and
   was reported to the reader as "Wikidata didn't answer".

   So this is deliberately narrow. It is not a style pass and should never
   become one: no formatting rules, no opinions about how the code reads.
   It answers one question — does every name resolve — plus the handful of
   mistakes that are unambiguously bugs.

     npm run lint

   The two halves get different globals, which is the whole reason for a
   config rather than a flag: app.js may say `document` and must not say
   `process`; the poster is the other way round. */

const shared = {
  'no-undef': 'error',
  'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: '^_' }],
  'no-dupe-keys': 'error',
  'no-unreachable': 'error',
  'no-const-assign': 'error',
  'no-self-assign': 'error',
  'no-constant-condition': ['error', { checkLoops: false }],
};

const browser = {
  document: 'readonly', window: 'readonly', fetch: 'readonly',
  location: 'readonly', navigator: 'readonly', console: 'readonly',
  setTimeout: 'readonly', clearTimeout: 'readonly', URLSearchParams: 'readonly',
  Intl: 'readonly',
};

const node = {
  process: 'readonly', console: 'readonly', fetch: 'readonly',
  setTimeout: 'readonly', clearTimeout: 'readonly', URL: 'readonly',
  URLSearchParams: 'readonly', Buffer: 'readonly', TextEncoder: 'readonly',
  AbortController: 'readonly', WebSocket: 'readonly',
};

export default [
  {
    files: ['app.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: browser },
    rules: shared,
  },
  {
    /* Imported by both halves, so it may assume neither. */
    files: ['shared.js', 'verify.js'],
    languageOptions: {
      ecmaVersion: 2023, sourceType: 'module',
      globals: { fetch: 'readonly', console: 'readonly' },
    },
    rules: shared,
  },
  {
    files: ['poster/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: node },
    rules: shared,
  },
];
