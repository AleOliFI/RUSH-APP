// ============================================================
// RUSH RUNNING — Buscar atletas
// ------------------------------------------------------------
// Sem esta tela a aba "Seguindo" do feed nasce vazia e não há
// como enchê-la: seguir alguém só é possível encontrando a pessoa.
//
// O desenho trazia "Sugestões para você" e "Da sua agenda". Os dois
// blocos não foram construídos: recomendar atletas exige um
// algoritmo que não existe no backend, e o navegador não lê os
// contatos do telefone. Em vez de uma lista falsa, a tela oferece a
// busca por nome e as duas listas reais — seguidores e seguindo.
// ============================================================

import React, { useEffect, useRef, useState } from 'react';
import { Avatar } from '../components/rush/Avatar';
import { MIN_SEARCH_LENGTH } from '../hooks/useSocial';
import type { AthleteSummary, SocialData } from '../hooks/useSocial';

type SearchTab = 'buscar' | 'seguidores' | 'seguindo';

interface AthleteSearchScreenProps {
  social: SocialData;
  onOpenAthlete: (userId: string) => void;
  onBack: () => void;
}

const ABAS: { id: SearchTab; label: string }[] = [
  { id: 'buscar', label: 'Buscar' },
  { id: 'seguidores', label: 'Seguidores' },
  { id: 'seguindo', label: 'Seguindo' },
];

/** Espera o atleta parar de digitar antes de consultar o servidor. */
const DEBOUNCE_MS = 350;

/** Ficha de atleta: abre o perfil no corpo, segue pelo botão. */
const AthleteRow: React.FC<{
  athlete: AthleteSummary;
  onOpen: () => void;
  onToggleFollow: () => void;
  isBusy: boolean;
}> = ({ athlete, onOpen, onToggleFollow, isBusy }) => (
  <div className="bg-[#1C1C1C] rounded-2xl border border-[#262626] p-3 flex items-center gap-3">
    <button
      type="button"
      onClick={onOpen}
      className="flex items-center gap-3 flex-1 min-w-0 text-left cursor-pointer"
    >
      <Avatar
        src={athlete.avatar_url}
        name={athlete.name}
        className="w-11 h-11 rounded-full object-cover shrink-0"
        initialsClassName="text-sm"
      />
      <span className="min-w-0 flex-1">
        <span className="font-headline text-sm uppercase text-[#F7F5F3] block truncate leading-tight">
          {athlete.name}
        </span>
        <span className="text-[11px] text-[#737373] block truncate">
          @{athlete.username}
          {athlete.location ? ` • ${athlete.location}` : ''}
        </span>
      </span>
    </button>

    {/* O aria-label carrega o nome: sem ele o leitor de tela anuncia
        uma fila de botões "Seguir" indistinguíveis entre si. */}
    <button
      type="button"
      onClick={onToggleFollow}
      disabled={isBusy}
      aria-pressed={athlete.is_following}
      aria-label={`${athlete.is_following ? 'Deixar de seguir' : 'Seguir'} ${athlete.name}`}
      className={`min-h-[40px] px-3.5 rounded-xl text-[11px] font-headline uppercase tracking-wider shrink-0 cursor-pointer transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${
        athlete.is_following
          ? 'bg-[#101010] border border-[#262626] text-[#A1A1AA] hover:text-[#F7F5F3]'
          : 'bg-[#FF5500] hover:bg-[#FF6B00] text-[#0D0D0D]'
      }`}
    >
      {athlete.is_following ? 'Seguindo' : 'Seguir'}
    </button>
  </div>
);

const EmptyState: React.FC<{ icone: string; titulo: string; texto: string }> = ({
  icone,
  titulo,
  texto,
}) => (
  <div className="bg-[#1C1C1C] rounded-2xl border border-[#262626] p-6 text-center space-y-1.5">
    <span className="material-symbols-outlined text-[#525252] text-[28px]">{icone}</span>
    <span className="font-headline text-sm uppercase text-[#F7F5F3] block">{titulo}</span>
    <span className="text-xs text-[#737373] leading-relaxed block">{texto}</span>
  </div>
);

export const AthleteSearchScreen: React.FC<AthleteSearchScreenProps> = ({
  social,
  onOpenAthlete,
  onBack,
}) => {
  const [aba, setAba] = useState<SearchTab>('buscar');
  const [termo, setTermo] = useState('');
  const [seguindoAgora, setSeguindoAgora] = useState<string | null>(null);
  const { search, clearSearch, loadLists } = social;

  // As duas listas são carregadas uma vez ao abrir; seguir/deixar de
  // seguir já atualiza o estado local, então não precisa recarregar.
  useEffect(() => {
    loadLists();
  }, [loadLists]);

  const termoLimpo = termo.trim();
  const curtoDemais = termoLimpo.length > 0 && termoLimpo.length < MIN_SEARCH_LENGTH;

  // Cada tecla reinicia o relógio: a busca sai só quando a digitação para.
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (termoLimpo.length < MIN_SEARCH_LENGTH) {
      clearSearch();
      return;
    }
    timerRef.current = setTimeout(() => search(termoLimpo), DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [termoLimpo, search, clearSearch]);

  const alternarSeguir = async (userId: string) => {
    setSeguindoAgora(userId);
    try {
      await social.toggleFollow(userId);
    } catch {
      // O hook já guarda a mensagem e desfaz o estado otimista.
    } finally {
      setSeguindoAgora(null);
    }
  };

  const listaDaAba: AthleteSummary[] =
    aba === 'buscar' ? social.results : aba === 'seguidores' ? social.followers : social.following;

  const carregando = aba === 'buscar' ? social.isSearching : social.isLoadingLists;

  const renderLista = () => {
    if (carregando) {
      return (
        <div className="bg-[#1C1C1C] rounded-2xl border border-[#262626] p-6 text-center">
          <span className="font-telemetry text-xs text-[#737373] uppercase tracking-widest animate-pulse">
            Carregando…
          </span>
        </div>
      );
    }

    if (listaDaAba.length > 0) {
      return (
        <div className="space-y-2">
          {listaDaAba.map((atleta) => (
            <AthleteRow
              key={atleta.user_id}
              athlete={atleta}
              onOpen={() => onOpenAthlete(atleta.user_id)}
              onToggleFollow={() => alternarSeguir(atleta.user_id)}
              isBusy={seguindoAgora === atleta.user_id}
            />
          ))}
        </div>
      );
    }

    if (aba === 'seguidores') {
      return (
        <EmptyState
          icone="group"
          titulo="Ninguém te segue ainda"
          texto="Publique suas corridas no feed: é assim que outros atletas encontram seu perfil."
        />
      );
    }

    if (aba === 'seguindo') {
      return (
        <EmptyState
          icone="person_add"
          titulo="Você ainda não segue ninguém"
          texto="Busque por nome ou @ na aba ao lado para começar a montar seu feed."
        />
      );
    }

    if (social.hasSearched) {
      return (
        <EmptyState
          icone="search_off"
          titulo="Nenhum atleta encontrado"
          texto={`Nada bate com "${termoLimpo}". Tente o nome completo ou o @ exato.`}
        />
      );
    }

    return (
      <EmptyState
        icone="search"
        titulo="Busque por nome ou @"
        texto={`Digite pelo menos ${MIN_SEARCH_LENGTH} letras do nome ou do usuário do atleta.`}
      />
    );
  };

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto px-4 sm:px-5 space-y-4 pt-2 pb-8">
      {/* Cabeçalho */}
      <div className="flex items-center gap-2 border-b border-[#262626] pb-3">
        <button
          type="button"
          onClick={onBack}
          aria-label="Voltar ao feed"
          className="w-10 h-10 rounded-xl bg-[#1C1C1C] border border-[#262626] flex items-center justify-center text-[#F7F5F3] shrink-0 cursor-pointer hover:bg-[#262626] transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <div className="min-w-0">
          <span className="font-label-caps text-[10px] text-[#FF5500] uppercase tracking-widest font-extrabold block">
            Comunidade
          </span>
          <h1 className="font-headline-md text-[#F7F5F3] uppercase tracking-tight leading-none">
            Atletas
          </h1>
        </div>
      </div>

      {/* Campo de busca */}
      <div className="relative">
        <span className="material-symbols-outlined text-[#737373] text-[20px] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
          search
        </span>
        <input
          type="search"
          value={termo}
          onChange={(e) => {
            setTermo(e.target.value);
            if (aba !== 'buscar') setAba('buscar');
          }}
          placeholder="Nome ou @usuario"
          aria-label="Buscar atletas por nome ou usuário"
          // O "✕" nativo do type=search duplicaria o botão de limpar ao lado.
          className="w-full h-14 bg-[#1C1C1C] border border-[#262626] rounded-2xl pl-11 pr-11 text-sm text-[#F7F5F3] placeholder:text-[#525252] focus:border-[#FF5500] focus:outline-none [&::-webkit-search-cancel-button]:appearance-none"
        />
        {termo.length > 0 && (
          <button
            type="button"
            onClick={() => setTermo('')}
            aria-label="Limpar busca"
            className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center text-[#737373] hover:text-[#F7F5F3] cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        )}
      </div>

      {curtoDemais && (
        <span className="text-[11px] text-[#737373] block -mt-2">
          Digite pelo menos {MIN_SEARCH_LENGTH} letras.
        </span>
      )}

      {/* Abas */}
      <div className="flex items-center gap-2" role="tablist" aria-label="Listas de atletas">
        {ABAS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setAba(item.id)}
            role="tab"
            aria-selected={aba === item.id}
            className={`min-h-[44px] py-1.5 px-3.5 rounded-full text-xs font-bold uppercase transition-all cursor-pointer ${
              aba === item.id
                ? 'bg-[#FF5500] text-[#0D0D0D] shadow-md'
                : 'bg-[#1C1C1C] text-[#A1A1AA] hover:text-[#F7F5F3]'
            }`}
          >
            {item.label}
            {item.id === 'seguidores' && social.followers.length > 0 && ` (${social.followers.length})`}
            {item.id === 'seguindo' && social.following.length > 0 && ` (${social.following.length})`}
          </button>
        ))}
      </div>

      {social.error && (
        <div role="alert" className="bg-[#EF4444]/12 border border-[#EF4444]/40 rounded-xl px-4 py-3">
          <span className="text-xs text-[#e5e2e1]">{social.error}</span>
        </div>
      )}

      {renderLista()}
    </div>
  );
};
