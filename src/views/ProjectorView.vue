<template>
  <div id="particles-container" ref="particlesContainer"></div>
  
  <!-- Laser Beam SVG Canvas -->
  <svg id="laser-canvas" preserveAspectRatio="none">
    <line v-for="laser in lasers" :key="laser.id" 
          :x1="laser.x + '%'" :y1="laser.y + '%'" 
          x2="50%" y2="50%" 
          :stroke="laser.color" stroke-width="6" 
          stroke-linecap="round"
          class="laser-beam" />
  </svg>

  <div class="projector-container">
    <!-- Header Level -->
    <div class="top-row-header">
      <h1 class="neon-text logo-left">NEON-UNO</h1>
      
      <!-- Top VS Bar -->
      <div class="vs-bar-container">
        <div class="vs-bar-track">
          <div class="blue-fill" :style="{ width: blueRatio + '%' }"></div>
          <div class="magenta-fill" :style="{ width: (100 - blueRatio) + '%' }"></div>
        </div>
        <div class="vs-badge" :style="{ left: blueRatio + '%' }">VS</div>
      </div>

      <div id="connection-info" class="qr-right">
        <p>Scanner pour rejoindre !</p>
        <img v-if="qrCode" id="qrcode" :src="qrCode" alt="QR Code" />
        <p id="server-url">{{ serverUrl || 'Chargement de l\'URL...' }}</p>
      </div>
    </div>

    <main class="arena-main">
      <!-- Overlay Virus -->
      <div v-show="isVirus" class="overlay virus-overlay">
        <h1>⚠️ VIRUS ⚠️</h1>
        <h2>Secouez vite vos téléphones !</h2>
      </div>

      <!-- Overlay Fin de partie -->
      <div v-show="isGameOver" class="overlay gameover-overlay">
        <h1 id="winner-text" :style="{ color: 'white', textShadow: '0 0 30px ' + winnerColor }">VICTOIRE !</h1>
        <p>{{ winnerMessage }}</p>
        <button @click="restartGame" class="restart-btn">NOUVELLE PARTIE</button>
      </div>

      <!-- Sci-fi rings and deck -->
      <div id="deck-area" ref="deckAreaRef">
        <!-- Rings -->
        <div class="sci-fi-ring outer"></div>
        <div class="sci-fi-ring inner"></div>

        <button v-if="!gameStarted" @click="startGame" class="start-btn">DÉMARRER LA BATAILLE</button>

        <div v-if="cardPile.length === 0" class="card empty">UNO</div>

        <div
          v-for="(entry, index) in cardPile"
          :key="entry.id"
          class="card pile-card"
          :style="getPileCardStyle(index, entry)"
        >{{ entry.card.value.toUpperCase() }}</div>
      </div>

      <!-- Distributed Players -->
      <div class="players-arena">
        <div v-for="p in positionedPlayers" :key="p.id" 
             class="player-node"
             :style="{ left: p.x + '%', top: p.y + '%' }">
          <div class="player-circle" :class="[p.team]">
            <svg class="avatar-svg" viewBox="0 0 64 64" fill="none">
              <circle cx="32" cy="24" r="12" fill="currentColor" opacity="0.9"/>
              <ellipse cx="32" cy="52" rx="18" ry="14" fill="currentColor" opacity="0.7"/>
            </svg>
          </div>
          <div class="player-name" :class="[p.team]">{{ p.username }}</div>
        </div>
      </div>
    </main>
  </div>

  <!-- Settings panel -->
  <div class="settings-panel">
    <button class="settings-toggle" @click="showSettings = !showSettings">⚙️</button>
    <div v-if="showSettings" class="settings-content">
      <label>File de cartes : <strong>{{ queueSize }}</strong></label>
      <input type="range" min="5" max="100" step="1" v-model.number="queueSize" class="settings-range" />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted, watch, computed } from 'vue'
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

// Lasers effect
const lasers = ref([])
let laserIdCount = 0

// Card pile state
const cardPile = ref([])
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

fetch('/api/server-info')
  .then(res => res.json())
  .then(data => {
    serverUrl.value = data.url
    qrCode.value = data.qrCode
  })

const blueRatio = computed(() => {
  const total = blueWidth.value + magentaWidth.value;
  if (total === 0) return 50;
  return (blueWidth.value / total) * 100;
})

function startGame() {
  socket.emit('start_game')
  gameStarted.value = true
}

function restartGame() {
  socket.emit('start_game')
  isGameOver.value = false
}

// Calculate player absolute coordinates in an arc
const positionedPlayers = computed(() => {
  const bluePlayers = Object.values(players).filter(p => p.team === 'blue')
  const magentaPlayers = Object.values(players).filter(p => p.team === 'magenta')
  const result = []

  // Spread angle limit: covering ~140 degrees of the arc.
  // We offset it slightly down (the central table is often the lower-middle focus).
  const calculateArc = (teamPlayers, isLeft) => {
    const len = teamPlayers.length
    teamPlayers.forEach((p, idx) => {
      // parameter t from 0 to 1
      const t = len === 1 ? 0.5 : idx / (len - 1)
      // angle ranges from -60deg (-PI/3) to +60deg (+PI/3)
      const angle = (t - 0.5) * Math.PI * 0.7 
      
      const rx = 35 // horizontal radius limit 35% of width
      const ry = 35 // vertical radius limit 35% of height

      let x, y
      if (isLeft) {
        x = 50 - rx * Math.cos(angle)
        y = 50 + ry * Math.sin(angle)
      } else {
        x = 50 + rx * Math.cos(angle)
        y = 50 + ry * Math.sin(angle)
      }
      result.push({ ...p, x, y })
    })
  }

  calculateArc(bluePlayers, true)
  calculateArc(magentaPlayers, false)

  return result
})

function fireLaser(username) {
  const p = positionedPlayers.value.find(pl => pl.username === username)
  if (!p) return
  
  const hxColor = p.team === 'blue' ? '#3498DB' : '#F572F7'
  const newLaser = { id: ++laserIdCount, x: p.x, y: p.y, color: hxColor }
  lasers.value.push(newLaser)
  
  setTimeout(() => {
    lasers.value = lasers.value.filter(l => l.id !== newLaser.id)
  }, 400) // remove laser after 400ms
}

function updateCenterCard(card) {
  if (cardPile.value.length > 0) {
    cardPile.value[0].rotation = (Math.random() - 0.5) * 60
    cardPile.value[0].dirAngle = Math.random() * 2 * Math.PI
  }
  cardPile.value.unshift({ id: ++cardIdCounter, card, rotation: 0, dirAngle: 0 })
  if (cardPile.value.length > queueSize.value) {
    cardPile.value = cardPile.value.slice(0, queueSize.value)
  }
}

function getPileCardStyle(index, entry) {
  const n = queueSize.value
  const maxR = deckRadius.value * 0.8
  let tx, ty, rotation, opacity, scale

  if (index === 0 || n === 0) {
    tx = 0; ty = 0; rotation = 0; opacity = 1; scale = 1
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
    p.style.bottom = '50vh'
    p.style.animation = 'flyFromCenter 1s ease-out'
    const randomX = (Math.random() - 0.5) * 500
    const randomY = (Math.random() - 0.5) * 500
    p.style.transform = `translate(${randomX}px, ${randomY}px)`
    p.style.opacity = '0'
    p.style.transition = 'all 1s'
    container.appendChild(p)
    setTimeout(() => {
      p.style.opacity = '0.8'
      p.style.transform = `translate(${randomX * 2}px, ${randomY * 2}px)`
    }, 50)
    setTimeout(() => p.remove(), 1000)
  }
}

let resizeObserver = null
function updateDeckRadius() {
  if (!deckAreaRef.value) return
  const el = deckAreaRef.value
  deckRadius.value = Math.min(el.clientWidth, el.clientHeight) / 2
}

socket.on('player_joined', (player) => {
  players[player.id] = player
})

socket.on('player_left', (playerId) => {
  delete players[playerId]
})

socket.on('game_started', (data) => {
  gameStarted.value = true
  isGameOver.value = false
  cardPile.value = []
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
  fireLaser(data.username) // Fire laser to the player!

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
/* Full screen absolute canvas for lasers */
#laser-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  pointer-events: none;
  z-index: 10;
}

.laser-beam {
  animation: laserShoot 0.4s ease-out forwards;
  filter: drop-shadow(0 0 10px currentColor);
}

@keyframes laserShoot {
  0% { stroke-dasharray: 0, 1000; opacity: 1; stroke-width: 10; }
  50% { stroke-dasharray: 200, 1000; opacity: 1; stroke-width: 6; }
  100% { stroke-dasharray: 1000, 1000; opacity: 0; stroke-width: 0; }
}

.projector-container {
  width: 100vw;
  height: 100vh;
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Header Level Layout */
.top-row-header {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100vw;
  padding: 30px 40px;
  box-sizing: border-box;
  position: relative;
  z-index: 50;
  pointer-events: none;
}

.logo-left {
  position: absolute;
  left: 40px;
  top: 30px;
  margin: 0;
  font-size: 2.2rem;
  pointer-events: auto;
}

.qr-right {
  position: absolute;
  right: 40px;
  top: 30px;
  text-align: right;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  pointer-events: auto;
}

/* VS Bar Header */
.vs-bar-container {
  width: 50%;
  max-width: 800px;
  height: 18px;
  position: relative;
  margin-top: 20px;
}

.vs-bar-track {
  width: 100%;
  height: 100%;
  display: flex;
  border-radius: 10px;
  overflow: hidden;
  background: #333;
}

.blue-fill {
  height: 100%;
  background: var(--neon-blue);
  box-shadow: 0 0 15px var(--neon-blue);
  transition: width 0.5s ease;
}

.magenta-fill {
  height: 100%;
  background: var(--neon-magenta);
  box-shadow: 0 0 15px var(--neon-magenta);
  transition: width 0.5s ease;
}

.vs-badge {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 55px;
  height: 55px;
  background: #1a1a2e;
  border-radius: 50%;
  border: 3px solid white;
  color: white;
  font-weight: 900;
  font-size: 1.5rem;
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 10;
  box-shadow: 0 0 20px white, inset 0 0 10px white;
  text-shadow: 0 0 10px white;
  transition: left 0.5s ease;
}

#qrcode {
  width: 100px;
  height: 100px;
  border: 2px solid var(--neon-blue);
  border-radius: 10px;
  padding: 5px;
  background: #0b0f19;
  margin: 5px 0;
  box-shadow: 0 0 15px var(--neon-blue);
}

#server-url {
  font-size: 1rem;
  color: var(--neon-blue);
  margin: 0;
  text-shadow: 0 0 5px var(--neon-blue);
}

/* Main Arena */
.arena-main {
  flex: 1;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
}

/* Central Deck & Rings */
#deck-area {
  width: 800px;
  height: 600px;
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 5;
}

.sci-fi-ring {
  position: absolute;
  border-radius: 50%;
  box-sizing: border-box;
  pointer-events: none;
}

.sci-fi-ring.outer {
  width: 500px;
  height: 500px;
  border: 4px dashed rgba(255, 255, 255, 0.2);
  animation: spinSlow 30s linear infinite;
  box-shadow: inset 0 0 50px rgba(114, 239, 249, 0.1);
}

.sci-fi-ring.inner {
  width: 380px;
  height: 380px;
  border: 2px solid rgba(114, 239, 249, 0.4);
  background: radial-gradient(circle, rgba(114, 239, 249, 0.1) 0%, transparent 70%);
  animation: spinSlowReverse 20s linear infinite;
  box-shadow: 0 0 30px rgba(114, 239, 249, 0.3);
}

@keyframes spinSlow { 100% { transform: rotate(360deg); } }
@keyframes spinSlowReverse { 100% { transform: rotate(-360deg); } }

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
  text-shadow: 0 0 5px white;
  box-shadow: 0 0 20px var(--neon-magenta);
}

/* Overlays */
.overlay {
  display: flex;
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 200;
  justify-content: center;
  align-items: center;
  flex-direction: column;
}

.virus-overlay { background: rgba(255,0,0,0.5); }
.virus-overlay h1 { font-size:6rem; color:white; text-shadow:0 0 30px red; animation:pulse 0.5s infinite alternate; }
.virus-overlay h2 { font-size:3rem; color:white; }

.gameover-overlay { background: rgba(0,0,0,0.85); z-index: 300; }
.gameover-overlay h1 { font-size: 6rem; margin-bottom: 0; }
.gameover-overlay p { font-size: 2rem; color: white; margin-bottom: 30px; }
.restart-btn {
  padding: 15px 40px; font-size: 2rem; background: #2ECC71; border: none;
  color: white; cursor: pointer; border-radius: 10px; box-shadow: 0 0 20px #2ECC71;
}

/* Distributed Players Node */
.players-arena {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 15;
}

.player-node {
  position: absolute;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  transition: all 0.5s ease;
}

.player-circle {
  width: 70px;
  height: 70px;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  border: 3px solid white;
  background: #1a1a2e;
}

.player-circle.blue {
  background: rgba(52, 152, 219, 0.3);
  border-color: var(--neon-blue);
  box-shadow: 0 0 18px var(--neon-blue), inset 0 0 12px rgba(52, 152, 219, 0.2);
  color: var(--neon-blue);
}

.player-circle.magenta {
  background: rgba(245, 114, 247, 0.3);
  border-color: var(--neon-magenta);
  box-shadow: 0 0 18px var(--neon-magenta), inset 0 0 12px rgba(245, 114, 247, 0.2);
  color: var(--neon-magenta);
}

.avatar-svg {
  width: 40px;
  height: 40px;
}

.player-name {
  margin-top: 12px;
  font-weight: bold;
  font-size: 1.3rem;
  background: rgba(0,0,0,0.7);
  padding: 4px 12px;
  border-radius: 12px;
}

.player-name.blue { color: var(--neon-blue); text-shadow: 0 0 5px var(--neon-blue); }
.player-name.magenta { color: var(--neon-magenta); text-shadow: 0 0 5px var(--neon-magenta); }

/* Settings panel */
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

@keyframes cardEnterFlash {
  0%   { filter: brightness(3); opacity: 0; transform: translate(-50%, -50%) scale(0.6); }
  60%  { filter: brightness(1.4); opacity: 1; transform: translate(-50%, -50%) scale(1.05); }
  100% { filter: brightness(1); opacity: 1; transform: translate(-50%, -50%) scale(1); }
}

.pile-card {
  animation: cardEnterFlash 0.45s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
</style>
