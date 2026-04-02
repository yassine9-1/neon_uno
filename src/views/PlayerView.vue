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

  <!-- Game Over Screen -->
  <div v-if="screen === 'gameover'"
    style="position:fixed;top:0;left:0;width:100%;height:100vh;background:rgba(0,0,0,0.95);z-index:1000;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:20px;box-sizing:border-box;">
    <h1 :style="{ fontSize: '3rem', color: gameOverColor, textShadow: '0 0 15px ' + gameOverColor }">{{ gameOverText }}</h1>
    <p style="font-size:1.5rem;color:#aaa;margin-top:20px;text-align:center;">Regardez l'écran géant pour voir les résultats et relancer.</p>
  </div>

  <!-- Game Screen -->
  <div v-if="screen === 'game'" id="game-ui">
    <button
      v-if="showUnoBtn"
      @click="sayUno"
      style="position:fixed;top:20px;right:20px;padding:15px 25px;color:white;font-weight:bold;font-size:1.5rem;border-radius:10px;border:3px solid white;z-index:50;"
      :style="{ background: unoBtnColor, boxShadow: '0 0 15px ' + unoBtnColor }">
      UNO !
    </button>

    <div class="header" :style="{ color: teamColor, textShadow: '0 0 10px ' + teamColor }">
      {{ username }}
    </div>

    <div id="debug-log" style="font-size:0.8rem;color:#aaa;padding:5px;height:60px;overflow-y:auto;">
      {{ debugMsg }}
    </div>

    <button
      v-if="showMotionBtn"
      @click="requestMotionPermission"
      style="display:block;margin:10px auto;font-size:1rem;padding:10px;background:#3498DB;">
      Activer Capteurs Mouvement
    </button>

    <div class="hand-container" ref="handContainer">
      <!-- Draw card -->
      <div
        class="my-card"
        data-action="draw"
        style="background-color:#555;font-size:2rem;"
        @touchstart.prevent="onTouchStart"
        @touchend.prevent="(e) => onTouchEnd(e, null, 'draw')"
      >PIOCHER</div>

      <!-- Hand cards -->
      <div
        v-for="card in currentHand"
        :key="card.id"
        class="my-card"
        :style="{ backgroundColor: colorMap[card.color] }"
        @touchstart.prevent="onTouchStart"
        @touchend.prevent="(e) => onTouchEnd(e, card.id, 'play')"
      >{{ card.value.toUpperCase() }}</div>
    </div>

    <div class="hint">Glissez vers le haut (Swipe) <b>OU</b> faites le geste de lancer pour jouer !<br />Secouez pour piocher.</div>

    <!-- Attack / Freeze overlays (appended dynamically) -->
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
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
let selectedCardElement = null
let observer = null

const colorMap = {
  red: '#E74C3C',
  blue: '#3498DB',
  green: '#2ECC71',
  yellow: '#F1C40F',
  black: '#333'
}

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

// Touch handling
function onTouchStart(e) {
  touchStartY = e.changedTouches[0].screenY
}

function onTouchEnd(e, cardId, action) {
  if (isFrozen.value) return
  const touchEndY = e.changedTouches[0].screenY
  if (touchStartY - touchEndY > 50) {
    const cardEl = e.currentTarget
    cardEl.style.transform = 'translateY(-500px) scale(0.5)'
    cardEl.style.opacity = '0'
    if (navigator.vibrate) navigator.vibrate([50, 30, 50])

    if (action === 'draw') {
      socket.emit('draw_card')
      setTimeout(() => {
        cardEl.style.transform = 'scale(1.05)'
        cardEl.style.opacity = '1'
      }, 100)
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
    if (now - lastTime > 1000 && selectedCardElement) {
      lastTime = now
      triggerAction(selectedCardElement)
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

function triggerAction(cardEl) {
  if (isFrozen.value) return
  cardEl.style.transform = 'translateY(-500px) scale(0.5)'
  cardEl.style.opacity = '0'
  if (navigator.vibrate) navigator.vibrate([50, 30, 50])

  if (cardEl.dataset.action === 'draw') {
    socket.emit('draw_card')
    setTimeout(() => {
      cardEl.style.transform = 'scale(1.05)'
      cardEl.style.opacity = '1'
    }, 100)
  } else if (cardEl.dataset.id) {
    socket.emit('play_card', cardEl.dataset.id)
  }
}

function setupObserver() {
  if (observer) observer.disconnect()
  observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        selectedCardElement = entry.target
        document.querySelectorAll('.my-card').forEach(c => c.style.transform = 'scale(0.9)')
        selectedCardElement.style.transform = 'scale(1.05)'
        if (navigator.vibrate) navigator.vibrate(10)
      }
    })
  }, { root: handContainer.value, threshold: 0.6 })

  document.querySelectorAll('.my-card').forEach(c => observer.observe(c))
}

// Socket events
socket.on('joined_success', (data) => {
  screen.value = 'game'
  myTeam.value = data.team
  checkDeviceMotion()
})

socket.on('your_hand', (hand) => {
  currentHand.value = hand
  showUnoBtn.value = hand.length <= 2 && hand.length > 0
  unoBtnColor.value = '#E74C3C'

  // Re-setup observer after hand update
  setTimeout(() => setupObserver(), 100)
})

socket.on('card_played_rejected', () => {
  if (navigator.vibrate) navigator.vibrate([100, 50, 100])
  if (handContainer.value) {
    handContainer.value.style.borderColor = 'red'
    setTimeout(() => { handContainer.value.style.borderColor = 'transparent' }, 500)
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
body {
  touch-action: none;
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
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

#game-ui {
  width: 100%;
  height: 100vh;
  position: relative;
  display: flex;
  flex-direction: column;
}

.header {
  padding: 20px;
  font-size: 1.5rem;
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
  transition: transform 0.2s, opacity 0.2s;
  user-select: none;
  scroll-snap-align: center;
}

.hint {
  position: absolute;
  bottom: 30px;
  width: 100%;
  color: #ccc;
  opacity: 0.8;
  pointer-events: none;
  text-align: center;
}
</style>
