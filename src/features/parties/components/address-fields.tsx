import { useFieldArray, type Control, type UseFormSetValue } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { MapPin, Plus, Trash2 } from 'lucide-react';
import { SelectField, TextareaField, TextField } from '@/components/common/fields';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ADDRESS_TYPES, type PartyValues } from '../schemas';

/** Repeatable address cards; exactly one can be the default. */
export function AddressFields({
  control,
  setValue,
  watchDefault,
}: {
  control: Control<PartyValues>;
  setValue: UseFormSetValue<PartyValues>;
  watchDefault: (index: number) => boolean;
}) {
  const { t } = useTranslation();
  const { fields, append, remove } = useFieldArray({ control, name: 'addresses', keyName: 'key' });

  const makeDefault = (index: number) =>
    fields.forEach((_, i) => setValue(`addresses.${i}.isDefault`, i === index, { shouldDirty: true }));

  return (
    <div className="flex flex-col gap-4">
      {fields.length === 0 && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <MapPin className="size-4" aria-hidden /> {t('parties.addresses.empty')}
        </p>
      )}
      {fields.map((f, i) => (
        <fieldset key={f.key} className="flex flex-col gap-3 rounded-lg border p-3">
          <legend className="sr-only">{t('parties.addresses.address', { n: i + 1 })}</legend>
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id={`addr-default-${i}`}
                checked={watchDefault(i)}
                onCheckedChange={(c) => c === true && makeDefault(i)}
              />
              <Label htmlFor={`addr-default-${i}`} className="font-normal">
                {t('parties.addresses.default')}
              </Label>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => remove(i)}
              aria-label={t('common.remove')}
            >
              <Trash2 aria-hidden />
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              control={control}
              name={`addresses.${i}.type`}
              label={t('fields.type')}
              options={ADDRESS_TYPES.map((v) => ({ value: v, label: t(`parties.addresses.types.${v}`) }))}
            />
            <TextField
              control={control}
              name={`addresses.${i}.label`}
              label={t('parties.addresses.label')}
              placeholder={t('parties.addresses.labelPlaceholder')}
            />
          </div>
          <TextareaField
            control={control}
            name={`addresses.${i}.addressLine`}
            label={t('fields.address')}
            rows={2}
          />
          <div className="grid gap-3 sm:grid-cols-3">
            <TextField control={control} name={`addresses.${i}.city`} label={t('parties.addresses.city')} />
            <TextField
              control={control}
              name={`addresses.${i}.district`}
              label={t('parties.addresses.district')}
            />
            <TextField
              control={control}
              name={`addresses.${i}.postalCode`}
              label={t('parties.addresses.postalCode')}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField
              control={control}
              name={`addresses.${i}.country`}
              label={t('parties.addresses.country')}
            />
            <TextField control={control} name={`addresses.${i}.phone`} label={t('fields.phone')} type="tel" />
          </div>
        </fieldset>
      ))}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        disabled={fields.length >= 20}
        onClick={() =>
          append({
            type: fields.length === 0 ? 'billing' : 'shipping',
            label: '',
            addressLine: '',
            city: '',
            district: '',
            postalCode: '',
            country: 'Bangladesh',
            phone: '',
            isDefault: fields.length === 0,
          })
        }
      >
        <Plus aria-hidden /> {t('parties.addresses.add')}
      </Button>
    </div>
  );
}
