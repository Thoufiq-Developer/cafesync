// ==============================================================================
// CafeSync - Framework-Independent Backup & Restore Types
// Pure TypeScript - No Next.js or Server-specific dependencies
// ==============================================================================

export type BackupScope = 'all' | 'brand';
export type ImportMode = 'add_only' | 'add_update';
export type ImportStatus = 'completed' | 'undone' | 'failed';

export interface BackupBrandMeta {
  id: string;
  name: string;
  slug: string;
  registration_no?: string | null;
}

export interface BackupManifest {
  format_version: '1.0';
  created_at: string;
  created_by: string;
  scope: BackupScope;
  brands: BackupBrandMeta[];
  date_range: string;
  row_counts: Record<string, Record<string, number>>; // { [brand_slug]: { [sheetName]: number } }
  checksums: Record<string, string>; // { [filePathInZip]: sha256_hex }
}

export interface BackupOptions {
  scope: BackupScope;
  brandId?: string; // Required when scope is 'brand'
  monthRange?: {
    start?: string; // YYYY-MM
    end?: string;   // YYYY-MM
  };
  includeLogos?: boolean;
  onProgress?: (step: string, percentage: number) => void;
  abortSignal?: AbortSignal;
}

export interface BackupResult {
  blob: Blob;
  filename: string;
  manifest: BackupManifest;
  fileSize: number;
}

export interface SheetMeta {
  format_version: '1.0';
  brand_id: string;
  brand_slug: string;
  sheet_type: 'brand-data' | 'monthly';
  month?: string; // YYYY-MM
  generated_at: string;
}

export interface ValidationError {
  file: string;
  sheet: string;
  row: number;
  column?: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface SheetValidationStats {
  sheetName: string;
  totalRows: number;
  addCount: number;
  updateCount: number;
  unchangedCount: number;
  errorCount: number;
}

export interface BrandValidationSummary {
  brandId: string;
  brandSlug: string;
  brandName: string;
  isNewBrand: boolean;
  sheets: Record<string, SheetValidationStats>;
  monthlyFiles: string[];
  totalRows: number;
  errorsCount: number;
}

export interface UserToRecreate {
  id: string;
  brand_id: string;
  shop_id?: string | null;
  role: 'admin' | 'manager';
  full_name: string;
  email?: string | null;
  username?: string | null;
  phone?: string | null;
}

export interface RecreatedUserCredential {
  id: string;
  brand_id: string;
  role: string;
  full_name: string;
  email: string;
  username?: string;
  tempPassword: string;
}

export interface ParsedBrandData {
  meta: SheetMeta;
  brands: any[];
  brand_settings: any[];
  shops: any[];
  profiles: any[];
  payment_modes: any[];
  items: any[];
  employees: any[];
  assets: any[];
  asset_service_logs: any[];
  month_openings: any[];
  logos?: Array<{ filename: string; data: Uint8Array; mimeType: string }>;
}

export interface ParsedMonthlyData {
  meta: SheetMeta;
  month: string;
  transactions: any[];
  daily_summary: any[];
  salary_records: any[];
  summary: any[];
}

export interface ParsedBackupPayload {
  manifest?: BackupManifest;
  brands: Record<string, {
    brandData?: ParsedBrandData;
    monthlyData: Record<string, ParsedMonthlyData>; // month -> data
  }>;
}

export interface ValidationReport {
  isValid: boolean;
  isLegacy: boolean;
  formatVersion?: string;
  brandsSummary: Record<string, BrandValidationSummary>;
  totalAdd: number;
  totalUpdate: number;
  totalUnchanged: number;
  totalErrors: number;
  errors: ValidationError[];
  usersToRecreate: UserToRecreate[];
  payload?: ParsedBackupPayload;
}

export interface ImportOptions {
  mode: ImportMode;
  preBackup?: boolean;
  onProgress?: (step: string, percentage: number) => void;
  abortSignal?: AbortSignal;
}

export interface ImportChunkResult {
  table: string;
  attempted: number;
  added: number;
  updated: number;
  failed: number;
  error?: string;
}

export interface ImportResult {
  success: boolean;
  batchId: string;
  preBackupBlob?: Blob;
  preBackupFilename?: string;
  addedCounts: Record<string, number>;
  updatedCounts: Record<string, number>;
  skippedCounts: Record<string, number>;
  totalAdded: number;
  totalUpdated: number;
  errors: Array<{ table: string; message: string }>;
  usersToRecreate: UserToRecreate[];
  recalculatedShops: string[];
  recalculatedMonths: string[];
}

