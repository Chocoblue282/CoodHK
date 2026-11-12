/**
 * CoodHK 香港平價美食地圖 — GAS + Drive + Sheets backend
 *
 * Script Properties:
 * SHEET_ID        Google Sheet ID
 * SHEET_NAME      Sheet name, default Restaurants
 * DRIVE_FOLDER_ID Google Drive folder ID
 * ADMIN_TOKEN     Long random secret used for the review page/actions
 * ADMIN_EMAIL     Optional email address for new-submission notifications
 *
 * Web App deployment: Execute as Me; Who has access: Anyone.
 */

const REQUIRED_HEADERS = [
  'id', 'name', 'address', 'price', 'category', 'photo_url', 'status', 'created_at'
];
const OPTIONAL_HEADERS = [
  'district', 'dining', 'hours', 'hours_detail', 'lat', 'lng', 'mapX', 'mapY',
  'reviewed_at', 'reviewed_by'
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
    if (action === 'admin') return adminPage_(e.parameter.token || '');
    return json_({ ok: false, error: 'Unknown action' });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function doPost(e) {
  try {
    const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (payload.action === 'updateStatus') {
      requireAdmin_(payload.token);
      return json_(updateStatus_(payload.id, payload.status));
    }
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
      mapY: payload.mapY || '',
      reviewed_at: '',
      reviewed_by: ''
    };
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
    sheet.appendRow(headers.map(function (header) { return record[header] == null ? '' : record[header]; }));
    SpreadsheetApp.flush();
    notifyAdmin_(record);
    return json_({ ok: true, id: record.id, photo_url: record.photo_url, status: record.status });
  } catch (err) {
    return json_({ ok: false, error: String(err.message || err) });
  }
}

function listApproved_() {
  return readRecords_().filter(function (record) {
    return String(record.status).toLowerCase() === 'approved';
  });
}

function listPending_() {
  return readRecords_().filter(function (record) {
    return String(record.status).toLowerCase() === 'pending';
  });
}

function readRecords_() {
  const c = config_();
  const ss = SpreadsheetApp.openById(c.sheetId);
  const sheet = ss.getSheetByName(c.sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const values = sheet.getDataRange().getValues();
  const headers = values.shift().map(String);
  return values.map(function (row, index) {
    const record = { _row: index + 2 };
    headers.forEach(function (header, i) { record[header] = row[i]; });
    return record;
  });
}

function updateStatus_(id, status) {
  const normalized = String(status || '').toLowerCase();
  if (['approved', 'rejected', 'pending'].indexOf(normalized) === -1) {
    throw new Error('status must be approved, rejected, or pending.');
  }
  const c = config_();
  const ss = SpreadsheetApp.openById(c.sheetId);
  const sheet = ss.getSheetByName(c.sheetName);
  if (!sheet) throw new Error('Sheet not found.');
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  const statusColumn = headers.indexOf('status') + 1;
  const reviewedAtColumn = headers.indexOf('reviewed_at') + 1;
  const reviewedByColumn = headers.indexOf('reviewed_by') + 1;
  if (!statusColumn) throw new Error('status column not found. Run setup().');

  const records = readRecords_();
  const record = records.find(function (item) { return String(item.id) === String(id); });
  if (!record) throw new Error('Submission not found.');
  sheet.getRange(record._row, statusColumn).setValue(normalized);
  if (reviewedAtColumn) sheet.getRange(record._row, reviewedAtColumn).setValue(new Date().toISOString());
  if (reviewedByColumn) sheet.getRange(record._row, reviewedByColumn).setValue(Session.getActiveUser().getEmail() || 'admin');
  SpreadsheetApp.flush();
  return { ok: true, id: id, status: normalized };
}

function requireAdmin_(token) {
  const expected = props_().getProperty('ADMIN_TOKEN');
  if (!expected || !token || token !== expected) throw new Error('Unauthorized admin request.');
}

function adminPage_(token) {
  try {
    requireAdmin_(token);
  } catch (err) {
    return HtmlService.createHtmlOutput('<h2>Unauthorized</h2><p>Invalid or missing admin token.</p>');
  }
  const pending = listPending_();
  const rows = pending.map(function (item) {
    const photo = item.photo_url ? '<a href="' + escapeHtml_(item.photo_url) + '" target="_blank">查看圖片</a>' : '沒有圖片';
    return '<article class="item"><div><b>' + escapeHtml_(item.name) + '</b><p>' + escapeHtml_(item.address) + '</p><small>' + escapeHtml_(String(item.created_at)) + ' · ' + photo + '</small></div><div class="actions"><button onclick="review(\'' + escapeJs_(item.id) + '\', \'approved\')">批准上線</button><button class="reject" onclick="review(\'' + escapeJs_(item.id) + '\', \'rejected\')">拒絕</button></div></article>';
  }).join('');
  const html = '<!doctype html><meta charset="utf-8"><title>CoodHK 審核後台</title><style>body{font:15px system-ui;margin:0;background:#f7f4ef;color:#17324d}main{max-width:850px;margin:auto;padding:32px 18px}.top{display:flex;justify-content:space-between;align-items:center}.item{display:flex;justify-content:space-between;gap:20px;background:white;border-radius:14px;padding:18px;margin:12px 0;box-shadow:0 3px 12px #17324d12}.item p{margin:8px 0}.item small{color:#6c7a86}.actions{display:flex;gap:8px;align-items:center}.actions button{border:0;border-radius:9px;padding:10px 13px;background:#3678bd;color:white;font-weight:700;cursor:pointer}.actions .reject{background:#e74c3c}.empty{padding:30px;background:white;border-radius:14px}@media(max-width:600px){.item{display:block}.actions{margin-top:14px}}</style><main><div class="top"><h1>CoodHK 審核後台</h1><span>Pending: ' + pending.length + '</span></div><p>只有批准後，餐廳才會被公開地圖 API 讀取。</p>' + (rows || '<div class="empty">目前沒有待審核報料。</div>') + '</main><script>const token=' + JSON.stringify(token) + ';async function review(id,status){if(!confirm(status===\'approved\'?\'批准這筆報料並公開？\':\'拒絕這筆報料？\'))return;const r=await fetch(location.href,{method:\'POST\',headers:{\'Content-Type\':\'text/plain\'},body:JSON.stringify({action:\'updateStatus\',token,id,status})});const j=await r.json();if(!j.ok){alert(j.error||\'更新失敗\');return}location.reload()}</script>';
  return HtmlService.createHtmlOutput(html).setTitle('CoodHK 審核後台');
}

function notifyAdmin_(record) {
  const email = props_().getProperty('ADMIN_EMAIL');
  if (!email) return;
  try {
    MailApp.sendEmail({
      to: email,
      subject: '[CoodHK] 新報料待審核：' + record.name,
      htmlBody: '<p>有一筆新的 CoodHK 報料等待審核。</p><p><b>' + escapeHtml_(record.name) + '</b><br>' + escapeHtml_(record.address) + '</p><p>請開啟 GAS 審核頁面處理。</p>'
    });
  } catch (err) {
    console.warn('Admin notification failed: ' + err);
  }
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

function escapeHtml_(value) {
  return String(value).replace(/[&<>"']/g, function (character) {
    return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character];
  });
}

function escapeJs_(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');
}

function json_(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON);
}
