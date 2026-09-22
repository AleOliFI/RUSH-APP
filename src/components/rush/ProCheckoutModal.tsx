// ============================================================
// RUSH RUNNING — Checkout RUSH PRO
// ------------------------------------------------------------
// A compra passa pelo serviço de billing já existente
// (src/services/billing.js): nas lojas usa RevenueCat, na web
// ativa a assinatura pelo backend. Os preços são os praticados
// pelo backend, não valores de vitrine.
// ============================================================

import React, { useState } from 'react';
import { billing } from '../../services/billing';

interface ProCheckoutModalProps {
  isOpen: boolean;
  userId: string;
  /** Assinatura atual, para oferecer o teste só a quem nunca assinou. */
  subscription: { is_pro: boolean; status: string; trial_days_left: number } | null;
  onClose: () => void;
  onSuccess: () => void;
}

/** Preços praticados pelo backend (server/routes/subscriptions.js). */
const MONTHLY_BRL = 29.9;
const YEARLY_BRL = 238.8;
const YEARLY_PER_MONTH_BRL = YEARLY_BRL / 12;
const YEARLY_DISCOUNT_PCT = Math.round((1 - YEARLY_PER_MONTH_BRL / MONTHLY_BRL) * 100);

const brl = (value: number) => value.toFixed(2).replace('.', ',');

export const ProCheckoutModal: React.FC<ProCheckoutModalProps> = ({
  isOpen,
  userId,
  subscription,
  onClose,
  onSuccess,
}) => {
  const [billingCycle, setBillingCycle] = useState<'annual' | 'monthly'>('annual');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (!isOpen) return null;

  const canStartTrial = !subscription?.is_pro && subscription?.status === 'free';

  const handleCheckout = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      const result =
        billingCycle === 'annual' ? await billing.assinarAnual() : await billing.assinarMensal();

      // Desistir da compra na loja nao e erro: nao mostra alerta.
      if ((result as any)?.cancelada) {
        setNotice('Compra cancelada.');
        return;
      }
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível concluir a assinatura.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartTrial = async () => {
    setIsProcessing(true);
    setError(null);
    try {
      await billing.iniciarTesteGratis();
      onSuccess();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível iniciar o teste gratuito.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestore = async () => {
    setIsRestoring(true);
    setError(null);
    setNotice(null);
    try {
      const result: any = await billing.restaurarCompras();
      // Restaurar passa pela verificacao no servidor: ou volta com a
      // assinatura reconhecida (is_pro), ou diz que nao ha nenhuma.
      if (result?.restaurada || result?.is_pro) {
        onSuccess();
      } else {
        setNotice(result?.mensagem || 'Nenhuma assinatura ativa encontrada.');
      }
    } catch (err: any) {
      setError(err?.message || 'Não foi possível restaurar compras.');
    } finally {
      setIsRestoring(false);
    }
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
                ECONOMIZE {YEARLY_DISCOUNT_PCT}%
              </span>
              <span className="font-headline text-sm text-[#F7F5F3] uppercase block">Plano Anual</span>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-xs text-[#A1A1AA]">R$</span>
                <span className="font-headline text-3xl text-[#FF5500]">{brl(YEARLY_PER_MONTH_BRL)}</span>
                <span className="text-[10px] text-[#A1A1AA]">/mês</span>
              </div>
              <span className="text-[10px] text-[#737373] block mt-0.5">
                R$ {brl(YEARLY_BRL)} faturado a cada 12 meses
              </span>
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
                <span className="font-headline text-3xl text-[#F7F5F3]">{brl(MONTHLY_BRL)}</span>
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

          {/* Onde a cobrança acontece */}
          <div className="bg-[#101010] p-3.5 rounded-2xl border border-[#262626] flex items-start gap-2.5">
            <span className="material-symbols-outlined text-[#FF5500] text-[20px] shrink-0">info</span>
            <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
              No aplicativo iOS ou Android a cobrança é processada pela App Store ou Google Play, com os meios
              de pagamento já cadastrados na sua conta da loja. Você pode cancelar a qualquer momento pelas
              configurações de assinatura da própria loja.
            </p>
          </div>

          {/* Summary & Guarantee */}
          <div className="flex items-center justify-between text-xs text-[#A1A1AA] px-1 gap-2">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[16px] text-[#22C55E]">verified_user</span>
              Cancele quando quiser
            </span>
            <span className="text-right">
              {billingCycle === 'annual' ? `Total hoje: R$ ${brl(YEARLY_BRL)}` : `Total hoje: R$ ${brl(MONTHLY_BRL)}`}
            </span>
          </div>

          {error && (
            <p className="text-xs text-[#EF4444] font-bold px-1" role="alert">
              {error}
            </p>
          )}

          {notice && (
            <p className="text-xs text-[#FACC15] font-bold px-1" role="status">
              {notice}
            </p>
          )}

          {/* Ações */}
          <div className="pt-2 space-y-2.5">
            <button
              onClick={handleCheckout}
              disabled={isProcessing || isRestoring}
              className="w-full min-h-[54px] py-4 px-6 bg-[#FF5500] hover:bg-[#FF6B00] disabled:opacity-60 disabled:cursor-wait active:scale-[0.98] text-[#0D0D0D] rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-[#FF5500]/30 font-headline text-lg uppercase tracking-wider transition-all cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <span className="material-symbols-outlined animate-spin text-[22px]">progress_activity</span>
                  <span>Processando assinatura…</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[24px]">lock</span>
                  <span>Assinar RUSH PRO</span>
                </>
              )}
            </button>

            {canStartTrial && (
              <button
                onClick={handleStartTrial}
                disabled={isProcessing || isRestoring}
                className="w-full min-h-[48px] py-3 px-4 bg-[#262626] hover:bg-[#353534] disabled:opacity-60 text-[#F7F5F3] rounded-xl border border-[#353534] font-bold text-xs uppercase tracking-wider transition-all cursor-pointer"
              >
                Começar teste gratuito de 7 dias
              </button>
            )}

            <button
              onClick={handleRestore}
              disabled={isProcessing || isRestoring}
              className="w-full min-h-[44px] text-xs text-[#A1A1AA] hover:text-[#F7F5F3] font-bold uppercase tracking-wider transition-colors cursor-pointer disabled:opacity-60"
            >
              {isRestoring ? 'Restaurando…' : 'Restaurar compras'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
