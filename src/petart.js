// petart.js — the pet room, drawn in SVG.
//
// Everything is round: big glossy eyes, rosy cheeks, soft outlines. Each pet is
// drawn in its own 100 × 100 box with its feet at y ≈ 96, and every part that
// moves has its own group and class, so CSS can bob, blink and wag it:
//
//   .pet-bob     the whole body breathing (squash and stretch)
//   .pet-head    nods while eating
//   .pet-eyes    open eyes — squashed to a line for a blink
//   .pet-happy   ^ ^ eyes, shown instead while happy
//   .pet-sleep   closed eyes, shown while asleep
//   .pet-tail    wags (the fish's tail fin swishes)
//   .pet-ears    a dog's ears flop, a hamster's twitch
//   .pet-wings   a chick's wings flap
//   .pet-cheeks  a hamster's pouches, which puff up as it eats
//
// The room is 400 × 300: wall to y = 200, floor below.

const INK = '#3b2c22';
const BLUSH = '#ff9a9a';

const PALETTE = {
  cat: { body: '#f7c592', dark: '#9a6338', stripe: '#e9a368', belly: '#fff4e6', inner: '#f8aaa2' },
  dog: { body: '#f4ddc0', dark: '#8a5d3b', ear: '#c08b5c', spot: '#e8c49c', snout: '#fff8ee' },
  hamster: { body: '#f3b76a', dark: '#9a6226', belly: '#fff3df', inner: '#f6a7a0' },
  chicken: { body: '#ffe27c', dark: '#b8891c', wing: '#ffd14a', comb: '#f2665c', beak: '#f7a234' },
  fish: { body: '#ff9e69', dark: '#b9542a', fin: '#ffc79d', scale: '#ffbe93' },
};

const eyes = (lx, rx, y, r = 4.3) => `
  <g class="pet-eyes">
    <circle cx="${lx}" cy="${y}" r="${r}" fill="${INK}"/>
    <circle cx="${rx}" cy="${y}" r="${r}" fill="${INK}"/>
    <circle cx="${lx - r * 0.32}" cy="${y - r * 0.36}" r="${r * 0.36}" fill="#fff"/>
    <circle cx="${rx - r * 0.32}" cy="${y - r * 0.36}" r="${r * 0.36}" fill="#fff"/>
    <circle cx="${lx + r * 0.35}" cy="${y + r * 0.32}" r="${r * 0.16}" fill="#fff"/>
    <circle cx="${rx + r * 0.35}" cy="${y + r * 0.32}" r="${r * 0.16}" fill="#fff"/>
  </g>
  <g class="pet-happy" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round">
    <path d="M${lx - 4} ${y + 1.5} q4 -5.5 8 0"/>
    <path d="M${rx - 4} ${y + 1.5} q4 -5.5 8 0"/>
  </g>
  <g class="pet-sleep" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round">
    <path d="M${lx - 4} ${y} q4 3.5 8 0"/>
    <path d="M${rx - 4} ${y} q4 3.5 8 0"/>
  </g>`;

const blush = (lx, rx, y, rx2 = 4.6) => `
  <ellipse cx="${lx}" cy="${y}" rx="${rx2}" ry="${rx2 * 0.6}" fill="${BLUSH}" opacity=".55"/>
  <ellipse cx="${rx}" cy="${y}" rx="${rx2}" ry="${rx2 * 0.6}" fill="${BLUSH}" opacity=".55"/>`;

const tailStroke = (d, outline, fill, width = 7) => `
  <path d="${d}" fill="none" stroke="${outline}" stroke-width="${width + 4.4}" stroke-linecap="round"/>
  <path d="${d}" fill="none" stroke="${fill}" stroke-width="${width}" stroke-linecap="round"/>`;

const SHAPES = {
  cat(c) {
    return `
      <g class="pet-tail">${tailStroke('M72 84 C94 82 96 60 85 51', c.dark, c.body)}</g>
      <g class="pet-bob">
        <ellipse cx="50" cy="77" rx="25" ry="19" fill="${c.body}" stroke="${c.dark}" stroke-width="2.2"/>
        <ellipse cx="50" cy="81" rx="14" ry="11" fill="${c.belly}"/>
        <ellipse cx="40" cy="93" rx="7.5" ry="4.6" fill="${c.belly}" stroke="${c.dark}" stroke-width="2"/>
        <ellipse cx="60" cy="93" rx="7.5" ry="4.6" fill="${c.belly}" stroke="${c.dark}" stroke-width="2"/>
        <g class="pet-head">
          <path d="M28 38 L30 13 L48 27 Z" fill="${c.body}" stroke="${c.dark}" stroke-width="2.2" stroke-linejoin="round"/>
          <path d="M72 38 L70 13 L52 27 Z" fill="${c.body}" stroke="${c.dark}" stroke-width="2.2" stroke-linejoin="round"/>
          <path d="M32.5 31 L33.5 20 L42.5 27.5 Z" fill="${c.inner}"/>
          <path d="M67.5 31 L66.5 20 L57.5 27.5 Z" fill="${c.inner}"/>
          <ellipse cx="50" cy="45" rx="26" ry="21.5" fill="${c.body}" stroke="${c.dark}" stroke-width="2.2"/>
          <g stroke="${c.stripe}" stroke-width="2.6" stroke-linecap="round">
            <path d="M50 25 v6"/><path d="M43.5 26.5 l1.6 5"/><path d="M56.5 26.5 l-1.6 5"/>
          </g>
          ${eyes(40.5, 59.5, 46)}
          ${blush(32.5, 67.5, 53.5)}
          <path d="M48.3 50.6 h3.4 l-1.7 2 z" fill="${c.inner}" stroke="${c.inner}" stroke-width="1" stroke-linejoin="round"/>
          <path d="M46 53.4 q2 2.6 4 0 q2 2.6 4 0" fill="none" stroke="${INK}" stroke-width="1.7" stroke-linecap="round"/>
          <g stroke="${c.dark}" stroke-width="1.1" stroke-linecap="round" opacity=".55">
            <path d="M29 50 l-10 -2"/><path d="M29 54 l-9.5 2.4"/><path d="M71 50 l10 -2"/><path d="M71 54 l9.5 2.4"/>
          </g>
        </g>
      </g>`;
  },

  dog(c) {
    return `
      <g class="pet-tail">${tailStroke('M72 80 C84 76 87 65 83 57', c.dark, c.body, 7.5)}</g>
      <g class="pet-bob">
        <ellipse cx="50" cy="78" rx="24.5" ry="18" fill="${c.body}" stroke="${c.dark}" stroke-width="2.2"/>
        <ellipse cx="61" cy="73" rx="8" ry="6" fill="${c.spot}"/>
        <ellipse cx="40" cy="93" rx="7.5" ry="4.6" fill="${c.snout}" stroke="${c.dark}" stroke-width="2"/>
        <ellipse cx="60" cy="93" rx="7.5" ry="4.6" fill="${c.snout}" stroke="${c.dark}" stroke-width="2"/>
        <g class="pet-head">
          <ellipse cx="50" cy="44" rx="25" ry="21.5" fill="${c.body}" stroke="${c.dark}" stroke-width="2.2"/>
          <g class="pet-ears">
            <path class="ear-l" d="M31 30 C17 31 14 54 23 61 C30 64 34 50 35 39 Z" fill="${c.ear}" stroke="${c.dark}" stroke-width="2.2" stroke-linejoin="round"/>
            <path class="ear-r" d="M69 30 C83 31 86 54 77 61 C70 64 66 50 65 39 Z" fill="${c.ear}" stroke="${c.dark}" stroke-width="2.2" stroke-linejoin="round"/>
          </g>
          <ellipse cx="61" cy="36" rx="6" ry="4.5" fill="${c.spot}"/>
          ${eyes(40, 60, 43)}
          ${blush(32, 68, 51)}
          <ellipse cx="50" cy="54" rx="11.5" ry="8.5" fill="${c.snout}"/>
          <ellipse cx="50" cy="50.5" rx="4.4" ry="3.2" fill="${INK}"/>
          <circle cx="48.6" cy="49.6" r="1.1" fill="#fff" opacity=".8"/>
          <path d="M50 53.6 v1.6 M45.6 55.4 q2.2 2.6 4.4 0 q2.2 2.6 4.4 0" fill="none" stroke="${INK}" stroke-width="1.7" stroke-linecap="round"/>
          <path class="pet-tongue" d="M48 57.4 q2 4.6 4 0 z" fill="#f47f86"/>
        </g>
      </g>`;
  },

  hamster(c) {
    return `
      <g class="pet-bob">
        <g class="pet-ears">
          <circle cx="29" cy="42" r="7.5" fill="${c.body}" stroke="${c.dark}" stroke-width="2.2"/>
          <circle cx="71" cy="42" r="7.5" fill="${c.body}" stroke="${c.dark}" stroke-width="2.2"/>
          <circle cx="29" cy="42" r="4" fill="${c.inner}"/>
          <circle cx="71" cy="42" r="4" fill="${c.inner}"/>
        </g>
        <ellipse cx="50" cy="67" rx="31" ry="28.5" fill="${c.body}" stroke="${c.dark}" stroke-width="2.2"/>
        <ellipse cx="50" cy="77" rx="20" ry="16.5" fill="${c.belly}"/>
        <g class="pet-head">
          <g class="pet-cheeks">
            <ellipse cx="31" cy="65" rx="9" ry="7.5" fill="${c.belly}"/>
            <ellipse cx="69" cy="65" rx="9" ry="7.5" fill="${c.belly}"/>
          </g>
          ${eyes(40, 60, 58, 4)}
          ${blush(31.5, 68.5, 67, 4.4)}
          <ellipse cx="50" cy="63.6" rx="2.4" ry="1.7" fill="#e98585"/>
          <path d="M47.4 66.4 q1.3 1.7 2.6 0 q1.3 1.7 2.6 0" fill="none" stroke="${INK}" stroke-width="1.5" stroke-linecap="round"/>
        </g>
        <ellipse cx="43" cy="80" rx="4" ry="3" fill="${c.body}" stroke="${c.dark}" stroke-width="1.6"/>
        <ellipse cx="57" cy="80" rx="4" ry="3" fill="${c.body}" stroke="${c.dark}" stroke-width="1.6"/>
        <ellipse cx="37" cy="94" rx="6" ry="3.6" fill="${c.belly}" stroke="${c.dark}" stroke-width="1.8"/>
        <ellipse cx="63" cy="94" rx="6" ry="3.6" fill="${c.belly}" stroke="${c.dark}" stroke-width="1.8"/>
      </g>`;
  },

  chicken(c) {
    return `
      <g stroke="#ea8a25" stroke-width="2.4" stroke-linecap="round" fill="none">
        <path d="M42 89 v6 M42 95 l-4.5 2.4 M42 95 l4.5 2.4"/>
        <path d="M58 89 v6 M58 95 l-4.5 2.4 M58 95 l4.5 2.4"/>
      </g>
      <g class="pet-bob">
        <path d="M40 38 q0 -12 9 -7 q4 -11 11 -1 q8 -4 5 8 z" fill="${c.comb}" stroke="#c4473f" stroke-width="2" stroke-linejoin="round"/>
        <g class="pet-wings">
          <ellipse class="wing-l" cx="23.5" cy="66" rx="8.5" ry="12.5" fill="${c.wing}" stroke="${c.dark}" stroke-width="2"/>
          <ellipse class="wing-r" cx="76.5" cy="66" rx="8.5" ry="12.5" fill="${c.wing}" stroke="${c.dark}" stroke-width="2"/>
        </g>
        <ellipse cx="50" cy="63" rx="28" ry="28.5" fill="${c.body}" stroke="${c.dark}" stroke-width="2.2"/>
        <path d="M44 36.5 q4 -7 8 -3" fill="none" stroke="${c.dark}" stroke-width="2" stroke-linecap="round"/>
        <g class="pet-head">
          ${eyes(40.5, 59.5, 56)}
          ${blush(32, 68, 64)}
          <path d="M45.4 61.4 L54.6 61.4 L50 67.6 Z" fill="${c.beak}" stroke="#d27a1d" stroke-width="1.6" stroke-linejoin="round"/>
        </g>
      </g>`;
  },

  fish(c) {
    // Side on, facing left; the bowl gives it its room.
    return `
      <g class="pet-bob">
        <g class="pet-tail"><path d="M68 50 L88 34 Q83 50 88 66 Z" fill="${c.fin}" stroke="${c.dark}" stroke-width="2.2" stroke-linejoin="round"/></g>
        <path d="M38 36 Q50 22 61 36 Z" fill="${c.fin}" stroke="${c.dark}" stroke-width="2.2" stroke-linejoin="round"/>
        <ellipse cx="48" cy="50" rx="23" ry="17" fill="${c.body}" stroke="${c.dark}" stroke-width="2.2"/>
        <g fill="none" stroke="${c.scale}" stroke-width="2" stroke-linecap="round">
          <path d="M52 44 q3 4 0 8"/><path d="M58 42 q3 5 0 10"/><path d="M58 52 q3 4 0 8"/>
        </g>
        <path d="M46 56 q6 8 12 1 q-5 -2 -12 -1 z" fill="${c.fin}" stroke="${c.dark}" stroke-width="1.8" stroke-linejoin="round"/>
        <g class="pet-head">
          <g class="pet-eyes">
            <circle cx="37" cy="46" r="5.2" fill="${INK}"/>
            <circle cx="35.3" cy="44.2" r="1.9" fill="#fff"/>
            <circle cx="38.8" cy="47.8" r=".9" fill="#fff"/>
          </g>
          <path class="pet-happy" d="M32.6 47 q4.4 -5.6 8.8 0" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>
          <path class="pet-sleep" d="M32.6 46 q4.4 3.6 8.8 0" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>
          <ellipse cx="38" cy="55" rx="4.2" ry="2.6" fill="${BLUSH}" opacity=".55"/>
          <ellipse cx="27" cy="52" rx="2.2" ry="2.6" fill="none" stroke="${INK}" stroke-width="1.6"/>
        </g>
      </g>`;
  },
};

/** One pet, in its own 100 × 100 box. */
export function petMarkup(species) {
  const draw = SHAPES[species] || SHAPES.cat;
  return `<g class="pet pet-${species}">${draw(PALETTE[species] || PALETTE.cat)}</g>`;
}

/** A pet's portrait, as a whole small SVG — for buttons, the toast and the corner buddy. */
export function petIcon(species, label = '') {
  const role = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  return `<svg class="pet-icon" viewBox="0 6 100 94" ${role}>${petMarkup(species)}</svg>`;
}

// ── Eggs ──────────────────────────────────────────────────────────────────

const EGGS = {
  dog: { shell: '#f3dfc4', mark: '#c79566', pattern: 'paws' },
  cat: { shell: '#fbd9de', mark: '#f1a9b5', pattern: 'stripes' },
  hamster: { shell: '#fbe6b9', mark: '#c99a4f', pattern: 'seeds' },
  chicken: { shell: '#fff8ec', mark: '#e3c79c', pattern: 'speckles' },
  fish: { shell: '#cdeef0', mark: '#8fd0d6', pattern: 'scales' },
};

function eggPattern(kind, mark) {
  switch (kind) {
    case 'paws':
      return [
        [42, 50],
        [58, 66],
      ]
        .map(
          ([x, y]) => `
          <g fill="${mark}">
            <ellipse cx="${x}" cy="${y}" rx="4.2" ry="3.6"/>
            <circle cx="${x - 4.6}" cy="${y - 4.4}" r="1.6"/><circle cx="${x - 1.6}" cy="${y - 6.2}" r="1.6"/>
            <circle cx="${x + 1.8}" cy="${y - 6.2}" r="1.6"/><circle cx="${x + 4.8}" cy="${y - 4.4}" r="1.6"/>
          </g>`,
        )
        .join('');
    case 'stripes':
      return `<g fill="none" stroke="${mark}" stroke-width="3.2" stroke-linecap="round">
        <path d="M34 48 q16 6 32 0"/><path d="M31 62 q19 7 38 0"/><path d="M34 76 q16 5 32 0"/></g>`;
    case 'seeds':
      return `<g fill="${mark}">
        ${[
          [40, 46, -20],
          [58, 52, 25],
          [46, 64, 10],
          [62, 72, -15],
          [38, 76, 30],
        ]
          .map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="2.2" ry="4" transform="rotate(${r} ${x} ${y})"/>`)
          .join('')}</g>`;
    case 'speckles':
      return `<g fill="${mark}">
        ${[
          [40, 44, 1.6],
          [57, 48, 1.2],
          [48, 58, 1.8],
          [63, 62, 1.4],
          [37, 66, 1.3],
          [52, 74, 1.5],
          [44, 80, 1.1],
        ]
          .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`)
          .join('')}</g>`;
    case 'scales':
      return `<g fill="none" stroke="${mark}" stroke-width="2.2" stroke-linecap="round">
        <path d="M34 54 q4 5 8 0 q4 5 8 0 q4 5 8 0 q4 5 8 0"/>
        <path d="M32 66 q4 5 8 0 q4 5 8 0 q4 5 8 0 q4 5 8 0 q4 5 8 0"/>
        <path d="M36 78 q4 5 8 0 q4 5 8 0 q4 5 8 0 q4 5 8 0"/></g>`;
    default:
      return '';
  }
}

const EGG_PATH = 'M50 22 C70 22 80 52 80 66 C80 84 66 94 50 94 C34 94 20 84 20 66 C20 52 30 22 50 22 Z';

/**
 * An egg in its own 100 × 100 box. `crack` 0–3 draws the cracks that come with
 * warmth; the top half is its own group so it can fly off when it hatches.
 */
export function eggMarkup(species, crack = 0) {
  const e = EGGS[species] || EGGS.chicken;
  const id = `egg-clip-${species}`;
  const cracks = [
    '',
    'M44 40 l4 5 l-3 4',
    'M44 40 l4 5 l-3 4 M58 52 l-4 4 l3 4 l-3 3',
    'M28 58 l7 -4 l6 5 l7 -5 l6 5 l7 -5 l6 4 l5 -2',
  ];
  return `
    <g class="egg egg-${species}">
      <defs><clipPath id="${id}"><path d="${EGG_PATH}"/></clipPath></defs>
      <ellipse class="egg-shadow" cx="50" cy="95" rx="22" ry="4" fill="rgba(60,40,20,.14)"/>
      <g class="egg-body">
        <path d="${EGG_PATH}" fill="${e.shell}" stroke="#a88a6c" stroke-width="2.2"/>
        <g clip-path="url(#${id})">${eggPattern(e.pattern, e.mark)}</g>
        <ellipse cx="38" cy="40" rx="5" ry="9" fill="#fff" opacity=".55" transform="rotate(20 38 40)"/>
        <path class="egg-crack" d="${cracks[Math.max(0, Math.min(3, crack))]}" fill="none" stroke="#7a5d43" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      </g>
    </g>`;
}

/** The two halves of an egg breaking open, for the hatching moment. */
export function eggHalves(species) {
  const e = EGGS[species] || EGGS.chicken;
  const zig = 'L28 58 L35 54 L41 59 L48 54 L54 59 L61 54 L67 58 L72 56';
  return `
    <g class="egg-bottom">
      <path d="M20 66 C20 62 22 59 24 57 ${zig} C78 59 80 62 80 66 C80 84 66 94 50 94 C34 94 20 84 20 66 Z" fill="${e.shell}" stroke="#a88a6c" stroke-width="2.2" stroke-linejoin="round"/>
    </g>
    <g class="egg-top">
      <path d="M24 57 ${zig} C76 46 68 22 50 22 C32 22 24 46 24 57 Z" fill="${e.shell}" stroke="#a88a6c" stroke-width="2.2" stroke-linejoin="round"/>
    </g>`;
}

// ── Food ──────────────────────────────────────────────────────────────────

const FOOD = {
  berry: `<path d="M50 44 C62 44 66 56 58 66 C54 71 46 71 42 66 C34 56 38 44 50 44 Z" fill="#f2546a" stroke="#b9324a" stroke-width="2"/>
    <g fill="#ffe08a"><circle cx="46" cy="53" r="1.1"/><circle cx="54" cy="52" r="1.1"/><circle cx="50" cy="59" r="1.1"/><circle cx="45" cy="61" r="1"/><circle cx="55" cy="60" r="1"/></g>
    <path d="M42 45 q8 -8 16 0 q-8 3 -16 0 z" fill="#5fae5b" stroke="#3d8a3e" stroke-width="1.6"/>`,
  cookie: `<circle cx="50" cy="56" r="14" fill="#e6b36f" stroke="#a8743b" stroke-width="2"/>
    <g fill="#6b4226"><circle cx="45" cy="51" r="2.2"/><circle cx="55" cy="54" r="2.2"/><circle cx="48" cy="61" r="2"/><circle cx="56" cy="62" r="1.6"/></g>`,
  cake: `<path d="M34 64 L50 44 L66 64 Z" fill="#fff4e6" stroke="#c99b76" stroke-width="2" stroke-linejoin="round"/>
    <path d="M34 64 L66 64 L66 70 L34 70 Z" fill="#f6b2c0" stroke="#c99b76" stroke-width="2"/>
    <path d="M40 57 L60 57" stroke="#f6b2c0" stroke-width="3"/><circle cx="50" cy="43" r="3.6" fill="#f2546a"/>`,
  fishtreat: `<path d="M34 56 C40 46 56 46 62 56 C56 66 40 66 34 56 Z" fill="#9cc7e0" stroke="#5d8fae" stroke-width="2"/>
    <path d="M62 56 L70 49 L70 63 Z" fill="#9cc7e0" stroke="#5d8fae" stroke-width="2" stroke-linejoin="round"/><circle cx="42" cy="54" r="1.6" fill="#2c3e50"/>`,
  bone: `<g fill="#c7a882"><circle cx="36" cy="49" r="5.6"/><circle cx="36" cy="58" r="5.6"/><circle cx="64" cy="49" r="5.6"/><circle cx="64" cy="58" r="5.6"/></g>
    <path d="M36 53.5 h28" stroke="#c7a882" stroke-width="10" stroke-linecap="round"/>
    <g fill="#fff6e8"><circle cx="36" cy="49" r="3.8"/><circle cx="36" cy="58" r="3.8"/><circle cx="64" cy="49" r="3.8"/><circle cx="64" cy="58" r="3.8"/></g>
    <path d="M36 53.5 h28" stroke="#fff6e8" stroke-width="6.6" stroke-linecap="round"/>`,
  seeds: `<g fill="#8a6a4a" stroke="#4e3a28" stroke-width="1.2">${[
    [42, 56, -30],
    [50, 52, 10],
    [58, 57, 35],
    [46, 62, 60],
    [55, 63, -10],
  ]
    .map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="2.8" ry="5" transform="rotate(${r} ${x} ${y})"/>`)
    .join('')}</g>`,
  corn: `<ellipse cx="50" cy="56" rx="8" ry="15" fill="#ffd34d" stroke="#d49a1c" stroke-width="2"/>
    <g fill="#f5b81f">${[48, 54, 60, 66].map((y) => `<circle cx="47" cy="${y - 4}" r="1.6"/><circle cx="53" cy="${y - 4}" r="1.6"/>`).join('')}</g>
    <path d="M42 66 q-6 -10 -2 -20 q6 10 10 24 z M58 66 q6 -10 2 -20 q-6 10 -10 24 z" fill="#7cc16a" stroke="#4f9a44" stroke-width="1.6"/>`,
  flakes: `<g fill="#f59a5a" stroke="#c66a30" stroke-width="1.2">
    <path d="M40 50 l6 -2 l2 5 l-6 2 z"/><path d="M52 46 l6 1 l-1 5 l-6 -1 z"/><path d="M46 58 l6 -1 l1 5 l-6 1 z"/><path d="M58 56 l5 3 l-3 4 l-5 -3 z"/></g>`,
};

/** A snack in its own 100 × 100 box (it sits centred around 50, 56). */
export function foodMarkup(look) {
  return `<g class="food food-${look}">${FOOD[look] || FOOD.cookie}</g>`;
}

export function foodIcon(look) {
  return `<svg class="food-icon" viewBox="28 36 46 40" aria-hidden="true">${foodMarkup(look)}</svg>`;
}

// ── The room ──────────────────────────────────────────────────────────────

const WALLS = {
  plain: { fill: '#fbf1e2', pattern: '' },
  'wall-mint': {
    fill: 'url(#wall-mint)',
    pattern: `<pattern id="wall-mint" width="28" height="200" patternUnits="userSpaceOnUse">
      <rect width="28" height="200" fill="#e4f3ea"/><rect width="12" height="200" fill="#d3ebde"/></pattern>`,
  },
  'wall-dots': {
    fill: 'url(#wall-dots)',
    pattern: `<pattern id="wall-dots" width="26" height="26" patternUnits="userSpaceOnUse">
      <rect width="26" height="26" fill="#fde9ec"/><circle cx="6.5" cy="6.5" r="3" fill="#f8c9d1"/><circle cx="19.5" cy="19.5" r="3" fill="#f8c9d1"/></pattern>`,
  },
  'wall-stars': {
    fill: 'url(#wall-stars)',
    pattern: `<pattern id="wall-stars" width="44" height="44" patternUnits="userSpaceOnUse">
      <rect width="44" height="44" fill="#dfe8fb"/>
      <path d="M11 6 l1.8 3.8 l4.2 .5 l-3.1 2.9 l.8 4.1 l-3.7 -2 l-3.7 2 l.8 -4.1 l-3.1 -2.9 l4.2 -.5 z" fill="#fff6c9"/>
      <path d="M33 26 l1.3 2.7 l3 .4 l-2.2 2.1 l.6 2.9 l-2.7 -1.4 l-2.7 1.4 l.6 -2.9 l-2.2 -2.1 l3 -.4 z" fill="#fff6c9"/></pattern>`,
  },
};

function sky(hour) {
  if (hour >= 7 && hour < 17) return { sky: '#bfe4f7', night: false, tint: '#e9f6fd' };
  if (hour >= 17 && hour < 20) return { sky: '#f9c39a', night: false, tint: '#fde0c8' };
  if (hour >= 5 && hour < 7) return { sky: '#f7d3c4', night: false, tint: '#fbe8de' };
  return { sky: '#34407a', night: true, tint: '#4b5899' };
}

const ITEM_ART = {
  window(hour) {
    const s = sky(hour);
    const extras = s.night
      ? `<circle cx="116" cy="62" r="9" fill="#fff4c2"/><circle cx="120" cy="59" r="8" fill="${s.sky}"/>
         <g fill="#fff">${[
           [66, 58],
           [88, 76],
           [104, 92],
           [74, 96],
         ]
           .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.4"/>`)
           .join('')}</g>`
      : `<g class="cloud" fill="#fff" opacity=".95"><ellipse cx="80" cy="70" rx="14" ry="7"/><ellipse cx="90" cy="65" rx="10" ry="7"/><ellipse cx="72" cy="66" rx="8" ry="6"/></g>
         <g class="cloud cloud-2" fill="#fff" opacity=".8"><ellipse cx="112" cy="94" rx="10" ry="5"/><ellipse cx="118" cy="90" rx="7" ry="5"/></g>`;
    return `
      <g class="room-window">
        <rect x="54" y="44" width="84" height="74" rx="8" fill="${s.sky}"/>
        <clipPath id="win-clip"><rect x="54" y="44" width="84" height="74" rx="8"/></clipPath>
        <g clip-path="url(#win-clip)">${extras}
          <path d="M54 118 q20 -16 42 -6 q22 -14 42 0 v10 h-84 z" fill="${s.night ? '#2d5a4a' : '#9fd39a'}"/></g>
        <rect x="54" y="44" width="84" height="74" rx="8" fill="none" stroke="#fff" stroke-width="7"/>
        <path d="M96 44 v74 M54 81 h84" stroke="#fff" stroke-width="4"/>
        <rect x="48" y="117" width="96" height="7" rx="3.5" fill="#f0e2cc"/>
        <path d="M50 40 q22 30 10 82 l-10 0 z" fill="#f7b9b0" opacity=".9"/>
        <path d="M142 40 q-22 30 -10 82 l10 0 z" fill="#f7b9b0" opacity=".9"/>
      </g>`;
  },
  picture: () => `
    <g class="room-picture">
      <rect x="282" y="54" width="54" height="66" rx="5" fill="#fff8ee" stroke="#c49a6c" stroke-width="5"/>
      <g transform="translate(309 87) rotate(-18)">
        <path d="M0 -24 c7 0 9 6 6 10 c-2 3 -2 5 1 8 c4 5 2 15 -7 15 c-9 0 -11 -10 -7 -15 c3 -3 3 -5 1 -8 c-3 -4 -1 -10 6 -10 z" fill="#c9773b" stroke="#8a4b20" stroke-width="1.6"/>
        <path d="M0 -36 v44" stroke="#3b2c22" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M-2.4 -6 h4.8 M-2.4 -2 h4.8" stroke="#3b2c22" stroke-width="1"/>
      </g>
      <path d="M318 66 q4 -4 8 0 v12" fill="none" stroke="#3b2c22" stroke-width="1.6"/>
      <circle cx="316" cy="79" r="2.6" fill="#3b2c22"/>
    </g>`,
  bunting: () => {
    const colors = ['#f6a4a4', '#ffd97a', '#a6d8c1', '#a9c8f0', '#f3b7e1'];
    const flags = Array.from({ length: 11 }, (_, i) => {
      const x = 22 + i * 34;
      const y = 18 + Math.sin((i / 10) * Math.PI) * 14;
      return `<path d="M${x - 10} ${y} L${x + 10} ${y} L${x} ${y + 20} Z" fill="${colors[i % colors.length]}"/>`;
    }).join('');
    return `<g class="room-bunting"><path d="M8 16 Q200 46 392 16" fill="none" stroke="#c9a77d" stroke-width="2"/>${flags}</g>`;
  },
  lamp: () => `
    <g class="room-lamp">
      <ellipse cx="364" cy="268" rx="18" ry="5" fill="rgba(60,40,20,.12)"/>
      <path d="M364 266 v-112" stroke="#8b6a4c" stroke-width="4" stroke-linecap="round"/>
      <ellipse cx="364" cy="266" rx="14" ry="4" fill="#8b6a4c"/>
      <path d="M344 156 L384 156 L376 128 L352 128 Z" fill="#ffd98f" stroke="#d6a654" stroke-width="2" stroke-linejoin="round"/>
      <path class="lamp-glow" d="M344 156 L384 156 L404 230 L324 230 Z" fill="#fff1c4" opacity=".28"/>
    </g>`,
  plant: () => `
    <g class="room-plant">
      <ellipse cx="34" cy="268" rx="20" ry="5" fill="rgba(60,40,20,.12)"/>
      <g class="plant-leaves" fill="#79bf7a" stroke="#4d9a52" stroke-width="2" stroke-linejoin="round">
        <path d="M34 226 C18 218 12 196 20 186 C30 196 34 210 34 226 Z"/>
        <path d="M34 226 C50 218 56 196 48 186 C38 196 34 210 34 226 Z"/>
        <path d="M34 228 C30 206 32 190 36 176 C42 192 40 210 34 228 Z" fill="#8fd08c"/>
      </g>
      <path d="M18 226 L50 226 L46 266 L22 266 Z" fill="#e7956b" stroke="#b9663f" stroke-width="2" stroke-linejoin="round"/>
      <rect x="15" y="222" width="38" height="9" rx="3" fill="#f2a77d" stroke="#b9663f" stroke-width="2"/>
    </g>`,
  rug: () => `
    <g class="room-rug">
      <ellipse cx="200" cy="262" rx="118" ry="22" fill="#f6c9c1"/>
      <ellipse cx="200" cy="262" rx="96" ry="15" fill="none" stroke="#fbe2dc" stroke-width="5" stroke-dasharray="2 9" stroke-linecap="round"/>
    </g>`,
  bed: () => `
    <g class="room-bed">
      <ellipse cx="296" cy="272" rx="44" ry="8" fill="rgba(60,40,20,.12)"/>
      <path d="M254 262 C254 236 338 236 338 262 C338 278 254 278 254 262 Z" fill="#a8cbe8" stroke="#6f9bc2" stroke-width="2.2"/>
      <ellipse cx="296" cy="260" rx="32" ry="9" fill="#e6f1fb"/>
    </g>`,
  ball: () => `
    <g class="room-ball">
      <circle cx="0" cy="0" r="9" fill="#ff7d7d" stroke="#c94d55" stroke-width="2"/>
      <path d="M-9 0 q9 -6 18 0" fill="none" stroke="#fff" stroke-width="2.4"/>
      <circle cx="-3" cy="-4" r="2" fill="#fff" opacity=".7"/>
    </g>`,
  stand: () => `
    <g class="room-stand">
      <ellipse cx="96" cy="268" rx="20" ry="5" fill="rgba(60,40,20,.12)"/>
      <path d="M96 266 v-74 M84 266 l12 -12 l12 12" stroke="#4a4038" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M74 166 L118 166 L114 196 L78 196 Z" fill="#fffdf6" stroke="#4a4038" stroke-width="2.4" stroke-linejoin="round"/>
      <g stroke="#8b8277" stroke-width=".9">${[172, 177, 182, 187].map((y) => `<path d="M80 ${y} h32"/>`).join('')}</g>
      <g fill="#3b2c22"><circle cx="86" cy="177" r="1.6"/><circle cx="94" cy="174.5" r="1.6"/><circle cx="103" cy="182" r="1.6"/></g>
    </g>`,
  bowl: (fullness = 0) => `
    <g class="room-bowl">
      <ellipse cx="126" cy="274" rx="20" ry="4.5" fill="rgba(60,40,20,.12)"/>
      <path d="M108 262 L144 262 L139 273 L113 273 Z" fill="#9ccbb6" stroke="#5f9a82" stroke-width="2" stroke-linejoin="round"/>
      <ellipse cx="126" cy="262" rx="18" ry="3.6" fill="#7db79d" stroke="#5f9a82" stroke-width="2"/>
      <text x="126" y="270.5" text-anchor="middle" font-size="7" fill="#fff" font-family="sans-serif">♥</text>
      <g class="bowl-food"></g>
    </g>`,
};

/** The fish's bowl, on a little table in the middle of the room. */
function fishbowl() {
  return `
    <g class="room-fishbowl">
      <ellipse cx="200" cy="276" rx="56" ry="7" fill="rgba(60,40,20,.12)"/>
      <path d="M160 222 h80 l-6 52 h-68 z" fill="#d9a979" stroke="#a9774c" stroke-width="2.2" stroke-linejoin="round"/>
      <rect x="152" y="214" width="96" height="11" rx="4" fill="#e7bd8f" stroke="#a9774c" stroke-width="2.2"/>
      <clipPath id="bowl-clip"><circle cx="200" cy="160" r="56"/></clipPath>
      <circle cx="200" cy="160" r="56" fill="#e9f7fb" opacity=".9"/>
      <g clip-path="url(#bowl-clip)">
        <rect x="140" y="124" width="120" height="100" fill="#a9dcef" opacity=".75"/>
        <path d="M140 124 q15 -5 30 0 t30 0 t30 0 t30 0" fill="none" stroke="#ffffff" stroke-width="2" opacity=".8"/>
        <path d="M140 210 q30 -12 60 -4 q30 -10 60 2 v20 h-120 z" fill="#f3dfb5"/>
        <g fill="#6fbf7d" stroke="#4b9a5a" stroke-width="1.6">
          <path class="weed" d="M168 210 q-8 -18 2 -34 q6 14 -2 34 z"/>
          <path class="weed weed-2" d="M232 212 q8 -22 -2 -40 q-6 16 2 40 z"/>
        </g>
        <g class="pebbles" fill="#f6b5a8"><circle cx="186" cy="208" r="3.4"/><circle cx="194" cy="210" r="2.6"/><circle cx="214" cy="208" r="3"/></g>
        <g class="bowl-flakes"></g>
      </g>
      <circle cx="200" cy="160" r="56" fill="none" stroke="#8fbfd1" stroke-width="3"/>
      <path d="M170 116 q-14 12 -16 34" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" opacity=".8"/>
      <ellipse cx="200" cy="104" rx="30" ry="5" fill="none" stroke="#8fbfd1" stroke-width="3"/>
    </g>`;
}

/**
 * The room, without the pet (the pet is added by the room controller so it can
 * move). `placed` is the list of decorations put out; `wall` the wallpaper.
 */
export function roomMarkup({ placed = [], wall = null, fish = false, hour = new Date().getHours() } = {}) {
  const w = WALLS[wall] || WALLS.plain;
  const has = (id) => placed.includes(id);
  const night = sky(hour).night;
  return `
    <defs>
      ${w.pattern}
      <linearGradient id="floor-grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#ecc99c"/><stop offset="1" stop-color="#e0b886"/>
      </linearGradient>
    </defs>
    <rect class="room-wall" x="0" y="0" width="400" height="206" fill="${w.fill}"/>
    <radialGradient id="wall-light" cx=".5" cy=".35" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <rect x="0" y="0" width="400" height="206" fill="url(#wall-light)" pointer-events="none"/>
    ${has('window') ? ITEM_ART.window(hour) : ''}
    ${has('picture') ? ITEM_ART.picture() : ''}
    ${has('bunting') ? ITEM_ART.bunting() : ''}
    <rect x="0" y="200" width="400" height="100" fill="url(#floor-grad)"/>
    <g stroke="#d4a874" stroke-width="1.4" opacity=".7">
      <path d="M0 226 H400 M0 254 H400 M0 284 H400"/>
      <path d="M70 200 v26 M190 200 v26 M310 200 v26 M30 226 v28 M150 226 v28 M270 226 v28 M370 226 v28 M100 254 v30 M230 254 v30 M340 254 v30"/>
    </g>
    <rect x="0" y="196" width="400" height="9" fill="#f6e7d2"/>
    <rect x="0" y="204" width="400" height="2" fill="#d9bc93"/>
    ${has('rug') ? ITEM_ART.rug() : ''}
    ${has('lamp') ? ITEM_ART.lamp() : ''}
    ${has('plant') ? ITEM_ART.plant() : ''}
    ${has('stand') ? ITEM_ART.stand() : ''}
    ${has('bed') && !fish ? ITEM_ART.bed() : ''}
    ${fish ? fishbowl() : ITEM_ART.bowl()}
    ${night && has('lamp') ? '' : ''}
    ${night ? '<rect class="room-night" x="0" y="0" width="400" height="300" fill="#1d2550" opacity=".12" pointer-events="none"/>' : ''}`;
}

export function ballMarkup() {
  return ITEM_ART.ball();
}

/** A small picture of a decoration, for the shop. */
export function itemIcon(id) {
  const views = {
    window: '46 38 104 90',
    picture: '276 48 66 78',
    bunting: '0 8 400 60',
    lamp: '320 122 90 150',
    plant: '8 170 56 104',
    rug: '76 236 248 52',
    bed: '248 232 96 48',
    ball: '-12 -12 24 24',
    stand: '68 160 56 112',
  };
  if (id.startsWith('wall-')) {
    const w = WALLS[id];
    return `<svg class="item-icon" viewBox="0 0 60 44" aria-hidden="true"><defs>${w.pattern}</defs>
      <rect width="60" height="44" rx="6" fill="${w.fill}"/></svg>`;
  }
  const art = id === 'window' ? ITEM_ART.window(12) : ITEM_ART[id] ? ITEM_ART[id]() : '';
  return `<svg class="item-icon" viewBox="${views[id] || '0 0 400 300'}" aria-hidden="true">${art}</svg>`;
}

/** A heart, centred on 0, 0. */
export const HEART = 'M0 4 C-7 -2 -7 -9 -2.5 -9 C-0.8 -9 0 -7.6 0 -6.6 C0 -7.6 0.8 -9 2.5 -9 C7 -9 7 -2 0 4 Z';
