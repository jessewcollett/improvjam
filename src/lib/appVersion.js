export const APP_VERSION = import.meta.env.VITE_APP_VERSION || '0.0.0';
export const APP_RELEASE_DATE = '2026-10-21';

/** Keep a Changelog notes for the build currently on the phone. */
export const RELEASE_NOTES = {
  added: [
    'Stage sessions time out after 15 minutes idle so leftover TV and Ideas tabs stop polling',
  ],
  fixed: [
    'Apps Script quota spike from Stage/Ideas polling the spreadsheet on every tick',
    'Ghost Stage boards keeping Google executions running after nobody is using the app',
  ],
};
