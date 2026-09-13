// ============================================================
// RUSH RUNNING — Shell autenticado (6 abas)
// Header + conteúdo + BottomNav + todos os modais globais.
// As abas são rotas reais, então o botão "voltar" do navegador
// e os links profundos continuam funcionando.
// ============================================================

import React, { useCallback, useState } from 'react';
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

export default function RushShell() {
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
    hrvStatusRaw,
    profileRaw,
    recordsRaw,
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
  const [isShoeRetirementOpen, setIsShoeRetirementOpen] = useState(false);
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
            onOpenCheckout={() => setIsCheckoutOpen(true)}
            onOpenFieldProtocol={() => setIsFieldProtocolOpen(true)}
            onOpenBleHardware={() => setIsBleModalOpen(true)}
            onOpenGearGarage={() => setIsGearGarageOpen(true)}
            onOpenStoryExporter={() => setIsStoryExporterOpen(true)}
          />
        )}

        {currentTab === 'perfil' && (
          <ProfileScreen
            athlete={athlete}
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
        onClose={() => setIsAthleteModalOpen(false)}
        onSelectAthlete={() => setIsAthleteModalOpen(false)}
        onViewImage={viewImage}
      />

      <BleHardwareModal isOpen={isBleModalOpen} onClose={() => setIsBleModalOpen(false)} />

      <ShoeRetirementModal
        isOpen={isShoeRetirementOpen}
        onClose={() => setIsShoeRetirementOpen(false)}
        onViewImage={viewImage}
      />

      <GearGarageModal
        isOpen={isGearGarageOpen}
        onClose={() => setIsGearGarageOpen(false)}
        onOpenShoeRetirement={() => setIsShoeRetirementOpen(true)}
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
        onClose={() => setIsFieldProtocolOpen(false)}
        onStartProtocol={() => setIsActiveRunOpen(true)}
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
        onClose={() => setIsCheckoutOpen(false)}
        onSuccess={() => {
          setIsCheckoutOpen(false);
          setIsProSuccessOpen(true);
        }}
      />

      <ProSuccessModal isOpen={isProSuccessOpen} onClose={() => setIsProSuccessOpen(false)} />

      <ImageViewerModal
        item={activeViewingImage}
        isOpen={!!activeViewingImage}
        onClose={() => setActiveViewingImage(null)}
      />

      <DownloadToast />
    </div>
  );
}
