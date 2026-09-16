// ============================================================
// RUSH RUNNING — Shell autenticado (6 abas)
// Header + conteúdo + BottomNav + todos os modais globais.
// As abas são rotas reais, então o botão "voltar" do navegador
// e os links profundos continuam funcionando.
// ============================================================

import React, { useCallback, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { TabType, ImageViewerItem } from './types';
import { Header } from './components/rush/Header';
import { BottomNav } from './components/rush/BottomNav';
import { HomeScreen } from './screens/HomeScreen';
import { MeasurementScreen } from './screens/MeasurementScreen';
import { WorkoutsScreen } from './screens/WorkoutsScreen';
import { ProScreen } from './screens/ProScreen';
import { FeedScreen } from './screens/FeedScreen';
import { ProfileScreen } from './screens/ProfileScreen';
import { WorkoutDetailModal } from './components/rush/WorkoutDetailModal';
import { AthleteModal } from './components/rush/AthleteModal';
import { ImageViewerModal } from './components/rush/ImageViewerModal';
import { RouteMapModal } from './components/rush/RouteMapModal';
import { HistoryScreen } from './screens/HistoryScreen';
import { CycleScreen } from './screens/CycleScreen';
import { DeleteAccountScreen } from './screens/DeleteAccountScreen';
import { ActivityDetailScreen } from './screens/ActivityDetailScreen';
import { AthleteSearchScreen } from './screens/AthleteSearchScreen';
import { NotificationsScreen } from './screens/NotificationsScreen';
import { PublicProfileScreen } from './screens/PublicProfileScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { FullPlanScreen } from './screens/FullPlanScreen';
import { HrZonesScreen } from './screens/HrZonesScreen';
import { CoachDashboardScreen } from './screens/CoachDashboardScreen';
import { CoachAthleteScreen } from './screens/CoachAthleteScreen';
import { CoachAthletesScreen } from './screens/CoachAthletesScreen';
import { CoachPrescribeScreen } from './screens/CoachPrescribeScreen';
import { usePainelAssessoria, useFichaAtleta, useGestaoAtletas } from './hooks/useAssessoria';
import { useActivityDetail } from './hooks/useActivityDetail';
import { useSocial, usePublicProfile } from './hooks/useSocial';
import { useNotifications } from './hooks/useNotifications';
import { usePushNotifications } from './hooks/usePushNotifications';
import { useAccountSettings } from './hooks/useAccountSettings';
import { useCycle } from './hooks/useCycle';
import { useActivityHistory } from './hooks/useActivityHistory';
import { useHrZones, usePlanoCompleto } from './hooks/useTrainingReference';
import { DownloadToast } from './components/rush/DownloadToast';
import { BleHardwareModal } from './components/rush/BleHardwareModal';
import { ShoeRetirementModal } from './components/rush/ShoeRetirementModal';
import { GearGarageModal } from './components/rush/GearGarageModal';
import { StoryExporterModal } from './components/rush/StoryExporterModal';
import { WorkoutSummaryModal } from './components/rush/WorkoutSummaryModal';
import { ActiveRunModal } from './components/rush/ActiveRunModal';
import { FieldProtocolModal } from './components/rush/FieldProtocolModal';
import { ActivityCommentsModal } from './components/rush/ActivityCommentsModal';
import { NewPostModal } from './components/rush/NewPostModal';
import { ProCheckoutModal } from './components/rush/ProCheckoutModal';
import { ProSuccessModal } from './components/rush/ProSuccessModal';
import { useRushData } from './hooks/useRushData';
import type { RunSummary } from './hooks/useRunTracker';
import { parseCustomZonePaces } from './data/adapters';
import { activitiesToCsv, downloadCsv } from './utils/exportCsv';

/** Mapeamento bidirecional entre as abas do design e as rotas do app. */
const TAB_TO_PATH: Record<TabType, string> = {
  inicio: '/',
  medicao: '/medicao',
  treinos: '/treinos',
  feed: '/feed',
  'premium-pro': '/pro',
  perfil: '/perfil',
};

const PATH_TO_TAB: Record<string, TabType> = Object.fromEntries(
  (Object.entries(TAB_TO_PATH) as [TabType, string][]).map(([tab, path]) => [path, tab]),
) as Record<string, TabType>;

export default function RushShell({ onLogout }: { onLogout: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();

  const currentTab: TabType = PATH_TO_TAB[location.pathname] || 'inicio';

  const goToTab = useCallback(
    (tab: TabType) => {
      navigate(TAB_TO_PATH[tab]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [navigate],
  );

  const {
    athlete,
    readiness,
    todayWorkout,
    weeklySchedule,
    weeklySummary,
    upcomingSessions,
    currentWeek,
    planRaw,
    feedPosts,
    feedChannel,
    setFeedChannel,
    isLoadingFeed,
    toggleKudo,
    activeChallenge,
    joinChallenge,
    trainingLoad,
    hrvHistory,
    vo2maxRaw,
    devices,
    subscription,
    recentActivitiesRaw,
    achievements,
    shoes,
    shoesSummary,
    reloadGear,
    reloadDevices,
    hrvStatusRaw,
    fatigueAlert,
    profileRaw,
    recordsRaw,
    meRaw,
    isLoading,
    error,
    submitMeasurement,
    finishRun,
    reload,
  } = useRushData();

  // ----- Estado dos modais -----
  const [isWorkoutDetailOpen, setIsWorkoutDetailOpen] = useState(false);
  const [isAthleteModalOpen, setIsAthleteModalOpen] = useState(false);
  const [activeViewingImage, setActiveViewingImage] = useState<ImageViewerItem | null>(null);
  const [isBleModalOpen, setIsBleModalOpen] = useState(false);
  const [retirementShoeId, setRetirementShoeId] = useState<string | null>(null);
  const [isGearGarageOpen, setIsGearGarageOpen] = useState(false);
  const [isStoryExporterOpen, setIsStoryExporterOpen] = useState(false);
  const [isWorkoutSummaryOpen, setIsWorkoutSummaryOpen] = useState(false);
  const [isActiveRunOpen, setIsActiveRunOpen] = useState(false);
  const [isFieldProtocolOpen, setIsFieldProtocolOpen] = useState(false);
  const [activeCommentsPostId, setActiveCommentsPostId] = useState<string | null>(null);
  const [isNewPostOpen, setIsNewPostOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [isProSuccessOpen, setIsProSuccessOpen] = useState(false);
  const [lastRunSummary, setLastRunSummary] = useState<RunSummary | null>(null);
  const [activeRoute, setActiveRoute] = useState<{ id: string; title?: string | null } | null>(null);

  // A aba Treinos tem duas faces: a prescrição do dia e o histórico.
  const [workoutsView, setWorkoutsView] = useState<'prescricao' | 'historico' | 'plano'>('prescricao');
  const [historyTab, setHistoryTab] = useState<'calendario' | 'lista' | 'carga'>('calendario');

  // Atividade aberta em detalhe, a partir do histórico.
  const [openActivityId, setOpenActivityId] = useState<string | null>(null);
  const activityDetail = useActivityDetail(openActivityId);

  // A aba Medição também tem duas faces: a captura de VFC e o ciclo.
  const [measureView, setMeasureView] = useState<'vfc' | 'ciclo' | 'zonas'>('vfc');
  const cycle = useCycle(measureView === 'ciclo');

  // Perfil também abre a área de conta (hoje: exclusão).
  /**
   * A busca de atletas e o perfil público moram dentro da aba Feed: as duas
   * só existem para alimentar o canal "Seguindo", que nasce dali.
   */
  const [feedView, setFeedView] = useState<'feed' | 'buscar'>('feed');
  const [openAthleteId, setOpenAthleteId] = useState<string | null>(null);
  const social = useSocial();

  /**
   * A central é uma sobreposição, não uma aba: o sino aparece em todas
   * as telas, e mandar o atleta para uma aba faria ele perder onde
   * estava. As notificações são carregadas desde o início porque o
   * contador do sino depende delas.
   */
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const notifications = useNotifications();
  const publicProfile = usePublicProfile(openAthleteId);

  const [profileView, setProfileView] = useState<'perfil' | 'conta' | 'ajustes'>('perfil');

  // ---- Modulo do treinador ----
  // Vive dentro da aba Perfil, como Ajustes: a BottomNav e fixa em
  // seis colunas e o desenho do treinador pede outra barra inteira.
  // Enfiar uma setima coluna la mudaria a navegacao de todo mundo.
  const [coachView, setCoachView] = useState<null | 'painel' | 'atleta' | 'gestao' | 'prescrever'>(null);
  const [coachAtletaId, setCoachAtletaId] = useState<string | null>(null);

  const ehTreinador = ['coach', 'owner', 'admin'].includes(String(meRaw?.role || ''));

  const painelAssessoria = usePainelAssessoria(ehTreinador && coachView !== null);
  const fichaAtleta = useFichaAtleta(
    coachView === 'atleta' || coachView === 'prescrever' ? coachAtletaId : null,
  );
  const gestaoAtletas = useGestaoAtletas();
  // Os ajustes e a exclusao leem os mesmos dados: o hook carrega para as duas.
  const account = useAccountSettings(profileView === 'conta' || profileView === 'ajustes');

  // Depois de `profileView`: um `const` so existe a partir da linha em
  // que e declarado, e ler antes disso lanca ReferenceError.
  const push = usePushNotifications(isNotificationsOpen || profileView === 'ajustes');

  /** Exclusão confirmada: encerra a sessão e volta para o login. */
  const handleDeleteAccount = useCallback(
    async (password: string) => {
      await account.deleteAccount(password);
      onLogout();
    },
    [account, onLogout],
  );

  // As zonas alimentam a classificação de intensidade do histórico; só são
  // buscadas quando o atleta abre essa visão.
  // O histórico usa as zonas para a distribuição por faixa; a aba de
  // zonas as mostra. O mesmo hook serve aos dois.
  const zonasFc = useHrZones(workoutsView === 'historico' || measureView === 'zonas');
  const { zones } = zonasFc;

  // O plano inteiro so e buscado quando a aba do plano abre: sao 84
  // sessoes, e elas nao fazem falta nas outras duas abas.
  const planoCompleto = usePlanoCompleto(
    workoutsView === 'plano' ? (planRaw?.plan?.id ?? null) : null,
  );
  const history = useActivityHistory(zones);

  /** Depois de publicar, volta para o feed já atualizado. */
  const handlePosted = useCallback(async () => {
    await reload();
    goToTab('feed');
  }, [reload, goToTab]);

  /** Grava a corrida concluída (HUD ou execução guiada) como atividade. */
  const handleFinishRun = useCallback(
    async (summary: RunSummary, sessionId?: string | null) => {
      await finishRun({
        distance_km: summary.distanceKm,
        duration_seconds: summary.durationSeconds,
        avg_hr: summary.avgHr,
        max_hr: summary.maxHr,
        avg_pace: summary.avgPace !== '—' ? `${summary.avgPace}/km` : null,
        session_id: sessionId ?? null,
        track: summary.track.map((point) => ({
          lat: point.lat,
          lon: point.lon,
          t: point.timestamp,
          acc: point.accuracy,
          alt: point.altitude,
        })),
        hr_samples: summary.hrSamples,
      });
    },
    [finishRun],
  );

  /** Exporta o histórico de atividades já carregado como CSV. */
  const handleExportCsv = useCallback(() => {
    const today = new Date().toISOString().split('T')[0];
    downloadCsv(`rush-atividades-${today}.csv`, activitiesToCsv(recentActivitiesRaw));
  }, [recentActivitiesRaw]);

  /** Linha "Maratona • Avançado" montada a partir do objetivo cadastrado. */
  const objectiveLabel = useMemo(() => {
    const objectives = meRaw?.objectives;
    if (!objectives?.distance_km) return null;
    const distanceName: Record<number, string> = { 5: '5 KM', 10: '10 KM', 21: 'Meia Maratona', 42: 'Maratona' };
    const levelName: Record<string, string> = {
      beginner: 'Iniciante',
      intermediate: 'Intermediário',
      advanced: 'Avançado',
    };
    return [distanceName[objectives.distance_km] || `${objectives.distance_km} km`, levelName[objectives.level]]
      .filter(Boolean)
      .join(' • ');
  }, [meRaw]);

  /** Atividades com foto, usadas pela galeria da tela inicial. */
  const photoActivities = useMemo(
    () => recentActivitiesRaw.filter((activity: any) => !!activity.image_url),
    [recentActivitiesRaw],
  );

  const viewImage = useCallback((item: ImageViewerItem) => setActiveViewingImage(item), []);

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-[#e5e2e1] flex flex-col selection:bg-[#FF5500] selection:text-[#0D0D0D]">
      <Header
        athlete={athlete}
        readiness={readiness}
        onOpenProfile={() => setIsAthleteModalOpen(true)}
        onStartMeasure={() => goToTab('medicao')}
        onOpenNotifications={() => setIsNotificationsOpen(true)}
        unreadCount={notifications.unreadCount}
      />

      <main className="flex-1 flex flex-col relative w-full pt-16 pb-24 bg-[#0D0D0D]">
        {isNotificationsOpen && (
          <NotificationsScreen
            notifications={notifications}
            push={push}
            onBack={() => setIsNotificationsOpen(false)}
          />
        )}

        {!isNotificationsOpen && currentTab === 'inicio' && (
          <HomeScreen
            athlete={athlete}
            readiness={readiness}
            todayWorkout={todayWorkout}
            weeklySchedule={weeklySchedule}
            weeklySummary={weeklySummary}
            photoActivities={photoActivities}
            onStartMeasure={() => goToTab('medicao')}
            onViewWorkoutDetails={() => setIsWorkoutDetailOpen(true)}
            onOpenProfile={() => setIsAthleteModalOpen(true)}
            onOpenWorkoutsTab={() => goToTab('treinos')}
            onViewImage={viewImage}
            onOpenGearGarage={() => setIsGearGarageOpen(true)}
            onOpenBleHardware={() => setIsBleModalOpen(true)}
            onStartActiveRun={() => setIsActiveRunOpen(true)}
            onOpenFieldProtocol={() => setIsFieldProtocolOpen(true)}
            fatigueAlert={fatigueAlert}
            acwr={trainingLoad?.has_enough_history ? trainingLoad.acwr : null}
          />
        )}

        {!isNotificationsOpen && currentTab === 'medicao' && (
          <div className="flex flex-col w-full">
            <div className="w-full max-w-2xl mx-auto px-4 sm:px-5 pt-2">
              <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#1C1C1C] border border-[#262626]">
                {([
                  { id: 'vfc', label: 'Medir' },
                  { id: 'zonas', label: 'Zonas FC' },
                  { id: 'ciclo', label: 'Ciclo' },
                ] as const).map((view) => (
                  <button
                    key={view.id}
                    type="button"
                    onClick={() => setMeasureView(view.id)}
                    aria-pressed={measureView === view.id}
                    className={`min-h-[44px] rounded-lg font-label-caps text-[11px] uppercase tracking-wider font-extrabold transition-all cursor-pointer ${
                      measureView === view.id
                        ? 'bg-[#FF5500] text-[#0D0D0D] shadow-[0_0_12px_rgba(255,85,0,0.35)]'
                        : 'bg-[#141414] text-[#A1A1AA] hover:text-[#F7F5F3]'
                    }`}
                  >
                    {view.label}
                  </button>
                ))}
              </div>
            </div>

            {measureView === 'zonas' ? (
              <HrZonesScreen
                zonas={zonasFc}
                onFazerTeste={() => setIsFieldProtocolOpen(true)}
              />
            ) : measureView === 'ciclo' ? (
              <CycleScreen
                cycle={cycle}
                rmssdToday={hrvStatusRaw?.measurement?.rmssd_ms ?? null}
                readinessScore={hrvStatusRaw?.has_measured_today ? readiness.score : null}
                hrvHistory={hrvHistory}
                onOpenMeasurement={() => setMeasureView('vfc')}
              />
            ) : (
          <MeasurementScreen
            currentReadiness={readiness}
            hasMeasuredToday={!!hrvStatusRaw?.has_measured_today}
            onSubmitMeasurement={submitMeasurement}
            onBackToHome={() => goToTab('inicio')}
          />
            )}
          </div>
        )}

        {!isNotificationsOpen && currentTab === 'treinos' && (
          <div className="flex flex-col w-full">
            {/* Prescrição do dia x histórico: mesma aba, duas faces. */}
            <div className="w-full max-w-2xl mx-auto px-4 sm:px-5 pt-2">
              <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#1C1C1C] border border-[#262626]">
                {([
                  { id: 'prescricao', label: 'Hoje' },
                  { id: 'plano', label: 'Plano' },
                  { id: 'historico', label: 'Histórico' },
                ] as const).map((view) => (
                  <button
                    key={view.id}
                    type="button"
                    onClick={() => setWorkoutsView(view.id)}
                    aria-pressed={workoutsView === view.id}
                    className={`min-h-[44px] rounded-lg font-label-caps text-[11px] uppercase tracking-wider font-extrabold transition-all cursor-pointer ${
                      workoutsView === view.id
                        ? 'bg-[#FF5500] text-[#0D0D0D] shadow-[0_0_12px_rgba(255,85,0,0.35)]'
                        : 'bg-[#141414] text-[#A1A1AA] hover:text-[#F7F5F3]'
                    }`}
                  >
                    {view.label}
                  </button>
                ))}
              </div>
            </div>

            {openActivityId ? (
              <ActivityDetailScreen
                detail={activityDetail}
                shoes={shoes}
                onBack={() => setOpenActivityId(null)}
                onDeleted={() => {
                  setOpenActivityId(null);
                  history.reload();
                  reload();
                }}
                onViewRoute={setActiveRoute}
              />
            ) : workoutsView === 'plano' ? (
              <FullPlanScreen
                plano={planoCompleto}
                onVoltar={() => setWorkoutsView('prescricao')}
              />
            ) : workoutsView === 'prescricao' ? (
              <WorkoutsScreen
                workout={todayWorkout}
                upcomingSessions={upcomingSessions}
                currentWeek={currentWeek}
                onOpenDetailModal={() => setIsWorkoutDetailOpen(true)}
                onViewImage={viewImage}
                onFinishWorkout={handleFinishRun}
              />
            ) : (
              <HistoryScreen
                history={history}
                trainingLoad={trainingLoad}
                activeTab={historyTab}
                onTabChange={setHistoryTab}
                onViewRoute={setActiveRoute}
                onOpenActivity={setOpenActivityId}
                onExportCsv={handleExportCsv}
              />
            )}
          </div>
        )}

        {!isNotificationsOpen && currentTab === 'feed' && openAthleteId && (
          <PublicProfileScreen
            profile={publicProfile.profile}
            isLoading={publicProfile.isLoading}
            error={publicProfile.error}
            onToggleFollow={publicProfile.toggleFollow}
            onBack={() => setOpenAthleteId(null)}
          />
        )}

        {!isNotificationsOpen && currentTab === 'feed' && !openAthleteId && feedView === 'buscar' && (
          <AthleteSearchScreen
            social={social}
            onOpenAthlete={(userId) => setOpenAthleteId(userId)}
            onBack={() => setFeedView('feed')}
          />
        )}

        {!isNotificationsOpen && currentTab === 'feed' && !openAthleteId && feedView === 'feed' && (
          <FeedScreen
            onOpenSearch={() => setFeedView('buscar')}
            posts={feedPosts}
            channel={feedChannel}
            isLoadingFeed={isLoadingFeed}
            activeChallenge={activeChallenge}
            onChangeChannel={setFeedChannel}
            onToggleKudo={toggleKudo}
            onJoinChallenge={joinChallenge}
            onOpenNewPost={() => setIsNewPostOpen(true)}
            onOpenComments={(postId) => setActiveCommentsPostId(postId)}
            onViewImage={viewImage}
          />
        )}

        {!isNotificationsOpen && currentTab === 'premium-pro' && (
          <ProScreen
            athlete={athlete}
            readiness={readiness}
            trainingLoad={trainingLoad}
            hrvHistory={hrvHistory}
            vo2maxTrendPercent={vo2maxRaw?.trend_percent ?? null}
            hrZones={hrvStatusRaw?.suggestion?.hr_zones || null}
            zonePaces={parseCustomZonePaces(profileRaw)}
            devices={devices}
            subscription={subscription}
            onOpenCheckout={() => setIsCheckoutOpen(true)}
            onOpenFieldProtocol={() => setIsFieldProtocolOpen(true)}
            onOpenBleHardware={() => setIsBleModalOpen(true)}
            onOpenGearGarage={() => setIsGearGarageOpen(true)}
            onOpenStoryExporter={() => setIsStoryExporterOpen(true)}
            onExportCsv={handleExportCsv}
          />
        )}

        {!isNotificationsOpen && currentTab === 'perfil' && coachView === null && profileView === 'conta' && (
          <DeleteAccountScreen
            subscription={subscription}
            activities={recentActivitiesRaw}
            isDeleting={account.isSaving}
            error={account.error}
            onDelete={handleDeleteAccount}
            onCancel={() => setProfileView('ajustes')}
          />
        )}

        {/* ---------- Modulo do treinador ---------- */}
        {!isNotificationsOpen && currentTab === 'perfil' && ehTreinador && coachView === 'painel' && (
          <CoachDashboardScreen
            painel={painelAssessoria}
            onAbrirAtleta={(id) => { setCoachAtletaId(id); setCoachView('atleta'); }}
            onPrescrever={(id) => { setCoachAtletaId(id); setCoachView('prescrever'); }}
          />
        )}

        {!isNotificationsOpen && currentTab === 'perfil' && ehTreinador && coachView === 'atleta' && (
          <CoachAthleteScreen
            ficha={fichaAtleta}
            onVoltar={() => setCoachView('painel')}
            onPrescrever={() => setCoachView('prescrever')}
          />
        )}

        {!isNotificationsOpen && currentTab === 'perfil' && ehTreinador && coachView === 'prescrever' && (
          <CoachPrescribeScreen
            ficha={fichaAtleta}
            gestao={gestaoAtletas}
            onVoltar={() => setCoachView(coachAtletaId ? 'atleta' : 'painel')}
            onPrescrito={() => { fichaAtleta.reload(); setCoachView('atleta'); }}
          />
        )}

        {!isNotificationsOpen && currentTab === 'perfil' && ehTreinador && coachView === 'gestao' && (
          <CoachAthletesScreen
            painel={painelAssessoria}
            gestao={gestaoAtletas}
            onVoltar={() => setCoachView('painel')}
            onConcluido={() => setCoachView('painel')}
          />
        )}

        {!isNotificationsOpen && currentTab === 'perfil' && coachView === null && profileView === 'ajustes' && (
          <SettingsScreen
            account={account}
            push={push}
            onBack={() => setProfileView('perfil')}
            onOpenDeleteAccount={() => setProfileView('conta')}
          />
        )}

        {!isNotificationsOpen && currentTab === 'perfil' && coachView === null && profileView === 'perfil' && (
          <ProfileScreen
            athlete={athlete}
            readiness={readiness}
            weeklySummary={weeklySummary}
            objectiveLabel={objectiveLabel}
            location={profileRaw?.location || null}
            vo2maxTrendPercent={vo2maxRaw?.trend_percent ?? null}
            hrvStatusLabel={readiness.hrvStatus}
            recentActivities={recentActivitiesRaw}
            achievementsEarned={achievements.earned}
            achievementsAll={achievements.all}
            trainingLoad={trainingLoad}
            personalRecords={recordsRaw?.records || null}
            shoesSummary={shoesSummary}
            devices={devices}
            onOpenGearGarage={() => setIsGearGarageOpen(true)}
            onOpenBleHardware={() => setIsBleModalOpen(true)}
            onOpenEditProfile={() => setIsAthleteModalOpen(true)}
            onViewImage={viewImage}
            onViewRoute={setActiveRoute}
            onOpenAccount={() => setProfileView('ajustes')}
            onOpenAssessoria={ehTreinador ? () => setCoachView('painel') : undefined}
            onOpenGestaoAtletas={ehTreinador ? () => setCoachView('gestao') : undefined}
          />
        )}
      </main>

      <BottomNav currentTab={currentTab} onTabChange={goToTab} isMeasuring={!isNotificationsOpen && currentTab === 'medicao'} />

      <WorkoutDetailModal
        workout={todayWorkout}
        isOpen={isWorkoutDetailOpen}
        onClose={() => setIsWorkoutDetailOpen(false)}
        onStartWorkout={() => {
          setIsWorkoutDetailOpen(false);
          setIsActiveRunOpen(true);
        }}
        onViewImage={viewImage}
      />

      <AthleteModal
        currentAthlete={athlete}
        isOpen={isAthleteModalOpen}
        profile={profileRaw}
        onClose={() => setIsAthleteModalOpen(false)}
        onSaved={reload}
        onLogout={onLogout}
        onViewImage={viewImage}
      />

      <BleHardwareModal
        isOpen={isBleModalOpen}
        devices={devices}
        onClose={() => setIsBleModalOpen(false)}
        onReloadDevices={reloadDevices}
      />

      <ShoeRetirementModal
        isOpen={!!retirementShoeId}
        shoe={shoes.find((shoe: any) => shoe.id === retirementShoeId) || null}
        onClose={() => setRetirementShoeId(null)}
        onReloadGear={reloadGear}
        onViewImage={viewImage}
      />

      <GearGarageModal
        isOpen={isGearGarageOpen}
        shoes={shoes}
        summary={shoesSummary}
        onClose={() => setIsGearGarageOpen(false)}
        onReloadGear={reloadGear}
        onOpenShoeRetirement={(shoeId) => setRetirementShoeId(shoeId)}
        onViewImage={viewImage}
      />

      <StoryExporterModal
        isOpen={isStoryExporterOpen}
        athleteName={athlete.name}
        defaultShoeName={shoes.find((shoe: any) => shoe.isDefault)?.name || null}
        onClose={() => setIsStoryExporterOpen(false)}
      />

      <WorkoutSummaryModal
        isOpen={isWorkoutSummaryOpen}
        summary={lastRunSummary}
        hrZones={hrvStatusRaw?.suggestion?.hr_zones || null}
        personalRecords={recordsRaw?.records || null}
        weightKg={profileRaw?.weight_kg ?? null}
        onClose={() => setIsWorkoutSummaryOpen(false)}
        onOpenStoryExporter={() => setIsStoryExporterOpen(true)}
        onPublishToFeed={() => setIsNewPostOpen(true)}
        onViewImage={viewImage}
      />

      <ActiveRunModal
        isOpen={isActiveRunOpen}
        workout={todayWorkout}
        onClose={() => setIsActiveRunOpen(false)}
        onFinishWorkout={async (summary) => {
          await handleFinishRun(summary, todayWorkout.id);
          setLastRunSummary(summary);
          setIsWorkoutSummaryOpen(true);
        }}
      />

      <FieldProtocolModal
        isOpen={isFieldProtocolOpen}
        hrZones={hrvStatusRaw?.suggestion?.hr_zones || null}
        devices={devices}
        onClose={() => setIsFieldProtocolOpen(false)}
        onStartProtocol={() => setIsActiveRunOpen(true)}
        onCalibrated={reload}
      />

      <ActivityCommentsModal
        isOpen={!!activeCommentsPostId}
        activityId={activeCommentsPostId}
        currentUserId={athlete.id}
        onClose={() => setActiveCommentsPostId(null)}
        onInteraction={() => setFeedChannel(feedChannel)}
      />

      <NewPostModal
        isOpen={isNewPostOpen}
        athlete={athlete}
        onClose={() => setIsNewPostOpen(false)}
        onPosted={handlePosted}
      />

      <ProCheckoutModal
        isOpen={isCheckoutOpen}
        userId={athlete.id}
        subscription={subscription}
        onClose={() => setIsCheckoutOpen(false)}
        onSuccess={async () => {
          setIsCheckoutOpen(false);
          await reload();
          setIsProSuccessOpen(true);
        }}
      />

      <ProSuccessModal
        isOpen={isProSuccessOpen}
        subscription={subscription}
        onClose={() => setIsProSuccessOpen(false)}
      />

      <RouteMapModal
        activityId={activeRoute?.id ?? null}
        title={activeRoute?.title ?? null}
        isOpen={!!activeRoute}
        onClose={() => setActiveRoute(null)}
      />

      <ImageViewerModal
        item={activeViewingImage}
        isOpen={!!activeViewingImage}
        onClose={() => setActiveViewingImage(null)}
      />

      <DownloadToast />
    </div>
  );
}
