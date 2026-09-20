// ============================================================
// RUSH RUNNING — Painel da assessoria
// ------------------------------------------------------------
// A tela que o treinador abre de manhã. A pergunta que ela
// responde é uma só: quem não deveria treinar forte hoje?
//
// A ordem da lista é a resposta. O backend já devolve os atletas
// ordenados por risco — recovery, depois attention, depois
// favorable — e a tela PRESERVA essa ordem. Reordenar por nome
// aqui destruiria a única coisa que a consulta faz de mais
// importante.
//
// Quem não mediu hoje aparece junto, e não no fim como se
// estivesse bem. Um atleta sem medição é um ponto cego, não um
// atleta saudável: o treinador não sabe nada sobre ele, e essa
// ausência é informação.
//
// Sobre os números: o desenho trazia carga em TSS, temperatura
// basal, horas de sono REM e um score de prontidão de 0 a 100.
// Nada disso existe no app — não há coleta de sono nem de
// temperatura, e a carga de treino que o RUSH calcula é sRPE
// (minutos × esforço percebido), que é outra métrica e outra
// escala. Esses campos ficaram de fora em vez de virem
// preenchidos com número plausível.
// ============================================================

import React, { useState } from 'react';
import type { AtletaDoPainel, GestaoAtletasData, PainelData } from '../hooks/useAssessoria';

interface CoachDashboardScreenProps {
  painel: PainelData;
  gestao: GestaoAtletasData;
  onAbrirAtleta: (id: string) => void;
  onPrescrever: (id: string) => void;
  /**
   * Chamado depois de criar a assessoria. O backend promove a conta a
   * `owner` e grava o `academy_id`: sem recarregar o usuário, o app
   * continuaria mostrando "Nenhuma assessoria" para quem acabou de
   * criar uma.
   */
  onAssessoriaCriada: () => void | Promise<void>;
}

/** Vagas de cada plano, como o backend as calcula. */
const PLANOS = [
  { id: 'basic', nome: 'Basic', vagas: 50 },
  { id: 'pro', nome: 'Pro', vagas: 150 },
  { id: 'elite', nome: 'Elite', vagas: 500 },
] as const;

/** Cores e rótulo de cada estado fisiológico. */
const ESTADO = {
  recovery: { rotulo: 'Recuperação', cor: '#EF4444', borda: 'border-[#EF4444]', texto: 'text-[#EF4444]' },
  attention: { rotulo: 'Atenção', cor: '#FACC15', borda: 'border-[#FACC15]', texto: 'text-[#FACC15]' },
  favorable: { rotulo: 'Favorável', cor: '#22C55E', borda: 'border-[#22C55E]', texto: 'text-[#22C55E]' },
  cego: { rotulo: 'Ponto cego', cor: '#A1A1AA', borda: 'border-[#3F3F46]', texto: 'text-[#A1A1AA]' },
} as const;

function estadoDe(atleta: AtletaDoPainel) {
  return ESTADO[atleta.status as keyof typeof ESTADO] || ESTADO.cego;
}

/**
 * Quanto a VFC de hoje se afasta da base do próprio atleta.
 *
 * O valor absoluto não diz nada — um lnRMSSD de 3,5 é ótimo para
 * uma pessoa e ruim para outra. O que informa é o desvio da média
 * dela mesma, e é por isso que a base vem junto na consulta.
 */
function desvioDaBase(atleta: AtletaDoPainel & { lnrmssd_7d_mean?: number | null }) {
  const hoje = Number(atleta.lnrmssd);
  const base = Number(atleta.lnrmssd_7d_mean);
  if (!Number.isFinite(hoje) || !Number.isFinite(base) || base <= 0) return null;
  return ((hoje - base) / base) * 100;
}

const Metrica: React.FC<{ rotulo: string; valor: string; cor?: string; nota?: string }> = ({
  rotulo, valor, cor = 'text-[#F7F5F3]', nota,
}) => (
  <div className="bg-[#101010] border border-[#262626] rounded-lg p-2.5 min-w-0">
    <span className="text-[9px] text-[#A1A1AA] uppercase tracking-widest block truncate">{rotulo}</span>
    <span className={`font-headline text-lg block leading-tight ${cor}`}>{valor}</span>
    {nota && <span className="text-[9px] text-[#737373] block truncate">{nota}</span>}
  </div>
);

// ------------------------------------------------------------

const CartaoAtleta: React.FC<{
  atleta: AtletaDoPainel;
  onAbrir: () => void;
  onPrescrever: () => void;
}> = ({ atleta, onAbrir, onPrescrever }) => {
  const estado = estadoDe(atleta);
  const desvio = desvioDaBase(atleta as any);
  const mediu = atleta.status !== null;

  return (
    <div className={`bg-[#1C1C1C] rounded-2xl border-l-4 ${estado.borda} border-y border-r border-y-[#262626] border-r-[#262626] p-3.5 space-y-3`}>
      <div className="flex items-start gap-2.5">
        {atleta.avatar_url ? (
          <img src={atleta.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-[#262626] flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[#A1A1AA] text-[20px]">person</span>
          </div>
        )}

        <div className="flex-1 min-w-0">
          <span className="font-headline text-sm uppercase text-[#F7F5F3] block truncate">{atleta.name}</span>
          <span className="text-[10px] text-[#737373] block truncate">@{atleta.username}</span>
        </div>

        <span className={`shrink-0 text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md border ${estado.borda} ${estado.texto}`}>
          {estado.rotulo}
        </span>
      </div>

      {mediu ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Metrica
              rotulo="VFC (lnRMSSD)"
              valor={Number(atleta.lnrmssd).toFixed(2)}
              cor={estado.texto}
              nota={
                desvio === null
                  ? 'sem base ainda'
                  : `${desvio >= 0 ? '+' : ''}${desvio.toFixed(0)}% vs base`
              }
            />
            <Metrica
              rotulo="Ação sugerida"
              valor={atleta.suggested_action || '—'}
              cor="text-[#F7F5F3]"
            />
          </div>

          {atleta.explanation_text && (
            <div className="bg-[#101010] border border-[#262626] rounded-lg p-2.5">
              <span className="text-[9px] text-[#A1A1AA] uppercase tracking-widest block mb-1">
                Leitura do agente
              </span>
              <p className="text-[11px] text-[#D4D4D8] leading-relaxed">{atleta.explanation_text}</p>
            </div>
          )}
        </>
      ) : (
        // Sem medição hoje não há o que interpretar. Dizer isso é
        // mais útil do que desenhar um cartão com traços no lugar
        // dos números.
        <div className="bg-[#101010] border border-[#3F3F46] rounded-lg p-2.5 flex items-start gap-2">
          <span className="material-symbols-outlined text-[#A1A1AA] text-[16px]">sensors</span>
          <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
            Ainda não mediu a VFC hoje. Sem medição não há leitura — este atleta é um ponto cego,
            e não um atleta bem.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onAbrir}
          className="min-h-[44px] bg-[#101010] hover:bg-[#262626] border border-[#262626] rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
        >
          <span className="material-symbols-outlined text-[#A1A1AA] text-[16px]">visibility</span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#F7F5F3]">Ver ficha</span>
        </button>
        <button
          type="button"
          onClick={onPrescrever}
          className="min-h-[44px] bg-[#FF5500] hover:bg-[#FF6A1F] rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
        >
          <span className="material-symbols-outlined text-[#0D0D0D] text-[16px]">edit</span>
          <span className="text-[11px] font-bold uppercase tracking-wider text-[#0D0D0D]">Prescrever</span>
        </button>
      </div>
    </div>
  );
};

// ------------------------------------------------------------

/**
 * O que a conta de treinador vê antes de existir uma assessoria.
 *
 * Esta tela já dizia "Nenhuma assessoria" e parava aí: a rota de
 * criação existia no backend desde sempre, sem nada no app que a
 * chamasse. O treinador chegava numa porta fechada sem maçaneta —
 * e o resto do módulo (atletas, prescrição, convite) depende da
 * assessoria existir, então era a jornada inteira travada.
 */
const CriarAssessoria: React.FC<{
  gestao: GestaoAtletasData;
  onCriada: () => void | Promise<void>;
}> = ({ gestao, onCriada }) => {
  const [nome, setNome] = useState('');
  const [local, setLocal] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [descricao, setDescricao] = useState('');
  const [plano, setPlano] = useState<string>('basic');

  const podeEnviar = nome.trim().length > 0 && !gestao.isSaving;

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!podeEnviar) return;
    gestao.limpar();
    try {
      await gestao.criarAssessoria({
        name: nome.trim(),
        location: local.trim() || undefined,
        cnpj: cnpj.trim() || undefined,
        description: descricao.trim() || undefined,
        plan_type: plano,
      });
      await onCriada();
    } catch {
      /* gestao.error mostra o motivo */
    }
  };

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto px-4 sm:px-5 pt-6 pb-8 space-y-4">
      <div className="bg-[#1C1C1C] border border-[#262626] rounded-2xl p-5 text-center space-y-2">
        <span className="material-symbols-outlined text-[#A1A1AA] text-[32px]">groups</span>
        <h2 className="font-headline text-base text-[#F7F5F3] uppercase">Nenhuma assessoria</h2>
        <p className="text-xs text-[#A1A1AA] leading-relaxed">
          Sua conta é de treinador, mas ainda não está vinculada a uma assessoria. Sem isso não há
          atletas para acompanhar. Crie a sua abaixo.
        </p>
      </div>

      <form onSubmit={enviar} className="bg-[#1C1C1C] border border-[#FF5500]/40 rounded-2xl p-4 space-y-3">
        <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase tracking-widest block">
          Criar assessoria
        </span>

        <label className="block space-y-1">
          <span className="text-[10px] text-[#A1A1AA] uppercase tracking-wider">Nome *</span>
          <input
            type="text"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
            maxLength={120}
            placeholder="Ex.: Assessoria Rush"
            className="w-full min-h-[44px] bg-[#101010] border border-[#262626] rounded-lg px-3 text-sm text-[#F7F5F3] placeholder:text-[#525252] focus:border-[#FF5500] focus:outline-none"
          />
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block space-y-1">
            <span className="text-[10px] text-[#A1A1AA] uppercase tracking-wider">Cidade</span>
            <input
              type="text"
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              maxLength={120}
              className="w-full min-h-[44px] bg-[#101010] border border-[#262626] rounded-lg px-3 text-sm text-[#F7F5F3] focus:border-[#FF5500] focus:outline-none"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-[10px] text-[#A1A1AA] uppercase tracking-wider">CNPJ</span>
            <input
              type="text"
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              maxLength={20}
              inputMode="numeric"
              className="w-full min-h-[44px] bg-[#101010] border border-[#262626] rounded-lg px-3 text-sm text-[#F7F5F3] focus:border-[#FF5500] focus:outline-none"
            />
          </label>
        </div>

        <label className="block space-y-1">
          <span className="text-[10px] text-[#A1A1AA] uppercase tracking-wider">Descrição</span>
          <textarea
            value={descricao}
            onChange={(e) => setDescricao(e.target.value)}
            rows={2}
            maxLength={400}
            className="w-full bg-[#101010] border border-[#262626] rounded-lg px-3 py-2 text-sm text-[#F7F5F3] resize-none focus:border-[#FF5500] focus:outline-none"
          />
        </label>

        <div className="space-y-1.5">
          <span className="text-[10px] text-[#A1A1AA] uppercase tracking-wider block">
            Plano — define quantos atletas cabem
          </span>
          <div className="grid grid-cols-3 gap-2">
            {PLANOS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlano(p.id)}
                aria-pressed={plano === p.id}
                className={`min-h-[44px] rounded-lg border px-2 py-1.5 transition-colors cursor-pointer ${
                  plano === p.id
                    ? 'border-[#FF5500] bg-[#FF5500]/10'
                    : 'border-[#262626] bg-[#101010] hover:border-[#404040]'
                }`}
              >
                <span className={`block text-xs font-bold uppercase ${plano === p.id ? 'text-[#FF5500]' : 'text-[#F7F5F3]'}`}>
                  {p.nome}
                </span>
                <span className="block text-[9px] text-[#737373]">{p.vagas} atletas</span>
              </button>
            ))}
          </div>
        </div>

        {gestao.error && (
          <div className="bg-[#101010] border border-[#EF4444] rounded-lg p-3 flex items-start gap-2">
            <span className="material-symbols-outlined text-[#EF4444] text-[16px]">error</span>
            <span className="text-xs text-[#F7F5F3] leading-relaxed">{gestao.error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={!podeEnviar}
          className="w-full min-h-[44px] bg-[#FF5500] disabled:bg-[#262626] disabled:text-[#737373] rounded-lg flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed transition-colors"
        >
          <span className="material-symbols-outlined text-[#0D0D0D] text-[18px]">add</span>
          <span className="text-xs font-bold uppercase tracking-wider text-[#0D0D0D]">
            {gestao.isSaving ? 'Criando…' : 'Criar assessoria'}
          </span>
        </button>

        <p className="text-[10px] text-[#737373] leading-relaxed">
          Você passa a ser o responsável pela assessoria e pode convidar ou cadastrar atletas em
          seguida. O plano pode ser trocado depois.
        </p>
      </form>
    </div>
  );
};

// ------------------------------------------------------------

export const CoachDashboardScreen: React.FC<CoachDashboardScreenProps> = ({
  painel, gestao, onAbrirAtleta, onPrescrever, onAssessoriaCriada,
}) => {
  const { athletes, summary, academy, isLoading, semAssessoria, error } = painel;

  if (semAssessoria) {
    return <CriarAssessoria gestao={gestao} onCriada={onAssessoriaCriada} />;
  }

  if (isLoading && athletes.length === 0) {
    return (
      <div className="flex flex-col w-full max-w-2xl mx-auto px-4 sm:px-5 pt-2 pb-8 space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-28 rounded-2xl bg-[#1C1C1C] border border-[#262626] animate-pulse" />
        ))}
      </div>
    );
  }

  const total = summary?.total_athletes ?? 0;
  const mediram = summary?.measured_today ?? 0;
  const naoMediram = summary?.not_measured ?? 0;
  const pctMedido = total > 0 ? Math.round((mediram / total) * 100) : 0;
  const contagem = summary?.status_breakdown || {};

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto px-4 sm:px-5 space-y-5 pt-2 pb-8">
      {/* Cabeçalho */}
      <div className="border-b border-[#262626] pb-3">
        <span className="font-label-caps text-[10px] text-[#FF5500] uppercase tracking-widest font-extrabold block">
          Assessoria
        </span>
        <h1 className="font-headline-md text-[#F7F5F3] uppercase tracking-tight">
          {academy?.name || 'Painel da equipe'}
        </h1>
        <p className="text-xs text-[#737373] leading-relaxed mt-1">
          {total} {total === 1 ? 'atleta monitorado' : 'atletas monitorados'}
          {painel.date ? ` • leitura de ${painel.date}` : ''}
        </p>
      </div>

      {error && (
        <div role="alert" className="bg-[#1C1C1C] border border-[#EF4444] rounded-xl p-3 flex items-start gap-2">
          <span className="material-symbols-outlined text-[#EF4444] text-[18px]">error</span>
          <span className="text-xs text-[#F7F5F3] leading-relaxed">{error}</span>
        </div>
      )}

      {/* Medição do dia */}
      <div className="bg-[#1C1C1C] rounded-2xl border border-[#262626] p-4 space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase tracking-widest block">
              Medição de hoje
            </span>
            <span className="font-headline text-2xl text-[#F7F5F3]">
              {mediram}<span className="text-[#737373] text-lg">/{total}</span>
            </span>
          </div>
          <span className={`font-headline text-xl ${pctMedido >= 80 ? 'text-[#22C55E]' : pctMedido >= 50 ? 'text-[#FACC15]' : 'text-[#EF4444]'}`}>
            {pctMedido}%
          </span>
        </div>

        <div className="h-2 bg-[#101010] rounded-full overflow-hidden" role="presentation">
          <div
            className="h-full bg-[#FF5500] rounded-full transition-all"
            style={{ width: `${pctMedido}%` }}
          />
        </div>

        {naoMediram > 0 && (
          <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
            <strong className="text-[#F7F5F3]">{naoMediram}</strong>{' '}
            {naoMediram === 1 ? 'atleta ainda não mediu' : 'atletas ainda não mediram'} a VFC hoje.
            Eles aparecem na lista abaixo como ponto cego.
          </p>
        )}
      </div>

      {/* Estado da equipe */}
      <div className="space-y-2">
        <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase tracking-widest block">
          Estado fisiológico da equipe
        </span>
        <div className="grid grid-cols-2 gap-2">
          {([
            ['recovery', contagem.recovery || 0],
            ['attention', contagem.attention || 0],
            ['favorable', contagem.favorable || 0],
            ['cego', naoMediram],
          ] as const).map(([chave, valor]) => {
            const e = ESTADO[chave as keyof typeof ESTADO];
            return (
              <div key={chave} className={`bg-[#1C1C1C] border ${e.borda} rounded-xl p-3`}>
                <span className={`font-headline text-2xl block leading-none ${e.texto}`}>{valor}</span>
                <span className="text-[10px] text-[#A1A1AA] uppercase tracking-widest block mt-1">
                  {e.rotulo}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Triagem */}
      <div className="space-y-2.5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase tracking-widest">
            Triagem por risco
          </span>
          <span className="text-[9px] text-[#737373] uppercase tracking-widest">
            mais crítico primeiro
          </span>
        </div>

        {athletes.length === 0 ? (
          <div className="bg-[#1C1C1C] border border-[#262626] rounded-2xl p-5 text-center">
            <span className="material-symbols-outlined text-[#A1A1AA] text-[28px]">groups</span>
            <p className="text-xs text-[#A1A1AA] leading-relaxed mt-1">
              Nenhum atleta nesta assessoria ainda.
            </p>
          </div>
        ) : (
          // A ordem vem do backend e é preservada de propósito.
          athletes.map((a) => (
            <CartaoAtleta
              key={a.id}
              atleta={a}
              onAbrir={() => onAbrirAtleta(a.id)}
              onPrescrever={() => onPrescrever(a.id)}
            />
          ))
        )}
      </div>

      {/* Volume da equipe */}
      {summary?.last_30d && (
        <div className="bg-[#1C1C1C] rounded-2xl border border-[#262626] p-4">
          <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase tracking-widest block mb-2">
            Equipe nos últimos 30 dias
          </span>
          <div className="grid grid-cols-2 gap-2">
            <Metrica rotulo="Atividades" valor={String(summary.last_30d.activities ?? 0)} />
            <Metrica rotulo="Volume total" valor={`${summary.last_30d.total_km ?? 0} km`} cor="text-[#FF5500]" />
          </div>
        </div>
      )}
    </div>
  );
};
