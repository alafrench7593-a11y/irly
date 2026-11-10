# IRLY Loup-Garou — règles appliquées par le moteur

Source : « Livre officiel des règles V3 » (propriétaire, 2026-11-10) + décisions
du propriétaire du 2026-11-10. Ce document dit ce que le serveur fait
réellement (`supabase/migrations/2026111200*_irly_werewolf*.sql`). Une règle
absente d'ici n'est pas jouée.

Légende : **[V3]** règle du livre V3 · **[Décision]** choix du propriétaire ·
**[Défaut]** point non tranché par la V3, choisi pour pouvoir jouer, à valider.

## Étape A (ce qui est jouable)

- Mode **Classique** seulement. Chaos, Nightmare, Manipulation et fusions :
  étape B (cartes et événements activés seulement une fois définis et testés, V3 §9).
- Parties **en ligne non classées**, **entraînement contre l'IA** (toujours
  non classé), **mode IRL** (présentiel, QR code, sans maître du jeu).
- Classement, saisons, badges, encyclopédie : étape C. Animations, audio : étape D.

## Composition

| Joueurs | Loups | Cartes par défaut (en plus des Loups) |
|---|---|---|
| 6 | 1 | Voyante, Sorcière, 3 Villageois |
| 7 | 1 | + Chasseur |
| 8 | 2 | + Salvateur |
| 9 | 2 | + Cupidon |
| 10–11 | 2 | + Petite Fille (11 : + Ancien) |
| 12–14 | 3 | Voyante, Sorcière, Chasseur, Salvateur, Cupidon, Petite Fille, Ancien (13+ : + Voleur) |
| 15–19 | 4 | idem |
| 20 | 5 | idem |

Le reste des places : Villageois.

- **[V3]** table des Loups (6→1, 8→2, 10→2, 12→3, 15→4, 20→5) ; tailles
  intermédiaires **[Défaut]** : le palier inférieur. 6 à 20 joueurs.
- **[Décision]** l'hôte peut modifier la composition ; le serveur refuse toute
  composition invalide : au moins 1 Loup, Loups < moitié des joueurs, au plus
  1 exemplaire de chaque rôle spécial, le reste en Villageois, et le Village
  présent après distribution.
- **Voleur** : la partie a alors `joueurs + 2` cartes ; les 2 cartes non
  distribuées sont proposées au Voleur (V3). Distribution refaite tant qu'au
  moins un Loup n'est pas distribué.

## Déroulement

`Lobby → [Nuit → Sorcière] → Jour (discussion) → Vote (→ second tour) → Nuit …`

Durées : en ligne nuit 45 s, Sorcière 25 s, jour 150 s, vote 60 s, second
tour 45 s · IRL nuit 60 s, Sorcière 30 s, jour 300 s (l'hôte peut passer au
vote) · entraînement nuit 40 s, jour jusqu'à « Prêt à voter » (90 s max).
**[Défaut]** Une phase se termine plus tôt quand tous les joueurs attendus ont agi.

### Nuit (ordre V3 §3, cartes Classique)

1. **Ouverture** : rien de différé en Classique.
2. **Échanges (phase 3)** : Voleur, nuit 1 seulement. **[Décision]** choix
   toujours libre : une des deux cartes, ou garder la carte Voleur (devient
   Villageois sans pouvoir). Sa nouvelle carte agit à partir de la nuit
   suivante ; s'il prend un Loup, il rejoint la meute la nuit suivante (V3 §4).
3. **Protections (phase 4)** : Salvateur protège un joueur, **[Décision]** pas
   lui-même, **[V3]** pas la même cible deux nuits de suite.
   **[Défaut]** sa protection annule toutes les attaques de la nuit sur ce
   joueur (Loups, potion, conséquence du tir du Chasseur).
4. **Investigations (phase 5)** : Voyante, le rôle exact d'un joueur, après les
   échanges. **Petite Fille [Décision]** : une fois par partie, la nuit de son
   choix, le serveur lui montre 3 joueurs vivants (hors elle) dont au moins un Loup.
5. **Loups (phase 6)** : chaque Loup de la meute vote ; la victime est la plus
   votée ; égalité → tirage serveur déterministe. **[Défaut]** aucun vote →
   aucune attaque. Les Loups ne peuvent pas viser un Loup.
6. **Cupidon** (nuit 1) : lie deux joueurs vivants (il peut se choisir).
   Les amoureux apprennent le nom l'un de l'autre au matin (pas le rôle **[Défaut]**).
7. **Sorcière (phase 7)** : si sa potion de vie reste, elle voit la victime des
   Loups. Une seule potion par nuit. **[Décision]** ne peut pas se soigner
   elle-même ; **[Défaut]** ne peut pas s'empoisonner. La guérison n'annule que
   l'attaque des Loups.
8. **Chasseur IRLY (phase 8, V3 §5)** : un seul tir, choisi la nuit. Cible Loup
   (camp après conversions) → attaque mortelle sur la cible ; sinon attaque
   mortelle sur le Chasseur, la cible survit. Tir consommé dans les deux cas,
   jamais annulable par la Sorcière, protégeable par le Salvateur. Un tir
   validé reste actif si le Chasseur meurt la même nuit.
9. **Résolution (phase 9)** : immunités (Ancien : résiste à la première attaque
   des Loups, sa résistance est consommée même s'il était protégé — ordre V3 :
   immunités avant protections), protections, morts simultanées, puis chaîne
   des amoureux (une fois par joueur, sans boucle).
10. **Victoires (phase 12)** puis **annonce du matin** : noms des morts, jamais
    leur rôle (V3 §3 phase 13).

### Vote (V3 §10)

Chaque vivant a une voix. Le plus voté est éliminé. Égalité → second tour entre
les ex aequo ; nouvelle égalité → personne. **[Défaut]** pas de vote = abstention.
Les votes sont publics.

## Amoureux (V3 §6)

- Même camp : gardent leur victoire de camp ; si l'un meurt, l'autre meurt.
- Camps opposés : ne gagnent plus avec leur camp ; gagnent s'ils sont les deux
  derniers vivants (vérifié avant toute victoire collective).

## Victoires (V3 §10, §3 phase 12)

1. Amoureux de camps opposés seuls vivants → victoire des amoureux.
2. Plus aucun Loup vivant → victoire du Village (tout le camp Village, morts compris,
   hors amoureux de camps opposés).
3. Loups vivants ≥ autres vivants → victoire des Loups (même règle).
4. Tout le monde mort → égalité.

Rôles révélés à tous à la fin de la partie.

## Communication

- Jour : chat de la table (vivants). Nuit : chat des Loups (meute actuelle ;
  un nouveau Loup y entre la nuit suivante, un ancien Loup le perd tout de suite).
- Morts : chat des morts, jamais lu par les vivants.
- IRL : pas de chat (discussion autour de la table).

## Entraînement contre l'IA (V3 §11)

- Le joueur choisit son rôle, la taille (6–20), la difficulté. Toujours non classé.
- Les IA décident **uniquement** à partir de ce que leur personnage sait : leur
  carte, leurs résultats de pouvoirs, la meute si elles sont Loups, et les
  événements publics (morts, votes, messages). Elles reçoivent la même vue
  que l'app d'un joueur (`ww_view_for`), jamais l'état interne.
- Débutant : choix proches du hasard. Intermédiaire : suspicion tirée des votes
  et des morts. Expert : en plus, la Voyante annonce ses découvertes, les Loups
  accusent et se couvrent.
- Leur discussion : phrases préparées (FR/EN) choisies selon leur suspicion,
  jamais un rôle qu'elles ne connaissent pas. Pas de modèle de langage
  (coût nul).

## Sécurité

Le serveur est seul à connaître les cartes. Le téléphone ne reçoit que la vue
de son joueur. Toute action est une intention validée par le serveur.

## Tests (ce qui est vérifié, et comment)

- `supabase/tests/werewolf.test.sql` : chaque rôle et les cas V3 (Chasseur IRLY :
  tir réussi, raté, protégé, potion sans effet, tir validé avant de mourir ;
  Sorcière : une potion par nuit, ni soin ni poison sur elle-même ; Salvateur ;
  Ancien ; amoureux du même camp et de camps opposés ; Voleur qui prend un Loup
  ou garde sa carte ; Voyante après l'échange ; Petite Fille ; votes, second
  tour, égalité ; victoires ; secret des cartes et du chat de la meute ;
  entraînement jamais classé, ni compté, ni listé).
- Simulations : 135 parties entre IA (6 à 20 joueurs × 3 difficultés × 3),
  aucune bloquée. Résultat d'une exécution : Loups 80, Village 53, amoureux 2.
  L'avantage des Loups mesure surtout le niveau des IA villageoises (peu
  d'informations partagées) : l'équilibrage des compositions se fera sur des
  parties entre humains.
- `scripts/e2e-werewolf.mjs` (CI, en production, comptes de test, tables
  privées) : une partie d'entraînement complète, une table en ligne de six
  (cartes secrètes, meute, chat), une table en présentiel.

## Mode Chaos

Migration `20261114000000_irly_werewolf_chaos.sql`, tests `supabase/tests/werewolf_chaos.test.sql`.

- Mêmes cartes et mêmes règles que le mode Classique ; seul le deck change.
- Le serveur tire le deck au hasard au démarrage de chaque partie (`private.ww_chaos_composition`) :
  le nombre habituel de loups-garous ±1 (au moins 1, toujours moins de la moitié), de 1 à 7 cartes
  spéciales distinctes parmi Voyante, Sorcière, Chasseur, Salvateur, Cupidon, Petite Fille, Ancien,
  des villageois pour le reste. Jamais le Voleur (ses deux cartes en plus trahiraient le deck).
- Le deck reste secret pour tout le monde, hôte compris : ni le lobby, ni la vue de jeu, ni le journal
  ne le montrent avant la fin (`private.ww_hide_chaos`). Il est révélé avec toutes les cartes à la fin.
- Un hôte ne peut pas choisir un deck Chaos (refus « Chaos: the deck is drawn in secret »).
- « Jouer en ligne » est désormais par mode (`public.ww_quickplay(p_space, p_mode)`) : une table
  publique du même mode avec une place, sinon une nouvelle table de ce mode.
- Simulations IA (90 parties, 6 à 20 joueurs) : loups-garous 63, village 24, amoureux 3. Comme le
  Classique, le mode favorise les loups face à l'IA ; à mesurer en parties humaines.
