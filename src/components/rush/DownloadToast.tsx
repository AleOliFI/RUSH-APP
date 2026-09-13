import React, { useState, useEffect } from 'react';

export const DownloadToast: React.FC = () => {
  const [toast, setToast] = useState<{ filename: string; visible: boolean } | null>(null);

  useEffect(() => {
    const handleDownloadEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{ filename: string; success: boolean }>;
      if (customEvent.detail) {
        setToast({
          filename: customEvent.detail.filename,
          visible: true,
        });

        const timer = setTimeout(() => {
          setToast((prev) => (prev ? { ...prev, visible: false } : null));
        }, 4000);

        return () => clearTimeout(timer);
      }
    };

    window.addEventListener('rush-image-downloaded', handleDownloadEvent);
    return () => window.removeEventListener('rush-image-downloaded', handleDownloadEvent);
  }, []);

  if (!toast || !toast.visible) return null;

  return (
    <div className="fixed bottom-20 sm:bottom-6 right-4 left-4 sm:left-auto sm:max-w-md z-[120] animate-fade-in">
      <div className="bg-[#1C1C1C] border-2 border-[#FF5500] text-[#F7F5F3] p-4 rounded-xl shadow-[0_0_30px_rgba(255,85,0,0.35)] flex items-center justify-between space-x-3">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-[#FF5500] text-[#0D0D0D] flex items-center justify-center flex-shrink-0 font-bold">
            <span className="material-symbols-outlined text-[20px]">download_done</span>
          </div>
          <div className="min-w-0">
            <span className="font-label-caps text-[9px] text-[#FF5500] font-black uppercase tracking-wider block">
              DOWNLOAD CONCLUÍDO
            </span>
            <p className="font-body text-xs font-bold truncate text-[#F7F5F3]">
              {toast.filename}
            </p>
            <span className="font-telemetry text-[10px] text-[#22C55E]">
              Salvo no armazenamento local do seu dispositivo
            </span>
          </div>
        </div>
        <button
          onClick={() => setToast(null)}
          className="text-[#737373] hover:text-[#FF5500] p-1 cursor-pointer flex-shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>
      </div>
    </div>
  );
};
