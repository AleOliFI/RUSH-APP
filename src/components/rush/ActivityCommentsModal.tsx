// ============================================================
// RUSH RUNNING — Comentários e Kudos de uma atividade
// Carrega likes e comentários reais de GET /api/activities/:id e
// grava novos comentários em POST /api/social/comment/:activityId.
// ============================================================

import React, { useCallback, useEffect, useState } from 'react';
import { ActivityComment } from '../../types';
import { activities as activitiesApi, social } from '../../api';
import { timeAgo } from '../../data/adapters';
import { APP_IMAGES } from '../../data/appAssets';

interface ActivityCommentsModalProps {
  isOpen: boolean;
  activityId: string | null;
  currentUserId: string | null;
  onClose: () => void;
  /** Notifica o feed para atualizar contadores após curtir/comentar. */
  onInteraction?: () => void;
}

interface KudosUser {
  user_id: string;
  name: string;
  username: string;
}

export const ActivityCommentsModal: React.FC<ActivityCommentsModalProps> = ({
  isOpen,
  activityId,
  currentUserId,
  onClose,
  onInteraction,
}) => {
  const [comments, setComments] = useState<ActivityComment[]>([]);
  const [kudosUsers, setKudosUsers] = useState<KudosUser[]>([]);
  const [newCommentText, setNewCommentText] = useState('');
  const [kudoCount, setKudoCount] = useState(0);
  const [hasKudoed, setHasKudoed] = useState(false);
  const [activityTitle, setActivityTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activityId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await activitiesApi.get(activityId);
      setActivityTitle(data.activity?.title || 'atividade');
      setKudoCount(data.likes?.count ?? 0);
      setHasKudoed(!!data.likes?.has_liked);
      setKudosUsers(data.likes?.users || []);
      setComments(
        (data.comments?.items || []).map((c: any) => ({
          id: c.id,
          authorName: c.name || 'Atleta',
          authorHandle: `@${c.username || 'rush'}`,
          authorAvatar: c.avatar_url || APP_IMAGES.headerAvatar,
          timeAgo: timeAgo(c.created_at),
          text: c.content,
          kudosCount: 0,
          isCoach: false,
        })),
      );
    } catch (err: any) {
      setError(err?.message || 'Não foi possível carregar a discussão.');
    } finally {
      setIsLoading(false);
    }
  }, [activityId]);

  useEffect(() => {
    if (isOpen) {
      load();
    } else {
      setComments([]);
      setKudosUsers([]);
      setNewCommentText('');
      setError(null);
    }
  }, [isOpen, load]);

  if (!isOpen || !activityId) return null;

  const handleToggleKudo = async () => {
    try {
      const result = await social.like(activityId);
      setHasKudoed(!!result.liked);
      setKudoCount(result.likes_count ?? kudoCount);
      onInteraction?.();
      load();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível registrar o kudos.');
    }
  };

  const handleAddComment = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const text = newCommentText.trim();
    if (!text || isSending) return;

    setIsSending(true);
    setError(null);
    try {
      await social.comment(activityId, text);
      setNewCommentText('');
      await load();
      onInteraction?.();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível enviar o comentário.');
    } finally {
      setIsSending(false);
    }
  };

  const quickReactions = [
    '🚀 Voo baixo!',
    '🔥 Pace absurdo!',
    '⚡ Máquina pura!',
    '💪 Parabéns pelo RP!',
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="comments-title"
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/92 backdrop-blur-md transition-opacity"
    >
      <div className="flex-1 w-full" onClick={onClose} />

      <div className="relative w-full max-w-xl mx-auto max-h-[92vh] flex flex-col bg-[#0D0D0D] rounded-t-3xl border-t border-[#FF5500]/60 shadow-[0_-12px_45px_rgba(0,0,0,0.95)] overflow-hidden">
        {/* Grab Pill */}
        <div className="w-full flex items-center justify-center pt-3 pb-1">
          <div className="w-12 h-1.5 rounded-full bg-[#353534]" />
        </div>

        {/* Modal Header */}
        <div className="px-5 py-3 flex items-center justify-between border-b border-[#262626]">
          <div>
            <span className="font-label-sm text-[10px] text-[#FF5500] tracking-widest uppercase block">
              PELOTÃO & COMUNIDADE RUSH
            </span>
            <h2 id="comments-title" className="font-headline text-2xl text-[#F7F5F3] uppercase tracking-normal">
              Discussão Tática do Treino
            </h2>
          </div>

          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#1C1C1C] text-[#A1A1AA] hover:text-[#F7F5F3] flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Fechar discussão"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Pelotão que vibrou (Kudos Bar) */}
          <div className="bg-[#1C1C1C] p-4 rounded-2xl border border-[#262626] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleToggleKudo}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-headline uppercase text-xs transition-all cursor-pointer ${
                    hasKudoed
                      ? 'bg-[#FF5500] text-[#0D0D0D] shadow-md'
                      : 'bg-[#262626] hover:bg-[#353534] text-[#F7F5F3]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {hasKudoed ? 'local_fire_department' : 'thumb_up'}
                  </span>
                  <span>{kudoCount} Kudos</span>
                </button>
                <span className="text-xs text-[#A1A1AA] truncate">em “{activityTitle}”</span>
              </div>
              <span className="font-telemetry text-xs text-[#22C55E] font-bold shrink-0">
                {kudoCount} {kudoCount === 1 ? 'ATLETA' : 'ATLETAS'}
              </span>
            </div>

            {/* Quem curtiu */}
            {kudosUsers.length > 0 ? (
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {kudosUsers.map((u) => (
                  <div
                    key={u.user_id}
                    className="w-9 h-9 rounded-full bg-[#262626] border border-[#353534] flex items-center justify-center shrink-0 text-xs font-bold text-[#F7F5F3] uppercase"
                    title={u.name}
                  >
                    {(u.name || u.username || '?').slice(0, 2)}
                  </div>
                ))}
                {kudoCount > kudosUsers.length && (
                  <div className="h-9 px-3 rounded-full bg-[#101010] border border-[#262626] flex items-center justify-center text-xs font-telemetry text-[#A1A1AA] shrink-0">
                    +{kudoCount - kudosUsers.length} outros
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-[#737373]">Ainda sem kudos nesta atividade.</p>
            )}
          </div>

          {/* Quick Reaction Buttons */}
          <div className="space-y-1.5">
            <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase block">
              Reação Rápida
            </span>
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {quickReactions.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => setNewCommentText((prev) => (prev ? `${prev} ${q}` : q))}
                  className="min-h-[44px] bg-[#1C1C1C] hover:bg-[#262626] border border-[#262626] text-xs text-[#F7F5F3] font-bold px-3 py-1.5 rounded-xl whitespace-nowrap transition-all cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Comments Feed List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-headline text-lg text-[#F7F5F3] uppercase tracking-normal">
                Comentários & Análises ({comments.length})
              </h3>
              <span className="font-telemetry text-xs text-[#A1A1AA]">ORDEM CRONOLÓGICA</span>
            </div>

            {isLoading && (
              <p className="text-xs text-[#737373] animate-pulse">Carregando discussão…</p>
            )}

            {error && (
              <p className="text-xs text-[#EF4444] font-bold" role="alert">
                {error}
              </p>
            )}

            {!isLoading && comments.length === 0 && (
              <p className="text-xs text-[#737373] leading-relaxed">
                Nenhum comentário ainda. Seja o primeiro a comentar esta sessão.
              </p>
            )}

            <div className="space-y-3">
              {comments.map((comm) => (
                <div
                  key={comm.id}
                  className="bg-[#1C1C1C] p-4 rounded-2xl border border-[#262626] space-y-2.5 shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <img
                        src={comm.authorAvatar}
                        alt={comm.authorName}
                        className="w-9 h-9 rounded-full object-cover border border-[#353534]"
                      />
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-sm text-[#F7F5F3]">{comm.authorName}</span>
                          {comm.isCoach && (
                            <span className="bg-[#FF5500] text-[#0D0D0D] font-headline text-[9px] px-1.5 py-0.2 rounded uppercase font-black">
                              COACH
                            </span>
                          )}
                        </div>
                        <span className="font-telemetry text-[11px] text-[#A1A1AA]">{comm.authorHandle} • {comm.timeAgo}</span>
                      </div>
                    </div>

                    {comm.tag && (
                      <span className="text-[10px] text-[#A1A1AA] bg-[#101010] px-2 py-0.5 rounded border border-[#262626]">
                        {comm.tag}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-[#e5e2e1] leading-relaxed pl-11">
                    {comm.text}
                  </p>

                  <div className="flex items-center justify-end gap-3 pt-1 border-t border-[#262626] text-xs text-[#A1A1AA]">
                    <button
                      onClick={() => setNewCommentText(`@${comm.authorHandle.replace('@', '')} `)}
                      className="hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[15px]">reply</span>
                      <span>Responder</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Input Bar Fixed at Bottom */}
        <form
          onSubmit={handleAddComment}
          className="p-3 bg-[#1C1C1C] border-t border-[#262626] flex items-center gap-2"
        >
          <input
            type="text"
            value={newCommentText}
            onChange={(e) => setNewCommentText(e.target.value)}
            placeholder="Enviar observação técnica ou parabéns..."
            className="flex-1 bg-[#101010] border border-[#262626] rounded-xl px-3.5 py-2.5 text-xs text-[#F7F5F3] placeholder-[#737373] focus:outline-none focus:border-[#FF5500]"
          />
          <button
            type="submit"
            disabled={!newCommentText.trim() || isSending}
            className="min-h-[44px] px-4 py-2.5 bg-[#FF5500] hover:bg-[#FF6B00] disabled:opacity-40 disabled:cursor-wait text-[#0D0D0D] font-headline text-sm uppercase tracking-wider rounded-xl transition-all cursor-pointer shrink-0"
          >
            {isSending ? '…' : 'Enviar'}
          </button>
        </form>
      </div>
    </div>
  );
};
