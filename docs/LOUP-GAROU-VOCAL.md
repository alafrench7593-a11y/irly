# IRLY Loup-Garou : parties vocales

État au 10 novembre 2026. Ce document dit ce qui est fait, ce qui est vérifié, et ce qui reste à faire par le
propriétaire avant que le vocal fonctionne pour les membres.

## 1. Choix de l'infrastructure

| Critère | LiveKit | Agora | WebRTC « maison » + SFU |
| --- | --- | --- | --- |
| Expo (build de développement / EAS, pas Expo Go) | plugin officiel `@livekit/react-native-expo-plugin` | plugin communautaire | à écrire |
| Web | `livekit-client` (le même moteur que sur mobile) | SDK web séparé | à écrire |
| 20 participants audio | SFU, prévu pour | oui | à dimensionner soi-même |
| Permissions par salon | dans le jeton signé par NOTRE serveur (publier / écouter, par salon) | rôles hôte / audience, moins fin | à écrire |
| Fermer un salon côté serveur | API `RoomService.DeleteRoom` | API REST de « ban » | à écrire |
| Sortie possible | open source (Apache 2), auto-hébergeable | propriétaire | / |
| Secrets | clé + secret côté serveur uniquement | App ID public + certificat | / |

Choix : **LiveKit**. Raison décisive : les droits de parole et d'écoute sont portés par un jeton que notre
serveur signe, salon par salon, et le même code client sert au web, à iOS et à Android. Le coût dépend de l'offre
LiveKit Cloud retenue ou d'un auto-hébergement : il n'est pas chiffré ici, il est à vérifier sur leur page de prix
au moment de créer le projet.

## 2. Architecture

```
Téléphone / navigateur ── session Supabase ──▶ Edge Function voice-token
                                                │  appelle ww_voice_grant AVEC la session du membre
                                                │  (la fonction n'a aucun privilège propre en base)
                                                ▼
                                         Base de données : qui peut parler / écouter, sur quel canal,
                                         et dans quel salon audio (son nom change quand les droits changent)
                                                │
                                                ▼
                               jetons signés (10 min, un par canal) ──▶ serveur audio LiveKit
```

- Supabase : comptes, salons, phases, rôles, permissions. Aucun son n'y passe (ni Realtime, ni stockage).
- LiveKit : transport audio uniquement. Rien n'est enregistré, transcrit ou conservé.
- Le secret LiveKit n'existe que dans les secrets de l'Edge Function. L'application ne le voit jamais.

### Permissions (identiques au chat écrit existant, rien d'inventé)

| Phase | Vivants | Meute / Escrocs | Éliminés |
| --- | --- | --- | --- |
| Salon d'attente | parlent sur « tous » | idem | / |
| Nuit (et tour de la Sorcière) | aucun canal | parlent sur « meute » (même test que le chat de meute : vivant, camp des Loups, pas arrivé cette nuit) | parlent sur « éliminés » |
| Jour, vote, second tour | parlent sur « tous » | idem (pas de canal privé le jour) | écoutent « tous », parlent sur « éliminés » |
| Fin | tout le monde parle sur « tous » | | |

Parties contre l'IA et parties en présentiel : pas de vocal (l'IA écrit ; autour d'une table on se parle).

### Quand un droit change (mort, carte échangée par le Scameur, nuit qui tombe)

Le nom du salon audio d'un canal est calculé à partir de la phase et de la liste de ceux qui y ont droit. Dès que
cette liste change, le canal change de salon :

1. l'ancien membre n'obtient plus aucun jeton pour le nouveau salon (refus du serveur) ;
2. l'ancien salon est fermé sur le serveur audio (`DeleteRoom`) à la première demande de jeton qui suit, ce qui
   déconnecte quiconque y serait resté.

Ce n'est donc pas un bouton masqué : la coupure est faite par le serveur audio.

Limite connue : la fermeture de l'ancien salon est déclenchée par la première demande de jeton après le changement
(faite par n'importe quel joueur du salon vocal, en pratique dans la seconde). Entre les deux, une application
modifiée pourrait rester quelques instants dans l'ancien salon ; elle n'y entendrait que ceux qui y seraient restés
aussi.

## 3. Ce que le propriétaire doit faire (rien de tout cela n'est fait par le code)

1. Créer un projet LiveKit (Cloud ou auto-hébergé).
2. Dans Supabase → Edge Functions → Secrets : `LIVEKIT_URL` (wss://…), `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.
3. Déployer la fonction : `supabase functions deploy voice-token`.
4. Web : rien d'autre. Le choix « Mode vocal » apparaît à la création d'une table.
5. iOS / Android : un nouveau build est nécessaire (pas Expo Go, pas une simple mise à jour OTA) :
   - `npx expo install @livekit/react-native @livekit/react-native-webrtc @livekit/react-native-expo-plugin @config-plugins/react-native-webrtc`
   - `app.json` : ajouter les deux plugins, le texte d'autorisation du micro (`NSMicrophoneUsageDescription`),
     la permission Android `RECORD_AUDIO`, et le mode audio en arrière-plan seulement si on veut le promettre ;
   - au démarrage de l'app : `registerGlobals()` de `@livekit/react-native`.
   Ces dépendances natives changent l'empreinte du build (`runtimeVersion: fingerprint`) : les mises à jour OTA ne
   toucheront plus les versions déjà installées. C'est pour cela qu'elles ne sont pas ajoutées ici sans accord.

Tant que les étapes 1 à 3 ne sont pas faites, la fonction répond « non configuré » : l'application ne propose pas
le mode vocal, et rien d'autre ne change.

## 4. Dans l'application

- Création d'une table en ligne : deux cartes, « Mode texte » et « Mode vocal » (affichées seulement si le vocal
  fonctionne réellement : serveur audio configuré et WebRTC présent sur l'appareil). L'hôte peut changer dans le
  salon d'attente. Le choix est enregistré par le serveur (`ww_set_comm`).
- Liste des tables et salon d'attente : une table vocale est indiquée.
- « Rejoindre le vocal » : on écoute seulement. Le micro n'est jamais ouvert sans action du joueur.
- Micro ouvert ou « appuyer pour parler » ; couper le son ; choisir la sortie audio quand l'appareil le permet ;
  quitter le vocal sans quitter la partie. Un micro reste aussi dans la barre d'actions du bas.
- Qui parle : anneau lumineux autour du siège, nom éclairé avec une petite onde. C'est le niveau sonore mesuré par
  le serveur audio en direct ; aucun son n'est gardé.
- Par joueur entendu : couper pour moi, signaler, bloquer ; l'hôte peut exclure dans le salon d'attente.
- Le vote et les pouvoirs ne dépendent jamais du vocal. Le chat écrit reste dans toutes les parties.

## 5. Ce qui est vérifié, et comment

| Test demandé | Vérifié | Comment |
| --- | --- | --- |
| A salon d'attente | droits et salon commun : oui. Son entre deux appareils : **non** | `supabase/tests/werewolf_voice.test.sql` |
| B débat à six | droits : oui. Son : **non** | idem |
| C nuit | oui (aucun canal, refus du serveur) | idem |
| D meute | oui (salon privé, jamais donné à un autre siège) | idem |
| E Dubaï | oui | idem |
| F élimination | oui (écoute seule, ancien salon fermé) | idem |
| G Scameur | oui, avec le vrai moteur d'échange | idem |
| H reconnexion | droits redonnés à l'identique : oui. Reprise réseau réelle : **non** | idem |
| I boutons du micro | interface : voir le rapport de session. Micro réel : **non** | navigateur |
| J vingt joueurs | droits : oui. Charge audio réelle : **non** | idem |
| K accès non autorisé | oui (refus du serveur, fonctions fermées aux visiteurs) | idem |
| L partie texte | oui | idem + suite SQL complète |
| Jetons | signature et droits relus par le vérificateur officiel LiveKit | `scripts/test-voice-token.mts` |

Non vérifié et à faire sur de vrais appareils, une fois le serveur audio créé : son entre deux téléphones, AirPods
et casques Bluetooth, haut-parleur, appel entrant, passage en arrière-plan, changement de réseau, 20 voix à la
fois, Safari iOS. Aucun de ces points n'a pu être exécuté dans l'environnement de développement (pas de serveur
audio, pas de téléphone).
