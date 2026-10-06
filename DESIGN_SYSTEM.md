# IRLY Design System (v5, IRLY Noir)

Noir, blanc, gris doux et verre. Une seule famille de caractères, et un mouvement qui relie toujours deux états. Toute décision visuelle passe par un token (`src/theme/tokens.ts`, `src/motion/tokens.ts`) ; aucun écran ne code une couleur, une durée ou un ressort en dur.

Consultable dans l'app : Profil › « IRLY Design System ». L'apparence se change dans Profil › Réglages › Apparence (Sombre par défaut, Clair disponible). L'onboarding reste toujours sombre.

## Principes

- **L'écran du logo.** Fond presque noir, surfaces en gris qui montent par paliers, verre au-dessus des photos, blanc pour l'unique action principale. La couleur vient des photos.
- **Couleur très limitée.** Les couleurs de catégorie n'apparaissent que sur une icône, un point ou un halo, jamais en aplat. Le rouge « live » signale ce qui se passe maintenant.
- **Couches.** Photo → photo floutée → verre → contenu → action. Une page de détail repose sur sa propre photo floutée et assombrie (`Backdrop`).
- **Chaque animation a une fonction** : orienter (d'où vient cet écran), confirmer (« You're going »), suivre un geste ou donner de la profondeur au défilement. Les seules boucles : ce qui est live, la respiration du bouton IRL, la dérive lente de la photo d'accueil.
- **Le geste pilote.** Pendant un glisser, rien n'est minuté ; au lâcher, un ressort repart de la vitesse du doigt.

## Couleurs (IRLY Noir)

| Token | Valeur | Usage |
| --- | --- | --- |
| `bg` | `#050506` | Fond de tous les écrans |
| `surface` | `#0E0F12` | Cartes au repos |
| `raised` | `#16181C` | Cartes surélevées, feuilles |
| `overlay` | `#202227` | Contrôles pleins |
| `card` | blanc 5,5 % | Carte posée sur une page qui peut avoir une photo derrière (pages de détail) |
| `line` / `lineStrong` | blanc 8 % / 15 % | Séparateurs, contours |
| `text` / `textSecondary` / `textTertiary` | `#FFFFFF` / 68 % / 44 % | Texte (tertiaire : grandes tailles seulement) |
| `brand` / `onBrand` | `#FFFFFF` / `#050506` | Action principale : bouton IRL, Join, Connect, Create |
| `steel` | `#8EA5BF` | Lumière acier du logo : halo de l'intro et du match |
| `live` / `positive` / `caution` | `#FF453A` / `#32D74B` / `#FF9F0A` | Statuts |

IRLY Clair (`day`) garde les mêmes noms de tokens : fond `#F6F6F4`, cartes blanches, noir pour l'action principale.

### Verre (`glassLevels`)

| Niveau | Flou | Teinte Noir | Usage |
| --- | --- | --- | --- |
| `thin` | 30 | blanc 8 % | Chips et petits contrôles sur photo |
| `regular` | 55 | `rgba(22,24,28,.42)` | Panneaux sur une photo ou un fond flouté |
| `thick` | 80 | `rgba(14,15,18,.66)` | Barre d'onglets, en-têtes, feuilles, menus |

Chaque verre a un filet clair et un reflet doux en haut. Sur Android, une teinte dense remplace le flou en direct. Le flou ne s'anime jamais : le calque apparaît en fondu.

## Typographie

Une seule famille : **Manrope**.

| Variante | Taille / interligne | Usage |
| --- | --- | --- |
| `displayXL` | 46 / 48 | Grandes déclarations sur photo |
| `displayL` | 36 / 40 | La question d'un écran : « What's happening around you? », « Your move. » |
| `displayM` | 28 / 32 | Titres d'onglets (« Discover ») |
| `cardTitle` | 28 / 30, capitales | « SUNSET YOGA ON THE SAND » sur photo |
| `titleL` / `titleM` / `titleS` | 24 / 20 / 16 | Titres de carte, de section, de ligne |
| `body` / `bodyS` | 15 / 13 | Textes, lieu, heure |
| `label` / `overline` | 13 / 11 (capitales) | Boutons, chips, catégories, onglets |

Icônes : Lucide, trait 1,75 à 2,1, grille de 24.

## Espacements et rayons

Grille de 4 points, marge latérale 20, 40 entre sections sur l'accueil. Rayons : 12 petits éléments, 28 cartes (`xl`), 32 grandes cartes et haut des feuilles (`xxl`), pilule pour boutons, chips et onglets.

## Motion design (`src/motion/tokens.ts`)

| Token | Valeur | Usage |
| --- | --- | --- |
| `motion.fast` | 160 ms | Micro-interactions : pression, like, chip |
| `motion.normal` / `standard` | 260 / 300 ms | Navigation : onglets, pages, feuilles |
| `motion.emphasized` | 500 ms | Grandes transitions : carte → page, menu IRL, destination |
| `motion.cinematic` | 760 ms | Match, intro, moments IRL |
| `spring.soft` | 520 ms, 0,96 | Surfaces qui changent de forme : carte → page, avatar → profil |
| `spring.medium` | 460 ms, 0,9 | Ce qui voyage : feuilles, indicateurs |
| `spring.strong` | 560 ms, 0,58 | Retour ressenti : marqueur, Join, catégorie choisie |
| `spring.physical` | 420 ms, 0,74 | Le bouton IRL et son menu |
| `spring.cinematic` | 760 ms, 0,88 | Le match et l'intro |
| `scale.press` / `selected` | 0,96 / 1,12 | Pression, sélection |
| `staggerStep` | 55 ms | Révélations en cascade |

### Règles

- On n'anime que `transform` et `opacity`, sur le fil graphique (Reanimated), à 60 i/s.
- « Réduire les animations » : l'intro est sautée, les révélations au défilement et la profondeur des rails sont coupées, le menu IRL et le match apparaissent en fondu. Rien ne reste caché.

### Flows signatures

| Flow | Ce qui se passe | Où |
| --- | --- | --- |
| Entrée dans l'app | Noir, le logo en points s'allume, puis le rideau se lève pendant que l'accueil zoome depuis l'arrière | `features/intro/AppIntro.tsx` |
| Accueil | Photo plein cadre de la ville (de nuit après la tombée du jour), parallaxe, étirement au tirer, dérive lente ; la question arrive mot par mot | `features/home/HomeHero.tsx` |
| Défilement | Chaque section monte, grandit de 94 % à 100 % et apparaît en franchissant le bas de l'écran ; réversible | `motion/ScrollReveal.tsx` |
| Rails | La carte qui entre par la droite est plus petite et plus sombre et grandit en place ; celle qui sort recule | `Rail` dans `components/cards/Blocks.tsx` |
| Bouton IRL | Le disque s'écrase comme une goutte de verre, une vitre floutée s'étend en cercle, une onde de lumière part, cinq actions jaillissent en arc ; « IRL » devient une croix. Appui long : le fil live | `features/irl/IrlMenu.tsx`, `components/navigation/TabBar.tsx` |
| Discover | Quatre pages qui se balaient : PEOPLE, ACTIVITIES, PLACES, EVENTS. La pilule blanche colle au doigt, la page quittée rétrécit et pâlit, le titre se replie au défilement | `app/(tabs)/discover.tsx`, `features/discover` |
| Avatar → profil | Le visage touché décolle, vole en arc en grandissant et se pose en haut du profil qui apparaît en fondu | `features/flight` |
| Carte → page | La carte grandit depuis sa position ; la page repose sur sa photo floutée | `features/hero/HeroHost.tsx` |
| IT'S AN IRLY MATCH | Les deux visages glissent et se rejoignent, un halo respire, une gerbe de points IRLY part, la marque se pose (haptique) ; puis les mots, les intérêts communs, « Say hello » et « Find something to do » | `features/match/IrlyMatch.tsx` |
| Changer de destination | La lumière de la nouvelle ville s'ouvre comme un portail, l'accueil se reconstruit et rezoome | `features/destination/DestinationTransition.tsx` |
| Créer | Le bouton grandit en cercle ; douze choix rapides répondent à « What do you want to do? » en un geste | `features/create/CreateHost.tsx` |
| Chiffres | Les compteurs du profil défilent jusqu'à leur valeur | `motion/CountUp.tsx` |
| Chargement | Squelettes à la géométrie finale, photo qui passe du flou au net | `components/ui/Skeleton.tsx`, `components/visual/Photo.tsx` |

### Haptique (`haptic(kind)`)

| Type | Usage |
| --- | --- |
| `select` | Onglets, chips, pages de Discover, crans de feuille |
| `tap` | Impact léger, fin de l'intro |
| `press` | Bouton IRL, actions du menu IRL, Create |
| `heavy` | Appui long sur IRL |
| `success` | Join, publication, match |

## Composants

| Famille | Composants | Fichier |
| --- | --- | --- |
| Base | `Text`, `Icon`, `Button`, `IconButton`, `Chip`, `Badge`, `LiveDot`, `Segmented` (pilule blanche sur verre), `Field`, `Skeleton` | `components/ui` |
| Surfaces | `Glass` (trois niveaux), `GlassCard`, `Sheet`, `Toast`, `Backdrop` | `components/ui`, `components/visual` |
| Accueil | `HomeHero`, `GirlPortals`, `HighlightCard`, `PersonBubble`, `Carousel`, `CategoryCard` | `features/home`, `components/cards/HomeCards.tsx` |
| Discover | `DiscoverTabs`, pages People, Activities, Places, Events, `DoorTile` | `features/discover` |
| IRL | `IrlMenu`, `IrlDiscFace` | `features/irl` |
| Motion | `ScrollReveal`, `CountUp`, `PressableScale`, `AppIntro`, `FlightHost`, `MatchHost` | `motion`, `features` |
| Carte | `MarkerView` (verre fumé en Noir), `ClusterView`, `MapSheet` | `features/map` |
| Navigation | `TabBar` (Home, Discover, IRL, Map, Profile), `HomeHeader`, `PageHeader`, `DestinationPill` | `components/navigation` |

IRLY Girl garde son propre univers crème et rose (`features/girl/theme.ts`) : on sent qu'on y entre.

## Accessibilité

- Toutes les commandes ont un libellé et un rôle ; les menus plein écran sont modaux pour les lecteurs d'écran.
- Contraste : texte 21:1 sur Noir, secondaire au moins 7:1 ; le tertiaire est réservé aux grandes tailles.
- Cibles de 44 px au moins, `hitSlop` sur les petites ; la taille du texte suit le réglage système (jusqu'à ×1,3).
