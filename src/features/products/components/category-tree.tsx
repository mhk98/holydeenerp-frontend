import { useMemo, useState, type ReactNode } from 'react';
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragMoveEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTranslation } from 'react-i18next';
import { ChevronRight, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { CategoryNode } from '@/types';

const INDENT = 28;

export interface FlatNode {
  node: CategoryNode;
  id: string;
  parentId: string | null;
  depth: number;
}

function flatten(nodes: CategoryNode[], collapsed: Set<string>, depth = 0, parentId: string | null = null) {
  const out: FlatNode[] = [];
  for (const node of nodes) {
    out.push({ node, id: node.id, parentId, depth });
    if (!collapsed.has(node.id)) out.push(...flatten(node.children, collapsed, depth + 1, node.id));
  }
  return out;
}

/** Ids of every node under `id` in a flat list. */
function descendantsOf(items: FlatNode[], id: string) {
  const start = items.findIndex((i) => i.id === id);
  const out = new Set<string>();
  if (start < 0) return out;
  for (let i = start + 1; i < items.length && items[i].depth > items[start].depth; i += 1)
    out.add(items[i].id);
  return out;
}

/**
 * Where the dragged item would land: its new depth comes from the horizontal drag offset,
 * limited by its neighbours (at most one level deeper than the item above).
 */
function project(items: FlatNode[], activeId: string, overId: string, offsetX: number) {
  const activeIndex = items.findIndex((i) => i.id === activeId);
  const overIndex = items.findIndex((i) => i.id === overId);
  const moved = arrayMove(items, activeIndex, overIndex);
  const prev = moved[overIndex - 1];
  const next = moved[overIndex + 1];
  const wanted = items[activeIndex].depth + Math.round(offsetX / INDENT);
  const maxDepth = prev ? prev.depth + 1 : 0;
  const minDepth = next ? next.depth : 0;
  const depth = Math.min(Math.max(wanted, minDepth), maxDepth);

  let parentId: string | null = null;
  if (depth > 0 && prev) {
    if (depth === prev.depth + 1) parentId = prev.id;
    else
      parentId =
        moved
          .slice(0, overIndex)
          .reverse()
          .find((i) => i.depth === depth)?.parentId ?? null;
  }
  return { depth, parentId, moved, overIndex };
}

function SortableRow({
  item,
  depth,
  isCollapsed,
  onToggle,
  actions,
  dragLabel,
  disabled,
}: {
  disabled: boolean;
  item: FlatNode;
  depth: number;
  isCollapsed: boolean;
  onToggle: () => void;
  actions: ReactNode;
  dragLabel: string;
}) {
  const { t } = useTranslation();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled,
  });
  const { node } = item;
  const hasChildren = node.children.length > 0;

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition, paddingLeft: depth * INDENT }}
      className={cn('relative', isDragging && 'z-10 opacity-80')}
    >
      <div
        className={cn(
          'group flex items-center gap-1.5 rounded-md border bg-card px-2 py-1.5',
          isDragging && 'shadow-lg ring-2 ring-primary/40',
          !node.isActive && 'opacity-60',
        )}
      >
        {!disabled && (
          <button
            type="button"
            className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none active:cursor-grabbing"
            aria-label={dragLabel}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="size-4" aria-hidden />
          </button>
        )}
        <button
          type="button"
          onClick={onToggle}
          disabled={!hasChildren}
          aria-expanded={hasChildren ? !isCollapsed : undefined}
          aria-label={isCollapsed ? t('products.categories.expand') : t('products.categories.collapse')}
          className="rounded p-0.5 text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:invisible"
        >
          <ChevronRight
            className={cn('size-4 transition-transform', !isCollapsed && 'rotate-90')}
            aria-hidden
          />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate font-medium">{node.name}</span>
          <code className="hidden rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground sm:inline">
            {node.code}
          </code>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
          {t('products.categories.productCount', { count: node.productCount })}
        </span>
        <div className="flex shrink-0 items-center">{actions}</div>
      </div>
    </li>
  );
}

interface CategoryTreeProps {
  tree: CategoryNode[];
  canMove: boolean;
  renderActions: (node: CategoryNode) => ReactNode;
  onMove: (items: { id: string; parentId: string | null; sortOrder: number }[]) => void;
}

/**
 * Drag & drop category tree (dnd-kit). Drag vertically to reorder, horizontally to change the
 * level. Keyboard users can reorder with Space + arrow keys, or change the parent in the form.
 */
export function CategoryTree({ tree, canMove, renderActions, onMove }: CategoryTreeProps) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [offsetX, setOffsetX] = useState(0);

  const flat = useMemo(() => flatten(tree, collapsed), [tree, collapsed]);
  // While dragging, the active item's subtree travels with it.
  const items = useMemo(() => {
    if (!activeId) return flat;
    const hidden = descendantsOf(flat, activeId);
    return flat.filter((i) => !hidden.has(i.id));
  }, [flat, activeId]);
  const projected = activeId && overId ? project(items, activeId, overId, offsetX) : null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const resetDrag = () => {
    setActiveId(null);
    setOverId(null);
    setOffsetX(0);
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const result = over ? project(items, String(active.id), String(over.id), offsetX) : null;
    resetDrag();
    if (!result) return;
    const { depth, parentId, moved, overIndex } = result;
    const current = items.find((i) => i.id === active.id);
    if (current && current.parentId === parentId && current.depth === depth && active.id === over?.id) return;

    moved[overIndex] = { ...moved[overIndex], parentId, depth };
    // New sort order: position among siblings in the moved flat list.
    const counters = new Map<string, number>();
    const updates = moved.map((i) => {
      const key = i.parentId ?? 'root';
      const sortOrder = counters.get(key) ?? 0;
      counters.set(key, sortOrder + 1);
      return { id: i.id, parentId: i.parentId, sortOrder };
    });
    const changed = updates.filter((u) => {
      const before = flat.find((f) => f.id === u.id)?.node;
      return !before || before.parentId !== u.parentId || before.sortOrder !== u.sortOrder;
    });
    if (changed.length) onMove(changed);
  };

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={({ active }: DragStartEvent) => {
        setActiveId(String(active.id));
        setOverId(String(active.id));
      }}
      onDragMove={({ delta }: DragMoveEvent) => setOffsetX(delta.x)}
      onDragOver={({ over }) => setOverId(over ? String(over.id) : null)}
      onDragEnd={onDragEnd}
      onDragCancel={resetDrag}
    >
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ul className="flex flex-col gap-1.5" aria-label={t('products.categories.title')}>
          {items.map((item) => (
            <SortableRow
              key={item.id}
              item={item}
              depth={item.id === activeId && projected ? projected.depth : item.depth}
              isCollapsed={collapsed.has(item.id)}
              onToggle={() => toggle(item.id)}
              actions={renderActions(item.node)}
              dragLabel={t('products.categories.drag', { name: item.node.name })}
              disabled={!canMove}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
