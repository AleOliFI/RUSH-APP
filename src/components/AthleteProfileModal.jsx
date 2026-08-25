// ============================================================
// RUSH PERFORMANCE — Athlete Public Profile Modal
//
// Visualização de perfil público de outros atletas estilo Instagram,
// com seguidores, seguindo, links de Instagram/Strava e posts recentes.
// ============================================================

import { useState, useEffect } from 'react';
import { social } from '../api';
import { X, UserPlus, UserCheck, MapPin, Activity, ExternalLink, Flame } from 'lucide-react';
import { InstagramIcon, StravaIcon } from './SocialIcons';

export default function AthleteProfileModal({ userId, isOpen, onClose, onFollowChange }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);

  useEffect(() => {
    if (!isOpen || !userId) return;

    async function load() {
      setLoading(true);
      try {
        const res = await social.userProfile(userId);
        if (res?.profile) {
          setData(res.profile);
          setIsFollowing(!!res.profile.is_following);
          setFollowersCount(res.profile.stats?.followers || 0);
        }
      } catch (err) {
        console.error('Athlete profile load error:', err);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [isOpen, userId]);

  const handleToggleFollow = async () => {
    try {
      if (isFollowing) {
        await social.unfollow(userId);
        setIsFollowing(false);
        setFollowersCount((prev) => Math.max(0, prev - 1));
      } else {
        await social.follow(userId);
        setIsFollowing(true);
        setFollowersCount((prev) => prev + 1);
      }
      if (onFollowChange) onFollowChange();
    } catch (err) {
      console.error('Follow toggle error:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-card--athlete-profile" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-wrap">
            <span className="label-mono modal-label">№ 10 / COMUNIDADE</span>
            <h3 className="modal-title">Perfil do Atleta</h3>
          </div>
          <button className="btn-close-modal" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '30px 0', textAlign: 'center' }}>
            <div className="skeleton" style={{ height: 160, borderRadius: 'var(--radius-md)' }} />
          </div>
        ) : data ? (
          <div>
            {/* Header info */}
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div
                className="avatar avatar-lg orange-glow"
                style={{ margin: '0 auto 10px', fontSize: '1.4rem' }}
              >
                {data.name
                  ? data.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
                  : 'AT'}
              </div>
              <h3 className="heading-md" style={{ margin: '0 0 2px' }}>{data.name}</h3>
              <p className="label-mono" style={{ color: 'var(--color-primary)', margin: '0 0 8px' }}>
                @{data.username}
              </p>

              {data.bio && (
                <p className="text-body" style={{ fontSize: '0.8rem', margin: '0 0 10px' }}>
                  {data.bio}
                </p>
              )}

              {/* Social Links (Instagram / Strava) */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 14 }}>
                {data.instagram && (
                  <a
                    href={`https://instagram.com/${data.instagram.replace('@', '')}`}
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
                    <span>@{data.instagram.replace('@', '')}</span>
                  </a>
                )}

                {data.strava && (
                  <a
                    href={data.strava.startsWith('http') ? data.strava : `https://strava.com/athletes/${data.strava}`}
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

              {/* Follow Button (if not self) */}
              {!data.is_self && (
                <button
                  type="button"
                  onClick={handleToggleFollow}
                  className={isFollowing ? 'btn btn-secondary' : 'btn btn-primary'}
                  style={{ width: '100%', padding: '10px', fontSize: '0.85rem' }}
                >
                  {isFollowing ? (
                    <>
                      <UserCheck size={16} /> Seguindo
                    </>
                  ) : (
                    <>
                      <UserPlus size={16} /> Seguir Atleta
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Stats Grid */}
            <div className="stats-grid" style={{ marginBottom: 16 }}>
              <div className="card-surface stat-box" style={{ padding: '10px' }}>
                <div className="scoreboard" style={{ fontSize: '1.3rem', color: 'var(--color-primary)' }}>
                  {followersCount}
                </div>
                <div className="label-mono" style={{ fontSize: '0.6rem' }}>SEGUIDORES</div>
              </div>

              <div className="card-surface stat-box" style={{ padding: '10px' }}>
                <div className="scoreboard" style={{ fontSize: '1.3rem', color: 'var(--text-primary)' }}>
                  {data.stats?.following || 0}
                </div>
                <div className="label-mono" style={{ fontSize: '0.6rem' }}>SEGUINDO</div>
              </div>

              <div className="card-surface stat-box" style={{ padding: '10px' }}>
                <div className="scoreboard" style={{ fontSize: '1.3rem', color: 'var(--status-favorable)' }}>
                  {data.stats?.total_km || 0}
                </div>
                <div className="label-mono" style={{ fontSize: '0.6rem' }}>KM TOTAIS</div>
              </div>

              <div className="card-surface stat-box" style={{ padding: '10px' }}>
                <div className="scoreboard" style={{ fontSize: '1.3rem', color: 'var(--text-primary)' }}>
                  {data.stats?.activities || 0}
                </div>
                <div className="label-mono" style={{ fontSize: '0.6rem' }}>TREINOS</div>
              </div>
            </div>

            {/* Recent Activities */}
            {data.recent_activities && data.recent_activities.length > 0 && (
              <div>
                <span className="label-mono" style={{ fontSize: '0.68rem', display: 'block', marginBottom: 8 }}>
                  ÚLTIMAS ATIVIDADES
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {data.recent_activities.map((act) => (
                    <div key={act.id} className="card-surface" style={{ padding: '10px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-primary)' }}>
                          {act.title || 'Corrida'}
                        </div>
                        <div className="label-mono" style={{ fontSize: '0.65rem', color: 'var(--text-tertiary)' }}>
                          {new Date(act.date).toLocaleDateString('pt-BR')} • {act.avg_pace || '--:--'}
                        </div>
                      </div>
                      <div className="scoreboard" style={{ fontSize: '1rem', color: 'var(--color-primary)' }}>
                        {act.distance_km} KM
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
