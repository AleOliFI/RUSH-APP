// ============================================================
// RUSH PERFORMANCE — Recovery Alert Banner (Overreaching Prevention)
// ============================================================

import { AlertTriangle, ShieldAlert, Moon, Activity, Coffee } from 'lucide-react';

export default function RecoveryAlert({ consecutiveLowDays = 0, recoveryLevel = null, onDismiss }) {
  if (!consecutiveLowDays || consecutiveLowDays < 2) return null;

  const isOverreaching = consecutiveLowDays >= 5;
  const isSevere = consecutiveLowDays >= 3;

  return (
    <div className={`recovery-alert-banner ${isOverreaching ? 'recovery-alert--critical' : 'recovery-alert--warning'}`}>
      <div className="recovery-alert-header">
        <div className="recovery-alert-icon-box">
          {isOverreaching ? <ShieldAlert size={20} /> : <AlertTriangle size={20} />}
        </div>
        <div className="recovery-alert-title-wrap">
          <span className="label-mono recovery-alert-tag">
            {isOverreaching ? '⚠️ ALERTA DE OVERREACHING' : '⚡ FADIGA ACUMULADA'}
          </span>
          <h4 className="recovery-alert-title">
            {isOverreaching
              ? `${consecutiveLowDays} dias consecutivos com VFC deprimida`
              : `${consecutiveLowDays} dias seguidos abaixo da baseline`}
          </h4>
        </div>
      </div>

      <p className="recovery-alert-desc">
        {isOverreaching
          ? 'Seu sistema parassimpático apresenta supressão severa contínua. Para evitar sobretreino crônico (NFOR), treinos de alta intensidade foram temporariamente bloqueados.'
          : 'O sistema nervoso autônomo está demandando recuperação. O treino de hoje foi automaticamente adaptado para Z1/Z2 com foco regenerativo.'}
      </p>

      {recoveryLevel?.recovery_activities && (
        <div className="recovery-checklist">
          <span className="label-mono checklist-label">PROTOCOLO CIENTÍFICO DE HOJE:</span>
          <ul className="recovery-checklist-items">
            {recoveryLevel.recovery_activities.map((act, idx) => (
              <li key={idx} className="recovery-checklist-item">
                <span className="checklist-bullet">•</span> {act}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
