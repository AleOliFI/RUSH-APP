// ============================================================
// RUSH RUNNING — Ajustes, privacidade e exclusão de conta
// ------------------------------------------------------------
// Os valores atuais já chegam em GET /api/users/me: a tela abre
// preenchida, sem requisição extra. Os PUTs aceitam alteração
// parcial — mande só o que mudou.
//
// A exclusão de conta é exigência da App Store (5.1.1) e hoje é
// o único caminho para o atleta sair da plataforma.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { users } from '../api';

export interface UserSettings {
  language: string | null;
  timezone: string | null;
  notifications_enabled: boolean;
  email_notifications: boolean;
  push_notifications: boolean;
}

export interface PrivacySettings {
  public_activities: boolean;
  show_hrv_status: boolean;
  show_vo2max: boolean;
  show_achievements: boolean;
  /** Gravado no banco, mas ainda não há mensagens no app. */
  allow_messages: boolean;
}

export interface AccountSettingsData {
  settings: UserSettings | null;
  privacy: PrivacySettings | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  reload: () => Promise<void>;
  /** Envia apenas os campos informados; um objeto vazio é recusado pelo backend. */
  updateSettings: (patch: Partial<UserSettings>) => Promise<void>;
  updatePrivacy: (patch: Partial<PrivacySettings>) => Promise<void>;
  deleteAccount: () => Promise<void>;
}

/** O banco guarda booleanos como 0/1. */
function toBool(value: any): boolean {
  return value === true || value === 1;
}

function normalizeSettings(raw: any): UserSettings | null {
  if (!raw) return null;
  return {
    language: raw.language ?? null,
    timezone: raw.timezone ?? null,
    notifications_enabled: toBool(raw.notifications_enabled),
    email_notifications: toBool(raw.email_notifications),
    push_notifications: toBool(raw.push_notifications),
  };
}

function normalizePrivacy(raw: any): PrivacySettings | null {
  if (!raw) return null;
  return {
    public_activities: toBool(raw.public_activities),
    show_hrv_status: toBool(raw.show_hrv_status),
    show_vo2max: toBool(raw.show_vo2max),
    show_achievements: toBool(raw.show_achievements),
    allow_messages: toBool(raw.allow_messages),
  };
}

export function useAccountSettings(enabled = true): AccountSettingsData {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [privacy, setPrivacy] = useState<PrivacySettings | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const me = await users.me();
      setSettings(normalizeSettings(me?.settings));
      setPrivacy(normalizePrivacy(me?.privacy));
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar as preferências');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) reload();
  }, [enabled, reload]);

  const updateSettings = useCallback(async (patch: Partial<UserSettings>) => {
    if (Object.keys(patch).length === 0) return;
    setIsSaving(true);
    setError(null);
    try {
      const updated = await users.settings(patch);
      setSettings(normalizeSettings(updated));
    } catch (err: any) {
      setError(err?.message || 'Não foi possível salvar as preferências');
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, []);

  const updatePrivacy = useCallback(async (patch: Partial<PrivacySettings>) => {
    if (Object.keys(patch).length === 0) return;
    setIsSaving(true);
    setError(null);
    try {
      const updated = await users.privacy(patch);
      setPrivacy(normalizePrivacy(updated));
    } catch (err: any) {
      setError(err?.message || 'Não foi possível salvar a privacidade');
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, []);

  /**
   * Exclusão definitiva. Quem chama é responsável por confirmar com o
   * atleta antes e por encerrar a sessão depois — o backend marca a conta
   * como excluída e os dados saem do ar imediatamente.
   */
  const deleteAccount = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    try {
      await users.deleteAccount();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível excluir a conta');
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, []);

  return {
    settings,
    privacy,
    isLoading,
    isSaving,
    error,
    reload,
    updateSettings,
    updatePrivacy,
    deleteAccount,
  };
}
