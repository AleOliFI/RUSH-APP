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

  const viewImage = useCallback((item: ImageViewerItem) => setActiveViewingImage(item), []);

  return (
    <div className="min-h-screen bg-[#0D0D0D] text-[#e5e2e1] flex flex-col selection:bg-[#FF5500] selection:text-[#0D0D0D]">
      <Header
        athlete={athlete}
        readiness={readiness}
        onOpenProfile={() => setIsAthleteModalOpen(true)}
        onStartMeasure={() => goToTab('medicao')}
      />

      <main className="flex-1 flex flex-col relative w-full pt-16 pb-24 bg-[#0D0D0D]">
        {currentTab === 'inicio' && (
          <HomeScreen
            athlete={athlete}
            readiness={readiness}
            todayWorkout={todayWorkout}
            weeklySchedule={weeklySchedule}
            weeklySummary={weeklySummary}
            onStartMeasure={() => goToTab('medicao')}
            onViewWorkoutDetails={() => setIsWorkoutDetailOpen(true)}
            onOpenProfile={() => setIsAthleteModalOpen(true)}
            onOpenWorkoutsTab={() => goToTab('treinos')}
            onViewImage={viewImage}
            onOpenGearGarage={() => setIsGearGarageOpen(true)}
            onOpenBleHardware={() => setIsBleModalOpen(true)}
            onStartActiveRun={() => setIsActiveRunOpen(true)}
            onOpenFieldProtocol={() => setIsFieldProtocolOpen(true)}
          />
        )}

        {currentTab === 'medicao' && (
          <MeasurementScreen
            currentReadiness={readiness}
            hasMeasuredToday={!!hrvStatusRaw?.has_measured_today}
            onSubmitMeasurement={submitMeasurement}
            onBackToHome={() => goToTab('inicio')}
          />
        )}

        {currentTab === 'treinos' && (
          <WorkoutsScreen
            workout={todayWorkout}
            upcomingSessions={upcomingSessions}
            currentWeek={currentWeek}
            onOpenDetailModal={() => setIsWorkoutDetailOpen(true)}
            onViewImage={viewImage}
            onFinishWorkout={handleFinishRun}
          />
        )}

        {currentTab === 'feed' && (
          <FeedScreen
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

        {currentTab === 'premium-pro' && (
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

        {currentTab === 'perfil' && (
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
          />
        )}
      </main>

      <BottomNav currentTab={currentTab} onTabChange={goToTab} isMeasuring={currentTab === 'medicao'} />

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

      <StoryExporterModal isOpen={isStoryExporterOpen} onClose={() => setIsStoryExporterOpen(false)} />

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

      <ImageViewerModal
        item={activeViewingImage}
        isOpen={!!activeViewingImage}
        onClose={() => setActiveViewingImage(null)}
      />

      <DownloadToast />
    </div>
  );
}
