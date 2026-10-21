import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3, Boxes, ShieldCheck } from 'lucide-react';
import { BrandIcon } from '@/app/navigation';
import { LanguageToggle, ThemeToggle } from '@/layouts/components/topbar-controls';

interface AuthLayoutProps {
  title: string;
  description?: ReactNode;
  children: ReactNode;
}

const FEATURES = [
  { icon: Boxes, key: 'auth.brand.feature1' },
  { icon: BarChart3, key: 'auth.brand.feature2' },
  { icon: ShieldCheck, key: 'auth.brand.feature3' },
];

/** Split layout: brand panel on large screens, form on the right. */
export function AuthLayout({ title, description, children }: AuthLayoutProps) {
  const { t } = useTranslation();

  return (
    <div className="grid min-h-svh lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <aside className="relative hidden overflow-hidden bg-zinc-950 p-10 text-zinc-50 lg:flex lg:flex-col">
        {/* Decorative background */}
        <div
          aria-hidden
          className="absolute inset-0 [background-image:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_top_left,black_30%,transparent_75%)] [background-size:44px_44px] opacity-[0.15]"
        />
        <div
          aria-hidden
          className="absolute -right-40 -bottom-40 size-[520px] rounded-full bg-emerald-500/25 blur-[120px]"
        />
        <div
          aria-hidden
          className="absolute top-1/3 -left-24 size-80 rounded-full bg-sky-500/20 blur-[100px]"
        />

        <div className="relative flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-white text-zinc-950">
            <BrandIcon className="size-5" aria-hidden />
          </div>
          <div className="leading-tight">
            <p className="font-semibold">{t('app.name')}</p>
            <p className="text-xs text-zinc-400">{t('app.tagline')}</p>
          </div>
        </div>

        <div className="relative mt-auto max-w-md space-y-8">
          <div className="space-y-3">
            <h2 className="text-3xl leading-tight font-semibold tracking-tight text-balance">
              {t('auth.brand.headline')}
            </h2>
            <p className="text-zinc-400">{t('auth.brand.subheadline')}</p>
          </div>
          <ul className="space-y-4">
            {FEATURES.map(({ icon: Icon, key }) => (
              <li key={key} className="flex items-start gap-3">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="text-sm text-zinc-300">{t(key)}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative mt-12 text-xs text-zinc-500">
          © {new Date().getFullYear()} {t('app.name')}
        </p>
      </aside>

      <main className="flex flex-col">
        <div className="flex items-center justify-between p-4 sm:p-6">
          <div className="flex items-center gap-2 lg:invisible">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BrandIcon className="size-4" aria-hidden />
            </div>
            <span className="font-semibold">{t('app.name')}</span>
          </div>
          <div className="flex items-center gap-1">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
        <div className="flex flex-1 items-center justify-center px-4 pb-16 sm:px-6">
          <div className="w-full max-w-sm">
            <div className="mb-8 space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              {description && <p className="text-sm text-muted-foreground">{description}</p>}
            </div>
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
