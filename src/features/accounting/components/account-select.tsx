import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BookOpen, Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/stores/settings-store';
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
import { useAccountOptions } from '../api/accounting-api';
import { ACCOUNT_TYPES, type AccountOption, type AccountType } from '../types';
import { accountLabel, accountName } from '../lib';

interface Props {
  value: string | null | undefined;
  onChange: (id: string | null, account: AccountOption | null) => void;
  /** Only these account types. */
  types?: AccountType[];
  /** Hide these accounts (e.g. control accounts on the opening balances form). */
  exclude?: (a: AccountOption) => boolean;
  /** Show a "use the default" choice that clears the value. */
  clearLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
  'aria-label'?: string;
}

/** Searchable picker of postable (ledger) accounts, grouped by type; searches code and name. */
export function AccountSelect({
  value,
  onChange,
  types,
  exclude,
  clearLabel,
  placeholder,
  disabled,
  className,
  ...aria
}: Props) {
  const { t } = useTranslation();
  const language = useSettingsStore((s) => s.language);
  const [open, setOpen] = useState(false);
  const options = useAccountOptions();
  const all = (options.data ?? []).filter((a) => (!types || types.includes(a.type)) && !exclude?.(a));
  const current = options.data?.find((a) => a.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('w-full justify-between font-normal', !current && 'text-muted-foreground', className)}
          {...aria}
        >
          <span className="flex min-w-0 items-center gap-2">
            <BookOpen className="text-muted-foreground" aria-hidden />
            <span className="truncate">
              {current ? accountLabel(current, language) : (placeholder ?? t('accounting.pickAccount'))}
            </span>
          </span>
          <ChevronsUpDown className="opacity-50" aria-hidden />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[min(28rem,calc(100vw-2rem))] p-0" align="start">
        <Command>
          <CommandInput placeholder={t('accounting.searchAccount')} />
          <CommandList>
            {options.isPending && (
              <div className="flex justify-center py-6">
                <Spinner />
              </div>
            )}
            <CommandEmpty>{t('accounting.noAccounts')}</CommandEmpty>
            {clearLabel && (
              <CommandGroup>
                <CommandItem
                  value="__default__"
                  onSelect={() => {
                    onChange(null, null);
                    setOpen(false);
                  }}
                >
                  <Check className={cn(!value ? 'opacity-100' : 'opacity-0')} aria-hidden />
                  <span className="text-muted-foreground">{clearLabel}</span>
                </CommandItem>
              </CommandGroup>
            )}
            {ACCOUNT_TYPES.map((type) => {
              const rows = all.filter((a) => a.type === type);
              if (!rows.length) return null;
              return (
                <CommandGroup key={type} heading={t(`accounting.types.${type}`)}>
                  {rows.map((a) => (
                    <CommandItem
                      key={a.id}
                      value={`${a.code} ${a.name} ${a.nameBn ?? ''}`}
                      onSelect={() => {
                        onChange(a.id, a);
                        setOpen(false);
                      }}
                    >
                      <Check className={cn(value === a.id ? 'opacity-100' : 'opacity-0')} aria-hidden />
                      <span className="w-12 shrink-0 font-mono text-xs text-muted-foreground">{a.code}</span>
                      <span className="truncate">{accountName(a, language)}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
