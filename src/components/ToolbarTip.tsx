// @ts-nocheck
'use client';

/**
 * Instant tooltip via CSS (see [data-tip] rules in editor.css).
 * Avoid native title attributes — browser delay is too slow for dense toolbars.
 */
export function ToolbarTip({
  tip,
  children,
  className = '',
}: {
  tip: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`toolbar-tip ${className}`.trim()} data-tip={tip}>
      {children}
    </span>
  );
}
