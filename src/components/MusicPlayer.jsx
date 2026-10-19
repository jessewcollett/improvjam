import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpDown,
  Check,
  ListFilter,
  Music,
  Pause,
  Play,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Square,
  Volume2,
  X,
} from 'lucide-react';
import {
  clampFadeSeconds,
  connectMediaElement,
  fadeGainExponential,
  onAudioCtxRebuild,
  setGainLevel,
} from '../lib/audio.js';
import { UNTAGGED_FILTER, tagsForTrack, uniqueTags } from '../lib/music.js';
import { useAppStore } from '../store/useAppStore.js';

const GO_DEBOUNCE_MS = 400;

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function Credit({ track }) {
  if (!track?.credit) return null;
  if (track.creditUrl) {
    return (
      <a
        href={track.creditUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-xs font-medium text-blue-400"
      >
        {track.credit}
      </a>
    );
  }
  return <span className="text-xs font-medium text-gray-500">{track.credit}</span>;
}

function TagPills({ tags, selected, onToggle, emptyLabel }) {
  if (!tags.length) {
    return emptyLabel ? <p className="text-2xs text-gray-500">{emptyLabel}</p> : null;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((tag) => {
        const on = selected?.some((item) => item.toLowerCase() === tag.toLowerCase());
        return (
          <button
            key={tag}
            type="button"
            onClick={() => onToggle(tag)}
            className={`min-h-11 px-3 rounded-full border text-2xs font-bold ${
              on
                ? 'bg-fuchsia-600 text-white border-fuchsia-400'
                : 'bg-[#1A1A1A] text-gray-300 border-gray-700'
            }`}
          >
            {tag}
          </button>
        );
      })}
    </div>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-3 py-2 rounded-full text-sm font-medium min-h-11 border ${
        active ? 'bg-fuchsia-600 text-white border-fuchsia-300 shadow-md' : 'bg-gray-800 text-gray-300 border-gray-700'
      }`}
    >
      {active ? <Check className="w-3.5 h-3.5" /> : null}
      {children}
    </button>
  );
}

function MusicFilters({
  filtersOpen,
  onToggleOpen,
  sortOpen,
  onToggleSort,
  tagFilters,
  tagOptions,
  sortBy,
  onSort,
  onToggleFilter,
  onClear,
}) {
  const filterActive = tagFilters.length > 0;
  const filterLabels = tagFilters.map((tag) => (tag === UNTAGGED_FILTER ? 'Untagged' : tag));
  const summary = [...(sortBy === 'tag' ? ['Tag'] : []), ...filterLabels];

  return (
    <div className="shrink-0 mb-2">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={onToggleOpen}
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-bold min-h-11 border ${
            filterActive
              ? 'bg-fuchsia-600/20 text-fuchsia-200 border-fuchsia-400'
              : 'bg-gray-800 text-gray-300 border-gray-700'
          }`}
          aria-expanded={filtersOpen}
        >
          <ListFilter className="w-4 h-4" />
          Filter
          {filterActive ? (
            <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-fuchsia-600 text-white text-xs">
              {tagFilters.length}
            </span>
          ) : null}
        </button>
        <button
          type="button"
          onClick={onToggleSort}
          className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-bold min-h-11 border ${
            sortOpen
              ? 'bg-fuchsia-600/20 text-fuchsia-200 border-fuchsia-400'
              : 'bg-gray-800 text-gray-300 border-gray-700'
          }`}
          aria-expanded={sortOpen}
        >
          <ArrowUpDown className="w-4 h-4" />
          Sort
        </button>
        {filterActive ? (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-bold min-h-11 border border-gray-700 bg-gray-800 text-gray-200"
          >
            <X className="w-4 h-4" />
            Clear filters
          </button>
        ) : null}
        {summary.length && !filtersOpen && !sortOpen ? (
          <span className="text-xs font-semibold text-fuchsia-300 min-w-0">{summary.join(' · ')}</span>
        ) : null}
      </div>

      {sortOpen ? (
        <div className="mt-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Sort by</p>
          <div className="flex flex-wrap gap-2">
            <Chip active={sortBy === 'name'} onClick={() => onSort('name')}>
              Name
            </Chip>
            <Chip active={sortBy === 'tag'} onClick={() => onSort('tag')}>
              Tag
            </Chip>
          </div>
        </div>
      ) : null}

      {filtersOpen ? (
        <div className="mt-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Tags</p>
          <div className="flex flex-wrap gap-2">
            <Chip
              active={tagFilters.some((item) => item === UNTAGGED_FILTER)}
              onClick={() => onToggleFilter(UNTAGGED_FILTER)}
            >
              Untagged
            </Chip>
            {tagOptions.map((tag) => (
              <Chip
                key={tag}
                active={tagFilters.some((item) => item.toLowerCase() === tag.toLowerCase())}
                onClick={() => onToggleFilter(tag)}
              >
                {tag}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function MusicPlayer({ tracks, randomRef, controlsRef, fadeSeconds }) {
  const musicTags = useAppStore((s) => s.musicTags);
  const toggleMusicTag = useAppStore((s) => s.toggleMusicTag);
  const audioRef = useRef(null);
  const graphRef = useRef(null);
  const fadeTokenRef = useRef(0);
  const volumeRef = useRef(0.85);
  const loopRef = useRef(false);
  const shuffleRef = useRef(false);
  const playRandomRef = useRef(() => {});
  const goAtRef = useRef(0);
  const restoreRef = useRef(null);
  const loadedUrlRef = useRef('');
  const [audioGen, setAudioGen] = useState(0);
  const [activeId, setActiveId] = useState(tracks[0]?.id || '');
  const [loadedId, setLoadedId] = useState(tracks[0]?.id || '');
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [tagFilters, setTagFilters] = useState([]);
  const [sortBy, setSortBy] = useState('name');
  const [customTag, setCustomTag] = useState('');
  const [tagging, setTagging] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [volumeOpen, setVolumeOpen] = useState(false);
  volumeRef.current = volume;
  loopRef.current = loop;
  shuffleRef.current = shuffle;

  const taggedTracks = useMemo(
    () => tracks.map((track) => ({ ...track, displayTags: tagsForTrack(track, musicTags) })),
    [tracks, musicTags],
  );

  const tagOptions = useMemo(
    () => uniqueTags(taggedTracks.flatMap((track) => track.displayTags)).sort((a, b) => a.localeCompare(b)),
    [taggedTracks],
  );

  const visibleTracks = useMemo(() => {
    const filtered = taggedTracks.filter((track) => {
      if (!tagFilters.length) return true;
      const untagged = tagFilters.includes(UNTAGGED_FILTER) && !track.displayTags.length;
      const tagged = tagFilters.some(
        (filter) => filter !== UNTAGGED_FILTER && track.displayTags.some((tag) => tag.toLowerCase() === filter.toLowerCase()),
      );
      return untagged || tagged;
    });
    return [...filtered].sort((a, b) => {
      if (sortBy === 'tag') {
        const ta = a.displayTags[0] || 'zzzz';
        const tb = b.displayTags[0] || 'zzzz';
        const byTag = ta.localeCompare(tb);
        if (byTag) return byTag;
      }
      return a.name.localeCompare(b.name);
    });
  }, [taggedTracks, tagFilters, sortBy]);

  const active = taggedTracks.find((track) => track.id === activeId) || visibleTracks[0] || taggedTracks[0] || null;
  const loaded = taggedTracks.find((track) => track.id === loadedId) || active;
  const display = playing ? loaded : active;
  const remaining = Math.max(0, (duration || 0) - (current || 0));
  const activeIndex = visibleTracks.findIndex((track) => track.id === active?.id);
  const showPause = playing && loadedId === activeId;
  loadedUrlRef.current = loaded?.playUrl || '';

  const ensureGraph = useCallback(() => {
    const el = audioRef.current;
    if (!el) return null;
    if (graphRef.current?.el === el) return graphRef.current;
    try {
      el.volume = 1;
      const graph = connectMediaElement(el, volumeRef.current);
      graphRef.current = { ...graph, el };
      return graphRef.current;
    } catch {
      return graphRef.current;
    }
  }, []);

  useEffect(() => {
    if (activeId && taggedTracks.some((track) => track.id === activeId)) return;
    const fallback = visibleTracks[0]?.id || taggedTracks[0]?.id || '';
    setActiveId(fallback);
    setLoadedId((id) => (id && taggedTracks.some((track) => track.id === id) ? id : fallback));
  }, [taggedTracks, visibleTracks, activeId]);

  useEffect(() => onAudioCtxRebuild(() => {
    const el = audioRef.current;
    restoreRef.current = {
      src: loadedUrlRef.current || el?.currentSrc || '',
      time: el?.currentTime || 0,
    };
    graphRef.current = null;
    setAudioGen((n) => n + 1);
  }), []);

  useEffect(() => {
    const node = audioRef.current;
    if (node) {
      node.volume = 1;
      node.loop = loop;
    }
  }, [loop, audioGen]);

  const onAudioTime = (event) => {
    setCurrent(event.currentTarget.currentTime || 0);
  };

  const onAudioMeta = (event) => {
    const next = event.currentTarget.duration;
    setDuration(Number.isFinite(next) ? next : 0);
  };

  const onAudioEnded = () => {
    if (loopRef.current) return;
    if (shuffleRef.current) {
      playRandomRef.current();
      return;
    }
    setPlaying(false);
  };

  useEffect(() => {
    setGainLevel(graphRef.current?.gain, volume);
  }, [volume]);

  const srcMatches = (node, url) => {
    if (!node || !url) return false;
    if (node.getAttribute('src') === url) return true;
    try {
      return node.currentSrc === new URL(url, window.location.href).href;
    } catch {
      return false;
    }
  };

  const playTrack = useCallback(async (track) => {
    const node = audioRef.current;
    if (!node || !track?.playUrl) return;
    fadeTokenRef.current += 1;
    if (loadedId !== track.id) setLoadedId(track.id);
    if (activeId !== track.id) setActiveId(track.id);
    if (!srcMatches(node, track.playUrl)) {
      node.src = track.playUrl;
      node.load();
    }
    node.volume = 1;
    ensureGraph();
    setGainLevel(graphRef.current?.gain, volumeRef.current);
    try {
      await node.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  }, [activeId, ensureGraph, loadedId]);

  useEffect(() => {
    const node = audioRef.current;
    const pending = restoreRef.current;
    restoreRef.current = null;
    const url = pending?.src || loaded?.playUrl;
    if (!node || !url) return;
    if (!pending && srcMatches(node, url)) return;
    fadeTokenRef.current += 1;
    node.pause();
    node.volume = 1;
    node.src = url;
    node.load();
    setPlaying(false);
    setCurrent(pending?.time || 0);
    if (pending?.time) {
      const seek = () => {
        try {
          node.currentTime = pending.time;
        } catch {
          /* ignore */
        }
      };
      if (node.readyState >= 1) seek();
      else node.addEventListener('loadedmetadata', seek, { once: true });
    }
  }, [loaded?.playUrl, audioGen]);

  const stopNow = useCallback(() => {
    fadeTokenRef.current += 1;
    const node = audioRef.current;
    if (!node) return;
    node.pause();
    try {
      node.currentTime = 0;
    } catch {
      /* ignore */
    }
    setGainLevel(graphRef.current?.gain, volumeRef.current);
    setPlaying(false);
    setCurrent(0);
  }, []);

  const fadeOut = useCallback(() => {
    const node = audioRef.current;
    if (!node || node.paused) return;
    const graph = ensureGraph();
    const token = fadeTokenRef.current + 1;
    fadeTokenRef.current = token;
    const fadeSec = fadeGainExponential(graph?.gain, fadeSeconds) || clampFadeSeconds(fadeSeconds);
    window.setTimeout(() => {
      if (token !== fadeTokenRef.current) return;
      node.pause();
      try {
        node.currentTime = 0;
      } catch {
        /* ignore */
      }
      setGainLevel(graph?.gain, volumeRef.current);
      setPlaying(false);
      setCurrent(0);
    }, fadeSec * 1000 + 40);
  }, [ensureGraph, fadeSeconds]);

  const toggle = useCallback(async () => {
    const node = audioRef.current;
    if (!active?.playUrl) return;
    if (playing && loadedId === activeId) {
      fadeTokenRef.current += 1;
      node?.pause();
      setPlaying(false);
      return;
    }
    const now = Date.now();
    if (now - goAtRef.current < GO_DEBOUNCE_MS) return;
    goAtRef.current = now;
    await playTrack(active);
  }, [active, activeId, loadedId, playTrack, playing]);

  const playRandom = useCallback(() => {
    const pool = visibleTracks.filter((track) => track.id !== loadedId && track.playUrl);
    const source = pool.length ? pool : visibleTracks.filter((track) => track.playUrl);
    if (!source.length) return;
    const next = source[Math.floor(Math.random() * source.length)];
    playTrack(next);
  }, [visibleTracks, loadedId, playTrack]);
  playRandomRef.current = playRandom;

  const stepStandby = (dir) => {
    if (!visibleTracks.length) return;
    const index = activeIndex < 0 ? 0 : (activeIndex + dir + visibleTracks.length) % visibleTracks.length;
    setActiveId(visibleTracks[index].id);
  };

  const toggleShuffle = () => {
    if (!shuffle) playRandom();
    setShuffle((on) => !on);
  };

  useEffect(() => {
    const controls = { random: playRandom, fade: fadeOut, stop: stopNow, toggle };
    if (randomRef) randomRef.current = playRandom;
    if (controlsRef) controlsRef.current = controls;
    return () => {
      if (randomRef) randomRef.current = null;
      if (controlsRef) controlsRef.current = null;
    };
  }, [randomRef, controlsRef, playRandom, fadeOut, stopNow, toggle]);

  const toggleFilter = (tag) => {
    setTagFilters((current) =>
      current.some((item) => item.toLowerCase() === tag.toLowerCase())
        ? current.filter((item) => item.toLowerCase() !== tag.toLowerCase())
        : [...current, tag],
    );
  };

  const addCustomTag = () => {
    const next = customTag.trim();
    if (!active || !next) return;
    toggleMusicTag(active.id, next, active.tags);
    setCustomTag('');
  };

  if (!tracks.length) {
    return (
      <section className="bg-card border border-gray-800 rounded-2xl p-4 h-full">
        <h2 className="text-lg font-black font-display text-fuchsia-300 flex items-center mb-2">
          <Music className="w-5 h-5 mr-2" />
          Music
        </h2>
        <p className="text-sm text-gray-400">
          No tracks yet. Submit music from Settings, or sync the catalog.
        </p>
      </section>
    );
  }

  return (
    <section className="bg-card border border-gray-800 rounded-2xl p-3 h-full min-h-0 flex flex-col">
      <h2 className="text-base font-black font-display text-fuchsia-300 flex items-center mb-1.5 shrink-0">
        <Music className="w-4 h-4 mr-2" />
        Music
      </h2>
      <audio
        key={audioGen}
        ref={audioRef}
        preload="metadata"
        playsInline
        onTimeUpdate={onAudioTime}
        onDurationChange={onAudioMeta}
        onLoadedMetadata={onAudioMeta}
        onEnded={onAudioEnded}
      />

      <div className="flex-1 min-h-0 flex flex-col md:flex-row md:gap-4 overflow-hidden">
        <div className="flex-1 min-h-0 min-w-0 flex flex-col">
          <MusicFilters
            filtersOpen={filtersOpen}
            onToggleOpen={() => {
              setFiltersOpen((v) => !v);
              setSortOpen(false);
            }}
            sortOpen={sortOpen}
            onToggleSort={() => {
              setSortOpen((v) => !v);
              setFiltersOpen(false);
            }}
            tagFilters={tagFilters}
            tagOptions={tagOptions}
            sortBy={sortBy}
            onSort={setSortBy}
            onToggleFilter={toggleFilter}
            onClear={() => setTagFilters([])}
          />

          <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide space-y-1 mb-2 md:mb-0">
            {visibleTracks.length ? (
              visibleTracks.map((track) => {
                const selected = active?.id === track.id;
                const live = loaded?.id === track.id && playing;
                const missing = !track.playUrl;
                const tagsLabel = track.displayTags.length ? track.displayTags.join(', ') : 'No tags';
                return (
                  <button
                    key={track.id}
                    type="button"
                    onClick={() => setActiveId(track.id)}
                    className={`w-full text-left rounded-lg border px-3 min-h-11 flex items-center ${
                      missing
                        ? 'bg-red-950/50 border-red-600 text-red-100'
                        : live
                          ? 'bg-emerald-800/40 border-emerald-400 text-white'
                          : selected
                            ? 'bg-amber-800/40 border-amber-400 text-white'
                            : 'bg-[#1A1A1A] border-gray-800 text-gray-200'
                    }`}
                  >
                    <span className="block w-full min-w-0 text-sm leading-tight truncate">
                      <span className="font-bold">{track.name}</span>
                      <span className={`font-semibold ${track.displayTags.length ? 'text-fuchsia-200/80' : 'text-gray-500'}`}>
                        {' '}
                        — {tagsLabel}
                      </span>
                      {track.credit ? <span className="font-medium text-gray-500"> — {track.credit}</span> : null}
                    </span>
                  </button>
                );
              })
            ) : (
              <p className="text-sm text-gray-500 px-1">No tracks with these tags. Clear filters or tag a track.</p>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-gray-800 pt-2 bg-card md:border-t-0 md:border-l md:pl-3 md:pt-0 md:w-64 lg:w-72 md:overflow-y-auto scrollbar-hide">
        <p className="text-sm font-black font-display text-white leading-tight truncate">
          {display?.name}
          {display?.credit ? (
            <span className="font-sans font-medium">
              {' '}
              — <Credit track={display} />
            </span>
          ) : null}
        </p>
        {playing && active?.id && active.id !== loaded?.id ? (
          <p className="text-xs font-bold text-amber-300 mt-1">Standby · {active.name}</p>
        ) : null}
        {!active?.playUrl ? (
          <p className="text-xs font-bold text-red-300 mt-1">Missing audio file</p>
        ) : null}

        <p className="text-4xl font-black font-display tabular-nums text-white leading-none mt-2 mb-1">
          {formatTime(remaining)}
          <span className="text-xs font-bold text-gray-500 ml-2 align-middle">{formatTime(current)} / {formatTime(duration)}</span>
        </p>

        <div className="flex items-center gap-2">
          <input
            type="range"
            min="0"
            max={duration || 0}
            step="0.1"
            value={Math.min(current, duration || 0)}
            onChange={(e) => {
              const next = Number(e.target.value);
              if (audioRef.current) audioRef.current.currentTime = next;
              setCurrent(next);
            }}
            className="flex-1 accent-fuchsia-500 min-h-11"
            aria-label="Seek"
          />
        </div>

        <button
          type="button"
          onClick={toggle}
          disabled={!active?.playUrl}
          className="w-full min-h-14 mb-1.5 rounded-2xl bg-fuchsia-600 text-white font-black text-xl tracking-wide inline-flex items-center justify-center gap-2 disabled:opacity-40"
        >
          {showPause ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
          {showPause ? 'Pause' : 'GO'}
        </button>

        <div className="flex gap-1.5 mb-1">
          <button
            type="button"
            onClick={() => stepStandby(-1)}
            disabled={visibleTracks.length < 2}
            className="min-w-11 min-h-11 rounded-xl border bg-gray-800 text-gray-100 border-gray-700 inline-flex items-center justify-center disabled:text-gray-600"
            aria-label="Previous standby track"
          >
            <SkipBack className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => stepStandby(1)}
            disabled={visibleTracks.length < 2}
            className="min-w-11 min-h-11 rounded-xl border bg-gray-800 text-gray-100 border-gray-700 inline-flex items-center justify-center disabled:text-gray-600"
            aria-label="Next standby track"
          >
            <SkipForward className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={toggleShuffle}
            className={`flex-1 min-h-11 px-2.5 rounded-xl border inline-flex items-center justify-center gap-1 font-bold ${
              shuffle ? 'bg-fuchsia-600 text-white border-fuchsia-400' : 'bg-gray-800 text-gray-100 border-gray-700'
            }`}
            aria-pressed={shuffle}
            aria-label="Shuffle within filtered tracks"
          >
            <Shuffle className="w-4 h-4" />
            <span className="text-xs hidden md:inline">Shuffle</span>
          </button>
          <button
            type="button"
            onClick={() => setLoop((v) => !v)}
            className={`min-w-11 min-h-11 rounded-xl border inline-flex items-center justify-center ${
              loop ? 'bg-fuchsia-600 text-white border-fuchsia-400' : 'bg-gray-800 text-gray-300 border-gray-700'
            }`}
            aria-pressed={loop}
            aria-label="Loop"
          >
            <Repeat className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setVolumeOpen((v) => !v)}
            className={`min-w-11 min-h-11 rounded-xl border inline-flex items-center justify-center ${
              volumeOpen ? 'bg-fuchsia-600 text-white border-fuchsia-400' : 'bg-gray-800 text-gray-300 border-gray-700'
            }`}
            aria-pressed={volumeOpen}
            aria-label="Volume"
          >
            <Volume2 className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1.5 mb-1">
          <button
            type="button"
            onClick={fadeOut}
            className="min-h-11 rounded-xl border border-fuchsia-800/60 bg-[#1A1A1A] text-fuchsia-200 font-bold"
          >
            Fade
          </button>
          <button
            type="button"
            onClick={stopNow}
            className="min-h-11 rounded-xl border border-red-800/60 bg-red-950/40 text-red-200 font-bold inline-flex items-center justify-center gap-1.5"
          >
            <Square className="w-3.5 h-3.5 fill-current" />
            Stop
          </button>
        </div>

        {volumeOpen ? (
          <label className="block mb-1">
            <span className="flex justify-between text-2xs font-bold text-gray-400 uppercase tracking-wider">
              Volume
              <span>{Math.round(volume * 100)}%</span>
            </span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-full accent-fuchsia-500 min-h-11"
            />
          </label>
        ) : null}

        {active ? (
          <div>
            <button
              type="button"
              onClick={() => setTagging((v) => !v)}
              className="w-full min-h-11 rounded-xl border border-gray-700 bg-[#1A1A1A] text-xs font-bold text-gray-200"
            >
              {tagging ? 'Hide tags' : `Tags${active.displayTags.length ? ` · ${active.displayTags.join(', ')}` : ''}`}
            </button>
            {tagging ? (
              <div className="space-y-2 mt-2">
                <TagPills
                  tags={uniqueTags([...tagOptions, ...active.displayTags])}
                  selected={active.displayTags}
                  onToggle={(tag) => toggleMusicTag(active.id, tag, active.tags)}
                  emptyLabel="No sheet tags yet. Type one below."
                />
                <div className="flex gap-2">
                  <input
                    value={customTag}
                    onChange={(e) => setCustomTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addCustomTag();
                      }
                    }}
                    placeholder="Custom tag"
                    className="flex-1 min-h-11 bg-gray-900 border border-gray-700 rounded-xl px-3 text-sm"
                  />
                  <button
                    type="button"
                    onClick={addCustomTag}
                    className="shrink-0 min-h-11 px-4 rounded-xl bg-fuchsia-800 text-white font-bold"
                  >
                    Add
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      </div>
    </section>
  );
}
