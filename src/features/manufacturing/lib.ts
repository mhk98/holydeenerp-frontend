import type { StatusTone } from '@/components/common/status-badge';
import type { BomStatus, MoStatus, Priority } from './types';

export const MFG_ROUTES = {
  orders: '/manufacturing/orders',
  boms: '/manufacturing/boms',
  workCenters: '/manufacturing/work-centers',
  mrp: '/manufacturing/mrp',
  board: '/manufacturing/board',
  schedule: '/manufacturing/schedule',
  reports: '/manufacturing/reports',
} as const;

export const MO_STATUSES: MoStatus[] = [
  'draft',
  'confirmed',
  'material_issued',
  'in_progress',
  'quality_check',
  'completed',
  'closed',
  'cancelled',
];
/** The happy path, for the stepper. */
export const MO_FLOW: MoStatus[] = MO_STATUSES.filter((s) => s !== 'cancelled');
export const PRIORITIES: Priority[] = ['low', 'normal', 'high', 'urgent'];

export const MO_TONE: Record<MoStatus, StatusTone> = {
  draft: 'neutral',
  confirmed: 'info',
  material_issued: 'info',
  in_progress: 'warning',
  quality_check: 'warning',
  completed: 'success',
  closed: 'success',
  cancelled: 'danger',
};
export const BOM_TONE: Record<BomStatus, StatusTone> = {
  draft: 'neutral',
  active: 'success',
  archived: 'danger',
};
export const PRIORITY_TONE: Record<Priority, StatusTone> = {
  low: 'neutral',
  normal: 'info',
  high: 'warning',
  urgent: 'danger',
};

export const productLabel = (p?: { name: string } | null, v?: { name: string } | null) =>
  p ? (v ? `${p.name} — ${v.name}` : p.name) : '—';

/** Minutes as "1 h 30 m". */
export function minutesLabel(value: string | number) {
  const total = Math.round(Number(value) || 0);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h ? (m ? `${h} h ${m} m` : `${h} h`) : `${m} m`;
}
