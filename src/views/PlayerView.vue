<template>
  <!-- Login Screen -->
  <div v-if="screen === 'login'" class="screen active">
    <h1 style="color:#F572F7;text-shadow:0 0 15px #F572F7;margin-bottom:50px;">NEON-UNO</h1>
    <input
      v-model="usernameInput"
      type="text"
      placeholder="Pseudo"
      maxlength="12"
      autocomplete="off"
      @keyup.enter="joinGame"
    />
    <button @click="joinGame">REJOINDRE LA PARTIE</button>
  </div>

  <!-- Waiting Screen (joined during active game) -->
  <div v-if="screen === 'waiting'" class="screen active waiting-screen">
    <h1 style="color:#F572F7;text-shadow:0 0 15px #F572F7;margin-bottom:20px;">NEON-UNO</h1>
    <div class="waiting-icon">⏳</div>
    <h2 style="color:#72EFF9;text-shadow:0 0 10px #72EFF9;margin:20px 0 10px;">Partie en cours…</h2>
    <p style="color:#aaa;font-size:1.1rem;max-width:280px;line-height:1.5;text-align:center;">
      Une partie est déjà en cours.<br/>Vous rejoindrez automatiquement<br/><strong style="color:white;">la prochaine partie</strong> !
    </p>
    <div class="waiting-team-badge" :style="{ borderColor: teamColor, boxShadow: '0 0 12px ' + teamColor, color: teamColor }">
      Équipe : {{ myTeam === 'blue' ? '🟦 BLEUE' : '🟣 ROSE' }}
    </div>
  </div>

  <!-- Game Over Screen -->
  <div v-if="screen === 'gameover'"
    style="position:fixed;top:0;left:0;width:100%;height:100vh;background:rgba(0,0,0,0.95);z-index:1000;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:20px;box-sizing:border-box;">
    <h1 :style="{ fontSize: '3rem', color: gameOverColor, textShadow: '0 0 15px ' + gameOverColor }">{{ gameOverText }}</h1>
    <p style="font-size:1.5rem;color:#aaa;margin-top:20px;text-align:center;">Regardez l'écran géant pour voir les résultats et relancer.</p>
  </div>

  <!-- Game Screen -->
  <div v-if="screen === 'game'" id="game-ui">
    <div class="sidebar">
      <div class="header" :style="{ color: teamColor, textShadow: '0 0 10px ' + teamColor }">
        {{ username }}
      </div>

      <button
        v-if="showUnoBtn"
        @click="sayUno"
        class="uno-btn-compact"
        :style="{ background: unoBtnColor, boxShadow: '0 0 15px ' + unoBtnColor }">
        UNO !
      </button>

      <div id="debug-log">
        {{ debugMsg }}
      </div>

      <button
        v-if="showMotionBtn"
        @click="requestMotionPermission"
        class="motion-btn-compact">
        Capteurs
      </button>

      <div class="hint"><b>SWIPE UP</b> ou <b>LANCER</b> pour jouer.<br /><b>SECOUER</b> pour piocher.</div>
    </div>

    <div class="hand-container" ref="handContainer">
      <!-- Draw card -->
      <div
        class="my-card"
        data-action="draw"
        :class="{ 'playing-out': playingOutId === 'draw' }"
        :style="{ 
          backgroundColor: '#555', 
          fontSize: '2rem',
          transform: playingOutId === 'draw' ? 'none' : (focusedCardId === 'draw' ? 'scale(1.05)' : 'scale(0.9)')
        }"
        @touchstart="onTouchStart"
        @touchend="(e) => onTouchEnd(e, null, 'draw')"
        @click="(e) => selectCard(e, 'draw')"
      >PIOCHER</div>

      <!-- Hand cards -->
      <div
        v-for="card in currentHand"
        :key="card.id"
        :data-id="card.id"
        class="my-card"
        :class="{ 'playing-out': playingOutId === card.id }"
        :style="{
          backgroundColor: colorMap[card.color],
          transform: playingOutId === card.id ? 'none' : (focusedCardId === card.id ? 'scale(1.05)' : 'scale(0.9)')
        }"
        @touchstart="onTouchStart"
        @touchend="(e) => onTouchEnd(e, card.id, 'play')"
        @click="(e) => selectCard(e, card.id)"
      >{{ card.value.toUpperCase() }}</div>
    </div>

    <!-- Attack / Freeze overlays (appended dynamically) -->
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import socket from '../socket.js'

const screen = ref('login')  // 'login' | 'game' | 'gameover'
const usernameInput = ref('')
const username = ref('')
const myTeam = ref('')
const currentHand = ref([])
const isVirus = ref(false)
const isFrozen = ref(false)
const handContainer = ref(null)

const showUnoBtn = ref(false)
const unoBtnColor = ref('#E74C3C')

const showMotionBtn = ref(false)
const debugMsg = ref('Attente des capteurs... (Si ça reste bloqué, vérifiez que vous avez autorisé, ou que la connexion HTTP n\'empêche pas l\'accès aux capteurs par iOS).')

const gameOverText = ref('FIN DE PARTIE')
const gameOverColor = ref('#F1C40F')

let virusInterval = null
let touchStartY = 0

// Selected card tracking via IntersectionObserver
const playingOutId = ref(null) // ID of card being animated away
let observer = null

const colorMap = {
  red: '#E74C3C',
  blue: '#3498DB',
  green: '#2ECC71',
  yellow: '#F1C40F',
  black: '#333'
}

const focusedCardId = ref(null) // ID of card (could be 'draw' or actual ID)
const teamColor = computed(() => myTeam.value === 'blue' ? '#3498DB' : '#F572F7')

function joinGame() {
  const val = usernameInput.value.trim()
  if (val.length > 0) {
    username.value = val
    usernameInput.value = ''
    socket.emit('join_game', username.value)
  }
}

function sayUno() {
  socket.emit('say_uno')
  unoBtnColor.value = '#2ECC71'
  if (navigator.vibrate) navigator.vibrate(50)
}

function selectCard(e, id) {
  focusedCardId.value = id
  if (e.currentTarget) {
    e.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }
}

// Touch handling
function onTouchStart(e) {
  touchStartY = e.changedTouches[0].screenY
}

function onTouchEnd(e, cardId, action) {
  if (isFrozen.value || playingOutId.value) return
  const touchEndY = e.changedTouches[0].screenY
  if (touchStartY - touchEndY > 50) {
    if (navigator.vibrate) navigator.vibrate([50, 30, 50])
    playingOutId.value = action === 'draw' ? 'draw' : cardId

    if (action === 'draw') {
      socket.emit('draw_card')
      // For draw, the card doesn't leave the hand, so reset its visual after timeout
      setTimeout(() => { if (playingOutId.value === 'draw') playingOutId.value = null }, 300)
    } else if (cardId) {
      socket.emit('play_card', cardId)
    }
  }
}

// Device motion
let lastX = 0, lastY = 0, lastTime = 0, lastShakeTime = 0

function checkDeviceMotion() {
  if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
    showMotionBtn.value = true
    debugMsg.value += '\n[iOS] Bouton d\'autorisation affiché.'
  } else {
    debugMsg.value += '\n[Non-iOS13+] Écoute directe de devicemotion.'
    window.addEventListener('devicemotion', handleMotion)
  }
}

function requestMotionPermission() {
  debugMsg.value += '\n[iOS] Demande de permission...'
  DeviceMotionEvent.requestPermission()
    .then(state => {
      debugMsg.value += '\n[iOS] Permission: ' + state
      if (state === 'granted') {
        showMotionBtn.value = false
        window.addEventListener('devicemotion', handleMotion)
      }
    })
    .catch(err => {
      debugMsg.value += '\n[Erreur iOS] ' + err
    })
}

let motionDataCount = 0

function handleMotion(event) {
  motionDataCount++
  if (motionDataCount % 10 === 0 && event.acceleration) {
    debugMsg.value = `X: ${Math.round(event.acceleration.x)} Y: ${Math.round(event.acceleration.y)} Z: ${Math.round(event.acceleration.z)}`
  }

  if (!event.acceleration) {
    if (motionDataCount === 1) debugMsg.value += '\n[!] Pas de propriété acceleration'
    return
  }
  if (event.acceleration.x === null) {
    if (motionDataCount === 1) debugMsg.value += '\n[!] Accélération nulle (besoin connexion HTTPS).'
    return
  }

  const now = Date.now()
  if (now - lastTime < 100) return

  const z = event.acceleration.z || 0
  const y = event.acceleration.y || 0
  const x = event.acceleration.x || 0

  if (y > 15 || z > 15) {
    if (now - lastTime > 1000 && focusedCardId.value) {
      lastTime = now
      const el = focusedCardId.value === 'draw' 
        ? document.querySelector('[data-action="draw"]')
        : document.querySelector(`[data-id="${focusedCardId.value}"]`)
      if (el) triggerAction(el)
    }
  }

  const deltaX = Math.abs(x - lastX)
  const deltaY = Math.abs(y - lastY)

  if (isVirus.value) {
    if (deltaX > 20 || deltaY > 20) {
      socket.emit('cure_virus')
      isVirus.value = false
      document.body.style.backgroundColor = '#2ECC71'
      if (virusInterval) clearInterval(virusInterval)
      if (navigator.vibrate) navigator.vibrate(500)
    }
    lastX = x
    lastY = y
    return
  }

  if ((deltaX > 15 && deltaY > 15) && (now - lastShakeTime > 2000)) {
    lastShakeTime = now
    if (navigator.vibrate) navigator.vibrate([30, 30, 30])
    socket.emit('draw_card')
  }

  lastX = x
  lastY = y
}

function triggerAction(el) {
  if (isFrozen.value || playingOutId.value) return
  if (navigator.vibrate) navigator.vibrate([50, 30, 50])
  
  if (el.dataset.action === 'draw') {
    playingOutId.value = 'draw'
    socket.emit('draw_card')
    setTimeout(() => { if (playingOutId.value === 'draw') playingOutId.value = null }, 300)
  } else if (el.dataset.id) {
    playingOutId.value = el.dataset.id
    socket.emit('play_card', el.dataset.id)
  }
}

function setupObserver() {
  if (observer) observer.disconnect()
  observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        if (entry.target.dataset.action === 'draw') {
          focusedCardId.value = 'draw'
        } else {
          focusedCardId.value = entry.target.dataset.id
        }
        if (navigator.vibrate) navigator.vibrate(10)
      }
    })
  }, { root: handContainer.value, threshold: 0.6 })

  handContainer.value.querySelectorAll('.my-card').forEach(c => observer.observe(c))
}

// Socket events
socket.on('joined_success', (data) => {
  myTeam.value = data.team
  if (data.gameInProgress) {
    screen.value = 'waiting'
  } else {
    screen.value = 'game'
    checkDeviceMotion()
  }
})

socket.on('game_in_progress', () => {
  if (screen.value !== 'game') {
    screen.value = 'waiting'
  }
})

socket.on('your_hand', (hand) => {
  // Transition from waiting to game when a new round starts
  if (screen.value === 'waiting') {
    screen.value = 'game'
    isFrozen.value = false
    checkDeviceMotion()
  }
  currentHand.value = hand
  showUnoBtn.value = hand.length <= 2 && hand.length > 0
  unoBtnColor.value = '#E74C3C'
  playingOutId.value = null // Clear animation state

  // Re-setup observer after hand update
  nextTick(() => {
    setupObserver()
  })
})

socket.on('card_played_rejected', () => {
  playingOutId.value = null // Fix: Reset animation if rejected
  if (navigator.vibrate) navigator.vibrate([100, 50, 100])
  if (handContainer.value) {
    handContainer.value.style.borderColor = 'red'
    setTimeout(() => { if (handContainer.value) handContainer.value.style.borderColor = 'transparent' }, 500)
  }
})

socket.on('virus_event', () => {
  isVirus.value = true
  document.body.style.backgroundColor = '#E74C3C'
  if (navigator.vibrate) {
    virusInterval = setInterval(() => navigator.vibrate([100, 50, 100, 50]), 500)
  }
})

socket.on('virus_resolved', () => {
  isVirus.value = false
  document.body.style.backgroundColor = '#0b0f19'
  if (virusInterval) clearInterval(virusInterval)
})

socket.on('game_over', (data) => {
  if (virusInterval) clearInterval(virusInterval)
  isFrozen.value = true
  screen.value = 'gameover'
  const color = data.team === 'blue' ? '#3498DB' : '#F572F7'
  gameOverColor.value = color
  if (data.winner === username.value) {
    gameOverText.value = 'VOUS AVEZ GAGNÉ !'
  } else {
    gameOverText.value = `VICTOIRE DE\n${data.winner}`
  }
  if (navigator.vibrate) navigator.vibrate([300, 100, 300, 100, 300])
})

socket.on('game_started', () => {
  if (screen.value === 'gameover') {
    screen.value = 'game'
    isFrozen.value = false
  }
  // 'waiting' players will transition via 'your_hand' event
})

socket.on('attacked', (data) => {
  if (navigator.vibrate) navigator.vibrate([200, 100, 200])
  const overlay = document.createElement('div')
  overlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(231,76,60,0.8);z-index:200;display:flex;justify-content:center;align-items:center;padding:20px;box-sizing:border-box;'
  overlay.innerHTML = `<h2 style="color:white;font-size:2.5rem;text-align:center;text-shadow:0 0 10px white;">Attaqué par ${data.by} !<br>+${data.cards} Cartes</h2>`
  document.body.appendChild(overlay)
  setTimeout(() => overlay.remove(), 2500)
})

socket.on('freeze_team', (data) => {
  if (isFrozen.value) return
  isFrozen.value = true
  if (navigator.vibrate) navigator.vibrate(500)
  const overlay = document.createElement('div')
  overlay.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;background:rgba(52,152,219,0.8);z-index:200;display:flex;justify-content:center;align-items:center;padding:20px;box-sizing:border-box;'
  overlay.innerHTML = `<h2 style="color:white;font-size:3rem;text-align:center;text-shadow:0 0 15px white;">❄️ GELÉ par ${data.by} ! ❄️</h2>`
  document.body.appendChild(overlay)
  setTimeout(() => {
    if (document.body.contains(overlay)) overlay.remove()
    isFrozen.value = false
  }, 3000)
})

onUnmounted(() => {
  if (observer) observer.disconnect()
  if (virusInterval) clearInterval(virusInterval)
  window.removeEventListener('devicemotion', handleMotion)
  socket.off('joined_success')
  socket.off('game_in_progress')
  socket.off('your_hand')
  socket.off('card_played_rejected')
  socket.off('virus_event')
  socket.off('virus_resolved')
  socket.off('game_over')
  socket.off('game_started')
  socket.off('attacked')
  socket.off('freeze_team')
})
</script>

<style scoped>

.waiting-screen {
  gap: 0;
}

.waiting-icon {
  font-size: 5rem;
  animation: pulse 1s infinite alternate;
}

.waiting-team-badge {
  margin-top: 30px;
  padding: 12px 30px;
  border-radius: 30px;
  border: 2px solid;
  font-size: 1.3rem;
  font-weight: bold;
  background: rgba(255,255,255,0.05);
}


.screen {
  display: none;
  height: 100vh;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.active {
  display: flex;
}

/* Base Styles (Portrait) */
#game-ui {
  width: 100%;
  height: 100vh;
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.sidebar {
  padding: 10px;
}

.uno-btn-compact {
  padding: 10px 20px;
  color: white;
  font-weight: bold;
  font-size: 1.2rem;
  border-radius: 10px;
  border: 2px solid white;
  margin: 10px auto;
  display: block;
}

#debug-log {
  font-size: 0.7rem;
  color: #aaa;
  padding: 5px;
  height: 40px;
  overflow-y: auto;
}

.motion-btn-compact {
  display: block;
  margin: 5px auto;
  font-size: 0.9rem;
  padding: 8px;
  background: #3498DB;
  color: white;
  border: none;
  border-radius: 5px;
}

.hint {
  padding: 10px;
  color: #ccc;
  opacity: 0.8;
  font-size: 0.9rem;
  line-height: 1.4;
}

/* Landscape Overrides */
@media (orientation: landscape) {
  #game-ui {
    flex-direction: row;
  }

  .sidebar {
    width: 25%;
    height: 100%;
    border-right: 1px solid rgba(255,255,255,0.1);
    display: flex;
    flex-direction: column;
    justify-content: center;
    background: rgba(255,255,255,0.02);
  }

  .hand-container {
    padding: 0 50px;
  }

  .my-card {
    height: 180px;
    width: 120px;
    font-size: 2.2rem;
  }

  .uno-btn-compact {
    font-size: 1rem;
    padding: 8px 15px;
  }

  #debug-log {
    display: none; /* Hide debug in landscape to save space */
  }

  .hint {
    font-size: 0.7rem;
  }
}

input {
  padding: 15px;
  font-size: 1.2rem;
  border-radius: 10px;
  border: 2px solid #72EFF9;
  background: transparent;
  color: white;
  text-align: center;
  margin-bottom: 20px;
  box-shadow: 0 0 10px #72EFF9;
  width: 80%;
  max-width: 300px;
}

button {
  padding: 15px 30px;
  font-size: 1.2rem;
  border-radius: 10px;
  border: none;
  background: #F572F7;
  color: white;
  font-weight: bold;
  box-shadow: 0 0 15px #F572F7;
  cursor: pointer;
  width: 80%;
  max-width: 300px;
}

.header {
  padding: 15px 10px;
  font-size: 1.3rem;
  color: #72EFF9;
  text-shadow: 0 0 10px #72EFF9;
}

.hand-container {
  flex: 1;
  display: flex;
  align-items: center;
  width: 100%;
  overflow-x: auto;
  padding: 20px;
  box-sizing: border-box;
  gap: 15px;
  scroll-snap-type: x mandatory;
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.hand-container::-webkit-scrollbar {
  display: none;
}

.my-card {
  flex: 0 0 auto;
  width: 160px;
  height: 240px;
  border-radius: 15px;
  background-color: #E74C3C;
  border: 3px solid white;
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 3.5rem;
  font-weight: bold;
  box-shadow: 0 0 15px #000;
  transition: transform 0.2s, opacity 0.2s, width 0.3s, height 0.3s;
  user-select: none;
  scroll-snap-align: center;
}
</style>
