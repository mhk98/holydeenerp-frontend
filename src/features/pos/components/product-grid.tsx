import { forwardRef, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageOff, Search } from 'lucide-react';
import { assetUrl } from '@/lib/api';
import { formatCurrency, formatQuantity } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { findByCode } from '../lib/catalog';
import type { CatalogItem, PosBootstrap } from '../types';

interface Props {
  items: CatalogItem[];
  categories: PosBootstrap['categories'];
  onPick: (item: CatalogItem, unitId?: string | null) => void;
  onNotFound: (term: string) => void;
}

export const ProductGrid = forwardRef<HTMLInputElement, Props>(function ProductGrid(
  { items, categories, onPick, onNotFound },
  searchRef,
) {
  const { t } = useTranslation();
  const [category, setCategory] = useState<string>('all');
  const [search, setSearch] = useState('');
  const used = useMemo(() => new Set(items.map((i) => i.categoryId)), [items]);
  const tabs = categories.filter((c) => used.has(c.id));

  const shown = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items
      .filter((i) => category === 'all' || i.categoryId === category)
      .filter(
        (i) =>
          !term ||
          i.name.toLowerCase().includes(term) ||
          i.variantName?.toLowerCase().includes(term) ||
          i.sku.toLowerCase().includes(term) ||
          i.barcode === term,
      )
      .slice(0, 300);
  }, [items, category, search]);

  const onEnter = () => {
    const exact = findByCode(items, search);
    if (exact) onPick(exact.item, exact.unitId);
    else if (shown.length === 1) onPick(shown[0]);
    else if (search.trim()) return onNotFound(search.trim());
    setSearch('');
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          ref={searchRef}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onEnter();
            }
          }}
          placeholder={t('pos.searchPlaceholder')}
          aria-label={t('pos.search')}
          className="h-12 pl-10 text-base"
          autoComplete="off"
        />
        <kbd className="pointer-events-none absolute top-1/2 right-3 hidden -translate-y-1/2 rounded border px-1.5 text-xs text-muted-foreground sm:block">
          F2
        </kbd>
      </div>
      <div
        className="flex shrink-0 gap-2 overflow-x-auto pb-1"
        role="tablist"
        aria-label={t('pos.categories')}
      >
        {[{ id: 'all', name: t('pos.allItems') }, ...tabs].map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-selected={category === c.id}
            onClick={() => setCategory(c.id)}
            className={cn(
              'h-10 shrink-0 rounded-full border px-4 text-sm font-medium whitespace-nowrap transition-colors',
              category === c.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'bg-background hover:bg-muted',
            )}
          >
            {c.name}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {!shown.length ? (
          <p className="py-16 text-center text-muted-foreground">{t('pos.noItems')}</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {shown.map((item) => {
              const out = Number(item.stock) <= 0;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => onPick(item)}
                  className="flex min-h-28 flex-col overflow-hidden rounded-xl border bg-card text-left shadow-xs transition hover:border-primary active:scale-[0.98]"
                >
                  <div className="flex h-20 w-full items-center justify-center bg-muted/50">
                    {item.image ? (
                      <img
                        src={assetUrl(item.image)}
                        alt=""
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <ImageOff className="size-6 text-muted-foreground/50" aria-hidden />
                    )}
                  </div>
                  <div className="flex flex-1 flex-col gap-0.5 p-2">
                    <span className="line-clamp-2 text-sm leading-tight font-medium">
                      {item.name}
                      {item.variantName && (
                        <span className="text-muted-foreground"> — {item.variantName}</span>
                      )}
                    </span>
                    <span className="mt-auto flex items-end justify-between gap-1">
                      <span className="font-semibold tabular-nums">{formatCurrency(item.price)}</span>
                      <span
                        className={cn(
                          'text-xs tabular-nums',
                          out ? 'text-destructive' : 'text-muted-foreground',
                        )}
                      >
                        {formatQuantity(item.stock)} {item.baseUnit.code}
                      </span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
});
