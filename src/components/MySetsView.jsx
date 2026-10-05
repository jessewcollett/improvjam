import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
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
  Type,
  X,
  Play,
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';
import { useAppStore, gamesInIds } from '../store/useAppStore.js';
import { copyText, DEFAULT_STAGE_MESSAGES } from '../lib/stage.js';
import { createSharedSetLink, resolveSharedSet } from '../lib/setShare.js';
import {
  labelForSetItem,
  messageItemLabel,
  normalizeSetItems,
  setCountLabel,
  setItemKey,
} from '../lib/setItems.js';
import { MESSAGE_MAX, sanitizeStageMessageHtml, stageMessageHtml, stageMessageText } from '../lib/stageMessage.js';
import GameCard from './GameCard.jsx';
import TermCard from './TermCard.jsx';
import StagePin from './StagePin.jsx';
import SyncButton from './SyncButton.jsx';
import DragOrderList from './DragOrderList.jsx';
import SetGamePicker from './SetGamePicker.jsx';
import SetTermPicker from './SetTermPicker.jsx';
import StageMessageEditor from './StageMessageEditor.jsx';

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

function setSlotFromSet(set, games, terms) {
  return {
    id: set.id,
    name: set.name,
    games: normalizeSetItems(set).map((item) => labelForSetItem(item, { games, terms })),
  };
}

function CenteredSheet({ title, subtitle, onClose, children }) {
  const titleId = `${String(title || 'sheet').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-title`;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-3">
      <button
        type="button"
        className="absolute inset-0 bg-black/70"
        aria-label={`Close ${title}`}
        onClick={onClose}
      />
      <div
        className="relative w-full h-[min(85dvh,100%)] max-h-[85dvh] min-h-0 overflow-hidden flex flex-col rounded-2xl border border-gray-700 bg-[#121212] px-4 pt-3 pb-3"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <p id={titleId} className="text-sm font-black font-display text-white leading-tight">
              {title}
            </p>
            {subtitle ? <p className="text-2xs text-gray-500 mt-0.5">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 px-3 rounded-xl bg-indigo-600 text-white text-xs font-bold shrink-0"
          >
            Done
          </button>
        </div>
        <div className="overflow-y-auto overflow-x-hidden scrollbar-hide flex-1 min-h-0 pb-3">
          {children}
        </div>
      </div>
    </div>
  );
}

function MessageSlideCard({ item, onEdit }) {
  const text = stageMessageText(item.message);
  return (
    <div className="bg-card border border-gray-800 rounded-xl px-3 py-2.5">
      <div className="flex items-center gap-2 mb-1">
        <Type className="w-4 h-4 text-amber-400 shrink-0" />
        <p className="flex-1 min-w-0 text-sm font-bold text-gray-100 truncate">{messageItemLabel(item.message)}</p>
        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className="min-w-11 min-h-11 flex items-center justify-center text-gray-500 hover:text-amber-300"
            aria-label={`Edit ${messageItemLabel(item.message)}`}
          >
            <Pencil className="w-4 h-4" />
          </button>
        ) : null}
      </div>
      <div
        className="stage-message text-xs text-gray-400 line-clamp-4"
        dangerouslySetInnerHTML={{ __html: sanitizeStageMessageHtml(stageMessageHtml(item.message), text) }}
      />
    </div>
  );
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
  const reorderCustomSetItems = useAppStore((s) => s.reorderCustomSetItems);
  const removeSetItem = useAppStore((s) => s.removeSetItem);
  const addSetMessage = useAppStore((s) => s.addSetMessage);
  const updateSetMessage = useAppStore((s) => s.updateSetMessage);
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
  const messageFavorites = useAppStore((s) => s.stageMessageFavorites) || [];
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
  const [sheet, setSheet] = useState('');
  const [linkingGameId, setLinkingGameId] = useState('');
  const [messageDraft, setMessageDraft] = useState('');
  const [editingMessageId, setEditingMessageId] = useState('');
  const [shareNote, setShareNote] = useState('');

  const closeSheets = () => {
    setSheet('');
    setLinkingGameId('');
    setMessageDraft('');
    setEditingMessageId('');
  };

  const openMessageEditor = (item) => {
    if (!item || item.type !== 'message') return;
    setEditingMessageId(item.id);
    setMessageDraft(item.message || '');
    setSheet('message');
  };

  useEffect(() => {
    setConfirmClear(false);
    setIsCreatingSet(false);
    setIsImporting(false);
    setImportDraft('');
    setConfirmDeleteSet(null);
    setRenamingId(null);
    setRenameDraft('');
    setEditing(false);
    closeSheets();
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
    setStageSlot('set', setSlotFromSet(match, data.games, data.terms));
  }, [data.games, data.terms, lists, pinnedSetId, setPinned, setStageSlot, toggleStagePin]);

  const pinSet = (id, name, ids, customSet) => {
    const already = setPinned && pinnedSetId === id;
    if (already) {
      toggleStagePin('set');
      return;
    }
    setStageSlot(
      'set',
      customSet ? setSlotFromSet(customSet, data.games, data.terms) : setSlotFromIds(id, name, ids, data.games),
    );
    if (!setPinned) toggleStagePin('set');
  };

  const activeCustomSet = lists.customSets.find((s) => s.id === activeCustomSetId);
  const customItems = useMemo(() => normalizeSetItems(activeCustomSet), [activeCustomSet]);
  const currentListGames =
    activeTab !== 'custom'
      ? gamesInIds(data.games, lists[activeTab] || [])
      : gamesInIds(data.games, activeCustomSet?.games || []);
  const customEditing = activeTab === 'custom' && editing;
  const canPlay = customItems.length > 0;
  const linkingGame = currentListGames.find((game) => game.id === linkingGameId);
  const savedFavorites = messageFavorites.filter(
    (item) => !DEFAULT_STAGE_MESSAGES.some((entry) => entry.toLowerCase() === stageMessageText(item).toLowerCase()),
  );

  const shareActiveSet = async () => {
    if (!customItems.length) return;
    const url = await createSharedSetLink({
      name: activeCustomSet.name,
      ids: activeCustomSet.games,
      items: customItems,
    });
    if (!url) return;
    try {
      if (navigator.share) {
        await navigator.share({ url });
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

  const commitMessageSlide = () => {
    if (!activeCustomSet) return;
    if (!stageMessageText(messageDraft)) return;
    if (editingMessageId) updateSetMessage(activeCustomSet.id, editingMessageId, messageDraft);
    else addSetMessage(activeCustomSet.id, messageDraft);
    closeSheets();
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
                  placeholder="Paste share link or code"
                  className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm min-w-0"
                  autoComplete="off"
                  autoCapitalize="off"
                />
                <button
                  type="button"
                  onClick={async () => {
                    const decoded = await resolveSharedSet(importDraft);
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
                  detail: showStats ? setCountLabel(set) : '',
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
                        {showStats ? <p className="text-xs text-gray-500">{setCountLabel(set)}</p> : null}
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
                    closeSheets();
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
                    closeSheets();
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
              {activeTab === 'custom' && canPlay ? (
                <button
                  type="button"
                  onClick={() => startStagePlay(activeCustomSet.id)}
                  className="min-h-10 px-3 rounded-lg border border-lime-700 bg-lime-700 text-white text-xs font-bold inline-flex items-center gap-1"
                >
                  <Play className="w-3.5 h-3.5" />
                  Play
                </button>
              ) : null}
              {activeTab === 'custom' && canPlay ? (
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
                  onClick={() => pinSet(activeCustomSet.id, activeCustomSet.name, activeCustomSet.games, activeCustomSet)}
                />
              ) : null}
              {(activeTab === 'custom' ? customItems.length : currentListGames.length) > 0 && (activeTab !== 'custom' || editing) && (
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
              <div className="grid grid-cols-3 gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setSheet('games')}
                  className="min-h-11 px-2 rounded-xl border border-indigo-500/40 bg-indigo-600/20 text-indigo-200 text-xs font-bold inline-flex items-center justify-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Games
                </button>
                <button
                  type="button"
                  onClick={() => setSheet('terms')}
                  className="min-h-11 px-2 rounded-xl border border-purple-500/40 bg-purple-600/20 text-purple-200 text-xs font-bold inline-flex items-center justify-center gap-1"
                >
                  <BookOpen className="w-4 h-4" />
                  Terms
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingMessageId('');
                    setMessageDraft('');
                    setSheet('message');
                  }}
                  className="min-h-11 px-2 rounded-xl border border-amber-500/40 bg-amber-600/20 text-amber-200 text-xs font-bold inline-flex items-center justify-center gap-1"
                >
                  <Type className="w-4 h-4" />
                  Message
                </button>
              </div>
            ) : null}

            {customEditing && sheet === 'games' && activeCustomSet ? (
              <CenteredSheet
                title="Add games"
                subtitle={`${currentListGames.length} in ${activeCustomSet.name}. Tap a chip to add or remove.`}
                onClose={closeSheets}
              >
                <SetGamePicker key={activeCustomSet.id} setId={activeCustomSet.id} />
              </CenteredSheet>
            ) : null}

            {customEditing && sheet === 'terms' && activeCustomSet ? (
              <CenteredSheet
                title="Add terms"
                subtitle="Tap a glossary chip to add or remove a slide."
                onClose={closeSheets}
              >
                <SetTermPicker key={`${activeCustomSet.id}-terms`} setId={activeCustomSet.id} />
              </CenteredSheet>
            ) : null}

            {customEditing && linkingGame && activeCustomSet ? (
              <CenteredSheet
                title="Link terms"
                subtitle={`Glossary notes for ${linkingGame.name}. Not extra slides.`}
                onClose={closeSheets}
              >
                <SetTermPicker
                  key={`${activeCustomSet.id}-${linkingGame.id}`}
                  setId={activeCustomSet.id}
                  gameId={linkingGame.id}
                />
              </CenteredSheet>
            ) : null}

            {sheet === 'message' && activeCustomSet ? (
              <CenteredSheet
                title={editingMessageId ? 'Edit board message' : 'Add board message'}
                subtitle={editingMessageId ? 'Updates this slide in the rundown.' : 'This becomes a slide in the rundown.'}
                onClose={closeSheets}
              >
                <StageMessageEditor value={messageDraft} onChange={setMessageDraft} />
                <p className="text-2xs text-gray-500 mt-1 mb-2 tabular-nums">
                  {stageMessageText(messageDraft).length} / {MESSAGE_MAX}
                </p>
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {DEFAULT_STAGE_MESSAGES.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setMessageDraft(item)}
                      className="min-h-10 px-2.5 rounded-lg text-xs font-bold border bg-[#1A1A1A] text-gray-200 border-gray-800"
                    >
                      {item}
                    </button>
                  ))}
                  {savedFavorites.map((item) => {
                    const itemText = stageMessageText(item);
                    const line = itemText.split('\n').map((part) => part.trim()).find(Boolean) || itemText;
                    const label = line.length > 36 ? `${line.slice(0, 34)}…` : line;
                    return (
                      <button
                        key={itemText}
                        type="button"
                        title={itemText}
                        onClick={() => setMessageDraft(item)}
                        className="min-h-10 px-2.5 rounded-lg text-xs font-bold border bg-[#1A1A1A] text-gray-200 border-gray-800 max-w-full truncate"
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={commitMessageSlide}
                  disabled={!stageMessageText(messageDraft)}
                  className="w-full min-h-11 rounded-xl bg-amber-700 text-white text-sm font-bold disabled:bg-gray-800 disabled:text-gray-500"
                >
                  {editingMessageId ? 'Save message' : 'Add to set'}
                </button>
              </CenteredSheet>
            ) : null}

            {customEditing && activeCustomSet ? (
              customItems.length ? (
                <DragOrderList
                  items={customItems.map((item) => {
                      const linked = item.type === 'game' && item.terms?.length
                      ? `${item.terms.length} term${item.terms.length === 1 ? '' : 's'} linked`
                      : '';
                    const badge = item.type === 'term' ? 'Term' : item.type === 'message' ? 'Msg' : 'Game';
                    const badgeClass = item.type === 'term'
                      ? 'bg-purple-900/40 text-purple-300 border-purple-800/60'
                      : item.type === 'message'
                        ? 'bg-amber-900/40 text-amber-300 border-amber-800/60'
                        : 'bg-lime-900/40 text-lime-300 border-lime-800/60';
                    return {
                      id: setItemKey(item),
                      label: labelForSetItem(item, { games: data.games, terms: data.terms }),
                      detail: [item.type === 'game' ? (data.games.find((game) => game.id === item.id)?.category || '') : '', linked].filter(Boolean).join(' · '),
                      badge,
                      badgeClass,
                      itemType: item.type,
                      gameId: item.type === 'game' ? item.id : '',
                      messageId: item.type === 'message' ? item.id : '',
                    };
                  })}
                  onOrder={(ids) => reorderCustomSetItems(activeCustomSet.id, ids)}
                  onActivate={(row) => {
                    if (row.itemType !== 'message' || !row.messageId) return;
                    const item = customItems.find((entry) => entry.type === 'message' && entry.id === row.messageId);
                    openMessageEditor(item);
                  }}
                  renderAfter={(row) => (
                    <>
                      {row.itemType === 'message' ? (
                        <button
                          type="button"
                          onClick={() => {
                            const item = customItems.find((entry) => entry.type === 'message' && entry.id === row.messageId);
                            openMessageEditor(item);
                          }}
                          className="min-w-11 min-h-11 flex items-center justify-center text-gray-500 hover:text-amber-300"
                          aria-label={`Edit ${row.label}`}
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                      ) : null}
                      {row.itemType === 'game' ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSheet('');
                            setLinkingGameId(row.gameId);
                          }}
                          className="min-w-11 min-h-11 flex items-center justify-center text-gray-500 hover:text-purple-300"
                          aria-label={`Link terms to ${row.label}`}
                        >
                          <BookOpen className="w-4 h-4" />
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          if (row.itemType === 'game') toggleInCustomSet(activeCustomSet.id, row.gameId);
                          else removeSetItem(activeCustomSet.id, row.id);
                        }}
                        className="min-w-11 min-h-11 flex items-center justify-center text-gray-600 hover:text-red-400"
                        aria-label={`Remove ${row.label}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-gray-500 px-8 text-center mt-10">
                  <Folder className="w-16 h-16 mb-4 text-indigo-500/50" />
                  <p className="text-lg font-medium text-gray-300 mb-2">This list is empty</p>
                  <p className="text-sm">Add games, glossary slides, or board messages.</p>
                </div>
              )
            ) : (
              <>
                {activeTab === 'custom' && activeCustomSet ? (
                  customItems.length ? (
                    <div className="space-y-2">
                      {customItems.map((item) => {
                        const key = setItemKey(item);
                        if (item.type === 'game') {
                          const game = data.games.find((entry) => entry.id === item.id);
                          return game ? <GameCard key={key} game={game} /> : null;
                        }
                        if (item.type === 'term') {
                          const term = data.terms.find((entry) => entry.id === item.id);
                          return term ? <TermCard key={key} termData={term} /> : null;
                        }
                        return <MessageSlideCard key={key} item={item} onEdit={() => openMessageEditor(item)} />;
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center text-gray-500 px-8 text-center mt-10">
                      <Folder className="w-16 h-16 mb-4 text-indigo-500/50" />
                      <p className="text-lg font-medium text-gray-300 mb-2">This list is empty</p>
                      <p className="text-sm">Edit, then add games, terms, or board messages.</p>
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
                        <p className="text-lg font-medium text-gray-300 mb-2">This list is empty</p>
                        <p className="text-sm">Head over to the Library to add games.</p>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
