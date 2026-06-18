// @ts-nocheck
'use client';

export function PlayheadReadout({
  seconds,
  percent,
  className = '',
}: {
  seconds: number;
  percent: number;
  className?: string;
}) {
  const percentLabel = Number.isInteger(percent) ? `${percent}` : percent.toFixed(1);
  return (
    <div
      className={`playhead-readout ${className}`.trim()}
      aria-label={`${seconds.toFixed(2)} seconds, ${percentLabel} percent`}
    >
      <strong>{seconds.toFixed(2)}s</strong>
      <span>{percentLabel}%</span>
    </div>
  );
}
