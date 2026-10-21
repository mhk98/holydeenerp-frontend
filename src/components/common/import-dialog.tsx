import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import {
  CheckCircle2,
  Download,
  FileDown,
  FileSpreadsheet,
  FileUp,
  MoreHorizontal,
  TriangleAlert,
  Upload,
} from 'lucide-react';
import { api, ApiError, toApiError } from '@/lib/api';
import { downloadFile, saveBlob } from '@/lib/download';
import { cn } from '@/lib/utils';
import type { ApiResponse, ImportSummary } from '@/types';
import { Can } from '@/components/common/can';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';

type Mode = 'validate' | 'report' | 'commit';

async function postImport(url: string, file: File, mode: Mode, skipInvalid = false) {
  const form = new FormData();
  form.append('file', file);
  const params = { mode, skipInvalid: String(skipInvalid) };
  try {
    if (mode === 'report') {
      const res = await api.post<Blob>(`${url}/import`, form, { params, responseType: 'blob', timeout: 0 });
      return res.data;
    }
    const res = await api.post<ApiResponse<ImportSummary>>(`${url}/import`, form, { params, timeout: 0 });
    return res.data.data;
  } catch (err) {
    // Blob error bodies (report mode) need to be parsed back into JSON.
    const data = (err as { response?: { data?: unknown } }).response?.data;
    if (data instanceof Blob) {
      const body = JSON.parse(await data.text()) as { message?: string };
      throw new ApiError(body.message ?? 'Import failed', 400);
    }
    throw toApiError(err);
  }
}

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** API base, e.g. "/products" (endpoints: /import/template, /import). */
  url: string;
  /** Lower-case plural for messages ("products"). */
  entities: string;
  /** TanStack Query keys to refresh after an import. */
  invalidate: string[];
}

/**
 * Excel import wizard: 1) template + choose file → 2) dry-run check with per-row errors
 * (downloadable as an annotated workbook) → 3) import, optionally skipping invalid rows.
 */
export function ImportDialog({ open, onOpenChange, url, entities, invalidate }: ImportDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [check, setCheck] = useState<ImportSummary | null>(null);
  const [result, setResult] = useState<ImportSummary | null>(null);
  const [skipInvalid, setSkipInvalid] = useState(false);
  const [busy, setBusy] = useState<Mode | 'template' | null>(null);

  const reset = () => {
    setFile(null);
    setCheck(null);
    setResult(null);
    setSkipInvalid(false);
    if (inputRef.current) inputRef.current.value = '';
  };
  const close = (o: boolean) => {
    if (!o) reset();
    onOpenChange(o);
  };

  async function run<T>(mode: Mode | 'template', fn: () => Promise<T>) {
    setBusy(mode);
    try {
      return await fn();
    } catch (err) {
      toast.error((err as Error).message);
      return undefined;
    } finally {
      setBusy(null);
    }
  }

  const choose = async (f: File | undefined) => {
    if (!f) return;
    setFile(f);
    setResult(null);
    setCheck(null);
    const summary = await run('validate', () => postImport(url, f, 'validate') as Promise<ImportSummary>);
    if (summary) setCheck(summary);
  };

  const commit = async () => {
    if (!file) return;
    const summary = await run(
      'commit',
      () => postImport(url, file, 'commit', skipInvalid) as Promise<ImportSummary>,
    );
    if (!summary) return;
    setResult(summary);
    for (const key of invalidate) queryClient.invalidateQueries({ queryKey: [key] });
    toast.success(t('import.done', { created: summary.created ?? 0, updated: summary.updated ?? 0 }));
  };

  const errorReport = () =>
    file &&
    run('report', async () => {
      const blob = (await postImport(url, file, 'report')) as Blob;
      saveBlob(blob, file.name.replace(/\.xlsx$/i, '') + '-errors.xlsx');
    });

  const canCommit = check && check.valid > 0 && (check.invalid === 0 || skipInvalid);

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('import.title', { entities })}</DialogTitle>
          <DialogDescription>{t('import.description')}</DialogDescription>
        </DialogHeader>

        <ol className="flex flex-col gap-4 text-sm">
          <li className="flex items-start justify-between gap-3 rounded-lg border p-3">
            <div>
              <p className="font-medium">1. {t('import.step1')}</p>
              <p className="text-muted-foreground">{t('import.step1Hint')}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              disabled={busy === 'template'}
              onClick={() => run('template', () => downloadFile(`${url}/import/template`, 'template.xlsx'))}
            >
              {busy === 'template' ? <Spinner /> : <FileDown aria-hidden />} {t('import.template')}
            </Button>
          </li>

          <li className="rounded-lg border p-3">
            <p className="font-medium">2. {t('import.step2')}</p>
            <label
              className={cn(
                'mt-2 flex cursor-pointer flex-col items-center gap-1 rounded-md border border-dashed p-5 text-center transition-colors focus-within:ring-2 focus-within:ring-ring hover:bg-muted/50',
                busy === 'validate' && 'pointer-events-none opacity-60',
              )}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void choose(e.dataTransfer.files[0]);
              }}
            >
              {busy === 'validate' ? (
                <Spinner />
              ) : (
                <FileSpreadsheet className="size-6 text-muted-foreground" />
              )}
              <span>{file ? file.name : t('import.choose')}</span>
              <span className="text-xs text-muted-foreground">{t('import.chooseHint')}</span>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx"
                className="sr-only"
                onChange={(e) => void choose(e.target.files?.[0])}
              />
            </label>

            {check && !result && (
              <div className="mt-3 flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {(
                    [
                      ['total', check.total],
                      ['valid', check.valid],
                      ['toCreate', check.toCreate],
                      ['toUpdate', check.toUpdate],
                    ] as const
                  ).map(([key, value]) => (
                    <div key={key} className="rounded-md bg-muted/60 px-3 py-2">
                      <p className="text-xs text-muted-foreground">{t(`import.${key}`)}</p>
                      <p className="text-lg font-semibold tabular-nums">{value}</p>
                    </div>
                  ))}
                </div>
                {check.invalid > 0 ? (
                  <Alert variant="destructive">
                    <TriangleAlert aria-hidden />
                    <AlertTitle>{t('import.invalidRows', { count: check.invalid })}</AlertTitle>
                    <AlertDescription>
                      <ul className="mt-1 max-h-36 list-none space-y-0.5 overflow-auto text-xs">
                        {check.errors.slice(0, 50).map((e) => (
                          <li key={e.row}>
                            <span className="font-medium">{t('import.row', { row: e.row })}:</span>{' '}
                            {e.messages.join('; ')}
                          </li>
                        ))}
                      </ul>
                      <Button
                        variant="link"
                        size="sm"
                        className="h-auto px-0"
                        disabled={busy === 'report'}
                        onClick={errorReport}
                      >
                        <Download aria-hidden /> {t('import.errorReport')}
                      </Button>
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert>
                    <CheckCircle2 aria-hidden />
                    <AlertTitle>{t('import.allValid')}</AlertTitle>
                  </Alert>
                )}
              </div>
            )}
          </li>

          {check && !result && check.invalid > 0 && check.valid > 0 && (
            <li className="flex items-center gap-2 px-1">
              <Checkbox
                id="skip-invalid"
                checked={skipInvalid}
                onCheckedChange={(c) => setSkipInvalid(c === true)}
              />
              <Label htmlFor="skip-invalid" className="font-normal">
                {t('import.skipInvalid', { count: check.valid })}
              </Label>
            </li>
          )}

          {result && (
            <Alert>
              <CheckCircle2 aria-hidden />
              <AlertTitle>
                {t('import.result', {
                  created: result.created ?? 0,
                  updated: result.updated ?? 0,
                  skipped: result.skipped ?? 0,
                })}
              </AlertTitle>
              {result.failed && result.failed.length > 0 && (
                <AlertDescription>
                  <ul className="max-h-32 overflow-auto text-xs">
                    {result.failed.map((f) => (
                      <li key={f.row}>
                        {t('import.row', { row: f.row })}: {f.messages.join('; ')}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              )}
            </Alert>
          )}
        </ol>

        <DialogFooter>
          {result ? (
            <>
              <Button variant="outline" onClick={reset}>
                {t('import.another')}
              </Button>
              <Button onClick={() => close(false)}>{t('import.close')}</Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => close(false)}>
                {t('common.cancel')}
              </Button>
              <Button disabled={!canCommit || busy !== null} onClick={commit}>
                {busy === 'commit' ? <Spinner /> : <Upload aria-hidden />}{' '}
                {t('import.commit', { count: check ? (skipInvalid ? check.valid : check.total) : 0 })}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * "⋯" toolbar menu: import from Excel, download template, export everything to Excel
 * (re-importable). Items are permission-aware (<module>.create / <module>.export).
 */
export function ExcelMenu({
  url,
  entities,
  permission,
  invalidate,
  exportParams,
}: {
  url: string;
  entities: string;
  permission: string;
  invalidate: string[];
  exportParams?: object;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const download = (path: string, name: string, params?: object) =>
    downloadFile(`${url}${path}`, name, params).catch((err: Error) => toast.error(err.message));

  return (
    <Can permission={[`${permission}.create`, `${permission}.export`]}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" aria-label={t('import.menu')}>
            <MoreHorizontal aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <Can permission={`${permission}.create`}>
            <DropdownMenuItem onSelect={() => setOpen(true)}>
              <FileUp aria-hidden /> {t('import.importExcel')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => download('/import/template', 'template.xlsx')}>
              <FileDown aria-hidden /> {t('import.template')}
            </DropdownMenuItem>
          </Can>
          <Can permission={`${permission}.export`}>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => download('/export', 'export.xlsx', exportParams)}>
              <FileSpreadsheet aria-hidden /> {t('import.exportExcel')}
            </DropdownMenuItem>
          </Can>
        </DropdownMenuContent>
      </DropdownMenu>
      <ImportDialog
        open={open}
        onOpenChange={setOpen}
        url={url}
        entities={entities}
        invalidate={invalidate}
      />
    </Can>
  );
}
