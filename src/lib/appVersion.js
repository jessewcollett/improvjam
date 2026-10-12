export const APP_VERSION = import.meta.env.VITE_APP_VERSION || '0.0.0';
export const APP_RELEASE_DATE = '2026-10-12';

/** Keep a Changelog notes for the build currently on the phone. */
export const RELEASE_NOTES = {
  added: [
    'Version and release notes in Settings so you can tell which build is installed',
  ],
  fixed: [
    'Extra empty space under the PWA tab bar (100dvh plus home-indicator padding)',
    'SFX going silent over Bluetooth after the app backgrounds',
  ],
};
