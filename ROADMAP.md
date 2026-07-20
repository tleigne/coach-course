# Roadmap — après le MVP

## Déjà identifié (V2/V3)
- Connexion Strava : import automatique des parcours et de l'historique de
  performances.
- Playlist adaptative (Spotify) : la musique s'adapte au profil du parcours et
  à l'intensité de l'effort.
- Audio en arrière-plan, écran éteint, téléphone en poche.
- Ravitaillements et points clés géolocalisés sur le parcours.

## En discussion : coaching prédictif (avance/retard → conseil actionnable)

Idée : quand l'appli annonce une avance ou un retard, elle doit pouvoir dire
si c'est *rattrapable ou non* compte tenu de la suite du parcours (montées
restantes, distance restante) et des capacités réelles du coureur — pas
juste annoncer un écart brut.

Ça suppose deux nouvelles sources de données :
1. **Des repères de performance passée** (ex. allure soutenable sur plat, sur
   montée, temps de récupération) — soit saisis manuellement par
   l'utilisateur, soit importés automatiquement depuis Strava.
2. **Une analyse du profil restant du parcours** (déjà en partie disponible
   via `js/gpx.js`, à étendre : cumul de D+ restant, découpage par segments).

Deux approches possibles, avec un arbitrage à trancher avant de coder :
- **Saisie manuelle simple** (ex. « mon allure confortable » + « mon allure en
  côte ») : rapide à livrer, ne dépend d'aucun compte externe, mais moins
  précis et demande un effort de saisie à l'utilisateur.
- **Connexion Strava (OAuth)** : plus précis (historique réel de sorties),
  mais ajoute une dépendance externe (inscription à l'API Strava, flux
  d'autorisation, gestion des tokens, temps de validation) — nettement plus
  lourd à mettre en place que le reste du MVP.

Recommandation : démarrer par la saisie manuelle (quelques champs simples) pour
livrer vite un coaching plus intelligent, et n'ajouter Strava qu'ensuite si le
besoin de précision le justifie.
