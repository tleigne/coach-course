# Cahier des charges — Coach Course

## Vision
Une application mobile qui joue le rôle d'un coach de course dans l'oreille du
coureur. À partir du parcours (trace GPX), des performances de l'utilisateur et
d'un objectif choisi, elle guide la course en temps réel par la voix :
encouragements, gestion du timing, des ressources et du plan de course — en gros,
ce qu'une montre de sport fait, mais avec un coaching vocal plus riche et
personnalisé.

## Utilisateur
Coureurs (trail et route) qui veulent être guidés pendant l'effort sans regarder
leur écran.

## Décisions techniques verrouillées
- Cible : Android.
- Format : PWA (Progressive Web App), installable via « Ajouter à l'écran
  d'accueil » sur Android Chrome — zéro store, zéro signature.
- Stack : HTML + CSS + JavaScript vanilla (modules ES natifs), aucun bundler.
- manifest.json + service worker + icônes pour l'installabilité et le
  fonctionnement hors-ligne.
- Hébergement HTTPS obligatoire : le GPS (Geolocation API) et la synthèse
  vocale (Web Speech API) ne fonctionnent que sur une page sécurisée. Déployé
  sur GitHub Pages.

## Périmètre du MVP (livré)
1. Import d'une trace GPX → distance, dénivelé (D+/D-), profil du parcours.
2. Choix d'un objectif avant le départ (temps cible, allure cible, ou « gérer
   l'effort »).
3. Suivi GPS en temps réel (position, distance parcourue, allure instantanée).
4. Coaching vocal en français : encouragements, avance/retard par rapport à
   l'objectif, rappels (montée à venir, hydratation).
5. Interface simple et lisible en course (gros chiffres, thème sombre).

## Hors périmètre du MVP (voir ROADMAP.md pour le détail)
- Connexion à l'API Strava.
- Contrôle de musique / playlist adaptative.
- Audio en arrière-plan écran éteint.
- Conseils personnalisés basés sur l'historique de performance.

## Principe directeur
Livrer vite quelque chose de réel et d'utile, puis enrichir. Chaque version
doit tourner sur le téléphone de l'utilisateur avant d'ajouter la suivante.
