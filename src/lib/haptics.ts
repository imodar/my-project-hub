/**
 * Haptic feedback utility for native-like interactions.
 * Uses the Vibration API when available.
 */
export const haptic = {
  /** Light tap - for button presses */
  light: () => {
    if (navigator.vibrate) navigator.vibrate(10);
  },
  /** Medium tap - for important actions */
  medium: () => {
    if (navigator.vibrate) navigator.vibrate(25);
  },
  /** Heavy tap - for confirmations/destructive actions */
  heavy: () => {
    if (navigator.vibrate) navigator.vibrate(50);
  },
  /** Success pattern */
  success: () => {
    if (navigator.vibrate) navigator.vibrate([10, 50, 20]);
  },
  /** Error pattern */
  error: () => {
    if (navigator.vibrate) navigator.vibrate([30, 50, 30, 50, 30]);
  },
};
