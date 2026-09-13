import React, { useState } from 'react';
import { FEED_POSTS } from '../data/appAssets';
import { FeedPost, ImageViewerItem } from '../types';
import { downloadImageToDevice } from '../utils/imageDownload';

interface FeedScreenProps {
  onOpenNewPost: () => void;
  onOpenComments: (postId: string) => void;
  onViewImage: (item: ImageViewerItem) => void;
  userPosts: FeedPost[];
}

export const FeedScreen: React.FC<FeedScreenProps> = ({
  onOpenNewPost,
  onOpenComments,
  onViewImage,
  userPosts,
}) => {
  const [feedChannel, setFeedChannel] = useState<'foryou' | 'following' | 'club'>('foryou');
  const [posts, setPosts] = useState<FeedPost[]>(FEED_POSTS);

  const allPosts = [...userPosts, ...posts];

  const handleToggleKudo = (postId: string) => {
    setPosts((prev) =>
      prev.map((p) => {
        if (p.id === postId) {
          const isK = !p.isKudoed;
          return {
            ...p,
            isKudoed: isK,
            kudosCount: isK ? p.kudosCount + 1 : p.kudosCount - 1,
          };
        }
        return p;
      })
    );
  };

  return (
    <div className="w-full max-w-2xl mx-auto px-4 py-3 space-y-5 pb-28">
      {/* Channel Switcher */}
      <div className="flex items-center justify-between border-b border-[#262626] pb-2">
        <div className="flex items-center gap-2">
          {[
            { id: 'foryou', label: 'Para Você' },
            { id: 'following', label: 'Seguindo' },
            { id: 'club', label: 'Clube Rush Pro' },
          ].map((ch) => (
            <button
              key={ch.id}
              onClick={() => setFeedChannel(ch.id as any)}
              className={`min-h-[44px] py-1.5 px-3 rounded-full text-xs font-bold uppercase transition-all cursor-pointer ${
                feedChannel === ch.id
                  ? 'bg-[#FF5500] text-[#0D0D0D] shadow-md'
                  : 'bg-[#1C1C1C] text-[#A1A1AA] hover:text-[#F7F5F3]'
              }`}
            >
              {ch.label}
            </button>
          ))}
        </div>

        <button
          onClick={onOpenNewPost}
          className="min-h-[44px] bg-[#FF5500] hover:bg-[#FF6B00] text-[#0D0D0D] text-xs font-headline uppercase px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-md transition-all cursor-pointer shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          <span>Postar</span>
        </button>
      </div>

      {/* Quick Composer Card */}
      <div
        onClick={onOpenNewPost}
        className="bg-[#1C1C1C] rounded-2xl p-3.5 border border-[#262626] flex items-center gap-3 cursor-pointer hover:border-[#FF5500]/50 transition-all shadow-md"
      >
        <div className="w-9 h-9 rounded-full bg-[#FF5500]/15 flex items-center justify-center text-[#FF5500] shrink-0">
          <span className="material-symbols-outlined text-[20px]">edit_note</span>
        </div>
        <span className="text-xs text-[#737373] flex-1">
          Compartilhar corrida, fotos ou novo split com a comunidade...
        </span>
        <span className="bg-[#262626] text-xs text-[#A1A1AA] font-bold px-2.5 py-1 rounded-lg uppercase">
          Novo Post
        </span>
      </div>

      {/* Posts List */}
      <div className="space-y-5">
        {allPosts.map((post) => (
          <article
            key={post.id}
            className="bg-[#1C1C1C] rounded-2xl border border-[#262626] overflow-hidden shadow-lg space-y-3"
          >
            {/* Post Header */}
            <div className="p-4 pb-0 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={post.authorAvatar}
                  alt={post.authorName}
                  className="w-11 h-11 rounded-full object-cover border border-[#353534]"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-[#F7F5F3]">{post.authorName}</span>
                    {post.isPro && (
                      <span className="bg-[#FF5500] text-[#0D0D0D] text-[9px] font-headline font-black px-1.5 py-0.2 rounded uppercase">
                        PRO
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-[#A1A1AA] font-telemetry">
                    <span>{post.location}</span>
                    <span>•</span>
                    <span>{post.timeAgo}</span>
                  </div>
                </div>
              </div>

              {post.sensorBadge && (
                <span className="text-[10px] text-[#22C55E] bg-[#22C55E]/10 px-2 py-0.5 rounded border border-[#22C55E]/30 font-telemetry font-bold">
                  {post.sensorBadge}
                </span>
              )}
            </div>

            {/* Caption */}
            <p className="px-4 text-xs text-[#e5e2e1] leading-relaxed">
              {post.caption}
            </p>

            {/* Attached Telemetry Box */}
            {post.workoutTitle && (
              <div className="mx-4 bg-[#101010] p-3 rounded-xl border border-[#262626] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-headline text-sm text-[#F7F5F3] uppercase tracking-wide">
                    {post.workoutTitle}
                  </span>
                  {post.badgeText && (
                    <span className="bg-[#22C55E]/20 text-[#22C55E] font-telemetry text-xs font-bold px-2 py-0.5 rounded">
                      {post.badgeText} ({post.badgeDiff})
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-4 gap-2 text-center text-xs font-telemetry">
                  <div>
                    <span className="text-[9px] text-[#A1A1AA] uppercase block">DISTÂNCIA</span>
                    <span className="font-headline text-base text-[#F7F5F3] block mt-0.5">
                      {post.distanceKm} km
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-[#A1A1AA] uppercase block">TEMPO</span>
                    <span className="font-headline text-base text-[#F7F5F3] block mt-0.5">
                      {post.duration}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-[#A1A1AA] uppercase block">RITMO</span>
                    <span className="font-headline text-base text-[#FF5500] block mt-0.5">
                      {post.avgPace}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9px] text-[#A1A1AA] uppercase block">FC MÉDIA</span>
                    <span className="font-headline text-base text-[#EF4444] block mt-0.5">
                      {post.avgHr} bpm
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Activity Photo with View & Download */}
            {post.activityPhoto && (
              <div className="relative h-64 w-full bg-[#101010] overflow-hidden">
                <img
                  src={post.activityPhoto}
                  alt={`Treino de ${post.authorName}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

                {/* Overlaid buttons */}
                <div className="absolute bottom-3 right-3 flex items-center gap-2">
                  <button
                    onClick={() =>
                      onViewImage({
                        url: post.activityPhoto!,
                        title: `Treino de ${post.authorName}`,
                        subtitle: `${post.distanceKm} km • ${post.location}`,
                        category: 'FEED DA COMUNIDADE',
                        filename: `rush_feed_${post.id}.jpg`,
                      })
                    }
                    className="min-h-[44px] min-w-[44px] bg-[#0D0D0D]/80 hover:bg-black text-white p-2.5 rounded-xl border border-white/20 flex items-center justify-center backdrop-blur-md transition-all cursor-pointer"
                    title="Ver em tela cheia"
                  >
                    <span className="material-symbols-outlined text-[18px]">zoom_in</span>
                  </button>
                  <button
                    onClick={() =>
                      downloadImageToDevice(
                        post.activityPhoto!,
                        `rush_feed_${post.id}.jpg`,
                        `Foto do Treino (${post.authorName})`
                      )
                    }
                    className="min-h-[44px] min-w-[44px] bg-[#FF5500] hover:bg-[#FF6B00] text-[#0D0D0D] p-2.5 rounded-xl flex items-center justify-center font-bold shadow-md transition-all cursor-pointer"
                    title="Baixar imagem"
                  >
                    <span className="material-symbols-outlined text-[18px]">download</span>
                  </button>
                </div>
              </div>
            )}

            {/* Interaction Bar */}
            <div className="px-4 pb-3 flex items-center justify-between border-t border-[#262626] pt-2.5 text-xs text-[#A1A1AA]">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => handleToggleKudo(post.id)}
                  className={`min-h-[44px] flex items-center gap-1.5 font-headline uppercase transition-colors cursor-pointer ${
                    post.isKudoed ? 'text-[#FF5500]' : 'hover:text-[#F7F5F3]'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {post.isKudoed ? 'local_fire_department' : 'thumb_up'}
                  </span>
                  <span>{post.kudosCount} Kudos</span>
                </button>

                <button
                  onClick={() => onOpenComments(post.id)}
                  className="min-h-[44px] flex items-center gap-1.5 hover:text-[#F7F5F3] transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">chat_bubble_outline</span>
                  <span>{post.commentsCount} Comentários</span>
                </button>
              </div>

              <button
                onClick={() => onOpenComments(post.id)}
                className="hover:text-white flex items-center gap-1 text-xs cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">share</span>
                <span>Compartilhar</span>
              </button>
            </div>
          </article>
        ))}

        {/* Challenge Banner: Desafio Rush 100K */}
        <div className="bg-gradient-to-r from-[#FF5500]/20 to-[#1C1C1C] rounded-2xl border border-[#FF5500]/40 p-4 shadow-lg space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#FF5500] text-[24px]">flag</span>
              <span className="font-headline text-lg text-[#F7F5F3] uppercase tracking-wide">
                Desafio Rush 100K Mensal
              </span>
            </div>
            <span className="font-telemetry text-xs text-[#FF5500] font-bold">14 DIAS RESTANTES</span>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs font-telemetry">
              <span className="text-[#A1A1AA]">Seu progresso: 64.2 km / 100 km</span>
              <span className="text-[#22C55E] font-bold">64.2%</span>
            </div>
            <div className="w-full h-2 bg-[#101010] rounded-full overflow-hidden border border-[#262626]">
              <div className="h-full bg-[#FF5500] rounded-full" style={{ width: '64.2%' }} />
            </div>
          </div>

          <div className="flex items-center justify-between text-xs pt-1 border-t border-[#262626]">
            <span className="text-[#A1A1AA]">Líder da sua faixa: Lucas Viana (148.4 km)</span>
            <button
              onClick={() => alert('Convite enviado para o pelotão!')}
              className="text-[#FF5500] font-bold hover:underline cursor-pointer"
            >
              Convidar Amigo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
