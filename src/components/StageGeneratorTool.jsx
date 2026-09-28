import { useMemo, useState } from 'react';
import { Dices, Tag, Wand2 } from 'lucide-react';
import { useAppStore } from '../store/useAppStore.js';
import CatalogIcon from './CatalogIcon.jsx';
import { GameGeneratorSheet, useGeneratorCatalog } from './GameGeneratorLink.jsx';
import {
  emptyLinkDraft,
  linkFromCurrentGenerator,
  linkSummaryItems,
  normalizeGameGeneratorLink,
  resolveGameGeneratorLink,
} from '../lib/gameGenerator.js';
import { hasGeneratorSelection } from '../lib/generateDraw.js';
import { suggestionLine } from '../lib/stage.js';

function suggestionPreview(items) {
  if (!Array.isArray(items)) return '';
  return items
    .flatMap((item) => (item?.texts || []).map((entry) => suggestionLine(entry).text))
    .filter(Boolean)
    .slice(0, 3)
    .join(' · ');
}

export default function StageGeneratorTool({ gameId = '', compact = false }) {
  const key = String(gameId || '').trim();
  const rawLink = useAppStore((s) => (key ? s.gameGeneratorLinks?.[key] : null));
  const generatorBanks = useAppStore((s) => s.generatorBanks);
  const generatorSkills = useAppStore((s) => s.generatorSkills);
  const generatorSessionBanks = useAppStore((s) => s.generatorSessionBanks);
  const generatorDrawCounts = useAppStore((s) => s.generatorDrawCounts);
  const generateFromGame = useAppStore((s) => s.generateFromGame);
  const generateStageSuggestions = useAppStore((s) => s.generateStageSuggestions);
  const setGameGeneratorLink = useAppStore((s) => s.setGameGeneratorLink);
  const applyGeneratorDraft = useAppStore((s) => s.applyGeneratorDraft);
  const suggestions = useAppStore((s) => s.stageSlots.suggestions);
  const catalog = useGeneratorCatalog();
  const sessionLink = useMemo(
    () => linkFromCurrentGenerator(useAppStore.getState()),
    [catalog, generatorBanks, generatorSessionBanks, generatorSkills, generatorDrawCounts],
  );
  const activeLink = key ? resolveGameGeneratorLink(rawLink, catalog) : sessionLink;
  const chips = linkSummaryItems(activeLink, catalog);
  const canDraw = key ? Boolean(activeLink) : hasGeneratorSelection({ generatorBanks, generatorSessionBanks, generatorSkills });
  const preview = suggestionPreview(suggestions);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(emptyLinkDraft);

  const openSheet = () => {
    setDraft(normalizeGameGeneratorLink(activeLink) || emptyLinkDraft());
    setOpen(true);
  };

  const onSave = (next) => {
    if (key) setGameGeneratorLink(key, next);
    else applyGeneratorDraft(next);
  };

  const onDraw = () => {
    if (key) {
      generateFromGame(key, { stay: true });
      return;
    }
    generateStageSuggestions();
  };

  const buildLabel = compact
    ? (activeLink ? 'Edit' : 'Link')
    : (key
      ? (activeLink ? 'Edit' : 'Link generator')
      : (activeLink ? 'Edit' : 'Build'));

  return (
    <div className={`flex flex-col gap-1 min-w-0 ${compact ? 'flex-1' : ''}`}>
      {!compact && chips.length ? (
        <div className="flex flex-wrap gap-1">
          {chips.map((chip) => (
            <span
              key={chip.id}
              className="inline-flex items-center gap-1 max-w-full rounded-full border border-lime-800/50 bg-lime-950/30 px-2 py-0.5"
            >
              <CatalogIcon name={chip.icon} className="w-3 h-3 text-lime-400 shrink-0" fallback={Tag} />
              <span className="text-2xs font-bold text-lime-100 truncate">
                {chip.label} ×{chip.count}
              </span>
            </span>
          ))}
        </div>
      ) : null}
      <div className={`flex gap-1 ${compact ? 'flex-1 min-w-0' : ''}`}>
        <button
          type="button"
          onClick={openSheet}
          className={`${compact ? 'min-w-11 px-2' : 'flex-1'} min-h-11 rounded-lg border border-gray-700 bg-gray-800 text-gray-100 font-bold text-xs inline-flex items-center justify-center gap-1`}
        >
          <Wand2 className="w-3.5 h-3.5 shrink-0" />
          {buildLabel}
        </button>
        <button
          type="button"
          onClick={onDraw}
          disabled={!canDraw}
          className="flex-[2] min-h-11 rounded-lg bg-lime-700 text-white font-bold text-sm inline-flex items-center justify-center gap-1.5 disabled:bg-gray-800 disabled:text-gray-500"
        >
          <Dices className="w-4 h-4" />
          Draw
        </button>
      </div>
      {!compact && !canDraw ? (
        <p className="text-2xs text-gray-500 leading-snug">
          {key ? 'Link a generator to this game, then draw.' : 'Build a generator here, then draw.'}
        </p>
      ) : !compact && preview ? (
        <p className="text-2xs text-gray-400 truncate">{preview}</p>
      ) : null}
      {open ? (
        <GameGeneratorSheet
          catalog={catalog}
          draft={draft}
          setDraft={setDraft}
          onClose={() => setOpen(false)}
          onSave={onSave}
          heading={key ? 'Link a generator' : 'Build a generator'}
        />
      ) : null}
    </div>
  );
}
