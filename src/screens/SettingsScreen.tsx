// ============================================================
// RUSH RUNNING — Ajustes e privacidade
// ------------------------------------------------------------
// Três blocos, do mais inofensivo ao mais sensível:
//
//   1. Notificações — o que chega ao aparelho.
//   2. Perfil — o que outro atleta vê quando abre o seu perfil.
//   3. Percurso — a zona que apaga o começo e o fim do traçado.
//
// Cada interruptor salva sozinho, sem botão "salvar": o backend
// aceita alteração parcial, e um formulário com salvar global cria
// o estado ambíguo de "mudei e esqueci de confirmar" justamente
// numa tela onde o esquecimento expõe dado pessoal.
//
// Em troca, o interruptor precisa contar a verdade enquanto salva.
// Ele muda na hora (senão a tela parece travada), mas volta sozinho
// se o servidor recusar — e o erro aparece. Nunca fica mostrando
// "desligado" para algo que continua ligado no banco.
//
// A zona de privacidade é o único bloco com botão de salvar
// explícito: são três campos que só fazem sentido juntos, e gravar
// a cada tecla mandaria coordenada pela metade.
// ============================================================

import React, { useEffect, useState } from 'react';
import type {
  AccountSettingsData,
  PrivacySettings,
  UserSettings,
} from '../hooks/useAccountSettings';
import type { PushData } from '../hooks/usePushNotifications';

interface SettingsScreenProps {
  account: AccountSettingsData;
  /** Estado da inscrição de push deste aparelho. */
  push: PushData;
  onBack: () => void;
  onOpenDeleteAccount: () => void;
}

// ------------------------------------------------------------
// Interruptor
// ------------------------------------------------------------

interface InterruptorProps {
  titulo: string;
  descricao: string;
  ligado: boolean;
  desabilitado?: boolean;
  /** Recusa do servidor devolve o interruptor ao estado anterior. */
  onChange: (valor: boolean) => Promise<void>;
}

const Interruptor: React.FC<InterruptorProps> = ({
  titulo,
  descricao,
  ligado,
  desabilitado = false,
  onChange,
}) => {
  // Espelho local para o toque responder na hora. Ele segue a fonte
  // de verdade sempre que ela muda — inclusive quando o salvamento
  // falha e o hook devolve o valor antigo.
  const [otimista, setOtimista] = useState(ligado);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    setOtimista(ligado);
  }, [ligado]);

  const alternar = async () => {
    if (desabilitado || salvando) return;
    const alvo = !otimista;
    setOtimista(alvo);
    setSalvando(true);
    try {
      await onChange(alvo);
    } catch {
      // O hook já guardou a mensagem; aqui só desfazemos o espelho
      // para a tela não afirmar uma coisa e o banco guardar outra.
      setOtimista(!alvo);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={otimista}
      aria-label={titulo}
      disabled={desabilitado}
      onClick={alternar}
      className={`w-full min-h-[56px] p-3.5 bg-[#101010] border border-[#262626] rounded-xl flex items-center justify-between gap-3 text-left transition-colors ${
        desabilitado ? 'opacity-50 cursor-not-allowed' : 'hover:bg-[#1C1C1C] cursor-pointer'
      }`}
    >
      <span className="flex-1 min-w-0">
        <span className="font-headline text-sm uppercase text-[#F7F5F3] block">{titulo}</span>
        <span className="text-[10px] text-[#A1A1AA] leading-relaxed block mt-0.5">{descricao}</span>
      </span>

      <span
        aria-hidden="true"
        className={`shrink-0 w-11 h-6 rounded-full p-0.5 flex items-center transition-colors ${
          otimista ? 'bg-[#FF5500]' : 'bg-[#3F3F46]'
        }`}
      >
        <span
          className={`w-5 h-5 rounded-full bg-[#F7F5F3] transition-transform ${
            otimista ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  );
};

const Secao: React.FC<{ rotulo: string; titulo: string; children: React.ReactNode }> = ({
  rotulo,
  titulo,
  children,
}) => (
  <div className="space-y-2">
    <div>
      <span className="font-label-sm text-[10px] text-[#A1A1AA] uppercase tracking-widest block">
        {rotulo}
      </span>
      <span className="font-headline text-base text-[#F7F5F3] uppercase">{titulo}</span>
    </div>
    {children}
  </div>
);

// ------------------------------------------------------------

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  account,
  push,
  onBack,
  onOpenDeleteAccount,
}) => {
  const { settings, privacy, zone, zoneUnavailable, zoneLimits, isLoading, error } = account;

  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [raio, setRaio] = useState(500);
  const [rotulo, setRotulo] = useState('');
  const [erroZona, setErroZona] = useState<string | null>(null);
  const [buscandoLocal, setBuscandoLocal] = useState(false);
  const [confirmandoRemocao, setConfirmandoRemocao] = useState(false);

  // Os campos seguem a zona salva. Enquanto não houver uma, ficam
  // vazios: preencher com um ponto qualquer sugeriria uma proteção
  // que não existe.
  useEffect(() => {
    if (zone) {
      setLat(String(zone.lat));
      setLon(String(zone.lon));
      setRaio(zone.radius_m);
      setRotulo(zone.label || '');
    }
  }, [zone]);

  // Fora do JSX de proposito: o extrator de icones le os literais de
  // dentro de um <span> ternario para descobrir o nome do glifo, e uma
  // comparacao ali dentro faria 'ligado' ser tratado como icone.
  const pushInscrito = push.status === 'ligado';

  // Montado fora do JSX: o extrator de ícones lê os literais de dentro
  // de um <span> ternário, e expressões ali dentro viram falsos ícones.
  const estadoDaZona = zoneUnavailable
    ? {
        icone: 'help',
        titulo: 'Não foi possível verificar',
        detalhe:
          'A configuração da zona não pôde ser lida agora. Se você já tinha uma, ela continua valendo no servidor — recarregue para conferir.',
      }
    : zone
      ? {
          icone: 'shield',
          titulo: 'Zona ativa',
          detalhe: `${zone.label ? `${zone.label} — ` : ''}raio de ${zone.radius_m} m. O que cair dentro some das pontas do traçado.`,
        }
      : {
          icone: 'shield_with_heart',
          titulo: 'Nenhuma zona configurada',
          detalhe: 'Seus percursos são publicados inteiros, com o ponto de partida e de chegada.',
        };

  const definirSetting = (campo: keyof UserSettings) => async (valor: boolean) => {
    await account.updateSettings({ [campo]: valor } as Partial<UserSettings>);
  };

  const definirPrivacidade = (campo: keyof PrivacySettings) => async (valor: boolean) => {
    await account.updatePrivacy({ [campo]: valor } as Partial<PrivacySettings>);
  };

  /** Pede a posição ao navegador e preenche os campos. */
  const usarLocalizacaoAtual = () => {
    setErroZona(null);

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setErroZona('Este navegador não informa a localização. Digite as coordenadas abaixo.');
      return;
    }

    setBuscandoLocal(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude.toFixed(6));
        setLon(pos.coords.longitude.toFixed(6));
        setBuscandoLocal(false);
      },
      (err) => {
        setBuscandoLocal(false);
        setErroZona(
          err.code === err.PERMISSION_DENIED
            ? 'Permissão de localização negada. Você pode digitar as coordenadas abaixo.'
            : 'Não foi possível obter sua localização agora. Tente de novo ou digite as coordenadas.',
        );
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const salvarZona = async () => {
    setErroZona(null);

    const latitude = Number(lat);
    const longitude = Number(lon);

    // As mesmas faixas que o backend valida. Conferir aqui é o que
    // transforma "Latitude inválida" num aviso ao lado do campo.
    if (!lat.trim() || !Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      setErroZona('Latitude precisa ser um número entre -90 e 90.');
      return;
    }
    if (!lon.trim() || !Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      setErroZona('Longitude precisa ser um número entre -180 e 180.');
      return;
    }
    if (raio < zoneLimits.min_radius_m || raio > zoneLimits.max_radius_m) {
      setErroZona(
        `O raio precisa ficar entre ${zoneLimits.min_radius_m} e ${zoneLimits.max_radius_m} metros.`,
      );
      return;
    }

    try {
      await account.saveZone({
        lat: latitude,
        lon: longitude,
        radius_m: raio,
        label: rotulo.trim() || null,
      });
    } catch {
      // account.error já mostra o motivo.
    }
  };

  const removerZona = async () => {
    try {
      await account.removeZone();
      setLat('');
      setLon('');
      setRaio(500);
      setRotulo('');
      setConfirmandoRemocao(false);
    } catch {
      /* account.error já mostra o motivo. */
    }
  };

  if (isLoading && !settings && !privacy) {
    return (
      <div className="flex flex-col w-full max-w-2xl mx-auto px-4 sm:px-5 pt-2 pb-8">
        <div className="h-24 rounded-2xl bg-[#1C1C1C] border border-[#262626] animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex flex-col w-full max-w-2xl mx-auto px-4 sm:px-5 space-y-5 pt-2 pb-8">
      {/* Cabeçalho */}
      <div className="border-b border-[#262626] pb-3">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-[#A1A1AA] hover:text-[#F7F5F3] transition-colors cursor-pointer mb-2"
        >
          <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          <span className="text-xs uppercase tracking-wider">Perfil</span>
        </button>
        <h1 className="font-headline-md text-[#F7F5F3] uppercase tracking-tight">
          Ajustes e privacidade
        </h1>
        <p className="text-xs text-[#737373] leading-relaxed mt-1">
          Cada mudança é salva na hora. O que você desligar aqui deixa de aparecer para os outros
          atletas imediatamente.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="bg-[#1C1C1C] border border-[#EF4444] rounded-xl p-3 flex items-start gap-2"
        >
          <span className="material-symbols-outlined text-[#EF4444] text-[18px]">error</span>
          <span className="text-xs text-[#F7F5F3] leading-relaxed">{error}</span>
        </div>
      )}

      {/* ---------- Notificações ---------- */}
      <Secao rotulo="Aparelho" titulo="Notificações">
        {settings ? (
          <>
            <Interruptor
              titulo="Receber notificações"
              descricao="Chave geral. Desligada, nenhuma notificação sai — nem por e-mail, nem no aparelho."
              ligado={settings.notifications_enabled}
              onChange={definirSetting('notifications_enabled')}
            />
            <Interruptor
              titulo="Push neste aparelho"
              descricao="Curtidas, comentários, novos seguidores e conquistas aparecem como aviso do sistema."
              ligado={settings.push_notifications}
              desabilitado={!settings.notifications_enabled}
              onChange={definirSetting('push_notifications')}
            />
            <Interruptor
              titulo="E-mail"
              descricao="Resumos e avisos importantes no endereço cadastrado."
              ligado={settings.email_notifications}
              desabilitado={!settings.notifications_enabled}
              onChange={definirSetting('email_notifications')}
            />

            {/* A preferência acima vale para a conta. A inscrição do
                navegador é outra coisa, e vive neste aparelho: sem ela o
                push não chega mesmo com a preferência ligada.

                O hook distingue as três portas que podem estar fechadas,
                e cada uma pede uma frase diferente — dizer só "não foi
                possível" deixaria a pessoa sem saber o que fazer. */}
            {settings.push_notifications && settings.notifications_enabled && (
              <div className="bg-[#101010] border border-[#262626] rounded-xl p-3.5 space-y-2">
                <p className="text-[10px] text-[#A1A1AA] leading-relaxed">
                  A preferência acima vale para a sua conta. Para o aviso chegar{' '}
                  <strong className="text-[#F7F5F3]">neste aparelho</strong>, ele também precisa
                  estar inscrito aqui.
                </p>

                {push.status === 'verificando' && (
                  <p className="text-[10px] text-[#737373]">Verificando este aparelho…</p>
                )}

                {push.status === 'sem_suporte' && (
                  <p className="text-[10px] text-[#A1A1AA] leading-relaxed">
                    Este navegador não suporta notificações push. Suas notificações continuam
                    aparecendo na central do app.
                  </p>
                )}

                {push.status === 'servidor_sem_chaves' && (
                  <p className="text-[10px] text-[#A1A1AA] leading-relaxed">
                    O push ainda não está configurado no servidor. Nada a fazer deste lado — suas
                    notificações continuam chegando na central do app.
                  </p>
                )}

                {push.status === 'bloqueado' && (
                  <p className="text-[10px] text-[#EF4444] leading-relaxed">
                    Você negou a permissão de notificações para este site. Só dá para reverter nas
                    configurações do navegador — um botão aqui não consegue pedir de novo.
                  </p>
                )}

                {(push.status === 'desligado' || pushInscrito) && (
                  <button
                    type="button"
                    onClick={() => (pushInscrito ? push.disable() : push.enable())}
                    disabled={push.isBusy}
                    className="w-full min-h-[44px] bg-[#1C1C1C] hover:bg-[#262626] border border-[#262626] rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <span className="material-symbols-outlined text-[#FF5500] text-[18px]">
                      {pushInscrito ? 'notifications_off' : 'notifications_active'}
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider text-[#F7F5F3]">
                      {push.isBusy
                        ? 'Aguarde…'
                        : pushInscrito
                          ? 'Parar neste aparelho'
                          : 'Inscrever este aparelho'}
                    </span>
                  </button>
                )}

                {pushInscrito && (
                  <button
                    type="button"
                    onClick={() => push.sendTest()}
                    disabled={push.isBusy}
                    className="w-full min-h-[40px] bg-transparent hover:bg-[#1C1C1C] border border-[#262626] rounded-lg text-[11px] uppercase tracking-wider text-[#A1A1AA] cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Enviar notificação de teste
                  </button>
                )}

                {push.testMessage && (
                  <p className="text-[10px] text-[#22C55E] leading-relaxed">{push.testMessage}</p>
                )}

                {push.error && (
                  <p className="text-[10px] text-[#EF4444] leading-relaxed">{push.error}</p>
                )}
              </div>
            )}

          </>
        ) : (
          <p className="text-xs text-[#737373]">Não foi possível carregar suas preferências.</p>
        )}
      </Secao>

      {/* ---------- Perfil ---------- */}
      <Secao rotulo="Quem te vê" titulo="Perfil público">
        {privacy ? (
          <>
            <Interruptor
              titulo="Atividades públicas"
              descricao="Suas corridas aparecem no feed e no seu perfil para outros atletas."
              ligado={privacy.public_activities}
              onChange={definirPrivacidade('public_activities')}
            />
            <Interruptor
              titulo="Mostrar status de VFC"
              descricao="Sua prontidão do dia fica visível no perfil. O valor de RMSSD em si nunca é publicado."
              ligado={privacy.show_hrv_status}
              onChange={definirPrivacidade('show_hrv_status')}
            />
            <Interruptor
              titulo="Mostrar VO₂ máx."
              descricao="Sua estimativa de VO₂ máximo aparece no perfil."
              ligado={privacy.show_vo2max}
              onChange={definirPrivacidade('show_vo2max')}
            />
            <Interruptor
              titulo="Mostrar conquistas"
              descricao="Medalhas e recordes pessoais ficam visíveis para quem abre seu perfil."
              ligado={privacy.show_achievements}
              onChange={definirPrivacidade('show_achievements')}
            />
          </>
        ) : (
          <p className="text-xs text-[#737373]">
            Não foi possível carregar suas configurações de privacidade.
          </p>
        )}
      </Secao>

      {/* ---------- Zona de privacidade ---------- */}
      <Secao rotulo="Onde você mora" titulo="Zona de privacidade">
        <div className="bg-[#1C1C1C] rounded-2xl border border-[#262626] p-4 space-y-3.5">
          <p className="text-xs text-[#A1A1AA] leading-relaxed">
            Um percurso publicado começa e termina onde você mora. A zona apaga o começo e o fim do
            traçado antes de ele sair para outra pessoa — você continua vendo a sua corrida inteira.
          </p>

          {/* Três estados, e não dois. Quando a leitura da zona falha,
              `zone` é null — mas isso significa "não sei", e não "não
              existe". Dizer a alguém que o percurso dela é publicado
              inteiro quando a zona pode estar ativa é uma afirmação
              falsa sobre a privacidade dela, e a errada para arriscar. */}
          <div
            className={`rounded-xl p-3 border bg-[#101010] ${
              zoneUnavailable
                ? 'border-[#F59E0B]'
                : zone
                  ? 'border-[#22C55E]'
                  : 'border-[#EF4444]'
            }`}
          >
            <div className="flex items-start gap-2">
              <span
                className={`material-symbols-outlined text-[18px] ${
                  zoneUnavailable
                    ? 'text-[#F59E0B]'
                    : zone
                      ? 'text-[#22C55E]'
                      : 'text-[#EF4444]'
                }`}
              >
                {estadoDaZona.icone}
              </span>
              <div className="flex-1 min-w-0">
                <span className="text-xs font-bold text-[#F7F5F3] block">
                  {estadoDaZona.titulo}
                </span>
                <span className="text-[10px] text-[#A1A1AA] leading-relaxed block mt-0.5">
                  {estadoDaZona.detalhe}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={usarLocalizacaoAtual}
            disabled={buscandoLocal}
            className="w-full min-h-[44px] bg-[#101010] hover:bg-[#262626] border border-[#262626] rounded-lg flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[#FF5500] text-[18px]">my_location</span>
            <span className="text-xs font-bold uppercase tracking-wider text-[#F7F5F3]">
              {buscandoLocal ? 'Localizando…' : 'Usar minha localização atual'}
            </span>
          </button>

          <div className="grid grid-cols-2 gap-2.5">
            <label className="block">
              <span className="text-[10px] text-[#A1A1AA] uppercase tracking-widest block mb-1">
                Latitude
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="-23.550500"
                className="w-full min-h-[44px] bg-[#101010] border border-[#262626] rounded-lg px-3 text-sm text-[#F7F5F3] placeholder:text-[#525252] focus:border-[#FF5500] focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="text-[10px] text-[#A1A1AA] uppercase tracking-widest block mb-1">
                Longitude
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={lon}
                onChange={(e) => setLon(e.target.value)}
                placeholder="-46.633300"
                className="w-full min-h-[44px] bg-[#101010] border border-[#262626] rounded-lg px-3 text-sm text-[#F7F5F3] placeholder:text-[#525252] focus:border-[#FF5500] focus:outline-none"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-[10px] text-[#A1A1AA] uppercase tracking-widest block mb-1">
              Apelido (opcional)
            </span>
            <input
              type="text"
              value={rotulo}
              maxLength={60}
              onChange={(e) => setRotulo(e.target.value)}
              placeholder="Casa"
              className="w-full min-h-[44px] bg-[#101010] border border-[#262626] rounded-lg px-3 text-sm text-[#F7F5F3] placeholder:text-[#525252] focus:border-[#FF5500] focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="text-[10px] text-[#A1A1AA] uppercase tracking-widest block mb-1">
              Raio — <span className="text-[#FF5500] font-bold">{raio} m</span>
            </span>
            <input
              type="range"
              min={zoneLimits.min_radius_m}
              max={zoneLimits.max_radius_m}
              step={50}
              value={raio}
              onChange={(e) => setRaio(Number(e.target.value))}
              aria-label="Raio da zona de privacidade em metros"
              className="w-full accent-[#FF5500] cursor-pointer"
            />
            <span className="text-[10px] text-[#737373] leading-relaxed block mt-1">
              Quanto maior o raio, mais do percurso some — e mais difícil fica deduzir de onde você
              saiu. Entre {zoneLimits.min_radius_m} e {zoneLimits.max_radius_m} metros.
            </span>
          </label>

          {erroZona && (
            <p role="alert" className="text-[10px] text-[#EF4444] leading-relaxed">
              {erroZona}
            </p>
          )}

          <button
            type="button"
            onClick={salvarZona}
            disabled={account.isSaving}
            className="w-full min-h-[52px] bg-[#FF5500] hover:bg-[#FF6A1F] rounded-xl flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[#0D0D0D] text-[20px]">shield</span>
            <span className="text-xs font-bold uppercase tracking-wider text-[#0D0D0D]">
              {account.isSaving ? 'Salvando…' : zone ? 'Atualizar zona' : 'Ativar zona'}
            </span>
          </button>

          {zone &&
            (confirmandoRemocao ? (
              <div className="bg-[#101010] border border-[#EF4444] rounded-xl p-3 space-y-2.5">
                <p className="text-[10px] text-[#F7F5F3] leading-relaxed">
                  Sem a zona, seus percursos voltam a ser publicados inteiros — incluindo o ponto de
                  onde você sai e onde chega. Isso vale também para as corridas já publicadas.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmandoRemocao(false)}
                    className="min-h-[44px] bg-[#1C1C1C] hover:bg-[#262626] border border-[#262626] rounded-lg text-xs font-bold uppercase tracking-wider text-[#F7F5F3] cursor-pointer transition-colors"
                  >
                    Manter
                  </button>
                  <button
                    type="button"
                    onClick={removerZona}
                    disabled={account.isSaving}
                    className="min-h-[44px] bg-[#EF4444] hover:bg-[#DC2626] rounded-lg text-xs font-bold uppercase tracking-wider text-[#F7F5F3] cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Remover
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmandoRemocao(true)}
                className="w-full min-h-[44px] bg-transparent hover:bg-[#101010] border border-[#262626] rounded-lg text-xs uppercase tracking-wider text-[#A1A1AA] cursor-pointer transition-colors"
              >
                Remover zona
              </button>
            ))}
        </div>
      </Secao>

      {/* ---------- Conta ---------- */}
      <Secao rotulo="Conta" titulo="Sair da plataforma">
        <button
          type="button"
          onClick={onOpenDeleteAccount}
          className="w-full min-h-[56px] p-3.5 bg-[#101010] hover:bg-[#1C1C1C] border border-[#262626] rounded-xl flex items-center justify-between gap-3 text-left cursor-pointer transition-colors"
        >
          <span className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[#EF4444] text-[24px]">
              delete_forever
            </span>
            <span>
              <span className="font-headline text-sm uppercase text-[#F7F5F3] block">
                Excluir conta
              </span>
              <span className="text-[10px] text-[#A1A1AA] block">
                Encerra a conta e tira seus dados do ar. Não há como desfazer.
              </span>
            </span>
          </span>
          <span className="material-symbols-outlined text-[#A1A1AA] text-[18px]">chevron_right</span>
        </button>
      </Secao>

      {/* ---------- Documentos ---------- */}
      {/* Abrem em aba nova de proposito: sao paginas publicas, com
          URL propria, e e essa URL que vai para as lojas. Navegar
          por dentro tiraria a pessoa do app no meio dos ajustes. */}
      <Secao rotulo="Documentos" titulo="Privacidade e termos">
        <div className="grid grid-cols-2 gap-2.5">
          {[
            { href: '/privacidade', icone: 'shield_person', rotulo: 'Política de privacidade' },
            { href: '/termos', icone: 'gavel', rotulo: 'Termos de uso' },
          ].map((doc) => (
            <a
              key={doc.href}
              href={doc.href}
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[56px] p-3.5 bg-[#101010] hover:bg-[#1C1C1C] border border-[#262626] rounded-xl flex items-center gap-2.5 cursor-pointer transition-colors"
            >
              <span className="material-symbols-outlined text-[#FF5500] text-[22px]">{doc.icone}</span>
              <span className="font-headline text-[11px] uppercase text-[#F7F5F3] leading-tight">
                {doc.rotulo}
              </span>
            </a>
          ))}
        </div>
      </Secao>
    </div>
  );
};
