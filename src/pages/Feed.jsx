// ============================================================
// RUSH PERFORMANCE — Sports Community Feed
// Activity feed & social interaction matching rushperformance.com.br
// ============================================================

import { useState, useEffect } from 'react';
import { social } from '../api';
import { Heart, MessageCircle, Share2, Flame, MapPin, Activity } from 'lucide-react';

export default function Feed({ user }) {
  const [feed, setFeed] = useState([]);
  const [scope, setScope] = useState('following');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFeed();
  }, [scope]);

  async function loadFeed() {
    setLoading(true);
    try {
      const data = await social.feed(scope);
      setFeed(data?.feed || []);
    } catch (e) {
      console.error('Feed loading error:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleLike(activityId, index) {
    try {
      const res = await social.like(activityId);
      setFeed((prev) =>
        prev.map((item, i) =>
          i === index ? { ...item, has_liked: res.liked, likes_count: res.likes_count } : item
        )
      );
    } catch (e) {
      console.error('Like toggle error:', e);
    }
  }

  function formatDate(dateStr) {
    if (!dateStr) return 'Recente';
    const d = new Date(dateStr);
    const now = new Date();
    const diffH = Math.floor((now - d) / 3600000);
    if (diffH < 1) return 'Agora';
    if (diffH < 24) return `${diffH}h atrás`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 7) return `${diffD}d atrás`;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  }

  const HRV_DOT_CLASSES = {
    favorable: 'live-dot--favorable',
    attention: 'live-dot--attention',
    recovery: 'live-dot--recovery',
  };

  return (
    <div className="page">
      {/* Top Header */}
      <div className="top-bar">
        <div>
          <div className="flex items-center gap-sm">
            <span className="live-dot" />
            <span className="label-mono">№ 02 / COMUNIDADE</span>
          </div>
          <h1 className="heading-lg">FEED SOCIAL</h1>
        </div>
      </div>

      {/* Scope Segmented Tabs */}
      <div className="tabs">
        {[
          { id: 'following', label: 'Seguindo' },
          { id: 'academy', label: 'Assessoria' },
          { id: 'global', label: 'Global' },
        ].map((t) => (
          <button
            key={t.id}
            type="button"
            className={`tab${scope === t.id ? ' active' : ''}`}
            onClick={() => setScope(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="skeleton" style={{ height: 210, borderRadius: 16 }} />
          ))}
        </div>
      ) : feed.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🏃</div>
          <p className="heading-md" style={{ marginBottom: 6 }}>Nenhuma atividade ainda</p>
          <p className="empty-state-text">
            {scope === 'following'
              ? 'Siga atletas ou parceiros de treino para acompanhar suas corridas em tempo real.'
              : 'Nenhuma atividade registrada nesta categoria.'}
          </p>
        </div>
      ) : (
        feed.map((item, index) => (
          <div className="feed-card" key={item.id}>
            {/* Header */}
            <div className="feed-header">
              <div className="avatar">{item.initials || 'AT'}</div>
              <div className="flex-1">
                <div className="flex items-center gap-sm">
                  <span style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                    {item.name}
                  </span>
                  {item.hrv_status_display && (
                    <span
                      className={`live-dot ${HRV_DOT_CLASSES[item.hrv_status_display] || ''}`}
                      title={`VFC: ${item.hrv_status_display}`}
                      style={{ width: 7, height: 7 }}
                    />
                  )}
                </div>
                <div className="flex items-center gap-sm">
                  <span className="label-mono" style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>
                    @{item.username}
                  </span>
                  <span className="label-mono" style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>
                    ·
                  </span>
                  <span className="label-mono" style={{ fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>
                    {formatDate(item.date)}
                  </span>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="feed-body">
              <h3 style={{ fontWeight: 700, fontSize: '0.96rem', marginBottom: 10, color: 'var(--text-primary)' }}>
                {item.title}
              </h3>

              {/* 3-Column Scoreboard Metrics */}
              <div className="feed-stats-row">
                <div className="feed-stat">
                  <div className="feed-stat-value scoreboard">
                    {item.distance_km} <span style={{ fontSize: '0.75rem' }}>KM</span>
                  </div>
                  <div className="feed-stat-label">Distância</div>
                </div>
                <div className="feed-stat">
                  <div className="feed-stat-value scoreboard">
                    {item.duration_formatted || '--'}
                  </div>
                  <div className="feed-stat-label">Tempo</div>
                </div>
                <div className="feed-stat">
                  <div className="feed-stat-value scoreboard">
                    {item.avg_pace || '--'}
                  </div>
                  <div className="feed-stat-label">Pace Médio</div>
                </div>
              </div>

              {item.avg_hr && (
                <div className="flex items-center gap-sm" style={{ marginTop: 8 }}>
                  <Heart size={14} color="var(--status-recovery)" />
                  <span className="label-mono" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    FC MÉDIA: <strong style={{ color: 'var(--text-primary)' }}>{item.avg_hr} BPM</strong>
                  </span>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="feed-actions">
              <button
                type="button"
                className={`feed-action${item.has_liked ? ' liked' : ''}`}
                onClick={() => handleLike(item.id, index)}
              >
                <Heart size={18} fill={item.has_liked ? 'var(--status-recovery)' : 'none'} />
                <span className="scoreboard">{item.likes_count || 0}</span>
              </button>

              <button type="button" className="feed-action">
                <MessageCircle size={18} />
                <span className="scoreboard">{item.comments_count || 0}</span>
              </button>

              <button type="button" className="feed-action" style={{ marginLeft: 'auto' }}>
                <Share2 size={16} />
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
