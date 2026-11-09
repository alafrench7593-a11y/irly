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
  {
    lang: 'en',
    pair: 'blog-gym-class-acquaintance-friend',
    path: 'blog/gym-class-acquaintance-to-friend/',
    city: 'Dubai',
    published: '2026-11-07',
    title: 'From Gym or Class Acquaintance to Friend: The Next Steps | IRLY',
    description: 'You see the same faces at the gym or in class every week. How to go from a nod to a name, then to a first plan, without making it awkward for anyone.',
    h1: 'From gym or class acquaintance to friend: the next steps',
    lead: 'If you already see someone every week at the gym or in a class, the hardest part is done. To turn that acquaintance into a friend, learn their name, use the few minutes before and after the session to talk, then suggest one small plan linked to the activity before moving outside it.',
    sections: [
      {
        h2: 'Move from nodding to names',
        html: `<p>Many of these friendships stop at the same point: you recognise each other, you smile, and that is it. The first step is simply to learn their name and give yours. A good moment is right after a session you both found hard: “That one was tough. I’m Alex, by the way.” Use their name the next time you see them. It sounds small, but it turns a familiar face into a person you know. Some people come only to focus on their workout; if someone keeps their headphones on and answers briefly, respect it and try with someone else.</p>`,
      },
      {
        h2: 'Use the minutes before and after',
        html: `<p>The session itself is rarely the time to talk. The few minutes around it are. Arrive a little early or stay a little after, and build on what you already share:</p>
<ul>
<li><strong>Ask about the activity:</strong> how long they have been coming, which session they prefer, what they are working towards.</li>
<li><strong>Remember one detail</strong> and ask about it the next week: the race they mentioned, the trip, the new job.</li>
<li><strong>Share a little about yourself</strong> too, so the conversation goes both ways.</li>
</ul>
<p>After a few weeks of this, you know each other a bit beyond the activity, and a plan feels natural instead of sudden.</p>`,
      },
      {
        h2: 'Suggest a plan linked to the activity',
        html: `<p>The easiest first invitation stays close to what you already do together, so it does not feel like a big ask:</p>
<ul>
<li>a coffee or breakfast right after the session;</li>
<li>trying a different class, a longer session or a weekend outing together;</li>
<li>going to an event related to the activity, like a match to watch or a beginner workshop.</li>
</ul>
<p>Keep the wording open and easy to decline: “A few of us are getting coffee after, want to join?” Inviting two or three people from the group often feels more relaxed than a one-to-one plan. Swap numbers or join the group chat if there is one, so the next plan does not depend on bumping into each other.</p>`,
      },
      {
        h2: 'Read the signals, then step outside the activity',
        html: `<p>If they say yes and you enjoy it, suggest something away from the activity after a couple of these: a walk, a meal, a game. If they say no, look at how they say it. “Not today, but another time” with a counter-offer is a good sign; two vague answers in a row mean you can let them come to you. Either way, keep going to the session as before, so nothing feels strange. Not every acquaintance becomes a friend, and that is fine: a regular activity keeps bringing new faces. For more, read <a href="../../dubai/make-friends/">how to make friends in Dubai</a> and our list of <a href="../../dubai/group-activities/">group activities to meet people in Dubai</a>.</p>`,
      },
    ],
    cta: { title: 'Want more familiar faces?', body: 'Find a regular activity where the same people come back each week, in real life.', label: 'Find an activity' },
    related: [
      { label: 'How to make friends in Dubai', path: 'dubai/make-friends/' },
      { label: '15 group activities to meet people in Dubai', path: 'dubai/group-activities/' },
      { label: 'Making friends in Dubai as an introvert', path: 'blog/introvert-make-friends-dubai/' },
    ],
  },
  {
    lang: 'fr',
    pair: 'blog-gym-class-acquaintance-friend',
    path: 'fr/blog/connaissance-sport-cours-devenir-ami/',
    city: 'Dubaï',
    published: '2026-11-07',
    title: 'Salle de sport ou cours : faire d’une connaissance un ami | IRLY',
    description: 'Tu croises les mêmes têtes à la salle ou en cours chaque semaine ? Comment passer du simple bonjour au prénom, puis à un premier plan, sans gêne pour personne.',
    h1: 'Salle de sport ou cours : faire d’une connaissance un ami',
    lead: 'Si tu vois déjà quelqu’un chaque semaine à la salle ou en cours, le plus dur est fait. Pour en faire un ami, retiens son prénom, profite des quelques minutes avant et après la séance pour discuter, puis propose un petit plan lié à l’activité avant d’aller plus loin.',
    sections: [
      {
        h2: 'Passe du signe de tête au prénom',
        html: `<p>Beaucoup de ces amitiés bloquent au même endroit : on se reconnaît, on se sourit, et c’est tout. Le premier pas, c’est simplement d’apprendre son prénom et de donner le tien. Un bon moment : juste après une séance difficile pour tout le monde. « Elle était dure, celle-là. Moi, c’est Alex, au fait. » Utilise son prénom la fois suivante. Ça paraît anodin, mais un visage familier devient une personne que tu connais. Certains viennent seulement pour se concentrer sur leur entraînement : si quelqu’un garde ses écouteurs et répond en deux mots, respecte ce choix et tente ta chance avec quelqu’un d’autre.</p>`,
      },
      {
        h2: 'Profite des minutes avant et après',
        html: `<p>Pendant la séance, on a rarement le temps de parler. Les quelques minutes autour, si. Arrive un peu en avance ou reste un peu après, et pars de ce que vous partagez déjà :</p>
<ul>
<li><strong>Parle de l’activité :</strong> depuis quand la personne vient, sa séance préférée, son objectif du moment.</li>
<li><strong>Retiens un détail</strong> et reviens-y la semaine suivante : la course dont vous aviez parlé, le voyage, le nouveau travail.</li>
<li><strong>Parle un peu de toi</strong> aussi, pour que l’échange aille dans les deux sens.</li>
</ul>
<p>Au bout de quelques semaines, vous vous connaissez un peu au-delà de l’activité, et proposer un plan paraît naturel plutôt que soudain.</p>`,
      },
      {
        h2: 'Propose un plan lié à l’activité',
        html: `<p>La première invitation la plus simple reste proche de ce que vous faites déjà ensemble, pour que ce ne soit pas une grosse demande :</p>
<ul>
<li>un café ou un petit-déjeuner juste après la séance ;</li>
<li>essayer ensemble un autre cours, une séance plus longue ou une sortie le week-end ;</li>
<li>aller à un événement lié à l’activité, comme un match à regarder ou un atelier pour débutants.</li>
</ul>
<p>Garde une formulation ouverte, facile à refuser : « On va prendre un café après à quelques-uns, tu viens ? » Inviter deux ou trois personnes du groupe est souvent plus détendu qu’un plan en tête-à-tête. Échange ton numéro ou rejoins le groupe de discussion s’il y en a un, pour que le prochain plan ne dépende pas du hasard.</p>`,
      },
      {
        h2: 'Lis les signaux, puis sors du cadre de l’activité',
        html: `<p>Si la personne dit oui et que le moment est agréable, propose après deux ou trois fois quelque chose en dehors de l’activité : une balade, un repas, un jeu. Si elle dit non, regarde comment. « Pas aujourd’hui, mais une autre fois » avec une autre date proposée, c’est bon signe ; deux réponses vagues d’affilée, et tu peux la laisser revenir vers toi. Dans tous les cas, continue à venir à la séance comme avant, pour que rien ne devienne bizarre. Toutes les connaissances ne deviennent pas des amis, et ce n’est pas grave : une activité régulière amène sans cesse de nouveaux visages. Pour aller plus loin, lis <a href="../../dubai/se-faire-des-amis/">se faire des amis à Dubaï</a> et notre liste d’<a href="../../dubai/activites-de-groupe/">activités de groupe pour rencontrer du monde à Dubaï</a>.</p>`,
      },
    ],
    cta: { title: 'Envie de plus de visages familiers ?', body: 'Trouve une activité régulière où les mêmes personnes reviennent chaque semaine, en vrai.', label: 'Trouver une activité' },
    related: [
      { label: 'Se faire des amis à Dubaï', path: 'fr/dubai/se-faire-des-amis/' },
      { label: '15 activités de groupe pour rencontrer du monde à Dubaï', path: 'fr/dubai/activites-de-groupe/' },
      { label: 'Se faire des amis à Dubaï quand on est introverti', path: 'fr/blog/introverti-se-faire-des-amis-dubai/' },
    ],
  },
  {
    lang: 'en',
    pair: 'blog-friends-dubai-30s',
    path: 'blog/make-friends-dubai-30s/',
    city: 'Dubai',
    published: '2026-11-07',
    title: 'Making Friends in Dubai in Your 30s: What Changes | IRLY',
    description: 'In your 30s, people in Dubai have less free time and very different lives. How to make friends anyway: regular plans, a clear ask, and a circle of mixed ages.',
    h1: 'Making friends in Dubai in your 30s: what changes',
    lead: 'Making friends in your 30s in Dubai works, but not the way it did at 20: people have less free time, more varied lives and fewer late nights out. What helps is choosing regular plans that fit busy schedules, saying clearly that you want to meet people, and not limiting yourself to people at your exact stage of life.',
    sections: [
      {
        h2: 'What is different in your 30s',
        html: `<p>At this age, many people around you are busy with careers, partners or young children, and their free time is often planned weeks ahead. Friendships no longer grow from long nights out or years spent in the same classroom. That does not mean people are closed to new friends. Many want them too, especially those who moved here themselves. It just means friendship needs a bit more intention and a place in the calendar.</p>`,
      },
      {
        h2: 'Choose plans that fit a busy life',
        html: `<ul>
<li><strong>Regular and short:</strong> a weekly morning sport session, an evening class, a monthly book club. A fixed slot is easier to keep than a vague “let’s catch up”.</li>
<li><strong>Mornings and daytime:</strong> they often suit people who work long hours or keep evenings for family.</li>
<li><strong>Plans that welcome partners or children,</strong> if that is your situation or theirs: a walk, a picnic, a meetup in a park.</li>
</ul>
<p>Our list of <a href="../../dubai/group-activities/">group activities to meet people in Dubai</a> has ideas to start with.</p>`,
      },
      {
        h2: 'Say clearly that you are looking for friends',
        html: `<p>In your 30s, saying “I’m fairly new here and trying to meet people” is not strange; many people will relate. Being direct saves time and makes it easier for others to invite you. When you get along with someone, suggest a specific plan with a day and a time rather than “we should meet up sometime”. Before you leave, agree on the next one: busy people keep what is in their calendar.</p>`,
      },
      {
        h2: 'Mix ages and life stages',
        html: `<p>You do not need friends who are exactly your age or in exactly your situation. Single or in a couple, with or without children, a few years younger or older: shared interests matter more than matching lives. A mixed circle also means someone is free on the evenings when others are not. If it feels slow, that is normal; friendships take a few months of regular plans at any age. For more, read <a href="../../dubai/make-friends/">how to make friends in Dubai</a> and, if quiet days weigh on you, <a href="../../dubai/lonely/">what actually helps when you feel lonely in Dubai</a>.</p>`,
      },
    ],
    cta: { title: 'Busy week, little free time?', body: 'Find a regular activity that fits your schedule, with people who want to meet too, in real life.', label: 'Find my people' },
    related: [
      { label: 'How to make friends in Dubai', path: 'dubai/make-friends/' },
      { label: 'Making friends at work in Dubai', path: 'blog/make-friends-at-work-dubai/' },
      { label: '15 group activities to meet people in Dubai', path: 'dubai/group-activities/' },
    ],
  },
  {
    lang: 'fr',
    pair: 'blog-friends-dubai-30s',
    path: 'fr/blog/se-faire-des-amis-dubai-trentaine/',
    city: 'Dubaï',
    published: '2026-11-07',
    title: 'Se faire des amis à Dubaï à 30 ans : ce qui change | IRLY',
    description: 'Dans la trentaine à Dubaï, on a moins de temps libre et des vies variées. Comment se faire des amis quand même : plans réguliers, demande claire, âges mélangés.',
    h1: 'Se faire des amis à Dubaï dans la trentaine : ce qui change',
    lead: 'Se faire des amis à Dubaï dans la trentaine, c’est possible, mais pas comme à 20 ans : les gens ont moins de temps libre, des vies plus variées et moins de soirées qui finissent tard. Ce qui aide : choisir des plans réguliers qui collent à des emplois du temps chargés, dire clairement que tu cherches à rencontrer du monde, et ne pas te limiter aux personnes qui vivent exactement la même étape que toi.',
    sections: [
      {
        h2: 'Ce qui change dans la trentaine',
        html: `<p>À cet âge, beaucoup de gens autour de toi sont pris par leur carrière, leur couple ou de jeunes enfants, et leur temps libre se planifie souvent des semaines à l’avance. Les amitiés ne naissent plus des longues soirées ou des années passées sur les mêmes bancs. Ça ne veut pas dire que les gens sont fermés : beaucoup cherchent aussi de nouveaux amis, surtout ceux qui sont arrivés ici comme toi. Simplement, l’amitié demande un peu plus d’intention et une place dans l’agenda.</p>`,
      },
      {
        h2: 'Choisis des plans compatibles avec une vie chargée',
        html: `<ul>
<li><strong>Réguliers et courts :</strong> une séance de sport le matin chaque semaine, un cours en soirée, un club de lecture une fois par mois. Un créneau fixe tient mieux qu’un vague « on se voit bientôt ».</li>
<li><strong>Le matin et en journée :</strong> ces horaires conviennent souvent à ceux qui travaillent tard ou gardent leurs soirées pour la famille.</li>
<li><strong>Des plans ouverts aux conjoints ou aux enfants,</strong> si c’est ta situation ou la leur : une balade, un pique-nique, une rencontre dans un parc.</li>
</ul>
<p>Notre liste d’<a href="../../dubai/activites-de-groupe/">activités de groupe pour rencontrer du monde à Dubaï</a> donne des idées pour commencer.</p>`,
      },
      {
        h2: 'Dis clairement que tu cherches des amis',
        html: `<p>Dans la trentaine, dire « Je suis arrivé(e) il y a peu et j’essaie de rencontrer du monde » n’a rien de bizarre : beaucoup s’y reconnaîtront. Être direct fait gagner du temps et aide les autres à t’inviter. Quand le courant passe avec quelqu’un, propose un plan précis, avec un jour et une heure, plutôt qu’un « faudrait qu’on se voie un de ces jours ». Avant de vous quitter, cale le suivant : les gens occupés gardent ce qui est dans leur agenda.</p>`,
      },
      {
        h2: 'Mélange les âges et les étapes de vie',
        html: `<p>Pas besoin d’amis qui ont exactement ton âge ou vivent exactement ta situation. Célibataire ou en couple, avec ou sans enfants, quelques années de plus ou de moins : les centres d’intérêt communs comptent plus que des vies identiques. Un cercle varié, c’est aussi quelqu’un de disponible les soirs où les autres ne le sont pas. Si ça te paraît lent, c’est normal : à tout âge, une amitié demande quelques mois de plans réguliers. Pour aller plus loin, lis <a href="../../dubai/se-faire-des-amis/">se faire des amis à Dubaï</a> et, si les journées calmes te pèsent, <a href="../../dubai/solitude/">ce qui aide vraiment quand on se sent seul à Dubaï</a>.</p>`,
      },
    ],
    cta: { title: 'Semaine chargée, peu de temps libre ?', body: 'Trouve une activité régulière qui colle à ton emploi du temps, avec des gens qui veulent aussi se rencontrer, en vrai.', label: 'Trouver mes gens' },
    related: [
      { label: 'Se faire des amis à Dubaï', path: 'fr/dubai/se-faire-des-amis/' },
      { label: 'Se faire des amis au travail à Dubaï', path: 'fr/blog/amis-au-travail-dubai/' },
      { label: '15 activités de groupe pour rencontrer du monde à Dubaï', path: 'fr/dubai/activites-de-groupe/' },
    ],
  },
  {
    lang: 'en',
    pair: 'blog-friends-dubai-40s-50s',
    path: 'blog/make-friends-dubai-40s-50s/',
    city: 'Dubai',
    published: '2026-11-08',
    title: 'Making Friends in Dubai in Your 40s and 50s: How to Start | IRLY',
    description: 'New in Dubai in your 40s or 50s? Where friendships grow at this stage: roles that use your experience, inviting people home, and circles of all ages.',
    h1: 'Making friends in Dubai in your 40s and 50s: how to start',
    lead: 'Making friends in Dubai in your 40s and 50s is very possible, but it rarely happens at events built for a younger crowd. At this stage, friendships tend to grow from a role you take on, from people you invite into your home, and from shared values more than shared nights out. You also need fewer new friends than you might think: one or two people you can call often matter more than a full calendar.',
    sections: [
      {
        h2: 'What is specific at this stage',
        html: `<p>Many people arrive in Dubai at this age with a settled life: a senior job, teenage or grown-up children, sometimes children who stayed in another country. The ready-made social life that came with school gates or first jobs may not be there anymore. Many advertised events seem aimed at people in their twenties, and it is easy to conclude there is no place for you. That conclusion is usually wrong. Plenty of people your age moved here too and are looking for the same thing; they are simply in other places.</p>`,
      },
      {
        h2: 'Look for roles where your experience counts',
        html: `<p>At this stage, a role often works better than a mixer. When you help run something, you see the same people regularly and you have a reason to talk from the first day:</p>
<ul>
<li><strong>Volunteering</strong> with a regular slot, where your organisation or practical skills are useful.</li>
<li><strong>Mentoring or teaching a skill</strong> you know well: a language, a craft, a sport, your profession.</li>
<li><strong>A professional association or alumni group</strong> linked to your field, your country or your former university.</li>
<li><strong>A community around your language, culture or faith,</strong> where newcomers of all ages are usually welcome.</li>
<li><strong>A school or residents’ committee,</strong> if you have children at school or live in a community with shared spaces.</li>
</ul>
<p>Our list of <a href="../../dubai/group-activities/">group activities to meet people in Dubai</a> has more ideas to start with.</p>`,
      },
      {
        h2: 'Be the one who invites',
        html: `<p>Many people your age would like more friends but wait for someone else to take the first step. You can be that person. Invite two or three people you have met to a simple meal at home, suggest a regular weekend walk, or start a small monthly dinner where each guest brings someone new. An invitation to someone’s home feels personal in a way a group event does not, and many people find hosting easier at this stage of life. Keep it simple and regular: the same plan each month builds more than one big evening.</p>`,
      },
      {
        h2: 'Keep old friendships, and give new ones time',
        html: `<p>The friends you already have, at home or elsewhere, still count. Schedule calls with them instead of waiting for the right moment; they make the first months here lighter. With new people, do not filter by age: your next good friend may be ten years younger or older, and shared interests matter more than the same birth year. Expect it to take some months of regular plans, as at any age. If the quiet weeks start to weigh on you, talking to a doctor or a mental health professional is a normal step. For more, read <a href="../../dubai/make-friends/">how to make friends in Dubai</a> and <a href="../../dubai/lonely/">what actually helps when you feel lonely in Dubai</a>.</p>`,
      },
    ],
    cta: { title: 'Ready to meet people at your own pace?', body: 'Find a regular activity with people who want to meet too, whatever their age, in real life.', label: 'Find my people' },
    related: [
      { label: 'How to make friends in Dubai', path: 'dubai/make-friends/' },
      { label: 'Making friends in Dubai in your 30s', path: 'blog/make-friends-dubai-30s/' },
      { label: '15 group activities to meet people in Dubai', path: 'dubai/group-activities/' },
    ],
  },
  {
    lang: 'fr',
    pair: 'blog-friends-dubai-40s-50s',
    path: 'fr/blog/se-faire-des-amis-dubai-40-50-ans/',
    city: 'Dubaï',
    published: '2026-11-08',
    title: 'Se faire des amis à Dubaï après 40 ans : par où commencer | IRLY',
    description: 'Nouveau ou nouvelle à Dubaï à 40 ou 50 ans ? Où naissent les amitiés à cet âge : un rôle qui valorise ton expérience, recevoir chez toi, des amis de tous âges.',
    h1: 'Se faire des amis à Dubaï après 40 ans : par où commencer',
    lead: 'Se faire des amis à Dubaï à 40 ou 50 ans, c’est tout à fait possible, mais rarement dans des soirées pensées pour un public plus jeune. À cette étape, les amitiés naissent plutôt d’un rôle que tu prends, des personnes que tu invites chez toi, et de valeurs partagées plus que de sorties. Et il te faut moins de nouveaux amis que tu ne le crois : une ou deux personnes que tu peux appeler souvent comptent plus qu’un agenda plein.',
    sections: [
      {
        h2: 'Ce qui est propre à cette étape',
        html: `<p>Beaucoup de gens arrivent à Dubaï à cet âge avec une vie déjà installée : un poste à responsabilités, des enfants ados ou adultes, parfois des enfants restés dans un autre pays. La vie sociale toute faite qui venait avec l’école des enfants ou les premiers boulots n’est plus forcément là. Beaucoup d’événements annoncés semblent viser les vingtenaires, et on en conclut vite qu’il n’y a pas de place pour soi. C’est rarement vrai. De nombreuses personnes de ton âge sont arrivées ici aussi et cherchent la même chose : elles sont simplement ailleurs.</p>`,
      },
      {
        h2: 'Cherche des rôles où ton expérience compte',
        html: `<p>À cette étape, un rôle marche souvent mieux qu’une soirée de rencontres. Quand tu aides à faire tourner quelque chose, tu revois les mêmes personnes régulièrement et tu as une raison de parler dès le premier jour :</p>
<ul>
<li><strong>Du bénévolat</strong> avec un créneau régulier, où ton sens de l’organisation ou tes compétences pratiques servent.</li>
<li><strong>Du mentorat ou l’enseignement d’un savoir-faire</strong> que tu maîtrises : une langue, un loisir créatif, un sport, ton métier.</li>
<li><strong>Une association professionnelle ou un réseau d’anciens élèves</strong> lié à ton secteur, à ton pays ou à ton ancienne université.</li>
<li><strong>Une communauté autour de ta langue, de ta culture ou de ta foi,</strong> où les nouveaux arrivants de tous âges sont en général bien accueillis.</li>
<li><strong>Un comité de parents ou de résidents,</strong> si tes enfants sont scolarisés ou si tu vis dans une résidence avec des espaces communs.</li>
</ul>
<p>Notre liste d’<a href="../../dubai/activites-de-groupe/">activités de groupe pour rencontrer du monde à Dubaï</a> donne d’autres idées pour commencer.</p>`,
      },
      {
        h2: 'Sois la personne qui invite',
        html: `<p>Beaucoup de gens de ton âge aimeraient avoir plus d’amis, mais attendent que quelqu’un d’autre fasse le premier pas. Tu peux être cette personne. Invite deux ou trois personnes rencontrées à un repas simple chez toi, propose une balade régulière le week-end, ou lance un petit dîner mensuel où chaque invité amène quelqu’un de nouveau. Une invitation à la maison a quelque chose de personnel qu’un événement de groupe n’a pas, et beaucoup trouvent plus facile de recevoir à cette étape de la vie. Reste simple et régulier : le même plan chaque mois construit plus qu’une grande soirée.</p>`,
      },
      {
        h2: 'Garde tes anciennes amitiés, et laisse du temps aux nouvelles',
        html: `<p>Les amis que tu as déjà, au pays ou ailleurs, comptent toujours. Prévois des appels avec eux au lieu d’attendre le bon moment : ils rendent les premiers mois ici plus légers. Avec les nouvelles personnes, ne trie pas par âge : ton prochain bon ami a peut-être dix ans de plus ou de moins, et les centres d’intérêt communs comptent plus que l’année de naissance. Compte quelques mois de plans réguliers, comme à tout âge. Si les semaines calmes commencent à te peser, en parler à un médecin ou à un professionnel de santé mentale est une démarche normale. Pour aller plus loin, lis <a href="../../dubai/se-faire-des-amis/">se faire des amis à Dubaï</a> et <a href="../../dubai/solitude/">ce qui aide vraiment quand on se sent seul à Dubaï</a>.</p>`,
      },
    ],
    cta: { title: 'Envie de rencontrer du monde à ton rythme ?', body: 'Trouve une activité régulière avec des gens qui veulent aussi se rencontrer, quel que soit leur âge, en vrai.', label: 'Trouver mes gens' },
    related: [
      { label: 'Se faire des amis à Dubaï', path: 'fr/dubai/se-faire-des-amis/' },
      { label: 'Se faire des amis à Dubaï dans la trentaine', path: 'fr/blog/se-faire-des-amis-dubai-trentaine/' },
      { label: '15 activités de groupe pour rencontrer du monde à Dubaï', path: 'fr/dubai/activites-de-groupe/' },
    ],
  },
  {
    lang: 'en',
    pair: 'blog-couple-social-life-dubai',
    path: 'blog/new-dubai-couple-social-life/',
    city: 'Dubai',
    published: '2026-11-08',
    title: 'New in Dubai as a Couple: Building a Social Life Together | IRLY',
    description: 'Moving to Dubai as a couple can turn into a bubble for two. How to build a shared circle, keep a few plans of your own, and find a pace that suits you both.',
    h1: 'New in Dubai as a couple: building a social life together',
    lead: 'Arriving in Dubai with a partner is a real help, but it also makes it easy to stay in a comfortable bubble for two. To build a social life as a couple, do a few regular things together where you meet other people, keep at least one plan each of your own, and talk openly about how much social time you each want.',
    sections: [
      {
        h2: 'Why couples can end up isolated',
        html: `<p>When you move with a partner, you always have someone to eat with, explore with and talk to in the evening. That is a good thing, and it also means there is less pressure to go out and meet people. Weeks pass, then months, and you realise you mostly see each other and a few colleagues. If one of you works long hours or travels a lot, the other often feels the gap first. None of this says anything bad about your relationship; it simply means your social life needs some attention, like everything else in a new city.</p>`,
      },
      {
        h2: 'Build a shared circle',
        html: `<ul>
<li><strong>Pick one regular activity you both enjoy</strong> where the same people come back: a weekend sport, a hiking group, a class, a quiz night, a volunteering slot.</li>
<li><strong>Invite people home.</strong> A simple meal with another couple, a neighbour or a colleague turns acquaintances into friends faster than meeting outside.</li>
<li><strong>Do not only look for other couples.</strong> Single friends, friends with children and friends without them all bring something different, and mixed groups keep your circle open.</li>
<li><strong>Say yes as a pair when you can,</strong> then invite them back a few weeks later so the contact does not fade.</li>
</ul>
<p>Our list of <a href="../../dubai/group-activities/">group activities to meet people in Dubai</a> has ideas you can try together.</p>`,
      },
      {
        h2: 'Keep a few plans of your own',
        html: `<p>A shared circle grows faster when each of you also has something on your own: one activity a week, a class, a sport or a community around your language or work. You meet people you would not meet together, and you can bring them into the shared circle later. It also avoids a common pattern where one partner organises the whole social life and the other simply follows. If going alone feels uncomfortable at first, our guide on <a href="../../dubai/going-out-alone/">going out alone in Dubai</a> can help.</p>`,
      },
      {
        h2: 'Agree on a pace that suits you both',
        html: `<p>Partners rarely want the same amount of social time. One may want plans every weekend, the other a quiet evening after a long week. Talk about it openly: how many plans a week feel right, which evenings stay free for just the two of you, and who you would each like to see more. A small compromise, like one shared plan and one solo plan each week, usually works better than one of you always giving in. If the move puts real strain on your relationship, or one of you feels low for weeks, a couples counsellor or a mental health professional can help; it is a normal step. For more ideas, read <a href="../../dubai/make-friends/">how to make friends in Dubai</a>.</p>`,
      },
    ],
    cta: { title: 'Looking for plans for two?', body: 'Find a regular activity you can join together, with people who want to meet too, in real life.', label: 'Find an activity' },
    related: [
      { label: 'How to make friends in Dubai', path: 'dubai/make-friends/' },
      { label: '15 group activities to meet people in Dubai', path: 'dubai/group-activities/' },
      { label: 'Lonely on weekends in Dubai', path: 'blog/lonely-weekends-dubai/' },
    ],
  },
  {
    lang: 'fr',
    pair: 'blog-couple-social-life-dubai',
    path: 'fr/blog/arriver-dubai-en-couple-vie-sociale/',
    city: 'Dubaï',
    published: '2026-11-08',
    title: 'En couple à Dubaï : construire une vie sociale à deux | IRLY',
    description: 'Arriver à Dubaï en couple peut vite devenir une bulle à deux. Comment créer un cercle commun, garder chacun ses plans et trouver un rythme qui vous va.',
    h1: 'En couple à Dubaï : construire une vie sociale à deux',
    lead: 'Arriver à Dubaï à deux est une vraie aide, mais ça rend aussi très facile de rester dans une bulle confortable. Pour construire une vie sociale en couple, prévoyez ensemble quelques activités régulières où vous rencontrez d’autres gens, garde au moins un plan rien qu’à toi, et parlez franchement du temps social que chacun de vous souhaite.',
    sections: [
      {
        h2: 'Pourquoi un couple peut finir isolé',
        html: `<p>Quand tu déménages à deux, tu as toujours quelqu’un avec qui manger, découvrir la ville et parler le soir. C’est une chance, et c’est aussi pour ça qu’on ressent moins le besoin de sortir rencontrer du monde. Les semaines passent, puis les mois, et tu te rends compte que vous ne voyez presque que l’un l’autre et quelques collègues. Si l’un de vous travaille tard ou voyage souvent, l’autre ressent souvent le manque en premier. Ça ne dit rien de négatif sur votre couple : votre vie sociale demande simplement un peu d’attention, comme tout le reste dans une nouvelle ville.</p>`,
      },
      {
        h2: 'Construis un cercle commun',
        html: `<ul>
<li><strong>Choisissez ensemble une activité régulière qui vous plaît à tous les deux,</strong> où les mêmes personnes reviennent : un sport le week-end, un groupe de randonnée, un cours, une soirée quiz, un créneau de bénévolat.</li>
<li><strong>Invite des gens chez vous.</strong> Un repas simple avec un autre couple, un voisin ou une collègue transforme des connaissances en amis plus vite qu’une sortie dehors.</li>
<li><strong>Ne cherche pas que d’autres couples.</strong> Les amis célibataires, ceux qui ont des enfants et ceux qui n’en ont pas apportent chacun quelque chose de différent, et les groupes mélangés gardent votre cercle ouvert.</li>
<li><strong>Dis oui à deux quand c’est possible,</strong> puis propose un plan à ton tour quelques semaines plus tard pour que le contact ne s’éteigne pas.</li>
</ul>
<p>Notre liste d’<a href="../../dubai/activites-de-groupe/">activités de groupe pour rencontrer du monde à Dubaï</a> donne des idées à tester ensemble.</p>`,
      },
      {
        h2: 'Garde quelques plans rien qu’à toi',
        html: `<p>Un cercle commun grandit plus vite quand chacun de vous a aussi quelque chose de son côté : une activité par semaine, un cours, un sport ou une communauté autour de sa langue ou de son métier. Tu rencontres des gens que vous n’auriez pas rencontrés ensemble, et tu peux les faire entrer plus tard dans le cercle commun. Ça évite aussi un schéma fréquent où l’un organise toute la vie sociale et l’autre se contente de suivre. Si sortir seul te met mal à l’aise au début, notre guide <a href="../../dubai/sortir-seul/">sortir seul à Dubaï</a> peut aider.</p>`,
      },
      {
        h2: 'Trouve un rythme qui vous convient à tous les deux',
        html: `<p>Deux partenaires veulent rarement la même dose de vie sociale. L’un a envie de plans chaque week-end, l’autre d’une soirée calme après une longue semaine. Parlez-en franchement tous les deux : combien de plans par semaine vous semblent justes, quelles soirées restent rien qu’à vous deux, et qui chacun aimerait voir plus souvent. Un petit compromis, comme un plan commun et un plan en solo chaque semaine, marche en général mieux que si l’un de vous cède toujours. Si le déménagement met votre couple sous tension, ou si l’un de vous se sent mal pendant des semaines, un conseiller conjugal ou un professionnel de santé mentale peut aider : c’est une démarche normale. Pour d’autres idées, lis <a href="../../dubai/se-faire-des-amis/">se faire des amis à Dubaï</a>.</p>`,
      },
    ],
    cta: { title: 'Envie de plans à deux ?', body: 'Trouve une activité régulière à rejoindre ensemble, avec des gens qui veulent aussi se rencontrer, en vrai.', label: 'Trouver une activité' },
    related: [
      { label: 'Se faire des amis à Dubaï', path: 'fr/dubai/se-faire-des-amis/' },
      { label: '15 activités de groupe pour rencontrer du monde à Dubaï', path: 'fr/dubai/activites-de-groupe/' },
      { label: 'Seul le week-end à Dubaï', path: 'fr/blog/week-end-seul-dubai/' },
    ],
  },
  {
    lang: 'en',
    pair: 'blog-moved-for-partner-own-circle',
    path: 'blog/moved-for-partner-job-dubai-own-circle/',
    city: 'Dubai',
    published: '2026-11-09',
    title: 'Moved to Dubai for Your Partner’s Job? Your Own Circle | IRLY',
    description: 'Moved to Dubai for your partner’s job? How to give your days a structure of their own, build a circle that is yours and talk about it at home.',
    h1: 'Moved to Dubai for your partner’s job: building your own circle',
    lead: 'When you move to Dubai for your partner’s job, they arrive with colleagues, a schedule and a reason to be here, while you often start with empty days. Building your own circle means giving your week a structure of its own, meeting people through what you like rather than through their work, and talking openly at home about how it feels.',
    sections: [
      {
        h2: 'Why it feels different when you followed someone',
        html: `<p>Your partner’s new job comes with a ready-made routine: an office, a team, lunches and sometimes work events. You may have left a job, friends and a role that said a lot about who you are, and arrived without any of that. It is common to be glad about the move and still feel unsure where you fit. Some people also feel that their days are organised around someone else’s schedule. None of this means the move was a mistake; it means you need a life here that does not depend only on your partner’s.</p>`,
      },
      {
        h2: 'Give your week its own structure',
        html: `<p>Empty days are the hardest part, so start by placing a few fixed points in them:</p>
<ul>
<li><strong>Two or three regular slots a week</strong> at set times: a class, a sport, a volunteering shift, a language course.</li>
<li><strong>Daytime activities,</strong> which are often easier to join and less crowded than evening events.</li>
<li><strong>A project of your own:</strong> learning a skill, studying, freelancing or looking for work, if that suits you. If you want to work or study here, first check with official sources what your residence status allows.</li>
</ul>
<p>Our list of <a href="../../dubai/group-activities/">group activities to meet people in Dubai</a> has ideas to fill these slots.</p>`,
      },
      {
        h2: 'Build a circle that is yours',
        html: `<p>Your partner’s colleagues and their own partners can be a good start, but if they are your only circle, your social life depends on one workplace. Look for people through what you like: a community around your language or your former profession, a regular sport, a volunteering group, a professional network in your field. In these groups, many people also moved for someone else’s job and are looking for the same thing. Going on your own may feel strange at first; our guide on <a href="../../dubai/going-out-alone/">going out alone in Dubai</a> can help. When you get on well with someone, suggest a plan with just the two of you before bringing partners in, so the friendship starts as yours.</p>`,
      },
      {
        h2: 'Talk about it at home, and look after yourself',
        html: `<p>It is easy to keep these feelings to yourself, especially while your partner is settling into a new job. Say plainly how your days feel and what would help: a weekend plan you choose, one evening a week kept for your own activity, or simply being asked how your week went. Shared plans as a couple matter too, and our post on <a href="../new-dubai-couple-social-life/">building a social life together as a couple</a> covers that side. If you feel low most days for weeks, or lose interest in things you used to enjoy, talking to a doctor or a mental health professional is a normal step. For more, read <a href="../../dubai/lonely/">what actually helps when you feel lonely in Dubai</a>.</p>`,
      },
    ],
    cta: { title: 'Want a circle of your own?', body: 'Find a regular activity around what you like, with people who want to meet too, in real life.', label: 'Find my people' },
    related: [
      { label: 'New in Dubai as a couple: building a social life together', path: 'blog/new-dubai-couple-social-life/' },
      { label: 'Lonely in Dubai: what actually helps', path: 'dubai/lonely/' },
      { label: '15 group activities to meet people in Dubai', path: 'dubai/group-activities/' },
    ],
  },
  {
    lang: 'fr',
    pair: 'blog-moved-for-partner-own-circle',
    path: 'fr/blog/suivre-partenaire-dubai-ton-propre-cercle/',
    city: 'Dubaï',
    published: '2026-11-09',
    title: 'Suivre ton ou ta partenaire à Dubaï : ton propre cercle | IRLY',
    description: 'Tu as suivi ton ou ta partenaire à Dubaï pour son travail ? Comment structurer tes journées, créer un cercle à toi et en parler à la maison.',
    h1: 'Suivre ton ou ta partenaire à Dubaï : construire ton propre cercle',
    lead: 'Quand tu t’installes à Dubaï pour le travail de ton ou ta partenaire, l’autre arrive avec des collègues, un emploi du temps et une raison d’être là, alors que toi, tu commences souvent avec des journées vides. Construire ton propre cercle, c’est donner à ta semaine une structure à toi, rencontrer des gens par ce que tu aimes plutôt que par son travail, et parler franchement à la maison de ce que tu vis.',
    sections: [
      {
        h2: 'Pourquoi c’est différent quand on a suivi quelqu’un',
        html: `<p>Le nouveau poste de ton ou ta partenaire vient avec une routine toute faite : un bureau, une équipe, des déjeuners et parfois des événements professionnels. Toi, tu as peut-être quitté un travail, des amis et un rôle qui en disait long sur qui tu es, et tu arrives sans rien de tout ça. Il est courant d’apprécier le déménagement tout en ne sachant plus très bien où est ta place. Certaines personnes ont aussi l’impression que leurs journées tournent autour de l’emploi du temps de quelqu’un d’autre. Ça ne veut pas dire que le déménagement était une erreur : il te faut simplement une vie ici qui ne dépende pas seulement de celle de ton ou ta partenaire.</p>`,
      },
      {
        h2: 'Donne à ta semaine sa propre structure',
        html: `<p>Les journées vides sont le plus difficile, alors commence par y placer quelques repères fixes :</p>
<ul>
<li><strong>Deux ou trois créneaux réguliers par semaine</strong> à heure fixe : un cours, un sport, du bénévolat, une langue à apprendre.</li>
<li><strong>Des activités en journée,</strong> souvent plus faciles à rejoindre et moins bondées que les soirées.</li>
<li><strong>Un projet à toi :</strong> apprendre quelque chose de nouveau, reprendre des études, te lancer en freelance ou chercher un emploi, si ça te correspond. Si tu veux travailler ou étudier ici, vérifie d’abord auprès des sources officielles ce que ton statut de résident permet.</li>
</ul>
<p>Notre liste d’<a href="../../dubai/activites-de-groupe/">activités de groupe pour rencontrer du monde à Dubaï</a> donne des idées pour remplir ces créneaux.</p>`,
      },
      {
        h2: 'Construis un cercle qui est le tien',
        html: `<p>Les collègues de ton ou ta partenaire et leurs propres partenaires peuvent être un bon début, mais s’ils sont ton seul cercle, ta vie sociale dépend d’un seul lieu de travail. Cherche des gens à travers ce que tu aimes : une communauté autour de ta langue ou de ton ancien métier, un sport régulier, un groupe de bénévoles, un réseau professionnel dans ton domaine. Dans ces groupes, beaucoup de personnes sont aussi venues pour le travail de quelqu’un d’autre et cherchent la même chose. Y aller sans personne peut sembler étrange au début : notre guide <a href="../../dubai/sortir-seul/">sortir seul à Dubaï</a> peut aider. Quand le courant passe avec quelqu’un, propose un plan rien qu’à vous deux avant d’inclure les partenaires, pour que cette amitié commence comme la tienne.</p>`,
      },
      {
        h2: 'Parles-en à la maison, et prends soin de toi',
        html: `<p>On garde facilement ce ressenti pour soi, surtout quand l’autre a la tête dans son nouveau poste. Dis simplement comment se passent tes journées et ce qui t’aiderait : un plan de week-end que tu choisis, une soirée par semaine réservée à ton activité, ou juste qu’on te demande comment s’est passée ta semaine. Les plans à deux comptent aussi, et notre article sur <a href="../arriver-dubai-en-couple-vie-sociale/">la vie sociale en couple à Dubaï</a> couvre ce côté-là. Si tu te sens mal la plupart des jours pendant des semaines, ou si tu perds l’envie de faire ce que tu aimais, en parler à un médecin ou à un professionnel de santé mentale est une démarche normale. Pour aller plus loin, lis <a href="../../dubai/solitude/">ce qui aide vraiment quand on se sent seul à Dubaï</a>.</p>`,
      },
    ],
    cta: { title: 'Envie d’un cercle à toi ?', body: 'Trouve une activité régulière autour de ce que tu aimes, avec des gens qui veulent aussi se rencontrer, en vrai.', label: 'Trouver mes gens' },
    related: [
      { label: 'En couple à Dubaï : construire une vie sociale à deux', path: 'fr/blog/arriver-dubai-en-couple-vie-sociale/' },
      { label: 'Se sentir seul à Dubaï', path: 'fr/dubai/solitude/' },
      { label: '15 activités de groupe pour rencontrer du monde à Dubaï', path: 'fr/dubai/activites-de-groupe/' },
    ],
  },
  {
    lang: 'en',
    pair: 'blog-lonely-holidays-far-from-home',
    path: 'blog/lonely-holidays-far-from-home/',
    city: 'Dubai',
    published: '2026-11-09',
    title: 'Lonely During the Holidays Far From Home: What Helps | IRLY',
    description: 'Holidays far from family can feel lonelier than any other time abroad. How to plan the day ahead, gather others who stay and keep home close.',
    h1: 'Lonely during the holidays far from home: what helps',
    lead: 'Holidays far from home can feel lonelier than ordinary days, because everything around you is about family and being together. What helps is deciding your plan before the day arrives, gathering other people who are also far from home, and staying in touch with your own people in a way that comforts rather than hurts.',
    sections: [
      {
        h2: 'Why holidays hit harder abroad',
        html: `<p>On a normal day, being far from home is part of the routine. On a holiday you celebrate, the gap becomes visible: family photos fill your phone, calls remind you of what you are missing, and some friends here may travel or spend the day with their own families. If the holiday is not widely celebrated where you live, the day can also look completely ordinary around you, which can feel strange. Feeling sad at these moments is normal and says nothing bad about your life here.</p>`,
      },
      {
        h2: 'Decide your plan before the day',
        html: `<p>The hardest version of a holiday is the one you did not plan, when you wake up with nothing ahead. A week or two before, decide one thing:</p>
<ul>
<li><strong>Host a small gathering</strong> for others who are staying: colleagues, neighbours, people from an activity. A simple meal where everyone brings a dish from home works well.</li>
<li><strong>Join something that runs that day</strong> or that week: a group activity, a sport session, a community meetup.</li>
<li><strong>Volunteer.</strong> Giving time to a cause gives the day a purpose and puts you among people.</li>
<li><strong>Say yes to invitations,</strong> even from people you do not know well yet. One more guest is often welcome.</li>
</ul>
<p>Our list of <a href="../../dubai/group-activities/">group activities to meet people in Dubai</a> can help you find a plan.</p>`,
      },
      {
        h2: 'Keep home close without making it harder',
        html: `<ul>
<li><strong>Schedule your calls</strong> at a time that suits both time zones, instead of checking your phone all day.</li>
<li><strong>Keep one tradition you love:</strong> a dish, a song, a small ritual. Sharing it with new friends turns it into something you have here too.</li>
<li><strong>Limit scrolling</strong> through other people’s celebrations if it makes you feel worse.</li>
<li><strong>Plan something for the day after,</strong> so the holiday is not followed by an empty day.</li>
</ul>`,
      },
      {
        h2: 'If it weighs on you',
        html: `<p>Some sadness around holidays is common and usually passes. If you feel low for weeks, or if sleep or daily life becomes hard, talk to a doctor or a mental health professional; it is a normal step. If you are in danger or think about harming yourself, call the emergency services right away: 999 (police) or 998 (ambulance) in the UAE, or the local emergency number where you are. For more ideas, read <a href="../../dubai/lonely/">what actually helps when you feel lonely in Dubai</a> and, if the weekends around the holidays are quiet, <a href="../lonely-weekends-dubai/">how to plan one thing before the weekend starts</a>.</p>`,
      },
    ],
    cta: { title: 'Nothing planned for the holidays?', body: 'Find an activity or a community with people who are around too, in real life.', label: 'Find an activity' },
    related: [
      { label: 'Lonely in Dubai: what actually helps', path: 'dubai/lonely/' },
      { label: 'Lonely on weekends in Dubai', path: 'blog/lonely-weekends-dubai/' },
      { label: '15 group activities to meet people in Dubai', path: 'dubai/group-activities/' },
    ],
  },
  {
    lang: 'fr',
    pair: 'blog-lonely-holidays-far-from-home',
    path: 'fr/blog/seul-pendant-les-fetes-loin-de-chez-soi/',
    city: 'Dubaï',
    published: '2026-11-09',
    title: 'Seul pendant les fêtes loin de chez toi : ce qui aide | IRLY',
    description: 'Les fêtes loin de ta famille peuvent peser plus que tout autre moment à l’étranger. Prévois ton plan, réunis ceux qui restent et garde les tiens proches.',
    h1: 'Seul pendant les fêtes loin de chez toi : ce qui aide',
    lead: 'Les fêtes loin de chez toi peuvent sembler plus solitaires que les jours ordinaires, parce que tout autour parle de famille et de retrouvailles. Ce qui aide : décider de ton plan avant le jour J, réunir d’autres personnes elles aussi loin de chez elles, et garder le lien avec les tiens d’une façon qui réconforte au lieu de peser.',
    sections: [
      {
        h2: 'Pourquoi les fêtes pèsent plus à l’étranger',
        html: `<p>Un jour normal, être loin de chez soi fait partie de la routine. Un jour de fête que tu célèbres, le manque devient visible : les photos de famille remplissent ton téléphone, les appels te rappellent ce que tu rates, et certains amis d’ici partent en voyage ou passent la journée en famille. Si cette fête n’est pas très célébrée là où tu vis, la journée peut aussi sembler tout à fait ordinaire autour de toi, ce qui fait un drôle d’effet. Ressentir de la tristesse à ces moments-là est normal et ne dit rien de négatif sur ta vie ici.</p>`,
      },
      {
        h2: 'Décide de ton plan avant le jour J',
        html: `<p>La version la plus dure d’une fête, c’est celle qu’on n’a pas prévue, quand on se réveille sans rien devant soi. Une ou deux semaines avant, décide d’une chose :</p>
<ul>
<li><strong>Reçois un petit groupe</strong> de personnes qui restent aussi : des collègues, des voisins, des gens rencontrés à une activité. Un repas simple où chacun apporte un plat de chez soi marche bien.</li>
<li><strong>Rejoins quelque chose qui a lieu ce jour-là</strong> ou cette semaine-là : une activité de groupe, une séance de sport, une rencontre de communauté.</li>
<li><strong>Fais du bénévolat.</strong> Consacrer du temps à une cause donne un sens à la journée et te met au milieu des autres.</li>
<li><strong>Dis oui aux invitations,</strong> même de personnes que tu connais encore peu. Une personne de plus à table fait souvent plaisir.</li>
</ul>
<p>Notre liste d’<a href="../../dubai/activites-de-groupe/">activités de groupe pour rencontrer du monde à Dubaï</a> peut t’aider à trouver un plan.</p>`,
      },
      {
        h2: 'Garde les tiens proches sans te faire plus de mal',
        html: `<ul>
<li><strong>Programme tes appels</strong> à un horaire qui convient aux deux fuseaux, au lieu de regarder ton téléphone toute la journée.</li>
<li><strong>Garde une tradition qui te tient à cœur :</strong> un plat, une chanson, un petit rituel. La partager avec tes nouveaux amis, c’est aussi la faire vivre ici.</li>
<li><strong>Passe moins de temps</strong> sur les photos de fêtes des autres si ça te fait plus de mal que de bien.</li>
<li><strong>Prévois quelque chose pour le lendemain,</strong> pour que la fête ne soit pas suivie d’une journée vide.</li>
</ul>`,
      },
      {
        h2: 'Si ça te pèse',
        html: `<p>Un peu de tristesse autour des fêtes est fréquent et passe en général. Si tu te sens mal pendant des semaines, ou si le sommeil ou le quotidien deviennent difficiles, parles-en à un médecin ou à un professionnel de santé mentale : c’est une démarche normale. Si tu es en danger ou si tu penses à te faire du mal, appelle tout de suite les secours : le 999 (police) ou le 998 (ambulance) aux Émirats, ou le numéro d’urgence local là où tu es. Pour d’autres idées, lis <a href="../../dubai/solitude/">ce qui aide vraiment quand on se sent seul à Dubaï</a> et, si les week-ends autour des fêtes sont calmes, <a href="../week-end-seul-dubai/">comment prévoir une chose avant que le week-end commence</a>.</p>`,
      },
    ],
    cta: { title: 'Rien de prévu pour les fêtes ?', body: 'Trouve une activité ou une communauté avec des gens qui sont là aussi, en vrai.', label: 'Trouver une activité' },
    related: [
      { label: 'Se sentir seul à Dubaï', path: 'fr/dubai/solitude/' },
      { label: 'Seul le week-end à Dubaï', path: 'fr/blog/week-end-seul-dubai/' },
      { label: '15 activités de groupe pour rencontrer du monde à Dubaï', path: 'fr/dubai/activites-de-groupe/' },
    ],
  },
];
