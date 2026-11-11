/**
 * Over-the-air updates reach only the installed apps whose native fingerprint is the one in
 * .github/runtime-fingerprint.txt (the last build sent to TestFlight). Anything that changes the fingerprint
 * silently cuts them off: a native package, app.json, and also the « scripts » of package.json.
 * This check fails when the fingerprint moved, and says what moved.
 * After a new build on purpose: write the new value in .github/runtime-fingerprint.txt in the same change.
 * Usage: node scripts/check-fingerprint.mjs
 */
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const expected = fs.readFileSync('.github/runtime-fingerprint.txt', 'utf8').trim();
const out = JSON.parse(execFileSync('npx', ['expo-updates', 'fingerprint:generate', '--platform', 'ios'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
if (out.hash === expected) {
  console.log(`native fingerprint unchanged (${expected.slice(0, 8)}…): over-the-air updates still reach the installed apps`);
  process.exit(0);
}
console.error(`✗ the native fingerprint is now ${out.hash}, the installed apps have ${expected}.`);
console.error('  Over-the-air updates from this code would reach no installed app.');
console.error('  Usual causes: a script added to package.json (run the file directly from CI instead), a native package, app.json.');
console.error('  If a new build is intended, put the new value in .github/runtime-fingerprint.txt in the same change.');
process.exit(1);
