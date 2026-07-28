/* Verifies credentials and posts nothing.
   Run:  BSKY_HANDLE=... BSKY_APP_PASSWORD=... node check.js  */
import { login } from './bluesky.js';
try {
  const s = await login();
  console.log(`OK — signed in as @${s.handle}`);
  console.log(`     did: ${s.did}`);
  console.log('     nothing was posted.');
} catch (err) {
  console.error('FAILED:', err.message);
  process.exit(1);
}
