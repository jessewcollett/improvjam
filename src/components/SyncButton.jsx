import { RefreshCw } from 'lucide-react';
import { useAppStore } from '../store/useAppStore.js';

export default function SyncButton({ compact = false }) {
  const syncFromSheet = useAppStore((s) => s.syncFromSheet);
  const isSyncing = useAppStore((s) => s.isSyncing);

  return (
    <button
      type="button"
      onClick={() => syncFromSheet().catch(() => {})}
      disabled={isSyncing}
      className={
        compact
          ? 'flex items-center justify-center min-w-11 min-h-11 rounded-lg border border-gray-700 bg-gray-800 text-gray-400 hover:bg-gray-700'
          : 'flex items-center text-xs font-medium text-gray-400 bg-gray-800 hover:bg-gray-700 px-3 py-2 rounded-lg border border-gray-700 min-h-11'
      }
      aria-label="Sync catalog from Google Sheet"
    >
      <RefreshCw className={`w-3.5 h-3.5 ${compact ? '' : 'mr-2'} ${isSyncing ? 'animate-spin text-blue-400' : ''}`} />
      {compact ? null : isSyncing ? 'Syncing…' : 'Sync Data'}
    </button>
  );
}
