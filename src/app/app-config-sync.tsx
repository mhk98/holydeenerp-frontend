import { useEffect } from 'react';
import { useSettingsStore } from '@/stores/settings-store';
import { useAppConfig } from '@/features/settings/api/settings-api';

/**
 * Copies company-wide preferences (currency, precision, date format, timezone, theme colour)
 * into the settings store, which format.ts and the theme read from. Renders nothing.
 */
export function AppConfigSync() {
  const { data } = useAppConfig();
  const setPrefs = useSettingsStore((s) => s.setPrefs);
  const themeColor = useSettingsStore((s) => s.themeColor);

  useEffect(() => {
    if (!data) return;
    setPrefs({
      currency: data.baseCurrency?.code ?? data.financial.baseCurrency,
      amountDecimals: data.financial.amountDecimals,
      quantityDecimals: data.financial.quantityDecimals,
      dateFormat: data.system.dateFormat,
      timeFormat: data.system.timeFormat,
      timezone: data.system.timezone,
      themeColor: data.system.themeColor,
    });
  }, [data, setPrefs]);

  useEffect(() => {
    const root = document.documentElement;
    if (themeColor === 'neutral') delete root.dataset.accent;
    else root.dataset.accent = themeColor;
  }, [themeColor]);

  return null;
}
