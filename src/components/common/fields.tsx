import type { ComponentProps, ReactNode } from 'react';
import type { Control, FieldPath, FieldValues } from 'react-hook-form';
import { FormField } from '@/components/common/form-field';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

/**
 * Ready-made form fields on top of FormField — use these in every form:
 *   <TextField control={form.control} name="name" label={t('…')} />
 */
interface BaseProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  label: ReactNode;
  description?: ReactNode;
  className?: string;
}

export function TextField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  ...input
}: BaseProps<T> & Omit<ComponentProps<'input'>, 'name' | 'value' | 'onChange' | 'onBlur'>) {
  return (
    <FormField
      control={control}
      name={name}
      label={label}
      description={description}
      className={className}
      render={({ field, aria }) => <Input {...input} {...field} value={field.value ?? ''} {...aria} />}
    />
  );
}

export function TextareaField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  rows = 3,
  ...rest
}: BaseProps<T> & { rows?: number; placeholder?: string }) {
  return (
    <FormField
      control={control}
      name={name}
      label={label}
      description={description}
      className={className}
      render={({ field, aria }) => (
        <Textarea rows={rows} {...rest} {...field} value={field.value ?? ''} {...aria} />
      )}
    />
  );
}

export interface Option {
  value: string;
  label: ReactNode;
}

export function SelectField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
  options,
  placeholder,
  disabled,
}: BaseProps<T> & { options: Option[]; placeholder?: string; disabled?: boolean }) {
  return (
    <FormField
      control={control}
      name={name}
      label={label}
      description={description}
      className={className}
      render={({ field, aria }) => (
        <Select
          value={field.value == null ? '' : String(field.value)}
          onValueChange={field.onChange}
          disabled={disabled}
        >
          <SelectTrigger className="w-full" {...aria}>
            <SelectValue placeholder={placeholder} />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  );
}

/** Switch with a label and optional hint, laid out horizontally. */
export function SwitchField<T extends FieldValues>({
  control,
  name,
  label,
  description,
  className,
}: BaseProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      orientation="horizontal"
      className={className}
      label={
        <span className="flex flex-col gap-0.5">
          <span>{label}</span>
          {description && <span className="text-xs font-normal text-muted-foreground">{description}</span>}
        </span>
      }
      render={({ field, aria }) => (
        <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} {...aria} />
      )}
    />
  );
}
