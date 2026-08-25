// ============================================================
// RUSH PERFORMANCE — Heart Rate Zones Modal (Z1 - Z5)
// ============================================================

import { X, Heart, Zap, Flame, Shield, Activity, Info } from 'lucide-react';

const ZONE_COLORS = {
  Z1: '#4CAF50',
  Z2: '#00E676',
  Z3: '#FFB300',
  Z4: '#FF9100',
  Z5: '#FF3800',
};

export default function HeartRateZonesModal({ isOpen, onClose, zonesData }) {
  if (!isOpen || !zonesData) return null;

  const { max_hr, zones } = zonesData;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-card--zones" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="label-mono modal-label">№ 03 / FISIOLOGIA CARDÍACA</span>
            <h3 className="modal-title">Suas 5 Zonas de Treino</h3>
          </div>
          <button className="btn-close-modal" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <div className="zones-header-summary">
          <div className="zones-summary-stat">
            <span className="label-mono">FC MÁXIMA ESTIMADA</span>
            <div className="zones-max-hr">
              <span className="zones-hr-number">{max_hr || 188}</span>
              <span className="zones-hr-unit">BPM (Gellish)</span>
            </div>
          </div>
          <div className="zones-summary-badge">
            <span className="label-mono">DISTRIBUIÇÃO POLARIZADA</span>
            <span className="zones-polarized-tag">80% Z1/Z2 • 20% Z4/Z5</span>
          </div>
        </div>

        <div className="zones-list">
          {Object.entries(zones || {}).map(([key, z]) => (
            <div key={key} className="zone-item-card" style={{ borderLeftColor: ZONE_COLORS[key] || 'var(--color-primary)' }}>
              <div className="zone-item-top">
                <div className="zone-item-badge-wrap">
                  <span className="zone-code-tag" style={{ backgroundColor: ZONE_COLORS[key], color: '#000' }}>
                    {key}
                  </span>
                  <span className="zone-item-name">{z.name}</span>
                </div>
                <div className="zone-item-bpm">
                  <strong>{z.minBpm} – {z.maxBpm}</strong> <span className="label-mono">BPM</span>
                </div>
              </div>

              <div className="zone-item-details">
                <div className="zone-detail-row">
                  <span className="label-mono">INTENSIDADE:</span>
                  <span>{z.pctMax} • RPE: {z.rpe}</span>
                </div>
                <div className="zone-detail-row">
                  <span className="label-mono">PROPÓSITO:</span>
                  <span className="zone-purpose-text">{z.purpose}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="zones-modal-footer">
          <div className="zones-science-tip">
            <Info size={14} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
            <p>
              <strong>Regra dos 80/20 (Seiler):</strong> Mantenha a maior parte dos treinos em <strong>Z2 (conversacional)</strong> para construir mitocôndrias e queima de gordura sem fadiga residual.
            </p>
          </div>
          <button className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }} onClick={onClose}>
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
}
