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
  {
    lang: 'en',
    pair: 'blog-work-friends-dubai',
    path: 'blog/make-friends-at-work-dubai/',
    city: 'Dubai',
    published: '2026-11-06',
    title: 'Making Friends at Work in Dubai Without Making It Awkward | IRLY',
    description: 'Colleagues can become real friends in Dubai if you go slowly: small shared moments, one plan outside the office, and clear limits between work and friendship.',
    h1: 'Making friends at work in Dubai without making it awkward',
    lead: 'Work is where many newcomers spend most of their time, so it is a natural place to start friendships. The trick is to go step by step: small shared moments first, then one simple plan outside the office, while keeping work and friendship separate when it matters. You do not need to be close to everyone; one or two colleagues you enjoy seeing are enough to start.',
    sections: [
      {
        h2: 'Start with small shared moments',
        html: `<ul>
<li><strong>Join the lunch or coffee break</strong> instead of eating at your desk. Regular, low-stakes time together is how colleagues become familiar.</li>
<li><strong>Ask about their life outside work,</strong> not only about projects: where they live, what they do on weekends, how long they have been here.</li>
<li><strong>Remember details.</strong> Asking later how the move, the trip or the weekend went shows you listened.</li>
</ul>`,
      },
      {
        h2: 'Take one step outside the office',
        html: `<p>A friendship starts when you meet without work as the reason. Keep the first plan small and easy to say yes to: a coffee on the weekend, a walk, a game, or joining something they already mentioned they like. Inviting two or three colleagues together often feels less awkward than a one-to-one invitation. If they say no, try once more another time, then let them come to you.</p>`,
      },
      {
        h2: 'Choose plans that suit everyone',
        html: `<p>Teams in Dubai often mix many nationalities, religions and habits. Pick plans most people can join: a coffee, a meal or an activity rather than only drinks, at a time that fits different schedules. If a colleague says no, it is often about timing or family, not about you. A short, open message works well: “A few of us are getting coffee on Saturday morning, want to come?”</p>`,
      },
      {
        h2: 'Keep work and friendship apart when it matters',
        html: `<ul>
<li><strong>Be careful with venting.</strong> Venting about the company or a manager can build a quick bond, but it rarely builds a lasting one, and it can come back to you.</li>
<li><strong>Think twice with your own manager or your team.</strong> Friendly is fine; close friendship with someone you manage, or who manages you, needs more care.</li>
<li><strong>Do not rely on work alone.</strong> Colleagues change jobs and leave. Build at least one circle outside work too.</li>
</ul>`,
      },
      {
        h2: 'Widen your circle from there',
        html: `<p>Colleagues often know other newcomers, clubs and groups. Ask what they do on weekends and whether you can come along once. For more ways to meet people outside the office, read <a href="../../dubai/make-friends/">how to make friends in Dubai</a> and our list of <a href="../../dubai/group-activities/">group activities to meet people in Dubai</a>.</p>`,
      },
    ],
    cta: { title: 'Want a circle outside work?', body: 'Meet people who share your interests and do things together, in real life.', label: 'Find my people' },
    related: [
      { label: 'How to make friends in Dubai', path: 'dubai/make-friends/' },
      { label: 'Making friends in Dubai as an introvert', path: 'blog/introvert-make-friends-dubai/' },
      { label: 'Lonely in Dubai: what actually helps', path: 'dubai/lonely/' },
    ],
  },
  {
    lang: 'fr',
    pair: 'blog-work-friends-dubai',
    path: 'fr/blog/amis-au-travail-dubai/',
    city: 'Dubaï',
    published: '2026-11-06',
    title: 'Se faire des amis au travail à Dubaï sans malaise | IRLY',
    description: 'Des collègues peuvent devenir de vrais amis à Dubaï : avance doucement, propose un plan hors du bureau et garde des limites claires.',
    h1: 'Se faire des amis au travail à Dubaï sans malaise',
    lead: 'Le travail est l’endroit où beaucoup de nouveaux arrivants passent le plus de temps : c’est un point de départ naturel pour des amitiés. L’astuce, c’est d’avancer pas à pas : d’abord des petits moments partagés, puis un plan simple hors du bureau, en gardant travail et amitié séparés quand c’est important. Pas besoin d’être proche de tout le monde : un ou deux collègues que tu aimes voir suffisent pour commencer.',
    sections: [
      {
        h2: 'Commence par des petits moments partagés',
        html: `<ul>
<li><strong>Rejoins la pause déjeuner ou café</strong> au lieu de manger à ton bureau. Du temps régulier et sans enjeu, c’est ce qui rend les collègues familiers.</li>
<li><strong>Intéresse-toi à leur vie hors du travail,</strong> pas seulement aux projets : où ils habitent, ce qu’ils font le week-end, depuis quand ils sont là.</li>
<li><strong>Retiens les détails.</strong> Demander plus tard comment s’est passé le déménagement, le voyage ou le week-end montre que tu as écouté.</li>
</ul>`,
      },
      {
        h2: 'Fais un pas hors du bureau',
        html: `<p>Une amitié commence quand on se voit sans que le travail en soit la raison. Garde le premier plan simple et facile à accepter : un café le week-end, une balade, un match ou un jeu, ou rejoindre une activité qu’ils ont mentionnée. Inviter deux ou trois collègues ensemble est souvent moins gênant qu’une invitation en tête-à-tête. S’ils disent non, propose encore une fois plus tard, puis laisse-les venir vers toi.</p>`,
      },
      {
        h2: 'Choisis des plans qui conviennent à tout le monde',
        html: `<p>À Dubaï, les équipes mêlent souvent beaucoup de nationalités, de religions et d’habitudes. Choisis des plans que la plupart peuvent rejoindre : un café, un repas ou une activité plutôt qu’un simple verre, à un horaire qui convient à des emplois du temps différents. Si un collègue dit non, c’est souvent une question d’horaire ou de famille, pas à cause de toi. Un message court et ouvert marche bien : « On prend un café samedi matin à quelques-uns, tu viens ? »</p>`,
      },
      {
        h2: 'Sépare travail et amitié quand c’est important',
        html: `<ul>
<li><strong>Attention à la critique facile.</strong> Critiquer l’entreprise ou un manager rapproche vite, mais construit rarement un lien durable, et peut se retourner contre toi.</li>
<li><strong>Réfléchis à deux fois avec ton propre manager ou ton équipe.</strong> Être cordial, c’est bien ; une amitié proche avec quelqu’un que tu encadres, ou qui t’encadre, demande plus de prudence.</li>
<li><strong>Ne compte pas que sur le travail.</strong> Les collègues changent de poste et partent. Construis aussi au moins un cercle en dehors.</li>
</ul>`,
      },
      {
        h2: 'Élargis ton cercle à partir de là',
        html: `<p>Les collègues connaissent souvent d’autres nouveaux arrivants, des clubs et des groupes. Demande-leur ce qu’ils font le week-end et si tu peux venir une fois. Pour d’autres façons de rencontrer du monde hors du bureau, lis <a href="../../dubai/se-faire-des-amis/">se faire des amis à Dubaï</a> et notre liste d’<a href="../../dubai/activites-de-groupe/">activités de groupe pour rencontrer du monde à Dubaï</a>.</p>`,
      },
    ],
    cta: { title: 'Envie d’un cercle hors du travail ?', body: 'Rencontre des personnes qui partagent tes centres d’intérêt et faites des choses ensemble, en vrai.', label: 'Trouver mes gens' },
    related: [
      { label: 'Se faire des amis à Dubaï', path: 'fr/dubai/se-faire-des-amis/' },
      { label: 'Se faire des amis à Dubaï quand on est introverti', path: 'fr/blog/introverti-se-faire-des-amis-dubai/' },
      { label: 'Se sentir seul à Dubaï', path: 'fr/dubai/solitude/' },
    ],
  },
  {
    lang: 'en',
    pair: 'blog-lonely-after-breakup',
    path: 'blog/lonely-after-breakup-new-city/',
    city: 'Dubai',
    published: '2026-11-06',
    title: 'Lonely After a Breakup in a New City: First Steps | IRLY',
    description: 'A breakup far from home can leave you alone where your partner was your main person. Small first steps to rebuild a routine and your own circle in Dubai.',
    h1: 'Lonely after a breakup in a new city: first steps',
    lead: 'When you moved for or with a partner, a breakup can take away your main person, your routine and sometimes your shared friends at once. It is normal to feel very alone. The first steps are small: look after the basics, rebuild a simple weekly routine, and start one circle that is yours.',
    sections: [
      {
        h2: 'Why it hits harder far from home',
        html: `<p>In a new city, a partner often fills the roles that friends and family would fill at home: the person you eat with, plan weekends with and talk to at night. When that ends, the gap is bigger, and the friends you had may have been mostly shared. None of this means you will stay alone; it means you are starting your own social life now, and that takes a little time.</p>`,
      },
      {
        h2: 'Look after the basics first',
        html: `<ul>
<li><strong>Keep a simple rhythm:</strong> sleep, meals, some movement and time outside each day.</li>
<li><strong>Tell a few people you trust,</strong> here or back home, and schedule calls instead of waiting for them.</li>
<li><strong>Go easy on big decisions, but check what cannot wait.</strong> If your visa, housing or bank account is linked to your partner, check your situation early with official sources. Other big choices, like leaving the city, can wait a few weeks.</li>
</ul>`,
      },
      {
        h2: 'What to do about shared friends',
        html: `<p>If most of your friends were shared, you do not have to pick sides or step away from everyone. Keep in touch with the people you feel close to, tell them simply that you would like to see them on your own, and accept that some will drift. That is not a judgement on you. In the meantime, the circles you build for yourself will give you people who know you on your own terms.</p>`,
      },
      {
        h2: 'Rebuild a week that is yours',
        html: `<p>Choose one or two regular activities that you pick for yourself, with a set time each week: a class, a sport, a volunteering slot, a community around your language or a hobby. Seeing the same people each week gives you something to look forward to and slowly builds friendships that are not linked to your past relationship. Our guide on <a href="../../dubai/going-out-alone/">going out alone in Dubai</a> can help with the first outings.</p>`,
      },
      {
        h2: 'When to ask for more help',
        html: `<p>If you feel low most days for weeks, cannot sleep or eat properly, or daily life becomes hard, talk to a doctor or a mental health professional where you live; it is a normal step. If you are in danger or think about harming yourself, call the emergency services right away: 999 (police) or 998 (ambulance) in the UAE, or the local emergency number where you are. For more ideas, read <a href="../../dubai/lonely/">what actually helps when you feel lonely in Dubai</a>.</p>`,
      },
    ],
    cta: { title: 'Starting your own circle?', body: 'Join a community around what you like and find a plan this week, in real life.', label: 'Join a community' },
    related: [
      { label: 'Lonely in Dubai: what actually helps', path: 'dubai/lonely/' },
      { label: 'Lonely on weekends in Dubai', path: 'blog/lonely-weekends-dubai/' },
      { label: 'Going out alone in Dubai', path: 'dubai/going-out-alone/' },
    ],
  },
  {
    lang: 'fr',
    pair: 'blog-lonely-after-breakup',
    path: 'fr/blog/seul-apres-rupture-nouvelle-ville/',
    city: 'Dubaï',
    published: '2026-11-06',
    title: 'Seul après une rupture loin de chez toi : les premiers pas | IRLY',
    description: 'Seul après une rupture loin de chez toi ? Des premiers pas simples pour retrouver un rythme et construire ton propre cercle à Dubaï.',
    h1: 'Seul après une rupture loin de chez toi : les premiers pas',
    lead: 'Quand tu as déménagé pour ou avec ton ou ta partenaire, une rupture peut t’enlever d’un coup la personne la plus proche de toi, ta routine et parfois vos amis communs. Se sentir très seul est normal. Les premiers pas sont petits : prendre soin de l’essentiel, retrouver une semaine simple, et commencer un cercle à toi.',
    sections: [
      {
        h2: 'Pourquoi c’est plus dur loin de chez soi',
        html: `<p>Dans une nouvelle ville, le ou la partenaire remplit souvent les rôles que tiendraient les amis et la famille au pays : la personne avec qui on mange, prévoit ses week-ends et parle le soir. Quand ça s’arrête, le vide est plus grand, et les amis que tu avais étaient peut-être surtout communs. Ça ne veut pas dire que tu resteras seul : tu commences maintenant ta propre vie sociale, et ça prend un peu de temps.</p>`,
      },
      {
        h2: 'Prends d’abord soin de l’essentiel',
        html: `<ul>
<li><strong>Garde un rythme simple :</strong> sommeil, repas, un peu de mouvement et du temps dehors chaque jour.</li>
<li><strong>Parles-en à quelques personnes de confiance,</strong> ici ou au pays, et programme des appels au lieu d’attendre.</li>
<li><strong>Ne te presse pas pour les grandes décisions, mais vérifie ce qui ne peut pas attendre.</strong> Si ton visa, ton logement ou ton compte bancaire dépend de ton ou ta partenaire, renseigne-toi tôt auprès des sources officielles. Les autres grands choix, comme quitter la ville, peuvent attendre quelques semaines.</li>
</ul>`,
      },
      {
        h2: 'Et les amis communs ?',
        html: `<p>Si la plupart de tes amis étaient communs, tu n’as pas à choisir un camp ni à t’éloigner de tout le monde. Garde le contact avec ceux dont tu te sens proche, dis-leur simplement que tu aimerais les voir de ton côté, et accepte que certains s’éloignent. Ce n’est pas un jugement sur toi. En attendant, les cercles que tu construis pour toi te donneront des personnes qui te connaissent pour toi-même.</p>`,
      },
      {
        h2: 'Reconstruis une semaine à toi',
        html: `<p>Choisis une ou deux activités régulières, rien que pour toi, à heure fixe chaque semaine : un cours, un sport, du bénévolat, une communauté autour de ta langue ou d’un loisir. Revoir les mêmes personnes chaque semaine donne quelque chose à attendre et construit peu à peu des amitiés qui ne sont pas liées à ta relation passée. Notre guide <a href="../../dubai/sortir-seul/">sortir seul à Dubaï</a> peut aider pour les premières sorties.</p>`,
      },
      {
        h2: 'Quand demander plus d’aide',
        html: `<p>Si tu te sens mal la plupart des jours pendant des semaines, si tu ne dors ou ne manges plus correctement, ou si le quotidien devient difficile, parles-en à un médecin ou à un professionnel de santé mentale là où tu vis : c’est une démarche normale. Si tu es en danger ou si tu penses à te faire du mal, appelle tout de suite les secours : le 999 (police) ou le 998 (ambulance) aux Émirats, ou le numéro d’urgence local là où tu es. Pour d’autres idées, lis <a href="../../dubai/solitude/">ce qui aide vraiment quand on se sent seul à Dubaï</a>.</p>`,
      },
    ],
    cta: { title: 'Tu recommences ton propre cercle ?', body: 'Rejoins une communauté autour de ce que tu aimes et trouve un plan cette semaine, en vrai.', label: 'Rejoindre une communauté' },
    related: [
      { label: 'Se sentir seul à Dubaï', path: 'fr/dubai/solitude/' },
      { label: 'Seul le week-end à Dubaï', path: 'fr/blog/week-end-seul-dubai/' },
      { label: 'Sortir seul à Dubaï', path: 'fr/dubai/sortir-seul/' },
    ],
  },
];
