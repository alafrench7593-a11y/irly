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
    title: "IRLY Girl — Girlfriends, plans, memories",
    description:
      "IRLY Girl is the women-only space of IRLY in Dubai: meet women, join communities just for women, plan brunches, padel, girl trips and more, and chat in private or in groups.",
    nav: {
      home: "IRLY",
      people: "Women",
      plans: "Plans",
      circles: "Communities",
      app: "The app",
    },
    menu: "Menu",
    open: "Open IRLY Girl",
    how: "Discover",
    kicker: "Women only · Dubai",
    h1a: "Girlfriends, plans,",
    h1b: "memories.",
    lead: "A space to meet women, make real friends and keep the moments that matter. Inside IRLY, just for women.",
    webNote:
      "Works in your browser today. iPhone and Android apps are coming soon.",
    illustrative:
      "Illustrative profiles — a preview of the IRLY Girl experience. They are not IRLY members.",
    peopleK: "Discover",
    peopleT: "Women who like what you like.",
    peopleP:
      "Brunch lovers, padel players, readers, runners, founders, travellers. IRLY Girl brings together women from everywhere who live in the UAE, around the plans you enjoy.",
    journalK: "Your story",
    journalT: "Every plan becomes a page.",
    journalP:
      "The plans you join stay in your calendar, and each one keeps its own chat with the photos you shared. Week after week, it starts to look like a diary of your new life here.",
    journalNote:
      "Pages shown are illustrative. IRLY has no private journal feature: these are your plans, chats and photos.",
    notes: [
      [
        "Saturday",
        "First brunch with the girls. Stayed until 4.",
        "brunchGirl",
      ],
      [
        "Tuesday",
        "Pilates at 7. Coffee after, we already have a next time.",
        "pilatesGirl",
      ],
      [
        "Friday",
        "Desert sunset. Three of us, zero signal, best evening.",
        "girlTrip",
      ],
    ],
    plansK: "Plans",
    plansT: "What women plan together.",
    plansP:
      "Pick a day and a time, the plan gets its own chat and lands in your calendar. These are the kinds of plans you can create in IRLY Girl.",
    plans: [
      ["brunchGirl", "Brunch", "Saturday, 11:00"],
      ["drinksGirl", "Coffee & matcha", "Weekday, 08:00"],
      ["pilatesGirl", "Pilates", "Tuesday, 19:00"],
      ["padelGirl", "Padel", "Thursday, 20:00"],
      ["beachClubGirl", "Beach club", "Sunday, 13:00"],
      ["yachtGirl", "Yacht day", "Friday, 16:00"],
      ["readingGirl", "Book club", "Wednesday, 19:30"],
      ["girlTrip", "Girl trip", "Oman, Bali, Qatar…"],
      ["spaGirl", "Spa & wellness", "Sunday, 10:00"],
    ],
    going: "going",
    circlesK: "Communities",
    circlesT: "Circles that feel like yours.",
    circlesP:
      "Join communities just for women, or start your own in a minute. Each has its own group chat. The communities below are examples.",
    circles: [
      [
        "New in Dubai",
        "For women who just arrived: first coffees, first friends, the useful tips.",
        "girlsOut",
      ],
      [
        "Sunrise Runners",
        "Easy 5 km along the beach, then coffee. Every pace welcome.",
        "runGirl",
      ],
      [
        "Book & Matcha Club",
        "One book a month, one café, good conversations.",
        "readingGirl",
      ],
      [
        "Women Who Build",
        "Founders and professionals meeting over coffee and ideas.",
        "networkingGirl",
      ],
    ],
    tour: {
      k: "A tour of IRLY Girl",
      label: "IRLY Girl, scene by scene",
      note: "Real screens of the IRLY demo, with example women and conversations. They are not IRLY members.",
      prev: "Previous scene",
      next: "Next scene",
      pause: "Pause",
      play: "Play",
      cta: "Discover IRLY Girl",
      scenes: [
        { shot: "girl-home", k: "Welcome", t: "A little space that feels like yours.", p: "IRLY Girl lives inside IRLY, just for women: your plans, your circles and your chats, in one soft corner of the app." },
        { shot: "girl-feed", k: "The community", t: "Meet the girls around you.", p: "New friends in Dubai, brunch spots, padel partners, travel plans, small wins. Posts come from the women-only communities near you." },
        { shot: "girl-post", k: "Conversations", t: "Real conversations, not polished ones.", p: "Comments, replies and likes, in English, French or Arabic. A hello can turn into a plan in a few messages." },
        { shot: "girl-invite", k: "Connections", t: "From a post to a plan to a friend.", p: "Join a plan in one tap, see who’s going, and talk it through in its group chat before you meet." },
        { shot: "girl-profile", k: "International", t: "Women from everywhere, living here.", p: "Every profile says who she is, where she’s from and what she loves. Your exact location is never shown." },
        { shot: "girl-group", k: "Groups & plans", t: "Circles for every part of your life.", p: "New in Dubai, Girls Brunch Club, Fitness Girls, Solo Girls… each with its posts, its plans and its chat." },
        { shot: "girl-communities", k: "Your turn", t: "Your people might be closer than you think.", p: "Open IRLY Girl in your browser today. iPhone and Android apps are coming soon." },
      ],
      bubbles: {
        welcome: ["Girls brunch · Sat 11:00", "Sunrise yoga · Kite Beach"],
        feed: ["Girls, I just landed in Dubai and I’m looking for girls to discover the city with 🩷"],
        comments: [["g-nour", "Welcome girl!! 🥹"], ["g-sofia", "We should organise a girls brunch!"], ["w-ana", "I’m new here too, let’s go together!"], ["g-ines", "Girls, on devrait vraiment créer un petit groupe."], ["g-hana", "Count me in 🤍"]],
        connect: ["Sofía invited you to Girls brunch in Jumeirah", "You’re going · 6/8", "Yuna: Want to meet at the entrance at 6:15?"],
        world: "Example profiles of the demo",
        groups: ["Girls in Dubai", "New in Dubai", "Girls Brunch Club", "Coffee & Besties", "Fitness Girls", "Girls Who Travel", "Fashion & Beauty", "Solo Girls", "IRLY Girl Community"],
      },
    },
    members: "members shown here are illustrative",
    appK: "The app",
    appT: "Real screens, as they are today.",
    appP: "Captured from IRLY’s demo build. IRLY Match is shown as coming soon, as it is in the app.",
    shots: [
      ["girl-home", "IRLY Girl home"],
      ["girl-feed", "Recent posts"],
      ["girl-post", "A post and its comments"],
      ["girl-profile", "A profile"],
      ["girl-communities", "Communities"],
      ["girl-group", "A community"],
      ["girl-chat", "Group chat"],
      ["girl-plans", "Plans coming up"],
      ["girl-invite", "Joining a plan"],
      ["girl-notifications", "Notifications"],
      ["girl-create", "Writing a post"],
      ["girl-me", "Your profile"],
    ],
    safeK: "Your safety",
    safeT: "A space that stays women only.",
    safe: [
      "Access follows the gender on your IRLY account, chosen when the account is created. It cannot be changed afterwards from the app, and IRLY’s servers check it on every women-only page, plan, community and chat.",
      "Your exact location is never shown, only your area.",
      "Block or report anyone. Reports are reviewed by the IRLY team, and an account can lose access to IRLY Girl.",
    ],
    soonK: "Coming soon",
    soonT: "IRLY Match.",
    soonP:
      "Meet women who share your interests, matched on what you love. It is not open yet: for now, communities and plans are where friendships start.",
    faqT: "Questions",
    faq: [
      [
        "Who can join IRLY Girl?",
        "Women with an IRLY account. Access is decided by the gender on the account, checked by IRLY’s servers, not only by the app.",
      ],
      [
        "Are the women on this page members?",
        "No. They are illustrative profiles that show what IRLY Girl looks like. Real members only appear inside the app, to other members.",
      ],
      [
        "Is it a dating app?",
        "No. IRLY Girl is about friendship and social life between women: communities, plans and conversations.",
      ],
      [
        "How much does it cost?",
        "IRLY Girl is free. Some plans, like a brunch or a class, have a price set by the person who organises them.",
      ],
      [
        "Where is it available?",
        "In Dubai and across the UAE, in your browser on getirly.com. The iPhone and Android apps are coming soon.",
      ],
    ],
    endT: "Your next girlfriends are one plan away.",
    endP: "Sign in with your IRLY account and open IRLY Girl.",
    back: "Back to IRLY",
    privacy: "Privacy",
    guidelines: "Community guidelines",
    support: "Support",
  },
  fr: {
    locale: "fr_FR",
    other: "English",
    otherLang: "en",
    title: "IRLY Girl — Des copines, des sorties, des souvenirs",
    description:
      "IRLY Girl est l’espace réservé aux femmes d’IRLY à Dubaï : rencontrer des femmes, rejoindre des communautés féminines, organiser brunchs, padel, girl trips et plus, et discuter en privé ou en groupe.",
    nav: {
      home: "IRLY",
      people: "Femmes",
      plans: "Sorties",
      circles: "Communautés",
      app: "L’app",
    },
    menu: "Menu",
    open: "Ouvrir IRLY Girl",
    how: "Découvrir",
    kicker: "Réservé aux femmes · Dubaï",
    h1a: "Des copines, des sorties,",
    h1b: "des souvenirs.",
    lead: "Un espace pour rencontrer des femmes, se faire de vraies amies et garder les moments qui comptent. Dans IRLY, rien que pour les femmes.",
    webNote:
      "Fonctionne déjà dans ton navigateur. Les apps iPhone et Android arrivent bientôt.",
    illustrative:
      "Profils illustratifs — aperçu de l’expérience IRLY Girl. Ce ne sont pas des membres d’IRLY.",
    peopleK: "Découvrir",
    peopleT: "Des femmes qui aiment ce que tu aimes.",
    peopleP:
      "Amatrices de brunch, joueuses de padel, lectrices, runneuses, entrepreneures, voyageuses. IRLY Girl réunit des femmes venues de partout qui vivent aux Émirats, autour des sorties que tu aimes.",
    journalK: "Ton histoire",
    journalT: "Chaque sortie devient une page.",
    journalP:
      "Les sorties que tu rejoins restent dans ton calendrier, et chacune garde sa conversation avec les photos partagées. Semaine après semaine, ça ressemble au journal de ta nouvelle vie ici.",
    journalNote:
      "Pages illustratives. IRLY n’a pas de fonction journal intime : ce sont tes sorties, tes conversations et tes photos.",
    notes: [
      [
        "Samedi",
        "Premier brunch avec les filles. On est restées jusqu’à 16 h.",
        "brunchGirl",
      ],
      [
        "Mardi",
        "Pilates à 7 h. Café après, on a déjà une prochaine fois.",
        "pilatesGirl",
      ],
      [
        "Vendredi",
        "Coucher de soleil dans le désert. À trois, zéro réseau, meilleure soirée.",
        "girlTrip",
      ],
    ],
    plansK: "Sorties",
    plansT: "Ce que les femmes organisent ensemble.",
    plansP:
      "Choisis le jour et l’heure : la sortie a sa conversation et arrive dans ton calendrier. Voici les types de sorties que tu peux créer dans IRLY Girl.",
    plans: [
      ["brunchGirl", "Brunch", "Samedi, 11 h"],
      ["drinksGirl", "Café & matcha", "En semaine, 8 h"],
      ["pilatesGirl", "Pilates", "Mardi, 19 h"],
      ["padelGirl", "Padel", "Jeudi, 20 h"],
      ["beachClubGirl", "Beach club", "Dimanche, 13 h"],
      ["yachtGirl", "Journée en yacht", "Vendredi, 16 h"],
      ["readingGirl", "Club de lecture", "Mercredi, 19 h 30"],
      ["girlTrip", "Girl trip", "Oman, Bali, Qatar…"],
      ["spaGirl", "Spa & bien-être", "Dimanche, 10 h"],
    ],
    going: "participent",
    circlesK: "Communautés",
    circlesT: "Des cercles qui te ressemblent.",
    circlesP:
      "Rejoins des communautés réservées aux femmes, ou crée la tienne en une minute. Chacune a sa conversation de groupe. Les communautés ci-dessous sont des exemples.",
    circles: [
      [
        "Nouvelles à Dubaï",
        "Pour celles qui viennent d’arriver : premiers cafés, premières amies, les bons plans.",
        "girlsOut",
      ],
      [
        "Sunrise Runners",
        "5 km tranquilles le long de la plage, puis un café. Tous les rythmes.",
        "runGirl",
      ],
      [
        "Book & Matcha Club",
        "Un livre par mois, un café, de vraies conversations.",
        "readingGirl",
      ],
      [
        "Femmes qui entreprennent",
        "Entrepreneures et professionnelles autour d’un café et d’idées.",
        "networkingGirl",
      ],
    ],
    tour: {
      k: "IRLY Girl en visite",
      label: "IRLY Girl, scène par scène",
      note: "De vrais écrans de la démo d’IRLY, avec des femmes et des conversations d’exemple. Ce ne sont pas des membres d’IRLY.",
      prev: "Scène précédente",
      next: "Scène suivante",
      pause: "Pause",
      play: "Lecture",
      cta: "Découvrir IRLY Girl",
      scenes: [
        { shot: "girl-home", k: "Bienvenue", t: "Un petit espace qui te ressemble.", p: "IRLY Girl vit dans IRLY, rien qu’entre femmes : tes sorties, tes cercles et tes conversations, dans un coin doux de l’app." },
        { shot: "girl-feed", k: "La communauté", t: "Rencontre les filles autour de toi.", p: "Nouvelles amitiés à Dubaï, bonnes adresses, partenaires de padel, voyages, petites victoires. Les publications viennent des communautés féminines près de toi." },
        { shot: "girl-post", k: "Conversations", t: "De vraies conversations, pas des vitrines.", p: "Commentaires, réponses et j’aime, en français, en anglais ou en arabe. Un bonjour devient une sortie en quelques messages." },
        { shot: "girl-invite", k: "Des liens", t: "D’une publication à une sortie, puis à une amie.", p: "Rejoins une sortie en un geste, vois qui vient, et parlez-en dans sa conversation de groupe avant de vous retrouver." },
        { shot: "girl-profile", k: "International", t: "Des femmes de partout, qui vivent ici.", p: "Chaque profil dit qui elle est, d’où elle vient et ce qu’elle aime. Ta position exacte n’est jamais affichée." },
        { shot: "girl-group", k: "Groupes et sorties", t: "Des cercles pour chaque partie de ta vie.", p: "New in Dubai, Girls Brunch Club, Fitness Girls, Solo Girls… chacun avec ses publications, ses sorties et sa conversation." },
        { shot: "girl-communities", k: "À toi", t: "Tes personnes sont peut-être plus proches que tu ne le crois.", p: "Ouvre IRLY Girl dans ton navigateur dès aujourd’hui. Les apps iPhone et Android arrivent bientôt." },
      ],
      bubbles: {
        welcome: ["Girls brunch · sam. 11:00", "Sunrise yoga · Kite Beach"],
        feed: ["Girls, I just landed in Dubai and I’m looking for girls to discover the city with 🩷"],
        comments: [["g-nour", "Welcome girl!! 🥹"], ["g-sofia", "We should organise a girls brunch!"], ["w-ana", "I’m new here too, let’s go together!"], ["g-ines", "Girls, on devrait vraiment créer un petit groupe."], ["g-hana", "Count me in 🤍"]],
        connect: ["Sofía t’invite à Girls brunch in Jumeirah", "Tu y vas · 6/8", "Yuna : On se retrouve à l’entrée à 6h15 ?"],
        world: "Profils d’exemple de la démo",
        groups: ["Girls in Dubai", "New in Dubai", "Girls Brunch Club", "Coffee & Besties", "Fitness Girls", "Girls Who Travel", "Fashion & Beauty", "Solo Girls", "IRLY Girl Community"],
      },
    },
    members: "les membres montrés ici sont illustratifs",
    appK: "L’app",
    appT: "De vrais écrans, tels qu’ils sont aujourd’hui.",
    appP: "Captures de la version de démonstration d’IRLY. IRLY Match y apparaît « bientôt disponible », comme dans l’app.",
    shots: [
      ["girl-home", "Accueil IRLY Girl"],
      ["girl-feed", "Publications récentes"],
      ["girl-post", "Une publication et ses commentaires"],
      ["girl-profile", "Un profil"],
      ["girl-communities", "Communautés"],
      ["girl-group", "Une communauté"],
      ["girl-chat", "Conversation de groupe"],
      ["girl-plans", "Sorties à venir"],
      ["girl-invite", "Rejoindre une sortie"],
      ["girl-notifications", "Notifications"],
      ["girl-create", "Écrire une publication"],
      ["girl-me", "Ton profil"],
    ],
    safeK: "Ta sécurité",
    safeT: "Un espace qui reste entre femmes.",
    safe: [
      "L’accès dépend du genre de ton compte IRLY, choisi à sa création. Il ne peut plus être changé depuis l’app, et les serveurs d’IRLY le vérifient sur chaque page, sortie, communauté et conversation réservées aux femmes.",
      "Ta position exacte n’est jamais affichée, seulement ton quartier.",
      "Bloque ou signale n’importe qui. L’équipe IRLY examine les signalements, et un compte peut perdre l’accès à IRLY Girl.",
    ],
    soonK: "Bientôt disponible",
    soonT: "IRLY Match.",
    soonP:
      "Rencontrer des femmes qui partagent tes centres d’intérêt. Ce n’est pas encore ouvert : pour l’instant, les amitiés commencent dans les communautés et les sorties.",
    faqT: "Questions",
    faq: [
      [
        "Qui peut rejoindre IRLY Girl ?",
        "Les femmes qui ont un compte IRLY. L’accès dépend du genre du compte, vérifié par les serveurs d’IRLY, pas seulement par l’app.",
      ],
      [
        "Les femmes de cette page sont-elles membres ?",
        "Non. Ce sont des profils illustratifs qui montrent à quoi ressemble IRLY Girl. Les vraies membres n’apparaissent que dans l’app, aux autres membres.",
      ],
      [
        "Est-ce une app de rencontres amoureuses ?",
        "Non. IRLY Girl est fait pour l’amitié et la vie sociale entre femmes : communautés, sorties et conversations.",
      ],
      [
        "Combien ça coûte ?",
        "IRLY Girl est gratuit. Certaines sorties, comme un brunch ou un cours, ont un prix fixé par la personne qui les organise.",
      ],
      [
        "Où est-ce disponible ?",
        "À Dubaï et dans tous les Émirats, dans ton navigateur sur getirly.com. Les apps iPhone et Android arrivent bientôt.",
      ],
    ],
    endT: "Tes prochaines copines sont à une sortie près.",
    endP: "Connecte-toi avec ton compte IRLY et ouvre IRLY Girl.",
    back: "Retour à IRLY",
    privacy: "Confidentialité",
    guidelines: "Règles de la communauté",
    support: "Assistance",
  },
};

const CSS = `
:root{--bg:#FFF6F8;--cream:#FBF1EC;--beige:#F3E2DC;--surface:#FFFFFF;--blush:#F8DCE7;--pastel:#F6C5D8;--brand:#E83E87;--rose:#C92F72;--ink:#382832;--soft:#7E6873;--warm:#A2938F;--line:rgba(201,47,114,.14);--glass:rgba(255,255,255,.58);--glass-line:rgba(255,255,255,.75);--ease:cubic-bezier(.2,.7,.2,1);--spring:cubic-bezier(.34,1.4,.5,1)}
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
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:52px;padding:0 26px;border-radius:999px;background:linear-gradient(135deg,#D63579,#C2296B);color:#fff;font-weight:700;font-size:16px;text-decoration:none;box-shadow:0 12px 30px rgba(201,47,114,.24);transition:transform .25s var(--ease),box-shadow .25s var(--ease);position:relative;overflow:hidden}
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
/* Journal */
.journal{background:linear-gradient(180deg,var(--bg),var(--cream))}
.pages{display:grid;grid-template-columns:repeat(3,1fr);gap:26px;margin-top:40px;perspective:1400px}
.page{background:#FFFDFB;border-radius:6px 22px 22px 6px;padding:18px 18px 22px;box-shadow:0 1px 0 #f3e6e0 inset,6px 0 0 #F3E2DC inset,0 22px 44px rgba(56,40,50,.10);transform-origin:left center;position:relative;transition:transform 1.1s var(--ease),opacity .8s;transition-delay:var(--d,0s)}
.page:nth-child(1){--r:rotate(-1.6deg)}.page:nth-child(2){--r:rotate(1deg) translateY(18px);--d:.12s}.page:nth-child(3){--r:rotate(-.6deg);--d:.24s}
.page{transform:var(--r)}
.page.reveal{opacity:0;transform:rotateY(-28deg) translateX(-14px)}
.page.reveal.in{opacity:1;transform:var(--r)}
.page .tape{position:absolute;top:-10px;left:50%;width:84px;height:22px;transform:translateX(-50%) rotate(-3deg);background:rgba(246,197,216,.75);border-radius:3px}
.page img.ph{width:100%;aspect-ratio:4/3;object-fit:cover;border-radius:12px;background:var(--blush)}
.page .day{font-size:11px;font-weight:800;letter-spacing:.2em;text-transform:uppercase;color:var(--warm);margin:14px 0 4px}
.page p.txt{font:italic 400 22px/1.25 "Instrument Serif",Georgia,serif;margin:0 0 12px}
.page .who{display:flex;align-items:center;gap:8px;font-size:12px;color:var(--soft)}
.page .who img{width:24px;height:24px;border-radius:50%;object-fit:cover;margin-inline-start:-6px;border:2px solid #FFFDFB}
.page .who img:first-child{margin-inline-start:0}
.fine{font-size:12.5px;color:var(--soft);margin:34px 0 0}
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
@media (max-width:920px){.links,.bar .btn.small{display:none}.menu-btn{display:grid}.lang{margin-inline-start:auto}.hero{padding-top:34px}.hero .grid{grid-template-columns:1fr;gap:34px}.stage{max-width:460px;width:100%;margin-inline:auto}.wall{grid-template-columns:repeat(2,1fr);grid-auto-rows:104px}.pages{grid-template-columns:1fr;max-width:420px;margin-inline:auto;gap:34px}.circles{grid-template-columns:1fr}section{padding:56px 0}.soon{padding:32px 22px}}
@media (max-width:480px){.circle{grid-template-columns:96px 1fr}.circle img.cv{width:96px;height:96px}.card-p{font-size:12px;padding-inline-end:12px}.card-p img{width:34px;height:34px}.card-p.b{left:0}.hero .faces{flex-wrap:wrap;row-gap:10px}.hero .faces small{flex-basis:100%;margin-inline-start:0;max-width:none}.pc .tags i:nth-child(n+2){display:none}}
:focus-visible{outline:3px solid var(--brand);outline-offset:3px;border-radius:8px}
`;

function page(lang) {
  const t = T[lang];
  const other = t.otherLang;
  const like = (l) => (lang === "fr" ? (LIKES_FR[l] ?? l) : l);
  const im = (src, alt, cls = "", lazy = true, extra = "") =>
    `<img${cls ? ` class="${cls}"` : ""} src="${src}" alt="${esc(alt)}"${lazy ? ' loading="lazy"' : ""} decoding="async" onerror="this.classList.add('missing')"${extra}>`;
  const ph = (k) =>
    im(
      img(k),
      "",
      "",
      true,
      ` srcset="${thumb(k)} 480w, ${img(k)} 1200w" sizes="(max-width: 920px) 76vw, 290px"`,
    );
  const avatars = (people, max = 4) =>
    people
      .slice(0, max)
      .map((p) => im(face(p.id), p.name))
      .join("");
  const nav = [
    [t.nav.home, home(lang)],
    [t.nav.people, "#people"],
    [t.nav.plans, "#plans"],
    [t.nav.circles, "#circles"],
    [t.nav.app, "#app", "hide-md"],
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
  const wall = pick(0, Math.min(CAST.length, 24));
  const sizes = [
    "big",
    "",
    "tall",
    "",
    "wide",
    "",
    "",
    "tall",
    "",
    "big",
    "",
    "",
    "wide",
    "tall",
    "",
    "",
    "",
    "",
    "big",
    "",
    "tall",
    "",
    "",
    "",
  ];
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
  // The tour: seven scenes, each a real screen of the demo with the cards it shows coming alive.
  const tt = t.tour;
  const tourScenes = tt.scenes.filter((x) => fs.existsSync(`site/shots/${x.shot}.jpg`));
  const byId = (id) => CAST.find((c) => c.id === id);
  const bub = (html, style, i, cls = "glass") => `<div class="tb ${cls}" style="${style};--i:${i}">${html}</div>`;
  const faceTag = (id) => (byId(id) ? im(face(byId(id).id), "", "", true) : "");
  const B = tt.bubbles;
  const layers = [
    `<div class="tlogo glass" translate="no"><b>IRLY</b><i aria-hidden="true"></i><span>Girl</span></div>` +
      bub(esc(B.welcome[0]), "left:-6px;bottom:150px", 1, "glass pill") +
      bub(esc(B.welcome[1]), "right:-6px;bottom:90px", 2, "glass pill"),
    bub(`${faceTag("w-noor")}<div><small>Yuna · New in Dubai</small>${esc(B.feed[0])}</div>`, "left:-16px;top:120px", 0) +
      bub(`<span class="heart" data-count="22">♥ 22</span>`, "right:6px;top:300px", 2, "glass pill") +
      bub(`${faceTag("g-sofia")}<div><small>${esc(byId("g-sofia")?.name ?? "")}</small>Saturday 11:00 ✨</div>`, "right:-10px;bottom:110px", 3),
    B.comments.map(([id, text], i) => bub(`${faceTag(id)}<div><small>${esc(byId(id)?.name ?? "")}</small>${esc(text)}</div>`, `${i % 2 ? "right:-14px" : "left:-14px"};top:${80 + i * 92}px`, i)).join(""),
    bub(`${faceTag("g-sofia")}<div><small>IRLY Girl</small>${esc(B.connect[0])}</div>`, "left:-18px;top:70px", 0) +
      bub(`✓ ${esc(B.connect[1])}`, "right:4px;top:330px", 2, "pink pill") +
      bub(`${faceTag("w-noor")}<div>${esc(B.connect[2])}</div>`, "left:-10px;bottom:90px", 3),
    `<div class="tring">${pick(0, 8)
      .map((c, i) => {
        const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
        return bub(`${im(face(c.id), c.name)}<span>${esc(c.name)}</span>`, `left:calc(50% + ${Math.cos(a).toFixed(3)} * var(--rx) - 38px);top:calc(50% + ${Math.sin(a).toFixed(3)} * var(--ry) - 46px)`, i % 4);
      })
      .join("")}</div>` + bub(esc(B.world), "left:50%;bottom:6px;transform:translateX(-50%)", 4, "glass pill"),
    `<div class="tchips">${B.groups.map((g, i) => bub(esc(g), "", Math.min(i, 8) * 0.5, i === 1 ? "pink pill" : "glass pill")).join("")}</div>`,
    `<div class="tchips" style="top:auto;bottom:120px;left:-10px;right:auto;justify-items:start">${bub(`<span class="stack">${pick(4, 4).map((c) => im(face(c.id), "")).join("")}</span>`, "", 0, "glass pill")}</div>`,
  ];
  const tourHtml = tourScenes.length
    ? `<section id="tour" class="tour" aria-roledescription="carousel" aria-label="${esc(tt.label)}"><div class="wrap tgrid">
  <div class="tstage" aria-hidden="true">
    <div class="tphone"><div class="scr">${tourScenes.map((x, i) => `<img src="${shot(x.shot)}" alt=""${i ? ' loading="lazy"' : ""} decoding="async" data-i="${i}"${i ? "" : ' class="on"'}>`).join("")}</div></div>
    <div class="tlayer">${tourScenes.map((_, i) => `<div data-i="${i}"${i ? "" : ' class="on"'}>${layers[i] ?? ""}</div>`).join("")}</div>
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

  return `<!doctype html>
<html lang="${lang}" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#FFF6F8">
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
<meta property="og:locale" content="${t.locale}">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Manrope:wght@400;500;600;700;800&display=swap">
<link rel="preload" as="image" href="${img("girlsOut")}">
<style>${CSS}</style>
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>
<body>
<header class="top" id="top"><div class="bar glass">
  <a class="logo" translate="no" href="${home(lang)}" aria-label="IRLY"><b>IRLY</b><i aria-hidden="true"></i><span>Girl</span></a>
  <nav class="links" aria-label="${lang === "fr" ? "Principale" : "Main"}">${navLinksHtml}</nav>
  <a class="lang" href="${href(other)}" hreflang="${other}" lang="${other}">${t.other}</a>
  <a class="btn small" href="${APP_GIRL}">${t.open}</a>
  <button class="menu-btn" type="button" aria-expanded="false" aria-controls="sheet" aria-label="${t.menu}"><span></span><span></span></button>
</div></header>
<nav class="sheet" id="sheet" aria-label="${t.menu}" aria-hidden="true">${navLinks(true)}<a class="btn" href="${APP_GIRL}">${t.open}</a></nav>
<main>
<section class="hero"><div class="wrap grid">
  <div>
    <p class="kicker">${t.kicker}</p>
    <h1>${words(t.h1a, 0.05)} <em>${words(t.h1b, 0.35)}</em></h1>
    <p class="lead">${t.lead}</p>
    <div class="ctas"><a class="btn" href="${APP_GIRL}">${t.open}</a><a class="btn ghost" href="#people">${t.how}</a></div>
    <p class="note">${t.webNote}</p>
    <div class="faces">${heroFaces.map((p, i) => im(face(p.id), p.name, "", false, ` style="animation-delay:${(0.6 + i * 0.07).toFixed(2)}s"`)).join("")}<small>${esc(t.illustrative)}</small></div>
  </div>
  <div class="stage">
    <div class="main">${im(img("girlsOut"), lang === "fr" ? "Deux amies lèvent les bras face à la Burj Khalifa au coucher du soleil" : "Two friends raising their arms facing the Burj Khalifa at sunset", "", false, ' fetchpriority="high"')}</div>
    ${floating.map((p, i) => `<div class="card-p ${"abc"[i]} glass">${im(face(p.id), "", "", false)}<div>${esc(p.name)}<small>${esc(like(p.likes[0]))} · ${esc(p.area)}</small></div></div>`).join("\n    ")}
  </div>
</div></section>

${tourHtml}

<section id="people"><div class="wrap">
  <div class="head"><div><p class="k">${t.peopleK}</p><h2>${t.peopleT}</h2><p class="p">${t.peopleP}</p></div><span class="label">${esc(t.illustrative)}</span></div>
  <div class="wall">${wall
    .map(
      (p, i) =>
        `<figure class="pc ${sizes[i] ?? ""} reveal" style="--d:${((i % 6) * 0.06).toFixed(2)}s">${im(face(p.id), p.name)}<figcaption class="meta glass"><b>${esc(p.name)}</b><span>${esc(p.area)}</span><span class="tags">${p.likes.map((l) => `<i>${esc(like(l))}</i>`).join("")}</span></figcaption></figure>`,
    )
    .join("")}</div>
</div></section>

<section class="journal"><div class="wrap">
  <div class="head"><div><p class="k">${t.journalK}</p><h2>${t.journalT}</h2><p class="p">${t.journalP}</p></div></div>
  <div class="pages">${t.notes
    .map(([day, text, photo], i) => {
      const who = pick(18 + i * 3, 3);
      return `<article class="page reveal"><span class="tape" aria-hidden="true"></span>${im(thumb(photo), "", "ph")}<p class="day">${esc(day)}</p><p class="txt">${esc(text)}</p><div class="who">${avatars(who, 3)}<span>${who.map((w) => esc(w.name)).join(", ")}</span></div></article>`;
    })
    .join("")}</div>
  <p class="fine">${esc(t.journalNote)}</p>
</div></section>

<section id="plans"><div class="wrap">
  <div class="head"><div><p class="k">${t.plansK}</p><h2>${t.plansT}</h2><p class="p">${t.plansP}</p></div><span class="label">${esc(t.illustrative)}</span></div>
  <div class="rail">${t.plans
    .map(([photo, name, when], i) => {
      const who = pick(4 + i * 3, 3 + (i % 3));
      return `<article class="plan reveal" style="--d:${(Math.min(i, 4) * 0.06).toFixed(2)}s"><div class="ph">${ph(photo)}<span class="chip glass">${esc(when)}</span></div><div class="body"><div><b>${esc(name)}</b><small>${who.length} ${t.going}</small></div><div class="stack">${avatars(who, 3)}</div></div></article>`;
    })
    .join("")}</div>
</div></section>

<section id="circles"><div class="wrap">
  <div class="head"><div><p class="k">${t.circlesK}</p><h2>${t.circlesT}</h2><p class="p">${t.circlesP}</p></div></div>
  <div class="circles">${t.circles
    .map(([name, about, photo], i) => {
      const who = pick(8 + i * 5, 5);
      return `<article class="circle glass reveal" style="--d:${(i * 0.08).toFixed(2)}s">${im(thumb(photo), "", "cv")}<div><b>${esc(name)}</b><p>${esc(about)}</p><div class="stack">${avatars(who, 5)}<em>${esc(t.members)}</em></div></div></article>`;
    })
    .join("")}</div>
</div></section>

${
  shots.length
    ? `<section id="app"><div class="wrap">
  <div class="head"><div><p class="k">${t.appK}</p><h2>${t.appT}</h2><p class="p">${t.appP}</p></div></div>
  <div class="shots">${shots.map(([n, cap], i) => `<figure class="shot reveal" style="--d:${(i * 0.07).toFixed(2)}s"><div class="phone">${im(shot(n), cap)}</div><figcaption>${esc(cap)}</figcaption></figure>`).join("")}</div>
</div></section>`
    : ""
}

<section><div class="wrap"><div class="soon glass reveal"><span class="badge">${t.soonK}</span><h2>${t.soonT}</h2><p class="p">${t.soonP}</p></div></div></section>

<section><div class="wrap reveal"><p class="k">${t.safeK}</p><h2>${t.safeT}</h2>
  <ul class="safe">${t.safe.map((s) => `<li>${esc(s)}</li>`).join("")}</ul></div></section>

<section class="faq"><div class="wrap"><h2 class="reveal">${t.faqT}</h2>
  ${t.faq.map(([q, a]) => `<details class="reveal"><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join("\n  ")}
</div></section>

<section class="end"><div class="wrap reveal"><div class="faces">${avatars(pick(24, 6), 6)}</div><h2>${t.endT}</h2><p class="p" style="margin:0 auto 28px">${t.endP}</p><a class="btn" href="${APP_GIRL}">${t.open}</a></div></section>
</main>
<footer><div class="wrap">
  <span>© IRLY</span>
  <nav aria-label="Footer"><a href="${home(lang)}">${t.back}</a><a href="${lang === "fr" ? "/fr/privacy" : "/privacy"}">${t.privacy}</a><a href="${lang === "fr" ? "/fr/guidelines" : "/guidelines"}">${t.guidelines}</a><a href="${lang === "fr" ? "/fr/support" : "/support"}">${t.support}</a></nav>
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
