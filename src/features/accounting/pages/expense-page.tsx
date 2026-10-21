import { useState } from 'react';
import { useForm, useWatch, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { Ban, Save, Send, Trash2 } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';
import { RejectDialog } from '@/features/inventory/components/reject-dialog';
import { TrailCard } from '@/features/purchase/components/purchase-ui';
import { todayIn } from '@/features/purchase/lib';
import { expenseCategoriesResource, useExpense, useExpenseAction, useSaveExpense } from '../api/banking-api';
import { AttachmentsCard } from '../components/attachments-card';
import { BankAccountSelect } from '../components/bank-account-select';
import { JournalPanel } from '../components/journal-panel';
import { ACCOUNTING_ROUTES, DOC_TONE, cents } from '../lib';
import type { Expense } from '../types';

const decimal = (allowZero: boolean) =>
  z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,4})?$/, 'validation.decimal')
    .refine(
      (s) => (allowZero ? Number(s) >= 0 : Number(s) > 0),
      allowZero ? 'validation.nonNegative' : 'validation.positive',
    );
const schema = z.object({
  expenseDate: v.required(),
  categoryId: v.required(),
  bankAccountId: v.required(),
  amount: decimal(false),
  taxAmount: decimal(true),
  payee: z.string().max(150, 'validation.tooLong'),
  reference: z.string().max(100, 'validation.tooLong'),
  description: z.string().max(500, 'validation.tooLong'),
});
type Values = z.infer<typeof schema>;

function ExpenseForm({ expense }: { expense?: Expense }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = usePermission();
  const timezone = useSettingsStore((s) => s.timezone);
  const categories = expenseCategoriesResource.useOptions({ isActive: 'true' });
  const save = useSaveExpense();
  const action = useExpenseAction();
  const [deleting, setDeleting] = useState(false);
  const form = useForm<Values>({
    resolver: zodResolver(schema) as Resolver<Values>,
    defaultValues: {
      expenseDate: expense?.expenseDate ?? todayIn(timezone),
      categoryId: expense?.categoryId ?? '',
      bankAccountId: expense?.bankAccountId ?? '',
      amount: expense ? String(Number(expense.amount)) : '',
      taxAmount: expense ? String(Number(expense.taxAmount)) : '0',
      payee: expense?.payee ?? '',
      reference: expense?.reference ?? '',
      description: expense?.description ?? '',
    },
  });
  const [amount, tax] = useWatch({ control: form.control, name: ['amount', 'taxAmount'] });

  const submit = (post: boolean) =>
    form.handleSubmit((values) =>
      save.mutate(
        {
          id: expense?.id,
          data: {
            ...values,
            payee: v.nullIfEmpty(values.payee),
            reference: v.nullIfEmpty(values.reference),
            description: v.nullIfEmpty(values.description),
            post,
          },
        },
        {
          onSuccess: (saved) => {
            toast.success(
              t(post ? 'accounting.toast.posted' : 'accounting.toast.draftSaved', { number: saved.number }),
            );
            navigate(`${ACCOUNTING_ROUTES.expenses}/${saved.id}`, { replace: true });
          },
          onError: (err) => {
            applyServerErrors(err, form.setError);
            toast.error(err.message);
          },
        },
      ),
    )();

  return (
    <>
      <PageHeader
        title={expense?.number ?? t('accounting.expenses.new')}
        description={t('accounting.expenses.newHint')}
        breadcrumbs={[
          { label: t('nav.accounting') },
          { label: t('accounting.expenses.title'), to: ACCOUNTING_ROUTES.expenses },
          { label: expense?.number ?? t('common.new') },
        ]}
        actions={
          <>
            {expense && can('accounting.delete') && (
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
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="expenseDate"
                label={t('accounting.date')}
                render={({ field, aria }) => <Input type="date" {...field} {...aria} />}
              />
              <FormField
                control={form.control}
                name="categoryId"
                label={t('accounting.expenses.category')}
                render={({ field, aria }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full" {...aria}>
                      <SelectValue placeholder={t('accounting.expenses.pickCategory')} />
                    </SelectTrigger>
                    <SelectContent>
                      {(categories.data ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FormField
                control={form.control}
                name="bankAccountId"
                label={t('accounting.vouchers.paidFrom')}
                render={({ field, aria }) => (
                  <BankAccountSelect value={field.value} onChange={field.onChange} {...aria} />
                )}
              />
              <FormField
                control={form.control}
                name="payee"
                label={t('accounting.expenses.payee')}
                render={({ field, aria }) => <Input {...field} {...aria} />}
              />
              <FormField
                control={form.control}
                name="amount"
                label={t('accounting.expenses.netAmount')}
                render={({ field, aria }) => (
                  <Input {...field} {...aria} inputMode="decimal" className="text-right tabular-nums" />
                )}
              />
              <FormField
                control={form.control}
                name="taxAmount"
                label={t('accounting.expenses.vat')}
                description={t('accounting.expenses.vatHint')}
                render={({ field, aria }) => (
                  <Input {...field} {...aria} inputMode="decimal" className="text-right tabular-nums" />
                )}
              />
              <FormField
                control={form.control}
                name="reference"
                label={t('accounting.expenses.billNo')}
                render={({ field, aria }) => <Input {...field} {...aria} />}
              />
              <FormField
                control={form.control}
                name="description"
                label={t('fields.description')}
                className="sm:col-span-2"
                render={({ field, aria }) => <Textarea rows={2} {...field} {...aria} />}
              />
            </CardContent>
          </Card>
          {expense && (
            <AttachmentsCard entityType="expense" entityId={expense.id} files={expense.attachments ?? []} />
          )}
          {!expense && (
            <p className="text-sm text-muted-foreground">{t('accounting.attachments.saveFirst')}</p>
          )}
        </div>
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">{t('accounting.total')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('accounting.expenses.netAmount')}</span>
              <span className="tabular-nums">{formatCurrency(cents(amount) / 100)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('accounting.expenses.vat')}</span>
              <span className="tabular-nums">{formatCurrency(cents(tax) / 100)}</span>
            </div>
            <div className="flex justify-between border-t pt-2 font-semibold">
              <span>{t('accounting.total')}</span>
              <span className="tabular-nums">{formatCurrency((cents(amount) + cents(tax)) / 100)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        destructive
        title={t('crud.deleteTitle', { entity: t('accounting.expenses.entity') })}
        description={expense && t('crud.deleteText', { name: expense.number })}
        confirmLabel={t('common.delete')}
        loading={action.isPending}
        onConfirm={() =>
          expense &&
          action.mutate(
            { id: expense.id, action: 'delete' },
            {
              onSuccess: () => navigate(ACCOUNTING_ROUTES.expenses, { replace: true }),
              onError: (err) => (toast.error(err.message), setDeleting(false)),
            },
          )
        }
      />
    </>
  );
}

function ExpenseView({ expense }: { expense: Expense }) {
  const { t } = useTranslation();
  const { can } = usePermission();
  const action = useExpenseAction();
  const [voiding, setVoiding] = useState(false);
  const row = (label: string, value: string | null | undefined) =>
    value ? (
      <div className="flex justify-between gap-2">
        <dt className="text-muted-foreground">{label}</dt>
        <dd className="text-right">{value}</dd>
      </div>
    ) : null;
  return (
    <>
      <PageHeader
        title={expense.number}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={DOC_TONE[expense.status]}>
              {t(`accounting.docStatus.${expense.status}`)}
            </StatusBadge>
            {expense.category?.name} · {formatDate(expense.expenseDate)}
          </span>
        }
        breadcrumbs={[
          { label: t('nav.accounting') },
          { label: t('accounting.expenses.title'), to: ACCOUNTING_ROUTES.expenses },
          { label: expense.number },
        ]}
        actions={
          expense.status === 'posted' &&
          can('accounting.approve') && (
            <Button variant="outline" onClick={() => setVoiding(true)}>
              <Ban aria-hidden /> {t('accounting.void')}
            </Button>
          )
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          {expense.status === 'void' && expense.voidReason && (
            <Alert variant="destructive">
              <AlertDescription>
                {t('accounting.voidedBecause', { reason: expense.voidReason })}
              </AlertDescription>
            </Alert>
          )}
          <AttachmentsCard entityType="expense" entityId={expense.id} files={expense.attachments ?? []} />
          <JournalPanel sourceType="expense" sourceId={expense.id} />
        </div>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('accounting.journals.details')}</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="flex flex-col gap-2 text-sm">
                {row(t('accounting.expenses.netAmount'), formatCurrency(expense.amount))}
                {row(t('accounting.expenses.vat'), formatCurrency(expense.taxAmount))}
                <div className="flex justify-between gap-2 border-t pt-2 font-semibold">
                  <dt>{t('accounting.total')}</dt>
                  <dd className="tabular-nums">{formatCurrency(expense.total)}</dd>
                </div>
                {row(t('accounting.vouchers.paidFrom'), expense.bankAccount?.name)}
                {row(t('accounting.expenses.payee'), expense.payee)}
                {row(t('accounting.expenses.billNo'), expense.reference)}
                {expense.description && <p className="text-muted-foreground">{expense.description}</p>}
              </dl>
            </CardContent>
          </Card>
          <TrailCard
            entries={[
              { label: t('accounting.journals.createdTrail'), user: expense.creator, at: expense.createdAt },
              { label: t('accounting.journals.postedTrail'), user: expense.poster, at: expense.postedAt },
              { label: t('accounting.voidedTrail'), user: expense.voider, at: expense.voidedAt },
            ]}
          />
        </div>
      </div>
      <RejectDialog
        title={t('accounting.voidTitle', { number: expense.number })}
        description={t('accounting.voidHint')}
        confirmLabel={t('accounting.void')}
        open={voiding}
        onOpenChange={setVoiding}
        loading={action.isPending}
        onConfirm={(reason) =>
          action.mutate(
            { id: expense.id, action: 'void', reason },
            {
              onSuccess: () => (
                toast.success(t('accounting.toast.voided', { number: expense.number })),
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

function ExistingExpense({ id }: { id: string }) {
  const { can } = usePermission();
  const expense = useExpense(id);
  if (expense.isPending) return <PageSkeleton />;
  const doc = expense.data;
  if (!doc) return null;
  return doc.status === 'draft' && can('accounting.update') ? (
    <ExpenseForm key={doc.id} expense={doc} />
  ) : (
    <ExpenseView expense={doc} />
  );
}

export default function ExpensePage() {
  const { id } = useParams();
  return !id || id === 'new' ? <ExpenseForm /> : <ExistingExpense id={id} />;
}
