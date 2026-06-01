const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const scoreVal = document.getElementById("scoreVal");
const highScoreVal = document.getElementById("highScoreVal");
const gameOverScreen = document.getElementById("game-over-screen");
const restartBtn = document.getElementById("restartBtn");

// Game Settings
let score = 0;
let highScore = localStorage.getItem("balancer_high_score") || 0;
highScoreVal.innerText = highScore;
let gameOver = false;
let gameSpeed = 5;
let animationId;

const GRAVITY = 0.55;
const GROUND_Y = 330;

// 1. Runner Configuration
const player = {
    x: 160,
    y: GROUND_Y - 50,
    width: 32,
    height: 50,
    vy: 0,
    isGrounded: false,
    platformWidth: 150,
    platformHeight: 10,
    platformTilt: 0, 
    maxTilt: 0.6,      // Limit max tilt angle (~34 degrees)
    tiltSpeed: 0.04
};

// 2. Ball Object (Balanced on top of the player)
const ball = {
    localX: 0,         // X relative to the center-top of the player's platform
    radius: 10,
    vx: 0,
    parentYOffset: -28 // Sitting slightly above the platform line
};

// 3. Obstacles Structure
let obstacles = [];
let obstacleTimer = 0;

// Tracking Keys
const keys = {};

window.addEventListener("keydown", (e) => {
    keys[e.code] = true;
    
    // Jump trigger
    if (e.code === "Space" && player.isGrounded && !gameOver) {
        player.vy = -12;
        player.isGrounded = false;
    }
    // Restart trigger
    if (e.code === "Space" && gameOver) {
        resetGame();
    }
});

window.addEventListener("keyup", (e) => {
    keys[e.code] = false;
});

restartBtn.addEventListener("click", resetGame);

function resetGame() {
    cancelAnimationFrame(animationId);
    score = 0;
    gameSpeed = 5;
    gameOver = false;
    obstacles = [];
    obstacleTimer = 0;
    
    player.y = GROUND_Y - 50;
    player.vy = 0;
    player.platformTilt = 0;
    
    ball.localX = 0;
    ball.vx = 0;
    
    scoreVal.innerText = score;
    gameOverScreen.classList.add("hidden");
    animate();
}

function spawnObstacle() {
    // Generate variable height block obstacles
    const height = Math.random() * 25 + 25;
    obstacles.push({
        x: canvas.width,
        y: GROUND_Y - height,
        width: 24,
        height: height
    });
}

function handleGameOver() {
    gameOver = true;
    if (score > highScore) {
        highScore = score;
        localStorage.setItem("balancer_high_score", highScore);
        highScoreVal.innerText = highScore;
    }
    gameOverScreen.classList.remove("hidden");
}

function animate() {
    if (gameOver) return;

    animationId = requestAnimationFrame(animate);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dynamic Progression Loop
    score++;
    scoreVal.innerText = score;
    if (score % 600 === 0) gameSpeed += 0.6; // Scale up difficulty over time

    // --- DRAW BACKGROUND SCENERY ---
    ctx.fillStyle = "#161d2a";
    ctx.fillRect(0, GROUND_Y, canvas.width, canvas.height - GROUND_Y); // Ground line
    ctx.strokeStyle = "#2d3542";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(canvas.width, GROUND_Y);
    ctx.stroke();

    // --- RUNNER LOGIC ---
    player.vy += GRAVITY;
    player.y += player.vy;

    if (player.y >= GROUND_Y - player.height) {
        player.y = GROUND_Y - player.height;
        player.vy = 0;
        player.isGrounded = true;
    }

    // Capture Tilt commands (Arrow keys or A/D handles)
    if (keys["ArrowLeft"] || keys["KeyA"]) player.platformTilt -= player.tiltSpeed;
    if (keys["ArrowRight"] || keys["KeyD"]) player.platformTilt += player.tiltSpeed;
    
    // Smooth auto-centering drag when inputs cease
    if (!keys["ArrowLeft"] && !keys["KeyA"] && !keys["ArrowRight"] && !keys["KeyD"]) {
        player.platformTilt *= 0.88; 
    }
    player.platformTilt = Math.max(-player.maxTilt, Math.min(player.maxTilt, player.platformTilt));

    // Render Runner Character
    ctx.fillStyle = "#00ff87"; 
    ctx.fillRect(player.x, player.y, player.width, player.height);

    // Render Balanced Platform (Transforms & Rotations)
    ctx.save();
    let platformCenterX = player.x + player.width / 2;
    let platformCenterY = player.y; 
    ctx.translate(platformCenterX, platformCenterY);
    ctx.rotate(player.platformTilt);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(-player.platformWidth / 2, -player.platformHeight, player.platformWidth, player.platformHeight);
    ctx.restore();

    // --- PHYSICS BALANCE ENGINE ---
    // Acceleration calculated from slope components: Force = mass * gravity * sin(angle)
    let ballAcceleration = 0.28 * Math.sin(player.platformTilt);
    ball.vx += ballAcceleration;
    ball.vx *= 0.97; // Surface resistance damping factor
    ball.localX += ball.vx;

    // Project Local Coordinates back into Global Space Coordinates
    let globalBallX = platformCenterX + ball.localX * Math.cos(player.platformTilt) - ball.parentYOffset * Math.sin(player.platformTilt);
    let globalBallY = platformCenterY + ball.localX * Math.sin(player.platformTilt) + ball.parentYOffset * Math.cos(player.platformTilt);

    // Fail Condition check: Did the ball slide past platform extents?
    if (Math.abs(ball.localX) > player.platformWidth / 2 + ball.radius) {
        handleGameOver();
    }

    // Render Moving Ball
    ctx.beginPath();
    ctx.arc(globalBallX, globalBallY - ball.radius, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = "#3a86ff";
    ctx.fill();
    ctx.closePath();

    // --- OBSTACLES STREAM ---
    obstacleTimer++;
    if (obstacleTimer > Math.max(50, 140 - gameSpeed * 4)) {
        spawnObstacle();
        obstacleTimer = 0;
    }

    for (let i = obstacles.length - 1; i >= 0; i--) {
        let obs = obstacles[i];
        obs.x -= gameSpeed;

        // Render Obstacle Blocks
        ctx.fillStyle = "#ff0055";
        ctx.fillRect(obs.x, obs.y, obs.width, obs.height);

        // Bounding box collision detection
        if (obs.x < player.x + player.width &&
            obs.x + obs.width > player.x &&
            obs.y < player.y + player.height &&
            obs.y + obs.height > player.y) {
                handleGameOver();
        }

        // Clean memory for items scrolling off-screen
        if (obs.x + obs.width < 0) {
            obstacles.splice(i, 1);
        }
    }
}

// Boot setup
resetGame();