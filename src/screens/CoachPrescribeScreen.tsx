// ============================================================
// RUSH RUNNING — Prescrever treino
// ------------------------------------------------------------
// O que distingue esta tela de um formulário qualquer são as
// zonas: elas são as DO ATLETA, calculadas no backend a partir da
// FCmáx dele, e a tela diz se essa FCmáx foi medida num teste de
// campo ou estimada pela idade.
//
// "Z4" é uma letra. "161–181 bpm do Carlos" é uma instrução. E a
// diferença entre as duas pode ser de mais de 10 bpm — o
// suficiente para o atleta treinar em Z3 achando que está em Z4.
//
// Uma coisa que a tela precisa deixar clara: prescrever
// SUBSTITUI o treino daquele dia no plano do atleta. Não é um
// treino extra, é uma troca. O backend informa o que foi
// substituído, e a confirmação repete isso.
// ============================================================

import React, { useState } from 'react';
import type { FichaAtletaData, GestaoAtletasData } from '../hooks/useAssessoria';

interface CoachPrescribeScreenProps {
  ficha: FichaAtletaData;
  gestao: GestaoAtletasData;
  onVoltar: () => void;
  onPrescrito: () => void;
}

/**
 * Os tipos aceitos pelo CHECK de `training_sessions`.
 *
 * Vêm de uma lista fechada de propósito: texto livre aqui produz
 * um 500 no INSERT, e o treinador não teria como saber por quê.
 */
const TIPOS = [
  { valor: 'interval', rotulo: 'Intervalado' },
  { valor: 'easy_run', rotulo: 'Rodagem leve' },
  { valor: 'long_run', rotulo: 'Longão' },
  { valor: 'tempo', rotulo: 'Tempo run' },
  { valor: 'recovery', rotulo: 'Regenerativo' },
  { valor: 'strength', rotulo: 'Força' },
  { valor: 'test', rotulo: 'Teste' },
  { valor: 'rest', rotulo: 'Descanso' },
  { valor: 'other', rotulo: 'Outro' },
] as const;

const ORDEM_ZONAS = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'] as const;

export const CoachPrescribeScreen: React.FC<CoachPrescribeScreenProps> = ({
  ficha, gestao, onVoltar, onPrescrito,
}) => {
  const { athlete, maxHr, maxHrSource, hrZones, plan } = ficha;

  const [titulo, setTitulo] = useState('');
  const [tipo, setTipo] = useState<string>('interval');
  const [distancia, setDistancia] = useState('');
  const [duracao, setDuracao] = useState('');
  const [ritmo, setRitmo] = useState('');
  const [zona, setZona] = useState<string>('');
  const [descricao, setDescricao] = useState('');
  const [notas, setNotas] = useState('');
  const [erroLocal, setErroLocal] = useState<string | null>(null);

  const ehDescanso = tipo === 'rest';

  const enviar = async () => {
    setErroLocal(null);
    gestao.limpar();

    if (!tipo) { setErroLocal('Escolha o tipo de treino.'); return; }

    // Descanso não tem volume; qualquer outro tipo sem distância
    // nem duração vira uma sessão vazia no plano do atleta.
    if (!ehDescanso && !distancia.trim() && !duracao.trim()) {
      setErroLocal('Informe a distância ou a duração — senão a sessão chega vazia para o atleta.');
      return;
    }

    const num = (v: string) => (v.trim() ? Number(v.replace(',', '.')) : null);
    const km = num(distancia);
    const min = num(duracao);

    if (km !== null && (!Number.isFinite(km) || km <= 0)) {
      setErroLocal('Distância inválida.'); return;
    }
    if (min !== null && (!Number.isFinite(min) || min <= 0)) {
      setErroLocal('Duração inválida.'); return;
    }

    try {
      await gestao.prescrever(athlete.id, {
        title: titulo.trim() || null,
        type: tipo,
        distance_km: ehDescanso ? 0 : km,
        duration_min: ehDescanso ? 0 : min,
        target_pace: ritmo.trim() || null,
        target_hr_zone: zona || null,
        description: descricao.trim() || null,
        notes: notas.trim() || null,
      });
      onPrescrito();
    } catch {
      /* gestao.error já carrega o motivo. */
    }
  };

  if (!athlete) {
    return (
      <div className="flex flex-col w-full max-w-2xl mx-auto px-4 sm:px-5 pt-4 pb-8">
        <p className="text-xs text-[#A1A1AA]">Carregando o atleta…</p>
      </div>
    );
  }

  const zonaEscolhida = zona && hrZones ? hrZones[zona] : null;

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto px-4 sm:px-5 space-y-5 pt-2 pb-8">
      {/* Cabeçalho */}
      <div className="border-b border-[#262626] pb-3">
        <button
          type="button"
          onClick={onVoltar}
          className="flex items-center gap-1 text-[#A1A1AA] hover:text-[#F7F5F3] transition-colors cursor-pointer mb-2"
        >
          <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          <span className="text-xs uppercase tracking-wider">Voltar</span>
        </button>
        <span className="font-label-caps text-[10px] text-[#FF5500] uppercase tracking-widest font-extrabold block">
          Prescrever treino
        </span>
        <h1 className="font-headline-md text-[#F7F5F3] uppercase tracking-tight truncate">
          {athlete.name}
        </h1>
      </div>

      {/* Perfil fisiológico — a razão de ser desta tela */}
      <div className="bg-[#1C1C1C] rounded-2xl border border-[#262626] p-4 space-y-2">
        <div className="flex items-end justify-between gap-2">
          <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase tracking-widest">
            FC máxima deste atleta
          </span>
          <span className="font-headline text-2xl text-[#EF4444]">
            {maxHr ?? '—'}<span className="text-[10px] text-[#737373] ml-1">bpm</span>
          </span>
        </div>

        {/* Dizer a procedência não é preciosismo: uma FCmáx estimada
            por idade é uma média populacional, e prescrever em cima
            dela é diferente de prescrever em cima de um teste. */}
        <p className={`text-[10px] leading-relaxed ${maxHrSource === 'field_test' ? 'text-[#22C55E]' : 'text-[#FACC15]'}`}>
          {maxHrSource === 'field_test'
            ? 'Medida no teste de campo — as zonas abaixo são individualizadas.'
            : 'Estimada pela idade. Sem teste de campo, as zonas são uma aproximação populacional, não uma medida deste atleta.'}
        </p>

        {plan && (
          <p className="text-[10px] text-[#A1A1AA] leading-relaxed pt-1 border-t border-[#262626]">
            Plano ativo: <strong className="text-[#F7F5F3]">{plan.plan_name}</strong>, semana{' '}
            {plan.current_week || 1} de {plan.duration_weeks || '—'}.
          </p>
        )}
      </div>

      {/* Aviso de substituição */}
      <div className="bg-[#101010] border border-[#FACC15] rounded-xl p-3 flex items-start gap-2">
        <span className="material-symbols-outlined text-[#FACC15] text-[18px]">warning</span>
        <p className="text-[11px] text-[#D4D4D8] leading-relaxed">
          Esta prescrição <strong className="text-[#F7F5F3]">substitui</strong> o treino de hoje no
          plano do atleta — não é uma sessão extra.
        </p>
      </div>

      {/* Título */}
      <label className="block">
        <span className="text-[10px] text-[#A1A1AA] uppercase tracking-widest block mb-1">
          Título da sessão
        </span>
        <input
          type="text"
          value={titulo}
          maxLength={120}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Tiros de limiar 5x1200m"
          className="w-full min-h-[48px] bg-[#101010] border border-[#262626] rounded-lg px-3 text-sm text-[#F7F5F3] placeholder:text-[#525252] focus:border-[#FF5500] focus:outline-none"
        />
      </label>

      {/* Tipo */}
      <div>
        <span className="text-[10px] text-[#A1A1AA] uppercase tracking-widest block mb-1.5">
          Tipo de treino
        </span>
        <div className="grid grid-cols-3 gap-2">
          {TIPOS.map((t) => (
            <button
              key={t.valor}
              type="button"
              onClick={() => setTipo(t.valor)}
              aria-pressed={tipo === t.valor}
              className={`min-h-[44px] rounded-lg border text-[11px] font-bold uppercase tracking-wider cursor-pointer transition-colors ${
                tipo === t.valor
                  ? 'bg-[#FF5500] border-[#FF5500] text-[#0D0D0D]'
                  : 'bg-[#101010] border-[#262626] text-[#A1A1AA] hover:bg-[#1C1C1C]'
              }`}
            >
              {t.rotulo}
            </button>
          ))}
        </div>
      </div>

      {/* Volume */}
      {!ehDescanso && (
        <div className="grid grid-cols-2 gap-2.5">
          <label className="block">
            <span className="text-[10px] text-[#A1A1AA] uppercase tracking-widest block mb-1">
              Distância (km)
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={distancia}
              onChange={(e) => setDistancia(e.target.value)}
              placeholder="12"
              className="w-full min-h-[48px] bg-[#101010] border border-[#262626] rounded-lg px-3 text-sm text-[#F7F5F3] placeholder:text-[#525252] focus:border-[#FF5500] focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="text-[10px] text-[#A1A1AA] uppercase tracking-widest block mb-1">
              Duração (min)
            </span>
            <input
              type="text"
              inputMode="numeric"
              value={duracao}
              onChange={(e) => setDuracao(e.target.value)}
              placeholder="60"
              className="w-full min-h-[48px] bg-[#101010] border border-[#262626] rounded-lg px-3 text-sm text-[#F7F5F3] placeholder:text-[#525252] focus:border-[#FF5500] focus:outline-none"
            />
          </label>
        </div>
      )}

      {/* Ritmo */}
      {!ehDescanso && (
        <label className="block">
          <span className="text-[10px] text-[#A1A1AA] uppercase tracking-widest block mb-1">
            Ritmo alvo
          </span>
          <input
            type="text"
            value={ritmo}
            maxLength={40}
            onChange={(e) => setRitmo(e.target.value)}
            placeholder="4:15 - 4:25 /km"
            className="w-full min-h-[48px] bg-[#101010] border border-[#262626] rounded-lg px-3 text-sm text-[#F7F5F3] placeholder:text-[#525252] focus:border-[#FF5500] focus:outline-none"
          />
        </label>
      )}

      {/* Zonas reais */}
      {!ehDescanso && hrZones && (
        <div>
          <div className="flex items-baseline justify-between gap-2 mb-1.5">
            <span className="text-[10px] text-[#A1A1AA] uppercase tracking-widest">
              Zona cardíaca alvo
            </span>
            <span className="text-[9px] text-[#737373] uppercase tracking-widest">
              faixas deste atleta
            </span>
          </div>

          <div className="grid grid-cols-5 gap-1.5">
            {ORDEM_ZONAS.map((z) => {
              const dados = hrZones[z];
              const ativa = zona === z;
              return (
                <button
                  key={z}
                  type="button"
                  onClick={() => setZona(ativa ? '' : z)}
                  aria-pressed={ativa}
                  className={`min-h-[56px] rounded-lg border flex flex-col items-center justify-center cursor-pointer transition-colors px-1 ${
                    ativa
                      ? 'bg-[#FF5500] border-[#FF5500] text-[#0D0D0D]'
                      : 'bg-[#101010] border-[#262626] text-[#A1A1AA] hover:bg-[#1C1C1C]'
                  }`}
                >
                  <span className="text-xs font-bold">{z}</span>
                  <span className="text-[8px] leading-tight">
                    {dados ? `${dados.minBpm}–${dados.maxBpm}` : '—'}
                  </span>
                </button>
              );
            })}
          </div>

          {zonaEscolhida && (
            <div className="bg-[#101010] border border-[#FF5500] rounded-lg p-2.5 mt-2">
              <span className="text-xs font-bold text-[#F7F5F3] block">
                {zona} • {zonaEscolhida.name}
              </span>
              <span className="text-[10px] text-[#A1A1AA] block mt-0.5">
                {zonaEscolhida.minBpm}–{zonaEscolhida.maxBpm} bpm ({zonaEscolhida.pctMax}) •{' '}
                RPE {zonaEscolhida.rpe}
              </span>
              <span className="text-[10px] text-[#737373] block mt-1 leading-relaxed">
                {zonaEscolhida.purpose}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Estrutura */}
      <label className="block">
        <span className="text-[10px] text-[#A1A1AA] uppercase tracking-widest block mb-1">
          Estrutura do treino
        </span>
        <textarea
          value={descricao}
          rows={4}
          maxLength={1000}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Aquecimento 2,5 km Z1-Z2 + 5x1200m @ 4:18/km com 2:30 de trote + 2 km de soltura"
          className="w-full bg-[#101010] border border-[#262626] rounded-lg p-3 text-sm text-[#F7F5F3] placeholder:text-[#525252] focus:border-[#FF5500] focus:outline-none resize-none"
        />
        <span className="text-[9px] text-[#737373] block mt-1">
          É o que o atleta lê na tela de treinos dele.
        </span>
      </label>

      {/* Notas */}
      <label className="block">
        <span className="text-[10px] text-[#A1A1AA] uppercase tracking-widest block mb-1">
          Observações
        </span>
        <textarea
          value={notas}
          rows={2}
          maxLength={500}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Calor previsto: hidratar a cada 20 min."
          className="w-full bg-[#101010] border border-[#262626] rounded-lg p-3 text-sm text-[#F7F5F3] placeholder:text-[#525252] focus:border-[#FF5500] focus:outline-none resize-none"
        />
        <span className="text-[9px] text-[#737373] block mt-1">
          Usadas como descrição caso o campo acima fique vazio. O atleta vê as duas.
        </span>
      </label>

      {(erroLocal || gestao.error) && (
        <div role="alert" className="bg-[#1C1C1C] border border-[#EF4444] rounded-xl p-3 flex items-start gap-2">
          <span className="material-symbols-outlined text-[#EF4444] text-[18px]">error</span>
          <span className="text-xs text-[#F7F5F3] leading-relaxed">{erroLocal || gestao.error}</span>
        </div>
      )}

      <button
        type="button"
        onClick={enviar}
        disabled={gestao.isSaving}
        className="w-full min-h-[52px] bg-[#FF5500] hover:bg-[#FF6A1F] rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="material-symbols-outlined text-[#0D0D0D] text-[20px]">send</span>
        <span className="text-xs font-bold uppercase tracking-wider text-[#0D0D0D]">
          {gestao.isSaving ? 'Enviando…' : 'Enviar prescrição'}
        </span>
      </button>
    </div>
  );
};
