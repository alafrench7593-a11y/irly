/**
 * Reference pages: IRLY Network, and the press page (facts, logo, real screens of the app, contact).
 * Same fields as site/guides/product.mjs. Every statement about the app is in seo/context.md with its source.
 * No user numbers, ratings, reviews, partners or press quotes: there are none to give.
 */
const shot = (up, lang, name, alt) => `<img src="${up}shots/app/${lang}/${name}.jpg" width="600" height="1298" alt="${alt}" loading="lazy" decoding="async">`;

export const REFERENCE = [
  {
    lang: 'en',
    pair: 'irly-network',
    path: 'irly/irly-network/',
    cover: 'dubaiMarina',
    city: 'IRLY',
    published: '2026-11-12',
    title: 'IRLY Network: A Networking App for Dubai | IRLY',
    description: 'IRLY Network is the professional side of IRLY in Dubai: a professional profile, members filtered by domain and job, networking meetups and communities.',
    h1: 'IRLY Network: professional networking in Dubai',
    lead: 'IRLY Network is the part of the IRLY app for professional meetings. You create a professional profile, look for members by domain, job or what they are looking for, and meet them at networking meetups and in networking communities. It is free and open to every member.',
    sections: [
      {
        h2: 'What IRLY Network is',
        html: `<p>IRLY is an app to meet people and do things together in real life. IRLY Network is its professional side: the same account, with a second profile that says what you do and what you are looking for. The idea is the one behind the rest of the app: a contact made around a shared activity lasts longer than a business card.</p>
<p>It has its own tab in the app, named IRLY Network, and is described there as “open to everyone”.</p>`,
      },
      {
        h2: 'What you find in it',
        html: `<ul>
<li><strong>Your professional profile.</strong> It sits beside your IRLY profile. Until you have one, the page explains what Network is and offers “Create my profile”.</li>
<li><strong>Professionals.</strong> The members who have a professional profile, with a search and filters: domain, job, profile, what they are looking for, and city. With a profile of your own, the list is sorted by how well you match.</li>
<li><strong>Professional meetups.</strong> The activities of the Networking category: a coffee between founders, a talk, a working morning.</li>
<li><strong>Communities.</strong> Networking communities, for example around business, founders or tech, and the latest posts from their members.</li>
<li><strong>Business news</strong> from the sources IRLY follows.</li>
</ul>
<p>The list shows real members only, so you need an IRLY account to see it. A city where nobody has a professional profile yet shows an empty list: nothing is made up to fill it.</p>`,
      },
      {
        h2: 'How to start',
        html: `<ol>
<li><strong>Open IRLY</strong> in your browser and create your account. <a href="../how-it-works/">How IRLY works</a> describes each step.</li>
<li><strong>Open the IRLY Network tab</strong>, choose “Create my profile” and fill it in.</li>
<li><strong>Filter</strong> by domain and by what people are looking for, rather than scrolling through everyone.</li>
<li><strong>Join a professional meetup</strong>, or host one: an activity in the Networking category appears there. <a href="../create-an-activity/">How to organise an activity</a> covers the form.</li>
<li><strong>Join one networking community</strong> and take part in it before you ask anything of its members.</li>
</ol>`,
      },
      {
        h2: 'What it is not',
        html: `<ul>
<li><strong>Not a job board.</strong> There are no job offers or applications.</li>
<li><strong>Not a replacement for a professional social network.</strong> Your career history lives elsewhere; this is for meeting people in the city.</li>
<li><strong>Not a directory of companies.</strong> It lists members, not businesses.</li>
<li><strong>New.</strong> You may find few profiles or meetups in your field for now. Hosting the first meetup is often the fastest way to meet the others.</li>
</ul>`,
      },
      {
        h2: 'Networking in Dubai beyond the app',
        html: `<p>An app is one route among several. Business councils, industry meetups, coworking events and conferences all matter in Dubai, and each suits a different goal. Our guide to <a href="../../dubai/networking/">networking in Dubai: where to meet entrepreneurs</a> covers them, with what to say and how to follow up. If you are new to the city, <a href="../../dubai/expat-communities/">expat communities in Dubai</a> is a good second read.</p>`,
      },
    ],
    faq: [
      { q: 'Is IRLY Network free?', a: 'Yes. IRLY is free, and IRLY Network is part of it.' },
      { q: 'Do I need a separate account for IRLY Network?', a: 'No. It uses your IRLY account. You add a professional profile to it from the IRLY Network tab.' },
      { q: 'Can I use IRLY Network without a professional profile?', a: 'You can open it and read what it offers. A profile of your own lets the list of professionals be sorted by how well you match.' },
      { q: 'Is IRLY Network a job board?', a: 'No. It has no job offers. It is for meeting other professionals around meetups and communities.' },
      { q: 'How do I host a networking meetup on IRLY?', a: 'Create an activity and choose the Networking category. It then appears under Professional meetups in IRLY Network.' },
    ],
    cta: { title: 'Meet the people building something around you', body: 'Looking to meet new people in Dubai? Discover IRLY and connect through activities and communities.', label: 'Open IRLY' },
    related: [
      { label: 'Networking in Dubai: where to meet entrepreneurs', path: 'dubai/networking/' },
      { label: 'What is IRLY?', path: 'irly/what-is-irly/' },
      { label: 'How to organise an activity on IRLY', path: 'irly/create-an-activity/' },
      { label: 'Expat communities in Dubai', path: 'dubai/expat-communities/' },
      { label: 'Working from home in Dubai and feeling isolated', path: 'blog/working-from-home-dubai-isolated/' },
      { label: 'IRLY press kit', path: 'irly/press/' },
    ],
  },
  {
    lang: 'fr',
    pair: 'irly-network',
    path: 'fr/irly/irly-network/',
    cover: 'dubaiMarina',
    city: 'IRLY',
    published: '2026-11-12',
    title: 'IRLY Network : application de networking à Dubaï | IRLY',
    description: 'IRLY Network est le volet professionnel d’IRLY à Dubaï : un profil pro, des membres filtrés par domaine et par métier, des rencontres pro et des communautés.',
    h1: 'IRLY Network : le networking professionnel à Dubaï',
    lead: 'IRLY Network est la partie de l’application IRLY consacrée aux rencontres professionnelles. Tu crées un profil pro, tu cherches des membres par domaine, par métier ou selon ce qu’ils recherchent, et tu les retrouves lors de rencontres pro et dans des communautés de networking. C’est gratuit et ouvert à tous les membres.',
    sections: [
      {
        h2: 'IRLY Network, c’est quoi',
        html: `<p>IRLY est une application pour rencontrer du monde et faire des choses ensemble, en vrai. IRLY Network en est le volet professionnel : le même compte, avec un second profil qui dit ce que tu fais et ce que tu cherches. L’idée est celle du reste de l’application : un contact noué autour d’une activité partagée dure plus longtemps qu’une carte de visite.</p>
<p>Il a son propre onglet dans l’application, nommé IRLY Network, où il est présenté comme « ouvert à tous ».</p>`,
      },
      {
        h2: 'Ce que tu y trouves',
        html: `<ul>
<li><strong>Ton profil professionnel.</strong> Il s’ajoute à ton profil IRLY. Tant que tu n’en as pas, la page explique ce qu’est Network et propose « Créer mon profil ».</li>
<li><strong>Des professionnels.</strong> Les membres qui ont un profil pro, avec une recherche et des filtres : domaine, métier, profil, ce qu’ils recherchent, et ville. Avec ton propre profil, la liste est triée selon votre compatibilité.</li>
<li><strong>Des rencontres pro.</strong> Les activités de la catégorie Networking : un café entre fondateurs, une conférence, une matinée de travail.</li>
<li><strong>Des communautés.</strong> Des communautés de networking, par exemple autour du business, des fondateurs ou de la tech, et les dernières publications de leurs membres.</li>
<li><strong>L’actualité business</strong> des sources suivies par IRLY.</li>
</ul>
<p>La liste ne montre que de vrais membres : il faut donc un compte IRLY pour la voir. Une ville où personne n’a encore de profil pro affiche une liste vide ; rien n’est inventé pour la remplir.</p>`,
      },
      {
        h2: 'Comment commencer',
        html: `<ol>
<li><strong>Ouvre IRLY</strong> dans ton navigateur et crée ton compte. <a href="../comment-ca-marche/">Comment fonctionne IRLY</a> décrit chaque étape.</li>
<li><strong>Ouvre l’onglet IRLY Network</strong>, choisis « Créer mon profil » et remplis-le.</li>
<li><strong>Filtre</strong> par domaine et par ce que les gens recherchent, plutôt que de faire défiler tout le monde.</li>
<li><strong>Rejoins une rencontre pro</strong>, ou organise-en une : une activité de la catégorie Networking y apparaît. <a href="../organiser-une-activite/">Comment organiser une activité</a> détaille le formulaire.</li>
<li><strong>Rejoins une communauté de networking</strong> et participe avant de demander quoi que ce soit à ses membres.</li>
</ol>`,
      },
      {
        h2: 'Ce que ce n’est pas',
        html: `<ul>
<li><strong>Pas un site d’offres d’emploi.</strong> Il n’y a ni annonces ni candidatures.</li>
<li><strong>Pas un remplaçant d’un réseau social professionnel.</strong> Ton parcours est ailleurs ; ici, on se rencontre dans la ville.</li>
<li><strong>Pas un annuaire d’entreprises.</strong> On y trouve des membres, pas des sociétés.</li>
<li><strong>Récent.</strong> Tu peux y trouver peu de profils ou de rencontres dans ton secteur pour l’instant. Organiser la première rencontre est souvent le moyen le plus rapide de rencontrer les autres.</li>
</ul>`,
      },
      {
        h2: 'Le networking à Dubaï au-delà de l’application',
        html: `<p>Une application n’est qu’une voie parmi d’autres. Chambres de commerce, meetups de secteur, événements de coworking et conférences comptent tous à Dubaï, et chacun sert un objectif différent. Notre guide <a href="../../dubai/networking/">networking à Dubaï : où rencontrer des entrepreneurs</a> les passe en revue, avec quoi dire et comment relancer. Si tu viens d’arriver, lis ensuite <a href="../../dubai/communautes-expatries/">rejoindre une communauté d’expatriés à Dubaï</a>.</p>`,
      },
    ],
    faq: [
      { q: 'IRLY Network est-il gratuit ?', a: 'Oui. IRLY est gratuite, et IRLY Network en fait partie.' },
      { q: 'Faut-il un compte à part pour IRLY Network ?', a: 'Non. Il utilise ton compte IRLY. Tu y ajoutes un profil professionnel depuis l’onglet IRLY Network.' },
      { q: 'Peut-on utiliser IRLY Network sans profil professionnel ?', a: 'Tu peux l’ouvrir et lire ce qu’il propose. Avec ton propre profil, la liste des professionnels est triée selon votre compatibilité.' },
      { q: 'IRLY Network est-il un site d’offres d’emploi ?', a: 'Non. Il ne contient pas d’offres d’emploi. Il sert à rencontrer d’autres professionnels autour de rencontres et de communautés.' },
      { q: 'Comment organiser une rencontre de networking sur IRLY ?', a: 'Crée une activité et choisis la catégorie Networking. Elle apparaît alors dans les rencontres pro d’IRLY Network.' },
    ],
    cta: { title: 'Rencontre celles et ceux qui construisent quelque chose autour de toi', body: 'Envie de rencontrer de nouvelles personnes à Dubaï ? Découvrez IRLY et rejoignez des communautés autour de vos centres d’intérêt.', label: 'Ouvrir IRLY' },
    related: [
      { label: 'Networking à Dubaï : où rencontrer des entrepreneurs', path: 'fr/dubai/networking/' },
      { label: 'IRLY, c’est quoi ?', path: 'fr/irly/c-est-quoi/' },
      { label: 'Organiser une activité sur IRLY', path: 'fr/irly/organiser-une-activite/' },
      { label: 'Rejoindre une communauté d’expatriés à Dubaï', path: 'fr/dubai/communautes-expatries/' },
      { label: 'Télétravail à Dubaï : quand on se sent isolé', path: 'fr/blog/teletravail-dubai-isolement/' },
      { label: 'Espace presse d’IRLY', path: 'fr/irly/presse/' },
    ],
  },
  {
    lang: 'en',
    pair: 'irly-press',
    path: 'irly/press/',
    cover: 'brunch',
    city: 'IRLY',
    published: '2026-11-12',
    title: 'IRLY Press Kit: Facts, Logo and Screenshots | IRLY',
    description: 'Facts about IRLY for journalists and writers: what the app is, where it works, what it costs, its logo, real screenshots and a press contact.',
    h1: 'IRLY press kit',
    lead: 'IRLY is a free app to make friends in real life, launched in Dubai. This page gives the facts a journalist or writer needs, the official logo, real screenshots of the app and a contact. It states only what can be checked; IRLY publishes no user numbers at this stage.',
    sections: [
      {
        h2: 'IRLY in one paragraph',
        html: `<p>IRLY is an app to meet people who share your interests and do things together in real life: you join communities, take part in activities or organise one, and talk in a group chat before meeting. It is built for friendship, not dating. It is free, in English and French, and Dubai is its launch city.</p>`,
      },
      {
        h2: 'Facts',
        html: `<ul>
<li><strong>Name:</strong> IRLY. App name: IRLY — Make Friends IRL. “IRL” stands for “in real life”.</li>
<li><strong>Website:</strong> www.getirly.com</li>
<li><strong>What it does:</strong> communities by interest, activities to join or create, group chats, a live feed of what members are doing.</li>
<li><strong>Launch city:</strong> Dubai, United Arab Emirates. The other emirates are opening in early access.</li>
<li><strong>Price:</strong> free.</li>
<li><strong>Where it runs:</strong> in the browser today. iOS and Android apps are coming.</li>
<li><strong>Languages:</strong> English and French.</li>
<li><strong>Who it is for:</strong> adults (18 and over) who want a wider circle of friends: newcomers, long-time residents, French speakers, women looking for women-only spaces, people who do sport, professionals.</li>
<li><strong>IRLY Girl:</strong> a space reserved for women, with its own communities and activities.</li>
<li><strong>IRLY Network:</strong> the professional side: profiles, networking meetups and communities.</li>
<li><strong>IRLY Games:</strong> a social game, Loup-Garou (a Werewolf-style party game), played between members.</li>
<li><strong>Not a dating app.</strong></li>
<li><strong>Publisher:</strong> ALF FASHION BRAND FZCO.</li>
</ul>`,
      },
      {
        h2: 'The problem it answers',
        html: `<p>People who move to a new city often know nobody outside work, and Dubai is a city where most residents arrived from somewhere else. Friendships there tend to start around something people do together, again and again. IRLY is organised around that: a community to come back to, an activity with a date and a place, and a chat to say you are coming. Our guide on <a href="../../dubai/make-friends/">how to make friends in Dubai</a> explains the reasoning without the product.</p>`,
      },
      {
        h2: 'Logo and screenshots',
        html: `<p>The official logo: <a href="../../logo-512.png">logo-512.png</a> (512 × 512 pixels, PNG). Use it unchanged, on a dark or a light ground.</p>
<p>These are real screens of the app, in English, shown with example people and plans. They may be reproduced to illustrate an article about IRLY.</p>
<div class="shots">${shot('../../', 'en', 'home', 'The IRLY app: the home screen, with who is live around you')}${shot('../../', 'en', 'categories', 'The IRLY app: activities by category')}${shot('../../', 'en', 'chat', 'The IRLY app: the group chat of an activity')}</div>
<p>The people and plans in these screens, and in those of the website, are examples, not members.</p>`,
      },
      {
        h2: 'What IRLY does not publish',
        html: `<p>IRLY is at its start. It publishes no number of members, downloads or activities, and has no ratings, awards or partners to announce. A figure about IRLY found elsewhere does not come from IRLY.</p>`,
      },
      {
        h2: 'Contact',
        html: `<p>Press and partnerships: <a href="mailto:getirly@gmail.com">getirly@gmail.com</a>. Interviews are possible in English and French.</p>
<p>To understand the product before writing: <a href="../what-is-irly/">what IRLY is</a>, <a href="../how-it-works/">how it works</a>, and <a href="../irly-vs-other-ways-to-meet-people/">IRLY next to the other ways to meet people in Dubai</a>.</p>`,
      },
    ],
    faq: [
      { q: 'Is IRLY a dating app?', a: 'No. IRLY is for friendship and group activities.' },
      { q: 'Where is IRLY available?', a: 'Dubai is the launch city, and the other emirates of the UAE are opening in early access. It runs in the browser; iOS and Android apps are coming.' },
      { q: 'How much does IRLY cost?', a: 'It is free.' },
      { q: 'How many people use IRLY?', a: 'IRLY does not publish user numbers at this stage.' },
      { q: 'Who can I contact for an interview?', a: 'Write to getirly@gmail.com. Interviews are possible in English and French.' },
    ],
    cta: { title: 'See it for yourself', body: 'IRLY runs in the browser: open it and look around.', label: 'Open IRLY' },
    related: [
      { label: 'What is IRLY?', path: 'irly/what-is-irly/' },
      { label: 'How IRLY works', path: 'irly/how-it-works/' },
      { label: 'IRLY Network', path: 'irly/irly-network/' },
      { label: 'How to make friends in Dubai', path: 'dubai/make-friends/' },
    ],
  },
  {
    lang: 'fr',
    pair: 'irly-press',
    path: 'fr/irly/presse/',
    cover: 'brunch',
    city: 'IRLY',
    published: '2026-11-12',
    title: 'IRLY, espace presse : faits, logo et captures | IRLY',
    description: 'Les faits sur IRLY pour les journalistes : ce qu’est l’application, où elle fonctionne, son prix, son logo, de vraies captures d’écran et un contact presse.',
    h1: 'Espace presse d’IRLY',
    lead: 'IRLY est une application gratuite pour se faire des amis dans la vraie vie, lancée à Dubaï. Cette page réunit les faits utiles à un journaliste, le logo officiel, de vraies captures de l’application et un contact. Elle n’affirme que ce qui peut être vérifié ; IRLY ne publie pas de nombre d’utilisateurs à ce stade.',
    sections: [
      {
        h2: 'IRLY en un paragraphe',
        html: `<p>IRLY est une application pour rencontrer des personnes qui partagent tes centres d’intérêt et faire des choses ensemble, en vrai : on rejoint des communautés, on participe à des activités ou on en organise une, et on se parle dans un chat de groupe avant de se voir. Elle est faite pour l’amitié, pas pour les rencontres amoureuses. Elle est gratuite, en français et en anglais, et Dubaï est sa ville de lancement.</p>`,
      },
      {
        h2: 'Les faits',
        html: `<ul>
<li><strong>Nom :</strong> IRLY. Nom de l’application : IRLY — Make Friends IRL. « IRL » signifie « in real life », dans la vraie vie.</li>
<li><strong>Site :</strong> www.getirly.com</li>
<li><strong>Ce qu’elle fait :</strong> des communautés par centre d’intérêt, des activités à rejoindre ou à créer, des chats de groupe, un fil en direct de ce que font les membres.</li>
<li><strong>Ville de lancement :</strong> Dubaï, Émirats arabes unis. Les autres émirats ouvrent en accès anticipé.</li>
<li><strong>Prix :</strong> gratuite.</li>
<li><strong>Où elle fonctionne :</strong> dans le navigateur aujourd’hui. Les applications iOS et Android arrivent.</li>
<li><strong>Langues :</strong> français et anglais.</li>
<li><strong>Pour qui :</strong> des adultes (18 ans et plus) qui veulent élargir leur cercle d’amis : nouveaux arrivants, résidents de longue date, francophones, femmes qui cherchent des espaces réservés aux femmes, sportifs, professionnels.</li>
<li><strong>IRLY Girl :</strong> un espace réservé aux femmes, avec ses communautés et ses activités.</li>
<li><strong>IRLY Network :</strong> le volet professionnel : profils, rencontres pro et communautés.</li>
<li><strong>IRLY Games :</strong> un jeu social, le Loup-Garou, joué entre membres.</li>
<li><strong>Ce n’est pas une application de rencontres amoureuses.</strong></li>
<li><strong>Éditeur :</strong> ALF FASHION BRAND FZCO.</li>
</ul>`,
      },
      {
        h2: 'Le problème auquel elle répond',
        html: `<p>Quand on s’installe dans une nouvelle ville, on ne connaît souvent personne en dehors du travail, et Dubaï est une ville où la plupart des habitants viennent d’ailleurs. Les amitiés y naissent le plus souvent autour de quelque chose que l’on fait ensemble, régulièrement. IRLY est organisée autour de cela : une communauté où revenir, une activité avec une date et un lieu, et un chat pour dire que l’on vient. Notre guide <a href="../../dubai/se-faire-des-amis/">comment se faire des amis à Dubaï</a> expose ce raisonnement sans parler du produit.</p>`,
      },
      {
        h2: 'Logo et captures d’écran',
        html: `<p>Le logo officiel : <a href="../../../logo-512.png">logo-512.png</a> (512 × 512 pixels, PNG). À utiliser tel quel, sur fond sombre ou clair.</p>
<p>Voici de vrais écrans de l’application, en français, montrés avec des personnes et des sorties d’exemple. Ils peuvent être reproduits pour illustrer un article sur IRLY.</p>
<div class="shots">${shot('../../../', 'fr', 'home', 'L’application IRLY : l’accueil, avec les personnes en live autour de toi')}${shot('../../../', 'fr', 'categories', 'L’application IRLY : les activités par catégorie')}${shot('../../../', 'fr', 'chat', 'L’application IRLY : le chat de groupe d’une activité')}</div>
<p>Les personnes et les sorties de ces écrans, comme de ceux du site, sont des exemples, pas des membres.</p>`,
      },
      {
        h2: 'Ce qu’IRLY ne publie pas',
        html: `<p>IRLY en est à ses débuts. Elle ne publie aucun nombre de membres, de téléchargements ou d’activités, et n’a ni notes, ni récompenses, ni partenaires à annoncer. Un chiffre sur IRLY lu ailleurs ne vient pas d’IRLY.</p>`,
      },
      {
        h2: 'Contact',
        html: `<p>Presse et partenariats : <a href="mailto:getirly@gmail.com">getirly@gmail.com</a>. Les interviews sont possibles en français et en anglais.</p>
<p>Pour comprendre le produit avant d’écrire : <a href="../c-est-quoi/">IRLY, c’est quoi</a>, <a href="../comment-ca-marche/">comment ça marche</a>, et <a href="../irly-et-les-autres-solutions/">IRLY et les autres façons de rencontrer du monde à Dubaï</a>.</p>`,
      },
    ],
    faq: [
      { q: 'IRLY est-elle une application de rencontres amoureuses ?', a: 'Non. IRLY sert à se faire des amis et à participer à des activités de groupe.' },
      { q: 'Où IRLY est-elle disponible ?', a: 'Dubaï est la ville de lancement, et les autres émirats ouvrent en accès anticipé. Elle fonctionne dans le navigateur ; les applications iOS et Android arrivent.' },
      { q: 'Combien coûte IRLY ?', a: 'Elle est gratuite.' },
      { q: 'Combien de personnes utilisent IRLY ?', a: 'IRLY ne publie pas de nombre d’utilisateurs à ce stade.' },
      { q: 'Qui contacter pour une interview ?', a: 'Écrivez à getirly@gmail.com. Les interviews sont possibles en français et en anglais.' },
    ],
    cta: { title: 'Voir par vous-même', body: 'IRLY fonctionne dans le navigateur : ouvrez-la et faites le tour.', label: 'Ouvrir IRLY' },
    related: [
      { label: 'IRLY, c’est quoi ?', path: 'fr/irly/c-est-quoi/' },
      { label: 'Comment fonctionne IRLY ?', path: 'fr/irly/comment-ca-marche/' },
      { label: 'IRLY Network', path: 'fr/irly/irly-network/' },
      { label: 'Comment se faire des amis à Dubaï', path: 'fr/dubai/se-faire-des-amis/' },
    ],
  },
];
