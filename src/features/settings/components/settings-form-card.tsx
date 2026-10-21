import type { FormEventHandler, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { usePermission } from '@/hooks/use-permission';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldGroup } from '@/components/ui/field';
import { Spinner } from '@/components/ui/spinner';

interface Props {
  title: ReactNode;
  description?: ReactNode;
  onSubmit: FormEventHandler<HTMLFormElement>;
  saving?: boolean;
  dirty?: boolean;
  /** Extra buttons next to Save (e.g. "Send test email"). */
  actions?: ReactNode;
  /** For cards whose only action is `actions` (no Save button). */
  hideSave?: boolean;
  /** Permission needed to edit (default settings.update). */
  editPermission?: string | string[];
  children: ReactNode;
}

/** Card with a settings form; read-only (and no Save) without the edit permission. */
export function SettingsFormCard({
  title,
  description,
  onSubmit,
  saving,
  dirty = true,
  actions,
  hideSave,
  editPermission = 'settings.update',
  children,
}: Props) {
  const { t } = useTranslation();
  const { can } = usePermission();
  const canEdit = can(editPermission);

  return (
    <Card>
      <form onSubmit={onSubmit} noValidate className="contents">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <fieldset disabled={!canEdit || saving} className="contents">
            <FieldGroup>{children}</FieldGroup>
          </fieldset>
        </CardContent>
        {canEdit && (
          <CardFooter className="flex-wrap justify-end gap-2 border-t">
            {actions}
            {!hideSave && (
              <Button type="submit" disabled={saving || !dirty}>
                {saving && <Spinner />}
                {t('common.saveChanges')}
              </Button>
            )}
          </CardFooter>
        )}
      </form>
    </Card>
  );
}
