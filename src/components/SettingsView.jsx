import { useEffect, useState } from 'react';
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Info,
  Minus,
  Monitor,
  LayoutGrid,
  Palette,
  Plus,
  RefreshCw,
  Tv,
  UserRound,
} from 'lucide-react';
import ReorderList from './ReorderList.jsx';
import {
  DEFAULT_NAV_ORDER,
  DEFAULT_STAGE_MANAGER_TOOLS,
  DEFAULT_TOOL_ORDER,
  NAV_TABS,
  STAGE_MANAGER_TOOLS,
  TOOL_TABS,
  moveId,
  normalizeStageManagerTools,
  tabsInOrder,
} from '../lib/nav.js';
import { canWakeLock } from '../lib/useWakeLock.js';
import {
  clampFadeSeconds,
  FADE_SECONDS_MAX,
  FADE_SECONDS_MIN,
} from '../lib/audio.js';
import { INTAKE_FORM_URL } from '../lib/sheets.js';
import { useAppStore } from '../store/useAppStore.js';
import { StageSettingsPanel, SegmentPills } from './StageControls.jsx';
import SyncButton from './SyncButton.jsx';
import { PROFILE_NAME_MAX, PROFILE_NAME_MIN, profileUrl, sanitizeUserIdInput } from '../lib/profile.js';
import { copyText } from '../lib/stage.js';

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

function StageManagerToolsEditor({ value, onChange }) {
  const enabled = normalizeStageManagerTools(value);
  const enabledSet = new Set(enabled);
  const hidden = STAGE_MANAGER_TOOLS.filter((tool) => !enabledSet.has(tool.id));
  const rows = [
    ...enabled.map((id) => STAGE_MANAGER_TOOLS.find((tool) => tool.id === id)).filter(Boolean),
    ...hidden,
  ];

  const setEnabled = (next) => onChange(normalizeStageManagerTools(next));

  return (
    <div>
      <ol className="space-y-1">
        {rows.map((tool) => {
          const Icon = tool.icon;
          const on = enabledSet.has(tool.id);
          const enabledIndex = enabled.indexOf(tool.id);
          return (
            <li
              key={tool.id}
              className={`flex items-center gap-1 min-h-11 rounded-xl border px-1 ${
                on ? 'bg-[#1A1A1A] border-gray-800' : 'bg-[#141414] border-gray-900'
              }`}
            >
              <button
                type="button"
                aria-pressed={on}
                aria-label={on ? `Hide ${tool.label} on Stage` : `Show ${tool.label} on Stage`}
                onClick={() => {
                  setEnabled(on ? enabled.filter((id) => id !== tool.id) : [...enabled, tool.id]);
                }}
                className={`min-w-11 min-h-11 flex items-center justify-center rounded-lg ${
                  on ? 'text-lime-300' : 'text-gray-600'
                }`}
              >
                <span className={`w-5 h-5 rounded border inline-flex items-center justify-center ${
                  on ? 'bg-lime-800 border-lime-500' : 'border-gray-700 bg-gray-900'
                }`}>
                  {on ? <Check className="w-3.5 h-3.5" /> : null}
                </span>
              </button>
              {Icon ? <Icon className={`w-4 h-4 shrink-0 ${on ? 'text-gray-400' : 'text-gray-700'}`} /> : null}
              <span className={`flex-1 min-w-0 text-sm font-bold truncate ${on ? 'text-gray-100' : 'text-gray-600'}`}>
                {tool.label}
              </span>
              <button
                type="button"
                aria-label={`Move ${tool.label} up`}
                disabled={!on || enabledIndex <= 0}
                onClick={() => setEnabled(moveId(enabled, enabledIndex, enabledIndex - 1))}
                className="min-w-11 min-h-11 flex items-center justify-center text-gray-200 disabled:text-gray-700"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                type="button"
                aria-label={`Move ${tool.label} down`}
                disabled={!on || enabledIndex < 0 || enabledIndex >= enabled.length - 1}
                onClick={() => setEnabled(moveId(enabled, enabledIndex, enabledIndex + 1))}
                className="min-w-11 min-h-11 flex items-center justify-center text-gray-200 disabled:text-gray-700"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </li>
          );
        })}
      </ol>
      <button
        type="button"
        onClick={() => onChange([...DEFAULT_STAGE_MANAGER_TOOLS])}
        className="mt-2 text-xs font-bold text-gray-400 hover:text-gray-200 min-h-11"
      >
        Reset tools
      </button>
    </div>
  );
}

function DeviceBackupSection() {
  const userId = useAppStore((s) => s.settings.userId);
  const named = useAppStore((s) => s.settings.profileNamed === true);
  const userSyncedAt = useAppStore((s) => s.userSyncedAt);
  const userSyncError = useAppStore((s) => s.userSyncError);
  const userSyncing = useAppStore((s) => s.userSyncing);
  const setUserId = useAppStore((s) => s.setUserId);
  const pullUserProfile = useAppStore((s) => s.pullUserProfile);
  const [draft, setDraft] = useState(named ? (userId || '') : '');
  const [note, setNote] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setDraft(named ? (userId || '') : '');
  }, [named, userId]);

  const flash = (message) => {
    setNote(message);
    window.setTimeout(() => setNote(''), 2400);
  };

  const commit = async () => {
    const next = sanitizeUserIdInput(draft);
    if (next.length < PROFILE_NAME_MIN) {
      setDraft(named ? (userId || '') : '');
      if (draft.trim()) flash('Use at least 3 letters or numbers.');
      return;
    }
    const id = await setUserId(next);
    if (id) flash(named && id === userId ? 'Synced.' : `Signed in as ${id}.`);
  };

  const onCopy = async () => {
    const url = profileUrl(userId);
    if (url && await copyText(url)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    }
  };

  return (
    <SettingsSection
      title="Profile"
      icon={UserRound}
      summary={named ? userId : 'Pick a username to sync phones'}
      accent="text-teal-400"
      defaultOpen
    >
      <p className="text-sm text-gray-400 mb-2">
        This is your jam name, not a device code. Same name on another phone pulls this profile. An empty phone will not wipe a set list.
      </p>
      <div className="flex items-center gap-1.5 min-w-0 mb-2">
        <input
          value={draft}
          onChange={(e) => setDraft(sanitizeUserIdInput(e.target.value))}
          onBlur={() => { commit().catch(() => {}); }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit().catch(() => {});
            }
          }}
          placeholder="username"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          maxLength={PROFILE_NAME_MAX}
          aria-label="Profile name"
          className="flex-1 min-w-0 min-h-11 rounded-xl bg-[#1A1A1A] border border-gray-700 px-3 text-base font-black font-display tracking-wide text-white placeholder:text-gray-600 placeholder:font-bold focus:outline-none focus:border-teal-600"
        />
        <button
          type="button"
          onClick={onCopy}
          disabled={!named || !userId}
          className="min-w-11 min-h-11 rounded-xl bg-gray-800 border border-gray-700 text-gray-200 disabled:text-gray-600 inline-flex items-center justify-center"
          aria-label={copied ? 'Link copied' : 'Copy profile link'}
        >
          {copied ? <Check className="w-4 h-4 text-lime-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-2">
        {userSyncing
          ? 'Syncing…'
          : userSyncError
            ? userSyncError
            : named
              ? (userSyncedAt ? `Saved ${new Date(userSyncedAt).toLocaleString()}` : `Signed in as ${userId}`)
              : 'Saving on this phone until you pick a name.'}
      </p>
      {named ? (
        <button
          type="button"
          onClick={() => pullUserProfile().then(() => flash('Pulled from the sheet.'))}
          className="text-xs font-bold text-teal-400 min-h-11"
        >
          Sync now
        </button>
      ) : null}
      {note ? <p className="text-xs text-teal-300 mt-1">{note}</p> : null}
    </SettingsSection>
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
      <p className="text-xs text-gray-500 mb-4">Prefs stay on this device unless you sign in to a profile. Catalog sync pulls the live Google Sheet.</p>

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
        title="Stage"
        icon={Tv}
        summary={settings.stageOn && settings.stageCode
          ? `On · ${settings.stageCode}`
          : settings.stageCode
            ? `Off · ${settings.stageCode}`
            : 'Off until you start a session'}
        accent="text-lime-400"
      >
        <StageSettingsPanel />
      </SettingsSection>

      <SettingsSection
        title="Appearance"
        icon={Palette}
        summary={settings.theme === 'light' ? 'Light mode' : 'Dark mode'}
        accent="text-amber-300"
      >
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Theme</p>
        <SegmentPills
          className="mb-3"
          value={settings.theme === 'light' ? 'light' : 'dark'}
          onChange={(theme) => updateSettings({ theme })}
          options={[
            { id: 'dark', label: 'Dark', activeClass: 'bg-gray-700 text-white' },
            { id: 'light', label: 'Light' },
          ]}
        />
        <ToggleRow
          label="Reduced motion"
          hint="Less animation on cards, tabs, and page changes."
          checked={Boolean(settings.reducedMotion)}
          onChange={(reducedMotion) => updateSettings({ reducedMotion })}
        />
      </SettingsSection>

      <SettingsSection
        title="Layout"
        icon={LayoutGrid}
        summary="Tab, Tools, and Stage Manager tools"
        accent="text-blue-300"
      >
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Bottom tabs</p>
        <p className="text-xs text-gray-500 mb-2">Drag the handle or use the arrows. First launch opens Generator.</p>
        <ReorderList
          items={tabsInOrder(NAV_TABS, settings.navOrder)}
          onOrder={(navOrder) => updateSettings({ navOrder })}
          onReset={() => updateSettings({ navOrder: [...DEFAULT_NAV_ORDER] })}
        />
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 mt-4">Tools</p>
        <p className="text-xs text-gray-500 mb-2">Order of SFX, Music, Timer, and the other jam tools.</p>
        <ReorderList
          items={tabsInOrder(TOOL_TABS, settings.toolOrder)}
          onOrder={(toolOrder) => updateSettings({ toolOrder })}
          onReset={() => updateSettings({ toolOrder: [...DEFAULT_TOOL_ORDER] })}
        />
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2 mt-4">Stage Manager tools</p>
        <p className="text-xs text-gray-500 mb-2">These sit under the Stage board. SFX pads and Music stay on Tools.</p>
        <StageManagerToolsEditor
          value={settings.stageManagerTools}
          onChange={(stageManagerTools) => updateSettings({ stageManagerTools })}
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
      <DeviceBackupSection />
      </div>
    </div>
  );
}
