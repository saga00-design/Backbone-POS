// Single ring — bar
export const ringBarBell = () => {
  try {
    const ctx = new (window.AudioContext ||
                    (window as any).webkitAudioContext)();

    // Primary strike tone — high metallic ping
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.frequency.setValueAtTime(2637, ctx.currentTime); // E7
    osc1.frequency.exponentialRampToValueAtTime(
      1800, ctx.currentTime + 0.8
    );
    gain1.gain.setValueAtTime(0.6, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(
      0.001, ctx.currentTime + 1.2
    );
    osc1.type = 'sine';
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 1.2);

    // Harmonic overtone — gives metallic character
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.frequency.setValueAtTime(5274, ctx.currentTime); // E8
    osc2.frequency.exponentialRampToValueAtTime(
      3600, ctx.currentTime + 0.5
    );
    gain2.gain.setValueAtTime(0.3, ctx.currentTime);
    gain2.gain.exponentialRampToValueAtTime(
      0.001, ctx.currentTime + 0.8
    );
    osc2.type = 'sine';
    osc2.start(ctx.currentTime);
    osc2.stop(ctx.currentTime + 0.8);

    // Close context after sound completes
    setTimeout(() => ctx.close(), 1500);
  } catch (e) {
    // Silently fail if audio not supported
    console.warn('Bar bell not available:', e);
  }
};

// Double ring — kitchen
export const ringKitchenBell = () => {
  try {
    const playStrike = () => {
      const ctx = new (window.AudioContext ||
        (window as any).webkitAudioContext)();
      const now = ctx.currentTime;

      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.frequency.setValueAtTime(2637, now);
      osc1.frequency.exponentialRampToValueAtTime(
        1800, now + 0.8
      );
      gain1.gain.setValueAtTime(0.6, now);
      gain1.gain.exponentialRampToValueAtTime(
        0.001, now + 1.2
      );
      osc1.type = 'sine';
      osc1.start(now);
      osc1.stop(now + 1.2);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.frequency.setValueAtTime(5274, now);
      osc2.frequency.exponentialRampToValueAtTime(
        3600, now + 0.5
      );
      gain2.gain.setValueAtTime(0.3, now);
      gain2.gain.exponentialRampToValueAtTime(
        0.001, now + 0.8
      );
      osc2.type = 'sine';
      osc2.start(now);
      osc2.stop(now + 0.8);

      setTimeout(() => ctx.close(), 1500);
    };

    playStrike();
    setTimeout(() => playStrike(), 320);

  } catch (e) {
    console.warn('Kitchen bell not available:', e);
  }
};
