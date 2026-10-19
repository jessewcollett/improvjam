export const APP_VERSION = import.meta.env.VITE_APP_VERSION || '0.0.0';
export const APP_RELEASE_DATE = '2026-10-12';

/** Keep a Changelog notes for the build currently on the phone. */
export const RELEASE_NOTES = {
  added: [
    'Version and release notes in Settings so you can tell which build is installed',
    'Copy screen layout from Profile (full PWA geometry snapshot)',
    'Version shown at the top of Settings; PWA reloads when a new build is ready',
    'Music GO, standby next/prev, remaining time, and shuffle within the current tag filter',
  ],
  fixed: [
    'PWA tab labels sitting above a black pad at the home indicator',
    'SFX going silent over Bluetooth after the app backgrounds',
    'Music fade ignored on iPhone (now uses Web Audio gain)',
    'Music AudioContext starting before a tap, so GO sometimes did nothing until refresh',
    'Swipe-to-delete on set lists needing a very long swipe',
  ],
};
