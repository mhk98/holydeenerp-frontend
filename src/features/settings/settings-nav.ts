import {
  BookOpen,
  Boxes,
  Building2,
  Coins,
  DatabaseBackup,
  GitBranch,
  Hash,
  Landmark,
  type LucideIcon,
  Mail,
  MonitorSmartphone,
  Percent,
  Printer,
  Receipt,
  Ruler,
  ShieldCheck,
  ShoppingCart,
  SlidersHorizontal,
  UserCog,
  Wallet,
  Warehouse,
} from 'lucide-react';

export interface SettingsNavItem {
  /** Path segment under /settings and i18n key under settings.nav.* */
  key: string;
  icon: LucideIcon;
  permission?: string;
  superAdminOnly?: boolean;
}

export interface SettingsNavGroup {
  key: string;
  items: SettingsNavItem[];
}

/** Left-hand navigation of the Settings area (also drives its routes' permissions). */
export const SETTINGS_NAV: SettingsNavGroup[] = [
  {
    key: 'organization',
    items: [
      { key: 'company', icon: Building2, permission: 'settings.view' },
      { key: 'branches', icon: GitBranch, permission: 'settings.view' },
      { key: 'warehouses', icon: Warehouse, permission: 'settings.view' },
    ],
  },
  {
    key: 'finance',
    items: [
      { key: 'financial', icon: Landmark, permission: 'settings.view' },
      { key: 'currencies', icon: Coins, permission: 'settings.view' },
      { key: 'taxes', icon: Percent, permission: 'settings.view' },
      { key: 'payment-methods', icon: Wallet, permission: 'settings.view' },
      { key: 'accounting', icon: BookOpen, permission: 'accounting.view' },
    ],
  },
  {
    key: 'documents',
    items: [
      { key: 'numbering', icon: Hash, permission: 'settings.view' },
      { key: 'units', icon: Ruler, permission: 'settings.view' },
      { key: 'inventory', icon: Boxes, permission: 'settings.view' },
      { key: 'sales', icon: Receipt, permission: 'settings.view' },
      { key: 'pos', icon: MonitorSmartphone, permission: 'settings.view' },
      { key: 'purchase', icon: ShoppingCart, permission: 'settings.view' },
      { key: 'print-templates', icon: Printer, permission: 'settings.view' },
      { key: 'email', icon: Mail, permission: 'settings.view' },
    ],
  },
  {
    key: 'access',
    items: [
      { key: 'users', icon: UserCog, permission: 'users.view' },
      { key: 'roles', icon: ShieldCheck, permission: 'users.view' },
    ],
  },
  {
    key: 'system',
    items: [
      { key: 'preferences', icon: SlidersHorizontal, permission: 'settings.view' },
      { key: 'backups', icon: DatabaseBackup, superAdminOnly: true },
    ],
  },
];
