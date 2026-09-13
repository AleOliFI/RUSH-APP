import React, { useState } from 'react';

interface ProCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ProCheckoutModal: React.FC<ProCheckoutModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [billingCycle, setBillingCycle] = useState<'annual' | 'monthly'>('annual');
  const [paymentMethod, setPaymentMethod] = useState<'gpay' | 'pix' | 'card'>('gpay');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen) return null;

  const handleCheckout = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      onSuccess();
    }, 1500);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-title"
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/92 backdrop-blur-md transition-opacity"
    >
      <div className="flex-1 w-full" onClick={onClose} />

      <div className="relative w-full max-w-xl mx-auto max-h-[94vh] flex flex-col bg-[#0D0D0D] rounded-t-3xl border-t border-[#FF5500]/60 shadow-[0_-12px_45px_rgba(0,0,0,0.95)] overflow-hidden">
        {/* Grab Pill */}
        <div className="w-full flex items-center justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 rounded-full bg-[#353534]" />
        </div>

        {/* Modal Header */}
        <div className="px-5 py-3 flex items-center justify-between border-b border-[#262626]">
          <div>
            <span className="font-label-sm text-[10px] text-[#FF5500] tracking-widest uppercase block">
              EXPERIÊNCIA DE ELITE
            </span>
            <h2 id="checkout-title" className="font-headline text-2xl text-[#F7F5F3] uppercase tracking-normal">
              Assinatura RUSH PRO
            </h2>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#1C1C1C] text-[#A1A1AA] hover:text-[#F7F5F3] flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Fechar checkout"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Plan Selector */}
          <div className="grid grid-cols-2 gap-3">
            <div
              onClick={() => setBillingCycle('annual')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer relative ${
                billingCycle === 'annual'
                  ? 'bg-[#1C1C1C] border-[#FF5500] shadow-lg shadow-[#FF5500]/15'
                  : 'bg-[#101010] border-[#262626] opacity-75'
              }`}
            >
              <span className="absolute -top-2.5 right-3 bg-[#FF5500] text-[#0D0D0D] text-[9px] font-black uppercase px-2 py-0.5 rounded-full shadow">
                ECONOMIZE 30%
              </span>
              <span className="font-headline text-sm text-[#F7F5F3] uppercase block">Plano Anual</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-xs text-[#A1A1AA]">R$</span>
                <span className="font-headline text-3xl text-[#FF5500]">24,90</span>
                <span className="text-[10px] text-[#A1A1AA]">/mês</span>
              </div>
              <span className="text-[10px] text-[#737373] block mt-0.5">R$ 298,80 faturado a cada 12 meses</span>
            </div>

            <div
              onClick={() => setBillingCycle('monthly')}
              className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                billingCycle === 'monthly'
                  ? 'bg-[#1C1C1C] border-[#FF5500] shadow-lg'
                  : 'bg-[#101010] border-[#262626] opacity-75'
              }`}
            >
              <span className="font-headline text-sm text-[#F7F5F3] uppercase block">Plano Mensal</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-xs text-[#A1A1AA]">R$</span>
                <span className="font-headline text-3xl text-[#F7F5F3]">34,90</span>
                <span className="text-[10px] text-[#A1A1AA]">/mês</span>
              </div>
              <span className="text-[10px] text-[#737373] block mt-0.5">Cancele quando quiser</span>
            </div>
          </div>

          {/* Features Checklist */}
          <div className="bg-[#1C1C1C] p-4 rounded-2xl border border-[#262626] space-y-2.5 text-xs">
            <span className="font-label-caps text-[10px] text-[#A1A1AA] uppercase tracking-wider block font-bold">
              Tudo Incluído no RUSH PRO
            </span>
            <div className="space-y-2 text-[#e5e2e1]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#22C55E] text-[18px]">check_circle</span>
                <span>Alerta Biomecânico de Desgaste e Fadiga de Espuma de Tênis</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#22C55E] text-[18px]">check_circle</span>
                <span>Canvas 9:16 Dinâmico & Stickers Exportáveis em 60 FPS</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#22C55E] text-[18px]">check_circle</span>
                <span>Pareamento Multi-BLE Ilimitado (Polar, Stryd, Garmin)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#22C55E] text-[18px]">check_circle</span>
                <span>Protocolos de Laboratório (Friel, Cooper, Limiar LTHR)</span>
              </div>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-2">
            <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase block">
              Forma de Pagamento
            </span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'gpay', name: 'Google Pay', icon: 'payments' },
                { id: 'pix', name: 'PIX Instantâneo', icon: 'qr_code_2' },
                { id: 'card', name: 'Cartão de Crédito', icon: 'credit_card' },
              ].map((pm) => (
                <button
                  key={pm.id}
                  onClick={() => setPaymentMethod(pm.id as any)}
                  className={`min-h-[44px] py-2.5 px-2 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all cursor-pointer ${
                    paymentMethod === pm.id
                      ? 'bg-[#FF5500] text-[#0D0D0D] border-[#FF5500] font-extrabold shadow'
                      : 'bg-[#1C1C1C] text-[#A1A1AA] border-[#262626] hover:text-[#F7F5F3]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">{pm.icon}</span>
                  <span className="text-[10px] uppercase">{pm.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Summary & Guarantee */}
          <div className="flex items-center justify-between text-xs text-[#A1A1AA] px-1">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px] text-[#22C55E]">verified_user</span>
              7 dias de garantia incondicional
            </span>
            <span>Criptografia bancária 256-bit</span>
          </div>

          {/* Action CTA */}
          <div className="pt-2">
            <button
              onClick={handleCheckout}
              disabled={isProcessing}
              className="w-full min-h-[54px] py-4 px-6 bg-[#FF5500] hover:bg-[#FF6B00] active:scale-[0.98] text-[#0D0D0D] rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-[#FF5500]/30 font-headline text-lg uppercase tracking-wider transition-all cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[22px]">progress_activity</span>
                  <span>Processando Assinatura...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[24px]">lock</span>
                  <span>Confirmar & Ativar RUSH PRO</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
