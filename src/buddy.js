// buddy.js — the pet, small, keeping the student company while they play.
//
// The same pet as the pet room (or its egg, before it hatches), drawn small at
// the edge of the listening card. It is there to make practising feel like
// playing *for* someone, so it only ever reacts kindly:
//
//   listening  ears up, head tilted, swaying — from "Start listening" on
//   note       a little bop on each new note, and now and then a ♪ floats up
//   cheer      a hop and hearts when a take is done (whatever it scored)
//   curious    a head tilt and a "?" for a take too short to count
//
// It never judges a score, never sulks, and stays out of the way: decorative to
// a screen reader, and absent entirely for a student who has no pet or egg.

import { loadPet } from './pet.js?v=202611089800';
import { petMarkup, eggMarkup, HEART } from './petart.js?v=202611089800';

const NS = 'http://www.w3.org/2000/svg';

export function createBuddy(host, { profileId }) {
  if (!host) {
    const nothing = () => {};
    return { refresh: nothing, listen: nothing, note: nothing, cheer: nothing, curious: nothing };
  }
  let kind = null; // 'pet' | 'egg' | null
  let notes = 0;
  let bopTimer = 0;
  let listening = false;

  function refresh() {
    const pet = loadPet(profileId());
    let inner = '';
    if (pet.pet) {
      kind = 'pet';
      inner = `<g class="buddy-body">${petMarkup(pet.pet.species, pet.pet.variant)}</g>`;
    } else if (pet.egg) {
      kind = 'egg';
      inner = `<g class="buddy-body">${eggMarkup(pet.egg.species, Math.min(3, pet.egg.warmth))}</g>`;
    } else {
      kind = null;
    }
    host.hidden = !kind;
    host.classList.toggle('is-egg', kind === 'egg');
    host.innerHTML = kind
      ? `<svg class="buddy-svg" viewBox="-6 -10 112 110" aria-hidden="true">${inner}<g class="buddy-fx"></g></svg>`
      : '';
    setListening(listening);
  }

  function setListening(on) {
    listening = on;
    host.classList.toggle('is-listening', on);
    const root = host.querySelector('.pet');
    if (root) root.classList.toggle('is-walk', false);
  }

  function float(markup, cls, x = 70, y = 18) {
    const fx = host.querySelector('.buddy-fx');
    if (!fx) return;
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('transform', `translate(${x} ${y})`);
    g.innerHTML = `<g class="${cls}">${markup}</g>`;
    fx.append(g);
    setTimeout(() => g.remove(), 1600);
  }

  function hop() {
    host.classList.remove('is-hop');
    void host.offsetWidth;
    host.classList.add('is-hop');
    setTimeout(() => host.classList.remove('is-hop'), 700);
  }

  // A tap on the buddy is a pat.
  host.addEventListener('pointerdown', () => {
    if (!kind) return;
    hop();
    float(`<path d="${HEART}" fill="#ff7f93"/>`, 'buddy-heart', 50, 10);
  });

  return {
    refresh,

    /** From "Start listening" until the take is over. */
    listen(on) {
      if (!kind) return;
      if (on) notes = 0;
      setListening(on);
    },

    /** A new note was heard. */
    note() {
      if (!kind || !listening) return;
      notes += 1;
      host.classList.add('is-bop');
      clearTimeout(bopTimer);
      bopTimer = setTimeout(() => host.classList.remove('is-bop'), 170);
      // Every few notes, a little ♪ drifts up — more of them as the take goes on.
      if (notes % 4 === 0) {
        float(
          `<text font-size="18" font-weight="700" fill="${notes % 8 === 0 ? '#e48aa0' : '#5b8f78'}">♪</text>`,
          'buddy-note',
          notes % 8 === 0 ? 78 : 14,
          20,
        );
      }
    },

    /** The take counted: well done, whatever the number says. */
    cheer() {
      if (!kind) return;
      setListening(false);
      hop();
      const root = host.querySelector('.pet');
      if (root) {
        root.classList.add('is-happy');
        setTimeout(() => root.classList.remove('is-happy'), 1800);
      }
      [0, 180, 360].forEach((delay, i) =>
        setTimeout(() => float(`<path d="${HEART}" fill="${['#ff7f93', '#f9667d', '#ff9fb0'][i]}"/>`, 'buddy-heart', 36 + i * 14, 8), delay),
      );
    },

    /** Too short to count — not a failure, just "huh?". */
    curious() {
      if (!kind) return;
      setListening(false);
      host.classList.add('is-curious');
      float('<text font-size="20" font-weight="700" fill="#8f9fd0">?</text>', 'buddy-note', 74, 14);
      setTimeout(() => host.classList.remove('is-curious'), 1600);
    },
  };
}
