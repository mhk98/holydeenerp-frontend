import { useTranslation } from 'react-i18next';
import { formatCurrency } from '@/lib/format';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useBankAccountOptions } from '../api/banking-api';
import { KIND_ICON } from '../lib';
import type { MoneyKind } from '../types';

interface Props {
  value: string | null | undefined;
  onChange: (id: string) => void;
  /** Hide one account (e.g. the "from" account of a transfer). */
  exclude?: string | null;
  kinds?: MoneyKind[];
  disabled?: boolean;
  id?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  'aria-label'?: string;
}

/** Cash / bank / wallet account picker showing each account's current balance. */
export function BankAccountSelect({ value, onChange, exclude, kinds, disabled, ...aria }: Props) {
  const { t } = useTranslation();
  const options = useBankAccountOptions();
  const rows = (options.data ?? []).filter((b) => b.id !== exclude && (!kinds || kinds.includes(b.kind)));
  return (
    <Select value={value ?? ''} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full" {...aria}>
        <SelectValue placeholder={t('accounting.bank.pick')} />
      </SelectTrigger>
      <SelectContent>
        {rows.map((b) => {
          const Icon = KIND_ICON[b.kind];
          return (
            <SelectItem key={b.id} value={b.id}>
              <Icon className="text-muted-foreground" aria-hidden />
              <span>{b.name}</span>
              <span className="ml-auto pl-3 text-xs text-muted-foreground tabular-nums">
                {formatCurrency(b.balance)}
              </span>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
