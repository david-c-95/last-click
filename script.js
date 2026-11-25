// =========================
// CONFIGURATION
// =========================

const BUTTON_COUNT = 6;
const BUTTON_IMAGE = "images/popcorn.png";

const SOUND_VOLUME = 0.7;
const POP_SOUND = "sounds/pop.mp3";

const SMALL_EXPLOSION_COUNT = 8;
const SMALL_EXPLOSION_POWER = 0.25;

const WIN_EXPLOSION_COUNT = 100;
const WIN_EXPLOSION_POWER = 1.5;

const API_URL = "/api";
const LOBBY_REFRESH_INTERVAL = 1000;


// =========================
// HTML ELEMENTS - SOLO
// =========================

const mainMenu = document.getElementById("mainMenu");
const soloGame = document.getElementById("soloGame");

const soloButton = document.getElementById("soloButton");
const onlineButton = document.getElementById("onlineButton");
const restartButton = document.getElementById("restartButton");
const backButton = document.getElementById("backButton");

const gameGrid = document.getElementById("gameGrid");
const gameStatus = document.getElementById("gameStatus");
const gameScore = document.getElementById("gameScore");


// =========================
// HTML ELEMENTS - ONLINE
// =========================

const onlineMenu = document.getElementById("onlineMenu");
const onlineLobby = document.getElementById("onlineLobby");

const onlineBackButton = document.getElementById("onlineBackButton");

const nicknameInput = document.getElementById("nicknameInput");
const roomInput = document.getElementById("roomInput");
const passwordInput = document.getElementById("passwordInput");

const createRoomButton = document.getElementById("createRoomButton");
const joinRoomButton = document.getElementById("joinRoomButton");

const onlineStatus = document.getElementById("onlineStatus");

const lobbyRoomName = document.getElementById("lobbyRoomName");
const playerCount = document.getElementById("playerCount");
const playerList = document.getElementById("playerList");
const lobbyStatus = document.getElementById("lobbyStatus");

const leaveRoomButton = document.getElementById("leaveRoomButton");
const startGameButton = document.getElementById("startGameButton");


// =========================
// GAME VARIABLES
// =========================

let trapIndex;
let safeClicks;
let gameOver;


// =========================
// ONLINE VARIABLES
// =========================

let currentRoom = null;
let currentPlayerId = null;
let currentNickname = null;

let isHost = false;
let onlineBusy = false;

let lobbyTimer = null;
let lobbyGeneration = 0;


// =========================
// SOUND VARIABLES
// =========================

let sounds = {
    win: [],
    lose: []
};

let currentAudio = null;


// =========================
// LOAD SOUND MANIFEST
// =========================

fetch("sounds.json")
    .then(response => {

        if (!response.ok) {
            throw new Error("Cannot load sounds.json");
        }

        return response.json();

    })
    .then(data => {

        sounds.win = Array.isArray(data.win)
            ? data.win
            : [];

        sounds.lose = Array.isArray(data.lose)
            ? data.lose
            : [];

        console.log("Sounds loaded:", sounds);

    })
    .catch(error => {

        console.warn("Sound manifest unavailable:", error);

    });


// =========================
// STOP CURRENT SOUND
// =========================

function stopSound() {

    if (currentAudio) {

        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;

    }

}


// =========================
// PLAY SOUND
// =========================

function playSound(path, volume = SOUND_VOLUME) {

    stopSound();

    const audio = new Audio(path);

    audio.volume = volume;

    currentAudio = audio;

    audio.addEventListener("ended", () => {

        if (currentAudio === audio) {
            currentAudio = null;
        }

    }, { once: true });

    audio.play().catch(error => {

        console.warn("Audio unavailable:", path, error);

        if (currentAudio === audio) {
            currentAudio = null;
        }

    });

}


// =========================
// PLAY RANDOM SOUND
// =========================

function playRandomSound(category) {

    stopSound();

    const files = sounds[category];

    if (!files || files.length === 0) {
        return;
    }

    const index = Math.floor(
        Math.random() * files.length
    );

    playSound(files[index]);

}


// =========================
// POPCORN EXPLOSION
// =========================

function explodePopcorn(x, y, count = 100, power = 1) {

    if (window.matchMedia(
        "(prefers-reduced-motion: reduce)"
    ).matches) {
        return;
    }

    for (let i = 0; i < count; i++) {

        const particle = document.createElement("img");

        particle.src = BUTTON_IMAGE;
        particle.alt = "";
        particle.draggable = false;

        particle.className = "popcorn-particle";

        const angle = Math.random() * Math.PI * 2;

        const distance =
            (100 + Math.random() * 500) * power;

        const moveX = Math.cos(angle) * distance;
        const moveY = Math.sin(angle) * distance;

        const size = 20 + Math.random() * 55;
        const rotation = Math.random() * 1440 - 720;
        const duration = 0.8 + Math.random() * 1.2;

        particle.style.left = `${x}px`;
        particle.style.top = `${y}px`;

        particle.style.setProperty("--x", `${moveX}px`);
        particle.style.setProperty("--y", `${moveY}px`);
        particle.style.setProperty("--size", `${size}px`);

        particle.style.setProperty(
            "--rotation",
            `${rotation}deg`
        );

        particle.style.setProperty(
            "--duration",
            `${duration}s`
        );

        document.body.appendChild(particle);

        particle.addEventListener("animationend", () => {

            particle.remove();

        }, { once: true });

        setTimeout(() => {

            particle.remove();

        }, duration * 1000 + 200);

    }

}


// =========================
// CLEAR ANIMATIONS
// =========================

function clearAnimations() {

    gameGrid.classList.remove(
        "shake",
        "victory-glow"
    );

    document.querySelectorAll(".popcorn-particle")
        .forEach(particle => particle.remove());

}


// =========================
// START SOLO GAME
// =========================

function startSoloGame() {

    stopSound();
    clearAnimations();

    trapIndex = Math.floor(
        Math.random() * BUTTON_COUNT
    );

    safeClicks = 0;
    gameOver = false;

    gameGrid.innerHTML = "";

    gameStatus.textContent = "Choose a popcorn";
    gameStatus.className = "";

    gameScore.textContent =
        `Safe clicks: 0/${BUTTON_COUNT - 1}`;

    restartButton.hidden = true;

    for (let i = 0; i < BUTTON_COUNT; i++) {

        const button = document.createElement("button");

        button.className = "game-button";

        button.setAttribute(
            "aria-label",
            `Popcorn ${i + 1}`
        );

        const img = document.createElement("img");

        img.alt = "";
        img.draggable = false;

        img.addEventListener("error", () => {

            if (button.contains(img)) {
                button.textContent = "🍿";
            }

        });

        img.src = BUTTON_IMAGE;

        button.appendChild(img);

        button.addEventListener("click", () => {

            handleClick(i, button);

        });

        gameGrid.appendChild(button);

    }

}


// =========================
// HANDLE SOLO CLICK
// =========================

function handleClick(index, button) {

    if (gameOver || button.disabled) {
        return;
    }

    if (index === trapIndex) {

        endGame(false);
        return;

    }

    safeClicks++;

    button.classList.add("safe");
    button.disabled = true;

    gameScore.textContent =
        `Safe clicks: ${safeClicks}/${BUTTON_COUNT - 1}`;

    if (safeClicks === BUTTON_COUNT - 1) {

        endGame(true);
        return;

    }

    playSound(POP_SOUND);

    const rect = button.getBoundingClientRect();

    explodePopcorn(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
        SMALL_EXPLOSION_COUNT,
        SMALL_EXPLOSION_POWER
    );

}


// =========================
// END SOLO GAME
// =========================

function endGame(win) {

    gameOver = true;

    const buttons =
        gameGrid.querySelectorAll(".game-button");

    buttons.forEach(button => {

        button.disabled = true;

    });

    buttons[trapIndex].classList.add("trap");

    if (win) {

        gameStatus.textContent = "YOU WIN!";
        gameStatus.className = "win";

        playRandomSound("win");

        const rect = gameGrid.getBoundingClientRect();

        explodePopcorn(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
            WIN_EXPLOSION_COUNT,
            WIN_EXPLOSION_POWER
        );

        gameGrid.classList.add("victory-glow");

    }

    else {

        gameStatus.textContent = "GAME OVER";
        gameStatus.className = "lose";

        playRandomSound("lose");

        gameGrid.classList.add("shake");

    }

    restartButton.hidden = false;

}


// =========================
// ONLINE API
// =========================

async function apiRequest(action, payload = {}) {

    const response = await fetch(API_URL, {

        method: "POST",

        headers: {
            "Content-Type": "application/json"
        },

        cache: "no-store",

        signal: AbortSignal.timeout(10000),

        body: JSON.stringify({
            ...payload,
            action
        })

    });

    const data = await response.json();

    if (!response.ok || data.error) {

        const error = new Error(
            data.error || "Server error"
        );

        error.status = response.status;

        throw error;

    }

    return data;

}


// =========================
// ONLINE STATUS
// =========================

function setOnlineStatus(message, type = "") {

    onlineStatus.textContent = message;
    onlineStatus.className = type;

}


// =========================
// ONLINE LOADING STATE
// =========================

function setOnlineBusy(busy) {

    onlineBusy = busy;

    createRoomButton.disabled = busy;
    joinRoomButton.disabled = busy;
    onlineBackButton.disabled = busy;

    nicknameInput.disabled = busy;
    roomInput.disabled = busy;
    passwordInput.disabled = busy;

}


// =========================
// CREATE OR JOIN ROOM
// =========================

async function connectToRoom(action) {

    if (onlineBusy) {
        return;
    }

    const nickname = nicknameInput.value.trim();
    const room = roomInput.value.trim();
    const password = passwordInput.value;

    if (!nickname || !room) {

        setOnlineStatus(
            "Enter a nickname and a room name.",
            "error"
        );

        return;

    }

    if (action === "create" && !password) {

        setOnlineStatus(
            "Enter the creation password.",
            "error"
        );

        return;

    }

    setOnlineBusy(true);

    setOnlineStatus(
        action === "create"
            ? "Creating room..."
            : "Joining room..."
    );

    try {

        const payload = {
            nickname,
            room
        };

        if (action === "create") {
            payload.password = password;
        }

        const data = await apiRequest(
            action,
            payload
        );

        currentRoom = data.room;
        currentPlayerId = data.playerId;
        currentNickname = nickname;

        isHost = action === "create";

        passwordInput.value = "";

        setOnlineStatus("");

        openLobby();

    }

    catch (error) {

        setOnlineStatus(
            error.message,
            "error"
        );

    }

    finally {

        setOnlineBusy(false);

    }

}


// =========================
// OPEN LOBBY
// =========================

function openLobby() {

    onlineMenu.hidden = true;
    onlineLobby.hidden = false;

    lobbyRoomName.textContent = currentRoom;

    playerList.innerHTML = "";

    playerCount.textContent = "Players: --/10";

    lobbyStatus.textContent =
        "Loading players...";

    startGameButton.hidden = !isHost;
    startGameButton.disabled = true;

    startLobbyPolling();

}


// =========================
// START LOBBY POLLING
// =========================

function startLobbyPolling() {

    stopLobbyPolling();

    refreshLobby(lobbyGeneration);

}


// =========================
// STOP LOBBY POLLING
// =========================

function stopLobbyPolling() {

    lobbyGeneration++;

    if (lobbyTimer !== null) {

        clearTimeout(lobbyTimer);
        lobbyTimer = null;

    }

}


// =========================
// REFRESH LOBBY
// =========================

async function refreshLobby(generation) {

    if (generation !== lobbyGeneration ||
        !currentRoom ||
        !currentPlayerId) {

        return;

    }

    try {

        const data = await apiRequest("state", {

            room: currentRoom,
            playerId: currentPlayerId

        });

        // Ignore outdated responses

        if (generation !== lobbyGeneration) {
            return;
        }

        isHost = data.isHost;

        renderPlayers(data.players);

        playerCount.textContent =
            `Players: ${data.playerCount}/10`;

        startGameButton.hidden = !isHost;

        // Game start is not implemented yet

        startGameButton.disabled = true;

        if (data.playerCount < 2) {

            lobbyStatus.textContent =
                "Waiting for more players...";

        }

        else if (isHost) {

            lobbyStatus.textContent =
                "Players connected. Ready to play!";

        }

        else {

            lobbyStatus.textContent =
                "Waiting for the host to start...";

        }

    }

    catch (error) {

        if (generation !== lobbyGeneration) {
            return;
        }

        if (error.status === 403 ||
            error.status === 404) {

            leaveRoom();

            setOnlineStatus(
                error.message,
                "error"
            );

            return;

        }

        lobbyStatus.textContent =
            "Connection lost. Reconnecting...";

        console.warn("Lobby refresh failed:", error);

    }

    finally {

        if (generation === lobbyGeneration &&
            currentRoom &&
            currentPlayerId) {

            lobbyTimer = setTimeout(() => {

                refreshLobby(generation);

            }, LOBBY_REFRESH_INTERVAL);

        }

    }

}


// =========================
// DISPLAY PLAYERS
// =========================

function renderPlayers(players) {

    const fragment = document.createDocumentFragment();

    players.forEach(player => {

        const item = document.createElement("div");

        item.className = "player-item";

        if (!player.alive) {

            item.classList.add("player-eliminated");

        }

        const name = document.createElement("span");

        name.className = "player-name";
        name.textContent = player.nickname;

        const role = document.createElement("span");

        if (player.isHost) {

            role.className = "player-host";

            role.textContent = player.isYou
                ? "HOST • YOU"
                : "HOST";

        }

        else if (player.isYou) {

            role.className = "player-you";
            role.textContent = "YOU";

        }

        else {

            role.className = "player-you";
            role.textContent = "READY";

        }

        item.appendChild(name);
        item.appendChild(role);

        fragment.appendChild(item);

    });

    playerList.replaceChildren(fragment);

}


// =========================
// LEAVE ROOM
// =========================

function leaveRoom() {

    stopLobbyPolling();

    // Server-side departure will be added next.

    currentRoom = null;
    currentPlayerId = null;
    currentNickname = null;

    isHost = false;

    playerList.innerHTML = "";

    onlineLobby.hidden = true;
    onlineMenu.hidden = false;

    setOnlineStatus("");

}


// =========================
// SOLO NAVIGATION
// =========================

soloButton.addEventListener("click", () => {

    mainMenu.hidden = true;
    soloGame.hidden = false;

    startSoloGame();

});


restartButton.addEventListener(
    "click",
    startSoloGame
);


backButton.addEventListener("click", () => {

    gameOver = true;

    stopSound();
    clearAnimations();

    soloGame.hidden = true;
    mainMenu.hidden = false;

});


// =========================
// ONLINE NAVIGATION
// =========================

onlineButton.addEventListener("click", () => {

    mainMenu.hidden = true;
    onlineMenu.hidden = false;

    setOnlineStatus("");

});


onlineBackButton.addEventListener("click", () => {

    if (onlineBusy) {
        return;
    }

    passwordInput.value = "";

    onlineMenu.hidden = true;
    mainMenu.hidden = false;

    setOnlineStatus("");

});


createRoomButton.addEventListener("click", () => {

    connectToRoom("create");

});


joinRoomButton.addEventListener("click", () => {

    connectToRoom("join");

});


leaveRoomButton.addEventListener(
    "click",
    leaveRoom
);