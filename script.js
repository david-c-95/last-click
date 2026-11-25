
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


// =========================
// HTML ELEMENTS
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
// GAME VARIABLES
// =========================

let trapIndex;
let safeClicks;
let gameOver;


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

        // Random direction

        const angle = Math.random() * Math.PI * 2;

        // Random distance

        const distance =
            (100 + Math.random() * 500) * power;

        const moveX = Math.cos(angle) * distance;
        const moveY = Math.sin(angle) * distance;

        // Random appearance

        const size = 20 + Math.random() * 55;
        const rotation = Math.random() * 1440 - 720;
        const duration = 0.8 + Math.random() * 1.2;

        // Starting position

        particle.style.left = `${x}px`;
        particle.style.top = `${y}px`;

        // Animation properties

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

        // Remove particle after animation

        particle.addEventListener("animationend", () => {

            particle.remove();

        }, { once: true });

        // Fallback cleanup

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


    // Create buttons

    for (let i = 0; i < BUTTON_COUNT; i++) {

        const button = document.createElement("button");

        button.className = "game-button";

        button.setAttribute(
            "aria-label",
            `Popcorn ${i + 1}`
        );


        // Custom image

        const img = document.createElement("img");

        img.alt = "";
        img.draggable = false;


        // Fallback if image is missing

        img.addEventListener("error", () => {

            if (button.contains(img)) {
                button.textContent = "🍿";
            }

        });

        img.src = BUTTON_IMAGE;

        button.appendChild(img);


        // Click event

        button.addEventListener("click", () => {

            handleClick(i, button);

        });

        gameGrid.appendChild(button);

    }

}


// =========================
// HANDLE CLICK
// =========================

function handleClick(index, button) {

    if (gameOver || button.disabled) {
        return;
    }


    // Trap

    if (index === trapIndex) {

        endGame(false);
        return;

    }


    // Safe click

    safeClicks++;

    button.classList.add("safe");
    button.disabled = true;

    gameScore.textContent =
        `Safe clicks: ${safeClicks}/${BUTTON_COUNT - 1}`;


    // Victory

    if (safeClicks === BUTTON_COUNT - 1) {

        endGame(true);
        return;

    }


    // Popcorn sound

    playSound(POP_SOUND);


    // Small popcorn explosion

    const rect = button.getBoundingClientRect();

    explodePopcorn(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
        SMALL_EXPLOSION_COUNT,
        SMALL_EXPLOSION_POWER
    );

}


// =========================
// END GAME
// =========================

function endGame(win) {

    gameOver = true;

    const buttons =
        gameGrid.querySelectorAll(".game-button");


    // Disable all buttons

    buttons.forEach(button => {

        button.disabled = true;

    });


    // Reveal trap

    buttons[trapIndex].classList.add("trap");


    // Victory

    if (win) {

        gameStatus.textContent = "YOU WIN!";
        gameStatus.className = "win";


        // Random victory sound

        playRandomSound("win");


        // Mega popcorn explosion

        const rect = gameGrid.getBoundingClientRect();

        explodePopcorn(
            rect.left + rect.width / 2,
            rect.top + rect.height / 2,
            WIN_EXPLOSION_COUNT,
            WIN_EXPLOSION_POWER
        );


        // Green glow

        gameGrid.classList.add("victory-glow");

    }


    // Defeat

    else {

        gameStatus.textContent = "GAME OVER";
        gameStatus.className = "lose";


        // Random defeat sound

        playRandomSound("lose");


        // Shake cylinder

        gameGrid.classList.add("shake");

    }


    restartButton.hidden = false;

}


// =========================
// NAVIGATION
// =========================

soloButton.addEventListener("click", () => {

    mainMenu.hidden = true;
    soloGame.hidden = false;

    startSoloGame();

});


restartButton.addEventListener("click", startSoloGame);


backButton.addEventListener("click", () => {

    gameOver = true;

    stopSound();
    clearAnimations();

    soloGame.hidden = true;
    mainMenu.hidden = false;

});


onlineButton.addEventListener("click", () => {

    alert("Online mode coming soon!");

});
