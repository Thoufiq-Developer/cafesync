'use client';

// ==============================================================================
// CafeSync - Master Panel Backup & Restore View
// Complete client-side browser execution using exceljs and jszip
// ==============================================================================

import React, { useState, useRef, useEffect } from 'react';
import ExcelJS from 'exceljs';
import {
  Archive,
  Download,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Building2,
  Store,
  Layers,
  Key,
  Copy,
  Clock,
  Check,
  ShieldCheck,
  X,
  FileText,
  Calendar,
  Trash2,
  AlertOctagon,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import {
  exportBackup,
  validateBackupFiles,
  executeImport,
  generateErrorReportCsv,
  parseLegacyWorkbook,
  detectLegacyDuplicates,
  matchLegacyItems,
  previewRemoval,
  executeRemoval,
  generateRemovalReport,
  ValidationReport,
  ImportResult,
  RecreatedUserCredential,
  LegacyParsedRow,
  RemovalScope,
  RemovalPreview,
  RemovalExecutionResult,
} from '@/lib/backup';
import { recreateAuthUsersAction } from '@/app/master/backup/actions';

interface BrandItem {
  id: string;
  name: string;
  slug: string;
  shops_count?: number;
  status?: string;
  shops?: Array<{ id: string; name: string; code?: string }>;
}

interface BackupLogRecord {
  id: string;
  scope: string;
  brand_id?: string | null;
  date_range?: string | null;
  file_size?: number | null;
  row_counts?: any;
  created_at: string;
  brand_name?: string;
}

interface RemovalLogRecord {
  id: string;
  scope: string;
  brand_id?: string | null;
  brand_name?: string | null;
  target_name?: string | null;
  details?: any;
  counts?: any;
  created_at: string;
}

interface ImportBatchRecord {
  id: string;
  file_names: string[];
  mode: string;
  rows_added: number;
  rows_updated: number;
  status: string;
  created_at: string;
}

interface BackupViewProps {
  brands: BrandItem[];
  initialHistory?: BackupLogRecord[];
  initialRemovals?: RemovalLogRecord[];
  initialBatches?: ImportBatchRecord[];
}

export function BackupView({
  brands,
  initialHistory = [],
  initialRemovals = [],
  initialBatches = [],
}: BackupViewProps) {
  const [activeTab, setActiveTab] = useState<'backup' | 'restore' | 'remove'>('backup');
  const [history, setHistory] = useState<BackupLogRecord[]>(initialHistory);
  const [removals, setRemovals] = useState<RemovalLogRecord[]>(initialRemovals);
  const [batches, setBatches] = useState<ImportBatchRecord[]>(initialBatches);

  // Backup configuration
  const [includeLogos, setIncludeLogos] = useState(true);
  const [useMonthRange, setUseMonthRange] = useState(false);
  const [monthStart, setMonthStart] = useState('');
  const [monthEnd, setMonthEnd] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgressText, setExportProgressProgress] = useState('');
  const [exportProgressPct, setExportProgressPct] = useState(0);
  const exportAbortController = useRef<AbortController | null>(null);

  // Restore configuration
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [isValidating, setIsValidating] = useState(false);
  const [validationReport, setValidationReport] = useState<ValidationReport | null>(null);
  const [importMode, setImportMode] = useState<'add_only' | 'add_update'>('add_only');
  const [preBackupToggle, setPreBackupToggle] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgressText, setImportProgressText] = useState('');
  const [importProgressPct, setImportProgressPct] = useState(0);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const importAbortController = useRef<AbortController | null>(null);

  // User credentials recreation
  const [isRecreatingUsers, setIsRecreatingUsers] = useState(false);
  const [recreatedCredentials, setRecreatedCredentials] = useState<RecreatedUserCredential[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Legacy file importer state
  const [legacySelectedBrand, setLegacySelectedBrand] = useState<string>(brands[0]?.id || '');
  const [legacyShops, setLegacyShops] = useState<Array<{ id: string; name: string }>>([]);
  const [legacySelectedShop, setLegacySelectedShop] = useState<string>('');
  const [legacySheetNames, setLegacySheetNames] = useState<string[]>([]);
  const [legacySelectedSheet, setLegacySelectedSheet] = useState<string>('');
  const [legacyRows, setLegacyRows] = useState<LegacyParsedRow[]>([]);
  const [legacyOpening, setLegacyOpening] = useState<number>(0);
  const [legacyDuplicates, setLegacyDuplicates] = useState<LegacyParsedRow[]>([]);
  const [legacyUnmatchedItems, setLegacyUnmatchedItems] = useState<string[]>([]);
  const [isParsingLegacy, setIsParsingLegacy] = useState(false);
  const legacyWorkbookParser = useRef<any>(null);

  // Remove Data State
  const [removeScope, setRemoveScope] = useState<RemovalScope>('undo_upload');
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [selectedRemoveBrandId, setSelectedRemoveBrandId] = useState<string>(brands[0]?.id || '');
  const [selectedRemoveShopId, setSelectedRemoveShopId] = useState<string>('all');
  const [removeShops, setRemoveShops] = useState<Array<{ id: string; name: string }>>([]);
  const [removeMonthStart, setRemoveMonthStart] = useState<string>('');
  const [removeMonthEnd, setRemoveMonthEnd] = useState<string>('');

  const [removalPreview, setRemovalPreview] = useState<RemovalPreview | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);

  const [safetyBackupDownloaded, setSafetyBackupDownloaded] = useState(false);
  const [safetyBackupFilename, setSafetyBackupFilename] = useState<string | null>(null);
  const [isGeneratingSafetyBackup, setIsGeneratingSafetyBackup] = useState(false);

  const [typedConfirmation, setTypedConfirmation] = useState('');
  const [isRemoving, setIsRemoving] = useState(false);
  const [removalProgressText, setRemovalProgressText] = useState('');
  const [removalProgressPct, setRemovalProgressPct] = useState(0);
  const [removalResult, setRemovalResult] = useState<RemovalExecutionResult | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch shops when selectedRemoveBrandId changes
  useEffect(() => {
    if (!selectedRemoveBrandId) return;
    const supabase = createClient() as any;
    supabase
      .from('shops')
      .select('id, name')
      .eq('brand_id', selectedRemoveBrandId)
      .eq('status', 'active')
      .order('name')
      .then(({ data }: any) => {
        setRemoveShops(data || []);
      });
  }, [selectedRemoveBrandId]);

  // Fetch shops when legacy selected brand changes
  useEffect(() => {
    if (!legacySelectedBrand) return;
    const supabase = createClient() as any;
    supabase
      .from('shops')
      .select('id, name')
      .eq('brand_id', legacySelectedBrand)
      .then(({ data }: any) => {
        const sh = data || [];
        setLegacyShops(sh);
        if (sh.length > 0) setLegacySelectedShop(sh[0].id);
      });
  }, [legacySelectedBrand]);

  // Helper to trigger browser download
  function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ----------------------------------------------------------------------------
  // EXPORT / BACKUP HANDLERS
  // ----------------------------------------------------------------------------
  const handleStartBackup = async (scope: 'all' | 'brand', brandId?: string) => {
    setIsExporting(true);
    setExportProgressPct(5);
    setExportProgressProgress('Initializing export engine...');
    exportAbortController.current = new AbortController();

    try {
      const supabase = createClient();
      const monthRange = useMonthRange && monthStart && monthEnd
        ? { start: monthStart, end: monthEnd }
        : undefined;

      const result = await exportBackup(supabase, {
        scope,
        brandId,
        monthRange,
        includeLogos,
        onProgress: (step, pct) => {
          setExportProgressProgress(step);
          setExportProgressPct(pct);
        },
        abortSignal: exportAbortController.current.signal,
      });

      triggerDownload(result.blob, result.filename);
      toast.success(`Backup archive "${result.filename}" successfully generated and downloaded!`);

      // Refresh history list
      const { data: latestLogs } = await supabase
        .from('backup_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (latestLogs) setHistory(latestLogs);
    } catch (err: any) {
      if (err.message?.includes('aborted') || err.message?.includes('cancelled')) {
        toast.info('Backup operation was cancelled.');
      } else {
        toast.error(`Backup failed: ${err.message}`);
      }
    } finally {
      setIsExporting(false);
      exportAbortController.current = null;
    }
  };

  const handleCancelExport = () => {
    if (exportAbortController.current) {
      exportAbortController.current.abort();
    }
  };

  // ----------------------------------------------------------------------------
  // RESTORE & VALIDATE HANDLERS
  // ----------------------------------------------------------------------------
  const handleFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    setUploadedFiles(fileArray);
    setValidationReport(null);
    setImportResult(null);
    setRecreatedCredentials([]);

    setIsValidating(true);
    const toastId = toast.loading('Reading uploaded archives and performing dry-run validation...');

    try {
      const supabase = createClient();
      const report = await validateBackupFiles(fileArray, supabase);
      setValidationReport(report);

      if (report.isLegacy) {
        toast.info('Legacy accounting statement detected. Opened Legacy Statement Importer.', { id: toastId });
        // Setup legacy parser for the first file
        const firstFile = fileArray[0];
        const arrayBuf = await firstFile.arrayBuffer();
        const parser = await parseLegacyWorkbook(arrayBuf);
        legacyWorkbookParser.current = parser;
        setLegacySheetNames(parser.sheetNames);
        if (parser.sheetNames.length > 0) {
          setLegacySelectedSheet(parser.sheetNames[0]);
          loadLegacySheet(parser.sheetNames[0], parser);
        }
      } else if (report.isValid) {
        toast.success(`Validation succeeded! ${report.totalAdd} new, ${report.totalUpdate} updates, 0 errors.`, {
          id: toastId,
        });
      } else {
        toast.error(`Validation found ${report.totalErrors} issue(s). Review error report below.`, { id: toastId });
      }
    } catch (err: any) {
      toast.error(`Validation failed: ${err.message}`, { id: toastId });
    } finally {
      setIsValidating(false);
    }
  };

  // Parse legacy sheet
  const loadLegacySheet = async (sheetName: string, parserObj?: any) => {
    const parser = parserObj || legacyWorkbookParser.current;
    if (!parser) return;
    setIsParsingLegacy(true);
    try {
      const parsed = parser.parseSheet(sheetName);
      setLegacyOpening(parsed.openingBalance);

      const supabase = createClient();
      if (legacySelectedShop) {
        const { uniqueRows, duplicateRows } = await detectLegacyDuplicates(
          parsed.rows,
          legacySelectedShop,
          supabase
        );
        const { matchedRows, unmatchedDescriptions } = await matchLegacyItems(
          uniqueRows,
          legacySelectedBrand,
          supabase
        );
        setLegacyRows(matchedRows);
        setLegacyDuplicates(duplicateRows);
        setLegacyUnmatchedItems(unmatchedDescriptions);
      } else {
        setLegacyRows(parsed.rows);
      }
    } catch (e: any) {
      toast.error(`Error parsing sheet ${sheetName}: ${e.message}`);
    } finally {
      setIsParsingLegacy(false);
    }
  };

  const handleDownloadErrorReport = () => {
    if (!validationReport?.errors) return;
    const csv = generateErrorReportCsv(validationReport.errors);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(blob, `Validation-Errors-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  // ----------------------------------------------------------------------------
  // IMPORT EXECUTION
  // ----------------------------------------------------------------------------
  const handleExecuteImport = async () => {
    if (!validationReport?.payload) {
      toast.error('No validated data payload to import.');
      return;
    }

    setIsImporting(true);
    setImportProgressPct(5);
    setImportProgressText('Starting database transaction and safety checks...');
    importAbortController.current = new AbortController();

    try {
      const supabase = createClient();
      const res = await executeImport(
        validationReport.payload,
        {
          mode: importMode,
          preBackup: preBackupToggle,
          onProgress: (step, pct) => {
            setImportProgressText(step);
            setImportProgressPct(pct);
          },
          abortSignal: importAbortController.current.signal,
        },
        supabase
      );

      setImportResult(res);

      if (res.preBackupBlob && res.preBackupFilename) {
        triggerDownload(res.preBackupBlob, res.preBackupFilename);
        toast.info(`Safety pre-backup downloaded: ${res.preBackupFilename}`);
      }

      if (res.success) {
        toast.success(`Import complete! ${res.totalAdded} added, ${res.totalUpdated} updated.`);
      } else {
        toast.warning(`Import completed with ${res.errors.length} table errors.`);
      }
    } catch (err: any) {
      if (err.message?.includes('aborted')) {
        toast.info('Import operation was cancelled.');
      } else {
        toast.error(`Import failed: ${err.message}`);
      }
    } finally {
      setIsImporting(false);
      importAbortController.current = null;
    }
  };

  const handleCancelImport = () => {
    if (importAbortController.current) {
      importAbortController.current.abort();
    }
  };

  // ----------------------------------------------------------------------------
  // USER CREDENTIALS RECREATION
  // ----------------------------------------------------------------------------
  const handleRecreateUsers = async () => {
    const users = importResult?.usersToRecreate || validationReport?.usersToRecreate || [];
    if (users.length === 0) return;

    setIsRecreatingUsers(true);
    const toastId = toast.loading(`Generating login credentials for ${users.length} manager(s)...`);

    try {
      const res = await recreateAuthUsersAction(users);
      if (res.success && res.credentials) {
        setRecreatedCredentials(res.credentials);
        toast.success(`Successfully generated ${res.credentials.length} user logins!`, { id: toastId });
      } else {
        toast.error(res.error || 'Failed to generate user logins', { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message, { id: toastId });
    } finally {
      setIsRecreatingUsers(false);
    }
  };

  const handleDownloadCredentialsExcel = async () => {
    if (recreatedCredentials.length === 0) return;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Manager Credentials');
    ws.addRow(['Role', 'Full Name', 'Username', 'Synthetic Email', 'Temporary Password', 'Login URL']);
    recreatedCredentials.forEach((c) => {
      ws.addRow([
        c.role.toUpperCase(),
        c.full_name,
        c.username || '',
        c.email,
        c.tempPassword,
        window.location.origin + '/login',
      ]);
    });
    ws.columns.forEach((col) => (col.width = 24));
    const buf = await wb.xlsx.writeBuffer();
    triggerDownload(
      new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `CafeSync-Credentials-${new Date().toISOString().slice(0, 10)}.xlsx`
    );
  };

  const handleCopyPassword = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
    toast.success('Password copied to clipboard');
  };

  // ----------------------------------------------------------------------------
  // REMOVAL HANDLERS
  // ----------------------------------------------------------------------------
  const handleCalculateRemovalPreview = async () => {
    setIsPreviewing(true);
    setRemovalPreview(null);
    setSafetyBackupDownloaded(false);
    setSafetyBackupFilename(null);
    setTypedConfirmation('');
    setRemovalResult(null);

    const toastId = toast.loading('Calculating removal scope and querying row counts...');
    try {
      const supabase = createClient();
      let sDate = removeMonthStart ? `${removeMonthStart}-01` : undefined;
      let eDate = removeMonthEnd ? `${removeMonthEnd}-31` : undefined;
      if (sDate && !eDate) eDate = `${removeMonthStart}-31`;

      const preview = await previewRemoval(supabase, removeScope, {
        batchId: selectedBatchId,
        brandId: selectedRemoveBrandId,
        shopId: selectedRemoveShopId === 'all' ? null : selectedRemoveShopId,
        startDate: sDate,
        endDate: eDate,
      });

      setRemovalPreview(preview);
      toast.success(`Preview ready: ${preview.totalCount} total row(s) identified for deletion.`, { id: toastId });
    } catch (err: any) {
      toast.error(err.message || 'Failed to calculate removal preview', { id: toastId });
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleDownloadPreRemovalBackup = async () => {
    if (!removalPreview) return;
    setIsGeneratingSafetyBackup(true);
    const toastId = toast.loading('Generating safety pre-removal backup archive...');

    try {
      const supabase = createClient();
      let sDate = removeMonthStart ? `${removeMonthStart}-01` : undefined;
      let eDate = removeMonthEnd ? `${removeMonthEnd}-31` : undefined;
      if (sDate && !eDate) eDate = `${removeMonthStart}-31`;

      const backupResult = await exportBackup(supabase, {
        scope: removeScope === 'remove_brand' ? 'brand' : 'all',
        brandId: removalPreview.brandId || selectedRemoveBrandId || undefined,
        monthRange:
          removeMonthStart
            ? {
                start: removeMonthStart,
                end: removeMonthEnd || removeMonthStart,
              }
            : undefined,
        includeLogos: true,
        onProgress: (status: string, pct: number) => {
          setRemovalProgressText(status);
          setRemovalProgressPct(pct);
        },
      });

      triggerDownload(backupResult.blob, backupResult.filename);
      setSafetyBackupDownloaded(true);
      setSafetyBackupFilename(backupResult.filename);
      toast.success('Pre-removal safety backup downloaded! You may now proceed with deletion.', { id: toastId });
    } catch (err: any) {
      toast.error(`Safety backup failed: ${err.message}`, { id: toastId });
    } finally {
      setIsGeneratingSafetyBackup(false);
    }
  };

  const expectedConfirmationText = (): string => {
    if (removeScope === 'undo_upload') return 'REMOVE';
    if (removalPreview?.brandName) return removalPreview.brandName;
    const b = brands.find((br) => br.id === selectedRemoveBrandId);
    return b ? b.name : 'REMOVE';
  };

  const canExecuteRemoval = (): boolean => {
    if (!removalPreview) return false;
    if (!safetyBackupDownloaded) return false;
    const expected = expectedConfirmationText().trim().toLowerCase();
    const actual = typedConfirmation.trim().toLowerCase();
    return expected.length > 0 && expected === actual;
  };

  const handleExecuteRemoval = async () => {
    if (!canExecuteRemoval()) {
      toast.error('Please download the safety backup and type the exact confirmation text.');
      return;
    }

    setIsRemoving(true);
    setRemovalProgressText('Initializing atomic deletion...');
    setRemovalProgressPct(10);
    const toastId = toast.loading('Executing deletion within atomic database transaction...');

    try {
      const supabase = createClient();
      let sDate = removeMonthStart ? `${removeMonthStart}-01` : undefined;
      let eDate = removeMonthEnd ? `${removeMonthEnd}-31` : undefined;
      if (sDate && !eDate) eDate = `${removeMonthStart}-31`;

      const targetBrand = brands.find((b) => b.id === selectedRemoveBrandId);

      const result = await executeRemoval(
        supabase,
        removeScope,
        {
          batchId: selectedBatchId,
          brandId: selectedRemoveBrandId,
          brandSlug: targetBrand?.slug,
          shopId: selectedRemoveShopId === 'all' ? null : selectedRemoveShopId,
          startDate: sDate,
          endDate: eDate,
        },
        (status, pct) => {
          setRemovalProgressText(status);
          setRemovalProgressPct(pct);
        }
      );

      setRemovalResult(result);
      toast.success(`Deletion completed successfully. ${result.totalDeleted} row(s) removed.`, { id: toastId });

      // Refresh local batches or removal history
      if (removeScope === 'undo_upload') {
        setBatches((prev) =>
          prev.map((b) => (b.id === selectedBatchId ? { ...b, status: 'undone' } : b))
        );
      }
      setRemovals((prev) => [
        {
          id: crypto.randomUUID(),
          scope: removeScope,
          brand_name: targetBrand?.name || 'All Brands',
          target_name: result.targetName,
          counts: result.deletedCounts,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
      setRemovalPreview(null);
      setSafetyBackupDownloaded(false);
      setTypedConfirmation('');
    } catch (err: any) {
      toast.error(`Removal failed: ${err.message}`, { id: toastId });
    } finally {
      setIsRemoving(false);
      setRemovalProgressText('');
      setRemovalProgressPct(0);
    }
  };

  const handleDownloadRemovalReport = () => {
    if (!removalResult?.reportText) return;
    const blob = new Blob([removalResult.reportText], { type: 'text/plain;charset=utf-8' });
    triggerDownload(blob, `CafeSync-Removal-Report-${new Date().toISOString().slice(0, 10)}.txt`);
  };

  return (
    <div className="space-y-6">
      {/* 1. HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Archive className="h-6 w-6 text-slate-800" />
            <span>Multi-Tenant Backup & Disaster Recovery</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Full brand data archives, zero row-cap export, idempotent database restoration, and legacy statement ingestion.
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 self-start sm:self-auto">
          <Button
            size="sm"
            variant={activeTab === 'backup' ? 'default' : 'ghost'}
            className={activeTab === 'backup' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600'}
            onClick={() => setActiveTab('backup')}
          >
            <Download className="h-3.5 w-3.5 mr-1.5" />
            <span>Platform Backup</span>
          </Button>
          <Button
            size="sm"
            variant={activeTab === 'restore' ? 'default' : 'ghost'}
            className={activeTab === 'restore' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600'}
            onClick={() => setActiveTab('restore')}
          >
            <UploadCloud className="h-3.5 w-3.5 mr-1.5" />
            <span>Restore / Upload</span>
          </Button>
          <Button
            size="sm"
            variant={activeTab === 'remove' ? 'default' : 'ghost'}
            className={
              activeTab === 'remove'
                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-rose-600'
            }
            onClick={() => setActiveTab('remove')}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            <span>Remove Data</span>
          </Button>
        </div>
      </div>

      {/* ======================================================================= */}
      {/* TAB 1: BACKUP */}
      {/* ======================================================================= */}
      {activeTab === 'backup' && (
        <div className="space-y-6">
          {/* Options & Master Action Banner */}
          <Card className="p-5 border-slate-200 bg-white shadow-xs">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-slate-700">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={includeLogos}
                      onChange={(e) => setIncludeLogos(e.target.checked)}
                      className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                    <span className="font-medium">Include brand logos & favicon storage assets</span>
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={useMonthRange}
                      onChange={(e) => setUseMonthRange(e.target.checked)}
                      className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                    <span className="font-medium">Filter by specific month range</span>
                  </label>
                </div>

                {useMonthRange && (
                  <div className="flex items-center gap-3 pt-1">
                    <div>
                      <span className="text-xs text-slate-500 block mb-1">Start Month</span>
                      <input
                        type="month"
                        value={monthStart}
                        onChange={(e) => setMonthStart(e.target.value)}
                        className="px-2.5 py-1.5 text-xs rounded-md border border-slate-300 text-slate-800"
                      />
                    </div>
                    <div>
                      <span className="text-xs text-slate-500 block mb-1">End Month</span>
                      <input
                        type="month"
                        value={monthEnd}
                        onChange={(e) => setMonthEnd(e.target.value)}
                        className="px-2.5 py-1.5 text-xs rounded-md border border-slate-300 text-slate-800"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  disabled={isExporting}
                  onClick={() => handleStartBackup('all')}
                  className="bg-slate-900 hover:bg-slate-800 text-white shadow-xs font-semibold px-4"
                >
                  <Download className="h-4 w-4 mr-2" />
                  <span>Backup ALL Brands ({brands.length})</span>
                </Button>
              </div>
            </div>

            {/* Active Export Progress Indicator */}
            {isExporting && (
              <div className="mt-5 pt-4 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-slate-700 flex items-center gap-1.5">
                    <RefreshCw className="h-3.5 w-3.5 animate-spin text-slate-900" />
                    <span>{exportProgressText}</span>
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-slate-900">{exportProgressPct}%</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCancelExport}
                      className="h-6 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2"
                    >
                      <X className="h-3 w-3 mr-1" />
                      <span>Cancel</span>
                    </Button>
                  </div>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-slate-900 h-2 transition-all duration-300 ease-out"
                    style={{ width: `${exportProgressPct}%` }}
                  />
                </div>
              </div>
            )}
          </Card>

          {/* Brands List Table */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <span className="font-semibold text-sm text-slate-800">Tenant Brand Portfolios</span>
              <span className="text-xs text-slate-500">Each brand backup produces an independent restorable archive</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-medium">
                    <th className="py-3 px-4">Brand</th>
                    <th className="py-3 px-4">Identifier Slug</th>
                    <th className="py-3 px-4">Outlets</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Individual Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {brands.map((brand) => (
                    <tr key={brand.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4 font-semibold text-slate-900 flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-slate-400" />
                        <span>{brand.name}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-600">
                        {brand.slug}
                      </td>
                      <td className="py-3 px-4 text-slate-600">
                        {brand.shops_count ?? 1} outlets
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          variant="outline"
                          className={
                            brand.status === 'suspended'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          }
                        >
                          {brand.status || 'active'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isExporting}
                          onClick={() => handleStartBackup('brand', brand.id)}
                          className="h-8 text-xs border-slate-300 hover:bg-slate-100"
                        >
                          <Download className="h-3 w-3 mr-1.5" />
                          <span>Backup Brand</span>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Backup History */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <span className="font-semibold text-sm text-slate-800 flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-500" />
                <span>Backup History & Audit Log</span>
              </span>
              <span className="text-xs text-slate-500">Persisted in platform backup ledger</span>
            </div>

            {history.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs sm:text-sm">
                No backup records logged yet. Run your first platform or brand backup above.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs sm:text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 font-medium">
                      <th className="py-2.5 px-4">Timestamp</th>
                      <th className="py-2.5 px-4">Scope</th>
                      <th className="py-2.5 px-4">Target Brand</th>
                      <th className="py-2.5 px-4">Date Range</th>
                      <th className="py-2.5 px-4">File Size</th>
                      <th className="py-2.5 px-4">Export Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {history.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-2.5 px-4 text-slate-700 whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-2.5 px-4">
                          <Badge variant="outline" className="capitalize">
                            {log.scope === 'all' ? 'All Brands' : 'Single Brand'}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-4 text-slate-600 font-mono text-xs">
                          {log.brand_name || log.brand_id || 'Global'}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600 text-xs">
                          {log.date_range || 'All History'}
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">
                          {log.file_size ? `${(log.file_size / 1024 / 1024).toFixed(2)} MB` : '-'}
                        </td>
                        <td className="py-2.5 px-4">
                          <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 font-normal">
                            Completed
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================================= */}
      {/* TAB 2: RESTORE / UPLOAD */}
      {/* ======================================================================= */}
      {activeTab === 'restore' && (
        <div className="space-y-6">
          {/* Drag & Drop Upload Zone */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              handleFilesSelected(e.dataTransfer.files);
            }}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 hover:border-slate-400 bg-white hover:bg-slate-50/50 rounded-xl p-8 text-center cursor-pointer transition-all shadow-xs"
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".zip,.xlsx,.xls"
              onChange={(e) => handleFilesSelected(e.target.files)}
              className="hidden"
            />
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-700">
                <UploadCloud className="h-6 w-6" />
              </div>
              <h3 className="font-semibold text-slate-900 text-sm sm:text-base">
                Drop your CafeSync Backup (.zip) or Excel files (.xlsx) here
              </h3>
              <p className="text-xs text-slate-500 max-w-md">
                Supports full platform archives (.zip), brand-data.xlsx master sheets, monthly financial workbooks, and legacy accounting sheets.
              </p>
              {uploadedFiles.length > 0 && (
                <div className="pt-2 flex flex-wrap gap-1.5 justify-center">
                  {uploadedFiles.map((f, i) => (
                    <Badge key={i} variant="secondary" className="text-xs font-mono">
                      {f.name} ({(f.size / 1024).toFixed(1)} KB)
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* VALIDATION PREVIEW CARD */}
          {validationReport && !validationReport.isLegacy && (
            <Card className="p-5 border-slate-200 bg-white shadow-xs space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                    {validationReport.isValid ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-rose-600" />
                    )}
                    <span>Step 1: Dry-Run Validation Preview</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Verified against database foreign keys, schema constraints, and format specifications. Nothing has been written yet.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {validationReport.errors.length > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleDownloadErrorReport}
                      className="text-xs text-rose-700 border-rose-300 hover:bg-rose-50"
                    >
                      <Download className="h-3.5 w-3.5 mr-1" />
                      <span>Download Error Report ({validationReport.errors.length})</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Stats Overview Pill Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <span className="text-xs text-emerald-700 font-medium block">Rows to ADD</span>
                  <span className="text-xl font-bold text-emerald-900">{validationReport.totalAdd}</span>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <span className="text-xs text-blue-700 font-medium block">Rows to UPDATE</span>
                  <span className="text-xl font-bold text-blue-900">{validationReport.totalUpdate}</span>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <span className="text-xs text-slate-600 font-medium block">Rows UNCHANGED</span>
                  <span className="text-xl font-bold text-slate-900">{validationReport.totalUnchanged}</span>
                </div>
                <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
                  <span className="text-xs text-rose-700 font-medium block">Validation ERRORS</span>
                  <span className="text-xl font-bold text-rose-900">{validationReport.totalErrors}</span>
                </div>
              </div>

              {/* Per Brand Breakdown */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Target Brands in Upload ({Object.keys(validationReport.brandsSummary).length})
                </h4>

                <div className="space-y-2">
                  {Object.values(validationReport.brandsSummary).map((b) => (
                    <div
                      key={b.brandSlug}
                      className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">{b.brandName}</span>
                          <span className="font-mono text-slate-500 text-[11px]">({b.brandSlug})</span>
                          {b.isNewBrand && (
                            <Badge className="bg-amber-100 text-amber-800 border-amber-300">
                              New Brand (Will be created)
                            </Badge>
                          )}
                        </div>
                        <div className="text-slate-600">
                          {b.monthlyFiles.length > 0 ? (
                            <span>Monthly Financials: {b.monthlyFiles.join(', ')}</span>
                          ) : (
                            <span>Master configuration only</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-slate-700">
                        <div>
                          <span className="font-semibold text-slate-900">{b.totalRows}</span> total rows
                        </div>
                        {b.errorsCount > 0 ? (
                          <span className="font-semibold text-rose-600">{b.errorsCount} errors</span>
                        ) : (
                          <span className="text-emerald-600 font-medium flex items-center gap-1">
                            <Check className="h-3.5 w-3.5" /> Clean
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* STEP 2: RESTORE MODE SELECTION */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <h4 className="font-semibold text-sm text-slate-900">Step 2: Select Restore Mode</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <label
                    onClick={() => setImportMode('add_only')}
                    className={`p-3.5 rounded-lg border cursor-pointer flex items-start gap-3 transition-all ${
                      importMode === 'add_only'
                        ? 'border-slate-900 bg-slate-50/80 ring-1 ring-slate-900'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'add_only'}
                      onChange={() => setImportMode('add_only')}
                      className="mt-0.5 text-slate-900 focus:ring-slate-900"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block">Add Missing Only (Safe Default)</span>
                      <span className="text-slate-500 block mt-0.5">
                        Imports missing rows without altering or overwriting any existing records in the database.
                      </span>
                    </div>
                  </label>

                  <label
                    onClick={() => setImportMode('add_update')}
                    className={`p-3.5 rounded-lg border cursor-pointer flex items-start gap-3 transition-all ${
                      importMode === 'add_update'
                        ? 'border-slate-900 bg-slate-50/80 ring-1 ring-slate-900'
                        : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="importMode"
                      checked={importMode === 'add_update'}
                      onChange={() => setImportMode('add_update')}
                      className="mt-0.5 text-slate-900 focus:ring-slate-900"
                    />
                    <div>
                      <span className="font-bold text-slate-900 block">Add and Update Existing</span>
                      <span className="text-slate-500 block mt-0.5">
                        Matches records by UUID. Updates existing records with newer file data. Never deletes any records.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* STEP 3: SAFETY BACKUP TOGGLE & ACTION */}
              <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-700">
                  <input
                    type="checkbox"
                    checked={preBackupToggle}
                    onChange={(e) => setPreBackupToggle(e.target.checked)}
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <span className="font-medium">
                    Automatically create and download safety backup ZIP before writing changes
                  </span>
                </label>

                <div className="flex items-center gap-2">
                  <Button
                    disabled={isImporting || !validationReport.isValid}
                    onClick={handleExecuteImport}
                    className="bg-slate-900 hover:bg-slate-800 text-white shadow-xs font-semibold px-5"
                  >
                    <UploadCloud className="h-4 w-4 mr-2" />
                    <span>Proceed with Import</span>
                  </Button>
                </div>
              </div>

              {/* Progress bar during import */}
              {isImporting && (
                <div className="pt-3 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700 flex items-center gap-1.5">
                      <RefreshCw className="h-3.5 w-3.5 animate-spin text-slate-900" />
                      <span>{importProgressText}</span>
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-slate-900">{importProgressPct}%</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleCancelImport}
                        className="h-6 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2"
                      >
                        <X className="h-3 w-3 mr-1" />
                        <span>Cancel</span>
                      </Button>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div
                      className="bg-slate-900 h-2 transition-all duration-300 ease-out"
                      style={{ width: `${importProgressPct}%` }}
                    />
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* LEGACY IMPORTER WORKFLOW CARD */}
          {validationReport?.isLegacy && (
            <Card className="p-5 border-slate-200 bg-white shadow-xs space-y-5">
              <div className="pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <FileSpreadsheet className="h-5 w-5 text-indigo-600" />
                  <span>Legacy Statement Ingestion Wizard</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Classic monthly ledger sheet detected (DATE, DISCRIPTION, MOP, INCOME, EXPENSES, OPENING BAL).
                </p>
              </div>

              {/* Controls: Target Brand, Outlet, Sheet */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Target Brand</label>
                  <select
                    value={legacySelectedBrand}
                    onChange={(e) => setLegacySelectedBrand(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-slate-800"
                  >
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.slug})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Target Outlet / Shop</label>
                  <select
                    value={legacySelectedShop}
                    onChange={(e) => setLegacySelectedShop(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-slate-800"
                  >
                    {legacyShops.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-semibold text-slate-700 block mb-1">Select Sheet</label>
                  <select
                    value={legacySelectedSheet}
                    onChange={(e) => {
                      setLegacySelectedSheet(e.target.value);
                      loadLegacySheet(e.target.value);
                    }}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded-md text-slate-800"
                  >
                    {legacySheetNames.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Legacy Detection & Parsing Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <span className="text-slate-500 block">Opening Balance</span>
                  <span className="text-base font-bold text-slate-900">₹{legacyOpening.toLocaleString('en-IN')}</span>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <span className="text-emerald-700 block">Unique Rows</span>
                  <span className="text-base font-bold text-emerald-900">{legacyRows.length}</span>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <span className="text-amber-700 block">Duplicate Rows (Skipped)</span>
                  <span className="text-base font-bold text-amber-900">{legacyDuplicates.length}</span>
                </div>
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                  <span className="text-indigo-700 block">Catalog Unmatched</span>
                  <span className="text-base font-bold text-indigo-900">{legacyUnmatchedItems.length}</span>
                </div>
              </div>

              {/* Unmatched Item Names List */}
              {legacyUnmatchedItems.length > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs space-y-1">
                  <span className="font-semibold text-amber-900 block">
                    Unmatched item descriptions found ({legacyUnmatchedItems.length}):
                  </span>
                  <p className="text-amber-700">
                    {legacyUnmatchedItems.slice(0, 10).join(', ')}
                    {legacyUnmatchedItems.length > 10 && ' and more...'}
                  </p>
                  <p className="text-amber-600 text-[11px]">
                    These descriptions will still import with snapshot item names, or you can add them to Items Catalog before importing.
                  </p>
                </div>
              )}

              {/* Legacy Import Action */}
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  disabled={legacyRows.length === 0 || isImporting}
                  onClick={async () => {
                    if (!legacySelectedShop) {
                      toast.error('Please select a target outlet.');
                      return;
                    }
                    setIsImporting(true);
                    const toastId = toast.loading(`Importing ${legacyRows.length} legacy entries...`);
                    try {
                      const supabase = createClient();
                      const txns = legacyRows.map((r) => ({
                        brand_id: legacySelectedBrand,
                        shop_id: legacySelectedShop,
                        txn_date: r.date,
                        kind: r.income > 0 ? 'income' : 'expense',
                        txn_type: r.isSalaryAdvance ? 'salary_advance' : 'normal',
                        item_id: r.matchedItemId || null,
                        item_name_snapshot: r.description,
                        mode_name_snapshot: r.mop,
                        amount: r.income > 0 ? r.income : r.expense,
                        note: r.description,
                      }));

                      const { error: insErr } = await (supabase.from('transactions') as any).insert(txns);
                      if (insErr) throw insErr;

                      toast.success(`Successfully imported ${txns.length} legacy transactions!`, { id: toastId });
                      setLegacyRows([]);
                    } catch (e: any) {
                      toast.error(`Legacy import failed: ${e.message}`, { id: toastId });
                    } finally {
                      setIsImporting(false);
                    }
                  }}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs"
                >
                  <UploadCloud className="h-3.5 w-3.5 mr-1.5" />
                  <span>Import {legacyRows.length} Unique Entries</span>
                </Button>
              </div>
            </Card>
          )}

          {/* IMPORT RESULT CARD & USER RECREATION */}
          {importResult && (
            <Card className="p-5 border-slate-200 bg-white shadow-xs space-y-5">
              <div className="flex items-center gap-2 pb-3 border-b border-slate-100 text-emerald-800">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-base">Step 5: Import & Reconciliation Complete</h3>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center text-xs">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                  <span className="text-emerald-700 block">Total Added</span>
                  <span className="text-xl font-bold text-emerald-900">{importResult.totalAdded}</span>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <span className="text-blue-700 block">Total Updated</span>
                  <span className="text-xl font-bold text-blue-900">{importResult.totalUpdated}</span>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <span className="text-slate-600 block">Recomputed Outlets</span>
                  <span className="text-xl font-bold text-slate-900">{importResult.recalculatedShops.length}</span>
                </div>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <span className="text-slate-600 block">Recomputed Months</span>
                  <span className="text-xl font-bold text-slate-900">{importResult.recalculatedMonths.length}</span>
                </div>
              </div>

              {/* Users to recreate Section */}
              {(importResult.usersToRecreate.length > 0 || recreatedCredentials.length > 0) && (
                <div className="pt-4 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                        <Key className="h-4 w-4 text-amber-600" />
                        <span>Manager Login Accounts ({importResult.usersToRecreate.length})</span>
                      </h4>
                      <p className="text-xs text-slate-500">
                        Backups never export passwords. Generate new secure temporary credentials for these imported users.
                      </p>
                    </div>

                    {recreatedCredentials.length === 0 ? (
                      <Button
                        size="sm"
                        disabled={isRecreatingUsers}
                        onClick={handleRecreateUsers}
                        className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold"
                      >
                        <ShieldCheck className="h-3.5 w-3.5 mr-1.5" />
                        <span>Generate Logins</span>
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleDownloadCredentialsExcel}
                        className="text-xs border-slate-300 hover:bg-slate-50"
                      >
                        <Download className="h-3.5 w-3.5 mr-1.5" />
                        <span>Download Credentials Sheet (.xlsx)</span>
                      </Button>
                    )}
                  </div>

                  {/* Recreated Credentials List */}
                  {recreatedCredentials.length > 0 && (
                    <div className="rounded-lg border border-slate-200 overflow-hidden bg-slate-50/50">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-100 text-slate-600 font-medium">
                            <th className="py-2 px-3">Role</th>
                            <th className="py-2 px-3">Full Name</th>
                            <th className="py-2 px-3">Username / Email</th>
                            <th className="py-2 px-3">Temporary Password</th>
                            <th className="py-2 px-3 text-right">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {recreatedCredentials.map((c) => (
                            <tr key={c.id} className="hover:bg-white">
                              <td className="py-2 px-3 font-semibold uppercase text-slate-700">{c.role}</td>
                              <td className="py-2 px-3 text-slate-900">{c.full_name}</td>
                              <td className="py-2 px-3 font-mono text-slate-600">{c.email || c.username}</td>
                              <td className="py-2 px-3 font-mono font-bold text-slate-900 bg-amber-50/50">
                                {c.tempPassword}
                              </td>
                              <td className="py-2 px-3 text-right">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleCopyPassword(c.id, c.tempPassword)}
                                  className="h-7 text-xs px-2"
                                >
                                  {copiedId === c.id ? (
                                    <Check className="h-3 w-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="h-3 w-3 text-slate-500" />
                                  )}
                                </Button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </Card>
          )}
        </div>
      )}

      {/* ======================================================================= */}
      {/* TAB 3: REMOVE DATA */}
      {/* ======================================================================= */}
      {activeTab === 'remove' && (
        <div className="space-y-6">
          {/* Safety Notice Banner */}
          <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4 sm:p-5 text-rose-950">
            <div className="flex items-start gap-3">
              <AlertOctagon className="h-5 w-5 text-rose-600 mt-0.5 shrink-0" />
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-rose-900">
                  Permanent Data Deletion & Rollback Console
                </h3>
                <p className="text-xs text-rose-700 leading-relaxed">
                  Every removal runs inside an atomic single-transaction SQL procedure on Supabase.
                  For catastrophic recovery protection, you must preview row counts, download a
                  safety backup archive, and type an explicit confirmation phrase before deletion is permitted.
                </p>
              </div>
            </div>
          </div>

          {/* Scope Selector Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: 'undo_upload', label: 'Undo an Upload', icon: RefreshCw },
              { id: 'remove_month', label: 'Remove a Month', icon: Calendar },
              { id: 'remove_shop', label: "Remove Outlet's Data", icon: Store },
              { id: 'remove_brand', label: 'Remove a Whole Brand', icon: Building2 },
            ].map((s) => {
              const Icon = s.icon;
              const isSelected = removeScope === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setRemoveScope(s.id as RemovalScope);
                    setRemovalPreview(null);
                    setSafetyBackupDownloaded(false);
                    setTypedConfirmation('');
                    setRemovalResult(null);
                  }}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all border ${
                    isSelected
                      ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{s.label}</span>
                </button>
              );
            })}
          </div>

          {/* Target Selection Card */}
          <Card className="p-5 border-slate-200 bg-white shadow-xs space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Configure Target Scope
            </h4>

            {/* A: Undo an Upload */}
            {removeScope === 'undo_upload' && (
              <div className="space-y-3">
                <label className="text-xs font-semibold text-slate-700 block">
                  Select Import Batch to Revert
                </label>
                {batches.length === 0 ? (
                  <p className="text-xs text-slate-500 italic py-2">
                    No recorded import batches found in the database.
                  </p>
                ) : (
                  <select
                    value={selectedBatchId}
                    onChange={(e) => setSelectedBatchId(e.target.value)}
                    className="w-full text-xs font-mono rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="">-- Choose an import batch --</option>
                    {batches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {new Date(b.created_at).toLocaleString()} | {b.file_names.join(', ')} | +{b.rows_added} added, {b.rows_updated} updated ({b.status})
                      </option>
                    ))}
                  </select>
                )}

                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 space-y-1">
                  <div className="flex items-center gap-1.5 font-semibold text-amber-900">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>Important Note on Undo Scope</span>
                  </div>
                  <p className="text-amber-700">
                    Undoing an import removes <strong>only rows that were newly created</strong> by this batch.
                    Rows that were updated cannot be automatically rolled back without overwriting later changes.
                    Refer to your pre-import backup ZIP if you need to restore earlier field values.
                  </p>
                </div>
              </div>
            )}

            {/* B: Remove a Month */}
            {removeScope === 'remove_month' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Brand</label>
                  <select
                    value={selectedRemoveBrandId}
                    onChange={(e) => setSelectedRemoveBrandId(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                  >
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Outlet Scope</label>
                  <select
                    value={selectedRemoveShopId}
                    onChange={(e) => setSelectedRemoveShopId(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="all">All Outlets in Brand</option>
                    {removeShops.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Start Month</label>
                  <input
                    type="month"
                    value={removeMonthStart}
                    onChange={(e) => setRemoveMonthStart(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">End Month (Optional)</label>
                  <input
                    type="month"
                    value={removeMonthEnd}
                    onChange={(e) => setRemoveMonthEnd(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>
            )}

            {/* C: Remove Shop Data */}
            {removeScope === 'remove_shop' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Brand</label>
                    <select
                      value={selectedRemoveBrandId}
                      onChange={(e) => setSelectedRemoveBrandId(e.target.value)}
                      className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                    >
                      {brands.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">Select Outlet</label>
                    <select
                      value={selectedRemoveShopId}
                      onChange={(e) => setSelectedRemoveShopId(e.target.value)}
                      className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                    >
                      <option value="">-- Choose an outlet --</option>
                      {removeShops.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <p className="text-xs text-rose-600 font-medium">
                  This permanently removes the shop, its manager logins, catalog assignments, transactions, salary records, assets, and month openings.
                </p>
              </div>
            )}

            {/* D: Remove Whole Brand */}
            {removeScope === 'remove_brand' && (
              <div className="space-y-3">
                <div className="max-w-md space-y-1.5">
                  <label className="text-xs font-semibold text-slate-700">Select Brand to Delete</label>
                  <select
                    value={selectedRemoveBrandId}
                    onChange={(e) => setSelectedRemoveBrandId(e.target.value)}
                    className="w-full text-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-rose-500"
                  >
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} ({b.slug})
                      </option>
                    ))}
                  </select>
                </div>

                <p className="text-xs text-rose-600 font-medium">
                  CAUTION: Deleting a brand removes all its shops, theme settings, storage assets, user logins, and entire financial history. This cannot be undone without a backup file.
                </p>
              </div>
            )}

            {/* Preview Button */}
            <div className="pt-2 flex justify-end">
              <Button
                size="sm"
                onClick={handleCalculateRemovalPreview}
                disabled={
                  isPreviewing ||
                  (removeScope === 'undo_upload' && !selectedBatchId) ||
                  (removeScope === 'remove_month' && !removeMonthStart) ||
                  (removeScope === 'remove_shop' && (!selectedRemoveShopId || selectedRemoveShopId === 'all'))
                }
                className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
              >
                {isPreviewing ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    <span>Analyzing Impact...</span>
                  </>
                ) : (
                  <>
                    <ShieldAlert className="h-3.5 w-3.5 mr-1.5" />
                    <span>Calculate Removal Impact & Preview</span>
                  </>
                )}
              </Button>
            </div>
          </Card>

          {/* Removal Confirmation & Safety Gate Card */}
          {removalPreview && (
            <Card className="p-5 border-rose-300 bg-rose-50/20 shadow-xs space-y-5 animate-in fade-in-50">
              <div className="flex items-center justify-between border-b border-rose-100 pb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-rose-600" />
                  <h4 className="text-sm font-bold text-rose-950">
                    Step 1: Verify Impact on {removalPreview.targetName}
                  </h4>
                </div>
                <Badge variant="outline" className="border-rose-300 text-rose-700 bg-rose-50 font-bold">
                  {removalPreview.totalCount} Total Rows Targeted
                </Badge>
              </div>

              {/* Table Counts Breakdown Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 text-xs">
                {Object.entries(removalPreview.counts).map(([tbl, cnt]) => {
                  if (tbl === 'total') return null;
                  return (
                    <div
                      key={tbl}
                      className="p-2.5 rounded-lg border border-rose-200 bg-white flex flex-col justify-between"
                    >
                      <span className="font-mono text-[10px] text-slate-500 uppercase truncate" title={tbl}>
                        {tbl.replace(/_/g, ' ')}
                      </span>
                      <span className="text-base font-bold text-slate-900 mt-1">{cnt}</span>
                    </div>
                  );
                })}
              </div>

              {/* Step 2: Safety Pre-Removal Backup */}
              <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h5 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      <Archive className="h-4 w-4 text-slate-700" />
                      <span>Step 2: Generate & Download Safety Backup (Mandatory)</span>
                    </h5>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Before records are permanently wiped from the database, you must download a full backup archive.
                      The deletion button remains locked until this archive is downloaded.
                    </p>
                  </div>
                  {safetyBackupDownloaded && (
                    <Badge className="bg-emerald-600 text-white shrink-0 text-xs flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>Backup Downloaded</span>
                    </Badge>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <div className="text-xs font-mono text-slate-600 truncate">
                    {safetyBackupFilename ? safetyBackupFilename : 'Pre-removal archive will include all affected tables & storage'}
                  </div>
                  <Button
                    size="sm"
                    variant={safetyBackupDownloaded ? 'outline' : 'default'}
                    onClick={handleDownloadPreRemovalBackup}
                    disabled={isGeneratingSafetyBackup}
                    className={
                      safetyBackupDownloaded
                        ? 'border-emerald-300 text-emerald-800 hover:bg-emerald-50 text-xs'
                        : 'bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold'
                    }
                  >
                    {isGeneratingSafetyBackup ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        <span>Creating Backup...</span>
                      </>
                    ) : (
                      <>
                        <Download className="h-3.5 w-3.5 mr-1.5" />
                        <span>{safetyBackupDownloaded ? 'Re-download Backup (.zip)' : 'Download Safety Backup (.zip)'}</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Step 3 & 4: Typed Confirmation and Delete Button */}
              <div className="p-4 rounded-xl border border-rose-200 bg-rose-50/50 space-y-3">
                <h5 className="text-xs font-bold text-rose-950 flex items-center gap-2">
                  <Key className="h-4 w-4 text-rose-700" />
                  <span>Step 3: Typed Confirmation</span>
                </h5>
                <p className="text-xs text-rose-800">
                  Please type <strong className="font-mono text-rose-950 bg-rose-100 px-1 py-0.5 rounded border border-rose-300">{expectedConfirmationText()}</strong> below to confirm deletion.
                </p>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <input
                    type="text"
                    value={typedConfirmation}
                    onChange={(e) => setTypedConfirmation(e.target.value)}
                    placeholder={`Type ${expectedConfirmationText()} to enable button`}
                    disabled={!safetyBackupDownloaded}
                    className="flex-1 text-xs font-mono rounded-lg border border-rose-300 bg-white px-3 py-2 text-rose-950 placeholder:text-rose-300 focus:outline-hidden focus:ring-2 focus:ring-rose-500 disabled:opacity-50"
                  />

                  <Button
                    size="sm"
                    onClick={handleExecuteRemoval}
                    disabled={!canExecuteRemoval() || isRemoving}
                    className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {isRemoving ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                        <span>Deleting Records...</span>
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                        <span>Permanently Delete Data</span>
                      </>
                    )}
                  </Button>
                </div>

                {isRemoving && (
                  <div className="space-y-1.5 pt-2">
                    <div className="flex justify-between text-xs text-rose-900 font-medium">
                      <span>{removalProgressText}</span>
                      <span>{removalProgressPct}%</span>
                    </div>
                    <div className="w-full bg-rose-200 rounded-full h-1.5 overflow-hidden">
                      <div
                        className="bg-rose-600 h-1.5 rounded-full transition-all duration-300"
                        style={{ width: `${removalProgressPct}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </Card>
          )}

          {/* Results Card */}
          {removalResult && (
            <Card className="p-5 border-emerald-300 bg-emerald-50/20 shadow-xs space-y-4 animate-in fade-in-50">
              <div className="flex items-center justify-between border-b border-emerald-100 pb-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <h4 className="text-sm font-bold text-emerald-950">
                    Removal Succeeded: {removalResult.targetName}
                  </h4>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleDownloadRemovalReport}
                  className="border-emerald-300 text-emerald-800 hover:bg-emerald-50 text-xs"
                >
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  <span>Download Removal Report (.txt)</span>
                </Button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div className="p-3 bg-white border border-emerald-200 rounded-lg">
                  <span className="text-slate-500 font-medium">Database Rows Deleted</span>
                  <div className="text-lg font-bold text-slate-900 mt-1">{removalResult.totalDeleted}</div>
                </div>
                <div className="p-3 bg-white border border-emerald-200 rounded-lg">
                  <span className="text-slate-500 font-medium">Auth Users Removed</span>
                  <div className="text-lg font-bold text-slate-900 mt-1">{removalResult.authUsersDeleted}</div>
                </div>
                <div className="p-3 bg-white border border-emerald-200 rounded-lg">
                  <span className="text-slate-500 font-medium">Storage Cleanup</span>
                  <div className="text-lg font-bold text-slate-900 mt-1">{removalResult.storageCleaned ? 'Complete' : 'N/A'}</div>
                </div>
                <div className="p-3 bg-white border border-emerald-200 rounded-lg">
                  <span className="text-slate-500 font-medium">Balance Recalculation</span>
                  <div className="text-lg font-bold text-slate-900 mt-1">Synced</div>
                </div>
              </div>
            </Card>
          )}

          {/* Removal Audit History Table */}
          <Card className="p-5 border-slate-200 bg-white shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Removal Audit History ({removals.length})
              </h4>
            </div>

            {removals.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-4 text-center">
                No data removal operations recorded in this environment yet.
              </p>
            ) : (
              <div className="rounded-lg border border-slate-200 overflow-hidden">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-600 font-medium">
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3">Scope</th>
                      <th className="py-2.5 px-3">Brand</th>
                      <th className="py-2.5 px-3">Target Detail</th>
                      <th className="py-2.5 px-3 text-right">Rows Removed</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {removals.map((r) => {
                      const counts = r.counts || {};
                      const total = counts.total || Object.values(counts).reduce((a: any, b: any) => (typeof b === 'number' ? a + b : a), 0);
                      return (
                        <tr key={r.id} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-3 text-slate-500 font-mono">
                            {new Date(r.created_at).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-3">
                            <Badge variant="outline" className="border-rose-200 text-rose-700 bg-rose-50 text-[10px] uppercase font-semibold">
                              {r.scope.replace(/_/g, ' ')}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-900">
                            {r.brand_name || 'All Brands'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700 font-mono text-[11px]">
                            {r.target_name || '-'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                            {total}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
