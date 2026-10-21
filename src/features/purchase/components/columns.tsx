import type { ColumnDef } from '@tanstack/react-table';
import { formatCurrency } from '@/lib/format';
import { sortableHeader } from '@/components/common/crud-columns';

/** Money column helper. */
export function moneyColumn<T>(
  id: string,
  label: string,
  get: (r: T) => string | null | undefined,
  sortable = true,
): ColumnDef<T, unknown> {
  return {
    id,
    enableSorting: sortable,
    meta: { label, headerClassName: 'text-right', cellClassName: 'text-right tabular-nums' },
    header: sortable ? sortableHeader(label) : label,
    cell: ({ row }) => formatCurrency(get(row.original)),
  };
}
