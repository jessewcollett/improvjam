import { useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  Info,
  Monitor,
  Palette,
  RefreshCw,
} from 'lucide-react';
import { canWakeLock } from '../lib/useWakeLock.js';
import { useAppStore } from '../store/useAppStore.js';
import SyncButton from './SyncButton.jsx';

function SettingsSection({ title, icon: Icon, summary, defaultOpen = false, accent, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="bg-card border border-gray-800 rounded-2xl mb-3 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full min-h-12 px-4 py-3 flex items-start gap-3 text-left"
        aria-expanded={open}
      >
        {Icon ? <Icon className={`w-5 h-5 shrink-0 mt-0.5 ${accent || 'text-gray-400'}`} /> : null}
        <span className="flex-1 min-w-0">
          <span className="block text-base font-black font-display text-white leading-tight">{title}</span>
          {summary && !open ? (
            <span className="block text-xs text-gray-500 leading-snug mt-0.5">{summary}</span>
          ) : null}
        </span>
        <ChevronDown className={`w-5 h-5 text-gray-500 shrink-0 mt-0.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? <div className="px-4 pb-4">{children}</div> : null}
    </section>
  );
}

function ChoiceButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 rounded-xl text-sm font-bold border px-3 ${
        active ? 'bg-yellow-600 text-black border-yellow-400' : 'bg-[#1A1A1A] text-gray-200 border-gray-800'
      }`}
    >
      {children}
    </button>
  );
}

function ToggleRow({ label, hint, checked, onChange, disabled }) {
  return (
    <div className="flex items-start gap-3 min-h-12 py-1">
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold text-gray-100">{label}</span>
        {hint ? <span className="block text-xs text-gray-500 leading-snug">{hint}</span> : null}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative w-12 h-7 rounded-full shrink-0 border transition-colors ${
          checked ? 'bg-yellow-600 border-yellow-400' : 'bg-gray-800 border-gray-700'
        } ${disabled ? 'opacity-40' : ''}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-5' : ''
          }`}
        />
      </button>
    </div>
  );
}

export default function SettingsView() {
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const lastSynced = useAppStore((s) => s.lastSynced);
  const syncError = useAppStore((s) => s.syncError);
  const sources = useAppStore((s) => s.data.sources) || [];
  const canHaptic = typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function';

  return (
    <div className="h-full flex flex-col pt-safe px-4 md:px-6 pb-nav overflow-y-auto scrollbar-hide">
      <h1 className="text-2xl font-black font-display text-white mb-1 tracking-tight">Settings</h1>
      <p className="text-xs text-gray-500 mb-4">Prefs stay on this device. Sync pulls the live Google Sheet.</p>

      <div className="lg:grid lg:grid-cols-2 lg:gap-x-4 lg:items-start">
      <SettingsSection
        title="Catalog sync"
        icon={RefreshCw}
        summary={
          syncError
            ? 'Sync failed'
            : lastSynced
              ? `Last synced ${new Date(lastSynced).toLocaleString()}`
              : 'Not synced yet'
        }
      >
        <div className="flex items-center justify-between gap-3 mb-2">
          <p className="text-sm text-gray-400 min-w-0">
            Pull the live Google Sheet onto this device.
          </p>
          <SyncButton />
        </div>
        {lastSynced ? (
          <p className="text-xs text-gray-500">Last synced {new Date(lastSynced).toLocaleString()}</p>
        ) : null}
        {syncError ? (
          <p className="text-xs text-amber-300 bg-amber-900/20 border border-amber-800/40 rounded-lg p-2 mt-3">
            {syncError} The bundled catalog stays available offline.
          </p>
        ) : null}
      </SettingsSection>

      <SettingsSection
        title="Info"
        icon={Info}
        summary={`${sources.length} sources · how sync works`}
        accent="text-blue-400"
      >
        <p className="text-sm text-gray-400 mb-3">
          Edit the Google Sheet, then tap Sync Data. Games, glossary, generator banks, and Audio (SFX / Track)
          refresh here. To Play, Favorites, Played, custom sets, and hidden SFX pads stay on this device.
        </p>
        <p className="text-xs text-gray-500 mb-3">
          Audio credits live on the Audio tab (credit, creditUrl). SFX icons use the icon column (drum, bell-ring,
          or an emoji like 🥁). Tracks use the tags column only — no genre column
          (Pop, 80s, Underscore — comma or pipe separated), and you can also tag on this device in Music.
          Game and glossary photos use the image column (Drive share link, Anyone with the link). Drive
          files must be Anyone with the link. Improv Jam → Update tabs adds missing columns (tags, image)
          without overwriting rows.
        </p>
        <p className="text-xs text-gray-500 mb-3">
          {lastSynced ? `Last synced ${new Date(lastSynced).toLocaleString()}` : 'Not synced yet'}
          {` · ${sources.length} source${sources.length === 1 ? '' : 's'}`}
        </p>
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5" />
          Sources
        </h3>
        <p className="text-xs text-gray-500 mb-2">Edit URLs in the Google Sheet Sources tab, then sync.</p>
        {sources.length ? (
          <ul className="space-y-2">
            {sources.map((source) => (
              <li key={source.id} className="text-xs text-gray-300">
                <span className="font-semibold text-gray-100">{source.name}</span>
                {source.url ? (
                  <>
                    {' · '}
                    <a href={source.url} target="_blank" rel="noopener noreferrer" className="text-blue-400 break-all">
                      {source.url}
                    </a>
                  </>
                ) : (
                  <span className="text-gray-500"> · add a link in the sheet</span>
                )}
                {source.note ? <p className="text-gray-500 mt-0.5">{source.note}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-gray-500">No sources yet. Sync the sheet or run Populate catalog.</p>
        )}
      </SettingsSection>

      <SettingsSection
        title="Appearance"
        icon={Palette}
        summary={settings.theme === 'light' ? 'Light mode' : 'Dark mode'}
        accent="text-amber-300"
      >
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Theme</p>
        <div className="flex bg-[#1A1A1A] p-1 rounded-xl mb-3 border border-gray-800">
          <button
            type="button"
            className={`flex-1 py-2 text-sm font-bold rounded-lg min-h-11 ${
              settings.theme !== 'light' ? 'bg-gray-700 text-white' : 'text-gray-400'
            }`}
            onClick={() => updateSettings({ theme: 'dark' })}
            aria-pressed={settings.theme !== 'light'}
          >
            Dark
          </button>
          <button
            type="button"
            className={`flex-1 py-2 text-sm font-bold rounded-lg min-h-11 ${
              settings.theme === 'light' ? 'bg-gray-700 text-white' : 'text-gray-400'
            }`}
            onClick={() => updateSettings({ theme: 'light' })}
            aria-pressed={settings.theme === 'light'}
          >
            Light
          </button>
        </div>
        <ToggleRow
          label="Reduced motion"
          hint="Less animation on cards, tabs, and page changes."
          checked={Boolean(settings.reducedMotion)}
          onChange={(reducedMotion) => updateSettings({ reducedMotion })}
        />
      </SettingsSection>

      <SettingsSection
        title="Rehearsal"
        icon={Monitor}
        summary="Library default, wake lock, haptic"
      >
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Default Library view</p>
        <div className="grid grid-cols-2 gap-2 mb-3">
          <ChoiceButton
            active={settings.libraryView !== 'terms'}
            onClick={() => updateSettings({ libraryView: 'games' })}
          >
            Games
          </ChoiceButton>
          <ChoiceButton
            active={settings.libraryView === 'terms'}
            onClick={() => updateSettings({ libraryView: 'terms' })}
          >
            Glossary
          </ChoiceButton>
        </div>
        <ToggleRow
          label="Keep screen awake in Tools"
          hint={canWakeLock() ? 'Uses the Screen Wake Lock API while Jam Tools is open.' : 'Wake Lock is not available in this browser.'}
          checked={Boolean(settings.keepAwake)}
          onChange={(keepAwake) => updateSettings({ keepAwake })}
          disabled={!canWakeLock()}
        />
        <ToggleRow
          label="Vibrate on ding"
          hint={canHaptic ? 'Short buzz with each ding when the device supports it.' : 'Vibration is not available in this browser.'}
          checked={Boolean(settings.hapticDing)}
          onChange={(hapticDing) => updateSettings({ hapticDing })}
          disabled={!canHaptic}
        />
      </SettingsSection>
      </div>
    </div>
  );
}
