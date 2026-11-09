export const APP_VERSION = import.meta.env.VITE_APP_VERSION || '0.0.0';
export const APP_RELEASE_DATE = '2026-11-09';

/** Keep a Changelog notes for the build currently on the phone. */
export const RELEASE_NOTES = {
  added: [
    'Settings Sync now loads the sheet onto this phone even if local Stage or sets look newer',
  ],
  fixed: [
    'Stale phone profiles overwriting a newer ZIPZEBRA sheet (folders and Performance rundowns)',
    'Dirty local Stage/SFX skipping a pull and pushing over a richer set list',
  ],
};
