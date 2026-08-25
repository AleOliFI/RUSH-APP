// ============================================================
// RUSH PERFORMANCE — Beginner Field Test & HR Zones Calibration
//
// Teste de Campo Guiado para determinação de Zonas e Paces de Treino.
// Baseado em protocolos de teste de campo:
// - Foster et al. (2001): 12-min submaximal field test & VAM correlation.
// - Friel, J. (2009): 30-min LTHR time trial for individual heart rate zones.
// ============================================================

import { useState } from 'react';
import { users } from '../api';
import { X, Target, Sparkles, CheckCircle2, Activity, Play, Info, Flame } from 'lucide-react';

export default function FieldTestModal({ isOpen, onClose, onTestCompleted }) {
  const [distanceKm, setDistanceKm] = useState('2.2');
  const [durationMin, setDurationMin] = useState('12');
  const [avgHr, setAvgHr] = useState('168');
  const [maxHr, setMaxHr] = useState('186');
  const [restHr, setRestHr] = useState('54');
  const [submitting, setSubmitting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  if (!isOpen) return null;

  const handleSaveTest = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await users.fieldTest({
        test_type: '12min_field_test',
        distance_km: parseFloat(distanceKm),
        duration_seconds: parseInt(durationMin, 10) * 60,
        avg_hr: parseInt(avgHr, 10),
        max_hr: parseInt(maxHr, 10),
        rest_hr: parseInt(restHr, 10),
      });

      setTestResult(res);
      if (onTestCompleted) {
        onTestCompleted(res);
      }
    } catch (err) {
      console.error('Field test save error:', err);
      alert('Erro ao salvar teste de campo: ' + (err.message || 'Tente novamente'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-card--field-test" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="label-mono modal-label">№ 07 / CALIBRAÇÃO DE PERFORMANCE</span>
            <h3 className="modal-title">Teste de Campo de Zonas</h3>
          </div>
          <button className="btn-close-modal" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        {testResult ? (
          /* Test Result Screen */
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <CheckCircle2 size={48} color="var(--status-favorable)" style={{ margin: '0 auto 10px' }} />
            <span className="label-mono" style={{ color: 'var(--status-favorable)', fontSize: '0.7rem' }}>
              ZONAS CALIBRADAS COM SUCESSO!
            </span>
            <h3 className="heading-md" style={{ margin: '4px 0 12px' }}>
              Seus Novos Paces e Zonas
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div className="card-surface stat-box" style={{ padding: '12px' }}>
                <div className="scoreboard" style={{ fontSize: '1.6rem', color: 'var(--color-primary)' }}>
                  {testResult.test_pace}
                </div>
                <div className="label-mono" style={{ fontSize: '0.62rem', marginTop: 2 }}>PACE DE LIMIAR</div>
              </div>

              <div className="card-surface stat-box" style={{ padding: '12px' }}>
                <div className="scoreboard" style={{ fontSize: '1.6rem', color: 'var(--text-primary)' }}>
                  {testResult.max_hr} <span className="label-mono" style={{ fontSize: '0.7rem' }}>BPM</span>
                </div>
                <div className="label-mono" style={{ fontSize: '0.62rem', marginTop: 2 }}>FC MÁXIMA TESTADA</div>
              </div>
            </div>

            {/* List of 5 Zones with Paces */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, textAlign: 'left', marginBottom: 18 }}>
              {Object.entries(testResult.zones || {}).map(([key, z]) => (
                <div key={key} className="card-surface" style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="label-mono" style={{ fontWeight: 900, color: 'var(--color-primary)' }}>{key}</span>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>{z.minBpm} – {z.maxBpm} bpm</span>
                  </div>
                  <span className="scoreboard" style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                    {z.pace}
                  </span>
                </div>
              ))}
            </div>

            <button className="btn btn-primary" style={{ width: '100%', padding: '14px' }} onClick={onClose}>
              <Sparkles size={16} /> Aplicar aos Treinos do App
            </button>
          </div>
        ) : (
          /* Step-by-Step Instructions & Form */
          <div>
            {/* Guide Explanation */}
            <div className="zones-science-tip" style={{ marginBottom: 16 }}>
              <Info size={16} color="var(--color-primary)" style={{ flexShrink: 0, marginTop: 2 }} />
              <div>
                <strong>Como funciona o Teste de 12 Minutos?</strong>
                <p style={{ margin: '4px 0 0', fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  1. Aqueça 10 min trote leve.<br />
                  2. Corra <strong>12 minutos no ritmo mais forte e constante</strong> que conseguir sustentar na esteira ou rua plana.<br />
                  3. Anote a distância percorrida e a FC média do relógio/celular e insira abaixo.
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveTest} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="label-mono" style={{ fontSize: '0.68rem', display: 'block', marginBottom: 4 }}>
                    DISTÂNCIA (KM)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.5"
                    max="5.0"
                    value={distanceKm}
                    onChange={(e) => setDistanceKm(e.target.value)}
                    required
                    className="input-field"
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', textAlign: 'center' }}
                  />
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)' }}>Ex: 2.2 km</span>
                </div>

                <div>
                  <label className="label-mono" style={{ fontSize: '0.68rem', display: 'block', marginBottom: 4 }}>
                    TEMPO (MIN)
                  </label>
                  <input
                    type="number"
                    value={durationMin}
                    onChange={(e) => setDurationMin(e.target.value)}
                    required
                    className="input-field"
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '1rem', textAlign: 'center' }}
                  />
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)' }}>Padrão: 12 min</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <div>
                  <label className="label-mono" style={{ fontSize: '0.65rem', display: 'block', marginBottom: 4 }}>
                    FC MÉDIA (BPM)
                  </label>
                  <input
                    type="number"
                    min="100"
                    max="220"
                    value={avgHr}
                    onChange={(e) => setAvgHr(e.target.value)}
                    className="input-field"
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', textAlign: 'center' }}
                  />
                </div>

                <div>
                  <label className="label-mono" style={{ fontSize: '0.65rem', display: 'block', marginBottom: 4 }}>
                    FC MÁXIMA (BPM)
                  </label>
                  <input
                    type="number"
                    min="120"
                    max="230"
                    value={maxHr}
                    onChange={(e) => setMaxHr(e.target.value)}
                    className="input-field"
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', textAlign: 'center' }}
                  />
                </div>

                <div>
                  <label className="label-mono" style={{ fontSize: '0.65rem', display: 'block', marginBottom: 4 }}>
                    FC REPOUSO (BPM)
                  </label>
                  <input
                    type="number"
                    min="35"
                    max="100"
                    value={restHr}
                    onChange={(e) => setRestHr(e.target.value)}
                    className="input-field"
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '0.9rem', textAlign: 'center' }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="btn btn-primary"
                style={{ width: '100%', padding: '14px', marginTop: 6 }}
              >
                <Target size={16} />
                <span>{submitting ? 'Calculando Zonas...' : 'Calcular Minhas Zonas e Paces'}</span>
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
