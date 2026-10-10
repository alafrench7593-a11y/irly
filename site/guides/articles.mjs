/**
 * Long-form guides for the website, one object per article and language.
 * Facts here are general and stable; anything that changes (visa rules,
 * prices, opening hours) does not belong in these guides. No statistics,
 * no testimonials, no user numbers: advice only.
 *
 * `pair` links the language versions of the same guide (hreflang).
 */
/** Site-wide last update; each guide may carry its own `updated` date. */
export const UPDATED = '2026-10-09';

const app = 'https://getirly.com/app/';

/**
 * Photos of the guides (free stock libraries or IRLY's own), in
 * site/img/guides/<key>.jpg (1200x630, share card) and <key>-800.webp.
 * Alt texts say what is in the picture, never more.
 */
export const PHOTOS = {
  brunch: { en: 'Friends sharing a brunch on a terrace in downtown Dubai', fr: 'Des amies partagent un brunch sur une terrasse du centre de Dubaï', by: 'IRLY', page: null },
  dubaiMarina: { en: 'Dubai Marina towers and the marina walk on a sunny day', fr: 'Les tours et la promenade de Dubai Marina par une journée ensoleillée', by: 'Ameia-Ka (Pixabay)', page: 'https://pixabay.com/photos/dubai-city-architecture-skyscrapers-1351569/' },
  volleyball: { en: 'A group playing beach volleyball at sunset', fr: 'Un groupe joue au beach-volley au coucher du soleil', by: 'Peggy_Marco (Pixabay)', page: 'https://pixabay.com/photos/sunset-volleyball-beach-silhouette-5560658/' },
  surf: { en: 'A surfer walking along the beach with his board at sunset', fr: 'Un surfeur marche sur la plage avec sa planche au coucher du soleil', by: 'mariamza (Pixabay)', page: 'https://pixabay.com/photos/surf-beach-sunset-sea-ocean-4087278/' },
  dubaiCreek: { en: 'A man sitting alone on a terrace by Dubai Creek', fr: 'Un homme assis seul sur une terrasse au bord de Dubai Creek', by: 'katetrysh (Pixabay)', page: 'https://pixabay.com/photos/dubai-creek-waterfront-man-sitting-9060098/' },
  running: { en: 'Two people running side by side', fr: 'Deux personnes courent côte à côte', by: 'IRLY', page: null },
};

export const ARTICLES = [
  {
    lang: 'en',
    pair: 'dubai-friends',
    path: 'dubai/make-friends/',
    cover: 'brunch',
    figure: { photo: 'dubaiMarina', after: 1 },
    city: 'Dubai',
    updated: '2026-10-10',
    title: 'How to Make Friends in Dubai: A Practical Guide for Newcomers | IRLY',
    description: 'New to Dubai and don’t know anyone yet? Why it can feel hard to make friends here, and practical ways to meet people who share your interests.',
    h1: 'How to make friends in Dubai',
    lead: 'Making friends in Dubai is very possible, but it rarely happens by chance: most friendships here start around a shared activity you show up to again and again. Pick two or three things you enjoy, join the groups that do them, and go back every week. Below: why it can feel hard at first, and what works.',
    sections: [
      {
        h2: 'Why it can feel hard at first',
        html: `<p>Feeling alone in a city full of people is common, and it says nothing about you. Dubai has a few traits that make the first months harder:</p>
<ul>
<li><strong>Almost everyone arrived from somewhere else.</strong> People already have friends from work or from their first months, and newcomers keep arriving while others leave.</li>
<li><strong>Distances and the car.</strong> Neighbourhoods are spread out, so seeing someone “just for a coffee” takes more planning than in a walkable city.</li>
<li><strong>Long working weeks.</strong> Many people work a lot, especially at the start, and evenings disappear.</li>
<li><strong>The summer.</strong> From roughly June to September, the heat moves life indoors and early in the morning or late at night.</li>
</ul>
<p>None of this makes friendship impossible. It just means you need a routine rather than luck.</p>`,
      },
      {
        h2: 'Start with what you already like',
        html: `<p>The easiest conversations start beside someone doing the same thing. Choose activities where people come back regularly, so faces become familiar:</p>
<ul>
<li><strong>Sport in a group:</strong> run clubs at dawn, padel, football, beach volleyball, cycling. Sport gives you something to talk about from the first minute.</li>
<li><strong>Classes:</strong> languages, dance, cooking, photography. Same people, same time, every week.</li>
<li><strong>Volunteering:</strong> you meet people who care about the same things, without small talk.</li>
<li><strong>Professional events:</strong> if you work in a field you enjoy, meetups and talks are full of people who are also new.</li>
</ul>
<p>One activity a week, kept for two months, does more than ten one-off events.</p>`,
      },
      {
        h2: 'Use the city’s rhythm',
        html: `<h3>Weekends</h3>
<p>Since 2022 the official weekend is Saturday and Sunday. Many group activities, brunches and day trips happen then, so plan one social thing every weekend.</p>
<h3>Mornings and evenings</h3>
<p>Outdoor sport is easiest early in the morning and after sunset, especially from spring to autumn. Groups that meet at those times are often the most regular.</p>
<h3>Indoor places in summer</h3>
<p>In the hottest months, look for indoor sports, climbing walls, classes, cafés and museums, where groups keep meeting.</p>`,
      },
      {
        h2: 'Turn a first meeting into a friendship',
        html: `<ol>
<li><strong>Go back.</strong> The second and third time you show up matter more than the first.</li>
<li><strong>Suggest the next thing.</strong> “Same time next week?” or “A few of us are getting breakfast after, want to come?” is all it takes.</li>
<li><strong>Keep it small.</strong> A coffee with two people you met at the activity beats another big event.</li>
<li><strong>Host once.</strong> Organise a simple plan yourself, a walk, a game, a brunch. People who host get to know everyone.</li>
<li><strong>Stay patient.</strong> Friendships take time everywhere. A few months of regular plans is normal.</li>
</ol>`,
      },
      {
        h2: 'Meeting people who speak your language',
        html: `<p>It helps to have people who share your language and culture, especially at the start. Look for national and language communities, cultural associations and their events. Then make sure you also join mixed groups: Dubai is international, and that mix is one of the best things about living here.</p>`,
      },
      {
        h2: 'Where IRLY fits in',
        html: `<p>IRLY is an app built for exactly this: meeting people around shared interests, then meeting in real life. You can join communities by topic, find or create activities like a run, a padel game or a brunch, and talk in the group chat before you meet. IRLY Girl offers spaces for women only. It is one option among others; whatever you use, the advice above is what makes the difference.</p>`,
      },
    ],
    cta: { title: 'New to Dubai?', body: 'Meet people who share your interests, join communities and do things together, in real life.', label: 'Find my people' },
    related: [{ label: 'Lonely in Dubai: what actually helps', path: 'dubai/lonely/' }, { label: '15 group activities to meet people in Dubai', path: 'dubai/group-activities/' }, { label: 'How to make friends in Bali', path: 'bali/make-friends/' }],
  },
  {
    lang: 'fr',
    pair: 'dubai-friends',
    path: 'fr/dubai/se-faire-des-amis/',
    cover: 'brunch',
    figure: { photo: 'dubaiMarina', after: 1 },
    city: 'Dubaï',
    title: 'Se faire des amis à Dubaï : le guide pour les nouveaux arrivants | IRLY',
    description: 'Tu viens d’arriver à Dubaï et tu ne connais personne ? Pourquoi c’est parfois difficile de se faire des amis ici, et des façons concrètes de rencontrer du monde.',
    h1: 'Comment se faire des amis à Dubaï',
    lead: 'Se faire des amis à Dubaï, c’est tout à fait possible, mais ça arrive rarement par hasard : ici, la plupart des amitiés naissent autour d’une activité où l’on revient chaque semaine. Choisis deux ou trois choses que tu aimes, rejoins les groupes qui les pratiquent et reviens régulièrement. Voici pourquoi c’est parfois difficile au début, et ce qui marche.',
    sections: [
      {
        h2: 'Pourquoi c’est parfois difficile au début',
        html: `<p>Se sentir seul dans une ville pleine de monde est courant, et ça ne dit rien de toi. Dubaï a quelques particularités qui rendent les premiers mois plus durs :</p>
<ul>
<li><strong>Presque tout le monde vient d’ailleurs.</strong> Les gens ont déjà leurs amis, du travail ou de leurs premiers mois, et pendant que certains arrivent, d’autres repartent.</li>
<li><strong>Les distances et la voiture.</strong> Les quartiers sont étendus : voir quelqu’un « juste pour un café » demande plus d’organisation que dans une ville où l’on marche.</li>
<li><strong>Des semaines de travail chargées.</strong> Beaucoup travaillent énormément, surtout au début, et les soirées disparaissent.</li>
<li><strong>L’été.</strong> En gros de juin à septembre, la chaleur pousse la vie à l’intérieur, tôt le matin ou tard le soir.</li>
</ul>
<p>Rien de tout ça ne rend l’amitié impossible. Il faut simplement une routine plutôt que de la chance.</p>`,
      },
      {
        h2: 'Commence par ce que tu aimes déjà',
        html: `<p>Les conversations les plus simples commencent à côté de quelqu’un qui fait la même chose que toi. Choisis des activités où les gens reviennent, pour que les visages deviennent familiers :</p>
<ul>
<li><strong>Le sport en groupe :</strong> clubs de course à l’aube, padel, foot, beach-volley, vélo. Le sport donne un sujet de conversation dès la première minute.</li>
<li><strong>Les cours :</strong> langues, danse, cuisine, photo. Les mêmes personnes, à la même heure, chaque semaine.</li>
<li><strong>Le bénévolat :</strong> tu rencontres des gens qui tiennent aux mêmes choses que toi, sans bavardage forcé.</li>
<li><strong>Les événements pros :</strong> si ton domaine te plaît, les meetups et conférences sont pleins de gens eux aussi nouveaux.</li>
</ul>
<p>Une activité par semaine, tenue pendant deux mois, fait plus que dix événements ponctuels.</p>`,
      },
      {
        h2: 'Profite du rythme de la ville',
        html: `<h3>Le week-end</h3>
<p>Depuis 2022, le week-end officiel est le samedi et le dimanche. Beaucoup d’activités de groupe, de brunchs et d’excursions ont lieu à ce moment-là : prévois une sortie sociale chaque week-end.</p>
<h3>Le matin et le soir</h3>
<p>Le sport en extérieur est plus facile tôt le matin et après le coucher du soleil, surtout du printemps à l’automne. Les groupes qui se retrouvent à ces heures-là sont souvent les plus réguliers.</p>
<h3>L’intérieur en été</h3>
<p>Pendant les mois les plus chauds, tourne-toi vers les sports en salle, l’escalade, les cours, les cafés et les musées, où les groupes continuent de se retrouver.</p>`,
      },
      {
        h2: 'Transformer une première rencontre en amitié',
        html: `<ol>
<li><strong>Reviens.</strong> La deuxième et la troisième fois comptent plus que la première.</li>
<li><strong>Propose la suite.</strong> « Même heure la semaine prochaine ? » ou « On va prendre un petit-déj après, tu viens ? », ça suffit.</li>
<li><strong>Reste en petit comité.</strong> Un café à deux ou trois avec des gens rencontrés à l’activité vaut mieux qu’un autre grand événement.</li>
<li><strong>Organise une fois.</strong> Une balade, un jeu, un brunch : ceux qui organisent finissent par connaître tout le monde.</li>
<li><strong>Sois patient.</strong> Partout, une amitié prend du temps. Quelques mois de sorties régulières, c’est normal.</li>
</ol>`,
      },
      {
        h2: 'Rencontrer des francophones',
        html: `<p>Au début, ça aide d’avoir des personnes qui partagent ta langue et ta culture. Cherche les associations et communautés francophones et leurs événements. Puis rejoins aussi des groupes mixtes : Dubaï est internationale, et ce mélange fait partie de ce qu’il y a de mieux ici.</p>`,
      },
      {
        h2: 'Et IRLY dans tout ça',
        html: `<p>IRLY est une application pensée pour ça : rencontrer des personnes autour de centres d’intérêt communs, puis se voir en vrai. Tu peux rejoindre des communautés par thème, trouver ou créer une activité (un footing, une partie de padel, un brunch) et discuter dans le chat du groupe avant de te déplacer. IRLY Girl propose des espaces réservés aux femmes. C’est une option parmi d’autres : quoi que tu utilises, ce sont les conseils ci-dessus qui font la différence.</p>`,
      },
    ],
    cta: { title: 'Tu viens d’arriver à Dubaï ?', body: 'Rencontre des personnes qui partagent tes centres d’intérêt, rejoins des communautés et faites des choses ensemble, en vrai.', label: 'Trouver mes gens' },
    related: [{ label: 'Se sentir seul à Dubaï', path: 'fr/dubai/solitude/' }, { label: '15 activités de groupe pour rencontrer du monde à Dubaï', path: 'fr/dubai/activites-de-groupe/' }, { label: 'Se faire des amis à Bali', path: 'fr/bali/se-faire-des-amis/' }],
  },
  {
    lang: 'en',
    pair: 'bali-friends',
    path: 'bali/make-friends/',
    cover: 'volleyball',
    figure: { photo: 'surf', after: 1 },
    city: 'Bali',
    title: 'How to Make Friends in Bali: Travellers, Nomads and Newcomers | IRLY',
    description: 'Arriving in Bali alone? How friendships work on an island where people come and go, and practical ways to meet people in Canggu, Ubud and beyond.',
    h1: 'How to make friends in Bali',
    lead: 'Meeting people in Bali is easy; keeping friends is the real challenge, because so many people are only passing through. The trick is to mix: join the open, sociable scene for quick connections, and build a few regular habits with people who are staying as long as you are.',
    sections: [
      {
        h2: 'Why friendships feel different on the island',
        html: `<p>Bali brings together very different people, and knowing who you are meeting helps:</p>
<ul>
<li><strong>Travellers</strong> stay days or weeks. Open and easy to meet, but they leave soon.</li>
<li><strong>Remote workers and digital nomads</strong> stay a few weeks to a few months, often around coworking spaces.</li>
<li><strong>Expats and long-term residents</strong> have settled here, with families, businesses or both. Their circles are more stable but also more closed.</li>
<li><strong>Balinese locals</strong>, whose island it is, with their own community life and ceremonies.</li>
</ul>
<p>The constant coming and going can make you feel lonely even when you meet new people every day. Having goodbyes often is normal here, not a sign that something is wrong.</p>`,
      },
      {
        h2: 'Choose your area for the life you want',
        html: `<ul>
<li><strong>Canggu and Pererenan:</strong> surf, cafés, coworking and a busy social life.</li>
<li><strong>Ubud:</strong> greener and quieter, with yoga, wellness, art and a slower rhythm.</li>
<li><strong>Uluwatu:</strong> surf, cliffs and beaches, more spread out.</li>
<li><strong>Sanur:</strong> calmer, with many families and long-term residents.</li>
<li><strong>Seminyak:</strong> restaurants, shops and nightlife.</li>
</ul>
<p>Where you stay shapes who you meet. Spending your first weeks in the area that matches your interests saves a lot of scooter time.</p>`,
      },
      {
        h2: 'Places where friendships actually start',
        html: `<ul>
<li><strong>Surf lessons and surf groups:</strong> same break, same mornings, same faces.</li>
<li><strong>Yoga, fitness and sport classes:</strong> regular classes beat one-off retreats for meeting people.</li>
<li><strong>Coworking spaces:</strong> many organise talks, lunches and community events for members.</li>
<li><strong>Language classes:</strong> learning some Indonesian also brings you closer to local life.</li>
<li><strong>Volunteering</strong> with local organisations, beach clean-ups and community projects.</li>
</ul>`,
      },
      {
        h2: 'Make friends who stay',
        html: `<ol>
<li><strong>Build a weekly routine:</strong> the same class, the same café, the same Sunday plan.</li>
<li><strong>Ask how long people are staying.</strong> It is a normal question here, and it helps you invest in the right friendships.</li>
<li><strong>Organise something simple:</strong> a sunset at the beach, a dinner, a day trip. Hosts become the centre of a group.</li>
<li><strong>Keep in touch</strong> with friends who leave: Bali friendships often continue elsewhere.</li>
</ol>`,
      },
      {
        h2: 'Practical tips for your first weeks',
        html: `<ul>
<li>Most people get around by scooter. Only ride with the right licence, a helmet and insurance, and if you are not confident, use ride-hailing apps instead.</li>
<li>The rainy season usually runs from around November to March: plan indoor alternatives.</li>
<li>Respect ceremonies and temples: they are part of daily life, not a backdrop.</li>
</ul>`,
      },
      {
        h2: 'Where IRLY fits in',
        html: `<p>IRLY helps you meet people around what you like and then meet in real life: join communities by topic, find or create activities (a surf session, a yoga class, a dinner) and talk in the group chat first. The app also has a guide to Bali’s areas. It is one way among others; the habits above are what turn meetings into friendships.</p>`,
      },
    ],
    cta: { title: 'Just arrived in Bali?', body: 'Meet people who share your interests and do things together, in real life.', label: 'Find my people' },
    related: [{ label: 'How to make friends in Dubai', path: 'dubai/make-friends/' }],
  },
  {
    lang: 'fr',
    pair: 'bali-friends',
    path: 'fr/bali/se-faire-des-amis/',
    cover: 'volleyball',
    figure: { photo: 'surf', after: 1 },
    city: 'Bali',
    title: 'Se faire des amis à Bali : voyageurs, nomades et nouveaux arrivants | IRLY',
    description: 'Tu arrives seul à Bali ? Comment fonctionnent les amitiés sur une île où les gens vont et viennent, et des façons concrètes de rencontrer du monde à Canggu, Ubud et ailleurs.',
    h1: 'Comment se faire des amis à Bali',
    lead: 'Rencontrer des gens à Bali est facile ; garder des amis, c’est le vrai défi, parce que beaucoup ne font que passer. L’astuce : mélanger les deux. Profite de l’ambiance ouverte pour les rencontres rapides, et construis quelques habitudes régulières avec des personnes qui restent aussi longtemps que toi.',
    sections: [
      {
        h2: 'Pourquoi les amitiés sont différentes sur l’île',
        html: `<p>Bali réunit des profils très différents, et savoir qui tu rencontres aide beaucoup :</p>
<ul>
<li><strong>Les voyageurs</strong> restent quelques jours ou semaines. Ouverts et faciles à rencontrer, mais ils repartent vite.</li>
<li><strong>Les travailleurs à distance et digital nomads</strong> restent de quelques semaines à quelques mois, souvent autour des espaces de coworking.</li>
<li><strong>Les expatriés et résidents</strong> sont installés, avec famille, entreprise ou les deux. Leurs cercles sont plus stables, mais aussi plus fermés.</li>
<li><strong>Les Balinais</strong>, chez qui tu vis, avec leur propre vie de communauté et leurs cérémonies.</li>
</ul>
<p>Ces allers-retours permanents peuvent donner un sentiment de solitude, même quand on rencontre du monde tous les jours. Dire souvent au revoir est normal ici, pas le signe que quelque chose ne va pas.</p>`,
      },
      {
        h2: 'Choisis ton quartier selon la vie que tu veux',
        html: `<ul>
<li><strong>Canggu et Pererenan :</strong> surf, cafés, coworking et une vie sociale très active.</li>
<li><strong>Ubud :</strong> plus vert et plus calme, avec yoga, bien-être, art et un rythme plus lent.</li>
<li><strong>Uluwatu :</strong> surf, falaises et plages, plus étendu.</li>
<li><strong>Sanur :</strong> plus tranquille, avec beaucoup de familles et de résidents de longue durée.</li>
<li><strong>Seminyak :</strong> restaurants, boutiques et vie nocturne.</li>
</ul>
<p>L’endroit où tu loges détermine qui tu rencontres. Passer tes premières semaines dans le quartier qui correspond à tes envies t’évite beaucoup de trajets en scooter.</p>`,
      },
      {
        h2: 'Les endroits où les amitiés commencent vraiment',
        html: `<ul>
<li><strong>Cours et groupes de surf :</strong> même spot, mêmes matins, mêmes visages.</li>
<li><strong>Yoga, fitness et sport :</strong> des cours réguliers valent mieux qu’une retraite ponctuelle pour rencontrer du monde.</li>
<li><strong>Les coworkings :</strong> beaucoup organisent des talks, des déjeuners et des événements pour leurs membres.</li>
<li><strong>Les cours de langue :</strong> apprendre un peu d’indonésien te rapproche aussi de la vie locale.</li>
<li><strong>Le bénévolat</strong> avec des associations locales, des nettoyages de plage et des projets de quartier.</li>
</ul>`,
      },
      {
        h2: 'Se faire des amis qui restent',
        html: `<ol>
<li><strong>Crée une routine hebdomadaire :</strong> le même cours, le même café, le même plan du dimanche.</li>
<li><strong>Demande combien de temps les gens restent.</strong> C’est une question normale ici, et elle aide à t’investir dans les bonnes amitiés.</li>
<li><strong>Organise quelque chose de simple :</strong> un coucher de soleil à la plage, un dîner, une excursion. Ceux qui organisent deviennent le cœur d’un groupe.</li>
<li><strong>Garde le contact</strong> avec ceux qui partent : les amitiés de Bali continuent souvent ailleurs.</li>
</ol>`,
      },
      {
        h2: 'Conseils pratiques pour tes premières semaines',
        html: `<ul>
<li>La plupart des gens se déplacent en scooter. Ne conduis qu’avec le bon permis, un casque et une assurance ; si tu n’es pas à l’aise, utilise les applications de VTC.</li>
<li>La saison des pluies va en général d’environ novembre à mars : prévois des plans en intérieur.</li>
<li>Respecte les cérémonies et les temples : ils font partie de la vie quotidienne, pas du décor.</li>
</ul>`,
      },
      {
        h2: 'Et IRLY dans tout ça',
        html: `<p>IRLY t’aide à rencontrer des personnes autour de ce que tu aimes, puis à te voir en vrai : rejoins des communautés par thème, trouve ou crée une activité (une session de surf, un cours de yoga, un dîner) et discute d’abord dans le chat du groupe. L’app propose aussi un guide des quartiers de Bali. C’est une façon parmi d’autres ; ce sont les habitudes ci-dessus qui transforment les rencontres en amitiés.</p>`,
      },
    ],
    cta: { title: 'Tu viens d’arriver à Bali ?', body: 'Rencontre des personnes qui partagent tes centres d’intérêt et faites des choses ensemble, en vrai.', label: 'Trouver mes gens' },
    related: [{ label: 'Se faire des amis à Dubaï', path: 'fr/dubai/se-faire-des-amis/' }],
  },
  {
    lang: 'en',
    pair: 'dubai-lonely',
    path: 'dubai/lonely/',
    cover: 'dubaiCreek',
    figure: { photo: 'running', after: 1 },
    city: 'Dubai',
    updated: '2026-10-10',
    updated: '2026-10-09',
    title: 'Lonely in Dubai? What Actually Helps | IRLY',
    description: 'Feeling lonely in Dubai is common, especially in the first months. Why it happens here, small steps that help this week, and when to talk to a professional.',
    h1: 'Lonely in Dubai: what actually helps',
    lead: 'Feeling lonely in Dubai is common, and it is not a sign that something is wrong with you. It usually eases with routine rather than with one big event: one regular activity, one person you see again, one plan you suggest yourself. Below: why it happens here, what helps this week, and when to ask for more help.',
    sections: [
      {
        h2: 'Why loneliness is common here',
        html: `<p>Dubai is a city of arrivals. Most people came from somewhere else, many alone, and the people around you are often busy building their own lives. A few things make it harder:</p>
<ul>
<li><strong>Your old network is far away.</strong> Friends and family are in other time zones, and calls do not replace seeing someone.</li>
<li><strong>People come and go.</strong> Friends move on to another job or country, and you start again more often than elsewhere.</li>
<li><strong>Work takes a lot of room.</strong> Long weeks leave little energy for meeting people.</li>
<li><strong>Summer moves life indoors.</strong> From roughly June to September, the heat makes spontaneous meetings rarer.</li>
</ul>
<p>Knowing this helps: it is the situation, not you.</p>`,
      },
      {
        h2: 'Small steps that help this week',
        html: `<ol>
<li><strong>Pick one regular activity.</strong> A weekly class, a run club, a sport, a volunteering shift. Same place, same time, same faces.</li>
<li><strong>Say yes to one invitation.</strong> Even a short one. You can leave early; going matters more than staying.</li>
<li><strong>Suggest one simple plan.</strong> A coffee after the activity, a walk, a game. Most people are waiting for someone else to propose.</li>
<li><strong>Keep in touch with home, on a rhythm.</strong> A fixed call each week keeps those ties without filling every evening.</li>
<li><strong>Get out of the flat every day.</strong> A café, a library, a park in the cooler hours: being around people helps, even before you talk to them.</li>
</ol>`,
      },
      {
        h2: 'Places where conversations start easily',
        html: `<p>Some settings make talking natural because everyone is there for the same thing:</p>
<ul>
<li><strong>Group sport:</strong> padel, running, football, climbing, beach volleyball.</li>
<li><strong>Classes and workshops:</strong> languages, cooking, art, dance.</li>
<li><strong>Volunteering:</strong> people who care about the same cause, and a task to share.</li>
<li><strong>Communities of your country or language:</strong> a familiar starting point, then mixed groups to widen your circle.</li>
<li><strong>Coworking spaces and professional meetups:</strong> if you work alone, they give your week colleagues.</li>
</ul>`,
      },
      {
        h2: 'When to talk to someone',
        html: `<p>Loneliness can weigh on your mood, sleep and energy. If it lasts, if you feel low most days, or if daily life becomes hard, talk to a doctor or a mental health professional: it is a normal step, and many clinics in Dubai offer consultations in several languages. Your employer’s health insurance may cover part of it; check your policy.</p>
<p>If you are in danger or think about harming yourself, call the emergency services: <strong>999</strong> (police) or <strong>998</strong> (ambulance) in the UAE.</p>`,
      },
      {
        h2: 'Where IRLY fits in',
        html: `<p>IRLY is built to turn “I don’t know anyone” into a plan: join communities around what you like, find an activity this week or create your own, and talk with the group before you meet. IRLY Girl offers spaces for women only. It is one option among others; the regular activity and the plan you suggest are what change things.</p>`,
      },
    ],
    cta: { title: 'Feeling alone in Dubai?', body: 'Join a community around what you like and find a plan this week, in real life.', label: 'Join a community' },
    related: [{ label: 'How to make friends in Dubai', path: 'dubai/make-friends/' }],
  },
  {
    lang: 'fr',
    pair: 'dubai-lonely',
    path: 'fr/dubai/solitude/',
    cover: 'dubaiCreek',
    figure: { photo: 'running', after: 1 },
    city: 'Dubaï',
    updated: '2026-10-09',
    title: 'Se sentir seul à Dubaï : ce qui aide vraiment | IRLY',
    description: 'Se sentir seul à Dubaï est fréquent, surtout les premiers mois. Pourquoi ça arrive ici, les petits pas qui aident cette semaine, et quand en parler à un professionnel.',
    h1: 'Se sentir seul à Dubaï : ce qui aide vraiment',
    lead: 'Se sentir seul à Dubaï est fréquent, et ça ne veut pas dire que quelque chose ne va pas chez toi. La solitude recule surtout avec une routine, pas avec un grand événement : une activité régulière, une personne que tu revois, un plan que tu proposes toi-même. Ci-dessous : pourquoi ça arrive ici, ce qui aide cette semaine, et quand demander plus d’aide.',
    sections: [
      {
        h2: 'Pourquoi la solitude est fréquente ici',
        html: `<p>Dubaï est une ville d’arrivées. La plupart des gens viennent d’ailleurs, souvent seuls, et ceux qui t’entourent sont occupés à construire leur propre vie. Quelques raisons rendent les choses plus difficiles :</p>
<ul>
<li><strong>Ton réseau est loin.</strong> Amis et famille vivent dans d’autres fuseaux horaires, et les appels ne remplacent pas les rencontres.</li>
<li><strong>Les gens partent et arrivent.</strong> Des amis changent de poste ou de pays, et on recommence plus souvent qu’ailleurs.</li>
<li><strong>Le travail prend beaucoup de place.</strong> Les semaines longues laissent peu d’énergie pour rencontrer du monde.</li>
<li><strong>L’été ramène la vie à l’intérieur.</strong> De juin à septembre environ, la chaleur rend les rencontres spontanées plus rares.</li>
</ul>
<p>Le savoir aide : c’est la situation, pas toi.</p>`,
      },
      {
        h2: 'Les petits pas qui aident cette semaine',
        html: `<ol>
<li><strong>Choisis une activité régulière.</strong> Un cours chaque semaine, un club de course, un sport, du bénévolat. Même lieu, même heure, mêmes visages.</li>
<li><strong>Dis oui à une invitation.</strong> Même courte. Tu peux partir tôt : y aller compte plus que rester.</li>
<li><strong>Propose un plan simple.</strong> Un café après l’activité, une balade, un jeu. La plupart des gens attendent que quelqu’un d’autre propose.</li>
<li><strong>Garde le lien avec chez toi, à un rythme fixe.</strong> Un appel fixe chaque semaine entretient ces liens sans remplir toutes tes soirées.</li>
<li><strong>Sors de chez toi chaque jour.</strong> Un café, une bibliothèque, un parc aux heures fraîches : être entouré aide, même avant de parler.</li>
</ol>`,
      },
      {
        h2: 'Les lieux où la conversation vient facilement',
        html: `<p>Certains cadres rendent la discussion naturelle, parce que tout le monde est là pour la même chose :</p>
<ul>
<li><strong>Le sport en groupe :</strong> padel, course, football, escalade, beach-volley.</li>
<li><strong>Les cours et ateliers :</strong> langues, cuisine, art, danse.</li>
<li><strong>Le bénévolat :</strong> des gens qui tiennent à la même cause, et une tâche à partager.</li>
<li><strong>Les communautés de ton pays ou de ta langue :</strong> un point de départ familier, puis des groupes mixtes pour élargir ton cercle.</li>
<li><strong>Les espaces de coworking et rencontres professionnelles :</strong> si tu travailles seul, ils donnent des collègues à ta semaine.</li>
</ul>`,
      },
      {
        h2: 'Quand en parler à quelqu’un',
        html: `<p>La solitude peut peser sur le moral, le sommeil et l’énergie. Si elle dure, si tu te sens mal la plupart des jours, ou si le quotidien devient difficile, parles-en à un médecin ou à un professionnel de santé mentale : c’est une démarche normale, et de nombreuses cliniques à Dubaï proposent des consultations en plusieurs langues. L’assurance santé de ton employeur peut en couvrir une partie ; vérifie ton contrat.</p>
<p>Si tu es en danger ou si tu penses à te faire du mal, appelle les secours : <strong>999</strong> (police) ou <strong>998</strong> (ambulance) aux Émirats.</p>`,
      },
      {
        h2: 'La place d’IRLY',
        html: `<p>IRLY est pensée pour transformer « je ne connais personne » en un plan : rejoindre des communautés autour de ce que tu aimes, trouver une activité cette semaine ou créer la tienne, et échanger avec le groupe avant de te rencontrer. IRLY Girl propose des espaces réservés aux femmes. C’est une option parmi d’autres ; ce qui change les choses, c’est l’activité régulière et le plan que tu proposes.</p>`,
      },
    ],
    cta: { title: 'Seul à Dubaï ?', body: 'Rejoins une communauté autour de ce que tu aimes et trouve un plan cette semaine, en vrai.', label: 'Rejoindre une communauté' },
    related: [{ label: 'Se faire des amis à Dubaï', path: 'fr/dubai/se-faire-des-amis/' }],
  },
  {
    lang: 'en',
    pair: 'dubai-group-activities',
    path: 'dubai/group-activities/',
    cover: 'volleyball',
    figure: { photo: 'running', after: 2 },
    city: 'Dubai',
    updated: '2026-10-10',
    title: '15 Group Activities to Meet People in Dubai | IRLY',
    description: 'Fifteen group activities that make it easy to meet people in Dubai, from run clubs and padel to classes and volunteering, and how to pick the right ones for you.',
    h1: '15 group activities to meet people in Dubai',
    lead: 'The group activities that work best for meeting people in Dubai are the ones that meet every week with the same faces: run clubs, padel, team sports, classes, volunteering and hobby groups. Pick two from the list below that you would enjoy even without meeting anyone, go back every week, and suggest a coffee after the third session.',
    sections: [
      {
        h2: 'What makes an activity good for meeting people',
        html: `<p>Not every activity helps you make friends. The ones that do share three things:</p>
<ul>
<li><strong>They repeat.</strong> Same day, same time, every week. Familiar faces turn into conversations.</li>
<li><strong>They give you something to do together.</strong> A game, a route, a recipe: you talk about it before you talk about yourselves.</li>
<li><strong>They leave time around them.</strong> A coffee after the run, a drink after the match. That is where friendships start.</li>
</ul>`,
      },
      {
        h2: 'Sport and outdoors',
        html: `<ol>
<li><strong>Run clubs.</strong> Groups meet early in the morning or after sunset, all paces welcome in most of them. Often followed by breakfast.</li>
<li><strong>Padel.</strong> Played in fours, so you always meet three people. Many groups mix levels and look for a fourth player.</li>
<li><strong>Football and other team sports.</strong> Casual leagues and weekly pick-up games, for men, women and mixed teams.</li>
<li><strong>Beach volleyball.</strong> Easy to join, played in small teams, best in the cooler hours.</li>
<li><strong>Cycling.</strong> Group rides at dawn on dedicated tracks, with a coffee stop that is half the point.</li>
<li><strong>Hiking.</strong> In the cooler months, groups head to the Hajar Mountains for day hikes. A day on a trail with the same group goes a long way.</li>
<li><strong>Climbing and bouldering.</strong> Indoor, so it works all year, and people naturally help each other with routes.</li>
<li><strong>Yoga and group fitness.</strong> Regular classes, outdoor sessions in the cooler months. Arrive a little early and stay a little after.</li>
</ol>`,
      },
      {
        h2: 'Classes and creative groups',
        html: `<ol start="9">
<li><strong>Language classes and language exchanges.</strong> Learning Arabic or another language puts you in a room of people who also chose to stay a while.</li>
<li><strong>Cooking classes.</strong> You cook together, then eat together: a natural way to talk.</li>
<li><strong>Dance classes.</strong> Salsa, bachata and other social dances rotate partners, so you meet everyone in the class.</li>
<li><strong>Photography walks and art workshops.</strong> A shared eye for the city, and something to show each other afterwards.</li>
</ol>`,
      },
      {
        h2: 'Social and community groups',
        html: `<ol start="13">
<li><strong>Volunteering.</strong> Shifts with the same team, a cause you care about, and no need for small talk.</li>
<li><strong>Board game and quiz nights.</strong> Small tables, easy jokes, and a reason to come back next week.</li>
<li><strong>Book clubs and professional meetups.</strong> One conversation topic chosen in advance, and people who like talking about it.</li>
</ol>`,
      },
      {
        h2: 'How to choose your two',
        html: `<ul>
<li><strong>Pick one you love and one that is new.</strong> The first keeps you going back; the second widens your circle.</li>
<li><strong>Check the time and the place.</strong> An activity across the city at rush hour will not last. Choose what fits your week.</li>
<li><strong>Plan for the summer.</strong> From roughly June to September, prefer indoor activities or very early and late sessions.</li>
<li><strong>Give it two months.</strong> One session tells you little. Eight tell you whether the group is yours.</li>
</ul>`,
      },
      {
        h2: 'Where IRLY fits in',
        html: `<p>IRLY lets you find group activities by interest, join the communities that run them, or create your own plan, a run, a padel game, a brunch, and invite people who like the same thing. IRLY Girl offers spaces for women only. It is one option among others; going back every week is what turns an activity into friends.</p>`,
      },
    ],
    cta: { title: 'Looking for a plan this week?', body: 'Find a group activity around what you like, or create your own, and meet in real life.', label: 'Find an activity' },
    related: [{ label: 'How to make friends in Dubai', path: 'dubai/make-friends/' }, { label: 'Lonely in Dubai: what actually helps', path: 'dubai/lonely/' }],
  },
  {
    lang: 'fr',
    pair: 'dubai-group-activities',
    path: 'fr/dubai/activites-de-groupe/',
    cover: 'volleyball',
    figure: { photo: 'running', after: 2 },
    city: 'Dubai',
    updated: '2026-10-10',
    title: '15 activités de groupe pour rencontrer du monde à Dubaï | IRLY',
    description: 'Quinze activités de groupe qui facilitent les rencontres à Dubaï, des clubs de course au padel en passant par les cours et le bénévolat, et comment choisir les tiennes.',
    h1: '15 activités de groupe pour rencontrer du monde à Dubaï',
    lead: 'Les activités de groupe qui marchent le mieux pour rencontrer du monde à Dubaï sont celles qui se retrouvent chaque semaine avec les mêmes visages : clubs de course, padel, sports d’équipe, cours, bénévolat et groupes de loisirs. Choisis-en deux dans la liste ci-dessous que tu aimerais même sans rencontrer personne, reviens chaque semaine, et propose un café après la troisième séance.',
    sections: [
      {
        h2: 'Ce qui fait une bonne activité pour rencontrer des gens',
        html: `<p>Toutes les activités n’aident pas à se faire des amis. Celles qui marchent ont trois points communs :</p>
<ul>
<li><strong>Elles se répètent.</strong> Même jour, même heure, chaque semaine. Les visages familiers deviennent des conversations.</li>
<li><strong>Elles donnent quelque chose à faire ensemble.</strong> Un match, un parcours, une recette : on en parle avant de parler de soi.</li>
<li><strong>Elles laissent du temps autour.</strong> Un café après la course, un verre après le match. C’est là que les amitiés commencent.</li>
</ul>`,
      },
      {
        h2: 'Sport et plein air',
        html: `<ol>
<li><strong>Les clubs de course.</strong> Les groupes se retrouvent tôt le matin ou après le coucher du soleil, et la plupart accueillent tous les niveaux. Souvent suivis d’un petit-déjeuner.</li>
<li><strong>Le padel.</strong> Il se joue à quatre, donc tu rencontres toujours trois personnes. Beaucoup de groupes mélangent les niveaux et cherchent un quatrième joueur.</li>
<li><strong>Le football et les autres sports d’équipe.</strong> Ligues loisir et matchs hebdomadaires ouverts, pour hommes, femmes et équipes mixtes.</li>
<li><strong>Le beach-volley.</strong> Facile à rejoindre, en petites équipes, idéal aux heures plus fraîches.</li>
<li><strong>Le vélo.</strong> Sorties en groupe à l’aube sur des pistes dédiées, avec une pause café qui compte autant que la sortie.</li>
<li><strong>La randonnée.</strong> Pendant les mois plus frais, des groupes partent marcher à la journée dans les montagnes du Hajar. Une journée sur un sentier avec le même groupe rapproche vite.</li>
<li><strong>L’escalade et le bloc.</strong> En salle, donc toute l’année, et on s’aide naturellement sur les voies.</li>
<li><strong>Le yoga et les cours collectifs.</strong> Des cours réguliers, en extérieur pendant les mois plus frais. Arrive un peu en avance et reste un peu après.</li>
</ol>`,
      },
      {
        h2: 'Cours et groupes créatifs',
        html: `<ol start="9">
<li><strong>Les cours de langue et les échanges linguistiques.</strong> Apprendre l’arabe ou une autre langue te met dans une salle de gens qui ont aussi choisi de rester un moment.</li>
<li><strong>Les cours de cuisine.</strong> On cuisine ensemble, puis on mange ensemble : une façon naturelle de discuter.</li>
<li><strong>Les cours de danse.</strong> La salsa, la bachata et les autres danses de couple font tourner les partenaires, donc tu rencontres tout le cours.</li>
<li><strong>Les balades photo et les ateliers d’art.</strong> Un regard partagé sur la ville, et quelque chose à se montrer ensuite.</li>
</ol>`,
      },
      {
        h2: 'Groupes sociaux et communautés',
        html: `<ol start="13">
<li><strong>Le bénévolat.</strong> Des créneaux avec la même équipe, une cause qui te tient à cœur, et pas besoin de bavardage.</li>
<li><strong>Les soirées jeux de société et quiz.</strong> Des petites tables, des blagues faciles, et une raison de revenir la semaine suivante.</li>
<li><strong>Les clubs de lecture et les rencontres professionnelles.</strong> Un sujet choisi à l’avance, et des gens qui aiment en parler.</li>
</ol>`,
      },
      {
        h2: 'Comment choisir les deux tiennes',
        html: `<ul>
<li><strong>Prends-en une que tu adores et une nouvelle.</strong> La première te fait revenir ; la seconde élargit ton cercle.</li>
<li><strong>Vérifie l’heure et le lieu.</strong> Une activité à l’autre bout de la ville à l’heure de pointe ne durera pas. Choisis ce qui rentre dans ta semaine.</li>
<li><strong>Anticipe l’été.</strong> De juin à septembre environ, préfère les activités en intérieur ou les séances très tôt et tard.</li>
<li><strong>Donne-toi deux mois.</strong> Une séance ne dit pas grand-chose. Huit te disent si ce groupe est le tien.</li>
</ul>`,
      },
      {
        h2: 'La place d’IRLY',
        html: `<p>IRLY permet de trouver des activités de groupe par centre d’intérêt, de rejoindre les communautés qui les organisent, ou de créer ton propre plan, une course, un match de padel, un brunch, et d’inviter des gens qui aiment la même chose. IRLY Girl propose des espaces réservés aux femmes. C’est une option parmi d’autres ; c’est en revenant chaque semaine qu’une activité devient des amis.</p>`,
      },
    ],
    cta: { title: 'Tu cherches un plan cette semaine ?', body: 'Trouve une activité de groupe autour de ce que tu aimes, ou crée la tienne, et retrouvez-vous en vrai.', label: 'Trouver une activité' },
    related: [{ label: 'Se faire des amis à Dubaï', path: 'fr/dubai/se-faire-des-amis/' }, { label: 'Se sentir seul à Dubaï', path: 'fr/dubai/solitude/' }],
  },
];

export const APP_URL = app;
