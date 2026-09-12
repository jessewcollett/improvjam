import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import BottomNav from './components/BottomNav.jsx';
import LibraryView from './components/LibraryView.jsx';
import GeneratorView from './components/GeneratorView.jsx';
import ToolsView from './components/ToolsView.jsx';
import MySetsView from './components/MySetsView.jsx';
import SettingsView from './components/SettingsView.jsx';
import { SHEETS_URL } from './lib/sheets.js';
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

  useEffect(() => {
    if (!SHEETS_URL) return undefined;
    syncFromSheet().catch(() => {});
    return undefined;
  }, [syncFromSheet]);

  return (
    <div className="flex flex-col h-screen w-full max-w-md mx-auto bg-stage font-body text-gray-100 overflow-hidden relative selection:bg-blue-500/30">
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
              <ToolsView onOpenSettings={() => setActiveRoute('settings')} />
            ) : (
              <View />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
      <BottomNav activeRoute={activeRoute} onChange={setActiveRoute} />
    </div>
  );
}
