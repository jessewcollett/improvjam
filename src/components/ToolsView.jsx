import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Timer, Users, Shuffle, Lightbulb, Coins, Music, Minus, Plus, Square } from 'lucide-react';
import { playCountIn, playPad } from '../lib/audio.js';
import { mergeSfxPads, resolveDefaultPad, sheetTracks } from '../lib/sfxPad.js';
import { useHoldDing } from '../lib/useHoldDing.js';
import { useAppStore } from '../store/useAppStore.js';
import { useWakeLock } from '../lib/useWakeLock.js';
import ActionDock from './ActionDock.jsx';
import MusicPlayer from './MusicPlayer.jsx';
import SfxPad from './SfxPad.jsx';

const PRESETS = [
  { label: '30s', seconds: 30 },
  { label: '60s', seconds: 60 },
  { label: '2m', seconds: 120 },
  { label: '3m', seconds: 180 },
  { label: '5m', seconds: 300 },
];

const TOOLS = [
  { id: 'sfx', label: 'SFX', icon: Bell, accent: 'text-yellow-300' },
  { id: 'music', label: 'Music', icon: Music, accent: 'text-fuchsia-300' },
  { id: 'timer', label: 'Timer', icon: Timer, accent: 'text-cyan-300' },
  { id: 'whosup', label: "Who's Up", icon: Users, accent: 'text-blue-300' },
  { id: 'hat', label: 'Hat', icon: Lightbulb, accent: 'text-lime-300' },
  { id: 'coin', label: 'Coin', icon: Coins, accent: 'text-amber-300' },
];

const PICK_MIN = 1;
const PICK_MAX = 12;

function formatTime(total) {
  const m = Math.floor(Math.max(total, 0) / 60);
  const s = Math.max(total, 0) % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function clampPickCount(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return PICK_MIN;
  return Math.min(PICK_MAX, Math.max(PICK_MIN, Math.round(n)));
}

function sampleUnique(list, n) {
  const copy = [...list];
  const out = [];
  const take = Math.min(n, copy.length);
  for (let i = 0; i < take; i += 1) {
    const idx = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(idx, 1)[0]);
  }
  return out;
}

function PickCountChip({ count, onCount }) {
  const n = clampPickCount(count);
  return (
    <div className="inline-flex items-center shrink-0 rounded-xl border border-blue-800/50 bg-[#1A1A1A] overflow-hidden">
      <button
        type="button"
        onClick={() => onCount(n - 1)}
        disabled={n <= PICK_MIN}
        className="min-w-11 min-h-11 flex items-center justify-center text-gray-200 disabled:text-gray-600"
        aria-label="Fewer players"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>
      <span className="w-6 text-center text-sm font-black tabular-nums text-white">{n}</span>
      <button
        type="button"
        onClick={() => onCount(n + 1)}
        disabled={n >= PICK_MAX}
        className="min-w-11 min-h-11 flex items-center justify-center text-gray-200 disabled:text-gray-600"
        aria-label="More players"
      >
        <Plus className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function ToolsView() {
  const prompts = useAppStore((s) => s.data.prompts);
  const audioRows = useAppStore((s) => s.data.audio) || [];
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const sfxSlots = useAppStore((s) => s.sfxSlots);
  const sfxSlotColors = useAppStore((s) => s.sfxSlotColors);
  const sfxIconOverrides = useAppStore((s) => s.sfxIconOverrides);
  const setDefaultSfx = useAppStore((s) => s.setDefaultSfx);
  const assignSfxSlot = useAppStore((s) => s.assignSfxSlot);
  const setSfxSlotCount = useAppStore((s) => s.setSfxSlotCount);
  const setSfxSlotColor = useAppStore((s) => s.setSfxSlotColor);
  const setSfxIconOverride = useAppStore((s) => s.setSfxIconOverride);
  const moveSfxSlot = useAppStore((s) => s.moveSfxSlot);
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
  const [picked, setPicked] = useState([]);
  const [lastPicked, setLastPicked] = useState([]);
  const [suggestion, setSuggestion] = useState(null);
  const [coin, setCoin] = useState('');
  const musicControlsRef = useRef({});

  const halfSequence = [60, 30, 15, 7];
  const pads = useMemo(() => mergeSfxPads(audioRows), [audioRows]);
  const tracks = useMemo(() => sheetTracks(audioRows), [audioRows]);
  const defaultPad = useMemo(
    () => resolveDefaultPad(pads, settings.defaultSfxId, settings.bellStyle),
    [pads, settings.defaultSfxId, settings.bellStyle],
  );

  const ding = () => playPad(defaultPad, settings.bellVolume);
  const holdHeaderDing = useHoldDing(defaultPad, settings.bellVolume);
  const countIn = () => playCountIn(settings.countInBeats, defaultPad, settings.bellVolume);

  useEffect(() => {
    if (!running) return undefined;
    const id = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          playPad(defaultPad, settings.bellVolume);
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
  }, [running, halfLife, halfStep, defaultPad, settings.bellVolume]);

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

  const pickCount = clampPickCount(settings.whosUpCount);
  const setPickCount = (n) => updateSettings({ whosUpCount: clampPickCount(n) });

  const pickPlayer = () => {
    if (!players.length) return;
    const n = Math.min(pickCount, players.length);
    const avoid = new Set(lastPicked);
    const fresh = players.filter((p) => !avoid.has(p));
    const pool = fresh.length >= n ? fresh : players;
    const next = sampleUnique(pool, n);
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
    <div className="h-full min-h-0 overflow-hidden flex flex-col pt-safe relative">
      <div className={`px-4 md:px-6 ${activeTool === 'sfx' ? 'pb-0' : ''}`}>
        <div className={`flex items-center justify-between gap-3 ${activeTool === 'sfx' ? 'mb-1' : 'mb-3'}`}>
          <h1 className={`font-black font-display text-white tracking-tight ${activeTool === 'sfx' ? 'text-lg' : 'text-2xl'}`}>Jam Tools</h1>
          <div className="hidden md:flex items-center gap-2">
            {activeTool !== 'sfx' ? dingButton('flex px-5 py-2.5 min-w-[88px]') : null}
          </div>
        </div>

        <div className={`grid grid-cols-3 lg:grid-cols-6 gap-1 ${activeTool === 'sfx' ? 'mb-1' : 'mb-4'}`}>
          {TOOLS.map((tool) => {
            const Icon = tool.icon;
            const active = activeTool === tool.id;
            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => setActiveTool(tool.id)}
                className={`${activeTool === 'sfx' ? 'min-h-11' : 'min-h-14'} rounded-2xl border flex flex-col items-center justify-center gap-0.5 ${
                  active ? 'bg-gray-800 border-gray-500 text-white' : 'bg-[#1A1A1A] border-gray-800 text-gray-400'
                }`}
                aria-pressed={active}
              >
                <Icon className={`w-5 h-5 ${active ? tool.accent : ''}`} />
                <span className="text-2xs font-bold leading-tight text-center">{tool.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        className={
          activeTool === 'sfx'
            ? 'flex-1 min-h-0 px-1 flex flex-col overflow-hidden'
            : activeTool === 'music'
              ? 'flex-1 min-h-0 px-4 md:px-6 pb-2 md:pb-nav flex flex-col overflow-hidden'
              : 'flex-1 overflow-y-auto scrollbar-hide px-4 md:px-6 pb-6 md:pb-nav'
        }
      >
        {activeTool === 'sfx' && (
          <SfxPad
            pads={pads}
            slots={sfxSlots}
            colors={sfxSlotColors}
            defaultPad={defaultPad}
            volume={settings.bellVolume}
            countInBeats={settings.countInBeats}
            onAssign={assignSfxSlot}
            onSetDefault={setDefaultSfx}
            onVolume={(bellVolume) => updateSettings({ bellVolume })}
            onCountInBeats={(countInBeats) => updateSettings({ countInBeats })}
            onSlotCount={setSfxSlotCount}
            onSlotColor={setSfxSlotColor}
            iconOverrides={sfxIconOverrides}
            onIconOverride={setSfxIconOverride}
            onMoveSlot={moveSfxSlot}
            fadeSeconds={settings.fadeSeconds}
            dingHold={holdHeaderDing}
            onCountIn={countIn}
          />
        )}

        {activeTool === 'music' && (
          <div className="flex-1 min-h-0">
            <MusicPlayer tracks={tracks} controlsRef={musicControlsRef} fadeSeconds={settings.fadeSeconds} />
          </div>
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
            <div className="flex flex-wrap overflow-x-auto gap-2 mb-3 scrollbar-hide">
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
              className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-sm mb-3 min-h-24 md:min-h-32"
            />
            <div className="hidden md:flex items-center gap-2">
              <PickCountChip count={pickCount} onCount={setPickCount} />
              <button type="button" onClick={pickPlayer} className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-xl min-h-12 flex items-center justify-center gap-2">
                <Shuffle className="w-4 h-4" />
                Pick
              </button>
            </div>
            {picked.length > 0 && (
              <div className="mt-3 space-y-1">
                {picked.map((name, i) => (
                  <p key={`${name}-${i}`} className="text-center text-2xl font-black font-display text-blue-200">
                    {name}
                  </p>
                ))}
              </div>
            )}
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
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-sm">
                <p className="bg-gray-900 rounded-lg p-3 border border-gray-800"><span className="block text-2xs uppercase text-gray-500">Location</span>{suggestion.location}</p>
                <p className="bg-gray-900 rounded-lg p-3 border border-gray-800"><span className="block text-2xs uppercase text-gray-500">Occupation</span>{suggestion.occupation}</p>
                <p className="bg-gray-900 rounded-lg p-3 border border-gray-800"><span className="block text-2xs uppercase text-gray-500">Relationship</span>{suggestion.relationship}</p>
                <p className="bg-gray-900 rounded-lg p-3 border border-gray-800"><span className="block text-2xs uppercase text-gray-500">Object</span>{suggestion.object}</p>
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

      {activeTool !== 'sfx' ? (
      <ActionDock>
        <div className="flex gap-2">
          {dingButton('px-5 min-w-[88px]')}
          {activeTool === 'music' && (
            <>
              <button
                type="button"
                onClick={() => musicControlsRef.current?.fade?.()}
                className="flex-1 bg-[#1A1A1A] border border-fuchsia-800/60 text-fuchsia-200 font-bold rounded-xl min-h-12"
              >
                Fade
              </button>
              <button
                type="button"
                onClick={() => musicControlsRef.current?.stop?.()}
                className="flex-1 bg-red-950/40 border border-red-800/60 text-red-200 font-bold rounded-xl min-h-12 inline-flex items-center justify-center gap-1.5"
              >
                <Square className="w-3.5 h-3.5 fill-current" />
                Stop
              </button>
              <button
                type="button"
                onClick={() => musicControlsRef.current?.random?.()}
                className="flex-1 bg-fuchsia-700 text-white font-bold rounded-xl min-h-12 flex items-center justify-center gap-2"
              >
                <Shuffle className="w-4 h-4" />
                Random
              </button>
            </>
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
            <>
              <PickCountChip count={pickCount} onCount={setPickCount} />
              <button
                type="button"
                onClick={pickPlayer}
                className="flex-1 bg-blue-600 text-white font-bold rounded-xl min-h-12 flex items-center justify-center gap-2"
              >
                <Shuffle className="w-4 h-4" />
                Pick
              </button>
            </>
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
      ) : null}
    </div>
  );
}
