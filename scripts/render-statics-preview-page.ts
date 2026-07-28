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
  const generatedLabel = latest.generatedAt
    ? escapeHtml(new Date(latest.generatedAt).toLocaleString())
    : '—';

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
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
      .header-title {
        margin: 0;
        color: var(--ink);
        font-size: 24px;
        font-weight: 500;
        line-height: 1;
        white-space: nowrap;
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
      .preview-actions a,
      .preview-actions button {
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
      .preview-actions a.primary {
        border-color: transparent;
        background: var(--teal);
        color: rgb(0, 41, 117);
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
        width: ${initialWidth}px;
        height: ${initialHeight}px;
        background: #fff;
        box-shadow: 0 18px 40px rgba(0, 0, 0, 0.35);
      }
      iframe {
        display: block;
        width: 100%;
        height: 100%;
        border: 0;
        background: #fff;
      }
      .nav-link {
        display: inline-block;
        margin-top: 14px;
        color: var(--teal);
        font-size: 12px;
        text-decoration: none;
      }
      .nav-link:hover { text-decoration: underline; }
      @media (max-width: 900px) {
        body { overflow: auto; height: auto; }
        .layout {
          grid-template-columns: 1fr;
          height: auto;
        }
        .controls { border-right: 0; border-bottom: 1px solid var(--line); }
        .stage-wrap { min-height: 420px; }
      }
    </style>
  </head>
  <body>
    <header>
      <div class="brand-lockup" aria-label="Boys and Girls and SSE">
        <img class="brand-logo brand-logo-bg" src="../brand/BGlogo_SVG.svg" alt="Boys and Girls">
        <span class="brand-divider" aria-hidden="true">|</span>
        <img class="brand-logo brand-logo-sse" src="../brand/SSELogoWhite.svg" alt="SSE">
      </div>
      <p class="header-title">Statics Preview</p>
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
        <p class="meta">Package: ${zipLabel}<br>Generated: ${generatedLabel}</p>
        <a class="nav-link" href="../">DCO preview</a>
      </form>
      <section class="preview">
        <div class="preview-head">
          <div>
            <span class="kicker">Client review</span>
            <h1 id="preview-title">${escapeHtml(first.name)}</h1>
            <p id="preview-subtitle">${escapeHtml(firstSize)} · outlined static HTML</p>
          </div>
          <div class="preview-actions">
            <button type="button" id="replay">Replay</button>
            <a class="primary" id="download" href="${zipHref}" download>Download ZIP</a>
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
        var campaigns = ${campaignsJson};
        var campaignSelect = document.getElementById('campaign');
        var sizeSelect = document.getElementById('size');
        var frame = document.getElementById('ad-frame');
        var shell = document.getElementById('frame-shell');
        var title = document.getElementById('preview-title');
        var subtitle = document.getElementById('preview-subtitle');
        var replay = document.getElementById('replay');

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
          return 'campaigns/' + campaign.id + '/' + campaign.exportSlug + '_' + size + '.html';
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

        function persist() {
          try {
            sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
              campaignId: campaignSelect.value,
              size: sizeSelect.value,
            }));
          } catch (error) {}
        }

        function loadActiveAd() {
          var campaign = findCampaign(campaignSelect.value);
          var size = sizeSelect.value || campaign.sizes[0];
          var dims = parseSize(size);
          shell.style.width = dims.width + 'px';
          shell.style.height = dims.height + 'px';
          title.textContent = campaign.name;
          subtitle.textContent = size + ' · outlined static HTML';
          frame.src = adSrc(campaign, size);
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
          loadActiveAd();
        }

        campaignSelect.addEventListener('change', function() {
          var campaign = findCampaign(campaignSelect.value);
          fillSizes(campaign, sizeSelect.value);
          loadActiveAd();
        });
        sizeSelect.addEventListener('change', loadActiveAd);
        replay.addEventListener('click', function() {
          frame.src = frame.src;
        });

        hydrate();
      })();
    </script>
  </body>
</html>
`;
};
