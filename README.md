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
| 📱 **Manettes Smartphone** | Rejoignez en scannant le QR code. Tri auto des cartes par couleur. UI adaptative.      |
| 🤝 **Deux Équipes**        | Attribution aléatoire. Les points utilisent des poids dynamiques pour remplir la jauge.|
| 📡 **Persistance d'État**  | Supporte la reconnexion et le rafraîchissement : état (main, scores) préservé.         |
| 🦠 **Événement Virus**     | Un virus aléatoire gèle le jeu : secouez votre téléphone pour vous soigner !           |
| 🃏 **Cartes Spéciales**    | Les effets ciblent toujours l'équipe adverse (+2/+4, gel d'équipe).                   |
| 📳 **Retours Haptiques**   | L'accéléromètre et les vibrations rendent le jeu encore plus immersif.                 |
| 📈 **Popups de Score**     | Affichage des gains de score en temps réel à la position des joueurs sur le projecteur.|

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

NEON-UNO utilise un système de score pondéré dynamique. Chaque carte posée avec succès rapporte un **score flottant** calculé selon plusieurs facteurs :

**`Score Final = Base (Humain 2 / AI 1) × Palier 1 (Nombre de cartes) × Palier 2 (Variété) × Palier 3 (Série)`**

#### 1. Palier 1 : Multiplicateur de Cartes en Main
Moins vous avez de cartes, plus le score est élevé (récompense du risque).
- **1 carte** : **1.8x**
- **5-7 cartes** : **1.0x** (Base)
- **10+ cartes** : Décroît vers **~0.4x**, minimum **0.3x**.

#### 2. Palier 2 : Multiplicateur de Variété de Couleurs
Récompense les joueurs qui contrôlent une couleur spécifique. Inclut les 5 couleurs (Rouge, Bleu, Vert, Jaune, Noir).
- **1 couleur** : **1.8x**
- **2 couleurs** : **1.3x**
- **3 couleurs** : **1.0x**
- **4 couleurs** : **0.7x**
- **5 couleurs** : **0.3x**

#### 3. Palier 3 : Multiplicateur de Série de Couleur (Streak)
Pénalise le jeu répétitif de la même couleur sans stratégie.
- **Changement de couleur / 1ère carte** : **1.2x** de bonus.
- **2ème carte consécutive de même couleur** : **1.0x**.
- **5ème carte consécutive** : **~0.5x**, minimum asymptotique à **0.35x**.

**Conditions de Victoire** : La **première équipe à atteindre 100 points** gagne. Vider sa main ne fait plus gagner immédiatement, mais donne un énorme boost de points. Les joueurs continuent de jouer après avoir vidé leur main.

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
