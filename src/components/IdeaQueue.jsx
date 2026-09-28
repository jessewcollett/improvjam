import { useState } from 'react';
import { Check, Flag, Trash2 } from 'lucide-react';
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

function pillBtn(active, tone) {
  const base = 'min-w-8 min-h-8 inline-flex items-center justify-center';
  if (tone === 'ok') return `${base} ${active ? 'bg-lime-700 text-white' : 'text-lime-300 hover:bg-lime-800/80'}`;
  if (tone === 'warn') return `${base} ${active ? 'bg-amber-700 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-amber-200'}`;
  return `${base} ${active ? 'bg-red-800 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-red-300'}`;
}

function IdeaRow({ entry, pending, cat }) {
  const text = ideaText(entry);
  const flagged = ideaIsNsfw(entry);
  const storedFlag = typeof entry === 'object' && entry?.flag === 'nsfw';
  const approveStageIdea = useAppStore((s) => s.approveStageIdea);
  const deleteStageIdea = useAppStore((s) => s.deleteStageIdea);
  const flagStageIdea = useAppStore((s) => s.flagStageIdea);

  return (
    <li className={flagged ? 'bg-amber-950/45' : 'bg-[#1A1A1A]'}>
      <div className="flex items-center gap-2 min-w-0 w-full pl-2.5 pr-1 py-0.5">
        <p className="min-w-0 flex-1 truncate text-sm text-gray-100 leading-tight">
          {text}
          <span className="ml-1.5 text-2xs uppercase tracking-wider text-gray-500 font-bold">
            {catLabel(cat)}
            {flagged ? ' · NSFW' : ''}
          </span>
        </p>
        <div className="shrink-0 inline-flex rounded-full overflow-hidden border border-gray-700 bg-[#141414] divide-x divide-gray-700">
        {pending ? (
          <button
            type="button"
            onClick={() => approveStageIdea(cat, text)}
            className={pillBtn(false, 'ok')}
            aria-label={`Approve ${text}`}
          >
            <Check className="w-3.5 h-3.5" />
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => flagStageIdea(cat, text, pending)}
          className={pillBtn(flagged, 'warn')}
          aria-label={storedFlag ? `Unflag ${text}` : `Flag ${text}`}
        >
          <Flag className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => deleteStageIdea(cat, text, pending)}
          className={pillBtn(false, 'bad')}
          aria-label={`Delete ${text}`}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
        </div>
      </div>
    </li>
  );
}

function bulkClass(tone) {
  const base = 'min-h-8 px-2.5 rounded-full text-2xs font-bold inline-flex items-center';
  if (tone === 'ok') return `${base} bg-lime-700 text-white`;
  if (tone === 'warn') return `${base} border border-amber-700 bg-amber-950/50 text-amber-200`;
  if (tone === 'bad') return `${base} border border-red-900/60 bg-red-950/40 text-red-300`;
  return `${base} border border-gray-700 bg-gray-800 text-gray-100`;
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
    <div className="mb-1.5 flex flex-wrap gap-1">
      {pending && cleanCount > 0 ? (
        <button
          type="button"
          onClick={() => {
            approveAllStageIdeas('clean');
            setConfirm('');
          }}
          className={bulkClass('ok')}
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
          className={bulkClass()}
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
          className={bulkClass('warn')}
        >
          Drop flagged ({flaggedCount})
        </button>
      ) : null}
      {confirm === 'clear' ? (
        <>
          <span className="self-center text-2xs text-red-300 font-bold">Clear {pending ? 'pending' : 'live'}?</span>
          <button
            type="button"
            onClick={() => {
              deleteAllStageIdeas({ fromPending: pending, flaggedOnly: false });
              setConfirm('');
            }}
            className={bulkClass('bad')}
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => setConfirm('')}
            className={bulkClass()}
          >
            No
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => ask('clear')}
          className={bulkClass('bad')}
        >
          Clear
        </button>
      )}
    </div>
  );
}

function IdeaList({ rows, pending }) {
  if (!rows.length) return null;
  return (
    <ul className="rounded-xl border border-gray-800 divide-y divide-gray-800 overflow-y-auto scrollbar-hide max-h-[40vh]">
      {rows.map((row) => (
        <IdeaRow key={row.key} entry={row.entry} cat={row.cat} pending={pending} />
      ))}
    </ul>
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
    <div className={compact ? 'space-y-2.5' : 'space-y-3'}>
      {flaggedTotal ? (
        <div className="flex bg-[#1A1A1A] p-0.5 rounded-full border border-gray-800">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`flex-1 min-h-8 rounded-full text-2xs font-bold ${
              filter === 'all' ? 'bg-gray-700 text-white' : 'text-gray-400'
            }`}
          >
            All
          </button>
          <button
            type="button"
            onClick={() => setFilter('flagged')}
            className={`flex-1 min-h-8 rounded-full text-2xs font-bold ${
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
                <IdeaList rows={visiblePending} pending />
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
              <IdeaList rows={visibleLive} pending={false} />
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
