import { useEffect, useState } from 'react';
import {
  ListPlus,
  CheckCircle,
  Star,
  Folder,
  Plus,
  Trash2,
  ChevronLeft,
  ListTodo,
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { useAppStore, gamesInIds } from '../store/useAppStore.js';
import GameCard from './GameCard.jsx';
import SyncButton from './SyncButton.jsx';

export default function MySetsView() {
  const data = useAppStore((s) => s.data);
  const lists = useAppStore((s) => s.lists);
  const clearList = useAppStore((s) => s.clearList);
  const createCustomSet = useAppStore((s) => s.createCustomSet);
  const deleteCustomSet = useAppStore((s) => s.deleteCustomSet);
  const clearCustomSet = useAppStore((s) => s.clearCustomSet);

  const [activeTab, setActiveTab] = useState('toPlay');
  const [confirmClear, setConfirmClear] = useState(false);
  const [activeCustomSetId, setActiveCustomSetId] = useState(null);
  const [newSetName, setNewSetName] = useState('');
  const [isCreatingSet, setIsCreatingSet] = useState(false);
  const [confirmDeleteSet, setConfirmDeleteSet] = useState(null);

  useEffect(() => {
    setConfirmClear(false);
    setIsCreatingSet(false);
    setConfirmDeleteSet(null);
  }, [activeTab]);

  const currentListGames =
    activeTab !== 'custom'
      ? gamesInIds(data.games, lists[activeTab] || [])
      : activeCustomSetId
        ? gamesInIds(data.games, lists.customSets.find((s) => s.id === activeCustomSetId)?.games || [])
        : [];

  const activeCustomSet = lists.customSets.find((s) => s.id === activeCustomSetId);

  return (
    <div className="h-full flex flex-col pt-safe px-4 md:px-6">
      <div className="flex-none mb-4">
        <div className="flex justify-between items-center gap-3 mb-4">
          <h1 className="text-2xl font-black font-display text-white tracking-tight min-w-0">My Sets</h1>
          <SyncButton compact />
        </div>

        <div className="flex bg-[#1A1A1A] p-1 rounded-xl border border-gray-800 overflow-x-auto scrollbar-hide">
          {[
            ['toPlay', 'To Play', ListPlus, 'bg-blue-600'],
            ['played', 'Played', CheckCircle, 'bg-green-600'],
            ['favorites', 'Faves', Star, 'bg-yellow-600'],
            ['custom', 'Custom', Folder, 'bg-indigo-600'],
          ].map(([id, label, Icon, active]) => (
            <button
              key={id}
              type="button"
              className={`flex-1 min-w-[72px] py-2 text-xs font-bold rounded-lg flex items-center justify-center min-h-11 ${
                activeTab === id ? `${active} text-white` : 'text-gray-400'
              }`}
              onClick={() => {
                setActiveTab(id);
                if (id !== 'custom') setActiveCustomSetId(null);
              }}
            >
              <Icon className="w-4 h-4 mr-1" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pb-nav scrollbar-hide">
        {activeTab === 'custom' && !activeCustomSetId && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-gray-300 font-bold">Your custom sets</h2>
              <button
                type="button"
                onClick={() => setIsCreatingSet((v) => !v)}
                className="bg-indigo-600/20 text-indigo-400 px-3 py-2 rounded-lg text-xs font-bold border border-indigo-500/30 flex items-center min-h-10"
              >
                <Plus className="w-3 h-3 mr-1" /> New set
              </button>
            </div>
            {isCreatingSet && (
              <div className="bg-gray-800 p-3 rounded-xl border border-gray-700 flex gap-2">
                <input
                  type="text"
                  value={newSetName}
                  onChange={(e) => setNewSetName(e.target.value)}
                  placeholder="e.g. Corporate gig"
                  className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    createCustomSet(newSetName);
                    setNewSetName('');
                    setIsCreatingSet(false);
                  }}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold"
                >
                  Save
                </button>
              </div>
            )}
            {lists.customSets.length === 0 && !isCreatingSet ? (
              <div className="text-center mt-12 opacity-60">
                <Folder className="w-12 h-12 mx-auto mb-3 text-indigo-400" />
                <p className="text-sm">No custom sets yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 lg:gap-3">
                {lists.customSets.map((set) => (
                  <div key={set.id} className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-4 flex justify-between items-center">
                    <button type="button" onClick={() => setActiveCustomSetId(set.id)} className="flex-1 text-left min-h-11">
                      <h3 className="font-bold text-gray-200 text-lg">{set.name}</h3>
                      <p className="text-xs text-gray-500">{set.games.length} games</p>
                    </button>
                    {confirmDeleteSet === set.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-red-400 font-bold">Delete?</span>
                        <button type="button" onClick={() => deleteCustomSet(set.id)} className="text-xs bg-red-900/50 text-red-300 border border-red-800 px-2 py-1.5 rounded min-h-11">
                          Yes
                        </button>
                        <button type="button" onClick={() => setConfirmDeleteSet(null)} className="text-xs bg-gray-800 text-gray-300 border border-gray-700 px-2 py-1.5 rounded min-h-11">
                          No
                        </button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setConfirmDeleteSet(set.id)} className="min-w-11 min-h-11 flex items-center justify-center text-gray-600 hover:text-red-400">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {(activeTab !== 'custom' || activeCustomSetId) && (
          <>
            <div className="flex justify-between items-center mb-4">
              {activeTab === 'custom' && activeCustomSetId ? (
                <button type="button" onClick={() => setActiveCustomSetId(null)} className="flex items-center text-sm text-gray-400">
                  <ChevronLeft className="w-4 h-4 mr-1" /> Back to sets
                </button>
              ) : (
                <div />
              )}
              {currentListGames.length > 0 && (
                !confirmClear ? (
                  <button type="button" onClick={() => setConfirmClear(true)} className="flex items-center text-xs text-red-400 bg-red-900/20 px-3 py-1.5 rounded-lg border border-red-900/50">
                    <Trash2 className="w-3 h-3 mr-1.5" /> Clear list
                  </button>
                ) : (
                  <div className="flex items-center gap-2 bg-red-900/20 border border-red-900/50 px-2 py-1 rounded-lg">
                    <span className="text-xs text-red-400 font-bold">Clear all?</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (activeTab === 'custom') clearCustomSet(activeCustomSetId);
                        else clearList(activeTab);
                        setConfirmClear(false);
                      }}
                      className="text-xs bg-red-600 text-white px-2 py-1 rounded"
                    >
                      Yes
                    </button>
                    <button type="button" onClick={() => setConfirmClear(false)} className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded">
                      No
                    </button>
                  </div>
                )
              )}
            </div>

            {activeCustomSet && (
              <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                <Folder className="w-5 h-5 mr-2 text-indigo-400" />
                {activeCustomSet.name}
              </h2>
            )}

            <AnimatePresence>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 lg:gap-3">
                {currentListGames.map((game) => (
                  <GameCard key={game.id} game={game} />
                ))}
              </div>
            </AnimatePresence>

            {currentListGames.length === 0 && (
              <div className="flex flex-col items-center justify-center text-gray-500 px-8 text-center mt-10">
                {activeTab === 'toPlay' && <ListTodo className="w-16 h-16 mb-4 text-blue-500/50" />}
                {activeTab === 'played' && <CheckCircle className="w-16 h-16 mb-4 text-green-500/50" />}
                {activeTab === 'favorites' && <Star className="w-16 h-16 mb-4 text-yellow-500/50" />}
                {activeTab === 'custom' && <Folder className="w-16 h-16 mb-4 text-indigo-500/50" />}
                <p className="text-lg font-medium text-gray-300 mb-2">This list is empty</p>
                <p className="text-sm">Head over to the Library to add games.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
