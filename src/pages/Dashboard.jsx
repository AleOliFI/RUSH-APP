// ============================================================
// RUSH PERFORMANCE — Athlete Dashboard
// High-performance sports dashboard matching rushperformance.com.br
// ============================================================

import { useState, useEffect } from 'react';
import { hrv, training, activities, notifications } from '../api';
import { Zap, Bell, ChevronRight, Clock, MapPin, Heart, Activity, Flame, ShieldAlert, Sparkles } from 'lucide-react';

const STATUS_MAP = {
  favorable: {
    label: 'Favorável',
    color: 'var(--status-favorable)',
    bgClass: 'status-hero--favorable',
    badgeClass: 'status-badge--favorable',
    dotClass: 'live-dot--favorable',
    desc: 'Sistema parassimpático recuperado. O corpo está pronto para responder bem a cargas elevadas de treino.',
  },
  attention: {
    label: 'Atenção',
    color: 'var(--status-attention)',
    bgClass: 'status-hero--attention',
    badgeClass: 'status-badge--attention',
    dotClass: 'live-dot--attention',
    desc: 'Leve desvio da linha de base de 7 dias. Reduza o volume ou intensidade para evitar sobrecarga.',
  },
  recovery: {
    label: 'Recuperação',
    color: 'var(--status-recovery)',
    bgClass: 'status-hero--recovery',
    badgeClass: 'status-badge--recovery',
    dotClass: 'live-dot--recovery',
    desc: 'Desvio significativo da homeostase. Priorize descanso total ou rodagem regenerativa ativa.',
  },
};

const SESSION_TYPE_LABELS = {
  easy_run: '🏃 Rodagem Leve',
  interval: '⚡ Intervalado / Tiros',
  long_run: '🔥 Longão de Resistência',
  tempo: '💨 Tempo Run / Limiar',
  strength: '💪 Fortalecimento',
  recovery: '🧘 Regenerativo',
  test: '🎯 Teste de Desempenho',
  rest: '😴 Dia de Descanso',
};

export default function Dashboard({ user }) {
  const [status, setStatus] = useState(null);
  const [plan, setPlan] = useState(null);
  const [stats, setStats] = useState(null);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [hrvData, planData, statsData, notifData] = await Promise.all([
          hrv.status().catch(() => null),
          training.myPlan().catch(() => null),
          activities.stats(30).catch(() => null),
          notifications.unreadCount().catch(() => ({ unread_count: 0 })),
        ]);
        setStatus(hrvData);
        setPlan(planData);
        setStats(statsData);
        setUnread(notifData?.unread_count || 0);
      } catch (e) {
        console.error('Dashboard data fetch error:', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const s = status?.status;
  const statusInfo = s ? STATUS_MAP[s.status] || STATUS_MAP.favorable : null;

  if (loading) {
    return (
      <div className="page">
        <div className="top-bar">
          <div className="logo">
            <span className="logo-text">RUSH</span>
            <span className="logo-sub">SPORT<br />PERFORMANCE</span>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="skeleton" style={{ height: 180, borderRadius: 20 }} />
          <div className="skeleton" style={{ height: 140, borderRadius: 16 }} />
          <div className="skeleton" style={{ height: 110, borderRadius: 16 }} />
        </div>
      </div>
    );
  }

  const athleteName = user?.name?.split(' ')[0] || user?.username || 'Atleta';

  return (
    <div className="page">
      {/* Top Bar */}
      <div className="top-bar">
        <div className="logo">
          <span className="logo-text">RUSH</span>
          <span className="logo-sub">SPORT<br />PERFORMANCE</span>
        </div>
        <div className="top-actions">
          <button className="btn-icon" style={{ position: 'relative' }} aria-label="Notificações">
            <Bell size={18} />
            {unread > 0 && <span className="nav-badge">{unread > 9 ? '9+' : unread}</span>}
          </button>
        </div>
      </div>

      {/* Greeting Header */}
      <div style={{ marginBottom: 20 }}>
        <div className="flex items-center gap-sm mb-xs">
          <span className="label-mono">PAINEL DO ATLETA</span>
        </div>
        <h1 className="display-title">
          BOM DIA, <span className="text-gradient">{athleteName}</span>
        </h1>
      </div>

      {/* Status Hero Card (HRV & Readiness) */}
      {statusInfo ? (
        <div className={`status-hero ${statusInfo.bgClass}`} style={{ marginBottom: 24 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
            <div className="flex items-center gap-sm">
              <span className={`live-dot ${statusInfo.dotClass}`} />
              <span className="label-mono">№ 01 / STATUS DIÁRIO</span>
            </div>
            <span className={`status-badge ${statusInfo.badgeClass}`}>
              {statusInfo.label}
            </span>
          </div>

          <div className="flex items-center gap-lg" style={{ marginBottom: 16 }}>
            <div>
              <div className="scoreboard" style={{ fontSize: '2.6rem', lineHeight: 1, color: statusInfo.color }}>
                {status?.measurement?.rmssd_ms
                  ? Math.round(+status.measurement.rmssd_ms)
                  : status?.status?.lnrmssd
                  ? (+status.status.lnrmssd).toFixed(1)
                  : '--'}
              </div>
              <div className="label-mono" style={{ marginTop: 4 }}>
                {status?.measurement?.rmssd_ms ? 'RMSSD (ms)' : 'lnRMSSD'}
              </div>
            </div>

            <div style={{ borderLeft: '1px solid var(--border-secondary)', paddingLeft: 18, flex: 1 }}>
              <div className="scoreboard" style={{ fontSize: '1.6rem', color: 'var(--text-primary)' }}>
                {status?.measurement?.hr_rest_bpm ? Math.round(+status.measurement.hr_rest_bpm) : '--'}
                <span className="label-mono" style={{ fontSize: '0.75rem', marginLeft: 4 }}>BPM</span>
              </div>
              <div className="label-mono" style={{ marginTop: 4 }}>FC REPOUSO</div>
            </div>
          </div>

          <p className="text-body" style={{ fontSize: '0.82rem', lineHeight: 1.55 }}>
            {s.explanation_text || statusInfo.desc}
          </p>
        </div>
      ) : (
        <div className="card-surface" style={{ marginBottom: 24, textAlign: 'center', padding: '28px 20px' }}>
          <Heart size={32} color="var(--accent-primary)" style={{ margin: '0 auto 12px' }} />
          <p className="heading-md" style={{ marginBottom: 6 }}>REGISTRE SUA VFC HOJE</p>
          <p className="text-body" style={{ fontSize: '0.82rem', marginBottom: 16 }}>
            Monitore seu sistema nervoso autônomo ao acordar para calibrar seus treinos.
          </p>
          <button className="btn btn-primary btn-sm">
            <Sparkles size={14} /> Registrar VFC Matinal
          </button>
        </div>
      )}

      {/* Today's Workout Card */}
      {plan?.today_session ? (
        <div className="section">
          <div className="section-header">
            <div className="flex items-center gap-sm">
              <span className="label-mono">№ 02 / TREINO DO DIA</span>
            </div>
            <span className="label-mono" style={{ color: 'var(--accent-primary)' }}>
              SEMANA {plan.plan?.current_week || 1}
            </span>
          </div>

          <div className="workout-card">
            <div style={{ padding: '18px 20px 0' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                <span className="workout-type-badge">
                  {SESSION_TYPE_LABELS[plan.today_session.type] || plan.today_session.type}
                </span>
                {plan.today_session.target_hr_zone && (
                  <span className="label-mono" style={{ color: 'var(--accent-primary)', fontSize: '0.7rem' }}>
                    {plan.today_session.target_hr_zone}
                  </span>
                )}
              </div>
            </div>

            <div style={{ padding: '0 20px 20px' }}>
              <div className="workout-metrics">
                {plan.today_session.distance_km && (
                  <div className="workout-metric">
                    <div className="workout-metric-label">Distância</div>
                    <div className="workout-metric-value scoreboard">
                      {plan.today_session.distance_km} <span style={{ fontSize: '0.85rem' }}>KM</span>
                    </div>
                  </div>
                )}
                {plan.today_session.duration_min && (
                  <div className="workout-metric">
                    <div className="workout-metric-label">Duração</div>
                    <div className="workout-metric-value scoreboard">
                      {plan.today_session.duration_min} <span style={{ fontSize: '0.85rem' }}>MIN</span>
                    </div>
                  </div>
                )}
              </div>

              {plan.today_session.description && (
                <p className="text-body" style={{ marginTop: 14, fontSize: '0.82rem', lineHeight: 1.5 }}>
                  {plan.today_session.description}
                </p>
              )}

              {/* Agent recommendation banner */}
              {plan.daily_status && plan.daily_status.status !== 'favorable' && (
                <div
                  style={{
                    marginTop: 14,
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    background:
                      plan.daily_status.status === 'attention'
                        ? 'var(--status-attention-bg)'
                        : 'var(--status-recovery-bg)',
                    border: `1px solid ${
                      plan.daily_status.status === 'attention'
                        ? 'rgba(255, 184, 0, 0.3)'
                        : 'rgba(255, 59, 92, 0.3)'
                    }`,
                  }}
                >
                  <div className="flex items-center gap-sm" style={{ marginBottom: 4 }}>
                    <Zap
                      size={14}
                      color={
                        plan.daily_status.status === 'attention'
                          ? 'var(--status-attention)'
                          : 'var(--status-recovery)'
                      }
                    />
                    <span
                      className="label-mono"
                      style={{
                        color:
                          plan.daily_status.status === 'attention'
                            ? 'var(--status-attention)'
                            : 'var(--status-recovery)',
                        fontSize: '0.68rem',
                      }}
                    >
                      AGENTE RUSH — AJUSTE VFC
                    </span>
                  </div>
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
                    {plan.daily_status.suggested_action === 'reduce'
                      ? 'Status em Atenção: Sugerimos reduzir o volume ou intensidade deste treino.'
                      : 'Status em Recuperação: Recomendamos descanso total ou rodagem regenerativa leve.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* 30-Day Activity Stats */}
      {stats?.stats && (
        <div className="section">
          <div className="section-header">
            <span className="label-mono">№ 03 / RESUMO 30 DIAS</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            <div className="card-surface" style={{ padding: '14px 10px', textAlign: 'center' }}>
              <MapPin size={16} color="var(--accent-primary)" style={{ margin: '0 auto 6px' }} />
              <div className="scoreboard" style={{ fontSize: '1.35rem', color: 'var(--text-primary)' }}>
                {stats.stats.total_distance_km}
              </div>
              <div className="label-mono" style={{ fontSize: '0.62rem', marginTop: 2 }}>KM TOTAL</div>
            </div>

            <div className="card-surface" style={{ padding: '14px 10px', textAlign: 'center' }}>
              <Activity size={16} color="var(--accent-primary)" style={{ margin: '0 auto 6px' }} />
              <div className="scoreboard" style={{ fontSize: '1.35rem', color: 'var(--text-primary)' }}>
                {stats.stats.total_activities}
              </div>
              <div className="label-mono" style={{ fontSize: '0.62rem', marginTop: 2 }}>TREINOS</div>
            </div>

            <div className="card-surface" style={{ padding: '14px 10px', textAlign: 'center' }}>
              <Clock size={16} color="var(--accent-primary)" style={{ margin: '0 auto 6px' }} />
              <div className="scoreboard" style={{ fontSize: '1.35rem', color: 'var(--text-primary)' }}>
                {stats.stats.total_hours}
              </div>
              <div className="label-mono" style={{ fontSize: '0.62rem', marginTop: 2 }}>HORAS</div>
            </div>
          </div>
        </div>
      )}

      {/* Active Plan Progress & Week Strip */}
      {plan?.has_plan && plan.plan && (
        <div className="section">
          <div className="section-header">
            <span className="label-mono">№ 04 / PROGRESSO DO PLANO</span>
            <span className="label-mono" style={{ color: 'var(--accent-primary)' }}>
              {plan.plan.distance_km}K TARGET
            </span>
          </div>

          <div className="card-surface">
            <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
              <div>
                <p className="heading-sm text-gradient" style={{ letterSpacing: '0.02em' }}>
                  {plan.plan.name}
                </p>
                <p className="label-mono" style={{ fontSize: '0.68rem', marginTop: 2 }}>
                  NÍVEL {plan.plan.level?.toUpperCase()}
                </p>
              </div>
              <span className="display-massive text-gradient" style={{ fontSize: '2rem' }}>
                {plan.plan.distance_km}K
              </span>
            </div>

            <div className="flex items-center justify-between mb-sm">
              <span className="label-mono" style={{ fontSize: '0.68rem' }}>
                SEMANA {plan.plan.current_week} DE {plan.plan.duration_weeks}
              </span>
              <span className="scoreboard" style={{ color: 'var(--accent-primary)', fontSize: '0.85rem' }}>
                {Math.round((plan.plan.current_week / plan.plan.duration_weeks) * 100)}%
              </span>
            </div>

            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${(plan.plan.current_week / plan.plan.duration_weeks) * 100}%` }}
              />
            </div>

            {/* Week schedule strip */}
            {plan.week_sessions && plan.week_sessions.length > 0 && (
              <div style={{ marginTop: 16, display: 'flex', gap: 6 }}>
                {['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((day, i) => {
                  const session = plan.week_sessions.find((sess) => sess.day_of_week === i + 1);
                  const isToday = new Date().getDay() === (i === 6 ? 0 : i + 1);
                  return (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        textAlign: 'center',
                        padding: '8px 0',
                        borderRadius: 'var(--radius-xs)',
                        background: isToday
                          ? 'rgba(255, 56, 0, 0.15)'
                          : session
                          ? 'var(--bg-elevated)'
                          : 'transparent',
                        border: isToday
                          ? '1px solid rgba(255, 56, 0, 0.4)'
                          : '1px solid var(--border-primary)',
                      }}
                    >
                      <div
                        className="label-mono"
                        style={{
                          fontSize: '0.65rem',
                          color: isToday
                            ? 'var(--accent-primary)'
                            : session
                            ? 'var(--text-secondary)'
                            : 'var(--text-tertiary)',
                        }}
                      >
                        {day}
                      </div>
                      {session && (
                        <div
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: isToday ? 'var(--accent-primary)' : 'var(--text-secondary)',
                            margin: '5px auto 0',
                            boxShadow: isToday ? '0 0 6px var(--accent-primary)' : 'none',
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
