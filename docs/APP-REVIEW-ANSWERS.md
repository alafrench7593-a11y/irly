# IRLY — Réponses à App Review (à copier dans App Store Connect)

Réponse à « Guideline 2.1 - Information Needed - New App Submission » (2026-10-23).
Tout ce qui suit est vérifié dans le code (`src/content/legal.ts`, `app.json`, `package.json`, `src/features/map/RealMap.native.tsx`, migrations).
Les lignes marquées **[À CONFIRMER]** dépendent d'un choix qui t'appartient : relis-les avant d'envoyer.
Le mot de passe du compte de démo n'est jamais écrit ici : il se tape seulement dans App Store Connect.

---

## Texte anglais (à coller dans la réponse à Apple et dans le champ Notes)

**1. Screen recording**

A screen recording captured on a physical iPhone running the latest iOS is attached. It starts by launching the app and shows account registration, sign-in with the demo account, the typical flow (Home, communities, an activity and its group chat, member profiles, messages), reporting content, blocking a member, and account deletion.

**2. Purpose and target audience**

IRLY helps adults make friends in real life. Members join communities around shared interests (sport, food, outings, networking, newcomers), find or create small group activities (a run, a padel game, a brunch), chat with the group before meeting, and connect as friends. It solves isolation for newcomers and residents who want to meet people offline. It is aimed at adults (18+) living in or moving to the United Arab Emirates. IRLY Girl is an optional space inside the app with women-only communities and activities, for members who registered as women; IRLY Mom Community is part of IRLY Girl.

**3. Setup and demo account**

- Demo account: `appreview@getirly.com`. Password: in the App Review Information fields.
- Sign in: open the app; on the first screen ("Where are you going?"), tap "Already have an account? Sign in" below the destination cards, then enter the email and password.
- The demo account is set in Dubai, hidden from other members, and holds no personal data.
- Report: the "…" menu on a member profile or a post, "Report" under a comment, or a long press on a message. Block: the "…" menu on a member profile → Block.
- Delete account: gear icon → Settings → My account → Delete account. This deletes the account for real; we recreate the demo account afterwards.
- IRLY Girl and IRLY Mom Community are reserved for members who declared "woman" at sign-up (checked by the server, never bypassed). The demo account declares "other", so it sees the screen explaining this rule. Every other feature is available to it.
- There is no paid content, subscription or in-app purchase.

**4. External services**

- Supabase: database, authentication, file storage, realtime (hosted on Amazon Web Services in the European Union).
- Sign in with Apple and Google sign-in, only if the member chooses them.
- Expo push notification service with Apple Push Notification service.
- Apple Maps for the map on iPhone.
- Images loaded from GitHub Pages, getirly.com and Unsplash.
- No AI service, no analytics or advertising SDK, no tracking, no payment processor.

**5. Regional differences**

The app is built for the United Arab Emirates (Dubai and the other emirates). Bali is shown as "coming soon" and cannot be used yet. Features do not otherwise differ by region. The interface is in English and French. **[À CONFIRMER : pays de disponibilité choisis dans App Store Connect]**

**6. Regulated industry / third-party material**

IRLY offers no gambling, medical, financial or other regulated service and no in-app purchases. Content is user-generated and moderated: profiles, posts, comments and messages can be reported, members can be blocked, reports are reviewed by the IRLY team, and the community guidelines are accepted at sign-up. Stock photos come from free libraries whose licence allows this use. **[À CONFIRMER]** The "Dubai News & Life" section shows headlines with a link to the original publisher; a source is only switched on after its terms of use have been checked.

---

## Vidéo sur iPhone (à faire par toi, environ 5 min)

Apple refuse les simulations : capture réelle, sur ton iPhone, avec la dernière build TestFlight, iOS à jour.

**Avant :** installe la build TestFlight qui contient les derniers correctifs. Active Ne pas déranger. Ajoute « Enregistrement de l'écran » dans le Centre de contrôle.

**Pendant** (Centre de contrôle → ⏺, attends 3 s) :
1. Lance IRLY depuis l'écran d'accueil de l'iPhone.
2. **Inscription** : crée un nouveau compte avec Sign in with Apple (« Masquer mon adresse e-mail »), fais l'onboarding (photo, prénom, centres d'intérêt).
3. Accueil, une communauté, une activité et son chat de groupe.
4. **Signaler** : sur une publication, « … » → Report → un motif → Envoyer ; montre la confirmation.
5. **Bloquer** : profil d'un membre → « … » → Block → confirme.
6. **Supprimer le compte** : roue → Settings → My account → Delete account → confirme ; montre le retour à l'écran de départ.
7. **Connexion** : sur le premier écran (« Where are you going? »), touche « Already have an account? Sign in » sous les cartes, puis `appreview@getirly.com` et son mot de passe ; montre l'accueil.
8. Arrête l'enregistrement. La vidéo est dans Photos.

Le compte créé à l'étape 2 est supprimé à l'étape 6 : le compte de démo d'Apple reste intact. Si le compte de démo est supprimé un jour, le recréer : GitHub → Actions → Review account → Run workflow.

---

## Checklist App Store Connect

- [ ] App Review Information → « Sign-in required » coché, `appreview@getirly.com` et le mot de passe.
- [ ] Notes : le texte des sections 2 à 6 ci-dessus.
- [ ] Réponse à Apple : le texte des sections 1 à 6, avec la vidéo de l'iPhone en pièce jointe.
- [ ] App Privacy : étiquettes selon `docs/APP-STORE.md` § 6.
- [ ] Age Rating : 18+.
- [ ] Contact info : ton nom, ton téléphone, ton e-mail.
