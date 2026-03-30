/**
 * TaserWorld.com
 * Dealer Publisher — Google Apps Script
 *
 * Reads dealer data from the "Taser World" sheet (populated by outscraper-dealer-scraper.gs)
 * and pushes dealer card HTML into each state page on GitHub via the GitHub API.
 *
 * SETUP:
 *   1. Ensure the "Taser World" sheet has been populated by outscraper-dealer-scraper.gs
 *   2. In Apps Script: Project Settings → Script Properties → add:
 *        GITHUB_TOKEN = your PAT with repo scope (from github.com/settings/tokens)
 *   3. Run publishAllDealers() to push to all states that have results
 *   4. Run publishOneState('texas') to update a single state page
 *
 * HOW IT WORKS:
 *   - Groups sheet rows by state abbreviation
 *   - For each state, fetches the current page HTML from GitHub
 *   - Replaces the dealer-grid div contents with generated dealer cards
 *   - Pushes the updated HTML back to GitHub (SHA-aware)
 *   - 600ms delay between GitHub API calls to avoid rate limiting
 */

var CONFIG = {
  GITHUB_OWNER: 'tobuku',
  GITHUB_REPO:  'taser',
  SHEET_NAME:   'Taser World',
  DELAY_MS:     600,
  MAX_DEALERS_PER_STATE: 12   // cap cards per state page — keeps pages clean
};

// ============================================================
// STATE MAPS
// ============================================================

var STATE_SLUGS = {
  'AL': 'alabama',        'AK': 'alaska',         'AZ': 'arizona',
  'AR': 'arkansas',       'CA': 'california',      'CO': 'colorado',
  'CT': 'connecticut',    'DE': 'delaware',        'FL': 'florida',
  'GA': 'georgia',        'HI': 'hawaii',          'ID': 'idaho',
  'IL': 'illinois',       'IN': 'indiana',         'IA': 'iowa',
  'KS': 'kansas',         'KY': 'kentucky',        'LA': 'louisiana',
  'ME': 'maine',          'MD': 'maryland',        'MA': 'massachusetts',
  'MI': 'michigan',       'MN': 'minnesota',       'MS': 'mississippi',
  'MO': 'missouri',       'MT': 'montana',         'NE': 'nebraska',
  'NV': 'nevada',         'NH': 'new-hampshire',   'NJ': 'new-jersey',
  'NM': 'new-mexico',     'NY': 'new-york',        'NC': 'north-carolina',
  'ND': 'north-dakota',   'OH': 'ohio',            'OK': 'oklahoma',
  'OR': 'oregon',         'PA': 'pennsylvania',    'RI': 'rhode-island',
  'SC': 'south-carolina', 'SD': 'south-dakota',    'TN': 'tennessee',
  'TX': 'texas',          'UT': 'utah',            'VT': 'vermont',
  'VA': 'virginia',       'WA': 'washington',      'DC': 'washington-dc',
  'WV': 'west-virginia',  'WI': 'wisconsin',       'WY': 'wyoming'
};

var STATE_NAMES = {
  'AL': 'Alabama',        'AK': 'Alaska',          'AZ': 'Arizona',
  'AR': 'Arkansas',       'CA': 'California',      'CO': 'Colorado',
  'CT': 'Connecticut',    'DE': 'Delaware',        'FL': 'Florida',
  'GA': 'Georgia',        'HI': 'Hawaii',          'ID': 'Idaho',
  'IL': 'Illinois',       'IN': 'Indiana',         'IA': 'Iowa',
  'KS': 'Kansas',         'KY': 'Kentucky',        'LA': 'Louisiana',
  'ME': 'Maine',          'MD': 'Maryland',        'MA': 'Massachusetts',
  'MI': 'Michigan',       'MN': 'Minnesota',       'MS': 'Mississippi',
  'MO': 'Missouri',       'MT': 'Montana',         'NE': 'Nebraska',
  'NV': 'Nevada',         'NH': 'New Hampshire',   'NJ': 'New Jersey',
  'NM': 'New Mexico',     'NY': 'New York',        'NC': 'North Carolina',
  'ND': 'North Dakota',   'OH': 'Ohio',            'OK': 'Oklahoma',
  'OR': 'Oregon',         'PA': 'Pennsylvania',    'RI': 'Rhode Island',
  'SC': 'South Carolina', 'SD': 'South Dakota',    'TN': 'Tennessee',
  'TX': 'Texas',          'UT': 'Utah',            'VT': 'Vermont',
  'VA': 'Virginia',       'WA': 'Washington',      'DC': 'Washington DC',
  'WV': 'West Virginia',  'WI': 'Wisconsin',       'WY': 'Wyoming'
};

// ============================================================
// MAIN ENTRY POINTS
// ============================================================

/**
 * Publish dealer cards to ALL state pages that have data in the sheet.
 * Skips states with no results — does not overwrite with empty content.
 */
function publishAllDealers() {
  var dealersByState = getDealersByState();
  var states = Object.keys(dealersByState);

  Logger.log('Publishing dealers to ' + states.length + ' states...');

  var success = 0;
  var skipped = 0;
  var errors  = 0;

  for (var i = 0; i < states.length; i++) {
    var abbr    = states[i];
    var slug    = STATE_SLUGS[abbr];
    var dealers = dealersByState[abbr];

    if (!slug) {
      Logger.log('SKIP — no slug for state: ' + abbr);
      skipped++;
      continue;
    }

    Logger.log('[' + (i + 1) + '/' + states.length + '] ' + abbr + ' (' + slug + ') — ' + dealers.length + ' dealers');

    try {
      var result = pushDealersToState(slug, abbr, dealers);
      if (result) {
        success++;
      } else {
        skipped++;
      }
    } catch (err) {
      Logger.log('ERROR on ' + slug + ': ' + err.message);
      errors++;
    }

    if (i < states.length - 1) Utilities.sleep(CONFIG.DELAY_MS);
  }

  Logger.log('Done. Success: ' + success + ' | Skipped: ' + skipped + ' | Errors: ' + errors);
}

/**
 * Publish dealer cards for a single state.
 * Pass the state slug (e.g. 'texas', 'new-york') or abbreviation (e.g. 'TX', 'NY').
 */
function publishOneState(slugOrAbbr) {
  var abbr, slug;

  if (slugOrAbbr.length === 2) {
    abbr = slugOrAbbr.toUpperCase();
    slug = STATE_SLUGS[abbr];
  } else {
    slug = slugOrAbbr.toLowerCase();
    abbr = null;
    for (var a in STATE_SLUGS) {
      if (STATE_SLUGS[a] === slug) { abbr = a; break; }
    }
  }

  if (!slug || !abbr) {
    Logger.log('ERROR: Could not find state for: ' + slugOrAbbr);
    return;
  }

  var dealersByState = getDealersByState();
  var dealers = dealersByState[abbr] || [];

  Logger.log('Publishing ' + dealers.length + ' dealers to ' + slug + '...');
  pushDealersToState(slug, abbr, dealers);
  Logger.log('Done.');
}

// ============================================================
// CORE PUBLISHER
// ============================================================

function pushDealersToState(slug, abbr, dealers) {
  var token    = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  var filePath = 'states/' + slug + '/index.html';
  var apiUrl   = 'https://api.github.com/repos/' + CONFIG.GITHUB_OWNER + '/' + CONFIG.GITHUB_REPO + '/contents/' + filePath;

  // Fetch current file from GitHub
  var fileData = getFileFromGitHub(apiUrl, token);
  if (!fileData) {
    Logger.log('SKIP — file not found on GitHub: ' + filePath);
    return false;
  }

  var currentHtml = Utilities.newBlob(Utilities.base64Decode(fileData.content.replace(/\n/g, ''))).getDataAsString();
  var sha          = fileData.sha;

  // Build replacement dealer cards HTML
  var cardsHtml = buildDealerGridContent(dealers, abbr);

  // Replace the dealer-grid div contents in the page HTML
  var updatedHtml = replaceDealerGrid(currentHtml, cardsHtml);

  if (updatedHtml === currentHtml) {
    Logger.log('SKIP — dealer-grid marker not found in: ' + filePath);
    return false;
  }

  // Push updated file to GitHub
  var stateName = STATE_NAMES[abbr] || abbr;
  var commitMsg = 'Update dealer listings: ' + stateName + ' (' + dealers.length + ' dealers)';
  pushToGitHub(apiUrl, token, updatedHtml, sha, commitMsg);
  return true;
}

// ============================================================
// HTML REPLACEMENT
// ============================================================

/**
 * Replaces the content of <div class="dealer-grid" id="dealerGrid"> ... </div>
 * with freshly generated dealer cards.
 */
function replaceDealerGrid(html, newInnerHtml) {
  var GRID_OPEN  = '<div class="dealer-grid" id="dealerGrid">';
  var GRID_CLOSE = '\n    </div>';   // 4-space indent — closes the dealer-grid div

  var startPos = html.indexOf(GRID_OPEN);
  if (startPos === -1) return html;

  var searchFrom = startPos + GRID_OPEN.length;
  var endPos     = html.indexOf(GRID_CLOSE, searchFrom);
  if (endPos === -1) return html;

  var before = html.substring(0, startPos + GRID_OPEN.length);
  var after  = html.substring(endPos); // keeps the closing </div> and everything after

  return before + '\n' + newInnerHtml + after;
}

// ============================================================
// DEALER CARD HTML BUILDER
// ============================================================

/**
 * Builds the full inner HTML for the dealer-grid div.
 * If no dealers, shows the "no dealers" placeholder.
 */
function buildDealerGridContent(dealers, abbr) {
  var stateName = STATE_NAMES[abbr] || abbr;

  if (!dealers || dealers.length === 0) {
    return '      <!-- GAS:DEALER_CARDS -->\n'
      + '      <div class="no-dealers">\n'
      + '        <p>// Dealer listings for ' + escHtml(stateName) + ' are being populated.</p>\n'
      + '        <p style="margin-top:8px;">Are you a taser dealer in ' + escHtml(stateName) + '?</p>\n'
      + '        <a href="/submit-listing/" class="btn-primary" style="display:inline-flex;width:auto;margin-top:20px;">Submit Your Listing</a>\n'
      + '      </div>\n'
      + '    ';
  }

  // Cap to max dealers per page
  var capped = dealers.slice(0, CONFIG.MAX_DEALERS_PER_STATE);

  var cards = '';
  for (var i = 0; i < capped.length; i++) {
    cards += buildDealerCardHTML(capped[i]);
  }

  // Add "submit listing" card at the end
  cards += '      <div class="dealer-card" style="display:flex;flex-direction:column;justify-content:center;align-items:flex-start;border-style:dashed;">\n'
    + '        <p style="font-family:var(--mono);font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:var(--text-3);margin-bottom:12px;">// List Your Business</p>\n'
    + '        <p style="font-size:14px;color:var(--text-2);margin-bottom:16px;line-height:1.6;">Are you a taser dealer in ' + escHtml(stateName) + '? Get listed in our directory.</p>\n'
    + '        <a href="/submit-listing/" style="display:inline-flex;align-items:center;background:var(--blue);color:#fff;font-family:var(--display);font-size:13px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:10px 20px;">Submit Listing</a>\n'
    + '      </div>\n';

  return '      <!-- GAS:DEALER_CARDS -->\n' + cards + '    ';
}

/**
 * Builds HTML for a single dealer card.
 */
function buildDealerCardHTML(d) {
  var name     = escHtml(d.name     || 'Dealer');
  var city     = escHtml(d.city     || '');
  var state    = escHtml(d.state    || '');
  var address  = escHtml(d.address  || '');
  var phone    = escHtml(d.phone    || '');
  var website  = d.website || '';
  var category = escHtml(d.category || '');
  var rating   = d.rating  || '';
  var reviews  = d.reviews || '';

  var location = city && state ? city + ', ' + state : (city || state);

  var contactRows = '';
  if (phone) {
    contactRows += '          <div class="dealer-contact-row">\n'
      + '            <span class="contact-icon">Phone</span>\n'
      + '            <span>' + phone + '</span>\n'
      + '          </div>\n';
  }
  if (address) {
    contactRows += '          <div class="dealer-contact-row">\n'
      + '            <span class="contact-icon">Addr</span>\n'
      + '            <span>' + address + '</span>\n'
      + '          </div>\n';
  }
  if (website) {
    var displayUrl = website.replace(/^https?:\/\//, '').replace(/\/$/, '');
    var safeUrl    = escHtml(website.indexOf('http') === 0 ? website : 'https://' + website);
    contactRows += '          <div class="dealer-contact-row">\n'
      + '            <span class="contact-icon">Web</span>\n'
      + '            <a href="' + safeUrl + '" target="_blank" rel="nofollow">' + escHtml(displayUrl) + '</a>\n'
      + '          </div>\n';
  }

  var tags = '';
  if (category) {
    tags += '<span class="tag">' + category + '</span>';
  }
  if (rating) {
    var ratingNum = parseFloat(rating);
    if (!isNaN(ratingNum) && ratingNum > 0) {
      tags += '<span class="tag">' + ratingNum.toFixed(1) + ' stars';
      if (reviews) tags += ' (' + reviews + ')';
      tags += '</span>';
    }
  }

  return '      <div class="dealer-card">\n'
    + '        <span class="dealer-badge">// Taser Dealer</span>\n'
    + '        <h3 class="dealer-name">' + name + '</h3>\n'
    + (location ? '        <p class="dealer-location">' + location + '</p>\n' : '')
    + (contactRows ? '        <div class="dealer-contacts">\n' + contactRows + '        </div>\n' : '')
    + (tags ? '        <div class="dealer-tags">' + tags + '</div>\n' : '')
    + '      </div>\n';
}

// ============================================================
// SHEET READER
// ============================================================

/**
 * Reads the "Taser World" sheet and returns dealers grouped by state abbreviation.
 * { 'TX': [...], 'CA': [...], ... }
 */
function getDealersByState() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);

  if (!sheet) throw new Error('Sheet not found: ' + CONFIG.SHEET_NAME);

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    Logger.log('Sheet is empty. Run the scraper first.');
    return {};
  }

  // Read all data at once (faster than row-by-row)
  var data    = sheet.getRange(2, 1, lastRow - 1, 13).getValues();
  var headers = ['id','name','city','state','address','phone','website','email','category','rating','reviews','created_at','updated_at'];

  var byState = {};

  for (var i = 0; i < data.length; i++) {
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      row[headers[j]] = String(data[i][j] || '').trim();
    }

    if (!row.name) continue;

    var abbr = row.state.toUpperCase();
    if (!abbr || abbr.length !== 2) continue;

    if (!byState[abbr]) byState[abbr] = [];
    byState[abbr].push(row);
  }

  // Sort each state's dealers by rating descending (highest rated first)
  for (var a in byState) {
    byState[a].sort(function(x, y) {
      var rx = parseFloat(x.rating) || 0;
      var ry = parseFloat(y.rating) || 0;
      return ry - rx;
    });
  }

  return byState;
}

// ============================================================
// GITHUB API
// ============================================================

function getFileFromGitHub(apiUrl, token) {
  var options = {
    method: 'get',
    headers: {
      'Authorization': 'token ' + token,
      'Accept': 'application/vnd.github.v3+json'
    },
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(apiUrl, options);
  var code     = response.getResponseCode();

  if (code === 404) return null;
  if (code !== 200) {
    Logger.log('GitHub GET error ' + code + ': ' + response.getContentText().substring(0, 200));
    return null;
  }

  return JSON.parse(response.getContentText());
}

function pushToGitHub(apiUrl, token, html, sha, commitMessage) {
  var encoded = Utilities.base64Encode(html, Utilities.Charset.UTF_8);

  var payload = {
    message: commitMessage,
    content: encoded,
    sha:     sha
  };

  var options = {
    method: 'put',
    headers: {
      'Authorization': 'token ' + token,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  var response = UrlFetchApp.fetch(apiUrl, options);
  var code     = response.getResponseCode();

  if (code !== 200 && code !== 201) {
    Logger.log('GitHub PUT error ' + code + ': ' + response.getContentText().substring(0, 400));
    throw new Error('GitHub push failed with code ' + code);
  }

  Logger.log('Pushed: ' + apiUrl.split('/contents/')[1]);
}

// ============================================================
// UTILITIES
// ============================================================

function escHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================================
// DIAGNOSTICS
// ============================================================

/**
 * Logs a summary of how many dealers are in each state — useful to review
 * data quality before publishing.
 */
function previewDealerCounts() {
  var byState = getDealersByState();
  var states  = Object.keys(byState).sort();

  Logger.log('=== Dealer counts by state ===');
  var total = 0;
  for (var i = 0; i < states.length; i++) {
    var count = byState[states[i]].length;
    Logger.log(states[i] + ' (' + (STATE_NAMES[states[i]] || '?') + '): ' + count);
    total += count;
  }
  Logger.log('Total: ' + total + ' dealers across ' + states.length + ' states');
}

/**
 * Preview the dealer cards HTML for one state without pushing to GitHub.
 * Use this to check formatting before a full publish run.
 */
function previewOneState(abbr) {
  var byState = getDealersByState();
  var dealers = byState[abbr.toUpperCase()] || [];
  Logger.log('=== Preview dealer cards for ' + abbr + ' (' + dealers.length + ' dealers) ===');
  Logger.log(buildDealerGridContent(dealers, abbr.toUpperCase()));
}
