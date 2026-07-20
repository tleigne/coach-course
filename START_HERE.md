# À LIRE EN PREMIER — Thibault

Ce dossier est le « poste de commande » de ton projet. Il ne contient pas encore
l'appli : il contient les instructions qui vont permettre à Claude Code de la
construire quasiment tout seul.

## Ce qu'il y a dans ce dossier
- **CLAUDE.md** → les instructions que Claude Code lit automatiquement à chaque
  démarrage. C'est ce qui pilote la construction. (Ne le supprime pas.)
- **PROJECT_BRIEF.md** → la vision complète du projet (le MVP et la suite).
- **.gitignore** → un fichier technique pour garder ton dépôt Git propre.
  Tu n'as rien à y faire.
- **START_HERE.md** → ce fichier.

## Ce que tu dois faire (dans l'ordre)

**1. Range ces fichiers.** Crée un dossier pour ton projet (ex. `appli-course`)
et mets ces 4 fichiers dedans, à la racine.

**2. Initialise Git.** Ouvre un terminal dans ce dossier et tape :
```
git init
git add .
git commit -m "Point de départ du projet"
```

**3. Lance Claude Code dans ce dossier :**
- En terminal : tape la commande  `claude`
- OU dans l'application Claude (bureau) : onglet **Code**, puis ouvre ce dossier.

> Important : ça doit être **Claude Code** (terminal) ou l'**onglet Code** de
> l'app — PAS le chat ni Cowork, qui ne lisent pas le fichier CLAUDE.md.

**4. Donne le coup d'envoi.** Une fois Claude Code lancé dans le dossier,
écris-lui simplement :
```
Lis CLAUDE.md et PROJECT_BRIEF.md, puis construis et livre-moi le MVP en suivant
ces instructions. Travaille de façon autonome et ne me pose que les questions
vraiment bloquantes.
```

**5. Laisse-le travailler.** Il va peut-être te poser 1 ou 2 questions (ex. ton
temps ou ton allure cible habituels). Réponds simplement. Pour le reste, il
décide et avance.

**6. Installe l'appli sur ton téléphone.** À la fin, il te donnera l'adresse
(https) de ton appli et t'expliquera comment l'« ajouter à l'écran d'accueil »
de ton Android. Suis ces étapes sur ton téléphone.

## Bon à savoir
- Ne t'inquiète pas des termes techniques : Claude Code fait le travail. Ton job,
  c'est de répondre à ses rares questions et de tester l'appli sur ton téléphone.
- Si quelque chose ne marche pas, dis-le-lui en langage normal (« l'appli ne
  parle pas », « le GPS ne démarre pas ») — il corrigera.
- Pour ce MVP, l'import du parcours se fait avec un fichier GPX (pas encore
  Strava) et il n'y a pas encore de musique adaptative : c'est volontaire, pour
  aller vite. Ça viendra après.
