import { useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ExternalLink,
  Info,
  Minus,
  Monitor,
  Palette,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { canWakeLock } from '../lib/useWakeLock.js';
import {
  clampFadeSeconds,
  FADE_SECONDS_MAX,
  FADE_SECONDS_MIN,
} from '../lib/audio.js';
import { INTAKE_FORM_URL } from '../lib/sheets.js';
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
  const fadeSeconds = clampFadeSeconds(settings.fadeSeconds);

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
        summary={settings.showStats !== false ? `${sources.length} sources` : 'Catalog sources'}
        accent="text-blue-400"
      >
        <p className="text-xs text-gray-500 mb-3">
          {lastSynced ? `Last synced ${new Date(lastSynced).toLocaleString()}` : 'Not synced yet'}
          {settings.showStats !== false
            ? ` · ${sources.length} source${sources.length === 1 ? '' : 's'}`
            : ''}
        </p>
        <p className="text-xs text-gray-500 mb-3">
          Encyclopedia and Learn Improv content is used with attribution. Learn Improv is CC BY-SA 4.0.
        </p>
        <div className="mb-4 pb-3 border-b border-gray-800">
          <a
            href={INTAKE_FORM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center min-h-11 text-sm font-bold text-blue-400 hover:text-blue-300"
          >
            Submit to the catalog
            <ExternalLink className="w-3.5 h-3.5 ml-1.5 opacity-70" />
          </a>
          <p className="text-xs text-gray-500 leading-snug">
            Games, terms, SFX, music, or suggestions. Google sign-in is required to submit.
          </p>
        </div>
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-2 flex items-center gap-1.5">
          <BookOpen className="w-3.5 h-3.5" />
          Sources
        </h3>
        {sources.length ? (
          <ul className="space-y-2">
            {sources.map((source) => (
              <li key={source.id || source.name} className="text-xs text-gray-300">
                {source.url ? (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center font-semibold text-blue-400 hover:text-blue-300"
                  >
                    {source.name || 'Open source'}
                    <ExternalLink className="w-3 h-3 ml-1 opacity-70" />
                  </a>
                ) : (
                  <span className="font-semibold text-gray-100">{source.name}</span>
                )}
                {source.note ? <p className="text-gray-500 mt-0.5">{source.note}</p> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-gray-500">No sources yet. Sync the catalog.</p>
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
        summary="Library default, stats, fade, wake lock, haptic"
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
          label="Show stats"
          hint="How many games, bank rows, and list items. Turn off for a cleaner jam view."
          checked={settings.showStats !== false}
          onChange={(showStats) => updateSettings({ showStats })}
        />
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
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 mt-3">Fade time</p>
        <p className="text-xs text-gray-500 mb-2">How long Fade takes on SFX and Music.</p>
        <div className="inline-flex items-center rounded-xl border border-gray-700 bg-[#1A1A1A] overflow-hidden">
          <button
            type="button"
            onClick={() => updateSettings({ fadeSeconds: clampFadeSeconds(fadeSeconds - 0.5) })}
            disabled={fadeSeconds <= FADE_SECONDS_MIN}
            className="min-w-11 min-h-11 flex items-center justify-center text-gray-200 disabled:text-gray-600"
            aria-label="Shorter fade"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <label className="flex items-center gap-1 px-1">
            <input
              type="number"
              min={FADE_SECONDS_MIN}
              max={FADE_SECONDS_MAX}
              step="0.1"
              value={fadeSeconds}
              onChange={(e) => updateSettings({ fadeSeconds: clampFadeSeconds(e.target.value) })}
              className="w-14 min-h-11 bg-transparent text-center text-sm font-black tabular-nums text-white focus:outline-none"
              aria-label="Fade seconds"
            />
            <span className="text-xs font-bold text-gray-400 pr-1">sec</span>
          </label>
          <button
            type="button"
            onClick={() => updateSettings({ fadeSeconds: clampFadeSeconds(fadeSeconds + 0.5) })}
            disabled={fadeSeconds >= FADE_SECONDS_MAX}
            className="min-w-11 min-h-11 flex items-center justify-center text-gray-200 disabled:text-gray-600"
            aria-label="Longer fade"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </SettingsSection>
      </div>
    </div>
  );
}
