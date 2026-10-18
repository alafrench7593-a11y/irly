/**
 * Long-form guides for the website, one object per article and language.
 * Facts here are general and stable; anything that changes (visa rules,
 * prices, opening hours) does not belong in these guides. No statistics,
 * no testimonials, no user numbers: advice only.
 *
 * `pair` links the language versions of the same guide (hreflang).
 */
/** Site-wide last update; each guide may carry its own `updated` date. */
export const UPDATED = '2026-10-11';

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
    related: [{ label: 'Lonely in Dubai: what actually helps', path: 'dubai/lonely/' }, { label: '15 group activities to meet people in Dubai', path: 'dubai/group-activities/' }, { label: 'Moving to Dubai: a checklist for your first months', path: 'dubai/moving-to-dubai/' }, { label: 'How to make friends in Bali', path: 'bali/make-friends/' }],
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
    related: [{ label: 'Se sentir seul à Dubaï', path: 'fr/dubai/solitude/' }, { label: '15 activités de groupe pour rencontrer du monde à Dubaï', path: 'fr/dubai/activites-de-groupe/' }, { label: 'S’installer à Dubaï : la checklist des premiers mois', path: 'fr/dubai/s-installer/' }, { label: 'Se faire des amis à Bali', path: 'fr/bali/se-faire-des-amis/' }],
  },
  {
    lang: 'en',
    pair: 'bali-friends',
    path: 'bali/make-friends/',
    cover: 'volleyball',
    figure: { photo: 'surf', after: 1 },
    city: 'Bali',
    updated: '2026-10-12',
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
    related: [
      { label: 'How to make friends in Dubai', path: 'dubai/make-friends/' },
      { label: 'Bali for digital nomads', path: 'bali/digital-nomads/' },
    ],
  },
  {
    lang: 'fr',
    pair: 'bali-friends',
    path: 'fr/bali/se-faire-des-amis/',
    cover: 'volleyball',
    figure: { photo: 'surf', after: 1 },
    city: 'Bali',
    updated: '2026-10-12',
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
    related: [
      { label: 'Se faire des amis à Dubaï', path: 'fr/dubai/se-faire-des-amis/' },
      { label: 'Bali pour les digital nomads', path: 'fr/bali/digital-nomads/' },
    ],
  },
  {
    lang: 'en',
    pair: 'bali-nomads',
    path: 'bali/digital-nomads/',
    cover: 'surf',
    figure: { photo: 'volleyball', after: 1 },
    city: 'Bali',
    updated: '2026-10-12',
    title: 'Bali for Digital Nomads: Finding Community and Coworking | IRLY',
    description: 'Working remotely from Bali? How to find a community, choose an area and a coworking space, and build a routine that keeps you social without losing your workdays.',
    h1: 'Bali for digital nomads: community and coworking',
    lead: 'Bali makes it easy to meet other remote workers, but a good stay depends on three choices you make early: the area you live in, the place you work from, and the few regular activities you commit to. Get those right and the community usually follows. Below: how to choose each one, and how to stay social without losing your workdays.',
    sections: [
      {
        h2: 'Start with the area, not the café',
        html: `<p>Bali is bigger than it looks, and traffic makes short distances slow. Your area decides who you see every day:</p>
<ul>
<li><strong>Canggu and Pererenan:</strong> the busiest remote-work scene, with many cafés, coworking spaces and events.</li>
<li><strong>Ubud:</strong> greener and quieter, popular with people who want focus, yoga and a slower rhythm.</li>
<li><strong>Sanur:</strong> calmer, with more long-term residents and families.</li>
<li><strong>Uluwatu:</strong> beaches and surf, more spread out, so you will rely more on transport.</li>
</ul>
<p>If you can, book your first two weeks only, then choose a longer stay once you know which area suits your days.</p>`,
      },
      {
        h2: 'Choosing a coworking space',
        html: `<p>A coworking space is often the quickest way into a community, because the same people are there every day. Before you sign up for a month, try a day pass and check:</p>
<ul>
<li><strong>Internet:</strong> run a speed test at the time you usually take calls, and ask whether there is a backup connection.</li>
<li><strong>Calls:</strong> are there phone booths or quiet rooms you can actually book?</li>
<li><strong>Community:</strong> does the space organise lunches, talks or skill-sharing, and do members come to them?</li>
<li><strong>Your time zone:</strong> if you work evenings for clients in Europe or the Americas, check the opening hours.</li>
</ul>
<p>Cafés work for some days, but a fixed place to work makes it easier to see the same faces and keep a routine.</p>`,
      },
      {
        h2: 'Where remote workers meet each other',
        html: `<ul>
<li><strong>Coworking events:</strong> the easiest first step, even for introverts, because you already have work in common.</li>
<li><strong>Skill-sharing and talks:</strong> offering a short talk on what you do is a simple way to be remembered.</li>
<li><strong>Sport after work:</strong> surf, yoga, running or a gym class at the same time each week.</li>
<li><strong>Group trips at weekends:</strong> a waterfall, a temple visit or a day on another part of the island.</li>
<li><strong>Online groups for your area</strong> to find what is happening this week, then show up in person.</li>
</ul>`,
      },
      {
        h2: 'Stay social without losing your workdays',
        html: `<ol>
<li><strong>Protect your work hours:</strong> decide when you work and when you are free, and say no to invitations that fall inside them.</li>
<li><strong>Put social plans after work,</strong> not in the middle of the day: a sunset, a dinner, a class.</li>
<li><strong>Keep one or two fixed weekly activities</strong> rather than many one-offs. Regulars become friends.</li>
<li><strong>Plan for goodbyes:</strong> people leave often. Building a few friendships with people staying as long as you makes a big difference.</li>
</ol>`,
      },
      {
        h2: 'Check the rules before you work from Bali',
        html: `<p>Entry and stay rules for Indonesia change, and what applies to you depends on your nationality, how long you stay and what kind of work you do. Before you travel, check the current visa options on the official Indonesian immigration website, <a href="https://www.imigrasi.go.id" rel="noopener">imigrasi.go.id</a>, and ask a qualified adviser if your situation is not clear. Do not rely on what other travellers tell you, and check your health and travel insurance too.</p>`,
      },
      {
        h2: 'Where IRLY fits in',
        html: `<p>IRLY helps you meet people around what you like and then meet in real life: join communities by topic, find or create activities (a surf session, a coworking lunch, a weekend trip) and talk in the group chat first. The app also has a guide to Bali’s areas. It is one way among others; a good area, a regular place to work and a few weekly habits matter more than any app.</p>`,
      },
    ],
    cta: { title: 'Working remotely from Bali?', body: 'Meet people who share your interests and do things together, in real life.', label: 'Find my people' },
    related: [
      { label: 'How to make friends in Bali', path: 'bali/make-friends/' },
      { label: 'Rebuilding your social life after moving abroad', path: 'guides/social-life-after-moving-abroad/' },
    ],
  },
  {
    lang: 'fr',
    pair: 'bali-nomads',
    path: 'fr/bali/digital-nomads/',
    cover: 'surf',
    figure: { photo: 'volleyball', after: 1 },
    city: 'Bali',
    updated: '2026-10-12',
    title: 'Bali pour les digital nomads : communauté et coworking | IRLY',
    description: 'Tu travailles à distance depuis Bali ? Comment trouver une communauté, choisir un quartier et un coworking, et garder une vie sociale sans sacrifier tes journées de travail.',
    h1: 'Bali pour les digital nomads : communauté et coworking',
    lead: 'À Bali, il est facile de rencontrer d’autres travailleurs à distance, mais un bon séjour dépend de trois choix à faire tôt : le quartier où tu vis, l’endroit où tu travailles et les quelques activités régulières auxquelles tu t’engages. Si tu fais bien ces choix, la communauté suit en général. Ci-dessous : comment choisir chacun, et comment rester sociable sans perdre tes journées de travail.',
    sections: [
      {
        h2: 'Commence par le quartier, pas par le café',
        html: `<p>Bali est plus grande qu’elle n’en a l’air, et la circulation rend les petites distances longues. Ton quartier décide qui tu croises tous les jours :</p>
<ul>
<li><strong>Canggu et Pererenan :</strong> la scène du travail à distance la plus animée, avec beaucoup de cafés, de coworkings et d’événements.</li>
<li><strong>Ubud :</strong> plus vert et plus calme, apprécié par ceux qui cherchent la concentration, le yoga et un rythme plus lent.</li>
<li><strong>Sanur :</strong> plus tranquille, avec davantage de résidents de longue durée et de familles.</li>
<li><strong>Uluwatu :</strong> plages et surf, plus étendu, donc tu dépendras davantage des transports.</li>
</ul>
<p>Si tu peux, ne réserve que tes deux premières semaines, puis choisis un séjour plus long une fois que tu sais quel quartier convient à tes journées.</p>`,
      },
      {
        h2: 'Choisir un coworking',
        html: `<p>Un coworking est souvent le moyen le plus rapide d’entrer dans une communauté, parce que ce sont les mêmes personnes chaque jour. Avant de t’engager pour un mois, prends un pass journée et vérifie :</p>
<ul>
<li><strong>Internet :</strong> fais un test de débit à l’heure où tu as habituellement tes appels, et demande s’il y a une connexion de secours.</li>
<li><strong>Les appels :</strong> y a-t-il des cabines ou des salles calmes que tu peux vraiment réserver ?</li>
<li><strong>La communauté :</strong> l’espace organise-t-il des déjeuners, des talks ou des échanges de compétences, et les membres y vont-ils ?</li>
<li><strong>Ton fuseau horaire :</strong> si tu travailles le soir pour des clients en Europe ou en Amérique, vérifie les horaires d’ouverture.</li>
</ul>
<p>Les cafés conviennent certains jours, mais un lieu de travail fixe aide à revoir les mêmes visages et à garder une routine.</p>`,
      },
      {
        h2: 'Où les travailleurs à distance se rencontrent',
        html: `<ul>
<li><strong>Les événements des coworkings :</strong> la première étape la plus simple, même pour les introvertis, car vous avez déjà le travail en commun.</li>
<li><strong>Les échanges de compétences et talks :</strong> proposer une courte présentation de ton métier est une façon simple qu’on se souvienne de toi.</li>
<li><strong>Le sport après le travail :</strong> surf, yoga, course ou cours en salle, à la même heure chaque semaine.</li>
<li><strong>Les sorties en groupe le week-end :</strong> une cascade, la visite d’un temple ou une journée dans une autre partie de l’île.</li>
<li><strong>Les groupes en ligne de ton quartier</strong> pour savoir ce qui se passe cette semaine, puis y aller en vrai.</li>
</ul>`,
      },
      {
        h2: 'Rester sociable sans perdre tes journées de travail',
        html: `<ol>
<li><strong>Protège tes heures de travail :</strong> décide quand tu travailles et quand tu es libre, et refuse les invitations qui tombent pendant ces heures.</li>
<li><strong>Place les sorties après le travail,</strong> pas au milieu de la journée : un coucher de soleil, un dîner, un cours.</li>
<li><strong>Garde une ou deux activités fixes par semaine</strong> plutôt que beaucoup de sorties ponctuelles. Les habitués deviennent des amis.</li>
<li><strong>Prévois les au revoir :</strong> les gens partent souvent. Quelques amitiés avec des personnes qui restent aussi longtemps que toi changent tout.</li>
</ol>`,
      },
      {
        h2: 'Vérifie les règles avant de travailler depuis Bali',
        html: `<p>Les règles d’entrée et de séjour en Indonésie évoluent, et ce qui s’applique à toi dépend de ta nationalité, de la durée de ton séjour et du type de travail que tu fais. Avant de partir, vérifie les options de visa en vigueur sur le site officiel de l’immigration indonésienne, <a href="https://www.imigrasi.go.id" rel="noopener">imigrasi.go.id</a>, et consulte un conseiller qualifié si ta situation n’est pas claire. Ne te fie pas à ce que disent les autres voyageurs, et vérifie aussi ton assurance santé et voyage.</p>`,
      },
      {
        h2: 'Et IRLY dans tout ça',
        html: `<p>IRLY t’aide à rencontrer des personnes autour de ce que tu aimes, puis à te voir en vrai : rejoins des communautés par thème, trouve ou crée une activité (une session de surf, un déjeuner entre coworkers, une sortie le week-end) et discute d’abord dans le chat du groupe. L’app propose aussi un guide des quartiers de Bali. C’est une façon parmi d’autres ; un bon quartier, un lieu de travail régulier et quelques habitudes hebdomadaires comptent plus que n’importe quelle app.</p>`,
      },
    ],
    cta: { title: 'Tu travailles à distance depuis Bali ?', body: 'Rencontre des personnes qui partagent tes centres d’intérêt et faites des choses ensemble, en vrai.', label: 'Trouver mes gens' },
    related: [
      { label: 'Se faire des amis à Bali', path: 'fr/bali/se-faire-des-amis/' },
      { label: 'Reconstruire sa vie sociale après une expatriation', path: 'fr/guides/vie-sociale-expatriation/' },
    ],
  },
  {
    lang: 'en',
    pair: 'dubai-lonely',
    path: 'dubai/lonely/',
    cover: 'dubaiCreek',
    figure: { photo: 'running', after: 1 },
    city: 'Dubai',
    updated: '2026-10-17',
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
</ol>
<p>If you have only just arrived, the practical side (paperwork, housing, getting around) can take all your energy at first: <a href="../moving-to-dubai/">our checklist for your first months in Dubai</a> puts the social side alongside it. If this is not your first move abroad, <a href="../../guides/social-life-after-moving-abroad/">rebuilding your social life after moving abroad</a> covers what tends to happen in the months after any move.</p>`,
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
</ul>
<p>If you would rather start with women-only settings, see <a href="../activities-for-women/">activities for women in Dubai</a>.</p>`,
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
    related: [{ label: 'How to make friends in Dubai', path: 'dubai/make-friends/' }, { label: 'Going out alone in Dubai', path: 'dubai/going-out-alone/' }, { label: 'Moving to Dubai: a checklist for your first months', path: 'dubai/moving-to-dubai/' }, { label: 'Rebuilding your social life after moving abroad', path: 'guides/social-life-after-moving-abroad/' }],
  },
  {
    lang: 'fr',
    pair: 'dubai-lonely',
    path: 'fr/dubai/solitude/',
    cover: 'dubaiCreek',
    figure: { photo: 'running', after: 1 },
    city: 'Dubaï',
    updated: '2026-10-17',
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
</ol>
<p>Si tu viens d’arriver, le côté pratique (démarches, logement, transports) peut prendre toute ton énergie au début : <a href="../s-installer/">notre checklist des premiers mois à Dubaï</a> place la vie sociale à côté. Si ce n’est pas ta première expatriation, <a href="../../guides/vie-sociale-expatriation/">reconstruire sa vie sociale après une expatriation</a> décrit ce qui se passe souvent dans les mois qui suivent un départ.</p>`,
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
</ul>
<p>Si tu préfères commencer par des cadres réservés aux femmes, vois <a href="../activites-entre-femmes/">les activités entre femmes à Dubaï</a>.</p>`,
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
    related: [{ label: 'Se faire des amis à Dubaï', path: 'fr/dubai/se-faire-des-amis/' }, { label: 'Sortir seul à Dubaï', path: 'fr/dubai/sortir-seul/' }, { label: 'S’installer à Dubaï : la checklist des premiers mois', path: 'fr/dubai/s-installer/' }, { label: 'Reconstruire sa vie sociale après une expatriation', path: 'fr/guides/vie-sociale-expatriation/' }],
  },
  {
    lang: 'en',
    pair: 'dubai-going-out-alone',
    path: 'dubai/going-out-alone/',
    cover: 'dubaiMarina',
    figure: { photo: 'volleyball', after: 2 },
    city: 'Dubai',
    updated: '2026-10-13',
    title: 'Going Out Alone in Dubai Without Feeling Awkward | IRLY',
    description: 'How to go out alone in Dubai and enjoy it: plans that work solo, how to start a conversation without forcing it, and simple safety habits.',
    h1: 'Going out alone in Dubai without feeling awkward',
    lead: 'Going out alone in Dubai is normal: many people here arrived on their own, and plenty of plans are designed for one person. The trick is to choose places with something to do, arrive with a small plan, and give yourself permission to leave. Below: plans that work solo, how conversations start, and simple habits to feel at ease.',
    sections: [
      {
        h2: 'Why it feels awkward, and why it gets easier',
        html: `<p>The discomfort is mostly in your head: you notice yourself far more than others notice you. Most people around you are busy with their own evening. It also fades with practice. The first solo dinner feels long; the third feels like time for yourself.</p>
<p>A city where so many people moved alone also means you are rarely the only one on your own, especially at classes, sports sessions and community events.</p>`,
      },
      {
        h2: 'Plans that work well on your own',
        html: `<p>Pick plans with a built-in activity, so you are never just “waiting”:</p>
<ul>
<li><strong>A class or workshop:</strong> cooking, pottery, dance, a language. Everyone arrives alone and the teacher sets the pace.</li>
<li><strong>Group sport:</strong> a run club, a padel session for mixed levels, beach volleyball, climbing. You share an effort before you share a conversation.</li>
<li><strong>Culture:</strong> a museum, a gallery, a cinema, a talk. Being alone is the norm, and there is something to discuss afterwards.</li>
<li><strong>Markets and walks:</strong> in the cooler months, outdoor markets and waterfront walks are easy to enjoy at your own pace.</li>
<li><strong>A meal at the counter:</strong> a seat at the bar or counter feels more natural than a table for one, and staff often chat.</li>
<li><strong>A community event:</strong> a meetup around a hobby, your language or your work. Newcomers are expected there.</li>
</ul>`,
      },
      {
        h2: 'How conversations start without forcing them',
        html: `<ol>
<li><strong>Talk about what is in front of you.</strong> The class, the game, the dish, the film. A shared context makes a first sentence easy.</li>
<li><strong>Ask a small question.</strong> “Is it your first time here?” or “Do you come every week?” Most people are happy to answer.</li>
<li><strong>Come back.</strong> The second time at the same class or club, faces are familiar and talking is much easier.</li>
<li><strong>Suggest a next step only when it fits.</strong> “Same time next week?” is often enough to turn a chat into a habit.</li>
</ol>
<p>And if nobody talks to you, the evening still counts: you went, you did something you like, and the next time will be easier.</p>`,
      },
      {
        h2: 'Simple habits to feel at ease',
        html: `<ul>
<li><strong>Have a small plan.</strong> Know where you are going and roughly how long you will stay. You can always stay longer.</li>
<li><strong>Arrive early.</strong> At a class or an event, the first minutes are the easiest moment to talk.</li>
<li><strong>Bring something to hold your attention.</strong> A book or a notebook makes waiting comfortable; keep the phone for later.</li>
<li><strong>Share your plans with someone you trust.</strong> Tell a friend where you are, and use registered taxis or ride-hailing apps to get home.</li>
<li><strong>Respect local rules.</strong> Dress and behaviour expectations vary by place; when in doubt, look at the venue’s guidelines.</li>
</ul>
<p>In an emergency in the UAE, call <strong>999</strong> (police) or <strong>998</strong> (ambulance).</p>`,
      },
      {
        h2: 'Where IRLY fits in',
        html: `<p>IRLY helps you find plans that are made for joining alone: activities this week with people who want to meet, communities around what you like, and a group chat to say hello before you arrive. IRLY Girl offers spaces for women only. It is one option among others; what matters is going, and going back.</p>`,
      },
    ],
    cta: { title: 'Going out on your own?', body: 'Find an activity this week where joining alone is the norm.', label: 'Find an activity' },
    related: [{ label: 'Lonely in Dubai: what actually helps', path: 'dubai/lonely/' }, { label: '15 group activities to meet people in Dubai', path: 'dubai/group-activities/' }, { label: 'How to make friends in Dubai', path: 'dubai/make-friends/' }, { label: 'Activities for women in Dubai', path: 'dubai/activities-for-women/' }],
  },
  {
    lang: 'fr',
    pair: 'dubai-going-out-alone',
    path: 'fr/dubai/sortir-seul/',
    cover: 'dubaiMarina',
    figure: { photo: 'volleyball', after: 2 },
    city: 'Dubaï',
    updated: '2026-10-13',
    title: 'Sortir seul à Dubaï sans être mal à l’aise | IRLY',
    description: 'Comment sortir seul à Dubaï et en profiter : les sorties qui marchent en solo, lancer une conversation sans forcer, et quelques réflexes de sécurité simples.',
    h1: 'Sortir seul à Dubaï sans être mal à l’aise',
    lead: 'Sortir seul à Dubaï est normal : beaucoup de gens sont arrivés ici sans personne, et de nombreuses sorties sont pensées pour une seule personne. L’astuce : choisir des lieux où il y a quelque chose à faire, arriver avec un petit plan, et s’autoriser à partir. Ci-dessous : les sorties qui marchent en solo, comment la conversation démarre, et des réflexes simples pour être à l’aise.',
    sections: [
      {
        h2: 'Pourquoi c’est gênant au début, et pourquoi ça passe',
        html: `<p>La gêne est surtout dans ta tête : tu te remarques bien plus que les autres ne te remarquent. La plupart des gens autour de toi sont occupés par leur propre soirée. Et ça s’efface avec l’habitude. Le premier dîner seul paraît long ; le troisième devient un moment pour toi.</p>
<p>Dans une ville où tant de gens sont arrivés seuls, tu es rarement la seule personne seule, surtout aux cours, aux séances de sport et aux événements de communauté.</p>`,
      },
      {
        h2: 'Les sorties qui marchent bien en solo',
        html: `<p>Choisis des sorties avec une activité intégrée, pour ne jamais simplement « attendre » :</p>
<ul>
<li><strong>Un cours ou un atelier :</strong> cuisine, poterie, danse, une langue. Tout le monde arrive seul et le professeur donne le rythme.</li>
<li><strong>Le sport en groupe :</strong> un club de course, une séance de padel tous niveaux, du beach-volley, de l’escalade. On partage un effort avant de partager une conversation.</li>
<li><strong>La culture :</strong> un musée, une galerie, un cinéma, une conférence. Être seul y est la norme, et il y a de quoi parler après.</li>
<li><strong>Les marchés et les balades :</strong> pendant les mois plus frais, les marchés en plein air et les promenades au bord de l’eau se savourent à son rythme.</li>
<li><strong>Un repas au comptoir :</strong> une place au bar ou au comptoir paraît plus naturelle qu’une table pour un, et le personnel discute souvent.</li>
<li><strong>Un événement de communauté :</strong> une rencontre autour d’un loisir, de ta langue ou de ton métier. Les nouveaux y sont attendus.</li>
</ul>`,
      },
      {
        h2: 'Lancer une conversation sans forcer',
        html: `<ol>
<li><strong>Parle de ce qui est devant toi.</strong> Le cours, le match, le plat, le film. Un contexte partagé rend la première phrase facile.</li>
<li><strong>Pose une petite question.</strong> « C’est ta première fois ici ? » ou « Tu viens chaque semaine ? ». La plupart des gens répondent volontiers.</li>
<li><strong>Reviens.</strong> La deuxième fois au même cours ou au même club, les visages sont familiers et parler devient bien plus simple.</li>
<li><strong>Propose une suite seulement si ça s’y prête.</strong> « Même heure la semaine prochaine ? » suffit souvent à transformer une discussion en habitude.</li>
</ol>
<p>Et si personne ne te parle, la soirée compte quand même : tu y es allé, tu as fait quelque chose que tu aimes, et la prochaine fois sera plus facile.</p>`,
      },
      {
        h2: 'Des réflexes simples pour être à l’aise',
        html: `<ul>
<li><strong>Prévois un petit plan.</strong> Sache où tu vas et à peu près combien de temps tu restes. Tu peux toujours rester plus longtemps.</li>
<li><strong>Arrive en avance.</strong> À un cours ou un événement, les premières minutes sont le moment le plus facile pour parler.</li>
<li><strong>Emporte de quoi t’occuper.</strong> Un livre ou un carnet rend l’attente agréable ; garde le téléphone pour plus tard.</li>
<li><strong>Dis à quelqu’un de confiance où tu vas.</strong> Préviens un ami, et rentre en taxi officiel ou avec une application de VTC.</li>
<li><strong>Respecte les règles locales.</strong> Les attentes de tenue et de comportement varient selon les lieux ; dans le doute, regarde les consignes de l’endroit.</li>
</ul>
<p>En cas d’urgence aux Émirats, appelle le <strong>999</strong> (police) ou le <strong>998</strong> (ambulance).</p>`,
      },
      {
        h2: 'La place d’IRLY',
        html: `<p>IRLY t’aide à trouver des sorties faites pour venir seul : des activités cette semaine avec des gens qui veulent rencontrer du monde, des communautés autour de ce que tu aimes, et un chat de groupe pour dire bonjour avant d’arriver. IRLY Girl propose des espaces réservés aux femmes. C’est une option parmi d’autres ; ce qui compte, c’est d’y aller, et d’y retourner.</p>`,
      },
    ],
    cta: { title: 'Tu sors seul ?', body: 'Trouve une activité cette semaine où venir seul est la norme.', label: 'Trouver une activité' },
    related: [{ label: 'Se sentir seul à Dubaï', path: 'fr/dubai/solitude/' }, { label: '15 activités de groupe pour rencontrer du monde à Dubaï', path: 'fr/dubai/activites-de-groupe/' }, { label: 'Se faire des amis à Dubaï', path: 'fr/dubai/se-faire-des-amis/' }, { label: 'Activités entre femmes à Dubaï', path: 'fr/dubai/activites-entre-femmes/' }],
  },
  {
    lang: 'en',
    pair: 'dubai-group-activities',
    path: 'dubai/group-activities/',
    cover: 'volleyball',
    figure: { photo: 'running', after: 2 },
    city: 'Dubai',
    updated: '2026-10-11',
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
    related: [{ label: 'How to make friends in Dubai', path: 'dubai/make-friends/' }, { label: 'Lonely in Dubai: what actually helps', path: 'dubai/lonely/' }, { label: 'Networking in Dubai: where to meet entrepreneurs', path: 'dubai/networking/' }],
  },
  {
    lang: 'fr',
    pair: 'dubai-group-activities',
    path: 'fr/dubai/activites-de-groupe/',
    cover: 'volleyball',
    figure: { photo: 'running', after: 2 },
    city: 'Dubai',
    updated: '2026-10-11',
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
    related: [{ label: 'Se faire des amis à Dubaï', path: 'fr/dubai/se-faire-des-amis/' }, { label: 'Se sentir seul à Dubaï', path: 'fr/dubai/solitude/' }, { label: 'Networking à Dubaï : où rencontrer des entrepreneurs', path: 'fr/dubai/networking/' }],
  },
  {
    lang: 'en',
    pair: 'dubai-networking',
    path: 'dubai/networking/',
    cover: 'dubaiMarina',
    figure: { photo: 'brunch', after: 3 },
    city: 'Dubai',
    updated: '2026-10-11',
    title: 'Networking in Dubai: Where to Meet Entrepreneurs | IRLY',
    description: 'Where to meet entrepreneurs and professionals in Dubai, from meetups and coworking events to business groups, and how to turn a first conversation into a real contact.',
    h1: 'Networking in Dubai: where to meet entrepreneurs',
    lead: 'The best places to meet entrepreneurs in Dubai are small, regular gatherings: industry meetups, coworking community events, business groups and startup evenings. Big conferences help you discover a sector, but contacts are built in rooms where you see the same people again. Pick one or two recurring events in your field, go back several times, and follow up within two days.',
    sections: [
      {
        h2: 'Small and regular beats big and once',
        html: `<p>A large conference puts you in front of hundreds of people for a few minutes each. A monthly meetup puts you in front of the same twenty people again and again. The second is where trust, and therefore business, comes from.</p>
<ul>
<li><strong>Recurring events</strong> let people remember your name and what you do.</li>
<li><strong>Small groups</strong> leave time for real conversations, not just card swapping.</li>
<li><strong>A shared topic</strong> (a sector, a skill, a stage of company) gives you something to talk about from the first minute.</li>
</ul>`,
      },
      {
        h2: 'Where to meet entrepreneurs and professionals',
        html: `<h3>Industry and startup meetups</h3>
<p>Tech, marketing, e-commerce, finance, design: most sectors have regular meetups, talks and pitch evenings. Look for the ones that happen every month rather than one-off events.</p>
<h3>Coworking community events</h3>
<p>Many coworking spaces run breakfasts, workshops and talks, often open to non-members. Even a day pass can put you in a room with founders and freelancers.</p>
<h3>Business groups and chambers of commerce</h3>
<p>Business councils, chambers of commerce and groups organised by nationality or by industry hold regular networking events. They are useful if you work with a specific market or country.</p>
<h3>Free zone and accelerator communities</h3>
<p>Companies set up in a free zone, or taking part in an incubator or accelerator programme, often have access to their own events and member networks. Ask what is available when you register.</p>
<h3>Conferences and trade shows</h3>
<p>Dubai hosts large events across many sectors throughout the year. Use them to understand a market and meet a few people, then continue the conversation at smaller events.</p>
<h3>Alumni and professional associations</h3>
<p>University alumni groups and professional associations bring together people who already share something with you, which makes the first conversation easier.</p>`,
      },
      {
        h2: 'How to make a first conversation count',
        html: `<ul>
<li><strong>Say clearly what you do and what you are looking for.</strong> One sentence each. People help those who are easy to help.</li>
<li><strong>Ask more than you pitch.</strong> What are they working on? What would help them right now?</li>
<li><strong>Offer something small.</strong> An introduction, an article, a contact. Giving first is remembered.</li>
<li><strong>Follow up within two days.</strong> A short message recalling where you met and suggesting a coffee works better than a connection request alone.</li>
<li><strong>Meet again.</strong> One coffee rarely makes a contact. The second and third conversations do.</li>
</ul>`,
      },
      {
        h2: 'Timing in Dubai',
        html: `<ul>
<li><strong>The busy season</strong> runs through the cooler months, when most events and conferences take place.</li>
<li><strong>Summer</strong> is often quieter, with more people travelling. It can be a good time for one-to-one coffees.</li>
<li><strong>During Ramadan</strong>, many events move to the evening and the pace changes. Adapt your plans and timing.</li>
</ul>`,
      },
      {
        h2: 'Mistakes to avoid',
        html: `<ul>
<li><strong>Selling in the first minute.</strong> People came to meet, not to be pitched.</li>
<li><strong>Collecting contacts you never follow up.</strong> Ten real conversations are worth more than a hundred cards.</li>
<li><strong>Going to everything once.</strong> Choose a few events and become a familiar face.</li>
<li><strong>Only meeting people from your own sector.</strong> Clients, partners and good ideas often come from next door.</li>
</ul>`,
      },
      {
        h2: 'Where IRLY fits in',
        html: `<p>IRLY has a professional networking space: you create a professional profile with your field and what you are looking for, see people whose goals match yours with the reason why, and send a request they can accept before you start a conversation. You can also join professional communities and create small meetups, a coffee, a breakfast, with people from your field. It is one option among others; going back to the same rooms is what builds a network.</p>`,
      },
    ],
    cta: { title: 'Building your network in Dubai?', body: 'Create your professional profile and meet people whose goals match yours.', label: 'Create my pro profile' },
    related: [{ label: '15 group activities to meet people in Dubai', path: 'dubai/group-activities/' }, { label: 'How to make friends in Dubai', path: 'dubai/make-friends/' }],
  },
  {
    lang: 'fr',
    pair: 'dubai-networking',
    path: 'fr/dubai/networking/',
    cover: 'dubaiMarina',
    figure: { photo: 'brunch', after: 3 },
    city: 'Dubai',
    updated: '2026-10-11',
    title: 'Networking à Dubaï : où rencontrer des entrepreneurs | IRLY',
    description: 'Où rencontrer des entrepreneurs et des professionnels à Dubaï, des meetups aux événements de coworking et aux groupes d’affaires, et comment transformer une première conversation en vrai contact.',
    h1: 'Networking à Dubaï : où rencontrer des entrepreneurs',
    lead: 'Les meilleurs endroits pour rencontrer des entrepreneurs à Dubaï sont les rendez-vous petits et réguliers : meetups de secteur, événements de coworking, groupes d’affaires et soirées startup. Les grandes conférences aident à découvrir un secteur, mais les contacts se construisent dans des salles où l’on revoit les mêmes personnes. Choisis un ou deux événements récurrents dans ton domaine, retournes-y plusieurs fois, et relance dans les deux jours.',
    sections: [
      {
        h2: 'Petit et régulier vaut mieux que grand et ponctuel',
        html: `<p>Une grande conférence te met face à des centaines de personnes, quelques minutes chacune. Un meetup mensuel te met face aux vingt mêmes personnes, encore et encore. C’est le second qui crée la confiance, et donc les affaires.</p>
<ul>
<li><strong>Les événements récurrents</strong> permettent aux gens de retenir ton nom et ce que tu fais.</li>
<li><strong>Les petits groupes</strong> laissent le temps de vraies conversations, pas seulement d’échanger des cartes.</li>
<li><strong>Un sujet commun</strong> (un secteur, une compétence, un stade d’entreprise) donne de quoi parler dès la première minute.</li>
</ul>`,
      },
      {
        h2: 'Où rencontrer des entrepreneurs et des professionnels',
        html: `<h3>Les meetups de secteur et de startups</h3>
<p>Tech, marketing, e-commerce, finance, design : la plupart des secteurs ont leurs meetups, conférences et soirées de pitch réguliers. Cherche ceux qui ont lieu chaque mois plutôt que les événements uniques.</p>
<h3>Les événements des espaces de coworking</h3>
<p>Beaucoup d’espaces de coworking organisent des petits-déjeuners, des ateliers et des conférences, souvent ouverts aux non-membres. Même un pass à la journée peut te mettre dans une salle avec des fondateurs et des freelances.</p>
<h3>Les groupes d’affaires et chambres de commerce</h3>
<p>Les conseils d’affaires, les chambres de commerce et les groupes organisés par nationalité ou par secteur tiennent des soirées de networking régulières. Utile si tu travailles avec un marché ou un pays précis.</p>
<h3>Les communautés de free zones et d’accélérateurs</h3>
<p>Les entreprises installées en free zone, ou qui suivent un programme d’incubation ou d’accélération, ont souvent accès à leurs propres événements et réseaux de membres. Demande ce qui existe au moment de ton enregistrement.</p>
<h3>Les conférences et salons professionnels</h3>
<p>Dubaï accueille de grands événements dans de nombreux secteurs tout au long de l’année. Sers-t’en pour comprendre un marché et rencontrer quelques personnes, puis poursuis la conversation lors d’événements plus petits.</p>
<h3>Les associations d’anciens élèves et professionnelles</h3>
<p>Les réseaux d’anciens élèves et les associations professionnelles réunissent des gens qui partagent déjà quelque chose avec toi, ce qui facilite la première conversation.</p>`,
      },
      {
        h2: 'Comment réussir une première conversation',
        html: `<ul>
<li><strong>Dis clairement ce que tu fais et ce que tu cherches.</strong> Une phrase pour chaque. On aide plus volontiers ceux qu’il est facile d’aider.</li>
<li><strong>Pose plus de questions que tu ne présentes.</strong> Sur quoi travaillent-ils ? Qu’est-ce qui les aiderait en ce moment ?</li>
<li><strong>Propose quelque chose de simple.</strong> Une mise en relation, un article, un contact. Donner en premier, ça se retient.</li>
<li><strong>Relance dans les deux jours.</strong> Un message court qui rappelle où vous vous êtes rencontrés et propose un café marche mieux qu’une simple demande de connexion.</li>
<li><strong>Revois-les.</strong> Un café fait rarement un contact. Ce sont la deuxième et la troisième conversation qui comptent.</li>
</ul>`,
      },
      {
        h2: 'Le bon moment à Dubaï',
        html: `<ul>
<li><strong>La haute saison</strong> couvre les mois plus frais, quand se tiennent la plupart des événements et conférences.</li>
<li><strong>L’été</strong> est souvent plus calme, beaucoup de gens voyagent. C’est un bon moment pour des cafés en tête-à-tête.</li>
<li><strong>Pendant le Ramadan</strong>, beaucoup d’événements passent en soirée et le rythme change. Adapte tes plans et tes horaires.</li>
</ul>`,
      },
      {
        h2: 'Les erreurs à éviter',
        html: `<ul>
<li><strong>Vendre dès la première minute.</strong> Les gens sont venus rencontrer, pas écouter un pitch.</li>
<li><strong>Collectionner des contacts sans jamais relancer.</strong> Dix vraies conversations valent mieux que cent cartes.</li>
<li><strong>Aller à tout, une seule fois.</strong> Choisis quelques événements et deviens un visage familier.</li>
<li><strong>Ne rencontrer que des gens de ton secteur.</strong> Clients, partenaires et bonnes idées viennent souvent d’à côté.</li>
</ul>`,
      },
      {
        h2: 'La place d’IRLY',
        html: `<p>IRLY a un espace de networking professionnel : tu crées un profil pro avec ton domaine et ce que tu cherches, tu vois les personnes dont les objectifs correspondent aux tiens, avec la raison, et tu envoies une demande qu’elles peuvent accepter avant de commencer à discuter. Tu peux aussi rejoindre des communautés professionnelles et créer de petits rendez-vous, un café, un petit-déjeuner, avec des gens de ton secteur. C’est une option parmi d’autres ; c’est en retournant dans les mêmes salles qu’on construit un réseau.</p>`,
      },
    ],
    cta: { title: 'Tu construis ton réseau à Dubaï ?', body: 'Crée ton profil pro et rencontre des personnes dont les objectifs correspondent aux tiens.', label: 'Créer mon profil pro' },
    related: [{ label: '15 activités de groupe pour rencontrer du monde à Dubaï', path: 'fr/dubai/activites-de-groupe/' }, { label: 'Se faire des amis à Dubaï', path: 'fr/dubai/se-faire-des-amis/' }],
  },
  {
    lang: 'en',
    pair: 'dubai-women-activities',
    path: 'dubai/activities-for-women/',
    cover: 'brunch',
    figure: { photo: 'running', after: 1 },
    city: 'Dubai',
    updated: '2026-10-18',
    title: 'Activities for Women in Dubai: Where to Meet Other Women | IRLY',
    description: 'Activities for women in Dubai to meet other women: classes, sport, culture and communities, women-only options, and simple habits to feel at ease.',
    h1: 'Activities for women in Dubai: where to meet other women',
    lead: 'The easiest way to meet other women in Dubai is a regular activity in a small group: a class, a sport session, a book club or a community that meets every week. Women-only options exist for those who prefer them, and many mixed activities are just as welcoming. Below: the kinds of activities that work, how to choose, and how to turn a first meeting into a friendship.',
    sections: [
      {
        h2: 'Why a regular activity works better than a one-off night out',
        html: `<p>Friendships grow from seeing the same faces again. A weekly class or session gives you that without having to organise anything: you come back, people recognise you, and conversation follows. A one-off event can be fun, but it rarely leads to a second meeting on its own.</p>
<p>Small groups help too. In a group of six to twelve, everyone gets to talk; in a crowd of a hundred, most people stay with whoever they came with.</p>`,
      },
      {
        h2: 'Activities that work well to meet other women',
        html: `<ul>
<li><strong>Fitness classes:</strong> yoga, pilates, dance, boxing or spinning. Some studios and gyms offer women-only classes or areas; ask when you visit.</li>
<li><strong>Run and walk clubs:</strong> early morning or evening groups, at an easy pace, often with a coffee afterwards.</li>
<li><strong>Team and racket sports:</strong> padel, tennis, volleyball or netball for mixed levels. Look for “beginners welcome” sessions.</li>
<li><strong>Creative workshops:</strong> pottery, painting, cooking, photography. You have something to do with your hands and something to talk about.</li>
<li><strong>Book clubs and language exchanges:</strong> a set topic each time, and the same group from one session to the next.</li>
<li><strong>Brunches and coffee meetups:</strong> organised by communities around a language, a profession or being new in the city.</li>
<li><strong>Volunteering:</strong> a regular role in a cause you care about puts you next to people who share it.</li>
<li><strong>Mothers’ groups:</strong> playdates and parent meetups are a natural way to meet other mothers in your area.</li>
</ul>`,
      },
      {
        h2: 'Women-only or mixed: choosing what suits you',
        html: `<p>Women-only spaces can feel more relaxed, especially when you are new, when you prefer it for personal or cultural reasons, or for activities such as swimming or fitness. Mixed activities are also a good way to meet women, simply because many of them go alone too.</p>
<p>Try one of each in your first weeks and keep the one where you felt most at ease. What matters most is the format: small, regular, with something to do.</p>`,
      },
      {
        h2: 'From a first meeting to a friendship',
        html: `<ol>
<li><strong>Go back at least three times.</strong> The first session is about finding your way; by the third, people know your name.</li>
<li><strong>Suggest something small.</strong> A coffee after the class or walking together next time is easier to say yes to than a big plan.</li>
<li><strong>Swap contacts naturally.</strong> “Shall we make a group for this class?” works well and includes everyone.</li>
<li><strong>Take the first step.</strong> Many women around you are new too and are waiting for someone to suggest a plan.</li>
</ol>`,
      },
      {
        h2: 'Simple habits to feel safe and at ease',
        html: `<ul>
<li><strong>Meet in public places first.</strong> A studio, a café or a busy park is the right setting for the first meetings.</li>
<li><strong>Tell someone you trust where you are going,</strong> and use registered taxis or ride-hailing apps to get home.</li>
<li><strong>Check the organiser.</strong> A group that has met before, with reviews or a clear page, is a good sign.</li>
<li><strong>Respect local rules.</strong> Dress and behaviour expectations vary by place; when in doubt, look at the venue’s guidelines.</li>
</ul>
<p>In an emergency in the UAE, call <strong>999</strong> (police) or <strong>998</strong> (ambulance).</p>`,
      },
      {
        h2: 'Where IRLY fits in',
        html: `<p>IRLY Girl is a space in the app reserved for women: activities, communities and a feed only women can see, to plan a walk, a class or a brunch together. Access follows the gender chosen when the IRLY account is created, and IRLY’s servers check it for every women-only plan, community and chat; <a href="../../girl/">the IRLY Girl page</a> explains how it works. The rest of IRLY lists mixed activities and communities around what you like. It is one option among others; what matters is finding a group you want to go back to.</p>`,
      },
    ],
    cta: { title: 'Looking for other women to go out with?', body: 'Discover IRLY Girl: activities and communities reserved for women.', label: 'Discover IRLY Girl', href: '/girl' },
    related: [{ label: 'Going out alone in Dubai', path: 'dubai/going-out-alone/' }, { label: '15 group activities to meet people in Dubai', path: 'dubai/group-activities/' }, { label: 'How to make friends in Dubai', path: 'dubai/make-friends/' }],
  },
  {
    lang: 'fr',
    pair: 'dubai-women-activities',
    path: 'fr/dubai/activites-entre-femmes/',
    cover: 'brunch',
    figure: { photo: 'running', after: 1 },
    city: 'Dubaï',
    updated: '2026-10-18',
    title: 'Activités entre femmes à Dubaï : où rencontrer d’autres femmes | IRLY',
    description: 'Des activités entre femmes à Dubaï pour rencontrer d’autres femmes : cours, sport, culture et communautés, options réservées aux femmes, et réflexes simples pour être à l’aise.',
    h1: 'Activités entre femmes à Dubaï : où rencontrer d’autres femmes',
    lead: 'Le plus simple pour rencontrer d’autres femmes à Dubaï : une activité régulière en petit groupe, comme un cours, une séance de sport, un club de lecture ou une communauté qui se retrouve chaque semaine. Des options réservées aux femmes existent pour celles qui les préfèrent, et beaucoup d’activités mixtes sont tout aussi accueillantes. Ci-dessous : les activités qui marchent, comment choisir, et comment transformer une première rencontre en amitié.',
    sections: [
      {
        h2: 'Pourquoi une activité régulière marche mieux qu’une soirée ponctuelle',
        html: `<p>Les amitiés naissent en revoyant les mêmes visages. Un cours ou une séance chaque semaine t’offre ça sans rien organiser : tu reviens, on te reconnaît, et la conversation suit. Un événement ponctuel peut être sympa, mais mène rarement à une deuxième rencontre tout seul.</p>
<p>Les petits groupes aident aussi. À six ou douze, tout le monde parle ; dans une foule de cent personnes, chacune reste avec celles avec qui elle est venue.</p>`,
      },
      {
        h2: 'Les activités qui marchent pour rencontrer d’autres femmes',
        html: `<ul>
<li><strong>Les cours de sport :</strong> yoga, pilates, danse, boxe ou vélo en salle. Certains studios et salles proposent des cours ou des espaces réservés aux femmes ; renseigne-toi sur place.</li>
<li><strong>Les clubs de course et de marche :</strong> tôt le matin ou en soirée, à un rythme tranquille, souvent suivis d’un café.</li>
<li><strong>Les sports d’équipe et de raquette :</strong> padel, tennis, volley ou netball tous niveaux. Cherche les séances « débutantes bienvenues ».</li>
<li><strong>Les ateliers créatifs :</strong> poterie, peinture, cuisine, photo. Les mains sont occupées et on a de quoi parler.</li>
<li><strong>Les clubs de lecture et les échanges de langues :</strong> un thème à chaque fois, et le même groupe d’une séance à l’autre.</li>
<li><strong>Les brunchs et cafés rencontres :</strong> organisés par des communautés autour d’une langue, d’un métier ou du fait d’être nouvelle en ville.</li>
<li><strong>Le bénévolat :</strong> un rôle régulier pour une cause qui te tient à cœur te place à côté de personnes qui la partagent.</li>
<li><strong>Les groupes de mamans :</strong> les sorties avec les enfants et les rencontres de parents sont un moyen naturel de rencontrer d’autres mères près de chez toi.</li>
</ul>`,
      },
      {
        h2: 'Entre femmes ou mixte : choisir ce qui te convient',
        html: `<p>Les espaces réservés aux femmes peuvent paraître plus détendus, surtout quand tu viens d’arriver, quand tu le préfères pour des raisons personnelles ou culturelles, ou pour des activités comme la natation ou le sport en salle. Les activités mixtes sont aussi un bon moyen de rencontrer des femmes, tout simplement parce que beaucoup y viennent seules elles aussi.</p>
<p>Essaie l’une et l’autre pendant tes premières semaines et garde celle où tu t’es sentie le plus à l’aise. Ce qui compte surtout, c’est le format : petit, régulier, avec quelque chose à faire.</p>`,
      },
      {
        h2: 'D’une première rencontre à une amitié',
        html: `<ol>
<li><strong>Reviens au moins trois fois.</strong> La première séance sert à prendre ses repères ; à la troisième, on connaît ton prénom.</li>
<li><strong>Propose quelque chose de petit.</strong> Un café après le cours ou marcher ensemble la prochaine fois, c’est plus facile à accepter qu’un grand projet.</li>
<li><strong>Échange tes contacts naturellement.</strong> « On fait un groupe pour ce cours ? » marche bien et inclut tout le monde.</li>
<li><strong>Fais le premier pas.</strong> Beaucoup de femmes autour de toi sont nouvelles aussi et attendent que quelqu’un propose.</li>
</ol>`,
      },
      {
        h2: 'Des réflexes simples pour être à l’aise et en sécurité',
        html: `<ul>
<li><strong>Retrouvez-vous d’abord dans des lieux publics.</strong> Un studio, un café ou un parc fréquenté conviennent aux premières rencontres.</li>
<li><strong>Dis à quelqu’un de confiance où tu vas,</strong> et rentre en taxi officiel ou avec une application de VTC.</li>
<li><strong>Vérifie qui organise.</strong> Un groupe qui s’est déjà réuni, avec des avis ou une page claire, est bon signe.</li>
<li><strong>Respecte les règles locales.</strong> Les attentes de tenue et de comportement varient selon les lieux ; dans le doute, regarde les consignes de l’endroit.</li>
</ul>
<p>En cas d’urgence aux Émirats, appelle le <strong>999</strong> (police) ou le <strong>998</strong> (ambulance).</p>`,
      },
      {
        h2: 'La place d’IRLY',
        html: `<p>IRLY Girl est un espace de l’app réservé aux femmes : des activités, des communautés et un fil que seules les femmes voient, pour organiser ensemble une balade, un cours ou un brunch. L’accès dépend du genre choisi à la création du compte IRLY, et les serveurs d’IRLY le vérifient pour chaque sortie, communauté et conversation réservées aux femmes ; <a href="../../girl/">la page IRLY Girl</a> explique comment ça marche. Le reste d’IRLY propose des activités et des communautés mixtes autour de ce que tu aimes. C’est une option parmi d’autres ; ce qui compte, c’est de trouver un groupe où tu as envie de revenir.</p>`,
      },
    ],
    cta: { title: 'Tu cherches d’autres femmes avec qui sortir ?', body: 'Découvre IRLY Girl : des activités et des communautés réservées aux femmes.', label: 'Découvrir IRLY Girl', href: '/fr/girl' },
    related: [{ label: 'Sortir seul à Dubaï', path: 'fr/dubai/sortir-seul/' }, { label: '15 activités de groupe pour rencontrer du monde à Dubaï', path: 'fr/dubai/activites-de-groupe/' }, { label: 'Se faire des amis à Dubaï', path: 'fr/dubai/se-faire-des-amis/' }],
  },
  {
    lang: 'en',
    pair: 'dubai-settle',
    path: 'dubai/moving-to-dubai/',
    cover: 'dubaiMarina',
    figure: { photo: 'running', after: 4 },
    city: 'Dubai',
    updated: '2026-10-15',
    title: 'Moving to Dubai: A Checklist for Your First Months | IRLY',
    description: 'Moving to Dubai? A practical checklist for your first months: what to sort first, finding a home, getting around, health insurance and a social life from week one.',
    h1: 'Moving to Dubai: a checklist for your first months',
    lead: 'Your first months in Dubai go more smoothly in a clear order: your residence status and Emirates ID first, because several other steps ask for them, then your home, getting around and health insurance. Make room for people from the first week too: the routines you start early are often the ones that last. Below is a practical checklist, with links to the official pages to check before each step.',
    sections: [
      {
        h2: 'First, check the official rules for your situation',
        html: `<p>Rules and procedures change, and what applies to you depends on your nationality, your employer and your type of residence. This guide gives you an order and practical advice, not legal advice. Before each step, check the official page linked below or the UAE government portal, <a href="https://u.ae/en" rel="noopener">u.ae</a>, and ask your employer or a qualified adviser if your case is not clear.</p>
<p><em>Official sources checked on 15 October 2026.</em></p>`,
      },
      {
        h2: 'Weeks 1 to 4: residence and Emirates ID first',
        html: `<p>Sort out your residence and your Emirates ID before anything else. Several other procedures list the Emirates ID among the documents they ask for, for example registering a tenancy contract or exchanging a driving licence (both below).</p>
<ul>
<li><strong>Keep digital copies</strong> of your passport, visa, Emirates ID and contracts in one place, so you can send them quickly.</li>
<li><strong>Write down every step and its date:</strong> it helps when someone asks for a document you sent weeks ago.</li>
<li><strong>Ask your employer early</strong> what they handle for you and what you need to do yourself.</li>
</ul>`,
      },
      {
        h2: 'Finding a home',
        html: `<ul>
<li><strong>Test the commute before you sign.</strong> Do the trip to work at the time you would really do it. Distances in Dubai look short on a map and feel long at rush hour.</li>
<li><strong>Visit at different times of day</strong> to hear the noise, see the parking and feel the neighbourhood.</li>
<li><strong>Look at what is within walking distance:</strong> a gym, a park, a café. Being close to a place you go every week makes a regular routine much easier.</li>
</ul>
<h3>Registering your tenancy contract</h3>
<p>In Dubai, tenancy contracts are registered in <strong>Ejari</strong>, the Dubai Land Department’s system for recording leases. A tenant can start the registration, but the landlord’s approval is needed to complete it, and the Emirates ID is among the documents listed. Check the current steps on the <a href="https://dubailand.gov.ae/en/eservices/register-renew-ejari-contract/" rel="noopener">Dubai Land Department’s Ejari page</a>.</p>`,
      },
      {
        h2: 'Getting around',
        html: `<p>Before you choose a home, check how you would get to work and to the places you go often, by public transport, taxi or car.</p>
<p>If you plan to drive, find out whether your licence can be exchanged. The Roads and Transport Authority (RTA) lets holders of licences from listed countries exchange them for a Dubai licence; the list depends on the country that issued yours, and the requirements include a valid Emirates ID and an eye test. Check the list and the current requirements on the <a href="https://www.rta.ae/wps/portal/rta/ae/home/rta-services/service-details?serviceId=121" rel="noopener">RTA licence exchange page</a>.</p>`,
      },
      {
        h2: 'Health insurance',
        html: `<p>According to the UAE government portal, since 1 January 2025 employers must buy health insurance for private-sector employees and domestic workers before applying for or renewing their residence permits, and this applies in Dubai. If your situation is different (investor, dependant, retiree or another case), check what applies to you on <a href="https://u.ae/en/information-and-services/health-and-fitness/getting-a-health-insurance" rel="noopener">u.ae</a> before assuming you are covered.</p>
<p>Save the emergency numbers in your phone: <strong>999</strong> for the police and <strong>998</strong> for an ambulance.</p>`,
      },
      {
        h2: 'Build a social life from the first week',
        html: `<p>Paperwork fills the first weeks, and it is easy to postpone everything else. Don’t: the first weeks are when people are most open to new faces, and you are too.</p>
<ol>
<li><strong>Pick one regular activity</strong> in your first week: a run club, a class, a sport. Go back every week.</li>
<li><strong>Say yes to invitations,</strong> even small ones, especially at the start.</li>
<li><strong>Join a community</strong> around your language, your work or something you love.</li>
<li><strong>Plan one social thing every weekend.</strong> Since 2022, the official weekend is Saturday and Sunday.</li>
</ol>
<p>For more ideas, read <a href="../make-friends/">how to make friends in Dubai</a> and <a href="../group-activities/">15 group activities to meet people</a>.</p>`,
      },
      {
        h2: 'Where IRLY fits in',
        html: `<p>IRLY helps with the social side of moving: join communities around what you like, find activities near you and meet people in real life. IRLY VISA, a service to help with paperwork, is coming soon; you can ask to be told when it opens. IRLY is one option among others; for any procedure, the official sources above are the ones to follow.</p>`,
      },
    ],
    cta: { title: 'Just moved to Dubai?', body: 'Meet people from your first week, and ask to be told when IRLY VISA opens.', label: 'Get notified' },
    related: [{ label: 'How to make friends in Dubai', path: 'dubai/make-friends/' }, { label: 'Lonely in Dubai: what actually helps', path: 'dubai/lonely/' }, { label: 'Going out alone in Dubai', path: 'dubai/going-out-alone/' }],
  },
  {
    lang: 'fr',
    pair: 'dubai-settle',
    path: 'fr/dubai/s-installer/',
    cover: 'dubaiMarina',
    figure: { photo: 'running', after: 4 },
    city: 'Dubaï',
    updated: '2026-10-15',
    title: 'S’installer à Dubaï : la checklist des premiers mois | IRLY',
    description: 'Tu t’installes à Dubaï ? Une checklist concrète pour les premiers mois : ce qu’il faut régler d’abord, le logement, les déplacements, l’assurance santé et la vie sociale dès la première semaine.',
    h1: 'S’installer à Dubaï : la checklist des premiers mois',
    lead: 'Les premiers mois à Dubaï se passent mieux dans un ordre clair : ton statut de résident et ton Emirates ID d’abord, parce que plusieurs autres démarches les demandent, puis le logement, les déplacements et l’assurance santé. Garde aussi de la place pour les gens dès la première semaine : les habitudes prises au début sont souvent celles qui restent. Voici une checklist concrète, avec les liens vers les pages officielles à vérifier avant chaque étape.',
    sections: [
      {
        h2: 'D’abord, vérifie les règles officielles pour ta situation',
        html: `<p>Les règles et les démarches changent, et ce qui s’applique à toi dépend de ta nationalité, de ton employeur et de ton type de résidence. Ce guide te donne un ordre et des conseils pratiques, pas un avis juridique. Avant chaque étape, vérifie la page officielle indiquée plus bas ou le portail du gouvernement des Émirats, <a href="https://u.ae/en" rel="noopener">u.ae</a>, et demande à ton employeur ou à un conseiller qualifié si ton cas n’est pas clair.</p>
<p><em>Sources officielles vérifiées le 15 octobre 2026.</em></p>`,
      },
      {
        h2: 'Semaines 1 à 4 : la résidence et l’Emirates ID d’abord',
        html: `<p>Règle ta résidence et ton Emirates ID avant tout le reste. Plusieurs autres démarches citent l’Emirates ID parmi les documents demandés, par exemple l’enregistrement d’un bail ou l’échange d’un permis de conduire (voir plus bas).</p>
<ul>
<li><strong>Garde des copies numériques</strong> de ton passeport, de ton visa, de ton Emirates ID et de tes contrats au même endroit, pour les envoyer vite.</li>
<li><strong>Note chaque étape et sa date :</strong> c’est utile quand on te redemande un document envoyé il y a des semaines.</li>
<li><strong>Demande tôt à ton employeur</strong> ce qu’il prend en charge et ce que tu dois faire toi-même.</li>
</ul>`,
      },
      {
        h2: 'Trouver un logement',
        html: `<ul>
<li><strong>Teste le trajet avant de signer.</strong> Fais le trajet jusqu’au travail à l’heure où tu le ferais vraiment. Les distances à Dubaï paraissent courtes sur une carte et longues à l’heure de pointe.</li>
<li><strong>Visite à différents moments de la journée</strong> pour entendre le bruit, voir le stationnement et sentir le quartier.</li>
<li><strong>Regarde ce qui est à distance de marche :</strong> une salle de sport, un parc, un café. Être près d’un endroit où tu vas chaque semaine rend une routine beaucoup plus facile.</li>
</ul>
<h3>Enregistrer ton bail</h3>
<p>À Dubaï, les baux sont enregistrés dans <strong>Ejari</strong>, le système du Dubai Land Department pour les contrats de location. Le locataire peut lancer l’enregistrement, mais l’accord du propriétaire est nécessaire pour le terminer, et l’Emirates ID fait partie des documents demandés. Vérifie les étapes actuelles sur la <a href="https://dubailand.gov.ae/en/eservices/register-renew-ejari-contract/" rel="noopener">page Ejari du Dubai Land Department</a> (en anglais).</p>`,
      },
      {
        h2: 'Se déplacer',
        html: `<p>Avant de choisir un logement, vérifie comment tu irais au travail et dans les endroits où tu vas souvent, en transports en commun, en taxi ou en voiture.</p>
<p>Si tu comptes conduire, regarde si ton permis peut être échangé. La Roads and Transport Authority (RTA) permet aux titulaires d’un permis délivré par l’un des pays de sa liste de l’échanger contre un permis de Dubaï ; tout dépend du pays qui a délivré le tien, et il faut notamment un Emirates ID valide et un test de vue. Consulte la liste et les conditions actuelles sur la <a href="https://www.rta.ae/wps/portal/rta/ae/home/rta-services/service-details?serviceId=121" rel="noopener">page d’échange de permis de la RTA</a> (en anglais).</p>`,
      },
      {
        h2: 'L’assurance santé',
        html: `<p>Selon le portail du gouvernement des Émirats, depuis le 1er janvier 2025, les employeurs doivent souscrire une assurance santé pour les salariés du secteur privé et les employés de maison avant de demander ou de renouveler leur permis de résidence, et cette règle s’applique à Dubaï. Si ta situation est différente (investisseur, personne à charge, retraité ou autre), vérifie ce qui s’applique à toi sur <a href="https://u.ae/en/information-and-services/health-and-fitness/getting-a-health-insurance" rel="noopener">u.ae</a> avant de te croire couvert.</p>
<p>Enregistre les numéros d’urgence dans ton téléphone : <strong>999</strong> pour la police et <strong>998</strong> pour une ambulance.</p>`,
      },
      {
        h2: 'Construire sa vie sociale dès la première semaine',
        html: `<p>Les démarches remplissent les premières semaines, et il est tentant de remettre tout le reste à plus tard. Ne le fais pas : c’est au début que les gens sont le plus ouverts aux nouveaux visages, et toi aussi.</p>
<ol>
<li><strong>Choisis une activité régulière</strong> dès la première semaine : un club de course, un cours, un sport. Reviens chaque semaine.</li>
<li><strong>Dis oui aux invitations,</strong> même les petites, surtout au début.</li>
<li><strong>Rejoins une communauté</strong> autour de ta langue, de ton métier ou d’une passion.</li>
<li><strong>Prévois une sortie sociale chaque week-end.</strong> Depuis 2022, le week-end officiel est le samedi et le dimanche.</li>
</ol>
<p>Pour d’autres idées, lis <a href="../se-faire-des-amis/">comment se faire des amis à Dubaï</a> et <a href="../activites-de-groupe/">15 activités de groupe pour rencontrer du monde</a>.</p>`,
      },
      {
        h2: 'Où IRLY trouve sa place',
        html: `<p>IRLY t’aide pour le côté social de l’installation : rejoindre des communautés autour de ce que tu aimes, trouver des activités près de chez toi et rencontrer des gens en vrai. IRLY VISA, un service pour t’aider dans les démarches, arrive bientôt ; tu peux demander à être prévenu à son ouverture. IRLY est une option parmi d’autres ; pour toute démarche, ce sont les sources officielles ci-dessus qui font foi.</p>`,
      },
    ],
    cta: { title: 'Tu viens d’arriver à Dubaï ?', body: 'Rencontre du monde dès la première semaine, et demande à être prévenu à l’ouverture d’IRLY VISA.', label: 'Préviens-moi' },
    related: [{ label: 'Comment se faire des amis à Dubaï', path: 'fr/dubai/se-faire-des-amis/' }, { label: 'Se sentir seul à Dubaï : ce qui aide vraiment', path: 'fr/dubai/solitude/' }, { label: 'Sortir seul à Dubaï', path: 'fr/dubai/sortir-seul/' }],
  },
  {
    lang: 'en',
    pair: 'social-life-abroad',
    path: 'guides/social-life-after-moving-abroad/',
    cover: 'volleyball',
    figure: { photo: 'brunch', after: 2 },
    city: 'Life abroad',
    updated: '2026-10-16',
    title: 'Rebuilding Your Social Life After Moving Abroad | IRLY',
    description: 'Moved abroad and starting from zero socially? Why it feels harder than expected, a simple plan for the first three months, and how to turn new faces into real friends.',
    h1: 'Rebuilding your social life after moving abroad',
    lead: 'Rebuilding a social life after a move abroad takes time, and that is normal: at home your circle grew over years, often without effort. Abroad, it grows faster when you give it structure: one regular activity, people you see again, and plans you suggest yourself. Below: why it feels hard, a plan for your first three months, and how to keep going when friends leave.',
    sections: [
      {
        h2: 'Why it feels harder than at home',
        html: `<p>At home, friends came from school, studies, work or the neighbourhood: places you went back to every week without deciding to. Abroad, those places do not exist yet, so you have to create them.</p>
<ul>
<li><strong>No shared history.</strong> The people you meet do not know your story, and you do not know theirs. It takes repeated meetings to get there.</li>
<li><strong>Everyone is busy.</strong> Colleagues and neighbours already have their routines, and adding someone new is rarely their priority.</li>
<li><strong>Language and codes.</strong> Even with a shared language, humour and habits differ, which makes small talk more tiring at first.</li>
<li><strong>Calls home take the evenings.</strong> They keep your old ties alive, but they can also replace going out.</li>
</ul>
<p>None of this means you are doing it wrong. It means friendship needs a frame here that it did not need before.</p>`,
      },
      {
        h2: 'A plan for your first three months',
        html: `<h3>Month 1: be where people are, every week</h3>
<ol>
<li><strong>Pick one regular activity</strong> with the same group each week: a sport, a class, a club, a volunteering shift.</li>
<li><strong>Say yes to every reasonable invitation,</strong> even short ones. You can leave early.</li>
<li><strong>Join one community</strong> around your language, your country or your work: a familiar starting point.</li>
</ol>
<h3>Month 2: see the same people again</h3>
<ol>
<li><strong>Remember names and one detail</strong> about each person, and ask about it next time.</li>
<li><strong>Suggest one small plan a week:</strong> a coffee after the activity, a walk, a meal. Most people are waiting for someone else to propose.</li>
<li><strong>Add a second, different circle</strong> so your social life does not depend on one group.</li>
</ol>
<h3>Month 3: turn acquaintances into friends</h3>
<ol>
<li><strong>Invite people together.</strong> A small group dinner or outing mixes your circles and takes pressure off one-to-one plans.</li>
<li><strong>Create a ritual:</strong> the same brunch, run or game night every week or two. Rituals do the inviting for you.</li>
<li><strong>Share a little more:</strong> friendship grows when conversations go beyond work and weather.</li>
</ol>`,
      },
      {
        h2: 'Mistakes that slow things down',
        html: `<ul>
<li><strong>Waiting to feel settled first.</strong> Paperwork and the flat can fill months. Start meeting people in parallel, from the first week.</li>
<li><strong>Only meeting people once.</strong> One great evening rarely makes a friend; seeing someone again is what counts.</li>
<li><strong>Staying only in your home community.</strong> It is comforting, but mixed groups open more doors.</li>
<li><strong>Judging too fast.</strong> Many friendships start slowly. Give people a few meetings before you decide.</li>
</ul>`,
      },
      {
        h2: 'When friends leave',
        html: `<p>In cities with many newcomers, people also leave often, for a new job or back home. It hurts, and it is part of life abroad.</p>
<ul>
<li><strong>Keep more than one circle,</strong> so one departure does not empty your week.</li>
<li><strong>Keep welcoming new people:</strong> the newcomers of this month are tomorrow’s friends, and you know how they feel.</li>
<li><strong>Stay in touch with those who left.</strong> Friendships can continue at a distance, with a call or a visit.</li>
</ul>`,
      },
      {
        h2: 'When to ask for more help',
        html: `<p>Feeling alone for a while after a move is common. If it lasts, if you feel low most days, or if daily life becomes hard, talk to a doctor or a mental health professional where you live: it is a normal step. In an emergency, call the local emergency number.</p>`,
      },
      {
        h2: 'Where IRLY fits in',
        html: `<p>IRLY is built for this exact moment: join communities around what you like, find activities near you or create your own, and talk with the group before you meet. It starts in Dubai and Bali. It is one option among others; what changes things is the regular activity and the plans you suggest. For city guides, read <a href="../../dubai/make-friends/">how to make friends in Dubai</a> and <a href="../../bali/make-friends/">how to make friends in Bali</a>.</p>`,
      },
    ],
    cta: { title: 'Starting over somewhere new?', body: 'Join a community around what you like and find people to do things with, in real life.', label: 'Find my people' },
    related: [{ label: 'How to make friends in Dubai', path: 'dubai/make-friends/' }, { label: 'How to make friends in Bali', path: 'bali/make-friends/' }, { label: 'Lonely in Dubai: what actually helps', path: 'dubai/lonely/' }],
  },
  {
    lang: 'fr',
    pair: 'social-life-abroad',
    path: 'fr/guides/vie-sociale-expatriation/',
    cover: 'volleyball',
    figure: { photo: 'brunch', after: 2 },
    city: 'Vie à l’étranger',
    updated: '2026-10-16',
    title: 'Reconstruire sa vie sociale après une expatriation | IRLY',
    description: 'Tu t’es expatrié et tu repars de zéro côté amis ? Pourquoi c’est plus dur que prévu, un plan simple pour les trois premiers mois, et comment transformer des connaissances en vrais amis.',
    h1: 'Reconstruire sa vie sociale après une expatriation',
    lead: 'Reconstruire sa vie sociale après une expatriation prend du temps, et c’est normal : chez toi, ton cercle s’est construit sur des années, souvent sans effort. À l’étranger, il se construit plus vite quand tu lui donnes un cadre : une activité régulière, des gens que tu revois, et des plans que tu proposes toi-même. Voici pourquoi c’est difficile, un plan pour tes trois premiers mois, et comment tenir quand des amis partent.',
    sections: [
      {
        h2: 'Pourquoi c’est plus dur que chez soi',
        html: `<p>Chez toi, les amis venaient de l’école, des études, du travail ou du quartier : des lieux où tu retournais chaque semaine sans avoir à le décider. À l’étranger, ces lieux n’existent pas encore : il faut les créer.</p>
<ul>
<li><strong>Pas d’histoire commune.</strong> Les gens que tu rencontres ne connaissent pas ton parcours, et toi non plus le leur. Il faut se revoir plusieurs fois pour y arriver.</li>
<li><strong>Tout le monde est occupé.</strong> Collègues et voisins ont déjà leurs habitudes, et faire de la place à quelqu’un de nouveau est rarement leur priorité.</li>
<li><strong>La langue et les codes.</strong> Même avec une langue commune, l’humour et les habitudes changent, ce qui rend les petites conversations plus fatigantes au début.</li>
<li><strong>Les appels avec la maison prennent les soirées.</strong> Ils entretiennent tes liens, mais peuvent aussi remplacer les sorties.</li>
</ul>
<p>Rien de tout ça ne veut dire que tu t’y prends mal. Ça veut dire qu’ici, l’amitié a besoin d’un cadre dont elle n’avait pas besoin avant.</p>`,
      },
      {
        h2: 'Un plan pour tes trois premiers mois',
        html: `<h3>Mois 1 : être là où sont les gens, chaque semaine</h3>
<ol>
<li><strong>Choisis une activité régulière</strong> avec le même groupe chaque semaine : un sport, un cours, un club, du bénévolat.</li>
<li><strong>Dis oui à chaque invitation raisonnable,</strong> même courte. Tu peux partir tôt.</li>
<li><strong>Rejoins une communauté</strong> autour de ta langue, de ton pays ou de ton métier : un point de départ familier.</li>
</ol>
<h3>Mois 2 : revoir les mêmes personnes</h3>
<ol>
<li><strong>Retiens les prénoms et un détail</strong> sur chaque personne, et reparles-en la fois suivante.</li>
<li><strong>Propose un petit plan par semaine :</strong> un café après l’activité, une balade, un repas. La plupart des gens attendent que quelqu’un d’autre propose.</li>
<li><strong>Ajoute un deuxième cercle, différent,</strong> pour que ta vie sociale ne dépende pas d’un seul groupe.</li>
</ol>
<h3>Mois 3 : transformer des connaissances en amis</h3>
<ol>
<li><strong>Invite des gens ensemble.</strong> Un petit dîner ou une sortie à plusieurs mélange tes cercles et enlève la pression du tête-à-tête.</li>
<li><strong>Crée un rituel :</strong> le même brunch, la même course ou la même soirée jeux toutes les une ou deux semaines. Le rituel invite à ta place.</li>
<li><strong>Partage un peu plus :</strong> l’amitié grandit quand on parle d’autre chose que du travail et de la météo.</li>
</ol>`,
      },
      {
        h2: 'Les erreurs qui ralentissent',
        html: `<ul>
<li><strong>Attendre d’être installé.</strong> Les papiers et l’appartement peuvent prendre des mois. Commence à rencontrer du monde en parallèle, dès la première semaine.</li>
<li><strong>Ne voir les gens qu’une fois.</strong> Une super soirée fait rarement un ami ; c’est de se revoir qui compte.</li>
<li><strong>Rester seulement avec ta communauté d’origine.</strong> C’est rassurant, mais les groupes mélangés ouvrent plus de portes.</li>
<li><strong>Juger trop vite.</strong> Beaucoup d’amitiés démarrent lentement. Laisse quelques rencontres avant de décider.</li>
</ul>`,
      },
      {
        h2: 'Quand des amis partent',
        html: `<p>Dans les villes où arrivent beaucoup de nouveaux, les gens repartent souvent aussi, pour un nouveau poste ou pour rentrer. Ça fait mal, et ça fait partie de la vie à l’étranger.</p>
<ul>
<li><strong>Garde plus d’un cercle,</strong> pour qu’un départ ne vide pas ta semaine.</li>
<li><strong>Continue d’accueillir les nouveaux :</strong> les arrivants de ce mois sont les amis de demain, et tu sais ce qu’ils ressentent.</li>
<li><strong>Reste en contact avec ceux qui partent.</strong> Une amitié peut continuer à distance, avec un appel ou une visite.</li>
</ul>`,
      },
      {
        h2: 'Quand demander plus d’aide',
        html: `<p>Se sentir seul quelque temps après une expatriation est courant. Si ça dure, si tu te sens mal la plupart des jours ou si le quotidien devient difficile, parles-en à un médecin ou à un professionnel de santé mentale là où tu vis : c’est une démarche normale. En cas d’urgence, appelle le numéro d’urgence local.</p>`,
      },
      {
        h2: 'Et IRLY dans tout ça',
        html: `<p>IRLY est pensé pour ce moment-là : rejoindre des communautés autour de ce que tu aimes, trouver des activités près de toi ou créer la tienne, et discuter avec le groupe avant de se voir. L’app commence à Dubaï et à Bali. C’est une option parmi d’autres ; ce qui change les choses, c’est l’activité régulière et les plans que tu proposes. Pour les guides par ville, lis <a href="../../dubai/se-faire-des-amis/">comment se faire des amis à Dubaï</a> et <a href="../../bali/se-faire-des-amis/">comment se faire des amis à Bali</a>.</p>`,
      },
    ],
    cta: { title: 'Tu repars de zéro ailleurs ?', body: 'Rejoins une communauté autour de ce que tu aimes et trouve des gens avec qui faire des choses, en vrai.', label: 'Trouver mes gens' },
    related: [{ label: 'Se faire des amis à Dubaï', path: 'fr/dubai/se-faire-des-amis/' }, { label: 'Se faire des amis à Bali', path: 'fr/bali/se-faire-des-amis/' }, { label: 'Se sentir seul à Dubaï', path: 'fr/dubai/solitude/' }],
  },
];

export const APP_URL = app;
