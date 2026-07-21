# Installer Coach Course sur ton téléphone Android

Ce guide est écrit pour quelqu'un qui n'a jamais fait ça. Suis les étapes dans l'ordre.

## Pourquoi une étape "mise en ligne" est nécessaire

Le GPS et la voix ne fonctionnent, dans un navigateur, que sur une adresse qui
commence par `https://` (ou sur `localhost` pour les tests sur ordinateur).
Il faut donc d'abord mettre l'application en ligne avant de l'installer sur
ton téléphone. Il y a deux façons de faire ; choisis celle qui te convient.

---

## Option A — Netlify Drop (le plus simple, sans compte)

1. Sur ton ordinateur, ouvre [https://app.netlify.com/drop](https://app.netlify.com/drop)
   dans un navigateur.
2. Ouvre l'explorateur de fichiers Windows et va dans le dossier du projet
   (`App v0.1`).
3. **Glisse-dépose tout le contenu du dossier** (tous les fichiers et dossiers :
   `index.html`, `style.css`, `manifest.json`, `sw.js`, `js`, `icons`,
   `exemples`... — pas le dossier lui-même, son contenu) sur la zone de dépôt
   du site Netlify.
4. Après quelques secondes, Netlify affiche une adresse du type
   `https://un-nom-aleatoire.netlify.app`. **C'est l'adresse de ton appli.**
5. Ouvre cette adresse sur ton téléphone Android (envoie-toi le lien par
   message, ou tape-le dans Chrome) → passe à la section **Installation sur
   Android** ci-dessous.

C'est gratuit, ça ne demande pas de compte, et ça prend deux minutes. Le seul
inconvénient : si tu perds le lien, il faudra recommencer un dépôt (ou créer
un compte Netlify gratuit pour gérer le site dans la durée).

---

## Option B — GitHub Pages (si tu as, ou veux créer, un compte GitHub)

1. Va sur [https://github.com](https://github.com) et connecte-toi (ou crée un
   compte gratuit).
2. Clique sur **New repository**. Donne-lui un nom (ex. `coach-course`),
   laisse-le en **Public**, ne coche aucune case d'initialisation, puis
   **Create repository**.
3. GitHub affiche une adresse du type
   `https://github.com/ton-nom-utilisateur/coach-course.git`. Copie-la.
4. Dis-moi cette adresse : je m'occupe d'envoyer le code dessus (commande
   `git remote add` puis `git push`).
5. Une fois le code envoyé, sur GitHub : onglet **Settings** du dépôt →
   **Pages** (menu de gauche) → dans **Branch**, choisis `main` et le dossier
   `/ (root)` → **Save**.
6. Après une minute ou deux, GitHub affiche l'adresse de ton site, du type
   `https://ton-nom-utilisateur.github.io/coach-course/`. **C'est l'adresse de
   ton appli.**
7. Ouvre cette adresse sur ton téléphone Android → passe à la section
   **Installation sur Android** ci-dessous.

---

## Installation sur Android (après avoir choisi l'option A ou B)

1. Sur ton téléphone Android, ouvre **Chrome** (pas un navigateur intégré à
   WhatsApp, Messenger ou une autre appli — ouvre bien Chrome lui-même).
2. Va sur l'adresse https de ton appli (celle obtenue à l'étape précédente).
3. Un bandeau **"Installer l'application"** doit apparaître directement en
   haut de l'appli. Appuie dessus, puis confirme dans la boîte de dialogue qui
   s'ouvre. C'est tout : une icône "Coach Course" apparaît sur ton écran
   d'accueil, comme une vraie application.

**Si le bandeau n'apparaît pas** (ça peut arriver selon la version de Chrome) :
4. Appuie sur le menu **⋮** (trois points, en haut à droite de Chrome).
5. Appuie sur **Installer l'application** (ou **Ajouter à l'écran d'accueil**).
6. Confirme.

Dans les deux cas, ouvre ensuite l'appli depuis son icône sur l'écran
d'accueil (pas depuis Chrome) : elle doit s'afficher en plein écran, sans la
barre d'adresse du navigateur. Si elle s'ouvre quand même comme une page
Chrome normale (avec la barre d'adresse visible), dis-le-moi.

## Premier lancement : autorisations à accepter

- Quand tu appuies sur **Démarrer la course**, Chrome va te demander
  l'autorisation d'accéder à ta **position**. Accepte ("Autoriser").
- Le son (la voix du coach) doit se déclencher automatiquement après cet
  appui. Si tu n'entends rien, vérifie que le téléphone n'est pas en mode
  silencieux et que le volume média est monté.

## Tester sans sortir courir

Un fichier d'exemple est fourni dans `exemples/parcours-exemple.gpx` (dans le
dossier du projet). Tu peux l'importer dans l'appli pour voir le résumé du
parcours (distance, dénivelé) sans avoir de vrai fichier GPX sous la main.
Pour tester le suivi GPS et la voix en conditions réelles, il faut en revanche
sortir marcher ou courir avec le téléphone.

## En cas de souci

Dis-le-moi simplement en langage courant : "l'appli ne parle pas", "le GPS ne
démarre pas", "l'écran reste bloqué"... je corrigerai.
