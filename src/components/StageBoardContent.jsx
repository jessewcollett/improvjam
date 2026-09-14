import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  formatStageTime,
  framesCoverSlots,
  gamePartText,
  isLineSuggestion,
  floatsFromPacked,
  framesFromPacked,
  normalizeStageBoardStyle,
  normalizeStageFloats,
  normalizeStageFrames,
  packStageGrid,
  parseTimerEndMs,
  quotedStageLine,
  remainingFromTimer,
  STAGE_GAME_PARTS,
  STAGE_TIMER_TICK_MS,
  compactStageUrl,
  stageIdeasJoinUrl,
  stageMessageText,
  stageTypeScale,
  suggestionLine,
} from '../lib/stage.js';
import StageQrCode from './StageQrCode.jsx';

const StageTileContext = createContext({ landscape: false, align: 'center', showCaptions: true });
const TILE_LANDSCAPE_RATIO = 1.65;
const TILE_SCALE_FLOOR = 0.25;
const TILE_FONT_MIN = 0.55;
const TILE_FONT_MAX = 1.9;
const TILE_FILL = 0.88;
const TILE_FONT_STEPS = 8;

function useTileAlign() {
  return useContext(StageTileContext).align === 'left' ? 'left' : 'center';
}

function useShowCaptions() {
  return useContext(StageTileContext).showCaptions !== false;
}

function alignText(align) {
  return align === 'left' ? 'text-left' : 'text-center';
}

function alignItems(align) {
  return align === 'left' ? 'items-start' : 'items-center';
}

function useTileLandscape() {
  return useContext(StageTileContext).landscape;
}

function siblingColumns(count, landscape) {
  return Boolean(landscape && count >= 2);
}

function siblingBoxClass(columns, stacked = 'gap-3') {
  return columns
    ? 'grid grid-cols-2 gap-3 min-w-0 h-full auto-rows-fr'
    : `h-full min-h-0 flex flex-col ${stacked} min-w-0`;
}

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

function StageTileFrame({ children, allowColumns = true, fitKey = '', align = 'center', showCaptions = true }) {
  const boxRef = useRef(null);
  const innerRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [landscape, setLandscape] = useState(false);
  const resolvedAlign = align === 'left' ? 'left' : 'center';

  useLayoutEffect(() => {
    const box = boxRef.current;
    const inner = innerRef.current;
    if (!box || !inner) return undefined;

    const contentFits = (maxW, maxH) => {
      const iw = Math.max(inner.scrollWidth, inner.offsetWidth, 1);
      const ih = Math.max(inner.scrollHeight, inner.offsetHeight, 1);
      return iw <= maxW + 1 && ih <= maxH + 1;
    };

    const measure = () => {
      const w = box.clientWidth;
      const h = box.clientHeight;
      if (w < 4 || h < 4) return;
      box.style.setProperty('--stage-cqmin', `${Math.min(w, h) / 100}px`);
      const nextLandscape = allowColumns && w >= h * TILE_LANDSCAPE_RATIO;
      setLandscape((prev) => (prev === nextLandscape ? prev : nextLandscape));
      inner.style.transform = 'none';
      const targetW = w * TILE_FILL;
      const targetH = h * TILE_FILL;
      let lo = TILE_FONT_MIN;
      let hi = TILE_FONT_MAX;
      box.style.setProperty('--stage-font', String(TILE_FONT_MAX));
      if (contentFits(targetW, targetH)) {
        lo = TILE_FONT_MAX;
      } else {
        for (let i = 0; i < TILE_FONT_STEPS; i += 1) {
          const mid = (lo + hi) / 2;
          box.style.setProperty('--stage-font', String(mid));
          if (contentFits(targetW, targetH)) lo = mid;
          else hi = mid;
        }
      }
      box.style.setProperty('--stage-font', String(lo));
      const iw = Math.max(inner.scrollWidth, inner.offsetWidth, 1);
      const ih = Math.max(inner.scrollHeight, inner.offsetHeight, 1);
      const shrink = Math.min(1, w / iw, h / ih);
      const clamped = Math.max(TILE_SCALE_FLOOR, Number.isFinite(shrink) ? shrink : 1);
      setScale((prev) => (Math.abs(prev - clamped) < 0.015 ? prev : clamped));
    };

    const ro = new ResizeObserver(measure);
    ro.observe(box);
    measure();
    return () => ro.disconnect();
  }, [allowColumns, fitKey]);

  return (
    <StageTileContext.Provider value={{ landscape, align: resolvedAlign, showCaptions: showCaptions !== false }}>
      <div
        ref={boxRef}
        className={`stage-tile h-full min-h-0 min-w-0 flex ${
          resolvedAlign === 'left' ? 'items-start justify-start' : 'items-center justify-center'
        }`}
      >
        <div
          ref={innerRef}
          className={`stage-tile-inner ${resolvedAlign === 'left' ? 'w-full' : ''}`}
          style={scale < 0.995 ? { transform: `scale(${scale})` } : undefined}
        >
          {children}
        </div>
      </div>
    </StageTileContext.Provider>
  );
}

export function LiveStageTime({ timer, className }) {
  const remaining = useStageTimerRemaining(timer);
  return <span className={className}>{formatStageTime(remaining)}</span>;
}

function InnerCard({ cards, children, className = '' }) {
  const align = useTileAlign();
  const fill = `min-w-0 min-h-0 h-full flex-1 flex flex-col justify-center ${alignItems(align)} ${alignText(align)}`;
  if (!cards) return <div className={`${fill} ${className}`}>{children}</div>;
  return (
    <div className={`rounded-2xl bg-[#1A1A1A] border border-white/10 px-3 py-2.5 ${fill} ${className}`}>
      {children}
    </div>
  );
}

function TileTimer({ timer, scale, cards }) {
  const remaining = useStageTimerRemaining(timer);
  const align = useTileAlign();
  const digits = (
    <p className={`font-black font-display tabular-nums leading-none text-white whitespace-nowrap ${scale.title}`}>
      {formatStageTime(remaining)}
    </p>
  );
  if (!cards) {
    return (
      <div className={`h-full min-h-0 flex flex-col justify-center px-2 ${alignItems(align)} ${alignText(align)}`}>
        <p className={`mb-2 shrink-0 text-cyan-400 ${scale.kicker}`}>Timer</p>
        {digits}
      </div>
    );
  }
  return (
    <TileShell kicker="Timer" kickerClass="text-cyan-400" scale={scale}>
      <InnerCard cards>{digits}</InnerCard>
    </TileShell>
  );
}

function TileShell({ kicker, kickerClass, scale, children }) {
  const align = useTileAlign();
  return (
    <div className="h-full min-h-0 flex flex-col overflow-hidden px-3 py-2">
      {kicker ? (
        <p className={`mb-2 shrink-0 ${alignText(align)} ${scale.kicker} ${kickerClass || 'text-gray-400'}`}>
          {kicker}
        </p>
      ) : null}
      <div className="flex-1 min-h-0 min-w-0 flex flex-col justify-center">{children}</div>
    </div>
  );
}

function tileTypeScale(count) {
  return stageTypeScale(Math.max(1, count));
}

function SuggestionTexts({ item, scale }) {
  const line = isLineSuggestion(item);
  const landscape = useTileLandscape();
  const align = useTileAlign();
  const showCaptions = useShowCaptions();
  const entries = (item.texts || [])
    .map((entry, index) => ({ ...suggestionLine(entry), index }))
    .filter((row) => row.text);
  const columns = line && siblingColumns(entries.length, landscape);
  if (!entries.length) return null;
  return (
    <div className={siblingBoxClass(columns)}>
      {entries.map((row) => (
        <div key={`${row.text}-${row.index}`} className={`min-w-0 ${alignText(align)}`}>
          <p
            className={`font-black font-display break-words ${line ? 'italic text-emerald-300' : 'text-white'} ${scale.body}`}
          >
            {line ? quotedStageLine(row.text) : row.text}
          </p>
          {showCaptions && row.extra ? <p className={`text-gray-500 break-words ${scale.caption}`}>{row.extra}</p> : null}
        </div>
      ))}
    </div>
  );
}

function GamePartBlocks({ game, scale }) {
  const selected = Array.isArray(game?.parts) ? game.parts : [];
  const align = useTileAlign();
  if (!selected.length) return null;
  return STAGE_GAME_PARTS.map((part) => {
    if (!selected.includes(part.id)) return null;
    const text = gamePartText(game, part.id);
    if (!text) return null;
    return (
      <div key={part.id} className={`mt-2 min-w-0 ${alignText(align)}`}>
        <p className={`mb-0.5 text-gray-500 ${scale.kicker}`}>{part.label}</p>
        <p className={`font-bold text-gray-100 whitespace-pre-wrap break-words ${scale.body}`}>{text}</p>
      </div>
    );
  });
}

export function StageSlotTile({ id, value, count, boardStyle }) {
  const scale = tileTypeScale(count);
  const cards = normalizeStageBoardStyle(boardStyle) !== 'compact';
  const landscape = useTileLandscape();
  const align = useTileAlign();
  const showCaptions = useShowCaptions();
  if (id === 'timer') return <TileTimer timer={value} scale={scale} cards={cards} />;

  if (id === 'suggestions') {
    const items = value || [];
    return (
      <TileShell kicker="Suggestions" kickerClass="text-lime-400" scale={scale}>
        <div className={siblingBoxClass(siblingColumns(items.length, landscape))}>
          {items.map((item, index) => (
            <InnerCard key={`${item.label || 'item'}-${index}`} cards={cards}>
              <p className={`mb-1 text-gray-500 ${scale.kicker}`}>{item.label}</p>
              <SuggestionTexts item={item} scale={scale} />
            </InnerCard>
          ))}
        </div>
      </TileShell>
    );
  }

  if (id === 'games') {
    const games = value || [];
    return (
      <TileShell kicker="Games" kickerClass="text-emerald-400" scale={scale}>
        <ul className={siblingBoxClass(siblingColumns(games.length, landscape))}>
          {games.map((game, index) => (
            <li key={`${game.name}-${index}`} className="min-w-0 min-h-0 h-full">
              <InnerCard cards={cards}>
                <p className={`font-black font-display break-words ${scale.title}`}>{game.name}</p>
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
    const games = value?.games || [];
    return (
      <TileShell kicker="Set" kickerClass="text-indigo-300" scale={scale}>
        <InnerCard cards={cards}>
          <p className={`font-black font-display break-words mb-1 ${scale.title}`}>{value?.name}</p>
          <ul className={siblingBoxClass(siblingColumns(games.length, landscape), 'gap-0.5')}>
            {games.map((name) => (
              <li key={name} className={`font-bold text-gray-100 break-words ${scale.body}`}>
                {name}
              </li>
            ))}
          </ul>
        </InnerCard>
      </TileShell>
    );
  }

  if (id === 'whosup') {
    const names = value || [];
    return (
      <TileShell kicker="Who's up" kickerClass="text-blue-300" scale={scale}>
        <InnerCard cards={cards}>
          <ul className={`${alignText(align)} ${siblingBoxClass(siblingColumns(names.length, landscape), 'gap-1')}`}>
            {names.map((name, index) => (
              <li key={`${name}-${index}`} className={`font-black font-display break-words text-blue-100 ${scale.title}`}>
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
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 min-w-0 h-full">
            {[
              ['Location', value?.location],
              ['Occupation', value?.occupation],
              ['Relationship', value?.relationship],
              ['Object', value?.object],
            ].map(([label, text]) => (
              <div key={label} className={`min-w-0 ${alignText(align)}`}>
                <p className={`mb-0.5 text-gray-500 ${scale.kicker}`}>{label}</p>
                <p className={`font-black font-display break-words ${scale.body}`}>{text}</p>
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
        <InnerCard cards={cards}>
          <p className={`font-black font-display break-words ${scale.title}`}>{value}</p>
        </InnerCard>
      </TileShell>
    );
  }

  if (id === 'message') {
    const text = stageMessageText(value);
    if (!text) return null;
    return (
      <TileShell kicker="Message" kickerClass="text-lime-300" scale={scale}>
        <InnerCard cards={cards}>
          <p className={`font-black font-display break-words ${scale.title}`}>{text}</p>
        </InnerCard>
      </TileShell>
    );
  }

  if (id === 'display') {
    const url = String(value?.url || '').trim();
    const code = String(value?.code || '').trim();
    const joinUrl = compactStageUrl(stageIdeasJoinUrl());
    const stacked = !siblingColumns(2, landscape);
    return (
      <TileShell kicker="Ideas" kickerClass="text-lime-400" scale={scale}>
        <div className={stacked
          ? `h-full min-h-0 flex flex-col justify-center gap-3 ${alignItems(align)}`
          : 'h-full min-h-0 flex items-center gap-4 min-w-0'}
        >
          <StageQrCode
            value={url}
            label="Audience ideas QR code"
            className="w-[min(100%,11rem)] aspect-square rounded-xl overflow-hidden shrink-0"
          />
          <div className={`min-w-0 ${alignText(align)}`}>
            <p className={`font-black font-display tracking-[0.18em] ${scale.title}`}>{code}</p>
            {showCaptions ? (
              <>
                <p className={`text-gray-400 mt-1 ${scale.caption}`}>
                  Scan to send ideas, or type this code here:
                </p>
                <p className={`text-gray-300 break-all mt-0.5 ${scale.caption}`}>{joinUrl}</p>
              </>
            ) : null}
          </div>
        </div>
      </TileShell>
    );
  }

  return null;
}

function StageCell({ slot, count, boardStyle, className = '', style, allowColumns = true }) {
  const align = slot?.align === 'left' ? 'left' : 'center';
  const showCaptions = slot?.captions !== false;
  return (
    <div className={`min-h-0 min-w-0 overflow-hidden border border-white/10 ${className}`} style={style}>
      <StageTileFrame
        allowColumns={allowColumns}
        align={align}
        showCaptions={showCaptions}
        fitKey={`${slot.id}|${count}|${boardStyle}|${align}|${showCaptions}|${JSON.stringify(slot.value)}`}
      >
        <StageSlotTile id={slot.id} value={slot.value} count={count} boardStyle={boardStyle} />
      </StageTileFrame>
    </div>
  );
}

export function StageSlotGrid({ slots, layout, boardStyle, frames, floats, className = '' }) {
  const landscape = useLandscape();
  if (!slots?.length) return null;
  const fromSlots = {};
  slots.forEach((slot) => {
    if (slot?.frame) fromSlots[slot.id] = slot.frame;
  });
  const packed = packStageGrid(slots, landscape, layout);
  const packedFrames = framesFromPacked(packed);
  const packedFloats = floatsFromPacked(packed);
  const frameMap = { ...packedFrames, ...fromSlots, ...normalizeStageFrames(frames) };
  const ids = slots.map((slot) => slot.id);
  const floatIds = normalizeStageFloats(
    Array.isArray(floats) ? floats : packedFloats,
    ids,
  );
  const floatSet = new Set(floatIds);
  const docked = slots.filter((slot) => !floatSet.has(slot.id));
  const floating = slots.filter((slot) => floatSet.has(slot.id));
  const useFrames = framesCoverSlots(frameMap, ids);

  if (useFrames) {
    return (
      <div className={`h-full min-h-0 relative isolate ${className}`}>
        {docked.map((slot) => {
          const frame = frameMap[slot.id];
          return (
            <StageCell
              key={slot.id}
              slot={slot}
              count={slots.length}
              boardStyle={boardStyle}
              className="absolute z-0 border-white/10 bg-stage"
              style={{
                left: `${frame.x}%`,
                top: `${frame.y}%`,
                width: `${frame.w}%`,
                height: `${frame.h}%`,
              }}
            />
          );
        })}
        {floating.map((slot) => {
          const frame = frameMap[slot.id];
          return (
            <StageCell
              key={slot.id}
              slot={slot}
              count={slots.length}
              boardStyle={boardStyle}
              className="absolute border-white/20 bg-stage z-20 shadow-2xl"
              allowColumns={false}
              style={{
                left: `${frame.x}%`,
                top: `${frame.y}%`,
                width: `${frame.w}%`,
                height: `${frame.h}%`,
              }}
            />
          );
        })}
      </div>
    );
  }

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
            className="absolute right-[2.5%] bottom-[2.5%] w-[32%] h-[32%] border-white/20 bg-stage z-10 shadow-2xl"
            allowColumns={false}
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
