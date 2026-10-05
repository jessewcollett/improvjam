async function copyJsonText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const field = document.createElement('textarea');
    field.value = text;
    field.setAttribute('readonly', '');
    field.style.position = 'fixed';
    field.style.left = '-9999px';
    document.body.appendChild(field);
    field.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(field);
    return ok;
  } catch {
    return false;
  }
}

export async function shareOrDownloadJson(filename, object) {
  const text = `${JSON.stringify(object, null, 2)}\n`;
  const file = new File([text], filename, { type: 'application/json' });
  try {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'Improv Jam backup' });
      return 'shared';
    }
  } catch (error) {
    if (error?.name === 'AbortError') return 'aborted';
  }
  try {
    const url = URL.createObjectURL(file);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    return 'downloaded';
  } catch {
    return (await copyJsonText(text)) ? 'copied' : '';
  }
}
export const STORE_KEY = 'improv-jam-store';
export const BACKUP_KIND = 'improv-jam-backup';

const IDB_NAME = 'improv-jam';
const IDB_STORE = 'kv';

export const BACKUP_KEYS = [
  'lists',
  'settings',
  'generatorBanks',
  'generatorSkills',
  'generatorBankFavorites',
  'generatorDrawCounts',
  'generatorSessionBanks',
  'gameGeneratorLinks',
  'dismissedTipDate',
  'sfxHidden',
  'sfxOrder',
  'sfxSlots',
  'sfxSlotColors',
  'sfxIconOverrides',
  'musicTags',
  'stagePins',
  'stageSlots',
  'stageSizes',
  'stageZooms',
  'stageFrames',
  'stageFloats',
  'stageLayout',
  'stageAligns',
  'stageCaptions',
  'stageHideCode',
  'stageTheme',
  'stageSpotlight',
  'stageIdeasOpen',
  'stageIdeasUse',
  'stageIdeasHold',
  'stageIdeaCats',
  'stageMessageFavorites',
  'stagePlay',
  'stageFolds',
];

let persistReady = false;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('IndexedDB open failed'));
  });
}

function idbOp(mode, fn) {
  return openDb().then((db) => new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, mode);
    const store = tx.objectStore(IDB_STORE);
    const req = fn(store);
    tx.oncomplete = () => {
      db.close();
      resolve(req?.result);
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error || req?.error || new Error('IndexedDB failed'));
    };
    req.onerror = () => {
      reject(req.error || new Error('IndexedDB request failed'));
    };
  }));
}

async function idbGet(name) {
  const value = await idbOp('readonly', (store) => store.get(name));
  return typeof value === 'string' ? value : value == null ? null : JSON.stringify(value);
}

function idbSet(name, value) {
  return idbOp('readwrite', (store) => store.put(value, name));
}

function idbRemove(name) {
  return idbOp('readwrite', (store) => store.delete(name));
}

function localGet(name) {
  try {
    return localStorage.getItem(name);
  } catch {
    return null;
  }
}

function localSet(name, value) {
  try {
    localStorage.setItem(name, value);
    return true;
  } catch {
    return false;
  }
}

function localRemove(name) {
  try {
    localStorage.removeItem(name);
  } catch {
    /* private mode */
  }
}

export const persistStorage = {
  getItem: async (name) => {
    try {
      const fromIdb = await idbGet(name);
      if (fromIdb != null && fromIdb !== '') {
        persistReady = true;
        return fromIdb;
      }
    } catch {
      /* fall through to localStorage */
    }
    const fromLocal = localGet(name);
    persistReady = true;
    if (fromLocal && fromLocal !== '') {
      try {
        await idbSet(name, fromLocal);
      } catch {
        /* keep using localStorage */
      }
    }
    return fromLocal;
  },
  setItem: async (name, value) => {
    if (!persistReady) return;
    let idbOk = false;
    try {
      await idbSet(name, value);
      idbOk = true;
    } catch {
      /* private mode / IDB blocked */
    }
    const localOk = localSet(name, value);
    if (!idbOk && !localOk) throw new Error('Could not save to this device.');
  },
  removeItem: async (name) => {
    try {
      await idbRemove(name);
    } catch {
      /* ignore */
    }
    localRemove(name);
  },
};

export async function requestPersistentStorage() {
  try {
    if (!navigator.storage?.persist) return { persisted: false, asked: false };
    if (typeof navigator.storage.persisted === 'function' && await navigator.storage.persisted()) {
      return { persisted: true, asked: false };
    }
    const granted = await navigator.storage.persist();
    return { persisted: Boolean(granted), asked: true };
  } catch {
    return { persisted: false, asked: false };
  }
}

export async function storagePersistMode() {
  try {
    if (typeof navigator.storage?.persisted !== 'function') return 'unknown';
    return (await navigator.storage.persisted()) ? 'persistent' : 'best-effort';
  } catch {
    return 'unknown';
  }
}

export function buildDeviceBackup(appState) {
  const state = {};
  BACKUP_KEYS.forEach((key) => {
    if (appState && Object.prototype.hasOwnProperty.call(appState, key)) {
      state[key] = appState[key];
    }
  });
  return {
    v: 1,
    kind: BACKUP_KIND,
    exportedAt: new Date().toISOString(),
    state,
  };
}

export function parseDeviceBackup(raw) {
  let data = raw;
  if (typeof raw === 'string') {
    try {
      data = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  if (data.kind && data.kind !== BACKUP_KIND) return null;
  if (data.state && typeof data.state === 'object' && !Array.isArray(data.state)) return data.state;
  if (data.lists || data.settings) return data;
  return null;
}

export function backupFileName(exportedAt) {
  const stamp = String(exportedAt || new Date().toISOString()).slice(0, 10);
  return `improv-jam-backup-${stamp}.json`;
}

export function backupSummary(state) {
  const lists = state?.lists && typeof state.lists === 'object' ? state.lists : {};
  const sets = Array.isArray(lists.customSets) ? lists.customSets.length : 0;
  const played = Array.isArray(lists.played) ? lists.played.length : 0;
  const toPlay = Array.isArray(lists.toPlay) ? lists.toPlay.length : 0;
  const favorites = Array.isArray(lists.favorites) ? lists.favorites.length : 0;
  const learned = Array.isArray(lists.learned) ? lists.learned.length : 0;
  const parts = [];
  if (sets) parts.push(`${sets} set${sets === 1 ? '' : 's'}`);
  if (toPlay) parts.push(`${toPlay} to play`);
  if (played) parts.push(`${played} played`);
  if (favorites) parts.push(`${favorites} fave${favorites === 1 ? '' : 's'}`);
  if (learned) parts.push(`${learned} learned`);
  return parts.join(' · ') || 'Lists and prefs';
}
