// The back office CRM in the DEMO web build (no server: features/crm/api keeps
// example rows in memory for the session). Journeys in a real browser:
//   A  Back office → CRM: the entry is there, the overview counts the rows
//   B  contacts: list, search, quick filters, create, duplicate warning, edit, archive
//   C  pipeline: move a prospect one stage, the move is in its history
//   D  tasks: create one due today, find it under "Due today", mark it done
//   E  partnership linking a contact, campaign with its UTM link, reports, export
//   F  French: the CRM reads in French
// What the demo cannot show (who may read or write the CRM, persistence on the
// server, the stage log written by the database) is covered by
// supabase/tests/crm.test.sql.
//
//   EXPO_PUBLIC_DEMO=1 npx expo export -p web --clear --output-dir <dir>
//   node scripts/e2e-demo-crm.mjs <dir> [port] [shots dir]
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';

const [dist = 'dist', port = '8744', shots = 'e2e-shots/demo-crm'] = process.argv.slice(2);
const DIST = path.resolve(dist);
fs.mkdirSync(shots, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf' };
const server = http
  .createServer((req, res) => {
    let file = path.join(DIST, decodeURIComponent((req.url ?? '/').split('?')[0]));
    if (!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  })
  .listen(Number(port));
const BASE = `http://localhost:${port}`;

let passed = 0;
const failures = [];
const check = (ok, label) => {
  if (ok) {
    passed++;
    console.log(`ok  ${label}`);
  } else {
    failures.push(label);
    console.log(`FAIL ${label}`);
  }
};

async function open(browser, lang = 'en', width = 390) {
  const ctx = await browser.newContext({ viewport: { width, height: 844 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(`${BASE}/`);
  await page.evaluate((lang) => {
    localStorage.setItem('irly-v2-demo', JSON.stringify({ state: { onboarded: true, storySeen: 99, communityIntroSeen: true, destinationId: 'emirates', cityId: 'dubai', profile: { name: 'Demo', gender: 'woman', age: 29, types: [], interests: ['food'], activities: ['padel'], languages: ['English'], lookingFor: [] } }, version: 1 }));
    localStorage.setItem('irly-lang-demo', JSON.stringify({ state: { setting: lang }, version: 0 }));
    localStorage.setItem('irly-space-demo', JSON.stringify({ state: { space: 'mixte' }, version: 1 }));
  }, lang);
  await page.goto(`${BASE}/admin`);
  await page.waitForTimeout(3000);
  return { ctx, page, errors };
}

// The demo keeps CRM rows in memory: stay in the app (clicks, back) instead of reloading.
// Centred first: the demo's "nothing is saved" banner covers the bottom of the screen.
// On a short screen the last button can sit under it: then the keyboard presses it.
const press = async (loc) => {
  await loc.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  try {
    await loc.click({ timeout: 3000 });
  } catch {
    await loc.focus();
    await loc.press('Enter');
  }
};
const tap = async (page, name, exact = true) => {
  await press(await visible(page.getByRole('button', { name, exact })));
  await page.waitForTimeout(900);
};
const fill = async (page, label, value) => {
  await (await visible(page.getByLabel(label, { exact: true }))).fill(value);
  await page.waitForTimeout(150);
};
const back = async (page) => {
  await page.goBack();
  await page.waitForTimeout(900);
};
// The stack keeps earlier screens mounted (hidden): a text counts only where it is visible.
const has = async (page, text) => {
  const all = page.getByText(text, { exact: false });
  for (let i = 0; i < (await all.count()); i++) if (await all.nth(i).isVisible().catch(() => false)) return true;
  return false;
};
const visible = async (loc) => {
  for (let i = 0; i < (await loc.count()); i++) if (await loc.nth(i).isVisible().catch(() => false)) return loc.nth(i);
  return loc.first();
};
const shot = (page, name) => page.screenshot({ path: path.join(shots, `${name}.png`), fullPage: false });

const executablePath = process.env.PW_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const browser = await chromium.launch({ executablePath });
try {
  const { page, errors } = await open(browser);

  // ───────── A. Entry and overview ─────────
  check(await page.getByRole('button', { name: 'CRM', exact: true }).isVisible(), 'A: the back office lists a CRM entry');
  await tap(page, 'CRM');
  check(page.url().endsWith('/admin/crm'), 'A: it opens /admin/crm');
  check(await has(page, 'Open prospects'), 'A: the overview is shown');
  const prospects = await (await visible(page.getByRole('button', { name: 'Open prospects', exact: true }))).innerText();
  check(/\b3\b/.test(prospects), `A: open prospects counted from the rows (3), read "${prospects.replace(/\s+/g, ' ')}"`);
  const late = await (await visible(page.getByRole('button', { name: 'Late tasks', exact: true }))).innerText();
  check(/\b1\b/.test(late), 'A: one late task (the demo task due two days ago)');
  check(await has(page, 'Needs attention'), 'A: urgent actions are flagged');
  await shot(page, 'a-overview');

  // ───────── B. Contacts ─────────
  await tap(page, 'Contacts and prospects');
  check(await has(page, '5 contacts'), 'B: five current contacts (the archived-free demo set)');
  await (await visible(page.getByLabel('Search contacts'))).fill('founder');
  await page.waitForTimeout(400);
  check(await has(page, '1 contact'), 'B: search narrows the list');
  await (await visible(page.getByLabel('Search contacts'))).fill('');
  await tap(page, 'Follow-up overdue');
  check(await has(page, '1 contact') && (await has(page, 'Demo Creator')), 'B: quick filter "follow-up overdue" finds the overdue contact');
  await tap(page, 'All');
  await shot(page, 'b-contacts');

  await tap(page, 'Add a contact');
  await fill(page, 'First name', 'Nina');
  await fill(page, 'Last name', 'Test');
  await fill(page, 'Professional email', 'creator@example.com');
  await page.waitForTimeout(300);
  check(await has(page, 'Possible duplicate'), 'B: an existing email is flagged as a possible duplicate');
  await tap(page, 'Add the contact');
  check(page.url().endsWith('/admin/crm/contact'), 'B: a possible duplicate is not saved without confirming');
  await fill(page, 'Professional email', 'nina.test@example.com');
  await fill(page, 'Job title', 'Community lead');
  await tap(page, 'Influencer');
  await page.waitForTimeout(300);
  check(await has(page, 'Platforms used'), 'B: influencer fields appear for an influencer');
  await fill(page, 'Platforms used', 'TikTok');
  await tap(page, 'Add the contact');
  await page.waitForTimeout(800);
  check(/\/admin\/crm\/contact\?id=demo-/.test(page.url()), 'B: the new contact is created and opened');
  check(await has(page, 'Pipeline history') && (await has(page, 'Added at stage New prospect')), 'B: its history starts at "New prospect"');
  await fill(page, 'Job title', 'Head of community');
  await tap(page, 'Save');
  check((await (await visible(page.getByLabel('Job title', { exact: true }))).inputValue()) === 'Head of community', 'B: an edit is kept on screen after saving');
  await shot(page, 'b-contact');
  await back(page);
  check(await has(page, '6 contacts') && (await has(page, 'Nina Test')), 'B: the list now has the new contact');

  await press(await visible(page.getByText('Demo Ambassador')));
  await page.waitForTimeout(900);
  await tap(page, 'Archive');
  check(await has(page, '5 contacts') && !(await has(page, 'Demo Ambassador')), 'B: an archived contact leaves the list');
  await tap(page, 'Archived');
  check(await has(page, 'Demo Ambassador'), 'B: and is found under "Archived" (nothing deleted)');
  await tap(page, 'All');

  // ───────── C. Pipeline ─────────
  await back(page);
  await tap(page, 'Sales pipeline');
  check(await has(page, 'New prospect · 2'), 'C: the pipeline shows one column per stage, with counts');
  await shot(page, 'c-pipeline');
  const card = await visible(page.getByRole('button', { name: 'Demo Founder' }));
  await press(card.getByRole('button', { name: 'Move forward one stage' }));
  await page.waitForTimeout(900);
  check((await has(page, 'New prospect · 1')) && (await has(page, 'To qualify · 1')), 'C: moving a card changes its column');
  await press(await visible(page.getByText('Demo Founder')));
  await page.waitForTimeout(900);
  check(await has(page, 'New prospect → To qualify'), 'C: the move is in the contact’s history');
  await back(page);
  await back(page);

  // ───────── D. Tasks ─────────
  await tap(page, 'Tasks and follow-ups');
  await tap(page, 'New task');
  await fill(page, 'What is to be done', 'Call the venue');
  await tap(page, 'Today');
  await tap(page, 'Urgent');
  await tap(page, 'Add the task');
  await tap(page, 'Due today');
  check(await has(page, 'Call the venue'), 'D: the new task is listed under "Due today"');
  await shot(page, 'd-tasks');
  const task = await visible(page.getByRole('button', { name: 'Call the venue' }));
  await press(task.getByRole('button', { name: 'Mark as done' }));
  await page.waitForTimeout(900);
  check(!(await has(page, 'Call the venue')), 'D: a task marked done leaves "Due today"');
  await tap(page, 'Done');
  check(await has(page, 'Call the venue'), 'D: and is found under "Done"');
  await back(page);

  // ───────── E. Partnerships, campaigns, reports, export ─────────
  await tap(page, 'Partnerships');
  await tap(page, 'New partnership');
  await fill(page, 'Title', 'Launch weekend');
  await (await visible(page.getByLabel('Find a contact to link'))).fill('nina');
  await page.waitForTimeout(400);
  await tap(page, '+ Nina Test');
  await fill(page, 'Start date', '2026-11-10');
  await fill(page, 'End date (if any)', '2026-11-01');
  await tap(page, 'Add the partnership');
  check(page.url().endsWith('/admin/crm/partnership'), 'E: a partnership ending before it starts is refused');
  await fill(page, 'End date (if any)', '2026-11-12');
  await tap(page, 'Add the partnership');
  check(/partnership\?id=demo-/.test(page.url()) && (await has(page, 'Nina Test ×')), 'E: the partnership is saved with its contact');
  await back(page);
  await back(page);

  await tap(page, 'Marketing campaigns');
  check(await has(page, '3 signups') && (await has(page, '200 AED per signup')), 'E: tracked signups and cost per signup (600 AED / 3)');
  await tap(page, 'New campaign');
  await fill(page, 'Name', 'Instagram teaser');
  await fill(page, 'utm_source', 'instagram');
  await fill(page, 'utm_campaign', 'bad value');
  await tap(page, 'Add the campaign');
  check(page.url().endsWith('/admin/crm/campaign'), 'E: a UTM value with a space is refused');
  await fill(page, 'utm_campaign', 'teaser-nov');
  check(await has(page, 'https://getirly.com/app/?utm_source=instagram&utm_campaign=teaser-nov'), 'E: the tagged link is built from the UTM fields');
  await tap(page, 'Add the campaign');
  check(/campaign\?id=demo-/.test(page.url()), 'E: the campaign is saved');
  await shot(page, 'e-campaign');
  await back(page);
  await back(page);

  await tap(page, 'Reports');
  check(await has(page, 'Pipeline today') && (await has(page, 'Where new contacts come from')), 'E: reports render');
  await shot(page, 'e-reports');
  await back(page);
  await tap(page, 'Import and export');
  const download = page.waitForEvent('download', { timeout: 5000 }).catch(() => null);
  await tap(page, 'Export the contacts');
  const file = await download;
  const csv = file ? fs.readFileSync(await file.path(), 'utf8') : '';
  check(csv.includes('first_name,last_name') && csv.includes('Nina') && !csv.includes('Demo Ambassador'), 'E: export gives a CSV of current contacts');
  await (await visible(page.getByLabel('CSV content'))).fill('first_name,last_name,email\nOmar,Import,omar@example.com\nNina,Test,nina.test@example.com\n,,\n');
  await page.waitForTimeout(400);
  check(await has(page, '2 lines ready, 1 possible duplicates, 0 refused'), 'E: an import is checked line by line before saving');
  await tap(page, 'Import 1 contact');
  check(await has(page, '1 contact imported'), 'E: only the new contact is imported');

  check(errors.length === 0, `no page errors (${errors.join(' | ') || 'none'})`);
  await page.context().close();

  // ───────── F. French ─────────
  const fr = await open(browser, 'fr');
  await fr.page.getByRole('button', { name: 'CRM', exact: true }).click();
  await fr.page.waitForTimeout(1200);
  check((await has(fr.page, 'Prospects en cours')) && (await has(fr.page, 'Contacts et prospects')) && (await has(fr.page, 'Pipeline commercial')), 'F: the CRM reads in French');
  await fr.page.getByRole('button', { name: 'Pipeline commercial' }).click();
  await fr.page.waitForTimeout(1200);
  check(await has(fr.page, 'Nouveau prospect'), 'F: stage names are French');
  await shot(fr.page, 'f-pipeline-fr');
  check(fr.errors.length === 0, 'F: no page errors');
  await fr.page.context().close();

  // Desktop width: the board and forms stay usable.
  const wide = await open(browser, 'en', 1280);
  await wide.page.getByRole('button', { name: 'CRM', exact: true }).click();
  await wide.page.waitForTimeout(1200);
  await wide.page.getByRole('button', { name: 'Sales pipeline' }).click();
  await wide.page.waitForTimeout(1200);
  const overflow = await wide.page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  check(!overflow, 'desktop: no horizontal page overflow (the board scrolls inside itself)');
  await shot(wide.page, 'g-pipeline-desktop');
  await wide.page.context().close();
} finally {
  await browser.close();
  server.close();
}
console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
