# Carte Google : ce qui reste à faire

**Sur téléphone, la carte est réelle** (`features/map/RealMap.native.tsx`, `react-native-maps`, inclus dans Expo Go, sans clé) : Apple Plans sur iPhone, Google Maps sur Android, vrais bâtiments 3D quand on passe en 3D (caméra inclinée à 60°). Les marqueurs IRLY sont placés aux coordonnées réelles des quartiers (`data/geo.ts`), jamais à une adresse.

Sur le web, la carte reste la carte IRLY dessinée (`features/map/MapArt.tsx`).

Ce qui suit concerne **Google Maps partout, y compris sur iPhone, et la 3D photoréaliste de Google**, qui demandent une clé et une build de développement (pas Expo Go). Toute la couche IRLY (marqueurs, clusters, feuille, 2D/3D, recherche) est indépendante du fond de carte : la caméra est un état partagé (`Camera` dans `features/map/MapMarkers.tsx`) et les marqueurs sont projetés à l'écran par `project()`.

Google Maps sur iPhone et la 3D photoréaliste ne sont **pas faits**, faute de clé.

## Étape 1 : le test d'une journée (avant tout le reste)

1. Créer un projet Google Cloud avec facturation, activer Maps JavaScript API, Places API (New), Geocoding API.
2. Créer une clé restreinte : domaines autorisés (Vercel + `localhost`), ces trois API seulement, quota journalier et alerte de budget.
3. Créer un Map ID vectoriel « IRLY Night » : terre `#070707`, routes `#262626`, eau `#1B1B1D`, noms de quartiers `#8A8A8A`, points d'intérêt discrets.
4. Mettre la clé dans `.env` (non versionné) : `EXPO_PUBLIC_GOOGLE_MAPS_KEY=...`, et dans les variables EAS.
5. Charger Maps JavaScript dans `react-native-webview` (inclus dans Expo Go) sur iPhone et Android, avec la 3D (`Map3DElement`) et un marqueur SVG ; mesurer la fluidité.

On continue seulement si ce test tient 60 images par seconde en 2D et reste utilisable en 3D.

## Étape 2 : brancher le moteur

- Un composant `GoogleMapView` qui reçoit les mêmes commandes que la carte IRLY (caméra, inclinaison, marqueurs, sélection) et renvoie les mêmes événements (marqueur touché, carte immobile, prête, erreur).
- En 3D, Google n'accepte que des images et du SVG : chaque marqueur est déjà un dessin simple, à exporter en SVG.
- Le bouton 3D passe alors de « vue inclinée » à la vraie 3D photoréaliste ; la note « photorealistic 3D arrives with Google Maps » disparaît.
- Sans couverture 3D vérifiée pour une zone : vue vectorielle inclinée, jamais de fausse 3D.
