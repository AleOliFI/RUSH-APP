import React, { useState } from 'react';
import { ACTIVITY_COMMENTS } from '../../data/appAssets';
import { ActivityComment } from '../../types';

interface ActivityCommentsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ActivityCommentsModal: React.FC<ActivityCommentsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const [comments, setComments] = useState<ActivityComment[]>(ACTIVITY_COMMENTS);
  const [newCommentText, setNewCommentText] = useState('');
  const [kudoCount, setKudoCount] = useState(142);
  const [hasKudoed, setHasKudoed] = useState(false);

  if (!isOpen) return null;

  const handleToggleKudo = () => {
    if (hasKudoed) {
      setKudoCount((prev) => prev - 1);
      setHasKudoed(false);
    } else {
      setKudoCount((prev) => prev + 1);
      setHasKudoed(true);
    }
  };

  const handleAddComment = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newCommentText.trim()) return;

    const newComment: ActivityComment = {
      id: `comm-${Date.now()}`,
      authorName: 'Você (Mariana Vasconcelos)',
      authorHandle: '@marianarun',
      authorAvatar: 'https://lh3.googleusercontent.com/aida/AEtjO1XvPhuypywyEQ-BrcL4kOil_ogDeBTC7pBDUl6sF-u0oU6VvOXP7c2AxkfgB9S3WRxs-GfGu83DTMq-BTGSnatAyGhKqFXYAbczKQ8uqwBbcysq5W64Gt0EdwOSVkthPJoTLg-2IzFznXTC4YoI5E9Mxm7OK7UmaGbIuPWBQGTd9ed8Ss28WaSvvdla7n68xmmKHLkfdH6zKF22K8VQbUtCAPzmD7oBYMO1S1OCMYeHoGsweLFBd6oO7NM',
      timeAgo: 'Agora mesmo',
      text: newCommentText.trim(),
      kudosCount: 1,
      tag: 'Geral',
    };

    setComments((prev) => [newComment, ...prev]);
    setNewCommentText('');
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
                <span className="text-xs text-[#A1A1AA]">no treino de 21K</span>
              </div>
              <span className="font-telemetry text-xs text-[#22C55E] font-bold">142 ATLETAS</span>
            </div>

            {/* Avatares Carrossel */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {[
                { name: 'Beto', emoji: '🔥' },
                { name: 'Carol', emoji: '🚀' },
                { name: 'Marcos', emoji: '⚡' },
                { name: 'Aline', emoji: '👟' },
                { name: 'Diego', emoji: '💪' },
                { name: 'Fernanda', emoji: '🔥' },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="w-9 h-9 rounded-full bg-[#262626] border border-[#353534] flex items-center justify-center shrink-0 text-sm"
                  title={item.name}
                >
                  {item.emoji}
                </div>
              ))}
              <div className="h-9 px-3 rounded-full bg-[#101010] border border-[#262626] flex items-center justify-center text-xs font-telemetry text-[#A1A1AA] shrink-0">
                +136 outros
              </div>
            </div>
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
                    <button className="hover:text-[#FF5500] flex items-center gap-1 cursor-pointer">
                      <span className="material-symbols-outlined text-[15px]">thumb_up</span>
                      <span>{comm.kudosCount}</span>
                    </button>
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
            disabled={!newCommentText.trim()}
            className="min-h-[44px] px-4 py-2.5 bg-[#FF5500] hover:bg-[#FF6B00] disabled:opacity-40 text-[#0D0D0D] font-headline text-sm uppercase tracking-wider rounded-xl transition-all cursor-pointer shrink-0"
          >
            Enviar
          </button>
        </form>
      </div>
    </div>
  );
};
