// ============================================================
// RUSH RUNNING — Excluir conta
// ------------------------------------------------------------
// Exigência da App Store 5.1.1: um app com cadastro precisa
// oferecer exclusão de conta dentro do próprio app.
//
// O desenho falava em "período de carência de 30 dias", "nós de
// banco expurgados" e destruição de chave "conforme o padrão DoD
// 5220.22-M". Nada disso existe: a exclusão marca a conta como
// excluída, encerra as sessões e tira os dados do ar na hora. A
// tela descreve esse processo, e não um que soaria melhor.
// ============================================================

import React, { useState } from 'react';
import { activitiesToCsv, downloadCsv } from '../utils/exportCsv';

interface DeleteAccountScreenProps {
  /** Assinatura vigente, para avisar sobre a cobrança na loja. */
  subscription: { status?: string; tier?: string; is_pro?: boolean } | null;
  /** Atividades já carregadas, para o atleta levar os dados antes de sair. */
  activities: any[];
  isDeleting: boolean;
  error: string | null;
  onDelete: (password: string) => Promise<void>;
  onCancel: () => void;
}

const PERDAS = [
  {
    titulo: 'Histórico de corridas e percursos',
    desc: 'Atividades, splits, traçados de GPS e as séries de frequência cardíaca gravadas.',
  },
  {
    titulo: 'Medições de VFC e bem-estar',
    desc: 'Toda a série de RMSSD, a baseline construída ao longo do tempo e os questionários diários.',
  },
  {
    titulo: 'Garagem de tênis',
    desc: 'Calçados cadastrados, quilometragem acumulada e o histórico de aposentadoria.',
  },
  {
    titulo: 'Perfil e interações',
    desc: 'Seguidores, comentários, curtidas, fotos publicadas e conquistas.',
  },
];

export const DeleteAccountScreen: React.FC<DeleteAccountScreenProps> = ({
  subscription,
  activities,
  isDeleting,
  error,
  onDelete,
  onCancel,
}) => {
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [confirmou, setConfirmou] = useState(false);
  const [baixou, setBaixou] = useState(false);

  const temAssinatura =
    !!subscription &&
    (subscription.is_pro || ['active', 'trial'].includes(String(subscription.status)));

  const baixarDados = () => {
    const hoje = new Date().toISOString().split('T')[0];
    downloadCsv(`rush-minhas-atividades-${hoje}.csv`, activitiesToCsv(activities));
    setBaixou(true);
  };

  const podeExcluir = senha.trim().length > 0 && confirmou && !isDeleting;

  /**
   * O hook já registra a mensagem de erro para a tela exibir; capturar aqui
   * evita que a promessa rejeitada vire uma exceção solta no navegador.
   */
  const confirmarExclusao = async () => {
    try {
      await onDelete(senha);
    } catch {
      setSenha('');
    }
  };

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto px-4 sm:px-5 space-y-4 pt-2 pb-8">
      {/* Cabeçalho */}
      <div className="border-b border-[#262626] pb-3">
        <span className="font-label-caps text-[10px] text-[#EF4444] uppercase tracking-widest font-extrabold block">
          Ação irreversível
        </span>
        <h1 className="font-headline-md text-[#F7F5F3] uppercase tracking-tight">
          Excluir conta e dados
        </h1>
        <p className="text-xs text-[#737373] leading-relaxed mt-1">
          Sua conta é encerrada na hora: as sessões abertas param de valer e seus dados saem do ar
          imediatamente. Não há como desfazer pelo app.
        </p>
      </div>

      {/* Exportar antes */}
      <div className="bg-[#1C1C1C] rounded-2xl border border-[#262626] p-4 space-y-3">
        <div>
          <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase tracking-widest block">
            Antes de sair
          </span>
          <span className="font-headline text-base text-[#F7F5F3] uppercase">Leve seus dados</span>
        </div>

        <p className="text-xs text-[#A1A1AA] leading-relaxed">
          {activities.length > 0
            ? `Você tem ${activities.length} ${activities.length === 1 ? 'atividade registrada' : 'atividades registradas'}. Baixe a planilha antes de excluir — depois não há como recuperar.`
            : 'Você ainda não tem atividades registradas para exportar.'}
        </p>

        {activities.length > 0 && (
          <button
            type="button"
            onClick={baixarDados}
            className="w-full min-h-[52px] bg-[#101010] hover:bg-[#262626] border border-[#262626] rounded-xl flex items-center justify-center gap-2 text-[#F7F5F3] cursor-pointer transition-colors"
          >
            <span className="material-symbols-outlined text-[#FF5500] text-[20px]">
              {baixou ? 'check_circle' : 'download'}
            </span>
            <span className="text-xs font-bold uppercase tracking-wider">
              {baixou ? 'Planilha baixada' : 'Baixar minhas atividades (CSV)'}
            </span>
          </button>
        )}

        <p className="text-[10px] text-[#737373] leading-relaxed">
          O percurso de cada corrida pode ser baixado em .GPX individualmente, pelo histórico de treinos.
        </p>
      </div>

      {/* O que se perde */}
      <div className="space-y-2">
        <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase tracking-widest block">
          O que será apagado
        </span>

        {PERDAS.map((item, indice) => (
          <div
            key={item.titulo}
            className="bg-[#1C1C1C] rounded-xl border border-[#262626] p-3.5 flex gap-3"
          >
            <span className="font-telemetry text-[10px] text-[#EF4444] font-black shrink-0 pt-0.5">
              {String(indice + 1).padStart(2, '0')}
            </span>
            <div>
              <span className="font-headline text-sm uppercase text-[#F7F5F3] block leading-tight">
                {item.titulo}
              </span>
              <span className="text-[11px] text-[#737373] leading-relaxed block mt-0.5">{item.desc}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Assinatura */}
      {temAssinatura && (
        <div className="bg-[#FACC15]/10 border border-[#FACC15]/40 rounded-2xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#FACC15] text-[20px]">workspace_premium</span>
            <span className="font-headline text-sm uppercase text-[#F7F5F3]">
              Você tem RUSH PRO ativo
            </span>
          </div>
          <p className="text-xs text-[#e5e2e1] leading-relaxed">
            Excluir a conta <strong>não cancela</strong> a cobrança na loja de aplicativos. Cancele a
            assinatura direto na sua conta Apple ID ou Google Play antes de prosseguir.
          </p>
        </div>
      )}

      {/* Confirmação */}
      <div className="bg-[#1C1C1C] rounded-2xl border border-[#EF4444]/40 p-4 space-y-3">
        <span className="font-label-sm text-[10px] text-[#EF4444] uppercase tracking-widest block">
          Confirmação
        </span>

        <div>
          <label htmlFor="senha-exclusao" className="text-xs text-[#A1A1AA] block mb-1.5">
            Digite sua senha para confirmar
          </label>
          <div className="relative">
            <input
              id="senha-exclusao"
              type={mostrarSenha ? 'text' : 'password'}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="current-password"
              className="w-full h-14 bg-[#101010] border border-[#262626] rounded-xl px-4 pr-12 text-sm text-[#F7F5F3] focus:border-[#EF4444] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setMostrarSenha((v) => !v)}
              aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-[#737373] hover:text-[#F7F5F3] cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">
                {mostrarSenha ? 'visibility_off' : 'visibility'}
              </span>
            </button>
          </div>
        </div>

        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            id="confirma-exclusao"
            type="checkbox"
            checked={confirmou}
            onChange={(e) => setConfirmou(e.target.checked)}
            className="mt-0.5 w-5 h-5 accent-[#EF4444] cursor-pointer shrink-0"
          />
          <span className="text-xs text-[#e5e2e1] leading-relaxed">
            Entendo que perco meu histórico de treinos, minhas medições e minha baseline de VFC, e que
            isso não pode ser desfeito pelo app.
          </span>
        </label>
      </div>

      {error && (
        <div role="alert" className="bg-[#EF4444]/12 border border-[#EF4444]/40 rounded-xl px-4 py-3">
          <span className="text-xs text-[#e5e2e1]">{error}</span>
        </div>
      )}

      {/* Ações */}
      <button
        type="button"
        onClick={confirmarExclusao}
        disabled={!podeExcluir}
        className="w-full min-h-[56px] bg-[#EF4444] hover:bg-[#DC2626] disabled:bg-[#262626] disabled:text-[#737373] disabled:cursor-not-allowed text-[#F7F5F3] font-headline text-base uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-all"
      >
        <span className="material-symbols-outlined text-[20px]">delete_forever</span>
        <span>{isDeleting ? 'Excluindo…' : 'Excluir minha conta'}</span>
      </button>

      <button
        type="button"
        onClick={onCancel}
        className="w-full min-h-[52px] bg-[#1C1C1C] hover:bg-[#262626] border border-[#262626] rounded-xl flex items-center justify-center gap-2 text-[#F7F5F3] cursor-pointer transition-colors"
      >
        <span className="material-symbols-outlined text-[#22C55E] text-[20px]">shield</span>
        <span className="font-headline text-sm uppercase tracking-wider">Cancelar e manter conta</span>
      </button>
    </div>
  );
};
