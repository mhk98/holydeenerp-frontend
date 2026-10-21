import { useTranslation } from 'react-i18next';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { formatNumber } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const PAGE_SIZES = [10, 20, 50, 100];

interface Props {
  page: number;
  limit: number;
  total: number;
  selected?: number;
  onChange: (patch: { page?: number; limit?: number }) => void;
}

export function DataTablePagination({ page, limit, total, selected = 0, onChange }: Props) {
  const { t } = useTranslation();
  const pages = Math.max(1, Math.ceil(total / limit));
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="flex flex-col-reverse gap-3 px-1 pt-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-muted-foreground" aria-live="polite">
        {selected > 0
          ? t('table.selected', { count: selected })
          : t('table.range', { from: formatNumber(from), to: formatNumber(to), total: formatNumber(total) })}
      </p>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground" id="rows-per-page">
            {t('table.rowsPerPage')}
          </span>
          <Select value={String(limit)} onValueChange={(v) => onChange({ limit: Number(v) })}>
            <SelectTrigger size="sm" className="w-18" aria-labelledby="rows-per-page">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((size) => (
                <SelectItem key={size} value={String(size)}>
                  {size}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <span className="text-muted-foreground">
          {t('table.pageOf', { page: formatNumber(page), pages: formatNumber(pages) })}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onChange({ page: 1 })}
            disabled={page <= 1}
            aria-label={t('table.first')}
          >
            <ChevronsLeft aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onChange({ page: page - 1 })}
            disabled={page <= 1}
            aria-label={t('table.previous')}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onChange({ page: page + 1 })}
            disabled={page >= pages}
            aria-label={t('table.next')}
          >
            <ChevronRight aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="icon-sm"
            onClick={() => onChange({ page: pages })}
            disabled={page >= pages}
            aria-label={t('table.last')}
          >
            <ChevronsRight aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}
