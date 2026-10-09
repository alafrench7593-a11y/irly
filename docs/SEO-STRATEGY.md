# IRLY — Stratégie SEO (Dubaï · Bali · FR/EN)

Dernière mise à jour : 9 octobre 2026. Ce document distingue ce qui est **fait dans le code**, ce qui est **à valider** et ce qui **demande des outils externes**.

> Volumes de recherche, difficulté et concurrence : **non mesurés**. Aucun outil de données SEO (Search Console, Ahrefs, Semrush, Keyword Planner) n'est connecté. Les colonnes « volume » et « difficulté » ci-dessous sont des **priorités estimées par intention**, à remplacer par des chiffres réels dès qu'un outil est branché. Aucun classement n'est garanti.

---

## 1. Audit — constats (vérifiés dans le code)

| # | Constat | Gravité | Statut |
|---|---|---|---|
| 1 | Le site public (getirly.com) n'avait **qu'une seule page indexable**. | Élevée | Corrigé partiellement : 4 guides + 2 pages d'accueil traduites |
| 2 | Le français et l'arabe n'existaient que via JavaScript sur la même URL (`/?lang=fr`), avec une canonical vers `/` : **Google ne voyait que l'anglais**. | Élevée | **Corrigé** : `/fr/` et `/ar/` pré-rendus, canonical propre, hreflang réciproques, redirection 301 de `/?lang=` |
| 3 | L'app web `/app` (SPA Expo) était indexable sans contenu HTML utile. | Moyenne | **Corrigé** : `noindex` sur l'app (le site et les guides sont les pages à indexer) |
| 4 | Sitemap avec 1 URL et des hreflang vers des URL à paramètre. | Moyenne | **Corrigé** : sitemap généré au build (7 URL + alternates) |
| 5 | Données structurées : WebSite + Organization seulement. | Faible | Guides : Article + BreadcrumbList ajoutés |
| 6 | Pages de l'app qui promettaient des vérifications inexistantes (« Curated & verified »). | Confiance | Corrigé dans la mission précédente |
| 7 | Copie GitHub Pages du site (`alafrench7593-a11y.github.io/irly/site/`) : contenu dupliqué possible. | Faible | Mitigé : toutes les canonicals pointent vers getirly.com |
| 8 | Core Web Vitals | — | **Non mesuré** (pas d'accès réseau au site en production ni à PageSpeed/CrUX depuis l'environnement) |

## 2. Architecture retenue (et pourquoi pas plus de pages)

Règle : **une URL = une intention distincte avec un contenu réel**. Pas de pages ville×thème générées en série.

En place :

```
/                         Accueil EN
/fr/  /ar/                Accueil FR / AR (pré-rendus)
/dubai/make-friends/      ↔ /fr/dubai/se-faire-des-amis/
/bali/make-friends/       ↔ /fr/bali/se-faire-des-amis/
/app/                     Application (noindex)
```

Prochaines URL, dans l'ordre, **seulement quand le contenu est écrit et relu** :

| URL EN / FR | Intention | Remarque |
|---|---|---|
| `/dubai/lonely/` · `/fr/dubai/solitude/` | « je me sens seul à Dubaï » | Distinct du guide amitié : émotionnel, rassurant, sans promesse psychologique |
| `/dubai/things-to-do-with-people/` · `/fr/dubai/activites-de-groupe/` | activités pour rencontrer du monde | Par catégorie (sport, culture, plage…) |
| `/dubai/networking/` · `/fr/dubai/networking/` | networking, entrepreneurs | Peut présenter le Networking IRLY (réel) et IRLY PRO (Coming soon) |
| `/bali/digital-nomads/` · `/fr/bali/digital-nomads/` | nomades, coworking | Distinct du guide amitié Bali |
| `/dubai/moving/` · `/fr/dubai/s-installer/` | s'installer à Dubaï | **Exige** sources officielles + date de vérification |
| `/dubai/visa/` · `/bali/visa/` | visas | **Bloqué** tant que les informations ne sont pas vérifiées sur les sites officiels (voir § 5) |
| `/pro/` | IRLY PRO | Page « Coming soon » avec liste d'attente — seulement si elle apporte plus que la page de l'app |

Écartés pour l'instant (cannibalisation ou contenu mince) : `/dubai/rencontres-amicales/` et `/dubai/se-faire-des-amis/` séparées (même intention → une seule page), pages par quartier sans contenu spécifique, `/dubai/sorties/` en doublon de « activités ».

## 3. Mots-clés par intention

Légende priorité : **P1** = page existante ou prochaine ; P2 = 30–60 jours ; P3 = plus tard. Volumes : *à mesurer*.

### Groupe 1-2 — Solitude, amitié, rencontres (Dubaï)
| Mot-clé principal | Variantes / questions | Langue | Intention | Page | Priorité |
|---|---|---|---|---|---|
| se faire des amis à Dubaï | comment se faire des amis à Dubaï, trouver des amis à Dubaï, rencontrer des gens à Dubaï, se faire un cercle d'amis | FR | informationnelle → conversion | `/fr/dubai/se-faire-des-amis/` ✅ | P1 |
| how to make friends in Dubai | make friends in Dubai, meet people in Dubai, meet new people Dubai, build a social circle | EN | idem | `/dubai/make-friends/` ✅ | P1 |
| se sentir seul à Dubaï | solitude à Dubaï, je me sens seul, vivre à Dubaï sans connaître personne | FR | émotionnelle | `/fr/dubai/solitude/` | P1 |
| lonely in Dubai | things to do alone in Dubai | EN | émotionnelle | `/dubai/lonely/` | P1 |
| application pour rencontrer des gens à Dubaï | application rencontre amicale, friendship app Dubai, réseau social Dubaï | FR/EN | commerciale | accueil + comparatif honnête | P2 |
| rencontrer des francophones à Dubaï | communauté française Dubaï, rencontrer des Français | FR | navigationnelle/communautaire | section du guide ✅ puis page dédiée si contenu vérifié | P2 |

Exclu : « rencontrer des célibataires à Dubaï » → intention dating ; IRLY n'est pas une app de dating, ne pas cibler.

### Groupe 3 — Networking Dubaï
networking Dubaï, rencontrer des entrepreneurs, communauté startup, networking francophone, application networking Dubaï → page `/dubai/networking/` (P2), en s'appuyant sur le Networking IRLY réel ; IRLY PRO présenté comme à venir.

### Groupe 4 — Activités Dubaï
activités pour rencontrer des gens à Dubaï, activités de groupe, faire du sport avec d'autres, activités du week-end, activités entre femmes → `/fr/dubai/activites-de-groupe/` (P2). « que faire à Dubaï » / « things to do in Dubai » : concurrence très forte des sites de tourisme, intention touristique → **ne pas viser en tête**.

### Groupes 5-6 — Bali
se faire des amis à Bali / how to make friends in Bali ✅ (P1) ; rencontrer des nomades digitaux, digital nomad community Bali → `/bali/digital-nomads/` (P2) ; activités à Canggu / meet people in Canggu → section du guide ✅, page dédiée seulement avec contenu local vérifié (P3).

### Groupes 7-8 — Visa et installation
visa Dubaï, visa résidence, visa freelance, s'installer à Dubaï ; visa Bali, visa digital nomad Indonésie, s'installer à Bali → **P2, conditionné à la vérification** (voir § 5).

### Langues
FR et EN : maintenant. AR : accueil uniquement (déjà traduit) ; guides en arabe après relecture par un natif. Indonésien et espagnol : après mesure de la demande dans Search Console.

## 4. Calendrier éditorial — 90 jours

Rythme réaliste : **1 guide de fond par semaine** (EN + FR), relu par un humain. Chaque guide : réponse en introduction, H2 explicites, conseils indépendants de l'app, IRLY présenté comme une option, date de mise à jour.

| Sem. | Titre SEO (FR / EN) | URL | Mot-clé principal | Catégorie | CTA | Rôle |
|---|---|---|---|---|---|---|
| 1 | ✅ Se faire des amis à Dubaï / How to make friends in Dubai | `/fr/dubai/se-faire-des-amis/` | se faire des amis à Dubaï | B | Trouver mes gens | Entrée |
| 1 | ✅ Se faire des amis à Bali / How to make friends in Bali | `/fr/bali/se-faire-des-amis/` | se faire des amis à Bali | B | Trouver mes gens | Entrée |
| 2 | ✅ Se sentir seul à Dubaï : ce qui aide vraiment | `/fr/dubai/solitude/` | se sentir seul à Dubaï | A | Rejoindre une communauté | Entrée |
| 3 | ✅ Lonely in Dubai: what actually helps | `/dubai/lonely/` | lonely in Dubai | A | Find my people | Entrée |
| 4 | 15 activités de groupe pour rencontrer du monde à Dubaï | `/fr/dubai/activites-de-groupe/` | activités pour rencontrer des gens à Dubaï | C | Trouver une activité | Considération |
| 5 | Networking à Dubaï : où rencontrer des entrepreneurs | `/fr/dubai/networking/` | networking Dubaï | D | Créer son profil pro | Considération |
| 6 | Bali pour les digital nomads : communauté et coworking | `/fr/bali/digital-nomads/` | communauté digital nomads Bali | B/E | Rejoindre une communauté | Entrée |
| 7 | Sortir seul à Dubaï sans être mal à l'aise | `/fr/dubai/sortir-seul/` | sortir seul à Dubaï | A/C | Trouver une activité | Entrée |
| 8 | Activités entre femmes à Dubaï | `/fr/dubai/activites-entre-femmes/` | activités entre femmes Dubaï | H | Découvrir IRLY Girl | Considération |
| 9 | S'installer à Dubaï : la checklist des premiers mois | `/fr/dubai/s-installer/` | s'installer à Dubaï | E | Préviens-moi (IRLY VISA) | Entrée |
| 10 | Visa Dubaï : les catégories expliquées (sources officielles) | `/fr/dubai/visa/` | visa Dubaï | F | Préviens-moi (IRLY VISA) | Entrée |
| 11 | Visa Bali : les catégories expliquées (sources officielles) | `/fr/bali/visa/` | visa Bali | F | Préviens-moi (IRLY VISA) | Entrée |
| 12 | Reconstruire sa vie sociale après une expatriation | `/fr/guides/vie-sociale-expatriation/` | vie sociale expatriation | A | Trouver mes gens | Entrée |
| 13 | Revue : mise à jour des guides, ajout des données Search Console | — | — | — | — | Maintenance |

Plans H2/H3 détaillés : à rédiger semaine par semaine sur le modèle des guides existants (`site/guides/articles.mjs`).

Témoignages (catégorie J) : **uniquement** recueillis auprès de vrais membres, avec leur accord écrit. Aucun pour l'instant.

## 5. Visas : règle de publication

Avant toute page visa :
1. Sources officielles uniquement : portail officiel du gouvernement des Émirats (u.ae), GDRFA Dubaï, ICP ; pour l'Indonésie, la Direction générale de l'Immigration (imigrasi.go.id) et le portail e-Visa officiel.
2. Chaque condition, frais ou délai cité avec son lien et la **date de vérification**.
3. Mention visible : IRLY n'est ni une autorité gouvernementale ni un cabinet juridique ; aucune garantie d'obtention.
4. Relecture tous les 3 mois (les règles changent).

## 6. Données structurées

En place : WebSite, Organization (accueil) ; Article + BreadcrumbList (guides). **Non ajoutés volontairement** : FAQPage (Google réserve ces résultats enrichis à des sites gouvernementaux et de santé), MobileApplication (l'app n'est pas encore sur les stores), Event (pas d'événements publics vérifiables), avis/notes (aucun). Les données structurées ne garantissent pas l'affichage de résultats enrichis. Validation : à faire avec le Rich Results Test de Google une fois en ligne.

## 7. Mesure (à configurer, rien n'est connecté)

1. **Google Search Console** : vérifier le domaine getirly.com (enregistrement DNS TXT), soumettre `https://getirly.com/sitemap.xml`, suivre impressions, clics, CTR, positions, pages indexées par langue.
2. **Analytics** : l'app a déjà un suivi d'événements interne ; pour le site, préférer une solution sans cookies ou avec bannière de consentement (RGPD / loi émiratie sur les données) avant d'ajouter GA4.
3. **Conversions** : clic sur « Trouver mes gens » depuis un guide (`data-cta="guide"`), inscriptions à la liste d'attente (`source`), demandes « Préviens-moi » par service.

## 8. Autorité (sans spam)

Articles invités sur des médias d'expatriés, partenariats avec des associations francophones à Dubaï et Bali, interviews réelles d'entrepreneurs et de nouveaux arrivants (avec accord), guides originaux. Pas d'achat de liens, pas de faux avis, pas de contenu dupliqué.

## 9. Prochaines actions les plus rentables

1. Déployer sur Vercel (les nouvelles pages ne sont pas encore en ligne).
2. Brancher Google Search Console et soumettre le sitemap.
3. Relire les 4 guides (ton, exactitude locale).
4. Publier « Se sentir seul à Dubaï » (FR) et « Lonely in Dubai » (EN).
5. Préparer les pages visa avec les sources officielles.
