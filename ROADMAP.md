# Roadmap — après le MVP

## Session de demain (préparé le 2026-07-22, à démarrer — pas codé ce soir)

Demande de Thibault en fin de session du 21/07, à traiter dans l'ordre
suivant :

### 1. Décision à prendre en premier : Google Play Store
Thibault veut pouvoir packager l'appli pour le Play Store (il trouve
l'installation PWA via navigateur trop compliquée). Points à trancher
ensemble avant de coder :
- Ça suppose un **compte Google Play Developer (25$, à sa charge)** et une
  **vraie soumission/revue Google (plusieurs jours)** — ni l'un ni l'autre ne
  peuvent être faits par moi.
- Ce que je *peux* préparer sans outil à installer : un paquet Android via
  **PWABuilder** (pwabuilder.com, prend notre `manifest.json` + l'URL
  hébergée), plus le fichier `assetlinks.json` nécessaire pour que
  l'appli s'ouvre en Trusted Web Activity (sans barre d'adresse).
- Une **politique de confidentialité** sera exigée par Google Play (l'appli
  utilise la position GPS) — à rédiger.
- Alternative à proposer en ouverture de session : si le blocage vient
  surtout de la confusion Chrome/Firefox déjà corrigée, vérifier d'abord que
  l'install Chrome fonctionne bien maintenant avant d'investir dans le Play
  Store (coût + délai de revue).

### 1bis. Sécurisation « by design » avant soumission au Play Store
Demande explicite de Thibault (22/07) : traiter la sécurité du code et de
l'appli comme un prérequis à la publication, pas comme un rattrapage
après coup. À couvrir avant toute soumission :
- **Politique de confidentialité** (obligatoire dès qu'une appli demande la
  position GPS) — préciser que la position n'est utilisée que localement,
  jamais transmise ni stockée ailleurs que sur l'appareil.
- **Formulaire "Data safety" du Play Console** : déclarer précisément les
  données collectées (position GPS, en local uniquement) et confirmer
  qu'aucune donnée n'est partagée avec un tiers.
- **Aucun secret/clé API en dur dans le code client** — déjà vrai
  aujourd'hui (aucun backend, aucune clé), à vérifier à nouveau si Strava/
  Google Maps/Spotify sont un jour intégrés directement dans l'appli.
- **Échappement systématique de tout contenu utilisateur avant insertion
  HTML** (nom de parcours importé, etc.) — déjà fait pour l'historique
  (`echapperHTML` dans `js/utils.js`), à systématiser sur tout nouvel écran.
- **HTTPS strict** (déjà le cas via GitHub Pages/TWA) et permissions
  minimales (seule la géolocalisation est demandée, rien d'autre).
- **Aucune dépendance externe** (zéro librairie tierce à ce jour) : réduit
  la surface de risque de supply-chain, à essayer de préserver.
- Revoir le `manifest.json` et le TWA généré (PWABuilder) pour le ciblage
  Android (targetSdkVersion) exigé par Google Play au moment de la
  soumission (les exigences évoluent, à vérifier à ce moment-là).

### 2. Tracé GPX visible dans l'interface
Actuellement seul le profil d'altitude (élévation) est affiché. Ajouter une
vue du tracé en 2D (forme du parcours vu du dessus), en réutilisant l'esprit
du profil d'altitude existant (SVG généré côté client, pas de tuiles de
carte externes — garde l'appli légère et utilisable hors-ligne). Projection
équirectangulaire simple (x = longitude ajustée par cos(latitude moyenne),
y = latitude), normalisée dans un viewBox SVG. À afficher sur l'écran
d'import (résumé du parcours) et sur l'écran de course.

### 3. Position GPS affichée sur le tracé
Sur l'écran de course, superposer un marqueur (point) qui avance sur le
tracé affiché au point 2, mis à jour à chaque nouvelle position GPS reçue
(réutiliser les mêmes paramètres de projection que le tracé statique, calculés
une fois à l'import du parcours).

### 4. Indications vocales façon copilote de rallye
Thibault veut des indications directionnelles ("vire à droite dans 150
mètres", etc.), pas seulement des infos de rythme/dénivelé. Nécessite :
- Calcul du cap (bearing) entre points GPX consécutifs.
- Détection des changements de direction significatifs à venir (seuils :
  léger ~35°, virage ~70°, épingle >120°), en lissant le bruit GPS sur une
  fenêtre de quelques dizaines de mètres — même principe que
  `chercherMonteeAVenir` dans `js/gpx.js`, à dupliquer/adapter pour les
  virages (ex. nouvelle fonction `chercherVirageAVenir`).
- Nouvelle banque de phrases dans `js/coach.js` (`phraseVirage`), avec un
  vocabulaire façon copilote ("tout schuss", "épingle", "vire à
  gauche/droite").
- Même logique de cooldown que les montées (ne pas répéter le même virage,
  ne pas spammer si plusieurs virages rapprochés).

### 5. Point ouvert — message coupé
Le dernier message de Thibault se terminait par "et aussi" sans suite : lui
redemander en début de session s'il avait une 5ᵉ chose en tête.

### 6. Historique des courses
Actuellement rien n'est conservé après l'écran de résumé (retour à zéro).
Ajouter un historique local des courses terminées (date, parcours, distance,
durée, allure moyenne, D+) — stocké en `localStorage` puisqu'il n'y a pas de
backend, avec un nouvel écran pour consulter les courses passées. Réfléchir
demain à la structure de données et à une éventuelle limite de taille
(purger les plus anciennes après N courses, `localStorage` n'étant pas
illimité).

### 7. Import de parcours via Google Maps (pas seulement un fichier GPX)
Thibault veut pouvoir indiquer un tracé à suivre à partir de Google Maps,
sans forcément passer par un export GPX. Plusieurs pistes à évaluer demain,
avec des compromis très différents :
- **Coller un lien d'itinéraire Google Maps** et en extraire les points :
  fragile (le format des URL Google Maps n'est pas une API stable, change
  selon la plateforme/version, et les itinéraires courts ne portent pas
  toujours le tracé complet dans l'URL).
- **API Google Maps Directions/Routes** : plus fiable, mais demande une clé
  API Google, une facturation potentielle au-delà d'un quota gratuit, et une
  dépendance réseau (contraire à l'esprit "hors-ligne" actuel de l'appli).
- **Import d'un fichier KML/KMZ** (export natif de Google Maps/My Maps) en
  plus du GPX : probablement le compromis le plus simple techniquement (même
  logique de parsing que `js/gpx.js`, juste un autre format XML à lire),
  sans dépendance réseau ni clé API.
Recommandation à discuter demain : commencer par le support KML/KMZ (peu
d'effort, cohérent avec l'existant), et ne considérer l'API Google Maps que
si le besoin de coller un lien directement s'avère essentiel.

## Déjà identifié (V2/V3)
- Audio en arrière-plan, écran éteint, téléphone en poche.
- Ravitaillements et points clés géolocalisés sur le parcours.

## Fait — coaching prédictif basé sur Strava (2026-07-21)

Le coach vocal sait maintenant dire, en cas de retard, si c'est *rattrapable
ou non* compte tenu du dénivelé restant sur le parcours et du profil de
performance réel de Thibault (voir [`js/profil.js`](js/profil.js), calculé à
partir de ses zones d'allure Strava et de son ratio vitesse/dénivelé observé
sur des sorties en montagne). Pas d'intégration Strava en direct dans
l'appli (pas d'OAuth ni de backend) : les données ont été récupérées une
fois via un accès Strava disponible côté outillage de développement, puis
figées dans `js/profil.js`. À recalculer manuellement si le profil de forme
évolue nettement.

## En réflexion : musique pendant la course (Spotify)

Deux niveaux très différents, à ne pas confondre :

1. **Une playlist unique et bien choisie** (à partir des titres likés de
   l'utilisateur, style/BPM adapté à la course à pied), que le coureur lance
   lui-même sur son téléphone à côté de l'appli. Réalisable rapidement (un
   accès Spotify est disponible côté outillage de développement), mais
   nécessite une confirmation explicite avant de créer quoi que ce soit sur
   le compte Spotify de l'utilisateur. **Proposé le 2026-07-21, décliné pour
   l'instant** ("pas maintenant").
2. **Musique adaptative en temps réel pendant la course**, qui changerait de
   morceau selon le segment du parcours ou l'allure en cours. Ça suppose
   d'intégrer l'authentification Spotify (OAuth) et le SDK de lecture Spotify
   *dans l'appli elle-même*, avec compte Premium requis côté utilisateur —
   une brique technique à part entière, largement plus lourde que tout ce
   qui a été construit jusqu'ici. À traiter comme un projet séparé si le
   besoin se confirme, pas comme un ajout incrémental.
