import { useState, type ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Eye, EyeOff, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group';

/** Password input with a show/hide toggle. */
export function PasswordInput({ className, ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  return (
    <InputGroup className={className}>
      <InputGroupInput type={visible ? 'text' : 'password'} {...props} />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          size="icon-xs"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t('auth.hidePassword') : t('auth.showPassword')}
          aria-pressed={visible}
        >
          {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
}

const RULES = [
  { key: 'auth.rules.length', test: (v: string) => v.length >= 8 },
  { key: 'auth.rules.letter', test: (v: string) => /[A-Za-z]/.test(v) },
  { key: 'auth.rules.number', test: (v: string) => /\d/.test(v) },
];

/** Live checklist of the password policy (mirrors the backend rules). */
export function PasswordRules({ value }: { value: string }) {
  const { t } = useTranslation();
  return (
    <ul className="grid gap-1 text-xs" aria-label={t('auth.rules.title')}>
      {RULES.map((rule) => {
        const ok = rule.test(value ?? '');
        return (
          <li
            key={rule.key}
            className={cn(
              'flex items-center gap-1.5',
              ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
            )}
          >
            {ok ? <Check className="size-3.5" aria-hidden /> : <X className="size-3.5" aria-hidden />}
            {t(rule.key)}
          </li>
        );
      })}
    </ul>
  );
}
