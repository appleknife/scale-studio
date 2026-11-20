// The student's own figure: drawn from what it is (skin, hair colour) and what it
// has on. One 100 × 130 box, feet at y 126.
//
// The look: a big, wide head on a small body, short round arms and legs, small
// eyes set wide with a little nose, flat bright colours with a soft shade or
// highlight here and there, and thin outlines in each part's own darker tone
// rather than a heavy dark line. The head is drawn in its own small frame (the
// face an ellipse about (50, 37)) and set onto the body by one transform, so
// hair, hats and glasses all fit any face the same way.
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
  black: { fill: '#34302f', line: '#1d1a1a', hi: '#5a5452' },
  brown: { fill: '#7a5236', line: '#4d3220', hi: '#a07253' },
  chestnut: { fill: '#a8603a', line: '#713c20', hi: '#cf8559' },
  blond: { fill: '#f4d27c', line: '#c49b3a', hi: '#fde9b0' },
  red: { fill: '#e0683a', line: '#a1421d', hi: '#f6936a' },
  grey: { fill: '#c3c6ce', line: '#8a8e98', hi: '#e6e8ec' },
  blue: { fill: '#6fa4e8', line: '#4573b3', hi: '#a3c8f4' },
  pink: { fill: '#f6a0c6', line: '#c96593', hi: '#fcc9e0' },
};
const INK = '#3b2c22';

export const skinFill = (id) => (SKIN[id] || SKIN.s2).fill;
export const hairFill = (id) => (HAIR[id] || HAIR.brown).fill;

// Each top: its colour, its outline, how far down the arm the sleeve comes
// (0–1), and what is drawn over the body. `legs` replaces the trousers.
const TOPS = {
  'top-tee': { fill: '#78b8ee', line: '#4f8cc0', sleeve: 0.4 },
  'top-stripes': {
    fill: '#fff6ea', line: '#c9b394', sleeve: 0.4,
    over: `<g stroke="#ee6b5f" stroke-width="3"><path d="M36.4 86 h27.2"/><path d="M35.6 92 h28.8"/><path d="M35 98 h30"/><path d="M34.6 103.6 h30.8"/></g>`,
  },
  'top-hoodie': {
    fill: '#8fd49b', line: '#55a062', sleeve: 0.92,
    over: `<path d="M41 78.4 q9 8.6 18 0" fill="none" stroke="#55a062" stroke-width="2" stroke-linecap="round"/>
      <path d="M47 82.6 v7 M53 82.6 v7" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>
      <path d="M41 95 h18 v6 q-9 3 -18 0 z" fill="#7fc68b" stroke="#55a062" stroke-width="1.3" stroke-linejoin="round"/>`,
  },
  'top-overalls': {
    fill: '#fff6ea', line: '#c9b394', sleeve: 0.4, trousers: '#5b8fd0', trouserLine: '#3e6ca8',
    over: `<path d="M41 88 h18 v19 h-18 z" fill="#5b8fd0" stroke="#3e6ca8" stroke-width="1.4" stroke-linejoin="round"/>
      <path d="M43 88.6 L40.6 79.4 M57 88.6 L59.4 79.4" stroke="#5b8fd0" stroke-width="3.2" stroke-linecap="round"/>
      <circle cx="43.6" cy="90" r="1.5" fill="#f6d77a"/><circle cx="56.4" cy="90" r="1.5" fill="#f6d77a"/>
      <path d="M45 96 h10 v5 h-10 z" fill="#6c9cdb" stroke="#3e6ca8" stroke-width="1.1"/>`,
  },
  'top-dress': {
    fill: '#f6a0c6', line: '#c96593', sleeve: 0.34, skirt: true,
    over: `<path d="M35.6 92 h28.8" stroke="#c96593" stroke-width="2"/><circle cx="50" cy="82.4" r="1.5" fill="#fff"/><circle cx="50" cy="87.4" r="1.5" fill="#fff"/>
      <g fill="#fff" opacity=".7"><circle cx="40" cy="101" r="1.3"/><circle cx="50" cy="104" r="1.3"/><circle cx="60" cy="101" r="1.3"/><circle cx="45" cy="108" r="1.3"/><circle cx="55" cy="108" r="1.3"/></g>`,
  },
  // What is worn to play to people: black, with a bow tie.
  'top-concert': {
    fill: '#3c3c47', line: '#24242c', sleeve: 0.94, trousers: '#2e2e37', trouserLine: '#1b1b21',
    over: `<path d="M45 77.6 L50 87.6 L55 77.6 Z" fill="#fff"/>
      <path d="M50 80.4 l-5 -2.8 v5.6 z M50 80.4 l5 -2.8 v5.6 z" fill="#d23d33" stroke="#8f1f1a" stroke-width=".9" stroke-linejoin="round"/>
      <circle cx="50" cy="92" r="1.2" fill="#fff"/><circle cx="50" cy="98" r="1.2" fill="#fff"/>`,
  },
  'top-xmas': {
    fill: '#d23d33', line: '#93231d', sleeve: 0.92,
    over: `<path d="M36.4 87 l3 -3 l3 3 l3 -3 l3 3 l3 -3 l3 3 l3 -3 l3 3 l3 -3 l2.6 3" fill="none" stroke="#fff" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>
      <path d="M50 90.4 l4.6 8 h-9.2 z" fill="#3f9a6b" stroke="#2c6e4f" stroke-width="1.1" stroke-linejoin="round"/><circle cx="50" cy="90" r="1.4" fill="#f6d77a"/>
      <path d="M35.2 102.4 h29.6" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`,
  },
};

function hairBack(style, h) {
  const a = `fill="${h.fill}" stroke="${h.line}" stroke-width="1.1" stroke-linejoin="round"`;
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
  const shape = hairFrontShape(style, h);
  if (!shape) return '';
  // a soft highlight across the crown, the way flat cartoon hair catches light
  const shine = style === 'hair-curly' || style === 'hair-spiky'
    ? `<path d="M40 15 q10 -5 20 0" fill="none" stroke="${h.hi}" stroke-width="2.4" stroke-linecap="round" opacity=".75"/>`
    : `<path d="M37 16.5 q8 -6.5 17 -5.5" fill="none" stroke="${h.hi}" stroke-width="2.6" stroke-linecap="round" opacity=".8"/>`;
  return shape + shine;
}

function hairFrontShape(style, h) {
  const a = `fill="${h.fill}" stroke="${h.line}" stroke-width="1.1" stroke-linejoin="round"`;
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
      return `<path d="M25.4 37 C21 3 79 3 74.6 37 C71 28 60 22 50 21 C40 22 29 28 25.4 37 Z" ${a}/><path d="M50 12 v9" stroke="${h.line}" stroke-width="1.1" stroke-linecap="round"/>`;
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
      return `<g class="av-eyes"><ellipse cx="40.6" cy="39.6" rx="3" ry="3.5" fill="${INK}"/><ellipse cx="59.4" cy="39.6" rx="3" ry="3.5" fill="${INK}"/>
        <circle cx="41.7" cy="38.2" r="1.25" fill="#fff"/><circle cx="60.5" cy="38.2" r="1.25" fill="#fff"/></g>`;
    case 'eyes-lash':
      return `<g class="av-eyes"><ellipse cx="40.6" cy="40" rx="2.1" ry="2.7" fill="${INK}"/><ellipse cx="59.4" cy="40" rx="2.1" ry="2.7" fill="${INK}"/>
        <circle cx="41.3" cy="39" r=".75" fill="#fff"/><circle cx="60.1" cy="39" r=".75" fill="#fff"/>
        <path d="M37.6 38 l-2.2 -1.6 M38.4 36.6 l-1.3 -2.1 M62.4 38 l2.2 -1.6 M61.6 36.6 l1.3 -2.1" stroke="${INK}" stroke-width="1.1" stroke-linecap="round"/></g>`;
    case 'eyes-happy':
      return `<g class="av-eyes" fill="none" stroke="${INK}" stroke-width="1.9" stroke-linecap="round"><path d="M37.6 40.6 q3 -3.8 6 0"/><path d="M56.4 40.6 q3 -3.8 6 0"/></g>`;
    default:
      return `<g class="av-eyes"><ellipse cx="40.6" cy="40" rx="2.1" ry="2.7" fill="${INK}"/><ellipse cx="59.4" cy="40" rx="2.1" ry="2.7" fill="${INK}"/>
        <circle cx="41.3" cy="39" r=".75" fill="#fff"/><circle cx="60.1" cy="39" r=".75" fill="#fff"/></g>`;
  }
}

/** A small round nose, a shade darker than the face — the look's one detail in the middle. */
const nose = (skin) => `<ellipse cx="50" cy="44.2" rx="2.4" ry="1.7" fill="${skin.line}" opacity=".45"/>`;

function mouth(style) {
  switch (style) {
    case 'mouth-grin':
      return `<path d="M45.6 48 h8.8 q-.8 5 -4.4 5 q-3.6 0 -4.4 -5 z" fill="#9a3b3b" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/><path d="M46.8 48.6 h6.4 v1.5 h-6.4 z" fill="#fff"/>`;
    case 'mouth-o':
      return `<ellipse cx="50" cy="50" rx="2" ry="2.5" fill="#9a3b3b" stroke="${INK}" stroke-width="1.1"/>`;
    default:
      return `<path d="M46.4 48.6 q3.6 3.4 7.2 0" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`;
  }
}

function extra(style) {
  switch (style) {
    case 'extra-glasses':
      return `<g fill="rgba(255,255,255,.3)" stroke="#3d4a5c" stroke-width="1.4"><rect x="34" y="35.2" width="13.2" height="9.4" rx="3"/><rect x="52.8" y="35.2" width="13.2" height="9.4" rx="3"/></g>
        <path d="M47.2 39.2 h5.6 M34 38.6 l-5 -1.4 M66 38.6 l5 -1.4" stroke="#3d4a5c" stroke-width="1.4" stroke-linecap="round" fill="none"/>`;
    case 'extra-round':
      return `<g fill="rgba(255,255,255,.3)" stroke="#c07f2e" stroke-width="1.4"><circle cx="40.6" cy="40" r="6.2"/><circle cx="59.4" cy="40" r="6.2"/></g>
        <path d="M46.8 39.6 h6.4 M34.4 39 l-5.4 -1.6 M65.6 39 l5.4 -1.6" stroke="#c07f2e" stroke-width="1.4" stroke-linecap="round" fill="none"/>`;
    case 'extra-freckles':
      return `<g fill="#b9774f" opacity=".7"><circle cx="34.6" cy="45.6" r=".9"/><circle cx="37.6" cy="47.2" r=".9"/><circle cx="35.6" cy="48.8" r=".9"/><circle cx="65.4" cy="45.6" r=".9"/><circle cx="62.4" cy="47.2" r=".9"/><circle cx="64.4" cy="48.8" r=".9"/></g>`;
    case 'extra-rosy':
      return `<g fill="#f47c86" opacity=".6"><ellipse cx="34.6" cy="46.6" rx="4.6" ry="2.9"/><ellipse cx="65.4" cy="46.6" rx="4.6" ry="2.9"/></g>`;
    default:
      return '';
  }
}

function hat(style) {
  switch (style) {
    case 'hat-bow':
      return `<g transform="translate(64 17) rotate(18)"><path d="M0 0 l-9 -5.5 v11 z M0 0 l9 -5.5 v11 z" fill="#e0685c" stroke="#a83a30" stroke-width="1.1" stroke-linejoin="round"/><circle r="2.8" fill="#f08a7e" stroke="#a83a30" stroke-width="1.2"/></g>`;
    case 'hat-cap':
      return `<path d="M24.6 27 C24 0 76 0 75.4 27 Z" fill="#5b8fd0" stroke="#3b6aa5" stroke-width="1.2" stroke-linejoin="round"/>
        <path d="M72 26.4 C82 25 89 28 90 31.6 C84 32 78 31 72 29.6 Z" fill="#4a7dbd" stroke="#3b6aa5" stroke-width="1.1" stroke-linejoin="round"/><circle cx="50" cy="6.8" r="2" fill="#3b6aa5"/>`;
    case 'hat-beanie':
      return `<path d="M24.8 29 C22 -1 78 -1 75.2 29 Z" fill="#f2a64a" stroke="#b9732a" stroke-width="1.2" stroke-linejoin="round"/>
        <rect x="23.4" y="24.4" width="53.2" height="8" rx="4" fill="#f8c27c" stroke="#b9732a" stroke-width="1.1"/><circle cx="50" cy="3.4" r="5.2" fill="#fff6ea" stroke="#c9b592" stroke-width="1.1"/>`;
    case 'hat-crown':
      return `<g transform="translate(0 -6)"><path d="M32 26 L30 8 L40 17 L50 4 L60 17 L70 8 L68 26 Z" fill="#f6c84c" stroke="#c9952a" stroke-width="1.2" stroke-linejoin="round"/>
        <circle cx="50" cy="20" r="2.4" fill="#e0685c"/><circle cx="39.6" cy="21.4" r="1.7" fill="#5b8fd0"/><circle cx="60.4" cy="21.4" r="1.7" fill="#5b8fd0"/></g>`;
    case 'hat-santa':
      return `<path d="M24.8 27 C25 0 62 -6 80 18 C74 17 72 22 75.2 27 Z" fill="#c8372f" stroke="#8f1f1a" stroke-width="1.2" stroke-linejoin="round"/>
        <rect x="23.2" y="23.4" width="53.6" height="8.4" rx="4.2" fill="#fff" stroke="#c9d3dc" stroke-width="1.1"/><circle cx="81.4" cy="19.6" r="5" fill="#fff" stroke="#c9d3dc" stroke-width="1.1"/>`;
    default:
      return '';
  }
}

/** One arm, hanging from its shoulder: skin, a round hand, and as much sleeve as the top has. */
function arm(side, skin, top) {
  // Drawn from its own shoulder at (0, 0), inside a group that puts the shoulder
  // in place: a CSS rotation on `.av-arm` then turns about the shoulder whatever
  // else is drawn in the arm.
  const sx = side === 'l' ? 37.4 : 62.6;
  const sy = 82.4;
  const hx = side === 'l' ? -7 : 7;
  const hy = 17.6;
  const ex = (hx * top.sleeve).toFixed(1);
  const ey = (hy * top.sleeve).toFixed(1);
  return `<g transform="translate(${sx} ${sy})"><g class="av-arm av-arm-${side}">
      <path d="M0 0 L${hx} ${hy}" stroke="${skin.line}" stroke-width="8.4" stroke-linecap="round"/>
      <path d="M0 0 L${hx} ${hy}" stroke="${skin.fill}" stroke-width="6.2" stroke-linecap="round"/>
      <circle cx="${hx}" cy="${hy + 0.6}" r="3.9" fill="${skin.fill}" stroke="${skin.line}" stroke-width="1.1"/>
      <path d="M0 0 L${ex} ${ey}" stroke="${top.line}" stroke-width="9.8" stroke-linecap="round"/>
      <path d="M0 0 L${ex} ${ey}" stroke="${top.fill}" stroke-width="7.6" stroke-linecap="round"/>
      ${side === 'r' ? `<g class="av-bow"><path d="M${hx + 4} ${hy + 5} L${hx - 12} ${hy - 30}" stroke="#7a4a26" stroke-width="1.6" stroke-linecap="round"/><path d="M${hx + 5.4} ${hy + 4.4} L${hx - 10.6} ${hy - 30.6}" stroke="#f3ead8" stroke-width=".9"/></g>` : ''}
    </g></g>`;
}

// The head is drawn about a face at (50, 37), 46 wide; this sets it on the
// body, wider than it is tall and big — the look's main idea.
const HEAD = 'translate(50 49.6) scale(1.4 1.22) translate(-50 -37)';

/**
 * The figure. `avatar` is the saved one (pet.avatar); `wear` overrides what it
 * has on, which is how the shop shows something being tried.
 */
export function avatarMarkup(avatar, { wear = {}, cls = '' } = {}) {
  const on = { ...(avatar?.wear || {}), ...wear };
  const skin = SKIN[avatar?.skin] || SKIN.s2;
  const h = HAIR[avatar?.hairColour] || HAIR.brown;
  const top = TOPS[on.top] || TOPS['top-tee'];
  const trousers = top.trousers || '#5a6888';
  const trouserLine = top.trouserLine || '#3c475f';
  const legs = top.skirt
    ? `<path d="M44 106 v12 M56 106 v12" stroke="${skin.line}" stroke-width="8.2" stroke-linecap="round"/><path d="M44 106 v12 M56 106 v12" stroke="${skin.fill}" stroke-width="6" stroke-linecap="round"/>`
    : `<path d="M44 101 v17 M56 101 v17" stroke="${trouserLine}" stroke-width="10" stroke-linecap="round"/><path d="M44 101 v17 M56 101 v17" stroke="${trousers}" stroke-width="7.8" stroke-linecap="round"/>`;
  const body = top.skirt
    ? `<path d="M37.6 79 Q50 74.4 62.4 79 L65 92 L71.4 109.6 Q50 115 28.6 109.6 L35 92 Z" fill="${top.fill}" stroke="${top.line}" stroke-width="1.2" stroke-linejoin="round"/>`
    : `<path d="M37.6 79 Q50 74.4 62.4 79 Q66 91 66.2 104 Q50 109 33.8 104 Q34 91 37.6 79 Z" fill="${top.fill}" stroke="${top.line}" stroke-width="1.2" stroke-linejoin="round"/>`;
  // flat shading down one side of the body, as a cartoon lit from the left
  const shade = top.skirt
    ? `<path d="M58 80 L62.4 79 L65 92 L71.4 109.6 Q66 111.4 60 112 Z" fill="#000" opacity=".07"/>`
    : `<path d="M58 79.6 L62.4 79 Q66 91 66.2 104 Q63 105.2 59 106 Z" fill="#000" opacity=".07"/>`;
  // sneakers: white, with a coloured toe and sole
  const shoe = (x) => `<path d="M${x - 7} 122 q0 -6 7 -6 q7.4 0 7.4 6 q0 3.6 -7.2 3.6 q-7.2 0 -7.2 -3.6 z" fill="#ffffff" stroke="#b9afa2" stroke-width="1.1"/>
          <path d="M${x - 7} 122.6 q7 3.2 14.4 0 q-.2 3 -7.2 3 q-7 0 -7.2 -3 z" fill="#f2836b"/>`;
  return `
    <g class="av ${cls}">
      <ellipse class="av-shadow" cx="50" cy="127" rx="20" ry="3.4" fill="rgba(60,40,20,.14)"/>
      <g class="av-all">
        <g class="av-legs">
          ${legs}
          ${shoe(43.4)}
          ${shoe(56.6)}
        </g>
        <g transform="translate(50 104)"><g class="av-upper"><g transform="translate(-50 -104)">
          ${arm('l', skin, top)}
          ${body}
          ${shade}
          ${top.over || ''}
          <g class="av-violin" transform="translate(1 15)">
            <path d="M30 60 C24 57 20 61 22 66 C19 69 21 75 27 76 C32 77 36 73 35 69 C38 66 36 61 30 60 Z" fill="#b5763f" stroke="#7d4d24" stroke-width="1.2" stroke-linejoin="round"/>
            <path d="M24.6 62 L12 53" stroke="#4a3226" stroke-width="2.6" stroke-linecap="round"/><path d="M31 63.6 L15 52.4" stroke="#f3ead8" stroke-width=".7"/>
          </g>
          ${arm('r', skin, top)}
          <rect x="45.6" y="70" width="8.8" height="10" rx="3.4" fill="${skin.fill}" stroke="${skin.line}" stroke-width="1.1"/>
          <g class="av-head" transform="${HEAD}">
            ${hairBack(COVERS.has(on.hat) && on.hair === 'hair-buns' ? '' : on.hair, h)}
            <circle cx="27.6" cy="40.4" r="3.4" fill="${skin.fill}" stroke="${skin.line}" stroke-width="1"/><circle cx="72.4" cy="40.4" r="3.4" fill="${skin.fill}" stroke="${skin.line}" stroke-width="1"/>
            <ellipse cx="50" cy="37" rx="23" ry="21.4" fill="${skin.fill}" stroke="${skin.line}" stroke-width="1.1"/>
            <ellipse cx="34.8" cy="46.4" rx="3.8" ry="2.3" fill="#f47c86" opacity=".22"/><ellipse cx="65.2" cy="46.4" rx="3.8" ry="2.3" fill="#f47c86" opacity=".22"/>
            ${extra(on.extra === 'extra-rosy' || on.extra === 'extra-freckles' ? on.extra : '')}
            ${eyes(on.eyes)}
            ${nose(skin)}
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
  const box = item.slot === 'top' ? '16 66 68 54' : '6 -10 88 88';
  const wear = { [item.slot]: item.id };
  // a hat is shown without the hat already worn; a haircut without any hat
  if (item.slot === 'hair') wear.hat = null;
  return `<svg class="av-icon" viewBox="${box}" aria-hidden="true">${avatarMarkup(avatar, { wear, cls: 'is-still' })}</svg>`;
}

/** The whole figure, standing still, for the "Me" tab. */
export function avatarPortrait(avatar, cls = '') {
  return `<svg class="av-portrait" viewBox="0 -10 100 140" aria-hidden="true">${avatarMarkup(avatar, { cls })}</svg>`;
}
