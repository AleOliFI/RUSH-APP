// ============================================================
// RUSH PERFORMANCE — Post-Workout Feedback & RPE Logger
//
// Registro pós-treino com Percepção Subjetiva de Esforço (RPE 1-10) de Foster,
// foto do treino, notas de sensação e compartilhamento no Feed social.
// ============================================================

import { useState } from 'react';
import { activities } from '../api';
import { X, Camera, Star, Sparkles, Check, Flame, Activity, Heart, Share2, Upload } from 'lucide-react';

const RPE_LABELS = {
  1: '1/10 — Muito Leve (Recuperativo)',
  2: '2/10 — Leve / Trote Confortável',
  3: '3/10 — Moderado / Ritmo de Conversa (Z2)',
  4: '4/10 — Firme mas Controlado',
  5: '5/10 — Difícil / Respiração Acelerada',
  6: '6/10 — Bastante Difícil (Z3)',
  7: '7/10 — Muito Difícil / Ritmo de Prova 10k (Z4)',
  8: '8/10 — Intenso / Queimação Muscular',
  9: '9/10 — Quase Máximo / Tiros Finais (Z5)',
  10: '10/10 — Esforço Máximo / Exaustão Total',
};

export default function PostWorkoutModal({ isOpen, onClose, plannedSession, onSaved }) {
  const [distanceKm, setDistanceKm] = useState(plannedSession?.distance_km ? String(plannedSession.distance_km) : '5.0');
  const [durationMin, setDurationMin] = useState(plannedSession?.duration_minutes ? String(plannedSession.duration_minutes) : '30');
  const [avgPace, setAvgPace] = useState(plannedSession?.target_pace || '5:45');
  const [avgHr, setAvgHr] = useState('145');
  const [rpeScore, setRpeScore] = useState(4);
  const [feelingNotes, setFeelingNotes] = useState('Treino concluído conforme planejado, ótima sensação nas pernas.');
  const [workoutRating, setWorkoutRating] = useState(5);
  const [imageUrl, setImageUrl] = useState('');
  const [shareOnFeed, setShareOnFeed] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const dist = parseFloat(distanceKm) || 5.0;
      const durSec = (parseInt(durationMin, 10) || 30) * 60;

      const payload = {
        type: 'run',
        title: plannedSession?.type ? `Corrida — ${plannedSession.type}` : 'Treino de Corrida',
        date: new Date().toISOString(),
        distance_km: dist,
        duration_seconds: durSec,
        avg_pace: `${avgPace}/km`,
        avg_hr: parseInt(avgHr, 10) || null,
        rpe_score: rpeScore,
        rpe: rpeScore,
        feeling_notes: feelingNotes,
        workout_rating: workoutRating,
        image_url: imageUrl || null,
        description: feelingNotes,
        privacy: shareOnFeed ? 'public' : 'private',
        session_id: plannedSession?.id || null,
      };

      await activities.create(payload);

      if (onSaved) {
        onSaved();
      }
      onClose();
    } catch (err) {
      console.error('Save post-workout error:', err);
      alert('Erro ao registrar treino: ' + (err.message || 'Tente novamente'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-card--post-workout" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="label-mono modal-label">№ 08 / FEEDBACK DO ATLETA</span>
            <h3 className="modal-title">Registrar Treino Concluído</h3>
          </div>
          <button className="btn-close-modal" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Métricas Principais */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <div>
              <label className="label-mono" style={{ fontSize: '0.65rem', display: 'block', marginBottom: 4 }}>
                DISTÂNCIA (KM)
              </label>
              <input
                type="number"
                step="0.1"
                value={distanceKm}
                onChange={(e) => setDistanceKm(e.target.value)}
                required
                className="input-field"
                style={{ fontFamily: 'var(--font-mono)', fontSize: '0.95rem', textAlign: 'center' }}
              />
            </div>

            <div>
              <label className="label-mono" style={{ fontSize: '0.65rem', display: 'block', marginBottom: 4 }}>
                TEMPO (MIN)
              </label>
              <input
                type="number"
                value={durationMin}
                onChange={(e) => setDurationMin(e.target.value)}
                required
                className="input-field"
                style={{ fontFamily: 'var(--font-mono)', fontSize: '0.95rem', textAlign: 'center' }}
              />
            </div>

            <div>
              <label className="label-mono" style={{ fontSize: '0.65rem', display: 'block', marginBottom: 4 }}>
                FC MÉDIA (BPM)
              </label>
              <input
                type="number"
                value={avgHr}
                onChange={(e) => setAvgHr(e.target.value)}
                className="input-field"
                style={{ fontFamily: 'var(--font-mono)', fontSize: '0.95rem', textAlign: 'center' }}
              />
            </div>
          </div>

          {/* Percepção de Esforço (RPE 1-10) */}
          <div>
            <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
              <label className="label-mono" style={{ fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Flame size={14} color="var(--color-primary)" /> PERCEPÇÃO DE ESFORÇO (RPE 1-10)
              </label>
              <span className="scoreboard" style={{ fontSize: '0.85rem', color: 'var(--color-primary)' }}>
                {RPE_LABELS[rpeScore]}
              </span>
            </div>

            <input
              type="range"
              min="1"
              max="10"
              value={rpeScore}
              onChange={(e) => setRpeScore(parseInt(e.target.value, 10))}
              style={{ width: '100%', accentColor: 'var(--color-primary)', cursor: 'pointer' }}
            />
          </div>

          {/* Como se sentiu? */}
          <div>
            <label className="label-mono" style={{ fontSize: '0.68rem', display: 'block', marginBottom: 4 }}>
              COMO VOCÊ SE SENTIU? (FEEDBACK PARA A IA)
            </label>
            <textarea
              rows="2"
              value={feelingNotes}
              onChange={(e) => setFeelingNotes(e.target.value)}
              placeholder="Ex: Ritmo fluiu solto, senti cansaço nos últimos 2km..."
              className="input-field"
              style={{ width: '100%', resize: 'none', fontSize: '0.8rem' }}
            />
          </div>

          {/* Avaliação por Estrelas */}
          <div>
            <label className="label-mono" style={{ fontSize: '0.68rem', display: 'block', marginBottom: 6 }}>
              AVALIAÇÃO DA SESSÃO
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  type="button"
                  key={star}
                  onClick={() => setWorkoutRating(star)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                  }}
                >
                  <Star
                    size={22}
                    fill={star <= workoutRating ? '#FFD700' : 'none'}
                    color={star <= workoutRating ? '#FFD700' : 'var(--text-tertiary)'}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Upload de Foto do Treino */}
          <div>
            <label className="label-mono" style={{ fontSize: '0.68rem', display: 'block', marginBottom: 6 }}>
              FOTO DO TREINO (FEED SOCIAL ESTILO INSTAGRAM)
            </label>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                padding: '12px',
                border: '1px dashed var(--border-color)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                background: 'rgba(255, 255, 255, 0.02)',
                color: 'var(--text-secondary)',
                fontSize: '0.8rem',
              }}
            >
              <Camera size={16} color="var(--color-primary)" />
              <span>{imageUrl ? '✅ Foto Selecionada (Trocar)' : 'Selecionar ou Tirar Foto'}</span>
              <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />
            </label>

            {imageUrl && (
              <div style={{ marginTop: 8, textAlign: 'center' }}>
                <img
                  src={imageUrl}
                  alt="Preview"
                  style={{
                    maxHeight: 120,
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-color)',
                    objectFit: 'cover',
                  }}
                />
              </div>
            )}
          </div>

          {/* Opção de Compartilhar no Feed */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '0.82rem' }}>
              <input
                type="checkbox"
                checked={shareOnFeed}
                onChange={(e) => setShareOnFeed(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: 'var(--color-primary)' }}
              />
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Share2 size={13} color="var(--color-primary)" /> Postar no Feed Público da Comunidade
              </span>
            </label>
          </div>

          {/* Botão Salvar */}
          <button
            type="submit"
            disabled={submitting}
            className="btn btn-primary"
            style={{ width: '100%', padding: '14px', fontSize: '0.9rem' }}
          >
            <Sparkles size={16} />
            <span>{submitting ? 'Gravando e Calibrando...' : 'Salvar Treino e Atualizar IA'}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
