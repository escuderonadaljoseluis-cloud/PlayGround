import * as THREE from '../vendor/three.module.js';
import { rand } from './utils.js';

const PARTICLE_MAX = 460;
const RING_MAX = 16;
const TEXT_MAX = 18;

const colorCache = new Map();
function colorOf(hex) {
  if (typeof hex === 'number') return new THREE.Color(hex);
  if (colorCache.has(hex)) return colorCache.get(hex);
  const c = new THREE.Color(hex);
  colorCache.set(hex, c);
  return c;
}

/**
 * Sparks, shockwave rings, floating damage numbers and confetti.
 * Particles are a single Points cloud updated per frame.
 */
export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.cursor = 0;
    this.rings = [];
    this.texts = [];

    const positions = new Float32Array(PARTICLE_MAX * 3);
    const colors = new Float32Array(PARTICLE_MAX * 3);
    const velocities = new Float32Array(PARTICLE_MAX * 3);
    const lives = new Float32Array(PARTICLE_MAX);
    const maxLives = new Float32Array(PARTICLE_MAX);
    const gravities = new Float32Array(PARTICLE_MAX);
    for (let i = 0; i < PARTICLE_MAX; i++) {
      positions[i * 3 + 1] = -100;
      maxLives[i] = 0.001;
    }
    this.positions = positions;
    this.colors = colors;
    this.baseColors = new Float32Array(PARTICLE_MAX * 3);
    this.velocities = velocities;
    this.lives = lives;
    this.maxLives = maxLives;
    this.gravities = gravities;
    this.softness = new Float32Array(PARTICLE_MAX);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.16,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(geo, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 4;
    scene.add(this.points);

    // shockwave ring pool
    const ringGeo = new THREE.RingGeometry(0.82, 1, 54);
    for (let i = 0; i < RING_MAX; i++) {
      const m = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(ringGeo, m);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = -100;
      mesh.visible = false;
      mesh.renderOrder = 3;
      scene.add(mesh);
      this.rings.push({ mesh, life: 0, maxLife: 1, from: 1, to: 2, spin: 0 });
    }

    this.group = new THREE.Group();
    scene.add(this.group);
  }

  spawn(pos, color, count = 10, opts = {}) {
    const c = colorOf(color);
    const spread = opts.spread ?? 3.4;
    const up = opts.up ?? 3;
    const life = opts.life ?? 0.55;
    const gravity = opts.gravity ?? 12;
    const sizeJitter = opts.size ?? 0;
    for (let n = 0; n < count; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % PARTICLE_MAX;
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * spread;
      const z = Math.random() * spread;
      this.positions[i * 3] = pos.x + Math.cos(a) * r * 0.5;
      this.positions[i * 3 + 1] = pos.y + rand(-0.05, 0.3) + (opts.yJitter || 0);
      this.positions[i * 3 + 2] = pos.z + Math.sin(a) * z * 0.5;
      this.velocities[i * 3] = Math.cos(a) * r + (opts.vx || 0);
      this.velocities[i * 3 + 1] = Math.random() * up + (opts.vy || 0.5);
      this.velocities[i * 3 + 2] = Math.sin(a) * r + (opts.vz || 0);
      this.lives[i] = life * rand(0.6, 1.25);
      this.maxLives[i] = this.lives[i];
      this.gravities[i] = gravity;
      const cc = c.clone();
      if (sizeJitter) cc.multiplyScalar(rand(0.7, 1.25));
      this.colors[i * 3] = cc.r;
      this.colors[i * 3 + 1] = cc.g;
      this.colors[i * 3 + 2] = cc.b;
      this.baseColors[i * 3] = cc.r;
      this.baseColors[i * 3 + 1] = cc.g;
      this.baseColors[i * 3 + 2] = cc.b;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }

  ring(pos, color, opts = {}) {
    const slot = this.rings.find((r) => r.life <= 0) || this.rings[0];
    const mesh = slot.mesh;
    mesh.position.set(pos.x, opts.vertical ? pos.y : (pos.y ?? 0.08), pos.z);
    mesh.rotation.set(opts.vertical ? 0 : -Math.PI / 2, opts.vertical ? rand(-0.4, 0.4) : 0, 0);
    if (opts.vertical) mesh.rotation.y = rand(0, Math.PI);
    mesh.material.color.set(color);
    mesh.material.opacity = opts.opacity ?? 0.85;
    mesh.scale.setScalar(opts.from ?? 0.4);
    mesh.visible = true;
    slot.life = opts.life ?? 0.5;
    slot.maxLife = slot.life;
    slot.from = opts.from ?? 0.4;
    slot.to = opts.to ?? (opts.radius ?? 3.2);
    slot.spin = opts.spin ?? 0;
  }

  dust(pos, color = 0xb9a6d8, count = 6, strength = 1) {
    this.spawn(pos, color, count, {
      spread: 1.7 * strength,
      up: 1.4 * strength,
      life: 0.5,
      gravity: 3,
    });
  }

  confetti() {
    const colors = [0xffd52e, 0xff3d7f, 0x39e7ff, 0x7b4dff, 0x66ff8a, 0xfff7e3];
    for (let i = 0; i < 6; i++) {
      this.spawn(new THREE.Vector3(rand(-5, 5), rand(4.5, 6.5), rand(-3, 3)), colors[i % colors.length], 26, {
        spread: 2.2,
        up: 1,
        life: 2.6,
        gravity: 2.2,
        vx: rand(-2.2, 2.2),
        vz: rand(-2.2, 2.2),
      });
    }
  }

  text(pos, text, opts = {}) {
    if (this.texts.length >= TEXT_MAX) this.removeText(this.texts[0]);
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const fontSize = opts.fontSize || 68;
    const color = opts.color || '#ffffff';
    ctx.font = `${fontSize}px Bangers, Impact, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#140f1e';
    ctx.lineWidth = Math.max(6, fontSize * 0.15);
    ctx.strokeText(text, 128, 68);
    ctx.fillStyle = color;
    ctx.fillText(text, 128, 68);
    ctx.strokeStyle = 'rgba(255,255,255,.35)';
    ctx.lineWidth = 2;
    ctx.strokeText(text, 128, 68);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      toneMapped: false,
    });
    const sprite = new THREE.Sprite(mat);
    const scale = opts.scale || 1;
    sprite.scale.set(2.2 * scale, 1.1 * scale, 1);
    sprite.position.copy(pos);
    sprite.renderOrder = 12;
    this.group.add(sprite);
    this.texts.push({
      sprite, life: opts.life ?? 0.9, maxLife: opts.life ?? 0.9,
      vy: opts.vy ?? 1.5, vx: opts.vx ?? rand(-0.4, 0.4), gravity: opts.gravity ?? 1.1,
      baseScale: scale, grow: opts.grow ?? 0.18, fade: opts.fade ?? true,
    });
  }

  pop(pos, text, opts = {}) {
    this.text(pos, text, {
      fontSize: 72,
      scale: opts.scale || 1.9,
      life: opts.life || 1.15,
      vy: 1.6,
      gravity: 1.4,
      color: opts.color || '#ffd52e',
      grow: 0.5,
    });
  }

  removeText(t) {
    if (!t) return;
    this.group.remove(t.sprite);
    t.sprite.material.map?.dispose();
    t.sprite.material.dispose();
    const idx = this.texts.indexOf(t);
    if (idx >= 0) this.texts.splice(idx, 1);
  }

  update(dt) {
    const pos = this.positions;
    const vel = this.velocities;
    const col = this.colors;
    for (let i = 0; i < PARTICLE_MAX; i++) {
      if (this.lives[i] <= 0) continue;
      this.lives[i] -= dt;
      if (this.lives[i] <= 0) {
        pos[i * 3 + 1] = -100;
        continue;
      }
      vel[i * 3 + 1] -= this.gravities[i] * dt;
      pos[i * 3] += vel[i * 3] * dt;
      pos[i * 3 + 1] += vel[i * 3 + 1] * dt;
      pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      const k = Math.max(0, this.lives[i] / this.maxLives[i]);
      const fade = Math.min(1, k * 1.8);
      col[i * 3] = this.baseColors[i * 3] * fade;
      col[i * 3 + 1] = this.baseColors[i * 3 + 1] * fade;
      col[i * 3 + 2] = this.baseColors[i * 3 + 2] * fade;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;

    for (const r of this.rings) {
      if (r.life <= 0) continue;
      r.life -= dt;
      const t = 1 - Math.max(0, r.life / r.maxLife);
      const eased = 1 - Math.pow(1 - t, 3);
      const s = r.from + (r.to - r.from) * eased;
      r.mesh.scale.setScalar(s);
      r.mesh.material.opacity = (1 - t) * 0.85;
      if (r.spin) r.mesh.rotation.z += r.spin * dt;
      if (r.life <= 0) {
        r.mesh.visible = false;
        r.mesh.position.y = -100;
      }
    }

    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.removeText(t);
        continue;
      }
      t.vy -= t.gravity * dt;
      t.sprite.position.y += t.vy * dt;
      t.sprite.position.x += t.vx * dt;
      const age = 1 - t.life / t.maxLife;
      const pop = 1 + Math.sin(Math.min(1, age * 4) * Math.PI) * t.grow;
      const scale = t.baseScale * pop;
      t.sprite.scale.set(2.2 * scale, 1.1 * scale, 1);
      if (t.fade) t.sprite.material.opacity = Math.min(1, t.life / (t.maxLife * 0.4));
    }
  }

  clear() {
    for (let i = 0; i < PARTICLE_MAX; i++) {
      this.lives[i] = 0;
      this.positions[i * 3 + 1] = -100;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    for (const r of this.rings) {
      r.life = 0;
      r.mesh.visible = false;
      r.mesh.position.y = -100;
    }
    for (const t of [...this.texts]) this.removeText(t);
  }
}
