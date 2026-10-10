import { APP, LEGAL_REQUIRED, LEGAL_VERSIONS } from '@/config/app';

/**
 * The legal texts shown in the app (Settings → Legal). They describe what
 * the app actually does, from the code and the database. They are drafts:
 * a lawyer must review them, and every [LEGAL INFORMATION REQUIRED] must be
 * filled in (src/config/app.ts) before launch.
 */

export type LegalDoc = 'privacy' | 'terms' | 'guidelines';
export type LegalSection = { title: string; body: string[] };

const who = `${APP.name} is operated by ${APP.legalEntity}, ${APP.operatorType === 'individual' ? 'an individual (sole operator), ' : ''}${APP.legalAddress}.`;

export const LEGAL: Record<LegalDoc, { title: string; version: string; updated: string; intro: string; sections: LegalSection[] }> = {
  privacy: {
    title: 'Privacy Policy',
    ...LEGAL_VERSIONS.privacy,
    intro: `${who} This policy explains what IRLY collects, why, who can see it, how long it is kept and how you control it. Contact for privacy requests: ${APP.privacyEmail}.`,
    sections: [
      {
        title: 'What we collect and why',
        body: [
          'Account: your email address or phone number, used to sign you in and secure your account. If you sign in with Apple or Google, we receive the email address they share.',
          `Profile: first name, age (stored as a birth year), gender, city, country of origin, languages, bio, interests, what you are looking for and a profile photo. Used to show your profile to other members and to suggest people and activities. You must be ${APP.minimumAge} or older.`,
          'Optional profile details: faith (never shown to other members, never used to rank or filter people) and the date you arrived in your city.',
          'Professional profile (Networking, optional): role, job title, company, industries, skills, current project, what you look for and offer, goals and a neighbourhood. Used to show you to other professionals and calculate matches.',
          'IRLY Girl (optional, women only): the matching profile you fill in (interests, availability, areas, lifestyle preferences, age range you look for, photos), your likes, passes and saves, used to suggest matches. If you plan a move, your relocation plans (destination, status, move month and checklist). If you turn on Mom mode, your children’s age groups (never their names or birthdays), shown to other IRLY Girl members. If reports show IRLY Girl is misused, moderators can withdraw access to it; the decision and its reason are kept while your account exists.',
          'Content you create: activities, community posts, comments, live (IRL) posts, photos, messages and photos you send in chats, group chats you create or join (name, photo, members), cover photos for activities, communities and chats, likes, saves, shares, poll votes, message reactions, hidden items, close friends, reports and blocks. Who you follow and who follows you. Used to provide these features.',
          'Location: IRLY never stores your exact position. When you tap "My location" on the map, your phone position is used on the phone only to centre the map. Your profile and posts show a neighbourhood or a city at most, as you choose in Settings → Privacy.',
          'Notifications: if you allow them, a push token for your phone and its language, used to send you notifications. A notification can show the sender’s first name and the start of a message on your lock screen; this text passes through the Expo push service and Apple or Google to reach your phone. Notification texts are kept 7 days to deliver them.',
          'Website waitlist (optional): the email address you enter on the IRLY website, the language of the page and where you signed up. Used only to tell you when IRLY launches. Never shared or sold.',
          'Things you ask to be told about: coming-soon services (IRLY PRO, Bon plan, Visa, Location) and upcoming destinations you tap “Notify me” on.',
          'Assistant: the requests you type or dictate to the IRLY assistant (500 characters at most), to answer them. On the web, dictation uses your browser’s own speech recognition service.',
          'Usage events: events about how the app is used (event name, a few details such as a category, your platform and the time, for example "activity created"), linked to your account ID when signed in. They never contain message text, emails, exact locations, faith or gender. They are kept 13 months; when you delete your account they stay for the rest of that time without any link to you. No third-party analytics or advertising tools are used.',
        ],
      },
      {
        title: 'Who can see your data',
        body: [
          'Other members see your public profile (first name, age, photo, city, bio, interests, languages, the communities you belong to, and your follower and following counts and lists) according to your Privacy settings ("Who can find my profile"). People who share a chat with you, or who can already reach your profile, still see your first name and photo.',
          'Messages and photos sent in a chat are visible only to the members of the conversation, including people added to a group later. Community posts are visible to people who can see the community. Live (IRL) posts follow the audience you choose.',
          'Blocking someone hides you from each other everywhere.',
          'IRLY moderators can read content that was reported, to review it.',
          'We do not sell your data and do not use advertising trackers.',
        ],
      },
      {
        title: 'Service providers',
        body: [
          `Supabase (database, authentication, file storage and realtime). Your data is stored in ${APP.hosting}.`,
          'Expo push notification service and Apple / Google push services, to deliver notifications.',
          'Apple and Google sign-in, if you choose them.',
          'Map tiles from the map provider of your phone (Apple Maps on iPhone, Google Maps on Android). On the web version, map tiles come from OpenFreeMap (OpenStreetMap data).',
          'Pictures and videos shown in the app are loaded from image hosts (Unsplash, GitHub Pages and getirly.com), which receive your IP address like any website. The IRLY website loads Google Fonts.',
          'If phone-number sign-in is turned on, the text message with your code is sent by an SMS provider: [LEGAL INFORMATION REQUIRED].',
          'Some providers (the Expo push service, Apple and Google) may process data in the United States or other countries. The contractual safeguards that cover these transfers: [LEGAL INFORMATION REQUIRED].',
        ],
      },
      {
        title: 'How long we keep data',
        body: [
          'Your account and content: until you delete your account.',
          'When you delete your account, your profile, photos, professional and IRLY Girl profiles, messages, posts, connections, follows and notifications are deleted. Groups you ran are handed to another member. The text of content that was reported to moderators, and the report itself, is kept until the report is handled and then for 12 months, unless the law requires longer; reported photos are deleted with your account.',
          'When you delete a message or a comment, its text is kept privately for moderators for 12 months, so that abuse can still be reviewed, then erased.',
          'Messages to support: 24 months.',
          'Website waitlist: until launch, and at most 24 months. Ask support to remove your address at any time.',
          'Push notification texts: 7 days. Usage events: 13 months.',
        ],
      },
      {
        title: 'Your rights and choices',
        body: [
          'Access and portability: Settings → Download my data gives you a copy of your data (photo files are listed by name; ask us for copies of the files themselves).',
          'Correction: Edit profile and Professional profile.',
          'Deletion: Settings → Delete account deletes your account and data from our servers.',
          'Visibility: Settings → Privacy (who can find you, who sees your live posts and activities, location precision, notifications).',
          `Objection, restriction and complaints: write to ${APP.privacyEmail}. You may also complain to the UAE Data Office, or to the data protection authority where you live (for example the CNIL in France).`,
          `Why we may use your data: to provide the service you sign up for (account, profile, chats, activities), with your consent where it is needed (notifications, optional details such as faith, your photos), and to keep IRLY safe and working (moderation, security, statistics without personal content). This follows ${APP.dataLaw} and, for people in the European Union, the GDPR (contract, consent and legitimate interests).`,
        ],
      },
      {
        title: 'Security',
        body: [
          'Data travels encrypted (HTTPS). Every table is protected by access rules in the database so that members can only read what they are allowed to see. No method is perfectly secure; tell us at the address above if you find a problem.',
        ],
      },
      {
        title: 'Children',
        body: [`IRLY is not for people under ${APP.minimumAge}. We delete accounts we learn belong to someone younger.`],
      },
      {
        title: 'Changes',
        body: ['We will tell you in the app before important changes to this policy take effect.'],
      },
    ],
  },
  terms: {
    title: 'Terms of Use',
    ...LEGAL_VERSIONS.terms,
    intro: `${who} By creating an account you agree to these Terms and to the Community Guidelines. Contact: ${APP.supportEmail}.`,
    sections: [
      {
        title: 'Who can use IRLY',
        body: [`You must be at least ${APP.minimumAge} years old and able to enter a contract. One account per person, with true information about yourself.`],
      },
      {
        title: 'Your account',
        body: ['Keep your sign-in secure. You are responsible for what happens on your account. You can delete it at any time in Settings.'],
      },
      {
        title: 'Your content',
        body: [
          'You keep the rights to what you post. You allow IRLY to host and display it to the people you share it with, only to run the service.',
          'You must have the right to post what you post. Do not post anything illegal, or anything that breaks the Community Guidelines.',
        ],
      },
      {
        title: 'Meeting people in real life',
        body: [
          "IRLY helps people meet. IRLY does not check the identity or background of members unless stated, and is not present at activities. Meet in public places, tell a friend where you're going, and leave if you feel unsafe. In an emergency, call local emergency services.",
          'Activities, events, places and services listed by members or third parties are their responsibility.',
        ],
      },
      {
        title: 'IRLY Girl',
        body: ['IRLY Girl is a space for women. Access is based on the gender declared at signup. Misusing it (for example declaring a false gender to enter it) leads to IRLY Girl access being withdrawn and may lead to the account being closed.'],
      },
      {
        title: 'Moderation',
        body: [
          'You can report profiles, messages and content, and block members. Moderators review reports and may remove content, limit features or close accounts that break these Terms or the Guidelines.',
        ],
      },
      {
        title: 'Paid features',
        body: ['IRLY is currently free. If paid features are added, their price and terms will be shown before you pay.'],
      },
      {
        title: 'Liability, law and disputes',
        body: [
          'Limitation of liability and warranties: [LEGAL INFORMATION REQUIRED].',
          `Governing law and competent courts: ${APP.governingLaw}.`,
        ],
      },
      {
        title: 'Changes and ending',
        body: ['We may update these Terms and will tell you in the app before important changes. You can stop using IRLY and delete your account at any time.'],
      },
    ],
  },
  guidelines: {
    title: 'Community Guidelines',
    ...LEGAL_VERSIONS.guidelines,
    intro: 'IRLY is for meeting people in real life, with respect. These rules apply everywhere in the app: profiles, messages, communities, comments, live posts, activities, Networking and IRLY Girl.',
    sections: [
      {
        title: 'Be real',
        body: ['Use your real first name and a real, recent photo of you. No fake profiles, impersonation or accounts for someone else.'],
      },
      {
        title: 'Be respectful',
        body: ['No harassment, bullying, unwanted sexual messages, hate speech or discrimination based on origin, religion, gender, sexual orientation, disability or any other characteristic.'],
      },
      {
        title: 'Keep everyone safe',
        body: ['No threats or violence, no encouragement of self-harm, nothing involving minors, no sharing of someone’s private information or exact location without consent.'],
      },
      {
        title: 'No spam or scams',
        body: ['No unsolicited advertising, chain messages, requests for money, fake investments, phishing links or selling of illegal goods. Networking is for real professional connections.'],
      },
      {
        title: 'Keep it legal',
        body: ['Respect the laws of the country you are in, including local rules about public behaviour, alcohol and content.'],
      },
      {
        title: 'Report and block',
        body: [
          'Long-press a message, or use the shield button on a profile or chat, to report or block. Choose a reason: harassment, hate speech, spam, scam, fake profile, inappropriate content, threats or other.',
          'Blocking hides you from each other everywhere and ends any connection. Reports are confidential: the person is not told who reported them.',
        ],
      },
      {
        title: 'What happens when rules are broken',
        body: ['Depending on how serious it is: the content is removed, features are limited, or the account is closed. Serious threats may be passed to the authorities when the law requires it.'],
      },
    ],
  },
};

const whoFr = `${APP.name} est exploitée par ${APP.legalEntity}, ${APP.operatorType === 'individual' ? 'personne physique (exploitant individuel), ' : ''}Dubai Digital Park, Dubai Silicon Oasis, Dubaï, Émirats arabes unis.`;
const draft = (v: string) => v.replace('(draft)', '(projet)');

/** The same texts in French, written for French readers (not shown as a machine translation). */
export const LEGAL_FR: typeof LEGAL = {
  privacy: {
    title: 'Politique de confidentialité',
    ...LEGAL_VERSIONS.privacy,
    version: draft(LEGAL_VERSIONS.privacy.version),
    intro: `${whoFr} Cette politique explique ce qu’IRLY collecte, pourquoi, qui peut le voir, combien de temps c’est conservé et comment tu le contrôles. Contact pour les demandes liées à tes données : ${APP.privacyEmail}.`,
    sections: [
      {
        title: 'Ce que nous collectons et pourquoi',
        body: [
          'Compte : ton adresse e-mail ou ton numéro de téléphone, pour te connecter et sécuriser ton compte. Si tu te connectes avec Apple ou Google, nous recevons l’adresse e-mail qu’ils partagent.',
          `Profil : prénom, âge (enregistré sous forme d’année de naissance), genre, ville, pays d’origine, langues, bio, centres d’intérêt, ce que tu recherches et une photo de profil. Utilisés pour montrer ton profil aux autres membres et te suggérer des personnes et des activités. Tu dois avoir au moins ${APP.minimumAge} ans.`,
          'Détails facultatifs du profil : religion (jamais montrée aux autres membres, jamais utilisée pour classer ou filtrer des personnes) et la date de ton arrivée dans ta ville.',
          'Profil professionnel (Networking, facultatif) : rôle, intitulé de poste, entreprise, secteurs, compétences, projet en cours, ce que tu cherches et proposes, objectifs et un quartier. Utilisé pour te montrer à d’autres professionnels et calculer les correspondances.',
          'IRLY Girl (facultatif, réservé aux femmes) : le profil de rencontre que tu remplis (centres d’intérêt, disponibilités, quartiers, préférences de mode de vie, tranche d’âge recherchée, photos), tes likes, passes et favoris, utilisés pour te suggérer des matchs. Si tu prévois un déménagement, ton projet (destination, statut, mois du départ et liste de tâches). Si tu actives le mode Maman, les tranches d’âge de tes enfants (jamais leurs prénoms ni leurs dates de naissance), visibles par les autres membres d’IRLY Girl. Si des signalements montrent un usage abusif d’IRLY Girl, les modérateurs peuvent en retirer l’accès ; la décision et son motif sont conservés tant que ton compte existe.',
          'Contenus que tu crées : activités, publications dans les communautés, commentaires, publications en direct (IRL), photos, messages et photos envoyés dans les discussions, discussions de groupe que tu crées ou rejoins (nom, photo, membres), photos de couverture des activités, communautés et discussions, likes, favoris, partages, votes aux sondages, réactions aux messages, éléments masqués, amis proches, signalements et blocages. Les personnes que tu suis et celles qui te suivent. Utilisés pour faire fonctionner ces fonctionnalités.',
          'Localisation : IRLY n’enregistre jamais ta position exacte. Quand tu touches « Ma position » sur la carte, la position de ton téléphone sert uniquement, sur le téléphone, à centrer la carte. Ton profil et tes publications affichent au plus un quartier ou une ville, selon ton choix dans Réglages → Confidentialité.',
          'Notifications : si tu les autorises, un jeton push pour ton téléphone et sa langue, pour t’envoyer des notifications. Une notification peut afficher le prénom de l’expéditeur et le début d’un message sur ton écran verrouillé ; ce texte passe par le service push d’Expo et par Apple ou Google pour arriver sur ton téléphone. Les textes des notifications sont conservés 7 jours pour être distribués.',
          'Liste d’attente du site (facultatif) : l’adresse e-mail que tu saisis sur le site IRLY, la langue de la page et l’endroit où tu t’es inscrit. Utilisée uniquement pour te prévenir du lancement d’IRLY. Jamais partagée ni vendue.',
          'Ce dont tu demandes à être prévenu : les services à venir (IRLY PRO, Bon plan, Visa, Location) et les prochaines destinations pour lesquelles tu touches « Me prévenir ».',
          'Assistant : les demandes que tu écris ou dictes à l’assistant IRLY (500 caractères au plus), pour y répondre. Sur le web, la dictée utilise le service de reconnaissance vocale de ton navigateur.',
          'Événements d’utilisation : des événements sur l’usage de l’app (nom de l’événement, quelques détails comme une catégorie, ta plateforme et l’heure, par exemple « activité créée »), liés à l’identifiant de ton compte quand tu es connecté. Ils ne contiennent jamais le texte des messages, d’e-mails, de position exacte, de religion ni de genre. Ils sont conservés 13 mois ; si tu supprimes ton compte, ils restent jusqu’à la fin de cette durée sans aucun lien avec toi. Aucun outil d’analyse ou de publicité tiers n’est utilisé.',
        ],
      },
      {
        title: 'Qui peut voir tes données',
        body: [
          'Les autres membres voient ton profil public (prénom, âge, photo, ville, bio, centres d’intérêt, langues, les communautés dont tu fais partie, ainsi que le nombre et la liste de tes abonnés et abonnements) selon tes réglages de confidentialité (« Qui peut trouver mon profil »). Les personnes qui partagent une discussion avec toi, ou qui peuvent déjà accéder à ton profil, voient toujours ton prénom et ta photo.',
          'Les messages et photos envoyés dans une discussion ne sont visibles que par les membres de la conversation, y compris les personnes ajoutées plus tard à un groupe. Les publications d’une communauté sont visibles par les personnes qui peuvent voir la communauté. Les publications en direct (IRL) suivent l’audience que tu choisis.',
          'Bloquer quelqu’un vous masque l’un à l’autre partout.',
          'Les modérateurs d’IRLY peuvent lire les contenus signalés, pour les examiner.',
          'Nous ne vendons pas tes données et n’utilisons pas de traceurs publicitaires.',
        ],
      },
      {
        title: 'Prestataires',
        body: [
          'Supabase (base de données, authentification, stockage de fichiers et temps réel). Tes données sont hébergées dans l’Union européenne (Irlande), chez Supabase sur Amazon Web Services.',
          'Le service de notifications push d’Expo et les services push d’Apple et de Google, pour distribuer les notifications.',
          'La connexion avec Apple et Google, si tu la choisis.',
          'Les fonds de carte du fournisseur de ton téléphone (Plans d’Apple sur iPhone, Google Maps sur Android). Sur la version web, les fonds de carte viennent d’OpenFreeMap (données OpenStreetMap).',
          'Les images et vidéos affichées dans l’app sont chargées depuis des hébergeurs d’images (Unsplash, GitHub Pages et getirly.com), qui reçoivent ton adresse IP comme n’importe quel site. Le site IRLY charge Google Fonts.',
          `Si la connexion par numéro de téléphone est activée, le SMS contenant ton code est envoyé par un prestataire SMS : ${LEGAL_REQUIRED}.`,
          `Certains prestataires (le service push d’Expo, Apple et Google) peuvent traiter des données aux États-Unis ou dans d’autres pays. Les garanties contractuelles qui encadrent ces transferts : ${LEGAL_REQUIRED}.`,
        ],
      },
      {
        title: 'Durée de conservation',
        body: [
          'Ton compte et tes contenus : jusqu’à la suppression de ton compte.',
          'Quand tu supprimes ton compte, ton profil, tes photos, tes profils professionnel et IRLY Girl, tes messages, publications, connexions, abonnements et notifications sont supprimés. Les groupes que tu gérais sont confiés à un autre membre. Le texte des contenus signalés aux modérateurs, et le signalement lui-même, sont conservés jusqu’au traitement du signalement puis pendant 12 mois, sauf si la loi impose plus longtemps ; les photos signalées sont supprimées avec ton compte.',
          'Quand tu supprimes un message ou un commentaire, son texte est conservé de façon privée pour les modérateurs pendant 12 mois, afin que les abus puissent encore être examinés, puis effacé.',
          'Messages envoyés au support : 24 mois.',
          'Liste d’attente du site : jusqu’au lancement, et 24 mois au plus. Tu peux demander au support de retirer ton adresse à tout moment.',
          'Textes des notifications push : 7 jours. Événements d’utilisation : 13 mois.',
        ],
      },
      {
        title: 'Tes droits et tes choix',
        body: [
          'Accès et portabilité : Réglages → Télécharger mes données te donne une copie de tes données (les fichiers photo sont listés par nom ; demande-nous une copie des fichiers eux-mêmes).',
          'Rectification : Modifier le profil et Profil professionnel.',
          'Suppression : Réglages → Supprimer le compte supprime ton compte et tes données de nos serveurs.',
          'Visibilité : Réglages → Confidentialité (qui peut te trouver, qui voit tes publications en direct et tes activités, précision de la localisation, notifications).',
          `Opposition, limitation et réclamations : écris à ${APP.privacyEmail}. Tu peux aussi adresser une réclamation à l’UAE Data Office, ou à l’autorité de protection des données de ton pays (par exemple la CNIL en France).`,
          `Pourquoi nous pouvons utiliser tes données : pour fournir le service auquel tu t’inscris (compte, profil, discussions, activités), avec ton consentement quand il est nécessaire (notifications, détails facultatifs comme la religion, tes photos), et pour garder IRLY sûre et fonctionnelle (modération, sécurité, statistiques sans contenu personnel). Cela suit la loi émiratie sur la protection des données personnelles (décret-loi fédéral n° 45 de 2021) et, pour les personnes situées dans l’Union européenne, le RGPD (contrat, consentement et intérêts légitimes).`,
        ],
      },
      {
        title: 'Sécurité',
        body: [
          'Les données circulent chiffrées (HTTPS). Chaque table est protégée par des règles d’accès dans la base de données, pour que les membres ne puissent lire que ce qu’ils ont le droit de voir. Aucune méthode n’est parfaitement sûre ; préviens-nous à l’adresse ci-dessus si tu trouves un problème.',
        ],
      },
      {
        title: 'Mineurs',
        body: [`IRLY n’est pas destinée aux personnes de moins de ${APP.minimumAge} ans. Nous supprimons les comptes dont nous apprenons qu’ils appartiennent à une personne plus jeune.`],
      },
      {
        title: 'Modifications',
        body: ['Nous te préviendrons dans l’app avant que des changements importants de cette politique ne prennent effet.'],
      },
    ],
  },
  terms: {
    title: 'Conditions d’utilisation',
    ...LEGAL_VERSIONS.terms,
    version: draft(LEGAL_VERSIONS.terms.version),
    intro: `${whoFr} En créant un compte, tu acceptes ces Conditions et les Règles de la communauté. Contact : ${APP.supportEmail}.`,
    sections: [
      {
        title: 'Qui peut utiliser IRLY',
        body: [`Tu dois avoir au moins ${APP.minimumAge} ans et être capable de conclure un contrat. Un seul compte par personne, avec des informations vraies sur toi.`],
      },
      {
        title: 'Ton compte',
        body: ['Garde ta connexion sécurisée. Tu es responsable de ce qui se passe sur ton compte. Tu peux le supprimer à tout moment depuis les Réglages.'],
      },
      {
        title: 'Tes contenus',
        body: [
          'Tu gardes les droits sur ce que tu publies. Tu autorises IRLY à l’héberger et à l’afficher aux personnes avec qui tu le partages, uniquement pour faire fonctionner le service.',
          'Tu dois avoir le droit de publier ce que tu publies. Ne publie rien d’illégal, ni rien qui enfreigne les Règles de la communauté.',
        ],
      },
      {
        title: 'Se rencontrer en vrai',
        body: [
          'IRLY aide les gens à se rencontrer. Sauf mention contraire, IRLY ne vérifie pas l’identité ni les antécédents des membres, et n’est pas présente aux activités. Retrouvez-vous dans des lieux publics, dis à un proche où tu vas, et pars si tu ne te sens pas en sécurité. En cas d’urgence, appelle les services d’urgence locaux.',
          'Les activités, événements, lieux et services proposés par des membres ou des tiers relèvent de leur responsabilité.',
        ],
      },
      {
        title: 'IRLY Girl',
        body: ['IRLY Girl est un espace réservé aux femmes. L’accès dépend du genre déclaré à l’inscription. Un usage abusif (par exemple déclarer un faux genre pour y entrer) entraîne le retrait de l’accès à IRLY Girl et peut entraîner la fermeture du compte.'],
      },
      {
        title: 'Modération',
        body: [
          'Tu peux signaler des profils, des messages et des contenus, et bloquer des membres. Les modérateurs examinent les signalements et peuvent retirer des contenus, limiter des fonctionnalités ou fermer les comptes qui enfreignent ces Conditions ou les Règles.',
        ],
      },
      {
        title: 'Fonctionnalités payantes',
        body: ['IRLY est actuellement gratuite. Si des fonctionnalités payantes sont ajoutées, leur prix et leurs conditions seront affichés avant tout paiement.'],
      },
      {
        title: 'Responsabilité, droit applicable et litiges',
        body: [
          `Limitation de responsabilité et garanties : ${LEGAL_REQUIRED}.`,
          'Droit applicable et juridiction compétente : le droit de l’Émirat de Dubaï et les lois fédérales applicables des Émirats arabes unis ; les tribunaux de Dubaï sont compétents.',
        ],
      },
      {
        title: 'Modifications et fin',
        body: ['Nous pouvons mettre à jour ces Conditions et te préviendrons dans l’app avant tout changement important. Tu peux arrêter d’utiliser IRLY et supprimer ton compte à tout moment.'],
      },
    ],
  },
  guidelines: {
    title: 'Règles de la communauté',
    ...LEGAL_VERSIONS.guidelines,
    version: draft(LEGAL_VERSIONS.guidelines.version),
    intro: 'IRLY sert à se rencontrer en vrai, dans le respect. Ces règles s’appliquent partout dans l’app : profils, messages, communautés, commentaires, publications en direct, activités, Networking et IRLY Girl.',
    sections: [
      {
        title: 'Sois authentique',
        body: ['Utilise ton vrai prénom et une vraie photo récente de toi. Pas de faux profils, pas d’usurpation d’identité, pas de compte pour quelqu’un d’autre.'],
      },
      {
        title: 'Sois respectueux',
        body: ['Pas de harcèlement, d’intimidation, de messages sexuels non désirés, de discours haineux ni de discrimination fondée sur l’origine, la religion, le genre, l’orientation sexuelle, le handicap ou toute autre caractéristique.'],
      },
      {
        title: 'Protège tout le monde',
        body: ['Pas de menaces ni de violence, pas d’incitation à l’automutilation, rien qui implique des mineurs, pas de partage des informations privées ou de la position exacte de quelqu’un sans son accord.'],
      },
      {
        title: 'Pas de spam ni d’arnaques',
        body: ['Pas de publicité non sollicitée, de chaînes, de demandes d’argent, de faux investissements, de liens d’hameçonnage ni de vente de produits illégaux. Le Networking est fait pour de vraies relations professionnelles.'],
      },
      {
        title: 'Reste dans la légalité',
        body: ['Respecte les lois du pays où tu te trouves, y compris les règles locales sur le comportement en public, l’alcool et les contenus.'],
      },
      {
        title: 'Signaler et bloquer',
        body: [
          'Appuie longuement sur un message, ou utilise le bouton bouclier sur un profil ou une discussion, pour signaler ou bloquer. Choisis un motif : harcèlement, discours haineux, spam, arnaque, faux profil, contenu inapproprié, menaces ou autre.',
          'Bloquer vous masque l’un à l’autre partout et met fin à toute connexion. Les signalements sont confidentiels : la personne ne sait pas qui l’a signalée.',
        ],
      },
      {
        title: 'Ce qui se passe quand les règles ne sont pas respectées',
        body: ['Selon la gravité : le contenu est retiré, des fonctionnalités sont limitées, ou le compte est fermé. Les menaces graves peuvent être transmises aux autorités quand la loi l’exige.'],
      },
    ],
  },
};
