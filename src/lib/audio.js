let sharedCtx;
let noiseBuffer;
const activeVoices = new Set();
const HOLD_CATCH_MS = 130;

export const BELL_STYLES = [
  { id: 'bell', label: 'Bell', hint: 'Classic scene-end ding' },
  { id: 'chime', label: 'Chime', hint: 'Brighter three-note hit' },
  { id: 'buzz', label: 'Buzz', hint: 'Short sawtooth poke' },
  { id: 'ding', label: 'Ding', hint: 'Single bright counter bell' },
  { id: 'gong', label: 'Gong', hint: 'Low wash that hangs in the room' },
  { id: 'clave', label: 'Clave', hint: 'Woodblock click' },
  { id: 'whoosh', label: 'Whoosh', hint: 'Sweep edit cue' },
  { id: 'wrong', label: 'Low buzzer', hint: 'Wrong-answer rasp' },
  { id: 'right', label: 'High ding', hint: 'Correct / dolphin trainer' },
  { id: 'triangle', label: 'Triangle', hint: 'Thin metallic ping' },
];

const STYLE_IDS = new Set(BELL_STYLES.map((s) => s.id));

function ctx() {
  if (!sharedCtx) {
    sharedCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (sharedCtx.state === 'suspended') {
    sharedCtx.resume();
  }
  return sharedCtx;
}

function clampVolume(volume) {
  return Math.max(0.0001, Math.min(1, Number(volume) || 0));
}

function normalizeStyle(style) {
  return STYLE_IDS.has(style) ? style : 'bell';
}

function getNoise(audio) {
  if (noiseBuffer && noiseBuffer.sampleRate === audio.sampleRate) return noiseBuffer;
  const length = audio.sampleRate;
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
  noiseBuffer = buffer;
  return buffer;
}

function createVoice(audio, tapMs, sustainLevel) {
  const master = audio.createGain();
  master.gain.setValueAtTime(0.0001, audio.currentTime);
  master.connect(audio.destination);
  return {
    ctx: audio,
    master,
    sources: [],
    filters: [],
    intervals: [],
    timeouts: [],
    tapMs,
    sustainLevel,
    released: false,
    sustaining: false,
    letTapFinish: false,
    onSustain: null,
  };
}

function addOsc(voice, type, freq) {
  const osc = voice.ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, voice.ctx.currentTime);
  voice.sources.push(osc);
  return osc;
}

function addNoise(voice, loop = false) {
  const src = voice.ctx.createBufferSource();
  src.buffer = getNoise(voice.ctx);
  src.loop = loop;
  voice.sources.push(src);
  return src;
}

function startSources(voice, when) {
  voice.sources.forEach((src) => {
    try {
      src.start(when);
    } catch {
      /* already started */
    }
  });
}

function stopSources(voice, when) {
  voice.intervals.forEach((id) => clearInterval(id));
  voice.timeouts.forEach((id) => clearTimeout(id));
  voice.intervals = [];
  voice.timeouts = [];
  voice.sources.forEach((src) => {
    try {
      src.stop(when);
    } catch {
      /* already stopped */
    }
  });
}

function scheduleTapEnvelope(voice, peak, attack = 0.016) {
  const now = voice.ctx.currentTime;
  const end = now + voice.tapMs / 1000;
  voice.master.gain.cancelScheduledValues(now);
  voice.master.gain.setValueAtTime(0.0001, now);
  voice.master.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), now + attack);
  voice.master.gain.exponentialRampToValueAtTime(0.0001, end);
  startSources(voice, now);
  voice.timeouts.push(
    setTimeout(() => {
      if (voice.released || voice.sustaining) return;
      voice.released = true;
      stopSources(voice, voice.ctx.currentTime + 0.02);
      activeVoices.delete(voice);
    }, voice.tapMs + 30),
  );
}

function enterSustain(voice) {
  if (voice.released || voice.sustaining || voice.letTapFinish) return;
  voice.sustaining = true;
  const now = voice.ctx.currentTime;
  const hold = Math.max(voice.master.gain.value, voice.sustainLevel);
  voice.master.gain.cancelScheduledValues(now);
  voice.master.gain.setValueAtTime(Math.max(0.0001, hold), now);
  if (voice.onSustain) voice.onSustain();
}

function releaseNow(voice, fade = 0.18) {
  if (voice.released) return;
  voice.released = true;
  const now = voice.ctx.currentTime;
  voice.master.gain.cancelScheduledValues(now);
  voice.master.gain.setValueAtTime(Math.max(voice.master.gain.value, 0.0001), now);
  voice.master.gain.exponentialRampToValueAtTime(0.0001, now + fade);
  stopSources(voice, now + fade + 0.03);
  activeVoices.delete(voice);
}

function buildVoice(style, volume) {
  const audio = ctx();
  const vol = clampVolume(volume);
  const id = normalizeStyle(style);

  if (id === 'buzz') {
    const voice = createVoice(audio, 360, 0.12 * vol);
    const osc = addOsc(voice, 'sawtooth', 140);
    osc.connect(voice.master);
    scheduleTapEnvelope(voice, 0.16 * vol, 0.02);
    return voice;
  }

  if (id === 'ding') {
    const voice = createVoice(audio, 520, 0.12 * vol);
    const osc = addOsc(voice, 'sine', 1318.5);
    osc.connect(voice.master);
    scheduleTapEnvelope(voice, 0.2 * vol, 0.01);
    return voice;
  }

  if (id === 'gong') {
    const voice = createVoice(audio, 1800, 0.1 * vol);
    const mix = audio.createGain();
    mix.gain.value = 1;
    mix.connect(voice.master);
    [
      [98, 'sine', 1],
      [147, 'sine', 0.45],
      [196, 'triangle', 0.22],
      [73.5, 'sine', 0.35],
    ].forEach(([freq, type, amt]) => {
      const osc = addOsc(voice, type, freq);
      const g = audio.createGain();
      g.gain.value = amt;
      osc.connect(g);
      g.connect(mix);
    });
    scheduleTapEnvelope(voice, 0.2 * vol, 0.04);
    return voice;
  }

  if (id === 'clave') {
    const voice = createVoice(audio, 140, 0.1 * vol);
    const filter = audio.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 2200;
    filter.Q.value = 8;
    filter.connect(voice.master);
    voice.filters.push(filter);
    const click = addOsc(voice, 'square', 2100);
    click.connect(filter);
    const noise = addNoise(voice, false);
    const ng = audio.createGain();
    ng.gain.value = 0.35;
    noise.connect(ng);
    ng.connect(filter);
    scheduleTapEnvelope(voice, 0.22 * vol, 0.004);
    try {
      click.stop(audio.currentTime + 0.08);
      noise.stop(audio.currentTime + 0.05);
    } catch {
      /* ignore */
    }
    voice.onSustain = () => {
      const pulse = () => {
        if (voice.released) return;
        const now = audio.currentTime;
        const osc = audio.createOscillator();
        osc.type = 'square';
        osc.frequency.value = 2100;
        const g = audio.createGain();
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(0.18 * vol, now + 0.003);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);
        osc.connect(g);
        g.connect(filter);
        osc.start(now);
        osc.stop(now + 0.08);
        voice.sources.push(osc);
      };
      pulse();
      voice.intervals.push(setInterval(pulse, 170));
    };
    return voice;
  }

  if (id === 'whoosh') {
    const voice = createVoice(audio, 480, 0.08 * vol);
    const filter = audio.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(320, audio.currentTime);
    filter.frequency.exponentialRampToValueAtTime(2800, audio.currentTime + 0.42);
    filter.Q.value = 1.2;
    filter.connect(voice.master);
    voice.filters.push(filter);
    const noise = addNoise(voice, true);
    noise.connect(filter);
    scheduleTapEnvelope(voice, 0.18 * vol, 0.03);
    voice.onSustain = () => {
      const now = audio.currentTime;
      filter.frequency.cancelScheduledValues(now);
      filter.frequency.setValueAtTime(Math.max(filter.frequency.value, 800), now);
      filter.frequency.linearRampToValueAtTime(1400, now + 0.25);
    };
    return voice;
  }

  if (id === 'wrong') {
    const voice = createVoice(audio, 420, 0.1 * vol);
    const a = addOsc(voice, 'square', 110);
    const b = addOsc(voice, 'square', 123);
    a.connect(voice.master);
    b.connect(voice.master);
    scheduleTapEnvelope(voice, 0.12 * vol, 0.018);
    return voice;
  }

  if (id === 'right') {
    const voice = createVoice(audio, 560, 0.1 * vol);
    const low = addOsc(voice, 'sine', 988);
    const high = addOsc(voice, 'sine', 1318.5);
    const g1 = audio.createGain();
    const g2 = audio.createGain();
    g1.gain.setValueAtTime(0.7, audio.currentTime);
    g1.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + 0.22);
    g2.gain.setValueAtTime(0.0001, audio.currentTime);
    g2.gain.setValueAtTime(0.0001, audio.currentTime + 0.1);
    g2.gain.exponentialRampToValueAtTime(1, audio.currentTime + 0.14);
    low.connect(g1);
    high.connect(g2);
    g1.connect(voice.master);
    g2.connect(voice.master);
    scheduleTapEnvelope(voice, 0.18 * vol, 0.012);
    return voice;
  }

  if (id === 'triangle') {
    const voice = createVoice(audio, 1400, 0.08 * vol);
    const ping = addOsc(voice, 'triangle', 2093);
    const air = addOsc(voice, 'sine', 4186);
    const g = audio.createGain();
    g.gain.value = 0.28;
    ping.connect(voice.master);
    air.connect(g);
    g.connect(voice.master);
    scheduleTapEnvelope(voice, 0.16 * vol, 0.006);
    return voice;
  }

  if (id === 'chime') {
    const voice = createVoice(audio, 1150, 0.1 * vol);
    [880, 1320, 1760].forEach((freq, i) => {
      const osc = addOsc(voice, 'sine', freq);
      const g = audio.createGain();
      g.gain.value = 1 / (i + 1);
      osc.connect(g);
      g.connect(voice.master);
    });
    scheduleTapEnvelope(voice, 0.22 * vol, 0.015);
    return voice;
  }

  const voice = createVoice(audio, 1150, 0.1 * vol);
  [784, 1175].forEach((freq, i) => {
    const osc = addOsc(voice, 'sine', freq);
    const g = audio.createGain();
    g.gain.value = 1 / (i + 1);
    osc.connect(g);
    g.connect(voice.master);
  });
  scheduleTapEnvelope(voice, 0.22 * vol, 0.015);
  return voice;
}

function maybeHaptic() {
  try {
    const on = window.__improvJamHapticDing;
    if (on && typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      navigator.vibrate(16);
    }
  } catch {
    /* ignore */
  }
}

export function playDing(style = 'bell', volume = 0.8) {
  maybeHaptic();
  const voice = buildVoice(style, volume);
  activeVoices.add(voice);
  return voice;
}

export function startDing(style = 'bell', volume = 0.8) {
  const voice = playDing(style, volume);
  voice.timeouts.push(setTimeout(() => enterSustain(voice), HOLD_CATCH_MS));
  return voice;
}

export function releaseDing(voice, { heldMs = 0 } = {}) {
  if (!voice || voice.released) return;
  if (heldMs < HOLD_CATCH_MS && !voice.sustaining) {
    voice.letTapFinish = true;
    return;
  }
  releaseNow(voice, voice.sustaining ? 0.22 : 0.12);
}

export function stopAllDings() {
  [...activeVoices].forEach((voice) => releaseNow(voice, 0.08));
}

export async function playCountIn(seconds = 3, style = 'bell', volume = 0.8) {
  const beats = Math.max(1, Math.min(8, Number(seconds) || 3));
  for (let i = beats; i > 0; i -= 1) {
    playDing(i === 1 ? 'chime' : style, volume);
    await new Promise((r) => setTimeout(r, 700));
  }
}
