/** An original, quiet score for the wandering stranger. Entirely local Web Audio. */
const preference = 'rumourtown-music-muted';
const chords = [[50, 57, 64, 65], [46, 53, 60, 64], [53, 60, 64, 69], [48, 55, 62, 64]];
const melody = [81, 76, 77, 69, 74, 76, 72, 69, 77, 81, 79, 76, 74, 69, 72, 76];

export function createAmbientMusic() {
  const Context = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  let muted = false, started = false, destroyed = false;
  try { muted = localStorage.getItem(preference) === 'true'; } catch { /* Private browsing still has a session control. */ }
  let context: AudioContext | undefined, master: GainNode | undefined;
  let input: BiquadFilterNode | undefined;
  let interval = 0, suspendTimer = 0, next = 0, phrase = 0;
  const listeners = new Set<() => void>();
  const voices = new Set<OscillatorNode>();
  const notify = () => listeners.forEach(listener => listener());

  function note(midi: number, time: number, duration: number, level: number, pan: number, chime = false): void {
    if (!context || !input) return;
    const oscillator = context.createOscillator(), envelope = context.createGain(), position = context.createStereoPanner();
    oscillator.type = 'sine';
    oscillator.frequency.value = 440 * 2 ** ((midi - 69) / 12);
    position.pan.value = pan;
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(level, time + (chime ? .06 : 3));
    envelope.gain.exponentialRampToValueAtTime(.0001, time + duration - .1);
    envelope.gain.linearRampToValueAtTime(0, time + duration);
    oscillator.connect(envelope).connect(position).connect(input);
    voices.add(oscillator);
    oscillator.onended = () => { oscillator.disconnect(); envelope.disconnect(); position.disconnect(); voices.delete(oscillator); };
    oscillator.start(time); oscillator.stop(time + duration);
  }
  function schedule(): void {
    if (!context || muted || document.hidden || destroyed) return;
    // A throttled/background tab starts a fresh phrase instead of catching up old notes.
    if (next < context.currentTime) next = context.currentTime + .08;
    while (next < context.currentTime + 1) {
      if (phrase % 2 === 0) {
        chords[(phrase / 2) % chords.length]!.forEach((pitch, i) => note(pitch, next, 12, .11, (i - 1.5) * .3));
      }
      const pitch = melody[phrase % melody.length]!;
      const pan = Math.sin(phrase * .7) * .65;
      note(pitch, next + .6, 6, .075, pan, true);
      note(pitch + 12, next + .6, 3, .012, pan, true);
      next += 4; phrase++;
    }
  }
  function fade(level: number): void {
    if (!context || !master) return;
    master.gain.cancelScheduledValues(context.currentTime);
    master.gain.setTargetAtTime(level, context.currentTime, .06);
  }
  async function start(): Promise<void> {
    started = true;
    if (destroyed || muted || !Context || document.hidden) return;
    window.clearTimeout(suspendTimer);
    try {
      if (!context) {
        context = new Context();
        master = context.createGain(); master.gain.value = 0;
        input = context.createBiquadFilter(); input.type = 'lowpass'; input.frequency.value = 1800; input.Q.value = .5;
        const echo = context.createDelay(2), feedback = context.createGain(), wet = context.createGain();
        echo.delayTime.value = .75; feedback.gain.value = .3; wet.gain.value = .22;
        input.connect(master); input.connect(echo); echo.connect(feedback).connect(echo); echo.connect(wet).connect(master);
        master.connect(context.destination);
      }
      await context.resume();
      if (destroyed || muted || document.hidden) { if (!destroyed) void context.suspend().catch(() => {}); return; }
      fade(.025);
      schedule();
      if (!interval) interval = window.setInterval(schedule, 500);
    } catch {
      // A browser that refuses audio must never prevent entering the village.
      muted = true; fade(0); window.clearInterval(interval); interval = 0;
      if (context && !destroyed) void context.suspend().catch(() => {});
      notify();
    }
  }
  function visibility(): void {
    if (!started || !context || destroyed) return;
    if (document.hidden) void context.suspend().catch(() => {});
    else if (!muted) void start();
  }
  document.addEventListener('visibilitychange', visibility);
  return {
    get available() { return Boolean(Context); },
    get enabled() { return !muted; },
    start,
    setEnabled(enabled: boolean): void {
      if (destroyed) return;
      muted = !enabled;
      try { localStorage.setItem(preference, String(muted)); } catch { /* Keep the current session choice. */ }
      window.clearTimeout(suspendTimer);
      if (enabled) void start();
      else {
        fade(0);
        suspendTimer = window.setTimeout(() => { if (muted && context && !destroyed) void context.suspend().catch(() => {}); }, 500);
      }
      notify();
    },
    subscribe(listener: () => void): () => void { listeners.add(listener); listener(); return () => listeners.delete(listener); },
    destroy(): void {
      destroyed = true;
      window.clearInterval(interval); window.clearTimeout(suspendTimer);
      document.removeEventListener('visibilitychange', visibility);
      listeners.clear();
      for (const voice of voices) { voice.onended = null; voice.disconnect(); }
      voices.clear();
      if (context) void context.close().catch(() => {});
    },
  };
}
export type AmbientMusic = ReturnType<typeof createAmbientMusic>;
