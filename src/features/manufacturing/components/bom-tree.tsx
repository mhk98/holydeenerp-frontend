import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronRight, Layers, Package } from 'lucide-react';
import { formatQuantity } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useDebouncedValue } from '@/hooks/use-debounce';
import { useBomTree } from '../api/manufacturing-api';
import { MFG_ROUTES } from '../lib';
import type { BomTreeNode } from '../types';

function Node({ node, depth }: { node: BomTreeNode; depth: number }) {
  const [open, setOpen] = useState(depth < 2);
  const hasChildren = node.children.length > 0;
  const Toggle = open ? ChevronDown : ChevronRight;
  return (
    <li>
      <div
        className="flex items-center gap-2 rounded-md py-1 pr-2 hover:bg-muted/50"
        style={{ paddingLeft: `${depth * 1.25}rem` }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={() => setOpen(!open)}
            className="rounded-sm text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            aria-expanded={open}
            aria-label={node.name}
          >
            <Toggle className="size-4" aria-hidden />
          </button>
        ) : (
          <span className="size-4" />
        )}
        {hasChildren ? (
          <Layers className="size-4 shrink-0 text-primary" aria-hidden />
        ) : (
          <Package className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        )}
        <span className={cn('min-w-0 flex-1 truncate', hasChildren && 'font-medium')}>
          {node.name}
          {node.bomId && (
            <Link
              to={`${MFG_ROUTES.boms}/${node.bomId}`}
              className="ml-2 font-mono text-xs text-muted-foreground hover:underline"
            >
              {node.bomCode}
            </Link>
          )}
        </span>
        <span className="shrink-0 text-sm tabular-nums">{formatQuantity(node.quantity)}</span>
      </div>
      {hasChildren && open && (
        <ul>
          {node.children.map((c, i) => (
            <Node key={`${c.productId}-${c.variantId ?? ''}-${i}`} node={c} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}

/** Multi-level BOM tree: components, and sub-assemblies with their own components, for a quantity. */
export function BomTreeCard({ bomId, defaultQuantity }: { bomId: string; defaultQuantity: string }) {
  const { t } = useTranslation();
  const [quantity, setQuantity] = useState(String(Number(defaultQuantity)));
  const debounced = useDebouncedValue(quantity, 400);
  const valid = Number(debounced) > 0;
  const tree = useBomTree(bomId, valid ? debounced : undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{t('manufacturing.boms.tree')}</CardTitle>
        <CardDescription>{t('manufacturing.boms.treeHint')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">{t('manufacturing.boms.treeFor')}</span>
          <Input
            inputMode="decimal"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="h-8 w-28 tabular-nums"
          />
        </label>
        {tree.isPending ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-6" />
            ))}
          </div>
        ) : tree.isError ? (
          <p className="text-sm text-destructive">{tree.error.message}</p>
        ) : (
          <ul className="text-sm">
            {tree.data?.children.map((c, i) => (
              <Node key={`${c.productId}-${c.variantId ?? ''}-${i}`} node={c} depth={0} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
