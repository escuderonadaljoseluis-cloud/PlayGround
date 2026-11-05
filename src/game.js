import * as THREE from '../vendor/three.module.js';
import { FIGHTERS, getFighter, buildFighterModel, animateFighter } from './fighters.js';
import { Effects } from './effects.js';
import { Actor, AIController } from './combat.js';
import { UI } from './ui.js';
import {
  $, $$, ATTACKS, ARENA_RADIUS, COMBO_QUIPS, KO_QUIPS, MAX_METER, ROUND_TIME,
  clamp, damp, pick, rand,
} from './utils.js';

const SPECIAL_DURATION = { dash: 1.02, leap: 1.18, slam: 1.02, flurry: 1.3 };
const cssColor = (hex) => `#${hex.toString(16).padStart(6, '0')}`;

function disposeModel(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material && o.material.isMeshToonMaterial) o.material.dispose();
  });
  root.removeFromParent();
}

export class Game {
  constructor(world, audio) {
    this.world = world;
    this.scene = world.scene;
    this.camera = world.camera;
    this.audio = audio;
    this.effects = new Effects(this.scene);
    this.ui = new UI(this);
    this.ai = new AIController();

    this.mode = 'loading';
    this.phase = 'idle';
    this.paused = false;
    this.time = 0;
    this.menuTime = 0;
    this.timeLeft = ROUND_TIME;
    this.round = 1;
    this.pWins = 0;
    this.eWins = 0;
    this.phaseT = 0;
    this.hitStop = 0;
    this.slowMo = 0;
    this.shake = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.lastQuip = 0;
    this.pMeterWasFull = false;
    this.stats = { damage: 0, hits: 0, maxCombo: 0, eDamage: 0 };
    this.playerId = 'doge';
    this.enemyId = 'chad';
    this.p = null;
    this.e = null;
    this.resultShown = false;
    this.matchWinner = null;
    this.introFightCue = false;
    this.titleSpar = 1.2;
    this.selectOrbit = 0;
    this.pointerDrag = null;

    this.keys = new Set();
    this.blockHeld = false;
    this.buffer = { punch: 0, kick: 0, jump: 0, special: 0 };
    this.stick = { x: 0, y: 0, active: false, pointerId: null };

    this.camTarget = new THREE.Vector3(0, 1.2, 0);
    this.camDesired = new THREE.Vector3();
    this.lookDesired = new THREE.Vector3();

    // menu fighters
    this.menuActors = FIGHTERS.map((def) => {
      const rig = buildFighterModel(def);
      rig.root.visible = false;
      this.scene.add(rig.root);
      return {
        def, rig, root: rig.root, state: 'idle', stateTime: 0, attack: null,
        blocking: false, grounded: true, y: 0, vy: 0, moveAmount: 0,
        hitFlash: 0, koDir: 1, specialProgress: 0, specialType: null, facing: 0,
      };
    });

    let muted = false;
    try { muted = localStorage.getItem('mf3d_muted') === '1'; } catch { /* ignore */ }
    this.audio.muted = muted;
    this.ui.setSound(muted);

    this.bindInput();
    this.bindJoystick();
    this.bindCameraDrag();
    window.addEventListener('resize', () => this.world.resize());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.mode === 'fight' && this.phase === 'fighting' && !this.paused) {
        this.pause();
      }
    });
    window.addEventListener('blur', () => this.releaseInput());
  }

  /* ============================================================
     navigation
     ============================================================ */
  openSelect() {
    this.audio.ensure();
    this.audio.click();
    this.enterSelect(this.ui.selectedId);
    this.ui.setSelection(this.ui.selectedId);
    this.ui.setOpponent(this.ui.opponentId);
  }

  enterTitle() {
    this.mode = 'title';
    this.phase = 'idle';
    this.paused = false;
    this.clearFightActors();
    this.ui.hidePause();
    this.ui.hideResult();
    this.ui.hideHow();
    this.ui.clearAnnounce();
    this.ui.hideCombo();
    this.ui.setScreen('title');
    this.audio.setMusic('menu');
    this.world.selectRing.visible = false;
    this.world.setMessage('MEME DOME', 'LIVE FROM THE INTERNET', '#ffd52e');
    this.cameraMode = 'title';
    this.titleSpar = 0.8;
    this.selectOrbit = 0;

    const layout = {
      doge: { x: -2.4, z: 1.5, facing: Math.atan2(4.8, -2.4) },
      chad: { x: 2.4, z: -0.9, facing: Math.atan2(-4.8, 2.4) },
    };
    for (const a of this.menuActors) {
      const show = a.def.id === 'doge' || a.def.id === 'chad';
      a.root.visible = show;
      if (!show) continue;
      const l = layout[a.def.id];
      a.root.position.set(l.x, 0.02, l.z);
      a.root.rotation.y = l.facing;
      a.facing = l.facing;
      a.state = 'idle';
      a.stateTime = 0;
      a.attack = null;
      a.rig.fall.rotation.set(0, 0, 0);
    }
  }

  enterSelect(id) {
    this.mode = 'select';
    this.paused = false;
    this.clearFightActors();
    this.ui.hidePause();
    this.ui.hideResult();
    this.ui.setScreen('select');
    this.audio.setMusic('menu');
    this.world.selectRing.visible = true;
    this.world.setMessage('PICK YOUR FIGHTER', 'CHOOSE YOUR MEME', '#ffd52e');
    this.cameraMode = 'select';
    this.selectOrbit = 0;
    this.ui.setSelection(id);
    this.showOnlyMenuFighter(id);
    this.triggerMenuDemo(id, 'punch1');
  }

  showOnlyMenuFighter(id) {
    for (const a of this.menuActors) {
      const show = a.def.id === id;
      a.root.visible = show;
      if (!show) continue;
      a.root.position.set(0, 0.02, 0.15);
      a.root.rotation.y = 0;
      a.facing = 0;
      a.state = 'idle';
      a.stateTime = 0;
      a.attack = null;
      a.blocking = false;
      a.rig.fall.rotation.set(0, 0, 0);
    }
  }

  triggerMenuDemo(id, name = 'punch1') {
    const a = this.menuActors.find((m) => m.def.id === id);
    if (!a || !a.root.visible) return;
    a.state = 'attack';
    a.stateTime = 0;
    a.attack = { ...ATTACKS[name] };
    a.queued = null;
  }

  pickFighter(id) {
    this.audio.ensure();
    this.audio.click();
    if (id === this.ui.opponentId) this.shuffleOpponent(true);
    this.ui.setSelection(id);
    this.showOnlyMenuFighter(id);
    this.triggerMenuDemo(id, 'punch1');
  }

  shuffleOpponent(silent = false) {
    const options = FIGHTERS.filter((f) => f.id !== this.ui.selectedId);
    const def = options[Math.floor(Math.random() * options.length)];
    this.ui.setOpponent(def.id);
    if (!silent) this.audio.click();
  }

  backToTitle() {
    this.audio.ensure();
    this.audio.back();
    this.enterTitle();
  }

  startFight() {
    this.audio.ensure();
    this.audio.click();
    this.beginMatch(this.ui.selectedId, this.ui.opponentId);
  }

  beginMatch(playerId, enemyId) {
    this.playerId = playerId;
    this.enemyId = enemyId;
    this.audio.ensure();
    this.audio.setMusic('fight');
    this.clearFightActors();
    for (const a of this.menuActors) a.root.visible = false;
    const pDef = getFighter(playerId);
    const eDef = getFighter(enemyId);
    this.p = new Actor(pDef, true, this);
    this.e = new Actor(eDef, false, this);
    this.p.root.position.set(0, 0.02, 3.9);
    this.e.root.position.set(0, 0.02, -3.9);
    this.mode = 'fight';
    this.paused = false;
    this.ui.hidePause();
    this.ui.hideResult();
    this.ui.hideHow();
    this.ui.setScreen('fight');
    this.ui.setFighters(pDef, eDef);
    this.ui.setSelection(playerId);
    this.ui.setOpponent(enemyId);
    this.ui.setPips(0, 0);
    this.pWins = 0;
    this.eWins = 0;
    this.stats = { damage: 0, hits: 0, maxCombo: 0, eDamage: 0 };
    this.combo = 0;
    this.comboTimer = 0;
    this.lastQuip = 0;
    this.resultShown = false;
    this.matchWinner = null;
    this.cameraMode = 'fight';
    this.releaseInput();
    this.startRound(1);
  }

  startRound(n) {
    this.round = n;
    this.phase = 'intro';
    this.phaseT = 0;
    this.timeLeft = ROUND_TIME;
    this.hitStop = 0;
    this.slowMo = 0;
    this.introFightCue = false;
    this.combo = 0;
    this.comboTimer = 0;
    this.lastQuip = 0;
    this.p.reset(new THREE.Vector3(0, 0, 3.9), Math.PI);
    this.e.reset(new THREE.Vector3(0, 0, -3.9), 0);
    this.ai.reset();
    this.effects.clear();
    this.ui.setPips(this.pWins, this.eWins);
    this.ui.setRound(n);
    this.ui.setTimer(ROUND_TIME);
    this.ui.setHealth(100, 100);
    this.ui.setMeter(0, 0);
    this.ui.hideCombo();
    this.ui.clearAnnounce();
    this.releaseInput();
    const title = n >= 3 ? 'FINAL ROUND' : `ROUND ${n}`;
    this.ui.announce(title, { cls: '', duration: 950 });
    this.audio.count();
    this.world.setMessage(title, n >= 3 ? 'NO MORE NICE GUY' : 'FIGHT FOR THE INTERNET', '#ffd52e');
    this.world.selectRing.visible = false;
  }

  rematch() {
    this.audio.ensure();
    this.audio.click();
    this.ui.hideResult();
    this.beginMatch(this.playerId, this.enemyId);
  }

  changeFighter() {
    this.audio.ensure();
    this.audio.click();
    this.ui.hideResult();
    this.enterSelect(this.playerId);
    this.ui.setSelection(this.playerId);
  }

  quitToTitle() {
    this.audio.ensure();
    this.audio.back();
    this.ui.hidePause();
    this.enterTitle();
  }

  pause() {
    if (this.mode !== 'fight' || this.resultShown || this.paused) return;
    if (!['intro', 'fighting', 'roundEnd'].includes(this.phase)) return;
    this.paused = true;
    this.audio.ensure();
    this.audio.click();
    this.audio.setMusic('none');
    this.ui.showPause();
    this.ui.setScreen('paused');
    this.releaseInput();
  }

  resume() {
    if (!this.paused) return;
    this.audio.ensure();
    this.audio.click();
    this.paused = false;
    this.ui.hidePause();
    this.ui.setScreen('fight');
    this.audio.setMusic('fight');
  }

  restartMatch() {
    this.audio.ensure();
    this.audio.click();
    this.paused = false;
    this.ui.hidePause();
    this.ui.setScreen('fight');
    this.beginMatch(this.playerId, this.enemyId);
  }

  openHow() {
    this.audio.ensure();
    this.audio.click();
    this.ui.showHow();
  }

  toggleSound() {
    this.audio.ensure();
    const muted = this.audio.toggleMuted();
    this.ui.setSound(muted);
    try { localStorage.setItem('mf3d_muted', muted ? '1' : '0'); } catch { /* ignore */ }
    if (!muted) this.audio.click();
  }

  clearFightActors() {
    if (this.p) {
      disposeModel(this.p.root);
      this.p = null;
    }
    if (this.e) {
      disposeModel(this.e.root);
      this.e = null;
    }
  }

  /* ============================================================
     update loop
     ============================================================ */
  update(dt) {
    this.time += dt;
    this.world.update(dt, this.time);
    this.effects.update(dt);

    if (this.paused) {
      this.updateCamera(dt);
      return;
    }

    if (this.mode === 'title' || this.mode === 'select') {
      this.updateMenu(dt);
      this.updateCamera(dt);
      return;
    }

    if (this.mode === 'fight') {
      this.updateFight(dt);
      this.updateCamera(dt);
    }
  }

  updateMenu(dt) {
    this.menuTime += dt;
    if (this.mode === 'title') {
      this.titleSpar -= dt;
      if (this.titleSpar <= 0) {
        this.titleSpar = rand(1.4, 3.2);
        const active = this.menuActors.filter((a) => a.root.visible && a.state === 'idle');
        if (active.length) {
          const a = pick(active);
          this.triggerMenuDemo(a.def.id, pick(['punch1', 'punch2', 'kick']));
        }
      }
    }
    for (const a of this.menuActors) {
      if (!a.root.visible) continue;
      a.stateTime += dt;
      if (a.state === 'attack' && a.attack && a.stateTime >= a.attack.total) {
        a.state = 'idle';
        a.stateTime = 0;
        a.attack = null;
      }
      a.root.position.y = 0.02;
      a.root.rotation.y = a.facing;
      animateFighter(a.rig, a, dt, this.time);
    }
  }

  updateFight(dt) {
    if (this.phase === 'intro') {
      this.phaseT += dt;
      this.p.update(dt, this.e, {}, this, true);
      this.e.update(dt, this.p, {}, this, true);
      if (!this.introFightCue && this.phaseT > 0.92) {
        this.introFightCue = true;
        this.ui.announce('FIGHT!', { cls: '', duration: 850 });
        this.audio.fight();
        this.world.setMessage('FIGHT!', 'NO ITEMS. NO MERCY.', '#ff3d7f');
      }
      if (this.phaseT > 1.42) {
        this.phase = 'fighting';
        this.phaseT = 0;
        this.ui.clearAnnounce();
      }
      this.syncHUD();
      return;
    }

    if (this.hitStop > 0) {
      this.hitStop = Math.max(0, this.hitStop - dt);
      this.syncHUD();
      return;
    }

    if (this.phase === 'fighting') {
      this.timeLeft = Math.max(0, this.timeLeft - dt);
      if (this.timeLeft <= 0) {
        this.endByTime();
        this.syncHUD();
        return;
      }
      const sdt = this.slowMo > 0 ? dt * 0.35 : dt;
      if (this.slowMo > 0) this.slowMo = Math.max(0, this.slowMo - dt);
      const pInput = this.readPlayerInput();
      const eInput = this.ai.update(dt, this.e, this.p, this);
      this.p.update(sdt, this.e, pInput, this, false);
      this.e.update(sdt, this.p, eInput, this, false);
      if (this.p.usedPunch) this.buffer.punch = 0;
      if (this.p.usedKick) this.buffer.kick = 0;
      if (this.p.usedJump) this.buffer.jump = 0;
      if (this.p.usedSpecial) this.buffer.special = 0;
      for (const k of Object.keys(this.buffer)) this.buffer[k] = Math.max(0, this.buffer[k] - dt);
      this.resolveOverlap();
      this.comboTimer -= dt;
      if (this.comboTimer <= 0 && this.combo > 0) {
        this.combo = 0;
        this.lastQuip = 0;
        this.ui.hideCombo();
      }
      this.syncHUD();
      return;
    }

    if (this.phase === 'roundEnd') {
      this.phaseT += dt;
      if (this.slowMo > 0) this.slowMo = Math.max(0, this.slowMo - dt);
      const sdt = this.slowMo > 0 ? dt * 0.35 : dt;
      this.p.update(sdt, this.e, {}, this, true);
      this.e.update(sdt, this.p, {}, this, true);
      if (this.phaseT > 2.85) {
        if (this.pWins >= 2 || this.eWins >= 2 || this.round >= 3) this.beginMatchEnd();
        else this.startRound(this.round + 1);
      }
      this.syncHUD();
      return;
    }

    if (this.phase === 'matchEnd') {
      this.phaseT += dt;
      const sdt = this.slowMo > 0 ? dt * 0.5 : dt;
      if (this.slowMo > 0) this.slowMo = Math.max(0, this.slowMo - dt);
      this.p.update(sdt, this.e, {}, this, true);
      this.e.update(sdt, this.p, {}, this, true);
      if (!this.resultShown && this.phaseT > 1.15) this.showResultNow();
      this.syncHUD();
    }
  }

  readPlayerInput() {
    let mx = 0;
    let mz = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) mx -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) mx += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) mz -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) mz += 1;
    mx += this.stick.x;
    mz += -this.stick.y;
    const mag = Math.hypot(mx, mz);
    if (mag > 1) {
      mx /= mag;
      mz /= mag;
    }
    return {
      mx,
      mz,
      block: this.blockHeld || this.keys.has('KeyL') || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'),
      punch: this.buffer.punch > 0,
      kick: this.buffer.kick > 0,
      jump: this.buffer.jump > 0,
      special: this.buffer.special > 0,
      speedScale: 1,
    };
  }

  resolveOverlap() {
    if (!this.p || !this.e) return;
    if (this.p.state === 'ko' || this.e.state === 'ko') return;
    const dx = this.e.pos.x - this.p.pos.x;
    const dz = this.e.pos.z - this.p.pos.z;
    const dist = Math.hypot(dx, dz);
    const min = this.p.def.body.radius + this.e.def.body.radius + 0.12;
    if (dist > 0.0001 && dist < min) {
      const push = (min - dist) * 0.5;
      const nx = dx / dist;
      const nz = dz / dist;
      this.p.pos.x -= nx * push;
      this.p.pos.z -= nz * push;
      this.e.pos.x += nx * push;
      this.e.pos.z += nz * push;
      this.p.clampPosition();
      this.e.clampPosition();
    }
  }

  syncHUD() {
    if (!this.p || !this.e) return;
    this.ui.setHealth(this.p.hp, this.e.hp);
    this.ui.setMeter(this.p.meter, this.e.meter);
    this.ui.setTimer(this.timeLeft);
    if (this.p.meter >= MAX_METER && !this.pMeterWasFull) {
      this.pMeterWasFull = true;
      this.audio.meterFull();
      this.ui.toast('SPECIAL READY!', '');
    } else if (this.p.meter < MAX_METER) {
      this.pMeterWasFull = false;
    }
  }

  /* ============================================================
     combat
     ============================================================ */
  tryHit(attacker, target, a) {
    if (this.phase !== 'fighting' || attacker.hitDone) return;
    if (!target || target.state === 'ko' || target.invuln > 0) return;
    const dx = target.pos.x - attacker.pos.x;
    const dz = target.pos.z - attacker.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.0001) return;
    const fx = Math.sin(attacker.facing);
    const fz = Math.cos(attacker.facing);
    const dot = (dx * fx + dz * fz) / dist;
    const reach = a.range * attacker.def.body.reach + target.def.body.radius * 0.55;
    const dy = Math.abs(attacker.y - target.y);
    if (dist <= reach && dot > 0.02 && dy < 1.4) {
      attacker.hitDone = true;
      this.applyHit(attacker, target, {
        damage: a.damage,
        knockback: a.knockback,
        hitStun: a.hitStun,
        heavy: a.heavy,
        meterGain: a.meterGain,
        color: attacker.def.special.color,
      });
    }
  }

  applyHit(attacker, target, opts) {
    if (this.phase !== 'fighting' || !attacker || !target) return;
    if (target.state === 'ko' || target.invuln > 0) return;

    const blocked = !!target.blocking && target.grounded && target.state !== 'special';
    let dmg = opts.damage * attacker.def.body.power * (attacker.isAI ? this.aiDamageMult : 1);
    if (blocked) dmg *= opts.pierce ? 0.45 : 0.18;
    dmg = Math.max(1, Math.round(dmg));

    target.hp = clamp(target.hp - dmg, 0, 100);
    attacker.meter = clamp(attacker.meter + (opts.meterGain ?? Math.max(2, dmg * 0.8)), 0, MAX_METER);
    target.meter = clamp(target.meter + dmg * 0.55, 0, MAX_METER);

    const hitPos = new THREE.Vector3(
      target.pos.x - Math.sin(attacker.facing) * 0.12,
      target.y + 1.25 + rand(0, 0.35),
      target.pos.z - Math.cos(attacker.facing) * 0.12,
    );
    const color = opts.color ?? attacker.def.special.color;

    if (blocked) {
      this.effects.spawn(hitPos, 0x9feaff, 8, { spread: 2.2, up: 2.2, life: 0.32, gravity: 5 });
      this.effects.ring(new THREE.Vector3(target.pos.x, 0.08, target.pos.z), 0x39e7ff, {
        radius: 1.15, from: 0.25, life: 0.3, opacity: 0.65,
      });
      this.effects.text(hitPos.clone().add(new THREE.Vector3(0, 0.5, 0)), 'BLOCK', {
        fontSize: 46, color: '#9feaff', scale: 0.8, life: 0.6, vy: 1,
      });
      this.audio.block();
      this.shake = Math.max(this.shake, 0.1);
      this.hitStop = Math.max(this.hitStop, 0.025);
      target.kb.x += Math.sin(attacker.facing) * 1.5;
      target.kb.z += Math.cos(attacker.facing) * 1.5;
      target.hitFlash = Math.max(target.hitFlash, 0.35);
      if (attacker === this.p) {
        this.combo = 0;
        this.ui.hideCombo();
      }
    } else {
      const dirX = (target.pos.x - attacker.pos.x) / Math.max(0.01, Math.hypot(target.pos.x - attacker.pos.x, target.pos.z - attacker.pos.z));
      const dirZ = (target.pos.z - attacker.pos.z) / Math.max(0.01, Math.hypot(target.pos.x - attacker.pos.x, target.pos.z - attacker.pos.z));
      const kb = opts.knockback ?? 3;
      target.kb.x += dirX * kb;
      target.kb.z += dirZ * kb;
      target.hitStun = Math.max(target.hitStun, opts.hitStun ?? 0.3);
      target.state = 'hurt';
      target.stateTime = 0;
      target.blocking = false;
      target.attack = null;
      target.queued = null;
      target.hitFlash = 1;

      this.effects.spawn(hitPos, color, opts.heavy ? 22 : 12, {
        spread: opts.heavy ? 5 : 3.2, up: opts.heavy ? 4 : 3, life: opts.heavy ? 0.65 : 0.45, gravity: 9,
      });
      this.effects.spawn(hitPos, 0xfff7e3, opts.heavy ? 8 : 4, { spread: 1.6, up: 2.5, life: 0.3, gravity: 8 });
      this.effects.ring(new THREE.Vector3(target.pos.x, 0.08, target.pos.z), color, {
        radius: opts.heavy ? 2.4 : 1.35, from: 0.25, life: opts.heavy ? 0.5 : 0.32, opacity: 0.8,
      });
      this.effects.text(hitPos, String(dmg), {
        fontSize: opts.heavy ? 82 : 64,
        color: opts.heavy ? '#ffd52e' : '#fff7e3',
        scale: opts.heavy ? 1.25 : 0.9,
        life: 0.8,
        vy: 2.2,
      });
      if (opts.heavy) {
        this.effects.pop(hitPos.clone().add(new THREE.Vector3(0, 0.45, 0)), pick(['BONK!', 'OOF', 'SHEESH']), {
          color: '#ffd52e', scale: 1.15, life: 0.6,
        });
      }
      this.audio.hit(opts.heavy ? 1.6 : 1, opts.heavy);
      this.shake = Math.max(this.shake, opts.heavy ? 0.42 : 0.18);
      this.hitStop = Math.max(this.hitStop, opts.heavy ? 0.085 : 0.045);

      if (attacker === this.p) {
        this.stats.damage += dmg;
        this.stats.hits += 1;
        this.combo = this.comboTimer > 0 ? this.combo + 1 : 1;
        this.comboTimer = 1.5;
        this.stats.maxCombo = Math.max(this.stats.maxCombo, this.combo);
        this.ui.showCombo(this.combo);
        const q = COMBO_QUIPS.find((c) => this.combo >= c.at && this.lastQuip < c.at);
        if (q) {
          this.lastQuip = q.at;
          this.ui.toast(q.text, this.combo >= 7 ? 'pink' : '');
        }
      } else if (target === this.p) {
        this.stats.eDamage += dmg;
        this.combo = 0;
        this.comboTimer = 0;
        this.lastQuip = 0;
        this.ui.hideCombo();
      }
    }

    if (target.hp <= 0) this.onKO(target);
  }

  startSpecial(actor, opp) {
    if (this.phase !== 'fighting' || actor.meter < MAX_METER) return;
    const def = actor.def;
    actor.meter = 0;
    actor.state = 'special';
    actor.stateTime = 0;
    actor.specialType = def.special.type;
    actor.specialHits = 0;
    actor.specialLanded = false;
    actor.specialCooldown = 0;
    actor.specialProgress = 0;
    actor.specialTarget.copy(opp.pos);
    actor.invuln = 0.7;
    actor.blocking = false;
    actor.attack = null;
    actor.queued = null;
    actor.moveAmount = 0;
    actor.y = 0;
    actor.vy = 0;
    actor.grounded = true;
    actor.facing = Math.atan2(opp.pos.x - actor.pos.x, opp.pos.z - actor.pos.z);

    this.audio.specialCharge();
    this.effects.ring(new THREE.Vector3(actor.pos.x, 0.08, actor.pos.z), def.special.color, {
      radius: 2.2, from: 0.2, life: 0.55, opacity: 0.9,
    });
    this.effects.pop(
      new THREE.Vector3(actor.pos.x, actor.y + actor.def.body.height + 0.45, actor.pos.z),
      def.specialName,
      { color: cssColor(def.special.color), scale: 1.5, life: 1.1 },
    );
    this.shake = Math.max(this.shake, 0.22);
    this.ui.toast(def.specialName, actor === this.p ? 'cyan' : 'pink');
    this.world.setMessage(def.specialName, actor === this.p ? 'YOUR SIGNATURE MOVE' : 'INCOMING', cssColor(def.special.color));
    if (actor === this.p) {
      this.ui.flash('special');
      this.pMeterWasFull = false;
    }
  }

  updateSpecial(a, o, dt) {
    const s = a.def.special;
    const dur = SPECIAL_DURATION[s.type] || 1.05;
    const t = a.stateTime;
    a.specialProgress = clamp(t / dur, 0, 1);
    const dx = o.pos.x - a.pos.x;
    const dz = o.pos.z - a.pos.z;
    const dist = Math.max(0.001, Math.hypot(dx, dz));
    const nx = dx / dist;
    const nz = dz / dist;
    a.facing = Math.atan2(dx, dz);

    if (s.type === 'dash') {
      if (t > 0.16 && t < dur - 0.14) {
        if (dist > 1.15) {
          a.pos.x += nx * 10.5 * dt;
          a.pos.z += nz * 10.5 * dt;
        }
        if (a.specialHits < 5 && a.specialCooldown <= 0 && dist < 2.35) {
          const last = a.specialHits === 4;
          a.specialHits += 1;
          a.specialCooldown = 0.09;
          this.applyHit(a, o, {
            damage: s.damage, knockback: last ? 8 : 2.2, hitStun: last ? 0.55 : 0.16,
            heavy: last, meterGain: 2, color: s.color, special: true, pierce: true,
          });
          this.audio.specialBoom(0);
          this.effects.ring(new THREE.Vector3(o.pos.x, 0.08, o.pos.z), s.color, {
            radius: 1.6, from: 0.2, life: 0.28, opacity: 0.7,
          });
        }
        if (Math.random() < 0.65) {
          this.effects.spawn(new THREE.Vector3(a.pos.x, a.y + 0.8, a.pos.z), s.color, 2, {
            spread: 1, up: 1.4, life: 0.35, gravity: 2,
          });
        }
      }
    } else if (s.type === 'leap') {
      if (t < 0.28) {
        a.y = 0;
      } else if (t < 0.66) {
        const k = (t - 0.28) / 0.38;
        a.y = Math.sin(k * Math.PI * 0.5) * 3.6;
        if (t < 0.32) a.specialTarget.copy(o.pos);
        const tx = a.specialTarget.x - Math.sin(a.facing) * 1.2;
        const tz = a.specialTarget.z - Math.cos(a.facing) * 1.2;
        a.pos.x = a.pos.x + (tx - a.pos.x) * Math.min(1, dt * 7);
        a.pos.z = a.pos.z + (tz - a.pos.z) * Math.min(1, dt * 7);
        if (Math.random() < 0.4) {
          this.effects.spawn(new THREE.Vector3(a.pos.x, a.y + 0.5, a.pos.z), s.color, 2, {
            spread: 0.8, up: 0.8, life: 0.45, gravity: 1.5,
          });
        }
      } else if (!a.specialLanded) {
        a.specialLanded = true;
        a.y = 0;
        a.grounded = true;
        const hitDist = Math.hypot(o.pos.x - a.pos.x, o.pos.z - a.pos.z);
        this.effects.ring(new THREE.Vector3(a.pos.x, 0.08, a.pos.z), s.color, {
          radius: 5.2, from: 0.4, life: 0.7, opacity: 0.9,
        });
        this.effects.dust(new THREE.Vector3(a.pos.x, 0.1, a.pos.z), 0xd8ffcb, 22, 1.8);
        this.audio.specialBoom(1);
        this.shake = Math.max(this.shake, 0.75);
        this.hitStop = Math.max(this.hitStop, 0.07);
        this.ui.flash('');
        if (hitDist < 3.5) {
          this.applyHit(a, o, {
            damage: s.damage, knockback: 9, hitStun: 0.65, heavy: true,
            meterGain: 3, color: s.color, special: true, pierce: true,
          });
        }
      }
    } else if (s.type === 'slam') {
      if (t > 0.44 && !a.specialLanded) {
        a.specialLanded = true;
        const hitDist = Math.hypot(o.pos.x - a.pos.x, o.pos.z - a.pos.z);
        this.effects.ring(new THREE.Vector3(a.pos.x, 0.08, a.pos.z), s.color, {
          radius: 6, from: 0.4, life: 0.75, opacity: 0.95,
        });
        this.effects.ring(new THREE.Vector3(a.pos.x, 0.08, a.pos.z), 0xffd52e, {
          radius: 4.4, from: 0.3, life: 0.9, opacity: 0.7,
        });
        this.effects.dust(new THREE.Vector3(a.pos.x, 0.1, a.pos.z), 0xffd0a8, 26, 2);
        this.effects.spawn(new THREE.Vector3(a.pos.x, 0.4, a.pos.z), s.color, 26, {
          spread: 7, up: 5, life: 0.7, gravity: 12,
        });
        this.audio.specialBoom(2);
        this.shake = Math.max(this.shake, 1.1);
        this.hitStop = Math.max(this.hitStop, 0.09);
        this.ui.flash('');
        this.effects.pop(new THREE.Vector3(a.pos.x, 1.8, a.pos.z), 'GIGA!', { color: '#ff425d', scale: 1.6 });
        if (hitDist < 3.4) {
          this.applyHit(a, o, {
            damage: s.damage, knockback: 10, hitStun: 0.7, heavy: true,
            meterGain: 3, color: s.color, special: true, pierce: true,
          });
        }
      }
    } else if (s.type === 'flurry') {
      a.specialCooldown -= dt;
      if (t > 0.12 && a.specialHits < 8 && a.specialCooldown <= 0) {
        const last = a.specialHits === 7;
        const angle = a.specialHits * 2.39;
        const r = 1.35;
        a.pos.x = clamp(o.pos.x + Math.cos(angle) * r, -ARENA_RADIUS, ARENA_RADIUS);
        a.pos.z = clamp(o.pos.z + Math.sin(angle) * r, -ARENA_RADIUS, ARENA_RADIUS);
        a.facing = Math.atan2(o.pos.x - a.pos.x, o.pos.z - a.pos.z);
        a.specialHits += 1;
        a.specialCooldown = 0.1;
        this.applyHit(a, o, {
          damage: s.damage, knockback: last ? 9 : 1.4, hitStun: last ? 0.6 : 0.12,
          heavy: last, meterGain: 1.5, color: s.color, special: true, pierce: true,
        });
        this.effects.spawn(new THREE.Vector3(o.pos.x, o.y + 1.1, o.pos.z), s.color, last ? 16 : 6, {
          spread: 3, up: 3, life: 0.35, gravity: 8,
        });
        this.effects.ring(new THREE.Vector3(o.pos.x, 0.08, o.pos.z), s.color, {
          radius: last ? 3.8 : 1.2, from: 0.2, life: last ? 0.6 : 0.22, opacity: 0.7,
        });
        this.audio.hit(last ? 1.3 : 0.55, last);
        if (last) this.audio.specialBoom(3);
        this.shake = Math.max(this.shake, last ? 0.9 : 0.14);
        this.hitStop = Math.max(this.hitStop, last ? 0.08 : 0.02);
      }
    }

    if (t >= dur) this.endSpecial(a);
  }

  endSpecial(a) {
    if (a.state !== 'special') return;
    a.state = 'idle';
    a.stateTime = 0;
    a.specialType = null;
    a.specialProgress = 1;
    a.specialLanded = false;
    a.y = 0;
    a.vy = 0;
    a.grounded = true;
    a.invuln = 0.2;
    a.blocking = false;
  }

  onKO(loser) {
    if (this.phase !== 'fighting') return;
    const winner = loser === this.p ? this.e : this.p;
    loser.state = 'ko';
    loser.stateTime = 0;
    loser.koDir = loser.pos.x >= winner.pos.x ? 1 : -1;
    loser.hitStun = 0;
    loser.attack = null;
    loser.queued = null;
    loser.blocking = false;
    loser.specialType = null;
    loser.y = 0;
    loser.vy = 0;
    loser.grounded = true;
    winner.state = 'victory';
    winner.stateTime = 0;
    winner.attack = null;
    winner.queued = null;
    winner.specialType = null;
    winner.blocking = false;
    winner.y = 0;
    winner.vy = 0;
    winner.grounded = true;

    if (loser === this.e) this.pWins += 1;
    else this.eWins += 1;

    this.phase = 'roundEnd';
    this.phaseT = 0;
    this.slowMo = 1.05;
    this.hitStop = Math.max(this.hitStop, 0.09);
    this.ui.setPips(this.pWins, this.eWins);
    this.ui.announce('K.O.!', { cls: 'ko', duration: 1700 });
    this.ui.hideCombo();
    this.ui.flash('ko');
    this.audio.ko();
    this.effects.confetti();
    this.effects.ring(new THREE.Vector3(loser.pos.x, 0.08, loser.pos.z), 0xff3d7f, {
      radius: 5, from: 0.4, life: 0.85, opacity: 0.7,
    });
    this.effects.pop(
      new THREE.Vector3(loser.pos.x, 2.1, loser.pos.z),
      pick(KO_QUIPS),
      { color: '#ffd52e', scale: 1.5 },
    );
    this.world.setMessage('K.O.!', 'GET REKT', '#ff3d7f');
    this.ui.toast(pick(['SHEESH!', 'NO CAP!', 'GG!', 'BONK!']), 'pink');
    this.releaseInput();
  }

  endByTime() {
    if (this.phase !== 'fighting') return;
    let winner = null;
    if (this.p.hp > this.e.hp) winner = this.p;
    else if (this.e.hp > this.p.hp) winner = this.e;

    this.phase = 'roundEnd';
    this.phaseT = 0;
    this.slowMo = 0.6;
    this.releaseInput();
    this.ui.hideCombo();
    if (winner) {
      winner.state = 'victory';
      winner.stateTime = 0;
      if (winner === this.p) this.pWins += 1;
      else this.eWins += 1;
      this.ui.setPips(this.pWins, this.eWins);
      this.ui.announce('TIME!', { cls: '', duration: 1500 });
      this.ui.toast(winner === this.p ? 'HEALTH BAR W!' : 'HEALTH BAR L...', winner === this.p ? '' : 'pink');
    } else {
      this.ui.announce('DRAW!', { cls: '', duration: 1500 });
      this.ui.toast('NOBODY WINS. CLASSIC.', 'cyan');
    }
    this.audio.cheer(0.9, 0.14);
    this.world.setMessage('TIME!', winner ? `${winner.def.name} WINS` : 'DRAW', '#39e7ff');
    this.ui.setTimer(0);
  }

  beginMatchEnd() {
    this.phase = 'matchEnd';
    this.phaseT = 0;
    this.resultShown = false;
    this.slowMo = 0.5;
    this.combo = 0;
    this.ui.hideCombo();

    if (this.pWins > this.eWins) this.matchWinner = 'p';
    else if (this.eWins > this.pWins) this.matchWinner = 'e';
    else if (this.stats.damage !== this.stats.eDamage) {
      this.matchWinner = this.stats.damage > this.stats.eDamage ? 'p' : 'e';
    } else this.matchWinner = 'draw';

    const win = this.matchWinner === 'p';
    if (this.pWins >= 2 || win) this.p.state = 'victory';
    else if (this.p.state !== 'ko') this.p.state = 'idle';
    if (this.eWins >= 2 || this.matchWinner === 'e') this.e.state = 'victory';
    else if (this.e.state !== 'ko') this.e.state = 'idle';
    if (this.pWins === 0 && this.eWins === 0 && this.matchWinner === 'p') this.p.state = 'victory';

    this.audio.setMusic('none');
    if (win) {
      this.audio.win();
      this.effects.confetti();
    } else if (this.matchWinner === 'draw') {
      this.audio.cheer(1.5, 0.18);
      this.effects.confetti();
    } else {
      this.audio.lose();
    }
    const name = this.matchWinner === 'p' ? this.p.def.name : this.matchWinner === 'e' ? this.e.def.name : 'NOBODY';
    this.world.setMessage(win ? 'VICTORY!' : this.matchWinner === 'draw' ? 'DRAW' : 'DEFEAT', this.matchWinner === 'draw' ? 'NOBODY WINS' : `${name} WINS`, win ? '#66ff8a' : '#ff3d7f');
    this.ui.setScreen('fight');
  }

  showResultNow() {
    this.resultShown = true;
    const win = this.matchWinner === 'p';
    const draw = this.matchWinner === 'draw';
    this.ui.showResult({ win, draw, stats: this.stats });
    this.ui.setScreen('result');
    this.ui.clearAnnounce();
    clearTimeout(this._resultMusicTimer);
  }

  landDust(actor, impact) {
    if (impact > 3.5) {
      this.effects.dust(new THREE.Vector3(actor.pos.x, 0.1, actor.pos.z), 0xcbb7ea, impact > 6 ? 8 : 4, 0.7);
      if (impact > 5.5) this.audio.land();
    }
  }

  /* ============================================================
     camera
     ============================================================ */
  updateCamera(dt) {
    const aspect = window.innerWidth / window.innerHeight;
    const portrait = aspect < 0.82;
    let lambda = 3.2;

    if (this.mode === 'title' || this.mode === 'loading') {
      const angle = this.time * 0.07 + 0.45;
      const radius = portrait ? 14.2 : 13;
      this.camDesired.set(
        Math.sin(angle) * radius,
        (portrait ? 6.4 : 5.3) + Math.sin(this.time * 0.6) * 0.25,
        Math.cos(angle) * radius,
      );
      this.lookDesired.set(0, 1.7, 0);
      lambda = 2.2;
    } else if (this.mode === 'select') {
      const angle = this.selectOrbit;
      const radius = portrait ? 7.9 : 7.4;
      this.camDesired.set(
        Math.sin(angle) * radius,
        portrait ? 2.55 : 2.45,
        Math.cos(angle) * radius,
      );
      this.lookDesired.set(0, 1.25, 0);
      lambda = 4.5;
    } else {
      const px = this.p ? this.p.pos.x : 0;
      const pz = this.p ? this.p.pos.z : 0;
      const ex = this.e ? this.e.pos.x : 0;
      const ez = this.e ? this.e.pos.z : 0;
      const midX = (px + ex) / 2;
      const midZ = (pz + ez) / 2;
      const baseZ = portrait ? 18.8 : 14.6;
      const baseY = portrait ? 8.8 : 7.3;
      this.camDesired.set(midX * 0.38, baseY, baseZ + midZ * 0.38);
      this.lookDesired.set(midX * 0.58, 1.2, midZ * 0.52);
      lambda = 5.2;
    }

    const k = 1 - Math.exp(-lambda * dt);
    this.camera.position.lerp(this.camDesired, k);
    this.camTarget.lerp(this.lookDesired, k);

    if (this.shake > 0.001) {
      const s = this.shake;
      this.camera.position.x += rand(-s, s);
      this.camera.position.y += rand(-s * 0.6, s * 0.6);
      this.camera.position.z += rand(-s * 0.5, s * 0.5);
      this.shake *= Math.exp(-7 * dt);
    } else {
      this.shake = 0;
    }
    this.camera.lookAt(this.camTarget);
    this.camDesired.set(0, 0, 0);
  }

  /* ============================================================
     input
     ============================================================ */
  bindInput() {
    window.addEventListener('keydown', (e) => {
      const code = e.code;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code) && e.target === document.body) {
        e.preventDefault();
      }
      this.audio.ensure();
      if (e.repeat) return;
      this.keys.add(code);

      if (code === 'Escape' || code === 'KeyP') {
        if (!this.ui.refs.how.hidden) this.ui.hideHow();
        else if (this.paused) this.resume();
        else if (this.mode === 'fight' && this.phase !== 'matchEnd') this.pause();
        else if (this.mode === 'select') this.backToTitle();
        return;
      }
      if (code === 'KeyM') { this.toggleSound(); return; }
      if (this.mode === 'title' && (code === 'Enter' || code === 'Space')) {
        e.preventDefault();
        this.openSelect();
        return;
      }
      if (this.mode === 'select' && code === 'Enter') {
        e.preventDefault();
        this.startFight();
        return;
      }
      if (this.mode !== 'fight' || this.paused) return;

      if (code === 'KeyJ') this.buffer.punch = 0.16;
      else if (code === 'KeyK') this.buffer.kick = 0.16;
      else if (code === 'Space') this.buffer.jump = 0.16;
      else if (code === 'KeyU') this.buffer.special = 0.16;
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    window.addEventListener('pointerdown', () => this.audio.ensure(), { once: true });

    $$('.action-btn').forEach((btn) => {
      const action = btn.dataset.action;
      const down = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.audio.ensure();
        btn.classList.add('pressed');
        if (action === 'block') this.blockHeld = true;
        else if (action in this.buffer) this.buffer[action] = 0.18;
      };
      const up = (e) => {
        if (e) e.preventDefault();
        btn.classList.remove('pressed');
        if (action === 'block') this.blockHeld = false;
      };
      btn.addEventListener('pointerdown', down);
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('pointerleave', up);
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
    });
  }

  bindJoystick() {
    const zone = $('#stick-zone');
    const base = $('#stick-base');
    const knob = $('#stick-knob');
    if (!zone) return;

    const move = (e) => {
      const rect = base.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
      const radius = rect.width * 0.36;
      const d = Math.hypot(dx, dy);
      if (d > radius) {
        dx = (dx / d) * radius;
        dy = (dy / d) * radius;
      }
      const max = rect.width * 0.36;
      this.stick.x = clamp(dx / max, -1, 1);
      this.stick.y = clamp(-dy / max, -1, 1);
      if (Math.hypot(this.stick.x, this.stick.y) < 0.1) {
        this.stick.x = 0;
        this.stick.y = 0;
      }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    };

    const start = (e) => {
      if (this.stick.pointerId !== null) return;
      e.preventDefault();
      this.audio.ensure();
      this.stick.pointerId = e.pointerId;
      this.stick.active = true;
      zone.classList.add('active');
      zone.setPointerCapture?.(e.pointerId);
      move(e);
    };

    const end = (e) => {
      if (this.stick.pointerId !== null && e.pointerId !== this.stick.pointerId) return;
      this.stick.pointerId = null;
      this.stick.active = false;
      this.stick.x = 0;
      this.stick.y = 0;
      zone.classList.remove('active');
      knob.style.transform = 'translate(-50%, -50%)';
    };

    zone.addEventListener('pointerdown', start);
    zone.addEventListener('pointermove', (e) => {
      if (this.stick.pointerId === e.pointerId) {
        e.preventDefault();
        move(e);
      }
    });
    zone.addEventListener('pointerup', end);
    zone.addEventListener('pointercancel', end);
    zone.addEventListener('lostpointercapture', end);
  }

  bindCameraDrag() {
    const el = this.world.renderer.domElement;
    el.addEventListener('pointerdown', (e) => {
      if (this.mode !== 'select') return;
      this.pointerDrag = { x: e.clientX, startOrbit: this.selectOrbit };
      el.setPointerCapture?.(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!this.pointerDrag || this.mode !== 'select') return;
      const dx = e.clientX - this.pointerDrag.x;
      this.selectOrbit = clamp(this.pointerDrag.startOrbit - dx * 0.006, -0.9, 0.9);
    });
    const end = () => { this.pointerDrag = null; };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  releaseInput() {
    this.blockHeld = false;
    this.keys.clear();
    this.buffer.punch = 0;
    this.buffer.kick = 0;
    this.buffer.jump = 0;
    this.buffer.special = 0;
    this.stick.x = 0;
    this.stick.y = 0;
    this.stick.active = false;
    this.stick.pointerId = null;
    const knob = $('#stick-knob');
    if (knob) knob.style.transform = 'translate(-50%, -50%)';
    const zone = $('#stick-zone');
    if (zone) zone.classList.remove('active');
    $$('.action-btn.pressed').forEach((b) => b.classList.remove('pressed'));
  }
}
