<div align="center">

# ⚡ NEON-UNO ⚡

<p>
  <img src="https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white" alt="Node.js"/>
  <img src="https://img.shields.io/badge/Vue.js-3-4FC08D?logo=vue.js&logoColor=white" alt="Vue.js"/>
  <img src="https://img.shields.io/badge/Socket.io-Realtime-010101?logo=socket.io&logoColor=white" alt="Socket.io"/>
  <img src="https://img.shields.io/badge/HTTPS-SSL-FF6B6B?logo=letsencrypt&logoColor=white" alt="HTTPS"/>
</p>

| Français | [English](./README.en.md) | [中文](./README.zh.md) |

_Un jeu de cartes multijoueur massif et colocalisé — smartphones comme manettes, vidéoprojecteur comme arène._

</div>

---

## 📖 Description

**NEON-UNO** est une expérience de jeu colocalisée inspirée du UNO classique. Les joueurs utilisent leur propre smartphone comme manette de jeu pour interagir en temps réel avec un écran géant partagé (vidéoprojecteur ou grand moniteur). Avec son design néon, le jeu divise aléatoirement les participants en deux équipes — **Néon Bleu** 🔵 et **Néon Rose** 🟣 — qui s'affrontent pour remplir leur jauge de score et remporter la victoire.

---

## ✨ Fonctionnalités Principales

| Fonctionnalité             | Description                                                                                                                                                 |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🖥️ **Écran Géant**         | Affiche l'arène de jeu, la carte en cours, la répartition des joueurs, la jauge de score et des animations spectaculaires (lasers, explosions, particules). |
| 📱 **Manettes Smartphone** | Les joueurs rejoignent la partie en scannant simplement le QR Code affiché à l'écran.                                                                       |
| 🤝 **Deux Équipes**        | Attribution aléatoire des équipes. Les points remplissent une jauge commune par équipe.                                                                     |
| 🦠 **Événement Virus**     | Un virus aléatoire gèle le jeu : secouez votre téléphone pour vous soigner, ou recevez des pénalités !                                                      |
| 🃏 **Cartes Spéciales**    | Les effets ciblent toujours l'équipe adverse (+2/+4 adversaire aléatoire, gel d'équipe).                                                                    |
| 📳 **Retours Haptiques**   | L'accéléromètre et les vibrations rendent le jeu encore plus immersif.                                                                                      |

---

## 🎮 Règles du Jeu

> Cette section décrit les règles exactes telles qu'implémentées dans le code source (`server.js`).

### 🃏 Composition du Paquet

Le jeu utilise un paquet de **108 cartes** :

| Couleur                              | Cartes                                                                                                     |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| 🔴 Rouge, 🔵 Bleu, 🟢 Vert, 🟡 Jaune | `0` (×1), `1`–`9` (×2 chacun), `+2` (×2), `Passer` (×2), `Inversion` (×2) — soit **25 cartes par couleur** |
| ⚫ Noir                              | `Joker` (×4), `Joker +4` (×4)                                                                              |

### 🚀 Mise en Place

1. La partie démarre lorsque l'hôte appuie sur **Démarrer** depuis l'écran projecteur.
2. Chaque joueur reçoit **7 cartes** en main.
3. Une première carte (non noire) est retournée face visible au centre — c'est la **carte active**.
4. Les équipes (Bleu / Rose) sont attribuées **aléatoirement** à chaque joueur à la connexion.
5. Le score de départ est **50 points** pour chaque équipe (jauge centrale).

### ⚡ Déroulement d'un Tour — "Le Plus Rapide Gagne !"

> **Il n'y a pas d'ordre de jeu !** Tout le monde joue simultanément. Le premier joueur à poser une carte valide l'emporte.

Pour poser une carte, elle doit respecter **au moins une** de ces conditions :

- ✅ Même **couleur** que la carte active
- ✅ Même **valeur** (ou type d'action) que la carte active
- ✅ Être une carte **noire** (Joker ou Joker +4) — toujours jouable

Si aucune carte ne convient, le joueur peut **secouer son téléphone** pour piocher une carte.

### 📊 Système de Score

Chaque carte posée avec succès modifie la jauge d'équipe :

- **+2 points** pour l'équipe du joueur qui pose la carte
- **−2 points** pour l'équipe adverse

La **première équipe à atteindre 100 points** remporte la partie. Si un joueur vide sa main avant cela, il gagne aussi la partie individuellement.

### 🔮 Effets des Cartes Spéciales

| Carte                        | Effet                                                                            |
| ---------------------------- | -------------------------------------------------------------------------------- |
| **`+2` (Draw 2)**            | Un adversaire **aléatoire** de l'équipe opposée pioche **2 cartes**.             |
| **`Joker` (Wild)**           | Le joueur choisit la prochaine couleur active.                                   |
| **`Joker +4` (Wild Draw 4)** | Le joueur choisit la couleur **ET** un adversaire aléatoire pioche **4 cartes**. |
| **`Passer` (Skip)**          | Toute l'équipe adverse est **gelée** temporairement (quelques secondes).         |
| **`Inversion` (Reverse)**    | Toute l'équipe adverse est **gelée** temporairement (même effet que Passer).     |

> 💡 Les cartes Joker jouées deviennent la couleur choisie par le joueur pour la suite de la partie.

### 🦠 Événement Virus

Toutes les **1 à 2 minutes**, une alerte **Virus** se déclenche sans prévenir :

1. Un compteur de **5 secondes** démarre.
2. Chaque joueur doit **secouer son téléphone** pour se "soigner".
3. À la fin du délai :
   - Les joueurs **guéris** : aucune pénalité.
   - Les joueurs **non guéris** : reçoivent **+2 cartes** de pénalité.
4. La prochaine alerte Virus est ensuite replanifiée aléatoirement.

> ⚠️ Restez vigilants ! Le Virus peut frapper à n'importe quel moment.

### 📣 Règle UNO

- Quand il ne vous reste **plus qu'une carte**, appuyez sur le bouton **UNO** avant de la jouer.
- Si vous jouez votre avant-dernière carte **sans avoir crié UNO**, vous recevez automatiquement **+2 cartes** de pénalité.

### ♻️ Recharge du Paquet

Lorsque la pioche tombe en dessous de **10 cartes**, un nouveau paquet complet de 108 cartes mélangées est automatiquement ajouté. La partie ne s'arrête jamais par manque de cartes.

---

## 🤖 Joueurs AI

L'hôte peut ajouter jusqu'à **5 joueurs AI** depuis l'écran lobby (bouton « 🤖 Ajouter AI » en bas). Chaque AI reçoit un nom aléatoire suivi de `[AI]` et une personnalité tirée au sort parmi trois types. **Les AI contribuent +1/−1 point par carte jouée** (contre +2/−2 pour les joueurs humains).

| Personnalité | Vitesse | Intervalle | Algorithme | Comportement |
|---|---|---|---|---|
| **⚡ Rapide** (_fast_) | Très rapide | 1 s max | **Naïf** — joue la première carte valide trouvée dans sa main, sans aucune stratégie. | Oublie parfois de crier UNO (50 % de chance). Se soigne rarement du virus (40 %). |
| **⚖️ Modéré** (_medium_) | Modéré | 1.5 s max | **Tactique** — priorise les cartes action (Skip, Reverse, +2) de même couleur, puis les cartes de même couleur, puis même valeur, et garde les Jokers en dernier recours. | Crie UNO de manière fiable. Se soigne du virus souvent (70 %). |
| **🧠 Stratège** (_slow_) | Lent | 2.5 s max | **Intelligent** — priorise +2 de même couleur pour attaquer, puis Skip/Reverse pour geler l'adversaire, puis joue dans sa couleur dominante (la couleur dont il possède le plus de cartes) pour contrôler le jeu, et réserve les Joker +4 et Joker en dernier. | Crie toujours UNO. Se soigne presque toujours du virus (95 %). |

---

## 🛠️ Prérequis

- [Node.js](https://nodejs.org/) (version **18+** recommandée)

---

## 📦 Installation

1. Clonez le dépôt et placez-vous dans le dossier du projet.
2. Installez les dépendances :
   ```bash
   npm install
   ```
3. Générez les certificats SSL auto-signés (**étape obligatoire** — les navigateurs mobiles requièrent HTTPS pour accéder à l'accéléromètre) :
   ```bash
   node gen-cert.js
   ```
   _Cela crée les fichiers `cert.pem` et `key.pem` à la racine du projet._

---

## 🚀 Démarrage

### Mode Développement (Hot-Reload)

Lancez les deux serveurs en parallèle dans deux terminaux :

```bash
# Terminal 1 — Serveur WebSocket/Express
npm run dev:server

# Terminal 2 — Serveur Vite (client Vue.js)
npm run dev:client
```

### Mode Production

```bash
# 1. Compiler l'application Vue.js
npm run build

# 2. Lancer le serveur
npm start
```

Le jeu est accessible sur **`https://localhost:3000`**. L'IP réseau locale est intégrée dans le QR Code affiché à l'écran projecteur, permettant aux autres appareils de se connecter directement.

---

## 🏗️ Technologies Utilisées

| Couche         | Technologie                     |
| -------------- | ------------------------------- |
| **Frontend**   | Vue.js 3, Vite, Vue Router      |
| **Backend**    | Node.js, Express.js             |
| **Temps Réel** | Socket.io                       |
| **Matériel**   | DeviceMotion API, Vibration API |
| **Outils**     | `qrcode`, `node-forge`          |

---

## 📂 Structure du Code

```
neon_uno/
├── server.js              # Backend : logique UNO, Socket.io, Express
├── src/
│   ├── views/
│   │   ├── ProjectorView.vue  # Interface grand écran (projecteur)
│   │   └── PlayerView.vue     # Interface manette (smartphones)
│   └── ...
├── gen-cert.js            # Génération des certificats HTTPS locaux
└── vite.config.js         # Configuration Vite
```
