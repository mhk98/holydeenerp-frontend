import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, ImagePlus, Star, Trash2 } from 'lucide-react';
import { assetUrl } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { ProductImage } from '@/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { useDeleteImage, useOrderImages, useUploadImages } from '../api/products-api';

const MAX_IMAGES = 8;

/** Product gallery: upload (up to 8), reorder, choose the primary image, delete. */
export function ProductImagesTab({
  productId,
  images,
  readOnly,
}: {
  productId: string | undefined;
  images: ProductImage[];
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const input = useRef<HTMLInputElement>(null);
  const upload = useUploadImages(productId ?? '');
  const del = useDeleteImage(productId ?? '');
  const order = useOrderImages(productId ?? '');
  const busy = upload.isPending || del.isPending || order.isPending;

  if (!productId) return <p className="text-sm text-muted-foreground">{t('products.images.saveFirst')}</p>;

  const reorder = (ids: string[]) => order.mutate(ids);
  const move = (index: number, delta: number) => {
    const ids = images.map((i) => i.id);
    const [item] = ids.splice(index, 1);
    ids.splice(index + delta, 0, item);
    reorder(ids);
  };

  const onFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, MAX_IMAGES - images.length);
    if (list.length < files.length) toast.warning(t('products.images.limit', { max: MAX_IMAGES }));
    if (list.length) upload.mutate(list, { onSuccess: () => toast.success(t('products.images.uploaded')) });
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t('products.images.hint', { max: MAX_IMAGES })}</p>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {images.map((img, i) => (
          <li
            key={img.id}
            className={cn(
              'group relative overflow-hidden rounded-lg border',
              i === 0 && 'ring-2 ring-primary',
            )}
          >
            <img src={assetUrl(img.path)} alt="" className="aspect-square w-full bg-white object-contain" />
            {i === 0 && (
              <Badge className="absolute top-2 left-2">
                <Star aria-hidden /> {t('products.images.primary')}
              </Badge>
            )}
            {!readOnly && (
              <div className="flex items-center justify-between gap-1 border-t bg-card p-1">
                <div className="flex">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={busy || i === 0}
                    onClick={() => move(i, -1)}
                    aria-label={t('products.images.left')}
                  >
                    <ArrowLeft aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={busy || i === images.length - 1}
                    onClick={() => move(i, 1)}
                    aria-label={t('products.images.right')}
                  >
                    <ArrowRight aria-hidden />
                  </Button>
                </div>
                <div className="flex">
                  {i !== 0 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      disabled={busy}
                      onClick={() =>
                        reorder([img.id, ...images.filter((x) => x.id !== img.id).map((x) => x.id)])
                      }
                      aria-label={t('products.images.makePrimary')}
                    >
                      <Star aria-hidden />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={busy}
                    onClick={() => del.mutate(img.id)}
                    aria-label={t('common.delete')}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
        {!readOnly && images.length < MAX_IMAGES && (
          <li>
            <button
              type="button"
              disabled={busy}
              onClick={() => input.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                onFiles(e.dataTransfer.files);
              }}
              className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-muted-foreground transition-colors hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              {upload.isPending ? <Spinner /> : <ImagePlus className="size-6" aria-hidden />}
              {t('products.images.add')}
            </button>
          </li>
        )}
      </ul>
      <input
        ref={input}
        type="file"
        multiple
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        aria-label={t('products.images.add')}
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
