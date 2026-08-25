// ============================================================
// RUSH PERFORMANCE — Athlete Profile & Achievements
// Profile, 90-day statistics & achievements matching rushperformance.com.br
// ============================================================

import { useState, useEffect } from 'react';
import { users, challenges, activities, auth, clearAuth } from '../api';
import { LogOut, Activity, Clock, MapPin, Target, Trophy, Award, CheckCircle2, Shield } from 'lucide-react';

export default function Profile({ user, onLogout }) {
  const [profile, setProfile] = useState(null);
  const [earned, setEarned] = useState([]);
  const [allAch, setAllAch] = useState([]);
  const [stats, setStats] = useState(null);
  const [tab, setTab] = useState('stats');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [p, a, s] = await Promise.all([
          users.profile().catch(() => null),
          challenges.achievements().catch(() => ({ earned: [], all: [] })),
          activities.stats(90).catch(() => null),
        ]);
        setProfile(p);
        setEarned(a?.earned || []);
        setAllAch(a?.all || []);
        setStats(s);
      } catch (e) {
        console.error('Profile load error:', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

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
          style={{
            margin: '0 auto 12px',
            background: 'linear-gradient(135deg, #1c1c1c 0%, #292929 100%)',
          }}
        >
          <span className="text-gradient">{initials}</span>
        </div>

        <h2 className="heading-md" style={{ marginBottom: 2, color: 'var(--text-primary)' }}>
          {athleteName}
        </h2>
        <p className="label-mono" style={{ fontSize: '0.72rem', color: 'var(--accent-primary)' }}>
          @{athleteUsername}
        </p>

        {profile?.bio && (
          <p className="text-body" style={{ marginTop: 10, fontSize: '0.82rem', lineHeight: 1.45 }}>
            {profile.bio}
          </p>
        )}

        {/* Stats Row */}
        <div className="profile-stats">
          <div className="profile-stat">
            <div className="profile-stat-value scoreboard">{profile?.stats?.followers || 0}</div>
            <div className="profile-stat-label">Seguidores</div>
          </div>
          <div className="profile-stat">
            <div className="profile-stat-value scoreboard">{profile?.stats?.following || 0}</div>
            <div className="profile-stat-label">Seguindo</div>
          </div>
          <div className="profile-stat">
            <div className="profile-stat-value scoreboard">{profile?.stats?.activities || 0}</div>
            <div className="profile-stat-label">Atividades</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          type="button"
          className={`tab${tab === 'stats' ? ' active' : ''}`}
          onClick={() => setTab('stats')}
        >
          Estatísticas (90d)
        </button>
        <button
          type="button"
          className={`tab${tab === 'achievements' ? ' active' : ''}`}
          onClick={() => setTab('achievements')}
        >
          Conquistas ({earned.length})
        </button>
      </div>

      {tab === 'stats' && stats?.stats && (
        <>
          {/* Big Number Mileage Banner */}
          <div className="card-surface" style={{ marginBottom: 18, textAlign: 'center', padding: '24px 18px' }}>
            <div
              className="display-massive text-gradient"
              style={{ fontSize: '3.6rem', lineHeight: 0.95 }}
            >
              {stats.stats.total_distance_km}
            </div>
            <div className="label-mono" style={{ marginTop: 6, color: 'var(--text-secondary)' }}>
              KM NOS ÚLTIMOS 90 DIAS
            </div>
          </div>

          {/* 2x2 Stats Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
            <div className="card" style={{ padding: '16px 14px' }}>
              <Activity size={16} color="var(--accent-primary)" style={{ marginBottom: 6 }} />
              <div className="scoreboard" style={{ fontSize: '1.4rem', color: 'var(--text-primary)' }}>
                {stats.stats.total_activities}
              </div>
              <div className="label-mono" style={{ fontSize: '0.65rem', marginTop: 2 }}>ATIVIDADES</div>
            </div>

            <div className="card" style={{ padding: '16px 14px' }}>
              <Clock size={16} color="var(--accent-primary)" style={{ marginBottom: 6 }} />
              <div className="scoreboard" style={{ fontSize: '1.4rem', color: 'var(--text-primary)' }}>
                {stats.stats.total_hours} <span style={{ fontSize: '0.8rem' }}>H</span>
              </div>
              <div className="label-mono" style={{ fontSize: '0.65rem', marginTop: 2 }}>TEMPO TOTAL</div>
            </div>

            <div className="card" style={{ padding: '16px 14px' }}>
              <MapPin size={16} color="var(--accent-primary)" style={{ marginBottom: 6 }} />
              <div className="scoreboard" style={{ fontSize: '1.4rem', color: 'var(--text-primary)' }}>
                {stats.stats.avg_distance_km} <span style={{ fontSize: '0.8rem' }}>KM</span>
              </div>
              <div className="label-mono" style={{ fontSize: '0.65rem', marginTop: 2 }}>KM MÉDIO</div>
            </div>

            <div className="card" style={{ padding: '16px 14px' }}>
              <Target size={16} color="var(--accent-primary)" style={{ marginBottom: 6 }} />
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
    </div>
  );
}
