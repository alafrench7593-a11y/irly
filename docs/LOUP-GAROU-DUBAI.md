# IRLY Loup-Garou — mode Dubaï (9e mode) — spécification v0 (à valider)

Statut : **brouillon**. Rien n'est codé. Chaque point marqué **[À décider]** attend une
décision du propriétaire ; **[Proposé]** est la proposition par défaut si elle est validée.

Principe : le mode Dubaï est le mode Classique du livre V3 avec d'autres noms et
d'autres cartes. Les Escrocs fonctionnent exactement comme les Loups (canal secret,
vote de meute, tirage serveur en cas d'égalité, victoire par domination), les Expats
comme le Village. Les huit modes existants ne changent pas.

## 1. Factions (affichage uniquement, le moteur garde ses camps)

| Moteur (V3) | Affiché en mode Dubaï | Victoire affichée |
|---|---|---|
| Village | Expats | Victoire des Expats |
| Loups | Escrocs | Victoire des Escrocs |
| Solo | Indépendants | Victoire des Indépendants |
| Hybride | Double Jeu | Double victoire |
| Amoureux de camps opposés | Amoureux | Victoire des Amoureux |

**[À décider] D1** — L'Émirati est classé « Expats » alors qu'un Émirati n'est pas un expatrié.
[Proposé] nommer la faction « Résidents » (Expats reste le nom de la carte de base), ou garder
« Expats » et retirer l'Émirati de cette faction (impossible : il n'y a que 2 camps collectifs).

## 2. Les 20 cartes, traduites en mécaniques du moteur

Fenêtre = moment où le pouvoir se joue. « Attaque collective » = l'attaque de la meute des Escrocs.

| # | Carte | Camp | Pouvoir | Fenêtre | Équivalent / mécanique V3 |
|---|---|---|---|---|---|
| 1 | L'Expat | Expats | aucun | — | Villageois |
| 2 | L'Escroc | Escrocs | vote de meute | nuit, phase 6 | Loup-Garou |
| 3 | L'Influenceuse | Expats | Bad Buzz : 1×, un joueur désigné a un vote double au vote du jour | jour, avant clôture | vote renforcé (vote §4) appliqué à un tiers |
| 4 | L'Entrepreneur | Expats | Business Plan : 1×, protège un joueur de l'attaque collective | nuit, phase 4 | protection à usage unique, collective seulement |
| 5 | Le Millionnaire | Expats | Seconde Chance : survit 1× à l'attaque collective | passif, phase 9 | immunité à usage unique (type Ancien) |
| 6 | Le Célibataire | Expats | Coup de cœur : nuit 1, se lie à un joueur | nuit 1, phase 3 | Cupidon (lie lui-même + 1) ; règles amoureux V3 §6 |
| 7 | Le Charo | Indépendants | séduit 1 joueur vivant par nuit, jamais 2 fois le même | nuit, phase 8 | objectif Solo, victoire définitive V3 §7 |
| 8 | Le Résident Golden Visa | Expats | Résidence protégée : 1×, se protège de l'attaque collective | nuit, phase 4 | auto-protection à usage unique |
| 9 | L'Investisseur | Expats | Due Diligence : 1×, « est-il Escroc ? » | nuit, phase 5 | investigation de camp |
| 10 | Le CEO | Expats | Conseil d'administration : 1×, son vote compte double ce jour | jour, avant le vote | vote renforcé (Corrompu V3) |
| 11 | L'E-commerçant | Expats | Livraison express : 1×, protège un autre joueur | nuit, phase 4 | protection à usage unique, pas soi-même |
| 12 | Le Nouvel Arrivant | Expats | Nouveau départ : 1×, immunisé contre le vote du jour | jour, avant clôture | immunité de vote (vote §7) |
| 13 | L'Émirati | Expats | Connaissance du terrain : 1×, « est-il Escroc ? » | nuit, phase 5 | investigation de camp (identique à l'Investisseur, voir D9) |
| 14 | L'Agent immobilier | Escrocs | Fausse annonce : 1×, inverse les enquêtes de camp sur une cible cette nuit | nuit, phase 5 (falsification) | Usurpateur |
| 15 | Le Créateur de contenu | Expats | Story exclusive : 1×, « a-t-il agi cette nuit ? » | nuit, phase 5 | Hacker (1×) |
| 16 | Le Broker | Escrocs | Manipulation du marché : 1×, annule secrètement un vote | jour, au décompte | restriction de vote (vote §2) |
| 17 | Le Touriste | Expats | Court séjour : 1×, inciblable par l'attaque collective cette nuit | nuit, phase 4 | immunité nocturne |
| 18 | Le Concierge | Expats | Accès VIP : chaque nuit, « a-t-il reçu une visite ? » ; pas 2 nuits de suite le même | nuit, phase 5 (résultat après phase 9) | type Somnambule |
| 19 | Le Faux Millionnaire | Indépendants | Bluff : 1×, apparaît Expat aux enquêtes de camp ; gagne s'il est vivant à la fin | nuit, phase 5 | Solo de survie |
| 20 | Le Networker | Double Jeu | Carnet d'adresses : 1×, enquête de camp ; perso : avoir enquêté sur un Escroc et survivre | nuit, phase 5 | Hybride V3 (double victoire) |

## 3. Ordre de résolution (le moteur V3 ne change pas d'ordre)

- Nuit 1, phase 3 : Célibataire (lien).
- Phase 4, protections : Golden Visa (soi), Entrepreneur, E-commerçant ; Touriste (inciblable).
- Phase 5, investigations : Agent immobilier (falsification) appliqué **avant** l'envoi des
  résultats de l'Investisseur, de l'Émirati et du Networker ; Faux Millionnaire (Bluff) idem ;
  Créateur de contenu ; Concierge (son résultat dépend des visites, donc envoyé après la phase 9).
- Phase 6 : vote des Escrocs.
- Phase 8 : Charo (séduction).
- Phase 9 : immunité Millionnaire puis protections ; éliminations ; liens amoureux.
- Phase 11 : objectifs Indépendants et Double Jeu (Charo, Networker).
- Jour, vote : restrictions (Broker) → votes → renforcés (CEO, Influenceuse) → résultat →
  second tour si égalité → immunité (Nouvel Arrivant) → élimination.

## 4. Matrice d'interactions (par familles)

| Cas | Règle proposée |
|---|---|
| Plusieurs protections sur la même cible | une seule attaque collective par nuit : la première protection suffit ; **[Proposé]** les autres charges **ne sont pas consommées** (D4) |
| Protection + Millionnaire attaqué | V3 phase 9 : immunités avant protections. **[À décider] D5** : la Seconde Chance est-elle consommée s'il était aussi protégé ? [Proposé] non (la protection passe d'abord, contrairement à l'Ancien) |
| Touriste ciblé par les Escrocs | **[À décider] D6** : retirer le Touriste de la liste des cibles révèlerait aux Escrocs qu'il a joué. [Proposé] la cible reste possible, l'attaque échoue sans explication |
| Agent immobilier + Faux Millionnaire | enquêtes « est-il Escroc ? » : un Indépendant répond déjà « non ». **[À décider] D7** : le Bluff est inutile si l'enquête est binaire. [Proposé] les enquêtes de camp renvoient la faction (Expats / Escrocs / Indépendants), le Bluff renvoie « Expats » |
| Agent immobilier vise un Escroc enquêté | renvoie « pas Escroc » (inverse) ; le vrai camp ne change pas |
| Broker annule le vote d'un CEO ou d'un joueur Bad Buzz | **[Proposé]** l'annulation retire toute la voix, doublée comprise |
| Nouvel Arrivant immunisé et le plus voté | **[Proposé]** personne n'est éliminé ce jour (comme l'Avocat V3), pas de report sur le second |
| Influenceuse + CEO sur le même joueur | **[Proposé]** pas de cumul : une voix vaut au plus 2 |
| Célibataire + Escroc liés | amoureux de camps opposés, objectif V3 §6 |
| Charo séduit un joueur qui meurt la même nuit | ne compte pas (spécification) ; une séduction bloquée ne compte pas |
| Échanges (Scameur…) | aucune carte d'échange en mode Dubaï (D3) |

## 5. Points à décider

- **D1** nom de la faction (voir §1).
- **D2** publicité des pouvoirs de jour : la maquette annonce « L'Influenceuse a utilisé son
  pouvoir ! Le vote de Sara comptera double ». [Proposé] annoncer l'effet (« un vote compte double »)
  sans nommer la carte ; le CEO s'annonce lui-même (spécification).
- **D3** deck : uniquement les 20 cartes Dubaï, ou mélange avec les cartes classiques
  (Voyante, Sorcière…) ? [Proposé] Dubaï uniquement.
- **D4–D7** voir §4.
- **D8** Influenceuse : « vote d'élimination de cette journée » mais elle agit « pendant la
  journée » : si elle désigne pendant le second tour, compte-t-il ? [Proposé] oui, jusqu'à la clôture.
- **D9** Investisseur et Émirati ont exactement le même pouvoir. [Proposé] garder les deux mais
  jamais ensemble dans une composition sous 12 joueurs, ou différencier l'Émirati (ex. : apprend
  si une **paire** de joueurs compte au moins un Escroc).
- **D10** Concierge : définition de « visite » = toute action nocturne ciblée par un autre joueur
  (attaque collective comprise, enquêtes et protections comprises). [Proposé] oui.
- **D11** Charo : 3 séductions réussies avec les 3 cibles **vivantes au moment de la 3e** ;
  peut-il séduire un Escroc ? [Proposé] oui, tout joueur vivant.
- **D12** Faux Millionnaire : « vivant à la fin » d'une partie gagnée par n'importe quel camp,
  y compris égalité ? [Proposé] oui sauf égalité (tous morts).
- **D13** Networker : objectif rempli si l'enquête a visé un Escroc **même falsifiée** par
  l'Agent immobilier ? [Proposé] l'objectif regarde le vrai camp, pas le résultat reçu.

## 6. Compositions proposées (à valider par simulations)

Escrocs comme les Loups (`ww_wolves_for`) : 1 (6–7), 2 (8–11), 3 (12–14), 4 (15–19), 5 (20).
Au plus **2 protections** sous 15 joueurs, 3 au-delà (Golden Visa et E-commerçant ne sont
donc jamais tous présents) ; au plus **2 enquêtes de camp** sous 15 joueurs, 3 au-delà.
Le CEO et l'Influenceuse ensemble seulement à partir de 15 joueurs.

| Joueurs | Escrocs | Expats à pouvoir | Indépendant / Double Jeu | Expats simples |
|---|---|---|---|---|
| 6 | Escroc ×1 | Investisseur, Entrepreneur, Influenceuse | — | 2 |
| 8 | Escroc ×2 | Investisseur, Golden Visa, CEO, Concierge | — | 2 |
| 10 | Escroc ×1, Agent immobilier | Investisseur, E-commerçant, Millionnaire, Célibataire, Influenceuse | Charo | 2 |
| 12 | Escroc ×2, Broker | Investisseur, Entrepreneur, Golden Visa, Concierge, CEO, Créateur | Faux Millionnaire | 2 |
| 15 | Escroc ×3, Agent immobilier | Investisseur, Émirati, Entrepreneur, Millionnaire, Touriste, Célibataire, Influenceuse, Nouvel Arrivant | Charo, Networker | 1 |
| 20 | Escroc ×3, Agent immobilier, Broker | Investisseur, Émirati, Entrepreneur, Millionnaire, Touriste, Célibataire, Influenceuse, CEO, Nouvel Arrivant, Concierge, Créateur | Charo, Faux Millionnaire, Networker | 1 |

Ces grilles sont des hypothèses : elles seront ajustées après des simulations IA (comme les
135 parties du mode Classique) jusqu'à un taux de victoire Escrocs entre 40 et 55 %.

## 7. Ce que les maquettes montrent mais qui n'existe pas (pas de faux boutons)

Pièces (2 840), Boutique, niveaux (« Niv. 42 »), XP, coffres et badges de récompense,
« Coffre Prestige » : ces éléments demandent une économie, et les coffres à contenu aléatoire
sont encadrés par l'App Store (probabilités affichées). Ils ne seront pas affichés tant
qu'ils ne sont pas spécifiés. Dans les écrans de victoire, la colonne Récompenses est remplacée
par le classement réel (points du classement Loup-Garou).

Textes des maquettes corrigés selon les règles : le Concierge apparaît parmi les Escrocs
dans l'écran « Victoire des Escrocs » alors qu'il est Expat ; la collection affiche
« Escrocs (1) » alors que la spécification compte 3 cartes Escrocs (Escroc, Agent immobilier, Broker).
