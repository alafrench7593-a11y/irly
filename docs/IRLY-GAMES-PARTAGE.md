# IRLY Games : accueil, partage des parties, invitations

État au 10 novembre 2026.

## Parcours

IRLY (accueil) → carte « IRLY Games » → page IRLY Games (`/games`) → Loup-Garou (`/games/werewolf`) → mode → partie.

- La carte de l'accueil a les mesures de la tuile d'activité de la grille de l'accueil (même largeur, photo au
  même rapport, mêmes coins et marges). Elle ouvre IRLY Games, jamais une partie.
- `/games` liste les jeux jouables (`src/features/games/catalog.ts`). Ajouter un jeu = ajouter une entrée. Aucun
  jeu « bientôt disponible » n'est affiché. Le Ludo reste mis de côté (ses tables s'ouvrent toujours par lien).
- Menu Loup-Garou : jouer en ligne, contre l'IA, rejoindre une partie (tables ouvertes), créer une table, rejoindre
  avec un code, découvrir les modes, personnages, règles.

## Partager une partie

Une partie partagée est UNE publication de communauté qui porte le salon (`community_posts.game_room_id`),
comme une publication porte une activité. Cochée « Live », la même publication apparaît aussi sur le Live de
l'univers de la communauté pendant 24 heures (mécanisme existant). Il n'y a jamais de copie, ni de second salon.

- La publication est insérée au nom du membre : toutes les règles existantes des publications s'appliquent
  (appartenance à la communauté, communautés restreintes, limite de fréquence, isolement IRLY Girl, sanctions).
- En plus : seul l'hôte partage ; seulement tant que la partie attend des joueurs ; jamais une partie contre l'IA ;
  une partie IRLY Girl ne se partage que dans une communauté IRLY Girl, une partie mixte que dans une communauté
  mixte.
- Une publication par partie et par communauté. Demander le Live après coup republie la publication, marquée Live,
  à la place de la première.
- La carte affichée est lue dans le salon au moment de l'affichage, puis toutes les 8 secondes tant que la partie
  bouge : joueurs, places restantes, texte ou vocal, statut (en attente, complète, en cours, terminée, annulée).
- « Rejoindre » entre dans ce salon précis, par la fonction d'entrée unique de tous les jeux : espace IRLY Girl,
  blocages, joueur exclu par l'hôte, partie commencée, table complète. Le salon est verrouillé pendant l'entrée :
  deux demandes simultanées pour la dernière place donnent une place et un refus.
- Partie privée : le partage par l'hôte vaut code, uniquement pour ceux qui peuvent lire la publication. L'identifiant
  seul du salon ne suffit pas (« cette partie est privée : demande son code »).

## Invitations

- Lien : partie privée → lien avec son code ; partie publique → lien vers sa table, où un bouton « Rejoindre la
  partie » passe par le serveur.
- Il n'existe pas d'invitation nominative d'un ami (notification à une personne choisie) : non fait.

## Vérifié

- `supabase/tests/werewolf_share.test.sql` : 26 contrôles.
- Deux sessions simultanées sur la dernière place (base locale) : une acceptée, l'autre refusée, 6 joueurs sur 6 sièges.
- Navigateur (Chromium, tailles de téléphone), deux membres : carte d'accueil sur 4 largeurs, IRLY Games, menu,
  partage en communauté, partage sur le Live, rejoindre depuis la publication, mise à jour automatique du compteur.
  Dans cet environnement local, la liste « mes communautés » a été fournie au navigateur par le script de test
  (le serveur local ne sait pas répondre à cette requête) ; tout le reste passe par la vraie base locale.

## Non vérifié

- Claviers sur de vrais téléphones : les corrections (le champ du chat garde le clavier après l'envoi, la barre
  d'actions s'efface pendant la saisie, Android remonte l'écran, le champ du code suit le clavier sur iOS) sont
  faites dans le code et n'ont pas pu être essayées sur un appareil.
