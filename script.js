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

// --- ASSET LOADING ---
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
    images[key].src = baseUrl + imageFiles[key];
    images[key].onload = () => {
        imagesLoaded++;
        if (imagesLoaded === totalImages) {
            initGame();
        }
    };
}

// --- GAME LOGIC & WORLD DATA ---
const worldSize = 2000;
const player = { x: 1000, y: 1800, radius: 20, speed: 5, color: '#FFD700' };
let input = { x: 0, y: 0 };
let patterns = {};
let obstacles = [];

// Define Map Elements
const mapData = {
    building: { x: 600, y: 600, w: 800, h: 600, wallThickness: 40 },
    door: { w: 120, h: 40 }
};

function initGame() {
    document.getElementById('loading').style.opacity = 0;
    setTimeout(() => document.getElementById('loading').style.display = 'none', 500);

    // Create texture patterns
    patterns.carpet = ctx.createPattern(images.carpet, 'repeat');
    patterns.tile = ctx.createPattern(images.tile, 'repeat');
    patterns.wall = ctx.createPattern(images.wall, 'repeat');
    patterns.fence = ctx.createPattern(images.fence, 'repeat');

    buildObstacles();
    requestAnimationFrame(gameLoop);
}

function buildObstacles() {
    obstacles = [];
    const b = mapData.building;
    const t = b.wallThickness;

    // Building Walls (Top, Left, Right)
    obstacles.push({ x: b.x, y: b.y, w: b.w, h: t, type: 'wall' });
    obstacles.push({ x: b.x, y: b.y, w: t, h: b.h, type: 'wall' });
    obstacles.push({ x: b.x + b.w - t, y: b.y, w: t, h: b.h, type: 'wall' });

    // Front Wall (Split for Door)
    const doorX = b.x + (b.w / 2) - (mapData.door.w / 2);
    obstacles.push({ x: b.x, y: b.y + b.h - t, w: (b.w - mapData.door.w) / 2, h: t, type: 'wall' });
    obstacles.push({ x: doorX + mapData.door.w, y: b.y + b.h - t, w: (b.w - mapData.door.w) / 2, h: t, type: 'wall' });

    // Boundary Fences
    const fT = 50; // fence thickness
    obstacles.push({ x: 0, y: 0, w: worldSize, h: fT, type: 'fence' });
    obstacles.push({ x: 0, y: 0, w: fT, h: worldSize, type: 'fence' });
    obstacles.push({ x: 0, y: worldSize - fT, w: worldSize, h: fT, type: 'fence' });
    obstacles.push({ x: worldSize - fT, y: 0, w: fT, h: worldSize, type: 'fence' });

    // Random Trees outside building
    for (let i = 0; i < 25; i++) {
        let tx = Math.random() * (worldSize - 200) + 100;
        let ty = Math.random() * (worldSize - 200) + 100;
        // Don't spawn trees inside the building or on the player
        if (tx > b.x - 100 && tx < b.x + b.w + 100 && ty > b.y - 100 && ty < b.y + b.h + 100) continue;
        obstacles.push({ x: tx, y: ty, w: 80, h: 80, type: 'tree' });
    }
}

// --- CONTROLS ---

// PC (Keyboard)
const keys = { w: false, a: false, s: false, d: false };
window.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) keys[key] = true;
});
window.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (keys.hasOwnProperty(key)) keys[key] = false;
});

// Mobile (Joystick)
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
    
    if (distance > maxJoyRadius) {
        dx = (dx / distance) * maxJoyRadius;
        dy = (dy / distance) * maxJoyRadius;
        distance = maxJoyRadius;
    }
    
    joyStick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    input.x = dx / maxJoyRadius;
    input.y = dy / maxJoyRadius;
}

// --- COLLISION DETECTION ---
function circleRectCollide(circle, rect) {
    let testX = circle.x;
    let testY = circle.y;

    if (circle.x < rect.x) testX = rect.x;
    else if (circle.x > rect.x + rect.w) testX = rect.x + rect.w;

    if (circle.y < rect.y) testY = rect.y;
    else if (circle.y > rect.y + rect.h) testY = rect.y + rect.h;

    let distX = circle.x - testX;
    let distY = circle.y - testY;
    let distance = Math.hypot(distX, distY);

    return distance <= circle.radius;
}

// --- MAIN LOOP & RENDERING ---
function update() {
    if (!isMobile) {
        input.x = (keys.d ? 1 : 0) - (keys.a ? 1 : 0);
        input.y = (keys.s ? 1 : 0) - (keys.w ? 1 : 0);
        
        // Normalize diagonal movement
        if (input.x !== 0 && input.y !== 0) {
            const length = Math.hypot(input.x, input.y);
            input.x /= length;
            input.y /= length;
        }
    }

    let nextX = player.x + input.x * player.speed;
    let nextY = player.y + input.y * player.speed;

    // Resolve Collisions
    let canMoveX = true;
    let canMoveY = true;

    for (let obs of obstacles) {
        if (circleRectCollide({ x: nextX, y: player.y, radius: player.radius }, obs)) canMoveX = false;
        if (circleRectCollide({ x: player.x, y: nextY, radius: player.radius }, obs)) canMoveY = false;
    }

    if (canMoveX) player.x = nextX;
    if (canMoveY) player.y = nextY;
}

function draw() {
    // Clear & setup Camera
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    
    let camX = player.x - canvas.width / 2;
    let camY = player.y - canvas.height / 2;
    // Clamp camera to world bounds
    camX = Math.max(0, Math.min(camX, worldSize - canvas.width));
    camY = Math.max(0, Math.min(camY, worldSize - canvas.height));
    
    ctx.translate(-camX, -camY);

    // 1. Draw Outside Floor (Carpet)
    ctx.fillStyle = patterns.carpet;
    ctx.fillRect(0, 0, worldSize, worldSize);

    // 2. Draw Inside Building Floor (Tile)
    const b = mapData.building;
    const t = b.wallThickness;
    ctx.fillStyle = patterns.tile;
    ctx.fillRect(b.x + t, b.y + t, b.w - t*2, b.h - t*2);

    // 3. Draw Logo in center of building
    const logoW = 400;
    const logoH = 150;
    ctx.drawImage(images.logo, b.x + (b.w/2) - (logoW/2), b.y + (b.h/2) - (logoH/2), logoW, logoH);

    // 4. Draw Doors & Windows on building
    const doorX = b.x + (b.w / 2) - (mapData.door.w / 2);
    ctx.drawImage(images.door, doorX, b.y + b.h - t, mapData.door.w, t);
    
    // Windows on front wall
    ctx.drawImage(images.window, b.x + 100, b.y + b.h - t, 120, t);
    ctx.drawImage(images.window, b.x + b.w - 220, b.y + b.h - t, 120, t);

    // 5. Draw Obstacles (Walls, Fences, Trees)
    for (let obs of obstacles) {
        if (obs.type === 'wall') {
            ctx.fillStyle = patterns.wall;
            ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
            ctx.strokeStyle = '#555';
            ctx.strokeRect(obs.x, obs.y, obs.w, obs.h);
        } else if (obs.type === 'fence') {
            ctx.fillStyle = patterns.fence;
            ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
        } else if (obs.type === 'tree') {
            // Draw tree slightly larger than its hitbox for 3D effect
            ctx.drawImage(images.tree, obs.x - 10, obs.y - 20, obs.w + 20, obs.h + 20);
        }
    }

    // 6. Draw Player
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fillStyle = player.color;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#333';
    ctx.stroke();

    ctx.restore();
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Handle Window Resize
window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});
