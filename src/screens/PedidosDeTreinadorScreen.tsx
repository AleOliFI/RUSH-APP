// ============================================================
// RUSH RUNNING — A fila de pedidos para virar treinador
// ------------------------------------------------------------
// Do outro lado do pedido precisa existir alguém que decide, e um
// lugar onde decidir. Sem esta tela, aprovar um treinador seria
// mexer no banco à mão — que é exatamente o que o fluxo veio
// resolver.
//
// Só `admin` chega aqui. `owner` não serve: qualquer treinador que
// cria uma assessoria vira `owner`, e aí donos estariam fabricando
// treinadores uns aos outros.
//
// Aprovar promove a conta a treinador, e isso dá a ela acesso à
// prontidão fisiológica e ao histórico dos atletas que aceitarem
// treinar com ela. Por isso a tela mostra o e-mail e o que a pessoa
// escreveu: é uma decisão sobre dado de saúde de terceiros, não um
// botão de cadastro.
// ============================================================

import React, { useCallback, useEffect, useState } from 'react';
import { academies } from '../api';

interface PedidosDeTreinadorScreenProps {
  onVoltar: () => void;
}

type Aba = 'pendente' | 'aprovada' | 'recusada';

const ABAS: ReadonlyArray<{ id: Aba; rotulo: string }> = [
  { id: 'pendente', rotulo: 'Na fila' },
  { id: 'aprovada', rotulo: 'Aprovados' },
  { id: 'recusada', rotulo: 'Recusados' },
];

export const PedidosDeTreinadorScreen: React.FC<PedidosDeTreinadorScreenProps> = ({ onVoltar }) => {
  const [aba, setAba] = useState<Aba>('pendente');
  const [lista, setLista] = useState<any[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [decidindo, setDecidindo] = useState<string | null>(null);
  const [motivos, setMotivos] = useState<Record<string, string>>({});

  const carregar = useCallback(async (qual: Aba) => {
    setCarregando(true);
    setErro(null);
    try {
      const r = await academies.pedidosDeTreinador(qual);
      setLista(Array.isArray(r?.solicitacoes) ? r.solicitacoes : []);
    } catch (err: any) {
      setErro(err?.message || 'Não foi possível carregar a fila');
      setLista([]);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(aba); }, [aba, carregar]);

  const decidir = async (id: string, aprovar: boolean) => {
    setDecidindo(id);
    setErro(null);
    try {
      await academies.decidirPedidoDeTreinador(id, aprovar, motivos[id]);
      await carregar(aba);
    } catch (err: any) {
      setErro(err?.message || 'Não foi possível registrar a decisão');
    } finally {
      setDecidindo(null);
    }
  };

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto px-4 sm:px-5 space-y-4 pt-2 pb-8">
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
          Administração
        </span>
        <h1 className="font-headline-md text-[#F7F5F3] uppercase tracking-tight">
          Pedidos para treinar
        </h1>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {ABAS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setAba(a.id)}
            aria-pressed={aba === a.id}
            className={`min-h-[44px] rounded-xl border text-[11px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
              aba === a.id
                ? 'bg-[#1C1C1C] border-[#FF5500] text-[#F7F5F3]'
                : 'bg-[#101010] border-[#262626] text-[#A1A1AA] hover:border-[#353534]'
            }`}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      {erro && <p className="text-xs text-[#EF4444] font-bold" role="alert">{erro}</p>}

      {carregando ? (
        <p className="text-xs text-[#A1A1AA]">Carregando…</p>
      ) : lista.length === 0 ? (
        <p className="text-xs text-[#A1A1AA]">
          {aba === 'pendente' ? 'Nenhum pedido na fila.' : 'Nada aqui.'}
        </p>
      ) : (
        <div className="space-y-3">
          {lista.map((p) => (
            <div key={p.id} className="bg-[#1C1C1C] rounded-2xl border border-[#262626] p-4 space-y-2.5">
              <div>
                <span className="font-headline text-sm text-[#F7F5F3] uppercase tracking-wide block">
                  {p.nome_da_assessoria}
                </span>
                <span className="text-[10px] text-[#A1A1AA] block mt-0.5">
                  {p.name || p.username || 'Atleta'} · {p.email}
                </span>
              </div>

              {p.mensagem && (
                <p className="text-[11px] text-[#D4D4D8] leading-relaxed bg-[#101010] rounded-xl p-3 border border-[#262626]">
                  {p.mensagem}
                </p>
              )}

              {aba === 'pendente' ? (
                <>
                  {/* Aprovar dá acesso a dado de saúde de outras
                      pessoas. O aviso fica ao lado do botão, não numa
                      tela de ajuda que ninguém abre. */}
                  <p className="text-[10px] text-[#FACC15] leading-relaxed">
                    Aprovar promove esta conta a treinador: ela passará a ver a prontidão
                    fisiológica e o histórico dos atletas que aceitarem treinar com ela.
                  </p>

                  <input
                    value={motivos[p.id] || ''}
                    onChange={(e) => setMotivos((m) => ({ ...m, [p.id]: e.target.value }))}
                    placeholder="Motivo (só é usado se recusar)"
                    className="w-full min-h-[44px] bg-[#101010] border border-[#262626] rounded-xl px-3 text-xs text-[#F7F5F3] placeholder:text-[#525252] focus:border-[#FF5500] focus:outline-none"
                  />

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => decidir(p.id, false)}
                      disabled={decidindo === p.id}
                      className="min-h-[44px] rounded-xl border border-[#353534] bg-[#101010] hover:bg-[#1C1C1C] disabled:opacity-60 text-xs font-bold uppercase tracking-wider text-[#A1A1AA] cursor-pointer transition-colors"
                    >
                      Recusar
                    </button>
                    <button
                      type="button"
                      onClick={() => decidir(p.id, true)}
                      disabled={decidindo === p.id}
                      className="min-h-[44px] rounded-xl bg-[#22C55E] hover:bg-[#16A34A] disabled:opacity-60 text-xs font-bold uppercase tracking-wider text-[#0D0D0D] cursor-pointer transition-colors"
                    >
                      {decidindo === p.id ? 'Salvando…' : 'Aprovar'}
                    </button>
                  </div>
                </>
              ) : (
                <p className="text-[10px] text-[#737373] leading-relaxed pt-1 border-t border-[#262626]">
                  {p.status === 'aprovada' ? 'Aprovado' : 'Recusado'} em{' '}
                  {p.decidido_em ? new Date(p.decidido_em).toLocaleDateString('pt-BR') : '—'}
                  {p.motivo_da_recusa ? ` · ${p.motivo_da_recusa}` : ''}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
