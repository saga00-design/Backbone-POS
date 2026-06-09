export const playNotificationSound = () => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  const playTone = (freq: number, startTime: number, duration: number) => {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, startTime);
    
    gain.gain.setValueAtTime(0.1, startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
    
    osc.connect(gain);
    gain.connect(audioContext.destination);
    
    osc.start(startTime);
    osc.stop(startTime + duration);
  };

  // Nice POS double-beep
  const now = audioContext.currentTime;
  playTone(880, now, 0.1);
  playTone(1109.73, now + 0.12, 0.2);
};

export const playOrderReadySound = () => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  const playTone = (freq: number, startTime: number, duration: number, type: OscillatorType = 'sine') => {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);
    
    gain.gain.setValueAtTime(0.15, startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
    
    osc.connect(gain);
    gain.connect(audioContext.destination);
    
    osc.start(startTime);
    osc.stop(startTime + duration);
  };

  // Triumphant chimes
  const now = audioContext.currentTime;
  playTone(523.25, now, 0.2); // C5
  playTone(659.25, now + 0.15, 0.2); // E5
  playTone(783.99, now + 0.3, 0.3); // G5
  playTone(1046.50, now + 0.45, 0.5, 'square'); // C6
};

export const playWarningSound = () => {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  const playTone = (freq: number, startTime: number, duration: number) => {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, startTime);
    
    gain.gain.setValueAtTime(0.1, startTime);
    gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
    
    osc.connect(gain);
    gain.connect(audioContext.destination);
    
    osc.start(startTime);
    osc.stop(startTime + duration);
  };

  const now = audioContext.currentTime;
  playTone(440, now, 0.2); // A4
  playTone(349.23, now + 0.25, 0.4); // F4
};
