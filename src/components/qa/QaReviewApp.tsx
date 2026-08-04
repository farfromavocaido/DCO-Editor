'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { seekAgencyTimeline } from '@/lib/agency-timeline-seek';
import { backgroundImageFieldName, CREATIVE_AD_SIZES } from '@/lib/feed-background';
import type { HoldSample } from '@/lib/hold-samples';

type MatrixPayload = {
  sizes: string[];
  durationS: number;
  intervalMs: number;
  copySets: Array<{
    id: string;
    headlines: string;
    offers: string;
    roundel: string;
    legal: string;
  }>;
  library: {
    headlines: Record<string, Record<string, string>>;
    offers: Record<string, Record<string, string>>;
    roundel: Record<string, Record<string, string>>;
    legal: Record<string, Record<string, string>>;
    cta: { offers: string; brand: string };
  };
  backgroundAssets: Record<string, string>;
};

type HoldsResponse = {
  bySize: Record<string, { samples: HoldSample[]; holdsMs: number[] }>;
};

type TcMode = 'tcs_only' | 'tcs_units';
type CtaShape = 'roundel' | 'rectangle';
type CopyPreset = 'short' | 'long';

const COPY_FIELD_NAMES = [
  'heading1_text',
  'heading2_text',
  'heading3_text',
  'heading4_text',
  'offer1_value_text',
  'offer1_sub_text',
  'offer2_value_text',
  'offer2_sub_text',
  'offer3_value_text',
  'offer3_sub_text',
  'roundel_text_text',
  'roundel_value_text',
  'tc_terms_text',
  'tc_units_text',
  'cta_text',
] as const;

const OFFER_PAIRS = [
  { value: 'offer1_value_text', sub: 'offer1_sub_text', label: '1' },
  { value: 'offer2_value_text', sub: 'offer2_sub_text', label: '2' },
  { value: 'offer3_value_text', sub: 'offer3_sub_text', label: '3' },
] as const;

const CELL_EDGE_MIN = 120;
const CELL_EDGE_MAX = 720;
const CELL_EDGE_DEFAULT = 260;

const parseSize = (size: string) => {
  const [w, h] = size.split('x').map(Number);
  return {
    width: Number.isFinite(w) ? w! : 300,
    height: Number.isFinite(h) ? h! : 250,
  };
};

const emptyCopyFields = (): Record<string, string> => (
  Object.fromEntries(COPY_FIELD_NAMES.map((name) => [name, '']))
);

const waitForAgencyReady = async (win: Window, timeoutMs = 8000) => {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const ready = Boolean((win as Window & { __SSE_DCO_READY__?: boolean }).__SSE_DCO_READY__);
    const apply = typeof (win as Window & {
      applySseDcoRuntimeState?: (row: Record<string, unknown>) => void;
    }).applySseDcoRuntimeState === 'function';
    if (ready && apply) return;
    await new Promise((resolve) => window.setTimeout(resolve, 50));
  }
  throw new Error('Agency runtime did not become ready');
};

const injectHoldFrame = async (
  iframe: HTMLIFrameElement,
  row: Record<string, unknown>,
  tMs: number,
) => {
  const win = iframe.contentWindow;
  if (!win) return;
  await waitForAgencyReady(win);
  const apply = (win as Window & {
    applySseDcoRuntimeState: (next: Record<string, unknown>) => void;
  }).applySseDcoRuntimeState;
  apply(row);
  seekAgencyTimeline(win.document.getElementById('page-content'), tMs);
  await new Promise((resolve) => window.setTimeout(resolve, 80));
  seekAgencyTimeline(win.document.getElementById('page-content'), tMs);
};

function QaSegmentedControl({
  label,
  value,
  options,
  onChange,
  tip,
  disabled = false,
}: {
  label: string;
  value: string | number;
  options: { value: string; label: string; tip?: string }[];
  onChange: (value: string) => void;
  tip?: string;
  disabled?: boolean;
}) {
  return (
    <div className={`qa-field-inline${disabled ? ' is-disabled' : ''}`} title={tip || label}>
      <span className="qa-field-label">{label}</span>
      <div className="qa-segmented" role="group" aria-label={label} aria-disabled={disabled || undefined}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={String(option.value) === String(value)}
            aria-label={option.tip || option.label}
            title={option.tip || option.label}
            disabled={disabled}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function QaReviewApp() {
  const iframeRefs = useRef(new Map<number, HTMLIFrameElement>());
  const cellRefs = useRef(new Map<number, HTMLElement>());
  const [matrix, setMatrix] = useState<MatrixPayload | null>(null);
  const [copyFields, setCopyFields] = useState<Record<string, string>>(emptyCopyFields);
  const [activePreset, setActivePreset] = useState<CopyPreset | null>('long');
  const [offerCount, setOfferCount] = useState(1);
  const [tcMode, setTcMode] = useState<TcMode>('tcs_units');
  const [ctaShape, setCtaShape] = useState<CtaShape>('rectangle');
  const [includeRoundelFrame, setIncludeRoundelFrame] = useState(true);
  const [monitoredSizes, setMonitoredSizes] = useState<string[]>([...CREATIVE_AD_SIZES]);
  const [viewSize, setViewSize] = useState('');
  const [holdIndex, setHoldIndex] = useState(0);
  const [cellMaxEdge, setCellMaxEdge] = useState(CELL_EDGE_DEFAULT);
  const [holdsBySize, setHoldsBySize] = useState<HoldsResponse['bySize']>({});
  const [shellReady, setShellReady] = useState(false);
  const [iframeNonce, setIframeNonce] = useState(0);
  const [status, setStatus] = useState('Loading…');
  const [error, setError] = useState('');
  const injectGen = useRef(0);

  // Roundel-on forces rectangular CTA at runtime (same as agency HTML).
  const effectiveCtaShape: CtaShape = includeRoundelFrame ? 'rectangle' : ctaShape;
  const effectiveTcMode: TcMode = offerCount === 0 ? 'tcs_only' : tcMode;

  const sessionKey = useMemo(() => (
    [
      viewSize,
      `o${offerCount}`,
      includeRoundelFrame ? 'roundel' : '3acts',
      effectiveTcMode,
      effectiveCtaShape,
    ].join('__')
  ), [viewSize, offerCount, includeRoundelFrame, effectiveTcMode, effectiveCtaShape]);

  const samples = viewSize ? (holdsBySize[viewSize]?.samples || []) : [];
  const hold = samples[Math.min(holdIndex, Math.max(0, samples.length - 1))] || null;
  const sizeIndex = monitoredSizes.indexOf(viewSize);

  const mergedRow = useMemo(() => {
    if (!matrix || !viewSize) return null;
    const ctaFallback = offerCount === 0
      ? matrix.library.cta.brand
      : matrix.library.cta.offers;
    const row: Record<string, unknown> = {
      Unique_ID: `${sessionKey}__live`,
      Reporting_label: sessionKey,
      Active: true,
      Default: false,
      offer_count_num: offerCount,
      include_roundel_frame_bool: includeRoundelFrame,
      tc_type_enum: effectiveTcMode,
      cta_type_enum: effectiveCtaShape,
      cta_text: copyFields.cta_text || ctaFallback,
      ...copyFields,
    };
    for (const size of CREATIVE_AD_SIZES) {
      const relative = matrix.backgroundAssets[size] || '';
      row[backgroundImageFieldName(size)] = {
        Url: relative ? `/qa-shell/${relative}` : '',
      };
    }
    return row;
  }, [
    matrix,
    viewSize,
    sessionKey,
    offerCount,
    includeRoundelFrame,
    effectiveTcMode,
    effectiveCtaShape,
    copyFields,
  ]);

  const ensureShell = useCallback(async (force = false) => {
    setStatus(force ? 'Re-exporting agency shell…' : 'Ensuring agency shell…');
    const res = await fetch('/api/qa/shell', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ force }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Shell export failed');
    setShellReady(true);
    setIframeNonce((n) => n + 1);
    setStatus(`Agency shell ready (${data.sizes?.length || 0} sizes)`);
    return data;
  }, []);

  const applyPresetFields = useCallback((
    matrixData: MatrixPayload,
    copySetId: CopyPreset,
    nextOfferCount: number,
  ) => {
    const copySet = matrixData.copySets.find((item) => item.id === copySetId)
      || matrixData.copySets[0];
    if (!copySet) return;
    const next = emptyCopyFields();
    Object.assign(next, matrixData.library.headlines[copySet.headlines] || {});
    Object.assign(next, matrixData.library.offers[copySet.offers] || {});
    Object.assign(next, matrixData.library.roundel[copySet.roundel] || {});
    Object.assign(next, matrixData.library.legal[copySet.legal] || {});
    next.cta_text = nextOfferCount === 0
      ? matrixData.library.cta.brand
      : matrixData.library.cta.offers;
    setCopyFields(next);
    setActivePreset(copySetId);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const matrixRes = await fetch('/api/qa/matrix');
        const matrixData = await matrixRes.json();
        if (!matrixRes.ok) throw new Error(matrixData.error || 'Failed to load matrix');
        if (cancelled) return;
        setMatrix(matrixData);
        const sizes = matrixData.sizes?.length ? matrixData.sizes : [...CREATIVE_AD_SIZES];
        setMonitoredSizes(sizes);
        setViewSize(sizes.includes('160x600') ? '160x600' : (sizes[0] || ''));
        applyPresetFields(matrixData, 'long', 1);
        await ensureShell(false);
        if (!cancelled) setError('');
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
          setStatus('Failed to initialize');
        }
      }
    })();
    return () => { cancelled = true; };
  }, [ensureShell, applyPresetFields]);

  useEffect(() => {
    if (!monitoredSizes.length) return;
    if (!monitoredSizes.includes(viewSize)) {
      setViewSize(monitoredSizes[0]!);
    }
  }, [monitoredSizes, viewSize]);

  useEffect(() => {
    setHoldIndex(0);
  }, [sessionKey]);

  useEffect(() => {
    if (!mergedRow || !monitoredSizes.length) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch('/api/qa/holds', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ row: mergedRow, sizes: monitoredSizes }),
        });
        const data = await res.json() as HoldsResponse & { error?: string };
        if (!res.ok) throw new Error(data.error || 'Failed to derive holds');
        if (!cancelled) {
          setHoldsBySize(data.bySize || {});
          setError('');
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [mergedRow, monitoredSizes]);

  const holdTimesKey = samples.map((sample) => sample.tMs).join(',');

  const injectSheet = useCallback(async () => {
    if (!mergedRow || !viewSize || !shellReady || !samples.length) return;
    const gen = ++injectGen.current;
    try {
      await Promise.all(samples.map(async (sample, index) => {
        const iframe = iframeRefs.current.get(index);
        if (!iframe) return;
        await injectHoldFrame(iframe, mergedRow, sample.tMs);
      }));
      if (gen !== injectGen.current) return;
      setStatus(`${viewSize} · o${offerCount} · ${samples.length} holds`);
      setError('');
    } catch (err) {
      if (gen === injectGen.current) {
        setError(err instanceof Error ? err.message : String(err));
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mergedRow, viewSize, shellReady, holdTimesKey, offerCount]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      injectSheet().catch(() => {});
    }, 140);
    return () => window.clearTimeout(timer);
  }, [injectSheet, iframeNonce]);

  useEffect(() => {
    if (!viewSize) return;
    setStatus(
      `${viewSize} · ${offerCount} offer${offerCount === 1 ? '' : 's'}`
      + ` · ${includeRoundelFrame ? 'roundel' : '3 acts'}`
      + ` · ${effectiveCtaShape}`
      + ` · ${samples.length} holds`
      + (hold ? ` · focus t=${hold.tMs}ms (${hold.labels.join('+')})` : ''),
    );
  }, [viewSize, offerCount, includeRoundelFrame, effectiveCtaShape, samples.length, hold]);

  useEffect(() => {
    const el = cellRefs.current.get(holdIndex);
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  }, [holdIndex, sessionKey]);

  const loadPreset = (copySetId: CopyPreset) => {
    if (!matrix) return;
    applyPresetFields(matrix, copySetId, offerCount);
  };

  const setField = (name: string, value: string) => {
    setActivePreset(null);
    setCopyFields((prev) => ({ ...prev, [name]: value }));
  };

  const setOfferCountAndCta = (next: number) => {
    setOfferCount(next);
    if (!matrix) return;
    setCopyFields((prev) => ({
      ...prev,
      cta_text: next === 0 ? matrix.library.cta.brand : matrix.library.cta.offers,
    }));
  };

  const toggleSize = (size: string) => {
    setMonitoredSizes((prev) => {
      if (prev.includes(size)) {
        return prev.length === 1 ? prev : prev.filter((item) => item !== size);
      }
      return CREATIVE_AD_SIZES.filter((item) => item === size || prev.includes(item));
    });
  };

  const sizeCount = monitoredSizes.length;
  const holdCount = samples.length;

  const stepSize = useCallback((delta: number) => {
    if (!sizeCount) return;
    const current = Math.max(0, sizeIndex);
    const next = monitoredSizes[(current + delta + sizeCount) % sizeCount];
    if (next) setViewSize(next);
  }, [sizeCount, sizeIndex, monitoredSizes]);

  const stepHold = useCallback((delta: number) => {
    if (!holdCount) return;
    setHoldIndex((prev) => (prev + delta + holdCount) % holdCount);
  }, [holdCount]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) {
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        stepHold(-1);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        stepHold(1);
      } else if (event.key === '[') {
        event.preventDefault();
        stepSize(-1);
      } else if (event.key === ']') {
        event.preventDefault();
        stepSize(1);
      } else if (event.key === '=' || event.key === '+') {
        event.preventDefault();
        setCellMaxEdge((prev) => Math.min(CELL_EDGE_MAX, prev + 20));
      } else if (event.key === '-' || event.key === '_') {
        event.preventDefault();
        setCellMaxEdge((prev) => Math.max(CELL_EDGE_MIN, prev - 20));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stepHold, stepSize]);

  const { width, height } = parseSize(viewSize || '300x250');
  const scale = Math.min(1, cellMaxEdge / Math.max(width, height));
  const cellW = Math.round(width * scale);
  const cellH = Math.round(height * scale);
  const zoomPct = Math.round((cellMaxEdge / CELL_EDGE_DEFAULT) * 100);

  const iframeSrc = viewSize && shellReady
    ? `/qa-shell/ads/${viewSize}/index.html?n=${iframeNonce}`
    : 'about:blank';

  return (
    <div className="qa-page">
      <aside className="qa-rail">
        <div>
          <h1>Agency QA</h1>
          <p className="qa-sub">
            Canonical-agency hold sheet · same shell as capture.
            {' '}
            <a href="/">Editor</a>
          </p>
        </div>

        <div className="qa-block">
          <span className="qa-block-label">Headlines</span>
          <div className="qa-fields">
            {(['heading1_text', 'heading2_text', 'heading3_text', 'heading4_text'] as const).map((name, index) => (
              <label key={name} className="qa-field">
                <span>H{index + 1}</span>
                <textarea
                  rows={Math.max(1, copyFields[name]?.split('\n').length || 1)}
                  value={copyFields[name] || ''}
                  onChange={(event) => setField(name, event.target.value)}
                />
              </label>
            ))}
          </div>
        </div>

        <div className="qa-block">
          <span className="qa-block-label">Offers</span>
          <div className="qa-fields">
            {OFFER_PAIRS.map((pair) => (
              <div key={pair.label} className="qa-field-row">
                <label className="qa-field">
                  <span>{pair.label}</span>
                  <input
                    value={copyFields[pair.value] || ''}
                    onChange={(event) => setField(pair.value, event.target.value)}
                  />
                </label>
                <label className="qa-field">
                  <span>Sub</span>
                  <input
                    value={copyFields[pair.sub] || ''}
                    onChange={(event) => setField(pair.sub, event.target.value)}
                  />
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="qa-block">
          <span className="qa-block-label">Roundel</span>
          <div className="qa-field-row qa-roundel-row">
            <label className="qa-field">
              <span>Text</span>
              <input
                value={copyFields.roundel_text_text || ''}
                onChange={(event) => setField('roundel_text_text', event.target.value)}
              />
            </label>
            <label className="qa-field">
              <span>Value</span>
              <input
                value={copyFields.roundel_value_text || ''}
                onChange={(event) => setField('roundel_value_text', event.target.value)}
              />
            </label>
          </div>
        </div>

        <div className="qa-block">
          <span className="qa-block-label">Legal / CTA</span>
          <div className="qa-fields">
            <label className="qa-field">
              <span>T&Cs</span>
              <textarea
                rows={2}
                value={copyFields.tc_terms_text || ''}
                onChange={(event) => setField('tc_terms_text', event.target.value)}
              />
            </label>
            <label className="qa-field">
              <span>Unit rate</span>
              <textarea
                rows={2}
                value={copyFields.tc_units_text || ''}
                onChange={(event) => setField('tc_units_text', event.target.value)}
              />
            </label>
            <label className="qa-field">
              <span>CTA</span>
              <input
                value={copyFields.cta_text || ''}
                onChange={(event) => setField('cta_text', event.target.value)}
              />
            </label>
          </div>
        </div>

        <details className="qa-block qa-collapse">
          <summary>
            <span className="qa-block-label">Monitor sizes</span>
            <span className="qa-collapse-hint">
              {monitoredSizes.length}
              /
              {(matrix?.sizes || CREATIVE_AD_SIZES).length}
            </span>
          </summary>
          <div className="qa-collapse-body">
            <div className="qa-checks">
              {(matrix?.sizes || CREATIVE_AD_SIZES).map((size) => (
                <label
                  key={size}
                  className={`qa-check${monitoredSizes.includes(size) ? ' is-on' : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={monitoredSizes.includes(size)}
                    onChange={() => toggleSize(size)}
                  />
                  <span>{size}</span>
                </label>
              ))}
            </div>
          </div>
        </details>

        <div className="qa-block">
          <div className="qa-actions">
            <button
              type="button"
              onClick={() => {
                ensureShell(true).catch((err) => {
                  setError(err instanceof Error ? err.message : String(err));
                });
              }}
            >
              Refresh shell
            </button>
          </div>
        </div>

        <p className={`qa-status${error ? ' is-error' : ''}`}>
          {error || status}
        </p>
      </aside>

      <main className="qa-main">
        <div className="qa-topbar" aria-label="QA controls">
          <div className="qa-control-strip">
            <div className="qa-field-inline">
              <span className="qa-field-label">Size</span>
              <select
                className="qa-top-select"
                aria-label="Ad size"
                value={viewSize}
                disabled={!monitoredSizes.length}
                onChange={(event) => setViewSize(event.target.value)}
              >
                {monitoredSizes.map((size) => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
            </div>

            <QaSegmentedControl
              label="Offers"
              tip="Number of offers shown in the ad"
              value={String(offerCount)}
              options={[
                { value: '0', label: '0', tip: 'No offers (brand / awareness)' },
                { value: '1', label: '1', tip: 'Single offer' },
                { value: '2', label: '2', tip: 'Dual offers' },
                { value: '3', label: '3', tip: 'Triple offers' },
              ]}
              onChange={(value) => setOfferCountAndCta(Number(value))}
            />

            <QaSegmentedControl
              label="T&Cs"
              tip={offerCount === 0
                ? 'T&Cs are hidden for the zero-offers variant'
                : 'Terms and conditions layout'}
              value={effectiveTcMode}
              disabled={offerCount === 0}
              options={[
                { value: 'tcs_only', label: 'Solo', tip: 'T&Cs only' },
                { value: 'tcs_units', label: 'Prices', tip: 'T&Cs with unit rates' },
              ]}
              onChange={(value) => setTcMode(value as TcMode)}
            />

            <QaSegmentedControl
              label="CTA"
              tip={includeRoundelFrame
                ? 'Roundel frame forces rectangular CTA'
                : 'Call-to-action button shape'}
              value={effectiveCtaShape}
              disabled={includeRoundelFrame}
              options={[
                { value: 'roundel', label: 'Round', tip: 'Round CTA button' },
                { value: 'rectangle', label: 'Rect', tip: 'Rectangular CTA button' },
              ]}
              onChange={(value) => setCtaShape(value as CtaShape)}
            />

            <QaSegmentedControl
              label="Frame"
              tip="Optional Act 3 offer roundel frame"
              value={includeRoundelFrame ? 'roundel' : 'standard'}
              options={[
                { value: 'standard', label: '3 Acts', tip: 'No offer roundel (headlines 1, 2, and 4)' },
                { value: 'roundel', label: 'Offer roundel', tip: 'Four headline acts with offer roundel frame' },
              ]}
              onChange={(value) => setIncludeRoundelFrame(value === 'roundel')}
            />

            <QaSegmentedControl
              label="Copy"
              tip="Matrix short / long stress copy"
              value={activePreset || ''}
              options={[
                { value: 'short', label: 'Short', tip: 'Short stress copy' },
                { value: 'long', label: 'Long', tip: 'Long stress copy' },
              ]}
              onChange={(value) => loadPreset(value as CopyPreset)}
            />
          </div>

          <div className="qa-topbar-aside">
            <button type="button" onClick={() => stepSize(-1)} disabled={!monitoredSizes.length} title="Previous size ([)">[</button>
            <button type="button" onClick={() => stepSize(1)} disabled={!monitoredSizes.length} title="Next size (])">]</button>
            <button type="button" onClick={() => stepHold(-1)} disabled={!samples.length} title="Previous hold (←)">←</button>
            <button type="button" onClick={() => stepHold(1)} disabled={!samples.length} title="Next hold (→)">→</button>
            <span className="qa-stage-meta">
              {viewSize ? (
                <>
                  <strong>{samples.length}</strong>
                  {' holds'}
                  {sizeIndex >= 0 ? ` · size ${sizeIndex + 1}/${monitoredSizes.length}` : ''}
                  {hold ? ` · t=${hold.tMs}ms` : ''}
                </>
              ) : 'Select a size'}
            </span>

            <label className="qa-zoom" title="Sheet zoom (− / =)">
              <span className="qa-zoom-icon" aria-hidden>▫</span>
              <input
                className="qa-zoom-slider"
                type="range"
                min={CELL_EDGE_MIN}
                max={CELL_EDGE_MAX}
                step={10}
                value={cellMaxEdge}
                onChange={(event) => setCellMaxEdge(Number(event.target.value))}
                aria-label="Sheet zoom"
              />
              <span className="qa-zoom-icon is-large" aria-hidden>■</span>
              <span className="qa-zoom-value">{zoomPct}%</span>
            </label>
          </div>
        </div>

        <div className="qa-stage">
          {viewSize && shellReady && samples.length ? (
            <div className="qa-sheet" role="list">
              {samples.map((sample, index) => (
                <figure
                  key={`${sessionKey}-${sample.tMs}-${sample.labels.join('-')}-${iframeNonce}`}
                  ref={(node) => {
                    if (node) cellRefs.current.set(index, node);
                    else cellRefs.current.delete(index);
                  }}
                  className={`qa-cell${index === holdIndex ? ' is-active' : ''}`}
                  role="listitem"
                  onClick={() => setHoldIndex(index)}
                >
                  <figcaption className="qa-cell-caption">
                    <strong>
                      #
                      {String(index + 1).padStart(2, '0')}
                    </strong>
                    {' '}
                    t
                    {String(sample.tMs).padStart(4, '0')}
                    {' '}
                    (
                    {(sample.tMs / 1000).toFixed(2)}
                    s) ·
                    {' '}
                    {sample.labels.join('+')}
                  </figcaption>
                  <div
                    className="qa-frame-shell"
                    style={{ width: cellW, height: cellH }}
                  >
                    <iframe
                      ref={(node) => {
                        if (node) iframeRefs.current.set(index, node);
                        else iframeRefs.current.delete(index);
                      }}
                      title={`${sessionKey} t${sample.tMs}`}
                      src={iframeSrc}
                      width={width}
                      height={height}
                      style={{
                        width,
                        height,
                        transform: `scale(${scale})`,
                        transformOrigin: 'top left',
                      }}
                      onLoad={() => {
                        if (!mergedRow) return;
                        injectHoldFrame(
                          iframeRefs.current.get(index)!,
                          mergedRow,
                          sample.tMs,
                        ).catch(() => {});
                      }}
                    />
                  </div>
                </figure>
              ))}
            </div>
          ) : (
            <p className="qa-empty">
              {!shellReady
                ? 'Loading agency shell…'
                : !viewSize
                  ? 'Select a size'
                  : 'No settled holds for this size/scopes'}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
