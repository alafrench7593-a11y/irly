# IRLY — dossier de soumission Google Play

Préparé le 1er novembre 2026, à partir du code de la branche `claude/confident-ride-1o2o3x` (Expo SDK 57, React Native 0.86).
Le manifeste Android a été généré dans un dossier temporaire avec `npx expo prebuild -p android --no-install`. Aucun dossier `android/` n'est ajouté au dépôt (Continuous Native Generation).

Légende : 🟢 vérifié dans le code · 🟠 action de ta part · 🔴 bloque la publication ou casse une fonction sur Android.

---

## 0. Résumé des blocages

| # | Statut | Problème | Conséquence | Correction |
|---|---|---|---|---|
| 1 | 🔴 | **Aucune clé Google Maps Android.** `react-native-maps` utilise Google Maps sur Android (`RealMap.native.tsx`, `CommunityMap.native.tsx`). Le manifeste généré ne contient pas de `com.google.android.geo.API_KEY`. | Probablement un plantage à l'ouverture de la carte (« API key not found »), ou une carte vide. Un plantage à l'examen entraîne un refus. | Crée une clé « Maps SDK for Android » restreinte au package `app.irly.mobile` et à l'empreinte SHA-1 de signature Play. Ajoute-la dans `app.json` → `android.config.googleMaps.apiKey`, de préférence via une variable EAS plutôt qu'en clair. |
| 2 | 🔴 (fonction) | **Pas de Firebase pour les notifications Android.** Aucun `googleServicesFile` dans `app.json`, et aucun identifiant FCM v1 sur EAS n'a été vérifié. | `getExpoPushTokenAsync` échoue sur Android : aucune notification push. L'app ne plante pas (le code attrape l'erreur), mais la fonction est cassée. | Crée un projet Firebase, ajoute l'app Android `app.irly.mobile`, mets `google-services.json` dans le build (`android.googleServicesFile`) et dépose la clé de compte de service FCM v1 dans EAS (`eas credentials`). |
| 3 | 🟠 | **Aucun build Android n'a été fait.** `testflight.yml` ne gère que iOS, et `eas.json` n'a pas de configuration de soumission Android. | Pas de fichier `.aab` à importer. | Une fois 1 et 2 réglés : `eas build -p android --profile production` (l'App Bundle est produit par défaut). La clé de signature d'upload est générée et gardée par EAS ; active Play App Signing dans la Console. |
| 4 | 🟠 | **Type de compte développeur inconnu.** | Détermine si le test fermé de 14 jours s'applique (section 5). | Voir section 5. |

Tests Android réels : **NON TESTÉ**. Aucun appareil ni émulateur Android n'a été utilisé ici.

---

## 1. Permissions (manifeste généré + bibliothèques)

Identifiants : package `app.irly.mobile`, version `3.0.0`. Le `versionCode` est géré à distance par EAS (`appVersionSource: remote`, `autoIncrement: true`).
SDK : minSdk 24, compileSdk 36, targetSdk 36. Ces valeurs viennent du catalogue de versions de React Native (`node_modules/react-native/gradle/libs.versions.toml`) [Probable : déduit de la configuration, pas d'un build Gradle].

| Permission | Origine | Sensible ? | Utilisée ? | Avis |
|---|---|---|---|---|
| `INTERNET` | app, expo-image, expo-video | non | oui | OK |
| `ACCESS_NETWORK_STATE` | expo-image | non | oui | OK |
| `ACCESS_FINE_LOCATION` | expo-location | **oui** | oui, au premier plan uniquement (« Ma position » sur la carte) | OK. Pas de localisation en arrière-plan, donc pas de déclaration spéciale. À justifier dans Data safety (traitée sur l'appareil, non stockée). |
| `ACCESS_COARSE_LOCATION` | expo-location | **oui** | oui | Même chose. |
| `CAMERA` | expo-image-picker | **oui** | oui (photo de profil, selfie de vérification, photos partagées) | OK |
| `POST_NOTIFICATIONS` | expo-notifications | runtime (Android 13+) | oui | OK |
| `RECEIVE_BOOT_COMPLETED` | expo-notifications | non | oui (notifications programmées) | OK |
| `VIBRATE` | app, expo-haptics | non | oui | OK |
| `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE` | expo-image-picker | oui | **non** : le sélecteur de photos système suffit | 🟢 déjà retirées (`tools:node="remove"`) |
| `RECORD_AUDIO` | expo-image-picker | oui | non | 🟢 retirée |
| `ACTIVITY_RECOGNITION` | expo-sensors | oui | non | 🟢 retirée |
| `READ_CALENDAR`, `WRITE_CALENDAR` | expo-calendar | oui | non : l'ajout au calendrier passe par l'écran système (`createEventInCalendarAsync`) | 🟢 retirées. 🟠 À tester sur un appareil : le bouton « Ajouter à mon calendrier » doit ouvrir l'agenda sans demander de permission. |
| `SYSTEM_ALERT_WINDOW` | dépendance de dev | oui | non | 🟢 retirée |

Pas de `READ_MEDIA_IMAGES` ni de `READ_MEDIA_VIDEO` : l'app passe par le sélecteur de photos Android, donc pas de déclaration « Photo and video permissions » [Probable : à confirmer sur le manifeste fusionné du premier `.aab`, Play Console › App bundle explorer].
Pas de contacts, pas de SMS, pas de journal d'appels, pas d'identifiant publicitaire (aucun SDK publicitaire ni analytique tiers).

Deep links : schéma `irly://`, plus un filtre `https` généré par Expo. Les App Links vérifiés (`https://getirly.com/...` avec `assetlinks.json`) ne sont **pas** configurés. Ce n'est pas obligatoire.

---

## 2. Data safety (brouillon à recopier dans la Console)

Sources : dépendances (`package.json`), code (`src/features/*`) et politique de confidentialité publiée (`/privacy`, mise à jour le 11/10/2026).
Prestataires (Supabase pour l'hébergement, Expo, Apple et Google pour la livraison des notifications) : Google les considère comme des **sous-traitants**, pas comme un partage.

**Questions générales**
- L'app collecte-t-elle ou partage-t-elle des données ? → **Oui**
- Toutes les données sont-elles chiffrées en transit ? → **Oui** (HTTPS vers Supabase et Expo)
- Les utilisateurs peuvent-ils demander la suppression de leurs données ? → **Oui** (dans l'app + `https://getirly.com/delete-account`)
- Partage avec des tiers → **Non** (aucune vente ni transmission à des fins propres ; seulement des sous-traitants)

| Catégorie Play | Type | Collecté | Partagé | Facultatif ? | Finalités |
|---|---|---|---|---|---|
| Informations personnelles | Nom (prénom) | oui | non | obligatoire | Fonctionnement de l'app, gestion du compte |
| | Adresse e-mail | oui | non | obligatoire | Gestion du compte, communications du développeur (e-mails liés au compte) |
| | Identifiants utilisateur (ID de compte) | oui | non | obligatoire | Fonctionnement de l'app, gestion du compte, analytique (événements d'usage internes) |
| | Autres infos : âge (année de naissance), genre, ville, pays d'origine, langues, bio, centres d'intérêt, profil pro | oui | non | en partie facultatif | Fonctionnement de l'app, personnalisation |
| | Croyances religieuses (« faith », facultatif, jamais affiché) | oui | non | **facultatif** | Fonctionnement de l'app |
| Localisation | Position précise / approximative | **non collectée** : utilisée sur le téléphone seulement, jamais envoyée [Certain d'après le texte de la permission et la politique ; 🟠 confirme qu'aucun appel réseau n'envoie la position]. Quartier ou ville **choisis** par l'utilisateur → déclare « Localisation approximative », collectée, facultative. | non | facultatif | Fonctionnement de l'app |
| Photos et vidéos | Photos, vidéos | oui (profil, publications, chats, vérification) | non | facultatif | Fonctionnement de l'app ; selfie de vérification : prévention des fraudes et sécurité |
| Messages | Autres messages in-app | oui (chats, groupes) | non | facultatif | Fonctionnement de l'app |
| Activité dans l'app | Interactions (likes, abonnements, participations, votes, signalements) | oui | non | facultatif | Fonctionnement de l'app, analytique, sécurité |
| | Autre contenu généré par l'utilisateur (publications, commentaires, activités, Live) | oui | non | facultatif | Fonctionnement de l'app |
| | Requêtes à l'assistant (500 caractères max.) | oui | non | facultatif | Fonctionnement de l'app |
| Infos sur l'app et performances | Journaux de plantage, diagnostics | **non** (aucun SDK de crash) [Probable] | — | — | — |
| Identifiants de l'appareil | Jeton de notification push | oui | non | facultatif | Fonctionnement de l'app (notifications) |

🟠 À vérifier toi-même : le genre et la religion sont des données sensibles. Coche-les honnêtement (« Autres infos » et « Croyances religieuses ») : l'examen compare la fiche au comportement de l'app.

---

## 3. Suppression de compte

| Exigence Google | État |
|---|---|
| Suppression **dans l'app** | 🟢 Réglages → Compte → Supprimer mon compte (`src/features/settings/SettingsSections.tsx`, `src/features/auth/account.ts`) |
| **Page web** de demande de suppression, sans réinstaller l'app | 🟢 `https://getirly.com/delete-account` (page générée par le site, présente dans le build) |
| URL à déclarer dans la Console | `https://getirly.com/delete-account` |

🟠 Avant de soumettre, ouvre cette URL depuis un téléphone pour vérifier qu'elle décrit les étapes et ce qui est supprimé ou conservé (et combien de temps).

## 4. Contenu généré par les utilisateurs (politique UGC)

| Exigence | État |
|---|---|
| Conditions d'utilisation acceptées avant de publier | 🟢 pages `/terms` et `/guidelines` ; 🟠 vérifie que l'inscription y renvoie explicitement |
| Signalement des contenus et des profils | 🟢 présent (modération, boîte de signalements admin, audit du 10/2026) |
| Blocage des utilisateurs | 🟢 présent |
| Modération active et sanctions | 🟢 rôles, sanctions, journal d'audit côté admin |
| Accès IRLY Girl réservé aux femmes, vérifié par le serveur | 🟢 (RLS et contrôles serveur, tests DB) |

Classification du contenu (questionnaire IARC) : réponds **oui** à « interactions entre utilisateurs », « partage de contenu généré par les utilisateurs » et « partage de la position » (quartier ou ville choisis). Indique un public de **18 ans et plus** : la politique l'exige.

---

## 5. Accès à l'app pour les examinateurs (App access)

Choisis « Tout ou partie des fonctions sont restreintes » et colle :

```
IRLY requires an account. Please use this test account:
Email: <REVIEW_EMAIL>
Password: <REVIEW_PASSWORD>

1. Open the app and tap "Log in" (not "Sign up").
2. Enter the email and password above. No email code or 2FA is required for this account.
3. The account is a completed adult profile located in Dubai, with access to communities,
   activities, messages and IRLY Girl (women-only space).
4. To test reporting: open any post or profile → "…" → Report. To block: profile → "…" → Block.
5. To test account deletion, please use Settings → Account → Delete account on a NEW account
   you create, not on this review account (it is shared with our iOS review).
```

🟠 Remplace `<REVIEW_EMAIL>` et `<REVIEW_PASSWORD>` directement dans la Console, jamais dans le dépôt. Le compte de démo Apple existant (`appreview@getirly.com`) peut servir, à condition que sa connexion ne demande pas de code e-mail.

---

## 6. Test fermé et niveau d'API cible (vérifié le 01/11/2026)

- **Test fermé obligatoire** : les **comptes personnels créés après le 13 novembre 2023** doivent faire tourner un test fermé avec **au moins 12 testeurs inscrits sans interruption pendant 14 jours** avant de pouvoir demander l'accès à la production (Play Console Help, réponse 14151465). Les **comptes d'organisation** ne sont pas concernés.
  → IRLY est exploitée par ALF FASHION BRAND FZCO. Si le compte Play a été ouvert au nom de la société (compte d'organisation, avec D-U-N-S), la règle ne s'applique pas. Si c'est un compte personnel récent, prévois 12 testeurs et 14 jours.
- **Niveau d'API cible** : depuis le **31 août 2026**, les nouvelles apps et les mises à jour doivent cibler **Android 16 (API 36)** (Play Console Help, réponse 11926878 ; developer.android.com « Target API level requirements »). La prolongation possible allait jusqu'au 1er novembre 2026.
  → La configuration actuelle cible déjà l'API 36 [Probable ; confirme-le dans App bundle explorer après le premier build].

---

## 7. Fiche Play Store (brouillon)

- **Nom (30 caractères max)** : `IRLY – Make Friends IRL` (23)
- **Description courte (80 max)** : `Stop scrolling. Start meeting. Find friends & activities in Dubai, in real life.` (79)
- **Description longue** :

```
Stop scrolling. Start meeting.

IRLY helps expats, newcomers and residents of Dubai meet new people in real life.
Find activities around what you love, join communities, and turn online
connections into real friendships.

• Discover activities near you, or create your own: a run, a padel game, a brunch.
• Join communities by interest and chat with members before you meet.
• IRLY Girl: a women-only space to meet other women, plan activities and get advice.
• IRLY Network: meet people who are building projects, for a coffee or an activity.
• Message people and groups, share photos and moments.
• Safety built in: report and block anyone, community guidelines and active moderation.

IRLY is free at launch. You must be 18 or older to use IRLY.
```

- **Catégorie** : Social (sinon Lifestyle)
- **Contact** : getirly@gmail.com · site `https://getirly.com` · confidentialité `https://getirly.com/privacy`
- **Graphiques** : icône 512 × 512 (à exporter depuis `assets/icon.png`, sans transparence) ; image de présentation 1024 × 500 ; au moins 2 captures téléphone. 🟠 Les captures existantes (`site/shots/`) viennent de la version **web démo** : pour Android, il faut des captures prises sur l'app Android avec un compte de test, sans profils réels sans leur accord.

🟠 Ne présente pas le prix comme « gratuit pour toujours », sauf si c'est décidé.

---

## 8. Ce qui reste à faire à la main

1. Clé Google Maps Android → `app.json` (bloquant 1).
2. Projet Firebase, `google-services.json` et clé FCM v1 dans EAS (bloquant 2).
3. Vérifier le type de compte Play (personnel ou organisation) et, si besoin, recruter 12 testeurs pour 14 jours.
4. `eas build -p android --profile production`, puis importer le `.aab` en test interne et lire les avertissements de pré-lancement.
5. Tester sur un vrai téléphone Android : inscription, carte, photos, notifications, calendrier, signalement, blocage, suppression de compte, réinstallation.
6. Remplir Data safety (section 2), App access (section 5), classification du contenu, public cible (18+) et URL de suppression dans la Console.
7. Prendre de vraies captures Android pour la fiche.
