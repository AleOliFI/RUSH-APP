// ============================================================
// RUSH RUNNING — Notificações
// ------------------------------------------------------------
// Curtidas, comentários e novos seguidores já geram notificação
// no backend. Este hook lê a lista paginada e mantém o contador
// de não lidas — que o sino exibe em todas as telas.
//
// Marcar como lida é otimista: a linha muda na hora e o estado
// volta atrás se a requisição falhar.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { notifications as notificationsApi } from '../api';

export interface RushNotification {
  id: string;
  type: string;
  title?: string | null;
  message?: string | null;
  read: number;
  created_at: string;
  /** Quem originou. Null em notificações do sistema. */
  source_name: string | null;
  source_username: string | null;
  source_avatar: string | null;
  activity_id?: string | null;
}

export interface NotificationsData {
  items: RushNotification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  /** Falso quando a última página veio incompleta — não há mais o que buscar. */
  hasMore: boolean;
  reload: () => Promise<void>;
  loadMore: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

const PAGE_SIZE = 30;

export function useNotifications(enabled = true): NotificationsData {
  const [items, setItems] = useState<RushNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(async (targetPage: number, append: boolean) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await notificationsApi.list(targetPage, PAGE_SIZE);
      const list: RushNotification[] = res?.notifications || [];
      setItems((current) => (append ? [...current, ...list] : list));
      setUnreadCount(res?.unread_count ?? 0);
      setPage(targetPage);
      setHasMore(list.length === PAGE_SIZE);
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar notificações');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const reload = useCallback(() => fetchPage(1, false), [fetchPage]);

  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) return;
    await fetchPage(page + 1, true);
  }, [fetchPage, hasMore, isLoading, page]);

  useEffect(() => {
    if (enabled) reload();
  }, [enabled, reload]);

  const markRead = useCallback(
    async (id: string) => {
      const target = items.find((n) => n.id === id);
      if (!target || target.read) return;

      setItems((current) => current.map((n) => (n.id === id ? { ...n, read: 1 } : n)));
      setUnreadCount((count) => Math.max(0, count - 1));

      try {
        await notificationsApi.markRead(id);
      } catch (err: any) {
        // Desfaz a marcação otimista: a notificação segue não lida.
        setItems((current) => current.map((n) => (n.id === id ? { ...n, read: 0 } : n)));
        setUnreadCount((count) => count + 1);
        setError(err?.message || 'Não foi possível marcar como lida');
      }
    },
    [items],
  );

  const markAllRead = useCallback(async () => {
    const previous = items;
    const previousCount = unreadCount;

    setItems((current) => current.map((n) => ({ ...n, read: 1 })));
    setUnreadCount(0);

    try {
      await notificationsApi.readAll();
    } catch (err: any) {
      setItems(previous);
      setUnreadCount(previousCount);
      setError(err?.message || 'Não foi possível marcar todas como lidas');
    }
  }, [items, unreadCount]);

  return { items, unreadCount, isLoading, error, hasMore, reload, loadMore, markRead, markAllRead };
}

/**
 * Só o contador, para o sino do cabeçalho: evita carregar a lista
 * inteira em telas que apenas mostram o badge.
 */
export function useUnreadCount(enabled = true) {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const res = await notificationsApi.unreadCount();
      setCount(res?.unread_count ?? 0);
    } catch {
      // Um badge que falha não deve quebrar a tela: fica no último valor.
    }
  }, []);

  useEffect(() => {
    if (enabled) refresh();
  }, [enabled, refresh]);

  return { count, refresh };
}
