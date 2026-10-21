import { Fragment, useEffect, useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  FolderPlus,
  ListTree,
  Lock,
  MoreHorizontal,
  Pencil,
  Plus,
  ScrollText,
  Trash2,
} from 'lucide-react';
import { applyServerErrors, v } from '@/lib/form';
import { formatCurrency } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/stores/settings-store';
import { Can } from '@/components/common/can';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { EmptyState } from '@/components/common/empty-state';
import { SelectField, SwitchField, TextareaField, TextField } from '@/components/common/fields';
import { FormDrawer } from '@/components/common/form-drawer';
import { PageHeader } from '@/components/common/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FieldGroup } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { accountsResource, useAccountTree } from '../api/accounting-api';
import { ACCOUNTING_ROUTES, accountName, flattenAccounts } from '../lib';
import { ACCOUNT_SUBTYPES, ACCOUNT_TYPES, type AccountNode, type AccountType } from '../types';

const ROOT = '__root__';
const schema = z.object({
  code: v
    .required()
    .max(20, 'validation.tooLong')
    .regex(/^[A-Za-z0-9.-]+$/, 'validation.code'),
  name: v.required().max(150, 'validation.tooLong'),
  nameBn: z.string().max(150, 'validation.tooLong'),
  parentId: z.string(),
  type: z.enum(ACCOUNT_TYPES as [AccountType, ...AccountType[]]),
  subtype: v.required(),
  isGroup: z.boolean(),
  isActive: z.boolean(),
  description: z.string().max(500, 'validation.tooLong'),
});
type Values = z.infer<typeof schema>;

/** Chart of accounts: the account tree with balances; groups fold open, ledgers are postable. */
export default function AccountsPage() {
  const { t } = useTranslation();
  const language = useSettingsStore((s) => s.language);
  const [showInactive, setShowInactive] = useState(false);
  const [filter, setFilter] = useState('');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const tree = useAccountTree({ balances: true, includeInactive: showInactive });
  const save = accountsResource.useSave();
  const remove = accountsResource.useRemove();
  const [editing, setEditing] = useState<{
    open: boolean;
    node: AccountNode | null;
    parentId: string | null;
  }>({
    open: false,
    node: null,
    parentId: null,
  });
  const [toDelete, setToDelete] = useState<AccountNode | null>(null);

  const flat = useMemo(() => flattenAccounts(tree.data ?? []), [tree.data]);
  const byId = useMemo(() => new Map(flat.map((n) => [n.id, n])), [flat]);

  // Rows to show: collapsed groups hide their subtree; a search shows matches with their ancestors.
  const rows = useMemo(() => {
    const term = filter.trim().toLowerCase();
    if (term) {
      const keep = new Set<string>();
      for (const n of flat) {
        if (`${n.code} ${n.name} ${n.nameBn ?? ''}`.toLowerCase().includes(term)) {
          for (let p: typeof n | undefined = n; p; p = p.parentId ? byId.get(p.parentId) : undefined)
            keep.add(p.id);
        }
      }
      return flat.filter((n) => keep.has(n.id));
    }
    const hidden = new Set<string>();
    return flat.filter((n) => {
      if (n.parentId && (hidden.has(n.parentId) || collapsed.has(n.parentId))) {
        hidden.add(n.id);
        return false;
      }
      return true;
    });
  }, [flat, byId, filter, collapsed]);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: '',
      name: '',
      nameBn: '',
      parentId: ROOT,
      type: 'asset',
      subtype: 'current_asset',
      isGroup: false,
      isActive: true,
      description: '',
    },
  });
  const parentId = useWatch({ control: form.control, name: 'parentId' });
  const type = useWatch({ control: form.control, name: 'type' });
  const parent = parentId !== ROOT ? byId.get(parentId) : undefined;

  useEffect(() => {
    if (!editing.open) return;
    const n = editing.node;
    const p = editing.parentId ? byId.get(editing.parentId) : undefined;
    form.reset({
      code: n?.code ?? '',
      name: n?.name ?? '',
      nameBn: n?.nameBn ?? '',
      parentId: (n ? n.parentId : editing.parentId) ?? ROOT,
      type: n?.type ?? p?.type ?? 'asset',
      subtype: n?.subtype ?? p?.subtype ?? 'current_asset',
      isGroup: n?.isGroup ?? false,
      isActive: n?.isActive ?? true,
      description: n?.description ?? '',
    });
  }, [editing, form, byId]);

  // A child takes its parent's type; keep the category valid for the type.
  useEffect(() => {
    if (parent && parent.type !== form.getValues('type')) form.setValue('type', parent.type);
  }, [parent, form]);
  useEffect(() => {
    if (!ACCOUNT_SUBTYPES[type].includes(form.getValues('subtype')))
      form.setValue('subtype', ACCOUNT_SUBTYPES[type][0]);
  }, [type, form]);

  const parentOptions = useMemo(() => {
    const blocked = new Set<string>();
    if (editing.node) for (const n of flattenAccounts([editing.node])) blocked.add(n.id);
    return [
      { value: ROOT, label: t('accounting.accounts.topLevel') },
      ...flat
        .filter((n) => n.isGroup && !blocked.has(n.id))
        .map((n) => ({
          value: n.id,
          label: `${'  '.repeat(n.depth)}${n.code} · ${accountName(n, language)}`,
        })),
    ];
  }, [flat, editing.node, t, language]);

  const onSubmit = form.handleSubmit((values) =>
    save.mutate(
      {
        id: editing.node?.id,
        data: {
          code: values.code,
          name: values.name,
          nameBn: v.nullIfEmpty(values.nameBn),
          parentId: values.parentId === ROOT ? null : values.parentId,
          ...(values.parentId === ROOT && { type: values.type }),
          subtype: values.subtype,
          isGroup: values.isGroup,
          isActive: values.isActive,
          description: v.nullIfEmpty(values.description),
        },
      },
      {
        onSuccess: () => {
          toast.success(
            t(editing.node ? 'crud.updated' : 'crud.created', { entity: t('accounting.accounts.entityCap') }),
          );
          setEditing((e) => ({ ...e, open: false }));
        },
        onError: (err) => {
          if (!applyServerErrors(err, form.setError)) toast.error(err.message);
        },
      },
    ),
  );

  const toggle = (id: string) =>
    setCollapsed((c) => {
      const next = new Set(c);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const newButton = (
    <Can permission="accounting.create">
      <Button onClick={() => setEditing({ open: true, node: null, parentId: null })}>
        <Plus aria-hidden /> {t('crud.new', { entity: t('accounting.accounts.entity') })}
      </Button>
    </Can>
  );

  const actions = (node: AccountNode) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t('common.actionsFor', { name: node.name })}>
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {node.isGroup ? (
          <Can permission="accounting.create">
            <DropdownMenuItem onSelect={() => setEditing({ open: true, node: null, parentId: node.id })}>
              <FolderPlus aria-hidden /> {t('accounting.accounts.addChild')}
            </DropdownMenuItem>
          </Can>
        ) : (
          <DropdownMenuItem asChild>
            <Link to={`${ACCOUNTING_ROUTES.journals}?accountId=${node.id}`}>
              <ScrollText aria-hidden /> {t('accounting.accounts.viewJournals')}
            </Link>
          </DropdownMenuItem>
        )}
        <Can permission="accounting.update">
          <DropdownMenuItem onSelect={() => setEditing({ open: true, node, parentId: null })}>
            <Pencil aria-hidden /> {t('common.edit')}
          </DropdownMenuItem>
        </Can>
        {!node.isSystem && (
          <Can permission="accounting.delete">
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => setToDelete(node)}>
              <Trash2 aria-hidden /> {t('common.delete')}
            </DropdownMenuItem>
          </Can>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const isEditingSystem = Boolean(editing.node?.isSystem);

  return (
    <>
      <PageHeader
        title={t('accounting.accounts.title')}
        description={t('accounting.accounts.description')}
        breadcrumbs={[{ label: t('nav.accounting') }, { label: t('accounting.accounts.title') }]}
        actions={newButton}
      />
      <Card>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <Input
              className="w-full sm:w-72"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={t('accounting.searchAccount')}
              aria-label={t('accounting.searchAccount')}
            />
            <div className="flex items-center gap-2">
              <Switch id="show-inactive" checked={showInactive} onCheckedChange={setShowInactive} />
              <Label htmlFor="show-inactive">{t('accounting.accounts.showInactive')}</Label>
            </div>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setCollapsed(new Set())}>
                <ChevronDown aria-hidden /> {t('accounting.accounts.expandAll')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setCollapsed(new Set(flat.filter((n) => n.isGroup && n.depth > 0).map((n) => n.id)))
                }
              >
                <ListTree aria-hidden /> {t('accounting.accounts.collapseAll')}
              </Button>
            </div>
          </div>

          {tree.isPending ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} className="h-9" />
              ))}
            </div>
          ) : !rows.length ? (
            <EmptyState icon={BookOpen} title={t('accounting.accounts.empty')} action={newButton} />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-72">{t('accounting.account')}</TableHead>
                    <TableHead className="hidden md:table-cell">{t('accounting.type')}</TableHead>
                    <TableHead className="hidden lg:table-cell">{t('accounting.category')}</TableHead>
                    <TableHead className="text-right">{t('accounting.balance')}</TableHead>
                    <TableHead className="w-10">
                      <span className="sr-only">{t('common.actions')}</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((n) => (
                    <Fragment key={n.id}>
                      <TableRow
                        className={cn(n.isGroup && 'bg-muted/40 font-medium', !n.isActive && 'opacity-60')}
                      >
                        <TableCell>
                          <div className="flex items-center gap-1.5" style={{ paddingLeft: n.depth * 20 }}>
                            {n.isGroup && n.children.length ? (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="size-6"
                                onClick={() => toggle(n.id)}
                                aria-expanded={!collapsed.has(n.id)}
                                aria-label={t(
                                  collapsed.has(n.id)
                                    ? 'accounting.accounts.expand'
                                    : 'accounting.accounts.collapse',
                                  { name: n.name },
                                )}
                              >
                                {collapsed.has(n.id) ? (
                                  <ChevronRight aria-hidden />
                                ) : (
                                  <ChevronDown aria-hidden />
                                )}
                              </Button>
                            ) : (
                              <span className="inline-block w-6" />
                            )}
                            <span className="w-12 shrink-0 font-mono text-xs text-muted-foreground">
                              {n.code}
                            </span>
                            <span className="truncate">{accountName(n, language)}</span>
                            {n.systemKey && (
                              <Lock
                                className="size-3 shrink-0 text-muted-foreground"
                                aria-label={t('accounting.accounts.systemAccount')}
                              />
                            )}
                            {!n.isActive && (
                              <Badge variant="outline" className="font-normal">
                                {t('common.inactive')}
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground md:table-cell">
                          {t(`accounting.types.${n.type}`)}
                        </TableCell>
                        <TableCell className="hidden text-muted-foreground lg:table-cell">
                          {t(`accounting.subtypes.${n.subtype}`)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            'text-right tabular-nums',
                            Number(n.balance) < 0 && 'text-destructive',
                            n.depth === 0 && 'font-semibold',
                          )}
                        >
                          {formatCurrency(n.balance ?? 0)}
                        </TableCell>
                        <TableCell>{actions(n)}</TableCell>
                      </TableRow>
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <FormDrawer
        open={editing.open}
        onOpenChange={(o) => setEditing((e) => ({ ...e, open: o }))}
        title={t(editing.node ? 'crud.editTitle' : 'crud.createTitle', {
          entity: t('accounting.accounts.entity'),
        })}
        onSubmit={onSubmit}
        submitting={save.isPending}
        submitLabel={
          editing.node
            ? t('common.saveChanges')
            : t('crud.create', { entity: t('accounting.accounts.entity') })
        }
      >
        <FieldGroup>
          <div className="grid gap-4 sm:grid-cols-3">
            <TextField control={form.control} name="code" label={t('fields.code')} placeholder="5410" />
            <div className="sm:col-span-2">
              <TextField
                control={form.control}
                name="name"
                label={t('fields.name')}
                placeholder="Printing & Stationery"
              />
            </div>
          </div>
          <TextField control={form.control} name="nameBn" label={t('accounting.accounts.nameBn')} />
          <SelectField
            control={form.control}
            name="parentId"
            label={t('accounting.accounts.parent')}
            options={parentOptions}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              control={form.control}
              name="type"
              label={t('accounting.type')}
              description={parent ? t('accounting.accounts.typeFromParent') : undefined}
              disabled={Boolean(parent) || isEditingSystem}
              options={ACCOUNT_TYPES.map((x) => ({ value: x, label: t(`accounting.types.${x}`) }))}
            />
            <SelectField
              control={form.control}
              name="subtype"
              label={t('accounting.category')}
              options={ACCOUNT_SUBTYPES[type].map((x) => ({
                value: x,
                label: t(`accounting.subtypes.${x}`),
              }))}
            />
          </div>
          {!isEditingSystem && (
            <SwitchField
              control={form.control}
              name="isGroup"
              label={t('accounting.accounts.isGroup')}
              description={t('accounting.accounts.isGroupHint')}
            />
          )}
          <SwitchField control={form.control} name="isActive" label={t('common.active')} />
          <TextareaField control={form.control} name="description" label={t('fields.description')} />
        </FieldGroup>
      </FormDrawer>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        destructive
        title={t('crud.deleteTitle', { entity: t('accounting.accounts.entity') })}
        description={toDelete && t('crud.deleteText', { name: `${toDelete.code} ${toDelete.name}` })}
        confirmLabel={t('common.delete')}
        loading={remove.isPending}
        onConfirm={() =>
          toDelete &&
          remove.mutate(toDelete.id, {
            onSuccess: () => {
              toast.success(t('crud.deleted', { entity: t('accounting.accounts.entityCap') }));
              setToDelete(null);
            },
            onError: (err) => {
              toast.error(err.message);
              setToDelete(null);
            },
          })
        }
      />
    </>
  );
}
