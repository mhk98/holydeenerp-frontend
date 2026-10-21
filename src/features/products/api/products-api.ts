import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, apiGet, apiSend, toApiError } from '@/lib/api';
import { createResource } from '@/lib/resource';
import type {
  ApiResponse,
  BarcodeType,
  Brand,
  CategoryNode,
  LabelProduct,
  Product,
  ProductAttribute,
  ProductCategory,
} from '@/types';

export const productsResource = createResource<Product>('products', '/products', {
  related: ['product-categories'],
});
export const categoriesResource = createResource<ProductCategory>(
  'product-categories',
  '/product-categories',
);
export const brandsResource = createResource<Brand>('brands', '/brands', { related: ['products'] });
export const attributesResource = createResource<ProductAttribute>(
  'product-attributes',
  '/product-attributes',
);

// ── Categories ─────────────────────────────────────────────────────────────
export function useCategoryTree() {
  return useQuery({
    queryKey: ['product-categories', 'tree'],
    queryFn: async () => (await apiGet<CategoryNode[]>('/product-categories/tree')).data,
  });
}

export function useMoveCategories() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (items: { id: string; parentId: string | null; sortOrder: number }[]) =>
      apiSend('post', '/product-categories/move', { items }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['product-categories'] }),
  });
}

/** Flat, indented options ("Grocery › Rice") for category pickers. */
export function flattenTree(nodes: CategoryNode[], depth = 0, trail: string[] = []) {
  const out: { value: string; label: string; depth: number; path: string }[] = [];
  for (const n of nodes) {
    const path = [...trail, n.name];
    out.push({ value: n.id, label: n.name, depth, path: path.join(' › ') });
    out.push(...flattenTree(n.children, depth + 1, path));
  }
  return out;
}

// ── Products ───────────────────────────────────────────────────────────────
export function useSaveProduct() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id?: string; data: unknown }) =>
      (await apiSend<Product>(id ? 'put' : 'post', id ? `/products/${id}` : '/products', data)).data,
    onSuccess: (product) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      queryClient.setQueryData(productsResource.keys.detail(product.id), product);
    },
    onError: () => {},
  });
}

export async function generateBarcode(type: BarcodeType, sku?: string) {
  return (await apiGet<{ barcode: string }>('/products/barcode/generate', { type, sku })).data.barcode;
}

function useProductImageWrite<A>(id: string, fn: (arg: A) => Promise<Product>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (product) => {
      queryClient.setQueryData(productsResource.keys.detail(id), product);
      queryClient.invalidateQueries({ queryKey: ['products', 'list'] });
    },
  });
}

export const useUploadImages = (id: string) =>
  useProductImageWrite(id, async (files: File[]) => {
    const form = new FormData();
    files.forEach((f) => form.append('images', f));
    try {
      return (await api.post<ApiResponse<Product>>(`/products/${id}/images`, form)).data.data;
    } catch (err) {
      throw toApiError(err);
    }
  });

export const useDeleteImage = (id: string) =>
  useProductImageWrite(
    id,
    async (imageId: string) => (await apiSend<Product>('delete', `/products/${id}/images/${imageId}`)).data,
  );

export const useOrderImages = (id: string) =>
  useProductImageWrite(
    id,
    async (imageIds: string[]) =>
      (await apiSend<Product>('put', `/products/${id}/images/order`, { imageIds })).data,
  );

export function useLabelProducts(ids: string[]) {
  return useQuery({
    queryKey: ['products', 'labels', ids],
    queryFn: async () => (await apiGet<LabelProduct[]>('/products/labels', { ids: ids.join(',') })).data,
    enabled: ids.length > 0,
  });
}

// ── Brands ─────────────────────────────────────────────────────────────────
export function useUploadBrandLogo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, file }: { id: string; file: File }) => {
      const form = new FormData();
      form.append('logo', file);
      try {
        return (await api.post<ApiResponse<Brand>>(`/brands/${id}/logo`, form)).data.data;
      } catch (err) {
        throw toApiError(err);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['brands'] }),
  });
}

export interface ProductLookups {
  units: { id: string; name: string; code: string; allowDecimal: boolean }[];
  taxGroups: { id: string; name: string; code: string }[];
}

/** Units and tax groups for the product form (needs products.view only). */
export function useProductLookups() {
  return useQuery({
    queryKey: ['products', 'lookups'],
    queryFn: async () => (await apiGet<ProductLookups>('/products/lookups')).data,
    staleTime: 5 * 60_000,
  });
}
