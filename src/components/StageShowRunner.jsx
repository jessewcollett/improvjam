import { useMemo } from 'react';
import { Bell, Coins, Lightbulb, Pause, Play, RotateCcw } from 'lucide-react';
import { flipCoin, rollHatFromPrompts } from '../lib/generateDraw.js';
import { playItemsFromState } from '../lib/stagePlay.js';
import { normalizeStageManagerTools } from '../lib/nav.js';
import { mergeSfxPads, resolveDefaultPad } from '../lib/sfxPad.js';
import { remainingFromTimer, slotSummary, snapshotTimer } from '../lib/stage.js';
import { useHoldDing } from '../lib/useHoldDing.js';
import { useAppStore } from '../store/useAppStore.js';
import { LiveStageTime } from './StageBoardContent.jsx';
import StagePin from './StagePin.jsx';
import StageFold from './StageFold.jsx';
import StageGeneratorTool from './StageGeneratorTool.jsx';

const TIMER_DEFAULT = 60;

function RunnerCell({ title, accent, pinned, onPin, pinLabel, className = '', children }) {
  return (
    <div className={`rounded-xl border border-gray-800 bg-[#1A1A1A] p-2 min-h-[5.5rem] flex flex-col gap-1 ${className}`}>
      <div className="flex items-center justify-between gap-1">
        <p className={`text-2xs uppercase tracking-wider font-bold ${accent}`}>{title}</p>
        {onPin ? <StagePin pressed={pinned} onClick={onPin} label={pinLabel} /> : null}
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

export default function StageShowRunner() {
  const stagePins = useAppStore((s) => s.stagePins);
  const stageSlots = useAppStore((s) => s.stageSlots);
  const stagePlay = useAppStore((s) => s.stagePlay);
  const customSets = useAppStore((s) => s.lists.customSets);
  const catalogGames = useAppStore((s) => s.data.games);
  const catalogTerms = useAppStore((s) => s.data.terms);
  const prompts = useAppStore((s) => s.data.prompts);
  const toggleStagePin = useAppStore((s) => s.toggleStagePin);
  const setStageSlot = useAppStore((s) => s.setStageSlot);
  const publishStageTimer = useAppStore((s) => s.publishStageTimer);
  const audioRows = useAppStore((s) => s.data.audio) || [];
  const settings = useAppStore((s) => s.settings);
  const visible = normalizeStageManagerTools(settings.stageManagerTools);
  const pads = useMemo(() => mergeSfxPads(audioRows), [audioRows]);
  const defaultPad = useMemo(
    () => resolveDefaultPad(pads, settings.defaultSfxId, settings.bellStyle),
    [pads, settings.defaultSfxId, settings.bellStyle],
  );
  const holdDing = useHoldDing(defaultPad, settings.bellVolume);
  const playNow = useMemo(
    () => playItemsFromState({
      stagePlay,
      lists: { customSets },
      data: { games: catalogGames, terms: catalogTerms },
    }),
    [stagePlay, customSets, catalogGames, catalogTerms],
  );
  const currentGame = playNow.current?.type === 'game' ? playNow.current.game : null;
  const playing = Boolean(playNow.play && currentGame);
  const timer = stageSlots.timer;
  const running = Boolean(timer?.running) && remainingFromTimer(timer) > 0;
  const suggestions = stageSlots.suggestions;
  const hat = stageSlots.hat;
  const coin = stageSlots.coin;

  const pinToggle = (id, data) => {
    if (data !== undefined && !stagePins.includes(id)) setStageSlot(id, data);
    toggleStagePin(id);
  };

  const startOrPauseTimer = () => {
    const remaining = remainingFromTimer(timer) || TIMER_DEFAULT;
    if (running) {
      publishStageTimer(snapshotTimer(false, remainingFromTimer(timer)));
      return;
    }
    publishStageTimer(snapshotTimer(true, remaining));
  };

  const resetTimer = () => {
    publishStageTimer(snapshotTimer(false, TIMER_DEFAULT));
  };

  const rollHat = () => {
    setStageSlot('hat', rollHatFromPrompts(prompts));
  };

  const flip = () => {
    setStageSlot('coin', flipCoin());
  };

  if (!visible.length) return null;

  const cells = {
    generate: (
      <RunnerCell
        key="generate"
        title="Generate"
        accent="text-lime-400"
        className="col-span-full"
        pinned={stagePins.includes('suggestions')}
        onPin={() => pinToggle('suggestions', suggestions)}
        pinLabel={stagePins.includes('suggestions') ? 'Unpin generate from Stage' : 'Pin generate to Stage'}
      >
        <StageGeneratorTool gameId={playing ? currentGame.id : ''} />
      </RunnerCell>
    ),
    timer: (
      <RunnerCell
        key="timer"
        title="Timer"
        accent="text-cyan-300"
        pinned={stagePins.includes('timer')}
        onPin={() => pinToggle('timer', snapshotTimer(running, remainingFromTimer(timer) || TIMER_DEFAULT))}
        pinLabel={stagePins.includes('timer') ? 'Unpin timer from Stage' : 'Pin timer to Stage'}
      >
        <p className="text-xl font-black font-display tabular-nums text-white leading-none mb-1">
          <LiveStageTime timer={timer} />
        </p>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={startOrPauseTimer}
            className="flex-1 min-h-11 rounded-lg bg-cyan-800 text-white font-bold text-sm inline-flex items-center justify-center gap-1"
            aria-label={running ? 'Pause timer' : 'Start timer'}
          >
            {running ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {running ? 'Pause' : 'Start'}
          </button>
          <button
            type="button"
            onClick={resetTimer}
            className="min-w-11 min-h-11 rounded-lg bg-gray-800 text-gray-200 inline-flex items-center justify-center"
            aria-label="Reset timer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </RunnerCell>
    ),
    hat: (
      <RunnerCell
        key="hat"
        title="Hat"
        accent="text-lime-300"
        pinned={stagePins.includes('hat')}
        onPin={() => pinToggle('hat', hat || rollHatFromPrompts(prompts))}
        pinLabel={stagePins.includes('hat') ? 'Unpin hat from Stage' : 'Pin hat to Stage'}
      >
        <button
          type="button"
          onClick={rollHat}
          className="w-full min-h-11 rounded-lg bg-lime-800 text-white font-bold text-sm inline-flex items-center justify-center gap-1.5"
        >
          <Lightbulb className="w-4 h-4" />
          Roll
        </button>
        {hat ? (
          <p className="text-2xs text-gray-400 mt-1 truncate">{slotSummary('hat', hat)}</p>
        ) : null}
      </RunnerCell>
    ),
    coin: (
      <RunnerCell
        key="coin"
        title="Coin"
        accent="text-amber-300"
        pinned={stagePins.includes('coin')}
        onPin={() => pinToggle('coin', coin || flipCoin())}
        pinLabel={stagePins.includes('coin') ? 'Unpin coin from Stage' : 'Pin coin to Stage'}
      >
        <button
          type="button"
          onClick={flip}
          className="w-full min-h-11 rounded-lg bg-amber-700 text-black font-black text-sm inline-flex items-center justify-center gap-1.5"
        >
          <Coins className="w-4 h-4" />
          Flip
        </button>
        {coin ? (
          <p className="text-sm font-black text-gray-100 mt-1 truncate">{slotSummary('coin', coin)}</p>
        ) : null}
      </RunnerCell>
    ),
    ding: (
      <RunnerCell key="ding" title="Ding" accent="text-yellow-300">
        <button
          type="button"
          {...holdDing}
          className="w-full min-h-11 rounded-lg bg-yellow-500 text-black font-black text-sm inline-flex items-center justify-center gap-1.5 active:scale-95"
          aria-label="Ding, hold to sustain"
        >
          <Bell className="w-4 h-4" />
          Ding
        </button>
      </RunnerCell>
    ),
  };

  return (
    <StageFold id="show" title="Show" boxed summary={visible.length ? `${visible.length} tools` : 'No tools'}>
      <div className={`grid gap-2 ${visible.length === 1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {visible.map((id) => cells[id]).filter(Boolean)}
      </div>
    </StageFold>
  );
}
