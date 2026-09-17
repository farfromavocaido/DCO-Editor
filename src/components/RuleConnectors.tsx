'use client';

import { useRef, useState } from 'react';
import type { PointerEvent } from 'react';
import styles from './LayoutRulesPanel.module.css';

export type RuleConnector = {
  ruleId: string;
  label: string;
  axis: 'x' | 'y';
  gap: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
  active: boolean;
};

type InkBounds = { left: number; top: number; width: number; height: number };
export type RuleConnectorDiagnostic = { id: string; targetId: string; status: string; axis?: 'x' | 'y'; targetEdge?: 'start' | 'center' | 'end'; referenceEdge?: 'start' | 'center' | 'end'; targetInk?: InkBounds; referenceInk?: InkBounds; gap?: number };

export function connectorsFromDiagnostics(diagnostics: RuleConnectorDiagnostic[]): RuleConnector[] {
  const edge = (box: InkBounds, axis: 'x' | 'y', at = 'start') => (axis === 'x' ? box.left : box.top) + (axis === 'x' ? box.width : box.height) * (at === 'end' ? 1 : at === 'center' ? .5 : 0);
  return diagnostics.flatMap(item => {
    if (item.status !== 'active' || !item.axis || !item.targetInk || !item.referenceInk) return [];
    const cross = item.axis === 'x' ? item.targetInk.top + item.targetInk.height / 2 : item.targetInk.left + item.targetInk.width / 2;
    const source = edge(item.referenceInk, item.axis, item.referenceEdge);
    const target = edge(item.targetInk, item.axis, item.targetEdge);
    return [{ ruleId: item.id, label: item.targetId, axis: item.axis, gap: item.gap ?? target - source, active: true, from: item.axis === 'x' ? { x: source, y: cross } : { x: cross, y: source }, to: item.axis === 'x' ? { x: target, y: cross } : { x: cross, y: target } }];
  });
}

type Props = {
  width: number;
  height: number;
  zoom?: number;
  scaledParent?: boolean;
  connectors?: RuleConnector[];
  diagnostics?: RuleConnectorDiagnostic[];
  selectedRuleId?: string | null;
  onSelectRule?: (ruleId: string) => void;
  onGapChange: (ruleId: string, gap: number) => void;
};

/** Annotation only: all coordinates come from the production renderer's ink diagnostics. */
export function RuleConnectors({ width, height, zoom = 1, scaledParent = false, connectors, diagnostics = [], selectedRuleId, onSelectRule, onGapChange }: Props) {
  const [dragValue, setDragValue] = useState<{ id: string; value: number } | null>(null);
  const displayedConnectors = connectors || connectorsFromDiagnostics(diagnostics);
  const drag = useRef<{ id: string; axis: 'x' | 'y'; origin: number; gap: number; value: number } | null>(null);
  function start(event: PointerEvent<SVGGElement>, connector: RuleConnector) {
    event.preventDefault();
    event.stopPropagation();
    onSelectRule?.(connector.ruleId);
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: connector.ruleId, axis: connector.axis, origin: connector.axis === 'x' ? event.clientX : event.clientY, gap: connector.gap, value: connector.gap };
  }
  return <svg className={styles.connectors} width={width * (scaledParent ? 1 : zoom)} height={height * (scaledParent ? 1 : zoom)} viewBox={`0 0 ${width} ${height}`} aria-label="Responsive layout spacing">
    {displayedConnectors.filter(connector => connector.active && connector.ruleId === selectedRuleId).map(connector => {
      const x = (connector.from.x + connector.to.x) / 2;
      const y = (connector.from.y + connector.to.y) / 2;
      return <g key={connector.ruleId} className={styles.connector}>
        <line x1={connector.from.x} y1={connector.from.y} x2={connector.to.x} y2={connector.to.y} />
        {[connector.from, connector.to].map((point, index) => <line key={index} x1={point.x - (connector.axis === 'y' ? 5 : 0)} x2={point.x + (connector.axis === 'y' ? 5 : 0)} y1={point.y - (connector.axis === 'x' ? 5 : 0)} y2={point.y + (connector.axis === 'x' ? 5 : 0)} />)}
        <g className={styles.connectorHandle} role="slider" tabIndex={0} aria-label={`${connector.label} gap`} aria-valuenow={connector.gap} aria-valuetext={`${connector.gap} pixels`} aria-orientation={connector.axis === 'x' ? 'horizontal' : 'vertical'}
          onPointerDown={event => start(event, connector)}
          onPointerMove={event => {
            const current = drag.current;
            if (!current || current.id !== connector.ruleId) return;
            event.stopPropagation();
            current.value = Math.round((current.gap + ((current.axis === 'x' ? event.clientX : event.clientY) - current.origin) / zoom) * 10) / 10;
            setDragValue({ id: current.id, value: current.value });
          }}
          onPointerUp={event => {
            const current = drag.current;
            if (!current) return;
            event.stopPropagation();
            drag.current = null;
            setDragValue(null);
            event.currentTarget.releasePointerCapture(event.pointerId);
            if (current.value !== current.gap) onGapChange(current.id, current.value);
          }}
          onPointerCancel={() => { drag.current = null; setDragValue(null); }}
          onKeyDown={event => {
            if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
            event.preventDefault(); event.stopPropagation();
            onGapChange(connector.ruleId, connector.gap + (['ArrowRight', 'ArrowDown'].includes(event.key) ? 1 : -1) * (event.shiftKey ? 10 : 1));
          }}>
          <title>Drag to adjust spacing, or use arrow keys. Shift changes 10 px.</title>
          <rect x={x - 27} y={y - 10} width={54} height={20} rx={4} />
          <text x={x} y={y + 3}>{dragValue?.id === connector.ruleId ? dragValue.value : connector.gap} px</text>
        </g>
      </g>;
    })}
  </svg>;
}
