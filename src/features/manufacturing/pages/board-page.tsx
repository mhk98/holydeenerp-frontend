import { useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { CalendarDays, GripVertical, Plus } from 'lucide-react';
import { usePermission } from '@/hooks/use-permission';
import { formatDate, formatQuantity } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Can } from '@/components/common/can';
import { PageHeader } from '@/components/common/page-header';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BOARD_STATUSES, useBoard, useOrderAction, type OrderStep } from '../api/manufacturing-api';
import { MFG_ROUTES, MO_TONE, PRIORITY_TONE, productLabel } from '../lib';
import type { ManufacturingOrder, MoStatus } from '../types';

/** Moves that need no input on the board; anything else opens the order. */
const MOVES: Partial<Record<MoStatus, Partial<Record<MoStatus, { step: OrderStep; permission: string }>>>> = {
  draft: { confirmed: { step: 'confirm', permission: 'manufacturing.approve' } },
  confirmed: {
    material_issued: { step: 'issue', permission: 'manufacturing.update' },
    in_progress: { step: 'start', permission: 'manufacturing.update' },
  },
  material_issued: { in_progress: { step: 'start', permission: 'manufacturing.update' } },
};

function Card({ mo, dragging }: { mo: ManufacturingOrder; dragging?: boolean }) {
  const { t } = useTranslation();
  const late =
    !['completed', 'closed'].includes(mo.status) && mo.plannedEnd < new Date().toISOString().slice(0, 10);
  return (
    <div
      className={cn(
        'flex flex-col gap-1.5 rounded-md border bg-card p-3 text-sm shadow-xs',
        dragging && 'rotate-1 shadow-lg ring-2 ring-primary',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <Link to={`${MFG_ROUTES.orders}/${mo.id}`} className="font-mono text-xs font-medium hover:underline">
          {mo.number}
        </Link>
        <StatusBadge tone={PRIORITY_TONE[mo.priority]}>
          {t(`manufacturing.priorities.${mo.priority}`)}
        </StatusBadge>
      </div>
      <div className="leading-snug font-medium">{productLabel(mo.product, mo.variant)}</div>
      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="tabular-nums">× {formatQuantity(mo.quantity)}</span>
        <span className={cn('flex items-center gap-1', late && 'font-medium text-destructive')}>
          <CalendarDays className="size-3" aria-hidden />
          {formatDate(mo.plannedEnd)}
        </span>
      </div>
    </div>
  );
}

function DraggableCard({ mo }: { mo: ManufacturingOrder }) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: mo.id, data: { mo } });
  return (
    <div ref={setNodeRef} className={cn('group relative', isDragging && 'opacity-40')}>
      <button
        type="button"
        {...listeners}
        {...attributes}
        className="absolute top-2 -left-1 hidden cursor-grab rounded p-0.5 text-muted-foreground group-hover:block focus-visible:block focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-label={t('manufacturing.board.move', { number: mo.number })}
      >
        <GripVertical className="size-3.5" aria-hidden />
      </button>
      <Card mo={mo} />
    </div>
  );
}

function Column({
  status,
  rows,
  total,
  active,
}: {
  status: (typeof BOARD_STATUSES)[number];
  rows: ManufacturingOrder[];
  total: number;
  active: ManufacturingOrder | null;
}) {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const allowed = active ? Boolean(MOVES[active.status]?.[status]) : false;
  return (
    <section
      ref={setNodeRef}
      aria-label={t(`manufacturing.status.${status}`)}
      className={cn(
        'flex w-72 shrink-0 flex-col gap-2 rounded-lg border bg-muted/40 p-2',
        active && allowed && 'border-dashed border-primary',
        isOver && allowed && 'bg-primary/5',
      )}
    >
      <header className="flex items-center justify-between px-1 py-0.5">
        <StatusBadge tone={MO_TONE[status]}>{t(`manufacturing.status.${status}`)}</StatusBadge>
        <span className="text-xs text-muted-foreground tabular-nums">{total}</span>
      </header>
      <div className="flex min-h-24 flex-col gap-2">
        {rows.map((mo) => (
          <DraggableCard key={mo.id} mo={mo} />
        ))}
        {!rows.length && (
          <p className="px-1 py-6 text-center text-xs text-muted-foreground">
            {t('manufacturing.board.emptyColumn')}
          </p>
        )}
      </div>
    </section>
  );
}

/** Kanban of open orders by status; drag a card to confirm, issue materials or start production. */
export default function BoardPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = usePermission();
  const board = useBoard();
  const action = useOrderAction();
  const [active, setActive] = useState<ManufacturingOrder | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const onDragEnd = ({ active: a, over }: DragEndEvent) => {
    setActive(null);
    const mo = a.data.current?.mo as ManufacturingOrder | undefined;
    const target = over?.id as MoStatus | undefined;
    if (!mo || !target || target === mo.status) return;
    const move = MOVES[mo.status]?.[target];
    if (!move) {
      toast.info(t('manufacturing.board.openToContinue', { number: mo.number }), {
        action: { label: t('common.view'), onClick: () => navigate(`${MFG_ROUTES.orders}/${mo.id}`) },
      });
      return;
    }
    if (!can(move.permission)) {
      toast.error(t('manufacturing.board.noPermission'));
      return;
    }
    action.mutate(
      { id: mo.id, step: move.step, body: move.step === 'issue' ? {} : undefined },
      {
        onSuccess: () => toast.success(t(`manufacturing.toast.${move.step}`)),
        onError: (err) => toast.error(err.message),
      },
    );
  };

  return (
    <>
      <PageHeader
        title={t('manufacturing.board.title')}
        description={t('manufacturing.board.description')}
        breadcrumbs={[{ label: t('nav.manufacturing') }, { label: t('manufacturing.board.title') }]}
        actions={
          <Can permission="manufacturing.create">
            <Button asChild>
              <Link to={`${MFG_ROUTES.orders}/new`}>
                <Plus aria-hidden /> {t('manufacturing.orders.new')}
              </Link>
            </Button>
          </Can>
        }
      />
      {board.isPending ? (
        <div className="flex gap-3 overflow-hidden">
          {BOARD_STATUSES.map((s) => (
            <Skeleton key={s} className="h-80 w-72 shrink-0" />
          ))}
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={(e) => setActive((e.active.data.current?.mo as ManufacturingOrder) ?? null)}
          onDragCancel={() => setActive(null)}
          onDragEnd={onDragEnd}
        >
          <div className="flex gap-3 overflow-x-auto pb-4" aria-busy={action.isPending}>
            {BOARD_STATUSES.map((s) => (
              <Column
                key={s}
                status={s}
                rows={board.data?.[s].rows ?? []}
                total={board.data?.[s].meta.total ?? 0}
                active={active}
              />
            ))}
          </div>
          <DragOverlay>{active && <Card mo={active} dragging />}</DragOverlay>
        </DndContext>
      )}
    </>
  );
}
