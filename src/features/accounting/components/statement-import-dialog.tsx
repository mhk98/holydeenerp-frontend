import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Upload } from 'lucide-react';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useImportStatement, type StatementPreview } from '../api/banking-api';
import type { StatementMapping } from '../types';

const DATE_FORMATS = ['DD/MM/YYYY', 'DD-MM-YYYY', 'DD.MM.YYYY', 'DD-MMM-YYYY', 'YYYY-MM-DD', 'MM/DD/YYYY'];
const FIELDS = ['date', 'description', 'reference', 'debit', 'credit', 'amount'] as const;
const NONE = '0';

/**
 * Statement import in two steps: upload → preview the first rows and say which column is which
 * (remembered per bank account) → import.
 */
export function StatementImportDialog({
  reconciliationId,
  saved,
  open,
  onOpenChange,
}: {
  reconciliationId: string;
  saved: StatementMapping | null | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const upload = useImportStatement(reconciliationId);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<StatementPreview | null>(null);
  const [mapping, setMapping] = useState<StatementMapping>(
    saved ?? { headerRow: 1, date: 1, dateFormat: 'DD/MM/YYYY' },
  );

  const reset = (o: boolean) => {
    if (!o) {
      setFile(null);
      setPreview(null);
    }
    onOpenChange(o);
  };

  const choose = (f: File | undefined) => {
    if (!f) return;
    setFile(f);
    upload.mutate(
      { file: f },
      {
        onSuccess: (data) => {
          const p = data as StatementPreview;
          setPreview(p);
          if (p.mapping) setMapping(p.mapping);
        },
        onError: (err) => toast.error(err.message),
      },
    );
  };

  const columns = Array.from({ length: preview?.columns ?? 0 }, (_, i) => i + 1);
  const header = preview?.preview[Math.max(0, mapping.headerRow - 1)] ?? [];
  const label = (n: number) =>
    `${t('accounting.recon.column', { n })}${header[n - 1] ? ` · ${header[n - 1]}` : ''}`;
  const set = (field: (typeof FIELDS)[number], value: string) =>
    setMapping((m) => ({ ...m, [field]: value === NONE ? undefined : Number(value) }));
  const valid = mapping.date && (mapping.amount || mapping.debit || mapping.credit);

  return (
    <Dialog open={open} onOpenChange={reset}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t('accounting.recon.import')}</DialogTitle>
          <DialogDescription>{t('accounting.recon.importHint')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="statement-file">{t('accounting.recon.file')}</Label>
            <Input
              id="statement-file"
              type="file"
              accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => choose(e.target.files?.[0])}
            />
          </div>
          {upload.isPending && !preview && <Spinner />}
          {preview && (
            <>
              <div className="max-h-56 overflow-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      {columns.map((n) => (
                        <TableHead key={n}>{n}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.preview.map((row, i) => (
                      <TableRow
                        key={i}
                        className={i + 1 === mapping.headerRow ? 'bg-muted/60 font-medium' : undefined}
                      >
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        {columns.map((n) => (
                          <TableCell key={n} className="whitespace-nowrap">
                            {String(row[n - 1] ?? '')}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="header-row">{t('accounting.recon.headerRow')}</Label>
                  <Input
                    id="header-row"
                    type="number"
                    min={0}
                    max={50}
                    value={mapping.headerRow}
                    onChange={(e) => setMapping((m) => ({ ...m, headerRow: Number(e.target.value) || 0 }))}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>{t('accounting.recon.dateFormat')}</Label>
                  <Select
                    value={mapping.dateFormat}
                    onValueChange={(value) => setMapping((m) => ({ ...m, dateFormat: value }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DATE_FORMATS.map((f) => (
                        <SelectItem key={f} value={f}>
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {FIELDS.map((field) => (
                  <div key={field} className="flex flex-col gap-2">
                    <Label>{t(`accounting.recon.fields.${field}`)}</Label>
                    <Select
                      value={String(mapping[field] ?? NONE)}
                      onValueChange={(value) => set(field, value)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {field !== 'date' && <SelectItem value={NONE}>{t('common.none')}</SelectItem>}
                        {columns.map((n) => (
                          <SelectItem key={n} value={String(n)}>
                            {label(n)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">{t('accounting.recon.amountHint')}</p>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => reset(false)}>
            {t('common.cancel')}
          </Button>
          <Button
            disabled={!file || !preview || !valid || upload.isPending}
            onClick={() =>
              file &&
              upload.mutate(
                { file, mapping },
                {
                  onSuccess: (data) => {
                    const result = data as { imported: number; skipped: unknown[] };
                    toast.success(
                      t('accounting.recon.imported', {
                        count: result.imported,
                        skipped: result.skipped.length,
                      }),
                    );
                    reset(false);
                  },
                  onError: (err) => toast.error(err.message),
                },
              )
            }
          >
            {upload.isPending ? <Spinner /> : <Upload aria-hidden />} {t('accounting.recon.importButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
