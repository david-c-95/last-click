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
const REFRESH_INTERVAL = 1000;


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
// HTML ELEMENTS - ONLINE MENU
// =========================

const onlineMenu = document.getElementById("onlineMenu");
const onlineBackButton = document.getElementById("onlineBackButton");

const nicknameInput = document.getElementById("nicknameInput");
const roomInput = document.getElementById("roomInput");
const passwordInput = document.getElementById("passwordInput");

const createRoomButton = document.getElementById("createRoomButton");
const joinRoomButton = document.getElementById("joinRoomButton");

const onlineStatus = document.getElementById("onlineStatus");


// =========================
// HTML ELEMENTS - LOBBY
// =========================

const onlineLobby = document.getElementById("onlineLobby");

const lobbyRoomName = document.getElementById("lobbyRoomName");
const playerCount = document.getElementById("playerCount");
const playerList = document.getElementById("playerList");
const lobbyStatus = document.getElementById("lobbyStatus");

const leaveRoomButton = document.getElementById("leaveRoomButton");
const startGameButton = document.getElementById("startGameButton");
const deleteRoomButton = document.getElementById("deleteRoomButton");


// =========================
// HTML ELEMENTS - ONLINE GAME
// =========================

const onlineGame = document.getElementById("onlineGame");

const onlineGameRoom = document.getElementById("onlineGameRoom");
const onlineRound = document.getElementById("onlineRound");

const onlineGameStatus = document.getElementById("onlineGameStatus");
const onlineGameGrid = document.getElementById("onlineGameGrid");
const onlineGameScore = document.getElementById("onlineGameScore");
const onlineGameInfo = document.getElementById("onlineGameInfo");
const onlineGamePlayers = document.getElementById("onlineGamePlayers");

const onlineGameLeaveButton = document.getElementById("onlineGameLeaveButton");
const onlineGameDeleteButton = document.getElementById("onlineGameDeleteButton");


// =========================
// SOLO VARIABLES
// =========================

let trapIndex;
let safeClicks;
let gameOver;


// =========================
// ONLINE VARIABLES
// =========================

let currentRoom = null;
let currentPlayerId = null;

let isHost = false;
let onlineBusy = false;
let lobbyActionBusy = false;

let latestState = null;
let lastClickPosition = null;

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

    const index = Math.floor(Math.random() * files.length);

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
        particle.style.setProperty("--rotation", `${rotation}deg`);
        particle.style.setProperty("--duration", `${duration}s`);

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
// GRID CENTER
// =========================

function getCenter(element) {

    const rect = element.getBoundingClientRect();

    return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
    };

}


// =========================
// CLEAR ANIMATIONS
// =========================

function clearAnimations() {

    gameGrid.classList.remove(
        "shake",
        "victory-glow"
    );

    onlineGameGrid.classList.remove(
        "shake",
        "victory-glow"
    );

    document.querySelectorAll(".popcorn-particle")
        .forEach(particle => particle.remove());

}


// =========================
// SHAKE GRID
// =========================

function shakeGrid(grid) {

    grid.classList.remove("shake");

    void grid.offsetWidth;

    grid.classList.add("shake");

}


// =========================
// CREATE POPCORN BUTTON
// =========================

function createPopcornButton(index, callback) {

    const button = document.createElement("button");

    button.className = "game-button";

    button.setAttribute(
        "aria-label",
        `Popcorn ${index + 1}`
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

        callback(index, button);

    });

    return button;

}


// =========================
// START SOLO GAME
// =========================

function startSoloGame() {

    stopSound();
    clearAnimations();

    trapIndex = Math.floor(Math.random() * BUTTON_COUNT);

    safeClicks = 0;
    gameOver = false;

    gameGrid.innerHTML = "";

    gameStatus.textContent = "Choose a popcorn";
    gameStatus.className = "";

    gameScore.textContent =
        `Safe clicks: 0/${BUTTON_COUNT - 1}`;

    restartButton.hidden = true;

    for (let i = 0; i < BUTTON_COUNT; i++) {

        gameGrid.appendChild(
            createPopcornButton(i, handleClick)
        );

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

    const position = getCenter(button);

    explodePopcorn(
        position.x,
        position.y,
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

        const position = getCenter(gameGrid);

        explodePopcorn(
            position.x,
            position.y,
            WIN_EXPLOSION_COUNT,
            WIN_EXPLOSION_POWER
        );

        gameGrid.classList.add("victory-glow");

    } else {

        gameStatus.textContent = "GAME OVER";
        gameStatus.className = "lose";

        playRandomSound("lose");

        shakeGrid(gameGrid);

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

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.error || data.status !== "ok") {

        const error = new Error(
            data.error || "Server error"
        );

        error.status = response.status;

        throw error;

    }

    return data;

}


// =========================
// ONLINE MENU STATUS
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

        const data = await apiRequest(action, payload);

        currentRoom = data.room;
        currentPlayerId = data.playerId;

        isHost = action === "create";

        latestState = null;
        lastClickPosition = null;

        passwordInput.value = "";

        setOnlineStatus("");

        openLobby();

    } catch (error) {

        setOnlineStatus(error.message, "error");

    } finally {

        setOnlineBusy(false);

    }

}


// =========================
// OPEN LOBBY
// =========================

function openLobby() {

    onlineMenu.hidden = true;
    onlineGame.hidden = true;
    onlineLobby.hidden = false;

    lobbyRoomName.textContent = currentRoom;

    playerList.innerHTML = "";

    playerCount.textContent = "Players: --/10";
    lobbyStatus.textContent = "Loading players...";

    startGameButton.hidden = !isHost;
    startGameButton.disabled = true;

    deleteRoomButton.hidden = !isHost;
    deleteRoomButton.disabled = true;

    leaveRoomButton.disabled = false;

    startLobbyPolling();

}


// =========================
// START POLLING
// =========================

function startLobbyPolling() {

    stopLobbyPolling();

    refreshLobby(lobbyGeneration);

}


// =========================
// STOP POLLING
// =========================

function stopLobbyPolling() {

    lobbyGeneration++;

    if (lobbyTimer !== null) {

        clearTimeout(lobbyTimer);
        lobbyTimer = null;

    }

}


// =========================
// REFRESH ROOM STATE
// =========================

async function refreshLobby(generation) {

    if (generation !== lobbyGeneration ||
        !currentRoom ||
        !currentPlayerId ||
        lobbyActionBusy) {

        return;

    }

    try {

        const data = await apiRequest("state", {

            room: currentRoom,
            playerId: currentPlayerId

        });

        if (generation !== lobbyGeneration) {
            return;
        }

        const previousState = latestState;

        latestState = data;
        isHost = data.isHost;

        if (data.roomStatus === "waiting") {

            renderLobby(data);

        } else if (
            data.roomStatus === "playing" ||
            data.roomStatus === "finished"
        ) {

            if (onlineGame.hidden) {

                openOnlineGame();

            }

            renderOnlineGame(data);

            handleOnlineEffects(previousState, data);

        }

    } catch (error) {

        if (generation !== lobbyGeneration) {
            return;
        }

        if (error.status === 403 ||
            error.status === 404) {

            closeLobby();

            setOnlineStatus(error.message, "error");

            return;

        }

        startGameButton.disabled = true;
        deleteRoomButton.disabled = true;
        onlineGameDeleteButton.disabled = true;

        setOnlineButtonsEnabled(false);

        lobbyStatus.textContent =
            "Connection lost. Reconnecting...";

        onlineGameStatus.textContent =
            "Connection lost. Reconnecting...";

        onlineGameStatus.className = "waiting";

        console.warn("Room refresh failed:", error);

    } finally {

        if (generation === lobbyGeneration &&
            currentRoom &&
            currentPlayerId &&
            !lobbyActionBusy) {

            lobbyTimer = setTimeout(() => {

                refreshLobby(generation);

            }, REFRESH_INTERVAL);

        }

    }

}


// =========================
// RENDER LOBBY
// =========================

function renderLobby(data) {

    renderPlayers(data, playerList);

    playerCount.textContent =
        `Players: ${data.playerCount}/10`;

    startGameButton.hidden = !isHost;

    startGameButton.disabled =
        !isHost ||
        data.playerCount < 2 ||
        lobbyActionBusy;

    deleteRoomButton.hidden = !isHost;
    deleteRoomButton.disabled = lobbyActionBusy;

    if (data.playerCount < 2) {

        lobbyStatus.textContent =
            "Waiting for more players...";

    } else if (isHost) {

        lobbyStatus.textContent =
            "Ready to start!";

    } else {

        lobbyStatus.textContent =
            "Waiting for the host to start...";

    }

}


// =========================
// OPEN ONLINE GAME
// =========================

function openOnlineGame() {

    onlineLobby.hidden = true;
    onlineGame.hidden = false;

    clearAnimations();

    onlineGameRoom.textContent =
        `Room: ${currentRoom}`;

    onlineGameGrid.innerHTML = "";

    for (let i = 0; i < BUTTON_COUNT; i++) {

        const button = createPopcornButton(
            i,
            handleOnlineClick
        );

        button.disabled = true;

        onlineGameGrid.appendChild(button);

    }

}


// =========================
// ENABLE / DISABLE POPCORNS
// =========================

function setOnlineButtonsEnabled(enabled) {

    onlineGameGrid.querySelectorAll(".game-button")
        .forEach(button => {

            button.disabled = !enabled;

        });

}


// =========================
// RENDER ONLINE GAME
// =========================

function renderOnlineGame(data) {

    const me = data.players.find(
        player => player.isYou
    );

    const currentPlayer = data.players.find(
        player => player.isCurrentTurn
    );

    const aliveCount = data.players.filter(
        player => player.alive
    ).length;

    onlineRound.textContent =
        `ROUND ${data.roundNumber}`;

    onlineGameScore.textContent =
        `${aliveCount}/${data.playerCount} PLAYERS ALIVE`;

    onlineGameDeleteButton.hidden = !isHost;
    onlineGameDeleteButton.disabled = lobbyActionBusy;

    onlineGameStatus.className = "";

    // Finished game

    if (data.roomStatus === "finished") {

        const won = me &&
            data.winner === me.nickname;

        onlineGameStatus.textContent = won
            ? "YOU WIN!"
            : data.winner
                ? `${data.winner} WINS!`
                : "GAME FINISHED";

        onlineGameStatus.className =
            won ? "win" : "lose";

        onlineGameInfo.textContent =
            "Game finished";

        setOnlineButtonsEnabled(false);

    }

    // Eliminated player

    else if (!me || !me.alive) {

        onlineGameStatus.textContent =
            "YOU ARE ELIMINATED";

        onlineGameStatus.className = "eliminated";

        onlineGameInfo.textContent = currentPlayer
            ? `Spectating • ${currentPlayer.nickname}'s turn`
            : "Spectating";

        setOnlineButtonsEnabled(false);

    }

    // Your turn

    else if (data.isYourTurn) {

        onlineGameStatus.textContent =
            "YOUR TURN!";

        onlineGameStatus.className = "your-turn";

        onlineGameInfo.textContent =
            "Choose a popcorn • 5% chance of elimination";

        setOnlineButtonsEnabled(!lobbyActionBusy);

    }

    // Another player's turn

    else {

        onlineGameStatus.textContent = currentPlayer
            ? `${currentPlayer.nickname}'s turn`
            : "Waiting...";

        onlineGameStatus.className = "waiting";

        onlineGameInfo.textContent =
            "Wait for your turn";

        setOnlineButtonsEnabled(false);

    }

    renderPlayers(data, onlineGamePlayers);

}


// =========================
// DISPLAY PLAYER LIST
// =========================

function renderPlayers(data, container) {

    const fragment = document.createDocumentFragment();

    data.players.forEach(player => {

        const item = document.createElement("div");
        item.className = "player-item";

        const name = document.createElement("span");
        name.className = "player-name";

        name.textContent = player.nickname +
            (player.isYou ? " (YOU)" : "");

        const role = document.createElement("span");

        // Waiting room

        if (data.roomStatus === "waiting") {

            if (player.isHost) {

                role.className = "player-host";
                role.textContent = "HOST";

            } else {

                role.className = "player-you";
                role.textContent = "READY";

            }

        }

        // Winner

        else if (
            data.roomStatus === "finished" &&
            data.winner === player.nickname
        ) {

            role.className = "player-winner";
            role.textContent = "WINNER";

        }

        // Eliminated

        else if (!player.alive) {

            item.classList.add("player-eliminated");

            role.className = "player-dead";
            role.textContent = "ELIMINATED";

        }

        // Current turn

        else if (
            data.roomStatus === "playing" &&
            player.isCurrentTurn
        ) {

            item.classList.add("player-current");

            role.className = "player-turn";

            role.textContent = player.isYou
                ? "YOUR TURN"
                : "PLAYING";

        }

        // Already played this round

        else if (
            player.lastPlayedRound >= data.roundNumber
        ) {

            role.className = "player-played";
            role.textContent = "PLAYED";

        }

        // Waiting for their turn

        else {

            role.className = "player-waiting";
            role.textContent = "WAITING";

        }

        item.appendChild(name);
        item.appendChild(role);

        fragment.appendChild(item);

    });

    container.replaceChildren(fragment);

}


// =========================
// ONLINE SOUND AND EFFECTS
// =========================

function handleOnlineEffects(previous, current) {

    const me = current.players.find(
        player => player.isYou
    );

    const previousMe = previous?.players.find(
        player => player.isYou
    );

    // Victory - play only once

    if (
        current.roomStatus === "finished" &&
        previous?.roomStatus !== "finished" &&
        me &&
        current.winner === me.nickname
    ) {

        playRandomSound("win");

        const position = getCenter(onlineGameGrid);

        explodePopcorn(
            position.x,
            position.y,
            WIN_EXPLOSION_COUNT,
            WIN_EXPLOSION_POWER
        );

        onlineGameGrid.classList.add("victory-glow");

        lastClickPosition = null;

        return;

    }

    // Personal elimination - play only once

    if (previousMe?.alive && me && !me.alive) {

        playRandomSound("lose");

        shakeGrid(onlineGameGrid);

        lastClickPosition = null;

        return;

    }

    if (!previous || previous.roomStatus !== "playing") {

        return;

    }

    // Find players who have played since last refresh

    const changedPlayers = current.players.filter(player => {

        const oldPlayer = previous.players.find(
            old => old.nickname === player.nickname
        );

        return oldPlayer &&
            player.lastPlayedRound > oldPlayer.lastPlayedRound;

    });

    // Personal safe click

    const mySafeClick = changedPlayers.some(
        player => player.isYou && player.alive
    );

    if (mySafeClick) {

        const position =
            lastClickPosition || getCenter(onlineGameGrid);

        playSound(POP_SOUND);

        explodePopcorn(
            position.x,
            position.y,
            SMALL_EXPLOSION_COUNT,
            SMALL_EXPLOSION_POWER
        );

        lastClickPosition = null;

        return;

    }

    // Another player eliminated

    const otherEliminated = changedPlayers.some(
        player => !player.isYou && !player.alive
    );

    if (otherEliminated) {

        shakeGrid(onlineGameGrid);

        return;

    }

    // Another player's safe click

    const otherSafeClick = changedPlayers.some(
        player => !player.isYou && player.alive
    );

    if (otherSafeClick) {

        const position = getCenter(onlineGameGrid);

        playSound(POP_SOUND);

        explodePopcorn(
            position.x,
            position.y,
            SMALL_EXPLOSION_COUNT,
            SMALL_EXPLOSION_POWER
        );

    }

}


// =========================
// HANDLE ONLINE CLICK
// =========================

async function handleOnlineClick(index, button) {

    if (
        lobbyActionBusy ||
        button.disabled ||
        !latestState ||
        latestState.roomStatus !== "playing" ||
        !latestState.isYourTurn
    ) {

        return;

    }

    const me = latestState.players.find(
        player => player.isYou
    );

    if (!me || !me.alive) {
        return;
    }

    const turnVersion = latestState.turnVersion;

    lastClickPosition = getCenter(button);

    // Disable all buttons immediately

    setOnlineButtonsEnabled(false);

    onlineGameStatus.textContent = "POPPING...";

    await executeLobbyAction("click", {

        turnVersion

    });

}


// =========================
// CLOSE LOCAL SESSION
// =========================

function closeLobby() {

    stopLobbyPolling();

    stopSound();
    clearAnimations();

    currentRoom = null;
    currentPlayerId = null;

    latestState = null;
    lastClickPosition = null;

    isHost = false;

    playerList.innerHTML = "";
    onlineGamePlayers.innerHTML = "";
    onlineGameGrid.innerHTML = "";

    onlineGame.hidden = true;
    onlineLobby.hidden = true;
    onlineMenu.hidden = false;

    setOnlineStatus("");

}


// =========================
// EXECUTE ONLINE ACTION
// =========================

async function executeLobbyAction(action, extra = {}) {

    if (
        lobbyActionBusy ||
        !currentRoom ||
        !currentPlayerId
    ) {

        return;

    }

    lobbyActionBusy = true;

    stopLobbyPolling();

    leaveRoomButton.disabled = true;
    startGameButton.disabled = true;
    deleteRoomButton.disabled = true;

    onlineGameLeaveButton.disabled = true;
    onlineGameDeleteButton.disabled = true;

    setOnlineButtonsEnabled(false);

    try {

        await apiRequest(action, {

            room: currentRoom,
            playerId: currentPlayerId,
            ...extra

        });

        if (action === "leave") {

            closeLobby();

        } else if (action === "delete") {

            closeLobby();

            setOnlineStatus(
                "Room deleted.",
                "success"
            );

        }

    } catch (error) {

        if (error.status === 404) {

            closeLobby();

            setOnlineStatus(
                error.message,
                "error"
            );

        } else if (action === "click") {

            console.warn("Online click failed:", error);

            onlineGameStatus.textContent =
                "Synchronizing...";

        } else {

            alert(error.message);

        }

    } finally {

        lobbyActionBusy = false;

        leaveRoomButton.disabled = false;
        onlineGameLeaveButton.disabled = false;

        if (currentRoom && currentPlayerId) {

            startLobbyPolling();

        }

    }

}


// =========================
// LEAVE ROOM
// =========================

function leaveRoom() {

    executeLobbyAction("leave");

}


// =========================
// LEAVE GAME
// =========================

function leaveOnlineGame() {

    if (
        latestState?.roomStatus === "playing" &&
        !confirm("Leave the current game?")
    ) {

        return;

    }

    executeLobbyAction("leave");

}


// =========================
// DELETE ROOM
// =========================

function deleteRoom() {

    if (!isHost) {
        return;
    }

    const confirmed = confirm(
        "Delete this room and disconnect all players?"
    );

    if (confirmed) {

        executeLobbyAction("delete");

    }

}


// =========================
// START ONLINE GAME
// =========================

function startOnlineGame() {

    if (!isHost || startGameButton.disabled) {
        return;
    }

    executeLobbyAction("start");

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

    alert("Online mode coming soon!");

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

deleteRoomButton.addEventListener(
    "click",
    deleteRoom
);

startGameButton.addEventListener(
    "click",
    startOnlineGame
);

onlineGameLeaveButton.addEventListener(
    "click",
    leaveOnlineGame
);

onlineGameDeleteButton.addEventListener(
    "click",
    deleteRoom
);