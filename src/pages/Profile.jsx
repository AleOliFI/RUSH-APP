// ============================================================
// RUSH PERFORMANCE — Athlete Profile & Settings
// Profile, stats, social links (Instagram/Strava), zones, test & menstrual cycle
// ============================================================

import { useState, useEffect } from 'react';
import { users, challenges, activities, auth, clearAuth, menstrual, hrv, subscriptions } from '../api';
import { useAuth } from '../context/AuthContext';
import { 
  LogOut, Activity, Clock, MapPin, Target, Trophy, Award, 
  CheckCircle2, Shield, Heart, Sparkles, Check, Info, 
  ExternalLink, Settings, Edit3, Camera, User, Flame, Trash2, Zap 
} from 'lucide-react';
import { InstagramIcon, StravaIcon } from '../components/SocialIcons';
import FieldTestModal from '../components/FieldTestModal';

export default function Profile({ user, onLogout }) {
  const { isPro, openUpgradeModal } = useAuth();
  const [profile, setProfile] = useState(null);
  const [earned, setEarned] = useState([]);
  const [allAch, setAllAch] = useState([]);
  const [stats, setStats] = useState(null);
  const [zonesData, setZonesData] = useState(null);
  const [tab, setTab] = useState('stats');
  const [loading, setLoading] = useState(true);

  // Edit Profile Form State
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [heightCm, setHeightCm] = useState('');
  const [instagram, setInstagram] = useState('');
  const [strava, setStrava] = useState('');
  const [pace5k, setPace5k] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState(false);

  // Menstrual Profile State
  const [lmpDate, setLmpDate] = useState('');
  const [cycleLength, setCycleLength] = useState('28');
  const [usesContraceptive, setUsesContraceptive] = useState(false);
  const [contraceptiveType, setContraceptiveType] = useState('');
  const [savingMenstrual, setSavingMenstrual] = useState(false);
  const [menstrualSuccess, setMenstrualSuccess] = useState(false);

  // Field test modal state
  const [isFieldTestOpen, setIsFieldTestOpen] = useState(false);

  const loadData = async () => {
    try {
      const [p, a, s, m, z] = await Promise.all([
        users.profile().catch(() => null),
        challenges.achievements().catch(() => ({ earned: [], all: [] })),
        activities.stats(90).catch(() => null),
        menstrual.getProfile().catch(() => null),
        hrv.zones().catch(() => null),
      ]);
      setProfile(p);
      setEarned(a?.earned || []);
      setAllAch(a?.all || []);
      setStats(s);
      setZonesData(z);

      if (p) {
        setName(p.name || '');
        setUsername(p.username || '');
        setBio(p.bio || '');
        setLocation(p.location || '');
        setWeightKg(p.weight_kg ? String(p.weight_kg) : '');
        setHeightCm(p.height_cm ? String(p.height_cm) : '');
        setInstagram(p.instagram || '');
        setStrava(p.strava || '');
        setPace5k(p.pace_5k || '');
      }

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
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await users.updateProfile({
        name,
        username,
        bio,
        location,
        weight_kg: weightKg ? parseFloat(weightKg) : null,
        height_cm: heightCm ? parseFloat(heightCm) : null,
        instagram,
        strava,
        pace_5k: pace5k,
      });
      setProfileSuccess(true);
      setTimeout(() => setProfileSuccess(false), 2000);
      await loadData();
    } catch (err) {
      console.error('Profile update error:', err);
      alert('Erro ao salvar dados do perfil: ' + (err.message || 'Tente novamente'));
    } finally {
      setSavingProfile(false);
    }
  };

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

        {/* Social Links (Instagram / Strava) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 12 }}>
          {profile?.instagram && (
            <a
              href={`https://instagram.com/${profile.instagram.replace('@', '')}`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: '0.75rem',
                color: 'var(--text-primary)',
                background: 'rgba(255, 255, 255, 0.05)',
                padding: '4px 10px',
                borderRadius: 'var(--radius-xs)',
                textDecoration: 'none',
              }}
            >
              <InstagramIcon size={13} color="#E1306C" />
              <span>@{profile.instagram.replace('@', '')}</span>
            </a>
          )}
          {profile?.strava && (
            <a
              href={profile.strava.startsWith('http') ? profile.strava : `https://strava.com/athletes/${profile.strava}`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: '0.75rem',
                color: 'var(--text-primary)',
                background: 'rgba(255, 255, 255, 0.05)',
                padding: '4px 10px',
                borderRadius: 'var(--radius-xs)',
                textDecoration: 'none',
              }}
            >
              <Activity size={13} color="#FC4C02" />
              <span>Strava</span>
            </a>
          )}
        </div>

        <div className="flex items-center justify-center gap-md" style={{ marginTop: 4 }}>
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

      {/* Navigation Tabs (Scrollable Badge Bar) */}
      <div className="tab-pill-group" style={{ marginBottom: 20 }}>
        <button
          type="button"
          className={`tab-pill ${tab === 'stats' ? 'tab-pill--active' : ''}`}
          onClick={() => setTab('stats')}
        >
          <Activity size={13} /> Estatísticas (90d)
        </button>
        <button
          type="button"
          className={`tab-pill ${tab === 'settings' ? 'tab-pill--active' : ''}`}
          onClick={() => setTab('settings')}
        >
          <Settings size={13} /> Editar Dados
        </button>
        <button
          type="button"
          className={`tab-pill ${tab === 'zones' ? 'tab-pill--active' : ''}`}
          onClick={() => setTab('zones')}
        >
          <Target size={13} /> Paces & Zonas
        </button>
        <button
          type="button"
          className={`tab-pill ${tab === 'menstrual' ? 'tab-pill--active' : ''}`}
          onClick={() => setTab('menstrual')}
        >
          <Heart size={13} /> Ciclo Hormonal
        </button>
        <button
          type="button"
          className={`tab-pill ${tab === 'achievements' ? 'tab-pill--active' : ''}`}
          onClick={() => setTab('achievements')}
        >
          <Trophy size={13} /> Conquistas ({earned.length})
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

      {/* TAB 2: Edit Profile & Social Settings */}
      {tab === 'settings' && (
        <div className="section">
          <div className="card-surface" style={{ padding: '20px' }}>
            <h3 className="heading-md" style={{ marginBottom: 14 }}>Informações do Atleta</h3>

            <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label className="label-mono" style={{ fontSize: '0.68rem', display: 'block', marginBottom: 4 }}>NOME COMPLETO</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="input-field"
                    style={{ fontSize: '0.85rem' }}
                  />
                </div>

                <div>
                  <label className="label-mono" style={{ fontSize: '0.68rem', display: 'block', marginBottom: 4 }}>USERNAME</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    className="input-field"
                    style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)' }}
                  />
                </div>
              </div>

              <div>
                <label className="label-mono" style={{ fontSize: '0.68rem', display: 'block', marginBottom: 4 }}>BIO / OBJETIVO ESPORTIVO</label>
                <textarea
                  rows="2"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Ex: Corredor amador buscando os 5K sub-20..."
                  className="input-field"
                  style={{ width: '100%', resize: 'none', fontSize: '0.82rem' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                <div>
                  <label className="label-mono" style={{ fontSize: '0.65rem', display: 'block', marginBottom: 4 }}>CIDADE</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="São Paulo, SP"
                    className="input-field"
                    style={{ fontSize: '0.82rem' }}
                  />
                </div>

                <div>
                  <label className="label-mono" style={{ fontSize: '0.65rem', display: 'block', marginBottom: 4 }}>PESO (KG)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={weightKg}
                    onChange={(e) => setWeightKg(e.target.value)}
                    placeholder="70.5"
                    className="input-field"
                    style={{ fontSize: '0.82rem', fontFamily: 'var(--font-mono)' }}
                  />
                </div>

                <div>
                  <label className="label-mono" style={{ fontSize: '0.65rem', display: 'block', marginBottom: 4 }}>ALTURA (CM)</label>
                  <input
                    type="number"
                    value={heightCm}
                    onChange={(e) => setHeightCm(e.target.value)}
                    placeholder="178"
                    className="input-field"
                    style={{ fontSize: '0.82rem', fontFamily: 'var(--font-mono)' }}
                  />
                </div>
              </div>

              {/* Social links */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
                <div>
                  <label className="label-mono" style={{ fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                    <InstagramIcon size={13} color="#E1306C" /> INSTAGRAM
                  </label>
                  <input
                    type="text"
                    placeholder="@seu_perfil"
                    value={instagram}
                    onChange={(e) => setInstagram(e.target.value)}
                    className="input-field"
                    style={{ fontSize: '0.82rem' }}
                  />
                </div>

                <div>
                  <label className="label-mono" style={{ fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                    <Activity size={13} color="#FC4C02" /> STRAVA (LINK/ID)
                  </label>
                  <input
                    type="text"
                    placeholder="strava.com/athletes/123"
                    value={strava}
                    onChange={(e) => setStrava(e.target.value)}
                    className="input-field"
                    style={{ fontSize: '0.82rem' }}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={savingProfile}
                className="btn btn-primary"
                style={{ marginTop: 10, width: '100%', padding: '12px' }}
              >
                {profileSuccess ? (
                  <>
                    <Check size={16} /> Perfil Atualizado!
                  </>
                ) : (
                  <>
                    <Sparkles size={16} /> {savingProfile ? 'Salvando...' : 'Salvar Alterações'}
                  </>
                )}
              </button>
            </form>

            {/* Subscription & Plan Status */}
            <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--border-secondary)' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                <span className="label-mono" style={{ fontSize: '0.68rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Zap size={14} color="var(--accent-primary)" /> PLANO ATUAL
                </span>
                <span className={`status-badge ${isPro ? 'status-badge--favorable' : 'status-badge--neutral'}`} style={{ fontSize: '0.68rem' }}>
                  {isPro ? '⚡ RUSH PRO ATIVO' : 'PLANO GRATUITO'}
                </span>
              </div>

              {isPro ? (
                <p className="text-body" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Você possui acesso ilimitado a todos os recursos científicos, IA de treino adaptativo e módulo menstrual.
                </p>
              ) : (
                <div style={{ background: 'rgba(255, 56, 0, 0.08)', border: '1px solid rgba(255, 56, 0, 0.25)', borderRadius: 'var(--radius-md)', padding: 12 }}>
                  <p className="text-body" style={{ fontSize: '0.8rem', marginBottom: 8, color: 'var(--text-primary)' }}>
                    Desbloqueie treinos adaptativos diários por VFC por apenas <strong>R$ 29,90/mês</strong> com 7 dias grátis.
                  </p>
                  <button
                    type="button"
                    onClick={openUpgradeModal}
                    className="btn btn-primary btn-sm"
                    style={{ width: '100%', fontSize: '0.78rem', padding: '8px' }}
                  >
                    <Sparkles size={13} /> Fazer Upgrade para RUSH PRO
                  </button>
                </div>
              )}
            </div>

            {/* Apple Guideline 5.1.1: Account Deletion */}
            <div style={{ marginTop: 24, paddingTop: 18, borderTop: '1px solid var(--border-secondary)' }}>
              <span className="label-mono" style={{ fontSize: '0.68rem', color: 'var(--status-recovery)', display: 'block', marginBottom: 6 }}>
                ZONA DE PRIVACIDADE & CONTA
              </span>
              <button
                type="button"
                onClick={async () => {
                  if (window.confirm('Tem certeza de que deseja excluir permanentemente sua conta e todos os seus dados de treino? Essa ação não pode ser desfeita.')) {
                    try {
                      await users.deleteAccount();
                      handleLogout();
                    } catch (e) {
                      alert('Erro ao excluir conta: ' + (e.message || 'Tente novamente'));
                    }
                  }
                }}
                style={{
                  background: 'none',
                  border: '1px solid rgba(255, 59, 92, 0.3)',
                  color: 'var(--status-recovery)',
                  borderRadius: 'var(--radius-xs)',
                  padding: '8px 12px',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  cursor: 'pointer',
                }}
              >
                <Trash2 size={13} /> Excluir Minha Conta Permanentemente
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: Paces & Heart Rate Zones */}
      {tab === 'zones' && (
        <div className="section">
          <div className="card-surface" style={{ padding: '20px', marginBottom: 16 }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 10 }}>
              <div className="flex items-center gap-sm">
                <Target size={18} color="var(--color-primary)" />
                <h3 className="heading-md" style={{ margin: 0 }}>Zonas de Frequência Cardíaca</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFieldTestOpen(true)}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.7rem', padding: '6px 10px' }}
              >
                <Sparkles size={12} /> Fazer Teste de Campo
              </button>
            </div>

            <p className="text-body" style={{ fontSize: '0.82rem', marginBottom: 16, lineHeight: 1.45 }}>
              Suas zonas são individualizadas pela equação de <strong>Gellish et al.</strong> e calibradas com base nos seus testes de campo e VFC matinal.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {zonesData?.zones ? (
                Object.entries(zonesData.zones).map(([key, z]) => (
                  <div key={key} className="card-surface" style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--color-primary)' }}>
                        {key} — {z.name}
                      </div>
                      <div className="label-mono" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>
                        {z.purpose}
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div className="scoreboard" style={{ fontSize: '1rem', color: 'var(--text-primary)' }}>
                        {z.minBpm} – {z.maxBpm} <span className="label-mono" style={{ fontSize: '0.65rem' }}>BPM</span>
                      </div>
                      <div className="label-mono" style={{ fontSize: '0.65rem', color: 'var(--color-primary)' }}>
                        {z.pctRange}
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ textAlign: 'center', padding: '16px' }}>
                  <p className="text-body" style={{ fontSize: '0.82rem' }}>Zonas padrão calculadas.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: Menstrual Cycle Settings */}
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

      {/* TAB 5: Achievements */}
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

      {/* Field Test Modal */}
      <FieldTestModal
        isOpen={isFieldTestOpen}
        onClose={() => setIsFieldTestOpen(false)}
        onTestCompleted={async () => {
          await loadData();
        }}
      />
    </div>
  );
}
