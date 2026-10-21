import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { PermissionCatalog } from '@/types';
import { Checkbox } from '@/components/ui/checkbox';

interface PermissionMatrixProps {
  catalog: PermissionCatalog;
  value: Set<string>;
  onChange: (next: Set<string>) => void;
  readOnly?: boolean;
}

type CheckedState = boolean | 'indeterminate';

const keyOf = (module: string, action: string) => `${module}.${action}`;

function stateOf(keys: string[], value: Set<string>): CheckedState {
  const on = keys.filter((k) => value.has(k)).length;
  if (on === 0) return false;
  return on === keys.length ? true : 'indeterminate';
}

/**
 * Modules × actions grid. Each row/column header toggles the whole row/column,
 * the corner cell toggles everything.
 */
export function PermissionMatrix({ catalog, value, onChange, readOnly }: PermissionMatrixProps) {
  const { t } = useTranslation();
  const available = new Set(catalog.permissions.map((p) => p.key));
  const rowKeys = (module: string) =>
    catalog.actions.map((a) => keyOf(module, a)).filter((k) => available.has(k));
  const colKeys = (action: string) =>
    catalog.modules.map((m) => keyOf(m, action)).filter((k) => available.has(k));
  const allKeys = [...available];

  const setMany = (keys: string[], on: boolean) => {
    const next = new Set(value);
    for (const k of keys) {
      if (on) next.add(k);
      else next.delete(k);
    }
    onChange(next);
  };

  const moduleLabel = (m: string) => t(`permissions.modules.${m}`, { defaultValue: m });
  const actionLabel = (a: string) => t(`permissions.actions.${a}`, { defaultValue: a });

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[720px] border-collapse text-sm">
        <caption className="sr-only">{t('roles.matrixCaption')}</caption>
        <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
          <tr>
            <th scope="col" className="w-56 border-b px-4 py-3 text-left font-medium">
              <label className="flex items-center gap-3">
                <Checkbox
                  checked={stateOf(allKeys, value)}
                  onCheckedChange={(v) => setMany(allKeys, v === true)}
                  disabled={readOnly}
                  aria-label={t('roles.selectAll')}
                />
                {t('roles.module')}
              </label>
            </th>
            {catalog.actions.map((action) => {
              const keys = colKeys(action);
              return (
                <th key={action} scope="col" className="border-b px-2 py-3 text-center font-medium">
                  <label className="flex flex-col items-center gap-2">
                    <span>{actionLabel(action)}</span>
                    <Checkbox
                      checked={stateOf(keys, value)}
                      onCheckedChange={(v) => setMany(keys, v === true)}
                      disabled={readOnly}
                      aria-label={t('roles.selectColumn', { action: actionLabel(action) })}
                    />
                  </label>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {catalog.modules.map((module) => {
            const keys = rowKeys(module);
            const rowState = stateOf(keys, value);
            return (
              <tr
                key={module}
                className={cn('border-b last:border-b-0 hover:bg-muted/30', rowState && 'bg-primary/[0.03]')}
              >
                <th scope="row" className="px-4 py-2.5 text-left font-normal">
                  <label className="flex items-center gap-3">
                    <Checkbox
                      checked={rowState}
                      onCheckedChange={(v) => setMany(keys, v === true)}
                      disabled={readOnly}
                      aria-label={t('roles.selectRow', { module: moduleLabel(module) })}
                    />
                    <span className="font-medium">{moduleLabel(module)}</span>
                  </label>
                </th>
                {catalog.actions.map((action) => {
                  const key = keyOf(module, action);
                  if (!available.has(key)) return <td key={action} />;
                  return (
                    <td key={action} className="px-2 py-2.5 text-center">
                      <Checkbox
                        checked={value.has(key)}
                        onCheckedChange={(v) => setMany([key], v === true)}
                        disabled={readOnly}
                        aria-label={`${moduleLabel(module)}: ${actionLabel(action)}`}
                      />
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
