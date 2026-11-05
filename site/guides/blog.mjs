/**
 * Blog: short articles (about 400 to 600 words) on loneliness, friendship and
 * social life in Dubai, in English and French (same `pair`). Each one answers
 * ONE precise question that the long guides only touch, then links to the
 * guide that covers the topic in full. Topics and their order: docs/BLOG-PLAN.md.
 *
 * Same fields as a guide (site/guides/articles.mjs) plus `published`.
 * Rules: no statistics, testimonials, named venues or facts that were not
 * checked; IRLY is one option among others.
 */
export const POSTS = [
  {
    lang: 'en',
    pair: 'blog-lonely-weekends-dubai',
    path: 'blog/lonely-weekends-dubai/',
    city: 'Dubai',
    published: '2026-11-05',
    title: 'Lonely on Weekends in Dubai? Plan One Thing Before It Starts | IRLY',
    description: 'Weekends are often the loneliest part of the week for newcomers in Dubai. A simple way to fix it: one plan decided before the weekend, with people, at a set time.',
    h1: 'Lonely on weekends in Dubai? Plan one thing before it starts',
    lead: 'For many newcomers, the week is fine: work fills the days. The weekend is where loneliness shows, because nothing is planned and everyone else seems busy. The fix is small: decide one plan with other people, at a set time, before the weekend begins.',
    sections: [
      {
        h2: 'Why the weekend feels harder than the week',
        html: `<p>During the week, work gives you a rhythm and people to talk to. On the weekend that structure disappears. Friends from home are in another time zone, new colleagues have their own lives, and an empty day makes it easy to stay in and scroll. None of this means something is wrong with you. It is what happens when your social life has not had time to grow yet.</p>`,
      },
      {
        h2: 'The one-plan rule',
        html: `<p>Before the weekend starts, book one thing that happens with other people at a fixed time:</p>
<ul>
<li><strong>A group activity with a start time:</strong> a run club, a padel session for mixed levels, a class, a hike, a volunteering morning.</li>
<li><strong>A community meetup</strong> around your language, your work or a hobby.</li>
<li><strong>A small plan you propose yourself:</strong> a coffee or a walk with one person you met during the week.</li>
</ul>
<p>One plan is enough. It gives the weekend a shape, gets you out, and puts you in front of the same faces again the next week.</p>`,
      },
      {
        h2: 'Make it easy to go',
        html: `<ul>
<li><strong>Decide early in the week.</strong> Plans made on the day rarely happen.</li>
<li><strong>Choose something regular.</strong> A weekly session turns strangers into familiar faces by the third time.</li>
<li><strong>Tell someone you are going.</strong> A short message to the organiser or a group chat makes it harder to cancel.</li>
<li><strong>Keep the rest of the weekend free.</strong> Rest is fine once one plan is in.</li>
</ul>`,
      },
      {
        h2: 'If the weekend still feels heavy',
        html: `<p>Loneliness that lasts weeks and weighs on most days is worth talking about with a doctor or a mental health professional; it is a normal step. For more ideas, read our guide on <a href="../../dubai/lonely/">what actually helps when you feel lonely in Dubai</a>, and our list of <a href="../../dubai/group-activities/">group activities to meet people in Dubai</a>.</p>`,
      },
    ],
    cta: { title: 'Nothing planned this weekend?', body: 'Find an activity with people who want to meet, at a set time, in real life.', label: 'Find an activity' },
    related: [
      { label: 'Lonely in Dubai: what actually helps', path: 'dubai/lonely/' },
      { label: 'How to make friends in Dubai', path: 'dubai/make-friends/' },
      { label: 'Going out alone in Dubai', path: 'dubai/going-out-alone/' },
    ],
  },
  {
    lang: 'fr',
    pair: 'blog-lonely-weekends-dubai',
    path: 'fr/blog/week-end-seul-dubai/',
    city: 'Dubaï',
    published: '2026-11-05',
    title: 'Seul le week-end à Dubaï ? Prévois une chose avant qu’il commence | IRLY',
    description: 'Le week-end est souvent le moment le plus solitaire pour les nouveaux arrivants à Dubaï. Une solution simple : un plan décidé avant le week-end, avec du monde, à heure fixe.',
    h1: 'Seul le week-end à Dubaï ? Prévois une chose avant qu’il commence',
    lead: 'Pour beaucoup de nouveaux arrivants, la semaine se passe bien : le travail remplit les journées. C’est le week-end que la solitude se voit, parce que rien n’est prévu et que tout le monde semble occupé. La solution est simple : décider d’un plan avec d’autres personnes, à heure fixe, avant que le week-end commence.',
    sections: [
      {
        h2: 'Pourquoi le week-end est plus dur que la semaine',
        html: `<p>En semaine, le travail donne un rythme et des gens à qui parler. Le week-end, ce cadre disparaît. Les amis restés au pays vivent sur un autre fuseau, les nouveaux collègues ont leur vie, et une journée vide pousse à rester chez soi devant son téléphone. Ça ne veut pas dire que quelque chose ne va pas chez toi : ta vie sociale n’a simplement pas encore eu le temps de grandir.</p>`,
      },
      {
        h2: 'La règle du plan unique',
        html: `<p>Avant que le week-end commence, réserve une chose qui se passe avec d’autres personnes, à heure fixe :</p>
<ul>
<li><strong>Une activité de groupe avec une heure de début :</strong> un club de course, une séance de padel tous niveaux, un cours, une randonnée, une matinée de bénévolat.</li>
<li><strong>Une rencontre de communauté</strong> autour de ta langue, de ton métier ou d’un loisir.</li>
<li><strong>Un petit plan que tu proposes toi-même :</strong> un café ou une balade avec une personne rencontrée dans la semaine.</li>
</ul>
<p>Un seul plan suffit. Il donne une forme au week-end, te fait sortir, et te remet devant les mêmes visages la semaine suivante.</p>`,
      },
      {
        h2: 'Rends-le facile',
        html: `<ul>
<li><strong>Décide tôt dans la semaine.</strong> Les plans décidés le jour même se font rarement.</li>
<li><strong>Choisis quelque chose de régulier.</strong> Une séance chaque semaine transforme des inconnus en visages familiers dès la troisième fois.</li>
<li><strong>Dis à quelqu’un que tu viens.</strong> Un petit message à l’organisateur ou dans un groupe rend l’annulation plus difficile.</li>
<li><strong>Garde le reste du week-end libre.</strong> Se reposer, c’est bien, une fois le plan calé.</li>
</ul>`,
      },
      {
        h2: 'Si le week-end reste pesant',
        html: `<p>Une solitude qui dure des semaines et pèse la plupart des jours mérite d’en parler à un médecin ou à un professionnel de santé mentale : c’est une démarche normale. Pour plus d’idées, lis notre guide <a href="../../dubai/solitude/">ce qui aide vraiment quand on se sent seul à Dubaï</a> et notre liste d’<a href="../../dubai/activites-de-groupe/">activités de groupe pour rencontrer du monde à Dubaï</a>.</p>`,
      },
    ],
    cta: { title: 'Rien de prévu ce week-end ?', body: 'Trouve une activité avec des gens qui veulent se rencontrer, à heure fixe, en vrai.', label: 'Trouver une activité' },
    related: [
      { label: 'Se sentir seul à Dubaï', path: 'fr/dubai/solitude/' },
      { label: 'Se faire des amis à Dubaï', path: 'fr/dubai/se-faire-des-amis/' },
      { label: 'Sortir seul à Dubaï', path: 'fr/dubai/sortir-seul/' },
    ],
  },
  {
    lang: 'en',
    pair: 'blog-introvert-friends-dubai',
    path: 'blog/introvert-make-friends-dubai/',
    city: 'Dubai',
    published: '2026-11-05',
    title: 'Making Friends in Dubai as an Introvert: A Quieter Way In | IRLY',
    description: 'You do not need big parties to make friends in Dubai. As an introvert, small groups, shared activities and repeated meetings work better, and cost less energy.',
    h1: 'Making friends in Dubai as an introvert: a quieter way in',
    lead: 'If crowded events drain you, you can still build real friendships in Dubai. The quieter way in is small groups, a shared activity that does the talking for you, and seeing the same people again and again rather than meeting many people once.',
    sections: [
      {
        h2: 'Pick small, structured settings',
        html: `<p>Large mixers reward people who enjoy talking to strangers for hours. Introverts usually do better where there is a task and a small group:</p>
<ul>
<li><strong>A class or workshop</strong> with the same people every week: a language, cooking, drawing, a craft.</li>
<li><strong>A sport in small numbers:</strong> a doubles game, a climbing session, a running group that splits by pace.</li>
<li><strong>A book club or a board game night,</strong> where the conversation has a topic from the start.</li>
</ul>
<p>Our list of <a href="../../dubai/group-activities/">group activities to meet people in Dubai</a> has more ideas.</p>`,
      },
      {
        h2: 'Let repetition do the work',
        html: `<p>Friendship grows from seeing the same faces regularly, not from one long conversation. Go back to the same session three or four times before deciding if it works. By then people know your name, small talk is easier, and a coffee after feels natural instead of forced.</p>`,
      },
      {
        h2: 'Protect your energy',
        html: `<ul>
<li><strong>One social plan or two a week is enough.</strong> Regular beats intense.</li>
<li><strong>Give yourself an exit.</strong> Decide in advance how long you stay; leaving after an hour is fine.</li>
<li><strong>Prefer one-to-one follow-ups.</strong> A coffee with one person from the group often builds more than another big evening.</li>
<li><strong>Plan quiet time after.</strong> Recharging is part of the plan, not a failure.</li>
</ul>`,
      },
      {
        h2: 'Make the first step small',
        html: `<p>You do not need a great opening line. A question about the activity is enough: “Is this your first time?” or “How long have you been coming?”. If you prefer, message the group before the first session so you already know one name when you arrive. For more, read <a href="../../dubai/make-friends/">how to make friends in Dubai</a> and <a href="../../dubai/going-out-alone/">going out alone in Dubai</a>.</p>`,
      },
    ],
    cta: { title: 'Prefer small groups?', body: 'Find an activity this week with a few people who share your interests, in real life.', label: 'Find my people' },
    related: [
      { label: 'How to make friends in Dubai', path: 'dubai/make-friends/' },
      { label: '15 group activities to meet people in Dubai', path: 'dubai/group-activities/' },
      { label: 'Lonely in Dubai: what actually helps', path: 'dubai/lonely/' },
    ],
  },
  {
    lang: 'fr',
    pair: 'blog-introvert-friends-dubai',
    path: 'fr/blog/introverti-se-faire-des-amis-dubai/',
    city: 'Dubaï',
    published: '2026-11-05',
    title: 'Se faire des amis à Dubaï quand on est introverti : une approche plus calme | IRLY',
    description: 'Pas besoin de grandes soirées pour se faire des amis à Dubaï. Quand on est introverti, les petits groupes, les activités partagées et les rencontres répétées marchent mieux, et fatiguent moins.',
    h1: 'Se faire des amis à Dubaï quand on est introverti : une approche plus calme',
    lead: 'Si les soirées bondées t’épuisent, tu peux quand même construire de vraies amitiés à Dubaï. L’approche plus calme : des petits groupes, une activité qui parle à ta place, et revoir les mêmes personnes plutôt que d’en rencontrer beaucoup une seule fois.',
    sections: [
      {
        h2: 'Choisis des cadres petits et structurés',
        html: `<p>Les grandes soirées de networking avantagent ceux qui aiment parler à des inconnus pendant des heures. Les introvertis sont souvent plus à l’aise avec une activité et un petit groupe :</p>
<ul>
<li><strong>Un cours ou un atelier</strong> avec les mêmes personnes chaque semaine : une langue, la cuisine, le dessin, un loisir créatif.</li>
<li><strong>Un sport en petit nombre :</strong> un match en double, une séance d’escalade, un groupe de course réparti par allure.</li>
<li><strong>Un club de lecture ou une soirée jeux de société,</strong> où la conversation a un sujet dès le départ.</li>
</ul>
<p>Notre liste d’<a href="../../dubai/activites-de-groupe/">activités de groupe pour rencontrer du monde à Dubaï</a> donne d’autres idées.</p>`,
      },
      {
        h2: 'Laisse la répétition faire le travail',
        html: `<p>L’amitié naît du fait de revoir régulièrement les mêmes visages, pas d’une seule longue conversation. Retourne trois ou quatre fois à la même séance avant de juger. À ce moment-là, on connaît ton prénom, les échanges sont plus simples, et un café après devient naturel au lieu d’être forcé.</p>`,
      },
      {
        h2: 'Protège ton énergie',
        html: `<ul>
<li><strong>Un ou deux plans par semaine suffisent.</strong> La régularité vaut mieux que l’intensité.</li>
<li><strong>Prévois une sortie.</strong> Décide à l’avance combien de temps tu restes ; partir au bout d’une heure, c’est bien.</li>
<li><strong>Privilégie les suites en tête-à-tête.</strong> Un café avec une personne du groupe construit souvent plus qu’une nouvelle grande soirée.</li>
<li><strong>Garde du calme après.</strong> Recharger fait partie du plan, ce n’est pas un échec.</li>
</ul>`,
      },
      {
        h2: 'Fais un premier pas tout petit',
        html: `<p>Pas besoin d’une phrase d’accroche brillante. Une question sur l’activité suffit : « C’est ta première fois ? » ou « Tu viens depuis longtemps ? ». Si tu préfères, écris au groupe avant la première séance pour connaître déjà un prénom en arrivant. Pour aller plus loin, lis <a href="../../dubai/se-faire-des-amis/">se faire des amis à Dubaï</a> et <a href="../../dubai/sortir-seul/">sortir seul à Dubaï</a>.</p>`,
      },
    ],
    cta: { title: 'Tu préfères les petits groupes ?', body: 'Trouve une activité cette semaine avec quelques personnes qui partagent tes centres d’intérêt, en vrai.', label: 'Trouver mes gens' },
    related: [
      { label: 'Se faire des amis à Dubaï', path: 'fr/dubai/se-faire-des-amis/' },
      { label: '15 activités de groupe pour rencontrer du monde à Dubaï', path: 'fr/dubai/activites-de-groupe/' },
      { label: 'Se sentir seul à Dubaï', path: 'fr/dubai/solitude/' },
    ],
  },
];
