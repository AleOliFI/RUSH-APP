// ============================================================
// RUSH PERFORMANCE — Menstrual Cycle Phase Card
// ============================================================

import { Sparkles, Calendar, Heart, Shield, Activity } from 'lucide-react';

const PHASE_CONFIG = {
  menstrual: {
    label: 'Fase Menstrual',
    dayRange: 'Dias 1–5',
    color: '#FF4D4D',
    bg: 'rgba(255, 77, 77, 0.12)',
    border: 'rgba(255, 77, 77, 0.3)',
    tag: 'REGENERAÇÃO & Z1/Z2',
    icon: '🩸',
    desc: 'Estrogênio e progesterona baixos. Priorize escuta do corpo e conforto.',
  },
  follicular: {
    label: 'Fase Folicular',
    dayRange: 'Dias 6–13',
    color: '#00E676',
    bg: 'rgba(0, 230, 118, 0.12)',
    border: 'rgba(0, 230, 118, 0.3)',
    tag: 'JANELA DE OURO (HIIT / VAM)',
    icon: '⚡',
    desc: 'Estrogênio em alta: máxima recuperação e dominância parassimpática!',
  },
  ovulatory: {
    label: 'Fase Ovulatória',
    dayRange: 'Dia 14 ±1',
    color: '#00B0FF',
    bg: 'rgba(0, 176, 255, 0.12)',
    border: 'rgba(0, 176, 255, 0.3)',
    tag: 'PICO DE FORÇA & ENERGIA',
    icon: '🔥',
    desc: 'Pico hormonal de estrogênio. Alta energia. Capriche no aquecimento articular.',
  },
  luteal: {
    label: 'Fase Lútea',
    dayRange: 'Dias 15–28',
    color: '#FFB300',
    bg: 'rgba(255, 179, 0, 0.12)',
    border: 'rgba(255, 179, 0, 0.3)',
    tag: 'BASE AERÓBICA & Z2',
    icon: '🌙',
    desc: 'Progesterona dominante: corpo prefere queimar gordura. VFC ligeiramente menor por natureza.',
  },
};

export default function CyclePhaseCard({ cycleData, onOpenTracking }) {
  if (!cycleData?.has_profile || !cycleData?.phase) return null;

  const config = PHASE_CONFIG[cycleData.phase] || PHASE_CONFIG.follicular;

  return (
    <div 
      className="cycle-phase-card"
      style={{
        backgroundColor: config.bg,
        borderColor: config.border,
      }}
    >
      <div className="cycle-phase-card-header">
        <div className="cycle-phase-badge-wrap">
          <span className="cycle-phase-emoji">{config.icon}</span>
          <div>
            <span className="label-mono" style={{ color: config.color, fontSize: '0.65rem' }}>
              CICLO HORMONAL • {config.dayRange}
            </span>
            <h4 className="cycle-phase-name" style={{ color: 'var(--text-primary)' }}>
              {config.label}
            </h4>
          </div>
        </div>
        <span 
          className="cycle-phase-tag"
          style={{
            color: config.color,
            borderColor: config.border,
            backgroundColor: 'rgba(0,0,0,0.3)',
          }}
        >
          {config.tag}
        </span>
      </div>

      <p className="cycle-phase-desc">{config.desc}</p>

      <div className="cycle-phase-footer">
        <span className="cycle-phase-rec">
          {cycleData.recommendation?.modifier || 'Treino calibrado para sua fase.'}
        </span>
        {onOpenTracking && (
          <button 
            type="button" 
            className="btn-text-action"
            onClick={onOpenTracking}
          >
            Sintomas do Dia →
          </button>
        )}
      </div>
    </div>
  );
}
