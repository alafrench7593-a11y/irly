/**
 * The IRLY Girl page of the website, in English (/girl) and French
 * (/fr/girl): part of getirly.com (same menu, same app links), never a
 * second site. Its own look (pearl rose, nude and plum, editorial serif,
 * frosted glass), the palette of the app's IRLY Girl theme
 * (src/features/girl/theme.ts). The website stays rose: violet belongs
 * only to IRLY Network inside the app.
 *
 * Honesty rules for this page:
 * - Every person shown is an ILLUSTRATIVE profile (example portraits from
 *   public-photos/faces, Pixabay licence or CC0, the same files the demo build
 *   uses), labelled as such on the page. None is an IRLY member; nothing here
 *   is read from IRLY's database.
 * - A person keeps one name and one photo everywhere on the page.
 * - Photos of people are IRLY's own (site/img/own), women only; IRLY Girl is
 *   shown through friends together (two women, friendship, never romance).
 *   The hero's views of Dubai, without people, are in site/img/hero.
 * - Features are described as they exist today: IRLY Match is coming soon, the
 *   iPhone and Android apps are coming soon (no store link exists), the app
 *   screens are real captures of the demo build (site/shots; the
 *   notifications screen is cut above a row that is not IRLY Girl's, see
 *   site/img/girl). Access follows the gender chosen at sign-up and is
 *   checked by the server; nothing here claims an identity check.
 * Usage: node .github/scripts/site-girl.mjs <out dir>  (after site-legal)
 */
import fs from "node:fs";
import path from "node:path";

const OUT = process.argv[2] || "dist/site";
const SITE = "https://getirly.com";
const APP_GIRL = "/app/girl";
const href = (lang) => (lang === "fr" ? "/fr/girl" : "/girl");
const home = (lang) => (lang === "fr" ? "/fr/" : "/");
const img = (k) => `/img/own/${k}-1200.jpg`;
const thumb = (k) => `/img/own/${k}-480.jpg`;
const face = (id) => `/faces/${id}.jpg`;
const shot = (n) => `/shots/${n}.jpg`;
const og = (lang) => `/img/girl/og-${lang}.jpg`;
// The hero's views of Dubai (site/img/hero, sources in site/img/hero/CREDITS.md), the first one painted first.
const HERO = ["skyline", "arab", "marina", "desert", "creek"];
const heroSet = (k) => `/img/hero/${k}-960.webp 960w, /img/hero/${k}-1920.webp 1920w`;
// The publishable key of IRLY's waitlist (the same one as the home page): the server only lets it call join_waitlist().
const WAITLIST_API = "https://yqutcmgslwxcmnsqmhvy.supabase.co/rest/v1/rpc/join_waitlist";
const WAITLIST_KEY = "sb_publishable_hOfFpr32TkUPj0G880vNgw_fqz2CK0v";
const esc = (s) =>
  String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/* ───────── The illustrative cast: one name, one photo, everywhere ───────── */
// Interests and places are spread evenly, never tied to anyone's origin.
const CAST = [
  ["p-layla", "Layla", "Dubai Marina", ["brunch", "pilates"]],
  ["p-chloe", "Chloé", "JLT", ["padel", "coffee"]],
  ["p-mei", "Mei", "Downtown", ["art", "reading"]],
  ["p-amira", "Amira", "Jumeirah", ["beach", "yoga"]],
  ["p-sofia", "Sofia", "Business Bay", ["running", "brunch"]],
  ["p-nadia", "Nadia", "DIFC", ["networking", "tennis"]],
  ["p-hana", "Hana", "Al Barsha", ["matcha", "museums"]],
  ["p-elena", "Elena", "Palm Jumeirah", ["yacht", "sunsets"]],
  ["p-ayu", "Ayu", "Abu Dhabi", ["hiking", "photography"]],
  ["p-lea", "Léa", "Dubai Marina", ["surf", "travel"]],
  ["p-priya", "Priya", "Jumeirah", ["dance", "coffee"]],
  ["p-mia", "Mia", "Downtown", ["music", "shopping"]],
  ["g-ines", "Inès", "Business Bay", ["padel", "girl trips"]],
  ["g-maya", "Maya", "Al Quoz", ["galleries", "running"]],
  ["g-sofia", "Sofía", "JLT", ["pastry", "brunch"]],
  ["g-amira", "Yara", "DIFC", ["boxing", "skincare"]],
  ["g-lea", "Clara", "Kite Beach", ["yoga", "paddle"]],
  ["g-hana", "Jiwoo", "Palm Jumeirah", ["desert", "matcha"]],
  ["g-chloe", "Camille", "Dubai Marina", ["rooftops", "live music"]],
  ["g-nour", "Nour", "Dubai Hills", ["tennis", "old Dubai"]],
  ["g-elena", "Lucía", "Business Bay", ["pilates", "dinners"]],
  ["g-priya", "Anika", "JLT", ["gym", "chai"]],
  ["g-olga", "Olga", "Jumeirah", ["photo walks", "sunrise"]],
  ["g-zara", "Zara", "Downtown", ["fashion", "brunch"]],
  ["g-ayu", "Kirana", "Sharjah", ["crafts", "reading"]],
  ["g-camille", "Ruby", "Al Barsha", ["book club", "painting"]],
  ["w-salma", "Salma", "Jumeirah", ["coffee", "pottery"]],
  ["w-naomi", "Naomi", "Downtown", ["running", "jazz"]],
  ["w-aisha", "Linh", "Abu Dhabi", ["museums", "brunch"]],
  ["w-lina", "Lina", "JLT", ["dance", "padel"]],
  ["w-giulia", "Emi", "Palm Jumeirah", ["cooking", "sunsets"]],
  ["w-ana", "Ana", "Kite Beach", ["volleyball", "design"]],
  ["w-adaeze", "Minji", "DIFC", ["networking", "gym"]],
  ["w-noor", "Yuna", "Dubai Hills", ["reading", "desert"]],
]
  // Only the portraits that exist (a missing file never shows as a broken image).
  .filter(([id]) => fs.existsSync(`public-photos/faces/${id}.jpg`))
  .map(([id, name, area, likes]) => ({ id, name, area, likes }));
const byId = (id) => CAST.find((c) => c.id === id);

const LIKES_FR = {
  brunch: "brunch",
  pilates: "pilates",
  padel: "padel",
  coffee: "café",
  art: "art",
  reading: "lecture",
  beach: "plage",
  yoga: "yoga",
  running: "course",
  networking: "networking",
  tennis: "tennis",
  matcha: "matcha",
  museums: "musées",
  yacht: "yacht",
  sunsets: "couchers de soleil",
  hiking: "randonnée",
  photography: "photo",
  surf: "surf",
  travel: "voyages",
  dance: "danse",
  music: "musique",
  shopping: "shopping",
  "girl trips": "girl trips",
  galleries: "galeries",
  pastry: "pâtisserie",
  boxing: "boxe",
  skincare: "soins",
  paddle: "paddle",
  desert: "désert",
  rooftops: "rooftops",
  "live music": "concerts",
  "old Dubai": "le vieux Dubaï",
  dinners: "dîners",
  gym: "salle de sport",
  chai: "chai",
  "photo walks": "balades photo",
  sunrise: "lever du soleil",
  fashion: "mode",
  crafts: "artisanat",
  "book club": "club de lecture",
  painting: "peinture",
  "beach club": "beach club",
  pottery: "poterie",
  jazz: "jazz",
  cooking: "cuisine",
  volleyball: "volley",
  design: "design",
};

/* ───────── Small inline icons (stroke, 24 × 24), never the only label ───────── */
const ICON = {
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.7 1.8 1.8.7-1.8.7L19 21l-.7-1.8-1.8-.7 1.8-.7z"/>',
  circles: '<circle cx="9" cy="9" r="5"/><circle cx="15" cy="15" r="5"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.2-8 9-4.6-.8-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  flag: '<path d="M5 21V4"/><path d="M5 4h11l-2 4 2 4H5"/>',
  heart: '<path d="M12 20s-8-4.8-8-10.5A4.5 4.5 0 0 1 12 7a4.5 4.5 0 0 1 8 2.5C20 15.2 12 20 12 20z"/>',
  arrow: '<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>',
  back: '<path d="M19 12H5"/><path d="M11 6l-6 6 6 6"/>',
};
const icon = (k, cls = "ic") => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${ICON[k]}</svg>`;

const T = {
  en: {
    locale: "en_US",
    other: "Français",
    otherLang: "fr",
    title: "IRLY Girl — Meet women and make friends in Dubai",
    description:
      "IRLY Girl is IRLY’s women-only space in Dubai: meet women, make new friends, join women’s communities and activities, plan outings and trips, and chat, in the IRLY app.",
    ogAlt: "IRLY Girl: Your next friendship starts here. Friends at sunset in Dubai.",
    skip: "Skip to content",
    nav: { home: "IRLY", circles: "Communities", app: "The app", how: "How it works", dubai: "Dubai" },
    navLabel: "Main",
    menu: "Menu",
    open: "Open IRLY Girl",
    waitCta: "Get the apps first",
    kicker: "Women only · Dubai",
    h1: ["Your next", "friendship", "starts here."],
    sub: "Meet your girls. Discover your city. Create real connections.",
    lead: "The women-only space inside IRLY: communities, activities, Live and chats, to grow your circle in Dubai.",
    webNote: "Works in your browser today. iPhone and Android apps are coming soon.",
    illustrative: "Illustrative profiles — a preview of the IRLY Girl experience. They are not IRLY members.",
    hero: {
      phonesAlt: "IRLY Girl home screen with the Live now row",
      live: "Live now",
      plan: "Girls brunch in Jumeirah",
      planWhen: "Sat 11:00 · 5/8 going",
      comment: "Welcome girl!! 🥹",
      likes: "brunch · JLT",
      joined: "Joined",
    },
    ticker: ["Brunch", "Padel", "Newcomers", "Networking", "Girl trips", "Pilates", "Book club", "Desert evenings", "Coffee mornings", "Beach days"],
    tourK: "Inside IRLY Girl",
    tourT: "A space that feels like yours.",
    tourP: "Real screens of the app, scene by scene. Use the arrows or swipe.",
    tour: {
      label: "IRLY Girl, scene by scene",
      note: "Screens of the IRLY demo, with example women and conversations. They are not IRLY members.",
      prev: "Previous scene",
      next: "Next scene",
      pause: "Pause",
      play: "Play",
      cta: "Open IRLY Girl",
      scenes: [
        { src: shot("girl-home"), alt: "IRLY Girl home: what’s happening around you, and the women live now", k: "Home & Live", t: "What’s happening around you.", p: "Your city at a glance, and Girl Live: see which women are out right now near you, and join them." },
        { src: shot("girl-communities"), alt: "The IRLY Girl communities, women only", k: "Communities", t: "Five official circles, and more.", p: "IRLY Nouvelle Arrivante, IRLY Girl Networking, IRLY Francophone, IRLY Girl Trip and IRLY Activité, plus the communities women create." },
        { src: shot("girl-group"), alt: "A women-only community with its posts, plans and chat", k: "Inside a community", t: "Posts, plans and a chat.", p: "Each community has its posts, its plans and its group chat. Ask anything, share your tips, meet the girls." },
        { src: shot("girl-post"), alt: "A post and the comments of other women", k: "Conversations", t: "A hello turns into a plan.", p: "Comments, replies and likes, in English or French. A welcome can become a brunch in a few messages." },
        { src: shot("girl-invite"), alt: "An activity: girls brunch in Jumeirah, who’s going", k: "Activities", t: "See who’s going, then go.", p: "Join an activity in one tap. It gets its own group chat and lands in your calendar." },
        { src: shot("girl-chat"), alt: "The group chat of a brunch club", k: "Group chat", t: "Talk it through before you meet.", p: "Private chats, group chats and community chats, so the first meeting already feels familiar." },
        { src: "/img/girl/notifications.jpg", alt: "Notifications: a message, an invitation, a reply", k: "Notifications", t: "Only what helps you meet.", p: "Messages, invitations, replies and new followers, in one place." },
        { src: shot("girl-me"), alt: "Your profile with your interests and upcoming plans", k: "Your profile", t: "Your interests, your plans.", p: "Your profile shows your area, your interests and your upcoming plans. Your exact location is never shown." },
      ],
      bubbles: {
        live: ["Live now", "Layla · live nearby", "Coffee and laptop, anyone around?"],
        circles: ["IRLY Nouvelle Arrivante", "IRLY Girl Networking", "IRLY Francophone", "IRLY Girl Trip", "IRLY Activité"],
        group: ["Yuna · New in Dubai", "Girls, I just landed in Dubai and I’m looking for girls to discover the city with 🩷"],
        comments: [["g-nour", "Welcome girl!! 🥹"], ["g-sofia", "We should organise a girls brunch this weekend!"], ["g-chloe", "I’m in. Saturday?"]],
        invite: ["Sofía invited you to Girls brunch in Jumeirah", "You’re going · 6/8", "Want to meet at the entrance at 10:45?"],
        chat: ["Girls Brunch Club · 6 members", "Added to your calendar · Sat 11:00"],
        notif: ["Yuna sent you a message", "Camille joined Girls brunch"],
        me: ["Startups · Food · Padel", "Your area, never your exact location"],
      },
    },
    circlesK: "Official communities",
    circlesT: "Five circles to start with.",
    circlesP: "IRLY runs five official communities for women. Each has its posts, its activities and its group chat. You can also start your own.",
    womenOnly: "Women only",
    circles: [
      ["IRLY Nouvelle Arrivante", "Just arrived in Dubai? Ask anything, get tips and meet other newcomers.", "newcomerGirl", "👋", "A woman photographing Downtown Dubai at dusk"],
      ["IRLY Girl Networking", "Women in business: entrepreneurship, opportunities, collaborations and your network.", "networkingGirl", "💼", "A pink Dubai book next to a laptop"],
      ["IRLY Francophone", "French-speaking girls in Dubai: chats, meetups and activities in French.", "brunchGirl", "🥐", "A brunch table with sushi and drinks above the Dubai Fountain"],
      ["IRLY Girl Trip", "Trips, excursions, getaways and road trips between girls.", "girlTrip", "✈️", "Friends in scarves celebrating the sunset in the desert"],
      ["IRLY Activité", "Sport, outings, restaurants, beach clubs, shopping, wellness and everything to do together.", "padelGirl", "✨", "Padel rackets on a blue court between friends’ feet"],
    ],
    usesK: "What it’s for",
    usesT: "Everything that’s better with girlfriends.",
    usesP: "Meeting women, finding partners for your activities, going out, travelling, talking: all women-only, in the same IRLY app.",
    uses: [
      ["yachtGirl", "Meet women in Dubai", "Women from everywhere who live here, around the things you love.", "Two friends raising their glasses on a boat at sunset"],
      ["tennisGirl", "Activity partners", "A tennis partner, a running buddy, someone for pilates.", "The shadows of two women holding tennis rackets"],
      ["drinksGirl", "Coffee & outings", "Matcha dates, shopping, beach clubs and nights out, together.", "Two friends in abayas holding matcha drinks"],
      ["girlsOut", "Girl Live", "See which women are out right now near you, and join them.", "Two friends raising their arms facing the Burj Khalifa at sunset"],
      ["desertGirl", "Trips with friends", "Desert evenings, weekends away and road trips between girls.", "Three women watching the sunset in the desert"],
      ["restaurantGirl", "Restaurants & experiences", "New tables to try and experiences to share.", "A rooftop restaurant terrace at night facing the Burj Khalifa"],
      ["spaGirl", "Chats", "Private chats, group chats and community chats.", "Two friends in robes talking by a window over Dubai"],
      ["pilatesGirl", "Sport & wellness", "Pilates, padel, yoga, spa days: better with a friend.", "A woman stretching on a pilates reformer"],
      ["readingGirl", "Book club & workshops", "Book clubs, painting, pottery: plans for curious minds.", "An open book held up in front of Dubai Marina towers"],
    ],
    peopleK: "Discover",
    peopleT: "Women who like what you like.",
    peopleP: "Brunch lovers, padel players, readers, runners, founders, travellers: women from everywhere who live in the UAE.",
    howK: "How it works",
    howT: "Four steps to your new circle.",
    how: [
      ["user", "Sign up as a woman", "Create your IRLY account and choose “woman”. The gender is set at sign-up and can’t be changed afterwards in the app."],
      ["sparkle", "Open IRLY Girl", "From the IRLY app, open IRLY Girl: the same account, with women-only content and its own look."],
      ["circles", "Join your circles", "Pick a community, newcomers, networking, French speakers, trips or activities, and say hello."],
      ["heart", "Meet in real life", "Join an activity, talk in its group chat, and meet your girls for real."],
    ],
    trust: [
      ["shield", "Checked by IRLY’s server", "Women-only communities, activities, Live and chats are refused by the server to accounts not registered as women."],
      ["pin", "Your area, not your spot", "Your exact location is never shown, only your area."],
      ["flag", "Block & report", "Block or report anyone. Reports are reviewed by the IRLY team, and an account can lose access to IRLY Girl."],
    ],
    dubaiK: "Dubai life",
    dubaiT: "Your city, with your girls.",
    dubaiP: "Desert afternoons, rooftop dinners, a golf evening, a day trip to Abu Dhabi: life here is better shared. IRLY Girl helps you find the women to share it with.",
    dubai: [
      ["mosqueGirl", "Abu Dhabi day trips", "A woman in an abaya at the Sheikh Zayed Grand Mosque"],
      ["quadGirl", "Desert afternoons", "A woman in a keffiyeh waving from a red quad bike in the desert"],
      ["golfGirl", "Golf under the lights", "A woman swinging a golf club at a driving range at night"],
      ["dinnerView", "Dinner with a view", "A dinner table with glasses above the Dubai skyline at dusk"],
      ["palmAerial", "The Palm at dusk", "An aerial view of Palm Jumeirah and the Dubai skyline at dusk"],
    ],
    soonK: "Coming soon",
    soonT: "IRLY Match.",
    soonP: "Meet women who share your interests, matched on what you love. It is not open yet: for now, communities and activities are where friendships start.",
    faqT: "Questions",
    faq: [
      ["Who can join IRLY Girl?", "Women with an IRLY account registered as women. Access follows the gender on the account and is checked by IRLY’s server, not only by the app."],
      ["Is it a separate app?", "No. IRLY Girl is a space inside IRLY: the same account and the same app, with women-only communities, activities, Live and chats."],
      ["Are the women on this page members?", "No. They are illustrative profiles that show what IRLY Girl looks like. Real members only appear inside the app, to other members."],
      ["Is it a dating app?", "No. IRLY Girl is about friendship, activities and networking between women."],
      ["How much does it cost?", "IRLY Girl is free. Some activities, like a brunch or a class, have a price set by the person who organises them."],
      ["Where is it available?", "In Dubai and across the UAE, in your browser at getirly.com/app, in English and French. The iPhone and Android apps are coming soon."],
    ],
    endT: ["Your next best friend might be", "one tap away."],
    endP: "Sign in with your IRLY account and open IRLY Girl.",
    wait: {
      t: "Be first on iPhone and Android.",
      p: "IRLY Girl already works in your browser. Leave your email and we’ll tell you when the apps are out.",
      label: "Your email",
      ph: "Email",
      btn: "Notify me",
      legal: "We’ll only use your email to tell you when the IRLY apps launch.",
      done1: "You’re on the list.",
      done2: "We’ll let you know when the apps are out.",
      errEmpty: "Enter your email.",
      errInvalid: "This email doesn’t look right.",
      errBusy: "Lots of sign-ups right now. Try again in a few minutes.",
      errNet: "We couldn’t reach IRLY. Check your connection and try again.",
    },
    back: "Back to IRLY",
    privacy: "Privacy",
    terms: "Terms",
    guidelines: "Community guidelines",
    support: "Support",
    footer: "Footer",
  },
  fr: {
    locale: "fr_FR",
    other: "English",
    otherLang: "en",
    title: "IRLY Girl — Rencontrer des femmes et se faire des amies à Dubaï",
    description:
      "IRLY Girl est l’espace d’IRLY réservé aux femmes à Dubaï : rencontre des femmes, fais-toi de nouvelles amies, rejoins des communautés et des activités entre femmes, organise sorties et voyages, et discute, dans l’app IRLY.",
    ogAlt: "IRLY Girl : Ta prochaine amitié commence ici. Des amies au coucher du soleil à Dubaï.",
    skip: "Aller au contenu",
    nav: { home: "IRLY", circles: "Communautés", app: "L’app", how: "Comment ça marche", dubai: "Dubaï" },
    navLabel: "Principale",
    menu: "Menu",
    open: "Ouvrir IRLY Girl",
    waitCta: "Être prévenue des apps",
    kicker: "Réservé aux femmes · Dubaï",
    h1: ["Ta prochaine", "amitié", "commence ici."],
    sub: "Rencontre tes copines. Découvre ta ville. Crée de vrais liens.",
    lead: "L’espace d’IRLY réservé aux femmes : communautés, activités, Live et conversations, pour agrandir ton cercle à Dubaï.",
    webNote: "Fonctionne déjà dans ton navigateur. Les apps iPhone et Android arrivent bientôt.",
    illustrative: "Profils illustratifs — aperçu de l’expérience IRLY Girl. Ce ne sont pas des membres d’IRLY.",
    hero: {
      phonesAlt: "L’accueil d’IRLY Girl avec la rangée Live",
      live: "En live",
      plan: "Brunch entre filles à Jumeirah",
      planWhen: "sam. 11:00 · 5/8 participent",
      comment: "Bienvenue !! 🥹",
      likes: "brunch · JLT",
      joined: "Membre",
    },
    ticker: ["Brunch", "Padel", "Nouvelles arrivantes", "Networking", "Girl trips", "Pilates", "Club de lecture", "Soirées dans le désert", "Cafés du matin", "Journées plage"],
    tourK: "Dans IRLY Girl",
    tourT: "Un espace qui te ressemble.",
    tourP: "De vrais écrans de l’app, scène par scène. Utilise les flèches ou fais glisser.",
    tour: {
      label: "IRLY Girl, scène par scène",
      note: "Écrans de la démo d’IRLY, avec des femmes et des conversations d’exemple (certaines en anglais). Ce ne sont pas des membres d’IRLY.",
      prev: "Scène précédente",
      next: "Scène suivante",
      pause: "Pause",
      play: "Lecture",
      cta: "Ouvrir IRLY Girl",
      scenes: [
        { src: shot("girl-home"), alt: "L’accueil d’IRLY Girl : ce qui se passe autour de toi, et les femmes en live", k: "Accueil & Live", t: "Ce qui se passe autour de toi.", p: "Ta ville en un coup d’œil, et Girl Live : vois quelles femmes sortent en ce moment près de toi, et rejoins-les." },
        { src: shot("girl-communities"), alt: "Les communautés IRLY Girl, réservées aux femmes", k: "Communautés", t: "Cinq cercles officiels, et plus encore.", p: "IRLY Nouvelle Arrivante, IRLY Girl Networking, IRLY Francophone, IRLY Girl Trip et IRLY Activité, plus les communautés créées par les membres." },
        { src: shot("girl-group"), alt: "Une communauté entre femmes, ses publications, ses plans et son chat", k: "Dans une communauté", t: "Publications, plans et conversation.", p: "Chaque communauté a ses publications, ses plans et sa conversation de groupe. Pose tes questions, partage tes bons plans, rencontre les filles." },
        { src: shot("girl-post"), alt: "Une publication et les commentaires d’autres femmes", k: "Conversations", t: "Un bonjour devient une sortie.", p: "Commentaires, réponses et j’aime, en français ou en anglais. Un mot de bienvenue peut devenir un brunch en quelques messages." },
        { src: shot("girl-invite"), alt: "Une activité : brunch entre filles à Jumeirah, qui vient", k: "Activités", t: "Vois qui vient, puis vas-y.", p: "Rejoins une activité en un geste. Elle a sa conversation de groupe et arrive dans ton calendrier." },
        { src: shot("girl-chat"), alt: "La conversation de groupe d’un club de brunch", k: "Conversation de groupe", t: "Faites connaissance avant de vous voir.", p: "Discussions privées, de groupe et de communauté : la première rencontre a déjà un air familier." },
        { src: "/img/girl/notifications.jpg", alt: "Les notifications : un message, une invitation, une réponse", k: "Notifications", t: "Seulement ce qui aide à se rencontrer.", p: "Messages, invitations, réponses et nouvelles abonnées, au même endroit." },
        { src: shot("girl-me"), alt: "Ton profil avec tes centres d’intérêt et tes prochains plans", k: "Ton profil", t: "Tes envies, tes plans.", p: "Ton profil montre ton quartier, tes centres d’intérêt et tes prochains plans. Ta position exacte n’est jamais affichée." },
      ],
      bubbles: {
        live: ["En live", "Layla · en live près de toi", "Café et ordi, quelqu’un dans le coin ?"],
        circles: ["IRLY Nouvelle Arrivante", "IRLY Girl Networking", "IRLY Francophone", "IRLY Girl Trip", "IRLY Activité"],
        group: ["Yuna · New in Dubai", "Les filles, je viens d’arriver à Dubaï et je cherche des copines pour découvrir la ville 🩷"],
        comments: [["g-nour", "Bienvenue !! 🥹"], ["g-sofia", "On organise un brunch entre filles ce week-end !"], ["g-chloe", "Je viens. Samedi ?"]],
        invite: ["Sofía t’invite au brunch entre filles à Jumeirah", "Tu y vas · 6/8", "On se retrouve à l’entrée à 10h45 ?"],
        chat: ["Girls Brunch Club · 6 membres", "Ajouté à ton calendrier · sam. 11:00"],
        notif: ["Yuna t’a envoyé un message", "Camille a rejoint le brunch"],
        me: ["Startups · Food · Padel", "Ton quartier, jamais ta position exacte"],
      },
    },
    circlesK: "Communautés officielles",
    circlesT: "Cinq cercles pour commencer.",
    circlesP: "IRLY anime cinq communautés officielles pour les femmes. Chacune a ses publications, ses activités et sa conversation de groupe. Tu peux aussi créer la tienne.",
    womenOnly: "Entre femmes",
    circles: [
      ["IRLY Nouvelle Arrivante", "Tu viens d’arriver à Dubaï ? Pose tes questions, récupère des conseils et rencontre d’autres nouvelles.", "newcomerGirl", "👋", "Une femme photographie Downtown Dubai au crépuscule"],
      ["IRLY Girl Networking", "Les femmes dans le business : entrepreneuriat, opportunités, collaborations et réseau.", "networkingGirl", "💼", "Un livre rose sur Dubaï à côté d’un ordinateur portable"],
      ["IRLY Francophone", "Les filles francophones de Dubaï : discussions, rencontres et activités en français.", "brunchGirl", "🥐", "Une table de brunch avec sushis et boissons au-dessus de la fontaine de Dubaï"],
      ["IRLY Girl Trip", "Voyages, excursions, escapades et road trips entre filles.", "girlTrip", "✈️", "Des amies en foulard fêtent le coucher du soleil dans le désert"],
      ["IRLY Activité", "Sport, sorties, restos, beach clubs, shopping, bien-être et tout ce qui se fait à plusieurs.", "padelGirl", "✨", "Des raquettes de padel sur un terrain bleu entre les pieds d’amies"],
    ],
    usesK: "Pour quoi faire",
    usesT: "Tout ce qui est mieux entre copines.",
    usesP: "Rencontrer des femmes, trouver des partenaires d’activité, sortir, voyager, discuter : entre femmes, dans la même app IRLY.",
    uses: [
      ["yachtGirl", "Rencontrer des femmes à Dubaï", "Des femmes venues de partout qui vivent ici, autour de ce que tu aimes.", "Deux amies lèvent leur verre sur un bateau au coucher du soleil"],
      ["tennisGirl", "Partenaires d’activité", "Une partenaire de tennis, une copine de running, quelqu’un pour le pilates.", "Les ombres de deux femmes avec des raquettes de tennis"],
      ["drinksGirl", "Cafés & sorties", "Matcha, shopping, beach clubs et soirées, ensemble.", "Deux amies en abaya tiennent des boissons au matcha"],
      ["girlsOut", "Girl Live", "Vois quelles femmes sortent en ce moment près de toi, et rejoins-les.", "Deux amies lèvent les bras face à la Burj Khalifa au coucher du soleil"],
      ["desertGirl", "Voyages entre amies", "Soirées dans le désert, week-ends et road trips entre filles.", "Trois femmes regardent le coucher du soleil dans le désert"],
      ["restaurantGirl", "Restos & expériences", "De nouvelles tables à tester et des expériences à partager.", "La terrasse d’un restaurant sur un toit, la nuit, face à la Burj Khalifa"],
      ["spaGirl", "Conversations", "Discussions privées, de groupe et de communauté.", "Deux amies en peignoir discutent devant une baie vitrée sur Dubaï"],
      ["pilatesGirl", "Sport & bien-être", "Pilates, padel, yoga, journées spa : mieux à deux.", "Une femme s’étire sur un reformer de pilates"],
      ["readingGirl", "Club de lecture & ateliers", "Clubs de lecture, peinture, poterie : des sorties pour les curieuses.", "Un livre ouvert devant les tours de Dubai Marina"],
    ],
    peopleK: "Découvrir",
    peopleT: "Des femmes qui aiment ce que tu aimes.",
    peopleP: "Amatrices de brunch, joueuses de padel, lectrices, runneuses, entrepreneures, voyageuses : des femmes venues de partout qui vivent aux Émirats.",
    howK: "Comment ça marche",
    howT: "Quatre étapes vers ton nouveau cercle.",
    how: [
      ["user", "Inscris-toi comme femme", "Crée ton compte IRLY et choisis « femme ». Le genre est fixé à l’inscription et ne peut plus être changé ensuite dans l’app."],
      ["sparkle", "Ouvre IRLY Girl", "Depuis l’app IRLY, ouvre IRLY Girl : le même compte, avec du contenu entre femmes et son propre style."],
      ["circles", "Rejoins tes cercles", "Choisis une communauté, nouvelles arrivantes, networking, francophones, voyages ou activités, et dis bonjour."],
      ["heart", "Rencontrez-vous en vrai", "Rejoins une activité, discutez dans sa conversation de groupe, et retrouve tes copines en vrai."],
    ],
    trust: [
      ["shield", "Vérifié par le serveur d’IRLY", "Les communautés, activités, Live et conversations entre femmes sont refusés par le serveur aux comptes qui ne sont pas inscrits comme femmes."],
      ["pin", "Ton quartier, pas ta position", "Ta position exacte n’est jamais affichée, seulement ton quartier."],
      ["flag", "Bloquer & signaler", "Bloque ou signale n’importe qui. L’équipe IRLY examine les signalements, et un compte peut perdre l’accès à IRLY Girl."],
    ],
    dubaiK: "La vie à Dubaï",
    dubaiT: "Ta ville, avec tes copines.",
    dubaiP: "Après-midis dans le désert, dîners sur les toits, soirée golf, escapade à Abu Dhabi : ici, la vie se partage. IRLY Girl t’aide à trouver les femmes avec qui la partager.",
    dubai: [
      ["mosqueGirl", "Escapades à Abu Dhabi", "Une femme en abaya à la grande mosquée Sheikh Zayed"],
      ["quadGirl", "Après-midis dans le désert", "Une femme en keffieh salue depuis un quad rouge dans le désert"],
      ["golfGirl", "Golf sous les projecteurs", "Une femme frappe une balle de golf sur un practice, la nuit"],
      ["dinnerView", "Dîner avec vue", "Une table de dîner avec des verres au-dessus de Dubaï au crépuscule"],
      ["palmAerial", "La Palm au crépuscule", "Vue aérienne de Palm Jumeirah et des tours de Dubaï au crépuscule"],
    ],
    soonK: "Bientôt disponible",
    soonT: "IRLY Match.",
    soonP: "Rencontrer des femmes qui partagent tes centres d’intérêt. Ce n’est pas encore ouvert : pour l’instant, les amitiés commencent dans les communautés et les activités.",
    faqT: "Questions",
    faq: [
      ["Qui peut rejoindre IRLY Girl ?", "Les femmes qui ont un compte IRLY inscrit comme femme. L’accès dépend du genre du compte et il est vérifié par le serveur d’IRLY, pas seulement par l’app."],
      ["Est-ce une app à part ?", "Non. IRLY Girl est un espace dans IRLY : le même compte et la même app, avec des communautés, des activités, un Live et des conversations entre femmes."],
      ["Les femmes de cette page sont-elles membres ?", "Non. Ce sont des profils illustratifs qui montrent à quoi ressemble IRLY Girl. Les vraies membres n’apparaissent que dans l’app, aux autres membres."],
      ["Est-ce une app de rencontres amoureuses ?", "Non. IRLY Girl est fait pour l’amitié, les activités et le networking entre femmes."],
      ["Combien ça coûte ?", "IRLY Girl est gratuit. Certaines activités, comme un brunch ou un cours, ont un prix fixé par la personne qui les organise."],
      ["Où est-ce disponible ?", "À Dubaï et dans tous les Émirats, dans ton navigateur sur getirly.com/app, en français et en anglais. Les apps iPhone et Android arrivent bientôt."],
    ],
    endT: ["Ta future meilleure amie n’est peut-être", "qu’à un clic."],
    endP: "Connecte-toi avec ton compte IRLY et ouvre IRLY Girl.",
    wait: {
      t: "Sois parmi les premières sur iPhone et Android.",
      p: "IRLY Girl marche déjà dans ton navigateur. Laisse ton e-mail et on te prévient à la sortie des apps.",
      label: "Ton e-mail",
      ph: "E-mail",
      btn: "Me prévenir",
      legal: "Ton e-mail sert uniquement à te prévenir de la sortie des apps IRLY.",
      done1: "Tu es sur la liste.",
      done2: "On te prévient dès que les apps sont disponibles.",
      errEmpty: "Indique ton e-mail.",
      errInvalid: "Cet e-mail ne semble pas valide.",
      errBusy: "Beaucoup d’inscriptions en ce moment. Réessaie dans quelques minutes.",
      errNet: "Impossible de joindre IRLY. Vérifie ta connexion et réessaie.",
    },
    back: "Retour à IRLY",
    privacy: "Confidentialité",
    terms: "Conditions",
    guidelines: "Règles de la communauté",
    support: "Assistance",
    footer: "Pied de page",
  },
};

const CSS = `
:root{--bg:#FBF2F4;--pearl:#FFF9FB;--cream:#FCEFF3;--beige:#F8F1EB;--nude:#F2E3DB;--surface:#FFFFFF;--blush:#F6E1E8;--powder:#F3D3DF;--pink:#F6C5D8;--lavender:#F1ECF8;--brand:#E83E87;--rose:#B92B69;--plum:#4A2440;--plum-black:#24121E;--ink:#2F1B29;--soft:#6F5A67;--line:rgba(74,36,64,.10);--glass:rgba(255,249,251,.66);--glass-line:rgba(255,255,255,.8);--shadow:0 16px 36px rgba(122,31,61,.13),0 3px 8px rgba(74,36,64,.06);--shadow-lg:0 40px 90px rgba(122,31,61,.20),0 8px 20px rgba(74,36,64,.08);--ease:cubic-bezier(.2,.7,.2,1);--spring:cubic-bezier(.34,1.4,.5,1);--serif:"Instrument Serif",Georgia,"Times New Roman",serif;--sans:"Manrope",system-ui,-apple-system,"Segoe UI",sans-serif;--gut:16px}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth;scroll-padding-top:84px;overflow-x:clip}
body{margin:0;background:var(--bg);color:var(--ink);font:400 17px/1.6 var(--sans);-webkit-font-smoothing:antialiased;overflow-x:clip}
a{color:inherit}img,svg{display:block;max-width:100%}button,input{font:inherit;color:inherit}
.wrap{width:min(1200px,100% - 2 * var(--gut));margin-inline:auto}
.ic{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;flex:none}
.glass{background:var(--glass);-webkit-backdrop-filter:saturate(1.6) blur(18px);backdrop-filter:saturate(1.6) blur(18px);border:1px solid var(--glass-line);box-shadow:0 1px 0 rgba(255,255,255,.9) inset,var(--shadow)}
.skip{position:fixed;top:10px;left:10px;z-index:60;padding:10px 16px;border-radius:999px;background:var(--rose);color:#fff;font-weight:700;text-decoration:none;transform:translateY(-160px)}.skip:focus{transform:none}
:focus-visible{outline:3px solid var(--rose);outline-offset:3px;border-radius:10px}
/* Scroll progress, a thin rose thread at the very top. */
.progress{position:fixed;inset:0 0 auto;height:3px;z-index:50;background:linear-gradient(90deg,var(--brand),var(--rose));transform-origin:0 50%;transform:scaleX(0);pointer-events:none}
/* Menu: a pearl capsule that firms up once you scroll. */
header.top{position:sticky;top:0;z-index:40;padding:10px var(--gut) 0}
.bar{display:flex;align-items:center;gap:6px;height:58px;padding:0 8px 0 18px;border-radius:999px;width:min(1200px,100%);margin:0 auto;transition:box-shadow .4s var(--ease),background .4s var(--ease),transform .4s var(--ease)}
.scrolled .bar{background:rgba(255,249,251,.86);box-shadow:0 1px 0 rgba(255,255,255,.9) inset,0 14px 34px rgba(122,31,61,.14)}
.logo{display:inline-flex;align-items:center;gap:7px;text-decoration:none;flex:none;padding:6px 0}
.logo b{font-weight:800;font-size:12.5px;letter-spacing:.34em}
.logo i{width:6px;height:6px;border-radius:9px;background:var(--brand)}
.logo span{font:italic 400 27px/1 var(--serif);color:var(--rose)}
.links{display:none;gap:2px;margin-inline-start:auto}
.links a{position:relative;font-size:14px;font-weight:600;color:var(--soft);text-decoration:none;padding:9px 12px;border-radius:999px;transition:color .25s,background .25s}
.links a::after{content:"";position:absolute;left:14px;right:14px;bottom:5px;height:1.5px;border-radius:2px;background:var(--rose);transform:scaleX(0);transform-origin:0 50%;transition:transform .35s var(--ease)}
.links a:hover{color:var(--ink)}.links a:hover::after{transform:scaleX(1)}
.links a[aria-current="page"]{color:var(--rose);background:rgba(232,62,135,.10)}
.lang{margin-inline-start:auto;font-size:13px;font-weight:700;color:var(--soft);text-decoration:none;padding:12px 10px;border-radius:999px;transition:background .25s}
.lang:hover{background:rgba(185,43,105,.08)}
.bar .btn.small{display:none}
.menu-btn{width:44px;height:44px;border-radius:22px;border:0;background:rgba(185,43,105,.09);cursor:pointer;display:grid;place-items:center;align-content:center;transition:background .25s,transform .2s var(--ease)}
.menu-btn:active{transform:scale(.92)}
.menu-btn span{display:block;width:18px;height:2px;border-radius:2px;background:var(--ink);transition:transform .35s var(--ease)}
.menu-btn span+span{margin-top:5px}
.open .menu-btn span:first-child{transform:translateY(3.5px) rotate(45deg)}.open .menu-btn span:last-child{transform:translateY(-3.5px) rotate(-45deg)}
.sheet{position:fixed;inset:0;z-index:35;background:radial-gradient(80% 60% at 80% 10%,rgba(246,197,216,.7),transparent 70%),rgba(255,246,248,.96);-webkit-backdrop-filter:blur(22px);backdrop-filter:blur(22px);display:grid;align-content:center;gap:2px;padding:100px 28px 40px;opacity:0;visibility:hidden;transition:opacity .35s var(--ease),visibility 0s .35s}
.sheet a{font:400 clamp(36px,10vw,52px)/1.15 var(--serif);text-decoration:none;justify-self:start;transform:translateY(18px);opacity:0;transition:transform .5s var(--ease),opacity .5s var(--ease)}
.sheet a[aria-current="page"]{color:var(--rose);font-style:italic}
.sheet a.btn{font:700 16px/1 var(--sans);margin-top:24px}
.open+.sheet{opacity:1;visibility:visible;transition:opacity .35s var(--ease),visibility 0s}.open+.sheet a{transform:none;opacity:1}
${Array.from({ length: 9 }, (_, i) => `.open+.sheet a:nth-child(${i + 1}){transition-delay:${(0.05 + i * 0.045).toFixed(3)}s}`).join("")}
/* Buttons: rose gradient, a nacre glint on hover, a press you can feel. */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;min-height:52px;padding:0 26px;border-radius:999px;border:0;cursor:pointer;background:linear-gradient(135deg,#D63A7E,#B92B69 55%,#9E2358);color:#fff;font-weight:700;font-size:16px;text-decoration:none;box-shadow:0 14px 32px rgba(185,43,105,.28),0 1px 0 rgba(255,255,255,.35) inset;transition:transform .3s var(--ease),box-shadow .3s var(--ease);position:relative;overflow:hidden;isolation:isolate;white-space:nowrap}
.btn::after{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(110deg,transparent 30%,rgba(255,255,255,.38) 50%,transparent 70%);transform:translateX(-120%);transition:transform .9s var(--ease)}
.btn:hover{transform:translateY(-2px);box-shadow:0 20px 40px rgba(185,43,105,.34),0 1px 0 rgba(255,255,255,.35) inset}.btn:hover::after{transform:translateX(120%)}.btn:active{transform:translateY(0) scale(.96);transition-duration:.1s}
.btn .ic{width:18px;height:18px;transition:transform .3s var(--ease)}.btn:hover .ic{transform:translateX(3px)}
.btn.small{min-height:42px;padding:0 18px;font-size:14px;box-shadow:0 8px 18px rgba(185,43,105,.22)}
.btn.ghost{background:rgba(255,255,255,.72);color:var(--rose);box-shadow:inset 0 0 0 1.5px rgba(185,43,105,.28),0 8px 22px rgba(122,31,61,.08);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
.btn.ghost:hover{box-shadow:inset 0 0 0 1.5px rgba(185,43,105,.5),0 14px 30px rgba(122,31,61,.12)}
.tlink{display:inline-flex;align-items:center;gap:8px;font-weight:700;color:var(--rose);text-decoration:none;min-height:44px}
.tlink .ic{width:18px;height:18px;transition:transform .3s var(--ease)}.tlink:hover .ic{transform:translateX(-3px)}
/* Type */
.k{display:inline-flex;align-items:center;gap:10px;font-size:12px;font-weight:800;letter-spacing:.24em;text-transform:uppercase;color:var(--rose);margin:0 0 14px}
.k::before{content:"";width:22px;height:1.5px;background:currentColor;border-radius:2px}
h2{font:400 clamp(38px,6vw,72px)/1.02 var(--serif);letter-spacing:-.012em;margin:0 0 16px;text-wrap:balance}
h2 em,h1 em{font-style:italic;color:var(--rose)}
h3{font:400 26px/1.1 var(--serif);margin:0 0 8px}
.p{color:var(--soft);max-width:56ch;margin:0}
.head{display:grid;gap:8px;margin-bottom:34px}
.head.center{text-align:center;justify-items:center}.head.center .p{margin-inline:auto}
section{position:relative;padding:72px 0;scroll-margin-top:76px}
.label{display:inline-flex;align-items:center;gap:8px;font-size:12.5px;line-height:1.4;color:var(--soft);padding:7px 12px;border-radius:14px;background:rgba(255,255,255,.72);border:1px solid var(--line);max-width:100%}
.label::before{content:"";flex:none;width:6px;height:6px;border-radius:6px;background:var(--rose)}
/* ───────── Hero ───────── */
.hero{min-height:calc(100svh - 68px);display:grid;align-items:center;padding:28px 0 48px;isolation:isolate}
/* Hero: views of Dubai in a slow crossfade with a gentle Ken Burns drift, under a pearl-rose veil so the dark text keeps its contrast. */
.hvid{position:absolute;inset:-80px 0 -40px;z-index:-2;overflow:hidden;pointer-events:none;background:var(--bg)}
.hvid .sl{position:absolute;inset:0;opacity:0;transition:opacity 2.4s cubic-bezier(.65,0,.35,1)}
.hvid .sl.on{opacity:1}
.hvid img{width:100%;height:100%;object-fit:cover;object-position:50% 40%;transform:scale(1.04);filter:saturate(.9)}
.hvid .sl.kb img{animation:kb 17s linear both}
.hvid .sl:nth-child(even).kb img{animation-name:kb-b}
.hvid.paused img{animation-play-state:paused!important}
.hvid::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(251,242,244,.78) 0%,rgba(251,242,244,.62) 45%,rgba(251,242,244,.9) 88%,#FBF2F4 100%)}
.aura{position:absolute;inset:-80px 0 -40px;z-index:-1;overflow:hidden;pointer-events:none}
.aura i{position:absolute;border-radius:50%;opacity:.9;animation:drift 18s ease-in-out infinite alternate}
.aura i:nth-child(1){width:70vmax;height:70vmax;left:30%;top:-30vmax;background:radial-gradient(closest-side,rgba(246,197,216,.85),transparent)}
.aura i:nth-child(2){width:55vmax;height:55vmax;left:-20vmax;top:10%;background:radial-gradient(closest-side,rgba(242,227,219,.95),transparent);animation-duration:22s;animation-direction:alternate-reverse}
.aura i:nth-child(3){width:45vmax;height:45vmax;right:-15vmax;bottom:-10vmax;background:radial-gradient(closest-side,rgba(241,236,248,.95),transparent);animation-duration:26s}
.hgrid{display:grid;gap:34px;align-items:center}
.hcopy{min-width:0}
.mark{display:inline-flex;align-items:center;gap:10px;padding:9px 18px 9px 16px;border-radius:999px;margin-bottom:22px}
.mark b{font-weight:800;font-size:13px;letter-spacing:.36em;animation:rise .6s var(--ease) both}
.mark i{width:7px;height:7px;border-radius:9px;background:var(--brand);box-shadow:0 0 0 0 rgba(232,62,135,.5);animation:pop .5s var(--spring) .15s both,pulse 2.8s ease-out 1s infinite}
.mark span{font:italic 400 30px/1 var(--serif);color:var(--rose);display:inline-block;animation:rise .7s var(--ease) .2s both}
.mark small{font-size:12px;font-weight:700;color:var(--soft);padding-inline-start:12px;margin-inline-start:4px;border-inline-start:1px solid var(--line);letter-spacing:.02em}
h1{font:400 clamp(52px,12.5vw,112px)/.95 var(--serif);letter-spacing:-.02em;margin:0 0 20px;text-wrap:balance}
h1 .ln{display:block}
h1 .w{display:inline-block;animation:word .7s var(--ease) both}
.sub{font:italic 400 clamp(22px,3.2vw,30px)/1.25 var(--serif);color:var(--plum);margin:0 0 14px;max-width:30ch;animation:rise .7s var(--ease) .3s both}
.lead{font-size:clamp(16px,1.5vw,18px);color:var(--soft);max-width:44ch;margin:0 0 28px;animation:rise .7s var(--ease) .38s both}
.ctas{display:flex;flex-wrap:wrap;gap:12px;align-items:center;animation:rise .7s var(--ease) .45s both}
.note{font-size:13px;color:var(--soft);margin:14px 0 0}
/* The phone constellation: three real screens, glass cards around them. */
.hstage{position:relative;width:min(560px,100%);margin-inline:auto;aspect-ratio:560/620;container-type:inline-size;animation:rise .9s var(--ease) .1s both}
.tilt{position:absolute;inset:0;transition:transform .8s var(--ease);transform-style:preserve-3d}
.par{position:absolute;will-change:transform}
.phone{position:relative;border-radius:7.4cqw;padding:1.5cqw;background:linear-gradient(150deg,#fff,#F7E6EC 60%,#fff);box-shadow:var(--shadow-lg),0 0 0 1px rgba(185,43,105,.08)}
.phone .scr{border-radius:6cqw;overflow:hidden;background:var(--blush);aspect-ratio:390/844}
.phone img{width:100%;height:100%;object-fit:cover;object-position:top}
.ph-main{left:27%;top:2%;width:46%;z-index:3}
.ph-l{left:1%;top:15%;width:36%;z-index:1}.ph-l .phone{transform:rotate(-9deg)}
.ph-r{right:1%;top:17%;width:36%;z-index:2}.ph-r .phone{transform:rotate(8deg)}
.ph-l .phone,.ph-r .phone{border-radius:5.8cqw;padding:1.2cqw}
.ph-l .scr,.ph-r .scr{border-radius:4.7cqw}
.chip{position:absolute;z-index:5;max-width:100%;display:flex;align-items:center;gap:2.2cqw;padding:1.6cqw 3.4cqw 1.6cqw 1.6cqw;border-radius:999px;font-size:clamp(11px,2.6cqw,14px);line-height:1.25;font-weight:700;white-space:nowrap}
.chip img{width:clamp(28px,7.4cqw,40px);height:clamp(28px,7.4cqw,40px);border-radius:50%;object-fit:cover;background:var(--blush);flex:none}
.chip small{display:block;font-weight:600;color:var(--soft);font-size:.86em}
.chip .fl{animation:bob 6s ease-in-out infinite}
.c-live{left:-1%;top:9%}.c-plan{right:0;top:61%;border-radius:22px;padding-inline-end:3.4cqw}.c-plan img{border-radius:14px;width:clamp(36px,10cqw,52px);height:clamp(36px,10cqw,52px)}
.c-com{left:0;top:66%;border-radius:20px 20px 20px 6px}.c-prof{right:-1%;top:5%}
.c-heart{right:20%;bottom:3%;color:var(--rose);padding:1.6cqw 3.4cqw}
.dot{width:8px;height:8px;border-radius:8px;background:#E5352B;flex:none;box-shadow:0 0 0 0 rgba(229,53,43,.45);animation:pulse 2.2s ease-out infinite}
.stack{display:flex}.stack img{width:clamp(22px,5.6cqw,30px);height:clamp(22px,5.6cqw,30px);border:2px solid #fff;margin-inline-start:-1.6cqw}.stack img:first-child{margin:0}
.c-live{padding:1.6cqw 1.8cqw 1.6cqw 3.4cqw}
.hlabel{margin-top:14px;display:flex;justify-content:center}
/* Ticker */
.ticker{overflow:hidden;padding:18px 0;border-block:1px solid var(--line);background:rgba(255,255,255,.45);-webkit-mask:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent);mask:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)}
.ticker ul{display:flex;width:max-content;margin:0;padding:0;list-style:none;animation:slide 40s linear infinite}
.ticker li{font:italic 400 clamp(24px,3.4vw,38px)/1 var(--serif);color:var(--plum);padding:0 22px;display:flex;align-items:center;gap:44px;white-space:nowrap}
.ticker li::after{content:"";width:7px;height:7px;border-radius:7px;background:var(--brand);margin-inline-start:22px}
/* ───────── Tour: the app, scene by scene ───────── */
.tour{background:linear-gradient(180deg,transparent,rgba(246,225,232,.55) 30%,rgba(246,225,232,.55) 70%,transparent)}
.tgrid{display:grid;gap:22px;align-items:center}
.tstage{position:relative;height:540px;display:grid;place-items:center;touch-action:pan-y;user-select:none;-webkit-user-select:none}
.tstage::before{content:"";position:absolute;width:min(440px,96%);aspect-ratio:1;border-radius:50%;background:radial-gradient(closest-side,rgba(246,197,216,.9),rgba(246,197,216,0));z-index:-1}
.tphone{position:relative;width:236px;aspect-ratio:390/844;border-radius:38px;padding:8px;background:linear-gradient(150deg,#fff,#F7E6EC 60%,#fff);box-shadow:var(--shadow-lg),0 0 0 1px rgba(185,43,105,.08)}
.tphone .scr{position:absolute;inset:8px;border-radius:31px;overflow:hidden;background:var(--blush)}
.tphone img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:top;opacity:0;transform:scale(1.04);transition:opacity .7s var(--ease),transform 1.1s var(--ease)}
.tphone img.on{opacity:1;transform:none}
.tlayer{position:absolute;inset:0;pointer-events:none}
.tlayer>div{position:absolute;inset:0;visibility:hidden}
.tlayer>div.on{visibility:visible}
.tb{position:absolute;display:flex;align-items:center;gap:10px;max-width:min(250px,58%);padding:9px 13px;border-radius:20px;font-size:13px;line-height:1.35;font-weight:600;color:var(--ink);opacity:0;transform:translateY(16px) scale(.96);transition:opacity .55s var(--ease),transform .7s var(--spring);transition-delay:calc(var(--i,0) * .3s + .25s)}
.on>.tb,.on>.tcol>.tb{opacity:1;transform:none}
.tb img{width:32px;height:32px;border-radius:50%;object-fit:cover;flex:none;background:var(--blush)}
.tb small{display:block;font-size:11.5px;font-weight:700;color:var(--rose)}
.tb.pill{border-radius:999px;padding:8px 14px}
.tb.pink{background:linear-gradient(135deg,#D63A7E,#B92B69);color:#fff;border:0;box-shadow:0 10px 24px rgba(185,43,105,.3)}
.tb .heart{color:var(--rose);font-weight:800;white-space:nowrap}
.p1{left:0;top:9%}.p2{right:0;top:30%}.p3{left:0;top:56%}.p4{right:0;bottom:8%}
.tcol{position:absolute;right:0;top:12%;display:grid;gap:8px;justify-items:end}.tcol .tb{position:static;max-width:none}
.tcopy{min-width:0;text-align:center}
.tslides{display:grid}
.tslide{grid-area:1/1;opacity:0;visibility:hidden;transform:translateY(14px);transition:opacity .45s var(--ease),transform .55s var(--ease),visibility 0s .55s}
.tslide.on{opacity:1;visibility:visible;transform:none;transition:opacity .6s var(--ease) .08s,transform .7s var(--ease) .08s,visibility 0s}
.tslide .kk{font-size:12px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:var(--rose);margin:0 0 8px}
.tslide h3{font-size:clamp(30px,4vw,46px);line-height:1.04;margin:0 0 12px;text-wrap:balance}
.tslide .p{margin-inline:auto;max-width:44ch}
.tslide .btn{margin-top:20px}
.tctrl{display:flex;align-items:center;gap:8px;margin:24px auto 0;max-width:460px}
.tctrl>button{flex:none;width:44px;height:44px;border-radius:22px;border:0;background:var(--surface);color:var(--ink);box-shadow:0 6px 16px rgba(122,31,61,.10);cursor:pointer;display:grid;place-items:center;transition:transform .2s var(--ease),box-shadow .2s}
.tctrl>button .ic{width:18px;height:18px}
.tctrl>button:hover{transform:translateY(-1px);box-shadow:0 10px 22px rgba(122,31,61,.14)}.tctrl>button:active{transform:scale(.92)}
.tdots{display:flex;gap:5px;flex:1;min-width:0}
.tdots button{flex:1;height:44px;min-width:0;border:0;background:none;padding:0;cursor:pointer;display:grid;align-items:center}
.tdots button span{display:block;height:4px;border-radius:4px;background:rgba(185,43,105,.16);overflow:hidden}
.tdots button span i{display:block;height:100%;width:100%;background:var(--rose);border-radius:4px;transform:scaleX(0);transform-origin:0 50%}
.tdots button.done span i{transform:none}
.tdots button.on span i{transform:scaleX(var(--p,0))}
.tour .fine{font-size:12.5px;color:var(--soft);margin:18px auto 0;max-width:52ch}
/* ───────── Communities ───────── */
.circles{display:grid;gap:14px}
.circle{position:relative;margin:0;border-radius:28px;overflow:hidden;min-height:300px;display:flex;align-items:flex-end;color:#fff;background:var(--plum);box-shadow:var(--shadow);isolation:isolate;transition:transform .5s var(--ease),box-shadow .5s var(--ease)}
.circle img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-2;transition:transform 1.2s var(--ease)}
.circle::before{content:"";position:absolute;inset:0;z-index:-1;background:linear-gradient(180deg,rgba(36,18,30,0) 30%,rgba(36,18,30,.5) 60%,rgba(36,18,30,.86))}
@media (hover:hover){.circle:hover{transform:translateY(-6px);box-shadow:var(--shadow-lg)}.circle:hover img{transform:scale(1.06)}}
.circle .em{position:absolute;top:16px;left:16px;width:46px;height:46px;border-radius:50%;display:grid;place-items:center;font-size:22px;background:rgba(255,249,251,.9);box-shadow:0 6px 16px rgba(36,18,30,.2);transition:transform .5s var(--spring)}
@media (hover:hover){.circle:hover .em{transform:rotate(-10deg) scale(1.08)}}
.circle .tag{position:absolute;top:22px;right:16px;font-size:11.5px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;padding:7px 11px;border-radius:999px;background:rgba(36,18,30,.55);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px);color:#FFF6FA}
.circle .tx{padding:22px}
.circle h3{font-size:clamp(27px,3vw,34px);margin:0 0 6px;color:#FFF6FA}
.circle p{margin:0;color:rgba(255,246,250,.92);font-size:15px;max-width:44ch}
/* ───────── Uses: an editorial bento ───────── */
.uses{display:grid;gap:14px}
.use{position:relative;margin:0;border-radius:26px;overflow:hidden;background:var(--surface);box-shadow:var(--shadow);display:grid;grid-template-rows:auto 1fr;transition:transform .5s var(--ease),box-shadow .5s var(--ease)}
.use .ph{aspect-ratio:4/3;overflow:hidden;background:var(--blush)}
.use .ph img{width:100%;height:100%;object-fit:cover;transition:transform 1.2s var(--ease)}
@media (hover:hover){.use:hover{transform:translateY(-5px);box-shadow:var(--shadow-lg)}.use:hover .ph img{transform:scale(1.06)}}
.use .tx{padding:16px 20px 20px;display:grid;grid-template-columns:1fr auto;gap:4px 12px;align-items:start;align-content:start}
.use h3{margin:0}
.use p{grid-column:1/-1;margin:0;color:var(--soft);font-size:15px}
.use .n{font:italic 400 20px/1 var(--serif);color:var(--rose);padding-top:6px}
/* ───────── Discover: two slow rivers of illustrative profiles ───────── */
.people{display:grid;gap:14px;overflow:hidden;-webkit-mask:linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent);mask:linear-gradient(90deg,transparent,#000 6%,#000 94%,transparent);padding:8px 0 14px}
.river{display:flex;gap:14px;width:max-content;animation:slide 70s linear infinite}
.river.rev{animation-direction:reverse;animation-duration:80s}
.people:hover .river{animation-play-state:paused}
.pc{display:flex;align-items:center;gap:12px;padding:10px 18px 10px 10px;border-radius:999px;margin:0;flex:none}
.pc img{width:56px;height:56px;border-radius:50%;object-fit:cover;background:var(--blush)}
.pc b{display:block;font:400 22px/1.05 var(--serif)}
.pc span{display:block;font-size:12.5px;color:var(--soft)}
.pc .tags{display:flex;gap:4px;margin-top:4px}
.pc .tags i{font-style:normal;font-size:11px;font-weight:700;color:var(--rose);background:rgba(232,62,135,.10);padding:3px 8px;border-radius:999px}
.people-foot{display:flex;justify-content:center;margin-top:14px}
/* ───────── How it works ───────── */
.how-sec{background:linear-gradient(180deg,transparent,var(--beige) 20%,var(--cream) 80%,transparent)}
.steps{list-style:none;padding:0;margin:0;display:grid;gap:16px;position:relative}
.steps::before{content:"";position:absolute;left:31px;top:30px;bottom:30px;width:2px;background:linear-gradient(180deg,var(--brand),var(--rose));border-radius:2px;transform-origin:50% 0;transform:scaleY(var(--line,1));transition:transform 1.6s var(--ease)}
.steps li{position:relative;display:grid;grid-template-columns:64px 1fr;gap:16px;align-items:start;padding:4px 0}
.steps .n{position:relative;width:64px;height:64px;border-radius:50%;display:grid;place-items:center;color:var(--rose);background:var(--pearl);box-shadow:0 0 0 6px var(--bg),var(--shadow)}
.steps .n .ic{width:26px;height:26px}
.steps .n small{position:absolute;top:-4px;right:-4px;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:var(--plum);color:#FFF6FA;font:700 12px/1 var(--sans)}
.steps .card{padding:18px 20px;border-radius:22px}
.steps h3{margin:0 0 6px}
.steps p{margin:0;color:var(--soft);font-size:15px}
.trust{display:grid;gap:12px;margin-top:40px}
.trust li{display:flex;gap:14px;align-items:flex-start;padding:18px 20px;border-radius:22px;background:var(--plum);color:#FFF6FA;box-shadow:0 18px 40px rgba(74,36,64,.22)}
.trust li .ic{color:var(--pink);margin-top:2px}
.trust b{display:block;font:400 22px/1.15 var(--serif);margin-bottom:4px}
.trust p{margin:0;color:rgba(255,246,250,.86);font-size:14.5px}
.trust{list-style:none;padding:0}
/* ───────── Dubai life ───────── */
.dubai{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
.dph{position:relative;margin:0;border-radius:24px;overflow:hidden;background:var(--blush);aspect-ratio:3/4;box-shadow:var(--shadow)}
.dph .dpi{position:absolute;inset:-12% 0;will-change:transform}
.dph img{width:100%;height:100%;object-fit:cover;transition:transform 1.2s var(--ease)}
@media (hover:hover){.dph:hover img{transform:scale(1.05)}}
.dph figcaption{position:absolute;left:10px;bottom:10px;right:10px;padding:8px 12px;border-radius:14px;font-size:13px;font-weight:700;line-height:1.3;width:max-content;max-width:calc(100% - 20px)}
.dph.wide{grid-column:1/-1;aspect-ratio:16/9}
/* ───────── IRLY Match, coming soon: the plum panel ───────── */
.soon{position:relative;overflow:hidden;border-radius:34px;padding:44px 24px;text-align:center;background:linear-gradient(150deg,#55294A,#3A1A31 55%,#24121E);color:#FFF6FA;box-shadow:0 30px 70px rgba(74,36,64,.3);isolation:isolate}
.soon::before{content:"";position:absolute;width:520px;height:520px;left:50%;top:-260px;margin-left:-260px;border-radius:50%;background:radial-gradient(closest-side,rgba(241,91,154,.45),transparent);z-index:-1;animation:breathe 7s ease-in-out infinite}
.soon .badge{display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border-radius:999px;background:rgba(255,246,250,.12);border:1px solid rgba(255,246,250,.25);color:#FFF6FA;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}
.soon h2{margin:18px 0 12px}.soon .p{margin-inline:auto;color:rgba(255,246,250,.86)}
/* ───────── FAQ ───────── */
.faq details{border-bottom:1px solid var(--line)}
.faq summary{cursor:pointer;font:400 clamp(22px,2.4vw,27px)/1.2 var(--serif);list-style:none;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:20px 0;min-height:44px}
.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:"+";flex:none;width:34px;height:34px;border-radius:50%;display:grid;place-items:center;font:600 20px/1 var(--sans);color:var(--rose);background:rgba(185,43,105,.08);transition:transform .35s var(--ease),background .25s}
.faq summary:hover::after{background:rgba(185,43,105,.14)}
.faq details[open] summary::after{transform:rotate(45deg)}
.faq details p{color:var(--soft);margin:0 0 22px;max-width:64ch;animation:rise .45s var(--ease) both}
.faq .wrap{max-width:860px}
/* ───────── Finale ───────── */
.end{padding:40px 0 90px}
.endcard{position:relative;overflow:hidden;border-radius:38px;padding:56px 22px 40px;text-align:center;isolation:isolate;background:linear-gradient(160deg,#FFF9FB,#F6E1E8 55%,#F2E3DB)}
.endcard .aura{inset:0}
.endcard .faces{display:flex;justify-content:center;margin-bottom:22px}
.endcard .faces img{width:48px;height:48px;border-radius:50%;object-fit:cover;border:3px solid var(--pearl);margin-inline-start:-12px;background:var(--blush)}
.endcard .faces img:first-child{margin:0}
.endcard h2{max-width:17ch;margin-inline:auto}
.endcard .ctas{justify-content:center;margin-top:26px;animation:none}
.endcard>.p{margin-inline:auto}
.wl{margin:40px auto 0;max-width:540px;padding:24px 20px;border-radius:26px;text-align:left}
.wl h3{font-size:clamp(24px,2.6vw,30px);margin:0 0 6px}
.wl>p{margin:0 0 16px;color:var(--soft);font-size:15px}
.field{display:flex;gap:8px;padding:6px;border-radius:999px;background:var(--surface);box-shadow:inset 0 0 0 1.5px rgba(185,43,105,.18);transition:box-shadow .25s}
.field:focus-within{box-shadow:inset 0 0 0 2px var(--rose),0 0 0 5px rgba(232,62,135,.12)}
.field.bad{box-shadow:inset 0 0 0 2px #8E1F45;animation:shake .4s var(--ease)}
.field input{flex:1;min-width:0;border:0;background:none;padding:0 14px;font-size:16px;outline:none;color:var(--ink)}
.field input::placeholder{color:#8C7684}
.field .btn{min-height:46px;padding:0 20px;font-size:15px}
.hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}
.msgline{min-height:22px;margin:10px 4px 0;font-size:14px;color:#8E1F45;font-weight:600}
.legal{font-size:12.5px;color:var(--soft);margin:4px 4px 0}.legal a{color:var(--rose);display:inline-block;padding:6px 0}
.wl.loading .btn{opacity:.8;pointer-events:none}
.wl .spin{display:none;width:16px;height:16px;border-radius:50%;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;animation:spin .8s linear infinite}
.wl.loading .spin{display:inline-block}
@keyframes spin{to{transform:rotate(360deg)}}
.done{display:none;align-items:center;gap:14px}
.done.on{display:flex;animation:rise .5s var(--ease) both}
.done .tick{width:46px;height:46px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#D63A7E,#9E2358);color:#fff;flex:none}
.done b{font:400 24px/1.1 var(--serif);display:block}.done p{margin:2px 0 0;color:var(--soft);font-size:14px}
.backlink{margin-top:26px;display:flex;justify-content:center}
footer{border-top:1px solid var(--line);padding:28px 0 40px;font-size:14px;color:var(--soft)}
footer .wrap{display:flex;flex-wrap:wrap;gap:12px 22px;justify-content:space-between;align-items:center}
footer nav{display:flex;flex-wrap:wrap;gap:4px 6px}footer a{text-decoration:none;display:inline-block;padding:10px 8px}footer a:hover{color:var(--rose)}
.flogo{display:inline-flex;align-items:center;gap:6px}.flogo b{font-weight:800;font-size:11px;letter-spacing:.3em;color:var(--ink)}.flogo i{width:5px;height:5px;border-radius:5px;background:var(--brand)}.flogo span{font:italic 400 22px/1 var(--serif);color:var(--rose)}
img.missing{opacity:0}
/* ───────── Motion: one vocabulary, delays vary by position so cards never move in lockstep ───────── */
.js .reveal{opacity:0;transform:translateY(26px) scale(.985);transition:opacity .9s var(--ease),transform .9s var(--ease);transition-delay:var(--d,0s)}
.js .reveal.in{opacity:1;transform:none}
.js .reveal.zoom{transform:scale(.94)}.js .reveal.zoom.in{transform:none}
@media (hover:hover){.js .reveal.circle.in:hover,.js .reveal.use.in:hover{transform:translateY(-5px);transition-delay:0s}}
/* Photos arrive softly instead of popping in (only those still loading when the page runs). */
.js img.fade{opacity:0;transition:opacity .9s var(--ease),transform 1.2s var(--ease)}.js img.fade.ok{opacity:1}
.js .steps:not(.in){--line:0}
@keyframes rise{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
@keyframes word{from{opacity:0;transform:translateY(.35em) rotate(2deg)}to{opacity:1;transform:none}}
@keyframes pop{from{opacity:0;transform:scale(.3)}to{opacity:1;transform:none}}
@keyframes pulse{0%{box-shadow:0 0 0 0 rgba(232,62,135,.45)}80%,100%{box-shadow:0 0 0 10px rgba(232,62,135,0)}}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
@keyframes drift{from{transform:translate3d(0,0,0) scale(1)}to{transform:translate3d(6vmax,4vmax,0) scale(1.12)}}
@keyframes slide{to{transform:translateX(-50%)}}
@keyframes kb{from{transform:scale(1.04) translate3d(0,0,0)}to{transform:scale(1.14) translate3d(-1.6%,-1.2%,0)}}
@keyframes kb-b{from{transform:scale(1.14) translate3d(1.4%,-1%,0)}to{transform:scale(1.04) translate3d(0,0,0)}}
@keyframes breathe{0%,100%{transform:scale(1);opacity:.8}50%{transform:scale(1.15);opacity:1}}
@keyframes shake{0%,100%{transform:none}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
.chip{animation:float-in .8s var(--spring) both,bob 7s ease-in-out infinite}
.c-live{animation-delay:.45s,1.3s}.c-prof{animation-delay:.6s,2.1s}.c-plan{animation-delay:.75s,2.9s}.c-com{animation-delay:.9s,3.4s}.c-heart{animation-delay:1.05s,1.8s}
@keyframes float-in{from{opacity:0;transform:translateY(18px) scale(.9)}to{opacity:1;transform:none}}
/* ───────── Wider screens ───────── */
@media (min-width:600px){:root{--gut:24px}.uses{grid-template-columns:repeat(2,1fr)}.circles{grid-template-columns:repeat(2,1fr)}.circle:first-child{grid-column:1/-1;min-height:380px}.dubai{grid-template-columns:repeat(3,1fr)}.dph.wide{grid-column:span 2;aspect-ratio:auto}.trust{grid-template-columns:repeat(3,1fr)}.tstage{height:600px}.tphone{width:262px}.tb{font-size:14px}.wl{padding:28px}}
@media (min-width:768px){section{padding:96px 0}.steps{grid-template-columns:repeat(4,1fr);gap:20px}.steps::before{left:32px;right:calc(25% - 32px);top:31px;bottom:auto;width:auto;height:2px;transform-origin:0 50%;transform:scaleX(var(--line,1))}.steps li{grid-template-columns:1fr;grid-template-rows:auto 1fr;gap:18px}.steps .card{padding:20px;height:100%}.head{grid-template-columns:minmax(0,1.1fr) minmax(0,.9fr);align-items:end;gap:10px 48px}.head .p{align-self:end}.head.center{grid-template-columns:1fr}.hgrid{gap:40px}.endcard{padding:80px 48px 56px}}
@media (min-width:1024px){:root{--gut:32px}.links{display:flex}.lang{margin-inline-start:4px}.bar .btn.small{display:inline-flex;margin-inline-start:4px}.menu-btn{display:none}.hgrid{grid-template-columns:minmax(0,1.04fr) minmax(0,.96fr);gap:40px}.hero{padding:20px 0 60px}.tgrid{grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:56px}.tcopy{text-align:left}.tslide .p{margin-inline:0}.tctrl{margin-inline:0}.tour .fine{margin-inline:0}.tstage{height:640px}.tphone{width:286px}.uses{grid-template-columns:repeat(6,1fr);gap:18px}.use{grid-column:span 2}.use:nth-child(1),.use:nth-child(4){grid-column:span 4}.use:nth-child(8),.use:nth-child(9){grid-column:span 3}.use:nth-child(-n+4) .ph{aspect-ratio:auto;height:340px}.use:nth-child(8) .ph,.use:nth-child(9) .ph{aspect-ratio:16/9}.circles{grid-template-columns:repeat(6,1fr);gap:18px}.circle{grid-column:span 2;min-height:360px}.circle:first-child{grid-column:span 4;min-height:360px}.circle:nth-child(2){grid-column:span 2}.circle:nth-child(n+3){grid-column:span 2}.dubai{grid-template-columns:repeat(4,1fr);grid-auto-rows:240px;gap:16px}.dph{aspect-ratio:auto;grid-row:span 2}.dph:nth-child(4),.dph.wide{grid-row:span 1;grid-column:auto}}
@media (min-width:1100px){.p1{left:2%}.p3{left:2%}.p2,.p4{right:2%}}
@media (min-width:1440px){h1{font-size:120px}.hstage{width:min(600px,100%)}}
@media (max-width:1023px){.hcopy{text-align:center}.hcopy .mark{margin-inline:auto}.sub,.lead{margin-inline:auto}.ctas{justify-content:center}.hero{min-height:auto}}
@media (max-width:420px){.tb{max-width:62%;font-size:12.5px;padding:8px 11px}.tb img{width:28px;height:28px}.tlayer>div>.tb:nth-child(n+3){display:none}.tcol .tb:nth-child(n+4){display:none}.tstage{height:500px}.tphone{width:220px}.chip small{display:none}.c-plan small{display:block}.ctas .btn{flex:1 1 100%}.mark{gap:8px;padding-inline:14px}.mark small{padding-inline-start:9px;font-size:11px}.mark span{font-size:26px}}
@media (max-width:359px){h1{font-size:46px}.mark b{letter-spacing:.24em}.c-heart{display:none}.field{flex-wrap:wrap;border-radius:22px}.field input{min-height:44px}.field .btn{flex:1 1 100%}}
/* Reduced motion: everything visible and still. */
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}html{scroll-behavior:auto}.js .reveal{opacity:1!important;transform:none!important}.steps{--line:1!important}.par,.dph .dpi,.tilt{transform:none!important}.ticker ul,.river{transform:none!important}.people{overflow-x:auto;-webkit-mask:none;mask:none}.ticker{overflow-x:auto}.tb{opacity:1;transform:none}}
`;

/** Width and height of a JPEG (owner photos), so the page reserves their space before they load. */
function jpegSize(file) {
  const d = fs.readFileSync(file);
  let i = 2;
  while (i < d.length) {
    const m = d[i + 1];
    const len = d.readUInt16BE(i + 2);
    if (m >= 0xc0 && m <= 0xc2) return [d.readUInt16BE(i + 7), d.readUInt16BE(i + 5)];
    i += 2 + len;
  }
  return [1200, 1200];
}

function page(lang) {
  const t = T[lang];
  const other = t.otherLang;
  const like = (l) => (lang === "fr" ? (LIKES_FR[l] ?? l) : l);
  const im = (src, alt, cls = "", lazy = true, extra = "") =>
    `<img${cls ? ` class="${cls}"` : ""} src="${src}" alt="${esc(alt)}"${lazy ? ' loading="lazy"' : ""} decoding="async" onerror="this.classList.add('missing')"${extra}>`;
  // A portrait of the illustrative cast (400 × 400).
  const fc = (p, alt = p.name, lazy = true, extra = "") => im(face(p.id), alt, "", lazy, ` width="400" height="400"${extra}`);
  const fcId = (id, alt = "", lazy = true) => (byId(id) ? fc(byId(id), alt, lazy) : "");
  // An owner photo: the 480 and 1200 files with their real widths, and its size reserved.
  const own = (k, alt, sizes, cls = "", lazy = true, extra = "") => {
    const [w1, h1] = jpegSize(`site${img(k)}`);
    const [w0] = jpegSize(`site${thumb(k)}`);
    const set = w0 === w1 ? `${img(k)} ${w1}w` : `${thumb(k)} ${w0}w, ${img(k)} ${w1}w`;
    return im(img(k), alt, cls, lazy, ` srcset="${set}" sizes="${sizes}" width="${w1}" height="${h1}"${extra}`);
  };
  // The French page shows the app in French (site/shots/fr, site/img/girl/*-fr.jpg) when that capture exists.
  const sh = (src) => {
    if (lang !== "fr") return src;
    const fr = src.startsWith("/shots/") ? src.replace("/shots/", "/shots/fr/") : src.replace(/\.jpg$/, "-fr.jpg");
    return fs.existsSync(`site${fr}`) ? fr : src;
  };
  const screen = (src, alt, lazy = true, extra = "") => im(src, alt, "", lazy, ` width="780" height="1688"${extra}`);
  const nav = [
    [t.nav.home, home(lang)],
    [t.nav.app, "#tour"],
    [t.nav.circles, "#circles"],
    [t.nav.how, "#how"],
    [t.nav.dubai, "#dubai"],
  ];
  const navLinks = () =>
    [
      ...nav.map(([label, to]) => `<a href="${to}">${esc(label)}</a>`),
      `<a href="${href(lang)}" aria-current="page"><span translate="no">IRLY Girl</span></a>`,
    ].join("");
  const ld = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: t.title,
    description: t.description,
    url: SITE + href(lang),
    inLanguage: lang,
    isPartOf: { "@id": `${SITE}/#website` },
    primaryImageOfPage: SITE + og(lang),
    mainEntity: {
      "@type": "FAQPage",
      mainEntity: t.faq.map(([q, a]) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
  };

  /* Hero: the real home screen in front, communities and an activity behind, the cards that happen around them. */
  const H = t.hero;
  const sofia = byId("g-sofia");
  const heroHtml = `<section class="hero" aria-labelledby="h1">
  <div class="hvid" id="heroBg" aria-hidden="true">${HERO.map((k, i) => (i ? `<picture class="sl" data-p="/img/hero/${k}-p.webp" data-set="${heroSet(k)}"></picture>` : `<picture class="sl on kb"><source media="(max-aspect-ratio: 4/5)" srcset="/img/hero/${k}-p.webp"><img src="/img/hero/${k}-1920.webp" srcset="${heroSet(k)}" sizes="100vw" width="1920" height="1200" alt="" fetchpriority="high" decoding="async"></picture>`)).join("")}</div>
  <div class="aura" aria-hidden="true"><i></i><i></i><i></i></div>
  <div class="wrap hgrid">
    <div class="hcopy">
      <p class="mark glass" translate="no"><b>IRLY</b><i aria-hidden="true"></i><span>Girl</span><small translate="yes">${esc(t.kicker)}</small></p>
      <h1 id="h1">${t.h1
        .map((part, li) => {
          const ws = part.split(" ").map((w, wi) => `<span class="w" style="animation-delay:${(0.08 + li * 0.12 + wi * 0.06).toFixed(2)}s">${esc(w)}</span>`).join(" ");
          return li === 1 ? ` <em>${ws}</em> ` : li === 0 ? `<span class="ln">${ws}</span>` : `<span class="ln">${ws}</span>`;
        })
        .join("")}</h1>
      <p class="sub">${esc(t.sub)}</p>
      <p class="lead">${esc(t.lead)}</p>
      <div class="ctas"><a class="btn" href="${APP_GIRL}">${esc(t.open)}${icon("arrow")}</a><a class="btn ghost" href="#waitlist">${esc(t.waitCta)}</a></div>
      <p class="note">${esc(t.webNote)}</p>
    </div>
    <div>
      <div class="hstage">
        <div class="tilt">
          <div class="par ph-l" data-speed="-0.06" aria-hidden="true"><div class="phone"><div class="scr">${screen(sh(shot("girl-communities")), "", false)}</div></div></div>
          <div class="par ph-r" data-speed="-0.1" aria-hidden="true"><div class="phone"><div class="scr">${screen(sh(shot("girl-invite")), "", false)}</div></div></div>
          <div class="par ph-main" data-speed="0.05"><div class="phone"><div class="scr">${screen(sh(shot("girl-home")), H.phonesAlt, false, ' fetchpriority="high"')}</div></div></div>
          <div class="chip glass c-live" aria-hidden="true"><span class="dot"></span>${esc(H.live)}<span class="stack">${["g-ines", "g-maya", "g-amira"].map((id) => fcId(id, "", false)).join("")}</span></div>
          ${sofia ? `<div class="chip glass c-prof" aria-hidden="true">${fc(sofia, "", false)}<span>${esc(sofia.name)}<small>${esc(H.likes)}</small></span></div>` : ""}
          <div class="chip glass c-plan" aria-hidden="true">${own("brunchGirl", "", "52px", "", false)}<span>${esc(H.plan)}<small>${esc(H.planWhen)}</small></span></div>
          <div class="chip glass c-com" aria-hidden="true">${fcId("g-nour", "", false)}<span><small>${esc(byId("g-nour")?.name ?? "")}</small>${esc(H.comment)}</span></div>
          <div class="chip glass c-heart" aria-hidden="true">♥ 23</div>
        </div>
      </div>
      <p class="hlabel"><span class="label">${esc(t.illustrative)}</span></p>
    </div>
  </div>
</section>`;

  /* Tour: real screens with the moments they show coming alive around the phone. */
  const tt = t.tour;
  const B = tt.bubbles;
  const scenes = tt.scenes.filter((x) => fs.existsSync(`site${x.src}`)).map((x) => ({ ...x, src: sh(x.src) }));
  const bub = (html, pos, i, cls = "glass") => `<div class="tb ${cls}${pos ? ` ${pos}` : ""}" style="--i:${i}">${html}</div>`;
  const who = (id, small, text) => `${fcId(id)}<span>${small ? `<small>${esc(small)}</small>` : ""}${esc(text)}</span>`;
  const layerFor = (src) => {
    if (src.endsWith("girl-home.jpg")) return bub(`<span class="dot"></span>${esc(B.live[0])}<span class="stack">${["g-ines", "g-maya", "g-sofia"].map((id) => fcId(id)).join("")}</span>`, "p1", 0, "glass pill") + bub(who("p-layla", B.live[1], B.live[2]), "p4", 1);
    if (src.endsWith("girl-communities.jpg")) return `<div class="tcol">${B.circles.map((c, i) => bub(`<span translate="no">${esc(c)}</span>`, "", i * 0.5, i === 0 ? "pink pill" : "glass pill")).join("")}</div>`;
    if (src.endsWith("girl-group.jpg")) return bub(who("w-noor", B.group[0], B.group[1]), "p1", 0) + bub(`<span class="heart" data-count="22">♥ 22</span>`, "p2", 1.5, "glass pill");
    if (src.endsWith("girl-post.jpg")) return B.comments.map(([id, text], i) => bub(who(id, byId(id)?.name ?? "", text), ["p1", "p2", "p3"][i], i)).join("");
    if (src.endsWith("girl-invite.jpg")) return bub(who("g-sofia", "IRLY Girl", B.invite[0]), "p1", 0) + bub(`✓ ${esc(B.invite[1])}`, "p2", 1.2, "pink pill") + bub(who("w-noor", "Yuna", B.invite[2]), "p3", 2);
    if (src.endsWith("girl-chat.jpg")) return bub(esc(B.chat[0]), "p1", 0, "glass pill") + bub(`📅 ${esc(B.chat[1])}`, "p4", 1, "pink pill");
    if (src.includes("/notifications")) return bub(who("w-noor", "", B.notif[0]), "p2", 0) + bub(who("g-chloe", "", B.notif[1]), "p3", 1);
    if (src.endsWith("girl-me.jpg")) return bub(esc(B.me[0]), "p2", 0, "glass pill") + bub(`📍 ${esc(B.me[1])}`, "p3", 1, "glass pill");
    return "";
  };
  const tourHtml = scenes.length
    ? `<section id="tour" class="tour" aria-labelledby="tour-t"><div class="wrap">
  <div class="head center reveal"><p class="k">${esc(t.tourK)}</p><h2 id="tour-t">${esc(t.tourT)}</h2><p class="p">${esc(t.tourP)}</p></div>
  <div class="tgrid" role="region" aria-roledescription="carousel" aria-label="${esc(tt.label)}">
  <div class="tstage reveal zoom">
    <div class="tphone"><div class="scr">${scenes.map((x, i) => `<img src="${x.src}" alt="${esc(x.alt)}" width="780" height="1688"${i ? ' loading="lazy" aria-hidden="true"' : ""} decoding="async" data-i="${i}"${i ? "" : ' class="on"'}>`).join("")}</div></div>
    <div class="tlayer" aria-hidden="true">${scenes.map((x, i) => `<div data-i="${i}"${i ? "" : ' class="on"'}>${layerFor(x.src)}</div>`).join("")}</div>
  </div>
  <div class="tcopy reveal">
    <div class="tslides" aria-live="polite">${scenes
      .map(
        (x, i) =>
          `<article class="tslide${i ? "" : " on"}" role="group" aria-roledescription="slide" aria-label="${i + 1} / ${scenes.length}" data-i="${i}"${i ? ' aria-hidden="true"' : ""}><p class="kk">${esc(x.k)}</p><h3>${esc(x.t)}</h3><p class="p">${esc(x.p)}</p>${i === scenes.length - 1 ? `<a class="btn" href="${APP_GIRL}"${i ? ' tabindex="-1"' : ""}>${esc(tt.cta)}${icon("arrow")}</a>` : ""}</article>`,
      )
      .join("")}</div>
    <div class="tctrl">
      <button type="button" class="tprev" aria-label="${esc(tt.prev)}">${icon("back")}</button>
      <div class="tdots">${scenes.map((x, i) => `<button type="button" aria-label="${i + 1}. ${esc(x.k)}"${i ? "" : ' class="on" aria-current="true"'}><span><i></i></span></button>`).join("")}</div>
      <button type="button" class="tnext" aria-label="${esc(tt.next)}">${icon("arrow")}</button>
      <button type="button" class="tplay" aria-label="${esc(tt.pause)}" data-pause="${esc(tt.pause)}" data-play="${esc(tt.play)}">❚❚</button>
    </div>
    <p class="fine">${esc(tt.note)}</p>
  </div>
  </div>
</div></section>`
    : "";

  // Two rivers of illustrative profiles; the second copy of each river is for the loop and hidden from assistive tech.
  const half = Math.ceil(CAST.length / 2);
  const pcard = (p, hidden) => `<figure class="pc glass"${hidden ? ' aria-hidden="true"' : ""}>${fc(p, hidden ? "" : p.name)}<figcaption><b>${esc(p.name)}</b><span>${esc(p.area)}</span><span class="tags">${p.likes.map((l) => `<i>${esc(like(l))}</i>`).join("")}</span></figcaption></figure>`;
  const river = (list, cls) => `<div class="river${cls}">${list.map((p) => pcard(p, false)).join("")}${list.map((p) => pcard(p, true)).join("")}</div>`;
  const endFaces = ["w-noor", "g-sofia", "g-nour", "g-chloe", "w-ana", "g-ines"].map((id) => fcId(id)).join("");
  const W = t.wait;

  return `<!doctype html>
<html lang="${lang}" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#FBF2F4">
<meta name="color-scheme" content="light">
<title>${esc(t.title)}</title>
<meta name="description" content="${esc(t.description)}">
<link rel="canonical" href="${SITE + href(lang)}">
<link rel="alternate" hreflang="en" href="${SITE + href("en")}">
<link rel="alternate" hreflang="fr" href="${SITE + href("fr")}">
<link rel="alternate" hreflang="x-default" href="${SITE + href("en")}">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.png" type="image/png" sizes="96x96">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta property="og:type" content="website">
<meta property="og:site_name" content="IRLY">
<meta property="og:title" content="${esc(t.title)}">
<meta property="og:description" content="${esc(t.description)}">
<meta property="og:url" content="${SITE + href(lang)}">
<meta property="og:image" content="${SITE + og(lang)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(t.ogAlt)}">
<meta property="og:locale" content="${t.locale}">
<meta property="og:locale:alternate" content="${T[other].locale}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(t.title)}">
<meta name="twitter:description" content="${esc(t.description)}">
<meta name="twitter:image" content="${SITE + og(lang)}">
<meta name="twitter:image:alt" content="${esc(t.ogAlt)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Manrope:wght@400;500;600;700;800&display=swap">
<link rel="preload" as="image" href="/img/hero/${HERO[0]}-1920.webp" imagesrcset="${heroSet(HERO[0])}" imagesizes="100vw" media="(min-aspect-ratio: 4/5)" fetchpriority="high">
<link rel="preload" as="image" href="/img/hero/${HERO[0]}-p.webp" media="(max-aspect-ratio: 4/5)" fetchpriority="high">
<link rel="preload" as="image" href="${sh(shot("girl-home"))}">
<style>${CSS}</style>
<script>document.documentElement.classList.add('js')</script>
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>
<body>
<a class="skip" href="#main">${esc(t.skip)}</a>
<div class="progress" aria-hidden="true"></div>
<header class="top" id="top"><div class="bar glass">
  <a class="logo" translate="no" href="${href(lang)}" aria-label="IRLY Girl"><b>IRLY</b><i aria-hidden="true"></i><span>Girl</span></a>
  <nav class="links" aria-label="${esc(t.navLabel)}">${navLinks()}</nav>
  <a class="lang" href="${href(other)}" hreflang="${other}" lang="${other}">${t.other}</a>
  <a class="btn small" href="${APP_GIRL}">${esc(t.open)}</a>
  <button class="menu-btn" type="button" aria-expanded="false" aria-controls="sheet" aria-label="${esc(t.menu)}"><span></span><span></span></button>
</div></header>
<nav class="sheet" id="sheet" aria-label="${esc(t.menu)}" aria-hidden="true" inert>${navLinks()}<a class="btn" href="${APP_GIRL}">${esc(t.open)}</a></nav>
<main id="main">
${heroHtml}

<div class="ticker" aria-hidden="true"><ul>${[...t.ticker, ...t.ticker].map((w) => `<li>${esc(w)}</li>`).join("")}</ul></div>

${tourHtml}

<section id="circles" aria-labelledby="circles-t"><div class="wrap">
  <div class="head reveal"><div><p class="k">${esc(t.circlesK)}</p><h2 id="circles-t">${esc(t.circlesT)}</h2></div><p class="p">${esc(t.circlesP)}</p></div>
  <div class="circles">${t.circles
    .map(
      ([name, about, photo, emoji, alt], i) =>
        `<article class="circle reveal" style="--d:${((i % 3) * 0.08).toFixed(2)}s">${own(photo, alt, i === 0 ? "(min-width: 1024px) 760px, 100vw" : "(min-width: 1024px) 380px, (min-width: 600px) 50vw, 100vw")}<span class="em" aria-hidden="true">${emoji}</span><span class="tag">${esc(t.womenOnly)}</span><div class="tx"><h3 translate="no">${esc(name)}</h3><p>${esc(about)}</p></div></article>`,
    )
    .join("")}</div>
</div></section>

<section id="uses" aria-labelledby="uses-t"><div class="wrap">
  <div class="head reveal"><div><p class="k">${esc(t.usesK)}</p><h2 id="uses-t">${esc(t.usesT)}</h2></div><p class="p">${esc(t.usesP)}</p></div>
  <div class="uses">${t.uses
    .map(
      ([photo, title, text, alt], i) =>
        `<article class="use reveal" style="--d:${((i % 3) * 0.08).toFixed(2)}s"><div class="ph">${own(photo, alt, i === 0 || i === 3 ? "(min-width: 1024px) 580px, (min-width: 600px) 50vw, 100vw" : "(min-width: 1024px) 380px, (min-width: 600px) 50vw, 100vw")}</div><div class="tx"><h3>${esc(title)}</h3><span class="n" aria-hidden="true">${String(i + 1).padStart(2, "0")}</span><p>${esc(text)}</p></div></article>`,
    )
    .join("")}</div>
</div></section>

<section id="people" aria-labelledby="people-t">
  <div class="wrap"><div class="head center reveal"><p class="k">${esc(t.peopleK)}</p><h2 id="people-t">${esc(t.peopleT)}</h2><p class="p">${esc(t.peopleP)}</p></div></div>
  <div class="people reveal">${river(CAST.slice(0, half), "")}${river(CAST.slice(half), " rev")}</div>
  <div class="wrap people-foot"><span class="label">${esc(t.illustrative)}</span></div>
</section>

<section id="how" class="how-sec" aria-labelledby="how-t"><div class="wrap">
  <div class="head reveal"><div><p class="k">${esc(t.howK)}</p><h2 id="how-t">${esc(t.howT)}</h2></div></div>
  <ol class="steps reveal">${t.how.map(([ic, h, p], i) => `<li class="reveal" style="--d:${(0.15 + i * 0.12).toFixed(2)}s"><span class="n" aria-hidden="true">${icon(ic)}<small>${i + 1}</small></span><div class="card glass"><h3>${esc(h)}</h3><p>${esc(p)}</p></div></li>`).join("")}</ol>
  <ul class="trust">${t.trust.map(([ic, h, p], i) => `<li class="reveal" style="--d:${(i * 0.08).toFixed(2)}s">${icon(ic)}<div><b>${esc(h)}</b><p>${esc(p)}</p></div></li>`).join("")}</ul>
</div></section>

<section id="dubai" aria-labelledby="dubai-t"><div class="wrap">
  <div class="head reveal"><div><p class="k">${esc(t.dubaiK)}</p><h2 id="dubai-t">${esc(t.dubaiT)}</h2></div><p class="p">${esc(t.dubaiP)}</p></div>
  <div class="dubai">${t.dubai
    .map(
      ([photo, cap, alt], i) =>
        `<figure class="dph reveal${photo === "palmAerial" ? " wide" : ""}" style="--d:${((i % 3) * 0.08).toFixed(2)}s"><div class="dpi" data-speed="${i % 2 ? "0.05" : "-0.05"}">${own(photo, alt, photo === "palmAerial" ? "(min-width: 1024px) 300px, (min-width: 600px) 66vw, 100vw" : "(min-width: 1024px) 300px, (min-width: 600px) 33vw, 50vw")}</div><figcaption class="glass">${esc(cap)}</figcaption></figure>`,
    )
    .join("")}</div>
</div></section>

<section aria-labelledby="soon-t"><div class="wrap"><div class="soon reveal zoom"><span class="badge"><span class="dot" aria-hidden="true"></span>${esc(t.soonK)}</span><h2 id="soon-t">${esc(t.soonT)}</h2><p class="p">${esc(t.soonP)}</p></div></div></section>

<section class="faq" aria-labelledby="faq-t"><div class="wrap"><h2 id="faq-t" class="reveal">${esc(t.faqT)}</h2>
  ${t.faq.map(([q, a]) => `<details class="reveal"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("\n  ")}
</div></section>

<section class="end" aria-labelledby="end-t"><div class="wrap"><div class="endcard reveal zoom">
  <div class="aura" aria-hidden="true"><i></i><i></i><i></i></div>
  <div class="faces" aria-hidden="true">${endFaces}</div>
  <h2 id="end-t">${esc(t.endT[0])} <em>${esc(t.endT[1])}</em></h2>
  <p class="p">${esc(t.endP)}</p>
  <div class="ctas"><a class="btn" href="${APP_GIRL}">${esc(t.open)}${icon("arrow")}</a></div>
  <div class="wl glass" id="waitlist">
    <h3>${esc(W.t)}</h3>
    <p>${esc(W.p)}</p>
    <form id="wl-form" novalidate>
      <div class="field" id="wl-field">
        <label for="wl-email" class="hp">${esc(W.label)}</label>
        <input id="wl-email" name="email" type="email" inputmode="email" autocomplete="email" required placeholder="${esc(W.ph)}" aria-describedby="wl-msg wl-legal">
        <input class="hp" id="wl-company" type="text" name="company" tabindex="-1" autocomplete="off" aria-hidden="true">
        <button class="btn" type="submit">${esc(W.btn)}<span class="spin" aria-hidden="true"></span></button>
      </div>
      <p class="msgline" id="wl-msg" role="status" aria-live="polite"></p>
      <p class="legal" id="wl-legal">${esc(W.legal)} <a href="${lang === "fr" ? "/fr/privacy" : "/privacy"}">${esc(t.privacy)}</a></p>
    </form>
    <div class="done" id="wl-done"><span class="tick" aria-hidden="true"><svg class="ic" viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span><div><b>${esc(W.done1)}</b><p>${esc(W.done2)}</p></div></div>
  </div>
  <p class="backlink"><a class="tlink" href="${home(lang)}">${icon("back")}${esc(t.back)}</a></p>
</div></div></section>
</main>
<footer><div class="wrap">
  <span class="flogo" translate="no"><b>IRLY</b><i aria-hidden="true"></i><span>Girl</span></span>
  <span>© 2026 IRLY · <a href="mailto:getirly@gmail.com">getirly@gmail.com</a></span>
  <nav aria-label="${esc(t.footer)}"><a href="${home(lang)}">${esc(t.back)}</a><a href="${lang === "fr" ? "/fr/privacy" : "/privacy"}">${esc(t.privacy)}</a><a href="${lang === "fr" ? "/fr/terms" : "/terms"}">${esc(t.terms)}</a><a href="${lang === "fr" ? "/fr/guidelines" : "/guidelines"}">${esc(t.guidelines)}</a><a href="${lang === "fr" ? "/fr/support" : "/support"}">${esc(t.support)}</a></nav>
</div></footer>
<script>
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const bar = document.querySelector('header.top');
  const btn = document.querySelector('.menu-btn');
  const sheet = document.getElementById('sheet');
  const set = (open) => { bar.classList.toggle('open', open); btn.setAttribute('aria-expanded', String(open)); sheet.setAttribute('aria-hidden', String(!open)); sheet.inert = !open; document.body.style.overflow = open ? 'hidden' : ''; if (open) sheet.querySelector('a').focus(); };
  btn.addEventListener('click', () => set(!bar.classList.contains('open')));
  sheet.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && bar.classList.contains('open')) { set(false); btn.focus(); } });
  matchMedia('(min-width: 1024px)').addEventListener('change', (m) => { if (m.matches) set(false); });

  // Scroll: the menu firms up, the progress thread grows, the phones and photos drift at their own pace.
  const progress = document.querySelector('.progress');
  const pars = reduce ? [] : [...document.querySelectorAll('[data-speed]')];
  let ticking = false;
  const onScroll = () => {
    ticking = false;
    const y = scrollY, h = document.documentElement.scrollHeight - innerHeight;
    bar.classList.toggle('scrolled', y > 8);
    progress.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, y / h) : 0).toFixed(4) + ')';
    for (const el of pars) {
      const r = el.parentElement.getBoundingClientRect();
      if (r.bottom < -200 || r.top > innerHeight + 200) continue;
      const max = el.classList.contains('dpi') ? r.height * 0.09 : 80;
      const off = Math.max(-max, Math.min(max, (r.top + r.height / 2 - innerHeight / 2) * parseFloat(el.dataset.speed)));
      el.style.transform = 'translate3d(0,' + off.toFixed(1) + 'px,0)';
    }
  };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  addEventListener('resize', onScroll, { passive: true });
  onScroll();

  // Hero: views of Dubai fading slowly into each other. The first is painted first; the next one loads
  // after the page, one ahead. Still with reduced motion or Save-Data, paused off-screen and in a hidden tab.
  const heroBg = document.getElementById('heroBg');
  const slides = heroBg ? [...heroBg.querySelectorAll('.sl')] : [];
  if (slides.length > 1 && !reduce && !(navigator.connection && navigator.connection.saveData)) {
    const SLIDE = 7000;
    let cur = 0, timer = null, seen = true;
    const fill = (sl) => {
      if (sl.dataset.set) {
        sl.innerHTML = '<source media="(max-aspect-ratio: 4/5)" srcset="' + sl.dataset.p + '"><img srcset="' + sl.dataset.set + '" sizes="100vw" width="1920" height="1200" alt="" decoding="async">';
        delete sl.dataset.set;
      }
      return sl.querySelector('img');
    };
    const ready = (img) => new Promise((done) => {
      if (img.complete && img.naturalWidth) { done(); return; }
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
    }).then(() => (img.decode ? img.decode().catch(() => {}) : null));
    const show = (n) => {
      const prev = slides[cur], next = slides[n];
      next.classList.remove('kb');
      void next.offsetWidth;
      next.classList.add('kb', 'on');
      prev.classList.remove('on');
      setTimeout(() => { if (!prev.classList.contains('on')) prev.classList.remove('kb'); }, 2600);
      cur = n;
    };
    const step = () => {
      clearTimeout(timer);
      if (!seen || document.hidden) return;
      timer = setTimeout(async () => {
        const n = (cur + 1) % slides.length;
        const img = fill(slides[n]);
        await ready(img);
        if (!seen || document.hidden || !img.naturalWidth) { step(); return; }
        show(n);
        fill(slides[(n + 1) % slides.length]);
        step();
      }, SLIDE);
    };
    const run = () => { const on = seen && !document.hidden; heroBg.classList.toggle('paused', !on); if (on) step(); else clearTimeout(timer); };
    if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { seen = e.isIntersecting; run(); }).observe(heroBg);
    document.addEventListener('visibilitychange', run);
    const start = () => { fill(slides[1]); run(); };
    if (document.readyState === 'complete') start(); else addEventListener('load', start, { once: true });
  }

  // Hero: the constellation leans toward a mouse pointer, very slightly.
  const stage = document.querySelector('.hstage'), tilt = document.querySelector('.tilt');
  if (stage && !reduce && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const hero = document.querySelector('.hero');
    hero.addEventListener('pointermove', (e) => {
      const r = stage.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
      tilt.style.transform = 'perspective(1200px) rotateY(' + (x * 6).toFixed(2) + 'deg) rotateX(' + (-y * 5).toFixed(2) + 'deg)';
    });
    hero.addEventListener('pointerleave', () => (tilt.style.transform = ''));
  }

  // Tour: autoplay while on screen (paused on hover, focus, hidden tab or reduced motion), swipe, arrows.
  const tour = document.getElementById('tour');
  if (tour) {
    const slides = [...tour.querySelectorAll('.tslide')];
    const imgs = [...tour.querySelectorAll('.tphone img')];
    const layers = [...tour.querySelectorAll('.tlayer>div')];
    const dots = [...tour.querySelectorAll('.tdots button')];
    const playBtn = tour.querySelector('.tplay');
    const N = slides.length, DUR = 6500;
    let cur = 0, start = 0, prog = 0, visible = false, hold = false, paused = reduce;
    const count = (el) => {
      const to = +el.dataset.count + 1;
      if (reduce) { el.textContent = '♥ ' + to; return; }
      el.textContent = '♥ ' + (to - 1);
      setTimeout(() => { el.textContent = '♥ ' + to; el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' }); }, 1300);
    };
    const go = (n) => {
      cur = (n + N) % N;
      slides.forEach((s, i) => { const on = i === cur; s.classList.toggle('on', on); s.setAttribute('aria-hidden', String(!on)); s.querySelectorAll('a').forEach((a) => (a.tabIndex = on ? 0 : -1)); });
      imgs.forEach((m, i) => { m.classList.toggle('on', i === cur); m.toggleAttribute('aria-hidden', i !== cur); });
      layers.forEach((l, i) => l.classList.toggle('on', i === cur));
      dots.forEach((d, i) => { d.classList.toggle('on', i === cur); d.classList.toggle('done', i < cur); if (i === cur) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current'); d.style.setProperty('--p', '0'); });
      // The next screen loads ahead, so a scene never opens on a blank phone.
      const next = imgs[(cur + 1) % N]; if (next) next.loading = 'eager';
      layers[cur] && layers[cur].querySelectorAll('[data-count]').forEach(count);
      prog = 0; start = performance.now();
    };
    const tick = (now) => {
      requestAnimationFrame(tick);
      if (paused || hold || !visible || document.hidden) { start = now - prog * DUR; return; }
      prog = Math.min(1, (now - start) / DUR);
      dots[cur].style.setProperty('--p', prog.toFixed(3));
      if (prog >= 1) { if (cur === N - 1) { paused = true; setPlay(); } else go(cur + 1); }
    };
    const setPlay = () => { playBtn.textContent = paused ? '▶' : '❚❚'; playBtn.setAttribute('aria-label', paused ? playBtn.dataset.play : playBtn.dataset.pause); };
    tour.querySelector('.tprev').addEventListener('click', () => go(cur - 1));
    tour.querySelector('.tnext').addEventListener('click', () => go(cur + 1));
    dots.forEach((d, i) => d.addEventListener('click', () => go(i)));
    playBtn.addEventListener('click', () => { paused = !paused; if (!paused && cur === N - 1 && prog >= 1) go(0); setPlay(); });
    const box = tour.querySelector('.tgrid');
    box.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') hold = true; });
    box.addEventListener('pointerleave', () => (hold = false));
    box.addEventListener('focusin', () => (hold = true));
    box.addEventListener('focusout', () => (hold = false));
    box.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') go(cur + 1); if (e.key === 'ArrowLeft') go(cur - 1); });
    let x0 = null;
    const st = tour.querySelector('.tstage');
    st.addEventListener('pointerdown', (e) => (x0 = e.clientX));
    st.addEventListener('pointerup', (e) => { if (x0 !== null && Math.abs(e.clientX - x0) > 40) go(cur + (e.clientX < x0 ? 1 : -1)); x0 = null; });
    if ('IntersectionObserver' in window) new IntersectionObserver(([x]) => (visible = x.isIntersecting), { threshold: 0.35 }).observe(box);
    else visible = true;
    setPlay();
    go(0);
    requestAnimationFrame(tick);
  }

  // Waitlist for the iPhone and Android apps (the same list as the home page).
  const form = document.getElementById('wl-form');
  if (form) {
    const M = ${JSON.stringify({ errEmpty: W.errEmpty, errInvalid: W.errInvalid, errBusy: W.errBusy, errNet: W.errNet })};
    const field = document.getElementById('wl-field'), email = document.getElementById('wl-email'), msg = document.getElementById('wl-msg'), done = document.getElementById('wl-done'), box = document.getElementById('waitlist');
    const EMAIL = /^[^\\s@]+@[^\\s@.]+(\\.[^\\s@.]+)*\\.[^\\s@.]{2,}$/;
    const fail = (k) => { msg.textContent = M[k]; field.classList.remove('bad'); void field.offsetWidth; field.classList.add('bad'); email.setAttribute('aria-invalid', 'true'); email.focus(); };
    email.addEventListener('input', () => { msg.textContent = ''; field.classList.remove('bad'); email.removeAttribute('aria-invalid'); });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (box.classList.contains('loading')) return;
      const v = email.value.trim();
      if (!v) return fail('errEmpty');
      if (v.length > 254 || !EMAIL.test(v)) return fail('errInvalid');
      if (form.company.value) return; // only bots fill the hidden field
      box.classList.add('loading'); form.setAttribute('aria-busy', 'true');
      try {
        const r = await fetch(${JSON.stringify(WAITLIST_API)}, { method: 'POST', headers: { 'content-type': 'application/json', apikey: ${JSON.stringify(WAITLIST_KEY)}, authorization: 'Bearer ' + ${JSON.stringify(WAITLIST_KEY)} }, body: JSON.stringify({ p_email: v, p_lang: ${JSON.stringify(lang)}, p_source: 'site-girl' }) });
        if (!r.ok) {
          const body = await r.text();
          if (/invalid email/.test(body)) return fail('errInvalid');
          if (/slow down/.test(body)) return fail('errBusy');
          throw new Error(String(r.status));
        }
        form.hidden = true;
        done.classList.add('on'); done.setAttribute('tabindex', '-1'); done.setAttribute('role', 'status'); done.focus();
      } catch (err) {
        fail('errNet');
      } finally {
        box.classList.remove('loading'); form.removeAttribute('aria-busy');
      }
    });
  }

  // Photos fade in as they load (only those still loading).
  if (!reduce) document.querySelectorAll('.circle img, .use img, .dph img').forEach((img) => {
    if (img.complete && img.naturalWidth) return;
    img.classList.add('fade');
    const ok = () => img.classList.add('ok');
    img.addEventListener('load', ok, { once: true });
    img.addEventListener('error', ok, { once: true });
  });

  // Reveals: once, as each block comes into view. Steps draw their line when the list arrives.
  const els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window) || reduce) { els.forEach((e) => e.classList.add('in')); return; }
  const io = new IntersectionObserver((list) => list.forEach((x) => { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.01 });
  els.forEach((e) => io.observe(e));
})();
</script>
</body>
</html>
`;
}

for (const lang of ["en", "fr"]) {
  const dir = path.join(OUT, href(lang));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "index.html"), page(lang));
}

const sitemap = path.join(OUT, "sitemap.xml");
if (
  fs.existsSync(sitemap) &&
  !fs.readFileSync(sitemap, "utf8").includes(`${SITE}/girl<`)
) {
  const today = new Date().toISOString().slice(0, 10);
  const entries = ["en", "fr"].map(
    (lang) =>
      `  <url>\n    <loc>${SITE + href(lang)}</loc>\n    <lastmod>${today}</lastmod>\n${["en", "fr"].map((l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${SITE + href(l)}"/>`).join("\n")}\n    <xhtml:link rel="alternate" hreflang="x-default" href="${SITE + href("en")}"/>\n  </url>`,
  );
  fs.writeFileSync(
    sitemap,
    fs
      .readFileSync(sitemap, "utf8")
      .replace("</urlset>", `${entries.join("\n")}\n</urlset>`),
  );
}
console.log(
  `site IRLY Girl pages: ${href("en")} ${href("fr")} · ${CAST.length} illustrative profiles`,
);
