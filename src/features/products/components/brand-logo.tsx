import { Tag } from 'lucide-react';
import { assetUrl } from '@/lib/api';
import { cn } from '@/lib/utils';

/** Brand logo thumbnail with a placeholder icon. */
export function BrandLogo({ logoUrl, size = 'size-8' }: { logoUrl: string | null; size?: string }) {
  return logoUrl ? (
    <img src={assetUrl(logoUrl)} alt="" className={cn(size, 'rounded-md border bg-white object-contain')} />
  ) : (
    <span className={cn(size, 'grid place-items-center rounded-md border bg-muted text-muted-foreground')}>
      <Tag className="size-4" aria-hidden />
    </span>
  );
}
