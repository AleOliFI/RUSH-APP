import React, { useState, useEffect } from 'react';
import { ImageViewerItem } from '../../types';
import { downloadImageToDevice } from '../../utils/imageDownload';

interface ImageViewerModalProps {
  item: ImageViewerItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ImageViewerModal: React.FC<ImageViewerModalProps> = ({
  item,
  isOpen,
  onClose,
}) => {
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [naturalDimensions, setNaturalDimensions] = useState<{ width: number; height: number } | null>(null);

  // Reset controls when item changes or modal opens
  useEffect(() => {
    if (isOpen) {
      setZoom(1);
      setRotation(0);
      setIsDownloading(false);
      setDownloadSuccess(false);
      setNaturalDimensions(null);
    }
  }, [isOpen, item]);

  // Keyboard shortcut for closing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === 'Escape') onClose();
      if (e.key === '+' || e.key === '=') setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)));
      if (e.key === '-') setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)));
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !item) return null;

  const handleDownload = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    setDownloadSuccess(false);

    const safeFilename = item.filename || `${item.title.toLowerCase().replace(/\s+/g, '-')}.png`;
    const res = await downloadImageToDevice(item.url, safeFilename);

    setIsDownloading(false);
    if (res.success) {
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 4000);
    }
  };

  const handleImageLoaded = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNaturalDimensions({
      width: img.naturalWidth,
      height: img.naturalHeight,
    });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-xl p-2 sm:p-6 animate-fade-in select-none">
      {/* Container Frame */}
      <div className="relative w-full max-w-4xl h-[92vh] max-h-[900px] bg-[#141414] border border-[#262626] rounded-2xl flex flex-col overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.9)]">
        
        {/* Top Control Bar HUD */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-[#1C1C1C] border-b border-[#262626] z-10 flex-shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#0D0D0D] border border-[#333] flex items-center justify-center text-[#FF5500] flex-shrink-0">
              <span className="material-symbols-outlined text-[18px]">image</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <span className="font-label-caps text-[9px] bg-[#FF5500]/15 text-[#FF5500] px-1.5 py-0.2 rounded font-extrabold uppercase tracking-wider">
                  {item.category || 'VISUALIZADOR DE MÍDIA'}
                </span>
                {naturalDimensions && (
                  <span className="font-telemetry text-[10px] text-[#737373] hidden sm:inline">
                    {naturalDimensions.width} × {naturalDimensions.height} PX
                  </span>
                )}
              </div>
              <h2 className="font-headline-sm text-sm sm:text-base text-[#F7F5F3] uppercase tracking-tight truncate mt-0.5">
                {item.title}
              </h2>
            </div>
          </div>

          {/* Top Actions: Zoom & Close */}
          <div className="flex items-center space-x-2 flex-shrink-0">
            {/* Zoom Controls */}
            <div className="hidden sm:flex items-center bg-[#101010] border border-[#262626] rounded-lg p-0.5 space-x-0.5">
              <button
                onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.25).toFixed(2)))}
                disabled={zoom <= 0.5}
                title="Reduzir zoom (-)"
                className="w-7 h-7 rounded hover:bg-[#262626] text-[#737373] hover:text-[#F7F5F3] flex items-center justify-center disabled:opacity-30 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">remove</span>
              </button>
              <button
                onClick={() => {
                  setZoom(1);
                  setRotation(0);
                }}
                title="Resetar visualização"
                className="px-2 h-7 font-telemetry text-[11px] text-[#FF5500] font-bold hover:bg-[#262626] rounded flex items-center justify-center cursor-pointer"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                onClick={() => setZoom((z) => Math.min(3, +(z + 0.25).toFixed(2)))}
                disabled={zoom >= 3}
                title="Aumentar zoom (+)"
                className="w-7 h-7 rounded hover:bg-[#262626] text-[#737373] hover:text-[#F7F5F3] flex items-center justify-center disabled:opacity-30 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
              </button>
              <button
                onClick={() => setRotation((r) => (r + 90) % 360)}
                title="Girar 90°"
                className="w-7 h-7 rounded hover:bg-[#262626] text-[#737373] hover:text-[#F7F5F3] flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">rotate_right</span>
              </button>
            </div>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-lg bg-[#101010] hover:bg-[#262626] border border-[#333] text-[#737373] hover:text-[#FF5500] flex items-center justify-center cursor-pointer transition-colors"
              title="Fechar (Esc)"
              aria-label="Fechar visualizador"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
        </div>

        {/* Central Image Viewport Canvas */}
        <div className="flex-1 relative flex items-center justify-center p-4 sm:p-8 overflow-hidden bg-[#0A0A0A] bg-radial from-[#141414] to-[#0A0A0A]">
          {/* Subtle tactical grid background */}
          <div
            className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{
              backgroundImage: 'linear-gradient(#FF5500 1px, transparent 1px), linear-gradient(to right, #FF5500 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
          />

          <div
            className="relative transition-transform duration-200 ease-out max-w-full max-h-full flex items-center justify-center"
            style={{
              transform: `scale(${zoom}) rotate(${rotation}deg)`,
            }}
          >
            <img
              src={item.url}
              alt={item.title}
              onLoad={handleImageLoaded}
              className="max-w-full max-h-[58vh] sm:max-h-[64vh] object-contain rounded-lg border border-[#262626] shadow-[0_0_35px_rgba(0,0,0,0.8)]"
            />
          </div>

          {/* Download Floating Confirmation Banner */}
          {downloadSuccess && (
            <div className="absolute top-4 inset-x-4 max-w-md mx-auto bg-[#22C55E] text-[#0D0D0D] px-4 py-2.5 rounded-lg shadow-xl font-body text-xs font-bold flex items-center justify-center space-x-2 animate-fade-in border border-[#22C55E]/80">
              <span className="material-symbols-outlined text-[20px]">check_circle</span>
              <span>Imagem baixada e salva com sucesso no seu dispositivo!</span>
            </div>
          )}
        </div>

        {/* Bottom Footer HUD with Prominent Download Button */}
        <div className="px-4 sm:px-6 py-4 bg-[#1C1C1C] border-t border-[#262626] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 flex-shrink-0">
          {/* Telemetry / Description */}
          <div className="min-w-0">
            {item.description ? (
              <p className="font-body text-xs text-[#A3A3A3] line-clamp-2">
                {item.description}
              </p>
            ) : (
              <div className="flex items-center space-x-3 text-xs">
                <span className="font-telemetry text-[#737373]">
                  ORIGEM: <span className="text-[#F7F5F3] font-bold">RUSH RUNNING TELEMETRY</span>
                </span>
                <span className="text-[#333]">•</span>
                <span className="font-telemetry text-[#22C55E] font-bold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#22C55E] animate-pulse"></span>
                  DISPONÍVEL PARA DOWNLOAD LOCAL
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2.5">
            {/* Primary Download Button */}
            <button
              id="btn-download-image"
              onClick={handleDownload}
              disabled={isDownloading}
              className={`flex-1 sm:flex-none h-11 px-5 rounded-lg font-headline-sm text-xs uppercase tracking-wider flex items-center justify-center space-x-2 shadow-[0_0_20px_rgba(255,85,0,0.3)] transition-all cursor-pointer ${
                downloadSuccess
                  ? 'bg-[#22C55E] text-[#0D0D0D]'
                  : isDownloading
                  ? 'bg-[#FF5500]/70 text-[#0D0D0D] cursor-wait'
                  : 'bg-[#FF5500] hover:bg-[#FF6B00] text-[#0D0D0D]'
              }`}
            >
              {isDownloading ? (
                <>
                  <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                  <span>SALVANDO IMAGEM...</span>
                </>
              ) : downloadSuccess ? (
                <>
                  <span className="material-symbols-outlined text-[18px]">check</span>
                  <span>IMAGEM SALVA NO DISPOSITIVO</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[20px]">download</span>
                  <span>BAIXAR IMAGEM (PNG)</span>
                </>
              )}
            </button>

            {/* Quick Link Out */}
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="h-11 px-3 bg-[#101010] hover:bg-[#262626] border border-[#333] text-[#737373] hover:text-[#F7F5F3] rounded-lg flex items-center justify-center transition-colors cursor-pointer"
              title="Abrir imagem original em nova aba"
            >
              <span className="material-symbols-outlined text-[18px]">open_in_new</span>
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
