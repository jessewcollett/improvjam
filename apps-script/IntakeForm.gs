/**
 * Community intake form.
 *
 * Improv Jam → Create intake form
 *   Creates (or reopens) the Google Form, installs onFormSubmit, and stores
 *   GOOGLE_MEDIA_FOLDER_ID. First run asks for Forms + Drive + trigger access.
 *
 * Uploads are moved into the jam media folder and shared as Anyone with the
 * link (file URL, never the folder). Rows append with active=TRUE.
 * populateCatalog is never called from here.
 */

var GOOGLE_MEDIA_FOLDER_ID = '1tNfq8wl1-iP0FEMM2fI0xyuDneJggP4L';
var PROP_MEDIA_FOLDER = 'GOOGLE_MEDIA_FOLDER_ID';
var PROP_INTAKE_FORM_ID = 'INTAKE_FORM_ID';
var PROP_INTAKE_FORM_URL = 'INTAKE_FORM_URL';
var USER_SUBMIT_SOURCE_ID = 'src-user-submit';
// Public share URL. Edit (do not show in the public app):
// https://docs.google.com/forms/d/1Xk6r3Lkq145FA9AdI10W6mHZSheHpL8M5rUDh9LAkHk/edit
var PUBLISHED_INTAKE_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLScoQ1oUaXuDKDReAzZE4l105L7QyT-AC_GrMiF-XGQQAL7ghg/viewform';

var Q_TYPE = 'What are you submitting?';
var Q_SUBMITTER = 'Your name (optional)';
var Q_SFX_NAME = 'Sound name';
var Q_SFX_FILE = 'SFX file';
var Q_SFX_URL = 'Or paste an existing Drive / Freesound file link';
var Q_SFX_ICON = 'Icon (optional)';
var Q_SFX_CREDIT = 'Credit / license';
var Q_SFX_CREDIT_URL = 'Credit URL';
var Q_SFX_TAGS = 'Tags (optional)';
var Q_SFX_NOTES = 'Notes (optional)';
var Q_MUSIC_NAME = 'Track name';
var Q_MUSIC_FILE = 'Music file';
var Q_MUSIC_URL = 'Or paste an existing Drive file link';
var Q_MUSIC_CREDIT = 'Artist / credit';
var Q_MUSIC_CREDIT_URL = 'Credit or source URL';
var Q_MUSIC_RIGHTS = 'Rights';
var Q_MUSIC_TAGS = 'Tags';
var Q_MUSIC_NOTES = 'Track notes (optional)';
var Q_GAME_NAME = 'Game name';
var Q_GAME_CATEGORY = 'Game category';
var Q_GAME_DESCRIPTION = 'Description';
var Q_GAME_SETUP = 'Setup';
var Q_GAME_HOW = 'How to play';
var Q_GAME_GIMMICKS = 'Gimmicks';
var Q_GAME_VARIATIONS = 'Variations';
var Q_GAME_TAGS = 'Game tags';
var Q_GAME_SKILLS = 'Life skills';
var Q_GAME_SYNONYMS = 'Also known as';
var Q_GAME_SOURCE_URL = 'Where did you learn this? (URL)';
var Q_GAME_IMAGE = 'Game photo (optional)';
var Q_GEN_TEXT = 'Suggestion text';
var Q_GEN_CATEGORIES = 'Suggestion categories';
var Q_GEN_EXTRA = 'Extra (F.U.T. weird thing or play-style description)';
var Q_GEN_GROUP = 'Section';
var Q_TERM_NAME = 'Term';
var Q_TERM_CATEGORY = 'Term category';
var Q_TERM_DEFINITION = 'Definition';
var Q_TERM_SOURCE_URL = 'Source URL (optional)';
var Q_TERM_IMAGE = 'Term photo (optional)';

var MUSIC_RIGHTS_YES = 'I have the right to share this recording (I made it, have a license, or it is public domain / Creative Commons). I will not upload commercial tracks I do not have rights to. Credit will appear in the app.';

var GAME_CATEGORIES = [
  'Warm-Up', 'Line Games', 'Short Form', 'Long Form', 'Endowment',
  'Idea Generators', 'Exercise', 'Ask-for',
];

var TERM_CATEGORIES = [
  'Essentials', 'Structure', 'Editing Moves', 'Support Moves',
  'Pitfalls', 'Boundaries', 'Tips', 'Encyclopedia',
];

var GENERATOR_CATEGORIES = [
  'Activities', 'Adjectives', 'Animals', 'Characters', 'Companies', 'Emotions',
  'Famous', 'Genres', 'Instructions', 'Jobs', 'Lines', 'Locations', 'Nouns',
  'Objects', 'Objectives', 'PlayStyle', 'Relationships', 'Scenes', 'Shapes',
  'Songs', 'Story Titles', 'Verbs', 'Words', 'FUT', 'CORE',
];

function createIntakeForm() {
  seedMediaFolderProperty_();
  var ui = SpreadsheetApp.getUi();
  var existing = openStoredIntakeForm_();
  if (existing) {
    var reuse = ui.alert(
      'Intake form',
      'A form already exists.\n\n' + existing.getPublishedUrl() + '\n\nUse this form?',
      ui.ButtonSet.YES_NO
    );
    if (reuse === ui.Button.YES) {
      ensureIntakeTrigger_(existing);
      ensureUserSubmitSource_(existing);
      ui.alert('Intake form', intakeReadyMessage_(existing), ui.ButtonSet.OK);
      return existing;
    }
  }
  var form = ensureIntakeForm(true);
  ui.alert('Intake form', intakeReadyMessage_(form), ui.ButtonSet.OK);
  return form;
}

function ensureIntakeForm(forceNew) {
  seedMediaFolderProperty_();
  if (!forceNew) {
    var existing = openStoredIntakeForm_();
    if (existing) {
      ensureIntakeTrigger_(existing);
      ensureUserSubmitSource_(existing);
      return existing;
    }
  }
  var form = createForm_();
  var props = PropertiesService.getScriptProperties();
  props.setProperty(PROP_INTAKE_FORM_ID, form.getId());
  props.setProperty(PROP_INTAKE_FORM_URL, form.getPublishedUrl());
  ensureIntakeTrigger_(form);
  ensureUserSubmitSource_(form);
  return form;
}

function createForm_() {
  var form = FormApp.create('Improv Jam intake');
  form.setDescription(
    'Submit a sound, track, game, suggestion, or glossary term for the jam catalog.\n\n' +
    'Audio must be a file (mp3, wav, m4a, ogg) under 25MB — not a Drive folder. ' +
    'Music needs a credit. Do not upload copyrighted tracks you do not have rights to.\n\n' +
    'You need a Google account (Forms requires sign-in for file uploads).'
  );
  form.setCollectEmail(true);
  try { form.setRequireLogin(true); } catch (err) {}
  form.setAllowResponseEdits(false);
  form.setShowLinkToRespondAgain(true);
  form.setConfirmationMessage('Thanks — it is in the catalog. Uncheck active on the sheet if you need to hide a row.');

  var typeItem = form.addMultipleChoiceItem()
    .setTitle(Q_TYPE)
    .setRequired(true)
    .setHelpText('SFX and Music go on the Audio tab. Games, suggestions, and terms each have their own tab.');
  form.addTextItem().setTitle(Q_SUBMITTER);

  var sfxPage = form.addPageBreakItem().setTitle('SFX');
  form.addTextItem().setTitle(Q_SFX_NAME).setRequired(true);
  addFileUpload_(form, Q_SFX_FILE, 'Audio under 25MB. Not a folder.', 'AUDIO', false);
  form.addTextItem().setTitle(Q_SFX_URL).setHelpText('Drive file link or Freesound page. Folder links are ignored.');
  form.addTextItem().setTitle(Q_SFX_ICON).setHelpText('drum, bell-ring, or an emoji like 🥁');
  form.addTextItem().setTitle(Q_SFX_CREDIT).setRequired(true).setHelpText('Who made it and the license (CC0, CC BY, original, …).');
  form.addTextItem().setTitle(Q_SFX_CREDIT_URL);
  form.addTextItem().setTitle(Q_SFX_TAGS).setHelpText('Comma-separated, e.g. bell, short');
  form.addParagraphTextItem().setTitle(Q_SFX_NOTES);
  form.addPageBreakItem().setGoToPage(FormApp.PageNavigationType.SUBMIT);

  var musicPage = form.addPageBreakItem().setTitle('Music');
  form.addSectionHeaderItem()
    .setTitle('Credit required')
    .setHelpText('Tracks are accepted with a credit, but we do not silently publish unlabeled commercial music. Only upload recordings you have the right to share.');
  form.addTextItem().setTitle(Q_MUSIC_NAME).setRequired(true);
  addFileUpload_(form, Q_MUSIC_FILE, 'Audio under 25MB. Not a folder.', 'AUDIO', false);
  form.addTextItem().setTitle(Q_MUSIC_URL).setHelpText('Drive file share link (Anyone with the link). Folder links are ignored.');
  form.addTextItem().setTitle(Q_MUSIC_CREDIT).setRequired(true);
  form.addTextItem().setTitle(Q_MUSIC_CREDIT_URL).setRequired(true);
  form.addCheckboxItem()
    .setTitle(Q_MUSIC_RIGHTS)
    .setChoiceValues([MUSIC_RIGHTS_YES])
    .setRequired(true);
  form.addTextItem().setTitle(Q_MUSIC_TAGS).setHelpText('Pop, 80s, Underscore — comma-separated');
  form.addParagraphTextItem().setTitle(Q_MUSIC_NOTES);
  form.addPageBreakItem().setGoToPage(FormApp.PageNavigationType.SUBMIT);

  var gamePage = form.addPageBreakItem().setTitle('Game');
  form.addTextItem().setTitle(Q_GAME_NAME).setRequired(true);
  form.addListItem().setTitle(Q_GAME_CATEGORY).setChoiceValues(GAME_CATEGORIES).setRequired(true);
  form.addParagraphTextItem().setTitle(Q_GAME_DESCRIPTION).setRequired(true);
  form.addParagraphTextItem().setTitle(Q_GAME_SETUP);
  form.addParagraphTextItem().setTitle(Q_GAME_HOW);
  form.addParagraphTextItem().setTitle(Q_GAME_GIMMICKS);
  form.addParagraphTextItem().setTitle(Q_GAME_VARIATIONS);
  form.addTextItem().setTitle(Q_GAME_TAGS).setHelpText('Comma-separated');
  form.addTextItem().setTitle(Q_GAME_SKILLS);
  form.addTextItem().setTitle(Q_GAME_SYNONYMS);
  form.addTextItem().setTitle(Q_GAME_SOURCE_URL);
  addFileUpload_(form, Q_GAME_IMAGE, 'Optional photo. Shared as Anyone with the link.', 'IMAGE', false);
  form.addPageBreakItem().setGoToPage(FormApp.PageNavigationType.SUBMIT);

  var genPage = form.addPageBreakItem().setTitle('Suggestion');
  form.addParagraphTextItem().setTitle(Q_GEN_TEXT).setRequired(true);
  form.addCheckboxItem().setTitle(Q_GEN_CATEGORIES).setChoiceValues(GENERATOR_CATEGORIES).setRequired(true);
  form.addParagraphTextItem().setTitle(Q_GEN_EXTRA)
    .setHelpText('For F.U.T.: the weird thing. For play styles: a short description. Otherwise optional.');
  form.addListItem()
    .setTitle(Q_GEN_GROUP)
    .setChoiceValues(['Ask-for', 'Skill Building', 'Both'])
    .setRequired(false)
    .setHelpText('Leave blank to use the Banks tab default for that category.');
  form.addPageBreakItem().setGoToPage(FormApp.PageNavigationType.SUBMIT);

  var termPage = form.addPageBreakItem().setTitle('Term');
  form.addTextItem().setTitle(Q_TERM_NAME).setRequired(true);
  form.addListItem().setTitle(Q_TERM_CATEGORY).setChoiceValues(TERM_CATEGORIES).setRequired(true);
  form.addParagraphTextItem().setTitle(Q_TERM_DEFINITION).setRequired(true);
  form.addTextItem().setTitle(Q_TERM_SOURCE_URL);
  addFileUpload_(form, Q_TERM_IMAGE, 'Optional photo. Shared as Anyone with the link.', 'IMAGE', false);

  typeItem.setChoices([
    typeItem.createChoice('SFX', sfxPage),
    typeItem.createChoice('Music', musicPage),
    typeItem.createChoice('Game', gamePage),
    typeItem.createChoice('Suggestion', genPage),
    typeItem.createChoice('Term', termPage),
  ]);

  return form;
}

function setMediaFolder() {
  var ui = SpreadsheetApp.getUi();
  var current = mediaFolderId_();
  var result = ui.prompt(
    'Media folder',
    'Paste the Google Drive folder URL or ID for uploaded SFX, music, and images.\n\nCurrent: ' + current,
    ui.ButtonSet.OK_CANCEL
  );
  if (result.getSelectedButton() !== ui.Button.OK) return '';
  var id = parseDriveFolderId_(result.getResponseText());
  if (!id) {
    ui.alert('Could not read a folder ID from that text.');
    return '';
  }
  DriveApp.getFolderById(id);
  PropertiesService.getScriptProperties().setProperty(PROP_MEDIA_FOLDER, id);
  ui.alert('Media folder set to ' + id);
  return id;
}

function onFormSubmit(e) {
  onIntakeFormSubmit(e);
}

function onIntakeFormSubmit(e) {
  var answers = answersFromEvent_(e);
  var type = intakeType_(textAnswer_(answers, Q_TYPE));
  if (!type) throw new Error('Intake form: missing submission type.');
  var ss = SpreadsheetApp.getActive();
  ensureAllTabs_(ss);
  ensureUserSubmitSource_(null);
  if (type === 'sfx' || type === 'music') writeAudioIntake_(ss, answers, type);
  else if (type === 'game') writeGameIntake_(ss, answers);
  else if (type === 'generator') writeGeneratorIntake_(ss, answers);
  else if (type === 'term') writeTermIntake_(ss, answers);
  else throw new Error('Intake form: unknown type ' + type);
}

function writeAudioIntake_(ss, answers, type) {
  var isTrack = type === 'music';
  var name = textAnswer_(answers, isTrack ? Q_MUSIC_NAME : Q_SFX_NAME);
  var credit = textAnswer_(answers, isTrack ? Q_MUSIC_CREDIT : Q_SFX_CREDIT);
  var creditUrl = textAnswer_(answers, isTrack ? Q_MUSIC_CREDIT_URL : Q_SFX_CREDIT_URL);
  if (isTrack && !credit) throw new Error('Music submissions need a credit.');
  var fileUrl = intakeFileUrl_(answers, isTrack ? Q_MUSIC_FILE : Q_SFX_FILE, isTrack ? Q_MUSIC_URL : Q_SFX_URL);
  if (!fileUrl) throw new Error('SFX/Music need an uploaded file or a Drive file link (not a folder).');
  var notes = textAnswer_(answers, isTrack ? Q_MUSIC_NOTES : Q_SFX_NOTES);
  var submitter = submitterNote_(answers);
  var extra = [];
  if (submitter) extra.push(submitter);
  if (isTrack) extra.push('Community upload — verify license.');
  var sheet = ss.getSheetByName(TAB_AUDIO);
  appendMappedRow_(sheet, {
    id: uniqueCatalogId_(sheet, (isTrack ? 'track-' : 'sfx-') + slugPart_(name)),
    name: name,
    kind: isTrack ? 'Track' : 'SFX',
    url: fileUrl,
    icon: textAnswer_(answers, Q_SFX_ICON) || (isTrack ? 'music' : 'bell'),
    credit: credit,
    creditUrl: creditUrl,
    notes: [notes].concat(extra).filter(Boolean).join(' '),
    tags: textAnswer_(answers, isTrack ? Q_MUSIC_TAGS : Q_SFX_TAGS),
    active: true,
  });
}

function writeGameIntake_(ss, answers) {
  var name = textAnswer_(answers, Q_GAME_NAME);
  var submitter = textAnswer_(answers, Q_SUBMITTER);
  var sheet = ss.getSheetByName(TAB_GAMES);
  appendMappedRow_(sheet, {
    id: uniqueCatalogId_(sheet, 'user-' + slugPart_(name)),
    name: name,
    category: textAnswer_(answers, Q_GAME_CATEGORY),
    tags: textAnswer_(answers, Q_GAME_TAGS),
    lifeSkills: textAnswer_(answers, Q_GAME_SKILLS),
    description: textAnswer_(answers, Q_GAME_DESCRIPTION),
    sourceIds: USER_SUBMIT_SOURCE_ID,
    source: submitter ? 'Community submission (' + submitter + ')' : 'Community submission',
    image: intakeFileUrl_(answers, Q_GAME_IMAGE, ''),
    setup: textAnswer_(answers, Q_GAME_SETUP),
    howToPlay: textAnswer_(answers, Q_GAME_HOW),
    gimmicks: textAnswer_(answers, Q_GAME_GIMMICKS),
    variations: textAnswer_(answers, Q_GAME_VARIATIONS),
    synonyms: textAnswer_(answers, Q_GAME_SYNONYMS),
    relatedIds: '',
    sourceUrl: textAnswer_(answers, Q_GAME_SOURCE_URL),
    active: true,
  });
}

function writeGeneratorIntake_(ss, answers) {
  var text = textAnswer_(answers, Q_GEN_TEXT);
  var cats = formatCats_(textAnswer_(answers, Q_GEN_CATEGORIES));
  var sheet = ss.getSheetByName(TAB_GENERATOR);
  appendMappedRow_(sheet, {
    id: uniqueCatalogId_(sheet, 'gen-user-' + slugPart_(text).slice(0, 40)),
    categories: cats,
    text: text,
    extra: textAnswer_(answers, Q_GEN_EXTRA),
    group: textAnswer_(answers, Q_GEN_GROUP),
    active: true,
  });
}

function writeTermIntake_(ss, answers) {
  var term = textAnswer_(answers, Q_TERM_NAME);
  var sheet = ss.getSheetByName(TAB_TERMS);
  appendMappedRow_(sheet, {
    id: uniqueCatalogId_(sheet, 'term-' + slugPart_(term)),
    term: term,
    category: textAnswer_(answers, Q_TERM_CATEGORY),
    definition: textAnswer_(answers, Q_TERM_DEFINITION),
    sourceIds: USER_SUBMIT_SOURCE_ID,
    image: intakeFileUrl_(answers, Q_TERM_IMAGE, ''),
    sourceUrl: textAnswer_(answers, Q_TERM_SOURCE_URL),
    definitions: '',
    active: true,
  });
}

function appendMappedRow_(sheet, values) {
  var last = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, last).getValues()[0];
  var row = headers.map(function (h) {
    var key = canonHeader_(h);
    if (!key) return '';
    if (Object.prototype.hasOwnProperty.call(values, key)) return values[key];
    if (key === 'active') return true;
    return '';
  });
  sheet.appendRow(row);
  ensureActiveCheckboxes_(sheet);
}

function uniqueCatalogId_(sheet, base) {
  var id = String(base || 'item').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'item';
  var seen = existingIds_(sheet);
  if (!seen[id]) return id;
  var n = 2;
  while (seen[id + '-' + n]) n++;
  return id + '-' + n;
}

function existingIds_(sheet) {
  var last = Math.max(sheet.getLastColumn(), 1);
  var headers = sheet.getRange(1, 1, 1, last).getValues()[0];
  var idCol = headerIndex_(headers, 'id');
  var seen = {};
  if (idCol < 0 || sheet.getLastRow() < 2) return seen;
  var values = sheet.getRange(2, idCol + 1, sheet.getLastRow() - 1, 1).getValues();
  var i;
  for (i = 0; i < values.length; i++) {
    var id = String(values[i][0] || '').trim();
    if (id) seen[id] = true;
  }
  return seen;
}

function slugPart_(text) {
  var slug = String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug || 'item';
}

function intakeType_(raw) {
  var t = String(raw || '').trim().toLowerCase();
  if (t === 'sfx' || t.indexOf('sound') === 0) return 'sfx';
  if (t === 'music' || t === 'track') return 'music';
  if (t === 'game') return 'game';
  if (t === 'term' || t === 'glossary') return 'term';
  if (t.indexOf('suggest') === 0 || t.indexOf('generator') === 0) return 'generator';
  return '';
}

function answersFromEvent_(e) {
  var map = {};
  if (e && e.response) {
    e.response.getItemResponses().forEach(function (item) {
      map[item.getItem().getTitle()] = item.getResponse();
    });
    map._email = e.response.getRespondentEmail() || '';
    return map;
  }
  if (e && e.namedValues) {
    Object.keys(e.namedValues).forEach(function (key) {
      var value = e.namedValues[key];
      map[key] = Array.isArray(value) && value.length === 1 ? value[0] : value;
    });
    var email = e.namedValues['Email Address'];
    map._email = Array.isArray(email) ? String(email[0] || '') : String(email || '');
    return map;
  }
  throw new Error('Intake form: no response on the event.');
}

function textAnswer_(map, title) {
  var value = lookupAnswer_(map, title);
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  return String(value == null ? '' : value).trim();
}

function lookupAnswer_(map, title) {
  if (map[title] != null && map[title] !== '') return map[title];
  var want = String(title).trim().toLowerCase();
  var keys = Object.keys(map);
  var i;
  for (i = 0; i < keys.length; i++) {
    if (String(keys[i]).trim().toLowerCase() === want) return map[keys[i]];
  }
  return '';
}

function submitterNote_(answers) {
  var name = textAnswer_(answers, Q_SUBMITTER);
  var email = String(answers._email || '').trim();
  if (name && email) return 'Submitted by ' + name + ' (' + email + ').';
  if (name) return 'Submitted by ' + name + '.';
  if (email) return 'Submitted by ' + email + '.';
  return '';
}

function intakeFileUrl_(answers, fileTitle, urlTitle) {
  var uploaded = firstFileId_(lookupAnswer_(answers, fileTitle));
  if (uploaded) return placeAndShareFile_(uploaded);
  if (!urlTitle) return '';
  return asDriveFileUrl_(textAnswer_(answers, urlTitle));
}

function firstFileId_(value) {
  if (value == null || value === '') return '';
  if (Object.prototype.toString.call(value) === '[object Array]') {
    var i;
    for (i = 0; i < value.length; i++) {
      var id = extractDriveFileId_(value[i]);
      if (id) return id;
    }
    return '';
  }
  return extractDriveFileId_(value);
}

function extractDriveFileId_(raw) {
  var text = String(raw || '').trim();
  if (!text) return '';
  if (/\/folders\//.test(text)) return '';
  if (/^[a-zA-Z0-9_-]{20,}$/.test(text) && text.indexOf('/') < 0) return text;
  var match = text.match(/\/d\/([a-zA-Z0-9_-]{10,})/) || text.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  return match ? match[1] : '';
}

function asDriveFileUrl_(raw) {
  var text = String(raw || '').trim();
  if (!text || /\/folders\//.test(text) || /drive\.google\.com\/drive\/folders/.test(text)) return '';
  var id = extractDriveFileId_(text);
  if (id) return 'https://drive.google.com/file/d/' + id + '/view?usp=sharing';
  if (/^https?:\/\//i.test(text)) return text;
  return '';
}

function placeAndShareFile_(fileId) {
  var file = DriveApp.getFileById(fileId);
  var folderId = mediaFolderId_();
  if (folderId) {
    try {
      file.moveTo(DriveApp.getFolderById(folderId));
    } catch (err) {
      try {
        var folder = DriveApp.getFolderById(folderId);
        folder.addFile(file);
        var parents = file.getParents();
        while (parents.hasNext()) {
          var parent = parents.next();
          if (parent.getId() !== folderId) parent.removeFile(file);
        }
      } catch (moveErr) {
        console.error('Intake form: could not move upload ' + fileId + ' — ' + moveErr);
      }
    }
  }
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://drive.google.com/file/d/' + file.getId() + '/view?usp=sharing';
}

function addFileUpload_(form, title, help, fileType, required) {
  try {
    var item = form.addFileUploadItem()
      .setTitle(title)
      .setHelpText(help)
      .setMaxFiles(1)
      .setRequired(!!required);
    try {
      var types = FormApp.FileType;
      if (types && fileType && types[fileType]) item.setAllowableFileTypes([types[fileType]]);
    } catch (typeErr) {}
    return item;
  } catch (err) {
    form.addTextItem()
      .setTitle(title)
      .setHelpText(help + ' Paste a Drive file share link (Anyone with the link), not a folder.')
      .setRequired(!!required);
    return null;
  }
}

function mediaFolderId_() {
  var props = PropertiesService.getScriptProperties();
  var stored = parseDriveFolderId_(props.getProperty(PROP_MEDIA_FOLDER) || '');
  return stored || GOOGLE_MEDIA_FOLDER_ID;
}

function seedMediaFolderProperty_() {
  var props = PropertiesService.getScriptProperties();
  if (!String(props.getProperty(PROP_MEDIA_FOLDER) || '').trim()) {
    props.setProperty(PROP_MEDIA_FOLDER, GOOGLE_MEDIA_FOLDER_ID);
  }
}

function parseDriveFolderId_(raw) {
  var text = String(raw || '').trim();
  if (!text) return '';
  var match = text.match(/\/folders\/([a-zA-Z0-9_-]+)/) || text.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (match) return match[1];
  if (/^[a-zA-Z0-9_-]{10,}$/.test(text)) return text;
  return '';
}

function openStoredIntakeForm_() {
  var id = PropertiesService.getScriptProperties().getProperty(PROP_INTAKE_FORM_ID);
  if (!id) return null;
  try {
    return FormApp.openById(id);
  } catch (err) {
    return null;
  }
}

function ensureIntakeTrigger_(form) {
  var triggers = ScriptApp.getProjectTriggers();
  var i;
  for (i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'onIntakeFormSubmit') return;
  }
  ScriptApp.newTrigger('onIntakeFormSubmit')
    .forForm(form)
    .onFormSubmit()
    .create();
}

function ensureUserSubmitSource_(form) {
  var ss = SpreadsheetApp.getActive();
  ensureAllTabs_(ss);
  upsertSource_(ss, {
    id: USER_SUBMIT_SOURCE_ID,
    name: 'Community submission',
    url: form ? form.getPublishedUrl() : (PropertiesService.getScriptProperties().getProperty(PROP_INTAKE_FORM_URL) || PUBLISHED_INTAKE_FORM_URL),
    note: 'Submitted through the Improv Jam intake form.',
  });
}

function intakeReadyMessage_(form) {
  return (
    'Share this form:\n' + form.getPublishedUrl() + '\n\n' +
    'Edit:\n' + form.getEditUrl() + '\n\n' +
    'Uploads go to Drive folder ' + mediaFolderId_() +
    ' and are shared as Anyone with the link (file URL, not the folder).\n\n' +
    'Respondents must sign in with a Google account (required for file uploads).\n' +
    'Music requires a credit. Uncheck active on a row to hide it.\n\n' +
    'Do not run Populate catalog after community submissions — that overwrite would wipe Games/Terms/Generator (Audio is already left alone).'
  );
}
