// ============================================================
// RUSH RUNNING — Perfil público de um atleta
// ------------------------------------------------------------
// O que aparece aqui é decidido pelo dono do perfil, não por quem
// olha. Quando ele esconde as atividades ou as conquistas, a tela
// diz que estão ocultas — não finge que o atleta nunca correu.
//
// O desenho trazia a garagem de tênis e gráficos de carga semanal
// do atleta. Nenhum dos dois foi construído: são dados de treino
// privados, que não passam pelas flags de privacidade existentes.
// ============================================================

import React from 'react';
import { Avatar } from '../components/rush/Avatar';
import { formatDuration, paceFromActivity, timeAgo } from '../data/adapters';
import { RECORD_DISTANCES } from '../hooks/useSocial';
import type { PublicAthleteProfile } from '../hooks/useSocial';

interface PublicProfileScreenProps {
  profile: PublicAthleteProfile | null;
  isLoading: boolean;
  error: string | null;
  onToggleFollow: () => Promise<void>;
  onBack: () => void;
}

const TIPO_ROTULO: Record<string, string> = {
  run: 'Corrida',
  trail_run: 'Trilha',
  treadmill: 'Esteira',
  walk: 'Caminhada',
  cycling: 'Pedal',
  swimming: 'Natação',
  strength: 'Força',
  other: 'Outro',
};

const Aviso: React.FC<{ icone: string; texto: string }> = ({ icone, texto }) => (
  <div className="bg-[#1C1C1C] rounded-2xl border border-[#262626] p-5 flex items-center gap-3">
    <span className="material-symbols-outlined text-[#525252] text-[22px] shrink-0">{icone}</span>
    <span className="text-xs text-[#737373] leading-relaxed">{texto}</span>
  </div>
);

export const PublicProfileScreen: React.FC<PublicProfileScreenProps> = ({
  profile,
  isLoading,
  error,
  onToggleFollow,
  onBack,
}) => {
  const [alternando, setAlternando] = React.useState(false);

  const voltar = (
    <button
      type="button"
      onClick={onBack}
      aria-label="Voltar"
      className="w-10 h-10 rounded-xl bg-[#1C1C1C] border border-[#262626] flex items-center justify-center text-[#F7F5F3] shrink-0 cursor-pointer hover:bg-[#262626] transition-colors"
    >
      <span className="material-symbols-outlined text-[20px]">arrow_back</span>
    </button>
  );

  if (isLoading && !profile) {
    return (
      <div className="w-full max-w-2xl mx-auto px-4 sm:px-5 pt-2 pb-8 space-y-4">
        {voltar}
        <div className="bg-[#1C1C1C] rounded-2xl border border-[#262626] p-6 text-center">
          <span className="font-telemetry text-xs text-[#737373] uppercase tracking-widest animate-pulse">
            Carregando perfil…
          </span>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="w-full max-w-2xl mx-auto px-4 sm:px-5 pt-2 pb-8 space-y-4">
        {voltar}
        <div role="alert" className="bg-[#EF4444]/12 border border-[#EF4444]/40 rounded-xl px-4 py-3">
          <span className="text-xs text-[#e5e2e1]">{error || 'Atleta não encontrado.'}</span>
        </div>
      </div>
    );
  }

  const seguir = async () => {
    setAlternando(true);
    try {
      await onToggleFollow();
    } finally {
      setAlternando(false);
    }
  };

  const recordesComMarca = profile.records
    ? RECORD_DISTANCES.filter((d) => profile.records?.[d.key])
    : [];

  const estatisticas = [
    { rotulo: 'Seguidores', valor: profile.stats.followers },
    { rotulo: 'Seguindo', valor: profile.stats.following },
    { rotulo: 'Atividades', valor: profile.stats.activities },
    { rotulo: 'Km totais', valor: profile.stats.total_km },
  ];

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto px-4 sm:px-5 space-y-4 pt-2 pb-8">
      {/* Cabeçalho */}
      <div className="flex items-center gap-2 border-b border-[#262626] pb-3">
        {voltar}
        <div className="min-w-0 flex-1">
          <span className="font-label-caps text-[10px] text-[#FF5500] uppercase tracking-widest font-extrabold block">
            Perfil público
          </span>
          <h1 className="font-headline-md text-[#F7F5F3] uppercase tracking-tight leading-none truncate">
            {profile.name}
          </h1>
        </div>
      </div>

      {/* Identificação */}
      <div className="bg-[#1C1C1C] rounded-2xl border border-[#262626] p-4 space-y-3.5">
        <div className="flex items-center gap-3.5">
          <Avatar
            src={profile.avatar_url}
            name={profile.name}
            className="w-16 h-16 rounded-full object-cover shrink-0 border border-[#353534]"
            initialsClassName="text-lg"
          />
          <div className="min-w-0 flex-1">
            <span className="font-headline text-lg uppercase text-[#F7F5F3] block leading-tight truncate">
              {profile.name}
            </span>
            <span className="text-xs text-[#737373] block truncate">@{profile.username}</span>
            {profile.location && (
              <span className="text-[11px] text-[#737373] flex items-center gap-1 mt-0.5">
                <span className="material-symbols-outlined text-[14px]">location_on</span>
                {profile.location}
              </span>
            )}
          </div>
        </div>

        {profile.bio && (
          <p className="text-xs text-[#A1A1AA] leading-relaxed">{profile.bio}</p>
        )}

        {!profile.is_self && (
          <button
            type="button"
            onClick={seguir}
            disabled={alternando}
            aria-pressed={profile.is_following}
            aria-label={`${profile.is_following ? 'Deixar de seguir' : 'Seguir'} ${profile.name}`}
            className={`w-full min-h-[52px] rounded-xl font-headline text-sm uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
              profile.is_following
                ? 'bg-[#101010] border border-[#262626] text-[#A1A1AA] hover:text-[#F7F5F3]'
                : 'bg-[#FF5500] hover:bg-[#FF6B00] text-[#0D0D0D]'
            }`}
          >
            <span className="material-symbols-outlined text-[20px]">
              {profile.is_following ? 'how_to_reg' : 'person_add'}
            </span>
            <span>{profile.is_following ? 'Seguindo' : 'Seguir atleta'}</span>
          </button>
        )}
      </div>

      {/* Números */}
      <div className="grid grid-cols-4 gap-2">
        {estatisticas.map((item) => (
          <div
            key={item.rotulo}
            className="bg-[#1C1C1C] rounded-xl border border-[#262626] p-3 text-center"
          >
            <span className="font-telemetry text-base text-[#F7F5F3] font-black block leading-none">
              {item.valor}
            </span>
            <span className="text-[9px] text-[#737373] uppercase tracking-widest block mt-1">
              {item.rotulo}
            </span>
          </div>
        ))}
      </div>

      {profile.vo2max && (
        <div className="bg-[#1C1C1C] rounded-2xl border border-[#262626] p-4 flex items-center gap-3">
          <span className="material-symbols-outlined text-[#38BDF8] text-[22px]">monitoring</span>
          <div>
            <span className="font-headline text-sm uppercase text-[#F7F5F3] block leading-tight">
              VO₂máx {profile.vo2max.value}
            </span>
            <span className="text-[11px] text-[#737373]">
              ml/kg/min • estimado em {new Date(profile.vo2max.date).toLocaleDateString('pt-BR')}
            </span>
          </div>
        </div>
      )}

      {/* Recordes */}
      <div className="space-y-2">
        <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase tracking-widest block">
          Recordes pessoais
        </span>

        {profile.privacy.records_hidden ? (
          <Aviso
            icone="lock"
            texto={`${profile.name.split(' ')[0]} mantém os recordes fora do perfil público.`}
          />
        ) : recordesComMarca.length === 0 ? (
          <Aviso
            icone="timer"
            texto="Nenhuma corrida pública atingiu 5 km ainda — por isso não há recorde a mostrar."
          />
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {recordesComMarca.map((distancia) => {
              const recorde = profile.records![distancia.key]!;
              return (
                <div
                  key={distancia.key}
                  className="bg-[#1C1C1C] rounded-xl border border-[#262626] p-3.5"
                >
                  <span className="font-label-sm text-[10px] text-[#FF5500] uppercase tracking-widest block">
                    {distancia.label}
                  </span>
                  <span className="font-telemetry text-lg text-[#F7F5F3] font-black block leading-none mt-1">
                    {recorde.formatted}
                  </span>
                  <span className="text-[10px] text-[#737373] block mt-1">
                    {recorde.avg_pace || '—'} • {new Date(recorde.date).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {!profile.privacy.records_hidden && recordesComMarca.length > 0 && (
          <span className="text-[10px] text-[#737373] leading-relaxed block">
            Tempo normalizado para a distância oficial pelo pace médio da corrida, considerando
            apenas atividades públicas.
          </span>
        )}
      </div>

      {/* Atividades públicas */}
      <div className="space-y-2">
        <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase tracking-widest block">
          Atividades recentes
        </span>

        {profile.privacy.activities_hidden ? (
          <Aviso
            icone="visibility_off"
            texto={`${profile.name.split(' ')[0]} mantém as atividades privadas.`}
          />
        ) : profile.recent_activities.length === 0 ? (
          <Aviso icone="directions_run" texto="Nenhuma atividade pública publicada até agora." />
        ) : (
          <div className="space-y-2">
            {profile.recent_activities.map((atividade: any) => {
              const distancia = Number(atividade.distance_km) || 0;
              const duracao = Number(atividade.duration_seconds) || 0;
              return (
                <div
                  key={atividade.id}
                  className="bg-[#1C1C1C] rounded-xl border border-[#262626] p-3.5 flex items-center gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <span className="font-headline text-sm uppercase text-[#F7F5F3] block truncate leading-tight">
                      {atividade.title || TIPO_ROTULO[atividade.type] || 'Atividade'}
                    </span>
                    <span className="text-[11px] text-[#737373] block">
                      {TIPO_ROTULO[atividade.type] || atividade.type} • {timeAgo(atividade.date)}
                    </span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-telemetry text-sm text-[#F7F5F3] font-black block leading-none">
                      {distancia.toFixed(2)} km
                    </span>
                    <span className="text-[10px] text-[#737373] block mt-1">
                      {formatDuration(duracao)} •{' '}
                      {atividade.avg_pace || `${paceFromActivity(distancia, duracao)}/km`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {error && (
        <div role="alert" className="bg-[#EF4444]/12 border border-[#EF4444]/40 rounded-xl px-4 py-3">
          <span className="text-xs text-[#e5e2e1]">{error}</span>
        </div>
      )}
    </div>
  );
};
