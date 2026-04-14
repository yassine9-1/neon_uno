# NEON-UNO

## Description
NEON-UNO est un jeu de cartes (inspiré du Uno) multijoueur massif et colocalisé. Les joueurs utilisent leur propre smartphone comme manette de jeu pour interagir en temps réel avec un écran géant partagé (vidéoprojecteur ou grand moniteur). Avec son design néon, le jeu divise aléatoirement les joueurs en deux équipes (Néon Bleu et Néon Rose) qui s'affrontent pour remporter la victoire.

## Fonctionnalités Principales
- **Écran Géant (Projecteur)** : Affiche l'arène de jeu, la carte en cours, la répartition des joueurs, la jauge globale de score et des animations visuelles spectaculaires (lasers, explosions, particules).
- **Manettes sur Smartphone** : Les joueurs rejoignent la partie en scannant simplement le QR Code affiché à l'écran. L'application mobile utilise les capteurs du téléphone (secouer pour piocher, glisser pour jouer) ainsi que des retours haptiques.
- **Bataille d'Équipes** : Les points gagnés ou perdus remplissent une jauge commune. La première équipe à 100 points l'emporte.
- **Événements "Virus"** : Un événement global aléatoire qui gèle le jeu. Tous les joueurs doivent secouer leur téléphone pour se soigner avant la fin du temps imparti, sous peine de recevoir des cartes de pénalité.
- **Cartes Spéciales** : Les actions ciblent l'équipe adverse. Les cartes +2/+4 font piocher un adversaire aléatoire, tandis que les cartes "Passer/Inversion" gèlent temporairement toute l'équipe opposée.

## Prérequis
- [Node.js](https://nodejs.org/) (version 18+ recommandée)

## Installation

1. Clonez le dépôt et placez-vous dans le dossier du projet.
2. Installez les dépendances npm :
   ```bash
   npm install
   ```
3. Générez les certificats SSL auto-signés. **C'est une étape obligatoire** car les navigateurs mobiles exigent un contexte sécurisé (`https://`) pour autoriser l'accès à l'accéléromètre (DeviceMotion) :
   ```bash
   node gen-cert.js
   ```
   *Cela créera les fichiers `cert.pem` et `key.pem` à la racine.*

## Démarrage

### Mode Développement (Hot-Reload)
Pour développer sur le projet, lancez les deux environnements en parallèle :

1. Démarrez le serveur WebSocket/Express :
   ```bash
   npm run dev:server
   ```
2. Dans un autre terminal, démarrez le serveur Vite pour le client Vue.js :
   ```bash
   npm run dev:client
   ```

### Mode Production
Pour déployer ou jouer de manière optimale sur un réseau local :

1. Construisez l'application Vue.js (génère le dossier `dist`) :
   ```bash
   npm run build
   ```
2. Lancez le serveur Node.js qui servira à la fois le jeu et l'API :
   ```bash
   npm start
   ```

Le jeu sera accessible via votre navigateur sur `https://localhost:3000` (l'IP réseau sera affichée dans la console pour que les autres appareils puissent s'y connecter).

## Technologies Utilisées
- **Frontend** : Vue.js 3, Vite, Vue Router
- **Backend** : Node.js, Express.js
- **Temps Réel** : Socket.io (Communication bidirectionnelle instantanée)
- **Matériel** : DeviceMotion API (Accéléromètre) et Vibration API
- **Outils** : `qrcode` (génération dynamique), `node-forge` (génération des clés SSL)

## Structure du Code
- `server.js` : Cœur du backend, contient la logique du Uno, la gestion des connexions Socket.io et le routage Express.
- `src/views/ProjectorView.vue` : L'interface "grand écran" destinée à être projetée.
- `src/views/PlayerView.vue` : L'interface "manette" affichée sur les téléphones des joueurs.
- `gen-cert.js` : Script utilitaire pour créer le contexte HTTPS local.
```
