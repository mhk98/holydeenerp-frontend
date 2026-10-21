import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useSearchParams } from 'react-router-dom';
import JsBarcode from 'jsbarcode';
import { useTranslation } from 'react-i18next';
import { Minus, Plus, Printer, Search, Tags, Trash2 } from 'lucide-react';
import { useDebouncedValue } from '@/hooks/use-debounce';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { BarcodeType, LabelProduct } from '@/types';
import { EmptyState } from '@/components/common/empty-state';
import { PageHeader } from '@/components/common/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { productsResource, useLabelProducts } from '../api/products-api';

/** Label stock: single labels on a roll (thermal) or a sheet of labels on A4. */
const SIZES = {
  '38x25': { w: 38, h: 25, sheet: false },
  '50x25': { w: 50, h: 25, sheet: false },
  '50x30': { w: 50, h: 30, sheet: false },
  '60x40': { w: 60, h: 40, sheet: false },
  a4_65: { w: 38.1, h: 21.2, sheet: true, cols: 5 },
  a4_24: { w: 64, h: 33.9, sheet: true, cols: 3 },
} as const;
type SizeKey = keyof typeof SIZES;

interface LabelItem {
  key: string;
  name: string;
  variant: string | null;
  sku: string;
  code: string;
  type: BarcodeType;
  price: string | null;
  qty: number;
}

function toItems(products: LabelProduct[]): LabelItem[] {
  return products.flatMap((p) => {
    const rows = p.hasVariants
      ? p.variants
          .filter((v) => v.isActive)
          .map((v) => ({
            key: `v${v.id}`,
            variant: v.name,
            sku: v.sku,
            barcode: v.barcode,
            price: v.salePrice ?? p.salePrice,
          }))
      : [{ key: `p${p.id}`, variant: null, sku: p.sku, barcode: p.barcode, price: p.salePrice }];
    return rows.map((r) => ({
      key: r.key,
      name: p.name,
      variant: r.variant,
      sku: r.sku,
      // Without a barcode the SKU is printed as Code 128.
      code: r.barcode ?? r.sku,
      type:
        r.barcode && !r.variant
          ? p.barcodeType
          : r.barcode && /^\d{13}$/.test(r.barcode)
            ? 'EAN13'
            : 'CODE128',
      price: r.price,
      qty: 1,
    }));
  });
}

function BarcodeSvg({ value, type, height }: { value: string; type: BarcodeType; height: number }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const options = { height, width: 1.4, fontSize: 11, margin: 0, textMargin: 1, displayValue: true };
    try {
      JsBarcode(ref.current, value, { ...options, format: type === 'EAN13' ? 'EAN13' : 'CODE128' });
    } catch {
      JsBarcode(ref.current, value, { ...options, format: 'CODE128' });
    }
  }, [value, type, height]);
  return <svg ref={ref} className="max-h-full max-w-full" role="img" aria-label={value} />;
}

function LabelView({
  item,
  size,
  show,
}: {
  item: LabelItem;
  size: (typeof SIZES)[SizeKey];
  show: Record<string, boolean>;
}) {
  const barHeight = Math.max(18, size.h * 3.78 - (show.name ? 22 : 6) - (show.price ? 14 : 0) - 14);
  return (
    <div
      className="label flex flex-col items-center justify-center overflow-hidden bg-white px-1 text-center leading-tight text-black"
      style={{ width: `${size.w}mm`, height: `${size.h}mm` }}
    >
      {show.name && (
        <div className="line-clamp-2 w-full text-[9px] font-semibold">
          {item.name}
          {item.variant && ` — ${item.variant}`}
        </div>
      )}
      <BarcodeSvg value={item.code} type={item.type} height={barHeight} />
      <div className="flex w-full items-center justify-between gap-1 text-[9px]">
        {show.sku ? <span className="font-mono">{item.sku}</span> : <span />}
        {show.price && item.price && (
          <span className="text-[11px] font-bold">{formatCurrency(item.price)}</span>
        )}
      </div>
    </div>
  );
}

export default function LabelsPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const ids = useMemo(() => (params.get('ids') ?? '').split(',').filter((x) => /^\d+$/.test(x)), [params]);
  const data = useLabelProducts(ids);
  // Quantities per label row (default 1); the rows themselves come from the server.
  const [qtys, setQtys] = useState<Record<string, number>>({});
  const [sizeKey, setSizeKey] = useState<SizeKey>('50x25');
  const [show, setShow] = useState({ name: true, price: true, sku: true });
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search);
  const results = productsResource.useList(
    { search: debounced, limit: 8 },
    { enabled: debounced.length > 1 },
  );

  const items = useMemo(
    () => toItems(data.data ?? []).map((i) => ({ ...i, qty: qtys[i.key] ?? 1 })),
    [data.data, qtys],
  );

  const size = SIZES[sizeKey];
  const labels = items.flatMap((i) => Array.from({ length: i.qty }, (_, n) => ({ ...i, n })));
  const setIds = (next: string[]) =>
    setParams(next.length ? { ids: [...new Set(next)].join(',') } : {}, { replace: true });
  const setQty = (key: string, qty: number) =>
    setQtys((prev) => ({ ...prev, [key]: Math.max(0, Math.min(500, qty)) }));

  const pageCss = size.sheet
    ? '@page { size: A4; margin: 10mm 5mm; }'
    : `@page { size: ${size.w}mm ${size.h}mm; margin: 0; }`;

  return (
    <>
      <style>{`
        #label-print { display: none; }
        @media print {
          ${pageCss}
          #root { display: none !important; }
          #label-print { display: ${size.sheet ? 'grid' : 'block'}; ${size.sheet ? `grid-template-columns: repeat(${size.cols}, ${size.w}mm);` : ''} }
          #label-print .label { ${size.sheet ? '' : 'break-after: page;'} }
        }
      `}</style>
      {createPortal(
        <div id="label-print">
          {labels.map((l) => (
            <LabelView key={`${l.key}-${l.n}`} item={l} size={size} show={show} />
          ))}
        </div>,
        document.body,
      )}

      <PageHeader
        title={t('products.labels.title')}
        description={t('products.labels.description')}
        breadcrumbs={[{ label: t('nav.inventory') }, { label: t('products.labels.title') }]}
        actions={
          <Button onClick={() => window.print()} disabled={!labels.length}>
            <Printer aria-hidden /> {t('products.labels.print', { count: labels.length })}
          </Button>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,26rem)_1fr]">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('products.labels.settings')}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="label-size">{t('products.labels.size')}</Label>
                <Select value={sizeKey} onValueChange={(v) => setSizeKey(v as SizeKey)}>
                  <SelectTrigger id="label-size" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(SIZES) as SizeKey[]).map((k) => (
                      <SelectItem key={k} value={k}>
                        {t(`products.labels.sizes.${k}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-wrap gap-4">
                {(['name', 'price', 'sku'] as const).map((k) => (
                  <div key={k} className="flex items-center gap-2">
                    <Checkbox
                      id={`show-${k}`}
                      checked={show[k]}
                      onCheckedChange={(c) => setShow((s) => ({ ...s, [k]: c === true }))}
                    />
                    <Label htmlFor={`show-${k}`} className="font-normal">
                      {t(`products.labels.show.${k}`)}
                    </Label>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('products.labels.items')}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="relative">
                <InputGroup>
                  <InputGroupAddon>
                    <Search aria-hidden />
                  </InputGroupAddon>
                  <InputGroupInput
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder={t('products.labels.addProduct')}
                    aria-label={t('products.labels.addProduct')}
                  />
                </InputGroup>
                {debounced.length > 1 && search && (
                  <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md">
                    {results.data?.rows.length ? (
                      results.data.rows.map((p) => (
                        <li key={p.id}>
                          <button
                            type="button"
                            className="flex w-full items-center justify-between gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
                            onClick={() => {
                              setIds([...ids, p.id]);
                              setSearch('');
                            }}
                          >
                            <span className="truncate">{p.name}</span>
                            <code className="shrink-0 text-xs text-muted-foreground">{p.sku}</code>
                          </button>
                        </li>
                      ))
                    ) : (
                      <li className="px-2 py-1.5 text-sm text-muted-foreground">
                        {results.isFetching ? t('common.loading') : t('table.noMatches')}
                      </li>
                    )}
                  </ul>
                )}
              </div>

              {data.isFetching && !items.length ? (
                <Skeleton className="h-24" />
              ) : (
                <ul className="flex flex-col divide-y">
                  {items.map((i) => (
                    <li key={i.key} className="flex items-center gap-2 py-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {i.name}
                          {i.variant && <span className="text-muted-foreground"> — {i.variant}</span>}
                        </p>
                        <p className="font-mono text-xs text-muted-foreground">{i.code}</p>
                      </div>
                      <div className="flex items-center">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setQty(i.key, i.qty - 1)}
                          aria-label={t('products.labels.less')}
                        >
                          <Minus aria-hidden />
                        </Button>
                        <Input
                          value={i.qty}
                          onChange={(e) => setQty(i.key, Number(e.target.value) || 0)}
                          inputMode="numeric"
                          className="h-8 w-14 text-center tabular-nums"
                          aria-label={t('products.labels.quantityFor', { name: i.name })}
                        />
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setQty(i.key, i.qty + 1)}
                          aria-label={t('products.labels.more')}
                        >
                          <Plus aria-hidden />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            const productId = data.data?.find(
                              (p) => `p${p.id}` === i.key || p.variants.some((v) => `v${v.id}` === i.key),
                            )?.id;
                            if (i.key.startsWith('p') && productId)
                              setIds(ids.filter((x) => x !== productId));
                            else setQty(i.key, 0);
                          }}
                          aria-label={t('common.remove')}
                        >
                          <Trash2 aria-hidden />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('products.labels.preview')}</CardTitle>
          </CardHeader>
          <CardContent>
            {labels.length ? (
              <div
                className={cn(
                  'flex flex-wrap gap-2 rounded-md border bg-muted/40 p-3',
                  size.sheet && 'grid gap-0',
                )}
                style={size.sheet ? { gridTemplateColumns: `repeat(${size.cols}, ${size.w}mm)` } : undefined}
              >
                {labels.map((l) => (
                  <div key={`${l.key}-${l.n}`} className="outline outline-1 outline-zinc-300 outline-dashed">
                    <LabelView item={l} size={size} show={show} />
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState
                icon={Tags}
                title={t('products.labels.empty')}
                description={t('products.labels.emptyHint')}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
