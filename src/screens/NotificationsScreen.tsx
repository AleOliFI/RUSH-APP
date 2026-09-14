// ============================================================
// RUSH RUNNING — Central de notificações
// ------------------------------------------------------------
// O desenho trazia seis tipos de aviso. Quatro deles o backend não
// produz e não foram inventados aqui: "prescrição adaptada" pela VFC
// da manhã, "desgaste de sola" do tênis, "carga baixa" da cinta e
// "mudança de posição" no ranking. Nenhum existe como notificação —
// inventar a ficha faria a central mostrar aviso que nunca chega.
//
// Os tipos reais (curtida, comentário, seguidor, conquista, desafio,
// treino prescrito e sistema) estão todos aqui, distribuídos nas três
// abas do desenho.
//
// O rodapé "SINC: SATÉLITE PRONTO • LATÊNCIA 14MS" também saiu: o
// navegador não informa contagem de satélites nem latência de rede.
// ============================================================

import React, { useMemo, useState } from 'react';
import { Avatar } from '../components/rush/Avatar';
import { timeAgo } from '../data/adapters';
import type { NotificationsData, RushNotification } from '../hooks/useNotifications';
import type { PushData, PushStatus } from '../hooks/usePushNotifications';

type NotificationTab = 'todas' | 'treinos' | 'social';

interface NotificationsScreenProps {
  notifications: NotificationsData;
  push: PushData;
  onBack: () => void;
}

const ABAS: { id: NotificationTab; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'treinos', label: 'Treinos & IA' },
  { id: 'social', label: 'Social & Kudos' },
];

/** Cada tipo do backend cai em uma das abas do desenho. */
const ABA_DO_TIPO: Record<string, NotificationTab> = {
  like: 'social',
  comment: 'social',
  follow: 'social',
  achievement: 'treinos',
  challenge: 'treinos',
  plan_assigned: 'treinos',
  status: 'treinos',
  system: 'treinos',
};

const APARENCIA: Record<string, { icone: string; cor: string; rotulo: string }> = {
  like: { icone: 'favorite', cor: '#FF5500', rotulo: 'Kudos recebido' },
  comment: { icone: 'chat_bubble', cor: '#38BDF8', rotulo: 'Comentário em atividade' },
  follow: { icone: 'person_add', cor: '#22C55E', rotulo: 'Novo seguidor' },
  achievement: { icone: 'trophy', cor: '#FACC15', rotulo: 'Conquista' },
  challenge: { icone: 'flag', cor: '#FACC15', rotulo: 'Desafio' },
  plan_assigned: { icone: 'bolt', cor: '#FF5500', rotulo: 'Treino prescrito' },
  status: { icone: 'ecg_heart', cor: '#38BDF8', rotulo: 'Status fisiológico' },
  system: { icone: 'info', cor: '#A1A1AA', rotulo: 'RUSH Running' },
};

/** Hoje, Ontem, ou a data — o cabeçalho de cada bloco da lista. */
function rotuloDoDia(iso: string): string {
  const data = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  if (Number.isNaN(data.getTime())) return 'Sem data';

  const dia = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const hoje = new Date();
  const ontem = new Date(hoje);
  ontem.setDate(hoje.getDate() - 1);

  if (dia(data) === dia(hoje)) return 'Hoje';
  if (dia(data) === dia(ontem)) return 'Ontem';
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' });
}

/** O que a tela diz e oferece em cada uma das três portas do push. */
const PUSH_TEXTO: Record<PushStatus, { titulo: string; texto: string } | null> = {
  verificando: null,
  ligado: null,
  sem_suporte: {
    titulo: 'Este navegador não recebe push',
    texto:
      'Faltam o service worker ou a API de push. No iPhone, isso costuma significar que o app precisa ser adicionado à tela de início pelo Safari para receber notificações.',
  },
  servidor_sem_chaves: {
    titulo: 'Push não configurado no servidor',
    texto:
      'As chaves VAPID não estão definidas neste ambiente. As notificações continuam aparecendo aqui na central, mas não chegam ao aparelho.',
  },
  desligado: {
    titulo: 'Receber no aparelho',
    texto:
      'Ative para ser avisado de kudos, comentários e treinos prescritos mesmo com o app fechado.',
  },
  bloqueado: {
    titulo: 'Notificações bloqueadas',
    texto:
      'Você negou a permissão para este site. Nenhum botão aqui reverte isso — é preciso liberar nas configurações do navegador, no cadeado ao lado do endereço.',
  },
};

const NotificationRow: React.FC<{
  notificacao: RushNotification;
  onMarkRead: () => void;
}> = ({ notificacao, onMarkRead }) => {
  const visual = APARENCIA[notificacao.type] || APARENCIA.system;
  const naoLida = !notificacao.read;

  return (
    <button
      type="button"
      onClick={naoLida ? onMarkRead : undefined}
      aria-label={naoLida ? `Marcar como lida: ${notificacao.message || visual.rotulo}` : undefined}
      className={`w-full text-left rounded-2xl border p-3.5 flex gap-3 transition-colors ${
        naoLida
          ? 'bg-[#1C1C1C] border-[#FF5500]/35 cursor-pointer hover:border-[#FF5500]/60'
          : 'bg-[#141414] border-[#262626] cursor-default'
      }`}
    >
      {notificacao.source_name ? (
        <Avatar
          src={notificacao.source_avatar}
          name={notificacao.source_name}
          className="w-10 h-10 rounded-full object-cover shrink-0"
          initialsClassName="text-xs"
        />
      ) : (
        <span
          className="w-10 h-10 rounded-xl bg-[#101010] border border-[#262626] flex items-center justify-center shrink-0"
          style={{ color: visual.cor }}
        >
          <span className="material-symbols-outlined text-[20px]">{visual.icone}</span>
        </span>
      )}

      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span
            className="font-label-caps text-[10px] uppercase tracking-widest font-extrabold truncate"
            style={{ color: visual.cor }}
          >
            {visual.rotulo}
            {naoLida && ' •'}
          </span>
          <span className="font-telemetry text-[10px] text-[#737373] shrink-0">
            {timeAgo(notificacao.created_at)}
          </span>
        </span>

        <span className="text-xs text-[#e5e2e1] leading-relaxed block mt-1">
          {notificacao.message || visual.rotulo}
        </span>
      </span>
    </button>
  );
};

export const NotificationsScreen: React.FC<NotificationsScreenProps> = ({
  notifications,
  push,
  onBack,
}) => {
  const [aba, setAba] = useState<NotificationTab>('todas');

  const lista = useMemo(
    () =>
      aba === 'todas'
        ? notifications.items
        : notifications.items.filter((n) => (ABA_DO_TIPO[n.type] || 'treinos') === aba),
    [aba, notifications.items],
  );

  /** Agrupa preservando a ordem já cronológica que o backend devolveu. */
  const grupos = useMemo(() => {
    const saida: { dia: string; itens: RushNotification[] }[] = [];
    for (const item of lista) {
      const dia = rotuloDoDia(item.created_at);
      const ultimo = saida[saida.length - 1];
      if (ultimo && ultimo.dia === dia) ultimo.itens.push(item);
      else saida.push({ dia, itens: [item] });
    }
    return saida;
  }, [lista]);

  const avisoPush = PUSH_TEXTO[push.status];
  const podeLigar = push.status === 'desligado';

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto px-4 sm:px-5 space-y-4 pt-2 pb-8">
      {/* Cabeçalho */}
      <div className="flex items-center gap-2 border-b border-[#262626] pb-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Voltar"
          className="w-10 h-10 rounded-xl bg-[#1C1C1C] border border-[#262626] flex items-center justify-center text-[#F7F5F3] shrink-0 cursor-pointer hover:bg-[#262626] transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <div className="min-w-0 flex-1">
          <span className="font-label-caps text-[10px] text-[#FF5500] uppercase tracking-widest font-extrabold block">
            {notifications.unreadCount > 0
              ? `${notifications.unreadCount} ${notifications.unreadCount === 1 ? 'nova' : 'novas'}`
              : 'Em dia'}
          </span>
          <h1 className="font-headline-md text-[#F7F5F3] uppercase tracking-tight leading-none">
            Notificações
          </h1>
        </div>

        {notifications.unreadCount > 0 && (
          <button
            type="button"
            onClick={() => notifications.markAllRead()}
            className="min-h-[40px] px-3 rounded-xl bg-[#1C1C1C] border border-[#262626] text-[10px] font-headline uppercase tracking-wider text-[#A1A1AA] hover:text-[#F7F5F3] shrink-0 cursor-pointer transition-colors"
          >
            Limpar não lidas
          </button>
        )}
      </div>

      {/* Push no aparelho */}
      {avisoPush && (
        <div
          className={`rounded-2xl border p-4 space-y-3 ${
            push.status === 'bloqueado'
              ? 'bg-[#FACC15]/10 border-[#FACC15]/40'
              : 'bg-[#1C1C1C] border-[#262626]'
          }`}
        >
          <div className="flex items-start gap-3">
            <span
              className={`material-symbols-outlined text-[22px] shrink-0 ${
                push.status === 'bloqueado' ? 'text-[#FACC15]' : 'text-[#FF5500]'
              }`}
            >
              {push.status === 'bloqueado' ? 'notifications_off' : 'notifications_active'}
            </span>
            <div className="min-w-0">
              <span className="font-headline text-sm uppercase text-[#F7F5F3] block leading-tight">
                {avisoPush.titulo}
              </span>
              <span className="text-xs text-[#A1A1AA] leading-relaxed block mt-1">
                {avisoPush.texto}
              </span>
            </div>
          </div>

          {podeLigar && (
            <button
              type="button"
              onClick={push.enable}
              disabled={push.isBusy}
              className="w-full min-h-[48px] bg-[#FF5500] hover:bg-[#FF6B00] disabled:bg-[#262626] disabled:text-[#737373] text-[#0D0D0D] font-headline text-sm uppercase tracking-wider rounded-xl flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">notifications_active</span>
              <span>{push.isBusy ? 'Ativando…' : 'Ativar notificações'}</span>
            </button>
          )}
        </div>
      )}

      {push.status === 'ligado' && (
        <div className="bg-[#1C1C1C] rounded-2xl border border-[#262626] p-4 space-y-3">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-[#22C55E] text-[22px]">how_to_reg</span>
            <div className="min-w-0 flex-1">
              <span className="font-headline text-sm uppercase text-[#F7F5F3] block leading-tight">
                Push ativo neste aparelho
              </span>
              <span className="text-[11px] text-[#737373] block">
                Cada navegador precisa ser ativado separadamente.
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={push.sendTest}
              disabled={push.isBusy}
              className="flex-1 min-h-[44px] bg-[#101010] hover:bg-[#262626] border border-[#262626] rounded-xl text-[11px] font-headline uppercase tracking-wider text-[#F7F5F3] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              Enviar teste
            </button>
            <button
              type="button"
              onClick={push.disable}
              disabled={push.isBusy}
              className="flex-1 min-h-[44px] bg-[#101010] hover:bg-[#262626] border border-[#262626] rounded-xl text-[11px] font-headline uppercase tracking-wider text-[#A1A1AA] hover:text-[#F7F5F3] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              Desativar
            </button>
          </div>

          {push.testMessage && (
            <span className="text-[11px] text-[#22C55E] block">{push.testMessage}</span>
          )}
        </div>
      )}

      {push.error && (
        <div role="alert" className="bg-[#EF4444]/12 border border-[#EF4444]/40 rounded-xl px-4 py-3">
          <span className="text-xs text-[#e5e2e1]">{push.error}</span>
        </div>
      )}

      {/* Abas */}
      <div className="flex items-center gap-2" role="tablist" aria-label="Filtro de notificações">
        {ABAS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={aba === item.id}
            onClick={() => setAba(item.id)}
            className={`min-h-[44px] py-1.5 px-3.5 rounded-full text-xs font-bold uppercase transition-all cursor-pointer ${
              aba === item.id
                ? 'bg-[#FF5500] text-[#0D0D0D] shadow-md'
                : 'bg-[#1C1C1C] text-[#A1A1AA] hover:text-[#F7F5F3]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {notifications.error && (
        <div role="alert" className="bg-[#EF4444]/12 border border-[#EF4444]/40 rounded-xl px-4 py-3">
          <span className="text-xs text-[#e5e2e1]">{notifications.error}</span>
        </div>
      )}

      {/* Lista */}
      {notifications.isLoading && notifications.items.length === 0 ? (
        <div className="bg-[#1C1C1C] rounded-2xl border border-[#262626] p-6 text-center">
          <span className="font-telemetry text-xs text-[#737373] uppercase tracking-widest animate-pulse">
            Carregando…
          </span>
        </div>
      ) : grupos.length === 0 ? (
        <div className="bg-[#1C1C1C] rounded-2xl border border-[#262626] p-6 text-center space-y-1.5">
          <span className="material-symbols-outlined text-[#525252] text-[28px]">notifications</span>
          <span className="font-headline text-sm uppercase text-[#F7F5F3] block">
            {aba === 'todas' ? 'Nenhuma notificação' : 'Nada nesta aba'}
          </span>
          <span className="text-xs text-[#737373] leading-relaxed block">
            {aba === 'social'
              ? 'Kudos, comentários e novos seguidores aparecem aqui.'
              : aba === 'treinos'
                ? 'Conquistas, desafios e treinos prescritos aparecem aqui.'
                : 'Quando alguém interagir com suas corridas, você fica sabendo por aqui.'}
          </span>
        </div>
      ) : (
        <div className="space-y-4">
          {grupos.map((grupo) => (
            <div key={grupo.dia} className="space-y-2">
              <span className="font-headline text-sm uppercase text-[#F7F5F3] tracking-tight block">
                {grupo.dia}
              </span>
              {grupo.itens.map((item) => (
                <NotificationRow
                  key={item.id}
                  notificacao={item}
                  onMarkRead={() => notifications.markRead(item.id)}
                />
              ))}
            </div>
          ))}
        </div>
      )}

      {notifications.hasMore && (
        <button
          type="button"
          onClick={() => notifications.loadMore()}
          disabled={notifications.isLoading}
          className="w-full min-h-[48px] bg-[#1C1C1C] hover:bg-[#262626] border border-[#262626] rounded-xl text-xs font-headline uppercase tracking-wider text-[#A1A1AA] hover:text-[#F7F5F3] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {notifications.isLoading ? 'Carregando…' : 'Carregar mais'}
        </button>
      )}
    </div>
  );
};
