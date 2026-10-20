# IRLY iOS : checklist avant l'envoi à l'App Store

Audit fait le 2026-10-20 sur la branche `claude/release-audit`, à partir du code et de la config. Aucune build ni aucun envoi n'a été lancé.
Légende : ✅ conforme · ⚠️ à vérifier ou risque de rejet · ❌ bloquant, à corriger avant l'envoi.

Config validée après modification : `npx expo config --type public` et `--type introspect` passent, `npx tsc --noEmit -p .` passe.

---

## 1. Checklist bloquante

### Identité, version, build

| | Point | Preuve |
|---|---|---|
| ✅ | Bundle ID `app.irly.mobile` | `app.json:17` |
| ✅ | Version marketing `3.0.0` (CFBundleShortVersionString) | `app.json:6`, `package.json:3` |
| ✅ | Numéro de build : géré par EAS côté serveur (`appVersionSource: "remote"`) et augmenté à chaque build (`autoIncrement: true`). Pas de `ios.buildNumber` dans `app.json`, et aucun workflow ne le lit ni ne l'écrit. | `eas.json:4`, `eas.json:8` |
| ✅ | Build : `eas build --platform ios --profile production --auto-submit` (workflow TestFlight, lancé à la main ou par `.github/testflight.txt`) | `.github/workflows/testflight.yml` |
| ⚠️ | `3.0.0` doit être plus grand que toute version déjà envoyée en revue dans App Store Connect. Sinon, il faut monter `version` dans `app.json`. | App Store Connect |
| ✅ | `ITSAppUsesNonExemptEncryption: false` (HTTPS seulement, pas de chiffrement propre) | `app.json:19` |
| ✅ | iPhone uniquement (`supportsTablet: false`) : pas de captures iPad à fournir | `app.json:16` |

### Textes d'autorisation iOS (anglais `locales/en.json`, français `locales/fr.json`, valeur par défaut dans `app.json`)

| | Autorisation | Utilisée par | Preuve |
|---|---|---|---|
| ✅ | `NSCameraUsageDescription` | `ImagePicker.launchCameraAsync` (photo de profil, photo à partager, selfie de vérification), photos seulement | `src/features/verify/verify.ts:152`, `src/components/ui/PhotoSourceSheet.tsx:208`, `app.json:110` |
| ✅ **corrigé** | `NSPhotoLibraryUsageDescription` | Photothèque : profil, couvertures, posts, chats, vérification, **et vidéos du Live**. Le texte anglais et le texte français étaient plus courts que celui d'`app.json` et ne parlaient ni des vidéos, ni des chats, ni des couvertures. Les trois textes sont maintenant identiques. | `src/features/live/liveMedia.ts:36`, `app.json:109`, `locales/en.json:4`, `locales/fr.json:4` |
| ✅ | `NSLocationWhenInUseUsageDescription` (au premier plan seulement, rien en arrière-plan) | `Location.requestForegroundPermissionsAsync` | `src/features/map/RealMap.native.tsx:123`, `app.json:100-103` |
| ✅ | `NSMotionUsageDescription` | `DeviceMotion` (effet de profondeur) | `src/motion/useParallax.ts:54`, `app.json:117` |
| ✅ | `NSCalendarsWriteOnlyAccessUsageDescription` + `NSCalendarsUsageDescription` | `createEventInCalendarAsync` (fiche système « Nouvel événement », rien n'est lu) | `src/lib/phoneCalendar.ts:23`, `app.json:129-131` |
| ✅ | Pas de `NSMicrophoneUsageDescription` : aucune capture audio ou vidéo par la caméra (`microphonePermission: false`). La dictée de l'assistant n'existe que sur le web. | `app.json:111`, `src/features/ai/voice.ts:25` |
| ✅ | Pas de `NSPhotoLibraryAddUsageDescription` : rien n'est enregistré dans Photos (pas d'`expo-media-library`) | `package.json` |
| ✅ | Pas de `NSUserTrackingUsageDescription` : ni ATT, ni SDK de pub ou d'analytics | `package.json` |
| ✅ | Pas de contacts, pas de Bluetooth, pas de rappels (`remindersPermission: false`) | `app.json:132` |

### Manifeste de confidentialité, entitlements, liens

| | Point | Preuve |
|---|---|---|
| ✅ | `privacyManifests` : `NSPrivacyTracking: false`, API à raison déclarée : UserDefaults `CA92.1`, FileTimestamp `C617.1`, SystemBootTime `35F9.1`, DiskSpace `E174.1`. Les modules Expo SDK 57 apportent aussi leur propre `PrivacyInfo.xcprivacy`. | `app.json:22-50` |
| ⚠️ | `NSPrivacyCollectedDataTypes` n'est pas déclaré dans le manifeste de l'app. Apple ne l'exige pas pour la revue (les étiquettes App Privacy d'App Store Connect font foi), mais le « Privacy Report » de l'archive sera vide côté app. Les étiquettes doivent être remplies à la main (`docs/APP-STORE.md` § 6). | `app.json:22` |
| ✅ | Sign in with Apple : entitlement `com.apple.developer.applesignin` (via `usesAppleSignIn` et le plugin `expo-apple-authentication`) | `app.json:52`, `app.json:135` |
| ⚠️ | Push : le plugin `expo-notifications` ajoute `aps-environment`. La config donne `development`. À l'export App Store, Xcode le remplace par `production` d'après le profil de distribution. **À vérifier une fois** : recevoir une vraie notification sur la build TestFlight. | `app.json:121-125`, `npx expo config --type introspect` |
| ✅ | Deep link : schéma `irly://` (et `app.irly.mobile://`). Le retour de connexion OAuth passe par ce schéma. Pas d'Associated Domains : aucun lien universel n'est déclaré ni attendu, donc rien d'incohérent. | `app.json:5`, `src/features/auth/account.ts:896-911` |
| ⚠️ | Les liens partagés (activité, profil, agenda) pointent vers `https://alafrench7593-a11y.github.io/irly`, alors que le site et les pages légales sont sur `getirly.com`. Ça marche, mais l'adresse se voit pendant la revue. Une fois `getirly.com/app` déployé en production, passer `APP.webUrl` à `https://getirly.com/app`. | `src/config/app.ts:45`, `.github/scripts/vercel-build.mjs` |

### Hygiène de la build de production

| | Point | Preuve |
|---|---|---|
| ✅ | Variables `EXPO_PUBLIC_*` de la build de production : seulement `EXPO_PUBLIC_SUPABASE_URL` (eas.json). La clé anon publique a une valeur par défaut dans le code. Il n'y a pas de fichier `.env` (seulement `.env.example`). | `eas.json:12-14`, `src/lib/supabase.ts:18-19` |
| ✅ | `EXPO_PUBLIC_DEMO` n'est pas défini pour iOS. Il ne vaut `1` que pour les exports web `/demo` et les captures du site. | `src/config/app.ts:61`, `.github/scripts/vercel-build.mjs:27`, `.github/workflows/site-shots.yml:36` |
| ✅ | `EXPO_PUBLIC_MATCH_IRLY` et `EXPO_PUBLIC_GIRL_MATCH` ne sont définis nulle part : Match reste fermé | `src/lib/features.ts:23-24` |
| ⚠️ | `/design-system` : le lien des Réglages n'existe qu'en démo, mais la route reste ouverte par lien profond (`irly://design-system`). Risque faible. À faire dans `src/` par l'équipe : `if (!DEMO) return <Redirect href="/" />`. | `src/features/settings/SettingsSections.tsx:210-215`, `src/app/design-system.tsx` |
| ✅ | Back-office `/admin` : bouton visible seulement pour le staff (`my_staff_role`), et chaque appel est revérifié par le serveur. `admin/reports`, `team`, `audit`, `news` et `verifications` n'ont pas de garde côté écran : par lien profond, un membre voit un écran vide ou une erreur, jamais des données. | `src/app/settings.tsx:213`, `src/features/admin/api.ts:133-145`, `src/app/admin/index.tsx:39` |
| ✅ | Aucun `console.log`. Un seul `console.warn`, derrière `__DEV__`. Pas de `localhost`, pas de `@irly.test`, aucun mot de passe dans `src/`. | `src/components/ui/Toast.tsx:32` |

### Règles App Review

| | Règle | Preuve |
|---|---|---|
| ✅ | 1.2 Signaler : profils, messages, commentaires, posts Live, activités, communautés, IRLY Girl. Motifs au choix, avec une case pour bloquer aussi. | `src/features/moderation/ReportSheet.tsx:43`, `src/features/moderation/moderation.ts:41`, `src/app/(tabs)/live.tsx:508`, `src/features/profile/MemberProfileView.tsx:344-351` |
| ✅ | 1.2 Bloquer, et liste des membres bloqués | `src/features/moderation/moderation.ts:52`, `src/app/blocked.tsx` |
| ✅ | 1.2 Masquer un contenu (« Hide this post ») | `src/app/(tabs)/live.tsx:491-503` |
| ✅ | 1.2 Équipe de modération et file des signalements | `src/app/admin/reports.tsx` |
| ❌ | 1.2 Conditions avec **tolérance zéro**. Les CGU sont acceptées à l'inscription (« By continuing… », `src/app/account.tsx:386-398`) et interdisent harcèlement et haine (`src/content/legal.ts:134`, `:168`, `:191`). Mais la formule demandée par Apple, « no tolerance for objectionable content or abusive users », n'apparaît nulle part. Or `docs/APP-REVIEW-ANSWERS.md` § 5 l'annonce. **À faire** dans `src/content/legal.ts` (CGU et règles) : *« IRLY has zero tolerance for objectionable content and abusive users. Reported content is reviewed and, when it breaks these rules, removed within 24 hours and its author's account suspended or closed. »*, en français aussi. | `src/content/legal.ts` |
| ⚠️ | Pages légales marquées **« (draft) »** : l'écran affiche « Version 0.6 (draft) ». Un relecteur peut lire une politique de confidentialité en brouillon comme un contenu inachevé (2.1). À valider par le juriste, puis retirer « (draft) ». | `src/config/app.ts:49-53`, `src/app/legal/[doc].tsx:37` |
| ✅ | 5.1.1(v) Suppression du compte dans l'app : Réglages → My account → Delete account → confirmation → suppression côté serveur (fichiers compris) | `src/features/settings/SettingsSections.tsx:88-118`, `:129`, `src/features/auth/account.ts:770` |
| ✅ | Politique de confidentialité et assistance dans l'app : Réglages → Legal et Help & support, e-mail de contact | `src/features/settings/SettingsSections.tsx:218-232`, `src/config/app.ts:35-39` |
| ⚠️ | URL publiques `getirly.com/privacy`, `/support`, `/delete-account` : les règles de réécriture existent, mais il faut vérifier qu'elles répondent en production avant de les coller dans App Store Connect | `vercel.json:6-13`, `docs/APP-STORE.md` § 1 |
| ✅ | 4.8 Sign in with Apple : le bouton Apple apparaît en premier. Sur iPhone, Google n'apparaît que si Apple est activé. L'e-mail masqué (relais privé) est accepté. | `src/app/account.tsx:245-248`, `src/features/auth/account.ts:921-944` |
| ✅ | 5.1.1 Données minimales : nom (pré-rempli par Apple), âge (18+). Le téléphone est facultatif et ne s'affiche que si le fournisseur est activé. | `src/app/account.tsx:248`, `src/config/app.ts:43` |
| ❌ | 2.3.1 Fiche fidèle au build : la description et la capture n° 5 de `docs/APP-STORE.md` (§ 2, § 3, § 4) présentent **MATCH IRLY** comme disponible, et « Dubai, Abu Dhabi **et Bali** ». Or Match est fermé (`src/lib/features.ts:23`) et Bali est « coming soon ». Retirer le paragraphe MATCH IRLY et la capture n° 5, et écrire « Dubai and the UAE, Bali coming soon ». | `docs/APP-STORE.md` |
| ⚠️ | 2.1 / 2.3 Fonctions « Soon » visibles (liste et avis au § 2) | voir ci-dessous |
| ✅ | Compte de revue : `scripts/review-account.mjs` (non lancé) crée `appreview@getirly.com`, e-mail confirmé, profil caché aux membres, mot de passe tiré du secret `REVIEW_ACCOUNT_PASSWORD`. Workflow « Review account ». | `scripts/review-account.mjs:1-17`, `.github/workflows/review-account.yml` |
| ⚠️ | Le commentaire du script dit que le relecteur « voit Match IRLY », ce qui est faux tant que Match est fermé. Les notes de `docs/APP-STORE.md` § 5 disent « Profile tab » alors que le Profil s'ouvre en haut à gauche (`src/app/(tabs)/_layout.tsx:25-26`). Les notes ci-dessous sont corrigées. | |

---

## 2. Écrans « Soon / Coming soon / Bientôt » vus par le relecteur

Apple refuse souvent les apps qui mettent en avant des fonctions absentes (2.1 « incomplete », 2.3 « placeholder »). Un teaser discret passe en général. Un bouton central qui ne mène qu'à un teaser passe mal.

| Priorité | Où | Preuve | Recommandation |
|---|---|---|---|
| **Haute** | Bouton central de la barre d'onglets : « Soon », qui ouvre le teaser de Match IRLY | `src/components/navigation/TabBar.tsx:240-262`, `src/app/match.tsx:61` | Tant que `FEATURES.matchIrly` est désactivé, mettre une vraie action à la place (Créer une activité) ou retirer le disque. C'est le contrôle le plus visible de l'app. |
| Haute | Discover : rail « Coming to IRLY » (IRLY PRO, Bon plan, Visa, Location) | `src/features/discover/DiscoverPages.tsx:362-364`, `src/features/soon/SoonRail.tsx:23` | Le masquer sur iOS pour la v1, ou le descendre tout en bas. |
| Moyenne | Discover : la tuile « Services » a pour légende « Coming soon » | `src/features/discover/DiscoverPages.tsx:294` | Mettre une vraie légende ou retirer la tuile. |
| Moyenne | Discover : « Find someone » / « Match IRLY · Coming soon » | `src/features/discover/DiscoverPages.tsx:135-157`, `src/components/cards/Blocks.tsx:158` | Masquer la section tant que Match est fermé. |
| Moyenne | IRLY Girl : bloc « IRLY Match, Coming soon » | `src/app/girl/match.tsx:392-399` | Acceptable : la page propose des plans et des communautés à côté. Le badge pourrait passer en simple texte. |
| Moyenne | Boutons qui mènent aux teasers `/soon/bonplan`, `/soon/visa`, `/soon/pro` | `src/app/services.tsx:69`, `src/app/business.tsx:96` | Masquer ces boutons sur iOS. |
| Basse | Accueil : destinations « Soon » (Bali et autres), impossibles à choisir | `src/app/welcome.tsx:217-236`, `src/data/destinations.ts:31-80` | Acceptable : c'est de l'information, et l'Émirats est ouvert. Le mentionner dans les notes (déjà fait). |
| Basse | Pages Bali « IRLY Bali is coming soon » | `src/app/bali/_layout.tsx:50-54` | Acceptable si on n'y arrive pas depuis l'Émirats. |
| Basse | Toast « Coming soon » de l'assistant (destination fermée) | `src/app/assistant.tsx:133`, `:220` | Acceptable. |
| Basse | Badge générique `soon` | `src/components/ui/Controls.tsx:162` | Aucune action. |

Les textes « come back soon » des listes vides (`src/app/eat.tsx:110`, `src/app/news/index.tsx:85`) ne sont pas des teasers.

---

## 3. Notes pour App Review (brouillon, anglais, à coller)

> IRLY helps adults (18+) meet people in real life through communities, small group activities and friend connections, in Dubai and across the UAE. The interface is in English and French.
>
> **Sign in**: open the app, choose "Emirates" as destination (other destinations are marked "Soon" and cannot be chosen yet), go through the short welcome, then tap the profile picture at the top left → "Sign in" → email and password with the demo account provided. The account is set in Dubai and is hidden from other members. Sign in with Apple is also available.
>
> **What to test**: Home and Discover (categories, plans, places, map); Communities; Activities (open one, join, group chat; create your own with "Create"); Live (moments posted by members); Messages; Profile and Settings.
>
> **Not in this version**: Match IRLY (shown as "Soon") and the IRLY PRO, Bon plan, Visa and Location services are announced only. They take no booking, payment or data.
>
> **Safety (Guideline 1.2)**: every profile, post, Live moment, comment and message can be reported (flag icon, "…" menu or long press), with an option to also block the author. Members can hide a post and block anyone from their profile; blocked members are listed in Settings. The Terms and Community Guidelines are accepted at sign-up and allow no tolerance for objectionable content or abusive users. Reports are reviewed by the IRLY team, who remove content and suspend accounts.
>
> **Account deletion (5.1.1(v))**: Settings (gear) → My account → Delete account → confirm. This really deletes the account on our servers. To keep the demo account, you can create a new account with any email address (it is confirmed immediately) and delete that one.
>
> **Permissions**, all asked only when the member uses the feature: location (centre the map on "My location"), camera and photos (profile photo, posts, chats, verification selfie, Live videos from the library), calendar (add-only, through the system sheet), motion (a visual depth effect), notifications (after a first join, request or message, never at launch).
>
> **Services**: Supabase (EU, Ireland) for accounts, data and files; Apple Push Notification service through Expo. No advertising, analytics or tracking SDK, and no in-app purchases.

---

## 4. Enregistrement sur un vrai iPhone (demandé par Apple)

Apple refuse les simulateurs : la vidéo doit être filmée sur un iPhone, avec la **build TestFlight envoyée en revue**. Durée : environ 3 à 4 minutes, sans montage.

**Avant**
1. Installer la dernière build TestFlight. Mettre l'iPhone en anglais si possible (Réglages → Général → Langue), sinon le français convient.
2. Activer Concentration → Ne pas déranger. Ajouter « Enregistrement de l'écran » au Centre de contrôle.
3. Vérifier que le compte de revue existe : GitHub → Actions → **Review account** → Run workflow. Il faut un deuxième compte membre (le tien ou un compte d'équipe) qui a publié un moment Live ou un post, pour avoir quelque chose à signaler et quelqu'un à bloquer.
4. Supprimer l'app puis la réinstaller, pour partir d'un lancement à froid.

**Pendant** (Centre de contrôle → ⏺, attendre 3 s)
1. **Lancement** : toucher l'icône IRLY sur l'écran d'accueil. Laisser l'écran de démarrage et l'accueil 5 s.
2. Choisir **Emirates**, faire défiler l'accueil d'introduction.
3. **Connexion** : photo de profil en haut à gauche → **Sign in** → e-mail `appreview@getirly.com` + mot de passe → montrer le profil connecté. Montrer aussi le bouton « Continue with Apple » sans l'utiliser.
4. Home : faire défiler, ouvrir une activité, revenir.
5. **Live** : ouvrir l'onglet Live et faire défiler les moments.
6. **Signaler** : sur un moment Live, icône drapeau → choisir un motif (ex. « Harassment ») → laisser la case « bloquer aussi » décochée → Envoyer → montrer la confirmation.
7. **Masquer** : sur un autre moment, icône œil → « Hidden from your feed ».
8. **Bloquer** : toucher l'auteur d'un moment → son profil → « … » → **Block {name}** → confirmer. Puis Réglages → membres bloqués, et montrer qu'il est dans la liste.
9. Montrer Réglages → Legal → Terms of Use, puis Community Guidelines (2 s chacun).
10. **Suppression du compte** : Réglages (roue) → My account → **Delete account** → **Delete my account** → montrer le message de confirmation et le retour à l'écran public.
11. Arrêter l'enregistrement. La vidéo est dans Photos.

**Après** : relancer le workflow **Review account**, puisque l'étape 10 a supprimé le compte. Ensuite, se connecter une fois avec ce compte pour vérifier qu'il marche avant d'envoyer en revue.

---

## 5. Ce qui revient au propriétaire (rien de tout ça ne se fait depuis le code)

- **Apple Developer / App Store Connect** : app `app.irly.mobile` créée, contrats et banque (Accords) signés, secrets `ASC_*`, `APPLE_TEAM_ID` et `EXPO_TOKEN` en place. Clé push APNs déposée sur Expo (workflow « iOS credentials for Expo »).
- **Supabase** : fournisseur Apple activé (Services ID, clé `.p8`, Team ID). Sinon le bouton Apple n'apparaît pas et, sur iPhone, Google non plus.
- **Secret `REVIEW_ACCOUNT_PASSWORD`** (14 caractères ou plus), puis lancer le workflow « Review account ». Dans App Store Connect → App Review Information : « Sign-in required », `appreview@getirly.com` et le mot de passe.
- **Métadonnées** : nom, sous-titre, description **sans Match IRLY ni Bali comme disponibles**, mots-clés, URL de confidentialité, d'assistance et marketing (vérifier qu'elles répondent), coordonnées de contact, classification d'âge 18+, étiquettes App Privacy (`docs/APP-STORE.md` § 6), export compliance (déjà réglé par `ITSAppUsesNonExemptEncryption`).
- **Captures 6,9"** (1320 × 2868) prises sur la build TestFlight, **sans l'écran Match IRLY**, avec le compte de revue ou d'équipe uniquement.
- **Vidéo sur iPhone** (§ 4) jointe à la réponse à App Review.
- **Juridique** : valider les textes puis retirer « (draft) » (`src/config/app.ts:49-53`). Ajouter la phrase de tolérance zéro (`src/content/legal.ts`).
- **Équipe produit** (`src/`, hors de cet audit) : bouton central « Soon », rail « Coming to IRLY » et teasers `/soon` (§ 2) ; garde de `/design-system`.
- **Après la première build TestFlight** : vérifier qu'une notification push arrive (aps-environment production) et lancer « Apple build status » si l'avertissement ITMS-90118 (routing app coverage) revient.
- Passer `APP.webUrl` à `getirly.com/app` quand ce domaine sert l'app en production.

## Changements faits pendant cet audit

- `app.json` (`expo-image-picker.photosPermission`), `locales/en.json`, `locales/fr.json` (`NSPhotoLibraryUsageDescription`) : texte de la photothèque complété (vidéos du Live, chats, couvertures, profil IRLY Girl). L'anglais et le français sont maintenant alignés sur la valeur par défaut.
