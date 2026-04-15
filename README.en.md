<div align="center">

# ⚡ NEON-UNO ⚡

<p>
  <img src="https://img.shields.io/badge/Node.js-18%2B-339933?logo=node.js&logoColor=white" alt="Node.js"/>
  <img src="https://img.shields.io/badge/Vue.js-3-4FC08D?logo=vue.js&logoColor=white" alt="Vue.js"/>
  <img src="https://img.shields.io/badge/Socket.io-Realtime-010101?logo=socket.io&logoColor=white" alt="Socket.io"/>
  <img src="https://img.shields.io/badge/HTTPS-SSL-FF6B6B?logo=letsencrypt&logoColor=white" alt="HTTPS"/>
</p>

| [Français](./README.md) | English | [中文](./README.zh.md) |

_A massive co-located multiplayer card game — smartphones as controllers, projector as the arena._

</div>

---

## 📖 Description

**NEON-UNO** is a co-located multiplayer experience inspired by classic UNO. Players use their own smartphones as game controllers to interact in real time with a shared large screen (projector or big monitor). With its neon aesthetic, the game randomly divides participants into two teams — **Neon Blue** 🔵 and **Neon Pink** 🟣 — competing to fill their score gauge and claim victory.

---

## ✨ Key Features

| Feature                       | Description                                                                                                                             |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| 🖥️ **Big Screen**             | Displays the game arena, current card, player distribution, score gauge and spectacular visual effects (lasers, explosions, particles). |
| 📱 **Smartphone Controllers** | Players join the game by scanning the QR Code shown on screen.                                                                          |
| 🤝 **Two Teams**              | Teams are randomly assigned. Points fill a shared gauge per team.                                                                       |
| 🦠 **Virus Event**            | A random virus freezes the game: shake your phone to cure yourself, or receive penalties!                                               |
| 🃏 **Special Cards**          | Effects always target the opposing team (+2/+4 random opponent, team freeze).                                                           |
| 📳 **Haptic Feedback**        | Accelerometer and vibrations make the experience even more immersive.                                                                   |

---

## 🎮 Game Rules

> This section describes the exact rules as implemented in the source code (`server.js`).

### 🃏 Deck Composition

The game uses a deck of **108 cards**:

| Colour                               | Cards                                                                                         |
| ------------------------------------ | --------------------------------------------------------------------------------------------- |
| 🔴 Red, 🔵 Blue, 🟢 Green, 🟡 Yellow | `0` (×1), `1`–`9` (×2 each), `+2` (×2), `Skip` (×2), `Reverse` (×2) — **25 cards per colour** |
| ⚫ Black                             | `Wild` (×4), `Wild Draw 4` (×4)                                                               |

### 🚀 Setup

1. The game starts when the host presses **Start** from the projector screen.
2. Each player receives **7 cards** in hand.
3. One card (non-black) is flipped face up in the centre — this is the **active card**.
4. Teams (Blue / Pink) are **randomly assigned** to each player when they connect.
5. The starting score is **50 points** per team (central gauge).

### ⚡ Turn Flow — "Fastest Wins!"

> **There is no turn order!** Everyone plays simultaneously. The first player to place a valid card wins the exchange.

To play a card, it must satisfy **at least one** of these conditions:

- ✅ Same **colour** as the active card
- ✅ Same **value** (or action type) as the active card
- ✅ It is a **black** card (Wild or Wild Draw 4) — always playable

If no card is suitable, the player can **shake their phone** to draw a card from the deck.

### 📊 Scoring System

Every successfully played card modifies the team gauge:

- **+2 points** for the team of the player who played the card
- **−2 points** for the opposing team

The **first team to reach 100 points** wins. If a player empties their hand before that, they also win the game individually.

### 🔮 Special Card Effects

| Card              | Effect                                                                     |
| ----------------- | -------------------------------------------------------------------------- |
| **`+2` (Draw 2)** | A **random opponent** from the opposing team draws **2 cards**.            |
| **`Wild`**        | The player chooses the next active colour.                                 |
| **`Wild Draw 4`** | The player chooses the colour **AND** a random opponent draws **4 cards**. |
| **`Skip`**        | The entire opposing team is **temporarily frozen** (for a few seconds).    |
| **`Reverse`**     | The entire opposing team is **temporarily frozen** (same effect as Skip).  |

> 💡 Played Wild cards adopt the colour chosen by the player for the rest of the round.

### 🦠 Virus Event

Every **1 to 2 minutes**, a **Virus** alert triggers without warning:

1. A **5-second** countdown starts.
2. Each player must **shake their phone** to "cure" themselves.
3. When the timer ends:
   - **Cured** players: no penalty.
   - **Uncured** players: receive **+2 penalty cards**.
4. The next Virus alert is then rescheduled randomly.

> ⚠️ Stay alert! The Virus can strike at any moment.

### 📣 UNO Rule

- When you have **only one card left**, press the **UNO** button before playing it.
- If you play your second-to-last card **without having called UNO**, you automatically receive **+2 penalty cards**.

### ♻️ Deck Refill

When the draw pile drops below **10 cards**, a brand new shuffled deck of 108 cards is automatically added. The game never stops for lack of cards.

---

## 🤖 AI Players

The host can add up to **5 AI players** from the lobby screen (via the "🤖 Add AI" button at the bottom). Each AI gets a random name followed by `[AI]` and is randomly assigned one of three personality types. **AI players contribute +1/−1 point per card played** (compared to +2/−2 for human players).

| Personality | Speed | Interval | Algorithm | Behaviour |
|---|---|---|---|---|
| **⚡ Fast** | Very fast | 1 s max | **Naive** — plays the first valid card found in hand, with no strategy at all. | Forgets to call UNO sometimes (50% chance). Rarely cures from virus (40%). |
| **⚖️ Medium** | Moderate | 1.5 s max | **Tactical** — prioritises action cards (Skip, Reverse, +2) of matching colour, then same-colour cards, then same-value cards, and saves Wild cards as a last resort. | Reliably calls UNO. Often cures from virus (70%). |
| **🧠 Smart** (_slow_) | Slow | 2.5 s max | **Intelligent** — prioritises +2 of matching colour to attack, then Skip/Reverse to freeze opponents, then plays its dominant colour (the colour it holds most of) to control the game, and reserves Wild Draw 4 and Wild cards for last. | Always calls UNO. Almost always cures from virus (95%). |

---

## 🛠️ Prerequisites

- [Node.js](https://nodejs.org/) (version **18+** recommended)

---

## 📦 Installation

1. Clone the repository and navigate to the project folder.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Generate self-signed SSL certificates (**mandatory step** — mobile browsers require HTTPS to access the accelerometer):
   ```bash
   node gen-cert.js
   ```
   _This creates `cert.pem` and `key.pem` files at the project root._

---

## 🚀 Getting Started

### Development Mode (Hot-Reload)

Run both servers in parallel in two terminals:

```bash
# Terminal 1 — WebSocket/Express server
npm run dev:server

# Terminal 2 — Vite server (Vue.js client)
npm run dev:client
```

### Production Mode

```bash
# 1. Build the Vue.js application
npm run build

# 2. Start the server
npm start
```

The game is accessible at **`https://localhost:3000`**. The local network IP is embedded in the QR Code displayed on the projector screen, allowing other devices to connect directly.

---

## 🏗️ Technologies

| Layer         | Technology                      |
| ------------- | ------------------------------- |
| **Frontend**  | Vue.js 3, Vite, Vue Router      |
| **Backend**   | Node.js, Express.js             |
| **Real-Time** | Socket.io                       |
| **Hardware**  | DeviceMotion API, Vibration API |
| **Tools**     | `qrcode`, `node-forge`          |

---

## 📂 Code Structure

```
neon_uno/
├── server.js              # Backend: UNO logic, Socket.io, Express
├── src/
│   ├── views/
│   │   ├── ProjectorView.vue  # Big screen interface (projector)
│   │   └── PlayerView.vue     # Controller interface (smartphones)
│   └── ...
├── gen-cert.js            # Local HTTPS certificate generator
└── vite.config.js         # Vite configuration
```
