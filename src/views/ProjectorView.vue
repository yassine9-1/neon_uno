<template>
  <div id="particles-container" ref="particlesContainer"></div>
  <div class="container">
    <header>
      <h1 class="neon-text">NEON-UNO</h1>
      <div id="connection-info">
        <p>Scanner pour rejoindre !</p>
        <img v-if="qrCode" id="qrcode" :src="qrCode" alt="QR Code" />
        <p id="server-url">{{ serverUrl || 'Chargement de l\'URL...' }}</p>
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
          VICTOIRE !
        </h1>
        <p style="font-size:2rem;color:white;margin-bottom:20px;">{{ winnerMessage }}</p>
        <button @click="restartGame"
          style="padding:15px 40px;font-size:2rem;background:#2ECC71;border:none;color:white;cursor:pointer;border-radius:10px;box-shadow:0 0 20px #2ECC71;">
          NOUVELLE PARTIE
        </button>
      </div>

      <div id="deck-area" ref="deckAreaRef">
        <button v-if="!gameStarted" @click="startGame" class="start-btn">
          DÉMARRER LA BATAILLE
        </button>

        <!-- Empty pile placeholder -->
        <div v-if="cardPile.length === 0" class="card empty">UNO</div>

        <!-- Card pile: index 0 = newest (top), highest z-index -->
        <div
          v-for="(entry, index) in cardPile"
          :key="entry.id"
          class="card pile-card"
          :style="getPileCardStyle(index, entry)"
        >{{ entry.card.value.toUpperCase() }}</div>
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
    </main>
  </div>

  <!-- Settings panel (bottom-right corner) -->
  <div class="settings-panel">
    <button class="settings-toggle" @click="showSettings = !showSettings">⚙️</button>
    <div v-if="showSettings" class="settings-content">
      <label>File de cartes : <strong>{{ queueSize }}</strong></label>
      <input
        type="range"
        min="5"
        max="100"
        step="1"
        v-model.number="queueSize"
        class="settings-range"
      />
    </div>
  </div>

  <!-- Feedback text (appended dynamically) -->
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, watch } from 'vue'
import socket from '../socket.js'

const particlesContainer = ref(null)
const deckAreaRef = ref(null)
const qrCode = ref('')
const serverUrl = ref('')
const players = reactive({})
const blueWidth = ref(50)
const magentaWidth = ref(50)
const isVirus = ref(false)
const isGameOver = ref(false)
const gameStarted = ref(false)
const winnerMessage = ref('')
const winnerColor = ref('#F1C40F')

// Card pile state
const cardPile = ref([])   // [{ id, card, rotation, dirAngle }, ...] — index 0 = newest (top)
const queueSize = ref(30)
const deckRadius = ref(300)
const showSettings = ref(false)
let cardIdCounter = 0

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
  socket.emit('start_game')
  isGameOver.value = false
}

/**
 * Add a new card to the top of the pile.
 * The card that was previously on top transitions to index 1
 * and receives a random rotation + random scatter direction.
 */
function updateCenterCard(card) {
  // Assign rotation and scatter direction to the current top card (it is being pushed down)
  if (cardPile.value.length > 0) {
    cardPile.value[0].rotation = (Math.random() - 0.5) * 60   // –30° to +30°
    cardPile.value[0].dirAngle = Math.random() * 2 * Math.PI  // 0–360°
  }

  // Place the new card on top
  cardPile.value.unshift({ id: ++cardIdCounter, card, rotation: 0, dirAngle: 0 })

  // Trim pile to the configured queue size
  if (cardPile.value.length > queueSize.value) {
    cardPile.value = cardPile.value.slice(0, queueSize.value)
  }
}

/**
 * Compute the CSS style for a card at `index` in the pile.
 *
 * Displacement formula (log-based):
 *   distance(n) = maxRadius * 0.8 * log(1 + n) / log(1 + queueSize)
 *
 * where n = index (0 = top, 1 = just pushed down, …, queueSize-1 = oldest).
 * The function is concave so the first push moves the card the most, and each
 * subsequent push adds a smaller increment — the pile gradually fans outward.
 */
function getPileCardStyle(index, entry) {
  const n = queueSize.value
  const maxR = deckRadius.value * 0.8

  let tx, ty, rotation, opacity, scale

  if (index === 0 || n === 0) {
    // Top card (or degenerate queue) — centred, no displacement, no rotation
    tx = 0
    ty = 0
    rotation = 0
    opacity = 1
    scale = 1
  } else {
    const distance = maxR * Math.log(1 + index) / Math.log(1 + n)
    tx = Math.cos(entry.dirAngle) * distance
    ty = Math.sin(entry.dirAngle) * distance
    rotation = entry.rotation
    opacity = Math.max(0.25, 1 - index * 0.025)
    scale = Math.max(0.75, 1 - index * 0.008)
  }

  return {
    position: 'absolute',
    left: '50%',
    top: '50%',
    transform: `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) rotate(${rotation}deg) scale(${scale})`,
    zIndex: n + 1 - index,
    backgroundColor: colorMap[entry.card.color],
    borderColor: 'white',
    boxShadow: `0 0 20px ${colorMap[entry.card.color]}`,
    opacity,
    transition: index === 0 ? 'none' : 'transform 0.55s ease-out, opacity 0.55s ease-out',
  }
}

// Trim pile when queue size is reduced in settings
watch(queueSize, (newSize) => {
  if (cardPile.value.length > newSize) {
    cardPile.value = cardPile.value.slice(0, newSize)
  }
})

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

// Measure deck area to compute max scatter radius
let resizeObserver = null
function updateDeckRadius() {
  if (!deckAreaRef.value) return
  const el = deckAreaRef.value
  deckRadius.value = Math.min(el.clientWidth, el.clientHeight) / 2
}

// Socket events
socket.on('player_joined', (player) => {
  players[player.id] = player
})

socket.on('player_left', (playerId) => {
  delete players[playerId]
})

socket.on('game_started', (data) => {
  gameStarted.value = true
  isGameOver.value = false
  cardPile.value = []  // reset pile for new game
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
  winnerMessage.value = `VICTOIRE DE ${data.winner.toUpperCase()} !`
  winnerColor.value = data.team === 'blue' ? '#3498DB' : '#F572F7'
})

onMounted(() => {
  createParticles()
  updateDeckRadius()
  resizeObserver = new ResizeObserver(updateDeckRadius)
  if (deckAreaRef.value) resizeObserver.observe(deckAreaRef.value)
})

onUnmounted(() => {
  if (particleInterval) clearInterval(particleInterval)
  if (resizeObserver) resizeObserver.disconnect()
  socket.off('player_joined')
  socket.off('player_left')
  socket.off('game_started')
  socket.off('card_played_success')
  socket.off('virus_event')
  socket.off('virus_resolved')
  socket.off('game_over')
})
</script>

<style scoped>
/* New top card entrance flash */
@keyframes cardEnterFlash {
  0%   { filter: brightness(3); opacity: 0; transform: translate(-50%, -50%) scale(0.6); }
  60%  { filter: brightness(1.4); opacity: 1; transform: translate(-50%, -50%) scale(1.05); }
  100% { filter: brightness(1); opacity: 1; transform: translate(-50%, -50%) scale(1); }
}

.pile-card {
  animation: cardEnterFlash 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.start-btn {
  position: relative;
  z-index: 9999;
  padding: 15px 30px;
  font-size: 1.5rem;
  background: var(--neon-magenta);
  border: none;
  color: white;
  cursor: pointer;
  border-radius: 10px;
}

/* Settings panel — fixed bottom-right corner */
.settings-panel {
  position: fixed;
  bottom: 16px;
  right: 16px;
  z-index: 500;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.settings-toggle {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  border: 2px solid var(--neon-blue);
  background: rgba(11, 15, 25, 0.85);
  color: white;
  font-size: 1.3rem;
  cursor: pointer;
  box-shadow: 0 0 10px var(--neon-blue);
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.settings-content {
  background: rgba(11, 15, 25, 0.9);
  border: 1px solid var(--neon-blue);
  border-radius: 10px;
  padding: 12px 16px;
  box-shadow: 0 0 15px var(--neon-blue);
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: white;
  font-size: 0.95rem;
  min-width: 200px;
}

.settings-range {
  width: 100%;
  accent-color: var(--neon-magenta);
}
</style>
