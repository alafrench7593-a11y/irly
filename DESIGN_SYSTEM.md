# IRLY Design System

Référence du système visuel et du motion design d'IRLY 2.0. La source de vérité est le code (`src/theme`, `src/motion`, `src/components`) ; ce document l'explique. Une version vivante est consultable dans l'app : Profil, puis « IRLY Design System ».

## Principes

1. **La vraie vie d'abord.** Les écrans montrent des gens, des lieux et des moments réels : photos réelles, heures locales, quartiers, prix en monnaie locale.
2. **Une seule app, une lumière par ville.** Les couleurs cœur (marque, texte, surfaces) ne changent jamais. Chaque destination apporte sa photo et une couleur d'accent tirée de cette photo.
3. **Premium par la retenue.** Fond sombre profond la nuit, ivoire le jour, une seule couleur de marque, du verre uniquement pour ce qui flotte au-dessus du contenu.
4. **Le mouvement oriente.** Les choses se rejoignent (rencontre), se posent (ressorts) et s'ouvrent (expansion). Jamais d'animation décorative en boucle sur du contenu.

## Couleurs

Deux palettes complètes, choisies automatiquement selon l'heure locale de la ville (jour de 6 h 30 à 18 h) ou forcées dans les réglages.

| Token | Nuit | Jour | Usage |
| --- | --- | --- | --- |
| `bg` | `#08080C` | `#F5F4F0` | Fond d'écran |
| `surface` | `#111117` | `#FFFFFF` | Cartes, listes |
| `raised` | `#18181F` | `#FFFFFF` | Sheets, boutons ronds |
| `overlay` | `#22222B` | `#EEECE6` | Surfaces internes |
| `text` | `#F4F3F8` | `#0C0B14` | Texte principal |
| `textSecondary` | 66 % | 62 % | Texte secondaire |
| `textTertiary` | 42 % | 42 % | Métadonnées |
| `brand` | `#8B6CFF` | `#6A4CF5` | Marque, actions principales |
| `live` | `#FF6A4D` | `#F2542D` | « En ce moment », la couleur de la vraie vie |
| `positive` | `#3DDC97` | `#12A86B` | Confirmé, vérifié, rejoint |
| `caution` | `#FFC15E` | `#C98500` | Attention |
| `critical` | `#FF5D6C` | `#E23B4E` | Erreur |

Chaque couleur d'action a sa version douce (`brandSoft`, `liveSoft`, `positiveSoft`) pour les fonds de chips et de badges.

### Lumières de destination (`src/theme/lights.ts`)

Une lumière = 4 tons prélevés sur la photo de la ville (du haut vers le bas), un accent lisible sur fond sombre, un accent pour le mode jour et sa version douce. Elle teinte l'italique du message d'accueil, les chips d'activité, la carte et l'état de chargement des photos.

| Destination | Accent nuit | Accent jour |
| --- | --- | --- |
| Dubai | `#FFAD80` | `#D9622E` |
| Abu Dhabi | `#6FD8CB` | `#14837A` |
| Sharjah | `#F59A72` | `#B5502C` |
| Ajman | `#74D3DE` | `#167C8A` |
| Ras Al Khaimah | `#E9AA90` | `#A85A3E` |
| Bali, Fujairah, Umm Al Quwain, Thaïlande, Singapour, Londres, Paris | voir `lights.ts` | |

## Typographie

Deux familles, chargées une fois au démarrage :

- **Instrument Serif** pour les moments humains et éditoriaux : salutations, noms de villes, titres d'événements.
- **Manrope** pour l'interface.

| Variante | Police | Taille / interligne |
| --- | --- | --- |
| `displayXL` | Instrument Serif | 46 / 48 |
| `displayL` | Instrument Serif | 36 / 40 |
| `displayM` | Instrument Serif | 28 / 32 |
| `titleL` | Manrope ExtraBold | 24 / 30 |
| `titleM` | Manrope Bold | 19 / 25 |
| `titleS` | Manrope Bold | 16 / 21 |
| `bodyL` | Manrope Medium | 16 / 24 |
| `body` | Manrope Medium | 15 / 22 |
| `bodyS` | Manrope Medium | 13 / 18 |
| `label` | Manrope Bold | 13 / 16 |
| `caption` | Manrope SemiBold | 12 / 16 |
| `overline` | Manrope ExtraBold, capitales, interlettrage 1.4 | 11 / 14 |
| `number` | Manrope ExtraBold | 22 / 26 |

Le logotype « IRLY » est en Manrope ExtraBold avec un interlettrage de 0,16 em.

## Espacements, rayons, ombres

- **Grille de 4 points** : 2, 4, 8, 12, 16, 20, 24, 32, 40, 56, 72. Marge latérale d'écran : 20.
- **Rayons** : xs 8, sm 12, md 16, lg 22, xl 28, xxl 34, pill. Le rayon grandit avec la taille de la surface (chip, carte, sheet, couverture).
- **Ombres** (`boxShadow`, nouvelle architecture) : `card`, `float`, `glow` (halo de marque pour l'action principale). Plus denses la nuit, plus légères et teintées de violet le jour.
- **Verre** (`Glass`) : flou réel sur iOS et web, teinte dense sur Android (lisible et économe dans les listes). Réservé au chrome : barre d'onglets, en-têtes, sélecteur de destination, CTA flottants.

## Photographie

- Photos réelles uniquement (Unsplash), déclarées par clé dans `src/data/photos.ts`.
- Composant `Photo` : fondu enchaîné à l'arrivée, cache disque, état de chargement aux couleurs de la destination (jamais de boîte grise), voiles dégradés `soft`, `strong`, `full` pour garder le texte lisible.
- Composant `Cover` : couverture de page à coins inférieurs arrondis, parallaxe au défilement, étirement au tirer-vers-le-bas, uniquement des transformations (fluide à 60 i/s).

## Motion design (`src/motion/tokens.ts`)

### Durées et courbes

| Token | Valeur |
| --- | --- |
| `micro` / `fast` / `base` / `slow` / `xslow` | 120 / 200 / 300 / 450 / 700 ms |
| `standard` | cubic-bezier(0.2, 0, 0, 1) : tout ce qui entre ou bouge |
| `emphasized` | cubic-bezier(0.3, 0, 0, 1) : mouvements de page |
| `exit` | cubic-bezier(0.4, 0, 1, 1) : sorties |

### Ressorts (durée perçue + amortissement)

| Token | Durée | Amortissement | Usage |
| --- | --- | --- | --- |
| `press` | 260 ms | 0.72 | Retour d'appui |
| `snappy` | 380 ms | 0.86 | Indicateurs, chips, interrupteurs |
| `smooth` | 520 ms | 0.96 | Cartes qui s'ouvrent, grandes surfaces |
| `bouncy` | 560 ms | 0.58 | Célébration : rejoindre, se connecter, succès |
| `sheet` | 460 ms | 0.9 | Bottom sheets |

- **Appui** : échelle 0.97 puis retour en ressort `press`, avec haptique.
- **Entrées** : montée d'environ 25 px avec fondu, en ressort, décalée de 55 ms par élément pour que la page se lise de haut en bas.

### Chorégraphies signatures

- **Logo** (`IrlyMark`) : deux anneaux qui se rejoignent sur une lentille violette. États `idle` (respiration lente), `loading` (orbite), `success` (les anneaux fusionnent, coche), `transition` (la lentille s'ouvre et devient l'écran suivant).
- **Carte vers plein écran** (`features/hero`) : la carte mesurée à l'écran s'agrandit jusqu'à la page, sa photo devient l'en-tête, son titre devient le titre de page. Fermeture par glissement vers le bas ou bouton.
- **Changement de destination** : un portail circulaire s'ouvre depuis le sélecteur sur la photo de la nouvelle ville, le logo orbite pendant que l'app change de ville, puis la lumière se lève.
- **Barre d'onglets** : indicateur qui glisse en ressort `snappy`, icône qui « pop », haptique de sélection.
- **En-tête d'accueil** : blanc sur la photo de couverture, il passe en fondu aux couleurs du thème quand la couverture sort de l'écran.

### Haptique (`haptic(kind)`)

| Type | iOS / Android |
| --- | --- |
| `select` | Sélection (onglets, chips) |
| `tap` | Impact léger |
| `press` | Impact moyen (actions principales) |
| `heavy` | Impact fort |
| `success` / `warning` / `error` | Notifications système |

Sur le web : API Vibration (Android) et interrupteur natif caché (iOS 18 et plus), uniquement pendant un geste de l'utilisateur. Désactivable dans les réglages.

## Composants

| Famille | Composants | Fichier |
| --- | --- | --- |
| Base | `Text`, `Icon` (Lucide), `Button` (primary, secondary, ghost, glass, inverse, done), `IconButton`, `Chip`, `Badge` (verified, pick, soon, live...), `LiveDot`, `Segmented`, `Field`, `Divider` | `components/ui` |
| Surfaces | `Glass`, `Sheet` (glisser pour fermer), `Toast` | `components/ui` |
| Membres | `Avatar` (monogramme, en ligne, vérifié), `AvatarStack`, `PersonCard` (raisons du match), `ConnectButton` | `components/ui`, `components/cards` |
| Contenu | `EventCard`, `EventRow`, `SessionCard`, `ActivityTile`, `PlaceCard`, `CommunityCard`, `ServiceCard`, `EditorialCard`, `GuideCard`, `PlanCard`, `NearbyRow`, `MeetCard`, `ServicesGrid`, `Rail` | `components/cards` |
| Navigation | `TabBar`, `HomeHeader`, `PageHeader`, `DestinationPill` | `components/navigation` |
| Mise en page | `AppFrame` (colonne téléphone sur tablette et ordinateur), `Page` | `components/layout` |
| Visuel | `Photo`, `Cover` | `components/visual` |
| Marque | `IrlyMark`, `IrlyLogo`, `IrlyWordmark` | `brand` |

## Accessibilité

- Toutes les commandes ont un libellé (`accessibilityLabel`) et un rôle.
- Le réglage système « Réduire les animations » est respecté partout.
- Contraste : texte principal sur fond au-dessus de 15:1 la nuit ; les accents de destination ont une version jour plus foncée pour rester lisibles sur fond clair.
- Boutons ronds de 40 px, zone tactile élargie (`hitSlop`) sur les petites cibles.

## Ajouter une destination

1. Ajouter la lumière dans `src/theme/lights.ts` (4 tons + accents).
2. Ajouter la photo dans `src/data/photos.ts`.
3. Déclarer la destination et ses villes (quartiers, devise, sections de la Home, activités, catégories de services) dans `src/data/destinations.ts`.
4. Créer son contenu dans `src/data/content/` et l'enregistrer dans `src/data/repo.ts`.
