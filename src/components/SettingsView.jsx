import { Bell, Play, Volume2 } from 'lucide-react';
import { BELL_STYLES, playCountIn, playDing } from '../lib/audio.js';
import { useHoldDing } from '../lib/useHoldDing.js';
import { useAppStore } from '../store/useAppStore.js';
import SyncButton from './SyncButton.jsx';

export default function SettingsView() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const lastSynced = useAppStore((s) => s.lastSynced);
  const syncError = useAppStore((s) => s.syncError);
  const holdPreview = useHoldDing(settings.bellStyle, settings.bellVolume);

  return (
    <div className="h-full flex flex-col pt-4 px-4 pb-nav overflow-y-auto scrollbar-hide">
      <h1 className="text-2xl font-black font-display text-white mb-1 tracking-tight">Settings</h1>
      <p className="text-xs text-gray-500 mb-6">Bell prefs stay on this device. Catalog sync pulls the live Google Sheet.</p>

      <section className="bg-card border border-gray-800 rounded-2xl p-4 mb-4">
        <h2 className="text-lg font-black font-display text-white mb-2">Catalog sync</h2>
        <p className="text-sm text-gray-400 mb-3">
          After you edit the Google Sheet or run Populate catalog, tap Sync Data. The app fetches the live sheet and replaces games, glossary, and generator banks on this device. Your To Play, Favorites, and custom sets stay in local storage.
        </p>
        <SyncButton />
        {lastSynced && (
          <p className="text-[10px] text-gray-500 mt-2">Last synced {new Date(lastSynced).toLocaleString()}</p>
        )}
        {syncError && (
          <p className="text-xs text-amber-300 bg-amber-900/20 border border-amber-800/40 rounded-lg p-2 mt-2">
            {syncError} The bundled catalog stays available offline.
          </p>
        )}
      </section>

      <section className="bg-card border border-gray-800 rounded-2xl p-4 mb-4">
        <h2 className="text-lg font-black font-display text-yellow-300 mb-3 flex items-center">
          <Bell className="w-5 h-5 mr-2" />
          Bell sound
        </h2>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {BELL_STYLES.map((style) => {
            const active = settings.bellStyle === style.id;
            return (
              <button
                key={style.id}
                type="button"
                onClick={() => {
                  updateSettings({ bellStyle: style.id });
                  playDing(style.id, settings.bellVolume);
                }}
                className={`w-full text-left rounded-xl border px-3 py-2.5 min-h-12 ${
                  active ? 'bg-yellow-600 text-black border-yellow-400' : 'bg-[#1A1A1A] text-gray-200 border-gray-800'
                }`}
              >
                <span className="block text-sm font-bold leading-tight">{style.label}</span>
                <span className={`block text-[10px] leading-snug mt-0.5 ${active ? 'text-black/70' : 'text-gray-500'}`}>
                  {style.hint}
                </span>
              </button>
            );
          })}
        </div>

        <label className="block mb-4">
          <span className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
            <span className="flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5" />
              Volume
            </span>
            <span>{Math.round(settings.bellVolume * 100)}%</span>
          </span>
          <input
            type="range"
            min="0.1"
            max="1"
            step="0.05"
            value={settings.bellVolume}
            onChange={(e) => updateSettings({ bellVolume: Number(e.target.value) })}
            className="w-full accent-yellow-500"
          />
        </label>

        <div className="mb-4">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Count-in</p>
          <div className="grid grid-cols-3 gap-2">
            {[3, 4, 5].map((beats) => (
              <button
                key={beats}
                type="button"
                onClick={() => updateSettings({ countInBeats: beats })}
                className={`min-h-11 rounded-xl text-sm font-bold border ${
                  settings.countInBeats === beats
                    ? 'bg-yellow-600 text-black border-yellow-400'
                    : 'bg-gray-800 text-gray-300 border-gray-700'
                }`}
              >
                {beats}-count
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            {...holdPreview}
            className="bg-yellow-500 text-black font-black py-3 rounded-xl min-h-12"
            aria-label="Test ding, hold to sustain"
          >
            Test ding
          </button>
          <button
            type="button"
            onClick={() => playCountIn(settings.countInBeats, settings.bellStyle, settings.bellVolume)}
            className="bg-gray-800 border border-gray-700 text-gray-100 font-bold py-3 rounded-xl min-h-12 flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4" />
            Test count-in
          </button>
        </div>
        <p className="text-[11px] text-gray-500 mt-2 text-center">Tap for a hit. Hold to sustain.</p>
      </section>
    </div>
  );
}
