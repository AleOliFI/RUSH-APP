// ============================================================
// RUSH RUNNING — Dados da assessoria (visão do treinador)
// ------------------------------------------------------------
// O backend já entregava tudo isto e nenhuma tela consumia: sete
// rotas completas sem interface nenhuma. Quem entrava como
// treinador via exatamente a mesma tela de um atleta.
//
// Uma coisa a saber sobre o dashboard: ele já vem ORDENADO POR
// RISCO — recovery, depois attention, depois favorable. Essa
// ordem é a tese da tela e não um detalhe do SQL, então a lista
// preserva a ordem que chegou em vez de reordenar por nome.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { academies } from '../api';

/** O que o atleta reporta no dashboard da equipe. */
export interface AtletaDoPainel {
  id: string;
  name: string;
  username: string;
  avatar_url: string | null;
  /** Nulo quando o atleta ainda não mediu hoje — o "ponto cego". */
  status: 'favorable' | 'attention' | 'recovery' | null;
  lnrmssd: number | null;
  suggested_action: string | null;
  explanation_text: string | null;
}

export interface ResumoDoPainel {
  total_athletes: number;
  measured_today: number;
  not_measured: number;
  status_breakdown: Record<string, number>;
  last_30d: { activities: number; total_km: number };
}

export interface PainelData {
  date: string | null;
  athletes: AtletaDoPainel[];
  summary: ResumoDoPainel | null;
  /** A assessoria em si: nome e plano. */
  academy: any | null;
  /** Vagas do plano, para a tela de cadastro saber se ainda cabe alguém. */
  vagas: { usadas: number; limite: number } | null;
  isLoading: boolean;
  /** `true` quando a conta não está vinculada a nenhuma assessoria. */
  semAssessoria: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

/**
 * Painel da assessoria.
 *
 * `GET /academies/dashboard` responde 400 quando a conta não tem
 * `academy_id`. Isso não é erro de sistema — é o estado de um
 * treinador que ainda não criou a assessoria dele —, então a tela
 * precisa distinguir os dois casos.
 */
export function usePainelAssessoria(enabled = true): PainelData {
  const [date, setDate] = useState<string | null>(null);
  const [athletes, setAthletes] = useState<AtletaDoPainel[]>([]);
  const [summary, setSummary] = useState<ResumoDoPainel | null>(null);
  const [academy, setAcademy] = useState<any | null>(null);
  const [vagas, setVagas] = useState<{ usadas: number; limite: number } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [semAssessoria, setSemAssessoria] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // As duas saem juntas, mas com allSettled: a falha de uma não
      // pode apagar a outra da tela.
      const [painel, minha] = await Promise.allSettled([
        academies.dashboard(),
        academies.my(),
      ]);

      if (painel.status === 'fulfilled') {
        setSemAssessoria(false);
        setDate(painel.value?.date ?? null);
        setAthletes(Array.isArray(painel.value?.athletes) ? painel.value.athletes : []);
        setSummary(painel.value?.summary ?? null);
      } else {
        const msg = String(painel.reason?.message || '');
        // O backend responde 400 "não vinculado a uma assessoria".
        if (/assessoria/i.test(msg)) {
          setSemAssessoria(true);
          setAthletes([]);
          setSummary(null);
        } else {
          throw painel.reason;
        }
      }

      if (minha.status === 'fulfilled') {
        setAcademy(minha.value?.academy ?? null);
        const limite = Number(minha.value?.max_athletes);
        const usadas = Number(minha.value?.athletes_count);
        setVagas(Number.isFinite(limite) && Number.isFinite(usadas) ? { usadas, limite } : null);
      }
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar o painel da assessoria');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) reload();
  }, [enabled, reload]);

  return { date, athletes, summary, academy, vagas, isLoading, semAssessoria, error, reload };
}

// ------------------------------------------------------------

export interface FichaAtletaData {
  athlete: any | null;
  /** 30 dias de `daily_status`, do mais recente para o mais antigo. */
  hrvHistory: any[];
  recentActivities: any[];
  vo2max: any[];
  plan: any | null;
  /** FCmáx do atleta e de onde ela veio — medida ou estimada. */
  maxHr: number | null;
  maxHrSource: 'field_test' | 'age_estimate' | null;
  /** Zonas já calculadas pelo backend, para não recriar a regra aqui. */
  hrZones: Record<string, any> | null;
  isLoading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useFichaAtleta(athleteId: string | null): FichaAtletaData {
  const [dados, setDados] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!athleteId) return;
    setIsLoading(true);
    setError(null);
    try {
      setDados(await academies.athleteDetails(athleteId));
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar a ficha do atleta');
    } finally {
      setIsLoading(false);
    }
  }, [athleteId]);

  useEffect(() => {
    if (athleteId) reload();
    else setDados(null);
  }, [athleteId, reload]);

  // As chaves da resposta sao snake_case (hrv_history,
  // recent_activities, vo2max_history, current_plan). Ler
  // camelCase aqui devolveria listas vazias em tudo, sem erro
  // nenhum — a tela abriria em branco e pareceria "sem dados".
  return {
    athlete: dados?.athlete ?? null,
    hrvHistory: Array.isArray(dados?.hrv_history) ? dados.hrv_history : [],
    recentActivities: Array.isArray(dados?.recent_activities) ? dados.recent_activities : [],
    vo2max: Array.isArray(dados?.vo2max_history) ? dados.vo2max_history : [],
    plan: dados?.current_plan ?? null,
    maxHr: dados?.max_hr ?? null,
    maxHrSource: dados?.max_hr_source ?? null,
    hrZones: dados?.hr_zones ?? null,
    isLoading,
    error,
    reload,
  };
}

// ------------------------------------------------------------

export interface GestaoAtletasData {
  isSaving: boolean;
  error: string | null;
  /** Mensagem de sucesso da última ação, para a tela confirmar. */
  resultado: string | null;
  convidar: (email: string) => Promise<void>;
  cadastrar: (dados: Record<string, any>) => Promise<void>;
  /**
   * Cria a assessoria do treinador. O backend promove a conta a
   * `owner` e grava o `academy_id` — quem chamar precisa recarregar
   * o usuário depois, senão o app segue achando que não há assessoria.
   */
  criarAssessoria: (dados: Record<string, any>) => Promise<any>;
  prescrever: (athleteId: string, dados: Record<string, any>) => Promise<any>;
  limpar: () => void;
}

export function useGestaoAtletas(): GestaoAtletasData {
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<string | null>(null);

  const limpar = useCallback(() => { setError(null); setResultado(null); }, []);

  const convidar = useCallback(async (email: string) => {
    setIsSaving(true); setError(null); setResultado(null);
    try {
      const r = await academies.invite(email);
      // Dois desfechos diferentes, e a tela precisa distingui-los:
      // 'linked' é imediato; 'pending' quer dizer que o atleta ainda
      // não tem conta — e NADA é enviado a ele hoje.
      setResultado(
        r?.status === 'linked'
          ? r.message || 'Atleta vinculado à assessoria.'
          : r?.message || 'Esse e-mail ainda não tem conta no RUSH.',
      );
    } catch (err: any) {
      setError(err?.message || 'Não foi possível convidar');
      throw err;
    } finally { setIsSaving(false); }
  }, []);

  const cadastrar = useCallback(async (dados: Record<string, any>) => {
    setIsSaving(true); setError(null); setResultado(null);
    try {
      const r = await academies.registerAthlete(dados);
      setResultado(r?.message || 'Atleta cadastrado na assessoria.');
    } catch (err: any) {
      setError(err?.message || 'Não foi possível cadastrar');
      throw err;
    } finally { setIsSaving(false); }
  }, []);

  const criarAssessoria = useCallback(async (dados: Record<string, any>) => {
    setIsSaving(true); setError(null); setResultado(null);
    try {
      const r = await academies.create(dados);
      setResultado(`Assessoria "${r?.name || dados.name}" criada.`);
      return r;
    } catch (err: any) {
      setError(err?.message || 'Não foi possível criar a assessoria');
      throw err;
    } finally { setIsSaving(false); }
  }, []);

  const prescrever = useCallback(async (athleteId: string, dados: Record<string, any>) => {
    setIsSaving(true); setError(null); setResultado(null);
    try {
      const r = await academies.prescribe(athleteId, dados);
      setResultado(r?.message || 'Treino prescrito.');
      return r;
    } catch (err: any) {
      setError(err?.message || 'Não foi possível prescrever o treino');
      throw err;
    } finally { setIsSaving(false); }
  }, []);

  return { isSaving, error, resultado, convidar, cadastrar, criarAssessoria, prescrever, limpar };
}
