# Coach Course

Application de coaching vocal pour coureurs — MVP. Importe un parcours GPX,
choisis un objectif, cours : l'appli suit ta position GPS et te guide à la
voix, en français.

## Contenu du dépôt

- [`index.html`](index.html), [`style.css`](style.css) — interface (4 écrans :
  import du parcours, choix de l'objectif, suivi de course, résumé).
- [`js/gpx.js`](js/gpx.js) — lecture d'un fichier GPX (distance, dénivelé,
  détection des montées à venir).
- [`js/geo.js`](js/geo.js) — suivi GPS temps réel (distance parcourue, allure,
  filtrage du bruit GPS).
- [`js/coach.js`](js/coach.js) — synthèse vocale en français (Web Speech API)
  et banques de phrases.
- [`js/app.js`](js/app.js) — orchestration de l'appli et logique de décision
  du coaching (quand parler, de quoi).
- [`js/utils.js`](js/utils.js) — calculs de distance, formatage des temps.
- [`manifest.json`](manifest.json), [`sw.js`](sw.js), [`icons/`](icons) — rend
  l'appli installable sur Android (PWA) et utilisable hors-ligne.
- [`exemples/parcours-exemple.gpx`](exemples/parcours-exemple.gpx) — fichier
  GPX de test (boucle de ~5 km avec une côte), pour essayer l'import sans
  avoir de vrai parcours sous la main.
- [`outils/`](outils) — scripts de développement (génération des icônes, du
  GPX d'exemple, petit serveur local pour tester sans connexion).
- [`CLAUDE.md`](CLAUDE.md), [`PROJECT_BRIEF.md`](PROJECT_BRIEF.md) — le cahier
  des charges du projet.

## Installer l'appli sur ton téléphone

Voir [`INSTALL.md`](INSTALL.md) — instructions pas à pas pour débutant,
mise en ligne (https obligatoire pour le GPS et la voix) puis installation
sur Android.

## Tester en local sur ordinateur (développement)

```
powershell -ExecutionPolicy Bypass -File outils/serveur-local.ps1
```

Puis ouvrir `http://localhost:8080` dans un navigateur. Le GPS ne fonctionnera
pas forcément sur ordinateur, mais tout le reste (import GPX, écrans,
synthèse vocale) est testable ainsi.

## Périmètre du MVP

Voir [`CLAUDE.md`](CLAUDE.md) pour le détail verrouillé. En résumé : import
GPX manuel (pas de connexion Strava), pas de musique adaptative, appli au
premier plan (écran allumé) — ces points sont prévus pour une V2.
