import { BrandIcon } from '@/app/navigation';
import { Spinner } from '@/components/ui/spinner';

/** Shown while the session is being restored on first load. */
export function FullScreenLoader() {
  return (
    <div
      className="flex min-h-svh flex-col items-center justify-center gap-4"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <BrandIcon className="size-6" aria-hidden />
      </div>
      <Spinner className="size-5 text-muted-foreground" />
    </div>
  );
}
