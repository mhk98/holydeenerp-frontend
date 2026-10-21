import { useTranslation } from 'react-i18next';
import { Warehouse as WarehouseIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { InventoryWarehouse } from '@/types';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useInventoryWarehouses } from '../api/inventory-api';

const ALL = '__all__';

interface Props {
  value: string | null | undefined;
  onChange: (value: string | null) => void;
  /** Offer "All warehouses" (null). */
  allowAll?: boolean;
  /** Use this list instead of the user's warehouses (e.g. transfer destinations). */
  warehouses?: InventoryWarehouse[];
  exclude?: string | null;
  disabled?: boolean;
  className?: string;
  id?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  placeholder?: string;
}

/** Warehouse picker grouped by branch; also used as the page-level warehouse switcher. */
export function WarehouseSelect({
  value,
  onChange,
  allowAll,
  warehouses,
  exclude,
  disabled,
  className,
  placeholder,
  ...aria
}: Props) {
  const { t } = useTranslation();
  const mine = useInventoryWarehouses();
  const list = (warehouses ?? mine.data ?? []).filter((w) => w.id !== exclude && w.isActive !== false);
  const byBranch = new Map<string, { name: string; items: InventoryWarehouse[] }>();
  for (const w of list) {
    const group = byBranch.get(w.branch.id) ?? { name: w.branch.name, items: [] };
    group.items.push(w);
    byBranch.set(w.branch.id, group);
  }

  return (
    <Select
      value={value ?? (allowAll ? ALL : '')}
      onValueChange={(v) => onChange(v === ALL ? null : v)}
      disabled={disabled}
    >
      <SelectTrigger className={cn('w-full', className)} {...aria}>
        <WarehouseIcon className="text-muted-foreground" aria-hidden />
        <SelectValue placeholder={placeholder ?? t('inventory.pickWarehouse')} />
      </SelectTrigger>
      <SelectContent>
        {allowAll && <SelectItem value={ALL}>{t('inventory.allWarehouses')}</SelectItem>}
        {[...byBranch.entries()].map(([branchId, group]) => (
          <SelectGroup key={branchId}>
            {byBranch.size > 1 && <SelectLabel>{group.name}</SelectLabel>}
            {group.items.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                <span className="flex-1">{w.name}</span>
                <span className="text-xs text-muted-foreground">{w.code}</span>
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
