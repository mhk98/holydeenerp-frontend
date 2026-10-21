import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ClipboardList } from 'lucide-react';
import { useListParams } from '@/hooks/use-list-params';
import { formatCurrency, formatDate } from '@/lib/format';
import { useSettingsStore } from '@/stores/settings-store';
import type { CountStatus, StockCount } from '@/types';
import { Can } from '@/components/common/can';
import { sortableHeader } from '@/components/common/crud-columns';
import { DataTable } from '@/components/common/data-table/data-table';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { flattenTree, useCategoryTree } from '@/features/products/api/products-api';
import { countsApi } from '../api/inventory-api';
import { DocStatusBadge } from '../components/inventory-badges';
import { WarehouseSelect } from '../components/warehouse-select';
import { todayIn } from '../schemas';

const STATUSES: CountStatus[] = ['counting', 'pending_approval', 'posted', 'rejected', 'cancelled'];
const ALL = '__all__';

function NewCountDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const timezone = useSettingsStore((s) => s.timezone);
  const categories = useCategoryTree();
  const save = countsApi.useSave();
  const [warehouseId, setWarehouseId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string>(ALL);
  const [countDate, setCountDate] = useState(() => todayIn(timezone));
  const [includeZero, setIncludeZero] = useState(false);
  const [notes, setNotes] = useState('');

  const create = () =>
    save.mutate(
      {
        data: {
          warehouseId,
          countDate,
          categoryId: categoryId === ALL ? null : categoryId,
          includeZero,
          notes: notes.trim() || null,
        },
      },
      {
        onSuccess: (doc) => {
          toast.success(t('inventory.counts.created', { count: doc.items?.length ?? 0 }));
          navigate(`/inventory/counts/${doc.id}`);
        },
        onError: (err) => toast.error(err.message),
      },
    );

  return (
    <Dialog open={open} onOpenChange={(o) => !save.isPending && onOpenChange(o)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('inventory.counts.new')}</DialogTitle>
          <DialogDescription>{t('inventory.counts.newHint')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>{t('inventory.warehouse')}</Label>
            <WarehouseSelect value={warehouseId} onChange={setWarehouseId} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="count-date">{t('inventory.date')}</Label>
              <Input
                id="count-date"
                type="date"
                value={countDate}
                onChange={(e) => setCountDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label>{t('products.category')}</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>{t('inventory.counts.allCategories')}</SelectItem>
                  {flattenTree(categories.data ?? []).map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.path}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch id="count-zero" checked={includeZero} onCheckedChange={setIncludeZero} />
            <Label htmlFor="count-zero" className="flex flex-col items-start gap-0.5">
              <span>{t('inventory.counts.includeZero')}</span>
              <span className="text-xs font-normal text-muted-foreground">
                {t('inventory.counts.includeZeroHint')}
              </span>
            </Label>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="count-notes">{t('inventory.notes')}</Label>
            <Textarea id="count-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={save.isPending}>
            {t('common.cancel')}
          </Button>
          <Button onClick={create} disabled={!warehouseId || !countDate || save.isPending}>
            {save.isPending && <Spinner />} {t('inventory.counts.generate')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Physical inventory counts. */
export default function CountsPage() {
  const { t } = useTranslation();
  const list = useListParams({ defaultSort: '-createdAt', filterKeys: ['status', 'warehouseId'] });
  const query = countsApi.useList(list.query);
  const [creating, setCreating] = useState(false);

  const columns = useMemo<ColumnDef<StockCount, unknown>[]>(
    () => [
      {
        id: 'number',
        enableHiding: false,
        meta: { label: t('inventory.number') },
        header: sortableHeader(t('inventory.number')),
        cell: ({ row: { original: c } }) => (
          <Link to={`/inventory/counts/${c.id}`} className="font-mono text-sm font-medium hover:underline">
            {c.number}
          </Link>
        ),
      },
      {
        id: 'countDate',
        meta: { label: t('inventory.date'), cellClassName: 'whitespace-nowrap' },
        header: sortableHeader(t('inventory.date')),
        cell: ({ row }) => formatDate(row.original.countDate),
      },
      {
        id: 'warehouse',
        enableSorting: false,
        meta: { label: t('inventory.warehouse') },
        header: t('inventory.warehouse'),
        cell: ({ row }) => row.original.warehouse?.name,
      },
      {
        id: 'scope',
        enableSorting: false,
        meta: { label: t('products.category') },
        header: t('products.category'),
        cell: ({ row }) => row.original.category?.name ?? t('inventory.counts.allCategories'),
      },
      {
        id: 'progress',
        enableSorting: false,
        meta: {
          label: t('inventory.counts.progress'),
          headerClassName: 'text-right',
          cellClassName: 'text-right tabular-nums',
        },
        header: t('inventory.counts.progress'),
        cell: ({ row }) => `${row.original.countedCount ?? 0} / ${row.original.itemsCount ?? 0}`,
      },
      {
        id: 'varianceValue',
        meta: {
          label: t('inventory.counts.variance'),
          headerClassName: 'text-right',
          cellClassName: 'text-right tabular-nums',
        },
        header: sortableHeader(t('inventory.counts.variance')),
        cell: ({ row }) =>
          row.original.status === 'posted' ? formatCurrency(row.original.varianceValue) : '—',
      },
      {
        id: 'status',
        enableSorting: false,
        meta: { label: t('common.status') },
        header: t('common.status'),
        cell: ({ row }) => <DocStatusBadge status={row.original.status} />,
      },
      {
        id: 'creator',
        enableSorting: false,
        meta: { label: t('inventory.createdBy'), cellClassName: 'text-muted-foreground' },
        header: t('inventory.createdBy'),
        cell: ({ row }) => row.original.creator?.name ?? '—',
      },
    ],
    [t],
  );

  const newButton = (
    <Can permission="inventory.create">
      <Button onClick={() => setCreating(true)}>
        <ClipboardList aria-hidden /> {t('inventory.counts.new')}
      </Button>
    </Can>
  );

  return (
    <>
      <PageHeader
        title={t('inventory.counts.title')}
        description={t('inventory.counts.description')}
        breadcrumbs={[{ label: t('nav.inventory') }, { label: t('inventory.counts.title') }]}
        actions={newButton}
      />
      <DataTable
        storageKey="inventory-counts"
        columns={columns}
        data={query.data?.rows}
        total={query.data?.meta.total ?? 0}
        loading={query.isPending}
        fetching={query.isFetching}
        list={list}
        getRowId={(r) => r.id}
        searchPlaceholder={t('inventory.searchDocuments')}
        filters={[
          {
            key: 'status',
            label: t('common.status'),
            options: STATUSES.map((s) => ({ value: s, label: t(`inventory.status.${s}`) })),
          },
        ]}
        toolbarActions={
          <WarehouseSelect
            allowAll
            value={list.state.filters.warehouseId ?? null}
            onChange={(id) => list.setState({ filters: { warehouseId: id ?? '' } })}
            className="sm:w-56"
            aria-label={t('inventory.warehouse')}
          />
        }
        empty={{
          title: t('inventory.counts.empty'),
          description: t('inventory.counts.emptyText'),
          action: newButton,
        }}
      />
      {creating && <NewCountDialog open={creating} onOpenChange={setCreating} />}
    </>
  );
}
