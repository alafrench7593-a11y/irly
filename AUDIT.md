# Audit de l'application IRLY v1 et choix de la refonte

Base auditée : `irly-mobile-app-main` (archive fournie). La v2 a été reconstruite à partir du pitch « IRLY, Pitch aux Incubateurs UAE » et du brief de refonte, en reprenant ce qui tenait dans la v1.

## Constat

| Sujet | v1 | Problème par rapport au pitch |
| --- | --- | --- |
| Positionnement | Application sociale pour **femmes expatriées à Dubai** (design.md), marketplace de services « Women only », pilier « Girl Trips » | Le pitch vise tous les profils (expatriés, locaux, touristes, entrepreneurs, étudiants, nomades) et plusieurs destinations |
| Géographie | Dubai uniquement, codé en dur | Pas de notion de destination ni de ville, impossible d'ouvrir Bali ou un autre émirat sans réécrire |
| Socle technique | Gabarit Manus (`app-template`), Expo SDK 54, NativeWind | Dépendance à la plateforme Manus pour l'authentification et les services serveur |
| Serveur | Express + tRPC + Drizzle (MySQL), mais seulement les routes `system` et `auth` (fichier `routers.ts` de 28 lignes) | Aucune API métier : les données de l'app sont des fichiers locaux |
| Données | Stores locaux (`lib/*.ts`, environ 4 200 lignes) : réservations, annulation, report, avis, favoris, offres, chat | Logique utile, mais propre à Dubai et au positionnement « women only » |
| Historique produit | todo.md : d'abord une pile de profils à swiper (Discover, Likes, match), puis refonte en app d'activités | Les traces du modèle « swipe » vont à l'encontre du « human-first » du pitch |
| Design | Thème crème, pêche et rose, composants hétérogènes, pas de tokens d'animation | Pas de système de design réutilisable, pas d'identité par destination |
| Tests | 13 fichiers Vitest sur les stores | Point positif, à reprendre quand l'API existera |

## Ce qui a été repris

- Le **module sport et activités** : sessions, niveaux, communautés de sport, et les photos réelles de sports déjà présentes.
- Le **principe des services vérifiés** avec réservation d'un créneau.
- La **messagerie** (liste de conversations et fil), le **profil** et les **communautés** comme piliers.

## Ce qui a été changé

- **Architecture multi-destination** : destination, puis ville, puis contenu propre à la ville (quartiers, devise, heure locale, sections de la Home, activités, catégories de services, thèmes business). Emirates (7 émirats) et Bali sont actifs ; Thaïlande, Singapour, Londres et Paris sont en liste d'attente.
- **Profils universels** : Expat, Local, Tourist, Entrepreneur, Professional, Student, Digital Nomad, avec un matching qui explique pourquoi deux personnes devraient se rencontrer.
- **Socle neuf** : Expo SDK 57, nouvelle architecture React Native, Expo Router, Reanimated 4, Gesture Handler. Plus de dépendance Manus ni NativeWind : un design system à base de tokens.
- **Motion design** : logo animé, transitions carte vers plein écran, portail de changement de destination, barre d'onglets animée, haptique.
- **Photos réelles uniquement**, centralisées dans un seul fichier.

## Pas encore repris de la v1

À arbitrer avant la prochaine version :

- **Marketplace de services entre membres** : créer une offre, avis, annulation et report d'une réservation, favoris.
- **Images de partage** (cartes à partager sur les réseaux).
- **Création d'une session de sport** avec formulaire complet (la v2 propose « Post a plan » dans Social, plus simple).

## Décision à confirmer

La v2 abandonne le positionnement « femmes uniquement » au profit d'une app ouverte à tous, comme le pitch. Si la sécurité et l'entre-soi féminin restent un argument fort pour Dubai, il peut revenir sous forme de **communautés et d'événements réservés aux femmes** dans la v2, sans fermer le produit.

## Pour passer en production

1. **Backend** : comptes et authentification (Apple, Google, téléphone), API pour les contenus, messagerie temps réel, notifications push. `src/data/repo.ts` est le point unique à brancher.
2. **Confiance** : vérification d'identité réelle avant d'afficher le badge « Verified », modération, signalement.
3. **Photos** : héberger les photos sur votre stockage, puis les remplacer par vos propres photos d'événements.
4. **Carte** : fond de carte réel (Mapbox ou Apple Maps).
5. **Paiements** : billets d'événements et réservations de services.
