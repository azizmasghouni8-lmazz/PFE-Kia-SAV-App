import { useState, useEffect } from 'react';
import { AdditionalQuote } from '../../types';
import { workshopSyncService, WorkshopLiveProgress, WorkshopLiveStage } from '../../services/workshopSyncService';
import { soundService } from '../../services/soundService';

interface TechActiveInterventionProps {
  quote: AdditionalQuote;
  onFinishIntervention: () => void;
  onNavigateToParts?: () => void;
}

export function TechActiveIntervention({
  quote,
  onFinishIntervention,
  onNavigateToParts,
}: TechActiveInterventionProps) {
  const activeOrder = workshopSyncService.getOrders()[0];
  const clientName = activeOrder?.clientName || 'M. Aziz Masghouni';
  const vehicleName = activeOrder?.vehicleName || 'Kia Sportage GT-Line 1.6 T-GDi';
  const vehiclePlate = activeOrder?.plate || '235 TU 8812';
  const vehicleVin = activeOrder?.vin || 'KNA-AZ9823101';
  const orId = activeOrder?.id || '#OR-2026-9104';

  // Progression synchronisée en 4 étapes
  const [liveProgress, setLiveProgress] = useState<WorkshopLiveProgress>(() => {
    return (
      workshopSyncService.getLiveProgress() ||
      workshopSyncService.acceptOrderByTech()
    );
  });
  const [stepToast, setStepToast] = useState<string | null>(null);

  // Synchronisation du chronomètre réel
  const [seconds, setSeconds] = useState(() =>
    workshopSyncService.getElapsedSeconds(liveProgress)
  );
  const [isRunning, setIsRunning] = useState(true);

  // Checklist de tâches atelier
  const [task1Checked, setTask1Checked] = useState(true);
  const [task2Checked, setTask2Checked] = useState(true);
  const [task3Checked, setTask3Checked] = useState(quote.status === 'accepted');
  const [task4Checked, setTask4Checked] = useState(false);

  // Alerte magasinier
  const [magasinAlertSent, setMagasinAlertSent] = useState(false);

  // Modal / flux de vérification automatique et clôture
  const [autoVerifyState, setAutoVerifyState] = useState<'idle' | 'checking' | 'completed'>('idle');
  const [redirectCountdown, setRedirectCountdown] = useState<number>(3);
  const [checkProgress, setCheckProgress] = useState<{
    tasks: boolean;
    quote: boolean;
    kds: boolean;
    torque: boolean;
    clientNotified: boolean;
    chefNotified: boolean;
    orderDeleted: boolean;
  }>({
    tasks: false,
    quote: false,
    kds: false,
    torque: false,
    clientNotified: false,
    chefNotified: false,
    orderDeleted: false,
  });

  const [syncedQuotes, setSyncedQuotes] = useState<AdditionalQuote[]>(() => workshopSyncService.getQuotes());
  const [waitingState, setWaitingState] = useState(() =>
    workshopSyncService.isVehicleWaitingParts(vehiclePlate, orId)
  );

  useEffect(() => {
    const refreshLiveAndQuotes = () => {
      const current = workshopSyncService.getLiveProgress();
      if (current) {
        setLiveProgress(current);
        setSeconds(workshopSyncService.getElapsedSeconds(current));
      }
      setSyncedQuotes(workshopSyncService.getQuotes());
      setWaitingState(workshopSyncService.isVehicleWaitingParts(vehiclePlate, orId));
    };
    refreshLiveAndQuotes();
    window.addEventListener('k_dms_quotes_updated', refreshLiveAndQuotes);
    window.addEventListener('k_dms_orders_updated', refreshLiveAndQuotes);
    window.addEventListener('k_dms_live_updated', refreshLiveAndQuotes);
    return () => {
      window.removeEventListener('k_dms_quotes_updated', refreshLiveAndQuotes);
      window.removeEventListener('k_dms_orders_updated', refreshLiveAndQuotes);
      window.removeEventListener('k_dms_live_updated', refreshLiveAndQuotes);
    };
  }, [vehiclePlate, orId]);

  const activeSyncedQuote =
    syncedQuotes.find(
      (q) =>
        (q.plate && q.plate.replace(/\s+/g, '').toLowerCase() === vehiclePlate.replace(/\s+/g, '').toLowerCase()) ||
        (q.orId && q.orId.toLowerCase() === orId.toLowerCase())
    ) || quote;

  // Tick du chronomètre en temps réel
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (isRunning && autoVerifyState === 'idle') {
      interval = setInterval(() => {
        setSeconds((s) => s + 1);
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, autoVerifyState]);

  // Compte à rebours de retour automatique une fois la vérification complète
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (autoVerifyState === 'completed') {
      if (redirectCountdown > 0) {
        timer = setTimeout(() => {
          setRedirectCountdown((c) => c - 1);
        }, 1000);
      } else {
        onFinishIntervention();
      }
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [autoVerifyState, redirectCountdown, onFinishIntervention]);

  const hrs = String(Math.floor(seconds / 3600)).padStart(2, '0');
  const mins = String(Math.floor((seconds % 3600) / 60)).padStart(2, '0');
  const secs = String(seconds % 60).padStart(2, '0');

  // Barème constructeur alloué : 2h 30m = 9000 secondes
  const allocatedSeconds = 9000;
  const remainingSeconds = Math.max(0, allocatedSeconds - seconds);
  const remainingMins = Math.floor(remainingSeconds / 60);
  const isOvertime = seconds > allocatedSeconds;

  const validTaskCount = [task1Checked, task2Checked, task3Checked, task4Checked].filter(Boolean).length;

  // Lancement de la vérification automatique du système
  const launchAutoVerification = () => {
    setAutoVerifyState('checking');
    setIsRunning(false);

    // Étape 1 : Contrôle checklist des tâches (200ms)
    setTimeout(() => {
      setCheckProgress((prev) => ({ ...prev, tasks: true, quote: true }));
    }, 300);

    // Étape 2 : Contrôle valise KDS & Couples (600ms)
    setTimeout(() => {
      setCheckProgress((prev) => ({ ...prev, kds: true, torque: true }));
    }, 700);

    // Étape 3 : Validation définitive, notifications client/chef et suppression de l'ordre actif (1100ms)
    setTimeout(() => {
      const res = workshopSyncService.verifyAndCompleteOrder(orId, vehiclePlate);
      if (res.progress) {
        setLiveProgress(res.progress);
      }
      setCheckProgress((prev) => ({
        ...prev,
        clientNotified: true,
        chefNotified: true,
        orderDeleted: true,
      }));
      setAutoVerifyState('completed');
      setRedirectCountdown(3);
      soundService.play('tech_checklist_click');
    }, 1200);
  };

  const handleAdvanceStep = () => {
    soundService.play('tech_checklist_click');
    if (liveProgress.currentStep < 4) {
      const next = (liveProgress.currentStep + 1) as 2 | 3 | 4;
      const updated = workshopSyncService.advanceOrderStep(next);
      if (updated) {
        setLiveProgress(updated);
        setStepToast(
          `Étape 0${liveProgress.currentStep} validée ! Début de l'Étape 0${next} (${updated.progressPercent}%). Client & Chef notifiés.`
        );
        setTimeout(() => setStepToast(null), 4000);
      }
    } else {
      // Déclenche la vérification automatique et la clôture définitive
      launchAutoVerification();
    }
  };

  const handleAlertMagasin = () => {
    setMagasinAlertSent(true);
    setTimeout(() => setMagasinAlertSent(false), 3500);
  };

  return (
    <div className="w-full flex flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-[1720px] mx-auto">
      {/* BANDEAU SUPÉRIEUR D'INTERVENTION ACTIVE ÉPURÉ */}
      <section className="bg-surface-container-lowest rounded-2xl shadow-md overflow-hidden border border-surface-container-high">
        <div className="p-5 sm:p-6 flex flex-col xl:flex-row xl:items-center justify-between gap-5">
          {/* Bloc Véhicule & Client */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="relative w-28 h-20 rounded-xl overflow-hidden bg-surface-container-high flex-shrink-0 shadow-sm border border-surface-container-high">
              <img
                className="w-full h-full object-cover"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuBHdacDRyt47_4DN-HUXioDvsDGjsb3u4fy_69vDpdXFt_7k6PXeAmh1mifnmtyIqbbEinih766O8D0cpfVQB0FZvoGvdlNAEtZX_Uzi5B9oPwRV7qET1q6wa8S_hgOm9PwjolQ9bpdFAuMuxenpXTLfkZFQRQT8Zp1d_khdEsgfTfzfC_M0sVC1l5PFjDBu8tIUrkjFoNenB3Dp1VDi6w9_nP5lXAq_i0SP275Cw_KnR8PUOw9r0aIiQ"
                alt="Sportage"
              />
              <span className="absolute bottom-1 right-1 font-label-sm text-[10px] px-1.5 py-0.5 rounded bg-primary text-on-primary font-bold">
                GT-Line
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-headline-sm text-lg font-bold text-on-surface">
                  {vehicleName}
                </span>
                <span className="font-label-md text-xs bg-surface-container-highest px-2 py-0.5 rounded text-on-surface font-semibold font-mono">
                  {vehiclePlate}
                </span>
                <span className="font-label-sm text-[10px] px-2 py-0.5 rounded bg-secondary text-on-secondary font-bold uppercase tracking-wider">
                  {orId}
                </span>
                {waitingState.waiting && (
                  <span className="font-label-sm text-xs px-2.5 py-0.5 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 font-bold flex items-center gap-1 whitespace-nowrap">
                    <span className="material-symbols-outlined text-sm">hourglass_empty</span>
                    <span>En attente pièce</span>
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-on-surface-variant font-label-md text-xs font-mono">
                <div>
                  <span className="text-outline">VIN:</span>
                  <span className="font-bold text-on-surface ml-1">{vehicleVin}</span>
                </div>
                <div>
                  <span className="text-outline">Kilométrage:</span>
                  <span className="font-semibold text-on-surface ml-1">18 420 km</span>
                </div>
                <div>
                  <span className="text-outline">Client:</span>
                  <span className="font-semibold text-on-surface ml-1">{clientName}</span>
                </div>
                <div>
                  <span className="text-outline">Emplacement:</span>
                  <span className="px-2 py-0.5 bg-primary text-on-primary rounded text-[11px] font-bold ml-1">
                    Pont ciseaux #04
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Chronomètre Réel Synchronisé */}
          <div className="bg-surface-container-high rounded-xl p-4 flex flex-wrap items-center justify-between xl:justify-end gap-5 border border-surface-container-highest">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-secondary text-on-secondary flex items-center justify-center shadow-sm">
                <span className={`material-symbols-outlined text-[28px] ${isRunning ? 'animate-pulse' : ''}`}>
                  timer
                </span>
              </div>
              <div>
                <div className="flex items-baseline gap-2">
                  <span className="font-label-lg text-2xl font-extrabold text-on-surface tracking-tight font-mono">
                    {hrs}:{mins}:{secs}
                  </span>
                  <span
                    className={`font-label-sm text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                      isRunning ? 'bg-secondary/15 text-secondary' : 'bg-surface-container text-outline'
                    }`}
                  >
                    {isRunning ? 'Pointage Actif' : 'En Pause'}
                  </span>
                </div>
                <div className="flex items-center gap-2 font-label-sm text-[11px] text-on-surface-variant">
                  <span>Barème officiel : <strong className="text-on-surface">02h 30m</strong></span>
                  <span>•</span>
                  <span>
                    {isOvertime ? (
                      <span className="text-amber-600 font-bold font-mono">Dépassement barème</span>
                    ) : (
                      <span>Restant : <strong className="text-secondary font-mono">{remainingMins} min</strong></span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsRunning(!isRunning)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-surface-container-lowest hover:bg-surface-container font-label-md text-xs text-on-surface font-semibold shadow-sm transition-all border border-surface-container-high active:scale-95"
                type="button"
              >
                <span className="material-symbols-outlined text-base text-secondary">
                  {isRunning ? 'pause_circle' : 'play_circle'}
                </span>
                <span>{isRunning ? 'Pause Chrono' : 'Reprendre'}</span>
              </button>

              <button
                onClick={() => {
                  if (window.confirm(`Confirmer la suppression manuelle de l'ordre ${orId} (${vehicleName}) ? Il sera retiré de vos travaux actifs.`)) {
                    workshopSyncService.removeActiveOrder(orId, vehiclePlate);
                    onFinishIntervention();
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-container-lowest hover:bg-rose-50 text-rose-600 hover:text-rose-700 font-label-md text-xs font-semibold shadow-sm transition-all border border-surface-container-high hover:border-rose-200 active:scale-95"
                type="button"
                title="Supprimer manuellement cet ordre actif"
              >
                <span className="material-symbols-outlined text-base">delete</span>
                <span>Supprimer l'Ordre</span>
              </button>
            </div>
          </div>
        </div>

        {/* Barre de progression continue */}
        <div className="w-full bg-surface-container h-2 flex overflow-hidden">
          <div
            className="bg-secondary h-full transition-all duration-700"
            style={{ width: `${liveProgress.progressPercent}%` }}
          />
        </div>
      </section>

      {/* Toast d'alerte de progression */}
      {stepToast && (
        <div className="p-4 bg-emerald-950/80 border border-emerald-500/60 text-emerald-200 rounded-2xl shadow-xl flex items-center gap-3 animate-fadeIn">
          <span className="material-symbols-outlined text-emerald-400 text-2xl">task_alt</span>
          <div className="flex-1">
            <span className="font-bold text-xs uppercase tracking-wider text-emerald-300 block">
              Mise à jour en direct K-DMS
            </span>
            <span className="text-xs">{stepToast}</span>
          </div>
          <button
            onClick={() => setStepToast(null)}
            className="text-emerald-400 hover:text-white"
            type="button"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Progression de l'OR : Stepper 4 Étapes Synchronisé */}
      <section className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 shadow-md border border-surface-container-high flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-xl">traffic</span>
            <h2 className="font-headline-sm text-base sm:text-lg font-bold text-on-surface">
              Progression de l'Intervention ({liveProgress.progressPercent}%)
            </h2>
          </div>
          <span className="font-label-sm text-xs bg-surface-container px-2.5 py-0.5 rounded text-on-surface-variant font-semibold">
            SYNCHRONISATION EN DIRECT • CHEF D'ATELIER & CLIENT
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5">
          {liveProgress.stages.map((stg: WorkshopLiveStage) => {
            const isDone =
              liveProgress.currentStep > stg.step ||
              (liveProgress.currentStep === 4 &&
                (liveProgress.status === 'ready_for_restitution' ||
                  liveProgress.status === 'completed_and_paid'));
            const isActive = liveProgress.currentStep === stg.step && !isDone;

            return (
              <div
                key={stg.step}
                className={`rounded-xl p-3.5 flex items-center justify-between transition-all border ${
                  isActive
                    ? 'bg-secondary text-on-secondary shadow-md ring-2 ring-secondary/40 border-secondary'
                    : isDone
                    ? 'bg-emerald-50/70 border-emerald-300 text-emerald-950'
                    : 'bg-surface-container-low border-surface-container-high text-on-surface-variant opacity-75'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shrink-0 ${
                      isActive
                        ? 'bg-on-secondary text-secondary'
                        : isDone
                        ? 'bg-emerald-600 text-white'
                        : 'bg-surface-container-highest text-on-surface-variant'
                    }`}
                  >
                    {isDone ? (
                      <span className="material-symbols-outlined text-lg fill">check</span>
                    ) : isActive ? (
                      <span className="material-symbols-outlined text-lg animate-spin">settings</span>
                    ) : (
                      <span className="text-xs font-mono">0{stg.step}</span>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p
                        className={`font-label-sm text-[10px] uppercase font-bold ${
                          isActive ? 'text-white/80' : 'text-on-surface-variant'
                        }`}
                      >
                        Étape 0{stg.step}
                      </p>
                      {isActive && <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />}
                    </div>
                    <p
                      className={`font-headline-sm text-xs sm:text-sm font-bold ${
                        isActive ? 'text-white' : 'text-on-surface'
                      }`}
                    >
                      {stg.title}
                    </p>
                    <span className={`font-label-sm text-[10px] ${isActive ? 'text-white/90' : 'text-outline'}`}>
                      {isDone ? `Validé (${stg.timeLabel})` : isActive ? 'Intervention active' : 'En attente'}
                    </span>
                  </div>
                </div>

                <span
                  className={`font-label-sm text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                    isActive
                      ? 'bg-white text-secondary'
                      : isDone
                      ? 'bg-emerald-200/80 text-emerald-800'
                      : 'bg-surface-container-high text-on-surface'
                  }`}
                >
                  {isDone ? 'Terminé' : isActive ? 'En cours' : `${stg.percent}%`}
                </span>
              </div>
            );
          })}
        </div>

        {/* Bouton d'action explicite pour valider l'étape */}
        <div className="mt-2 p-4 sm:p-5 bg-surface-container-low rounded-xl flex flex-col md:flex-row items-center justify-between gap-4 border border-surface-container-high">
          <div className="flex items-center gap-3 text-on-surface">
            <div className="w-10 h-10 rounded-xl bg-secondary/15 text-secondary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-2xl">
                {liveProgress.currentStep === 4 ? 'verified' : 'arrow_circle_right'}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="font-label-sm text-xs text-secondary uppercase font-bold">
                Étape 0{liveProgress.currentStep} / 04 : {liveProgress.stages[liveProgress.currentStep - 1]?.title}
              </span>
              <p className="font-body-md text-xs sm:text-sm text-on-surface-variant">
                {liveProgress.currentStep === 4
                  ? 'Contrôle qualité zéro défaut. Cliquez ci-contre : le système vérifie auto si les travaux sont complets, notifie client & chef, supprime l\'ordre actif et retourne à la liste.'
                  : `Progression actuelle : ${liveProgress.progressPercent}%. Cliquez ci-contre pour valider et passer à la phase suivante.`}
              </p>
            </div>
          </div>

          <button
            onClick={handleAdvanceStep}
            className={`w-full md:w-auto px-6 py-3 font-headline-sm text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-2 shrink-0 ${
              liveProgress.currentStep === 4
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-900/30'
                : 'bg-secondary hover:bg-secondary-container text-on-secondary'
            }`}
            type="button"
          >
            {liveProgress.currentStep < 4 ? (
              <>
                <span>Valider l'Étape 0{liveProgress.currentStep} et passer à la suivante</span>
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-lg">verified</span>
                <span>Vérification Auto, Confirmation & Suppression Ordre</span>
              </>
            )}
          </button>
        </div>
      </section>

      {/* Bannière de Vérification Automatique si 4/4 tâches sont cochées */}
      {validTaskCount === 4 && autoVerifyState === 'idle' && (
        <section className="bg-emerald-900/20 border-2 border-emerald-500 p-5 rounded-2xl shadow-lg flex flex-col md:flex-row items-center justify-between gap-4 animate-in fade-in">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
              <span className="material-symbols-outlined text-2xl">task_alt</span>
            </div>
            <div>
              <span className="font-label-sm text-xs text-emerald-700 font-bold uppercase tracking-wider block">
                Toutes les opérations atelier sont cochées (4 / 4)
              </span>
              <h3 className="font-headline-sm text-base font-bold text-on-surface">
                Travaux 100% exécutés : Prêt pour la vérification automatique
              </h3>
              <p className="font-body-sm text-xs text-on-surface-variant">
                Le système va vérifier la complétude des travaux, transmettre la confirmation au client et au chef, supprimer cet ordre des ordres actifs et vous rediriger automatiquement.
              </p>
            </div>
          </div>

          <button
            onClick={launchAutoVerification}
            className="w-full md:w-auto px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-headline-sm text-xs sm:text-sm font-bold rounded-xl shadow-lg shadow-emerald-900/30 transition-all active:scale-95 flex items-center justify-center gap-2 shrink-0"
            type="button"
          >
            <span className="material-symbols-outlined text-lg">rocket_launch</span>
            <span>Vérifier & Clôturer Automatiquement</span>
          </button>
        </section>
      )}

      {/* Mise en page épurée 2 Colonnes : Checklist Atelier & Anomalie Validée */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Colonne Gauche (7 cols) : Checklist des tâches barème */}
        <section className="lg:col-span-7 bg-surface-container-lowest rounded-2xl p-5 sm:p-6 shadow-md space-y-4 border border-surface-container-high">
          <div className="flex items-center justify-between pb-2">
            <div>
              <span className="font-label-sm text-xs text-secondary uppercase font-bold tracking-wider">
                Programme Officiel Kia 30 000 KM
              </span>
              <h3 className="font-headline-md text-base sm:text-lg font-bold text-on-surface">
                Checklist des Opérations Réalisées
              </h3>
            </div>
            <div className="flex items-center gap-1.5 font-label-sm text-xs bg-surface-container px-3 py-1 rounded-full text-on-surface font-bold border border-surface-container-high">
              <span>Opérations :</span>
              <span className="text-secondary font-extrabold">{validTaskCount} / 4 Validées</span>
            </div>
          </div>

          {/* Tâche 1 */}
          <div className="p-3.5 rounded-xl bg-surface-container-low transition-colors flex items-start gap-3.5 border border-surface-container-high">
            <button
              onClick={() => {
                soundService.play('tech_checklist_click');
                setTask1Checked(!task1Checked);
              }}
              className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm transition-colors ${
                task1Checked ? 'bg-primary text-on-primary' : 'bg-surface-container border border-outline'
              }`}
              type="button"
            >
              {task1Checked && <span className="material-symbols-outlined text-base">check</span>}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                <h4
                  className={`font-body-lg text-xs sm:text-sm font-bold text-on-surface ${
                    task1Checked ? 'line-through decoration-secondary/60 opacity-80' : ''
                  }`}
                >
                  Vidange moteur huile homologuée Kia Shell Helix Ultra 0W20 + Filtre OEM & joint
                </h4>
                <span className="font-label-sm text-[10px] px-2 py-0.5 rounded bg-surface-container-high text-on-surface font-bold">
                  1.2h barème
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-on-surface-variant font-label-sm text-[11px]">
                <span className="flex items-center gap-1 text-on-surface font-semibold">
                  <span className="material-symbols-outlined text-xs text-secondary fill">check_circle</span> TERMINÉ
                  (09:42)
                </span>
                <span>•</span>
                <span>Réf Huile : SH-0W20-KIA</span>
                <span>•</span>
                <span>Capacité : 4.8 L</span>
              </div>
            </div>
          </div>

          {/* Tâche 2 */}
          <div className="p-3.5 rounded-xl bg-surface-container-low transition-colors flex items-start gap-3.5 border border-surface-container-high">
            <button
              onClick={() => {
                soundService.play('tech_checklist_click');
                setTask2Checked(!task2Checked);
              }}
              className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm transition-colors ${
                task2Checked ? 'bg-primary text-on-primary' : 'bg-surface-container border border-outline'
              }`}
              type="button"
            >
              {task2Checked && <span className="material-symbols-outlined text-base">check</span>}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                <h4
                  className={`font-body-lg text-xs sm:text-sm font-bold text-on-surface ${
                    task2Checked ? 'line-through decoration-secondary/60 opacity-80' : ''
                  }`}
                >
                  Remplacement filtre à air moteur + filtre d'habitacle antibactérien
                </h4>
                <span className="font-label-sm text-[10px] px-2 py-0.5 rounded bg-surface-container-high text-on-surface font-bold">
                  0.5h barème
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 text-on-surface-variant font-label-sm text-[11px]">
                <span className="flex items-center gap-1 text-on-surface font-semibold">
                  <span className="material-symbols-outlined text-xs text-secondary fill">check_circle</span> TERMINÉ
                  (10:15)
                </span>
                <span>•</span>
                <span>Filtres OEM K-DMS montés</span>
              </div>
            </div>
          </div>

          {/* Tâche 3 : anomalie freins */}
          <div className="p-3.5 rounded-xl bg-secondary-fixed/20 relative overflow-hidden flex items-start gap-3.5 border border-secondary/30">
            <button
              onClick={() => {
                soundService.play('tech_checklist_click');
                setTask3Checked(!task3Checked);
              }}
              className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm transition-colors ${
                task3Checked ? 'bg-secondary text-on-secondary' : 'bg-surface-container border border-secondary'
              }`}
              type="button"
            >
              {task3Checked ? (
                <span className="material-symbols-outlined text-base">check</span>
              ) : (
                <span className="material-symbols-outlined text-base text-secondary">warning</span>
              )}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                <h4 className="font-body-lg text-xs sm:text-sm font-bold text-on-surface">
                  Contrôle usure disques et plaquettes avant & arrière
                </h4>
                <span className="font-label-sm text-[10px] px-2 py-0.5 rounded bg-surface-container text-on-surface font-bold">
                  0.8h barème
                </span>
              </div>
              <div className="mt-1 p-3 bg-surface-container-lowest rounded-xl border border-secondary/30">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-secondary font-label-md text-xs font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">priority_high</span>
                    USURE 85% CONSTATÉE
                  </span>
                  <span className="font-label-sm text-[10px] px-2 py-0.5 rounded font-bold uppercase bg-emerald-100 text-emerald-800">
                    Devis Accepté par le Client
                  </span>
                </div>
                <p className="font-body-sm text-xs text-on-surface">
                  Garniture avant : <strong className="text-secondary font-mono">{quote.measuredThickness}</strong>{' '}
                  (Seuil mini constructeur : {quote.minThickness}).
                </p>
              </div>
            </div>
          </div>

          {/* Tâche 4 : Diagnostic KDS */}
          <div className="p-3.5 rounded-xl bg-surface-container-low transition-colors flex items-start gap-3.5 border border-surface-container-high">
            <button
              onClick={() => {
                soundService.play('tech_checklist_click');
                const next = !task4Checked;
                setTask4Checked(next);
                if (next && task1Checked && task2Checked && task3Checked) {
                  // Déclenchement automatique de la suggestion de clôture
                  setStepToast("Toutes les 4 opérations sont validées ! Vous pouvez lancer la vérification automatique.");
                }
              }}
              className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm transition-colors ${
                task4Checked ? 'bg-primary text-on-primary' : 'bg-surface-container-lowest border border-outline'
              }`}
              type="button"
            >
              {task4Checked ? (
                <span className="material-symbols-outlined text-base">check</span>
              ) : (
                <span className="w-2.5 h-2.5 rounded-full bg-secondary animate-ping" />
              )}
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-1 mb-1">
                <h4 className="font-body-lg text-xs sm:text-sm font-bold text-on-surface">
                  Diagnostic électronique global valise KDS + Remise à zéro indicateur
                </h4>
                <span className="font-label-sm text-[10px] px-2 py-0.5 rounded bg-primary text-on-primary font-bold">
                  0.5h barème
                </span>
              </div>
              <div className="flex items-center gap-3 text-on-surface font-label-sm text-[11px]">
                <span className="flex items-center gap-1 font-bold text-secondary">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-ping" />
                  {task4Checked ? 'CONTRÔLE VALIDÉ ZÉRO DÉFAUT' : 'EN COURS D\'EXÉCUTION'}
                </span>
                <span className="text-outline">•</span>
                <span className="text-on-surface-variant">Interface VCI connectée (VCI-BT #09)</span>
              </div>
            </div>
          </div>

          {/* Couples de serrage constructeur */}
          <div className="pt-2 grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-center">
            <div className="bg-surface-container-low p-2.5 rounded-xl border border-surface-container-high">
              <p className="font-label-sm text-[10px] text-outline uppercase font-semibold">Couple Bouchon Vidange</p>
              <p className="font-label-lg text-xs font-bold text-on-surface font-mono">34.3 - 44.1 Nm</p>
            </div>
            <div className="bg-surface-container-low p-2.5 rounded-xl border border-surface-container-high">
              <p className="font-label-sm text-[10px] text-outline uppercase font-semibold">Couple Roues Alu 18"</p>
              <p className="font-label-lg text-xs font-bold text-on-surface font-mono">107 - 127 Nm</p>
            </div>
            <div className="bg-surface-container-low p-2.5 rounded-xl col-span-2 sm:col-span-1 border border-surface-container-high">
              <p className="font-label-sm text-[10px] text-outline uppercase font-semibold">Filtre à Huile OEM</p>
              <p className="font-label-lg text-xs font-bold text-on-surface font-mono">12.0 - 15.0 Nm</p>
            </div>
          </div>
        </section>

        {/* Colonne Droite (5 cols) : Synthèse Devis & Preuve Photo */}
        <section className="lg:col-span-5 bg-surface-container-lowest rounded-2xl p-5 sm:p-6 shadow-md space-y-4 border border-surface-container-high">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-secondary">
              <span className="material-symbols-outlined text-xl">receipt_long</span>
              <h3 className="font-headline-sm text-sm sm:text-base font-bold text-on-surface">
                Devis & Pièce Complémentaire
              </h3>
            </div>
            <span
              className={`font-label-sm text-[11px] font-bold px-2.5 py-0.5 rounded uppercase whitespace-nowrap ${
                activeSyncedQuote.status === 'accepted'
                  ? 'bg-emerald-100 text-emerald-800'
                  : activeSyncedQuote.status === 'refused'
                  ? 'bg-rose-100 text-rose-800'
                  : 'bg-secondary-fixed text-on-secondary-fixed'
              }`}
            >
              {activeSyncedQuote.status === 'accepted'
                ? 'Validé Client'
                : activeSyncedQuote.status === 'refused'
                ? 'Refusé Client'
                : 'En attente client'}
            </span>
          </div>

          {waitingState.waiting && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex items-start gap-2">
              <span className="material-symbols-outlined text-base text-amber-700 shrink-0 mt-0.5">
                hourglass_empty
              </span>
              <div>
                <span className="font-bold block">État véhicule : En attente pièce</span>
                <span className="text-amber-900">{waitingState.reason}</span>
              </div>
            </div>
          )}

          {/* Carte récapitulative épurée */}
          <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container-high space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h4 className="font-headline-sm text-xs sm:text-sm font-bold text-on-surface">
                  {activeSyncedQuote.parts?.[0]?.name || activeSyncedQuote.title}
                </h4>
                <p className="font-label-sm text-[11px] text-outline font-mono">
                  {activeSyncedQuote.parts?.[0]?.oemRef
                    ? `Réf constructeur : ${activeSyncedQuote.parts[0].oemRef}`
                    : activeSyncedQuote.minThickness}
                </p>
              </div>
              <span className="font-label-lg text-sm font-bold text-secondary font-mono tabular-nums">
                {activeSyncedQuote.totalPrice.toFixed(3)} TND TTC
              </span>
            </div>

            <div className="flex items-center justify-between text-xs pt-1 border-t border-surface-container-high">
              <span className="text-on-surface-variant">Magasin City Cars :</span>
              <span
                className={`font-bold font-mono ${
                  activeSyncedQuote.requiresPartOrder && !activeSyncedQuote.chefDeliveryConfirmed
                    ? 'text-amber-700'
                    : 'text-emerald-700'
                }`}
              >
                {activeSyncedQuote.chefDeliveryConfirmed
                  ? 'Pièce reçue · Confirmée Chef'
                  : activeSyncedQuote.requiresPartOrder
                  ? `À commander (${activeSyncedQuote.estimatedDeliveryDelay || 'Délai fournisseur'})`
                  : activeSyncedQuote.parts?.[0]?.shelfLocation || 'En stock magasin'}
              </span>
            </div>

            {activeSyncedQuote.clientComment && (
              <div className="p-2.5 rounded-lg bg-surface-container-lowest border border-surface-container-high text-xs">
                <span className="font-bold text-on-surface block text-[11px] uppercase mb-0.5">
                  Avis écrit par le client :
                </span>
                <span className="text-on-surface-variant italic">« {activeSyncedQuote.clientComment} »</span>
              </div>
            )}
          </div>

          {/* Preuve Photo Inspection */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-[10px] uppercase font-bold text-on-surface-variant">
                Preuve Tablette Inspection Atelier
              </span>
              <span className="font-label-sm text-[10px] text-secondary font-mono font-bold">
                {activeSyncedQuote.measuredThickness}
              </span>
            </div>
            <div className="relative h-32 rounded-xl overflow-hidden bg-surface-container border border-surface-container-high">
              <img
                className="w-full h-full object-cover"
                src={activeSyncedQuote.photoUrl || quote.photoUrl}
                alt="Preuve usure"
              />
              <div className="absolute inset-0 bg-primary/20 flex items-end p-2.5">
                <span className="font-label-sm text-[10px] bg-black/80 backdrop-blur-md text-white px-2 py-0.5 rounded font-mono font-bold">
                  Suivi synchronisé Assistance & Devis Client
                </span>
              </div>
            </div>
          </div>

          {/* Actions ciblées */}
          <div className="space-y-2 pt-1">
            {activeSyncedQuote.status === 'accepted' && !activeSyncedQuote.techStockConfirmed ? (
              <button
                onClick={() => {
                  workshopSyncService.confirmWithStockTeamByTech(activeSyncedQuote.id);
                  setMagasinAlertSent(true);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-primary hover:bg-[#1a2a38] text-on-primary font-label-md text-xs font-bold transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                type="button"
              >
                <span className="material-symbols-outlined text-base">local_shipping</span>
                <span>Confirmer avec Équipe Stock & Mettre en Attente Pièce</span>
              </button>
            ) : magasinAlertSent || activeSyncedQuote.techStockConfirmed ? (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-bold text-center flex items-center justify-center gap-1.5">
                <span className="material-symbols-outlined text-sm">check_circle</span>
                <span>
                  {activeSyncedQuote.chefDeliveryConfirmed
                    ? 'Pièce livrée et confirmée par le Chef d’Atelier'
                    : 'Équipe Stock confirmée · Attente validation réception par le Chef'}
                </span>
              </div>
            ) : (
              <button
                onClick={handleAlertMagasin}
                className="w-full py-2.5 px-4 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-xs font-bold border border-surface-container-high transition-colors flex items-center justify-center gap-1.5 shadow-sm"
                type="button"
              >
                <span className="material-symbols-outlined text-base text-secondary">conveyor_belt</span>
                <span>Alerter Magasinier pour Remise des Pièces</span>
              </button>
            )}

            {onNavigateToParts && (
              <button
                onClick={onNavigateToParts}
                className="w-full py-2 px-3 rounded-xl text-secondary hover:bg-secondary/10 font-label-sm text-xs font-bold transition-colors flex items-center justify-center gap-1"
                type="button"
              >
                <span>Accéder à l'espace Demande Pièces & Devis</span>
                <span className="material-symbols-outlined text-sm">arrow_forward</span>
              </button>
            )}
          </div>
        </section>
      </div>

      {/* FOOTER DOCUMENTATION */}
      <footer className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3 border border-surface-container-high text-xs">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-label-sm text-[10px] uppercase text-outline font-bold">Documentation Constructeur :</span>
          <button
            onClick={() => alert("Manuel d'Atelier Sportage NQ5 ouvert en consultation.")}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors"
            type="button"
          >
            <span className="material-symbols-outlined text-sm text-secondary">menu_book</span>
            <span>Manuel d'Atelier Sportage NQ5</span>
          </button>
          <button
            onClick={() => alert('Fiche technique Shell Helix Ultra 0W20 affichée.')}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface transition-colors"
            type="button"
          >
            <span className="material-symbols-outlined text-sm text-secondary">water_drop</span>
            <span>Fiches Sécurité Fluides & Huiles</span>
          </button>
        </div>

        <div className="flex items-center gap-2 font-label-sm text-[10px] text-outline">
          <span>Terminal Baie #04 • Master Tech Karim Trabelsi</span>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="w-8 h-8 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface flex items-center justify-center transition-colors"
            title="Haut de page"
            type="button"
          >
            <span className="material-symbols-outlined text-base">arrow_upward</span>
          </button>
        </div>
      </footer>

      {/* MODAL / OVERLAY DE VÉRIFICATION AUTOMATIQUE ET CLÔTURE K-DMS */}
      {autoVerifyState !== 'idle' && (
        <div className="fixed inset-0 z-50 bg-[#05141f]/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl border-2 border-emerald-500 animate-in zoom-in-95 flex flex-col gap-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-lg shadow-emerald-900/40">
                  <span className="material-symbols-outlined text-3xl">verified</span>
                </div>
                <div>
                  <span className="font-label-sm text-xs text-emerald-600 font-bold uppercase tracking-wider block">
                    Système Automatisé K-DMS
                  </span>
                  <h3 className="font-headline-md text-xl font-bold text-on-surface">
                    Vérification Automatique des Travaux
                  </h3>
                  <p className="font-label-sm text-xs text-on-surface-variant font-mono">
                    Ordre : {orId} • {vehicleName} ({vehiclePlate})
                  </p>
                </div>
              </div>
            </div>

            {/* Checklist de Contrôles Automatiques */}
            <div className="p-4 rounded-2xl bg-surface-container-low border border-surface-container-high flex flex-col gap-3">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="flex items-center gap-2 text-on-surface">
                  <span
                    className={`material-symbols-outlined text-base ${
                      checkProgress.tasks ? 'text-emerald-600 fill' : 'text-on-surface-variant animate-spin'
                    }`}
                  >
                    {checkProgress.tasks ? 'check_circle' : 'progress_activity'}
                  </span>
                  Vérification opérations & checklist (4/4 opérations conformes)
                </span>
                <span className="font-mono text-emerald-700 font-bold">100% OK</span>
              </div>

              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="flex items-center gap-2 text-on-surface">
                  <span
                    className={`material-symbols-outlined text-base ${
                      checkProgress.quote ? 'text-emerald-600 fill' : 'text-on-surface-variant animate-spin'
                    }`}
                  >
                    {checkProgress.quote ? 'check_circle' : 'progress_activity'}
                  </span>
                  Devis complémentaire plaquettes vérifié et posé
                </span>
                <span className="font-mono text-emerald-700 font-bold">Validé Client</span>
              </div>

              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="flex items-center gap-2 text-on-surface">
                  <span
                    className={`material-symbols-outlined text-base ${
                      checkProgress.kds ? 'text-emerald-600 fill' : 'text-on-surface-variant animate-spin'
                    }`}
                  >
                    {checkProgress.kds ? 'check_circle' : 'progress_activity'}
                  </span>
                  Diagnostic électronique valise KDS & Couples de serrage
                </span>
                <span className="font-mono text-emerald-700 font-bold">Zéro Défaut</span>
              </div>

              <div className="flex items-center justify-between text-xs font-semibold border-t border-surface-container-high pt-2">
                <span className="flex items-center gap-2 text-on-surface">
                  <span
                    className={`material-symbols-outlined text-base ${
                      checkProgress.clientNotified ? 'text-emerald-600 fill' : 'text-on-surface-variant animate-spin'
                    }`}
                  >
                    {checkProgress.clientNotified ? 'send' : 'hourglass_top'}
                  </span>
                  Confirmation fin de travaux transmise au Client en direct
                </span>
                <span className="text-emerald-700 font-bold">Envoyé</span>
              </div>

              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="flex items-center gap-2 text-on-surface">
                  <span
                    className={`material-symbols-outlined text-base ${
                      checkProgress.chefNotified ? 'text-emerald-600 fill' : 'text-on-surface-variant animate-spin'
                    }`}
                  >
                    {checkProgress.chefNotified ? 'notifications_active' : 'hourglass_top'}
                  </span>
                  Alerte Chef d'atelier transmise pour Facturation & Restitution
                </span>
                <span className="text-emerald-700 font-bold">Notifié</span>
              </div>

              <div className="flex items-center justify-between text-xs font-semibold border-t border-surface-container-high pt-2">
                <span className="flex items-center gap-2 text-rose-700">
                  <span className="material-symbols-outlined text-base text-rose-600">delete_forever</span>
                  Suppression de l'ordre de la liste active & Archivage historique
                </span>
                <span className="text-emerald-700 font-bold">Effectué</span>
              </div>
            </div>

            {/* Notification de redirection automatique */}
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-label-sm text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                  Travaux 100% complets validés avec succès !
                </span>
                <span className="font-label-md text-xs font-extrabold text-emerald-800 font-mono">
                  Redirection dans {redirectCountdown}s...
                </span>
              </div>
              <p className="text-xs text-emerald-800">
                L'ordre a été supprimé des travaux en cours. Le véhicule est disponible dans votre <strong>Historique des travaux terminés du jour</strong>.
              </p>
            </div>

            {/* Bouton d'action immédiate */}
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                onClick={() => onFinishIntervention()}
                className="w-full py-3 px-5 rounded-xl bg-primary hover:bg-[#1a2a38] text-on-primary font-headline-sm text-xs sm:text-sm font-bold shadow-md transition-all active:scale-95 flex items-center justify-center gap-2"
                type="button"
              >
                <span>Retourner à la liste des ordres actifs maintenant</span>
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
