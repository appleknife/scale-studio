// sheetkeys.js — what a page-turner's switches do.
//
// A Bluetooth pedal (AirTurn, PageFlip, a footswitch in keyboard mode) pairs
// with the tablet's operating system and arrives at a web page as ordinary key
// presses, usually PageUp/PageDown or the arrows. That is the only road a web
// app has: AirTurn's own "direct mode" talks BLE GATT, which the browser cannot
// open. So the app listens for keys, maps them to actions, and lets the student
// change the mapping — a pedal that sends B or F is as good as one that sends
// PageDown.
//
// Defaults are deliberately broad but harmless: the arrows and Page keys every
// reader uses, Space, and B/N, which several pedals send out of the box.

const KEY_STORE = 'scaleStudio.sheetKeys';

export const ACTIONS = ['prev', 'next', 'first', 'last', 'bookmark', 'audio'];

export const DEFAULTS = {
  prev: ['ArrowLeft', 'PageUp', 'P'],
  next: ['ArrowRight', 'PageDown', 'Space', 'B', 'N'],
  first: ['Home'],
  last: ['End'],
  bookmark: ['K'],
  audio: ['M'],
};

/** A printable name for a key, for the settings rows. */
export function keyLabel(key) {
  const names = {
    ' ': 'Space',
    Space: 'Space',
    ArrowLeft: '←',
    ArrowRight: '→',
    ArrowUp: '↑',
    ArrowDown: '↓',
    PageUp: 'Page Up',
    PageDown: 'Page Down',
    Home: 'Home',
    End: 'End',
    Escape: 'Esc',
  };
  return names[key] || key;
}

export function normalKey(event) {
  if (!event) return '';
  if (event.key === ' ') return 'Space';
  const code = String(event.code || '');
  if (/^Key[A-Z]$/.test(code)) return code.slice(3);
  if (/^Digit\d$/.test(code)) return code.slice(5);
  return String(event.key || '');
}

/** Keys must not be taken twice; a new binding clears the old owner. */
export function assign(map, action, key) {
  const next = {};
  for (const [name, keys] of Object.entries(DEFAULTS)) next[name] = [...(map[name] || [])];
  if (!key) return next;
  for (const name of Object.keys(next)) next[name] = next[name].filter((k) => k !== key);
  next[action] = [...(next[action] || []), key];
  return next;
}

export function actionFor(key, map) {
  if (!key) return '';
  for (const action of ACTIONS) if ((map[action] || []).includes(key)) return action;
  return '';
}

export function loadMap() {
  let stored = null;
  try {
    stored = JSON.parse(localStorage.getItem(KEY_STORE) || 'null');
  } catch {
    stored = null;
  }
  const map = {};
  for (const action of ACTIONS) {
    const keys = stored && Array.isArray(stored[action]) ? stored[action] : DEFAULTS[action];
    map[action] = [...new Set(keys.map(String))];
  }
  return map;
}

export function saveMap(map) {
  try {
    localStorage.setItem(KEY_STORE, JSON.stringify(map));
  } catch {
    /* private mode */
  }
}

export function resetMap() {
  try {
    localStorage.removeItem(KEY_STORE);
  } catch {
    /* private mode */
  }
  return loadMap();
}
