import { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, EyeOff, Moon, Sun, Tv } from 'lucide-react';
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
import { applyTheme, readStageTheme, writeStageTheme } from '../lib/theme.js';

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
    <div className="min-h-dvh w-full bg-stage text-gray-100 flex flex-col items-center justify-center px-6 py-10">
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

const TV_HIDE_CODE_KEY = 'improv-jam-tv-hide-code';

function readLocalHideCode() {
  try {
    return window.sessionStorage.getItem(TV_HIDE_CODE_KEY) === '1';
  } catch {
    return false;
  }
}

function writeLocalHideCode(hidden) {
  try {
    if (hidden) window.sessionStorage.setItem(TV_HIDE_CODE_KEY, '1');
    else window.sessionStorage.removeItem(TV_HIDE_CODE_KEY);
  } catch {
    /* private mode */
  }
}

function BoardStandby({ code, connecting, hardError, hideCode }) {
  const headline = connecting ? 'Connecting…' : hardError ? 'Couldn’t reach the board.' : 'Waiting.';
  return (
    <div className="h-full flex flex-col items-center justify-center text-center px-6">
      {hideCode ? null : (
        <p className="text-[clamp(2.5rem,14vmin,7rem)] font-black font-display tracking-[0.18em] leading-none mb-4">
          {code}
        </p>
      )}
      <p className="text-[clamp(1.5rem,6vmin,4rem)] font-black font-display text-gray-400">{headline}</p>
    </div>
  );
}

function sessionThemeFromPayload(payload) {
  const raw = payload?.theme;
  return raw === 'light' || raw === 'dark' ? raw : '';
}

function StageBoard({ code }) {
  const [payload, setPayload] = useState({});
  const [hardError, setHardError] = useState('');
  const [ready, setReady] = useState(false);
  const [localHide, setLocalHide] = useState(readLocalHideCode);
  const [localTheme, setLocalTheme] = useState('');
  const publishedTheme = sessionThemeFromPayload(payload);
  const publishedThemeRef = useRef(publishedTheme);
  const theme = localTheme || publishedTheme || readStageTheme();

  useEffect(() => {
    if (!publishedTheme) return;
    if (publishedThemeRef.current !== publishedTheme) {
      publishedThemeRef.current = publishedTheme;
      setLocalTheme('');
    }
  }, [publishedTheme]);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

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
  const publishedHide = payload.hideCode === true;
  const hideCode = publishedHide || localHide;

  const toggleLocalHide = () => {
    const next = !localHide;
    writeLocalHideCode(next);
    setLocalHide(next);
  };

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    writeStageTheme(next);
    setLocalTheme(next);
  };

  const light = theme === 'light';

  return (
    <div className="stage-board h-dvh w-full bg-stage text-gray-100 flex flex-col overflow-hidden">
      <header className="shrink-0 flex items-center justify-between gap-3 px-4 md:px-8 py-1.5 border-b border-white/10">
        <p className="text-xs uppercase tracking-[0.3em] text-gray-500 font-bold">Improv Jam</p>
        <div className="flex items-center gap-1 min-w-0">
          {hideCode ? null : (
            <p className="text-base md:text-xl font-black font-display tracking-[0.22em] text-gray-200 truncate">
              {code}
            </p>
          )}
          <button
            type="button"
            onClick={toggleTheme}
            className="w-8 h-8 rounded-md inline-flex items-center justify-center text-gray-400 hover:text-gray-100"
            aria-label={light ? 'Dark mode' : 'Light mode'}
            aria-pressed={light}
          >
            {light ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
          </button>
          {publishedHide ? null : (
            <button
              type="button"
              onClick={toggleLocalHide}
              className="min-h-11 px-3 rounded-lg text-xs font-bold text-gray-300 hover:text-white inline-flex items-center gap-1.5"
              aria-pressed={localHide}
            >
              {localHide ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              {localHide ? 'Show' : 'Hide'}
            </button>
          )}
        </div>
      </header>

      <div className="flex-1 min-h-0">
        {hasBoard ? (
          <StageSlotGrid
            slots={slots}
            layout={payload.layout}
            boardStyle={payload.boardStyle}
            frames={payload.frames}
            floats={Array.isArray(payload.floats) ? payload.floats : undefined}
            spotlight={payload.spotlight}
          />
        ) : (
          <BoardStandby
            code={code}
            connecting={!ready && !hardError}
            hardError={Boolean(hardError && !ready)}
            hideCode={hideCode}
          />
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
    applyTheme(readStageTheme());
    document.documentElement.classList.remove('reduce-motion');
  }, []);

  if (!code) return <JoinForm />;
  return <StageBoard code={code} />;
}
