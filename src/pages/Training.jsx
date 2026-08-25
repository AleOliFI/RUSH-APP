// ============================================================
// RUSH PERFORMANCE — Training & Periodization
// Periodized workouts & 14-day HRV history matching rushperformance.com.br
// ============================================================

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { training, hrv } from '../api';
import { Calendar, Target, ChevronRight, Zap, Activity, Clock, Flame, ShieldAlert } from 'lucide-react';

const SESSION_EMOJIS = {
  easy_run: '🏃',
  interval: '⚡',
  long_run: '🔥',
  tempo: '💨',
  strength: '💪',
  recovery: '🧘',
  test: '🎯',
  rest: '😴',
  other: '📋',
};

const SESSION_LABELS = {
  easy_run: 'Rodagem Leve',
  interval: 'Treino Intervalado',
  long_run: 'Longão de Resistência',
  tempo: 'Tempo Run (Limiar)',
  strength: 'Treino de Força',
  recovery: 'Recuperação Ativa',
  test: 'Teste de Capacidade',
  rest: 'Descanso Total',
  other: 'Treino Programado',
};

const DAY_NAMES = ['', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

export default function Training({ user }) {
  const navigate = useNavigate();
  const [planData, setPlanData] = useState(null);
  const [hrvHistory, setHrvHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('plan');

  useEffect(() => {
    async function load() {
      try {
        const [p, h] = await Promise.all([
          training.myPlan().catch(() => null),
          hrv.history(14).catch(() => ({ statuses: [] })),
        ]);
        setPlanData(p);
        setHrvHistory(h?.statuses || []);
      } catch (e) {
        console.error('Training data loading error:', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="page">
        <div className="top-bar">
          <h1 className="heading-lg">Treino</h1>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="skeleton" style={{ height: 50, borderRadius: 12 }} />
          <div className="skeleton" style={{ height: 180, borderRadius: 16 }} />
          <div className="skeleton" style={{ height: 140, borderRadius: 16 }} />
        </div>
      </div>
    );
  }

  const currentDayOfWeek = new Date().getDay();
  const normalizedToday = currentDayOfWeek === 0 ? 7 : currentDayOfWeek;

  return (
    <div className="page">
      {/* Top Header */}
      <div className="top-bar">
        <div>
          <div className="flex items-center gap-sm">
            <span className="live-dot" />
            <span className="label-mono">№ 03 / PERIODIZAÇÃO VFC</span>
          </div>
          <h1 className="heading-lg">PROGRAMA DE TREINOS</h1>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        <button
          type="button"
          className={`tab${tab === 'plan' ? ' active' : ''}`}
          onClick={() => setTab('plan')}
        >
          Plano Ativo
        </button>
        <button
          type="button"
          className={`tab${tab === 'hrv' ? ' active' : ''}`}
          onClick={() => setTab('hrv')}
        >
          Histórico VFC (14d)
        </button>
      </div>

      {tab === 'plan' && (
        <>
          {!planData?.has_plan ? (
            <div className="empty-state">
              <div className="empty-state-icon">📋</div>
              <p className="heading-md" style={{ marginBottom: 6 }}>Nenhum plano ativo</p>
              <p className="empty-state-text" style={{ marginBottom: 20 }}>
                Configure seus objetivos para gerar uma periodização adaptativa guiada por VFC.
              </p>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => navigate('/onboarding')}
              >
                Gerar Meu Plano <ChevronRight size={16} />
              </button>
            </div>
          ) : (
            <>
              {/* Plan Hero Card */}
              <div className="card-surface" style={{ marginBottom: 24 }}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="label-mono" style={{ color: 'var(--accent-primary)', marginBottom: 2 }}>
                      FASE: {planData.plan.phase?.toUpperCase() || 'BASE AERÓBICA'}
                    </div>
                    <h2 className="heading-md">{planData.plan.name}</h2>
                  </div>
                  <span className="display-massive text-gradient" style={{ fontSize: '2.4rem' }}>
                    {planData.plan.distance_km}K
                  </span>
                </div>

                <div className="flex items-center justify-between mt-md mb-sm">
                  <span className="label-mono" style={{ fontSize: '0.7rem' }}>
                    <Calendar size={12} style={{ display: 'inline', verticalAlign: -2, marginRight: 4 }} />
                    Semana {planData.plan.current_week} de {planData.plan.duration_weeks}
                  </span>
                  <span className="scoreboard" style={{ fontSize: '0.85rem', color: 'var(--accent-primary)' }}>
                    {Math.round((planData.plan.current_week / planData.plan.duration_weeks) * 100)}%
                  </span>
                </div>

                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${(planData.plan.current_week / planData.plan.duration_weeks) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {/* Weekly Sessions List */}
              <div className="section">
                <div className="section-header">
                  <span className="label-mono">SESSÕES DA SEMANA</span>
                  <span className="label-mono" style={{ color: 'var(--accent-primary)' }}>
                    SEMANA {planData.plan.current_week}
                  </span>
                </div>

                {planData.week_sessions && planData.week_sessions.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {planData.week_sessions.map((session, i) => {
                      const isToday = session.day_of_week === normalizedToday;
                      return (
                        <div
                          key={i}
                          className="card"
                          style={{
                            padding: '16px 18px',
                            borderColor: isToday ? 'var(--accent-primary)' : undefined,
                            background: isToday
                              ? 'linear-gradient(155deg, rgba(255, 56, 0, 0.12) 0%, rgba(26, 26, 26, 0.95) 100%)'
                              : undefined,
                            boxShadow: isToday ? '0 0 20px rgba(255, 56, 0, 0.2)' : undefined,
                          }}
                        >
                          <div className="flex items-center gap-md">
                            <div
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: 'var(--radius-md)',
                                background: 'var(--bg-elevated)',
                                border: '1px solid var(--border-primary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '1.25rem',
                                flexShrink: 0,
                              }}
                            >
                              {SESSION_EMOJIS[session.type] || '📋'}
                            </div>

                            <div className="flex-1">
                              <div className="flex items-center gap-sm">
                                <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                                  {SESSION_LABELS[session.type] || session.type}
                                </span>
                                {isToday && (
                                  <span className="status-badge status-badge--favorable" style={{ padding: '2px 8px', fontSize: '0.62rem' }}>
                                    HOJE
                                  </span>
                                )}
                              </div>

                              <div className="label-mono" style={{ marginTop: 4, fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                                <strong style={{ color: 'var(--text-primary)' }}>{DAY_NAMES[session.day_of_week]}</strong>
                                {session.distance_km ? ` · ${session.distance_km} KM` : ''}
                                {session.duration_min ? ` · ${session.duration_min} MIN` : ''}
                                {session.target_hr_zone ? ` · ${session.target_hr_zone}` : ''}
                              </div>
                            </div>
                          </div>

                          {session.description && (
                            <p
                              className="text-body"
                              style={{
                                fontSize: '0.78rem',
                                marginTop: 10,
                                paddingLeft: 56,
                                lineHeight: 1.45,
                              }}
                            >
                              {session.description}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-body">Nenhuma sessão programada para esta semana.</p>
                )}
              </div>
            </>
          )}
        </>
      )}

      {tab === 'hrv' && (
        <div className="section">
          <div className="section-header">
            <span className="label-mono">HISTÓRICO DE VARIAÇÃO CARDÍACA</span>
            <span className="label-mono" style={{ color: 'var(--accent-primary)' }}>14 DIAS</span>
          </div>

          {/* Mini Chart */}
          {hrvHistory.length > 0 && (
            <div className="card-surface" style={{ marginBottom: 20 }}>
              <div className="mini-chart">
                {hrvHistory
                  .slice(0, 14)
                  .reverse()
                  .map((s, i) => (
                    <div
                      key={i}
                      className={`mini-chart-bar mini-chart-bar--${s.status}`}
                      style={{
                        height: `${Math.max(18, Math.min(100, ((+s.lnrmssd || 3) / 5) * 100))}%`,
                      }}
                      title={`${s.date}: ${s.status} (lnRMSSD: ${(+s.lnrmssd).toFixed(2)})`}
                    />
                  ))}
              </div>
              <div className="flex items-center justify-between mt-sm">
                <span className="label-mono" style={{ fontSize: '0.65rem' }}>14 DIAS ATRÁS</span>
                <span className="label-mono" style={{ fontSize: '0.65rem', color: 'var(--accent-primary)' }}>HOJE</span>
              </div>
            </div>
          )}

          {/* Daily Records List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {hrvHistory.length === 0 ? (
              <div className="empty-state">
                <p className="heading-sm">Sem medições recentes</p>
                <p className="empty-state-text">Realize sua medição diária de VFC para acompanhar o histórico.</p>
              </div>
            ) : (
              hrvHistory.slice(0, 14).map((s, i) => (
                <div key={i} className="card-surface" style={{ padding: '14px 16px' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-md">
                      <span className={`live-dot live-dot--${s.status}`} style={{ width: 9, height: 9 }} />
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>
                          {new Date(s.date + 'T12:00:00').toLocaleDateString('pt-BR', {
                            weekday: 'short',
                            day: '2-digit',
                            month: 'short',
                          })}
                        </div>
                        <div className="label-mono" style={{ fontSize: '0.68rem', marginTop: 2 }}>
                          {s.status === 'favorable'
                            ? 'Favorável'
                            : s.status === 'attention'
                            ? 'Atenção'
                            : 'Recuperação'}
                          {s.suggested_action ? ` · ${s.suggested_action.toUpperCase()}` : ''}
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div className="scoreboard" style={{ fontSize: '1.1rem', color: 'var(--text-primary)' }}>
                        {(+s.lnrmssd).toFixed(2)}
                      </div>
                      <div className="label-mono" style={{ fontSize: '0.62rem' }}>lnRMSSD</div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
