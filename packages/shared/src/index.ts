// Components - UI
export * from './components/ui/badge';
export * from './components/ui/button';
export * from './components/ui/card';
export * from './components/ui/dialog';
export * from './components/ui/dropdown-menu';
export * from './components/ui/input';
export * from './components/ui/label';
export * from './components/ui/sonner';
export * from './components/ui/table';

// Components - Shared
export * from './components/shared/sidebar';
export * from './components/shared/header';
export * from './components/shared/layout-wrapper';
export * from './components/shared/activity-drawer';
export * from './components/shared/item-wise-summary-view';
export * from './components/shared/brand-provider';
export * from './components/shared/data-table';
export * from './components/shared/date-range-picker';
export * from './components/shared/force-password-change-modal';
export * from './components/shared/format-values';
export * from './components/shared/pdf-preview-modal';
export * from './components/shared/report-preview-modal';
export * from './components/shared/screen-help-tour';
export * from './components/shared/stat-card';
export * from './components/shared/items-manager';

// Libs
export * from './lib/utils';
export * from './lib/auth';
export * from './lib/passwords';
export * from './lib/demo-data';
export * from './lib/demo-admin-data';
export * from './lib/demo-master-data';
export * from './lib/demo-shop-data';
export * from './lib/master-constants';

// Supabase (client, server, config, types, middleware)
export { createClient as createBrowserClient } from './lib/supabase/client';
export { createClient as createServerClient } from './lib/supabase/server';
export * from './lib/supabase/config';
export * from './lib/supabase/types';
export * from './lib/supabase/middleware';

// Theme
export * from './lib/theme';

// Calculations
export * from './lib/calculations';

// Constants
export {
  ITEM_UNITS,
  ITEM_UNIT_LABELS,
  normalizeItemUnit,
  formatQuantityWithUnit,
} from './lib/constants/units';

// Reports
export * from './lib/reports';

// Backup
export * from './lib/backup';

