import type { Column, ColumnDef } from '@tanstack/react-table';
import { DataTableColumnHeader } from '@/components/common/data-table/data-table-column-header';
import { StatusBadge } from '@/components/common/status-badge';

/** Sortable column header shortcut: `header: sortableHeader(t('…'))`. The column id is the sort key. */
export function sortableHeader<T>(title: string) {
  return ({ column }: { column: Column<T, unknown> }) => (
    <DataTableColumnHeader column={column} title={title} />
  );
}

/** Standard "Active / Inactive" column for resources with isActive. */
export function activeColumn<T extends { isActive: boolean }>(
  t: (k: string) => string,
): ColumnDef<T, unknown> {
  return {
    id: 'isActive',
    meta: { label: t('common.status') },
    enableSorting: false,
    header: t('common.status'),
    cell: ({ row }) => (
      <StatusBadge tone={row.original.isActive ? 'success' : 'neutral'}>
        {row.original.isActive ? t('common.active') : t('common.inactive')}
      </StatusBadge>
    ),
  };
}

/** Monospace code cell. */
export function codeCell<T>(get: (row: T) => string | null | undefined) {
  return ({ row }: { row: { original: T } }) => (
    <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{get(row.original) ?? '—'}</code>
  );
}
