import { Library, Dices, Wrench, ListTodo, Settings, Bell, Timer, Users, Lightbulb, Coins, Music, Tv } from 'lucide-react';

export const NAV_TABS = [
  { id: 'generator', label: 'Generator', icon: Dices },
  { id: 'library', label: 'Library', icon: Library },
  { id: 'tools', label: 'Tools', icon: Wrench },
  { id: 'mysets', label: 'Sets', icon: ListTodo },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const STAGE_MANAGER_TAB = { id: 'stagemanager', label: 'Stage', icon: Tv };
export const STAGE_MANAGER_ID = 'stagemanager';

export const TOOL_TABS = [
  { id: 'sfx', label: 'SFX', icon: Bell, accent: 'text-yellow-300' },
  { id: 'music', label: 'Music', icon: Music, accent: 'text-fuchsia-300' },
  { id: 'timer', label: 'Timer', icon: Timer, accent: 'text-cyan-300' },
  { id: 'whosup', label: "Who's Up", icon: Users, accent: 'text-blue-300' },
  { id: 'hat', label: 'Hat', icon: Lightbulb, accent: 'text-lime-300' },
  { id: 'coin', label: 'Coin', icon: Coins, accent: 'text-amber-300' },
];

export const DEFAULT_NAV_ORDER = NAV_TABS.map((tab) => tab.id);
export const DEFAULT_TOOL_ORDER = TOOL_TABS.map((tab) => tab.id);

export function mergeIdOrder(saved, defaults) {
  const known = new Set(defaults);
  const seen = new Set();
  const out = [];
  (Array.isArray(saved) ? saved : []).forEach((id) => {
    if (!known.has(id) || seen.has(id)) return;
    seen.add(id);
    out.push(id);
  });
  defaults.forEach((id) => {
    if (!seen.has(id)) out.push(id);
  });
  return out;
}

export function moveId(order, from, to) {
  if (from === to || from < 0 || to < 0 || from >= order.length || to >= order.length) return order;
  const next = [...order];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function visibleNavTabs(stageOn) {
  if (!stageOn) return NAV_TABS;
  return [NAV_TABS[0], STAGE_MANAGER_TAB, ...NAV_TABS.slice(1)];
}

export function tabsInOrder(tabs, order) {
  const byId = new Map(tabs.map((tab) => [tab.id, tab]));
  return mergeIdOrder(order, tabs.map((tab) => tab.id))
    .map((id) => byId.get(id))
    .filter(Boolean);
}

export function orderedVisibleNavTabs(navOrder, stageOn) {
  const base = tabsInOrder(NAV_TABS, navOrder);
  if (!stageOn) return base;
  const insertAt = Math.max(0, base.findIndex((tab) => tab.id === 'generator') + 1);
  return [...base.slice(0, insertAt), STAGE_MANAGER_TAB, ...base.slice(insertAt)];
}

export function clampNavId(id, stageOn = false) {
  const allowed = visibleNavTabs(stageOn).map((tab) => tab.id);
  return allowed.includes(id) ? id : allowed[0];
}

export function clampToolId(id) {
  return DEFAULT_TOOL_ORDER.includes(id) ? id : 'timer';
}
