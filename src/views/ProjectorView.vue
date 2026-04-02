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

      <div id="deck-area">
        <button v-if="!gameStarted" @click="startGame"
          style="padding:15px 30px;font-size:1.5rem;background:var(--neon-magenta);border:none;color:white;cursor:pointer;border-radius:10px;margin-right:50px;">
          DÉMARRER LA BATAILLE
        </button>
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
    </main>
  </div>

  <!-- Feedback text (appended dynamically) -->
</template>

<script setup>
import { ref, reactive, onMounted, onUnmounted } from 'vue'
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
const cardAnimating = ref(false)

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

function updateCenterCard(card) {
  currentCard.value = card
  cardAnimating.value = false
  // Force reflow then re-enable animation
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
  winnerMessage.value = `VICTOIRE DE ${data.winner.toUpperCase()} !`
  winnerColor.value = data.team === 'blue' ? '#3498DB' : '#F572F7'
})

onMounted(() => {
  createParticles()
})

onUnmounted(() => {
  if (particleInterval) clearInterval(particleInterval)
  socket.off('player_joined')
  socket.off('player_left')
  socket.off('game_started')
  socket.off('card_played_success')
  socket.off('virus_event')
  socket.off('virus_resolved')
  socket.off('game_over')
})
</script>
