import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import fallback from '../data/mockData.json';
import { fetchSheetData, normalizePayload } from '../lib/sheets.js';
import { normalizeMusicTags, tagsForTrack, toggleTagList } from '../lib/music.js';
import {
  defaultSfxSlots,
  normalizeSfxSlots,
  normalizeSfxSlotColors,
  clampSfxSlotCount,
  clampPadColor,
} from '../lib/sfxPad.js';
import {
  DEFAULT_NAV_ORDER,
  DEFAULT_TOOL_ORDER,
  STAGE_MANAGER_ID,
  clampNavId,
  clampToolId,
  mergeIdOrder,
  moveId,
} from '../lib/nav.js';
import {
  buildStagePayload,
  clampStageZoom,
  fetchStage,
  isStageSlotId,
  listedStageSlots,
  mintStageCode,
  normalizeGameParts,
  normalizeIdeaCats,
  normalizeStageBoardStyle,
  normalizeStageCode,
  normalizeStageFrames,
  normalizeStageIdeasMap,
  normalizeStageLayout,
  normalizeStagePins,
  normalizeStageSizes,
  normalizeStageSlots,
  normalizeStageZooms,
  postStage,
  publishStageGame,
  seedStageFrames,
  STAGE_PUBLISH_DEBOUNCE_MS,
} from '../lib/stage.js';

const bundled = normalizePayload(fallback);

export function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const emptyLists = {
  favorites: [],
  toPlay: [],
  played: [],
  customSets: [],
};

export const defaultSettings = {
  bellStyle: 'bell',
  bellVolume: 0.8,
  countInBeats: 3,
  defaultSfxId: 'bell',
  theme: 'dark',
  reducedMotion: false,
  libraryView: 'games',
  generatorView: 'suggestions',
  keepAwake: false,
  hapticDing: false,
  fadeSeconds: 1.2,
  showStats: true,
  whosUpCount: 1,
  librarySort: 'name',
  lastRoute: 'generator',
  lastTool: 'timer',
  navOrder: [...DEFAULT_NAV_ORDER],
  toolOrder: [...DEFAULT_TOOL_ORDER],
  stageCode: '',
  stageOn: false,
  stageBoardStyle: 'cards',
};

export function normalizeSettings(raw) {
  const merged = { ...defaultSettings, ...(raw || {}) };
  return {
    ...merged,
    navOrder: mergeIdOrder(merged.navOrder, DEFAULT_NAV_ORDER),
    toolOrder: mergeIdOrder(merged.toolOrder, DEFAULT_TOOL_ORDER),
    lastRoute: clampNavId(merged.lastRoute, merged.stageOn === true),
    lastTool: clampToolId(merged.lastTool),
    generatorView: merged.generatorView === 'games' ? 'games' : 'suggestions',
    stageCode: normalizeStageCode(merged.stageCode),
    stageOn: merged.stageOn === true,
    stageBoardStyle: normalizeStageBoardStyle(merged.stageBoardStyle),
  };
}

export const defaultGeneratorBanks = ['Locations', 'Relationships', 'Objects'];
export const defaultGeneratorSkills = [];
export const defaultGeneratorBankFavorites = [];
const emptyDrawCounts = {};

function normalizeDrawCounts(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { ...emptyDrawCounts };
  const next = {};
  for (const [id, value] of Object.entries(raw)) {
    const key = String(id || '').trim();
    if (!key) continue;
    const n = Math.round(Number(value));
    if (!Number.isFinite(n)) continue;
    next[key] = Math.min(12, Math.max(1, n));
  }
  return next;
}

let stagePublishTimer = null;
let stagePublishInflight = false;
let stagePublishQueued = false;

function seedFrames(state, overrides = {}) {
  const pins = overrides.stagePins ?? state.stagePins;
  const layout = overrides.stageLayout ?? state.stageLayout;
  const listed = listedStageSlots(buildStagePayload(
    pins,
    state.stageSlots,
    state.stageSizes,
    layout,
    state.settings.stageBoardStyle,
    state.stageZooms,
  ));
  return seedStageFrames(listed, true, layout);
}

function queueStagePublish() {
  if (stagePublishTimer) clearTimeout(stagePublishTimer);
  stagePublishTimer = setTimeout(() => {
    stagePublishTimer = null;
    publishStageNow();
  }, STAGE_PUBLISH_DEBOUNCE_MS);
}

async function publishStageNow() {
  if (stagePublishTimer) {
    clearTimeout(stagePublishTimer);
    stagePublishTimer = null;
  }
  if (stagePublishInflight) {
    stagePublishQueued = true;
    return;
  }
  stagePublishInflight = true;
  try {
    const state = useAppStore.getState();
    if (!state.settings.stageOn) return;
    const code = normalizeStageCode(state.settings.stageCode);
    if (!code) return;
    const payload = buildStagePayload(
      state.stagePins,
      state.stageSlots,
      state.stageSizes,
      state.stageLayout,
      state.settings.stageBoardStyle,
      state.stageZooms,
      state.stageFrames,
    );
    await postStage(code, payload, {
      ideasOpen: Boolean(state.stageIdeasOpen),
      ideaCats: normalizeIdeaCats(state.stageIdeaCats),
    });
    useAppStore.setState({ stagePublishError: null });
  } catch (error) {
    useAppStore.setState({ stagePublishError: error.message || 'Stage publish failed.' });
  } finally {
    stagePublishInflight = false;
    if (stagePublishQueued) {
      stagePublishQueued = false;
      publishStageNow();
    }
  }
}

export const useAppStore = create(
  persist(
    (set, get) => ({
      data: bundled,
      lists: emptyLists,
      settings: defaultSettings,
      generatorBanks: defaultGeneratorBanks,
      generatorSkills: defaultGeneratorSkills,
      generatorBankFavorites: defaultGeneratorBankFavorites,
      generatorDrawCounts: emptyDrawCounts,
      lastSynced: null,
      syncError: null,
      isSyncing: false,
      dismissedTipDate: null,
      sfxHidden: [],
      sfxOrder: [],
      sfxSlots: defaultSfxSlots,
      sfxSlotColors: normalizeSfxSlotColors([], defaultSfxSlots.length),
      sfxIconOverrides: {},
      musicTags: {},
      stagePins: [],
      stageSlots: {},
      stageSizes: {},
      stageZooms: {},
      stageFrames: {},
      stageLayout: '',
      stageIdeasOpen: false,
      stageIdeaCats: [...defaultGeneratorBanks],
      stageIdeas: {},
      stagePublishError: null,

      updateSettings: (partial) => {
        set((state) => ({ settings: { ...state.settings, ...partial } }));
      },

      setStageBoardStyle: (style) => {
        set((state) => ({
          settings: { ...state.settings, stageBoardStyle: normalizeStageBoardStyle(style) },
        }));
        queueStagePublish();
      },

      toggleStageGamePart: (gameName, partId) => {
        const name = String(typeof gameName === 'object' ? gameName?.name : gameName || '').trim();
        const id = String(partId || '').trim();
        if (!name || !id) return;
        let shouldPublish = false;
        set((state) => {
          const current = Array.isArray(state.stageSlots.games) ? state.stageSlots.games : [];
          const index = current.findIndex((item) => String(item?.name || '').trim() === name);
          if (index < 0) return {};
          shouldPublish = state.stagePins.includes('games');
          const catalog = (state.data.games || []).find((game) => String(game.name || '').trim() === name);
          const source = catalog || current[index];
          const selected = normalizeGameParts(current[index].parts, source);
          const nextParts = selected.includes(id)
            ? selected.filter((item) => item !== id)
            : [...selected, id];
          const nextItem = publishStageGame(source, nextParts);
          if (!nextItem) return {};
          const next = current.slice();
          next[index] = nextItem;
          return { stageSlots: { ...state.stageSlots, games: next } };
        });
        if (shouldPublish) queueStagePublish();
      },

      ensureStageCode: () => {
        const current = normalizeStageCode(get().settings.stageCode);
        if (current) {
          if (current !== get().settings.stageCode) {
            set((state) => ({ settings: { ...state.settings, stageCode: current } }));
          }
          return current;
        }
        const code = mintStageCode();
        set((state) => ({ settings: { ...state.settings, stageCode: code } }));
        return code;
      },

      setStageCode: (raw) => {
        const code = normalizeStageCode(raw);
        if (!code) return '';
        const prev = normalizeStageCode(get().settings.stageCode);
        if (code === prev) return code;
        set((state) => ({ settings: { ...state.settings, stageCode: code } }));
        queueStagePublish();
        return code;
      },

      mintNewStageCode: () => {
        const prev = normalizeStageCode(get().settings.stageCode);
        let code = mintStageCode();
        if (code === prev) code = mintStageCode();
        set((state) => ({ settings: { ...state.settings, stageCode: code } }));
        queueStagePublish();
        return code;
      },

      setStageOn: (on) => {
        const next = Boolean(on);
        if (next) {
          const code = get().ensureStageCode();
          set((state) => ({
            settings: { ...state.settings, stageOn: true, stageCode: code || state.settings.stageCode },
          }));
          publishStageNow();
          return;
        }
        const code = normalizeStageCode(get().settings.stageCode);
        set((state) => ({
          settings: {
            ...state.settings,
            stageOn: false,
            lastRoute: state.settings.lastRoute === STAGE_MANAGER_ID ? 'generator' : state.settings.lastRoute,
          },
        }));
        if (code) postStage(code, {}).catch(() => {});
      },

      toggleStagePin: (id) => {
        if (!isStageSlotId(id)) return;
        if (get().settings.stageOn) get().ensureStageCode();
        set((state) => {
          const on = state.stagePins.includes(id);
          const stagePins = on ? state.stagePins.filter((item) => item !== id) : [...state.stagePins, id];
          return { stagePins, stageFrames: seedFrames(state, { stagePins }) };
        });
        publishStageNow();
      },

      setStageSlot: (id, data) => {
        if (!isStageSlotId(id)) return;
        let shouldPublish = false;
        set((state) => {
          shouldPublish = state.stagePins.includes(id);
          return { stageSlots: { ...state.stageSlots, [id]: data } };
        });
        if (shouldPublish) publishStageNow();
      },

      publishStageTimer: (timer) => {
        set((state) => ({ stageSlots: { ...state.stageSlots, timer } }));
        if (get().stagePins.includes('timer')) publishStageNow();
      },

      unpinStageSlot: (id) => {
        if (!isStageSlotId(id)) return;
        set((state) => {
          if (!state.stagePins.includes(id)) return {};
          const stagePins = state.stagePins.filter((item) => item !== id);
          return { stagePins, stageFrames: seedFrames(state, { stagePins }) };
        });
        publishStageNow();
      },

      removeStageSlotItem: (id, index) => {
        if (!isStageSlotId(id)) return;
        const i = Number(index);
        if (!Number.isInteger(i) || i < 0) return;
        let emptied = false;
        set((state) => {
          const current = state.stageSlots[id];
          if (!Array.isArray(current)) return {};
          const next = current.filter((_, idx) => idx !== i);
          emptied = next.length === 0;
          const stagePins = emptied ? state.stagePins.filter((item) => item !== id) : state.stagePins;
          return {
            stageSlots: { ...state.stageSlots, [id]: next },
            stagePins,
            stageFrames: emptied ? seedFrames(state, { stagePins }) : state.stageFrames,
          };
        });
        publishStageNow();
      },

      setStageZoom: (id, zoom) => {
        if (!isStageSlotId(id)) return;
        const next = clampStageZoom(zoom);
        set((state) => ({
          stageZooms: { ...state.stageZooms, [id]: next },
        }));
        if (get().stagePins.includes(id)) queueStagePublish();
      },

      setStageLayout: (id) => {
        set((state) => {
          const stageLayout = normalizeStageLayout(id);
          return { stageLayout, stageFrames: seedFrames(state, { stageLayout }) };
        });
        queueStagePublish();
      },

      setStageFrames: (frames) => {
        set({ stageFrames: normalizeStageFrames(frames) });
        queueStagePublish();
      },

      resetStageFrames: () => {
        set({ stageFrames: {} });
        queueStagePublish();
      },

      setStageIdeasOpen: (open) => {
        const next = Boolean(open);
        set((state) => {
          const cats = normalizeIdeaCats(state.stageIdeaCats);
          const seeded = cats.length
            ? cats
            : (state.generatorBanks || []).filter(Boolean);
          return {
            stageIdeasOpen: next,
            stageIdeaCats: next && !cats.length ? seeded : state.stageIdeaCats,
          };
        });
        if (get().settings.stageOn) publishStageNow();
      },

      setStageIdeaCats: (ids) => {
        set({ stageIdeaCats: normalizeIdeaCats(ids) });
        if (get().settings.stageOn && get().stageIdeasOpen) publishStageNow();
      },

      toggleStageIdeaCat: (id) => {
        const key = String(id || '').trim();
        if (!key) return;
        set((state) => {
          const current = normalizeIdeaCats(state.stageIdeaCats);
          const next = current.includes(key)
            ? current.filter((item) => item !== key)
            : [...current, key];
          return { stageIdeaCats: next };
        });
        if (get().settings.stageOn && get().stageIdeasOpen) publishStageNow();
      },

      pullStageIdeas: async () => {
        const state = get();
        if (!state.settings.stageOn || !state.stageIdeasOpen) return;
        const code = normalizeStageCode(state.settings.stageCode);
        if (!code) return;
        try {
          const data = await fetchStage(code);
          set({ stageIdeas: data.ideas || {} });
        } catch {
          /* keep last pool */
        }
      },

      moveStagePin: (id, direction) => {
        const delta = Number(direction);
        if (!isStageSlotId(id) || (delta !== 1 && delta !== -1)) return;
        set((state) => {
          const listed = listedStageSlots(
            buildStagePayload(
              state.stagePins,
              state.stageSlots,
              state.stageSizes,
              state.stageLayout,
              state.settings.stageBoardStyle,
              state.stageZooms,
              state.stageFrames,
            ),
          ).map((slot) => slot.id);
          const from = listed.indexOf(id);
          const to = from + delta;
          if (from < 0 || to < 0 || to >= listed.length) return {};
          const nextListed = moveId(listed, from, to);
          const rest = state.stagePins.filter((pin) => !nextListed.includes(pin));
          const stagePins = [...nextListed, ...rest];
          return { stagePins, stageFrames: seedFrames(state, { stagePins }) };
        });
        queueStagePublish();
      },

      clearStagePins: () => {
        set({ stagePins: [], stageFrames: {} });
        publishStageNow();
      },

      dismissTipOfTheDay: () => {
        set({ dismissedTipDate: localDateString() });
      },

      setDefaultSfx: (id) => {
        const next = String(id || '').trim();
        if (!next) return;
        set((state) => ({ settings: { ...state.settings, defaultSfxId: next, bellStyle: next } }));
      },

      toggleMusicTag: (trackId, tag, sheetTags = []) => {
        const id = String(trackId || '').trim();
        const nextTag = String(tag || '').trim();
        if (!id || !nextTag) return;
        set((state) => {
          const current = tagsForTrack({ id, tags: sheetTags }, state.musicTags);
          return {
            musicTags: {
              ...state.musicTags,
              [id]: toggleTagList(current, nextTag),
            },
          };
        });
      },

      assignSfxSlot: (index, soundId) => {
        set((state) => {
          const slots = normalizeSfxSlots(state.sfxSlots, state.sfxOrder, state.sfxHidden);
          if (index < 0 || index >= slots.length) return {};
          slots[index] = soundId || null;
          return { sfxSlots: slots };
        });
      },

      setSfxSlotCount: (count) => {
        const n = clampSfxSlotCount(count);
        set((state) => {
          const current = normalizeSfxSlots(state.sfxSlots, state.sfxOrder, state.sfxHidden);
          const colors = normalizeSfxSlotColors(state.sfxSlotColors, current.length);
          if (n === current.length) return {};
          if (n > current.length) {
            return {
              sfxSlots: [...current, ...Array(n - current.length).fill(null)],
              sfxSlotColors: [...colors, ...Array(n - current.length).fill('slate')],
            };
          }
          return { sfxSlots: current.slice(0, n), sfxSlotColors: colors.slice(0, n) };
        });
      },

      setSfxSlotColor: (index, colorId) => {
        set((state) => {
          const slots = normalizeSfxSlots(state.sfxSlots, state.sfxOrder, state.sfxHidden);
          if (index < 0 || index >= slots.length) return {};
          const colors = normalizeSfxSlotColors(state.sfxSlotColors, slots.length);
          colors[index] = clampPadColor(colorId);
          return { sfxSlotColors: colors };
        });
      },

      setSfxIconOverride: (soundId, icon) => {
        const id = String(soundId || '').trim();
        if (!id) return;
        set((state) => {
          const next = { ...(state.sfxIconOverrides || {}) };
          const val = String(icon || '').trim();
          if (!val) delete next[id];
          else next[id] = val;
          return { sfxIconOverrides: next };
        });
      },

      moveSfxSlot: (from, to) => {
        set((state) => {
          const slots = normalizeSfxSlots(state.sfxSlots, state.sfxOrder, state.sfxHidden);
          const colors = normalizeSfxSlotColors(state.sfxSlotColors, slots.length);
          if (from === to || from < 0 || to < 0 || from >= slots.length || to >= slots.length) return {};
          const [slot] = slots.splice(from, 1);
          const [color] = colors.splice(from, 1);
          slots.splice(to, 0, slot);
          colors.splice(to, 0, color);
          return { sfxSlots: slots, sfxSlotColors: colors };
        });
      },

      toggleSfxHidden: (id) => {
        set((state) => {
          const current = state.sfxHidden || [];
          const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
          return { sfxHidden: next };
        });
      },

      moveSfx: (id, direction) => {
        set((state) => {
          const pads = Array.isArray(state.sfxOrder) ? [...state.sfxOrder] : [];
          const from = pads.indexOf(id);
          if (from < 0) return {};
          const to = from + direction;
          if (to < 0 || to >= pads.length) return {};
          const [item] = pads.splice(from, 1);
          pads.splice(to, 0, item);
          return { sfxOrder: pads };
        });
      },

      setSfxOrder: (ids) => {
        set({ sfxOrder: Array.isArray(ids) ? ids : [] });
      },

      toggleGeneratorBank: (id) => {
        set((state) => {
          const current = state.generatorBanks || [];
          const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
          return { generatorBanks: next };
        });
      },

      setGeneratorBanks: (ids) => {
        set({ generatorBanks: Array.isArray(ids) ? ids : [] });
      },

      toggleGeneratorBankFavorite: (id) => {
        set((state) => {
          const current = state.generatorBankFavorites || [];
          const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
          return { generatorBankFavorites: next };
        });
      },

      toggleGeneratorSkill: (id) => {
        set((state) => {
          const current = state.generatorSkills || [];
          const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
          return { generatorSkills: next };
        });
      },

      setGeneratorDrawCount: (id, count) => {
        const key = String(id || '').trim();
        if (!key) return;
        const n = Math.round(Number(count));
        if (!Number.isFinite(n)) return;
        set((state) => ({
          generatorDrawCounts: {
            ...(state.generatorDrawCounts || {}),
            [key]: Math.min(12, Math.max(1, n)),
          },
        }));
      },

      toggleInList: (listName, id) => {
        set((state) => {
          const current = state.lists[listName] || [];
          const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
          return { lists: { ...state.lists, [listName]: next } };
        });
      },

      clearList: (listName) => {
        set((state) => ({ lists: { ...state.lists, [listName]: [] } }));
      },

      createCustomSet: (name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((state) => ({
          lists: {
            ...state.lists,
            customSets: [...state.lists.customSets, { id: `set_${Date.now()}`, name: trimmed, games: [] }],
          },
        }));
      },

      renameCustomSet: (setId, name) => {
        const trimmed = String(name || '').trim();
        if (!trimmed) return;
        set((state) => ({
          lists: {
            ...state.lists,
            customSets: state.lists.customSets.map((s) => (s.id === setId ? { ...s, name: trimmed } : s)),
          },
        }));
      },

      deleteCustomSet: (setId) => {
        set((state) => ({
          lists: {
            ...state.lists,
            customSets: state.lists.customSets.filter((s) => s.id !== setId),
          },
        }));
      },

      toggleInCustomSet: (setId, gameId) => {
        set((state) => ({
          lists: {
            ...state.lists,
            customSets: state.lists.customSets.map((s) => {
              if (s.id !== setId) return s;
              const games = s.games.includes(gameId)
                ? s.games.filter((id) => id !== gameId)
                : [...s.games, gameId];
              return { ...s, games };
            }),
          },
        }));
      },

      clearCustomSet: (setId) => {
        set((state) => ({
          lists: {
            ...state.lists,
            customSets: state.lists.customSets.map((s) => (s.id === setId ? { ...s, games: [] } : s)),
          },
        }));
      },

      syncFromSheet: async () => {
        set({ isSyncing: true, syncError: null });
        try {
          const data = normalizePayload(await fetchSheetData());
          if (!data.games.length) {
            throw new Error('Sheet returned no games. Run populateCatalog() in Apps Script.');
          }
          set({ data, lastSynced: new Date().toISOString(), isSyncing: false, syncError: null });
          return data;
        } catch (error) {
          set({ isSyncing: false, syncError: error.message });
          throw error;
        }
      },

      resetLibraryToBundled: () => {
        set({ data: bundled, lastSynced: null, syncError: null });
      },
    }),
    {
      name: 'improv-jam-store',
      partialize: (state) => ({
        data: state.data,
        lists: state.lists,
        settings: state.settings,
        generatorBanks: state.generatorBanks,
        generatorSkills: state.generatorSkills,
        generatorBankFavorites: state.generatorBankFavorites,
        generatorDrawCounts: state.generatorDrawCounts,
        lastSynced: state.lastSynced,
        dismissedTipDate: state.dismissedTipDate,
        sfxHidden: state.sfxHidden,
        sfxOrder: state.sfxOrder,
        sfxSlots: state.sfxSlots,
        sfxSlotColors: state.sfxSlotColors,
        sfxIconOverrides: state.sfxIconOverrides,
        musicTags: state.musicTags,
        stagePins: state.stagePins,
        stageSlots: state.stageSlots,
        stageSizes: state.stageSizes,
        stageZooms: state.stageZooms,
        stageFrames: state.stageFrames,
        stageLayout: state.stageLayout,
        stageIdeasOpen: state.stageIdeasOpen,
        stageIdeaCats: state.stageIdeaCats,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted || {}),
        data:
          persisted?.lastSynced && persisted?.data?.games?.length
            ? normalizePayload(persisted.data)
            : current.data,
        lists: persisted?.lists || current.lists,
        settings: normalizeSettings(persisted?.settings),
        dismissedTipDate:
          typeof persisted?.dismissedTipDate === 'string' ? persisted.dismissedTipDate : current.dismissedTipDate,
        generatorBanks: Array.isArray(persisted?.generatorBanks)
          ? persisted.generatorBanks
          : current.generatorBanks,
        generatorSkills: Array.isArray(persisted?.generatorSkills)
          ? persisted.generatorSkills
          : current.generatorSkills,
        generatorBankFavorites: Array.isArray(persisted?.generatorBankFavorites)
          ? persisted.generatorBankFavorites
          : current.generatorBankFavorites,
        generatorDrawCounts: normalizeDrawCounts(persisted?.generatorDrawCounts),
        sfxHidden: Array.isArray(persisted?.sfxHidden) ? persisted.sfxHidden : current.sfxHidden,
        sfxOrder: Array.isArray(persisted?.sfxOrder) ? persisted.sfxOrder : current.sfxOrder,
        sfxSlots: normalizeSfxSlots(persisted?.sfxSlots, persisted?.sfxOrder, persisted?.sfxHidden),
        sfxSlotColors: normalizeSfxSlotColors(
          persisted?.sfxSlotColors,
          normalizeSfxSlots(persisted?.sfxSlots, persisted?.sfxOrder, persisted?.sfxHidden).length,
        ),
        sfxIconOverrides:
          persisted?.sfxIconOverrides && typeof persisted.sfxIconOverrides === 'object' && !Array.isArray(persisted.sfxIconOverrides)
            ? persisted.sfxIconOverrides
            : current.sfxIconOverrides,
        musicTags: normalizeMusicTags(persisted?.musicTags),
        stagePins: normalizeStagePins(persisted?.stagePins),
        stageSlots: normalizeStageSlots(persisted?.stageSlots),
        stageSizes: normalizeStageSizes(persisted?.stageSizes),
        stageZooms: normalizeStageZooms(persisted?.stageZooms, persisted?.stageSizes),
        stageFrames: normalizeStageFrames(persisted?.stageFrames),
        stageLayout: normalizeStageLayout(persisted?.stageLayout),
        stageIdeasOpen: persisted?.stageIdeasOpen === true,
        stageIdeaCats: normalizeIdeaCats(
          Array.isArray(persisted?.stageIdeaCats) ? persisted.stageIdeaCats : current.stageIdeaCats,
        ),
        stageIdeas: normalizeStageIdeasMap(persisted?.stageIdeas),
        stagePublishError: null,
      }),
    },
  ),
);

export function gamesInIds(games, ids) {
  return ids.map((id) => games.find((g) => g.id === id)).filter(Boolean);
}
