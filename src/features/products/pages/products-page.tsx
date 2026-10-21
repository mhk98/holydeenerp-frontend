import { useMemo, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Barcode, ImageOff, MoreHorizontal, Pencil, Plus, Printer, Trash2 } from 'lucide-react';
import { useListParams } from '@/hooks/use-list-params';
import { usePermission } from '@/hooks/use-permission';
import { assetUrl } from '@/lib/api';
import { formatCurrency } from '@/lib/format';
import type { Product } from '@/types';
import { Can } from '@/components/common/can';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { activeColumn, codeCell, sortableHeader } from '@/components/common/crud-columns';
import { DataTable } from '@/components/common/data-table/data-table';
import { ExcelMenu } from '@/components/common/import-dialog';
import { PageHeader } from '@/components/common/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { brandsResource, flattenTree, productsResource, useCategoryTree } from '../api/products-api';
import { PRODUCT_TYPES } from '../schemas';

export function ProductThumb({ url }: { url: string | null }) {
  return url ? (
    <img src={assetUrl(url)} alt="" className="size-9 shrink-0 rounded-md border bg-white object-cover" />
  ) : (
    <span className="grid size-9 shrink-0 place-items-center rounded-md border bg-muted text-muted-foreground">
      <ImageOff className="size-4" aria-hidden />
    </span>
  );
}

export default function ProductsPage() {
  const { t } = useTranslation();
  const { can } = usePermission();
  const navigate = useNavigate();
  const filterKeys = ['type', 'categoryId', 'brandId', 'isActive'];
  const list = useListParams({ defaultSort: 'name', filterKeys });
  const query = productsResource.useList(list.query);
  const remove = productsResource.useRemove();
  const categories = useCategoryTree();
  const brands = brandsResource.useOptions();
  const [toDelete, setToDelete] = useState<Product | null>(null);

  const printLabels = (ids: string[]) => navigate(`/inventory/labels?ids=${ids.join(',')}`);

  const columns = useMemo<ColumnDef<Product, unknown>[]>(
    () => [
      {
        id: 'name',
        enableHiding: false,
        meta: { label: t('fields.name') },
        header: sortableHeader(t('fields.name')),
        cell: ({ row: { original: p } }) => (
          <div className="flex min-w-56 items-center gap-2.5">
            <ProductThumb url={p.imageUrl} />
            <div className="min-w-0">
              <Link
                to={`/inventory/products/${p.id}`}
                className="line-clamp-1 font-medium hover:underline focus-visible:underline focus-visible:outline-none"
              >
                {p.name}
              </Link>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {p.barcode && (
                  <span className="inline-flex items-center gap-1 font-mono">
                    <Barcode className="size-3" aria-hidden />
                    {p.barcode}
                  </span>
                )}
                {p.hasVariants && (
                  <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-normal">
                    {t('products.hasVariants')}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        ),
      },
      {
        id: 'sku',
        meta: { label: t('products.sku') },
        header: sortableHeader(t('products.sku')),
        cell: codeCell((p) => p.sku),
      },
      {
        id: 'type',
        enableSorting: false,
        meta: { label: t('fields.type') },
        header: t('fields.type'),
        cell: ({ row }) => t(`products.types.${row.original.type}`),
      },
      {
        id: 'category',
        enableSorting: false,
        meta: { label: t('products.category') },
        header: t('products.category'),
        cell: ({ row }) => row.original.category?.name ?? '—',
      },
      {
        id: 'brand',
        enableSorting: false,
        meta: { label: t('products.brand') },
        header: t('products.brand'),
        cell: ({ row }) => row.original.brand?.name ?? '—',
      },
      {
        id: 'unit',
        enableSorting: false,
        meta: { label: t('products.unit') },
        header: t('products.unit'),
        cell: ({ row }) => row.original.baseUnit?.code ?? '—',
      },
      {
        id: 'purchasePrice',
        meta: {
          label: t('products.purchasePrice'),
          headerClassName: 'text-right',
          cellClassName: 'text-right tabular-nums',
        },
        header: sortableHeader(t('products.purchasePrice')),
        cell: ({ row }) => formatCurrency(row.original.purchasePrice),
      },
      {
        id: 'salePrice',
        meta: {
          label: t('products.salePrice'),
          headerClassName: 'text-right',
          cellClassName: 'text-right font-medium tabular-nums',
        },
        header: sortableHeader(t('products.salePrice')),
        cell: ({ row }) => formatCurrency(row.original.salePrice),
      },
      activeColumn(t),
      {
        id: 'actions',
        enableHiding: false,
        enableSorting: false,
        meta: { headerClassName: 'w-12', cellClassName: 'text-right' },
        header: () => <span className="sr-only">{t('common.actions')}</span>,
        cell: ({ row: { original: p } }) => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label={t('common.actionsFor', { name: p.name })}>
                <MoreHorizontal aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => navigate(`/inventory/products/${p.id}`)}>
                <Pencil aria-hidden /> {can('products.update') ? t('common.edit') : t('common.view')}
              </DropdownMenuItem>
              <Can permission="products.print">
                <DropdownMenuItem onSelect={() => printLabels([p.id])}>
                  <Printer aria-hidden /> {t('products.printLabels')}
                </DropdownMenuItem>
              </Can>
              <Can permission="products.delete">
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onSelect={() => setToDelete(p)}>
                  <Trash2 aria-hidden /> {t('common.delete')}
                </DropdownMenuItem>
              </Can>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- navigate/printLabels are stable
    [t, can],
  );

  const newButton = (
    <Can permission="products.create">
      <Button asChild>
        <Link to="/inventory/products/new">
          <Plus aria-hidden /> {t('crud.new', { entity: t('products.entity') })}
        </Link>
      </Button>
    </Can>
  );

  return (
    <>
      <PageHeader
        title={t('products.title')}
        description={t('products.description')}
        breadcrumbs={[{ label: t('nav.inventory') }, { label: t('products.title') }]}
        actions={
          <div className="flex items-center gap-2">
            <ExcelMenu
              url="/products"
              entities={t('products.entities')}
              permission="products"
              invalidate={['products', 'product-categories']}
              exportParams={list.query}
            />
            {newButton}
          </div>
        }
      />
      <DataTable
        storageKey="products"
        columns={columns}
        data={query.data?.rows}
        total={query.data?.meta.total ?? 0}
        loading={query.isPending}
        fetching={query.isFetching}
        list={list}
        getRowId={(r) => r.id}
        searchPlaceholder={t('products.searchPlaceholder')}
        filters={[
          {
            key: 'type',
            label: t('fields.type'),
            options: PRODUCT_TYPES.map((v) => ({ value: v, label: t(`products.types.${v}`) })),
          },
          {
            key: 'categoryId',
            label: t('products.category'),
            options: flattenTree(categories.data ?? []).map((o) => ({ value: o.value, label: o.path })),
          },
          {
            key: 'brandId',
            label: t('products.brand'),
            options: (brands.data ?? []).map((b) => ({ value: b.id, label: b.name })),
          },
          {
            key: 'isActive',
            label: t('common.status'),
            options: [
              { value: 'true', label: t('common.active') },
              { value: 'false', label: t('common.inactive') },
            ],
          },
        ]}
        bulkActions={
          can('products.print')
            ? (rows, clear) => (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    printLabels(rows.map((r) => r.id));
                    clear();
                  }}
                >
                  <Printer aria-hidden /> {t('products.printLabels')}
                </Button>
              )
            : undefined
        }
        exporter={
          can('products.export')
            ? {
                filename: 'products',
                title: t('products.title'),
                columns: [
                  { header: t('products.sku'), value: (p) => p.sku },
                  { header: t('fields.name'), value: (p) => p.name },
                  { header: t('fields.type'), value: (p) => t(`products.types.${p.type}`) },
                  { header: t('products.category'), value: (p) => p.category?.name },
                  { header: t('products.brand'), value: (p) => p.brand?.name },
                  { header: t('products.barcode'), value: (p) => p.barcode },
                  { header: t('products.unit'), value: (p) => p.baseUnit?.code },
                  { header: t('products.purchasePrice'), value: (p) => p.purchasePrice },
                  { header: t('products.salePrice'), value: (p) => p.salePrice },
                ],
                fetchAll: () =>
                  productsResource.fetchAll({ ...list.query, page: undefined, limit: undefined }),
              }
            : undefined
        }
        empty={{ title: t('crud.emptyTitle', { entities: t('products.entities') }), action: newButton }}
      />

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        destructive
        title={t('crud.deleteTitle', { entity: t('products.entity') })}
        description={toDelete && t('crud.deleteText', { name: toDelete.name })}
        confirmLabel={t('common.delete')}
        loading={remove.isPending}
        onConfirm={() =>
          toDelete &&
          remove.mutate(toDelete.id, {
            onSuccess: () => {
              toast.success(t('crud.deleted', { entity: t('products.entityCap') }));
              setToDelete(null);
            },
            onError: () => setToDelete(null),
          })
        }
      />
    </>
  );
}
