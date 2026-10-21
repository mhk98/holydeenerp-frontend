import { useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Download, Eye, FileText, Image as ImageIcon, Paperclip, Trash2, Upload } from 'lucide-react';
import { usePermission } from '@/hooks/use-permission';
import { formatBytes, formatDate } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { openAttachment, useRemoveAttachment, useUploadAttachments } from '../api/banking-api';
import type { Attachment } from '../types';

const ACCEPT = 'image/jpeg,image/png,image/webp,application/pdf';

/** Files on an accounting document: upload (PDF / images), view, download, remove. */
export function AttachmentsCard({
  entityType,
  entityId,
  files,
}: {
  entityType: 'expense' | 'voucher';
  entityId: string;
  files: Attachment[];
}) {
  const { t } = useTranslation();
  const { can } = usePermission();
  const input = useRef<HTMLInputElement>(null);
  const upload = useUploadAttachments();
  const remove = useRemoveAttachment();
  const editable = can(['accounting.create', 'accounting.update']);

  const open = (file: Attachment, download = false) =>
    openAttachment(file, download).catch((err: Error) => toast.error(err.message));

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Paperclip className="size-4" aria-hidden /> {t('accounting.attachments.title')}
          </CardTitle>
          <CardDescription>{t('accounting.attachments.hint')}</CardDescription>
        </div>
        {editable && (
          <>
            <input
              ref={input}
              type="file"
              accept={ACCEPT}
              multiple
              className="sr-only"
              aria-label={t('accounting.attachments.add')}
              onChange={(e) => {
                const chosen = [...(e.target.files ?? [])];
                e.target.value = '';
                if (!chosen.length) return;
                upload.mutate(
                  { entityType, entityId, files: chosen },
                  {
                    onSuccess: () => toast.success(t('accounting.attachments.uploaded')),
                    onError: (err) => toast.error(err.message),
                  },
                );
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => input.current?.click()}
              disabled={upload.isPending}
            >
              {upload.isPending ? <Spinner /> : <Upload aria-hidden />} {t('accounting.attachments.add')}
            </Button>
          </>
        )}
      </CardHeader>
      <CardContent>
        {!files.length ? (
          <p className="text-sm text-muted-foreground">{t('accounting.attachments.none')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {files.map((f) => {
              const Icon = f.mimeType.startsWith('image/') ? ImageIcon : FileText;
              return (
                <li key={f.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                  <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="truncate">{f.originalName}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatBytes(f.size)} · {formatDate(f.createdAt)}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => open(f)}
                    aria-label={t('accounting.attachments.view', { name: f.originalName })}
                  >
                    <Eye aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => open(f, true)}
                    aria-label={t('accounting.attachments.download', { name: f.originalName })}
                  >
                    <Download aria-hidden />
                  </Button>
                  {editable && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(f.id, { onError: (err) => toast.error(err.message) })}
                      aria-label={t('accounting.attachments.remove', { name: f.originalName })}
                    >
                      <Trash2 aria-hidden />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
