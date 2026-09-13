export const CATEGORY_STYLES = {
  'Warm-Up': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  'Line Games': 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
  'Short Form': 'bg-green-500/20 text-green-300 border-green-500/30',
  'Long Form': 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  Endowment: 'bg-pink-500/20 text-pink-300 border-pink-500/30',
  'Idea Generators': 'bg-lime-500/20 text-lime-300 border-lime-500/30',
  Exercise: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  'Ask-for': 'bg-teal-500/20 text-teal-300 border-teal-500/30',
};

export const TERM_STYLES = {
  Essentials: 'bg-emerald-900/30 text-emerald-300 border-emerald-800/50',
  Structure: 'bg-blue-900/30 text-blue-300 border-blue-800/50',
  'Editing Moves': 'bg-amber-900/30 text-amber-300 border-amber-800/50',
  'Support Moves': 'bg-indigo-900/30 text-indigo-300 border-indigo-800/50',
  Pitfalls: 'bg-red-900/30 text-red-300 border-red-800/50',
  Boundaries: 'bg-orange-900/30 text-orange-300 border-orange-800/50',
  Tips: 'bg-yellow-900/30 text-yellow-300 border-yellow-800/50',
  Encyclopedia: 'bg-purple-900/30 text-purple-300 border-purple-800/50',
};

export function categoryClass(category) {
  return CATEGORY_STYLES[category] || 'bg-gray-700 text-gray-300 border-gray-600';
}

export function termClass(category) {
  return TERM_STYLES[category] || 'bg-purple-900/30 text-purple-300 border-purple-800/50';
}
