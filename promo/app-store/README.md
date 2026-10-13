# Visuels App Store IRLY (iPhone)

Huit visuels pour la fiche App Store d'IRLY, en anglais, faits uniquement à partir d'écrans de l'application : un titre, un sous-titre et un iPhone qui affiche un vrai écran d'IRLY. Trois visuels (02, 04 et 08) ajoutent un agrandissement d'un élément du même écran : une carte, une ligne ou une rangée de profils.

En plus : deux images larges pour l'en-tête de la fiche et les résultats de recherche (iOS 27 et iPadOS 27), voir le point 9.

## 1. Fichiers

| Fichier | Titre | Sous-titre | Écran de l'app | Source |
|---|---|---|---|---|
| `01-autour-de-toi.png` | What if you weren’t alone anymore? | The friendships that change everything start somewhere. | Accueil, haut de page (« What's happening around you? », Live now) | Build démo |
| `02-match.png` | New people. Real connections. | Meet people who share what you love. | Match IRLY (« People to meet ») + carte de Layla agrandie | Production, données fictives |
| `03-activites.png` | Less scrolling. More living. | Find activities and enjoy them together. | Catégorie Sport, sessions planifiées par des membres | Production, données fictives |
| `04-communautes.png` | Your community is already out there. | Find people like you. | Communautés, onglet « For you » + ligne IRLY Newcomers agrandie | Production, données fictives |
| `05-communaute.png` | One hello can start it all. | Chat, connect and get to know each other. | Chat de la communauté IRLY Newcomers | Production, données fictives |
| `06-live-irl.png` | Real moments, right now. | See what people around you are up to. | Live IRL, fil des publications | Production, données fictives |
| `07-decouvrir.png` | New in town? | Turn your new city into a chance to meet people. | Découvrir, onglet People (catégories, « People for you ») | Build démo |
| `08-autour-de-toi-suite.png` | Your next connection starts here. | Join a community where you belong. | Accueil, suite de la page (Happening now, Create, People near you, Find your people) + rangée « People near you » agrandie | Build démo |

L'ordre 01 → 08 est l'ordre conseillé dans App Store Connect : les trois premiers visuels sont ceux qui s'affichent dans les résultats de recherche, sauf si une image « résultats de recherche » est fournie (point 9).

## 2. Dimensions et format

| Dossier | Taille | Catégorie Apple |
|---|---|---|
| `iphone-6.3/` | 1206 × 2622 px | iPhone with Dynamic Island (medium display) : iPhone 17 Pro, 16 Pro… |
| `iphone-6.9/` | 1320 × 2868 px | iPhone with Dynamic Island (large display) : iPhone 17 Pro Max, 16 Pro Max… |

- PNG, couleurs RGB, sans canal alpha ni transparence, portrait.
- Page Apple consultée le 11 octobre 2026 ([Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)) :
  - obligatoire : au moins une capture « iPhone with Dynamic Island (medium display) », donc le jeu `iphone-6.3/` ;
  - obligatoire aussi, sauf si un jeu « iPhone with Dynamic Island (large display) » est fourni : un jeu « iPhone with Face ID (large display) » en 1284 × 2778 px. Le jeu `iphone-6.9/` sert à ça : avec les deux jeux, il n'y a rien d'autre à fournir ;
  - de 1 à 10 captures par taille.
- `docs/APP-STORE.md` indique que le 6,9" est le seul obligatoire : ce n'est plus ce que dit la page Apple. Envoie les deux jeux.
- iPad : non requis, l'app ne tourne pas sur iPad (`"supportsTablet": false` dans `app.json`).
- À surveiller : la même page annonce qu'à partir d'avril 2027, les apps compilées avec le SDK iOS 27.1 ou plus récent devront aussi fournir des captures « iPhone Duo ». Rien à faire pour cette soumission.

## 3. Comment les écrans ont été produits

- **Captures réelles du code d'IRLY.** Le build web Expo exécute le même code React Native que l'app iOS. Il est affiché dans un iPhone de 440 × 956 points à l'échelle 3, avec les zones sûres d'un iPhone (barre d'état, barre d'accueil). L'heure, le réseau et la batterie sont dessinés par-dessus, comme sur un iPhone : 9:41 partout. L'Accueil et Découvrir sont capturés à 21 h 41, heure de Dubaï : l'Accueil affiche « Dubai · 21:41 », cohérent avec le 9:41 (du soir) de la barre d'état.
- **Mode clair ou sombre** : chaque écran est rendu avec le réglage d'apparence de l'app forcé (clair pour Match, Communautés et Live IRL, sombre pour les autres). Un rendu web peut différer de l'iPhone sur des détails (polices, flou, ombres) : compare chaque écran avec le build TestFlight avant d'envoyer, et remplace par une vraie capture iPhone celui qui diffère.
- **Positions de défilement** : choisies pour qu'aucun texte ne soit coupé par la barre du haut ou la barre d'onglets (voir `tools/capture.sh`). Seule exception : sur Sport, le bouton flottant « Create session » de l'app cache en partie la mention répétée « Planned by a member ».
- **Découvrir** : Layla y apparaît comme déjà en contact avec l'utilisatrice (bouton « Message », un état réel de l'app). Avec le bouton blanc « Connect », il se confondait avec le bouton MATCH IRLY de la barre d'onglets.
- **Version de l'app** : captures faites le 11 octobre 2026 sur le commit `af7406e`. D'après leur relecture, les commits suivants ne changent pas la mise en page de ces huit écrans (menu des messages, archivage, composeur Live, libellés qui rétrécissent au lieu d'être coupés).
- **Écrans de production** (Match, Sport, Communautés, chat, Live IRL) : le build de production est branché sur un faux serveur (`tools/mock.mjs`). Les membres, messages, activités et compteurs y sont inventés. Aucun vrai compte et aucun vrai message ne sont utilisés. Le faux serveur suit l'API de cette version : si une capture de production ne charge plus après une évolution du serveur, adapte `tools/mock.mjs`.
- **Accueil (2 captures) et Découvrir** : ils viennent du build de démonstration, avec le contenu d'exemple de l'app. Ce choix a été validé le 11 octobre 2026 (voir le point 4).
- **Retouches faites à la capture, sans modifier l'app :**
  - la pastille « Demo · nothing is saved » est masquée, car elle n'existe que dans la démo ;
  - les badges « Verified » et les pastilles « en ligne » des profils d'exemple sont désactivés, car IRLY n'a ni vérification d'identité ni présence en ligne ;
  - les photos hébergées sur Unsplash, injoignables pendant la capture, sont remplacées par une photo proche de la photothèque du projet (`public-photos/`). Sur le build TestFlight, l'Accueil affichera les photos Unsplash d'origine.

## 4. Ce que les visuels montrent vraiment

- **Présent dans l'app publiée et branché sur le serveur :** Match IRLY, communautés officielles, chat de communauté et chat d'activité, activités planifiées par les membres, Live IRL.
- **À traiter avant la mise en ligne :** sur l'Accueil et Découvrir, ces éléments n'affichent aujourd'hui que du contenu d'exemple :
  - Accueil (01 et 08) : « Live now » et le compteur « 6 people live right now », la carte « Happening now » (l'événement Founders' Table), « People near you » et ses pastilles de disponibilité ;
  - Découvrir (07) : « People for you », avec les mentions « Strong match » et « Good match ».

  Dans l'app publiée, ces éléments restent vides (ou absents, pour « Happening now ») tant qu'ils ne sont pas reliés au serveur, même avec de vrais membres. Les brancher sur les vraies données avant la sortie rend les visuels 01, 07 et 08 exacts. Sinon, un relecteur Apple qui compare la fiche à l'app peut invoquer la règle 2.3 (métadonnées exactes).
- **Chiffres affichés** (486 membres, « 9 going », « 12 going »…) : ce sont des exemples. Aucun titre ni sous-titre n'annonce de chiffre.

## 5. Photos de personnes

- Les visages viennent des portraits d'exemple du projet (`public-photos/faces/`, sources dans `public-photos/faces/CREDITS.md`) : photos Pixabay ou fournies par IRLY.
- Les photos d'activités viennent de la photothèque du projet : Pixabay, Pexels, CC0 ou IRLY, voir `public-photos/CREDITS.md` et `public-photos/DUBAI.md`.
- La licence Pixabay laisse à l'utilisateur la charge de vérifier l'accord des personnes photographiées (« It is your responsibility to check whether you require the consent of a third party »).
- Pour une publicité, il est plus sûr de remplacer ces visages par :
  - des portraits générés par IA (avec Higgsfield, environ 0,25 crédit par image) ;
  - ou des photos de membres, avec leur accord écrit.

## 6. Points relevés dans l'app pendant le travail

- **Chat** : dans les conversations serveur, un message long ne revient pas à la ligne. La bulle déborde de l'écran, car elle est placée dans une ligne flex sans `flexShrink` (`src/app/messages/[id].tsx`, autour de la ligne 285). Les messages des visuels ont été gardés courts. Correctif probable : `flexShrink: 1` sur la bulle. À vérifier sur le build TestFlight.
- **Accueil en production** : « People near you », « Activities near you » et « Events this week » s'affichent sans contenu en dessous, et « Happening now » n'apparaît pas (voir le point 4).
- **Live now (Accueil)** : la rangée ne lit pas le fil Live IRL du serveur (`useLives` dans `src/features/live/liveStore.ts`). En production, elle ne montre que les publications de l'utilisateur lui-même, alors que l'écran Live IRL affiche celles des autres membres.
- **Live IRL** : chaque publication montre l'initiale de l'auteur, pas sa photo de profil (`Avatar` sans photo dans `src/app/(tabs)/live.tsx`). Passer la photo rendrait le fil plus humain, sur l'app comme sur le visuel 06.
- **En-tête des chats de communauté** : les communautés officielles sont créées sans catégorie ni photo (`supabase/migrations/20261008003400_irly_official_communities.sql`). L'en-tête du chat retombe donc sur la photo « meeting » (salle de réunion, `src/features/server/covers.ts`), alors que la liste des communautés montre la photo du thème (la skyline pour IRLY Newcomers). Visible en petit sur le visuel 05.
- **Photo « girlDinner » de la photothèque** : elle vient de Flickr (« Latham Staples with friends », domaine public) et montre une personne réelle identifiée. Le domaine public couvre le droit d'auteur, pas le droit à l'image : les visuels ne l'utilisent plus (la carte Founders' Table des visuels 01 et 08 montre la photo « founders », fournie par IRLY), mais l'app l'affiche encore dans IRLY Girl (`src/features/girl/world.tsx`). À remplacer pour un usage commercial.
- **Contenu d'exemple de l'Accueil** : la carte Founders' Table affiche « Private dining room, DIFC · DIFC », le quartier apparaît deux fois (`src/data/content/dubai.ts`, le lieu contient déjà le quartier). Sans effet une fois l'Accueil branché sur les vraies données.

## 7. Importer dans App Store Connect

1. App Store Connect → Apps → IRLY → la version iOS en préparation.
2. Section « Previews and Screenshots » (Aperçus et captures d'écran) : choisis la langue de la fiche en haut à droite, la langue principale en premier.
3. Onglet iPhone, taille 6,3" (iPhone with Dynamic Island, medium display) : glisse les 8 fichiers de `iphone-6.3/`, de 01 à 08.
4. Taille 6,9" (iPhone with Dynamic Island, large display) : glisse les 8 fichiers de `iphone-6.9/`. Sans ce jeu, Apple exige un jeu 6,5" en 1284 × 2778 px.
5. Vérifie l'ordre (glisser-déposer pour le changer), puis enregistre.
6. Fiche française : les mêmes visuels anglais peuvent servir. Pour une fiche entièrement en français, il faut générer une version avec l'interface et les titres en français (voir le point 8).

## 8. Régénérer les visuels

Prérequis : `npm ci`, puis `npm install --no-save playwright@1` et `npx playwright install chromium` (ou `CHROMIUM_PATH=/chemin/vers/chrome`), et Python 3 avec Pillow.

```bash
promo/app-store/tools/build.sh                    # builds web démo et production dans dist/ (ignoré par git)
promo/app-store/tools/capture.sh                  # les 8 écrans dans tools/screens (1320 × 2868 px)
node promo/app-store/tools/compose.mjs            # les visuels dans iphone-6.9/ et iphone-6.3/
node promo/app-store/tools/compose-header.mjs     # les images larges dans en-tete/ (point 9)
```

- Pour modifier les titres, la mise en page ou les agrandissements, édite `tools/visuals.json`.
- Pour modifier les membres, messages, activités ou compteurs fictifs, édite `tools/mock.mjs`.
- Pour choisir une autre position de défilement, `DUMP=1 node shoot.mjs <dossier> 1 'nom=/route@attente~défilement|demo'` liste chaque ligne de texte et chaque photo visibles, avec leur position : aucun texte ne doit croiser la barre du haut ni la barre d'onglets.
- Pour une version française, ajoute `LANG_UI=fr` devant les commandes de `capture.sh` et traduis les titres de `visuals.json`.

## 9. En-tête de fiche et résultats de recherche (iOS 27)

Deux visuels de marque, un par emplacement. Ce ne sont pas des captures d'écran : App Store Connect refuse ces tailles dans « Previews and Screenshots », et les captures restent obligatoires. Ces emplacements sont facultatifs et s'affichent sur iOS 27 et iPadOS 27 ou plus récent.

| Fichier | Taille | Format | Emplacement |
|---|---|---|---|
| `en-tete/IRLY_Header_Asset.png` et `.jpg` | 3840 × 1646 px (21:9) | PNG ou JPEG, RGB, sRGB, sans transparence | En-tête de la fiche (Product Page Header) |
| `en-tete/IRLY_Search_Results_Header.png` et `.jpg` | 3840 × 2560 px (3:2) | PNG ou JPEG, RGB, sRGB, sans transparence | Résultats de recherche (Search Results) |

Les deux formats sont acceptés pour ces deux tailles : envoie le PNG (qualité maximale) ou le JPEG (plus léger), pas les deux.

- **Spécifications Apple** (page [Creative asset specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/creative-assets-specifications) consultée le 13 octobre 2026) :
  - en-tête : 21:9 en 3840 × 1646 px (JPEG ou PNG), ou 16:9 en 5244 × 2950 px (PNG seulement) ;
  - résultats de recherche : 3:2, de 1920 × 1280 à 3840 × 2560 px (JPEG ou PNG), ou 16:9 en 5244 × 2950 px (PNG seulement) ;
  - pas de canal alpha ni de transparence ; aucun poids maximal n'est indiqué pour ces emplacements.
- **Pourquoi 3840 × 1646 pour l'en-tête** : le 3840 × 2560 n'est pas accepté pour l'en-tête. Le 21:9 est le format natif de l'en-tête : l'image s'affiche telle quelle, alors qu'Apple recadre le 16:9 sans dire comment. Le 16:9 ne sert que si une seule image doit aller dans les deux emplacements (option « Use header asset in search results »), ce qui n'est pas le cas ici.
- **Contenu** :
  - en-tête : le logo IRLY, l'accroche « Real connections. Real life. », la photo du groupe d'amies dans le désert dans une carte arrondie, et un iPhone qui montre le vrai écran d'Accueil (capture du build démo, voir le point 4) ;
  - résultats de recherche : la même photo en plein cadre, le logo IRLY seul dans le ciel. Pas de petit texte : l'App Store affiche déjà le nom et le sous-titre de l'app à côté.
- **Photo** : `tools/photos/desert-friends.png`, fournie le 13 octobre 2026, 736 × 981 px. Quatre reflets d'objectif (deux points verts, deux dans le ciel) ont été retirés. Agrandie environ 2,7 fois dans l'en-tête et 5,2 fois dans la recherche, avec un grain fin : nette sur iPhone, un peu douce sur iPad. **Droits à vérifier** : 736 px est la largeur standard des images Pinterest ; sans l'accord du photographe, remplace-la avant publication. Avec l'original en grand format, il suffit de changer le fichier et de relancer le script.
- **Zones de sécurité** :
  - en-tête : logo et accroche à 380 px du bord gauche et à 330 px du haut ; l'iPhone sort volontairement par le bas ;
  - recherche : le logo est centré dans le tiers haut. Il reste visible même si la carte est recadrée en 16:9 au centre.
- **Texte et règles Apple** : pas de prix, d'URL, de badge Apple ni de logo d'une autre plateforme ; contenu compatible avec la classification 4+ demandée par Apple pour les visuels. Le logo fait environ 18 points de haut et l'accroche environ 14 points sur un iPhone ; le logo de la carte de recherche, environ 33 points. L'accroche de l'en-tête est en anglais : pour la fiche française, il faut une version française. Le visuel de recherche n'a pas de texte à traduire.
- **Importer** :
  1. App Store Connect → Apps → IRLY → Asset Library → « + » → « Upload Creative Assets » : choisis les deux fichiers, puis soumets-les à la revue. Ils peuvent être approuvés sans nouvelle version de l'app.
  2. Sur la fiche, choisis `IRLY_Header_Asset` pour l'en-tête (Product Page Header) et `IRLY_Search_Results_Header` pour les résultats de recherche (Search Results). Laisse « Use header asset in search results » désactivé.
  3. Vérifie le rendu dans l'aperçu (iPhone, iPad, orientations, mode sombre).
- **Régénérer** : `node promo/app-store/tools/compose-header.mjs`. La mise en page (photo, recadrage, grain, logo, accroche, iPhone) est dans `tools/headers.json` ; le script vérifie que le contenu important reste dans la zone de sécurité. Il écrit le PNG et sa copie JPEG, en RGB avec un profil sRGB.
