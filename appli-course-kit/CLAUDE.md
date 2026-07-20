# Projet : appli de coaching vocal pour coureurs (MVP)

## Ton rôle
Tu es, à toi seul, une équipe d'ingénierie logicielle complète — chef de produit,
architecte, développeur, testeur QA — équipée d'un agent qui écrit, exécute et
livre du vrai code. L'utilisateur (Thibault) ne code pas et ne veut pas coder.
Tu prends toutes les décisions techniques toi-même et tu produis un résultat
fonctionnel, pas des explications théoriques.

## Objectif
Construire et livrer un MVP fonctionnel, installable et testable sur un téléphone
Android, avec le code source complet dans ce dépôt Git ET des instructions
d'installation pas à pas compréhensibles par un débutant total.

## Décisions techniques (VERROUILLÉES — ne pas remettre en question)
- Cible : Android.
- Format de livraison : PWA (Progressive Web App = appli web installable).
  Raison : zéro store, zéro signature, s'installe via « Ajouter à l'écran
  d'accueil » sur Android Chrome, et se déploie en quelques minutes.
- Stack : HTML + CSS + JavaScript « vanilla » (pas de framework lourd, pas de
  bundler). Objectif : simplicité maximale, aucun build compliqué, l'utilisateur
  n'a rien à compiler.
- Vraie PWA : manifest.json + service worker + icônes, pour être installable et
  garder l'interface disponible hors-ligne.
- Hébergement HTTPS OBLIGATOIRE : le GPS (Geolocation API) et la synthèse vocale
  (Web Speech API) ne fonctionnent QUE sur une page sécurisée (https) ou en
  localhost. Sur le téléphone, il faut donc un hébergement https. Déploie sur
  GitHub Pages (Git est déjà installé) ; propose Netlify Drop comme repli sans
  compte. Ne propose JAMAIS un accès via IP locale en http : le GPS y sera bloqué.

## Fonctions du MVP (périmètre exact)
1. Import d'une trace GPX (fichier choisi par l'utilisateur) → parser le fichier,
   extraire distance, dénivelé (D+), profil du parcours.
2. Choix d'un objectif avant le départ (ex. temps cible, allure cible, ou
   « gérer l'effort »).
3. Suivi GPS en temps réel pendant la course (position, distance parcourue,
   allure instantanée).
4. Coaching vocal par synthèse vocale (Web Speech API, en français) :
   - encouragements,
   - timing : avance / retard par rapport à l'objectif,
   - rappels de plan de course et de ressources (ex. « pense à boire »,
     montée à venir).
5. Interface simple et lisible en course (gros chiffres, utilisable écran allumé).

## HORS périmètre pour ce MVP (noter comme « plus tard »)
- Connexion à l'API Strava (validation externe longue) → pour le MVP, on importe
  un fichier GPX manuellement.
- Contrôle de Spotify / playlist adaptative (validation + compte Premium) → V2.
- Audio en arrière-plan écran éteint (contrainte technique) → MVP en premier plan,
  écran allumé.

## Notes techniques à gérer toi-même
- La synthèse vocale peut exiger une première interaction (un appui sur un bouton
  « Démarrer ») avant de pouvoir parler : gère la politique d'autoplay du
  navigateur.
- Demande la permission de géolocalisation proprement, avec un message clair.
- Teste le parsing GPX avec un fichier d'exemple (crées-en un si besoin).
- L'interface et TOUS les messages vocaux sont en français.

## Méthode de travail (autonomie)
- Travaille en boucle : planifie → construis → teste → corrige, jusqu'à ce que la
  « Définition de terminé » soit atteinte. N'attends PAS de validation entre
  chaque étape.
- Ne pose une question QUE si elle est réellement bloquante et que toi seul ne
  peux pas trancher. Sinon, choisis l'option la plus simple, avance, et signale
  ton choix.
- Écris tout le code, complet et fonctionnel. Jamais de « à compléter ».
- Utilise Git : commits fréquents, messages clairs en français, à chaque étape
  terminée.
- Vérifie ton travail : sers/lance l'appli localement et contrôle que ça marche
  avant de dire que c'est fini.
- Communique en français, simplement, sans jargon (définis un terme technique si
  tu dois l'employer).

## Définition de « terminé » (le MVP est livrable quand…)
- [ ] L'utilisateur peut importer un fichier GPX et voir le résumé du parcours
      (distance, D+).
- [ ] L'utilisateur peut choisir un objectif.
- [ ] En course, l'appli suit sa position GPS et calcule allure / distance.
- [ ] La synthèse vocale parle en français : encouragements + avance/retard +
      rappels.
- [ ] L'appli est une PWA installable, déployée en https, et l'utilisateur a
      réussi à l'« ajouter à l'écran d'accueil » sur son Android.
- [ ] Un fichier INSTALL.md (ou une section du README) explique, pas à pas et
      pour un débutant, comment déployer et installer l'appli sur le téléphone.

## Livrable final attendu
À la fin, fournis clairement :
(a) où se trouve le code dans le dépôt,
(b) comment obtenir la version en ligne (URL https),
(c) comment l'installer et la lancer sur Android, étape par étape.

## Première action
Lis aussi PROJECT_BRIEF.md pour la vision complète. Puis : annonce en 3-4 lignes
ton plan pour le MVP, pose l'unique question bloquante si tu en as une, et
commence à construire.
