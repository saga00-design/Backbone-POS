// Real audio file playback for KDS bells. Preloaded at module load (this
// module is imported from App.tsx via useFirestoreSync, so it loads at app
// start, not on first bell trigger).
const barReadyAudio = new Audio('/bell-ready.mp3');
const kitchenCompleteAudio = new Audio('/bell-complete.mp3');
const newOrderAudio = new Audio('/new-order.mp3');

barReadyAudio.preload = 'auto';
kitchenCompleteAudio.preload = 'auto';
newOrderAudio.preload = 'auto';

// play() must stay synchronous (never awaited) so a bell always fires
// before any Firestore write in the calling code — that ordering bug is
// the reason these bells exist as fire-and-forget calls.
const playSafely = (audio: HTMLAudioElement) => {
  try {
    audio.currentTime = 0;
    audio.play().catch(() => {
      // Fail silently — never block an order/bump action on audio failure.
    });
  } catch {
    // Fail silently — e.g. audio element unsupported.
  }
};

// Single ring — bar ready
export const ringBarBell = () => playSafely(barReadyAudio);

// Double ring — kitchen/course complete
export const ringKitchenBell = () => playSafely(kitchenCompleteAudio);

// New order ding — fires once per newly created ticket
export const ringNewOrderBell = () => playSafely(newOrderAudio);

// Unlock audio on first user interaction (browser autoplay restriction).
// Call once from the app shell; safe to call multiple times.
export const unlockBellAudio = () => {
  const unlock = () => {
    [barReadyAudio, kitchenCompleteAudio, newOrderAudio].forEach(audio => {
      audio.play().then(() => {
        audio.pause();
        audio.currentTime = 0;
      }).catch(() => {
        // Fail silently — unlock is best-effort.
      });
    });
    document.removeEventListener('click', unlock);
    document.removeEventListener('touchstart', unlock);
  };
  document.addEventListener('click', unlock);
  document.addEventListener('touchstart', unlock);
  return () => {
    document.removeEventListener('click', unlock);
    document.removeEventListener('touchstart', unlock);
  };
};
