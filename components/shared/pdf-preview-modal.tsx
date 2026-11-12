'use client';

import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Printer,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { ensureContrastColor, pickReadableTextColor } from '@/lib/theme/colors';

export interface PdfPreviewBrandMeta {
  name: string;
  logoUrl?: string | null;
  primaryColor?: string;
  secondaryColor?: string;
  registrationNo?: string | null;
  gstin?: string | null;
  address?: string | null;
  pdfHeaderStyle?: 'left' | 'centered';
  pdfFooterText?: string | null;
  pdfShowAddress?: boolean;
  pdfShowGstin?: boolean;
  pdfShowRegistrationNo?: boolean;
  pdfSignatureLine?: boolean;
}

export interface PdfPreviewPageItem {
  id?: string;
  title?: string;
  content: React.ReactNode;
}

interface PdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  periodLabel?: string;
  generatedAtLabel?: string;
  brand: PdfPreviewBrandMeta;
  pages: PdfPreviewPageItem[];
  onDownloadPdf?: () => void | Promise<void>;
  downloadLabel?: string;
  isDownloading?: boolean;
}

/**
 * Real A4 Portrait PDF Preview Modal (aspect ratio 1 : 1.414).
 * Never inherits pill radius — always keeps crisp <= 6px paper corners and
 * renders the brand logo with object-contain without circular cropping.
 */
export function PdfPreviewModal({
  isOpen,
  onClose,
  title,
  subtitle,
  periodLabel,
  generatedAtLabel,
  brand,
  pages,
  onDownloadPdf,
  downloadLabel = 'Download PDF',
  isDownloading = false,
}: PdfPreviewModalProps) {
  const [zoom, setZoom] = useState(0.85);
  const [pageIndex, setPageIndex] = useState(0);

  useEffect(() => {
    if (isOpen) {
      setPageIndex(0);
    }
  }, [isOpen, pages.length]);

  const totalPages = Math.max(1, pages.length);
  const safePageIndex = Math.min(pageIndex, totalPages - 1);
  const currentPage = pages[safePageIndex] || { content: null };

  const primaryColor = brand.primaryColor || '#ea580c';
  const safeAccent = ensureContrastColor(primaryColor, '#ffffff', 4.5);
  const monogramFg = pickReadableTextColor(primaryColor, '#ffffff', '#0f172a');
  const isCentered = brand.pdfHeaderStyle === 'centered';
  const showReg = brand.pdfShowRegistrationNo !== false;
  const showGstin = brand.pdfShowGstin !== false;
  const showAddress = brand.pdfShowAddress !== false;

  const baseWidthPx = 620;
  const scaledWidth = Math.round(baseWidthPx * zoom);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl w-[96vw] h-[90vh] max-h-[90vh] p-0 gap-0 overflow-hidden rounded-lg sm:rounded-lg flex flex-col bg-slate-100">
        {/* Top Control Toolbar */}
        <DialogHeader className="px-4 py-3 bg-white border-b border-slate-200 flex-none pr-11">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="min-w-0 text-left">
              <DialogTitle className="text-sm sm:text-base font-bold text-slate-900 truncate">
                {title}
              </DialogTitle>
              {subtitle && (
                <p className="text-[11px] text-slate-500 truncate">{subtitle}</p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Zoom Controls */}
              <div className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 p-0.5">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.55, Number((z - 0.1).toFixed(2))))}
                  className="no-brand-radius h-7 w-7 inline-flex items-center justify-center rounded text-slate-600 hover:bg-white hover:text-slate-900 cursor-pointer"
                  title="Zoom out"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <span className="px-2 text-[11px] font-mono font-semibold text-slate-700 min-w-[46px] text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(1.4, Number((z + 0.1).toFixed(2))))}
                  className="no-brand-radius h-7 w-7 inline-flex items-center justify-center rounded text-slate-600 hover:bg-white hover:text-slate-900 cursor-pointer"
                  title="Zoom in"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Page Navigation */}
              <div className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5">
                <button
                  type="button"
                  disabled={safePageIndex <= 0}
                  onClick={() => setPageIndex((p) => Math.max(0, p - 1))}
                  className="no-brand-radius h-7 w-7 inline-flex items-center justify-center rounded text-slate-600 hover:bg-white disabled:opacity-40 cursor-pointer"
                  title="Previous page"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <div className="flex items-center gap-1 px-1">
                  {Array.from({ length: totalPages }).map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setPageIndex(idx)}
                      className={`no-brand-radius h-6 min-w-[24px] px-1.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                        idx === safePageIndex
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>
                <span className="text-[11px] text-slate-500 pr-1">/ {totalPages}</span>
                <button
                  type="button"
                  disabled={safePageIndex >= totalPages - 1}
                  onClick={() => setPageIndex((p) => Math.min(totalPages - 1, p + 1))}
                  className="no-brand-radius h-7 w-7 inline-flex items-center justify-center rounded text-slate-600 hover:bg-white disabled:opacity-40 cursor-pointer"
                  title="Next page"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Print & Download */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="h-8 text-xs hidden sm:inline-flex"
              >
                <Printer className="h-3.5 w-3.5 mr-1" />
                <span>Print</span>
              </Button>

              {onDownloadPdf && (
                <Button
                  type="button"
                  size="sm"
                  disabled={isDownloading}
                  onClick={onDownloadPdf}
                  className="h-8 text-xs text-white font-semibold"
                  style={{ backgroundColor: primaryColor }}
                >
                  {isDownloading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      <span>Preparing...</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                      <span>{downloadLabel}</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable A4 Portrait Paper Viewport */}
        <div className="flex-1 overflow-auto p-4 sm:p-8 flex justify-center items-start bg-slate-200/80">
          <div
            className="pdf-preview-sheet bg-white text-slate-900 border border-slate-300 shadow-[0_12px_34px_rgba(15,23,42,0.16)] flex flex-col justify-between shrink-0 transition-[width] duration-150"
            style={{
              width: `${scaledWidth}px`,
              minHeight: `${Math.round(scaledWidth * 1.4142)}px`,
              aspectRatio: '1 / 1.4142',
              borderRadius: '6px',
              padding: `${Math.round(28 * zoom)}px`,
              fontSize: `${Math.max(10, Math.round(12 * zoom))}px`,
            }}
          >
            <div className="space-y-4">
              {/* Branded A4 Document Header */}
              <div
                className={`pb-3 border-b-2 flex ${
                  isCentered
                    ? 'flex-col items-center text-center gap-2'
                    : 'flex-row items-center justify-between gap-4'
                }`}
                style={{ borderColor: primaryColor }}
              >
                <div
                  className={`flex items-center gap-3 ${
                    isCentered ? 'flex-col text-center' : ''
                  }`}
                >
                  {brand.logoUrl ? (
                    <img
                      src={brand.logoUrl}
                      alt={brand.name}
                      className="h-11 max-w-[120px] w-auto object-contain rounded-[4px] shrink-0"
                    />
                  ) : (
                    <div
                      className="h-11 w-11 rounded-[6px] flex items-center justify-center font-bold text-base shrink-0"
                      style={{ backgroundColor: primaryColor, color: monogramFg }}
                    >
                      {(brand.name || 'C').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="font-bold text-base leading-tight" style={{ color: safeAccent }}>
                      {brand.name}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 space-x-1.5">
                      {showReg && brand.registrationNo && (
                        <span>Reg: {brand.registrationNo}</span>
                      )}
                      {showGstin && brand.gstin && (
                        <span>{showReg && brand.registrationNo ? '| ' : ''}GSTIN: {brand.gstin}</span>
                      )}
                    </div>
                    {showAddress && brand.address && (
                      <div className="text-[10px] text-slate-400 mt-0.5">{brand.address}</div>
                    )}
                  </div>
                </div>

                <div className={isCentered ? 'text-center' : 'text-right'}>
                  <div className="text-[11px] font-bold uppercase tracking-wide text-slate-900">
                    {currentPage.title || title}
                  </div>
                  {periodLabel && (
                    <div className="text-[10px] text-slate-500 mt-0.5">{periodLabel}</div>
                  )}
                  {generatedAtLabel && (
                    <div className="text-[10px] text-slate-400">{generatedAtLabel}</div>
                  )}
                </div>
              </div>

              {/* Page Body */}
              <div className="space-y-4">{currentPage.content}</div>
            </div>

            {/* Footer (+ Optional Signatory on last page) */}
            <div className="pt-4 space-y-3">
              {brand.pdfSignatureLine && safePageIndex === totalPages - 1 && (
                <div className="pt-4 flex justify-end">
                  <div className="w-44 border-t border-slate-400 pt-1 text-center text-[10px] text-slate-500">
                    Authorized Signatory — {brand.name}
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-[10px] text-slate-400">
                <span>
                  {brand.pdfFooterText
                    ? `${brand.pdfFooterText} • Powered by CafeLedger`
                    : `${brand.name} • Powered by CafeLedger`}
                </span>
                <span>
                  Page {safePageIndex + 1} of {totalPages}
                </span>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
