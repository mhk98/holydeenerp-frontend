import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { PackagePlus, ScanBarcode } from 'lucide-react';
import { useDebouncedValue } from '@/hooks/use-debounce';
import { formatQuantity } from '@/lib/format';
import type { StockItem } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Spinner } from '@/components/ui/spinner';
import { searchItems, useItemSearch } from '../api/inventory-api';
import { itemLabel } from '../lib';

function TrackingBadges({ item }: { item: StockItem }) {
  const { t } = useTranslation();
  return (
    <>
      {item.lotTracked && (
        <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-normal">
          {t(item.trackExpiry ? 'inventory.tracking.expiry' : 'inventory.tracking.batch')}
        </Badge>
      )}
      {item.trackSerial && (
        <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-normal">
          {t('inventory.tracking.serial')}
        </Badge>
      )}
    </>
  );
}

interface Props {
  warehouseId?: string | null;
  onPick: (item: StockItem) => void;
  disabled?: boolean;
}

/**
 * Add items to a document: a scan field (barcode scanners type the code and press Enter — an
 * exact match is added at once) and a searchable list by name, SKU or barcode.
 */
export function ItemPicker({ warehouseId, onPick, disabled }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const term = useDebouncedValue(search, 250);
  const results = useItemSearch(open ? term : '', warehouseId ?? undefined);
  const [scan, setScan] = useState('');
  const [scanning, setScanning] = useState(false);
  // shadcn inputs don't forward refs on React 18, so focus by id.
  const scanId = useId();

  const pick = (item: StockItem) => {
    onPick(item);
    setOpen(false);
    setSearch('');
  };

  const onScan = async () => {
    const code = scan.trim();
    if (!code) return;
    setScanning(true);
    try {
      const found = await searchItems({
        q: code,
        exact: true,
        warehouseId: warehouseId ?? undefined,
        limit: 20,
      });
      if (found.length === 1) {
        onPick(found[0]);
        setScan('');
      } else if (found.length > 1) {
        // A product barcode on a variant product: let the user choose the variant.
        setSearch(code);
        setOpen(true);
        setScan('');
      } else {
        toast.error(t('inventory.picker.notFound', { code }));
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setScanning(false);
      document.getElementById(scanId)?.focus();
    }
  };

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <InputGroup className="sm:max-w-64">
        <InputGroupAddon>{scanning ? <Spinner /> : <ScanBarcode aria-hidden />}</InputGroupAddon>
        <InputGroupInput
          id={scanId}
          value={scan}
          disabled={disabled}
          onChange={(e) => setScan(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              void onScan();
            }
          }}
          placeholder={t('inventory.picker.scan')}
          aria-label={t('inventory.picker.scan')}
          className="font-mono"
          autoComplete="off"
        />
      </InputGroup>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className="justify-start text-muted-foreground sm:w-80"
          >
            <PackagePlus aria-hidden /> {t('inventory.picker.search')}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[min(36rem,calc(100vw-2rem))] p-0" align="start">
          <Command shouldFilter={false}>
            <CommandInput
              value={search}
              onValueChange={setSearch}
              placeholder={t('inventory.picker.searchPlaceholder')}
            />
            <CommandList>
              {term.trim() && !results.isFetching && (
                <CommandEmpty>{t('inventory.picker.noResults')}</CommandEmpty>
              )}
              {!term.trim() && (
                <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                  {t('inventory.picker.typeToSearch')}
                </div>
              )}
              {results.isFetching && !results.data?.length && (
                <div className="flex justify-center py-6">
                  <Spinner />
                </div>
              )}
              {term.trim() && Boolean(results.data?.length) && (
                <CommandGroup>
                  {results.data!.map((item) => (
                    <CommandItem
                      key={item.key}
                      value={item.key}
                      onSelect={() => pick(item)}
                      className="gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{itemLabel(item)}</div>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          <code className="font-mono">{item.sku}</code>
                          {item.barcode && <span className="font-mono">· {item.barcode}</span>}
                          <TrackingBadges item={item} />
                        </div>
                      </div>
                      {item.available !== undefined && (
                        <div className="shrink-0 text-right text-xs">
                          <div className="font-medium tabular-nums">
                            {formatQuantity(item.available)} {item.baseUnit.code}
                          </div>
                          <div className="text-muted-foreground">{t('inventory.available')}</div>
                        </div>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
