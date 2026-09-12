import {
  Bell,
  BellRing,
  BookOpen,
  Briefcase,
  Building2,
  CircleDot,
  Clapperboard,
  Crown,
  Disc3,
  Drama,
  Drum,
  Footprints,
  Heart,
  HeartHandshake,
  Layers,
  MapPin,
  Megaphone,
  MessageSquare,
  Music,
  Package,
  PawPrint,
  Pencil,
  Play,
  Quote,
  ScrollText,
  Shapes,
  Sparkles,
  Star,
  Tag,
  Triangle,
  UserRound,
  Users,
  Volume2,
  Wind,
  Zap,
} from 'lucide-react';

/** Keywords the app can render as Lucide icons (Banks.icon, Audio.icon). */
export const LUCIDE_ICONS = {
  footprints: Footprints,
  pencil: Pencil,
  'paw-print': PawPrint,
  'user-round': UserRound,
  'building-2': Building2,
  heart: Heart,
  crown: Crown,
  clapperboard: Clapperboard,
  'scroll-text': ScrollText,
  briefcase: Briefcase,
  'map-pin': MapPin,
  tag: Tag,
  package: Package,
  'heart-handshake': HeartHandshake,
  drama: Drama,
  shapes: Shapes,
  music: Music,
  'book-open': BookOpen,
  play: Play,
  quote: Quote,
  layers: Layers,
  'message-square': MessageSquare,
  users: Users,
  star: Star,
  bell: Bell,
  'bell-ring': BellRing,
  drum: Drum,
  zap: Zap,
  'volume-2': Volume2,
  gong: Disc3,
  'disc-3': Disc3,
  triangle: Triangle,
  megaphone: Megaphone,
  sparkles: Sparkles,
  wind: Wind,
  whoosh: Wind,
  'circle-dot': CircleDot,
  waves: Wind,
};

const LUCIDE_COMPACT = Object.fromEntries(
  Object.entries(LUCIDE_ICONS).map(([id, Icon]) => [id.replace(/-/g, ''), Icon]),
);

export const DEFAULT_BANK_ICONS = {
  Activities: 'footprints',
  Adjectives: 'pencil',
  Animals: 'paw-print',
  Characters: 'user-round',
  Companies: 'building-2',
  Emotions: 'heart',
  Famous: 'crown',
  Genres: 'clapperboard',
  Instructions: 'scroll-text',
  Jobs: 'briefcase',
  Locations: 'map-pin',
  Nouns: 'tag',
  Objects: 'package',
  Relationships: 'heart-handshake',
  Scenes: 'drama',
  Shapes: 'shapes',
  Songs: 'music',
  'Story Titles': 'book-open',
  Verbs: 'play',
  Words: 'quote',
  Lines: 'message-square',
  FUT: 'sparkles',
  PlayStyle: 'clapperboard',
  Objectives: 'star',
  CORE: 'layers',
  Core: 'layers',
  'C.O.R.E.': 'layers',
};

export const SKILL_DEFAULT_ICONS = {
  core: 'layers',
  fut: 'sparkles',
  line: 'message-square',
  two: 'users',
  style: 'clapperboard',
  instruction: 'scroll-text',
};

/** Reference rows for the Icons sheet tab. */
export const ICON_CATALOG = [
  { id: 'footprints', name: 'Footprints', kind: 'lucide', sample: '👣' },
  { id: 'pencil', name: 'Pencil', kind: 'lucide', sample: '✏️' },
  { id: 'paw-print', name: 'Paw print', kind: 'lucide', sample: '🐾' },
  { id: 'user-round', name: 'User', kind: 'lucide', sample: '👤' },
  { id: 'building-2', name: 'Buildings', kind: 'lucide', sample: '🏢' },
  { id: 'heart', name: 'Heart', kind: 'lucide', sample: '❤️' },
  { id: 'crown', name: 'Crown', kind: 'lucide', sample: '👑' },
  { id: 'clapperboard', name: 'Clapperboard', kind: 'lucide', sample: '🎬' },
  { id: 'scroll-text', name: 'Scroll', kind: 'lucide', sample: '📜' },
  { id: 'briefcase', name: 'Briefcase', kind: 'lucide', sample: '💼' },
  { id: 'map-pin', name: 'Map pin', kind: 'lucide', sample: '📍' },
  { id: 'tag', name: 'Tag', kind: 'lucide', sample: '🏷️' },
  { id: 'package', name: 'Package', kind: 'lucide', sample: '📦' },
  { id: 'heart-handshake', name: 'Handshake', kind: 'lucide', sample: '🤝' },
  { id: 'drama', name: 'Drama', kind: 'lucide', sample: '🎭' },
  { id: 'shapes', name: 'Shapes', kind: 'lucide', sample: '🔷' },
  { id: 'music', name: 'Music', kind: 'lucide', sample: '🎵' },
  { id: 'book-open', name: 'Open book', kind: 'lucide', sample: '📖' },
  { id: 'play', name: 'Play', kind: 'lucide', sample: '▶️' },
  { id: 'quote', name: 'Quote', kind: 'lucide', sample: '💬' },
  { id: 'layers', name: 'Layers', kind: 'lucide', sample: '📚' },
  { id: 'message-square', name: 'Message', kind: 'lucide', sample: '💭' },
  { id: 'users', name: 'Users', kind: 'lucide', sample: '👥' },
  { id: 'star', name: 'Star', kind: 'lucide', sample: '⭐' },
  { id: 'bell', name: 'Bell', kind: 'lucide', sample: '🔔' },
  { id: 'bell-ring', name: 'Ringing bell', kind: 'lucide', sample: '🔔' },
  { id: 'drum', name: 'Drum', kind: 'lucide', sample: '🥁' },
  { id: 'zap', name: 'Zap', kind: 'lucide', sample: '⚡' },
  { id: 'volume-2', name: 'Volume', kind: 'lucide', sample: '🔊' },
  { id: 'disc-3', name: 'Disc', kind: 'lucide', sample: '💿' },
  { id: 'gong', name: 'Gong (alias of disc-3)', kind: 'lucide', sample: '💿' },
  { id: 'triangle', name: 'Triangle', kind: 'lucide', sample: '🔺' },
  { id: 'megaphone', name: 'Megaphone', kind: 'lucide', sample: '📣' },
  { id: 'sparkles', name: 'Sparkles', kind: 'lucide', sample: '✨' },
  { id: 'wind', name: 'Wind', kind: 'lucide', sample: '💨' },
  { id: 'whoosh', name: 'Whoosh (alias of wind)', kind: 'lucide', sample: '💨' },
  { id: 'waves', name: 'Waves (alias of wind)', kind: 'lucide', sample: '💨' },
  { id: 'circle-dot', name: 'Circle dot', kind: 'lucide', sample: '⏺️' },
  { id: 'any-emoji', name: 'Any emoji works — paste one in an icon cell', kind: 'emoji', sample: '🎲' },
];

export function iconKey(value) {
  return String(value || '').trim().toLowerCase().replace(/[\s_]+/g, '-');
}

export function lucideById(name) {
  const key = iconKey(name);
  if (!key) return undefined;
  return LUCIDE_ICONS[key] || LUCIDE_COMPACT[key.replace(/-/g, '')];
}

export function firstEmoji(value) {
  const match = String(value || '').match(
    /\p{Extended_Pictographic}(?:\uFE0F|\u200D\p{Extended_Pictographic}|\p{Emoji_Modifier})*/u,
  );
  return match ? match[0] : '';
}

export function defaultBankIcon(category, skillId) {
  return DEFAULT_BANK_ICONS[category] || SKILL_DEFAULT_ICONS[skillId] || '';
}
