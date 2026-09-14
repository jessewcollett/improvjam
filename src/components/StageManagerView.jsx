import { Tv } from 'lucide-react';
import { StageHeaderControl, StageRemoteBody } from './StageControls.jsx';
import StageLayoutEditor from './StageLayoutEditor.jsx';
import { useAppStore } from '../store/useAppStore.js';

export default function StageManagerView() {
  const publishError = useAppStore((s) => s.stagePublishError);

  return (
    <div className="h-full flex flex-col pt-safe relative overflow-hidden">
      <div className="flex-none px-4 md:px-6 pb-3 bg-stage/95 z-20 border-b border-gray-800">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-black font-display text-white tracking-tight flex items-center">
            <Tv className="text-lime-400 mr-2 w-7 h-7" />
            Stage
          </h1>
          <StageHeaderControl />
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide px-4 md:px-6 pt-3 pb-nav">
        <StageRemoteBody extra={<StageLayoutEditor />} />
        {publishError ? (
          <p className="text-xs text-amber-300 bg-amber-900/20 border border-amber-800/40 rounded-lg p-2 mt-3">
            {publishError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
