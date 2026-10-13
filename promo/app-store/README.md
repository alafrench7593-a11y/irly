# Visuels App Store IRLY (iPhone)

Dix visuels pour la fiche App Store d'IRLY, en anglais, faits uniquement à partir de vrais écrans de l'application, version de `main` du 13 octobre 2026 (commit `522eede`), remplis de profils et de contenus d'exemple. Chaque visuel a un titre, un sous-titre, l'écran de l'app seul (sans iPhone dessiné) et, en bas, la mention « Example profiles and content ». Trois visuels (01, 02 et 03) ajoutent un agrandissement d'un élément du même écran.

En plus : deux images larges pour l'en-tête de la fiche et les résultats de recherche (iOS 27 et iPadOS 27), voir le point 9.

## 1. Fichiers

| Fichier | Titre | Sous-titre | Écran de l'app | Mode |
|---|---|---|---|---|
| `01-amis.png` | Make friends in Dubai. | People near you who love what you love. | Match IRLY (« People to meet ») + carte de Layla agrandie | Clair |
| `02-activites.png` | Do things together. | Sunset swims, sunrise paddles, desert drives. | Catégorie « Beach & outdoor » : trois sessions de membres + carte IRLY Beach agrandie | Sombre |
| `03-reseau.png` | Grow your network. | Founders and professionals around you. | Professionals (IRLY Network) + raison du « 86% match » agrandie | Clair |
| `04-irl.png` | Meet in real life. | Join a plan, meet up, become friends. | Page d'une session : « Beach volleyball at sunset » | Sombre |
| `05-communautes.png` | Find your communities. | Newcomers, runners, foodies: people like you. | Communautés, onglet « For you » | Clair |
| `06-live.png` | See who’s out right now. | A coffee by the marina? Join people nearby. | IRL, publications du moment | Sombre |
| `07-communaute.png` | Never arrive alone. | Get tips, share photos, join the next meetup. | IRLY Newcomers : annonce épinglée, publication avec photos | Clair |
| `08-profil.png` | Know who you’re meeting. | Verified profiles, interests and communities. | Profil de Nadia (profil vérifié, pas encore amie) | Sombre |
| `09-chat.png` | One hello is enough. | Chat with the community before you meet. | Chat de la communauté IRLY Newcomers | Clair |
| `10-messages.png` | Friends. Activities. Network. | In real life. That’s IRLY. | Messages : communauté, session, privé, groupe | Sombre |

L'ordre 01 → 10 suit la démo officielle (getirly.com/demo/story) : « Make friends », « Do things together », « Grow your network », « Meet in real life », puis les communautés, et la fin de la démo, « Friends. Activities. Network. In real life. That's IRLY. ». Les trois premiers visuels sont les plus vus sur la fiche : ils couvrent les trois piliers (amis, activités, réseau).

## 2. Dimensions et format

| Dossier | Taille | Emplacement Apple |
|---|---|---|
| `iphone-6.3/` | 1206 × 2622 px | iPhone with Dynamic Island (medium display) : iPhone 18 Pro, 17 Pro, 17, 16 Pro, 16, 15 Pro, 15, 14 Pro |
| `iphone-6.9/` | 1320 × 2868 px | iPhone with Dynamic Island (large display) : iPhone Air, 18 Pro Max, 17 Pro Max, 16 Pro Max, 16 Plus… |

- PNG, RGB 8 bits, profil sRGB, sans canal alpha ni transparence, portrait. Vérifié sur les 20 fichiers (dimensions, mode, profil, alpha).
- Page Apple consultée le 13 octobre 2026 ([Screenshot specifications](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)) :
  - 1179 × 2556 et 1206 × 2622 px (et leurs versions paysage) vont dans le **même** emplacement « medium display », qui couvre les iPhone de 6,1" (14 Pro, 15, 15 Pro, 16) et de 6,3" (16 Pro, 17, 17 Pro). On n'y envoie qu'un jeu : 1206 × 2622, la plus grande taille ; Apple réduit pour les autres modèles ;
  - cet emplacement est obligatoire ;
  - obligatoire aussi, sauf si un jeu « large display » est fourni : un jeu « iPhone with Face ID (large display) » en 1284 × 2778 px. Le jeu `iphone-6.9/` sert à ça : avec les deux jeux, il n'y a rien d'autre à fournir ;
  - de 1 à 10 captures par taille.
- `docs/APP-STORE.md` indique que le 6,9" est le seul obligatoire : ce n'est plus ce que dit la page Apple. Envoie les deux jeux.
- iPad : non requis, l'app ne tourne pas sur iPad (`"supportsTablet": false` dans `app.json`).
- À surveiller : la même page annonce qu'à partir d'avril 2027, les apps compilées avec le SDK iOS 27.1 ou plus récent devront aussi fournir des captures « iPhone Duo ». Rien à faire pour cette soumission.

## 3. Comment les écrans ont été produits

- **Captures réelles du code d'IRLY, version de `main`.** Le build web Expo de production exécute le même code React Native que l'app iOS. Il est affiché à 440 × 956 points à l'échelle 3, avec les zones sûres d'un iPhone. Les dix écrans viennent du build de **production** branché sur un faux serveur (`tools/mock.mjs`) : seules des fonctions reliées au serveur apparaissent. Le build de démonstration n'est plus utilisé.
- **Écran sans iPhone** : les règles marketing d'Apple demandent de ne pas dessiner d'appareil Apple ([Marketing Resources and Identity Guidelines](https://developer.apple.com/app-store/marketing/guidelines/)). L'écran est montré seul, coins arrondis, avec la barre d'état d'iOS (9:41, réseau, Wi-Fi et batterie pleins) et la barre d'accueil, sans Dynamic Island. Même style que l'image des résultats de recherche.
- **Mode clair ou sombre** : le réglage d'apparence de l'app est forcé, en alternance d'un visuel à l'autre. Un rendu web peut différer de l'iPhone sur des détails (polices, flou, ombres) : compare chaque écran avec le build TestFlight avant d'envoyer.
- **Positions de défilement** : choisies pour qu'aucune ligne de texte ne soit coupée par une barre ou par le bord de l'écran (voir `tools/capture.sh`). Seule exception : sur 06, le nom de l'auteur de la publication suivante passe sous la barre d'onglets translucide, comme sur un iPhone.
- **Agrandissement de 02** : le bouton flottant « Create session » de l'app recouvre la carte placée sous lui. La carte IRLY Beach agrandie le masque ; elle est découpée dans une deuxième capture du même écran, défilé de 100 points, où le bouton ne la recouvre pas.
- **Aucune retouche de l'app** : les photos de la photothèque et leurs variantes HD sont servies depuis `public-photos/`, comme sur le site. Contrôle fait sur les dix écrans : aucune photo Unsplash, aucune photo manquante, aucun appel au serveur sans réponse, aucune erreur de page (`LOG_UNSPLASH=1 NOTES=60` affiche ces lignes pendant la capture).

## 4. Ce que les visuels montrent vraiment

- **Toutes les fonctions visibles existent dans `main` et passent par le serveur** : Match IRLY (réservé aux membres vérifiés : 3 photos et un selfie contrôlés par IRLY), IRLY Network (profils professionnels et pourcentage de compatibilité calculé par l'app), sessions créées par des membres et leur page, IRL, communautés officielles (annonce épinglée, publications avec photos, sondage, activités de la communauté), chat de communauté, profil d'un membre (badge vérifié, suivre, ajouter en ami), Messages.
- **Pas de fonction inventée.** L'Accueil et Découvrir ne sont plus montrés : sur `main`, leurs rubriques d'exemple (Live now, Happening now, People near you, People for you) n'affichent toujours que du contenu de démonstration, que l'app retire en production (`src/data/repo.ts`, « never shown as if they were real »).
- **Données d'exemple** : chaque personne, message, session, publication et compteur vient de `tools/mock.mjs`. La mention « Example profiles and content » en bas de chaque visuel le dit. Aucun titre ni sous-titre n'annonce de chiffre, de nombre de membres ou de récompense.
- **Cohérence d'un visuel à l'autre** : 9:41 partout, mêmes personnes et mêmes photos de profil, dates de la semaine du 13 octobre 2026, aperçus de Messages identiques aux derniers messages des chats. Chaque photo de contenu n'apparaît qu'une fois (la photo du brunch ne reste que comme vignette de la communauté IRLY Food, choisie par l'app).
- **Classification 4+** demandée par Apple : ni alcool, ni prix (seulement « Free »), ni URL, ni logo de marque, ni photo suggestive. Les emojis 🥂 et les « drinks » des exemples ont été remplacés.

## 5. Photos de personnes

- Les visages viennent des portraits d'exemple du projet (`public-photos/faces/`, sources dans `public-photos/faces/CREDITS.md`) : photos Pixabay ou fournies par IRLY.
- Les photos de contenu viennent de la photothèque du projet (Pixabay, Pexels, CC0 ou IRLY, voir `public-photos/CREDITS.md` et `public-photos/DUBAI.md`) : `dunes` (02), `volleyball` (04), `coffeeBar` (06), `concert` (07), `founders` (08), `djSunset` (09), `frenchFood` (10).
- La licence Pixabay laisse à l'utilisateur la charge de vérifier l'accord des personnes photographiées (« It is your responsibility to check whether you require the consent of a third party »).
- Pour une publicité, il est plus sûr de remplacer ces visages par des portraits générés par IA ou par des photos de membres, avec leur accord écrit.

## 6. Points relevés dans l'app pendant le travail

- **Accueil en production** : « People near you » s'affiche avec un carrousel vide, et « Activities near you » et « Events this week » sans contenu ; « Happening now » n'apparaît pas. Ces rubriques lisent le contenu d'exemple, retiré en production (`src/app/(tabs)/index.tsx`).
- **Live now (Accueil)** : la rangée ne lit toujours pas le fil IRL du serveur (`useLives` dans `src/features/live/liveStore.ts` : mes publications et celles de la démo). En production, elle ne montre que les publications de l'utilisateur.
- **Ponctuation des communautés** : la description se termine par un point et l'app ajoute « · 312 members » : « race days. · 312 members » (liste des communautés, page d'une catégorie). Retirer le point final des descriptions officielles, ou ne pas l'ajouter avant « · ».
- **Bouton flottant des catégories** : « Create session » est toujours posé sur la dernière carte visible (02). Une marge basse égale à la hauteur du bouton éviterait de cacher du texte.
- **Profil d'un membre** : bouton retour en flèche, alors que les autres écrans utilisent un chevron.
- **Chat** (relevé sur `af7406e`, à revérifier) : un message long ne revenait pas à la ligne, la bulle n'avait pas de `flexShrink` (`src/app/messages/[id].tsx`).
- **Photo « girlDinner » de la photothèque** : elle vient de Flickr (« Latham Staples with friends », domaine public) et montre une personne réelle identifiée. Le domaine public couvre le droit d'auteur, pas le droit à l'image. L'app l'affiche encore dans IRLY Girl (`src/features/girl/world.tsx`). À remplacer pour un usage commercial.
- **Contenu d'exemple de l'Accueil** : la carte Founders' Table affiche « Private dining room, DIFC · DIFC » (`src/data/content/dubai.ts`).

## 7. Importer dans App Store Connect

1. App Store Connect → Apps → IRLY → la version iOS en préparation.
2. Section « Previews and Screenshots » (Aperçus et captures d'écran) : choisis la langue de la fiche en haut à droite, la langue principale en premier.
3. Onglet iPhone, emplacement « iPhone with Dynamic Island (medium display) » (6,3") : glisse les 10 fichiers de `iphone-6.3/`, de 01 à 10. Retire d'abord les 8 anciens visuels s'ils sont déjà en ligne.
4. Emplacement « large display » (6,9") : glisse les 10 fichiers de `iphone-6.9/`. Sans ce jeu, Apple exige un jeu 6,5" en 1284 × 2778 px.
5. Vérifie l'ordre (glisser-déposer pour le changer), puis enregistre.
6. Fiche française : les mêmes visuels anglais peuvent servir. Pour une fiche entièrement en français, il faut générer une version avec l'interface et les titres en français (voir le point 8).

## 8. Régénérer les visuels

Prérequis : `npm ci`, puis `npm install --no-save playwright@1` et `npx playwright install chromium` (ou `CHROMIUM_PATH=/chemin/vers/chrome`), et Python 3 avec Pillow. Les écrans viennent d'une copie de `main` :

```bash
git worktree add ../irly-main origin/main && (cd ../irly-main && npm ci)
promo/app-store/tools/build.sh ../irly-main                       # builds web démo et production dans ../irly-main/dist/
IRLY_REPO=../irly-main promo/app-store/tools/capture.sh            # les écrans dans tools/screens (1320 × 2868 px)
node promo/app-store/tools/compose.mjs                             # les visuels dans iphone-6.9/ et iphone-6.3/
node promo/app-store/tools/compose-header.mjs                      # les images larges dans en-tete/ (point 9)
```

- `IRLY_REPO` fait lire les builds, les photos et les vidéos de cette copie ; `HEADER_SCREENS=1` recapture aussi les trois écrans des images larges.
- Pour modifier les titres, la mise en page ou les agrandissements, édite `tools/visuals.json` (`"device": "none"` : écran sans iPhone ; `"note"` : la ligne du bas).
- Pour modifier les membres, messages, sessions, publications ou compteurs fictifs, édite `tools/mock.mjs`. Il suit l'API de `main` du 13 octobre 2026 : si une capture ne charge plus après une évolution du serveur, adapte-le (les appels qu'il ne connaît pas sont listés pendant la capture).
- Pour choisir une autre position de défilement, `DUMP=1 node shoot.mjs <dossier> 1 'nom=/route@attente~défilement'` liste chaque ligne de texte et chaque photo visibles, avec leur position.
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
  - résultats de recherche : le logo IRLY, la même accroche, puis trois vraies captures de l'app. Au centre, l'écran Match « People to meet » en mode clair ; sur les côtés, en mode sombre et un peu en retrait, l'Accueil (« What's happening around you? », build démo) et la catégorie « Beach & outdoor » avec ses sessions. Apple conseille pour cet emplacement de rendre l'usage de l'app évident et de montrer son interface.
- **Écrans sans iPhone dans la recherche** : les règles marketing d'Apple ([Marketing Resources and Identity Guidelines](https://developer.apple.com/app-store/marketing/guidelines/)) demandent d'utiliser les cadres officiels, sans les dessiner, les incliner, les recadrer ni leur ajouter d'ombre. La perspective et les ombres portent donc sur les écrans seuls, sans appareil ni Dynamic Island. La barre d'état reste complète (réseau, Wi-Fi et batterie pleins), comme Apple le demande.
- **Sessions « Beach & outdoor »** : trois sessions fictives ajoutées dans `tools/mock.mjs` (JBR Beach, Kite Beach, Al Qudra), comme celles de Sport. Sans elles, l'écran affiche « No beach & outdoor activity yet ». La sortie dans le désert est celle dont parle le post d'Omar sur Live.
- **Photo de l'en-tête** : `tools/photos/desert-friends.png`, fournie le 13 octobre 2026, 736 × 981 px. Quatre reflets d'objectif (deux points verts, deux dans le ciel) ont été retirés. Agrandie environ 2,7 fois, avec un grain fin : nette sur iPhone, un peu douce sur iPad. **Droits à vérifier** : 736 px est la largeur standard des images Pinterest ; sans l'accord du photographe, remplace-la avant publication. Avec l'original en grand format, il suffit de changer le fichier et de relancer le script. Le visuel de recherche n'utilise plus cette photo.
- **Zones de sécurité** :
  - en-tête : logo et accroche à 380 px du bord gauche et à 330 px du haut ; l'iPhone sort volontairement par le bas ;
  - recherche : logo, accroche et écrans dans une marge de 10 % (384 px sur les côtés, 256 px en haut), composition centrée comme Apple le recommande ; les écrans sortent volontairement par le bas.
- **Texte et règles Apple** : pas de prix, d'URL, de badge Apple ni de logo d'une autre plateforme ; contenu compatible avec la classification 4+ demandée par Apple pour les visuels. Dans l'en-tête, le logo fait environ 18 points de haut et l'accroche environ 14 points sur un iPhone. Dans la recherche (carte d'environ 361 points de large, estimation), le logo fait environ 24 points et l'accroche environ 13 points ; le titre « People to meet » reste lisible. Les deux accroches et les écrans sont en anglais : Apple demande de traduire le texte pour chaque langue de l'app, il faut donc une version française (accroche traduite, captures avec `LANG_UI=fr`).
- **Importer** :
  1. App Store Connect → Apps → IRLY → Asset Library → « + » → « Upload Creative Assets » : choisis les deux fichiers, puis soumets-les à la revue. Ils peuvent être approuvés sans nouvelle version de l'app.
  2. Sur la fiche, choisis `IRLY_Header_Asset` pour l'en-tête (Product Page Header) et `IRLY_Search_Results_Header` pour les résultats de recherche (Search Results). Laisse « Use header asset in search results » désactivé.
  3. Vérifie le rendu dans l'aperçu (iPhone, iPad, orientations, mode sombre).
- **Captures utilisées** : l'Accueil (build démo), Match et « Beach & outdoor » capturés sur `af7406e` (point 8, `HEADER_SCREENS=1`).
- **Régénérer** : `node promo/app-store/tools/compose-header.mjs`. La mise en page (photo, recadrage, grain, logo, accroche, iPhone, écrans et perspective) est dans `tools/headers.json` ; le script vérifie que le contenu important reste dans la zone de sécurité. Il écrit le PNG et sa copie JPEG, en RGB avec un profil sRGB.
