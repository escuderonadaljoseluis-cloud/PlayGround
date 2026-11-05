export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export const TAU = Math.PI * 2;

export function dampAngle(current, target, lambda, dt) {
  let delta = ((target - current + Math.PI) % TAU) - Math.PI;
  if (delta < -Math.PI) delta += TAU;
  return current + delta * (1 - Math.exp(-lambda * dt));
}

export const ARENA_RADIUS = 8.55;
export const MAX_HP = 100;
export const MAX_METER = 100;
export const ROUND_TIME = 60;

export const ATTACKS = {
  punch1: {
    name: 'punch1', windup: 0.1, active: 0.08, recover: 0.17, damage: 5,
    range: 1.78, knockback: 2.4, hitStun: 0.24, meterGain: 7, lunge: 2.2,
    next: 'punch2', canChain: true, heavy: false, total: 0.35,
  },
  punch2: {
    name: 'punch2', windup: 0.09, active: 0.08, recover: 0.19, damage: 6,
    range: 1.82, knockback: 3.2, hitStun: 0.26, meterGain: 7, lunge: 2.6,
    next: 'punch3', canChain: true, heavy: false, total: 0.36,
  },
  punch3: {
    name: 'punch3', windup: 0.16, active: 0.1, recover: 0.32, damage: 11,
    range: 2.02, knockback: 7.2, hitStun: 0.5, meterGain: 12, lunge: 3.4,
    next: null, canChain: false, heavy: true, total: 0.58,
  },
  kick: {
    name: 'kick', windup: 0.17, active: 0.1, recover: 0.33, damage: 9,
    range: 2.34, knockback: 6, hitStun: 0.4, meterGain: 9, lunge: 2.4,
    next: null, canChain: false, heavy: true, total: 0.6,
  },
  air: {
    name: 'air', windup: 0.07, active: 0.16, recover: 0.22, damage: 8,
    range: 1.9, knockback: 4, hitStun: 0.34, meterGain: 8, lunge: 0,
    next: null, canChain: false, heavy: false, air: true, total: 0.45,
  },
};

export const COMBO_QUIPS = [
  { at: 3, text: 'SHEESH!' },
  { at: 5, text: 'NO CAP!' },
  { at: 7, text: 'ABSOLUTE UNIT!' },
  { at: 10, text: 'INTERNET BROKE!' },
];

export const KO_QUIPS = ['BONK!', 'GET REKT', 'SKILL ISSUE', 'TOO EASY', 'GG EZ', 'SHEESH'];

export const WIN_SUBS = [
  'The crowd goes wild. Well, mildly wild.',
  'You are officially the main character.',
  'Your thumbs are built different.',
  'The algorithm has chosen you.',
];

export const LOSE_SUBS = [
  'Skill issue. Respectfully.',
  'The meme won. The meme always wins.',
  'Touch grass, then rematch.',
  'Your thumbs have been nerfed.',
];

export const DRAW_SUBS = [
  'A draw? In this economy?',
  'Nobody won. Everyone lost. Classic internet.',
];
