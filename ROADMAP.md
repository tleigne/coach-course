# Roadmap — après le MVP

## Principe permanent (demande du 22/07) : s'appuyer sur l'existant

Thibault a demandé de systématiquement regarder ce qui existe déjà sur
GitHub/open source avant de construire, pour optimiser performance et
expérience utilisateur — déjà appliqué ce soir (recherche PWABuilder,
Supabase, Strava API, limites Spotify). Le choix « zéro dépendance » de
l'appli reste volontaire (légèreté, sécurité, pas de risque de
supply-chain) : l'idée n'est pas d'ajouter des librairies par défaut, mais
de vérifier qu'on ne réinvente pas quelque chose de mieux résolu ailleurs
avant de coder, et d'utiliser les API navigateur standard (déjà fait :
Wake Lock, Web Speech, Geolocation, DecompressionStream). Piste concrète
pour une prochaine session : passer l'appli dans **Lighthouse** (outil
gratuit intégré à Chrome) pour un audit performance/accessibilité/PWA
objectif.

## Fait — 2026-07-23 : séance structurée sans fichier de parcours

Bug remonté par Thibault : l'écran objectif (et donc les séances Seuil/
Tempo/VMA/Fractionné) n'était accessible qu'après avoir importé un GPX,
alors que ces séances se basent uniquement sur le temps/la distance en
direct (GPS) et non sur un tracé précis — elles n'ont donc jamais eu
besoin d'un fichier importé. Ajout d'un bouton « Séance sans parcours »
sur l'écran d'import (aux côtés d'Historique/Chronomètre/Réglages) qui
amène directement à l'écran objectif avec « Séance d'entraînement
structurée » présélectionnée ; le choix « Temps cible sur tout le
parcours » (seul objectif qui a vraiment besoin d'une distance totale
connue) est caché dans ce cas précis. Testé en local : démarrage,
affichage du segment (échauffement), et fin de course sans erreur.

## Fait — 2026-07-23 : refonte visuelle « haut de gamme »

Demande du 23/07 (« que peux tu proposer d'autre pour que l'appli soit
haut de gamme ? »), avec clarification importante : pas de framework
Angular JS (l'appli reste volontairement zéro dépendance, voir principe
ci-dessus) — « angular » au sens design = formes géométriques. Réalisé :
- Icônes vectorielles (SVG intégré, sprite `<symbol>` dans index.html,
  aucune bibliothèque d'icônes externe) sur les boutons de navigation,
  pause/lecture, thème, historique, chronomètre, réglages, export GPX.
- Accents angulaires (coins coupés en biseau via `clip-path`) sur les
  boutons principaux et le badge de segment de séance, contrastés avec
  des cartes toujours arrondies ailleurs pour garder un rendu chaleureux
  plutôt que froid/technique (demande explicite : « friendly et sexy »).
- Dégradé chaud orange → rose (`--accent-vif`) sur les boutons d'action,
  vérifié dans les deux thèmes (contraste conservé en thème clair).
- Retour tactile (légère réduction d'échelle au clic) sur tous les
  boutons, typographie resserrée sur les gros chiffres (distance/temps).
- Testé en local sur les écrans import, réglages (thème + voix),
  chronomètre (bascule des icônes lecture/pause/réinitialiser),
  historique et le thème clair — aucune erreur console.

## Fait — 2026-07-23 : séances d'entraînement structurées

Demande du 22/07, réalisée le 23/07. Un objectif de course peut maintenant
être une **séance structurée** plutôt qu'une seule valeur de temps/allure
globale, façon montres de sport (Garmin, Coros, Polar) :
- **Seuil** et **Tempo** : effort continu à allure seuil/tempo (dérivées du
  profil Strava dans `js/profil.js`) sur une durée choisie.
- **VMA** : répétitions courtes (durée effort/récup configurables, par
  défaut 30s/30s) à l'allure VMA estimée.
- **Fractionné personnalisé** : NxDistance configurable (ex. 4×800m avec
  400m de récupération), avec allure cible optionnelle (VMA par défaut).
- Un échauffement (10 min) et un retour au calme (5 min) sont ajoutés
  automatiquement à chaque séance.
- Le coach annonce vocalement chaque transition de segment (effort,
  récupération, numéro de répétition, allure cible), et l'écran de course
  affiche un badge avec le segment en cours, l'allure cible et le temps/
  distance restant dans le segment.
- Implémenté dans `js/seances.js` (modèles + classe `SuiviSeance` qui suit
  la progression segment par segment) et câblé dans `js/app.js`/`js/coach.js`.
- Le nom de la séance est conservé dans l'historique des courses.

Non couvert pour l'instant (pistes pour plus tard si le besoin se
confirme) : personnalisation fine des allures par segment au-delà de
seuil/tempo/VMA dérivés du profil, sauvegarde de séances favorites/
personnalisées, alternance automatique effort/récup basée sur la fréquence
cardiaque (nécessiterait un capteur externe, hors de portée du GPS/
téléphone seul).

## En attente d'arbitrage : comptes utilisateurs (authentification + stockage des données)

Demande de Thibault (22/07) : permettre à chaque utilisateur de créer un
compte pour retrouver toutes ses données (historique de courses, profil...),
avec une sécurité et une conformité réglementaire (RGPD) traitées « dans les
règles de l'art », en s'appuyant sur des briques open source existantes
plutôt que de tout réinventer.

**Ce que ça implique** : l'appli n'a aujourd'hui aucun serveur (tout tourne
dans le navigateur, l'historique reste en `localStorage` sur l'appareil).
Ajouter des comptes veut dire ajouter un vrai backend (base de données +
authentification) — un changement d'architecture, pas un ajout de
fonctionnalité comme les précédents.

**Recommandation après recherche : [Supabase](https://supabase.com/)** —
open source, combine base de données Postgres + authentification (module
GoTrue) en un seul service, pensé précisément pour ce cas (appli front-end
qui a besoin d'un backend sans en écrire un de zéro). Deux façons de le
déployer, avec des compromis différents :
- **Hébergé par Supabase, région UE (Francfort)** : rapide à mettre en
  place, offre gratuite existante, contrat de traitement des données (DPA)
  fourni. Limite à documenter dans la politique de confidentialité :
  Supabase reste une société américaine, donc soumise au *Cloud Act* même en
  hébergeant en UE.
- **Auto-hébergé** (le code est 100 % open source) : souveraineté totale des
  données, mais toute la responsabilité de conformité et de sécurité du
  serveur repose alors sur nous, sans filet.

**Alternatives open source considérées** (authentification seule, sans
stockage intégré) : SuperTokens, Authentik, Keycloak, Hanko. Plus lourdes à
assembler ici, car il faudrait ajouter une base de données séparée en plus —
Supabase reste le choix le plus direct pour ce projet.

**Ce qui bloque un développement solo dans l'immédiat :**
1. Création d'un compte Supabase (ou location d'un serveur pour
   l'auto-hébergement) — à faire par Thibault, impossible de créer un compte
   à sa place.
2. Conformité RGPD réelle, au-delà du code : politique de confidentialité à
   mettre à jour, mécanisme d'export/suppression des données par
   l'utilisateur (droits RGPD), décision sur la durée de conservation.
3. Décision structurante à trancher ensemble : hébergé vs auto-hébergé
   (coût, responsabilité, simplicité).

**Prochaine étape une fois la décision prise** : créer le
compte/projet Supabase, ajouter un écran de connexion/inscription, migrer
`js/historique.js` pour lire/écrire vers Supabase au lieu de `localStorage`
(avec repli local si hors-ligne pendant une course).

## En attente d'arbitrage : Google Play Store

Thibault veut pouvoir packager l'appli pour le Play Store (l'installation
PWA via navigateur lui semblait compliquée — plusieurs bugs réels ont depuis
été corrigés le 21/07, à reconfirmer avant de trancher). Points à trancher
ensemble avant de coder :
- Ça suppose un **compte Google Play Developer (25$, à sa charge)** et une
  **vraie soumission/revue Google (plusieurs jours)** — ni l'un ni l'autre ne
  peuvent être faits par moi.
- Ce que je *peux* préparer sans outil à installer : un paquet Android via
  **PWABuilder** (pwabuilder.com, prend notre `manifest.json` + l'URL
  hébergée), plus le fichier `assetlinks.json` nécessaire pour que l'appli
  s'ouvre en Trusted Web Activity (sans barre d'adresse).
- Une **politique de confidentialité** sera exigée par Google Play (l'appli
  utilise la position GPS) — à rédiger.

### Sécurisation « by design » avant soumission (demande du 22/07)
Traiter la sécurité comme un prérequis à la publication, pas un rattrapage
après coup. À couvrir avant toute soumission :
- **Politique de confidentialité** : préciser que la position n'est utilisée
  que localement, jamais transmise ni stockée ailleurs que sur l'appareil.
- **Formulaire "Data safety" du Play Console** : déclarer précisément les
  données collectées (position GPS, en local uniquement) et confirmer
  qu'aucune donnée n'est partagée avec un tiers.
- **Aucun secret/clé API en dur dans le code client** — déjà vrai aujourd'hui
  (aucun backend, aucune clé), à vérifier à nouveau si Strava/Google Maps/
  Spotify sont un jour intégrés directement dans l'appli.
- **Échappement systématique de tout contenu utilisateur avant insertion
  HTML** (nom de parcours importé, etc.) — fait via `echapperHTML` dans
  `js/utils.js`, à systématiser sur tout nouvel écran.
- **HTTPS strict** (déjà le cas via GitHub Pages/TWA) et permissions
  minimales (seule la géolocalisation est demandée, rien d'autre).
- **Aucune dépendance externe** (zéro librairie tierce à ce jour) : réduit la
  surface de risque de supply-chain, à essayer de préserver.
- Revoir le `manifest.json` et le TWA généré (PWABuilder) pour le ciblage
  Android (targetSdkVersion) exigé par Google Play au moment de la
  soumission (les exigences évoluent, à vérifier à ce moment-là).

## Fait — 2026-07-22

- **Tracé du parcours affiché visuellement** (vue 2D du GPX, projection
  équirectangulaire simple en SVG côté client — pas de tuiles de carte
  externes, garde l'appli légère et utilisable hors-ligne), sur l'écran
  d'import et sur l'écran de course.
- **Position GPS en direct sur ce tracé** pendant la course (marqueur mis à
  jour à chaque position reçue).
- **Guidage vocal directionnel façon copilote de rallye** : calcul de cap
  (bearing) entre points du parcours, détection des virages à venir
  (`chercherVirageAVenir` dans `js/gpx.js`, seuils léger/virage/épingle),
  nouvelle banque de phrases (`phraseVirage` dans `js/coach.js`), avec
  cooldown pour ne pas spammer.
- **Historique des courses** (`js/historique.js`) : sauvegarde locale
  (`localStorage`, 50 dernières courses) + écran de consultation.
- **Import KML/KMZ** en plus du GPX (`js/kml.js`), pour les exports Google
  Maps/My Maps/Google Earth — y compris décompression ZIP/deflate pour les
  KMZ, sans dépendance externe (`DecompressionStream` natif du navigateur).
- **Export GPX de la course terminée** (`js/export.js`), pour import manuel
  dans Strava ou une autre plateforme. L'upload automatique vers Strava (API
  `POST /uploads`) nécessiterait une authentification OAuth *avec secret
  client*, donc un vrai backend pour ne pas exposer ce secret côté navigateur
  — hors de portée pour une appli 100% statique. Export manuel retenu comme
  compromis pour l'instant.
- Correctifs associés : échappement HTML des noms de parcours importés
  (`echapperHTML`), ajout des nouveaux modules au cache hors-ligne du service
  worker (passé en v5).

## Fait — 2026-07-21 : coaching prédictif basé sur Strava

Le coach vocal sait dire, en cas de retard, si c'est *rattrapable ou non*
compte tenu du dénivelé restant sur le parcours et du profil de performance
réel de Thibault (voir [`js/profil.js`](js/profil.js), calculé à partir de
ses zones d'allure Strava et de son ratio vitesse/dénivelé observé sur des
sorties en montagne). Pas d'intégration Strava en direct dans l'appli (pas
d'OAuth ni de backend) : les données ont été récupérées une fois via un
accès Strava disponible côté outillage de développement, puis figées dans
`js/profil.js`. À recalculer manuellement si le profil de forme évolue
nettement.

## Fait (partiellement) — 2026-07-23 : audio en arrière-plan, écran éteint

Amélioration best-effort ajoutée : un son silencieux (WAV minimal généré en
base64, `js/audio-silence.js`, zéro dépendance) est joué en boucle pendant
la course, avec des métadonnées `MediaSession` — ça fait considérer l'appli
par Android/Chrome comme un lecteur média actif, ce qui aide à continuer
d'exécuter le GPS et la voix quand l'écran s'éteint ou que l'appli passe en
arrière-plan. Complète le Wake Lock existant (qui ne fonctionne que si la
page reste visible).

**Limite honnête à garder en tête** : ce n'est pas une garantie absolue.
Un verrouillage complet du téléphone (bouton power) reste une limite native
des PWA — seule une vraie appli native avec un "foreground service" peut
le garantir à 100%. À confirmer par un test réel de Thibault en conditions
de course (écran éteint quelques minutes).

~~Ravitaillements et points clés géolocalisés sur le parcours~~ — fait le
22/07 (points d'intérêt extraits des waypoints GPX/KML, voir plus bas).

## En réflexion : musique pendant la course (Spotify)

Deux niveaux très différents, à ne pas confondre :

1. **Une playlist unique et bien choisie** (à partir des titres likés de
   l'utilisateur, style/BPM adapté à la course à pied), que le coureur lance
   lui-même sur son téléphone à côté de l'appli. Réalisable rapidement (un
   accès Spotify est disponible côté outillage de développement), mais
   nécessite une confirmation explicite avant de créer quoi que ce soit sur
   le compte Spotify de l'utilisateur. **Proposé le 2026-07-21, décliné pour
   l'instant** ("pas maintenant").
   - Point technique découvert le 21/07 : Spotify a fermé son endpoint de
     BPM/tempo (`audio-features`) fin 2024 pour toute nouvelle application —
     un vrai tri par BPM précis n'est donc plus possible ; seul un tri par
     style/genre resterait faisable.
2. **Musique adaptative en temps réel pendant la course**, qui changerait de
   morceau selon le segment du parcours ou l'allure en cours. Ça suppose
   d'intégrer l'authentification Spotify (OAuth) et le SDK de lecture Spotify
   *dans l'appli elle-même*, avec compte Premium requis côté utilisateur —
   une brique technique à part entière, largement plus lourde que tout ce
   qui a été construit jusqu'ici. À traiter comme un projet séparé si le
   besoin se confirme, pas comme un ajout incrémental.
