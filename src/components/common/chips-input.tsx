import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, X } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface ChipsInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  id?: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

/**
 * List of short text values: type and press Enter or comma to add (case-insensitive
 * duplicates are ignored), click × to remove. Use inside FormField.
 */
export function ChipsInput({ value, onChange, placeholder, ...aria }: ChipsInputProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const values = value ?? [];

  const add = () => {
    const next = [...values];
    for (const part of draft.split(',').map((s) => s.trim())) {
      if (part && !next.some((x) => x.toLowerCase() === part.toLowerCase())) next.push(part);
    }
    onChange(next);
    setDraft('');
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <Input
          {...aria}
          value={draft}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => draft.trim() && add()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              add();
            } else if (e.key === 'Backspace' && !draft && values.length) {
              onChange(values.slice(0, -1));
            }
          }}
        />
        <Button type="button" variant="outline" size="icon" onClick={add} aria-label={t('common.add')}>
          <Plus aria-hidden />
        </Button>
      </div>
      {values.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {values.map((item) => (
            <li key={item}>
              <Badge variant="secondary" className="gap-1 pr-1">
                {item}
                <button
                  type="button"
                  className="rounded-sm p-0.5 hover:bg-muted-foreground/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  aria-label={`${t('common.remove')} ${item}`}
                  onClick={() => onChange(values.filter((x) => x !== item))}
                >
                  <X className="size-3" aria-hidden />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
