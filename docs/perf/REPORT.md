# Performance et montée en charge — rapport du 14 novembre 2026

Trois sources, à ne pas confondre :

- **Production** : lecture seule de la base réelle (workflow « Database diagnostics », 21:50 et 23:10 UTC).
- **Banc local** : PostgreSQL 16 sur une machine 4 cœurs, 50 000 membres fictifs, 1 million de messages. Les durées valent comme rapports avant/après, pas comme prédictions de production.
- **Navigateur local** : l'app web sur la base locale, requêtes comptées pendant 60 secondes.

Rien n'a été mesuré sur iPhone. Aucun test de charge n'a été lancé sur la production. Aucun test à 1 000, 5 000 ou 10 000 utilisateurs simultanés n'a été exécuté : il n'existe pas d'environnement de staging.

## 1. Production : ce qui est constaté

| Mesure | Valeur |
|---|---|
| Comptes | 22, dont 12 connectés sur 7 jours |
| PostgreSQL | 17.11, 60 connexions maximum, 224 Mo de mémoire partagée |
| Connexions ouvertes | 7, toutes au repos |
| Taille de la base | 78 Mo, dont 48 Mo pour l'historique des tâches planifiées (279 000 lignes, jamais purgé) |
| Lectures servies depuis la mémoire | 100 % |
| Fichiers temporaires | 82 205, 238 Go cumulés depuis le 29 septembre |
| Interblocages | 4 depuis le 29 septembre |
| Offre Supabase | illisible avec le jeton disponible (refus 403) ; aucun supplément de puissance actif |

Où la base passe son temps depuis le 29 septembre :

| Requête | Appels | Part du temps |
|---|---|---|
| Enregistrement du jeton de notification | 1 175 326 | 27,3 % |
| Lecture des changements par le temps réel | 1 071 169 | 21,7 % |
| Liste des conversations | 82 301 (37,5 ms en moyenne, 7,4 s au pire) | 5,9 % |

Lecture : avec 22 comptes, la base n'est saturée ni en mémoire ni en connexions. Le premier poste est une boucle de l'app, pas une limite de Supabase. Plusieurs requêtes simples ont un pire cas de 5 à 7 secondes ; la cause n'est pas établie (processeur partagé d'une petite instance, ou attente de verrou).

Entre 21:50 et 23:10 UTC, le compteur d'enregistrement de jeton n'a pas bougé (1 175 326). Aucune app n'était ouverte sur cette période : cela ne prouve pas que la boucle a disparu des téléphones, qui tournent encore sur l'ancienne version.

## 2. Corrections de code faites (branche, non fusionnées)

| Correction | Mesure |
|---|---|
| Jeton de notification envoyé une fois par lancement au lieu d'une boucle | non mesurable hors téléphone ; vérifié par lecture du code et par les types |
| Salon d'attente du Loup-Garou : lectures périodiques stabilisées | 30 → 10 requêtes par minute (navigateur local) |
| Partie en cours | 67 → 47 requêtes par minute (navigateur local) |
| Marquage « lu » regroupé (2,5 s), relecture de la boîte de réception limitée (4 s) | vérifié par les types et les tests, non chronométré |
| Reconnexion étalée au hasard sur 3 secondes | vérifié par les types et les tests, non chronométré |
| Cartes de partie partagées : lecture seulement à l'écran, au premier plan | vérifié par les types et les tests, non chronométré |

Deux parcours complets rejoués dans le navigateur après correction : aucune anomalie.

## 3. Optimisations SQL préparées (non appliquées)

Trois fichiers dans `docs/perf/sql/`. Aucun n'est dans le dossier des migrations : rien ne part en production sans validation.

| Fichier | Contenu | Touche aux règles de sécurité |
|---|---|---|
| `01-indexes.sql` | 11 index | non |
| `02-helper-plans.sql` | 18 fonctions de contrôle gardent un plan en mémoire au lieu d'être recalculées à chaque ligne | non (mêmes expressions) |
| `03-policies.sql` | 8 règles de lecture ou d'écriture réécrites à résultat identique | oui |

Preuves d'équivalence : 290 empreintes des lignes visibles par 10 profils de membres (homme, femme, autre, bloqueur, bloqué, propriétaire de communauté, joueur), 0 différence. La suite de tests serveur passe à l'identique avec les trois fichiers appliqués (7 441 vérifications). Exception : la dernière règle de `03-policies.sql` (envoi de message) n'a été vérifiée que par raisonnement et trois insertions.

Gains mesurés sur le banc local :

| Opération | Avant | Après |
|---|---|---|
| Résumé d'une communauté (membre très actif) | 5 006 ms | 115 ms |
| Fil de commentaires d'une publication à 5 000 commentaires | 2 909 ms | 257 ms |
| Fil d'une communauté, 50 publications | 189 ms | 41 ms |
| Fil Live | 184 ms | 60 ms |
| Suppression d'un compte | 1 865 ms | 46 ms |
| Purge des activités terminées (toutes les 15 minutes) | 66 s | 4,6 s |
| Message en conversation privée, 50 envois simultanés | 614 par seconde | 964 par seconde |
| Lectures mêlées, 200 clients | 360 par seconde | 472 par seconde |

Contre-exemple mesuré : envelopper l'identifiant du membre dans un sous-select sur la règle des notifications fait passer « 50 dernières notifications » de 4,6 ms à 476 ms. Ce changement, souvent recommandé, n'est pas proposé.

## 4. Ce qu'aucun index ne règle

1. **Un message dans une grande conversation écrit une notification par membre.** Conversation de 12 000 membres : 7,3 s par message avant, 2,5 s après, soit environ 1,3 message par seconde pour toute la conversation. Les notifications ne sont jamais purgées.
2. **Les suggestions de profils recalculent toute la ville à chaque appel** : 1,5 s à 50 000 membres.
3. **Le temps réel n'est pas filtré** : 12 des 18 canaux de synchronisation reçoivent tous les changements, et chaque changement est contrôlé pour chaque abonné. Non mesuré ici (pas de service Realtime local).
4. **Aucune purge** des messages de jeu, des journaux de partie et de l'historique des tâches planifiées.
5. Liste des membres d'une communauté : trie tous les membres pour afficher la première page.

## 5. Limites

- Offre Supabase non lue ; plafond de connexions temps réel simultanées de l'offre non vérifié.
- Processeur et mémoire de l'instance : pas d'accès aux graphiques d'infrastructure ; seules les statistiques internes de PostgreSQL ont été lues.
- Pas de profilage iOS (ni Xcode ni appareil).
- Le service Realtime, le relais de connexions et le réseau ne sont pas reproduits localement.
