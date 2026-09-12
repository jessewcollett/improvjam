import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import fallback from '../data/mockData.json';
import { fetchSheetData, normalizePayload } from '../lib/sheets.js';

const bundled = normalizePayload(fallback);

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
};

export const defaultGeneratorBanks = ['Locations', 'Relationships', 'Objects'];
export const defaultGeneratorSkills = [];

export const useAppStore = create(
  persist(
    (set) => ({
      data: bundled,
      lists: emptyLists,
      settings: defaultSettings,
      generatorBanks: defaultGeneratorBanks,
      generatorSkills: defaultGeneratorSkills,
      lastSynced: null,
      syncError: null,
      isSyncing: false,

      updateSettings: (partial) => {
        set((state) => ({ settings: { ...state.settings, ...partial } }));
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

      toggleGeneratorSkill: (id) => {
        set((state) => {
          const current = state.generatorSkills || [];
          const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
          return { generatorSkills: next };
        });
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
        lastSynced: state.lastSynced,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted || {}),
        data:
          persisted?.lastSynced && persisted?.data?.games?.length
            ? persisted.data
            : current.data,
        lists: persisted?.lists || current.lists,
        settings: { ...defaultSettings, ...(persisted?.settings || {}) },
        generatorBanks: Array.isArray(persisted?.generatorBanks)
          ? persisted.generatorBanks
          : current.generatorBanks,
        generatorSkills: Array.isArray(persisted?.generatorSkills)
          ? persisted.generatorSkills
          : current.generatorSkills,
      }),
    },
  ),
);

export function gamesInIds(games, ids) {
  return ids.map((id) => games.find((g) => g.id === id)).filter(Boolean);
}
