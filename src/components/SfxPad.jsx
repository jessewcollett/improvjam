import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  BellRing,
  CircleDot,
  Disc3,
  Drum,
  Megaphone,
  Plus,
  Sparkles,
  Star,
  Triangle,
  Volume2,
  Wind,
  X,
  Zap,
} from 'lucide-react';
import { playPad, preloadBellSamples } from '../lib/audio.js';
import { useHoldDing } from '../lib/useHoldDing.js';
import { SFX_SLOT_COUNT } from '../lib/sfxPad.js';

const ICONS = {
  bell: Bell,
  'bell-ring': BellRing,
  drum: Drum,
  zap: Zap,
  'volume-2': Volume2,
  music: BellRing,
  gong: Disc3,
  'disc-3': Disc3,
  triangle: Triangle,
  megaphone: Megaphone,
  sparkles: Sparkles,
  wind: Wind,
  whoosh: Wind,
  'circle-dot': CircleDot,
  waves: Wind,
};

function firstEmoji(value) {
  const match = String(value).match(
    /\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic}|\p{Emoji_Modifier})*/u,
  );
  return match ? match[0] : '';
}

function SfxIcon({ name, className }) {
  const raw = String(name || '').trim();
  const Icon = ICONS[raw.toLowerCase()];
  if (Icon) return <Icon className={className} />;
  const emoji = firstEmoji(raw);
  if (emoji) {
    return (
      <span
        className={`inline-flex items-center justify-center leading-none ${className || ''}`}
        aria-hidden="true"
      >
        {emoji}
      </span>
    );
  }
  return <Bell className={className} />;
}

function PadHit({ pad, volume, active, children, className }) {
  const hold = useHoldDing(pad, volume);
  return (
    <button type="button" {...hold} className={className} aria-pressed={active}>
      {children}
    </button>
  );
}

export default function SfxPad({
  pads,
  slots,
  defaultPad,
  volume,
  countInBeats,
  onAssign,
  onSetDefault,
  onVolume,
  onCountInBeats,
}) {
  const [bankOpen, setBankOpen] = useState(false);
  const [picking, setPicking] = useState(null);
  const [bankHint, setBankHint] = useState('');
  const byId = useMemo(() => new Map(pads.map((pad) => [pad.id, pad])), [pads]);
  const grid = useMemo(() => {
    const next = Array.from({ length: SFX_SLOT_COUNT }, (_, i) => byId.get(slots?.[i]) || null);
    return next;
  }, [byId, slots]);

  useEffect(() => {
    preloadBellSamples();
  }, []);

  const place = (index, id) => {
    onAssign(index, id);
    setPicking(null);
    setBankHint('');
  };

  const pickSquare = (index) => {
    setPicking((current) => (current === index ? null : index));
    setBankHint('');
  };

  const addFromBank = (soundId) => {
    if (picking != null) {
      place(picking, soundId);
      return;
    }
    const empty = grid.findIndex((slot) => !slot);
    if (empty === -1) {
      setBankHint('Pick a square first — all pads are full.');
      return;
    }
    place(empty, soundId);
  };

  return (
    <section className="bg-card border border-gray-800 rounded-2xl p-4">
      <h2 className="text-lg font-black font-display text-yellow-300 flex items-center mb-1">
        <Drum className="w-5 h-5 mr-2" />
        SFX pad
      </h2>
      <p className="text-xs text-gray-500 leading-snug mb-3">
        {picking != null
          ? 'Tap a sound in the bank, then it drops on that square. Tap the square again to cancel.'
          : bankOpen
            ? 'Tap a square to choose where the next sound goes, or add to the first empty pad.'
            : 'Tap or hold a square to play. Open the bank to add sounds to empty pads.'}
      </p>

      <div className="grid grid-cols-4 gap-2 mb-4">
        {grid.map((pad, index) => {
          const active = pad && defaultPad?.id === pad.id;
          const selecting = picking === index;
          if (!pad) {
            return (
              <button
                key={`empty-${index}`}
                type="button"
                onClick={() => {
                  pickSquare(index);
                  setBankOpen(true);
                }}
                className={`aspect-square rounded-2xl border-2 border-dashed min-h-16 min-w-11 flex flex-col items-center justify-center gap-1 ${
                  selecting ? 'border-yellow-400 bg-yellow-600/20 text-yellow-200' : 'border-gray-700 text-gray-500'
                }`}
                aria-label={`Empty pad ${index + 1}, add from bank`}
              >
                <Plus className="w-5 h-5" />
                <span className="text-2xs font-bold">{index + 1}</span>
              </button>
            );
          }
          const padClass = `w-full h-full min-h-16 min-w-11 rounded-2xl border flex flex-col items-center justify-center gap-1 px-1 ${
            selecting
              ? 'border-yellow-400 bg-yellow-600/30 text-yellow-100'
              : active
                ? 'bg-yellow-600 text-black border-yellow-400'
                : 'bg-[#1A1A1A] text-gray-100 border-gray-700'
          }`;
          const padInner = (
            <>
              <SfxIcon name={pad.icon} className="w-5 h-5" />
              <span className="text-2xs font-bold leading-tight text-center line-clamp-2">{pad.name}</span>
            </>
          );
          return (
            <div key={`${pad.id}-${index}`} className="relative aspect-square min-h-16 min-w-11">
              {bankOpen ? (
                <button
                  type="button"
                  onClick={() => pickSquare(index)}
                  className={padClass}
                  aria-pressed={selecting}
                  aria-label={`Assign next sound to pad ${index + 1}, ${pad.name}`}
                >
                  {padInner}
                </button>
              ) : (
                <PadHit pad={pad} volume={volume} active={active} className={padClass}>
                  {padInner}
                </PadHit>
              )}
              <button
                type="button"
                onClick={() => onSetDefault(pad.id)}
                className={`absolute top-0 left-0 z-10 min-w-11 min-h-11 flex items-center justify-center ${
                  active ? 'text-black' : 'text-gray-500'
                }`}
                aria-label={`Use ${pad.name} for Ding`}
              >
                <Star className="w-3.5 h-3.5" fill={active ? 'currentColor' : 'none'} />
              </button>
              <button
                type="button"
                onClick={() => place(index, null)}
                className={`absolute top-0 right-0 z-10 min-w-11 min-h-11 flex items-center justify-center ${
                  active ? 'text-black/70' : 'text-gray-500'
                }`}
                aria-label={`Clear pad ${index + 1}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setBankOpen((v) => !v)}
        className="w-full min-h-11 rounded-xl border border-gray-700 bg-[#1A1A1A] text-sm font-bold text-gray-200 mb-2"
      >
        {bankOpen ? 'Hide sound bank' : `Sound bank (${pads.length})`}
      </button>
      {bankHint ? (
        <p className="text-xs text-yellow-300 mb-2" role="status">
          {bankHint}
        </p>
      ) : null}

      {bankOpen ? (
        <div className="max-h-56 overflow-y-auto space-y-1 mb-4 pr-1">
          {pads.map((sound) => (
            <div
              key={sound.id}
              className="flex items-center gap-2 rounded-xl border border-gray-800 bg-[#121212] px-2 py-1.5"
            >
              <button
                type="button"
                onClick={() => playPad(sound, volume)}
                className="flex-1 min-w-0 min-h-11 text-left flex items-center gap-2"
              >
                <SfxIcon name={sound.icon} className="w-4 h-4 text-yellow-400 shrink-0" />
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-gray-100 truncate">{sound.name}</span>
                  {sound.credit ? (
                    <span className="block text-2xs text-gray-500 truncate">{sound.credit}</span>
                  ) : null}
                </span>
              </button>
              <button
                type="button"
                onClick={() => addFromBank(sound.id)}
                className="shrink-0 min-w-11 min-h-11 rounded-lg border border-gray-700 text-yellow-300"
                aria-label={`Add ${sound.name} to pad`}
              >
                <Plus className="w-4 h-4 mx-auto" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <label className="block mb-4">
        <span className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
          <span className="flex items-center gap-1.5">
            <Volume2 className="w-3.5 h-3.5" />
            Volume
          </span>
          <span>{Math.round(volume * 100)}%</span>
        </span>
        <input
          type="range"
          min="0.1"
          max="1"
          step="0.05"
          value={volume}
          onChange={(e) => onVolume(Number(e.target.value))}
          className="w-full accent-yellow-500 min-h-11"
        />
      </label>

      <div className="mb-2">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Count-in</p>
        <div className="grid grid-cols-3 gap-2">
          {[3, 4, 5].map((beats) => (
            <button
              key={beats}
              type="button"
              onClick={() => onCountInBeats(beats)}
              className={`min-h-11 rounded-xl text-sm font-bold border px-3 ${
                countInBeats === beats
                  ? 'bg-yellow-600 text-black border-yellow-400'
                  : 'bg-[#1A1A1A] text-gray-200 border-gray-800'
              }`}
            >
              {beats}-count
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-gray-500">
        Ding: <span className="text-gray-300 font-semibold">{defaultPad?.name || 'Bell'}</span>
        {' '}(star a pad). Credits stay on each sound in the bank.
      </p>
    </section>
  );
}
