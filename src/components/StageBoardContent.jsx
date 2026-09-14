import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  clampStageSize,
  formatStageTime,
  gamePartText,
  isLineSuggestion,
  normalizeStageBoardStyle,
  packStageGrid,
  parseTimerEndMs,
  quotedStageLine,
  remainingFromTimer,
  STAGE_GAME_PARTS,
  STAGE_TIMER_TICK_MS,
  stageTypeScale,
  suggestionLine,
} from '../lib/stage.js';

function useLandscape() {
  const [landscape, setLandscape] = useState(() => (
    typeof window !== 'undefined' ? window.innerWidth >= window.innerHeight : true
  ));
  useEffect(() => {
    const sync = () => setLandscape(window.innerWidth >= window.innerHeight);
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);
  return landscape;
}

function useNow(active) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), STAGE_TIMER_TICK_MS);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

function useStageTimerRemaining(timer) {
  const publishedEnd = parseTimerEndMs(timer);
  const running = Boolean(timer?.running);
  const remainingSnap = Math.max(0, Math.round(Number(timer?.remaining) || 0));
  const fallbackKeyRef = useRef('');
  const fallbackEndRef = useRef(null);

  let endMs = publishedEnd;
  if (running && endMs == null && remainingSnap > 0) {
    const key = `remain:${remainingSnap}`;
    if (fallbackKeyRef.current !== key || fallbackEndRef.current == null) {
      fallbackKeyRef.current = key;
      fallbackEndRef.current = Date.now() + remainingSnap * 1000;
    }
    endMs = fallbackEndRef.current;
  } else {
    fallbackKeyRef.current = '';
    fallbackEndRef.current = null;
  }

  const ticking = running && endMs != null;
  useNow(ticking);
  if (!ticking) return remainingFromTimer(timer, Date.now());
  return Math.max(0, Math.ceil((endMs - Date.now()) / 1000));
}

function StageTileFrame({ children }) {
  const boxRef = useRef(null);
  const innerRef = useRef(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const box = boxRef.current;
    const inner = innerRef.current;
    if (!box || !inner) return undefined;

    let frame = 0;
    const measure = () => {
      const w = box.clientWidth;
      const h = box.clientHeight;
      if (w < 4 || h < 4) return;
      box.style.setProperty('--stage-cqmin', `${Math.min(w, h) / 100}px`);
      inner.style.transform = 'none';
      const iw = Math.max(inner.scrollWidth, inner.offsetWidth, 1);
      const ih = Math.max(inner.scrollHeight, inner.offsetHeight, 1);
      const next = Math.min(1, w / iw, h / ih);
      const clamped = Math.max(0.4, Number.isFinite(next) ? next : 1);
      setScale((prev) => (Math.abs(prev - clamped) < 0.015 ? prev : clamped));
    };
    const apply = () => {
      measure();
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measure);
    };

    const ro = new ResizeObserver(apply);
    ro.observe(box);
    ro.observe(inner);
    apply();
    return () => {
      window.cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, []);

  return (
    <div ref={boxRef} className="stage-tile h-full min-h-0 min-w-0">
      <div
        ref={innerRef}
        className="stage-tile-inner"
        style={scale < 0.995 ? { transform: `scale(${scale})` } : undefined}
      >
        {children}
      </div>
    </div>
  );
}

export function LiveStageTime({ timer, className }) {
  const remaining = useStageTimerRemaining(timer);
  return <span className={className}>{formatStageTime(remaining)}</span>;
}

function InnerCard({ cards, children, className = '' }) {
  if (!cards) return children;
  return (
    <div className={`rounded-2xl bg-[#1A1A1A] border border-white/10 px-3 py-2.5 min-w-0 ${className}`}>
      {children}
    </div>
  );
}

function TileTimer({ timer, scale, cards }) {
  const remaining = useStageTimerRemaining(timer);
  const digits = (
    <p className={`font-black font-display tabular-nums leading-none text-white whitespace-nowrap ${scale.title}`}>
      {formatStageTime(remaining)}
    </p>
  );
  if (!cards) {
    return (
      <div className="h-full min-h-0 flex flex-col items-center justify-center text-center px-2">
        <p className={`mb-2 shrink-0 text-cyan-400 ${scale.kicker}`}>Timer</p>
        {digits}
      </div>
    );
  }
  return (
    <TileShell kicker="Timer" kickerClass="text-cyan-400" scale={scale}>
      <InnerCard cards className="text-center">{digits}</InnerCard>
    </TileShell>
  );
}

function TileShell({ kicker, kickerClass, scale, children }) {
  return (
    <div className="h-full min-h-0 flex flex-col justify-center overflow-hidden px-2 py-1">
      {kicker ? (
        <p className={`mb-1.5 shrink-0 ${scale.kicker} ${kickerClass || 'text-gray-400'}`}>
          {kicker}
        </p>
      ) : null}
      <div className="min-h-0 min-w-0 overflow-hidden">{children}</div>
    </div>
  );
}

function tileTypeScale(count, size) {
  const weight = clampStageSize(size);
  return stageTypeScale(Math.max(1, Math.round(count / weight)));
}

function SuggestionTexts({ item, scale }) {
  const line = isLineSuggestion(item);
  return (item.texts || []).map((entry, index) => {
    const { text, extra } = suggestionLine(entry);
    if (!text) return null;
    return (
      <div key={`${text}-${index}`} className={line ? 'text-center' : undefined}>
        <p
          className={`font-black font-display ${line ? 'italic text-emerald-300' : 'text-white'} ${scale.body}`}
        >
          {line ? quotedStageLine(text) : text}
        </p>
        {extra ? <p className={`text-gray-500 ${scale.caption}`}>{extra}</p> : null}
      </div>
    );
  });
}

function GamePartBlocks({ game, scale }) {
  const selected = Array.isArray(game?.parts) ? game.parts : [];
  if (!selected.length) return null;
  return STAGE_GAME_PARTS.map((part) => {
    if (!selected.includes(part.id)) return null;
    const text = gamePartText(game, part.id);
    if (!text) return null;
    return (
      <div key={part.id} className="mt-2 min-w-0">
        <p className={`mb-0.5 text-gray-500 ${scale.kicker}`}>{part.label}</p>
        <p className={`font-bold text-gray-100 whitespace-pre-wrap ${scale.body}`}>{text}</p>
      </div>
    );
  });
}

export function StageSlotTile({ id, value, count, size = 1, boardStyle }) {
  const scale = tileTypeScale(count, size);
  const cards = normalizeStageBoardStyle(boardStyle) !== 'compact';
  if (id === 'timer') return <TileTimer timer={value} scale={scale} cards={cards} />;

  if (id === 'suggestions') {
    return (
      <TileShell kicker="Suggestions" kickerClass="text-lime-400" scale={scale}>
        <div className="space-y-2 min-w-0">
          {(value || []).map((item, index) => (
            <InnerCard key={`${item.label || 'item'}-${index}`} cards={cards}>
              <p className={`mb-0.5 text-gray-500 ${scale.kicker}`}>{item.label}</p>
              <SuggestionTexts item={item} scale={scale} />
            </InnerCard>
          ))}
        </div>
      </TileShell>
    );
  }

  if (id === 'games') {
    return (
      <TileShell kicker="Games" kickerClass="text-emerald-400" scale={scale}>
        <ul className="space-y-2 min-w-0">
          {(value || []).map((game, index) => (
            <li key={`${game.name}-${index}`} className="min-w-0">
              <InnerCard cards={cards}>
                <p className={`font-black font-display ${scale.title}`}>{game.name}</p>
                {game.category ? (
                  <p className={`text-gray-500 ${scale.kicker}`}>{game.category}</p>
                ) : null}
                <GamePartBlocks game={game} scale={scale} />
              </InnerCard>
            </li>
          ))}
        </ul>
      </TileShell>
    );
  }

  if (id === 'set') {
    return (
      <TileShell kicker="Set" kickerClass="text-indigo-300" scale={scale}>
        <InnerCard cards={cards}>
          <p className={`font-black font-display mb-1 ${scale.title}`}>{value?.name}</p>
          <ul className="space-y-0.5 min-w-0">
            {(value?.games || []).map((name) => (
              <li key={name} className={`font-bold text-gray-100 ${scale.body}`}>
                {name}
              </li>
            ))}
          </ul>
        </InnerCard>
      </TileShell>
    );
  }

  if (id === 'whosup') {
    return (
      <TileShell kicker="Who's up" kickerClass="text-blue-300" scale={scale}>
        <InnerCard cards={cards}>
          <ul className="text-center space-y-1 min-w-0">
            {(value || []).map((name, index) => (
              <li key={`${name}-${index}`} className={`font-black font-display text-blue-100 ${scale.title}`}>
                {name}
              </li>
            ))}
          </ul>
        </InnerCard>
      </TileShell>
    );
  }

  if (id === 'hat') {
    return (
      <TileShell kicker="Hat" kickerClass="text-lime-300" scale={scale}>
        <InnerCard cards={cards}>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 min-w-0">
            {[
              ['Location', value?.location],
              ['Occupation', value?.occupation],
              ['Relationship', value?.relationship],
              ['Object', value?.object],
            ].map(([label, text]) => (
              <div key={label} className="min-w-0">
                <p className={`mb-0.5 text-gray-500 ${scale.kicker}`}>{label}</p>
                <p className={`font-black font-display ${scale.body}`}>{text}</p>
              </div>
            ))}
          </div>
        </InnerCard>
      </TileShell>
    );
  }

  if (id === 'coin') {
    return (
      <TileShell kicker="Coin" kickerClass="text-amber-300" scale={scale}>
        <InnerCard cards={cards} className="text-center">
          <p className={`font-black font-display text-center ${scale.title}`}>{value}</p>
        </InnerCard>
      </TileShell>
    );
  }

  return null;
}

function StageCell({ slot, count, boardStyle, className = '', style }) {
  return (
    <div className={`min-h-0 min-w-0 overflow-hidden border border-white/10 ${className}`} style={style}>
      <StageTileFrame>
        <StageSlotTile id={slot.id} value={slot.value} count={count} size={slot.size} boardStyle={boardStyle} />
      </StageTileFrame>
    </div>
  );
}

export function StageSlotGrid({ slots, layout, boardStyle, className = '' }) {
  const landscape = useLandscape();
  if (!slots?.length) return null;
  const packed = packStageGrid(slots, landscape, layout);
  if (packed.mode === 'pip') {
    const base = packed.placements.find((slot) => !slot.overlay) || packed.placements[0];
    const pip = packed.placements.find((slot) => slot.overlay);
    return (
      <div className={`h-full min-h-0 relative ${className}`}>
        {base ? (
          <StageCell slot={base} count={slots.length} boardStyle={boardStyle} className="absolute inset-0 border-white/10" />
        ) : null}
        {pip ? (
          <StageCell
            slot={pip}
            count={slots.length}
            boardStyle={boardStyle}
            className="absolute right-[2.5%] bottom-[2.5%] w-[32%] h-[32%] border-white/20 bg-black z-10 shadow-2xl"
          />
        ) : null}
      </div>
    );
  }
  return (
    <div
      className={`h-full min-h-0 grid ${className}`}
      style={{
        gridTemplateColumns: `repeat(${packed.cols}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${packed.rows}, minmax(0, 1fr))`,
      }}
    >
      {packed.placements.map((slot) => (
        <StageCell
          key={slot.id}
          slot={slot}
          count={slots.length}
          boardStyle={boardStyle}
          style={{
            gridColumn: `${slot.col} / span ${slot.colSpan}`,
            gridRow: `${slot.row} / span ${slot.rowSpan}`,
          }}
        />
      ))}
    </div>
  );
}
