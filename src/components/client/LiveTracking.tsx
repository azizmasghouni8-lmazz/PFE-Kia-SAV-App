import { useState, useEffect, useMemo } from 'react';
import { AdditionalQuote, Compte, ServiceHistoryItem, Vehicle } from '../../types';
import { workshopSyncService, WorkshopLiveProgress } from '../../services/workshopSyncService';
import { HistoryDetailsModal } from '../modals/HistoryDetailsModal';

interface LiveTrackingProps {
  quote: AdditionalQuote | null;
  onUpdateQuoteStatus: (status: 'accepted' | 'refused') => void;
  serviceHistory: ServiceHistoryItem[];
  onOpenChat: () => void;
  onOpenPdf: (item?: ServiceHistoryItem) => void;
  activeVehicle?: Vehicle | null;
  onNavigateToBooking?: () => void;
  onNavigateToAssistance?: () => void;
  currentCompte?: Compte | null;
}

type HistoryFilter = 'all' | 'entretien' | 'mecanique' | 'electrique';

function formatChrono(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function LiveTracking({
  quote,
  serviceHistory,
  onOpenChat,
  onOpenPdf,
  activeVehicle,
  onNavigateToBooking,
  onNavigateToAssistance,
  currentCompte = null,
}: LiveTrackingProps) {
  // Synchronisation continue avec le service d'atelier & Firestore (strictement filtrée par client)
  const [liveProgress, setLiveProgress] = useState<WorkshopLiveProgress | null>(() =>
    workshopSyncService.getLiveProgressForClient(currentCompte)
  );
  const [archivedHistory, setArchivedHistory] = useState<ServiceHistoryItem[]>(() =>
    workshopSyncService.getArchivedServiceHistoryForClient(currentCompte)
  );
  const [clientToast, setClientToast] = useState<string | null>(() =>
    workshopSyncService.getClientToastForClient(
      currentCompte,
      activeVehicle ? [activeVehicle] : []
    )
  );
  const [dismissedToast, setDismissedToast] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(() =>
    workshopSyncService.getElapsedSeconds(
      workshopSyncService.getLiveProgressForClient(currentCompte)
    )
  );
  const [, setSyncTick] = useState(0);

  // Filtre & Recherche Carnet d'Entretien
  const [historySearch, setHistorySearch] = useState('');
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('all');
  const [selectedHistoryItem, setSelectedHistoryItem] = useState<ServiceHistoryItem | null>(null);

  // Réinitialiser les états transitoires lors d'un changement de compte client
  useEffect(() => {
    setDismissedToast(null);
    setSelectedHistoryItem(null);
    setHistorySearch('');
    setHistoryFilter('all');
  }, [currentCompte?.id]);

  useEffect(() => {
    const updateFromService = () => {
      const current = workshopSyncService.getLiveProgressForClient(currentCompte);
      const toast = workshopSyncService.getClientToastForClient(
        currentCompte,
        activeVehicle ? [activeVehicle] : []
      );
      const archived = workshopSyncService.getArchivedServiceHistoryForClient(currentCompte);
      setLiveProgress(current);
      setArchivedHistory(archived);
      setSyncTick((t) => t + 1);
      if (current) {
        setElapsedSeconds(workshopSyncService.getElapsedSeconds(current));
      } else {
        setElapsedSeconds(0);
      }
      if (toast && toast !== dismissedToast) {
        setClientToast(toast);
      } else if (!toast) {
        setClientToast(null);
      }
    };

    updateFromService();
    window.addEventListener('k_dms_live_updated', updateFromService);
    window.addEventListener('k_dms_history_updated', updateFromService);
    window.addEventListener('k_dms_quotes_updated', updateFromService);
    window.addEventListener('k_dms_orders_updated', updateFromService);
    window.addEventListener('storage', updateFromService);
    const interval = setInterval(updateFromService, 1500);
    return () => {
      window.removeEventListener('k_dms_live_updated', updateFromService);
      window.removeEventListener('k_dms_history_updated', updateFromService);
      window.removeEventListener('k_dms_quotes_updated', updateFromService);
      window.removeEventListener('k_dms_orders_updated', updateFromService);
      window.removeEventListener('storage', updateFromService);
      clearInterval(interval);
    };
  }, [dismissedToast, currentCompte, activeVehicle]);

  // Chronomètre temps réel chaque seconde quand une intervention est active avant clôture
  useEffect(() => {
    if (!liveProgress || liveProgress.status === 'completed_and_paid') return;
    const tick = setInterval(() => {
      setElapsedSeconds(workshopSyncService.getElapsedSeconds(liveProgress));
    }, 1000);
    return () => clearInterval(tick);
  }, [liveProgress]);

  const handleDismissToast = () => {
    if (clientToast) {
      setDismissedToast(clientToast);
    }
    setClientToast(null);
  };

  // Vérifier si le véhicule a déjà été check-out (payé et sorti d'atelier)
  const isVehicleCheckedOut = Boolean(
    activeVehicle &&
      workshopSyncService.isCheckedOut({
        plate: activeVehicle.plate,
        id: activeVehicle.activeOrId,
      })
  );

  const waitingPartsInfo = workshopSyncService.isVehicleWaitingPartsForClient(
    currentCompte,
    liveProgress?.plate || activeVehicle?.plate,
    liveProgress?.orderId || activeVehicle?.activeOrId
  );

  const pendingQuotes = workshopSyncService.getPendingQuotesForClient(
    currentCompte,
    activeVehicle ? [activeVehicle] : []
  );
  const pendingQuoteToNotify =
    pendingQuotes[0] ||
    (quote &&
    quote.status === 'pending' &&
    workshopSyncService.doesQuoteBelongToClient(
      quote,
      currentCompte,
      activeVehicle ? [activeVehicle] : []
    )
      ? quote
      : null);

  // Détection si véhicule actuellement en atelier (disparaît dès paiement & sortie)
  const isInWorkshop = Boolean(
    (liveProgress && liveProgress.status !== 'completed_and_paid') ||
      ((activeVehicle?.status === 'in_workshop' || activeVehicle?.status === 'waiting_parts' || waitingPartsInfo.waiting) &&
        !isVehicleCheckedOut)
  );

  const isReadyForRestitution = liveProgress?.status === 'ready_for_restitution';
  const currentPercent = liveProgress?.progressPercent ?? 65;
  const currentStepNum = liveProgress?.currentStep ?? 2;

  // Fusionner les archives issues du suivi direct (Firestore/local) + l'historique initial du compte (strictement filtrés)
  const combinedHistory = useMemo(() => {
    const merged: ServiceHistoryItem[] = [];
    const seenOr = new Set<string>();

    const ownedServiceHistory = serviceHistory.filter((item) =>
      workshopSyncService.doesRecordBelongToClient(item, currentCompte)
    );

    for (const item of [...archivedHistory, ...ownedServiceHistory]) {
      const key = (item.orNumber || item.id).trim().toLowerCase();
      if (!seenOr.has(key)) {
        seenOr.add(key);
        merged.push(item);
      }
    }
    return merged;
  }, [archivedHistory, serviceHistory, currentCompte]);

  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return combinedHistory.filter((item) => {
      if (historyFilter !== 'all' && item.category && item.category !== historyFilter) {
        return false;
      }
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        item.orNumber.toLowerCase().includes(q) ||
        item.workshop.toLowerCase().includes(q) ||
        (item.plate && item.plate.toLowerCase().includes(q)) ||
        (item.operations && item.operations.some((op) => op.label.toLowerCase().includes(q)))
      );
    });
  }, [combinedHistory, historySearch, historyFilter]);

  return (
    <div className="w-full flex flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Top Anchor Status Bar */}
      <section className="w-full flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-surface-container-high">
        <div className="flex items-center gap-3 flex-wrap">
          {waitingPartsInfo.waiting ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-label-sm text-xs uppercase tracking-wider font-bold shadow-sm">
              <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
              En attente pièce
            </span>
          ) : isInWorkshop ? (
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-label-sm text-xs uppercase tracking-wider font-bold shadow-sm ${
                isReadyForRestitution
                  ? 'bg-emerald-600 text-white'
                  : 'bg-secondary text-on-secondary'
              }`}
            >
              {!isReadyForRestitution && <span className="w-2 h-2 rounded-full bg-white animate-ping" />}
              {isReadyForRestitution ? 'Travaux terminés · Prêt au comptoir' : 'Atelier en direct'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-label-sm text-xs uppercase tracking-wider font-bold">
              <span className="material-symbols-outlined text-sm text-emerald-700">verified</span>
              Véhicule à Jour
            </span>
          )}

          {isInWorkshop && (
            <>
              <span className="font-label-md text-xs text-on-surface-variant font-semibold">
                OR n°{' '}
                <span className="text-on-surface font-mono tabular-nums font-bold">
                  {liveProgress?.orderId || activeVehicle?.activeOrId || 'CC-2024-9104'}
                </span>
              </span>
              <span className="text-on-surface-variant" aria-hidden="true">·</span>
            </>
          )}

          <span className="font-body-sm text-xs text-on-surface-variant font-medium">
            {liveProgress?.vehicleName || activeVehicle?.name || currentCompte?.modeleVehicule || 'Mon Véhicule Kia'}
          </span>
          <span className="font-label-sm text-xs px-2 py-0.5 rounded bg-surface-container-high text-on-surface font-mono font-bold tracking-widest border border-surface-container-highest">
            {liveProgress?.plate || activeVehicle?.plate || currentCompte?.immatriculation || '—'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-on-surface-variant font-label-sm text-xs">
          <span className="material-symbols-outlined text-base text-secondary">sync</span>
          <span>Synchronisation Firestore en temps réel</span>
        </div>
      </section>

      {/* En attente pièce Banner */}
      {waitingPartsInfo.waiting && (
        <section className="w-full rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-200/80 text-amber-900 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl">hourglass_empty</span>
            </div>
            <div>
              <span className="font-label-sm text-xs font-bold uppercase tracking-wider text-amber-800 block">
                État Véhicule : En attente pièce
              </span>
              <h3 className="font-headline-sm text-sm sm:text-base font-bold text-amber-950">
                {waitingPartsInfo.reason || 'Votre véhicule est en attente de réception de pièce détachée.'}
              </h3>
              <p className="text-xs text-amber-900 mt-0.5">
                Dès confirmation de l'arrivée de la pièce en stock par le Chef d'Atelier, les travaux reprendront automatiquement.
              </p>
            </div>
          </div>
          {onNavigateToAssistance && (
            <button
              type="button"
              onClick={onNavigateToAssistance}
              className="px-4 py-2 rounded-xl bg-amber-900 text-white hover:bg-amber-950 text-xs font-bold whitespace-nowrap shrink-0"
            >
              Voir dans Assistance & Devis
            </button>
          )}
        </section>
      )}

      {/* Live Toast Banner (Triggered when Tech accepts order, advances steps, or Chef completes checkout) */}
      {clientToast && (
        <section className="w-full rounded-2xl bg-[#0e1d28] text-white p-4 sm:p-5 shadow-md border border-white/10 relative overflow-hidden">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-secondary text-white flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-xl">notifications_active</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="font-label-sm text-[11px] font-semibold text-slate-300">
                  Notification Atelier City Cars Kia
                </span>
                <p className="font-headline-sm text-xs sm:text-sm font-semibold text-white leading-snug">
                  {clientToast}
                </p>
              </div>
            </div>

            <button
              onClick={handleDismissToast}
              type="button"
              className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors shrink-0"
              title="Fermer la notification"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        </section>
      )}

      {/* Scheduled Appointment Banner (if not yet in workshop) */}
      {!isInWorkshop && activeVehicle?.status === 'scheduled' && (
        <section className="w-full rounded-2xl bg-surface-container-lowest p-5 sm:p-6 shadow-sm border border-surface-container-high">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-2xl">event_available</span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-label-sm text-xs text-secondary font-bold">
                Rendez-vous SAV Enregistré & Confirmé
              </span>
              <h3 className="font-headline-sm text-base sm:text-lg font-bold text-on-surface">
                Votre véhicule est attendu à l'Atelier Central City Cars La Goulette
              </h3>
              <p className="font-body-sm text-xs text-on-surface-variant">
                {activeVehicle.workshopLocation || 'Prise en charge programmée selon votre créneau réservé.'}
              </p>
              <span className="font-label-sm text-[11px] text-emerald-700 font-semibold mt-1 flex items-center gap-1">
                <span className="material-symbols-outlined text-xs">check_circle</span>
                Dossier transmis au poste d'ordonnancement du Chef d'Atelier
              </span>
            </div>
          </div>
        </section>
      )}

      {/* When IN WORKSHOP: Render Live Progression Experience */}
      {isInWorkshop ? (
        <>
          {/* Restitution readiness banner if step 4 reached */}
          {isReadyForRestitution && (
            <section className="w-full rounded-2xl bg-emerald-700 text-white p-5 sm:p-6 shadow-md border border-emerald-600 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-3xl">key</span>
                </div>
                <div>
                  <span className="font-label-sm text-xs font-bold text-emerald-100">
                    Clôture Travaux Effectuée (Étape 4/4)
                  </span>
                  <h3 className="font-headline-sm text-base sm:text-lg font-bold text-white">
                    Votre Kia est prête ! Rendez-vous au comptoir SAV pour le règlement et la sortie
                  </h3>
                  <p className="font-body-sm text-xs text-emerald-100 mt-0.5">
                    Contrôle qualité 100% validé et lavage offert effectué. Une fois le paiement confirmé, ce dossier sera archivé automatiquement dans votre Carnet d'Entretien ci-dessous.
                  </p>
                </div>
              </div>

              <div className="px-4 py-2 rounded-xl bg-white text-emerald-900 font-headline-sm text-xs font-bold shrink-0 text-center shadow-sm whitespace-nowrap">
                Comptoir Accueil N°1
              </div>
            </section>
          )}

          {/* Active Intervention Main Card */}
          <section className="w-full rounded-2xl bg-surface-container-lowest p-5 sm:p-6 shadow-sm border border-surface-container-high">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Vehicle & Service Info (5 cols) */}
              <div className="lg:col-span-5 flex flex-col gap-2.5">
                <div className="flex items-center gap-1.5 text-secondary font-label-md text-xs font-bold">
                  <span className="material-symbols-outlined text-lg">build_circle</span>
                  <span>Intervention en cours dans nos ateliers</span>
                </div>
                <h1 className="font-headline-lg text-2xl sm:text-3xl text-on-surface tracking-tight font-bold">
                  {liveProgress?.serviceTitle || 'Entretien & Diagnostic Réglé 75 points'}
                </h1>
                <p className="font-body-sm text-xs sm:text-sm text-on-surface-variant">
                  {liveProgress
                    ? `Dossier ${liveProgress.orderId} pour ${liveProgress.clientName} (${liveProgress.vehicleName} · ${liveProgress.plate}). Pièces certifiées d'origine Kia.`
                    : 'Entretien réglementaire constructeur 75 points de contrôle, vidange homologuée Kia Shell Helix Ultra & valise diagnostic KDS.'}
                </p>

                <div className="flex flex-wrap items-center gap-4 pt-1 text-xs text-on-surface">
                  <div className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base text-on-surface-variant">schedule</span>
                    <span>
                      Pris en charge à <strong className="font-mono tabular-nums">{liveProgress?.startedAt || '09:30'}</strong>
                    </span>
                  </div>
                  <span aria-hidden="true" className="text-on-surface-variant">·</span>
                  <div className="flex items-center gap-1.5 text-secondary font-semibold">
                    <span className="material-symbols-outlined text-base">timer</span>
                    <span className="font-mono tabular-nums">{formatChrono(elapsedSeconds)}</span>
                    <span className="text-on-surface-variant font-normal">
                      / {liveProgress?.estimatedDuration || '2h 30m'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Master Technician Card (4 cols) */}
              <div className="lg:col-span-4 bg-surface-container-low p-4 rounded-xl flex items-center justify-between gap-3 border border-surface-container-high">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative flex-shrink-0">
                    <img
                      className="w-14 h-14 rounded-full object-cover ring-2 ring-surface-container-highest"
                      src="https://lh3.googleusercontent.com/aida-public/AB6AXuB0HYPk7Laai_5rGScCTC4_8PGqHa19A0B4COxO3i3ZDsypMOJGM03aK3_K-iwIBRwDJ6DVHOigiwW8m3HV17YCjfFSVRCxoUlpsej_6Fvua_KLzXxC3B63nXImUzOXSpgNloI6Tfl1OBpoAnar7485r8SHi-38oTBrqZIhWNhK_sJCyD_mLBT1gvD_W0DEAF-ygk40KPeOiZ7_N9qRA_rLyCfKmqrjG3ObuF_nI9Gg1WK-7RI6uZ8bjw"
                      alt={liveProgress?.technicianName || 'Karim Trabelsi'}
                      referrerPolicy="no-referrer"
                    />
                    <span
                      className="absolute bottom-0 right-0 w-4 h-4 rounded-full bg-secondary flex items-center justify-center text-on-secondary shadow-sm"
                      title="Kia Master Expert"
                    >
                      <span className="material-symbols-outlined text-[10px] fill">verified</span>
                    </span>
                  </div>

                  <div className="flex flex-col min-w-0">
                    <span className="font-label-sm text-[11px] text-secondary font-bold">
                      {liveProgress?.technicianRole || 'Master Technicien Agréé'}
                    </span>
                    <h3 className="font-headline-sm text-sm sm:text-base font-bold text-on-surface truncate">
                      {liveProgress?.technicianName || 'Karim Trabelsi'}
                    </h3>
                    <p className="font-body-sm text-[11px] text-on-surface-variant truncate">
                      {liveProgress?.bay || 'Baie #04 · Pont ciseaux #04'}
                    </p>
                  </div>
                </div>

                <button
                  onClick={onOpenChat}
                  className="p-2.5 rounded-xl bg-surface-container-lowest border border-surface-container-high hover:bg-secondary hover:text-on-secondary transition-colors text-on-surface flex-shrink-0"
                  title="Poser une question au conseiller d'atelier"
                  type="button"
                >
                  <span className="material-symbols-outlined text-lg">chat</span>
                </button>
              </div>

              {/* Progress Dial Widget (3 cols) */}
              <div className="lg:col-span-3 bg-surface-container-low p-4 rounded-xl flex flex-col items-center justify-center text-center gap-1 border border-surface-container-high">
                <span className="font-label-sm text-[11px] text-on-surface-variant font-semibold">
                  Progression en Direct
                </span>
                <div className="flex items-baseline gap-0.5">
                  <span className="font-headline-xl text-4xl sm:text-5xl font-black text-secondary font-mono tabular-nums tracking-tight">
                    {currentPercent}
                  </span>
                  <span className="font-headline-md text-xl font-bold text-secondary font-mono">%</span>
                </div>
                <div className="w-full bg-surface-container h-2.5 rounded-full overflow-hidden mt-1">
                  <div
                    className="bg-secondary h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${currentPercent}%` }}
                  />
                </div>
                <span className="font-label-sm text-[11px] font-semibold text-on-surface-variant mt-1">
                  Étape {currentStepNum} sur 4 · {isReadyForRestitution ? 'Clôturé' : 'En Atelier'}
                </span>
              </div>
            </div>
          </section>

          {/* 4-Step Animated Timeline Section */}
          <section className="w-full bg-surface-container-lowest p-5 sm:p-6 rounded-2xl shadow-sm border border-surface-container-high flex flex-col gap-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <span className="font-label-sm text-xs text-secondary font-bold">
                  Suivi par Jalon Officiel Kia
                </span>
                <h2 className="font-headline-sm text-base sm:text-lg font-bold text-on-surface">
                  Progression de l'Ordre de Réparation (4 Étapes)
                </h2>
              </div>
              <span className="font-label-sm text-xs text-on-surface-variant font-medium">
                Mise à jour automatique K-DMS
              </span>
            </div>

            {/* 4 Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {(liveProgress?.stages || [
                {
                  step: 1,
                  title: 'Diagnostic & Inspection',
                  shortDesc: 'Contrôle valise Kia KDS 75 points & état d’entrée',
                  percent: 25,
                  timeLabel: '09:15',
                  status: 'completed',
                },
                {
                  step: 2,
                  title: 'En Réparation / Entretien',
                  shortDesc: 'Opérations mécaniques & pièces d’origine Kia',
                  percent: 50,
                  timeLabel: '10:30',
                  status: 'in_progress',
                },
                {
                  step: 3,
                  title: 'Contrôle Qualité & Essai',
                  shortDesc: 'Vérification serrages, ADAS & essai dynamique',
                  percent: 75,
                  timeLabel: '11:45',
                  status: 'pending',
                },
                {
                  step: 4,
                  title: 'Clôture Travaux & Restitution',
                  shortDesc: 'Lavage offert, facture & remise en main propre',
                  percent: 100,
                  timeLabel: '12:30',
                  status: 'pending',
                },
              ]).map((st) => {
                const isStepDone = st.status === 'completed';
                const isStepActive = st.status === 'in_progress';
                return (
                  <div
                    key={st.step}
                    className={`p-4 rounded-xl border flex flex-col justify-between min-h-[120px] transition-all relative ${
                      isStepDone
                        ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                        : isStepActive
                        ? 'bg-secondary-fixed text-on-secondary-fixed border-secondary shadow-sm ring-1 ring-secondary/30'
                        : 'bg-surface-container-low border-surface-container-high text-on-surface-variant opacity-80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono tabular-nums text-xs font-bold">
                        Étape 0{st.step} · {isStepDone ? 'Terminé' : isStepActive ? 'En cours' : 'À venir'}
                      </span>

                      {isStepDone && (
                        <span className="material-symbols-outlined text-emerald-700 text-lg">check_circle</span>
                      )}
                      {isStepActive && (
                        <span className="w-2.5 h-2.5 rounded-full bg-secondary animate-ping" />
                      )}
                    </div>

                    <div className="my-2">
                      <span className="font-headline-sm text-sm font-bold block leading-snug">
                        {st.title}
                      </span>
                      <p className="font-body-sm text-[11px] opacity-80 mt-0.5 line-clamp-2">
                        {st.shortDesc}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-1.5 border-t border-black/5 text-[11px] font-mono tabular-nums">
                      <span>{st.percent}%</span>
                      <span>{st.timeLabel}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Live Bay View & Operations Checklist */}
          <section className="w-full grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            {/* Live Camera (7 cols) */}
            <div className="lg:col-span-7 bg-surface-container-lowest p-5 rounded-2xl shadow-sm border border-surface-container-high flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <h3 className="font-headline-sm text-sm sm:text-base font-bold text-on-surface">
                  Flux Direct Atelier · {liveProgress?.bay || 'Baie #04 Pont Ciseaux'}
                </h3>
                <span className="font-mono text-[11px] text-on-surface-variant">
                  Caméra Pont #04 HD
                </span>
              </div>

              <div className="relative w-full h-64 sm:h-80 lg:flex-1 rounded-xl overflow-hidden bg-slate-950 flex items-center justify-center">
                <img
                  className="w-full h-full object-cover opacity-85"
                  src="https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?auto=format&fit=crop&q=80&w=1000"
                  alt="Flux vidéo de la baie mécanique atelier Kia"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/70 backdrop-blur-sm text-white font-mono text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                  <span>{isReadyForRestitution ? 'CONTRÔLE TERMINÉ' : 'DIRECT LIVE · 1080p'}</span>
                </div>
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white text-xs font-mono bg-black/65 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                  <span>POSTE MÉCANIQUE BAIE 04</span>
                  <span>OPÉRATEUR : {liveProgress?.technicianName?.toUpperCase() || 'K. TRABELSI'}</span>
                </div>
              </div>
            </div>

            {/* Checklist items in progress (5 cols) */}
            <div className="lg:col-span-5 bg-surface-container-lowest p-5 rounded-2xl shadow-sm border border-surface-container-high flex flex-col justify-between gap-4">
              <div className="flex flex-col gap-3">
                <h3 className="font-headline-sm text-sm sm:text-base font-bold text-on-surface">
                  Opérations de l'Ordre de Réparation
                </h3>
                <div className="divide-y divide-surface-container-high border border-surface-container-high rounded-xl overflow-hidden">
                  {[
                    { label: 'Diagnostic électronique valise Kia KDS 75 points', done: currentPercent >= 25 },
                    { label: 'Vidange huile moteur 0W20 Shell Helix Ultra & filtre OEM', done: currentPercent >= 50, inProgress: currentPercent === 25 },
                    { label: 'Remplacement filtre d’habitacle & contrôle freinage', done: currentPercent >= 50, inProgress: currentPercent === 25 },
                    { label: 'Contrôle batterie, serrage châssis & essai dynamique', done: currentPercent >= 75, inProgress: currentPercent === 50 },
                    { label: 'Lavage offert & validation finale restitution', done: currentPercent >= 100, inProgress: currentPercent === 75 },
                  ].map((op, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-surface-container-lowest flex items-center justify-between gap-3 text-xs"
                    >
                      <span className="font-body-sm text-on-surface leading-snug">{op.label}</span>
                      {op.done ? (
                        <span className="font-label-sm text-[11px] text-emerald-700 font-bold shrink-0 whitespace-nowrap">
                          Fait
                        </span>
                      ) : op.inProgress ? (
                        <span className="font-label-sm text-[11px] text-secondary font-bold shrink-0 whitespace-nowrap">
                          En cours
                        </span>
                      ) : (
                        <span className="font-label-sm text-[11px] text-on-surface-variant shrink-0 whitespace-nowrap">
                          À suivre
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-surface-container-low rounded-xl border border-surface-container-high flex items-center gap-3">
                <span className="material-symbols-outlined text-secondary text-xl shrink-0">verified_user</span>
                <p className="font-body-sm text-[11px] text-on-surface-variant">
                  Une fois les travaux réglés et le véhicule restitué, le détail complet sera archivé dans votre historique ci-dessous.
                </p>
              </div>
            </div>
          </section>
        </>
      ) : (
        /* When NOT IN WORKSHOP (including right after Payment & Car Exit): Clean Up-to-Date State */
        <section className="w-full rounded-2xl bg-surface-container-lowest p-6 sm:p-8 shadow-sm border border-surface-container-high flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-start gap-5">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
              <span className="material-symbols-outlined text-3xl">directions_car</span>
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 text-xs text-emerald-800 font-semibold">
                <span>Véhicule en circulation</span>
                {activeVehicle?.plate && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono text-on-surface-variant">{activeVehicle.plate}</span>
                  </>
                )}
              </div>
              <h2 className="font-headline-lg text-xl sm:text-2xl font-bold text-on-surface">
                Aucune intervention active en atelier
              </h2>
              <p className="font-body-md text-xs sm:text-sm text-on-surface-variant max-w-2xl">
                Votre {activeVehicle?.name || 'Kia'} est à jour. Toutes vos interventions clôturées et réglées sont consultables avec le détail complet des opérations dans votre Carnet d'Entretien Numérique ci-dessous.
              </p>
            </div>
          </div>

          {onNavigateToBooking && (
            <button
              onClick={onNavigateToBooking}
              type="button"
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-secondary text-on-secondary hover:bg-secondary-container font-headline-sm text-sm font-bold shadow-sm transition-all active:scale-95 shrink-0 whitespace-nowrap"
            >
              <span className="material-symbols-outlined text-lg">calendar_month</span>
              <span>Prendre un Rendez-vous SAV</span>
            </button>
          )}
        </section>
      )}

      {/* Redirection Devis vers Assistance & Devis uniquement (sans boutons Accepter/Refuser ici) */}
      {pendingQuoteToNotify && (
        <section className="w-full bg-surface-container-lowest p-5 rounded-2xl shadow-sm border border-secondary/50 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl">receipt_long</span>
            </div>
            <div>
              <span className="text-xs font-bold text-secondary block">
                Nouveau Devis Complémentaire Reçu ({pendingQuoteToNotify.plate})
              </span>
              <h3 className="font-headline-sm text-sm sm:text-base font-bold text-on-surface">
                {pendingQuoteToNotify.title} — {pendingQuoteToNotify.totalPrice.toFixed(3)} TND TTC
              </h3>
              <p className="font-body-sm text-xs text-on-surface-variant mt-0.5">
                Pour accepter, refuser ou rédiger votre avis destiné au technicien, veuillez consulter votre espace Assistance & Devis.
              </p>
            </div>
          </div>

          {onNavigateToAssistance && (
            <button
              type="button"
              onClick={onNavigateToAssistance}
              className="px-4 py-2.5 rounded-xl bg-secondary text-on-secondary hover:bg-secondary-container text-xs font-bold shadow-sm whitespace-nowrap shrink-0 flex items-center gap-1.5"
            >
              <span>Ouvrir Assistance & Devis</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          )}
        </section>
      )}

      {/* Certified Digital Service Logbook (Carnet d'Entretien Numérique) */}
      <section className="w-full flex flex-col gap-4">
        <div className="bg-surface-container-lowest p-5 sm:p-6 rounded-2xl shadow-sm flex flex-col gap-5 border border-surface-container-high">
          {/* Header & Global Actions */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <span className="font-label-sm text-xs text-secondary font-bold">
                Traçabilité Officielle City Cars Kia
              </span>
              <h3 className="font-headline-md text-xl sm:text-2xl font-bold text-on-surface">
                Carnet d'Entretien Numérique Certifié ({combinedHistory.length})
              </h3>
            </div>

            {combinedHistory.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-container-low hover:bg-surface-container text-on-surface font-body-sm text-xs font-semibold transition-colors border border-surface-container-high whitespace-nowrap shrink-0"
                  type="button"
                >
                  <span className="material-symbols-outlined text-base">print</span>
                  <span>Imprimer Carnet</span>
                </button>

                <button
                  onClick={() => onOpenPdf(combinedHistory[0])}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary text-on-primary font-body-sm text-xs font-semibold hover:bg-[#1a2a38] transition-colors shadow-sm whitespace-nowrap shrink-0"
                  type="button"
                >
                  <span className="material-symbols-outlined text-base">download</span>
                  <span>Dernier Reçu PDF</span>
                </button>
              </div>
            )}
          </div>

          {/* Search & Category Filters for Organized History */}
          {combinedHistory.length > 0 && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pb-1">
              <div className="relative flex-1 max-w-md">
                <span className="material-symbols-outlined text-lg text-on-surface-variant absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  search
                </span>
                <input
                  type="text"
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Rechercher par N° OR, opération, atelier..."
                  className="w-full pl-9 pr-3 py-2 rounded-lg bg-surface-container-low border border-surface-container-high text-xs text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-secondary/40"
                />
              </div>

              <div className="flex items-center gap-1 p-1 bg-surface-container-low rounded-lg border border-surface-container-high overflow-x-auto">
                {(
                  [
                    { id: 'all', label: 'Toutes' },
                    { id: 'entretien', label: 'Entretien' },
                    { id: 'mecanique', label: 'Mécanique' },
                    { id: 'electrique', label: 'Électrique' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setHistoryFilter(tab.id)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      historyFilter === tab.id
                        ? 'bg-surface-container-lowest text-on-surface shadow-sm'
                        : 'text-on-surface-variant hover:text-on-surface'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Historic Entries List or Empty State */}
          {filteredHistory.length > 0 ? (
            <div className="flex flex-col divide-y divide-surface-container-high border border-surface-container-high rounded-xl overflow-hidden">
              {filteredHistory.map((item) => {
                const isInProgressItem = item.status === 'in_progress';
                const opCount = item.operations?.length || 0;
                return (
                  <div
                    key={item.id}
                    className={`p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 transition-colors ${
                      item.movedFromLive
                        ? 'bg-emerald-50/40 hover:bg-emerald-50/70'
                        : 'bg-surface-container-lowest hover:bg-surface-container-low'
                    }`}
                  >
                    <div className="flex items-start gap-4 min-w-0">
                      <div
                        className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center font-bold flex-shrink-0 border ${
                          isInProgressItem
                            ? 'bg-secondary text-on-secondary border-secondary'
                            : 'bg-surface-container-low text-on-surface border-surface-container-high'
                        }`}
                      >
                        <span className="font-label-sm text-[10px] uppercase">{item.date}</span>
                        <span className="font-headline-sm text-xs font-bold font-mono tabular-nums">
                          {item.year}
                        </span>
                      </div>

                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-headline-sm text-sm sm:text-base font-bold text-on-surface">
                            {item.title}
                          </span>
                          {item.movedFromLive && (
                            <span className="text-[11px] font-bold text-emerald-700">
                              · Clôturé & Restitué
                            </span>
                          )}
                        </div>

                        <p className="font-body-sm text-xs text-on-surface-variant line-clamp-2">
                          {item.description}
                        </p>

                        <div className="flex flex-wrap items-center gap-2 pt-1 font-label-sm text-xs text-on-surface-variant">
                          <span className="font-mono tabular-nums font-semibold text-on-surface">
                            {item.orNumber}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums font-semibold text-secondary">
                            {item.mileage}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{item.workshop}</span>
                          <span aria-hidden="true">·</span>
                          <span>Intervenant : {item.technicianName || item.advisor}</span>
                          {item.amount && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums font-bold text-on-surface">
                                {item.amount}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start lg:self-center flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => setSelectedHistoryItem(item)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-secondary text-on-secondary hover:bg-secondary-container transition-colors text-xs font-bold shadow-sm whitespace-nowrap shrink-0"
                      >
                        <span className="material-symbols-outlined text-base">fact_check</span>
                        <span>
                          Détails des opérations{opCount > 0 ? ` (${opCount})` : ''}
                        </span>
                      </button>

                      <button
                        onClick={() => onOpenPdf(item)}
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-container-low hover:bg-primary hover:text-on-primary text-on-surface transition-all text-xs font-semibold border border-surface-container-high whitespace-nowrap shrink-0"
                        type="button"
                      >
                        <span className="material-symbols-outlined text-sm">picture_as_pdf</span>
                        <span>Facture PDF</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 rounded-xl bg-surface-container-low border border-surface-container-high flex flex-col items-center justify-center text-center gap-2.5 py-10">
              <div className="w-12 h-12 rounded-xl bg-surface-container-lowest flex items-center justify-center text-secondary shadow-sm">
                <span className="material-symbols-outlined text-2xl">menu_book</span>
              </div>
              <h4 className="font-headline-sm text-base font-bold text-on-surface">
                {combinedHistory.length === 0
                  ? "Carnet d'Entretien Numérique Vierge"
                  : 'Aucune intervention ne correspond à votre recherche'}
              </h4>
              <p className="font-body-sm text-xs text-on-surface-variant max-w-md">
                {combinedHistory.length === 0
                  ? 'Toutes vos interventions clôturées et réglées dans le réseau City Cars Kia Tunisie seront automatiquement archivées ici avec le détail complet des opérations.'
                  : 'Modifiez vos critères de recherche ou réinitialisez le filtre pour afficher toutes vos interventions.'}
              </p>
            </div>
          )}

          {/* Digital Guarantee Seal Banner */}
          <div className="p-4 rounded-xl bg-primary text-on-primary flex flex-col sm:flex-row items-center justify-between gap-4 border border-white/5">
            <div className="flex items-center gap-3">
              <span className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center text-on-secondary flex-shrink-0 shadow-sm">
                <span className="material-symbols-outlined text-2xl">workspace_premium</span>
              </span>
              <div>
                <h4 className="font-headline-sm text-sm sm:text-base font-bold text-white">
                  Garantie Constructeur Kia Préservée
                </h4>
                <p className="font-body-sm text-xs text-[#778694]">
                  Tous les entretiens officiels de votre véhicule sont strictement réalisés selon le cahier des charges Kia avec pièces certifiées d'origine.
                </p>
              </div>
            </div>

            <span className="font-mono text-xs px-3 py-1.5 bg-white/10 rounded font-bold text-secondary-fixed whitespace-nowrap">
              Couverture 5 Ans Active
            </span>
          </div>
        </div>
      </section>

      {/* Organized Operations Detail Modal */}
      <HistoryDetailsModal
        isOpen={Boolean(selectedHistoryItem)}
        onClose={() => setSelectedHistoryItem(null)}
        item={selectedHistoryItem}
        onOpenPdf={(it) => onOpenPdf(it)}
      />
    </div>
  );
}
