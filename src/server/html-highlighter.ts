import { html as beautifyHtml } from 'js-beautify';
import { createHighlighter, type Highlighter } from 'shiki';

let highlighterPromise: Promise<Highlighter> | null = null;

async function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ['github-dark'],
      langs: ['html'],
    });
  }
  return highlighterPromise;
}

export function formatHtmlSource(source: string) {
  return beautifyHtml(source, {
    indent_size: 2,
    wrap_line_length: 0,
    preserve_newlines: false,
    max_preserve_newlines: 1,
    indent_inner_html: true,
    indent_scripts: 'keep',
    end_with_newline: true,
  });
}

export async function highlightHtmlSource(source: string) {
  const formatted = formatHtmlSource(source);
  const highlighter = await getHighlighter();
  const highlightedHtml = highlighter.codeToHtml(formatted, {
    lang: 'html',
    theme: 'github-dark',
  });
  return {
    html: formatted,
    highlightedHtml,
    lineCount: formatted.split('\n').length,
    byteLength: Buffer.byteLength(formatted, 'utf8'),
  };
}
