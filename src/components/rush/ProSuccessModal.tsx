import React from 'react';

interface ProSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProSuccessModal: React.FC<ProSuccessModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="pro-success-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md transition-opacity"
    >
      <div className="relative w-full max-w-md bg-[#0D0D0D] rounded-3xl border border-[#22C55E]/60 p-6 shadow-[0_0_50px_rgba(34,197,94,0.25)] text-center space-y-5">
        {/* Success Icon with Glow */}
        <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-[#22C55E]/20 animate-ping" />
          <div className="w-16 h-16 rounded-full bg-[#22C55E]/30 border-2 border-[#22C55E] flex items-center justify-center text-[#22C55E]">
            <span className="material-symbols-outlined text-[36px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              verified
            </span>
          </div>
        </div>

        <div className="space-y-1">
          <span className="font-label-sm text-[10px] text-[#22C55E] font-bold uppercase tracking-widest block">
            PAGAMENTO CONFIRMADO
          </span>
          <h2 id="pro-success-title" className="font-headline text-3xl text-[#F7F5F3] uppercase tracking-normal">
            Você é Atleta RUSH PRO!
          </h2>
          <p className="text-xs text-[#A1A1AA] max-w-xs mx-auto">
            Todas as ferramentas de alta performance, telemetria biomecânica e stickers dinâmicos foram desbloqueadas.
          </p>
        </div>

        {/* Receipt Box */}
        <div className="bg-[#1C1C1C] p-3.5 rounded-2xl border border-[#262626] text-left text-xs space-y-2">
          <div className="flex justify-between">
            <span className="text-[#A1A1AA]">ID da Assinatura:</span>
            <span className="font-telemetry text-white font-bold">RUSH-PRO-98421</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#A1A1AA]">Plano Ativado:</span>
            <span className="text-[#FF5500] font-bold">Anual (12 Meses)</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#A1A1AA]">Status:</span>
            <span className="text-[#22C55E] font-bold">Ativo & Sincronizado</span>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full min-h-[50px] py-3.5 px-6 bg-[#FF5500] hover:bg-[#FF6B00] active:scale-[0.98] text-[#0D0D0D] font-headline text-base uppercase tracking-wider rounded-xl shadow-lg shadow-[#FF5500]/25 transition-all cursor-pointer"
        >
          Acessar Meu Cockpit PRO
        </button>
      </div>
    </div>
  );
};
