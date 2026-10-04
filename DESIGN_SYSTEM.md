# IRLY Design System (v3)

Noir et blanc, une seule famille de caractères, et un mouvement qui relie toujours deux états. Toute décision visuelle passe par un token (`src/theme/tokens.ts`, `src/motion/tokens.ts`) ; aucun écran ne code une couleur, une durée ou un ressort en dur.

Consultable dans l'app : Profil › « IRLY Design System ».

## Principes

- **Noir, blanc, quatre gris.** La couleur n'apparaît que sur les catégories, les statuts et les actions, jamais en aplat de fond.
- **La profondeur vient des paliers de gris, des filets et du verre**, pas des ombres (invisibles sur noir).
- **Chaque animation a une fonction** : orienter (d'où vient cet écran), confirmer (« You're going »), ou suivre un geste. Aucune boucle décorative, sauf l'anneau des éléments en cours.
- **Le geste pilote.** Pendant un glisser, rien n'est minuté ; au lâcher, un ressort repart de la vitesse du doigt.

## Couleurs

| Token | Valeur | Usage |
| --- | --- | --- |
| `bg` | `#000000` | Fond de tous les écrans |
| `surface` | `#0D0D0D` | Cartes au repos |
| `raised` | `#1A1A1A` | Cartes surélevées, champs |
| `overlay` | `#262626` | Chips, contrôles, boutons secondaires |
| `line` / `lineStrong` | blanc 8 % / 16 % | Séparateurs, contours |
| `text` / `textSecondary` / `textTertiary` | `#FFFFFF` / `#A3A3A3` / `#6B6B6B` | Texte (tertiaire : grandes tailles seulement) |
| `brand` / `onBrand` | `#FFFFFF` / `#000000` | Action principale : Join, Connect, Create |
| `glass` | `#121212` à 72 %, flou, filet blanc 10 % | Barre d'onglets, en-têtes, feuilles, contrôles de carte |

Catégories (`category`) : Sport `#32D74B`, Food `#FF9F0A`, Coffee `#C8A27A`, Padel `#64D2FF`, Beach `#FFD60A`, Nightlife `#BF5AF2`, Travel `#0A84FF`, Wellness `#66D4CF`, Activities `#FF6482`, Dog walk `#D4A373`. Statuts (`status`) : Live `#FF453A`, disponible maintenant `#32D74B`, plus tard `#FF9F0A`. La correspondance activité, événement ou lieu → couleur est dans `src/theme/categories.ts`.

Les lumières de destination (`src/theme/lights.ts`) ne teintent plus l'interface ; elles restent pour l'atmosphère de l'onboarding et du portail de destination.

## Typographie

Une seule famille : **Manrope** (Instrument Serif est retiré).

| Variante | Taille / interligne | Graisse | Usage |
| --- | --- | --- | --- |
| `displayL` | 34 / 38 | ExtraBold | « What's happening today? » |
| `cardTitle` | 26 / 28, capitales | ExtraBold | « PADEL TONIGHT » sur photo |
| `titleM` | 20 / 24 | Bold | Titres de section |
| `body` | 15 / 22 | Medium | Textes |
| `bodyS` | 13 / 18 | Medium | Lieu, heure, distance |
| `label` | 13 / 16 | Bold | Boutons, chips |
| `overline` | 11 / 14, capitales | SemiBold | Catégories, statuts |

Icônes : Lucide, trait 1,75, grille de 24. Aucun emoji dans l'interface.

## Espacements et rayons

Grille de 4 points, marge latérale 20, 32 entre sections. Rayons : 12 petits éléments, 28 cartes (`xl`), 32 grandes cartes et haut des feuilles (`xxl`), pilule pour boutons et chips.

## Motion design (`src/motion/tokens.ts`)

| Token | Valeur | Usage |
| --- | --- | --- |
| `motion.fast` / `normal` / `slow` | 150 / 260 / 400 ms | Fondus, pression, recentrage caméra |
| `ease.standard` | bezier(.2, 0, 0, 1) | Tout mouvement sans ressort |
| `ease.enter` / `ease.exit` | bezier(.05, .7, .1, 1) / (.3, 0, .8, .15) | Entrées, sorties |
| `ease.camera` | bezier(.65, 0, .15, 1) | Passage 2D ↔ 3D |
| `spring.soft` | 520 ms, amortissement 0,96 | Surfaces qui changent de forme : carte → page, avatar → profil, Create |
| `spring.medium` | 460 ms, 0,9 | Ce qui voyage : feuilles, indicateur d'onglet, écrans |
| `spring.strong` | 560 ms, 0,58 | Retour ressenti : marqueur choisi, Join, catégorie choisie |
| `scale.press` / `hover` / `selected` | 0,96 / 1,02 / 1,12 | Pression, survol web, sélection |
| `blur.light` / `medium` / `strong` | 30 / 55 / 80 | Chips sur carte, contrôles, feuilles et barre d'onglets |
| `staggerStep` | 55 ms, 6 éléments au plus | Révélations en cascade |

Les anciens noms v2 (`spring.smooth`, `spring.bouncy`, `spring.sheet`...) sont des alias des trois ressorts.

### Règles

- On n'anime que `transform` et `opacity`, sur le fil graphique (Reanimated).
- Le flou ne s'anime jamais : un calque de verre apparaît en fondu.
- « Réduire les animations » : `ReducedMotionConfig` (système) termine les animations instantanément ; le squelette ne balaie plus.

### Flows signatures

| Flow | Ce qui se passe | Où |
| --- | --- | --- |
| Lancement de la Home | En-tête, question, catégories, carte du jour, personnes, activités se révèlent en cascade | `app/(tabs)/index.tsx` |
| Carte → page Activité | La carte s'agrandit depuis sa position, garde photo, titre, lieu et participants | `features/hero/HeroHost.tsx` |
| Carrousels | Le plus proche du centre grossit, les autres reculent, accrochage et inertie natifs | `Carousel` dans `components/cards/HomeCards.tsx` |
| Marqueur → feuille | Marqueur ×1,12 et halo une fois, caméra recentrée au-dessus de la feuille, feuille en aperçu | `app/(tabs)/map.tsx` |
| Feuille de la carte | Trois crans (136 px, moitié, presque plein), suit le doigt, choisit le cran avec la vitesse, résiste en haut, se ferme d'un geste vers le bas | `features/map/MapSheet.tsx` |
| 2D → 3D | Indicateur qui glisse, caméra inclinée 56° en 1,2 s (`ease.camera`), brume à l'horizon, marqueurs droits et synchronisés | `app/(tabs)/map.tsx`, `features/map/MapMarkers.tsx` |
| Marqueurs | Entrée 0,8 → 1 en cascade, sortie en fondu, clusters qui se défont en zoomant | `features/map/MapMarkers.tsx` |
| Barre d'onglets | Pilule qui glisse, icône active à ×1,12, haptique de sélection | `components/navigation/TabBar.tsx` |
| Create | Le bouton + grandit en cercle jusqu'à l'écran et devient la croix ; catégories en cascade | `features/create/CreateHost.tsx` |
| Join | Pression, ressort, « You're going » avec coche verte, haptique, toast ; ton avatar rejoint la pile | `components/ui/JoinButton.tsx`, `features/hero/details.tsx` |
| Chargement | Squelettes à la géométrie finale, balayage très doux | `components/ui/Skeleton.tsx`, `components/visual/Photo.tsx` |

Les prototypes de ces flows sont sur le canevas « IRLY v3 — écrans ».

### Haptique (`haptic(kind)`)

| Type | Usage |
| --- | --- |
| `select` | Onglets, chips, crans de feuille, marqueur |
| `tap` | Impact léger |
| `press` | 2D ↔ 3D, Create |
| `success` | Join, publication |

## Composants

| Famille | Composants | Fichier |
| --- | --- | --- |
| Base | `Text`, `Icon`, `Button`, `IconButton`, `Chip` (point de catégorie), `Badge`, `LiveDot`, `Segmented`, `Field`, `JoinButton`, `Skeleton` | `components/ui` |
| Surfaces | `Glass`, `Sheet`, `Toast` | `components/ui` |
| Home | `HighlightCard`, `HappeningRow`, `PersonBubble`, `Carousel` | `components/cards/HomeCards.tsx` |
| Carte | `MarkerView` (personne, activité, événement, groupe, lieu), `ClusterView`, `Projected`, `MapSheet` | `features/map` |
| Navigation | `TabBar` (Home, Discover, Create, Map, Profile), `HomeHeader`, `PageHeader`, `DestinationPill` | `components/navigation` |
| Création | `CreateHost` | `features/create` |

## Accessibilité

- Toutes les commandes ont un libellé et un rôle ; chaque cran de feuille est aussi atteignable au toucher de son en-tête.
- Contraste : texte 21:1, secondaire 8:1 ; le tertiaire est réservé aux grandes tailles.
- Cibles de 44 px au moins, `hitSlop` sur les petites.
