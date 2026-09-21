import { useState } from 'react';
import { AlertTriangle, Check, Flag, Trash2 } from 'lucide-react';
import { ASK_FOR_CATEGORIES } from '../lib/generator.js';
import { ideaIsNsfw } from '../lib/ideaFlag.js';
import { ideaText, normalizeStageIdeasMap } from '../lib/stage.js';
import { useAppStore } from '../store/useAppStore.js';

function catLabel(id) {
  return ASK_FOR_CATEGORIES.find((cat) => cat.id === id)?.label || id;
}

function sortRows(rows) {
  return [...rows].sort((a, b) => {
    const left = ideaIsNsfw(a.entry || a);
    const right = ideaIsNsfw(b.entry || b);
    return Number(right) - Number(left);
  });
}

function iconBtn(className) {
  return `min-w-11 min-h-11 rounded-lg inline-flex items-center justify-center ${className}`;
}

function IdeaRow({ entry, pending, cat }) {
  const text = ideaText(entry);
  const flagged = ideaIsNsfw(entry);
  const storedFlag = typeof entry === 'object' && entry?.flag === 'nsfw';
  const approveStageIdea = useAppStore((s) => s.approveStageIdea);
  const deleteStageIdea = useAppStore((s) => s.deleteStageIdea);
  const flagStageIdea = useAppStore((s) => s.flagStageIdea);

  return (
    <li
      className={`rounded-xl border px-2 py-1.5 flex items-center gap-1 ${
        flagged ? 'border-amber-600 bg-amber-950/40' : 'border-gray-800 bg-[#1A1A1A]'
      }`}
    >
      <div className="flex-1 min-w-0 py-1">
        <p className="text-sm text-gray-100 break-words leading-snug">{text}</p>
        <p className="text-2xs uppercase tracking-wider text-gray-500 font-bold mt-0.5">
          {catLabel(cat)}
          {flagged ? ' · NSFW' : ''}
        </p>
      </div>
      {flagged ? (
        <span className="shrink-0 text-amber-300" title="NSFW">
          <AlertTriangle className="w-4 h-4" />
        </span>
      ) : null}
      {pending ? (
        <button
          type="button"
          onClick={() => approveStageIdea(cat, text)}
          className={iconBtn('bg-lime-700 text-white')}
          aria-label={`Approve ${text}`}
        >
          <Check className="w-4 h-4" />
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => flagStageIdea(cat, text, pending)}
        className={iconBtn(
          flagged ? 'border border-amber-600 text-amber-200 bg-amber-950/60' : 'border border-gray-700 text-gray-300 bg-gray-800',
        )}
        aria-label={storedFlag ? `Unflag ${text}` : `Flag ${text}`}
      >
        <Flag className="w-4 h-4" />
      </button>
      <button
        type="button"
        onClick={() => deleteStageIdea(cat, text, pending)}
        className={iconBtn('border border-red-900/60 bg-red-950/40 text-red-300')}
        aria-label={`Delete ${text}`}
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </li>
  );
}

function BulkBar({ pending, rows, flaggedCount }) {
  const approveAllStageIdeas = useAppStore((s) => s.approveAllStageIdeas);
  const deleteAllStageIdeas = useAppStore((s) => s.deleteAllStageIdeas);
  const [confirm, setConfirm] = useState('');
  const cleanCount = rows.length - flaggedCount;

  if (!rows.length) return null;

  const ask = (id) => {
    if (confirm === id) setConfirm('');
    else setConfirm(id);
  };

  return (
    <div className="mb-2">
      <div className="flex flex-wrap gap-1.5">
        {pending && cleanCount > 0 ? (
          <button
            type="button"
            onClick={() => {
              approveAllStageIdeas('clean');
              setConfirm('');
            }}
            className="min-h-10 px-2.5 rounded-lg bg-lime-700 text-white text-xs font-bold"
          >
            Approve clean{cleanCount ? ` (${cleanCount})` : ''}
          </button>
        ) : null}
        {pending && flaggedCount > 0 && flaggedCount < rows.length ? (
          <button
            type="button"
            onClick={() => {
              approveAllStageIdeas('all');
              setConfirm('');
            }}
            className="min-h-10 px-2.5 rounded-lg border border-gray-700 bg-gray-800 text-gray-100 text-xs font-bold"
          >
            Approve all ({rows.length})
          </button>
        ) : null}
        {flaggedCount > 0 ? (
          <button
            type="button"
            onClick={() => {
              deleteAllStageIdeas({ fromPending: pending, flaggedOnly: true });
              setConfirm('');
            }}
            className="min-h-10 px-2.5 rounded-lg border border-amber-700 bg-amber-950/50 text-amber-200 text-xs font-bold"
          >
            Drop flagged ({flaggedCount})
          </button>
        ) : null}
        {confirm === 'clear' ? (
          <>
            <span className="self-center text-xs text-red-300 font-bold">Clear {pending ? 'pending' : 'live'}?</span>
            <button
              type="button"
              onClick={() => {
                deleteAllStageIdeas({ fromPending: pending, flaggedOnly: false });
                setConfirm('');
              }}
              className="min-h-10 px-2.5 rounded-lg bg-red-700 text-white text-xs font-bold"
            >
              Yes
            </button>
            <button
              type="button"
              onClick={() => setConfirm('')}
              className="min-h-10 px-2.5 rounded-lg border border-gray-700 bg-gray-800 text-gray-200 text-xs font-bold"
            >
              No
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => ask('clear')}
            className="min-h-10 px-2.5 rounded-lg border border-red-900/60 bg-red-950/40 text-red-300 text-xs font-bold"
          >
            Clear
          </button>
        )}
      </div>
    </div>
  );
}

export default function IdeaQueue({ compact = false }) {
  const ideasHold = useAppStore((s) => s.stageIdeasHold);
  const pendingMap = normalizeStageIdeasMap(useAppStore((s) => s.stageIdeasPending));
  const liveMap = normalizeStageIdeasMap(useAppStore((s) => s.stageIdeas));
  const [filter, setFilter] = useState('all');

  const pending = sortRows(
    Object.entries(pendingMap).flatMap(([cat, rows]) => rows.map((entry) => ({ cat, entry }))),
  ).map(({ cat, entry }) => ({ cat, entry, key: `p:${cat}:${ideaText(entry)}` }));
  const live = sortRows(
    Object.entries(liveMap).flatMap(([cat, rows]) => rows.map((entry) => ({ cat, entry }))),
  ).map(({ cat, entry }) => ({ cat, entry, key: `l:${cat}:${ideaText(entry)}` }));

  const visiblePending = filter === 'flagged' ? pending.filter((row) => ideaIsNsfw(row.entry)) : pending;
  const visibleLive = filter === 'flagged' ? live.filter((row) => ideaIsNsfw(row.entry)) : live;
  const flaggedPending = pending.filter((row) => ideaIsNsfw(row.entry)).length;
  const flaggedLive = live.filter((row) => ideaIsNsfw(row.entry)).length;
  const flaggedTotal = flaggedPending + flaggedLive;

  if (!pending.length && !live.length) {
    if (compact && !ideasHold) return null;
    return (
      <p className="text-xs text-gray-500">
        {ideasHold ? 'New submissions wait here until you approve them.' : 'No audience ideas yet.'}
      </p>
    );
  }

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {flaggedTotal ? (
        <div className="flex bg-[#1A1A1A] p-1 rounded-xl border border-gray-800">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`flex-1 min-h-10 rounded-lg text-xs font-bold ${
              filter === 'all' ? 'bg-gray-700 text-white' : 'text-gray-400'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setFilter('flagged')}
            className={`flex-1 min-h-10 rounded-lg text-xs font-bold ${
              filter === 'flagged' ? 'bg-amber-800 text-white' : 'text-gray-400'
            }`}
          >
            Flagged ({flaggedTotal})
          </button>
        </div>
      ) : null}
      {ideasHold || pending.length ? (
        <section>
          <p className="text-2xs uppercase tracking-wider text-amber-400 font-bold mb-1">
            Pending{pending.length ? ` (${pending.length})` : ''}
          </p>
          {pending.length ? (
            <>
              <BulkBar pending rows={pending} flaggedCount={flaggedPending} />
              {visiblePending.length ? (
                <ul className="space-y-1.5 max-h-[40vh] overflow-y-auto scrollbar-hide">
                  {visiblePending.map((row) => (
                    <IdeaRow key={row.key} entry={row.entry} cat={row.cat} pending />
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-gray-500">Nothing flagged in pending.</p>
              )}
            </>
          ) : (
            <p className="text-xs text-gray-500">Nothing waiting.</p>
          )}
        </section>
      ) : null}
      <section>
        <p className="text-2xs uppercase tracking-wider text-lime-400 font-bold mb-1">
          Live{live.length ? ` (${live.length})` : ''}
        </p>
        {live.length ? (
          <>
            <BulkBar pending={false} rows={live} flaggedCount={flaggedLive} />
            {visibleLive.length ? (
              <ul className="space-y-1.5 max-h-[40vh] overflow-y-auto scrollbar-hide">
                {visibleLive.map((row) => (
                  <IdeaRow key={row.key} entry={row.entry} cat={row.cat} pending={false} />
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-500">Nothing flagged on Stage.</p>
            )}
          </>
        ) : (
          <p className="text-xs text-gray-500">Nothing on Stage yet.</p>
        )}
      </section>
    </div>
  );
}
