// ============================================================
// RUSH PERFORMANCE — Athlete Onboarding
// Multi-step objective & level calibration matching rushperformance.com.br
// ============================================================

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { users, training } from '../api';
import { useAuth } from '../context/AuthContext';
import { Zap, ChevronRight, ArrowLeft, Target, Award, Sparkles } from 'lucide-react';

const distances = [
  { km: 5, label: '5K', title: '5 KM', desc: 'Primeiros passos e base aeróbica' },
  { km: 10, label: '10K', title: '10 KM', desc: 'Construção de volume e ritmo' },
  { km: 21, label: '21K', title: '21 KM', desc: 'Meia-maratona e resistência' },
  { km: 42, label: '42K', title: '42 KM', desc: 'Maratona completa e endurance' },
];

const levels = [
  {
    id: 'beginner',
    label: 'Iniciante',
    badge: 'FASE 1',
    desc: 'Começando agora ou retornando após pausa prolongada. Foco em consistência.',
  },
  {
    id: 'intermediate',
    label: 'Intermediário',
    badge: 'FASE 2',
    desc: 'Corre regularmente há mais de 1 ano. Busca evolução de pace e distância.',
  },
  {
    id: 'advanced',
    label: 'Avançado',
    badge: 'FASE 3',
    desc: 'Atleta experiente com foco em tempos competitivos e periodização VFC fina.',
  },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, updateUser, refreshUser } = useAuth();

  const [step, setStep] = useState(1);
  const [distance, setDistance] = useState(null);
  const [level, setLevel] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleFinish = async () => {
    if (!distance || !level) return;
    setLoading(true);
    setError('');

    try {
      // 1. Save user objectives
      await users.objectives({ distance_km: distance, level });

      // 2. Generate initial periodized training plan
      try {
        await training.generatePlan({ distance_km: distance, level });
      } catch (planErr) {
        console.warn('Initial plan generation warning:', planErr.message);
      }

      // 3. Update auth state in context and localStorage
      updateUser({
        has_onboarding: true,
        distance_km: distance,
        level,
        objectives: { distance_km: distance, level },
      });

      // 4. Refresh full profile from backend
      try {
        await refreshUser();
      } catch {}

      // 5. Navigate to Dashboard
      navigate('/', { replace: true });
    } catch (err) {
      console.error('Onboarding save error:', err);
      setError(err.message || 'Erro ao salvar objetivos');
    } finally {
      setLoading(false);
    }
  };

  const displayName = user?.name?.split(' ')[0] || user?.username || 'Atleta';

  return (
    <div className="onboarding">
      <div className="onboarding-content">
        {/* Step Indicator & Progress */}
        <div style={{ marginBottom: 24 }}>
          <div className="flex items-center justify-between mb-sm">
            <div className="flex items-center gap-sm">
              <span className="live-dot" />
              <span className="label-mono">
                {step === 1 ? '№ 01 / OBJETIVO PRINCIPAL' : '№ 02 / CALIBRAÇÃO DE NÍVEL'}
              </span>
            </div>
            <span className="label-mono" style={{ color: 'var(--accent-primary)' }}>
              PASSO {step} DE 2
            </span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: step === 1 ? '50%' : '100%' }}
            />
          </div>
        </div>

        {step === 1 && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <h1 className="heading-xl" style={{ marginBottom: 6 }}>
                Olá, <span className="text-gradient">{displayName}</span>!
              </h1>
              <p className="text-body">
                Qual distância alvo você quer preparar com o Agente VFC?
              </p>
            </div>

            <div className="distance-grid">
              {distances.map((d) => {
                const isSelected = distance === d.km;
                return (
                  <button
                    key={d.km}
                    type="button"
                    className={`distance-card${isSelected ? ' selected' : ''}`}
                    onClick={() => setDistance(d.km)}
                  >
                    <div className="distance-value text-gradient">{d.label}</div>
                    <div style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                      {d.title}
                    </div>
                    <div className="distance-label">{d.desc}</div>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              className="btn btn-primary btn-full btn-lg"
              disabled={!distance}
              onClick={() => setStep(2)}
            >
              Continuar para Nível <ChevronRight size={18} />
            </button>
          </div>
        )}

        {step === 2 && (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <h1 className="heading-xl" style={{ marginBottom: 6 }}>
                Qual seu <span className="text-gradient">nível atual</span>?
              </h1>
              <p className="text-body">
                Isso define a curva de volume, intensidade e zonas cardíacas.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              {levels.map((l) => {
                const isSelected = level === l.id;
                return (
                  <button
                    key={l.id}
                    type="button"
                    className={`card-surface card-interactive${isSelected ? ' selected' : ''}`}
                    onClick={() => setLevel(l.id)}
                    style={{
                      padding: '16px 18px',
                      textAlign: 'left',
                      borderColor: isSelected ? 'var(--accent-primary)' : undefined,
                      background: isSelected
                        ? 'linear-gradient(155deg, rgba(255, 56, 0, 0.15) 0%, rgba(26, 26, 26, 0.95) 100%)'
                        : undefined,
                      boxShadow: isSelected ? '0 0 20px rgba(255, 56, 0, 0.25)' : undefined,
                    }}
                  >
                    <div className="flex items-center justify-between mb-xs">
                      <span
                        style={{
                          fontWeight: 800,
                          fontSize: '1.05rem',
                          color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)',
                        }}
                      >
                        {l.label}
                      </span>
                      <span className="label-mono" style={{ color: 'var(--accent-primary)' }}>
                        {l.badge}
                      </span>
                    </div>
                    <p className="text-small" style={{ lineHeight: 1.45 }}>{l.desc}</p>
                  </button>
                );
              })}
            </div>

            {error && (
              <div
                style={{
                  padding: '10px 14px',
                  background: 'var(--status-recovery-bg)',
                  border: '1px solid rgba(255, 59, 92, 0.3)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--status-recovery)',
                  fontSize: '0.82rem',
                  textAlign: 'center',
                  marginBottom: 16,
                }}
              >
                {error}
              </div>
            )}

            <div style={{ display: 'flex', gap: 12 }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ flex: '0 0 100px' }}
                onClick={() => setStep(1)}
                disabled={loading}
              >
                <ArrowLeft size={16} /> Voltar
              </button>
              <button
                type="button"
                className="btn btn-primary flex-1 btn-lg"
                disabled={!level || loading}
                onClick={handleFinish}
              >
                {loading ? (
                  'Configurando Plano...'
                ) : (
                  <>
                    Iniciar Temporada <Sparkles size={18} />
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
