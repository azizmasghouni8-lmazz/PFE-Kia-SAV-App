import { useState, useMemo, useEffect } from 'react';
import { Vehicle, Compte } from '../../types';
import { workshopSyncService, ClientAppointment } from '../../services/workshopSyncService';
import { resolveKiaModelImage } from '../../data/kiaCatalog';
import { soundService } from '../../services/soundService';

interface BookAppointmentProps {
  vehicles: Vehicle[];
  onConfirmSuccess: (appointment: {
    vehicleName: string;
    plate: string;
    vin?: string;
    mileage?: number;
    serviceName: string;
    price: string;
    date: string;
    time: string;
    dateIso?: string;
    notes?: string;
  }) => void;
  onNavigateToAssistance?: () => void;
  clientName?: string;
  currentCompte?: Compte | null;
}

const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const WEEKDAYS_SHORT = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const MORNING_SLOTS = [
  { time: '08:00', badge: 'Ouverture' },
  { time: '08:30', badge: 'Accueil Express', recommended: true },
  { time: '09:00', badge: 'Conseillé' },
  { time: '09:30', badge: '' },
  { time: '10:00', badge: '' },
  { time: '10:30', badge: '3 places' },
  { time: '11:00', badge: '' },
  { time: '11:30', badge: '' },
  { time: '12:00', badge: 'Fin matinée' },
];

const AFTERNOON_SLOTS = [
  { time: '13:30', badge: 'Reprise' },
  { time: '14:00', badge: 'Conseillé' },
  { time: '14:30', badge: '' },
  { time: '15:00', badge: '' },
  { time: '15:30', badge: '2 places' },
  { time: '16:00', badge: '' },
  { time: '16:30', badge: '' },
  { time: '17:00', badge: 'Dernier créneau' },
];

export function BookAppointment({
  vehicles,
  onConfirmSuccess,
  onNavigateToAssistance,
  clientName = 'Cher Client',
  currentCompte = null,
}: BookAppointmentProps) {
  const [pendingChefAppt, setPendingChefAppt] = useState<ClientAppointment | null>(() =>
    workshopSyncService.getPendingChefAppointmentForClient(currentCompte, vehicles)
  );

  const [settings, setSettings] = useState(() => workshopSyncService.getWorkshopSettings());
  const [openBaysCount, setOpenBaysCount] = useState(
    () => workshopSyncService.getWorkshopBays().filter((b) => b.status === 'open').length
  );
  const [configTick, setConfigTick] = useState(0);

  useEffect(() => {
    const refreshLock = () => {
      setPendingChefAppt(
        workshopSyncService.getPendingChefAppointmentForClient(currentCompte, vehicles)
      );
    };
    const refreshSettings = () => {
      const nextSettings = workshopSyncService.getWorkshopSettings();
      setSettings(nextSettings);
      setOpenBaysCount(workshopSyncService.getWorkshopBays().filter((b) => b.status === 'open').length);
      setConfigTick((t) => t + 1);
    };
    refreshLock();
    window.addEventListener('k_dms_planning_updated', refreshLock);
    window.addEventListener('k_dms_settings_updated', refreshSettings);
    window.addEventListener('k_dms_bays_updated', refreshSettings);
    return () => {
      window.removeEventListener('k_dms_planning_updated', refreshLock);
      window.removeEventListener('k_dms_settings_updated', refreshSettings);
      window.removeEventListener('k_dms_bays_updated', refreshSettings);
    };
  }, [currentCompte, vehicles]);

  const leadHours = settings.minBookingLeadHours || 2;
  const deadlineHours = settings.clientModifyDeadlineHours || 24;

  const [selectedVehicleId, setSelectedVehicleId] = useState<string>(() => vehicles[0]?.id || '');

  useEffect(() => {
    setSelectedVehicleId(vehicles[0]?.id || '');
    setIsSuccess(false);
    setNotes('');
  }, [currentCompte?.id, vehicles]);

  const [selectedServiceId, setSelectedServiceId] = useState<string>('rev');
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [slotError, setSlotError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setNowMs(Date.now());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const currentMinuteBucket = Math.floor(nowMs / 30000);

  // Calcul strict de la semaine en cours (Lundi -> Dimanche, selon Paramètres Atelier)
  const currentWeekInfo = useMemo(() => {
    const nowRef = new Date(nowMs);
    const today = new Date(nowRef);
    today.setHours(0, 0, 0, 0);
    const dayOfWeek = today.getDay(); // 0 = Dimanche, 1 = Lundi ... 6 = Samedi
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);

    const saturday = new Date(monday);
    saturday.setDate(monday.getDate() + 5);

    const days = Array.from({ length: 7 }, (_, idx) => {
      const cellDate = new Date(monday);
      cellDate.setDate(monday.getDate() + idx);
      cellDate.setHours(0, 0, 0, 0);

      const dow = cellDate.getDay();
      const isSunday = dow === 0;
      const isSaturday = dow === 6;
      const isPast = cellDate.getTime() < today.getTime();
      const isToday = cellDate.getTime() === today.getTime();

      const y = cellDate.getFullYear();
      const m = String(cellDate.getMonth() + 1).padStart(2, '0');
      const dayN = String(cellDate.getDate()).padStart(2, '0');
      const isoDate = `${y}-${m}-${dayN}`;
      const isClosedBySettings =
        isSunday ||
        (isSaturday && !settings.saturdayEnabled) ||
        settings.closedDates.includes(isoDate) ||
        openBaysCount === 0;

      const candidateSlots = isClosedBySettings
        ? []
        : isSaturday
        ? MORNING_SLOTS
        : [...MORNING_SLOTS, ...AFTERNOON_SLOTS];

      const openSlots = isPast || isClosedBySettings
        ? []
        : candidateSlots.filter(
            (s) => workshopSyncService.isSlotAvailableInRealTime(cellDate, s.time, nowMs).available
          );

      const closedTodayAllSlots = isToday && !isClosedBySettings && openSlots.length === 0;
      const isBookable = !isPast && !isClosedBySettings && openSlots.length > 0;
      const dNum = cellDate.getDate();
      const baseSpots = isClosedBySettings ? 0 : isPast ? 0 : isSaturday ? 4 : dNum % 3 === 0 ? 3 : 7;
      const spotsAvailable = isBookable ? Math.min(Math.max(1, openBaysCount), baseSpots, openSlots.length) : 0;

      return {
        date: cellDate,
        dayShort: WEEKDAYS_SHORT[idx],
        dayNumber: dNum,
        monthShort: MONTHS_FR[cellDate.getMonth()].slice(0, 4),
        isPast,
        isSunday,
        isSaturday,
        isClosedBySettings,
        isToday,
        closedTodayAllSlots,
        openSlotsCount: openSlots.length,
        isBookable,
        spotsAvailable,
      };
    });

    const bookableDays = days.filter((d) => d.isBookable);
    const todayCell = bookableDays.find((d) => d.isToday);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    const defaultDay =
      todayCell?.date ||
      bookableDays.find((d) => d.date.getTime() === tomorrow.getTime())?.date ||
      bookableDays[0]?.date ||
      null;

    return {
      monday,
      saturday,
      days,
      bookableDays,
      defaultDay,
      weekLabel: `Semaine du ${monday.getDate()} au ${saturday.getDate()} ${MONTHS_FR[saturday.getMonth()]} ${saturday.getFullYear()}`,
    };
  }, [currentMinuteBucket, configTick, settings.saturdayEnabled, settings.closedDates, openBaysCount]);

  const [selectedDate, setSelectedDate] = useState<Date | null>(currentWeekInfo.defaultDay);
  const [selectedTime, setSelectedTime] = useState<string>(() => {
    if (!currentWeekInfo.defaultDay) return '08:30';
    const isSat = currentWeekInfo.defaultDay.getDay() === 6;
    const pool = isSat ? MORNING_SLOTS : [...MORNING_SLOTS, ...AFTERNOON_SLOTS];
    const firstValid = pool.find((s) =>
      workshopSyncService.isSlotAvailableInRealTime(currentWeekInfo.defaultDay!, s.time, Date.now()).available
    );
    return firstValid?.time || '08:30';
  });
  const [mobilityOption, setMobilityOption] = useState<'lounge' | 'courtesy'>('lounge');
  const [notes, setNotes] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  // Maintenir une date et un horaire valides en temps réel (fermeture auto des créneaux passés ou < délai min)
  useEffect(() => {
    if (!selectedDate) {
      if (currentWeekInfo.defaultDay) {
        setSelectedDate(currentWeekInfo.defaultDay);
      }
      return;
    }

    const matchingDay = currentWeekInfo.days.find(
      (d) =>
        d.date.getFullYear() === selectedDate.getFullYear() &&
        d.date.getMonth() === selectedDate.getMonth() &&
        d.date.getDate() === selectedDate.getDate()
    );

    if (!matchingDay || !matchingDay.isBookable) {
      setSelectedDate(currentWeekInfo.defaultDay);
      return;
    }

    const pool = matchingDay.isSaturday ? MORNING_SLOTS : [...MORNING_SLOTS, ...AFTERNOON_SLOTS];
    const isCurrentValid =
      pool.some((s) => s.time === selectedTime) &&
      workshopSyncService.isSlotAvailableInRealTime(selectedDate, selectedTime, nowMs).available;

    if (!isCurrentValid) {
      const firstOpen = pool.find(
        (s) => workshopSyncService.isSlotAvailableInRealTime(selectedDate, s.time, nowMs).available
      );
      if (firstOpen) {
        setSelectedTime(firstOpen.time);
      }
    }
  }, [currentWeekInfo, selectedDate, selectedTime, nowMs]);

  const fallbackVehicle: Vehicle = {
    id: currentCompte?.id ? `veh-${currentCompte.id}` : 'default',
    name: currentCompte?.modeleVehicule || 'Véhicule Kia',
    finish: 'Finition Concessionnaire',
    plate: currentCompte?.immatriculation || '—',
    vin: currentCompte?.vin || '—',
    year: 2024,
    type: 'Véhicule',
    color: 'Noir Ébène',
    mileage: 1500,
    nextServiceKm: 10000,
    warranty: '5 Ans ou 100 000 km',
    warrantyActive: true,
    status: 'up_to_date',
    imageUrl: resolveKiaModelImage(currentCompte?.modeleVehicule),
  };

  const currentVehicle = vehicles.find((v) => v.id === selectedVehicleId) || vehicles[0] || fallbackVehicle;

  const SERVICES = [
    {
      id: 'rev',
      name: 'Révision Périodique Constructeur',
      badge: 'Conseillé',
      badgeColor: 'red',
      desc: 'Vidange huile homologuée TotalEnergies, filtres à huile/air/habitacle, check-up 35 points essentiels.',
      time: '~ 2h30',
      price: settings.maintenancePrices.revision,
      priceLabel: `${settings.maintenancePrices.revision} DT`,
      icon: 'car_repair',
    },
    {
      id: 'frein',
      name: 'Freinage & Sécurité',
      badge: 'Sécurité',
      badgeColor: 'gray',
      desc: "Remplacement ou contrôle d'usure des plaquettes et disques de frein avant/arrière d'origine.",
      time: '~ 1h45',
      price: settings.maintenancePrices.freinage,
      priceLabel: `dès ${settings.maintenancePrices.freinage} DT`,
      icon: 'fmd_bad',
    },
    {
      id: 'diag',
      name: 'Diagnostic Électronique / Voyant',
      badge: 'Technologie',
      badgeColor: 'gray',
      desc: 'Analyse approfondie avec la valise constructeur Kia KDS, lecture et effacement des codes défauts.',
      time: '~ 1h00',
      price: settings.maintenancePrices.diagnostic,
      priceLabel: `${settings.maintenancePrices.diagnostic} DT`,
      icon: 'electrical_services',
    },
    {
      id: 'clim',
      name: 'Climatisation & Habitacle',
      badge: 'Confort',
      badgeColor: 'gray',
      desc: 'Recharge en gaz frigorigène R134a/R1234yf, traitement antibactérien et désinfection des conduits.',
      time: '~ 1h15',
      price: settings.maintenancePrices.climatisation,
      priceLabel: `${settings.maintenancePrices.climatisation} DT`,
      icon: 'ac_unit',
    },
    {
      id: 'pneu',
      name: 'Pneumatiques & Géométrie',
      badge: 'Roulage',
      badgeColor: 'gray',
      desc: 'Permutation, équilibrage dynamique 3D et réglage du parallélisme des trains roulants.',
      time: '~ 0h45',
      price: settings.maintenancePrices.pneumatiques,
      priceLabel: `dès ${settings.maintenancePrices.pneumatiques} DT`,
      icon: 'tire_repair',
    },
    {
      id: 'autre',
      name: 'Autre motif ou Carrosserie',
      badge: 'Sur-mesure',
      badgeColor: 'gray',
      desc: 'Peinture, redressage débosselage sans peinture ou problème spécifique à décrire.',
      time: 'Expertise',
      price: 0,
      priceLabel: 'Sur devis',
      icon: 'design_services',
    },
  ];

  const selectedService = SERVICES.find((s) => s.id === selectedServiceId) || SERVICES[0];

  // Helper pour formater la date en texte complet français (ex: "Mardi 10 Novembre 2026")
  const formatSelectedDateFull = (d: Date) => {
    const weekday = new Intl.DateTimeFormat('fr-FR', { weekday: 'long' }).format(d);
    const day = d.getDate();
    const month = MONTHS_FR[d.getMonth()];
    const year = d.getFullYear();
    const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
    return `${capitalizedWeekday} ${day} ${month} ${year}`;
  };

  const isSelectedDateSaturday = selectedDate ? selectedDate.getDay() === 6 : false;
  const isSelectedDateToday = useMemo(() => {
    if (!selectedDate) return false;
    const nowRef = new Date(nowMs);
    return (
      selectedDate.getFullYear() === nowRef.getFullYear() &&
      selectedDate.getMonth() === nowRef.getMonth() &&
      selectedDate.getDate() === nowRef.getDate()
    );
  }, [selectedDate, nowMs]);

  const nowClockLabel = useMemo(() => {
    const d = new Date(nowMs);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }, [nowMs]);

  const minLeadClockLabel = useMemo(() => {
    const d = new Date(nowMs + leadHours * 60 * 60 * 1000);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }, [nowMs, leadHours]);

  const currentSlotCheck = useMemo(() => {
    if (!selectedDate) {
      return { available: false as const, reason: 'past' as const, minAllowedTimeStr: minLeadClockLabel };
    }
    return workshopSyncService.isSlotAvailableInRealTime(selectedDate, selectedTime, nowMs);
  }, [selectedDate, selectedTime, nowMs, minLeadClockLabel, configTick]);

  // Sélection d'un jour de cette semaine
  const handleSelectDay = (date: Date) => {
    setSelectedDate(date);
    setIsSuccess(false);
    setSlotError(null);
    const isSat = date.getDay() === 6;
    const pool = isSat ? MORNING_SLOTS : [...MORNING_SLOTS, ...AFTERNOON_SLOTS];
    const stillOk =
      pool.some((s) => s.time === selectedTime) &&
      workshopSyncService.isSlotAvailableInRealTime(date, selectedTime, Date.now()).available;
    if (!stillOk) {
      const firstOpen = pool.find(
        (s) => workshopSyncService.isSlotAvailableInRealTime(date, s.time, Date.now()).available
      );
      if (firstOpen) {
        setSelectedTime(firstOpen.time);
      }
    }
  };

  const handleConfirm = () => {
    if (!selectedDate) return;
    if (!currentVehicle.plate || currentVehicle.plate === '—') return;
    if (workshopSyncService.getPendingChefAppointmentForClient(currentCompte, vehicles)) {
      return;
    }

    const freshNow = Date.now();
    const freshCheck = workshopSyncService.isSlotAvailableInRealTime(selectedDate, selectedTime, freshNow);
    if (!freshCheck.available) {
      setNowMs(freshNow);
      setSlotError(
        freshCheck.reason === 'past'
          ? `L'horaire ${selectedTime} est déjà dépassé. Choisissez un créneau à partir de ${freshCheck.minAllowedTimeStr}.`
          : freshCheck.reason === 'closed'
          ? `L'atelier est fermé sur le créneau ${selectedTime} selon les horaires configurés.`
          : freshCheck.reason === 'capacity'
          ? `Le créneau ${selectedTime} est complet pour cette journée. Veuillez choisir un autre horaire.`
          : `Délai minimum de ${leadHours}h requis par rapport à l'heure actuelle : choisissez un créneau à partir de ${freshCheck.minAllowedTimeStr}.`
      );
      return;
    }

    setSlotError(null);
    setIsSuccess(true);
    soundService.play('client_validation_check');
    const y = selectedDate.getFullYear();
    const m = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const d = String(selectedDate.getDate()).padStart(2, '0');
    const dateIso = `${y}-${m}-${d}`;

    onConfirmSuccess({
      vehicleName: currentVehicle.name,
      plate: currentVehicle.plate,
      vin: currentVehicle.vin,
      mileage: currentVehicle.mileage,
      serviceName: selectedService.name,
      price: selectedService.price > 0 ? `${selectedService.price} DT` : 'Sur devis',
      date: formatSelectedDateFull(selectedDate),
      time: selectedTime,
      dateIso,
      notes: notes.trim() || undefined,
    });
    setPendingChefAppt(
      workshopSyncService.getPendingChefAppointmentForClient(currentCompte, vehicles)
    );
  };

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto flex flex-col gap-6">
      {/* En-tête de page & Contextualisation SAV */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-secondary font-label-md text-xs uppercase tracking-wider font-bold">
            <span className="material-symbols-outlined text-sm">calendar_month</span>
            <span>RÉSERVATION OFFICIELLE EN LIGNE</span>
          </div>
          <h1 className="font-headline-lg text-2xl sm:text-3xl text-on-surface font-bold tracking-tight">
            Prendre Rendez-vous en Atelier
          </h1>
          <p className="font-body-md text-xs sm:text-sm text-on-surface-variant">
            Planifiez l'entretien de votre Kia en quelques clics auprès de nos techniciens certifiés.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-surface-container-high rounded-full self-start md:self-auto border border-surface-container-highest">
          <span className="material-symbols-outlined text-secondary text-sm fill">verified_user</span>
          <span className="font-label-sm text-xs text-on-surface font-semibold">
            Pièces d'Origine Kia & Garantie Préservée
          </span>
        </div>
      </div>

      {/* Verrouillage anti-double RDV tant que le Chef d'Atelier n'a pas répondu */}
      {pendingChefAppt && !isSuccess && (
        <div className="p-4 sm:p-5 rounded-2xl bg-amber-50 border-2 border-amber-300 text-amber-950 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-200/80 text-amber-900 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-2xl">lock_clock</span>
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-headline-sm text-sm sm:text-base font-bold text-amber-950">
                  Nouvelle réservation temporairement verrouillée
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-200 text-amber-950 font-mono text-[11px] font-bold">
                  {pendingChefAppt.plate}
                </span>
              </div>
              <p className="text-xs text-amber-900 leading-relaxed">
                Vous avez déjà une demande de rendez-vous en attente de validation du Chef d'Atelier pour le{' '}
                <strong>{pendingChefAppt.formattedDate}</strong> à <strong className="font-mono">{pendingChefAppt.time}</strong>{' '}
                ({pendingChefAppt.serviceName}). Par mesure de sécurité anti-doublon, vous ne pouvez pas reprendre de RDV tant que le Chef d'Atelier n'a pas répondu.
              </p>
            </div>
          </div>

          {onNavigateToAssistance && (
            <button
              type="button"
              onClick={onNavigateToAssistance}
              className="px-4 py-2.5 rounded-xl bg-primary hover:bg-[#1a2a38] text-white font-headline-sm text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-sm"
            >
              <span className="material-symbols-outlined text-base">event_note</span>
              <span>Suivre dans Assistance & Devis</span>
            </button>
          )}
        </div>
      )}

      {/* Stepper Visuel */}
      <div className="w-full bg-surface-container-lowest rounded-2xl p-4 shadow-sm border border-surface-container-high">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 relative">
          {/* Step 1 */}
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-container-low transition-colors border border-surface-container-high">
            <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-label-sm text-xs flex-shrink-0">
              <span className="material-symbols-outlined text-sm">check</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-label-sm text-[10px] text-on-surface-variant uppercase">Étape 1</span>
              <span className="font-body-sm text-xs font-semibold text-on-surface truncate">Choix du Véhicule</span>
            </div>
          </div>

          {/* Step 2 */}
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-container-low transition-colors border border-surface-container-high">
            <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center font-label-sm text-xs flex-shrink-0">
              <span className="material-symbols-outlined text-sm">check</span>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-label-sm text-[10px] text-on-surface-variant uppercase">Étape 2</span>
              <span className="font-body-sm text-xs font-semibold text-on-surface truncate">Prestation SAV</span>
            </div>
          </div>

          {/* Step 3 (Actif) */}
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-secondary text-on-secondary shadow-sm">
            <div className="w-8 h-8 rounded-full bg-on-secondary text-secondary flex items-center justify-center font-label-sm text-xs font-bold flex-shrink-0">
              3
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-label-sm text-[10px] text-secondary-fixed uppercase opacity-90">Étape 3</span>
              <span className="font-body-sm text-xs font-semibold truncate">Date & Horaire</span>
            </div>
          </div>

          {/* Step 4 */}
          <div className="flex items-center gap-3 p-2.5 rounded-xl bg-surface-container-low opacity-75 border border-surface-container-high">
            <div className="w-8 h-8 rounded-full bg-surface-variant text-on-surface-variant flex items-center justify-center font-label-sm text-xs flex-shrink-0">
              4
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-label-sm text-[10px] text-on-surface-variant uppercase">Étape 4</span>
              <span className="font-body-sm text-xs font-semibold text-on-surface truncate">Confirmation</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Form (8 cols) & Summary (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* Bloc 1 : Sélection du Véhicule */}
          <div className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col gap-4 border border-surface-container-high">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary-container text-on-primary-fixed flex items-center justify-center font-label-sm text-xs font-bold">
                  1
                </span>
                <h2 className="font-headline-sm text-base sm:text-lg font-bold text-on-surface">
                  Véhicule concerné
                </h2>
              </div>
              <span className="font-label-sm text-xs text-secondary font-semibold uppercase">
                {vehicles.length} Véhicule{vehicles.length > 1 ? 's' : ''} disponible{vehicles.length > 1 ? 's' : ''}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {vehicles.map((v, index) => {
                const isSelected = currentVehicle.id === v.id;
                return (
                  <label
                    key={v.id}
                    onClick={() => setSelectedVehicleId(v.id)}
                    className={`relative flex flex-col p-4 rounded-xl cursor-pointer transition-all shadow-sm ${
                      isSelected
                        ? 'bg-surface-container-low ring-2 ring-primary border-transparent'
                        : 'bg-surface-container hover:bg-surface-container-high border border-surface-container-high'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span
                          className={`inline-block px-2 py-0.5 font-label-sm text-[10px] rounded uppercase mb-1 font-bold ${
                            isSelected
                              ? 'bg-primary text-on-primary'
                              : 'bg-surface-variant text-on-surface-variant'
                          }`}
                        >
                          {index === 0 ? 'Actif' : 'Secondaire'}
                        </span>
                        <h3 className="font-headline-sm text-base font-bold text-on-surface">{v.name}</h3>
                        <p className="font-body-sm text-xs text-on-surface-variant">{v.finish || v.type}</p>
                      </div>
                      <span className="font-label-md text-xs text-on-surface font-semibold bg-surface-variant px-2.5 py-1 rounded font-mono">
                        {v.plate}
                      </span>
                    </div>

                    <div className="relative w-full h-32 my-3 rounded-lg overflow-hidden bg-surface-variant">
                      <img
                        className="w-full h-full object-cover"
                        src={v.imageUrl}
                        alt={v.name}
                      />
                    </div>

                    <div className="flex items-center justify-between pt-1 font-label-sm text-xs text-on-surface-variant">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">speed</span>{' '}
                        {v.mileage?.toLocaleString('fr-FR')} km
                      </span>
                      <span className="text-secondary font-medium">Garantie active (5 ans)</span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Bloc 2 : Choix des Prestations SAV */}
          <div className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col gap-4 border border-surface-container-high">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary-container text-on-primary-fixed flex items-center justify-center font-label-sm text-xs font-bold">
                  2
                </span>
                <h2 className="font-headline-sm text-base sm:text-lg font-bold text-on-surface">
                  Sélectionnez la prestation
                </h2>
              </div>
              <span className="font-label-sm text-xs text-on-surface-variant">Barème officiel Kia</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {SERVICES.map((s) => {
                const isSelected = selectedServiceId === s.id;
                return (
                  <div
                    key={s.id}
                    onClick={() => setSelectedServiceId(s.id)}
                    className={`p-4 rounded-xl border flex flex-col justify-between gap-3 cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-surface-container-low border-secondary ring-1 ring-secondary shadow-sm'
                        : 'bg-surface-container-lowest hover:bg-surface-container-low border-surface-container-high'
                    }`}
                  >
                    <div className="flex flex-col gap-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-secondary text-xl">{s.icon}</span>
                          <span
                            className={`font-label-sm text-[10px] uppercase font-bold px-2 py-0.5 rounded ${
                              s.badgeColor === 'red'
                                ? 'bg-secondary-fixed text-on-secondary-fixed'
                                : 'bg-surface-variant text-on-surface-variant'
                            }`}
                          >
                            {s.badge}
                          </span>
                        </div>
                        <input
                          type="radio"
                          name="service"
                          checked={isSelected}
                          onChange={() => {}}
                          className="text-secondary accent-secondary mt-0.5"
                        />
                      </div>

                      <h3 className="font-headline-sm text-sm font-bold text-on-surface leading-tight">{s.name}</h3>
                      <p className="font-body-sm text-xs text-on-surface-variant leading-relaxed">{s.desc}</p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-surface-container-high text-xs">
                      <span className="font-body-sm text-on-surface-variant flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">schedule</span> {s.time}
                      </span>
                      <span className="font-headline-sm font-bold text-secondary font-mono">{s.priceLabel}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Note facultative */}
            <div className="flex flex-col gap-1.5 pt-2">
              <label className="font-label-sm text-xs text-on-surface font-semibold flex items-center gap-1">
                <span className="material-symbols-outlined text-sm text-secondary">edit_note</span>
                Précisez votre demande ou observations éventuelles (facultatif) :
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Bruit suspect lors du freinage à basse vitesse, voyant pression pneus resté actif..."
                rows={2}
                className="w-full p-3 rounded-xl bg-surface-container-low border border-surface-container-high text-xs sm:text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-secondary/50 font-body-sm resize-none"
              />
            </div>
          </div>

          {/* Bloc 3 : Calendrier Strict de la Semaine en Cours (Lun-Sam) & Orientation Assistance */}
          <div className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col gap-5 border border-surface-container-high">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary-container text-on-primary-fixed flex items-center justify-center font-label-sm text-xs font-bold">
                  3
                </span>
                <h2 className="font-headline-sm text-base sm:text-lg font-bold text-on-surface">
                  Atelier, Date (Cette Semaine) & Créneau horaire
                </h2>
              </div>
              <span className="font-label-sm text-xs text-secondary font-semibold">
                Semaine en cours (Lun – Sam)
              </span>
            </div>

            {/* Atelier fixe */}
            <div className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container-high flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-surface-container flex items-center justify-center text-primary">
                  <span className="material-symbols-outlined text-xl">warehouse</span>
                </div>
                <div>
                  <span className="font-label-sm text-[10px] text-secondary font-bold uppercase">
                    Atelier Central Principal
                  </span>
                  <h3 className="font-headline-sm text-sm font-bold text-on-surface">
                    {settings.dealershipName || 'City Cars Kia - Tunis La Goulette'}
                  </h3>
                  <span className="font-body-sm text-[11px] text-on-surface-variant tabular-nums">
                    {settings.dealershipAddress || 'Zone Industrielle Le Kram, 2015 Tunis'} · {openBaysCount} Pont(s) Actif(s)
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-on-surface-variant font-mono tabular-nums">
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold text-[11px] whitespace-nowrap shrink-0">
                  Lun-Ven {settings.weekdayOpen}–{settings.weekdayClose} | {settings.saturdayEnabled ? `Sam ${settings.saturdayOpen}–${settings.saturdayClose}` : 'Sam Fermé'}
                </span>
              </div>
            </div>

            {/* Calendrier Strict Semaine Courante */}
            <div className="flex flex-col gap-3 p-4 bg-surface-container-low rounded-xl border border-surface-container-high">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-surface-container-high">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-secondary text-lg">date_range</span>
                  <h3 className="font-headline-sm text-sm sm:text-base font-bold text-on-surface">
                    {currentWeekInfo.weekLabel}
                  </h3>
                </div>
                <span className="text-[11px] font-medium text-on-surface-variant">
                  Réservation en ligne ouverte uniquement sur cette semaine
                </span>
              </div>

              {/* Grille 7 jours (Lun-Sam réservables, Dim fermé) */}
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                {currentWeekInfo.days.map((cell) => {
                  const isDisabled = !cell.isBookable;
                  const isSelected =
                    selectedDate !== null &&
                    selectedDate.getFullYear() === cell.date.getFullYear() &&
                    selectedDate.getMonth() === cell.date.getMonth() &&
                    selectedDate.getDate() === cell.date.getDate();

                  return (
                    <button
                      key={cell.date.toISOString()}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => handleSelectDay(cell.date)}
                      className={`relative p-3 rounded-xl flex flex-col items-center justify-between gap-2 transition-all text-xs font-body-sm select-none min-h-[88px] ${
                        isSelected
                          ? 'bg-secondary text-white font-bold shadow-md ring-2 ring-secondary ring-offset-2 ring-offset-surface-container-low'
                          : isDisabled
                          ? 'bg-surface-container/50 text-on-surface-variant/40 cursor-not-allowed border border-surface-container-high/50'
                          : 'bg-surface-container-lowest hover:bg-surface-container hover:border-secondary/50 text-on-surface border border-surface-container-high cursor-pointer'
                      }`}
                    >
                      <div className="w-full flex items-center justify-between text-[11px]">
                        <span className={`font-semibold uppercase ${isSelected ? 'text-white/90' : cell.isSunday ? 'text-red-500' : 'text-on-surface-variant'}`}>
                          {cell.dayShort}
                        </span>
                        {cell.isToday && (
                          <span className={`text-[10px] font-bold ${isSelected ? 'text-white' : 'text-secondary'}`}>
                            Auj.
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col items-center">
                        <span className="font-mono tabular-nums text-lg font-bold leading-none">
                          {cell.dayNumber}
                        </span>
                        <span className={`text-[10px] mt-0.5 ${isSelected ? 'text-white/80' : 'text-on-surface-variant'}`}>
                          {cell.monthShort}
                        </span>
                      </div>

                      <div className="w-full text-center">
                        {cell.isSunday || cell.isClosedBySettings ? (
                          <span className="text-[10px] text-red-500 font-semibold">Fermé</span>
                        ) : cell.isPast ? (
                          <span className="text-[10px] opacity-60">Passé</span>
                        ) : cell.closedTodayAllSlots ? (
                          <span className="text-[10px] text-amber-700 font-semibold">Fermé (+{leadHours}h)</span>
                        ) : (
                          <span
                            className={`text-[10px] font-mono tabular-nums font-semibold ${
                              isSelected
                                ? 'text-white'
                                : cell.spotsAvailable <= 3
                                ? 'text-amber-700'
                                : 'text-emerald-700'
                            }`}
                          >
                            {cell.spotsAvailable} places
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Légende & Jour sélectionné */}
              <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-surface-container-high text-[11px] text-on-surface-variant">
                <div className="flex items-center gap-3">
                  <span>Lun – Ven : Journée complète</span>
                  <span aria-hidden="true">·</span>
                  <span>Sam : Matin uniquement (08h–12h30)</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-red-500 font-medium">Dim : Fermé</span>
                </div>
                <span className="font-semibold text-secondary font-headline-sm">
                  {selectedDate ? `Jour choisi : ${formatSelectedDateFull(selectedDate)}` : 'Aucun créneau restant cette semaine'}
                </span>
              </div>
            </div>

            {/* Encart obligatoire : RDV après cette semaine -> Assistance Chef d'Atelier */}
            <div className="p-4 sm:p-5 rounded-xl bg-[#05141f] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-white/10">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-secondary/20 text-secondary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-xl">event_upcoming</span>
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="font-headline-sm text-sm sm:text-base font-bold text-white">
                    Besoin d'un rendez-vous après cette semaine ?
                  </h3>
                  <p className="font-body-sm text-xs text-slate-300 leading-relaxed max-w-xl">
                    Pour planifier un entretien la semaine prochaine ou sur une date ultérieure, contactez directement le Chef d'Atelier (Appel, Message SAV ou Email) dans la section Assistance.
                  </p>
                </div>
              </div>
              {onNavigateToAssistance && (
                <button
                  type="button"
                  onClick={onNavigateToAssistance}
                  className="px-4 py-2.5 rounded-xl bg-secondary hover:bg-secondary-container text-white font-headline-sm text-xs font-bold transition-all flex items-center justify-center gap-2 whitespace-nowrap shrink-0 shadow-sm active:scale-95"
                >
                  <span className="material-symbols-outlined text-base">support_agent</span>
                  <span>Contacter le Chef (Assistance)</span>
                </button>
              )}
            </div>

            {/* Sélecteur d'Horaire Précis de 30 min (Matin & Après-midi) */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="font-label-md text-xs font-semibold text-on-surface">
                  Choisissez l'horaire précis de dépose :
                </span>
                <span className="font-label-sm text-[10px] text-secondary flex items-center gap-1 font-semibold">
                  <span className="material-symbols-outlined text-xs">schedule</span>
                  Créneaux d'accueil par tranche de 30 min (délai min. +{leadHours}h)
                </span>
              </div>

              {/* Bandeau d'information temps réel + règle des +Xh */}
              <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2 text-on-surface">
                  <span className="material-symbols-outlined text-base text-secondary">timer</span>
                  <span>
                    Heure actuelle : <strong className="font-mono">{nowClockLabel}</strong>
                    {isSelectedDateToday ? (
                      <>
                        {' '}
                        · Les créneaux passés et avant{' '}
                        <strong className="font-mono text-secondary">{minLeadClockLabel}</strong> (minimum +{leadHours}h) sont
                        automatiquement fermés.
                      </>
                    ) : (
                      <> · Horaires ouverts selon planning atelier (délai minimum {leadHours}h respecté).</>
                    )}
                  </span>
                </div>
                <span className="px-2 py-0.5 rounded bg-secondary/10 text-secondary font-mono text-[10px] font-bold">
                  Règle Temps Réel +{leadHours}h
                </span>
              </div>

              {slotError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex items-center gap-2">
                  <span className="material-symbols-outlined text-base text-rose-700 shrink-0">schedule</span>
                  <span>{slotError}</span>
                </div>
              )}

              {/* Matin */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-on-surface">
                    <span className="material-symbols-outlined text-amber-600 text-sm">wb_sunny</span>
                    <span>Matinée (08:00 - 12:30)</span>
                  </div>
                  {selectedDate &&
                    MORNING_SLOTS.every(
                      (s) => !workshopSyncService.isSlotAvailableInRealTime(selectedDate, s.time, nowMs).available
                    ) && (
                      <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                        Matinée fermée (temps réel +{leadHours}h / horaires)
                      </span>
                    )}
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-9 gap-2">
                  {MORNING_SLOTS.map((slot) => {
                    const slotCheck = selectedDate
                      ? workshopSyncService.isSlotAvailableInRealTime(selectedDate, slot.time, nowMs)
                      : { available: false, reason: 'past' as const, minAllowedTimeStr: minLeadClockLabel };
                    const isClosed = !slotCheck.available;
                    const isSelected = !isClosed && selectedTime === slot.time;
                    return (
                      <button
                        key={slot.time}
                        type="button"
                        disabled={isClosed}
                        onClick={() => {
                          setSelectedTime(slot.time);
                          setSlotError(null);
                        }}
                        title={
                          isClosed
                            ? slotCheck.reason === 'past'
                              ? 'Horaire dépassé (fermé)'
                              : slotCheck.reason === 'closed'
                              ? 'Fermé selon les horaires atelier'
                              : slotCheck.reason === 'capacity'
                              ? 'Créneau complet'
                              : `Fermé : délai minimum de ${leadHours}h requis (disponible à partir de ${slotCheck.minAllowedTimeStr})`
                            : `Réserver à ${slot.time}`
                        }
                        className={`p-2 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all border text-center ${
                          isClosed
                            ? 'bg-surface-container/60 text-on-surface-variant/45 border-surface-container-high/50 cursor-not-allowed'
                            : isSelected
                            ? 'bg-secondary text-on-secondary border-secondary shadow-md font-bold scale-[1.03]'
                            : 'bg-surface-container-low hover:bg-surface-container text-on-surface border-surface-container-high cursor-pointer'
                        }`}
                      >
                        <span className={`font-mono text-xs font-bold ${isClosed ? 'line-through' : ''}`}>
                          {slot.time}
                        </span>
                        {isClosed ? (
                          <span className="text-[9px] px-1 rounded bg-rose-100/80 text-rose-700 font-semibold truncate max-w-full">
                            {slotCheck.reason === 'past'
                              ? 'Passé'
                              : slotCheck.reason === 'closed'
                              ? 'Fermé'
                              : slotCheck.reason === 'capacity'
                              ? 'Complet'
                              : `Délai <${leadHours}h`}
                          </span>
                        ) : slot.badge ? (
                          <span
                            className={`text-[9px] px-1 rounded truncate max-w-full ${
                              isSelected
                                ? 'bg-black/25 text-white'
                                : slot.recommended
                                ? 'bg-secondary-fixed text-on-secondary-fixed font-bold'
                                : 'bg-surface-container text-on-surface-variant'
                            }`}
                          >
                            {slot.badge}
                          </span>
                        ) : (
                          <span className="text-[9px] opacity-40 font-mono">Dispo</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Après-midi */}
              <div className="flex flex-col gap-2 pt-2 border-t border-surface-container-high">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-on-surface">
                    <span className="material-symbols-outlined text-blue-600 text-sm">wb_twilight</span>
                    <span>Après-midi (13:30 - 17:30)</span>
                  </div>
                  {isSelectedDateSaturday ? (
                    <span className="text-[11px] font-semibold text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                      Fermé le samedi après-midi
                    </span>
                  ) : (
                    selectedDate &&
                    AFTERNOON_SLOTS.every(
                      (s) => !workshopSyncService.isSlotAvailableInRealTime(selectedDate, s.time, nowMs).available
                    ) && (
                      <span className="text-[11px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                        Après-midi fermé (temps réel +{leadHours}h / horaires)
                      </span>
                    )
                  )}
                </div>

                {isSelectedDateSaturday ? (
                  <div className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface-variant flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-600 text-base">info</span>
                    <span>
                      L'atelier assure les réceptions le samedi matin jusqu'à {settings.saturdayClose}. Veuillez choisir un créneau en
                      matinée ci-dessus.
                    </span>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-8 gap-2">
                    {AFTERNOON_SLOTS.map((slot) => {
                      const slotCheck = selectedDate
                        ? workshopSyncService.isSlotAvailableInRealTime(selectedDate, slot.time, nowMs)
                        : { available: false, reason: 'past' as const, minAllowedTimeStr: minLeadClockLabel };
                      const isClosed = !slotCheck.available;
                      const isSelected = !isClosed && selectedTime === slot.time;
                      return (
                        <button
                          key={slot.time}
                          type="button"
                          disabled={isClosed}
                          onClick={() => {
                            setSelectedTime(slot.time);
                            setSlotError(null);
                          }}
                          title={
                            isClosed
                              ? slotCheck.reason === 'past'
                                ? 'Horaire dépassé (fermé)'
                                : slotCheck.reason === 'closed'
                                ? 'Fermé selon les horaires atelier'
                                : slotCheck.reason === 'capacity'
                                ? 'Créneau complet'
                                : `Fermé : délai minimum de ${leadHours}h requis (disponible à partir de ${slotCheck.minAllowedTimeStr})`
                              : `Réserver à ${slot.time}`
                          }
                          className={`p-2 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all border text-center ${
                            isClosed
                              ? 'bg-surface-container/60 text-on-surface-variant/45 border-surface-container-high/50 cursor-not-allowed'
                              : isSelected
                              ? 'bg-secondary text-on-secondary border-secondary shadow-md font-bold scale-[1.03]'
                              : 'bg-surface-container-low hover:bg-surface-container text-on-surface border-surface-container-high cursor-pointer'
                          }`}
                        >
                          <span className={`font-mono text-xs font-bold ${isClosed ? 'line-through' : ''}`}>
                            {slot.time}
                          </span>
                          {isClosed ? (
                            <span className="text-[9px] px-1 rounded bg-rose-100/80 text-rose-700 font-semibold truncate max-w-full">
                              {slotCheck.reason === 'past'
                                ? 'Passé'
                                : slotCheck.reason === 'closed'
                                ? 'Fermé'
                                : slotCheck.reason === 'capacity'
                                ? 'Complet'
                                : `Délai <${leadHours}h`}
                            </span>
                          ) : slot.badge ? (
                            <span
                              className={`text-[9px] px-1 rounded truncate max-w-full ${
                                isSelected
                                  ? 'bg-black/25 text-white'
                                  : 'bg-surface-container text-on-surface-variant font-medium'
                              }`}
                            >
                              {slot.badge}
                            </span>
                          ) : (
                            <span className="text-[9px] opacity-40 font-mono">Dispo</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Mobilité */}
            <div className="flex flex-col gap-2 pt-2 border-t border-surface-variant">
              <span className="font-label-md text-xs font-semibold text-on-surface">Option de mobilité souhaitée :</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label
                  onClick={() => setMobilityOption('courtesy')}
                  className={`flex items-start gap-2.5 p-3 rounded-xl cursor-pointer transition-colors border ${
                    mobilityOption === 'courtesy'
                      ? 'bg-surface-container-low ring-1 ring-secondary border-secondary'
                      : 'bg-surface-container hover:bg-surface-container-high border-surface-container-high'
                  }`}
                >
                  <input
                    type="radio"
                    name="mobility"
                    checked={mobilityOption === 'courtesy'}
                    onChange={() => {}}
                    className="mt-0.5 text-secondary accent-secondary"
                  />
                  <div className="flex flex-col">
                    <span className="font-body-md text-xs font-semibold text-on-surface flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm text-secondary">directions_car</span>
                      Véhicule de courtoisie
                    </span>
                    <span className="font-body-sm text-[11px] text-on-surface-variant">
                      Selon disponibilité le jour J (citadine Kia).
                    </span>
                  </div>
                </label>

                <label
                  onClick={() => setMobilityOption('lounge')}
                  className={`flex items-start gap-2.5 p-3 rounded-xl cursor-pointer transition-colors border ${
                    mobilityOption === 'lounge'
                      ? 'bg-surface-container-low ring-1 ring-secondary border-secondary'
                      : 'bg-surface-container hover:bg-surface-container-high border-surface-container-high'
                  }`}
                >
                  <input
                    type="radio"
                    name="mobility"
                    checked={mobilityOption === 'lounge'}
                    onChange={() => {}}
                    className="mt-0.5 text-secondary accent-secondary"
                  />
                  <div className="flex flex-col">
                    <span className="font-body-md text-xs font-semibold text-on-surface flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm text-secondary">coffee</span>
                      Espace Salon Lounge VIP
                    </span>
                    <span className="font-body-sm text-[11px] text-on-surface-variant">
                      Wi-Fi haut débit, coworking & café offerts.
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Right Sticky Summary (4 cols) */}
        <div className="lg:col-span-4 flex flex-col gap-4 lg:sticky lg:top-28">
          <div className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 shadow-md flex flex-col gap-5 border-t-4 border-secondary border border-surface-container-high">
            <div className="flex items-center justify-between">
              <h2 className="font-headline-sm text-lg font-bold text-on-surface">Récapitulatif RDV</h2>
              <span className="inline-flex items-center px-2 py-0.5 rounded bg-surface-variant text-on-surface font-label-sm text-[11px] font-semibold">
                En direct
              </span>
            </div>

            {/* Lines */}
            <div className="flex flex-col gap-3.5 text-xs">
              {/* Vehicle */}
              <div className="flex items-start gap-2.5 pb-2.5 border-b border-surface-variant">
                <span className="material-symbols-outlined text-secondary text-lg">directions_car</span>
                <div className="flex flex-col flex-1">
                  <span className="font-label-sm text-[10px] text-on-surface-variant uppercase">Véhicule</span>
                  <span className="font-body-md text-xs font-bold text-on-surface">{currentVehicle.name}</span>
                  <span className="font-label-sm text-[11px] text-on-surface-variant font-mono">
                    Immat: {currentVehicle.plate}
                  </span>
                </div>
              </div>

              {/* Service */}
              <div className="flex items-start gap-2.5 pb-2.5 border-b border-surface-variant">
                <span className="material-symbols-outlined text-secondary text-lg">home_repair_service</span>
                <div className="flex flex-col flex-1">
                  <span className="font-label-sm text-[10px] text-on-surface-variant uppercase">Prestation choisie</span>
                  <span className="font-body-md text-xs font-bold text-on-surface">{selectedService.name}</span>
                  <span className="font-body-sm text-[11px] text-on-surface-variant">{selectedService.time}</span>
                </div>
              </div>

              {/* Date & Time */}
              <div className="flex items-start gap-2.5 pb-2.5 border-b border-surface-variant">
                <span className="material-symbols-outlined text-secondary text-lg">event_available</span>
                <div className="flex flex-col flex-1">
                  <span className="font-label-sm text-[10px] text-on-surface-variant uppercase">Date & Horaire</span>
                  <span className="font-body-md text-xs font-bold text-on-surface">
                    {selectedDate
                      ? `${formatSelectedDateFull(selectedDate)} à ${selectedTime}`
                      : 'Semaine terminée — Contactez le Chef'}
                  </span>
                  <span className="font-body-sm text-[11px] text-on-surface-variant">Accueil atelier express</span>
                </div>
              </div>

              {/* Workshop */}
              <div className="flex items-start gap-2.5 pb-2.5 border-b border-surface-variant">
                <span className="material-symbols-outlined text-secondary text-lg">location_on</span>
                <div className="flex flex-col flex-1">
                  <span className="font-label-sm text-[10px] text-on-surface-variant uppercase">Centre Après-Vente</span>
                  <span className="font-body-md text-xs font-bold text-on-surface">City Cars - La Goulette</span>
                  <span className="font-body-sm text-[11px] text-on-surface-variant">Showroom & Grand Atelier Agréé</span>
                </div>
              </div>

              {/* Price card */}
              <div className="p-3.5 rounded-xl bg-surface-container flex flex-col gap-1 border border-surface-container-high">
                <div className="flex items-center justify-between">
                  <span className="font-body-sm text-xs text-on-surface-variant">Total Estimatif Indicatif :</span>
                  <span className="font-headline-sm text-base sm:text-lg font-bold text-on-surface font-mono">
                    {selectedService.price > 0 ? `${selectedService.price} DT` : 'Sur devis'}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-on-surface-variant font-label-sm text-[10px]">
                  <span className="material-symbols-outlined text-secondary text-xs">check_circle</span>
                  <span>TVA et main-d'œuvre comprises</span>
                </div>
              </div>
            </div>

            {/* Confirmation CTA */}
            <div className="flex flex-col gap-2">
              {isSuccess && selectedDate ? (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-center flex flex-col items-center gap-1.5">
                  <span className="material-symbols-outlined text-2xl text-emerald-600">check_circle</span>
                  <span className="font-headline-sm text-sm font-bold">Demande de RDV Envoyée !</span>
                  <p className="font-body-sm text-xs text-emerald-800">
                    Transmis au Chef d'Atelier pour le {formatSelectedDateFull(selectedDate)} à{' '}
                    {selectedTime} ({currentVehicle.plate}). En attente de réponse du Chef avant toute autre réservation.
                  </p>
                  {onNavigateToAssistance && (
                    <button
                      type="button"
                      onClick={onNavigateToAssistance}
                      className="mt-1 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-colors"
                    >
                      Gérer mon RDV (Assistance & Devis)
                    </button>
                  )}
                </div>
              ) : pendingChefAppt ? (
                <button
                  type="button"
                  disabled
                  className="w-full py-3.5 px-4 rounded-xl bg-surface-container-high text-on-surface-variant font-headline-sm text-xs sm:text-sm font-bold border border-outline/30 cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">lock</span>
                  <span>Bloqué — En attente de réponse Chef</span>
                </button>
              ) : selectedDate && currentSlotCheck.available ? (
                <button
                  onClick={handleConfirm}
                  className="w-full py-3.5 px-4 rounded-xl bg-secondary text-on-secondary font-headline-sm text-sm sm:text-base font-bold shadow-md hover:bg-secondary-container transition-all flex items-center justify-center gap-2 active:scale-95"
                  type="button"
                >
                  <span>Confirmer mon Rendez-vous SAV</span>
                  <span className="material-symbols-outlined text-lg">arrow_forward</span>
                </button>
              ) : selectedDate ? (
                <button
                  type="button"
                  disabled
                  className="w-full py-3.5 px-4 rounded-xl bg-surface-container-high text-on-surface-variant font-headline-sm text-xs sm:text-sm font-bold border border-outline/30 cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-lg">schedule</span>
                  <span>Horaire fermé (délai min. +{leadHours}h / planning)</span>
                </button>
              ) : (
                <button
                  onClick={onNavigateToAssistance}
                  className="w-full py-3.5 px-4 rounded-xl bg-primary text-on-primary font-headline-sm text-sm font-bold shadow-md hover:bg-[#1a2a38] transition-all flex items-center justify-center gap-2 active:scale-95"
                  type="button"
                >
                  <span className="material-symbols-outlined text-lg">support_agent</span>
                  <span>Planifier avec le Chef (Assistance)</span>
                </button>
              )}

              <p className="font-label-sm text-[10px] text-center text-on-surface-variant flex items-center justify-center gap-1">
                <span className="material-symbols-outlined text-xs text-emerald-600">lock_reset</span>
                <span>Modification & annulation dans Assistance & Devis (au moins {deadlineHours}h avant)</span>
              </p>
            </div>

            {/* Hotline */}
            <div className="p-2.5 rounded-xl bg-surface-container-low flex items-center gap-2.5 border border-surface-container-high">
              <span className="material-symbols-outlined text-secondary text-lg">phone_in_talk</span>
              <div className="flex flex-col">
                <span className="font-label-sm text-[10px] text-on-surface-variant">Besoin d'aide immédiate ?</span>
                <span className="font-label-md text-xs font-bold text-on-surface">SAV Kia : 36 406 000</span>
              </div>
            </div>
          </div>

          {/* Guarantee Badge */}
          <div className="p-3.5 rounded-2xl bg-surface-container-low flex items-center gap-3 border border-surface-container-high">
            <div className="w-10 h-10 rounded-full bg-secondary-fixed flex items-center justify-center text-on-secondary-fixed-variant flex-shrink-0">
              <span className="material-symbols-outlined text-lg">verified</span>
            </div>
            <div className="flex flex-col">
              <span className="font-body-sm text-xs font-bold text-on-surface">Maintien de la Garantie 5 Ans</span>
              <span className="font-body-sm text-[11px] text-on-surface-variant leading-tight">
                Chaque intervention officielle est consignée dans le carnet d'entretien numérique Kia Tunisie.
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
