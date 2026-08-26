// ============================================================
// RUSH PERFORMANCE — Upgrade to PRO Paywall Modal
//
// Tela de assinatura de alta conversão para o RUSH PRO (R$ 29,90/mês)
// com 7 dias de teste grátis, comparativo de benefícios e garantia.
// ============================================================

import { useState } from 'react';
import { subscriptions } from '../api';
import { billing } from '../services/billing';
import { 
  X, Check, Zap, Sparkles, Shield, Heart, Activity, 
  Flame, Lock, ArrowRight, Star, RefreshCw 
} from 'lucide-react';

export default function UpgradeProModal({ isOpen, onClose, onUpgraded }) {
  const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' | 'yearly'
  const [submitting, setSubmitting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSubscribe = async (isTrial = false) => {
    setSubmitting(true);
    try {
      if (isTrial) {
        await billing.startFreeTrial();
      } else if (billingCycle === 'yearly') {
        await billing.purchaseYearly();
      } else {
        await billing.purchaseMonthly();
      }

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        if (onUpgraded) onUpgraded();
        onClose();
      }, 1800);
    } catch (err) {
      console.error('Subscription error:', err);
      alert(err.message || 'Erro ao processar assinatura. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    try {
      const res = await billing.restorePurchases();
      if (res.restored) {
        alert('Assinatura restaurada com sucesso!');
        if (onUpgraded) onUpgraded();
        onClose();
      } else {
        alert(res.message || 'Nenhuma assinatura anterior encontrada.');
      }
    } catch (e) {
      alert('Erro ao restaurar compras: ' + e.message);
    } finally {
      setRestoring(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div 
        className="modal-card modal-card--upgrade-pro" 
        style={{ maxWidth: 460, padding: '24px 20px', border: '1px solid rgba(255, 56, 0, 0.35)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button 
          className="btn-close-modal" 
          onClick={onClose}
          style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}
        >
          <X size={18} />
        </button>

        {/* Header with Rush PRO Flame Badge */}
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div 
            className="status-badge" 
            style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: 6, 
              background: 'linear-gradient(135deg, #FF3800 0%, #FF6A00 100%)', 
              color: '#FFFFFF',
              fontWeight: 900,
              fontSize: '0.75rem',
              letterSpacing: '0.08em',
              padding: '4px 14px',
              borderRadius: 20,
              boxShadow: '0 4px 15px rgba(255, 56, 0, 0.4)',
              marginBottom: 10,
            }}
          >
            <Zap size={14} fill="#FFF" /> RUSH PRO
          </div>

          <h2 className="heading-lg" style={{ fontSize: '1.45rem', marginBottom: 6, textTransform: 'uppercase' }}>
            Desbloqueie Todo Seu Potencial
          </h2>
          <p className="text-body" style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', maxWidth: 360, margin: '0 auto' }}>
            O cérebro de treino guiado por VFC que adapta suas corridas todos os dias para você evoluir mais rápido sem lesões.
          </p>
        </div>

        {/* Benefits Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {[
            {
              title: 'IA de Treino Adaptativo Diário',
              desc: 'Ajusta automaticamente tiros, rodagens e descansos com base na sua VFC matinal.',
              icon: Sparkles,
            },
            {
              title: 'Auto-Periodização Inteligente',
              desc: 'Ciclos de Base, Construção, Pico e Polimento (Taper) calibrados para sua meta.',
              icon: Flame,
            },
            {
              title: 'Módulo Hormonal Feminino',
              desc: 'Ajuste de treino por fase do ciclo menstrual para máximo rendimento e bem-estar.',
              icon: Heart,
            },
            {
              title: 'Protocolo de Recuperação 4 Níveis',
              desc: 'Identificação precoce de overtraining e recomendações de deload científico.',
              icon: Activity,
            },
            {
              title: 'Análise de Tendência de 90 Dias',
              desc: 'Gráficos de SWC (Smallest Worthwhile Change) e evolução do condicionamento.',
              icon: Shield,
            },
          ].map((b, i) => {
            const Icon = b.icon;
            return (
              <div 
                key={i} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'flex-start', 
                  gap: 12, 
                  background: 'rgba(255, 255, 255, 0.03)', 
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                  borderRadius: 'var(--radius-md)',
                  padding: '10px 12px',
                }}
              >
                <div 
                  style={{ 
                    background: 'rgba(255, 56, 0, 0.15)', 
                    color: 'var(--color-primary)', 
                    padding: 6, 
                    borderRadius: 'var(--radius-xs)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                >
                  <Icon size={16} />
                </div>
                <div>
                  <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {b.title}
                  </div>
                  <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.35, marginTop: 2 }}>
                    {b.desc}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Plan Selector (Monthly vs Yearly) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 18 }}>
          {/* Monthly */}
          <div
            onClick={() => setBillingCycle('monthly')}
            style={{
              border: billingCycle === 'monthly' ? '2px solid var(--accent-primary)' : '1px solid var(--border-primary)',
              background: billingCycle === 'monthly' ? 'rgba(255, 56, 0, 0.12)' : 'var(--bg-elevated)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 12px',
              textAlign: 'center',
              cursor: 'pointer',
              position: 'relative',
              transition: 'all 0.2s',
            }}
          >
            <div className="label-mono" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>MENSAL</div>
            <div className="scoreboard" style={{ fontSize: '1.35rem', color: 'var(--text-primary)', margin: '4px 0' }}>
              R$ 29,90
            </div>
            <div className="label-mono" style={{ fontSize: '0.62rem', color: 'var(--accent-primary)' }}>
              7 DIAS GRÁTIS
            </div>
          </div>

          {/* Yearly */}
          <div
            onClick={() => setBillingCycle('yearly')}
            style={{
              border: billingCycle === 'yearly' ? '2px solid var(--accent-primary)' : '1px solid var(--border-primary)',
              background: billingCycle === 'yearly' ? 'rgba(255, 56, 0, 0.12)' : 'var(--bg-elevated)',
              borderRadius: 'var(--radius-md)',
              padding: '14px 12px',
              textAlign: 'center',
              cursor: 'pointer',
              position: 'relative',
              transition: 'all 0.2s',
            }}
          >
            <div 
              style={{
                position: 'absolute',
                top: -8,
                right: 8,
                background: 'var(--accent-primary)',
                color: '#fff',
                fontSize: '0.55rem',
                fontWeight: 900,
                padding: '2px 6px',
                borderRadius: 10,
                letterSpacing: '0.04em',
              }}
            >
              ECONOMIZE 33%
            </div>
            <div className="label-mono" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>ANUAL</div>
            <div className="scoreboard" style={{ fontSize: '1.35rem', color: 'var(--text-primary)', margin: '4px 0' }}>
              R$ 19,90 <span style={{ fontSize: '0.7rem' }}>/mês</span>
            </div>
            <div className="label-mono" style={{ fontSize: '0.62rem', color: 'var(--text-tertiary)' }}>
              R$ 238,80 / ano
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <button
          type="button"
          disabled={submitting}
          onClick={() => handleSubscribe(true)}
          className="btn btn-primary"
          style={{
            width: '100%',
            padding: '16px',
            fontSize: '0.95rem',
            fontWeight: 800,
            textTransform: 'uppercase',
            letterSpacing: '0.04em',
            boxShadow: '0 8px 25px rgba(255, 56, 0, 0.35)',
            marginBottom: 12,
          }}
        >
          {success ? (
            <>
              <Check size={18} /> Parabéns! RUSH PRO Ativado!
            </>
          ) : (
            <>
              <Sparkles size={18} /> {submitting ? 'Ativando...' : 'Iniciar 7 Dias Grátis'}
            </>
          )}
        </button>

        {/* Microcopy & Guarantees */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
            <Shield size={13} color="var(--status-favorable)" />
            <span>Cancele quando quiser nas configurações com 1 clique</span>
          </div>

          <div style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)', lineHeight: 1.4 }}>
            Após os 7 dias grátis, apenas R$ 29,90/mês cobrados recorrentemente. Sem fidelidade.
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 14, marginTop: 8 }}>
            <button
              type="button"
              disabled={restoring}
              onClick={handleRestore}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-secondary)',
                fontSize: '0.68rem',
                cursor: 'pointer',
                textDecoration: 'underline',
                padding: '4px 0',
              }}
            >
              {restoring ? 'Restaurando...' : 'Restaurar Compras Anteriores'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
