import { createResource } from '@/lib/resource';
import type { Party, PartyGroup, PartyType } from '@/types';

export const customersResource = createResource<Party>('customers', '/customers', { related: ['suppliers'] });
export const suppliersResource = createResource<Party>('suppliers', '/suppliers', { related: ['customers'] });
export const customerGroupsResource = createResource<PartyGroup>('customer-groups', '/customer-groups', {
  related: ['customers'],
});
export const supplierGroupsResource = createResource<PartyGroup>('supplier-groups', '/supplier-groups', {
  related: ['suppliers'],
});

export const partyResources: Record<
  PartyType,
  { parties: typeof customersResource; groups: typeof customerGroupsResource; url: string }
> = {
  customer: { parties: customersResource, groups: customerGroupsResource, url: '/customers' },
  supplier: { parties: suppliersResource, groups: supplierGroupsResource, url: '/suppliers' },
};
