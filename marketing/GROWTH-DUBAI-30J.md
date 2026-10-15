# IRLY — Audit et plan de croissance organique Dubaï (TikTok + Instagram)

Rédigé le 15 octobre 2026. Sans publicité payante, sans achat d'abonnés, sans faux engagement.

Étiquettes : **[Certain]** = mesuré ou lu dans une source, **[Probable]** = déduction forte, **[Supposition]** = je comble un manque de données.

---

## 0. Ce que j'ai réellement pu voir

| Source | Accès | Contenu |
|---|---|---|
| Instagram @irlyofficial, via Metricool (marque `irlyofficial`, connectée le 13 oct. 2026) | ✅ | Abonnés, portée quotidienne, 1 Reel avec ses statistiques, démographie des abonnés |
| Page publique Instagram | ❌ | Le conteneur ne résout pas instagram.com : je n'ai **pas vu** la photo, la bio, le lien ni la grille |
| TikTok @irlyofficial | ❌ | tiktok.com est inaccessible et TikTok n'est pas connecté à Metricool : **aucune donnée** |
| Dépôt `marketing/` | ✅ | Stratégie TikTok, 4 diaporamas rendus, 1 carrousel et 1 Reel Instagram (FR et EN) avec leurs légendes |
| Site `site/index.html` | ✅ (code) | Liste d'attente, « Coming soon on the App Store », lien vers une version web |
| getirly.com en ligne | ❌ | Inaccessible depuis le conteneur |

**Statut de l'app** [Certain] : bêta TestFlight (build 15 envoyé le 15 oct.), pas sur l'App Store. Le site annonce une version navigateur (`getirly.com/app`), mais je ne l'ai pas vérifiée en ligne. Aucun contenu ne doit donc dire « download now ».

### À me fournir pour compléter l'audit
1. Captures du profil Instagram (en-tête, bio, lien, 12 premières vignettes) et du profil TikTok.
2. **L'historique du compte Instagram** : était-il un ancien compte renommé ? Des abonnés ont-ils été achetés ou importés ? (voir problème n°1)
3. TikTok Studio → Analytics, 28 jours : vue d'ensemble, et pour chaque vidéo la durée moyenne de visionnage, le taux de visionnage complet, les sources de trafic, les vues de profil et les nouveaux abonnés. Captures ou export CSV.
4. La liste des vidéos TikTok déjà publiées, avec leur date.
5. Connecter TikTok à Metricool (Metricool → marque irlyofficial → Connecter TikTok) : je pourrai alors tout lire moi-même.
6. Le nombre d'inscrits à la liste d'attente aujourd'hui (je peux le lire dans Supabase en lecture seule si tu le demandes).

---

## 1. Résumé exécutif

- **Point faible n°1** [Certain] : le compte Instagram affiche **32 566 abonnés**, mais **aucun pays du Golfe n'apparaît parmi les 45 premiers pays**. Les Émirats pèsent donc moins de 0,4 % de l'audience, soit moins d'environ 130 personnes. Aucune ville des Émirats ne figure non plus dans les 45 premières villes. Les plus gros pays sont les États-Unis (21 %), le Royaume-Uni (7 %), le Brésil (7 %), la France (6 %) et le Mexique (6 %). Le Reel publié le 13 octobre a touché **113 comptes, soit 0,35 % des abonnés**. L'audience existante n'est pas la cible et ne réagit pas.
- **Point faible n°2** [Certain] : le Reel a été regardé **3,6 secondes en moyenne sur 17,2** (rétention de 27 %), avec 1 like, 0 commentaire, 0 partage et 1 enregistrement. L'accroche ne retient pas.
- **Point faible n°3** [Certain] : on ne peut pas savoir combien d'inscrits viennent des réseaux. La liste d'attente enregistre toujours `source = 'site'` (code dans `site/index.html`).
- **TikTok** : aucune donnée. Impossible d'auditer sans les captures ou Metricool.
- **Stratégie recommandée** : garder la solitude à Dubaï comme **porte d'entrée émotionnelle**, mais faire porter la conversion sur **le concret** : « des gens pour faire ce que tu veux déjà faire à Dubaï, cette semaine ». Format principal, **sans face caméra** : vidéos POV tournées au téléphone dans Dubaï (rue, métro, padel, balcon, mains, écran du téléphone), avec texte à l'écran et voix off facultative. Les diaporamas en photos de banque d'images passent au second plan.
- **Objectif réaliste à 30 jours** : établir une base de référence fiable et trouver 1 ou 2 formats qui retiennent (rétention de 40 % ou plus sur des vidéos de 15 s, au moins 1 partage pour 100 vues). Je ne promets aucun chiffre d'abonnés.

---

## 2. Audit TikTok

**Aucune donnée accessible** [Certain]. Ce que je peux évaluer vient du dépôt :

| Élément | Constat | Note /10 |
|---|---|---|
| Handle | `@irlyofficial`, identique sur Instagram | 8 (cohérent ; « official » ne dit rien de Dubaï) |
| Photo, nom, bio, lien | Non vus | — (à fournir) |
| Contenu prévu (4 diaporamas) | Bonne compréhension de la douleur, sources solides, mais photos Pixabay génériques | 5 |
| Hashtags dans `LEGENDE.md` | `#solotrip #selfconfidence #motivation` sont hors sujet : ils envoient la vidéo à une audience mondiale qui n'est pas à Dubaï | 3 |
| CTA de fin | « How long have you been in Dubai? » : bonne question, facile à commenter | 7 |
| Conversion visiteur → abonné | Non mesurable | — |
| Conversion abonné → inscrit | Non mesurable (source non suivie) | 0 mesurable |

**Analyse par post** : impossible sans données. Dès réception des captures, chaque vidéo sera évaluée sur 5 critères : rétention à 2 s, durée moyenne, part du trafic « Pour toi » ou « Recherche », partages, et abonnés gagnés pour 1 000 vues.

---

## 3. Audit Instagram

### Profil

| Élément | Constat | Note /10 |
|---|---|---|
| Photo | Une photo existe (vue via Metricool), mais pas son contenu | — |
| Nom et bio | Non vus | — |
| Lien | Non vu. Doit pointer vers `getirly.com/?src=ig#waitlist` | — |
| Cohérence avec TikTok | Même handle | 8 |
| **Audience** | 32 566 abonnés, Émirats sous 0,4 %. 18-24 ans femmes en tête (5 699) et beaucoup de genre « inconnu » (U), typique d'abonnés inactifs [Probable] | **1** |
| Activité avant le 13 oct. | Portée quotidienne de 0 à 6 comptes du 12 août au 12 oct. : compte dormant | 1 |
| Perte d'abonnés | −2 à −7 par jour du 9 au 13 oct., sans publication [Certain] | — |

[Probable] Ce compte a été renommé à partir d'un ancien compte, ou a reçu des abonnés importés ou achetés. Si des abonnés ont été achetés, il faut le dire maintenant : l'engagement ne remontera jamais au niveau de 32 000 abonnés, et un partenaire ou un journaliste le remarquera.

### Post analysé : Reel « Nobody warns you about this part of Dubai » (13 oct.)

| Mesure | Valeur [Certain] |
|---|---|
| Vues | 174 |
| Portée | 113 |
| Likes / commentaires / enregistrements / partages | 1 / 0 / 1 / 0 |
| Durée moyenne de visionnage | 3,6 s sur 17,2 s |
| Rétention | 27 % |

**Ce qui marche** : le message est juste et ne culpabilise pas (« you're not the only one »). La légende est sobre, la question finale est simple et il n'y a que 5 hashtags.

**Ce qui ne marche pas** :
1. La slide 1 est un skyline de banque d'images. On a vu ce plan mille fois et il ne crée aucune tension. Les gens partent pendant les 2 premières slides.
2. C'est un diaporama exporté en vidéo : aucun mouvement, aucune voix, aucun lieu reconnaissable, donc rien qui signale « quelqu'un qui vit vraiment à Dubaï ».
3. La révélation arrive à la slide 4, sur 7. Elle est trop tardive.
4. La distribution part d'une audience hors de Dubaï : peu de gens se reconnaissent.

**Réécriture** (Reel de 12 s, sans visage : plan POV au téléphone dans le métro rouge ou sur la promenade de la Marina, le soir) :
- **Hook (0-2 s, texte + voix)** : *"I've lived in Dubai for [X] months and I still don't have anyone to call on a Friday night."*
- 2-8 s : *"Work's good. Flat's good. But knowing people here isn't the same as having people."*
- 8-12 s : *"So I'm building something about it. If you're new here, tell me how long you've been in Dubai."*
- **CTA** : commenter son ancienneté à Dubaï, puis épingler la meilleure réponse.
- **Format** : 2 ou 3 plans POV (main sur la barre du métro, défilement des contacts à l'écran, ville par la fenêtre), texte à l'écran en gros, voix off chuchotée ou aucune voix, son d'ambiance réel.

⚠️ Le « [X] months » doit être **ta** vraie durée. Si l'histoire n'est pas la tienne, la reformuler : *"Everyone I've met in Dubai says the same thing…"*.

---

## 4. Les 5 principaux problèmes

| # | Problème | Preuve | Conséquence | Correction |
|---|---|---|---|---|
| 1 | Audience Instagram hors cible (moins de 0,4 % aux Émirats) | Démographie Metricool | Signaux faibles, chiffres pollués, preuve sociale trompeuse | Décision du jour 7 : garder (si la portée vient surtout de non-abonnés) ou repartir sur un compte neuf. Ne **jamais** acheter pour compenser |
| 2 | Aucun lieu réel, aucun mouvement | Contenu 100 % Pixabay | Rétention de 27 %, zéro partage | Vidéos POV tournées au téléphone dans Dubaï, sans visage, dès le jour 1 |
| 3 | Conversion non mesurée | `p_source: 'site'` codé en dur | On ne saura pas ce qui marche | Lire `?src=` dans l'URL et le passer à `join_waitlist` (petit correctif du site, PR séparée) |
| 4 | Positionnement 100 % « solitude » | 9 concepts sur 15 en identification | Marque triste, peu de raisons d'agir | Solitude = accroche, activité concrète = promesse |
| 5 | TikTok invisible pour moi et hashtags hors sujet | Pas d'accès ; `#motivation`, `#solotrip` | Distribution mondiale non ciblée | Connecter Metricool ; hashtags Dubaï uniquement |

---

## 5. Analyse concurrentielle

| Acteur | Ce qu'il fait | Fait / hypothèse | Ce qu'IRLY en tire |
|---|---|---|---|
| Bumble BFF | Matching d'amitié par swipe, refonte orientée groupes | **Fait** ([TechCrunch, avr. 2026](https://techcrunch.com/2026/04/05/as-people-look-for-ways-to-make-new-friends-here-are-the-apps-promising-to-help/)) ; présence à Dubaï : hypothèse | Ne pas se présenter comme « Bumble BFF de Dubaï » : se battre sur l'activité, pas sur le profil |
| Meetup | Groupes par centre d'intérêt | **Fait** (cité par [The National](https://thenational-the-national-prod.cdn.arcpublishing.com/lifestyle/things-to-do/2023/08/22/how-make-friends-dubai-abu-dhabi), 2023) | Montrer que chez IRLY, c'est « ce soir, à 4 », pas « un groupe de 2 000 » |
| Timeleft | Dîners entre inconnus le mercredi | Concept : **fait** ; Dubaï : **non confirmé** | Le format « inconnus + rendez-vous fixe » plaît : à tester avec des sessions IRLY réelles |
| InterNations | Réseau d'expatriés | **Fait** : membres à Dubaï +90 % depuis 2020, selon InterNations ([Arabian Business](https://www.arabianbusiness.com/culture-society/the-business-of-loneliness)) | La demande existe ; leur image est « réseau pro, plus âgé » |
| DUPLAYS, Spartan Run Club | Ligues de sport, clubs de course | **Fait** ([What's On](https://whatson.ae/2024/08/new-to-dubai-these-are-the-best-ways-to-meet-new-people-in-the-city/)) | Partenaires micro-collab potentiels, pas des ennemis |
| Groupes Facebook / WhatsApp d'expatriés | Entraide, sorties | **Fait** ([Gulf News](https://gulfnews.com/amp/story/lifestyle%2Fcommunity%2F7-ways-to-tackle-loneliness-when-living-in-dubai-1.2062913)) | Lieu d'écoute des douleurs réelles (sans spammer) |
| Créateurs « Dubai life », expatriés, solitude | — | **Non vérifié** : je n'ai pu ouvrir ni TikTok ni Instagram | Semaine 1 : lister 20 comptes à la main (méthode §10) |

---

## 6. Positionnement recommandé

- **Actuel** (site et contenus) : « Find your people », solitude.
- **Recommandé** : **« Find people to do things with in Dubai — this week. »** La solitude reste l'accroche ; l'activité devient la promesse.
- **Pourquoi je change** : la solitude crée de l'identification mais peu d'action [Probable]. Personne ne s'inscrit à une liste d'attente « parce qu'il est triste », on s'inscrit pour faire un padel jeudi. Ce positionnement colle aussi à ce que l'app fait réellement : sessions d'activités, communautés, chat, espaces Girl et Moms.
- **Interdits** : promettre des amis, dire « Dubai makes you lonely », donner des chiffres d'utilisateurs, dire « available now ».

---

## 7. Stratégie de contenu

### Piliers

| Pilier | Objectif | Audience | Formats | Émotion | Sujets | Risques | CTA |
|---|---|---|---|---|---|---|---|
| A. Réalité de Dubaï et solitude | Portée, partages | Arrivés depuis moins de 2 ans | POV au téléphone, texte à l'écran | Reconnaissance | Vendredi seul, amis qui partent, appels avec la maison | Marque triste, ton thérapeutique | « Send this to someone who just moved here » |
| B. Situations du quotidien | Partages, commentaires | Expatriés 22-35 ans | POV, sketch en 1 plan | « C'est moi » | Padel sans partenaire, brunch à 1, groupe WhatsApp mort | Clichés | « Tag your padel partner (if you have one) » |
| C. Communauté | Confiance, liste d'attente | Curieux | Micro-trottoir, réponses en vidéo | Appartenance | Questions posées aux gens dans la rue, réponses aux commentaires | Consentement des personnes filmées | « Comment your area, we'll do one there » |
| D. Construire IRLY | Abonnements, liste d'attente | Early adopters | Coulisses, écran de l'app | Curiosité, sympathie | Build 15, un bug, un choix de design | Promettre une date | « Follow to see if we make it » |
| E. Activités | Enregistrements, intention | Personnes actives | Listes, carrousels, vidéos sur place | Envie | 5 choses à faire à 2-4 personnes ce week-end | Inventer des lieux ou des prix | « Save for the weekend » |
| F. Humour | Portée large | Tous | Sketch, texte POV | Rire | « Dubai friendship speedrun », le collègue qui dit « let's hang out » | Viser une nationalité | « Which one are you? » |

### Format sans visage (choix du fondateur)

Aucune vidéo ne montre ton visage. Ce qui remplace le face caméra :
- **POV au téléphone** : mains, pieds, raquette, tasse, téléphone, vue depuis le métro ou le balcon. Toujours un lieu reconnaissable de Dubaï (métro rouge, Marina, JLT, un terrain de padel, un café de quartier).
- **Texte à l'écran** comme narrateur : le hook en gros dans les 2 premières secondes, 1 idée par plan.
- **Voix off facultative** : ta voix sans te montrer, ou aucune voix (texte + son). Pas de voix de synthèse présentée comme une vraie personne.
- **Écran de l'app filmé ou enregistré** pour le pilier D : c'est la preuve que le produit existe.
- **Faux chats** créés pour les sketches (noms visiblement fictifs).
- **Personnes filmées** (micro-trottoir, J19) : toi derrière la caméra, eux à l'écran, uniquement avec leur accord.

Ce qu'on perd [Probable] : l'attachement à un fondateur. Ce qu'on compense : régularité, lieux réels, chiffres réels, réponses rapides aux commentaires.

**Répartition** : A 25 %, B 25 %, E 20 %, D 15 %, C 10 %, F 5 % au départ. On l'ajuste après les tests.

### Méthode (fondateur seul, environ 1 h 30 par jour)

- **Production** : 1 vidéo verticale par jour, publiée à l'identique sur TikTok et en Reel, sans filigrane TikTok sur Instagram (exporter le fichier d'origine).
- **Carrousels** : 2 par semaine sur Instagram, aussi publiés en mode photo sur TikTok.
- **Stories** : 3 par jour sur Instagram (sondage, question, coulisse). Elles ne servent pas la croissance, mais la conversion de ceux qui suivent déjà.
- **Différences entre plateformes** [Probable] : TikTok récompense la rétention et la recherche (dire et écrire les mots-clés « Dubai », « friends », « padel ») ; Instagram récompense les partages en DM et les enregistrements.
- **Réponses en vidéo** : chaque commentaire avec une vraie question devient une vidéo (fonction « reply with video » sur TikTok). C'est gratuit et ça montre qu'il y a quelqu'un derrière la marque.
- **Commentaires locaux** : 20 minutes par jour à commenter de façon utile (pas « check our app ») sous les posts de comptes de Dubaï (salles de sport, cafés, clubs de course, guides).
- **Micro-collabs** : 1 par semaine avec un club ou une personne de Dubaï entre 2 000 et 30 000 abonnés, en post Collab Instagram (portée partagée). Pas de rémunération déguisée : si c'est payé, mention « paid partnership ».
- **UGC** : demander aux testeurs TestFlight une vidéo de 10 s de leur première session, avec leur accord écrit.
- **Liste d'attente** : lien en bio avec `?src=ig` / `?src=tt` (après le correctif), mot-clé en DM (« comment WAITLIST »), à envoyer à la main si pas d'outil.
- **Retours** : 1 sondage en Story par semaine (« What would you do with 3 new people this weekend? »). Les réponses nourrissent le produit.

---

## 8. Calendrier éditorial de 30 jours

Légende : **TT** = TikTok, **IG** = Instagram. « Vidéo » = la même vidéo verticale sur TT et en Reel IG.

Hashtags par défaut :
- **TT** : `#dubai #dubaiexpat #newtodubai #dubaifriends` + 1 hashtag de sujet.
- **IG** : 5 hashtags au maximum, `#dubai #dubaiexpats #newtodubai #makingfriends` + 1 hashtag de sujet.

KPI par défaut d'une vidéo : rétention (IG) ou taux de visionnage complet (TT), partages pour 100 vues, abonnés gagnés.

### Semaine 1 — base de référence et test « émotion contre humour »

**J1 · Vidéo · A**
- **Hook** : *"Nobody warns you about this part of moving to Dubai."*
- **Déroulé** : POV au téléphone dans la rue, le soir (pieds sur le trottoir, néons, téléphone en main), texte à l'écran. 0-2 s hook → *"The job's fine. The flat's fine. Friday night, nobody to call."* → *"How long have you been here?"*
- **Texte à l'écran** : `Nobody warns you about this part of Dubai`
- **Caption** : "Knowing people here isn't the same as having people. How long have you been in Dubai? 👇"
- **CTA** : commenter son ancienneté.
- **Hashtag de sujet** : `#dubailife`
- **Objectif** : base de référence.
- **KPI** : rétention, commentaires.

**J2 · Vidéo · F**
- **Hook** : *"Dubai friendship speedrun: 'we should hang out' → never seen again."*
- **Déroulé** : sketch en 3 plans, texte à l'écran, sans voix.
- **Texte à l'écran** : `Day 1: "we should hang out!"` / `Day 30: seen on Instagram story at brunch without you`
- **Caption** : "Every. Single. Time. Which stage are you at?"
- **CTA** : « Which stage? »
- **Hashtag de sujet** : `#expatlife`
- **Objectif** : test humour.
- **KPI** : partages.

**J3 · Carrousel IG + mode photo TT · E**
- **Hook (slide 1)** : `5 things to do in Dubai this weekend that are better with 3 people`
- **Déroulé** : 1 activité par slide (lieu générique, pas de prix inventé), dernière slide : `Who would you take?`
- **Caption** : "Save this for Friday. Who's coming? 👇"
- **CTA** : enregistrer.
- **Hashtag de sujet** : `#dubaiweekend`
- **Objectif** : enregistrements.
- **KPI** : enregistrements pour 100 comptes touchés.

**J4 · Vidéo · B**
- **Hook** : *"POV: you bought a padel racket in Dubai and now you need 3 strangers."*
- **Déroulé** : plan de la raquette → recherche dans les groupes WhatsApp → *"anyone for 8pm?"* → silence.
- **Texte à l'écran** : `POV: new padel racket, zero padel friends`
- **Caption** : "The racket was the easy part. Tag your padel partner (if you have one)."
- **CTA** : identifier quelqu'un.
- **Hashtag de sujet** : `#padeldubai`
- **Objectif** : partages.
- **KPI** : partages et identifications.

**J5 (vendredi) · Vidéo · A**
- **Hook** : *"Friday night in Dubai when your plans are your sofa."*
- **Déroulé** : plans réels du balcon et de la ville → *"If this is you tonight, you're not the only one."*
- **Caption** : "What are you doing tonight? Honest answers only."
- **CTA** : commenter.
- **Hashtag de sujet** : `#dubainights`
- **Objectif** : test émotion.
- **KPI** : commentaires.

**J6 · Vidéo · D**
- **Hook** : *"I'm building an app in Dubai and here's what's broken today."*
- **Déroulé** : écran de l'app en TestFlight → un vrai bug corrigé → *"Follow if you want to see if this works."*
- **Caption** : "Day 6 of building IRLY in public. Not on the App Store yet. What should it do first?"
- **CTA** : s'abonner.
- **Hashtag de sujet** : `#buildinpublic`
- **Objectif** : abonnements.
- **KPI** : abonnés pour 1 000 vues.

**J7 · Carrousel · C**
- **Hook (slide 1)** : `We asked: how long did it take you to make 1 real friend in Dubai?`
- **Déroulé** : uniquement de vraies réponses tirées des commentaires des J1 et J5 (anonymisées, avec accord). S'il y en a moins de 4, publier à la place « What would you answer? ».
- **CTA** : commenter.
- **Objectif** : communauté.
- **KPI** : commentaires.
- **Revue de la semaine 1** le même jour.

### Semaine 2 — vidéo POV contre carrousel ; hooks solitude contre activités

**J8 · Vidéo POV · A (hook solitude)**
- **Hook** : *"300 contacts in my phone. 0 people to tell about my day."*
- **Déroulé** : écran du téléphone filmé : on fait défiler les contacts, on s'arrête, on ferme. 10 s, texte à l'écran.
- **CTA** : *"Send this to the one you'd tell."*
- **KPI** : partages.

**J9 · Carrousel · A (même sujet)**
- **Hook (slide 1)** : `300 contacts. 0 people to tell about your day.`
- **Déroulé** : 6 slides.
- **CTA** : envoyer à quelqu'un.
- **KPI** : partages (comparés à J8).

**J10 · Vidéo POV · E (hook activités)**
- **Hook** : *"3 things I wanted to try in Dubai but didn't because I had no one to go with."*
- **Déroulé** : liste (désert au lever du soleil, club de course, cours de salsa).
- **CTA** : *"Which one would you do with strangers?"*
- **KPI** : commentaires.

**J11 · Carrousel · E (même sujet)**
- **Hook (slide 1)** : `Things you skip in Dubai because you have no one to go with`
- **CTA** : enregistrer.
- **KPI** : enregistrements (comparés à J10).

**J12 (vendredi) · Vidéo · B**
- **Hook** : *"The Dubai group chat that was 'so active' in week one."*
- **Déroulé** : écran d'un faux chat créé pour l'occasion, avec des noms fictifs bien visibles.
- **CTA** : *"Is yours dead too?"*
- **KPI** : partages.

**J13 · Vidéo · D**
- **Hook** : *"Why I'm building IRLY: Dubai has everything except a way to find people to do it with."*
- **CTA** : *"Join the waitlist, link in bio."*
- **KPI** : clics sur le lien, inscriptions avec `src`.

**J14 · Story + carrousel · C**
- **Contenu** : sondage en Story « Padel / Running / Brunch / Desert ». Carrousel des résultats.
- **KPI** : réponses au sondage.
- **Revue de la semaine 2** le même jour.

### Semaine 3 — contenu Dubaï contre contenu produit

**J15 · Vidéo · A**
- **Hook** : *"In Dubai your friends don't fight with you. They move away."*
- **CTA** : *"How many have you lost to a move?"*

**J16 · Vidéo · D (produit)**
- **Hook** : *"This is how you'd find 3 people for padel on IRLY."*
- **Déroulé** : écran réel de la création d'une session, en 15 s. Uniquement des fonctions présentes dans le build en test.
- **Texte à l'écran** : `In beta. Not on the App Store yet.`
- **CTA** : liste d'attente.

**J17 · Vidéo · E (Dubaï)**
- **Hook** : *"Free or cheap things to do in Dubai that are awkward alone."*
- **CTA** : enregistrer.
- **Règle** : citer uniquement des lieux vérifiés par toi.

**J18 · Vidéo · F**
- **Hook** : *"Types of people at every Dubai brunch."*
- **CTA** : *"Which one are you?"*

**J19 (vendredi) · Vidéo · C**
- **Hook** : *"I asked people at [lieu réel] how they made friends in Dubai."*
- **Déroulé** : micro-trottoir avec accord filmé.
- **CTA** : *"Your answer?"*

**J20 · Vidéo · D (produit)**
- **Hook** : *"We just shipped build 15. Here's what changed."*
- **Contenu** : changements réels et vérifiés uniquement.
- **CTA** : s'abonner.

**J21 · Carrousel · B**
- **Hook (slide 1)** : `Signs you're new in Dubai`
- **CTA** : envoyer à un nouvel arrivant.
- **Revue de la semaine 3** le même jour.

### Semaine 4 — CTA « abonne-toi » contre CTA « commente »

**J22 · Vidéo · A** — Hook *"Calling home and saying 'everything's great' from Dubai."* · CTA **follow**
**J23 · Vidéo · A** — même format, sujet *"The first Ramadan / holidays away from family"* (selon la saison, avec respect) · CTA **comment**
**J24 · Vidéo · B** — Hook *"Trying to make friends at the gym in Dubai like it's a job interview."* · CTA **follow**
**J25 · Vidéo · B** — Hook *"Me pretending I love eating alone at Dubai Mall."* · CTA **comment**
**J26 (vendredi) · Collab IG + vidéo TT · C** — micro-collab avec un club local (*"Come to a run with [club]"*) · CTA aller à l'événement du partenaire
**J27 · Vidéo · D** — Hook *"Honest update: how many people joined the IRLY waitlist this month."* · uniquement le vrai chiffre, même s'il est petit · CTA liste d'attente
**J28 · Carrousel · E** — `10 things to do in Dubai in November with new people` · CTA enregistrer
**J29 · Vidéo · F** — meilleur format humour du mois, nouvelle version · CTA partager
**J30 · Vidéo · D** — *"30 days of building IRLY in public: what worked, what flopped."* · CTA s'abonner + revue finale

**Captions complètes (S3-S4)** : même structure qu'en S1 — reprendre le hook, puis une phrase concrète, puis la question ou le CTA, puis les hashtags par défaut. Scripts détaillés de S3-S4 : à écrire le dimanche précédent, à partir des résultats de la semaine (c'est volontaire, pour ne pas figer ce qui doit dépendre des tests).

---

## 9. Bibliothèque

### 30 hooks TikTok

1. Nobody warns you about this part of moving to Dubai.
2. 300 contacts. 0 people to tell about my day.
3. POV: new padel racket, zero padel friends.
4. Friday night in Dubai when your plans are your sofa.
5. In Dubai your friends don't fight with you. They move away.
6. Dubai friendship speedrun.
7. The group chat that was "so active" in week one.
8. Signs you've been in Dubai less than a year.
9. I've been in Dubai [X] months. Here's the honest truth.
10. Things you skip in Dubai because you have no one to go with.
11. Making friends after 25 is a skill nobody taught us.
12. The colleague who says "let's hang out" and means "never".
13. Dubai is easy. Finding people to do things with isn't.
14. How to go to an event alone in Dubai without standing in a corner.
15. I'm building an app in Dubai — day [N].
16. This is what's broken in our app today.
17. What 3 strangers can do in Dubai this weekend.
18. Calling home and saying "everything's great".
19. Summer in Dubai: the city empties and so does your phone.
20. The worst thing about Dubai nobody posts about.
21. Rating ways to make friends in Dubai.
22. Brunch for one: a documentary.
23. You don't need more people. You need to see the same people twice.
24. If you moved to Dubai this year, watch this.
25. Asking strangers in [area] how they made friends here.
26. Every expat's first month in Dubai in 15 seconds.
27. I tried saying yes to every invite in Dubai for a week. *(seulement si c'est vraiment fait)*
28. Dubai has 200 nationalities and you still eat lunch alone.
29. What I'd tell myself on day 1 in Dubai.
30. Why we're building IRLY in Dubai first.

### 20 hooks Reels

1. Send this to someone who just moved to Dubai.
2. If your weekend plan is "maybe", this is for you.
3. Dubai, but make it less lonely.
4. Save this for your next free Friday.
5. Things that are better with 3 people in Dubai.
6. Knowing people ≠ having people.
7. Your sign to go to that run club alone.
8. The quiet part of Dubai life.
9. POV: you finally found your padel four.
10. Reply with your area. We'll find you something to do.
11. A love letter to the friend who stayed in Dubai.
12. How long did it take you to feel at home here?
13. 3 Dubai activities for people who hate small talk.
14. The Dubai friend you need in your life.
15. Behind the scenes of a tiny Dubai startup.
16. What new expats get wrong about friendship.
17. Me after one good evening with new people.
18. If you're reading this in your flat alone tonight.
19. Dubai expats, settle this.
20. We're not on the App Store yet. Here's why.

### 15 idées de carrousels

1. 5 things to do this weekend with 3 people.
2. Signs you're new in Dubai.
3. How to go to an event alone (step by step).
4. Turning an acquaintance into a friend: 5 small moves.
5. What expats told us about their first year (with consent).
6. Dubai activities by budget (verified places only).
7. The 4 stages of expat friendship.
8. Summer survival: what to do when everyone leaves.
9. Questions that start real conversations.
10. Padel, running, hiking: where beginners are welcome.
11. What IRLY is (and isn't).
12. Build log: 30 days in pictures.
13. Myths about making friends in Dubai.
14. Your weekend: alone vs with 3 people.
15. Your answers to "how long did it take to make 1 friend?".

### 20 questions pour les commentaires

1. How long have you been in Dubai?
2. What's your plan this Friday?
3. Which area do you live in?
4. What would you do with 3 new people this weekend?
5. Padel, run or brunch?
6. How long did it take to make your first real friend here?
7. How many friends have you lost to a move?
8. What do you skip because you'd go alone?
9. Easiest place to meet people in Dubai?
10. Hardest part of your first month?
11. Do you go to events alone?
12. What would make you say yes to a stranger's invite?
13. Which nationality are you, and is your group mixed?
14. Best time of week to meet new people?
15. Would you rather 1 close friend or 10 contacts?
16. What did nobody tell you before moving?
17. Are you staying in Dubai this summer?
18. What should we build first?
19. Your biggest fear about meeting strangers?
20. One activity you'd do tomorrow if someone came?

### 10 CTA d'abonnement

1. Follow if you're new in Dubai.
2. Follow to see if we pull this off.
3. Follow for one Dubai weekend idea every Friday.
4. Follow, we're answering your comments next.
5. Follow if you're done with the sofa Fridays.
6. Follow to watch a Dubai app get built from zero.
7. Follow for the honest version of Dubai.
8. Follow so you don't miss the launch.
9. Follow if this was you.
10. Follow for part 2.

### 10 CTA d'intérêt pour le lancement (sans dire que l'app est disponible)

1. Join the waitlist, link in bio.
2. Comment "IN" and I'll send you the waitlist.
3. We're in beta. Get on the list to be first in Dubai.
4. Want to test it? Waitlist in bio.
5. Tell us your area and you'll hear first when it opens there.
6. Waitlist in bio. No spam, one email when it's live.
7. Be one of the first people in Dubai on IRLY.
8. Want early access? Link in bio.
9. Reply "padel" and you'll hear when padel sessions open.
10. If you'd use this, the waitlist tells us to build faster.

### 10 idées de coulisses

1. Un bug du jour et sa correction.
2. Le fichier TestFlight envoyé à Apple (build 15).
3. Avant / après d'un écran.
4. Un retour de testeur (avec accord).
5. Ta journée de fondateur seul en 15 s.
6. Le choix difficile de la semaine (une fonction coupée).
7. Le premier vrai événement organisé via la bêta.
8. Le nombre réel d'inscrits sur la liste d'attente.
9. Ce qu'Apple a refusé ou demandé, si c'est le cas.
10. Ce qu'une session de test t'a appris.

---

## 10. Hashtags et référencement social

- **Aucun volume de recherche** n'est donné ici : je n'ai pas de données vérifiées.
- **Instagram** : 5 hashtags au maximum [Probable, selon la recherche de `marketing/instagram/.../LEGENDE.md`].
  - Base : `#dubai #dubaiexpats #newtodubai #makingfriends` + 1 hashtag de sujet (`#padeldubai`, `#dubaiweekend`, `#dubairunclub`, `#buildinpublic`, `#dubailife`).
- **TikTok** : 4 ou 5 hashtags.
  - Base : `#dubai #dubaiexpat #newtodubai #dubaifriends` + 1 hashtag de sujet.
  - **Supprimer** `#solotrip #selfconfidence #motivation #loneliness` : ils sont trop larges et hors Dubaï.
- **Mots-clés** (plus importants que les hashtags) : dire à voix haute **et** écrire à l'écran « Dubai », « friends », « new to Dubai », « padel », « things to do ». Les mettre aussi dans la première ligne de la caption.
- **Bio proposée** (IG et TT) :
  `Find people to do things with in Dubai 🇦🇪 | Padel · runs · brunch · desert | In beta — waitlist ↓`
- **Nom affiché** : `IRLY · Dubai friends & activities` (le champ nom est indexé par la recherche Instagram [Probable]).
- **Veille concurrentielle (semaine 1, 30 min)** : chercher sur TikTok et Instagram « new to Dubai », « making friends Dubai », « Dubai padel », « Dubai run club ». Noter 20 comptes avec leurs abonnés, leurs 3 derniers posts et le format de ceux qui marchent. C'est ce tableau qui remplacera mes hypothèses de §5.

---

## 11. Plan de tests

| Sem. | Hypothèse | Changement | Posts | Métrique principale | Métrique secondaire | Critère de succès | Décision |
|---|---|---|---|---|---|---|---|
| 1 | L'humour retient mieux que l'émotion | J2, J4 (humour) contre J1, J5 (émotion) | 2 contre 2 | Rétention moyenne | Partages pour 100 vues | Écart d'au moins 20 % en relatif | Le format gagnant passe à 40 % du mix |
| 2 | La vidéo POV bat le carrousel sur le même sujet | J8 contre J9, J10 contre J11 | 2 paires | Partages pour 100 comptes touchés | Enregistrements | Le gagnant l'emporte sur les 2 paires | Garder le gagnant comme format principal |
| 2 | Les hooks « activités » convertissent mieux que les hooks « solitude » | J8 et J9 contre J10 et J11 | 2 contre 2 | Abonnés pour 1 000 vues | Clics sur le lien | Écart d'au moins 30 % | Ajuster le positionnement (§6) |
| 3 | Le contenu Dubaï attire plus que le contenu produit | J15, J17, J19 contre J16, J20 | 3 contre 2 | Vues | Inscriptions `src=` | Le produit génère au moins 2 fois plus d'inscriptions pour 1 000 vues | Fixer la part de produit (15 % ou plus) |
| 4 | Le CTA « follow » rapporte plus d'abonnés que le CTA « comment » | J22, J24 contre J23, J25 | 2 contre 2 | Abonnés pour 1 000 vues | Commentaires | Écart d'au moins 30 % | CTA par défaut du mois 2 |

**Limite** [Certain] : avec 2 posts par bras, ce sont des signaux, pas des preuves statistiques. On décide sur des écarts nets ; sinon, on reteste le mois suivant.

---

## 12. Tableau de bord (hebdomadaire, à remplir le dimanche)

| Indicateur | Source | Référence (S1) | S2 | S3 | S4 |
|---|---|---|---|---|---|
| Vues TT / Reels IG | TT Studio / Metricool | à mesurer | | | |
| Rétention moyenne (IG) / visionnage complet (TT) | Idem | 27 % (1 Reel) | | | |
| Partages pour 100 vues | Idem | 0 | | | |
| Enregistrements pour 100 comptes touchés | Idem | 0,9 | | | |
| Abonnés gagnés − perdus (IG) | Metricool | +3 / −2 le 13 oct. | | | |
| Abonnés gagnés (TT) | TT Studio | à fournir | | | |
| Part des Émirats dans l'audience IG | Metricool | < 0,4 % | | | |
| Clics sur le lien en bio | IG Insights (AC12) / TT | à mesurer | | | |
| Inscriptions à la liste d'attente par source | Supabase `waitlist.source` | non suivi | | | |
| DM et réponses aux Stories | Manuel | à mesurer | | | |

**Fourchettes réalistes** [Supposition, pas une promesse] : sur un compte sans audience locale, une vidéo sur 10 sort du lot. Le seul objectif chiffré défendable à 30 jours : **20 inscriptions à la liste d'attente attribuées aux réseaux sociaux**, et **une part des Émirats en hausse mesurable** dans l'audience Instagram.

---

## 13. Plan 24 h

| Action | Bénéfice | Temps | Coût | Difficulté | Mesure |
|---|---|---|---|---|---|
| M'envoyer les captures listées au §0 et l'historique du compte IG | Débloque l'audit TikTok et la décision sur le compte | 15 min | 0 | Faible | Reçu |
| Connecter TikTok à Metricool | Statistiques TikTok lisibles par moi | 5 min | 0 | Faible | Données visibles |
| Mettre la nouvelle bio et le nouveau nom sur IG et TT | Clarté de la promesse | 10 min | 0 | Faible | Clics sur le lien |
| Me dire « go » pour le correctif `?src=` sur le site | Attribution des inscriptions | 30 min (moi) + PR | 0 | Faible | `waitlist.source` renseigné |
| Tourner et publier J1 en POV (sans visage) | Premier point de comparaison avec le format diaporama | 30 min | 0 | Faible | Rétention par rapport à 27 % |

## 14. Plan 7 jours

| Action | Bénéfice | Temps | Coût | Difficulté | Mesure |
|---|---|---|---|---|---|
| Publier J1 à J7 | Base de référence et test n°1 | ~1 h par jour | 0 | Moyenne | Tableau §12 |
| 20 min de commentaires locaux par jour | Visibilité auprès de comptes de Dubaï | 2 h 20 au total | 0 | Faible | Visites de profil, part des Émirats |
| Veille de 20 comptes (§10) | Remplace les hypothèses de §5 | 30 min | 0 | Faible | Tableau rempli |
| Contacter 5 clubs locaux pour une collab | Collab en S4 | 1 h | 0 | Moyenne | Réponses |
| Décider pour le compte IG (garder ou repartir à zéro) | Arrêter de polluer les mesures | 15 min | 0 | Décision | Part des non-abonnés dans la portée (Insights) |

## 15. Plan 30 jours

| Action | Bénéfice | Temps | Coût | Difficulté | Mesure |
|---|---|---|---|---|---|
| Calendrier complet (§8) | 30 vidéos, 8 carrousels | ~1 h 30 par jour | 0 | Moyenne | Tableau §12 |
| 4 tests (§11) | Choix des formats fondé sur les données | Inclus | 0 | Faible | Décisions écrites |
| 1 micro-collab | Accès à une audience locale | 3 h | 0 (ou échange de visibilité) | Moyenne | Abonnés pendant les 48 h suivantes |
| UGC de 3 testeurs | Preuve réelle | 1 h | 0 | Moyenne | Accords écrits |
| Revue J30 et plan du mois 2 | Doubler ce qui marche | 1 h | 0 | Faible | Document de revue |

---

## Recommandation

**Ce que je ferais à ta place** : arrêter les diaporamas en photos de banque d'images comme format principal et passer **dès demain** aux vidéos POV tournées au téléphone dans Dubaï, sans montrer ton visage, avec la solitude comme accroche et l'activité concrète comme promesse. En parallèle, régler la question des 32 000 abonnés hors cible avant le jour 7.

**Compromis principal** : sans visage, la confiance ne vient plus d'une personne mais de la preuve que tout est vrai : lieux réels de Dubaï, écran réel de l'app, chiffres réels, réponses réelles aux commentaires. C'est plus lent à construire qu'avec un fondateur à l'écran [Probable], mais ça reste bien plus crédible que des photos de banque d'images.
