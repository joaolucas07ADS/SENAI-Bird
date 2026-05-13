/**
 * Este arquivo é o "cérebro" do jogo estilo Flappy Bird.
 * Ele desenha na tela, faz o passarinho cair, move os canos e conta os pontos.
 * Usamos só JavaScript puro, sem bibliotecas.
 *
 * Figurinhas (imagens):
 * - passarinho (bird.png), cano de baixo, cano de cima, e o fundo bonito no CSS.
 */

// Esta função envolve TUDO numa caixinha fechada.
// Assim os nomes das variáveis não brigam com outros scripts da página.
(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // BLOCO: PEGAR AS PEÇAS DA PÁGINA (HTML)
  // É como apontar para cada desenho ou botão que já existe no index.html
  // para podermos mudar o texto, desenhar no quadrado do jogo, etc.
  // ---------------------------------------------------------------------------
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const scoreDisplay = document.getElementById("scoreDisplay");
  const timeDisplay = document.getElementById("timeDisplay");
  const startOverlay = document.getElementById("startOverlay");
  const gameOverOverlay = document.getElementById("gameOverOverlay");
  const finalScore = document.getElementById("finalScore");
  const finalTime = document.getElementById("finalTime");
  const btnRestart = document.getElementById("btnRestart");

  // ---------------------------------------------------------------------------
  // BLOCO: TAMANHO DO "QUADRO" ONDE DESENHAMOS O JOGO
  // O canvas tem largura W e altura H em "pixels de jogo".
  // Tudo que contamos (passarinho, canos) usa esses números.
  // ---------------------------------------------------------------------------
  const W = canvas.width;
  const H = canvas.height;

  // ---------------------------------------------------------------------------
  // BLOCO: NÚMEROS MÁGICOS DO JOGO (REGRAS FIXAS)
  // Aqui a gente escolhe: quão forte é a gravidade, quão alto o passo pula,
  // quão grossos são os canos, etc. Se mudar aqui, o jogo fica mais fácil ou mais difícil.
  // ---------------------------------------------------------------------------
  const GRAVITY = 1650;
  const JUMP_VELOCITY = -520;
  const BIRD_START_X = W * 0.28;
  const BIRD_WIDTH = 48;
  const BIRD_HEIGHT = 36;
  /** Quão alto é o chãozinho marrom embaixo (onde não pode bater). */
  const GROUND_HEIGHT = 72;
  const GAP_MIN = 130;
  const GAP_MAX = 200;
  const PIPE_WIDTH = 72;
  /** Quão longe um par de canos nasce do outro (na horizontal). */
  const PIPE_SPACING = 220;
  /** No começo os canos andam devagar; depois aceleram um pouquinho. */
  const BASE_PIPE_SPEED = 140;
  /** Velocidade máxima dos canos (senão fica impossível demais). */
  const MAX_PIPE_SPEED = 320;
  /** A cada segundo que passa, os canos ficam um pouquinho mais rápidos. */
  const SPEED_RAMP_PER_SEC = 4;

  // ---------------------------------------------------------------------------
  // BLOCO: EM QUE "FASE" DA BRINCADEIRA ESTAMOS
  // READY = esperando você apertar espaço ou clicar
  // PLAYING = jogo rodando de verdade
  // GAMEOVER = bateu em algo; mostramos a telinha de fim
  // ---------------------------------------------------------------------------
  const State = {
    READY: "ready",
    PLAYING: "playing",
    GAMEOVER: "gameover",
  };

  let gameState = State.READY;
  let score = 0;
  /** Guardamos o "relógio" de quando a partida começou, para saber quanto tempo passou. */
  let playStartTime = 0;
  let lastFrameTime = 0;
  let animationId = null;

  // ---------------------------------------------------------------------------
  // BLOCO: O PASSARINHO (ONDE ELE ESTÁ E COMO CAI)
  // x,y = posição na tela
  // vy = velocidade para cima ou para baixo (negativo sobe, positivo desce)
  // w,h = tamanho do desenho
  // flapPhase = ajuda na animação das asinhas
  // ---------------------------------------------------------------------------
  const bird = {
    x: BIRD_START_X,
    y: H / 2,
    vy: 0,
    w: BIRD_WIDTH,
    h: BIRD_HEIGHT,
    flapPhase: 0,
  };

  // ---------------------------------------------------------------------------
  // BLOCO: LISTA DE CANOS
  // Cada item da lista é um "par" (em cima e embaixo) com um buraco no meio.
  // ---------------------------------------------------------------------------
  let pipes = [];
  /** Ajuda a saber onde colocar o próximo cano quando a lista está vazia. */
  let nextPipeX = W;

  // ---------------------------------------------------------------------------
  // BLOCO: CARREGAR AS FIGURINHAS (IMAGENS)
  // O navegador busca os arquivos na pasta Sprites.
  // Se a figurinha não abrir, a gente desenha um desenho simples no lugar (reserva).
  // ---------------------------------------------------------------------------
  const imgBird = new Image();
  const imgPipe = new Image();
  /** Figurinha do cano que vem do TETO (boca para baixo). */
  const imgPipeTop = new Image();
  let birdOk = false;
  let pipeOk = false;
  let pipeTopOk = false;

  // Passarinho: quando a foto termina de carregar, birdOk vira true.
  imgBird.onload = function () {
    birdOk = true;
  };
  imgBird.onerror = function () {
    birdOk = false;
    console.warn("Não foi possível carregar Sprites/Bird.png — usando desenho reserva.");
  };
  imgBird.src = "Sprites/Bird.png";

  // Cano de baixo: o que sai do chão para cima.
  imgPipe.onload = function () {
    pipeOk = true;
  };
  imgPipe.onerror = function () {
    pipeOk = false;
    console.warn("Não foi possível carregar Sprites/cano.png — usando desenho reserva.");
  };
  imgPipe.src = "Sprites/cano.png";

  // Cano de cima: o que pendura do teto.
  imgPipeTop.onload = function () {
    pipeTopOk = true;
  };
  imgPipeTop.onerror = function () {
    pipeTopOk = false;
    console.warn(
      "Não foi possível carregar Sprites/Cano (1).png — cano de cima em desenho reserva."
    );
  };
  imgPipeTop.src = "Sprites/Cano (1).png";

  // ---------------------------------------------------------------------------
  // BLOCO: VELOCIDADE DOS CANOS (FICA MAIS RÁPIDO COM O TEMPO)
  // Quanto mais tempo você joga, um pouquinho mais rápido os canos vêm.
  // Mas nunca passa do MAX_PIPE_SPEED, para não virar um furacão infinito.
  // ---------------------------------------------------------------------------
  function getPipeSpeed() {
    if (gameState !== State.PLAYING || playStartTime <= 0) {
      return BASE_PIPE_SPEED;
    }
    const elapsedSec = (performance.now() - playStartTime) / 1000;
    const ramp = elapsedSec * SPEED_RAMP_PER_SEC;
    return Math.min(BASE_PIPE_SPEED + ramp, MAX_PIPE_SPEED);
  }

  // ---------------------------------------------------------------------------
  // BLOCO: TRANSFORMAR MILISSEGUNDOS EM "MINUTOS:SEGUNDOS"
  // É só para mostrar bonitinho na tela, tipo relógio de cozinha (00:00).
  // ---------------------------------------------------------------------------
  function formatTime(ms) {
    const totalSec = Math.floor(ms / 1000);
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }

  // ---------------------------------------------------------------------------
  // BLOCO: ATUALIZAR O TEXTO DE PONTOS E TEMPO NA TELA
  // Enquanto não começou a jogar de verdade, o tempo fica em 00:00.
  // ---------------------------------------------------------------------------
  function updateHud() {
    scoreDisplay.textContent = String(score);
    if (gameState === State.PLAYING && playStartTime > 0) {
      timeDisplay.textContent = formatTime(performance.now() - playStartTime);
    } else if (gameState === State.READY) {
      timeDisplay.textContent = "00:00";
    }
  }

  // ---------------------------------------------------------------------------
  // BLOCO: COMEÇAR TUDO DE NOVO (BOTÃO "JOGAR NOVAMENTE" OU PRIMEIRA VEZ)
  // Zera pontos, coloca o passarinho no meio, apaga os canos velhos
  // e mostra a telinha "aperte espaço".
  // ---------------------------------------------------------------------------
  function resetGame() {
    score = 0;
    playStartTime = 0;
    bird.x = BIRD_START_X;
    bird.y = H / 2 - bird.h / 2;
    bird.vy = 0;
    bird.flapPhase = 0;
    pipes = [];
    nextPipeX = W + 40;
    gameState = State.READY;
    lastFrameTime = performance.now();
    startOverlay.classList.remove("overlay--hidden");
    gameOverOverlay.classList.add("overlay--hidden");
    updateHud();
  }

  // ---------------------------------------------------------------------------
  // BLOCO: COMEÇAR A PARTIDA DE VERDADE
  // Esconde a telinha inicial, liga o cronômetro e dá o primeiro empurrão no passarinho.
  // ---------------------------------------------------------------------------
  function startPlaying() {
    if (gameState === State.PLAYING) return;
    gameState = State.PLAYING;
    playStartTime = performance.now();
    startOverlay.classList.add("overlay--hidden");
    bird.vy = JUMP_VELOCITY;
  }

  // ---------------------------------------------------------------------------
  // BLOCO: GAME OVER (BATEU EM ALGO)
  // Para o "estado" de jogando, mostra quanto você fez e abre a telinha escura.
  // ---------------------------------------------------------------------------
  function gameOver() {
    gameState = State.GAMEOVER;
    const elapsed =
      playStartTime > 0 ? performance.now() - playStartTime : 0;
    finalScore.textContent = String(score);
    finalTime.textContent = formatTime(elapsed);
    gameOverOverlay.classList.remove("overlay--hidden");
  }

  // ---------------------------------------------------------------------------
  // BLOCO: NASCER UM PAR DE CANOS NOVINHOS
  // A gente escolhe no "sorteio" onde fica o buraco (gap) para o passarinho passar.
  // ---------------------------------------------------------------------------
  function spawnPipe(x) {
    const gapH = GAP_MIN + Math.random() * (GAP_MAX - GAP_MIN);
    const margin = 80;
    const minGapY = margin;
    const maxGapY = H - GROUND_HEIGHT - margin - gapH;
    const gapY = minGapY + Math.random() * Math.max(1, maxGapY - minGapY);
    pipes.push({
      x,
      gapY,
      gapH,
      scored: false,
    });
  }

  // ---------------------------------------------------------------------------
  // BLOCO: A "CAIXINHA INVISÍVEL" DO PASSARINHO (HITBOX)
  // Para colisão não ficar injusta, encolhemos um pouquinho a caixa em volta do desenho.
  // É como se o passarinho fosse um retângulo invisível no meio do desenho.
  // ---------------------------------------------------------------------------
  function getBirdHitbox() {
    const pad = 6;
    return {
      left: bird.x + pad,
      top: bird.y + pad,
      right: bird.x + bird.w - pad,
      bottom: bird.y + bird.h - pad,
    };
  }

  // ---------------------------------------------------------------------------
  // BLOCO: DOIS RETÂNGULOS SE TOCARAM?
  // Se dois quadrados de papel se sobrepõem na mesa, devolve true. Senão, false.
  // ---------------------------------------------------------------------------
  function aabbOverlap(a, b) {
    return (
      a.left < b.right &&
      a.right > b.left &&
      a.top < b.bottom &&
      a.bottom > b.top
    );
  }

  // ---------------------------------------------------------------------------
  // BLOCO: BATEU EM ALGUMA COISA?
  // Testa teto, chão e os dois pedaços de cano (cima e baixo) de cada par.
  // Se bateu, devolve true para o jogo gritar "Game Over!".
  // ---------------------------------------------------------------------------
  function checkCollisions() {
    const birdBox = getBirdHitbox();

    if (birdBox.top <= 0 || birdBox.bottom >= H - GROUND_HEIGHT) {
      return true;
    }

    for (let i = 0; i < pipes.length; i++) {
      const p = pipes[i];
      const pipeLeft = p.x;
      const pipeRight = p.x + PIPE_WIDTH;

      const topPipe = {
        left: pipeLeft,
        top: 0,
        right: pipeRight,
        bottom: p.gapY,
      };
      const bottomPipe = {
        left: pipeLeft,
        top: p.gapY + p.gapH,
        right: pipeRight,
        bottom: H - GROUND_HEIGHT,
      };

      if (
        aabbOverlap(birdBox, topPipe) ||
        aabbOverlap(birdBox, bottomPipe)
      ) {
        return true;
      }
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // BLOCO: GANHAR PONTO AO PASSAR PELO MEIO DOS CANOS
  // Quando o meio do passarinho passa do meio do cano, ganha +1 ponto
  // (só uma vez por par de canos, graças ao "scored").
  // ---------------------------------------------------------------------------
  function updateScoring() {
    const cx = bird.x + bird.w / 2;
    for (let i = 0; i < pipes.length; i++) {
      const p = pipes[i];
      if (p.scored) continue;
      const mid = p.x + PIPE_WIDTH / 2;
      if (cx > mid) {
        p.scored = true;
        score += 1;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // BLOCO: DESENHAR O CHÃO MARROM COM UMA FAIXINHA VERDE CLARA EM CIMA
  // É só pintura bonita na parte de baixo do canvas.
  // ---------------------------------------------------------------------------
  function drawGround() {
    const gy = H - GROUND_HEIGHT;
    const grd = ctx.createLinearGradient(0, gy, 0, H);
    grd.addColorStop(0, "#5d4037");
    grd.addColorStop(0.4, "#6d4c41");
    grd.addColorStop(1, "#3e2723");
    ctx.fillStyle = grd;
    ctx.fillRect(0, gy, W, GROUND_HEIGHT);
    ctx.fillStyle = "rgba(129, 199, 132, 0.35)";
    ctx.fillRect(0, gy, W, 10);
  }

  // ---------------------------------------------------------------------------
  // BLOCO: DESENHAR UM CANO (DE CIMA OU DE BAIXO)
  // Se a figurinha carregou, colamos a foto. Se não, desenhamos um retângulo verde.
  // role "top" = cano do teto; "bottom" = cano do chão.
  // ---------------------------------------------------------------------------
  function drawPipeColumn(x, top, height, role) {
    const img = role === "top" ? imgPipeTop : imgPipe;
    const ok = role === "top" ? pipeTopOk : pipeOk;

    if (ok && img.naturalWidth > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(x, top, PIPE_WIDTH, height);
      ctx.clip();
      ctx.drawImage(img, x, top, PIPE_WIDTH, height);
      ctx.restore();
      ctx.strokeStyle = "rgba(0,0,0,0.25)";
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, top + 1, PIPE_WIDTH - 2, height - 2);
    } else {
      ctx.fillStyle = "#2e7d32";
      ctx.fillRect(x, top, PIPE_WIDTH, height);
      ctx.fillStyle = "#1b5e20";
      if (role === "top") {
        ctx.fillRect(x, top + height - 12, PIPE_WIDTH, 12);
      } else {
        ctx.fillRect(x, top, PIPE_WIDTH, 12);
        ctx.fillRect(x, top + height - 12, PIPE_WIDTH, 12);
      }
    }
  }

  // ---------------------------------------------------------------------------
  // BLOCO: DESENHAR O PASSARINHO COM ANIMAÇÃO
  // Ele "pisca" um pouquinho de altura (asinhas) e inclina conforme sobe ou cai.
  // ---------------------------------------------------------------------------
  function drawBird(dt) {
    bird.flapPhase += dt * 12;
    const flap = 0.92 + 0.08 * Math.sin(bird.flapPhase);
    const angle = Math.max(
      -0.6,
      Math.min(0.9, bird.vy * 0.0012)
    );

    const cx = bird.x + bird.w / 2;
    const cy = bird.y + bird.h / 2;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.scale(1, flap);

    if (birdOk && imgBird.naturalWidth > 0) {
      ctx.drawImage(imgBird, -bird.w / 2, -bird.h / 2, bird.w, bird.h);
    } else {
      ctx.fillStyle = "#ffca28";
      ctx.beginPath();
      ctx.ellipse(0, 0, bird.w / 2, bird.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f57f17";
      ctx.beginPath();
      ctx.arc(bird.w * 0.12, -bird.h * 0.1, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ---------------------------------------------------------------------------
  // BLOCO: ATUALIZAR O JOGO (UM PEDACINHO DE TEMPO = dt)
  // Aplica gravidade, move o passarinho, move os canos, cria canos novos,
  // apaga canos velhos, conta ponto e vê se bateu em algo.
  // ---------------------------------------------------------------------------
  function update(dt) {
    if (gameState !== State.PLAYING) return;

    const speed = getPipeSpeed();

    bird.vy += GRAVITY * dt;
    bird.y += bird.vy * dt;

    for (let i = pipes.length - 1; i >= 0; i--) {
      pipes[i].x -= speed * dt;
    }

    while (
      pipes.length === 0 ||
      pipes[pipes.length - 1].x < W - PIPE_SPACING
    ) {
      const lastX =
        pipes.length > 0
          ? pipes[pipes.length - 1].x
          : nextPipeX;
      spawnPipe(Math.max(W + 20, lastX + PIPE_SPACING));
    }

    pipes = pipes.filter(function (p) {
      return p.x + PIPE_WIDTH > -20;
    });

    updateScoring();

    if (checkCollisions()) {
      gameOver();
    }

    updateHud();
  }

  // ---------------------------------------------------------------------------
  // BLOCO: DESENHAR UM QUADRO INTEIRO NA TELA
  // Apaga tudo, pinta canos, chão e passarinho — como folha nova de caderno a cada frame.
  // ---------------------------------------------------------------------------
  function render(dt) {
    ctx.clearRect(0, 0, W, H);

    for (let i = 0; i < pipes.length; i++) {
      const p = pipes[i];
      drawPipeColumn(p.x, 0, p.gapY, "top");
      drawPipeColumn(
        p.x,
        p.gapY + p.gapH,
        H - GROUND_HEIGHT - (p.gapY + p.gapH),
        "bottom"
      );
    }

    drawGround();

    drawBird(dt);
  }

  // ---------------------------------------------------------------------------
  // BLOCO: O LOOP DO JOGO (VAI E VOLTA O TEMPO INTEIRO)
  // A cada frame: calcula quanto tempo passou, atualiza se estiver jogando,
  // desenha tudo de novo, e marca o próximo frame (enquanto não for game over).
  // ---------------------------------------------------------------------------
  function loop(now) {
    const dt = Math.min(0.05, (now - lastFrameTime) / 1000);
    lastFrameTime = now;

    if (gameState === State.PLAYING) {
      update(dt);
    }

    render(dt);

    if (gameState !== State.GAMEOVER) {
      animationId = requestAnimationFrame(loop);
    } else {
      animationId = null;
    }
  }

  // ---------------------------------------------------------------------------
  // BLOCO: PULAR (ESPAÇO OU CLIQUE)
  // Se ainda não começou, esse pulo também "liga" o jogo.
  // Se já acabou, não faz nada até você apertar "Jogar novamente".
  // ---------------------------------------------------------------------------
  function flap() {
    if (gameState === State.GAMEOVER) return;
    if (gameState === State.READY) {
      startPlaying();
    }
    bird.vy = JUMP_VELOCITY;
    bird.flapPhase = 0;
  }

  // ---------------------------------------------------------------------------
  // BLOCO: QUANDO APERTAM A BARRA DE ESPAÇO NO TECLADO
  // ---------------------------------------------------------------------------
  function onKeyDown(e) {
    if (e.code === "Space" || e.key === " ") {
      e.preventDefault();
      flap();
    }
  }

  // ---------------------------------------------------------------------------
  // BLOCO: OUVIR CLIQUE DO MOUSE NO CANVAS
  // ---------------------------------------------------------------------------
  canvas.addEventListener("mousedown", function (e) {
    e.preventDefault();
    flap();
  });

  // ---------------------------------------------------------------------------
  // BLOCO: OUVIR TOQUE NA TELA (CELULAR OU TABLET)
  // ---------------------------------------------------------------------------
  canvas.addEventListener(
    "touchstart",
    function (e) {
      e.preventDefault();
      flap();
    },
    { passive: false }
  );

  // ---------------------------------------------------------------------------
  // BLOCO: OUVIR TECLAS NA JANELA TODA (PARA O ESPAÇO FUNCIONAR BEM)
  // ---------------------------------------------------------------------------
  window.addEventListener("keydown", onKeyDown);

  // ---------------------------------------------------------------------------
  // BLOCO: BOTÃO "JOGAR NOVAMENTE"
  // Zera o jogo e, se o loop tinha parado no game over, liga de novo.
  // ---------------------------------------------------------------------------
  btnRestart.addEventListener("click", function () {
    resetGame();
    if (!animationId) {
      lastFrameTime = performance.now();
      animationId = requestAnimationFrame(loop);
    }
  });

  // ---------------------------------------------------------------------------
  // BLOCO: LIGAR O JOGO PELA PRIMEIRA VEZ AO ABRIR A PÁGINA
  // Deixa tudo no "pronto" e começa o loop de desenho.
  // ---------------------------------------------------------------------------
  resetGame();
  lastFrameTime = performance.now();
  animationId = requestAnimationFrame(loop);
})();
