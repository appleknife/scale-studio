// petroom.js — the pet room screen: the pet moving about, the eggs, hatching,
// feeding and decorating. The rules live in pet.js and the drawing in
// petart.js; this file is the part that is alive.
//
// The pet is a small state machine run on timers while the room is on screen
// (and nothing at all while it is not):
//
//   idle    breathing, blinking, now and then wandering to a new spot
//   walk    trotting somewhere — towards a snack, after a ball
//   eat     head down at the bowl, three bites
//   happy   ^ ^ eyes and a hop, hearts — after a pat, a snack, a game
//   sleep   eyes closed, Zzz — after a long quiet spell, or at night; a tap wakes it
//
// Movement is tweened in JavaScript (an SVG attribute, so it is the same in
// every browser); the breathing, blinking, wagging and hopping are CSS on the
// pet's own parts.

import * as Pet from './pet.js?v=202611131615';
import {
  petMarkup,
  eggMarkup,
  eggHalves,
  foodMarkup,
  foodIcon,
  roomMarkup,
  clockNow,
  ballMarkup,
  itemIcon,
  petIcon,
  petSilhouette,
  STAGE_SCALE,
  HEART,
} from './petart.js?v=202611131615';
import { t, getLang } from './i18n.js?v=202611131615';

const NS = 'http://www.w3.org/2000/svg';
const FLOOR_Y = 268; // where feet stand
const PET_SCALE = 0.8; // the 100-unit pet box, in room units
const FISH_SCALE = 0.62;
const BOWL = { x: 126, y: 262 }; // the food bowl, for the land pets
const BED = { x: 296, y: 266 };
const SLEEP_AFTER = 55000; // a quiet spell long enough for a nap

const SOUNDS = {
  dog: ['pet.say.dog1', 'pet.say.dog2'],
  cat: ['pet.say.cat1', 'pet.say.cat2'],
  hamster: ['pet.say.hamster1', 'pet.say.hamster2'],
  chicken: ['pet.say.chicken1', 'pet.say.chicken2'],
  fish: ['pet.say.fish1', 'pet.say.fish2'],
};

const NAMES = {
  dog: ['Biscuit', 'Mozzie', 'Waffles', 'Haydn'],
  cat: ['Mochi', 'Clara', 'Pudding', 'Chopin'],
  hamster: ['Peanut', 'Nibbles', 'Bachy', 'Dumpling'],
  chicken: ['Sunny', 'Peep', 'Nugget', 'Vivaldi'],
  fish: ['Bubbles', 'Coral', 'Fin', 'Elgar'],
};

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function node(tag, attrs = {}, html = '') {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (html) n.innerHTML = html;
  return n;
}

/**
 * The room controller.
 *
 * `els` holds the screen's parts (svg, notes, panel, foot, bubble, title, lead).
 * `profileId()` names whose pet is on screen; `onPractise()` sends the student
 * to the scales; `demo` turns on the "pretend I practised" button.
 */
export function createPetRoom({ els, profileId, onPractise = () => {}, demo = false, hour = null }) {
  let pet = Pet.loadPet(profileId());
  let running = false;
  let timers = [];
  let raf = 0;
  let mode = 'idle';
  let pos = { x: 210, y: FLOOR_Y };
  let facing = 1; // 1 = as drawn, -1 = mirrored
  let lastTouch = Date.now();
  let tray = null; // 'feed' | 'decorate' | 'pets' | null
  let choosing = false; // picking the next egg, with a grown pet in the room
  // A purchase waiting for its "Buy" — one tap picks, a second button pays, so a
  // stray tap never spends a week's notes. { kind: 'snack' | 'item', id }
  let pending = null;
  let renaming = false;
  let picked = null; // the egg being considered
  let ball = null; // { x, y } while a ball is out
  let busy = false; // a scripted moment (eating, hatching) is playing
  let held = false; // the pet is in the student's hand
  let drag = null; // a press that may become a drag: { kind, id, el, start, from, moved }
  let skyStep = -1; // which five minutes the window was last painted for

  // The time the room goes by: the clock, or `?hour=21` to see the evening at noon.
  const timeNow = () => (Number.isFinite(hour) ? hour : clockNow());
  // The bowl and the bed are wherever they have been dragged to.
  const bowlAt = () => ({ x: BOWL.x + Pet.itemAt(pet, 'bowl').x, y: BOWL.y });
  const bedAt = () => ({ x: BED.x + Pet.itemAt(pet, 'bed').x, y: BED.y });
  const roomArt = () => roomMarkup({ placed: pet.placed, wall: pet.wall, floor: pet.floor, fish: isFish(), hour: timeNow(), where: pet.where });

  const layers = {};

  const save = () => Pet.savePet(profileId(), pet);
  const isFish = () => Boolean(pet.pet && pet.pet.species === 'fish');
  const later = (fn, ms) => {
    const id = setTimeout(() => {
      timers = timers.filter((x) => x !== id);
      if (running) fn();
    }, ms);
    timers.push(id);
    return id;
  };

  // ── Drawing ────────────────────────────────────────────────────────────

  function drawRoom() {
    const svg = els.svg;
    svg.innerHTML = '';
    layers.room = node('g', { class: 'room-base' }, roomArt());
    skyStep = Math.floor(timeNow() * 12);
    layers.stage = node('g', { class: 'room-stage' });
    layers.fx = node('g', { class: 'room-fx', 'pointer-events': 'none' });
    svg.append(layers.room, layers.stage, layers.fx);

    if (pet.pet && !choosing) {
      if (pet.placed.includes('ball') && !isFish()) {
        ball = ball || { x: 250, y: FLOOR_Y - 8 };
        layers.ball = node('g', { class: 'ball-pos', transform: `translate(${ball.x} ${ball.y})` }, ballMarkup());
        layers.ball.addEventListener('pointerdown', kickBall);
        layers.stage.append(layers.ball);
      } else {
        ball = null;
      }
      layers.petPos = node('g', { class: 'pet-pos' });
      layers.petFlip = node('g', { class: 'pet-flip' });
      layers.pet = node('g', { class: 'pet-hit', role: 'button', tabindex: '0', 'aria-label': t('pet.aria.pat', { name: pet.pet.name || t(`pet.kind.${pet.pet.species}`) }) }, petMarkup(pet.pet.species, pet.pet.variant));
      layers.petFlip.append(layers.pet);
      layers.petPos.append(layers.petFlip);
      layers.stage.append(layers.petPos);
      // A press on the pet is a pat if it is let go, and a lift if it is carried.
      layers.pet.addEventListener('pointerdown', (event) => {
        if (busy) return;
        if (isFish()) {
          patPet();
          return;
        }
        beginDrag(event, { kind: 'pet', from: { ...pos } });
      });
      layers.pet.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          patPet();
        }
      });
      if (isFish()) pos = { x: 200, y: 164 };
      else if (pos.y !== FLOOR_Y) pos = { x: 210, y: FLOOR_Y };
      placePet();
      setMode(mode === 'sleep' ? 'sleep' : 'idle');
    } else {
      drawEggs();
    }
  }

  function placePet() {
    if (!layers.petPos) return;
    // Smaller while it is young; the feet (or the fish's middle) stay put.
    const s = (isFish() ? FISH_SCALE : PET_SCALE) * (STAGE_SCALE[Pet.stageOf(pet.pet)] || 1);
    // The box's feet are at (50, 96); the fish's middle at (50, 50).
    const ax = 50 * s;
    const ay = (isFish() ? 50 : 96) * s;
    layers.petPos.setAttribute('transform', `translate(${(pos.x - ax).toFixed(1)} ${(pos.y - ay).toFixed(1)}) scale(${s})`);
    layers.petFlip.setAttribute('transform', facing === -1 ? 'translate(100 0) scale(-1 1)' : '');
  }

  function setMode(next) {
    mode = next;
    if (!layers.pet) return;
    const root = layers.pet.querySelector('.pet');
    if (!root) return;
    for (const m of ['idle', 'walk', 'eat', 'happy', 'sleep', 'born']) root.classList.toggle(`is-${m}`, m === next);
    if (next === 'sleep') startZzz();
  }

  function drawEggs() {
    const stage = layers.stage;
    if (pet.egg) {
      // The chosen egg, in its nest in the middle of the room.
      const crack = Math.min(3, pet.egg.warmth);
      stage.append(
        node('ellipse', { cx: 200, cy: 268, rx: 52, ry: 11, fill: '#f3d9b5', stroke: '#d7b48a', 'stroke-width': 2 }),
        node('path', { d: 'M152 266 q48 18 96 0', fill: 'none', stroke: '#e6c497', 'stroke-width': 5, 'stroke-linecap': 'round' }),
      );
      layers.egg = node('g', { class: 'egg-pos', transform: 'translate(166 196) scale(.7)', role: 'button', tabindex: '0', 'aria-label': t('pet.aria.egg') }, eggMarkup(pet.egg.species, crack));
      layers.egg.addEventListener('pointerdown', () => wobbleEgg(true));
      stage.append(layers.egg);
      scheduleEggWobble();
      return;
    }
    // Five eggs on a long cushion, to choose from.
    stage.append(
      node('rect', { x: 26, y: 246, width: 348, height: 26, rx: 13, fill: '#f6cfc4', stroke: '#e0a99b', 'stroke-width': 2 }),
      node('path', { d: 'M40 259 h320', stroke: '#fbe4dd', 'stroke-width': 3, 'stroke-dasharray': '2 8', 'stroke-linecap': 'round' }),
    );
    Pet.SPECIES.forEach((species, i) => {
      const x = 32 + i * 68;
      const g = node(
        'g',
        {
          class: `egg-pick${picked === species ? ' is-picked' : ''}${picked && picked !== species ? ' is-dim' : ''}`,
          transform: `translate(${x} 180) scale(.68)`,
          role: 'button',
          tabindex: '0',
          'data-species': species,
          'aria-label': t(`pet.hint.${species}`),
        },
        `<g class="egg-lift">${eggMarkup(species)}</g>`,
      );
      g.addEventListener('pointerdown', () => pickEgg(species));
      g.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          pickEgg(species);
        }
      });
      stage.append(g);
    });
  }

  // ── Little effects ─────────────────────────────────────────────────────

  function hearts(n = 3, x = pos.x, y = pos.y - (isFish() ? 20 : 64)) {
    for (let i = 0; i < n; i += 1) {
      const g = node('g', { class: 'fx-heart', transform: `translate(${(x + rand(-16, 16)).toFixed(1)} ${(y + rand(-6, 6)).toFixed(1)})` });
      const h = node('path', { d: HEART, fill: pick(['#ff7f93', '#ff9fb0', '#f9667d']) });
      h.style.animationDelay = `${i * 140}ms`;
      g.append(h);
      layers.fx.append(g);
      setTimeout(() => g.remove(), 1700 + i * 140);
    }
  }

  function sparkles(x, y, n = 10) {
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * Math.PI * 2;
      const g = node('g', { class: 'fx-spark', transform: `translate(${x} ${y})` });
      const s = node('path', {
        d: 'M0 -5 L1.4 -1.4 L5 0 L1.4 1.4 L0 5 L-1.4 1.4 L-5 0 L-1.4 -1.4 Z',
        fill: pick(['#ffd34d', '#ffe9a1', '#ffb7c5', '#bfe6ff']),
      });
      s.style.setProperty('--dx', `${Math.cos(a) * rand(34, 52)}px`);
      s.style.setProperty('--dy', `${Math.sin(a) * rand(28, 44)}px`);
      g.append(s);
      layers.fx.append(g);
      setTimeout(() => g.remove(), 1300);
    }
  }

  function startZzz() {
    if (!running || mode !== 'sleep') return;
    const g = node('text', { class: 'fx-zzz', x: pos.x + 22, y: pos.y - (isFish() ? 20 : 60), 'font-size': 13 }, 'z');
    layers.fx.append(g);
    setTimeout(() => g.remove(), 2600);
    later(startZzz, 1300);
  }

  function bubbles() {
    for (let i = 0; i < 3; i += 1) {
      const c = node('circle', { class: 'fx-bubble', cx: pos.x - 18 + rand(-3, 3), cy: pos.y - 4, r: rand(2, 3.6), fill: 'none', stroke: '#fff', 'stroke-width': 1.4 });
      c.style.animationDelay = `${i * 260}ms`;
      layers.fx.append(c);
      setTimeout(() => c.remove(), 2400);
    }
  }

  let bubbleTimer = 0;
  function say(text, ms = 2200) {
    const b = els.bubble;
    if (!b) return;
    clearTimeout(bubbleTimer);
    b.innerHTML = text;
    const top = isFish() ? pos.y - 46 : pos.y - 96;
    b.style.left = `${(pos.x / 400) * 100}%`;
    b.style.top = `${(Math.max(8, top) / 300) * 100}%`;
    b.hidden = false;
    b.classList.remove('is-pop');
    void b.offsetWidth;
    b.classList.add('is-pop');
    bubbleTimer = setTimeout(() => {
      b.hidden = true;
    }, ms);
  }

  // ── Dragging: the furniture, and the pet ───────────────────────────────

  /** A pointer event, in the room's own 400 × 300 units. */
  function roomPoint(event) {
    const m = els.svg.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  }

  function beginDrag(event, what) {
    if (!running || busy || choosing || !pet.pet) return;
    drag = { ...what, start: roomPoint(event), moved: false, pointer: event.pointerId };
    try {
      els.svg.setPointerCapture(event.pointerId);
    } catch {
      /* an old browser: the drag still works while the pointer stays over the room */
    }
  }

  // Furniture is found by where the press landed; the pet has its own listener.
  els.svg.addEventListener('pointerdown', (event) => {
    if (drag) return;
    const el = event.target.closest ? event.target.closest('.room-item') : null;
    if (!el || !Pet.ITEM_RANGE[el.dataset.item]) return;
    beginDrag(event, { kind: 'item', id: el.dataset.item, el, from: Pet.itemAt(pet, el.dataset.item) });
  });

  els.svg.addEventListener('pointermove', (event) => {
    if (!drag || event.pointerId !== drag.pointer) return;
    const at = roomPoint(event);
    const dx = at.x - drag.start.x;
    const dy = at.y - drag.start.y;
    // A press that wanders a little is still a press.
    if (!drag.moved && Math.hypot(dx, dy) < 5) return;
    if (!drag.moved) {
      drag.moved = true;
      lastTouch = Date.now();
      if (els.bubble) els.bubble.hidden = true;
      if (drag.kind === 'pet') liftPet();
      else drag.el.classList.add('is-dragging');
    }
    event.preventDefault();
    if (drag.kind === 'item') {
      const to = Pet.moveItem(pet, drag.id, drag.from.x + dx, drag.from.y + dy);
      drag.el.setAttribute('transform', `translate(${to.x} ${to.y})`);
      // its light goes with the lamp
      if (drag.id === 'lamp') layers.room.querySelector('.lamp-glow.is-lit')?.parentNode.setAttribute('transform', `translate(${to.x} ${to.y})`);
    } else {
      // held by its middle, kept inside the room, never below the floor
      pos = {
        x: Math.min(372, Math.max(28, drag.from.x + dx)),
        y: Math.min(FLOOR_Y, Math.max(72, drag.from.y + dy)),
      };
      placePet();
    }
  });

  const endDrag = (event) => {
    if (!drag || (event && event.pointerId !== drag.pointer)) return;
    const done = drag;
    drag = null;
    try {
      els.svg.releasePointerCapture(done.pointer);
    } catch {
      /* nothing was captured */
    }
    if (done.kind === 'item') {
      done.el.classList.remove('is-dragging');
      if (done.moved) {
        pet.tips = { ...(pet.tips || {}), drag: true };
        save();
        paintFoot();
        admire(done.id);
      }
      return;
    }
    if (!done.moved) patPet();
    else dropPet();
  };
  els.svg.addEventListener('pointerup', endDrag);
  els.svg.addEventListener('pointercancel', endDrag);

  // Where each thing stands before it is dragged anywhere, for the pet to walk to.
  const ITEM_X = { lamp: 364, plant: 34, stand: 96, bed: 296, rug: 200, bowl: 126, window: 96, picture: 309 };

  /** Something has been moved: now and then the pet trots over to see, and approves. */
  function admire(id) {
    if (busy || held || mode === 'sleep' || isFish() || Math.random() < 0.4) return;
    const x = (ITEM_X[id] || 200) + Pet.itemAt(pet, id).x;
    const beside = Math.min(360, Math.max(40, x + (x > pos.x ? -36 : 36)));
    walkTo(beside, FLOOR_Y, () => {
      facing = x > pos.x ? 1 : -1;
      placePet();
      setMode('happy');
      hop();
      say(t('pet.say.nice'), 1900);
      later(() => mode === 'happy' && !held && setMode('idle'), 1400);
    }, 110);
  }

  /** Picked up: whatever it was doing stops, and it dangles, delighted. */
  function liftPet() {
    held = true;
    cancelAnimationFrame(raf);
    setMode('happy');
    layers.pet?.classList.add('is-held');
  }

  /** Let go: it drops to the floor, lands with a bounce — and if it lands in bed, stays there. */
  function dropPet() {
    held = false;
    layers.pet?.classList.remove('is-held');
    pet.tips = { ...(pet.tips || {}), drag: true };
    save();
    paintFoot();
    const from = pos.y;
    const fall = FLOOR_Y - from;
    const ms = 110 + 24 * Math.sqrt(Math.max(0, fall));
    const start = performance.now();
    const land = () => {
      if (!running) return;
      hop();
      const bed = bedAt();
      if (pet.placed.includes('bed') && Math.abs(pos.x - bed.x) < 34) {
        say(t('pet.say.cosy'), 1800);
        later(() => {
          if (held || busy) return;
          pos = { x: bed.x, y: bed.y };
          placePet();
          setMode('sleep');
        }, 1300);
        return;
      }
      hearts(2);
      say(t(pick(['pet.say.whee', 'pet.say.again', ...SOUNDS[pet.pet.species]])), 1800);
      later(() => mode === 'happy' && !held && setMode('idle'), 1400);
    };
    if (fall < 2) {
      land();
      return;
    }
    const step = (now) => {
      if (!running || held) return;
      const f = Math.min(1, (now - start) / ms);
      pos = { x: pos.x, y: from + fall * f * f }; // it falls faster as it goes
      placePet();
      if (f < 1) raf = requestAnimationFrame(step);
      else land();
    };
    raf = requestAnimationFrame(step);
  }

  /** The window follows the clock while the room is open — every five minutes is plenty. */
  function watchSky() {
    const step = Math.floor(timeNow() * 12);
    if (step !== skyStep && layers.room && !busy && !drag && !choosing && pet.pet) {
      skyStep = step;
      layers.room.innerHTML = roomArt();
    }
    later(watchSky, 30000);
  }

  // ── Behaviour ──────────────────────────────────────────────────────────

  function walkTo(x, y = pos.y, then = null, speed = 70) {
    if (held) return;
    cancelAnimationFrame(raf);
    const from = { ...pos };
    const dist = Math.hypot(x - from.x, y - from.y);
    if (dist < 2) {
      if (then) then();
      return;
    }
    // Drawn facing the viewer (the fish faces left): turn towards the way it goes.
    const goingRight = x > from.x;
    facing = isFish() ? (goingRight ? -1 : 1) : goingRight ? 1 : -1;
    if (mode !== 'sleep') setMode('walk');
    const ms = (dist / speed) * 1000;
    const start = performance.now();
    const step = (now) => {
      if (!running) return;
      const f = Math.min(1, (now - start) / ms);
      const e = f < 0.5 ? 2 * f * f : 1 - (-2 * f + 2) ** 2 / 2;
      pos = { x: from.x + (x - from.x) * e, y: from.y + (y - from.y) * e };
      placePet();
      if (f < 1) raf = requestAnimationFrame(step);
      else {
        setMode('idle');
        if (then) then();
      }
    };
    raf = requestAnimationFrame(step);
  }

  function wander() {
    if (!pet.pet || choosing) return;
    if (busy || held) {
      later(wander, 2000);
      return;
    }
    const quiet = Date.now() - lastTouch;
    const hour = timeNow();
    if (mode !== 'sleep' && (quiet > SLEEP_AFTER || ((hour >= 21 || hour < 6) && quiet > 15000))) {
      goToSleep();
    } else if (mode === 'idle') {
      const roll = Math.random();
      if (roll < 0.55) {
        if (isFish()) walkTo(rand(166, 234), rand(142, 190), null, 34);
        else walkTo(rand(70, 340), FLOOR_Y, null, 62);
      } else if (roll < 0.7 && Pet.wantsSnack(pet)) {
        say(`${t('pet.wish')} ${foodIcon(Pet.snackFor(pet.pet.species, 'treat').look)}`, 2600);
      } else if (roll < 0.8) {
        hop();
      } else if (roll < 0.88 && pet.pet.variant === 'rare') {
        // A rare one shimmers now and then, just a little.
        sparkles(pos.x, pos.y - (isFish() ? 10 : 36), 6);
      }
    }
    later(wander, rand(3200, 6500));
  }

  function hop() {
    if (!layers.pet) return;
    const root = layers.pet.querySelector('.pet');
    root.classList.remove('is-hop');
    void root.getBoundingClientRect();
    root.classList.add('is-hop');
    setTimeout(() => root.classList.remove('is-hop'), 700);
  }

  function goToSleep() {
    if (!isFish() && pet.placed.includes('bed')) {
      const bed = bedAt();
      walkTo(bed.x, bed.y, () => setMode('sleep'), 50);
    } else {
      setMode('sleep');
    }
  }

  function blinkLoop() {
    if (layers.pet && mode !== 'sleep' && mode !== 'happy') {
      const root = layers.pet.querySelector('.pet');
      root.classList.add('is-blink');
      setTimeout(() => root && root.classList.remove('is-blink'), 150);
    }
    later(blinkLoop, rand(2400, 5200));
  }

  function patPet() {
    if (!pet.pet || busy) return;
    lastTouch = Date.now();
    cancelAnimationFrame(raf);
    if (mode === 'sleep') {
      setMode('idle');
      say(t('pet.say.yawn'));
      return;
    }
    // A pet that knows tricks shows one off now and then when patted.
    const known = Pet.tricksOf(pet.pet);
    if (known.length && Math.random() < 0.45) {
      doTrick(pick(known));
      return;
    }
    setMode('happy');
    hop();
    hearts(3);
    if (isFish()) bubbles();
    say(t(pick(SOUNDS[pet.pet.species])));
    later(() => mode === 'happy' && setMode('idle'), 1500);
  }

  /** One trick: the whole pet moves (spin, jump, dance or roll), then hearts. */
  function doTrick(id, line = t('pet.trick.watch')) {
    if (!layers.pet) return;
    setMode('happy');
    const g = layers.pet;
    for (const tr of Pet.TRICKS) g.classList.remove(`trick-${tr}`);
    void g.getBoundingClientRect();
    g.classList.add(`trick-${id}`);
    say(line, 2000);
    setTimeout(() => {
      g.classList.remove(`trick-${id}`);
      if (!running) return;
      hearts(3);
      sparkles(pos.x, pos.y - (isFish() ? 10 : 36), 6);
      later(() => mode === 'happy' && setMode('idle'), 900);
    }, 1150);
  }

  function kickBall() {
    if (!ball || busy) return;
    lastTouch = Date.now();
    if (mode === 'sleep') setMode('idle');
    const to = ball.x > 200 ? rand(70, 170) : rand(230, 340);
    const from = ball.x;
    const start = performance.now();
    const ms = 900;
    const roll = (now) => {
      if (!running || !layers.ball) return;
      const f = Math.min(1, (now - start) / ms);
      const e = 1 - (1 - f) ** 3;
      ball.x = from + (to - from) * e;
      const bounce = Math.abs(Math.sin(f * Math.PI * 2)) * 10 * (1 - f);
      layers.ball.setAttribute('transform', `translate(${ball.x.toFixed(1)} ${(ball.y - bounce).toFixed(1)}) rotate(${((ball.x - from) * 4).toFixed(0)})`);
      if (f < 1) requestAnimationFrame(roll);
    };
    requestAnimationFrame(roll);
    // …and the pet runs after it, pleased.
    setTimeout(() => {
      if (!running) return;
      walkTo(to + (to > pos.x ? -24 : 24), FLOOR_Y, () => {
        setMode('happy');
        hop();
        hearts(2);
        later(() => mode === 'happy' && setMode('idle'), 1200);
      }, 120);
    }, 200);
  }

  function wobbleEgg(touched = false) {
    if (!layers.egg) return;
    const body = layers.egg.querySelector('.egg');
    body.classList.remove('is-wobble');
    void body.getBoundingClientRect();
    body.classList.add('is-wobble');
    if (touched) {
      hearts(1, 200, 196);
      say(t('pet.egg.warm', { n: pet.egg.warmth, total: Pet.HATCH_TAKES }), 1800);
    }
  }

  function scheduleEggWobble() {
    later(() => {
      wobbleEgg();
      if (pet.egg && !pet.pet) scheduleEggWobble();
    }, rand(2600, 5200) / (1 + (pet.egg ? pet.egg.warmth : 0) * 0.5));
  }

  // ── Eggs and hatching ──────────────────────────────────────────────────

  function pickEgg(species) {
    picked = species;
    drawRoom();
    paintPanel();
  }

  function confirmEgg() {
    if (!picked) return;
    if (choosing) Pet.chooseNextEgg(pet, picked);
    else Pet.chooseEgg(pet, picked);
    picked = null;
    choosing = false;
    tray = null;
    save();
    drawRoom();
    paintPanel();
    say(t('pet.egg.chosen'), 2600);
  }

  function runHatch() {
    busy = true;
    const species = pet.egg.species;
    els.panel.innerHTML = `<p class="pet-hatching">${t('pet.hatching')}</p>`;
    // Shake, shake harder, crack…
    const body = layers.egg && layers.egg.querySelector('.egg');
    if (body) body.classList.add('is-shake');
    later(() => {
      if (layers.egg) layers.egg.innerHTML = eggMarkup(species, 3);
      const b = layers.egg && layers.egg.querySelector('.egg');
      if (b) b.classList.add('is-shake', 'is-hard');
    }, 1300);
    // …pop!
    later(() => {
      Pet.hatch(pet);
      save();
      busy = false;
      pos = species === 'fish' ? { x: 200, y: 164 } : { x: 200, y: FLOOR_Y };
      mode = 'born';
      drawRoom();
      setMode('born');
      // The empty shell, flying apart, where the egg was.
      const shell = node('g', { class: 'shell', transform: 'translate(166 196) scale(.7)' }, eggHalves(species));
      layers.fx.append(shell);
      setTimeout(() => shell.remove(), 1400);
      sparkles(200, 222, 12);
      later(() => {
        hearts(4);
        hop();
        // A rare colour is never promised: this is the first anyone hears of it.
        const rare = pet.pet && pet.pet.variant === 'rare';
        if (rare) sparkles(pos.x, pos.y - 40, 16);
        say(t(rare ? 'pet.rare.say' : 'pet.born'), rare ? 3200 : 2600);
        setMode('idle');
        paintPanel();
      }, 900);
    }, 2500);
  }

  // ── Feeding and decorating ─────────────────────────────────────────────

  function feed(snackId) {
    if (busy || !pet.pet) return;
    const snack = Pet.feed(pet, snackId);
    if (!snack) return;
    save();
    paintNotes();
    paintPanel();
    busy = true;
    lastTouch = Date.now();
    if (mode === 'sleep') setMode('idle');

    if (isFish()) {
      const flakes = layers.room.querySelector('.bowl-flakes');
      flakes.innerHTML = `<g transform="translate(150 101) scale(.56)"><g class="flakes-fall">${foodMarkup(snack.look)}</g></g>`;
      walkTo(204, 138, () => eat(snack, flakes), 50);
      return;
    }
    const bowl = layers.room.querySelector('.bowl-food');
    // Sat on the bowl: the snack's box centres on (50, 56), drawn at half size.
    bowl.innerHTML = `<g class="food-in-bowl" transform="translate(101 226) scale(.5)">${foodMarkup(snack.look)}</g>`;
    // It eats from whichever side of the bowl there is room on.
    const at = bowlAt();
    const fromRight = at.x + 38 <= 372;
    walkTo(at.x + (fromRight ? 38 : -38), FLOOR_Y, () => {
      facing = fromRight ? -1 : 1;
      placePet();
      eat(snack, bowl);
    }, 90);
  }

  function eat(snack, holder) {
    setMode('eat');
    // The snack itself, inside the group that places it in the bowl.
    const food = holder.querySelector('.food');
    const bites = [0.75, 0.45, 0];
    bites.forEach((left, i) => {
      later(() => {
        if (food) food.style.transform = `scale(${left})`;
        if (food) food.style.opacity = left ? '1' : '0';
      }, 600 + i * 650);
    });
    later(() => {
      holder.innerHTML = '';
      busy = false;
      setMode('happy');
      hop();
      hearts(snack.favourite ? 5 : 3);
      if (snack.learned) {
        // A new trick, learned from its favourite snack: shown off at once.
        say(t('pet.trick.learned', { trick: t(`pet.trick.${snack.learned}`) }), 2400);
        later(() => doTrick(snack.learned, t('pet.trick.tada')), 2200);
        paintPanel();
        return;
      }
      if (snack.boostStarted) {
        sparkles(pos.x, pos.y - (isFish() ? 10 : 36), 10);
        say(t('pet.boost.say'), 2600);
      } else {
        say(t(snack.favourite ? 'pet.say.favourite' : 'pet.say.yum'));
      }
      later(() => mode === 'happy' && setMode('idle'), 1600);
    }, 600 + bites.length * 650);
  }

  function buyOrToggle(itemId) {
    if (pet.owned.includes(itemId)) Pet.place(pet, itemId);
    else if (!Pet.buy(pet, itemId)) return;
    save();
    drawRoom();
    paintNotes();
    paintPanel();
    if (Pet.isPlaced(pet, itemId) && pet.pet) {
      hearts(2);
      hop();
    }
  }

  // ── The panel under the room ───────────────────────────────────────────

  function paintNotes() {
    els.notes.innerHTML = `<span class="pet-notes-icon" aria-hidden="true">♪</span> ${pet.notes}`;
    els.notes.setAttribute('aria-label', t('pet.notes.aria', { n: pet.notes }));
  }

  function paintHead() {
    if (pet.pet && pet.pet.name) {
      els.title.textContent = pet.pet.name;
      els.lead.textContent = t('pet.lead.pet', { kind: t(`pet.kind.${pet.pet.species}`) });
    } else {
      els.title.textContent = t('pet.title');
      els.lead.textContent = pet.pet
        ? t('pet.lead.newborn')
        : pet.egg
          ? t('pet.lead.egg')
          : t('pet.lead.choose');
    }
  }

  function paintPanel() {
    paintHead();
    const p = els.panel;
    if (choosing) {
      p.innerHTML = `
        <p class="pet-prompt">${picked ? esc(t(`pet.hint.${picked}`)) : t('pet.next.ask', { name: esc(pet.pet.name) })}</p>
        <div class="pet-actions">
          <button class="primary-btn" type="button" data-act="egg" ${picked ? '' : 'disabled'}>${t('pet.choose.btn')}</button>
          <button class="quiet-btn" type="button" data-act="unchoose">${t('pet.next.cancel')}</button>
        </div>`;
    } else if (!pet.pet && !pet.egg) {
      p.innerHTML = `
        <p class="pet-prompt">${picked ? esc(t(`pet.hint.${picked}`)) : t('pet.choose')}</p>
        <div class="pet-actions">
          <button class="primary-btn" type="button" data-act="egg" ${picked ? '' : 'disabled'}>${t('pet.choose.btn')}</button>
        </div>`;
    } else if (pet.egg) {
      const w = pet.egg.warmth;
      const dots = Array.from({ length: Pet.HATCH_TAKES }, (_, i) => `<span class="warm-dot${i < w ? ' is-on' : ''}"></span>`).join('');
      p.innerHTML = `
        <div class="pet-warmth"><span class="warm-dots" aria-hidden="true">${dots}</span>
          <span>${t('pet.egg.warm', { n: w, total: Pet.HATCH_TAKES })}</span></div>
        <p class="pet-prompt">${t('pet.egg.howto')}</p>
        <div class="pet-actions"><button class="primary-btn" type="button" data-act="practise">${t('pet.practise')}</button></div>
        ${(pet.friends || []).length ? `<div class="pet-tabs"><button class="pet-tab" type="button" data-tray="pets" aria-selected="${tray === 'pets'}">${t('pet.tab.pets')}</button></div>${tray === 'pets' ? petsTray() : ''}` : ''}`;
    } else if (!pet.pet.name || renaming) {
      const names = NAMES[pet.pet.species] || NAMES.cat;
      const current = renaming ? pet.pet.name : '';
      p.innerHTML = `
        <form class="pet-name" data-act="name">
          <label class="pet-prompt" for="petNameInput">${t(renaming ? 'pet.rename.ask' : 'pet.name.ask')}</label>
          <div class="pet-name-row">
            <input id="petNameInput" maxlength="18" autocomplete="off" value="${esc(current)}" placeholder="${esc(names[0])}" />
            <button class="primary-btn" type="submit">${t('pet.name.ok')}</button>
          </div>
          <div class="chip-row">${names.map((n) => `<button class="chip" type="button" data-name="${esc(n)}">${esc(n)}</button>`).join('')}</div>
          ${renaming ? `<button class="link-btn" type="button" data-act="unrename">${t('pet.rename.cancel')}</button>` : ''}
        </form>`;
    } else {
      p.innerHTML = `
        ${growthRow()}
        ${wishRow()}
        ${planRow()}
        <div class="pet-tabs" role="tablist">
          <button class="pet-tab" type="button" role="tab" data-tray="feed" aria-selected="${tray === 'feed'}">${t('pet.feed')}</button>
          <button class="pet-tab" type="button" role="tab" data-tray="decorate" aria-selected="${tray === 'decorate'}">${t('pet.decorate')}</button>
          <button class="pet-tab" type="button" role="tab" data-tray="pets" aria-selected="${tray === 'pets'}">${t('pet.tab.pets')}</button>
          <button class="pet-tab" type="button" role="tab" data-tray="book" aria-selected="${tray === 'book'}">${t('pet.tab.book')}${
            Pet.bookSummary(pet).unseen && tray !== 'book' ? `<span class="pet-tab-dot" aria-label="${t('pet.book.new')}"></span>` : ''
          }</button>
        </div>
        ${tray === 'feed' ? feedTray() : ''}
        ${tray === 'decorate' ? decorTray() : ''}
        ${tray === 'pets' ? petsTray() : ''}
        ${tray === 'book' ? bookTray() : ''}`;
      // Opening the book is reading it: what was new is marked this once.
      if (tray === 'book' && Pet.bookSummary(pet).unseen) {
        Pet.bookSeen(pet);
        save();
      }
    }
    paintFoot();
  }

  /** The line under the room: how notes are earned, and — until it has been tried — that things can be moved. */
  function paintFoot() {
    const tip =
      pet.pet && pet.pet.name && !(pet.tips && pet.tips.drag) && !choosing
        ? `<span class="pet-tip">${t(isFish() ? 'pet.tip.dragFish' : 'pet.tip.drag', { name: esc(pet.pet.name) })}</span>`
        : '';
    els.foot.innerHTML = `${tip}${t('pet.foot')}${
      demo ? ` <button class="link-btn" type="button" data-act="demo">${t('pet.demo')}</button>` : ''
    }`;
  }

  /** The key the pet would like to hear today, in the room's own words. */
  function wishRow() {
    const w = pet.wish;
    if (!w || !pet.pet || !pet.pet.name) return '';
    const key = keyName(w.id);
    const name = esc(pet.pet.name);
    return `<p class="pet-keywish${w.done ? ' is-done' : ''}">${
      w.done ? t('pet.keywish.done', { key, name }) : t('pet.keywish.ask', { key, name })
    }</p>`;
  }

  /**
   * "When will I hear you next?" — asked, answered by the student, and then
   * simply remembered. Four moments that come round every day, because a plan
   * hung on something that already happens ("after dinner") is the kind that
   * gets kept; a time on a clock is the kind that gets missed.
   */
  function planRow() {
    if (!pet.pet || !pet.pet.name) return '';
    const name = esc(pet.pet.name);
    if (pet.plan) {
      return `<p class="pet-plan is-set">${t('pet.plan.set', { when: t(`pet.plan.when.${pet.plan.cue}`), name })}
        <button class="link-btn" type="button" data-act="replan">${t('pet.plan.change')}</button></p>`;
    }
    return `<div class="pet-plan">
        <span class="pet-plan-ask">${t('pet.plan.ask', { name })}</span>
        <span class="chip-row">${Pet.PLAN_CUES.map(
          (cue) => `<button class="chip" type="button" data-plan="${cue}">${t(`pet.plan.cue.${cue}`)}</button>`,
        ).join('')}</span>
      </div>`;
  }

  /** A key id as the book writes it: 'E♭ major', 'F♯ minor'. */
  function keyTitle(id) {
    const minor = /m$/.test(id);
    return t(minor ? 'pet.mem.minor' : 'pet.mem.major', { key: keyName(minor ? id.slice(0, -1) : id) });
  }

  /** One memory, in words. */
  function memoryText(entry) {
    switch (entry.kind) {
      case 'take':
        return t('pet.mem.take');
      case 'hatched':
        return t('pet.mem.hatched', { kind: t(`pet.kind.${entry.species}`) });
      case 'key':
        return t('pet.mem.key', { key: keyTitle(entry.key) });
      case 'allMajors':
        return t('pet.mem.allMajors');
      case 'twoOctaves':
        return t('pet.mem.twoOctaves');
      case 'sight':
        return t('pet.mem.sight');
      case 'sprint':
        return t('pet.mem.sprint');
      case 'trill':
        return t('pet.mem.trill');
      case 'takes':
        return t('pet.mem.takes', { n: entry.n });
      case 'days':
        return t('pet.mem.days', { n: entry.n });
      case 'grew':
        return t(entry.stage === 'grown' ? 'pet.mem.grew.grown' : 'pet.mem.grew.kid', {
          name: esc(entry.name || pet.pet?.name || ''),
        });
      default:
        return '';
    }
  }

  /** '2026-11-12' as a short date in the page's language. */
  function dayLabel(day) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day || '');
    if (!m) return '';
    const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    try {
      return date.toLocaleDateString(getLang() === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' });
    } catch {
      return day;
    }
  }

  /**
   * The memory book: how much practice there has been, which keys the pet has
   * heard, and every first, newest at the top. Nothing in it is a score, and the
   * keys not yet heard are drawn as empty places rather than as anything missed.
   */
  function bookTray() {
    const sum = Pet.bookSummary(pet);
    const name = esc(pet.pet.name);
    const entries = (pet.book?.entries || []).slice();
    const fresh = sum.unseen;
    const keys = Pet.WISH_KEYS.map(
      (id) => `<span class="mem-key${sum.keys.includes(id) ? ' is-heard' : ''}">${keyName(id)}</span>`,
    ).join('');
    const minors = sum.minors ? ` ${t(sum.minors === 1 ? 'pet.book.minor1' : 'pet.book.minors', { n: sum.minors })}` : '';
    const list = entries
      .map((entry, i) => ({ entry, isNew: i >= entries.length - fresh }))
      .reverse()
      .slice(0, 40)
      .map(({ entry, isNew }) => {
        const text = memoryText(entry);
        if (!text) return '';
        return `<li class="mem-row${isNew ? ' is-new' : ''}"><span class="mem-day">${esc(dayLabel(entry.day))}</span>
          <span class="mem-text">${text}</span>${isNew ? `<span class="mem-new">${t('pet.book.new')}</span>` : ''}</li>`;
      })
      .join('');
    return `<p class="pet-sub">${t(sum.days === 1 ? 'pet.book.day1' : 'pet.book.days', { n: sum.days })} · ${t(
      sum.takes === 1 ? 'pet.book.take1' : 'pet.book.takes',
      { n: sum.takes },
    )}</p>
      <p class="pet-sub mem-keys-head">${t('pet.book.keys', { name, n: sum.majors })}${minors}</p>
      <div class="mem-keys" aria-hidden="true">${keys}</div>
      ${list ? `<ul class="mem-list">${list}</ul>` : `<p class="pet-note">${t('pet.book.empty')}</p>`}`;
  }

  /** 'F#' as a musician writes it. */
  function keyName(id) {
    return String(id || '').replace('#', '♯').replace(/b$/, '♭');
  }

  /** Where the pet is in growing up, its name to change, and — once grown — the next egg. */
  function growthRow() {
    const a = pet.pet;
    const stage = Pet.stageOf(a);
    const left = Pet.growthToNext(a);
    const name = esc(a.name);
    let body;
    if (left) {
      const pct = Math.round((left.done / left.need) * 100);
      body = `<div class="grow-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${left.need}" aria-valuenow="${left.done}">
          <span class="grow-fill" style="width:${pct}%"></span></div>
        <span class="grow-text">${t(left.next === 'kid' ? 'pet.grow.toKid' : 'pet.grow.toGrown', { done: left.done, need: left.need, name })}</span>
        ${Pet.boostLeft(pet) ? `<span class="grow-boost">⚡ ${t('pet.boost.left', { n: Pet.boostLeft(pet), name })}</span>` : ''}`;
    } else if (Pet.canChooseNextEgg(pet)) {
      body = `<span class="grow-text is-grown">${t('pet.grown', { name })}</span>
        <button class="primary-btn small" type="button" data-act="choose-next">${t('pet.next.btn')}</button>`;
    } else {
      body = `<span class="grow-text is-grown">${t('pet.grown', { name })}</span>
        <span class="grow-text">${t('pet.next.wait')}</span>`;
    }
    return `<div class="pet-grow">
        <div class="grow-head"><span class="grow-stage is-${stage}">${t(`pet.stage.${stage}`)}</span>
          <button class="link-btn" type="button" data-act="rename">✎ ${t('pet.rename')}</button></div>
        ${body}
      </div>`;
  }

  /** Every pet the student has, and the pet book: who has been found so far. */
  function petsTray() {
    const yours = Pet.allPets(pet);
    const egg = Boolean(pet.egg);
    const list = yours
      .map((a, i) => {
        const here = i === 0 && Boolean(pet.pet);
        const index = pet.pet ? i - 1 : i;
        const action = here
          ? `<span class="tray-cost">${t('pet.here')}</span>`
          : egg
            ? `<span class="tray-cost">${t('pet.bring.egg')}</span>`
            : `<span class="tray-cost is-act">${t('pet.bring')}</span>`;
        return `<button class="tray-item pet-card${here ? ' is-out' : ''}${a.variant === 'rare' ? ' is-rare' : ''}" type="button" ${here || egg ? 'disabled' : `data-friend="${index}"`}>
          ${petIcon(a.species, '', a.variant)}
          <span class="tray-name">${esc(a.name || t(`pet.kind.${a.species}`))}</span>
          <span class="tray-stage">${t(`pet.stage.${Pet.stageOf(a)}`)}${Pet.tricksOf(a).length ? ` · ★ ${Pet.tricksOf(a).length}` : ''}</span>
          ${action}</button>`;
      })
      .join('');
    const { found, total } = Pet.dexCount(pet);
    const book = Pet.SPECIES.map((species) => {
      const e = (pet.dex || {})[species] || {};
      const plain = e.plain
        ? petIcon(species, t(`pet.kind.${species}`))
        : petSilhouette(species);
      const rare = e.rare
        ? petIcon(species, t('pet.rare.label'), 'rare')
        : `<span class="dex-mystery" aria-label="${t('pet.unknown')}">?</span>`;
      return `<div class="dex-card">
          <div class="dex-pair"><span class="dex-slot${e.plain ? ' is-found' : ''}">${plain}</span><span class="dex-slot is-rare-slot${e.rare ? ' is-found' : ''}">${rare}</span></div>
          <span class="tray-name${e.plain || e.rare ? ' is-kind' : ''}">${e.plain || e.rare ? t(`pet.kind.${species}`) : t('pet.unknown')}</span></div>`;
    }).join('');
    return `<p class="pet-sub">${t('pet.yours')}</p>
      <div class="pet-tray is-pets">${list}</div>
      <p class="pet-sub">${t('pet.book', { found, total })}</p>
      <div class="pet-dex">${book}</div>`;
  }

  function feedTray() {
    const species = pet.pet.species;
    return `${confirmRow('snack')}<div class="pet-tray">${Pet.SNACKS.map((s) => {
      const snack = Pet.snackFor(species, s.id);
      const can = pet.notes >= s.cost;
      const picked = pending?.kind === 'snack' && pending.id === s.id;
      return `<button class="tray-item${snack.favourite ? ' is-fav' : ''}${picked ? ' is-picked' : ''}" type="button" data-snack="${s.id}" ${can ? '' : 'disabled'} aria-pressed="${picked}">
        ${foodIcon(snack.look)}
        <span class="tray-name">${t(`pet.food.${snack.look}`)}${snack.favourite ? ` <span class="fav-star" aria-label="${t('pet.fav')}">★</span>` : ''}</span>
        <span class="tray-cost">♪ ${s.cost}${can ? '' : `<span class="tray-need">${t('pet.need', { n: s.cost - pet.notes })}</span>`}</span></button>`;
    }).join('')}</div>
    ${feedInfo()}
    <p class="pet-note">${t('pet.feed.note', { name: esc(pet.pet.name) })}</p>`;
  }

  /** What snacks do: today's growth boost, and how close the next trick is. */
  function feedInfo() {
    const a = pet.pet;
    const name = esc(a.name);
    const left = Pet.boostLeft(pet);
    const grown = Pet.stageOf(a) === 'grown';
    const boost = grown
      ? ''
      : a.fedDay === Pet.dayKeyOf()
        ? `<li>⚡ ${left ? t('pet.boost.left', { n: left, name }) : t('pet.boost.used', { name })}</li>`
        : `<li>⚡ ${t('pet.boost.offer', { n: Pet.FED_BOOST, name })}</li>`;
    const next = Pet.toNextTrick(a);
    const fav = t(`pet.food.${Pet.snackFor(a.species, 'treat').look}`);
    const trick = next
      ? `<li>★ ${t('pet.trick.progress', { done: next.done, need: next.need, fav, name })}</li>`
      : `<li>★ ${t('pet.trick.all', { name })}</li>`;
    return `<ul class="feed-info">${boost}${trick}</ul>`;
  }

  function decorTray() {
    return `${confirmRow('item')}<div class="pet-tray is-decor">${Pet.ITEMS.filter((i) => !(isFish() && i.id === 'bed') && !(isFish() && i.id === 'ball')).map((item) => {
      const owned = pet.owned.includes(item.id);
      const out = Pet.isPlaced(pet, item.id);
      const can = owned || pet.notes >= item.cost;
      const label = owned
        ? out
          ? t('pet.item.out')
          : t('pet.item.away')
        : `♪ ${item.cost}${can ? '' : `<span class="tray-need">${t('pet.need', { n: item.cost - pet.notes })}</span>`}`;
      const picked = pending?.kind === 'item' && pending.id === item.id;
      return `<button class="tray-item${out ? ' is-out' : ''}${picked ? ' is-picked' : ''}" type="button" data-item="${item.id}" ${can ? '' : 'disabled'} aria-pressed="${out || picked}">
        ${itemIcon(item.id)}
        <span class="tray-name">${t(`pet.item.${item.id}`)}</span>
        <span class="tray-cost">${label}</span></button>`;
    }).join('')}</div>`;
  }

  /** The question sits above the tray; on a short screen, bring it into view. */
  function showConfirm() {
    const row = els.panel.querySelector('.pet-confirm');
    if (!row) return;
    const box = row.getBoundingClientRect();
    if (box.top < 60 || box.bottom > window.innerHeight - 10) row.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  /** "Rug for ♪ 10?" — above the tray, once something is picked. */
  function confirmRow(kind) {
    if (!pending || pending.kind !== kind) return '';
    const name =
      kind === 'snack'
        ? t(`pet.food.${Pet.snackFor(pet.pet.species, pending.id).look}`)
        : t(`pet.item.${pending.id}`);
    const cost = kind === 'snack' ? Pet.SNACKS.find((x) => x.id === pending.id).cost : Pet.ITEMS.find((x) => x.id === pending.id).cost;
    return `<div class="pet-confirm" role="group">
      <span>${t(kind === 'snack' ? 'pet.confirm.snack' : 'pet.confirm.item', { name: esc(name), cost, left: pet.notes - cost })}</span>
      <span class="pet-confirm-btns">
        <button class="primary-btn small" type="button" data-act="confirm-buy">${t(kind === 'snack' ? 'pet.confirm.feed' : 'pet.confirm.buy')}</button>
        <button class="quiet-btn small" type="button" data-act="cancel-buy">${t('pet.confirm.cancel')}</button>
      </span></div>`;
  }

  els.panel.addEventListener('click', (event) => {
    const b = event.target.closest('button');
    if (!b) return;
    if (b.dataset.act === 'egg') confirmEgg();
    else if (b.dataset.act === 'practise') onPractise();
    else if (b.dataset.act === 'choose-next') {
      choosing = true;
      picked = null;
      drawRoom();
      paintPanel();
    } else if (b.dataset.act === 'unchoose') {
      choosing = false;
      picked = null;
      drawRoom();
      paintPanel();
    } else if (b.dataset.act === 'rename') {
      renaming = true;
      paintPanel();
      els.panel.querySelector('#petNameInput')?.select();
    } else if (b.dataset.act === 'unrename') {
      renaming = false;
      paintPanel();
    } else if (b.dataset.plan) {
      if (Pet.makePlan(pet, b.dataset.plan, localDayKey())) {
        save();
        paintPanel();
        hearts(3);
        say(t('pet.plan.thanks'), 2200);
      }
    } else if (b.dataset.act === 'replan') {
      Pet.clearPlan(pet);
      save();
      paintPanel();
    } else if (b.dataset.friend != null) switchPet(Number(b.dataset.friend));
    else if (b.dataset.name) {
      const input = els.panel.querySelector('#petNameInput');
      if (input) input.value = b.dataset.name;
    } else if (b.dataset.tray) {
      tray = tray === b.dataset.tray ? null : b.dataset.tray;
      pending = null;
      paintPanel();
    } else if (b.dataset.act === 'confirm-buy' && pending) {
      const { kind, id } = pending;
      pending = null;
      if (kind === 'snack') feed(id);
      else buyOrToggle(id);
      paintPanel();
    } else if (b.dataset.act === 'cancel-buy') {
      pending = null;
      paintPanel();
    } else if (b.dataset.snack) {
      // tapping the picked one again lets it go
      pending = pending?.kind === 'snack' && pending.id === b.dataset.snack ? null : { kind: 'snack', id: b.dataset.snack };
      paintPanel();
      showConfirm();
    } else if (b.dataset.item) {
      // an item already bought is just put out or away — no money moves
      if (pet.owned.includes(b.dataset.item)) {
        pending = null;
        buyOrToggle(b.dataset.item);
      } else {
        pending = pending?.kind === 'item' && pending.id === b.dataset.item ? null : { kind: 'item', id: b.dataset.item };
        paintPanel();
        showConfirm();
      }
    }
  });

  els.panel.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = els.panel.querySelector('#petNameInput');
    const value = (input && input.value.trim()) || (input && input.placeholder) || '';
    if (Pet.name(pet, value)) {
      save();
      tray = renaming ? tray : 'feed';
      renaming = false;
      paintPanel();
      hearts(4);
      hop();
      say(t('pet.name.hello', { name: esc(pet.pet.name) }), 2600);
    }
  });

  els.foot.addEventListener('click', (event) => {
    if (event.target.closest('[data-act="demo"]')) {
      // For trying the room out without playing: the same as one counted take.
      earnTake({ kind: 'scale', id: `demo${Math.floor(Math.random() * 1000)}` });
      // A demo is for looking around: it is generous where practice is capped.
      pet.notes += 15;
      save();
      paintNotes();
      if (Pet.readyToHatch(pet)) runHatch();
      else if (pet.pet && Pet.stageOf(pet.pet) !== pet.pet.seen) {
        const grew = Pet.unseenGrowth(pet);
        save();
        drawRoom();
        paintPanel();
        celebrateGrowth(grew);
      } else {
        if (pet.egg) {
          drawRoom();
          wobbleEgg(true);
        }
        paintPanel();
      }
    }
  });

  // ── Switching and growing ──────────────────────────────────────────────

  function switchPet(index) {
    if (busy || !Pet.switchTo(pet, index)) return;
    save();
    mode = 'idle';
    pos = isFish() ? { x: 200, y: 164 } : { x: 210, y: FLOOR_Y };
    drawRoom();
    paintPanel();
    hearts(3);
    hop();
    say(t('pet.back', { name: esc(pet.pet.name) }), 2400);
  }

  /** A stage reached while the room was closed: shown once, the next time it opens. */
  function celebrateGrowth(stage) {
    busy = true;
    later(() => {
      sparkles(pos.x, pos.y - (isFish() ? 10 : 40), 16);
      hearts(5);
      hop();
      setMode('happy');
      say(t(stage === 'grown' ? 'pet.grew.grown' : 'pet.grew.kid'), 3000);
      later(() => {
        busy = false;
        setMode('idle');
      }, 1800);
    }, 600);
  }

  // ── Earning ────────────────────────────────────────────────────────────

  const localDayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  function earnTake({ kind = 'scale', id = '', dayKey = '', octaves = 1 } = {}) {
    pet = Pet.loadPet(profileId());
    const key = dayKey || localDayKey();
    const result = Pet.earn(pet, { kind, id, dayKey: key, octaves });
    save();
    if (running) paintNotes();
    return result;
  }

  /** A day of practice logged by hand — it counts for the pet too, once a day. */
  function earnPractice(dayKey = localDayKey()) {
    return earnTake({ kind: 'practice', dayKey });
  }

  /** A take kept to listen back to — a little, once a day. */
  function earnRecording(dayKey = localDayKey()) {
    return earnTake({ kind: 'recording', dayKey });
  }

  // ── Coming and going ───────────────────────────────────────────────────

  function open() {
    stop();
    pet = Pet.loadPet(profileId());
    // The day's wish is there before the first take, so the room can name it.
    if (Pet.ensureWish(pet, localDayKey())) save();
    running = true;
    pending = null;
    picked = null;
    choosing = false;
    renaming = false;
    tray = pet.pet && pet.pet.name ? tray || null : null;
    const { longAway } = Pet.visit(pet);
    save();
    paintNotes();
    drawRoom();
    paintPanel();
    if (pet.egg && Pet.readyToHatch(pet)) {
      later(runHatch, 700);
      return;
    }
    held = false;
    drag = null;
    if (pet.pet) {
      lastTouch = Date.now();
      blinkLoop();
      later(wander, 1800);
      later(watchSky, 30000);
      const grew = Pet.unseenGrowth(pet);
      // A plan that was kept is said once, and it outranks an ordinary welcome.
      const kept = pet.pet.name ? Pet.takeKept(pet) : null;
      if (kept) save();
      if (grew) {
        save();
        celebrateGrowth(grew);
      } else if (kept) {
        later(() => {
          walkTo(isFish() ? 200 : 210, pos.y, () => {
            setMode('happy');
            hop();
            hearts(5);
            say(t('pet.plan.kept'), 3200);
            later(() => setMode('idle'), 1800);
          }, 110);
        }, 500);
      } else if (longAway && pet.pet.name) {
        later(() => {
          walkTo(isFish() ? 200 : 210, pos.y, () => {
            setMode('happy');
            hop();
            hearts(5);
            say(t('pet.back', { name: esc(pet.pet.name) }), 2800);
            later(() => setMode('idle'), 1600);
          }, 110);
        }, 500);
      }
    }
  }

  function stop() {
    running = false;
    busy = false;
    timers.forEach(clearTimeout);
    timers = [];
    cancelAnimationFrame(raf);
    if (els.bubble) els.bubble.hidden = true;
  }

  /**
   * One short line for the menu tile: how far the pet is from its next stage.
   * The finish line is visible before the room is opened, which is what makes the
   * next step feel close (and what a goal without a visible finish line lacks).
   */
  function progressLine() {
    const me = Pet.loadPet(profileId());
    if (me.egg) return t('pet.menu.egg', { n: Math.max(0, Pet.HATCH_TAKES - me.egg.warmth) });
    if (!me.pet) return '';
    if (!me.pet.name) return t('pet.menu.hatch');
    const left = Pet.growthToNext(me.pet);
    if (!left) return t('pet.menu.grown');
    return t('pet.menu.grow', { done: left.done, need: left.need });
  }

  return {
    open,
    stop,
    earnTake,
    earnPractice,
    earnRecording,
    progressLine,
    /** The pet's portrait (or its egg), for the toast. */
    portrait() {
      const p = Pet.loadPet(profileId());
      if (p.pet) return petIcon(p.pet.species, '', p.pet.variant);
      if (p.egg) return `<svg class="pet-icon" viewBox="14 18 72 82" aria-hidden="true">${eggMarkup(p.egg.species, Math.min(3, p.egg.warmth))}</svg>`;
      return '';
    },
    name() {
      const p = Pet.loadPet(profileId());
      return p.pet && p.pet.name ? p.pet.name : '';
    },
  };
}
