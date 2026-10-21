import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { FolderTree, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react';
import { z } from 'zod';
import { usePermission } from '@/hooks/use-permission';
import { applyServerErrors, v } from '@/lib/form';
import type { CategoryNode } from '@/types';
import { Can } from '@/components/common/can';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { EmptyState } from '@/components/common/empty-state';
import { SelectField, SwitchField, TextareaField, TextField } from '@/components/common/fields';
import { FormDrawer } from '@/components/common/form-drawer';
import { ExcelMenu } from '@/components/common/import-dialog';
import { PageHeader } from '@/components/common/page-header';
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
import { Skeleton } from '@/components/ui/skeleton';
import { categoriesResource, flattenTree, useCategoryTree, useMoveCategories } from '../api/products-api';
import { CategoryTree } from '../components/category-tree';

const ROOT = '__root__';
const schema = z.object({
  name: v.required().max(150, 'validation.tooLong'),
  code: v.code(),
  parentId: z.string(),
  description: z.string().max(500, 'validation.tooLong'),
  isActive: z.boolean(),
});
type Values = z.infer<typeof schema>;

/** Ids of a node and everything below it (a category can't move under its own subtree). */
function subtreeIds(node: CategoryNode): string[] {
  return [node.id, ...node.children.flatMap(subtreeIds)];
}

export default function CategoriesPage() {
  const { t } = useTranslation();
  const { can } = usePermission();
  const tree = useCategoryTree();
  const move = useMoveCategories();
  const save = categoriesResource.useSave();
  const remove = categoriesResource.useRemove();

  const [editing, setEditing] = useState<{
    open: boolean;
    node: CategoryNode | null;
    parentId: string | null;
  }>({
    open: false,
    node: null,
    parentId: null,
  });
  const [toDelete, setToDelete] = useState<CategoryNode | null>(null);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', code: '', parentId: ROOT, description: '', isActive: true },
  });
  useEffect(() => {
    if (!editing.open) return;
    const n = editing.node;
    form.reset({
      name: n?.name ?? '',
      code: n?.code ?? '',
      parentId: (n ? n.parentId : editing.parentId) ?? ROOT,
      description: n?.description ?? '',
      isActive: n?.isActive ?? true,
    });
  }, [editing, form]);

  const parentOptions = useMemo(() => {
    const blocked = new Set(editing.node ? subtreeIds(editing.node) : []);
    return [
      { value: ROOT, label: t('products.categories.noParent') },
      ...flattenTree(tree.data ?? [])
        .filter((o) => !blocked.has(o.value))
        .map((o) => ({ value: o.value, label: o.path })),
    ];
  }, [tree.data, editing.node, t]);

  const onSubmit = form.handleSubmit((values) =>
    save.mutate(
      {
        id: editing.node?.id,
        data: {
          ...values,
          parentId: values.parentId === ROOT ? null : values.parentId,
          description: v.nullIfEmpty(values.description),
        },
      },
      {
        onSuccess: () => {
          toast.success(
            t(editing.node ? 'crud.updated' : 'crud.created', { entity: t('products.categories.entityCap') }),
          );
          setEditing((e) => ({ ...e, open: false }));
        },
        onError: (err) => {
          if (!applyServerErrors(err, form.setError)) toast.error(err.message);
        },
      },
    ),
  );

  const actions = (node: CategoryNode) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t('common.actionsFor', { name: node.name })}>
          <MoreHorizontal aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <Can permission="products.create">
          <DropdownMenuItem onSelect={() => setEditing({ open: true, node: null, parentId: node.id })}>
            <Plus aria-hidden /> {t('products.categories.addChild')}
          </DropdownMenuItem>
        </Can>
        <Can permission="products.update">
          <DropdownMenuItem onSelect={() => setEditing({ open: true, node, parentId: null })}>
            <Pencil aria-hidden /> {t('common.edit')}
          </DropdownMenuItem>
        </Can>
        <Can permission="products.delete">
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={() => setToDelete(node)}>
            <Trash2 aria-hidden /> {t('common.delete')}
          </DropdownMenuItem>
        </Can>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const newButton = (
    <Can permission="products.create">
      <Button onClick={() => setEditing({ open: true, node: null, parentId: null })}>
        <Plus aria-hidden /> {t('crud.new', { entity: t('products.categories.entity') })}
      </Button>
    </Can>
  );

  return (
    <>
      <PageHeader
        title={t('products.categories.title')}
        description={t('products.categories.description')}
        breadcrumbs={[{ label: t('nav.inventory') }, { label: t('products.categories.title') }]}
        actions={
          <div className="flex items-center gap-2">
            <ExcelMenu
              url="/product-categories"
              entities={t('products.categories.entities')}
              permission="products"
              invalidate={['product-categories']}
            />
            {newButton}
          </div>
        }
      />

      <Card>
        <CardContent>
          {can('products.update') && (
            <p className="mb-3 text-sm text-muted-foreground">{t('products.categories.dragHint')}</p>
          )}
          {tree.isPending ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-10" style={{ marginLeft: (i % 3) * 28 }} />
              ))}
            </div>
          ) : tree.data?.length ? (
            <div className={move.isPending ? 'pointer-events-none opacity-70' : undefined}>
              <CategoryTree
                tree={tree.data}
                canMove={can('products.update')}
                renderActions={actions}
                onMove={(items) =>
                  move.mutate(items, { onSuccess: () => toast.success(t('products.categories.moved')) })
                }
              />
            </div>
          ) : (
            <EmptyState
              icon={FolderTree}
              title={t('crud.emptyTitle', { entities: t('products.categories.entities') })}
              action={newButton}
            />
          )}
        </CardContent>
      </Card>

      <FormDrawer
        open={editing.open}
        onOpenChange={(o) => setEditing((e) => ({ ...e, open: o }))}
        title={t(editing.node ? 'crud.editTitle' : 'crud.createTitle', {
          entity: t('products.categories.entity'),
        })}
        onSubmit={onSubmit}
        submitting={save.isPending}
        submitLabel={
          editing.node
            ? t('common.saveChanges')
            : t('crud.create', { entity: t('products.categories.entity') })
        }
      >
        <FieldGroup>
          <TextField control={form.control} name="name" label={t('fields.name')} placeholder="Edible Oil" />
          <TextField control={form.control} name="code" label={t('fields.code')} placeholder="OIL" />
          <SelectField
            control={form.control}
            name="parentId"
            label={t('products.categories.parent')}
            options={parentOptions}
          />
          <TextareaField control={form.control} name="description" label={t('fields.description')} />
          <SwitchField control={form.control} name="isActive" label={t('common.active')} />
        </FieldGroup>
      </FormDrawer>

      <ConfirmDialog
        open={Boolean(toDelete)}
        onOpenChange={(o) => !o && setToDelete(null)}
        destructive
        title={t('crud.deleteTitle', { entity: t('products.categories.entity') })}
        description={toDelete && t('crud.deleteText', { name: toDelete.name })}
        confirmLabel={t('common.delete')}
        loading={remove.isPending}
        onConfirm={() =>
          toDelete &&
          remove.mutate(toDelete.id, {
            onSuccess: () => {
              toast.success(t('crud.deleted', { entity: t('products.categories.entityCap') }));
              setToDelete(null);
            },
            onError: () => setToDelete(null),
          })
        }
      />
    </>
  );
}
