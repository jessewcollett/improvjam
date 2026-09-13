import { useEffect } from 'react';
import { MotionConfig } from 'framer-motion';
import BottomNav from './components/BottomNav.jsx';
import LibraryView from './components/LibraryView.jsx';
import GeneratorView from './components/GeneratorView.jsx';
import ToolsView from './components/ToolsView.jsx';
import MySetsView from './components/MySetsView.jsx';
import SettingsView from './components/SettingsView.jsx';
import { applyTheme } from './lib/theme.js';
import { clampNavId } from './lib/nav.js';
import { useAppStore } from './store/useAppStore.js';

const views = [
  { id: 'generator', View: GeneratorView },
  { id: 'library', View: LibraryView },
  { id: 'tools', View: ToolsView },
  { id: 'mysets', View: MySetsView },
  { id: 'settings', View: SettingsView },
];

export default function App() {
  const syncFromSheet = useAppStore((s) => s.syncFromSheet);
  const settings = useAppStore((s) => s.settings);
  const updateSettings = useAppStore((s) => s.updateSettings);
  const activeRoute = clampNavId(settings.lastRoute);

  useEffect(() => {
    applyTheme(settings.theme);
    document.documentElement.classList.toggle('reduce-motion', Boolean(settings.reducedMotion));
    window.__improvJamHapticDing = Boolean(settings.hapticDing);
  }, [settings.theme, settings.reducedMotion, settings.hapticDing]);

  useEffect(() => {
    syncFromSheet().catch(() => {});
  }, [syncFromSheet]);

  return (
    <MotionConfig reducedMotion={settings.reducedMotion ? 'always' : 'user'}>
      <div className="flex flex-col h-screen w-full max-w-md md:max-w-3xl lg:max-w-5xl mx-auto bg-stage font-body text-gray-100 overflow-hidden relative selection:bg-blue-500/30">
        <main className="flex-1 overflow-hidden relative">
          {views.map(({ id, View }) => {
            const active = activeRoute === id;
            return (
              <div
                key={id}
                className={`absolute inset-0 transition-opacity duration-150 ${
                  active ? 'z-10 opacity-100' : 'z-0 opacity-0 pointer-events-none invisible'
                }`}
                aria-hidden={!active}
                inert={!active}
              >
                {id === 'tools' ? <ToolsView active={active} /> : <View />}
              </div>
            );
          })}
        </main>
        <BottomNav activeRoute={activeRoute} onChange={(id) => updateSettings({ lastRoute: id })} />
      </div>
    </MotionConfig>
  );
}
