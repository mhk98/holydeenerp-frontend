import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import { MonitorSmartphone, Pencil, Plus, Trash2 } from 'lucide-react';
import { usePermission } from '@/hooks/use-permission';
import { applyServerErrors } from '@/lib/form';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { SwitchField, TextareaField, TextField } from '@/components/common/fields';
import { PageHeader } from '@/components/common/page-header';
import { StatusBadge } from '@/components/common/status-badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { WarehouseSelect } from '@/features/inventory/components/warehouse-select';
import { SupplierSelect } from '@/features/purchase/components/supplier-select';
import { useDeleteRegister, useRegisters, useSaveRegister } from '@/features/pos/api/pos-api';
import type { PosRegister, PosSettings } from '@/features/pos/types';
import { usePreferences, useSavePreferences } from '../api/settings-api';
import { SettingsFormCard } from '../components/settings-form-card';

const numberList = (max: number) =>
  z
    .string()
    .trim()
    .regex(/^\d+(\.\d+)?(\s*,\s*\d+(\.\d+)?)*$/, 'settings.pos.listFormat')
    .refine((s) => s.split(',').length <= max, 'settings.pos.listMax');
const toNumbers = (s: string, desc = false) =>
  [...new Set(s.split(',').map((x) => Number(x.trim())))].sort((a, b) => (desc ? b - a : a - b));

const schema = z.object({
  denominations: numberList(20),
  quickCash: numberList(8).or(z.literal('')),
  allowPriceEdit: z.boolean(),
  maxDiscountPercent: z
    .string()
    .regex(/^\d{1,3}(\.\d{1,2})?$/, 'validation.decimal')
    .refine((s) => Number(s) <= 100, 'validation.tooLarge'),
  autoPrint: z.boolean(),
  receiptFooter: z.string().max(500, 'validation.tooLong'),
  offlineEnabled: z.boolean(),
});
type Values = z.infer<typeof schema>;

/** Settings → POS: cashier limits, receipt, offline mode, drawer denominations, and the registers. */
export default function PosSettingsPage() {
  const { t } = useTranslation();
  const prefs = usePreferences('pos');
  const save = useSavePreferences('pos');
  const form = useForm<Values>({ resolver: zodResolver(schema) });

  useEffect(() => {
    if (!prefs.data) return;
    const d = prefs.data satisfies PosSettings;
    form.reset({
      denominations: d.denominations.join(', '),
      quickCash: d.quickCash.join(', '),
      allowPriceEdit: d.allowPriceEdit,
      maxDiscountPercent: String(d.maxDiscountPercent),
      autoPrint: d.autoPrint,
      receiptFooter: d.receiptFooter,
      offlineEnabled: d.offlineEnabled,
    });
  }, [prefs.data, form]);

  const onSubmit = form.handleSubmit((v) =>
    save.mutate(
      {
        denominations: toNumbers(v.denominations, true),
        quickCash: v.quickCash ? toNumbers(v.quickCash) : [],
        allowPriceEdit: v.allowPriceEdit,
        maxDiscountPercent: Number(v.maxDiscountPercent),
        autoPrint: v.autoPrint,
        receiptFooter: v.receiptFooter,
        offlineEnabled: v.offlineEnabled,
      },
      {
        onSuccess: () => toast.success(t('settings.saved')),
        onError: (err) => {
          if (!applyServerErrors(err, form.setError)) toast.error(err.message);
        },
      },
    ),
  );

  return (
    <>
      <PageHeader
        title={t('settings.pos.title')}
        description={t('settings.pos.description')}
        breadcrumbs={[{ label: t('nav.settings'), to: '/settings' }, { label: t('settings.pos.title') }]}
      />
      <div className="flex flex-col gap-6">
        <RegistersCard />
        {!prefs.data ? (
          <Skeleton className="h-96 rounded-xl" />
        ) : (
          <SettingsFormCard
            title={t('settings.pos.cardTitle')}
            description={t('settings.pos.cardHint')}
            onSubmit={onSubmit}
            saving={save.isPending}
            dirty={form.formState.isDirty}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                control={form.control}
                name="maxDiscountPercent"
                inputMode="decimal"
                label={t('settings.pos.maxDiscount')}
                description={t('settings.pos.maxDiscountHint')}
              />
              <SwitchField
                control={form.control}
                name="allowPriceEdit"
                label={t('settings.pos.allowPriceEdit')}
                description={t('settings.pos.allowPriceEditHint')}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                control={form.control}
                name="denominations"
                label={t('settings.pos.denominations')}
                description={t('settings.pos.denominationsHint')}
              />
              <TextField
                control={form.control}
                name="quickCash"
                label={t('settings.pos.quickCash')}
                description={t('settings.pos.quickCashHint')}
              />
            </div>
            <SwitchField
              control={form.control}
              name="autoPrint"
              label={t('settings.pos.autoPrint')}
              description={t('settings.pos.autoPrintHint')}
            />
            <SwitchField
              control={form.control}
              name="offlineEnabled"
              label={t('settings.pos.offline')}
              description={t('settings.pos.offlineHint')}
            />
            <TextareaField
              control={form.control}
              name="receiptFooter"
              label={t('settings.pos.footer')}
              description={t('settings.pos.footerHint')}
              rows={2}
            />
          </SettingsFormCard>
        )}
      </div>
    </>
  );
}

function RegistersCard() {
  const { t } = useTranslation();
  const { can } = usePermission();
  const list = useRegisters({ limit: 100, sort: 'name' });
  const remove = useDeleteRegister();
  const [editing, setEditing] = useState<PosRegister | 'new' | null>(null);
  const [deleting, setDeleting] = useState<PosRegister | null>(null);
  const canEdit = can('settings.update');

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>{t('settings.pos.registers')}</CardTitle>
          <CardDescription>{t('settings.pos.registersHint')}</CardDescription>
        </div>
        {canEdit && (
          <Button onClick={() => setEditing('new')}>
            <Plus aria-hidden /> {t('settings.pos.newRegister')}
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {list.isPending ? (
          <Skeleton className="h-32" />
        ) : !list.data?.rows.length ? (
          <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
            <MonitorSmartphone className="size-8" aria-hidden />
            {t('settings.pos.noRegisters')}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('settings.pos.register')}</TableHead>
                  <TableHead>{t('inventory.warehouse')}</TableHead>
                  <TableHead>{t('settings.pos.walkInCustomer')}</TableHead>
                  <TableHead>{t('settings.pos.paper')}</TableHead>
                  <TableHead>{t('common.status')}</TableHead>
                  <TableHead className="w-24">
                    <span className="sr-only">{t('common.actions')}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.data.rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <div className="font-medium">{r.name}</div>
                      <code className="font-mono text-xs text-muted-foreground">{r.code}</code>
                    </TableCell>
                    <TableCell>
                      {r.warehouse.name}
                      <div className="text-xs text-muted-foreground">{r.branch.name}</div>
                    </TableCell>
                    <TableCell>{r.defaultCustomer?.name ?? '—'}</TableCell>
                    <TableCell>{t(`settings.pos.papers.${r.receiptPaper}`)}</TableCell>
                    <TableCell>
                      {r.openSession ? (
                        <StatusBadge tone="success">
                          {t('settings.pos.openNow', { number: r.openSession.number })}
                        </StatusBadge>
                      ) : (
                        <StatusBadge tone={r.isActive ? 'neutral' : 'danger'}>
                          {t(r.isActive ? 'settings.pos.closed' : 'common.inactive')}
                        </StatusBadge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {canEdit && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setEditing(r)}
                            aria-label={t('common.edit')}
                          >
                            <Pencil aria-hidden />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setDeleting(r)}
                            aria-label={t('common.delete')}
                          >
                            <Trash2 aria-hidden />
                          </Button>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      {editing && (
        <RegisterDialog register={editing === 'new' ? null : editing} onClose={() => setEditing(null)} />
      )}
      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(o) => !o && setDeleting(null)}
        destructive
        title={t('settings.pos.deleteTitle')}
        description={t('settings.pos.deleteText')}
        confirmLabel={t('common.delete')}
        loading={remove.isPending}
        onConfirm={() =>
          remove.mutate(deleting!.id, {
            onSuccess: () => (toast.success(t('settings.pos.deleted')), setDeleting(null)),
            onError: (err) => (toast.error(err.message), setDeleting(null)),
          })
        }
      />
    </Card>
  );
}

function RegisterDialog({ register, onClose }: { register: PosRegister | null; onClose: () => void }) {
  const { t } = useTranslation();
  const save = useSaveRegister();
  const [name, setName] = useState(register?.name ?? '');
  const [code, setCode] = useState(register?.code ?? '');
  const [warehouseId, setWarehouseId] = useState<string | null>(register?.warehouseId ?? null);
  const [customerId, setCustomerId] = useState<string | null>(register?.defaultCustomerId ?? null);
  const [customerLabel, setCustomerLabel] = useState(register?.defaultCustomer?.name ?? null);
  const [paper, setPaper] = useState<PosRegister['receiptPaper']>(register?.receiptPaper ?? 'thermal_80');
  const [isActive, setIsActive] = useState(register?.isActive ?? true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = () =>
    save.mutate(
      {
        id: register?.id,
        data: { name, code, warehouseId, defaultCustomerId: customerId, receiptPaper: paper, isActive },
      },
      {
        onSuccess: () => {
          toast.success(t('settings.pos.saved'));
          onClose();
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
    <Dialog open onOpenChange={(o) => !o && !save.isPending && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{register ? register.name : t('settings.pos.newRegister')}</DialogTitle>
          <DialogDescription>{t('settings.pos.registerHint')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_9rem]">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reg-name">{t('settings.pos.registerName')}</Label>
              <Input
                id="reg-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={Boolean(errors.name)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reg-code">{t('settings.pos.registerCode')}</Label>
              <Input
                id="reg-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                className="font-mono"
                aria-invalid={Boolean(errors.code)}
              />
              {errors.code && <p className="text-xs text-destructive">{errors.code}</p>}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t('settings.pos.sellsFrom')}</Label>
            <WarehouseSelect
              value={warehouseId}
              onChange={setWarehouseId}
              aria-invalid={Boolean(errors.warehouseId)}
            />
            {errors.warehouseId && <p className="text-xs text-destructive">{errors.warehouseId}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t('settings.pos.walkInCustomer')}</Label>
            <SupplierSelect
              type="customer"
              value={customerId}
              selectedLabel={customerLabel}
              onChange={(id, c) => {
                setCustomerId(id);
                setCustomerLabel(c.name);
              }}
            />
            <p className="text-xs text-muted-foreground">{t('settings.pos.walkInHint')}</p>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>{t('settings.pos.paper')}</Label>
            <Select value={paper} onValueChange={(v) => setPaper(v as typeof paper)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="thermal_80">{t('settings.pos.papers.thermal_80')}</SelectItem>
                <SelectItem value="a4">{t('settings.pos.papers.a4')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-center justify-between gap-4">
            <span className="text-sm font-medium">{t('common.active')}</span>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={save.isPending}>
            {t('common.cancel')}
          </Button>
          <Button onClick={submit} disabled={save.isPending || !name.trim() || !code.trim() || !warehouseId}>
            {save.isPending && <Spinner />} {t('common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
