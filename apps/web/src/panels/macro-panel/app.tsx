/**
 * MacroPanel workspace app registration.
 *
 * linkable: false — macro series are not tied to the equity symbol bus.
 * The active series is persisted in panel props via updateProps.
 */
import { type JSX } from 'react';
import { BarChart } from 'lucide-react';

import type { PanelApp, PanelProps } from '@/workspace/types';

import { MacroPanel } from './MacroPanel';

/** Default FRED series for new MacroPanel instances. */
const DEFAULT_MACRO_SERIES = 'GDP';

/** Serialisable per-instance state for a MacroPanel tile. */
export interface MacroPanelProps {
  seriesId: string;
}

function isMacroPanelProps(v: unknown): v is Partial<MacroPanelProps> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const obj = v as Record<string, unknown>;
  if ('seriesId' in obj && typeof obj['seriesId'] !== 'string') return false;
  return true;
}

function MacroPanelWorkspace({
  panelId,
  isActive,
  onClose,
  props,
  updateProps,
}: PanelProps<MacroPanelProps>): JSX.Element {
  return (
    <MacroPanel
      panelId={panelId}
      isActive={isActive}
      onClose={onClose}
      seriesId={props.seriesId}
      onSeriesChange={(id) => updateProps({ seriesId: id })}
    />
  );
}

export const macroPanelApp: PanelApp<MacroPanelProps> = {
  id: 'macro',
  displayName: 'Macro',
  icon: BarChart,
  defaultProps: { seriesId: DEFAULT_MACRO_SERIES },
  linkable: false,
  serialize: (props): string => JSON.stringify(props),
  deserialize: (raw): MacroPanelProps => {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isMacroPanelProps(parsed)) {
        console.warn('[macro-panel] Corrupted stored props — using defaults', parsed);
        return { seriesId: DEFAULT_MACRO_SERIES };
      }
      return { seriesId: parsed.seriesId ?? DEFAULT_MACRO_SERIES };
    } catch {
      return { seriesId: DEFAULT_MACRO_SERIES };
    }
  },
  Component: MacroPanelWorkspace,
};
