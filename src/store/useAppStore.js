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
  keepAwake: false,
  hapticDing: false,
  fadeSeconds: 1.2,
  showStats: true,
  whosUpCount: 1,
  librarySort: 'name',
};

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

export const useAppStore = create(
  persist(
    (set) => ({
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

      updateSettings: (partial) => {
        set((state) => ({ settings: { ...state.settings, ...partial } }));
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
      }),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted || {}),
        data:
          persisted?.lastSynced && persisted?.data?.games?.length
            ? normalizePayload(persisted.data)
            : current.data,
        lists: persisted?.lists || current.lists,
        settings: { ...defaultSettings, ...(persisted?.settings || {}) },
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
      }),
    },
  ),
);

export function gamesInIds(games, ids) {
  return ids.map((id) => games.find((g) => g.id === id)).filter(Boolean);
}
