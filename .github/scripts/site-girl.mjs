/**
 * The IRLY Girl page of the website, in English (/girl) and French
 * (/fr/girl): part of getirly.com (same menu, same app links), never a
 * second site.
 *
 * Honesty rules for this page:
 * - Every person shown is an ILLUSTRATIVE profile (example portraits from
 *   public-photos/faces, Pixabay licence or CC0, the same files the demo build
 *   uses), labelled as such on the page. None is an IRLY member; nothing here
 *   is read from or written to IRLY's database.
 * - A person keeps one name and one photo everywhere on the page.
 * - Features are described as they exist today: IRLY Match is coming soon, the
 *   iPhone and Android apps are coming soon, the app screens are real captures
 *   of the demo build (site/shots).
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
// Pick people by position, so the page works with any number of portraits.
const pick = (from, n) =>
  Array.from(
    { length: Math.min(n, CAST.length) },
    (_, i) => CAST[(from + i) % CAST.length],
  );

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

const T = {
  en: {
    locale: "en_US",
    other: "Français",
    otherLang: "fr",
    title: "IRLY Girl — The women-only space of IRLY in Dubai",
    description:
      "IRLY Girl is the space of IRLY reserved for women in Dubai: meet women, welcome newcomers, find activity partners, build your network, plan outings, restaurants and trips, and chat in women-only communities.",
    nav: {
      home: "IRLY",
      uses: "What for",
      circles: "Communities",
      access: "Access",
      app: "The app",
    },
    menu: "Menu",
    open: "Open IRLY Girl",
    how: "Discover",
    kicker: "Women only · Dubai",
    h1a: "Girlfriends, plans,",
    h1b: "memories.",
    lead: "Meet women in Dubai, find partners for your activities, build your network and plan trips together. A space inside IRLY, reserved for women.",
    webNote:
      "Works in your browser today. iPhone and Android apps are coming soon.",
    illustrative:
      "Illustrative profiles — a preview of the IRLY Girl experience. They are not IRLY members.",
    usesK: "What it’s for",
    usesT: "Everything you do better with girlfriends.",
    usesP: "Women-only communities, activities, Live and chats, in the same IRLY app.",
    uses: [
      ["yachtGirl", "Meet women in Dubai", "Women from everywhere who live here, around the things you love.", "Two friends raising their glasses on a boat at sunset"],
      ["newcomerGirl", "Welcome newcomers", "Just arrived? Ask anything, get tips, find your first friends.", "A woman photographing Downtown Dubai at dusk"],
      ["networkingGirl", "A professional network", "Founders and professionals meeting over coffee and ideas.", "A pink Dubai book next to a laptop"],
      ["tennisGirl", "Activity partners", "A tennis partner, a running buddy, a pilates class with someone.", "The shadows of two women holding tennis rackets"],
      ["beachClubGirl", "Outings", "Beach clubs, brunches, shopping, nights out, together.", "A sunny beach club with the Burj Al Arab in the distance"],
      ["restaurantGirl", "Restaurants & experiences", "New tables to try and experiences to share.", "A rooftop restaurant terrace at night in Dubai"],
      ["desertGirl", "Trips", "Desert evenings, weekends away and road trips between girls.", "Three women watching the sunset in the desert"],
      ["runGirl", "Girl Live", "See which women are out right now near you, and join them.", "A group of women running along a palm-lined beach path"],
      ["drinksGirl", "Member chat", "Private chats, group chats and community chats, with photos.", "Two friends in abayas holding matcha drinks"],
    ],
    plansK: "Girl activities",
    plansT: "What women plan together.",
    plansP:
      "Pick a day and a time: the activity gets its own group chat and lands in your calendar. These are the kinds of plans you can create in IRLY Girl.",
    plans: [
      ["brunchGirl", "Brunch", "Saturday, 11:00"],
      ["drinksGirl", "Coffee & matcha", "Weekday, 08:00"],
      ["pilatesGirl", "Pilates", "Tuesday, 19:00"],
      ["padelGirl", "Padel", "Thursday, 20:00"],
      ["beachClubGirl", "Beach club", "Sunday, 13:00"],
      ["yachtGirl", "Yacht day", "Friday, 16:00"],
      ["readingGirl", "Book club", "Wednesday, 19:30"],
      ["quadGirl", "Desert quad", "Saturday, 15:00"],
      ["spaGirl", "Spa & wellness", "Sunday, 10:00"],
    ],
    going: "going",
    peopleK: "Discover",
    peopleT: "Women who like what you like.",
    peopleP:
      "Brunch lovers, padel players, readers, runners, founders, travellers: women from everywhere who live in the UAE.",
    circlesK: "Official communities",
    circlesT: "Five circles to start with.",
    circlesP:
      "IRLY runs five official communities for women. Each has its posts, its activities and its group chat. You can also start your own.",
    circles: [
      ["IRLY Nouvelle Arrivante", "Just arrived in Dubai? Ask anything, get tips and meet other newcomers.", "newcomerGirl", "👋", "A woman photographing Downtown Dubai at dusk"],
      ["IRLY Girl Networking", "Women in business: entrepreneurship, opportunities, collaborations and your network.", "networkingGirl", "💼", "A pink Dubai book next to a laptop"],
      ["IRLY Francophone", "French-speaking girls in Dubai: chats, meetups and activities in French.", "brunchGirl", "🥐", "A brunch table with sushi and drinks by a pool"],
      ["IRLY Girl Trip", "Trips, excursions, getaways and road trips between girls.", "girlTrip", "✈️", "Friends in scarves celebrating the sunset in the desert"],
      ["IRLY Activité", "Sport, outings, restaurants, beach clubs, shopping, wellness and everything to do together.", "padelGirl", "✨", "Padel rackets on a blue court"],
    ],
    tour: {
      k: "A tour of IRLY Girl",
      label: "IRLY Girl, scene by scene",
      note: "Screens of the IRLY demo, with example women and conversations. They are not IRLY members.",
      prev: "Previous scene",
      next: "Next scene",
      pause: "Pause",
      play: "Play",
      cta: "Discover IRLY Girl",
      scenes: [
        { shot: "girl-home", k: "Welcome", t: "A little space that feels like yours.", p: "IRLY Girl lives inside IRLY, just for women: your activities, your communities and your chats, in their own look." },
        { shot: "girl-feed", k: "The community", t: "Meet the girls around you.", p: "New friends, brunch spots, padel partners, travel plans. Posts come from the women-only communities." },
        { shot: "girl-post", k: "Conversations", t: "Real conversations, not polished ones.", p: "Comments, replies and likes, in English or French. A hello can turn into a plan in a few messages." },
        { shot: "girl-invite", k: "Activities", t: "From a post to a plan to a friend.", p: "Join an activity in one tap, see who’s going, and talk it through in its group chat before you meet." },
        { shot: "girl-chat", k: "Your turn", t: "Your people might be closer than you think.", p: "Open IRLY Girl in your browser today. iPhone and Android apps are coming soon." },
      ],
      bubbles: {
        welcome: ["Girls brunch · Sat 11:00", "Sunrise yoga · Kite Beach"],
        feed: ["Girls, I just landed in Dubai and I’m looking for girls to discover the city with 🩷"],
        comments: [["g-nour", "Welcome girl!! 🥹"], ["g-sofia", "We should organise a girls brunch!"], ["w-ana", "I’m new here too, let’s go together!"], ["g-ines", "Girls, we should really start a little group."], ["g-hana", "Count me in 🤍"]],
        connect: ["Sofía invited you to Girls brunch in Jumeirah", "You’re going · 6/8", "Yuna: Want to meet at the entrance at 6:15?"],
        groups: ["IRLY Nouvelle Arrivante", "IRLY Girl Networking", "IRLY Francophone", "IRLY Girl Trip", "IRLY Activité"],
      },
    },
    members: "members shown here are illustrative",
    appK: "The app",
    appT: "Screens of the app.",
    appP: "Captured from IRLY’s demo build, with example content. IRLY Match is shown as coming soon, as it is in the app.",
    shots: [
      ["girl-home", "IRLY Girl home"],
      ["girl-feed", "Recent posts"],
      ["girl-post", "A post and its comments"],
      ["girl-chat", "Group chat"],
      ["girl-plans", "Activities coming up"],
      ["girl-invite", "Joining an activity"],
      ["girl-notifications", "Notifications"],
      ["girl-create", "Writing a post"],
      ["girl-me", "Your profile"],
    ],
    accessK: "Access",
    accessT: "Reserved for women. Here is how it works.",
    access: [
      ["Register as a woman", "Create your IRLY account and choose “woman” when you sign up. The gender is set at sign-up and can’t be changed afterwards in the app."],
      ["Open IRLY Girl", "From the app, open IRLY Girl. It is the same IRLY, with women-only content and its own look."],
      ["Checked by IRLY’s server", "Every women-only community, activity, Live and chat is refused by the server to accounts that are not registered as women."],
    ],
    safeK: "Your safety",
    safe: [
      "Your exact location is never shown, only your area.",
      "Block or report anyone. Reports are reviewed by the IRLY team, and an account can lose access to IRLY Girl.",
    ],
    soonK: "Coming soon",
    soonT: "IRLY Match.",
    soonP:
      "Meet women who share your interests, matched on what you love. It is not open yet: for now, communities and activities are where friendships start.",
    faqT: "Questions",
    faq: [
      [
        "Who can join IRLY Girl?",
        "Women with an IRLY account registered as women. Access follows the gender on the account and is checked by IRLY’s server, not only by the app.",
      ],
      [
        "Is it a separate app?",
        "No. IRLY Girl is a space inside IRLY: the same account and the same app, with women-only communities, activities, Live and chats.",
      ],
      [
        "Are the women on this page members?",
        "No. They are illustrative profiles that show what IRLY Girl looks like. Real members only appear inside the app, to other members.",
      ],
      [
        "Is it a dating app?",
        "No. IRLY Girl is about friendship, activities and networking between women.",
      ],
      [
        "How much does it cost?",
        "IRLY Girl is free. Some activities, like a brunch or a class, have a price set by the person who organises them.",
      ],
      [
        "Where is it available?",
        "In Dubai and across the UAE, in your browser at getirly.com/app, in English and French. The iPhone and Android apps are coming soon.",
      ],
    ],
    endT: "Your next girlfriends are one plan away.",
    endP: "Sign in with your IRLY account and open IRLY Girl.",
    back: "Back to IRLY",
    privacy: "Privacy",
    terms: "Terms",
    guidelines: "Community guidelines",
    support: "Support",
  },
  fr: {
    locale: "fr_FR",
    other: "English",
    otherLang: "en",
    title: "IRLY Girl — L’espace d’IRLY réservé aux femmes à Dubaï",
    description:
      "IRLY Girl est l’espace d’IRLY réservé aux femmes à Dubaï : rencontrer des femmes, accueillir les nouvelles arrivantes, trouver des partenaires d’activité, développer son réseau, organiser sorties, restos et voyages, et discuter dans des communautés entre femmes.",
    nav: {
      home: "IRLY",
      uses: "Pour quoi",
      circles: "Communautés",
      access: "Accès",
      app: "L’app",
    },
    menu: "Menu",
    open: "Ouvrir IRLY Girl",
    how: "Découvrir",
    kicker: "Réservé aux femmes · Dubaï",
    h1a: "Des copines, des sorties,",
    h1b: "des souvenirs.",
    lead: "Rencontre des femmes à Dubaï, trouve des partenaires pour tes activités, développe ton réseau et organisez vos voyages. Un espace dans IRLY, réservé aux femmes.",
    webNote:
      "Fonctionne déjà dans ton navigateur. Les apps iPhone et Android arrivent bientôt.",
    illustrative:
      "Profils illustratifs — aperçu de l’expérience IRLY Girl. Ce ne sont pas des membres d’IRLY.",
    usesK: "Pour quoi faire",
    usesT: "Tout ce qui est mieux entre copines.",
    usesP: "Communautés, activités, Live et conversations entre femmes, dans la même app IRLY.",
    uses: [
      ["yachtGirl", "Rencontrer des femmes à Dubaï", "Des femmes venues de partout qui vivent ici, autour de ce que tu aimes.", "Deux amies lèvent leur verre sur un bateau au coucher du soleil"],
      ["newcomerGirl", "Accueillir les nouvelles", "Tu viens d’arriver ? Pose tes questions, récupère les bons plans, trouve tes premières amies.", "Une femme photographie Downtown Dubai au crépuscule"],
      ["networkingGirl", "Un réseau pro", "Entrepreneures et professionnelles autour d’un café et d’idées.", "Un livre rose sur Dubaï à côté d’un ordinateur portable"],
      ["tennisGirl", "Des partenaires d’activité", "Une partenaire de tennis, une copine de running, un cours de pilates à deux.", "Les ombres de deux femmes avec des raquettes de tennis"],
      ["beachClubGirl", "Des sorties", "Beach clubs, brunchs, shopping, soirées, ensemble.", "Un beach club ensoleillé avec la Burj Al Arab au loin"],
      ["restaurantGirl", "Restos et expériences", "De nouvelles tables à tester et des expériences à partager.", "La terrasse d’un restaurant sur un toit de Dubaï la nuit"],
      ["desertGirl", "Des voyages", "Soirées dans le désert, week-ends et road trips entre filles.", "Trois femmes regardent le coucher du soleil dans le désert"],
      ["runGirl", "Girl Live", "Vois quelles femmes sortent en ce moment près de toi, et rejoins-les.", "Un groupe de femmes court sur une promenade bordée de palmiers"],
      ["drinksGirl", "Le chat entre membres", "Discussions privées, de groupe et de communauté, avec photos.", "Deux amies en abaya tiennent des boissons au matcha"],
    ],
    plansK: "Activités Girl",
    plansT: "Ce que les femmes organisent ensemble.",
    plansP:
      "Choisis le jour et l’heure : l’activité a sa conversation de groupe et arrive dans ton calendrier. Voici les types de sorties que tu peux créer dans IRLY Girl.",
    plans: [
      ["brunchGirl", "Brunch", "Samedi, 11 h"],
      ["drinksGirl", "Café & matcha", "En semaine, 8 h"],
      ["pilatesGirl", "Pilates", "Mardi, 19 h"],
      ["padelGirl", "Padel", "Jeudi, 20 h"],
      ["beachClubGirl", "Beach club", "Dimanche, 13 h"],
      ["yachtGirl", "Journée en yacht", "Vendredi, 16 h"],
      ["readingGirl", "Club de lecture", "Mercredi, 19 h 30"],
      ["quadGirl", "Quad dans le désert", "Samedi, 15 h"],
      ["spaGirl", "Spa & bien-être", "Dimanche, 10 h"],
    ],
    going: "participent",
    peopleK: "Découvrir",
    peopleT: "Des femmes qui aiment ce que tu aimes.",
    peopleP:
      "Amatrices de brunch, joueuses de padel, lectrices, runneuses, entrepreneures, voyageuses : des femmes venues de partout qui vivent aux Émirats.",
    circlesK: "Communautés officielles",
    circlesT: "Cinq cercles pour commencer.",
    circlesP:
      "IRLY anime cinq communautés officielles pour les femmes. Chacune a ses publications, ses activités et sa conversation de groupe. Tu peux aussi créer la tienne.",
    circles: [
      ["IRLY Nouvelle Arrivante", "Tu viens d’arriver à Dubaï ? Pose tes questions, récupère des conseils et rencontre d’autres nouvelles.", "newcomerGirl", "👋", "Une femme photographie Downtown Dubai au crépuscule"],
      ["IRLY Girl Networking", "Les femmes dans le business : entrepreneuriat, opportunités, collaborations et réseau.", "networkingGirl", "💼", "Un livre rose sur Dubaï à côté d’un ordinateur portable"],
      ["IRLY Francophone", "Les filles francophones de Dubaï : discussions, rencontres et activités en français.", "brunchGirl", "🥐", "Une table de brunch avec sushis et boissons au bord d’une piscine"],
      ["IRLY Girl Trip", "Voyages, excursions, escapades et road trips entre filles.", "girlTrip", "✈️", "Des amies en foulard fêtent le coucher du soleil dans le désert"],
      ["IRLY Activité", "Sport, sorties, restos, beach clubs, shopping, bien-être et tout ce qui se fait à plusieurs.", "padelGirl", "✨", "Des raquettes de padel sur un terrain bleu"],
    ],
    tour: {
      k: "IRLY Girl en visite",
      label: "IRLY Girl, scène par scène",
      note: "Écrans de la démo d’IRLY, avec des femmes et des conversations d’exemple. Ce ne sont pas des membres d’IRLY.",
      prev: "Scène précédente",
      next: "Scène suivante",
      pause: "Pause",
      play: "Lecture",
      cta: "Découvrir IRLY Girl",
      scenes: [
        { shot: "girl-home", k: "Bienvenue", t: "Un petit espace qui te ressemble.", p: "IRLY Girl vit dans IRLY, rien qu’entre femmes : tes activités, tes communautés et tes conversations, avec leur propre style." },
        { shot: "girl-feed", k: "La communauté", t: "Rencontre les filles autour de toi.", p: "Nouvelles amitiés, bonnes adresses, partenaires de padel, voyages. Les publications viennent des communautés entre femmes." },
        { shot: "girl-post", k: "Conversations", t: "De vraies conversations, pas des vitrines.", p: "Commentaires, réponses et j’aime, en français ou en anglais. Un bonjour devient une sortie en quelques messages." },
        { shot: "girl-invite", k: "Activités", t: "D’une publication à une sortie, puis à une amie.", p: "Rejoins une activité en un geste, vois qui vient, et parlez-en dans sa conversation de groupe avant de vous retrouver." },
        { shot: "girl-chat", k: "À toi", t: "Tes personnes sont peut-être plus proches que tu ne le crois.", p: "Ouvre IRLY Girl dans ton navigateur dès aujourd’hui. Les apps iPhone et Android arrivent bientôt." },
      ],
      bubbles: {
        welcome: ["Brunch entre filles · sam. 11:00", "Yoga au lever du soleil · Kite Beach"],
        feed: ["Les filles, je viens d’arriver à Dubaï et je cherche des copines pour découvrir la ville 🩷"],
        comments: [["g-nour", "Bienvenue !! 🥹"], ["g-sofia", "On devrait organiser un brunch entre filles !"], ["w-ana", "Je suis nouvelle aussi, on y va ensemble !"], ["g-ines", "Les filles, on devrait vraiment créer un petit groupe."], ["g-hana", "Je viens 🤍"]],
        connect: ["Sofía t’invite au brunch entre filles à Jumeirah", "Tu y vas · 6/8", "Yuna : On se retrouve à l’entrée à 6h15 ?"],
        groups: ["IRLY Nouvelle Arrivante", "IRLY Girl Networking", "IRLY Francophone", "IRLY Girl Trip", "IRLY Activité"],
      },
    },
    members: "les membres montrés ici sont illustratifs",
    appK: "L’app",
    appT: "Des écrans de l’app.",
    appP: "Captures de la version de démonstration d’IRLY, avec du contenu d’exemple. IRLY Match y apparaît « bientôt disponible », comme dans l’app.",
    shots: [
      ["girl-home", "Accueil IRLY Girl"],
      ["girl-feed", "Publications récentes"],
      ["girl-post", "Une publication et ses commentaires"],
      ["girl-chat", "Conversation de groupe"],
      ["girl-plans", "Activités à venir"],
      ["girl-invite", "Rejoindre une activité"],
      ["girl-notifications", "Notifications"],
      ["girl-create", "Écrire une publication"],
      ["girl-me", "Ton profil"],
    ],
    accessK: "Accès",
    accessT: "Réservé aux femmes. Voici comment ça marche.",
    access: [
      ["Inscris-toi comme femme", "Crée ton compte IRLY et choisis « femme » à l’inscription. Le genre est fixé à l’inscription et ne peut plus être changé ensuite dans l’app."],
      ["Ouvre IRLY Girl", "Depuis l’app, ouvre IRLY Girl. C’est le même IRLY, avec du contenu entre femmes et son propre style."],
      ["Vérifié par le serveur d’IRLY", "Chaque communauté, activité, Live et conversation entre femmes est refusé par le serveur aux comptes qui ne sont pas inscrits comme femmes."],
    ],
    safeK: "Ta sécurité",
    safe: [
      "Ta position exacte n’est jamais affichée, seulement ton quartier.",
      "Bloque ou signale n’importe qui. L’équipe IRLY examine les signalements, et un compte peut perdre l’accès à IRLY Girl.",
    ],
    soonK: "Bientôt disponible",
    soonT: "IRLY Match.",
    soonP:
      "Rencontrer des femmes qui partagent tes centres d’intérêt. Ce n’est pas encore ouvert : pour l’instant, les amitiés commencent dans les communautés et les activités.",
    faqT: "Questions",
    faq: [
      [
        "Qui peut rejoindre IRLY Girl ?",
        "Les femmes qui ont un compte IRLY inscrit comme femme. L’accès dépend du genre du compte et il est vérifié par le serveur d’IRLY, pas seulement par l’app.",
      ],
      [
        "Est-ce une app à part ?",
        "Non. IRLY Girl est un espace dans IRLY : le même compte et la même app, avec des communautés, des activités, un Live et des conversations entre femmes.",
      ],
      [
        "Les femmes de cette page sont-elles membres ?",
        "Non. Ce sont des profils illustratifs qui montrent à quoi ressemble IRLY Girl. Les vraies membres n’apparaissent que dans l’app, aux autres membres.",
      ],
      [
        "Est-ce une app de rencontres amoureuses ?",
        "Non. IRLY Girl est fait pour l’amitié, les activités et le networking entre femmes.",
      ],
      [
        "Combien ça coûte ?",
        "IRLY Girl est gratuit. Certaines activités, comme un brunch ou un cours, ont un prix fixé par la personne qui les organise.",
      ],
      [
        "Où est-ce disponible ?",
        "À Dubaï et dans tous les Émirats, dans ton navigateur sur getirly.com/app, en français et en anglais. Les apps iPhone et Android arrivent bientôt.",
      ],
    ],
    endT: "Tes prochaines copines sont à une sortie près.",
    endP: "Connecte-toi avec ton compte IRLY et ouvre IRLY Girl.",
    back: "Retour à IRLY",
    privacy: "Confidentialité",
    terms: "Conditions",
    guidelines: "Règles de la communauté",
    support: "Assistance",
  },
};

const CSS = `
:root{--bg:#FBF2F4;--cream:#FCEFF3;--beige:#F8F1EB;--surface:#FFFFFF;--blush:#F6E1E8;--pastel:#F6C5D8;--brand:#E83E87;--rose:#B92B69;--plum:#4A2440;--ink:#2F1B29;--soft:#6F5A67;--warm:#8C7684;--line:rgba(201,47,114,.14);--glass:rgba(255,255,255,.58);--glass-line:rgba(255,255,255,.75);--ease:cubic-bezier(.2,.7,.2,1);--spring:cubic-bezier(.34,1.4,.5,1)}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font:400 17px/1.6 "Manrope",system-ui,sans-serif;-webkit-font-smoothing:antialiased;overflow-x:hidden}
a{color:inherit}img{display:block;max-width:100%}
.wrap{width:min(1160px,100% - 32px);margin-inline:auto}
.glass{background:var(--glass);backdrop-filter:saturate(1.5) blur(18px);-webkit-backdrop-filter:saturate(1.5) blur(18px);border:1px solid var(--glass-line);box-shadow:0 1px 0 rgba(255,255,255,.8) inset,0 18px 40px rgba(56,40,50,.08)}
/* Menu: IRLY Girl marked as the page you are on. */
header.top{position:sticky;top:0;z-index:20;padding:10px 16px 0}
.bar{display:flex;align-items:center;gap:10px;height:60px;padding:0 10px 0 18px;border-radius:999px;width:min(1160px,100%);margin:0 auto}
.logo{display:inline-flex;align-items:center;gap:8px;text-decoration:none;flex:none}
.logo b{font-weight:800;font-size:13px;letter-spacing:.32em}
.logo i{width:6px;height:6px;border-radius:9px;background:var(--brand)}
.logo span{font:italic 400 28px/1 "Instrument Serif",Georgia,serif;color:var(--brand)}
.links{display:flex;gap:2px;margin-inline-start:auto}
.links a{font-size:14px;font-weight:600;color:var(--soft);text-decoration:none;padding:8px 12px;border-radius:999px;transition:color .2s,background .2s}
.links a:hover{color:var(--ink);background:rgba(201,47,114,.08)}
.links a[aria-current="page"]{color:var(--rose);background:rgba(232,62,135,.12)}
.lang{font-size:13px;font-weight:700;color:var(--soft);text-decoration:none;padding:8px 10px;border-radius:999px}
.lang:hover{background:rgba(201,47,114,.08)}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:52px;padding:0 26px;border-radius:999px;background:linear-gradient(135deg,#D63A7E,#B92B69 55%,#9E2358);color:#fff;font-weight:700;font-size:16px;text-decoration:none;box-shadow:0 12px 30px rgba(201,47,114,.24);transition:transform .25s var(--ease),box-shadow .25s var(--ease);position:relative;overflow:hidden}
.btn::after{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 30%,rgba(255,255,255,.35) 50%,transparent 70%);transform:translateX(-120%);transition:transform .8s var(--ease)}
.btn:hover{transform:translateY(-2px);box-shadow:0 16px 36px rgba(201,47,114,.3)}.btn:hover::after{transform:translateX(120%)}.btn:active{transform:scale(.97)}
.btn.small{height:40px;padding:0 18px;font-size:14px;box-shadow:none}
.btn.ghost{background:var(--surface);color:var(--rose);box-shadow:inset 0 0 0 1.5px var(--pastel)}
.menu-btn{display:none;width:44px;height:44px;border-radius:22px;border:0;background:rgba(201,47,114,.08);cursor:pointer;place-items:center;align-content:center}
.menu-btn span{display:block;width:18px;height:2px;border-radius:2px;background:var(--ink);transition:transform .3s var(--ease)}
.menu-btn span+span{margin-top:5px}
.open .menu-btn span:first-child{transform:translateY(3.5px) rotate(45deg)}.open .menu-btn span:last-child{transform:translateY(-3.5px) rotate(-45deg)}
.sheet{position:fixed;inset:0;z-index:15;background:rgba(255,246,248,.95);backdrop-filter:blur(22px);-webkit-backdrop-filter:blur(22px);display:grid;align-content:center;gap:4px;padding:100px 24px 40px;opacity:0;visibility:hidden;transition:opacity .3s,visibility .3s}
.sheet a{font:400 clamp(38px,10vw,52px)/1.1 "Instrument Serif",Georgia,serif;text-decoration:none;transform:translateY(14px);opacity:0;transition:transform .45s var(--ease),opacity .45s}
.sheet a[aria-current="page"]{color:var(--rose);font-style:italic}
.sheet a.btn{font:700 16px/1 "Manrope",sans-serif;justify-self:start;margin-top:22px}
.open+.sheet{opacity:1;visibility:visible}.open+.sheet a{transform:none;opacity:1}
${Array.from({ length: 8 }, (_, i) => `.open+.sheet a:nth-child(${i + 1}){transition-delay:${(i * 0.04).toFixed(2)}s}`).join("")}
/* Tour: the IRLY Girl slideshow. Real screens in a phone, scene cards around it. */
.tour{padding:30px 0 70px;position:relative}
.tour::before{content:"";position:absolute;inset:40px 0 0;background:radial-gradient(50% 45% at 30% 40%,rgba(246,197,216,.55),transparent 70%),radial-gradient(40% 40% at 80% 70%,rgba(243,226,220,.8),transparent 70%);z-index:-1;pointer-events:none}
.tgrid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:56px;align-items:center}
.tstage{position:relative;height:640px;display:grid;place-items:center;touch-action:pan-y}
.tphone{position:relative;width:296px;aspect-ratio:390/844;border-radius:46px;padding:10px;background:#fff;box-shadow:0 40px 90px rgba(56,40,50,.18),0 0 0 1px rgba(201,47,114,.08);transform:translateZ(0)}
.tphone .scr{position:absolute;inset:10px;border-radius:37px;overflow:hidden;background:var(--blush)}
.tphone img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0;transform:scale(1.035);transition:opacity .7s var(--ease),transform 1.1s var(--ease)}
.tphone img.on{opacity:1;transform:none}
.tlayer{position:absolute;inset:0;pointer-events:none}
.tlayer>div{position:absolute;inset:0;visibility:hidden}
.tlayer>div.on{visibility:visible}
.tb{position:absolute;display:flex;align-items:center;gap:10px;max-width:270px;padding:10px 14px;border-radius:20px;font-size:14px;line-height:1.35;font-weight:600;color:var(--ink);opacity:0;transform:translateY(16px) scale(.96);transition:opacity .55s var(--ease),transform .7s var(--ease);transition-delay:calc(var(--i,0) * .32s + .25s)}
.on .tb{opacity:1;transform:none}
.tb img{width:34px;height:34px;border-radius:50%;object-fit:cover;flex:none}
.tb small{display:block;font-size:12px;font-weight:700;color:var(--rose)}
.tb .heart{color:var(--brand);font-weight:800;white-space:nowrap}
.tb.pill{border-radius:999px;padding:9px 16px}
.tb.pink{background:linear-gradient(135deg,#D63579,#C2296B);color:#fff;border:0}
.tlogo{position:absolute;top:22px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:8px;padding:10px 20px;border-radius:999px;opacity:0;transition:opacity .6s var(--ease)}
.on>.tlogo{opacity:1}
.tlogo b{font-weight:800;font-size:12px;letter-spacing:.32em}.tlogo i{width:6px;height:6px;border-radius:9px;background:var(--brand)}
.tlogo span{font:italic 400 30px/1 "Instrument Serif",Georgia,serif;color:var(--brand);clip-path:inset(0 100% 0 0);transition:clip-path 1s var(--ease) .35s}
.on>.tlogo span{clip-path:inset(0)}
.tring{position:absolute;inset:0;--rx:190px;--ry:250px}
.tring .tb{flex-direction:column;gap:4px;padding:8px;border-radius:18px;font-size:12px;text-align:center;max-width:none}
.tring .tb img{width:52px;height:52px}
.tchips{position:absolute;right:-6px;top:90px;display:grid;gap:8px;justify-items:end}
.tchips .tb{position:static}
.tcopy{min-width:0}
.tslides{display:grid}
.tslide{grid-area:1/1;opacity:0;visibility:hidden;transform:translateY(14px);transition:opacity .5s var(--ease),transform .6s var(--ease),visibility 0s .6s}
.tslide.on{opacity:1;visibility:visible;transform:none;transition:opacity .6s var(--ease) .1s,transform .7s var(--ease) .1s,visibility 0s}
.tslide h2{margin:6px 0 14px}
.tslide .btn{margin-top:22px}
.tctrl{display:flex;align-items:center;gap:10px;margin-top:30px}
.tctrl>button{flex:none;width:44px;height:44px;border-radius:22px;border:0;background:var(--surface);color:var(--ink);box-shadow:0 4px 14px rgba(56,40,50,.08);cursor:pointer;display:grid;place-items:center;font:700 18px/1 "Manrope",sans-serif;transition:transform .2s var(--ease),background .2s}
.tctrl>button:hover{background:#fff;transform:translateY(-1px)}.tctrl>button:active{transform:scale(.94)}
.tctrl>button:focus-visible,.tdots button:focus-visible{outline:2px solid var(--rose);outline-offset:2px}
.tdots{display:flex;gap:6px;flex:1;min-width:0}
.tdots button{flex:1;height:30px;min-width:0;border:0;background:none;padding:0;cursor:pointer;display:grid;align-items:center}
.tdots button span{display:block;height:4px;border-radius:4px;background:rgba(201,47,114,.16);overflow:hidden}
.tdots button span i{display:block;height:100%;width:0;background:var(--rose);border-radius:4px}
.tdots button.done span i{width:100%}
.tdots button.on span i{width:var(--p,0%)}
.tour .fine{margin-top:18px}
@media (max-width:920px){.tring{--rx:150px;--ry:210px}.tgrid{grid-template-columns:1fr;gap:20px}.tstage{height:560px}.tphone{width:250px}.tchips{right:0;top:70px}.tb{max-width:220px;font-size:13px}.tcopy{order:2}}
@media (max-width:420px){.tstage{height:520px}.tphone{width:232px}.tb{max-width:200px}.tlayer>div>.tb:nth-child(n+5){display:none}.tring .tb img{width:42px;height:42px}}
@media (prefers-reduced-motion:reduce){.tphone img,.tb,.tslide,.tlogo,.tlogo span{transition:none!important}.tb{transform:none}}
/* Hero */
.hero{padding:56px 0 30px;position:relative}
.hero::before{content:"";position:absolute;inset:-120px 0 auto;height:620px;background:radial-gradient(60% 60% at 70% 30%,rgba(246,197,216,.65),transparent 70%),radial-gradient(40% 50% at 15% 20%,rgba(243,226,220,.9),transparent 70%);z-index:-1;pointer-events:none}
.hero .grid{display:grid;grid-template-columns:1.02fr .98fr;gap:48px;align-items:center}
.kicker{font-size:12px;font-weight:800;letter-spacing:.28em;text-transform:uppercase;color:var(--rose);margin:0}
h1{font:400 clamp(50px,7.6vw,100px)/.96 "Instrument Serif",Georgia,serif;letter-spacing:-.015em;margin:18px 0 22px}
h1 em{color:var(--brand)}
h1 .w{display:inline-block;animation:word 1s var(--ease) both}
.lead{font-size:clamp(17px,1.6vw,20px);color:var(--soft);max-width:36ch;margin:0 0 28px;animation:rise .9s var(--ease) .5s both}
.ctas{display:flex;flex-wrap:wrap;gap:12px;align-items:center}
.note{font-size:13px;color:var(--soft);margin:14px 0 0}
.faces{display:flex;align-items:center;margin-top:26px}
.faces img{width:42px;height:42px;border-radius:50%;object-fit:cover;border:2.5px solid var(--bg);margin-inline-start:-10px;animation:pop .7s var(--spring) both;background:var(--blush)}
.faces img:first-child{margin-inline-start:0}
.faces small{margin-inline-start:12px;font-size:12.5px;color:var(--soft);max-width:26ch;line-height:1.35}
.stage{position:relative;aspect-ratio:1/1.05}
.stage .main{position:absolute;inset:4% 14% 10% 6%;border-radius:36px;overflow:hidden;box-shadow:0 30px 70px rgba(56,40,50,.18);animation:rise 1.1s var(--ease) .1s both;background:var(--blush)}
.stage .main img{width:100%;height:100%;object-fit:cover}
.card-p{position:absolute;display:flex;align-items:center;gap:10px;padding:8px 16px 8px 8px;border-radius:999px;font-size:13px;font-weight:700;animation:float-in .9s var(--spring) both,bob 7s ease-in-out 1.6s infinite}
.card-p img{width:40px;height:40px;border-radius:50%;object-fit:cover;background:var(--blush)}
.card-p small{display:block;font-weight:500;color:var(--soft);font-size:11px}
.card-p.a{top:6%;right:0;animation-delay:.45s,1.6s}.card-p.b{left:-2%;bottom:20%;animation-delay:.6s,2.2s}.card-p.c{right:4%;bottom:2%;animation-delay:.75s,2.8s}
.label{display:inline-flex;align-items:center;gap:8px;font-size:12px;color:var(--soft);padding:7px 12px;border-radius:999px;background:rgba(255,255,255,.7);border:1px solid var(--line);max-width:100%}
.label::before{content:"";flex:none;width:6px;height:6px;border-radius:6px;background:var(--warm)}
section{padding:80px 0;scroll-margin-top:70px}
.k{font-size:12px;font-weight:800;letter-spacing:.24em;text-transform:uppercase;color:var(--rose);margin:0 0 12px}
h2{font:400 clamp(38px,4.8vw,64px)/1.02 "Instrument Serif",Georgia,serif;letter-spacing:-.01em;margin:0 0 16px}
.p{color:var(--soft);max-width:52ch;margin:0}
.head{display:flex;flex-wrap:wrap;align-items:end;justify-content:space-between;gap:16px 40px;margin-bottom:34px}
/* Discover: an editorial wall, cards of different sizes. */
.wall{display:grid;grid-template-columns:repeat(6,1fr);grid-auto-rows:118px;grid-auto-flow:dense;gap:14px}
.pc{position:relative;border-radius:24px;overflow:hidden;background:var(--blush);grid-row:span 2;margin:0;box-shadow:0 12px 30px rgba(56,40,50,.08);transition:transform .5s var(--ease),box-shadow .5s var(--ease)}
.pc:hover{transform:translateY(-4px) rotate(-.4deg);box-shadow:0 22px 44px rgba(56,40,50,.14)}
.pc.big{grid-column:span 2;grid-row:span 3}.pc.tall{grid-row:span 3}.pc.wide{grid-column:span 2}
.pc img{width:100%;height:100%;object-fit:cover;transition:transform 1.2s var(--ease)}
.pc:hover img{transform:scale(1.04)}
.pc .meta{position:absolute;left:8px;right:8px;bottom:8px;padding:9px 12px;border-radius:16px;font-size:12px;line-height:1.3}
.pc .meta b{display:block;font:400 21px/1.05 "Instrument Serif",Georgia,serif}
.pc .meta span{color:var(--soft)}
.pc .tags{display:flex;gap:4px;flex-wrap:wrap;margin-top:5px}
.pc .tags i{font-style:normal;font-size:10.5px;font-weight:700;color:var(--rose);background:rgba(232,62,135,.1);padding:3px 7px;border-radius:999px}
.more{margin-top:18px;font-size:13px;color:var(--soft)}
.fine{font-size:12.5px;color:var(--soft);margin:34px 0 0}
/* What it is for: photo cards in an editorial grid. */
.uses{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
.use{margin:0;border-radius:26px;overflow:hidden;background:var(--surface);box-shadow:0 14px 34px rgba(56,40,50,.08);display:grid;grid-template-rows:auto 1fr}
.use .ph{aspect-ratio:4/3;overflow:hidden;background:var(--blush)}
.use .ph img{width:100%;height:100%;object-fit:cover;transition:transform 1.2s var(--ease)}
.use:hover .ph img{transform:scale(1.04)}
.use .tx{padding:16px 20px 20px}
.use h3{font:400 27px/1.08 "Instrument Serif",Georgia,serif;margin:0 0 6px}
.use p{margin:0;color:var(--soft);font-size:15px}
.use:nth-child(3n+2){transform:translateY(26px)}.use.reveal:nth-child(3n+2){transform:translateY(48px)}.use.reveal.in:nth-child(3n+2){transform:translateY(26px)}
/* Access: three steps. */
.access-sec{background:linear-gradient(180deg,var(--bg),var(--cream))}
.steps{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(3,1fr);gap:18px;counter-reset:s}
.steps li{position:relative;background:var(--surface);border-radius:24px;padding:24px 22px 22px;box-shadow:inset 0 0 0 1px var(--line)}
.steps .n{display:grid;place-items:center;width:40px;height:40px;border-radius:50%;background:var(--plum);color:#FFF6FA;font:400 22px/1 "Instrument Serif",Georgia,serif;margin-bottom:14px}
.steps h3{font:400 26px/1.1 "Instrument Serif",Georgia,serif;margin:0 0 8px}
.steps p{margin:0;color:var(--soft);font-size:15px}
.skip{position:fixed;top:10px;left:10px;z-index:40;padding:10px 16px;border-radius:999px;background:var(--rose);color:#fff;font-weight:700;text-decoration:none;transform:translateY(-200%)}.skip:focus{transform:none}
/* Plans */
.rail{display:grid;grid-auto-flow:column;grid-auto-columns:min(290px,76vw);gap:16px;overflow-x:auto;scroll-snap-type:x mandatory;padding:6px 2px 18px;scrollbar-width:none;overscroll-behavior-x:contain}
.rail::-webkit-scrollbar{display:none}
.plan{scroll-snap-align:start;border-radius:26px;overflow:hidden;background:var(--surface);box-shadow:0 14px 34px rgba(56,40,50,.08)}
.plan .ph{aspect-ratio:4/5;position:relative;background:var(--blush)}
.plan .ph img{width:100%;height:100%;object-fit:cover}
.plan .chip{position:absolute;left:12px;top:12px;padding:7px 12px;border-radius:999px;font-size:12px;font-weight:800}
.plan .body{padding:14px 16px 16px;display:flex;align-items:center;justify-content:space-between;gap:10px}
.plan .body b{font:400 24px/1.1 "Instrument Serif",Georgia,serif}
.plan .body small{display:block;color:var(--soft);font-size:12.5px}
.stack{display:flex;align-items:center;flex-wrap:wrap}.stack img{width:30px;height:30px;border-radius:50%;object-fit:cover;border:2px solid #fff;margin-inline-start:-9px;background:var(--blush)}.stack img:first-child{margin:0}
.stack em{font-style:normal;font-size:11px;font-weight:700;color:var(--soft);margin-inline-start:8px}
.hint{font-size:12.5px;color:var(--soft);margin:4px 0 0}
/* Communities */
.circles{display:grid;grid-template-columns:repeat(2,1fr);gap:18px}
.circle{display:grid;grid-template-columns:150px 1fr;gap:16px;align-items:center;padding:12px;border-radius:26px}
.circle img.cv{width:150px;height:150px;border-radius:20px;object-fit:cover;background:var(--blush)}
.circle b{font:400 28px/1.05 "Instrument Serif",Georgia,serif}
.circle p{color:var(--soft);font-size:14.5px;margin:6px 0 12px}
/* App screens */
.shots{display:grid;grid-auto-flow:column;grid-auto-columns:min(236px,62vw);gap:22px;overflow-x:auto;padding:10px 2px 26px;scroll-snap-type:x mandatory;scrollbar-width:none}
.shots::-webkit-scrollbar{display:none}
.shot{scroll-snap-align:center;margin:0}
.shot .phone{border-radius:34px;padding:8px;background:#1d1418;box-shadow:0 26px 60px rgba(56,40,50,.22)}
.shot img{width:100%;aspect-ratio:390/844;object-fit:cover;object-position:top;border-radius:27px;background:var(--blush)}
.shot figcaption{text-align:center;font-size:13px;color:var(--soft);margin-top:12px}
.soon{border-radius:36px;padding:48px;text-align:center}
.soon .badge{display:inline-flex;padding:8px 14px;border-radius:999px;background:var(--rose);color:#fff;font-size:12px;font-weight:800;letter-spacing:.14em;text-transform:uppercase}
.soon h2{margin-top:18px}.soon .p{margin-inline:auto}
.safe{list-style:none;padding:0;margin:24px 0 0;display:grid;gap:14px}
.safe li{display:flex;gap:14px;align-items:flex-start;background:var(--surface);border-radius:20px;padding:18px 20px;box-shadow:inset 0 0 0 1px var(--line)}
.safe li::before{content:"";flex:0 0 10px;height:10px;border-radius:10px;background:var(--brand);margin-top:8px}
.faq details{border-bottom:1px solid var(--line);padding:18px 0}
.faq summary{cursor:pointer;font:400 26px/1.2 "Instrument Serif",Georgia,serif;list-style:none;display:flex;justify-content:space-between;gap:12px}
.faq summary::-webkit-details-marker{display:none}
.faq summary::after{content:"+";font-family:"Manrope",sans-serif;font-weight:600;color:var(--rose);transition:transform .3s var(--ease)}
.faq details[open] summary::after{transform:rotate(45deg)}
.faq p{color:var(--soft);margin:10px 0 0;max-width:62ch}
.end{text-align:center;padding:100px 0 110px}
.end .faces{justify-content:center;margin:0 0 26px}
.end h2{max-width:16ch;margin-inline:auto}
footer{border-top:1px solid var(--line);padding:28px 0 40px;font-size:14px;color:var(--soft)}
footer .wrap{display:flex;flex-wrap:wrap;gap:10px 22px;justify-content:space-between}
footer nav{display:flex;flex-wrap:wrap;gap:8px 18px}footer a{text-decoration:none}footer a:hover{color:var(--rose)}
img.missing{opacity:0}
/* Motion: one vocabulary, delays vary by position so cards never move in lockstep. */
.reveal{opacity:0;transform:translateY(22px) scale(.985);transition:opacity .9s var(--ease),transform .9s var(--ease);transition-delay:var(--d,0s)}
.reveal.in{opacity:1;transform:none}
@keyframes rise{from{opacity:0;transform:translateY(24px) scale(.98)}to{opacity:1;transform:none}}
@keyframes word{from{opacity:0;transform:translateY(.4em);filter:blur(6px)}to{opacity:1;transform:none;filter:none}}
@keyframes pop{from{opacity:0;transform:scale(.6)}to{opacity:1;transform:none}}
@keyframes float-in{from{opacity:0;transform:translateY(16px) scale(.92)}to{opacity:1;transform:none}}
@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}.reveal,.page.reveal{opacity:1!important}.reveal:not(.page){transform:none!important}.page.reveal{transform:var(--r)!important}html{scroll-behavior:auto}}
@media (max-width:1100px){.links a.hide-md{display:none}}
@media (max-width:920px){.uses{grid-template-columns:repeat(2,1fr)}.uses .use:nth-child(n){transform:none}.steps{grid-template-columns:1fr}.links,.bar .btn.small{display:none}.menu-btn{display:grid}.lang{margin-inline-start:auto}.hero{padding-top:34px}.hero .grid{grid-template-columns:1fr;gap:34px}.stage{max-width:460px;width:100%;margin-inline:auto}.wall{grid-template-columns:repeat(2,1fr);grid-auto-rows:104px}.pages{grid-template-columns:1fr;max-width:420px;margin-inline:auto;gap:34px}.circles{grid-template-columns:1fr}section{padding:56px 0}.soon{padding:32px 22px}}
@media (max-width:600px){.uses{grid-template-columns:1fr}}
@media (max-width:480px){.circle{grid-template-columns:96px 1fr}.circle img.cv{width:96px;height:96px}.card-p{font-size:12px;padding-inline-end:12px}.card-p img{width:34px;height:34px}.card-p.b{left:0}.hero .faces{flex-wrap:wrap;row-gap:10px}.hero .faces small{flex-basis:100%;margin-inline-start:0;max-width:none}.pc .tags i:nth-child(n+2){display:none}}
:focus-visible{outline:3px solid var(--brand);outline-offset:3px;border-radius:8px}
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
  // An owner photo: the 480 and 1200 files with their real widths, and its size reserved.
  const own = (k, alt, sizes, cls = "", lazy = true, extra = "") => {
    const [w1, h1] = jpegSize(`site${img(k)}`);
    const [w0] = jpegSize(`site${thumb(k)}`);
    const set = w0 === w1 ? `${img(k)} ${w1}w` : `${thumb(k)} ${w0}w, ${img(k)} ${w1}w`;
    return im(img(k), alt, cls, lazy, ` srcset="${set}" sizes="${sizes}" width="${w1}" height="${h1}"${extra}`);
  };
  const avatars = (people, max = 4) =>
    people
      .slice(0, max)
      .map((p) => fc(p))
      .join("");
  const nav = [
    [t.nav.home, home(lang)],
    [t.nav.uses, "#uses"],
    [t.nav.circles, "#circles"],
    [t.nav.access, "#access"],
    [t.nav.app, "#tour", "hide-md"],
  ];
  const navLinks = (sheet) =>
    [
      ...nav.map(
        ([label, to, cls]) =>
          `<a${!sheet && cls ? ` class="${cls}"` : ""} href="${to}">${esc(label)}</a>`,
      ),
      `<a href="${href(lang)}" aria-current="page"><span translate="no">IRLY Girl</span></a>`,
    ].join("");

  // Fixed positions in the cast, so a woman keeps her name and photo in every section.
  const heroFaces = pick(0, 7);
  const floating = [CAST[3], CAST[12], CAST[29] ?? CAST[5]].filter(Boolean);
  const wall = pick(0, Math.min(CAST.length, 12));
  const sizes = ["big", "", "tall", "", "wide", "", "", "tall", "", "", "wide", ""];
  const ld = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: t.title,
    description: t.description,
    url: SITE + href(lang),
    inLanguage: lang,
    isPartOf: { "@id": `${SITE}/#website` },
    mainEntity: {
      "@type": "FAQPage",
      mainEntity: t.faq.map(([q, a]) => ({
        "@type": "Question",
        name: q,
        acceptedAnswer: { "@type": "Answer", text: a },
      })),
    },
  };
  const shots = t.shots.filter(([n]) => fs.existsSync(`site/shots/${n}.jpg`));
  // The tour: a few scenes, each a real screen of the demo with the cards it shows coming alive.
  const tt = t.tour;
  const tourScenes = tt.scenes.filter((x) => fs.existsSync(`site/shots/${x.shot}.jpg`));
  const byId = (id) => CAST.find((c) => c.id === id);
  const bub = (html, style, i, cls = "glass") => `<div class="tb ${cls}" style="${style};--i:${i}">${html}</div>`;
  const faceTag = (id) => (byId(id) ? fc(byId(id), "") : "");
  const B = tt.bubbles;
  // The cards around the phone, per screen.
  const layers = {
    "girl-home":
      `<div class="tlogo glass" translate="no"><b>IRLY</b><i aria-hidden="true"></i><span>Girl</span></div>` +
      bub(esc(B.welcome[0]), "left:-6px;bottom:150px", 1, "glass pill") +
      bub(esc(B.welcome[1]), "right:-6px;bottom:90px", 2, "glass pill"),
    "girl-feed":
      bub(`${faceTag("w-noor")}<div><small>Yuna · IRLY Nouvelle Arrivante</small>${esc(B.feed[0])}</div>`, "left:-16px;top:120px", 0) +
      bub(`<span class="heart" data-count="22">♥ 22</span>`, "right:6px;top:300px", 2, "glass pill") +
      bub(`${faceTag("g-sofia")}<div><small>${esc(byId("g-sofia")?.name ?? "")}</small>Saturday 11:00 ✨</div>`, "right:-10px;bottom:110px", 3),
    "girl-post": B.comments.map(([id, text], i) => bub(`${faceTag(id)}<div><small>${esc(byId(id)?.name ?? "")}</small>${esc(text)}</div>`, `${i % 2 ? "right:-14px" : "left:-14px"};top:${80 + i * 92}px`, i)).join(""),
    "girl-invite":
      bub(`${faceTag("g-sofia")}<div><small>IRLY Girl</small>${esc(B.connect[0])}</div>`, "left:-18px;top:70px", 0) +
      bub(`✓ ${esc(B.connect[1])}`, "right:4px;top:330px", 2, "pink pill") +
      bub(`${faceTag("w-noor")}<div>${esc(B.connect[2])}</div>`, "left:-10px;bottom:90px", 3),
    "girl-chat": `<div class="tchips">${B.groups.map((g, i) => bub(esc(g), "", i * 0.5, i === 0 ? "pink pill" : "glass pill")).join("")}</div>`,
  };
  const tourHtml = tourScenes.length
    ? `<section id="tour" class="tour" aria-roledescription="carousel" aria-label="${esc(tt.label)}"><div class="wrap tgrid">
  <div class="tstage" aria-hidden="true">
    <div class="tphone"><div class="scr">${tourScenes.map((x, i) => `<img src="${shot(x.shot)}" alt="" width="780" height="1688"${i ? ' loading="lazy"' : ""} decoding="async" data-i="${i}"${i ? "" : ' class="on"'}>`).join("")}</div></div>
    <div class="tlayer">${tourScenes.map((x, i) => `<div data-i="${i}"${i ? "" : ' class="on"'}>${layers[x.shot] ?? ""}</div>`).join("")}</div>
  </div>
  <div class="tcopy">
    <p class="k">${esc(tt.k)}</p>
    <div class="tslides" aria-live="polite">${tourScenes
      .map(
        (x, i) =>
          `<article class="tslide${i ? "" : " on"}" role="group" aria-roledescription="slide" aria-label="${i + 1} / ${tourScenes.length}" data-i="${i}"${i ? ' aria-hidden="true"' : ""}><p class="kicker">${esc(x.k)}</p><h2>${esc(x.t)}</h2><p class="p">${esc(x.p)}</p>${i === tourScenes.length - 1 ? `<a class="btn" href="${APP_GIRL}"${i ? ' tabindex="-1"' : ""}>${esc(tt.cta)}</a>` : ""}</article>`,
      )
      .join("")}</div>
    <div class="tctrl">
      <button type="button" class="tprev" aria-label="${esc(tt.prev)}">←</button>
      <div class="tdots">${tourScenes.map((x, i) => `<button type="button" aria-label="${i + 1}. ${esc(x.k)}"${i ? "" : ' class="on" aria-current="true"'}><span><i></i></span></button>`).join("")}</div>
      <button type="button" class="tnext" aria-label="${esc(tt.next)}">→</button>
      <button type="button" class="tplay" aria-label="${esc(tt.pause)}" data-pause="${esc(tt.pause)}" data-play="${esc(tt.play)}">❚❚</button>
    </div>
    <p class="fine">${esc(tt.note)}</p>
  </div>
</div></section>`
    : "";
  const words = (s, d0) =>
    s
      .split(" ")
      .map(
        (w, i) =>
          `<span class="w" style="animation-delay:${(d0 + i * 0.07).toFixed(2)}s">${esc(w)}</span>`,
      )
      .join(" ");
  const navLinksHtml = navLinks(false);
  const heroAlt = lang === "fr" ? "Deux amies lèvent les bras face à la Burj Khalifa au coucher du soleil" : "Two friends raising their arms facing the Burj Khalifa at sunset";

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
<meta property="og:image" content="${SITE + img("girlsOut")}">
<meta property="og:image:alt" content="${esc(heroAlt)}">
<meta property="og:locale" content="${t.locale}">
<meta property="og:locale:alternate" content="${T[other].locale}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(t.title)}">
<meta name="twitter:description" content="${esc(t.description)}">
<meta name="twitter:image" content="${SITE + img("girlsOut")}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Manrope:wght@400;500;600;700;800&display=swap">
<link rel="preload" as="image" href="${img("girlsOut")}" imagesrcset="${thumb("girlsOut")} ${jpegSize(`site${thumb("girlsOut")}`)[0]}w, ${img("girlsOut")} ${jpegSize(`site${img("girlsOut")}`)[0]}w" imagesizes="(max-width: 920px) 90vw, 460px">
<style>${CSS}</style>
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>
<body>
<a class="skip" href="#main">${lang === "fr" ? "Aller au contenu" : "Skip to content"}</a>
<header class="top" id="top"><div class="bar glass">
  <a class="logo" translate="no" href="${href(lang)}" aria-label="IRLY Girl"><b>IRLY</b><i aria-hidden="true"></i><span>Girl</span></a>
  <nav class="links" aria-label="${lang === "fr" ? "Principale" : "Main"}">${navLinksHtml}</nav>
  <a class="lang" href="${href(other)}" hreflang="${other}" lang="${other}">${t.other}</a>
  <a class="btn small" href="${APP_GIRL}">${t.open}</a>
  <button class="menu-btn" type="button" aria-expanded="false" aria-controls="sheet" aria-label="${t.menu}"><span></span><span></span></button>
</div></header>
<nav class="sheet" id="sheet" aria-label="${t.menu}" aria-hidden="true">${navLinks(true)}<a class="btn" href="${APP_GIRL}">${t.open}</a></nav>
<main id="main">
<section class="hero"><div class="wrap grid">
  <div>
    <p class="kicker">${t.kicker}</p>
    <h1>${words(t.h1a, 0.05)} <em>${words(t.h1b, 0.35)}</em></h1>
    <p class="lead">${t.lead}</p>
    <div class="ctas"><a class="btn" href="${APP_GIRL}">${t.open}</a><a class="btn ghost" href="#uses">${t.how}</a></div>
    <p class="note">${t.webNote}</p>
    <div class="faces">${heroFaces.map((p, i) => fc(p, p.name, false, ` style="animation-delay:${(0.6 + i * 0.07).toFixed(2)}s"`)).join("")}<small>${esc(t.illustrative)}</small></div>
  </div>
  <div class="stage">
    <div class="main">${own("girlsOut", heroAlt, "(max-width: 920px) 90vw, 460px", "", false, ' fetchpriority="high"')}</div>
    ${floating.map((p, i) => `<div class="card-p ${"abc"[i]} glass">${fc(p, "", false)}<div>${esc(p.name)}<small>${esc(like(p.likes[0]))} · ${esc(p.area)}</small></div></div>`).join("\n    ")}
  </div>
</div></section>

<section id="uses" class="uses-sec"><div class="wrap">
  <div class="head"><div><p class="k">${t.usesK}</p><h2>${t.usesT}</h2><p class="p">${t.usesP}</p></div></div>
  <div class="uses">${t.uses
    .map(
      ([photo, title, text, alt], i) =>
        `<article class="use reveal" style="--d:${((i % 3) * 0.08).toFixed(2)}s"><div class="ph">${own(photo, alt, "(max-width: 600px) 92vw, (max-width: 920px) 46vw, 370px")}</div><div class="tx"><h3>${esc(title)}</h3><p>${esc(text)}</p></div></article>`,
    )
    .join("")}</div>
</div></section>

<section id="circles"><div class="wrap">
  <div class="head"><div><p class="k">${t.circlesK}</p><h2>${t.circlesT}</h2><p class="p">${t.circlesP}</p></div></div>
  <div class="circles">${t.circles
    .map(
      ([name, about, photo, emoji, alt], i) =>
        `<article class="circle glass reveal" style="--d:${(i * 0.08).toFixed(2)}s">${own(photo, alt, "150px", "cv")}<div><b translate="no"><span aria-hidden="true">${emoji}</span> ${esc(name)}</b><p>${esc(about)}</p></div></article>`,
    )
    .join("")}</div>
</div></section>

${tourHtml}

<section id="plans"><div class="wrap">
  <div class="head"><div><p class="k">${t.plansK}</p><h2>${t.plansT}</h2><p class="p">${t.plansP}</p></div><span class="label">${esc(t.illustrative)}</span></div>
  <div class="rail">${t.plans
    .map(([photo, name, when], i) => {
      const who = pick(4 + i * 3, 3 + (i % 3));
      return `<article class="plan reveal" style="--d:${(Math.min(i, 4) * 0.06).toFixed(2)}s"><div class="ph">${own(photo, "", "(max-width: 920px) 76vw, 290px")}<span class="chip glass">${esc(when)}</span></div><div class="body"><div><b>${esc(name)}</b><small>${who.length} ${t.going}</small></div><div class="stack">${avatars(who, 3)}</div></div></article>`;
    })
    .join("")}</div>
</div></section>

<section id="people"><div class="wrap">
  <div class="head"><div><p class="k">${t.peopleK}</p><h2>${t.peopleT}</h2><p class="p">${t.peopleP}</p></div><span class="label">${esc(t.illustrative)}</span></div>
  <div class="wall">${wall
    .map(
      (p, i) =>
        `<figure class="pc ${sizes[i] ?? ""} reveal" style="--d:${((i % 6) * 0.06).toFixed(2)}s">${fc(p)}<figcaption class="meta glass"><b>${esc(p.name)}</b><span>${esc(p.area)}</span><span class="tags">${p.likes.map((l) => `<i>${esc(like(l))}</i>`).join("")}</span></figcaption></figure>`,
    )
    .join("")}</div>
</div></section>

<section id="access" class="access-sec"><div class="wrap">
  <div class="head"><div><p class="k">${t.accessK}</p><h2>${t.accessT}</h2></div></div>
  <ol class="steps">${t.access.map(([h, p], i) => `<li class="reveal" style="--d:${(i * 0.08).toFixed(2)}s"><span class="n" aria-hidden="true">${i + 1}</span><h3>${esc(h)}</h3><p>${esc(p)}</p></li>`).join("")}</ol>
  <p class="k" style="margin-top:44px">${t.safeK}</p>
  <ul class="safe">${t.safe.map((s) => `<li class="reveal">${esc(s)}</li>`).join("")}</ul>
  <div class="ctas" style="margin-top:28px"><a class="btn" href="${APP_GIRL}">${t.open}</a></div>
</div></section>

<section><div class="wrap"><div class="soon glass reveal"><span class="badge">${t.soonK}</span><h2>${t.soonT}</h2><p class="p">${t.soonP}</p></div></div></section>

${
  shots.length
    ? `<section id="app"><div class="wrap">
  <div class="head"><div><p class="k">${t.appK}</p><h2>${t.appT}</h2><p class="p">${t.appP}</p></div></div>
  <div class="shots">${shots.map(([n, cap], i) => `<figure class="shot reveal" style="--d:${(i * 0.07).toFixed(2)}s"><div class="phone">${im(shot(n), cap, "", true, ' width="780" height="1688"')}</div><figcaption>${esc(cap)}</figcaption></figure>`).join("")}</div>
</div></section>`
    : ""
}

<section class="faq"><div class="wrap"><h2 class="reveal">${t.faqT}</h2>
  ${t.faq.map(([q, a]) => `<details class="reveal"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("\n  ")}
</div></section>

<section class="end"><div class="wrap reveal"><div class="faces">${avatars(pick(24, 6), 6)}</div><h2>${t.endT}</h2><p class="p" style="margin:0 auto 28px">${t.endP}</p><a class="btn" href="${APP_GIRL}">${t.open}</a></div></section>
</main>
<footer><div class="wrap">
  <span>© 2026 IRLY · <a href="mailto:getirly@gmail.com">getirly@gmail.com</a></span>
  <nav aria-label="Footer"><a href="${home(lang)}">${t.back}</a><a href="${lang === "fr" ? "/fr/privacy" : "/privacy"}">${t.privacy}</a><a href="${lang === "fr" ? "/fr/terms" : "/terms"}">${t.terms}</a><a href="${lang === "fr" ? "/fr/guidelines" : "/guidelines"}">${t.guidelines}</a><a href="${lang === "fr" ? "/fr/support" : "/support"}">${t.support}</a></nav>
</div></footer>
<script>
(() => {
  const bar = document.querySelector('header.top');
  const btn = document.querySelector('.menu-btn');
  const sheet = document.getElementById('sheet');
  const set = (open) => { bar.classList.toggle('open', open); btn.setAttribute('aria-expanded', String(open)); sheet.setAttribute('aria-hidden', String(!open)); document.body.style.overflow = open ? 'hidden' : ''; };
  btn.addEventListener('click', () => set(!bar.classList.contains('open')));
  sheet.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
  matchMedia('(min-width: 921px)').addEventListener('change', (m) => { if (m.matches) set(false); });
  // Tour: autoplay while on screen (paused on hover, focus, hidden tab or reduced motion), swipe, arrows.
  const tour = document.getElementById('tour');
  if (tour) {
    const slides = [...tour.querySelectorAll('.tslide')];
    const imgs = [...tour.querySelectorAll('.tphone img')];
    const layers = [...tour.querySelectorAll('.tlayer>div')];
    const dots = [...tour.querySelectorAll('.tdots button')];
    const playBtn = tour.querySelector('.tplay');
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const N = slides.length, DUR = 6500;
    let cur = 0, start = 0, raf = 0, visible = false, hold = false, paused = reduce;
    const count = (el) => {
      const to = +el.dataset.count + 1;
      if (reduce) { el.textContent = '♥ ' + to; return; }
      el.textContent = '♥ ' + (to - 1);
      setTimeout(() => { el.textContent = '♥ ' + to; el.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' }); }, 1400);
    };
    const go = (n) => {
      cur = (n + N) % N;
      slides.forEach((s, i) => { const on = i === cur; s.classList.toggle('on', on); s.setAttribute('aria-hidden', String(!on)); s.querySelectorAll('a').forEach((a) => (a.tabIndex = on ? 0 : -1)); });
      imgs.forEach((m, i) => m.classList.toggle('on', i === cur));
      layers.forEach((l, i) => l.classList.toggle('on', i === cur));
      dots.forEach((d, i) => { d.classList.toggle('on', i === cur); d.classList.toggle('done', i < cur); d.toggleAttribute('aria-current', i === cur); d.style.setProperty('--p', '0%'); });
      // The next screen loads ahead, so a scene never opens on a blank phone.
      const next = imgs[(cur + 1) % N]; if (next) next.loading = 'eager';
      layers[cur]?.querySelectorAll('[data-count]').forEach(count);
      start = performance.now();
    };
    const tick = (now) => {
      raf = requestAnimationFrame(tick);
      if (paused || hold || !visible || document.hidden) { start = now - (parseFloat(dots[cur].style.getPropertyValue('--p')) || 0) / 100 * DUR; return; }
      const p = Math.min(1, (now - start) / DUR);
      dots[cur].style.setProperty('--p', (p * 100).toFixed(1) + '%');
      if (p >= 1) { if (cur === N - 1) { paused = true; setPlay(); } else go(cur + 1); }
    };
    const setPlay = () => { playBtn.textContent = paused ? '▶' : '❚❚'; playBtn.setAttribute('aria-label', paused ? playBtn.dataset.play : playBtn.dataset.pause); };
    tour.querySelector('.tprev').addEventListener('click', () => go(cur - 1));
    tour.querySelector('.tnext').addEventListener('click', () => go(cur + 1));
    dots.forEach((d, i) => d.addEventListener('click', () => go(i)));
    playBtn.addEventListener('click', () => { paused = !paused; if (!paused && cur === N - 1 && dots[cur].style.getPropertyValue('--p') === '100.0%') go(0); setPlay(); });
    tour.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') hold = true; });
    tour.addEventListener('pointerleave', () => (hold = false));
    tour.addEventListener('focusin', () => (hold = true));
    tour.addEventListener('focusout', () => (hold = false));
    tour.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') go(cur + 1); if (e.key === 'ArrowLeft') go(cur - 1); });
    let x0 = null;
    const stage = tour.querySelector('.tstage');
    stage.addEventListener('pointerdown', (e) => (x0 = e.clientX));
    stage.addEventListener('pointerup', (e) => { if (x0 !== null && Math.abs(e.clientX - x0) > 40) go(cur + (e.clientX < x0 ? 1 : -1)); x0 = null; });
    if ('IntersectionObserver' in window) new IntersectionObserver(([x]) => (visible = x.isIntersecting), { threshold: 0.35 }).observe(tour);
    else visible = true;
    setPlay();
    go(0);
    raf = requestAnimationFrame(tick);
  }
  const els = document.querySelectorAll('.reveal');
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) { els.forEach((e) => e.classList.add('in')); return; }
  // Cards in a sideways rail reveal with their rail: off-screen to the side, they would never intersect.
  const show = (el) => (el.matches('.rail,.shots') ? el.querySelectorAll('.reveal') : [el]).forEach((e) => e.classList.add('in'));
  const io = new IntersectionObserver((list) => list.forEach((x) => { if (x.isIntersecting) { show(x.target); io.unobserve(x.target); } }), { rootMargin: '0px 0px -8% 0px' });
  new Set([...els].map((e) => e.closest('.rail,.shots') || e)).forEach((e) => io.observe(e));
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
