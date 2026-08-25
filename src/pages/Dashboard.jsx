import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { hrv, training, activities, notifications, menstrual } from '../api';
import { 
  Zap, Bell, ChevronRight, Clock, MapPin, Heart, Activity, 
  Flame, ShieldAlert, Sparkles, X, CheckCircle2, Sliders, Moon, Battery, 
  AlertTriangle, Smile, Play, Award, Check, Target, Camera, Shield, Calendar, ArrowRight
} from 'lucide-react';
import RecoveryAlert from '../components/RecoveryAlert';
import CyclePhaseCard from '../components/CyclePhaseCard';
import HeartRateZonesModal from '../components/HeartRateZonesModal';
import CameraHrvMonitor from '../components/CameraHrvMonitor';
import WarmupGuideModal from '../components/WarmupGuideModal';
import FieldTestModal from '../components/FieldTestModal';
import PostWorkoutModal from '../components/PostWorkoutModal';

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
    desc: 'Leve desvio da baseline. Reduza o volume ou intensidade para evitar sobrecarga.',
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
  easy_run: '🏃 Rodagem Leve (Z2)',
  interval: '⚡ Intervalado / Tiros (Z4-Z5)',
  long_run: '🔥 Longão de Resistência (Z2)',
  tempo: '💨 Tempo Run / Limiar (Z3-Z4)',
  strength: '💪 Fortalecimento Funcional',
  recovery: '🧘 Regenerativo Ativo (Z1)',
  test: '🎯 Teste de Desempenho (VO₂)',
  rest: '😴 Descanso Total',
};

export default function Dashboard({ user }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState(null);
  const [plan, setPlan] = useState(null);
  const [stats, setStats] = useState(null);
  const [unread, setUnread] = useState(0);
  const [zonesData, setZonesData] = useState(null);
  const [cycleData, setCycleData] = useState(null);
  const [isZonesModalOpen, setIsZonesModalOpen] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [isWarmupModalOpen, setIsWarmupModalOpen] = useState(false);
  const [isFieldTestModalOpen, setIsFieldTestModalOpen] = useState(false);
  const [isPostWorkoutModalOpen, setIsPostWorkoutModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  // Morning Measurement Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [rmssd, setRmssd] = useState('65');
  const [hrRest, setHrRest] = useState('52');
  const [sleep, setSleep] = useState(4);
  const [fatigue, setFatigue] = useState(2);
  const [soreness, setSoreness] = useState(2);
  const [stress, setStress] = useState(2);
  const [submitting, setSubmitting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Workout Action state
  const [workoutCompleted, setWorkoutCompleted] = useState(false);

  const loadDashboardData = async () => {
    try {
      const [hrvData, planData, statsData, notifData, zonesInfo, cycleInfo] = await Promise.all([
        hrv.status().catch(() => null),
        training.myPlan().catch(() => null),
        activities.stats(30).catch(() => null),
        notifications.unreadCount().catch(() => ({ unread_count: 0 })),
        hrv.zones().catch(() => null),
        menstrual.today().catch(() => null),
      ]);
      setStatus(hrvData);
      setPlan(planData);
      setStats(statsData);
      setUnread(notifData?.unread_count || 0);
      setZonesData(zonesInfo);
      setCycleData(cycleInfo);
    } catch (e) {
      console.error('Dashboard data fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleSaveMeasurement = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      // 1. Enviar Medição de VFC (RMSSD e FC Repouso)
      await hrv.measure({
        rmssd_ms: parseFloat(rmssd),
        hr_rest_bpm: parseInt(hrRest, 10),
        duration_seconds: 60,
      });

      // 2. Enviar Avaliação de Bem-Estar Matinal (Hooper-Mackinnon)
      await hrv.wellness({
        sleep: parseInt(sleep, 10),
        fatigue: parseInt(fatigue, 10),
        soreness: parseInt(soreness, 10),
        stress: parseInt(stress, 10),
        readiness: Math.max(1, Math.min(5, Math.round((sleep + (6 - fatigue) + (6 - soreness) + (6 - stress)) / 4))),
      });

      // 3. Recarregar dados para refletir calibração instantânea do treino
      await loadDashboardData();

      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        setIsModalOpen(false);
      }, 1200);
    } catch (err) {
      console.error('Erro ao salvar medição matinal:', err);
      alert('Erro ao registrar medição: ' + (err.message || 'Tente novamente'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCompleteWorkout = async (session) => {
    try {
      await activities.create({
        type: 'running',
        title: session?.type ? (SESSION_TYPE_LABELS[session.type] || 'Treino Concluído') : 'Corrida Matinal',
        distance_km: session?.distance_km || 5,
        duration_seconds: (session?.duration_min || 30) * 60,
        hr_avg_bpm: 145,
        hr_max_bpm: 168,
        perceived_effort: 7,
        notes: `Treino do dia concluído com base no status VFC: ${statusInfo?.label || 'Normal'}`,
      });
      setWorkoutCompleted(true);
      await loadDashboardData();
    } catch (err) {
      console.error('Erro ao registrar treino:', err);
    }
  };

  const s = status?.status;
  const statusInfo = s ? STATUS_MAP[s.status] || STATUS_MAP.favorable : null;

  // Determinar o treino programado de hoje
  const effectiveSession = plan?.today_session || (s ? {
    type: s.status === 'recovery' ? 'recovery' : s.status === 'attention' ? 'easy_run' : 'interval',
    distance_km: s.status === 'recovery' ? 3.5 : s.status === 'attention' ? 6.0 : 8.5,
    duration_min: s.status === 'recovery' ? 25 : s.status === 'attention' ? 40 : 50,
    target_hr_zone: s.status === 'recovery' ? 'Z1' : s.status === 'attention' ? 'Z2' : 'Z4-Z5',
    description: s.status === 'recovery' 
      ? 'Caminhada leve ou rodagem muito regenerativa para restabelecer o equilíbrio autonômico.'
      : s.status === 'attention'
      ? 'Rodagem aeróbica contínua em Zona 2. Volume moderado para manter a base sem acumular fadiga.'
      : 'Aquecimento 15 min Z2 + 6x 400m em Z5 com 90s de recuperação ativa + 10 min volta à calma.',
  } : null);

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
          <button 
            onClick={() => setIsModalOpen(true)}
            className="btn btn-secondary btn-sm"
            style={{ padding: '6px 12px', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <Sparkles size={13} color="var(--accent-primary)" />
            <span>Medição Matinal</span>
          </button>
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

      {/* Recovery Alert / Overreaching Warning Banner */}
      <RecoveryAlert 
        consecutiveLowDays={status?.measurement?.consecutive_low_days || (s?.status === 'recovery' ? 2 : 0)}
        recoveryLevel={status?.suggestion?.recovery_level}
      />

      {/* Menstrual Cycle Phase Card (Female Athletes) */}
      {cycleData?.has_profile && (
        <CyclePhaseCard 
          cycleData={cycleData} 
          onOpenTracking={() => navigate('/profile')} 
        />
      )}

      {/* Status Hero Card (HRV & Readiness) */}
      {statusInfo ? (
        <div className={`status-hero ${statusInfo.bgClass}`} style={{ marginBottom: 24 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
            <div className="flex items-center gap-sm">
              <span className={`live-dot ${statusInfo.dotClass}`} />
              <span className="label-mono">№ 01 / STATUS DIÁRIO</span>
            </div>
            <div className="flex items-center gap-sm">
              <button
                onClick={() => setIsZonesModalOpen(true)}
                title="Visualizar zonas individualizadas de FC"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 'var(--radius-xs)',
                  color: 'var(--color-primary)',
                  padding: '3px 8px',
                  fontSize: '0.65rem',
                  fontFamily: 'var(--font-mono)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4
                }}
              >
                <Target size={11} /> ZONAS Z1-Z5
              </button>
              <span className={`status-badge ${statusInfo.badgeClass}`}>
                {statusInfo.label}
              </span>
              <button
                onClick={() => setIsModalOpen(true)}
                title="Atualizar medição de hoje"
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 'var(--radius-xs)',
                  color: 'var(--text-secondary)',
                  padding: '3px 8px',
                  fontSize: '0.65rem',
                  fontFamily: 'var(--font-mono)',
                  cursor: 'pointer'
                }}
              >
                EDITAR
              </button>
            </div>
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

          <div style={{ marginTop: 14, display: 'flex', gap: 8 }}>
            <button
              onClick={() => setIsCameraModalOpen(true)}
              className="btn btn-secondary btn-sm"
              style={{ flex: 1, fontSize: '0.72rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              <Camera size={13} color="var(--color-primary)" />
              <span>Medir com Câmera (PPG)</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="card-surface" style={{ marginBottom: 24, textAlign: 'center', padding: '28px 20px' }}>
          <Heart size={32} color="var(--accent-primary)" style={{ margin: '0 auto 12px' }} />
          <p className="heading-md" style={{ marginBottom: 6 }}>REGISTRE SUA VFC HOJE</p>
          <p className="text-body" style={{ fontSize: '0.82rem', marginBottom: 16 }}>
            Monitore seu sistema nervoso autônomo ao acordar para calibrar seus treinos.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button onClick={() => setIsCameraModalOpen(true)} className="btn btn-primary btn-sm">
              <Camera size={14} /> Medir com Câmera (60s)
            </button>
            <button onClick={() => setIsModalOpen(true)} className="btn btn-secondary btn-sm">
              <Sparkles size={14} /> Digitar Dados
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TODAY'S PROGRAMMED WORKOUT CARD                              */}
      {/* ============================================================ */}
      {effectiveSession ? (
        <div className="section">
          <div className="section-header">
            <div className="flex items-center gap-sm">
              <span className="label-mono">№ 02 / TREINO PROGRAMADO DE HOJE</span>
            </div>
            <span className="label-mono" style={{ color: 'var(--accent-primary)' }}>
              {plan?.plan?.name ? `SEMANA ${plan.plan.current_week || 1}` : 'RECOMENDAÇÃO DO DIA'}
            </span>
          </div>

          <div className="workout-card">
            <div style={{ padding: '18px 20px 0' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
                <span className="workout-type-badge">
                  {SESSION_TYPE_LABELS[effectiveSession.type] || effectiveSession.type}
                </span>
                {effectiveSession.target_hr_zone && (
                  <span className="label-mono" style={{ color: 'var(--accent-primary)', fontSize: '0.75rem', fontWeight: 'bold' }}>
                    ZONA ALVO: {effectiveSession.target_hr_zone}
                  </span>
                )}
              </div>
            </div>

            <div style={{ padding: '0 20px 20px' }}>
              <div className="workout-metrics">
                {effectiveSession.distance_km && (
                  <div className="workout-metric">
                    <div className="workout-metric-label">Distância Prevista</div>
                    <div className="workout-metric-value scoreboard">
                      {effectiveSession.distance_km} <span style={{ fontSize: '0.85rem' }}>KM</span>
                    </div>
                  </div>
                )}
                {effectiveSession.duration_min && (
                  <div className="workout-metric">
                    <div className="workout-metric-label">Duração Estimada</div>
                    <div className="workout-metric-value scoreboard">
                      {effectiveSession.duration_min} <span style={{ fontSize: '0.85rem' }}>MIN</span>
                    </div>
                  </div>
                )}
              </div>

              {effectiveSession.description && (
                <div style={{ marginTop: 14, padding: '12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', borderLeft: '3px solid var(--accent-primary)' }}>
                  <span className="label-mono" style={{ fontSize: '0.65rem', display: 'block', marginBottom: 4, color: 'var(--text-secondary)' }}>
                    ESTRUTURA DA SESSÃO:
                  </span>
                  <p className="text-body" style={{ fontSize: '0.82rem', lineHeight: 1.5, color: 'var(--text-primary)' }}>
                    {effectiveSession.description}
                  </p>
                </div>
              )}

              {/* Scientific Tools Quick Actions */}
              <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <button
                  type="button"
                  onClick={() => setIsWarmupModalOpen(true)}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.7rem', padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <Shield size={13} color="var(--color-primary)" />
                  <span>Aquecimento & Drills</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsFieldTestModalOpen(true)}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.7rem', padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                >
                  <Target size={13} color="var(--color-primary)" />
                  <span>Teste de Zonas</span>
                </button>
              </div>

              {/* Agent recommendation banner */}
              {s && s.status !== 'favorable' && (
                <div
                  style={{
                    marginTop: 14,
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-md)',
                    background:
                      s.status === 'attention'
                        ? 'var(--status-attention-bg)'
                        : 'var(--status-recovery-bg)',
                    border: `1px solid ${
                      s.status === 'attention'
                        ? 'rgba(255, 184, 0, 0.3)'
                        : 'rgba(255, 59, 92, 0.3)'
                    }`,
                  }}
                >
                  <div className="flex items-center gap-sm" style={{ marginBottom: 4 }}>
                    <Zap
                      size={14}
                      color={
                        s.status === 'attention'
                          ? 'var(--status-attention)'
                          : 'var(--status-recovery)'
                      }
                    />
                    <span
                      className="label-mono"
                      style={{
                        color:
                          s.status === 'attention'
                            ? 'var(--status-attention)'
                            : 'var(--status-recovery)',
                        fontSize: '0.68rem',
                      }}
                    >
                      ADAPTAÇÃO AUTOMÁTICA PELA VFC
                    </span>
                  </div>
                  <p className="text-body" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {s.explanation_text}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
                {workoutCompleted ? (
                  <div 
                    style={{ 
                      flex: 1, 
                      padding: '12px', 
                      background: 'rgba(0, 214, 143, 0.15)', 
                      border: '1px solid var(--status-favorable)', 
                      borderRadius: 'var(--radius-md)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      color: 'var(--status-favorable)',
                      fontWeight: 'bold',
                      fontSize: '0.85rem'
                    }}
                  >
                    <Check size={16} /> Treino de Hoje Concluído!
                  </div>
                ) : (
                  <button 
                    onClick={() => setIsPostWorkoutModalOpen(true)}
                    className="btn btn-primary"
                    style={{ flex: 1, padding: '12px', fontSize: '0.85rem' }}
                  >
                    <Check size={16} /> Concluir & Registrar Treino (RPE)
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="card-surface" style={{ padding: '20px', marginBottom: 24 }}>
          <div className="flex items-center justify-between">
            <div>
              <p className="heading-sm">SEM TREINO AGENDADO</p>
              <p className="text-body" style={{ fontSize: '0.82rem', marginTop: 4 }}>
                Faça sua medição matinal para gerar o treino ideal de hoje.
              </p>
            </div>
            <button onClick={() => setIsModalOpen(true)} className="btn btn-primary btn-sm">
              <Sparkles size={14} /> Gerar Treino
            </button>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* TOMORROW'S WORKOUT PREVIEW                                   */}
      {/* ============================================================ */}
      <div className="section">
        <div className="section-header">
          <div className="flex items-center gap-sm">
            <span className="label-mono">№ 03 / PREVISÃO DO TREINO DE AMANHÃ</span>
          </div>
          <span className="label-mono" style={{ color: 'var(--text-tertiary)', fontSize: '0.65rem' }}>
            PREVISTO
          </span>
        </div>

        <div className="card-surface" style={{ padding: '16px 18px' }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
              🏃 Rodagem Aeróbica Z2 (Base)
            </span>
            <span className="scoreboard" style={{ fontSize: '0.95rem', color: 'var(--color-primary)' }}>
              6.0 KM
            </span>
          </div>

          <p className="text-body" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 12, lineHeight: 1.4 }}>
            Sessão contínua em ritmo conversacional para desenvolvimento de capilarização e biogênese mitocondrial.
          </p>

          <div className="zones-science-tip" style={{ padding: '8px 10px', fontSize: '0.7rem' }}>
            <Calendar size={13} style={{ color: 'var(--color-primary)', flexShrink: 0 }} />
            <span>
              <strong>Nota da IA:</strong> Esta é a previsão do plano semanal. O treino final será calibrado amanhã de manhã após seu check-in de VFC.
            </span>
          </div>
        </div>
      </div>

      {/* 30-Day Quick Stats */}
      {stats?.stats && (
        <div className="section">
          <div className="section-header">
            <span className="label-mono">№ 03 / RESUMO (30 DIAS)</span>
            <span className="label-mono" style={{ color: 'var(--accent-primary)' }}>
              MÉTRICAS
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            <div className="card-surface" style={{ padding: '14px 10px', textAlign: 'center' }}>
              <Flame size={16} color="var(--accent-primary)" style={{ margin: '0 auto 6px' }} />
              <div className="scoreboard" style={{ fontSize: '1.35rem', color: 'var(--text-primary)' }}>
                {Math.round(stats.stats.total_distance_km)}
              </div>
              <div className="label-mono" style={{ fontSize: '0.62rem', marginTop: 2 }}>KM TOTAIS</div>
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

      {/* ============================================================ */}
      {/* MORNING MEASUREMENT MODAL                                    */}
      {/* ============================================================ */}
      {isModalOpen && (
        <div 
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(0, 0, 0, 0.82)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            animation: 'fadeIn 0.25s ease-out',
          }}
        >
          <div 
            className="card-surface" 
            style={{
              width: '100%',
              maxWidth: 400,
              maxHeight: '90vh',
              overflowY: 'auto',
              border: '1px solid rgba(255, 56, 0, 0.3)',
              borderRadius: 'var(--radius-lg)',
              padding: 24,
              boxShadow: '0 20px 50px rgba(0,0,0,0.8)',
              position: 'relative'
            }}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between" style={{ marginBottom: 18 }}>
              <div className="flex items-center gap-sm">
                <div 
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'rgba(255, 56, 0, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Sparkles size={16} color="var(--accent-primary)" />
                </div>
                <div>
                  <h3 className="heading-sm" style={{ letterSpacing: '0.02em' }}>MEDIÇÃO MATINAL</h3>
                  <p className="label-mono" style={{ fontSize: '0.62rem' }}>VFC & BEM-ESTAR (HOOPER)</p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="btn-icon" 
                style={{ width: 32, height: 32 }}
                aria-label="Fechar"
              >
                <X size={16} />
              </button>
            </div>

            {saveSuccess ? (
              <div style={{ textAlign: 'center', padding: '36px 0' }}>
                <CheckCircle2 size={48} color="var(--status-favorable)" style={{ margin: '0 auto 12px' }} />
                <p className="heading-md" style={{ color: 'var(--status-favorable)', marginBottom: 6 }}>
                  MEDIÇÃO SALVA!
                </p>
                <p className="text-body" style={{ fontSize: '0.82rem' }}>
                  Treino do dia recalibrado com sucesso com base na sua prontidão.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSaveMeasurement}>
                {/* 1. Métricas Fisiológicas */}
                <div style={{ marginBottom: 20 }}>
                  <span className="label-mono" style={{ color: 'var(--accent-primary)', display: 'block', marginBottom: 10 }}>
                    1. DADOS CARDÍACOS AO ACORDAR
                  </span>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label className="label-mono" style={{ fontSize: '0.68rem', display: 'block', marginBottom: 6 }}>
                        RMSSD (ms)
                      </label>
                      <input 
                        type="number" 
                        step="1"
                        min="10"
                        max="250"
                        value={rmssd}
                        onChange={(e) => setRmssd(e.target.value)}
                        required
                        className="input-field"
                        style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', textAlign: 'center' }}
                      />
                      <span style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', marginTop: 2, display: 'block' }}>
                        Ideal: 35–110 ms
                      </span>
                    </div>

                    <div>
                      <label className="label-mono" style={{ fontSize: '0.68rem', display: 'block', marginBottom: 6 }}>
                        FC REPOUSO (bpm)
                      </label>
                      <input 
                        type="number" 
                        step="1"
                        min="30"
                        max="140"
                        value={hrRest}
                        onChange={(e) => setHrRest(e.target.value)}
                        required
                        className="input-field"
                        style={{ fontFamily: 'var(--font-mono)', fontSize: '1.1rem', textAlign: 'center' }}
                      />
                      <span style={{ fontSize: '0.6rem', color: 'var(--text-tertiary)', marginTop: 2, display: 'block' }}>
                        Ideal: 40–65 bpm
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2. Questionário Hooper-Mackinnon */}
                <div style={{ marginBottom: 22 }}>
                  <span className="label-mono" style={{ color: 'var(--accent-primary)', display: 'block', marginBottom: 12 }}>
                    2. AVALIAÇÃO SUBJETIVA (1 A 5)
                  </span>

                  {/* Qualidade do Sono */}
                  <div style={{ marginBottom: 14 }}>
                    <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                      <span className="label-mono" style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Moon size={13} color="var(--accent-primary)" /> Qualidade do Sono
                      </span>
                      <span className="scoreboard" style={{ fontSize: '0.85rem', color: 'var(--accent-primary)' }}>
                        {sleep}/5 ({sleep >= 4 ? 'Excelente' : sleep >= 3 ? 'Normal' : 'Ruim'})
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                      {[1, 2, 3, 4, 5].map((val) => (
                        <button
                          type="button"
                          key={val}
                          onClick={() => setSleep(val)}
                          style={{
                            padding: '6px 0',
                            borderRadius: 'var(--radius-xs)',
                            border: sleep === val ? '1px solid var(--accent-primary)' : '1px solid var(--border-primary)',
                            background: sleep === val ? 'rgba(255, 56, 0, 0.2)' : 'var(--bg-input)',
                            color: sleep === val ? '#fff' : 'var(--text-secondary)',
                            fontWeight: 'bold',
                            fontSize: '0.8rem',
                            cursor: 'pointer'
                          }}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Nível de Fadiga */}
                  <div style={{ marginBottom: 14 }}>
                    <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                      <span className="label-mono" style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Battery size={13} color="var(--accent-primary)" /> Nível de Fadiga
                      </span>
                      <span className="scoreboard" style={{ fontSize: '0.85rem', color: 'var(--accent-primary)' }}>
                        {fatigue}/5 ({fatigue <= 2 ? 'Leve' : fatigue <= 3 ? 'Moderada' : 'Alta'})
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                      {[1, 2, 3, 4, 5].map((val) => (
                        <button
                          type="button"
                          key={val}
                          onClick={() => setFatigue(val)}
                          style={{
                            padding: '6px 0',
                            borderRadius: 'var(--radius-xs)',
                            border: fatigue === val ? '1px solid var(--accent-primary)' : '1px solid var(--border-primary)',
                            background: fatigue === val ? 'rgba(255, 56, 0, 0.2)' : 'var(--bg-input)',
                            color: fatigue === val ? '#fff' : 'var(--text-secondary)',
                            fontWeight: 'bold',
                            fontSize: '0.8rem',
                            cursor: 'pointer'
                          }}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Dor Muscular (Soreness) */}
                  <div style={{ marginBottom: 14 }}>
                    <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                      <span className="label-mono" style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <AlertTriangle size={13} color="var(--accent-primary)" /> Dor Muscular (DOMS)
                      </span>
                      <span className="scoreboard" style={{ fontSize: '0.85rem', color: 'var(--accent-primary)' }}>
                        {soreness}/5 ({soreness <= 2 ? 'Sem dor' : soreness <= 3 ? 'Moderada' : 'Forte'})
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                      {[1, 2, 3, 4, 5].map((val) => (
                        <button
                          type="button"
                          key={val}
                          onClick={() => setSoreness(val)}
                          style={{
                            padding: '6px 0',
                            borderRadius: 'var(--radius-xs)',
                            border: soreness === val ? '1px solid var(--accent-primary)' : '1px solid var(--border-primary)',
                            background: soreness === val ? 'rgba(255, 56, 0, 0.2)' : 'var(--bg-input)',
                            color: soreness === val ? '#fff' : 'var(--text-secondary)',
                            fontWeight: 'bold',
                            fontSize: '0.8rem',
                            cursor: 'pointer'
                          }}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Nível de Estresse */}
                  <div>
                    <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
                      <span className="label-mono" style={{ fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Smile size={13} color="var(--accent-primary)" /> Estresse Psicológico
                      </span>
                      <span className="scoreboard" style={{ fontSize: '0.85rem', color: 'var(--accent-primary)' }}>
                        {stress}/5 ({stress <= 2 ? 'Baixo' : stress <= 3 ? 'Médio' : 'Alto'})
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                      {[1, 2, 3, 4, 5].map((val) => (
                        <button
                          type="button"
                          key={val}
                          onClick={() => setStress(val)}
                          style={{
                            padding: '6px 0',
                            borderRadius: 'var(--radius-xs)',
                            border: stress === val ? '1px solid var(--accent-primary)' : '1px solid var(--border-primary)',
                            background: stress === val ? 'rgba(255, 56, 0, 0.2)' : 'var(--bg-input)',
                            color: stress === val ? '#fff' : 'var(--text-secondary)',
                            fontWeight: 'bold',
                            fontSize: '0.8rem',
                            cursor: 'pointer'
                          }}
                        >
                          {val}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Botão de Envio */}
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '14px', fontSize: '0.9rem' }}
                >
                  <Sparkles size={16} />
                  <span>{submitting ? 'Calibrando Treino...' : 'Salvar e Calibrar Treino'}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Heart Rate Zones Modal (Z1 - Z5) */}
      <HeartRateZonesModal 
        isOpen={isZonesModalOpen} 
        onClose={() => setIsZonesModalOpen(false)} 
        zonesData={zonesData} 
      />

      {/* Camera PPG HRV Monitor Modal */}
      <CameraHrvMonitor
        isOpen={isCameraModalOpen}
        onClose={() => setIsCameraModalOpen(false)}
        onComplete={async (data) => {
          setRmssd(String(data.rmssd_ms));
          setHrRest(String(data.hr_rest_bpm));
          try {
            await hrv.measure({
              rmssd_ms: data.rmssd_ms,
              hr_rest_bpm: data.hr_rest_bpm,
              duration_seconds: 60,
            });
            await loadDashboardData();
          } catch (e) {
            console.error('Auto save camera HRV error:', e);
          }
        }}
      />

      {/* Scientific Warm-up & Drills Guide */}
      <WarmupGuideModal
        isOpen={isWarmupModalOpen}
        onClose={() => setIsWarmupModalOpen(false)}
      />

      {/* Field Test for Zones & Paces Calibration */}
      <FieldTestModal
        isOpen={isFieldTestModalOpen}
        onClose={() => setIsFieldTestModalOpen(false)}
        onTestCompleted={async () => {
          await loadDashboardData();
        }}
      />

      {/* Post-Workout Logging Modal */}
      <PostWorkoutModal
        isOpen={isPostWorkoutModalOpen}
        onClose={() => setIsPostWorkoutModalOpen(false)}
        plannedSession={effectiveSession}
        onSaved={async () => {
          setWorkoutCompleted(true);
          await loadDashboardData();
        }}
      />
    </div>
  );
}
