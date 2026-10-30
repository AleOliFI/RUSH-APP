// ============================================================
// RUSH RUNNING — O que está atrás da assinatura
// ------------------------------------------------------------
// Um cadeado só vale se disser o que há do outro lado. "Recurso
// premium" não ajuda ninguém a decidir; "a estimativa de VO₂ máximo
// e a tendência dela ao longo das semanas" ajuda.
//
// O texto vem do servidor (server/services/recursosPro.js) quando a
// porta foi batida de verdade — assim a mesma frase aparece na
// resposta da API e na tela. Quando a tela esconde antes de bater,
// ela passa o texto equivalente.
// ============================================================

import React from 'react';

interface BloqueioProProps {
  titulo: string;
  explicacao: string;
  onAssinar?: () => void;
  /** Mais discreto, para cantos onde o cartão inteiro seria demais. */
  compacto?: boolean;
}

export const BloqueioPro: React.FC<BloqueioProProps> = ({
  titulo, explicacao, onAssinar, compacto = false,
}) => {
  if (compacto) {
    return (
      <div className="flex items-center gap-2 text-[10px] text-[#A1A1AA] leading-relaxed">
        <span className="material-symbols-outlined text-[#FF5500] text-[16px] shrink-0">lock</span>
        <span className="min-w-0">
          {explicacao}{' '}
          {onAssinar && (
            <button
              onClick={onAssinar}
              className="text-[#FF5500] font-bold uppercase hover:underline cursor-pointer"
            >
              Assinar
            </button>
          )}
        </span>
      </div>
    );
  }

  return (
    <div className="bg-[#101010] border border-[#FF5500]/40 rounded-xl p-4 space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-[#FF5500] text-[20px]">lock</span>
        <span className="font-headline text-sm text-[#F7F5F3] uppercase tracking-wide">
          {titulo}
        </span>
      </div>
      <p className="text-[11px] text-[#A1A1AA] leading-relaxed">{explicacao}</p>
      {onAssinar && (
        <button
          onClick={onAssinar}
          className="w-full min-h-[44px] bg-[#FF5500] hover:bg-[#FF6A1F] rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
        >
          <span className="material-symbols-outlined text-[#0D0D0D] text-[18px]">bolt</span>
          <span className="text-xs font-bold uppercase tracking-wider text-[#0D0D0D]">
            Conhecer o RUSH PRO
          </span>
        </button>
      )}
    </div>
  );
};

/**
 * Os mesmos textos de server/services/recursosPro.js, para quando a
 * tela esconde sem bater na porta.
 *
 * Duas cópias existem porque são dois lados da rede; o teste
 * server/test/paywall.test.js confere que elas dizem a mesma coisa —
 * uma divergência aqui faria a pessoa ler um motivo na tela e outro
 * na resposta da API.
 */
export const TEXTOS_PRO = {
  vo2max: {
    titulo: 'VO₂ máximo estimado',
    explicacao:
      'A estimativa de VO₂ máximo e a tendência dela ao longo das semanas fazem parte do RUSH PRO.',
  },
  carga_de_treino: {
    titulo: 'Carga aguda:crônica',
    explicacao:
      'A razão entre a carga das últimas semanas e a dos últimos meses — e o alerta de sobrecarga — fazem parte do RUSH PRO.',
  },
  protocolo_de_campo: {
    titulo: 'Protocolo de campo',
    explicacao:
      'O teste de campo substitui as zonas estimadas pela sua idade pelas zonas medidas no seu corpo. Faz parte do RUSH PRO.',
  },
  serie_de_vfc: {
    titulo: 'Série longa de variabilidade',
    explicacao:
      'Sem assinatura, o histórico de VFC mostra os últimos 7 dias. A série completa faz parte do RUSH PRO.',
  },
  arte_para_redes: {
    titulo: 'Arte 9:16 para redes',
    explicacao:
      'A arte da corrida no formato de story faz parte do RUSH PRO.',
  },
} as const;
