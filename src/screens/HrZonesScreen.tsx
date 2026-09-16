// ============================================================
// RUSH RUNNING — Zonas de frequência cardíaca
// ------------------------------------------------------------
// O atleta recebe prescrições em "Z2" e "Z4" e nunca via o que
// isso significa em batimentos. O backend já calculava as cinco
// zonas com faixa de bpm, %FCmáx, RPE, propósito fisiológico e a
// faixa de DFA-α1 — e o app descartava quase tudo: `pctMax`,
// `purpose` e `dfaAlpha1` tinham ZERO usos em todo o src/.
//
// A tela começa pela FCmáx, e não pelas zonas, porque é dela que
// as cinco faixas derivam. E diz a procedência: medida num teste
// de campo, ou estimada pela idade. A estimativa é uma média
// populacional — num caso medido aqui a diferença foi de 13 bpm,
// o suficiente para o atleta treinar em Z3 achando que está em
// Z4. Apresentar as duas do mesmo jeito engana quem lê.
//
// Sobre a barra: neste modelo cada zona é uma faixa de 10% da
// FCmáx, então elas saem praticamente iguais em batimentos (~20
// bpm cada). A barra não existe para mostrar diferença de
// tamanho — existe para situar as faixas em números absolutos, de
// 50% da FCmáx até o teto, que é o que o atleta lê no relógio.
// Uma versão anterior deste arquivo afirmava que as zonas tinham
// tamanhos diferentes; a própria barra desmentia.
// ============================================================

import React from 'react';
import type { HrZonesData } from '../hooks/useTrainingReference';

interface HrZonesScreenProps {
  zonas: HrZonesData;
  /** Abre o protocolo de teste de campo, que mede a FCmáx de verdade. */
  onFazerTeste?: () => void;
}

const ORDEM = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'] as const;

const COR: Record<string, string> = {
  Z1: '#22C55E',
  Z2: '#4ADE80',
  Z3: '#FACC15',
  Z4: '#FF5500',
  Z5: '#EF4444',
};

export const HrZonesScreen: React.FC<HrZonesScreenProps> = ({ zonas, onFazerTeste }) => {
  const { maxHr, maxHrSource, zones, isLoading, error } = zonas;
  const medida = maxHrSource === 'field_test';

  if (isLoading && !maxHr) {
    return (
      <div className="flex flex-col w-full max-w-2xl mx-auto px-4 sm:px-5 pt-2 pb-8 space-y-3">
        <div className="h-24 rounded-2xl bg-[#1C1C1C] border border-[#262626] animate-pulse" />
        <div className="h-64 rounded-2xl bg-[#1C1C1C] border border-[#262626] animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col w-full max-w-2xl mx-auto px-4 sm:px-5 pt-4 pb-8">
        <div className="bg-[#1C1C1C] border border-[#EF4444] rounded-xl p-4 flex items-start gap-2">
          <span className="material-symbols-outlined text-[#EF4444] text-[18px]">error</span>
          <span className="text-xs text-[#F7F5F3] leading-relaxed">{error}</span>
        </div>
      </div>
    );
  }

  const listadas = ORDEM.map((z) => ({ chave: z, dados: zones[z] })).filter((x) => x.dados);

  if (listadas.length === 0) {
    return (
      <div className="flex flex-col w-full max-w-2xl mx-auto px-4 sm:px-5 pt-4 pb-8">
        <div className="bg-[#1C1C1C] border border-[#262626] rounded-2xl p-5 text-center">
          <span className="material-symbols-outlined text-[#A1A1AA] text-[28px]">ecg_heart</span>
          <p className="text-xs text-[#A1A1AA] leading-relaxed mt-1">
            Ainda não foi possível calcular suas zonas.
          </p>
        </div>
      </div>
    );
  }

  // A barra cobre de 50% da FCmáx (piso da Z1) até a própria FCmáx.
  const piso = listadas[0].dados.minBpm;
  const teto = listadas[listadas.length - 1].dados.maxBpm;
  const amplitude = Math.max(1, teto - piso);

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto px-4 sm:px-5 space-y-5 pt-2 pb-8">
      {/* ---------- A FCmáx, e de onde ela veio ---------- */}
      <div className="bg-[#1C1C1C] rounded-2xl border border-[#262626] p-4 space-y-2.5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase tracking-widest block">
              Sua frequência cardíaca máxima
            </span>
            <span className="font-headline text-3xl text-[#EF4444] block leading-none mt-1">
              {maxHr ?? '—'}
              <span className="text-xs text-[#737373] ml-1">bpm</span>
            </span>
          </div>
          <span
            className={`shrink-0 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border ${
              medida ? 'border-[#22C55E] text-[#22C55E]' : 'border-[#FACC15] text-[#FACC15]'
            }`}
          >
            {medida ? 'Medida' : 'Estimada'}
          </span>
        </div>

        <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
          {medida
            ? 'Este número veio do seu teste de campo. As faixas abaixo são suas, e não de uma média.'
            : 'Este número é uma estimativa a partir da sua idade — uma média de pessoas parecidas com você, não uma medida sua. As faixas abaixo servem de ponto de partida e podem errar por vários batimentos.'}
        </p>

        {!medida && onFazerTeste && (
          <button
            type="button"
            onClick={onFazerTeste}
            className="w-full min-h-[44px] bg-[#101010] hover:bg-[#262626] border border-[#262626] rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-[#FF5500] text-[18px]">timer</span>
            <span className="text-xs font-bold uppercase tracking-wider text-[#F7F5F3]">
              Fazer o teste de campo
            </span>
          </button>
        )}
      </div>

      {/* ---------- Barra proporcional ---------- */}
      <div className="space-y-2">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase tracking-widest">
            Onde cada zona vive
          </span>
          <span className="text-[9px] text-[#737373]">
            {piso}–{teto} bpm
          </span>
        </div>

        <div className="flex h-4 rounded-full overflow-hidden bg-[#101010]" role="presentation">
          {listadas.map(({ chave, dados }) => (
            <div
              key={chave}
              style={{
                width: `${((dados.maxBpm - dados.minBpm) / amplitude) * 100}%`,
                backgroundColor: COR[chave],
              }}
              title={`${chave}: ${dados.minBpm}–${dados.maxBpm} bpm`}
            />
          ))}
        </div>

        <p className="text-[10px] text-[#737373] leading-relaxed">
          Cada zona cobre 10% da sua FCmáx, o que dá faixas de largura parecida. O treino fácil vive
          na metade de baixo desta barra.
        </p>
      </div>

      {/* ---------- As cinco zonas ---------- */}
      <div className="space-y-2">
        <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase tracking-widest block">
          As cinco zonas
        </span>

        {listadas.map(({ chave, dados }) => (
          <div
            key={chave}
            className="bg-[#1C1C1C] rounded-xl border border-[#262626] p-3.5 flex items-start gap-3"
          >
            <span
              className="w-1 self-stretch rounded-full shrink-0"
              style={{ backgroundColor: COR[chave] }}
              aria-hidden="true"
            />

            <div className="flex-1 min-w-0 space-y-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="flex items-baseline gap-2 min-w-0">
                  <span className="font-headline text-base" style={{ color: COR[chave] }}>
                    {chave}
                  </span>
                  <span className="text-xs font-bold text-[#F7F5F3] truncate">{dados.name}</span>
                </span>
                <span className="font-headline text-base text-[#F7F5F3] shrink-0">
                  {dados.minBpm}–{dados.maxBpm}
                  <span className="text-[9px] text-[#737373] ml-1">bpm</span>
                </span>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-[10px] text-[#A1A1AA]">{dados.pctMax} da FCmáx</span>
                <span className="text-[10px] text-[#A1A1AA]">Esforço {dados.rpe}</span>
              </div>

              <p className="text-[10px] text-[#737373] leading-relaxed">{dados.purpose}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ---------- Por que o treino é lento ---------- */}
      <div className="bg-[#1C1C1C] rounded-2xl border border-[#262626] p-4 space-y-2">
        <span className="font-headline text-base text-[#F7F5F3] uppercase block">
          Por que tanto tempo devagar
        </span>
        <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
          Seu plano segue o modelo polarizado: a maior parte do volume fica em Z1 e Z2, e uma parcela
          pequena vai para Z4 e Z5. A <strong className="text-[#F7F5F3]">Z3 é evitada de propósito</strong>{' '}
          — ela cansa quase como um treino forte sem dar o estímulo de um, e é por isso que a zona se
          chama cinzenta.
        </p>
        <p className="text-[10px] text-[#737373] leading-relaxed">
          Correr fácil não é correr pouco: é o que permite treinar forte quando o plano pede.
        </p>
      </div>

      <p className="text-[9px] text-[#525252] leading-relaxed text-center">
        Zonas calculadas sobre a sua FCmáx segundo o modelo polarizado de Seiler.
      </p>
    </div>
  );
};
