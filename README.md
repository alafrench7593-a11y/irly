# IRLY 3.0

**Connect. Relocate. Belong.** L'application qui aide les expatriés, les locaux, les nomades et les entrepreneurs à se rencontrer en vrai, à s'installer et à trouver leur place dans une ville.

Une seule application, une destination différente à chaque atterrissage : **IRLY Emirates** (les 7 émirats, Dubai en ville de lancement) et **IRLY Bali**, avec Thaïlande, Singapour, Londres et Paris en liste d'attente.

Application Expo (React Native), une seule base de code pour iOS, Android et le web.

---

## Lancer l'app sur ton téléphone (5 minutes)

Prérequis : Node.js 20 ou plus récent, et l'app **Expo Go** sur ton téléphone (App Store ou Google Play).

```bash
npm install
npx expo start
```

Scanne le QR code affiché dans le terminal :

- **iPhone** : avec l'appareil photo.
- **Android** : depuis Expo Go.

Le téléphone et l'ordinateur doivent être sur le même réseau Wi-Fi. Sinon : `npx expo start --tunnel`.

Version web (aperçu dans le navigateur) : `npx expo start --web`.

## Commandes

| Commande | Rôle |
| --- | --- |
| `npm start` | Serveur de développement Expo |
| `npm run web` | Aperçu web |
| `npm run typecheck` | Vérification TypeScript |
| `npm run lint` | ESLint (config Expo, règles React Compiler incluses) |
| `npm run export:web` | Build web statique dans `dist/` |

Pour publier sur les stores : `npx eas build` (compte Expo requis), puis `npx eas submit`.

## Mettre la version web en ligne (Vercel)

La configuration est prête dans `vercel.json` (build `npx expo export --platform web`, dossier `dist`, toutes les routes renvoyées vers l'app).

- **Depuis GitHub** : importer le dépôt dans Vercel, aucun réglage à changer.
- **Depuis ton ordinateur** : `npx vercel` dans le dossier du projet, puis `npx vercel --prod` pour l'adresse publique.

Le workflow `.github/workflows/ci.yml` vérifie TypeScript, ESLint et le build web à chaque push.

## Ce que fait l'app

- **Onboarding** : logo animé, choix de la destination (Emirates ou Bali), choix de l'émirat, profil (type de membre, intérêts, activités), écran « Building your city ».
- **Home contextuelle** : « Good evening, Dubai. » ou « Good morning, Bali. » selon l'heure locale de la ville, sections propres à chaque destination (coworking à Bali, business à Dubai, etc.).
- **Changement de destination** : bouton « Dubai ▾ », transition en portail vers la nouvelle ville, tout le contenu change (pas seulement le nom).
- **Discover, Social, Map, Profile** en onglets ; **Events** (filtres Today, Tomorrow, This week, Weekend + catégories), **Activities**, **Services vérifiés**, **Business**, **Communities**, **Messages**, **profils membres**, **smart matching** (« Who would you like to meet? »).
- **Cartes qui s'ouvrent en plein écran** (transition carte vers page, fermeture par glissement vers le bas).
- **Mode jour et nuit automatique** selon l'heure de la ville, haptique sur iOS et Android, respect du réglage « Réduire les animations ».
- **Design System consultable dans l'app** : Profil, puis « IRLY Design System ». On y trouve aussi la planche de toutes les photos utilisées.

## Photos

Uniquement des **photos réelles** issues d'Unsplash (licence Unsplash : usage commercial gratuit, sans attribution obligatoire). Aucune illustration générée.

- Toutes les photos sont déclarées dans `src/data/photos.ts` par clé (`dubai`, `padel`, `coworking`...). Remplacer une photo = changer un identifiant à un seul endroit.
- Les photos se chargent depuis le CDN d'Unsplash et sont mises en cache sur l'appareil. Pendant le chargement, le cadre affiche les couleurs de la destination.
- **Avant la mise en production**, héberger les photos sur votre propre stockage (ou passer par l'API Unsplash avec ses règles d'attribution) et les remplacer progressivement par vos propres photos d'événements.

Les membres sont représentés par des **initiales** (pas de visages de banque d'images présentés comme de faux membres).

## Structure du code

```
src/
  app/            Routes (Expo Router) : onglets, onboarding, pages
  theme/          Tokens (couleurs jour/nuit, typo, espacements, rayons, ombres), lumières par destination
  motion/         Tokens d'animation, haptique, presets d'entrée, PressableScale
  brand/          Logo animé (états idle, loading, success, transition)
  components/     UI (boutons, chips, sheets, glass...), cartes, navigation, layout, photos
  features/       Transition carte plein écran, changement de destination, carte, matching, messages, onboarding
  data/           Destinations, catalogue, contenu de démo par ville, photos
  state/          Store (zustand, persisté sur l'appareil)
  lib/            Heure locale par ville, formats (AED, IDR)
```

## Données

Le contenu est un **jeu de démonstration réaliste** (membres, sessions, événements, lieux, communautés, services) stocké dans `src/data/content/` :

| Ville | Membres | Sessions | Événements | Lieux | Communautés | Services |
| --- | --- | --- | --- | --- | --- | --- |
| Dubai | 14 | 12 | 9 | 8 | 7 | 12 |
| Bali | 12 | 10 | 6 | 6 | 4 | 10 |
| Autres émirats (6) | 5 à 6 | 4 à 5 | 2 à 4 | 3 à 4 | 2 à 3 | services de Dubai |

Les actions (rejoindre, sauvegarder, se connecter, réserver, envoyer un message, publier un plan) fonctionnent et sont gardées sur l'appareil. **Il n'y a pas encore de serveur** : pas de comptes, pas de messagerie temps réel, pas de paiement, pas de vérification d'identité réelle. Toute la lecture des données passe par `src/data/repo.ts`, qui est le point unique à brancher sur une API.

## Ce qui change en v3

- **Noir et blanc** : une seule palette, Manrope seule, la couleur réservée aux catégories et statuts. Plus de mode jour ni de violet de marque.
- **Navigation** : Home, Discover, Create (au centre), Map, Profile. Messages passe dans l'en-tête ; Social devient « Plans », accessible depuis la Home.
- **Home** : « What's happening today? », catégories, carte du jour, People around you (carrousel avec profondeur), Activities near you.
- **Carte** : marqueurs personne, activité, événement, groupe, lieu ; clusters selon le zoom ; feuille à trois crans pilotée au doigt ; passage 2D ↔ 3D avec caméra inclinée ; recherche.
- **Create** : le bouton + s'ouvre en plein écran, trois étapes.
- **Motion** : tokens `motion`, `ease`, `spring.soft/medium/strong`, `scale`, `blur` dans `src/motion/tokens.ts`. Détail dans [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md).

## Limites connues

- Carte : réelle sur téléphone (Apple Plans sur iPhone, Google Maps sur Android, bâtiments 3D) ; carte IRLY dessinée sur le web. Google Maps sur iPhone et la 3D photoréaliste demandent une clé : [docs/GOOGLE_MAPS.md](./docs/GOOGLE_MAPS.md).
- La transition avatar → profil entre deux écrans est une révélation en cascade, pas encore un élément partagé continu.
- Les badges « Verified » sont de la démonstration tant que le parcours de vérification n'existe pas.
- Pas de notifications push.

## Documents

- [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md) : tokens, composants, motion design, règles.
- [docs/GOOGLE_MAPS.md](./docs/GOOGLE_MAPS.md) : passage à la carte Google.
- [AUDIT.md](./AUDIT.md) : audit de l'ancienne application et choix de la refonte.
