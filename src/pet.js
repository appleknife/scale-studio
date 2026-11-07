// pet.js — the pet room's rules: notes, eggs, hatching, snacks and decorations.
//
// No drawing here (that is petart.js) and no screen (petroom.js): only what the
// pet *is*, so the rules can be tested on their own.
//
// The rules are written to be kind. Nothing here can go wrong for the pet:
//   - it never gets sick, sad, or hungry in a way that hurts. `fullness` falls
//     slowly and only decides whether it sometimes *mentions* a snack;
//   - nothing is lost by staying away, and there is no streak to break;
//   - notes come only from real practice (counted takes — a tap or a false start
//     earns nothing), with a soft daily cap so playing G major forty times is
//     not a strategy. A key not yet played today earns a bonus on top, shown
//     with its own little celebration, which nudges a student round all their
//     keys. The bonus is paid even past the cap: there are only so many keys.
//
// Each student name on the device has its own pet, kept in its own slot in
// localStorage. Nothing leaves the device.

export const SPECIES = ['dog', 'cat', 'hamster', 'chicken', 'fish'];

/** Counted takes it takes to hatch an egg: the first session ends with a pet. */
export const HATCH_TAKES = 3;

/** Notes a day before takes start earning only a little. */
export const DAILY_CAP = 60;

export const EARN = {
  take: 3, // every counted take
  newKey: 4, // a scale not yet played today, or the first sight reading of the day
  firstOfDay: 5, // the first counted take of the day
  afterCap: 1, // what a take still earns once the day's cap is reached
};

/** Snacks: eaten once, bought each time. `fav` is the species that loves it most. */
export const SNACKS = [
  { id: 'berry', cost: 3, fill: 20 },
  { id: 'cookie', cost: 5, fill: 30 },
  { id: 'treat', cost: 6, fill: 35, special: true }, // the species' own favourite
  { id: 'cake', cost: 9, fill: 45 },
];

/** The favourite, drawn per species: a fish treat for the cat, a bone for the dog… */
export const FAVOURITE = {
  cat: 'fishtreat',
  dog: 'bone',
  hamster: 'seeds',
  chicken: 'corn',
  fish: 'flakes',
};

/** Decorations: bought once, then put out or put away at will. */
export const ITEMS = [
  { id: 'rug', cost: 10, slot: 'rug' },
  { id: 'window', cost: 14, slot: 'window' },
  { id: 'plant', cost: 8, slot: 'plant' },
  { id: 'ball', cost: 6, slot: 'ball' },
  { id: 'bed', cost: 12, slot: 'bed' },
  { id: 'picture', cost: 10, slot: 'picture' },
  { id: 'lamp', cost: 10, slot: 'lamp' },
  { id: 'bunting', cost: 12, slot: 'bunting' },
  { id: 'stand', cost: 20, slot: 'stand' },
  { id: 'wall-mint', cost: 15, slot: 'wall' },
  { id: 'wall-dots', cost: 15, slot: 'wall' },
  { id: 'wall-stars', cost: 18, slot: 'wall' },
];

const DAY_MS = 24 * 60 * 60 * 1000;
/** Fullness lost per day — a gentle drift, about one snack a day keeps it content. */
const HUNGER_PER_DAY = 35;

export function emptyPet() {
  return {
    v: 1,
    notes: 0,
    egg: null, // { species, warmth }
    pet: null, // { species, name, born, fullness, fedAt, snacks }
    owned: [],
    placed: [],
    wall: null, // the wallpaper item in use, or null for the plain one
    day: { key: '', earned: 0, keys: [], sight: false, any: false },
    lastSeen: 0,
    totalEarned: 0,
  };
}

export function storageKey(profileId) {
  return `scaleStudio.pet.v1.${profileId || 'default'}`;
}

export function loadPet(profileId, storage = globalThis.localStorage) {
  try {
    const raw = storage && storage.getItem(storageKey(profileId));
    if (!raw) return emptyPet();
    const parsed = JSON.parse(raw);
    const base = emptyPet();
    return {
      ...base,
      ...parsed,
      day: { ...base.day, ...(parsed.day || {}) },
      owned: Array.isArray(parsed.owned) ? parsed.owned : [],
      placed: Array.isArray(parsed.placed) ? parsed.placed : [],
    };
  } catch {
    return emptyPet();
  }
}

export function savePet(profileId, pet, storage = globalThis.localStorage) {
  try {
    if (storage) storage.setItem(storageKey(profileId), JSON.stringify(pet));
  } catch {
    /* private mode or full storage: the pet lives for this visit */
  }
}

/**
 * A counted take earns notes. `kind` is 'scale' or 'sight'; `id` is the scale's
 * key for a scale. Returns what was earned in all, the part of it that was the
 * new-key bonus, and whether the egg warmed.
 */
export function earn(pet, { kind = 'scale', id = '', dayKey = '' } = {}) {
  if (pet.day.key !== dayKey) {
    pet.day = { key: dayKey, earned: 0, keys: [], sight: false, any: false };
  }
  const day = pet.day;
  const fresh = (kind === 'scale' && id && !day.keys.includes(id)) || (kind === 'sight' && !day.sight);
  // The new-key bonus stands apart from the cap, so it can be shown on its own.
  const bonus = fresh ? EARN.newKey : 0;
  let base;
  if (day.earned >= DAILY_CAP) {
    base = EARN.afterCap;
  } else {
    base = EARN.take;
    if (!day.any) base += EARN.firstOfDay;
    base = Math.min(base, DAILY_CAP - day.earned + EARN.afterCap);
  }
  const amount = base + bonus;
  day.any = true;
  if (kind === 'scale' && id && !day.keys.includes(id)) day.keys.push(id);
  if (kind === 'sight') day.sight = true;
  day.earned += amount;
  pet.notes += amount;
  pet.totalEarned = (pet.totalEarned || 0) + amount;

  let warmed = false;
  if (pet.egg && pet.egg.warmth < HATCH_TAKES) {
    pet.egg.warmth += 1;
    warmed = true;
  }
  return { amount, warmed, bonus };
}

export function chooseEgg(pet, species) {
  if (pet.pet || !SPECIES.includes(species)) return false;
  pet.egg = { species, warmth: 0 };
  return true;
}

export function readyToHatch(pet) {
  return Boolean(pet.egg && !pet.pet && pet.egg.warmth >= HATCH_TAKES);
}

export function hatch(pet, now = Date.now()) {
  if (!readyToHatch(pet)) return false;
  pet.pet = {
    species: pet.egg.species,
    name: '',
    born: now,
    fullness: 70,
    fedAt: now,
    snacks: 0,
  };
  pet.egg = null;
  return true;
}

export function name(pet, value) {
  if (!pet.pet) return false;
  const clean = String(value || '').trim().slice(0, 18);
  if (!clean) return false;
  pet.pet.name = clean;
  return true;
}

/** How full the pet feels now — it drifts down with time, never below zero. */
export function fullness(pet, now = Date.now()) {
  if (!pet.pet) return 0;
  const days = Math.max(0, now - (pet.pet.fedAt || now)) / DAY_MS;
  return Math.max(0, Math.min(100, (pet.pet.fullness || 0) - days * HUNGER_PER_DAY));
}

/** Would it like a snack? Only ever a wish, never a need. */
export function wantsSnack(pet, now = Date.now()) {
  return Boolean(pet.pet) && fullness(pet, now) < 40;
}

export function snackFor(species, snackId) {
  const snack = SNACKS.find((s) => s.id === snackId);
  if (!snack) return null;
  const look = snack.special ? FAVOURITE[species] || 'cookie' : snack.id;
  return { ...snack, look, favourite: Boolean(snack.special) };
}

export function feed(pet, snackId, now = Date.now()) {
  if (!pet.pet) return null;
  const snack = snackFor(pet.pet.species, snackId);
  if (!snack || pet.notes < snack.cost) return null;
  pet.notes -= snack.cost;
  pet.pet.fullness = Math.min(100, fullness(pet, now) + snack.fill);
  pet.pet.fedAt = now;
  pet.pet.snacks = (pet.pet.snacks || 0) + 1;
  return snack;
}

export function buy(pet, itemId) {
  const item = ITEMS.find((i) => i.id === itemId);
  if (!item || pet.owned.includes(itemId) || pet.notes < item.cost) return false;
  pet.notes -= item.cost;
  pet.owned.push(itemId);
  place(pet, itemId, true);
  return true;
}

/** Put a bought decoration out, or away. A wallpaper replaces the one up. */
export function place(pet, itemId, on = !isPlaced(pet, itemId)) {
  const item = ITEMS.find((i) => i.id === itemId);
  if (!item || !pet.owned.includes(itemId)) return false;
  if (item.slot === 'wall') {
    pet.wall = on ? itemId : null;
    return true;
  }
  pet.placed = pet.placed.filter((id) => id !== itemId);
  if (on) pet.placed.push(itemId);
  return true;
}

export function isPlaced(pet, itemId) {
  const item = ITEMS.find((i) => i.id === itemId);
  if (!item) return false;
  return item.slot === 'wall' ? pet.wall === itemId : pet.placed.includes(itemId);
}

/** Back after a while? The room greets you — gladly, never reproachfully. */
export function visit(pet, now = Date.now()) {
  const away = pet.lastSeen ? now - pet.lastSeen : 0;
  pet.lastSeen = now;
  return { away, longAway: away > 20 * 60 * 60 * 1000 };
}
