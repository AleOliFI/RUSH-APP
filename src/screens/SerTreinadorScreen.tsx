// ============================================================
// RUSH RUNNING — Pedir para abrir uma assessoria
// ------------------------------------------------------------
// POST /api/academies criava a assessoria E promovia quem chamava a
// `owner`, exigindo apenas estar logado: qualquer atleta virava dono
// chamando a API direto. A rota foi fechada para quem já é
// treinador — e isso deixou o app sem caminho nenhum para alguém SE
// TORNAR treinador.
//
// Esta tela é o caminho: a pessoa pede, um administrador decide.
// Promoção não volta a ser autosserviço, mas também não depende mais
// de alguém mexer no banco à mão.
//
// A tela mostra o estado do pedido, e não só o formulário: quem
// pediu ontem precisa saber se foi aprovado, recusado — e, quando
// recusado, por quê.
// ============================================================

import React, { useCallback, useEffect, useState } from 'react';
import { academies } from '../api';

interface SerTreinadorScreenProps {
  onVoltar: () => void;
  /** Chamado quando o pedido foi aprovado e a conta já é treinador. */
  onAprovado?: () => void;
}

const ESTADO = {
  pendente: {
    cor: '#FACC15',
    icone: 'hourglass_top',
    titulo: 'Pedido enviado',
    texto: 'Seu pedido está na fila. Você será avisado quando houver resposta.',
  },
  aprovada: {
    cor: '#22C55E',
    icone: 'check_circle',
    titulo: 'Pedido aprovado',
    texto: 'Sua conta agora é de treinador. Abra o perfil para criar a sua assessoria.',
  },
  recusada: {
    cor: '#EF4444',
    icone: 'cancel',
    titulo: 'Pedido recusado',
    texto: 'Você pode enviar um novo pedido.',
  },
} as const;

export const SerTreinadorScreen: React.FC<SerTreinadorScreenProps> = ({ onVoltar, onAprovado }) => {
  const [pedido, setPedido] = useState<any>(null);
  const [carregando, setCarregando] = useState(true);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const [nome, setNome] = useState('');
  const [mensagem, setMensagem] = useState('');

  const carregar = useCallback(async () => {
    setCarregando(true);
    try {
      const r = await academies.meuPedidoDeTreinador();
      setPedido(r?.solicitacao || null);
    } catch (err: any) {
      setErro(err?.message || 'Não foi possível ler o seu pedido');
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => { carregar(); }, [carregar]);

  const enviar = async () => {
    setErro(null);
    if (nome.trim().length < 2) {
      setErro('Diga o nome da assessoria que você quer abrir.');
      return;
    }
    setEnviando(true);
    try {
      const r = await academies.pedirParaSerTreinador({
        nome_da_assessoria: nome.trim(),
        mensagem: mensagem.trim() || undefined,
      });
      setPedido(r?.solicitacao || null);
      setNome(''); setMensagem('');
    } catch (err: any) {
      setErro(err?.message || 'Não foi possível enviar o pedido');
    } finally {
      setEnviando(false);
    }
  };

  const estado = pedido?.status ? ESTADO[pedido.status as keyof typeof ESTADO] : null;
  // Recusado pode pedir de novo; pendente e aprovado, não.
  const podePedir = !pedido || pedido.status === 'recusada';

  const rotulo = 'font-label-sm text-[10px] text-[#A1A1AA] uppercase tracking-widest mb-1.5 block';
  const campo = 'w-full min-h-[48px] bg-[#101010] border border-[#262626] rounded-xl px-3 text-sm text-[#F7F5F3] placeholder:text-[#525252] focus:border-[#FF5500] focus:outline-none';

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto px-4 sm:px-5 space-y-5 pt-2 pb-8">
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
          Assessoria
        </span>
        <h1 className="font-headline-md text-[#F7F5F3] uppercase tracking-tight">
          Quero treinar atletas
        </h1>
      </div>

      {carregando ? (
        <p className="text-xs text-[#A1A1AA]">Carregando…</p>
      ) : (
        <>
          {estado && (
            <div
              className="rounded-2xl border p-4 space-y-2"
              style={{ borderColor: `${estado.cor}55`, backgroundColor: `${estado.cor}0F` }}
            >
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px]" style={{ color: estado.cor }}>
                  {estado.icone}
                </span>
                <span className="font-headline text-sm text-[#F7F5F3] uppercase tracking-wide">
                  {estado.titulo}
                </span>
              </div>
              <p className="text-[11px] text-[#D4D4D8] leading-relaxed">{estado.texto}</p>
              <p className="text-[10px] text-[#737373] leading-relaxed">
                Assessoria pedida: <strong className="text-[#A1A1AA]">{pedido.nome_da_assessoria}</strong>
              </p>
              {pedido.status === 'recusada' && pedido.motivo_da_recusa && (
                <p className="text-[11px] text-[#D4D4D8] leading-relaxed pt-1 border-t border-[#262626]">
                  Motivo: {pedido.motivo_da_recusa}
                </p>
              )}
              {pedido.status === 'aprovada' && onAprovado && (
                <button
                  type="button"
                  onClick={onAprovado}
                  className="w-full min-h-[44px] mt-1 bg-[#22C55E] hover:bg-[#16A34A] rounded-xl text-xs font-bold uppercase tracking-wider text-[#0D0D0D] cursor-pointer transition-colors"
                >
                  Criar minha assessoria
                </button>
              )}
            </div>
          )}

          {podePedir && (
            <div className="bg-[#1C1C1C] rounded-2xl border border-[#262626] p-4 space-y-4">
              <p className="text-[11px] text-[#A1A1AA] leading-relaxed">
                Treinador enxerga a prontidão fisiológica e o histórico dos atletas que aceitarem
                treinar com ele. Por isso a conta não vira de treinador sozinha: alguém da equipe
                RUSH aprova cada pedido.
              </p>

              <label className="block">
                <span className={rotulo}>Nome da assessoria</span>
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Equipe Corre Itu"
                  className={campo}
                />
              </label>

              <label className="block">
                <span className={rotulo}>Conte um pouco (opcional)</span>
                <input
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  placeholder="Treino 20 atletas de rua há 6 anos"
                  className={campo}
                />
              </label>

              <button
                type="button"
                onClick={enviar}
                disabled={enviando}
                className="w-full min-h-[52px] bg-[#FF5500] hover:bg-[#FF6A1F] disabled:opacity-60 disabled:cursor-wait rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors"
              >
                <span className="material-symbols-outlined text-[#0D0D0D] text-[20px]">send</span>
                <span className="text-xs font-bold uppercase tracking-wider text-[#0D0D0D]">
                  {enviando ? 'Enviando…' : 'Enviar pedido'}
                </span>
              </button>
            </div>
          )}

          {erro && <p className="text-xs text-[#EF4444] font-bold" role="alert">{erro}</p>}
        </>
      )}
    </div>
  );
};
