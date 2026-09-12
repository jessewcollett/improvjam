import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ListFilter, Music, Pause, Play, Repeat, Shuffle, X } from 'lucide-react';
import {
  MUSIC_GENRE_PRESETS,
  UNTAGGED_FILTER,
  tagsForTrack,
  uniqueTags,
} from '../lib/music.js';
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
        className="text-2xs text-blue-400 leading-snug break-words"
      >
        {track.credit}
      </a>
    );
  }
  return <p className="text-2xs text-gray-500 leading-snug break-words">{track.credit}</p>;
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
  genreFilters,
  genreOptions,
  sortBy,
  onSort,
  onToggleFilter,
  onClear,
}) {
  const filterActive = genreFilters.length > 0;
  const filterLabels = genreFilters.map((tag) => (tag === UNTAGGED_FILTER ? 'Untagged' : tag));
  const summary = [...(sortBy === 'genre' ? ['Genre'] : []), ...filterLabels];

  return (
    <div className="shrink-0 mb-3">
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
              {genreFilters.length}
            </span>
          ) : null}
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
        {summary.length && !filtersOpen ? (
          <span className="text-xs font-semibold text-fuchsia-300 min-w-0">{summary.join(' · ')}</span>
        ) : null}
      </div>

      {filtersOpen ? (
        <div className="mt-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Sort</p>
          <div className="flex flex-wrap gap-2 mb-3">
            <Chip active={sortBy === 'name'} onClick={() => onSort('name')}>
              Name
            </Chip>
            <Chip active={sortBy === 'genre'} onClick={() => onSort('genre')}>
              Genre
            </Chip>
          </div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Genre</p>
          <div className="flex flex-wrap gap-2">
            <Chip
              active={genreFilters.some((item) => item === UNTAGGED_FILTER)}
              onClick={() => onToggleFilter(UNTAGGED_FILTER)}
            >
              Untagged
            </Chip>
            {genreOptions.map((tag) => (
              <Chip
                key={tag}
                active={genreFilters.some((item) => item.toLowerCase() === tag.toLowerCase())}
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

export default function MusicPlayer({ tracks, randomRef }) {
  const musicTags = useAppStore((s) => s.musicTags);
  const toggleMusicTag = useAppStore((s) => s.toggleMusicTag);
  const audioRef = useRef(null);
  const autoplayRef = useRef(false);
  const [activeId, setActiveId] = useState(tracks[0]?.id || '');
  const [playing, setPlaying] = useState(false);
  const [loop, setLoop] = useState(false);
  const [volume, setVolume] = useState(0.85);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [genreFilters, setGenreFilters] = useState([]);
  const [sortBy, setSortBy] = useState('name');
  const [customTag, setCustomTag] = useState('');
  const [tagging, setTagging] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const taggedTracks = useMemo(
    () => tracks.map((track) => ({ ...track, displayTags: tagsForTrack(track, musicTags) })),
    [tracks, musicTags],
  );

  const genreOptions = useMemo(
    () => uniqueTags(taggedTracks.flatMap((track) => track.displayTags)),
    [taggedTracks],
  );

  const visibleTracks = useMemo(() => {
    const filtered = taggedTracks.filter((track) => {
      if (!genreFilters.length) return true;
      const untagged = genreFilters.includes(UNTAGGED_FILTER) && !track.displayTags.length;
      const tagged = genreFilters.some(
        (filter) => filter !== UNTAGGED_FILTER && track.displayTags.some((tag) => tag.toLowerCase() === filter.toLowerCase()),
      );
      return untagged || tagged;
    });
    return [...filtered].sort((a, b) => {
      if (sortBy === 'genre') {
        const ga = a.displayTags[0] || 'zzzz';
        const gb = b.displayTags[0] || 'zzzz';
        const byGenre = ga.localeCompare(gb);
        if (byGenre) return byGenre;
      }
      return a.name.localeCompare(b.name);
    });
  }, [taggedTracks, genreFilters, sortBy]);

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
    const shouldPlay = autoplayRef.current;
    autoplayRef.current = false;
    node.pause();
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

  const toggle = async () => {
    const node = audioRef.current;
    if (!node || !active?.playUrl) return;
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
    if (!randomRef) return undefined;
    randomRef.current = playRandom;
    return () => {
      randomRef.current = null;
    };
  }, [randomRef, playRandom]);

  const toggleFilter = (tag) => {
    setGenreFilters((current) =>
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
    <section className="bg-card border border-gray-800 rounded-2xl p-4 h-full min-h-0 flex flex-col">
      <h2 className="text-lg font-black font-display text-fuchsia-300 flex items-center mb-2 shrink-0">
        <Music className="w-5 h-5 mr-2" />
        Music
      </h2>
      <audio ref={audioRef} preload="metadata" />

      <MusicFilters
        filtersOpen={filtersOpen}
        onToggleOpen={() => setFiltersOpen((v) => !v)}
        genreFilters={genreFilters}
        genreOptions={genreOptions}
        sortBy={sortBy}
        onSort={setSortBy}
        onToggleFilter={toggleFilter}
        onClear={() => setGenreFilters([])}
      />

      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide space-y-1.5 mb-2">
        {visibleTracks.length ? (
          visibleTracks.map((track) => {
            const selected = active?.id === track.id;
            return (
              <button
                key={track.id}
                type="button"
                onClick={() => setActiveId(track.id)}
                className={`w-full text-left rounded-xl border px-3 py-2.5 min-h-12 ${
                  selected ? 'bg-fuchsia-700/30 border-fuchsia-500 text-white' : 'bg-[#1A1A1A] border-gray-800 text-gray-200'
                }`}
              >
                <span className="block text-sm font-bold leading-tight">{track.name}</span>
                {track.displayTags.length ? (
                  <span className="block text-2xs text-fuchsia-200/80 mt-0.5 truncate">{track.displayTags.join(' · ')}</span>
                ) : (
                  <span className="block text-2xs text-gray-500 mt-0.5">No genre yet</span>
                )}
                <Credit track={track} />
              </button>
            );
          })
        ) : (
          <p className="text-sm text-gray-500 px-1">No tracks in this genre. Clear filters or tag a track.</p>
        )}
      </div>

      <div className="shrink-0 border-t border-gray-800 pt-3 bg-card">
        <p className="text-base font-black font-display text-white leading-tight mb-1">{active?.name}</p>
        <Credit track={active} />

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
          className="w-full accent-fuchsia-500 min-h-11 mt-2"
          aria-label="Seek"
        />
        <div className="flex justify-between text-2xs text-gray-500 tabular-nums mb-2">
          <span>{formatTime(current)}</span>
          <span>{formatTime(duration)}</span>
        </div>

        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={toggle}
            className="flex-1 min-h-12 rounded-xl bg-fuchsia-700 text-white font-black inline-flex items-center justify-center gap-2"
          >
            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            {playing ? 'Pause' : 'Play'}
          </button>
          <button
            type="button"
            onClick={playRandom}
            className="min-w-12 min-h-12 px-3 rounded-xl border bg-gray-800 text-gray-100 border-gray-700 inline-flex items-center justify-center gap-1.5 font-bold"
            aria-label="Play a random track"
          >
            <Shuffle className="w-4 h-4" />
            <span className="text-xs">Random</span>
          </button>
          <button
            type="button"
            onClick={() => setLoop((v) => !v)}
            className={`min-w-12 min-h-12 rounded-xl border inline-flex items-center justify-center ${
              loop ? 'bg-fuchsia-600 text-white border-fuchsia-400' : 'bg-gray-800 text-gray-300 border-gray-700'
            }`}
            aria-pressed={loop}
            aria-label="Loop"
          >
            <Repeat className="w-4 h-4" />
          </button>
        </div>

        <label className="block mb-3">
          <span className="flex justify-between text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
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

        {active ? (
          <div>
            <button
              type="button"
              onClick={() => setTagging((v) => !v)}
              className="w-full min-h-11 rounded-xl border border-gray-700 bg-[#1A1A1A] text-sm font-bold text-gray-200 mb-2"
            >
              {tagging ? 'Hide genres' : `Tag genre${active.displayTags.length ? ` · ${active.displayTags.join(', ')}` : ''}`}
            </button>
            {tagging ? (
              <div className="space-y-2">
                <TagPills
                  tags={uniqueTags([...MUSIC_GENRE_PRESETS, ...active.displayTags])}
                  selected={active.displayTags}
                  onToggle={(tag) => toggleMusicTag(active.id, tag, active.tags)}
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
                    placeholder="Custom genre"
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
    </section>
  );
}
