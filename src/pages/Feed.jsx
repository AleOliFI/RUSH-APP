// ============================================================
// RUSH PERFORMANCE — Sports Community Feed (Instagram Style)
//
// Feed social completo com fotos de treino, RPE, comentários,
// seguidores, busca de atletas e perfil detalhado.
// ============================================================

import { useState, useEffect } from 'react';
import { social } from '../api';
import { 
  Heart, MessageCircle, Share2, Flame, MapPin, Activity, 
  Plus, Search, Star, Send, X, UserPlus, UserCheck, Sparkles 
} from 'lucide-react';
import PostWorkoutModal from '../components/PostWorkoutModal';
import AthleteProfileModal from '../components/AthleteProfileModal';

export default function Feed({ user }) {
  const [feed, setFeed] = useState([]);
  const [scope, setScope] = useState('following');
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Modals
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [selectedAthleteId, setSelectedAthleteId] = useState(null);

  // Comments state per post
  const [activeCommentPostId, setActiveCommentPostId] = useState(null);
  const [commentText, setCommentText] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);

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

  const handleSearch = async (q) => {
    setSearchQuery(q);
    if (!q || q.trim().length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    try {
      const res = await social.search(q.trim());
      setSearchResults(res?.users || []);
    } catch (e) {
      console.error('Search error:', e);
    }
  };

  const handleSendComment = async (activityId) => {
    if (!commentText.trim()) return;
    setSubmittingComment(true);
    try {
      await social.comment(activityId, commentText.trim());
      setCommentText('');
      setActiveCommentPostId(null);
      // Reload feed to update comments count
      await loadFeed();
    } catch (err) {
      console.error('Comment error:', err);
    } finally {
      setSubmittingComment(false);
    }
  };

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

        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => setIsPostModalOpen(true)}
          style={{ fontSize: '0.75rem', padding: '6px 12px' }}
        >
          <Plus size={14} /> Novo Treino
        </button>
      </div>

      {/* Search Athletes Bar */}
      <div style={{ marginBottom: 14, position: 'relative' }}>
        <div className="input-wrapper">
          <Search size={15} className="input-icon" />
          <input
            type="text"
            placeholder="Buscar atletas, amigos ou assessorias..."
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="input-field"
            style={{ fontSize: '0.82rem', paddingLeft: 36 }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSearchResults([]);
                setIsSearching(false);
              }}
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-tertiary)',
                cursor: 'pointer',
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Search Results Dropdown */}
        {isSearching && searchResults.length > 0 && (
          <div
            className="card-surface"
            style={{
              position: 'absolute',
              top: '100%',
              left: 0,
              right: 0,
              zIndex: 30,
              marginTop: 4,
              padding: '8px',
              borderRadius: 'var(--radius-md)',
              maxHeight: 240,
              overflowY: 'auto',
              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            }}
          >
            {searchResults.map((u) => (
              <div
                key={u.user_id}
                onClick={() => {
                  setSelectedAthleteId(u.user_id);
                  setIsSearching(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="avatar avatar-sm">
                    {u.name ? u.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase() : 'AT'}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{u.name}</div>
                    <div className="label-mono" style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>@{u.username}</div>
                  </div>
                </div>
                <span className="label-mono" style={{ fontSize: '0.65rem', color: 'var(--color-primary)' }}>
                  VER PERFIL →
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Scope Segmented Tabs */}
      <div className="tabs" style={{ marginBottom: 16 }}>
        {[
          { id: 'following', label: 'Seguindo' },
          { id: 'global', label: 'Explorar' },
          { id: 'academy', label: 'Assessoria' },
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
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setIsPostModalOpen(true)}
            style={{ marginTop: 12 }}
          >
            <Plus size={14} /> Publicar Primeiro Treino
          </button>
        </div>
      ) : (
        feed.map((item, index) => (
          <div className="feed-card" key={item.id} style={{ marginBottom: 16 }}>
            {/* Header */}
            <div
              className="feed-header"
              style={{ cursor: 'pointer' }}
              onClick={() => setSelectedAthleteId(item.user_id)}
            >
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

              {item.rpe_score && (
                <span
                  className="status-badge"
                  style={{
                    fontSize: '0.65rem',
                    background: item.rpe_score <= 4 ? 'rgba(0,214,143,0.15)' : item.rpe_score <= 7 ? 'rgba(255,184,0,0.15)' : 'rgba(255,59,92,0.15)',
                    color: item.rpe_score <= 4 ? 'var(--status-favorable)' : item.rpe_score <= 7 ? 'var(--status-attention)' : 'var(--status-recovery)',
                    border: '1px solid currentColor',
                  }}
                >
                  RPE {item.rpe_score}/10
                </span>
              )}
            </div>

            {/* Instagram Style Workout Photo */}
            {item.image_url && (
              <div style={{ width: '100%', maxHeight: 340, overflow: 'hidden', background: '#000' }}>
                <img
                  src={item.image_url}
                  alt={item.title || 'Treino'}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              </div>
            )}

            {/* Body */}
            <div className="feed-body" style={{ padding: '14px 16px 10px' }}>
              <h3 style={{ fontWeight: 700, fontSize: '0.96rem', marginBottom: 8, color: 'var(--text-primary)' }}>
                {item.title}
              </h3>

              {item.feeling_notes && (
                <p className="text-body" style={{ fontSize: '0.82rem', marginBottom: 12, fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                  "{item.feeling_notes}"
                </p>
              )}

              {/* 3-Column Scoreboard Metrics */}
              <div className="feed-stats-row" style={{ marginBottom: 10 }}>
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
                <div className="flex items-center gap-sm" style={{ marginTop: 6 }}>
                  <Heart size={13} color="var(--status-recovery)" />
                  <span className="label-mono" style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                    FC MÉDIA: <strong style={{ color: 'var(--text-primary)' }}>{item.avg_hr} BPM</strong>
                  </span>
                </div>
              )}
            </div>

            {/* Actions (Like, Comment, Share) */}
            <div className="feed-actions" style={{ padding: '8px 16px 12px', borderTop: '1px solid var(--border-secondary)' }}>
              <button
                type="button"
                className={`feed-action${item.has_liked ? ' liked' : ''}`}
                onClick={() => handleLike(item.id, index)}
              >
                <Heart size={18} fill={item.has_liked ? 'var(--status-recovery)' : 'none'} color={item.has_liked ? 'var(--status-recovery)' : 'currentColor'} />
                <span className="scoreboard">{item.likes_count || 0}</span>
              </button>

              <button
                type="button"
                className="feed-action"
                onClick={() => setActiveCommentPostId(activeCommentPostId === item.id ? null : item.id)}
              >
                <MessageCircle size={18} />
                <span className="scoreboard">{item.comments_count || 0}</span>
              </button>

              <button type="button" className="feed-action" style={{ marginLeft: 'auto' }}>
                <Share2 size={16} />
              </button>
            </div>

            {/* Comment Drawer if opened */}
            {activeCommentPostId === item.id && (
              <div style={{ padding: '0 16px 14px', animation: 'fadeIn 0.2s ease-in-out' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    placeholder="Adicionar comentário..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendComment(item.id)}
                    className="input-field"
                    style={{ flex: 1, fontSize: '0.8rem', padding: '8px 12px' }}
                  />
                  <button
                    type="button"
                    disabled={submittingComment || !commentText.trim()}
                    onClick={() => handleSendComment(item.id)}
                    className="btn btn-primary btn-sm"
                    style={{ padding: '8px 12px' }}
                  >
                    <Send size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))
      )}

      {/* Post Workout Modal */}
      <PostWorkoutModal
        isOpen={isPostModalOpen}
        onClose={() => setIsPostModalOpen(false)}
        onSaved={async () => {
          await loadFeed();
        }}
      />

      {/* Athlete Public Profile Modal */}
      <AthleteProfileModal
        userId={selectedAthleteId}
        isOpen={!!selectedAthleteId}
        onClose={() => setSelectedAthleteId(null)}
        onFollowChange={async () => {
          await loadFeed();
        }}
      />
    </div>
  );
}
