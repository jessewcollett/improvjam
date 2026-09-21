const NSFW_WORDS = [
  'anal',
  'blowjob',
  'cock',
  'cunt',
  'cum',
  'dick',
  'faggot',
  'fuck',
  'handjob',
  'incest',
  'nigger',
  'nigga',
  'pedo',
  'pedophile',
  'porn',
  'pussy',
  'rape',
  'rapist',
  'shit',
  'slut',
  'whore',
];

const NSFW_RE = new RegExp(`\\b(?:${NSFW_WORDS.join('|')})\\b`, 'i');

export function looksNsfw(text) {
  return NSFW_RE.test(String(text || ''));
}

export function ideaIsNsfw(entry) {
  if (!entry) return false;
  if (typeof entry === 'object' && entry.flag === 'nsfw') return true;
  const text = typeof entry === 'string' ? entry : String(entry.text || '');
  return looksNsfw(text);
}
