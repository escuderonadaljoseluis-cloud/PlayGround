import * as THREE from '../vendor/three.module.js';

/* ============================================================
   MEME FIGHTERS
   Low-poly toon models built entirely from primitives.
   ============================================================ */

const OUTLINE_COLOR = 0x171020;

let _gradient = null;
function gradientMap() {
  if (_gradient) return _gradient;
  const data = new Uint8Array([70, 145, 230, 255]);
  const tex = new THREE.DataTexture(data, data.length, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  _gradient = tex;
  return tex;
}

const outlineMat = new THREE.MeshBasicMaterial({
  color: OUTLINE_COLOR,
  side: THREE.BackSide,
});
const outlineMatSoft = new THREE.MeshBasicMaterial({
  color: OUTLINE_COLOR,
  side: THREE.BackSide,
  transparent: true,
  opacity: 0.55,
});

function toon(color, opts = {}) {
  return new THREE.MeshToonMaterial({
    color,
    gradientMap: gradientMap(),
    ...opts,
  });
}

function finishMesh(mesh, outline, scale = 1.055) {
  if (outline) {
    const o = new THREE.Mesh(mesh.geometry, outlineMat);
    o.scale.setScalar(scale);
    o.castShadow = false;
    o.receiveShadow = false;
    mesh.add(o);
  }
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function addMesh(parent, geo, color, pos = [0, 0, 0], opts = {}) {
  const m = new THREE.Mesh(geo, toon(color, opts.material));
  m.position.set(pos[0], pos[1], pos[2]);
  if (opts.rot) m.rotation.set(opts.rot[0] || 0, opts.rot[1] || 0, opts.rot[2] || 0);
  if (opts.scale) m.scale.set(opts.scale[0], opts.scale[1], opts.scale[2]);
  finishMesh(m, opts.outline !== false, opts.outlineScale || 1.055);
  parent.add(m);
  return m;
}

function box(parent, w, h, d, color, pos, opts = {}) {
  return addMesh(parent, new THREE.BoxGeometry(w, h, d), color, pos, opts);
}

function sphere(parent, r, color, pos, opts = {}) {
  return addMesh(parent, new THREE.SphereGeometry(r, opts.seg || 16, opts.seg ? Math.max(8, opts.seg - 4) : 12), color, pos, opts);
}

function capsule(parent, r, len, color, pos, opts = {}) {
  return addMesh(parent, new THREE.CapsuleGeometry(r, Math.max(0.02, len - r * 2), 4, 12), color, pos, opts);
}

function cone(parent, r, h, color, pos, opts = {}) {
  return addMesh(parent, new THREE.ConeGeometry(r, h, 10), color, pos, opts);
}

function torus(parent, r, tube, color, pos, opts = {}) {
  return addMesh(parent, new THREE.TorusGeometry(r, tube, 6, 18, opts.arc || Math.PI * 2), color, pos, opts);
}

function limb(parent, x, y, side, config) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, 0);
  parent.add(pivot);
  const len = config.len;
  capsule(pivot, config.r, len, config.color, [0, -len / 2, 0], {
    scale: [1, 1, 1],
    outlineScale: 1.07,
  });
  if (config.cuff) {
    box(pivot, config.r * 2.1, config.r * 0.9, config.r * 2.1, config.cuff, [0, -len + config.r * 0.2, 0], { outlineScale: 1.06 });
  }
  const hand = sphere(pivot, config.handR, config.handColor, [0, -len - config.handR * 0.35, 0.015], { outlineScale: 1.08 });
  if (config.shoe) {
    box(pivot, config.shoe[0], config.shoe[1], config.shoe[2], config.shoe[3], [0, -len + config.shoe[1] * 0.72, 0.055], { outlineScale: 1.04 });
  }
  return { pivot, hand };
}

function makeBaseRig() {
  const root = new THREE.Group();
  const fall = new THREE.Group();
  root.add(fall);
  return { root, fall };
}

/* ============================================================
   DOGEY — the good boi
   ============================================================ */
function buildDoge(def) {
  const { root, fall } = makeBaseRig();
  const c = def.colors;

  const legL = limb(fall, -0.2, 0.92, -1, {
    r: 0.105, len: 0.82, color: c.pants, handColor: c.shoe, handR: 0.1,
    shoe: [0.28, 0.16, 0.4, c.shoe], cuff: c.shoe,
  });
  const legR = limb(fall, 0.2, 0.92, 1, {
    r: 0.105, len: 0.82, color: c.pants, handColor: c.shoe, handR: 0.1,
    shoe: [0.28, 0.16, 0.4, c.shoe], cuff: c.shoe,
  });

  const torso = new THREE.Group();
  torso.position.y = 0.92;
  fall.add(torso);

  box(torso, 0.8, 0.82, 0.52, c.hoodie, [0, 0.34, 0], { outlineScale: 1.045 });
  box(torso, 0.48, 0.22, 0.06, c.hoodieDark, [0, 0.14, 0.28], { outline: false });
  // hood collar
  torus(torso, 0.28, 0.075, c.hoodieDark, [0, 0.77, 0.02], { rot: [Math.PI / 2, 0, 0], outline: false });
  // little bone badge
  box(torso, 0.13, 0.05, 0.02, c.accent, [-0.17, 0.44, 0.285], { outline: false });
  box(torso, 0.05, 0.13, 0.02, c.accent, [-0.17, 0.44, 0.285], { outline: false });
  // drawstrings
  box(torso, 0.035, 0.22, 0.035, c.accent, [-0.13, 0.62, 0.28], { rot: [0, 0, 0.12], outline: false });
  box(torso, 0.035, 0.2, 0.035, c.accent, [0.13, 0.63, 0.28], { rot: [0, 0, -0.1], outline: false });

  const armL = limb(torso, -0.47, 0.62, -1, {
    r: 0.105, len: 0.56, color: c.hoodie, handColor: c.fur, handR: 0.13, cuff: c.hoodieDark,
  });
  const armR = limb(torso, 0.47, 0.62, 1, {
    r: 0.105, len: 0.56, color: c.hoodie, handColor: c.fur, handR: 0.13, cuff: c.hoodieDark,
  });

  const head = new THREE.Group();
  head.position.set(0, 0.92, 0);
  torso.add(head);
  sphere(head, 0.4, c.fur, [0, 0.04, 0], { scale: [1.02, 0.96, 0.92], seg: 18, outlineScale: 1.05 });

  // ears
  const earL = cone(head, 0.135, 0.26, c.fur, [-0.27, 0.34, -0.01], { rot: [0, 0, 0.28], outlineScale: 1.08 });
  const earR = cone(head, 0.135, 0.26, c.fur, [0.27, 0.34, -0.01], { rot: [0, 0, -0.28], outlineScale: 1.08 });
  box(head, 0.08, 0.14, 0.02, c.innerEar, [-0.27, 0.34, 0.1], { rot: [0, 0, 0.28], outline: false });
  box(head, 0.08, 0.14, 0.02, c.innerEar, [0.27, 0.34, 0.1], { rot: [0, 0, -0.28], outline: false });

  // muzzle
  sphere(head, 0.19, c.muzzle, [-0.105, -0.08, 0.29], { scale: [1.02, 0.82, 0.85], seg: 14, outline: false });
  sphere(head, 0.19, c.muzzle, [0.105, -0.08, 0.29], { scale: [1.02, 0.82, 0.85], seg: 14, outline: false });
  sphere(head, 0.075, c.nose, [0, -0.015, 0.44], { scale: [1.15, 0.85, 0.8], seg: 12, outline: false });
  box(head, 0.15, 0.02, 0.02, c.mouth, [0, -0.16, 0.4], { outline: false });
  // tongue
  sphere(head, 0.055, c.tongue, [0.04, -0.19, 0.42], { scale: [1, 1.25, 0.5], seg: 10, outline: false });

  // eyes
  const eyeL = new THREE.Group();
  eyeL.position.set(-0.175, 0.08, 0.315);
  head.add(eyeL);
  sphere(eyeL, 0.105, 0xffffff, [0, 0, 0], { outline: false, seg: 14 });
  sphere(eyeL, 0.056, c.eye, [-0.025, 0.005, 0.082], { outline: false, seg: 12 });
  sphere(eyeL, 0.018, 0xffffff, [-0.045, 0.026, 0.13], { outline: false, seg: 8 });
  const eyeR = new THREE.Group();
  eyeR.position.set(0.175, 0.08, 0.315);
  head.add(eyeR);
  sphere(eyeR, 0.105, 0xffffff, [0, 0, 0], { outline: false, seg: 14 });
  sphere(eyeR, 0.056, c.eye, [0.025, 0.005, 0.082], { outline: false, seg: 12 });
  sphere(eyeR, 0.018, 0xffffff, [0.045, 0.026, 0.13], { outline: false, seg: 8 });

  // skeptical eyebrows
  box(head, 0.14, 0.035, 0.035, c.furDark, [-0.18, 0.2, 0.36], { rot: [0, 0, -0.28], outline: false });
  box(head, 0.14, 0.035, 0.035, c.furDark, [0.18, 0.2, 0.36], { rot: [0, 0, 0.2], outline: false });

  // tail
  const tail = new THREE.Group();
  tail.position.set(0, 0.3, -0.28);
  torso.add(tail);
  capsule(tail, 0.075, 0.38, c.fur, [0, 0.18, -0.1], { rot: [-0.55, 0, 0], outlineScale: 1.08 });

  const eyeTargets = [eyeL, eyeR];
  return {
    root, fall, torso, head, armL: armL.pivot, armR: armR.pivot, handL: armL.hand, handR: armR.hand,
    legL: legL.pivot, legR: legR.pivot, tail, eyeTargets, blink: 0,
    phase: 0,
  };
}

/* ============================================================
   FROGGO — the rare one
   ============================================================ */
function buildFroggo(def) {
  const { root, fall } = makeBaseRig();
  const c = def.colors;

  const legL = limb(fall, -0.21, 0.68, -1, {
    r: 0.11, len: 0.6, color: c.legs, handColor: c.skin, handR: 0.1,
    shoe: [0.3, 0.13, 0.42, c.shoe], cuff: c.shoe,
  });
  const legR = limb(fall, 0.21, 0.68, 1, {
    r: 0.11, len: 0.6, color: c.legs, handColor: c.skin, handR: 0.1,
    shoe: [0.3, 0.13, 0.42, c.shoe], cuff: c.shoe,
  });

  const torso = new THREE.Group();
  torso.position.y = 0.68;
  fall.add(torso);

  box(torso, 0.78, 0.7, 0.5, c.shirt, [0, 0.32, 0], { outlineScale: 1.045 });
  box(torso, 0.32, 0.1, 0.03, c.shirtPrint, [0, 0.4, 0.27], { outline: false });
  box(torso, 0.1, 0.1, 0.03, c.shirtPrint, [0.16, 0.4, 0.27], { outline: false, rot: [0, 0, 0.7] });
  // gold chain
  torus(torso, 0.22, 0.03, c.gold, [0, 0.63, 0.19], { rot: [1.25, 0, 0], outline: false });
  box(torso, 0.09, 0.12, 0.03, c.gold, [0, 0.52, 0.28], { outline: false, rot: [0, 0, 0.78] });

  const armL = limb(torso, -0.46, 0.55, -1, {
    r: 0.085, len: 0.55, color: c.skin, handColor: c.skin, handR: 0.13, cuff: c.sleeve,
  });
  const armR = limb(torso, 0.46, 0.55, 1, {
    r: 0.085, len: 0.55, color: c.skin, handColor: c.skin, handR: 0.13, cuff: c.sleeve,
  });

  const head = new THREE.Group();
  head.position.set(0, 0.82, 0);
  torso.add(head);
  sphere(head, 0.46, c.skin, [0, 0.06, 0], { scale: [1.1, 0.86, 0.92], seg: 18, outlineScale: 1.055 });

  // wide frog mouth
  torus(head, 0.27, 0.028, c.mouth, [0, -0.06, 0.36], { arc: Math.PI, rot: [0.12, 0, Math.PI], outline: false });
  box(head, 0.1, 0.035, 0.03, c.mouth, [0, -0.05, 0.43], { outline: false });
  // nostrils
  sphere(head, 0.022, c.skinDark, [-0.09, 0.12, 0.42], { outline: false, seg: 8 });
  sphere(head, 0.022, c.skinDark, [0.09, 0.12, 0.42], { outline: false, seg: 8 });
  // spots
  sphere(head, 0.09, c.spot, [-0.35, 0.12, 0.16], { scale: [1, 0.8, 0.3], outline: false, seg: 10 });
  sphere(head, 0.07, c.spot, [0.33, 0.19, 0.18], { scale: [1, 0.8, 0.3], outline: false, seg: 10 });

  // bulging eyes
  const eyeL = new THREE.Group();
  eyeL.position.set(-0.235, 0.31, 0.15);
  head.add(eyeL);
  sphere(eyeL, 0.19, 0xffffff, [0, 0, 0], { seg: 16, outlineScale: 1.05 });
  sphere(eyeL, 0.09, c.eye, [0.01, 0.005, 0.155], { outline: false, seg: 12 });
  sphere(eyeL, 0.025, 0xffffff, [0.03, 0.04, 0.22], { outline: false, seg: 8 });
  const eyeR = new THREE.Group();
  eyeR.position.set(0.235, 0.31, 0.15);
  head.add(eyeR);
  sphere(eyeR, 0.19, 0xffffff, [0, 0, 0], { seg: 16, outlineScale: 1.05 });
  sphere(eyeR, 0.09, c.eye, [-0.01, 0.005, 0.155], { outline: false, seg: 12 });
  sphere(eyeR, 0.025, 0xffffff, [-0.03, 0.04, 0.22], { outline: false, seg: 8 });

  // little red cap brim? A single leaf on the head.
  const leaf = new THREE.Group();
  leaf.position.set(0.1, 0.44, -0.02);
  head.add(leaf);
  sphere(leaf, 0.12, c.leaf, [0, 0.03, 0], { scale: [1.5, 0.25, 0.7], rot: [0, 0.3, 0.35], outlineScale: 1.07 });

  const tail = null;
  return {
    root, fall, torso, head, armL: armL.pivot, armR: armR.pivot, handL: armL.hand, handR: armR.hand,
    legL: legL.pivot, legR: legR.pivot, tail, eyeTargets: [eyeL, eyeR], blink: 0,
    phase: 1.7,
  };
}

/* ============================================================
   CHAD — the giga
   ============================================================ */
function buildChad(def) {
  const { root, fall } = makeBaseRig();
  const c = def.colors;

  const legL = limb(fall, -0.24, 1.02, -1, {
    r: 0.13, len: 0.96, color: c.skin, handColor: c.shoe, handR: 0.11,
    shoe: [0.32, 0.16, 0.46, c.shoe], cuff: c.sock,
  });
  const legR = limb(fall, 0.24, 1.02, 1, {
    r: 0.13, len: 0.96, color: c.skin, handColor: c.shoe, handR: 0.11,
    shoe: [0.32, 0.16, 0.46, c.shoe], cuff: c.sock,
  });
  // shorts
  box(fall, 0.58, 0.3, 0.42, c.shorts, [0, 0.92, 0], { outlineScale: 1.05 });

  const torso = new THREE.Group();
  torso.position.y = 1.04;
  fall.add(torso);

  box(torso, 0.98, 0.8, 0.54, c.tank, [0, 0.36, 0], { outlineScale: 1.045 });
  // tank straps
  box(torso, 0.12, 0.48, 0.03, c.tankDark, [-0.3, 0.55, 0.275], { outline: false, rot: [0, 0, -0.2] });
  box(torso, 0.12, 0.48, 0.03, c.tankDark, [0.3, 0.55, 0.275], { outline: false, rot: [0, 0, 0.2] });
  // chest highlight
  box(torso, 0.44, 0.16, 0.03, c.tankLight, [0, 0.44, 0.28], { outline: false });

  // shoulders
  sphere(torso, 0.21, c.skin, [-0.55, 0.7, 0], { seg: 14, outlineScale: 1.05 });
  sphere(torso, 0.21, c.skin, [0.55, 0.7, 0], { seg: 14, outlineScale: 1.05 });

  const armL = limb(torso, -0.58, 0.66, -1, {
    r: 0.155, len: 0.72, color: c.skin, handColor: c.skin, handR: 0.14,
  });
  const armR = limb(torso, 0.58, 0.66, 1, {
    r: 0.155, len: 0.72, color: c.skin, handColor: c.skin, handR: 0.14,
  });

  const head = new THREE.Group();
  head.position.set(0, 1.03, 0);
  torso.add(head);

  box(head, 0.54, 0.58, 0.5, c.skin, [0, 0, 0], { outlineScale: 1.05 });
  box(head, 0.42, 0.2, 0.46, c.skin, [0, -0.2, 0.04], { outlineScale: 1.05 });
  // hair
  box(head, 0.6, 0.2, 0.54, c.hair, [0, 0.32, -0.01], { outlineScale: 1.05 });
  box(head, 0.16, 0.28, 0.5, c.hair, [-0.27, 0.16, -0.02], { outlineScale: 1.05 });
  box(head, 0.16, 0.28, 0.5, c.hair, [0.27, 0.16, -0.02], { outlineScale: 1.05 });
  box(head, 0.52, 0.14, 0.08, c.hair, [0, 0.25, 0.26], { outline: false, rot: [0.16, 0, 0] });
  // sunglasses
  box(head, 0.52, 0.15, 0.06, c.shades, [0, 0.07, 0.27], { outline: true, outlineScale: 1.08 });
  box(head, 0.075, 0.05, 0.065, c.shadesShine, [-0.13, 0.09, 0.305], { outline: false, rot: [0, 0, 0.5] });
  // nose + smirk
  box(head, 0.12, 0.16, 0.12, c.skinDark, [0, -0.06, 0.29], { outline: false });
  box(head, 0.22, 0.035, 0.025, c.mouth, [0.06, -0.18, 0.27], { outline: false, rot: [0, 0, -0.1] });
  // chain
  torus(head, 0.19, 0.025, c.gold, [0, -0.28, 0.16], { rot: [1.35, 0, 0], outline: false });

  // tiny barbell? no. add square ear studs
  box(head, 0.05, 0.05, 0.04, c.gold, [-0.31, -0.04, 0.02], { outline: false, rot: [0, 0, 0.78] });
  box(head, 0.05, 0.05, 0.04, c.gold, [0.31, -0.04, 0.02], { outline: false, rot: [0, 0, 0.78] });

  const tail = null;
  return {
    root, fall, torso, head, armL: armL.pivot, armR: armR.pivot, handL: armL.hand, handR: armR.hand,
    legL: legL.pivot, legR: legR.pivot, tail, eyeTargets: [], blink: 0,
    phase: 3.1,
  };
}

/* ============================================================
   CATTO — the grumpy
   ============================================================ */
function buildCatto(def) {
  const { root, fall } = makeBaseRig();
  const c = def.colors;

  const legL = limb(fall, -0.2, 0.84, -1, {
    r: 0.1, len: 0.73, color: c.legs, handColor: c.fur, handR: 0.09,
    shoe: [0.27, 0.14, 0.38, c.shoe], cuff: c.shoe,
  });
  const legR = limb(fall, 0.2, 0.84, 1, {
    r: 0.1, len: 0.73, color: c.legs, handColor: c.fur, handR: 0.09,
    shoe: [0.27, 0.14, 0.38, c.shoe], cuff: c.shoe,
  });

  const torso = new THREE.Group();
  torso.position.y = 0.84;
  fall.add(torso);

  box(torso, 0.74, 0.7, 0.48, c.hoodie, [0, 0.32, 0], { outlineScale: 1.045 });
  box(torso, 0.4, 0.2, 0.05, c.hoodieDark, [0, 0.15, 0.26], { outline: false });
  // hood behind head
  const hood = new THREE.Group();
  hood.position.set(0, 0.68, -0.16);
  torso.add(hood);
  sphere(hood, 0.35, c.hoodieDark, [0, 0, 0], { scale: [1.1, 0.8, 0.7], seg: 14, outlineScale: 1.06 });
  // drawstrings
  box(torso, 0.03, 0.18, 0.03, c.accent, [-0.11, 0.58, 0.26], { outline: false });
  box(torso, 0.03, 0.18, 0.03, c.accent, [0.11, 0.58, 0.26], { outline: false });

  const armL = limb(torso, -0.44, 0.58, -1, {
    r: 0.09, len: 0.55, color: c.hoodie, handColor: c.fur, handR: 0.12, cuff: c.hoodieDark,
  });
  const armR = limb(torso, 0.44, 0.58, 1, {
    r: 0.09, len: 0.55, color: c.hoodie, handColor: c.fur, handR: 0.12, cuff: c.hoodieDark,
  });

  const head = new THREE.Group();
  head.position.set(0, 0.88, 0);
  torso.add(head);
  sphere(head, 0.41, c.fur, [0, 0, 0], { scale: [1.06, 0.95, 0.94], seg: 18, outlineScale: 1.05 });

  // ears
  cone(head, 0.15, 0.3, c.fur, [-0.26, 0.33, 0], { rot: [0, 0, 0.2], outlineScale: 1.07 });
  cone(head, 0.15, 0.3, c.fur, [0.26, 0.33, 0], { rot: [0, 0, -0.2], outlineScale: 1.07 });
  cone(head, 0.08, 0.18, c.innerEar, [-0.26, 0.34, 0.08], { rot: [0, 0, 0.2], outline: false });
  cone(head, 0.08, 0.18, c.innerEar, [0.26, 0.34, 0.08], { rot: [0, 0, -0.2], outline: false });

  // muzzle
  sphere(head, 0.13, c.muzzle, [-0.075, -0.1, 0.33], { scale: [1, 0.8, 0.7], seg: 12, outline: false });
  sphere(head, 0.13, c.muzzle, [0.075, -0.1, 0.33], { scale: [1, 0.8, 0.7], seg: 12, outline: false });
  sphere(head, 0.045, c.nose, [0, -0.045, 0.43], { scale: [1.3, 0.9, 0.8], seg: 10, outline: false });
  // grumpy w mouth
  torus(head, 0.055, 0.014, c.mouth, [-0.045, -0.15, 0.41], { arc: Math.PI, rot: [0, 0, Math.PI], outline: false });
  torus(head, 0.055, 0.014, c.mouth, [0.045, -0.15, 0.41], { arc: Math.PI, rot: [0, 0, Math.PI], outline: false });

  // half-lidded eyes
  const eyeL = new THREE.Group();
  eyeL.position.set(-0.17, 0.03, 0.33);
  head.add(eyeL);
  sphere(eyeL, 0.1, 0xffffff, [0, 0, 0], { outline: false, seg: 14 });
  sphere(eyeL, 0.047, c.eye, [-0.01, -0.005, 0.01], { scale: [0.7, 1.25, 0.7], outline: false, seg: 10 });
  box(eyeL, 0.19, 0.085, 0.06, c.fur, [0, 0.065, 0.055], { rot: [0.3, 0, -0.12], outline: false });
  const eyeR = new THREE.Group();
  eyeR.position.set(0.17, 0.03, 0.33);
  head.add(eyeR);
  sphere(eyeR, 0.1, 0xffffff, [0, 0, 0], { outline: false, seg: 14 });
  sphere(eyeR, 0.047, c.eye, [0.01, -0.005, 0.01], { scale: [0.7, 1.25, 0.7], outline: false, seg: 10 });
  box(eyeR, 0.19, 0.085, 0.06, c.fur, [0, 0.065, 0.055], { rot: [0.3, 0, 0.12], outline: false });

  // whiskers
  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      box(head, 0.26, 0.012, 0.012, c.whisker, [side * 0.22, -0.1 + i * 0.045, 0.36], {
        rot: [0, 0, side * (0.18 - i * 0.16)], outline: false,
      });
    }
  }

  // tail
  const tail = new THREE.Group();
  tail.position.set(0, 0.28, -0.26);
  torso.add(tail);
  capsule(tail, 0.075, 0.62, c.fur, [0.05, 0.22, -0.12], { rot: [-0.9, 0, 0.3], outlineScale: 1.08 });
  capsule(tail, 0.075, 0.2, c.furDark, [0.12, 0.47, -0.3], { rot: [-0.9, 0, 0.3], outlineScale: 1.08 });

  return {
    root, fall, torso, head, armL: armL.pivot, armR: armR.pivot, handL: armL.hand, handR: armR.hand,
    legL: legL.pivot, legR: legR.pivot, tail, eyeTargets: [eyeL, eyeR], blink: 0,
    phase: 4.6,
  };
}

/* ============================================================
   DEFS
   ============================================================ */
export const FIGHTERS = [
  {
    id: 'doge',
    name: 'DOGEY',
    role: 'THE GOOD BOI',
    tagline: 'Much damage. Very punch. Wow.',
    specialName: 'MUCH WOW',
    specialDesc: 'A five-hit golden rush. Very combo.',
    colors: {
      fur: 0xe8a23c, furDark: 0xb87320, muzzle: 0xf9e2b8, innerEar: 0xff9eb5,
      eye: 0x2a1d18, nose: 0x2a1d18, mouth: 0x2a1d18, tongue: 0xff7c98,
      hoodie: 0x3f7cff, hoodieDark: 0x2452c9, accent: 0xfff2c9,
      pants: 0x2a3a6b, shoe: 0xff5a5a,
    },
    stats: { pow: 3, spd: 3, def: 3, rch: 3 },
    body: { speed: 6.0, power: 1.0, defense: 1.0, reach: 1.0, radius: 0.5, height: 2.15 },
    special: { type: 'dash', damage: 5, hits: 5, color: 0xffcc33, text: 'MUCH WOW' },
    build: buildDoge,
  },
  {
    id: 'froggo',
    name: 'FROGGO',
    role: 'THE RARE ONE',
    tagline: 'Feels good to win, man.',
    specialName: 'RARE LEAP',
    specialDesc: 'Leap across the arena and flatten the timeline.',
    colors: {
      skin: 0x7ad64a, skinDark: 0x4f9a2d, spot: 0x5fb536, eye: 0x1c2a16,
      mouth: 0x2a3a1f, shirt: 0x202028, shirtPrint: 0x66ff8a, sleeve: 0x202028,
      gold: 0xffce42, legs: 0x34406e, shoe: 0xff4747, leaf: 0x9dff6a,
    },
    stats: { pow: 3, spd: 4, def: 2, rch: 4 },
    body: { speed: 6.5, power: 0.92, defense: 0.94, reach: 1.06, radius: 0.51, height: 1.95 },
    special: { type: 'leap', damage: 27, hits: 1, color: 0x7dff6a, text: 'RARE LEAP' },
    build: buildFroggo,
  },
  {
    id: 'chad',
    name: 'CHAD',
    role: 'THE GIGA',
    tagline: 'You may now applaud.',
    specialName: 'GIGA SLAM',
    specialDesc: 'A ground pound with the confidence of a thousand replies.',
    colors: {
      skin: 0xf0bd8a, skinDark: 0xd69a66, hair: 0xf1cf4b, shades: 0x17151f,
      shadesShine: 0x6f7cff, mouth: 0x5e3325, tank: 0xff425d, tankDark: 0xbf2740,
      tankLight: 0xff7288, shorts: 0x27335e, shoe: 0xfff6e3, sock: 0xffffff, gold: 0xffce42,
    },
    stats: { pow: 5, spd: 2, def: 5, rch: 3 },
    body: { speed: 5.0, power: 1.28, defense: 1.12, reach: 1.08, radius: 0.56, height: 2.4 },
    special: { type: 'slam', damage: 33, hits: 1, color: 0xff425d, text: 'GIGA SLAM' },
    build: buildChad,
  },
  {
    id: 'catto',
    name: 'CATTO',
    role: 'THE GRUMPY',
    tagline: 'I hate this arena. And you.',
    specialName: 'ZOOMIES',
    specialDesc: 'Six unhinged hits at 3 AM energy.',
    colors: {
      fur: 0xfff0d4, furDark: 0xe0c7a5, muzzle: 0xfff9ec, innerEar: 0xffa8c2,
      eye: 0x2b241f, nose: 0xff9bb6, mouth: 0x5a4036, whisker: 0x4a3b34,
      hoodie: 0xff7eb0, hoodieDark: 0xd94b87, accent: 0xfff4e0, legs: 0x4b3b66,
      shoe: 0xffffff,
    },
    stats: { pow: 2, spd: 5, def: 2, rch: 2 },
    body: { speed: 7.0, power: 0.82, defense: 0.9, reach: 0.94, radius: 0.46, height: 2.05 },
    special: { type: 'flurry', damage: 4, hits: 8, color: 0xff7eb0, text: 'ZOOMIES' },
    build: buildCatto,
  },
];

export function getFighter(id) {
  return FIGHTERS.find((f) => f.id === id) || FIGHTERS[0];
}

export function buildFighterModel(def) {
  const rig = def.build(def);
  rig.root.scale.setScalar(def.body.height / 2.15);
  rig.flashMaterials = [];
  rig.root.traverse((o) => {
    if (o.isMesh && o.material && o.material.isMeshToonMaterial) {
      o.material.emissive = new THREE.Color(0xffffff);
      o.material.emissiveIntensity = 0;
      rig.flashMaterials.push(o.material);
    }
  });
  return rig;
}

/* ============================================================
   ANIMATION
   ============================================================ */
function damp(current, target, lambda, dt) {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}
function dampAngle(current, target, lambda, dt) {
  let delta = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return current + delta * (1 - Math.exp(-lambda * dt));
}

const BASE_ARM = 0.1;

/**
 * Procedural animation for every fighter.
 * actor: { state, stateTime, attack, specialType, block, vy, grounded, koDir, moveAmount, damageFlash, victory }
 */
export function animateFighter(rig, actor, dt, time) {
  const t = time + rig.phase;
  const state = actor.state;
  const speed = actor.moveAmount || 0;
  const run = Math.min(1, speed);
  const atk = actor.attack;
  const st = actor.stateTime || 0;
  const ko = state === 'ko';
  const hurt = state === 'hurt';
  const block = !!actor.blocking;
  const grounded = actor.grounded !== false;
  const airborne = !grounded;

  // baseline targets
  let torsoY = 0;
  let torsoRX = 0;
  let torsoRY = 0;
  let torsoRZ = 0;
  let headRX = 0;
  let headRY = 0;
  let headRZ = 0;
  let armLX = -BASE_ARM;
  let armRX = -BASE_ARM;
  let armLZ = -0.09;
  let armRZ = 0.09;
  let armLY = 0;
  let armRY = 0;
  let legLX = 0;
  let legRX = 0;
  let legLZ = -0.03;
  let legRZ = 0.03;
  let fallZ = 0;
  let fallY = 0;
  let bob = 0;

  if (ko) {
    fallZ = (actor.koDir || 1) * 1.5;
    fallY = -0.1;
    armLX = -0.6; armRX = -0.4;
    armLZ = -0.8; armRZ = 0.8;
    legLX = 0.35; legRX = -0.2;
    headRZ = 0.25;
    torsoRX = 0.1;
  } else if (hurt) {
    const e = Math.max(0, 1 - st / 0.32);
    torsoRX = -0.32 * e;
    torsoRY = 0.2 * e;
    headRX = -0.3 * e;
    armLX = -0.8 * e; armRX = -0.8 * e;
    armLZ = -0.55 * e; armRZ = 0.55 * e;
    legLX = -0.25 * e; legRX = 0.15 * e;
    bob = -0.03 * e;
  } else if (state === 'special') {
    const sp = actor.specialProgress || 0;
    const type = actor.specialType;
    if (type === 'dash') {
      torsoRX = 0.28;
      headRX = -0.18;
      armRX = -1.3;
      armLX = 0.3;
      legLX = 0.7 + Math.sin(t * 20) * 0.25;
      legRX = -0.6 - Math.sin(t * 20) * 0.25;
    } else if (type === 'leap') {
      const air = sp < 0.62;
      armLX = -2.5; armRX = -2.5;
      armLZ = -0.4; armRZ = 0.4;
      legLX = air ? 0.9 : -0.1;
      legRX = air ? 0.7 : 0.1;
      torsoRX = air ? -0.2 : 0.45;
      headRX = air ? -0.2 : 0.25;
      bob = air ? 0.1 : -0.12;
    } else if (type === 'slam') {
      const raise = Math.min(1, sp / 0.4);
      const down = sp < 0.4 ? 0 : Math.min(1, (sp - 0.4) / 0.28);
      armLX = -2.6 * raise + 1.3 * down;
      armRX = -2.6 * raise + 1.3 * down;
      armLZ = -0.5; armRZ = 0.5;
      torsoRX = -0.25 * raise + 0.45 * down;
      legLX = 0.2; legRX = -0.2;
      bob = -0.08 * down;
    } else {
      // flurry
      const punch = Math.sin(st * 30) > 0;
      armRX = punch ? -1.65 : -0.7;
      armLX = punch ? -0.7 : -1.65;
      torsoRY = punch ? -0.3 : 0.3;
      torsoRX = 0.16;
      legLX = 0.55; legRX = -0.45;
    }
  } else if (state === 'attack' && atk) {
    const p = Math.min(1, st / atk.total);
    const power = actor.attackProgress !== undefined ? actor.attackProgress : 0;
    const strike = Math.sin(Math.min(1, p * 1.35) * Math.PI) * (p < 0.95 ? 1 : 0);
    if (atk.name === 'kick') {
      const pulse = p < 0.28 ? p / 0.28 : p < 0.52 ? 1 : Math.max(0, 1 - (p - 0.52) / 0.48);
      legRX = -1.45 * pulse;
      legLX = 0.12 * pulse;
      torsoRX = -0.2 * pulse;
      torsoRY = 0.25 * pulse;
      armLX = 0.4 * pulse; armRX = -0.9 * pulse;
      armLZ = -0.35; armRZ = 0.4;
      bob = 0.03 * pulse;
    } else if (atk.name === 'punch3') {
      const pulse = p < 0.3 ? p / 0.3 : p < 0.55 ? 1 : Math.max(0, 1 - (p - 0.55) / 0.45);
      armRX = -2.3 * pulse;
      armRZ = 0.09 - 0.5 * pulse;
      torsoRX = -0.16 * pulse;
      torsoRY = -0.5 * pulse;
      headRX = 0.15 * pulse;
      armLX = -0.55; armLZ = -0.2;
      legLX = 0.25 * pulse; legRX = -0.2 * pulse;
      bob = 0.07 * pulse;
    } else if (atk.name === 'punch2') {
      const pulse = p < 0.25 ? p / 0.25 : p < 0.5 ? 1 : Math.max(0, 1 - (p - 0.5) / 0.5);
      armLX = -1.62 * pulse;
      armLZ = -0.09 + 0.32 * pulse;
      torsoRY = 0.38 * pulse;
      torsoRX = 0.12 * pulse;
      armRX = -0.55; armRZ = 0.2;
      legLX = -0.2 * pulse; legRX = 0.2 * pulse;
      bob = 0.02 * pulse;
    } else if (atk.name === 'air') {
      armRX = -1.7 * strike;
      armLX = -1.3 * strike;
      armLZ = -0.3; armRZ = 0.3;
      legLX = 0.8; legRX = 0.4;
      torsoRX = -0.15;
      headRX = -0.1;
    } else {
      const pulse = p < 0.24 ? p / 0.24 : p < 0.48 ? 1 : Math.max(0, 1 - (p - 0.48) / 0.52);
      armRX = -1.62 * pulse;
      armRZ = 0.09 + 0.32 * pulse;
      torsoRY = -0.4 * pulse;
      torsoRX = 0.16 * pulse;
      headRY = -0.12 * pulse;
      armLX = -0.55;
      armLZ = -0.25;
      legLX = 0.26 * pulse;
      legRX = -0.22 * pulse;
      bob = 0.02 * pulse;
    }
    if (p > 0.55) {
      // combo recovery bounce
      bob += Math.sin((p - 0.55) * Math.PI) * 0.01;
    }
  } else if (block) {
    torsoRX = 0.12;
    headRX = 0.12;
    armLX = -1.45; armRX = -1.45;
    armLZ = 0.42; armRZ = -0.42;
    armLY = -0.25; armRY = 0.25;
    legLX = 0.18; legRX = -0.22;
    bob = -0.045;
  } else if (state === 'victory') {
    const hop = Math.max(0, Math.sin(t * 5)) * 0.09;
    armLX = -2.7; armRX = -2.7;
    armLZ = -0.45; armRZ = 0.45;
    legLX = -0.1; legRX = 0.1;
    torsoRX = -0.08;
    headRX = -0.15;
    bob = hop;
    headRZ = Math.sin(t * 3) * 0.12;
  } else if (airborne) {
    const rising = actor.vy > 0;
    torsoRX = rising ? -0.12 : 0.1;
    legLX = 0.65; legRX = 0.35;
    armLX = -0.6; armRX = -0.6;
    armLZ = -0.5; armRZ = 0.5;
    headRX = rising ? -0.16 : 0.08;
  } else if (run > 0.08) {
    const cycle = t * (8.5 + run * 2.5);
    const swing = Math.sin(cycle) * (0.55 + run * 0.35);
    legLX = swing;
    legRX = -swing;
    armLX = -BASE_ARM - swing * 0.9;
    armRX = -BASE_ARM + swing * 0.9;
    torsoRX = 0.09 + run * 0.1;
    torsoRY = Math.sin(cycle) * 0.08;
    headRY = -torsoRY * 0.5;
    bob = Math.abs(Math.sin(cycle)) * 0.035 - 0.015;
    torsoRZ = Math.cos(cycle) * 0.03;
  } else {
    // idle
    const idleSpeed = 2.1;
    bob = Math.sin(t * idleSpeed) * 0.018;
    torsoRX = Math.sin(t * idleSpeed) * 0.02;
    torsoRZ = Math.sin(t * idleSpeed * 0.5) * 0.02;
    headRY = Math.sin(t * 0.55) * 0.13;
    headRX = Math.sin(t * idleSpeed + 1) * 0.03;
    armLX = -BASE_ARM + Math.sin(t * idleSpeed) * 0.05;
    armRX = -BASE_ARM - Math.sin(t * idleSpeed) * 0.05;
    legLZ = -0.04; legRZ = 0.04;
  }

  // character quirks
  const id = actor.def?.id;
  if (id === 'doge' && !ko) {
    headRZ += Math.sin(t * 0.6) * 0.07;
    if (rig.tail) rig.tail.rotation.z = damp(rig.tail.rotation.z, Math.sin(t * (state === 'idle' ? 7 : 11)) * 0.6, 12, dt);
    if (run > 0.08) headRY += Math.sin(t * 9) * 0.06;
  }
  if (id === 'froggo' && !ko) {
    // big eye wobble + occasional blink
    const blinkCycle = (t * 0.55) % 1;
    const blink = blinkCycle > 0.93 ? 0.12 : 1;
    for (const e of rig.eyeTargets || []) e.scale.y = damp(e.scale.y, blink, 30, dt);
    headRZ += Math.sin(t * 0.8) * 0.05;
    if (state === 'idle') {
      // bouncy squat
      bob += Math.max(0, Math.sin(t * 2.1)) * 0.012;
    }
  }
  if (id === 'chad' && !ko) {
    const flex = Math.max(0, Math.sin(t * 0.9 - 1.2));
    if (state === 'idle' && flex > 0.86) {
      armLX -= 0.15; armRX -= 0.15;
      armLZ -= 0.22; armRZ += 0.22;
    }
    headRZ += Math.sin(t * 0.5) * 0.03;
    if (block) headRX += 0.06;
  }
  if (id === 'catto' && !ko) {
    if (rig.tail) {
      rig.tail.rotation.z = damp(rig.tail.rotation.z, Math.sin(t * 2.2) * 0.25 + 0.15, 5, dt);
      rig.tail.rotation.x = Math.sin(t * 1.4) * 0.08;
    }
    headRZ += Math.sin(t * 0.7) * 0.04;
    if (state === 'idle') {
      const blinkCycle = ((t + 1.2) * 0.4) % 1;
      const blink = blinkCycle > 0.94 ? 0.5 : 1;
      for (const e of rig.eyeTargets || []) e.scale.y = damp(e.scale.y, blink, 20, dt);
    }
  }

  // damage flash (emissive-ish via a red point light? handled by material tint in main)
  const stiff = 18;
  rig.torso.position.y = damp(rig.torso.position.y, rig.torso.userData.baseY ?? 0.92, 12, dt);
  if (rig.torso.userData.baseY === undefined) {
    rig.torso.userData.baseY = rig.torso.position.y;
  }
  rig.torso.position.y = damp(rig.torso.position.y, rig.torso.userData.baseY + bob, stiff, dt);
  rig.torso.rotation.x = damp(rig.torso.rotation.x, torsoRX, stiff, dt);
  rig.torso.rotation.y = damp(rig.torso.rotation.y, torsoRY, stiff, dt);
  rig.torso.rotation.z = damp(rig.torso.rotation.z, torsoRZ, stiff, dt);

  rig.head.rotation.x = damp(rig.head.rotation.x, headRX, stiff, dt);
  rig.head.rotation.y = damp(rig.head.rotation.y, headRY, stiff * 0.8, dt);
  rig.head.rotation.z = damp(rig.head.rotation.z, headRZ, stiff * 0.8, dt);

  rig.armL.rotation.x = damp(rig.armL.rotation.x, armLX, stiff, dt);
  rig.armR.rotation.x = damp(rig.armR.rotation.x, armRX, stiff, dt);
  rig.armL.rotation.z = damp(rig.armL.rotation.z, armLZ, stiff, dt);
  rig.armR.rotation.z = damp(rig.armR.rotation.z, armRZ, stiff, dt);
  rig.armL.rotation.y = damp(rig.armL.rotation.y, armLY, stiff, dt);
  rig.armR.rotation.y = damp(rig.armR.rotation.y, armRY, stiff, dt);

  rig.legL.rotation.x = damp(rig.legL.rotation.x, legLX, stiff, dt);
  rig.legR.rotation.x = damp(rig.legR.rotation.x, legRX, stiff, dt);
  rig.legL.rotation.z = damp(rig.legL.rotation.z, legLZ, stiff, dt);
  rig.legR.rotation.z = damp(rig.legR.rotation.z, legRZ, stiff, dt);

  rig.fall.rotation.z = damp(rig.fall.rotation.z, fallZ, ko ? 7 : 14, dt);
  rig.fall.rotation.x = damp(rig.fall.rotation.x, 0, 10, dt);
  rig.fall.position.y = damp(rig.fall.position.y, fallY, 9, dt);

  const hitFlash = actor.hitFlash || 0;
  if (rig.flashMaterials) {
    for (const m of rig.flashMaterials) m.emissiveIntensity = hitFlash;
  }
}

/* ============================================================
   AVATARS (crisp inline SVG for cards + HUD)
   ============================================================ */
const svgOpen = '<svg viewBox="0 0 100 84" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">';
const svgClose = '</svg>';

export const AVATARS = {
  doge: `${svgOpen}
    <defs><linearGradient id="dg-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffc93c" stop-opacity=".22"/><stop offset="1" stop-color="#3f7cff" stop-opacity=".25"/></linearGradient></defs>
    <rect width="100" height="84" fill="url(#dg-bg)"/>
    <ellipse cx="50" cy="88" rx="35" ry="26" fill="#3f7cff" stroke="#171020" stroke-width="3"/>
    <path d="M32 64 L50 58 L68 64 L64 84 L36 84 Z" fill="#2452c9"/>
    <path d="M30 32 L20 8 L40 19 Z" fill="#e8a23c" stroke="#171020" stroke-width="3" stroke-linejoin="round"/>
    <path d="M70 32 L80 8 L60 19 Z" fill="#e8a23c" stroke="#171020" stroke-width="3" stroke-linejoin="round"/>
    <path d="M28 27 L24 15 L35 22 Z" fill="#ff9eb5"/>
    <path d="M72 27 L76 15 L65 22 Z" fill="#ff9eb5"/>
    <ellipse cx="50" cy="43" rx="28" ry="25" fill="#e8a23c" stroke="#171020" stroke-width="3"/>
    <ellipse cx="40" cy="55" rx="13" ry="10" fill="#f9e2b8"/>
    <ellipse cx="60" cy="55" rx="13" ry="10" fill="#f9e2b8"/>
    <ellipse cx="50" cy="49" rx="6.5" ry="4.6" fill="#2a1d18"/>
    <path d="M50 54 v5" stroke="#2a1d18" stroke-width="2" stroke-linecap="round"/>
    <ellipse cx="36" cy="35" rx="8" ry="9" fill="#fff" stroke="#171020" stroke-width="1.4"/>
    <ellipse cx="64" cy="35" rx="8" ry="9" fill="#fff" stroke="#171020" stroke-width="1.4"/>
    <ellipse cx="38" cy="36" rx="3.7" ry="4.4" fill="#2a1d18"/>
    <ellipse cx="62" cy="36" rx="3.7" ry="4.4" fill="#2a1d18"/>
    <circle cx="39.5" cy="34" r="1.2" fill="#fff"/><circle cx="63.5" cy="34" r="1.2" fill="#fff"/>
    <path d="M27 25 q9 -5 17 -1" stroke="#b87320" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M73 25 q-9 -5 -17 -1" stroke="#b87320" stroke-width="3" fill="none" stroke-linecap="round"/>
    <path d="M43 61 q7 4 14 0" stroke="#2a1d18" stroke-width="2" fill="none" stroke-linecap="round"/>
  ${svgClose}`,
  froggo: `${svgOpen}
    <defs><linearGradient id="fg-bg" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#66ff8a" stop-opacity=".25"/><stop offset="1" stop-color="#1f6b3a" stop-opacity=".3"/></linearGradient></defs>
    <rect width="100" height="84" fill="url(#fg-bg)"/>
    <ellipse cx="50" cy="88" rx="33" ry="23" fill="#202028" stroke="#171020" stroke-width="3"/>
    <path d="M39 68 L50 61 L61 68 L60 84 L40 84 Z" fill="#66ff8a"/>
    <circle cx="32" cy="22" r="13" fill="#fff" stroke="#171020" stroke-width="3"/>
    <circle cx="68" cy="22" r="13" fill="#fff" stroke="#171020" stroke-width="3"/>
    <circle cx="34" cy="23" r="5.5" fill="#1c2a16"/><circle cx="66" cy="23" r="5.5" fill="#1c2a16"/>
    <circle cx="36" cy="21" r="1.6" fill="#fff"/><circle cx="68" cy="21" r="1.6" fill="#fff"/>
    <ellipse cx="50" cy="48" rx="33" ry="26" fill="#7ad64a" stroke="#171020" stroke-width="3"/>
    <ellipse cx="29" cy="46" rx="7" ry="5" fill="#5fb536" opacity=".8"/>
    <ellipse cx="72" cy="51" rx="6" ry="4" fill="#5fb536" opacity=".8"/>
    <path d="M29 53 Q50 73 71 53" stroke="#2a3a1f" stroke-width="3.2" fill="none" stroke-linecap="round"/>
    <circle cx="42" cy="42" r="1.6" fill="#4f9a2d"/><circle cx="58" cy="42" r="1.6" fill="#4f9a2d"/>
    <path d="M50 68 Q44 62 38 66" stroke="#ffce42" stroke-width="3" fill="none"/>
    <path d="M50 68 Q56 62 62 66" stroke="#ffce42" stroke-width="3" fill="none"/>
    <rect x="46" y="66" width="8" height="7" rx="2" fill="#ffce42"/>
    <ellipse cx="73" cy="22" rx="9" ry="4" fill="#9dff6a" stroke="#171020" stroke-width="2" transform="rotate(24 73 22)"/>
  ${svgClose}`,
  chad: `${svgOpen}
    <defs><linearGradient id="ch-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff425d" stop-opacity=".26"/><stop offset="1" stop-color="#ffd52e" stop-opacity=".2"/></linearGradient></defs>
    <rect width="100" height="84" fill="url(#ch-bg)"/>
    <path d="M22 84 L28 64 Q50 55 72 64 L78 84 Z" fill="#ff425d" stroke="#171020" stroke-width="3"/>
    <path d="M36 66 L42 84 M64 66 L58 84" stroke="#bf2740" stroke-width="3"/>
    <ellipse cx="23" cy="69" rx="10" ry="13" fill="#f0bd8a" stroke="#171020" stroke-width="3"/>
    <ellipse cx="77" cy="69" rx="10" ry="13" fill="#f0bd8a" stroke="#171020" stroke-width="3"/>
    <rect x="31" y="17" width="38" height="45" rx="8" fill="#f0bd8a" stroke="#171020" stroke-width="3"/>
    <path d="M31 24 Q50 4 69 24 L69 16 Q50 -2 31 16 Z" fill="#f1cf4b" stroke="#171020" stroke-width="3"/>
    <path d="M24 28 Q23 48 31 56 L31 34 Z" fill="#f1cf4b" stroke="#171020" stroke-width="3"/>
    <path d="M76 28 Q77 48 69 56 L69 34 Z" fill="#f1cf4b" stroke="#171020" stroke-width="3"/>
    <rect x="33" y="36" width="34" height="10" rx="3" fill="#17151f" stroke="#171020" stroke-width="2"/>
    <path d="M39 38 l5 5" stroke="#6f7cff" stroke-width="2.4" stroke-linecap="round"/>
    <path d="M56 50 Q61 54 66 51" stroke="#5e3325" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    <path d="M42 58 q8 6 16 0" stroke="#d69a66" stroke-width="2.2" fill="none" stroke-linecap="round"/>
    <circle cx="50" cy="61" r="1.6" fill="#d69a66"/>
    <path d="M31 38 L31 52" stroke="#d69a66" stroke-width="2"/>
  ${svgClose}`,
  catto: `${svgOpen}
    <defs><linearGradient id="ct-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7eb0" stop-opacity=".3"/><stop offset="1" stop-color="#7b4dff" stop-opacity=".22"/></linearGradient></defs>
    <rect width="100" height="84" fill="url(#ct-bg)"/>
    <ellipse cx="50" cy="88" rx="34" ry="24" fill="#ff7eb0" stroke="#171020" stroke-width="3"/>
    <path d="M38 66 L50 60 L62 66 L60 84 L40 84 Z" fill="#fff4e0"/>
    <path d="M31 34 L19 10 L42 22 Z" fill="#fff0d4" stroke="#171020" stroke-width="3" stroke-linejoin="round"/>
    <path d="M69 34 L81 10 L58 22 Z" fill="#fff0d4" stroke="#171020" stroke-width="3" stroke-linejoin="round"/>
    <path d="M30 30 L24 16 L36 24 Z" fill="#ffa8c2"/>
    <path d="M70 30 L76 16 L64 24 Z" fill="#ffa8c2"/>
    <ellipse cx="50" cy="44" rx="30" ry="25" fill="#fff0d4" stroke="#171020" stroke-width="3"/>
    <ellipse cx="36" cy="43" rx="8.5" ry="9.5" fill="#fff" stroke="#171020" stroke-width="1.4"/>
    <ellipse cx="64" cy="43" rx="8.5" ry="9.5" fill="#fff" stroke="#171020" stroke-width="1.4"/>
    <ellipse cx="37" cy="44" rx="2.6" ry="5.6" fill="#2b241f"/>
    <ellipse cx="63" cy="44" rx="2.6" ry="5.6" fill="#2b241f"/>
    <path d="M27 34 L44 33 M73 34 L56 33" stroke="#171020" stroke-width="4" stroke-linecap="round"/>
    <ellipse cx="50" cy="57" rx="4" ry="3" fill="#ff9bb6"/>
    <path d="M50 58 v3 M50 61 q-6 5 -11 0 M50 61 q6 5 11 0" stroke="#5a4036" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M28 56 L15 52 M28 60 L14 61 M72 56 L85 52 M72 60 L86 61" stroke="#4a3b34" stroke-width="1.7" stroke-linecap="round"/>
    <path d="M39 65 q11 4 22 0" stroke="#ff7eb0" stroke-width="2" fill="none"/>
  ${svgClose}`,
};

export function avatarFor(id) {
  return AVATARS[id] || AVATARS.doge;
}
