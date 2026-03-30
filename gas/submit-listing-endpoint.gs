// ============================================================
// TaserWorld — Dealer Submission Endpoint
// Google Apps Script — Web App (doPost)
//
// SETUP:
//   1. Go to script.google.com → New project → paste this file
//      (or add as a new file in the state-generator project)
//   2. Edit NOTIFICATION_EMAIL below to your address
//   3. Deploy as Web App:
//      Deploy → New deployment → Type: Web App
//      Execute as: Me
//      Who has access: Anyone
//   4. Copy the Web App URL
//   5. In submit-listing/index.html, replace REPLACE_WITH_YOUR_GAS_ID
//      in the form action with the full Web App URL
//
// The script writes each submission to a "Dealer Submissions"
// sheet and sends you a notification email.
// ============================================================

var NOTIFICATION_EMAIL = 'YOUR_EMAIL@gmail.com'; // <-- change this
var SHEET_NAME = 'Dealer Submissions';

// ============================================================
// doPost — receives form submissions
// ============================================================

function doPost(e) {
  try {
    var data = e.parameter || {};

    // Write to sheet
    var sheet = getOrCreateSheet();
    var row = buildRow(data);
    sheet.appendRow(row);

    // Send notification email
    sendNotification(data);

    return buildResponse({ status: 'ok', message: 'Submission received.' });

  } catch(err) {
    return buildResponse({ status: 'error', message: err.message });
  }
}

// Allow OPTIONS preflight (CORS)
function doGet(e) {
  return buildResponse({ status: 'ok', message: 'TaserWorld submission endpoint is live.' });
}

// ============================================================
// SHEET
// ============================================================

function getOrCreateSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    var headers = [
      'Timestamp',
      'Business Name',
      'City',
      'State',
      'Address',
      'Phone',
      'Website',
      'Email',
      'Specialties',
      'Authorized Status',
      'Notes',
      'Review Status'
    ];
    sheet.appendRow(headers);
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setFontWeight('bold');
    headerRange.setBackground('#0d1520');
    headerRange.setFontColor('#0ea5e9');
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
  }

  return sheet;
}

function buildRow(d) {
  // Handle specialty checkboxes — they may come as a single value or array
  var specialties = '';
  if (d.specialty) {
    specialties = Array.isArray(d.specialty) ? d.specialty.join(', ') : d.specialty;
  }

  return [
    new Date(),                               // Timestamp
    d.businessName  || '',                    // Business Name
    d.city          || '',                    // City
    d.state         || '',                    // State
    d.address       || '',                    // Address
    d.phone         || '',                    // Phone
    d.website       || '',                    // Website
    d.email         || '',                    // Email (private)
    specialties,                              // Specialties
    d.authorized    || '',                    // Authorized Status
    d.notes         || '',                    // Notes
    'Pending Review'                          // Review Status
  ];
}

// ============================================================
// EMAIL NOTIFICATION
// ============================================================

function sendNotification(d) {
  if (!NOTIFICATION_EMAIL || NOTIFICATION_EMAIL === 'YOUR_EMAIL@gmail.com') return;

  var subject = '[TaserWorld] New Dealer Submission: ' + (d.businessName || 'Unknown') + ' — ' + (d.city || '') + ', ' + (d.state || '');

  var body = 'New dealer listing submission received.\n\n'
    + 'Business: '   + (d.businessName || '')  + '\n'
    + 'Location: '   + (d.city || '') + ', ' + (d.state || '') + '\n'
    + 'Address: '    + (d.address || '') + '\n'
    + 'Phone: '      + (d.phone || '') + '\n'
    + 'Website: '    + (d.website || '') + '\n'
    + 'Email: '      + (d.email || '') + '\n'
    + 'Status: '     + (d.authorized || '') + '\n'
    + 'Notes: '      + (d.notes || '') + '\n\n'
    + 'Review in Google Sheets: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl();

  GmailApp.sendEmail(NOTIFICATION_EMAIL, subject, body);
}

// ============================================================
// RESPONSE HELPER
// ============================================================

function buildResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// MANUAL TEST — run from editor to test sheet writing
// ============================================================

function testSubmission() {
  var fakeData = {
    businessName: 'Test Dealer',
    city:         'Austin',
    state:        'Texas',
    phone:        '(512) 555-0100',
    website:      'https://testdealer.com',
    email:        'test@testdealer.com',
    specialty:    'TASER Axon',
    authorized:   'Authorized TASER/Axon dealer',
    notes:        'Testing the submission endpoint.'
  };

  var sheet = getOrCreateSheet();
  sheet.appendRow(buildRow(fakeData));
  Logger.log('Test row written to "' + SHEET_NAME + '" sheet.');
}
