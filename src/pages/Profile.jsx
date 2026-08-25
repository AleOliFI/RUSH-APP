// ============================================================
// RUSH PERFORMANCE — Athlete Profile & Achievements
// Profile, 90-day statistics, achievements & menstrual cycle settings
// ============================================================

import { useState, useEffect } from 'react';
import { users, challenges, activities, auth, clearAuth, menstrual } from '../api';
import { 
  LogOut, Activity, Clock, MapPin, Target, Trophy, Award, 
  CheckCircle2, Shield, Heart, Sparkles, Check, Info 
} from 'lucide-react';

export default function Profile({ user, onLogout }) {
  const [profile, setProfile] = useState(null);
  const [earned, setEarned] = useState([]);
  const [allAch, setAllAch] = useState([]);
  const [stats, setStats] = useState(null);
  const [tab, setTab] = useState('stats');
  const [loading, setLoading] = useState(true);

  // Menstrual Profile State
  const [lmpDate, setLmpDate] = useState('');
  const [cycleLength, setCycleLength] = useState('28');
  const [usesContraceptive, setUsesContraceptive] = useState(false);
  const [contraceptiveType, setContraceptiveType] = useState('');
  const [savingMenstrual, setSavingMenstrual] = useState(false);
  const [menstrualSuccess, setMenstrualSuccess] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [p, a, s, m] = await Promise.all([
          users.profile().catch(() => null),
          challenges.achievements().catch(() => ({ earned: [], all: [] })),
          activities.stats(90).catch(() => null),
          menstrual.getProfile().catch(() => null),
        ]);
        setProfile(p);
        setEarned(a?.earned || []);
        setAllAch(a?.all || []);
        setStats(s);

        if (m?.profile) {
          setLmpDate(m.profile.lmp_date || '');
          setCycleLength(String(m.profile.cycle_length_days || 28));
          setUsesContraceptive(!!m.profile.uses_hormonal_contraceptive);
          setContraceptiveType(m.profile.contraceptive_type || '');
        }
      } catch (e) {
        console.error('Profile load error:', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSaveMenstrual = async (e) => {
    e.preventDefault();
    if (!lmpDate) {
      alert('Por favor informe a data de início do último período.');
      return;
    }

    setSavingMenstrual(true);
    try {
      await menstrual.saveProfile({
        lmp_date: lmpDate,
        cycle_length_days: parseInt(cycleLength, 10) || 28,
        uses_hormonal_contraceptive: usesContraceptive,
        contraceptive_type: contraceptiveType || null,
      });
      setMenstrualSuccess(true);
      setTimeout(() => setMenstrualSuccess(false), 2000);
    } catch (err) {
      console.error('Erro ao salvar perfil menstrual:', err);
      alert('Erro ao salvar: ' + (err.message || 'Tente novamente'));
    } finally {
      setSavingMenstrual(false);
    }
  };

  const handleLogout = async () => {
    try {
      await auth.logout();
    } catch (e) {
      // Ignore network errors on logout
    }
    clearAuth();
    if (onLogout) {
      onLogout();
    } else {
      window.location.href = '/login';
    }
  };

  if (loading) {
    return (
      <div className="page">
        <div className="top-bar">
          <h1 className="heading-lg">Perfil</h1>
        </div>
        <div className="skeleton" style={{ height: 220, borderRadius: 20 }} />
      </div>
    );
  }

  const athleteName = profile?.name || user?.name || 'Atleta Rush';
  const athleteUsername = profile?.username || user?.username || 'atleta';
  const initials =
    athleteName
      .split(' ')
      .filter(Boolean)
      .map((n) => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase() || 'RU';

  return (
    <div className="page">
      {/* Top Bar */}
      <div className="top-bar">
        <div>
          <div className="flex items-center gap-sm">
            <span className="live-dot" />
            <span className="label-mono">№ 04 / PERFIL DO ATLETA</span>
          </div>
          <h1 className="heading-lg">MEU PERFIL</h1>
        </div>
        <button
          type="button"
          className="btn-icon"
          onClick={handleLogout}
          title="Encerrar Sessão"
          aria-label="Sair da conta"
        >
          <LogOut size={18} />
        </button>
      </div>

      {/* Athlete Header Card */}
      <div className="card-surface" style={{ marginBottom: 20, textAlign: 'center', padding: '24px 20px' }}>
        <div
          className="avatar avatar-lg orange-glow"
          style={{ margin: '0 auto 12px', fontSize: '1.4rem' }}
        >
          {initials}
        </div>
        <h2 className="heading-md" style={{ marginBottom: 4 }}>
          {athleteName}
        </h2>
        <p className="label-mono" style={{ color: 'var(--accent-primary)', marginBottom: 8 }}>
          @{athleteUsername}
        </p>
        {profile?.bio && (
          <p className="text-body" style={{ fontSize: '0.82rem', marginBottom: 12 }}>
            {profile.bio}
          </p>
        )}

        <div className="flex items-center justify-center gap-md" style={{ marginTop: 8 }}>
          {profile?.location && (
            <div className="flex items-center gap-xs text-small">
              <MapPin size={12} color="var(--accent-primary)" />
              <span>{profile.location}</span>
            </div>
          )}
          {profile?.weight_kg && (
            <div className="flex items-center gap-xs text-small">
              <Activity size={12} color="var(--accent-primary)" />
              <span>{profile.weight_kg} kg</span>
            </div>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="tab-pill-group" style={{ marginBottom: 20 }}>
        <button
          type="button"
          className={`tab-pill ${tab === 'stats' ? 'tab-pill--active' : ''}`}
          onClick={() => setTab('stats')}
        >
          Estatísticas (90d)
        </button>
        <button
          type="button"
          className={`tab-pill ${tab === 'achievements' ? 'tab-pill--active' : ''}`}
          onClick={() => setTab('achievements')}
        >
          Conquistas ({earned.length})
        </button>
        <button
          type="button"
          className={`tab-pill ${tab === 'menstrual' ? 'tab-pill--active' : ''}`}
          onClick={() => setTab('menstrual')}
        >
          Ciclo Hormonal
        </button>
      </div>

      {/* TAB 1: Statistics */}
      {tab === 'stats' && stats?.stats && (
        <>
          <div className="stats-grid profile-stats" style={{ marginBottom: 20 }}>
            <div className="card-surface stat-box">
              <div className="scoreboard" style={{ fontSize: '1.8rem', color: 'var(--accent-primary)' }}>
                {(+stats.stats.total_distance_km).toFixed(1)}
              </div>
              <div className="label-mono" style={{ fontSize: '0.65rem', marginTop: 4 }}>KM TOTAIS</div>
            </div>

            <div className="card-surface stat-box">
              <div className="scoreboard" style={{ fontSize: '1.8rem', color: 'var(--text-primary)' }}>
                {stats.stats.total_activities}
              </div>
              <div className="label-mono" style={{ fontSize: '0.65rem', marginTop: 4 }}>ATIVIDADES</div>
            </div>

            <div className="card-surface stat-box">
              <div className="scoreboard" style={{ fontSize: '1.4rem', color: 'var(--status-favorable)' }}>
                {stats.stats.avg_pace || '--:--'}
              </div>
              <div className="label-mono" style={{ fontSize: '0.65rem', marginTop: 2 }}>PACE MÉDIO /KM</div>
            </div>

            <div className="card-surface stat-box">
              <div className="scoreboard" style={{ fontSize: '1.4rem', color: 'var(--text-primary)' }}>
                {stats.stats.max_distance_km} <span style={{ fontSize: '0.8rem' }}>KM</span>
              </div>
              <div className="label-mono" style={{ fontSize: '0.65rem', marginTop: 2 }}>MAIOR CORRIDA</div>
            </div>
          </div>

          {/* Breakdown by Activity Type */}
          {stats.by_type && stats.by_type.length > 0 && (
            <div className="section">
              <div className="section-header">
                <span className="label-mono">DISTRIBUIÇÃO POR MODALIDADE</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {stats.by_type.map((t, i) => (
                  <div key={i} className="card-surface" style={{ padding: '12px 16px' }}>
                    <div className="flex items-center justify-between">
                      <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>
                        {t.type === 'run' ? '🏃 Corrida de Rua' : t.type === 'interval' ? '⚡ Intervalado' : t.type}
                      </span>
                      <div style={{ textAlign: 'right' }}>
                        <span className="scoreboard" style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                          {(+t.total_km).toFixed(1)} KM
                        </span>
                        <span className="label-mono" style={{ marginLeft: 8, fontSize: '0.65rem' }}>
                          {t.count}x
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* TAB 2: Achievements */}
      {tab === 'achievements' && (
        <div className="section">
          {/* Progress bar */}
          <div className="card-surface" style={{ marginBottom: 18, padding: '16px 18px' }}>
            <div className="flex items-center justify-between mb-sm">
              <span className="label-mono">PROGRESSO DE CONQUISTAS</span>
              <span className="scoreboard" style={{ color: 'var(--status-favorable)', fontSize: '0.85rem' }}>
                {earned.length} / {Math.max(allAch.length, 1)}
              </span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill--green"
                style={{
                  width: `${(earned.length / Math.max(allAch.length, 1)) * 100}%`,
                }}
              />
            </div>
          </div>

          {/* Badges List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {allAch.length === 0 ? (
              <div className="empty-state">
                <Trophy size={32} color="var(--accent-primary)" style={{ margin: '0 auto 10px' }} />
                <p className="heading-sm">Conquistas em breve</p>
                <p className="empty-state-text">Continue treinando para liberar insígnias exclusivas.</p>
              </div>
            ) : (
              allAch.map((ach) => {
                const isEarned = earned.some((e) => e.id === ach.id);
                const earnedData = earned.find((e) => e.id === ach.id);
                return (
                  <div
                    key={ach.id}
                    className="achievement-card"
                    style={{
                      opacity: isEarned ? 1 : 0.45,
                      borderColor: isEarned ? 'rgba(0, 214, 143, 0.25)' : undefined,
                    }}
                  >
                    <div
                      className={`achievement-icon ${
                        isEarned ? 'achievement-icon--earned' : 'achievement-icon--locked'
                      }`}
                    >
                      {ach.icon || '🏆'}
                    </div>

                    <div className="flex-1">
                      <div className="flex items-center gap-sm">
                        <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                          {ach.name}
                        </span>
                        {isEarned && (
                          <CheckCircle2 size={14} color="var(--status-favorable)" />
                        )}
                      </div>
                      <div className="text-small" style={{ marginTop: 2, fontSize: '0.78rem' }}>
                        {ach.description}
                      </div>
                      {earnedData && (
                        <div
                          className="label-mono"
                          style={{
                            marginTop: 4,
                            fontSize: '0.65rem',
                            color: 'var(--status-favorable)',
                          }}
                        >
                          DESBLOQUEADO EM {new Date(earnedData.earned_at).toLocaleDateString('pt-BR')}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* TAB 3: Menstrual Cycle Settings */}
      {tab === 'menstrual' && (
        <div className="section">
          <div className="card-surface" style={{ padding: '20px' }}>
            <div className="flex items-center gap-sm" style={{ marginBottom: 12 }}>
              <Heart size={20} color="var(--accent-primary)" />
              <h3 className="heading-md" style={{ margin: 0 }}>Fisiologia & Ciclo Menstrual</h3>
            </div>
            <p className="text-body" style={{ fontSize: '0.82rem', marginBottom: 18, lineHeight: 1.5 }}>
              O cérebro do RUSH App calibra sua VFC e ajusta seus treinos para cada fase (folicular, ovulatória, lútea e menstrual), garantindo que quedas naturais de VFC na fase lútea não sejam confundidas com sobretreino.
            </p>

            <form onSubmit={handleSaveMenstrual} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label className="label-mono" style={{ fontSize: '0.7rem', display: 'block', marginBottom: 6 }}>
                  INÍCIO DO ÚLTIMO PERÍODO (LMP)
                </label>
                <input
                  type="date"
                  value={lmpDate}
                  onChange={(e) => setLmpDate(e.target.value)}
                  required
                  className="input-field"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label className="label-mono" style={{ fontSize: '0.7rem', display: 'block', marginBottom: 6 }}>
                  DURAÇÃO MÉDIA DO CICLO (DIAS)
                </label>
                <input
                  type="number"
                  min="21"
                  max="35"
                  value={cycleLength}
                  onChange={(e) => setCycleLength(e.target.value)}
                  required
                  className="input-field"
                  style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                />
                <span style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)', marginTop: 2, display: 'block' }}>
                  Padrão comum: 28 dias (faixa normal 21 a 35 dias)
                </span>
              </div>

              <div style={{ marginTop: 6 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={usesContraceptive}
                    onChange={(e) => setUsesContraceptive(e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: 'var(--accent-primary)' }}
                  />
                  <span>Uso contraceptivo hormonal (pílula, DIU hormonal, implante)</span>
                </label>
              </div>

              {usesContraceptive && (
                <div style={{ animation: 'fadeIn 0.2s ease-in-out' }}>
                  <label className="label-mono" style={{ fontSize: '0.7rem', display: 'block', marginBottom: 6 }}>
                    TIPO DE CONTRACEPTIVO (OPCIONAL)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Pílula combinada, DIU Mirena"
                    value={contraceptiveType}
                    onChange={(e) => setContraceptiveType(e.target.value)}
                    className="input-field"
                    style={{ width: '100%' }}
                  />
                </div>
              )}

              <div className="zones-science-tip" style={{ marginTop: 6 }}>
                <Info size={14} style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />
                <span>
                  <strong>Nota Científica:</strong> Contraceptivos hormonais reduzem as oscilações naturais de VFC entre fases. O algoritmo ajustará o peso da fase de acordo.
                </span>
              </div>

              <button
                type="submit"
                disabled={savingMenstrual}
                className="btn btn-primary"
                style={{ marginTop: 10, width: '100%', padding: '12px' }}
              >
                {menstrualSuccess ? (
                  <>
                    <Check size={16} /> Salvo com Sucesso!
                  </>
                ) : (
                  <>
                    <Sparkles size={16} /> {savingMenstrual ? 'Salvando...' : 'Salvar Configuração do Ciclo'}
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
