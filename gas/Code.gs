/**
 * CoodHK 香港平價美食地圖 — Google Apps Script backend
 *
 * 1. Create a Google Sheet and a Drive folder.
 * 2. In Apps Script Project Settings > Script properties, set:
 *    SHEET_ID       = spreadsheet ID
 *    SHEET_NAME     = Restaurants
 *    DRIVE_FOLDER_ID = Drive folder ID
 * 3. Run setup() once and approve permissions.
 * 4. Deploy as Web app: Execute as Me; Who has access: Anyone.
 */

const REQUIRED_HEADERS = [
  'id', 'name', 'address', 'price', 'category', 'photo_url', 'status', 'created_at'
];
const OPTIONAL_HEADERS = [
  'district', 'dining', 'hours', 'hours_detail', 'lat', 'lng', 'mapX', 'mapY'
];

function props_() {
  return PropertiesService.getScriptProperties();
}

function config_() {
  const p = props_();
  const sheetId = p.getProperty('SHEET_ID');
  const sheetName = p.getProperty('SHEET_NAME') || 'Restaurants';
  const folderId = p.getProperty('DRIVE_FOLDER_ID');
  if (!sheetId || !folderId) throw new Error('Missing SHEET_ID or DRIVE_FOLDER_ID in Script properties.');
  return { sheetId, sheetName, folderId };
}

function setup() {
  const c = config_();
  const ss = SpreadsheetApp.openById(c.sheetId);
  const sheet = ss.getSheetByName(c.sheetName) || ss.insertSheet(c.sheetName);
  const headers = REQUIRED_HEADERS.concat(OPTIONAL_HEADERS);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
  } else {
    ensureHeaders_(sheet, headers);
  }
  return { ok: true, sheet: c.sheetName, headers: headers };
}

function ensureHeaders_(sheet, wanted) {
  const width = Math.max(sheet.getLastColumn(), 1);
  const current = sheet.getRange(1, 1, 1, width).getValues()[0].map(String);
  wanted.forEach(function (header) {
    if (current.indexOf(header) === -1) {
      sheet.getRange(1, sheet.getLastColumn() + 1).setValue(header);
      current.push(header);
    }
  });
}

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'listApproved';
    if (action === 'health') return json_({ ok: true, service: 'coodhk-gas' });
    if (action === 'listApproved') return json_({ ok: true, restaurants: listApproved_() });
    return json_({ ok: false, error: 'Unknown action' });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!payload.name || !payload.address) throw new Error('name and address are required.');
    const c = config_();
    const ss = SpreadsheetApp.openById(c.sheetId);
    const sheet = ss.getSheetByName(c.sheetName) || ss.insertSheet(c.sheetName);
    ensureHeaders_(sheet, REQUIRED_HEADERS.concat(OPTIONAL_HEADERS));

    let photoUrl = String(payload.photo_url || '');
    if (payload.photo_base64) {
      photoUrl = saveImage_(payload.photo_base64, payload.photo_filename || payload.name, c.folderId);
    }

    const record = {
      id: String(payload.id || Utilities.getUuid()),
      name: String(payload.name),
      address: String(payload.address),
      price: String(payload.price || ''),
      category: String(payload.category || ''),
      photo_url: photoUrl,
      status: 'pending',
      created_at: new Date().toISOString(),
      district: String(payload.district || ''),
      dining: String(payload.dining || ''),
      hours: String(payload.hours || ''),
      hours_detail: String(payload.hours_detail || ''),
      lat: payload.lat || '',
      lng: payload.lng || '',
      mapX: payload.mapX || '',
      mapY: payload.mapY || ''
    };
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
    sheet.appendRow(headers.map(function (header) { return record[header] == null ? '' : record[header]; }));
    return json_({ ok: true, id: record.id, photo_url: record.photo_url, status: record.status });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function listApproved_() {
  const c = config_();
  const ss = SpreadsheetApp.openById(c.sheetId);
  const sheet = ss.getSheetByName(c.sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getValues();
  const headers = values.shift().map(String);
  return values.map(function (row) {
    const record = {};
    headers.forEach(function (header, i) { record[header] = row[i]; });
    return record;
  }).filter(function (record) { return String(record.status).toLowerCase() === 'approved'; });
}

function saveImage_(dataUrl, filename, folderId) {
  const match = String(dataUrl).match(/^data:([^;]+);base64,(.+)$/);
  if (!match) throw new Error('photo_base64 must be a data URL.');
  const bytes = Utilities.base64Decode(match[2]);
  const safeName = String(filename).replace(/[^\w\-\u4e00-\u9fff ]/g, '_').slice(0, 90) || 'coodhk-photo';
  const blob = Utilities.newBlob(bytes, match[1], safeName + '.jpg');
  const file = DriveApp.getFolderById(folderId).createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://drive.google.com/uc?export=view&id=' + file.getId();
}

function json_(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}
