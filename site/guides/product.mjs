/**
 * Product pages: what IRLY is and how it works, in English and French (same
 * `pair`). Same fields as the search-intent pages (site/guides/strategic.mjs).
 *
 * Rules: only what the app really does today, traced in the code (screens in
 * src/app, features in src/features, French labels from src/i18n/fr.ts).
 * Button and screen names are the app's own. No user numbers, ratings,
 * testimonials, statistics or prices, no competitor named, nothing about a
 * feature that is not open to members yet.
 */
export const PRODUCT = [
  {
    lang: 'en',
    pair: 'irly-what',
    path: 'irly/what-is-irly/',
    cover: 'brunch',
    city: 'IRLY',
    published: '2026-11-12',
    title: 'What Is IRLY? The App to Make Friends in Dubai | IRLY',
    description: 'IRLY is a free app to make friends in real life in Dubai and the UAE: communities, activities and group chats. What it is, who it is for, what it is not.',
    h1: 'What is IRLY?',
    lead: 'IRLY is a free app for making friends in real life: you join communities built around your interests, join or organise activities, and talk in a group chat before you meet. It starts in Dubai and covers the other emirates of the UAE, in English and French. It is not a dating app, and it works today in the browser, with iOS and Android apps coming soon.',
    sections: [
      {
        h2: 'IRLY in a few lines',
        html: `<p>The full name is “IRLY — Make Friends IRL”. IRL stands for “in real life”, and that is the whole idea: the app is the way to a meeting, not a place to stay. You use it to find people who like what you like, agree on a time and a place, and turn up.</p>
<p>Everything in IRLY is organised around three things: <strong>communities</strong> (groups of people who meet again), <strong>activities</strong> (a plan with a date, a place and a number of spots) and <strong>chats</strong> (one for each community, one for each activity, and private messages).</p>`,
      },
      {
        h2: 'Who it is for',
        html: `<ul>
<li><strong>Newcomers.</strong> You have just moved to Dubai or another emirate and you know nobody yet.</li>
<li><strong>People whose circle has changed.</strong> Friends move away often in the UAE; a circle sometimes has to be rebuilt.</li>
<li><strong>People looking for someone to do things with.</strong> A padel partner, a group for a walk, a table for brunch.</li>
<li><strong>Women who prefer a women-only setting.</strong> IRLY Girl is a space reserved for women.</li>
<li><strong>Professionals.</strong> IRLY Network is the part of the app for professional meetings.</li>
</ul>
<p>IRLY is for adults: the app asks your age when you sign up and is for people 18 and over.</p>`,
      },
      {
        h2: 'What you can do on IRLY',
        html: `<ul>
<li><strong>Join communities.</strong> IRLY’s own communities and the ones members start, by theme. Joining a community puts you in its chat. See <a href="../join-a-community/">how to join a community on IRLY</a>.</li>
<li><strong>Join an activity, or create one.</strong> Sport, a meal, a walk, a trip, a meetup: each activity has its page and its own chat. See <a href="../create-an-activity/">how to organise an activity on IRLY</a>.</li>
<li><strong>Talk before you meet.</strong> Messages gathers your private chats, your community chats and your activity chats in one place.</li>
<li><strong>See what is happening now.</strong> The IRL tab shows short posts, a photo or a few words, from people around you; they disappear after 24 hours.</li>
<li><strong>Look around.</strong> Discover lists people, activities, places and events, and a map shows what is near you.</li>
<li><strong>Enter IRLY Girl,</strong> if you are a woman: the same app in a space where every member is a woman. More on the <a href="/girl">IRLY Girl page</a>.</li>
<li><strong>Use IRLY Network</strong> for work: a professional profile, other professionals to meet, professional meetups.</li>
<li><strong>Play.</strong> IRLY Games has Loup-Garou, a Werewolf-style social game you can play online with other members or against AI players, to break the ice.</li>
</ul>
<p>The step-by-step path, from the first screen to a first meeting, is in <a href="../how-it-works/">how IRLY works</a>.</p>`,
      },
      {
        h2: 'What IRLY is not',
        html: `<ul>
<li><strong>Not a dating app.</strong> People come to do things together, mostly in groups. If you are looking for a partner, a dating app is the right tool.</li>
<li><strong>Not a substitute for turning up.</strong> The app helps you find the plan and the people. The friendship is made in person, by coming back to the same group.</li>
<li><strong>Not everywhere.</strong> IRLY is centred on Dubai and the UAE.</li>
<li><strong>Not a promise.</strong> No app can guarantee friends. IRLY is one option among others, and our guide to <a href="../../dubai/app-to-make-friends/">choosing an app to make friends in Dubai</a> describes the other types fairly.</li>
</ul>`,
      },
      {
        h2: 'Where it works, and on which device',
        html: `<p>IRLY starts in Dubai and covers the other emirates of the United Arab Emirates. When you sign up, you choose your emirate.</p>
<p>Today IRLY works in the browser, as a web app, at getirly.com/app: on a phone, a tablet or a computer, with nothing to install. iOS and Android apps are coming soon.</p>`,
      },
      {
        h2: 'Price and languages',
        html: `<p>IRLY is free. An activity may have a cost of its own, a court or a ticket for example: the organiser marks it “Free” or “Paid”, and the activity page shows it before you join.</p>
<p>The app is written in English and in French. You choose the language in Settings, and you can meet people in either.</p>`,
      },
      {
        h2: 'Who publishes IRLY',
        html: `<p>IRLY is published by ALF FASHION BRAND FZCO, a company based in Dubai, United Arab Emirates. You can write to the team at getirly@gmail.com.</p>
<p>Every community, activity, message and profile can be reported, and reports are read by IRLY’s moderators. You can also block a member: a person you blocked cannot see you, contact you or appear in your suggestions.</p>`,
      },
    ],
    faq: [
      { q: 'Is IRLY free?', a: 'Yes, IRLY is free. An organiser can mark an activity as paid when it has a cost of its own, and the activity page shows it before you join.' },
      { q: 'Is IRLY a dating app?', a: 'No. IRLY is made for friendship: communities, group activities and group chats. It is not designed for dating.' },
      { q: 'Where can I use IRLY?', a: 'IRLY starts in Dubai and covers the other emirates of the UAE. It works today in the browser at getirly.com/app, and iOS and Android apps are coming soon.' },
      { q: 'Which languages does IRLY support?', a: 'English and French. You choose the language in the app’s settings.' },
      { q: 'What is IRLY Girl?', a: 'IRLY Girl is a space inside IRLY reserved for women, with its own communities and activities. The team checks each profile once before opening access.' },
      { q: 'Who is behind IRLY?', a: 'IRLY is published by ALF FASHION BRAND FZCO, a company based in Dubai. The team can be reached at getirly@gmail.com.' },
    ],
    cta: { title: 'Want to see it for yourself?', body: 'Open IRLY in your browser, choose your emirate and look at the communities suggested for you.', label: 'Discover IRLY' },
    related: [
      { label: 'How IRLY works', path: 'irly/how-it-works/' },
      { label: 'How to join a community on IRLY', path: 'irly/join-a-community/' },
      { label: 'IRLY vs other ways to meet people in Dubai', path: 'irly/irly-vs-other-ways-to-meet-people/' },
      { label: 'How to make friends in Dubai', path: 'dubai/make-friends/' },
    ],
  },
  {
    lang: 'fr',
    pair: 'irly-what',
    path: 'fr/irly/c-est-quoi/',
    cover: 'brunch',
    city: 'IRLY',
    published: '2026-11-12',
    title: 'IRLY, c’est quoi ? L’appli pour se faire des amis | IRLY',
    description: 'IRLY est une appli gratuite pour se faire des amis en vrai à Dubaï et aux Émirats : communautés, activités, chats de groupe. Pour qui, et ce que ce n’est pas.',
    h1: 'IRLY, c’est quoi ?',
    lead: 'IRLY est une application gratuite pour se faire des amis dans la vraie vie : tu rejoins des communautés autour de tes centres d’intérêt, tu participes à des activités ou tu en organises, et tu discutes dans un chat de groupe avant la rencontre. Elle démarre à Dubaï et couvre les autres émirats, en français et en anglais. Ce n’est pas une appli de rencontres amoureuses, et elle fonctionne aujourd’hui dans le navigateur ; les applications iOS et Android arrivent bientôt.',
    sections: [
      {
        h2: 'IRLY en quelques lignes',
        html: `<p>Le nom complet est « IRLY — Make Friends IRL ». IRL veut dire « in real life », dans la vraie vie, et toute l’idée est là : l’appli est un chemin vers une rencontre, pas un endroit où rester. Tu t’en sers pour trouver des gens qui aiment ce que tu aimes, convenir d’une heure et d’un lieu, et y aller.</p>
<p>Tout s’organise autour de trois choses : les <strong>communautés</strong> (des groupes de gens qui se revoient), les <strong>activités</strong> (un plan avec une date, un lieu et un nombre de places) et les <strong>chats</strong> (un par communauté, un par activité, et les messages privés).</p>`,
      },
      {
        h2: 'Pour qui ?',
        html: `<ul>
<li><strong>Les nouveaux arrivants.</strong> Tu viens de t’installer à Dubaï ou dans un autre émirat et tu ne connais encore personne.</li>
<li><strong>Ceux dont le cercle a changé.</strong> Aux Émirats, les amis repartent souvent ; il faut parfois reconstruire son cercle.</li>
<li><strong>Ceux qui cherchent quelqu’un avec qui faire des choses.</strong> Un partenaire de padel, un groupe pour marcher, une tablée pour un brunch.</li>
<li><strong>Les femmes qui préfèrent un cadre entre femmes.</strong> IRLY Girl est un espace réservé aux femmes.</li>
<li><strong>Les professionnels.</strong> IRLY Network est la partie de l’appli consacrée aux rencontres professionnelles.</li>
</ul>
<p>IRLY s’adresse aux adultes : l’appli demande ton âge à l’inscription et est réservée aux 18 ans et plus.</p>`,
      },
      {
        h2: 'Ce que tu peux faire sur IRLY',
        html: `<ul>
<li><strong>Rejoindre des communautés.</strong> Celles d’IRLY et celles que les membres créent, par thème. Rejoindre une communauté te fait entrer dans son chat. Voir <a href="../rejoindre-une-communaute/">comment rejoindre une communauté sur IRLY</a>.</li>
<li><strong>Participer à une activité, ou en créer une.</strong> Sport, repas, balade, voyage, rencontre : chaque activité a sa page et son propre chat. Voir <a href="../organiser-une-activite/">comment organiser une activité sur IRLY</a>.</li>
<li><strong>Discuter avant de se voir.</strong> Messages réunit au même endroit tes chats privés, ceux de tes communautés et ceux de tes activités.</li>
<li><strong>Voir ce qui se passe maintenant.</strong> L’onglet IRL affiche de courtes publications, une photo ou quelques mots, de gens autour de toi ; elles disparaissent au bout de 24 heures.</li>
<li><strong>Regarder autour de toi.</strong> Découvrir liste des personnes, des activités, des lieux et des événements, et une carte montre ce qui est près de toi.</li>
<li><strong>Entrer dans IRLY Girl,</strong> si tu es une femme : la même appli, dans un espace où chaque membre est une femme. Plus de détails sur la <a href="/fr/girl">page IRLY Girl</a>.</li>
<li><strong>Utiliser IRLY Network</strong> pour le travail : un profil professionnel, d’autres professionnels à rencontrer, des rencontres pro.</li>
<li><strong>Jouer.</strong> IRLY Games propose Loup-Garou, un jeu d’ambiance auquel tu peux jouer en ligne avec d’autres membres ou contre des joueurs IA, pour briser la glace.</li>
</ul>
<p>Le parcours pas à pas, du premier écran à la première rencontre, est dans <a href="../comment-ca-marche/">comment fonctionne IRLY</a>.</p>`,
      },
      {
        h2: 'Ce qu’IRLY n’est pas',
        html: `<ul>
<li><strong>Pas une appli de rencontres amoureuses.</strong> On y vient pour faire des choses ensemble, le plus souvent en groupe. Si tu cherches un ou une partenaire, une appli de rencontres est le bon outil.</li>
<li><strong>Pas un substitut au fait d’y aller.</strong> L’appli t’aide à trouver le plan et les gens. L’amitié se construit en vrai, en revenant dans le même groupe.</li>
<li><strong>Pas partout.</strong> IRLY est centrée sur Dubaï et les Émirats arabes unis.</li>
<li><strong>Pas une promesse.</strong> Aucune appli ne garantit des amis. IRLY est une option parmi d’autres, et notre guide pour <a href="../../dubai/application-pour-se-faire-des-amis/">choisir une appli pour se faire des amis à Dubaï</a> décrit les autres types honnêtement.</li>
</ul>`,
      },
      {
        h2: 'Où ça marche, et sur quel appareil',
        html: `<p>IRLY démarre à Dubaï et couvre les autres émirats des Émirats arabes unis. À l’inscription, tu choisis ton émirat.</p>
<p>Aujourd’hui, IRLY fonctionne dans le navigateur, en application web, à l’adresse getirly.com/app : sur téléphone, tablette ou ordinateur, sans rien installer. Les applications iOS et Android arrivent bientôt.</p>`,
      },
      {
        h2: 'Prix et langues',
        html: `<p>IRLY est gratuite. Une activité peut avoir un coût propre, un terrain ou un billet par exemple : l’organisateur l’indique comme « Gratuit » ou « Payant », et la page de l’activité l’affiche avant que tu la rejoignes.</p>
<p>L’appli est écrite en français et en anglais. Tu choisis la langue dans les Réglages, et tu peux rencontrer des gens dans l’une comme dans l’autre.</p>`,
      },
      {
        h2: 'Qui édite IRLY ?',
        html: `<p>IRLY est éditée par ALF FASHION BRAND FZCO, une société basée à Dubaï, aux Émirats arabes unis. Tu peux écrire à l’équipe à getirly@gmail.com.</p>
<p>Chaque communauté, activité, message ou profil peut être signalé, et les signalements sont lus par les modérateurs d’IRLY. Tu peux aussi bloquer un membre : une personne bloquée ne peut plus te voir, te contacter ni apparaître dans tes suggestions.</p>`,
      },
    ],
    faq: [
      { q: 'IRLY est-elle gratuite ?', a: 'Oui, IRLY est gratuite. Un organisateur peut indiquer qu’une activité est payante quand elle a un coût propre, et la page de l’activité l’affiche avant que tu la rejoignes.' },
      { q: 'IRLY est-elle une appli de rencontres amoureuses ?', a: 'Non. IRLY est faite pour l’amitié : communautés, activités de groupe et chats de groupe. Elle n’est pas conçue pour les rencontres amoureuses.' },
      { q: 'Où peut-on utiliser IRLY ?', a: 'IRLY démarre à Dubaï et couvre les autres émirats. Elle fonctionne aujourd’hui dans le navigateur à l’adresse getirly.com/app, et les applications iOS et Android arrivent bientôt.' },
      { q: 'Dans quelles langues IRLY est-elle disponible ?', a: 'En français et en anglais. Tu choisis la langue dans les réglages de l’appli.' },
      { q: 'IRLY Girl, c’est quoi ?', a: 'IRLY Girl est un espace réservé aux femmes à l’intérieur d’IRLY, avec ses propres communautés et activités. L’équipe vérifie chaque profil une fois avant d’ouvrir l’accès.' },
      { q: 'Qui est derrière IRLY ?', a: 'IRLY est éditée par ALF FASHION BRAND FZCO, une société basée à Dubaï. L’équipe se contacte à getirly@gmail.com.' },
    ],
    cta: { title: 'Envie de voir par toi-même ?', body: 'Ouvre IRLY dans ton navigateur, choisis ton émirat et regarde les communautés qui te sont proposées.', label: 'Découvrir IRLY' },
    related: [
      { label: 'Comment fonctionne IRLY ?', path: 'fr/irly/comment-ca-marche/' },
      { label: 'Comment rejoindre une communauté sur IRLY ?', path: 'fr/irly/rejoindre-une-communaute/' },
      { label: 'IRLY et les autres façons de rencontrer du monde à Dubaï', path: 'fr/irly/irly-et-les-autres-solutions/' },
      { label: 'Comment se faire des amis à Dubaï', path: 'fr/dubai/se-faire-des-amis/' },
    ],
  },
  {
    lang: 'en',
    pair: 'irly-how',
    path: 'irly/how-it-works/',
    cover: 'volleyball',
    city: 'IRLY',
    published: '2026-11-12',
    title: 'How IRLY Works: From Sign-Up to First Activity | IRLY',
    description: 'How IRLY works, screen by screen: choose your emirate, answer four steps, create your account, join communities, then join or create a first activity.',
    h1: 'How IRLY works',
    lead: 'You open IRLY in your browser, choose your emirate, answer four short steps about yourself, create your account with your email, and join the communities suggested for you. From there you join an activity, or create one; its group chat opens, and you meet in real life. The whole path is described below, screen by screen.',
    sections: [
      {
        h2: '1. Choose where you are',
        html: `<p>IRLY works today in the browser, at getirly.com/app, so there is nothing to install; iOS and Android apps are coming soon. After a short introduction, the first question is “Where are you going?”. Choose IRLY Emirates, then your emirate on the “Choose your emirate” screen. Dubai is the launch city.</p>
<p>If you already have an account, the link “Already have an account? Sign in” is on that first screen.</p>`,
      },
      {
        h2: '2. Four steps about you',
        html: `<p>IRLY asks a few things first, so that what it suggests fits you. Your answers are kept as you go: if you close the page, you pick up where you stopped.</p>
<ol>
<li><strong>Who you are.</strong> Your first name, and up to three descriptions that fit you.</li>
<li><strong>“What do you love?”</strong> At least three interests, and the activities you like.</li>
<li><strong>“Your profile”.</strong> A photo or an avatar, your age (IRLY is for people 18 and over), a short bio, your country, the languages you speak, and your gender (woman, man or other). That last answer cannot be changed after sign-up, because it decides access to IRLY Girl, the space reserved for women.</li>
<li><strong>“What are you looking for?”</strong> As many answers as you like, and how long you have been in the city.</li>
</ol>`,
      },
      {
        h2: '3. Create your account',
        html: `<p>The account comes after these steps, on the “Create your account” screen. You enter your email and choose a password of at least eight characters, then tap “Create account”. If you prefer no password, “Email me a sign-in link instead” sends a link to your inbox. IRLY may ask you to confirm your address: the “Check your email” screen tells you to open the link, or to type the six-digit code if the email shows one.</p>
<p>Communities, chats and activities are tied to your account, which is why most pages ask you to sign in before they show anything.</p>`,
      },
      {
        h2: '4. Your first communities',
        html: `<p>Right after sign-up, the “Your communities” screen lists a few communities chosen from your answers. You can tap “Join all”, pick with “Choose my communities”, or leave it with “Skip for now”. Communities are optional, and you can join or leave any of them later. Joining a community puts you in its chat straight away.</p>
<p>The details are in <a href="../join-a-community/">how to join a community on IRLY</a>.</p>`,
      },
      {
        h2: '5. Find your way around',
        html: `<p>The navigation bar, at the bottom of the screen (on the side on a wide screen), takes you to:</p>
<ul>
<li><strong>Home.</strong> Your starting point, with the “Create” button and the communities near you.</li>
<li><strong>Discover.</strong> People, activities, places and events, with a search.</li>
<li><strong>IRL.</strong> What people around you are doing now: a photo or a few words, gone after 24 hours.</li>
<li><strong>IRLY Network.</strong> The professional side: professionals, meetups and networking communities.</li>
<li><strong>Profile.</strong> Your own page.</li>
</ul>
<p>The Map, Messages and Communities open from the top of these screens. Messages gathers private chats, community chats and activity chats in one list.</p>`,
      },
      {
        h2: '6. Your first activity in real life',
        html: `<p>There are two ways to get to a first meeting.</p>
<p><strong>Join one.</strong> Open an activity from Home, Discover, the map or a community. Its page shows the date, the neighbourhood, how many people are going, whether it is free or paid, and who hosts it. Tap “Join the activity”. You are in: the activity chat opens, and “Add to my calendar” saves the date. The exact meeting point is shared in the activity chat. If you can no longer come, “Leave” releases your spot for someone else.</p>
<p><strong>Create one.</strong> On Home, tap “Create”, choose a type, then set the time, the place, who can see it and how many people. The activity gets its own chat as soon as it is published. See <a href="../create-an-activity/">how to organise an activity on IRLY</a>.</p>
<p>Then comes the part no app does for you: turning up. If arriving alone worries you, our guides on <a href="../../dubai/going-out-alone/">going out alone in Dubai</a> and <a href="../../blog/what-to-say-start-conversation-activity/">what to say to start a conversation at an activity</a> help with the first ten minutes.</p>`,
      },
      {
        h2: '7. If something is not right',
        html: `<p>Activities, communities, messages and profiles can all be reported. The “Report” sheet asks what is wrong, lets you add details, and sends it to IRLY’s moderators, who are the only ones to see reports. In the same step you can tick “Also block this member”. The people you blocked are listed in Settings, under “Blocked members”, where you can unblock them.</p>
<p>For a first meeting, choose a public place and a group activity, and tell someone you trust where you are going.</p>`,
      },
    ],
    faq: [
      { q: 'Do I need to install anything to use IRLY?', a: 'No. IRLY works today in the browser at getirly.com/app, on a phone or a computer. iOS and Android apps are coming soon.' },
      { q: 'How do I create an IRLY account?', a: 'After the four steps about you, enter your email and a password of at least eight characters and tap “Create account”. You can also ask for a sign-in link by email instead of a password.' },
      { q: 'What does IRLY ask when I sign up?', a: 'Your emirate, your first name, your interests, a photo or an avatar, your age, a short bio, your country, your languages, your gender, and what you are looking for.' },
      { q: 'Do I have to join a community?', a: 'No. Communities are optional. IRLY suggests a few after sign-up, and you can join them, choose some, or skip the step and come back later.' },
      { q: 'What happens when I join an activity?', a: 'You are added to the participants and the activity chat opens. The exact meeting point is shared in that chat, and you can leave the activity if your plans change.' },
    ],
    cta: { title: 'Ready to start?', body: 'Open IRLY in your browser, choose your emirate and answer the four steps. Your first communities are suggested right after.', label: 'Discover IRLY' },
    related: [
      { label: 'What is IRLY?', path: 'irly/what-is-irly/' },
      { label: 'How to join a community on IRLY', path: 'irly/join-a-community/' },
      { label: 'How to organise an activity on IRLY', path: 'irly/create-an-activity/' },
      { label: 'Going out alone in Dubai', path: 'dubai/going-out-alone/' },
    ],
  },
  {
    lang: 'fr',
    pair: 'irly-how',
    path: 'fr/irly/comment-ca-marche/',
    cover: 'volleyball',
    city: 'IRLY',
    published: '2026-11-12',
    title: 'Comment fonctionne IRLY ? Le guide pas à pas | IRLY',
    description: 'Comment fonctionne IRLY, écran par écran : choisir son émirat, répondre à quatre étapes, créer son compte, rejoindre des communautés, puis une activité.',
    h1: 'Comment fonctionne IRLY ?',
    lead: 'Tu ouvres IRLY dans ton navigateur, tu choisis ton émirat, tu réponds à quatre courtes étapes sur toi, tu crées ton compte avec ton e-mail et tu rejoins les communautés qui te sont proposées. Ensuite, tu rejoins une activité ou tu en crées une ; son chat de groupe s’ouvre, et vous vous retrouvez en vrai. Tout le parcours est décrit ci-dessous, écran par écran.',
    sections: [
      {
        h2: '1. Choisir où tu es',
        html: `<p>IRLY fonctionne aujourd’hui dans le navigateur, à l’adresse getirly.com/app : il n’y a rien à installer ; les applications iOS et Android arrivent bientôt. Après une courte introduction, la première question est « Tu vas où ? ». Choisis IRLY Emirates, puis ton émirat sur l’écran « Choisis ton émirat ». Dubaï est la ville de lancement.</p>
<p>Si tu as déjà un compte, le lien « Tu as déjà un compte ? Connecte-toi » se trouve sur ce premier écran.</p>`,
      },
      {
        h2: '2. Quatre étapes sur toi',
        html: `<p>IRLY te pose d’abord quelques questions, pour que ses suggestions te correspondent. Tes réponses sont gardées au fur et à mesure : si tu fermes la page, tu reprends où tu t’étais arrêté.</p>
<ol>
<li><strong>Qui tu es.</strong> Ton prénom, et jusqu’à trois descriptions qui te ressemblent.</li>
<li><strong>« Qu’est-ce que tu aimes ? »</strong> Au moins trois centres d’intérêt, et les activités qui te plaisent.</li>
<li><strong>« Ton profil ».</strong> Une photo ou un avatar, ton âge (IRLY est réservé aux 18 ans et plus), une courte bio, ton pays, les langues que tu parles, et ton genre (femme, homme ou autre). Cette dernière réponse ne peut plus être modifiée après l’inscription, parce qu’elle décide de l’accès à IRLY Girl, l’espace réservé aux femmes.</li>
<li><strong>« Que cherches-tu ? »</strong> Autant de réponses que tu veux, et depuis combien de temps tu es dans la ville.</li>
</ol>`,
      },
      {
        h2: '3. Créer ton compte',
        html: `<p>Le compte vient après ces étapes, sur l’écran « Crée ton compte ». Tu saisis ton e-mail et tu choisis un mot de passe d’au moins huit caractères, puis tu touches « Créer le compte ». Si tu préfères ne pas avoir de mot de passe, « Recevoir plutôt un lien par e-mail » t’envoie un lien de connexion. IRLY peut te demander de confirmer ton adresse : l’écran « Regarde tes e-mails » t’invite à ouvrir le lien, ou à saisir le code à six chiffres si l’e-mail en contient un.</p>
<p>Les communautés, les chats et les activités sont liés à ton compte ; c’est pourquoi la plupart des pages te demandent de te connecter avant d’afficher quoi que ce soit.</p>`,
      },
      {
        h2: '4. Tes premières communautés',
        html: `<p>Juste après l’inscription, l’écran « Tes communautés » liste quelques communautés choisies d’après tes réponses. Tu peux toucher « Tout rejoindre », faire ton choix avec « Choisir mes communautés », ou passer avec « Plus tard ». Les communautés sont facultatives, et tu peux les rejoindre ou les quitter quand tu veux. Rejoindre une communauté te fait entrer tout de suite dans son chat.</p>
<p>Les détails sont dans <a href="../rejoindre-une-communaute/">comment rejoindre une communauté sur IRLY</a>.</p>`,
      },
      {
        h2: '5. Te repérer dans l’appli',
        html: `<p>La barre de navigation, en bas de l’écran (sur le côté sur un grand écran), te mène à :</p>
<ul>
<li><strong>Accueil.</strong> Ton point de départ, avec le bouton « Créer » et les communautés près de toi.</li>
<li><strong>Découvrir.</strong> Des personnes, des activités, des lieux et des événements, avec une recherche.</li>
<li><strong>IRL.</strong> Ce que les gens autour de toi font en ce moment : une photo ou quelques mots, effacés au bout de 24 heures.</li>
<li><strong>IRLY Network.</strong> Le côté professionnel : professionnels, rencontres pro et communautés de networking.</li>
<li><strong>Profil.</strong> Ta propre page.</li>
</ul>
<p>La Carte, les Messages et les Communautés s’ouvrent depuis le haut de ces écrans. Messages réunit dans une seule liste les chats privés, ceux des communautés et ceux des activités.</p>`,
      },
      {
        h2: '6. Ta première activité en vrai',
        html: `<p>Il y a deux façons d’arriver à une première rencontre.</p>
<p><strong>En rejoindre une.</strong> Ouvre une activité depuis l’Accueil, Découvrir, la carte ou une communauté. Sa page indique la date, le quartier, le nombre de participants, si elle est gratuite ou payante, et qui l’organise. Touche « Rejoindre l’activité ». C’est bon, tu en es : le chat de l’activité s’ouvre, et « Ajouter à mon calendrier » enregistre la date. Le point de rendez-vous exact est partagé dans le chat de l’activité. Si tu ne peux plus venir, « Quitter » libère ta place pour quelqu’un d’autre.</p>
<p><strong>En créer une.</strong> Sur l’Accueil, touche « Créer », choisis un type, puis fixe l’heure, le lieu, qui peut la voir et le nombre de personnes. L’activité a son propre chat dès sa publication. Voir <a href="../organiser-une-activite/">comment organiser une activité sur IRLY</a>.</p>
<p>Vient ensuite ce qu’aucune appli ne fait à ta place : y aller. Si arriver seul t’inquiète, nos guides pour <a href="../../dubai/sortir-seul/">sortir seul à Dubaï</a> et savoir <a href="../../blog/quoi-dire-pour-lancer-une-conversation-activite/">quoi dire pour lancer une conversation pendant une activité</a> aident pour les dix premières minutes.</p>`,
      },
      {
        h2: '7. Si quelque chose ne va pas',
        html: `<p>Les activités, les communautés, les messages et les profils peuvent tous être signalés. La fenêtre « Signaler » demande ce qui ne va pas, te laisse ajouter des détails, et envoie le tout aux modérateurs d’IRLY, qui sont les seuls à voir les signalements. Dans la même étape, tu peux cocher « Bloquer aussi ce membre ». Les personnes que tu as bloquées sont listées dans les Réglages, sous « Membres bloqués », où tu peux les débloquer.</p>
<p>Pour une première rencontre, choisis un lieu public et une activité de groupe, et dis à quelqu’un de confiance où tu vas.</p>`,
      },
    ],
    faq: [
      { q: 'Faut-il installer quelque chose pour utiliser IRLY ?', a: 'Non. IRLY fonctionne aujourd’hui dans le navigateur à l’adresse getirly.com/app, sur téléphone ou sur ordinateur. Les applications iOS et Android arrivent bientôt.' },
      { q: 'Comment créer un compte IRLY ?', a: 'Après les quatre étapes sur toi, saisis ton e-mail et un mot de passe d’au moins huit caractères, puis touche « Créer le compte ». Tu peux aussi demander un lien de connexion par e-mail à la place du mot de passe.' },
      { q: 'Que demande IRLY à l’inscription ?', a: 'Ton émirat, ton prénom, tes centres d’intérêt, une photo ou un avatar, ton âge, une courte bio, ton pays, tes langues, ton genre, et ce que tu cherches.' },
      { q: 'Est-on obligé de rejoindre une communauté ?', a: 'Non. Les communautés sont facultatives. IRLY en propose quelques-unes après l’inscription : tu peux les rejoindre, en choisir certaines, ou passer l’étape et y revenir plus tard.' },
      { q: 'Que se passe-t-il quand je rejoins une activité ?', a: 'Tu es ajouté aux participants et le chat de l’activité s’ouvre. Le point de rendez-vous exact est partagé dans ce chat, et tu peux quitter l’activité si tes plans changent.' },
    ],
    cta: { title: 'Prêt à commencer ?', body: 'Ouvre IRLY dans ton navigateur, choisis ton émirat et réponds aux quatre étapes. Tes premières communautés te sont proposées juste après.', label: 'Découvrir IRLY' },
    related: [
      { label: 'IRLY, c’est quoi ?', path: 'fr/irly/c-est-quoi/' },
      { label: 'Comment rejoindre une communauté sur IRLY ?', path: 'fr/irly/rejoindre-une-communaute/' },
      { label: 'Comment organiser une activité sur IRLY ?', path: 'fr/irly/organiser-une-activite/' },
      { label: 'Sortir seul à Dubaï', path: 'fr/dubai/sortir-seul/' },
    ],
  },
  {
    lang: 'en',
    pair: 'irly-join-community',
    path: 'irly/join-a-community/',
    cover: 'running',
    city: 'IRLY',
    published: '2026-11-12',
    title: 'How to Join a Community on IRLY, Step by Step | IRLY',
    description: 'How to find and join a community on IRLY: search by theme, tap “Join the community”, use its posts, chat and activities, leave it, or start your own.',
    h1: 'How to join a community on IRLY',
    lead: 'Open Communities from the top of the app, look under “For you” or search by name, theme or description, open a community and tap “Join the community”. You are a member straight away, and you are in its chat too. You can leave at any time with “Leave”, and you can start a community of your own.',
    sections: [
      {
        h2: 'What a community is on IRLY',
        html: `<p>A community is a group of people who meet again, around a theme: a sport, a neighbourhood, a language, a stage of life. Some are IRLY’s own and are marked “IRLY Community”; the others are started by members. Each one has its own page and its own chat.</p>
<p>The reason to join one is simple: friendships come from seeing the same faces several times. A community gives you those faces, and a reason to see them again. Our guide to <a href="../../dubai/expat-communities/">expat communities in Dubai</a> explains how to choose among the many kinds of groups, on IRLY and elsewhere.</p>`,
      },
      {
        h2: 'Find a community',
        html: `<p>You need an account to see communities; if you do not have one yet, <a href="../how-it-works/">how IRLY works</a> covers sign-up. Then:</p>
<ul>
<li><strong>At sign-up.</strong> The “Your communities” screen suggests a few from your answers. “Join all” takes them all, “Choose my communities” lets you pick.</li>
<li><strong>From the Communities page.</strong> It opens from the top of the main screens and has three views: “Mine”, “For you” (recommendations based on your interests) and “Discover” (all of them).</li>
<li><strong>By search.</strong> The field “Search by name, theme or description” filters as you type, and chips narrow the list by theme, such as Sports, Food, Culture or Networking.</li>
<li><strong>From Home.</strong> The “Communities near you” section shows a few, with “All” to see the rest.</li>
</ul>`,
      },
      {
        h2: 'Join, in three steps',
        html: `<ol>
<li><strong>Open the community.</strong> Read its line of description and tap “About” to see who it is for and its rules.</li>
<li><strong>Tap “Join the community”.</strong> In a list, the button simply says “Join”. There is no request to wait for.</li>
<li><strong>Tap “Open chat”.</strong> You are in the community chat as soon as you have joined.</li>
</ol>`,
      },
      {
        h2: 'What you can do once you are in',
        html: `<p>A community page has four spaces:</p>
<ul>
<li><strong>Posts.</strong> Members write to the community with text, photos or a poll. You can sort by “Recent” or “Most popular”, and important posts are pinned at the top.</li>
<li><strong>Chat.</strong> The community’s group conversation, for members.</li>
<li><strong>Activities.</strong> The plans of the community, as an “Agenda” or as lists, “Coming up” and “Past”. “Propose an activity” opens the creation form, already attached to the community.</li>
<li><strong>Members.</strong> The people in the community.</li>
</ul>
<p>When a post reads like a plan, IRLY can offer to turn it into an activity, with its date, its place and its own chat.</p>`,
      },
      {
        h2: 'From member to regular',
        html: `<p>Joining takes a second. Becoming part of the group takes a little more, and follows the same order everywhere:</p>
<ol>
<li><strong>Say hello.</strong> A few lines in the chat or in a post: where you live, what you like doing, what you are looking for.</li>
<li><strong>Join one activity soon.</strong> The longer you only read, the harder the first time becomes. Our list of <a href="../../dubai/group-activities/">group activities to meet people in Dubai</a> shows which formats are easiest for a first time.</li>
<li><strong>Come back.</strong> The third time is when people start to know your name.</li>
<li><strong>Propose something small.</strong> A coffee before the session, the same walk next week.</li>
</ol>
<p>Keep the number small. Two communities you really take part in are worth more than ten you only scroll.</p>`,
      },
      {
        h2: 'Leave or report a community',
        html: `<p>To leave, tap “Leave” on the community page or in your list; the app asks you to confirm. Leaving a community also takes you out of its chat. You can join again later.</p>
<p>If a community breaks the rules, open “About” and tap “Report this community”. Reports go to IRLY’s moderators only.</p>`,
      },
      {
        h2: 'Start your own',
        html: `<p>If the group you want does not exist yet, create it. On the Communities page, tap “Create a community” (it is also in the “Create” menu on Home). The “New community” form asks for:</p>
<ul>
<li><strong>Name.</strong> At least three characters.</li>
<li><strong>One line.</strong> What the group does, in a few words.</li>
<li><strong>About.</strong> Who it is for, how often you meet, the mood.</li>
<li><strong>Category.</strong></li>
</ul>
<p>Tap “Create community”: you are its owner, you land in its chat, and “Manage the community” gives you its settings. People who join are in the chat straight away. A women-only community is created from inside IRLY Girl: only women can see and join it. For the human side, read <a href="../../blog/start-small-group-weekly-walk-book-club/">how to start a small group</a>.</p>`,
      },
    ],
    faq: [
      { q: 'Do I need approval to join a community on IRLY?', a: 'No. You tap “Join the community” and you are a member straight away, with access to its chat.' },
      { q: 'How many communities should I join?', a: 'There is no rule, but one or two that you really take part in are more useful than many you only read.' },
      { q: 'Can I leave a community?', a: 'Yes, at any time. Tap “Leave” and confirm. You also leave its chat, and you can join again later.' },
      { q: 'Can I create my own community on IRLY?', a: 'Yes. Tap “Create a community”, give it a name, a line of description and a category. You become its owner and its chat is created with it.' },
      { q: 'Are there communities for women only?', a: 'Yes, in IRLY Girl, the space reserved for women. Only women can see and join these communities.' },
    ],
    cta: { title: 'Looking for your group?', body: 'Open IRLY, look at the communities suggested for you and join one this week.', label: 'Discover IRLY' },
    related: [
      { label: 'How IRLY works', path: 'irly/how-it-works/' },
      { label: 'How to organise an activity on IRLY', path: 'irly/create-an-activity/' },
      { label: 'Expat communities in Dubai: how to find yours', path: 'dubai/expat-communities/' },
      { label: 'How to start a small group', path: 'blog/start-small-group-weekly-walk-book-club/' },
    ],
  },
  {
    lang: 'fr',
    pair: 'irly-join-community',
    path: 'fr/irly/rejoindre-une-communaute/',
    cover: 'running',
    city: 'IRLY',
    published: '2026-11-12',
    title: 'Comment rejoindre une communauté sur IRLY ? | IRLY',
    description: 'Trouver et rejoindre une communauté sur IRLY : chercher par thème, puis « Rejoindre la communauté », utiliser son chat et ses activités, ou créer la tienne.',
    h1: 'Comment rejoindre une communauté sur IRLY ?',
    lead: 'Ouvre Communautés depuis le haut de l’appli, regarde l’onglet « Pour toi » ou cherche par nom, thème ou description, ouvre une communauté et touche « Rejoindre la communauté ». Tu es membre tout de suite, et tu es aussi dans son chat. Tu peux la quitter à tout moment avec « Quitter », et tu peux créer ta propre communauté.',
    sections: [
      {
        h2: 'Une communauté sur IRLY, c’est quoi ?',
        html: `<p>Une communauté est un groupe de gens qui se revoient, autour d’un thème : un sport, un quartier, une langue, une étape de vie. Certaines sont celles d’IRLY et portent la mention « IRLY Community » ; les autres sont créées par les membres. Chacune a sa page et son propre chat.</p>
<p>La raison d’en rejoindre une est simple : les amitiés naissent quand on revoit plusieurs fois les mêmes visages. Une communauté te donne ces visages, et une raison de les revoir. Notre guide des <a href="../../dubai/communautes-expatries/">communautés d’expatriés à Dubaï</a> explique comment choisir parmi les nombreux types de groupes, sur IRLY et ailleurs.</p>`,
      },
      {
        h2: 'Trouver une communauté',
        html: `<p>Il faut un compte pour voir les communautés ; si tu n’en as pas encore, <a href="../comment-ca-marche/">comment fonctionne IRLY</a> décrit l’inscription. Ensuite :</p>
<ul>
<li><strong>À l’inscription.</strong> L’écran « Tes communautés » en propose quelques-unes d’après tes réponses. « Tout rejoindre » les prend toutes, « Choisir mes communautés » te laisse trier.</li>
<li><strong>Depuis la page Communautés.</strong> Elle s’ouvre depuis le haut des écrans principaux et comporte trois vues : « Les miennes », « Pour toi » (des recommandations d’après tes centres d’intérêt) et « Découvrir » (toutes les communautés).</li>
<li><strong>Par la recherche.</strong> Le champ « Nom, thème ou description » filtre pendant que tu écris, et des filtres par thème, comme le sport, la cuisine, la culture ou le networking, réduisent la liste.</li>
<li><strong>Depuis l’Accueil.</strong> La section « Communautés près de toi » en montre quelques-unes, avec un lien pour voir les autres.</li>
</ul>`,
      },
      {
        h2: 'Rejoindre, en trois étapes',
        html: `<ol>
<li><strong>Ouvre la communauté.</strong> Lis sa ligne de description et touche « À propos » pour voir à qui elle s’adresse et quelles sont ses règles.</li>
<li><strong>Touche « Rejoindre la communauté ».</strong> Dans une liste, le bouton dit simplement « Rejoindre ». Il n’y a pas de demande à faire valider.</li>
<li><strong>Touche « Ouvrir le chat ».</strong> Tu es dans le chat de la communauté dès que tu l’as rejointe.</li>
</ol>`,
      },
      {
        h2: 'Ce que tu peux faire une fois membre',
        html: `<p>La page d’une communauté comporte quatre espaces :</p>
<ul>
<li><strong>Publications.</strong> Les membres écrivent à la communauté avec du texte, des photos ou un sondage. Tu peux trier par « Récent » ou « Populaire », et les publications importantes sont épinglées en haut.</li>
<li><strong>Chat.</strong> La conversation de groupe de la communauté, pour ses membres.</li>
<li><strong>Activités.</strong> Les plans de la communauté, en « Agenda » ou en listes, « Bientôt » et « Passées ». « Proposer une activité » ouvre le formulaire de création, déjà rattaché à la communauté.</li>
<li><strong>Membres.</strong> Les personnes de la communauté.</li>
</ul>
<p>Quand une publication ressemble à un plan, IRLY peut proposer d’en faire une activité, avec sa date, son lieu et son propre chat.</p>`,
      },
      {
        h2: 'De membre à habitué',
        html: `<p>Rejoindre prend une seconde. Faire partie du groupe demande un peu plus, et suit partout le même ordre :</p>
<ol>
<li><strong>Dis bonjour.</strong> Quelques lignes dans le chat ou dans une publication : où tu habites, ce que tu aimes faire, ce que tu cherches.</li>
<li><strong>Rejoins vite une activité.</strong> Plus tu te contentes de lire, plus la première fois devient difficile. Notre liste d’<a href="../../dubai/activites-de-groupe/">activités de groupe pour rencontrer du monde à Dubaï</a> montre quels formats sont les plus simples pour une première fois.</li>
<li><strong>Reviens.</strong> C’est à la troisième fois que les gens commencent à connaître ton prénom.</li>
<li><strong>Propose quelque chose de petit.</strong> Un café avant la séance, la même balade la semaine suivante.</li>
</ol>
<p>Reste raisonnable sur le nombre. Deux communautés où tu participes vraiment valent mieux que dix que tu fais défiler.</p>`,
      },
      {
        h2: 'Quitter ou signaler une communauté',
        html: `<p>Pour partir, touche « Quitter » sur la page de la communauté ou dans ta liste ; l’appli te demande de confirmer. Quitter une communauté te fait aussi sortir de son chat. Tu peux la rejoindre de nouveau plus tard.</p>
<p>Si une communauté ne respecte pas les règles, ouvre « À propos » et touche « Signaler cette communauté ». Les signalements ne sont vus que par les modérateurs d’IRLY.</p>`,
      },
      {
        h2: 'Créer la tienne',
        html: `<p>Si le groupe que tu cherches n’existe pas encore, crée-le. Sur la page Communautés, touche « Créer une communauté » (l’option est aussi dans le menu « Créer » de l’Accueil). Le formulaire « Nouvelle communauté » demande :</p>
<ul>
<li><strong>Nom.</strong> Au moins trois caractères.</li>
<li><strong>En une ligne.</strong> Ce que fait le groupe, en quelques mots.</li>
<li><strong>À propos.</strong> À qui elle s’adresse, à quel rythme vous vous voyez, l’ambiance.</li>
<li><strong>Catégorie.</strong></li>
</ul>
<p>Touche « Créer la communauté » : tu en es le propriétaire, tu arrives dans son chat, et « Gérer la communauté » te donne accès à ses réglages. Les personnes qui la rejoignent sont tout de suite dans le chat. Une communauté réservée aux femmes se crée depuis IRLY Girl : seules les femmes peuvent la voir et la rejoindre. Pour le côté humain, lis <a href="../../blog/creer-un-petit-groupe-balade-club-lecture/">comment créer un petit groupe</a>.</p>`,
      },
    ],
    faq: [
      { q: 'Faut-il être accepté pour rejoindre une communauté sur IRLY ?', a: 'Non. Tu touches « Rejoindre la communauté » et tu es membre tout de suite, avec accès à son chat.' },
      { q: 'Combien de communautés faut-il rejoindre ?', a: 'Il n’y a pas de règle, mais une ou deux communautés où tu participes vraiment sont plus utiles que beaucoup de communautés que tu ne fais que lire.' },
      { q: 'Peut-on quitter une communauté ?', a: 'Oui, à tout moment. Touche « Quitter » et confirme. Tu quittes aussi son chat, et tu peux la rejoindre de nouveau plus tard.' },
      { q: 'Peut-on créer sa propre communauté sur IRLY ?', a: 'Oui. Touche « Créer une communauté », donne-lui un nom, une ligne de description et une catégorie. Tu en deviens le propriétaire et son chat est créé en même temps.' },
      { q: 'Existe-t-il des communautés réservées aux femmes ?', a: 'Oui, dans IRLY Girl, l’espace réservé aux femmes. Seules les femmes peuvent voir et rejoindre ces communautés.' },
    ],
    cta: { title: 'Tu cherches ton groupe ?', body: 'Ouvre IRLY, regarde les communautés qui te sont proposées et rejoins-en une cette semaine.', label: 'Découvrir IRLY' },
    related: [
      { label: 'Comment fonctionne IRLY ?', path: 'fr/irly/comment-ca-marche/' },
      { label: 'Comment organiser une activité sur IRLY ?', path: 'fr/irly/organiser-une-activite/' },
      { label: 'Rejoindre une communauté d’expatriés à Dubaï', path: 'fr/dubai/communautes-expatries/' },
      { label: 'Créer un petit groupe', path: 'fr/blog/creer-un-petit-groupe-balade-club-lecture/' },
    ],
  },
  {
    lang: 'en',
    pair: 'irly-create-activity',
    path: 'irly/create-an-activity/',
    cover: 'surf',
    city: 'IRLY',
    published: '2026-11-12',
    title: 'How to Organise an Activity on IRLY | IRLY',
    description: 'How to create an activity on IRLY in four steps: what, when and where, who can see it, how many people. Plus advice for a first activity people come to.',
    h1: 'How to organise an activity on IRLY',
    lead: 'On Home, tap “Create”, choose a type (Sport, Activity, Event, Session, Trip or Meetup) and follow four steps: what, when and where, who can see it, and how many people. When you publish, the activity gets its own page and its own group chat. For a first one, keep it simple: a clear name, a set time and place, a small group.',
    sections: [
      {
        h2: 'Before you start',
        html: `<p>You need an IRLY account; if you do not have one yet, <a href="../how-it-works/">how IRLY works</a> covers sign-up. You do not need a community: an activity can stand on its own. If you are a member of a community, you can also attach the activity to it, which is often the easiest way to find the first participants.</p>
<p>Know three things before you open the form: what you want to do, on which day and at what time, and in which neighbourhood. The app never picks a date or a place for you.</p>`,
      },
      {
        h2: 'The four steps of the form',
        html: `<p>On Home, the “Create” button opens a menu. Sport, Activity, Event, Session, Trip and Meetup all open the same four-step form, with a different starting point.</p>
<ol>
<li><strong>What.</strong> Tap one of the quick picks (Padel, Coffee, Brunch, Walk and others), search the list, browse a category, or type your own activity if it is not there.</li>
<li><strong>The activity.</strong> When you came through a category, you choose the precise activity inside it.</li>
<li><strong>“When and where?”</strong> A date and a start time, in the city’s time (an end time is optional). A neighbourhood, and, if you wish, an exact address so that the activity can appear on the map. Then “Who can see it”. The category suggested by IRLY can be changed here.</li>
<li><strong>“How many people?”</strong> The name of the activity, the number of spots (from two people upwards, or “Unlimited”), the price (“Free” or “Paid”), a photo and a description.</li>
</ol>
<p>For the photo you have three choices: the “IRLY library”, “My photos”, or “Surprise me”. The description field suggests what to write: what you will do, the level, what to bring, where to meet. The last button publishes; it reads “Create activity”, or “Create event”, “Create trip” and so on, depending on the type.</p>`,
      },
      {
        h2: 'Who can see it',
        html: `<p>The form offers four settings:</p>
<ul>
<li><strong>Public.</strong> The activity is open to members.</li>
<li><strong>Mutual follows.</strong> For the people you follow and who follow you back.</li>
<li><strong>Community.</strong> For one community you belong to; the form asks you which one.</li>
<li><strong>Invite only.</strong> For the people you invite.</li>
</ul>
<p>There is no women-only switch in the main app. An activity created from inside <a href="/girl">IRLY Girl</a>, the space reserved for women, is for women only: only women members can see and join it.</p>`,
      },
      {
        h2: 'After you publish',
        html: `<p>The activity is live at once, and its chat is created with it. From then on:</p>
<ul>
<li><strong>People join</strong> with “Join the activity”. When the number of spots is reached, the button shows “Full”. Someone who leaves releases their spot.</li>
<li><strong>Everyone who joined is in the activity chat.</strong> That is where you share the exact meeting point: the page itself only shows the neighbourhood, or the place you named.</li>
<li><strong>You can share it</strong> with “Share in a chat”, for example in the chat of a community you belong to.</li>
<li><strong>You can change it.</strong> “Manage your activity” lets you edit the name, the date, the place, the description, the price and the spots. “Cancel activity” tells the participants; “Delete activity” removes it.</li>
</ul>`,
      },
      {
        h2: 'Propose it inside a community',
        html: `<p>In the Activities space of every community, “Propose an activity” opens the same form, already attached to that community. The activity then appears in the community’s agenda, and members see it where they already look. In a community’s posts, a message that reads like a plan can also be turned into an activity.</p>
<p>If you are not in a community yet, read <a href="../join-a-community/">how to join a community on IRLY</a>.</p>`,
      },
      {
        h2: 'Advice for a first activity people actually come to',
        html: `<ul>
<li><strong>Give it a clear name.</strong> “Beginner padel, Saturday morning” says everything; “Let’s hang out” says nothing. Someone should know in one line what they will do and whether it is for them.</li>
<li><strong>Fix the time and the place.</strong> “One evening this week” gets no answers. A day, an hour and a neighbourhood get a yes or a no.</li>
<li><strong>Keep the group small.</strong> A handful of people can talk to each other; a crowd splits into strangers. A small group that fills up is better than a large one that stays half empty.</li>
<li><strong>Choose something easy to join.</strong> A walk, a coffee, a beginner session: an activity with a low barrier, in a public place, where arriving alone is normal.</li>
<li><strong>Write the practical details.</strong> The level, what to bring, how long it lasts, whether there is a cost. Unanswered questions are reasons not to come.</li>
<li><strong>Announce it a few days ahead,</strong> and say a word in the chat the day before. A short reminder with the meeting point helps people who hesitate.</li>
<li><strong>Do it again.</strong> The same activity at the same time next week is how a plan becomes a group.</li>
</ul>
<p>For ideas of formats, see our <a href="../../dubai/group-activities/">group activities to meet people in Dubai</a>, and for the longer view, <a href="../../blog/start-small-group-weekly-walk-book-club/">how to start a small group</a>.</p>`,
      },
      {
        h2: 'On the day',
        html: `<p>Arrive first, and say in the chat where exactly you are and what you are wearing. Greet each person by name, introduce people to each other, and do not wait for latecomers for too long. If only two people come, do the activity anyway: two people who had a good time are the start of the next one. Afterwards, thank everyone in the chat and give the next date while the mood is still there.</p>`,
      },
    ],
    faq: [
      { q: 'How do I create an activity on IRLY?', a: 'On Home, tap “Create”, choose a type, then follow the four steps: the activity, when and where, who can see it, and how many people. Publishing creates the activity page and its chat.' },
      { q: 'Does an activity on IRLY have a group chat?', a: 'Yes. A chat is created with each activity, and everyone who joins is in it. The exact meeting point is shared there.' },
      { q: 'Who can see my activity?', a: 'You choose: Public, Mutual follows, Community or Invite only. An activity created inside IRLY Girl is for women only.' },
      { q: 'Can I limit the number of participants?', a: 'Yes. You set the number of spots, or choose Unlimited. When the spots are taken, the activity shows as full.' },
      { q: 'Can I edit or cancel my activity?', a: 'Yes. “Manage your activity” lets you edit it, cancel it or delete it. Participants are told when an activity is cancelled.' },
      { q: 'How many people should I invite to a first activity?', a: 'Keep it small. A handful of people can all talk to each other, and a small group that fills up encourages you to do it again.' },
    ],
    cta: { title: 'Have an idea for this week?', body: 'Open IRLY, tap “Create” and publish a simple plan: a clear name, a time, a place, a small group.', label: 'Discover IRLY' },
    related: [
      { label: 'How to join a community on IRLY', path: 'irly/join-a-community/' },
      { label: 'How IRLY works', path: 'irly/how-it-works/' },
      { label: 'Group activities to meet people in Dubai', path: 'dubai/group-activities/' },
      { label: 'How to start a small group', path: 'blog/start-small-group-weekly-walk-book-club/' },
    ],
  },
  {
    lang: 'fr',
    pair: 'irly-create-activity',
    path: 'fr/irly/organiser-une-activite/',
    cover: 'surf',
    city: 'IRLY',
    published: '2026-11-12',
    title: 'Comment organiser une activité sur IRLY ? | IRLY',
    description: 'Créer une activité sur IRLY en quatre étapes : quoi, quand et où, qui peut la voir, combien de personnes. Et nos conseils pour une première activité réussie.',
    h1: 'Comment organiser une activité sur IRLY ?',
    lead: 'Sur l’Accueil, touche « Créer », choisis un type (Sport, Activité, Événement, Séance, Voyage ou Rencontre) et suis quatre étapes : quoi, quand et où, qui peut la voir, et combien de personnes. À la publication, l’activité a sa propre page et son propre chat de groupe. Pour une première, reste simple : un nom clair, une heure et un lieu fixés, un petit groupe.',
    sections: [
      {
        h2: 'Avant de commencer',
        html: `<p>Il te faut un compte IRLY ; si tu n’en as pas encore, <a href="../comment-ca-marche/">comment fonctionne IRLY</a> décrit l’inscription. Tu n’as pas besoin d’une communauté : une activité peut exister seule. Si tu es membre d’une communauté, tu peux aussi y rattacher l’activité, ce qui est souvent le moyen le plus simple de trouver les premiers participants.</p>
<p>Avant d’ouvrir le formulaire, sache trois choses : ce que tu veux faire, quel jour et à quelle heure, et dans quel quartier. L’appli ne choisit jamais une date ou un lieu à ta place.</p>`,
      },
      {
        h2: 'Les quatre étapes du formulaire',
        html: `<p>Sur l’Accueil, le bouton « Créer » ouvre un menu. Sport, Activité, Événement, Séance, Voyage et Rencontre ouvrent tous le même formulaire en quatre étapes, avec un point de départ différent.</p>
<ol>
<li><strong>Quoi.</strong> Touche l’un des choix rapides (padel, café, brunch, balade et d’autres), cherche dans la liste, parcours une catégorie, ou écris ta propre activité si elle n’y est pas.</li>
<li><strong>L’activité.</strong> Si tu es passé par une catégorie, tu choisis l’activité précise à l’intérieur.</li>
<li><strong>« Quand et où ? »</strong> Une date et une heure de début, à l’heure de la ville (l’heure de fin est facultative). Un quartier et, si tu veux, une adresse exacte pour que l’activité puisse apparaître sur la carte. Puis « Qui peut le voir ». La catégorie suggérée par IRLY peut être changée ici.</li>
<li><strong>« Combien de personnes ? »</strong> Le nom de l’activité, le nombre de places (à partir de deux personnes, ou « Illimité »), le prix (« Gratuit » ou « Payant »), une photo et une description.</li>
</ol>
<p>Pour la photo, tu as trois choix : la « Bibliothèque IRLY », « Mes photos » ou « Surprends-moi ». Le champ de description suggère quoi écrire : ce que vous ferez, le niveau, quoi apporter, où se retrouver. Le dernier bouton publie ; il indique « Créer l’activité », ou l’équivalent pour un événement, un voyage, etc., selon le type choisi.</p>`,
      },
      {
        h2: 'Qui peut la voir',
        html: `<p>Le formulaire propose quatre réglages :</p>
<ul>
<li><strong>Public.</strong> L’activité est ouverte aux membres.</li>
<li><strong>Abonnements mutuels.</strong> Pour les personnes que tu suis et qui te suivent en retour.</li>
<li><strong>Communauté.</strong> Pour une communauté dont tu fais partie ; le formulaire te demande laquelle.</li>
<li><strong>Sur invitation.</strong> Pour les personnes que tu invites.</li>
</ul>
<p>Il n’y a pas d’option « entre femmes » dans l’appli principale. Une activité créée depuis <a href="/fr/girl">IRLY Girl</a>, l’espace réservé aux femmes, est réservée aux femmes : seules les membres femmes peuvent la voir et la rejoindre.</p>`,
      },
      {
        h2: 'Après la publication',
        html: `<p>L’activité est en ligne aussitôt, et son chat est créé en même temps. Ensuite :</p>
<ul>
<li><strong>Les gens la rejoignent</strong> avec « Rejoindre l’activité ». Quand le nombre de places est atteint, le bouton affiche « Complet ». Une personne qui se désiste libère sa place.</li>
<li><strong>Tous les participants sont dans le chat de l’activité.</strong> C’est là que tu partages le point de rendez-vous exact : la page n’affiche que le quartier, ou le lieu que tu as nommé.</li>
<li><strong>Tu peux la partager</strong> avec « Partager dans un chat », par exemple dans le chat d’une communauté dont tu fais partie.</li>
<li><strong>Tu peux la modifier.</strong> « Gérer ton activité » permet de changer le nom, la date, le lieu, la description, le prix et les places. « Annuler l’activité » prévient les participants ; « Supprimer l’activité » la retire.</li>
</ul>`,
      },
      {
        h2: 'La proposer dans une communauté',
        html: `<p>Dans l’espace Activités de chaque communauté, « Proposer une activité » ouvre le même formulaire, déjà rattaché à cette communauté. L’activité apparaît alors dans l’agenda de la communauté, et les membres la voient là où ils regardent déjà. Dans les publications d’une communauté, un message qui ressemble à un plan peut aussi être transformé en activité.</p>
<p>Si tu n’es pas encore dans une communauté, lis <a href="../rejoindre-une-communaute/">comment rejoindre une communauté sur IRLY</a>.</p>`,
      },
      {
        h2: 'Nos conseils pour une première activité où les gens viennent vraiment',
        html: `<ul>
<li><strong>Donne-lui un nom clair.</strong> « Padel débutants, samedi matin » dit tout ; « On se voit ? » ne dit rien. On doit comprendre en une ligne ce qu’on va faire et si c’est pour soi.</li>
<li><strong>Fixe l’heure et le lieu.</strong> « Un soir cette semaine » n’obtient aucune réponse. Un jour, une heure et un quartier obtiennent un oui ou un non.</li>
<li><strong>Garde un petit groupe.</strong> Une poignée de personnes peuvent toutes se parler ; une foule se divise en inconnus. Mieux vaut un petit groupe complet qu’un grand groupe à moitié vide.</li>
<li><strong>Choisis quelque chose de facile à rejoindre.</strong> Une balade, un café, une séance pour débutants : une activité sans barrière, dans un lieu public, où il est normal d’arriver seul.</li>
<li><strong>Écris les détails pratiques.</strong> Le niveau, quoi apporter, combien de temps ça dure, s’il y a un coût. Chaque question sans réponse est une raison de ne pas venir.</li>
<li><strong>Annonce-la quelques jours à l’avance,</strong> et dis un mot dans le chat la veille. Un court rappel avec le point de rendez-vous aide ceux qui hésitent.</li>
<li><strong>Recommence.</strong> La même activité à la même heure la semaine suivante : c’est comme ça qu’un plan devient un groupe.</li>
</ul>
<p>Pour des idées de formats, vois nos <a href="../../dubai/activites-de-groupe/">activités de groupe pour rencontrer du monde à Dubaï</a>, et pour la suite, <a href="../../blog/creer-un-petit-groupe-balade-club-lecture/">comment créer un petit groupe</a>.</p>`,
      },
      {
        h2: 'Le jour J',
        html: `<p>Arrive le premier, et dis dans le chat où tu es exactement et comment tu es habillé. Accueille chacun par son prénom, présente les gens les uns aux autres, et n’attends pas trop longtemps les retardataires. Si deux personnes seulement viennent, fais l’activité quand même : deux personnes qui ont passé un bon moment, c’est le début de la suivante. Ensuite, remercie tout le monde dans le chat et donne la prochaine date tant que l’envie est là.</p>`,
      },
    ],
    faq: [
      { q: 'Comment créer une activité sur IRLY ?', a: 'Sur l’Accueil, touche « Créer », choisis un type, puis suis les quatre étapes : l’activité, quand et où, qui peut la voir, et combien de personnes. La publication crée la page de l’activité et son chat.' },
      { q: 'Une activité sur IRLY a-t-elle un chat de groupe ?', a: 'Oui. Un chat est créé avec chaque activité, et toutes les personnes qui la rejoignent y sont. Le point de rendez-vous exact y est partagé.' },
      { q: 'Qui peut voir mon activité ?', a: 'Tu choisis : Public, Abonnements mutuels, Communauté ou Sur invitation. Une activité créée dans IRLY Girl est réservée aux femmes.' },
      { q: 'Peut-on limiter le nombre de participants ?', a: 'Oui. Tu fixes le nombre de places, ou tu choisis Illimité. Quand les places sont prises, l’activité est affichée comme complète.' },
      { q: 'Peut-on modifier ou annuler son activité ?', a: 'Oui. « Gérer ton activité » permet de la modifier, de l’annuler ou de la supprimer. Les participants sont prévenus quand une activité est annulée.' },
      { q: 'Combien de personnes inviter à une première activité ?', a: 'Reste sur un petit groupe. Une poignée de personnes peuvent toutes se parler, et un petit groupe complet donne envie de recommencer.' },
    ],
    cta: { title: 'Une idée pour cette semaine ?', body: 'Ouvre IRLY, touche « Créer » et publie un plan simple : un nom clair, une heure, un lieu, un petit groupe.', label: 'Découvrir IRLY' },
    related: [
      { label: 'Comment rejoindre une communauté sur IRLY ?', path: 'fr/irly/rejoindre-une-communaute/' },
      { label: 'Comment fonctionne IRLY ?', path: 'fr/irly/comment-ca-marche/' },
      { label: 'Activités de groupe pour rencontrer du monde à Dubaï', path: 'fr/dubai/activites-de-groupe/' },
      { label: 'Créer un petit groupe', path: 'fr/blog/creer-un-petit-groupe-balade-club-lecture/' },
    ],
  },
  {
    lang: 'en',
    pair: 'irly-compare',
    path: 'irly/irly-vs-other-ways-to-meet-people/',
    cover: 'dubaiMarina',
    city: 'IRLY',
    published: '2026-11-12',
    title: 'IRLY vs Other Ways to Meet People in Dubai | IRLY',
    description: 'A fair comparison of IRLY with event platforms, messaging groups, dating apps with a friends mode, clubs, sport-booking apps and going out alone in Dubai.',
    h1: 'IRLY vs other ways to meet people in Dubai',
    lead: 'IRLY is one way among several to meet people in Dubai, next to event platforms, messaging-group communities, dating apps with a friends mode, associations and clubs, sport-booking apps, and simply going out alone. Each of them is the better choice in some situations. IRLY suits you if you want friendship rather than dating, small groups around shared interests, and one place for the community, the activity and its chat.',
    sections: [
      {
        h2: 'How to read this comparison',
        html: `<p>This page compares types of solutions, not products: no app or organisation is named, and nothing here is a claim about a particular one. For each type you will find what it is good at, its limits, and when it is a better choice than IRLY. Four questions run through the page:</p>
<ul>
<li><strong>Does it lead to a real meeting,</strong> or mostly to messages?</li>
<li><strong>Do you see the same people again?</strong> Friendship needs repetition more than novelty.</li>
<li><strong>Is the purpose clear?</strong> Friendship, dating, business or sport.</li>
<li><strong>How much does it ask of you?</strong> Organising, travelling, arriving alone.</li>
</ul>
<p>For how to pick among apps in particular, see <a href="../../dubai/app-to-make-friends/">apps to make friends in Dubai: how to choose</a>.</p>`,
      },
      {
        h2: 'Event platforms and messaging-group communities',
        html: `<h3>Event platforms</h3>
<ul>
<li><strong>Good at:</strong> showing what is on this week, by date and theme, in a city where a lot happens.</li>
<li><strong>Limits:</strong> you often meet different people each time, and a large event can be attended without speaking to anyone.</li>
<li><strong>Better than IRLY when:</strong> you are looking for a specific kind of event, a talk, a concert, a large meetup, or when you want the widest choice of dates.</li>
</ul>
<h3>Messaging-group communities</h3>
<ul>
<li><strong>Good at:</strong> local information and quick answers, by neighbourhood, nationality, profession or sport.</li>
<li><strong>Limits:</strong> large groups are noisy, plans get lost in the conversation, and joining a group is not the same as meeting its members.</li>
<li><strong>Better than IRLY when:</strong> the community you want already lives there, for example your building, your school or your country’s group, or when you mainly need practical advice.</li>
</ul>`,
      },
      {
        h2: 'Dating apps with a friends mode and sport-booking apps',
        html: `<h3>Dating apps with a friends mode</h3>
<ul>
<li><strong>Good at:</strong> one-to-one introductions, at your own pace, with a profile to read first.</li>
<li><strong>Limits:</strong> the format was designed for dating; a first coffee with a stranger can feel like an interview, and one contact at a time builds a circle slowly.</li>
<li><strong>Better than IRLY when:</strong> you prefer one-to-one to groups, and of course when you are looking for a partner: IRLY is not made for that.</li>
</ul>
<h3>Sport-booking apps</h3>
<ul>
<li><strong>Good at:</strong> getting you on a court or into a class. The activity is organised for you, and open games need extra players.</li>
<li><strong>Limits:</strong> the aim is the game. People often leave when it ends, and nothing invites you to see them again unless you ask.</li>
<li><strong>Better than IRLY when:</strong> sport is your way in and you want to play this week, at your level, without organising anything.</li>
</ul>`,
      },
      {
        h2: 'Associations and clubs, and going out alone',
        html: `<h3>Associations and clubs</h3>
<ul>
<li><strong>Good at:</strong> regularity. The same people, the same day, every week, with an organiser and a history. This is where many lasting friendships in Dubai begin.</li>
<li><strong>Limits:</strong> some ask for a membership or a commitment, the calendar is theirs, and a long-established group can take a few visits to open up.</li>
<li><strong>Better than IRLY when:</strong> one exists for your language, your sport or your profession. Join it first. Our guides to <a href="../../dubai/expat-communities/">expat communities</a> and <a href="../../dubai/networking/">networking in Dubai</a> describe them.</li>
</ul>
<h3>Going out alone</h3>
<ul>
<li><strong>Good at:</strong> freedom. No app, no schedule, and places such as a class, a market or a regular café bring chance encounters.</li>
<li><strong>Limits:</strong> it depends on luck and on your energy that day, and meeting the same person twice is not guaranteed.</li>
<li><strong>Better than IRLY when:</strong> you enjoy it and you have time. See <a href="../../dubai/going-out-alone/">going out alone in Dubai</a>.</li>
</ul>`,
      },
      {
        h2: 'What IRLY does differently',
        html: `<p>IRLY combines three things that are often separate: the community, the activity and the conversation.</p>
<ul>
<li><strong>Communities you join in one tap,</strong> IRLY’s own and the ones members start, each with its posts, its chat, its activities and its members.</li>
<li><strong>Activities anyone can create,</strong> with a date, a neighbourhood, a number of spots and a chat that opens for the people who join.</li>
<li><strong>A clear purpose.</strong> Friendship, not dating. IRLY Girl is a space reserved for women, and IRLY Network is the part for professional meetings.</li>
<li><strong>Two languages.</strong> The app is written in English and in French.</li>
<li><strong>Tools to report and block,</strong> on activities, communities, messages and profiles.</li>
</ul>
<p>It is free. The details are in <a href="../what-is-irly/">what is IRLY?</a> and <a href="../how-it-works/">how IRLY works</a>.</p>`,
      },
      {
        h2: 'Where IRLY is not the right tool',
        html: `<ul>
<li><strong>If you want activity everywhere, today.</strong> IRLY is new. Depending on your interests and your area, you may find few communities or activities for now, and you may have to create the first one yourself.</li>
<li><strong>If you want an app from a store.</strong> IRLY works in the browser for now, as a web app. iOS and Android apps are coming soon, but they are not there yet.</li>
<li><strong>If you are looking for a partner.</strong> IRLY is for friendship, not dating.</li>
<li><strong>If you live outside the UAE.</strong> IRLY is centred on Dubai and the other emirates.</li>
<li><strong>If you only want to book.</strong> To reserve a court or buy a ticket, a booking tool does it better.</li>
<li><strong>If your language is neither English nor French.</strong> The app exists in those two languages only.</li>
</ul>`,
      },
      {
        h2: 'In practice: combine two or three',
        html: `<p>These solutions do not exclude each other, and most people who build a circle in Dubai use several. A combination that works: one regular commitment (a club, an association or a weekly session), one tool to find small groups and plans around your interests, and the habit of saying yes when someone suggests a coffee afterwards.</p>
<p>Judge each by one result: did it get you to a real meeting with people you would like to see again? Keep what does, and drop the rest. Our guide on <a href="../../dubai/make-friends/">how to make friends in Dubai</a> gives a plan for the first four weeks.</p>`,
      },
    ],
    faq: [
      { q: 'Is IRLY better than other apps to meet people in Dubai?', a: 'Not for everyone. IRLY suits people who want friendship, small groups and shared interests. Event platforms, clubs or sport-booking apps are a better choice in other situations.' },
      { q: 'What is the difference between IRLY and a dating app?', a: 'IRLY is made for friendship and group activities, not for finding a partner. If you are looking for a relationship, a dating app is the right tool.' },
      { q: 'Should I use IRLY or join a club?', a: 'Both can go together. If a club or an association exists for your sport, language or profession, join it. IRLY can add small groups and plans around your other interests.' },
      { q: 'What are the limits of IRLY?', a: 'IRLY is new, it works in the browser for now, it is centred on Dubai and the UAE, it exists in English and French only, and it is not made for dating.' },
      { q: 'Can I use several solutions at once?', a: 'Yes, and it is what most people do. Keep the two or three that really lead you to meet people in person.' },
    ],
    cta: { title: 'Want to see whether IRLY fits you?', body: 'Open IRLY in your browser, look at the communities around your interests, and judge for yourself.', label: 'Discover IRLY' },
    related: [
      { label: 'What is IRLY?', path: 'irly/what-is-irly/' },
      { label: 'Apps to make friends in Dubai: how to choose', path: 'dubai/app-to-make-friends/' },
      { label: 'Expat communities in Dubai: how to find yours', path: 'dubai/expat-communities/' },
      { label: 'How to make friends in Dubai', path: 'dubai/make-friends/' },
    ],
  },
  {
    lang: 'fr',
    pair: 'irly-compare',
    path: 'fr/irly/irly-et-les-autres-solutions/',
    cover: 'dubaiMarina',
    city: 'IRLY',
    published: '2026-11-12',
    title: 'Rencontrer du monde à Dubaï : IRLY et les autres | IRLY',
    description: 'Une comparaison honnête d’IRLY avec les plateformes d’événements, les groupes de messagerie, les applis de rencontres, les clubs et les applis de sport.',
    h1: 'IRLY et les autres façons de rencontrer du monde à Dubaï',
    lead: 'IRLY est une façon parmi d’autres de rencontrer du monde à Dubaï, à côté des plateformes d’événements, des communautés sur messagerie, des applis de rencontres avec un mode amis, des associations et clubs, des applis de réservation sportive, ou simplement des sorties en solo. Chacune est le meilleur choix dans certaines situations. IRLY te convient si tu cherches l’amitié plutôt que l’amour, de petits groupes autour d’intérêts communs, et un seul endroit pour la communauté, l’activité et son chat.',
    sections: [
      {
        h2: 'Comment lire cette comparaison',
        html: `<p>Cette page compare des types de solutions, pas des produits : aucune appli ni organisation n’est nommée, et rien ici ne vise un service en particulier. Pour chaque type, tu trouveras ce qu’il fait bien, ses limites, et dans quel cas il vaut mieux qu’IRLY. Quatre questions guident la page :</p>
<ul>
<li><strong>Est-ce que ça mène à une vraie rencontre,</strong> ou surtout à des messages ?</li>
<li><strong>Revois-tu les mêmes personnes ?</strong> L’amitié a plus besoin de répétition que de nouveauté.</li>
<li><strong>L’objectif est-il clair ?</strong> Amitié, amour, travail ou sport.</li>
<li><strong>Qu’est-ce que ça te demande ?</strong> Organiser, te déplacer, arriver seul.</li>
</ul>
<p>Pour choisir parmi les applis en particulier, vois <a href="../../dubai/application-pour-se-faire-des-amis/">quelle appli pour se faire des amis à Dubaï</a>.</p>`,
      },
      {
        h2: 'Plateformes d’événements et communautés sur messagerie',
        html: `<h3>Les plateformes d’événements</h3>
<ul>
<li><strong>Points forts :</strong> montrer ce qui se passe cette semaine, par date et par thème, dans une ville où il se passe beaucoup de choses.</li>
<li><strong>Limites :</strong> on y croise souvent des personnes différentes à chaque fois, et on peut traverser un grand événement sans parler à personne.</li>
<li><strong>Mieux qu’IRLY quand :</strong> tu cherches un type d’événement précis, une conférence, un concert, un grand meetup, ou quand tu veux le plus large choix de dates.</li>
</ul>
<h3>Les communautés sur messagerie</h3>
<ul>
<li><strong>Points forts :</strong> l’information locale et les réponses rapides, par quartier, nationalité, métier ou sport.</li>
<li><strong>Limites :</strong> les grands groupes sont bruyants, les plans se perdent dans la conversation, et rejoindre un groupe n’est pas rencontrer ses membres.</li>
<li><strong>Mieux qu’IRLY quand :</strong> la communauté que tu cherches y vit déjà, par exemple ton immeuble, ton école ou le groupe de ton pays, ou quand tu as surtout besoin de conseils pratiques.</li>
</ul>`,
      },
      {
        h2: 'Applis de rencontres avec un mode amis et applis de réservation sportive',
        html: `<h3>Les applis de rencontres avec un mode amis</h3>
<ul>
<li><strong>Points forts :</strong> les mises en relation en tête-à-tête, à ton rythme, avec un profil à lire d’abord.</li>
<li><strong>Limites :</strong> le format a été pensé pour les rencontres amoureuses ; un premier café avec un inconnu peut ressembler à un entretien, et un contact à la fois construit un cercle lentement.</li>
<li><strong>Mieux qu’IRLY quand :</strong> tu préfères le tête-à-tête aux groupes, et bien sûr quand tu cherches un ou une partenaire : IRLY n’est pas faite pour ça.</li>
</ul>
<h3>Les applis de réservation sportive</h3>
<ul>
<li><strong>Points forts :</strong> te mettre sur un terrain ou dans un cours. L’activité est organisée pour toi, et les parties ouvertes cherchent des joueurs.</li>
<li><strong>Limites :</strong> le but, c’est la partie. Les gens repartent souvent à la fin, et rien ne t’invite à les revoir si tu ne le proposes pas.</li>
<li><strong>Mieux qu’IRLY quand :</strong> le sport est ta porte d’entrée et que tu veux jouer cette semaine, à ton niveau, sans rien organiser.</li>
</ul>`,
      },
      {
        h2: 'Associations et clubs, et sorties en solo',
        html: `<h3>Les associations et les clubs</h3>
<ul>
<li><strong>Points forts :</strong> la régularité. Les mêmes personnes, le même jour, chaque semaine, avec un organisateur et une histoire. C’est là que commencent beaucoup d’amitiés durables à Dubaï.</li>
<li><strong>Limites :</strong> certains demandent une adhésion ou un engagement, le calendrier est le leur, et un groupe installé depuis longtemps peut demander quelques visites avant de s’ouvrir.</li>
<li><strong>Mieux qu’IRLY quand :</strong> il en existe un pour ta langue, ton sport ou ton métier. Rejoins-le d’abord. Nos guides sur les <a href="../../dubai/communautes-expatries/">communautés d’expatriés</a> et le <a href="../../dubai/networking/">networking à Dubaï</a> les décrivent.</li>
</ul>
<h3>Sortir seul</h3>
<ul>
<li><strong>Points forts :</strong> la liberté. Pas d’appli, pas d’horaire, et des lieux comme un cours, un marché ou un café où tu as tes habitudes amènent des rencontres de hasard.</li>
<li><strong>Limites :</strong> ça dépend de la chance et de ton énergie du jour, et rien ne garantit de recroiser la même personne.</li>
<li><strong>Mieux qu’IRLY quand :</strong> tu aimes ça et que tu as du temps. Voir <a href="../../dubai/sortir-seul/">sortir seul à Dubaï</a>.</li>
</ul>`,
      },
      {
        h2: 'Ce qu’IRLY fait différemment',
        html: `<p>IRLY réunit trois choses souvent séparées : la communauté, l’activité et la conversation.</p>
<ul>
<li><strong>Des communautés que tu rejoins en un geste,</strong> celles d’IRLY et celles créées par les membres, chacune avec ses publications, son chat, ses activités et ses membres.</li>
<li><strong>Des activités que chacun peut créer,</strong> avec une date, un quartier, un nombre de places et un chat qui s’ouvre pour ceux qui la rejoignent.</li>
<li><strong>Un objectif clair.</strong> L’amitié, pas l’amour. IRLY Girl est un espace réservé aux femmes, et IRLY Network est la partie consacrée aux rencontres professionnelles.</li>
<li><strong>Deux langues.</strong> L’appli est écrite en français et en anglais.</li>
<li><strong>Des outils pour signaler et bloquer,</strong> sur les activités, les communautés, les messages et les profils.</li>
</ul>
<p>Elle est gratuite. Les détails sont dans <a href="../c-est-quoi/">IRLY, c’est quoi ?</a> et <a href="../comment-ca-marche/">comment fonctionne IRLY</a>.</p>`,
      },
      {
        h2: 'Là où IRLY n’est pas le bon outil',
        html: `<ul>
<li><strong>Si tu veux de l’activité partout, tout de suite.</strong> IRLY est récente. Selon tes centres d’intérêt et ton quartier, tu peux trouver peu de communautés ou d’activités pour l’instant, et devoir créer la première toi-même.</li>
<li><strong>Si tu veux une appli à installer depuis un store.</strong> IRLY fonctionne pour l’instant dans le navigateur, en application web. Les applications iOS et Android arrivent bientôt, mais elles ne sont pas encore là.</li>
<li><strong>Si tu cherches un ou une partenaire.</strong> IRLY est faite pour l’amitié, pas pour les rencontres amoureuses.</li>
<li><strong>Si tu vis hors des Émirats.</strong> IRLY est centrée sur Dubaï et les autres émirats.</li>
<li><strong>Si tu veux seulement réserver.</strong> Pour réserver un terrain ou acheter un billet, un outil de réservation le fait mieux.</li>
<li><strong>Si ta langue n’est ni le français ni l’anglais.</strong> L’appli n’existe que dans ces deux langues.</li>
</ul>`,
      },
      {
        h2: 'En pratique : combines-en deux ou trois',
        html: `<p>Ces solutions ne s’excluent pas, et la plupart des gens qui se construisent un cercle à Dubaï en utilisent plusieurs. Une combinaison qui marche : un engagement régulier (un club, une association ou une séance hebdomadaire), un outil pour trouver de petits groupes et des plans autour de tes centres d’intérêt, et l’habitude de dire oui quand quelqu’un propose un café après.</p>
<p>Juge chacune à un seul résultat : t’a-t-elle amené à une vraie rencontre avec des gens que tu aimerais revoir ? Garde ce qui marche, laisse le reste. Notre guide pour <a href="../../dubai/se-faire-des-amis/">se faire des amis à Dubaï</a> propose un plan pour les quatre premières semaines.</p>`,
      },
    ],
    faq: [
      { q: 'IRLY est-elle meilleure que les autres applis pour rencontrer du monde à Dubaï ?', a: 'Pas pour tout le monde. IRLY convient à ceux qui cherchent l’amitié, de petits groupes et des intérêts communs. Les plateformes d’événements, les clubs ou les applis de réservation sportive sont un meilleur choix dans d’autres situations.' },
      { q: 'Quelle différence entre IRLY et une appli de rencontres ?', a: 'IRLY est faite pour l’amitié et les activités de groupe, pas pour trouver un ou une partenaire. Si tu cherches une relation amoureuse, une appli de rencontres est le bon outil.' },
      { q: 'Vaut-il mieux utiliser IRLY ou rejoindre un club ?', a: 'Les deux vont ensemble. S’il existe un club ou une association pour ton sport, ta langue ou ton métier, rejoins-le. IRLY peut ajouter de petits groupes et des plans autour de tes autres centres d’intérêt.' },
      { q: 'Quelles sont les limites d’IRLY ?', a: 'IRLY est récente, elle fonctionne pour l’instant dans le navigateur, elle est centrée sur Dubaï et les Émirats, elle n’existe qu’en français et en anglais, et elle n’est pas faite pour les rencontres amoureuses.' },
      { q: 'Peut-on utiliser plusieurs solutions à la fois ?', a: 'Oui, et c’est ce que font la plupart des gens. Garde les deux ou trois qui t’amènent vraiment à voir des gens en vrai.' },
    ],
    cta: { title: 'Envie de voir si IRLY te convient ?', body: 'Ouvre IRLY dans ton navigateur, regarde les communautés autour de tes centres d’intérêt, et juge par toi-même.', label: 'Découvrir IRLY' },
    related: [
      { label: 'IRLY, c’est quoi ?', path: 'fr/irly/c-est-quoi/' },
      { label: 'Quelle appli pour se faire des amis à Dubaï ?', path: 'fr/dubai/application-pour-se-faire-des-amis/' },
      { label: 'Rejoindre une communauté d’expatriés à Dubaï', path: 'fr/dubai/communautes-expatries/' },
      { label: 'Comment se faire des amis à Dubaï', path: 'fr/dubai/se-faire-des-amis/' },
    ],
  },
  {
    lang: 'en',
    pair: 'dubai-with-friends',
    path: 'dubai/things-to-do-with-friends/',
    cover: 'volleyball',
    city: 'Dubai',
    published: '2026-11-12',
    title: 'Things to Do in Dubai With Friends: Ideas by Moment | IRLY',
    description: 'Ideas for things to do in Dubai with friends: weekday evenings, weekend mornings, summer indoors, low budget, mixed tastes, and how to widen a small group.',
    h1: 'Things to do in Dubai with friends',
    lead: 'The easiest way to choose is by moment: something short and close on a weekday evening, something outdoors and early on a weekend morning, something indoors in summer. With a friend or two, the good plans are the ones you can repeat without much organising. And if your group is small, a plan that is open to a few more people is also how it grows.',
    sections: [
      {
        h2: 'Choose by moment, not by list',
        html: `<p>Long lists of “things to do” rarely help a small group decide. Three questions do: how much time you have, what the weather allows, and how much energy everyone has left. Dubai adds two constraints of its own. Distances are long, so a plan near where most of you live gets more yeses than a better plan far away. And the seasons are marked: the cooler months are for the outdoors, the hot months for early mornings, evenings and indoor places.</p>
<p>This page is for people who already have a friend or two. If you are looking for people first, start with our <a href="../group-activities/">15 group activities to meet people in Dubai</a>; and if you want to choose by passion, see <a href="../activities/">activities in Dubai by interest</a>.</p>`,
      },
      {
        h2: 'A weekday evening',
        html: `<p>After work, the plan has to be short, close and easy to leave.</p>
<ul>
<li><strong>A walk and something to eat.</strong> A promenade by the water or a park after sunset, then a simple dinner nearby.</li>
<li><strong>An hour of sport.</strong> A padel game, a five-a-side match, a climbing session or a class you book together.</li>
<li><strong>A games evening.</strong> Board games or cards at someone’s home or in a café that lends them.</li>
<li><strong>Cooking for each other.</strong> Each person brings one dish, or you all cook the same recipe.</li>
<li><strong>A show.</strong> A film, a comedy night, a small concert or a quiz night.</li>
</ul>
<p>Pick one evening and keep it. “Tuesdays” is easier to protect in everyone’s diary than a new date each week.</p>`,
      },
      {
        h2: 'A weekend morning',
        html: `<p>Mornings are the most pleasant part of the day in Dubai for much of the year, and a plan that starts early leaves the rest of the day free.</p>
<ul>
<li><strong>The beach, early.</strong> A swim, a game of beach volleyball, or paddleboarding while the water is calm.</li>
<li><strong>A run or a ride.</strong> A route by the sea or on a cycling track, at the pace of the slowest of you. If you want company, read <a href="../running-clubs/">how to join a social running club</a>.</li>
<li><strong>The desert or the mountains.</strong> A sunrise walk in the dunes or a hike in the mountains in the cooler months. Go with enough water, proper shoes, and someone who knows the route.</li>
<li><strong>A market and a long breakfast.</strong> A weekend market, then a table where nobody is in a hurry.</li>
<li><strong>Something new together.</strong> A first lesson, kayaking, pottery or a dance class, is more fun when nobody in the group is good at it.</li>
</ul>`,
      },
      {
        h2: 'In summer, indoors',
        html: `<p>When it is too hot to stay outside, the city moves indoors, and there is a lot to choose from.</p>
<ul>
<li><strong>Indoor sport.</strong> Climbing and bouldering, indoor padel or badminton, bowling, ice skating, trampolines.</li>
<li><strong>Games that need a team.</strong> Escape rooms, karaoke, arcades, quiz nights.</li>
<li><strong>Making something.</strong> A cooking class, a ceramics or painting workshop, a baking afternoon at home.</li>
<li><strong>Culture.</strong> Museums, galleries and exhibitions.</li>
<li><strong>Very early or very late.</strong> A walk at sunrise or after dark is still possible on many days, if you keep it short.</li>
</ul>`,
      },
      {
        h2: 'On a low budget',
        html: `<p>Seeing friends often matters more than what you do, and plans that cost little are the ones you can repeat every week.</p>
<ul>
<li><strong>Public beaches and parks.</strong> A picnic, a ball, a speaker, a sunset.</li>
<li><strong>Walks.</strong> The old quarters, the waterfront promenades, a neighbourhood none of you knows yet.</li>
<li><strong>At home.</strong> A potluck, a film night, a games tournament, cooking a dish from each person’s country.</li>
<li><strong>Free community sessions.</strong> Many running groups and outdoor fitness sessions welcome anyone.</li>
</ul>
<p>More ideas in <a href="../free-social-activities/">free social activities in Dubai</a>. One habit helps: say the expected cost when you propose a plan, so that nobody has to ask.</p>`,
      },
      {
        h2: 'When tastes differ',
        html: `<p>One of you likes sport, another food, a third would rather stay at home. A few ways to keep everyone:</p>
<ul>
<li><strong>Take turns.</strong> Each person chooses in turn, and the others come without negotiating.</li>
<li><strong>Combine two halves.</strong> Something active, then something to eat. Those who skip the first part join for the second.</li>
<li><strong>Choose activities with several levels.</strong> A walk, bowling, a beach day or a market suit almost everyone; a long hike or a competitive match do not.</li>
<li><strong>Settle the practical points early.</strong> Place, time, cost, and whether alcohol or late hours are involved, so that each person can say yes or no without awkwardness.</li>
<li><strong>Accept that not everyone comes every time.</strong> A group holds together when turning down one plan is simple.</li>
</ul>`,
      },
      {
        h2: 'When your group is small: how to find more people',
        html: `<p>Two or three friends are enough for most of these ideas, but some need more players, and a group in Dubai shrinks every time someone moves away. A few ways to widen it:</p>
<ul>
<li><strong>Each brings one person.</strong> A colleague, a neighbour, a flatmate.</li>
<li><strong>Join an existing group together.</strong> A running club, an open padel game, a class. Arriving with a friend makes the first time easier.</li>
<li><strong>Open your own plan.</strong> Say where you already talk, a building group, a team chat or a community, that there are places left.</li>
<li><strong>Make it regular.</strong> People join more easily something that happens every week than a one-off.</li>
</ul>
<p>IRLY is one option for this: a free app, not a dating app, where you can publish your plan as an activity with a date, a neighbourhood and a number of spots, and where the people who join find themselves in its group chat. It works today in the browser, and iOS and Android apps are coming soon. See <a href="../../irly/create-an-activity/">how to organise an activity on IRLY</a>. For the wider picture, read <a href="../make-friends/">how to make friends in Dubai</a>.</p>`,
      },
    ],
    faq: [
      { q: 'What can you do in Dubai with friends on a weekday evening?', a: 'Keep it short and close to home: a walk and a simple dinner, an hour of padel or climbing, a games evening, a film or a quiz night.' },
      { q: 'What can a group of friends do in Dubai in summer?', a: 'Move indoors: climbing, bowling, ice skating, escape rooms, cooking classes, workshops and museums. Early mornings and late evenings still allow a short walk on many days.' },
      { q: 'What can friends do in Dubai without spending much?', a: 'Public beaches and parks, walks in the old quarters or along the waterfront, potlucks and games nights at home, and free community sport sessions.' },
      { q: 'How do you plan something when everyone likes different things?', a: 'Take turns choosing, combine an activity with a meal, and pick plans with several levels, such as a walk, a beach day or bowling.' },
      { q: 'We are only two or three. How do we find more people?', a: 'Each of you brings one person, you join an existing group together, or you open your plan to others where you already talk, including on an app such as IRLY.' },
    ],
    cta: { title: 'A plan with places left?', body: 'Looking to meet new people in Dubai? Discover IRLY and connect through activities and communities.', label: 'Discover IRLY' },
    related: [
      { label: '15 group activities to meet people in Dubai', path: 'dubai/group-activities/' },
      { label: 'Activities in Dubai by interest', path: 'dubai/activities/' },
      { label: 'Free social activities in Dubai', path: 'dubai/free-social-activities/' },
      { label: 'How to organise an activity on IRLY', path: 'irly/create-an-activity/' },
    ],
  },
  {
    lang: 'fr',
    pair: 'dubai-with-friends',
    path: 'fr/dubai/sorties-entre-amis/',
    cover: 'volleyball',
    city: 'Dubaï',
    published: '2026-11-12',
    title: 'Que faire à Dubaï entre amis ? Idées par moment | IRLY',
    description: 'Des idées de sorties entre amis à Dubaï : soir de semaine, matin de week-end, été en intérieur, petit budget, goûts différents, et comment agrandir le groupe.',
    h1: 'Que faire à Dubaï entre amis ?',
    lead: 'Le plus simple est de choisir selon le moment : quelque chose de court et de proche un soir de semaine, quelque chose en plein air et de bonne heure un matin de week-end, quelque chose en intérieur l’été. À deux ou trois, les bons plans sont ceux qu’on peut refaire sans grande organisation. Et si votre groupe est petit, un plan ouvert à quelques personnes de plus est aussi la façon de l’agrandir.',
    sections: [
      {
        h2: 'Choisir selon le moment, pas dans une liste',
        html: `<p>Les longues listes de « choses à faire » aident rarement un petit groupe à se décider. Trois questions, si : combien de temps vous avez, ce que la météo permet, et l’énergie qu’il reste à chacun. Dubaï ajoute deux contraintes. Les distances sont longues : un plan près de chez la plupart d’entre vous obtient plus de oui qu’un meilleur plan à l’autre bout de la ville. Et les saisons sont marquées : les mois frais sont faits pour le plein air, les mois chauds pour le petit matin, le soir et les lieux climatisés.</p>
<p>Cette page s’adresse à ceux qui ont déjà un ami ou deux. Si tu cherches d’abord des gens, commence par nos <a href="../activites-de-groupe/">15 activités de groupe pour rencontrer du monde à Dubaï</a> ; et si tu veux choisir par passion, vois les <a href="../activites/">activités à Dubaï par centre d’intérêt</a>.</p>`,
      },
      {
        h2: 'Un soir de semaine',
        html: `<p>Après le travail, le plan doit être court, proche et facile à quitter.</p>
<ul>
<li><strong>Une balade et un repas.</strong> Une promenade au bord de l’eau ou un parc après le coucher du soleil, puis un dîner simple à côté.</li>
<li><strong>Une heure de sport.</strong> Une partie de padel, un foot à cinq, une séance d’escalade ou un cours réservé ensemble.</li>
<li><strong>Une soirée jeux.</strong> Jeux de société ou cartes chez l’un de vous, ou dans un café qui en prête.</li>
<li><strong>Cuisiner les uns pour les autres.</strong> Chacun apporte un plat, ou vous cuisinez tous la même recette.</li>
<li><strong>Un spectacle.</strong> Un film, une soirée stand-up, un petit concert ou un quiz.</li>
</ul>
<p>Choisissez un soir et gardez-le. « Le mardi » se défend mieux dans l’agenda de chacun qu’une nouvelle date chaque semaine.</p>`,
      },
      {
        h2: 'Un matin de week-end',
        html: `<p>Le matin est le moment le plus agréable de la journée à Dubaï une bonne partie de l’année, et un plan qui commence tôt laisse le reste de la journée libre.</p>
<ul>
<li><strong>La plage, de bonne heure.</strong> Une baignade, un beach-volley, ou du paddle tant que l’eau est calme.</li>
<li><strong>Une course ou une sortie à vélo.</strong> Un parcours en bord de mer ou sur une piste cyclable, au rythme du plus lent. Si vous voulez de la compagnie, lis <a href="../clubs-de-running/">comment rejoindre un club de running</a>.</li>
<li><strong>Le désert ou la montagne.</strong> Une marche au lever du soleil dans les dunes ou une randonnée en montagne pendant les mois frais. Partez avec assez d’eau, de bonnes chaussures et quelqu’un qui connaît l’itinéraire.</li>
<li><strong>Un marché et un long petit-déjeuner.</strong> Un marché du week-end, puis une table où personne n’est pressé.</li>
<li><strong>Une première fois ensemble.</strong> Un premier cours, kayak, poterie ou danse, est plus drôle quand personne dans le groupe n’est bon.</li>
</ul>`,
      },
      {
        h2: 'L’été, en intérieur',
        html: `<p>Quand il fait trop chaud pour rester dehors, la ville passe à l’intérieur, et le choix est large.</p>
<ul>
<li><strong>Le sport en salle.</strong> Escalade et bloc, padel ou badminton couverts, bowling, patinoire, trampolines.</li>
<li><strong>Les jeux qui demandent une équipe.</strong> Escape games, karaoké, salles d’arcade, soirées quiz.</li>
<li><strong>Fabriquer quelque chose.</strong> Un cours de cuisine, un atelier de céramique ou de peinture, un après-midi pâtisserie à la maison.</li>
<li><strong>La culture.</strong> Musées, galeries et expositions.</li>
<li><strong>Très tôt ou très tard.</strong> Une marche au lever du soleil ou à la nuit tombée reste possible bien des jours, si elle est courte.</li>
</ul>`,
      },
      {
        h2: 'Avec un petit budget',
        html: `<p>Se voir souvent compte plus que ce qu’on fait, et les plans qui coûtent peu sont ceux qu’on peut refaire chaque semaine.</p>
<ul>
<li><strong>Les plages publiques et les parcs.</strong> Un pique-nique, un ballon, une enceinte, un coucher de soleil.</li>
<li><strong>Les balades.</strong> Les vieux quartiers, les promenades du front de mer, un quartier qu’aucun de vous ne connaît encore.</li>
<li><strong>À la maison.</strong> Un repas partagé, une soirée film, un tournoi de jeux, un plat du pays de chacun.</li>
<li><strong>Les séances gratuites.</strong> Beaucoup de groupes de running et de séances de sport en plein air accueillent tout le monde.</li>
</ul>
<p>D’autres idées dans <a href="../activites-gratuites/">activités gratuites à Dubaï</a>. Une habitude aide : annonce le coût prévu quand tu proposes un plan, pour que personne n’ait à le demander.</p>`,
      },
      {
        h2: 'Quand les goûts diffèrent',
        html: `<p>L’un aime le sport, l’autre la cuisine, le troisième préférerait rester chez lui. Quelques façons de garder tout le monde :</p>
<ul>
<li><strong>Chacun son tour.</strong> Chacun choisit à tour de rôle, et les autres viennent sans négocier.</li>
<li><strong>Deux moitiés.</strong> Quelque chose d’actif, puis un repas. Ceux qui passent la première partie rejoignent pour la seconde.</li>
<li><strong>Des activités à plusieurs niveaux.</strong> Une balade, un bowling, une journée plage ou un marché conviennent à presque tous ; une longue randonnée ou un match disputé, non.</li>
<li><strong>Les points pratiques d’abord.</strong> Le lieu, l’heure, le coût, et s’il y aura de l’alcool ou une soirée tardive, pour que chacun puisse dire oui ou non sans gêne.</li>
<li><strong>Tout le monde ne vient pas à chaque fois.</strong> Un groupe tient quand refuser un plan reste simple.</li>
</ul>`,
      },
      {
        h2: 'Quand le groupe est petit : comment trouver du monde',
        html: `<p>Deux ou trois amis suffisent pour la plupart de ces idées, mais certaines demandent plus de joueurs, et un groupe à Dubaï rétrécit chaque fois que quelqu’un repart. Quelques façons de l’agrandir :</p>
<ul>
<li><strong>Chacun amène une personne.</strong> Un collègue, un voisin, un colocataire.</li>
<li><strong>Rejoindre ensemble un groupe existant.</strong> Un club de running, une partie de padel ouverte, un cours. Arriver avec un ami rend la première fois plus facile.</li>
<li><strong>Ouvrir votre propre plan.</strong> Dites là où vous échangez déjà, un groupe d’immeuble, un chat d’équipe ou une communauté, qu’il reste des places.</li>
<li><strong>Le rendre régulier.</strong> On rejoint plus volontiers ce qui a lieu chaque semaine qu’une sortie isolée.</li>
</ul>
<p>IRLY est une option pour ça : une appli gratuite, qui n’est pas une appli de rencontres amoureuses, où tu peux publier ton plan sous forme d’activité avec une date, un quartier et un nombre de places, et où ceux qui la rejoignent se retrouvent dans son chat de groupe. Elle fonctionne aujourd’hui dans le navigateur, et les applications iOS et Android arrivent bientôt. Voir <a href="../../irly/organiser-une-activite/">comment organiser une activité sur IRLY</a>. Pour la vue d’ensemble, lis <a href="../se-faire-des-amis/">comment se faire des amis à Dubaï</a>.</p>`,
      },
    ],
    faq: [
      { q: 'Que faire à Dubaï entre amis un soir de semaine ?', a: 'Quelque chose de court et de proche : une balade et un dîner simple, une heure de padel ou d’escalade, une soirée jeux, un film ou un quiz.' },
      { q: 'Que faire à Dubaï entre amis en été ?', a: 'Passer à l’intérieur : escalade, bowling, patinoire, escape games, cours de cuisine, ateliers et musées. Tôt le matin et tard le soir, une courte marche reste possible bien des jours.' },
      { q: 'Que faire à Dubaï entre amis sans trop dépenser ?', a: 'Les plages publiques et les parcs, les balades dans les vieux quartiers ou sur le front de mer, les repas partagés et les soirées jeux à la maison, et les séances de sport gratuites.' },
      { q: 'Comment organiser une sortie quand chacun aime des choses différentes ?', a: 'Choisissez à tour de rôle, associez une activité et un repas, et prenez des plans à plusieurs niveaux, comme une balade, une journée plage ou un bowling.' },
      { q: 'Nous ne sommes que deux ou trois. Comment trouver du monde ?', a: 'Chacun amène une personne, vous rejoignez ensemble un groupe existant, ou vous ouvrez votre plan à d’autres là où vous échangez déjà, y compris sur une appli comme IRLY.' },
    ],
    cta: { title: 'Un plan avec des places libres ?', body: 'Envie de rencontrer de nouvelles personnes à Dubaï ? Découvrez IRLY et rejoignez des communautés autour de vos centres d’intérêt.', label: 'Découvrir IRLY' },
    related: [
      { label: '15 activités de groupe pour rencontrer du monde à Dubaï', path: 'fr/dubai/activites-de-groupe/' },
      { label: 'Activités à Dubaï par centre d’intérêt', path: 'fr/dubai/activites/' },
      { label: 'Activités gratuites à Dubaï', path: 'fr/dubai/activites-gratuites/' },
      { label: 'Comment organiser une activité sur IRLY ?', path: 'fr/irly/organiser-une-activite/' },
    ],
  },
];
