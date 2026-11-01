/*
 * A short tap of physical feedback. Android has navigator.vibrate; iOS Safari
 * has no vibration API but plays the system haptic when a switch-style
 * checkbox (`<input type="checkbox" switch>`, Safari 17.4+) is toggled, so a
 * hidden one is clicked instead. Both only work inside a user gesture.
 */

let toggle: HTMLLabelElement | null = null;

function iosTap() {
  if (!toggle) {
    toggle = document.createElement('label');
    toggle.setAttribute('aria-hidden', 'true');
    toggle.style.display = 'none';
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.setAttribute('switch', '');
    toggle.append(input);
    document.body.append(toggle);
  }
  toggle.click();
}

/** "tap" for a small confirmation, "success" for something worth celebrating (a PB). */
export function haptic(kind: 'tap' | 'success' = 'tap') {
  try {
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(kind === 'tap' ? 12 : [14, 70, 14, 70, 28]);
      return;
    }
    iosTap();
    if (kind === 'success') {
      setTimeout(iosTap, 90);
      setTimeout(iosTap, 180);
    }
  } catch {
    // Feedback is a nicety; never let it break the action.
  }
}
