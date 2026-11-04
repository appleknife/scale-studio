// ink.js — pencil marks on the scale staff.
//
// A teacher writes on the music: a fingering over a shift, a circle round the
// note that keeps going sharp, an arrow for the half step. This is that, and
// deliberately no more. The marks are temporary: they belong to the scale they
// were written on (each octave choice and spelling is its own page, because the
// notes sit in different places), they survive switching scales and coming back,
// and they are gone when the page is reloaded. Nothing is saved or uploaded.
//
// The ink is drawn *inside* the staff's own SVG, in its viewBox units, so it
// scrolls with the notes on a phone and stays put when the staff is resized.
// Three tools:
//
//   pen     draw. While it is on, the staff no longer swipes — a finger that
//           draws cannot also scroll — so the hint under the staff says how to
//           get scrolling back (tap Pen again).
//   erase   drag a box; every mark the box touches goes. A tap erases what is
//           under the finger.
//   undo    steps back one action — a stroke, or one whole erase.
//
// An Apple Pencil (or any stylus) turns on palm rejection: once a pen pointer
// has drawn, touches are ignored while a tool is on.

const NS = 'http://www.w3.org/2000/svg';
const INK = '#2d5fb4';
const PEN_WIDTH = 2.4; // screen pixels, whatever the staff's scale
const TAP = 9; // viewBox units around a tap that an eraser tap covers

/** One page of ink per scale layout, for the life of the page. */
const pages = new Map();

function page(key) {
  if (!pages.has(key)) pages.set(key, { strokes: [], history: [] });
  return pages.get(key);
}

/** A smooth path through the points: quadratic curves through the midpoints. */
function pathFor(pts) {
  if (!pts.length) return '';
  if (pts.length === 1) {
    const [x, y] = pts[0];
    // A single tap still leaves a dot: a zero-length line with round caps.
    return `M${x} ${y}l0.01 0`;
  }
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i += 1) {
    const [x, y] = pts[i];
    const [nx, ny] = pts[i + 1];
    d += `Q${x} ${y} ${(x + nx) / 2} ${(y + ny) / 2}`;
  }
  const [lx, ly] = pts[pts.length - 1];
  return `${d}L${lx} ${ly}`;
}

const round = (v) => Math.round(v * 10) / 10;

/** Does the stroke pass through the box? Segments are walked, not just points. */
function touches(stroke, box) {
  const inside = (x, y) => x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1;
  const pts = stroke.pts;
  for (let i = 0; i < pts.length; i += 1) {
    const [x, y] = pts[i];
    if (inside(x, y)) return true;
    if (i === 0) continue;
    const [px, py] = pts[i - 1];
    const steps = Math.ceil(Math.hypot(x - px, y - py) / 2);
    for (let s = 1; s < steps; s += 1) {
      const f = s / steps;
      if (inside(px + (x - px) * f, py + (y - py) * f)) return true;
    }
  }
  return false;
}

/**
 * Wire up the toolbar and the staff.
 *
 * `onChange(state)` is told when the tool or the undo stack changes, so the page
 * can update the buttons and the hint; `state` is { tool, canUndo }.
 */
export function createInk({ onChange = () => {} } = {}) {
  let svg = null;
  let layer = null;
  let current = null; // the page being written on
  let tool = null; // null | 'pen' | 'erase'
  let stylusSeen = false;
  let gesture = null; // the stroke or box under way

  const notify = () => onChange({ tool, canUndo: Boolean(current && current.history.length) });

  // The end of a gesture is heard on the window as well as on the staff. Capture
  // normally delivers pointerup to the SVG wherever the finger goes, but when it
  // does not — an older browser, a pointer the system takes away, a stylus lifted
  // off the glass — the gesture stayed half-finished and every later stroke was
  // ignored ("if (gesture) return"), which looks exactly like a pen that has
  // stopped working until the screen is redrawn.
  const onWindowUp = (event) => up(event);
  const onWindowCancel = (event) => cancel(event);
  window.addEventListener('pointerup', onWindowUp);
  window.addEventListener('pointercancel', onWindowCancel);

  function toPoint(event) {
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(ctm.inverse());
    return [round(p.x), round(p.y)];
  }

  function drawStroke(stroke) {
    const path = document.createElementNS(NS, 'path');
    path.setAttribute('d', pathFor(stroke.pts));
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', INK);
    path.setAttribute('stroke-width', String(PEN_WIDTH));
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    path.setAttribute('vector-effect', 'non-scaling-stroke');
    stroke.el = path;
    layer.appendChild(path);
    return path;
  }

  function redraw() {
    if (!layer || !current) return;
    layer.replaceChildren();
    current.strokes.forEach(drawStroke);
  }

  // iPad Safari does not always honour `touch-action: none` on an SVG, and with
  // the Pencil it can start scrolling the page under a stroke. Cancelling the
  // touch itself is the one thing it always obeys — but only while a tool is on,
  // so with the pen down the staff swipes as before.
  function holdStill(event) {
    if (tool && event.cancelable) event.preventDefault();
  }

  function wanted(event) {
    if (!tool || !svg) return false;
    if (event.pointerType === 'pen') stylusSeen = true;
    // Palm rejection: with a stylus about, a resting hand is not a mark.
    if (stylusSeen && event.pointerType === 'touch') return false;
    if (event.pointerType === 'mouse' && event.button !== 0) return false;
    return true;
  }

  function down(event) {
    if (!wanted(event) || gesture) return;
    const pt = toPoint(event);
    if (!pt) return;
    event.preventDefault();
    try {
      svg.setPointerCapture(event.pointerId);
    } catch {
      /* capture is a nicety — the stroke still works without it */
    }
    if (tool === 'pen') {
      const stroke = { pts: [pt] };
      drawStroke(stroke);
      gesture = { id: event.pointerId, kind: 'pen', stroke };
    } else {
      const rect = document.createElementNS(NS, 'rect');
      rect.setAttribute('class', 'ink-box');
      rect.setAttribute('fill', 'rgba(45, 95, 180, 0.08)');
      rect.setAttribute('stroke', INK);
      rect.setAttribute('stroke-width', '1.2');
      rect.setAttribute('stroke-dasharray', '4 3');
      rect.setAttribute('vector-effect', 'non-scaling-stroke');
      layer.appendChild(rect);
      gesture = { id: event.pointerId, kind: 'erase', from: pt, to: pt, rect };
      sizeBox(gesture);
    }
  }

  function sizeBox(g) {
    const x0 = Math.min(g.from[0], g.to[0]);
    const y0 = Math.min(g.from[1], g.to[1]);
    g.rect.setAttribute('x', String(x0));
    g.rect.setAttribute('y', String(y0));
    g.rect.setAttribute('width', String(Math.abs(g.to[0] - g.from[0])));
    g.rect.setAttribute('height', String(Math.abs(g.to[1] - g.from[1])));
  }

  function move(event) {
    if (!gesture || event.pointerId !== gesture.id) return;
    event.preventDefault();
    if (gesture.kind === 'pen') {
      // Coalesced events keep a quick flick from turning into straight segments.
      const events = event.getCoalescedEvents ? event.getCoalescedEvents() : [];
      for (const e of events.length ? events : [event]) {
        const pt = toPoint(e);
        if (!pt) continue;
        const last = gesture.stroke.pts[gesture.stroke.pts.length - 1];
        if (Math.hypot(pt[0] - last[0], pt[1] - last[1]) < 0.6) continue;
        gesture.stroke.pts.push(pt);
      }
      gesture.stroke.el.setAttribute('d', pathFor(gesture.stroke.pts));
    } else {
      const pt = toPoint(event);
      if (!pt) return;
      gesture.to = pt;
      sizeBox(gesture);
    }
  }

  function up(event) {
    if (!gesture || event.pointerId !== gesture.id) return;
    const g = gesture;
    gesture = null;
    if (g.kind === 'pen') {
      current.strokes.push(g.stroke);
      current.history.push({ add: g.stroke });
    } else {
      g.rect.remove();
      let box = {
        x0: Math.min(g.from[0], g.to[0]),
        x1: Math.max(g.from[0], g.to[0]),
        y0: Math.min(g.from[1], g.to[1]),
        y1: Math.max(g.from[1], g.to[1]),
      };
      // A tap, or a box too small to aim with, erases what is under the finger.
      if (box.x1 - box.x0 < TAP && box.y1 - box.y0 < TAP) {
        const cx = (box.x0 + box.x1) / 2;
        const cy = (box.y0 + box.y1) / 2;
        box = { x0: cx - TAP, x1: cx + TAP, y0: cy - TAP, y1: cy + TAP };
      }
      const gone = [];
      current.strokes.forEach((stroke, index) => {
        if (touches(stroke, box)) gone.push({ stroke, index });
      });
      if (gone.length) {
        const set = new Set(gone.map((g2) => g2.stroke));
        current.strokes = current.strokes.filter((s) => !set.has(s));
        current.history.push({ erase: gone });
        redraw();
      }
    }
    notify();
  }

  function cancel(event) {
    if (!gesture || event.pointerId !== gesture.id) return;
    // The system took the pointer (a palm, a gesture). Keep what was drawn.
    up(event);
  }

  return {
    /**
     * Put the ink on a freshly rendered staff. `key` names the layout — the same
     * scale in another octave choice is a different page.
     */
    mount(staffSvg, key) {
      if (svg) {
        svg.removeEventListener('pointerdown', down);
        svg.removeEventListener('pointermove', move);
        svg.removeEventListener('pointerup', up);
        svg.removeEventListener('pointercancel', cancel);
        svg.removeEventListener('touchstart', holdStill);
        svg.removeEventListener('touchmove', holdStill);
      }
      gesture = null;
      svg = staffSvg || null;
      current = page(key);
      if (!svg) {
        notify();
        return;
      }
      layer = document.createElementNS(NS, 'g');
      layer.setAttribute('class', 'ink-layer');
      layer.setAttribute('pointer-events', 'none');
      svg.appendChild(layer);
      svg.addEventListener('pointerdown', down);
      svg.addEventListener('pointermove', move);
      svg.addEventListener('pointerup', up);
      svg.addEventListener('pointercancel', cancel);
      svg.addEventListener('touchstart', holdStill, { passive: false });
      svg.addEventListener('touchmove', holdStill, { passive: false });
      svg.classList.toggle('is-inking', Boolean(tool));
      svg.dataset.tool = tool || '';
      redraw();
      notify();
    },

    /** Turn a tool on, or off if it is already on. */
    toggle(name) {
      tool = tool === name ? null : name;
      if (svg) {
        svg.classList.toggle('is-inking', Boolean(tool));
        svg.dataset.tool = tool || '';
      }
      notify();
    },

    /** Put the pen down — leaving the screen, or starting a take. */
    off() {
      if (!tool) return;
      tool = null;
      if (svg) {
        svg.classList.remove('is-inking');
        svg.dataset.tool = '';
      }
      notify();
    },

    undo() {
      if (!current || !current.history.length || gesture) return;
      const step = current.history.pop();
      if (step.add) {
        current.strokes = current.strokes.filter((s) => s !== step.add);
      } else if (step.erase) {
        // Put each mark back where it was, so the order of the drawing returns.
        for (const { stroke, index } of [...step.erase].sort((a, b) => a.index - b.index)) {
          current.strokes.splice(Math.min(index, current.strokes.length), 0, stroke);
        }
      }
      redraw();
      notify();
    },

    get tool() {
      return tool;
    },

    get count() {
      return current ? current.strokes.length : 0;
    },
  };
}
