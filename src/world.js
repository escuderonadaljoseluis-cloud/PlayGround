import * as THREE from '../vendor/three.module.js';
import { clamp, rand } from './utils.js';

const PALETTE = [0xff3d7f, 0x39e7ff, 0xffd52e, 0x7b4dff, 0x66ff8a, 0xff9bb6, 0xff8a3d];

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function labelSprite(text, color = '#fff7e3', size = 84) {
  const canvas = makeCanvas(512, 256);
  const ctx = canvas.getContext('2d');
  ctx.font = `${size}px Bangers, Impact, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#140f1e';
  ctx.lineWidth = size * 0.14;
  ctx.strokeText(text, 256, 134);
  ctx.fillStyle = color;
  ctx.fillText(text, 256, 134);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({
    map: texture, transparent: true, depthWrite: false, depthTest: true, toneMapped: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(4.4, 2.2, 1);
  return sprite;
}

function floorTexture(renderer) {
  const size = 1024;
  const c = makeCanvas(size, size);
  const ctx = c.getContext('2d');

  const bg = ctx.createRadialGradient(size / 2, size / 2, 30, size / 2, size / 2, size / 2);
  bg.addColorStop(0, '#2b194c');
  bg.addColorStop(0.6, '#1d1037');
  bg.addColorStop(1, '#140a27');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  // subtle checker
  const cells = 10;
  const cell = size / cells;
  for (let y = 0; y < cells; y++) {
    for (let x = 0; x < cells; x++) {
      if ((x + y) % 2 === 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.028)';
        ctx.fillRect(x * cell, y * cell, cell, cell);
      }
    }
  }

  // radial grid
  ctx.strokeStyle = 'rgba(57,231,255,0.16)';
  ctx.lineWidth = 2;
  for (let r = 90; r < size / 2; r += 76) {
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,61,127,0.12)';
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(size / 2 + Math.cos(a) * 80, size / 2 + Math.sin(a) * 80);
    ctx.lineTo(size / 2 + Math.cos(a) * 500, size / 2 + Math.sin(a) * 500);
    ctx.stroke();
  }

  // boundary ring
  const ring = ctx.createRadialGradient(size / 2, size / 2, 410, size / 2, size / 2, 500);
  ring.addColorStop(0, 'rgba(57,231,255,0)');
  ring.addColorStop(0.85, 'rgba(57,231,255,0.16)');
  ring.addColorStop(1, 'rgba(57,231,255,0)');
  ctx.fillStyle = ring;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, 505, 0, Math.PI * 2);
  ctx.fill();

  // center emblem
  ctx.save();
  ctx.translate(size / 2, size / 2);
  ctx.strokeStyle = 'rgba(255,213,46,0.5)';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, 148, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,61,127,0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 167, 0, Math.PI * 2);
  ctx.stroke();
  // star burst
  ctx.fillStyle = 'rgba(255,213,46,0.13)';
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a - 0.06) * 160, Math.sin(a - 0.06) * 160);
    ctx.lineTo(Math.cos(a + 0.06) * 160, Math.sin(a + 0.06) * 160);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '112px Bangers, Impact, sans-serif';
  ctx.lineWidth = 12;
  ctx.strokeStyle = '#140f1e';
  ctx.strokeText('MEME DOME', size / 2, size / 2 - 14);
  ctx.fillStyle = '#ffd52e';
  ctx.fillText('MEME DOME', size / 2, size / 2 - 14);
  ctx.font = '700 27px Outfit, sans-serif';
  ctx.lineWidth = 5;
  ctx.strokeText("THE INTERNET'S FINAL BOSS BATTLE", size / 2, size / 2 + 66);
  ctx.fillStyle = '#fff7e3';
  ctx.fillText("THE INTERNET'S FINAL BOSS BATTLE", size / 2, size / 2 + 66);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  return tex;
}

function screenTexture() {
  const canvas = makeCanvas(1024, 512);
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const draw = (title, sub, color = '#ffd52e') => {
    ctx.clearRect(0, 0, 1024, 512);
    const g = ctx.createLinearGradient(0, 0, 1024, 512);
    g.addColorStop(0, '#170b2b');
    g.addColorStop(0.55, '#241046');
    g.addColorStop(1, '#120720');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 512);

    ctx.strokeStyle = 'rgba(57,231,255,0.13)';
    ctx.lineWidth = 2;
    for (let x = 0; x < 1024; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 512);
      ctx.stroke();
    }
    for (let y = 0; y < 512; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1024, y);
      ctx.stroke();
    }

    // scanline
    for (let y = 0; y < 512; y += 6) {
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(0, y, 1024, 2);
    }

    ctx.fillStyle = '#ff3d7f';
    ctx.fillRect(58, 56, 126, 40);
    ctx.fillStyle = '#140f1e';
    ctx.font = '700 24px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('LIVE', 121, 78);
    ctx.fillStyle = '#fff7e3';
    ctx.textAlign = 'left';
    ctx.font = '700 21px Outfit, sans-serif';
    ctx.fillStyle = 'rgba(255,247,227,0.55)';
    ctx.fillText('MEME DOME • 12.4K WATCHING', 206, 78);

    ctx.textAlign = 'center';
    ctx.font = '116px Bangers, Impact, sans-serif';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 14;
    ctx.strokeStyle = '#0b0614';
    ctx.strokeText(title, 512, 254);
    ctx.fillStyle = color;
    ctx.fillText(title, 512, 254);

    ctx.font = '700 30px Outfit, sans-serif';
    ctx.fillStyle = 'rgba(255,247,227,0.7)';
    ctx.fillText(sub, 512, 342);

    ctx.fillStyle = 'rgba(255,61,127,0.8)';
    ctx.fillRect(390, 392, 244, 5);
    ctx.fillStyle = 'rgba(57,231,255,0.85)';
    ctx.fillRect(390, 404, 160, 3);
    texture.needsUpdate = true;
  };

  draw('MEME DOME', 'LIVE FROM THE INTERNET');
  return { canvas, ctx, texture, draw };
}

function buildCrowd(scene) {
  const tiers = [
    { r: 12.1, top: 0.5, count: 58 },
    { r: 14.3, top: 1.15, count: 66 },
    { r: 16.5, top: 1.85, count: 74 },
  ];
  const crowdGroups = [];
  for (const tier of tiers) {
    const geo = new THREE.SphereGeometry(0.27, 7, 5);
    const mat = new THREE.MeshToonMaterial({ color: 0xffffff });
    const mesh = new THREE.InstancedMesh(geo, mat, tier.count);
    mesh.instanceMatrix.setUsage(THREE.StaticDrawUsage);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    for (let i = 0; i < tier.count; i++) {
      const a = (i / tier.count) * Math.PI * 2 + rand(-0.04, 0.04);
      const rr = tier.r + rand(-0.5, 0.5);
      dummy.position.set(Math.cos(a) * rr, tier.top + rand(0.28, 0.5), Math.sin(a) * rr);
      dummy.scale.set(rand(0.75, 1.2), rand(0.9, 1.4), rand(0.75, 1.2));
      const flip = Math.random() > 0.5;
      dummy.rotation.y = rand(0, Math.PI * 2);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      color.setHex(PALETTE[Math.floor(Math.random() * PALETTE.length)]);
      mesh.setColorAt(i, color);
    }
    mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    const group = new THREE.Group();
    group.add(mesh);
    scene.add(group);
    crowdGroups.push({ group, baseY: 0, phase: rand(0, 6) });
  }
  return crowdGroups;
}

export class World {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x170a2b, 30, 82);
    this.camera = new THREE.PerspectiveCamera(46, 1, 0.1, 130);
    this.camera.position.set(0, 8, 18);
    this.camera.lookAt(0, 1.2, 0);

    this.clockTime = 0;
    this.floats = [];
    this.crowdGroups = [];
    this.arena = null;
    this.buildLights();
    this.buildSky();
    this.buildArena();
    this.resize();
  }

  buildLights() {
    const hemi = new THREE.HemisphereLight(0xa98cff, 0x221133, 1.4);
    this.scene.add(hemi);

    const key = new THREE.DirectionalLight(0xfff2dd, 2.4);
    key.position.set(7, 14, 9);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.camera.left = -13;
    key.shadow.camera.right = 13;
    key.shadow.camera.top = 13;
    key.shadow.camera.bottom = -13;
    key.shadow.camera.near = 1;
    key.shadow.camera.far = 45;
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.025;
    this.scene.add(key);
    this.keyLight = key;

    const pink = new THREE.PointLight(0xff3d7f, 38, 45, 2);
    pink.position.set(-9, 7, 5);
    this.scene.add(pink);
    this.pinkLight = pink;

    const cyan = new THREE.PointLight(0x39e7ff, 32, 45, 2);
    cyan.position.set(9, 8, -3);
    this.scene.add(cyan);
    this.cyanLight = cyan;

    const rim = new THREE.PointLight(0x7b4dff, 30, 40, 2);
    rim.position.set(0, 5, -13);
    this.scene.add(rim);
    this.rimLight = rim;
  }

  buildSky() {
    const canvas = makeCanvas(32, 512);
    const ctx = canvas.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#070311');
    g.addColorStop(0.42, '#170a2d');
    g.addColorStop(0.72, '#36124e');
    g.addColorStop(1, '#541a5c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 32, 512);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(72, 24, 16),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false }),
    );
    this.scene.add(sky);

    // stars
    const count = 260;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      const y = rand(8, 52);
      const r = Math.sqrt(Math.max(0, 62 * 62 - y * y)) * rand(0.7, 1);
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = Math.sin(a) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const stars = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xcfe8ff, size: 0.32, transparent: true, opacity: 0.8,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
    }));
    this.scene.add(stars);
    this.stars = stars;

    // distant grid floor
    const grid = new THREE.GridHelper(100, 50, 0x6f2c9e, 0x2a1347);
    grid.position.y = -0.45;
    grid.material.transparent = true;
    grid.material.opacity = 0.35;
    this.scene.add(grid);

    const glowDisc = new THREE.Mesh(
      new THREE.CircleGeometry(60, 64),
      new THREE.MeshBasicMaterial({ color: 0x150a28, transparent: true, opacity: 0.9 }),
    );
    glowDisc.rotation.x = -Math.PI / 2;
    glowDisc.position.y = -0.5;
    this.scene.add(glowDisc);
  }

  buildArena() {
    const group = new THREE.Group();
    this.scene.add(group);

    // platform
    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(10.05, 9.5, 0.65, 72),
      new THREE.MeshStandardMaterial({ color: 0x1c0f30, roughness: 0.75, metalness: 0.25 }),
    );
    base.position.y = -0.36;
    base.receiveShadow = true;
    base.castShadow = true;
    group.add(base);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(9.92, 96),
      new THREE.MeshStandardMaterial({
        map: floorTexture(this.renderer), roughness: 0.68, metalness: 0.18,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.015;
    floor.receiveShadow = true;
    group.add(floor);

    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(9.9, 0.09, 8, 120),
      new THREE.MeshBasicMaterial({ color: 0x39e7ff, toneMapped: false }),
    );
    rim.rotation.x = -Math.PI / 2;
    rim.position.y = 0.055;
    group.add(rim);
    this.rim = rim;

    const rim2 = new THREE.Mesh(
      new THREE.TorusGeometry(10.16, 0.06, 8, 120),
      new THREE.MeshBasicMaterial({ color: 0xff3d7f, toneMapped: false }),
    );
    rim2.rotation.x = -Math.PI / 2;
    rim2.position.y = -0.12;
    group.add(rim2);

    // rim lights
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.075, 8, 6),
        new THREE.MeshBasicMaterial({ color: i % 2 ? 0xff3d7f : 0x39e7ff, toneMapped: false }),
      );
      dot.position.set(Math.cos(a) * 10.02, 0.1, Math.sin(a) * 10.02);
      group.add(dot);
    }

    // stands
    const tiers = [
      { r: 12.1, top: 0.5, color: 0x21113a },
      { r: 14.3, top: 1.15, color: 0x1b0e31 },
      { r: 16.5, top: 1.85, color: 0x160a29 },
    ];
    for (const t of tiers) {
      const h = t.top + 0.45;
      const cyl = new THREE.Mesh(
        new THREE.CylinderGeometry(t.r, t.r, h, 64),
        new THREE.MeshStandardMaterial({ color: t.color, roughness: 0.9, metalness: 0.1 }),
      );
      cyl.position.y = t.top - h / 2;
      cyl.receiveShadow = true;
      group.add(cyl);
      const lip = new THREE.Mesh(
        new THREE.TorusGeometry(t.r, 0.035, 6, 96),
        new THREE.MeshBasicMaterial({ color: 0x7b4dff, transparent: true, opacity: 0.5, toneMapped: false }),
      );
      lip.rotation.x = -Math.PI / 2;
      lip.position.y = t.top + 0.02;
      group.add(lip);
    }

    this.crowdGroups = buildCrowd(this.scene);

    // neon pillars
    const neonColors = [0x39e7ff, 0xff3d7f, 0x7b4dff, 0xffd52e];
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + 0.14;
      const radius = rand(18, 20);
      const h = rand(5, 11);
      const p = new THREE.Group();
      p.position.set(Math.cos(a) * radius, 0, Math.sin(a) * radius);
      const body = new THREE.Mesh(
        new THREE.BoxGeometry(0.45, h, 0.45),
        new THREE.MeshStandardMaterial({ color: 0x180c2b, roughness: 0.7 }),
      );
      body.position.y = h / 2 - 0.4;
      p.add(body);
      const strip = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, h * 0.85, 0.1),
        new THREE.MeshBasicMaterial({ color: neonColors[i % neonColors.length], toneMapped: false }),
      );
      strip.position.set(0.27, h / 2 - 0.4, 0.27);
      p.add(strip);
      const tip = new THREE.Mesh(
        new THREE.SphereGeometry(0.16, 8, 6),
        new THREE.MeshBasicMaterial({ color: neonColors[i % neonColors.length], toneMapped: false }),
      );
      tip.position.y = h - 0.35;
      p.add(tip);
      group.add(p);
    }

    // big screen
    const screen = screenTexture();
    this.screenTexture = screen;
    const screenMat = new THREE.MeshBasicMaterial({ map: screen.texture, toneMapped: false });
    const screenMesh = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), screenMat);
    screenMesh.position.set(0, 6.7, -15.5);
    group.add(screenMesh);
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(10.6, 5.6, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x120820, emissive: 0x241044, emissiveIntensity: 0.7 }),
    );
    frame.position.set(0, 6.7, -15.75);
    group.add(frame);
    for (let i = 0; i < 4; i++) {
      const bar = new THREE.Mesh(
        new THREE.BoxGeometry(i < 2 ? 10.6 : 0.08, i < 2 ? 0.08 : 5.6, 0.1),
        new THREE.MeshBasicMaterial({ color: 0x39e7ff, toneMapped: false }),
      );
      bar.position.set(i === 2 ? -5.3 : i === 3 ? 5.3 : 0, i === 0 ? 9.5 : i === 1 ? 3.9 : 6.7, -15.5);
      group.add(bar);
    }
    this.screenMesh = screenMesh;

    // side screens
    for (const side of [-1, 1]) {
      const sm = new THREE.Mesh(
        new THREE.PlaneGeometry(4.2, 2.1),
        new THREE.MeshBasicMaterial({ map: screen.texture, toneMapped: false }),
      );
      sm.position.set(side * 8.4, 5.2, -13.8);
      sm.rotation.y = side * -0.42;
      group.add(sm);
    }

    // light beams
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x7b4dff, transparent: true, opacity: 0.055,
      blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    });
    for (const side of [-1, 1]) {
      const beam = new THREE.Mesh(new THREE.ConeGeometry(2.6, 13, 28, 1, true), beamMat);
      beam.position.set(side * 6.5, 7.5, -3);
      beam.rotation.z = side * 0.2;
      group.add(beam);
    }

    // floating meme labels
    const labels = [
      { text: 'LOL', color: '#ffd52e', pos: [-7.4, 6.8, -6], scale: 1.1 },
      { text: 'W', color: '#39e7ff', pos: [7.9, 8.2, -7.6], scale: 1.35 },
      { text: 'EZ', color: '#ff3d7f', pos: [8.2, 4.6, 3.8], scale: 0.9 },
      { text: 'BONK', color: '#66ff8a', pos: [-8.6, 4.3, 3.5], scale: 0.8 },
      { text: 'SHEESH', color: '#fff7e3', pos: [0, 10.6, -11], scale: 0.8 },
    ];
    for (const l of labels) {
      const s = labelSprite(l.text, l.color, 100);
      s.position.set(l.pos[0], l.pos[1], l.pos[2]);
      s.scale.multiplyScalar(l.scale * 0.7);
      group.add(s);
      this.floats.push({ sprite: s, baseY: l.pos[1], phase: rand(0, 6), speed: rand(0.4, 0.8) });
    }

    // select podium
    const sel = new THREE.Group();
    const ring1 = new THREE.Mesh(
      new THREE.TorusGeometry(1.5, 0.035, 8, 80),
      new THREE.MeshBasicMaterial({ color: 0xffd52e, toneMapped: false }),
    );
    ring1.rotation.x = -Math.PI / 2;
    ring1.position.y = 0.06;
    sel.add(ring1);
    const ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(2.0, 0.02, 8, 80),
      new THREE.MeshBasicMaterial({ color: 0x39e7ff, transparent: true, opacity: 0.55, toneMapped: false }),
    );
    ring2.rotation.x = -Math.PI / 2;
    ring2.position.y = 0.1;
    sel.add(ring2);
    const hologram = new THREE.Mesh(
      new THREE.ConeGeometry(1.9, 4.6, 40, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x9c7bff, transparent: true, opacity: 0.06,
        side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      }),
    );
    hologram.position.y = 2.35;
    sel.add(hologram);
    sel.visible = false;
    group.add(sel);
    this.selectRing = sel;
    this.selectRingSpin = ring2;
    this.selectHolo = hologram;

    this.group = group;
    this.setMessage('MEME DOME', 'LIVE FROM THE INTERNET');
  }

  setMessage(title, sub, color = '#ffd52e') {
    this.screenTexture.draw(title, sub, color);
  }

  update(dt, time) {
    this.clockTime = time;
    for (const f of this.floats) {
      f.sprite.position.y = f.baseY + Math.sin(time * f.speed + f.phase) * 0.35;
      f.sprite.material.opacity = 0.72 + Math.sin(time * f.speed * 1.4 + f.phase) * 0.18;
    }
    for (const c of this.crowdGroups) {
      c.group.position.y = Math.sin(time * 1.6 + c.phase) * 0.035;
    }
    if (this.rim) {
      this.rim.material.color.setHSL((time * 0.03) % 1, 1, 0.6);
    }
    if (this.selectRing.visible) {
      this.selectRingSpin.rotation.z = time * 0.35;
      this.selectHolo.material.opacity = 0.045 + Math.sin(time * 1.5) * 0.015;
    }
    if (this.screenMesh) {
      this.screenMesh.material.opacity = 0.98 + Math.sin(time * 8) * 0.01;
    }
    if (this.pinkLight) this.pinkLight.intensity = 34 + Math.sin(time * 0.9) * 8;
    if (this.cyanLight) this.cyanLight.intensity = 30 + Math.sin(time * 1.2 + 1) * 7;
    if (this.keyLight) this.keyLight.intensity = 2.35 + Math.sin(time * 0.7) * 0.1;
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);
    const aspect = w / h;
    this.camera.aspect = aspect;
    this.camera.fov = aspect < 0.82 ? 50 : 46;
    this.camera.updateProjectionMatrix();
  }
}
