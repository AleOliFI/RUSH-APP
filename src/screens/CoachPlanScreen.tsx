// ============================================================
// RUSH RUNNING — Plano do atleta (visão do treinador)
// ------------------------------------------------------------
// Duas rotas existiam no servidor e nenhuma tela as chamava:
// montar um plano e atribuir um plano a um atleta. O treinador
// conseguia trocar o treino de UM DIA (tela de prescrição) e não
// conseguia dar um plano inteiro a ninguém.
//
// Por que o plano é GERADO e não digitado: montar doze semanas num
// formulário é outro aplicativo. O gerador periodizado — Base,
// Build, Peak, Taper — já existe no servidor e é o mesmo que monta
// o plano automático do atleta. O treinador escolhe prova, nível e
// duração; o servidor monta as sessões; e os ajustes finos saem na
// tela de prescrição, dia a dia. Uma lógica de prescrição só, num
// lugar só.
//
// O QUE A TELA PRECISA DEIXAR CLARO, e repete em dois lugares:
// atribuir plano CANCELA o plano ativo do atleta. Não é um plano
// paralelo, é uma troca — e quem perde semanas de treino
// planejadas é ele, não quem clicou.
// ============================================================

import React, { useEffect, useState } from 'react';
import { NIVEIS_DE_TREINO } from '../data/niveis';
import { training } from '../api';
import type { FichaAtletaData, GestaoAtletasData } from '../hooks/useAssessoria';

interface CoachPlanScreenProps {
  ficha: FichaAtletaData;
  gestao: GestaoAtletasData;
  onVoltar: () => void;
  onAtribuido: () => void;
}

/** As distâncias que o gerador do servidor aceita (ele recusa o resto). */
const PROVAS = [
  { valor: 5, rotulo: '5 km' },
  { valor: 10, rotulo: '10 km' },
  { valor: 21, rotulo: '21 km' },
  { valor: 42, rotulo: '42 km' },
] as const;

/** Mesma lista de src/data/niveis.ts, para os rótulos não divergirem. */
const NIVEIS = NIVEIS_DE_TREINO;

const hoje = () => new Date().toISOString().split('T')[0];

export const CoachPlanScreen: React.FC<CoachPlanScreenProps> = ({
  ficha, gestao, onVoltar, onAtribuido,
}) => {
  const { athlete, plan } = ficha;

  const [prova, setProva] = useState<number>(10);
  const [nivel, setNivel] = useState<string>('intermediate');
  const [semanas, setSemanas] = useState('12');
  const [erroLocal, setErroLocal] = useState<string | null>(null);

  const [biblioteca, setBiblioteca] = useState<any[]>([]);
  const [carregandoBiblioteca, setCarregandoBiblioteca] = useState(true);
  const [planoEscolhido, setPlanoEscolhido] = useState<string>('');
  const [inicio, setInicio] = useState<string>(hoje());

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await training.planos();
        if (vivo) setBiblioteca(Array.isArray(r?.plans) ? r.plans : []);
      } catch {
        // A biblioteca vazia não impede gerar um plano novo: a seção
        // some e a outra continua de pé.
        if (vivo) setBiblioteca([]);
      } finally {
        if (vivo) setCarregandoBiblioteca(false);
      }
    })();
    return () => { vivo = false; };
  }, []);

  const gerar = async () => {
    setErroLocal(null);
    gestao.limpar();

    const n = Number(semanas);
    // A faixa é a do servidor. Validar aqui também evita que o
    // treinador preencha tudo para receber um 400 seco depois.
    if (!Number.isInteger(n) || n < 4 || n > 24) {
      setErroLocal('A duração precisa ser um número inteiro entre 4 e 24 semanas.');
      return;
    }

    try {
      await gestao.gerarPlano(athlete.id, { distance_km: prova, level: nivel, duration_weeks: n });
      onAtribuido();
    } catch {
      /* gestao.error já carrega o motivo. */
    }
  };

  const atribuir = async () => {
    setErroLocal(null);
    gestao.limpar();

    if (!planoEscolhido) { setErroLocal('Escolha um plano da biblioteca.'); return; }
    if (!inicio) { setErroLocal('Escolha a data de início.'); return; }

    try {
      await gestao.atribuirPlano(athlete.id, planoEscolhido, inicio);
      onAtribuido();
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

  const rotuloCampo = 'font-label-sm text-[10px] text-[#A1A1AA] uppercase tracking-widest mb-1.5 block';
  const campo = 'w-full min-h-[48px] bg-[#101010] border border-[#262626] rounded-xl px-3 text-sm text-[#F7F5F3] focus:border-[#FF5500] focus:outline-none';

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
          Plano de treino
        </span>
        <h1 className="font-headline-md text-[#F7F5F3] uppercase tracking-tight truncate">
          {athlete.name}
        </h1>
      </div>

      {/* O que o atleta tem hoje — é isto que será perdido */}
      <div className="bg-[#1C1C1C] rounded-2xl border border-[#262626] p-4 space-y-1.5">
        <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase tracking-widest block">
          Plano atual deste atleta
        </span>
        {plan ? (
          <p className="text-xs text-[#F7F5F3] leading-relaxed">
            <strong>{plan.plan_name}</strong> — semana {plan.current_week || 1} de{' '}
            {plan.duration_weeks || '—'}.
          </p>
        ) : (
          <p className="text-xs text-[#A1A1AA] leading-relaxed">
            Nenhum plano ativo. Este será o primeiro.
          </p>
        )}
      </div>

      {/* Aviso de substituição — o mesmo peso da tela de prescrição */}
      {plan && (
        <div className="bg-[#101010] border border-[#FACC15] rounded-xl p-3 flex items-start gap-2">
          <span className="material-symbols-outlined text-[#FACC15] text-[18px]">warning</span>
          <p className="text-[11px] text-[#D4D4D8] leading-relaxed">
            Dar um plano novo <strong className="text-[#F7F5F3]">cancela</strong> o plano atual do
            atleta. Não é um plano paralelo — é uma troca, e o que estava planejado se perde.
          </p>
        </div>
      )}

      {/* ---------- Gerar plano periodizado ---------- */}
      <section className="bg-[#1C1C1C] rounded-2xl border border-[#262626] p-4 space-y-4">
        <div>
          <h2 className="font-headline text-sm text-[#F7F5F3] uppercase tracking-wide">
            Montar plano periodizado
          </h2>
          <p className="text-[10px] text-[#737373] leading-relaxed mt-1">
            O servidor monta as semanas em quatro fases — base, construção, pico e polimento — e
            atribui ao atleta. Os ajustes de cada dia saem na tela de prescrição.
          </p>
        </div>

        <div>
          <span className={rotuloCampo}>Prova alvo</span>
          <div className="grid grid-cols-4 gap-2">
            {PROVAS.map((p) => (
              <button
                key={p.valor}
                type="button"
                onClick={() => setProva(p.valor)}
                className={`min-h-[44px] rounded-xl border text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                  prova === p.valor
                    ? 'bg-[#FF5500] border-[#FF5500] text-[#0D0D0D]'
                    : 'bg-[#101010] border-[#262626] text-[#A1A1AA] hover:border-[#353534]'
                }`}
              >
                {p.rotulo}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className={rotuloCampo}>Nível</span>
          <div className="grid grid-cols-3 gap-2">
            {NIVEIS.map((n) => (
              <button
                key={n.valor}
                type="button"
                onClick={() => setNivel(n.valor)}
                className={`min-h-[44px] rounded-xl border text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
                  nivel === n.valor
                    ? 'bg-[#FF5500] border-[#FF5500] text-[#0D0D0D]'
                    : 'bg-[#101010] border-[#262626] text-[#A1A1AA] hover:border-[#353534]'
                }`}
              >
                {n.rotulo}
              </button>
            ))}
          </div>
        </div>

        <label className="block">
          <span className={rotuloCampo}>Duração (semanas, de 4 a 24)</span>
          <input
            type="number"
            min={4}
            max={24}
            value={semanas}
            onChange={(e) => setSemanas(e.target.value)}
            className={campo}
          />
        </label>

        <button
          type="button"
          onClick={gerar}
          disabled={gestao.isSaving}
          className="w-full min-h-[52px] bg-[#FF5500] hover:bg-[#FF6A1F] disabled:opacity-60 disabled:cursor-wait rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
        >
          <span className="material-symbols-outlined text-[#0D0D0D] text-[20px]">
            {gestao.isSaving ? 'progress_activity' : 'calendar_add_on'}
          </span>
          <span className="text-xs font-bold uppercase tracking-wider text-[#0D0D0D]">
            {gestao.isSaving ? 'Montando…' : 'Montar e atribuir'}
          </span>
        </button>
      </section>

      {/* ---------- Atribuir plano existente ---------- */}
      {!carregandoBiblioteca && biblioteca.length > 0 && (
        <section className="bg-[#1C1C1C] rounded-2xl border border-[#262626] p-4 space-y-4">
          <div>
            <h2 className="font-headline text-sm text-[#F7F5F3] uppercase tracking-wide">
              Ou atribuir um plano existente
            </h2>
            <p className="text-[10px] text-[#737373] leading-relaxed mt-1">
              Planos já criados na sua assessoria.
            </p>
          </div>

          <label className="block">
            <span className={rotuloCampo}>Plano</span>
            <select
              value={planoEscolhido}
              onChange={(e) => setPlanoEscolhido(e.target.value)}
              className={campo}
            >
              <option value="">Selecione…</option>
              {biblioteca.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {p.distance_km}km, {p.duration_weeks} semanas
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className={rotuloCampo}>Início</span>
            <input
              type="date"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
              className={campo}
            />
          </label>

          <button
            type="button"
            onClick={atribuir}
            disabled={gestao.isSaving}
            className="w-full min-h-[48px] bg-[#262626] hover:bg-[#353534] disabled:opacity-60 rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors border border-[#353534]"
          >
            <span className="text-xs font-bold uppercase tracking-wider text-[#F7F5F3]">
              {gestao.isSaving ? 'Atribuindo…' : 'Atribuir plano'}
            </span>
          </button>
        </section>
      )}

      {/* Erros e confirmação */}
      {erroLocal && (
        <p className="text-xs text-[#EF4444] font-bold" role="alert">{erroLocal}</p>
      )}
      {gestao.error && (
        <p className="text-xs text-[#EF4444] font-bold" role="alert">{gestao.error}</p>
      )}
      {gestao.resultado && (
        <p className="text-xs text-[#22C55E] font-bold" role="status">{gestao.resultado}</p>
      )}
    </div>
  );
};
