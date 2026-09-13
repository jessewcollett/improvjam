import { useEffect, useState } from 'react';
import { AnimatePresence, motion, MotionConfig } from 'framer-motion';
import BottomNav from './components/BottomNav.jsx';
import LibraryView from './components/LibraryView.jsx';
import GeneratorView from './components/GeneratorView.jsx';
import ToolsView from './components/ToolsView.jsx';
import MySetsView from './components/MySetsView.jsx';
import SettingsView from './components/SettingsView.jsx';
import { applyTheme } from './lib/theme.js';
import { useAppStore } from './store/useAppStore.js';

const views = {
  library: LibraryView,
  generator: GeneratorView,
  tools: ToolsView,
  mysets: MySetsView,
  settings: SettingsView,
};

export default function App() {
  const [activeRoute, setActiveRoute] = useState('library');
  const View = views[activeRoute];
  const syncFromSheet = useAppStore((s) => s.syncFromSheet);
  const settings = useAppStore((s) => s.settings);

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
          <AnimatePresence mode="wait">
            <motion.div
              key={activeRoute}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.18 }}
              className="absolute inset-0"
            >
              {activeRoute === 'tools' ? (
                <ToolsView />
              ) : (
                <View />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
        <BottomNav activeRoute={activeRoute} onChange={setActiveRoute} />
      </div>
    </MotionConfig>
  );
}
