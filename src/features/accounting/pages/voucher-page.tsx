import { useState } from 'react';
import { useFieldArray, useForm, useWatch, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { Ban, Plus, Save, Send, Trash2 } from 'lucide-react';
import { usePermission } from '@/hooks/use-permission';
import { applyServerErrors, v } from '@/lib/form';
import { formatCurrency, formatDate } from '@/lib/format';
import { useSettingsStore } from '@/stores/settings-store';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { FormField } from '@/components/common/form-field';
import { PageHeader } from '@/components/common/page-header';
import { PageSkeleton } from '@/components/common/page-skeleton';
import { StatusBadge } from '@/components/common/status-badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { RejectDialog } from '@/features/inventory/components/reject-dialog';
import { TrailCard } from '@/features/purchase/components/purchase-ui';
import { todayIn } from '@/features/purchase/lib';
import { useSaveVoucher, useVoucher, useVoucherAction, type VoucherInput } from '../api/banking-api';
import { AccountSelect } from '../components/account-select';
import { BankAccountSelect } from '../components/bank-account-select';
import { JournalPanel } from '../components/journal-panel';
import { ACCOUNTING_ROUTES, DOC_TONE, VOUCHER_ICON, accountName, cents } from '../lib';
import type { Voucher, VoucherType } from '../types';

const money = z
  .string()
  .trim()
  .regex(/^\d+(\.\d{1,4})?$/, 'validation.decimal')
  .refine((s) => Number(s) > 0, 'validation.positive');
const schema = z
  .object({
    voucherType: z.enum(['receipt', 'payment', 'contra']),
    voucherDate: v.required(),
    bankAccountId: v.required(),
    toBankAccountId: z.string(),
    amount: z.string(),
    partyName: z.string().max(150, 'validation.tooLong'),
    reference: z.string().max(100, 'validation.tooLong'),
    narration: z.string().max(500, 'validation.tooLong'),
    lines: z.array(
      z.object({
        accountId: v.required(),
        amount: money,
        description: z.string().max(255, 'validation.tooLong'),
      }),
    ),
  })
  .superRefine((val, ctx) => {
    if (val.voucherType === 'contra') {
      if (!val.toBankAccountId)
        ctx.addIssue({ code: 'custom', path: ['toBankAccountId'], message: 'validation.required' });
      if (!money.safeParse(val.amount).success)
        ctx.addIssue({ code: 'custom', path: ['amount'], message: 'validation.positive' });
    } else if (!val.lines.length) {
      ctx.addIssue({ code: 'custom', path: ['lines'], message: 'accounting.vouchers.addLine' });
    }
  });
type Values = z.infer<typeof schema>;

const emptyLine = () => ({ accountId: '', amount: '', description: '' });

function VoucherForm({ voucher, type }: { voucher?: Voucher; type: VoucherType }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = usePermission();
  const timezone = useSettingsStore((s) => s.timezone);
  const save = useSaveVoucher();
  const action = useVoucherAction();
  const [deleting, setDeleting] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema) as Resolver<Values>,
    defaultValues: {
      voucherType: type,
      voucherDate: voucher?.voucherDate ?? todayIn(timezone),
      bankAccountId: voucher?.bankAccountId ?? '',
      toBankAccountId: voucher?.toBankAccountId ?? '',
      amount: voucher && type === 'contra' ? String(Number(voucher.amount)) : '',
      partyName: voucher?.partyName ?? '',
      reference: voucher?.reference ?? '',
      narration: voucher?.narration ?? '',
      lines:
        type === 'contra'
          ? []
          : (voucher?.lines?.map((l) => ({
              accountId: l.accountId,
              amount: String(Number(l.amount)),
              description: l.description ?? '',
            })) ?? [emptyLine()]),
    },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lines' });
  const lines = useWatch({ control: form.control, name: 'lines' }) ?? [];
  const from = useWatch({ control: form.control, name: 'bankAccountId' });
  const total = lines.reduce((s, l) => s + cents(l.amount), 0);
  const Icon = VOUCHER_ICON[type];

  const submit = (post: boolean) =>
    form.handleSubmit((values) => {
      const data: VoucherInput = {
        voucherType: type,
        voucherDate: values.voucherDate,
        bankAccountId: values.bankAccountId,
        partyName: v.nullIfEmpty(values.partyName),
        reference: v.nullIfEmpty(values.reference),
        narration: v.nullIfEmpty(values.narration),
        post,
        ...(type === 'contra'
          ? { toBankAccountId: values.toBankAccountId, amount: values.amount }
          : {
              lines: values.lines.map((l) => ({
                accountId: l.accountId,
                amount: l.amount,
                description: v.nullIfEmpty(l.description),
              })),
            }),
      };
      save.mutate(
        { id: voucher?.id, data },
        {
          onSuccess: (saved) => {
            toast.success(
              t(post ? 'accounting.toast.posted' : 'accounting.toast.draftSaved', { number: saved.number }),
            );
            navigate(`${ACCOUNTING_ROUTES.vouchers}/${saved.id}`, { replace: true });
          },
          onError: (err) => {
            applyServerErrors(err, form.setError);
            toast.error(err.message);
          },
        },
      );
    })();

  const moneyLabel = { receipt: 'receivedInto', payment: 'paidFrom', contra: 'transferFrom' }[type];

  return (
    <>
      <PageHeader
        title={voucher ? voucher.number : t(`accounting.vouchers.newType.${type}`)}
        description={
          <span className="flex items-center gap-2">
            <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            {t(`accounting.vouchers.hint.${type}`)}
          </span>
        }
        breadcrumbs={[
          { label: t('nav.accounting') },
          { label: t('accounting.vouchers.title'), to: ACCOUNTING_ROUTES.vouchers },
          { label: voucher?.number ?? t('common.new') },
        ]}
        actions={
          <>
            {voucher && can('accounting.delete') && (
              <Button variant="outline" onClick={() => setDeleting(true)}>
                <Trash2 aria-hidden /> {t('common.delete')}
              </Button>
            )}
            <Button variant="outline" onClick={() => submit(false)} disabled={save.isPending}>
              {save.isPending ? <Spinner /> : <Save aria-hidden />} {t('accounting.journals.saveDraft')}
            </Button>
            <Button onClick={() => submit(true)} disabled={save.isPending}>
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
              name="voucherDate"
              label={t('accounting.date')}
              render={({ field, aria }) => <Input type="date" {...field} {...aria} />}
            />
            <FormField
              control={form.control}
              name="bankAccountId"
              label={t(`accounting.vouchers.${moneyLabel}`)}
              render={({ field, aria }) => (
                <BankAccountSelect value={field.value} onChange={field.onChange} {...aria} />
              )}
            />
            {type === 'contra' ? (
              <>
                <FormField
                  control={form.control}
                  name="toBankAccountId"
                  label={t('accounting.vouchers.transferTo')}
                  render={({ field, aria }) => (
                    <BankAccountSelect
                      value={field.value}
                      onChange={field.onChange}
                      exclude={from}
                      {...aria}
                    />
                  )}
                />
                <FormField
                  control={form.control}
                  name="amount"
                  label={t('accounting.amount')}
                  render={({ field, aria }) => (
                    <Input {...field} {...aria} inputMode="decimal" className="text-right tabular-nums" />
                  )}
                />
              </>
            ) : (
              <FormField
                control={form.control}
                name="partyName"
                label={t(`accounting.vouchers.${type === 'receipt' ? 'receivedFrom' : 'paidTo'}`)}
                render={({ field, aria }) => <Input {...field} {...aria} />}
              />
            )}
            <FormField
              control={form.control}
              name="reference"
              label={t('accounting.journals.reference')}
              render={({ field, aria }) => <Input {...field} {...aria} />}
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

        {type !== 'contra' && (
          <Card>
            <CardHeader className="flex-row items-center justify-between gap-2">
              <CardTitle className="text-base">
                {t(
                  type === 'receipt' ? 'accounting.vouchers.incomeLines' : 'accounting.vouchers.expenseLines',
                )}
              </CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={() => append(emptyLine())}>
                <Plus aria-hidden /> {t('accounting.journals.addLine')}
              </Button>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-72">{t('accounting.account')}</TableHead>
                      <TableHead className="min-w-56">{t('accounting.journals.lineDescription')}</TableHead>
                      <TableHead className="min-w-32 text-right">{t('accounting.amount')}</TableHead>
                      <TableHead className="w-10">
                        <span className="sr-only">{t('common.actions')}</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.map((f, i) => (
                      <TableRow key={f.id} className="align-top">
                        <TableCell>
                          <FormField
                            control={form.control}
                            name={`lines.${i}.accountId`}
                            render={({ field, aria }) => (
                              <AccountSelect
                                value={field.value || null}
                                onChange={(id) => field.onChange(id ?? '')}
                                exclude={(a) => ['receivable', 'payable'].includes(a.subtype)}
                                {...aria}
                                aria-label={t('accounting.account')}
                              />
                            )}
                          />
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
                        <TableCell>
                          <FormField
                            control={form.control}
                            name={`lines.${i}.amount`}
                            render={({ field, aria }) => (
                              <Input
                                {...field}
                                {...aria}
                                inputMode="decimal"
                                className="text-right tabular-nums"
                                aria-label={t('accounting.amount')}
                              />
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => remove(i)}
                            disabled={fields.length <= 1}
                            aria-label={t('accounting.journals.removeLine')}
                          >
                            <Trash2 aria-hidden />
                          </Button>
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
                        {formatCurrency(total / 100)}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
              {form.formState.errors.lines?.message && (
                <p className="text-sm text-destructive">{t(form.formState.errors.lines.message)}</p>
              )}
              <p className="text-xs text-muted-foreground">{t('accounting.vouchers.noCustomers')}</p>
            </CardContent>
          </Card>
        )}
      </div>
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        destructive
        title={t('crud.deleteTitle', { entity: t('accounting.vouchers.entity') })}
        description={voucher && t('crud.deleteText', { name: voucher.number })}
        confirmLabel={t('common.delete')}
        loading={action.isPending}
        onConfirm={() =>
          voucher &&
          action.mutate(
            { id: voucher.id, action: 'delete' },
            {
              onSuccess: () => navigate(ACCOUNTING_ROUTES.vouchers, { replace: true }),
              onError: (err) => (toast.error(err.message), setDeleting(false)),
            },
          )
        }
      />
    </>
  );
}

function VoucherView({ voucher }: { voucher: Voucher }) {
  const { t } = useTranslation();
  const { can } = usePermission();
  const language = useSettingsStore((s) => s.language);
  const action = useVoucherAction();
  const [voiding, setVoiding] = useState(false);
  const Icon = VOUCHER_ICON[voucher.voucherType];
  return (
    <>
      <PageHeader
        title={voucher.number}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            <StatusBadge tone={DOC_TONE[voucher.status]}>
              {t(`accounting.docStatus.${voucher.status}`)}
            </StatusBadge>
            {t(`accounting.vouchers.types.${voucher.voucherType}`)} · {formatDate(voucher.voucherDate)}
          </span>
        }
        breadcrumbs={[
          { label: t('nav.accounting') },
          { label: t('accounting.vouchers.title'), to: ACCOUNTING_ROUTES.vouchers },
          { label: voucher.number },
        ]}
        actions={
          voucher.status === 'posted' &&
          can('accounting.approve') && (
            <Button variant="outline" onClick={() => setVoiding(true)}>
              <Ban aria-hidden /> {t('accounting.void')}
            </Button>
          )
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          {voucher.status === 'void' && voucher.voidReason && (
            <Alert variant="destructive">
              <AlertDescription>
                {t('accounting.voidedBecause', { reason: voucher.voidReason })}
              </AlertDescription>
            </Alert>
          )}
          {voucher.voucherType !== 'contra' && (
            <Card>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('accounting.account')}</TableHead>
                      <TableHead className="text-right">{t('accounting.amount')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(voucher.lines ?? []).map((l) => (
                      <TableRow key={l.id}>
                        <TableCell>
                          <span className="mr-2 font-mono text-xs text-muted-foreground">
                            {l.account.code}
                          </span>
                          {accountName(l.account, language)}
                          {l.description && (
                            <div className="text-xs text-muted-foreground">{l.description}</div>
                          )}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(l.amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
          <JournalPanel sourceType="voucher" sourceId={voucher.id} />
        </div>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('accounting.journals.details')}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">{t('accounting.amount')}</dt>
                  <dd className="font-semibold tabular-nums">{formatCurrency(voucher.amount)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">{t('accounting.bank.account')}</dt>
                  <dd>
                    {voucher.voucherType === 'contra'
                      ? `${voucher.bankAccount?.name} → ${voucher.toBankAccount?.name}`
                      : voucher.bankAccount?.name}
                  </dd>
                </div>
                {voucher.partyName && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">{t('accounting.vouchers.partyName')}</dt>
                    <dd>{voucher.partyName}</dd>
                  </div>
                )}
                {voucher.reference && (
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">{t('accounting.journals.reference')}</dt>
                    <dd>{voucher.reference}</dd>
                  </div>
                )}
                {voucher.narration && <p className="text-muted-foreground">{voucher.narration}</p>}
              </dl>
            </CardContent>
          </Card>
          <TrailCard
            entries={[
              { label: t('accounting.journals.createdTrail'), user: voucher.creator, at: voucher.createdAt },
              { label: t('accounting.journals.postedTrail'), user: voucher.poster, at: voucher.postedAt },
              { label: t('accounting.voidedTrail'), user: voucher.voider, at: voucher.voidedAt },
            ]}
          />
        </div>
      </div>
      <RejectDialog
        title={t('accounting.voidTitle', { number: voucher.number })}
        description={t('accounting.voidHint')}
        confirmLabel={t('accounting.void')}
        open={voiding}
        onOpenChange={setVoiding}
        loading={action.isPending}
        onConfirm={(reason) =>
          action.mutate(
            { id: voucher.id, action: 'void', reason },
            {
              onSuccess: () => (
                toast.success(t('accounting.toast.voided', { number: voucher.number })),
                setVoiding(false)
              ),
              onError: (err) => toast.error(err.message),
            },
          )
        }
      />
    </>
  );
}

function ExistingVoucher({ id }: { id: string }) {
  const { can } = usePermission();
  const voucher = useVoucher(id);
  if (voucher.isPending) return <PageSkeleton />;
  const doc = voucher.data;
  if (!doc) return null;
  return doc.status === 'draft' && can('accounting.update') ? (
    <VoucherForm key={doc.id} voucher={doc} type={doc.voucherType} />
  ) : (
    <VoucherView voucher={doc} />
  );
}

export default function VoucherPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const type = (['receipt', 'payment', 'contra'] as const).find((x) => x === params.get('type')) ?? 'payment';
  return !id || id === 'new' ? <VoucherForm key={type} type={type} /> : <ExistingVoucher id={id} />;
}
