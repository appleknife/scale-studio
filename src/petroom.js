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

import * as Pet from './pet.js?v=202611251900';
import { currentSeason } from './season.js?v=202611251900';
import { avatarMarkup, avatarItemIcon, avatarPortrait, skinFill, hairFill } from './avatarart.js?v=202611251900';
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
  lookOf,
  STAGE_SCALE,
  HEART,
} from './petart.js?v=202611251900';
import { t, getLang } from './i18n.js?v=202611251900';

const NS = 'http://www.w3.org/2000/svg';
const FLOOR_Y = 268; // where feet stand
const PET_SCALE = 0.8; // the 100-unit pet box, in room units
const AV_SCALE = 0.68; // the avatar's 100 × 130 box, in room units
// How long each of the avatar's moves runs, in ms (the CSS animations' lengths).
const MOVE_MS = { wave: 1900, jump: 1300, bow: 1700, spin: 1300, dance: 2600, violin: 3400, clap: 1800, hop: 1500, cheer: 1600, wiggle: 2200, conduct: 3200 };
const FISH_SCALE = 0.62;
const BOWL = { x: 126, y: 262 }; // the food bowl, for the land pets
const BED = { x: 296, y: 266 };
const SLEEP_AFTER = 55000; // a quiet spell long enough for a nap

// Tops a pet can sit on, in the drawing's own units (before the piece is
// dragged anywhere): the left and right ends of the surface, and its height.
const PERCH = {
  bookshelf: { x0: 220, x1: 258, y: 134 },
  piano: { x0: 150, x1: 206, y: 148 },
  toybox: { x0: 330, x1: 370, y: 263 },
  beanbag: { x0: 46, x1: 74, y: 253 },
};
// Places to hide in hide and seek: where the pet's feet go (just behind the
// piece, so it is drawn behind it), whether it has to crouch to fit, and how
// far it leans out when it peeks. The piano's legs leave its feet showing and
// the beanbag its ears — a hint, the way a real hider gives themselves away.
// (The plant was tried: its pot is too thin to hide anything.)
const HIDE = {
  bookshelf: { x: 239, y: 220, crouch: false, peek: 26 },
  piano: { x: 178, y: 219, crouch: false, peek: 36 },
  beanbag: { x: 60, y: 282, crouch: true, peek: 30 },
  toybox: { x: 350, y: 289, crouch: true, peek: 28 },
  bed: { x: 296, y: 258, crouch: true, peek: 40 },
};

const SOUNDS = {
  dog: ['pet.say.dog1', 'pet.say.dog2'],
  cat: ['pet.say.cat1', 'pet.say.cat2'],
  hamster: ['pet.say.hamster1', 'pet.say.hamster2'],
  chicken: ['pet.say.chicken1', 'pet.say.chicken2'],
  hen: ['pet.say.hen1', 'pet.say.hen2'], // the chick, grown up, has found her cluck
  fish: ['pet.say.fish1', 'pet.say.fish2'],
  rabbit: ['pet.say.rabbit1', 'pet.say.rabbit2'],
  koala: ['pet.say.koala1', 'pet.say.koala2'],
  penguin: ['pet.say.penguin1', 'pet.say.penguin2'],
  fox: ['pet.say.fox1', 'pet.say.fox2'],
};

const NAMES = {
  dog: ['Biscuit', 'Mozzie', 'Waffles', 'Haydn'],
  cat: ['Mochi', 'Clara', 'Pudding', 'Chopin'],
  hamster: ['Peanut', 'Nibbles', 'Bachy', 'Dumpling'],
  chicken: ['Sunny', 'Peep', 'Nugget', 'Vivaldi'],
  fish: ['Bubbles', 'Coral', 'Fin', 'Elgar'],
  rabbit: ['Clover', 'Hops', 'Thumper', 'Brahms'],
  koala: ['Gumnut', 'Snooze', 'Pebble', 'Dvořák'],
  penguin: ['Waddle', 'Pip', 'Snowy', 'Grieg'],
  fox: ['Maple', 'Ember', 'Rusty', 'Paganini'],
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
  let ballRaf = 0;
  let queuedReaction = false;
  let hungry = false;
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
  let perch = null; // the furniture the pet is sitting on top of, if any
  let seek = null; // a game of hide and seek: { spot, tries, misses }

  // The time the room goes by: the clock, or `?hour=21` to see the evening at noon.
  /** What to call an animal: a chick that has grown up is a hen. */
  const kindOf = (a) => t(`pet.kind.${lookOf(a.species, Pet.stageOf(a))}`);
  const timeNow = () => (Number.isFinite(hour) ? hour : clockNow());
  const season = currentSeason(); // what the shop has on its shelves just now
  // The bowl and the bed are wherever they have been dragged to.
  const bowlAt = () => ({ x: BOWL.x + Pet.itemAt(pet, 'bowl').x, y: BOWL.y + Pet.itemAt(pet, 'bowl').y });
  const bedAt = () => ({ x: BED.x + Pet.itemAt(pet, 'bed').x, y: BED.y + Pet.itemAt(pet, 'bed').y });
  // A decoration picked in the shop is tried out in the room before it is
  // bought: it stands where it would go (a wallpaper or a floor replaces the
  // one there) until it is bought, let go, or another one is picked.
  const previewItem = () => (pending?.kind === 'item' && !pet.owned.includes(pending.id) ? Pet.ITEMS.find((i) => i.id === pending.id) : null);
  const roomArt = () => {
    const look = previewItem();
    const slot = look?.slot;
    return roomMarkup({
      placed: look && slot !== 'wall' && slot !== 'floor' ? [...pet.placed.filter((id) => id !== look.id), look.id] : pet.placed,
      wall: slot === 'wall' ? look.id : pet.wall,
      floor: slot === 'floor' ? look.id : pet.floor,
      season,
      fish: isFish(),
      hour: timeNow(),
      where: pet.where,
    });
  };
  /** Repaints the room's furniture — with the item being tried out, if any. */
  function paintFurniture() {
    if (!layers.room) return;
    layers.room.innerHTML = roomArt();
    const look = previewItem();
    if (look && look.slot !== 'wall' && look.slot !== 'floor') {
      layers.room.querySelector(`.room-item[data-item="${look.id}"]`)?.classList.add('is-preview');
    }
  }

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
  // Hunger is a look, not a mode: it must not stop the pet wandering or being
  // patted the way a real mode change would.
  const setHungry = (on) => {
    hungry = on;
    layers.pet?.querySelector('.pet')?.classList.toggle('is-hungry', on);
  };

  // ── Drawing ────────────────────────────────────────────────────────────

  function drawRoom(keepActors = false) {
    const svg = els.svg;
    if (!keepActors) {
      svg.innerHTML = '';
      // Everything that was drawn is gone with the old picture. A layer left over
      // here is a node that is no longer in the room: placing something "in front
      // of the pet" would be placing it in front of a pet that is not there.
      for (const key of Object.keys(layers)) layers[key] = null;
      layers.room = node('g', { class: 'room-base' }, roomArt());
      if (previewItem()) queueMicrotask(paintFurniture);
      skyStep = Math.floor(timeNow() * 12);
      layers.stage = node('g', { class: 'room-stage' });
      layers.fx = node('g', { class: 'room-fx', 'pointer-events': 'none' });
      svg.append(layers.room, layers.stage, layers.fx);
    } else {
      // Only the scenery changed. Keep the actors: rebuilding the whole SVG used
      // to restart every breathing, tail and blink loop, and delete live effects.
      layers.room.innerHTML = roomArt();
      if (previewItem()) queueMicrotask(paintFurniture);
      skyStep = Math.floor(timeNow() * 12);
      // The piece it was sitting on has been put away: down it comes.
      if (perch && !pet.placed.includes(perch)) {
        perch = null;
        if (!held) dropPet();
      }
      // A ball may have been bought or put away while the scenery was replaced.
      const wantsBall = pet.pet && !choosing && pet.placed.includes('ball') && !isFish();
      if (wantsBall && !layers.ball) {
        ball = ball || { x: 250, y: FLOOR_Y - 8 };
        layers.ball = node('g', { class: 'ball-pos', transform: `translate(${ball.x} ${ball.y})` }, ballMarkup());
        layers.ball.addEventListener('pointerdown', kickBall);
        layers.stage.append(layers.ball);
      } else if (!wantsBall && layers.ball) {
        layers.ball.remove();
        layers.ball = null;
        ball = null;
      }
      return;
    }

    if (pet.pet && !choosing) {
      if (pet.placed.includes('ball') && !isFish()) {
        ball = ball || { x: 250, y: FLOOR_Y - 8 };
        layers.ball = node('g', { class: 'ball-pos', transform: `translate(${ball.x} ${ball.y})` }, ballMarkup());
        layers.ball.addEventListener('pointerdown', kickBall);
        layers.stage.append(layers.ball);
      } else {
        ball = null;
      }
      drawAvatar();
      // A soft shadow that stays on the floor: it shrinks and fades when the
      // pet hops or is carried, which is what makes either read as a lift.
      layers.shade = isFish() ? null : node('ellipse', { class: 'pet-shade', cx: 0, cy: 0, rx: 22, ry: 4.6 });
      if (layers.shade) layers.stage.append(layers.shade);
      layers.petPos = node('g', { class: 'pet-pos' });
      layers.petFlip = node('g', { class: 'pet-flip' });
      // The inner scale group is free for the growth pulse: the outer groups
      // carry position and facing and must not be overwritten by a keyframe.
      layers.pet = node('g', { class: 'pet-hit', role: 'button', tabindex: '0', 'aria-label': t('pet.aria.pat', { name: kindOf(pet.pet) }) }, `<g class="pet-scale">${petMarkup(pet.pet.species, pet.pet.variant, Pet.stageOf(pet.pet))}</g>`);
      layers.petFlip.append(layers.pet);
      layers.petPos.append(layers.petFlip);
      layers.stage.append(layers.petPos);
      // A press on the pet is a pat if it is let go, and a lift if it is carried.
      layers.pet.addEventListener('pointerdown', (event) => {
        if (seek) {
          event.stopPropagation();
          if (seek.hidden) reveal('found');
          return;
        }
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
      else if (perch && pet.placed.includes(perch)) pos = { x: pos.x, y: perchTop(perch).y };
      else if (pos.y !== FLOOR_Y) {
        perch = null;
        pos = { x: 210, y: FLOOR_Y };
      }
      placePet();
      setMode(mode === 'sleep' ? 'sleep' : 'idle');
      setHungry(hungry);
    } else {
      drawEggs();
    }
  }

  // ── The avatar in the room ─────────────────────────────────────────────

  /** Puts the student's figure in the room (or takes it out), behind the pet. */
  /**
   * Something picked in the "Me" shop but not bought is tried on: the figure in
   * the panel and the one in the room wear it until it is bought, put back, or
   * another thing is picked. (A move is tried by doing it.)
   */
  const tryingOn = () => {
    if (pending?.kind !== 'avatar' || Pet.avatarOwns(pet, pending.id)) return null;
    return Pet.AVATAR_ITEMS.find((i) => i.id === pending.id) || null;
  };
  const tryWear = () => {
    const item = tryingOn();
    if (!item || item.slot === 'move') return {};
    const wear = { [item.slot]: item.id };
    if (item.slot === 'hair') wear.hat = null;
    return wear;
  };

  function drawAvatar() {
    layers.av?.remove();
    layers.av = null;
    stopAvatarWalk();
    if (!pet.avatar.in || !pet.pet || choosing) return;
    layers.av = node(
      'g',
      { class: 'av-pos', role: 'button', tabindex: '0', 'aria-label': t('av.aria') },
      avatarMarkup(pet.avatar, { wear: tryWear() }),
    );
    placeAvatar();
    // before the pet, so the pet walks in front of it — if the pet is in this
    // picture yet (when the whole room is redrawn, the avatar is drawn first)
    if (layers.petPos && layers.petPos.parentNode === layers.stage) layers.stage.insertBefore(layers.av, layers.petPos);
    else layers.stage.append(layers.av);
    layers.av.addEventListener('pointerdown', (event) => {
      if (busy) return;
      event.stopPropagation(); // not the furniture underneath
      stopAvatarWalk();
      beginDrag(event, { kind: 'avatar', el: layers.av, from: { x: pet.avatar.x } });
    });
    layers.av.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        doMove();
      }
    });
  }

  function placeAvatar(x = pet.avatar.x) {
    if (!layers.av) return;
    // the box's feet are at (50, 126); facing left, the figure is mirrored about them
    const y = (FLOOR_Y + 3 - 126 * AV_SCALE).toFixed(1);
    layers.av.setAttribute(
      'transform',
      avFacing === -1
        ? `translate(${(x + 50 * AV_SCALE).toFixed(1)} ${y}) scale(${-AV_SCALE} ${AV_SCALE})`
        : `translate(${(x - 50 * AV_SCALE).toFixed(1)} ${y}) scale(${AV_SCALE})`,
    );
  }

  // ── The avatar about the room ─────────────────────────────────────────
  //
  // Left alone, the student's figure potters about: strolls along the floor
  // with a little bob, turns to look at the pet, hops for no reason, and now and
  // then shows off its move. Picking it up (or anything happening to it) stops
  // the stroll where it is.

  let avFacing = 1;
  let avRaf = 0;
  let avWalking = false;
  const AV_SPEED = 46; // room units a second: an easy stroll

  function stopAvatarWalk() {
    cancelAnimationFrame(avRaf);
    avRaf = 0;
    if (avWalking) {
      avWalking = false;
      layers.av?.querySelector('.av')?.classList.remove('is-walk');
      Pet.setAvatar(pet, { x: pet.avatar.x });
      save();
    }
  }

  function avatarWalkTo(to, then) {
    if (!layers.av) return;
    const from = pet.avatar.x;
    const dist = Math.abs(to - from);
    if (dist < 4) return then?.();
    avFacing = to > from ? 1 : -1;
    const fig = layers.av.querySelector('.av');
    fig?.classList.add('is-walk');
    avWalking = true;
    const start = performance.now();
    const ms = (dist / AV_SPEED) * 1000;
    const step = (now) => {
      if (!layers.av || drag?.kind === 'avatar') return;
      const k = Math.min(1, (now - start) / ms);
      // ease in and out, so it sets off and stops like someone walking
      const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      pet.avatar.x = from + (to - from) * e;
      placeAvatar();
      if (k < 1) {
        avRaf = requestAnimationFrame(step);
        return;
      }
      avRaf = 0;
      fig?.classList.remove('is-walk');
      avWalking = false;
      Pet.setAvatar(pet, { x: pet.avatar.x });
      save();
      then?.();
    };
    avRaf = requestAnimationFrame(step);
  }

  /** A little hop on the spot. */
  function avatarSkip() {
    const fig = layers.av?.querySelector('.av');
    if (!fig) return;
    fig.classList.remove('is-skip');
    void fig.getBoundingClientRect();
    fig.classList.add('is-skip');
    later(() => fig.classList.remove('is-skip'), 650);
  }

  function avatarWander() {
    if (!pet.pet) return;
    const free = layers.av && !avWalking && drag?.kind !== 'avatar' && !choosing && !document.hidden;
    const moving = layers.av?.querySelector('.av')?.className.baseVal.match(/is-(wave|jump|bow|spin|dance|violin|clap|hop|cheer|wiggle|conduct)\b/);
    if (free && !moving) {
      const roll = Math.random();
      const [lo, hi] = Pet.AVATAR_X;
      if (roll < 0.5) {
        // a stroll somewhere else on the floor, sometimes with a hop at the end
        let to = pet.avatar.x + (Math.random() < 0.5 ? -1 : 1) * rand(40, 150);
        if (to < lo || to > hi) to = pet.avatar.x - (to - pet.avatar.x);
        to = Math.max(lo, Math.min(hi, to));
        avatarWalkTo(to, () => Math.random() < 0.3 && avatarSkip());
      } else if (roll < 0.68) {
        avatarSkip();
        if (Math.random() < 0.4) later(avatarSkip, 520);
      } else if (roll < 0.84 && !isFish()) {
        // turns to look at the pet
        const want = pos.x > pet.avatar.x ? 1 : -1;
        if (want !== avFacing) {
          avFacing = want;
          placeAvatar();
        }
      } else if (roll < 0.92) {
        doMove();
      }
    }
    later(avatarWander, rand(3800, 8000));
  }

  /** Runs a move on a drawn figure: the class goes on, and comes off when it is over. */
  function runMove(root, move) {
    if (!root) return 0;
    const name = String(move || 'move-wave').replace('move-', '');
    for (const m of Object.keys(MOVE_MS)) root.classList.remove(`is-${m}`);
    void root.getBoundingClientRect();
    root.classList.add(`is-${name}`);
    // The stylesheet owns the timing; reading it back means a CSS tweak cannot
    // silently desync the class removal. MOVE_MS is only the fallback.
    const raw = (getComputedStyle(root).animationDuration || '').split(',')[0].trim();
    const parsed = raw.endsWith('ms') ? parseFloat(raw) : parseFloat(raw) * 1000;
    const ms = Number.isFinite(parsed) && parsed > 0 ? parsed : MOVE_MS[name] || 1800;
    later(() => root.classList.remove(`is-${name}`), ms);
    return ms;
  }

  /** The reaction itself: turn toward the avatar, then a small celebration. */
  function playMoveReaction() {
    if (busy || held || mode !== 'idle') return;
    if (!isFish()) {
      facing = pet.avatar.x > pos.x ? 1 : -1;
      placePet();
    }
    setMode('happy');
    hop();
    hearts(2);
    later(() => mode === 'happy' && !held && setMode('idle'), 1300);
  }

  /** The avatar does its move; if the pet is busy, keep the reaction for later. */
  function doMove() {
    const ms = runMove(layers.av?.querySelector('.av'), pet.avatar.wear.move);
    if (!ms) return;
    lastTouch = Date.now();
    if (busy || held || mode === 'sleep' || mode === 'walk' || mode !== 'idle') {
      queuedReaction = true;
      return;
    }
    later(playMoveReaction, Math.min(900, ms / 2));
  }

  function placePet() {
    if (!layers.petPos) return;
    // Smaller while it is young; the feet (or the fish's middle) stay put.
    const s = (isFish() ? FISH_SCALE : PET_SCALE) * (STAGE_SCALE[Pet.stageOf(pet.pet)] || 1);
    // The box's feet are at (50, 96); the fish's middle at (50, 50).
    const ax = 50 * s;
    const ay = (isFish() ? 50 : 96) * s;
    layers.petPos.setAttribute('transform', `translate(${(pos.x - ax).toFixed(1)} ${(pos.y - ay).toFixed(1)}) scale(${s})`);
    const wanted = facing === -1 ? 'translate(100 0) scale(-1 1)' : '';
    const current = layers.petFlip.getAttribute('transform') || '';
    if (wanted !== current && !layers.petFlip.classList.contains('is-turning')) {
      // A thin squash hides the mirrored flip; without it a mid-wander turn
      // reads as a jump cut.
      layers.petFlip.classList.add('is-turning');
      later(() => layers.petFlip?.setAttribute('transform', wanted), 90);
      later(() => layers.petFlip?.classList.remove('is-turning'), 210);
    } else if (wanted !== current) {
      layers.petFlip.setAttribute('transform', wanted);
    }
    if (layers.shade) {
      // on the floor under the pet, smaller the higher it is held
      const ground = perch ? perchTop(perch).y : Math.max(pos.y, FLOOR_Y);
      const lift = Math.min(1, Math.max(0, (ground - pos.y) / 160));
      const k = s / PET_SCALE;
      layers.shade.setAttribute('transform', `translate(${pos.x.toFixed(1)} ${(ground + 1).toFixed(1)}) scale(${(k * (1 - lift * 0.55)).toFixed(3)})`);
      layers.shade.style.opacity = String(0.9 - lift * 0.6);
    }
  }

  /**
   * Eyes towards a point in the room — a finger, a bird, a piano being played.
   * A little way only (a pupil's width), then back to the front after a while.
   */
  let lookTimer = 0;
  function lookAt(x, y, hold = 1400) {
    if (!layers.pet || mode === 'sleep') return;
    const s = (isFish() ? FISH_SCALE : PET_SCALE) * (STAGE_SCALE[Pet.stageOf(pet.pet)] || 1);
    const headY = pos.y - (isFish() ? 4 : 62) * s;
    const dx = x - pos.x;
    const dy = y - headY;
    const d = Math.hypot(dx, dy) || 1;
    const reach = Math.min(1, d / 60) * 1.9;
    const lx = ((dx / d) * reach * facing).toFixed(2);
    const ly = ((dy / d) * reach * 0.8).toFixed(2);
    layers.pet.querySelectorAll('.pet-look').forEach((g) => g.setAttribute('transform', `translate(${lx} ${ly})`));
    clearTimeout(lookTimer);
    lookTimer = setTimeout(() => {
      layers.pet?.querySelectorAll('.pet-look').forEach((g) => g.removeAttribute('transform'));
    }, hold);
  }

  function setMode(next) {
    mode = next;
    if (!layers.pet) return;
    const root = layers.pet.querySelector('.pet');
    if (!root) return;
    for (const m of ['idle', 'walk', 'eat', 'happy', 'sleep', 'born']) root.classList.toggle(`is-${m}`, m === next);
    if (next === 'sleep') startZzz();
    else if (layers.fx) layers.fx.querySelectorAll('.fx-zzz').forEach((n) => n.remove());
    // A move the pet was too busy to answer waits here instead of being lost.
    if (next === 'idle' && queuedReaction) {
      queuedReaction = false;
      later(playMoveReaction, 120);
    }
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
    // The eggs to choose from: five on a long cushion at the front, the rest on
    // a shelf behind them.
    const FRONT = 5;
    const back = Math.max(0, Pet.SPECIES.length - FRONT);
    const backLeft = 200 - (back * 68) / 2;
    if (back) {
      stage.append(
        node('rect', { x: backLeft - 12, y: 158, width: back * 68 + 24, height: 12, rx: 5, fill: '#d9a979', stroke: '#a9774c', 'stroke-width': 2 }),
        node('path', { d: `M${backLeft + 6} 170 v10 M${backLeft + back * 68 - 6} 170 v10`, stroke: '#a9774c', 'stroke-width': 4, 'stroke-linecap': 'round' }),
      );
    }
    stage.append(
      node('rect', { x: 26, y: 246, width: 348, height: 26, rx: 13, fill: '#f6cfc4', stroke: '#e0a99b', 'stroke-width': 2 }),
      node('path', { d: 'M40 259 h320', stroke: '#fbe4dd', 'stroke-width': 3, 'stroke-dasharray': '2 8', 'stroke-linecap': 'round' }),
    );
    // back row first, so the front eggs are drawn over the shelf's edge
    const inOrder = [...Pet.SPECIES.slice(FRONT), ...Pet.SPECIES.slice(0, FRONT)];
    inOrder.forEach((species) => {
      const i = Pet.SPECIES.indexOf(species);
      const front = i < FRONT;
      const x = front ? 32 + i * 68 : backLeft + (i - FRONT) * 68;
      const y = front ? 180 : 93;
      const g = node(
        'g',
        {
          class: `egg-pick${picked === species ? ' is-picked' : ''}${picked && picked !== species ? ' is-dim' : ''}`,
          transform: `translate(${x} ${y}) scale(.68)`,
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
      later(() => g.remove(), 1700 + i * 140);
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
      later(() => g.remove(), 1300);
    }
  }

  function startZzz() {
    if (!running || mode !== 'sleep') return;
    const g = node('text', { class: 'fx-zzz', x: pos.x + 22, y: pos.y - (isFish() ? 20 : 60), 'font-size': 13 }, 'z');
    layers.fx.append(g);
    later(() => g.remove(), 2600);
    later(startZzz, 1300);
  }

  function bubbles() {
    for (let i = 0; i < 3; i += 1) {
      const c = node('circle', { class: 'fx-bubble', cx: pos.x - 18 + rand(-3, 3), cy: pos.y - 4, r: rand(2, 3.6), fill: 'none', stroke: '#fff', 'stroke-width': 1.4 });
      c.style.animationDelay = `${i * 260}ms`;
      layers.fx.append(c);
      later(() => c.remove(), 2400);
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
    bubbleTimer = later(() => {
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
    // Hiding: a tap on a piece of furniture is a guess, never a drag.
    if (seek) {
      if (seek.hidden && el) guess(el);
      return;
    }
    if (!el || !Pet.ITEM_RANGE[el.dataset.item]) return;
    beginDrag(event, { kind: 'item', id: el.dataset.item, el, from: Pet.itemAt(pet, el.dataset.item), petFrom: { ...pos } });
  });

  els.play?.addEventListener('click', () => {
    if (seek) {
      if (seek.hidden) reveal('giveup');
      return;
    }
    startSeek();
  });

  // The pet watches a finger (or the mouse) moving about the room.
  let lastLook = 0;
  els.svg.addEventListener('pointermove', (event) => {
    if (drag || !pet.pet || choosing) return;
    const now = performance.now();
    if (now - lastLook < 60) return;
    lastLook = now;
    const at = roomPoint(event);
    lookAt(at.x, at.y, 1200);
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
    if (drag.kind === 'avatar') {
      // along the floor only: it walks, it does not fly
      drag.x = Math.min(Pet.AVATAR_X[1], Math.max(Pet.AVATAR_X[0], drag.from.x + dx));
      placeAvatar(drag.x);
    } else if (drag.kind === 'item') {
      const to = Pet.moveItem(pet, drag.id, drag.from.x + dx, drag.from.y + dy);
      drag.el.setAttribute('transform', `translate(${to.x} ${to.y})`);
      // a pet sitting on top rides along
      if (perch === drag.id && !held) {
        pos = { x: drag.petFrom.x + (to.x - drag.from.x), y: perchTop(perch).y };
        placePet();
      }
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
      if (!done.moved) useItem(done.id, done.el);
      if (done.moved) {
        pet.tips = { ...(pet.tips || {}), drag: true };
        save();
        // moved forward or back: the floor is drawn again in its new order
        if (Pet.ITEM_RANGE[done.id].y[0] !== Pet.ITEM_RANGE[done.id].y[1]) paintFurniture();
        paintFoot();
        admire(done.id);
      }
      return;
    }
    if (done.kind === 'avatar') {
      done.el.classList.remove('is-dragging');
      if (done.moved) {
        Pet.setAvatar(pet, { x: done.x });
        save();
      } else {
        doMove();
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

  // ── Things in the room that do something when tapped ──────────────────

  /** A tiny synth for the room's sounds (the piano, the metronome, the clock). */
  let sfx = null;
  function tone(freq, at, dur = 0.5, { type = 'triangle', vol = 0.22 } = {}) {
    try {
      sfx = sfx || new (window.AudioContext || window.webkitAudioContext)();
      if (sfx.state === 'suspended') sfx.resume().catch(() => {});
      const t0 = sfx.currentTime + at;
      const o = sfx.createOscillator();
      const g = sfx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(sfx.destination);
      o.start(t0);
      o.stop(t0 + dur + 0.05);
    } catch {
      /* no audio here — the room still moves */
    }
  }
  const NOTE_HZ = { C4: 261.6, D4: 293.7, E4: 329.6, F4: 349.2, G4: 392, A4: 440, B4: 493.9, C5: 523.3, D5: 587.3, E5: 659.3, G5: 784 };
  // Short tunes everyone knows, all old enough to belong to everyone.
  const TUNES = [
    ['C4', 'C4', 'G4', 'G4', 'A4', 'A4', 'G4'], // Twinkle, Twinkle
    ['E4', 'E4', 'F4', 'G4', 'G4', 'F4', 'E4', 'D4'], // Ode to Joy
    ['E4', 'D4', 'C4', 'D4', 'E4', 'E4', 'E4'], // Mary Had a Little Lamb
    ['C5', 'G4', 'E4', 'G4', 'C5', 'E5', 'D5', 'C5'], // a run up and down
  ];

  /** Where a thing in the room is drawn now, in room units. */
  function itemBox(el) {
    const b = el.getBBox();
    const at = Pet.itemAt(pet, el.dataset.item);
    return { x: b.x + at.x, y: b.y + at.y, w: b.width, h: b.height, cx: b.x + at.x + b.width / 2, cy: b.y + at.y + b.height / 2 };
  }

  /** Little notes rising out of something, as the hearts rise out of the pet. */
  function notesFrom(x, y, n = 4) {
    for (let i = 0; i < n; i += 1) {
      const g = node('g', { class: 'fx-heart fx-note', transform: `translate(${(x + rand(-18, 18)).toFixed(1)} ${(y + rand(-4, 4)).toFixed(1)})` });
      const s = node('text', { 'text-anchor': 'middle', fill: pick(['#6c5ce7', '#e17055', '#00a383', '#d63384']) });
      s.textContent = pick(['♪', '♫', '♩']);
      s.style.animationDelay = `${i * 260}ms`;
      g.append(s);
      layers.fx.append(g);
      later(() => g.remove(), 1800 + i * 260);
    }
  }

  /** A quick squash and spring, so everything answers a tap. */
  function boing(el, cls = 'is-poked', ms = 600) {
    const inner = el.querySelector(':scope > .room-poke') || el;
    inner.classList.remove(cls);
    void inner.getBoundingClientRect();
    inner.classList.add(cls);
    later(() => inner.classList.remove(cls), ms);
  }

  /** The pet goes over to something, if it is free to. */
  function goSee(box, then) {
    if (isFish() || busy || held || mode === 'sleep' || mode === 'eat') return false;
    const beside = Math.min(360, Math.max(40, box.cx + (box.cx > pos.x ? -box.w / 2 - 22 : box.w / 2 + 22)));
    walkTo(beside, FLOOR_Y, () => {
      facing = box.cx > pos.x ? 1 : -1;
      placePet();
      then?.();
    }, 110);
    return true;
  }

  function useItem(id, el) {
    if (!pet.pet || choosing) return;
    lastTouch = Date.now();
    const box = itemBox(el);
    lookAt(box.cx, box.cy, 1800);
    if (mode === 'sleep' && id !== 'bed') setMode('idle');
    switch (id) {
      case 'piano': {
        boing(el);
        const tune = pick(TUNES);
        tune.forEach((n, i) => tone(NOTE_HZ[n], i * 0.28, 0.7));
        notesFrom(box.cx, box.y + 4, Math.min(6, tune.length));
        // the pet comes over and enjoys the music
        goSee(box, () => {
          setMode('happy');
          hearts(2);
          say(t('pet.say.music'), 1800);
          later(() => mode === 'happy' && setMode('idle'), 1600);
        });
        break;
      }
      case 'metronome': {
        boing(el, 'is-fast', 2600);
        for (let i = 0; i < 6; i += 1) tone(i % 3 === 0 ? 1760 : 1320, i * 0.4, 0.06, { type: 'square', vol: 0.05 });
        break;
      }
      case 'clock':
        boing(el);
        tone(NOTE_HZ.G5, 0, 0.9, { type: 'sine', vol: 0.16 });
        tone(NOTE_HZ.E5, 0.45, 1.1, { type: 'sine', vol: 0.16 });
        say(t('pet.say.tick'), 1500);
        break;
      case 'beanbag':
        boing(el, 'is-squish', 700);
        // flops onto it
        if (!isFish() && !busy && !held && mode !== 'eat') {
          walkTo(box.cx, FLOOR_Y + Math.min(0, Pet.itemAt(pet, 'beanbag').y), () => {
            hop();
            setMode('happy');
            say(t('pet.say.comfy'), 1800);
            later(() => mode === 'happy' && setMode('idle'), 1500);
          }, 110);
        }
        break;
      case 'bed':
        boing(el, 'is-squish', 700);
        if (!isFish() && mode !== 'sleep' && !busy && !held) {
          say(t('pet.say.sleepy'), 1400);
          later(() => {
            const bed = bedAt();
            walkTo(bed.x, bed.y, () => setMode('sleep'), 60);
          }, 600);
        }
        break;
      case 'toybox': {
        boing(el);
        const toy = node('g', { class: 'fx-toy', transform: `translate(${box.cx.toFixed(1)} ${(box.y + 8).toFixed(1)})` });
        toy.innerHTML = pick([
          '<circle r="7" fill="#ffd166" stroke="#d9a62e" stroke-width="1.6"/><path d="M-7 0 h14" stroke="#e07a5f" stroke-width="2"/>',
          '<path d="M0 -8 L2.4 -2.4 L8 -2 L3.6 1.8 L5 7.6 L0 4.4 L-5 7.6 L-3.6 1.8 L-8 -2 L-2.4 -2.4 Z" fill="#fff1a8" stroke="#d9b02e" stroke-width="1.4"/>',
          '<rect x="-6" y="-6" width="12" height="12" rx="2" fill="#a6d8a9" stroke="#5e9e63" stroke-width="1.6"/><text y="4" text-anchor="middle" font-size="9" font-weight="700" fill="#2f5d34">A</text>',
        ]);
        layers.fx.append(toy);
        later(() => toy.remove(), 1300);
        goSee(box, () => {
          hop();
          later(hop, 350);
          setMode('happy');
          say(t('pet.say.toy'), 1600);
          later(() => mode === 'happy' && setMode('idle'), 1400);
        });
        break;
      }
      case 'window': {
        // a bird flies past outside, and the pet watches it go
        const bird = node('g', { class: 'fx-bird' });
        bird.innerHTML = '<path d="M-6 0 q3 -4 6 0 q3 -4 6 0" fill="none" stroke="#3d4a5c" stroke-width="1.8" stroke-linecap="round"/>';
        bird.setAttribute('transform', `translate(${(box.x + 10).toFixed(1)} ${(box.y + box.h * 0.35).toFixed(1)})`);
        bird.style.setProperty('--fly', `${Math.max(30, box.w - 20)}px`);
        layers.fx.append(bird);
        later(() => bird.remove(), 1700);
        for (let i = 0; i <= 4; i += 1) later(() => lookAt(box.x + 10 + ((box.w - 20) * i) / 4, box.y + box.h * 0.35, 500), i * 320);
        later(() => say(t('pet.say.bird'), 1500), 500);
        break;
      }
      case 'plant':
      case 'flowers':
      case 'xmas-tree':
        boing(el, 'is-sway', 1200);
        sparkles(box.cx, box.y + 10, 5);
        break;
      case 'lamp':
        boing(el);
        tone(2200, 0, 0.03, { type: 'square', vol: 0.04 });
        break;
      default:
        boing(el);
        sparkles(box.cx, box.cy, 4);
    }
  }

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
    perch = null;
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
    // Let go above a bookshelf, the piano, the toy box or the beanbag, it lands
    // on top and stays there; anywhere else it drops to the floor.
    const onto = isFish() ? null : perchUnder(pos.x, pos.y);
    const fall = (onto ? perchTop(onto).y : FLOOR_Y) - from;
    const ms = 110 + 24 * Math.sqrt(Math.max(0, fall));
    const start = performance.now();
    const land = () => {
      if (!running) return;
      const squash = layers.pet?.querySelector('.pet-scale');
      if (squash) {
        squash.classList.remove('is-landing');
        void squash.getBoundingClientRect();
        squash.classList.add('is-landing');
        later(() => squash.classList.remove('is-landing'), 430);
      }
      hop();
      if (onto) {
        perch = onto;
        placePet();
        hearts(2);
        say(t('pet.say.perch'), 1800);
        later(() => mode === 'happy' && !held && setMode('idle'), 1400);
        return;
      }
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
      say(t(pick(['pet.say.whee', 'pet.say.again', ...SOUNDS[lookOf(pet.pet.species, Pet.stageOf(pet.pet))]])), 1800);
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
      paintFurniture();
    }
    later(watchSky, 30000);
  }

  // ── Up on the furniture ───────────────────────────────────────────────

  /** The top of a piece of furniture, where it stands now. */
  function perchTop(id) {
    const p = PERCH[id];
    const o = Pet.itemAt(pet, id);
    return { x0: p.x0 + o.x, x1: p.x1 + o.x, y: p.y + o.y };
  }

  /** The furniture out in the room that can be sat on. */
  const perches = () => Object.keys(PERCH).filter((id) => pet.placed.includes(id));

  /** What a pet let go at (x, y) would land on: the first top below it, if any. */
  function perchUnder(x, y) {
    let best = null;
    for (const id of perches()) {
      const top = perchTop(id);
      if (x < top.x0 - 4 || x > top.x1 + 4 || y > top.y + 10) continue;
      if (!best || top.y < perchTop(best).y) best = id;
    }
    return best;
  }

  /** A jump in an arc, with a squash at each end — up onto something, or down. */
  function jumpTo(x, y, then = null) {
    if (held) return;
    cancelAnimationFrame(raf);
    const from = { ...pos };
    perch = null;
    facing = x >= from.x ? 1 : -1;
    // high enough to clear the edge of a top it is jumping onto
    const rise = 26 + Math.abs(from.y - y) * 0.32;
    const ms = 420 + Math.min(260, Math.abs(from.y - y) * 1.6);
    const start = performance.now();
    hop();
    setMode('happy');
    const step = (now) => {
      if (!running || held) return;
      const f = Math.min(1, (now - start) / ms);
      const arc = 4 * f * (1 - f); // 0 → 1 → 0
      pos = {
        x: from.x + (x - from.x) * f,
        y: from.y + (y - from.y) * f - arc * rise,
      };
      placePet();
      if (f < 1) raf = requestAnimationFrame(step);
      else {
        pos = { x, y };
        placePet();
        const squash = layers.pet?.querySelector('.pet-scale');
        if (squash) {
          squash.classList.remove('is-landing');
          void squash.getBoundingClientRect();
          squash.classList.add('is-landing');
          later(() => squash.classList.remove('is-landing'), 430);
        }
        setMode('idle');
        then?.();
      }
    };
    raf = requestAnimationFrame(step);
  }

  /** Climbs up onto a piece of furniture by itself: walks over, then a big jump. */
  function climb(id) {
    const top = perchTop(id);
    const mid = (top.x0 + top.x1) / 2;
    const side = pos.x < mid ? top.x0 - 18 : top.x1 + 18;
    walkTo(Math.min(372, Math.max(28, side)), FLOOR_Y, () => {
      if (busy || held || seek) return;
      jumpTo(mid, top.y, () => {
        perch = id;
        placePet();
        say(t('pet.say.perch'), 1700);
      });
    }, 80);
  }

  // ── Hide and seek ─────────────────────────────────────────────────────
  //
  // The room goes dark while it counts to three (eyes closed!), the pet slips
  // behind a piece of furniture, and the student taps where they think it is. A
  // wrong guess wobbles that piece; after two, the right one rustles. The pet
  // peeks out now and then, and gives up hiding after half a minute.

  const hideSpots = () => Object.keys(HIDE).filter((id) => pet.placed.includes(id));
  let lastSpot = null;

  function paintPlay() {
    const b = els.play;
    if (!b) return;
    const can = Boolean(pet.pet && pet.pet.name && !isFish() && !choosing && running);
    b.hidden = !can;
    b.textContent = seek ? t('pet.seek.giveup') : t('pet.seek.btn');
    b.classList.toggle('is-seeking', Boolean(seek));
  }

  function startSeek() {
    if (!pet.pet || isFish() || busy || held || choosing || seek) return;
    const spots = hideSpots();
    if (!spots.length) {
      say(t('pet.seek.nowhere'), 3600);
      return;
    }
    lastTouch = Date.now();
    cancelAnimationFrame(raf);
    perch = null;
    if (mode === 'sleep') setMode('idle');
    const choices = spots.length > 1 ? spots.filter((id) => id !== lastSpot) : spots;
    const spot = pick(choices);
    lastSpot = spot;
    busy = true;
    seek = { spot, tries: 0, misses: 0, hidden: false };
    paintPlay();
    say(t('pet.seek.ready'), 1300);

    // Eyes closed: the room goes dark, and counts.
    const veil = node('g', { class: 'seek-veil' });
    veil.innerHTML = `<rect x="0" y="0" width="400" height="300" fill="#1c1636"/>
      <text class="seek-eyes" x="200" y="120" text-anchor="middle">🙈</text>
      <text class="seek-count" x="200" y="196" text-anchor="middle"></text>
      <text class="seek-sub" x="200" y="226" text-anchor="middle">${esc(t('pet.seek.counting'))}</text>`;
    later(() => {
      if (!seek) return;
      layers.fx.append(veil);
      seek.veil = veil;
    }, 900);
    const count = (n) => {
      const el = veil.querySelector('.seek-count');
      el.textContent = String(n);
      el.classList.remove('is-tick');
      void el.getBoundingClientRect();
      el.classList.add('is-tick');
      tone(n === 1 ? 784 : 587, 0, 0.25, { type: 'sine', vol: 0.12 });
    };
    later(() => seek && count(3), 1000);
    later(() => seek && hidePet(spot), 1300);
    later(() => seek && count(2), 1850);
    later(() => seek && count(1), 2700);
    later(() => {
      if (!seek) return;
      veil.querySelector('.seek-eyes').textContent = '👀';
      veil.querySelector('.seek-count').textContent = '';
      veil.querySelector('.seek-sub').textContent = t('pet.seek.find', { name: pet.pet.name });
      veil.classList.add('is-lifting');
      tone(988, 0, 0.35, { type: 'sine', vol: 0.12 });
      later(() => {
        veil.remove();
        if (!seek) return;
        seek.hidden = true;
        seek.since = Date.now();
        // the first hint waits a moment: a fair start
        later(peekLoop, rand(3500, 5500));
      }, 700);
    }, 3550);
  }

  /** Behind the piece: drawn before it in the picture, so the furniture covers it. */
  function hidePet(id) {
    const h = HIDE[id];
    const o = Pet.itemAt(pet, id);
    pos = { x: h.x + o.x, y: h.y + o.y };
    facing = pick([1, -1]);
    setMode('idle');
    if (els.bubble) els.bubble.hidden = true;
    placePet();
    const itemEl = layers.room.querySelector(`.room-item[data-item="${id}"]`);
    if (!itemEl) return;
    // no shadow on the floor in front of the hiding place: it would give it away
    if (layers.shade) layers.shade.style.display = 'none';
    layers.room.insertBefore(layers.petPos, itemEl);
    layers.pet.classList.toggle('is-crouch', h.crouch);
  }

  function unhidePet() {
    if (!layers.petPos) return;
    layers.pet.classList.remove('is-crouch', 'is-peek');
    if (layers.shade) layers.shade.style.display = '';
    layers.stage.append(layers.petPos);
  }

  /** Hints while it hides: a peek round the side, a rustle, a giggle. */
  function peekLoop() {
    if (!seek || !seek.hidden) return;
    if (Date.now() - seek.since > 30000) {
      reveal('timeout');
      return;
    }
    const h = HIDE[seek.spot];
    const roll = Math.random();
    if (roll < 0.45) {
      const s = PET_SCALE * (STAGE_SCALE[Pet.stageOf(pet.pet)] || 1);
      const g = layers.pet;
      g.style.setProperty('--peek', `${((h.peek / s) * pick([1, -1]) * facing).toFixed(1)}px`);
      g.classList.remove('is-peek');
      void g.getBoundingClientRect();
      g.classList.add('is-peek');
      later(() => g.classList.remove('is-peek'), 1700);
    } else if (roll < 0.75) {
      const el = layers.room.querySelector(`.room-item[data-item="${seek.spot}"]`);
      if (el) boing(el, 'is-sway', 1200);
    } else {
      tone(1320, 0, 0.08, { type: 'sine', vol: 0.06 });
      tone(1568, 0.1, 0.08, { type: 'sine', vol: 0.06 });
      tone(1320, 0.2, 0.1, { type: 'sine', vol: 0.06 });
    }
    later(peekLoop, rand(3600, 6000));
  }

  /** A little word floating up from something tapped. */
  function tag(text, x, y, cls = '') {
    const g = node('text', { class: `fx-tag ${cls}`, x: x.toFixed(1), y: y.toFixed(1), 'text-anchor': 'middle' });
    g.textContent = text;
    layers.fx.append(g);
    later(() => g.remove(), 1400);
  }

  function guess(el) {
    if (!seek || !seek.hidden) return;
    lastTouch = Date.now();
    seek.tries += 1;
    if (el.dataset.item === seek.spot) {
      reveal('found');
      return;
    }
    seek.misses += 1;
    const box = itemBox(el);
    boing(el, 'is-sway', 900);
    tag(t('pet.seek.notHere'), box.cx, box.y + 6);
    // Two wrong guesses: the right piece gives itself away.
    if (seek.misses >= 2) {
      const right = layers.room.querySelector(`.room-item[data-item="${seek.spot}"]`);
      if (right) later(() => boing(right, 'is-sway', 1200), 650);
    }
  }

  /** Out it comes — found, or tired of waiting, or the student gave up. */
  function reveal(how) {
    if (!seek) return;
    const tries = seek.tries;
    const spot = seek.spot;
    endSeek();
    const box = (() => {
      const el = layers.room.querySelector(`.room-item[data-item="${spot}"]`);
      return el ? itemBox(el) : { cx: pos.x, y: pos.y - 40 };
    })();
    // in front of the piece, and a little to one side
    const outX = Math.min(360, Math.max(40, box.cx + (box.cx > 200 ? -34 : 34)));
    jumpTo(outX, FLOOR_Y, () => {
      setMode('happy');
      hearts(how === 'found' ? 4 : 2);
      if (how === 'found') sparkles(pos.x, pos.y - 36, 10);
      say(
        how === 'found'
          ? tries <= 1
            ? t('pet.seek.first')
            : t('pet.seek.found', { n: tries })
          : t('pet.seek.here'),
        2600,
      );
      later(() => mode === 'happy' && !held && setMode('idle'), 1800);
    });
  }

  function endSeek() {
    if (!seek) return;
    seek.veil?.remove();
    seek = null;
    busy = false;
    unhidePet();
    paintPlay();
  }

  // ── Behaviour ──────────────────────────────────────────────────────────

  function walkTo(x, y = pos.y, then = null, speed = 70) {
    if (held) return;
    if (perch && !isFish()) {
      // down first, on the side it is heading for, then on its way
      const down = Math.min(372, Math.max(28, pos.x + (x >= pos.x ? 26 : -26)));
      jumpTo(down, FLOOR_Y, () => walkTo(x, y, then, speed));
      return;
    }
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
      // A hungry pet looks hungry all the time, not only when it asks aloud.
      const pining = Pet.wantsSnack(pet);
      setHungry(pining);
      if (roll < 0.55) {
        if (isFish()) walkTo(rand(166, 234), rand(142, 190), null, 34);
        // Up on something, it mostly enjoys the view; now and then it hops down.
        else if (perch && roll > 0.2) lookAt(rand(30, 370), rand(150, 280), 1200);
        else walkTo(rand(70, 340), FLOOR_Y, null, 62);
      } else if (roll < 0.7 && pining) {
        say(`${t('pet.wish')} ${foodIcon(Pet.snackFor(pet.pet.species, 'treat').look)}`, 2600);
      } else if (roll < 0.76) {
        hop();
      } else if (roll < 0.84) {
        // looks one way, then the other, as if it heard something
        lookAt(pos.x - 120, pos.y - 90, 900);
        later(() => lookAt(pos.x + 120, pos.y - 70, 900), 1000);
      } else if (roll < 0.88) {
        stretch();
      } else if (roll < 0.9 && !perch && !isFish() && perches().length) {
        climb(pick(perches()));
      } else if (roll < 0.92) {
        if (pet.pet.variant === 'rare') {
          // A rare one shimmers now and then, just a little.
          sparkles(pos.x, pos.y - (isFish() ? 10 : 36), 6);
        } else {
          // A quiet glance at something on the floor: no idle tick is empty.
          lookAt(rand(40, 360), FLOOR_Y - rand(20, 90), 1000);
        }
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
    if (layers.shade) {
      const sh = layers.shade;
      sh.classList.remove('is-hop');
      void sh.getBoundingClientRect();
      sh.classList.add('is-hop');
      setTimeout(() => sh.classList.remove('is-hop'), 700);
    }
  }

  /** A stretch: up tall, then down into a little squash — before a nap, or just because. */
  function stretch() {
    const root = layers.pet?.querySelector('.pet');
    if (!root) return;
    root.classList.remove('is-stretch');
    void root.getBoundingClientRect();
    root.classList.add('is-stretch');
    setTimeout(() => root.classList.remove('is-stretch'), 1300);
  }

  function goToSleep() {
    if (!isFish() && mode !== 'sleep' && !goToSleep.yawned) {
      // a yawn and a stretch first, then off to bed
      goToSleep.yawned = true;
      stretch();
      say(t('pet.say.sleepy'), 1400);
      later(() => {
        goToSleep.yawned = false;
        if (mode === 'idle' && !held && !busy) goToSleep();
      }, 1500);
      return;
    }
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
    say(t(pick(SOUNDS[lookOf(pet.pet.species, Pet.stageOf(pet.pet))])));
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
    later(() => {
      g.classList.remove(`trick-${id}`);
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
      ballRaf = f < 1 ? requestAnimationFrame(roll) : 0;
    };
    ballRaf = requestAnimationFrame(roll);
    // …and the pet runs after it, pleased.
    later(() => {
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

  /** A new crack is worth seeing: re-draw the egg and pop just that line. */
  function crackPop() {
    if (!layers.egg || !pet.egg) return;
    const body = layers.egg.querySelector('.egg');
    if (!body) return;
    body.innerHTML = eggMarkup(pet.egg.species, Math.min(3, pet.egg.warmth));
    const mark = body.querySelector('.egg-crack');
    if (mark) {
      mark.classList.remove('is-pop');
      void mark.getBoundingClientRect();
      mark.classList.add('is-pop');
      later(() => mark.classList.remove('is-pop'), 700);
    }
    sparkles(200, 196, 6);
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
    setHungry(false);
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
    // beside the bowl, at its depth on the floor
    walkTo(at.x + (fromRight ? 38 : -38), FLOOR_Y + (at.y - BOWL.y), () => {
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
    else if (!Pet.buy(pet, itemId, season)) return;
    save();
    drawRoom(true); // scenery only: the pet keeps breathing while you decorate
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
      els.lead.textContent = t('pet.lead.pet', { kind: kindOf(pet.pet) });
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
          <button class="pet-tab" type="button" role="tab" data-tray="me" aria-selected="${tray === 'me'}">${t('pet.tab.me')}</button>
          <button class="pet-tab" type="button" role="tab" data-tray="book" aria-selected="${tray === 'book'}">${t('pet.tab.book')}${
            Pet.bookSummary(pet).unseen && tray !== 'book' ? `<span class="pet-tab-dot" aria-label="${t('pet.book.new')}"></span>` : ''
          }</button>
        </div>
        ${tray === 'feed' ? feedTray() : ''}
        ${tray === 'decorate' ? decorTray() : ''}
        ${tray === 'pets' ? petsTray() : ''}
        ${tray === 'me' ? meTray() : ''}
        ${tray === 'book' ? bookTray() : ''}`;
      // Opening the book is reading it: what was new is marked this once.
      if (tray === 'book' && Pet.bookSummary(pet).unseen) {
        Pet.bookSeen(pet);
        save();
      }
    }
    paintFoot();
    paintPlay();
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
      case 'piece':
        return t('pet.mem.piece');
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
          ${petIcon(a.species, '', a.variant, Pet.stageOf(a))}
          <span class="tray-name">${esc(a.name || kindOf(a))}</span>
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
    const seasonal = season && Pet.ITEMS.some((i) => i.season === season && !pet.owned.includes(i.id));
    const note = seasonal ? `<p class="pet-season-note">${t(`pet.season.${season}`)}</p>` : '';
    const shelf = Pet.ITEMS.filter((i) => Pet.inShop(pet, i, season) && !(isFish() && i.id === 'bed') && !(isFish() && i.id === 'ball'));
    // what is only here for a while goes first, so nobody misses it
    shelf.sort((a, b) => Number(Boolean(b.season && !pet.owned.includes(b.id))) - Number(Boolean(a.season && !pet.owned.includes(a.id))));
    return `${confirmRow('item')}${note}<div class="pet-tray is-decor">${shelf.map((item) => {
      const owned = pet.owned.includes(item.id);
      const out = Pet.isPlaced(pet, item.id);
      const can = owned || pet.notes >= item.cost;
      const label = owned
        ? out
          ? t('pet.item.out')
          : t('pet.item.away')
        : `♪ ${item.cost}${can ? '' : `<span class="tray-need">${t('pet.need', { n: item.cost - pet.notes })}</span>`}`;
      const picked = pending?.kind === 'item' && pending.id === item.id;
      // Even what costs more than the jar holds can be tried out — something
      // to save up for is worth seeing in the room.
      return `<button class="tray-item${out ? ' is-out' : ''}${picked ? ' is-picked' : ''}${can ? '' : ' is-short'}${item.season && !owned ? ' is-seasonal' : ''}" type="button" data-item="${item.id}" aria-pressed="${out || picked}">
        ${itemIcon(item.id)}
        <span class="tray-name">${t(`pet.item.${item.id}`)}</span>
        <span class="tray-cost">${label}</span></button>`;
    }).join('')}</div>`;
  }

  // ── "Me": the student's own figure ─────────────────────────────────────

  const ME_GROUPS = [
    ['hair', ['hair']],
    ['face', ['eyes', 'mouth', 'extra']],
    ['makeup', ['makeup']],
    ['top', ['top']],
    ['acc', ['acc']],
    ['hat', ['hat']],
    ['move', ['move']],
  ];

  function meTray() {
    const a = pet.avatar;
    const swatches = (kind, list, current, fill) =>
      `<div class="me-swatches" role="group" aria-label="${esc(t(`av.${kind}`))}">${list
        .map(
          (id) =>
            `<button class="me-swatch${id === current ? ' is-on' : ''}" type="button" data-me-${kind}="${id}" style="background:${fill(id)}" aria-pressed="${id === current}" aria-label="${esc(t(`av.${kind}.${id}`))}"></button>`,
        )
        .join('')}</div>`;
    const tile = (item) => {
      const owned = Pet.avatarOwns(pet, item.id);
      const on = a.wear[item.slot] === item.id;
      const can = owned || pet.notes >= item.cost;
      const picked = pending?.kind === 'avatar' && pending.id === item.id;
      const label = owned
        ? on
          ? t(item.slot === 'move' ? 'av.myMove' : 'av.on')
          : t(item.slot === 'move' ? 'av.use' : 'av.wear')
        : `♪ ${item.cost}${can ? '' : `<span class="tray-need">${t('pet.need', { n: item.cost - pet.notes })}</span>`}`;
      // anything can be tried on, even what is still being saved up for
      return `<button class="tray-item av-item${on ? ' is-out' : ''}${picked ? ' is-picked' : ''}${can ? '' : ' is-short'}${item.season && !owned ? ' is-seasonal' : ''}" type="button" data-av="${item.id}" aria-pressed="${on || picked}">
        ${avatarItemIcon(a, item)}
        <span class="tray-name">${t(`av.item.${item.id}`)}</span>
        <span class="tray-cost">${label}</span></button>`;
    };
    const groups = ME_GROUPS.map(([name, slots]) => {
      const items = Pet.AVATAR_ITEMS.filter((i) => slots.includes(i.slot) && Pet.avatarInShop(pet, i, season));
      return `<h4 class="me-h">${t(`av.group.${name}`)}</h4><div class="pet-tray is-me">${items.map(tile).join('')}</div>`;
    }).join('');
    return `
      <div class="me-top">
        <div class="me-figure${tryingOn() ? ' is-trying' : ''}">${avatarPortrait(a, '', tryWear())}</div>
        <div class="me-side">
          <label class="me-switch"><input type="checkbox" data-me-in ${a.in ? 'checked' : ''}/>
            <span><b>${t('av.inRoom')}</b><span class="me-sub">${t('av.inRoom.sub', { name: esc(pet.pet.name) })}</span></span></label>
          <button class="ghost-btn small" type="button" data-act="me-move">${t('av.doMove')}</button>
          <span class="me-label">${t('av.skin')}</span>
          ${swatches('skin', Pet.SKINS, a.skin, skinFill)}
          <span class="me-label">${t('av.hair')}</span>
          ${swatches('hair', Pet.HAIR_COLOURS, a.hairColour, hairFill)}
        </div>
      </div>
      <p class="me-note">${t('av.note')}</p>
      ${confirmRow('avatar')}
      ${groups}`;
  }

  /** The figure changed: the one in the room and the one in the panel are redrawn. */
  function avatarChanged(move = false) {
    save();
    drawAvatar();
    paintNotes();
    paintPanel();
    if (move) {
      runMove(els.panel.querySelector('.me-figure .av'), pet.avatar.wear.move);
      doMove();
    }
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
        : kind === 'avatar'
          ? t(`av.item.${pending.id}`)
          : t(`pet.item.${pending.id}`);
    const cost = (kind === 'snack' ? Pet.SNACKS : kind === 'avatar' ? Pet.AVATAR_ITEMS : Pet.ITEMS).find((x) => x.id === pending.id).cost;
    if (kind === 'item' && cost > pet.notes) {
      return `<div class="pet-confirm is-preview" role="group">
      <span>${t('pet.confirm.short', { name: esc(name), cost, n: cost - pet.notes })}</span>
      <span class="pet-confirm-btns">
        <button class="quiet-btn small" type="button" data-act="cancel-buy">${t('pet.confirm.putBack')}</button>
      </span></div>`;
    }
    if (kind === 'avatar' && cost > pet.notes) {
      return `<div class="pet-confirm is-preview" role="group">
      <span>${t(pending.id.startsWith('move-') ? 'av.confirm.moveShort' : 'av.confirm.short', { name: esc(name), cost, n: cost - pet.notes })}</span>
      <span class="pet-confirm-btns">
        <button class="quiet-btn small" type="button" data-act="cancel-buy">${t('pet.confirm.putBack')}</button>
      </span></div>`;
    }
    if (kind === 'avatar') {
      return `<div class="pet-confirm is-preview" role="group">
      <span>${t(pending.id.startsWith('move-') ? 'av.confirm.move' : 'av.confirm.try', { name: esc(name), cost, left: pet.notes - cost })}</span>
      <span class="pet-confirm-btns">
        <button class="primary-btn small" type="button" data-act="confirm-buy">${t('pet.confirm.buy')}</button>
        <button class="quiet-btn small" type="button" data-act="cancel-buy">${t('pet.confirm.putBack')}</button>
      </span></div>`;
    }
    if (kind === 'item') {
      return `<div class="pet-confirm is-preview" role="group">
      <span>${t('pet.confirm.tryItem', { name: esc(name), cost, left: pet.notes - cost })}</span>
      <span class="pet-confirm-btns">
        <button class="primary-btn small" type="button" data-act="confirm-buy">${t('pet.confirm.buy')}</button>
        <button class="quiet-btn small" type="button" data-act="cancel-buy">${t('pet.confirm.putBack')}</button>
      </span></div>`;
    }
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
    const lookBefore = previewItem()?.id;
    const tryBefore = tryingOn()?.id;
    onPanelClick(b);
    if (tryingOn()?.id !== tryBefore && running && tryingOn()?.slot !== 'move') {
      const x = pet.avatar.x;
      drawAvatar();
      pet.avatar.x = x;
      placeAvatar();
    }
    if (previewItem()?.id !== lookBefore && running) paintFurniture();
  });

  function onPanelClick(b) {
    if (b.dataset.act === 'egg') confirmEgg();
    else if (b.dataset.act === 'practise') onPractise();
    else if (b.dataset.act === 'choose-next') {
      choosing = true;
      picked = null;
      drawRoom();
      paintPanel();
      sparkles(200, 196, 5);
    } else if (b.dataset.act === 'unchoose') {
      choosing = false;
      picked = null;
      drawRoom();
      paintPanel();
      hearts(1);
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
      hearts(2);
      say(t('pet.plan.bye'), 2000);
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
      if (kind === 'avatar') {
        if (Pet.buyAvatar(pet, id, season)) avatarChanged(id.startsWith('move-'));
        return;
      }
      if (kind === 'snack') feed(id);
      else buyOrToggle(id);
      paintPanel();
    } else if (b.dataset.act === 'cancel-buy') {
      pending = null;
      paintPanel();
    } else if (b.dataset.act === 'me-move') {
      runMove(els.panel.querySelector('.me-figure .av'), pet.avatar.wear.move);
      doMove();
    } else if (b.dataset.meSkin) {
      Pet.setAvatar(pet, { skin: b.dataset.meSkin });
      avatarChanged();
    } else if (b.dataset.meHair) {
      Pet.setAvatar(pet, { hairColour: b.dataset.meHair });
      avatarChanged();
    } else if (b.dataset.av) {
      // something owned (or free) is put on or taken off — no money moves
      if (Pet.avatarOwns(pet, b.dataset.av)) {
        pending = null;
        if (Pet.wear(pet, b.dataset.av)) avatarChanged(b.dataset.av.startsWith('move-'));
      } else {
        pending = pending?.kind === 'avatar' && pending.id === b.dataset.av ? null : { kind: 'avatar', id: b.dataset.av };
        paintPanel();
        showConfirm();
        // a move is tried by doing it, in the panel and in the room
        if (pending && b.dataset.av.startsWith('move-')) {
          runMove(els.panel.querySelector('.me-figure .av'), b.dataset.av);
          runMove(layers.av?.querySelector('.av'), b.dataset.av);
        }
      }
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
  }

  els.panel.addEventListener('change', (event) => {
    const box = event.target.closest('input[data-me-in]');
    if (!box) return;
    Pet.setAvatar(pet, { in: box.checked });
    avatarChanged(box.checked);
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
      const scaleNode = layers.pet?.querySelector('.pet-scale');
      if (scaleNode) {
        scaleNode.classList.remove('is-growing');
        void scaleNode.getBoundingClientRect();
        scaleNode.classList.add('is-growing');
        later(() => scaleNode.classList.remove('is-growing'), 600);
      }
      hop();
      setMode('happy');
      say(t(stage === 'grown' ? (lookOf(pet.pet.species, 'grown') === 'hen' ? 'pet.grew.hen' : 'pet.grew.grown') : 'pet.grew.kid'), 3000);
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

  function earnTake({ kind = 'scale', id = '', dayKey = '', octaves = 1, small = false } = {}) {
    pet = Pet.loadPet(profileId());
    const key = dayKey || localDayKey();
    const result = Pet.earn(pet, { kind, id, dayKey: key, octaves, small });
    save();
    if (running) {
      paintNotes();
      if (result.warmed && pet.egg && !pet.pet) crackPop();
    }
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
    perch = null;
    paintPlay();
    if (pet.pet) {
      lastTouch = Date.now();
      blinkLoop();
      later(wander, 1800);
      later(avatarWander, 3500);
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
    if (seek) endSeek();
    running = false;
    busy = false;
    timers.forEach(clearTimeout);
    timers = [];
    cancelAnimationFrame(raf);
    cancelAnimationFrame(ballRaf);
    ballRaf = 0;
    stopAvatarWalk();
    queuedReaction = false;
    if (els.bubble) els.bubble.hidden = true;
    if (els.play) els.play.hidden = true;
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
    /** Whether the pet is a chicken (which grows up into a hen). */
    isChick() {
      return Pet.loadPet(profileId()).pet?.species === 'chicken';
    },
    /** The pet's portrait (or its egg), for the toast. */
    portrait() {
      const p = Pet.loadPet(profileId());
      if (p.pet) return petIcon(p.pet.species, '', p.pet.variant, Pet.stageOf(p.pet));
      if (p.egg) return `<svg class="pet-icon" viewBox="14 18 72 82" aria-hidden="true">${eggMarkup(p.egg.species, Math.min(3, p.egg.warmth))}</svg>`;
      return '';
    },
    name() {
      const p = Pet.loadPet(profileId());
      return p.pet && p.pet.name ? p.pet.name : '';
    },
  };
}
