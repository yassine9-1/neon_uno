const express = require('express');
const https = require('https');
const fs = require('fs');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');
const qrcode = require('qrcode');

const app = express();

// Lecture du certificat généré par node-forge
const privateKey = fs.readFileSync('key.pem', 'utf8');
const certificate = fs.readFileSync('cert.pem', 'utf8');

const server = https.createServer({ key: privateKey, cert: certificate }, app);
const io = new Server(server);

// --- GAME LOGIC ---
const COLORS = ['red', 'blue', 'green', 'yellow'];
const VALUES = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'skip', 'reverse', 'draw2'];
const SPECIALS = ['wild', 'wild_draw4'];

// --- AI NAME GENERATION ---
const AI_FIRST_NAMES = [
    'Néon', 'Pixel', 'Cyber', 'Turbo', 'Nova',
    'Blitz', 'Zappy', 'Laser', 'Cosmo', 'Volt',
    'Sparky', 'Glitch', 'Flux', 'Prism', 'Echo'
];
const AI_LAST_NAMES = [
    'Bot', 'Tron', 'Byte', 'Chip', 'Core',
    'Link', 'Node', 'Bit', 'Wave', 'Pulse',
    'Grid', 'Arc', 'Zen', 'Fox', 'Rex'
];

const AI_PERSONALITIES = ['fast', 'medium', 'slow'];
const AI_SPEED = {
    fast:   { sameColor: 2500, newColor: 4000, blackCard: 5000 },
    medium: { sameColor: 3000, newColor: 5000, blackCard: 6000 },
    slow:   { sameColor: 3500, newColor: 5500, blackCard: 6500 }
};
const MAX_AI_PLAYERS = 5;
let aiIdCounter = 0;
let aiTimers = {}; // Store AI play intervals

function generateAIName() {
    const first = AI_FIRST_NAMES[Math.floor(Math.random() * AI_FIRST_NAMES.length)];
    const last = AI_LAST_NAMES[Math.floor(Math.random() * AI_LAST_NAMES.length)];
    return `${first}${last}`;
}


let gameState = {
    deck: [],
    currentCard: null,
    players: {},
    isStarted: false,
    scores: { blue: 50.0, magenta: 50.0 }, // Changed to float
    isVirus: false,
    virusTimeout: null
};

function createDeck() {
    let deck = [];
    for (let color of COLORS) {
        deck.push({ color, value: '0', id: `${color}-0` });
        for (let i = 1; i <= 9; i++) {
            deck.push({ color, value: i.toString(), id: `${color}-${i}-a` });
            deck.push({ color, value: i.toString(), id: `${color}-${i}-b` });
        }
        for (let action of ['skip', 'reverse', 'draw2']) {
            deck.push({ color, value: action, id: `${color}-${action}-a` });
            deck.push({ color, value: action, id: `${color}-${action}-b` });
        }
    }
    for (let i = 0; i < 4; i++) {
        deck.push({ color: 'black', value: 'wild', id: `black-wild-${i}` });
        deck.push({ color: 'black', value: 'wild_draw4', id: `black-wild_draw4-${i}` });
    }
    
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    
    return deck;
}

function initGame() {
    gameState.deck = createDeck();
    // First card can't be a black wild card
    do {
        gameState.currentCard = gameState.deck.pop();
        if (gameState.currentCard.color === 'black') {
            gameState.deck.unshift(gameState.currentCard);
            gameState.currentCard = null;
        }
    } while (!gameState.currentCard);

    // Initial check for deck length just in case
    refillDeckIfNeeded();

    // Reset Game State
    gameState.scores = { blue: 50.0, magenta: 50.0 };
    gameState.isVirus = false;
    if (gameState.virusTimeout) clearTimeout(gameState.virusTimeout);

    // Give 7 cards to each connected player
    for (let playerId in gameState.players) {
        gameState.players[playerId].hand = gameState.deck.splice(0, 7);
        gameState.players[playerId].saidUno = false;
        gameState.players[playerId].cured = false;
    }
    gameState.isStarted = true;
    scheduleVirus();
    startAIPlayers();
}

function refillDeckIfNeeded() {
    // Si la pioche a moins de 10 cartes, on rajoute un paquet complet mélangé par-dessus !
    if (gameState.deck.length < 10) {
        console.log("[SERVER] Pioche presque vide. Génération d'un nouveau set de cartes...");
        let newCards = createDeck();
        gameState.deck = gameState.deck.concat(newCards);
        io.emit('deck_refilled'); // Optionnel, pour un petit feedback visuel
    }
}

function scheduleVirus() {
    if (!gameState.isStarted) return;
    // Augmentation du délai : Entre 60s et 120s (1 à 2 minutes) au lieu de 20s-40s
    const delay = 60000 + Math.random() * 60000;
    gameState.virusTimeout = setTimeout(() => {
        triggerVirus();
    }, delay);
}

// --- NEW SCORING LOGIC ---
function handCountMultiplier(n) {
    if (n <= 0) return 1.8; // Max reward for being empty-handed
    if (n <= 4) {
        // 1-4张：从 1.8 → 1.0 (非线性)
        return 1.0 + 0.8 * Math.pow((5 - n) / 4, 1.5);
    } else if (n <= 7) {
        // 5-7张：基准区，×1.0
        return 1.0;
    } else {
        // 超过7张：从 1.0 快速下降到 0.4 (10张时) 并趋近于 0.3
        return 0.3 + 0.7 * Math.exp(-(n - 7) / 1.5);
    }
}

function colorVarietyMultiplier(hand) {
    // 统计手牌的颜色种类数 (包括黑牌)
    const colorSet = new Set(hand.map(c => c.color));
    const uniqueColors = colorSet.size;

    if (uniqueColors === 0) return 1.8; // Empty hand bonus
    
    // 自定义映射：1色:1.8, 2色:1.3, 3色:1.0, 4色:0.7, 5色:0.3
    const map = {
        1: 1.8,
        2: 1.3,
        3: 1.0,
        4: 0.7,
        5: 0.3
    };
    
    return map[uniqueColors] || 0.3;
}

function sameColorStreakMultiplier(count) {
    if (count <= 1) return 1.2; // 奖励换色或开始第一张
    // count=2时为1.0, count=5时约为0.5, 趋近于0.35
    return 0.35 + 0.65 * Math.exp(-(count - 2) / 2.0);
}

// --- AI PLAY LOGIC ---

function findValidCards(hand, currentCard) {
    return hand.filter(card =>
        currentCard.color === 'black' ||
        card.color === currentCard.color ||
        card.value === currentCard.value ||
        card.color === 'black'
    );
}

// Fast AI: noob strategy — always plays same-color first (eats streak penalty)
function aiChooseCardFast(hand, currentCard) {
    const valid = findValidCards(hand, currentCard);
    if (valid.length === 0) return null;
    // Noob instinct: play first same-color card they see
    const sameColor = valid.find(c => c.color !== 'black' && c.color === currentCard.color);
    if (sameColor) return sameColor;
    // Otherwise pick randomly from the rest
    return valid[Math.floor(Math.random() * valid.length)];
}

function aiChooseColorFast() {
    return COLORS[Math.floor(Math.random() * COLORS.length)];
}

// Medium AI: prioritize action cards, then same-color, then wild
function aiChooseCardMedium(hand, currentCard) {
    const valid = findValidCards(hand, currentCard);
    if (valid.length === 0) return null;

    // 1. Prioritize action cards (skip, reverse, draw2) that match color
    const actionColorMatch = valid.find(c =>
        c.color !== 'black' &&
        ['skip', 'reverse', 'draw2'].includes(c.value) &&
        c.color === currentCard.color
    );
    if (actionColorMatch) return actionColorMatch;

    // 2. Any non-black card matching color
    const colorMatch = valid.find(c => c.color !== 'black' && c.color === currentCard.color);
    if (colorMatch) return colorMatch;

    // 3. Any non-black card matching value
    const valueMatch = valid.find(c => c.color !== 'black' && c.value === currentCard.value);
    if (valueMatch) return valueMatch;

    // 4. Wild cards last
    return valid[0];
}

function aiChooseColorMedium(hand) {
    // Choose the color the AI has most of
    const colorCounts = {};
    for (const c of hand) {
        if (c.color !== 'black') {
            colorCounts[c.color] = (colorCounts[c.color] || 0) + 1;
        }
    }
    let bestColor = 'red';
    let maxCount = 0;
    for (const color in colorCounts) {
        if (colorCounts[color] > maxCount) {
            maxCount = colorCounts[color];
            bestColor = color;
        }
    }
    return bestColor;
}

// Helper: Implicit bonus for attacking cards
function attackBonus(cardValue) {
    if (cardValue === 'draw2') return 0.3;
    if (cardValue === 'wild_draw4') return 0.5;
    return 0;
}

// Helper: Draw Option for Smart AI (pessimistic estimate)
function evaluateDrawOption(hand, currentCard, player, speedConfig) {
    const time1 = speedConfig.newColor;
    const score1 = 0;

    const score2 = 1.0
        * handCountMultiplier(hand.length + 1)
        * colorVarietyMultiplier(hand)
        * sameColorStreakMultiplier(player.consecutiveColorCount + 1); // Pessimistic: likely same color
    const time2 = speedConfig.newColor; // Pessimistic: assume color change needed

    return { score: score1 + score2, time: time1 + time2 };
}

function proPickBestColor(hand) {
    const colorScores = {};
    for (const c of hand) {
        if (c.color === 'black') continue;
        colorScores[c.color] = (colorScores[c.color] || 0) + 1;
        if (['skip', 'reverse', 'draw2'].includes(c.value)) {
            colorScores[c.color] += 0.5; 
        }
    }
    let bestColor = 'red';
    let maxScore = 0;
    for (const color in colorScores) {
        if (colorScores[color] > maxScore) {
            maxScore = colorScores[color];
            bestColor = color;
        }
    }
    return bestColor;
}

// Slow/Smart AI: maximize score rate (score / time) through color control & lookahead
function aiChooseCardSmart(hand, currentCard, player) {
    const speedConfig = AI_SPEED['slow'];

    // --- Phase 1: Candidates ---
    let candidates = findValidCards(hand, currentCard);

    // --- Phase 1.5: Pre-filter ---
    if (candidates.length > 1) {
        const nonBlack = candidates.filter(c => c.color !== 'black');
        if (nonBlack.length > 0) {
            // Keep non-black + wild_draw4 (which has attack value)
            const draw4 = candidates.filter(c => c.value === 'wild_draw4');
            candidates = [...nonBlack, ...draw4];
        }
    }

    // --- Draw as a candidate ---
    const drawOption = evaluateDrawOption(hand, currentCard, player, speedConfig);
    let bestCard = null; // null = "draw"
    let bestRate = drawOption.score / drawOption.time * 10000;

    if (candidates.length === 0) return null;

    // --- Phase 2: Evaluate Candidates ---
    for (const card of candidates) {
        const simHand = hand.filter(c => c.id !== card.id);
        const cardColor = card.color === 'black' ? proPickBestColor(simHand) : card.color;

        // Step 1: Immediate Score
        const isSameColor = (card.color !== 'black' && card.color === currentCard.color);
        const newStreak = (cardColor === player.lastPlayedColor)
            ? player.consecutiveColorCount + 1
            : 1;

        let score1 = 1.0
            * handCountMultiplier(simHand.length)
            * colorVarietyMultiplier(simHand)
            * sameColorStreakMultiplier(newStreak);
        score1 += attackBonus(card.value); 

        let time1;
        if (card.color === 'black')                  time1 = speedConfig.blackCard;
        else if (card.color === currentCard.color)    time1 = speedConfig.sameColor;
        else                                          time1 = speedConfig.newColor;

        // Step 2: Next turn lookahead
        const simCurrentCard = { color: cardColor, value: card.value };
        const nextValid = findValidCards(simHand, simCurrentCard);

        let score2 = 0;
        let time2 = speedConfig.newColor;

        if (nextValid.length > 0) {
            let bestNextRate = -Infinity;
            for (const nextCard of nextValid) {
                const simHand2 = simHand.filter(c => c.id !== nextCard.id);
                const nextColor = nextCard.color === 'black' ? proPickBestColor(simHand2) : nextCard.color;

                const nextSameColor = (nextCard.color !== 'black' && nextCard.color === cardColor);
                const nextStreak = (nextColor === cardColor) ? newStreak + 1 : 1;

                let ns = 1.0
                    * handCountMultiplier(simHand2.length)
                    * colorVarietyMultiplier(simHand2)
                    * sameColorStreakMultiplier(nextStreak);
                ns += attackBonus(nextCard.value);

                let nt;
                if (nextCard.color === 'black')              nt = speedConfig.blackCard;
                else if (nextCard.color === cardColor)        nt = speedConfig.sameColor;
                else                                          nt = speedConfig.newColor;

                const nextRate = ns / nt;
                if (nextRate > bestNextRate) {
                    bestNextRate = nextRate;
                    score2 = ns;
                    time2 = nt;
                }
            }
        }

        // Comprehensive rate
        const totalRate = (score1 + score2) / (time1 + time2) * 10000;

        if (totalRate > bestRate) {
            bestRate = totalRate;
            bestCard = card;
        }
    }

    return bestCard; 
}

function aiChooseColorByPersonality(personality, hand) {
    switch (personality) {
        case 'fast':   return aiChooseColorFast();
        case 'medium': return aiChooseColorMedium(hand);
        case 'slow':   return proPickBestColor(hand);
        default:       return aiChooseColorMedium(hand);
    }
}

function aiChooseCard(personality, hand, currentCard, player) {
    switch (personality) {
        case 'fast': return aiChooseCardFast(hand, currentCard);
        case 'medium': return aiChooseCardMedium(hand, currentCard);
        case 'slow': return aiChooseCardSmart(hand, currentCard, player);
        default: return aiChooseCardMedium(hand, currentCard);
    }
}


// ========================================
// SHARED CARD PLAY LOGIC (used by AI and human players)
// ========================================
function processPlayCard(playerId, cardId, chosenColor) {
    if (!gameState.isStarted || gameState.isVirus) return false;

    const player = gameState.players[playerId];
    if (!player) return false;
    if (player.frozen) return false;

    const cardIndex = player.hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return false;

    const cardToPlay = player.hand[cardIndex];
    const current = gameState.currentCard;

    // Validation
    const isValid =
        current.color === 'black' ||
        cardToPlay.color === current.color ||
        cardToPlay.value === current.value ||
        cardToPlay.color === 'black';

    if (!isValid) return false;

    // Remove from hand
    player.hand.splice(cardIndex, 1);

    // Update center card
    const previousColor = gameState.currentCard.color;
    if (cardToPlay.color === 'black') {
        const validColors = ['red', 'blue', 'green', 'yellow'];
        const newColor = validColors.includes(chosenColor) ? chosenColor : 'red';
        gameState.currentCard = { ...cardToPlay, color: newColor };
    } else {
        gameState.currentCard = cardToPlay;
    }

    // Reset AI timers if the pile color changed
    if (gameState.currentCard.color !== previousColor) {
        resetAITimers(player.isAI ? playerId : null);
    }

    // Same-color streak tracking
    if (gameState.currentCard.color === player.lastPlayedColor) {
        player.consecutiveColorCount++;
    } else {
        player.lastPlayedColor = gameState.currentCard.color;
        player.consecutiveColorCount = 1;
    }

    // Score calculation — differentiated by player type
    let baseScore;
    if (player.isAI) {
        const baseScoreMap = { fast: 0.7, medium: 1.0, slow: 1.3 };
        baseScore = baseScoreMap[player.aiPersonality] || 1.0;
    } else {
        baseScore = 2.0;
    }
    const finalScore = baseScore
        * handCountMultiplier(player.hand.length)
        * colorVarietyMultiplier(player.hand)
        * sameColorStreakMultiplier(player.consecutiveColorCount);

    if (player.team === 'blue') {
        gameState.scores.blue += finalScore;
        gameState.scores.magenta -= finalScore;
    } else {
        gameState.scores.magenta += finalScore;
        gameState.scores.blue -= finalScore;
    }

    // Check win
    if (gameState.scores.blue >= 100 || gameState.scores.magenta >= 100) {
        let winningTeam = gameState.scores.blue >= 100 ? 'blue' : 'magenta';
        let winMsg = `L'ÉQUIPE ${winningTeam === 'blue' ? 'NÉON BLEU' : 'NÉON ROSE'}`;
        io.emit('game_over', { winner: winMsg, team: winningTeam });
        gameState.isStarted = false;
        if (gameState.virusTimeout) clearTimeout(gameState.virusTimeout);
        stopAllAI();
        return true; // Card was played, game ended
    }

    // Special card effects
    refillDeckIfNeeded();
    let opposingTeam = player.team === 'blue' ? 'magenta' : 'blue';
    let opposingPlayers = Object.values(gameState.players).filter(p => p.team === opposingTeam);

    if (cardToPlay.value === 'draw2' || cardToPlay.value === 'wild_draw4') {
        if (opposingPlayers.length > 0) {
            let target = opposingPlayers[Math.floor(Math.random() * opposingPlayers.length)];
            let cardsToDraw = cardToPlay.value === 'draw2' ? 2 : 4;
            for (let i = 0; i < cardsToDraw; i++) {
                refillDeckIfNeeded();
                if (gameState.deck.length > 0) {
                    target.hand.push(gameState.deck.pop());
                }
            }
            if (!target.isAI) {
                io.to(target.id).emit('your_hand', target.hand);
                io.to(target.id).emit('attacked', { by: player.username, cards: cardsToDraw });
            }
        }
    } else if (cardToPlay.value === 'skip' || cardToPlay.value === 'reverse') {
        opposingPlayers.forEach(p => {
            if (p.isAI) {
                freezeAI(p.id, 3000);
            } else {
                io.to(p.id).emit('freeze_team', { by: player.username });
            }
        });
    }

    // UNO logic
    if (player.isAI) {
        // AI UNO behavior by personality
        if (player.hand.length <= 2 && player.hand.length > 0) {
            if (player.aiPersonality === 'slow' || player.aiPersonality === 'medium') {
                player.saidUno = true;
            }
            if (player.aiPersonality === 'fast' && Math.random() > 0.5) {
                player.saidUno = true;
            }
        }
    }

    let unoOupli = false;
    if (player.hand.length === 1 && !player.saidUno) {
        unoOupli = true;
        refillDeckIfNeeded();
        if (gameState.deck.length >= 2) {
            player.hand.push(gameState.deck.pop(), gameState.deck.pop());
        }
    }
    player.saidUno = false;

    // Broadcast
    io.emit('card_played_success', {
        playerId: playerId,
        username: player.username,
        card: gameState.currentCard,
        scores: gameState.scores,
        scoreGained: finalScore.toFixed(1),
        unoOupli: unoOupli
    });

    // Send updated hand to human players
    if (!player.isAI) {
        io.to(playerId).emit('your_hand', player.hand);
    }

    return true; // Card was played successfully
}

// ========================================
// AI PLAY WRAPPER (uses shared processPlayCard)
// ========================================
function aiPlayCard(aiId) {
    if (!gameState.isStarted || gameState.isVirus) return;
    const player = gameState.players[aiId];
    if (!player || !player.isAI || player.hand.length === 0) return;
    if (player.frozen) return;

    const card = aiChooseCard(player.aiPersonality, player.hand, gameState.currentCard, player);

    if (!card) {
        // Draw a card
        console.log(`[AI] ${player.username} draws | hand:${player.hand.length}`);
        if (gameState.deck.length > 0) {
            refillDeckIfNeeded();
            player.hand.push(gameState.deck.pop());
            player.saidUno = false;
        }
        return;
    }

    // Choose color for black cards
    const chosenColor = card.color === 'black'
        ? aiChooseColorByPersonality(player.aiPersonality, player.hand.filter(c => c.id !== card.id))
        : null;

    console.log(`[AI] ${player.username} plays ${card.color} ${card.value}${chosenColor ? ' → ' + chosenColor : ''} | hand:${player.hand.length - 1} streak:${player.consecutiveColorCount}`);

    processPlayCard(aiId, card.id, chosenColor);
}

function getAIDelay(playerId) {
    const player = gameState.players[playerId];
    const speedConfig = AI_SPEED[player.aiPersonality] || AI_SPEED['medium'];
    const card = aiChooseCard(player.aiPersonality, player.hand, gameState.currentCard, player);

    if (!card) return speedConfig.newColor;                              // Need to draw
    if (card.color === 'black') return speedConfig.blackCard;            // Wild card
    if (card.color === gameState.currentCard.color) return speedConfig.sameColor;  // Same color
    return speedConfig.newColor;                                         // New color
}

function scheduleAIPlay(playerId) {
    const player = gameState.players[playerId];
    if (!player || !player.isAI || !gameState.isStarted) return;
    if (player.frozen) return; // Don't schedule while frozen
    
    // Calculate delay based on what the AI would likely play
    const delay = getAIDelay(playerId);
    const jitter = Math.random() * 500;
    
    aiTimers[playerId] = setTimeout(() => {
        aiPlayCard(playerId);
        // Schedule next play after this one completes
        scheduleAIPlay(playerId);
    }, delay + jitter);
}

function freezeAI(aiId, duration) {
    const player = gameState.players[aiId];
    if (player) {
        console.log(`[AI FREEZE] ${player.username} is frozen for ${duration}ms!`);
        player.frozen = true;
    }
    if (aiTimers[aiId]) {
        clearTimeout(aiTimers[aiId]);
        delete aiTimers[aiId];
    }
    setTimeout(() => {
        if (gameState.players[aiId]) {
            gameState.players[aiId].frozen = false;
        }
        if (gameState.isStarted && gameState.players[aiId]) {
            scheduleAIPlay(aiId);
        }
    }, duration);
}

function startAIPlayers() {
    for (let playerId in gameState.players) {
        const player = gameState.players[playerId];
        if (player.isAI) {
            scheduleAIPlay(playerId);
        }
    }
}

function stopAllAI() {
    for (let timerId in aiTimers) {
        clearTimeout(aiTimers[timerId]);
    }
    aiTimers = {};
}

// Reset all AI timers (simulates "rethinking" when the pile color changes)
function resetAITimers(excludeId = null) {
    for (let playerId in aiTimers) {
        if (playerId === excludeId) continue;
        clearTimeout(aiTimers[playerId]);
        scheduleAIPlay(playerId);
    }
}

function triggerVirus() {
    if (!gameState.isStarted) return;
    gameState.isVirus = true;

    // Reset cured state
    for (let playerId in gameState.players) {
        gameState.players[playerId].cured = false;
    }

    // AI virus response: smart AIs cure quickly, medium sometimes, fast rarely
    for (let playerId in gameState.players) {
        const player = gameState.players[playerId];
        if (player.isAI) {
            let cureChance = 0;
            if (player.aiPersonality === 'slow') cureChance = 0.95;
            else if (player.aiPersonality === 'medium') cureChance = 0.7;
            else cureChance = 0.4;
            
            const delay = 1000 + Math.random() * 3000;
            setTimeout(() => {
                if (gameState.isVirus && Math.random() < cureChance) {
                    player.cured = true;
                }
            }, delay);
        }
    }

    io.emit('virus_event');

    setTimeout(() => {
        resolveVirus();
    }, 5000); // 5 secondes pour secouer
}

function resolveVirus() {
    if (!gameState.isStarted) return;
    gameState.isVirus = false;

    let infectedPlayers = [];
    for (let playerId in gameState.players) {
        let player = gameState.players[playerId];
        if (!player.cured) {
            // Penalize
            refillDeckIfNeeded();
            if (gameState.deck.length >= 2) {
                player.hand.push(gameState.deck.pop(), gameState.deck.pop());
                infectedPlayers.push(player.username);
                if (!player.isAI) {
                    io.to(player.id).emit('your_hand', player.hand);
                }
            }
        }
    }
    io.emit('virus_resolved', infectedPlayers);
    scheduleVirus(); // Schedule next virus
}

// ------------------

const PORT = process.env.PORT || 8080;

// Serve static files from the 'dist' directory (built Vue app)
app.use(express.static(path.join(__dirname, 'dist')));

// Create an endpoint to get the server's local IP address and generate QR code
app.get('/api/server-info', async (req, res) => {
    const interfaces = os.networkInterfaces();
    let localIp = 'localhost';

    for (const name of Object.keys(interfaces)) {
        // Ignorer les interfaces virtuelles connues (VMware, VirtualBox, vEthernet, etc.)
        const lowerName = name.toLowerCase();
        if (lowerName.includes('vmware') || 
            lowerName.includes('virtualbox') || 
            lowerName.includes('vbox') || 
            lowerName.includes('vnet') || 
            lowerName.includes('virtual') ||
            lowerName.includes('vethernet')) {
            continue;
        }

        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                localIp = iface.address;
                // Si on trouve une adresse en 192.168.x.x, c'est très probablement le réseau LAN, on s'arrête là
                if (localIp.startsWith('192.168.')) break;
            }
        }
        if (localIp !== 'localhost' && localIp.startsWith('192.168.')) break;
    }

    // NOUVEAU : En mode dev, on pointe vers le serveur Vite (5173)
    const isDev = process.env.NODE_ENV !== 'production';
    const playerPort = isDev ? 5173 : PORT;
    const protocol = 'https';
    const playerUrl = `${protocol}://${localIp}:${playerPort}/player`;
    
    try {
        const qrCodeDataUrl = await qrcode.toDataURL(playerUrl, {
            color: { dark: '#0b0f19', light: '#72EFF9' }
        });
        res.json({ ip: localIp, port: PORT, qrCode: qrCodeDataUrl, url: playerUrl });
    } catch (err) {
        res.status(500).json({ error: 'Failed to generate QR code' });
    }
});

// Socket.io connection handling
io.on('connection', (socket) => {
    console.log(`[+] New connection: ${socket.id}`);

    socket.on('request_sync', () => {
        socket.emit('sync_state', {
            isStarted: gameState.isStarted,
            players: gameState.players,
            currentCard: gameState.currentCard,
            scores: gameState.scores,
            isVirus: gameState.isVirus
        });
    });


    socket.on('join_game', (username) => {
        // --- NOUVEAU : Gestion de la reconnexion (ex: page rafraîchie) ---
        const existingId = Object.keys(gameState.players).find(id => gameState.players[id].username === username);
        if (existingId) {
            console.log(`[PLAYER] ${username} reconnected (new id: ${socket.id})`);
            // On transfère l'ancien état vers le nouveau socket
            gameState.players[socket.id] = gameState.players[existingId];
            gameState.players[socket.id].id = socket.id;
            // Si l'ancien ID était différent, on le supprime (éviter les doublons)
            if (existingId !== socket.id) delete gameState.players[existingId];

            const player = gameState.players[socket.id];
            socket.emit('joined_success', { username: player.username, team: player.team, gameInProgress: gameState.isStarted });
            
            // On lui renvoie sa main immédiatement s'il en a une
            if (player.hand.length > 0) {
                socket.emit('your_hand', player.hand);
            }
            return;
        }

        console.log(`[PLAYER] ${username} joined (${socket.id})`);

        // Assign to team with fewer players for balance
        const bluePlayers = Object.values(gameState.players).filter(p => p.team === 'blue').length;
        const magentaPlayers = Object.values(gameState.players).filter(p => p.team === 'magenta').length;
        const team = bluePlayers <= magentaPlayers ? 'blue' : 'magenta';

        gameState.players[socket.id] = {
            id: socket.id,
            username,
            hand: [],
            team: team,
            saidUno: false,
            cured: false,
            lastPlayedColor: null,
            consecutiveColorCount: 0
        };


        // Notify the main screen (projector)
        socket.broadcast.emit('player_joined', { id: socket.id, username, team, isAI: false });

        // Send a success message back to the player (include gameInProgress flag)
        socket.emit('joined_success', { username, team, gameInProgress: gameState.isStarted });

        // S'il rejoint une partie déjà lancée, ne pas distribuer de cartes — attendre la prochaine
        if (gameState.isStarted) {
            socket.emit('game_in_progress');
        }
    });

    socket.on('start_game', () => {
        // Force le redémarrage (réinitialise le jeu)
        stopAllAI();
        initGame();
        io.emit('game_started', { currentCard: gameState.currentCard });

        // Send individual hands (skip AI players)
        for (let playerId in gameState.players) {
            if (!gameState.players[playerId].isAI) {
                io.to(playerId).emit('your_hand', gameState.players[playerId].hand);
            }
        }
    });

    // Add AI player (from projector, before game starts)
    socket.on('add_ai', () => {
        if (gameState.isStarted) return;

        // Count existing AI players
        const aiCount = Object.values(gameState.players).filter(p => p.isAI).length;
        if (aiCount >= MAX_AI_PLAYERS) {
            socket.emit('ai_limit_reached', { max: MAX_AI_PLAYERS });
            return;
        }

        const aiId = `ai_${++aiIdCounter}_${Date.now()}`;
        const personality = AI_PERSONALITIES[Math.floor(Math.random() * AI_PERSONALITIES.length)];
        
        const suffixMap = { fast: '[noob AI]', medium: '[casual AI]', slow: '[pro AI]' };
        const aiName = `${generateAIName()} ${suffixMap[personality]}`;

        // Balance teams
        const bluePlayers = Object.values(gameState.players).filter(p => p.team === 'blue').length;
        const magentaPlayers = Object.values(gameState.players).filter(p => p.team === 'magenta').length;
        const team = bluePlayers <= magentaPlayers ? 'blue' : 'magenta';

        gameState.players[aiId] = {
            id: aiId,
            username: aiName,
            hand: [],
            team: team,
            saidUno: false,
            cured: false,
            isAI: true,
            aiPersonality: personality,
            lastPlayedColor: null,
            consecutiveColorCount: 0
        };

        console.log(`[AI] ${aiName} added (${personality}) to team ${team}`);

        // Notify all clients about the new player
        io.emit('player_joined', { id: aiId, username: aiName, team, isAI: true });
    });

    // Remove AI player (from projector, before game starts)
    socket.on('remove_ai', (aiId) => {
        if (gameState.isStarted) return;
        const player = gameState.players[aiId];
        if (player && player.isAI) {
            delete gameState.players[aiId];
            io.emit('player_left', aiId);
            console.log(`[AI] ${player.username} removed`);
        }
    });

    // Change a player's team (only before the game starts, from projector)
    socket.on('change_player_team', ({ playerId, newTeam }) => {
        if (gameState.isStarted) return;
        if (gameState.players[playerId]) {
            gameState.players[playerId].team = newTeam;
            io.emit('team_changed', { playerId, newTeam });
        }
    });

    // Force end the current game from the projector
    socket.on('force_end_game', () => {
        if (!gameState.isStarted) return;
        gameState.isStarted = false;
        if (gameState.virusTimeout) clearTimeout(gameState.virusTimeout);
        stopAllAI();
        io.emit('game_over', { winner: 'Partie terminée par l\'organisateur', team: 'none', forced: true });
    });

    // Handle play card attempt (Fastest wins)
    socket.on('play_card', (data) => {
        if (!gameState.isStarted || gameState.isVirus) return;

        const player = gameState.players[socket.id];
        if (!player) return;

        let cardId = typeof data === 'object' ? data.cardId : data;
        let chosenColor = typeof data === 'object' ? data.chosenColor : null;

        const success = processPlayCard(socket.id, cardId, chosenColor);

        if (!success) {
            socket.emit('card_played_rejected', { reason: 'Invalid card' });
        }
    });

    socket.on('say_uno', () => {
        const player = gameState.players[socket.id];
        if (player && player.hand.length <= 2) {
            player.saidUno = true;
        }
    });

    socket.on('cure_virus', () => {
        const player = gameState.players[socket.id];
        if (player && gameState.isVirus) {
            player.cured = true;
        }
    });

    // Player needs a new card
    socket.on('send_emoji', (emoji) => {
        const player = gameState.players[socket.id];
        if (!player || typeof emoji !== 'string') return;
        const ALLOWED_EMOJIS = ['😀', '😅', '😭', '😡', '💀', '🤝', '🔥', '🤯', 'GG', 'LOL', 'WHAT', 'EZ'];
        if (!ALLOWED_EMOJIS.includes(emoji)) return;
        io.emit('player_emoji', { playerId: socket.id, username: player.username, emoji });
    });

    socket.on('draw_card', () => {
        if (!gameState.isStarted || gameState.isVirus) return;
        const player = gameState.players[socket.id];
        if (!player) return;

        if (gameState.deck.length > 0) {
            refillDeckIfNeeded();
            const newCard = gameState.deck.pop();
            player.hand.push(newCard);
            player.saidUno = false; // Reset UNO status when drawing
            socket.emit('your_hand', player.hand);
        }
    });

    socket.on('disconnect', () => {
        console.log(`[-] Disconnected: ${socket.id}`);
        delete gameState.players[socket.id];
        // Notify the main screen to remove the player's avatar
        socket.broadcast.emit('player_left', socket.id);
    });
});

// SPA fallback: serve index.html for all non-API, non-socket routes
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

server.listen(PORT, () => {
    console.log(`[SERVER] NEON-UNO running on https://localhost:${PORT}`);
});
