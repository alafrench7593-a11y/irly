import { APP, LEGAL_VERSIONS } from '@/config/app';

/**
 * The legal texts shown in the app (Profile → Legal & support). They describe what
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
          'Optional profile details: faith (private unless you choose to show it, never used to rank or filter people) and the date you arrived in your city.',
          'Professional profile (Networking, optional): role, job title, company, industries, skills, current project, what you look for and offer, goals and a neighbourhood. Used to show you to other professionals and calculate matches.',
          'IRLY Girl (optional, women only): the matching profile you fill in (interests, availability, areas, photos) and your likes and passes, used to suggest matches.',
          'Content you create: activities, community posts, comments, live (IRL) posts, photos, messages, likes, saves, reports and blocks. Used to provide these features.',
          'Location: IRLY never stores your exact position. When you tap "My location" on the map, your phone position is used on the phone only to centre the map. Your profile and posts show a neighbourhood or a city at most, as you choose in Profile → Privacy & notifications.',
          'Notifications: if you allow them, a push token for your phone and its language, used to send you notifications. Notification texts are kept 7 days to deliver them.',
          'Website waitlist (optional): the email address you enter on the IRLY website and the language of the page. Used only to tell you when IRLY launches. Never shared or sold.',
          'Usage events: anonymous-by-design events about how the app is used (for example "activity created"), linked to your account when signed in. They never contain message text, emails, exact locations, faith or gender. Kept 13 months.',
        ],
      },
      {
        title: 'Who can see your data',
        body: [
          'Other members see your public profile (first name, age, photo, city, bio, interests, languages) according to your Privacy settings ("Who can find my profile").',
          'Messages are visible only to the members of the conversation. Community posts are visible to people who can see the community. Live (IRL) posts follow the audience you choose.',
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
          'Map tiles from the map provider of your phone (Apple Maps on iPhone). On the web version, map tiles come from OpenFreeMap (OpenStreetMap data).',
          'Some providers (the Expo push service, Apple and Google) may process data in the United States or other countries. The contractual safeguards that cover these transfers: [LEGAL INFORMATION REQUIRED].',
        ],
      },
      {
        title: 'How long we keep data',
        body: [
          'Your account and content: until you delete your account.',
          'When you delete your account, your profile, photos, professional and IRLY Girl profiles, messages, posts, connections and notifications are deleted. Content that was reported to moderators, and the report itself, is kept until the report is handled and then for 12 months, unless the law requires longer.',
          'Messages to support: 24 months.',
          'Website waitlist: until launch, and at most 24 months. Ask support to remove your address at any time.',
          'Push notification texts: 7 days. Usage events: 13 months.',
        ],
      },
      {
        title: 'Your rights and choices',
        body: [
          'Access and portability: Profile → Download my data gives you a copy of your data.',
          'Correction: Edit profile and Professional profile.',
          'Deletion: Profile → Delete account deletes your account and data from our servers.',
          'Visibility: Profile → Privacy & notifications (who can find you, who sees your live posts and activities, location precision, notifications).',
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
        body: ['Keep your sign-in secure. You are responsible for what happens on your account. You can delete it at any time in Profile.'],
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
        body: ['IRLY Girl is a space for women. Access is based on the gender declared at signup. Misusing it (for example declaring a false gender to enter it) leads to the account being closed.'],
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
