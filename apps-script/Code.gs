/**
 * Improv Jam — sheet API
 *
 * 1. Run populateCatalog() once from the Apps Script editor.
 * 2. Deploy as Web App: Execute as Me, Who has access: Anyone.
 * 3. Point the PWA at the /exec URL.
 */

// Live tabs — populate writes only these. Keep them.
var TAB_SOURCES = 'Sources';
var TAB_GAMES = 'Games';
var TAB_TERMS = 'Terms';
var TAB_GENERATOR = 'Generator';
var TAB_AUDIO = 'Audio';
var TAB_BANKS = 'Banks';
var TAB_ICONS = 'Icons';
var TAB_HELP = 'Help';

var AUDIO_HEADERS = ['id', 'name', 'kind', 'url', 'icon', 'credit', 'creditUrl', 'notes', 'active', 'tags'];
var SOURCES_HEADERS = ['id', 'name', 'url', 'note', 'active'];
var GAMES_HEADERS = [
  'id', 'name', 'category', 'tags', 'lifeSkills', 'description', 'sourceIds', 'source', 'image',
  'setup', 'howToPlay', 'gimmicks', 'variations', 'synonyms', 'relatedIds', 'sourceUrl', 'active',
];
var TERMS_HEADERS = ['id', 'term', 'category', 'definition', 'sourceIds', 'image', 'sourceUrl', 'definitions', 'active'];
var GENERATOR_HEADERS = ['id', 'categories', 'text', 'extra', 'group', 'active'];
var BANKS_HEADERS = ['id', 'label', 'group', 'icon', 'active'];
var ICONS_HEADERS = ['id', 'name', 'kind', 'sample', 'active'];

function tabSchemas_() {
  return [
    { tab: TAB_SOURCES, headers: SOURCES_HEADERS },
    { tab: TAB_GAMES, headers: GAMES_HEADERS },
    { tab: TAB_TERMS, headers: TERMS_HEADERS },
    { tab: TAB_GENERATOR, headers: GENERATOR_HEADERS },
    { tab: TAB_BANKS, headers: BANKS_HEADERS },
    { tab: TAB_ICONS, headers: ICONS_HEADERS },
    { tab: TAB_AUDIO, headers: AUDIO_HEADERS },
  ];
}

// Legacy prompt tabs — read only if Generator is empty. Safe to delete once Generator has rows.
var TAB_CHAR = 'CORE_Characters';
var TAB_OBJ = 'CORE_Objectives';
var TAB_REL = 'CORE_Relationships';
var TAB_ENV = 'CORE_Environments';
var TAB_FUT = 'FUT';
var TAB_LINES = 'Lines';
var TAB_TWO = 'TwoPerson';
var TAB_STYLES = 'PlayStyles';
var TAB_LOC = 'Suggestions_Locations';
var TAB_OCC = 'Suggestions_Occupations';
var TAB_SREL = 'Suggestions_Relationships';
var TAB_SOBJ = 'Suggestions_Objects';

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Improv Jam')
    .addItem('Update tabs', 'updateTabs')
    .addItem('Create intake form', 'createIntakeForm')
    .addItem('Set media folder', 'setMediaFolder')
    .addSeparator()
    .addItem('Apply Learn Improv patches', 'applyLearnImprovPatches')
    .addItem('Populate catalog (overwrite tabs)', 'populateCatalog')
    .addToUi();
}

function doGet() {
  var payload = readCatalog();
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function updateTabs() {
  var ss = SpreadsheetApp.getActive();
  var results = ensureAllTabs_(ss);
  results.push(ensureKnownSources_(ss));
  results.push(ensureHelpTab_(ss));
  var lines = results.map(function (r) {
    if (r.created) return r.tab + ': created' + (r.added.length ? ' (' + r.added.join(', ') + ')' : '');
    if (r.added && r.added.length) return r.tab + ': added ' + r.added.join(', ');
    return r.tab + ': already current';
  });
  SpreadsheetApp.getUi().alert('Update tabs', lines.join('\n') + '\n\nExisting catalog rows were not overwritten.', SpreadsheetApp.getUi().ButtonSet.OK);
  return results;
}

function ensureAudioTab() {
  ensureAllTabs_(SpreadsheetApp.getActive());
  return TAB_AUDIO;
}

function ensureImageColumns() {
  ensureAllTabs_(SpreadsheetApp.getActive());
}

function ensureAllTabs_(ss) {
  return tabSchemas_().map(function (schema) {
    return ensureTabHeaders_(ss, schema.tab, schema.headers);
  });
}

function knownHeaders_() {
  var seen = {};
  var out = [];
  tabSchemas_().forEach(function (schema) {
    schema.headers.forEach(function (h) {
      if (!seen[h]) {
        seen[h] = true;
        out.push(h);
      }
    });
  });
  return out;
}

function canonHeader_(name) {
  var raw = String(name == null ? '' : name).trim();
  if (!raw) return '';
  var compact = raw.replace(/[\s_-]+/g, '').toLowerCase();
  var aliases = {
    crediturl: 'creditUrl',
    lifeskills: 'lifeSkills',
    sourceids: 'sourceIds',
    howtoplay: 'howToPlay',
    relatedids: 'relatedIds',
    sourceurl: 'sourceUrl',
    enabled: 'active',
    section: 'group',
    grouping: 'group',
  };
  if (aliases[compact]) return aliases[compact];
  var known = knownHeaders_();
  for (var i = 0; i < known.length; i++) {
    if (known[i].replace(/[\s_-]+/g, '').toLowerCase() === compact) return known[i];
  }
  return raw;
}

function headerIndex_(headers, name) {
  var want = canonHeader_(name).toLowerCase();
  for (var i = 0; i < headers.length; i++) {
    if (canonHeader_(headers[i]).toLowerCase() === want) return i;
  }
  return -1;
}

function ensureTabHeaders_(ss, tab, headers) {
  var sheet = ss.getSheetByName(tab);
  var created = false;
  if (!sheet) {
    sheet = ss.insertSheet(tab);
    created = true;
  }
  if (sheet.getLastRow() < 1) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    if (tab === TAB_AUDIO) seedAudioDefaults_(sheet);
    finishTabSetup_(sheet, tab);
    return { tab: tab, created: true, added: headers.slice() };
  }
  var last = Math.max(sheet.getLastColumn(), 1);
  var existing = sheet.getRange(1, 1, 1, last).getValues()[0];
  while (existing.length && !String(existing[existing.length - 1]).trim()) existing.pop();
  if (!existing.length) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    existing = headers.slice();
    created = true;
  }
  var added = [];
  headers.forEach(function (name) {
    if (headerIndex_(existing, name) >= 0) return;
    existing.push(name);
    added.push(name);
    sheet.getRange(1, existing.length).setValue(name);
  });
  sheet.setFrozenRows(1);
  if (tab === TAB_AUDIO && sheet.getLastRow() < 2) seedAudioDefaults_(sheet);
  finishTabSetup_(sheet, tab);
  return { tab: tab, created: created, added: added };
}

function finishTabSetup_(sheet, tab) {
  if (tab === TAB_GENERATOR) ensureGroupValidation_(sheet);
  if (tab === TAB_BANKS) {
    seedBanksIfEmpty_(sheet);
    ensureGroupValidation_(sheet);
  }
  if (tab === TAB_ICONS) {
    seedIconsIfEmpty_(sheet);
    ensureIconKindValidation_(sheet);
  }
  ensureActiveCheckboxes_(sheet);
}

function ensureActiveCheckboxes_(sheet) {
  var last = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, last).getValues()[0];
  var col = headerIndex_(headers, 'active') + 1;
  if (col < 1) return;
  var idCol = headerIndex_(headers, 'id') + 1;
  if (idCol < 1) idCol = headerIndex_(headers, 'term') + 1;
  var dataRows = Math.max(sheet.getLastRow() - 1, 0);
  if (dataRows < 1) return;
  var rule = SpreadsheetApp.newDataValidation()
    .requireCheckbox()
    .setAllowInvalid(true)
    .setHelpText('Uncheck to hide this row in the app without deleting it.')
    .build();
  var range = sheet.getRange(2, col, dataRows, 1);
  var vals = range.getValues();
  var ids = idCol > 0 ? sheet.getRange(2, idCol, dataRows, 1).getValues() : [];
  var i;
  var lastFilled = 0;
  for (i = 0; i < vals.length; i++) {
    var hasRow = String((ids[i] && ids[i][0]) || '').trim();
    if (!hasRow) {
      vals[i][0] = '';
      continue;
    }
    lastFilled = i + 1;
    var raw = vals[i][0];
    if (raw === false || raw === 'FALSE' || String(raw).toLowerCase() === 'false' || raw === 0) {
      vals[i][0] = false;
    } else {
      vals[i][0] = true;
    }
  }
  range.setValues(vals);
  range.clearDataValidations();
  if (lastFilled > 0) {
    sheet.getRange(2, col, lastFilled, 1).setDataValidation(rule);
  }
}

function ensureGroupValidation_(sheet) {
  var last = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, last).getValues()[0];
  var col = headerIndex_(headers, 'group') + 1;
  if (col < 1) return;
  var rows = Math.max(sheet.getMaxRows() - 1, 1);
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['Ask-for', 'Skill Building', 'Both'], true)
    .setAllowInvalid(true)
    .setHelpText('Ask-for, Skill Building, or Both. Blank uses the app default for that category.')
    .build();
  sheet.getRange(2, col, rows, 1).setDataValidation(rule);
}

function ensureIconKindValidation_(sheet) {
  var last = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, last).getValues()[0];
  var col = headerIndex_(headers, 'kind') + 1;
  if (col < 1) return;
  var rows = Math.max(sheet.getMaxRows() - 1, 1);
  var rule = SpreadsheetApp.newDataValidation()
    .requireValueInList(['lucide', 'emoji'], true)
    .setAllowInvalid(true)
    .setHelpText('lucide = keyword from this tab. emoji = any emoji also works in an icon cell.')
    .build();
  sheet.getRange(2, col, rows, 1).setDataValidation(rule);
}

function seedIfEmpty_(sheet, headers, rows) {
  if (sheet.getLastRow() >= 2) return;
  if (!rows.length) return;
  var padded = rows.map(function (row) {
    var next = row.slice();
    while (next.length < headers.length) next.push(headers[next.length] === 'active' ? true : '');
    return next;
  });
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(2, 1, padded.length, headers.length).setValues(padded);
  sheet.setFrozenRows(1);
}

function seedIconsIfEmpty_(sheet) {
  seedIfEmpty_(sheet, ICONS_HEADERS, iconSeedRows_());
}

function seedBanksIfEmpty_(sheet) {
  seedIfEmpty_(sheet, BANKS_HEADERS, bankSeedRows_());
}

function iconSeedRows_() {
  return [
    ['footprints', 'Footprints', 'lucide', '👣'],
    ['pencil', 'Pencil', 'lucide', '✏️'],
    ['paw-print', 'Paw print', 'lucide', '🐾'],
    ['user-round', 'User', 'lucide', '👤'],
    ['building-2', 'Buildings', 'lucide', '🏢'],
    ['heart', 'Heart', 'lucide', '❤️'],
    ['crown', 'Crown', 'lucide', '👑'],
    ['clapperboard', 'Clapperboard', 'lucide', '🎬'],
    ['scroll-text', 'Scroll', 'lucide', '📜'],
    ['briefcase', 'Briefcase', 'lucide', '💼'],
    ['map-pin', 'Map pin', 'lucide', '📍'],
    ['tag', 'Tag', 'lucide', '🏷️'],
    ['package', 'Package', 'lucide', '📦'],
    ['heart-handshake', 'Handshake', 'lucide', '🤝'],
    ['drama', 'Drama', 'lucide', '🎭'],
    ['shapes', 'Shapes', 'lucide', '🔷'],
    ['music', 'Music', 'lucide', '🎵'],
    ['book-open', 'Open book', 'lucide', '📖'],
    ['play', 'Play', 'lucide', '▶️'],
    ['quote', 'Quote', 'lucide', '💬'],
    ['layers', 'Layers', 'lucide', '📚'],
    ['message-square', 'Message', 'lucide', '💭'],
    ['users', 'Users', 'lucide', '👥'],
    ['star', 'Star', 'lucide', '⭐'],
    ['bell', 'Bell', 'lucide', '🔔'],
    ['bell-ring', 'Ringing bell', 'lucide', '🔔'],
    ['drum', 'Drum', 'lucide', '🥁'],
    ['zap', 'Zap', 'lucide', '⚡'],
    ['volume-2', 'Volume', 'lucide', '🔊'],
    ['disc-3', 'Disc', 'lucide', '💿'],
    ['gong', 'Gong (alias of disc-3)', 'lucide', '💿'],
    ['triangle', 'Triangle', 'lucide', '🔺'],
    ['megaphone', 'Megaphone', 'lucide', '📣'],
    ['sparkles', 'Sparkles', 'lucide', '✨'],
    ['wind', 'Wind', 'lucide', '💨'],
    ['whoosh', 'Whoosh (alias of wind)', 'lucide', '💨'],
    ['waves', 'Waves (alias of wind)', 'lucide', '💨'],
    ['circle-dot', 'Circle dot', 'lucide', '⏺️'],
    ['any-emoji', 'Any emoji works — paste one in an icon cell', 'emoji', '🎲'],
  ];
}

function bankSeedRows_() {
  return [
    ['Activities', 'Activities', 'Ask-for', 'footprints'],
    ['Adjectives', 'Adjectives', 'Ask-for', 'pencil'],
    ['Animals', 'Animals', 'Ask-for', 'paw-print'],
    ['Characters', 'Characters', 'Ask-for', 'user-round'],
    ['Companies', 'Companies', 'Ask-for', 'building-2'],
    ['Emotions', 'Emotions', 'Ask-for', 'heart'],
    ['Famous', 'Famous', 'Ask-for', 'crown'],
    ['Genres', 'Genres', 'Ask-for', 'clapperboard'],
    ['Instructions', 'Instructions', 'Both', 'scroll-text'],
    ['Jobs', 'Jobs', 'Ask-for', 'briefcase'],
    ['Lines', 'Line in a Pocket', 'Skill Building', 'message-square'],
    ['Locations', 'Locations', 'Ask-for', 'map-pin'],
    ['Nouns', 'Nouns', 'Ask-for', 'tag'],
    ['Objects', 'Objects', 'Ask-for', 'package'],
    ['Objectives', 'Objectives', 'Skill Building', 'star'],
    ['PlayStyle', 'Play styles', 'Skill Building', 'clapperboard'],
    ['Relationships', 'Relationships', 'Ask-for', 'heart-handshake'],
    ['Scenes', 'Scenes', 'Both', 'drama'],
    ['Shapes', 'Shapes', 'Ask-for', 'shapes'],
    ['Songs', 'Songs', 'Ask-for', 'music'],
    ['Story Titles', 'Story titles', 'Ask-for', 'book-open'],
    ['Verbs', 'Verbs', 'Ask-for', 'play'],
    ['Words', 'Words', 'Ask-for', 'quote'],
    ['FUT', 'F.U.T.', 'Skill Building', 'sparkles'],
    ['CORE', 'C.O.R.E.', 'Skill Building', 'layers'],
  ];
}

function seedAudioDefaults_(sheet) {
  if (sheet.getLastRow() >= 2) return;
  sheet.getRange(2, 1, 2, AUDIO_HEADERS.length).setValues([
    [
      'counter',
      'Counter Bell',
      'SFX',
      '/sounds/counter-bell.mp3',
      'bell',
      'Alva Majo (5ro4), CC0',
      'https://freesound.org/people/5ro4/sounds/611113/',
      'Tap; hold to sustain',
      'TRUE',
      '',
    ],
    [
      'ringing',
      'Ringing Bell',
      'SFX',
      '/sounds/ringing-bell.mp3',
      'bell-ring',
      'designerschoice / Nicholas Judy, CC BY',
      'https://freesound.org/people/designerschoice/sounds/804750/',
      'Tap one ring; hold to keep ringing',
      'TRUE',
      '',
    ],
  ]);
}

function applyLearnImprovPatches() {
  if (typeof LEARN_IMPROV_PATCHES === 'undefined') {
    throw new Error('LearnImprovPatches.gs is missing. Push the apps-script folder with clasp.');
  }
  var ss = SpreadsheetApp.getActive();
  ensureAllTabs_(ss);
  ensureKnownSources_(ss);
  upsertSource_(ss, typeof LEARN_IMPROV_SOURCE === 'undefined' ? {
    id: 'src-learnimprov',
    name: 'Learn Improv',
    url: 'https://www.learnimprov.com/',
    note: 'CC BY-SA 4.0. https://www.learnimprov.com/about/legal/',
  } : LEARN_IMPROV_SOURCE);
  var sheet = ss.getSheetByName(TAB_GAMES);
  var last = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, last).getValues()[0];
  var updated = [];
  var missing = [];
  LEARN_IMPROV_PATCHES.forEach(function (patch) {
    if (applyRowPatch_(sheet, headers, patch.id, patch)) updated.push(patch.id);
    else missing.push(patch.id);
  });
  ensureActiveCheckboxes_(sheet);
  var msg = 'Updated ' + updated.length + ' games.';
  if (missing.length) msg += '\nNot found: ' + missing.join(', ');
  SpreadsheetApp.getUi().alert('Learn Improv patches', msg, SpreadsheetApp.getUi().ButtonSet.OK);
  return { updated: updated, missing: missing };
}

function knownAttributionSources_() {
  return [
    {
      id: 'src-jam-terms',
      name: 'Improv Jam Terms',
      url: '',
      note: 'Teaching notes from Improv-Terms.pdf — essentials, games, and pitfalls used in rehearsal.',
    },
    {
      id: 'src-encyclopedia',
      name: 'Improv Encyclopedia',
      url: 'https://improvencyclopedia.org/Download.html',
      note: 'Version 2.0.6 catalog entries. Free to use with attribution to improvencyclopedia.org.',
    },
    {
      id: 'src-learnimprov',
      name: 'Learn Improv',
      url: 'https://www.learnimprov.com/',
      note: 'CC BY-SA 4.0. https://www.learnimprov.com/about/legal/',
    },
  ];
}

function ensureKnownSources_(ss) {
  ensureTabHeaders_(ss, TAB_SOURCES, SOURCES_HEADERS);
  var added = [];
  knownAttributionSources_().forEach(function (source) {
    if (upsertSource_(ss, source)) added.push(source.id);
  });
  return { tab: TAB_SOURCES, created: false, added: added };
}

function helpTabRows_() {
  return [
    ['Topic', 'Details'],
    ['Sync', 'Edit this Google Sheet, then tap Sync Data in the app. Games, glossary, generator banks, and Audio (SFX / Track) refresh on the device. To Play, Favorites, Played, custom sets, and hidden SFX pads stay on the device.'],
    ['Audio credits', 'Credits live on the Audio tab (credit, creditUrl). SFX icons use the icon column (drum, bell-ring, or an emoji like 🥁).'],
    ['Music tags', 'Tracks use the tags column only — no genre column (Pop, 80s, Underscore — comma or pipe separated). People can also tag on the device in Music.'],
    ['Photos', 'Game and glossary photos use the image column (Drive share link, Anyone with the link).'],
    ['Audio url', 'Must be a Drive file share link (not a folder), Anyone with the link → Viewer, under 25MB.'],
    ['Update tabs', 'Improv Jam → Update tabs adds missing columns (tags, image, Generator group) and creates the Icons, Banks, and Help tabs without overwriting catalog rows.'],
    ['Generator / Banks', 'Generator categories live on the Banks tab: set group to Ask-for, Skill Building, or Both, and icon to a keyword from the Icons tab (footprints, drum, sparkles) or any emoji. Leave Generator group blank to use the Banks value; fill a row to override that category.'],
    ['sourceIds', 'Pipe-separated ids that match the Sources tab (src-encyclopedia, src-learnimprov, src-jam-terms). This is what the app uses to decide which sites a card should link to.'],
    ['source', 'Display label only (for example "Improv Encyclopedia"). Not used for outbound links.'],
    ['sourceUrl', 'Optional per-row page URL for that game or term. The app uses it only when the URL belongs to one of the row’s sourceIds (same site). A Learn Improv URL is ignored on an Encyclopedia-only or jam-only row.'],
    ['Sources tab url', 'Homepage / attribution URL for a sourceId. Used when the row has no matching sourceUrl for that source.'],
    ['Merging Learn Improv', 'Apply Learn Improv patches adds src-learnimprov and may set sourceUrl to the Learn Improv page. Existing Improv Encyclopedia page URLs are preserved. Encyclopedia and jam source rows are not removed.'],
  ];
}

function ensureHelpTab_(ss) {
  var sheet = ss.getSheetByName(TAB_HELP);
  var created = false;
  if (!sheet) {
    sheet = ss.insertSheet(TAB_HELP);
    created = true;
  }
  var rows = helpTabRows_();
  sheet.clear();
  sheet.getRange(1, 1, rows.length, 2).setValues(rows);
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 200);
  sheet.setColumnWidth(2, 760);
  sheet.getRange(1, 1, 1, 2).setFontWeight('bold');
  sheet.setTabColor('#1d4ed8');
  return { tab: TAB_HELP, created: created, added: created ? ['documentation'] : [] };
}

function upsertSource_(ss, source) {
  var sheet = ss.getSheetByName(TAB_SOURCES);
  var last = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, last).getValues()[0];
  var idCol = headerIndex_(headers, 'id') + 1;
  var values = sheet.getDataRange().getValues();
  var row = -1;
  var created = false;
  var r;
  for (r = 1; r < values.length; r++) {
    if (String(values[r][idCol - 1]) === source.id) {
      row = r + 1;
      break;
    }
  }
  if (row < 0) {
    row = sheet.getLastRow() + 1;
    sheet.getRange(row, idCol).setValue(source.id);
    created = true;
  }
  ['name', 'url', 'note'].forEach(function (key) {
    var col = headerIndex_(headers, key) + 1;
    if (col < 1 || !source[key]) return;
    var current = String(sheet.getRange(row, col).getValue() || '').trim();
    if (!current) sheet.getRange(row, col).setValue(source[key]);
  });
  var activeCol = headerIndex_(headers, 'active') + 1;
  if (activeCol > 0 && (created || source.id === 'src-encyclopedia' || source.id === 'src-learnimprov' || source.id === 'src-jam-terms')) {
    sheet.getRange(row, activeCol).setValue(true);
  }
  return created;
}

function applyRowPatch_(sheet, headers, id, patch) {
  var idCol = headerIndex_(headers, 'id');
  if (idCol < 0) return false;
  var values = sheet.getDataRange().getValues();
  var r;
  for (r = 1; r < values.length; r++) {
    if (String(values[r][idCol]) !== id) continue;
    Object.keys(patch).forEach(function (key) {
      if (key === 'id') return;
      var col = headerIndex_(headers, key);
      if (col < 0) return;
      if (canonHeader_(key) === 'sourceUrl' && shouldKeepExistingSourceUrl_(values[r][col], patch[key])) {
        return;
      }
      sheet.getRange(r + 1, col + 1).setValue(patchCellValue_(key, patch[key]));
    });
    return true;
  }
  return false;
}

function hostOfUrl_(value) {
  var raw = String(value == null ? '' : value).trim();
  var match = raw.match(/^https?:\/\/([^/]+)/i);
  if (!match) return '';
  return String(match[1] || '').replace(/^www\./i, '').toLowerCase();
}

function shouldKeepExistingSourceUrl_(existing, next) {
  var currentHost = hostOfUrl_(existing);
  var nextHost = hostOfUrl_(next);
  if (!currentHost || !nextHost || currentHost === nextHost) return false;
  return currentHost.indexOf('improvencyclopedia.org') >= 0 && nextHost.indexOf('learnimprov.com') >= 0;
}

function patchCellValue_(key, value) {
  var header = canonHeader_(key);
  if (header === 'active') return isActiveValue_(value);
  if (value == null) return '';
  if (header === 'sourceIds' || header === 'tags' || header === 'lifeSkills' || header === 'relatedIds') {
    if (Object.prototype.toString.call(value) === '[object Array]') {
      return value.map(function (v) { return String(v == null ? '' : v).trim(); }).filter(Boolean).join('|');
    }
    return String(value);
  }
  if (Object.prototype.toString.call(value) === '[object Array]') return String(value);
  return value;
}

function populateCatalog() {
  if (typeof CATALOG_DATA === 'undefined') {
    throw new Error('CatalogData.gs is missing. Push the apps-script folder with clasp.');
  }
  var ss = SpreadsheetApp.getActive();
  ensureAllTabs_(ss);
  var gameImages = imageMap_(ss, TAB_GAMES, 'id');
  var termImages = imageMap_(ss, TAB_TERMS, 'id');
  var sourceActive = activeMap_(ss, TAB_SOURCES);
  var gameActive = activeMap_(ss, TAB_GAMES);
  var termActive = activeMap_(ss, TAB_TERMS);
  var generatorActive = activeMap_(ss, TAB_GENERATOR);
  var gameSetup = fieldMap_(ss, TAB_GAMES, 'id', 'setup');
  var gameHow = fieldMap_(ss, TAB_GAMES, 'id', 'howToPlay');
  var gameGimmicks = fieldMap_(ss, TAB_GAMES, 'id', 'gimmicks');
  var gameVariations = fieldMap_(ss, TAB_GAMES, 'id', 'variations');
  var gameSynonyms = fieldMap_(ss, TAB_GAMES, 'id', 'synonyms');
  var gameRelated = fieldMap_(ss, TAB_GAMES, 'id', 'relatedIds');
  var gameSourceUrl = fieldMap_(ss, TAB_GAMES, 'id', 'sourceUrl');
  var termSourceUrl = fieldMap_(ss, TAB_TERMS, 'id', 'sourceUrl');
  var termDefinitions = fieldMap_(ss, TAB_TERMS, 'id', 'definitions');
  writeRows_(ss, TAB_SOURCES, SOURCES_HEADERS, CATALOG_DATA.sources.map(function (s) {
    return [s.id, s.name, s.url || '', s.note || '', activeCell_(sourceActive, s.id, s.active)];
  }));
  ensureKnownSources_(ss);
  ensureHelpTab_(ss);
  writeRows_(ss, TAB_GAMES, GAMES_HEADERS, CATALOG_DATA.games.map(function (g) {
    var id = g.id;
    return [
      id,
      g.name,
      g.category,
      (g.tags || []).join('|'),
      (g.lifeSkills || []).join('|'),
      g.description,
      (g.sourceIds || []).join('|'),
      g.source || '',
      g.image || gameImages[id] || '',
      g.setup || gameSetup[id] || '',
      g.howToPlay || gameHow[id] || '',
      g.gimmicks || gameGimmicks[id] || '',
      g.variations || gameVariations[id] || '',
      g.synonyms || gameSynonyms[id] || '',
      g.relatedIds || gameRelated[id] || '',
      g.sourceUrl || gameSourceUrl[id] || '',
      activeCell_(gameActive, id, g.active),
    ];
  }));
  writeRows_(ss, TAB_TERMS, TERMS_HEADERS, CATALOG_DATA.terms.map(function (t) {
    var id = t.id || '';
    return [
      id,
      t.term,
      t.category,
      t.definition,
      (t.sourceIds || []).join('|'),
      t.image || termImages[id] || '',
      t.sourceUrl || termSourceUrl[id] || '',
      t.definitions || termDefinitions[id] || '',
      activeCell_(termActive, id, t.active),
    ];
  }));
  var generatorGroups = fieldMap_(ss, TAB_GENERATOR, 'id', 'group');
  var generator = CATALOG_DATA.generator || [];
  writeRows_(ss, TAB_GENERATOR, GENERATOR_HEADERS, generator.map(function (row) {
    var id = row.id || '';
    var cats = formatCats_(row.categories || row.category || '');
    return [
      id,
      cats,
      row.text || '',
      row.extra || '',
      row.group || generatorGroups[id] || defaultGeneratorGroup_(cats),
      activeCell_(generatorActive, id, row.active),
    ];
  }));
  ensureAllTabs_(ss);
}

function normalizeGenerator_(row) {
  return {
    id: String((row && row.id) || ''),
    categories: formatCats_((row && (row.categories || row.category)) || ''),
    text: String((row && row.text != null) ? row.text : ''),
    extra: String((row && row.extra != null) ? row.extra : ''),
    group: String((row && row.group) != null ? row.group : ''),
  };
}

function defaultGeneratorGroup_(cats) {
  var list = splitCats_(cats);
  var i;
  for (i = 0; i < list.length; i++) {
    var cat = list[i];
    if (cat === 'FUT' || cat === 'PlayStyle' || cat === 'Lines' || cat === 'Objectives' || cat === 'CORE' || cat === 'C.O.R.E.') {
      return 'Skill Building';
    }
  }
  return '';
}

function readCatalog() {
  var ss = SpreadsheetApp.getActive();
  ensureAllTabs_(ss);
  var generator = objectsFrom_(ss, TAB_GENERATOR).map(normalizeGenerator_);
  var prompts = generator.length ? promptsFromGenerator_(generator, {}) : {
    core: {
      characters: valuesFrom_(ss, TAB_CHAR),
      objectives: valuesFrom_(ss, TAB_OBJ),
      relationships: valuesFrom_(ss, TAB_REL),
      environments: valuesFrom_(ss, TAB_ENV),
    },
    fut: objectsFrom_(ss, TAB_FUT),
    lines: valuesFrom_(ss, TAB_LINES),
    twoPerson: valuesFrom_(ss, TAB_TWO),
    playStyles: objectsFrom_(ss, TAB_STYLES),
    suggestions: {
      locations: valuesFrom_(ss, TAB_LOC),
      occupations: valuesFrom_(ss, TAB_OCC),
      relationships: valuesFrom_(ss, TAB_SREL),
      objects: valuesFrom_(ss, TAB_SOBJ),
    },
  };
  return {
    sources: objectsFrom_(ss, TAB_SOURCES),
    games: objectsFrom_(ss, TAB_GAMES).map(splitFields_),
    terms: objectsFrom_(ss, TAB_TERMS).map(splitFields_).map(ensureTermId_),
    generator: generator,
    banks: objectsFrom_(ss, TAB_BANKS),
    icons: objectsFrom_(ss, TAB_ICONS),
    prompts: prompts,
    audio: objectsFrom_(ss, TAB_AUDIO).map(splitFields_),
  };
}

function ensureTermId_(row) {
  if (!row.id && row.term) row.id = 'term-' + String(row.term).toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return row;
}

function splitCats_(raw) {
  return String(raw || '').split(/[|,]/).map(function (s) { return s.trim(); }).filter(Boolean);
}

function formatCats_(raw) {
  return splitCats_(raw).join(', ');
}

function rowCats_(row) {
  return splitCats_((row && (row.categories || row.category)) || '');
}

function promptsFromGenerator_(rows, fallback) {
  var out = {
    core: { characters: [], objectives: [], relationships: [], environments: [] },
    fut: [],
    lines: [],
    twoPerson: [],
    playStyles: [],
    instructions: [],
    suggestions: { locations: [], occupations: [], relationships: [], objects: [] },
  };
  (rows || []).forEach(function (row) {
    var text = String(row.text || '').trim();
    var extra = String(row.extra || '').trim();
    if (!text) return;
    rowCats_(row).forEach(function (cat) {
      if (cat === 'Characters' || cat === 'Character') out.core.characters.push(text);
      else if (cat === 'Objectives' || cat === 'Objective') out.core.objectives.push(text);
      else if (cat === 'Relationships' || cat === 'Relationship') {
        out.core.relationships.push(text);
        out.suggestions.relationships.push(text);
      }
      else if (cat === 'Locations' || cat === 'Location') {
        out.core.environments.push(text);
        out.suggestions.locations.push(text);
      }
      else if (cat === 'Objects' || cat === 'Object') out.suggestions.objects.push(text);
      else if (cat === 'Jobs' || cat === 'Occupation') out.suggestions.occupations.push(text);
      else if (cat === 'Lines' || cat === 'Line') out.lines.push(text);
      else if (cat === 'Scenes' || cat === 'Prompt') out.twoPerson.push(text);
      else if (cat === 'PlayStyle') out.playStyles.push({ name: text, description: extra });
      else if (cat === 'FUT') out.fut.push({ reality: text, weirdThing: extra });
      else if (cat === 'Instructions') out.instructions.push(text);
    });
  });
  var fb = fallback || {};
  if (!out.core.characters.length && fb.core) out.core.characters = (fb.core.characters || []);
  if (!out.core.objectives.length && fb.core) out.core.objectives = (fb.core.objectives || []);
  if (!out.core.relationships.length && fb.core) out.core.relationships = (fb.core.relationships || []);
  if (!out.core.environments.length && fb.core) out.core.environments = (fb.core.environments || []);
  if (!out.lines.length && fb.lines) out.lines = fb.lines;
  if (!out.twoPerson.length && fb.twoPerson) out.twoPerson = fb.twoPerson;
  if (!out.fut.length && fb.fut) out.fut = fb.fut;
  if (!out.playStyles.length && fb.playStyles) out.playStyles = fb.playStyles;
  if (fb.suggestions) {
    if (!out.suggestions.objects.length) out.suggestions.objects = fb.suggestions.objects || [];
    if (!out.suggestions.occupations.length) out.suggestions.occupations = fb.suggestions.occupations || [];
  }
  return out;
}

function splitFields_(row) {
  ['tags', 'lifeSkills', 'sourceIds'].forEach(function (key) {
    if (typeof row[key] === 'string') {
      row[key] = splitCats_(row[key]);
    } else if (Array.isArray(row[key])) {
      row[key] = splitCats_(row[key].join(','));
    }
  });
  return row;
}

function ensureSheet_(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (headers && headers.length) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return sheet;
}

function writeRows_(ss, name, headers, rows) {
  var sheet = ensureSheet_(ss, name, headers);
  sheet.clearContents();
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  if (!rows.length) return;
  var chunk = 400;
  for (var i = 0; i < rows.length; i += chunk) {
    var part = rows.slice(i, i + chunk);
    sheet.getRange(i + 2, 1, part.length, headers.length).setValues(part);
  }
}

function objectsFrom_(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) return [];
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0].map(function (h) { return canonHeader_(String(h).trim()); });
  return values.slice(1).map(function (row) {
    var obj = {};
    headers.forEach(function (h, i) {
      if (!h) return;
      obj[h] = row[i];
    });
    return obj;
  }).filter(function (obj) {
    if (name === TAB_SOURCES) return String(obj.id || '').trim();
    return String(obj.id || obj.term || obj.name || obj.text || '').trim();
  });
}

function valuesFrom_(ss, name) {
  return objectsFrom_(ss, name).map(function (row) {
    return row.text || row.name || Object.values(row)[0];
  }).filter(Boolean);
}

function fieldMap_(ss, tab, idKey, field) {
  var map = {};
  objectsFrom_(ss, tab).forEach(function (row) {
    var id = String((row && (row[idKey] || row.id)) || '');
    var value = String((row && row[field]) || '').trim();
    if (id && value) map[id] = value;
  });
  return map;
}

function isActiveValue_(raw) {
  if (raw === false || raw === 0) return false;
  var text = String(raw == null ? '' : raw).trim().toLowerCase();
  if (text === 'false' || text === 'no' || text === '0' || text === 'off') return false;
  return true;
}

function activeMap_(ss, tab) {
  var map = {};
  objectsFrom_(ss, tab).forEach(function (row) {
    var id = String((row && row.id) || '');
    if (!id) return;
    var raw = row.active != null && row.active !== '' ? row.active : row.enabled;
    map[id] = isActiveValue_(raw);
  });
  return map;
}

function activeCell_(map, id, fallback) {
  if (Object.prototype.hasOwnProperty.call(map, id)) return map[id];
  return isActiveValue_(fallback == null ? true : fallback);
}

function imageMap_(ss, tab, idKey) {
  var map = {};
  objectsFrom_(ss, tab).forEach(function (row) {
    var id = String((row && (row[idKey] || row.id)) || '');
    var image = String((row && row.image) || '').trim();
    if (id && image) map[id] = image;
  });
  return map;
}

