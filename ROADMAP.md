# Roadmap — après le MVP

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
