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

// A plan and a memory book (v3). Two more things the research points to, and
// neither of them is a reward:
//   - "when will I hear you next?" — the student picks the moment themselves
//     (before school, after dinner…). Deciding in advance *when* is the single
//     cheapest thing that makes an intention happen (Gollwitzer & Sheeran's
//     if-then plans), and choosing it yourself is what keeps it yours. Nothing
//     is paid for keeping a plan and nothing is said if it slips: the pet is
//     simply glad, the next time there is practice, that you came back;
//   - a memory book: firsts and milestones, dated, in the student's own terms —
//     the first time each key was played, the first two-octave scale, ten takes,
//     thirty days of practice. Days are *counted*, never chained: there is no
//     streak to break, because a missed day does not undo a habit and a broken
//     streak mostly teaches a child to stop. Every entry is for doing, none for
//     scoring, so the book tells a student they are getting somewhere without
//     ever grading them.

export const SPECIES = ['dog', 'cat', 'hamster', 'chicken', 'fish'];

/** The moments a plan can name: things that happen every day, to hang practice on. */
export const PLAN_CUES = ['morning', 'afterSchool', 'afterDinner', 'beforeBed'];

/** Counted takes, and days with any practice, that the memory book marks. */
export const TAKE_MARKS = [10, 25, 50, 100, 200, 300, 500, 750, 1000];
export const DAY_MARKS = [3, 7, 14, 30, 50, 75, 100, 150, 200, 365];

/** The most entries the book keeps (far more than a year of firsts). */
const BOOK_LIMIT = 240;

function freshBook() {
  return { takes: 0, days: 0, lastDay: '', keys: [], firsts: {}, entries: [], unseen: 0 };
}

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
  extraOctave: 2, // and for a scale, this much more for each octave past the first
  newKey: 4, // a scale not yet played today, or the first sight reading of the day
  firstOfDay: 5, // the first counted take of the day
  // Practice that is not a take counts too: a day logged by hand, and a take kept
  // to listen back to. Each pays once a day — the pet is company for the whole
  // practice, not only for the parts the app can hear.
  practice: 4,
  recording: 2,
  // And the key it asked for: paid once, and paid even past the daily cap. A wish
  // is an invitation, not a wage.
  wish: 6,
  afterCap: 1, // what a take still earns once the day's cap is reached
};

/** The twelve majors a wish can name, in the order the grid shows them. */
export const WISH_KEYS = ['G', 'D', 'A', 'E', 'B', 'F#', 'C#', 'F', 'Bb', 'Eb', 'Ab', 'C'];

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

/**
 * How far each thing in the room may be dragged from where it is first put down,
 * in room units (the room is 400 wide). Things on the floor slide along it; the
 * window and the picture go anywhere on the wall; the rug has a little depth.
 * The bowl counts as furniture here, though it is never bought.
 */
export const ITEM_RANGE = {
  window: { x: [-44, 250], y: [-32, 64] },
  picture: { x: [-272, 54], y: [-42, 64] },
  lamp: { x: [-336, 14], y: [0, 0] },
  plant: { x: [-12, 342], y: [0, 0] },
  stand: { x: [-66, 272], y: [0, 0] },
  bed: { x: [-246, 54], y: [0, 0] },
  rug: { x: [-76, 76], y: [-4, 10] },
  bowl: { x: [-98, 246], y: [0, 0] },
};

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
    day: freshDay(''),
    // The key it would like to hear today, or null — see ensureWish().
    wish: null,
    lastSeen: 0,
    totalEarned: 0,
    friends: [], // grown (or set-aside) pets, waiting in the pet book
    dex: {}, // { [species]: { plain: n, rare: n } } — every hatch, ever
    // The memory book — see remember() — and the plan for next time.
    book: freshBook(),
    where: {}, // { [item]: { x, y } } — how far each thing has been dragged
    tips: {}, // hints already taken up, so they stop being offered
    plan: null, // { cue, day } — when the student said they would practise next
    kept: null, // { cue, day } — a plan that was kept, until the room has said so
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
  // A save from before the memory book. It cannot know what was played, so it
  // starts counting now — but it does know who hatched and when, and a student
  // who has been practising for weeks is not told that today's take is their
  // first.
  if (!p.book || typeof p.book !== 'object') {
    p.book = freshBook();
    const before = Boolean(p.pet || p.friends.length || p.totalEarned > 0);
    if (before) p.book.firsts.take = 'before';
    for (const animal of [...p.friends, p.pet].filter(Boolean)) {
      if (!Number.isFinite(animal.born)) continue;
      remember(p, `hatched:${animal.born}`, dayKeyOf(animal.born), { kind: 'hatched', species: animal.species });
      const stage = stageOf(animal);
      if (stage !== 'baby') p.book.firsts[`grew:kid:${animal.born}`] = 'before';
      if (stage === 'grown') p.book.firsts[`grew:grown:${animal.born}`] = 'before';
    }
    p.book.entries.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
    p.book.unseen = 0; // old news is not announced
  } else {
    p.book = { ...freshBook(), ...p.book };
    if (!Array.isArray(p.book.keys)) p.book.keys = [];
    if (!Array.isArray(p.book.entries)) p.book.entries = [];
    if (!p.book.firsts || typeof p.book.firsts !== 'object') p.book.firsts = {};
  }
  if (p.plan && !PLAN_CUES.includes(p.plan.cue)) p.plan = null;
  if (!p.where || typeof p.where !== 'object' || Array.isArray(p.where)) p.where = {};
  for (const id of Object.keys(p.where)) {
    if (ITEM_RANGE[id]) moveItem(p, id, p.where[id] && p.where[id].x, p.where[id] && p.where[id].y);
    else delete p.where[id];
  }
  if (!p.tips || typeof p.tips !== 'object') p.tips = {};
  p.v = 3;
  return p;
}

/**
 * Write a memory down, once. `id` is what makes it a first — the same id is
 * never written twice — and `data` is whatever the page needs to say it.
 */
function remember(p, id, day, data = {}) {
  const book = p.book;
  if (book.firsts[id]) return false;
  book.firsts[id] = day || 'yes';
  book.entries.push({ id, day, ...data });
  if (book.entries.length > BOOK_LIMIT) book.entries.splice(0, book.entries.length - BOOK_LIMIT);
  book.unseen = Math.min(book.entries.length, (book.unseen || 0) + 1);
  return true;
}

/** Is this the id of a real key — 'G', 'Bb', 'F#m' — and not a demo's? */
const isKeyId = (id) => /^[A-G](#|b)?m?$/.test(String(id || ''));

/** A day with any practice in it: counted once, and never as a chain. */
function countDay(p, dayKey, made) {
  const book = p.book;
  if (!dayKey || book.lastDay === dayKey) return;
  book.lastDay = dayKey;
  book.days += 1;
  for (const mark of DAY_MARKS) {
    if (book.days === mark && remember(p, `days:${mark}`, dayKey, { kind: 'days', n: mark })) made.push(`days:${mark}`);
  }
}

/** What a counted take adds to the book. Returns the ids of any new memories. */
function recordTake(p, { kind, id, dayKey, octaves, grew }) {
  const book = p.book;
  const made = [];
  const add = (memId, data) => {
    if (remember(p, memId, dayKey, data)) made.push(memId);
  };
  book.takes += 1;
  countDay(p, dayKey, made);
  add('take', { kind: 'take' });
  if (kind === 'scale' && isKeyId(id)) {
    if (!book.keys.includes(id)) book.keys.push(id);
    add(`key:${id}`, { kind: 'key', key: id });
    if (WISH_KEYS.every((k) => book.keys.includes(k))) add('allMajors', { kind: 'allMajors' });
    if ((Number(octaves) || 1) >= 2) add('twoOctaves', { kind: 'twoOctaves' });
  }
  if (kind === 'sight') add('sight', { kind: 'sight' });
  if (kind === 'sprint') add('sprint', { kind: 'sprint' });
  if (kind === 'trill') add('trill', { kind: 'trill' });
  for (const mark of TAKE_MARKS) {
    if (book.takes === mark) add(`takes:${mark}`, { kind: 'takes', n: mark });
  }
  if (grew && p.pet) add(`grew:${grew}:${p.pet.born}`, { kind: 'grew', stage: grew, name: p.pet.name || '' });
  return made;
}

/** The book at a glance: days and takes, and how many keys have been heard. */
export function bookSummary(pet) {
  const book = pet.book || freshBook();
  const keys = book.keys || [];
  return {
    days: book.days || 0,
    takes: book.takes || 0,
    majors: WISH_KEYS.filter((k) => keys.includes(k)).length,
    minors: keys.filter((k) => /m$/.test(k)).length,
    keys,
    unseen: book.unseen || 0,
  };
}

/** The book has been read: nothing in it is new any more. */
export function bookSeen(pet) {
  if (pet.book) pet.book.unseen = 0;
}

/**
 * "When will I hear you next?" The student's own answer, kept until practice on
 * a later day — at which point it has been kept, whatever the clock said.
 */
export function makePlan(pet, cue, dayKey = dayKeyOf()) {
  if (!PLAN_CUES.includes(cue)) return false;
  pet.plan = { cue, day: dayKey };
  return true;
}

export function clearPlan(pet) {
  pet.plan = null;
}

/** A kept plan the room has not yet been glad about: handed over once. */
export function takeKept(pet) {
  const kept = pet.kept || null;
  pet.kept = null;
  return kept;
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
      // not the empty book a new pet gets: upgrade() has to tell them apart
      book: parsed.book && typeof parsed.book === 'object' ? parsed.book : null,
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
 * Notes are earned by practice. `kind` is 'scale', 'sight' or 'sprint' for a
 * counted take, 'practice' for a day of practice logged by hand, and 'recording'
 * for a take kept to listen back to; `id` is the scale's key for a scale.
 *
 * Returns what was earned in all, the part of it that was the new-key bonus, the
 * part that was the day's wish, whether the egg warmed, and whether the pet grew.
 */
export function earn(pet, { kind = 'scale', id = '', dayKey = '', octaves = 1 } = {}) {
  if (pet.day.key !== dayKey) pet.day = freshDay(dayKey);
  const day = pet.day;
  ensureWish(pet, dayKey);

  // Practice that is not a take: a day logged by hand, and a take kept to listen
  // back to. Each pays once a day, counts towards the same cap, and does not warm
  // the egg or grow the pet — those follow the takes the app itself hears.
  if (kind === 'practice' || kind === 'recording') {
    const flag = kind === 'practice' ? 'practice' : 'recording';
    const nothing = { amount: 0, warmed: false, bonus: 0, grew: null, boosted: false, wished: 0, memories: [], kept: null };
    if (day[flag]) return nothing;
    day[flag] = true;
    const amount = kind === 'practice' ? EARN.practice : EARN.recording;
    credit(pet, day, amount);
    // A day logged by hand is a day of practice in the book as well.
    const memories = [];
    if (kind === 'practice') countDay(pet, dayKey, memories);
    return { ...nothing, amount, memories, kept: kind === 'practice' ? keepPlan(pet, dayKey) : null };
  }

  const fresh =
    (kind === 'scale' && id && !day.keys.includes(id)) ||
    (kind === 'sight' && !day.sight) ||
    (kind === 'sprint' && !day.sprint) ||
    (kind === 'trill' && !day.trill);
  // The new-key bonus stands apart from the cap, so it can be shown on its own.
  const bonus = fresh ? EARN.newKey : 0;
  // The wish: the key it asked for today, paid once — and paid even past the cap,
  // because it is an invitation rather than a wage.
  let wished = 0;
  if (kind === 'scale' && id && pet.wish && pet.wish.key === dayKey && pet.wish.id === id && !pet.wish.done) {
    pet.wish.done = true;
    wished = EARN.wish;
  }
  let base;
  if (day.earned >= DAILY_CAP) {
    base = EARN.afterCap;
  } else {
    // A two-octave scale is twice the playing of a one-octave one, and pays more.
    const extra = kind === 'scale' ? Math.max(0, Math.min(2, (Number(octaves) || 1) - 1)) * EARN.extraOctave : 0;
    base = EARN.take + extra;
    if (!day.any) base += EARN.firstOfDay;
    base = Math.min(base, DAILY_CAP - day.earned + EARN.afterCap);
  }
  const amount = base + bonus + wished;
  day.any = true;
  if (kind === 'scale' && id && !day.keys.includes(id)) day.keys.push(id);
  if (kind === 'sight') day.sight = true;
  if (kind === 'sprint') day.sprint = true;
  if (kind === 'trill') day.trill = true;
  credit(pet, day, amount);

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
  const memories = recordTake(pet, { kind, id, dayKey, octaves, grew });
  return { amount, warmed, bonus, grew, boosted, wished, memories, kept: keepPlan(pet, dayKey) };
}

/**
 * Practice on a later day than the plan was made: the plan was kept. Nothing is
 * paid for it — a plan that earns is a wage, and stops working the day the wage
 * stops — it is only set aside for the room to be glad about.
 */
function keepPlan(pet, dayKey) {
  if (!pet.plan || !dayKey || pet.plan.day === dayKey) return null;
  pet.kept = { cue: pet.plan.cue, day: dayKey };
  pet.plan = null;
  return pet.kept.cue;
}

/** A day's tally, empty. */
function freshDay(dayKey) {
  return {
    key: dayKey,
    earned: 0,
    keys: [],
    sight: false,
    sprint: false,
    any: false,
    practice: false,
    recording: false,
  };
}

/** Notes into the purse and into the day's tally, against the same cap. */
function credit(pet, day, amount) {
  day.earned += amount;
  pet.notes += amount;
  pet.totalEarned = (pet.totalEarned || 0) + amount;
}

/**
 * The key the pet would like to hear today.
 *
 * One a day, chosen at random from the twelve majors and held for the whole day
 * so the room can name it. Granting it pays a bonus; not granting it costs
 * nothing at all, and tomorrow's is a different one — an invitation, never a
 * chore, and never something to lose.
 */
export function ensureWish(pet, dayKey, roll = Math.random) {
  if (pet.wish && pet.wish.key === dayKey) return pet.wish;
  // An egg has no opinions, and a pet with no name has not been introduced yet.
  if (!pet.pet || !pet.pet.name) {
    pet.wish = null;
    return null;
  }
  const id = WISH_KEYS[Math.min(WISH_KEYS.length - 1, Math.floor(roll() * WISH_KEYS.length))];
  pet.wish = { key: dayKey, id, done: false };
  return pet.wish;
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
  if (!pet.book) pet.book = freshBook();
  remember(pet, `hatched:${now}`, dayKeyOf(now), { kind: 'hatched', species: pet.pet.species });
  return true;
}

/**
 * The takes a named pet has already been given, as a head start.
 *
 * The endowed-progress effect: people finish a card that arrives with two stamps
 * on it far more often than one that starts empty (Nunes & Drèze). The first
 * stage of the very first pet therefore begins a little way in — once, at the
 * moment the student names it, never on a rename and never for a later pet, whose
 * egg already arrives warm instead.
 */
export const HEADSTART = 3;

export function name(pet, value) {
  if (!pet.pet) return false;
  const clean = String(value || '').trim().slice(0, 18);
  if (!clean) return false;
  const first = !pet.pet.name;
  pet.pet.name = clean;
  // Only the first animal a student ever names: a later pet already arrives warm
  // as an egg, and a second head start would make the first one mean nothing.
  if (first && !pet.pet.growth && !(pet.friends || []).length) pet.pet.growth = HEADSTART;
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

/** Where a thing in the room has been dragged to, as an offset from its first place. */
export function itemAt(pet, id) {
  const at = pet.where && pet.where[id];
  return { x: (at && at.x) || 0, y: (at && at.y) || 0 };
}

/** Put a thing somewhere else. It stays in the room: the offset is held to its range. */
export function moveItem(pet, id, x, y) {
  const range = ITEM_RANGE[id];
  if (!range) return null;
  const hold = (v, [lo, hi]) => Math.round(Math.min(hi, Math.max(lo, Number(v) || 0)));
  if (!pet.where || typeof pet.where !== 'object') pet.where = {};
  pet.where[id] = { x: hold(x, range.x), y: hold(y, range.y) };
  return pet.where[id];
}

/** Back after a while? The room greets you — gladly, never reproachfully. */
export function visit(pet, now = Date.now()) {
  const away = pet.lastSeen ? now - pet.lastSeen : 0;
  pet.lastSeen = now;
  return { away, longAway: away > 20 * 60 * 60 * 1000 };
}
