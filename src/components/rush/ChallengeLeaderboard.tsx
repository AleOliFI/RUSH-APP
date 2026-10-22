// ============================================================
// RUSH RUNNING — Classificação do desafio
// ------------------------------------------------------------
// A rota GET /challenges/:id/leaderboard existia, `challenges.
// leaderboard` existia no cliente, e nenhuma tela chamava: o atleta
// entrava no desafio, via a própria barra de progresso e não tinha
// como saber onde estava em relação aos outros. Num desafio, essa é
// a informação principal.
//
// Carrega só quando alguém abre — a classificação não entra no
// carregamento inicial do app.
// ============================================================

import React from 'react';
import { useClassificacaoDoDesafio } from '../../hooks/useTrainingReference';
import { Avatar } from './Avatar';

interface ChallengeLeaderboardProps {
  /** `null` mantém o componente quieto, sem buscar nada. */
  challengeId: string | null;
  unidade?: string;
}

export const ChallengeLeaderboard: React.FC<ChallengeLeaderboardProps> = ({ challengeId, unidade }) => {
  const { linhas, isLoading, error } = useClassificacaoDoDesafio(challengeId);

  if (!challengeId) return null;

  if (isLoading) {
    return <p className="text-[11px] text-[#A1A1AA] py-2">Carregando a classificação…</p>;
  }

  if (error) {
    return <p className="text-[11px] text-[#EF4444] py-2" role="alert">{error}</p>;
  }

  if (linhas.length === 0) {
    return (
      <p className="text-[11px] text-[#A1A1AA] py-2">
        Ninguém entrou neste desafio ainda.
      </p>
    );
  }

  return (
    <ol className="space-y-1.5 pt-1">
      {linhas.map((linha) => (
        <li
          key={linha.user_id}
          className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 border ${
            linha.is_me
              ? 'bg-[#FF5500]/10 border-[#FF5500]/40'
              : 'bg-[#101010] border-[#262626]'
          }`}
        >
          <span className="font-telemetry text-xs text-[#A1A1AA] w-6 shrink-0 text-right">
            {linha.rank}º
          </span>
          <Avatar
            name={linha.name}
            src={linha.avatar_url || undefined}
            className="w-7 h-7 rounded-full object-cover border border-[#353534] shrink-0"
            initialsClassName="text-[10px]"
          />
          <span className="text-xs text-[#F7F5F3] truncate flex-1 min-w-0">
            {linha.name}
            {linha.is_me && (
              <span className="text-[9px] text-[#FF5500] font-bold uppercase ml-1.5">você</span>
            )}
          </span>
          <span className="font-telemetry text-[11px] text-[#A1A1AA] shrink-0">
            {linha.progress_value}
            {unidade ? ` ${unidade}` : ''}
          </span>
          <span className="font-telemetry text-[11px] text-[#22C55E] font-bold w-12 text-right shrink-0">
            {linha.progress_pct}%
          </span>
        </li>
      ))}
    </ol>
  );
};
