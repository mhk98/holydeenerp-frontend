import { useMemo, useState } from 'react';
import { useFieldArray, useForm, useWatch, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { ExternalLink, Plus, Save, Send, Trash2, Undo2 } from 'lucide-react';
import { usePermission } from '@/hooks/use-permission';
import { applyServerErrors, v } from '@/lib/form';
import { formatCurrency, formatDate } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/stores/auth-store';
import { useSettingsStore } from '@/stores/settings-store';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { FormField } from '@/components/common/form-field';
import { PageHeader } from '@/components/common/page-header';
import { PageSkeleton } from '@/components/common/page-skeleton';
import { StatusBadge } from '@/components/common/status-badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { TrailCard } from '@/features/purchase/components/purchase-ui';
import { SupplierSelect } from '@/features/purchase/components/supplier-select';
import { todayIn } from '@/features/purchase/lib';
import {
  useAccountOptions,
  useDeleteJournal,
  useJournal,
  usePostJournal,
  useReverseJournal,
  useSaveJournal,
} from '../api/accounting-api';
import { AccountSelect } from '../components/account-select';
import { ACCOUNTING_ROUTES, ENTRY_TONE, STATUS_TONE, accountName, cents, sourceRoute } from '../lib';
import type { JournalEntry } from '../types';

const NO_BRANCH = '__company__';
const amount = z
  .string()
  .trim()
  .refine((s) => s === '' || /^\d+(\.\d{1,4})?$/.test(s), 'validation.decimal');
const lineSchema = z
  .object({
    accountId: v.required(),
    partyId: z.string().nullable(),
    partyLabel: z.string().nullable(),
    description: z.string().max(255, 'validation.tooLong'),
    debit: amount,
    credit: amount,
  })
  .refine((l) => Number(l.debit || 0) > 0 !== Number(l.credit || 0) > 0, {
    message: 'accounting.journals.debitOrCredit',
    path: ['debit'],
  });
const schema = z.object({
  entryDate: v.required(),
  branchId: z.string(),
  reference: z.string().max(100, 'validation.tooLong'),
  narration: z.string().max(500, 'validation.tooLong'),
  lines: z.array(lineSchema).min(2, 'accounting.journals.twoLines'),
});
type Values = z.infer<typeof schema>;
type LineValues = Values['lines'][number];

const emptyLine = (): LineValues => ({
  accountId: '',
  partyId: null,
  partyLabel: null,
  description: '',
  debit: '',
  credit: '',
});

/** Create or edit a draft journal; save as draft or post. */
function JournalForm({ journal }: { journal?: JournalEntry }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = usePermission();
  const timezone = useSettingsStore((s) => s.timezone);
  const activeBranchId = useSettingsStore((s) => s.activeBranchId);
  const branches = useAuthStore((s) => s.user?.branches ?? []);
  const options = useAccountOptions();
  const save = useSaveJournal();
  const remove = useDeleteJournal();
  const [deleting, setDeleting] = useState(false);

  const form = useForm<Values>({
    resolver: zodResolver(schema) as Resolver<Values>,
    defaultValues: journal
      ? {
          entryDate: journal.entryDate,
          branchId: journal.branchId ?? NO_BRANCH,
          reference: journal.reference ?? '',
          narration: journal.narration ?? '',
          lines: (journal.lines ?? []).map((l) => ({
            accountId: l.accountId,
            partyId: l.partyId,
            partyLabel: l.party ? `${l.party.name} (${l.party.code})` : null,
            description: l.description ?? '',
            debit: Number(l.debit) ? String(Number(l.debit)) : '',
            credit: Number(l.credit) ? String(Number(l.credit)) : '',
          })),
        }
      : {
          entryDate: todayIn(timezone),
          branchId: activeBranchId ?? NO_BRANCH,
          reference: '',
          narration: '',
          lines: [emptyLine(), emptyLine()],
        },
  });
  const { fields, append, remove: removeLine } = useFieldArray({ control: form.control, name: 'lines' });
  const lines = useWatch({ control: form.control, name: 'lines' }) ?? [];
  const accountOf = useMemo(() => new Map((options.data ?? []).map((a) => [a.id, a])), [options.data]);

  const debit = lines.reduce((s, l) => s + cents(l.debit), 0);
  const credit = lines.reduce((s, l) => s + cents(l.credit), 0);
  const difference = debit - credit;
  const rootError = form.formState.errors.lines?.root?.message ?? form.formState.errors.lines?.message;

  const submit = (post: boolean) =>
    form.handleSubmit((values) =>
      save.mutate(
        {
          id: journal?.id,
          data: {
            entryDate: values.entryDate,
            branchId: values.branchId === NO_BRANCH ? null : values.branchId,
            reference: v.nullIfEmpty(values.reference),
            narration: v.nullIfEmpty(values.narration),
            post,
            lines: values.lines.map((l) => ({
              accountId: l.accountId,
              partyId: l.partyId,
              description: v.nullIfEmpty(l.description),
              debit: l.debit || '0',
              credit: l.credit || '0',
            })),
          },
        },
        {
          onSuccess: (j) => {
            toast.success(
              t(post ? 'accounting.toast.posted' : 'accounting.toast.draftSaved', { number: j.number }),
            );
            navigate(`${ACCOUNTING_ROUTES.journals}/${j.id}`, { replace: true });
          },
          onError: (err) => {
            applyServerErrors(err, form.setError);
            toast.error(err.message);
          },
        },
      ),
    )();

  const setAmount = (i: number, side: 'debit' | 'credit', value: string) => {
    form.setValue(`lines.${i}.${side}`, value, {
      shouldDirty: true,
      shouldValidate: form.formState.isSubmitted,
    });
    if (value)
      form.setValue(`lines.${i}.${side === 'debit' ? 'credit' : 'debit'}`, '', { shouldDirty: true });
  };

  /** Fill the last empty amount with whatever balances the entry. */
  const balanceLast = () => {
    const i = lines.length - 1;
    if (i < 0 || !difference) return;
    const rest = lines.slice(0, i);
    const d = rest.reduce((s, l) => s + cents(l.debit), 0) - rest.reduce((s, l) => s + cents(l.credit), 0);
    setAmount(i, d > 0 ? 'credit' : 'debit', (Math.abs(d) / 100).toFixed(2));
  };

  const title = journal
    ? `${t('accounting.journals.entity')} ${journal.number}`
    : t('accounting.journals.new');

  return (
    <>
      <PageHeader
        title={title}
        description={
          journal ? (
            <StatusBadge tone="neutral">{t('accounting.status.draft')}</StatusBadge>
          ) : (
            t('accounting.journals.newHint')
          )
        }
        breadcrumbs={[
          { label: t('nav.accounting') },
          { label: t('accounting.journals.title'), to: ACCOUNTING_ROUTES.journals },
          { label: journal?.number ?? t('common.new') },
        ]}
        actions={
          <>
            {journal && can('accounting.delete') && (
              <Button variant="outline" onClick={() => setDeleting(true)}>
                <Trash2 aria-hidden /> {t('common.delete')}
              </Button>
            )}
            <Button variant="outline" onClick={() => submit(false)} disabled={save.isPending}>
              {save.isPending ? <Spinner /> : <Save aria-hidden />} {t('accounting.journals.saveDraft')}
            </Button>
            <Button onClick={() => submit(true)} disabled={save.isPending || difference !== 0}>
              {save.isPending ? <Spinner /> : <Send aria-hidden />} {t('accounting.journals.post')}
            </Button>
          </>
        }
      />
      <div className="flex flex-col gap-4">
        <Card>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <FormField
              control={form.control}
              name="entryDate"
              label={t('accounting.date')}
              render={({ field, aria }) => <Input type="date" {...field} {...aria} />}
            />
            <FormField
              control={form.control}
              name="branchId"
              label={t('accounting.branch')}
              render={({ field, aria }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full" {...aria}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_BRANCH}>{t('accounting.companyWide')}</SelectItem>
                    {branches.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FormField
              control={form.control}
              name="reference"
              label={t('accounting.journals.reference')}
              render={({ field, aria }) => <Input {...field} {...aria} placeholder="DESCO-0425" />}
            />
            <FormField
              control={form.control}
              name="narration"
              label={t('accounting.journals.narration')}
              className="sm:col-span-2 lg:col-span-4"
              render={({ field, aria }) => <Textarea rows={2} {...field} {...aria} />}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">{t('accounting.journals.lines')}</CardTitle>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" onClick={balanceLast} disabled={!difference}>
                {t('accounting.journals.balanceLast')}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => append(emptyLine())}>
                <Plus aria-hidden /> {t('accounting.journals.addLine')}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-72">{t('accounting.account')}</TableHead>
                    <TableHead className="min-w-56">{t('accounting.journals.lineDescription')}</TableHead>
                    <TableHead className="min-w-32 text-right">{t('accounting.debit')}</TableHead>
                    <TableHead className="min-w-32 text-right">{t('accounting.credit')}</TableHead>
                    <TableHead className="w-10">
                      <span className="sr-only">{t('common.actions')}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((f, i) => {
                    const line = lines[i] ?? emptyLine();
                    const account = accountOf.get(line.accountId);
                    const partyType =
                      account?.subtype === 'receivable'
                        ? 'customer'
                        : account?.subtype === 'payable'
                          ? 'supplier'
                          : null;
                    return (
                      <TableRow key={f.id} className="align-top">
                        <TableCell className="flex flex-col gap-2">
                          <FormField
                            control={form.control}
                            name={`lines.${i}.accountId`}
                            render={({ field, aria }) => (
                              <AccountSelect
                                value={field.value}
                                onChange={(id) => {
                                  field.onChange(id ?? '');
                                  form.setValue(`lines.${i}.partyId`, null);
                                  form.setValue(`lines.${i}.partyLabel`, null);
                                }}
                                {...aria}
                                aria-label={t('accounting.account')}
                              />
                            )}
                          />
                          {partyType && (
                            <FormField
                              control={form.control}
                              name={`lines.${i}.partyId`}
                              render={({ field, aria }) => (
                                <SupplierSelect
                                  type={partyType}
                                  value={field.value}
                                  selectedLabel={line.partyLabel}
                                  onChange={(id, p) => {
                                    field.onChange(id);
                                    form.setValue(`lines.${i}.partyLabel`, `${p.name} (${p.code})`);
                                  }}
                                  {...aria}
                                />
                              )}
                            />
                          )}
                        </TableCell>
                        <TableCell>
                          <FormField
                            control={form.control}
                            name={`lines.${i}.description`}
                            render={({ field, aria }) => (
                              <Input
                                {...field}
                                {...aria}
                                aria-label={t('accounting.journals.lineDescription')}
                              />
                            )}
                          />
                        </TableCell>
                        {(['debit', 'credit'] as const).map((side) => (
                          <TableCell key={side}>
                            <FormField
                              control={form.control}
                              name={`lines.${i}.${side}`}
                              render={({ field, aria }) => (
                                <Input
                                  {...field}
                                  {...aria}
                                  onChange={(e) => setAmount(i, side, e.target.value.trim())}
                                  inputMode="decimal"
                                  className="text-right tabular-nums"
                                  aria-label={t(`accounting.${side}`)}
                                />
                              )}
                            />
                          </TableCell>
                        ))}
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => removeLine(i)}
                            disabled={fields.length <= 2}
                            aria-label={t('accounting.journals.removeLine')}
                          >
                            <Trash2 aria-hidden />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={2} className="text-right font-medium">
                      {t('accounting.total')}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatCurrency(debit / 100)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatCurrency(credit / 100)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
            {difference !== 0 && (
              <Alert variant="destructive">
                <AlertDescription>
                  {t('accounting.journals.outOfBalance', {
                    amount: formatCurrency(Math.abs(difference) / 100),
                  })}
                </AlertDescription>
              </Alert>
            )}
            {rootError && <p className="text-sm text-destructive">{t(rootError)}</p>}
          </CardContent>
        </Card>
      </div>
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        destructive
        title={t('crud.deleteTitle', { entity: t('accounting.journals.entity') })}
        description={journal && t('crud.deleteText', { name: journal.number })}
        confirmLabel={t('common.delete')}
        loading={remove.isPending}
        onConfirm={() =>
          journal &&
          remove.mutate(journal.id, {
            onSuccess: () => {
              toast.success(t('crud.deleted', { entity: t('accounting.journals.entityCap') }));
              navigate(ACCOUNTING_ROUTES.journals, { replace: true });
            },
            onError: (err) => (toast.error(err.message), setDeleting(false)),
          })
        }
      />
    </>
  );
}

/** A posted (or read-only) journal with its source document and reversal links. */
function JournalView({ journal }: { journal: JournalEntry }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = usePermission();
  const language = useSettingsStore((s) => s.language);
  const timezone = useSettingsStore((s) => s.timezone);
  const post = usePostJournal();
  const reverse = useReverseJournal();
  const [reversing, setReversing] = useState(false);
  const [reverseDate, setReverseDate] = useState(todayIn(timezone));
  const [reverseNote, setReverseNote] = useState('');
  const source = sourceRoute(journal.sourceType, journal.sourceId);
  const canReverse =
    journal.status === 'posted' &&
    !journal.reversedById &&
    ['manual', 'opening'].includes(journal.entryType) &&
    can('accounting.approve');

  return (
    <>
      <PageHeader
        title={`${t('accounting.journals.entity')} ${journal.number}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={journal.reversedById ? 'danger' : STATUS_TONE[journal.status]}>
              {t(
                journal.reversedById ? 'accounting.journals.reversed' : `accounting.status.${journal.status}`,
              )}
            </StatusBadge>
            <StatusBadge tone={ENTRY_TONE[journal.entryType]}>
              {t(`accounting.entryTypes.${journal.entryType}`)}
            </StatusBadge>
            {formatDate(journal.entryDate)} · {journal.branch?.name ?? t('accounting.companyWide')}
          </span>
        }
        breadcrumbs={[
          { label: t('nav.accounting') },
          { label: t('accounting.journals.title'), to: ACCOUNTING_ROUTES.journals },
          { label: journal.number },
        ]}
        actions={
          <>
            {source && (
              <Button variant="outline" asChild>
                <Link to={source}>
                  <ExternalLink aria-hidden />{' '}
                  {t('accounting.journals.openSource', { number: journal.sourceNo })}
                </Link>
              </Button>
            )}
            {journal.status === 'draft' && can('accounting.create') && (
              <Button
                onClick={() =>
                  post.mutate(journal.id, {
                    onSuccess: (j) => toast.success(t('accounting.toast.posted', { number: j.number })),
                    onError: (err) => toast.error(err.message),
                  })
                }
                disabled={post.isPending}
              >
                {post.isPending ? <Spinner /> : <Send aria-hidden />} {t('accounting.journals.post')}
              </Button>
            )}
            {canReverse && (
              <Button variant="outline" onClick={() => setReversing(true)}>
                <Undo2 aria-hidden /> {t('accounting.journals.reverse')}
              </Button>
            )}
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{journal.narration ?? t('accounting.journals.lines')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('accounting.account')}</TableHead>
                    <TableHead className="hidden md:table-cell">{t('accounting.branch')}</TableHead>
                    <TableHead className="text-right">{t('accounting.debit')}</TableHead>
                    <TableHead className="text-right">{t('accounting.credit')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(journal.lines ?? []).map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className={cn(Number(l.credit) > 0 && 'pl-8')}>
                        <Link
                          to={`${ACCOUNTING_ROUTES.journals}?accountId=${l.accountId}`}
                          className="hover:underline"
                        >
                          <span className="mr-2 font-mono text-xs text-muted-foreground">
                            {l.account.code}
                          </span>
                          {accountName(l.account, language)}
                        </Link>
                        {(l.party || l.description) && (
                          <div className="text-xs text-muted-foreground">
                            {[l.party?.name, l.description].filter(Boolean).join(' · ')}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="hidden text-muted-foreground md:table-cell">
                        {l.branch?.name ?? '—'}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number(l.debit) ? formatCurrency(l.debit) : ''}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {Number(l.credit) ? formatCurrency(l.credit) : ''}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={2} className="text-right font-medium">
                      {t('accounting.total')}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatCurrency(journal.totalDebit)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatCurrency(journal.totalCredit)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </CardContent>
        </Card>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('accounting.journals.details')}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="flex flex-col gap-2 text-sm">
                {journal.reference && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">{t('accounting.journals.reference')}</dt>
                    <dd>{journal.reference}</dd>
                  </div>
                )}
                {journal.sourceNo && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">{t('accounting.journals.source')}</dt>
                    <dd className="font-mono text-xs">
                      {t(`accounting.sources.${journal.sourceType}`, { defaultValue: journal.sourceType })}{' '}
                      {journal.sourceNo}
                    </dd>
                  </div>
                )}
                {journal.reversalOf && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">{t('accounting.journals.reverses')}</dt>
                    <dd>
                      <Link
                        to={`${ACCOUNTING_ROUTES.journals}/${journal.reversalOf.id}`}
                        className="font-mono text-xs text-primary hover:underline"
                      >
                        {journal.reversalOf.number}
                      </Link>
                    </dd>
                  </div>
                )}
                {journal.reversedBy && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">{t('accounting.journals.reversedBy')}</dt>
                    <dd>
                      <Link
                        to={`${ACCOUNTING_ROUTES.journals}/${journal.reversedBy.id}`}
                        className="font-mono text-xs text-primary hover:underline"
                      >
                        {journal.reversedBy.number}
                      </Link>
                    </dd>
                  </div>
                )}
              </dl>
              {journal.entryType === 'auto' && (
                <p className="mt-3 text-xs text-muted-foreground">{t('accounting.journals.autoHint')}</p>
              )}
            </CardContent>
          </Card>
          <TrailCard
            entries={[
              { label: t('accounting.journals.createdTrail'), user: journal.creator, at: journal.createdAt },
              { label: t('accounting.journals.postedTrail'), user: journal.poster, at: journal.postedAt },
            ]}
          />
        </div>
      </div>
      <Dialog open={reversing} onOpenChange={setReversing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('accounting.journals.reverseTitle', { number: journal.number })}</DialogTitle>
            <DialogDescription>{t('accounting.journals.reverseHint')}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="reverse-date">{t('accounting.date')}</Label>
              <Input
                id="reverse-date"
                type="date"
                value={reverseDate}
                onChange={(e) => setReverseDate(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="reverse-note">{t('accounting.journals.narration')}</Label>
              <Textarea
                id="reverse-note"
                rows={2}
                value={reverseNote}
                onChange={(e) => setReverseNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReversing(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              disabled={reverse.isPending || !reverseDate}
              onClick={() =>
                reverse.mutate(
                  { id: journal.id, date: reverseDate, narration: v.nullIfEmpty(reverseNote) },
                  {
                    onSuccess: (r) => {
                      toast.success(t('accounting.toast.reversed', { number: r.number }));
                      setReversing(false);
                      navigate(`${ACCOUNTING_ROUTES.journals}/${r.id}`);
                    },
                    onError: (err) => toast.error(err.message),
                  },
                )
              }
            >
              {reverse.isPending ? <Spinner /> : <Undo2 aria-hidden />} {t('accounting.journals.reverse')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function ExistingJournal({ id }: { id: string }) {
  const { can } = usePermission();
  const journal = useJournal(id);
  if (journal.isPending) return <PageSkeleton />;
  const j = journal.data;
  if (!j) return null;
  return j.status === 'draft' && can('accounting.update') ? (
    <JournalForm key={j.id} journal={j} />
  ) : (
    <JournalView journal={j} />
  );
}

export default function JournalPage() {
  const { id } = useParams();
  return !id || id === 'new' ? <JournalForm /> : <ExistingJournal id={id} />;
}
