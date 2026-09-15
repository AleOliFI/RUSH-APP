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

/**
 * Zona de privacidade do percurso: o ponto e o raio que são apagados
 * das pontas do traçado antes de ele sair para outra pessoa.
 * `null` significa que o atleta não configurou nenhuma — e então o
 * percurso inteiro é publicado, começo e fim inclusive.
 */
export interface PrivacyZone {
  lat: number;
  lon: number;
  radius_m: number;
  label: string | null;
  updated_at?: string | null;
}

export interface ZoneLimits {
  min_radius_m: number;
  max_radius_m: number;
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
  /** Zona de privacidade do percurso, ou null se não houver. */
  zone: PrivacyZone | null;
  /**
   * A leitura da zona falhou, então `zone: null` aqui significa
   * "não sei", e NÃO "não existe".
   *
   * A tela precisa da diferença: afirmar "seus percursos são
   * publicados inteiros" quando a zona pode estar ativa é uma
   * afirmação falsa sobre a privacidade de alguém — e a errada
   * para se arriscar.
   */
  zoneUnavailable: boolean;
  /** Faixa de raio aceita pelo backend; a tela não deve deixar sair dela. */
  zoneLimits: ZoneLimits;
  saveZone: (zone: { lat: number; lon: number; radius_m: number; label?: string | null }) => Promise<void>;
  /** Remover volta a publicar o percurso inteiro. */
  removeZone: () => Promise<void>;
  /** Exige a senha: exclusão é irreversível e não pode depender só do token. */
  deleteAccount: (password: string) => Promise<void>;
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

function normalizeZone(raw: any): PrivacyZone | null {
  if (!raw) return null;
  return {
    lat: Number(raw.lat),
    lon: Number(raw.lon),
    radius_m: Number(raw.radius_m),
    label: raw.label ?? null,
    updated_at: raw.updated_at ?? null,
  };
}

/** Mesmos limites do backend, usados até a primeira resposta chegar. */
const LIMITES_PADRAO: ZoneLimits = { min_radius_m: 100, max_radius_m: 2000 };

export function useAccountSettings(enabled = true): AccountSettingsData {
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [privacy, setPrivacy] = useState<PrivacySettings | null>(null);
  const [zone, setZone] = useState<PrivacyZone | null>(null);
  const [zoneUnavailable, setZoneUnavailable] = useState(false);
  const [zoneLimits, setZoneLimits] = useState<ZoneLimits>(LIMITES_PADRAO);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // A zona vem de outra rota: /me não a devolve. As duas saem
      // juntas para a tela abrir de uma vez só — mas com
      // allSettled, e não all.
      //
      // Com `all`, uma falha na rota da zona derrubaria a promessa
      // inteira e a tela ficaria SEM NENHUM interruptor: a pessoa
      // perderia o acesso às preferências de notificação e
      // privacidade por causa de um recurso secundário. Um backend
      // antigo sem a tabela, ou uma falha de rede, bastaria.
      const [respostaMe, respostaZona] = await Promise.allSettled([
        users.me(),
        users.privacyZone(),
      ]);

      if (respostaMe.status === 'rejected') throw respostaMe.reason;

      const me = respostaMe.value;
      setSettings(normalizeSettings(me?.settings));
      setPrivacy(normalizePrivacy(me?.privacy));

      if (respostaZona.status === 'fulfilled') {
        setZone(normalizeZone(respostaZona.value?.zone));
        setZoneUnavailable(false);
        if (respostaZona.value?.limits) setZoneLimits(respostaZona.value.limits);
      } else {
        // Não dá para dizer que não há zona: dá para dizer que não
        // foi possível ler. O resto da tela continua utilizável.
        setZone(null);
        setZoneUnavailable(true);
      }
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

  const saveZone = useCallback(
    async (nova: { lat: number; lon: number; radius_m: number; label?: string | null }) => {
      setIsSaving(true);
      setError(null);
      try {
        const resposta = await users.savePrivacyZone(nova);
        setZone(normalizeZone(resposta?.zone));
        setZoneUnavailable(false);
      } catch (err: any) {
        setError(err?.message || 'Não foi possível salvar a zona de privacidade');
        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [],
  );

  const removeZone = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    try {
      await users.removePrivacyZone();
      setZone(null);
      setZoneUnavailable(false);
    } catch (err: any) {
      setError(err?.message || 'Não foi possível remover a zona de privacidade');
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
  const deleteAccount = useCallback(async (password: string) => {
    setIsSaving(true);
    setError(null);
    try {
      await users.deleteAccount(password);
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
    zone,
    zoneUnavailable,
    zoneLimits,
    saveZone,
    removeZone,
    deleteAccount,
  };
}
