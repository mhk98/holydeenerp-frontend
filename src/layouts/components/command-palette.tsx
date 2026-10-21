import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useTheme } from 'next-themes';
import { Languages, Moon, Search, Sun } from 'lucide-react';
import { NAV_GROUPS } from '@/app/navigation';
import { usePermission } from '@/hooks/use-permission';
import { useSettingsStore } from '@/stores/settings-store';
import { Button } from '@/components/ui/button';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '@/components/ui/command';

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { can } = usePermission();
  const { resolvedTheme, setTheme } = useTheme();
  const { language, setLanguage } = useSettingsStore();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const run = (fn: () => void) => {
    setOpen(false);
    fn();
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => setOpen(true)}
        className="relative h-9 w-9 justify-start px-0 text-muted-foreground sm:w-56 sm:px-3 lg:w-72"
        aria-label={t('topbar.search')}
      >
        <Search className="mx-auto sm:mx-0" aria-hidden />
        <span className="hidden sm:inline-flex">{t('topbar.search')}</span>
        <kbd className="pointer-events-none absolute top-1/2 right-1.5 hidden -translate-y-1/2 items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium select-none sm:flex">
          Ctrl K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen} title={t('topbar.search')}>
        <CommandInput placeholder={t('topbar.searchPlaceholder')} />
        <CommandList>
          <CommandEmpty>{t('topbar.noResults')}</CommandEmpty>
          {NAV_GROUPS.map((group) => {
            const items = group.items.filter((item) => can(item.permission));
            if (!items.length) return null;
            return (
              <CommandGroup key={group.key} heading={t(`nav.${group.key}`)}>
                {items.map((item) => (
                  <CommandItem
                    key={item.path}
                    value={`${t(`nav.${group.key}`)} ${t(`nav.${item.key}`)} ${item.path}`}
                    onSelect={() => run(() => navigate(item.path))}
                  >
                    <item.icon aria-hidden />
                    {t(`nav.${item.key}`)}
                  </CommandItem>
                ))}
              </CommandGroup>
            );
          })}
          <CommandSeparator />
          <CommandGroup heading={t('topbar.actions')}>
            <CommandItem onSelect={() => run(() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark'))}>
              {resolvedTheme === 'dark' ? <Sun aria-hidden /> : <Moon aria-hidden />}
              {t('topbar.theme')}: {resolvedTheme === 'dark' ? t('topbar.light') : t('topbar.dark')}
            </CommandItem>
            <CommandItem onSelect={() => run(() => setLanguage(language === 'en' ? 'bn' : 'en'))}>
              <Languages aria-hidden />
              {t('topbar.language')}: {language === 'en' ? 'বাংলা' : 'English'}
              <CommandShortcut>{language === 'en' ? 'BN' : 'EN'}</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
