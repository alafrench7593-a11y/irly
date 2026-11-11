/**
 * Search-intent pages: one precise question per page, in English and French
 * (same `pair`). Same fields as a guide (site/guides/articles.mjs) plus
 * `published` and `faq`, an array of { q, a } in plain text that the
 * generator shows on the page and as FAQPage data.
 *
 * Rules: general and stable advice only. No statistics, prices, opening
 * hours, visa or legal claims, testimonials or user numbers. A real
 * institution or public place is named only when it was checked, and in
 * neutral terms. IRLY appears in one section near the end, as one option
 * among others, and competitor products are never named.
 */
export const STRATEGIC = [
  {
    lang: 'en',
    pair: 'dubai-french',
    path: 'dubai/meet-french-people/',
    cover: 'dubaiMarina',
    city: 'Dubai',
    published: '2026-11-11',
    title: 'How to Meet French People in Dubai: Groups and Events | IRLY',
    description: 'Where the French-speaking community gathers in Dubai, how to join its associations and events, and how to mix French and international circles.',
    h1: 'How to meet French people in Dubai',
    lead: 'French speakers in Dubai gather around a few well-known associations, the Alliance Française, the French chamber of commerce, the French-curriculum schools and many online groups. The quickest way in is to join one association, go to one of its regular events, and come back. Then add one international group, so your circle is not only French.',
    sections: [
      {
        h2: 'Where the French-speaking community gathers',
        html: `<p>The community is well established and organised, which makes it easier to find than most. These are the main entry points:</p>
<ul>
<li><strong>Welcome associations.</strong> The French Social Club, long known as Dubai Accueil, is a volunteer-run association that welcomes French-speaking newcomers and helps them settle in.</li>
<li><strong>Associations of French people abroad.</strong> The Union des Français de l’Étranger has a local branch, UFE Dubaï, which brings members together at social events.</li>
<li><strong>The Alliance Française Dubai.</strong> A French language school and cultural centre: classes, a library and cultural events where French speakers and learners meet.</li>
<li><strong>The French chamber of commerce.</strong> CCI France UAE, formed from the former French Business Council Dubai &amp; Northern Emirates, is the business network of French companies and professionals.</li>
<li><strong>French-curriculum schools.</strong> For parents, the school gate, parent associations and school events are often the first circle.</li>
<li><strong>Online groups.</strong> Social network groups and messaging groups for French speakers in Dubai, where people ask questions and announce get-togethers.</li>
</ul>
<p>“French-speaking” is wider than “French”. French is spoken in many countries, so these groups bring together people from well beyond France, as well as others who simply love the language.</p>`,
      },
      {
        h2: 'How to join, step by step',
        html: `<ol>
<li><strong>Pick one association that matches your situation.</strong> A welcome association if you have just arrived, the chamber of commerce if you want professional contacts, the Alliance Française if you like culture or are learning the language.</li>
<li><strong>Read its official page.</strong> Programmes, membership rules and contacts change; the association itself is the only reliable source.</li>
<li><strong>Start with an event made for newcomers.</strong> A welcome coffee or an open evening is designed for people who know nobody yet.</li>
<li><strong>Go back.</strong> One evening gives you a few names. The third visit is when people start to recognise you.</li>
<li><strong>Offer a hand.</strong> These associations run on volunteers. Helping at one event is the fastest way to know the people who know everyone.</li>
</ol>`,
      },
      {
        h2: 'Meeting French speakers through activities',
        html: `<p>Associations open the door; activities build the friendships. Ask in the associations and online groups which French-speaking activity groups are running at the moment: sport, walks, book clubs, parents’ mornings, dinners. A small group that meets every week does more than a big annual party.</p>
<p>If you cannot find one, propose it. A message such as “Is anyone up for a run on Saturday morning?” in a French-speaking group usually finds two or three people, and that is enough to begin. Our list of <a href="../group-activities/">group activities to meet people in Dubai</a> gives formats that work well, and <a href="../running-clubs/">how to join a social running club</a> explains how a first session goes.</p>`,
      },
      {
        h2: 'Not French, but you want to meet French people?',
        html: `<p>You do not need to be French, or fluent, to join in.</p>
<ul>
<li><strong>Take a class.</strong> A French course puts you in a room with other learners every week, and cultural centres such as the Alliance Française run events open to the public.</li>
<li><strong>Try a language exchange.</strong> You help someone with your language, they help you with French. Meet in a café or another public place.</li>
<li><strong>Go to cultural events.</strong> Film screenings, exhibitions and talks in French attract a mixed crowd, and the topic gives you something to say.</li>
<li><strong>Say that you are learning.</strong> Most French speakers are glad to help, and switch to English when needed.</li>
</ul>`,
      },
      {
        h2: 'Mixing French-speaking and international circles',
        html: `<p>Speaking your own language is restful, especially in the first months, when everything else is new. The risk is to stay only there: you would miss much of what makes Dubai interesting, and a single circle is fragile in a city where people often move on.</p>
<ul>
<li><strong>Keep one French-speaking habit and one international habit.</strong> For example a monthly association evening and a weekly mixed sport session.</li>
<li><strong>Bring people across.</strong> Invite a colleague to a French cultural event, or a French friend to your mixed padel game.</li>
<li><strong>Use interests, not passports.</strong> A group built around running, climbing or books mixes nationalities naturally.</li>
</ul>
<p>For the wider picture, read <a href="../expat-communities/">expat communities in Dubai: how to find yours</a> and <a href="../make-friends/">how to make friends in Dubai</a>.</p>`,
      },
      {
        h2: 'Where IRLY fits in',
        html: `<p>IRLY is an app to meet people who share your interests and do things together in real life: communities, activities you can join or create, and group chats. It is available in French and in English, so you can use it in the language you prefer and meet both French speakers and people from everywhere else. It is free, it is not a dating app, and it works today in the browser as a web app; iOS and Android apps are coming soon. It is one option among others, alongside the associations above.</p>`,
      },
    ],
    faq: [
      { q: 'Is there a French community in Dubai?', a: 'Yes. Dubai has a well-established French-speaking community with welcome associations, an Alliance Française, a French chamber of commerce and French-curriculum schools.' },
      { q: 'Do I have to be French to go to French-speaking events?', a: 'Usually not. Many events welcome anyone who speaks or is learning French, but some are reserved for members, so check the organiser’s page before you go.' },
      { q: 'I have just arrived and speak French. What should I do first?', a: 'Contact a welcome association for French-speaking newcomers and go to its next newcomer event. Then pick one regular activity so that you see the same people every week.' },
      { q: 'How can I practise French in Dubai?', a: 'Take a class at a French language school, join a language exchange, and go to cultural events in French. Regular contact with the same people helps more than occasional events.' },
      { q: 'Should I only spend time with French speakers?', a: 'It is comfortable at the start, but mixing circles gives you a wider and more stable social life. One French-speaking habit and one international habit is a good balance.' },
    ],
    cta: { title: 'New in Dubai?', body: 'Looking to meet new people in Dubai? Discover IRLY and connect through activities and communities.', label: 'Discover IRLY' },
    related: [
      { label: 'Expat communities in Dubai: how to find yours', path: 'dubai/expat-communities/' },
      { label: 'How to make friends in Dubai', path: 'dubai/make-friends/' },
      { label: 'Moving to Dubai: a checklist for your first months', path: 'dubai/moving-to-dubai/' },
      { label: 'Networking in Dubai: where to meet entrepreneurs', path: 'dubai/networking/' },
      { label: 'Lonely during the holidays far from home', path: 'blog/lonely-holidays-far-from-home/' },
      { label: 'Moved to Dubai for your partner’s job', path: 'blog/moved-for-partner-job-dubai-own-circle/' },
    ],
  },
  {
    lang: 'fr',
    pair: 'dubai-french',
    path: 'fr/dubai/rencontrer-des-francais/',
    cover: 'dubaiMarina',
    city: 'Dubaï',
    published: '2026-11-11',
    title: 'Rencontrer des Français à Dubaï, communauté francophone | IRLY',
    description: 'Où se retrouve la communauté francophone à Dubaï, comment rejoindre ses associations et événements, et comment mêler cercles francophones et internationaux.',
    h1: 'Comment rencontrer des Français à Dubaï ?',
    lead: 'À Dubaï, les francophones se retrouvent autour de quelques associations bien connues, de l’Alliance Française, de la chambre de commerce française, des écoles françaises et de nombreux groupes en ligne. Le plus rapide : adhère à une association, va à l’un de ses rendez-vous réguliers, et reviens. Ajoute ensuite un groupe international, pour que ton cercle ne soit pas uniquement français.',
    sections: [
      {
        h2: 'Où se retrouve la communauté francophone',
        html: `<p>La communauté est installée depuis longtemps et bien organisée : elle est plus facile à trouver que beaucoup d’autres. Voici les principales portes d’entrée :</p>
<ul>
<li><strong>Les associations d’accueil.</strong> Le French Social Club, longtemps connu sous le nom de Dubai Accueil, est une association de bénévoles qui accueille les nouveaux arrivants francophones et les aide à s’installer.</li>
<li><strong>Les associations de Français de l’étranger.</strong> L’Union des Français de l’Étranger a une représentation locale, l’UFE Dubaï, qui réunit ses adhérents lors de rendez-vous conviviaux.</li>
<li><strong>L’Alliance Française de Dubaï.</strong> École de langue et centre culturel : des cours, une médiathèque et des événements culturels où se croisent francophones et apprenants.</li>
<li><strong>La chambre de commerce française.</strong> CCI France UAE, issue de l’ancien French Business Council Dubai &amp; Northern Emirates, est le réseau d’affaires des entreprises et des professionnels français.</li>
<li><strong>Les écoles françaises.</strong> Pour les parents, la sortie de l’école, les associations de parents et les fêtes d’école forment souvent le premier cercle.</li>
<li><strong>Les groupes en ligne.</strong> Des groupes francophones sur les réseaux sociaux et les messageries, où l’on pose ses questions et où l’on annonce des sorties.</li>
</ul>
<p>« Francophone » est plus large que « français ». Le français se parle dans de nombreux pays : ces groupes réunissent des personnes venues de bien au-delà de la France, et d’autres qui aiment simplement la langue.</p>`,
      },
      {
        h2: 'Comment les rejoindre, étape par étape',
        html: `<ol>
<li><strong>Choisis une association qui correspond à ta situation.</strong> Une association d’accueil si tu viens d’arriver, la chambre de commerce si tu cherches des contacts pros, l’Alliance Française si tu aimes la culture ou si tu apprends la langue.</li>
<li><strong>Lis sa page officielle.</strong> Programmes, conditions d’adhésion et contacts changent ; seule l’association donne l’information à jour.</li>
<li><strong>Commence par un rendez-vous pensé pour les nouveaux.</strong> Un café d’accueil ou une soirée ouverte sont faits pour ceux qui ne connaissent encore personne.</li>
<li><strong>Reviens.</strong> Une soirée te donne quelques prénoms. C’est à la troisième visite qu’on commence à te reconnaître.</li>
<li><strong>Propose ton aide.</strong> Ces associations tournent grâce aux bénévoles. Donner un coup de main sur un événement, c’est le moyen le plus rapide de connaître ceux qui connaissent tout le monde.</li>
</ol>`,
      },
      {
        h2: 'Rencontrer des francophones autour d’une activité',
        html: `<p>Les associations ouvrent la porte ; ce sont les activités qui créent les amitiés. Demande dans les associations et les groupes en ligne quels groupes d’activités francophones tournent en ce moment : sport, balades, clubs de lecture, matinées de parents, dîners. Un petit groupe qui se voit chaque semaine fait plus qu’une grande soirée annuelle.</p>
<p>Si tu n’en trouves pas, propose. Un message du type « Quelqu’un pour un footing samedi matin ? » dans un groupe francophone trouve en général deux ou trois personnes, et ça suffit pour commencer. Notre liste d’<a href="../activites-de-groupe/">activités de groupe pour rencontrer du monde à Dubaï</a> donne des formats qui marchent, et <a href="../clubs-de-running/">comment rejoindre un club de running</a> explique comment se passe une première séance.</p>`,
      },
      {
        h2: 'Tu n’es pas français mais tu veux rencontrer des francophones ?',
        html: `<p>Pas besoin d’être français, ni de parler couramment, pour participer.</p>
<ul>
<li><strong>Prends un cours.</strong> Un cours de français te met chaque semaine dans une salle avec d’autres apprenants, et les centres culturels comme l’Alliance Française proposent des événements ouverts au public.</li>
<li><strong>Essaie un échange linguistique.</strong> Tu aides quelqu’un dans ta langue, il t’aide en français. Retrouvez-vous dans un café ou un autre lieu public.</li>
<li><strong>Va aux événements culturels.</strong> Projections, expositions et conférences en français attirent un public mélangé, et le sujet donne de quoi parler.</li>
<li><strong>Dis que tu apprends.</strong> La plupart des francophones aident volontiers, et passent à l’anglais quand il le faut.</li>
</ul>`,
      },
      {
        h2: 'Mêler cercles francophones et internationaux',
        html: `<p>Parler sa langue repose, surtout les premiers mois, quand tout le reste est nouveau. Le risque, c’est de ne faire que ça : tu passerais à côté d’une bonne partie de ce qui rend Dubaï intéressante, et un cercle unique est fragile dans une ville où les gens repartent souvent.</p>
<ul>
<li><strong>Garde une habitude francophone et une habitude internationale.</strong> Par exemple une soirée d’association par mois et une séance de sport mixte chaque semaine.</li>
<li><strong>Fais passer les gens d’un cercle à l’autre.</strong> Invite un collègue à un événement culturel français, ou une amie française à ta partie de padel internationale.</li>
<li><strong>Pars des centres d’intérêt, pas des passeports.</strong> Un groupe construit autour de la course, de l’escalade ou des livres mélange naturellement les nationalités.</li>
</ul>
<p>Pour une vue d’ensemble, lis <a href="../communautes-expatries/">comment rejoindre une communauté d’expatriés à Dubaï</a> et <a href="../se-faire-des-amis/">comment se faire des amis à Dubaï</a>.</p>`,
      },
      {
        h2: 'Et IRLY dans tout ça ?',
        html: `<p>IRLY est une application pour rencontrer des personnes qui partagent tes centres d’intérêt et faire des choses ensemble, en vrai : des communautés, des activités à rejoindre ou à créer, et des discussions de groupe. Elle existe en français et en anglais : tu l’utilises dans la langue que tu préfères, et tu y croises aussi bien des francophones que des gens venus de partout. Elle est gratuite, ce n’est pas une application de rencontres amoureuses, et elle fonctionne dès aujourd’hui dans le navigateur ; les applications iOS et Android arrivent bientôt. C’est une option parmi d’autres, à côté des associations citées plus haut.</p>`,
      },
    ],
    faq: [
      { q: 'Y a-t-il une communauté française à Dubaï ?', a: 'Oui. Dubaï compte une communauté francophone bien installée, avec des associations d’accueil, une Alliance Française, une chambre de commerce française et des écoles françaises.' },
      { q: 'Faut-il être français pour participer aux événements francophones ?', a: 'En général non. Beaucoup d’événements accueillent toute personne qui parle ou apprend le français, mais certains sont réservés aux adhérents : vérifie la page de l’organisateur avant d’y aller.' },
      { q: 'Je viens d’arriver et je parle français : par quoi commencer ?', a: 'Contacte une association d’accueil francophone et va à son prochain rendez-vous pour les nouveaux arrivants. Choisis ensuite une activité régulière pour revoir les mêmes personnes chaque semaine.' },
      { q: 'Comment pratiquer le français à Dubaï ?', a: 'Suis un cours dans une école de langue française, rejoins un échange linguistique et va aux événements culturels en français. Voir régulièrement les mêmes personnes aide plus que des événements isolés.' },
      { q: 'Faut-il rester entre francophones ?', a: 'C’est confortable au début, mais mélanger les cercles donne une vie sociale plus large et plus solide. Une habitude francophone et une habitude internationale forment un bon équilibre.' },
    ],
    cta: { title: 'Tu viens d’arriver à Dubaï ?', body: 'Envie de rencontrer de nouvelles personnes à Dubaï ? Découvrez IRLY et rejoignez des communautés autour de vos centres d’intérêt.', label: 'Découvrir IRLY' },
    related: [
      { label: 'Comment rejoindre une communauté d’expatriés à Dubaï', path: 'fr/dubai/communautes-expatries/' },
      { label: 'Se faire des amis à Dubaï', path: 'fr/dubai/se-faire-des-amis/' },
      { label: 'S’installer à Dubaï : la checklist des premiers mois', path: 'fr/dubai/s-installer/' },
      { label: 'Networking à Dubaï : où rencontrer des entrepreneurs', path: 'fr/dubai/networking/' },
      { label: 'Seul pendant les fêtes loin de chez toi', path: 'fr/blog/seul-pendant-les-fetes-loin-de-chez-soi/' },
      { label: 'Suivre ton ou ta partenaire à Dubaï', path: 'fr/blog/suivre-partenaire-dubai-ton-propre-cercle/' },
    ],
  },
  {
    lang: 'en',
    pair: 'dubai-app',
    path: 'dubai/app-to-make-friends/',
    cover: 'dubaiCreek',
    city: 'Dubai',
    published: '2026-11-11',
    title: 'Best Apps to Make Friends in Dubai: How to Choose | IRLY',
    description: 'The types of apps people use to make friends in Dubai, what each is good for, how a friendship app differs from a dating app, and how to stay safe.',
    h1: 'Best apps to make friends in Dubai: how to choose',
    lead: 'No single app is best for everyone: the right one depends on how you like to meet people. Five types are used in Dubai: friendship and community apps, event platforms, messaging-group communities, dating apps with a friends mode, and sport-booking apps. Choose the one that gets you to a real, repeated activity fastest, because friendships are made in person, not in the app.',
    sections: [
      {
        h2: 'The five types of apps, and what each is good for',
        html: `<ul>
<li><strong>Friendship and community apps.</strong> Built to meet people around shared interests: you join groups by topic and take part in activities. Good when you want friends rather than dates, and a setting where saying “I’m new, I’d like to meet people” is normal.</li>
<li><strong>Event platforms.</strong> Listings of public events and meetups by date and theme. Good for finding something to do this week; less good for seeing the same people twice, unless the event repeats.</li>
<li><strong>Messaging-group communities.</strong> Large group chats for a neighbourhood, a nationality, a sport or a profession. Active and local, but quality varies and big groups can be noisy.</li>
<li><strong>Dating apps with a friends mode.</strong> A separate mode for friendship inside an app made for dating. One-to-one by design, which suits some people and feels like an interview to others.</li>
<li><strong>Sport-booking apps.</strong> Made to book a court or a class, often with open games that need extra players. Very effective if you play: the activity is already organised.</li>
</ul>`,
      },
      {
        h2: 'How to choose: five questions',
        html: `<ol>
<li><strong>Group or one-to-one?</strong> If a coffee with a stranger sounds tiring, choose apps built around group activities. If crowds drain you, one-to-one or small groups will suit you better.</li>
<li><strong>Does it lead to something regular?</strong> A weekly session is worth more than ten one-off events. Look for groups and activities that repeat.</li>
<li><strong>Is it active where you live?</strong> Open the app and look at what is happening near you this week. An app can be excellent elsewhere and quiet in your area.</li>
<li><strong>Is the purpose clear?</strong> You should be able to tell in a minute whether people are there for friendship, dating, business or sport.</li>
<li><strong>Can you report and block?</strong> Check that the app has clear rules and simple tools to report a person or a group.</li>
</ol>
<p>Then keep it small: one or two apps you really use beat six you only scroll.</p>`,
      },
      {
        h2: 'Friendship app or dating app: the difference',
        html: `<p>The difference is less about features than about expectations. On a dating app, each person is looking for a partner, conversations are one-to-one, and a meeting is a date. On a friendship app, people come to do things together, often in groups, and nobody has to wonder what a message means.</p>
<p>A friends mode inside a dating app can work, and some people do make friends that way. But if what you want is a circle rather than a single new contact, tools built around groups and activities are usually a shorter path. Whatever you use, say clearly what you are looking for on your profile and in your first message. It saves misunderstandings on both sides.</p>`,
      },
      {
        h2: 'Getting from the app to real life',
        html: `<p>An app only does the first part of the job. The rest is the same as without one:</p>
<ul>
<li><strong>Write a profile that says what you like doing,</strong> not only who you are. “Padel beginner, Saturday mornings” gets more replies than a list of adjectives.</li>
<li><strong>Join a plan that already exists</strong> before you try to organise one. It is the easiest first step.</li>
<li><strong>Move to a meeting quickly.</strong> A few messages are enough to agree on a place and a time. Long chats rarely become friendships.</li>
<li><strong>Go back to the same group.</strong> Familiar faces are what turn an activity into friends.</li>
</ul>
<p>Our guide on <a href="../make-friends/">how to make friends in Dubai</a> has a four-week plan, <a href="../activities/">activities in Dubai by interest</a> helps you decide what to look for, and <a href="../going-out-alone/">going out alone in Dubai</a> covers the first time you turn up alone.</p>`,
      },
      {
        h2: 'Safety when you meet people from an app',
        html: `<ul>
<li><strong>Meet in a public place,</strong> and prefer a group activity for a first meeting.</li>
<li><strong>Keep the conversation in the app</strong> until you have met; share your number, address and workplace later.</li>
<li><strong>Tell someone you trust</strong> where you are going, and plan your own way home.</li>
<li><strong>Be careful with anything about money.</strong> Requests for a loan, an investment or a payment from someone you have just met are a reason to stop replying and to report the profile.</li>
<li><strong>Leave if something feels wrong.</strong> You do not owe anyone an explanation.</li>
</ul>
<p>In an emergency in the UAE, call <strong>999</strong> (police) or <strong>998</strong> (ambulance).</p>`,
      },
      {
        h2: 'Where IRLY fits in',
        html: `<p>IRLY belongs to the first type: a friendship and community app, and not a dating app. You join communities around your interests, join an activity or create your own, and talk in the group chat before you meet in real life. IRLY Girl is a space reserved for women, and IRLY Network is the part for professional meetings. The app starts in Dubai and covers the other emirates, in English and French. It is free and works today in the browser as a web app; iOS and Android apps are coming soon. It is one option among the types above. Try it alongside whatever else suits you, and keep the one that gets you out of the house.</p>`,
      },
    ],
    faq: [
      { q: 'What is the best app to make friends in Dubai?', a: 'There is no single best app. The right one is the one that is active near you and leads you to a regular activity with the same people, which depends on whether you prefer groups, one-to-one meetings or sport.' },
      { q: 'Can I use a dating app to make friends?', a: 'Some dating apps have a separate friends mode, and it can work. Say clearly that you are looking for friendship, because most people on these apps expect a date.' },
      { q: 'Are apps to make friends free?', a: 'It depends on the app: some are free, some have paid options, and booking apps charge for the court or class you book. Check before you sign up.' },
      { q: 'Is it safe to meet people from an app in Dubai?', a: 'The usual precautions apply as anywhere: meet in a public place, prefer a group for a first meeting, tell someone where you are going and do not send money to people you have just met.' },
      { q: 'How many apps should I use?', a: 'One or two are enough. What matters is going to activities and going back, not the number of apps on your phone.' },
      { q: 'What is the difference between a friendship app and a dating app?', a: 'A dating app is built for two people looking for a partner. A friendship app is built for meeting people around shared interests, often in groups, with no romantic expectation.' },
    ],
    cta: { title: 'Want to try a friendship app?', body: 'Looking to meet new people in Dubai? Discover IRLY and connect through activities and communities.', label: 'Discover IRLY' },
    related: [
      { label: 'How to make friends in Dubai', path: 'dubai/make-friends/' },
      { label: 'Activities in Dubai to meet people, by interest', path: 'dubai/activities/' },
      { label: 'Expat communities in Dubai: how to find yours', path: 'dubai/expat-communities/' },
      { label: 'Going out alone in Dubai', path: 'dubai/going-out-alone/' },
      { label: 'Making friends in Dubai as an introvert', path: 'blog/introvert-make-friends-dubai/' },
      { label: 'Making friends in Dubai in your 30s', path: 'blog/make-friends-dubai-30s/' },
    ],
  },
  {
    lang: 'fr',
    pair: 'dubai-app',
    path: 'fr/dubai/application-pour-se-faire-des-amis/',
    cover: 'dubaiCreek',
    city: 'Dubaï',
    published: '2026-11-11',
    title: 'Application de rencontre amicale à Dubaï : bien choisir | IRLY',
    description: 'Quelle application pour se faire des amis à Dubaï ? Les types d’applis de rencontre amicale, la différence avec une appli de rencontres amoureuses, la sécurité.',
    h1: 'Quelle application pour se faire des amis à Dubaï ?',
    lead: 'Aucune application n’est la meilleure pour tout le monde : la bonne dépend de ta façon de rencontrer les gens. À Dubaï, cinq types sont utilisés : les applications d’amitié et de communautés, les plateformes d’événements, les communautés sur messagerie, les applications de rencontres avec un mode amis et les applications de réservation de sport. Choisis celle qui t’amène le plus vite à une activité réelle et régulière : une amitié se construit en vrai, pas dans l’appli.',
    sections: [
      {
        h2: 'Les cinq types d’applications, et à quoi sert chacun',
        html: `<ul>
<li><strong>Les applications d’amitié et de communautés.</strong> Conçues pour rencontrer des gens autour de centres d’intérêt : tu rejoins des groupes par thème et tu participes à des activités. Adaptées si tu cherches des amis et pas un rendez-vous, dans un cadre où dire « je suis nouveau, j’aimerais rencontrer du monde » est normal.</li>
<li><strong>Les plateformes d’événements.</strong> Des listes d’événements publics et de meetups, par date et par thème. Pratiques pour trouver quoi faire cette semaine ; moins pour revoir les mêmes personnes, sauf si l’événement revient régulièrement.</li>
<li><strong>Les communautés sur messagerie.</strong> De grands groupes de discussion par quartier, nationalité, sport ou métier. Vivants et locaux, mais de qualité inégale, et les gros groupes sont vite bruyants.</li>
<li><strong>Les applications de rencontres avec un mode amis.</strong> Un mode séparé pour l’amitié dans une appli pensée pour le couple. Tout se passe en tête-à-tête, ce qui convient à certains et ressemble à un entretien pour d’autres.</li>
<li><strong>Les applications de réservation de sport.</strong> Faites pour réserver un terrain ou un cours, souvent avec des parties ouvertes où il manque des joueurs. Très efficaces si tu pratiques : l’activité est déjà organisée.</li>
</ul>`,
      },
      {
        h2: 'Comment choisir : cinq questions',
        html: `<ol>
<li><strong>En groupe ou en tête-à-tête ?</strong> Si un café avec un inconnu te fatigue d’avance, choisis une appli centrée sur les activités de groupe. Si la foule t’épuise, le tête-à-tête ou les petits groupes t’iront mieux.</li>
<li><strong>Est-ce que ça mène à quelque chose de régulier ?</strong> Une séance par semaine vaut mieux que dix événements ponctuels. Cherche des groupes et des activités qui reviennent.</li>
<li><strong>Est-ce actif près de chez toi ?</strong> Ouvre l’appli et regarde ce qui se passe cette semaine dans ton coin. Une appli peut être excellente ailleurs et calme dans ton quartier.</li>
<li><strong>L’intention est-elle claire ?</strong> Tu dois comprendre en une minute si les gens sont là pour l’amitié, la rencontre amoureuse, le business ou le sport.</li>
<li><strong>Peux-tu signaler et bloquer ?</strong> Vérifie que l’appli a des règles claires et des outils simples pour signaler une personne ou un groupe.</li>
</ol>
<p>Ensuite, limite-toi : une ou deux applis vraiment utilisées valent mieux que six que tu fais défiler.</p>`,
      },
      {
        h2: 'Application d’amitié ou application de rencontres : la différence',
        html: `<p>La différence tient moins aux fonctions qu’aux attentes. Sur une appli de rencontres, chacun cherche un ou une partenaire, les conversations sont à deux, et se voir est un rendez-vous. Sur une appli d’amitié, on vient pour faire des choses ensemble, souvent à plusieurs, et personne n’a à se demander ce que veut dire un message.</p>
<p>Le mode amis d’une appli de rencontres peut marcher, et certaines personnes s’y font de vrais amis. Mais si tu cherches un cercle plutôt qu’un seul nouveau contact, les outils construits autour des groupes et des activités sont en général un chemin plus court. Quel que soit ton choix, écris clairement ce que tu cherches, sur ton profil comme dans ton premier message. Ça évite les malentendus des deux côtés.</p>`,
      },
      {
        h2: 'Passer de l’appli à la vraie vie',
        html: `<p>Une application ne fait que la première partie du travail. La suite est la même que sans elle :</p>
<ul>
<li><strong>Écris un profil qui dit ce que tu aimes faire,</strong> pas seulement qui tu es. « Débutant au padel, dispo le samedi matin » attire plus de réponses qu’une liste d’adjectifs.</li>
<li><strong>Rejoins un plan qui existe déjà</strong> avant d’essayer d’en organiser un. C’est le premier pas le plus simple.</li>
<li><strong>Passe vite au rendez-vous.</strong> Quelques messages suffisent pour fixer un lieu et une heure. Les longues discussions deviennent rarement des amitiés.</li>
<li><strong>Retourne dans le même groupe.</strong> Ce sont les visages familiers qui transforment une activité en amis.</li>
</ul>
<p>Notre guide pour <a href="../se-faire-des-amis/">se faire des amis à Dubaï</a> propose un plan sur quatre semaines, <a href="../activites/">les activités à Dubaï par centre d’intérêt</a> t’aident à savoir quoi chercher, et <a href="../sortir-seul/">sortir seul à Dubaï</a> t’accompagne pour la première fois où tu arrives seul.</p>`,
      },
      {
        h2: 'Rencontrer en sécurité des personnes venues d’une appli',
        html: `<ul>
<li><strong>Donne rendez-vous dans un lieu public,</strong> et préfère une activité de groupe pour une première rencontre.</li>
<li><strong>Garde la conversation dans l’appli</strong> tant que vous ne vous êtes pas vus ; ton numéro, ton adresse et ton lieu de travail peuvent attendre.</li>
<li><strong>Préviens une personne de confiance</strong> de l’endroit où tu vas, et prévois ton propre moyen de rentrer.</li>
<li><strong>Méfie-toi de tout ce qui touche à l’argent.</strong> Une demande de prêt, d’investissement ou de paiement venant de quelqu’un que tu viens de rencontrer est une raison d’arrêter de répondre et de signaler le profil.</li>
<li><strong>Pars si quelque chose te gêne.</strong> Tu ne dois d’explication à personne.</li>
</ul>
<p>En cas d’urgence aux Émirats, appelle le <strong>999</strong> (police) ou le <strong>998</strong> (ambulance).</p>`,
      },
      {
        h2: 'Et IRLY dans tout ça ?',
        html: `<p>IRLY fait partie du premier type : une application d’amitié et de communautés, et non une application de rencontres amoureuses. Tu rejoins des communautés autour de tes centres d’intérêt, tu participes à une activité ou tu crées la tienne, et tu discutes dans le chat du groupe avant de vous voir en vrai. IRLY Girl est un espace réservé aux femmes, et IRLY Network est la partie consacrée aux rencontres professionnelles. L’application commence à Dubaï et couvre les autres émirats, en français et en anglais. Elle est gratuite et fonctionne dès aujourd’hui dans le navigateur ; les applications iOS et Android arrivent bientôt. C’est une option parmi les types décrits plus haut. Essaie-la à côté de ce qui te convient déjà, et garde ce qui te fait sortir de chez toi.</p>`,
      },
    ],
    faq: [
      { q: 'Quelle est la meilleure application pour se faire des amis à Dubaï ?', a: 'Il n’y a pas une seule meilleure application. La bonne est celle qui est active près de chez toi et qui t’amène à une activité régulière avec les mêmes personnes, selon que tu préfères les groupes, le tête-à-tête ou le sport.' },
      { q: 'Peut-on utiliser une application de rencontres pour se faire des amis ?', a: 'Certaines applications de rencontres ont un mode amis séparé, et ça peut marcher. Précise clairement que tu cherches de l’amitié, car la plupart des gens s’y attendent à un rendez-vous amoureux.' },
      { q: 'Les applications pour se faire des amis sont-elles gratuites ?', a: 'Ça dépend : certaines sont gratuites, d’autres ont des options payantes, et les applications de réservation font payer le terrain ou le cours réservé. Vérifie avant de t’inscrire.' },
      { q: 'Est-ce prudent de rencontrer à Dubaï des personnes venues d’une appli ?', a: 'Les précautions sont les mêmes qu’ailleurs : rendez-vous dans un lieu public, de préférence en groupe la première fois, une personne prévenue de l’endroit où tu vas, et jamais d’argent envoyé à quelqu’un que tu viens de rencontrer.' },
      { q: 'Combien d’applications faut-il utiliser ?', a: 'Une ou deux suffisent. Ce qui compte, c’est d’aller aux activités et d’y retourner, pas le nombre d’applis sur ton téléphone.' },
      { q: 'Quelle différence entre une application d’amitié et une application de rencontres ?', a: 'Une application de rencontres est faite pour deux personnes qui cherchent un ou une partenaire. Une application d’amitié sert à rencontrer des gens autour de centres d’intérêt communs, souvent en groupe, sans attente amoureuse.' },
    ],
    cta: { title: 'Envie d’essayer une appli d’amitié ?', body: 'Envie de rencontrer de nouvelles personnes à Dubaï ? Découvrez IRLY et rejoignez des communautés autour de vos centres d’intérêt.', label: 'Découvrir IRLY' },
    related: [
      { label: 'Se faire des amis à Dubaï', path: 'fr/dubai/se-faire-des-amis/' },
      { label: 'Activités à Dubaï pour rencontrer du monde, par centre d’intérêt', path: 'fr/dubai/activites/' },
      { label: 'Comment rejoindre une communauté d’expatriés à Dubaï', path: 'fr/dubai/communautes-expatries/' },
      { label: 'Sortir seul à Dubaï', path: 'fr/dubai/sortir-seul/' },
      { label: 'Se faire des amis à Dubaï quand on est introverti', path: 'fr/blog/introverti-se-faire-des-amis-dubai/' },
      { label: 'Se faire des amis à Dubaï dans la trentaine', path: 'fr/blog/se-faire-des-amis-dubai-trentaine/' },
    ],
  },
  {
    lang: 'en',
    pair: 'dubai-female-friends',
    path: 'dubai/make-female-friends/',
    cover: 'brunch',
    city: 'Dubai',
    published: '2026-11-11',
    title: 'How to Find Female Friends in Dubai, Step by Step | IRLY',
    description: 'How to find female friends in Dubai: where friendships between women start, women-only spaces, and the steps that turn a nice chat into a real friend.',
    h1: 'How to find female friends in Dubai',
    lead: 'Finding female friends in Dubai comes down to two things: putting yourself where other women come back every week, and making the small second move that most people skip, a message the same day and a plan within the week. Many women here are new too and hoping someone will ask. Below: where to start, how to go from acquaintance to friend, and how to feel safe doing it.',
    sections: [
      {
        h2: 'Why it is easier than it looks',
        html: `<p>Dubai is a city of arrivals. Many women came for a job, for a partner’s job or for a fresh start, and left their friends in another country. That means two things: you are far from the only one looking, and saying “I’m new and I’d like to meet people” is an ordinary sentence here, not an awkward one.</p>
<p>What makes it feel hard is rarely a lack of friendly women. It is the gap between a pleasant conversation and a second meeting. Closing that gap is a skill, and it is the subject of this page.</p>`,
      },
      {
        h2: 'Where friendships between women start',
        html: `<p>Friendships start where you see the same faces again. Some settings are especially good for meeting women:</p>
<ul>
<li><strong>Women-only classes and sessions.</strong> Some gyms, studios and pools offer women-only classes, hours or areas. Ask at the venue.</li>
<li><strong>Women’s communities.</strong> Groups for women around a neighbourhood, a language, a hobby or simply being new in the city, which organise coffees, walks and dinners.</li>
<li><strong>Professional women’s networks.</strong> Good if work is a big part of your life; the conversation starts easily.</li>
<li><strong>Mothers’ groups.</strong> Playdates and school communities, if you have children.</li>
<li><strong>Mixed activities.</strong> Run clubs, padel or language classes: many women go alone, exactly as you would.</li>
</ul>
<p>For the full list of ideas and how to choose between women-only and mixed formats, see <a href="../activities-for-women/">activities for women in Dubai</a>. This page picks up from the moment you have met someone you like.</p>`,
      },
      {
        h2: 'From a nice chat to a friend: the steps people skip',
        html: `<ol>
<li><strong>Get her contact before you leave.</strong> “I enjoyed talking to you. Shall we swap numbers?” is enough. Waiting for next time often means never.</li>
<li><strong>Write the same day.</strong> One line that refers to what you talked about: the café she mentioned, the class she recommended.</li>
<li><strong>Suggest a precise plan within the week.</strong> A day, a time and a place. “We should get coffee sometime” rarely happens; “Coffee on Saturday at ten after the class?” does.</li>
<li><strong>Move from the group to a small plan.</strong> A group makes meeting easy; a coffee for two or three is where you really talk.</li>
<li><strong>Share something real.</strong> Not everything at once, but a little more than small talk: what you miss, what you find hard here, what you are excited about. Friendship follows honesty.</li>
<li><strong>Make it regular.</strong> A walk every Sunday morning or a weekly class together removes the effort of planning each time.</li>
</ol>
<p>If she does not answer, try once more a week later, then let it go without taking it personally: schedules and family explain most silences. For a sense of how much time a friendship takes, read <a href="../../blog/how-often-see-someone-become-friend/">how often to see someone before they become a friend</a> and <a href="../../blog/gym-class-acquaintance-to-friend/">from gym or class acquaintance to friend</a>.</p>`,
      },
      {
        h2: 'When your lives do not look the same',
        html: `<p>Single or in a couple, with or without children, working long hours or not working at the moment: women in Dubai are at very different points, sometimes at the same age. Friendships cross these lines well when you adapt the format:</p>
<ul>
<li><strong>With a mother of young children,</strong> suggest a morning walk or a coffee near her home rather than a late dinner.</li>
<li><strong>With someone who works a lot,</strong> a fixed weekly slot is easier to keep than plans made at the last minute.</li>
<li><strong>If you are the one with free days,</strong> daytime classes and volunteering are full of women in the same position.</li>
</ul>
<p>If you came for your partner’s career, <a href="../../blog/moved-for-partner-job-dubai-own-circle/">building your own circle in Dubai</a> is written for you.</p>`,
      },
      {
        h2: 'Friends leave: keep more than one circle',
        html: `<p>People move on from Dubai, and losing a close friend to another country hurts. You cannot prevent it, but you can make your social life less fragile: keep two or three circles rather than one best friend, keep meeting new women even when you feel settled, and introduce your friends to each other. A group survives a departure better than a pair. Our guide on <a href="../make-friends/">how to make friends in Dubai</a> describes a routine you can keep all year.</p>`,
      },
      {
        h2: 'Feeling safe and at ease',
        html: `<ul>
<li><strong>Prefer a group or a class for a first meeting</strong> with someone you only know online, then a busy café.</li>
<li><strong>Check who runs a women’s group.</strong> A named organiser, clear rules and regular meetings are good signs. Be wary of groups that mainly sell something.</li>
<li><strong>Keep your home address for later,</strong> and arrange your own way there and back.</li>
<li><strong>Say no without justifying yourself.</strong> A plan that does not suit you, a place too far, a late hour: a real friend accepts it.</li>
<li><strong>Trust the feeling.</strong> If a person or a group makes you uneasy, you can leave and not come back.</li>
</ul>`,
      },
      {
        h2: 'Where IRLY fits in',
        html: `<p>IRLY is an app to meet people who share your interests and do things together in real life, through communities, activities and group chats. It is not a dating app. Inside it, IRLY Girl is a space reserved for women, with women-only communities and activities: <a href="/girl">the IRLY Girl page</a> explains how it works. IRLY is free and works today in the browser as a web app; iOS and Android apps are coming soon. It is one option among others. The steps above are what turn a first meeting into a friend, wherever that meeting happens.</p>`,
      },
    ],
    faq: [
      { q: 'How do I make female friends in Dubai as an adult?', a: 'Join one regular activity where women come back each week, swap contacts with someone you enjoyed talking to, and suggest a precise plan within a few days. Repeating this over a few weeks is what builds a friendship.' },
      { q: 'Are there women-only groups and spaces in Dubai?', a: 'Yes. There are women’s communities, women-only classes or hours in some gyms, studios and pools, and women-only spaces in some apps. Check each venue or organiser for how it works.' },
      { q: 'Is it strange to ask another woman for her number?', a: 'No. In a city where so many people are new, it is common and usually welcome. A simple sentence such as “Shall we swap numbers and get a coffee?” is enough.' },
      { q: 'How long does it take to make a close friend?', a: 'It varies, but it takes repeated time together, usually over several months. Seeing someone regularly matters more than one long evening.' },
      { q: 'What if I am shy or introverted?', a: 'Choose small groups and activities with something to do, such as a class or a walk, and aim for one conversation per session. One-to-one plans afterwards often suit quieter people better than large events.' },
    ],
    cta: { title: 'Looking for other women to do things with?', body: 'Looking to meet new people in Dubai? Discover IRLY and connect through activities and communities.', label: 'Discover IRLY' },
    related: [
      { label: 'Activities for women in Dubai', path: 'dubai/activities-for-women/' },
      { label: 'How to make friends in Dubai', path: 'dubai/make-friends/' },
      { label: 'How often to see someone before they become a friend', path: 'blog/how-often-see-someone-become-friend/' },
      { label: 'Going out alone in Dubai', path: 'dubai/going-out-alone/' },
      { label: 'Making friends in Dubai as an introvert', path: 'blog/introvert-make-friends-dubai/' },
      { label: 'Expat communities in Dubai', path: 'dubai/expat-communities/' },
    ],
  },
  {
    lang: 'fr',
    pair: 'dubai-female-friends',
    path: 'fr/dubai/trouver-des-copines/',
    cover: 'brunch',
    city: 'Dubaï',
    published: '2026-11-11',
    title: 'Trouver des copines à Dubaï : se faire des amies | IRLY',
    description: 'Comment trouver des copines à Dubaï : où naissent les amitiés entre femmes, les espaces réservés aux femmes et comment passer d’une rencontre à une amie.',
    h1: 'Comment trouver des copines à Dubaï ?',
    lead: 'Trouver des copines à Dubaï tient à deux choses : te placer là où d’autres femmes reviennent chaque semaine, et faire le petit deuxième pas que presque tout le monde oublie, un message le jour même et une proposition dans la semaine. Beaucoup de femmes ici sont nouvelles elles aussi et espèrent qu’on leur propose. Ci-dessous : par où commencer, comment passer de connaissance à amie, et comment le faire en te sentant en sécurité.',
    sections: [
      {
        h2: 'Pourquoi c’est plus simple qu’il n’y paraît',
        html: `<p>Dubaï est une ville d’arrivées. Beaucoup de femmes sont venues pour un poste, pour celui de leur conjoint ou pour repartir de zéro, et ont laissé leurs amies dans un autre pays. Ça veut dire deux choses : tu es loin d’être la seule à chercher, et « je suis nouvelle, j’aimerais rencontrer du monde » est ici une phrase banale, pas gênante.</p>
<p>Ce qui rend les choses difficiles, c’est rarement le manque de femmes sympas. C’est l’écart entre une conversation agréable et une deuxième rencontre. Combler cet écart s’apprend, et c’est le sujet de cette page.</p>`,
      },
      {
        h2: 'Où naissent les amitiés entre femmes',
        html: `<p>Une amitié commence là où tu revois les mêmes visages. Certains cadres s’y prêtent bien :</p>
<ul>
<li><strong>Les cours et créneaux réservés aux femmes.</strong> Certaines salles, certains studios et certaines piscines proposent des cours, des horaires ou des espaces entre femmes. Renseigne-toi sur place.</li>
<li><strong>Les communautés de femmes.</strong> Des groupes autour d’un quartier, d’une langue, d’une passion ou simplement du fait d’être nouvelle, qui organisent cafés, balades et dîners.</li>
<li><strong>Les réseaux professionnels féminins.</strong> Utiles si le travail compte beaucoup pour toi ; la conversation démarre facilement.</li>
<li><strong>Les groupes de mamans.</strong> Sorties avec les enfants et vie de l’école, si tu es mère.</li>
<li><strong>Les activités mixtes.</strong> Clubs de running, padel ou cours de langue : beaucoup de femmes y vont seules, exactement comme toi.</li>
</ul>
<p>Pour la liste complète d’idées et pour choisir entre formats réservés aux femmes et formats mixtes, lis <a href="../activites-entre-femmes/">activités entre femmes à Dubaï</a>. Cette page commence au moment où tu as rencontré quelqu’un avec qui le courant passe.</p>`,
      },
      {
        h2: 'D’une conversation sympa à une amie : les étapes qu’on saute',
        html: `<ol>
<li><strong>Prends son contact avant de partir.</strong> « J’ai bien aimé discuter avec toi, on échange nos numéros ? » suffit. Attendre la prochaine fois, c’est souvent ne jamais le faire.</li>
<li><strong>Écris le jour même.</strong> Une ligne qui reprend ce dont vous avez parlé : le café qu’elle a cité, le cours qu’elle t’a conseillé.</li>
<li><strong>Propose un plan précis dans la semaine.</strong> Un jour, une heure, un lieu. « Il faudrait qu’on prenne un café » n’arrive presque jamais ; « Un café samedi à dix heures après le cours ? », si.</li>
<li><strong>Passe du groupe au petit comité.</strong> Le groupe facilite la rencontre ; c’est autour d’un café à deux ou trois qu’on se parle vraiment.</li>
<li><strong>Partage quelque chose de vrai.</strong> Pas tout d’un coup, mais un peu plus que des banalités : ce qui te manque, ce qui est difficile ici, ce qui t’enthousiasme. L’amitié suit la sincérité.</li>
<li><strong>Installe un rendez-vous régulier.</strong> Une marche le dimanche matin ou un cours suivi ensemble évitent de tout réorganiser à chaque fois.</li>
</ol>
<p>Si elle ne répond pas, relance une fois une semaine plus tard, puis laisse tomber sans le prendre pour toi : l’agenda et la famille expliquent la plupart des silences. Pour savoir combien de temps demande une amitié, lis <a href="../../blog/combien-de-fois-se-voir-pour-devenir-amis/">combien de fois se voir avant de devenir amis</a> et <a href="../../blog/connaissance-sport-cours-devenir-ami/">faire d’une connaissance de sport ou de cours un ami</a>.</p>`,
      },
      {
        h2: 'Quand vos vies ne se ressemblent pas',
        html: `<p>Célibataire ou en couple, avec ou sans enfants, avec des semaines très chargées ou sans emploi pour l’instant : à Dubaï, les femmes en sont à des étapes très différentes, parfois au même âge. Les amitiés passent bien ces frontières si tu adaptes le format :</p>
<ul>
<li><strong>Avec la mère de jeunes enfants,</strong> propose une marche le matin ou un café près de chez elle plutôt qu’un dîner tardif.</li>
<li><strong>Avec celle qui travaille beaucoup,</strong> un créneau fixe chaque semaine tient mieux que des plans de dernière minute.</li>
<li><strong>Si c’est toi qui as tes journées libres,</strong> les cours en journée et le bénévolat sont pleins de femmes dans la même situation.</li>
</ul>
<p>Si tu es venue pour la carrière de ton ou ta partenaire, <a href="../../blog/suivre-partenaire-dubai-ton-propre-cercle/">construire ton propre cercle à Dubaï</a> est écrit pour toi.</p>`,
      },
      {
        h2: 'Les amies repartent : garde plusieurs cercles',
        html: `<p>On quitte souvent Dubaï, et voir une amie proche partir dans un autre pays fait mal. Tu ne peux pas l’empêcher, mais tu peux rendre ta vie sociale moins fragile : garde deux ou trois cercles plutôt qu’une seule meilleure amie, continue à rencontrer de nouvelles femmes même quand tu te sens installée, et présente tes amies les unes aux autres. Un groupe résiste mieux à un départ qu’un duo. Notre guide pour <a href="../se-faire-des-amis/">se faire des amis à Dubaï</a> décrit une routine à garder toute l’année.</p>`,
      },
      {
        h2: 'Te sentir en sécurité et à l’aise',
        html: `<ul>
<li><strong>Préfère un groupe ou un cours pour une première rencontre</strong> avec quelqu’un que tu ne connais qu’en ligne, puis un café fréquenté.</li>
<li><strong>Regarde qui anime un groupe de femmes.</strong> Une organisatrice identifiée, des règles claires et des rencontres régulières sont de bons signes. Méfie-toi des groupes qui cherchent surtout à vendre quelque chose.</li>
<li><strong>Garde ton adresse pour plus tard,</strong> et prévois ton propre trajet aller et retour.</li>
<li><strong>Dis non sans te justifier.</strong> Un plan qui ne te convient pas, un lieu trop loin, une heure trop tardive : une vraie amie l’accepte.</li>
<li><strong>Écoute ton ressenti.</strong> Si une personne ou un groupe te met mal à l’aise, tu peux partir et ne pas revenir.</li>
</ul>`,
      },
      {
        h2: 'Et IRLY dans tout ça ?',
        html: `<p>IRLY est une application pour rencontrer des personnes qui partagent tes centres d’intérêt et faire des choses ensemble, en vrai, grâce à des communautés, des activités et des discussions de groupe. Ce n’est pas une application de rencontres amoureuses. À l’intérieur, IRLY Girl est un espace réservé aux femmes, avec des communautés et des activités entre femmes : <a href="/fr/girl">la page IRLY Girl</a> explique comment ça marche. IRLY est gratuite et fonctionne dès aujourd’hui dans le navigateur ; les applications iOS et Android arrivent bientôt. C’est une option parmi d’autres. Ce sont les étapes ci-dessus qui transforment une première rencontre en amie, où qu’elle ait lieu.</p>`,
      },
    ],
    faq: [
      { q: 'Comment se faire des amies à Dubaï à l’âge adulte ?', a: 'Rejoins une activité régulière où des femmes reviennent chaque semaine, échange ton contact avec celle avec qui tu as aimé discuter, et propose un plan précis dans les jours qui suivent. C’est la répétition sur quelques semaines qui construit l’amitié.' },
      { q: 'Existe-t-il des groupes et des espaces réservés aux femmes à Dubaï ?', a: 'Oui. Il existe des communautés de femmes, des cours ou des horaires entre femmes dans certaines salles, studios et piscines, et des espaces réservés aux femmes dans certaines applications. Vérifie le fonctionnement auprès de chaque lieu ou organisatrice.' },
      { q: 'Est-ce bizarre de demander son numéro à une autre femme ?', a: 'Non. Dans une ville où tant de personnes sont nouvelles, c’est courant et souvent bien accueilli. Une phrase simple comme « On échange nos numéros et on prend un café ? » suffit.' },
      { q: 'Combien de temps faut-il pour se faire une amie proche ?', a: 'C’est variable, mais il faut du temps passé ensemble, répété, en général sur plusieurs mois. Se voir régulièrement compte plus qu’une seule longue soirée.' },
      { q: 'Et si je suis timide ou introvertie ?', a: 'Choisis des petits groupes et des activités où l’on fait quelque chose, comme un cours ou une balade, et vise une conversation par séance. Les plans à deux, ensuite, conviennent souvent mieux aux personnes calmes que les grands événements.' },
    ],
    cta: { title: 'Tu cherches d’autres femmes avec qui sortir ?', body: 'Envie de rencontrer de nouvelles personnes à Dubaï ? Découvrez IRLY et rejoignez des communautés autour de vos centres d’intérêt.', label: 'Découvrir IRLY' },
    related: [
      { label: 'Activités entre femmes à Dubaï', path: 'fr/dubai/activites-entre-femmes/' },
      { label: 'Se faire des amis à Dubaï', path: 'fr/dubai/se-faire-des-amis/' },
      { label: 'Combien de fois se voir avant de devenir amis ?', path: 'fr/blog/combien-de-fois-se-voir-pour-devenir-amis/' },
      { label: 'Sortir seul à Dubaï', path: 'fr/dubai/sortir-seul/' },
      { label: 'Se faire des amis à Dubaï quand on est introverti', path: 'fr/blog/introverti-se-faire-des-amis-dubai/' },
      { label: 'Communautés d’expatriés à Dubaï', path: 'fr/dubai/communautes-expatries/' },
    ],
  },
  {
    lang: 'en',
    pair: 'dubai-running',
    path: 'dubai/running-clubs/',
    cover: 'running',
    city: 'Dubai',
    published: '2026-11-11',
    title: 'Dubai Running Clubs: How to Join a Social Run Club | IRLY',
    description: 'How social running clubs work in Dubai: when they run because of the heat, levels, what to bring, how to pick one and how a run club becomes friends.',
    h1: 'How to join a social running club in Dubai',
    lead: 'Joining a social running club in Dubai is simple: find a group that runs near you at a time you can keep, tell the organiser it is your first time, and turn up. Most groups run early in the morning or after sunset because of the heat, welcome several paces, and end with a coffee. That coffee, week after week, is what turns a run club into a circle of friends.',
    sections: [
      {
        h2: 'How a social run club works',
        html: `<p>A social run club is a group that meets at a fixed place and time to run together, with the social side counting as much as the sport. Groups are run by volunteers, by a community, or by a shop, a gym or a café. Many are free to join; some ask you to register or to become a member, so check the group’s page.</p>
<p>A typical session looks like this:</p>
<ol>
<li><strong>Meeting point.</strong> People arrive ten minutes early, say hello and leave their things.</li>
<li><strong>Short briefing.</strong> The organiser explains the route, the distances on offer and the pace groups.</li>
<li><strong>The run.</strong> Often two or three distances, with a leader in each group and someone at the back.</li>
<li><strong>After the run.</strong> Stretching, photos, then coffee or breakfast for those who stay.</li>
</ol>`,
      },
      {
        h2: 'When clubs run: the heat sets the timetable',
        html: `<p>In Dubai the climate decides the schedule more than anything else.</p>
<ul>
<li><strong>Early morning.</strong> Many groups start around sunrise, especially at weekends. It is the coolest part of the day and leaves time for breakfast together.</li>
<li><strong>Evening.</strong> Weekday runs usually start after sunset, once work is over and the temperature drops.</li>
<li><strong>The cooler months.</strong> From autumn to spring the season is at its busiest, with the most groups and the longest runs.</li>
<li><strong>Summer.</strong> From roughly June to September, groups that continue run very early or late, shorten the distance, or move indoors, on treadmills for example. Some pause until the heat eases.</li>
</ul>
<p>Popular routes follow public running tracks, for example the one along the sand at Kite Beach, as well as parks and waterfront promenades.</p>`,
      },
      {
        h2: 'Levels: you do not need to be fast',
        html: `<p>Social clubs are built for mixed levels. Most offer several pace groups, and many include a run-walk group or a short beginner distance. A few are aimed at performance, with structured training; their page usually says so.</p>
<ul>
<li><strong>Tell the organiser your real pace,</strong> or simply how long you can run without stopping. They will place you in the right group.</li>
<li><strong>Start in a slower group than you think.</strong> You should be able to talk while running; that is the point.</li>
<li><strong>Ask whether someone stays at the back.</strong> In a welcoming club, nobody finishes alone.</li>
</ul>
<p>If you are new to running or have a health concern, start gently and ask a doctor first.</p>`,
      },
      {
        h2: 'What to bring',
        html: `<ul>
<li><strong>Water,</strong> and more than you think you need. In warm weather, add electrolytes.</li>
<li><strong>Light, breathable clothes</strong> and running shoes you have already worn.</li>
<li><strong>A cap, sunglasses and sunscreen</strong> for morning runs once the sun is up.</li>
<li><strong>Something visible or a small light</strong> for runs in the dark.</li>
<li><strong>A dry top and a small towel</strong> if you plan to stay for coffee.</li>
<li><strong>Your phone,</strong> charged, with the meeting point saved.</li>
</ul>`,
      },
      {
        h2: 'How to pick the right club',
        html: `<ol>
<li><strong>Close to home or work.</strong> A club across the city at dawn will not last. Distance is the first reason people stop.</li>
<li><strong>A time you can keep every week.</strong> Regularity matters more than the perfect group.</li>
<li><strong>A pace range that includes yours.</strong> Check the paces and distances announced.</li>
<li><strong>The atmosphere you want.</strong> Social and chatty, or focused on training: both exist.</li>
<li><strong>Size.</strong> Large groups have energy; small ones make it easier to learn names.</li>
</ol>
<p>Try two clubs, twice each, before you decide. If you prefer other sports or formats, <a href="../activities/">activities in Dubai by interest</a> and our list of <a href="../group-activities/">15 group activities</a> cover the alternatives, and running also features among the <a href="../free-social-activities/">free social activities in Dubai</a>.</p>`,
      },
      {
        h2: 'How a run club becomes a circle of friends',
        html: `<ul>
<li><strong>Stay for the coffee.</strong> The run makes people familiar; the twenty minutes afterwards make them friends.</li>
<li><strong>Run in the same pace group each week.</strong> You will see the same four or five people.</li>
<li><strong>Learn names and use them.</strong> It is the simplest sign that you intend to come back.</li>
<li><strong>Pick a shared goal.</strong> Training together for an event gives the group a reason to meet more often. Each year, the Dubai Fitness Challenge brings free sessions across the city, and its Dubai Run is a mass run that a group can enter together.</li>
<li><strong>Suggest the extra plan.</strong> A longer run on Saturday, a breakfast, a hike in the cooler months.</li>
<li><strong>Help out.</strong> Leading a pace group or welcoming newcomers puts you at the centre of the club.</li>
</ul>
<p>Arriving alone is normal; most members did. If that first time worries you, read <a href="../going-out-alone/">going out alone in Dubai</a>.</p>`,
      },
      {
        h2: 'Where IRLY fits in',
        html: `<p>IRLY is an app to meet people who share your interests and do things together in real life: communities, activities you can join or create, and group chats. For running, that means you can look for a running community, join a run that someone has posted, or create your own and see who comes. It is free, in English and French, and works today in the browser as a web app; iOS and Android apps are coming soon. It is one option among others: any club you go back to every week will do the job.</p>`,
      },
    ],
    faq: [
      { q: 'Do I need to be a good runner to join a run club in Dubai?', a: 'No. Most social run clubs have several pace groups and often a beginner or run-walk group. Tell the organiser your level before the first session.' },
      { q: 'Are running clubs in Dubai free?', a: 'Many community run clubs are free to join, while some ask for registration or a membership. Check the page of the group you are interested in.' },
      { q: 'What time do run clubs meet in Dubai?', a: 'Usually early in the morning, around sunrise, or in the evening after sunset, because of the heat. Exact times change with the season, so check with each group.' },
      { q: 'Can I go to a run club alone?', a: 'Yes, most people arrive alone the first time. Message the organiser beforehand and arrive a few minutes early so that someone can introduce you.' },
      { q: 'Do run clubs continue during the summer?', a: 'Some do, with very early or late sessions, shorter distances or indoor runs, and some pause. Ask the group what it plans for the hot months.' },
    ],
    cta: { title: 'Looking for people to run with?', body: 'Looking to meet new people in Dubai? Discover IRLY and connect through activities and communities.', label: 'Discover IRLY' },
    related: [
      { label: 'Activities in Dubai to meet people, by interest', path: 'dubai/activities/' },
      { label: 'Free social activities in Dubai to meet people', path: 'dubai/free-social-activities/' },
      { label: '15 group activities to meet people in Dubai', path: 'dubai/group-activities/' },
      { label: 'How to make friends in Dubai', path: 'dubai/make-friends/' },
      { label: 'From gym or class acquaintance to friend', path: 'blog/gym-class-acquaintance-to-friend/' },
      { label: 'What to say to start a conversation', path: 'blog/what-to-say-start-conversation-activity/' },
    ],
  },
  {
    lang: 'fr',
    pair: 'dubai-running',
    path: 'fr/dubai/clubs-de-running/',
    cover: 'running',
    city: 'Dubaï',
    published: '2026-11-11',
    title: 'Running club à Dubaï : comment en rejoindre un | IRLY',
    description: 'Running club à Dubaï : comment fonctionnent les clubs, horaires liés à la chaleur, niveaux, quoi apporter, comment choisir et comment s’y faire des amis.',
    h1: 'Comment rejoindre un club de running à Dubaï ?',
    lead: 'Rejoindre un club de running à Dubaï est simple : trouve un groupe qui court près de chez toi à un horaire que tu peux tenir, préviens l’organisateur que c’est ta première fois, et viens. La plupart des groupes courent tôt le matin ou après le coucher du soleil à cause de la chaleur, accueillent plusieurs allures et finissent par un café. C’est ce café, semaine après semaine, qui transforme un club en cercle d’amis.',
    sections: [
      {
        h2: 'Comment fonctionne un club de running social',
        html: `<p>Un club de running social, c’est un groupe qui se retrouve à heure et lieu fixes pour courir ensemble, et où le côté convivial compte autant que le sport. Les groupes sont animés par des bénévoles, par une communauté, ou par une boutique, une salle de sport ou un café. Beaucoup sont gratuits ; certains demandent une inscription ou une adhésion : regarde la page du groupe.</p>
<p>Une séance type se déroule ainsi :</p>
<ol>
<li><strong>Le point de rendez-vous.</strong> On arrive dix minutes avant, on se dit bonjour, on pose ses affaires.</li>
<li><strong>Un court briefing.</strong> L’organisateur présente le parcours, les distances proposées et les groupes d’allure.</li>
<li><strong>La sortie.</strong> Souvent deux ou trois distances, avec un meneur par groupe et quelqu’un qui ferme la marche.</li>
<li><strong>L’après.</strong> Étirements, photos, puis café ou petit-déjeuner pour ceux qui restent.</li>
</ol>`,
      },
      {
        h2: 'Les horaires : c’est la chaleur qui décide',
        html: `<p>À Dubaï, le climat fixe le planning plus que tout le reste.</p>
<ul>
<li><strong>Tôt le matin.</strong> Beaucoup de groupes partent autour du lever du soleil, surtout le week-end. C’est le moment le plus frais, et il laisse le temps de prendre un petit-déjeuner ensemble.</li>
<li><strong>Le soir.</strong> En semaine, les sorties démarrent en général après le coucher du soleil, une fois le travail terminé et la température retombée.</li>
<li><strong>Les mois frais.</strong> De l’automne au printemps, c’est la pleine saison : le plus de groupes et les sorties les plus longues.</li>
<li><strong>L’été.</strong> En gros de juin à septembre, les groupes qui continuent courent très tôt ou tard, raccourcissent les distances ou passent en intérieur, sur tapis de course par exemple. Certains font une pause jusqu’au retour de la fraîcheur.</li>
</ul>
<p>Les parcours les plus courus suivent les pistes publiques, par exemple celle qui longe le sable à Kite Beach, ainsi que les parcs et les promenades en bord de mer.</p>`,
      },
      {
        h2: 'Les niveaux : pas besoin d’être rapide',
        html: `<p>Les clubs sociaux sont faits pour les niveaux mélangés. La plupart proposent plusieurs groupes d’allure, et beaucoup ont un groupe qui alterne course et marche ou une courte distance pour débutants. Quelques-uns visent la performance, avec un entraînement structuré ; leur page le précise en général.</p>
<ul>
<li><strong>Donne ton allure réelle à l’organisateur,</strong> ou simplement le temps que tu peux courir sans t’arrêter. Il te placera dans le bon groupe.</li>
<li><strong>Commence dans un groupe plus lent que tu ne le penses.</strong> Tu dois pouvoir parler en courant : c’est le but.</li>
<li><strong>Demande si quelqu’un reste à l’arrière.</strong> Dans un club accueillant, personne ne termine seul.</li>
</ul>
<p>Si tu débutes la course ou si tu as un souci de santé, démarre doucement et demande d’abord l’avis d’un médecin.</p>`,
      },
      {
        h2: 'Quoi apporter',
        html: `<ul>
<li><strong>De l’eau,</strong> plus que ce que tu crois nécessaire. Par temps chaud, ajoute des électrolytes.</li>
<li><strong>Des vêtements légers et respirants</strong> et des chaussures de course que tu as déjà portées.</li>
<li><strong>Une casquette, des lunettes et de la crème solaire</strong> pour les sorties du matin une fois le soleil levé.</li>
<li><strong>Un élément visible ou une petite lampe</strong> pour les sorties de nuit.</li>
<li><strong>Un haut sec et une petite serviette</strong> si tu comptes rester pour le café.</li>
<li><strong>Ton téléphone,</strong> chargé, avec le point de rendez-vous enregistré.</li>
</ul>`,
      },
      {
        h2: 'Comment choisir le bon club',
        html: `<ol>
<li><strong>Près de chez toi ou de ton travail.</strong> Un club à l’autre bout de la ville à l’aube ne tiendra pas. La distance est la première raison d’abandon.</li>
<li><strong>Un horaire tenable chaque semaine.</strong> La régularité compte plus que le groupe parfait.</li>
<li><strong>Une fourchette d’allures qui inclut la tienne.</strong> Regarde les allures et les distances annoncées.</li>
<li><strong>L’ambiance que tu cherches.</strong> Conviviale et bavarde, ou tournée vers l’entraînement : les deux existent.</li>
<li><strong>La taille.</strong> Les grands groupes ont de l’énergie ; dans les petits, on retient plus vite les prénoms.</li>
</ol>
<p>Essaie deux clubs, deux fois chacun, avant de te décider. Si tu préfères d’autres sports ou d’autres formats, <a href="../activites/">les activités à Dubaï par centre d’intérêt</a> et notre liste de <a href="../activites-de-groupe/">15 activités de groupe</a> présentent les alternatives, et la course figure aussi parmi les <a href="../activites-gratuites/">activités gratuites à Dubaï</a>.</p>`,
      },
      {
        h2: 'Comment un club devient un cercle d’amis',
        html: `<ul>
<li><strong>Reste pour le café.</strong> La course rend les visages familiers ; ce sont les vingt minutes d’après qui créent les amitiés.</li>
<li><strong>Cours chaque semaine dans le même groupe d’allure.</strong> Tu y retrouveras les mêmes quatre ou cinq personnes.</li>
<li><strong>Retiens les prénoms et utilise-les.</strong> C’est le signe le plus simple que tu comptes revenir.</li>
<li><strong>Choisissez un objectif commun.</strong> Préparer un événement ensemble donne au groupe une raison de se voir plus souvent. Chaque année, le Dubai Fitness Challenge propose des séances gratuites dans toute la ville, et sa Dubai Run est une grande course populaire à laquelle un groupe peut s’inscrire ensemble.</li>
<li><strong>Propose le plan en plus.</strong> Une sortie longue le samedi, un petit-déjeuner, une randonnée pendant les mois frais.</li>
<li><strong>Donne un coup de main.</strong> Mener un groupe d’allure ou accueillir les nouveaux te place au cœur du club.</li>
</ul>
<p>Arriver seul est normal : la plupart des membres ont fait pareil. Si cette première fois t’inquiète, lis <a href="../sortir-seul/">sortir seul à Dubaï</a>.</p>`,
      },
      {
        h2: 'Et IRLY dans tout ça ?',
        html: `<p>IRLY est une application pour rencontrer des personnes qui partagent tes centres d’intérêt et faire des choses ensemble, en vrai : des communautés, des activités à rejoindre ou à créer, et des discussions de groupe. Pour la course, ça veut dire que tu peux chercher une communauté de running, rejoindre une sortie que quelqu’un a proposée, ou créer la tienne et voir qui vient. Elle est gratuite, en français et en anglais, et fonctionne dès aujourd’hui dans le navigateur ; les applications iOS et Android arrivent bientôt. C’est une option parmi d’autres : n’importe quel club où tu retournes chaque semaine fera l’affaire.</p>`,
      },
    ],
    faq: [
      { q: 'Faut-il être bon coureur pour rejoindre un club de running à Dubaï ?', a: 'Non. La plupart des clubs sociaux ont plusieurs groupes d’allure et souvent un groupe débutant ou course-marche. Indique ton niveau à l’organisateur avant la première séance.' },
      { q: 'Les clubs de running à Dubaï sont-ils gratuits ?', a: 'Beaucoup de clubs communautaires sont gratuits, tandis que certains demandent une inscription ou une adhésion. Vérifie la page du groupe qui t’intéresse.' },
      { q: 'À quelle heure courent les clubs à Dubaï ?', a: 'En général tôt le matin, autour du lever du soleil, ou le soir après le coucher du soleil, à cause de la chaleur. Les horaires précis changent selon la saison : vérifie auprès de chaque groupe.' },
      { q: 'Peut-on venir seul à un club de running ?', a: 'Oui, la plupart des gens arrivent seuls la première fois. Écris à l’organisateur avant et arrive quelques minutes en avance pour qu’on te présente.' },
      { q: 'Les clubs continuent-ils pendant l’été ?', a: 'Certains oui, avec des séances très matinales ou tardives, des distances plus courtes ou des sorties en intérieur, et d’autres font une pause. Demande au groupe ce qu’il prévoit pour les mois chauds.' },
    ],
    cta: { title: 'Tu cherches des gens avec qui courir ?', body: 'Envie de rencontrer de nouvelles personnes à Dubaï ? Découvrez IRLY et rejoignez des communautés autour de vos centres d’intérêt.', label: 'Découvrir IRLY' },
    related: [
      { label: 'Activités à Dubaï pour rencontrer du monde, par centre d’intérêt', path: 'fr/dubai/activites/' },
      { label: 'Activités gratuites à Dubaï pour rencontrer du monde', path: 'fr/dubai/activites-gratuites/' },
      { label: '15 activités de groupe pour rencontrer du monde à Dubaï', path: 'fr/dubai/activites-de-groupe/' },
      { label: 'Se faire des amis à Dubaï', path: 'fr/dubai/se-faire-des-amis/' },
      { label: 'Salle de sport ou cours : d’une connaissance à un ami', path: 'fr/blog/connaissance-sport-cours-devenir-ami/' },
      { label: 'Quoi dire pour lancer une conversation', path: 'fr/blog/quoi-dire-pour-lancer-une-conversation-activite/' },
    ],
  },
  {
    lang: 'en',
    pair: 'dubai-expats',
    path: 'dubai/expat-communities/',
    cover: 'brunch',
    city: 'Dubai',
    published: '2026-11-11',
    title: 'Expat Communities in Dubai: How to Find Yours | IRLY',
    description: 'The kinds of expat communities in Dubai, by language, interest, profession, neighbourhood, for parents and for women, and how to go from member to friend.',
    h1: 'Expat communities in Dubai: how to find yours',
    lead: 'Dubai does not have one expat community but many, and they overlap: by language or country, by interest, by profession, by neighbourhood, for parents and for women. Start with two, one that feels like home and one built around something you enjoy doing, and judge them by how often they meet in person. Being a member changes nothing; turning up three times does.',
    sections: [
      {
        h2: 'Many communities, not one',
        html: `<p>Most people who live in Dubai came from somewhere else. “The expat community” therefore describes almost the whole city, which is why the phrase is not much help when you are looking for people. What exists in practice is a large number of smaller communities, each with its own reason to meet. The useful question is not “where are the expats?” but “which group meets regularly around something I care about?”</p>`,
      },
      {
        h2: 'The main kinds of communities',
        html: `<h3>By language or country</h3>
<p>National associations, cultural centres, language groups and their online spaces. They are good for practical advice, for celebrating your own holidays and for the rest that comes with speaking your language. Example: our guide to <a href="../meet-french-people/">meeting French people in Dubai</a>.</p>
<h3>By interest</h3>
<p>Run clubs, padel groups, hiking groups, book clubs, board games, photography, music. Nationalities mix naturally because the activity comes first. These are often the quickest route to friends.</p>
<h3>By profession</h3>
<p>Business councils, industry meetups, founder and freelancer groups. Useful for work, and for friendships with people who understand your working life. See <a href="../networking/">networking in Dubai</a>.</p>
<h3>By neighbourhood</h3>
<p>Residents’ groups for a building, a compound or an area. Because distances are long in Dubai, friends who live ten minutes away are the ones you see most.</p>
<h3>Parents</h3>
<p>School communities, playgroups and parents’ meetups. Children give you a reason to meet every week.</p>
<h3>Women</h3>
<p>Women’s communities and women-only activities, for those who prefer them. See <a href="../make-female-friends/">how to find female friends in Dubai</a>.</p>`,
      },
      {
        h2: 'How to choose',
        html: `<ol>
<li><strong>What do you need right now?</strong> Practical answers, friends, professional contacts or people for your sport. Different communities are good at different things.</li>
<li><strong>Does it meet in person, and how often?</strong> A group that only chats online will inform you but will rarely give you friends. Look for a regular meeting.</li>
<li><strong>What size is it?</strong> Very large groups are useful for information. Friendships form in smaller groups, or in the small circles inside a big one.</li>
<li><strong>Who runs it?</strong> An identified organiser, clear rules and a history of past meetings are good signs.</li>
<li><strong>What does it cost?</strong> Some communities are free, some charge a membership or a fee per event. Check before you commit, and be careful with groups whose main activity is selling to their members.</li>
</ol>
<p>You do not have to choose once and for all. Try a few during your first months, then keep the two where you felt most at ease.</p>`,
      },
      {
        h2: 'One home community, one mixed community',
        html: `<p>A community of people from your country or language gives quick comfort, and there is nothing wrong with starting there. On its own, though, it can become a bubble, and it shrinks each time a family moves away.</p>
<p>The balance that works for most people is one home community and one mixed community built around an interest. The first gives you familiarity; the second gives you variety and friends who would never have crossed your path otherwise. If you are still settling in, <a href="../moving-to-dubai/">our checklist for your first months</a> covers the practical side.</p>`,
      },
      {
        h2: 'From member to friend',
        html: `<p>Joining a group takes ten seconds. Belonging to it takes a little longer, and follows a simple order:</p>
<ol>
<li><strong>Introduce yourself in a few lines.</strong> Where you come from, where you live, what you like doing. Be specific: it gives people something to answer.</li>
<li><strong>Go to something in person within two weeks.</strong> The longer you only read messages, the harder the first visit becomes.</li>
<li><strong>Go three times before you judge.</strong> The first time you are new to everyone; by the third, some people know your name.</li>
<li><strong>Take a small role.</strong> Book the table, bring the ball, welcome the next newcomer. People who help are remembered.</li>
<li><strong>Suggest a small plan.</strong> A coffee with two or three people after the meeting, or the same activity next week.</li>
<li><strong>Move to one-to-one.</strong> A community gives you acquaintances; a friend is someone you also see outside it.</li>
</ol>
<p>The complete method is in <a href="../make-friends/">how to make friends in Dubai</a>.</p>`,
      },
      {
        h2: 'Where IRLY fits in',
        html: `<p>IRLY is an app to meet people who share your interests and do things together in real life. It is organised around communities: you join the ones that match your interests, take part in their activities or create your own, and talk in the group chat. IRLY Girl is a space reserved for women, and IRLY Network is the part for professional meetings between entrepreneurs, freelancers and professionals. The app starts in Dubai and covers the other emirates, in English and French. It is free, it is not a dating app, and it works today in the browser as a web app; iOS and Android apps are coming soon. It is one option among the kinds of communities described above.</p>`,
      },
    ],
    faq: [
      { q: 'What expat communities are there in Dubai?', a: 'There are communities by language or country, by interest such as sport or books, by profession, by neighbourhood, for parents and for women. Most people belong to two or three at the same time.' },
      { q: 'How do I find an expat community in Dubai?', a: 'Ask colleagues and neighbours, look for national associations and cultural centres, search for groups around your sport or hobby, and check community apps. Then go to one meeting in person.' },
      { q: 'Should I join a community from my own country?', a: 'It is a good start for practical help and comfort. Add at least one mixed community around an interest so that your circle is wider and more stable.' },
      { q: 'Do expat communities cost money?', a: 'Some are free and some charge a membership or a fee per event. Check the conditions with each community before you join.' },
      { q: 'I joined several groups but I have not made friends. Why?', a: 'Membership alone rarely leads to friendship. Go to the same in-person meeting several times and suggest a small plan with one or two people you met there.' },
    ],
    cta: { title: 'Looking for your community?', body: 'Looking to meet new people in Dubai? Discover IRLY and connect through activities and communities.', label: 'Discover IRLY' },
    related: [
      { label: 'How to meet French people in Dubai', path: 'dubai/meet-french-people/' },
      { label: 'How to make friends in Dubai', path: 'dubai/make-friends/' },
      { label: 'Networking in Dubai: where to meet entrepreneurs', path: 'dubai/networking/' },
      { label: 'Moving to Dubai: a checklist for your first months', path: 'dubai/moving-to-dubai/' },
      { label: 'Apps to make friends in Dubai: how to choose', path: 'dubai/app-to-make-friends/' },
      { label: 'Making friends in Dubai in your 40s and 50s', path: 'blog/make-friends-dubai-40s-50s/' },
    ],
  },
  {
    lang: 'fr',
    pair: 'dubai-expats',
    path: 'fr/dubai/communautes-expatries/',
    cover: 'brunch',
    city: 'Dubaï',
    published: '2026-11-11',
    title: 'Rejoindre une communauté d’expatriés à Dubaï | IRLY',
    description: 'Les types de communautés d’expatriés à Dubaï, par langue, passion, métier ou quartier, pour les parents et les femmes, et comment passer de membre à ami.',
    h1: 'Comment rejoindre une communauté d’expatriés à Dubaï ?',
    lead: 'À Dubaï, il n’y a pas une communauté d’expatriés mais beaucoup, qui se recoupent : par langue ou pays, par centre d’intérêt, par métier, par quartier, pour les parents, pour les femmes. Commence par deux, une où tu te sens chez toi et une construite autour de quelque chose que tu aimes faire, et juge-les à la fréquence de leurs rencontres en vrai. Être membre ne change rien ; venir trois fois, si.',
    sections: [
      {
        h2: 'Pas une communauté, mais beaucoup',
        html: `<p>La plupart des habitants de Dubaï viennent d’ailleurs. « La communauté expatriée » désigne donc presque toute la ville, et l’expression n’aide pas beaucoup quand on cherche des gens. Ce qui existe en pratique, c’est un grand nombre de communautés plus petites, chacune avec sa raison de se retrouver. La bonne question n’est pas « où sont les expatriés ? » mais « quel groupe se réunit régulièrement autour de quelque chose qui compte pour moi ? »</p>`,
      },
      {
        h2: 'Les grands types de communautés',
        html: `<h3>Par langue ou par pays</h3>
<p>Associations nationales, centres culturels, groupes linguistiques et leurs espaces en ligne. Utiles pour les conseils pratiques, pour fêter tes propres fêtes et pour le repos que procure sa langue. Exemple : notre guide pour <a href="../rencontrer-des-francais/">rencontrer des Français à Dubaï</a>.</p>
<h3>Par centre d’intérêt</h3>
<p>Clubs de running, groupes de padel, de randonnée, clubs de lecture, jeux de société, photo, musique. Les nationalités s’y mélangent naturellement, parce que l’activité passe avant le reste. C’est souvent le chemin le plus rapide vers des amis.</p>
<h3>Par métier</h3>
<p>Chambres de commerce, meetups sectoriels, groupes d’entrepreneurs et d’indépendants. Utiles pour le travail, et pour des amitiés avec des gens qui comprennent ton quotidien professionnel. Voir <a href="../networking/">networking à Dubaï</a>.</p>
<h3>Par quartier</h3>
<p>Groupes d’habitants d’un immeuble, d’une résidence ou d’un quartier. Comme les distances sont longues à Dubaï, les amis qui vivent à dix minutes sont ceux que tu vois le plus.</p>
<h3>Les parents</h3>
<p>Communautés d’école, groupes de jeux et rencontres de parents. Les enfants donnent une raison de se voir chaque semaine.</p>
<h3>Les femmes</h3>
<p>Communautés de femmes et activités réservées aux femmes, pour celles qui les préfèrent. Voir <a href="../trouver-des-copines/">comment trouver des copines à Dubaï</a>.</p>`,
      },
      {
        h2: 'Comment choisir',
        html: `<ol>
<li><strong>De quoi as-tu besoin maintenant ?</strong> De réponses pratiques, d’amis, de contacts professionnels ou de partenaires pour ton sport. Chaque communauté a son point fort.</li>
<li><strong>Se voit-elle en vrai, et à quel rythme ?</strong> Un groupe qui ne fait que discuter en ligne t’informera, mais te donnera rarement des amis. Cherche un rendez-vous régulier.</li>
<li><strong>Quelle est sa taille ?</strong> Les très grands groupes servent à s’informer. Les amitiés se forment dans des groupes plus petits, ou dans les petits cercles à l’intérieur d’un grand.</li>
<li><strong>Qui l’anime ?</strong> Un organisateur identifié, des règles claires et un historique de rencontres sont de bons signes.</li>
<li><strong>Combien ça coûte ?</strong> Certaines communautés sont gratuites, d’autres demandent une adhésion ou une participation par événement. Vérifie avant de t’engager, et méfie-toi des groupes dont l’activité principale est de vendre à leurs membres.</li>
</ol>
<p>Tu n’as pas à choisir une fois pour toutes. Essaies-en quelques-unes pendant tes premiers mois, puis garde les deux où tu t’es senti le plus à l’aise.</p>`,
      },
      {
        h2: 'Une communauté « maison », une communauté mélangée',
        html: `<p>Une communauté de gens de ton pays ou de ta langue réconforte vite, et il n’y a rien de mal à commencer par là. Seule, elle peut pourtant devenir une bulle, et elle rétrécit à chaque famille qui repart.</p>
<p>L’équilibre qui marche pour la plupart des gens : une communauté « maison » et une communauté mélangée, construite autour d’un centre d’intérêt. La première apporte la familiarité ; la seconde, la variété et des amis que tu n’aurais jamais croisés autrement. Si tu es encore en pleine installation, <a href="../s-installer/">notre checklist des premiers mois</a> couvre le côté pratique.</p>`,
      },
      {
        h2: 'De membre à ami',
        html: `<p>Rejoindre un groupe prend dix secondes. En faire partie demande un peu plus de temps, et suit un ordre simple :</p>
<ol>
<li><strong>Présente-toi en quelques lignes.</strong> D’où tu viens, où tu habites, ce que tu aimes faire. Sois précis : ça donne aux autres de quoi répondre.</li>
<li><strong>Va à une rencontre en vrai dans les deux semaines.</strong> Plus tu te contentes de lire les messages, plus la première visite devient difficile.</li>
<li><strong>Viens trois fois avant de juger.</strong> La première fois, tu es nouveau pour tout le monde ; à la troisième, certains connaissent ton prénom.</li>
<li><strong>Prends un petit rôle.</strong> Réserver la table, apporter le ballon, accueillir le prochain nouveau. On se souvient de ceux qui aident.</li>
<li><strong>Propose un petit plan.</strong> Un café à deux ou trois après la rencontre, ou la même activité la semaine suivante.</li>
<li><strong>Passe au tête-à-tête.</strong> Une communauté te donne des connaissances ; un ami, c’est quelqu’un que tu vois aussi en dehors.</li>
</ol>
<p>La méthode complète est dans <a href="../se-faire-des-amis/">comment se faire des amis à Dubaï</a>.</p>`,
      },
      {
        h2: 'Et IRLY dans tout ça ?',
        html: `<p>IRLY est une application pour rencontrer des personnes qui partagent tes centres d’intérêt et faire des choses ensemble, en vrai. Elle est organisée autour de communautés : tu rejoins celles qui correspondent à tes centres d’intérêt, tu participes à leurs activités ou tu crées la tienne, et tu discutes dans le chat du groupe. IRLY Girl est un espace réservé aux femmes, et IRLY Network est la partie consacrée aux rencontres professionnelles entre entrepreneurs, indépendants et professionnels. L’application commence à Dubaï et couvre les autres émirats, en français et en anglais. Elle est gratuite, ce n’est pas une application de rencontres amoureuses, et elle fonctionne dès aujourd’hui dans le navigateur ; les applications iOS et Android arrivent bientôt. C’est une option parmi les types de communautés décrits plus haut.</p>`,
      },
    ],
    faq: [
      { q: 'Quelles communautés d’expatriés existe-t-il à Dubaï ?', a: 'Il existe des communautés par langue ou pays, par centre d’intérêt comme le sport ou la lecture, par métier, par quartier, pour les parents et pour les femmes. La plupart des gens appartiennent à deux ou trois à la fois.' },
      { q: 'Comment trouver une communauté d’expatriés à Dubaï ?', a: 'Demande à tes collègues et à tes voisins, cherche les associations nationales et les centres culturels, les groupes autour de ton sport ou de ta passion, et regarde les applications de communautés. Puis va à une rencontre en vrai.' },
      { q: 'Faut-il rejoindre une communauté de son propre pays ?', a: 'C’est un bon début pour l’aide pratique et le réconfort. Ajoute au moins une communauté mélangée autour d’un centre d’intérêt, pour un cercle plus large et plus stable.' },
      { q: 'Les communautés d’expatriés sont-elles payantes ?', a: 'Certaines sont gratuites, d’autres demandent une adhésion ou une participation par événement. Vérifie les conditions auprès de chaque communauté avant d’adhérer.' },
      { q: 'J’ai rejoint plusieurs groupes sans me faire d’amis : pourquoi ?', a: 'Être membre mène rarement, à lui seul, à une amitié. Va plusieurs fois à la même rencontre en vrai et propose un petit plan à une ou deux personnes rencontrées sur place.' },
    ],
    cta: { title: 'Tu cherches ta communauté ?', body: 'Envie de rencontrer de nouvelles personnes à Dubaï ? Découvrez IRLY et rejoignez des communautés autour de vos centres d’intérêt.', label: 'Découvrir IRLY' },
    related: [
      { label: 'Comment rencontrer des Français à Dubaï', path: 'fr/dubai/rencontrer-des-francais/' },
      { label: 'Se faire des amis à Dubaï', path: 'fr/dubai/se-faire-des-amis/' },
      { label: 'Networking à Dubaï : où rencontrer des entrepreneurs', path: 'fr/dubai/networking/' },
      { label: 'S’installer à Dubaï : la checklist des premiers mois', path: 'fr/dubai/s-installer/' },
      { label: 'Quelle application pour se faire des amis à Dubaï ?', path: 'fr/dubai/application-pour-se-faire-des-amis/' },
      { label: 'Se faire des amis à Dubaï après 40 ans', path: 'fr/blog/se-faire-des-amis-dubai-40-50-ans/' },
    ],
  },
  {
    lang: 'en',
    pair: 'dubai-free',
    path: 'dubai/free-social-activities/',
    cover: 'dubaiMarina',
    city: 'Dubai',
    published: '2026-11-11',
    title: 'Free Social Activities in Dubai to Meet People | IRLY',
    description: 'Free ways to meet people in Dubai: public beaches and their tracks, community run clubs, walks, volunteering, language exchanges and free meetups.',
    h1: 'Free social activities in Dubai to meet people',
    lead: 'You can meet people in Dubai without spending money: public beaches and their running tracks, community run clubs, walking groups, volunteering, language exchanges and free community meetups cost nothing to join. The large public parks charge only a few dirhams. What makes these activities social is not the price but the habit: the same one, every week, with the same people.',
    sections: [
      {
        h2: 'What “free” means here',
        html: `<p>Dubai has a reputation for being expensive, and much of its social life does happen in paid venues. But the things that make friendships, time together and a reason to come back, do not need a budget.</p>
<p>On this page, “free” means that taking part costs nothing. You may still pay for getting there, for parking or for the coffee afterwards, and a few places charge a small entry fee, which we point out. Conditions change, so check with the venue or the organiser before you go.</p>`,
      },
      {
        h2: 'Public beaches and their tracks',
        html: `<p>Dubai’s public beaches are free to enter and are among the most sociable places in the city in the cooler hours.</p>
<ul>
<li><strong>Running and walking.</strong> Kite Beach has a running track along the sand, used from early morning by runners and walkers of every level. It is a natural meeting point for groups.</li>
<li><strong>Beach volleyball and games.</strong> Some public beaches have volleyball nets, and informal games form in the cooler hours. Asking “Do you need one more?” is all it takes.</li>
<li><strong>Swimming and sunset.</strong> A regular swim or a sunset walk with two or three people is an easy plan to suggest to someone you have just met.</li>
<li><strong>Cycling.</strong> The Al Qudra cycle track, in the desert outside the city, is a public track that is free to use. You need your own bike, or to pay for a rental, and a way to get there.</li>
</ul>
<p>In summer, go at sunrise or after dark, and take plenty of water.</p>`,
      },
      {
        h2: 'Parks: a few dirhams',
        html: `<p>Parks are where groups meet for picnics, outdoor workouts, yoga, children’s playdates and simple walks. Large municipal parks such as Zabeel Park and Mushrif Park charge an entry fee of a few dirhams per person; check the current amount before you go.</p>
<p>A picnic is one of the cheapest ways to host: everyone brings one thing, nobody has to book, and the group can grow without anyone paying more. Suggest it for a Saturday or Sunday morning in the cooler months.</p>`,
      },
      {
        h2: 'Community run clubs and walking groups',
        html: `<p>Many community run clubs are free to join. They meet at a fixed time, welcome several paces and usually end with a coffee, which is optional. Walking groups work the same way and suit anyone who does not run.</p>
<p>Each year, the Dubai Fitness Challenge also brings free sessions across the city for a month, and its Dubai Run is free with registration. Our guide to <a href="../running-clubs/">social running clubs in Dubai</a> explains how a first session goes and what to bring.</p>`,
      },
      {
        h2: 'Volunteering, language exchanges and free meetups',
        html: `<ul>
<li><strong>Volunteering.</strong> You work next to the same people for a few hours, which makes conversation easy. The UAE has a national volunteering platform, volunteers.ae, where organisations list opportunities; charities and community groups also look for regular helpers.</li>
<li><strong>Language exchanges.</strong> You practise a language with someone who wants to practise yours. Groups usually meet in a café, where you only pay for your own drink.</li>
<li><strong>Free community meetups.</strong> Book clubs, board game evenings, talks, newcomer coffees, professional meetups. Many are free; read the announcement, because some ask for a contribution or a minimum order.</li>
<li><strong>Cultural events.</strong> Exhibition openings, talks and festivals are often open to all, and give you an easy topic of conversation.</li>
</ul>
<p>For more formats, paid and free, see our <a href="../group-activities/">15 group activities to meet people in Dubai</a>.</p>`,
      },
      {
        h2: 'Start your own free plan',
        html: `<p>If you cannot find a free group near you, start one. It costs nothing and it is the surest way to see the same people again.</p>
<ol>
<li><strong>Choose something simple.</strong> A beach walk, a run, a picnic, a game of volleyball.</li>
<li><strong>Fix a day, a time and a public place,</strong> and keep them the same every week.</li>
<li><strong>Invite the people you already know a little:</strong> a colleague, a neighbour, someone from a class.</li>
<li><strong>Say clearly that it is free</strong> and what to bring.</li>
<li><strong>Carry on even with two people.</strong> Regularity makes a group grow.</li>
</ol>
<p>Our article on <a href="../../blog/start-small-group-weekly-walk-book-club/">how to start a small group yourself</a> goes through it step by step, and <a href="../going-out-alone/">going out alone in Dubai</a> helps if the first visit to an existing group is what holds you back.</p>`,
      },
      {
        h2: 'Where IRLY fits in',
        html: `<p>IRLY is an app to meet people who share your interests and do things together in real life: communities, activities you can join or create, and group chats. The app itself is free. You can use it to propose your own free plan, such as a beach walk or a run, and to see what other members suggest. An activity may involve its own costs, a court or a meal for example, so read the description. IRLY works today in the browser as a web app; iOS and Android apps are coming soon. It is one option among others.</p>`,
      },
    ],
    faq: [
      { q: 'What can I do for free in Dubai to meet people?', a: 'Run or walk with a community group, join games on a public beach, volunteer, go to a language exchange or attend a free community meetup. Choose one and go every week.' },
      { q: 'Are public beaches in Dubai free?', a: 'Yes, public beaches such as Kite Beach are free to enter. Parking, food and equipment hire are extra.' },
      { q: 'Are parks in Dubai free?', a: 'The large municipal parks, such as Zabeel Park and Mushrif Park, charge a small entry fee of a few dirhams per person. Check the current fee before you go.' },
      { q: 'Is it possible to make friends in Dubai on a small budget?', a: 'Yes. Friendships come from seeing the same people regularly, and that can happen at a free run, a walk or a volunteering shift as well as in a paid venue.' },
      { q: 'How do I find volunteering opportunities in Dubai?', a: 'Look at the national volunteering platform, volunteers.ae, and ask charities and community groups whether they need regular helpers. A recurring role is better for meeting people than a single day.' },
    ],
    cta: { title: 'Looking for a plan that costs nothing?', body: 'Looking to meet new people in Dubai? Discover IRLY and connect through activities and communities.', label: 'Discover IRLY' },
    related: [
      { label: 'How to join a social running club in Dubai', path: 'dubai/running-clubs/' },
      { label: 'Activities in Dubai to meet people, by interest', path: 'dubai/activities/' },
      { label: '15 group activities to meet people in Dubai', path: 'dubai/group-activities/' },
      { label: 'How to start a small group yourself', path: 'blog/start-small-group-weekly-walk-book-club/' },
      { label: 'How to make friends in Dubai', path: 'dubai/make-friends/' },
      { label: 'Lonely on weekends in Dubai', path: 'blog/lonely-weekends-dubai/' },
    ],
  },
  {
    lang: 'fr',
    pair: 'dubai-free',
    path: 'fr/dubai/activites-gratuites/',
    cover: 'dubaiMarina',
    city: 'Dubaï',
    published: '2026-11-11',
    title: 'Activités gratuites à Dubaï pour rencontrer du monde | IRLY',
    description: 'Rencontrer du monde gratuitement à Dubaï : plages publiques et leurs pistes, clubs de running, balades, bénévolat, échanges linguistiques, meetups gratuits.',
    h1: 'Activités gratuites à Dubaï pour rencontrer du monde',
    lead: 'On peut rencontrer du monde à Dubaï sans dépenser : les plages publiques et leurs pistes de course, les clubs de running communautaires, les groupes de marche, le bénévolat, les échanges linguistiques et les meetups gratuits ne coûtent rien. Les grands parcs publics ne demandent que quelques dirhams. Ce qui rend ces activités sociales, ce n’est pas le prix mais l’habitude : la même, chaque semaine, avec les mêmes personnes.',
    sections: [
      {
        h2: 'Ce que « gratuit » veut dire ici',
        html: `<p>Dubaï a la réputation d’être chère, et une bonne partie de sa vie sociale se passe en effet dans des lieux payants. Mais ce qui crée les amitiés, du temps passé ensemble et une raison de revenir, ne demande pas de budget.</p>
<p>Sur cette page, « gratuit » veut dire que participer ne coûte rien. Tu peux quand même avoir à payer le trajet, le parking ou le café d’après, et quelques lieux demandent une petite entrée, que nous signalons. Les conditions changent : vérifie auprès du lieu ou de l’organisateur avant d’y aller.</p>`,
      },
      {
        h2: 'Les plages publiques et leurs pistes',
        html: `<p>Les plages publiques de Dubaï sont en accès libre et comptent, aux heures fraîches, parmi les endroits les plus conviviaux de la ville.</p>
<ul>
<li><strong>Courir et marcher.</strong> Kite Beach a une piste de course le long du sable, fréquentée dès le petit matin par des coureurs et des marcheurs de tous niveaux. C’est un point de rendez-vous naturel pour les groupes.</li>
<li><strong>Beach-volley et jeux.</strong> Certaines plages publiques ont des filets de volley, et des parties informelles s’y montent aux heures fraîches. Demander « Il vous manque quelqu’un ? » suffit.</li>
<li><strong>Baignade et coucher de soleil.</strong> Une baignade régulière ou une marche au coucher du soleil à deux ou trois, c’est un plan facile à proposer à quelqu’un que tu viens de rencontrer.</li>
<li><strong>Vélo.</strong> La piste cyclable d’Al Qudra, dans le désert à l’extérieur de la ville, est une piste publique en accès gratuit. Il te faut ton vélo, ou payer une location, et un moyen de t’y rendre.</li>
</ul>
<p>En été, vas-y au lever du soleil ou après la tombée de la nuit, avec beaucoup d’eau.</p>`,
      },
      {
        h2: 'Les parcs : quelques dirhams',
        html: `<p>Les parcs sont les lieux où les groupes se retrouvent pour des pique-niques, du sport en plein air, du yoga, des sorties avec les enfants ou de simples balades. Les grands parcs municipaux comme Zabeel Park et Mushrif Park demandent une entrée de quelques dirhams par personne ; vérifie le montant en vigueur avant d’y aller.</p>
<p>Le pique-nique est l’une des façons les moins chères de recevoir : chacun apporte une chose, personne n’a à réserver, et le groupe peut grandir sans que quiconque paie plus. Propose-le un samedi ou un dimanche matin pendant les mois frais.</p>`,
      },
      {
        h2: 'Clubs de running communautaires et groupes de marche',
        html: `<p>Beaucoup de clubs de running communautaires sont gratuits. Ils se retrouvent à heure fixe, accueillent plusieurs allures et finissent en général par un café, qui reste facultatif. Les groupes de marche fonctionnent de la même façon et conviennent à ceux qui ne courent pas.</p>
<p>Chaque année, le Dubai Fitness Challenge propose aussi, pendant un mois, des séances gratuites dans toute la ville, et sa Dubai Run est gratuite sur inscription. Notre guide des <a href="../clubs-de-running/">clubs de running à Dubaï</a> explique comment se passe une première séance et quoi apporter.</p>`,
      },
      {
        h2: 'Bénévolat, échanges linguistiques et meetups gratuits',
        html: `<ul>
<li><strong>Le bénévolat.</strong> Tu passes quelques heures à côté des mêmes personnes, ce qui facilite la conversation. Les Émirats ont une plateforme nationale de bénévolat, volunteers.ae, où les organisations publient leurs missions ; les associations caritatives et les groupes locaux cherchent aussi des bénévoles réguliers.</li>
<li><strong>Les échanges linguistiques.</strong> Tu pratiques une langue avec quelqu’un qui veut pratiquer la tienne. Les groupes se retrouvent le plus souvent dans un café, où tu ne paies que ta consommation.</li>
<li><strong>Les meetups gratuits.</strong> Clubs de lecture, soirées jeux de société, conférences, cafés d’accueil, rencontres professionnelles. Beaucoup sont gratuits ; lis l’annonce, car certains demandent une participation ou une consommation minimum.</li>
<li><strong>Les événements culturels.</strong> Vernissages, conférences et festivals sont souvent ouverts à tous, et offrent un sujet de conversation tout trouvé.</li>
</ul>
<p>Pour d’autres formats, payants ou gratuits, lis nos <a href="../activites-de-groupe/">15 activités de groupe pour rencontrer du monde à Dubaï</a>.</p>`,
      },
      {
        h2: 'Lance ton propre plan gratuit',
        html: `<p>Si tu ne trouves pas de groupe gratuit près de chez toi, lance-le. Ça ne coûte rien et c’est le moyen le plus sûr de revoir les mêmes personnes.</p>
<ol>
<li><strong>Choisis quelque chose de simple.</strong> Une marche sur la plage, un footing, un pique-nique, une partie de volley.</li>
<li><strong>Fixe un jour, une heure et un lieu public,</strong> et garde les mêmes chaque semaine.</li>
<li><strong>Invite les personnes que tu connais déjà un peu :</strong> un collègue, une voisine, quelqu’un d’un cours.</li>
<li><strong>Précise que c’est gratuit</strong> et ce qu’il faut apporter.</li>
<li><strong>Continue même à deux.</strong> C’est la régularité qui fait grandir un groupe.</li>
</ol>
<p>Notre article pour <a href="../../blog/creer-un-petit-groupe-balade-club-lecture/">lancer ton propre petit groupe</a> détaille chaque étape, et <a href="../sortir-seul/">sortir seul à Dubaï</a> t’aide si c’est la première visite dans un groupe existant qui te retient.</p>`,
      },
      {
        h2: 'Et IRLY dans tout ça ?',
        html: `<p>IRLY est une application pour rencontrer des personnes qui partagent tes centres d’intérêt et faire des choses ensemble, en vrai : des communautés, des activités à rejoindre ou à créer, et des discussions de groupe. L’application elle-même est gratuite. Tu peux t’en servir pour proposer ton propre plan gratuit, une marche sur la plage ou un footing par exemple, et pour voir ce que les autres membres proposent. Une activité peut avoir ses propres frais, un terrain ou un repas par exemple : lis sa description. IRLY fonctionne dès aujourd’hui dans le navigateur ; les applications iOS et Android arrivent bientôt. C’est une option parmi d’autres.</p>`,
      },
    ],
    faq: [
      { q: 'Que faire gratuitement à Dubaï pour rencontrer du monde ?', a: 'Courir ou marcher avec un groupe communautaire, rejoindre une partie sur une plage publique, faire du bénévolat, aller à un échange linguistique ou à un meetup gratuit. Choisis-en une et vas-y chaque semaine.' },
      { q: 'Les plages publiques de Dubaï sont-elles gratuites ?', a: 'Oui, les plages publiques comme Kite Beach sont en accès libre. Le parking, la restauration et la location de matériel sont en plus.' },
      { q: 'Les parcs de Dubaï sont-ils gratuits ?', a: 'Les grands parcs municipaux, comme Zabeel Park et Mushrif Park, demandent une petite entrée de quelques dirhams par personne. Vérifie le tarif en vigueur avant d’y aller.' },
      { q: 'Peut-on se faire des amis à Dubaï avec un petit budget ?', a: 'Oui. Les amitiés viennent du fait de revoir régulièrement les mêmes personnes, et ça arrive aussi bien lors d’un footing gratuit, d’une balade ou d’une mission de bénévolat que dans un lieu payant.' },
      { q: 'Comment trouver du bénévolat à Dubaï ?', a: 'Consulte la plateforme nationale de bénévolat, volunteers.ae, et demande aux associations et aux groupes locaux s’ils cherchent des bénévoles réguliers. Un rôle récurrent aide plus à rencontrer du monde qu’une seule journée.' },
    ],
    cta: { title: 'Tu cherches un plan qui ne coûte rien ?', body: 'Envie de rencontrer de nouvelles personnes à Dubaï ? Découvrez IRLY et rejoignez des communautés autour de vos centres d’intérêt.', label: 'Découvrir IRLY' },
    related: [
      { label: 'Comment rejoindre un club de running à Dubaï', path: 'fr/dubai/clubs-de-running/' },
      { label: 'Activités à Dubaï pour rencontrer du monde, par centre d’intérêt', path: 'fr/dubai/activites/' },
      { label: '15 activités de groupe pour rencontrer du monde à Dubaï', path: 'fr/dubai/activites-de-groupe/' },
      { label: 'Lancer ton propre petit groupe', path: 'fr/blog/creer-un-petit-groupe-balade-club-lecture/' },
      { label: 'Se faire des amis à Dubaï', path: 'fr/dubai/se-faire-des-amis/' },
      { label: 'Seul le week-end à Dubaï', path: 'fr/blog/week-end-seul-dubai/' },
    ],
  },
  {
    lang: 'en',
    pair: 'dubai-activities',
    path: 'dubai/activities/',
    cover: 'volleyball',
    city: 'Dubai',
    published: '2026-11-11',
    title: 'Dubai Social Activities by Interest: Find Your Group | IRLY',
    description: 'Social activities in Dubai to meet people, by interest: running, fitness, padel, brunch, beach days, nights out, networking and trips, and how to find a group.',
    h1: 'Activities in Dubai to meet people, by interest',
    lead: 'The best activity for meeting people in Dubai is the one you would do anyway, done with a group that meets regularly. This page sorts the options by interest: running, fitness, padel, restaurants and brunch, beach days, nights out, networking and trips. For each one you will find who it suits, how a first session goes and how to find a group.',
    sections: [
      {
        h2: 'Sport: running, fitness and padel',
        html: `<h3>Running</h3>
<p><strong>Who it suits:</strong> anyone who can jog and chat, early risers, people who like a fixed weekly slot. <strong>A first session:</strong> a meeting point, a short briefing, groups by pace, then coffee. <strong>Finding a group:</strong> look for community run clubs near you and tell the organiser it is your first time. Details in <a href="../running-clubs/">how to join a social running club in Dubai</a>.</p>
<h3>Fitness</h3>
<p><strong>Who it suits:</strong> people who prefer a coach and a set programme: bootcamps, yoga, pilates, functional training, outdoor sessions in the cooler months. <strong>A first session:</strong> arrive ten minutes early, tell the coach your level, and expect to work in pairs or small teams, which does the introductions for you. <strong>Finding a group:</strong> choose a class at the same time every week rather than changing slots; ask the studio whether it has a members’ group or community sessions.</p>
<h3>Padel</h3>
<p><strong>Who it suits:</strong> almost everyone. It is easy to pick up and played in fours, so each game introduces you to three people. <strong>A first session:</strong> a beginner lesson or a mixed-level social game; rackets can usually be rented at the club. The court is paid for and shared between the players. <strong>Finding a group:</strong> clubs and booking apps list open games looking for players, and padel communities organise games by level.</p>`,
      },
      {
        h2: 'Food: restaurants and brunch',
        html: `<p><strong>Who it suits:</strong> people who like to talk more than to move, and anyone who finds sport a poor setting for conversation. Weekend brunch is a habit in Dubai, and dinner groups and supper clubs seat strangers at the same table.</p>
<p><strong>A first session:</strong> you join a table of six to ten people, booked by an organiser. Everyone usually pays for their own meal, so check the price range and the way the bill is split before you say yes. Arrive on time: the seats next to you decide your evening.</p>
<p><strong>Finding a group:</strong> look for communities built around food, a cuisine or a neighbourhood, or propose a table yourself: a restaurant you want to try, a date, six places.</p>`,
      },
      {
        h2: 'Beach clubs and beach days',
        html: `<p><strong>Who it suits:</strong> people who want a relaxed day rather than a sport, and newcomers who want to enjoy the sea with company.</p>
<p><strong>A first session:</strong> there are two very different formats. A beach club is a paid venue with sunbeds, a pool and music, where you normally book and pay an entry fee or a minimum spend; ask the organiser what is included. A beach day on a public beach is free: someone names a spot and a time, and everyone brings a towel, water and something to share.</p>
<p><strong>Finding a group:</strong> beach days are announced in community groups, mostly at weekends and in the cooler months. Public beach days are also the easiest plan to organise yourself. More ideas in <a href="../free-social-activities/">free social activities in Dubai</a>.</p>`,
      },
      {
        h2: 'Nights out',
        html: `<p><strong>Who it suits:</strong> people with busy days and free evenings, and those who enjoy music, games or a show more than conversation over coffee.</p>
<p><strong>A first session:</strong> the nights that work for meeting people have a structure: a quiz, board games, karaoke, live music, comedy, a dance class followed by a social. You have something to do from the first minute. A night in a loud venue with a group of strangers is harder; keep those for when you know a few people.</p>
<p><strong>Finding a group:</strong> look for weekly themed nights rather than one-off parties, go with one person you already know if you can, and plan your way home in advance. If you are going alone, <a href="../going-out-alone/">going out alone in Dubai</a> has simple habits to feel at ease.</p>`,
      },
      {
        h2: 'Networking',
        html: `<p><strong>Who it suits:</strong> entrepreneurs, freelancers, people changing jobs, and anyone new to their industry here. In Dubai, professional circles often become personal ones.</p>
<p><strong>A first session:</strong> a talk or a round of introductions, then open conversation. Prepare one sentence on what you do and one question you want answered. Two good conversations are a better result than twenty business cards.</p>
<p><strong>Finding a group:</strong> business councils, industry meetups, coworking events and founder groups. Choose one that meets every month and go back. Our guide to <a href="../networking/">networking in Dubai</a> goes into detail.</p>`,
      },
      {
        h2: 'Trips and excursions',
        html: `<p><strong>Who it suits:</strong> people who would rather spend a whole day with a small group than an hour with a large one. A day out builds familiarity faster than weeks of short meetings.</p>
<p><strong>A first session:</strong> a hike in the mountains or a desert outing in the cooler months, a day in another emirate, a boat trip. The organiser gives a meeting point, the level required and what to bring; transport is often shared by car. Ask what the costs are and how they are split.</p>
<p><strong>Finding a group:</strong> hiking and outdoor communities, and groups of friends of friends. For anything outdoors, choose organisers with experience of the route, take more water than you think you need, and tell someone where you are going.</p>
<p>Still undecided? Our list of <a href="../group-activities/">15 group activities to meet people in Dubai</a> gives more ideas, and <a href="../make-friends/">how to make friends in Dubai</a> explains how to turn any of them into friendships. If you are new in the city, <a href="../expat-communities/">expat communities in Dubai</a> are often where these activities are announced.</p>`,
      },
      {
        h2: 'Where IRLY fits in',
        html: `<p>IRLY is an app to meet people who share your interests and do things together in real life. It follows the same logic as this page: you choose communities by interest, join an activity or create your own, a run, a padel game or a brunch for example, and talk in the group chat before you meet. IRLY Girl is a space reserved for women, IRLY Network is the part for professional meetings, and IRLY Games lets members play a Werewolf-style party game together in the app. IRLY is free, starts in Dubai and covers the other emirates, in English and French. It works today in the browser as a web app; iOS and Android apps are coming soon. It is one option among others.</p>`,
      },
    ],
    faq: [
      { q: 'What is the best activity to meet people in Dubai?', a: 'The one you enjoy enough to do every week. Activities that repeat with the same group, such as a run club, a padel group or a weekly class, lead to friendships more often than one-off events.' },
      { q: 'I do not like sport. What can I do to meet people?', a: 'Dinner groups, brunches, quiz and board game nights, language exchanges, book clubs, professional meetups and day trips all work without any sport.' },
      { q: 'Can I join these activities alone?', a: 'Yes. Most people come alone the first time. Tell the organiser you are new and arrive a little early so that you can be introduced.' },
      { q: 'How do I find a group for an activity in Dubai?', a: 'Ask the venue or club whether it has social sessions, look for communities around that interest, check booking and community apps, or propose a small plan yourself with a date, a time and a place.' },
      { q: 'Which activities work in summer?', a: 'Indoor ones: fitness classes, indoor padel, climbing, dinners, game nights and professional meetups. Outdoor groups that continue usually meet very early or after dark.' },
      { q: 'How much do group activities cost in Dubai?', a: 'It varies widely. Community runs, walks and public beach days are often free, while courts, classes, meals and beach clubs are paid. Ask the organiser what is included before you join.' },
    ],
    cta: { title: 'Found your interest?', body: 'Looking to meet new people in Dubai? Discover IRLY and connect through activities and communities.', label: 'Discover IRLY' },
    related: [
      { label: '15 group activities to meet people in Dubai', path: 'dubai/group-activities/' },
      { label: 'How to join a social running club in Dubai', path: 'dubai/running-clubs/' },
      { label: 'Free social activities in Dubai to meet people', path: 'dubai/free-social-activities/' },
      { label: 'Networking in Dubai: where to meet entrepreneurs', path: 'dubai/networking/' },
      { label: 'How to make friends in Dubai', path: 'dubai/make-friends/' },
      { label: 'New in Dubai as a couple', path: 'blog/new-dubai-couple-social-life/' },
    ],
  },
  {
    lang: 'fr',
    pair: 'dubai-activities',
    path: 'fr/dubai/activites/',
    cover: 'volleyball',
    city: 'Dubaï',
    published: '2026-11-11',
    title: 'Activités entre expatriés à Dubaï, par centre d’intérêt | IRLY',
    description: 'Activités entre expatriés à Dubaï, par centre d’intérêt : running, fitness, padel, brunch, plage, soirées, networking, excursions, et comment trouver un groupe.',
    h1: 'Activités à Dubaï pour rencontrer du monde, par centre d’intérêt',
    lead: 'La meilleure activité pour rencontrer du monde à Dubaï, c’est celle que tu ferais de toute façon, pratiquée avec un groupe qui se retrouve régulièrement. Cette page classe les possibilités par centre d’intérêt : running, fitness, padel, restaurants et brunch, journées plage, soirées, networking et excursions. Pour chacune : à qui elle convient, comment se passe une première fois et comment trouver un groupe.',
    sections: [
      {
        h2: 'Sport : running, fitness et padel',
        html: `<h3>Running</h3>
<p><strong>Pour qui :</strong> toute personne capable de trottiner en discutant, les lève-tôt, ceux qui aiment un créneau fixe chaque semaine. <strong>Une première séance :</strong> un point de rendez-vous, un court briefing, des groupes par allure, puis un café. <strong>Trouver un groupe :</strong> cherche les clubs de running communautaires près de chez toi et préviens l’organisateur que c’est ta première fois. Les détails sont dans <a href="../clubs-de-running/">comment rejoindre un club de running à Dubaï</a>.</p>
<h3>Fitness</h3>
<p><strong>Pour qui :</strong> ceux qui préfèrent un coach et un programme : bootcamps, yoga, pilates, entraînement fonctionnel, séances en plein air pendant les mois frais. <strong>Une première séance :</strong> arrive dix minutes avant, donne ton niveau au coach, et attends-toi à travailler en binôme ou en petite équipe, ce qui fait les présentations à ta place. <strong>Trouver un groupe :</strong> choisis un cours au même horaire chaque semaine plutôt que de changer de créneau ; demande au studio s’il a un groupe de membres ou des séances communautaires.</p>
<h3>Padel</h3>
<p><strong>Pour qui :</strong> presque tout le monde. Il s’apprend vite et se joue à quatre : chaque partie te présente trois personnes. <strong>Une première séance :</strong> un cours débutant ou une partie conviviale tous niveaux ; les raquettes se louent en général au club. Le terrain est payant et partagé entre les joueurs. <strong>Trouver un groupe :</strong> les clubs et les applications de réservation affichent des parties ouvertes qui cherchent des joueurs, et les communautés de padel organisent des parties par niveau.</p>`,
      },
      {
        h2: 'Table : restaurants et brunch',
        html: `<p><strong>Pour qui :</strong> ceux qui aiment parler plus que bouger, et tous ceux qui trouvent que le sport se prête mal à la conversation. Le brunch du week-end est une habitude à Dubaï, et les groupes de dîner comme les tables d’hôtes installent des inconnus à la même table.</p>
<p><strong>Une première fois :</strong> tu rejoins une table de six à dix personnes, réservée par un organisateur. En général chacun paie son repas : regarde la gamme de prix et la façon de partager l’addition avant de dire oui. Arrive à l’heure : ce sont tes voisins de table qui font ta soirée.</p>
<p><strong>Trouver un groupe :</strong> cherche les communautés construites autour de la cuisine, d’une gastronomie ou d’un quartier, ou propose toi-même une table : un restaurant que tu veux essayer, une date, six places.</p>`,
      },
      {
        h2: 'Beach clubs et journées plage',
        html: `<p><strong>Pour qui :</strong> ceux qui veulent une journée détendue plutôt qu’un sport, et les nouveaux arrivants qui ont envie de profiter de la mer en bonne compagnie.</p>
<p><strong>Une première fois :</strong> il existe deux formats très différents. Un beach club est un lieu payant, avec transats, piscine et musique, où l’on réserve le plus souvent et où l’on paie une entrée ou un minimum de consommation ; demande à l’organisateur ce qui est compris. Une journée sur une plage publique est gratuite : quelqu’un donne un endroit et une heure, et chacun apporte sa serviette, de l’eau et de quoi partager.</p>
<p><strong>Trouver un groupe :</strong> les journées plage s’annoncent dans les groupes communautaires, surtout le week-end et pendant les mois frais. La journée sur une plage publique est aussi le plan le plus simple à organiser toi-même. D’autres idées dans <a href="../activites-gratuites/">activités gratuites à Dubaï</a>.</p>`,
      },
      {
        h2: 'Soirées',
        html: `<p><strong>Pour qui :</strong> ceux dont les journées sont pleines et les soirées libres, et ceux qui préfèrent la musique, le jeu ou un spectacle à une conversation autour d’un café.</p>
<p><strong>Une première fois :</strong> les soirées qui marchent pour rencontrer du monde ont un cadre : un quiz, des jeux de société, un karaoké, un concert, du stand-up, un cours de danse suivi d’une soirée. Tu as quelque chose à faire dès la première minute. Une soirée dans un lieu bruyant avec un groupe d’inconnus est plus difficile ; garde-la pour le moment où tu connaîtras quelques personnes.</p>
<p><strong>Trouver un groupe :</strong> préfère les soirées à thème hebdomadaires aux fêtes ponctuelles, viens si possible avec une personne que tu connais déjà, et prévois ton retour à l’avance. Si tu y vas seul, <a href="../sortir-seul/">sortir seul à Dubaï</a> donne des réflexes simples pour être à l’aise.</p>`,
      },
      {
        h2: 'Networking',
        html: `<p><strong>Pour qui :</strong> entrepreneurs, indépendants, personnes en changement de poste, et tous ceux qui découvrent leur secteur ici. À Dubaï, les cercles professionnels deviennent souvent des cercles personnels.</p>
<p><strong>Une première fois :</strong> une conférence ou un tour de présentations, puis des échanges libres. Prépare une phrase sur ce que tu fais et une question à laquelle tu cherches une réponse. Deux bonnes conversations valent mieux que vingt cartes de visite.</p>
<p><strong>Trouver un groupe :</strong> chambres de commerce, meetups sectoriels, événements de coworking, groupes d’entrepreneurs. Choisis-en un qui se réunit chaque mois et reviens. Notre guide du <a href="../networking/">networking à Dubaï</a> entre dans le détail.</p>`,
      },
      {
        h2: 'Excursions et sorties à la journée',
        html: `<p><strong>Pour qui :</strong> ceux qui préfèrent passer une journée entière avec un petit groupe plutôt qu’une heure avec un grand. Une journée dehors crée plus de familiarité que des semaines de rencontres courtes.</p>
<p><strong>Une première fois :</strong> une randonnée en montagne ou une sortie dans le désert pendant les mois frais, une journée dans un autre émirat, une sortie en bateau. L’organisateur indique le point de rendez-vous, le niveau requis et ce qu’il faut apporter ; le trajet se fait souvent en covoiturage. Demande quels sont les frais et comment ils sont partagés.</p>
<p><strong>Trouver un groupe :</strong> les communautés de randonnée et d’activités de plein air, et les groupes d’amis d’amis. Pour tout ce qui se passe en pleine nature, choisis des organisateurs qui connaissent le parcours, emporte plus d’eau que nécessaire et préviens quelqu’un de l’endroit où tu vas.</p>
<p>Tu hésites encore ? Notre liste de <a href="../activites-de-groupe/">15 activités de groupe pour rencontrer du monde à Dubaï</a> donne d’autres idées, et <a href="../se-faire-des-amis/">comment se faire des amis à Dubaï</a> explique comment transformer n’importe laquelle en amitiés. Si tu viens d’arriver, les <a href="../communautes-expatries/">communautés d’expatriés à Dubaï</a> sont souvent l’endroit où s’annoncent ces activités entre expatriés.</p>`,
      },
      {
        h2: 'Et IRLY dans tout ça ?',
        html: `<p>IRLY est une application pour rencontrer des personnes qui partagent tes centres d’intérêt et faire des choses ensemble, en vrai. Elle suit la même logique que cette page : tu choisis des communautés par centre d’intérêt, tu rejoins une activité ou tu crées la tienne, un footing, une partie de padel ou un brunch par exemple, et tu discutes dans le chat du groupe avant de vous voir. IRLY Girl est un espace réservé aux femmes, IRLY Network est la partie consacrée aux rencontres professionnelles, et IRLY Games permet aux membres de jouer ensemble, dans l’application, à un jeu d’ambiance de type Loup-Garou. IRLY est gratuite, commence à Dubaï et couvre les autres émirats, en français et en anglais. Elle fonctionne dès aujourd’hui dans le navigateur ; les applications iOS et Android arrivent bientôt. C’est une option parmi d’autres.</p>`,
      },
    ],
    faq: [
      { q: 'Quelle est la meilleure activité pour rencontrer du monde à Dubaï ?', a: 'Celle que tu aimes assez pour la faire chaque semaine. Les activités qui reviennent avec le même groupe, comme un club de running, un groupe de padel ou un cours hebdomadaire, mènent plus souvent à des amitiés que les événements ponctuels.' },
      { q: 'Je n’aime pas le sport : que faire pour rencontrer du monde ?', a: 'Groupes de dîner, brunchs, soirées quiz ou jeux de société, échanges linguistiques, clubs de lecture, rencontres professionnelles et excursions à la journée fonctionnent tous sans sport.' },
      { q: 'Peut-on rejoindre ces activités seul ?', a: 'Oui. La plupart des gens viennent seuls la première fois. Préviens l’organisateur que tu es nouveau et arrive un peu en avance pour qu’on te présente.' },
      { q: 'Comment trouver un groupe pour une activité à Dubaï ?', a: 'Demande au lieu ou au club s’il propose des séances conviviales, cherche les communautés autour de ce centre d’intérêt, regarde les applications de réservation et de communautés, ou propose toi-même un petit plan avec une date, une heure et un lieu.' },
      { q: 'Quelles activités fonctionnent en été ?', a: 'Celles en intérieur : cours de fitness, padel couvert, escalade, dîners, soirées jeux et rencontres professionnelles. Les groupes de plein air qui continuent se retrouvent en général très tôt ou après la tombée de la nuit.' },
      { q: 'Combien coûtent les activités de groupe à Dubaï ?', a: 'C’est très variable. Les footings communautaires, les balades et les journées sur une plage publique sont souvent gratuits, alors que terrains, cours, repas et beach clubs sont payants. Demande à l’organisateur ce qui est compris avant de t’inscrire.' },
    ],
    cta: { title: 'Tu as trouvé ton centre d’intérêt ?', body: 'Envie de rencontrer de nouvelles personnes à Dubaï ? Découvrez IRLY et rejoignez des communautés autour de vos centres d’intérêt.', label: 'Découvrir IRLY' },
    related: [
      { label: '15 activités de groupe pour rencontrer du monde à Dubaï', path: 'fr/dubai/activites-de-groupe/' },
      { label: 'Comment rejoindre un club de running à Dubaï', path: 'fr/dubai/clubs-de-running/' },
      { label: 'Activités gratuites à Dubaï pour rencontrer du monde', path: 'fr/dubai/activites-gratuites/' },
      { label: 'Networking à Dubaï : où rencontrer des entrepreneurs', path: 'fr/dubai/networking/' },
      { label: 'Se faire des amis à Dubaï', path: 'fr/dubai/se-faire-des-amis/' },
      { label: 'En couple à Dubaï : une vie sociale à deux', path: 'fr/blog/arriver-dubai-en-couple-vie-sociale/' },
    ],
  },
];
