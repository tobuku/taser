/**
 * TaserWorld.com
 * Outscraper Automation for Taser Dealer Listings in Google Sheets
 *
 * Target sheet columns (13):
 * id, name, city, state, address, phone, website, email,
 * category, rating, reviews, created_at, updated_at
 *
 * Usage:
 * 1. Google Sheets → Extensions → Apps Script
 * 2. Paste this entire file
 * 3. Save
 * 4. Set your Outscraper API key in CONFIG below
 * 5. Run main()
 * 6. If Apps Script runtime stops, run main() again — it resumes where it left off
 * 7. Share the completed sheet with Neal for site publishing
 *
 * Notes:
 * - Dedupe uses name OR phone OR address
 * - 2 second delay between API calls to stay under rate limits
 * - Run resetProgress() to start over from the beginning
 */

var CONFIG = {
  OUTSCRAPER_API_KEY: "PASTE_YOUR_OUTSCRAPER_API_KEY_HERE",
  SHEET_NAME: "taser-dealers",
  RESULTS_PER_QUERY: 20,
  DELAY_MS: 2000
};

var SEARCH_QUERIES = [
  "taser dealer, Alabama",
  "taser dealer, Alaska",
  "taser dealer, Arizona",
  "taser dealer, Arkansas",
  "taser dealer, California",
  "taser dealer, Colorado",
  "taser dealer, Connecticut",
  "taser dealer, Delaware",
  "taser dealer, Florida",
  "taser dealer, Georgia",
  "taser dealer, Hawaii",
  "taser dealer, Idaho",
  "taser dealer, Illinois",
  "taser dealer, Indiana",
  "taser dealer, Iowa",
  "taser dealer, Kansas",
  "taser dealer, Kentucky",
  "taser dealer, Louisiana",
  "taser dealer, Maine",
  "taser dealer, Maryland",
  "taser dealer, Massachusetts",
  "taser dealer, Michigan",
  "taser dealer, Minnesota",
  "taser dealer, Mississippi",
  "taser dealer, Missouri",
  "taser dealer, Montana",
  "taser dealer, Nebraska",
  "taser dealer, Nevada",
  "taser dealer, New Hampshire",
  "taser dealer, New Jersey",
  "taser dealer, New Mexico",
  "taser dealer, New York",
  "taser dealer, North Carolina",
  "taser dealer, North Dakota",
  "taser dealer, Ohio",
  "taser dealer, Oklahoma",
  "taser dealer, Oregon",
  "taser dealer, Pennsylvania",
  "taser dealer, Rhode Island",
  "taser dealer, South Carolina",
  "taser dealer, South Dakota",
  "taser dealer, Tennessee",
  "taser dealer, Texas",
  "taser dealer, Utah",
  "taser dealer, Vermont",
  "taser dealer, Virginia",
  "taser dealer, Washington",
  "taser dealer, Washington DC",
  "taser dealer, West Virginia",
  "taser dealer, Wisconsin",
  "taser dealer, Wyoming"
];

var STATE_ABBREVS = {
  "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR",
  "california": "CA", "colorado": "CO", "connecticut": "CT", "delaware": "DE",
  "florida": "FL", "georgia": "GA", "hawaii": "HI", "idaho": "ID",
  "illinois": "IL", "indiana": "IN", "iowa": "IA", "kansas": "KS",
  "kentucky": "KY", "louisiana": "LA", "maine": "ME", "maryland": "MD",
  "massachusetts": "MA", "michigan": "MI", "minnesota": "MN",
  "mississippi": "MS", "missouri": "MO", "montana": "MT", "nebraska": "NE",
  "nevada": "NV", "new hampshire": "NH", "new jersey": "NJ",
  "new mexico": "NM", "new york": "NY", "north carolina": "NC",
  "north dakota": "ND", "ohio": "OH", "oklahoma": "OK", "oregon": "OR",
  "pennsylvania": "PA", "rhode island": "RI", "south carolina": "SC",
  "south dakota": "SD", "tennessee": "TN", "texas": "TX", "utah": "UT",
  "vermont": "VT", "virginia": "VA", "washington": "WA",
  "west virginia": "WV", "wisconsin": "WI", "wyoming": "WY",
  "district of columbia": "DC", "washington dc": "DC"
};

var TEMPLATE_HEADERS = [
  "id", "name", "city", "state", "address", "phone", "website", "email",
  "category", "rating", "reviews", "created_at", "updated_at"
];

// ============================================================
// MAIN
// ============================================================

function main() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEET_NAME);
    Logger.log("Created sheet: " + CONFIG.SHEET_NAME);
  }

  ensureHeader(sheet);

  var props = PropertiesService.getScriptProperties();
  var startIndex = parseInt(props.getProperty("lastCompletedQuery") || "-1", 10) + 1;

  if (startIndex >= SEARCH_QUERIES.length) {
    Logger.log("All queries complete. Run resetProgress() to start over.");
    return;
  }

  Logger.log("Resuming from query " + (startIndex + 1) + " of " + SEARCH_QUERIES.length);

  var existing = getExistingRows(sheet);
  var added = 0;

  for (var i = startIndex; i < SEARCH_QUERIES.length; i++) {
    var query = SEARCH_QUERIES[i];
    Logger.log("Query " + (i + 1) + "/" + SEARCH_QUERIES.length + ": " + query);

    var places = fetchOutscraper(query);

    if (!places || places.length === 0) {
      Logger.log("No results for: " + query);
      props.setProperty("lastCompletedQuery", String(i));
      continue;
    }

    for (var j = 0; j < places.length; j++) {
      var row = mapToRow(places[j], query);
      if (!row) continue;

      var name    = row[1];
      var phone   = row[5];
      var address = row[4];

      if (isDuplicate(existing, name, phone, address)) continue;

      sheet.appendRow(row);
      existing.push({
        name:    normKey(name),
        phone:   normPhone(phone),
        address: normKey(address)
      });
      added++;
    }

    props.setProperty("lastCompletedQuery", String(i));

    if (i < SEARCH_QUERIES.length - 1) Utilities.sleep(CONFIG.DELAY_MS);
  }

  Logger.log("Done. Added " + added + " new rows.");
}

function resetProgress() {
  PropertiesService.getScriptProperties().deleteProperty("lastCompletedQuery");
  Logger.log("Progress reset. main() will start from the beginning.");
}

// ============================================================
// OUTSCRAPER API
// ============================================================

function fetchOutscraper(query) {
  var url = "https://api.app.outscraper.com/maps/search-v3"
    + "?query=" + encodeURIComponent(query)
    + "&limit=" + CONFIG.RESULTS_PER_QUERY
    + "&async=false";

  var options = {
    method: "get",
    headers: { "X-API-KEY": CONFIG.OUTSCRAPER_API_KEY },
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(url, options);
  var code = response.getResponseCode();

  if (code !== 200) {
    Logger.log("API error " + code + ": " + response.getContentText().substring(0, 200));
    return [];
  }

  var json = JSON.parse(response.getContentText());

  if (json.data && json.data.length > 0 && Array.isArray(json.data[0])) return json.data[0];
  return [];
}

// ============================================================
// ROW MAPPING
// ============================================================

function mapToRow(place, query) {
  if (!place || !place.name) return null;

  var nowIso = new Date().toISOString();

  var state   = normalizeState(place.us_state || place.state || extractStateFromQuery(query));
  var city    = safeText(place.city);
  var address = safeText(place.street || place.full_address);
  var phone   = normPhone(safeText(place.phone));
  var website = safeText(place.site || place.website);
  var email   = extractEmail(place);
  var category = extractCategory(place);
  var rating  = place.rating ? String(place.rating) : "";
  var reviews = place.reviews ? String(place.reviews) : "";

  return [
    Utilities.getUuid(),        // id
    safeText(place.name).trim(),// name
    city,                       // city
    state,                      // state
    address,                    // address
    phone,                      // phone
    website,                    // website
    email,                      // email
    category,                   // category
    rating,                     // rating
    reviews,                    // reviews
    nowIso,                     // created_at
    nowIso                      // updated_at
  ];
}

function extractStateFromQuery(query) {
  // Fallback: pull state from query string "taser dealer, Texas" → "TX"
  var parts = String(query || "").split(",");
  if (parts.length < 2) return "";
  var raw = parts[parts.length - 1].trim().toLowerCase();
  return STATE_ABBREVS[raw] || raw.toUpperCase().substring(0, 2);
}

function extractEmail(place) {
  if (!place) return "";
  if (place.email) return safeText(place.email);
  if (place.emails && Array.isArray(place.emails) && place.emails.length > 0) {
    return safeText(place.emails[0]);
  }
  return "";
}

function extractCategory(place) {
  if (!place) return "";
  if (place.category && typeof place.category === "string") return place.category;
  if (place.categories && Array.isArray(place.categories) && place.categories.length > 0) {
    return typeof place.categories[0] === "string" ? place.categories[0] : safeText(place.categories[0]);
  }
  return "";
}

// ============================================================
// SHEET HELPERS
// ============================================================

function ensureHeader(sheet) {
  var row1 = sheet.getRange(1, 1, 1, TEMPLATE_HEADERS.length).getValues()[0];
  var ok = true;
  for (var i = 0; i < TEMPLATE_HEADERS.length; i++) {
    if (String(row1[i] || "").trim() !== TEMPLATE_HEADERS[i]) { ok = false; break; }
  }
  if (!ok) {
    sheet.getRange(1, 1, 1, TEMPLATE_HEADERS.length).setValues([TEMPLATE_HEADERS]);
    var headerRange = sheet.getRange(1, 1, 1, TEMPLATE_HEADERS.length);
    headerRange.setFontWeight("bold");
    headerRange.setBackground("#0d1520");
    headerRange.setFontColor("#0ea5e9");
    sheet.setFrozenRows(1);
  }
}

function getExistingRows(sheet) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var data = sheet.getRange(2, 1, lastRow - 1, TEMPLATE_HEADERS.length).getValues();
  var rows = [];

  for (var i = 0; i < data.length; i++) {
    rows.push({
      name:    normKey(data[i][1]),
      phone:   normPhone(data[i][5]),
      address: normKey(data[i][4])
    });
  }

  return rows;
}

// ============================================================
// DEDUPE
// ============================================================

function isDuplicate(existingRows, name, phone, address) {
  var n = normKey(name);
  var p = normPhone(phone);
  var a = normKey(address);

  if (!n && !p && !a) return false;

  for (var i = 0; i < existingRows.length; i++) {
    var r = existingRows[i];
    if (n && r.name    && n === r.name)    return true;
    if (p && r.phone   && p === r.phone)   return true;
    if (a && r.address && a === r.address) return true;
  }

  return false;
}

// ============================================================
// UTILITIES
// ============================================================

function safeText(val) {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val;
  if (typeof val === "number") return String(val);
  try { return JSON.stringify(val); } catch (e) { return ""; }
}

function normKey(s) {
  return String(s || "").trim().toLowerCase();
}

function normPhone(phone) {
  return String(phone || "").trim().replace(/^\+/, "");
}

function normalizeState(raw) {
  if (!raw) return "";
  var t = String(raw).trim();
  if (/^[A-Za-z]{2}$/.test(t)) return t.toUpperCase();
  var key = t.toLowerCase();
  if (STATE_ABBREVS[key]) return STATE_ABBREVS[key];
  return t.toUpperCase().substring(0, 2);
}

// ============================================================
// OPTIONAL: Export sheet to CSV in Drive
// ============================================================

function exportToCsv() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) throw new Error("Sheet not found: " + CONFIG.SHEET_NAME);

  var values = sheet.getDataRange().getValues();
  var lines = [];

  for (var r = 0; r < values.length; r++) {
    var row = [];
    for (var c = 0; c < values[r].length; c++) {
      row.push(csvEscape(values[r][c]));
    }
    lines.push(row.join(","));
  }

  var csv = lines.join("\n");
  var name = "taser-dealers-" + new Date().toISOString().replace(/[:.]/g, "-") + ".csv";
  var file = DriveApp.createFile(name, csv, MimeType.CSV);
  Logger.log("CSV saved to Drive: " + file.getUrl());
}

function csvEscape(v) {
  var s = String(v === null || v === undefined ? "" : v);
  if (s.indexOf('"') !== -1) s = s.replace(/"/g, '""');
  if (s.indexOf(",") !== -1 || s.indexOf("\n") !== -1 || s.indexOf('"') !== -1) {
    s = '"' + s + '"';
  }
  return s;
}
