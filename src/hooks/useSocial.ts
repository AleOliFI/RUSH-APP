// ============================================================
// RUSH RUNNING — Busca de atletas, seguir e perfil público
// ------------------------------------------------------------
// A aba "Seguindo" do feed depende disto: sem busca e sem seguir,
// ela nunca tem o que mostrar.
//
// A busca é disparada pelo chamador (não há debounce embutido):
// a tela decide quando chamar, mas o hook recusa termos com menos
// de 2 caracteres, que o backend rejeita com 400.
// ============================================================

import { useCallback, useEffect, useState } from 'react';
import { social } from '../api';

/** Mínimo aceito por GET /api/social/search. */
export const MIN_SEARCH_LENGTH = 2;
/** Teto de resultados devolvido pelo backend. */
export const SEARCH_RESULT_LIMIT = 20;

export interface AthleteSummary {
  user_id: string;
  name: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  is_following: boolean;
}

/** Melhor marca em uma distância oficial, normalizada pelo pace médio. */
export interface AthleteRecord {
  activity_id: string;
  title: string | null;
  date: string;
  distance_km: number;
  duration_seconds: number;
  formatted: string;
  avg_pace: string | null;
}

export const RECORD_DISTANCES = [
  { key: '5k', label: '5 km' },
  { key: '10k', label: '10 km' },
  { key: '21k', label: '21 km' },
  { key: '42k', label: '42 km' },
] as const;

export interface PublicAthleteProfile extends AthleteSummary {
  is_self: boolean;
  instagram?: string | null;
  strava?: string | null;
  created_at?: string | null;
  stats: {
    followers: number;
    following: number;
    activities: number;
    total_km: number;
  };
  /** Até 6 atividades públicas. Privadas e de seguidores não vêm. */
  recent_activities: any[];
  /**
   * Null quando o atleta escondeu conquistas ou atividades; um objeto com
   * valores null significa que ele simplesmente ainda não tem a marca.
   */
  records: Record<string, AthleteRecord | null> | null;
  /** Só vem quando o atleta deixa o VO₂máx visível. */
  vo2max: { value: number; date: string } | null;
  privacy: { activities_hidden: boolean; records_hidden: boolean };
}

export interface SocialData {
  results: AthleteSummary[];
  /** Null enquanto nenhuma busca foi feita; distingue "nada buscado" de "nada encontrado". */
  hasSearched: boolean;
  followers: AthleteSummary[];
  following: AthleteSummary[];
  isSearching: boolean;
  isLoadingLists: boolean;
  error: string | null;
  search: (term: string) => Promise<void>;
  clearSearch: () => void;
  toggleFollow: (userId: string) => Promise<void>;
  loadLists: () => Promise<void>;
  getProfile: (userId: string) => Promise<PublicAthleteProfile>;
}

export function useSocial(): SocialData {
  const [results, setResults] = useState<AthleteSummary[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [followers, setFollowers] = useState<AthleteSummary[]>([]);
  const [following, setFollowing] = useState<AthleteSummary[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingLists, setIsLoadingLists] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (term: string) => {
    const clean = term.trim();
    if (clean.length < MIN_SEARCH_LENGTH) {
      setResults([]);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setError(null);
    try {
      const res = await social.search(encodeURIComponent(clean));
      setResults(res?.users || []);
      setHasSearched(true);
    } catch (err: any) {
      setError(err?.message || 'Erro na busca de atletas');
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const clearSearch = useCallback(() => {
    setResults([]);
    setHasSearched(false);
    setError(null);
  }, []);

  const loadLists = useCallback(async () => {
    setIsLoadingLists(true);
    setError(null);
    try {
      const [followersRes, followingRes] = await Promise.all([
        social.followers(),
        social.following(),
      ]);

      // Estes dois endpoints não devolvem is_following. Quem está em
      // "seguindo" é seguido por definição; para os seguidores, o vínculo
      // de volta é deduzido cruzando as duas listas — assim o botão de
      // cada ficha nasce no estado certo sem uma chamada por atleta.
      const followingList: AthleteSummary[] = (followingRes?.following || []).map((u: any) => ({
        ...u,
        is_following: true,
      }));
      const followingIds = new Set(followingList.map((u) => u.user_id));
      const followersList: AthleteSummary[] = (followersRes?.followers || []).map((u: any) => ({
        ...u,
        is_following: followingIds.has(u.user_id),
      }));

      setFollowers(followersList);
      setFollowing(followingList);
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar seguidores');
    } finally {
      setIsLoadingLists(false);
    }
  }, []);

  /** Alterna seguir/deixar de seguir, refletindo em todas as listas abertas. */
  const toggleFollow = useCallback(
    async (userId: string) => {
      const known =
        results.find((u) => u.user_id === userId) ||
        followers.find((u) => u.user_id === userId) ||
        following.find((u) => u.user_id === userId);
      const wasFollowing = !!known?.is_following;

      const apply = (value: boolean) => {
        const patch = (list: AthleteSummary[]) =>
          list.map((u) => (u.user_id === userId ? { ...u, is_following: value } : u));
        setResults(patch);
        setFollowers(patch);

        // A lista "Seguindo" é a própria relação, não só um botão: quem
        // acabou de ser seguido pela busca precisa entrar nela, e quem
        // deixou de ser seguido precisa sair. Sem isto a aba só acerta
        // depois de um recarregamento.
        setFollowing((lista) => {
          if (!value) return lista.filter((u) => u.user_id !== userId);
          if (lista.some((u) => u.user_id === userId)) return patch(lista);
          return known ? [{ ...known, is_following: true }, ...lista] : lista;
        });
      };

      apply(!wasFollowing);

      try {
        if (wasFollowing) {
          await social.unfollow(userId);
        } else {
          await social.follow(userId);
        }
      } catch (err: any) {
        apply(wasFollowing);
        setError(err?.message || 'Não foi possível atualizar o vínculo');
        throw err;
      }
    },
    [results, followers, following],
  );

  const getProfile = useCallback(async (userId: string): Promise<PublicAthleteProfile> => {
    const res = await social.userProfile(userId);
    return res.profile;
  }, []);

  return {
    results,
    hasSearched,
    followers,
    following,
    isSearching,
    isLoadingLists,
    error,
    search,
    clearSearch,
    toggleFollow,
    loadLists,
    getProfile,
  };
}

/** Carrega um perfil público isolado, para a tela de atleta. */
export function usePublicProfile(userId: string | null) {
  const [profile, setProfile] = useState<PublicAthleteProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await social.userProfile(userId);
      setProfile(res.profile);
    } catch (err: any) {
      setError(err?.message || 'Erro ao carregar o perfil do atleta');
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const toggleFollow = useCallback(async () => {
    if (!profile) return;
    const wasFollowing = profile.is_following;

    setProfile({
      ...profile,
      is_following: !wasFollowing,
      stats: {
        ...profile.stats,
        followers: Math.max(0, profile.stats.followers + (wasFollowing ? -1 : 1)),
      },
    });

    try {
      if (wasFollowing) {
        await social.unfollow(profile.user_id);
      } else {
        await social.follow(profile.user_id);
      }
    } catch (err: any) {
      setProfile(profile);
      setError(err?.message || 'Não foi possível atualizar o vínculo');
    }
  }, [profile]);

  return { profile, isLoading, error, reload, toggleFollow };
}
