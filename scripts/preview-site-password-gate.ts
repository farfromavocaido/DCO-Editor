const escapeJsString = (value: string) => JSON.stringify(value);

export const PREVIEW_SITE_PASSWORD = process.env.PREVIEW_SITE_PASSWORD || 'ssedco';

export const wrapPreviewSiteWithPasswordGate = (html: string, password = PREVIEW_SITE_PASSWORD) => {
  const gateMarkup = `
    <div id="preview-password-gate" hidden>
      <form id="preview-password-form">
        <p class="preview-password-kicker">SSE DCO</p>
        <h2>Client preview</h2>
        <p class="preview-password-copy">Enter the preview password to continue.</p>
        <label>
          <span>Password</span>
          <input id="preview-password-input" type="password" autocomplete="current-password" autofocus>
        </label>
        <p id="preview-password-error" role="alert"></p>
        <button type="submit">Continue</button>
      </form>
    </div>`;

  const gateStyles = `
    <style id="preview-password-gate-styles">
      body.preview-gated > header,
      body.preview-gated > main {
        visibility: hidden;
      }
      #preview-password-gate {
        position: fixed;
        inset: 0;
        z-index: 9999;
        display: grid;
        place-items: center;
        background: #0b0f13;
        color: #edf7f7;
        font-family: "museo-sans", "Museo Sans", sans-serif;
      }
      #preview-password-gate[hidden] {
        display: none !important;
      }
      #preview-password-form {
        width: min(100%, 360px);
        padding: 28px;
        border: 1px solid #2b3846;
        border-radius: 16px;
        background: #141b23;
        display: grid;
        gap: 14px;
      }
      #preview-password-form h2 {
        margin: 0;
        font-size: 24px;
        font-weight: 650;
      }
      .preview-password-kicker {
        margin: 0;
        color: #16c7b7;
        font-size: 11px;
        font-weight: 650;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .preview-password-copy {
        margin: 0;
        color: #99a8b5;
        font-size: 14px;
        line-height: 1.5;
      }
      #preview-password-form label {
        display: grid;
        gap: 8px;
        font-size: 12px;
        color: #99a8b5;
      }
      #preview-password-input {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid #2b3846;
        border-radius: 10px;
        background: #0b0f13;
        color: #edf7f7;
        font: inherit;
      }
      #preview-password-error {
        min-height: 1.2em;
        margin: 0;
        color: #ff6b9d;
        font-size: 13px;
      }
      #preview-password-form button {
        padding: 10px 14px;
        border: 0;
        border-radius: 10px;
        background: #16c7b7;
        color: #073674;
        font: inherit;
        font-weight: 650;
        cursor: pointer;
      }
    </style>`;

  const gateScript = `
    <script id="preview-password-gate-script">
      (function() {
        var storageKey = 'sse-dco-preview-auth';
        var password = ${escapeJsString(password)};
        var gate = document.getElementById('preview-password-gate');
        var form = document.getElementById('preview-password-form');
        var input = document.getElementById('preview-password-input');
        var error = document.getElementById('preview-password-error');

        function unlock() {
          document.body.classList.remove('preview-gated');
          document.body.classList.add('preview-unlocked');
          if (gate) gate.hidden = true;
          sessionStorage.setItem(storageKey, '1');
        }

        if (sessionStorage.getItem(storageKey) === '1') {
          unlock();
          return;
        }

        document.body.classList.add('preview-gated');
        if (gate) gate.hidden = false;

        if (!form || !input) return;

        form.addEventListener('submit', function(event) {
          event.preventDefault();
          if (input.value === password) {
            if (error) error.textContent = '';
            unlock();
            return;
          }
          if (error) error.textContent = 'Incorrect password';
          input.select();
        });
      })();
    </script>`;

  let output = html;
  if (!output.includes('id="preview-password-gate-styles"')) {
    output = output.replace('</head>', `${gateStyles}\n  </head>`);
  }
  output = output.replace('<body>', `<body class="preview-gated">${gateMarkup}`);
  output = output.replace('</body>', `${gateScript}\n  </body>`);

  if (!output.includes('id="preview-password-gate"')) {
    throw new Error('Failed to inject preview password gate markup');
  }

  return output;
};
