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

var AUDIO_HEADERS = ['id', 'name', 'kind', 'url', 'icon', 'credit', 'creditUrl', 'notes', 'enabled', 'tags'];
var SOURCES_HEADERS = ['id', 'name', 'url', 'note'];
var GAMES_HEADERS = ['id', 'name', 'category', 'tags', 'lifeSkills', 'description', 'sourceIds', 'source', 'image'];
var TERMS_HEADERS = ['id', 'term', 'category', 'definition', 'sourceIds', 'image'];
var GENERATOR_HEADERS = ['id', 'categories', 'text', 'extra', 'group'];

function tabSchemas_() {
  return [
    { tab: TAB_SOURCES, headers: SOURCES_HEADERS },
    { tab: TAB_GAMES, headers: GAMES_HEADERS },
    { tab: TAB_TERMS, headers: TERMS_HEADERS },
    { tab: TAB_GENERATOR, headers: GENERATOR_HEADERS },
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
  var results = ensureAllTabs_(SpreadsheetApp.getActive());
  var lines = results.map(function (r) {
    if (r.created) return r.tab + ': created' + (r.added.length ? ' (' + r.added.join(', ') + ')' : '');
    if (r.added.length) return r.tab + ': added ' + r.added.join(', ');
    return r.tab + ': already current';
  });
  SpreadsheetApp.getUi().alert('Update tabs', lines.join('\n') + '\n\nExisting rows were not overwritten.', SpreadsheetApp.getUi().ButtonSet.OK);
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
    if (tab === TAB_GENERATOR) ensureGroupValidation_(sheet);
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
  if (tab === TAB_GENERATOR) ensureGroupValidation_(sheet);
  return { tab: tab, created: created, added: added };
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

function populateCatalog() {
  if (typeof CATALOG_DATA === 'undefined') {
    throw new Error('CatalogData.gs is missing. Push the apps-script folder with clasp.');
  }
  var ss = SpreadsheetApp.getActive();
  var gameImages = imageMap_(ss, TAB_GAMES, 'id');
  var termImages = imageMap_(ss, TAB_TERMS, 'id');
  writeRows_(ss, TAB_SOURCES, ['id', 'name', 'url', 'note'], CATALOG_DATA.sources.map(function (s) {
    return [s.id, s.name, s.url || '', s.note || ''];
  }));
  writeRows_(ss, TAB_GAMES, ['id', 'name', 'category', 'tags', 'lifeSkills', 'description', 'sourceIds', 'source', 'image'], CATALOG_DATA.games.map(function (g) {
    return [
      g.id,
      g.name,
      g.category,
      (g.tags || []).join('|'),
      (g.lifeSkills || []).join('|'),
      g.description,
      (g.sourceIds || []).join('|'),
      g.source || '',
      g.image || gameImages[g.id] || '',
    ];
  }));
  writeRows_(ss, TAB_TERMS, ['id', 'term', 'category', 'definition', 'sourceIds', 'image'], CATALOG_DATA.terms.map(function (t) {
    var id = t.id || '';
    return [id, t.term, t.category, t.definition, (t.sourceIds || []).join('|'), t.image || termImages[id] || ''];
  }));
  var generatorGroups = fieldMap_(ss, TAB_GENERATOR, 'id', 'group');
  var generator = CATALOG_DATA.generator || [];
  writeRows_(ss, TAB_GENERATOR, ['id', 'categories', 'text', 'extra', 'group'], generator.map(function (row) {
    var id = row.id || '';
    var cats = formatCats_(row.categories || row.category || '');
    return [id, cats, row.text || '', row.extra || '', row.group || generatorGroups[id] || defaultGeneratorGroup_(cats)];
  }));
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
  return values.slice(1).filter(function (row) { return row.join('').trim(); }).map(function (row) {
    var obj = {};
    headers.forEach(function (h, i) {
      if (!h) return;
      obj[h] = row[i];
    });
    return obj;
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

function imageMap_(ss, tab, idKey) {
  var map = {};
  objectsFrom_(ss, tab).forEach(function (row) {
    var id = String((row && (row[idKey] || row.id)) || '');
    var image = String((row && row.image) || '').trim();
    if (id && image) map[id] = image;
  });
  return map;
}

