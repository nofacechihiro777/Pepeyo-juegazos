const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- SETUP & DEVICE DETECTION ---
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
if (isMobile) {
    document.getElementById('joystick-container').style.display = 'block';
    document.getElementById('instructions').style.display = 'none';
}

// --- ASSET LOADING (WITH ROBUST ERROR HANDLING) ---
const baseUrl = "https://raw.githubusercontent.com/nofacechihiro777/Pepeyo-juegazos/main/";
const imageFiles = {
    wall: "1000028706.jpg",
    tree: "1000028703.jpg",
    fence: "1000028700.jpg",
    window: "1000028697.jpg",
    door: "1000028694.jpg",
    logo: "1000028691.jpg",
    tile: "1000028688.jpg",
    carpet: "1000028685.jpg"
};

const images = {};
let imagesLoaded = 0;
const totalImages = Object.keys(imageFiles).length;

for (let key in imageFiles) {
    images[key] = new Image();
    images[key].crossOrigin = "Anonymous";
    
    images[key].onload = () => {
        imagesLoaded++;
        console.log(`[Loaded]: ${key} (${imagesLoaded}/${totalImages})`);
        if (imagesLoaded === totalImages) initGame();
    };

    images[key].onerror = () => {
        console.error(`[FAILED]: Could not load ${imageFiles[key]}`);
        imagesLoaded++; 
        if (imagesLoaded === totalImages) {
            console.warn("Some assets failed, but starting game with fallbacks.");
            initGame();
        }
    };

    images[key].src = baseUrl + imageFiles[key];
}

// --- GAME LOGIC & WORLD DATA ---
const worldSize = 2000;
const player = { x: 1000, y: 1800, radius: 20, speed: 5, color: '#FFD700' };
let input = { x: 0, y: 0 };
let patterns = {};
let obstacles = [];

const mapData = {
    building: { x: 600, y: 600, w: 800, h: 600, wallThickness: 40 },
    door: { w: 120, h: 40 }
};

function initGame() {
    const loader = document.getElementById('loading');
    if (loader) {
        loader.style.opacity = 0;
        setTimeout(() => loader.style.display = 'none', 500);
    }

    // Attempt to create patterns only if images exist
    try {
        if (images.carpet.complete) patterns.carpet = ctx.createPattern(images.carpet, 'repeat');
        if (images.tile.complete) patterns.tile = ctx.createPattern(images.tile, 'repeat');
        if (images.wall.complete) patterns.wall = ctx.createPattern(images.wall, 'repeat');
        if (images.fence.complete) patterns.fence = ctx.createPattern(images.fence, 'repeat');
    } catch (e) { console.error("Pattern error", e); }

    buildObstacles();
    requestAnimationFrame(gameLoop);
}

function buildObstacles() {
    obstacles = [];
    const b = mapData.building;
    const t = b.wallThickness;

    // Building Walls
    obstacles.push({ x: b.x, y: b.y, w: b.w, h: t, type: 'wall' });
    obstacles.push({ x: b.x, y: b.y, w: t, h: b.h, type: 'wall' });
    obstacles.push({ x: b.x + b.w - t, y: b.y, w: t, h: b.h, type: 'wall' });

    // Front Wall + Door gap
    const doorX = b.x + (b.w / 2) - (mapData.door.w / 2);
    obstacles.push({ x: b.x, y: b.y + b.h - t, w: (b.w - mapData.door.w) / 2, h: t, type: 'wall' });
    obstacles.push({ x: doorX + mapData.door.w, y: b.y + b.h - t, w: (b.w - mapData.door.w) / 2, h: t, type: 'wall' });

    // Perimeter
    const fT = 50; 
    obstacles.push({ x: 0, y: 0, w: worldSize, h: fT, type: 'fence' });
    obstacles.push({ x: 0, y: 0, w: fT, h: worldSize, type: 'fence' });
    obstacles.push({ x: 0, y: worldSize - fT, w: worldSize, h: fT, type: 'fence' });
    obstacles.push({ x: worldSize - fT, y: 0, w: fT, h: worldSize, type: 'fence' });

    // Random Trees
    for (let i = 0; i < 25; i++) {
        let tx = Math.random() * (worldSize - 200) + 100;
        let ty = Math.random() * (worldSize - 200) + 100;
        if (tx > b.x - 100 && tx < b.x + b.w + 100 && ty > b.y - 100 && ty < b.y + b.h + 100) continue;
        obstacles.push({ x: tx, y: ty, w: 80, h: 80, type: 'tree' });
    }
}

// --- CONTROLS ---
const keys = { w: false, a: false, s: false, d: false };
window.addEventListener('keydown', (e) => { const key = e.key.toLowerCase(); if (keys.hasOwnProperty(key)) keys[key] = true; });
window.addEventListener('keyup', (e) => { const key = e.key.toLowerCase(); if (keys.hasOwnProperty(key)) keys[key] = false; });

const joyContainer = document.getElementById('joystick-base');
const joyStick = document.getElementById('joystick-stick');
let joyActive = false;
let joyOrigin = { x: 0, y: 0 };
const maxJoyRadius = 40;

joyContainer.addEventListener('touchstart', (e) => {
    joyActive = true;
    const rect = joyContainer.getBoundingClientRect();
    joyOrigin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    handleJoystickMove(e.touches[0]);
});
joyContainer.addEventListener('touchmove', (e) => {
    if (!joyActive) return;
    e.preventDefault();
    handleJoystickMove(e.touches[0]);
});
joyContainer.addEventListener('touchend', () => {
    joyActive = false;
    joyStick.style.transform = `translate(-50%, -50%)`;
    input = { x: 0, y: 0 };
});

function handleJoystickMove(touch) {
    let dx = touch.clientX - joyOrigin.x;
    let dy = touch.clientY - joyOrigin.y;
    let distance = Math.hypot(dx, dy);
    if (distance > maxJoyRadius) { dx = (dx / distance) * maxJoyRadius; dy = (dy / distance) * maxJoyRadius; }
    joyStick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    input.x = dx / maxJoyRadius;
    input.y = dy / maxJoyRadius;
}

// --- PHYSICS ---
function circleRectCollide(circle, rect) {
    let testX = circle.x;
    let testY = circle.y;
    if (circle.x < rect.x) testX = rect.x; else if (circle.x > rect.x + rect.w) testX = rect.x + rect.w;
    if (circle.y < rect.y) testY = rect.y; else if (circle.y > rect.y + rect.h) testY = rect.y + rect.h;
    return Math.hypot(circle.x - testX, circle.y - testY) <= circle.radius;
}

// --- ENGINE ---
function update() {
    if (!isMobile) {
        input.x = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
        input.y = (keys.s ? 1 : 0) - (keys.w ? 1 : 0);
        if (input.x !== 0 && input.y !== 0) { const len = Math.hypot(input.x, input.y); input.x /= len; input.y /= len; }
    }
    let nextX = player.x + input.x * player.speed;
    let nextY = player.y + input.y * player.speed;
    let canMoveX = true; let canMoveY = true;
    for (let obs of obstacles) {
        if (circleRectCollide({ x: nextX, y: player.y, radius: player.radius }, obs)) canMoveX = false;
        if (circleRectCollide({ x: player.x, y: nextY, radius: player.radius }, obs)) canMoveY = false;
    }
    if (canMoveX) player.x = nextX;
    if (canMoveY) player.y = nextY;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    let camX = Math.max(0, Math.min(player.x - canvas.width / 2, worldSize - canvas.width));
    let camY = Math.max(0, Math.min(player.y - canvas.height / 2, worldSize - canvas.height));
    ctx.translate(-camX, -camY);

    ctx.fillStyle = patterns.carpet || '#333333';
    ctx.fillRect(0, 0, worldSize, worldSize);

    const b = mapData.building;
    const t = b.wallThickness;
    ctx.fillStyle = patterns.tile || '#555555';
    ctx.fillRect(b.x + t, b.y + t, b.w - t*2, b.h - t*2);

    if (images.logo.complete) ctx.drawImage(images.logo, b.x + 200, b.y + 225, 400, 150);
    const doorX = b.x + (b.w / 2) - (mapData.door.w / 2);
    if (images.door.complete) ctx.drawImage(images.door, doorX, b.y + b.h - t, mapData.door.w, t);
    if (images.window.complete) {
        ctx.drawImage(images.window, b.x + 100, b.y + b.h - t, 120, t);
        ctx.drawImage(images.window, b.x + b.w - 220, b.y + b.h - t, 120, t);
    }

    for (let obs of obstacles) {
        if (obs.type === 'wall') {
            ctx.fillStyle = patterns.wall || '#8B4513';
            ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
            ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
        } else if (obs.type === 'fence') {
            ctx.fillStyle = patterns.fence || '#A52A2A';
            ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        } else if (obs.type === 'tree' && images.tree.complete) {
            ctx.drawImage(images.tree, obs.x - 10, obs.y - 20, obs.w + 20, obs.h + 20);
        }
    }

    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fillStyle = player.color;
    ctx.fill();
    ctx.restore();
}

function gameLoop() { update(); draw(); requestAnimationFrame(gameLoop); }
window.addEventListener('resize', () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; });
