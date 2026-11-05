import * as THREE from '../vendor/three.module.js';
import { buildFighterModel, animateFighter } from './fighters.js';
import { ATTACKS, ARENA_RADIUS, MAX_HP, MAX_METER, clamp, damp, dampAngle, rand } from './utils.js';

function facingTo(from, to) {
  return Math.atan2(to.x - from.x, to.z - from.z);
}

export class Actor {
  constructor(def, isPlayer, game) {
    this.def = def;
    this.isPlayer = isPlayer;
    this.isAI = !isPlayer;
    this.game = game;
    this.rig = buildFighterModel(def);
    this.root = this.rig.root;
    game.world.scene.add(this.root);
    this.pos = new THREE.Vector3();
    this.kb = new THREE.Vector3();
    this.reset(new THREE.Vector3(0, 0, 0), 0);
  }

  reset(pos, facing) {
    this.pos.copy(pos);
    this.facing = facing;
    this.renderFacing = facing;
    this.hp = MAX_HP;
    this.meter = 0;
    this.state = 'idle';
    this.stateTime = 0;
    this.attack = null;
    this.blocking = false;
    this.grounded = true;
    this.y = 0;
    this.vy = 0;
    this.kb.set(0, 0, 0);
    this.hitStun = 0;
    this.invuln = 0;
    this.comboStep = 0;
    this.queued = null;
    this.hitDone = false;
    this.moveAmount = 0;
    this.koDir = 1;
    this.hitFlash = 0;
    this.specialType = null;
    this.specialHits = 0;
    this.specialLanded = false;
    this.specialCooldown = 0;
    this.specialProgress = 0;
    this.specialTarget = new THREE.Vector3();
    this.usedPunch = false;
    this.usedKick = false;
    this.usedJump = false;
    this.usedSpecial = false;
    this.attackCooldown = 0;
    this.rig.fall.rotation.set(0, 0, 0);
    this.rig.fall.position.y = 0;
    this.rig.torso.rotation.set(0, 0, 0);
    this.rig.head.rotation.set(0, 0, 0);
    this.rig.root.visible = true;
    this.sync(0.016);
  }

  get forward() {
    return { x: Math.sin(this.facing), z: Math.cos(this.facing) };
  }

  faceTarget(opp, dt, snap = false) {
    const target = facingTo(this.pos, opp.pos);
    if (snap) {
      this.facing = target;
    } else {
      this.facing = dampAngle(this.facing, target, 13, dt);
    }
  }

  clampPosition() {
    const d = Math.hypot(this.pos.x, this.pos.z);
    if (d > ARENA_RADIUS) {
      const k = ARENA_RADIUS / d;
      this.pos.x *= k;
      this.pos.z *= k;
    }
  }

  startAttack(name, opp, game) {
    const base = ATTACKS[name];
    if (!base) return;
    this.attack = { ...base };
    this.state = 'attack';
    this.stateTime = 0;
    this.hitDone = false;
    this.queued = null;
    this.blocking = false;
    this.moveAmount = 0;
    if (name === 'punch1') this.comboStep = 1;
    else if (name === 'punch2') this.comboStep = 2;
    else if (name === 'punch3') this.comboStep = 3;
    else this.comboStep = 0;
    if (opp) this.facing = facingTo(this.pos, opp.pos);
    game.audio.whoosh(base.heavy ? 1.2 : 0.7);
  }

  update(dt, opp, input, game, locked = false) {
    input = input || {};
    this.usedPunch = false;
    this.usedKick = false;
    this.usedJump = false;
    this.usedSpecial = false;
    this.stateTime += dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt * 4.5);
    this.invuln = Math.max(0, this.invuln - dt);
    this.specialCooldown = Math.max(0, this.specialCooldown - dt);
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);

    const prevVy = this.vy;
    if (!this.grounded) {
      this.vy -= 24 * dt;
      this.y += this.vy * dt;
      if (this.y <= 0) {
        this.y = 0;
        this.vy = 0;
        this.grounded = true;
        game.landDust(this, Math.abs(prevVy));
      }
    }

    if (this.kb.lengthSq() > 0.002) {
      this.pos.x += this.kb.x * dt;
      this.pos.z += this.kb.z * dt;
      this.kb.multiplyScalar(Math.exp(-6.5 * dt));
    }

    if (this.state === 'ko') {
      this.clampPosition();
      this.sync(dt);
      return;
    }
    if (this.state === 'victory') {
      this.faceTarget(opp, dt, true);
      this.clampPosition();
      this.sync(dt);
      return;
    }

    if (this.hitStun > 0) {
      this.hitStun -= dt;
      this.state = 'hurt';
      this.moveAmount = 0;
      if (this.hitStun <= 0) {
        this.hitStun = 0;
        this.state = 'idle';
        this.stateTime = 0;
      }
      this.clampPosition();
      this.sync(dt);
      return;
    }

    if (this.state === 'special') {
      game.updateSpecial(this, opp, dt);
      this.faceTarget(opp, dt, false);
      this.clampPosition();
      this.sync(dt);
      return;
    }

    if (this.state === 'attack' && this.attack) {
      const a = this.attack;
      if (!locked) {
        if (input.punch && a.canChain && this.comboStep < 3 && this.stateTime > a.windup * 0.35) {
          this.queued = 'punch';
          this.usedPunch = true;
        } else if (input.kick && this.comboStep < 3 && this.stateTime > a.windup * 0.35) {
          this.queued = 'kick';
          this.usedKick = true;
        }
      }
      if (a.lunge && this.stateTime < a.windup + a.active) {
        const f = this.forward;
        this.pos.x += f.x * a.lunge * dt;
        this.pos.z += f.z * a.lunge * dt;
      }
      if (!this.hitDone && this.stateTime >= a.windup && this.stateTime <= a.windup + a.active) {
        game.tryHit(this, opp, a);
      }
      if (this.stateTime >= a.total) {
        if (this.queued === 'punch' && a.next) {
          this.startAttack(a.next, opp, game);
        } else if (this.queued === 'kick') {
          this.startAttack('kick', opp, game);
        } else {
          this.state = 'idle';
          this.stateTime = 0;
          this.comboStep = 0;
          this.queued = null;
        }
      }
      this.faceTarget(opp, dt, false);
      this.clampPosition();
      this.sync(dt);
      return;
    }

    if (locked) {
      this.blocking = false;
      this.moveAmount = damp(this.moveAmount, 0, 10, dt);
      this.state = 'idle';
      this.faceTarget(opp, dt, false);
      this.clampPosition();
      this.sync(dt);
      return;
    }

    this.blocking = !!input.block && this.grounded;
    this.faceTarget(opp, dt, false);

    if (input.special && this.meter >= MAX_METER && this.grounded) {
      this.usedSpecial = true;
      game.startSpecial(this, opp);
      this.sync(dt);
      return;
    }

    if (input.jump && this.grounded) {
      this.vy = 7.8;
      this.grounded = false;
      this.y = 0.02;
      this.usedJump = true;
      game.audio.jump();
      game.effects.dust(new THREE.Vector3(this.pos.x, 0.08, this.pos.z), 0xcbb7ea, 5, 0.7);
    }

    if (input.punch) {
      this.usedPunch = true;
      this.startAttack(this.grounded ? 'punch1' : 'air', opp, game);
      this.sync(dt);
      return;
    }
    if (input.kick) {
      this.usedKick = true;
      this.startAttack(this.grounded ? 'kick' : 'air', opp, game);
      this.sync(dt);
      return;
    }

    let mx = input.mx || 0;
    let mz = input.mz || 0;
    let mag = Math.hypot(mx, mz);
    if (mag > 1) {
      mx /= mag;
      mz /= mag;
      mag = 1;
    }
    if (mag > 0.06) {
      const speedScale = input.speedScale || 1;
      const spd = this.def.body.speed * speedScale * (this.blocking ? 0.38 : 1) * (this.grounded ? 1 : 0.82);
      this.pos.x += mx * spd * dt;
      this.pos.z += mz * spd * dt;
    }
    this.moveAmount = damp(this.moveAmount, mag > 0.06 ? mag : 0, 12, dt);
    this.state = 'idle';
    this.clampPosition();
    this.sync(dt);
  }

  sync(dt) {
    this.renderFacing = dampAngle(this.renderFacing, this.facing, 22, dt);
    this.root.position.set(this.pos.x, this.y + 0.02, this.pos.z);
    this.root.rotation.y = this.renderFacing;
    animateFighter(this.rig, this, dt, performance.now() * 0.001);
  }
}

/* ============================================================
   AI — reads like a very online opponent
   ============================================================ */
export class AIController {
  constructor() {
    this.reset();
  }

  reset() {
    this.think = 0;
    this.attackCooldown = 0.9;
    this.blockTime = 0;
    this.strafe = Math.random() > 0.5 ? 1 : -1;
    this.jumpCooldown = 1.2;
    this.specialCooldown = 1.5;
  }

  update(dt, me, foe, game) {
    const out = {
      mx: 0, mz: 0, punch: false, kick: false, jump: false,
      block: false, special: false, speedScale: 1,
    };
    if (game.phase !== 'fighting' || me.state === 'ko' || me.state === 'victory') return out;

    const diff = game.round >= 3 ? 1 : game.round === 2 ? 0.6 : 0.28;
    const dx = foe.pos.x - me.pos.x;
    const dz = foe.pos.z - me.pos.z;
    const dist = Math.max(0.001, Math.hypot(dx, dz));
    const dirX = dx / dist;
    const dirZ = dz / dist;
    const busy = me.state === 'attack' || me.state === 'hurt' || me.state === 'special';

    // react to incoming attacks with a guard
    const foeWinding = foe.state === 'attack' && foe.attack
      && foe.stateTime < foe.attack.windup + 0.06;
    if (!busy && dist < 3.1 && (foeWinding || foe.state === 'special') && this.blockTime <= 0) {
      const chance = dt * (2.2 + diff * 6);
      if (Math.random() < chance) this.blockTime = 0.26 + diff * 0.15;
    }

    // movement intent
    let want = 0;
    if (!busy) {
      if (dist > 2.15) want = 1;
      else if (dist < 1.3) want = -0.7;
    }
    const strafeAmt = busy ? 0 : (me.def.id === 'catto' ? 0.62 : 0.34) * (dist < 4 ? 1 : 0.4);
    out.mx = dirX * want + -dirZ * this.strafe * strafeAmt;
    out.mz = dirZ * want + dirX * this.strafe * strafeAmt;
    out.speedScale = 0.8 + diff * 0.18;
    if (this.blockTime > 0) {
      out.block = true;
      out.mx *= 0.22;
      out.mz *= 0.22;
      this.blockTime -= dt;
    }

    this.think -= dt;
    this.attackCooldown -= dt;
    this.jumpCooldown -= dt;
    this.specialCooldown -= dt;

    if (!busy && this.think <= 0) {
      this.think = 0.16 + Math.random() * 0.16;
      if (Math.random() < 0.16) this.strafe *= -1;

      if (me.meter >= MAX_METER && dist < 3.9 && this.specialCooldown <= 0) {
        if (Math.random() < 0.35 + diff * 0.35 || foe.hp < 30) {
          out.special = true;
          this.specialCooldown = 3.2;
        }
      } else if (dist < 2.55 && this.attackCooldown <= 0) {
        const kickChance = dist > 1.9 ? 0.45 : 0.18;
        if (Math.random() < kickChance) out.kick = true;
        else out.punch = true;
        this.attackCooldown = (1.0 - diff * 0.36) * rand(0.68, 1.25);
      } else if (dist < 3.6 && dist > 2.2 && this.attackCooldown <= 0 && Math.random() < 0.32) {
        out.kick = true;
        this.attackCooldown = (1.2 - diff * 0.35) * rand(0.8, 1.2);
      }

      if (!busy && dist > 4.4 && this.jumpCooldown <= 0 && Math.random() < 0.08) {
        out.jump = true;
        this.jumpCooldown = 2.4;
      }
    }

    // keep the combo going
    if (me.state === 'attack' && me.attack && me.attack.canChain
      && me.stateTime > me.attack.windup * 0.55 && Math.random() < 0.05 + diff * 0.035) {
      out.punch = true;
    }

    // the AI has a hard time pressing buttons right after being launched
    if (me.state === 'hurt' || me.state === 'ko') return out;

    return out;
  }
}
