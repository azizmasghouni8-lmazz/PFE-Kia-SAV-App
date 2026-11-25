import { useState, useMemo, useEffect } from 'react';
import { getDailyWorkshopData, DailyTimelineItem } from '../../services/workshopDayService';
import { workshopSyncService, ClientAppointment } from '../../services/workshopSyncService';
import { compteService } from '../../services/compteService';
import { ChefLongTermCalendar } from './ChefLongTermCalendar';

interface PlanningDashboardProps {
  onNavigateToCheckin: () => void;
  onNavigateToOrders: () => void;
  onNavigateToRestitution?: () => void;
}

export function PlanningDashboard({ onNavigateToCheckin, onNavigateToOrders, onNavigateToRestitution }: PlanningDashboardProps) {
  // Date dynamique initialisée au jour réel de connexion
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [viewMode, setViewMode] = useState<'all' | 'calendar' | 'daily'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'arrived' | 'in_progress' | 'ready'>('all');
  const [periodFilter, setPeriodFilter] = useState<'all' | 'morning' | 'evening'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [bayFilter, setBayFilter] = useState<'all' | 'meca' | 'ev'>('all');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [syncTick, setSyncTick] = useState(0);
  const [pendingRequestsCount, setPendingRequestsCount] = useState<number>(() =>
    workshopSyncService.getChefRequests().filter((r) => r.status === 'PENDING').length
  );

  // Données dynamiques calculées pour la date sélectionnée + config atelier live
  const dailyData = useMemo(() => {
    return getDailyWorkshopData(selectedDate);
  }, [selectedDate, syncTick]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Navigation jour par jour
  const handlePrevDay = () => {
    const nextD = new Date(selectedDate);
    nextD.setDate(selectedDate.getDate() - 1);
    setSelectedDate(nextD);
    showToast(`Chargement de l'atelier pour le ${nextD.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}`);
  };

  const handleNextDay = () => {
    const nextD = new Date(selectedDate);
    nextD.setDate(selectedDate.getDate() + 1);
    setSelectedDate(nextD);
    showToast(`Chargement de l'atelier pour le ${nextD.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}`);
  };

  const handleResetToday = () => {
    const today = new Date();
    setSelectedDate(today);
    showToast("Retour à la supervision en direct d'Aujourd'hui");
  };

  const handleDateInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.value) return;
    const [year, month, day] = e.target.value.split('-').map(Number);
    const newDate = new Date(year, month - 1, day);
    setSelectedDate(newDate);
    showToast(`Supervision fixée au ${newDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`);
  };

  // Écoute de l'événement de mise à jour du planning, équipe, ponts, paramètres et demandes Assistance
  useEffect(() => {
    const handleSync = () => {
      setSyncTick((t) => t + 1);
      setPendingRequestsCount(
        workshopSyncService.getChefRequests().filter((r) => r.status === 'PENDING').length
      );
    };
    window.addEventListener('k_dms_planning_updated', handleSync);
    window.addEventListener('k_dms_chef_requests_updated', handleSync);
    window.addEventListener('k_dms_chef_notifications_updated', handleSync);
    window.addEventListener('k_dms_quotes_updated', handleSync);
    window.addEventListener('k_dms_orders_updated', handleSync);
    window.addEventListener('k_dms_team_updated', handleSync);
    window.addEventListener('k_dms_bays_updated', handleSync);
    window.addEventListener('k_dms_settings_updated', handleSync);
    window.addEventListener('k_dms_parts_updated', handleSync);
    const interval = setInterval(handleSync, 1500);
    return () => {
      window.removeEventListener('k_dms_planning_updated', handleSync);
      window.removeEventListener('k_dms_chef_requests_updated', handleSync);
      window.removeEventListener('k_dms_chef_notifications_updated', handleSync);
      window.removeEventListener('k_dms_quotes_updated', handleSync);
      window.removeEventListener('k_dms_orders_updated', handleSync);
      window.removeEventListener('k_dms_team_updated', handleSync);
      window.removeEventListener('k_dms_bays_updated', handleSync);
      window.removeEventListener('k_dms_settings_updated', handleSync);
      window.removeEventListener('k_dms_parts_updated', handleSync);
      clearInterval(interval);
    };
  }, []);

  // Rendez-vous actifs (hors clôturés, refusés, annulés)
  const clientAppointments = useMemo(() => {
    return workshopSyncService.getAppointments().filter((app) => {
      if (app.status === 'completed' || app.status === 'rejected' || app.status === 'cancelled') return false;
      if (workshopSyncService.isCheckedOut({ id: app.id })) return false;
      return true;
    });
  }, [selectedDate, toastMessage, syncTick]);

  const pendingConfirmationAppts = useMemo(() => {
    return clientAppointments.filter(
      (app) => app.source !== 'chef_long_term' && (app.chefDecision || 'pending') === 'pending'
    );
  }, [clientAppointments]);

  const chefNotifications = useMemo(() => {
    return workshopSyncService.getChefNotifications();
  }, [syncTick]);

  const unreadChefNotifications = chefNotifications.filter((n) => !n.read);

  // Fusionner les rendez-vous clients avec la timeline du jour (matin + après-midi/soir), triés par heure
  const mergedTimeline = useMemo(() => {
    const bookedForDate = clientAppointments
      .filter((app) => app.dateStr === dailyData.dateIsoString)
      .map((app): DailyTimelineItem => {
        const compte = app.clientPhone ? undefined : compteService.trouverCompteParIdentifiant(app.plate);
        return {
          id: app.id,
          time: app.time || '08:30',
          bay: 'Pont 01 (Réception)',
          vehicleName: app.vehicleName,
          plate: app.plate,
          status: app.status === 'checked_in' ? 'in_progress' : 'arrived',
          statusBadge:
            app.status === 'checked_in'
              ? 'CHECK-IN EFFECTUÉ · EN ATELIER'
              : app.source === 'chef_long_term'
              ? 'RDV LONG TERME PLANIFIÉ · CHEF'
              : (app.chefDecision || 'pending') === 'pending'
              ? 'NOUVEAU RDV · ATTENTE RÉPONSE CHEF'
              : 'RDV CONFIRMÉ CHEF · PRÊT CHECK-IN',
          badgeColor: 'secondary',
          clientName: app.clientName,
          clientPhone: app.clientPhone || compte?.telephone,
          service: app.serviceName,
          advisorOrTech:
            app.source === 'chef_long_term'
              ? 'Planifié Chef d’Atelier'
              : (app.chefDecision || 'pending') === 'pending'
              ? 'À confirmer par le Chef'
              : 'Confirmé · Réservation en Ligne',
          price: app.price,
          actionType: app.status === 'checked_in' ? 'view_or' : 'checkin',
        };
      });

    const activeDailyTimeline = dailyData.timeline.filter((item) => {
      if (
        workshopSyncService.isCheckedOut({ id: `${dailyData.dateIsoString}:${item.id}` }) ||
        workshopSyncService.isCheckedOut({ id: item.id })
      ) {
        return false;
      }
      return true;
    });

    return [...bookedForDate, ...activeDailyTimeline].sort((a, b) =>
      (a.time || '').localeCompare(b.time || '')
    );
  }, [dailyData.timeline, dailyData.dateIsoString, clientAppointments, syncTick]);

  const isEveningSlot = (timeStr: string) => {
    const hour = parseInt((timeStr || '08:00').split(':')[0], 10);
    return !Number.isNaN(hour) && hour >= 13;
  };

  // Compteurs matin / après-midi-soir
  const morningCount = useMemo(
    () => mergedTimeline.filter((item) => !isEveningSlot(item.time)).length,
    [mergedTimeline]
  );
  const eveningCount = useMemo(
    () => mergedTimeline.filter((item) => isEveningSlot(item.time)).length,
    [mergedTimeline]
  );

  // Filtrage de la file d'attente (statut, baie, période matin/soir et recherche nom/téléphone)
  const filteredTimeline = useMemo(() => {
    let list = mergedTimeline;

    // Filtre statut
    if (statusFilter !== 'all') {
      list = list.filter((item) => {
        if (statusFilter === 'arrived') return item.status === 'arrived';
        if (statusFilter === 'in_progress') return item.status === 'in_progress';
        if (statusFilter === 'ready') return item.status === 'ready';
        return true;
      });
    }

    // Filtre période (Matin vs Après-midi/Soir)
    if (periodFilter === 'morning') {
      list = list.filter((item) => !isEveningSlot(item.time));
    } else if (periodFilter === 'evening') {
      list = list.filter((item) => isEveningSlot(item.time));
    }

    // Filtre type de baie
    if (bayFilter === 'meca') {
      list = list.filter((item) => !item.vehicleName.toLowerCase().includes('ev'));
    } else if (bayFilter === 'ev') {
      list = list.filter((item) => item.vehicleName.toLowerCase().includes('ev') || item.vehicleName.toLowerCase().includes('hev'));
    }

    // Barre de recherche par nom du client ou numéro de téléphone (et plaque)
    const rawQuery = searchQuery.trim().toLowerCase();
    if (rawQuery) {
      const compactQuery = rawQuery.replace(/\s+/g, '');
      list = list.filter((item) => {
        const nameMatch = (item.clientName || '').toLowerCase().includes(rawQuery);
        const phoneRaw = (item.clientPhone || '').toLowerCase();
        const phoneCompact = phoneRaw.replace(/\s+/g, '');
        const phoneMatch = phoneRaw.includes(rawQuery) || (compactQuery.length > 0 && phoneCompact.includes(compactQuery));
        const plateMatch = (item.plate || '').toLowerCase().replace(/\s+/g, '').includes(compactQuery);
        return nameMatch || phoneMatch || plateMatch;
      });
    }

    return list;
  }, [mergedTimeline, statusFilter, periodFilter, bayFilter, searchQuery]);

  // Lancer le check-in en préremplissant le véhicule sélectionné
  const handleStartCheckin = (item: DailyTimelineItem) => {
    const matchingApp = clientAppointments.find(
      (a) =>
        a.id === item.id ||
        (a.plate && a.plate.replace(/\s/g, '').toLowerCase() === item.plate.replace(/\s/g, '').toLowerCase())
    );
    if (matchingApp) {
      workshopSyncService.setPendingCheckin(matchingApp);
    } else {
      const compte = compteService.trouverCompteParIdentifiant(item.plate);
      workshopSyncService.setPendingCheckin({
        id: item.id,
        clientName: item.clientName,
        clientEmail: compte?.email,
        clientPhone: compte?.telephone,
        clientId: compte?.id,
        vehicleName: item.vehicleName,
        plate: item.plate,
        vin: compte?.vin,
        serviceName: item.service,
        price: item.price || '420 DT',
        dateStr: dailyData.dateIsoString,
        formattedDate: dailyData.formattedDateFull,
        time: item.time,
        createdAt: new Date().toISOString(),
        status: 'booked',
      });
    }
    onNavigateToCheckin();
  };

  // Compteurs statuts synchronisés
  const arrivedCount = mergedTimeline.filter((i) => i.status === 'arrived').length;
  const inProgressCount = mergedTimeline.filter((i) => i.status === 'in_progress').length;
  const readyCount = mergedTimeline.filter((i) => i.status === 'ready').length;
  const totalRdvCount = mergedTimeline.length;

  return (
    <div className="w-full flex flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-[1720px] mx-auto">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 right-8 z-50 bg-[#05141f] text-white p-4 rounded-xl shadow-2xl flex items-center gap-3 border border-secondary animate-bounce">
          <span className="material-symbols-outlined text-secondary">info</span>
          <div>
            <p className="font-bold text-sm">Notification K-DMS</p>
            <p className="text-xs text-[#778694]">{toastMessage}</p>
          </div>
        </div>
      )}

      {/* Top Header & Actions */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="font-label-sm text-xs uppercase tracking-widest text-secondary font-bold">
              K-DMS • Live Terminal
            </span>
            <span className="text-outline-variant font-label-sm">•</span>
            <span className="font-label-sm text-xs text-on-surface-variant font-medium">
              Poste d'Ordonnancement #01 — Chef d'Atelier
            </span>
            <span className="text-outline-variant font-label-sm">•</span>
            <span className="inline-flex items-center gap-1 font-mono text-[11px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />
              Direct
            </span>
          </div>
          <h1 className="font-headline-lg text-2xl sm:text-3xl text-on-surface font-bold tracking-tight">
            Planning Journalier & Pilotage Atelier
          </h1>
          <p className="font-body-md text-xs sm:text-sm text-on-surface-variant flex items-center gap-2">
            <span>Atelier Central City Cars La Goulette</span>
            <span>•</span>
            <span className="font-medium text-secondary">CA Estimé Jour: {dailyData.kpis.caPrevisionnel}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Interactive Date Picker & Day-to-Day Navigation */}
          <div className="flex items-center bg-surface-container-low p-1 rounded-xl shadow-sm border border-surface-container-high">
            <button
              onClick={handlePrevDay}
              className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors active:scale-95"
              title="Jour précédent"
              type="button"
            >
              <span className="material-symbols-outlined text-sm">chevron_left</span>
            </button>

            <div className="relative flex items-center gap-1.5 px-3 cursor-pointer group">
              <span className="material-symbols-outlined text-sm text-secondary">calendar_today</span>
              <span className="font-label-md text-xs sm:text-sm text-on-surface font-bold tracking-tight">
                {dailyData.formattedHeaderLabel}
              </span>
              <span className="material-symbols-outlined text-xs text-on-surface-variant opacity-60 group-hover:opacity-100">
                arrow_drop_down
              </span>
              {/* Native Date Input overlay for easy picking */}
              <input
                type="date"
                value={dailyData.dateIsoString}
                onChange={handleDateInputChange}
                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                title="Choisir une date sur le calendrier"
              />
            </div>

            <button
              onClick={handleNextDay}
              className="p-2 text-on-surface-variant hover:text-on-surface hover:bg-surface-container rounded-lg transition-colors active:scale-95"
              title="Jour suivant"
              type="button"
            >
              <span className="material-symbols-outlined text-sm">chevron_right</span>
            </button>
          </div>

          {/* Quick Return to Today button if navigated away */}
          {!dailyData.isToday && (
            <button
              onClick={handleResetToday}
              className="px-3 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-secondary font-label-sm text-xs font-bold transition-all flex items-center gap-1 border border-surface-container-high shadow-sm"
              type="button"
              title="Revenir au jour actuel"
            >
              <span className="material-symbols-outlined text-sm">today</span>
              <span>Aujourd'hui</span>
            </button>
          )}

          {/* Bay Filter */}
          <div className="inline-flex bg-surface-container-low p-1 rounded-xl shadow-sm border border-surface-container-high">
            <button
              onClick={() => setBayFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-label-sm text-xs font-medium transition-all ${
                bayFilter === 'all'
                  ? 'bg-primary text-on-primary font-bold shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              type="button"
            >
              Tous Ponts ({dailyData.kpis.totalOpenPostsCount}/{dailyData.posts.length})
            </button>
            <button
              onClick={() => setBayFilter('meca')}
              className={`px-3 py-1.5 rounded-lg font-label-sm text-xs font-medium transition-all ${
                bayFilter === 'meca'
                  ? 'bg-primary text-on-primary font-bold shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              type="button"
            >
              Mécanique
            </button>
            <button
              onClick={() => setBayFilter('ev')}
              className={`px-3 py-1.5 rounded-lg font-label-sm text-xs font-medium transition-all ${
                bayFilter === 'ev'
                  ? 'bg-primary text-on-primary font-bold shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
              type="button"
            >
              Diag EV / Hybride
            </button>
          </div>

          {/* Primary CTA */}
          <button
            onClick={onNavigateToCheckin}
            className="flex items-center gap-1.5 bg-secondary hover:bg-secondary-container text-on-secondary px-4 py-2.5 rounded-xl font-headline-sm text-sm font-bold tracking-wide shadow-md hover:shadow-lg transition-all active:scale-95"
            type="button"
          >
            <span className="material-symbols-outlined text-lg">add_circle</span>
            <span>Nouveau Check-in Express</span>
          </button>
        </div>
      </div>

      {/* Dimanche / Jour Fermé par Paramètres Atelier Alert Banner */}
      {(dailyData.isSunday || dailyData.isClosedBySettings) && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 flex items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-2xl text-amber-600">bedtime</span>
            <div>
              <span className="font-bold text-sm block">
                {dailyData.isSunday
                  ? 'Atelier Central fermé le dimanche'
                  : dailyData.isSaturday
                  ? 'Samedi désactivé dans Paramètres Atelier'
                  : 'Journée marquée fermée (Jour férié / Fermeture exceptionnelle)'}
              </span>
              <p className="text-xs text-amber-800">
                Les créneaux de réservation en ligne sont bloqués pour cette date. Permanence d'astreinte City Cars Assistance active 24/7.
              </p>
            </div>
          </div>
          <button
            onClick={handleNextDay}
            className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-label-sm text-xs font-bold transition-colors whitespace-nowrap shrink-0"
            type="button"
          >
            Jour suivant
          </button>
        </div>
      )}

      {/* 5 KPIs Journaliers Dynamiques */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI 1 : RDV Programmés */}
        <div className="bg-surface-container-lowest p-4 rounded-2xl shadow-sm flex flex-col justify-between relative overflow-hidden border border-surface-container-high group">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
              RDV Programmés
            </span>
            <span className="p-1.5 rounded-lg bg-surface-container-low text-on-surface">
              <span className="material-symbols-outlined text-base">calendar_month</span>
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="font-headline-xl text-3xl font-bold text-on-surface">{totalRdvCount}</span>
            <span className="font-label-sm text-xs text-on-surface-variant">véhicules</span>
          </div>
          <div className="mt-3 pt-2 border-t border-surface-container flex items-center justify-between text-[11px] text-on-surface-variant font-mono">
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" /> {dailyData.kpis.rdvOk} ok
            </span>
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary" /> {dailyData.kpis.rdvArrives} arrivés
            </span>
            <span className="flex items-center gap-1 text-secondary font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-ping" /> {dailyData.kpis.rdvRetard} retard
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-surface-container-high group-hover:bg-primary transition-colors" />
        </div>

        {/* KPI 2 : Occupation Ponts */}
        <div className="bg-surface-container-lowest p-4 rounded-2xl shadow-sm flex flex-col justify-between relative overflow-hidden border border-surface-container-high group">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
              Occupation Ponts
            </span>
            <span className="p-1.5 rounded-lg bg-secondary-fixed text-on-secondary-fixed">
              <span className="material-symbols-outlined text-base">precision_manufacturing</span>
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="font-headline-xl text-3xl text-secondary font-bold tabular-nums">{dailyData.kpis.occupationRate}%</span>
            <span className="font-label-sm text-xs text-on-surface-variant tabular-nums">
              {dailyData.kpis.occupiedPostsCount} / {dailyData.kpis.totalOpenPostsCount} ponts ouverts
            </span>
          </div>
          <div className="mt-3 pt-2 border-t border-surface-container flex flex-col gap-1">
            <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden flex">
              <div
                className="bg-secondary h-full rounded-full transition-all duration-500"
                style={{ width: `${dailyData.kpis.occupationRate}%` }}
              />
            </div>
            <span className="font-label-sm text-[10px] text-on-surface-variant tabular-nums">
              {dailyData.kpis.totalOpenPostsCount === 0
                ? 'Atelier fermé / aucun pont ouvert'
                : dailyData.kpis.totalOpenPostsCount - dailyData.kpis.occupiedPostsCount > 0
                ? `${dailyData.kpis.totalOpenPostsCount - dailyData.kpis.occupiedPostsCount} pont(s) en réserve immédiate`
                : 'Pleine capacité atelier'}
            </span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-secondary" />
        </div>

        {/* KPI 3 : OR En Cours */}
        <div className="bg-surface-container-lowest p-4 rounded-2xl shadow-sm flex flex-col justify-between relative overflow-hidden border border-surface-container-high group">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
              OR En Cours
            </span>
            <span className="p-1.5 rounded-lg bg-primary-fixed text-on-primary-fixed">
              <span className="material-symbols-outlined text-base">build_circle</span>
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="font-headline-xl text-3xl font-bold text-on-surface">{dailyData.kpis.orEnCours}</span>
            <span className="font-label-sm text-xs text-on-surface-variant">travaux actifs</span>
          </div>
          <div className="mt-3 pt-2 border-t border-surface-container flex items-center gap-1.5 text-[11px] text-on-surface-variant">
            <span className="material-symbols-outlined text-sm text-secondary">timer</span>
            <span>Cadence: {dailyData.kpis.cadenceMoy}</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-surface-container-high group-hover:bg-primary transition-colors" />
        </div>

        {/* KPI 4 : Restitutions Jour */}
        <div className="bg-surface-container-lowest p-4 rounded-2xl shadow-sm flex flex-col justify-between relative overflow-hidden border border-surface-container-high group">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
              Restitutions Jour
            </span>
            <span className="p-1.5 rounded-lg bg-surface-container-low text-on-surface">
              <span className="material-symbols-outlined text-base">car_repair</span>
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="font-headline-xl text-3xl font-bold text-on-surface">{dailyData.kpis.restitutionsTotal}</span>
            <span className="font-label-sm text-xs text-on-surface-variant">programmées</span>
          </div>
          <div className="mt-3 pt-2 border-t border-surface-container flex items-center justify-between text-[11px] text-on-surface-variant">
            <span className="text-on-surface font-semibold">{dailyData.kpis.restitutionsPretes} prêtes</span>
            <span className="font-label-sm text-on-surface-variant">{dailyData.kpis.restitutionsLavage} lavage final</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-surface-container-high group-hover:bg-primary transition-colors" />
        </div>

        {/* KPI 5 : Respect Délais */}
        <div className="bg-surface-container-lowest p-4 rounded-2xl shadow-sm flex flex-col justify-between relative overflow-hidden border border-surface-container-high group">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
              Respect Délais
            </span>
            <span className="p-1.5 rounded-lg bg-surface-container-high text-on-surface">
              <span className="material-symbols-outlined text-base">speed</span>
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="font-headline-xl text-3xl font-bold text-on-surface">{dailyData.kpis.respectDelais}%</span>
            <span className="font-label-sm text-xs text-secondary font-bold">{dailyData.kpis.respectDelta}</span>
          </div>
          <div className="mt-3 pt-2 border-t border-surface-container flex items-center gap-1.5 text-[11px] text-on-surface-variant">
            <span className="material-symbols-outlined text-sm text-emerald-600 fill">check_circle</span>
            <span>Objectif Kia: &gt; 92%</span>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-surface-container-high group-hover:bg-secondary transition-colors" />
        </div>
      </div>

      {/* Alertes Notifications Clients (Modif / Annulation > 24h) & Demandes RDV à Confirmer par le Chef */}
      {(pendingConfirmationAppts.length > 0 || unreadChefNotifications.length > 0) && (
        <div className="bg-surface-container-lowest p-4 sm:p-5 rounded-2xl border-2 border-secondary/30 shadow-sm flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-surface-container-high">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-xl animate-pulse">
                notifications_active
              </span>
              <div>
                <h2 className="font-headline-sm text-sm sm:text-base font-bold text-on-surface">
                  Actions Requises Chef d'Atelier & Alertes Clients
                </h2>
                <p className="text-xs text-on-surface-variant">
                  {pendingConfirmationAppts.length} demande(s) de RDV en attente de votre réponse ·{' '}
                  {unreadChefNotifications.length} notification(s) de modification / annulation
                </p>
              </div>
            </div>

            {unreadChefNotifications.length > 0 && (
              <button
                type="button"
                onClick={() => workshopSyncService.markAllChefNotificationsRead()}
                className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-xs font-semibold text-on-surface transition-colors"
              >
                Tout marquer comme lu
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {pendingConfirmationAppts.map((appt) => (
              <div
                key={appt.id}
                className="p-3.5 rounded-xl bg-amber-50 border border-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex flex-col gap-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-200 text-amber-950">
                      Attente réponse Chef
                    </span>
                    <span className="font-mono text-xs font-bold text-primary">{appt.plate}</span>
                    <span className="text-xs font-bold text-on-surface">{appt.clientName}</span>
                  </div>
                  <span className="text-xs text-amber-950 font-medium">
                    {appt.formattedDate} à <strong className="font-mono">{appt.time}</strong> · {appt.serviceName}
                  </span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      workshopSyncService.confirmAppointmentByChef(appt.id);
                      showToast(`RDV de ${appt.clientName} (${appt.plate}) confirmé !`);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-sm">check</span>
                    <span>Confirmer</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      workshopSyncService.rejectAppointmentByChef(appt.id);
                      showToast(`RDV de ${appt.clientName} refusé — client autorisé à choisir un autre créneau.`);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-900 text-xs font-bold flex items-center gap-1"
                  >
                    <span className="material-symbols-outlined text-sm">close</span>
                    <span>Refuser</span>
                  </button>
                </div>
              </div>
            ))}

            {unreadChefNotifications.slice(0, 6).map((notif) => (
              <div
                key={notif.id}
                className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 ${
                  notif.type === 'rdv_cancelled'
                    ? 'bg-rose-50 border-rose-200 text-rose-950'
                    : notif.type === 'rdv_modified'
                    ? 'bg-blue-50 border-blue-200 text-blue-950'
                    : 'bg-surface-container-low border-surface-container-high text-on-surface'
                }`}
              >
                <div className="flex items-start gap-2.5 min-w-0">
                  <span className="material-symbols-outlined text-lg shrink-0 mt-0.5">
                    {notif.type === 'rdv_cancelled'
                      ? 'event_busy'
                      : notif.type === 'rdv_modified'
                      ? 'edit_calendar'
                      : 'event_available'}
                  </span>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold">{notif.title}</span>
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/80 font-semibold">
                        {notif.plate}
                      </span>
                    </div>
                    <p className="text-[11px] leading-snug opacity-90">{notif.message}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => workshopSyncService.markChefNotificationRead(notif.id)}
                  className="text-[11px] font-bold px-2 py-1 rounded bg-white/80 hover:bg-white border border-black/10 shrink-0"
                >
                  Lu
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sélecteur de vue Chef : Vue Complète / Grand Calendrier Long Terme / Planning Jour */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-surface-container-lowest p-3 rounded-2xl border border-surface-container-high shadow-sm">
        <div className="inline-flex flex-wrap bg-surface-container-low p-1 rounded-xl border border-surface-container-high gap-1">
          <button
            type="button"
            onClick={() => setViewMode('all')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              viewMode === 'all'
                ? 'bg-primary text-white shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-sm">dashboard</span>
            <span>Vue Complète (Calendrier + Jour)</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('calendar')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              viewMode === 'calendar'
                ? 'bg-secondary text-white shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-sm">calendar_month</span>
            <span>Grand Calendrier Long Terme</span>
            {pendingRequestsCount > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-amber-400 text-[#05141f] font-mono tabular-nums text-[10px] font-bold">
                {pendingRequestsCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setViewMode('daily')}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
              viewMode === 'daily'
                ? 'bg-primary text-white shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-sm">view_timeline</span>
            <span>File & Ponts ({dailyData.kpis.totalOpenPostsCount}/{dailyData.posts.length})</span>
          </button>
        </div>

        <span className="text-xs text-on-surface-variant font-medium px-2">
          Calendrier long terme réservé à la session Chef d'Atelier · Synchronisé Firestore
        </span>
      </div>

      {/* Grand Calendrier Mensuel Interactif Long Terme (Exclusif Session Chef) */}
      {(viewMode === 'all' || viewMode === 'calendar') && (
        <ChefLongTermCalendar
          selectedDate={selectedDate}
          onSelectDate={(d) => setSelectedDate(d)}
          onLaunchCheckinFromAppointment={(appt: ClientAppointment) => {
            workshopSyncService.setPendingCheckin(appt);
            onNavigateToCheckin();
          }}
          onNotify={showToast}
        />
      )}

      {/* Main 2-Column: Timeline (8 cols) & Supervision (4 cols) */}
      {(viewMode === 'all' || viewMode === 'daily') && (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {/* Quick status, period & search bar (Nom & Téléphone) */}
          <div className="bg-surface-container-lowest p-4 rounded-2xl shadow-sm flex flex-col gap-3 border border-surface-container-high">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`px-3 py-1.5 rounded-lg font-label-sm text-xs font-semibold shadow-sm transition-all whitespace-nowrap shrink-0 ${
                    statusFilter === 'all'
                      ? 'bg-primary text-on-primary'
                      : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                  }`}
                  type="button"
                >
                  Tous ({mergedTimeline.length})
                </button>
                <button
                  onClick={() => setStatusFilter('arrived')}
                  className={`px-3 py-1.5 rounded-lg font-label-sm text-xs font-medium transition-all flex items-center gap-1 whitespace-nowrap shrink-0 ${
                    statusFilter === 'arrived'
                      ? 'bg-primary text-on-primary font-bold'
                      : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                  }`}
                  type="button"
                >
                  En attente réception ({arrivedCount})
                </button>
                <button
                  onClick={() => setStatusFilter('in_progress')}
                  className={`px-3 py-1.5 rounded-lg font-label-sm text-xs font-medium transition-all flex items-center gap-1 whitespace-nowrap shrink-0 ${
                    statusFilter === 'in_progress'
                      ? 'bg-primary text-on-primary font-bold'
                      : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                  }`}
                  type="button"
                >
                  En cours atelier ({inProgressCount})
                </button>
                <button
                  onClick={() => setStatusFilter('ready')}
                  className={`px-3 py-1.5 rounded-lg font-label-sm text-xs font-medium transition-all flex items-center gap-1 whitespace-nowrap shrink-0 ${
                    statusFilter === 'ready'
                      ? 'bg-primary text-on-primary font-bold'
                      : 'bg-surface-container text-on-surface hover:bg-surface-container-high'
                  }`}
                  type="button"
                >
                  Prêts à livrer ({readyCount})
                </button>
              </div>

              {/* Filtre Matin / Après-midi & Soir */}
              <div className="inline-flex bg-surface-container-low p-1 rounded-xl border border-surface-container-high gap-1">
                <button
                  type="button"
                  onClick={() => setPeriodFilter('all')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                    periodFilter === 'all'
                      ? 'bg-primary text-white shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  Matin & Soir ({mergedTimeline.length})
                </button>
                <button
                  type="button"
                  onClick={() => setPeriodFilter('morning')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 flex items-center gap-1 ${
                    periodFilter === 'morning'
                      ? 'bg-secondary text-white shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-xs">wb_sunny</span>
                  <span>Matin ({morningCount})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPeriodFilter('evening')}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 flex items-center gap-1 ${
                    periodFilter === 'evening'
                      ? 'bg-secondary text-white shadow-sm'
                      : 'text-on-surface-variant hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-xs">wb_twilight</span>
                  <span>Après-midi / Soir ({eveningCount})</span>
                </button>
              </div>
            </div>

            {/* Barre de recherche par nom du client et téléphone */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-surface-container-high">
              <div className="relative flex-1">
                <span className="material-symbols-outlined text-base text-on-surface-variant absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  search
                </span>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher un RDV par nom du client ou téléphone (ex: Sami, Aziz, 98 400...)"
                  className="w-full pl-9 pr-9 py-2 rounded-xl bg-surface-container-low border border-surface-container-high text-xs sm:text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-secondary/50"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface p-0.5"
                    title="Effacer la recherche"
                  >
                    <span className="material-symbols-outlined text-base">close</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5 text-on-surface-variant font-label-sm text-xs font-mono tabular-nums shrink-0">
                <span className="material-symbols-outlined text-sm text-emerald-600">sync</span>
                <span>{filteredTimeline.length} / {mergedTimeline.length} RDV affichés</span>
              </div>
            </div>
          </div>

          {/* Operational Timeline Queue */}
          <div className="bg-surface-container-lowest rounded-2xl shadow-sm p-4 sm:p-5 flex flex-col gap-3.5 border border-surface-container-high">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-high flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-xl">view_timeline</span>
                <span className="font-headline-sm text-base font-bold text-on-surface">
                  File Opérationnelle du {dailyData.formattedDateFull}
                </span>
              </div>
              <span className="font-label-sm text-xs text-on-surface-variant font-mono tabular-nums">
                {dailyData.isSunday || dailyData.isClosedBySettings
                  ? 'Atelier Fermé'
                  : `${mergedTimeline.length} RDV (Matin : ${morningCount} · Après-midi / Soir : ${eveningCount})`}
              </span>
            </div>

            {/* Sunday / Closed empty state */}
            {(dailyData.isSunday || dailyData.isClosedBySettings) && (
              <div className="py-12 px-4 text-center flex flex-col items-center justify-center gap-2">
                <span className="material-symbols-outlined text-4xl text-on-surface-variant/40">bedtime</span>
                <p className="font-headline-sm text-base font-bold text-on-surface">
                  {dailyData.isSunday
                    ? 'Aucune opération programmée le dimanche'
                    : 'Atelier fermé à cette date (Paramètres Atelier)'}
                </p>
                <p className="font-body-sm text-xs text-on-surface-variant max-w-md">
                  L'équipe de l'atelier central La Goulette est au repos pour cette journée.
                </p>
                <button
                  onClick={handleNextDay}
                  className="mt-2 px-4 py-2 bg-secondary text-on-secondary rounded-xl font-label-md text-xs font-bold shadow-sm"
                  type="button"
                >
                  Basculer sur le jour suivant
                </button>
              </div>
            )}

            {/* Empty filter state */}
            {!dailyData.isSunday && !dailyData.isClosedBySettings && filteredTimeline.length === 0 && (
              <div className="py-8 text-center flex flex-col items-center gap-2 text-on-surface-variant text-xs font-medium">
                <span>Aucun rendez-vous ne correspond à votre recherche ou aux filtres sélectionnés pour cette journée.</span>
                {(searchQuery || statusFilter !== 'all' || periodFilter !== 'all') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setStatusFilter('all');
                      setPeriodFilter('all');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold"
                  >
                    Réinitialiser les filtres
                  </button>
                )}
              </div>
            )}

            {/* Dynamic timeline vehicles (Matin & Après-midi / Soir) */}
            {filteredTimeline.map((item: DailyTimelineItem, idx: number) => {
              const itemIsEvening = isEveningSlot(item.time);
              const prevIsEvening = idx > 0 ? isEveningSlot(filteredTimeline[idx - 1].time) : null;
              const showPeriodHeading =
                periodFilter === 'all' &&
                (idx === 0 || prevIsEvening !== itemIsEvening);

              return (
              <div key={item.id} className="flex flex-col gap-2">
                {showPeriodHeading && (
                  <div className="flex items-center justify-between pt-2 pb-1 border-b border-surface-container-high text-xs font-bold text-on-surface-variant">
                    <span className="flex items-center gap-1.5 text-on-surface">
                      <span className="material-symbols-outlined text-sm text-secondary">
                        {itemIsEvening ? 'wb_twilight' : 'wb_sunny'}
                      </span>
                      <span>
                        {itemIsEvening
                          ? 'Après-midi & Fin de journée / Soir (13:30 – 17:30)'
                          : 'Matinée (08:00 – 12:30)'}
                      </span>
                    </span>
                    <span className="font-mono tabular-nums text-[11px]">
                      {itemIsEvening
                        ? `${filteredTimeline.filter((i) => isEveningSlot(i.time)).length} RDV`
                        : `${filteredTimeline.filter((i) => !isEveningSlot(i.time)).length} RDV`}
                    </span>
                  </div>
                )}

              <div
                className="bg-surface-container-low hover:bg-surface-container p-4 rounded-xl transition-all shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden border border-surface-container-high"
              >
                <div className="flex items-start md:items-center gap-4">
                  <div className="flex flex-col items-center justify-center bg-surface-container-lowest px-3 py-1.5 rounded-lg min-w-[76px] shadow-sm border border-surface-container-high">
                    <span className="font-mono tabular-nums text-sm font-bold text-on-surface">{item.time}</span>
                    <span className="text-[10px] font-semibold text-on-surface-variant">
                      {itemIsEvening ? 'Soir / AM' : 'Matin'}
                    </span>
                    <span className="font-label-sm text-[10px] text-secondary font-semibold uppercase">{item.bay}</span>
                  </div>
                  <div className="flex flex-col">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-headline-sm text-sm sm:text-base font-bold text-on-surface">
                        {item.vehicleName}
                      </span>
                      <span className="font-label-sm text-xs bg-primary text-on-primary px-2 py-0.5 rounded font-mono font-bold tracking-wider">
                        {item.plate}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded font-label-sm text-[10px] font-bold ${
                          item.badgeColor === 'secondary'
                            ? 'bg-secondary-fixed text-on-secondary-fixed'
                            : item.badgeColor === 'emerald'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-surface-container-high text-on-surface'
                        }`}
                      >
                        {item.statusBadge}
                      </span>
                      {workshopSyncService.isVehicleWaitingParts(item.plate).waiting && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 font-label-sm text-[10px] font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
                          En attente pièce
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1 font-body-sm text-xs text-on-surface-variant">
                      <span className="font-semibold text-on-surface">{item.clientName}</span>
                      {item.clientPhone && (
                        <>
                          <span aria-hidden="true">·</span>
                          <a
                            href={`tel:${item.clientPhone.replace(/\s+/g, '')}`}
                            className="inline-flex items-center gap-1 font-mono tabular-nums font-semibold text-primary hover:text-secondary"
                            title="Appeler le client"
                          >
                            <span className="material-symbols-outlined text-xs">call</span>
                            {item.clientPhone}
                          </a>
                        </>
                      )}
                      <span aria-hidden="true">·</span>
                      <span>{item.service}</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-secondary font-semibold">{item.advisorOrTech}</span>
                      {item.price && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono font-bold text-on-surface">{item.price}</span>
                        </>
                      )}
                    </div>

                    {item.progressPercent !== undefined && (
                      <div className="w-full max-w-sm mt-1.5 flex items-center gap-2">
                        <div className="flex-1 bg-surface-container-high h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-primary h-full rounded-full transition-all"
                            style={{ width: `${item.progressPercent}%` }}
                          />
                        </div>
                        <span className="font-label-sm text-[10px] text-on-surface-variant">{item.remainingTime}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end md:self-center flex-wrap">
                  {(() => {
                    const matchedPending = pendingConfirmationAppts.find((a) => a.id === item.id);
                    if (!matchedPending) return null;
                    return (
                      <>
                        <button
                          type="button"
                          onClick={() => {
                            workshopSyncService.confirmAppointmentByChef(matchedPending.id);
                            showToast(`RDV de ${matchedPending.clientName} confirmé !`);
                          }}
                          className="px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-label-md text-xs font-bold rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                        >
                          <span className="material-symbols-outlined text-sm">check_circle</span>
                          <span>Confirmer RDV</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            workshopSyncService.rejectAppointmentByChef(matchedPending.id);
                            showToast(`RDV de ${matchedPending.clientName} refusé.`);
                          }}
                          className="px-3 py-2 bg-rose-100 hover:bg-rose-200 text-rose-900 font-label-md text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
                        >
                          <span className="material-symbols-outlined text-sm">cancel</span>
                          <span>Refuser</span>
                        </button>
                      </>
                    );
                  })()}

                  {item.actionType === 'checkin' && (
                    <button
                      onClick={() => handleStartCheckin(item)}
                      className="px-3.5 py-2 bg-secondary hover:bg-secondary-container text-on-secondary font-label-md text-xs font-bold rounded-lg transition-colors flex items-center gap-1 shadow-sm active:scale-95"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-sm">play_arrow</span>
                      <span>Lancer Check-in</span>
                    </button>
                  )}

                  {item.actionType === 'view_or' && (
                    <button
                      onClick={onNavigateToOrders}
                      className="px-3 py-1.5 bg-surface-container-lowest hover:bg-surface-container text-on-surface font-label-md text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 shadow-sm border border-surface-container-high"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-sm">visibility</span>
                      <span>Fiche OR</span>
                    </button>
                  )}

                  {item.actionType === 'reception' && (
                    <button
                      onClick={() => {
                        showToast(`Caméra OCR : Plaque ${item.plate} scannée. Ouverture de la fiche de Check-in.`);
                        handleStartCheckin(item);
                      }}
                      className="px-3.5 py-2 bg-primary hover:bg-[#1a2a38] text-on-primary font-label-md text-xs font-bold rounded-lg transition-colors flex items-center gap-1 shadow-sm active:scale-95"
                      type="button"
                      title="Scanner à la barrière et lancer le check-in 360°"
                    >
                      <span className="material-symbols-outlined text-sm">qr_code_scanner</span>
                      <span>Réceptionner</span>
                    </button>
                  )}

                  {item.actionType === 'notify' && (
                    <button
                      onClick={() => showToast(`SMS de rappel automatique transmis à ${item.clientName}.`)}
                      className="px-3 py-1.5 bg-surface-container-lowest hover:bg-surface-container text-on-surface font-label-md text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 shadow-sm border border-surface-container-high"
                      type="button"
                    >
                      <span className="material-symbols-outlined text-sm">notifications</span>
                      <span>Notifier Client</span>
                    </button>
                  )}

                  {item.actionType === 'restitution' && (
                    <div className="flex items-center gap-2">
                      {onNavigateToRestitution && (
                        <button
                          onClick={onNavigateToRestitution}
                          className="px-3 py-1.5 bg-secondary-fixed text-on-secondary-fixed hover:bg-secondary hover:text-white font-label-md text-xs font-bold rounded-lg transition-colors flex items-center gap-1"
                          type="button"
                          title="Ouvrir le module de règlement & restitution"
                        >
                          <span className="material-symbols-outlined text-sm">payments</span>
                          <span>Facturation</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          if (item.id.startsWith('RDV-')) {
                            workshopSyncService.updateAppointmentStatus(item.id, 'completed');
                          }
                          workshopSyncService.addCheckedOutItem(item.id);
                          workshopSyncService.addCheckedOutItem(`${dailyData.dateIsoString}:${item.id}`);
                          showToast(`Dossier ${item.plate} (${item.clientName}) clôturé et retiré du planning.`);
                          setSyncTick((t) => t + 1);
                        }}
                        className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-label-md text-xs font-bold rounded-lg transition-colors flex items-center gap-1 shadow-sm active:scale-95"
                        type="button"
                        title="Clôturer le dossier et supprimer du planning"
                      >
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                        <span>Clôturer & Retirer du Planning</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
              </div>
              );
            })}
          </div>

          {/* Visualisation 12 Postes Adaptés à la journée */}
          <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm flex flex-col gap-3 border border-surface-container-high">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-headline-sm text-sm sm:text-base font-bold text-on-surface block">
                  Visualisation de l'Atelier — {dailyData.kpis.totalOpenPostsCount} Ponts Ouverts / {dailyData.posts.length}
                </span>
                <span className="font-label-sm text-xs text-on-surface-variant tabular-nums">
                  {dailyData.kpis.occupiedPostsCount} occupés • {Math.max(0, dailyData.kpis.totalOpenPostsCount - dailyData.kpis.occupiedPostsCount)} libres le {dailyData.formattedDateFull}
                </span>
              </div>
              <span className="font-label-sm text-xs text-on-surface-variant font-mono">Vue Plan Masse</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2 text-center">
              {dailyData.posts.map((post) => {
                const isAvailable = post.status === 'available';
                const isMaint = post.status === 'maintenance';
                return (
                  <div
                    key={post.id}
                    onClick={() =>
                      showToast(
                        isMaint
                          ? `${post.name} en MAINTENANCE : ${post.maintenanceReason || 'Indisponible'}`
                          : `Poste ${post.name} : ${post.current} (${post.type}) ${
                              post.techName ? `• Tech: ${post.techName}` : ''
                            } - ${isAvailable ? 'Libre pour nouvelle tâche' : 'Actif'}`
                      )
                    }
                    title={isMaint ? `Maintenance : ${post.maintenanceReason || 'Indisponible'}` : undefined}
                    className={`p-2.5 rounded-xl border flex flex-col items-center justify-center cursor-pointer transition-all hover:scale-105 ${
                      isMaint
                        ? 'bg-amber-50 border-amber-300 text-amber-900'
                        : post.color === 'secondary'
                        ? 'bg-secondary-fixed/50 border-secondary text-on-secondary-fixed'
                        : isAvailable
                        ? 'bg-surface-container-highest border-dashed border-outline/40 opacity-70'
                        : 'bg-surface-container-low border-surface-container-high text-on-surface'
                    }`}
                  >
                    <span className="font-label-sm text-[10px] font-bold">{post.name}</span>
                    <span className={`font-label-sm text-xs font-semibold ${isMaint ? 'text-amber-700' : 'text-secondary'}`}>
                      {post.type}
                    </span>
                    <span className="text-[10px] text-on-surface-variant font-mono mt-0.5 truncate max-w-full">
                      {isMaint ? 'Maintenance' : post.current}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4">
          {/* Techniciens Postés du Jour */}
          <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm flex flex-col gap-3 border border-surface-container-high">
            <div className="flex items-center justify-between pb-2 border-b border-surface-container-high">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-lg">group</span>
                <span className="font-headline-sm text-sm sm:text-base font-bold text-on-surface">
                  Techniciens Postés
                </span>
              </div>
              <span className="font-label-sm text-xs text-on-surface-variant font-semibold">
                {dailyData.technicians.length} Techniciens assignés
              </span>
            </div>

            <div className="flex flex-col gap-2">
              {dailyData.technicians.map((tech) => (
                <div
                  key={tech.id}
                  className="p-2.5 rounded-xl bg-surface-container-low flex items-center justify-between border border-surface-container-high hover:bg-surface-container transition-colors"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="relative">
                      {tech.avatar ? (
                        <img src={tech.avatar} alt={tech.name} className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-bold text-xs">
                          {tech.initials}
                        </div>
                      )}
                      <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-secondary ring-1 ring-white" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-body-md text-xs font-bold text-on-surface leading-tight">{tech.name}</span>
                      <span className="font-label-sm text-[10px] text-on-surface-variant">{tech.role}</span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className={`font-label-sm text-[11px] font-semibold block ${tech.statusClass}`}>
                      {tech.status}
                    </span>
                    <span className="font-label-sm text-[10px] text-on-surface-variant">{tech.availableAt}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Alertes Directes Adaptées au Jour */}
          <div className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm flex flex-col gap-3 border border-surface-container-high">
            <div className="flex items-center justify-between pb-2 border-b border-surface-container-high">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-secondary text-lg">crisis_alert</span>
                <span className="font-headline-sm text-sm sm:text-base font-bold text-on-surface">
                  Alertes Atelier du Jour
                </span>
              </div>
              <span className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
            </div>

            <div className="flex flex-col gap-2.5">
              {dailyData.alerts.map((alert) => (
                <div
                  key={alert.id}
                  className="p-3 bg-surface-container-low rounded-xl flex items-start gap-2.5 border border-surface-container-high"
                >
                  <span
                    className={`material-symbols-outlined text-base shrink-0 mt-0.5 ${
                      alert.urgency === 'high'
                        ? 'text-secondary'
                        : alert.urgency === 'medium'
                        ? 'text-amber-600'
                        : 'text-primary'
                    }`}
                  >
                    {alert.icon}
                  </span>
                  <div className="flex flex-col">
                    <span className="font-body-sm text-xs text-on-surface font-bold">{alert.title}</span>
                    <p className="font-body-sm text-[11px] text-on-surface-variant leading-snug">
                      {alert.description}
                    </p>
                    <span className="font-label-sm text-[10px] text-secondary font-medium mt-1">
                      {alert.meta}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Workshop Illustration Card */}
          <div className="bg-surface-container-lowest p-4 rounded-2xl shadow-sm flex flex-col gap-2 overflow-hidden border border-surface-container-high">
            <div className="flex items-center justify-between">
              <span className="font-label-sm text-xs text-on-surface-variant uppercase font-semibold">
                Baie Diagnostic & Contrôle
              </span>
              <span className="font-label-sm text-xs text-secondary font-bold">Normes City Cars</span>
            </div>
            <div className="relative w-full h-36 rounded-xl overflow-hidden group">
              <img
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuD_LqTplmrpQRX3GEOd46tQ96JhEUOCpli3Z8UKYYUPSJftSd66GIbJ82LPKW58TNXnSEbhdYJgdBhIE_uL5fNBCGpncYIudDSMFn3V5aBDQCtG4kYWC9GpZPWuBDpji9YFVlzoWMakP9kLCgXd3z6eL3J3ZdWzN0cmJPGJyYjzqLHBDNHeZzdI_VvGrjXMI8OOw306-ETSgm0F9WCm97ti2OukxPK5TNBX4M7Jfm0S473NO_dvNCpJbA"
                alt="Atelier La Goulette"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-transparent to-transparent flex items-end p-3">
                <span className="font-headline-sm text-xs text-white font-bold">
                  Atelier La Goulette : Certification SAV Kia {selectedDate.getFullYear()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
}
