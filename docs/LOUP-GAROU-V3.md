# IRLY Loup-Garou — étape B du livre V3 : ce que le moteur joue

Source : « Livre officiel des règles V3 » (propriétaire). **La V2, à laquelle la V3 renvoie pour le détail
des cartes (« Conserver les cartes définies dans la V2 »), n'a pas été fournie** : la V3 donne une ligne par
carte pour 34 personnages et ne définit ni les decks des modes, ni les événements. Tout ce qui n'est pas
écrit dans la V3 est marqué **[Défaut]** ci-dessous : choisi pour que la carte soit jouable, à valider ou à
corriger par le propriétaire (un défaut se change dans une migration, sans toucher au reste).

Code : `supabase/migrations/20261116000000_irly_werewolf_v3_cards.sql` (cartes, modes, decks),
`…000100_irly_werewolf_v3_engine.sql` (options, nuit, vote, victoires), `…000200_irly_werewolf_v3_ai.sql` (IA).
Tests : `supabase/tests/werewolf_v3.test.sql`. Les modes Classique et Dubaï gardent leurs moteurs
(`docs/LOUP-GAROU.md`, `docs/LOUP-GAROU-DUBAI.md`).

## 1. Modes

| Mode | Cartes en plus des classiques |
|---|---|
| Classique | — |
| Chaos | famille Chaos (10) |
| Nightmare | famille Nightmare (10) |
| Manipulation | famille Manipulation (9) |
| Nightmare Chaos | Nightmare + Chaos + hybrides (5) |
| Manipulation Chaos | Manipulation + Chaos + hybrides |
| Nightmare Manipulation | Nightmare + Manipulation + hybrides |
| Apocalypse | les quatre familles : 34 cartes + classiques |
| Dubaï | ses 20 cartes (aucune carte V3) |

- **[Défaut M1]** La V3 ne dit pas quelles cartes joue chaque mode : chaque mode joue les cartes classiques
  (sans le Voleur) et sa ou ses familles ; les hybrides viennent avec les fusions et l'Apocalypse.
- **[Défaut M2]** Deck tiré par le serveur au lancement : le nombre habituel de loups (dont l'Agent double
  dès 8 joueurs et l'Usurpateur dès 12, là où le mode les joue), la Voyante, une carte au moins de chaque
  famille du mode, le reste tiré dans les familles (deux fois plus probable) et les spéciales classiques,
  un villageois au moins pour cinq joueurs. Solo : aucun sous 8 joueurs, un sous 12, deux ensuite.
  Le deck est public une fois la partie lancée.
- **[Défaut M3]** Aucun événement de mode n'est activé : la V3 §9 interdit d'en activer un sans définition
  complète, et n'en définit aucun. Les deux seuls effets globaux sont ceux de l'Anomalie (ci-dessous).
- **Correction** : les deux modes mis en ligne le 10 novembre sous les noms « Chaos » (deck classique
  aléatoire et secret) et « Cauchemar » (un loup de plus, pas de Voyante) n'étaient pas ceux du livre.
  Ces noms désignent désormais les modes du livre. « Tous pouvoirs » reste une variante du Classique.

## 2. Ordre d'une nuit (V3 §3), tel que joué

Tous choisissent en secret, puis le serveur résout :

0. **Ouverture** (avant que quiconque agisse) : retour des Revenants dus, frappe des marques du Faucheur
   dues, conséquences, victoires.
1. **Blocages** : Saboteur, puis Araignée, puis le blocage tiré par le Joueur de hasard. Un bloqueur bloqué
   ne bloque personne. Une action bloquée n'est pas jouée et **garde sa charge** ; le joueur bloqué est prévenu.
2. **Échanges** : Scameur (permanent), Échangeur et Caméléon (pour la nuit suivante), Cupidon.
3. **Protections** : Salvateur, Gardien, protection tirée par le Joueur de hasard.
4. **Falsifications puis enquêtes**, sur les cartes après échanges.
5. **Meute**, **Sorcière**, **actions hostiles** (tirs, morsure, marque), l'**Exorciste** juste avant les attaques.
6. **Attaques**, dans l'ordre fixe meute → potion → Chasseur → Chasseur de primes ; pour chacune :
   renvoi (Miroir), immunité (Ancien), protection, conversion (Maudit) ; puis morts, effets de mort, amoureux.
7. Objectifs personnels, victoires collectives, matin.

## 3. Cartes

Camp Village sauf mention. « 1× » = une utilisation dans la partie ; les charges suivent la carte.

### Chaos
| Carte | Ce que le moteur fait | Défauts |
|---|---|---|
| Scameur | 1×, nuit : échange définitif de carte avec un joueur vivant (V3 §4). Camps immédiats ; charges et objectifs non accomplis suivent les cartes ; amoureux, mémoire et victoires acquises restent aux joueurs ; l'ancien loup sort de la meute aussitôt, le nouveau y entre la nuit suivante ; une carte ne s'échange qu'une fois par nuit (premier validé ; l'autre garde sa charge) ; les actions déjà soumises par les deux joueurs cette nuit sont annulées. | La progression d'un objectif (compteurs) repart de zéro à l'échange (V3 §7) ; un objectif déjà atteint ne se regagne pas par la carte. |
| Échangeur | 1×, nuit : deux joueurs échangent leurs pouvoirs **actifs** pour la nuit suivante (cartes et camps inchangés ; charges consommées sur la carte prêtée). | **[D]** Effet à la nuit suivante (un échange appliqué la nuit même annulerait les deux actions, V3 phase 3). **[D]** « Compatible » = carte à pouvoir nocturne individuel ; sinon rien ne se passe et la charge est gardée. |
| Joueur de hasard | 1×, nuit, une cible : le serveur tire protection, blocage ou enquête de rôle. | **[D]** Trois issues équiprobables. |
| Miroir | Passif, 1× : renvoie à son auteur une attaque individuelle (potion, Chasseur de primes, marque du Faucheur). Jamais le Chasseur (charge gardée), jamais l'attaque collective de la meute. | **[D]** Passif (pas de bouton). |
| Saboteur | 2×, nuit : bloque le pouvoir nocturne d'un joueur (pour un loup : son vote de meute). | — |
| Caméléon | 1×, nuit : copie le pouvoir actif d'un joueur, utilisable une fois la nuit suivante ; le propriétaire garde le sien ; aucun objectif copié. | **[D]** Effet à la nuit suivante ; « compatible » comme l'Échangeur. |
| Clown | **Solo**. Gagne quand il est réellement éliminé par vote (pas si l'Avocat annule). La partie continue. | — |
| Métamorphe | 2×, nuit : les enquêtes de la nuit voient sur lui le rôle (et le camp) d'un joueur qu'il choisit. | **[D]** Il choisit un joueur à imiter. |
| Anomalie | À son élimination (toute cause) : un événement la nuit suivante, annoncé à tous. | **[D]** Deux événements définis, tirés au sort : **Brouillard** (aucune enquête ne donne de résultat, aucune charge d'enquête consommée) ou **Couvre-feu** (la meute n'attaque pas). |
| Ninja | 2×, nuit : aucune enquête ne voit rien de lui cette nuit. | **[D]** Résultat « rien à voir ». |

### Nightmare
| Carte | Ce que le moteur fait | Défauts |
|---|---|---|
| Revenant | 1× : tué la nuit, il revient à l'ouverture de la nuit suivante (annoncé). Pas après un vote. | — |
| Maudit | La première attaque de la meute qui devrait le tuer le transforme en loup (il survit ; meute la nuit suivante). Protégé ou soigné : pas de transformation, la malédiction reste. | — |
| Exorciste | 2×, nuit : retire ce qui pèse sur un joueur. | **[D]** « Malédiction » = marque du Faucheur (même posée cette nuit), malédiction du Maudit, malédiction de l'Oracle noir, emprise du Vampire. |
| Possédé | **Solo**. Gagne quand sa cible est éliminée par vote. | **[D]** La cible est désignée par le serveur, connue de lui seul ; si elle meurt autrement, une nouvelle est désignée. |
| Faucheur | 1×, nuit : marque un joueur, qui subit une attaque individuelle à l'ouverture de la nuit suivante. | **[D]** Aucune protection de la nuit précédente ne s'applique ; le Miroir renvoie. |
| Araignée | 2×, nuit : bloque un pouvoir (après le Saboteur). | — |
| Vampire | **Solo**. Chaque nuit, mord un joueur ; jusqu'à deux serviteurs. Gagne, vivant, avec deux serviteurs vivants. | **[D]** « Compatible » = du camp Village, non protégé, vivant au matin ; le serviteur garde carte et pouvoirs, quitte le Village, et gagne avec le Vampire. |
| Fossoyeur | Chaque nuit : le rôle (vrai) d'un joueur éliminé. | — |
| Somnambule | Chaque nuit, visite un joueur : apprend si une attaque l'a visé (même arrêtée). | — |
| Oracle noir | 2×, nuit : le camp d'un joueur (Loups, Village, Solo). | **[D]** « Malédiction temporaire » = pas de vote au scrutin du lendemain de la seconde vision. |

### Manipulation
| Carte | Ce que le moteur fait | Défauts |
|---|---|---|
| Manipulateur | 1×, de jour : un joueur ne vote pas au scrutin du jour (un vote déjà émis est annulé ; il est prévenu). | — |
| Hacker | Chaque nuit : la cible a-t-elle utilisé un pouvoir nocturne (hors vote de meute) ? | — |
| Agent double | **Loups**. Dans la meute dès la première nuit. Apparaît Village aux enquêtes de camp ; le Chasseur le touche. | Les enquêtes de **rôle** (Voyante) voient sa carte : la V3 ne protège que le camp. |
| Corrompu | 1×, de jour : son vote compte double (secret). | — |
| Avocat | 1× : annule l'élimination par vote du joueur pour qui il plaide. | **[D]** Il plaide pour un joueur avant le dépouillement ; la charge n'est consommée que si ce joueur est éliminé. |
| Paparazzi | Chaque nuit, automatiquement : un joueur sur qui un pouvoir a été utilisé (ni lequel, ni par qui). | **[D]** Nature de « l'indice véridique ». |
| Usurpateur | **Loups**. 1×, nuit : les enquêtes sur un joueur sont inversées cette nuit. | **[D]** Portée d'une nuit, sur une cible. |
| Espion | 2×, nuit : la cible de l'action nocturne d'un joueur. | — |
| Dictateur | 1× : après un vote sans élimination, un nouveau scrutin le même jour. | **[D]** Il le décrète avant le dépouillement ; consommé seulement s'il sert. |

### Hybrides (Village + objectif personnel)
| Carte | Pouvoir | Objectif | Défauts |
|---|---|---|---|
| Chasseur de primes | 2 tirs, la nuit : un loup meurt. | 2 loups tués par ses tirs. | **[D H1]** Un tir sur un non-loup est perdu, sans retour sur lui (la V3 ne lui applique pas la règle du Chasseur). Attaque individuelle : le Miroir renvoie, une protection arrête. |
| Détective | Chaque nuit : loup ou non. | 2 loups différents identifiés. | **[D]** Un seul dans une partie distribuée avec un seul loup (« adaptation aux petites parties »). |
| Justicier | Son vote. | 2 loups éliminés par un vote auquel il a contribué. | **[D]** Même adaptation. |
| Prophète | Chaque nuit, prédit « loup » ou « pas loup ». | 3 prédictions justes. | **[D]** Il apprend si sa prédiction était juste (selon ce qu'une enquête de camp verrait). |
| Gardien | Chaque nuit, protège un joueur de toute attaque. | 2 attaques mortelles arrêtées. | **[D]** Pas de restriction de répétition ; pas sur lui-même. |

## 4. Victoires

- Collectives : inchangées (V3 phase 12). Un serviteur du Vampire n'est plus du Village.
- Personnelles (Clown, Possédé, Vampire et ses serviteurs, hybrides) : enregistrées aussitôt, **attachées au
  joueur**, conservées après une mort, un échange, une transformation ou la défaite du camp (V3 §7).
- Hybride dont le Village gagne et dont l'objectif est atteint : **double victoire**.

## 5. Interactions des modes fusionnés (testées)

| Situation | Résolution |
|---|---|
| Saboteur et Araignée la même nuit | Saboteur d'abord ; l'Araignée bloquée ne bloque pas et garde sa charge. |
| Scameur ↔ Vampire qui a déjà gagné | La victoire reste à l'ancien porteur ; le nouveau ne la reçoit pas par la carte. |
| Scameur ↔ Loup, puis vote de meute | Le vote de l'ancien loup est annulé la nuit même. |
| Chasseur sur un Maudit transformé la même nuit | Camp vérifié après conversion : touché. |
| Chasseur sur un Miroir | Non renvoyé ; le Miroir garde sa charge ; le Chasseur qui s'est trompé subit son tir. |
| Potion sur un Miroir | Renvoyée à la Sorcière. |
| Marque du Faucheur sur un Miroir | Renvoyée au Faucheur. |
| Exorciste et marque la même nuit | La marque est retirée ; la charge du Faucheur est consommée. |
| Gardien sur la cible de la meute et de la potion | Deux attaques arrêtées : objectif atteint. |
| Avocat et Clown | Élimination annulée : pas de victoire du Clown. |
| Métamorphe, Ninja, Usurpateur, Agent double face aux enquêtes | Ninja : rien ; Métamorphe : le rôle imité ; Usurpateur : inversé ; Agent double : Village pour le camp seulement. |
| Brouillard | Aucune enquête ne répond ; la meute attaque. |
| Couvre-feu | Pas d'attaque de la meute ; les enquêtes répondent. |
| Maudit amoureux qui se transforme | L'objectif des amoureux n'est pas recalculé (V3 §6). |

## 6. IA

Chaque IA joue depuis sa propre vue (V3 §11), avec une règle par pouvoir et un repli déterministe
(passer, ou « prêt » de jour) : aucune carte ne peut bloquer une partie. Les simulations vérifient que
chaque pouvoir est réellement utilisé par une IA et que chaque effet se produit.

## 7. Ce qui n'est pas fait

- Les événements de mode (V3 §9) : non définis par la V3, donc non activés.
- L'éditeur de deck de l'hôte pour ces modes (le serveur sait vérifier un deck envoyé ; l'écran ne le propose pas).
- Classement, encyclopédie détaillée (exemples, conseils), introductions cinématographiques, audio : étapes C et D.
- L'équilibrage : mesuré en simulation (ci-dessous), pas réglé.

## 8. Résultats mesurés

Voir la sortie de `supabase/tests/werewolf_v3.test.sql` : 315 parties entre IA (7 modes × 6 à 20 joueurs ×
3 difficultés), aucune bloquée ; environ deux tiers de victoires des loups dans chaque mode, comme en Classique.
