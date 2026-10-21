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
import {
  useCreatePayment,
  useOpenItems,
  usePayment,
  usePurchaseLookups,
  useVoidPayment,
} from '../api/purchase-api';
import { ApplyCreditDialog, BillsAllocationTable } from '../components/apply-credit-dialog';
import { useAllocations } from '../components/use-allocations';
import { PurchaseStatusBadge, TrailCard } from '../components/purchase-ui';
import { SupplierSelect } from '../components/supplier-select';
import { DOC_ROUTES, nullIfEmpty, todayIn } from '../lib';

/** Record a supplier payment and allocate it to open bills. */
function NewPayment() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const timezone = useSettingsStore((s) => s.timezone);
  const lookups = usePurchaseLookups();
  const create = useCreatePayment();
  const [supplierId, setSupplierId] = useState<string | null>(params.get('supplierId'));
  const [supplierLabel, setSupplierLabel] = useState<string | null>(null);
  const [methodId, setMethodId] = useState('');
  const [date, setDate] = useState(todayIn(timezone));
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const open = useOpenItems(supplierId);
  const alloc = useAllocations();
  const prefillBill = params.get('billId');

  // Coming from a bill: pay its balance (once, when its open items arrive).
  const [prefilled, setPrefilled] = useState(false);
  if (!prefilled && prefillBill && open.data) {
    setPrefilled(true);
    const bill = open.data.bills.find((b) => b.id === prefillBill);
    if (bill) {
      setAmount(String(Number(bill.balance)));
      alloc.setAmounts({ [bill.id]: String(Number(bill.balance)) });
      setSupplierLabel(open.data.supplier.name);
    }
  }

  const method = lookups.data?.paymentMethods.find((m) => m.id === methodId);
  const over = alloc.total > (Number(amount) || 0) + 1e-9;
  const advance = (Number(amount) || 0) - alloc.total;

  const submit = () =>
    create.mutate(
      {
        supplierId,
        paymentMethodId: methodId,
        paymentDate: date,
        amount,
        reference: nullIfEmpty(reference),
        notes: nullIfEmpty(notes),
        allocations: alloc.list(),
      },
      {
        onSuccess: (p) => {
          toast.success(t('purchase.toast.paymentRecorded', { number: p.number }));
          navigate(`${DOC_ROUTES.payment}/${p.id}`, { replace: true });
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
        title={t('purchase.payments.new')}
        description={t('purchase.payments.newHint')}
        breadcrumbs={[
          { label: t('nav.purchases') },
          { label: t('purchase.payments.title'), to: DOC_ROUTES.payment },
          { label: t('common.new') },
        ]}
        actions={
          <Button
            onClick={submit}
            disabled={create.isPending || !supplierId || !methodId || !(Number(amount) > 0) || over}
          >
            {create.isPending ? <Spinner /> : <Wallet aria-hidden />} {t('purchase.payments.record')}
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
                  <Label>{t('purchase.supplier')}</Label>
                  <SupplierSelect
                    value={supplierId}
                    selectedLabel={supplierLabel}
                    onChange={(id, s) => {
                      setSupplierId(id);
                      setSupplierLabel(s.name);
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
                  <Label htmlFor="pay-date">{t('purchase.date')}</Label>
                  <Input id="pay-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="pay-amount">{t('purchase.amount')}</Label>
                  <Input
                    id="pay-amount"
                    inputMode="decimal"
                    className="text-right tabular-nums"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value.trim())}
                    aria-invalid={Boolean(errors.amount)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="pay-ref">
                    {t('purchase.reference')}
                    {method?.requiresReference && ' *'}
                  </Label>
                  <Input
                    id="pay-ref"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    aria-invalid={Boolean(errors.reference)}
                    placeholder={method?.requiresReference ? t('purchase.payments.referenceHint') : ''}
                  />
                  {errors.reference && <p className="text-xs text-destructive">{errors.reference}</p>}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="pay-notes">{t('inventory.notes')}</Label>
                <Textarea id="pay-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex-row items-start justify-between gap-2">
              <div>
                <CardTitle className="text-base">{t('purchase.payments.allocation')}</CardTitle>
                <CardDescription>{t('purchase.payments.allocationHint')}</CardDescription>
              </div>
              {supplierId && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => alloc.autoFill(open.data?.bills ?? [], Number(amount) || 0)}
                  disabled={!(Number(amount) > 0)}
                >
                  {t('purchase.payments.autoAllocate')}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {!supplierId ? (
                <p className="text-sm text-muted-foreground">{t('purchase.payments.pickSupplierFirst')}</p>
              ) : open.isPending ? (
                <Skeleton className="h-32" />
              ) : (
                <BillsAllocationTable
                  bills={open.data?.bills ?? []}
                  amounts={alloc.amounts}
                  onChange={(id, value) => alloc.setAmounts((a) => ({ ...a, [id]: value }))}
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
                <span>{t('purchase.payments.advance')}</span>
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
                <CardDescription>{t('purchase.payments.existingCreditsHint')}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-1 text-sm">
                  {open.data.credits.map((c) => (
                    <li key={`${c.sourceType}:${c.id}`} className="flex justify-between gap-2">
                      <Link
                        to={`${c.sourceType === 'payment' ? DOC_ROUTES.payment : DOC_ROUTES.return}/${c.id}`}
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

function PaymentView({ id }: { id: string }) {
  const { t } = useTranslation();
  const { can } = usePermission();
  const payment = usePayment(id);
  const voidPayment = useVoidPayment();
  const [voiding, setVoiding] = useState(false);
  const [applying, setApplying] = useState(false);
  if (payment.isPending) return <PageSkeleton />;
  const p = payment.data;
  if (!p) return null;
  return (
    <>
      <PageHeader
        title={`${t('purchase.payments.entity')} ${p.number}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <PurchaseStatusBadge status={p.status} /> {p.supplier.name} · {formatDate(p.paymentDate)} ·{' '}
            {p.paymentMethod.name}
          </span>
        }
        breadcrumbs={[
          { label: t('nav.purchases') },
          { label: t('purchase.payments.title'), to: DOC_ROUTES.payment },
          { label: p.number },
        ]}
        actions={
          <>
            {p.status === 'posted' && can(['purchase.approve', 'accounting.approve']) && (
              <Button variant="outline" onClick={() => setVoiding(true)}>
                <Ban aria-hidden /> {t('purchase.payments.void')}
              </Button>
            )}
            {p.status === 'posted' &&
              Number(p.unallocated) > 0 &&
              can(['purchase.create', 'accounting.create']) && (
                <Button onClick={() => setApplying(true)}>
                  <HandCoins aria-hidden /> {t('purchase.payments.applyAdvance')}
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
            {!p.allocations?.length ? (
              <p className="text-sm text-muted-foreground">{t('purchase.payments.noAllocations')}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('purchase.bills.entity')}</TableHead>
                    <TableHead>{t('purchase.supplierInvoiceNo')}</TableHead>
                    <TableHead>{t('purchase.dueDate')}</TableHead>
                    <TableHead className="text-right">{t('purchase.amount')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {p.allocations.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>
                        <Link
                          to={`${DOC_ROUTES.bill}/${a.bill.id}`}
                          className="font-mono text-xs text-primary hover:underline"
                        >
                          {a.bill.number}
                        </Link>
                      </TableCell>
                      <TableCell>{a.bill.supplierInvoiceNo ?? '—'}</TableCell>
                      <TableCell>{formatDate(a.bill.dueDate)}</TableCell>
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
                <span className="font-semibold tabular-nums">{formatCurrency(p.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t('purchase.payments.allocated')}</span>
                <span className="tabular-nums">{formatCurrency(p.allocatedAmount)}</span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span>{t('purchase.payments.advance')}</span>
                <span className="tabular-nums">{formatCurrency(p.unallocated)}</span>
              </div>
              {p.reference && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('purchase.reference')}</span>
                  <span>{p.reference}</span>
                </div>
              )}
              {p.notes && <p className="text-muted-foreground">{p.notes}</p>}
              {p.status === 'void' && p.voidReason && (
                <Alert variant="destructive">
                  <AlertDescription>
                    {t('purchase.payments.voidedBecause', { reason: p.voidReason })}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
          <TrailCard
            entries={[
              { label: t('purchase.trail.recorded'), user: p.creator, at: p.createdAt },
              { label: t('purchase.trail.voided'), user: p.voider, at: p.voidedAt },
            ]}
          />
        </div>
      </div>
      <RejectDialog
        title={t('purchase.payments.voidTitle')}
        description={t('purchase.payments.voidHint')}
        confirmLabel={t('purchase.payments.void')}
        open={voiding}
        onOpenChange={setVoiding}
        loading={voidPayment.isPending}
        onConfirm={(reason) =>
          voidPayment.mutate(
            { id, reason },
            {
              onSuccess: () => (toast.success(t('purchase.toast.paymentVoided')), setVoiding(false)),
              onError: (err) => toast.error(err.message),
            },
          )
        }
      />
      {applying && (
        <ApplyCreditDialog
          sourceType="payment"
          sourceId={p.id}
          supplierId={p.supplierId}
          available={p.unallocated}
          onClose={() => setApplying(false)}
        />
      )}
    </>
  );
}

export default function PaymentPage() {
  const { id } = useParams();
  return !id || id === 'new' ? <NewPayment /> : <PaymentView id={id} />;
}
