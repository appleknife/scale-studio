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
  'top-rainbow': {
    fill: '#fffaf0', line: '#cdbb9c', sleeve: 0.4,
    over: `<g fill="none" stroke-width="2.6" stroke-linecap="round"><path d="M40 99 a10 10 0 0 1 20 0" stroke="#ef6a5e"/><path d="M42.8 99 a7.2 7.2 0 0 1 14.4 0" stroke="#f6c24c"/><path d="M45.6 99 a4.4 4.4 0 0 1 8.8 0" stroke="#5bb4e5"/></g>
      <g fill="#fff" stroke="#cdd6df" stroke-width=".9"><ellipse cx="40" cy="99.6" rx="3.4" ry="2.2"/><ellipse cx="60" cy="99.6" rx="3.4" ry="2.2"/></g>`,
  },
  'top-music': {
    fill: '#2f4f7a', line: '#1d3352', sleeve: 0.4,
    over: `<g fill="#fff"><ellipse cx="45.4" cy="97" rx="3" ry="2.2" transform="rotate(-20 45.4 97)"/><ellipse cx="55.4" cy="95" rx="3" ry="2.2" transform="rotate(-20 55.4 95)"/></g>
      <path d="M48 96.4 V85.6 L58 83.6 V94.4" fill="none" stroke="#fff" stroke-width="1.7" stroke-linejoin="round"/><path d="M48 86 L58 84" stroke="#fff" stroke-width="3.2"/>`,
  },
  'top-jersey': {
    fill: '#e9473f', line: '#a62b25', sleeve: 0.4,
    over: `<path d="M43.6 77.4 q6.4 5 12.8 0" fill="none" stroke="#fff" stroke-width="2.2"/>
      <text x="50" y="99.6" text-anchor="middle" font-family="Arial Rounded MT Bold, Arial, sans-serif" font-weight="800" font-size="15" fill="#fff">7</text>
      <path d="M34.4 103.4 h31.2" stroke="#fff" stroke-width="2"/>`,
    cuff: '#fff',
  },
  'top-sweater': {
    fill: '#f4b84f', line: '#c48a26', sleeve: 0.94,
    over: `<path d="M50 99.6 l-6.2 -6 a3.6 3.6 0 0 1 6.2 -4.6 a3.6 3.6 0 0 1 6.2 4.6 z" fill="#e8576b" stroke="#b33a4c" stroke-width="1" stroke-linejoin="round"/>
      <g stroke="#c48a26" stroke-width="1.1" opacity=".7"><path d="M36 102 v3 M39 102.3 v3 M42 102.5 v3 M45 102.6 v3 M48 102.7 v3 M51 102.7 v3 M54 102.6 v3 M57 102.5 v3 M60 102.3 v3 M63 102 v3"/></g>`,
  },
  'top-pyjamas': {
    fill: '#a9cbf2', line: '#6f97c8', sleeve: 0.94, trousers: '#a9cbf2', trouserLine: '#6f97c8',
    over: `<g fill="#fff6c2"><path d="M42 85 l1 2 l2.2 .3 l-1.6 1.5 l.4 2.2 l-2 -1 l-2 1 l.4 -2.2 l-1.6 -1.5 l2.2 -.3 z"/><path d="M57 92 l1 2 l2.2 .3 l-1.6 1.5 l.4 2.2 l-2 -1 l-2 1 l.4 -2.2 l-1.6 -1.5 l2.2 -.3 z"/><circle cx="47" cy="99" r="1.2"/><circle cx="58" cy="83" r="1.1"/><circle cx="40" cy="96" r="1"/></g>
      <g fill="#fff" stroke="#6f97c8" stroke-width=".8"><circle cx="50" cy="84" r="1.3"/><circle cx="50" cy="90" r="1.3"/><circle cx="50" cy="96" r="1.3"/></g>`,
  },
  'top-raincoat': {
    fill: '#f9d03f', line: '#c99d14', sleeve: 0.94,
    over: `<path d="M41.4 78.2 q8.6 6 17.2 0 l-1.4 -2 q-7.2 4 -14.4 0 z" fill="#f9d03f" stroke="#c99d14" stroke-width="1.1" stroke-linejoin="round"/>
      <path d="M50 81 V106" stroke="#c99d14" stroke-width="1.2"/>
      <g fill="#fff" stroke="#c99d14" stroke-width="1"><circle cx="47" cy="86" r="1.5"/><circle cx="47" cy="93" r="1.5"/><circle cx="47" cy="100" r="1.5"/></g>
      <path d="M38 97 h7 v4 h-7 z M55 97 h7 v4 h-7 z" fill="none" stroke="#c99d14" stroke-width="1.1" stroke-linejoin="round"/>`,
  },
  'top-jacket': {
    fill: '#5f8fd0', line: '#3e6ca8', sleeve: 0.94,
    over: `<path d="M44 77 L50 80 L56 77 L56.6 106.6 Q50 108 43.4 106.6 Z" fill="#fff6ea" stroke="#d4c3a6" stroke-width=".9"/>
      <path d="M44 77 L40.6 84 L44.6 86 L43.4 106.4 M56 77 L59.4 84 L55.4 86 L56.6 106.4" fill="none" stroke="#3e6ca8" stroke-width="1.3" stroke-linejoin="round"/>
      <path d="M37.6 88 h4.6 M57.8 88 h4.6" stroke="#9cbbe5" stroke-width="1.2" stroke-dasharray="1.4 1.2"/>
      <g fill="#f6d77a"><circle cx="41" cy="96" r="1"/><circle cx="59" cy="96" r="1"/></g>`,
  },
  // A leotard with a puff of tulle, over pink tights.
  'top-tutu': {
    fill: '#f7a8c9', line: '#d06a96', sleeve: 0, trousers: '#fbd3e3', trouserLine: '#e09cb9',
    over: `<path d="M27 101 q4 -6 8 -2 q3 -5 7.5 -1 q3.5 -4.4 7.5 -.6 q4 -3.8 7.5 .6 q4.5 -4 7.5 1 q4 -4 8 2 q-3 6 -8 3.4 q-3.4 4 -7.5 1 q-3.8 3.6 -7.5 .4 q-3.8 3.2 -7.5 -.4 q-4 3 -7.5 -1 q-5 2.6 -8 -3.4 z" fill="#fcd2e2" stroke="#e08db0" stroke-width="1.1" stroke-linejoin="round"/>
      <g fill="#fff" opacity=".85"><circle cx="36" cy="101" r=".9"/><circle cx="44" cy="102.6" r=".9"/><circle cx="56" cy="102.6" r=".9"/><circle cx="64" cy="101" r=".9"/><circle cx="50" cy="101.4" r=".9"/></g>
      <path d="M50 81.4 l-3 -1.7 v3.4 z M50 81.4 l3 -1.7 v3.4 z" fill="#fff" stroke="#d06a96" stroke-width=".7"/>`,
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
    case 'hair-wavy':
      return `<path d="M26 34 C23 10 77 10 74 34 C80 42 72 48 78 56 C84 64 74 70 70 70 C66 72 63 68 62 64 L38 64 C37 68 34 72 30 70 C26 70 16 64 22 56 C28 48 20 42 26 34 Z" ${a}/>`;
    case 'hair-pigtails':
      return `<g ${a}><path d="M28 27 C19 22 13 30 16 40 C17.6 45 21.6 45.6 23.4 42.6 C20.6 38 21.6 33 27 32.6 Z"/><path d="M72 27 C81 22 87 30 84 40 C82.4 45 78.4 45.6 76.6 42.6 C79.4 38 78.4 33 73 32.6 Z"/></g>
        <circle cx="27" cy="29.6" r="2.4" fill="#6fc0e8"/><circle cx="73" cy="29.6" r="2.4" fill="#6fc0e8"/>`;
    case 'hair-topknot':
      return `<g ${a}><circle cx="50" cy="7" r="9"/></g><path d="M45 13.6 q5 2.4 10 0" fill="none" stroke="${h.line}" stroke-width="1" opacity=".6"/>`;
    case 'hair-afro':
      return `<g ${a}><circle cx="50" cy="26" r="28"/><circle cx="25" cy="38" r="11"/><circle cx="75" cy="38" r="11"/><circle cx="30" cy="16" r="11"/><circle cx="70" cy="16" r="11"/></g>`;
    default:
      return '';
  }
}

function hairFront(style, h) {
  const shape = hairFrontShape(style, h);
  if (!shape) return '';
  // a soft highlight across the crown, the way flat cartoon hair catches light
  if (style === 'hair-mohawk') return shape;
  const shine = style === 'hair-curly' || style === 'hair-spiky' || style === 'hair-afro'
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
    case 'hair-fringe':
      // straight bangs, a neat bowl
      return `<path d="M25 42 C20 3 80 3 75 42 L73.4 42 Q72 33 70 30 L30 30 Q28 33 26.6 42 Z" ${a}/><path d="M33 30 v-3 M40 30 v-3.4 M47 30 v-3.6 M54 30 v-3.6 M61 30 v-3.4 M68 30 v-3" stroke="${h.line}" stroke-width=".9" stroke-linecap="round" opacity=".55"/>`;
    case 'hair-wavy':
      // a side part, with a wave over one eye
      return `<path d="M25.4 37 C21 3 79 3 74.6 37 C70 28 62 24 56 23 C52 28 44 27 40 30 C36 32 30 33 25.4 37 Z" ${a}/>`;
    case 'hair-pigtails':
    case 'hair-topknot':
      return `<path d="M25.4 36 C21 3 79 3 74.6 36 C69 27 60 23 50 23 C40 23 31 27 25.4 36 Z" ${a}/>`;
    case 'hair-afro':
      return `<g ${a}><circle cx="34" cy="20" r="9"/><circle cx="50" cy="15" r="10"/><circle cx="66" cy="20" r="9"/><circle cx="27" cy="31" r="6.6"/><circle cx="73" cy="31" r="6.6"/></g>
        <path d="M28 33 C36 24 64 24 72 33 C64 20 36 20 28 33 Z" fill="${h.fill}"/>`;
    case 'hair-mohawk':
      // shaved sides, and a tall strip down the middle
      return `<path d="M27 33 C25.4 17 74.6 17 73 33 C66 28 34 28 27 33 Z" fill="${h.fill}" opacity=".35"/>
        <path d="M43 26 C40 14 43 2 46 -4 L48.6 2 L51 -6 L53.6 1.6 L57 -3 C59 6 60 16 57 26 Z" ${a}/>`;
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
    case 'eyes-wink':
      return `<g class="av-eyes"><ellipse cx="40.6" cy="40" rx="2.1" ry="2.7" fill="${INK}"/><circle cx="41.3" cy="39" r=".75" fill="#fff"/>
        <path d="M56.4 40.4 q3 2.6 6 0" fill="none" stroke="${INK}" stroke-width="1.9" stroke-linecap="round"/></g>`;
    case 'eyes-sleepy':
      return `<g class="av-eyes"><path d="M38.2 39.6 a2.4 2.4 0 0 0 4.8 0 z M57 39.6 a2.4 2.4 0 0 0 4.8 0 z" fill="${INK}"/>
        <path d="M37.6 39.6 h6 M56.4 39.6 h6" stroke="${INK}" stroke-width="1.5" stroke-linecap="round"/></g>`;
    case 'eyes-star': {
      const star = (x, y) => `<path d="M${x} ${y - 1.8} l.55 1.25 l1.25 .55 l-1.25 .55 l-.55 1.25 l-.55 -1.25 l-1.25 -.55 l1.25 -.55 z" fill="#fff"/>`;
      return `<g class="av-eyes"><ellipse cx="40.6" cy="39.6" rx="3.1" ry="3.6" fill="#3a3263"/><ellipse cx="59.4" cy="39.6" rx="3.1" ry="3.6" fill="#3a3263"/>
        ${star(41.4, 38.6)}${star(60.2, 38.6)}<circle cx="39.4" cy="41.4" r=".6" fill="#fff"/><circle cx="58.2" cy="41.4" r=".6" fill="#fff"/></g>`;
    }
    case 'eyes-heart': {
      const heart = (x, y) => `<path d="M${x} ${y + 2.6} l-3 -2.9 a1.8 1.8 0 0 1 3 -2.3 a1.8 1.8 0 0 1 3 2.3 z" fill="#e8496a" stroke="#a82844" stroke-width=".6" stroke-linejoin="round"/>`;
      return `<g class="av-eyes">${heart(40.6, 39.6)}${heart(59.4, 39.6)}</g>`;
    }
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
    case 'mouth-teeth':
      return `<path d="M45.8 48.2 q4.2 4.4 8.4 0 z" fill="#9a3b3b" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/><path d="M48.4 48.3 h3.2 v1.9 h-3.2 z" fill="#fff"/><path d="M50 48.3 v1.9" stroke="#d9cfc4" stroke-width=".4"/>`;
    case 'mouth-tongue':
      return `<path d="M45.8 48.2 h8.4 q-.6 3.6 -4.2 3.6 q-3.6 0 -4.2 -3.6 z" fill="#9a3b3b" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/><path d="M48 50.4 q2 4.6 4 0 z" fill="#f2788c" stroke="#c4475c" stroke-width=".8" stroke-linejoin="round"/>`;
    case 'mouth-cat':
      return `<path d="M45.6 48.4 q2.2 2.8 4.4 0 q2.2 2.8 4.4 0" fill="none" stroke="${INK}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`;
    case 'mouth-smirk':
      return `<path d="M46.6 49.6 q4.2 1.4 7.4 -1.8" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`;
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
    case 'extra-sunglasses':
      return `<g fill="#26272e" stroke="#16161b" stroke-width="1.2"><rect x="33.6" y="35" width="14" height="10" rx="4"/><rect x="52.4" y="35" width="14" height="10" rx="4"/></g>
        <path d="M47.6 38.6 h4.8 M33.6 38.4 l-5 -1.4 M66.4 38.4 l5 -1.4" stroke="#16161b" stroke-width="1.4" stroke-linecap="round" fill="none"/>
        <path d="M36 37.4 l3 -1 M54.8 37.4 l3 -1" stroke="#fff" stroke-width="1.1" stroke-linecap="round" opacity=".6"/>`;
    case 'extra-hearts': {
      const lens = (x) => `<path d="M${x} 46.4 l-7 -6.4 a4 4 0 0 1 7 -5.2 a4 4 0 0 1 7 5.2 z" fill="rgba(255,120,160,.35)" stroke="#e5487a" stroke-width="1.5" stroke-linejoin="round"/>`;
      return `${lens(40.6)}${lens(59.4)}<path d="M47.6 37.6 h4.8 M33.6 38.4 l-4.6 -1.4 M66.4 38.4 l4.6 -1.4" stroke="#e5487a" stroke-width="1.4" stroke-linecap="round" fill="none"/>`;
    }
    case 'extra-stars': {
      const lens = (x) => `<path d="M${x} 32.4 l2.2 4.6 l5 .6 l-3.7 3.4 l1 5 l-4.5 -2.5 l-4.5 2.5 l1 -5 l-3.7 -3.4 l5 -.6 z" fill="rgba(255,214,90,.35)" stroke="#e1a91c" stroke-width="1.4" stroke-linejoin="round"/>`;
      return `${lens(40.6)}${lens(59.4)}<path d="M47.4 39 h5.2 M33.2 38.4 l-4.4 -1.4 M66.8 38.4 l4.4 -1.4" stroke="#e1a91c" stroke-width="1.4" stroke-linecap="round" fill="none"/>`;
    }
    case 'extra-freckles':
      return `<g fill="#b9774f" opacity=".7"><circle cx="34.6" cy="45.6" r=".9"/><circle cx="37.6" cy="47.2" r=".9"/><circle cx="35.6" cy="48.8" r=".9"/><circle cx="65.4" cy="45.6" r=".9"/><circle cx="62.4" cy="47.2" r=".9"/><circle cx="64.4" cy="48.8" r=".9"/></g>`;
    case 'extra-rosy':
      return `<g fill="#f47c86" opacity=".6"><ellipse cx="34.6" cy="46.6" rx="4.6" ry="2.9"/><ellipse cx="65.4" cy="46.6" rx="4.6" ry="2.9"/></g>`;
    default:
      return '';
  }
}

/**
 * Makeup and face paint, in the head's frame. `under` is drawn before the eyes
 * (eyeshadow, cheeks, paint), `over` after the mouth (lip gloss, whiskers).
 */
function makeup(style, where) {
  const sparkle = (x, y, r = 1.6, c = '#fff') => `<path d="M${x} ${y - r} l${r * 0.3} ${r * 0.7} l${r * 0.7} ${r * 0.3} l${-r * 0.7} ${r * 0.3} l${-r * 0.3} ${r * 0.7} l${-r * 0.3} ${-r * 0.7} l${-r * 0.7} ${-r * 0.3} l${r * 0.7} ${-r * 0.3} z" fill="${c}"/>`;
  if (where === 'under') {
    switch (style) {
      case 'makeup-blush':
        return `<g fill="#f2648a" opacity=".42"><ellipse cx="34.4" cy="46.2" rx="5.6" ry="3.6"/><ellipse cx="65.6" cy="46.2" rx="5.6" ry="3.6"/></g>`;
      case 'makeup-shadow':
        return `<g fill="#a77ce0" opacity=".7"><path d="M36.4 38.6 q4.2 -6 8.4 0 q-4.2 -2.4 -8.4 0 z"/><path d="M55.2 38.6 q4.2 -6 8.4 0 q-4.2 -2.4 -8.4 0 z"/></g>${sparkle(44.6, 34.6, 1.3)}${sparkle(63.4, 34.6, 1.3)}`;
      case 'makeup-glitter':
        return `<g fill="#f7a8d0" opacity=".5"><ellipse cx="34.4" cy="46.2" rx="5" ry="3.2"/><ellipse cx="65.6" cy="46.2" rx="5" ry="3.2"/></g>
          ${sparkle(32.4, 45, 1.5, '#fff')}${sparkle(36.6, 47.6, 1.1, '#ffe27a')}${sparkle(34, 49, .9, '#fff')}${sparkle(67.6, 45, 1.5, '#fff')}${sparkle(63.4, 47.6, 1.1, '#ffe27a')}${sparkle(66, 49, .9, '#fff')}`;
      case 'makeup-hearts': {
        const heart = (x, y) => `<path d="M${x} ${y + 2} l-2.4 -2.3 a1.4 1.4 0 0 1 2.4 -1.8 a1.4 1.4 0 0 1 2.4 1.8 z" fill="#ff6f91"/>`;
        return heart(34.2, 45.6) + heart(65.8, 45.6);
      }
      case 'makeup-star':
        // a star up beside the eye, on the temple, with two little sparkles
        return `<path d="M67 27.4 l1.7 3.5 l3.8 .5 l-2.8 2.6 l.7 3.8 l-3.4 -1.9 l-3.4 1.9 l.7 -3.8 l-2.8 -2.6 l3.8 -.5 z" fill="#ffd34d" stroke="#e0a91a" stroke-width=".7" stroke-linejoin="round"/>
          ${sparkle(63, 27, 1.1, '#b98cf0')}${sparkle(68.6, 41.8, 1, '#b98cf0')}`;
      case 'makeup-rainbow':
        return `<g fill="none" stroke-width="1.6" stroke-linecap="round" opacity=".9"><path d="M60.4 49 a5.4 5.4 0 0 1 10.8 0" stroke="#ef6a5e"/><path d="M62 49 a3.8 3.8 0 0 1 7.6 0" stroke="#f6c24c"/><path d="M63.6 49 a2.2 2.2 0 0 1 4.4 0" stroke="#5bb4e5"/></g>
          <g fill="#fff"><ellipse cx="60.4" cy="49.4" rx="1.8" ry="1"/><ellipse cx="71.2" cy="49.4" rx="1.8" ry="1"/></g>`;
      default:
        return '';
    }
  }
  switch (style) {
    case 'makeup-lips':
      return `<path d="M46.2 48.4 q1.9 -1.4 3.8 0 q1.9 -1.4 3.8 0 q-1.2 3.6 -3.8 3.6 q-2.6 0 -3.8 -3.6 z" fill="#e8577e" stroke="#b83a5c" stroke-width=".8" stroke-linejoin="round"/><path d="M47.6 49.8 q1 .6 2 .2" stroke="#fff" stroke-width=".6" stroke-linecap="round" opacity=".7"/>`;
    case 'makeup-whiskers':
      return `<ellipse cx="50" cy="44" rx="2.6" ry="1.9" fill="#3b2c22"/>
        <g stroke="#3b2c22" stroke-width=".9" stroke-linecap="round" opacity=".75"><path d="M41 45 l-8 -1.4 M41 47 l-8 1 M59 45 l8 -1.4 M59 47 l8 1"/></g>`;
    default:
      return '';
  }
}

/**
 * Accessories. Each may draw behind the body (`back`), over the clothes
 * (`front`), round the neck over the neck (`neck`), or on the head in its frame
 * (`head`). Coordinates other than `head` are the body's.
 */
const ACC = {
  'acc-necklace': {
    front: `<path d="M41.6 78.4 q8.4 9 16.8 0" fill="none" stroke="#e7c35a" stroke-width="1"/>
      <g fill="#fff8f0" stroke="#d8c7b0" stroke-width=".5"><circle cx="43" cy="80.8" r="1.1"/><circle cx="45.4" cy="82.6" r="1.1"/><circle cx="54.6" cy="82.6" r="1.1"/><circle cx="57" cy="80.8" r="1.1"/></g>
      <ellipse cx="48.6" cy="87.4" rx="1.9" ry="1.4" fill="#e7b93a" transform="rotate(-20 48.6 87.4)"/><path d="M50.3 87 V82.6 l2 1" fill="none" stroke="#e7b93a" stroke-width="1.1" stroke-linecap="round"/>`,
  },
  'acc-earrings': {
    head: `<g fill="none" stroke="#e7b93a" stroke-width="1.1"><circle cx="27.4" cy="46" r="2.2"/><circle cx="72.6" cy="46" r="2.2"/></g><g fill="#ff8fb0"><circle cx="27.4" cy="48.2" r="1"/><circle cx="72.6" cy="48.2" r="1"/></g>`,
  },
  'acc-scarf': {
    neck: `<path d="M41 76 Q50 82 59 76 L60 80.6 Q50 87 40 80.6 Z" fill="#e8576b" stroke="#b33a4c" stroke-width="1" stroke-linejoin="round"/>
      <path d="M54 81 L58 97 L52.6 98 L50.6 83 Z" fill="#e8576b" stroke="#b33a4c" stroke-width="1" stroke-linejoin="round"/>
      <path d="M53.2 97.4 l.4 2.6 M55 97.1 l.5 2.6 M56.8 96.8 l.6 2.6" stroke="#b33a4c" stroke-width=".8" stroke-linecap="round"/>
      <path d="M43 79.4 h14" stroke="#fff" stroke-width="1.2" opacity=".55"/>`,
  },
  'acc-medal': {
    front: `<path d="M44 77.6 L49 91 M56 77.6 L51 91" stroke="#4f7fd0" stroke-width="3" stroke-linecap="round"/><path d="M44 77.6 L49 91" stroke="#e8576b" stroke-width="1.1"/>
      <circle cx="50" cy="93.6" r="4.4" fill="#f4c542" stroke="#c8961e" stroke-width="1"/><path d="M50 91.4 l.8 1.6 l1.8 .3 l-1.3 1.2 l.3 1.8 l-1.6 -.8 l-1.6 .8 l.3 -1.8 l-1.3 -1.2 l1.8 -.3 z" fill="#fff5c4"/>`,
  },
  'acc-neckphones': {
    neck: `<path d="M38.8 80 Q50 92 61.2 80" fill="none" stroke="#3c3c47" stroke-width="2.4" stroke-linecap="round"/>
      <rect x="35" y="74.6" width="7.2" height="9.6" rx="3.4" fill="#5b8fd0" stroke="#3e6ca8" stroke-width="1"/><rect x="57.8" y="74.6" width="7.2" height="9.6" rx="3.4" fill="#5b8fd0" stroke="#3e6ca8" stroke-width="1"/>`,
  },
  'acc-backpack': {
    back: `<rect x="24" y="80" width="52" height="26" rx="8" fill="#f2836b" stroke="#c45a43" stroke-width="1.1"/>
      <path d="M24.6 95 h6 M69.4 95 h6" stroke="#c45a43" stroke-width="1.1" stroke-linecap="round"/>`,
    front: `<path d="M40.6 79.6 C40 88 40.6 96 41.6 102 M59.4 79.6 C60 88 59.4 96 58.4 102" fill="none" stroke="#c45a43" stroke-width="2.6" stroke-linecap="round"/>`,
  },
  'acc-cape': {
    back: `<path d="M38 79 Q50 75 62 79 Q72 92 79 115 Q50 121 21 115 Q28 92 38 79 Z" fill="#e2403a" stroke="#a62b25" stroke-width="1.1" stroke-linejoin="round"/>
      <path d="M62 79 Q72 92 79 115 Q74 116.6 68 117.2 Z" fill="#000" opacity=".1"/>`,
    neck: `<circle cx="42" cy="79" r="1.8" fill="#f4c542" stroke="#c8961e" stroke-width=".8"/><circle cx="58" cy="79" r="1.8" fill="#f4c542" stroke="#c8961e" stroke-width=".8"/>`,
  },
};
const accPart = (id, part) => (ACC[id] && ACC[id][part]) || '';

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
    case 'hat-cat':
      return `<path d="M27 26 C30 12 70 12 73 26" fill="none" stroke="#3c3c47" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M30 18 L29 2 L42 12 Z M70 18 L71 2 L58 12 Z" fill="#3c3c47" stroke="#24242c" stroke-width="1" stroke-linejoin="round"/>
        <path d="M31.4 14 L31 6.4 L37.4 11 Z M68.6 14 L69 6.4 L62.6 11 Z" fill="#f4a3b8"/>`;
    case 'hat-bunny':
      return `<path d="M27 26 C30 12 70 12 73 26" fill="none" stroke="#f3eee8" stroke-width="2.6" stroke-linecap="round"/>
        <g fill="#fffaf5" stroke="#cfc4b8" stroke-width="1"><ellipse cx="38" cy="4" rx="5.6" ry="12.6" transform="rotate(-14 38 4)"/><ellipse cx="62" cy="4" rx="5.6" ry="12.6" transform="rotate(14 62 4)"/></g>
        <g fill="#f7b6c8"><ellipse cx="38" cy="5" rx="2.6" ry="8.6" transform="rotate(-14 38 5)"/><ellipse cx="62" cy="5" rx="2.6" ry="8.6" transform="rotate(14 62 5)"/></g>`;
    case 'hat-flowers': {
      const flower = (x, y, c) => `<g transform="translate(${x} ${y})"><g fill="${c}"><circle cx="0" cy="-2.6" r="2.4"/><circle cx="2.5" cy="-.8" r="2.4"/><circle cx="1.6" cy="2.2" r="2.4"/><circle cx="-1.6" cy="2.2" r="2.4"/><circle cx="-2.5" cy="-.8" r="2.4"/></g><circle r="1.5" fill="#ffd34d"/></g>`;
      return `<path d="M27 28 C30 14 70 14 73 28" fill="none" stroke="#6faa5c" stroke-width="2" stroke-linecap="round"/>
        <g fill="#7cbf68"><ellipse cx="35" cy="17.6" rx="3" ry="1.5" transform="rotate(-40 35 17.6)"/><ellipse cx="57" cy="13.6" rx="3" ry="1.5" transform="rotate(20 57 13.6)"/></g>
        ${flower(29.4, 23.4, '#f6a0c6')}${flower(40, 15.4, '#ffffff')}${flower(50, 13, '#b8a4ee')}${flower(60, 15.4, '#ffffff')}${flower(70.6, 23.4, '#f6a0c6')}`;
    }
    case 'hat-tiara':
      return `<path d="M34 22 Q50 14 66 22 L64 18 L58 16 L54 8 L50 13 L46 8 L42 16 L36 18 Z" fill="#dfe6ee" stroke="#9aa6b4" stroke-width="1" stroke-linejoin="round"/>
        <circle cx="50" cy="13.6" r="1.8" fill="#8ad0f2" stroke="#5aa6cc" stroke-width=".6"/><circle cx="42.6" cy="16.6" r="1.1" fill="#f6a0c6"/><circle cx="57.4" cy="16.6" r="1.1" fill="#f6a0c6"/>
        <path d="M50 9.4 l.5 1.1 l1.1 .5 l-1.1 .5 l-.5 1.1 l-.5 -1.1 l-1.1 -.5 l1.1 -.5 z" fill="#fff"/>`;
    case 'hat-headphones':
      return `<path d="M26 38 C22 4 78 4 74 38" fill="none" stroke="#3c3c47" stroke-width="3.6" stroke-linecap="round"/>
        <rect x="20.6" y="31" width="10" height="16" rx="4.6" fill="#ef6a5e" stroke="#b5463b" stroke-width="1.1"/><rect x="69.4" y="31" width="10" height="16" rx="4.6" fill="#ef6a5e" stroke="#b5463b" stroke-width="1.1"/>
        <path d="M23.4 35 v8 M76.6 35 v8" stroke="#fff" stroke-width="1.2" stroke-linecap="round" opacity=".5"/>`;
    case 'hat-party':
      return `<g transform="rotate(14 58 14)"><path d="M47 22 L58 -10 L69 22 Z" fill="#7cc6f0" stroke="#4793c0" stroke-width="1.1" stroke-linejoin="round"/>
        <g fill="#fff6a8"><circle cx="55" cy="10" r="1.6"/><circle cx="62" cy="4" r="1.4"/><circle cx="61" cy="16" r="1.6"/><circle cx="53" cy="18" r="1.3"/></g>
        <path d="M47 22 Q58 25 69 22" fill="none" stroke="#f2836b" stroke-width="2.4" stroke-linecap="round"/><circle cx="58" cy="-10.6" r="3.4" fill="#f2836b" stroke="#c45a43" stroke-width=".9"/></g>`;
    case 'hat-wizard':
      return `<path d="M30 22 C38 10 46 -2 58 -11 C60 0 66 10 70 22 Z" fill="#6a4fb3" stroke="#47338a" stroke-width="1.2" stroke-linejoin="round"/>
        <path d="M20 26 Q50 14 80 26 Q50 32 20 26 Z" fill="#6a4fb3" stroke="#47338a" stroke-width="1.2" stroke-linejoin="round"/>
        <path d="M31.6 21.6 Q50 15.6 68.6 21.6" fill="none" stroke="#f4c542" stroke-width="2.2"/>
        <g fill="#ffe27a"><path d="M50 4 l1 2.2 l2.4 .3 l-1.8 1.6 l.5 2.4 l-2.1 -1.2 l-2.1 1.2 l.5 -2.4 l-1.8 -1.6 l2.4 -.3 z"/><circle cx="57" cy="-2" r="1.2"/><circle cx="43" cy="14" r="1"/><circle cx="60" cy="12" r="1.3"/></g>`;
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
      ${side === 'r' ? `<g class="av-baton"><path d="M${hx + 1} ${hy + 1} L${hx - 4} ${hy - 14}" stroke="#fffaf0" stroke-width="1.6" stroke-linecap="round"/><circle cx="${hx + 1}" cy="${hy + 1.4}" r="1.6" fill="#7a4a26"/></g>` : ''}
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
          ${accPart(on.acc, 'back')}
          ${body}
          ${shade}
          ${top.over || ''}
          ${accPart(on.acc, 'front')}
          ${arm('l', skin, top)}
          <g class="av-violin" transform="translate(1 15)">
            <path d="M30 60 C24 57 20 61 22 66 C19 69 21 75 27 76 C32 77 36 73 35 69 C38 66 36 61 30 60 Z" fill="#b5763f" stroke="#7d4d24" stroke-width="1.2" stroke-linejoin="round"/>
            <path d="M24.6 62 L12 53" stroke="#4a3226" stroke-width="2.6" stroke-linecap="round"/><path d="M31 63.6 L15 52.4" stroke="#f3ead8" stroke-width=".7"/>
          </g>
          ${arm('r', skin, top)}
          <rect x="45.6" y="70" width="8.8" height="10" rx="3.4" fill="${skin.fill}" stroke="${skin.line}" stroke-width="1.1"/>
          ${accPart(on.acc, 'neck')}
          <g class="av-head" transform="${HEAD}">
            ${hairBack(COVERS.has(on.hat) && UNDER_HAT.has(on.hair) ? '' : on.hair, h)}
            <circle cx="27.6" cy="40.4" r="3.4" fill="${skin.fill}" stroke="${skin.line}" stroke-width="1"/><circle cx="72.4" cy="40.4" r="3.4" fill="${skin.fill}" stroke="${skin.line}" stroke-width="1"/>
            <ellipse cx="50" cy="37" rx="23" ry="21.4" fill="${skin.fill}" stroke="${skin.line}" stroke-width="1.1"/>
            <ellipse cx="34.8" cy="46.4" rx="3.8" ry="2.3" fill="#f47c86" opacity=".22"/><ellipse cx="65.2" cy="46.4" rx="3.8" ry="2.3" fill="#f47c86" opacity=".22"/>
            ${extra(on.extra === 'extra-rosy' || on.extra === 'extra-freckles' ? on.extra : '')}
            ${makeup(on.makeup, 'under')}
            ${accPart(on.acc, 'head')}
            ${eyes(on.eyes)}
            ${nose(skin)}
            ${mouth(on.mouth)}
            ${makeup(on.makeup, 'over')}
            ${hairFront(COVERS.has(on.hat) && TALL.has(on.hair) ? 'hair-short' : on.hair, h)}
            ${extra(GLASSES.has(on.extra) ? on.extra : '')}
            ${hat(on.hat)}
          </g>
        </g></g></g>
      </g>
    </g>`;
}

// A hat that sits right down on the head flattens hair that stands up, and
// hides what is gathered on top.
const COVERS = new Set(['hat-cap', 'hat-beanie', 'hat-santa', 'hat-wizard']);
const TALL = new Set(['hair-spiky', 'hair-curly', 'hair-buns', 'hair-afro', 'hair-mohawk', 'hair-topknot']);
const UNDER_HAT = new Set(['hair-buns', 'hair-topknot']);
// glasses go on after the hair; freckles and rosy cheeks under it
const GLASSES = new Set(['extra-glasses', 'extra-round', 'extra-sunglasses', 'extra-hearts', 'extra-stars']);

const MOVE_GLYPH = {
  'move-wave': '👋', 'move-jump': '⤴', 'move-bow': '🙇', 'move-spin': '🔄', 'move-dance': '💃', 'move-violin': '🎻',
  'move-clap': '👏', 'move-hop': '🐰', 'move-cheer': '🙌', 'move-wiggle': '🕺', 'move-conduct': '🎼',
};

/** A shop tile's picture: the student's own figure with the thing on, cropped to where it shows. */
export function avatarItemIcon(avatar, item) {
  if (item.slot === 'move') return `<span class="av-move-icon" aria-hidden="true">${MOVE_GLYPH[item.id] || '✨'}</span>`;
  // clothes and most accessories show on the body; the rest on the face
  const onBody = item.slot === 'top' || (item.slot === 'acc' && item.id !== 'acc-earrings');
  // eyes, mouths, glasses, makeup and earrings are small: the tile shows the face close up
  const onFace = ['eyes', 'mouth', 'extra', 'makeup'].includes(item.slot) || item.id === 'acc-earrings';
  const box = onBody ? (item.id === 'acc-cape' || item.id === 'acc-backpack' ? '14 62 72 62' : '16 66 68 54') : onFace ? '15 20 70 60' : '6 -10 88 88';
  const wear = { [item.slot]: item.id };
  // a hat is shown without the hat already worn; a haircut without any hat
  if (item.slot === 'hair') wear.hat = null;
  return `<svg class="av-icon" viewBox="${box}" aria-hidden="true">${avatarMarkup(avatar, { wear, cls: 'is-still' })}</svg>`;
}

/** The whole figure, standing still, for the "Me" tab. */
export function avatarPortrait(avatar, cls = '') {
  return `<svg class="av-portrait" viewBox="0 -10 100 140" aria-hidden="true">${avatarMarkup(avatar, { cls })}</svg>`;
}
