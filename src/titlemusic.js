/**
 * The title screen's music: a quiet loop under the menu, nowhere else.
 *
 * It plays through Web Audio, not just an <audio> element's volume, because iOS
 * ignores that volume: the element feeds a gain the app controls, so it can sit
 * low and fade in and out on an iPad too. It never plays while the microphone
 * is open, and a choice to switch it off is remembered on the device.
 */
const KEY = 'scaleStudio.titleMusic';
const LEVEL = 0.32; // well under a practice take
const FADE_IN = 1.6;
const FADE_OUT = 0.5;

function remembered() {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

export function createTitleMusic({ src, context }) {
  let wanted = remembered();
  let active = false; // the title screen is up and the microphone is not
  let audio = null;
  let gain = null;
  let stopTimer = 0;
  let waitingForTouch = false;

  function build() {
    if (audio) return true;
    const ctx = context();
    if (!ctx) return false;
    audio = new Audio();
    audio.src = src;
    audio.loop = true;
    audio.preload = 'auto';
    audio.crossOrigin = 'anonymous';
    audio.setAttribute('playsinline', '');
    try {
      const source = ctx.createMediaElementSource(audio);
      gain = ctx.createGain();
      gain.gain.value = 0;
      source.connect(gain).connect(ctx.destination);
    } catch {
      gain = null; // no Web Audio: the element's own volume will have to do
      audio.volume = LEVEL;
    }
    return true;
  }

  function ramp(to, seconds) {
    const ctx = context();
    if (!gain || !ctx) return;
    const now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.linearRampToValueAtTime(to, now + seconds);
  }

  // Browsers only let sound start from a touch. Safari is sneaky about it: the
  // element's play() succeeds, but into an audio context that is still
  // suspended, so nothing is heard until something resumes it from inside a
  // touch. So the next touch anywhere resumes the context and starts the music.
  // iOS counts a touch as permission when the finger lifts, not when it lands:
  // listen for both, and for clicks and keys.
  const UNLOCK = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'];

  function armTouch() {
    if (waitingForTouch) return;
    waitingForTouch = true;
    for (const type of UNLOCK) window.addEventListener(type, onTouch, true);
  }

  function onTouch() {
    const ctx = context();
    if (ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
    if (active && wanted) start();
    // Done once the context really runs; until then every touch tries again.
    setTimeout(() => {
      if (context()?.state === 'running' || !gain) {
        waitingForTouch = false;
        for (const type of UNLOCK) window.removeEventListener(type, onTouch, true);
      }
    }, 120);
  }

  function start() {
    clearTimeout(stopTimer);
    if (!build()) return;
    const ctx = context();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
    const playing = audio.play();
    const ok = () => {
      ramp(LEVEL, FADE_IN);
      // Playing, but into a context still asleep: wait for a touch to wake it.
      if (gain && context()?.state !== 'running') armTouch();
    };
    if (playing && playing.then) playing.then(ok).catch(armTouch);
    else ok();
  }

  function stop() {
    if (!audio || audio.paused) return;
    ramp(0, FADE_OUT);
    clearTimeout(stopTimer);
    stopTimer = setTimeout(() => {
      if (!active || !wanted) audio.pause();
    }, FADE_OUT * 1000 + 60);
  }

  function apply() {
    if (active && wanted && !document.hidden) start();
    else stop();
  }

  document.addEventListener('visibilitychange', apply);

  return {
    /** The title screen is showing, with no microphone open. */
    setActive(on) {
      if (active === on) return;
      active = on;
      apply();
    },
    get on() {
      return wanted;
    },
    toggle() {
      wanted = !wanted;
      try {
        localStorage.setItem(KEY, wanted ? 'on' : 'off');
      } catch {
        /* private browsing: just this visit */
      }
      apply();
      return wanted;
    },
  };
}
