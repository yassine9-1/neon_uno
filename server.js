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
const AI_SPEED = { fast: 4000, medium: 5500, slow: 6500 };
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
    scores: { blue: 50, magenta: 50 },
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
    gameState.scores = { blue: 50, magenta: 50 };
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

// --- AI PLAY LOGIC ---

function findValidCards(hand, currentCard) {
    return hand.filter(card =>
        currentCard.color === 'black' ||
        card.color === currentCard.color ||
        card.value === currentCard.value ||
        card.color === 'black'
    );
}

// Fast AI: play the first valid card found (no strategy)
function aiChooseCardFast(hand, currentCard) {
    const valid = findValidCards(hand, currentCard);
    if (valid.length === 0) return null;
    return valid[0];
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

// Slow/Smart AI: maximize score contribution through color control
function aiChooseCardSmart(hand, currentCard) {
    const valid = findValidCards(hand, currentCard);
    if (valid.length === 0) return null;

    // Count cards per color in hand (non-black)
    const colorCounts = {};
    for (const c of hand) {
        if (c.color !== 'black') {
            colorCounts[c.color] = (colorCounts[c.color] || 0) + 1;
        }
    }
    // Find the dominant color (most cards of this color in hand)
    let dominantColor = null;
    let maxCount = 0;
    for (const color in colorCounts) {
        if (colorCounts[color] > maxCount) {
            maxCount = colorCounts[color];
            dominantColor = color;
        }
    }

    // 1. Prioritize draw2/wild_draw4 to hurt opponents
    const draw4 = valid.find(c => c.value === 'wild_draw4');
    const draw2 = valid.find(c => c.value === 'draw2' && c.color === currentCard.color);
    if (draw2) return draw2;

    // 2. Play action cards (skip/reverse) that match color to freeze opponents
    const actionMatch = valid.find(c =>
        c.color !== 'black' &&
        ['skip', 'reverse'].includes(c.value) &&
        c.color === currentCard.color
    );
    if (actionMatch) return actionMatch;

    // 3. Play a card of the dominant color if possible (to steer the game towards that color)
    if (dominantColor) {
        const dominantCard = valid.find(c => c.color === dominantColor);
        if (dominantCard) return dominantCard;
    }

    // 4. Play any non-black valid card
    const nonBlack = valid.find(c => c.color !== 'black');
    if (nonBlack) return nonBlack;

    // 5. Use wild_draw4 if available (strong play)
    if (draw4) return draw4;

    // 6. Use regular wild card last
    return valid[0];
}

function aiChooseColor(hand) {
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

function aiChooseCard(personality, hand, currentCard) {
    switch (personality) {
        case 'fast': return aiChooseCardFast(hand, currentCard);
        case 'medium': return aiChooseCardMedium(hand, currentCard);
        case 'slow': return aiChooseCardSmart(hand, currentCard);
        default: return aiChooseCardFast(hand, currentCard);
    }
}

function aiPlayCard(aiId) {
    if (!gameState.isStarted || gameState.isVirus) return;
    const player = gameState.players[aiId];
    if (!player || !player.isAI || player.hand.length === 0) return;

    const card = aiChooseCard(player.aiPersonality, player.hand, gameState.currentCard);

    if (!card) {
        // Draw a card
        if (gameState.deck.length > 0) {
            refillDeckIfNeeded();
            const newCard = gameState.deck.pop();
            player.hand.push(newCard);
            player.saidUno = false;
        }
        return;
    }

    const cardIndex = player.hand.findIndex(c => c.id === card.id);
    if (cardIndex === -1) return;

    const cardToPlay = player.hand[cardIndex];
    const current = gameState.currentCard;

    // Re-validate
    const isValid =
        current.color === 'black' ||
        cardToPlay.color === current.color ||
        cardToPlay.value === current.value ||
        cardToPlay.color === 'black';

    if (!isValid) return;

    // Remove from hand
    player.hand.splice(cardIndex, 1);

    // Handle black card color choice
    const previousColor = gameState.currentCard.color;
    if (cardToPlay.color === 'black') {
        const chosenColor = aiChooseColor(player.hand);
        gameState.currentCard = { ...cardToPlay, color: chosenColor };
    } else {
        gameState.currentCard = cardToPlay;
    }

    // Reset AI timers if the pile color changed (simulates rethinking)
    if (gameState.currentCard.color !== previousColor) {
        resetAITimers();
    }

    // AI score contribution is 1 (not 2)
    if (player.team === 'blue') {
        gameState.scores.blue += 1;
        gameState.scores.magenta -= 1;
    } else {
        gameState.scores.magenta += 1;
        gameState.scores.blue -= 1;
    }

    // Check win by gauge
    if (gameState.scores.blue >= 100 || gameState.scores.magenta >= 100) {
        let winningTeam = gameState.scores.blue >= 100 ? 'blue' : 'magenta';
        let winMsg = `L'ÉQUIPE ${winningTeam === 'blue' ? 'NÉON BLEU' : 'NÉON ROSE'}`;
        io.emit('game_over', { winner: winMsg, team: winningTeam });
        gameState.isStarted = false;
        if (gameState.virusTimeout) clearTimeout(gameState.virusTimeout);
        stopAllAI();
        return;
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
            if (!p.isAI) {
                io.to(p.id).emit('freeze_team', { by: player.username });
            }
        });
    }

    // UNO logic: Smart and medium AIs say UNO proactively
    if (player.hand.length <= 2 && player.hand.length > 0) {
        if (player.aiPersonality === 'slow' || player.aiPersonality === 'medium') {
            player.saidUno = true;
        }
        // Fast AI forgets sometimes (50% chance)
        if (player.aiPersonality === 'fast' && Math.random() > 0.5) {
            player.saidUno = true;
        }
    }

    let unoOupli = false;
    if (player.hand.length === 1 && !player.saidUno) {
        unoOupli = true;
        refillDeckIfNeeded();
        if (gameState.deck.length >= 2) {
            player.hand.push(gameState.deck.pop(), gameState.deck.pop());
        }
    } else if (player.hand.length === 0) {
        io.emit('game_over', { winner: player.username, team: player.team });
        gameState.isStarted = false;
        if (gameState.virusTimeout) clearTimeout(gameState.virusTimeout);
        stopAllAI();
    }
    player.saidUno = false;

    // Broadcast
    io.emit('card_played_success', {
        playerId: aiId,
        username: player.username,
        card: gameState.currentCard,
        scores: gameState.scores,
        unoOupli: unoOupli
    });
}

function scheduleAIPlay(playerId) {
    const player = gameState.players[playerId];
    if (!player || !player.isAI || !gameState.isStarted) return;
    const speed = AI_SPEED[player.aiPersonality] || 4500;
    const jitter = Math.random() * 500;
    aiTimers[playerId] = setTimeout(() => {
        aiPlayCard(playerId);
        // Schedule next play after this one completes
        scheduleAIPlay(playerId);
    }, speed + jitter);
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
function resetAITimers() {
    for (let playerId in aiTimers) {
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
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                localIp = iface.address;
                break;
            }
        }
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

    // Wait for player to join with a username
    socket.on('join_game', (username) => {
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
            cured: false
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
            aiPersonality: personality
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
        if (!gameState.isStarted || gameState.isVirus) return; // Cannot play during virus

        const player = gameState.players[socket.id];
        if (!player) return;

        // Gestion de la rétrocompatibilité ou du nouveau format d'envoi
        let cardId = typeof data === 'object' ? data.cardId : data;
        let chosenColor = typeof data === 'object' ? data.chosenColor : null;

        const cardIndex = player.hand.findIndex(c => c.id === cardId);
        if (cardIndex === -1) return; // Cheating or out of sync

        const cardToPlay = player.hand[cardIndex];
        const current = gameState.currentCard;

        // Validation Rule: match color, match value, wild card, OR if current card is black (acts as a reset for the next immediate card)
        const isValid =
            current.color === 'black' || 
            cardToPlay.color === current.color ||
            cardToPlay.value === current.value ||
            cardToPlay.color === 'black';

        if (isValid) {
            // Remove from hand
            player.hand.splice(cardIndex, 1);

            // Update center card : LOGIQUE CORRIGÉE POUR LES CARTES NOIRES
            const previousColor = gameState.currentCard.color;
            if (cardToPlay.color === 'black') {
                // Si la couleur choisie est valide, on l'applique. Sinon, on force 'red' par défaut.
                const validColors = ['red', 'blue', 'green', 'yellow'];
                const newColor = validColors.includes(chosenColor) ? chosenColor : 'red';
                
                // On clone la carte et on change sa couleur pour que le prochain joueur doive suivre cette couleur
                gameState.currentCard = { ...cardToPlay, color: newColor };
            } else {
                gameState.currentCard = cardToPlay;
            }

            // Reset AI timers if the pile color changed (simulates rethinking)
            if (gameState.currentCard.color !== previousColor) {
                resetAITimers();
            }

            // Jauge Logic
            if (player.team === 'blue') {
                gameState.scores.blue += 2;
                gameState.scores.magenta -= 2;
            } else {
                gameState.scores.magenta += 2;
                gameState.scores.blue -= 2;
            }

            // Vérification de victoire par JAUGE d'Équipe !
            if (gameState.scores.blue >= 100 || gameState.scores.magenta >= 100) {
                 let winningTeam = gameState.scores.blue >= 100 ? 'blue' : 'magenta';
                 let winMsg = `L'ÉQUIPE ${winningTeam === 'blue' ? 'NÉON BLEU' : 'NÉON ROSE'}`;
                 io.emit('game_over', { winner: winMsg, team: winningTeam });
                 gameState.isStarted = false;
                 if (gameState.virusTimeout) clearTimeout(gameState.virusTimeout);
                 stopAllAI();
                 return; // On arrête là
            }

            // ---- EFFETS DES CARTES SPÉCIALES ----
            refillDeckIfNeeded();
            let opposingTeam = player.team === 'blue' ? 'magenta' : 'blue';
            let opposingPlayers = Object.values(gameState.players).filter(p => p.team === opposingTeam);

            if (cardToPlay.value === 'draw2' || cardToPlay.value === 'wild_draw4') {
                // Trouver une cible au hasard dans l'équipe adverse
                if (opposingPlayers.length > 0) {
                    let target = opposingPlayers[Math.floor(Math.random() * opposingPlayers.length)];
                    let cardsToDraw = cardToPlay.value === 'draw2' ? 2 : 4;
                    for (let i = 0; i < cardsToDraw; i++) {
                        target.hand.push(gameState.deck.pop());
                    }
                    io.to(target.id).emit('your_hand', target.hand);
                    // On peut notifier la cible qu'elle s'est fait attaquer par 'player.username'
                    io.to(target.id).emit('attacked', { by: player.username, cards: cardsToDraw });
                }
            } else if (cardToPlay.value === 'skip' || cardToPlay.value === 'reverse') {
                // Gèle toute l'équipe adverse pendant 2 secondes !
                opposingPlayers.forEach(p => {
                    io.to(p.id).emit('freeze_team', { by: player.username });
                });
            }

            // UNO Logic Penalties
            let unoOupli = false;
            // Si le joueur n'a plus qu'une carte et n'a pas appuyé sur UNO...
            if (player.hand.length === 1 && !player.saidUno) {
                unoOupli = true;
                refillDeckIfNeeded();
                if (gameState.deck.length >= 2) {
                    player.hand.push(gameState.deck.pop(), gameState.deck.pop()); // pénalité +2
                }
            } else if (player.hand.length === 0) {
                // GAGNANT !
                io.emit('game_over', { winner: player.username, team: player.team });
                gameState.isStarted = false;
                if (gameState.virusTimeout) clearTimeout(gameState.virusTimeout);
                stopAllAI();
            }
            // Reset UNO state for next time
            player.saidUno = false;

            // Broadcast success logic
            io.emit('card_played_success', {
                playerId: socket.id,
                username: player.username,
                // On envoie la carte mise à jour (avec sa nouvelle couleur si c'était une carte noire)
                card: gameState.currentCard, 
                scores: gameState.scores,
                unoOupli: unoOupli
            });

            // Send new hand to player
            socket.emit('your_hand', player.hand);
        } else {
            // Reject play
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
    console.log(`[SERVER] NEON-UNO running on http://localhost:${PORT}`);
});
