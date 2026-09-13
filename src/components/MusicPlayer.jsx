import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUpDown, Check, ListFilter, Music, Pause, Play, Repeat, Shuffle, Square, Volume2, X } from 'lucide-react';
import { clampFadeSeconds } from '../lib/audio.js';
import { UNTAGGED_FILTER, tagsForTrack, uniqueTags } from '../lib/music.js';
import { useAppStore } from '../store/useAppStore.js';

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
  const autoplayRef = useRef(false);
  const fadeTokenRef = useRef(0);
  const volumeRef = useRef(0.85);
  const [activeId, setActiveId] = useState(tracks[0]?.id || '');
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(false);
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

  useEffect(() => {
    if (activeId && taggedTracks.some((track) => track.id === activeId)) return;
    setActiveId(visibleTracks[0]?.id || taggedTracks[0]?.id || '');
  }, [taggedTracks, visibleTracks, activeId]);

  useEffect(() => {
    const node = audioRef.current;
    if (!node) return undefined;
    node.loop = loop;
    node.volume = volume;
    fadeTokenRef.current += 1;
    const onTime = () => setCurrent(node.currentTime || 0);
    const onMeta = () => setDuration(node.duration || 0);
    const onEnd = () => setPlaying(false);
    node.addEventListener('timeupdate', onTime);
    node.addEventListener('loadedmetadata', onMeta);
    node.addEventListener('ended', onEnd);
    return () => {
      node.removeEventListener('timeupdate', onTime);
      node.removeEventListener('loadedmetadata', onMeta);
      node.removeEventListener('ended', onEnd);
    };
  }, [loop, volume, active?.playUrl]);

  useEffect(() => {
    const node = audioRef.current;
    if (!node || !active?.playUrl) return;
    fadeTokenRef.current += 1;
    const shouldPlay = autoplayRef.current;
    autoplayRef.current = false;
    node.pause();
    node.volume = volumeRef.current;
    node.src = active.playUrl;
    node.load();
    setCurrent(0);
    if (!shouldPlay) {
      setPlaying(false);
      return;
    }
    node
      .play()
      .then(() => setPlaying(true))
      .catch(() => setPlaying(false));
  }, [active?.playUrl]);

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
    node.volume = volumeRef.current;
    setPlaying(false);
    setCurrent(0);
  }, []);

  const fadeOut = useCallback(() => {
    const node = audioRef.current;
    if (!node) return;
    const token = fadeTokenRef.current + 1;
    fadeTokenRef.current = token;
    const startVol = Math.max(node.volume || volumeRef.current || 0, 0.0001);
    const start = performance.now();
    const durationMs = clampFadeSeconds(fadeSeconds) * 1000;
    const tick = (now) => {
      if (token !== fadeTokenRef.current) return;
      const t = Math.min(1, (now - start) / durationMs);
      node.volume = startVol * (1 - t);
      if (t < 1) {
        requestAnimationFrame(tick);
        return;
      }
      node.pause();
      try {
        node.currentTime = 0;
      } catch {
        /* ignore */
      }
      node.volume = volumeRef.current;
      setPlaying(false);
      setCurrent(0);
    };
    requestAnimationFrame(tick);
  }, [fadeSeconds]);

  const toggle = async () => {
    const node = audioRef.current;
    if (!node || !active?.playUrl) return;
    fadeTokenRef.current += 1;
    node.volume = volumeRef.current;
    if (playing) {
      node.pause();
      setPlaying(false);
      return;
    }
    try {
      await node.play();
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  };

  const playRandom = useCallback(() => {
    const pool = visibleTracks.filter((track) => track.id !== active?.id);
    const source = pool.length ? pool : visibleTracks;
    if (!source.length) return;
    const next = source[Math.floor(Math.random() * source.length)];
    autoplayRef.current = true;
    setActiveId(next.id);
    if (next.playUrl === active?.playUrl) {
      audioRef.current
        ?.play()
        .then(() => setPlaying(true))
        .catch(() => setPlaying(false));
    }
  }, [visibleTracks, active]);

  useEffect(() => {
    const controls = { random: playRandom, fade: fadeOut, stop: stopNow };
    if (randomRef) randomRef.current = playRandom;
    if (controlsRef) controlsRef.current = controls;
    return () => {
      if (randomRef) randomRef.current = null;
      if (controlsRef) controlsRef.current = null;
    };
  }, [randomRef, controlsRef, playRandom, fadeOut, stopNow]);

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
          Add rows tagged Track in the Google Sheet Audio tab, then Sync Data. Paste a Drive share link
          (Anyone with the link), a credit, and optional tags (Pop, 80s, Underscore).
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
      <audio ref={audioRef} preload="metadata" />

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
                const tagsLabel = track.displayTags.length ? track.displayTags.join(', ') : 'No tags';
                return (
                  <button
                    key={track.id}
                    type="button"
                    onClick={() => setActiveId(track.id)}
                    className={`w-full text-left rounded-lg border px-3 min-h-11 flex items-center ${
                      selected ? 'bg-fuchsia-700/30 border-fuchsia-500 text-white' : 'bg-[#1A1A1A] border-gray-800 text-gray-200'
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
          {active?.name}
          {active?.credit ? (
            <span className="font-sans font-medium">
              {' '}
              — <Credit track={active} />
            </span>
          ) : null}
        </p>

        <div className="flex items-center gap-2 mt-1">
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
          <span className="text-2xs text-gray-500 tabular-nums shrink-0">
            {formatTime(current)}/{formatTime(duration)}
          </span>
        </div>

        <div className="flex gap-1.5 mb-1">
          <button
            type="button"
            onClick={toggle}
            className="flex-1 min-h-11 rounded-xl bg-fuchsia-700 text-white font-black inline-flex items-center justify-center gap-1.5"
          >
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {playing ? 'Pause' : 'Play'}
          </button>
          <button
            type="button"
            onClick={playRandom}
            className="min-w-11 min-h-11 px-2.5 rounded-xl border bg-gray-800 text-gray-100 border-gray-700 inline-flex items-center justify-center gap-1 font-bold md:min-w-12 md:px-3"
            aria-label="Play a random track"
          >
            <Shuffle className="w-4 h-4" />
            <span className="text-xs hidden md:inline">Random</span>
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
