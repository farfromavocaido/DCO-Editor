// @ts-nocheck
'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { EditorIcon } from '@/components/EditorIcon';

export const RULER_SIZE = 22;
const MAJOR_STEP = 50;
const MINOR_STEP = 10;

export type UserGuides = {
  vertical: number[];
  horizontal: number[];
};

function buildTickValues(length: number) {
  const ticks: Array<{ value: number; major: boolean }> = [];
  for (let value = 0; value <= length; value += MINOR_STEP) {
    ticks.push({ value, major: value % MAJOR_STEP === 0 });
  }
  return ticks;
}

function clientToCanvasPoint(
  clientX: number,
  clientY: number,
  stageRect: DOMRect,
  scale: number,
  canvas: { width: number; height: number },
) {
  const x = (clientX - stageRect.left) / scale;
  const y = (clientY - stageRect.top) / scale;
  return {
    x: Math.round(Math.max(0, Math.min(canvas.width, x))),
    y: Math.round(Math.max(0, Math.min(canvas.height, y))),
  };
}

function useStageMetrics(
  scrollRef: React.RefObject<HTMLDivElement | null>,
  stageShellRef: React.RefObject<HTMLDivElement | null>,
  scale: number,
) {
  const [metrics, setMetrics] = useState({
    shellLeft: 0,
    shellTop: 0,
    shellWidth: 0,
    shellHeight: 0,
    scrollWidth: 0,
    scrollHeight: 0,
  });

  const update = useCallback(() => {
    const scroll = scrollRef.current;
    const shell = stageShellRef.current;
    if (!scroll || !shell) return;
    const scrollRect = scroll.getBoundingClientRect();
    const shellRect = shell.getBoundingClientRect();
    setMetrics((prev) => {
      const next = {
        shellLeft: shellRect.left - scrollRect.left,
        shellTop: shellRect.top - scrollRect.top,
        shellWidth: shellRect.width,
        shellHeight: shellRect.height,
        scrollWidth: scroll.clientWidth,
        scrollHeight: scroll.clientHeight,
      };
      if (
        prev.shellLeft === next.shellLeft
        && prev.shellTop === next.shellTop
        && prev.shellWidth === next.shellWidth
        && prev.shellHeight === next.shellHeight
        && prev.scrollWidth === next.scrollWidth
        && prev.scrollHeight === next.scrollHeight
      ) {
        return prev;
      }
      return next;
    });
  }, [scrollRef, stageShellRef]);

  useLayoutEffect(() => {
    update();
    const scroll = scrollRef.current;
    const shell = stageShellRef.current;
    if (!scroll) return undefined;
    scroll.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    const observer = new ResizeObserver(update);
    observer.observe(scroll);
    if (shell) observer.observe(shell);
    return () => {
      scroll.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      observer.disconnect();
    };
  }, [update, scale, scrollRef, stageShellRef]);

  return { metrics, refreshMetrics: update };
}

function HorizontalRuler({
  canvasWidth,
  scale,
  metrics,
  onStartVerticalGuide,
}: {
  canvasWidth: number;
  scale: number;
  metrics: Record<string, number>;
  onStartVerticalGuide: (event: React.PointerEvent) => void;
}) {
  const ticks = useMemo(() => buildTickValues(canvasWidth), [canvasWidth]);
  return (
    <div
      className="viewport-ruler viewport-ruler-horizontal"
      onPointerDown={onStartVerticalGuide}
      title="Drag onto canvas to add a vertical guide"
    >
      {ticks.map((tick) => {
        const left = metrics.shellLeft + tick.value * scale;
        if (left < -12 || left > metrics.scrollWidth + 12) return null;
        return (
          <span
            key={`hx-${tick.value}`}
            className={`viewport-ruler-tick ${tick.major ? 'is-major' : ''}`}
            style={{ left }}
          >
            {tick.major ? <span className="viewport-ruler-label">{tick.value}</span> : null}
          </span>
        );
      })}
    </div>
  );
}

function VerticalRuler({
  canvasHeight,
  scale,
  metrics,
  onStartHorizontalGuide,
}: {
  canvasHeight: number;
  scale: number;
  metrics: Record<string, number>;
  onStartHorizontalGuide: (event: React.PointerEvent) => void;
}) {
  const ticks = useMemo(() => buildTickValues(canvasHeight), [canvasHeight]);
  return (
    <div
      className="viewport-ruler viewport-ruler-vertical"
      onPointerDown={onStartHorizontalGuide}
      title="Drag onto canvas to add a horizontal guide"
    >
      {ticks.map((tick) => {
        const top = metrics.shellTop + tick.value * scale;
        if (top < -12 || top > metrics.scrollHeight + 12) return null;
        return (
          <span
            key={`vy-${tick.value}`}
            className={`viewport-ruler-tick ${tick.major ? 'is-major' : ''}`}
            style={{ top }}
          >
            {tick.major ? <span className="viewport-ruler-label">{tick.value}</span> : null}
          </span>
        );
      })}
    </div>
  );
}

export function ViewportRulersFrame({
  canvas,
  scale,
  guides,
  onGuidesChange,
  stageShellRef,
  viewportRef,
  children,
}: {
  canvas: { width: number; height: number };
  scale: number;
  guides: UserGuides;
  onGuidesChange: (guides: UserGuides | ((prev: UserGuides) => UserGuides)) => void;
  stageShellRef: React.RefObject<HTMLDivElement | null>;
  viewportRef?: React.RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const { metrics, refreshMetrics } = useStageMetrics(scrollRef, stageShellRef, scale);
  const [dragGuide, setDragGuide] = useState<null | {
    axis: 'vertical' | 'horizontal';
    value: number;
    guideIndex?: number;
  }>(null);

  const stageElement = () => stageShellRef.current?.querySelector('.stage') as HTMLElement | null;

  const startGuideDrag = useCallback((
    event: React.PointerEvent,
    axis: 'vertical' | 'horizontal',
    options: { value?: number; guideIndex?: number } = {},
  ) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    const stage = stageElement();
    if (!stage) return;
    const stageRect = stage.getBoundingClientRect();
    const point = clientToCanvasPoint(event.clientX, event.clientY, stageRect, scale, canvas);
    const value = options.value ?? (axis === 'vertical' ? point.x : point.y);
    setDragGuide({
      axis,
      value,
      guideIndex: options.guideIndex,
    });

    const onMove = (moveEvent: PointerEvent) => {
      const rect = stage.getBoundingClientRect();
      const next = clientToCanvasPoint(moveEvent.clientX, moveEvent.clientY, rect, scale, canvas);
      setDragGuide((current) => (
        current ? { ...current, value: current.axis === 'vertical' ? next.x : next.y } : current
      ));
    };

    const onUp = (upEvent: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      const frameRect = frameRef.current?.getBoundingClientRect();
      const stageRectNow = stage.getBoundingClientRect();
      const pointNow = clientToCanvasPoint(upEvent.clientX, upEvent.clientY, stageRectNow, scale, canvas);

      const droppedOnHorizontalRuler = frameRect
        && upEvent.clientY <= frameRect.top + RULER_SIZE + 4;
      const droppedOnVerticalRuler = frameRect
        && upEvent.clientX <= frameRect.left + RULER_SIZE + 4;
      const droppedOnCanvas = upEvent.clientX >= stageRectNow.left
        && upEvent.clientX <= stageRectNow.right
        && upEvent.clientY >= stageRectNow.top
        && upEvent.clientY <= stageRectNow.bottom;

      setDragGuide(null);

      if (axis === 'vertical') {
        if (droppedOnVerticalRuler) {
          if (options.guideIndex !== undefined) {
            onGuidesChange((prev) => ({
              ...prev,
              vertical: prev.vertical.filter((_, index) => index !== options.guideIndex),
            }));
          }
          return;
        }
        if (droppedOnHorizontalRuler || !droppedOnCanvas) return;
        const nextValue = pointNow.x;
        if (options.guideIndex !== undefined) {
          onGuidesChange((prev) => {
            const vertical = [...prev.vertical];
            vertical[options.guideIndex] = nextValue;
            return { ...prev, vertical };
          });
        } else {
          onGuidesChange((prev) => ({ ...prev, vertical: [...prev.vertical, nextValue] }));
        }
        return;
      }

      if (droppedOnHorizontalRuler) {
        if (options.guideIndex !== undefined) {
          onGuidesChange((prev) => ({
            ...prev,
            horizontal: prev.horizontal.filter((_, index) => index !== options.guideIndex),
          }));
        }
        return;
      }
      if (droppedOnVerticalRuler || !droppedOnCanvas) return;
      const nextValue = pointNow.y;
      if (options.guideIndex !== undefined) {
        onGuidesChange((prev) => {
          const horizontal = [...prev.horizontal];
          horizontal[options.guideIndex] = nextValue;
          return { ...prev, horizontal };
        });
      } else {
        onGuidesChange((prev) => ({ ...prev, horizontal: [...prev.horizontal, nextValue] }));
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  }, [canvas, onGuidesChange, scale, stageShellRef]);

  useEffect(() => {
    refreshMetrics();
  }, [canvas.height, canvas.width, refreshMetrics, scale]);

  const setScrollRef = useCallback((node: HTMLDivElement | null) => {
    scrollRef.current = node;
    if (viewportRef) viewportRef.current = node;
  }, [viewportRef]);

  return (
    <div className="viewport-rulers-frame" ref={frameRef}>
      <div className="viewport-ruler-corner" aria-hidden="true" />
      <HorizontalRuler
        canvasWidth={canvas.width}
        scale={scale}
        metrics={metrics}
        onStartVerticalGuide={(event) => startGuideDrag(event, 'vertical')}
      />
      <VerticalRuler
        canvasHeight={canvas.height}
        scale={scale}
        metrics={metrics}
        onStartHorizontalGuide={(event) => startGuideDrag(event, 'horizontal')}
      />
      <div className="preview-viewport-scroll" ref={setScrollRef}>
        {children}
        <div
          className="user-guides-layer"
          style={{
            left: metrics.shellLeft,
            top: metrics.shellTop,
            width: metrics.shellWidth,
            height: metrics.shellHeight,
          }}
        >
          {dragGuide ? (
            dragGuide.axis === 'vertical' ? (
              <div
                className="user-guide user-guide-v is-dragging"
                style={{ left: dragGuide.value * scale }}
              />
            ) : (
              <div
                className="user-guide user-guide-h is-dragging"
                style={{ top: dragGuide.value * scale }}
              />
            )
          ) : null}
          {!dragGuide && guides.vertical.map((value, index) => (
            <div
              key={`guide-v-${index}-${value}`}
              className="user-guide user-guide-v"
              style={{ left: value * scale }}
              onPointerDown={(event) => startGuideDrag(event, 'vertical', { value, guideIndex: index })}
            />
          ))}
          {!dragGuide && guides.horizontal.map((value, index) => (
            <div
              key={`guide-h-${index}-${value}`}
              className="user-guide user-guide-h"
              style={{ top: value * scale }}
              onPointerDown={(event) => startGuideDrag(event, 'horizontal', { value, guideIndex: index })}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function AlignmentGuides({
  vertical = [],
  horizontal = [],
}: {
  vertical?: number[];
  horizontal?: number[];
}) {
  if (!vertical.length && !horizontal.length) return null;
  return (
    <div className="alignment-guides" aria-hidden="true">
      {vertical.map((x) => (
        <div key={`v-${x}`} className="alignment-guide alignment-guide-v" style={{ left: x }} />
      ))}
      {horizontal.map((y) => (
        <div key={`h-${y}`} className="alignment-guide alignment-guide-h" style={{ top: y }} />
      ))}
    </div>
  );
}

const ALIGN_BUTTONS = [
  { mode: 'left', icon: 'alignLeft', tip: 'Align to left edge of canvas' },
  { mode: 'center-h', icon: 'alignCenterH', tip: 'Centre horizontally on canvas' },
  { mode: 'right', icon: 'alignRight', tip: 'Align to right edge of canvas' },
  { mode: 'top', icon: 'alignTop', tip: 'Align to top edge of canvas' },
  { mode: 'center-v', icon: 'alignCenterV', tip: 'Centre vertically on canvas' },
  { mode: 'bottom', icon: 'alignBottom', tip: 'Align to bottom edge of canvas' },
];

const DISTRIBUTE_BUTTONS = [
  { axis: 'h', icon: 'distributeH', tip: 'Even horizontal spacing between selected items' },
  { axis: 'v', icon: 'distributeV', tip: 'Even vertical spacing between selected items' },
];

export function AlignControls({
  disabled,
  canDistribute = false,
  onAlign,
  onDistribute,
}: {
  disabled?: boolean;
  canDistribute?: boolean;
  onAlign: (mode: string) => void;
  onDistribute?: (axis: 'h' | 'v') => void;
}) {
  return (
    <div className="align-controls" role="group" aria-label="Align and distribute selection">
      <span className="align-controls-heading">Align</span>
      {ALIGN_BUTTONS.map((button) => (
        <button
          key={button.mode}
          type="button"
          className="align-button"
          data-tip={button.tip}
          aria-label={button.tip}
          disabled={disabled}
          onClick={() => onAlign(button.mode)}
        >
          <EditorIcon name={button.icon} />
        </button>
      ))}
      <span className="align-controls-divider" aria-hidden="true" />
      <span className="align-controls-heading">Space</span>
      {DISTRIBUTE_BUTTONS.map((button) => (
        <button
          key={button.axis}
          type="button"
          className="align-button align-button-distribute"
          data-tip={button.tip}
          aria-label={button.tip}
          disabled={disabled || !canDistribute}
          onClick={() => onDistribute?.(button.axis as 'h' | 'v')}
        >
          <EditorIcon name={button.icon} />
        </button>
      ))}
    </div>
  );
}
