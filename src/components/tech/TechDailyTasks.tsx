import { useState, useEffect } from 'react';
import { AdditionalQuote, RepairOrder } from '../../types';
import {
  workshopSyncService,
  CompletedTechOrder,
  SyncRepairOrder,
  WorkshopLiveProgress,
} from '../../services/workshopSyncService';
import { soundService } from '../../services/soundService';

interface TechDailyTasksProps {
  quote: AdditionalQuote;
  orders?: RepairOrder[];
  onNavigateToActive: () => void;
  onOpenIncidentModal?: () => void;
}

export function TechDailyTasks({ quote, onNavigateToActive }: TechDailyTasksProps) {
  const [filter, setFilter] = useState<'all' | 'progress' | 'waiting' | 'upcoming'>('all');
  const [ackMessage, setAckMessage] = useState(false);
  const [toastAlert, setToastAlert] = useState<string | null>(null);

  // Modal de confirmation de suppression manuelle
  const [orderToDelete, setOrderToDelete] = useState<{
    id: string;
    plate: string;
    vehicleName: string;
    isCompleted?: boolean;
  } | null>(null);

  // Synchronisation des ordres en attente & en cours transmis par le chef d'atelier
  const [syncedOrders, setSyncedOrders] = useState<SyncRepairOrder[]>(() =>
    workshopSyncService.getOrders()
  );

  // Synchronisation de l'historique des travaux terminés du jour
  const [completedOrders, setCompletedOrders] = useState<CompletedTechOrder[]>(() =>
    workshopSyncService.getCompletedOrdersToday()
  );

  // État de l'intervention en cours pour le chronomètre/stepper
  const [liveProgress, setLiveProgress] = useState<WorkshopLiveProgress | null>(() =>
    workshopSyncService.getLiveProgress()
  );

  useEffect(() => {
    const refreshData = () => {
      const list = workshopSyncService.getOrders();
      setSyncedOrders(list);
      setCompletedOrders(workshopSyncService.getCompletedOrdersToday());
      setLiveProgress(workshopSyncService.getLiveProgress());

      const newOrder = list.find((o) => o.isNewForTech);
      if (newOrder) {
        const clientLabel = newOrder.clientName ? `${newOrder.clientName} • ` : '';
        setToastAlert(
          `Nouvel OR ${newOrder.id} reçu : ${clientLabel}${newOrder.vehicleName} (${newOrder.plate}) — Prestation : ${newOrder.service}`
        );
        workshopSyncService.markTechOrdersRead();
      }
    };

    refreshData();

    window.addEventListener('k_dms_orders_updated', refreshData);
    window.addEventListener('k_dms_completed_orders_updated', refreshData);
    window.addEventListener('k_dms_planning_updated', refreshData);
    window.addEventListener('k_dms_quotes_updated', refreshData);

    return () => {
      window.removeEventListener('k_dms_orders_updated', refreshData);
      window.removeEventListener('k_dms_completed_orders_updated', refreshData);
      window.removeEventListener('k_dms_planning_updated', refreshData);
      window.removeEventListener('k_dms_quotes_updated', refreshData);
    };
  }, []);

  const totalCompletedCount = completedOrders.length;
  const isSportageCompleted =
    liveProgress?.currentStep === 4 &&
    (liveProgress?.status === 'ready_for_restitution' ||
      liveProgress?.status === 'completed_and_paid');

  // Filtrage des ordres occultés/supprimés manuellement
  const isSportageDismissed = workshopSyncService.isTechOrderDismissed('#OR-2026-9104', '235 TU 8812');
  const isSorentoDismissed = workshopSyncService.isTechOrderDismissed('#CC-2024-9100', '235 TU 1189');
  const isEv6Dismissed = workshopSyncService.isTechOrderDismissed('#CC-2024-9102', '240 TU 9901');

  const visibleSyncedOrders = syncedOrders.filter(
    (ord) => !workshopSyncService.isTechOrderDismissed(ord.id, ord.plate)
  );

  const hasAnyActive =
    visibleSyncedOrders.length > 0 ||
    (!isSportageCompleted && !isSportageDismissed) ||
    !isSorentoDismissed ||
    !isEv6Dismissed;

  const handleConfirmDelete = () => {
    if (!orderToDelete) return;
    if (orderToDelete.isCompleted) {
      workshopSyncService.removeCompletedOrder(orderToDelete.id);
    } else {
      workshopSyncService.removeActiveOrder(orderToDelete.id, orderToDelete.plate);
    }
    const idDeleted = orderToDelete.id;
    setOrderToDelete(null);
    setToastAlert(`Ordre ${idDeleted} supprimé manuellement.`);
    setTimeout(() => setToastAlert(null), 3000);
  };

  return (
    <div className="w-full flex flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-[1720px] mx-auto">
      {/* Toast Alert pour actions K-DMS */}
      {toastAlert && (
        <div className="fixed top-20 right-8 z-50 bg-[#05141f] text-white p-4 rounded-xl shadow-2xl flex items-center gap-3 border border-secondary animate-bounce">
          <span className="material-symbols-outlined text-secondary text-2xl">notifications_active</span>
          <div>
            <p className="font-bold text-sm">Système K-DMS Technicien</p>
            <p className="text-xs text-[#778694]">{toastAlert}</p>
          </div>
          <button
            onClick={() => setToastAlert(null)}
            className="ml-3 p-1 rounded-lg text-on-surface-variant hover:text-white"
            type="button"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Session Header & Metrics */}
      <section className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col gap-4 border border-surface-container-high">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-primary text-on-primary font-label-sm text-xs uppercase font-bold tracking-wider">
                <span className="w-2 h-2 rounded-full bg-secondary animate-ping" />
                Poste Actif
              </span>
              <span className="font-label-sm text-xs text-outline uppercase tracking-wider font-semibold">
                Ordonnancement Quotidien • City Cars Charguia / La Goulette
              </span>
            </div>
            <h1 className="font-headline-md text-xl sm:text-2xl text-on-surface tracking-tight">
              Bonjour <span className="font-bold text-primary">Karim Trabelsi</span>{' '}
              <span className="text-on-surface-variant font-normal text-base">(Technicien Master Certifié)</span> —{' '}
              <span className="text-secondary font-bold">Baie Mécanique Lourde #04</span>
            </h1>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => {
                setCompletedOrders(workshopSyncService.getCompletedOrdersToday());
                setSyncedOrders(workshopSyncService.getOrders());
                setLiveProgress(workshopSyncService.getLiveProgress());
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-surface-container hover:bg-surface-container-high rounded-xl text-on-surface transition-colors border border-surface-container-high text-xs font-semibold"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">sync</span>
              <span>Rafraîchir K-DMS</span>
            </button>
            <button
              onClick={() => alert('Scanner code-barres / OCR activé sur la tablette d’atelier.')}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-on-primary rounded-xl hover:bg-[#1a2a38] transition-colors shadow-sm text-xs font-bold uppercase tracking-wider"
              type="button"
            >
              <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>
              <span>Scanner Véhicule</span>
            </button>
          </div>
        </div>

        {/* 4 Charge Metrics */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1">
          <div className="p-4 bg-surface-container-low rounded-xl flex items-center justify-between border border-surface-container-high">
            <div className="flex flex-col">
              <span className="font-label-sm text-[10px] text-outline uppercase tracking-wider font-semibold">
                Véhicules Traités Aujourd'hui
              </span>
              <span className="font-headline-lg text-2xl font-bold text-on-surface mt-1">
                {totalCompletedCount + (isSportageCompleted || isSportageDismissed ? 0 : 1)}{' '}
                <span className="text-xs font-normal text-on-surface-variant">unités</span>
              </span>
              <div className="flex items-center gap-1.5 mt-1 font-label-sm text-[10px] text-on-surface-variant">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> {totalCompletedCount} Terminés
                <span>•</span>
                <span className="w-1.5 h-1.5 rounded-full bg-secondary" /> {isSportageCompleted || isSportageDismissed ? 0 : 1} En cours
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-surface-container-highest flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-2xl">directions_car</span>
            </div>
          </div>

          <div className="p-4 bg-surface-container-low rounded-xl flex items-center justify-between border border-surface-container-high">
            <div className="flex flex-col">
              <span className="font-label-sm text-[10px] text-outline uppercase tracking-wider font-semibold">
                Temps Barème Planifié
              </span>
              <span className="font-headline-lg text-2xl font-bold text-on-surface mt-1">6h 40m</span>
              <span className="font-label-sm text-[10px] text-on-surface-variant mt-1">Fin théorique : 17h10</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-surface-container-highest flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-2xl">timer</span>
            </div>
          </div>

          <div className="p-4 bg-surface-container-low rounded-xl flex items-center justify-between border border-surface-container-high">
            <div className="flex flex-col">
              <span className="font-label-sm text-[10px] text-outline uppercase tracking-wider font-semibold">
                Temps Réel Pointé
              </span>
              <span className="font-headline-lg text-2xl font-bold text-on-surface mt-1">3h 45m</span>
              <div className="w-28 bg-surface-container-highest h-1.5 rounded-full overflow-hidden mt-1.5">
                <div className="bg-primary h-full w-[56%]" />
              </div>
            </div>
            <div className="w-12 h-12 rounded-xl bg-surface-container-highest flex items-center justify-center text-primary">
              <span className="material-symbols-outlined text-2xl">history_toggle_off</span>
            </div>
          </div>

          <div className="p-4 bg-surface-container-low rounded-xl flex items-center justify-between border border-surface-container-high">
            <div className="flex flex-col">
              <span className="font-label-sm text-[10px] text-outline uppercase tracking-wider font-semibold">
                Efficacité Barème du Jour
              </span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="font-headline-lg text-2xl font-bold text-secondary">112%</span>
                <span className="font-label-sm text-[11px] text-emerald-600 font-bold">+12% vs standard</span>
              </div>
              <span className="font-label-sm text-[10px] text-on-surface-variant mt-1">Qualité Zéro Défaut</span>
            </div>
            <div className="w-12 h-12 rounded-xl bg-secondary-fixed/50 flex items-center justify-center text-secondary border border-secondary/20">
              <span className="material-symbols-outlined text-2xl">military_tech</span>
            </div>
          </div>
        </div>
      </section>

      {/* Grid: Tâches en cours & Historique du jour (8 cols) / Outils & Messages (4 cols) */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* Colonne Gauche (8 cols) */}
        <div className="xl:col-span-8 flex flex-col gap-6">
          {/* SECTION 1 : TRAVAUX EN ATTENTE & EN COURS */}
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-secondary animate-pulse" />
                <h2 className="font-headline-sm text-base sm:text-lg font-bold text-on-surface">
                  Travaux en Attente & En Cours
                </h2>
              </div>
              <span className="font-label-sm text-xs text-on-surface-variant bg-surface-container px-2.5 py-0.5 rounded font-mono font-semibold">
                Ordres actifs
              </span>
            </div>

            {/* Cartes des Nouveaux Ordres Transmis par le Chef d'Atelier */}
            {visibleSyncedOrders.map((ord) => {
              const waitInfo = workshopSyncService.isVehicleWaitingParts(ord.plate, ord.id);
              const isWaiting = ord.status === 'waiting_parts' || waitInfo.waiting;

              return (
              <article
                key={ord.id}
                className={`bg-surface-container-lowest rounded-2xl p-5 sm:p-6 shadow-md flex flex-col gap-4 relative overflow-hidden border-2 ${
                  isWaiting ? 'border-amber-500' : 'border-secondary'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`w-20 h-16 rounded-xl overflow-hidden relative bg-surface-container-high shrink-0 shadow-sm border flex items-center justify-center ${
                        isWaiting ? 'border-amber-500' : 'border-secondary'
                      }`}
                    >
                      <span
                        className={`material-symbols-outlined text-3xl ${
                          isWaiting ? 'text-amber-600' : 'text-secondary'
                        }`}
                      >
                        {isWaiting ? 'hourglass_empty' : 'car_repair'}
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-label-lg text-sm text-primary font-bold font-mono bg-primary-fixed/20 px-2 py-0.5 rounded">
                          {ord.plate}
                        </span>
                        <span className="text-outline-variant">·</span>
                        <span className="font-headline-sm text-base font-bold text-on-surface">
                          {ord.vehicleName}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 font-label-sm text-xs text-outline mt-1 font-mono flex-wrap">
                        <span>Client : <strong className="text-on-surface">{ord.clientName || 'Propriétaire'}</strong></span>
                        <span>|</span>
                        <span>OR : <strong className="text-secondary">{ord.id}</strong></span>
                        <span>|</span>
                        <span>Baie : <strong>{ord.bay}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    {isWaiting ? (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-900 border border-amber-300 font-label-md text-xs font-bold tracking-wider uppercase shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
                        En attente pièce
                      </div>
                    ) : (
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary text-white font-label-md text-xs font-bold tracking-wider uppercase shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-white animate-ping" />
                        Transmis du Chef · Prêt
                      </div>
                    )}
                    <span className="font-label-sm text-[10px] text-on-surface-variant font-semibold">
                      Assigné : {ord.technician}
                    </span>
                  </div>
                </div>

                {isWaiting && (
                  <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs flex items-center gap-2">
                    <span className="material-symbols-outlined text-base text-amber-700 shrink-0">
                      local_shipping
                    </span>
                    <span>
                      <strong>En attente pièce :</strong>{' '}
                      {waitInfo.reason || ord.waitingPartsReason || 'Pièce en cours de commande / attente validation Chef d’Atelier'}
                    </span>
                  </div>
                )}

                <div className="bg-surface-container-low rounded-xl p-3.5 flex flex-col gap-1 border border-surface-container-high">
                  <span className="font-label-sm text-[10px] text-outline uppercase font-semibold">
                    Prestation Demandée :
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-secondary text-base">build</span>
                    <span className="font-bold text-sm text-on-surface">{ord.service}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-surface-container-high">
                  <div className="flex items-center gap-1.5 text-xs text-on-surface-variant font-mono">
                    <span className="material-symbols-outlined text-sm text-emerald-600">verified</span>
                    <span>Check-in réception validé</span>
                  </div>

                  {/* Actions : Suppression manuelle ou Prise en main */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() =>
                        setOrderToDelete({
                          id: ord.id,
                          plate: ord.plate,
                          vehicleName: ord.vehicleName,
                          isCompleted: false,
                        })
                      }
                      className="px-3 py-2 rounded-xl bg-surface-container hover:bg-rose-50 text-rose-600 hover:text-rose-700 font-label-md text-xs font-semibold transition-all border border-surface-container-high hover:border-rose-200 flex items-center gap-1.5 active:scale-95"
                      title="Supprimer manuellement cet ordre"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                      <span>Supprimer</span>
                    </button>

                    <button
                      onClick={() => {
                        soundService.play('tech_checklist_click');
                        workshopSyncService.acceptOrderByTech(ord.id);
                        onNavigateToActive();
                      }}
                      className="px-4 py-2 rounded-xl bg-secondary hover:bg-secondary-container text-white font-label-md text-xs font-bold shadow-md transition-all active:scale-95 flex items-center gap-1.5"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-base">play_circle</span>
                      <span>Prendre en main / Lancer Travaux</span>
                    </button>
                  </div>
                </div>
              </article>
              );
            })}

            {/* Si tous les ordres actifs ont été clôturés ou supprimés manuellement */}
            {!hasAnyActive && (
              <div className="p-6 rounded-2xl bg-emerald-50/80 border-2 border-emerald-400 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in">
                <div className="flex items-center gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-md">
                    <span className="material-symbols-outlined text-2xl">verified</span>
                  </div>
                  <div>
                    <span className="font-label-sm text-xs font-bold text-emerald-700 uppercase tracking-wider block">
                      File Active Épurée
                    </span>
                    <h4 className="font-headline-sm text-base font-bold text-emerald-950">
                      Aucun ordre de réparation actif dans votre baie
                    </h4>
                    <p className="font-body-sm text-xs text-emerald-800 mt-0.5">
                      Tous les véhicules assignés sont traités ou archivés. Vous pouvez consulter l'historique du jour ci-dessous.
                    </p>
                  </div>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-200 text-emerald-900 font-label-sm text-xs font-bold uppercase shrink-0">
                  0 Ordre en cours
                </span>
              </div>
            )}

            {/* Carte Intervention Active Sportage (si non achevée et non supprimée) */}
            {!isSportageCompleted && !isSportageDismissed && (
              <article className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 shadow-md flex flex-col gap-4 relative overflow-hidden border border-surface-container-high">
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-secondary" />
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3.5">
                    <div className="w-24 h-16 rounded-xl overflow-hidden relative bg-surface-container-high shrink-0 shadow-sm border border-surface-container-high">
                      <img
                        className="w-full h-full object-cover"
                        src="/images/kia/sportage.jpg"
                        alt="Sportage"
                      />
                      <span className="absolute bottom-1 right-1 bg-primary text-on-primary font-label-sm text-[9px] px-1 rounded uppercase">
                        GT-Line
                      </span>
                    </div>
                    <div className="flex flex-col">
                      <div className="flex items-center gap-2">
                        <span className="font-label-lg text-sm text-primary font-bold font-mono">235 TU 8812</span>
                        <span className="text-outline-variant">•</span>
                        <span className="font-headline-sm text-base font-bold text-on-surface">
                          Kia Sportage GT-Line 1.6 T-GDi
                        </span>
                      </div>
                      <div className="flex items-center gap-3 font-label-sm text-xs text-outline mt-1 font-mono">
                        <span>OR : <strong className="text-secondary">#OR-2026-9104</strong></span>
                        <span>|</span>
                        <span>Client : <strong className="text-on-surface">M. Aziz Masghouni</strong></span>
                        <span>|</span>
                        <span>KM : <strong>18 420 km</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary text-on-secondary font-label-md text-xs font-bold tracking-wider uppercase shadow-sm">
                      <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                      Étape 0{liveProgress?.currentStep || 1} / 04 ({liveProgress?.progressPercent || 25}%)
                    </div>
                    <span className="font-label-sm text-[10px] text-outline font-mono">
                      Pont ciseaux #04
                    </span>
                  </div>
                </div>

                {/* Prestations */}
                <div className="bg-surface-container-low rounded-xl p-3.5 flex flex-col gap-2 border border-surface-container-high">
                  <span className="font-label-sm text-[10px] text-outline uppercase font-semibold">
                    Prestations en cours d'exécution :
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                    <div className="flex items-center gap-1.5 bg-surface-container-lowest p-2 rounded-lg shadow-sm border border-surface-container-high">
                      <span className="material-symbols-outlined text-sm text-emerald-600 fill">check_circle</span>
                      <span className="font-medium text-on-surface truncate">Vidange & Filtres OEM (Fait)</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-surface-container-lowest p-2 rounded-lg shadow-sm border border-secondary/30">
                      <span className="material-symbols-outlined text-sm text-secondary animate-spin">progress_activity</span>
                      <span className="font-bold text-on-surface truncate">Plaquettes Avant (Validé)</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-surface-container-lowest p-2 rounded-lg shadow-sm border border-surface-container-high opacity-75">
                      <span className="material-symbols-outlined text-sm text-outline">radio_button_unchecked</span>
                      <span className="text-on-surface-variant truncate">Diagnostic KDS & Essai</span>
                    </div>
                  </div>
                </div>

                {/* Progress bar & Bouton Reprendre / Supprimer */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-surface-container-high/60 p-3.5 rounded-xl border border-surface-container-high">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between font-label-sm text-xs mb-1">
                      <span className="text-on-surface font-semibold flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm text-secondary">pace</span>
                        Chronomètre synchronisé en temps réel
                      </span>
                      <span className="font-label-md text-xs text-secondary font-bold font-mono">
                        Étape 0{liveProgress?.currentStep || 1} sur 4
                      </span>
                    </div>
                    <div className="w-full bg-surface-container-highest h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-secondary h-full rounded-full transition-all duration-500"
                        style={{ width: `${liveProgress?.progressPercent || 25}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() =>
                        setOrderToDelete({
                          id: '#OR-2026-9104',
                          plate: '235 TU 8812',
                          vehicleName: 'Kia Sportage GT-Line 1.6 T-GDi',
                          isCompleted: false,
                        })
                      }
                      className="px-3 py-2.5 rounded-xl bg-surface-container hover:bg-rose-50 text-rose-600 hover:text-rose-700 font-label-md text-xs font-semibold transition-all border border-surface-container-high hover:border-rose-200 flex items-center gap-1.5 active:scale-95"
                      title="Supprimer manuellement cet ordre actif"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                      <span>Supprimer</span>
                    </button>

                    <button
                      onClick={onNavigateToActive}
                      className="px-5 py-2.5 bg-secondary text-on-secondary rounded-xl font-label-md text-xs font-bold uppercase tracking-wider hover:bg-secondary-container transition-all flex items-center gap-1.5 shadow-sm active:scale-95 shrink-0"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-base">play_circle</span>
                      <span>Reprendre l'Intervention</span>
                    </button>
                  </div>
                </div>
              </article>
            )}

            {/* Sorento HEV (En attente pièces) */}
            {(filter === 'all' || filter === 'waiting') && !isSorentoDismissed && (
              <article className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-3 relative overflow-hidden border border-surface-container-high">
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-amber-500" />
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-20 h-14 rounded-xl overflow-hidden relative bg-surface-container-high shrink-0 shadow-sm border border-surface-container-high">
                      <img
                        className="w-full h-full object-cover"
                        src="/images/kia/sorento.png"
                        alt="Sorento"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-label-lg text-sm text-primary font-bold font-mono">235 TU 1189</span>
                        <span className="text-outline-variant">•</span>
                        <span className="font-headline-sm text-sm font-bold text-on-surface">Kia Sorento HEV</span>
                      </div>
                      <p className="font-label-sm text-xs text-outline mt-0.5">
                        Bras de suspension gauche inférieur + Géométrie (Pièce attendue à 14h00)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 font-label-md text-[11px] font-bold uppercase">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                      Attente Pièce Magasin
                    </span>
                    <button
                      onClick={() =>
                        setOrderToDelete({
                          id: '#CC-2024-9100',
                          plate: '235 TU 1189',
                          vehicleName: 'Kia Sorento HEV',
                          isCompleted: false,
                        })
                      }
                      className="p-1.5 rounded-lg bg-surface-container hover:bg-rose-50 text-rose-600 hover:text-rose-700 transition-colors border border-surface-container-high hover:border-rose-200"
                      title="Supprimer cet ordre"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  </div>
                </div>
              </article>
            )}

            {/* EV6 AWD (À venir) */}
            {(filter === 'all' || filter === 'upcoming') && !isEv6Dismissed && (
              <article className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-3 relative overflow-hidden border border-surface-container-high">
                <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-outline-variant" />
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-20 h-14 rounded-xl overflow-hidden relative bg-surface-container-high shrink-0 shadow-sm border border-surface-container-high">
                      <img
                        className="w-full h-full object-cover"
                        src="/images/kia/ev6.jpg"
                        alt="EV6"
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-label-lg text-sm text-primary font-bold font-mono">240 TU 9901</span>
                        <span className="text-outline-variant">•</span>
                        <span className="font-headline-sm text-sm font-bold text-on-surface">Kia EV6 AWD Long Range</span>
                      </div>
                      <p className="font-label-sm text-xs text-outline mt-0.5">
                        Mise à jour Campagne BMS Haute Tension & VCU (Baie #08)
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-high text-on-surface font-label-md text-[11px] font-bold uppercase">
                      Prêt au Check-in (15h30)
                    </span>
                    <button
                      onClick={() =>
                        setOrderToDelete({
                          id: '#CC-2024-9102',
                          plate: '240 TU 9901',
                          vehicleName: 'Kia EV6 AWD Long Range',
                          isCompleted: false,
                        })
                      }
                      className="p-1.5 rounded-lg bg-surface-container hover:bg-rose-50 text-rose-600 hover:text-rose-700 transition-colors border border-surface-container-high hover:border-rose-200"
                      title="Supprimer cet ordre"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                  </div>
                </div>
              </article>
            )}
          </section>

          {/* SECTION 2 : HISTORIQUE DES TRAVAUX TERMINÉS DU JOUR */}
          <section className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 shadow-sm border border-surface-container-high flex flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-container-high pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
                  <span className="material-symbols-outlined text-lg">history</span>
                </div>
                <div>
                  <h3 className="font-headline-sm text-base font-bold text-on-surface">
                    Historique des Travaux Terminés du Jour
                  </h3>
                  <p className="font-label-sm text-xs text-on-surface-variant">
                    Archivage automatique et gestion manuelle des ordres de réparation clôturés
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 font-label-sm text-xs font-bold">
                  {completedOrders.length} Véhicules Clôturés
                </span>
              </div>
            </div>

            {completedOrders.length === 0 ? (
              <div className="p-8 text-center bg-surface-container-low rounded-xl text-on-surface-variant text-sm">
                Aucune intervention dans l'historique pour le moment aujourd'hui.
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {completedOrders.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl bg-surface-container-low hover:bg-surface-container transition-colors border border-surface-container-high flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                  >
                    <div className="flex items-start gap-3.5">
                      <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                        <span className="material-symbols-outlined text-xl">verified</span>
                      </div>

                      <div className="flex flex-col gap-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-headline-sm text-sm font-bold text-on-surface">
                            {item.vehicleName}
                          </span>
                          <span className="font-label-sm text-xs px-2 py-0.5 rounded bg-surface-container-highest text-on-surface font-mono font-bold">
                            {item.plate}
                          </span>
                          <span className="font-label-sm text-[10px] text-secondary font-mono font-bold">
                            {item.id}
                          </span>
                        </div>

                        <p className="font-body-md text-xs text-on-surface font-medium">
                          {item.service}
                        </p>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-on-surface-variant font-label-sm text-[11px] pt-1">
                          <span>Client : <strong className="text-on-surface">{item.clientName}</strong></span>
                          <span>•</span>
                          <span>Clôturé à : <strong className="text-on-surface font-mono">{item.completedAt}</strong></span>
                          <span>•</span>
                          <span>
                            Durée : <strong className="text-secondary font-mono">{item.durationLabel}</strong> (Barème : {item.standardHours}h)
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto shrink-0 pt-2 md:pt-0 border-t md:border-t-0 border-surface-container-high">
                      <div className="flex flex-col md:items-end gap-1">
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-xs text-emerald-600 fill">task_alt</span>
                          <span className="font-label-sm text-[11px] text-emerald-800 font-bold uppercase">
                            Zéro Défaut Validé
                          </span>
                        </div>

                        {item.chefStatus === 'restituted' ? (
                          <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-900 font-label-sm text-xs font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                            Véhicule Réglé & Restitué
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-full bg-amber-100 text-amber-900 font-label-sm text-xs font-bold flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                            En Attente Restitution & Règlement Chef
                          </span>
                        )}
                      </div>

                      {/* Bouton de suppression manuelle de l'archive */}
                      <button
                        onClick={() =>
                          setOrderToDelete({
                            id: item.id,
                            plate: item.plate,
                            vehicleName: item.vehicleName,
                            isCompleted: true,
                          })
                        }
                        className="p-2 rounded-xl bg-surface-container hover:bg-rose-50 text-rose-600 hover:text-rose-700 transition-colors border border-surface-container-high hover:border-rose-200 flex items-center justify-center active:scale-95"
                        title="Supprimer manuellement de l'historique"
                        type="button"
                      >
                        <span className="material-symbols-outlined text-base">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Colonne Droite : Outillage KDS & Communication Chef (4 cols) */}
        <aside className="xl:col-span-4 flex flex-col gap-4">
          {/* Outillage KDS */}
          <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-3.5 border border-surface-container-high">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary text-lg">build</span>
                <h3 className="font-headline-sm text-sm sm:text-base font-bold text-on-surface">
                  État Outillage & Diagnostic
                </h3>
              </div>
              <span className="font-label-sm text-[10px] px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold uppercase">
                Opérationnel
              </span>
            </div>

            {/* Valise KDS */}
            <div className="p-3 rounded-xl bg-surface-container flex flex-col gap-1 border border-surface-container-high">
              <div className="flex items-center justify-between text-xs">
                <span className="font-label-md font-bold text-on-surface flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Valise Kia KDS v4 #09
                </span>
                <span className="font-label-sm font-mono text-outline">KDS-4-8891</span>
              </div>
              <div className="flex items-center justify-between font-label-sm text-[11px] text-on-surface-variant pt-1">
                <span className="flex items-center gap-1 text-emerald-700 font-medium">
                  <span className="material-symbols-outlined text-xs">wifi</span> Wi-Fi Baie 04 (Excellente)
                </span>
                <span className="flex items-center gap-1 font-semibold text-on-surface">
                  <span className="material-symbols-outlined text-xs text-emerald-600">battery_horiz_075</span> Batterie 85%
                </span>
              </div>
            </div>

            {/* Facom Wrench */}
            <div className="p-3 rounded-xl bg-surface-container flex flex-col gap-1 border border-surface-container-high">
              <div className="flex items-center justify-between text-xs">
                <span className="font-label-md font-bold text-on-surface flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-on-surface-variant">handyman</span>
                  Clé Dynamométrique Facom 40-200Nm
                </span>
              </div>
              <div className="flex items-center justify-between font-label-sm text-[11px] text-outline pt-1">
                <span>Étalonnage officiel : Valide</span>
                <span className="text-on-surface font-mono">Exp : 12/2026</span>
              </div>
            </div>
          </div>

          {/* Messages Chef d'Atelier */}
          <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col gap-3.5 border border-surface-container-high">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-lg">forum</span>
                <h3 className="font-headline-sm text-sm sm:text-base font-bold text-on-surface">
                  Direct Chef d'Atelier
                </h3>
              </div>
              <span className="w-2 h-2 rounded-full bg-secondary animate-ping" />
            </div>

            <div className="p-3.5 rounded-xl bg-secondary/5 flex flex-col gap-1.5 border border-secondary/20">
              <div className="flex items-center justify-between text-xs">
                <span className="font-label-md font-bold text-on-surface">M. Hédi Mansour</span>
                <span className="font-label-sm text-[10px] text-outline">En direct</span>
              </div>
              <p className="font-body-md text-xs text-on-surface leading-snug">
                « Karim, dès que tu clôtures l'Étape 4 sur le Sportage, la facture et la restitution sont immédiatement déclenchées au guichet. Beau travail sur la cadence. »
              </p>
              <div className="flex items-center gap-2 pt-1">
                {ackMessage ? (
                  <span className="font-label-sm text-[11px] text-emerald-700 font-bold flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs fill">check_circle</span>
                    Accusé transmis
                  </span>
                ) : (
                  <button
                    onClick={() => setAckMessage(true)}
                    className="px-2.5 py-1 bg-secondary text-on-secondary rounded-lg font-label-sm text-[11px] font-semibold hover:bg-secondary-container transition-colors shadow-sm"
                    type="button"
                  >
                    Accusé de réception
                  </button>
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* MODAL DE CONFIRMATION DE SUPPRESSION MANUELLE */}
      {orderToDelete && (
        <div className="fixed inset-0 z-50 bg-[#05141f]/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-surface-container-lowest rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-2xl border-2 border-rose-500/40 animate-in zoom-in-95 flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">delete_forever</span>
              </div>
              <div>
                <span className="font-label-sm text-xs font-bold text-rose-600 uppercase tracking-wider block">
                  Suppression Manuelle
                </span>
                <h3 className="font-headline-sm text-base sm:text-lg font-bold text-on-surface">
                  Supprimer l'ordre de réparation ?
                </h3>
              </div>
            </div>

            <div className="p-4 bg-surface-container-low rounded-2xl border border-surface-container-high flex flex-col gap-1 text-xs">
              <div className="flex items-center justify-between font-mono font-bold text-on-surface">
                <span>{orderToDelete.id}</span>
                <span className="text-secondary">{orderToDelete.plate}</span>
              </div>
              <p className="font-semibold text-on-surface mt-0.5">{orderToDelete.vehicleName}</p>
              <p className="text-on-surface-variant text-[11px] mt-1">
                {orderToDelete.isCompleted
                  ? 'Cet ordre sera définitivement retiré de votre historique des travaux terminés du jour.'
                  : 'Cet ordre sera immédiatement retiré de vos travaux actifs et libéré de votre baie de travail.'}
              </p>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                onClick={() => setOrderToDelete(null)}
                className="px-4 py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-xs font-semibold transition-colors"
                type="button"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmDelete}
                className="px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-label-md text-xs font-bold shadow-md transition-all active:scale-95 flex items-center gap-1.5"
                type="button"
              >
                <span className="material-symbols-outlined text-base">delete</span>
                <span>Confirmer la suppression</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
