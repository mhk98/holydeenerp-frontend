import type { UserRef } from '@/types';

export type BomStatus = 'draft' | 'active' | 'archived';
export type MoStatus =
  | 'draft'
  | 'confirmed'
  | 'material_issued'
  | 'in_progress'
  | 'quality_check'
  | 'completed'
  | 'closed'
  | 'cancelled';
export type Priority = 'low' | 'normal' | 'high' | 'urgent';
export type OperationStatus = 'pending' | 'in_progress' | 'done';

export interface ProductRef {
  id: string;
  name: string;
  sku: string;
  type?: string;
  baseUnitId?: string | null;
  trackBatch?: boolean;
  trackExpiry?: boolean;
}
export interface VariantRef {
  id: string;
  name: string;
  sku: string;
}

export interface WorkCenter {
  id: string;
  code: string;
  name: string;
  branchId: string | null;
  capacityHours: string;
  labourCostPerHour: string;
  overheadCostPerHour: string;
  isActive: boolean;
  notes: string | null;
}

export interface BomComponent {
  id: string;
  productId: string;
  variantId: string | null;
  unitId: string | null;
  unitFactor: string;
  quantity: string;
  baseQuantity: string;
  wastagePercent: string;
  notes: string | null;
  product?: ProductRef;
  variant?: VariantRef | null;
  unit?: { id: string; code: string; name: string } | null;
}
export interface BomByproduct {
  id: string;
  productId: string;
  variantId: string | null;
  quantity: string;
  costSharePercent: string;
  product?: ProductRef;
  variant?: VariantRef | null;
}
export interface BomOperation {
  id: string;
  sequence: number;
  name: string;
  workCenterId: string;
  setupMinutes: string;
  runMinutes: string;
  notes: string | null;
  workCenter?: Pick<WorkCenter, 'id' | 'code' | 'name' | 'labourCostPerHour' | 'overheadCostPerHour'>;
}
export interface BomCheckpoint {
  id: string;
  sequence: number;
  name: string;
  instructions: string | null;
}
export interface StandardCost {
  quantity: string;
  material: string;
  labour: string;
  overhead: string;
  total: string;
  byproductCost: string;
  unitCost: string;
  lines: {
    componentId: string;
    productId: string;
    quantity: string;
    unitCost: string;
    cost: string;
    subAssembly: boolean;
  }[];
}
export interface Bom {
  id: string;
  code: string;
  name: string;
  version: number;
  productId: string;
  variantId: string | null;
  quantity: string;
  status: BomStatus;
  isDefault: boolean;
  notes: string | null;
  activatedAt: string | null;
  createdAt: string;
  updatedAt: string;
  product?: ProductRef;
  variant?: VariantRef | null;
  activator?: UserRef | null;
  components?: BomComponent[];
  byproducts?: BomByproduct[];
  operations?: BomOperation[];
  qualityChecks?: BomCheckpoint[];
  standardCost?: StandardCost;
}
export interface BomTreeNode {
  productId: string;
  variantId: string | null;
  name?: string;
  sku?: string;
  quantity: string;
  wastagePercent: string;
  bomId: string | null;
  bomCode: string | null;
  children: BomTreeNode[];
}
export interface BomTree {
  bomId: string;
  bomCode: string;
  productId: string;
  name?: string;
  sku?: string;
  quantity: string;
  children: BomTreeNode[];
}

export interface MoMaterial {
  id: string;
  productId: string;
  variantId: string | null;
  requiredQuantity: string;
  issuedQuantity: string;
  returnedQuantity: string;
  cost: string;
  product?: ProductRef;
  variant?: VariantRef | null;
}
export interface MoOperation {
  id: string;
  sequence: number;
  name: string;
  workCenterId: string;
  plannedMinutes: string;
  actualMinutes: string;
  status: OperationStatus;
  startedAt: string | null;
  finishedAt: string | null;
  labourCost: string;
  overheadCost: string;
  workCenter?: Pick<WorkCenter, 'id' | 'code' | 'name'>;
}
export interface MoOutput {
  id: string;
  kind: 'product' | 'byproduct';
  productId: string;
  variantId: string | null;
  quantity: string;
  unitCost: string;
  totalCost: string;
  outputDate: string;
  product?: ProductRef;
  variant?: VariantRef | null;
  batch?: { id: string; batchNo: string } | null;
}
export interface MoScrap {
  id: string;
  productId: string;
  quantity: string;
  cost: string;
  reason: string;
  createdAt: string;
  product?: ProductRef;
  variant?: VariantRef | null;
}
export interface QualityCheck {
  id: string;
  name: string;
  result: 'pass' | 'fail';
  passedQuantity: string;
  failedQuantity: string;
  action: 'accept' | 'scrap' | 'rework';
  reason: string | null;
  checkedAt: string;
  checker?: UserRef | null;
}
export interface WarehouseRef {
  id: string;
  code: string;
  name: string;
  branchId: string;
}
export interface ManufacturingOrder {
  id: string;
  number: string;
  productId: string;
  variantId: string | null;
  bomId: string;
  parentId: string | null;
  salesOrderId: string | null;
  salesOrderItemId: string | null;
  rawWarehouseId: string;
  finishedWarehouseId: string;
  quantity: string;
  producedQuantity: string;
  goodQuantity: string;
  scrappedQuantity: string;
  status: MoStatus;
  priority: Priority;
  plannedStart: string;
  plannedEnd: string;
  actualStart: string | null;
  actualEnd: string | null;
  stdMaterialCost: string;
  stdLabourCost: string;
  stdOverheadCost: string;
  materialCost: string;
  labourCost: string;
  overheadCost: string;
  outputCost: string;
  varianceCost: string;
  unitCost: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string | null;
  completedAt?: string | null;
  closedAt?: string | null;
  cancelledAt?: string | null;
  product?: ProductRef;
  variant?: VariantRef | null;
  bom?: Pick<Bom, 'id' | 'code' | 'version' | 'quantity'>;
  salesOrder?: { id: string; number: string } | null;
  parent?: { id: string; number: string } | null;
  rawWarehouse?: WarehouseRef;
  finishedWarehouse?: WarehouseRef;
  creator?: UserRef | null;
  confirmer?: UserRef | null;
  completer?: UserRef | null;
  closer?: UserRef | null;
  canceller?: UserRef | null;
  materials?: MoMaterial[];
  operations?: MoOperation[];
  outputs?: MoOutput[];
  scrap?: MoScrap[];
  qualityChecks?: QualityCheck[];
  checkpoints?: BomCheckpoint[];
  children?: Pick<ManufacturingOrder, 'id' | 'number' | 'status' | 'quantity' | 'productId'>[];
}

export interface MrpRow {
  productId: string;
  variantId: string | null;
  name: string;
  variantName: string | null;
  sku: string;
  unit: string | null;
  demand: string;
  onHand: string;
  onOrder: string;
  requested: string;
  inProduction: string;
  shortage: string;
  action: 'buy' | 'make';
  bomId: string | null;
  estimatedCost: string;
  needBy: string | null;
  orders: string;
}
export interface MrpResult {
  rows: MrpRow[];
  summary: { items: number; shortages: number; orders: number; estimatedCost?: string };
}

export type ReportName = 'production' | 'consumption' | 'wastage' | 'cost-variance' | 'work-centers';
export type ReportRow = Record<string, string | number | null>;
export interface ReportResult {
  from: string;
  to: string;
  rows: ReportRow[];
  log?: ReportRow[];
  summary: Record<string, string | number | null>;
}
