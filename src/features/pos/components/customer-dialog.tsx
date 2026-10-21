import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Search, UserPlus, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { posApi } from '../api/pos-api';
import { usePos } from '../lib/pos-store';
import type { PosCustomer } from '../types';

/** Walk-in, pick a customer (from the device cache, by name / phone / code) or add one quickly. */
export function CustomerDialog({
  walkInId,
  onPick,
  onClose,
}: {
  walkInId: string | null;
  onPick: (customer: PosCustomer | null) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { customers, online, addCustomer } = usePos();
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [saving, setSaving] = useState(false);

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    return customers
      .filter((c) => c.id !== walkInId)
      .filter(
        (c) =>
          !term ||
          c.name.toLowerCase().includes(term) ||
          c.code.toLowerCase().includes(term) ||
          (c.phone ?? '').replace(/\D/g, '').includes(term.replace(/\D/g, '') || '\u0000'),
      )
      .slice(0, 50);
  }, [customers, search, walkInId]);

  const create = async () => {
    setSaving(true);
    try {
      const c = await posApi.quickCustomer({ name: name.trim(), phone: phone.trim() || null, email: null });
      addCustomer(c);
      toast.success(t('pos.customerAdded', { name: c.name }));
      onPick(c);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('pos.customerTitle')}</DialogTitle>
          <DialogDescription>{t('pos.customerHint')}</DialogDescription>
        </DialogHeader>
        {creating ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="qc-name">{t('pos.customerName')}</Label>
              <Input
                id="qc-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-12"
                autoFocus
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="qc-phone">{t('pos.customerPhone')}</Label>
              <Input
                id="qc-phone"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-12"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" className="h-12" onClick={() => setCreating(false)} disabled={saving}>
                {t('common.cancel')}
              </Button>
              <Button className="h-12" onClick={create} disabled={saving || name.trim().length < 2}>
                {saving ? <Spinner /> : <UserPlus aria-hidden />} {t('pos.addCustomer')}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                aria-hidden
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('sales.searchCustomer')}
                className="h-12 pl-9"
                autoFocus
                aria-label={t('sales.searchCustomer')}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-12" onClick={() => onPick(null)}>
                <UserRound aria-hidden /> {t('pos.walkIn')}
              </Button>
              <Button
                variant="outline"
                className="h-12"
                onClick={() => {
                  setName(/\d{5,}/.test(search) ? '' : search);
                  setPhone(/\d{5,}/.test(search) ? search : '');
                  setCreating(true);
                }}
                disabled={!online}
                title={online ? undefined : t('pos.needsConnection')}
              >
                <UserPlus aria-hidden /> {t('pos.newCustomer')}
              </Button>
            </div>
            <ul className="max-h-72 divide-y overflow-y-auto rounded-lg border">
              {shown.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted"
                    onClick={() => onPick(c)}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{c.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        <span className="font-mono">{c.code}</span>
                        {c.phone && ` · ${c.phone}`}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
              {!shown.length && (
                <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {t('sales.noCustomers')}
                </li>
              )}
            </ul>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
