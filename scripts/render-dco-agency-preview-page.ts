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

/**
 * Pages root display for the tracked SSE DCO Canonical Agency Zip under
 * `outputs/campaigns/sse-dco/` (same tree as Export Canonical Agency Zip).
 */
export const renderDcoAgencyPreviewPage = (latest: ExportPreviewLatest) => {
  const dco = latest?.dco;
  if (!dco?.sizes?.length) {
    throw new Error('DCO preview requires outputs/latest.json with a dco package');
  }
  if (!latest.dcoZip) {
    throw new Error('DCO preview requires a dcoZip path in outputs/latest.json');
  }

  const firstSize = dco.sizes.includes('300x250') ? '300x250' : (dco.sizes[0] || '300x250');
  const { width: initialWidth, height: initialHeight } = parseSize(firstSize);
  const sizeOptions = dco.sizes.map((size) => (
    `<option value="${escapeAttr(size)}">${escapeHtml(size)}</option>`
  )).join('');
  const zipHref = escapeAttr(latest.dcoZip);
  const zipLabel = escapeHtml(String(latest.dcoZip).split('/').pop() || latest.dcoZip);
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
  const cacheBust = latest.generatedAt
    ? escapeAttr(encodeURIComponent(latest.generatedAt))
    : String(Date.now());
  const zipHrefBusted = `${zipHref}?v=${cacheBust}`;
  const sizesJson = JSON.stringify(dco.sizes);

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <title>SSE DCO preview</title>
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
      .brand-lockup {
        display: flex;
        align-items: center;
        gap: 14px;
      }
      .brand-logo { display: block; height: 28px; width: auto; }
      .brand-divider { color: var(--line); }
      .header-end { text-align: right; }
      .header-title {
        margin: 0;
        font-size: 24px;
        font-weight: 500;
        line-height: 1;
      }
      .header-stamp {
        margin: 8px 0 0;
        color: var(--muted);
        font-size: 12px;
      }
      .layout {
        display: grid;
        grid-template-columns: minmax(220px, 280px) 1fr;
        height: calc(100vh - 73px);
      }
      .controls {
        padding: 20px;
        border-right: 1px solid var(--line);
        background: var(--panel);
        overflow: auto;
      }
      .controls h2 {
        margin: 18px 0 10px;
        font-size: 11px;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: var(--muted);
        font-weight: 500;
      }
      .controls h2:first-child { margin-top: 0; }
      label { display: grid; gap: 6px; margin-bottom: 12px; }
      label span { color: var(--muted); font-size: 12px; }
      select {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid var(--line);
        border-radius: 10px;
        background: #0f151c;
        color: var(--ink);
        font: inherit;
      }
      .meta {
        margin: 14px 0 0;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.45;
      }
      .nav-link {
        display: inline-block;
        margin-top: 16px;
        color: var(--teal);
        text-decoration: none;
      }
      .preview {
        display: grid;
        grid-template-rows: auto 1fr;
        min-width: 0;
      }
      .preview-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        padding: 18px 22px;
        border-bottom: 1px solid var(--line);
      }
      .kicker {
        display: block;
        margin-bottom: 6px;
        color: var(--muted);
        font-size: 12px;
      }
      .preview-head h1 {
        margin: 0;
        font-size: 22px;
        font-weight: 500;
      }
      .preview-head p {
        margin: 6px 0 0;
        color: var(--muted);
        font-size: 13px;
      }
      .preview-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        justify-content: flex-end;
      }
      .zoom-controls {
        display: flex;
        align-items: center;
        gap: 4px;
        margin-right: 4px;
      }
      button, .primary {
        appearance: none;
        border: 1px solid var(--line);
        border-radius: 10px;
        background: #182129;
        color: var(--ink);
        padding: 8px 12px;
        font: inherit;
        font-size: 13px;
        cursor: pointer;
        text-decoration: none;
      }
      .primary {
        background: var(--teal);
        border-color: transparent;
        color: #062a27;
        font-weight: 500;
      }
      .zoom-button[aria-pressed="true"] {
        border-color: var(--teal);
        color: var(--teal);
      }
      .zoom-readout {
        min-width: 40px;
        text-align: center;
        color: var(--muted);
        font-size: 12px;
      }
      .stage-wrap {
        display: grid;
        place-items: center;
        overflow: auto;
        padding: 24px;
        background:
          radial-gradient(circle at top, rgba(22, 199, 183, 0.08), transparent 40%),
          #0b0f13;
      }
      .frame-shell {
        position: relative;
        box-shadow: 0 18px 50px rgba(0, 0, 0, 0.35);
        background: #fff;
      }
      iframe {
        display: block;
        border: 0;
        background: #fff;
      }
      .stale-banner {
        display: none;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 18px;
        background: #3a2410;
        border-bottom: 1px solid #6a3f14;
        color: #ffe2b8;
        font-size: 13px;
      }
      .stale-banner.is-visible { display: flex; }
      @media (max-width: 900px) {
        .layout { grid-template-columns: 1fr; height: auto; }
        body { height: auto; overflow: auto; }
        .controls { border-right: 0; border-bottom: 1px solid var(--line); }
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
        <img class="brand-logo" src="brand/BGlogo_SVG.svg" alt="Boys and Girls">
        <span class="brand-divider" aria-hidden="true">|</span>
        <img class="brand-logo" src="brand/SSELogoWhite.svg" alt="SSE">
      </div>
      <div class="header-end">
        <p class="header-title">DCO Preview</p>
        <p class="header-stamp" title="From outputs/latest.json (Export for Preview)">
          Exported
          <time datetime="${generatedIso}">${generatedLabel}</time>
          <span data-export-ago></span>
        </p>
      </div>
    </header>
    <main class="layout">
      <form class="controls" id="controls">
        <h2>Package</h2>
        <p class="meta"><strong>${escapeHtml(dco.name)}</strong><br>Canonical Agency Zip<br><code>ads/{size}/index.html</code></p>
        <h2>Size</h2>
        <label>
          <span>Ad size</span>
          <select id="size" name="size">${sizeOptions}</select>
        </label>
        <p class="meta">Same tree as editor <strong>Export Canonical Agency Zip</strong>, baked via <strong>Export for Preview</strong>.</p>
        <p class="meta">Package: ${zipLabel}<br>Exported: ${generatedLabel} <span data-export-ago></span></p>
        <a class="nav-link" href="statics/">Statics preview</a>
      </form>
      <section class="preview">
        <div class="preview-head">
          <div>
            <span class="kicker">Client review · exported ${generatedLabel} <span data-export-ago></span></span>
            <h1 id="preview-title">${escapeHtml(dco.name)}</h1>
            <p id="preview-subtitle">${escapeHtml(firstSize)} · canonical agency HTML</p>
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
            <iframe id="ad-frame" title="DCO creative preview" src=""></iframe>
          </div>
        </div>
      </section>
    </main>
    <script>
      (function() {
        var STORAGE_KEY = 'sse-dco-agency-preview:v1';
        var ZOOM_LEVELS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4, 5, 6, 7, 7.5];
        var sizes = ${sizesJson};
        var packageGeneratedAt = ${JSON.stringify(latest.generatedAt || '')};
        var cacheBust = ${JSON.stringify(latest.generatedAt ? encodeURIComponent(latest.generatedAt) : String(Date.now()))};
        var sizeSelect = document.getElementById('size');
        var frame = document.getElementById('ad-frame');
        var shell = document.getElementById('frame-shell');
        var stage = document.querySelector('.stage-wrap');
        var subtitle = document.getElementById('preview-subtitle');
        var replay = document.getElementById('replay');
        var staleBanner = document.getElementById('stale-banner');
        var previewZoom = 'fit';
        var frameWidth = ${initialWidth};
        var frameHeight = ${initialHeight};

        function parseSize(size) {
          var match = String(size || '').match(/^(\\d+)x(\\d+)$/i);
          if (!match) return { width: 300, height: 250 };
          return { width: Number(match[1]), height: Number(match[2]) };
        }

        function adSrc(size) {
          return 'ads/' + size + '/index.html?v=' + cacheBust;
        }

        function zoomLabel(zoom) {
          if (zoom === 'fit') return 'Fit';
          return Math.round(Number(zoom) * 100) + '%';
        }

        function nextZoomLevel(current, direction) {
          var value = Number(current);
          if (!(value > 0)) value = 1;
          if (direction < 0) {
            for (var i = ZOOM_LEVELS.length - 1; i >= 0; i -= 1) {
              if (ZOOM_LEVELS[i] < value - 0.001) return ZOOM_LEVELS[i];
            }
            return ZOOM_LEVELS[0];
          }
          for (var j = 0; j < ZOOM_LEVELS.length; j += 1) {
            if (ZOOM_LEVELS[j] > value + 0.001) return ZOOM_LEVELS[j];
          }
          return ZOOM_LEVELS[ZOOM_LEVELS.length - 1];
        }

        function updateZoomButtons() {
          document.querySelectorAll('[data-zoom-mode]').forEach(function(button) {
            var mode = button.getAttribute('data-zoom-mode');
            button.setAttribute('aria-pressed', String(mode === String(previewZoom)));
          });
          var readout = document.querySelector('[data-zoom-readout]');
          if (readout) readout.textContent = zoomLabel(previewZoom);
        }

        function fitAdFrames() {
          if (!shell || !stage || !frame) return;
          shell.style.width = frameWidth + 'px';
          shell.style.height = frameHeight + 'px';
          frame.width = frameWidth;
          frame.height = frameHeight;
          if (previewZoom === 'fit') {
            var pad = 48;
            var availW = Math.max(120, stage.clientWidth - pad);
            var availH = Math.max(120, stage.clientHeight - pad);
            var scale = Math.min(1, availW / frameWidth, availH / frameHeight);
            shell.style.transform = 'scale(' + scale + ')';
            shell.style.transformOrigin = 'center center';
          } else {
            shell.style.transform = 'scale(' + Number(previewZoom) + ')';
            shell.style.transformOrigin = 'top left';
          }
          updateZoomButtons();
        }

        function setPreviewZoom(zoom) {
          previewZoom = zoom;
          try {
            var raw = window.localStorage.getItem(STORAGE_KEY);
            var parsed = raw ? JSON.parse(raw) : {};
            parsed.zoom = zoom;
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
          } catch (error) {}
          fitAdFrames();
        }

        function loadSize(size, forceReplay) {
          var next = sizes.indexOf(size) >= 0 ? size : (sizes[0] || '300x250');
          sizeSelect.value = next;
          var dims = parseSize(next);
          frameWidth = dims.width;
          frameHeight = dims.height;
          subtitle.textContent = next + ' · canonical agency HTML';
          var src = adSrc(next) + (forceReplay ? '&replay=' + Date.now() : '');
          frame.setAttribute('src', src);
          try {
            var raw = window.localStorage.getItem(STORAGE_KEY);
            var parsed = raw ? JSON.parse(raw) : {};
            parsed.size = next;
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
          } catch (error) {}
          fitAdFrames();
        }

        function formatAgo(iso) {
          if (!iso) return '';
          var then = new Date(iso).getTime();
          if (!isFinite(then)) return '';
          var mins = Math.max(0, Math.round((Date.now() - then) / 60000));
          if (mins < 1) return '· just now';
          if (mins < 60) return '· ' + mins + ' min' + (mins === 1 ? '' : 's') + ' ago';
          var hours = Math.round(mins / 60);
          if (hours < 48) return '· ' + hours + ' hr' + (hours === 1 ? '' : 's') + ' ago';
          var days = Math.round(hours / 24);
          return '· ' + days + ' day' + (days === 1 ? '' : 's') + ' ago';
        }

        function refreshAgo() {
          var label = formatAgo(packageGeneratedAt);
          document.querySelectorAll('[data-export-ago]').forEach(function(node) {
            node.textContent = label;
          });
        }

        function checkStale() {
          if (!packageGeneratedAt || !staleBanner) return;
          fetch('latest.json?v=' + Date.now(), { cache: 'no-store' })
            .then(function(response) { return response.ok ? response.json() : null; })
            .then(function(payload) {
              if (!payload || !payload.generatedAt) return;
              if (payload.generatedAt !== packageGeneratedAt) {
                staleBanner.hidden = false;
                staleBanner.classList.add('is-visible');
              }
            })
            .catch(function() {});
        }

        sizeSelect.addEventListener('change', function() {
          loadSize(sizeSelect.value, false);
        });
        replay.addEventListener('click', function() {
          loadSize(sizeSelect.value, true);
        });
        document.getElementById('reload-latest').addEventListener('click', function() {
          window.location.reload();
        });
        document.querySelectorAll('[data-reload-latest]').forEach(function(button) {
          button.addEventListener('click', function() { window.location.reload(); });
        });
        document.querySelectorAll('[data-zoom-mode]').forEach(function(button) {
          button.addEventListener('click', function() {
            var mode = button.getAttribute('data-zoom-mode');
            setPreviewZoom(mode === 'fit' ? 'fit' : Number(mode));
          });
        });
        document.querySelectorAll('[data-zoom-step]').forEach(function(button) {
          button.addEventListener('click', function() {
            var direction = Number(button.getAttribute('data-zoom-step'));
            var current = previewZoom === 'fit' ? 1 : Number(previewZoom);
            setPreviewZoom(nextZoomLevel(current, direction));
          });
        });
        window.addEventListener('resize', fitAdFrames);

        var preferred = ${JSON.stringify(firstSize)};
        try {
          var stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
          if (stored && sizes.indexOf(stored.size) >= 0) preferred = stored.size;
          if (stored && (stored.zoom === 'fit' || Number(stored.zoom) > 0)) previewZoom = stored.zoom;
        } catch (error) {}
        loadSize(preferred, false);
        refreshAgo();
        checkStale();
        window.setInterval(refreshAgo, 30000);
      })();
    </script>
  </body>
</html>
`;
};
