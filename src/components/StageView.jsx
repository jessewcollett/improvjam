import { useEffect, useMemo, useState } from 'react';
import { Tv } from 'lucide-react';
import { StageSlotGrid } from './StageBoardContent.jsx';
import {
  fetchStage,
  isTransientStageError,
  listedStageSlots,
  normalizeStageCode,
  payloadHasSlots,
  STAGE_BOARD_POLL_MS,
  stageBoardPath,
} from '../lib/stage.js';
import { applyTheme } from '../lib/theme.js';

function JoinForm() {
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');

  const onSubmit = (event) => {
    event.preventDefault();
    const code = normalizeStageCode(draft);
    if (!code) {
      setError('Use the 4–5 character code from the phone (no 0, O, 1, or I).');
      return;
    }
    window.location.assign(stageBoardPath(code));
  };

  return (
    <div className="min-h-dvh w-full bg-black text-white flex flex-col items-center justify-center px-6 py-10">
      <Tv className="w-12 h-12 text-lime-400 mb-4" />
      <h1 className="text-4xl font-black font-display tracking-tight mb-2">Stage</h1>
      <p className="text-lg text-gray-400 text-center max-w-md mb-8">
        Enter the session code from the phone, then pin panels to fill this board.
      </p>
      <form onSubmit={onSubmit} className="w-full max-w-md flex flex-col gap-3">
        <label className="text-xs uppercase tracking-[0.2em] text-gray-500 font-bold" htmlFor="stage-code">
          Session code
        </label>
        <input
          id="stage-code"
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value.toUpperCase());
            setError('');
          }}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          maxLength={5}
          placeholder="AB3K"
          className="w-full min-h-14 rounded-2xl bg-[#141414] border border-gray-700 px-4 text-3xl font-black font-display tracking-[0.28em] text-center text-white"
        />
        {error ? <p className="text-sm text-amber-300">{error}</p> : null}
        <button type="submit" className="min-h-12 rounded-2xl bg-lime-600 text-black font-black text-lg">
          Open board
        </button>
      </form>
    </div>
  );
}

function BoardStandby({ code, connecting, hardError }) {
  const headline = connecting ? 'Connecting…' : hardError ? 'Couldn’t reach the board.' : 'Waiting.';
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-6">
      <p className="text-[clamp(2.5rem,14vmin,7rem)] font-black font-display tracking-[0.18em] leading-none mb-4">
        {code}
      </p>
      <p className="text-[clamp(1.5rem,6vmin,4rem)] font-black font-display text-gray-400">{headline}</p>
      {!connecting && !hardError ? (
        <p className="text-sm md:text-lg text-gray-500 mt-3 max-w-lg">
          Pin a panel on the phone. This board fills the screen with whatever is pinned.
        </p>
      ) : null}
    </div>
  );
}

function StageBoard({ code }) {
  const [payload, setPayload] = useState({});
  const [hardError, setHardError] = useState('');
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let interval = null;
    let inflight = false;

    const tick = async () => {
      if (cancelled || document.hidden || inflight) return;
      inflight = true;
      try {
        const data = await fetchStage(code);
        if (cancelled) return;
        const next = data.payload && typeof data.payload === 'object' ? data.payload : {};
        setPayload((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
        setHardError('');
        setReady(true);
      } catch (err) {
        if (cancelled) return;
        if (isTransientStageError(err)) {
          setHardError('');
          return;
        }
        setHardError('unreachable');
      } finally {
        inflight = false;
      }
    };

    const start = () => {
      if (interval) return;
      tick();
      interval = window.setInterval(tick, STAGE_BOARD_POLL_MS);
    };

    const stop = () => {
      if (!interval) return;
      window.clearInterval(interval);
      interval = null;
    };

    const onVis = () => {
      if (document.hidden) stop();
      else start();
    };

    if (!document.hidden) start();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      stop();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [code]);

  const slots = listedStageSlots(payload);
  const hasBoard = payloadHasSlots(payload);

  return (
    <div className="h-dvh w-full bg-black text-white flex flex-col overflow-hidden">
      <header className="shrink-0 flex items-baseline justify-between gap-4 px-4 md:px-8 py-3 border-b border-white/10">
        <p className="text-xs uppercase tracking-[0.3em] text-gray-500 font-bold">Improv Jam</p>
        <p className="text-lg md:text-2xl font-black font-display tracking-[0.22em] text-gray-200">{code}</p>
      </header>

      <div className="flex-1 min-h-0">
        {hasBoard ? (
          <StageSlotGrid slots={slots} layout={payload.layout} boardStyle={payload.boardStyle} frames={payload.frames} />
        ) : (
          <BoardStandby code={code} connecting={!ready && !hardError} hardError={Boolean(hardError && !ready)} />
        )}
      </div>
    </div>
  );
}

export default function StageView() {
  const code = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return normalizeStageCode(params.get('s') || params.get('stage') || '');
  }, []);

  useEffect(() => {
    applyTheme('dark');
    document.documentElement.classList.remove('reduce-motion');
  }, []);

  if (!code) return <JoinForm />;
  return <StageBoard code={code} />;
}
