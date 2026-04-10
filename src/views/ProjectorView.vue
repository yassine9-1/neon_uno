<template>
  <div id="particles-container" ref="particlesContainer"></div>

  <!-- ===================== LOBBY SCREEN ===================== -->
  <div v-if="!gameStarted && !isGameOver" class="lobby">
    <!-- Top bar: title + QR code -->
    <div class="lobby-top">
      <h1 class="neon-text lobby-title">NEON-UNO</h1>
      <div class="lobby-qr-block">
        <p class="lobby-scan-label">📱 Scanner pour rejoindre</p>
        <img v-if="qrCode" class="lobby-qrcode" :src="qrCode" alt="QR Code" />
        <p class="lobby-url">{{ serverUrl }}</p>
      </div>
    </div>

    <!-- Teams area -->
    <div class="lobby-teams">
      <!-- TEAM BLUE -->
      <div
        class="team-column team-blue"
        @dragover.prevent
        @drop="onDropToTeam($event, 'blue')"
      >
        <h2 class="team-title blue-title">🟦 ÉQUIPE BLEUE</h2>
        <div class="team-player-list">
          <div
            v-for="player in bluePlayers"
            :key="player.id"
            class="lobby-player blue-player"
            draggable="true"
            @dragstart="onDragStart($event, player.id)"
          >
            {{ player.username }}
          </div>
          <div v-if="bluePlayers.length === 0" class="empty-slot">En attente…</div>
        </div>
      </div>

      <!-- Center divider -->
      <div class="lobby-divider">
        <span class="vs-text">VS</span>
      </div>

      <!-- TEAM MAGENTA -->
      <div
        class="team-column team-magenta"
        @dragover.prevent
        @drop="onDropToTeam($event, 'magenta')"
      >
        <h2 class="team-title magenta-title">🟣 ÉQUIPE ROSE</h2>
        <div class="team-player-list">
          <div
            v-for="player in magentaPlayers"
            :key="player.id"
            class="lobby-player magenta-player"
            draggable="true"
            @dragstart="onDragStart($event, player.id)"
          >
            {{ player.username }}
          </div>
          <div v-if="magentaPlayers.length === 0" class="empty-slot">En attente…</div>
        </div>
      </div>
    </div>

    <!-- Start button -->
    <div class="lobby-footer">
      <button class="start-btn" @click="startGame">
        🚀 DÉMARRER LA BATAILLE
      </button>
    </div>
  </div>

  <!-- ===================== GAME SCREEN ===================== -->
  <div v-if="gameStarted || isGameOver" class="container">
    <header>
      <h1 class="neon-text">NEON-UNO</h1>
      <div id="connection-info-small">
        <img v-if="qrCode" id="qrcode-small" :src="qrCode" alt="QR Code" />
        <p id="server-url-small">{{ serverUrl }}</p>
      </div>
    </header>

    <main>
      <!-- Jauge des équipes (Tir à la corde) -->
      <div id="team-bar-container"
        style="width:100%;height:30px;background:#333;margin-bottom:20px;border-radius:15px;overflow:hidden;display:flex;border:2px solid white;box-shadow:0 0 10px white;">
        <div id="blue-score"
          :style="{ width: blueWidth + '%', background: '#3498DB', boxShadow: '0 0 15px #3498DB', transition: 'width 0.5s' }">
        </div>
        <div id="magenta-score"
          :style="{ width: magentaWidth + '%', background: '#F572F7', boxShadow: '0 0 15px #F572F7', transition: 'width 0.5s' }">
        </div>
      </div>

      <!-- Overlay Virus -->
      <div v-show="isVirus"
        style="display:flex;position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(255,0,0,0.4);z-index:100;justify-content:center;align-items:center;flex-direction:column;">
        <h1 style="font-size:6rem;color:white;text-shadow:0 0 30px red;animation:pulse 0.5s infinite alternate;">⚠️ VIRUS ⚠️</h1>
        <h2 style="font-size:3rem;color:white;">Secouez vite vos téléphones !</h2>
      </div>

      <!-- Overlay Fin de partie -->
      <div v-show="isGameOver"
        style="display:flex;position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);z-index:200;justify-content:center;align-items:center;flex-direction:column;">
        <h1 id="winner-text"
          :style="{ fontSize: '6rem', color: 'white', textShadow: '0 0 30px ' + winnerColor }">
          {{ winnerForced ? '🛑 FIN FORCÉE' : 'VICTOIRE !' }}
        </h1>
        <p style="font-size:2rem;color:white;margin-bottom:20px;">{{ winnerMessage }}</p>
        <button @click="restartGame"
          style="padding:15px 40px;font-size:2rem;background:#2ECC71;border:none;color:white;cursor:pointer;border-radius:10px;box-shadow:0 0 20px #2ECC71;">
          NOUVELLE PARTIE
        </button>
      </div>

      <div id="deck-area">
        <div class="card center-card" :class="{ empty: !currentCard, 'animated-play': cardAnimating }"
          :style="currentCard ? { backgroundColor: colorMap[currentCard.color], borderColor: 'white' } : {}">
          {{ currentCard ? currentCard.value.toUpperCase() : 'UNO' }}
        </div>
      </div>

      <div id="players-area">
        <h2>Joueurs Connectés (<span>{{ Object.keys(players).length }}</span>)</h2>
        <div id="players-list">
          <div
            v-for="player in players"
            :key="player.id"
            class="player-avatar neon-box"
            :style="{
              borderColor: player.team === 'blue' ? '#3498DB' : '#F572F7',
              boxShadow: `0 0 10px ${player.team === 'blue' ? '#3498DB' : '#F572F7'}, inset 0 0 5px ${player.team === 'blue' ? '#3498DB' : '#F572F7'}`
            }">
            {{ player.username }}
          </div>
        </div>
      </div>

      <!-- Force end game button -->
      <div style="text-align:center;margin-top:10px;">
        <button @click="forceEndGame"
          style="padding:10px 25px;font-size:1rem;background:#E74C3C;border:none;color:white;cursor:pointer;border-radius:8px;box-shadow:0 0 15px #E74C3C;opacity:0.85;">
          🛑 FORCER LA FIN
        </button>
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import socket from '../socket.js'

const particlesContainer = ref(null)
const qrCode = ref('')
const serverUrl = ref('')
const players = reactive({})
const currentCard = ref(null)
const blueWidth = ref(50)
const magentaWidth = ref(50)
const isVirus = ref(false)
const isGameOver = ref(false)
const gameStarted = ref(false)
const winnerMessage = ref('')
const winnerColor = ref('#F1C40F')
const winnerForced = ref(false)
const cardAnimating = ref(false)

// Drag-and-drop state
let draggedPlayerId = null

const bluePlayers = computed(() => Object.values(players).filter(p => p.team === 'blue'))
const magentaPlayers = computed(() => Object.values(players).filter(p => p.team === 'magenta'))

const colorMap = {
  red: '#E74C3C',
  blue: '#3498DB',
  green: '#2ECC71',
  yellow: '#F1C40F',
  black: '#333'
}

// Fetch server info / QR code
fetch('/api/server-info')
  .then(res => res.json())
  .then(data => {
    serverUrl.value = data.url
    qrCode.value = data.qrCode
  })

function startGame() {
  socket.emit('start_game')
  gameStarted.value = true
}

function restartGame() {
  winnerForced.value = false
  isGameOver.value = false
  gameStarted.value = false
}

function forceEndGame() {
  socket.emit('force_end_game')
}

// Drag-and-drop handlers
function onDragStart(event, playerId) {
  draggedPlayerId = playerId
  event.dataTransfer.effectAllowed = 'move'
}

function onDropToTeam(event, newTeam) {
  if (!draggedPlayerId) return
  const player = players[draggedPlayerId]
  if (player && player.team !== newTeam) {
    socket.emit('change_player_team', { playerId: draggedPlayerId, newTeam })
    // Optimistic update
    players[draggedPlayerId].team = newTeam
  }
  draggedPlayerId = null
}

function updateCenterCard(card) {
  currentCard.value = card
  cardAnimating.value = false
  requestAnimationFrame(() => {
    cardAnimating.value = true
    setTimeout(() => { cardAnimating.value = false }, 600)
  })
}

function showFeedback(text, color) {
  const el = document.createElement('div')
  el.innerText = text
  el.className = 'play-feedback neon-text'
  if (color) el.style.color = color
  document.body.appendChild(el)
  setTimeout(() => el.remove(), 2000)
}

// Particle effects
let particleInterval = null
function createParticles() {
  particleInterval = setInterval(() => {
    const container = particlesContainer.value
    if (!container) return
    const p = document.createElement('div')
    p.className = 'particle'
    p.style.width = Math.random() * 10 + 5 + 'px'
    p.style.height = p.style.width
    p.style.left = Math.random() * 100 + 'vw'
    p.style.animationDuration = Math.random() * 5 + 5 + 's'
    p.style.animationDelay = Math.random() * 2 + 's'
    container.appendChild(p)
    setTimeout(() => p.remove(), 15000)
  }, 600)
}

function createExplosion() {
  const container = particlesContainer.value
  if (!container) return
  for (let i = 0; i < 15; i++) {
    const p = document.createElement('div')
    p.className = 'particle'
    p.style.width = Math.random() * 8 + 4 + 'px'
    p.style.height = p.style.width
    p.style.left = '50vw'
    p.style.bottom = '40vh'
    p.style.animation = 'flyFromBottom 1s ease-out'
    const randomX = (Math.random() - 0.5) * 500
    const randomY = (Math.random() - 0.5) * 500
    p.style.transform = `translate(${randomX}px, ${randomY}px)`
    p.style.opacity = '0'
    p.style.transition = 'all 1s'
    container.appendChild(p)
    setTimeout(() => {
      p.style.opacity = '0.8'
      p.style.transform = `translate(${randomX * 2}px, ${randomY * 2 - 200}px)`
    }, 50)
    setTimeout(() => p.remove(), 1000)
  }
}

// Socket events
socket.on('player_joined', (player) => {
  players[player.id] = player
})

socket.on('player_left', (playerId) => {
  delete players[playerId]
})

socket.on('team_changed', ({ playerId, newTeam }) => {
  if (players[playerId]) {
    players[playerId].team = newTeam
  }
})

socket.on('game_started', (data) => {
  gameStarted.value = true
  isGameOver.value = false
  updateCenterCard(data.currentCard)
  blueWidth.value = 50
  magentaWidth.value = 50
})

socket.on('card_played_success', (data) => {
  updateCenterCard(data.card)

  const b = Math.max(0, Math.min(100, data.scores.blue))
  const m = Math.max(0, Math.min(100, data.scores.magenta))
  blueWidth.value = b
  magentaWidth.value = m

  createExplosion()

  if (data.unoOupli) {
    showFeedback(`OBLI DE UNO ! +2 pour ${data.username}`, '#E74C3C')
  } else {
    showFeedback(`${data.username} a joué !`)
  }
})

socket.on('virus_event', () => {
  isVirus.value = true
})

socket.on('virus_resolved', (infectedPlayers) => {
  isVirus.value = false
  if (infectedPlayers.length > 0) {
    showFeedback(`🦠 Infectés : ${infectedPlayers.join(', ')} (+2 cartes)`, '#E74C3C')
  }
})

socket.on('game_over', (data) => {
  isGameOver.value = true
  gameStarted.value = false
  winnerForced.value = !!data.forced
  winnerMessage.value = data.forced
    ? data.winner
    : `VICTOIRE DE ${data.winner.toUpperCase()} !`
  winnerColor.value = data.team === 'blue' ? '#3498DB' : data.team === 'magenta' ? '#F572F7' : '#F1C40F'
})

onMounted(() => {
  createParticles()
})

onUnmounted(() => {
  if (particleInterval) clearInterval(particleInterval)
  socket.off('player_joined')
  socket.off('player_left')
  socket.off('team_changed')
  socket.off('game_started')
  socket.off('card_played_success')
  socket.off('virus_event')
  socket.off('virus_resolved')
  socket.off('game_over')
})
</script>

<style scoped>
/* ===== LOBBY ===== */
.lobby {
  width: 100vw;
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg-color);
  overflow: hidden;
}

.lobby-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px 40px;
  border-bottom: 2px solid var(--neon-blue);
  box-shadow: 0 0 20px rgba(114, 239, 249, 0.4);
}

.lobby-title {
  font-size: 5rem;
  margin: 0;
}

.lobby-qr-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}

.lobby-scan-label {
  margin: 0;
  font-size: 1.1rem;
  color: var(--neon-blue);
  text-shadow: 0 0 8px var(--neon-blue);
}

.lobby-qrcode {
  width: 220px;
  height: 220px;
  border: 3px solid var(--neon-blue);
  border-radius: 12px;
  padding: 6px;
  background: #0b0f19;
  box-shadow: 0 0 20px var(--neon-blue);
}

.lobby-url {
  margin: 0;
  font-size: 1rem;
  color: var(--neon-blue);
  opacity: 0.8;
}

/* Teams area */
.lobby-teams {
  flex: 1;
  display: flex;
  align-items: stretch;
  overflow: hidden;
}

.team-column {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 30px;
  transition: background 0.2s;
  min-height: 0;
}

.team-column[data-drag-over] {
  opacity: 0.8;
}

.team-blue {
  border-right: 1px solid rgba(52, 152, 219, 0.3);
  background: rgba(52, 152, 219, 0.05);
}

.team-magenta {
  background: rgba(245, 114, 247, 0.05);
}

.team-title {
  font-size: 2rem;
  margin: 0 0 20px 0;
  font-weight: bold;
  text-transform: uppercase;
  letter-spacing: 2px;
}

.blue-title {
  color: #3498DB;
  text-shadow: 0 0 15px #3498DB, 0 0 30px #3498DB;
}

.magenta-title {
  color: #F572F7;
  text-shadow: 0 0 15px #F572F7, 0 0 30px #F572F7;
}

.team-player-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 300px;
  overflow-y: auto;
  flex: 1;
}

.lobby-player {
  padding: 12px 20px;
  border-radius: 12px;
  font-size: 1.4rem;
  font-weight: bold;
  cursor: grab;
  user-select: none;
  text-align: center;
  transition: transform 0.15s, box-shadow 0.15s;
}

.lobby-player:active {
  cursor: grabbing;
  transform: scale(1.05);
}

.blue-player {
  background: rgba(52, 152, 219, 0.15);
  border: 2px solid #3498DB;
  box-shadow: 0 0 12px #3498DB;
  color: #fff;
}

.magenta-player {
  background: rgba(245, 114, 247, 0.15);
  border: 2px solid #F572F7;
  box-shadow: 0 0 12px #F572F7;
  color: #fff;
}

.empty-slot {
  color: rgba(255,255,255,0.25);
  font-style: italic;
  font-size: 1.1rem;
  text-align: center;
  padding: 10px;
}

.lobby-divider {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  flex-shrink: 0;
}

.vs-text {
  font-size: 3rem;
  font-weight: 900;
  color: white;
  text-shadow:
    0 0 10px #fff,
    0 0 20px var(--neon-magenta),
    0 0 40px var(--neon-magenta);
  animation: pulse 1.5s infinite alternate;
}

.lobby-footer {
  padding: 20px 40px;
  display: flex;
  justify-content: center;
  border-top: 2px solid rgba(255,255,255,0.1);
  background: rgba(0,0,0,0.3);
}

.start-btn {
  padding: 20px 60px;
  font-size: 2rem;
  font-weight: bold;
  border: none;
  border-radius: 15px;
  background: linear-gradient(135deg, var(--neon-magenta), #c050c0);
  color: white;
  cursor: pointer;
  box-shadow: 0 0 30px var(--neon-magenta), 0 0 60px rgba(245,114,247,0.4);
  transition: transform 0.15s, box-shadow 0.15s;
  letter-spacing: 2px;
  text-transform: uppercase;
}

.start-btn:hover {
  transform: scale(1.04);
  box-shadow: 0 0 40px var(--neon-magenta), 0 0 80px rgba(245,114,247,0.5);
}

/* ===== GAME SCREEN – small QR ===== */
#connection-info-small {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

#qrcode-small {
  width: 80px;
  height: 80px;
  border: 2px solid var(--neon-blue);
  border-radius: 6px;
  padding: 3px;
  background: #0b0f19;
}

#server-url-small {
  font-size: 0.75rem;
  color: var(--neon-blue);
  margin: 0;
  opacity: 0.7;
}
</style>

