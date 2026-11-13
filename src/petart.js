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
  rabbit: { body: '#f6ede2', dark: '#9c8672', belly: '#ffffff', inner: '#f8b5b5' },
  koala: { body: '#c5c9d1', dark: '#6f7682', belly: '#eef0f3', inner: '#f3b9c0', nose: '#4a4550' },
  penguin: { body: '#5b6f95', dark: '#33415f', belly: '#ffffff', beak: '#f7a234', wing: '#4b5d82' },
  fox: { body: '#f39a52', dark: '#a3541f', belly: '#fff6ea', tip: '#5a3a28' },
};

// The rare colours: a hatchling now and then comes out in one of these. Same
// shapes, same keys — only the paint differs.
const RARE = {
  cat: { body: '#d9cff0', dark: '#6d5c94', stripe: '#bba9e0', belly: '#f8f5ff', inner: '#f3a9c4' },
  dog: { body: '#d6e8f7', dark: '#47678a', ear: '#8fb2d6', spot: '#b4d0ea', snout: '#f7fbff' },
  hamster: { body: '#f6f1ea', dark: '#8b7d6b', belly: '#ffffff', inner: '#f6a7a0' },
  chicken: { body: '#d3ecff', dark: '#4a78a8', wing: '#acd2fa', comb: '#f2665c', beak: '#f7a234' },
  fish: { body: '#8fd3ff', dark: '#2e7bb0', fin: '#c8ebff', scale: '#b8e3ff' },
  rabbit: { body: '#f9d5e0', dark: '#b06a85', belly: '#fff3f7', inner: '#f48fb1' },
  koala: { body: '#f3e2c0', dark: '#a5844a', belly: '#fff8e8', inner: '#f3b9c0', nose: '#6b4a2a' },
  penguin: { body: '#b79be0', dark: '#6d4fa3', belly: '#ffffff', beak: '#f7a234', wing: '#a488d2' },
  fox: { body: '#e6eef7', dark: '#6f87a3', belly: '#ffffff', tip: '#9fb4cc' },
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

  rabbit(c) {
    return `
      <circle cx="73" cy="83" r="6.5" fill="${c.belly}" stroke="${c.dark}" stroke-width="2"/>
      <g class="pet-bob">
        <ellipse cx="50" cy="78" rx="23.5" ry="18" fill="${c.body}" stroke="${c.dark}" stroke-width="2.2"/>
        <ellipse cx="50" cy="82" rx="13" ry="10.5" fill="${c.belly}"/>
        <ellipse cx="40" cy="93" rx="8" ry="4.6" fill="${c.belly}" stroke="${c.dark}" stroke-width="2"/>
        <ellipse cx="60" cy="93" rx="8" ry="4.6" fill="${c.belly}" stroke="${c.dark}" stroke-width="2"/>
        <g class="pet-head">
          <g class="pet-ears">
            <path d="M33 34 C25 12 31 -1 38 2 C45 5 46 20 44 31 Z" fill="${c.body}" stroke="${c.dark}" stroke-width="2.2" stroke-linejoin="round"/>
            <path d="M67 34 C75 12 69 -1 62 2 C55 5 54 20 56 31 Z" fill="${c.body}" stroke="${c.dark}" stroke-width="2.2" stroke-linejoin="round"/>
            <path d="M36 28 C32 16 34 8 37.5 8 C41 9 41.5 19 40.5 28 Z" fill="${c.inner}"/>
            <path d="M64 28 C68 16 66 8 62.5 8 C59 9 58.5 19 59.5 28 Z" fill="${c.inner}"/>
          </g>
          <ellipse cx="50" cy="47" rx="24.5" ry="20.5" fill="${c.body}" stroke="${c.dark}" stroke-width="2.2"/>
          ${eyes(41, 59, 46)}
          ${blush(33, 67, 53.5)}
          <path d="M48.2 50.8 h3.6 l-1.8 2.1 z" fill="${c.inner}" stroke="${c.inner}" stroke-width="1" stroke-linejoin="round"/>
          <path d="M46 54 q2 2.4 4 0 q2 2.4 4 0" fill="none" stroke="${INK}" stroke-width="1.7" stroke-linecap="round"/>
          <path d="M48.4 55.2 h3.2 v3 q-1.6 1 -3.2 0 z" fill="#fff" stroke="${c.dark}" stroke-width=".9" stroke-linejoin="round"/>
        </g>
      </g>`;
  },

  koala(c) {
    return `
      <g class="pet-bob">
        <ellipse cx="50" cy="79" rx="23" ry="17.5" fill="${c.body}" stroke="${c.dark}" stroke-width="2.2"/>
        <ellipse cx="50" cy="83" rx="13" ry="10" fill="${c.belly}"/>
        <ellipse cx="40" cy="93" rx="7.5" ry="4.6" fill="${c.body}" stroke="${c.dark}" stroke-width="2"/>
        <ellipse cx="60" cy="93" rx="7.5" ry="4.6" fill="${c.body}" stroke="${c.dark}" stroke-width="2"/>
        <g class="pet-head">
          <g class="pet-ears">
            <circle cx="26" cy="33" r="12" fill="${c.body}" stroke="${c.dark}" stroke-width="2.2"/>
            <circle cx="74" cy="33" r="12" fill="${c.body}" stroke="${c.dark}" stroke-width="2.2"/>
            <circle cx="26.5" cy="34" r="6.5" fill="${c.inner}"/>
            <circle cx="73.5" cy="34" r="6.5" fill="${c.inner}"/>
          </g>
          <ellipse cx="50" cy="46" rx="25.5" ry="21" fill="${c.body}" stroke="${c.dark}" stroke-width="2.2"/>
          ${eyes(39, 61, 45)}
          ${blush(31.5, 68.5, 53)}
          <ellipse cx="50" cy="50" rx="5.2" ry="6.6" fill="${c.nose}"/>
          <ellipse cx="48.4" cy="47" rx="1.5" ry="2" fill="#fff" opacity=".55"/>
          <path d="M46.6 58.4 q3.4 2.6 6.8 0" fill="none" stroke="${INK}" stroke-width="1.7" stroke-linecap="round"/>
        </g>
      </g>`;
  },

  penguin(c) {
    return `
      <g fill="${c.beak}" stroke="#d27a1d" stroke-width="1.8" stroke-linejoin="round">
        <ellipse cx="40" cy="94" rx="8" ry="3.6"/><ellipse cx="60" cy="94" rx="8" ry="3.6"/>
      </g>
      <g class="pet-bob">
        <g class="pet-wings">
          <path class="wing-l" d="M27 52 C15 60 14 76 21 82 C27 78 30 66 31 56 Z" fill="${c.wing}" stroke="${c.dark}" stroke-width="2" stroke-linejoin="round"/>
          <path class="wing-r" d="M73 52 C85 60 86 76 79 82 C73 78 70 66 69 56 Z" fill="${c.wing}" stroke="${c.dark}" stroke-width="2" stroke-linejoin="round"/>
        </g>
        <path d="M50 20 C70 20 77 42 77 62 C77 82 66 93 50 93 C34 93 23 82 23 62 C23 42 30 20 50 20 Z" fill="${c.body}" stroke="${c.dark}" stroke-width="2.2"/>
        <path d="M50 37 C41 30 31 37 32.5 49 C29 62 33 89 50 89 C67 89 71 62 67.5 49 C69 37 59 30 50 37 Z" fill="${c.belly}"/>
        <g class="pet-head">
          ${eyes(41, 59, 46)}
          ${blush(34, 66, 54)}
          <path d="M45 50.6 L55 50.6 L50 57 Z" fill="${c.beak}" stroke="#d27a1d" stroke-width="1.6" stroke-linejoin="round"/>
        </g>
      </g>`;
  },

  fox(c) {
    return `
      <g class="pet-tail">
        <path d="M70 86 C96 88 99 62 86 50 C83 62 78 72 68 76 Z" fill="${c.body}" stroke="${c.dark}" stroke-width="2.2" stroke-linejoin="round"/>
        <path d="M86 50 C92 56 94 63 92 70 C88 66 85 60 83.5 57 Z" fill="${c.belly}"/>
      </g>
      <g class="pet-bob">
        <ellipse cx="50" cy="78" rx="23.5" ry="18" fill="${c.body}" stroke="${c.dark}" stroke-width="2.2"/>
        <ellipse cx="50" cy="82" rx="12.5" ry="10.5" fill="${c.belly}"/>
        <ellipse cx="40" cy="93" rx="7.5" ry="4.6" fill="${c.tip}" stroke="${c.dark}" stroke-width="2"/>
        <ellipse cx="60" cy="93" rx="7.5" ry="4.6" fill="${c.tip}" stroke="${c.dark}" stroke-width="2"/>
        <g class="pet-head">
          <path d="M26 40 L27 10 L48 28 Z" fill="${c.body}" stroke="${c.dark}" stroke-width="2.2" stroke-linejoin="round"/>
          <path d="M74 40 L73 10 L52 28 Z" fill="${c.body}" stroke="${c.dark}" stroke-width="2.2" stroke-linejoin="round"/>
          <path d="M30.5 30 L31 18 L41 27 Z" fill="${c.tip}"/>
          <path d="M69.5 30 L69 18 L59 27 Z" fill="${c.tip}"/>
          <path d="M50 25 C66 25 78 36 77 47 C76 57 62 66 50 67 C38 66 24 57 23 47 C22 36 34 25 50 25 Z" fill="${c.body}" stroke="${c.dark}" stroke-width="2.2" stroke-linejoin="round"/>
          <path d="M25 49 C32 49 40 53 50 53 C60 53 68 49 75 49 C73 58 61 65.2 50 66 C39 65.2 27 58 25 49 Z" fill="${c.belly}"/>
          ${eyes(40, 60, 44)}
          ${blush(32, 68, 55)}
          <ellipse cx="50" cy="54.4" rx="3.4" ry="2.5" fill="${INK}"/>
          <path d="M46 58.6 q2 2.4 4 0 q2 2.4 4 0" fill="none" stroke="${INK}" stroke-width="1.7" stroke-linecap="round"/>
        </g>
      </g>`;
  },
};

/** One pet, in its own 100 × 100 box. `variant` is 'plain' or 'rare'. */
export function petMarkup(species, variant = 'plain') {
  const draw = SHAPES[species] || SHAPES.cat;
  const paint = (variant === 'rare' ? RARE : PALETTE)[species] || PALETTE.cat;
  return `<g class="pet pet-${species}${variant === 'rare' ? ' is-rare' : ''}">${draw(paint)}</g>`;
}

/** A pet's portrait, as a whole small SVG — for buttons, the toast and the corner buddy. */
export function petIcon(species, label = '', variant = 'plain') {
  const role = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
  return `<svg class="pet-icon" viewBox="0 6 100 94" ${role}>${petMarkup(species, variant)}</svg>`;
}

/** A pet not yet found, for the pet book: its outline, filled in one flat colour. */
export function petSilhouette(species) {
  return `<svg class="pet-icon is-unknown" viewBox="0 6 100 94" aria-hidden="true"><g class="pet-shadow">${petMarkup(species)}</g></svg>`;
}

/** How big each stage stands, against the grown-up size. */
export const STAGE_SCALE = { baby: 0.66, kid: 0.83, grown: 1 };

// ── Eggs ──────────────────────────────────────────────────────────────────

const EGGS = {
  dog: { shell: '#f3dfc4', mark: '#c79566', pattern: 'paws' },
  cat: { shell: '#fbd9de', mark: '#f1a9b5', pattern: 'stripes' },
  hamster: { shell: '#fbe6b9', mark: '#c99a4f', pattern: 'seeds' },
  chicken: { shell: '#fff8ec', mark: '#e3c79c', pattern: 'speckles' },
  fish: { shell: '#cdeef0', mark: '#8fd0d6', pattern: 'scales' },
  rabbit: { shell: '#e7f3dc', mark: '#f2994a', pattern: 'carrots' },
  koala: { shell: '#e6e9ee', mark: '#7fb98a', pattern: 'leaves' },
  penguin: { shell: '#cfe0f5', mark: '#ffffff', pattern: 'snow' },
  fox: { shell: '#fde3c8', mark: '#ee8f4a', pattern: 'zigzag' },
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
    case 'carrots':
      return [
        [40, 44, -18],
        [60, 54, 20],
        [42, 68, 12],
        [61, 78, -14],
      ]
        .map(
          ([x, y, r]) => `<g transform="rotate(${r} ${x} ${y})"><path d="M${x - 3} ${y - 3} h6 l-3 10 z" fill="${mark}"/>
            <path d="M${x} ${y - 3} l-2 -4 M${x} ${y - 3} v-4.6 M${x} ${y - 3} l2 -4" stroke="#6fae69" stroke-width="1.5" stroke-linecap="round"/></g>`,
        )
        .join('');
    case 'leaves':
      return `<g fill="${mark}">${[
        [40, 46, -35],
        [59, 50, 30],
        [47, 62, 80],
        [62, 70, -20],
        [38, 74, 20],
        [52, 80, -60],
      ]
        .map(([x, y, r]) => `<path d="M${x} ${y - 6} q5 6 0 12 q-5 -6 0 -12 z" transform="rotate(${r} ${x} ${y})"/>`)
        .join('')}</g>`;
    case 'snow':
      return `<g stroke="${mark}" stroke-width="1.7" stroke-linecap="round">${[
        [40, 46, 4.2],
        [60, 52, 3.4],
        [46, 64, 3.8],
        [63, 72, 4.2],
        [37, 76, 3.2],
        [52, 82, 3],
      ]
        .map(([x, y, r]) => [0, 60, 120].map((a) => `<path d="M${x - r} ${y} h${r * 2}" transform="rotate(${a} ${x} ${y})"/>`).join(''))
        .join('')}</g>`;
    case 'zigzag':
      return `<g fill="none" stroke="${mark}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
        <path d="M30 50 l7 -6 l7 6 l7 -6 l7 6 l7 -6 l7 6"/><path d="M24 68 l7 -6 l7 6 l7 -6 l7 6 l7 -6 l7 6 l7 -6"/><path d="M32 84 l7 -6 l7 6 l7 -6 l7 6 l7 -6"/></g>`;
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
  carrot: `<path d="M38 50 C46 46 52 48 54 52 L66 70 C60 70 46 62 38 50 Z" fill="#f2994a" stroke="#c96a1c" stroke-width="2" stroke-linejoin="round"/>
    <path d="M46 55 l4 -2 M51 61 l4 -2" stroke="#c96a1c" stroke-width="1.4" stroke-linecap="round"/>
    <path d="M40 50 q-8 -2 -8 -10 q8 0 9 8 q0 -8 6 -11 q3 7 -4 12 z" fill="#7cc16a" stroke="#4f9a44" stroke-width="1.6" stroke-linejoin="round"/>`,
  leaves: `<path d="M50 70 V46" stroke="#8a6a4a" stroke-width="2" stroke-linecap="round"/>
    <g fill="#8fcf9a" stroke="#4f9a5c" stroke-width="1.6" stroke-linejoin="round">
      <path d="M50 48 q-3 -7 0 -12 q3 5 0 12 z"/><path d="M50 54 q-12 -1 -15 -9 q11 0 15 9 z"/><path d="M50 54 q12 -1 15 -9 q-11 0 -15 9 z"/>
      <path d="M50 64 q-12 0 -16 -8 q12 -1 16 8 z"/><path d="M50 64 q12 0 16 -8 q-12 -1 -16 8 z"/></g>`,
  shrimp: `<path d="M36 60 C34 48 46 42 56 46 C64 49 66 58 60 63 C56 66 50 64 50 60 C50 57 54 56 55 58" fill="#ffab9a" stroke="#d96f5e" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M36 60 l-5 5 M36 60 l-1 7" stroke="#d96f5e" stroke-width="2" stroke-linecap="round"/>
    <path d="M42 48 q2 6 -2 10 M48 46 q2 6 -1 11" stroke="#d96f5e" stroke-width="1.4" fill="none" stroke-linecap="round"/><circle cx="57" cy="52" r="1.3" fill="#2c3e50"/>`,
  apple: `<path d="M50 48 C58 42 66 48 65 58 C64 67 58 71 50 69 C42 71 36 67 35 58 C34 48 42 42 50 48 Z" fill="#ef5b5b" stroke="#b93a3a" stroke-width="2"/>
    <path d="M50 48 q0 -5 3 -8" stroke="#6b4226" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M53 42 q6 -4 9 0 q-5 3 -9 0 z" fill="#7cc16a" stroke="#4f9a44" stroke-width="1.4"/>
    <ellipse cx="42" cy="54" rx="2" ry="3.4" fill="#fff" opacity=".5" transform="rotate(20 42 54)"/>`,
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
  'wall-notes': {
    fill: 'url(#wall-notes)',
    pattern: `<pattern id="wall-notes" width="48" height="48" patternUnits="userSpaceOnUse">
      <rect width="48" height="48" fill="#fdf3dc"/>
      <g fill="#edd3a0"><ellipse cx="11" cy="17" rx="3.4" ry="2.5" transform="rotate(-20 11 17)"/><rect x="13.4" y="5" width="1.3" height="12"/>
      <ellipse cx="32" cy="40" rx="3.4" ry="2.5" transform="rotate(-20 32 40)"/><ellipse cx="41" cy="37" rx="3.4" ry="2.5" transform="rotate(-20 41 37)"/>
      <rect x="34.4" y="27" width="1.3" height="13"/><rect x="43.4" y="24" width="1.3" height="13"/><path d="M34.4 27 L44.7 24 v3.2 L34.4 30.2 Z"/></g></pattern>`,
  },
  'wall-lilac': {
    fill: 'url(#wall-lilac)',
    pattern: `<pattern id="wall-lilac" width="30" height="30" patternUnits="userSpaceOnUse">
      <rect width="30" height="30" fill="#ece6f8"/><path d="M15 3 L27 15 L15 27 L3 15 Z" fill="#e0d6f3"/><circle cx="15" cy="15" r="2" fill="#cfc1ec"/></pattern>`,
  },
};

/** What is underfoot: the boards the room came with, or something laid over them. */
const FLOORS = {
  plain: { top: '#ecc99c', bottom: '#e0b886', line: '#d4a874', boards: true },
  'floor-dark': { top: '#b98a5e', bottom: '#a47548', line: '#8d6038', boards: true },
  'floor-tiles': {
    boards: false,
    fill: 'url(#floor-tiles)',
    pattern: `<pattern id="floor-tiles" width="50" height="34" patternUnits="userSpaceOnUse" x="0" y="200">
      <rect width="50" height="34" fill="#f4ede2"/><rect width="25" height="17" fill="#cfe3ea"/><rect x="25" y="17" width="25" height="17" fill="#cfe3ea"/></pattern>`,
  },
};

/**
 * The sky outside, by the clock on the wall of the student's own room.
 *
 * It used to have four settings and jump between them on the hour. This one
 * moves: a handful of moments through the day, blended, so six in the evening
 * is not the same sky as half past seven. `dark` runs from 0 (day) to 1 (night)
 * and is what the stars, the hills and the room's own dimness follow.
 */
const SKY_KEYS = [
  [0, '#1b2452', '#34407a', 1],
  [4.75, '#1b2452', '#34407a', 1],
  [6, '#8f9fd6', '#f7c9b0', 0.45],
  [7.5, '#a9d8f5', '#e6f4fc', 0],
  [12, '#8fd0f5', '#d6eefb', 0],
  [16.5, '#a9d8f5', '#e9f5fb', 0],
  [18.5, '#f2a36e', '#fbd3a6', 0.2],
  [19.75, '#6f6aa8', '#f0a988', 0.6],
  [21, '#1b2452', '#34407a', 1],
  [24, '#1b2452', '#34407a', 1],
];

function mix(a, b, f) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return `#${pa.map((v, i) => Math.round(v + (pb[i] - v) * f).toString(16).padStart(2, '0')).join('')}`;
}

/** The sky at `time` (hours, fractions welcome): top and bottom colour, and how dark it is. */
export function skyAt(time) {
  // anything that is not a time is treated as the middle of the day
  const h = Number.isFinite(Number(time)) ? ((Number(time) % 24) + 24) % 24 : 12;
  let i = 0;
  while (i < SKY_KEYS.length - 2 && h >= SKY_KEYS[i + 1][0]) i += 1;
  const [h0, t0, b0, d0] = SKY_KEYS[i];
  const [h1, t1, b1, d1] = SKY_KEYS[i + 1];
  const f = h1 === h0 ? 0 : Math.min(1, Math.max(0, (h - h0) / (h1 - h0)));
  return { top: mix(t0, t1, f), bottom: mix(b0, b1, f), dark: d0 + (d1 - d0) * f };
}

/** The time of day, as hours with a fraction. */
export function clockNow(date = new Date()) {
  return date.getHours() + date.getMinutes() / 60;
}

const ITEM_ART = {
  window(time) {
    const h = Number.isFinite(Number(time)) ? ((Number(time) % 24) + 24) % 24 : 12;
    const s = skyAt(h);
    const r = (n) => Math.round(n * 10) / 10;
    // The sun crosses from the left of the pane at six to the right by half past
    // seven in the evening; the moon takes the night shift along the same arc.
    const arc = (f) => ({ x: 54 + 84 * (0.08 + 0.84 * f), y: 116 - Math.sin(Math.PI * f) * 58 });
    const sunF = (h - 6) / 13.5;
    const moonF = (((h - 19.5) % 24) + 24) % 24 / 10.5;
    let lights = '';
    if (sunF >= 0 && sunF <= 1) {
      const at = arc(sunF);
      // low in the sky it reddens
      const low = 1 - Math.sin(Math.PI * sunF);
      const core = mix('#ffe27a', '#ffa35c', Math.min(1, low * 1.2));
      lights += `<circle cx="${r(at.x)}" cy="${r(at.y)}" r="15" fill="${core}" opacity=".28"/>
        <circle cx="${r(at.x)}" cy="${r(at.y)}" r="9" fill="${core}"/>`;
    }
    if (moonF >= 0 && moonF <= 1) {
      const at = arc(moonF);
      lights += `<g transform="translate(${r(at.x)} ${r(at.y)})" opacity="${r(Math.min(1, s.dark * 1.6))}">
          <circle r="13" fill="#fff4c2" opacity=".14"/>
          <path d="M2 -8 A8 8 0 1 0 2 8 A6 8 0 1 1 2 -8 Z" fill="#fff4c2"/></g>`;
    }
    const stars =
      s.dark > 0.25
        ? `<g fill="#fff" opacity="${r(Math.min(1, (s.dark - 0.25) * 1.6))}">${[
            [64, 56, 1.4],
            [79, 70, 1],
            [90, 52, 1.2],
            [104, 88, 1.3],
            [72, 94, 1],
            [124, 60, 1.1],
            [130, 84, 1.4],
            [112, 72, 0.9],
          ]
            .map(([x, y, rad], i) => `<circle class="star" style="animation-delay:${(i * 0.7) % 3}s" cx="${x}" cy="${y}" r="${rad}"/>`)
            .join('')}</g>`
        : '';
    const cloudy = 1 - s.dark * 0.85;
    const cloudTint = mix('#ffffff', s.bottom, s.dark > 0.1 ? 0.35 : 0);
    const clouds =
      cloudy > 0.2
        ? `<g class="cloud" fill="${cloudTint}" opacity="${r(0.95 * cloudy)}"><ellipse cx="80" cy="70" rx="14" ry="7"/><ellipse cx="90" cy="65" rx="10" ry="7"/><ellipse cx="72" cy="66" rx="8" ry="6"/></g>
         <g class="cloud cloud-2" fill="${cloudTint}" opacity="${r(0.8 * cloudy)}"><ellipse cx="112" cy="94" rx="10" ry="5"/><ellipse cx="118" cy="90" rx="7" ry="5"/></g>`
        : '';
    return `
      <g class="room-window">
        <linearGradient id="win-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${s.top}"/><stop offset="1" stop-color="${s.bottom}"/></linearGradient>
        <rect x="54" y="44" width="84" height="74" rx="8" fill="url(#win-sky)"/>
        <clipPath id="win-clip"><rect x="54" y="44" width="84" height="74" rx="8"/></clipPath>
        <g clip-path="url(#win-clip)">${stars}${lights}${clouds}
          <path d="M54 118 q20 -16 42 -6 q22 -14 42 0 v10 h-84 z" fill="${mix('#9fd39a', '#2d5a4a', s.dark)}"/></g>
        <rect x="54" y="44" width="84" height="74" rx="8" fill="none" stroke="#fff" stroke-width="7"/>
        <path d="M96 44 v74 M54 81 h84" stroke="#fff" stroke-width="4"/>
        <rect x="48" y="117" width="96" height="7" rx="3.5" fill="#f0e2cc"/>
        <path d="M50 40 q22 30 10 82 l-10 0 z" fill="#f7b9b0" opacity=".9"/>
        <path d="M142 40 q-22 30 -10 82 l10 0 z" fill="#f7b9b0" opacity=".9"/>
      </g>`;
  },
  // A framed violin, with its bow. Drawn as the instrument is built — two bouts
  // with a waist cut in between, f-holes either side of the bridge, a dark
  // fingerboard running up to the pegbox and scroll — because the children
  // looking at it hold one every day and know what it should look like.
  picture: () => `
    <g class="room-picture">
      <rect x="280" y="52" width="58" height="70" rx="5" fill="#b98a58"/>
      <rect x="280" y="52" width="58" height="70" rx="5" fill="none" stroke="#8f6238" stroke-width="1.6"/>
      <rect x="285.5" y="57.5" width="47" height="59" rx="2.5" fill="#fff8ee" stroke="#e4d3b6" stroke-width="1.2"/>
      <g transform="translate(305.5 88.5) rotate(-16) scale(.88)">
        <!-- the bow, behind, leaning the other way -->
        <g transform="rotate(34 4 0)">
          <path d="M9 -27 L9 25" stroke="#8a5a2c" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M11.2 -25 L11.2 21" stroke="#f3ead8" stroke-width=".8"/>
          <path d="M8.4 -28.4 q2.6 -.4 3.2 2.6 l-2.4 1 z" fill="#8a5a2c"/>
          <rect x="8.2" y="19.5" width="3.6" height="5" rx=".8" fill="#3b2c22"/>
        </g>
        <!-- neck, pegbox and scroll -->
        <path d="M-1.9 -22 L1.9 -22 L1.6 -3 L-1.6 -3 Z" fill="#a85f2a"/>
        <path d="M-1.9 -28.5 L1.9 -28.5 L1.9 -21.5 L-1.9 -21.5 Z" fill="#a85f2a" stroke="#7d431a" stroke-width=".7"/>
        <circle cx="0" cy="-30.6" r="2.7" fill="#b96a30" stroke="#7d431a" stroke-width=".8"/>
        <circle cx="0" cy="-30.6" r=".9" fill="#7d431a"/>
        <path d="M-1.9 -27 h-3 M-1.9 -23.6 h-3 M1.9 -25.4 h3 M1.9 -22 h3" stroke="#3b2c22" stroke-width="1.5" stroke-linecap="round"/>
        <!-- the body -->
        <path d="M0 -4.5 C4.6 -4.5 8.6 -3 8.6 2.4 C8.6 5.6 7.3 6.6 6.3 7.3 L7.4 8.2 C5.2 9.8 5.2 12.6 7.6 14 L6.6 15 C8.4 15.8 10.6 17.2 10.6 21.4 C10.6 26.6 5.6 28.4 0 28.4 C-5.6 28.4 -10.6 26.6 -10.6 21.4 C-10.6 17.2 -8.4 15.8 -6.6 15 L-7.6 14 C-5.2 12.6 -5.2 9.8 -7.4 8.2 L-6.3 7.3 C-7.3 6.6 -8.6 5.6 -8.6 2.4 C-8.6 -3 -4.6 -4.5 0 -4.5 Z"
          fill="#cf7d3c" stroke="#7d431a" stroke-width="1.3" stroke-linejoin="round"/>
        <path d="M-5.4 -1.4 C-6.6 0 -6.8 2.4 -6.2 4 M-7.4 19 C-8 21 -7.6 23.2 -6.2 24.6" fill="none" stroke="#e9a468" stroke-width="1.3" stroke-linecap="round"/>
        <!-- f-holes -->
        <g fill="none" stroke="#3b2c22" stroke-width=".9" stroke-linecap="round">
          <path d="M-4.9 9.4 c1.2 1.2 -1.6 5.8 -.2 7.4"/>
          <path d="M4.9 9.4 c-1.2 1.2 1.6 5.8 .2 7.4"/>
        </g>
        <g fill="#3b2c22"><circle cx="-4.6" cy="9.2" r=".75"/><circle cx="-5.4" cy="17" r=".75"/><circle cx="4.6" cy="9.2" r=".75"/><circle cx="5.4" cy="17" r=".75"/></g>
        <!-- fingerboard, strings, bridge, tailpiece, chinrest -->
        <path d="M-1.7 -22 L1.7 -22 L2.3 9.6 L-2.3 9.6 Z" fill="#3b2c22"/>
        <path d="M-.9 -21 L-1.2 21 M.9 -21 L1.2 21" stroke="#e9dcc2" stroke-width=".45"/>
        <rect x="-3.3" y="13.2" width="6.6" height="1.5" rx=".6" fill="#f1dfbd" stroke="#b3905c" stroke-width=".4"/>
        <path d="M-2 19.4 L2 19.4 L2.9 26.4 Q0 27.6 -2.9 26.4 Z" fill="#3b2c22"/>
        <path d="M-9 24.4 C-8.4 27.4 -5.4 28.2 -3.4 27.6 C-4.6 25.6 -6.4 24.2 -9 24.4 Z" fill="#4a3628"/>
      </g>
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
  // The room's own clock: it tells the real time, like the window does.
  clock: (time = 10.17) => {
    const h = Number.isFinite(Number(time)) ? ((Number(time) % 24) + 24) % 24 : 10.17;
    const hourAngle = (h % 12) * 30;
    const minAngle = (h % 1) * 360;
    const ticks = Array.from({ length: 12 }, (_, i) => `<path d="M0 -14.5 v${i % 3 === 0 ? 3 : 1.6}" transform="rotate(${i * 30})"/>`).join('');
    return `
    <g class="room-clock" transform="translate(200 52)">
      <circle r="19" fill="#c9976a" stroke="#9a6b43" stroke-width="2"/>
      <circle r="15.5" fill="#fffdf6"/>
      <g stroke="#8b7d6b" stroke-width="1.2" stroke-linecap="round">${ticks}</g>
      <path d="M0 1.5 V-8" stroke="#3b2c22" stroke-width="2.4" stroke-linecap="round" transform="rotate(${hourAngle.toFixed(1)})"/>
      <path d="M0 2 V-12.5" stroke="#3b2c22" stroke-width="1.5" stroke-linecap="round" transform="rotate(${minAngle.toFixed(1)})"/>
      <circle r="1.8" fill="#e0685c"/>
    </g>`;
  },
  poster: () => `
    <g class="room-poster">
      <rect x="158" y="78" width="40" height="52" rx="2" fill="#fff8e6" stroke="#c9a77d" stroke-width="2"/>
      <path d="M176 74 h4 v7 h-4 z" fill="#e0685c"/>
      <g fill="#5b8fd0"><ellipse cx="170" cy="112" rx="5" ry="3.7" transform="rotate(-20 170 112)"/><ellipse cx="186" cy="107" rx="5" ry="3.7" transform="rotate(-20 186 107)"/>
        <rect x="173.2" y="91" width="1.9" height="21"/><rect x="189.2" y="86" width="1.9" height="21"/><path d="M173.2 91 L191.1 86 v5 L173.2 96 Z"/></g>
      <path d="M165 122 h26" stroke="#f1b85a" stroke-width="2.4" stroke-linecap="round"/>
    </g>`,
  shelf: () => `
    <g class="room-shelf">
      <path d="M12 150 v8 M50 150 v8" stroke="#9a6b43" stroke-width="3" stroke-linecap="round"/>
      <rect x="4" y="145" width="54" height="6" rx="2" fill="#c9976a" stroke="#9a6b43" stroke-width="1.6"/>
      <!-- a little cup, for all that practice -->
      <path d="M15 124 h14 v6 c0 6 -3 9 -7 9 c-4 0 -7 -3 -7 -9 z" fill="#f6c84c" stroke="#c9952a" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M15 126 c-5 0 -5 8 1 8 M29 126 c5 0 5 8 -1 8" fill="none" stroke="#c9952a" stroke-width="1.6"/>
      <path d="M22 139 v3 M17 145 h10 l-1.5 -3 h-7 z" stroke="#c9952a" stroke-width="1.6" fill="#f6c84c" stroke-linejoin="round"/>
      <path d="M22 128.5 l1.2 2.4 l2.6 .3 l-1.9 1.8 l.5 2.6 l-2.4 -1.3 l-2.4 1.3 l.5 -2.6 l-1.9 -1.8 l2.6 -.3 z" fill="#fff6c9"/>
      <g stroke="#3b2c22" stroke-opacity=".25" stroke-width=".8"><rect x="37" y="129" width="5" height="16" fill="#7fb7e6"/><rect x="42" y="126" width="5" height="19" fill="#f2a0a0"/><rect x="47" y="131" width="5" height="14" fill="#a6d8a9"/></g>
    </g>`,
  // Fairy lights: `lit` draws only the glow, laid over the dusk so they shine after dark.
  lights: (lit = false) => {
    const colors = ['#ffd97a', '#f6a4a4', '#a9d8f0', '#b7e3b0', '#f3b7e1'];
    const at = (i) => {
      const x = 14 + i * 26.6;
      const f = (x % 200) / 200;
      return { x, y: 5 + Math.sin(f * Math.PI) * 13 };
    };
    const bulbs = Array.from({ length: 15 }, (_, i) => {
      const { x, y } = at(i);
      return lit
        ? `<circle cx="${x.toFixed(1)}" cy="${(y + 5).toFixed(1)}" r="8" fill="${colors[i % 5]}" opacity=".4"/>`
        : `<path d="M${x.toFixed(1)} ${y.toFixed(1)} v2.4" stroke="#7a6a58" stroke-width="1.6"/><ellipse class="fairy-bulb" style="animation-delay:${(i % 5) * 0.4}s" cx="${x.toFixed(1)}" cy="${(y + 5.6).toFixed(1)}" rx="3" ry="3.8" fill="${colors[i % 5]}"/>`;
    }).join('');
    return lit
      ? `<g class="room-lights-glow" pointer-events="none">${bulbs}</g>`
      : `<g class="room-lights"><path d="M0 4 Q100 32 200 5 Q300 32 400 4" fill="none" stroke="#7a6a58" stroke-width="1.4"/>${bulbs}</g>`;
  },
  flowers: () => `
    <g class="room-flowers">
      <ellipse cx="130" cy="216" rx="15" ry="3.5" fill="rgba(60,40,20,.12)"/>
      <path d="M130 198 v16 M122 215 h16" stroke="#9a6b43" stroke-width="3" stroke-linecap="round"/>
      <ellipse cx="130" cy="197" rx="16" ry="4" fill="#e7bd8f" stroke="#a9774c" stroke-width="1.8"/>
      <g stroke="#4d9a52" stroke-width="1.6" fill="none" stroke-linecap="round"><path d="M130 184 C129 176 125 170 122 164"/><path d="M130 184 C130 174 131 168 131 159"/><path d="M130 184 C131 177 136 172 139 167"/></g>
      <g><circle cx="122" cy="163" r="4.6" fill="#f6a4b8"/><circle cx="122" cy="163" r="1.8" fill="#ffe27a"/>
        <circle cx="131" cy="157" r="5" fill="#ffd166"/><circle cx="131" cy="157" r="1.9" fill="#e98b4a"/>
        <circle cx="139.5" cy="166" r="4.4" fill="#b9a4ee"/><circle cx="139.5" cy="166" r="1.7" fill="#ffe27a"/></g>
      <path d="M124 182 h12 l-2 14 h-8 z" fill="#8fc7e8" stroke="#5f9ac0" stroke-width="1.8" stroke-linejoin="round"/>
    </g>`,
  metronome: () => `
    <g class="room-metronome">
      <ellipse cx="228" cy="286" rx="14" ry="3.5" fill="rgba(60,40,20,.12)"/>
      <path d="M223 250 h10 l7 34 h-24 z" fill="#b5763f" stroke="#7d4d24" stroke-width="2" stroke-linejoin="round"/>
      <path d="M224.6 254 h6.8 l4.6 24 h-16 z" fill="#f6e3c4"/>
      <g class="metro-arm"><path d="M228 279 V253" stroke="#4a4038" stroke-width="1.8" stroke-linecap="round"/><rect x="225" y="259" width="6" height="5" rx="1" fill="#c9cdd3" stroke="#6f757d" stroke-width="1"/></g>
      <rect x="215" y="281" width="26" height="5" rx="1.5" fill="#8d5a2e" stroke="#7d4d24" stroke-width="1.4"/>
    </g>`,
  toybox: () => `
    <g class="room-toybox">
      <ellipse cx="350" cy="292" rx="28" ry="4.5" fill="rgba(60,40,20,.12)"/>
      <circle cx="338" cy="262" r="8" fill="#7fb7e6" stroke="#4f8cc0" stroke-width="1.8"/>
      <rect x="349" y="254" width="13" height="13" rx="2" fill="#f6a4a4" stroke="#d17070" stroke-width="1.8" transform="rotate(12 355 260)"/>
      <path d="M364 266 l5 -12 l5 12 z" fill="#b7e3b0" stroke="#6fae69" stroke-width="1.8" stroke-linejoin="round"/>
      <path d="M326 266 h48 l-3 25 h-42 z" fill="#f6b36b" stroke="#c9843c" stroke-width="2.2" stroke-linejoin="round"/>
      <rect x="323" y="262" width="54" height="7" rx="2.5" fill="#fbc98a" stroke="#c9843c" stroke-width="2"/>
      <path d="M350 273 l2 4.2 l4.6 .5 l-3.4 3.2 l.9 4.6 l-4.1 -2.3 l-4.1 2.3 l.9 -4.6 l-3.4 -3.2 l4.6 -.5 z" fill="#fff6c9"/>
    </g>`,
  beanbag: () => `
    <g class="room-beanbag">
      <ellipse cx="60" cy="287" rx="32" ry="5" fill="rgba(60,40,20,.12)"/>
      <path d="M30 276 C26 258 44 246 60 247 C78 246 94 258 90 276 C90 288 30 288 30 276 Z" fill="#b7a4e8" stroke="#8a74c4" stroke-width="2.2" stroke-linejoin="round"/>
      <path d="M44 262 C52 268 68 268 76 262" fill="none" stroke="#8a74c4" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M40 258 C44 252 52 250 58 250" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".55"/>
    </g>`,
  bookshelf: () => {
    const books = [
      [220, 148, '#f2a0a0', 5, 16], [225, 146, '#7fb7e6', 6, 18], [231, 150, '#ffd166', 4, 14], [235, 147, '#a6d8a9', 6, 17], [246, 152, '#b9a4ee', 12, 12],
      [220, 174, '#a6d8a9', 6, 18], [226, 177, '#f6b36b', 5, 15], [231, 173, '#f2a0a0', 6, 19], [243, 176, '#7fb7e6', 5, 16], [248, 174, '#ffd166', 6, 18],
      [221, 203, '#b9a4ee', 5, 15], [226, 200, '#ffd166', 6, 18], [237, 202, '#7fb7e6', 6, 16], [243, 199, '#f2a0a0', 5, 19], [248, 203, '#a6d8a9', 6, 15],
    ]
      .map(([x, top, c, w, h]) => `<rect x="${x}" y="${top}" width="${w}" height="${h}" rx=".8" fill="${c}"/>`)
      .join('');
    return `
    <g class="room-bookshelf">
      <ellipse cx="239" cy="222" rx="28" ry="4" fill="rgba(60,40,20,.12)"/>
      <rect x="214" y="134" width="50" height="88" rx="3" fill="#c9976a" stroke="#9a6b43" stroke-width="2.2"/>
      <rect x="218" y="138" width="42" height="80" fill="#8d6038"/>
      <g stroke="#3b2c22" stroke-opacity=".22" stroke-width=".7">${books}</g>
      <rect x="216" y="164" width="46" height="4" fill="#c9976a"/><rect x="216" y="192" width="46" height="4" fill="#c9976a"/>
    </g>`;
  },
  piano: () => `
    <g class="room-piano">
      <ellipse cx="178" cy="222" rx="38" ry="4.5" fill="rgba(60,40,20,.14)"/>
      <path d="M150 196 v24 M206 196 v24" stroke="#4a3226" stroke-width="5" stroke-linecap="round"/>
      <rect x="146" y="152" width="64" height="62" rx="3" fill="#7a5340" stroke="#4a3226" stroke-width="2.2"/>
      <rect x="143" y="148" width="70" height="7" rx="2.5" fill="#8d6350" stroke="#4a3226" stroke-width="2"/>
      <rect x="162" y="160" width="32" height="16" rx="1.5" fill="#fffdf6" stroke="#4a3226" stroke-width="1.4"/>
      <g stroke="#8b8277" stroke-width=".8"><path d="M165 165 h26 M165 168.5 h26 M165 172 h26"/></g>
      <rect x="141" y="184" width="74" height="12" rx="2" fill="#8d6350" stroke="#4a3226" stroke-width="2"/>
      <rect x="145" y="186" width="66" height="7" fill="#fffdf6"/>
      <g stroke="#b9b0a3" stroke-width=".7">${Array.from({ length: 10 }, (_, i) => `<path d="M${151 + i * 6} 186 v7"/>`).join('')}</g>
      <g fill="#2f241d">${[149, 155, 167, 173, 179, 191, 197].map((x) => `<rect x="${x}" y="186" width="3.4" height="4.4"/>`).join('')}</g>
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
export function roomMarkup({ placed = [], wall = null, floor = null, fish = false, hour = clockNow(), where = {} } = {}) {
  const w = WALLS[wall] || WALLS.plain;
  const f = FLOORS[floor] || FLOORS.plain;
  const has = (id) => placed.includes(id);
  const dark = skyAt(hour).dark;
  // Each thing in the room sits in its own group, moved by however far the
  // student has dragged it from where it was first put down.
  const off = (id) => {
    const at = where && where[id];
    return `${Math.round((at && at.x) || 0)} ${Math.round((at && at.y) || 0)}`;
  };
  const item = (id, art) => `<g class="room-item" data-item="${id}" transform="translate(${off(id)})">${art}</g>`;
  return `
    <defs>
      ${w.pattern}
      ${f.pattern || ''}
      <linearGradient id="floor-grad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${f.top || '#ecc99c'}"/><stop offset="1" stop-color="${f.bottom || '#e0b886'}"/>
      </linearGradient>
    </defs>
    <rect class="room-wall" x="0" y="0" width="400" height="206" fill="${w.fill}"/>
    <radialGradient id="wall-light" cx=".5" cy=".35" r=".7"><stop offset="0" stop-color="#fff" stop-opacity=".45"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <rect x="0" y="0" width="400" height="206" fill="url(#wall-light)" pointer-events="none"/>
    ${has('lights') ? ITEM_ART.lights() : ''}
    ${has('bunting') ? ITEM_ART.bunting() : ''}
    ${has('window') ? item('window', ITEM_ART.window(hour)) : ''}
    ${has('picture') ? item('picture', ITEM_ART.picture()) : ''}
    ${has('poster') ? item('poster', ITEM_ART.poster()) : ''}
    ${has('clock') ? item('clock', ITEM_ART.clock(hour)) : ''}
    ${has('shelf') ? item('shelf', ITEM_ART.shelf()) : ''}
    <rect x="0" y="200" width="400" height="100" fill="${f.boards ? 'url(#floor-grad)' : f.fill}"/>
    ${
      f.boards
        ? `<g stroke="${f.line}" stroke-width="1.4" opacity=".7">
      <path d="M0 226 H400 M0 254 H400 M0 284 H400"/>
      <path d="M70 200 v26 M190 200 v26 M310 200 v26 M30 226 v28 M150 226 v28 M270 226 v28 M370 226 v28 M100 254 v30 M230 254 v30 M340 254 v30"/>
    </g>`
        : ''
    }
    <rect x="0" y="196" width="400" height="9" fill="#f6e7d2"/>
    <rect x="0" y="204" width="400" height="2" fill="#d9bc93"/>
    ${has('rug') ? item('rug', ITEM_ART.rug()) : ''}
    ${has('piano') ? item('piano', ITEM_ART.piano()) : ''}
    ${has('bookshelf') ? item('bookshelf', ITEM_ART.bookshelf()) : ''}
    ${has('flowers') ? item('flowers', ITEM_ART.flowers()) : ''}
    ${has('bed') && !fish ? item('bed', ITEM_ART.bed()) : ''}
    ${has('stand') ? item('stand', ITEM_ART.stand()) : ''}
    ${has('plant') ? item('plant', ITEM_ART.plant()) : ''}
    ${has('lamp') ? item('lamp', ITEM_ART.lamp()) : ''}
    ${fish ? fishbowl() : item('bowl', ITEM_ART.bowl())}
    ${has('beanbag') ? item('beanbag', ITEM_ART.beanbag()) : ''}
    ${has('toybox') ? item('toybox', ITEM_ART.toybox()) : ''}
    ${has('metronome') ? item('metronome', ITEM_ART.metronome()) : ''}
    ${dark > 0.02 ? `<rect class="room-night" x="0" y="0" width="400" height="300" fill="#1d2550" opacity="${(dark * 0.2).toFixed(3)}" pointer-events="none"/>` : ''}
    ${dark > 0.3 && has('lights') ? ITEM_ART.lights(true) : ''}
    ${
      // After dark the lamp is what lights the room: its pool of light is drawn
      // over the dusk, so the corner it stands in stays warm.
      dark > 0.3 && has('lamp')
        ? `<g transform="translate(${off('lamp')})" pointer-events="none"><path class="lamp-glow is-lit" d="M344 156 L384 156 L414 268 L314 268 Z" fill="#ffe9a8" opacity="${(0.16 + dark * 0.2).toFixed(3)}"/>
           <ellipse cx="364" cy="268" rx="52" ry="9" fill="#ffe9a8" opacity="${(dark * 0.22).toFixed(3)}"/></g>`
        : ''
    }`;
}

export function ballMarkup() {
  return ITEM_ART.ball();
}

/** A small picture of a decoration, for the shop. */
export function itemIcon(id) {
  const views = {
    window: '46 38 104 90',
    picture: '274 46 70 82',
    bunting: '0 8 400 60',
    lamp: '320 122 90 150',
    plant: '8 170 56 104',
    rug: '76 236 248 52',
    bed: '248 232 96 48',
    ball: '-12 -12 24 24',
    stand: '68 160 56 112',
    clock: '176 28 48 48',
    poster: '150 70 56 64',
    shelf: '0 116 62 46',
    lights: '0 -4 200 44',
    flowers: '106 148 48 74',
    metronome: '206 242 44 50',
    toybox: '318 248 64 50',
    beanbag: '22 240 76 54',
    bookshelf: '206 128 66 100',
    piano: '134 142 88 86',
  };
  if (id.startsWith('floor-')) {
    const f = FLOORS[id];
    const fill = f.boards ? f.top : f.fill;
    return `<svg class="item-icon" viewBox="0 200 60 44" aria-hidden="true"><defs>${f.pattern || ''}</defs>
      <rect y="200" width="60" height="44" rx="6" fill="${fill}"/>${
        f.boards ? `<path d="M0 214 H60 M0 230 H60 M22 200 v14 M44 214 v16 M14 230 v14" stroke="${f.line}" stroke-width="1.4"/>` : ''
      }</svg>`;
  }
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
