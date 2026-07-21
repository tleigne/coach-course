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
