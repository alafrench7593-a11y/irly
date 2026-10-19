# IRLY — Réponses à App Review (à copier dans App Store Connect)

Tout ce qui suit est vérifié dans le code (`src/content/legal.ts`, `app.json`, `package.json`, migrations).
Les lignes marquées **[À CONFIRMER]** dépendent d'un choix qui t'appartient : relis-les avant d'envoyer.

---

## Texte anglais (à coller dans la réponse à Apple)

**1. Purpose and target audience**

IRLY helps adults make friends in real life. Members join communities around shared interests (sport, food, outings, networking, newcomers), find or create small group activities (a run, a padel game, a brunch), chat with the group before meeting, and connect as friends. It is aimed at residents and newcomers in Dubai and the other emirates of the UAE, aged 18 and over. IRLY Girl is an optional space within the app for members who registered as women, with women-only communities and activities.

**2. Demo account**

- Email: `appreview@getirly.com`
- Password: provided in the App Review Information fields.
- Sign in: open the app, choose the Emirates as destination, go through the short welcome, then Profile tab → "Sign in" → email and password.
- The demo account is set in Dubai and is hidden from other members. It contains no personal data.
- To try reporting and blocking: the "…" menu on a member profile or a post (Report, Block), "Report" under any comment, or a long press on a message in a chat.
- To try account deletion: Settings (gear) → My account section → Delete account. This deletes the demo account for real; we can recreate it on request.

**3. External services**

- Supabase (database, authentication, file storage, realtime), hosted in the European Union (Ireland) on Amazon Web Services.
- Expo push notification service, with Apple Push Notification service, to deliver notifications.
- Sign in with Apple and Google sign-in, only if the member chooses them.
- Apple Maps for map tiles on iPhone.
- Images and videos shown in the app are loaded from image hosts (Unsplash, GitHub Pages and getirly.com).
- No analytics or advertising SDK, no tracking, no in-app purchases.

**4. Regional differences**

The app is available for the United Arab Emirates (Dubai and the other emirates). Bali is shown as "coming soon" and cannot be used yet. Features do not otherwise differ by region. The interface is available in English and French, following the device language or the member's choice in Settings.

**5. Regulated content and third-party rights**

IRLY does not offer gambling, medical, financial or other regulated services, and has no in-app purchases. All member content is user-generated and moderated: every profile, post, comment and message can be reported, and any member can be blocked; reports are reviewed by the IRLY team and the community guidelines, accepted at sign-up, allow no tolerance for abusive content. Stock photos come from free libraries whose licence allows this use. **[À CONFIRMER]** A "Dubai News & Life" section can show headlines with a link to the original publisher; a source is only switched on after its terms of use have been checked, and none is active by default.

**6. Screen recording**

A screen recording made on a physical iPhone is attached. It shows: launch, sign-in with the demo account, Home and communities, an activity and its group chat, reporting a post, blocking a member, and deleting the account.

---

## Vidéo sur iPhone (à faire par toi, environ 4 min)

Apple refuse les simulations : la vidéo doit être une capture réelle, faite sur ton iPhone avec la build TestFlight.

**Avant :** installe la dernière build TestFlight. Coupe les notifications (Concentration → Ne pas déranger). Ajoute « Enregistrement de l'écran » dans le Centre de contrôle (Réglages → Centre de contrôle).

**Pendant** (ouvre le Centre de contrôle, touche ⏺, attends 3 s) :
1. Lance IRLY depuis l'écran d'accueil (5 s sur le lancement).
2. Destination Émirats, accueil, onglet Profil → « Sign in » → `appreview@getirly.com` + le mot de passe.
3. Home : fais défiler, ouvre une catégorie, reviens.
4. Communautés : ouvre « For you », puis une communauté.
5. Ouvre une activité, puis son chat de groupe.
6. **Signaler :** sur une publication, menu « … » → Report → choisis un motif → Envoyer. Montre la confirmation.
7. **Bloquer :** ouvre le profil d'un membre → « … » → Block → confirme.
8. **Supprimer le compte :** Réglages (roue) → My account → Delete account → confirme. Montre le retour à l'écran de départ.
9. Arrête l'enregistrement. La vidéo est dans Photos.

**Après :** recrée le compte de démo (GitHub → Actions → Review account → Run workflow), puisque l'étape 8 l'a supprimé.

---

## Checklist App Store Connect

- [ ] App Review Information → « Sign-in required » coché, `appreview@getirly.com` et le mot de passe.
- [ ] Notes : le texte des sections 1 à 5 ci-dessus.
- [ ] Pièce jointe : la vidéo de l'iPhone.
- [ ] App Privacy : étiquettes selon `docs/APP-STORE.md` § 6.
- [ ] Age Rating : 18+.
- [ ] Contact info : ton nom, ton téléphone, ton e-mail.
