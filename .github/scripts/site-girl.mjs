/**
 * The IRLY Girl page of the website, in English (/girl) and French
 * (/fr/girl): part of getirly.com, same header language, same app links,
 * never a second site. Photos are IRLY's own (site/img/own, used with
 * permission). Everything said here is true of the app today: IRLY Match is
 * announced as coming soon, the iPhone and Android apps as coming soon, and
 * the CTA opens IRLY Girl in the web app.
 * Usage: node .github/scripts/site-girl.mjs <out dir>  (after site-legal)
 */
import fs from 'node:fs';
import path from 'node:path';

const OUT = process.argv[2] || 'dist/site';
const SITE = 'https://getirly.com';
const APP_GIRL = '/app/girl';
const href = (lang) => (lang === 'fr' ? '/fr/girl' : '/girl');
const home = (lang) => (lang === 'fr' ? '/fr/' : '/');
const img = (k) => `/img/own/${k}-1200.jpg`;
const thumb = (k) => `/img/own/${k}-480.jpg`;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const T = {
  en: {
    locale: 'en_US',
    other: 'Français',
    title: 'IRLY Girl — Girlfriends, plans, memories',
    description: 'IRLY Girl is the women-only space of IRLY in Dubai: meet women, join communities just for women, plan brunches, padel, girl trips and more, and chat in private or in groups.',
    open: 'Open IRLY Girl',
    how: 'How it works',
    kicker: 'Women only · Dubai',
    h1a: 'Girlfriends, plans,',
    h1b: 'memories.',
    lead: 'A space to meet women, make new friends and share the moments that matter. Inside IRLY, just for women.',
    webNote: 'Works in your browser today. iPhone and Android apps are coming soon.',
    s1k: 'Communities',
    s1: 'Circles that feel like yours.',
    s1p: 'Join communities just for women: newcomers to Dubai, runners, book lovers, moms, founders. Or start your own in a minute, with its own group chat.',
    s2k: 'Plans',
    s2: 'Plans you make together.',
    s2p: 'Brunch on Saturday, pilates after work, padel, a yacht day, a desert evening, a girl trip to Oman. Pick a day and a time, the plan gets its own chat and lands in your calendar.',
    plans: ['Brunch', 'Coffee & matcha', 'Pilates', 'Padel', 'Run together', 'Beach club', 'Yacht day', 'Desert evening', 'Book club', 'Girl trip'],
    s3k: 'Conversations',
    s3: 'Talk before you meet.',
    s3p: 'Private messages with the women you meet, and a group chat for every community and every plan. Photos included.',
    s4k: 'Girl trips',
    s4: 'Travel to get to know each other.',
    s4p: 'Oman, Abu Dhabi, Bali, Qatar, the desert, a safari, Malaysia, Thailand, Saudi Arabia, or a place you choose. Plan it in IRLY Girl, find who comes along.',
    s5k: 'Coming soon',
    s5: 'IRLY Match.',
    s5p: 'Meet women who share your interests, matched on what you love. It is not open yet: for now, communities and plans are where friendships start.',
    s6k: 'Your safety',
    s6: 'A space that stays women only.',
    s6list: [
      'Access follows the gender on your IRLY account, chosen when the account is created. It cannot be changed afterwards from the app, and IRLY’s servers check it on every women-only page, plan, community and chat.',
      'Your exact location is never shown, only your area.',
      'Block or report anyone. Reports are reviewed by the IRLY team, and an account can lose access to IRLY Girl.',
    ],
    faqT: 'Questions',
    faq: [
      ['Who can join IRLY Girl?', 'Women with an IRLY account. Access is decided by the gender on the account, checked by IRLY’s servers, not only by the app.'],
      ['Is it a dating app?', 'No. IRLY Girl is about friendship and social life between women: communities, plans and conversations.'],
      ['How much does it cost?', 'IRLY Girl is free. Some plans, like a brunch or a class, have a price set by the person who organises them.'],
      ['Where is it available?', 'In Dubai and across the UAE, in your browser on getirly.com. The iPhone and Android apps are coming soon.'],
    ],
    endT: 'Your next girlfriends are already here.',
    endP: 'Sign in with your IRLY account and open IRLY Girl.',
    back: 'Back to IRLY',
    alt: {
      girlsOut: 'Two friends raising their arms on a balcony facing the Burj Khalifa at sunset',
      brunchGirl: 'A brunch table on a terrace above the Dubai Fountain',
      pilatesGirl: 'A woman in a reformer pilates class',
      yachtGirl: 'Two friends toasting at sunset on a boat',
      girlTrip: 'Three friends in the desert at sunset',
      padelGirl: 'Four padel rackets and balls on a blue court',
      readingGirl: 'An open book facing the towers of Dubai Marina',
      drinksGirl: 'Two friends holding iced matcha under palm trees',
      spaGirl: 'Two friends talking in bathrobes facing the Dubai skyline',
    },
  },
  fr: {
    locale: 'fr_FR',
    other: 'English',
    title: 'IRLY Girl — Des copines, des sorties, des souvenirs',
    description: 'IRLY Girl est l’espace réservé aux femmes d’IRLY à Dubaï : rencontrer des femmes, rejoindre des communautés féminines, organiser brunchs, padel, girl trips et plus, et discuter en privé ou en groupe.',
    open: 'Ouvrir IRLY Girl',
    how: 'Comment ça marche',
    kicker: 'Réservé aux femmes · Dubaï',
    h1a: 'Des copines, des sorties,',
    h1b: 'des souvenirs.',
    lead: 'Un espace pour rencontrer des femmes, créer de nouvelles amitiés et partager des moments qui comptent. Dans IRLY, rien que pour les femmes.',
    webNote: 'Fonctionne déjà dans ton navigateur. Les apps iPhone et Android arrivent bientôt.',
    s1k: 'Communautés',
    s1: 'Des cercles qui te ressemblent.',
    s1p: 'Rejoins des communautés réservées aux femmes : nouvelles arrivantes à Dubaï, runneuses, passionnées de lecture, mamans, entrepreneures. Ou crée la tienne en une minute, avec sa conversation de groupe.',
    s2k: 'Sorties',
    s2: 'Des sorties qu’on organise ensemble.',
    s2p: 'Un brunch samedi, un pilates après le travail, du padel, une journée en yacht, une soirée dans le désert, un girl trip à Oman. Choisis le jour et l’heure : la sortie a sa conversation et arrive dans ton calendrier.',
    plans: ['Brunch', 'Café & matcha', 'Pilates', 'Padel', 'Courir ensemble', 'Beach club', 'Journée en yacht', 'Soirée dans le désert', 'Club de lecture', 'Girl trip'],
    s3k: 'Conversations',
    s3: 'Faire connaissance avant de se voir.',
    s3p: 'Des messages privés avec les femmes que tu rencontres, et une conversation de groupe pour chaque communauté et chaque sortie. Photos comprises.',
    s4k: 'Girl trips',
    s4: 'Voyager pour apprendre à se connaître.',
    s4p: 'Oman, Abu Dhabi, Bali, le Qatar, le désert, un safari, la Malaisie, la Thaïlande, l’Arabie saoudite, ou la destination de ton choix. Organise-le dans IRLY Girl et trouve qui t’accompagne.',
    s5k: 'Bientôt disponible',
    s5: 'IRLY Match.',
    s5p: 'Rencontrer des femmes qui partagent tes centres d’intérêt. Ce n’est pas encore ouvert : pour l’instant, les amitiés commencent dans les communautés et les sorties.',
    s6k: 'Ta sécurité',
    s6: 'Un espace qui reste entre femmes.',
    s6list: [
      'L’accès dépend du genre de ton compte IRLY, choisi à sa création. Il ne peut plus être changé depuis l’app, et les serveurs d’IRLY le vérifient sur chaque page, sortie, communauté et conversation réservées aux femmes.',
      'Ta position exacte n’est jamais affichée, seulement ton quartier.',
      'Bloque ou signale n’importe qui. L’équipe IRLY examine les signalements, et un compte peut perdre l’accès à IRLY Girl.',
    ],
    faqT: 'Questions',
    faq: [
      ['Qui peut rejoindre IRLY Girl ?', 'Les femmes qui ont un compte IRLY. L’accès dépend du genre du compte, vérifié par les serveurs d’IRLY, pas seulement par l’app.'],
      ['Est-ce une app de rencontres amoureuses ?', 'Non. IRLY Girl est fait pour l’amitié et la vie sociale entre femmes : communautés, sorties et conversations.'],
      ['Combien ça coûte ?', 'IRLY Girl est gratuit. Certaines sorties, comme un brunch ou un cours, ont un prix fixé par la personne qui les organise.'],
      ['Où est-ce disponible ?', 'À Dubaï et dans tous les Émirats, dans ton navigateur sur getirly.com. Les apps iPhone et Android arrivent bientôt.'],
    ],
    endT: 'Tes prochaines copines sont déjà là.',
    endP: 'Connecte-toi avec ton compte IRLY et ouvre IRLY Girl.',
    back: 'Retour à IRLY',
    alt: {
      girlsOut: 'Deux amies lèvent les bras sur un balcon face à la Burj Khalifa au coucher du soleil',
      brunchGirl: 'Une table de brunch sur une terrasse au-dessus de la fontaine de Dubaï',
      pilatesGirl: 'Une femme pendant un cours de pilates sur reformer',
      yachtGirl: 'Deux amies trinquent au coucher du soleil sur un bateau',
      girlTrip: 'Trois amies dans le désert au coucher du soleil',
      padelGirl: 'Quatre raquettes de padel et des balles sur un court bleu',
      readingGirl: 'Un livre ouvert face aux tours de Dubai Marina',
      drinksGirl: 'Deux amies tiennent des matchas glacés sous les palmiers',
      spaGirl: 'Deux amies discutent en peignoir face aux tours de Dubaï',
    },
  },
};

const CSS = `
:root{--bg:#FFF5F8;--surface:#FFFFFF;--blush:#F8DCE7;--pastel:#F6C5D8;--brand:#E83E87;--rose:#C92F72;--ink:#382832;--soft:#7E6873;--line:rgba(201,47,114,.14);--r:28px;--ease:cubic-bezier(.2,.7,.2,1)}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:400 17px/1.6 "Manrope",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
a{color:inherit}img{display:block;max-width:100%}
.wrap{width:min(1120px,100% - 32px);margin-inline:auto}
.serif{font-family:"Instrument Serif",Georgia,serif;font-weight:400}
.it{font-style:italic}
header.top{position:sticky;top:0;z-index:10;background:rgba(255,245,248,.82);backdrop-filter:saturate(1.4) blur(14px);-webkit-backdrop-filter:saturate(1.4) blur(14px);border-bottom:1px solid var(--line)}
header.top .wrap{display:flex;align-items:center;justify-content:space-between;gap:12px;height:64px}
.logo{display:inline-flex;align-items:center;gap:8px;text-decoration:none}
.logo b{font-weight:800;font-size:13px;letter-spacing:.32em}
.logo i{width:6px;height:6px;border-radius:9px;background:var(--brand)}
.logo span{font:italic 400 28px/1 "Instrument Serif",Georgia,serif;color:var(--brand)}
.tools{display:flex;align-items:center;gap:14px;font-size:14px;font-weight:600}
.tools a{text-decoration:none;color:var(--soft)}
.tools a.btn{color:#fff}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:52px;padding:0 26px;border-radius:999px;background:linear-gradient(135deg,#D63579,#C2296B);color:#fff;font-weight:700;font-size:16px;text-decoration:none;box-shadow:0 12px 30px rgba(201,47,114,.22);transition:transform .25s var(--ease),box-shadow .25s var(--ease)}
.btn:hover{transform:translateY(-2px);box-shadow:0 16px 36px rgba(201,47,114,.28)}.btn:active{transform:scale(.97)}
.btn.small{height:40px;padding:0 18px;font-size:14px;box-shadow:none}
.btn.ghost{background:var(--surface);color:var(--rose);box-shadow:inset 0 0 0 1.5px var(--pastel)}
.hero{padding:56px 0 40px}
.hero .grid{display:grid;grid-template-columns:1.05fr .95fr;gap:48px;align-items:center}
.kicker{font-size:12px;font-weight:800;letter-spacing:.28em;text-transform:uppercase;color:var(--rose)}
h1{font:400 clamp(48px,7.4vw,96px)/.98 "Instrument Serif",Georgia,serif;letter-spacing:-.015em;margin:18px 0 22px}
h1 em{color:var(--brand)}
.lead{font-size:clamp(17px,1.6vw,20px);color:var(--soft);max-width:34ch;margin:0 0 30px}
.ctas{display:flex;flex-wrap:wrap;gap:12px;align-items:center}
.note{font-size:13px;color:var(--soft);margin-top:16px}
.stack{position:relative;aspect-ratio:4/5}
.stack figure{position:absolute;margin:0;border-radius:var(--r);overflow:hidden;box-shadow:0 24px 60px rgba(56,40,50,.16);background:var(--blush)}
.stack figure img{width:100%;height:100%;object-fit:cover}
.stack .a{inset:0 18% 12% 0}.stack .b{width:46%;aspect-ratio:3/4;right:0;bottom:0;transform:rotate(3deg)}
section{padding:72px 0}
.k{font-size:12px;font-weight:800;letter-spacing:.24em;text-transform:uppercase;color:var(--rose);margin:0 0 12px}
h2{font:400 clamp(36px,4.6vw,60px)/1.02 "Instrument Serif",Georgia,serif;letter-spacing:-.01em;margin:0 0 16px}
.p{color:var(--soft);max-width:46ch;margin:0}
.duo{display:grid;grid-template-columns:1fr 1fr;gap:56px;align-items:center}
.duo.flip .media{order:2}
.media{border-radius:var(--r);overflow:hidden;aspect-ratio:4/5;background:var(--blush);box-shadow:0 20px 50px rgba(56,40,50,.12)}
.media img{width:100%;height:100%;object-fit:cover}
.chips{display:flex;flex-wrap:wrap;gap:8px;margin-top:22px;padding:0;list-style:none}
.chips li{padding:9px 15px;border-radius:999px;background:var(--surface);box-shadow:inset 0 0 0 1px var(--line);font-size:14px;font-weight:600}
.mosaic{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-top:34px}
.mosaic figure{margin:0;border-radius:22px;overflow:hidden;aspect-ratio:3/4;background:var(--blush)}
.mosaic figure:nth-child(2n){transform:translateY(28px)}
.mosaic img{width:100%;height:100%;object-fit:cover}
.chat{max-width:420px;background:var(--surface);border-radius:var(--r);padding:22px;box-shadow:0 20px 50px rgba(56,40,50,.10)}
.chat .head{display:flex;align-items:center;gap:10px;font-weight:700;font-size:15px;margin-bottom:14px}
.chat .head img{width:38px;height:38px;border-radius:50%;object-fit:cover}
.chat .head small{display:block;font-weight:500;color:var(--soft);font-size:12px}
.bubble{max-width:80%;padding:10px 14px;border-radius:20px;margin:6px 0;font-size:15px;line-height:1.4}
.bubble.in{background:var(--bg);border-bottom-left-radius:6px}
.bubble.out{background:var(--rose);color:#fff;margin-left:auto;border-bottom-right-radius:6px}
.demo{font-size:12px;color:var(--soft);margin-top:12px}
.soon{background:var(--surface);border-radius:36px;padding:48px;text-align:center;box-shadow:0 20px 50px rgba(56,40,50,.08)}
.soon .badge{display:inline-flex;padding:8px 14px;border-radius:999px;background:var(--rose);color:#fff;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}
.soon h2{margin-top:18px}.soon .p{margin-inline:auto}
.safe{list-style:none;padding:0;margin:24px 0 0;display:grid;gap:14px}
.safe li{display:flex;gap:14px;align-items:flex-start;background:var(--surface);border-radius:20px;padding:18px 20px;box-shadow:inset 0 0 0 1px var(--line)}
.safe li::before{content:"";flex:0 0 10px;height:10px;border-radius:10px;background:var(--brand);margin-top:8px}
.faq details{border-bottom:1px solid var(--line);padding:18px 0}
.faq summary{cursor:pointer;font:400 26px/1.2 "Instrument Serif",Georgia,serif;list-style:none;display:flex;justify-content:space-between;gap:12px}
.faq summary::after{content:"+";font-family:"Manrope";font-weight:600;color:var(--rose);transition:transform .3s var(--ease)}
.faq details[open] summary::after{transform:rotate(45deg)}
.faq p{color:var(--soft);margin:10px 0 0;max-width:62ch}
.end{text-align:center;padding:96px 0 110px}
.end h2{max-width:16ch;margin-inline:auto}
footer{border-top:1px solid var(--line);padding:28px 0 40px;font-size:14px;color:var(--soft)}
footer .wrap{display:flex;flex-wrap:wrap;gap:10px 22px;justify-content:space-between}
footer nav{display:flex;flex-wrap:wrap;gap:8px 18px}footer a{text-decoration:none}
.reveal{opacity:0;transform:translateY(18px);transition:opacity .8s var(--ease),transform .8s var(--ease)}
.reveal.in{opacity:1;transform:none}
.rise{animation:rise .9s var(--ease) both}.rise.d1{animation-delay:.08s}.rise.d2{animation-delay:.16s}.rise.d3{animation-delay:.24s}
@keyframes rise{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.reveal,.rise{opacity:1;transform:none;animation:none;transition:none}.btn{transition:none}}
@media (max-width:860px){.hero .grid,.duo{grid-template-columns:1fr;gap:32px}.duo.flip .media{order:0}.stack{max-width:440px}.mosaic{grid-template-columns:repeat(2,1fr)}section{padding:52px 0}.soon{padding:32px 22px}.tools .how{display:none}}
:focus-visible{outline:3px solid var(--brand);outline-offset:3px;border-radius:8px}
`;

function page(lang) {
  const t = T[lang];
  const other = lang === 'fr' ? 'en' : 'fr';
  const figure = (k, cls = '', lazy = true) => `<figure class="${cls}"><img src="${img(k)}" srcset="${thumb(k)} 480w, ${img(k)} 1200w" sizes="(max-width: 860px) 90vw, 560px" alt="${esc(t.alt[k])}"${lazy ? ' loading="lazy"' : ' fetchpriority="high"'} decoding="async"></figure>`;
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: t.title,
    description: t.description,
    url: SITE + href(lang),
    inLanguage: lang,
    isPartOf: { '@id': `${SITE}/#website` },
    mainEntity: { '@type': 'FAQPage', mainEntity: t.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
  };
  return `<!doctype html>
<html lang="${lang}" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#FFF5F8">
<meta name="color-scheme" content="light">
<title>${esc(t.title)}</title>
<meta name="description" content="${esc(t.description)}">
<link rel="canonical" href="${SITE + href(lang)}">
<link rel="alternate" hreflang="en" href="${SITE + href('en')}">
<link rel="alternate" hreflang="fr" href="${SITE + href('fr')}">
<link rel="alternate" hreflang="x-default" href="${SITE + href('en')}">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.png" type="image/png" sizes="96x96">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="IRLY">
<meta property="og:title" content="${esc(t.title)}">
<meta property="og:description" content="${esc(t.description)}">
<meta property="og:url" content="${SITE + href(lang)}">
<meta property="og:image" content="${SITE + img('girlsOut')}">
<meta property="og:locale" content="${t.locale}">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Manrope:wght@400;500;600;700;800&display=swap">
<link rel="preload" as="image" href="${img('girlsOut')}">
<style>${CSS}</style>
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>
<body>
<header class="top"><div class="wrap">
  <a class="logo notranslate" translate="no" href="${home(lang)}" aria-label="IRLY"><b>IRLY</b><i aria-hidden="true"></i><span>Girl</span></a>
  <div class="tools"><a class="how" href="#how">${t.how}</a><a href="${href(other)}" hreflang="${other}" lang="${other}">${t.other}</a><a class="btn small" href="${APP_GIRL}">${t.open}</a></div>
</div></header>
<main>
<section class="hero"><div class="wrap grid">
  <div>
    <p class="kicker rise">${t.kicker}</p>
    <h1 class="rise d1">${t.h1a} <em class="it">${t.h1b}</em></h1>
    <p class="lead rise d2">${t.lead}</p>
    <div class="ctas rise d3"><a class="btn" href="${APP_GIRL}">${t.open}</a><a class="btn ghost" href="#how">${t.how}</a></div>
    <p class="note rise d3">${t.webNote}</p>
  </div>
  <div class="stack rise d2">${figure('girlsOut', 'a', false)}${figure('brunchGirl', 'b')}</div>
</div></section>

<section id="how"><div class="wrap duo">
  <div class="media reveal"><img src="${img('drinksGirl')}" alt="${esc(t.alt.drinksGirl)}" loading="lazy" decoding="async"></div>
  <div class="reveal"><p class="k">${t.s1k}</p><h2>${t.s1}</h2><p class="p">${t.s1p}</p></div>
</div></section>

<section><div class="wrap">
  <div class="reveal"><p class="k">${t.s2k}</p><h2>${t.s2}</h2><p class="p">${t.s2p}</p>
  <ul class="chips">${t.plans.map((p) => `<li>${esc(p)}</li>`).join('')}</ul></div>
  <div class="mosaic reveal">${['pilatesGirl', 'padelGirl', 'yachtGirl', 'readingGirl'].map((k) => figure(k)).join('')}</div>
</div></section>

<section><div class="wrap duo flip">
  <div class="media reveal"><img src="${img('spaGirl')}" alt="${esc(t.alt.spaGirl)}" loading="lazy" decoding="async"></div>
  <div class="reveal"><p class="k">${t.s3k}</p><h2>${t.s3}</h2><p class="p">${t.s3p}</p></div>
</div></section>

<section><div class="wrap duo">
  <div class="media reveal"><img src="${img('girlTrip')}" alt="${esc(t.alt.girlTrip)}" loading="lazy" decoding="async"></div>
  <div class="reveal"><p class="k">${t.s4k}</p><h2>${t.s4}</h2><p class="p">${t.s4p}</p></div>
</div></section>

<section><div class="wrap"><div class="soon reveal"><span class="badge">${t.s5k}</span><h2>${t.s5}</h2><p class="p">${t.s5p}</p></div></div></section>

<section><div class="wrap"><div class="reveal"><p class="k">${t.s6k}</p><h2>${t.s6}</h2>
  <ul class="safe">${t.s6list.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></div></div></section>

<section class="faq"><div class="wrap"><h2 class="reveal">${t.faqT}</h2>
  ${t.faq.map(([q, a]) => `<details class="reveal"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n  ')}
</div></section>

<section class="end"><div class="wrap reveal"><h2>${t.endT}</h2><p class="p" style="margin:0 auto 28px">${t.endP}</p><a class="btn" href="${APP_GIRL}">${t.open}</a></div></section>
</main>
<footer><div class="wrap">
  <span>© IRLY</span>
  <nav aria-label="Footer"><a href="${home(lang)}">${t.back}</a><a href="${lang === 'fr' ? '/fr/privacy' : '/privacy'}">${lang === 'fr' ? 'Confidentialité' : 'Privacy'}</a><a href="${lang === 'fr' ? '/fr/guidelines' : '/guidelines'}">${lang === 'fr' ? 'Règles de la communauté' : 'Community guidelines'}</a><a href="${lang === 'fr' ? '/fr/support' : '/support'}">${lang === 'fr' ? 'Assistance' : 'Support'}</a></nav>
</div></footer>
<script>
(() => {
  const els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) { els.forEach((e) => e.classList.add('in')); return; }
  const io = new IntersectionObserver((list) => list.forEach((x) => { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }), { rootMargin: '0px 0px -8% 0px' });
  els.forEach((e) => io.observe(e));
})();
</script>
</body>
</html>
`;
}

for (const lang of ['en', 'fr']) {
  const dir = path.join(OUT, href(lang));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), page(lang));
}

const sitemap = path.join(OUT, 'sitemap.xml');
if (fs.existsSync(sitemap)) {
  const today = new Date().toISOString().slice(0, 10);
  const entries = ['en', 'fr'].map(
    (lang) => `  <url>\n    <loc>${SITE + href(lang)}</loc>\n    <lastmod>${today}</lastmod>\n${['en', 'fr'].map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${SITE + href(l)}"/>`).join('\n')}\n    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE + href('en')}"/>\n  </url>`,
  );
  fs.writeFileSync(sitemap, fs.readFileSync(sitemap, 'utf8').replace('</urlset>', `${entries.join('\n')}\n</urlset>`));
}
console.log('site IRLY Girl pages:', href('en'), href('fr'));
