import { useEffect, useMemo, useState } from 'react';
import { Bell, Timer, Users, Shuffle, Lightbulb, Coins, Play, Settings } from 'lucide-react';
import { BELL_STYLES, playCountIn, playDing } from '../lib/audio.js';
import { useHoldDing } from '../lib/useHoldDing.js';
import { useAppStore } from '../store/useAppStore.js';
import { useWakeLock } from '../lib/useWakeLock.js';
import ActionDock from './ActionDock.jsx';

const PRESETS = [
  { label: '30s', seconds: 30 },
  { label: '60s', seconds: 60 },
  { label: '2m', seconds: 120 },
  { label: '3m', seconds: 180 },
  { label: '5m', seconds: 300 },
];

const TOOLS = [
  { id: 'bell', label: 'Bell', icon: Bell, accent: 'text-yellow-300' },
  { id: 'timer', label: 'Timer', icon: Timer, accent: 'text-cyan-300' },
  { id: 'whosup', label: "Who's Up", icon: Users, accent: 'text-blue-300' },
  { id: 'hat', label: 'Hat', icon: Lightbulb, accent: 'text-lime-300' },
  { id: 'coin', label: 'Coin', icon: Coins, accent: 'text-amber-300' },
];

function formatTime(total) {
  const m = Math.floor(Math.max(total, 0) / 60);
  const s = Math.max(total, 0) % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function ToolsView({ onOpenSettings }) {
  const prompts = useAppStore((s) => s.data.prompts);
  const settings = useAppStore((s) => s.settings);
  useWakeLock(Boolean(settings.keepAwake));
  const [activeTool, setActiveTool] = useState('timer');
  const [seconds, setSeconds] = useState(60);
  const [remaining, setRemaining] = useState(60);
  const [running, setRunning] = useState(false);
  const [halfLife, setHalfLife] = useState(false);
  const [halfStep, setHalfStep] = useState(0);
  const [customMin, setCustomMin] = useState(1);
  const [customSec, setCustomSec] = useState(0);
  const [roster, setRoster] = useState('');
  const [picked, setPicked] = useState('');
  const [lastPicked, setLastPicked] = useState('');
  const [suggestion, setSuggestion] = useState(null);
  const [coin, setCoin] = useState('');

  const halfSequence = [60, 30, 15, 7];
  const ding = () => playDing(settings.bellStyle, settings.bellVolume);
  const holdHeaderDing = useHoldDing(settings.bellStyle, settings.bellVolume);
  const holdPanelDing = useHoldDing(settings.bellStyle, settings.bellVolume);
  const countIn = () => playCountIn(settings.countInBeats, settings.bellStyle, settings.bellVolume);
  const styleLabel = BELL_STYLES.find((s) => s.id === settings.bellStyle)?.label || 'Bell';

  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          playDing(settings.bellStyle, settings.bellVolume);
          if (halfLife && halfStep < halfSequence.length - 1) {
            const next = halfStep + 1;
            setHalfStep(next);
            return halfSequence[next];
          }
          setRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [running, halfLife, halfStep, settings.bellStyle, settings.bellVolume]);

  const players = useMemo(
    () => roster.split(/[\n,]/).map((n) => n.trim()).filter(Boolean),
    [roster],
  );

  const startTimer = (value) => {
    setSeconds(value);
    setRemaining(value);
    setRunning(true);
  };

  const applyCustom = () => {
    const value = Math.max(1, Number(customMin) * 60 + Number(customSec));
    setHalfLife(false);
    startTimer(value);
  };

  const pickPlayer = () => {
    const pool = players.filter((p) => p !== lastPicked);
    const source = pool.length ? pool : players;
    if (!source.length) return;
    const next = source[Math.floor(Math.random() * source.length)];
    setPicked(next);
    setLastPicked(next);
  };

  const rollSuggestion = () => {
    const s = prompts.suggestions;
    setSuggestion({
      location: s.locations[Math.floor(Math.random() * s.locations.length)],
      occupation: s.occupations[Math.floor(Math.random() * s.occupations.length)],
      relationship: s.relationships[Math.floor(Math.random() * s.relationships.length)],
      object: s.objects[Math.floor(Math.random() * s.objects.length)],
    });
  };

  const flipCoin = () => setCoin(Math.random() < 0.5 ? 'Heads / Yes' : 'Tails / No');

  const dingButton = (className, holdProps = holdHeaderDing) => (
    <button
      type="button"
      {...holdProps}
      className={`bg-yellow-500 text-black font-black rounded-2xl min-h-12 active:scale-95 flex items-center justify-center gap-2 shrink-0 ${className}`}
      aria-label="Ding, hold to sustain"
    >
      <Bell className="w-5 h-5" />
      Ding
    </button>
  );

  return (
    <div className="h-full flex flex-col pt-safe relative">
      <div className="px-4">
        <div className="flex items-center justify-between mb-3 gap-3">
          <h1 className="text-2xl font-black font-display text-white tracking-tight">Jam Tools</h1>
          {dingButton('hidden md:flex px-5 py-2.5 min-w-[88px]')}
        </div>

        <div className="flex gap-2 mb-4">
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            const active = activeTool === tool.id;
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => setActiveTool(tool.id)}
                className={`flex-1 min-h-14 rounded-2xl border flex flex-col items-center justify-center gap-1 ${
                  active ? 'bg-gray-800 border-gray-500 text-white' : 'bg-[#1A1A1A] border-gray-800 text-gray-400'
                }`}
                aria-pressed={active}
              >
                <Icon className={`w-5 h-5 ${active ? tool.accent : ''}`} />
                <span className="text-[10px] font-bold">{tool.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pb-6 md:pb-nav">
        {activeTool === 'bell' && (
          <section className="bg-card border border-gray-800 rounded-2xl p-4">
            <h2 className="text-lg font-black font-display mb-2 text-yellow-300 flex items-center">
              <Bell className="w-5 h-5 mr-2" />
              Bell
            </h2>
            <p className="text-xs text-gray-500 mb-3">
              Sound is {styleLabel} · volume {Math.round(settings.bellVolume * 100)}% · {settings.countInBeats}-count.
              Tap Ding for a hit, or hold it to sustain. Change the voice in Settings.
            </p>
            <div className="hidden md:grid grid-cols-2 gap-2">
              <button
                type="button"
                {...holdPanelDing}
                className="bg-yellow-500 text-black font-black py-4 rounded-2xl text-lg active:scale-95 min-h-16"
                aria-label="Ding, hold to sustain"
              >
                Ding
              </button>
              <button
                type="button"
                onClick={countIn}
                className="bg-gray-800 border border-gray-700 text-gray-100 font-bold py-4 rounded-2xl active:scale-95 min-h-16 flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4" />
                {settings.countInBeats}-count
              </button>
            </div>
            {onOpenSettings && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="w-full mt-3 min-h-11 rounded-xl border border-gray-700 bg-gray-800 text-sm font-bold text-gray-200 flex items-center justify-center gap-2"
              >
                <Settings className="w-4 h-4" />
                Bell settings
              </button>
            )}
          </section>
        )}

        {activeTool === 'timer' && (
          <section className="bg-card border border-gray-800 rounded-2xl p-4">
            <h2 className="text-lg font-black font-display mb-3 text-cyan-300 flex items-center">
              <Timer className="w-5 h-5 mr-2" />
              Timer
            </h2>
            <div className="text-center mb-4">
              <p className="text-6xl font-black font-display tabular-nums text-white">{formatTime(remaining)}</p>
              {halfLife && <p className="text-xs text-cyan-400 mt-1">Half-Life beat {halfStep + 1} of 4</p>}
            </div>
            <div className="flex overflow-x-auto gap-2 mb-3 scrollbar-hide">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => {
                    setHalfLife(false);
                    startTimer(p.seconds);
                  }}
                  className="px-4 py-2 rounded-full bg-gray-800 border border-gray-700 text-sm font-bold min-h-10"
                >
                  {p.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setHalfLife(true);
                  setHalfStep(0);
                  startTimer(60);
                }}
                className="px-4 py-2 rounded-full bg-cyan-900/40 border border-cyan-700 text-cyan-200 text-sm font-bold min-h-10"
              >
                Half-Life
              </button>
            </div>
            <div className="flex gap-2 mb-3">
              <input
                type="number"
                min="0"
                value={customMin}
                onChange={(e) => setCustomMin(e.target.value)}
                className="w-20 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2"
                aria-label="Minutes"
              />
              <span className="self-center text-gray-500">min</span>
              <input
                type="number"
                min="0"
                max="59"
                value={customSec}
                onChange={(e) => setCustomSec(e.target.value)}
                className="w-20 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2"
                aria-label="Seconds"
              />
              <span className="self-center text-gray-500">sec</span>
              <button type="button" onClick={applyCustom} className="flex-1 bg-cyan-700 text-white font-bold rounded-lg min-h-11">
                Set
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              <button type="button" onClick={() => setRunning((v) => !v)} className="hidden md:block bg-gray-800 border border-gray-700 rounded-lg py-3 font-bold min-h-12">
                {running ? 'Pause' : 'Start'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setRunning(false);
                  setRemaining(seconds);
                }}
                className="bg-gray-800 border border-gray-700 rounded-lg py-3 font-bold min-h-12"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => {
                  ding();
                  setRunning(false);
                  setRemaining(0);
                }}
                className="bg-gray-800 border border-gray-700 rounded-lg py-3 font-bold min-h-12"
              >
                End + ding
              </button>
            </div>
          </section>
        )}

        {activeTool === 'whosup' && (
          <section className="bg-card border border-gray-800 rounded-2xl p-4">
            <h2 className="text-lg font-black font-display mb-3 text-blue-300 flex items-center">
              <Users className="w-5 h-5 mr-2" />
              Who&apos;s Up
            </h2>
            <textarea
              value={roster}
              onChange={(e) => setRoster(e.target.value)}
              placeholder="Names, comma or line separated"
              className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-sm mb-3 min-h-24"
            />
            <button type="button" onClick={pickPlayer} className="hidden md:flex w-full bg-blue-600 text-white font-bold py-3 rounded-xl min-h-12 items-center justify-center gap-2">
              <Shuffle className="w-4 h-4" />
              Pick next player
            </button>
            {picked && <p className="text-center text-2xl font-black font-display mt-3 text-blue-200">{picked}</p>}
          </section>
        )}

        {activeTool === 'hat' && (
          <section className="bg-card border border-gray-800 rounded-2xl p-4">
            <h2 className="text-lg font-black font-display mb-3 text-lime-300 flex items-center">
              <Lightbulb className="w-5 h-5 mr-2" />
              Suggestion Hat
            </h2>
            <button type="button" onClick={rollSuggestion} className="hidden md:block w-full bg-lime-700 text-white font-bold py-3 rounded-xl min-h-12 mb-3">
              Draw a suggestion
            </button>
            {suggestion && (
              <div className="grid grid-cols-2 gap-2 text-sm">
                <p className="bg-gray-900 rounded-lg p-3 border border-gray-800"><span className="block text-[10px] uppercase text-gray-500">Location</span>{suggestion.location}</p>
                <p className="bg-gray-900 rounded-lg p-3 border border-gray-800"><span className="block text-[10px] uppercase text-gray-500">Occupation</span>{suggestion.occupation}</p>
                <p className="bg-gray-900 rounded-lg p-3 border border-gray-800"><span className="block text-[10px] uppercase text-gray-500">Relationship</span>{suggestion.relationship}</p>
                <p className="bg-gray-900 rounded-lg p-3 border border-gray-800"><span className="block text-[10px] uppercase text-gray-500">Object</span>{suggestion.object}</p>
              </div>
            )}
          </section>
        )}

        {activeTool === 'coin' && (
          <section className="bg-card border border-gray-800 rounded-2xl p-4">
            <h2 className="text-lg font-black font-display mb-3 text-amber-300 flex items-center">
              <Coins className="w-5 h-5 mr-2" />
              Coin Flip
            </h2>
            <button
              type="button"
              onClick={flipCoin}
              className="hidden md:block w-full bg-amber-700 text-black font-black py-3 rounded-xl min-h-12"
            >
              Flip
            </button>
            {coin && <p className="text-center text-2xl font-black mt-3">{coin}</p>}
          </section>
        )}
      </div>

      <ActionDock>
        <div className="flex gap-2">
          {dingButton('px-5 min-w-[88px]', holdPanelDing)}
          {activeTool === 'bell' && (
            <button
              type="button"
              onClick={countIn}
              className="flex-1 bg-gray-800 border border-gray-700 text-gray-100 font-bold rounded-xl min-h-12 flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4" />
              {settings.countInBeats}-count
            </button>
          )}
          {activeTool === 'timer' && (
            <button
              type="button"
              onClick={() => setRunning((v) => !v)}
              className="flex-1 bg-cyan-700 text-white font-bold rounded-xl min-h-12"
            >
              {running ? 'Pause' : 'Start'}
            </button>
          )}
          {activeTool === 'whosup' && (
            <button
              type="button"
              onClick={pickPlayer}
              className="flex-1 bg-blue-600 text-white font-bold rounded-xl min-h-12 flex items-center justify-center gap-2"
            >
              <Shuffle className="w-4 h-4" />
              Pick
            </button>
          )}
          {activeTool === 'hat' && (
            <button
              type="button"
              onClick={rollSuggestion}
              className="flex-1 bg-lime-700 text-white font-bold rounded-xl min-h-12"
            >
              Draw
            </button>
          )}
          {activeTool === 'coin' && (
            <button
              type="button"
              onClick={flipCoin}
              className="flex-1 bg-amber-700 text-black font-black rounded-xl min-h-12"
            >
              Flip
            </button>
          )}
        </div>
      </ActionDock>
    </div>
  );
}
