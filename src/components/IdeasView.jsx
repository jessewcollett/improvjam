import { useEffect, useMemo, useState } from 'react';
import { Lightbulb } from 'lucide-react';
import { ASK_FOR_CATEGORIES } from '../lib/generator.js';
import {
  coalesceStageSession,
  fetchStage,
  normalizeStageCode,
  postStage,
  sanitizeStageCodeInput,
  stageIdeasPath,
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
    window.location.assign(stageIdeasPath(code));
  };

  return (
    <div className="min-h-dvh w-full bg-black text-white flex flex-col items-center justify-center px-6 py-10">
      <Lightbulb className="w-12 h-12 text-lime-400 mb-4" />
      <h1 className="text-4xl font-black font-display tracking-tight mb-2">Ideas</h1>
      <p className="text-lg text-gray-400 text-center max-w-md mb-8">
        Enter the session code from the host, then submit suggestions for this jam.
      </p>
      <form onSubmit={onSubmit} className="w-full max-w-md flex flex-col gap-3">
        <label className="text-xs uppercase tracking-[0.2em] text-gray-500 font-bold" htmlFor="ideas-code">
          Session code
        </label>
        <input
          id="ideas-code"
          value={draft}
          onChange={(e) => {
            setDraft(sanitizeStageCodeInput(e.target.value));
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
          Join
        </button>
      </form>
    </div>
  );
}

function IdeasForm({ code }) {
  const [session, setSession] = useState(null);
  const [values, setValues] = useState({});
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let seq = 0;
    const load = async () => {
      const my = ++seq;
      try {
        const data = await fetchStage(code);
        if (cancelled || my !== seq) return;
        setSession((prev) => coalesceStageSession(prev, data));
        setError('');
      } catch (err) {
        if (!cancelled) setError(err.message || 'Couldn’t reach this session.');
      }
    };
    load();
    const id = window.setInterval(load, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [code]);

  const cats = useMemo(() => {
    const wanted = new Set(session?.ideaCats || []);
    const known = ASK_FOR_CATEGORIES.filter((cat) => wanted.has(cat.id));
    if (known.length) return known;
    return (session?.ideaCats || []).map((id) => ({ id, label: id }));
  }, [session]);

  const onSubmit = async (event) => {
    event.preventDefault();
    const ideas = {};
    cats.forEach((cat) => {
      const text = String(values[cat.id] || '').trim();
      if (text) ideas[cat.id] = [text];
    });
    if (!Object.keys(ideas).length) {
      setError('Write at least one idea, then submit.');
      return;
    }
    setBusy(true);
    setError('');
    setStatus('');
    try {
      const data = await postStage(code, undefined, { ideas });
      setValues({});
      setStatus(data.ideasHold ? 'Sent — waiting for the host' : 'Sent. Add another whenever you like.');
      setSession((prev) => ({
        ...(prev || {}),
        ideas: data.ideas || {},
        ideaCats: data.ideaCats || prev?.ideaCats || [],
        ideasOpen: data.ideasOpen === true || prev?.ideasOpen,
        ideasHold: data.ideasHold === true,
        ideaFlags: data.ideaFlags === true || prev?.ideaFlags,
      }));
    } catch (err) {
      setError(err.message || 'Couldn’t send ideas.');
    } finally {
      setBusy(false);
    }
  };

  const ideasClosed = Boolean(session?.ideaFlags && !session.ideasOpen);
  const ideasWaiting = !session || (!session.ideasOpen && !session.ideaFlags);

  if (ideasClosed) {
    return (
      <div className="min-h-dvh w-full bg-black text-white flex flex-col items-center justify-center px-6 py-10">
        <Lightbulb className="w-12 h-12 text-gray-500 mb-4" />
        <h1 className="text-3xl font-black font-display mb-2">Ideas are off</h1>
        <p className="text-gray-400 text-center max-w-md">
          Session {code} is not collecting audience ideas right now.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-dvh w-full bg-black text-white flex flex-col px-6 py-10">
      <div className="w-full max-w-md mx-auto flex-1 flex flex-col">
        <p className="text-xs uppercase tracking-[0.3em] text-gray-500 font-bold mb-2">Improv Jam</p>
        <h1 className="text-3xl font-black font-display tracking-tight mb-1">Audience ideas</h1>
        <p className="text-sm text-gray-400 mb-2">
          Session <span className="font-black font-display tracking-[0.18em] text-gray-200">{code}</span>
        </p>
        <p className="text-xs text-gray-500 mb-6">Keep it show-safe — the host may hold or drop anything that isn’t.</p>
        {error ? <p className="text-sm text-amber-300 mb-3">{error}</p> : null}
        {status ? <p className="text-sm text-lime-300 mb-3">{status}</p> : null}
        {ideasWaiting ? (
          <p className="text-gray-500">Connecting…</p>
        ) : !cats.length ? (
          <p className="text-gray-400">The host has not opened any banks yet.</p>
        ) : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            {cats.map((cat) => (
              <label key={cat.id} className="block">
                <span className="text-2xs uppercase tracking-wider text-gray-500 font-bold">{cat.label}</span>
                <input
                  value={values[cat.id] || ''}
                  onChange={(e) => setValues((prev) => ({ ...prev, [cat.id]: e.target.value }))}
                  maxLength={120}
                  className="mt-1 w-full min-h-12 rounded-xl bg-[#141414] border border-gray-700 px-3 text-base text-white"
                />
              </label>
            ))}
            <button
              type="submit"
              disabled={busy}
              className="min-h-12 rounded-2xl bg-lime-600 disabled:bg-gray-800 text-black disabled:text-gray-500 font-black text-lg"
            >
              {busy ? 'Sending…' : 'Submit'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function IdeasView() {
  const code = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return normalizeStageCode(params.get('s') || params.get('stage') || '');
  }, []);

  useEffect(() => {
    applyTheme('dark');
  }, []);

  if (!code) return <JoinForm />;
  return <IdeasForm code={code} />;
}
