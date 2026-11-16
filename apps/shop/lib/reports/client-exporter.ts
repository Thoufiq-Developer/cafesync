import type { ReportData } from '@/lib/reports/types';

export function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

export async function exportReportExcel(reportData: ReportData, filename: string) {
  const { generateExcelReport } = await import('@/lib/reports/excel');
  const buffer = await generateExcelReport(reportData);
  const blob = new Blob([new Uint8Array(buffer)], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerDownload(blob, filename);
}

export async function exportReportPdf(reportData: ReportData, filename: string) {
  const { generatePdfReport } = await import('@/lib/reports/pdf');
  const buffer = await generatePdfReport(reportData);
  const blob = new Blob([new Uint8Array(buffer)], { type: 'application/pdf' });
  triggerDownload(blob, filename);
}

export async function previewReportPdfBlobUrl(reportData: ReportData): Promise<string> {
  const { generatePdfReport } = await import('@/lib/reports/pdf');
  const buffer = await generatePdfReport(reportData);
  const blob = new Blob([new Uint8Array(buffer)], { type: 'application/pdf' });
  return URL.createObjectURL(blob);
}
