// The student's own figure: drawn from what it is (skin, hair colour) and what it
// has on. One 100 × 130 box, feet at y 126, drawn in the pets' hand — round, a
// dark outline in the colour of each part, nothing sharp.
//
// The parts are grouped the way the moves need them: `.av-arm-l` and `.av-arm-r`
// swing from the shoulder, `.av-upper` (head, body, arms) bends at the waist,
// and `.av` is the whole figure. The moves themselves are CSS (app.css, "the
// avatar's moves"), switched on with a class on `.av`: is-wave, is-jump, …

const SKIN = {
  s1: { fill: '#fde3cf', line: '#c99776' },
  s2: { fill: '#f6cfa8', line: '#b98558' },
  s3: { fill: '#e3b07f', line: '#a5733f' },
  s4: { fill: '#c98d5b', line: '#8a5a30' },
  s5: { fill: '#9a6338', line: '#63391a' },
  s6: { fill: '#6b4226', line: '#3d2412' },
};
const HAIR = {
  black: { fill: '#2f2a2a', line: '#171414' },
  brown: { fill: '#6b4a32', line: '#40291a' },
  chestnut: { fill: '#9a5a36', line: '#63351c' },
  blond: { fill: '#efce76', line: '#b58e2f' },
  red: { fill: '#d9683c', line: '#96401e' },
  grey: { fill: '#b9bcc4', line: '#7d818b' },
  blue: { fill: '#6c9fe0', line: '#3f6cab' },
  pink: { fill: '#f29cc0', line: '#bf5f8a' },
};
const INK = '#3b2c22';

export const skinFill = (id) => (SKIN[id] || SKIN.s2).fill;
export const hairFill = (id) => (HAIR[id] || HAIR.brown).fill;

// Each top: its colour, its outline, how far down the arm the sleeve comes
// (0–1), and what is drawn over the body. `legs` replaces the trousers.
const TOPS = {
  'top-tee': { fill: '#7fb7e6', line: '#4f8cc0', sleeve: 0.34 },
  'top-stripes': {
    fill: '#fff6ea', line: '#c0a98a', sleeve: 0.34,
    over: `<g stroke="#e0685c" stroke-width="3.2"><path d="M37.5 70 h25"/><path d="M38 78 h24"/><path d="M38.5 86 h23"/><path d="M39 94 h22"/></g>`,
  },
  'top-hoodie': {
    fill: '#8fcf9a', line: '#4f9a5c', sleeve: 0.9,
    over: `<path d="M41 62 q9 9 18 0" fill="none" stroke="#4f9a5c" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M47 67 v8 M53 67 v8" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M42 86 h16 v7 q-8 3 -16 0 z" fill="#7cc189" stroke="#4f9a5c" stroke-width="1.4" stroke-linejoin="round"/>`,
  },
  'top-overalls': {
    fill: '#fff6ea', line: '#c0a98a', sleeve: 0.34, trousers: '#5b8fd0', trouserLine: '#3b6aa5',
    over: `<path d="M41 76 h18 v24 h-18 z" fill="#5b8fd0" stroke="#3b6aa5" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M43 76 L41 62 M57 76 L59 62" stroke="#5b8fd0" stroke-width="3.4" stroke-linecap="round"/>
      <circle cx="43.6" cy="77.6" r="1.5" fill="#f6d77a"/><circle cx="56.4" cy="77.6" r="1.5" fill="#f6d77a"/>`,
  },
  'top-dress': {
    fill: '#f29cc0', line: '#bf5f8a', sleeve: 0.3, skirt: true,
    over: `<path d="M38.5 82 h23" stroke="#bf5f8a" stroke-width="2"/><circle cx="50" cy="71" r="1.6" fill="#fff"/><circle cx="50" cy="77" r="1.6" fill="#fff"/>`,
  },
  // What is worn to play to people: black, with a bow tie.
  'top-concert': {
    fill: '#3a3a44', line: '#1f1f26', sleeve: 0.92, trousers: '#2c2c34', trouserLine: '#17171c',
    over: `<path d="M44.5 62 L50 74 L55.5 62 Z" fill="#fff"/>
      <path d="M50 65 l-5.4 -3 v6 z M50 65 l5.4 -3 v6 z" fill="#c8372f" stroke="#8f1f1a" stroke-width=".9" stroke-linejoin="round"/>
      <circle cx="50" cy="80" r="1.2" fill="#fff"/><circle cx="50" cy="87" r="1.2" fill="#fff"/>`,
  },
  'top-xmas': {
    fill: '#c8372f', line: '#8f1f1a', sleeve: 0.9,
    over: `<path d="M37.6 74 l3.1 -3 l3.1 3 l3.1 -3 l3.1 3 l3.1 -3 l3.1 3 l3.1 -3 l2.8 3" fill="none" stroke="#fff" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>
      <path d="M50 79 l5 9 h-10 z" fill="#3f9a6b" stroke="#2c6e4f" stroke-width="1.1" stroke-linejoin="round"/><circle cx="50" cy="78.6" r="1.4" fill="#f6d77a"/>
      <path d="M38.6 93 h22.8" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`,
  },
};

function hairBack(style, h) {
  const a = `fill="${h.fill}" stroke="${h.line}" stroke-width="1.8" stroke-linejoin="round"`;
  switch (style) {
    case 'hair-long':
      return `<path d="M27 36 C25 12 75 12 73 36 L75 68 C68 72 62 70 60 64 L40 64 C38 70 32 72 25 68 Z" ${a}/>`;
    case 'hair-bob':
      return `<path d="M26.5 38 C24 12 76 12 73.5 38 L74 52 C70 56 64 55 62 51 L38 51 C36 55 30 56 26 52 Z" ${a}/>`;
    case 'hair-pony':
      return `<path d="M70 26 C86 28 88 50 78 60 C80 48 76 40 68 36 Z" ${a}/>`;
    case 'hair-curly':
      return `<g ${a}><circle cx="29" cy="30" r="9"/><circle cx="71" cy="30" r="9"/><circle cx="27" cy="43" r="7.5"/><circle cx="73" cy="43" r="7.5"/></g>`;
    case 'hair-buns':
      return `<g ${a}><circle cx="30" cy="15" r="8.5"/><circle cx="70" cy="15" r="8.5"/></g>`;
    case 'hair-braids':
      return `<g ${a}><path d="M28 40 C23 46 27 50 24 56 C21 62 27 66 25 72 C31 70 33 64 31 58 C34 52 31 46 34 42 Z"/>
        <path d="M72 40 C77 46 73 50 76 56 C79 62 73 66 75 72 C69 70 67 64 69 58 C66 52 69 46 66 42 Z"/></g>
        <circle cx="25.4" cy="73" r="2.4" fill="#e0685c"/><circle cx="74.6" cy="73" r="2.4" fill="#e0685c"/>`;
    default:
      return '';
  }
}

function hairFront(style, h) {
  const a = `fill="${h.fill}" stroke="${h.line}" stroke-width="1.8" stroke-linejoin="round"`;
  switch (style) {
    case 'hair-none':
      return '';
    case 'hair-spiky':
      return `<path d="M25.4 34 C24.6 25 27 17 31 13 L32 3 L39.6 10.6 L45 0 L51 9.6 L58 1 L61.4 11.4 L70 6 L69.4 16 C73.4 21 75.2 28 74.6 35 C66 30 58 27 50 27 C41 27 33 30 25.4 34 Z" ${a}/>`;
    case 'hair-curly':
      return `<g ${a}><circle cx="29.6" cy="26" r="7.6"/><circle cx="70.4" cy="26" r="7.6"/><circle cx="36" cy="17" r="9.4"/><circle cx="64" cy="17" r="9.4"/><circle cx="50" cy="13" r="10"/></g>
        <path d="M30 30 C36 24 64 24 70 30 C64 22 36 22 30 30 Z" fill="${h.fill}"/>`;
    case 'hair-long':
    case 'hair-braids':
      // parted in the middle
      return `<path d="M25.4 37 C21 3 79 3 74.6 37 C71 28 60 22 50 21 C40 22 29 28 25.4 37 Z" ${a}/><path d="M50 12 v9" stroke="${h.line}" stroke-width="1.4" stroke-linecap="round"/>`;
    case 'hair-pony':
    case 'hair-buns':
      return `<path d="M25.4 36 C21 3 79 3 74.6 36 C69 27 60 23 50 23 C40 23 31 27 25.4 36 Z" ${a}/>`;
    case 'hair-bob':
      return `<path d="M25.4 38 C20 3 80 3 74.6 38 C72 30 66 26 58 25 C50 30 38 31 25.4 38 Z" ${a}/>`;
    default: // short
      return `<path d="M25.4 35 C21 3 79 3 74.6 35 C71 28 64 24 57 23 C48 28 36 28 25.4 35 Z" ${a}/>`;
  }
}

function eyes(style) {
  switch (style) {
    case 'eyes-bright':
      return `<g class="av-eyes"><ellipse cx="41.5" cy="39" rx="3.6" ry="4.4" fill="${INK}"/><ellipse cx="58.5" cy="39" rx="3.6" ry="4.4" fill="${INK}"/>
        <circle cx="42.8" cy="37.2" r="1.5" fill="#fff"/><circle cx="59.8" cy="37.2" r="1.5" fill="#fff"/><circle cx="40.4" cy="40.8" r=".8" fill="#fff"/><circle cx="57.4" cy="40.8" r=".8" fill="#fff"/></g>`;
    case 'eyes-lash':
      return `<g class="av-eyes"><ellipse cx="41.5" cy="39.4" rx="2.8" ry="3.4" fill="${INK}"/><ellipse cx="58.5" cy="39.4" rx="2.8" ry="3.4" fill="${INK}"/>
        <circle cx="42.4" cy="38.2" r="1" fill="#fff"/><circle cx="59.4" cy="38.2" r="1" fill="#fff"/>
        <path d="M37.4 37 l-2.6 -2 M38.6 35.4 l-1.6 -2.6 M62.6 37 l2.6 -2 M61.4 35.4 l1.6 -2.6" stroke="${INK}" stroke-width="1.3" stroke-linecap="round"/></g>`;
    case 'eyes-happy':
      return `<g class="av-eyes" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"><path d="M38 40.4 q3.5 -4.6 7 0"/><path d="M55 40.4 q3.5 -4.6 7 0"/></g>`;
    default:
      return `<g class="av-eyes"><circle cx="41.5" cy="39.4" r="2.7" fill="${INK}"/><circle cx="58.5" cy="39.4" r="2.7" fill="${INK}"/>
        <circle cx="42.3" cy="38.4" r=".9" fill="#fff"/><circle cx="59.3" cy="38.4" r=".9" fill="#fff"/></g>`;
  }
}

function mouth(style) {
  switch (style) {
    case 'mouth-grin':
      return `<path d="M44 46.4 h12 q-1 6.4 -6 6.4 q-5 0 -6 -6.4 z" fill="#8a3a3a" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/><path d="M45.6 47.2 h8.8 v1.8 h-8.8 z" fill="#fff"/>`;
    case 'mouth-o':
      return `<ellipse cx="50" cy="49" rx="2.6" ry="3.2" fill="#8a3a3a" stroke="${INK}" stroke-width="1.4"/>`;
    default:
      return `<path d="M45 47 q5 4.6 10 0" fill="none" stroke="${INK}" stroke-width="1.9" stroke-linecap="round"/>`;
  }
}

function extra(style) {
  switch (style) {
    case 'extra-glasses':
      return `<g fill="rgba(255,255,255,.35)" stroke="#3d4a5c" stroke-width="1.7"><rect x="34.4" y="34.6" width="13" height="9.6" rx="2.4"/><rect x="52.6" y="34.6" width="13" height="9.6" rx="2.4"/></g>
        <path d="M47.4 38.6 h5.2 M34.4 38 l-5 -1.4 M65.6 38 l5 -1.4" stroke="#3d4a5c" stroke-width="1.7" stroke-linecap="round" fill="none"/>`;
    case 'extra-round':
      return `<g fill="rgba(255,255,255,.35)" stroke="#b5762c" stroke-width="1.7"><circle cx="41.5" cy="39.4" r="6.4"/><circle cx="58.5" cy="39.4" r="6.4"/></g>
        <path d="M47.9 39 h4.2 M35.1 38.4 l-5.6 -1.6 M64.9 38.4 l5.6 -1.6" stroke="#b5762c" stroke-width="1.7" stroke-linecap="round" fill="none"/>`;
    case 'extra-freckles':
      return `<g fill="#b9774f" opacity=".75"><circle cx="35" cy="45" r="1"/><circle cx="38.4" cy="46.6" r="1"/><circle cx="36.4" cy="48.6" r="1"/><circle cx="65" cy="45" r="1"/><circle cx="61.6" cy="46.6" r="1"/><circle cx="63.6" cy="48.6" r="1"/></g>`;
    case 'extra-rosy':
      return `<g fill="#f48a8a" opacity=".55"><ellipse cx="35.4" cy="46.4" rx="4.4" ry="3"/><ellipse cx="64.6" cy="46.4" rx="4.4" ry="3"/></g>`;
    default:
      return '';
  }
}

function hat(style) {
  switch (style) {
    case 'hat-bow':
      return `<g transform="translate(64 17) rotate(18)"><path d="M0 0 l-9 -5.5 v11 z M0 0 l9 -5.5 v11 z" fill="#e0685c" stroke="#a83a30" stroke-width="1.4" stroke-linejoin="round"/><circle r="2.8" fill="#f08a7e" stroke="#a83a30" stroke-width="1.2"/></g>`;
    case 'hat-cap':
      return `<path d="M24.6 27 C24 0 76 0 75.4 27 Z" fill="#5b8fd0" stroke="#3b6aa5" stroke-width="1.8" stroke-linejoin="round"/>
        <path d="M72 26.4 C82 25 89 28 90 31.6 C84 32 78 31 72 29.6 Z" fill="#4a7dbd" stroke="#3b6aa5" stroke-width="1.6" stroke-linejoin="round"/><circle cx="50" cy="6.8" r="2" fill="#3b6aa5"/>`;
    case 'hat-beanie':
      return `<path d="M24.8 29 C22 -1 78 -1 75.2 29 Z" fill="#f2a64a" stroke="#b9732a" stroke-width="1.8" stroke-linejoin="round"/>
        <rect x="23.4" y="24.4" width="53.2" height="8" rx="4" fill="#f8c27c" stroke="#b9732a" stroke-width="1.6"/><circle cx="50" cy="3.4" r="5.2" fill="#fff6ea" stroke="#c9b592" stroke-width="1.4"/>`;
    case 'hat-crown':
      return `<g transform="translate(0 -6)"><path d="M32 26 L30 8 L40 17 L50 4 L60 17 L70 8 L68 26 Z" fill="#f6c84c" stroke="#c9952a" stroke-width="1.8" stroke-linejoin="round"/>
        <circle cx="50" cy="20" r="2.4" fill="#e0685c"/><circle cx="39.6" cy="21.4" r="1.7" fill="#5b8fd0"/><circle cx="60.4" cy="21.4" r="1.7" fill="#5b8fd0"/></g>`;
    case 'hat-santa':
      return `<path d="M24.8 27 C25 0 62 -6 80 18 C74 17 72 22 75.2 27 Z" fill="#c8372f" stroke="#8f1f1a" stroke-width="1.8" stroke-linejoin="round"/>
        <rect x="23.2" y="23.4" width="53.6" height="8.4" rx="4.2" fill="#fff" stroke="#c9d3dc" stroke-width="1.5"/><circle cx="81.4" cy="19.6" r="5" fill="#fff" stroke="#c9d3dc" stroke-width="1.5"/>`;
    default:
      return '';
  }
}

/** One arm, hanging from its shoulder: skin, then as much sleeve as the top has. */
function arm(side, skin, top) {
  // Drawn from its own shoulder at (0, 0), inside a group that puts the shoulder
  // in place: a CSS rotation on `.av-arm` then turns about the shoulder whatever
  // else is drawn in the arm.
  const sx = side === 'l' ? 38 : 62;
  const sy = 66;
  const hx = side === 'l' ? -7 : 7;
  const hy = 25;
  const ex = (hx * top.sleeve).toFixed(1);
  const ey = (hy * top.sleeve).toFixed(1);
  return `<g transform="translate(${sx} ${sy})"><g class="av-arm av-arm-${side}">
      <path d="M0 0 L${hx} ${hy}" stroke="${skin.line}" stroke-width="9.4" stroke-linecap="round"/>
      <path d="M0 0 L${hx} ${hy}" stroke="${skin.fill}" stroke-width="6.4" stroke-linecap="round"/>
      <path d="M0 0 L${ex} ${ey}" stroke="${top.line}" stroke-width="10.6" stroke-linecap="round"/>
      <path d="M0 0 L${ex} ${ey}" stroke="${top.fill}" stroke-width="7.6" stroke-linecap="round"/>
      ${side === 'r' ? `<g class="av-bow"><path d="M${hx + 4} ${hy + 5} L${hx - 12} ${hy - 30}" stroke="#7a4a26" stroke-width="1.6" stroke-linecap="round"/><path d="M${hx + 5.4} ${hy + 4.4} L${hx - 10.6} ${hy - 30.6}" stroke="#f3ead8" stroke-width=".9"/></g>` : ''}
    </g></g>`;
}

/**
 * The figure. `avatar` is the saved one (pet.avatar); `wear` overrides what it
 * has on, which is how the shop shows something being tried.
 */
export function avatarMarkup(avatar, { wear = {}, cls = '' } = {}) {
  const on = { ...(avatar?.wear || {}), ...wear };
  const skin = SKIN[avatar?.skin] || SKIN.s2;
  const h = HAIR[avatar?.hairColour] || HAIR.brown;
  const top = TOPS[on.top] || TOPS['top-tee'];
  const trousers = top.trousers || '#55627f';
  const trouserLine = top.trouserLine || '#343f58';
  const legs = top.skirt
    ? `<path d="M43.6 100 v20 M56.4 100 v20" stroke="${skin.line}" stroke-width="8.6" stroke-linecap="round"/><path d="M43.6 100 v20 M56.4 100 v20" stroke="${skin.fill}" stroke-width="5.6" stroke-linecap="round"/>`
    : `<path d="M43.6 98 v22 M56.4 98 v22" stroke="${trouserLine}" stroke-width="10.6" stroke-linecap="round"/><path d="M43.6 98 v22 M56.4 98 v22" stroke="${trousers}" stroke-width="7.6" stroke-linecap="round"/>`;
  const body = top.skirt
    ? `<path d="M39 62 Q50 58 61 62 L63 84 L70 106 Q50 112 30 106 L37 84 Z" fill="${top.fill}" stroke="${top.line}" stroke-width="1.8" stroke-linejoin="round"/>`
    : `<path d="M38 62 Q50 58 62 62 L63 98 Q50 102 37 98 Z" fill="${top.fill}" stroke="${top.line}" stroke-width="1.8" stroke-linejoin="round"/>`;
  return `
    <g class="av ${cls}">
      <ellipse class="av-shadow" cx="50" cy="127" rx="21" ry="3.6" fill="rgba(60,40,20,.14)"/>
      <g class="av-all">
        <g class="av-legs">
          ${legs}
          <ellipse cx="42.4" cy="124" rx="6.6" ry="3.8" fill="#fff6ea" stroke="#8b7d6b" stroke-width="1.5"/>
          <ellipse cx="57.6" cy="124" rx="6.6" ry="3.8" fill="#fff6ea" stroke="#8b7d6b" stroke-width="1.5"/>
        </g>
        <g transform="translate(50 98)"><g class="av-upper"><g transform="translate(-50 -98)">
          ${arm('l', skin, top)}
          ${body}
          ${top.over || ''}
          <g class="av-violin">
            <path d="M30 60 C24 57 20 61 22 66 C19 69 21 75 27 76 C32 77 36 73 35 69 C38 66 36 61 30 60 Z" fill="#b5763f" stroke="#7d4d24" stroke-width="1.4" stroke-linejoin="round"/>
            <path d="M24.6 62 L12 53" stroke="#4a3226" stroke-width="2.6" stroke-linecap="round"/><path d="M31 63.6 L15 52.4" stroke="#f3ead8" stroke-width=".7"/>
          </g>
          ${arm('r', skin, top)}
          <g class="av-head">
            ${hairBack(COVERS.has(on.hat) && on.hair === 'hair-buns' ? '' : on.hair, h)}
            <rect x="46" y="54" width="8" height="8" rx="3" fill="${skin.fill}" stroke="${skin.line}" stroke-width="1.5"/>
            <circle cx="27.6" cy="40" r="4" fill="${skin.fill}" stroke="${skin.line}" stroke-width="1.6"/><circle cx="72.4" cy="40" r="4" fill="${skin.fill}" stroke="${skin.line}" stroke-width="1.6"/>
            <ellipse cx="50" cy="37" rx="23" ry="21.4" fill="${skin.fill}" stroke="${skin.line}" stroke-width="1.8"/>
            ${extra(on.extra === 'extra-rosy' || on.extra === 'extra-freckles' ? on.extra : '')}
            ${eyes(on.eyes)}
            ${mouth(on.mouth)}
            ${hairFront(COVERS.has(on.hat) && TALL.has(on.hair) ? 'hair-short' : on.hair, h)}
            ${extra(on.extra === 'extra-glasses' || on.extra === 'extra-round' ? on.extra : '')}
            ${hat(on.hat)}
          </g>
        </g></g></g>
      </g>
    </g>`;
}

// A hat that sits right down on the head flattens hair that stands up.
const COVERS = new Set(['hat-cap', 'hat-beanie', 'hat-santa']);
const TALL = new Set(['hair-spiky', 'hair-curly', 'hair-buns']);

const MOVE_GLYPH = { 'move-wave': '👋', 'move-jump': '⤴', 'move-bow': '🙇', 'move-spin': '🔄', 'move-dance': '💃', 'move-violin': '🎻' };

/** A shop tile's picture: the student's own figure with the thing on, cropped to where it shows. */
export function avatarItemIcon(avatar, item) {
  if (item.slot === 'move') return `<span class="av-move-icon" aria-hidden="true">${MOVE_GLYPH[item.id] || '✨'}</span>`;
  const box = item.slot === 'top' ? '20 52 60 60' : '12 -10 78 72';
  const wear = { [item.slot]: item.id };
  // a hat is shown without the hat already worn; a haircut without any hat
  if (item.slot === 'hair') wear.hat = null;
  return `<svg class="av-icon" viewBox="${box}" aria-hidden="true">${avatarMarkup(avatar, { wear, cls: 'is-still' })}</svg>`;
}

/** The whole figure, standing still, for the "Me" tab. */
export function avatarPortrait(avatar, cls = '') {
  return `<svg class="av-portrait" viewBox="2 -12 96 144" aria-hidden="true">${avatarMarkup(avatar, { cls })}</svg>`;
}
