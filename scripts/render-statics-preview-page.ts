import type { ExportPreviewLatest } from '../src/server/creative-exporter';

const escapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[char] || char));

const escapeAttr = escapeHtml;

const parseSize = (size: string) => {
  const match = String(size || '').match(/^(\d+)x(\d+)$/i);
  if (!match) return { width: 300, height: 250 };
  return { width: Number(match[1]), height: Number(match[2]) };
};

export const renderStaticsPreviewPage = (latest: ExportPreviewLatest) => {
  if (!latest?.campaigns?.length) {
    throw new Error('Statics preview requires outputs/latest.json with at least one campaign');
  }
  if (!latest.zip) {
    throw new Error('Statics preview requires a zip path in outputs/latest.json');
  }

  const campaignsJson = JSON.stringify(latest.campaigns);
  const first = latest.campaigns[0];
  const firstSize = first.sizes[0] || '300x250';
  const { width: initialWidth, height: initialHeight } = parseSize(firstSize);
  const campaignOptions = latest.campaigns.map((campaign) => (
    `<option value="${escapeAttr(campaign.id)}">${escapeHtml(campaign.name)}</option>`
  )).join('');
  const sizeOptions = first.sizes.map((size) => (
    `<option value="${escapeAttr(size)}">${escapeHtml(size)}</option>`
  )).join('');
  const zipHref = escapeAttr(latest.zip);
  const zipLabel = escapeHtml(String(latest.zip).split('/').pop() || latest.zip);
  // Stable Ireland-local stamp (CI boxes are UTC; avoid ambiguous en-US locale).
  const generatedLabel = latest.generatedAt
    ? escapeHtml(new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Dublin',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZoneName: 'short',
    }).format(new Date(latest.generatedAt)))
    : '—';
  const generatedIso = latest.generatedAt ? escapeAttr(latest.generatedAt) : '';
  // Query-bust so GH Pages / browser caches cannot keep serving a prior package
  // under the same HTML paths after a new Export for Preview.
  const cacheBust = latest.generatedAt
    ? escapeAttr(encodeURIComponent(latest.generatedAt))
    : String(Date.now());
  const zipHrefBusted = `${zipHref}?v=${cacheBust}`;

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <title>SSE statics preview</title>
    <link rel="stylesheet" href="https://use.typekit.net/grv2rfu.css">
    <style>
      :root {
        color-scheme: dark;
        --bg: #0b0f13;
        --panel: #141b23;
        --line: #2b3846;
        --ink: #edf7f7;
        --muted: #99a8b5;
        --teal: #16c7b7;
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        height: 100vh;
        min-height: 100vh;
        overflow: hidden;
        background: var(--bg);
        color: var(--ink);
        font-family: "museo-sans", sans-serif;
        font-weight: 300;
      }
      header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 24px;
        padding: 18px 24px;
        border-bottom: 1px solid var(--line);
        background: #10161d;
      }
      .header-end {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        gap: 6px;
        min-width: 0;
      }
      .header-title {
        margin: 0;
        color: var(--ink);
        font-size: 24px;
        font-weight: 500;
        line-height: 1;
        white-space: nowrap;
      }
      .header-stamp {
        margin: 0;
        color: var(--teal);
        font-size: 12px;
        font-weight: 500;
        letter-spacing: 0.02em;
        line-height: 1.2;
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
      }
      .header-stamp time {
        color: var(--ink);
        font-weight: 300;
      }
      .header-stamp [data-export-ago],
      .kicker [data-export-ago],
      .meta [data-export-ago] {
        color: var(--muted);
        font-weight: 300;
      }
      .brand-lockup {
        display: flex;
        align-items: center;
        gap: 14px;
        min-width: 0;
      }
      .brand-logo {
        display: block;
        width: auto;
        flex: 0 0 auto;
      }
      .brand-logo-bg { height: 22px; }
      .brand-logo-sse { height: 26px; }
      .brand-divider {
        color: var(--muted);
        font-size: 20px;
        font-weight: 300;
        line-height: 1;
      }
      .layout {
        display: grid;
        grid-template-columns: minmax(280px, 340px) minmax(0, 1fr);
        height: calc(100vh - 76px);
        min-height: 0;
      }
      .controls {
        border-right: 1px solid var(--line);
        background: var(--panel);
        padding: 14px 16px;
        overflow-y: auto;
        min-height: 0;
      }
      .preview {
        display: flex;
        flex-direction: column;
        padding: 22px;
        overflow: hidden;
        min-height: 0;
      }
      h2 {
        margin: 16px 0 8px;
        color: var(--teal);
        font-size: 11px;
        font-weight: 500;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      h2:first-child { margin-top: 0; }
      label {
        display: grid;
        grid-template-columns: 82px minmax(0, 1fr);
        align-items: center;
        gap: 8px;
        margin-bottom: 7px;
        color: var(--muted);
        font-size: 11px;
        font-weight: 300;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      select {
        width: 100%;
        border: 1px solid var(--line);
        border-radius: 6px;
        background: #101821;
        color: var(--ink);
        font: inherit;
        font-size: 14px;
        font-weight: 300;
        min-height: 34px;
        padding: 7px 9px;
        outline: none;
      }
      select:focus {
        border-color: var(--teal);
        box-shadow: 0 0 0 2px rgba(22, 199, 183, 0.18);
      }
      .meta {
        margin: 12px 0 0;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.45;
      }
      .preview-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 16px;
      }
      .kicker {
        display: block;
        margin-bottom: 6px;
        color: var(--teal);
        font-size: 11px;
        font-weight: 500;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }
      .preview-head h1 {
        margin: 0;
        font-size: 24px;
        font-weight: 500;
        line-height: 1;
      }
      .preview-head p {
        margin: 6px 0 0;
        max-width: 620px;
        color: var(--muted);
      }
      .preview-actions {
        display: flex;
        align-items: center;
        gap: 10px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }
      .preview-actions > a,
      .preview-actions > button {
        appearance: none;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: #101821;
        color: var(--ink);
        font: inherit;
        font-size: 13px;
        font-weight: 500;
        padding: 8px 12px;
        text-decoration: none;
        cursor: pointer;
      }
      .preview-actions > a.primary {
        border-color: transparent;
        background: var(--teal);
        color: rgb(0, 41, 117);
      }
      .zoom-controls {
        display: flex;
        align-items: center;
        gap: 3px;
        flex: 0 0 auto;
      }
      .zoom-controls button {
        display: grid;
        min-width: 24px;
        height: 24px;
        place-items: center;
        padding: 0 7px;
        border: 1px solid var(--line);
        border-radius: 5px;
        background: #101821;
        color: var(--ink);
        cursor: pointer;
        font-family: inherit;
        font-size: 10px;
        font-weight: 500;
        white-space: nowrap;
      }
      .zoom-controls button:hover,
      .zoom-controls button[aria-pressed="true"] {
        border-color: var(--teal);
        background: rgba(22, 199, 183, 0.12);
        color: var(--teal);
      }
      .zoom-readout {
        min-width: 40px;
        color: var(--muted);
        font-size: 10px;
        font-weight: 500;
        text-align: right;
      }
      .stage-wrap {
        flex: 1;
        min-height: 0;
        overflow: auto;
        display: grid;
        place-items: center;
        background:
          linear-gradient(45deg, #1a222b 25%, transparent 25%),
          linear-gradient(-45deg, #1a222b 25%, transparent 25%),
          linear-gradient(45deg, transparent 75%, #1a222b 75%),
          linear-gradient(-45deg, transparent 75%, #1a222b 75%);
        background-size: 24px 24px;
        background-position: 0 0, 0 12px, 12px -12px, -12px 0;
        background-color: #121820;
        border: 1px solid var(--line);
        border-radius: 12px;
        padding: 24px;
      }
      .frame-shell {
        flex: 0 0 auto;
        overflow: hidden;
        background: #fff;
        box-shadow: 0 18px 40px rgba(0, 0, 0, 0.35);
        isolation: isolate;
      }
      iframe {
        display: block;
        border: 0;
        background: #fff;
        transform-origin: top left;
      }
      .nav-link {
        display: inline-block;
        margin-top: 14px;
        color: var(--teal);
        font-size: 12px;
        text-decoration: none;
      }
      .nav-link:hover { text-decoration: underline; }
      .stale-banner {
        display: none;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 14px;
        border-bottom: 1px solid rgba(22, 199, 183, 0.35);
        background: rgba(22, 199, 183, 0.12);
        color: var(--ink);
        font-size: 13px;
        line-height: 1.35;
      }
      .stale-banner.is-visible { display: flex; }
      .stale-banner button {
        appearance: none;
        flex: 0 0 auto;
        border: 1px solid var(--teal);
        border-radius: 8px;
        background: var(--teal);
        color: rgb(0, 41, 117);
        font: inherit;
        font-size: 12px;
        font-weight: 600;
        padding: 6px 10px;
        cursor: pointer;
        white-space: nowrap;
      }
      @media (max-width: 900px) {
        body { overflow: auto; height: auto; }
        .layout {
          grid-template-columns: 1fr;
          height: auto;
        }
        .controls { border-right: 0; border-bottom: 1px solid var(--line); }
        .stage-wrap { min-height: 420px; }
        .stale-banner { flex-wrap: wrap; }
      }
    </style>
  </head>
  <body>
    <div id="stale-banner" class="stale-banner" role="status" aria-live="polite" hidden>
      <span>A newer export is on the server — this tab may still be showing an older package.</span>
      <button type="button" data-reload-latest>Load latest</button>
    </div>
    <header>
      <div class="brand-lockup" aria-label="Boys and Girls and SSE">
        <img class="brand-logo brand-logo-bg" src="../brand/BGlogo_SVG.svg" alt="Boys and Girls">
        <span class="brand-divider" aria-hidden="true">|</span>
        <img class="brand-logo brand-logo-sse" src="../brand/SSELogoWhite.svg" alt="SSE">
      </div>
      <div class="header-end">
        <p class="header-title">Statics Preview</p>
        <p class="header-stamp" title="From outputs/latest.json (Export for Preview)">
          Exported
          <time datetime="${generatedIso}">${generatedLabel}</time>
          <span data-export-ago></span>
        </p>
      </div>
    </header>
    <main class="layout">
      <form class="controls" id="controls">
        <h2>Campaign</h2>
        <label>
          <span>Name</span>
          <select id="campaign" name="campaign">${campaignOptions}</select>
        </label>
        <h2>Size</h2>
        <label>
          <span>Ad size</span>
          <select id="size" name="size">${sizeOptions}</select>
        </label>
        <p class="meta">Fixed-copy SVG outline HTML from <strong>Export for Preview</strong>.</p>
        <p class="meta">Package: ${zipLabel}<br>Exported: ${generatedLabel} <span data-export-ago></span></p>
        <a class="nav-link" href="../">DCO preview</a>
      </form>
      <section class="preview">
        <div class="preview-head">
          <div>
            <span class="kicker">Client review · exported ${generatedLabel} <span data-export-ago></span></span>
            <h1 id="preview-title">${escapeHtml(first.name)}</h1>
            <p id="preview-subtitle">${escapeHtml(firstSize)} · outlined static HTML</p>
          </div>
          <div class="preview-actions">
            <div class="zoom-controls" aria-label="Preview zoom">
              <button type="button" class="zoom-button" data-zoom-step="-1" aria-label="Zoom out">−</button>
              <button type="button" class="zoom-button" data-zoom-mode="fit" aria-label="Fit to viewport" aria-pressed="true">Fit</button>
              <button type="button" class="zoom-button" data-zoom-mode="1" aria-label="100% zoom">1x</button>
              <button type="button" class="zoom-button" data-zoom-mode="2" aria-label="200% zoom">2x</button>
              <button type="button" class="zoom-button" data-zoom-step="1" aria-label="Zoom in">+</button>
              <span class="zoom-readout" data-zoom-readout>Fit</span>
            </div>
            <button type="button" id="replay">Replay</button>
            <button type="button" id="reload-latest" title="Fetch the newest export and bypass the browser cache">Reload latest</button>
            <a class="primary" id="download" href="${zipHrefBusted}" download>Download ZIP</a>
          </div>
        </div>
        <div class="stage-wrap">
          <div class="frame-shell" id="frame-shell">
            <iframe id="ad-frame" title="Static creative preview" src=""></iframe>
          </div>
        </div>
      </section>
    </main>
    <script>
      (function() {
        var STORAGE_KEY = 'sse-statics-preview:v1';
        var ZOOM_LEVELS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 7.5];
        var campaigns = ${campaignsJson};
        var packageGeneratedAt = ${JSON.stringify(latest.generatedAt || '')};
        var cacheBust = ${JSON.stringify(latest.generatedAt ? encodeURIComponent(latest.generatedAt) : String(Date.now()))};
        var campaignSelect = document.getElementById('campaign');
        var sizeSelect = document.getElementById('size');
        var frame = document.getElementById('ad-frame');
        var shell = document.getElementById('frame-shell');
        var stage = document.querySelector('.stage-wrap');
        var title = document.getElementById('preview-title');
        var subtitle = document.getElementById('preview-subtitle');
        var replay = document.getElementById('replay');
        var staleBanner = document.getElementById('stale-banner');
        var previewZoom = 'fit';
        var frameWidth = ${initialWidth};
        var frameHeight = ${initialHeight};

        function findCampaign(id) {
          for (var i = 0; i < campaigns.length; i += 1) {
            if (campaigns[i].id === id) return campaigns[i];
          }
          return campaigns[0];
        }

        function parseSize(size) {
          var match = String(size || '').match(/^(\\d+)x(\\d+)$/i);
          if (!match) return { width: 300, height: 250 };
          return { width: Number(match[1]), height: Number(match[2]) };
        }

        function adSrc(campaign, size) {
          return 'campaigns/' + campaign.id + '/' + campaign.exportSlug + '_' + size
            + '.html?v=' + cacheBust;
        }

        function fillSizes(campaign, preferred) {
          sizeSelect.innerHTML = '';
          for (var i = 0; i < campaign.sizes.length; i += 1) {
            var option = document.createElement('option');
            option.value = campaign.sizes[i];
            option.textContent = campaign.sizes[i];
            sizeSelect.appendChild(option);
          }
          sizeSelect.value = campaign.sizes.indexOf(preferred) >= 0
            ? preferred
            : (campaign.sizes[0] || '');
        }

        function zoomLabel(zoom) {
          if (zoom === 'fit') return 'Fit';
          if (Number(zoom) === 1) return '1x';
          if (Number(zoom) === 2) return '2x';
          return Math.round(Number(zoom) * 100) + '%';
        }

        function updateZoomButtons() {
          Array.prototype.forEach.call(document.querySelectorAll('[data-zoom-mode]'), function(button) {
            var mode = button.getAttribute('data-zoom-mode');
            var pressed = mode === 'fit'
              ? previewZoom === 'fit'
              : Number(mode) === Number(previewZoom);
            button.setAttribute('aria-pressed', pressed ? 'true' : 'false');
          });
          var readout = document.querySelector('[data-zoom-readout]');
          if (readout) readout.textContent = zoomLabel(previewZoom);
        }

        function previewScale() {
          if (previewZoom === 'fit') {
            var availableWidth = Math.max(1, stage.clientWidth - 48);
            var availableHeight = Math.max(1, stage.clientHeight - 48);
            return Math.min(1, availableWidth / frameWidth, availableHeight / frameHeight);
          }
          return Number(previewZoom);
        }

        function fitAdFrame() {
          var scale = previewScale();
          shell.style.width = Math.ceil(frameWidth * scale) + 'px';
          shell.style.height = Math.ceil(frameHeight * scale) + 'px';
          frame.style.width = frameWidth + 'px';
          frame.style.height = frameHeight + 'px';
          frame.style.transform = 'scale(' + scale + ')';
        }

        function setPreviewZoom(next) {
          previewZoom = next;
          updateZoomButtons();
          fitAdFrame();
          persist();
        }

        function nextZoomLevel(current, direction) {
          var index = ZOOM_LEVELS.findIndex(function(level) { return level >= current; });
          if (index < 0) index = ZOOM_LEVELS.length - 1;
          if (direction > 0) {
            return ZOOM_LEVELS[Math.min(ZOOM_LEVELS.length - 1, current >= ZOOM_LEVELS[index] ? index + 1 : index)];
          }
          return ZOOM_LEVELS[Math.max(0, current <= ZOOM_LEVELS[index] ? index - 1 : index)];
        }

        function persist() {
          try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
              campaignId: campaignSelect.value,
              size: sizeSelect.value,
              zoom: previewZoom,
            }));
          } catch (error) {}
        }

        function loadActiveAd() {
          var campaign = findCampaign(campaignSelect.value);
          var size = sizeSelect.value || campaign.sizes[0];
          var dims = parseSize(size);
          frameWidth = dims.width;
          frameHeight = dims.height;
          title.textContent = campaign.name;
          subtitle.textContent = size + ' · outlined static HTML';
          frame.src = adSrc(campaign, size);
          fitAdFrame();
          persist();
        }

        function hydrate() {
          var saved = null;
          try {
            saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
          } catch (error) {
            saved = null;
          }
          var campaign = findCampaign(saved && saved.campaignId);
          campaignSelect.value = campaign.id;
          fillSizes(campaign, saved && saved.size);
          if (saved && (saved.zoom === 'fit' || ZOOM_LEVELS.indexOf(Number(saved.zoom)) !== -1)) {
            previewZoom = saved.zoom === 'fit' ? 'fit' : Number(saved.zoom);
          }
          updateZoomButtons();
          loadActiveAd();
        }

        function showStaleBanner(visible) {
          if (!staleBanner) return;
          if (visible) {
            staleBanner.hidden = false;
            staleBanner.classList.add('is-visible');
          } else {
            staleBanner.hidden = true;
            staleBanner.classList.remove('is-visible');
          }
        }

        /** Bypass browser cache: pull latest.json, then reload the shell with a new ?v=. */
        function reloadLatest() {
          fetch('latest.json', { cache: 'no-store' })
            .then(function(response) {
              if (!response.ok) throw new Error('latest.json ' + response.status);
              return response.json();
            })
            .then(function(data) {
              var next = (data && data.generatedAt) || String(Date.now());
              var url = new URL(window.location.href);
              url.searchParams.set('v', next);
              window.location.replace(url.toString());
            })
            .catch(function() {
              var url = new URL(window.location.href);
              url.searchParams.set('v', String(Date.now()));
              window.location.replace(url.toString());
            });
        }

        function checkForNewerPackage() {
          fetch('latest.json', { cache: 'no-store' })
            .then(function(response) {
              if (!response.ok) throw new Error('latest.json ' + response.status);
              return response.json();
            })
            .then(function(data) {
              var remote = data && data.generatedAt;
              if (remote && packageGeneratedAt && remote !== packageGeneratedAt) {
                showStaleBanner(true);
              }
            })
            .catch(function() {});
        }

        campaignSelect.addEventListener('change', function() {
          var campaign = findCampaign(campaignSelect.value);
          fillSizes(campaign, sizeSelect.value);
          loadActiveAd();
        });
        sizeSelect.addEventListener('change', loadActiveAd);
        replay.addEventListener('click', function() {
          frame.src = adSrc(findCampaign(campaignSelect.value), sizeSelect.value);
        });
        Array.prototype.forEach.call(document.querySelectorAll('[data-reload-latest], #reload-latest'), function(button) {
          button.addEventListener('click', reloadLatest);
        });
        Array.prototype.forEach.call(document.querySelectorAll('[data-zoom-mode]'), function(button) {
          button.addEventListener('click', function() {
            var mode = button.getAttribute('data-zoom-mode');
            setPreviewZoom(mode === 'fit' ? 'fit' : Number(mode));
          });
        });
        Array.prototype.forEach.call(document.querySelectorAll('[data-zoom-step]'), function(button) {
          button.addEventListener('click', function() {
            var direction = Number(button.getAttribute('data-zoom-step'));
            var current = previewZoom === 'fit' ? 1 : Number(previewZoom);
            setPreviewZoom(nextZoomLevel(current, direction));
          });
        });
        window.addEventListener('resize', fitAdFrame);
        window.addEventListener('focus', checkForNewerPackage);

        function formatExportAgo(iso) {
          if (!iso) return '';
          var then = new Date(iso).getTime();
          if (!isFinite(then)) return '';
          var seconds = Math.round((Date.now() - then) / 1000);
          var future = seconds < 0;
          var abs = Math.abs(seconds);
          var label;
          if (abs < 45) label = 'just now';
          else if (abs < 90) label = '1 min ago';
          else if (abs < 3600) label = Math.round(abs / 60) + ' mins ago';
          else if (abs < 5400) label = '1 hr ago';
          else if (abs < 86400) label = Math.round(abs / 3600) + ' hrs ago';
          else if (abs < 172800) label = '1 day ago';
          else label = Math.round(abs / 86400) + ' days ago';
          if (future && label !== 'just now') label = 'in ' + label.replace(' ago', '');
          return label === 'just now' ? '· just now' : '· ' + label;
        }

        function refreshExportAgo() {
          var stamp = document.querySelector('time[datetime]');
          var iso = stamp && stamp.getAttribute('datetime');
          var text = formatExportAgo(iso);
          Array.prototype.forEach.call(document.querySelectorAll('[data-export-ago]'), function(node) {
            node.textContent = text;
          });
        }

        refreshExportAgo();
        window.setInterval(refreshExportAgo, 30000);
        checkForNewerPackage();
        window.setInterval(checkForNewerPackage, 60000);
        hydrate();
      })();
    </script>
  </body>
</html>
`;
};
