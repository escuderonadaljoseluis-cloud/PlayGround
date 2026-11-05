import { $ } from './utils.js';
import { World } from './world.js';
import { Game } from './game.js';
import { AudioEngine } from './audio.js';

async function boot() {
  const bar = $('#loading-bar');
  const tip = $('#loading-tip');
  let progress = 8;
  const progressTimer = setInterval(() => {
    progress = Math.min(86, progress + Math.random() * 9);
    bar.style.width = `${progress}%`;
  }, 120);

  try {
    await Promise.race([
      document.fonts ? document.fonts.ready : Promise.resolve(),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]);
    progress = 92;
    bar.style.width = `${progress}%`;
    tip.textContent = 'Assembling the meme cinematic universe...';

    const world = new World($('#scene'));
    const audio = new AudioEngine();
    const game = new Game(world, audio);
    game.enterTitle();

    progress = 100;
    bar.style.width = '100%';
    tip.textContent = 'Ready. Please fight responsibly.';
    clearInterval(progressTimer);
    setTimeout(() => game.ui.finishLoading(), 260);

    window.__memeFight = {
      game,
      get state() {
        const g = game;
        return {
          screen: g.ui.screen,
          mode: g.mode,
          phase: g.phase,
          round: g.round,
          timer: g.timeLeft,
          wins: [g.pWins, g.eWins],
          player: g.p ? { id: g.p.def.id, hp: g.p.hp, meter: g.p.meter, state: g.p.state } : null,
          enemy: g.e ? { id: g.e.def.id, hp: g.e.hp, meter: g.e.meter, state: g.e.state } : null,
          combo: g.combo,
          paused: g.paused,
        };
      },
      startFight(player = 'doge', enemy = 'chad') {
        game.ui.setSelection(player);
        game.ui.setOpponent(enemy);
        game.beginMatch(player, enemy);
      },
      select(id) {
        game.pickFighter(id);
      },
      press(action) {
        if (action in game.buffer) game.buffer[action] = 0.18;
      },
      stick(x, y) {
        game.stick.x = x;
        game.stick.y = y;
      },
      skipIntro() {
        if (game.phase === 'intro') {
          game.phase = 'fighting';
          game.phaseT = 0;
          game.ui.clearAnnounce();
        }
      },
      endRound() {
        if (game.e) {
          game.e.hp = 1;
          game.applyHit(game.p, game.e, {
            damage: 50, knockback: 5, hitStun: 0.4, heavy: true, color: 0xffd52e,
          });
        }
      },
    };

    let last = performance.now();
    const frame = (now) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;
      game.update(dt);
      world.renderer.render(world.scene, world.camera);
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  } catch (err) {
    clearInterval(progressTimer);
    console.error(err);
    bar.style.width = '100%';
    bar.style.background = '#ff4d4d';
    tip.textContent = 'The memes failed to load. Try a browser with WebGL enabled.';
  }
}

boot();
