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
//
// Growing up and collecting (v2). The shape follows what the research on
// rewards and children says:
//   - a pet grows from *practising* — counted takes — never from scores, so the
//     pet is never a payment for playing well (performance-contingent rewards
//     are the ones that wear down a child's own wish to play);
//   - baby → kid → grown, GROW_TAKES takes a stage, and nothing goes backwards;
//   - a grown pet means a new egg may be chosen, and that egg arrives already a
//     little warm (people finish a card that starts with a stamp in it faster);
//   - the pet book records every animal hatched, and now and then a hatchling
//     is a rare colour. It is never promised or announced beforehand: an
//     unexpected reward is a surprise, not a wage;
//   - every pet is kept. Grown friends wait in the pet book and any of them
//     can come back into the room.

export const SPECIES = ['dog', 'cat', 'hamster', 'chicken', 'fish'];

/** Counted takes it takes to hatch an egg: the first session ends with a pet. */
export const HATCH_TAKES = 3;

/** Counted takes from one stage to the next: baby → kid → grown, about a week. */
export const GROW_TAKES = 15;
export const STAGES = ['baby', 'kid', 'grown'];

/** How often a hatchling turns out to be a rare colour. */
export const RARE_CHANCE = 1 / 8;

/** The warmth a second (third, …) egg starts with: it is never a cold start. */
export const NEXT_EGG_WARMTH = 1;

/**
 * Feeding has an effect, and only a good one (a pet that wasn't fed grows at the
 * normal speed — there is no penalty to fear):
 *   - fed today: the next FED_BOOST takes today count double towards growing;
 *   - its favourite snack, every TRICK_EVERY times, teaches it a trick.
 */
export const FED_BOOST = 5;
export const TRICK_EVERY = 5;
export const TRICKS = ['spin', 'jump', 'dance', 'roll'];

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
    v: 2,
    notes: 0,
    egg: null, // { species, warmth }
    pet: null, // { species, name, born, fullness, fedAt, snacks }
    owned: [],
    placed: [],
    wall: null, // the wallpaper item in use, or null for the plain one
    day: { key: '', earned: 0, keys: [], sight: false, any: false },
    lastSeen: 0,
    totalEarned: 0,
    friends: [], // grown (or set-aside) pets, waiting in the pet book
    dex: {}, // { [species]: { plain: n, rare: n } } — every hatch, ever
  };
}

/**
 * Brings an older save up to date. A pet hatched before pets grew starts as a
 * kid rather than shrinking back to a baby, and goes into the pet book.
 */
function upgrade(p) {
  if (!Array.isArray(p.friends)) p.friends = [];
  if (!p.dex || typeof p.dex !== 'object') p.dex = {};
  if (p.pet) {
    if (!Number.isFinite(p.pet.growth)) p.pet.growth = GROW_TAKES;
    if (!p.pet.variant) p.pet.variant = 'plain';
    if (!p.pet.seen) p.pet.seen = stageOf(p.pet);
    if (!(p.dex[p.pet.species] && p.dex[p.pet.species][p.pet.variant])) note(p, p.pet);
  }
  p.v = 2;
  return p;
}

function note(p, animal) {
  const entry = (p.dex[animal.species] = p.dex[animal.species] || { plain: 0, rare: 0 });
  entry[animal.variant] = (entry[animal.variant] || 0) + 1;
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
    return upgrade({
      ...base,
      ...parsed,
      day: { ...base.day, ...(parsed.day || {}) },
      owned: Array.isArray(parsed.owned) ? parsed.owned : [],
      placed: Array.isArray(parsed.placed) ? parsed.placed : [],
    });
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
  // The pet in the room grows with every counted take, whatever it scored — and
  // twice as fast for a few takes on a day it has been fed.
  let grew = null;
  let boosted = false;
  if (pet.pet && pet.pet.name) {
    const before = stageOf(pet.pet);
    boosted = boostLeft(pet, dayKey) > 0;
    if (boosted) pet.pet.boost = { day: dayKey, used: (pet.pet.boost?.day === dayKey ? pet.pet.boost.used : 0) + 1 };
    pet.pet.growth = (pet.pet.growth || 0) + (boosted ? 2 : 1);
    const after = stageOf(pet.pet);
    if (after !== before) grew = after;
  }
  return { amount, warmed, bonus, grew, boosted };
}

/** The local calendar day, as the journal writes it. */
export function dayKeyOf(ms = Date.now()) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Double-growth takes left today: FED_BOOST on a day it was fed, less those used. */
export function boostLeft(pet, dayKey = dayKeyOf()) {
  const a = pet.pet;
  if (!a || a.fedDay !== dayKey || stageOf(a) === 'grown') return 0;
  const used = a.boost && a.boost.day === dayKey ? a.boost.used : 0;
  return Math.max(0, FED_BOOST - used);
}

/** The tricks a pet knows, in the order it learned them. */
export function tricksOf(animal) {
  if (!animal) return [];
  return TRICKS.slice(0, Math.min(TRICKS.length, Math.floor((animal.favs || 0) / TRICK_EVERY)));
}

/** Favourite snacks still to go before the next trick, or null when it knows them all. */
export function toNextTrick(animal) {
  if (!animal || tricksOf(animal).length >= TRICKS.length) return null;
  return { done: (animal.favs || 0) % TRICK_EVERY, need: TRICK_EVERY };
}

/* ── Growing ───────────────────────────────────────────────────────────── */

export function stageOf(animal) {
  if (!animal) return null;
  const g = Number.isFinite(animal.growth) ? animal.growth : GROW_TAKES;
  return STAGES[Math.min(STAGES.length - 1, Math.floor(g / GROW_TAKES))];
}

/** Takes done and needed for the next stage, or null once grown. */
export function growthToNext(animal) {
  if (!animal || stageOf(animal) === 'grown') return null;
  const g = animal.growth || 0;
  return { done: g % GROW_TAKES, need: GROW_TAKES, next: STAGES[Math.floor(g / GROW_TAKES) + 1] };
}

/**
 * A stage reached since the room last showed it, for the celebration — and
 * marks it shown. Null when there is nothing new.
 */
export function unseenGrowth(pet) {
  if (!pet.pet) return null;
  const now = stageOf(pet.pet);
  if (pet.pet.seen === now) return null;
  pet.pet.seen = now;
  return now;
}

/** Every pet the student has: the one in the room first, then the pet book's. */
export function allPets(pet) {
  return (pet.pet ? [pet.pet] : []).concat(pet.friends || []);
}

/** A new egg may be chosen once there is no one left still growing up. */
export function canChooseNextEgg(pet) {
  return Boolean(pet.pet) && !pet.egg && allPets(pet).every((a) => stageOf(a) === 'grown');
}

/**
 * The next egg: the pet in the room goes to the pet book (it is kept, and can
 * come back any time) and the egg takes its place in the nest, already warm.
 */
export function chooseNextEgg(pet, species) {
  if (!canChooseNextEgg(pet) || !SPECIES.includes(species)) return false;
  pet.friends.unshift(pet.pet);
  pet.pet = null;
  pet.egg = { species, warmth: NEXT_EGG_WARMTH };
  return true;
}

/** Brings a pet from the pet book into the room; the one there takes its place. */
export function switchTo(pet, index) {
  if (pet.egg || !Array.isArray(pet.friends)) return false;
  const friend = pet.friends[index];
  if (!friend) return false;
  pet.friends.splice(index, 1);
  if (pet.pet) pet.friends.splice(index, 0, pet.pet);
  pet.pet = friend;
  return true;
}

/** Hatches and species seen, for the pet book's count. */
export function dexCount(pet) {
  let found = 0;
  for (const species of SPECIES) {
    const e = (pet.dex || {})[species];
    if (e && e.plain) found += 1;
    if (e && e.rare) found += 1;
  }
  return { found, total: SPECIES.length * 2 };
}

export function chooseEgg(pet, species) {
  if (pet.pet || !SPECIES.includes(species)) return false;
  pet.egg = { species, warmth: 0 };
  return true;
}

export function readyToHatch(pet) {
  return Boolean(pet.egg && !pet.pet && pet.egg.warmth >= HATCH_TAKES);
}

export function hatch(pet, now = Date.now(), roll = Math.random()) {
  if (!readyToHatch(pet)) return false;
  pet.pet = {
    species: pet.egg.species,
    name: '',
    born: now,
    fullness: 70,
    fedAt: now,
    snacks: 0,
    growth: 0,
    seen: 'baby',
    variant: roll < RARE_CHANCE ? 'rare' : 'plain',
  };
  pet.egg = null;
  if (!pet.dex) pet.dex = {};
  note(pet, pet.pet);
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

export function feed(pet, snackId, now = Date.now(), dayKey = dayKeyOf(now)) {
  if (!pet.pet) return null;
  const snack = snackFor(pet.pet.species, snackId);
  if (!snack || pet.notes < snack.cost) return null;
  pet.notes -= snack.cost;
  pet.pet.fullness = Math.min(100, fullness(pet, now) + snack.fill);
  pet.pet.fedAt = now;
  pet.pet.snacks = (pet.pet.snacks || 0) + 1;
  // The first snack of the day switches on the growth boost for today.
  const boostStarted = pet.pet.fedDay !== dayKey && stageOf(pet.pet) !== 'grown';
  pet.pet.fedDay = dayKey;
  let learned = null;
  if (snack.favourite) {
    const before = tricksOf(pet.pet).length;
    pet.pet.favs = (pet.pet.favs || 0) + 1;
    const now2 = tricksOf(pet.pet);
    if (now2.length > before) learned = now2[now2.length - 1];
  }
  return { ...snack, learned, boostStarted };
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
