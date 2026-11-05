import { FIGHTERS, avatarFor } from './fighters.js';
import { $, $$, clamp, pick, WIN_SUBS, LOSE_SUBS, DRAW_SUBS } from './utils.js';

const CONF_COLORS = ['#ffd52e', '#ff3d7f', '#39e7ff', '#7b4dff', '#66ff8a', '#fff7e3'];

export class UI {
  constructor(game) {
    this.game = game;
    this.screen = 'loading';
    this.selectedId = 'doge';
    this.opponentId = 'chad';
    this.announceTimers = [];
    this.toastTimer = null;
    this.comboTimer = null;
    this.flashTimer = null;
    this.refs = {
      title: $('#screen-title'),
      select: $('#screen-select'),
      hud: $('#hud'),
      touch: $('#touch-controls'),
      how: $('#screen-how'),
      pause: $('#screen-pause'),
      result: $('#screen-result'),
      loading: $('#screen-loading'),
      loadingBar: $('#loading-bar'),
      loadingTip: $('#loading-tip'),
      roster: $('#roster'),
      opponentName: $('#opponent-name'),
      fightName: $('#fighter-name'),
      fightRole: $('#fighter-role'),
      fightTagline: $('#fighter-tagline'),
      fightSpecial: $('#fighter-special'),
      fightSpecialDesc: $('#fighter-special-desc'),
      statPow: $('#stat-pow'),
      statSpd: $('#stat-spd'),
      statDef: $('#stat-def'),
      statRch: $('#stat-rch'),
      portP: $('#portrait-player'),
      portE: $('#portrait-enemy'),
      nameP: $('#name-player'),
      nameE: $('#name-enemy'),
      hpP: $('#hp-player'),
      hpPGhost: $('#hp-player-ghost'),
      hpE: $('#hp-enemy'),
      hpEGhost: $('#hp-enemy-ghost'),
      hpPText: $('#hp-player-text'),
      hpEText: $('#hp-enemy-text'),
      meterP: $('#meter-player'),
      meterE: $('#meter-enemy'),
      pipsP: $('#pips-player'),
      pipsE: $('#pips-enemy'),
      roundLabel: $('#round-label'),
      timer: $('#timer'),
      announcer: $('#announcer'),
      announceInner: $('#announcer .announce-inner'),
      toast: $('#toast'),
      combo: $('#combo'),
      comboCount: $('#combo-count'),
      btnSpecial: $('#btn-special'),
      flash: $('#flash'),
      resultTitle: $('#result-title'),
      resultSub: $('#result-sub'),
      resultBadge: $('#result-badge'),
      resultKicker: $('#result-kicker'),
      resultStats: $('#result-stats'),
      resultConfetti: $('#result-confetti'),
      soundIcon: $('#sound-icon'),
      soundLabel: $('#sound-label'),
    };
    this.buildRoster();
    this.bind();
  }

  buildRoster() {
    this.refs.roster.innerHTML = FIGHTERS.map((f) => `
      <button class="roster-card" data-id="${f.id}" role="option" aria-selected="false" type="button" aria-label="${f.name}, ${f.role}">
        <span class="avatar">${avatarFor(f.id)}</span>
        <span class="card-meta">
          <span class="card-name">${f.name}</span>
          <span class="card-role">${f.role}</span>
        </span>
      </button>
    `).join('');
    this.refs.roster.addEventListener('click', (e) => {
      const card = e.target.closest('[data-id]');
      if (!card) return;
      this.game.pickFighter(card.dataset.id);
    });
  }

  bind() {
    const click = (id, fn) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', (e) => { e.preventDefault(); fn(); });
    };
    click('btn-play', () => this.game.openSelect());
    click('btn-how', () => this.game.openHow());
    click('btn-sound', () => this.game.toggleSound());
    click('btn-sound-pause', () => this.game.toggleSound());
    click('btn-back', () => this.game.backToTitle());
    click('btn-shuffle', () => this.game.shuffleOpponent());
    click('btn-fight', () => this.game.startFight());
    click('btn-pause', () => this.game.pause());
    click('btn-resume', () => this.game.resume());
    click('btn-restart', () => this.game.restartMatch());
    click('btn-quit', () => this.game.quitToTitle());
    click('btn-rematch', () => this.game.rematch());
    click('btn-change', () => this.game.changeFighter());
    $$('[data-close="how"]').forEach((el) => el.addEventListener('click', () => this.hideHow()));
    this.refs.how.addEventListener('pointerdown', (e) => {
      if (e.target === this.refs.how) this.hideHow();
    });
  }

  setScreen(name) {
    this.screen = name;
    document.body.dataset.screen = name;
    this.refs.title.hidden = name !== 'title';
    this.refs.select.hidden = name !== 'select';
    const fighty = name === 'fight' || name === 'paused';
    this.refs.hud.hidden = !fighty;
    this.refs.touch.hidden = name !== 'fight';
  }

  setLoading(progress, tip) {
    this.refs.loadingBar.style.width = `${clamp(progress, 2, 100)}%`;
    if (tip) this.refs.loadingTip.textContent = tip;
  }

  finishLoading() {
    this.refs.loading.classList.add('done');
    setTimeout(() => { this.refs.loading.hidden = true; }, 650);
  }

  setSelection(id) {
    this.selectedId = id;
    $$('.roster-card', this.refs.roster).forEach((card) => {
      card.setAttribute('aria-selected', card.dataset.id === id ? 'true' : 'false');
    });
    const def = FIGHTERS.find((f) => f.id === id) || FIGHTERS[0];
    this.refs.fightName.textContent = def.name;
    this.refs.fightRole.textContent = def.role;
    this.refs.fightTagline.textContent = def.tagline;
    this.refs.fightSpecial.textContent = def.specialName;
    this.refs.fightSpecialDesc.textContent = def.specialDesc;
    this.refs.statPow.style.width = `${def.stats.pow * 20}%`;
    this.refs.statSpd.style.width = `${def.stats.spd * 20}%`;
    this.refs.statDef.style.width = `${def.stats.def * 20}%`;
    this.refs.statRch.style.width = `${def.stats.rch * 20}%`;
  }

  setOpponent(id) {
    this.opponentId = id;
    const def = FIGHTERS.find((f) => f.id === id) || FIGHTERS[1];
    this.refs.opponentName.textContent = def.name;
  }

  setFighters(p, e) {
    this.refs.nameP.textContent = p.name;
    this.refs.nameE.textContent = e.name;
    this.refs.portP.innerHTML = avatarFor(p.id);
    this.refs.portE.innerHTML = avatarFor(e.id);
    this.setHealth(100, 100);
    this.setMeter(0, 0);
  }

  setHealth(ph, eh) {
    const pr = clamp(ph, 0, 100) / 100;
    const er = clamp(eh, 0, 100) / 100;
    this.refs.hpP.style.transform = `scaleX(${pr})`;
    this.refs.hpPGhost.style.transform = `scaleX(${pr})`;
    this.refs.hpE.style.transform = `scaleX(${er})`;
    this.refs.hpEGhost.style.transform = `scaleX(${er})`;
    this.refs.hpPText.textContent = Math.ceil(ph);
    this.refs.hpEText.textContent = Math.ceil(eh);
    this.refs.hpP.classList.toggle('low', pr <= 0.25);
    this.refs.hpE.classList.toggle('low', er <= 0.25);
  }

  setMeter(pm, em) {
    const p = clamp(pm, 0, 100);
    const e = clamp(em, 0, 100);
    this.refs.meterP.style.width = `${p}%`;
    this.refs.meterE.style.width = `${e}%`;
    this.refs.btnSpecial.style.setProperty('--fill', `${p}%`);
    this.refs.btnSpecial.classList.toggle('ready', p >= 100);
    this.refs.btnSpecial.classList.toggle('cooldown', p < 100);
  }

  setPips(pw, ew) {
    $$('i', this.refs.pipsP).forEach((el, i) => el.classList.toggle('on', i < pw));
    $$('i', this.refs.pipsE).forEach((el, i) => el.classList.toggle('on', i < ew));
  }

  setRound(n) {
    this.refs.roundLabel.textContent = n >= 3 ? 'FINAL ROUND' : `ROUND ${n}`;
  }

  setTimer(seconds) {
    const v = Math.max(0, Math.ceil(seconds));
    if (this.refs.timer.textContent !== String(v)) this.refs.timer.textContent = String(v);
    this.refs.timer.classList.toggle('urgent', v <= 10);
  }

  setSound(isMuted) {
    this.refs.soundIcon.textContent = isMuted ? '🔇' : '🔊';
    this.refs.soundLabel.textContent = isMuted ? 'SOUND OFF' : 'SOUND ON';
    const pauseBtn = $('#btn-sound-pause');
    if (pauseBtn) {
      const spans = $$('span', pauseBtn);
      if (spans[0]) spans[0].textContent = isMuted ? '🔇' : '🔊';
    }
    $('#btn-sound').setAttribute('aria-pressed', String(!isMuted));
  }

  announce(text, opts = {}) {
    this.announceTimers.forEach((t) => clearTimeout(t));
    this.announceTimers = [];
    const el = this.refs.announcer;
    const inner = this.refs.announceInner;
    el.classList.remove('show', 'hide');
    inner.className = `announce-inner ${opts.cls || ''}`;
    inner.textContent = text;
    void inner.offsetWidth;
    el.classList.add('show');
    const duration = opts.duration ?? 1500;
    this.announceTimers.push(setTimeout(() => {
      el.classList.add('hide');
      this.announceTimers.push(setTimeout(() => {
        el.classList.remove('show', 'hide');
      }, 380));
    }, duration));
  }

  clearAnnounce() {
    this.announceTimers.forEach((t) => clearTimeout(t));
    this.announceTimers = [];
    this.refs.announcer.classList.remove('show', 'hide');
  }

  toast(text, kind = '') {
    const el = this.refs.toast;
    el.className = `toast show ${kind}`.trim();
    el.textContent = text;
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.remove('show'), 1200);
  }

  showCombo(n) {
    const el = this.refs.combo;
    this.refs.comboCount.textContent = String(n);
    el.classList.add('show');
    el.classList.remove('pulse');
    void el.offsetWidth;
    el.classList.add('pulse');
    clearTimeout(this.comboTimer);
    this.comboTimer = setTimeout(() => el.classList.remove('pulse'), 260);
  }

  hideCombo() {
    this.refs.combo.classList.remove('show', 'pulse');
  }

  flash(kind = '') {
    this.refs.flash.className = kind;
    void this.refs.flash.offsetWidth;
    this.refs.flash.classList.add('on');
    clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => this.refs.flash.classList.remove('on'), 60);
  }

  showPause() {
    this.refs.pause.hidden = false;
  }

  hidePause() {
    this.refs.pause.hidden = true;
  }

  showHow() {
    this.refs.how.hidden = false;
    this.refs.how.scrollTop = 0;
  }

  hideHow() {
    this.refs.how.hidden = true;
  }

  showResult({ win, draw, stats }) {
    const badge = this.refs.resultBadge;
    badge.className = 'result-badge';
    if (draw) {
      badge.classList.add('draw');
      badge.textContent = 'D';
      this.refs.resultTitle.textContent = 'DRAW?';
      this.refs.resultSub.textContent = pick(DRAW_SUBS);
      this.refs.resultKicker.textContent = 'THE INTERNET IS CONFUSED';
    } else if (win) {
      badge.textContent = 'W';
      this.refs.resultTitle.textContent = 'VICTORY!';
      this.refs.resultSub.textContent = pick(WIN_SUBS);
      this.refs.resultKicker.textContent = 'THE INTERNET HAS SPOKEN';
    } else {
      badge.classList.add('lose');
      badge.textContent = 'L';
      this.refs.resultTitle.textContent = 'DEFEAT';
      this.refs.resultSub.textContent = pick(LOSE_SUBS);
      this.refs.resultKicker.textContent = 'RETURN TO THE DRAFTS';
    }
    this.refs.resultStats.innerHTML = [
      ['DAMAGE DEALT', Math.round(stats.damage)],
      ['HITS LANDED', stats.hits],
      ['BEST COMBO', `${stats.maxCombo}×`],
    ].map(([label, value]) => `
      <div class="rstat"><b>${value}</b><span>${label}</span></div>
    `).join('');
    this.refs.resultConfetti.innerHTML = '';
    if (win) {
      for (let i = 0; i < 26; i++) {
        const bit = document.createElement('i');
        bit.className = 'confetti-bit';
        bit.style.left = `${Math.random() * 100}%`;
        bit.style.background = pick(CONF_COLORS);
        bit.style.setProperty('--drift', `${Math.round((Math.random() - 0.5) * 180)}px`);
        bit.style.animationDuration = `${1.3 + Math.random() * 1.8}s`;
        bit.style.animationDelay = `${Math.random() * 0.5}s`;
        bit.style.width = `${4 + Math.random() * 6}px`;
        bit.style.height = `${6 + Math.random() * 10}px`;
        this.refs.resultConfetti.appendChild(bit);
      }
    }
    this.setScreen('result');
    this.refs.result.hidden = false;
  }

  hideResult() {
    this.refs.result.hidden = true;
    this.refs.resultConfetti.innerHTML = '';
  }

  resetFightHUD() {
    this.refs.combo.classList.remove('show');
    this.refs.timer.classList.remove('urgent');
    this.refs.pipsP.querySelectorAll('i').forEach((i) => i.classList.remove('on'));
    this.refs.pipsE.querySelectorAll('i').forEach((i) => i.classList.remove('on'));
    this.setHealth(100, 100);
    this.setMeter(0, 0);
  }
}
