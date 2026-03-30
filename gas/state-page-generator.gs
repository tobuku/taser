// ============================================================
// TaserWorld — State Page Generator
// Google Apps Script
//
// SETUP:
//   1. Go to script.google.com → New project → paste this file
//   2. Run setupStatesSheet() once to create and fill the data sheet
//   3. Add your GitHub Personal Access Token:
//      Extensions → Apps Script → Project Settings → Script Properties
//      Property name: GITHUB_TOKEN   Value: ghp_yourtoken
//   4. Run generateAllStatePages() to push all 50 pages to GitHub
//   5. Run generateOnePage('texas') to regenerate a single page
//
// GITHUB TOKEN SCOPES NEEDED: repo (read/write contents)
// ============================================================

const CONFIG = {
  GITHUB_OWNER: 'tobuku',
  GITHUB_REPO:  'taser',
  SHEET_NAME:   'States',
  COMMIT_NAME:  'TaserWorld GAS',
  COMMIT_EMAIL: 'gas@taserworld.com'
};

// ============================================================
// MAIN ENTRY POINTS
// ============================================================

function generateAllStatePages() {
  const sheet = getSheet();
  const rows  = getStateRows(sheet);
  const results = { success: 0, failed: 0, errors: [] };

  rows.forEach(function(state) {
    try {
      const html = buildStateHTML(state);
      const path = 'states/' + state.slug + '/index.html';
      pushToGitHub(path, html, 'Auto-generate state page: ' + state.name);
      results.success++;
      Utilities.sleep(500); // stay under GitHub API rate limit
    } catch(e) {
      results.failed++;
      results.errors.push(state.name + ': ' + e.message);
    }
  });

  const msg = 'Done. ' + results.success + ' pages generated, ' + results.failed + ' failed.';
  if (results.errors.length) {
    SpreadsheetApp.getUi().alert(msg + '\n\nErrors:\n' + results.errors.join('\n'));
  } else {
    SpreadsheetApp.getUi().alert(msg);
  }
}

function generateOnePage(slugOrName) {
  const sheet = getSheet();
  const rows  = getStateRows(sheet);
  const state = rows.find(function(r) {
    return r.slug === slugOrName.toLowerCase() || r.name.toLowerCase() === slugOrName.toLowerCase();
  });

  if (!state) {
    SpreadsheetApp.getUi().alert('State not found: ' + slugOrName);
    return;
  }

  const html = buildStateHTML(state);
  const path = 'states/' + state.slug + '/index.html';
  pushToGitHub(path, html, 'Update state page: ' + state.name);
  SpreadsheetApp.getUi().alert('Done — ' + state.name + ' pushed to GitHub.');
}

// Run this from the menu to add a custom menu to the sheet
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('TaserWorld')
    .addItem('Generate All State Pages', 'generateAllStatePages')
    .addItem('Setup States Sheet (first run)', 'setupStatesSheet')
    .addToUi();
}

// ============================================================
// HTML BUILDER
// ============================================================

function buildStateHTML(s) {
  // s = state object from sheet row
  // s.status: 'legal' | 'restricted' | 'illegal'
  const statusLabel = s.status === 'legal'      ? 'Legal for Civilians'
                    : s.status === 'restricted'  ? 'Restricted'
                    : 'Illegal for Civilians';

  const statusClass = 'status-' + s.status;

  const heroAccent = s.status === 'legal'      ? 'linear-gradient(90deg,transparent,var(--green),var(--blue),transparent)'
                   : s.status === 'restricted'  ? 'linear-gradient(90deg,transparent,var(--yellow),transparent)'
                   : 'linear-gradient(90deg,transparent,var(--red),transparent)';

  const permitText = s.permit_required === 'No' ? '// No permit required'
                   : '// ' + s.permit_required;

  const panelLegalValue  = s.status !== 'illegal' ? 'yes' : 'no';
  const panelLegalText   = s.status !== 'illegal' ? 'Yes' : 'No';
  const panelPermitClass = s.permit_required === 'No' ? 'yes' : 'warn';
  const panelPermitText  = s.permit_required === 'No' ? 'No' : s.permit_required;

  const allowedItems = s.allowed_rules.map(function(r) {
    return '<li><span class="rule-icon allow">Y</span><span>' + escHtml(r) + '</span></li>';
  }).join('\n        ');

  const restrictionItems = s.restriction_rules.map(function(r) {
    return '<li><span class="rule-icon deny">N</span><span>' + escHtml(r) + '</span></li>';
  }).join('\n        ');

  const nearbyItems = s.nearby_states.map(function(n) {
    return '<a href="/states/' + n.slug + '/" class="nearby-state">'
         + '<span>' + escHtml(n.name) + '</span>'
         + '<span class="nearby-status ' + n.status + '">' + capitalize(n.status) + '</span>'
         + '</a>';
  }).join('\n        ');

  const canonicalUrl  = 'https://www.taserworld.com/states/' + s.slug + '/';
  const metaTitle     = 'Taser Laws in ' + s.name + ' — Dealers &amp; Legal Guide | TaserWorld';
  const metaDesc      = 'Is a taser legal in ' + s.name + '? '
    + (s.status === 'legal'     ? 'Yes — ' + (s.permit_required === 'No' ? 'no permit required.' : s.permit_required + ' required.') : '')
    + (s.status === 'restricted' ? 'Yes, with restrictions. ' + s.permit_required + ' required.' : '')
    + (s.status === 'illegal'    ? 'No — civilian tasers are prohibited in ' + s.name + '.' : '')
    + ' Find dealers and get the full legal breakdown.';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${metaTitle}</title>
  <meta name="description" content="${metaDesc}">
  <link rel="canonical" href="${canonicalUrl}">
  <meta property="og:title" content="Taser Laws in ${s.name} — TaserWorld">
  <meta property="og:description" content="${metaDesc}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:type" content="article">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;500&family=Barlow:wght@300;400;500;600&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    :root {
      --bg-deep:#080c10;--bg-mid:#0d1520;--bg-card:#111d2e;--bg-card2:#0e1928;
      --border:#1a2d44;--border-hi:#1e3a56;--blue:#0ea5e9;--blue-glow:rgba(14,165,233,0.15);
      --yellow:#facc15;--red:#ef4444;--green:#22c55e;
      --text-1:#e8edf3;--text-2:#8fa8c0;--text-3:#4d6b85;
      --display:'Barlow Condensed',sans-serif;--body:'Barlow',sans-serif;--mono:'IBM Plex Mono',monospace;
    }
    html{scroll-behavior:smooth;}
    body{background:var(--bg-deep);color:var(--text-1);font-family:var(--body);font-size:16px;line-height:1.6;overflow-x:hidden;}
    a{color:var(--blue);text-decoration:none;}a:hover{color:var(--yellow);}
    header{position:sticky;top:0;z-index:100;background:rgba(8,12,16,0.93);backdrop-filter:blur(12px);border-bottom:1px solid var(--border);}
    .header-inner{max-width:1280px;margin:0 auto;padding:0 24px;height:60px;display:flex;align-items:center;justify-content:space-between;gap:16px;}
    .logo{font-family:var(--display);font-size:26px;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;color:var(--text-1);}
    .logo span{color:var(--yellow);}
    .breadcrumb{font-family:var(--mono);font-size:11px;letter-spacing:0.08em;color:var(--text-3);display:flex;align-items:center;gap:8px;}
    .breadcrumb a{color:var(--text-3);}
    .inner{max-width:1280px;margin:0 auto;padding:0 24px;}
    .page-hero{background:var(--bg-mid);border-bottom:1px solid var(--border);padding:60px 0 48px;position:relative;overflow:hidden;}
    .page-hero::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:${heroAccent};}
    .section-label{font-family:var(--mono);font-size:11px;letter-spacing:0.2em;text-transform:uppercase;color:var(--blue);margin-bottom:12px;}
    h1{font-family:var(--display);font-size:clamp(48px,6vw,80px);font-weight:800;text-transform:uppercase;line-height:0.95;margin-bottom:20px;}
    h2{font-family:var(--display);font-size:28px;font-weight:800;text-transform:uppercase;letter-spacing:0.02em;margin-bottom:16px;margin-top:48px;color:var(--text-1);}
    h3{font-family:var(--display);font-size:20px;font-weight:700;text-transform:uppercase;letter-spacing:0.02em;margin-bottom:12px;margin-top:28px;color:var(--text-1);}
    .hero-desc{font-size:17px;color:var(--text-2);max-width:560px;line-height:1.7;margin-bottom:28px;}
    .hero-meta{display:flex;gap:16px;flex-wrap:wrap;align-items:center;}
    .status-badge{display:inline-flex;align-items:center;gap:8px;font-family:var(--mono);font-size:12px;font-weight:500;letter-spacing:0.1em;text-transform:uppercase;padding:8px 16px;}
    .status-badge::before{content:'';display:inline-block;width:8px;height:8px;border-radius:50%;}
    .status-legal{background:rgba(34,197,94,0.1);color:var(--green);border:1px solid rgba(34,197,94,0.3);}
    .status-legal::before{background:var(--green);}
    .status-restricted{background:rgba(250,204,21,0.08);color:var(--yellow);border:1px solid rgba(250,204,21,0.3);}
    .status-restricted::before{background:var(--yellow);}
    .status-illegal{background:rgba(239,68,68,0.08);color:var(--red);border:1px solid rgba(239,68,68,0.3);}
    .status-illegal::before{background:var(--red);}
    .hero-permit{font-family:var(--mono);font-size:11px;letter-spacing:0.1em;color:var(--text-3);text-transform:uppercase;}
    .hero-layout{display:grid;grid-template-columns:1fr auto;gap:48px;align-items:start;}
    .hero-panel{background:var(--bg-card);border:1px solid var(--border);padding:28px 32px;min-width:240px;}
    .hero-panel-row{padding:14px 0;border-bottom:1px solid var(--border);}
    .hero-panel-row:last-child{border-bottom:none;padding-bottom:0;}
    .hero-panel-row:first-child{padding-top:0;}
    .panel-label{font-family:var(--mono);font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:var(--text-3);margin-bottom:4px;}
    .panel-value{font-size:15px;color:var(--text-1);font-weight:500;}
    .panel-value.yes{color:var(--green);}
    .panel-value.no{color:var(--red);}
    .panel-value.warn{color:var(--yellow);}
    .main-layout{max-width:1280px;margin:0 auto;padding:60px 24px 80px;display:grid;grid-template-columns:1fr 320px;gap:48px;align-items:start;}
    .content-section{margin-bottom:48px;}
    .law-text{font-size:15px;color:var(--text-2);line-height:1.8;margin-bottom:16px;}
    .rule-list{list-style:none;display:flex;flex-direction:column;gap:10px;margin-bottom:20px;}
    .rule-list li{display:flex;gap:12px;align-items:flex-start;font-size:15px;color:var(--text-2);line-height:1.6;}
    .rule-icon{flex-shrink:0;width:20px;height:20px;border-radius:2px;display:flex;align-items:center;justify-content:center;font-family:var(--mono);font-size:11px;font-weight:700;margin-top:1px;}
    .rule-icon.allow{background:rgba(34,197,94,0.12);color:var(--green);}
    .rule-icon.deny{background:rgba(239,68,68,0.12);color:var(--red);}
    .rule-icon.warn{background:rgba(250,204,21,0.1);color:var(--yellow);}
    .law-cite{font-family:var(--mono);font-size:11px;letter-spacing:0.08em;color:var(--text-3);padding:12px 16px;background:var(--bg-card);border-left:2px solid var(--border-hi);margin-top:16px;}
    .info-box{background:var(--bg-card);border:1px solid rgba(250,204,21,0.3);padding:20px 24px;margin-bottom:24px;}
    .info-box-label{font-family:var(--mono);font-size:10px;letter-spacing:0.15em;text-transform:uppercase;color:var(--yellow);margin-bottom:8px;}
    .info-box p{font-size:14px;color:var(--text-2);line-height:1.7;}
    .dealers-section{background:var(--bg-mid);padding:60px 0;border-top:1px solid var(--border);}
    .dealer-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:20px;}
    .no-dealers{grid-column:1/-1;padding:48px;text-align:center;background:var(--bg-card);border:1px dashed var(--border);}
    .no-dealers p{color:var(--text-3);font-family:var(--mono);font-size:13px;letter-spacing:0.05em;margin-bottom:20px;}
    .sidebar{display:flex;flex-direction:column;gap:24px;}
    .sidebar-card{background:var(--bg-card);border:1px solid var(--border);padding:24px;}
    .sidebar-title{font-family:var(--mono);font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:var(--blue);margin-bottom:16px;}
    .quick-facts{display:flex;flex-direction:column;gap:0;}
    .quick-fact{display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);font-size:13px;}
    .quick-fact:last-child{border-bottom:none;}
    .qf-label{color:var(--text-3);font-family:var(--mono);font-size:10px;letter-spacing:0.08em;text-transform:uppercase;}
    .qf-value{color:var(--text-1);font-weight:500;}
    .qf-value.green{color:var(--green);}
    .qf-value.red{color:var(--red);}
    .qf-value.yellow{color:var(--yellow);}
    .btn-primary{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:var(--blue);color:#fff;font-family:var(--display);font-size:14px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:12px 24px;width:100%;transition:background 0.15s;}
    .btn-primary:hover{background:#38bdf8;color:#fff;}
    .btn-outline{display:inline-flex;align-items:center;justify-content:center;background:transparent;color:var(--yellow);font-family:var(--display);font-size:14px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;padding:11px 24px;width:100%;border:1px solid var(--yellow);margin-top:8px;transition:background 0.15s;}
    .btn-outline:hover{background:rgba(250,204,21,0.08);color:var(--yellow);}
    .nearby-states{display:flex;flex-direction:column;gap:2px;}
    .nearby-state{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:var(--bg-card2);border:1px solid var(--border);font-size:14px;color:var(--text-2);transition:border-color 0.15s,color 0.15s;}
    .nearby-state:hover{border-color:var(--blue);color:var(--text-1);}
    .nearby-status{font-family:var(--mono);font-size:10px;letter-spacing:0.06em;}
    .nearby-status.legal{color:var(--green);}
    .nearby-status.restricted{color:var(--yellow);}
    .nearby-status.illegal{color:var(--red);}
    footer{background:#050810;border-top:1px solid var(--border);padding:40px 0;}
    .footer-inner{max-width:1280px;margin:0 auto;padding:0 24px;display:flex;justify-content:space-between;align-items:flex-start;gap:24px;flex-wrap:wrap;}
    .footer-copy{font-family:var(--mono);font-size:11px;color:var(--text-3);}
    .footer-disclaimer{font-size:12px;color:var(--text-3);max-width:580px;line-height:1.6;}
    @media(max-width:960px){.hero-layout{grid-template-columns:1fr;}.hero-panel{min-width:unset;display:grid;grid-template-columns:repeat(3,1fr);}.hero-panel-row{border-bottom:none;border-right:1px solid var(--border);}.hero-panel-row:last-child{border-right:none;}.main-layout{grid-template-columns:1fr;}}
    @media(max-width:640px){.hero-panel{grid-template-columns:1fr;}.hero-panel-row{border-right:none;border-bottom:1px solid var(--border);}.dealer-grid{grid-template-columns:1fr;}}
    @media(prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important;}}
  </style>
  <script type="application/ld+json">
  {"@context":"https://schema.org","@type":"Article","headline":"Taser Laws in ${s.name} — Complete Legal Guide","description":"${metaDesc}","url":"${canonicalUrl}","publisher":{"@type":"Organization","name":"TaserWorld","url":"https://www.taserworld.com"}}
  </script>
</head>
<body>

<header>
  <div class="header-inner">
    <a href="/" class="logo">Taser<span>World</span></a>
    <nav class="breadcrumb" aria-label="Breadcrumb">
      <a href="/">Home</a>
      <span style="color:var(--border-hi)">/</span>
      <a href="/states/">States</a>
      <span style="color:var(--border-hi)">/</span>
      <span style="color:var(--text-2)">${s.name}</span>
    </nav>
  </div>
</header>

<section class="page-hero">
  <div class="inner">
    <div class="hero-layout">
      <div>
        <p class="section-label">State Legal Guide</p>
        <h1>Taser Laws<br>in ${s.name}</h1>
        <p class="hero-desc">${escHtml(s.hero_desc)}</p>
        <div class="hero-meta">
          <span class="status-badge ${statusClass}">${statusLabel}</span>
          <span class="hero-permit">${permitText}</span>
        </div>
      </div>
      <div class="hero-panel">
        <div class="hero-panel-row">
          <p class="panel-label">Civilian Legal</p>
          <p class="panel-value ${panelLegalValue}">${panelLegalText}</p>
        </div>
        <div class="hero-panel-row">
          <p class="panel-label">Permit Required</p>
          <p class="panel-value ${panelPermitClass}">${panelPermitText}</p>
        </div>
        <div class="hero-panel-row">
          <p class="panel-label">Min. Age</p>
          <p class="panel-value">${s.min_age}</p>
        </div>
        <div class="hero-panel-row">
          <p class="panel-label">Open Carry</p>
          <p class="panel-value ${s.open_carry === 'Yes' ? 'yes' : s.open_carry === 'No' ? 'no' : 'warn'}">${s.open_carry}</p>
        </div>
        <div class="hero-panel-row">
          <p class="panel-label">Concealed Carry</p>
          <p class="panel-value ${s.concealed_carry === 'Yes' ? 'yes' : s.concealed_carry === 'No' ? 'no' : 'warn'}">${s.concealed_carry}</p>
        </div>
      </div>
    </div>
  </div>
</section>

<div class="main-layout">
<main>

  <section class="content-section">
    <h2>${s.name} Taser Laws — Overview</h2>
    ${s.law_overview.split('\n').map(function(p){ return p.trim() ? '<p class="law-text">' + escHtml(p.trim()) + '</p>' : ''; }).join('\n    ')}
    ${s.law_cite ? '<div class="law-cite">// ' + escHtml(s.law_cite) + '</div>' : ''}
  </section>

  ${s.status !== 'illegal' ? `
  <section class="content-section">
    <h2>What Is Allowed</h2>
    <ul class="rule-list">
        ${allowedItems}
    </ul>
  </section>

  <section class="content-section">
    <h2>Restrictions &amp; Prohibited Locations</h2>
    <p class="law-text">Even in permissive states, certain locations prohibit weapons including tasers:</p>
    <ul class="rule-list">
        ${restrictionItems}
    </ul>
  </section>
  ` : `
  <section class="content-section">
    <h2>Important Restrictions</h2>
    <ul class="rule-list">
        ${restrictionItems}
    </ul>
  </section>
  `}

  <section class="content-section">
    <div class="info-box">
      <p class="info-box-label">Legal Reminder</p>
      <p>This is a summary for informational purposes only. Laws change and local ordinances vary. Consult a licensed ${s.name} attorney for advice specific to your situation. Always verify current statutes before purchasing or carrying.</p>
    </div>
  </section>

  <section class="content-section">
    <h2>Frequently Asked Questions</h2>

    <h3 style="margin-top:24px">Is a taser legal in ${s.name}?</h3>
    <p class="law-text">${s.status === 'legal' ? 'Yes. Tasers are legal for civilians in ' + s.name + (s.permit_required === 'No' ? ' with no permit required.' : ' with ' + s.permit_required + '.') : s.status === 'restricted' ? 'Yes, with restrictions. ' + escHtml(s.permit_required) + ' is required. See the overview above for full details.' : 'No. Civilian ownership of tasers is prohibited in ' + s.name + '. Possession without authorization may result in criminal charges.'}</p>

    <h3 style="margin-top:24px">Do I need a permit to buy a taser in ${s.name}?</h3>
    <p class="law-text">${s.permit_required === 'No' ? 'No. ' + s.name + ' does not require a permit, license, or registration to purchase or carry a taser.' : escHtml(s.permit_required) + ' is required in ' + s.name + '. See the state laws overview above for details.'}</p>

    <h3 style="margin-top:24px">Where can I buy a taser in ${s.name}?</h3>
    <p class="law-text">${s.status !== 'illegal' ? 'Licensed taser dealers operate throughout ' + s.name + '. You can also purchase civilian TASER models directly from Axon.com or through major retailers including Amazon. <a href="/dealers/">Find a local dealer.</a>' : 'Civilian taser ownership is prohibited in ' + s.name + '. Consult a local attorney for guidance on self-defense options.'}</p>
  </section>

</main>

<aside class="sidebar">
  <div class="sidebar-card">
    <p class="sidebar-title">Quick Reference</p>
    <div class="quick-facts">
      <div class="quick-fact"><span class="qf-label">Status</span><span class="qf-value ${s.status === 'legal' ? 'green' : s.status === 'restricted' ? 'yellow' : 'red'}">${capitalize(s.status)}</span></div>
      <div class="quick-fact"><span class="qf-label">Permit</span><span class="qf-value ${s.permit_required === 'No' ? 'green' : 'yellow'}">${s.permit_required === 'No' ? 'Not Required' : s.permit_required}</span></div>
      <div class="quick-fact"><span class="qf-label">Min Age</span><span class="qf-value">${s.min_age}</span></div>
      <div class="quick-fact"><span class="qf-label">Open Carry</span><span class="qf-value ${s.open_carry === 'Yes' ? 'green' : s.open_carry === 'No' ? 'red' : 'yellow'}">${s.open_carry}</span></div>
      <div class="quick-fact"><span class="qf-label">Concealed</span><span class="qf-value ${s.concealed_carry === 'Yes' ? 'green' : s.concealed_carry === 'No' ? 'red' : 'yellow'}">${s.concealed_carry}</span></div>
      <div class="quick-fact"><span class="qf-label">In Vehicle</span><span class="qf-value ${s.in_vehicle === 'Yes' ? 'green' : s.in_vehicle === 'No' ? 'red' : 'yellow'}">${s.in_vehicle}</span></div>
      <div class="quick-fact"><span class="qf-label">Felons</span><span class="qf-value red">Prohibited</span></div>
      <div class="quick-fact"><span class="qf-label">Stand Ground</span><span class="qf-value ${s.stand_ground === 'Yes' ? 'green' : 'yellow'}">${s.stand_ground}</span></div>
    </div>
  </div>

  ${s.status !== 'illegal' ? `
  <div class="sidebar-card">
    <p class="sidebar-title">Find a Dealer</p>
    <p style="font-size:14px;color:var(--text-2);margin-bottom:16px;line-height:1.6;">Browse licensed taser dealers in ${s.name}.</p>
    <a href="#dealers" class="btn-primary">View ${s.name} Dealers</a>
    <a href="/submit-listing/" class="btn-outline">List Your Business</a>
  </div>
  ` : ''}

  <div class="sidebar-card">
    <p class="sidebar-title">Neighboring States</p>
    <div class="nearby-states">
        ${nearbyItems}
    </div>
  </div>

  <div class="sidebar-card">
    <p class="sidebar-title">Related Resources</p>
    <div class="nearby-states">
      <a href="/resources/how-tasers-work/" class="nearby-state">How Tasers Work</a>
      <a href="/resources/self-defense-laws/" class="nearby-state">Self-Defense Laws</a>
      <a href="/resources/taser-vs-stun-gun/" class="nearby-state">Taser vs. Stun Gun</a>
      <a href="/states/" class="nearby-state">All 50 States</a>
    </div>
  </div>
</aside>
</div>

${s.status !== 'illegal' ? `
<section class="dealers-section" id="dealers">
  <div class="inner">
    <p class="section-label">Dealer Directory</p>
    <h2 style="font-family:'Barlow Condensed',sans-serif;font-size:clamp(28px,4vw,44px);font-weight:800;text-transform:uppercase;margin-bottom:12px;margin-top:0;">Taser Dealers in ${s.name}</h2>
    <p style="font-size:16px;color:var(--text-2);margin-bottom:32px;max-width:560px;">Licensed retailers and authorized TASER dealers serving ${s.name} customers.</p>
    <div class="dealer-grid" id="dealerGrid">
      <!-- GAS:DEALER_CARDS -->
      <div class="no-dealers">
        <p>// Dealer listings for ${s.name} are being populated.</p>
        <p style="margin-top:8px;">Are you a taser dealer in ${s.name}?</p>
        <a href="/submit-listing/" class="btn-primary" style="display:inline-flex;width:auto;margin-top:20px;">Submit Your Listing</a>
      </div>
    </div>
  </div>
</section>
` : ''}

<footer>
  <div class="footer-inner">
    <div>
      <a href="/" class="logo" style="font-family:'Barlow Condensed',sans-serif;font-size:24px;font-weight:800;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-1);display:block;margin-bottom:10px;">Taser<span style="color:var(--yellow)">World</span></a>
      <div style="display:flex;gap:20px;flex-wrap:wrap;margin-top:4px;">
        <a href="/" style="font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:0.08em;color:var(--text-3);text-transform:uppercase;">Home</a>
        <a href="/dealers/" style="font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:0.08em;color:var(--text-3);text-transform:uppercase;">Dealers</a>
        <a href="/states/" style="font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:0.08em;color:var(--text-3);text-transform:uppercase;">All States</a>
        <a href="/best-taser/" style="font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:0.08em;color:var(--text-3);text-transform:uppercase;">Best Taser</a>
      </div>
    </div>
    <div>
      <p class="footer-copy">&copy; 2025 TaserWorld.com</p>
      <p class="footer-disclaimer" style="margin-top:8px;">DISCLAIMER: For informational purposes only. Not legal advice. Laws change — verify current statutes with your local authorities or a qualified attorney before purchasing or carrying a taser. "TASER" is a registered trademark of Axon Enterprise, Inc.</p>
    </div>
  </div>
</footer>

</body>
</html>`;
}

// ============================================================
// GITHUB API
// ============================================================

function pushToGitHub(filePath, content, commitMessage) {
  const token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) throw new Error('GITHUB_TOKEN not set in Script Properties.');

  const apiUrl = 'https://api.github.com/repos/' + CONFIG.GITHUB_OWNER + '/' + CONFIG.GITHUB_REPO + '/contents/' + filePath;
  const encoded = Utilities.base64Encode(content, Utilities.Charset.UTF_8);

  // Check if file already exists (need SHA to update)
  const existingSHA = getFileSHA(apiUrl, token);

  const payload = {
    message: commitMessage,
    content: encoded,
    committer: { name: CONFIG.COMMIT_NAME, email: CONFIG.COMMIT_EMAIL }
  };
  if (existingSHA) payload.sha = existingSHA;

  const options = {
    method: 'put',
    contentType: 'application/json',
    headers: { 'Authorization': 'token ' + token, 'Accept': 'application/vnd.github.v3+json' },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(apiUrl, options);
  const code = response.getResponseCode();
  if (code !== 200 && code !== 201) {
    throw new Error('GitHub API error ' + code + ': ' + response.getContentText().substring(0, 200));
  }
}

function getFileSHA(apiUrl, token) {
  try {
    const response = UrlFetchApp.fetch(apiUrl, {
      method: 'get',
      headers: { 'Authorization': 'token ' + token, 'Accept': 'application/vnd.github.v3+json' },
      muteHttpExceptions: true
    });
    if (response.getResponseCode() === 200) {
      return JSON.parse(response.getContentText()).sha;
    }
  } catch(e) {}
  return null;
}

// ============================================================
// SHEET HELPERS
// ============================================================

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sheet) throw new Error('Sheet "' + CONFIG.SHEET_NAME + '" not found. Run setupStatesSheet() first.');
  return sheet;
}

function getStateRows(sheet) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0].map(function(h){ return h.toString().trim().toLowerCase().replace(/\s+/g,'_'); });
  const rows = [];

  for (var i = 1; i < data.length; i++) {
    if (!data[i][0]) continue; // skip blank rows
    var obj = {};
    headers.forEach(function(h, idx) { obj[h] = data[i][idx] ? data[i][idx].toString().trim() : ''; });

    // Parse pipe-delimited arrays
    obj.allowed_rules    = obj.allowed_rules    ? obj.allowed_rules.split('|').map(function(x){ return x.trim(); }) : [];
    obj.restriction_rules= obj.restriction_rules? obj.restriction_rules.split('|').map(function(x){ return x.trim(); }) : [];

    // Parse nearby states: "Texas:legal|Oklahoma:legal|..."
    obj.nearby_states = obj.nearby_states ? obj.nearby_states.split('|').map(function(x){
      var parts = x.trim().split(':');
      return {
        name:   parts[0].trim(),
        slug:   slugify(parts[0].trim()),
        status: (parts[1] || 'legal').trim().toLowerCase()
      };
    }) : [];

    rows.push(obj);
  }
  return rows;
}

// ============================================================
// SHEET SETUP — Run once to populate all state data
// ============================================================

function setupStatesSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (sheet) {
    const ui = SpreadsheetApp.getUi();
    const resp = ui.alert('Sheet "' + CONFIG.SHEET_NAME + '" already exists. Overwrite?', ui.ButtonSet.YES_NO);
    if (resp !== ui.Button.YES) return;
    ss.deleteSheet(sheet);
  }
  sheet = ss.insertSheet(CONFIG.SHEET_NAME);

  const headers = [
    'name','slug','status','permit_required','min_age',
    'open_carry','concealed_carry','in_vehicle','stand_ground',
    'hero_desc','law_overview','law_cite',
    'allowed_rules','restriction_rules','nearby_states'
  ];

  const COMMON_RESTRICTIONS = 'Schools, school buses, and school events|Courts and court offices|Polling places on election day|Correctional facilities|Locations with posted no-weapons signage|Felons and those under domestic violence orders are prohibited';
  const COMMON_ALLOWED = 'Purchase and ownership without a permit|Carrying openly in public|Carrying concealed in public|Carrying in a personal vehicle|Carrying in most private businesses unless posted|Use in lawful self-defense|Purchase by adults 18 and older';

  const states = [
    ['Alabama','alabama','legal','No','18','Yes','Yes','Yes','Yes',
     'Tasers and stun guns are legal for civilian ownership in Alabama with no permit required. Adults 18 and older may purchase, possess, and carry a taser without restriction under state law.',
     'Alabama law does not classify tasers or stun guns as firearms. There are no statewide statutes prohibiting civilian ownership, purchase, or carry. Alabama is one of the most permissive states for civilian taser ownership.',
     'Alabama Code Title 13A — Criminal Code',
     COMMON_ALLOWED,
     COMMON_RESTRICTIONS,
     'Tennessee:legal|Georgia:legal|Florida:legal|Mississippi:legal'],

    ['Alaska','alaska','legal','No','18','Yes','Yes','Yes','Yes',
     'Tasers and stun guns are legal for civilian ownership in Alaska with no permit required. There are no statewide restrictions on purchase or possession for law-abiding adults.',
     'Alaska law places no restrictions on civilian ownership of tasers or stun guns. The state has some of the most permissive weapons laws in the nation, and no permit or registration is required to purchase, own, or carry a taser.',
     'Alaska Stat. § 11.61.210 — Misconduct Involving Weapons',
     COMMON_ALLOWED,
     COMMON_RESTRICTIONS,
     'Washington:legal|Canada (N/A):-'],

    ['Arizona','arizona','legal','No','18','Yes','Yes','Yes','Yes',
     'Tasers and stun guns are legal for civilian ownership in Arizona with no permit required. Arizona has some of the most permissive weapons laws in the country.',
     'Arizona does not classify tasers or electronic stun devices as prohibited weapons for civilian use. Adults 18 and older may purchase, possess, and carry without a permit or license of any kind.',
     'A.R.S. § 13-3101 — Weapons definitions; A.R.S. § 13-3102 — Misconduct involving weapons',
     COMMON_ALLOWED,
     COMMON_RESTRICTIONS,
     'California:legal|Nevada:legal|Utah:legal|Colorado:legal|New Mexico:legal'],

    ['Arkansas','arkansas','legal','No','18','Yes','Yes','Yes','Yes',
     'Tasers and stun guns are legal for civilian ownership in Arkansas with no permit required.',
     'Arkansas law does not prohibit civilian ownership of tasers or electronic control devices. No permit, license, or registration is required to purchase, possess, or carry a taser in Arkansas.',
     'A.C.A. § 5-73-120 — Carrying a weapon',
     COMMON_ALLOWED,
     COMMON_RESTRICTIONS,
     'Missouri:legal|Tennessee:legal|Mississippi:legal|Louisiana:legal|Oklahoma:legal|Texas:legal'],

    ['California','california','legal','No','18','Yes','Yes','Yes','Yes',
     'Tasers and stun guns are legal for civilian ownership in California with no permit required. Legal status was fully restored in 2019 following a California Supreme Court ruling.',
     'In People v. Camacho (2019), the California Supreme Court struck down the state\'s prior ban on civilian stun gun possession as an unconstitutional infringement on Second Amendment rights. Adults 18 and older may now purchase and possess a taser without a permit. Felons, persons convicted of assault with a stun gun, narcotics addicts, and minors are prohibited.',
     'California Penal Code § 22610 — Stun guns; People v. Camacho (2019)',
     COMMON_ALLOWED,
     'Schools and school grounds|Courts and court offices|State and local public buildings|Correctional facilities|Felons, assault convicts, narcotics addicts prohibited|Minors under 18 prohibited',
     'Oregon:legal|Nevada:legal|Arizona:legal'],

    ['Colorado','colorado','legal','No','18','Yes','Yes','Yes','Yes',
     'Tasers and stun guns are legal for civilian ownership in Colorado with no permit required.',
     'Colorado law does not restrict civilian ownership of electronic control devices. No permit or registration is required to purchase, possess, or carry a taser in Colorado.',
     'C.R.S. § 18-12-101 — Definitions',
     COMMON_ALLOWED,
     COMMON_RESTRICTIONS,
     'Wyoming:legal|Nebraska:legal|Kansas:legal|Oklahoma:legal|New Mexico:legal|Utah:legal'],

    ['Connecticut','connecticut','legal','No','18','Yes','Yes','Yes','No',
     'Tasers and stun guns are legal for civilian ownership in Connecticut. Carrying outside the home is permitted. Connecticut does not have a stand-your-ground law — a duty to retreat applies in public.',
     'Connecticut law permits civilian ownership of electronic defense weapons. Carrying in public is allowed. Connecticut is a duty-to-retreat state — you must attempt to retreat before using force in a public confrontation if it is safe to do so.',
     'C.G.S. § 53a-3 — Definitions; § 53a-19 — Use of physical force in defense of person',
     COMMON_ALLOWED,
     COMMON_RESTRICTIONS + '|Connecticut has a duty to retreat in public — attempt to retreat before using force if safe to do so',
     'New York:legal|Rhode Island:illegal|Massachusetts:legal'],

    ['Delaware','delaware','legal','No','18','Yes','Yes','Yes','No',
     'Tasers and stun guns are legal for civilian ownership in Delaware with no permit required.',
     'Delaware law does not restrict civilian ownership of tasers or stun guns. No permit is required to purchase, possess, or carry. Delaware does not have a broad stand-your-ground law.',
     'Del. Code Title 11 § 222 — Definitions',
     COMMON_ALLOWED,
     COMMON_RESTRICTIONS,
     'Maryland:restricted|New Jersey:legal|Pennsylvania:legal'],

    ['Florida','florida','legal','No','18','Yes','Yes','Yes','Yes',
     'Tasers and stun guns are legal for civilian ownership in Florida with no permit required. Florida has a strong stand-your-ground law.',
     'Florida Statute 790.01 exempts electric weapons from the weapons licensing requirement, meaning no concealed weapons license is required to carry a taser. Adults 18 and older may purchase, possess, and carry without restriction. Florida\'s stand-your-ground statute means there is no duty to retreat before using force in self-defense.',
     'Fla. Stat. § 790.01 — Unlicensed carrying of concealed weapons; § 776.013 — Home protection; § 776.012 — Use or threatened use of force in defense of person',
     COMMON_ALLOWED,
     COMMON_RESTRICTIONS,
     'Georgia:legal|Alabama:legal'],

    ['Georgia','georgia','legal','No','18','Yes','Yes','Yes','Yes',
     'Tasers and stun guns are legal for civilian ownership in Georgia with no permit required.',
     'Georgia law does not restrict civilian ownership of electronic control devices. No permit or license is required. Georgia has a stand-your-ground law and no duty to retreat before using force in self-defense.',
     'O.C.G.A. § 16-11-121 — Definitions',
     COMMON_ALLOWED,
     COMMON_RESTRICTIONS,
     'Florida:legal|Alabama:legal|Tennessee:legal|South Carolina:legal|North Carolina:legal'],

    ['Hawaii','hawaii','restricted','Background check + safety training required','21','Yes','Restricted','Yes','No',
     'Tasers (electric guns) are legal for civilian ownership in Hawaii as of January 1, 2022, for residents 21 and older. Purchase must be through an authorized dealer, and owners must pass a background check and complete state-approved safety training.',
     'Hawaii legalized civilian electric gun ownership effective January 1, 2022. Requirements include: purchaser must be 21 or older, purchase only through an authorized dealer, pass a criminal background check, and complete a state-approved safety training course. Hawaii does not have a stand-your-ground law — a duty to retreat may apply.',
     'Hawaii Revised Statutes § 134-B — Electric guns',
     'Purchase through authorized dealer|Ownership for residents 21 and older who pass background check|Carry by qualified permit holders|Use in lawful self-defense|In-home possession',
     'Must be 21 or older|Must purchase through authorized dealer only|Background check required at purchase|State-approved safety training required|Prohibited in schools, courthouses, and government buildings|Prohibited in correctional facilities|No stand-your-ground — duty to retreat may apply',
     'None (island state)'],

    ['Idaho','idaho','legal','No','18','Yes','Yes','Yes','Yes',
     'Tasers and stun guns are legal for civilian ownership in Idaho with no permit required.',
     'Idaho law places no restrictions on civilian ownership of tasers or stun guns. No permit or registration is required. Idaho has robust self-defense laws including stand-your-ground provisions.',
     'Idaho Code § 18-3302 — Carrying weapons',
     COMMON_ALLOWED,
     COMMON_RESTRICTIONS,
     'Washington:legal|Oregon:legal|Nevada:legal|Utah:legal|Wyoming:legal|Montana:legal'],

    ['Illinois','illinois','restricted','FOID Card required','21','Yes','Yes','Yes','Yes',
     'Tasers are legal in Illinois but require a Firearm Owner\'s Identification (FOID) Card to purchase or possess. Buyers must be 21 or older.',
     'Illinois classifies tasers as "firearms" for the purpose of the FOID Card requirement. To legally purchase, own, or carry a taser in Illinois, you must first obtain a Firearm Owner\'s Identification Card from the Illinois State Police. You must be at least 21 years old and pass a background check. FOID applications take several weeks to process.',
     '430 ILCS 65 — Firearm Owners Identification Card Act',
     'Purchase and ownership with valid FOID Card|Carry with valid FOID Card|In-home possession with FOID Card|Use in lawful self-defense',
     'Must be 21 or older|Valid FOID Card required to purchase|Valid FOID Card required to possess|FOID Card required — background check and application to Illinois State Police|Schools and school grounds|Courts and government buildings|Correctional facilities|Felons and disqualified persons prohibited',
     'Wisconsin:legal|Iowa:legal|Missouri:legal|Kentucky:legal|Indiana:legal'],

    ['Indiana','indiana','legal','No','18','Yes','Yes','Yes','Yes',
     'Tasers and stun guns are legal for civilian ownership in Indiana with no permit required.',
     'Indiana law does not restrict civilian ownership of electronic control devices. No permit or license is required to purchase, possess, or carry a taser in Indiana.',
     'Indiana Code § 35-47-1-5 — Definitions',
     COMMON_ALLOWED,
     COMMON_RESTRICTIONS,
     'Illinois:restricted|Ohio:legal|Kentucky:legal|Michigan:restricted'],

    ['Iowa','iowa','legal','No','18','Yes','Yes','Yes','Yes',
     'Tasers and stun guns are legal for civilian ownership in Iowa with no permit required.',
     'Iowa law does not prohibit civilian ownership of tasers. No permit is required. Iowa recognizes stand-your-ground rights in locations where you have a legal right to be.',
     'Iowa Code § 724.1 — Offensive weapons',
     COMMON_ALLOWED,
     COMMON_RESTRICTIONS,
     'Minnesota:legal|Wisconsin:legal|Illinois:restricted|Missouri:legal|Nebraska:legal|South Dakota:legal'],

    ['Kansas','kansas','legal','No','18','Yes','Yes','Yes','Yes',
     'Tasers and stun guns are legal for civilian ownership in Kansas with no permit required.',
     'Kansas law does not restrict civilian ownership of electronic control devices. No permit or registration is required.',
     'K.S.A. § 21-6301 — Criminal use of weapons',
     COMMON_ALLOWED,
     COMMON_RESTRICTIONS,
     'Nebraska:legal|Missouri:legal|Oklahoma:legal|Colorado:legal'],

    ['Kentucky','kentucky','legal','No','18','Yes','Yes','Yes','Yes',
     'Tasers and stun guns are legal for civilian ownership in Kentucky with no permit required.',
     'Kentucky law does not restrict civilian ownership of tasers or electronic stun devices. No permit or registration is required.',
     'KRS § 500.080 — Definitions for Kentucky Penal Code',
     COMMON_ALLOWED,
     COMMON_RESTRICTIONS,
     'Ohio:legal|Indiana:legal|Tennessee:legal|Virginia:legal|West Virginia:legal|Missouri:legal|Illinois:restricted'],

    ['Louisiana','louisiana','legal','No','18','Yes','Yes','Yes','Yes',
     'Tasers and stun guns are legal for civilian ownership in Louisiana with no permit required.',
     'Louisiana law does not restrict civilian ownership of tasers. No permit is required. Louisiana has a strong castle doctrine and stand-your-ground law.',
     'La. R.S. § 14:95 — Illegal carrying of weapons',
     COMMON_ALLOWED,
     COMMON_RESTRICTIONS,
     'Texas:legal|Arkansas:legal|Mississippi:legal'],

    ['Maine','maine','legal','No','18','Yes','Yes','Yes','Yes',
     'Tasers and stun guns are legal for civilian ownership in Maine with no permit required.',
     'Maine law does not restrict civilian ownership of electronic weapons. No permit is required to purchase, possess, or carry a taser in Maine.',
     'Me. Rev. Stat. Ann. tit. 17-A § 2 — Definitions',
     COMMON_ALLOWED,
     COMMON_RESTRICTIONS,
     'New Hampshire:legal|Vermont:legal'],

    ['Maryland','maryland','restricted','No (restricted carry)','18','No','No','Yes','No',
     'Tasers are legal to own in Maryland, but carrying a taser in public may be subject to restrictions. Maryland is a duty-to-retreat state with no stand-your-ground law.',
     'Maryland permits civilian ownership of stun guns and tasers without a permit for home use. However, carrying an electronic control device in public may be subject to restrictions under Maryland\'s broadly interpreted "dangerous weapon" statutes. Maryland is a duty-to-retreat state — you must attempt to retreat before using force in a public confrontation if safe to do so.',
     'Md. Code Ann., Crim. Law § 4-101 — Dangerous weapons; § 4-105 — Wearing, carrying, or transporting weapon',
     'In-home possession and storage|Carrying in a personal vehicle|Use in lawful self-defense at home',
     'Open carry may be restricted under dangerous weapon statutes|Concealed carry may require a permit|Duty to retreat in public — must attempt to retreat before using force|Schools and school grounds|Courts and government buildings|Correctional facilities|Felons prohibited',
     'Virginia:legal|West Virginia:legal|Pennsylvania:legal|Delaware:legal'],

    ['Massachusetts','massachusetts','legal','No (licensed dealer purchase recommended)','18','Yes','Yes','Yes','No',
     'Tasers are legal for civilian ownership in Massachusetts as of 2022 following a Supreme Judicial Court ruling. No permit is required, but purchase from a licensed dealer is strongly recommended.',
     'In Ramirez v. Commonwealth (2022), the Massachusetts Supreme Judicial Court struck down the state\'s prior ban on civilian stun gun possession as unconstitutional. Adults 18 and older may now purchase and possess a taser without a permit. Massachusetts is a duty-to-retreat state — a duty to retreat before using force in public applies when it is safe to do so.',
     'Ramirez v. Commonwealth (2022); M.G.L. c. 140 § 131J',
     'Purchase and ownership without a permit|In-home possession and storage|Carrying in a personal vehicle|Use in lawful self-defense',
     'Duty to retreat in public — must attempt to retreat before using force if safe to do so|Schools and school grounds|Courts and government buildings|Correctional facilities|Felons prohibited',
     'Rhode Island:illegal|Connecticut:legal|New Hampshire:legal|Vermont:legal|New York:legal'],

    ['Michigan','michigan','restricted','No (concealed carry requires CPL)','18','Yes','CPL required','Yes','Yes',
     'Tasers are legal to own and carry openly in Michigan without a permit. Concealed carry of a taser requires a Concealed Pistol License (CPL).',
     'Michigan classifies tasers as "pistols" for concealed carry licensing purposes. Carrying a taser concealed on your person outside the home requires a valid Concealed Pistol License. Open carry of a taser is permitted without a license. In-home possession requires no permit.',
     'MCL § 750.224a — Taser; MCL § 28.422 — License to purchase, carry, possess, or transport pistol',
     'In-home possession without permit|Open carry without permit|Concealed carry with valid CPL|Carrying in a personal vehicle|Use in lawful self-defense',
     'Concealed carry requires Concealed Pistol License (CPL)|Schools and school grounds|Courts and government buildings|Correctional facilities|Felons prohibited',
     'Ohio:legal|Indiana:legal|Wisconsin:legal|Minnesota:legal'],

    ['Minnesota','minnesota','legal','No','18','Yes','Yes','Yes','No',
     'Tasers and stun guns are legal for civilian ownership in Minnesota with no permit required. Minnesota does not have a stand-your-ground law.',
     'Minnesota law does not restrict civilian ownership of electronic control devices. No permit or registration is required. Minnesota does not have a stand-your-ground law — a duty to retreat may apply in public confrontations.',
     'Minn. Stat. § 609.02 — Definitions',
     COMMON_ALLOWED,
     COMMON_RESTRICTIONS + '|Minnesota has a duty to retreat in public',
     'Wisconsin:legal|Iowa:legal|South Dakota:legal|North Dakota:legal'],

    ['Mississippi','mississippi','legal','No','18','Yes','Yes','Yes','Yes',
     'Tasers and stun guns are legal for civilian ownership in Mississippi with no permit required.',
     'Mississippi law does not restrict civilian ownership of electronic control devices. No permit is required. Mississippi has strong stand-your-ground protections.',
     'Miss. Code Ann. § 97-37-1 — Deadly weapons; carrying concealed; exceptions',
     COMMON_ALLOWED,
     COMMON_RESTRICTIONS,
     'Tennessee:legal|Alabama:legal|Louisiana:legal|Arkansas:legal'],

    ['Missouri','missouri','legal','No','18','Yes','Yes','Yes','Yes',
     'Tasers and stun guns are legal for civilian ownership in Missouri with no permit required.',
     'Missouri law does not restrict civilian ownership of electronic control devices. No permit is required to purchase, possess, or carry.',
     'Mo. Rev. Stat. § 571.010 — Definitions',
     COMMON_ALLOWED,
     COMMON_RESTRICTIONS,
     'Illinois:restricted|Iowa:legal|Kansas:legal|Oklahoma:legal|Arkansas:legal|Tennessee:legal|Kentucky:legal'],

    ['Montana','montana','legal','No','18','Yes','Yes','Yes','Yes',
     'Tasers and stun guns are legal for civilian ownership in Montana with no permit required.',
     'Montana law does not restrict civilian ownership of tasers or electronic stun devices. No permit or registration is required.',
     'Mont. Code Ann. § 45-8-316 — Carrying concealed weapons',
     COMMON_ALLOWED,
     COMMON_RESTRICTIONS,
     'Idaho:legal|Wyoming:legal|North Dakota:legal|South Dakota:legal'],

    ['Nebraska','nebraska','legal','No','18','Yes','Yes','Yes','Yes',
     'Tasers and stun guns are legal for civilian ownership in Nebraska with no permit required.',
     'Nebraska law does not restrict civilian ownership of electronic control devices. No permit or registration is required.',
     'Neb. Rev. Stat. § 28-1201 — Terms, defined',
     COMMON_ALLOWED,
     COMMON_RESTRICTIONS,
     'South Dakota:legal|Iowa:legal|Kansas:legal|Colorado:legal|Wyoming:legal'],

    ['Nevada','nevada','legal','No','18','Yes','Yes','Yes','Yes',
     'Tasers and stun guns are legal for civilian ownership in Nevada with no permit required.',
     'Nevada law does not restrict civilian ownership of electronic control devices. No permit or registration is required. Nevada has stand-your-ground protections.',
     'NRS § 202.253 — Definitions',
     COMMON_ALLOWED,
     COMMON_RESTRICTIONS,
     'California:legal|Arizona:legal|Utah:legal|Idaho:legal|Oregon:legal'],

    ['New Hampshire','new-hampshire','legal','No','18','Yes','Yes','Yes','Yes',
     'Tasers and stun guns are legal for civilian ownership in New Hampshire with no permit required.',
     'New Hampshire law does not restrict civilian ownership of electronic control devices. No permit or registration is required.',
     'RSA § 159:1 — Definitions',
     COMMON_ALLOWED,
     COMMON_RESTRICTIONS,
     'Vermont:legal|Maine:legal|Massachusetts:legal'],

    ['New Jersey','new-jersey','legal','No (licensed dealer purchase)','18','Yes','Yes','Yes','No',
     'Tasers are legal for civilian ownership in New Jersey as of 2023 following a federal court ruling. No permit is required, but purchase from a licensed dealer is recommended.',
     'In Ass\'n of NJ Rifle & Pistol Clubs v. Attorney General (2023), a federal court struck down New Jersey\'s ban on civilian stun gun possession. Adults 18 and older may purchase and possess a taser. Purchase from a licensed dealer is recommended to ensure compliance. New Jersey is a duty-to-retreat state.',
     'Ass\'n of NJ Rifle & Pistol Clubs v. AG (2023); N.J.S.A. 2C:39-1',
     'Purchase and ownership without a permit|In-home possession|Carrying in a personal vehicle|Use in lawful self-defense',
     'Duty to retreat in public|Schools and school grounds|Courts and government buildings|Correctional facilities|Felons prohibited',
     'New York:legal|Pennsylvania:legal|Delaware:legal'],

    ['New Mexico','new-mexico','legal','No','18','Yes','Yes','Yes','Yes',
     'Tasers and stun guns are legal for civilian ownership in New Mexico with no permit required.',
     'New Mexico law does not restrict civilian ownership of electronic control devices. No permit or registration is required.',
     'NMSA § 30-7-1 — Definitions',
     COMMON_ALLOWED,
     COMMON_RESTRICTIONS,
     'Texas:legal|Oklahoma:legal|Colorado:legal|Utah:legal|Arizona:legal'],

    ['New York','new-york','legal','No (licensed dealer purchase)','19','Yes','Yes','Yes','No',
     'Tasers are legal for civilian ownership in New York as of 2019 following a federal court ruling. Purchasers must be 19 or older and buy from a licensed dealer.',
     'In Avitabile v. Beach (2019), a federal district court struck down New York\'s prior ban on civilian stun gun possession as unconstitutional. Adults 19 and older may purchase from a licensed firearms dealer. Felons are prohibited. New York is a duty-to-retreat state — you must attempt to retreat before using force in public when safe to do so.',
     'Avitabile v. Beach (2019); NY Penal Law § 265.01',
     'Purchase from licensed dealer for adults 19+|In-home possession|Carrying in a personal vehicle|Use in lawful self-defense',
     'Must be 19 or older|Must purchase from a licensed firearms dealer|Duty to retreat in public|Schools and school grounds|Courts and government buildings|Correctional facilities|Felons prohibited',
     'New Jersey:legal|Connecticut:legal|Massachusetts:legal|Pennsylvania:legal|Vermont:legal'],

    ['North Carolina','north-carolina','legal','No','18','Yes','Yes','Yes','Yes',
     'Tasers and stun guns are legal for civilian ownership in North Carolina with no permit required.',
     'North Carolina law does not restrict civilian ownership of electronic control devices. No permit or registration is required.',
     'N.C.G.S. § 14-269 — Carrying concealed weapons',
     COMMON_ALLOWED,
     COMMON_RESTRICTIONS,
     'Virginia:legal|Tennessee:legal|South Carolina:legal|Georgia:legal'],

    ['North Dakota','north-dakota','legal','No','18','Yes','Yes','Yes','Yes',
     'Tasers and stun guns are legal for civilian ownership in North Dakota with no permit required.',
     'North Dakota law does not restrict civilian ownership of electronic control devices. No permit or registration is required.',
     'N.D.C.C. § 62.1-01-01 — Definitions',
     COMMON_ALLOWED,
     COMMON_RESTRICTIONS,
     'Montana:legal|South Dakota:legal|Minnesota:legal'],

    ['Ohio','ohio','legal','No','18','Yes','Yes','Yes','Yes',
     'Tasers and stun guns are legal for civilian ownership in Ohio with no permit required.',
     'Ohio law does not restrict civilian ownership of electronic control devices. No permit or registration is required. Ohio has stand-your-ground protections.',
     'O.R.C. § 2923.11 — Definitions',
     COMMON_ALLOWED,
     COMMON_RESTRICTIONS,
     'Indiana:legal|Kentucky:legal|West Virginia:legal|Pennsylvania:legal|Michigan:restricted'],

    ['Oklahoma','oklahoma','legal','No','18','Yes','Yes','Yes','Yes',
     'Tasers and stun guns are legal for civilian ownership in Oklahoma with no permit required.',
     'Oklahoma law does not restrict civilian ownership of electronic control devices. No permit or registration is required.',
     '21 O.S. § 1289.18',
     COMMON_ALLOWED,
     COMMON_RESTRICTIONS,
     'Texas:legal|New Mexico:legal|Colorado:legal|Kansas:legal|Missouri:legal|Arkansas:legal'],

    ['Oregon','oregon','legal','No','18','Yes','Yes','Yes','No',
     'Tasers and stun guns are legal for civilian ownership in Oregon with no permit required. Oregon does not have a stand-your-ground law.',
     'Oregon law does not restrict civilian ownership of electronic control devices. No permit is required. Oregon does not have a stand-your-ground law — a duty to retreat may apply in certain public situations.',
     'ORS § 166.210 — Definitions',
     COMMON_ALLOWED,
     COMMON_RESTRICTIONS + '|Oregon does not have stand-your-ground — duty to retreat may apply in public',
     'Washington:legal|California:legal|Nevada:legal|Idaho:legal'],

    ['Pennsylvania','pennsylvania','legal','No','18','Yes','Yes','Yes','No',
     'Tasers and stun guns are legal for civilian ownership in Pennsylvania with no permit required. Pennsylvania does not have a stand-your-ground law.',
     'Pennsylvania law does not restrict civilian ownership of electronic control devices. No permit is required. Pennsylvania does not have a stand-your-ground law, and a duty to retreat may apply in public confrontations.',
     '18 Pa.C.S. § 908 — Prohibited offensive weapons',
     COMMON_ALLOWED,
     COMMON_RESTRICTIONS + '|Pennsylvania does not have stand-your-ground — duty to retreat may apply in public',
     'New York:legal|New Jersey:legal|Delaware:legal|Maryland:restricted|West Virginia:legal|Ohio:legal'],

    ['Rhode Island','rhode-island','illegal','N/A','N/A','No','No','No','No',
     'Tasers and stun guns are prohibited for civilian ownership in Rhode Island. Possession without authorization may result in criminal charges.',
     'Rhode Island law prohibits civilian possession of electronic control weapons. Only law enforcement and authorized persons may possess tasers. Civilians found in possession of a taser may face misdemeanor or felony charges. Verify current laws with the Rhode Island Attorney General\'s office as legislation has been under review.',
     'R.I. Gen. Laws § 11-47-42 — Prohibited weapons',
     '',
     'Prohibited for civilian ownership statewide|Only law enforcement authorized|Possession may result in criminal charges',
     'Connecticut:legal|Massachusetts:legal'],

    ['South Carolina','south-carolina','legal','No','18','Yes','Yes','Yes','Yes',
     'Tasers and stun guns are legal for civilian ownership in South Carolina with no permit required.',
     'South Carolina law does not restrict civilian ownership of electronic control devices. No permit or registration is required.',
     'S.C. Code Ann. § 16-23-10 — Definitions',
     COMMON_ALLOWED,
     COMMON_RESTRICTIONS,
     'North Carolina:legal|Georgia:legal'],

    ['South Dakota','south-dakota','legal','No','18','Yes','Yes','Yes','Yes',
     'Tasers and stun guns are legal for civilian ownership in South Dakota with no permit required.',
     'South Dakota law does not restrict civilian ownership of electronic control devices. No permit or registration is required.',
     'SDCL § 22-14-1 — Definitions',
     COMMON_ALLOWED,
     COMMON_RESTRICTIONS,
     'North Dakota:legal|Minnesota:legal|Iowa:legal|Nebraska:legal|Wyoming:legal|Montana:legal'],

    ['Tennessee','tennessee','legal','No','18','Yes','Yes','Yes','Yes',
     'Tasers and stun guns are legal for civilian ownership in Tennessee with no permit required.',
     'Tennessee law does not restrict civilian ownership of electronic control devices. No permit or registration is required.',
     'T.C.A. § 39-17-1301 — Definitions',
     COMMON_ALLOWED,
     COMMON_RESTRICTIONS,
     'Kentucky:legal|Virginia:legal|North Carolina:legal|Georgia:legal|Alabama:legal|Mississippi:legal|Arkansas:legal|Missouri:legal'],

    ['Texas','texas','legal','No','18','Yes','Yes','Yes','Yes',
     'Tasers and stun guns are legal for civilian ownership in Texas with no permit required. There are no statewide restrictions on purchase or possession for law-abiding adults.',
     'Texas law does not classify tasers or stun guns as firearms, and there are no statewide statutes prohibiting civilian ownership or carry. Adults 18 and older may purchase, possess, and carry a taser without a license or permit under Texas law.\n\nThe relevant legal framework falls under Texas Penal Code Chapter 46 (Weapons), which explicitly excludes "electric stun guns" from the definition of prohibited weapons when used in lawful self-defense contexts.',
     'Texas Penal Code § 46.01 — Definition of Weapons; § 46.05 — Prohibited Weapons',
     'Purchase and ownership without a permit|Carrying openly or concealed in public|Carrying in a personal vehicle|Carrying in most private businesses unless posted|Use in lawful self-defense|Purchase by adults 18 and older',
     'Schools, school buses, and school-sponsored events (Texas Education Code § 37.125)|Polling places on election day|Courts and court offices|Correctional facilities|Locations with posted 30.06 or 30.07 signage|Felons prohibited from possessing any weapon|Minors under 18 may not purchase',
     'Oklahoma:legal|Arkansas:legal|Louisiana:legal|New Mexico:legal'],

    ['Utah','utah','legal','No','18','Yes','Yes','Yes','Yes',
     'Tasers and stun guns are legal for civilian ownership in Utah with no permit required.',
     'Utah law does not restrict civilian ownership of electronic control devices. No permit or registration is required.',
     'Utah Code § 76-10-501 — Definitions',
     COMMON_ALLOWED,
     COMMON_RESTRICTIONS,
     'Idaho:legal|Nevada:legal|Arizona:legal|Colorado:legal|Wyoming:legal'],

    ['Vermont','vermont','legal','No','18','Yes','Yes','Yes','No',
     'Tasers and stun guns are legal for civilian ownership in Vermont with no permit required. Vermont does not have a stand-your-ground law.',
     'Vermont law does not restrict civilian ownership of electronic control devices. No permit or registration is required. Vermont does not have a stand-your-ground law.',
     'Vermont Stat. Ann. tit. 13 § 4003 — Carrying dangerous weapons',
     COMMON_ALLOWED,
     COMMON_RESTRICTIONS + '|Vermont does not have stand-your-ground — duty to retreat may apply',
     'New Hampshire:legal|Massachusetts:legal|New York:legal'],

    ['Virginia','virginia','legal','No','18','Yes','Yes','Yes','Yes',
     'Tasers and stun guns are legal for civilian ownership in Virginia with no permit required.',
     'Virginia law does not restrict civilian ownership of electronic control devices. No permit or registration is required.',
     'Va. Code Ann. § 18.2-308.1 — Carrying weapon on school property',
     COMMON_ALLOWED,
     COMMON_RESTRICTIONS,
     'Maryland:restricted|West Virginia:legal|Kentucky:legal|Tennessee:legal|North Carolina:legal'],

    ['Washington','washington','legal','No','18','Yes','Yes','Yes','No',
     'Tasers and stun guns are legal for civilian ownership in Washington state with no permit required. Washington does not have a stand-your-ground law.',
     'Washington state law does not restrict civilian ownership of electronic control devices. No permit is required. Washington does not have a stand-your-ground law — a duty to retreat may apply in public confrontations.',
     'RCW § 9.41.010 — Terms defined',
     COMMON_ALLOWED,
     COMMON_RESTRICTIONS + '|Washington does not have stand-your-ground — duty to retreat may apply in public',
     'Oregon:legal|Idaho:legal'],

    ['Washington DC','washington-dc','illegal','N/A','N/A','No','No','No','No',
     'Tasers and stun guns are prohibited for civilian ownership in Washington D.C. Possession without authorization may result in criminal charges.',
     'Washington D.C. law prohibits civilian possession of electronic stun guns and tasers. Only law enforcement is authorized to carry tasers. Civilians found in possession face potential criminal charges. D.C. Code § 7-2502.15 classifies stun guns as prohibited weapons for unlicensed civilians.',
     'D.C. Code § 7-2501.01 — Definitions; § 7-2502.15 — Stun guns',
     '',
     'Prohibited for civilian ownership|Only law enforcement authorized|Possession by civilians is a criminal offense',
     'Maryland:restricted|Virginia:legal'],

    ['West Virginia','west-virginia','legal','No','18','Yes','Yes','Yes','Yes',
     'Tasers and stun guns are legal for civilian ownership in West Virginia with no permit required.',
     'West Virginia law does not restrict civilian ownership of electronic control devices. No permit or registration is required.',
     'W. Va. Code § 61-7-2 — Definitions',
     COMMON_ALLOWED,
     COMMON_RESTRICTIONS,
     'Virginia:legal|Kentucky:legal|Ohio:legal|Pennsylvania:legal|Maryland:restricted'],

    ['Wisconsin','wisconsin','legal','No','18','Yes','Yes','Yes','Yes',
     'Tasers and stun guns are legal for civilian ownership in Wisconsin with no permit required.',
     'Wisconsin law does not restrict civilian ownership of electronic control devices. No permit or registration is required.',
     'Wis. Stat. § 941.295 — Possession of electric weapons',
     COMMON_ALLOWED,
     COMMON_RESTRICTIONS,
     'Minnesota:legal|Michigan:restricted|Illinois:restricted|Iowa:legal'],

    ['Wyoming','wyoming','legal','No','18','Yes','Yes','Yes','Yes',
     'Tasers and stun guns are legal for civilian ownership in Wyoming with no permit required.',
     'Wyoming law does not restrict civilian ownership of electronic control devices. No permit or registration is required.',
     'Wyo. Stat. Ann. § 6-8-401 — Definitions',
     COMMON_ALLOWED,
     COMMON_RESTRICTIONS,
     'Montana:legal|South Dakota:legal|Nebraska:legal|Colorado:legal|Utah:legal|Idaho:legal']
  ];

  // Write headers
  sheet.appendRow(headers);

  // Style header row
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setFontWeight('bold');
  headerRange.setBackground('#0d1520');
  headerRange.setFontColor('#0ea5e9');

  // Write data rows
  states.forEach(function(row) { sheet.appendRow(row); });

  // Auto-resize columns
  for (var i = 1; i <= headers.length; i++) {
    sheet.autoResizeColumn(i);
  }

  // Freeze header row
  sheet.setFrozenRows(1);

  SpreadsheetApp.getUi().alert('Done! ' + states.length + ' states loaded into the "' + CONFIG.SHEET_NAME + '" sheet.\n\nNext:\n1. Add GITHUB_TOKEN to Script Properties\n2. Run generateAllStatePages()');
}

// ============================================================
// UTILITIES
// ============================================================

function slugify(name) {
  return name.toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '')
    .replace(/--+/g, '-');
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
