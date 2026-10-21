import { useId, type ReactNode } from 'react';
import {
  Controller,
  type Control,
  type ControllerRenderProps,
  type FieldPath,
  type FieldValues,
} from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';

interface RenderArgs<T extends FieldValues, N extends FieldPath<T>> {
  field: Omit<ControllerRenderProps<T, N>, 'ref'>;
  id: string;
  invalid: boolean;
  /** Spread onto the input for accessible error wiring. */
  aria: { id: string; 'aria-invalid': boolean; 'aria-describedby'?: string };
}

interface FormFieldProps<T extends FieldValues, N extends FieldPath<T>> {
  control: Control<T>;
  name: N;
  label?: ReactNode;
  description?: ReactNode;
  /** Extra element next to the label (e.g. "Forgot password?" link). */
  labelAction?: ReactNode;
  orientation?: 'vertical' | 'horizontal';
  className?: string;
  render: (args: RenderArgs<T, N>) => ReactNode;
}

/**
 * React Hook Form field with label, description and an inline (translated) error.
 *   <FormField control={form.control} name="email" label={t('auth.email')}
 *     render={({ field, aria }) => <Input type="email" {...field} {...aria} />} />
 */
export function FormField<T extends FieldValues, N extends FieldPath<T>>({
  control,
  name,
  label,
  description,
  labelAction,
  orientation = 'vertical',
  className,
  render,
}: FormFieldProps<T, N>) {
  const { t } = useTranslation();
  const id = useId();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field: { ref, ...field }, fieldState }) => {
        // shadcn inputs don't forward refs on React 18; give RHF a focus proxy so
        // "focus first invalid field" on submit still works.
        ref({ focus: () => document.getElementById(id)?.focus() });
        const invalid = Boolean(fieldState.error);
        const errorId = `${id}-error`;
        const message = fieldState.error?.message;
        const aria = { id, 'aria-invalid': invalid, 'aria-describedby': invalid ? errorId : undefined };
        const control = render({ field, id, invalid, aria });
        const labelNode = label && (
          <div className="flex items-center justify-between gap-2">
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            {labelAction}
          </div>
        );

        return (
          <Field data-invalid={invalid} orientation={orientation} className={className}>
            {orientation === 'horizontal' ? (
              <>
                {control}
                {labelNode}
              </>
            ) : (
              <>
                {labelNode}
                {control}
              </>
            )}
            {description && !invalid && <FieldDescription>{description}</FieldDescription>}
            {message && <FieldError id={errorId}>{t(message, { defaultValue: message })}</FieldError>}
          </Field>
        );
      }}
    />
  );
}
