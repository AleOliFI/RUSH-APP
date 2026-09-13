// ============================================================
// RUSH RUNNING — Confirmação de ativação do RUSH PRO
// Mostra o estado real da assinatura devolvido pelo backend.
// ============================================================

import React from 'react';

interface ProSuccessModalProps {
  isOpen: boolean;
  subscription: {
    tier?: string;
    status: string;
    is_pro: boolean;
    trial_days_left: number;
    trial_ends_at?: string | null;
    expires_at?: string | null;
    provider?: string | null;
  } | null;
  onClose: () => void;
}

const PROVIDER_LABEL: Record<string, string> = {
  apple_in_app: 'App Store',
  google_play: 'Google Play',
  web_checkout: 'Checkout web',
  in_app: 'No aplicativo',
  revenuecat: 'RevenueCat',
};

function formatDate(iso?: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return isNaN(date.getTime()) ? null : date.toLocaleDateString('pt-BR');
}

export const ProSuccessModal: React.FC<ProSuccessModalProps> = ({ isOpen, subscription, onClose }) => {
  if (!isOpen) return null;

  const isTrial = subscription?.status === 'trial' || (subscription?.trial_days_left ?? 0) > 0;
  const renewalDate = formatDate(isTrial ? subscription?.trial_ends_at : subscription?.expires_at);

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
            {isTrial ? 'TESTE GRATUITO ATIVADO' : 'ASSINATURA CONFIRMADA'}
          </span>
          <h2 id="pro-success-title" className="font-headline text-3xl text-[#F7F5F3] uppercase tracking-normal">
            Você é Atleta RUSH PRO!
          </h2>
          <p className="text-xs text-[#A1A1AA] max-w-xs mx-auto">
            {isTrial
              ? `Você tem ${subscription?.trial_days_left ?? 7} dias para explorar todas as ferramentas avançadas sem custo.`
              : 'Todas as ferramentas de alta performance, telemetria biomecânica e stickers dinâmicos foram desbloqueadas.'}
          </p>
        </div>

        {/* Receipt Box */}
        <div className="bg-[#1C1C1C] p-3.5 rounded-2xl border border-[#262626] text-left text-xs space-y-2">
          <div className="flex justify-between gap-2">
            <span className="text-[#A1A1AA]">Plano:</span>
            <span className="text-[#FF5500] font-bold text-right">
              {isTrial ? 'RUSH PRO — teste de 7 dias' : 'RUSH PRO'}
            </span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-[#A1A1AA]">Status:</span>
            <span className="text-[#22C55E] font-bold">
              {subscription?.is_pro ? 'Ativo' : 'Processando'}
            </span>
          </div>
          {renewalDate && (
            <div className="flex justify-between gap-2">
              <span className="text-[#A1A1AA]">{isTrial ? 'Teste termina em:' : 'Renova em:'}</span>
              <span className="font-telemetry text-white font-bold">{renewalDate}</span>
            </div>
          )}
          {subscription?.provider && (
            <div className="flex justify-between gap-2">
              <span className="text-[#A1A1AA]">Cobrança por:</span>
              <span className="text-white font-bold text-right">
                {PROVIDER_LABEL[subscription.provider] || subscription.provider}
              </span>
            </div>
          )}
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
