(function () {
  "use strict";

  var canvas = document.getElementById("game");
  var ctx = canvas.getContext("2d");
  var scoreEl = document.getElementById("score");
  var bestEl = document.getElementById("best");
  var livesEl = document.getElementById("lives");
  var overlay = document.getElementById("overlay");
  var startBtn = document.getElementById("startBtn");

  var BEST_KEY = "alienShooterBestScore";
  var COLORS = {
    player: "#40f5dc",
    playerGlow: "rgba(64,245,220,0.5)",
    bullet: "#9df7ec",
    alienBullet: "#ff5c9a",
    alienRows: ["#6c3cdc", "#8a4de0", "#c23cdc", "#ff5c9a"],
    particle: "#40f5dc"
  };

  var W = 0, H = 0, DPR = 1;

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    if (player) player.y = H - 56;
  }

  // ---------------- state ----------------
  var state = "ready"; // ready | playing | gameover
  var score = 0;
  var best = Number(localStorage.getItem(BEST_KEY) || 0);
  var lives = 3;
  var wave = 1;

  var player = null;
  var bullets = [];
  var alienBullets = [];
  var aliens = [];
  var particles = [];

  var keys = {};
  var pointerActive = false;
  var pointerTargetX = null;
  var fireHeld = false;
  var fireCooldown = 0;

  function makePlayer() {
    return { x: W / 2, y: H - 56, w: 34, h: 26, speed: 480, invuln: 0 };
  }

  function spawnWave(n) {
    aliens = [];
    var cols = Math.max(6, Math.min(11, Math.floor((W - 80) / 62)));
    var rows = Math.min(5, 3 + Math.floor(n / 3));
    var spacingX = Math.min(64, (W - 80) / cols);
    var startX = (W - (cols - 1) * spacingX) / 2;
    var startY = 70;
    var speed = 26 + n * 6;

    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        aliens.push({
          x: startX + c * spacingX,
          y: startY + r * 46,
          row: r,
          col: c,
          r: 16,
          alive: true
        });
      }
    }
    formation = { dir: 1, speed: speed, stepDown: 18, edgePad: 20 };
  }

  var formation = { dir: 1, speed: 26, stepDown: 18, edgePad: 20 };

  function resetGame() {
    score = 0;
    lives = 3;
    wave = 1;
    bullets = [];
    alienBullets = [];
    particles = [];
    player = makePlayer();
    spawnWave(wave);
    updateHud();
  }

  function updateHud() {
    scoreEl.textContent = score;
    bestEl.textContent = Math.max(best, score);
    livesEl.textContent = Math.max(0, lives);
  }

  // ---------------- input ----------------
  window.addEventListener("keydown", function (e) {
    keys[e.code] = true;
    if (e.code === "Space") {
      e.preventDefault();
      if (state === "ready" || state === "gameover") startGame();
      fireHeld = true;
    }
    if ((e.code === "Enter") && (state === "ready" || state === "gameover")) startGame();
  });
  window.addEventListener("keyup", function (e) {
    keys[e.code] = false;
    if (e.code === "Space") fireHeld = false;
  });

  canvas.addEventListener("pointerdown", function (e) {
    pointerActive = true;
    fireHeld = true;
    pointerTargetX = e.clientX;
    if (state === "ready" || state === "gameover") startGame();
  });
  canvas.addEventListener("pointermove", function (e) {
    if (pointerActive) pointerTargetX = e.clientX;
  });
  window.addEventListener("pointerup", function () {
    pointerActive = false;
    fireHeld = false;
  });

  startBtn.addEventListener("click", function (e) {
    e.stopPropagation();
    startGame();
  });

  function startGame() {
    resetGame();
    state = "playing";
    overlay.classList.add("hidden");
  }

  function endGame() {
    state = "gameover";
    if (score > best) {
      best = score;
      localStorage.setItem(BEST_KEY, String(best));
    }
    updateHud();
    overlay.classList.remove("hidden");
    overlay.innerHTML =
      '<h1>GAME OVER</h1>' +
      '<p class="score-line">Score ' + score + " &middot; Best " + Math.max(best, score) + "</p>" +
      '<p>Move: <kbd>&larr;</kbd> <kbd>&rarr;</kbd> or drag &middot; Shoot: <kbd>Space</kbd> or tap</p>' +
      '<button id="startBtn" class="btn">Play Again</button>';
    document.getElementById("startBtn").addEventListener("click", function (e) {
      e.stopPropagation();
      startGame();
    });
  }

  // ---------------- entities ----------------
  function fireBullet() {
    if (fireCooldown > 0) return;
    fireCooldown = 0.22;
    bullets.push({ x: player.x, y: player.y - 20, vy: -640 });
  }

  function maybeAlienFire(dt) {
    var chance = 0.35 * dt * (1 + wave * 0.15);
    if (Math.random() < chance) {
      var alive = aliens.filter(function (a) { return a.alive; });
      if (!alive.length) return;
      var shooter = alive[Math.floor(Math.random() * alive.length)];
      alienBullets.push({ x: shooter.x, y: shooter.y + 12, vy: 260 + wave * 8 });
    }
  }

  function spawnExplosion(x, y, color) {
    for (var i = 0; i < 14; i++) {
      var ang = Math.random() * Math.PI * 2;
      var spd = 60 + Math.random() * 140;
      particles.push({
        x: x, y: y,
        vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
        life: 0.4 + Math.random() * 0.3,
        maxLife: 0.4 + Math.random() * 0.3,
        color: color
      });
    }
  }

  function hitPlayer() {
    if (player.invuln > 0) return;
    lives--;
    player.invuln = 1.6;
    spawnExplosion(player.x, player.y, COLORS.player);
    updateHud();
    if (lives <= 0) endGame();
  }

  // ---------------- update ----------------
  function update(dt) {
    if (state !== "playing") return;

    // player movement
    var moveDir = 0;
    if (keys.ArrowLeft || keys.KeyA) moveDir -= 1;
    if (keys.ArrowRight || keys.KeyD) moveDir += 1;
    player.x += moveDir * player.speed * dt;

    if (pointerActive && pointerTargetX != null) {
      var dx = pointerTargetX - player.x;
      player.x += dx * Math.min(1, dt * 10);
    }
    player.x = Math.max(player.w, Math.min(W - player.w, player.x));
    if (player.invuln > 0) player.invuln -= dt;

    // firing
    if (fireCooldown > 0) fireCooldown -= dt;
    if (fireHeld) fireBullet();

    // bullets
    bullets.forEach(function (b) { b.y += b.vy * dt; });
    bullets = bullets.filter(function (b) { return b.y > -20; });

    alienBullets.forEach(function (b) { b.y += b.vy * dt; });
    alienBullets = alienBullets.filter(function (b) { return b.y < H + 20; });

    // alien formation movement
    var aliveAliens = aliens.filter(function (a) { return a.alive; });
    var speedScale = 1 + (1 - aliveAliens.length / aliens.length) * 1.8;
    var dx2 = formation.dir * formation.speed * speedScale * dt;
    var minX = Infinity, maxX = -Infinity;
    aliveAliens.forEach(function (a) {
      a.x += dx2;
      minX = Math.min(minX, a.x - a.r);
      maxX = Math.max(maxX, a.x + a.r);
    });
    if (aliveAliens.length && (minX < formation.edgePad || maxX > W - formation.edgePad)) {
      formation.dir *= -1;
      aliveAliens.forEach(function (a) {
        a.x += formation.dir * formation.speed * speedScale * dt * 2;
        a.y += formation.stepDown;
      });
    }
    maybeAlienFire(dt);

    // reach bottom -> hit player / lose life
    aliveAliens.forEach(function (a) {
      if (a.y + a.r >= player.y - 10) {
        a.alive = false;
        hitPlayer();
      }
    });
    // hitPlayer() may have just ended the game (lives hit 0) — stop here so
    // no further scoring/wave-clear runs against a stale post-game-over state
    if (state !== "playing") return;

    // collisions: player bullets vs aliens
    bullets.forEach(function (b) {
      aliens.forEach(function (a) {
        if (!a.alive || b.hit) return;
        var d = Math.hypot(b.x - a.x, b.y - a.y);
        if (d < a.r + 3) {
          a.alive = false;
          b.hit = true;
          score += 10 + wave * 2;
          spawnExplosion(a.x, a.y, COLORS.alienRows[a.row % COLORS.alienRows.length]);
          updateHud();
        }
      });
    });
    bullets = bullets.filter(function (b) { return !b.hit; });

    // collisions: alien bullets vs player
    alienBullets.forEach(function (b) {
      if (b.hit) return;
      var d = Math.hypot(b.x - player.x, b.y - player.y);
      if (d < player.w * 0.6 + 4) {
        b.hit = true;
        hitPlayer();
      }
    });
    alienBullets = alienBullets.filter(function (b) { return !b.hit; });
    if (state !== "playing") return;

    // particles
    particles.forEach(function (p) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
    });
    particles = particles.filter(function (p) { return p.life > 0; });

    // wave clear
    if (aliens.length && aliens.every(function (a) { return !a.alive; })) {
      score += 50 + wave * 10;
      wave++;
      updateHud();
      spawnWave(wave);
    }
  }

  // ---------------- render ----------------
  function drawPlayer() {
    var flashing = player.invuln > 0 && Math.floor(player.invuln * 12) % 2 === 0;
    if (flashing) return;
    ctx.save();
    ctx.translate(player.x, player.y);
    ctx.shadowColor = COLORS.playerGlow;
    ctx.shadowBlur = 16;
    ctx.fillStyle = COLORS.player;
    ctx.beginPath();
    ctx.moveTo(0, -18);
    ctx.lineTo(16, 14);
    ctx.lineTo(6, 8);
    ctx.lineTo(-6, 8);
    ctx.lineTo(-16, 14);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawAliens() {
    aliens.forEach(function (a) {
      if (!a.alive) return;
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.fillStyle = COLORS.alienRows[a.row % COLORS.alienRows.length];
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      var sides = 6, rad = a.r;
      for (var i = 0; i < sides; i++) {
        var ang = (Math.PI * 2 * i) / sides - Math.PI / 2;
        var px = Math.cos(ang) * rad, py = Math.sin(ang) * rad;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#050308";
      ctx.beginPath();
      ctx.arc(-4, -1, 2.4, 0, Math.PI * 2);
      ctx.arc(4, -1, 2.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  function drawBullets() {
    ctx.fillStyle = COLORS.bullet;
    ctx.shadowColor = COLORS.bullet;
    ctx.shadowBlur = 8;
    bullets.forEach(function (b) {
      ctx.fillRect(b.x - 2, b.y - 8, 4, 14);
    });
    ctx.fillStyle = COLORS.alienBullet;
    ctx.shadowColor = COLORS.alienBullet;
    alienBullets.forEach(function (b) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.shadowBlur = 0;
  }

  function drawParticles() {
    particles.forEach(function (p) {
      var a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    });
    ctx.globalAlpha = 1;
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    if (state === "playing" || state === "gameover") {
      drawAliens();
      drawBullets();
      drawParticles();
      if (state === "playing") drawPlayer();
    }
  }

  // ---------------- loop ----------------
  var lastT = null;
  function loop(t) {
    if (lastT == null) lastT = t;
    var dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  window.addEventListener("resize", resize);
  resize();
  player = makePlayer();
  spawnWave(wave);
  bestEl.textContent = best;
  requestAnimationFrame(loop);
})();
