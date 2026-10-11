/**
 * The website's legal and help pages, in English and French, written as
 * real HTML (public, no sign-in, no download):
 *   /privacy, /terms, /guidelines  the same texts as in the app
 *                                  (src/content/legal.ts), never a second copy;
 *   /support                       help topics and a contact form that stores
 *                                  the request on IRLY's server (contact_support);
 *   /delete-account                how to delete an account, and what is kept.
 * French versions live under /fr/. The pages are added to sitemap.xml.
 * Usage: node .github/scripts/site-legal.mjs <out dir>  (after site-pages)
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const OUT = process.argv[2] || 'dist/site';
const SITE = 'https://getirly.com';
const API = 'https://yqutcmgslwxcmnsqmhvy.supabase.co/rest/v1/rpc/contact_support';
// Publishable key: the server only lets a visitor call contact_support() and join_waitlist().
const KEY = 'sb_publishable_hOfFpr32TkUPj0G880vNgw_fqz2CK0v';

/* ───────── The app's own texts (TypeScript, read with Node's type stripping) ───────── */
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'irly-legal-'));
fs.copyFileSync('src/config/app.ts', path.join(tmp, 'app.ts'));
fs.writeFileSync(path.join(tmp, 'legal.ts'), fs.readFileSync('src/content/legal.ts', 'utf8').replace("'@/config/app'", "'./app.ts'"));
const { APP, LEGAL_REQUIRED } = await import(path.join(tmp, 'app.ts'));
const { LEGAL, LEGAL_FR } = await import(path.join(tmp, 'legal.ts'));

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
/** Text from the legal file: escaped, emails linked, missing legal information shown as such. */
function prose(s, lang) {
  return esc(s)
    .split(esc(LEGAL_REQUIRED))
    .join(`<mark>${lang === 'fr' ? '[INFORMATION JURIDIQUE REQUISE]' : LEGAL_REQUIRED}</mark>`)
    .replace(/([a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,})/gi, '<a href="mailto:$1">$1</a>');
}
const dateFmt = (lang, d) => new Date(`${d}T12:00:00Z`).toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });

const PAGES = ['privacy', 'terms', 'guidelines', 'support', 'delete-account', 'legal-notice'];
const href = (lang, page) => `${lang === 'fr' ? '/fr' : ''}/${page}`;
const homeOf = (lang) => (lang === 'fr' ? '/fr/' : '/');

const UI = {
  en: {
    locale: 'en_US', other: 'Français', home: 'Home', updated: 'Last updated', version: 'Version', contents: 'On this page',
    nav: { privacy: 'Privacy', terms: 'Terms', guidelines: 'Community guidelines', support: 'Support', 'delete-account': 'Delete account', 'legal-notice': 'Legal notice' },
    draft: 'This text describes how IRLY works today. It is being reviewed by a lawyer; parts marked as required are being completed.',
    operator: `IRLY is operated by ${APP.legalEntity} (trade licence ${APP.licence}), ${APP.legalAddress}.`,
    contact: 'Contact',
    tagline: 'Less loneliness. More life.',
  },
  fr: {
    locale: 'fr_FR', other: 'English', home: 'Accueil', updated: 'Dernière mise à jour', version: 'Version', contents: 'Sur cette page',
    nav: { privacy: 'Confidentialité', terms: 'Conditions', guidelines: 'Règles de la communauté', support: 'Assistance', 'delete-account': 'Supprimer son compte', 'legal-notice': 'Mentions légales' },
    draft: 'Ce texte décrit le fonctionnement actuel d’IRLY. Il est en cours de relecture par un juriste ; les parties marquées comme requises sont en cours de complément.',
    operator: `IRLY est exploitée par ${APP.legalEntity} (licence n° ${APP.licence}), ${APP.legalAddressFr}.`,
    contact: 'Contact',
    tagline: 'Moins de solitude. Plus de vie.',
  },
};

const css = `:root{--ink:#050505;--ink2:#0e0e0f;--paper:#f5f5f2;--g1:#c9c9c4;--g2:#8f8f8a;--line:rgba(255,255,255,.12);--live:#ff453a;--ok:#30d158}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
body{margin:0;background:var(--ink);color:var(--paper);font:400 17px/1.7 Manrope,system-ui,-apple-system,Segoe UI,sans-serif;-webkit-font-smoothing:antialiased}
a{color:var(--paper)}a:focus-visible,button:focus-visible,input:focus-visible,select:focus-visible,textarea:focus-visible,summary:focus-visible{outline:2px solid var(--paper);outline-offset:3px}
.skip{position:absolute;left:-9999px}.skip:focus{left:16px;top:12px;background:var(--paper);color:var(--ink);padding:8px 14px;border-radius:999px;z-index:2}
.top{display:flex;align-items:center;justify-content:space-between;gap:16px;max-width:820px;margin:0 auto;padding:20px 20px 0}
.brand{font-weight:800;letter-spacing:.3em;text-decoration:none;font-size:15px}
.lang{font-size:13px;font-weight:700;color:var(--g1);text-decoration:none;border:1px solid var(--line);border-radius:999px;padding:6px 12px}
.tabs{display:flex;gap:6px;flex-wrap:wrap;max-width:820px;margin:18px auto 0;padding:0 20px}
.tabs a{font-size:13px;font-weight:700;color:var(--g1);text-decoration:none;border-radius:999px;padding:7px 12px;background:rgba(255,255,255,.05)}
.tabs a[aria-current]{background:var(--paper);color:var(--ink)}
main{max-width:820px;margin:0 auto;padding:16px 20px 64px}
h1{font-size:clamp(34px,7vw,54px);line-height:1.05;letter-spacing:-.02em;margin:28px 0 12px;font-weight:800}
.meta{font-size:13px;color:var(--g2);margin:0 0 20px}
.lead{font-size:19px;line-height:1.6;color:var(--paper);margin:0 0 12px}
.note{font-size:14px;color:var(--g1);border:1px solid var(--line);border-radius:16px;padding:12px 16px;margin:16px 0 8px}
mark{background:rgba(255,69,58,.16);color:#ff9f97;font-weight:700;padding:0 4px;border-radius:4px}
.toc{font-size:15px;margin:20px 0 8px;padding:16px 20px;border-radius:18px;background:var(--ink2)}.toc p{margin:0 0 6px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--g2)}.toc ol{margin:0;padding-left:20px}.toc a{color:var(--g1)}
h2{font-size:25px;line-height:1.2;letter-spacing:-.01em;margin:44px 0 12px;font-weight:800;scroll-margin-top:16px}
h3{font-size:18px;margin:22px 0 6px;font-weight:700}
p,li{color:var(--g1)}strong{color:var(--paper)}ul,ol{padding-left:22px}li{margin:6px 0}
details{border-bottom:1px solid var(--line);padding:4px 0}summary{cursor:pointer;font-weight:700;color:var(--paper);padding:12px 0;list-style:none;display:flex;justify-content:space-between;gap:12px}summary::-webkit-details-marker{display:none}summary::after{content:"+";color:var(--g2);font-weight:400}details[open] summary::after{content:"–"}details p{margin:0 0 14px}
.card{margin:28px 0 0;padding:24px;border:1px solid var(--line);border-radius:24px;background:rgba(255,255,255,.035)}.card h2{margin:0 0 8px}
.steps{counter-reset:s;list-style:none;padding:0}.steps li{counter-increment:s;position:relative;padding-left:44px;margin:14px 0}.steps li::before{content:counter(s);position:absolute;left:0;top:0;width:30px;height:30px;border-radius:50%;background:var(--paper);color:var(--ink);font-weight:800;font-size:14px;display:grid;place-items:center}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:48px;padding:0 22px;border-radius:999px;background:var(--paper);color:var(--ink);font:800 16px/1 Manrope,system-ui,sans-serif;text-decoration:none;border:0;cursor:pointer}
.btn.ghost{background:transparent;color:var(--paper);border:1px solid var(--line)}
.btn[disabled]{opacity:.6;cursor:progress}
.row{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}
form{display:grid;gap:16px;margin-top:8px}
label{display:grid;gap:6px;font-size:14px;font-weight:700;color:var(--paper)}
input,select,textarea{width:100%;font:400 16px/1.5 Manrope,system-ui,sans-serif;color:var(--paper);background:var(--ink2);border:1px solid var(--line);border-radius:14px;padding:12px 14px}
textarea{min-height:150px;resize:vertical}
select{appearance:none;background-image:linear-gradient(45deg,transparent 50%,var(--g2) 50%),linear-gradient(135deg,var(--g2) 50%,transparent 50%);background-position:calc(100% - 20px) 50%,calc(100% - 15px) 50%;background-size:5px 5px;background-repeat:no-repeat}
[aria-invalid="true"]{border-color:var(--live)}
.hint{font-size:13px;color:var(--g2);font-weight:400}.err{color:#ff9f97;font-size:14px;margin:0;min-height:1em}
.hp{position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden}
.done{display:none;padding:20px;border-radius:18px;background:rgba(48,209,88,.1);border:1px solid rgba(48,209,88,.35)}.done.on{display:block}.done p{color:var(--paper);margin:0}
footer{max-width:820px;margin:0 auto;padding:28px 20px 48px;font-size:13px;color:var(--g2);border-top:1px solid var(--line)}footer a{color:var(--g1)}footer nav{display:flex;flex-wrap:wrap;gap:8px 16px;margin-bottom:12px}footer p{color:var(--g2);margin:6px 0}
@media (prefers-reduced-motion:no-preference){main>*{animation:rise .5s cubic-bezier(.05,.7,.1,1) both}@keyframes rise{from{opacity:0;transform:translateY(10px)}}}`;

function shell({ lang, page, title, description, h1, body, ld }) {
  const u = UI[lang];
  const other = lang === 'fr' ? 'en' : 'fr';
  const url = SITE + href(lang, page);
  const tabs = PAGES.map((p) => `<a href="${href(lang, p)}"${p === page ? ' aria-current="page"' : ''}>${u.nav[p]}</a>`).join('');
  return `<!doctype html>
<html lang="${lang}" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="en" href="${SITE + href('en', page)}">
<link rel="alternate" hreflang="fr" href="${SITE + href('fr', page)}">
<link rel="alternate" hreflang="x-default" href="${SITE + href('en', page)}">
<meta name="theme-color" content="#050505">
<meta name="color-scheme" content="dark">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.png" type="image/png" sizes="96x96">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="IRLY">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="${u.locale}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${SITE}/og.jpg">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700;800&display=swap">
<style>${css}</style>
<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'WebPage', name: title, description, url, inLanguage: lang, isPartOf: { '@id': `${SITE}/#website` }, ...ld },
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: u.home, item: SITE + homeOf(lang) },
        { '@type': 'ListItem', position: 2, name: h1, item: url },
      ] },
    ],
  })}</script>
</head>
<body>
<a class="skip" href="#main">${lang === 'fr' ? 'Aller au contenu' : 'Skip to content'}</a>
<header class="top">
  <a class="brand" href="${homeOf(lang)}" aria-label="IRLY, ${u.home}">IRLY</a>
  <a class="lang" href="${href(other, page)}" hreflang="${other}" lang="${other}">${u.other}</a>
</header>
<nav class="tabs" aria-label="${lang === 'fr' ? 'Pages d’aide et légales' : 'Help and legal pages'}">${tabs}</nav>
<main id="main">
${body}
</main>
<footer>
  <nav aria-label="${lang === 'fr' ? 'Pied de page' : 'Footer'}"><a href="${homeOf(lang)}">IRLY</a>${PAGES.map((p) => `<a href="${href(lang, p)}">${u.nav[p]}</a>`).join('')}<a href="/app/">${lang === 'fr' ? 'IRLY sur le web' : 'IRLY on the web'}</a></nav>
  <p>${esc(u.operator)}</p>
  <p>${u.contact}${lang === 'fr' ? ' : ' : ': '}<a href="mailto:${APP.supportEmail}">${APP.supportEmail}</a> · © 2026 IRLY · ${u.tagline}</p>
</footer>
</body>
</html>
`;
}

function write(lang, page, html) {
  const dir = path.join(OUT, lang === 'fr' ? 'fr' : '', page);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
}

/* ───────── Privacy, Terms, Guidelines ───────── */
const LEGAL_META = {
  privacy: {
    en: ['Privacy Policy | IRLY', 'How IRLY, the app to meet people and find your community, collects, uses, shares and protects your data, how long it is kept and how to exercise your rights.'],
    fr: ['Politique de confidentialité | IRLY', 'Comment IRLY, l’app pour rencontrer du monde et trouver ta communauté, collecte, utilise, partage et protège tes données, combien de temps elles sont gardées et comment exercer tes droits.'],
  },
  terms: {
    en: ['Terms of Use | IRLY', 'The rules for using IRLY: your account, your content, meeting people in real life, moderation, reports and blocks, and how your account can be suspended or deleted.'],
    fr: ['Conditions d’utilisation | IRLY', 'Les règles d’utilisation d’IRLY : ton compte, tes contenus, les rencontres dans la vraie vie, la modération, les signalements et blocages, la suspension et la suppression du compte.'],
  },
  guidelines: {
    en: ['Community Guidelines | IRLY', 'How to be part of IRLY: be real, be respectful, keep everyone safe, no spam or scams. What is not allowed and how to report or block someone.'],
    fr: ['Règles de la communauté | IRLY', 'Comment faire partie d’IRLY : sois vrai, respectueux, protège les autres, pas de spam ni d’arnaque. Ce qui est interdit et comment signaler ou bloquer quelqu’un.'],
  },
};
const slug = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

for (const lang of ['en', 'fr']) {
  for (const doc of ['privacy', 'terms', 'guidelines']) {
    const d = (lang === 'fr' ? LEGAL_FR : LEGAL)[doc];
    const u = UI[lang];
    const [title, description] = LEGAL_META[doc][lang];
    const hasMissing = JSON.stringify(d).includes(LEGAL_REQUIRED);
    const toc = d.sections.map((s) => `<li><a href="#${slug(s.title)}">${esc(s.title)}</a></li>`).join('');
    const extra =
      doc === 'privacy'
        ? lang === 'fr'
          ? `<section><h2 id="contact">Nous contacter</h2><p>Pour toute question ou demande sur tes données (accès, rectification, suppression, opposition) : <a href="mailto:${APP.privacyEmail}">${APP.privacyEmail}</a>, ou le <a href="/fr/support?sujet=privacy">formulaire d’assistance</a>. Pour supprimer ton compte : <a href="/fr/delete-account">voir la procédure</a>.</p></section>`
          : `<section><h2 id="contact">Contact us</h2><p>For any question or request about your data (access, correction, deletion, objection): <a href="mailto:${APP.privacyEmail}">${APP.privacyEmail}</a>, or the <a href="/support?topic=privacy">support form</a>. To delete your account: <a href="/delete-account">see how</a>.</p></section>`
        : '';
    const body = `<h1>${esc(d.title)}</h1>
<p class="meta">${u.version} ${esc(d.version)} · ${u.updated} <time datetime="${d.updated}">${dateFmt(lang, d.updated)}</time></p>
<p class="lead">${prose(d.intro, lang)}</p>
${hasMissing ? `<p class="note">${u.draft}</p>` : ''}
<nav class="toc" aria-label="${u.contents}"><p>${u.contents}</p><ol>${toc}</ol></nav>
${d.sections.map((s) => `<section><h2 id="${slug(s.title)}">${esc(s.title)}</h2>\n${s.body.map((p) => `<p>${prose(p, lang)}</p>`).join('\n')}</section>`).join('\n')}
${extra}`;
    write(lang, doc, shell({ lang, page: doc, title, description, h1: d.title, body, ld: { dateModified: d.updated } }));
  }
}

/* ───────── Support ───────── */
const SUPPORT = {
  en: {
    title: 'Help & Support | IRLY',
    description: 'Get help with IRLY: signing in, your profile, notifications, activities, communities, messages, reporting or blocking someone, deleting your account and your data. Contact the IRLY team.',
    h1: 'Help & support',
    lead: 'Answers to the most common questions, and a form to reach the IRLY team. We read every message.',
    faqT: 'Frequent questions',
    groups: [
      ['Signing in', [
        ['How do I create an account or sign in?', 'Open IRLY, then Profile → “Sign in or create an account”. You can use your email and a password, a sign-in link sent by email, or Apple or Google when they are offered on your device.'],
        ['I forgot my password', 'On the sign-in screen, tap “Forgot password?”. We email you a link to choose a new one. Check your spam folder if it does not arrive within a few minutes.'],
        ['Someone else is using my account', 'Change your password right away in Settings → Security → Sign-in & password, then write to us below with the topic “Safety”.'],
      ]],
      ['Your profile', [
        ['How do I change my photo, name or bio?', 'Settings → My account → Edit profile.'],
        ['Who can see my profile?', 'Settings → Privacy: choose who can find your profile, who sees your IRL moments and the activities you join. Your exact location is never shared: at most your neighbourhood.'],
      ]],
      ['Notifications', [
        ['I don’t receive notifications', 'Check that notifications are allowed for IRLY in your phone settings, then in IRLY: Settings → Notifications → “Notifications on my phone”. You choose which kinds of notifications you get.'],
        ['Can I hide the text of messages in notifications?', 'Yes: Settings → Notifications → turn off “Show message previews”. Notifications then only say who wrote to you.'],
      ]],
      ['Activities and communities', [
        ['How do I join an activity or a community?', 'Open the activity or the community and tap Join. Joining is always your choice; you can leave at any time from the same page.'],
        ['How do I create an activity?', 'Tap Create, choose the activity, the place, the time and the number of spots. A group chat opens for everyone going.'],
      ]],
      ['Messages', [
        ['Someone keeps writing to me', 'Block them from the … menu of their profile or of your chat: once blocked, they can no longer write to you or see you. If the messages are abusive, report them too.'],
        ['Can I delete a message?', 'Yes, long-press your message. Its text is kept privately for moderators for 12 months so that abuse can still be reviewed, then erased.'],
      ]],
      ['Safety', [
        ['How do I report someone or something?', 'Open the profile, the post or the chat and use the … menu or the shield button; in a chat, long-press a message. Choose a reason. The person is never told who reported them. IRLY’s team reviews every report.'],
        ['How do I block someone?', 'Same menu: Block. You no longer see each other anywhere on IRLY, and any connection ends. Your blocked members are in Settings → Privacy → Blocked members.'],
        ['Someone is in danger', 'Call local emergency services first (999 in the UAE, 112 in Indonesia). Then report the profile in the app or write to us with the topic “Safety”.'],
      ]],
      ['Your account and your data', [
        ['How do I delete my account?', 'In the app: Settings → My account → Delete account. All the details are on the <a href="/delete-account">account deletion page</a>.'],
        ['How do I get a copy of my data?', 'Settings → My account → Download my data. For any other request about your data (correction, objection), write to us with the topic “Privacy and my data”, or read the <a href="/privacy">privacy policy</a>.'],
      ]],
      ['Technical problems', [
        ['The app does not load or something does not work', 'Check your connection, update IRLY to the latest version and restart it. If the problem stays, write to us with the topic “Technical problem”: say which screen, what you did and which phone you use.'],
      ]],
    ],
    formT: 'Write to us',
    formLead: 'We answer by email, usually within a few days.',
    email: 'Your email address', emailHint: 'We use it only to answer you.',
    topic: 'Topic', topics: [['account', 'My account or profile'], ['login', 'Signing in'], ['bug', 'Technical problem'], ['safety', 'Safety (report a person or content)'], ['privacy', 'Privacy and my data'], ['delete', 'Delete my account'], ['other', 'Something else']],
    choose: 'Choose a topic',
    message: 'Your message', messageHint: '10 to 2,000 characters. Never send a password.',
    send: 'Send', sending: 'Sending…',
    legal: 'Your message, your email address and the topic are stored by IRLY to answer you, then kept 24 months. See the <a href="/privacy">privacy policy</a>.',
    done: 'Thank you, your message has reached the IRLY team. We will answer you by email.',
    errEmail: 'Enter a valid email address.', errTopic: 'Choose a topic.', errShort: 'Tell us a little more (10 characters at least).', errLong: 'Your message is too long (2,000 characters at most).',
    errBusy: 'You have already sent several messages. Try again in an hour.', errNet: 'Your message could not be sent. Check your connection and try again, or email us at',
    orEmail: 'You can also email us at',
  },
  fr: {
    title: 'Aide et assistance | IRLY',
    description: 'Obtenir de l’aide sur IRLY : connexion, profil, notifications, activités, communautés, messages, signaler ou bloquer quelqu’un, supprimer son compte et ses données. Contacter l’équipe IRLY.',
    h1: 'Aide et assistance',
    lead: 'Les réponses aux questions les plus fréquentes, et un formulaire pour joindre l’équipe IRLY. Chaque message est lu.',
    faqT: 'Questions fréquentes',
    groups: [
      ['Connexion', [
        ['Comment créer un compte ou me connecter ?', 'Ouvre IRLY, puis Profil → « Se connecter ou créer un compte ». Tu peux utiliser ton e-mail et un mot de passe, un lien de connexion envoyé par e-mail, ou Apple ou Google lorsqu’ils sont proposés sur ton appareil.'],
        ['J’ai oublié mon mot de passe', 'Sur l’écran de connexion, touche « Mot de passe oublié ? ». Nous t’envoyons un lien par e-mail pour en choisir un nouveau. Regarde dans tes indésirables s’il n’arrive pas en quelques minutes.'],
        ['Quelqu’un d’autre utilise mon compte', 'Change tout de suite ton mot de passe dans Réglages → Sécurité → Connexion et mot de passe, puis écris-nous ci-dessous avec le sujet « Sécurité ».'],
      ]],
      ['Ton profil', [
        ['Comment changer ma photo, mon prénom ou ma bio ?', 'Réglages → Mon compte → Modifier le profil.'],
        ['Qui peut voir mon profil ?', 'Réglages → Confidentialité : choisis qui peut trouver ton profil, qui voit tes moments IRL et les activités que tu rejoins. Ta position exacte n’est jamais partagée : au plus ton quartier.'],
      ]],
      ['Notifications', [
        ['Je ne reçois pas de notifications', 'Vérifie que les notifications sont autorisées pour IRLY dans les réglages de ton téléphone, puis dans IRLY : Réglages → Notifications → « Notifications sur mon téléphone ». Tu choisis quels types de notifications tu reçois.'],
        ['Puis-je masquer le texte des messages dans les notifications ?', 'Oui : Réglages → Notifications → désactive « Afficher l’aperçu des messages ». Les notifications indiquent alors seulement qui t’a écrit.'],
      ]],
      ['Activités et communautés', [
        ['Comment rejoindre une activité ou une communauté ?', 'Ouvre l’activité ou la communauté et touche Rejoindre. C’est toujours ton choix ; tu peux partir à tout moment depuis la même page.'],
        ['Comment créer une activité ?', 'Touche Créer, choisis l’activité, le lieu, l’heure et le nombre de places. Un chat de groupe s’ouvre pour tous les participants.'],
      ]],
      ['Messages', [
        ['Quelqu’un n’arrête pas de m’écrire', 'Bloque cette personne depuis le menu … de son profil ou de votre chat : une fois bloquée, elle ne peut plus t’écrire ni te voir. Si les messages sont abusifs, signale-les aussi.'],
        ['Puis-je supprimer un message ?', 'Oui, appuie longuement sur ton message. Son texte est conservé à part pour les modérateurs pendant 12 mois, pour pouvoir examiner un abus, puis effacé.'],
      ]],
      ['Sécurité', [
        ['Comment signaler quelqu’un ou un contenu ?', 'Ouvre le profil, la publication ou le chat et utilise le menu … ou le bouton bouclier ; dans un chat, appuie longuement sur un message. Choisis un motif. La personne ne sait jamais qui l’a signalée. L’équipe IRLY examine chaque signalement.'],
        ['Comment bloquer quelqu’un ?', 'Même menu : Bloquer. Vous ne vous voyez plus nulle part sur IRLY et tout lien est rompu. Tes membres bloqués sont dans Réglages → Confidentialité → Membres bloqués.'],
        ['Quelqu’un est en danger', 'Appelle d’abord les secours locaux (999 aux Émirats, 112 en Indonésie). Signale ensuite le profil dans l’app ou écris-nous avec le sujet « Sécurité ».'],
      ]],
      ['Ton compte et tes données', [
        ['Comment supprimer mon compte ?', 'Dans l’app : Réglages → Mon compte → Supprimer le compte. Tous les détails sont sur la <a href="/fr/delete-account">page de suppression du compte</a>.'],
        ['Comment obtenir une copie de mes données ?', 'Réglages → Mon compte → Télécharger mes données. Pour toute autre demande sur tes données (rectification, opposition), écris-nous avec le sujet « Confidentialité et mes données », ou lis la <a href="/fr/privacy">politique de confidentialité</a>.'],
      ]],
      ['Problèmes techniques', [
        ['L’app ne se charge pas ou quelque chose ne marche pas', 'Vérifie ta connexion, mets IRLY à jour et relance-la. Si le problème reste, écris-nous avec le sujet « Problème technique » : précise l’écran, ce que tu as fait et ton modèle de téléphone.'],
      ]],
    ],
    formT: 'Nous écrire',
    formLead: 'Nous répondons par e-mail, en général sous quelques jours.',
    email: 'Ton adresse e-mail', emailHint: 'Elle sert uniquement à te répondre.',
    topic: 'Sujet', topics: [['account', 'Mon compte ou mon profil'], ['login', 'Connexion'], ['bug', 'Problème technique'], ['safety', 'Sécurité (signaler une personne ou un contenu)'], ['privacy', 'Confidentialité et mes données'], ['delete', 'Supprimer mon compte'], ['other', 'Autre chose']],
    choose: 'Choisis un sujet',
    message: 'Ton message', messageHint: '10 à 2 000 caractères. N’envoie jamais de mot de passe.',
    send: 'Envoyer', sending: 'Envoi…',
    legal: 'Ton message, ton adresse e-mail et le sujet sont conservés par IRLY pour te répondre, puis gardés 24 mois. Voir la <a href="/fr/privacy">politique de confidentialité</a>.',
    done: 'Merci, ton message est bien arrivé à l’équipe IRLY. Nous te répondrons par e-mail.',
    errEmail: 'Saisis une adresse e-mail valide.', errTopic: 'Choisis un sujet.', errShort: 'Dis-nous en un peu plus (10 caractères au moins).', errLong: 'Ton message est trop long (2 000 caractères au plus).',
    errBusy: 'Tu as déjà envoyé plusieurs messages. Réessaie dans une heure.', errNet: 'Ton message n’a pas pu partir. Vérifie ta connexion et réessaie, ou écris-nous à',
    orEmail: 'Tu peux aussi nous écrire à',
  },
};

for (const lang of ['en', 'fr']) {
  const s = SUPPORT[lang];
  const faq = s.groups
    .map(([g, qs]) => `<h3>${esc(g)}</h3>\n${qs.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${a}</p></details>`).join('\n')}`)
    .join('\n');
  const strip = (h) => h.replace(/<[^>]+>/g, '');
  const body = `<h1>${s.h1}</h1>
<p class="lead">${s.lead}</p>
<div class="row"><a class="btn ghost" href="#write">${s.formT}</a><a class="btn ghost" href="${href(lang, 'delete-account')}">${UI[lang].nav['delete-account']}</a></div>
<section><h2 id="faq">${s.faqT}</h2>
${faq}
</section>
<section class="card" aria-labelledby="write">
<h2 id="write" tabindex="-1">${s.formT}</h2>
<p>${s.formLead}</p>
<form id="contact" novalidate>
  <label for="email">${s.email} <span class="hint" id="emailHint">${s.emailHint}</span>
    <input id="email" name="email" type="email" autocomplete="email" inputmode="email" maxlength="200" required aria-describedby="emailHint emailErr">
  </label>
  <p class="err" id="emailErr" aria-live="polite"></p>
  <label for="topic">${s.topic}
    <select id="topic" name="topic" required aria-describedby="topicErr"><option value="">${s.choose}</option>${s.topics.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}</select>
  </label>
  <p class="err" id="topicErr" aria-live="polite"></p>
  <label for="message">${s.message} <span class="hint" id="msgHint">${s.messageHint}</span>
    <textarea id="message" name="message" minlength="10" maxlength="2000" required aria-describedby="msgHint msgErr"></textarea>
  </label>
  <p class="err" id="msgErr" aria-live="polite"></p>
  <div class="hp" aria-hidden="true"><label for="website">Website<input id="website" name="website" type="text" tabindex="-1" autocomplete="off"></label></div>
  <p class="hint">${s.legal}</p>
  <div><button class="btn" type="submit" id="send">${s.send}</button></div>
  <p class="err" id="formErr" role="alert"></p>
</form>
<div class="done" id="done" tabindex="-1" role="status"><p>${s.done}</p></div>
<p class="hint">${s.orEmail} <a href="mailto:${APP.supportEmail}">${APP.supportEmail}</a>.</p>
</section>
<script>
(() => {
  const S = ${JSON.stringify({ errEmail: s.errEmail, errTopic: s.errTopic, errShort: s.errShort, errLong: s.errLong, errBusy: s.errBusy, errNet: s.errNet, send: s.send, sending: s.sending, mail: APP.supportEmail, lang })};
  const API = ${JSON.stringify(API)}, KEY = ${JSON.stringify(KEY)};
  const $ = (id) => document.getElementById(id);
  const form = $('contact'), email = $('email'), topic = $('topic'), message = $('message'), send = $('send'), formErr = $('formErr'), done = $('done');
  const EMAIL = /^[^\\s@]+@[^\\s@.]+(\\.[^\\s@.]+)*\\.[^\\s@.]{2,}$/;
  // A link can choose the topic: /support?topic=delete (or ?sujet=).
  const q = new URLSearchParams(location.search);
  const pre = q.get('topic') || q.get('sujet');
  if (pre && [...topic.options].some((o) => o.value === pre)) topic.value = pre;
  const fields = [[email, 'emailErr', () => { const v = email.value.trim(); return !v || v.length > 200 || !EMAIL.test(v) ? S.errEmail : ''; }],
    [topic, 'topicErr', () => (topic.value ? '' : S.errTopic)],
    [message, 'msgErr', () => { const n = message.value.trim().length; return n < 10 ? S.errShort : n > 2000 ? S.errLong : ''; }]];
  const show = (el, errId, text) => { $(errId).textContent = text; if (text) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid'); };
  for (const [el, errId, check] of fields) {
    el.addEventListener('blur', () => { if (el.value) show(el, errId, check()); });
    el.addEventListener('input', () => { if (el.getAttribute('aria-invalid')) show(el, errId, check()); formErr.textContent = ''; });
  }
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (send.disabled) return;
    let first = null;
    for (const [el, errId, check] of fields) { const t = check(); show(el, errId, t); if (t && !first) first = el; }
    if (first) { first.focus(); return; }
    formErr.textContent = '';
    send.disabled = true; send.textContent = S.sending; form.setAttribute('aria-busy', 'true');
    try {
      const r = await fetch(API, { method: 'POST', headers: { 'content-type': 'application/json', apikey: KEY, authorization: 'Bearer ' + KEY },
        body: JSON.stringify({ p_email: email.value.trim(), p_subject: topic.value, p_message: message.value.trim(), p_lang: S.lang, p_website: $('website').value }) });
      const text = await r.text();
      if (!r.ok) {
        if (/invalid email/.test(text)) { show(email, 'emailErr', S.errEmail); email.focus(); return; }
        if (/invalid subject/.test(text)) { show(topic, 'topicErr', S.errTopic); topic.focus(); return; }
        if (/invalid message/.test(text)) { show(message, 'msgErr', S.errShort); message.focus(); return; }
        if (/slow down/.test(text)) { formErr.textContent = S.errBusy; return; }
        throw new Error(String(r.status));
      }
      // Only a real answer from the server shows the confirmation.
      if (!/ok/.test(text)) throw new Error('unexpected answer');
      form.hidden = true;
      done.classList.add('on');
      done.focus();
    } catch (err) {
      formErr.textContent = S.errNet + ' ' + S.mail + '.';
    } finally {
      send.disabled = false; send.textContent = S.send; form.removeAttribute('aria-busy');
    }
  });
})();
</script>`;
  const ld = {
    mainEntity: {
      '@type': 'FAQPage',
      mainEntity: s.groups.flatMap(([, qs]) => qs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: strip(a) } }))),
    },
  };
  write(lang, 'support', shell({ lang, page: 'support', title: s.title, description: s.description, h1: s.h1, body, ld }));
}

/* ───────── Delete account ───────── */
const DELETE = {
  en: {
    title: 'Delete your IRLY account | IRLY',
    description: 'How to delete your IRLY account and your data, from the app on iPhone, Android or the web, what is deleted, what is kept for a limited time and why.',
    h1: 'Delete your IRLY account',
    lead: 'You can delete your account at any time, directly in the app. It takes less than a minute and cannot be undone.',
    inApp: 'In the app (iPhone, Android or web)',
    steps: ['Open IRLY and sign in.', 'Go to <strong>Settings</strong> (the gear in the tab bar).', 'In <strong>My account</strong>, tap <strong>Delete account</strong>.', 'Confirm. Your account is deleted from IRLY’s servers straight away and you are signed out.'],
    webBtn: 'Open IRLY on the web to delete my account',
    webNote: 'You will be asked to sign in first: only you can delete your account. The button opens IRLY’s settings, where Delete account is in My account.',
    tip: 'Before deleting, you can download a copy of your data: Settings → My account → Download my data.',
    noAccess: 'You can no longer sign in?',
    noAccessP: 'Reset your password from the sign-in screen (“Forgot password?”). If that does not work, write to us from the email address of your account with the topic “Delete my account”: we check that the request comes from you before deleting anything.',
    contactBtn: 'Ask for deletion',
    what: 'What is deleted',
    whatP: 'Your profile, photos, professional and IRLY Girl profiles, messages, posts, comments, connections, follows, matches and notifications. Groups and communities you ran are handed to another member when there is one.',
    kept: 'What is kept, and for how long',
    keptL: [
      'Content that was reported to moderators, and the report itself: until the report is handled, then 12 months, unless the law requires longer. Reported photos are deleted with your account.',
      'The text of messages and comments you deleted before: kept privately for moderators for 12 months, then erased.',
      'Messages you sent to IRLY support: 24 months.',
      'Usage events (for example “activity created”, never message text): 13 months, no longer linked to you once your account is deleted.',
    ],
    keptNote: 'These periods come from IRLY’s privacy policy. Read it for the details:',
    privacy: 'privacy policy',
    app: 'The app must also let you delete your account: it does, in Settings → My account → Delete account, on iPhone and Android.',
  },
  fr: {
    title: 'Supprimer son compte IRLY | IRLY',
    description: 'Comment supprimer ton compte IRLY et tes données depuis l’app sur iPhone, Android ou le web, ce qui est supprimé, ce qui est conservé pour une durée limitée et pourquoi.',
    h1: 'Supprimer ton compte IRLY',
    lead: 'Tu peux supprimer ton compte à tout moment, directement dans l’app. Cela prend moins d’une minute et c’est définitif.',
    inApp: 'Dans l’app (iPhone, Android ou web)',
    steps: ['Ouvre IRLY et connecte-toi.', 'Va dans <strong>Réglages</strong> (la roue dentée dans la barre d’onglets).', 'Dans <strong>Mon compte</strong>, touche <strong>Supprimer le compte</strong>.', 'Confirme. Ton compte est supprimé des serveurs d’IRLY immédiatement et tu es déconnecté.'],
    webBtn: 'Ouvrir IRLY sur le web pour supprimer mon compte',
    webNote: 'Il te sera demandé de te connecter d’abord : toi seul peux supprimer ton compte. Le bouton ouvre les réglages d’IRLY, où « Supprimer le compte » se trouve dans Mon compte.',
    tip: 'Avant de supprimer, tu peux télécharger une copie de tes données : Réglages → Mon compte → Télécharger mes données.',
    noAccess: 'Tu ne peux plus te connecter ?',
    noAccessP: 'Réinitialise ton mot de passe depuis l’écran de connexion (« Mot de passe oublié ? »). Si cela ne marche pas, écris-nous depuis l’adresse e-mail de ton compte avec le sujet « Supprimer mon compte » : nous vérifions que la demande vient bien de toi avant toute suppression.',
    contactBtn: 'Demander la suppression',
    what: 'Ce qui est supprimé',
    whatP: 'Ton profil, tes photos, tes profils professionnel et IRLY Girl, tes messages, publications, commentaires, liens d’amitié, abonnements, matchs et notifications. Les groupes et communautés que tu animais sont confiés à un autre membre lorsqu’il y en a un.',
    kept: 'Ce qui est conservé, et combien de temps',
    keptL: [
      'Les contenus signalés aux modérateurs, et le signalement lui-même : jusqu’au traitement du signalement, puis 12 mois, sauf obligation légale plus longue. Les photos signalées sont supprimées avec ton compte.',
      'Le texte des messages et commentaires que tu avais supprimés : conservé à part pour les modérateurs pendant 12 mois, puis effacé.',
      'Les messages envoyés au support IRLY : 24 mois.',
      'Les événements d’utilisation (par exemple « activité créée », jamais le texte des messages) : 13 mois, sans lien avec toi une fois ton compte supprimé.',
    ],
    keptNote: 'Ces durées viennent de la politique de confidentialité d’IRLY. Pour les détails :',
    privacy: 'politique de confidentialité',
    app: 'L’app permet aussi de supprimer ton compte : dans Réglages → Mon compte → Supprimer le compte, sur iPhone et Android.',
  },
};

for (const lang of ['en', 'fr']) {
  const s = DELETE[lang];
  const body = `<h1>${s.h1}</h1>
<p class="lead">${s.lead}</p>
<section class="card"><h2 id="in-app">${s.inApp}</h2>
<ol class="steps">${s.steps.map((x) => `<li>${x}</li>`).join('')}</ol>
<p>${s.tip}</p>
<div class="row"><a class="btn" href="/app/settings">${s.webBtn} <span aria-hidden="true">→</span></a></div>
<p class="hint">${s.webNote}</p>
</section>
<section><h2 id="no-access">${s.noAccess}</h2><p>${s.noAccessP}</p><div class="row"><a class="btn ghost" href="${href(lang, 'support')}?topic=delete#write">${s.contactBtn}</a></div></section>
<section><h2 id="deleted">${s.what}</h2><p>${s.whatP}</p></section>
<section><h2 id="kept">${s.kept}</h2><ul>${s.keptL.map((x) => `<li>${x}</li>`).join('')}</ul><p>${s.keptNote} <a href="${href(lang, 'privacy')}">${s.privacy}</a>.</p><p>${s.app}</p></section>`;
  write(lang, 'delete-account', shell({ lang, page: 'delete-account', title: s.title, description: s.description, h1: s.h1, body, ld: {} }));
}

/* ───────── Legal notice ───────── */
const NOTICE = {
  en: {
    title: 'Legal notice | IRLY', h1: 'Legal notice',
    description: 'Who publishes the IRLY website and app: operating company, licence, representative, contact, hosting and intellectual property.',
    rows: [['Operator', APP.legalEntity], ['Trade licence', APP.licence], ['Represented by', APP.representative], ['Address', APP.legalAddress], ['Email', `<a href="mailto:${APP.supportEmail}">${APP.supportEmail}</a>`], ['Website', '<a href="https://getirly.com">https://getirly.com</a>'], ['App development', APP.developer]],
    hosting: 'Hosting', hostingP: 'The website and the web app are served by Vercel. Accounts, profiles, messages and photos are stored by Supabase, in ' + APP.hosting + '.',
    ip: 'Intellectual property', ipP: 'The IRLY name and logo, its visual identity, interface, texts and other protected elements of the service are subject to the applicable intellectual property rights. Any reproduction, modification or use without permission is prohibited, except where the law allows it. Content posted by members remains subject to the rights of its authors.',
    more: 'See also', missing: 'The legal form shown on the licence, the issuing free zone and the full registered address are being completed from the company documents.',
  },
  fr: {
    title: 'Mentions légales | IRLY', h1: 'Mentions légales',
    description: 'Qui édite le site et l’application IRLY : société exploitante, licence, représentant, contact, hébergement et propriété intellectuelle.',
    rows: [['Exploitant', APP.legalEntity], ['Licence', APP.licence], ['Représentée par', APP.representative], ['Adresse', APP.legalAddressFr], ['E-mail', `<a href="mailto:${APP.supportEmail}">${APP.supportEmail}</a>`], ['Site', '<a href="https://getirly.com">https://getirly.com</a>'], ['Développement de l’application', APP.developer]],
    hosting: 'Hébergement', hostingP: 'Le site et l’application web sont servis par Vercel. Les comptes, profils, messages et photos sont stockés par Supabase, dans l’Union européenne (Irlande), sur Amazon Web Services.',
    ip: 'Propriété intellectuelle', ipP: 'Le nom et le logo IRLY, son identité visuelle, son interface, ses textes et les autres éléments protégés du service sont soumis aux droits de propriété intellectuelle applicables. Toute reproduction, modification ou exploitation non autorisée est interdite, sous réserve des exceptions prévues par la loi. Les contenus publiés par les membres restent soumis aux droits de leurs auteurs.',
    more: 'Voir aussi', missing: 'La forme juridique figurant sur la licence, la zone franche émettrice et l’adresse complète du siège sont en cours de complément à partir des documents de la société.',
  },
};
for (const lang of ['en', 'fr']) {
  const s = NOTICE[lang];
  const body = `<h1>${s.h1}</h1>
<section><table style="width:100%;border-collapse:collapse;font-size:16px">${s.rows.map(([k, v]) => `<tr><th scope="row" style="text-align:left;vertical-align:top;padding:10px 16px 10px 0;color:var(--g2);font-weight:600;border-bottom:1px solid var(--line);width:40%">${k}</th><td style="padding:10px 0;border-bottom:1px solid var(--line)">${v}</td></tr>`).join('')}</table>
<p class="note">${s.missing}</p></section>
<section><h2 id="hosting">${s.hosting}</h2><p>${s.hostingP}</p></section>
<section><h2 id="ip">${s.ip}</h2><p>${s.ipP}</p></section>
<p>${s.more} : <a href="${href(lang, 'privacy')}">${UI[lang].nav.privacy}</a> · <a href="${href(lang, 'terms')}">${UI[lang].nav.terms}</a> · <a href="${href(lang, 'support')}">${UI[lang].nav.support}</a></p>`.replace(`${s.more} : `, lang === 'fr' ? `${s.more} : ` : `${s.more}: `);
  write(lang, 'legal-notice', shell({ lang, page: 'legal-notice', title: s.title, description: s.description, h1: s.h1, body, ld: {} }));
}

/* ───────── Sitemap ───────── */
const sitemap = path.join(OUT, 'sitemap.xml');
if (fs.existsSync(sitemap)) {
  const updated = { privacy: LEGAL.privacy.updated, terms: LEGAL.terms.updated, guidelines: LEGAL.guidelines.updated };
  const today = new Date().toISOString().slice(0, 10);
  const entries = PAGES.flatMap((p) =>
    ['en', 'fr'].map(
      (lang) =>
        `  <url>\n    <loc>${SITE + href(lang, p)}</loc>\n    <lastmod>${updated[p] ?? today}</lastmod>\n${['en', 'fr'].map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${SITE + href(l, p)}"/>`).join('\n')}\n    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE + href('en', p)}"/>\n  </url>`,
    ),
  );
  fs.writeFileSync(sitemap, fs.readFileSync(sitemap, 'utf8').replace('</urlset>', `${entries.join('\n')}\n</urlset>`));
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log('site legal pages:', PAGES.flatMap((p) => [href('en', p), href('fr', p)]).join(', '));
