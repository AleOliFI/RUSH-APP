// ============================================================
// RUSH PERFORMANCE — Coach / Academy High-Performance Dashboard
//
// Painel profissional do treinador:
// - Semáforo de prontidão fisiológica da equipe (VFC matinal)
// - Cadastro e gestão de alunos
// - Prescrição personalizada e monitoramento de carga/RPE
// - Otimizado para desktop/notebook e mobile
// ============================================================

import { useState, useEffect } from 'react';
import { academies, training } from '../api';
import { 
  Users, UserPlus, Mail, ShieldAlert, Heart, Activity, 
  Flame, Sparkles, Search, Filter, CheckCircle2, AlertTriangle, 
  X, Send, Calendar, Clock, ChevronRight, Eye, Edit3, ArrowUpRight, Zap
} from 'lucide-react';

const STATUS_CONFIG = {
  favorable: {
    label: 'Favorável (Luz Verde)',
    color: 'var(--status-favorable, #00D68F)',
    bgClass: 'status-badge--favorable',
    dotClass: 'live-dot--favorable',
    desc: 'Pronto para treinos de intensidade / tiros (Z4-Z5)',
  },
  attention: {
    label: 'Atenção (Moderar Carga)',
    color: 'var(--status-attention, #FFB800)',
    bgClass: 'status-badge--attention',
    dotClass: 'live-dot--attention',
    desc: 'Leve desvio. Manter em Z1/Z2 ou reduzir volume',
  },
  recovery: {
    label: 'Recuperação (Overreaching)',
    color: 'var(--status-recovery, #FF3B5C)',
    bgClass: 'status-badge--recovery',
    dotClass: 'live-dot--recovery',
    desc: 'Sobrecarga autonômica. Descanso total ou trote leve Z1',
  },
  none: {
    label: 'Não Mediu Hoje',
    color: 'var(--text-tertiary, #666)',
    bgClass: 'status-badge--neutral',
    dotClass: 'live-dot--neutral',
    desc: 'Aguardando check-in matinal de VFC',
  },
};

export default function CoachDashboard({ user }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');

  // Modals
  const [isAddAthleteOpen, setIsAddAthleteOpen] = useState(false);
  const [isPrescribeOpen, setIsPrescribeOpen] = useState(false);
  const [selectedAthlete, setSelectedAthlete] = useState(null);
  const [athleteDetails, setAthleteDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // New Athlete Form State
  const [newAthName, setNewAthName] = useState('');
  const [newAthEmail, setNewAthEmail] = useState('');
  const [newAthPassword, setNewAthPassword] = useState('123456');
  const [newAthDistance, setNewAthDistance] = useState('5');
  const [newAthLevel, setNewAthLevel] = useState('beginner');
  const [newAthGender, setNewAthGender] = useState('male');
  const [submittingAth, setSubmittingAth] = useState(false);

  // Prescription Form State
  const [prescribeTitle, setPrescribeTitle] = useState('Intervalado 6x400m');
  const [prescribeType, setPrescribeType] = useState('interval');
  const [prescribeDist, setPrescribeDist] = useState('6.0');
  const [prescribeDuration, setPrescribeDuration] = useState('35');
  const [prescribePace, setPrescribePace] = useState('4:30');
  const [prescribeZone, setPrescribeZone] = useState('Z4-Z5');
  const [prescribeDesc, setPrescribeDesc] = useState('Aquecimento 10 min Z1, 6 tiros de 400m em Z5 com 90s trote, desaquecimento 5 min.');
  const [submittingPrescription, setSubmittingPrescription] = useState(false);
  const [prescriptionSuccess, setPrescriptionSuccess] = useState(false);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const res = await academies.dashboard();
      setData(res);
    } catch (e) {
      console.error('Coach dashboard load error:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const handleOpenAthleteDetails = async (athlete) => {
    setSelectedAthlete(athlete);
    setAthleteDetails(null);
    setLoadingDetails(true);
    setIsPrescribeOpen(true);

    try {
      const details = await academies.athleteDetails(athlete.id);
      setAthleteDetails(details);
    } catch (err) {
      console.error('Athlete details fetch error:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleCreateAthlete = async (e) => {
    e.preventDefault();
    setSubmittingAth(true);
    try {
      await academies.registerAthlete({
        name: newAthName,
        email: newAthEmail,
        password: newAthPassword,
        distance_km: parseInt(newAthDistance, 10),
        level: newAthLevel,
        gender: newAthGender,
      });

      setIsAddAthleteOpen(false);
      setNewAthName('');
      setNewAthEmail('');
      await loadDashboard();
    } catch (err) {
      console.error('Register athlete error:', err);
      alert('Erro ao cadastrar aluno: ' + (err.message || 'Tente novamente'));
    } finally {
      setSubmittingAth(false);
    }
  };

  const handleSendPrescription = async (e) => {
    e.preventDefault();
    if (!selectedAthlete) return;

    setSubmittingPrescription(true);
    try {
      await academies.prescribe(selectedAthlete.id, {
        title: prescribeTitle,
        type: prescribeType,
        distance_km: parseFloat(prescribeDist),
        duration_min: parseInt(prescribeDuration, 10),
        target_pace: `${prescribePace}/km`,
        target_hr_zone: prescribeZone,
        description: prescribeDesc,
      });

      setPrescriptionSuccess(true);
      setTimeout(() => {
        setPrescriptionSuccess(false);
        setIsPrescribeOpen(false);
      }, 1500);
    } catch (err) {
      console.error('Prescribe error:', err);
      alert('Erro ao enviar prescrição: ' + (err.message || 'Tente novamente'));
    } finally {
      setSubmittingPrescription(false);
    }
  };

  // Filtering athletes
  const athletes = data?.athletes || [];
  const filteredAthletes = athletes.filter((a) => {
    const matchesSearch =
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.username.toLowerCase().includes(search.toLowerCase());
    
    if (filterStatus === 'all') return matchesSearch;
    if (filterStatus === 'none') return matchesSearch && !a.status;
    return matchesSearch && a.status === filterStatus;
  });

  const breakdown = data?.summary?.status_breakdown || {};
  const favorableCount = breakdown.favorable || 0;
  const attentionCount = breakdown.attention || 0;
  const recoveryCount = breakdown.recovery || 0;
  const notMeasuredCount = data?.summary?.not_measured || 0;
  const totalCount = data?.summary?.total_athletes || athletes.length;

  return (
    <div className="page coach-page-container">
      {/* Top Header */}
      <div className="top-bar">
        <div>
          <div className="flex items-center gap-sm">
            <span className="live-dot" />
            <span className="label-mono">№ 05 / PORTAL DA ASSESSORIA</span>
          </div>
          <h1 className="heading-lg">PAINEL DO TREINADOR</h1>
        </div>

        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => setIsAddAthleteOpen(true)}
          style={{ fontSize: '0.78rem', padding: '8px 14px' }}
        >
          <UserPlus size={15} /> Cadastrar Aluno
        </button>
      </div>

      {/* ============================================================ */}
      {/* TEAM READINESS TRAFFIC LIGHT (SEMÁFORO DE PRONTIDÃO)         */}
      {/* ============================================================ */}
      <div className="section" style={{ marginBottom: 20 }}>
        <div className="section-header">
          <span className="label-mono">SEMÁFORO DE PRONTIDÃO DA EQUIPE (HOJE)</span>
          <span className="label-mono" style={{ color: 'var(--color-primary)' }}>
            {totalCount} ATLETAS
          </span>
        </div>

        <div className="stats-grid coach-readiness-grid">
          {/* Favorable */}
          <div
            className="card-surface stat-box"
            onClick={() => setFilterStatus(filterStatus === 'favorable' ? 'all' : 'favorable')}
            style={{
              cursor: 'pointer',
              borderColor: filterStatus === 'favorable' ? 'var(--status-favorable)' : undefined,
              background: filterStatus === 'favorable' ? 'rgba(0, 214, 143, 0.1)' : undefined,
            }}
          >
            <div className="scoreboard" style={{ fontSize: '2rem', color: 'var(--status-favorable)' }}>
              {favorableCount}
            </div>
            <div className="label-mono" style={{ fontSize: '0.65rem', marginTop: 4, color: 'var(--status-favorable)' }}>
              🟢 PRONTOS P/ CARGA
            </div>
          </div>

          {/* Attention */}
          <div
            className="card-surface stat-box"
            onClick={() => setFilterStatus(filterStatus === 'attention' ? 'all' : 'attention')}
            style={{
              cursor: 'pointer',
              borderColor: filterStatus === 'attention' ? 'var(--status-attention)' : undefined,
              background: filterStatus === 'attention' ? 'rgba(255, 184, 0, 0.1)' : undefined,
            }}
          >
            <div className="scoreboard" style={{ fontSize: '2rem', color: 'var(--status-attention)' }}>
              {attentionCount}
            </div>
            <div className="label-mono" style={{ fontSize: '0.65rem', marginTop: 4, color: 'var(--status-attention)' }}>
              🟡 ATENÇÃO / MODERAR
            </div>
          </div>

          {/* Recovery */}
          <div
            className="card-surface stat-box"
            onClick={() => setFilterStatus(filterStatus === 'recovery' ? 'all' : 'recovery')}
            style={{
              cursor: 'pointer',
              borderColor: filterStatus === 'recovery' ? 'var(--status-recovery)' : undefined,
              background: filterStatus === 'recovery' ? 'rgba(255, 59, 92, 0.1)' : undefined,
            }}
          >
            <div className="scoreboard" style={{ fontSize: '2rem', color: 'var(--status-recovery)' }}>
              {recoveryCount}
            </div>
            <div className="label-mono" style={{ fontSize: '0.65rem', marginTop: 4, color: 'var(--status-recovery)' }}>
              🔴 RECUPERAÇÃO / DESCANSO
            </div>
          </div>

          {/* Not measured */}
          <div
            className="card-surface stat-box"
            onClick={() => setFilterStatus(filterStatus === 'none' ? 'all' : 'none')}
            style={{
              cursor: 'pointer',
              borderColor: filterStatus === 'none' ? 'var(--text-primary)' : undefined,
            }}
          >
            <div className="scoreboard" style={{ fontSize: '2rem', color: 'var(--text-secondary)' }}>
              {notMeasuredCount}
            </div>
            <div className="label-mono" style={{ fontSize: '0.65rem', marginTop: 4 }}>
              ⚪ PENDENTE DE MEDIÇÃO
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* SEARCH AND FILTER BAR                                        */}
      {/* ============================================================ */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="input-wrapper" style={{ flex: 1, minWidth: 200 }}>
          <Search size={15} className="input-icon" />
          <input
            type="text"
            placeholder="Buscar por nome ou @username do aluno..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input-field"
            style={{ fontSize: '0.82rem', paddingLeft: 36 }}
          />
        </div>

        <div className="tab-pill-group" style={{ margin: 0 }}>
          {['all', 'favorable', 'attention', 'recovery', 'none'].map((st) => (
            <button
              key={st}
              type="button"
              className={`tab-pill ${filterStatus === st ? 'tab-pill--active' : ''}`}
              onClick={() => setFilterStatus(st)}
              style={{ fontSize: '0.7rem', padding: '6px 12px' }}
            >
              {st === 'all'
                ? 'Todos'
                : st === 'favorable'
                ? '🟢 Luz Verde'
                : st === 'attention'
                ? '🟡 Atenção'
                : st === 'recovery'
                ? '🔴 Recuperação'
                : '⚪ Pendentes'}
            </button>
          ))}
        </div>
      </div>

      {/* ============================================================ */}
      {/* ATHLETES LIST / TABLE (DESKTOP & MOBILE RESPONSIVE)           */}
      {/* ============================================================ */}
      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton" style={{ height: 90, borderRadius: 14 }} />
          ))}
        </div>
      ) : filteredAthletes.length === 0 ? (
        <div className="empty-state">
          <Users size={36} color="var(--color-primary)" style={{ margin: '0 auto 10px' }} />
          <p className="heading-md">Nenhum atleta encontrado</p>
          <p className="empty-state-text">
            {search || filterStatus !== 'all'
              ? 'Tente remover os filtros de busca para visualizar os atletas.'
              : 'Cadastre seus primeiros alunos para começar o monitoramento da assessoria.'}
          </p>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setIsAddAthleteOpen(true)}
            style={{ marginTop: 12 }}
          >
            <UserPlus size={14} /> Cadastrar Novo Aluno
          </button>
        </div>
      ) : (
        <div className="coach-athletes-list" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredAthletes.map((a) => {
            const st = a.status ? STATUS_CONFIG[a.status] : STATUS_CONFIG.none;
            const initials = a.name ? a.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase() : 'AT';

            return (
              <div
                key={a.id}
                className="card-surface coach-athlete-card"
                style={{
                  padding: '14px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 14,
                  borderLeft: `4px solid ${st.color}`,
                  transition: 'all 0.15s ease',
                }}
              >
                {/* Left: Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                  <div className="avatar" style={{ width: 44, height: 44, fontSize: '0.9rem' }}>
                    {initials}
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {a.name}
                      </span>
                      <span className={`status-badge ${st.bgClass}`} style={{ fontSize: '0.62rem', padding: '2px 8px' }}>
                        {st.label}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                      <span className="label-mono" style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>
                        @{a.username}
                      </span>
                      {a.lnrmssd && (
                        <span className="label-mono" style={{ fontSize: '0.68rem', color: 'var(--color-primary)' }}>
                          lnRMSSD: <strong>{(+a.lnrmssd).toFixed(2)}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => handleOpenAthleteDetails(a)}
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.72rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <Activity size={13} color="var(--color-primary)" />
                    <span>Fisiologia & Prescrição</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: CADASTRAR NOVO ALUNO                                  */}
      {/* ============================================================ */}
      {isAddAthleteOpen && (
        <div className="modal-backdrop" onClick={() => setIsAddAthleteOpen(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <span className="label-mono modal-label">№ 01 / GESTÃO DA ASSESSORIA</span>
                <h3 className="modal-title">Cadastrar Novo Aluno</h3>
              </div>
              <button className="btn-close-modal" onClick={() => setIsAddAthleteOpen(false)}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateAthlete} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="label-mono" style={{ fontSize: '0.68rem', display: 'block', marginBottom: 4 }}>NOME DO ATLETA</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Carlos Mendonça"
                  value={newAthName}
                  onChange={(e) => setNewAthName(e.target.value)}
                  className="input-field"
                />
              </div>

              <div>
                <label className="label-mono" style={{ fontSize: '0.68rem', display: 'block', marginBottom: 4 }}>EMAIL</label>
                <input
                  type="email"
                  required
                  placeholder="carlos@gmail.com"
                  value={newAthEmail}
                  onChange={(e) => setNewAthEmail(e.target.value)}
                  className="input-field"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="label-mono" style={{ fontSize: '0.68rem', display: 'block', marginBottom: 4 }}>DISTÂNCIA ALVO</label>
                  <select
                    value={newAthDistance}
                    onChange={(e) => setNewAthDistance(e.target.value)}
                    className="input-field"
                    style={{ width: '100%' }}
                  >
                    <option value="5">5 KM</option>
                    <option value="10">10 KM</option>
                    <option value="21">21 KM (Meia)</option>
                    <option value="42">42 KM (Maratona)</option>
                  </select>
                </div>

                <div>
                  <label className="label-mono" style={{ fontSize: '0.68rem', display: 'block', marginBottom: 4 }}>NÍVEL ATUAL</label>
                  <select
                    value={newAthLevel}
                    onChange={(e) => setNewAthLevel(e.target.value)}
                    className="input-field"
                    style={{ width: '100%' }}
                  >
                    <option value="beginner">Iniciante</option>
                    <option value="intermediate">Intermediário</option>
                    <option value="advanced">Avançado</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="label-mono" style={{ fontSize: '0.68rem', display: 'block', marginBottom: 4 }}>GÊNERO</label>
                  <select
                    value={newAthGender}
                    onChange={(e) => setNewAthGender(e.target.value)}
                    className="input-field"
                    style={{ width: '100%' }}
                  >
                    <option value="male">Masculino</option>
                    <option value="female">Feminino</option>
                    <option value="other">Outro</option>
                  </select>
                </div>

                <div>
                  <label className="label-mono" style={{ fontSize: '0.68rem', display: 'block', marginBottom: 4 }}>SENHA PROVISÓRIA</label>
                  <input
                    type="text"
                    value={newAthPassword}
                    onChange={(e) => setNewAthPassword(e.target.value)}
                    className="input-field"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={submittingAth}
                className="btn btn-primary"
                style={{ width: '100%', padding: '14px', marginTop: 6 }}
              >
                <UserPlus size={16} />
                <span>{submittingAth ? 'Cadastrando...' : 'Concluir Cadastro do Aluno'}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================ */}
      {/* MODAL: FISIOLOGIA & PRESCRIÇÃO DO ALUNO                      */}
      {/* ============================================================ */}
      {isPrescribeOpen && selectedAthlete && (
        <div className="modal-backdrop" onClick={() => setIsPrescribeOpen(false)}>
          <div className="modal-card" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title-wrap">
                <span className="label-mono modal-label">№ 02 / PRESCRIÇÃO E MONITORAMENTO</span>
                <h3 className="modal-title">{selectedAthlete.name}</h3>
              </div>
              <button className="btn-close-modal" onClick={() => setIsPrescribeOpen(false)}>
                <X size={18} />
              </button>
            </div>

            {loadingDetails ? (
              <div style={{ padding: '20px 0', textAlign: 'center' }}>
                <div className="skeleton" style={{ height: 160, borderRadius: 14 }} />
              </div>
            ) : (
              <div>
                {/* Athlete Physiological Header */}
                <div className="card-surface" style={{ padding: '12px 14px', marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span className="label-mono" style={{ fontSize: '0.68rem' }}>STATUS HOJE</span>
                    <span className={`status-badge ${selectedAthlete.status ? STATUS_CONFIG[selectedAthlete.status]?.bgClass : 'status-badge--neutral'}`}>
                      {selectedAthlete.status ? STATUS_CONFIG[selectedAthlete.status]?.label : 'Sem Medição'}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, textAlign: 'center' }}>
                    <div>
                      <div className="scoreboard" style={{ fontSize: '1.2rem', color: 'var(--color-primary)' }}>
                        {selectedAthlete.lnrmssd ? (+selectedAthlete.lnrmssd).toFixed(2) : '--'}
                      </div>
                      <div className="label-mono" style={{ fontSize: '0.6rem' }}>lnRMSSD</div>
                    </div>
                    <div>
                      <div className="scoreboard" style={{ fontSize: '1.2rem', color: 'var(--text-primary)' }}>
                        {athleteDetails?.athlete?.distance_km || 5}K
                      </div>
                      <div className="label-mono" style={{ fontSize: '0.6rem' }}>DISTÂNCIA ALVO</div>
                    </div>
                    <div>
                      <div className="scoreboard" style={{ fontSize: '1.2rem', color: 'var(--status-favorable)' }}>
                        {athleteDetails?.recent_activities?.length || 0}
                      </div>
                      <div className="label-mono" style={{ fontSize: '0.6rem' }}>TREINOS FEITOS</div>
                    </div>
                  </div>
                </div>

                {/* Prescription Form */}
                <form onSubmit={handleSendPrescription} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <span className="label-mono" style={{ fontSize: '0.72rem', color: 'var(--color-primary)' }}>
                    PRESCREVER / AJUSTAR SESSÃO DE TREINO
                  </span>

                  <div>
                    <label className="label-mono" style={{ fontSize: '0.65rem', display: 'block', marginBottom: 4 }}>TÍTULO DA SESSÃO</label>
                    <input
                      type="text"
                      required
                      value={prescribeTitle}
                      onChange={(e) => setPrescribeTitle(e.target.value)}
                      className="input-field"
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <div>
                      <label className="label-mono" style={{ fontSize: '0.65rem', display: 'block', marginBottom: 4 }}>TIPO</label>
                      <select
                        value={prescribeType}
                        onChange={(e) => setPrescribeType(e.target.value)}
                        className="input-field"
                      >
                        <option value="easy_run">Rodagem Z2</option>
                        <option value="interval">Intervalado / Tiros</option>
                        <option value="tempo">Tempo Run (Z3-Z4)</option>
                        <option value="long_run">Longão</option>
                        <option value="recovery">Regenerativo Z1</option>
                      </select>
                    </div>

                    <div>
                      <label className="label-mono" style={{ fontSize: '0.65rem', display: 'block', marginBottom: 4 }}>DISTÂNCIA (KM)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={prescribeDist}
                        onChange={(e) => setPrescribeDist(e.target.value)}
                        className="input-field"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      />
                    </div>

                    <div>
                      <label className="label-mono" style={{ fontSize: '0.65rem', display: 'block', marginBottom: 4 }}>ZONA ALVO</label>
                      <input
                        type="text"
                        value={prescribeZone}
                        onChange={(e) => setPrescribeZone(e.target.value)}
                        className="input-field"
                        style={{ fontFamily: 'var(--font-mono)' }}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label-mono" style={{ fontSize: '0.65rem', display: 'block', marginBottom: 4 }}>INSTRUÇÕES TÉCNICAS PARA O ALUNO</label>
                    <textarea
                      rows="3"
                      value={prescribeDesc}
                      onChange={(e) => setPrescribeDesc(e.target.value)}
                      className="input-field"
                      style={{ width: '100%', resize: 'none', fontSize: '0.8rem' }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submittingPrescription}
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '12px', marginTop: 4 }}
                  >
                    {prescriptionSuccess ? (
                      <>
                        <CheckCircle2 size={16} /> Prescrição Enviada com Sucesso!
                      </>
                    ) : (
                      <>
                        <Send size={15} /> {submittingPrescription ? 'Enviando...' : 'Enviar Treino ao Atleta'}
                      </>
                    )}
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
