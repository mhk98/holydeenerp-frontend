import type { Column } from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

/** Sortable column header. The column id is the server sort key. */
export function DataTableColumnHeader<T>({
  column,
  title,
  className,
}: {
  column: Column<T, unknown>;
  title: string;
  className?: string;
}) {
  const { t } = useTranslation();
  if (!column.getCanSort()) return <span className={className}>{title}</span>;

  const sorted = column.getIsSorted();
  const Icon = sorted === 'asc' ? ArrowUp : sorted === 'desc' ? ArrowDown : ChevronsUpDown;
  const next = sorted === 'asc' ? t('table.sortDesc') : t('table.sortAsc');

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn('-ml-2.5 h-8 data-[sorted=true]:text-foreground', className)}
      data-sorted={Boolean(sorted)}
      onClick={() => column.toggleSorting(sorted === 'asc')}
      aria-label={`${title}: ${next}`}
    >
      {title}
      <Icon className={cn('size-3.5', !sorted && 'opacity-40')} aria-hidden />
    </Button>
  );
}
