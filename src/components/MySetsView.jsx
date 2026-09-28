import { useEffect, useState } from 'react';
import {
  Link2,
  ListPlus,
  CheckCircle,
  Star,
  Folder,
  Pencil,
  Plus,
  Trash2,
  ChevronLeft,
  ListTodo,
  Share2,
  X,
  Play,
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { useAppStore, gamesInIds } from '../store/useAppStore.js';
import { copyText } from '../lib/stage.js';
import { decodeSharedSet, sharedSetUrl } from '../lib/setShare.js';
import GameCard from './GameCard.jsx';
import StagePin from './StagePin.jsx';
import SyncButton from './SyncButton.jsx';
import DragOrderList from './DragOrderList.jsx';
import SetGamePicker from './SetGamePicker.jsx';

const LIST_LABELS = {
  toPlay: 'To Play',
  played: 'Played',
  favorites: 'Favorites',
};

function setSlotFromIds(id, name, ids, games) {
  return {
    id,
    name,
    games: gamesInIds(games, ids).map((game) => game.name),
  };
}

export default function MySetsView() {
  const data = useAppStore((s) => s.data);
  const lists = useAppStore((s) => s.lists);
  const showStats = useAppStore((s) => s.settings.showStats) !== false;
  const clearList = useAppStore((s) => s.clearList);
  const createCustomSet = useAppStore((s) => s.createCustomSet);
  const renameCustomSet = useAppStore((s) => s.renameCustomSet);
  const deleteCustomSet = useAppStore((s) => s.deleteCustomSet);
  const clearCustomSet = useAppStore((s) => s.clearCustomSet);
  const toggleInCustomSet = useAppStore((s) => s.toggleInCustomSet);
  const reorderCustomSets = useAppStore((s) => s.reorderCustomSets);
  const reorderCustomSetGames = useAppStore((s) => s.reorderCustomSetGames);
  const focusCustomSetId = useAppStore((s) => s.focusCustomSetId);
  const sharedSetNotice = useAppStore((s) => s.sharedSetNotice);
  const clearFocusCustomSet = useAppStore((s) => s.clearFocusCustomSet);
  const clearSharedSetNotice = useAppStore((s) => s.clearSharedSetNotice);
  const importSharedSet = useAppStore((s) => s.importSharedSet);
  const setSharedSetNotice = useAppStore((s) => s.setSharedSetNotice);
  const stagePins = useAppStore((s) => s.stagePins);
  const stageSlots = useAppStore((s) => s.stageSlots);
  const setStageSlot = useAppStore((s) => s.setStageSlot);
  const toggleStagePin = useAppStore((s) => s.toggleStagePin);
  const startStagePlay = useAppStore((s) => s.startStagePlay);
  const setPinned = stagePins.includes('set');
  const pinnedSetId = stageSlots.set?.id;

  const [activeTab, setActiveTab] = useState('toPlay');
  const [confirmClear, setConfirmClear] = useState(false);
  const [activeCustomSetId, setActiveCustomSetId] = useState(null);
  const [newSetName, setNewSetName] = useState('');
  const [isCreatingSet, setIsCreatingSet] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importDraft, setImportDraft] = useState('');
  const [confirmDeleteSet, setConfirmDeleteSet] = useState(null);
  const [renamingId, setRenamingId] = useState(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [addingGames, setAddingGames] = useState(false);
  const [shareNote, setShareNote] = useState('');

  useEffect(() => {
    setConfirmClear(false);
    setIsCreatingSet(false);
    setIsImporting(false);
    setImportDraft('');
    setConfirmDeleteSet(null);
    setRenamingId(null);
    setRenameDraft('');
    setEditing(false);
    setAddingGames(false);
    setShareNote('');
  }, [activeTab]);

  useEffect(() => {
    if (!focusCustomSetId) return;
    setActiveTab('custom');
    setActiveCustomSetId(focusCustomSetId);
    setEditing(false);
    clearFocusCustomSet();
  }, [focusCustomSetId, clearFocusCustomSet]);

  const beginRename = (set) => {
    setRenamingId(set.id);
    setRenameDraft(set.name);
    setConfirmDeleteSet(null);
  };

  const commitRename = () => {
    if (renamingId) renameCustomSet(renamingId, renameDraft);
    setRenamingId(null);
    setRenameDraft('');
  };

  useEffect(() => {
    if (!setPinned || !pinnedSetId) return;
    if (LIST_LABELS[pinnedSetId]) {
      setStageSlot('set', setSlotFromIds(pinnedSetId, LIST_LABELS[pinnedSetId], lists[pinnedSetId] || [], data.games));
      return;
    }
    const match = lists.customSets.find((item) => item.id === pinnedSetId);
    if (!match) {
      toggleStagePin('set');
      return;
    }
    setStageSlot('set', setSlotFromIds(match.id, match.name, match.games, data.games));
  }, [data.games, lists, pinnedSetId, setPinned, setStageSlot, toggleStagePin]);

  const pinSet = (id, name, ids) => {
    const already = setPinned && pinnedSetId === id;
    if (already) {
      toggleStagePin('set');
      return;
    }
    setStageSlot('set', setSlotFromIds(id, name, ids, data.games));
    if (!setPinned) toggleStagePin('set');
  };

  const currentListGames =
    activeTab !== 'custom'
      ? gamesInIds(data.games, lists[activeTab] || [])
      : activeCustomSetId
        ? gamesInIds(data.games, lists.customSets.find((s) => s.id === activeCustomSetId)?.games || [])
        : [];

  const activeCustomSet = lists.customSets.find((s) => s.id === activeCustomSetId);
  const customEditing = activeTab === 'custom' && editing;

  const shareActiveSet = async () => {
    if (!activeCustomSet?.games.length) return;
    const url = sharedSetUrl({ name: activeCustomSet.name, ids: activeCustomSet.games });
    if (!url) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: activeCustomSet.name, text: `Improv Jam set: ${activeCustomSet.name}`, url });
        return;
      }
    } catch {
      /* fall through to copy */
    }
    if (await copyText(url)) {
      setShareNote('Link copied');
      window.setTimeout(() => setShareNote(''), 1600);
    }
  };

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
        {sharedSetNotice ? (
          <div className="mb-3 rounded-xl border border-amber-800/60 bg-amber-950/40 px-3 py-2 flex items-start gap-2">
            <p className="flex-1 text-sm text-amber-200">{sharedSetNotice}</p>
            <button
              type="button"
              onClick={clearSharedSetNotice}
              className="min-w-11 min-h-11 flex items-center justify-center text-amber-300"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : null}

        {activeTab === 'custom' && !activeCustomSetId && (
          <div className="space-y-4">
            <div className="flex justify-between items-center gap-2">
              <h2 className="text-gray-300 font-bold">Your custom sets</h2>
              <div className="flex items-center gap-2">
                {lists.customSets.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => setEditing((v) => !v)}
                    className={`px-3 py-2 rounded-lg text-xs font-bold border min-h-10 ${
                      editing
                        ? 'bg-indigo-600 text-white border-indigo-400'
                        : 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30'
                    }`}
                  >
                    {editing ? 'Done' : 'Edit'}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setIsImporting((v) => !v);
                    setIsCreatingSet(false);
                  }}
                  className="bg-indigo-600/20 text-indigo-400 px-3 py-2 rounded-lg text-xs font-bold border border-indigo-500/30 flex items-center min-h-10"
                >
                  <Link2 className="w-3 h-3 mr-1" /> Import
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingSet((v) => !v);
                    setIsImporting(false);
                  }}
                  className="bg-indigo-600/20 text-indigo-400 px-3 py-2 rounded-lg text-xs font-bold border border-indigo-500/30 flex items-center min-h-10"
                >
                  <Plus className="w-3 h-3 mr-1" /> New set
                </button>
              </div>
            </div>
            {isImporting && (
              <div className="bg-gray-800 p-3 rounded-xl border border-gray-700 flex gap-2">
                <input
                  type="text"
                  value={importDraft}
                  onChange={(e) => setImportDraft(e.target.value)}
                  placeholder="Paste share link or token"
                  className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm min-w-0"
                  autoComplete="off"
                  autoCapitalize="off"
                />
                <button
                  type="button"
                  onClick={() => {
                    const decoded = decodeSharedSet(importDraft);
                    if (!decoded) {
                      setSharedSetNotice('Couldn’t read that share link.');
                      return;
                    }
                    importSharedSet(decoded);
                    setImportDraft('');
                    setIsImporting(false);
                  }}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-bold"
                >
                  Import
                </button>
              </div>
            )}
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
            ) : editing ? (
              <DragOrderList
                items={lists.customSets.map((set) => ({
                  id: set.id,
                  label: set.name,
                  detail: showStats ? `${set.games.length} games` : '',
                }))}
                onOrder={reorderCustomSets}
                onActivate={(item) => {
                  setActiveCustomSetId(item.id);
                  setEditing(true);
                }}
                renderAfter={(item) => {
                  const set = lists.customSets.find((entry) => entry.id === item.id);
                  if (!set) return null;
                  if (renamingId === set.id) {
                    return (
                      <form
                        className="flex gap-1 shrink-0"
                        onSubmit={(event) => {
                          event.preventDefault();
                          commitRename();
                        }}
                      >
                        <button type="submit" className="min-h-11 px-2 rounded-lg bg-indigo-600 text-white text-xs font-bold">
                          Save
                        </button>
                      </form>
                    );
                  }
                  return (
                    <>
                      <button
                        type="button"
                        onClick={() => beginRename(set)}
                        className="min-w-11 min-h-11 flex items-center justify-center text-gray-500 hover:text-indigo-300"
                        aria-label={`Rename ${set.name}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      {confirmDeleteSet === set.id ? (
                        <div className="flex items-center gap-1">
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
                    </>
                  );
                }}
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 lg:gap-3">
                {lists.customSets.map((set) => (
                  <div key={set.id} className="bg-[#1A1A1A] border border-gray-800 rounded-xl p-4 flex justify-between items-center gap-1">
                    {renamingId === set.id ? (
                      <form
                        className="flex-1 flex gap-2 min-w-0"
                        onSubmit={(event) => {
                          event.preventDefault();
                          commitRename();
                        }}
                      >
                        <input
                          type="text"
                          value={renameDraft}
                          onChange={(e) => setRenameDraft(e.target.value)}
                          className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm min-h-11"
                          aria-label="Set name"
                          autoFocus
                        />
                        <button type="submit" className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-bold min-h-11">
                          Save
                        </button>
                      </form>
                    ) : (
                      <button type="button" onClick={() => setActiveCustomSetId(set.id)} className="flex-1 text-left min-h-11">
                        <h3 className="font-bold text-gray-200 text-lg">{set.name}</h3>
                        {showStats ? <p className="text-xs text-gray-500">{set.games.length} games</p> : null}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            {editing && renamingId ? (
              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  commitRename();
                }}
              >
                <input
                  type="text"
                  value={renameDraft}
                  onChange={(e) => setRenameDraft(e.target.value)}
                  className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm min-h-11"
                  aria-label="Set name"
                  autoFocus
                />
                <button type="submit" className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-bold min-h-11">
                  Save
                </button>
              </form>
            ) : null}
          </div>
        )}

        {(activeTab !== 'custom' || activeCustomSetId) && (
          <>
            <div className="flex justify-between items-center mb-4 gap-2">
              {activeTab === 'custom' && activeCustomSetId ? (
                <button
                  type="button"
                  onClick={() => {
                    setActiveCustomSetId(null);
                    setEditing(false);
                    setAddingGames(false);
                  }}
                  className="flex items-center text-sm text-gray-400"
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Back to sets
                </button>
              ) : (
                <div />
              )}
              <div className="flex items-center gap-2">
              {activeTab === 'custom' && activeCustomSet ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditing((v) => !v);
                    setAddingGames(false);
                    setConfirmClear(false);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border min-h-10 ${
                    editing
                      ? 'bg-indigo-600 text-white border-indigo-400'
                      : 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30'
                  }`}
                >
                  {editing ? 'Done' : 'Edit'}
                </button>
              ) : null}
              {activeTab === 'custom' && activeCustomSet?.games.length ? (
                <button
                  type="button"
                  onClick={() => startStagePlay(activeCustomSet.id)}
                  className="min-h-10 px-3 rounded-lg border border-lime-700 bg-lime-700 text-white text-xs font-bold inline-flex items-center gap-1"
                >
                  <Play className="w-3.5 h-3.5" />
                  Play
                </button>
              ) : null}
              {activeTab === 'custom' && activeCustomSet?.games.length ? (
                <button
                  type="button"
                  onClick={shareActiveSet}
                  className="min-h-10 px-3 rounded-lg border border-gray-700 bg-gray-800 text-xs font-bold text-gray-100 inline-flex items-center gap-1"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  {shareNote || 'Share'}
                </button>
              ) : null}
              {activeTab !== 'custom' ? (
                <StagePin
                  pressed={setPinned && pinnedSetId === activeTab}
                  label={setPinned && pinnedSetId === activeTab ? 'Unpin this list from Stage' : 'Pin this list to Stage'}
                  onClick={() => pinSet(activeTab, LIST_LABELS[activeTab] || activeTab, lists[activeTab] || [])}
                />
              ) : activeCustomSet ? (
                <StagePin
                  pressed={setPinned && pinnedSetId === activeCustomSet.id}
                  label={setPinned && pinnedSetId === activeCustomSet.id ? `Unpin ${activeCustomSet.name} from Stage` : `Pin ${activeCustomSet.name} to Stage`}
                  onClick={() => pinSet(activeCustomSet.id, activeCustomSet.name, activeCustomSet.games)}
                />
              ) : null}
              {currentListGames.length > 0 && (activeTab !== 'custom' || editing) && (
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
            </div>

            {activeCustomSet && (
              renamingId === activeCustomSet.id ? (
                <form
                  className="flex gap-2 mb-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    commitRename();
                  }}
                >
                  <input
                    type="text"
                    value={renameDraft}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm min-h-11"
                    aria-label="Set name"
                    autoFocus
                  />
                  <button type="submit" className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-bold min-h-11">
                    Save
                  </button>
                </form>
              ) : (
                <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-1">
                  <Folder className="w-5 h-5 mr-2 text-indigo-400 shrink-0" />
                  <span className="min-w-0 truncate">{activeCustomSet.name}</span>
                  {editing ? (
                    <button
                      type="button"
                      onClick={() => beginRename(activeCustomSet)}
                      className="min-w-11 min-h-11 flex items-center justify-center text-gray-500 hover:text-indigo-300"
                      aria-label={`Rename ${activeCustomSet.name}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                  ) : null}
                </h2>
              )
            )}

            {customEditing && activeCustomSet ? (
              <button
                type="button"
                onClick={() => setAddingGames(true)}
                className="w-full mb-4 min-h-11 px-3 rounded-xl border border-indigo-500/40 bg-indigo-600/20 text-indigo-200 text-sm font-bold inline-flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                Add games
              </button>
            ) : null}

            {customEditing && addingGames && activeCustomSet ? (
              <div className="fixed inset-0 z-[80] flex items-center justify-center p-3">
                <button
                  type="button"
                  className="absolute inset-0 bg-black/70"
                  aria-label="Close add games"
                  onClick={() => setAddingGames(false)}
                />
                <div
                  className="relative w-full h-[min(85dvh,100%)] max-h-[85dvh] min-h-0 overflow-hidden flex flex-col rounded-2xl border border-gray-700 bg-[#121212] px-4 pt-3 pb-3"
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="add-games-title"
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <p id="add-games-title" className="text-sm font-black font-display text-white leading-tight">
                        Add games
                      </p>
                      <p className="text-2xs text-gray-500 mt-0.5">
                        {currentListGames.length} in {activeCustomSet.name}. Tap a chip to add or remove.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAddingGames(false)}
                      className="min-h-11 px-3 rounded-xl bg-indigo-600 text-white text-xs font-bold shrink-0"
                    >
                      Done
                    </button>
                  </div>
                  <div className="overflow-y-auto overflow-x-hidden scrollbar-hide flex-1 min-h-0 pb-3">
                    <SetGamePicker key={activeCustomSet.id} setId={activeCustomSet.id} />
                  </div>
                </div>
              </div>
            ) : null}

            {customEditing && activeCustomSet ? (
              currentListGames.length ? (
                <DragOrderList
                  items={currentListGames.map((game) => ({
                    id: game.id,
                    label: game.name,
                    detail: game.category || '',
                  }))}
                  onOrder={(ids) => reorderCustomSetGames(activeCustomSet.id, ids)}
                  renderAfter={(item) => (
                    <button
                      type="button"
                      onClick={() => toggleInCustomSet(activeCustomSet.id, item.id)}
                      className="min-w-11 min-h-11 flex items-center justify-center text-gray-600 hover:text-red-400"
                      aria-label={`Remove ${item.label}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-gray-500 px-8 text-center mt-10">
                  <Folder className="w-16 h-16 mb-4 text-indigo-500/50" />
                  <p className="text-lg font-medium text-gray-300 mb-2">This list is empty</p>
                  <p className="text-sm">Tap Add games to pick from the Library.</p>
                </div>
              )
            ) : (
              <>
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
                    <p className="text-sm">
                      {activeTab === 'custom' ? 'Edit, then add games here.' : 'Head over to the Library to add games.'}
                    </p>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
