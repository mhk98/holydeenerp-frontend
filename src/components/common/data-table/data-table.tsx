import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type RowSelectionState,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import { Download, FileSpreadsheet, FileText, FileType, Search, Settings2, X } from 'lucide-react';
import { toast } from 'sonner';
import { useDebouncedValue } from '@/hooks/use-debounce';
import type { ListState } from '@/hooks/use-list-params';
import { exportRows, type ExportColumn, type ExportFormat } from '@/lib/export';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/common/empty-state';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DataTablePagination } from './data-table-pagination';

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    /** Label used in the column visibility menu. */
    label?: string;
    headerClassName?: string;
    cellClassName?: string;
  }
}

export interface DataTableFilter {
  key: string;
  label: string;
  options: { label: string; value: string }[];
}

export interface DataTableExporter<T> {
  filename: string;
  title: string;
  columns: ExportColumn<T>[];
  /** Load every row matching the current filters (otherwise the current page is exported). */
  fetchAll?: () => Promise<T[]>;
}

interface DataTableProps<T> {
  columns: ColumnDef<T, unknown>[];
  data: T[] | undefined;
  total: number;
  loading?: boolean;
  fetching?: boolean;
  list: { state: ListState; setState: (patch: Partial<ListState>) => void };
  getRowId: (row: T) => string;
  searchPlaceholder?: string;
  filters?: DataTableFilter[];
  /** Buttons rendered on the right of the toolbar (e.g. "New user"). */
  toolbarActions?: ReactNode;
  /** Enables row selection; rendered when rows are selected. */
  bulkActions?: (rows: T[], clearSelection: () => void) => ReactNode;
  exporter?: DataTableExporter<T>;
  empty?: { title: string; description?: string; action?: ReactNode };
  /** Remember column visibility in this browser under this key. */
  storageKey?: string;
}

function readVisibility(key?: string): VisibilityState {
  if (!key) return {};
  try {
    return JSON.parse(localStorage.getItem(`table:${key}`) ?? '{}');
  } catch {
    return {};
  }
}

/** Server-driven table: pagination, sorting, search and filters live in the URL (useListParams). */
export function DataTable<T>({
  columns,
  data,
  total,
  loading,
  fetching,
  list,
  getRowId,
  searchPlaceholder,
  filters = [],
  toolbarActions,
  bulkActions,
  exporter,
  empty,
  storageKey,
}: DataTableProps<T>) {
  const { t } = useTranslation();
  const { state, setState } = list;

  const [search, setSearch] = useState(state.search);
  const debouncedSearch = useDebouncedValue(search);
  useEffect(() => {
    if (debouncedSearch !== state.search) setState({ search: debouncedSearch });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to typing
  }, [debouncedSearch]);

  const [visibility, setVisibility] = useState<VisibilityState>(() => readVisibility(storageKey));
  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(`table:${storageKey}`, JSON.stringify(visibility));
    } catch {
      /* storage unavailable */
    }
  }, [visibility, storageKey]);

  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [selectionPage, setSelectionPage] = useState(data);
  if (selectionPage !== data) {
    // New page of data → selection no longer refers to visible rows.
    setSelectionPage(data);
    setRowSelection({});
  }

  const sorting = useMemo<SortingState>(() => {
    if (!state.sort) return [];
    const desc = state.sort.startsWith('-');
    return [{ id: desc ? state.sort.slice(1) : state.sort, desc }];
  }, [state.sort]);

  const allColumns = useMemo<ColumnDef<T, unknown>[]>(() => {
    if (!bulkActions) return columns;
    const select: ColumnDef<T, unknown> = {
      id: 'select',
      enableSorting: false,
      enableHiding: false,
      meta: { headerClassName: 'w-10', cellClassName: 'w-10' },
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')}
          onCheckedChange={(v) => table.toggleAllPageRowsSelected(Boolean(v))}
          aria-label={t('table.selectAll')}
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(v) => row.toggleSelected(Boolean(v))}
          aria-label={t('table.selectRow')}
        />
      ),
    };
    return [select, ...columns];
  }, [bulkActions, columns, t]);

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table v8 is not React-Compiler compatible; this component opts out.
  const table = useReactTable({
    data: data ?? [],
    columns: allColumns,
    getRowId,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    enableSortingRemoval: false,
    rowCount: total,
    state: { sorting, columnVisibility: visibility, rowSelection },
    onColumnVisibilityChange: setVisibility,
    onRowSelectionChange: setRowSelection,
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater;
      const first = next[0];
      setState({ sort: first ? `${first.desc ? '-' : ''}${first.id}` : '' });
    },
  });

  const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original);
  const clearSelection = () => setRowSelection({});
  const activeFilters = Object.values(state.filters).filter(Boolean).length + (state.search ? 1 : 0);

  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const runExport = async (format: ExportFormat) => {
    if (!exporter) return;
    setExporting(format);
    try {
      const rows = selectedRows.length
        ? selectedRows
        : exporter.fetchAll
          ? await exporter.fetchAll()
          : (data ?? []);
      await exportRows(format, rows, exporter.columns, exporter);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('table.exportFailed'));
    } finally {
      setExporting(null);
    }
  };

  const visibleColumnCount = table.getVisibleLeafColumns().length;
  const skeletonRows = Math.min(state.limit, 8);

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <InputGroup className="w-full sm:w-72">
            <InputGroupAddon>
              <Search aria-hidden />
            </InputGroupAddon>
            <InputGroupInput
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={searchPlaceholder ?? t('table.search')}
              aria-label={searchPlaceholder ?? t('table.search')}
            />
            {search && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton
                  size="icon-xs"
                  onClick={() => setSearch('')}
                  aria-label={t('table.clearSearch')}
                >
                  <X aria-hidden />
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>

          {filters.map((filter) => (
            <Select
              key={filter.key}
              value={state.filters[filter.key] ?? 'all'}
              onValueChange={(value) => setState({ filters: { [filter.key]: value === 'all' ? '' : value } })}
            >
              <SelectTrigger className="w-full sm:w-auto sm:min-w-36" aria-label={filter.label}>
                <SelectValue placeholder={filter.label} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {filter.label}: {t('table.all')}
                </SelectItem>
                {filter.options.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}

          {activeFilters > 0 && (
            <Button
              variant="ghost"
              onClick={() => {
                setSearch('');
                setState({ search: '', filters: Object.fromEntries(filters.map((f) => [f.key, ''])) });
              }}
            >
              {t('table.reset')} <X aria-hidden />
            </Button>
          )}
          {fetching && !loading && (
            <Spinner className="text-muted-foreground" aria-label={t('common.loading')} />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {exporter && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" disabled={Boolean(exporting)}>
                  {exporting ? <Spinner /> : <Download aria-hidden />}
                  {t('table.export')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>
                  {selectedRows.length
                    ? t('table.exportSelected', { count: selectedRows.length })
                    : exporter.fetchAll
                      ? t('table.exportAll')
                      : t('table.exportPage')}
                </DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => runExport('csv')}>
                  <FileText aria-hidden /> CSV
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => runExport('xlsx')}>
                  <FileSpreadsheet aria-hidden /> Excel
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => runExport('pdf')}>
                  <FileType aria-hidden /> PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label={t('table.columns')}>
                <Settings2 aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuLabel>{t('table.columns')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllLeafColumns()
                .filter((c) => c.getCanHide())
                .map((c) => (
                  <DropdownMenuCheckboxItem
                    key={c.id}
                    checked={c.getIsVisible()}
                    onCheckedChange={(v) => c.toggleVisibility(Boolean(v))}
                    onSelect={(e) => e.preventDefault()}
                  >
                    {c.columnDef.meta?.label ?? c.id}
                  </DropdownMenuCheckboxItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {toolbarActions}
        </div>
      </div>

      {bulkActions && selectedRows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/50 px-3 py-2 text-sm">
          <span className="font-medium">{t('table.selected', { count: selectedRows.length })}</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {bulkActions(selectedRows, clearSelection)}
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              {t('table.clearSelection')}
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border">
        <Table aria-busy={loading || fetching}>
          <TableHeader className="bg-muted/40">
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => (
                  <TableHead key={header.id} className={header.column.columnDef.meta?.headerClassName}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody className={cn(fetching && !loading && 'opacity-60 transition-opacity')}>
            {loading ? (
              Array.from({ length: skeletonRows }, (_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: visibleColumnCount }, (_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-5 w-full max-w-40" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() ? 'selected' : undefined}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className={cell.column.columnDef.meta?.cellClassName}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={visibleColumnCount} className="p-6">
                  <EmptyState
                    className="border-0 py-10"
                    title={activeFilters ? t('table.noMatches') : (empty?.title ?? t('table.noData'))}
                    description={activeFilters ? t('table.noMatchesText') : empty?.description}
                    action={activeFilters ? undefined : empty?.action}
                  />
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <DataTablePagination
        page={state.page}
        limit={state.limit}
        total={total}
        selected={selectedRows.length}
        onChange={(patch) => setState(patch)}
      />
    </div>
  );
}
