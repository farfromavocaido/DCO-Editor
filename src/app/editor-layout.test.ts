import { test } from 'vitest';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const appDir = path.resolve(__dirname);
const editorCss = fs.readFileSync(path.join(appDir, 'editor.css'), 'utf8');
const globalsCss = fs.readFileSync(path.join(appDir, 'globals.css'), 'utf8');

test('editor shell is pinned to the visual viewport', () => {
  const shellRule = editorCss.match(/\.app-shell\s*{[^}]+}/)?.[0] || '';

  assert.match(shellRule, /position:\s*fixed;/);
  assert.match(shellRule, /inset:\s*0;/);
  assert.match(shellRule, /width:\s*100vw;/);
  assert.match(shellRule, /height:\s*100dvh;/);
});

test('global page styles do not constrain editor width', () => {
  assert.doesNotMatch(globalsCss, /max-width:\s*100vw;/);
  assert.match(globalsCss, /html,\s*\nbody\s*{[^}]*width:\s*100%;/);
});

test('selection chrome does not block canvas hit testing', () => {
  const selectionBoxRule = editorCss.match(/\.selection-box\s*{[^}]+}/)?.[0] || '';
  const resizeHandleRule = editorCss.match(/\.resize-handle\s*{[^}]+}/)?.[0] || '';
  const termsWrapperRule = editorCss.match(/\.tc-prices-group,\s*\n\.tc-solo-group\s*{[^}]+}/)?.[0] || '';
  const termsTextRule = editorCss.match(/\.tc-prices-group > \*,\s*\n\.tc-solo-group > \*\s*{[^}]+}/)?.[0] || '';

  assert.match(selectionBoxRule, /pointer-events:\s*none;/);
  assert.match(resizeHandleRule, /pointer-events:\s*auto;/);
  assert.match(termsWrapperRule, /pointer-events:\s*none;/);
  assert.match(termsTextRule, /pointer-events:\s*auto;/);
});
