import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Ban, HandCoins, Wallet } from 'lucide-react';
import { usePermission } from '@/hooks/use-permission';
import { formatCurrency, formatDate } from '@/lib/format';
import { applyServerErrors } from '@/lib/form';
import { useSettingsStore } from '@/stores/settings-store';
import { PageHeader } from '@/components/common/page-header';
import { PageSkeleton } from '@/components/common/page-skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { RejectDialog } from '@/features/inventory/components/reject-dialog';
import { BillsAllocationTable } from '@/features/purchase/components/apply-credit-dialog';
import { TrailCard } from '@/features/purchase/components/purchase-ui';
import { SupplierSelect } from '@/features/purchase/components/supplier-select';
import { useAllocations } from '@/features/purchase/components/use-allocations';
import {
  useCreateReceipt,
  useCustomerOpenItems,
  useReceipt,
  useSalesLookups,
  useVoidReceipt,
} from '../api/sales-api';
import { ApplyCustomerCreditDialog } from '../components/apply-customer-credit-dialog';
import { SalesStatusBadge } from '../components/sales-ui';
import { SALES_ROUTES, nullIfEmpty, todayIn } from '../lib';

/** Record money received from a customer and allocate it to open invoices. */
function NewReceipt() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const timezone = useSettingsStore((s) => s.timezone);
  const lookups = useSalesLookups();
  const create = useCreateReceipt();
  const [customerId, setCustomerId] = useState<string | null>(params.get('customerId'));
  const [customerLabel, setCustomerLabel] = useState<string | null>(null);
  const [methodId, setMethodId] = useState('');
  const [date, setDate] = useState(todayIn(timezone));
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const open = useCustomerOpenItems(customerId);
  const alloc = useAllocations();
  const prefillInvoice = params.get('invoiceId');

  // Coming from an invoice: receive its balance (once, when the open items arrive).
  const [prefilled, setPrefilled] = useState(false);
  if (!prefilled && open.data) {
    setPrefilled(true);
    setCustomerLabel(`${open.data.customer.name} (${open.data.customer.code})`);
    const inv = prefillInvoice ? open.data.invoices.find((i) => i.id === prefillInvoice) : undefined;
    if (inv) {
      setAmount(String(Number(inv.balance)));
      alloc.setAmounts({ [inv.id]: String(Number(inv.balance)) });
    }
  }

  const method = lookups.data?.paymentMethods.find((m) => m.id === methodId);
  const over = alloc.total > (Number(amount) || 0) + 1e-9;
  const advance = (Number(amount) || 0) - alloc.total;

  const submit = () =>
    create.mutate(
      {
        customerId,
        paymentMethodId: methodId,
        receiptDate: date,
        amount,
        reference: nullIfEmpty(reference),
        notes: nullIfEmpty(notes),
        allocations: alloc.list('invoiceId'),
      },
      {
        onSuccess: (r) => {
          toast.success(t('sales.toast.receiptRecorded', { number: r.number }));
          navigate(`${SALES_ROUTES.receipt}/${r.id}`, { replace: true });
        },
        onError: (err) => {
          const fieldErrors: Record<string, string> = {};
          applyServerErrors(err, (field, e) => {
            fieldErrors[String(field)] = String(e.message);
          });
          setErrors(fieldErrors);
          toast.error(err.message);
        },
      },
    );

  return (
    <>
      <PageHeader
        title={t('sales.receipts.new')}
        description={t('sales.receipts.newHint')}
        breadcrumbs={[
          { label: t('nav.sales') },
          { label: t('sales.receipts.title'), to: SALES_ROUTES.receipt },
          { label: t('common.new') },
        ]}
        actions={
          <Button
            onClick={submit}
            disabled={create.isPending || !customerId || !methodId || !(Number(amount) > 0) || over}
          >
            {create.isPending ? <Spinner /> : <Wallet aria-hidden />} {t('sales.receipts.record')}
          </Button>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('inventory.details')}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label>{t('sales.customer')}</Label>
                  <SupplierSelect
                    type="customer"
                    value={customerId}
                    selectedLabel={customerLabel}
                    onChange={(cid, c) => {
                      setCustomerId(cid);
                      setCustomerLabel(`${c.name} (${c.code})`);
                      alloc.setAmounts({});
                    }}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label>{t('purchase.paymentMethod')}</Label>
                  <Select value={methodId} onValueChange={setMethodId}>
                    <SelectTrigger className="w-full" aria-invalid={Boolean(errors.paymentMethodId)}>
                      <SelectValue placeholder={t('purchase.payments.pickMethod')} />
                    </SelectTrigger>
                    <SelectContent>
                      {(lookups.data?.paymentMethods ?? []).map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="rcpt-date">{t('purchase.date')}</Label>
                  <Input id="rcpt-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="rcpt-amount">{t('purchase.amount')}</Label>
                  <Input
                    id="rcpt-amount"
                    inputMode="decimal"
                    className="text-right tabular-nums"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.trim())}
                    aria-invalid={Boolean(errors.amount)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="rcpt-ref">
                    {t('purchase.reference')}
                    {method?.requiresReference && ' *'}
                  </Label>
                  <Input
                    id="rcpt-ref"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    aria-invalid={Boolean(errors.reference)}
                    placeholder={method?.requiresReference ? t('purchase.payments.referenceHint') : ''}
                  />
                  {errors.reference && <p className="text-xs text-destructive">{errors.reference}</p>}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="rcpt-notes">{t('inventory.notes')}</Label>
                <Textarea id="rcpt-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">{t('purchase.payments.allocation')}</CardTitle>
                <CardDescription>{t('sales.receipts.allocationHint')}</CardDescription>
              </div>
              {customerId && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => alloc.autoFill(open.data?.invoices ?? [], Number(amount) || 0)}
                  disabled={!(Number(amount) > 0)}
                >
                  {t('purchase.payments.autoAllocate')}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {!customerId ? (
                <p className="text-sm text-muted-foreground">{t('sales.receipts.pickCustomerFirst')}</p>
              ) : open.isPending ? (
                <Skeleton className="h-32" />
              ) : (
                <BillsAllocationTable
                  bills={open.data?.invoices ?? []}
                  amounts={alloc.amounts}
                  onChange={(id, value) => alloc.setAmounts((a) => ({ ...a, [id]: value }))}
                  docLabel={t('sales.invoices.entity')}
                  emptyLabel={t('sales.receipts.noOpenInvoices')}
                />
              )}
            </CardContent>
          </Card>
        </div>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('purchase.totals')}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('purchase.amount')}</span>
                <span className="tabular-nums">{formatCurrency(Number(amount) || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('purchase.payments.allocated')}</span>
                <span className="tabular-nums">{formatCurrency(alloc.total)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 font-medium">
                <span>{t('sales.receipts.advance')}</span>
                <span className="tabular-nums">{formatCurrency(Math.max(advance, 0))}</span>
              </div>
              {over && (
                <Alert variant="destructive">
                  <AlertDescription>{t('purchase.payments.overAllocated')}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
          {open.data && Boolean(open.data.credits.length) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t('purchase.payments.existingCredits')}</CardTitle>
                <CardDescription>{t('sales.receipts.existingCreditsHint')}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-1 text-sm">
                  {open.data.credits.map((c) => (
                    <li key={`${c.sourceType}:${c.id}`} className="flex justify-between gap-2">
                      <Link
                        to={`${c.sourceType === 'receipt' ? SALES_ROUTES.receipt : SALES_ROUTES.return}/${c.id}`}
                        className="font-mono text-xs text-primary hover:underline"
                      >
                        {c.number}
                      </Link>
                      <span className="tabular-nums">{formatCurrency(c.available)}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function ReceiptView({ id }: { id: string }) {
  const { t } = useTranslation();
  const { can } = usePermission();
  const receipt = useReceipt(id);
  const voidReceipt = useVoidReceipt();
  const [voiding, setVoiding] = useState(false);
  const [applying, setApplying] = useState(false);
  if (receipt.isPending) return <PageSkeleton />;
  const r = receipt.data;
  if (!r) return null;
  return (
    <>
      <PageHeader
        title={`${t('sales.receipts.entity')} ${r.number}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <SalesStatusBadge status={r.status} /> {r.customer.name} · {formatDate(r.receiptDate)} ·{' '}
            {r.paymentMethod.name}
          </span>
        }
        breadcrumbs={[
          { label: t('nav.sales') },
          { label: t('sales.receipts.title'), to: SALES_ROUTES.receipt },
          { label: r.number },
        ]}
        actions={
          <>
            {r.status === 'posted' && can(['sales.approve', 'accounting.approve']) && (
              <Button variant="outline" onClick={() => setVoiding(true)}>
                <Ban aria-hidden /> {t('purchase.payments.void')}
              </Button>
            )}
            {r.status === 'posted' &&
              Number(r.unallocated) > 0 &&
              can(['sales.create', 'accounting.create']) && (
                <Button onClick={() => setApplying(true)}>
                  <HandCoins aria-hidden /> {t('sales.receipts.applyAdvance')}
                </Button>
              )}
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">{t('purchase.payments.allocation')}</CardTitle>
          </CardHeader>
          <CardContent>
            {!r.allocations?.length ? (
              <p className="text-sm text-muted-foreground">{t('purchase.payments.noAllocations')}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('sales.invoices.entity')}</TableHead>
                    <TableHead>{t('purchase.date')}</TableHead>
                    <TableHead>{t('purchase.dueDate')}</TableHead>
                    <TableHead className="text-right">{t('purchase.amount')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {r.allocations.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <Link
                          to={`${SALES_ROUTES.invoice}/${a.invoice.id}`}
                          className="font-mono text-xs text-primary hover:underline"
                        >
                          {a.invoice.number}
                        </Link>
                      </TableCell>
                      <TableCell>{formatDate(a.invoice.invoiceDate)}</TableCell>
                      <TableCell>{formatDate(a.invoice.dueDate)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(a.amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t('purchase.totals')}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('purchase.amount')}</span>
                <span className="font-semibold tabular-nums">{formatCurrency(r.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('purchase.payments.allocated')}</span>
                <span className="tabular-nums">{formatCurrency(r.allocatedAmount)}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span>{t('sales.receipts.advance')}</span>
                <span className="tabular-nums">{formatCurrency(r.unallocated)}</span>
              </div>
              {r.reference && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('purchase.reference')}</span>
                  <span>{r.reference}</span>
                </div>
              )}
              {r.notes && <p className="text-muted-foreground">{r.notes}</p>}
              {r.status === 'void' && r.voidReason && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {t('purchase.payments.voidedBecause', { reason: r.voidReason })}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
          <TrailCard
            entries={[
              { label: t('purchase.trail.recorded'), user: r.creator, at: r.createdAt },
              { label: t('purchase.trail.voided'), user: r.voider, at: r.voidedAt },
            ]}
          />
        </div>
      </div>
      <RejectDialog
        title={t('sales.receipts.voidTitle')}
        description={t('sales.receipts.voidHint')}
        confirmLabel={t('purchase.payments.void')}
        open={voiding}
        onOpenChange={setVoiding}
        loading={voidReceipt.isPending}
        onConfirm={(reason) =>
          voidReceipt.mutate(
            { id, reason },
            {
              onSuccess: () => (toast.success(t('sales.toast.receiptVoided')), setVoiding(false)),
              onError: (err) => toast.error(err.message),
            },
          )
        }
      />
      {applying && (
        <ApplyCustomerCreditDialog
          sourceType="receipt"
          sourceId={r.id}
          customerId={r.customerId}
          available={r.unallocated}
          onClose={() => setApplying(false)}
        />
      )}
    </>
  );
}

export default function CustomerReceiptPage() {
  const { id } = useParams();
  return !id || id === 'new' ? <NewReceipt /> : <ReceiptView id={id} />;
}
