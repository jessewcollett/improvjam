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
    .addItem('Populate catalog (overwrite tabs)', 'populateCatalog')
    .addToUi();
}

function doGet() {
  var payload = readCatalog();
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function populateCatalog() {
  if (typeof CATALOG_DATA === 'undefined') {
    throw new Error('CatalogData.gs is missing. Push the apps-script folder with clasp.');
  }
  var ss = SpreadsheetApp.getActive();
  writeRows_(ss, TAB_SOURCES, ['id', 'name', 'url', 'note'], CATALOG_DATA.sources.map(function (s) {
    return [s.id, s.name, s.url || '', s.note || ''];
  }));
  writeRows_(ss, TAB_GAMES, ['id', 'name', 'category', 'tags', 'lifeSkills', 'description', 'sourceIds', 'source'], CATALOG_DATA.games.map(function (g) {
    return [
      g.id,
      g.name,
      g.category,
      (g.tags || []).join('|'),
      (g.lifeSkills || []).join('|'),
      g.description,
      (g.sourceIds || []).join('|'),
      g.source || '',
    ];
  }));
  writeRows_(ss, TAB_TERMS, ['id', 'term', 'category', 'definition', 'sourceIds'], CATALOG_DATA.terms.map(function (t) {
    return [t.id || '', t.term, t.category, t.definition, (t.sourceIds || []).join('|')];
  }));
  var generator = CATALOG_DATA.generator || [];
  writeRows_(ss, TAB_GENERATOR, ['id', 'categories', 'text', 'extra'], generator.map(function (row) {
    return [row.id || '', formatCats_(row.categories || row.category || ''), row.text || '', row.extra || ''];
  }));
}

function readCatalog() {
  var ss = SpreadsheetApp.getActive();
  var generator = objectsFrom_(ss, TAB_GENERATOR);
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
  var headers = values[0].map(function (h) { return String(h); });
  return values.slice(1).filter(function (row) { return row.join('').trim(); }).map(function (row) {
    var obj = {};
    headers.forEach(function (h, i) { obj[h] = row[i]; });
    return obj;
  });
}

function valuesFrom_(ss, name) {
  return objectsFrom_(ss, name).map(function (row) {
    return row.text || row.name || Object.values(row)[0];
  }).filter(Boolean);
}
