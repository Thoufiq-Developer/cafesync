'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Circle,
  Crop,
  RectangleHorizontal,
  RotateCcw,
  Square,
  Upload,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

export type BrandAssetKind = 'logo' | 'logo_dark' | 'icon' | 'login_bg';
export type CropShape = 'circle' | 'square' | 'wide';

interface ImageCropModalProps {
  isOpen: boolean;
  brandId?: string;
  assetType: BrandAssetKind;
  file: File | null;
  onClose: () => void;
  onUploaded?: (url: string, assetType: BrandAssetKind) => void;
  mode?: 'upload' | 'dataUrl';
  onCroppedDataUrl?: (dataUrl: string, assetType: BrandAssetKind) => void;
}

interface CropFrameSpec {
  shape: CropShape;
  label: string;
  shortLabel: string;
  width: number;
  height: number;
  previewW: number;
  previewH: number;
}

const ASSET_TITLES: Record<BrandAssetKind, string> = {
  logo: 'Main Brand Logo',
  logo_dark: 'Dark Mode / Dark Sidebar Logo',
  icon: 'Brand App Icon (PWA & Favicon)',
  login_bg: 'Login Hero Background (16:9)',
};

const ASSET_FILENAMES: Record<BrandAssetKind, string> = {
  logo: 'logo.png',
  logo_dark: 'logo-dark.png',
  icon: 'icon.png',
  login_bg: 'login-bg.png',
};

const SHAPE_OPTIONS_BY_ASSET: Record<BrandAssetKind, CropFrameSpec[]> = {
  logo: [
    {
      shape: 'circle',
      label: 'Round (Circle)',
      shortLabel: 'Round',
      width: 512,
      height: 512,
      previewW: 260,
      previewH: 260,
    },
    {
      shape: 'square',
      label: 'Square (1:1)',
      shortLabel: 'Square',
      width: 512,
      height: 512,
      previewW: 260,
      previewH: 260,
    },
    {
      shape: 'wide',
      label: 'Wide (5:2)',
      shortLabel: 'Wide 5:2',
      width: 600,
      height: 240,
      previewW: 360,
      previewH: 144,
    },
  ],
  logo_dark: [
    {
      shape: 'circle',
      label: 'Round (Circle)',
      shortLabel: 'Round',
      width: 512,
      height: 512,
      previewW: 260,
      previewH: 260,
    },
    {
      shape: 'square',
      label: 'Square (1:1)',
      shortLabel: 'Square',
      width: 512,
      height: 512,
      previewW: 260,
      previewH: 260,
    },
    {
      shape: 'wide',
      label: 'Wide (5:2)',
      shortLabel: 'Wide 5:2',
      width: 600,
      height: 240,
      previewW: 360,
      previewH: 144,
    },
  ],
  icon: [
    {
      shape: 'circle',
      label: 'Round (Circle)',
      shortLabel: 'Round',
      width: 512,
      height: 512,
      previewW: 240,
      previewH: 240,
    },
    {
      shape: 'square',
      label: 'Square (1:1)',
      shortLabel: 'Square',
      width: 512,
      height: 512,
      previewW: 240,
      previewH: 240,
    },
  ],
  login_bg: [
    {
      shape: 'wide',
      label: 'Widescreen (16:9)',
      shortLabel: 'Wide 16:9',
      width: 1440,
      height: 810,
      previewW: 384,
      previewH: 216,
    },
  ],
};

function getShapeIcon(shape: CropShape) {
  if (shape === 'circle') return Circle;
  if (shape === 'square') return Square;
  return RectangleHorizontal;
}

export function ImageCropModal({
  isOpen,
  brandId,
  assetType,
  file,
  onClose,
  onUploaded,
  mode = 'upload',
  onCroppedDataUrl,
}: ImageCropModalProps) {
  const shapeOptions = SHAPE_OPTIONS_BY_ASSET[assetType];
  const [cropShape, setCropShape] = useState<CropShape>(
    shapeOptions[0]?.shape || 'wide'
  );

  const activeFrame =
    shapeOptions.find((opt) => opt.shape === cropShape) || shapeOptions[0];

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const userPickedShapeRef = useRef(false);

  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [fitMode, setFitMode] = useState<'contain' | 'cover'>('cover');
  const [isDragging, setIsDragging] = useState(false);
  const dragOriginRef = useRef<{
    clientX: number;
    clientY: number;
    startOffsetX: number;
    startOffsetY: number;
  } | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    userPickedShapeRef.current = false;
    setImgLoaded(false);
    setZoom(1);
    setOffsetX(0);
    setOffsetY(0);

    if (!file) {
      setObjectUrl(null);
      return;
    }

    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;

      // Auto-pick the most natural initial crop shape for the image's aspect ratio
      if (!userPickedShapeRef.current) {
        if (assetType === 'logo' || assetType === 'logo_dark') {
          const ratio = img.width / Math.max(1, img.height);
          if (ratio > 1.35) {
            setCropShape('wide');
            setFitMode('contain');
          } else {
            setCropShape('circle');
            setFitMode('cover');
          }
        } else if (assetType === 'icon') {
          setCropShape('square');
          setFitMode('cover');
        } else {
          setCropShape('wide');
          setFitMode('cover');
        }
      }

      setImgLoaded(true);
    };
    img.onerror = () => {
      setImgLoaded(false);
      toast.error('Could not decode selected image file.');
    };
    img.src = url;

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file, assetType]);

  const handleShapeChange = (nextShape: CropShape) => {
    userPickedShapeRef.current = true;
    setCropShape(nextShape);
    setZoom(1);
    setOffsetX(0);
    setOffsetY(0);
    setFitMode(nextShape === 'wide' && assetType !== 'login_bg' ? 'contain' : 'cover');
  };

  const drawCanvas = useCallback(
    (
      targetCanvas: HTMLCanvasElement,
      outW: number,
      outH: number,
      isPreview: boolean
    ) => {
      const ctx = targetCanvas.getContext('2d');
      const img = imgRef.current;
      if (!ctx || !img) return;

      ctx.clearRect(0, 0, outW, outH);
      if (assetType === 'login_bg') {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, outW, outH);
      }

      const baseScale =
        fitMode === 'contain'
          ? Math.min(outW / img.width, outH / img.height)
          : Math.max(outW / img.width, outH / img.height);

      const drawW = img.width * baseScale * zoom;
      const drawH = img.height * baseScale * zoom;
      const x = (outW - drawW) / 2 + (offsetX / activeFrame.previewW) * outW;
      const y = (outH - drawH) / 2 + (offsetY / activeFrame.previewH) * outH;

      ctx.save();
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      if (!isPreview && activeFrame.shape === 'circle') {
        // Clip exported PNG cleanly to a true circular cutout with transparent corners
        const r = Math.min(outW, outH) / 2;
        ctx.beginPath();
        ctx.arc(outW / 2, outH / 2, r, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
      }

      ctx.drawImage(img, x, y, drawW, drawH);
      ctx.restore();

      // In live preview, dim everything outside the circular cutout and show a crisp guide ring
      if (isPreview && activeFrame.shape === 'circle') {
        const r = Math.min(outW, outH) / 2 - 2;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, 0, outW, outH);
        ctx.arc(outW / 2, outH / 2, r, 0, Math.PI * 2, true);
        ctx.fillStyle = 'rgba(15, 23, 42, 0.55)';
        ctx.fill('evenodd');

        ctx.beginPath();
        ctx.arc(outW / 2, outH / 2, r, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(outW / 2, outH / 2, Math.max(1, r - 1), 0, Math.PI * 2);
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = 'rgba(15, 23, 42, 0.8)';
        ctx.lineWidth = 1.25;
        ctx.stroke();
        ctx.restore();
      }
    },
    [assetType, fitMode, zoom, offsetX, offsetY, activeFrame]
  );

  useEffect(() => {
    if (!isOpen || !imgLoaded) return;
    let rafId = 0;
    const paint = () => {
      if (!canvasRef.current) {
        rafId = window.requestAnimationFrame(paint);
        return;
      }
      drawCanvas(
        canvasRef.current,
        activeFrame.previewW,
        activeFrame.previewH,
        true
      );
    };
    paint();
    return () => {
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [isOpen, imgLoaded, activeFrame, drawCanvas]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture?.(e.pointerId);
    setIsDragging(true);
    dragOriginRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      startOffsetX: offsetX,
      startOffsetY: offsetY,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging || !dragOriginRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const scaleX = rect.width > 0 ? activeFrame.previewW / rect.width : 1;
    const scaleY = rect.height > 0 ? activeFrame.previewH / rect.height : 1;
    setOffsetX(
      dragOriginRef.current.startOffsetX +
        (e.clientX - dragOriginRef.current.clientX) * scaleX
    );
    setOffsetY(
      dragOriginRef.current.startOffsetY +
        (e.clientY - dragOriginRef.current.clientY) * scaleY
    );
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.releasePointerCapture?.(e.pointerId);
    setIsDragging(false);
    dragOriginRef.current = null;
  };

  const handleUploadCropped = async () => {
    if (!imgRef.current) return;
    setIsUploading(true);
    const toastId = toast.loading(
      mode === 'dataUrl' ? 'Cropping brand logo...' : 'Cropping & uploading brand asset...'
    );
    try {
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = activeFrame.width;
      exportCanvas.height = activeFrame.height;
      drawCanvas(exportCanvas, activeFrame.width, activeFrame.height, false);

      if (mode === 'dataUrl') {
        const dataUrl = exportCanvas.toDataURL('image/png', 0.92);
        onCroppedDataUrl?.(dataUrl, assetType);
        toast.success(
          `${activeFrame.shortLabel} crop applied cleanly!`,
          { id: toastId }
        );
        onClose();
        return;
      }

      if (!brandId) {
        toast.error('Missing brand ID for asset upload.', { id: toastId });
        return;
      }

      const blob: Blob = await new Promise((resolve, reject) => {
        exportCanvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Failed to encode image'))),
          'image/png',
          0.92
        );
      });

      const finalFile = new File([blob], ASSET_FILENAMES[assetType], {
        type: 'image/png',
      });

      if (finalFile.size > 2 * 1024 * 1024) {
        toast.error('Cropped image exceeds 2MB limit.', { id: toastId });
        setIsUploading(false);
        return;
      }

      const normalizedKind = assetType.replace(/_/g, '-');
      let assetUrl = '';
      const { isSupabaseConfigured } = await import('@/lib/supabase/config');
      if (isSupabaseConfigured() && brandId) {
        const { supabase } = await import('@/lib/supabase/client');
        const objectPath = `${brandId}/${normalizedKind}.png`;
        const { error: uploadErr } = await supabase.storage
          .from('brand-assets')
          .upload(objectPath, finalFile, {
            contentType: 'image/png',
            upsert: true,
            cacheControl: '3600',
          });

        if (uploadErr) {
          toast.error(uploadErr.message || 'Storage upload failed', { id: toastId });
          return;
        }

        const { data: pub } = supabase.storage
          .from('brand-assets')
          .getPublicUrl(objectPath);
        assetUrl = `${pub.publicUrl}?v=${Date.now()}`;
      } else {
        assetUrl = exportCanvas.toDataURL('image/png', 0.92);
      }

      toast.success(
        `Brand asset (${activeFrame.shortLabel}) cropped and saved!`,
        { id: toastId }
      );
      onUploaded?.(assetUrl, assetType);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to upload asset', { id: toastId });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm sm:text-base text-slate-900">
            <Crop className="h-4 w-4 text-slate-700" />
            <span>Crop &amp; Resize: {ASSET_TITLES[assetType]}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* CROP SHAPE SELECTOR */}
          {shapeOptions.length > 1 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700">Crop Shape</span>
                <span className="text-[11px] font-mono text-slate-500">
                  {activeFrame.width}&times;{activeFrame.height}px{' '}
                  {activeFrame.shape === 'circle' ? '• Transparent PNG' : ''}
                </span>
              </div>
              <div
                className={`grid gap-1.5 ${
                  shapeOptions.length === 3 ? 'grid-cols-3' : 'grid-cols-2'
                }`}
              >
                {shapeOptions.map((opt) => {
                  const Icon = getShapeIcon(opt.shape);
                  const active = activeFrame.shape === opt.shape;
                  return (
                    <button
                      key={opt.shape}
                      type="button"
                      onClick={() => handleShapeChange(opt.shape)}
                      className={`inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                        active
                          ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* INTERACTIVE CROP CANVAS */}
          <div className="flex items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-100 p-4 overflow-hidden">
            {objectUrl ? (
              <canvas
                ref={canvasRef}
                width={activeFrame.previewW}
                height={activeFrame.previewH}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onPointerLeave={(e) => {
                  if (isDragging) handlePointerUp(e);
                }}
                className="max-w-full cursor-move rounded-lg border border-slate-300 shadow-xs touch-none"
                style={{
                  aspectRatio: `${activeFrame.previewW} / ${activeFrame.previewH}`,
                  backgroundImage:
                    assetType === 'logo_dark'
                      ? 'repeating-conic-gradient(#334155 0% 25%, #1e293b 0% 50%)'
                      : 'repeating-conic-gradient(#e2e8f0 0% 25%, #f8fafc 0% 50%)',
                  backgroundSize: '16px 16px',
                }}
              />
            ) : (
              <div className="text-xs text-slate-500">Select an image to crop</div>
            )}
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                <ZoomOut className="h-3.5 w-3.5 text-slate-400" />
                <span>Zoom ({Math.round(zoom * 100)}%)</span>
              </span>
              <input
                type="range"
                min={0.5}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                className="flex-1 accent-slate-900"
              />
              <ZoomIn className="h-3.5 w-3.5 text-slate-400" />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5">
                <button
                  type="button"
                  onClick={() => setFitMode('contain')}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md cursor-pointer ${
                    fitMode === 'contain'
                      ? 'bg-white shadow-2xs text-slate-900'
                      : 'text-slate-500'
                  }`}
                >
                  Fit Entire Image
                </button>
                <button
                  type="button"
                  onClick={() => setFitMode('cover')}
                  className={`px-2.5 py-1 text-[11px] font-medium rounded-md cursor-pointer ${
                    fitMode === 'cover'
                      ? 'bg-white shadow-2xs text-slate-900'
                      : 'text-slate-500'
                  }`}
                >
                  Fill Frame
                </button>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-[11px]"
                onClick={() => {
                  setZoom(1);
                  setOffsetX(0);
                  setOffsetY(0);
                }}
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Reset Position
              </Button>
            </div>
            <p className="text-[11px] text-slate-500">
              Drag the preview canvas to pan cleanly.{' '}
              {activeFrame.shape === 'circle'
                ? `Exported as a circular transparent PNG (${activeFrame.width}×${activeFrame.height}px, ≤ 2MB).`
                : `Exported automatically at ${activeFrame.width}×${activeFrame.height}px (≤ 2MB).`}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleUploadCropped}
            disabled={isUploading || !imgLoaded}
            className="bg-slate-900 text-white hover:bg-slate-800"
          >
            <Upload className="h-3.5 w-3.5 mr-1.5" />
            {isUploading
              ? 'Processing...'
              : mode === 'dataUrl'
                ? 'Apply Cropped Logo'
                : 'Crop & Apply Asset'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
