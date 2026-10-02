const PREFIX = 'voice-recorder-studio:';

export function readPreference(key, fallback) {
  try {
    const value = JSON.parse(window.localStorage.getItem(PREFIX + key));
    return value ?? fallback;
  } catch {
    return fallback;
  }
}

export function writePreference(key, value) {
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Preferences are optional when browser storage is unavailable.
  }
}
