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
    return deck.sort(() => Math.random() - 0.5); // Shuffle
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
}

function scheduleVirus() {
    if (!gameState.isStarted) return;
    // Augmentation du délai : Entre 60s et 120s (1 à 2 minutes) au lieu de 20s-40s
    const delay = 60000 + Math.random() * 60000;
    gameState.virusTimeout = setTimeout(() => {
        triggerVirus();
    }, delay);
}

function triggerVirus() {
    if (!gameState.isStarted) return;
    gameState.isVirus = true;

    // Reset cured state
    for (let playerId in gameState.players) {
        gameState.players[playerId].cured = false;
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
            if (gameState.deck.length >= 2) {
                player.hand.push(gameState.deck.pop(), gameState.deck.pop());
                infectedPlayers.push(player.username);
                io.to(player.id).emit('your_hand', player.hand);
            }
        }
    }
    io.emit('virus_resolved', infectedPlayers);
    scheduleVirus(); // Schedule next virus
}

// ------------------

const PORT = process.env.PORT || 3000;

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

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

    // Utilisation d'un certificat HTTPS auto-signé et de l'IP locale pour un lien fixe
    const playerUrl = `https://${localIp}:${PORT}/player.html`;
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

        // Assign random team
        const team = Math.random() < 0.5 ? 'blue' : 'magenta';

        gameState.players[socket.id] = {
            id: socket.id,
            username,
            hand: [],
            team: team,
            saidUno: false,
            cured: false
        };

        // Notify the main screen (projector)
        socket.broadcast.emit('player_joined', { id: socket.id, username, team });

        // Send a success message back to the player
        socket.emit('joined_success', { username, team });

        // S'il rejoint une partie déjà lancée
        if (gameState.isStarted) {
            gameState.players[socket.id].hand = gameState.deck.splice(0, 7);
            socket.emit('your_hand', gameState.players[socket.id].hand);
        }
    });

    socket.on('start_game', () => {
        // Force le redémarrage (réinitialise le jeu)
        initGame();
        io.emit('game_started', { currentCard: gameState.currentCard });

        // Send individual hands
        for (let playerId in gameState.players) {
            io.to(playerId).emit('your_hand', gameState.players[playerId].hand);
        }
    });

    // Handle play card attempt (Fastest wins)
    socket.on('play_card', (cardId) => {
        if (!gameState.isStarted || gameState.isVirus) return; // Cannot play during virus

        const player = gameState.players[socket.id];
        if (!player) return;

        const cardIndex = player.hand.findIndex(c => c.id === cardId);
        if (cardIndex === -1) return; // Cheating or out of sync

        const cardToPlay = player.hand[cardIndex];
        const current = gameState.currentCard;

        // Validation Rule: match color, match value, or wild card
        const isValid =
            cardToPlay.color === current.color ||
            cardToPlay.value === current.value ||
            cardToPlay.color === 'black';

        if (isValid) {
            // Remove from hand
            player.hand.splice(cardIndex, 1);

            // Update center card
            gameState.currentCard = cardToPlay;

            // Jauge Logic
            if (player.team === 'blue') {
                gameState.scores.blue += 2;
                gameState.scores.magenta -= 2;
            } else {
                gameState.scores.magenta += 2;
                gameState.scores.blue -= 2;
            }

            // UNO Logic Penalties
            let unoOupli = false;
            // Si le joueur n'a plus qu'une carte et n'a pas appuyé sur UNO...
            if (player.hand.length === 1 && !player.saidUno) {
                unoOupli = true;
                if (gameState.deck.length >= 2) {
                    player.hand.push(gameState.deck.pop(), gameState.deck.pop()); // pénalité +2
                }
            } else if (player.hand.length === 0) {
                // GAGNANT !
                io.emit('game_over', { winner: player.username, team: player.team });
                gameState.isStarted = false;
                if (gameState.virusTimeout) clearTimeout(gameState.virusTimeout);
            }
            // Reset UNO state for next time
            player.saidUno = false;

            // Broadcast success logic
            io.emit('card_played_success', {
                playerId: socket.id,
                username: player.username,
                card: cardToPlay,
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

server.listen(PORT, () => {
    console.log(`[SERVER] NEON-UNO running on http://localhost:${PORT}`);
});
