import { useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Check, ChevronsUpDown, Truck, UserRound } from 'lucide-react';
import { useDebouncedValue } from '@/hooks/use-debounce';
import { apiList } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Party } from '@/types';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Spinner } from '@/components/ui/spinner';

interface Props {
  /** Suppliers (default) or customers. */
  type?: 'supplier' | 'customer';
  value: string | null | undefined;
  onChange: (id: string, supplier: Party) => void;
  /** Label for the current value when it isn't in the loaded page (e.g. an existing document). */
  selectedLabel?: string | null;
  disabled?: boolean;
  id?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

/** Searchable supplier / customer picker (active parties, by name, code or phone). */
export function SupplierSelect({
  type = 'supplier',
  value,
  onChange,
  selectedLabel,
  disabled,
  ...aria
}: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const term = useDebouncedValue(search, 250);
  const list = useQuery({
    queryKey: [`${type}s`, 'picker', term],
    queryFn: async () =>
      (
        await apiList<Party>(`/${type}s`, {
          search: term || undefined,
          isActive: 'true',
          limit: 30,
          sort: 'name',
        })
      ).rows,
    enabled: open,
    placeholderData: keepPreviousData,
  });
  const current = list.data?.find((s) => s.id === value);
  const label = current ? `${current.name} (${current.code})` : selectedLabel;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between font-normal', !label && 'text-muted-foreground')}
          {...aria}
        >
          <span className="flex min-w-0 items-center gap-2">
            {type === 'customer' ? (
              <UserRound className="text-muted-foreground" aria-hidden />
            ) : (
              <Truck className="text-muted-foreground" aria-hidden />
            )}
            <span className="truncate">
              {label ?? t(type === 'customer' ? 'sales.pickCustomer' : 'purchase.pickSupplier')}
            </span>
          </span>
          <ChevronsUpDown className="opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(28rem,calc(100vw-2rem))] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            value={search}
            onValueChange={setSearch}
            placeholder={t(type === 'customer' ? 'sales.searchCustomer' : 'purchase.searchSupplier')}
          />
          <CommandList>
            {list.isFetching && !list.data?.length && (
              <div className="flex justify-center py-6">
                <Spinner />
              </div>
            )}
            {!list.isFetching && (
              <CommandEmpty>
                {t(type === 'customer' ? 'sales.noCustomers' : 'purchase.noSuppliers')}
              </CommandEmpty>
            )}
            <CommandGroup>
              {(list.data ?? []).map((s) => (
                <CommandItem
                  key={s.id}
                  value={s.id}
                  onSelect={() => {
                    onChange(s.id, s);
                    setOpen(false);
                  }}
                >
                  <Check className={cn(value === s.id ? 'opacity-100' : 'opacity-0')} aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{s.name}</div>
                    <div className="text-xs text-muted-foreground">
                      <span className="font-mono">{s.code}</span>
                      {s.phone && ` · ${s.phone}`}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
