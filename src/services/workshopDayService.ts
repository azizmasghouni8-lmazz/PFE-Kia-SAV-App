// Service de génération dynamique des statistiques journalières pour le Chef d'Atelier
// Adapté aux horaires et flux réels de l'Atelier Central City Cars Kia Tunisie (La Goulette)
import { workshopSyncService, WorkshopBay, WorkshopTechnician } from './workshopSyncService';
import { INITIAL_ORDERS } from '../data/mockData';

export interface DailyKPIs {
  rdvTotal: number;
  rdvOk: number;
  rdvArrives: number;
  rdvRetard: number;
  occupationRate: number; // pourcentage (ex: 85)
  occupiedPostsCount: number; // ex: 10 sur ponts ouverts
  totalOpenPostsCount: number; // nombre réel de ponts ouverts (hors maintenance)
  orEnCours: number;
  cadenceMoy: string;
  restitutionsTotal: number;
  restitutionsPretes: number;
  restitutionsLavage: number;
  respectDelais: number; // pourcentage
  respectDelta: string;
  caPrevisionnel: string;
}

export interface DailyTimelineItem {
  id: string;
  time: string;
  bay: string;
  vehicleName: string;
  plate: string;
  status: 'arrived' | 'in_progress' | 'confirmed' | 'ready';
  statusBadge: string;
  badgeColor: 'secondary' | 'primary' | 'emerald' | 'surface';
  clientName: string;
  clientPhone?: string;
  service: string;
  advisorOrTech: string;
  progressPercent?: number;
  remainingTime?: string;
  price?: string;
  actionType: 'checkin' | 'view_or' | 'reception' | 'notify' | 'restitution';
}

export interface DailyPostStatus {
  id: string;
  name: string;
  type: string;
  current: string;
  status: 'active' | 'available' | 'reserved' | 'maintenance';
  color: 'secondary' | 'primary' | 'outline' | 'maintenance';
  techName?: string;
  vehiclePlate?: string;
  maintenanceReason?: string;
}

export interface DailyAlert {
  id: string;
  icon: string;
  title: string;
  description: string;
  meta: string;
  urgency: 'high' | 'medium' | 'info';
}

export interface DailyTechnician {
  id: string;
  name: string;
  initials: string;
  role: string;
  badge: string;
  status: string;
  statusClass: string;
  loadPercent: number;
  availableAt: string;
  avatar?: string;
  isAvailable?: boolean;
}

export interface DailyWorkshopData {
  date: Date;
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
  isSunday: boolean;
  isSaturday: boolean;
  isClosedBySettings?: boolean;
  formattedDateFull: string;
  formattedHeaderLabel: string;
  dateIsoString: string;
  kpis: DailyKPIs;
  timeline: DailyTimelineItem[];
  posts: DailyPostStatus[];
  technicians: DailyTechnician[];
  alerts: DailyAlert[];
}

const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

const DAYS_FR = [
  'Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'
];

export function formatDateToFrench(date: Date): string {
  const dayName = DAYS_FR[date.getDay()];
  const dayNumber = date.getDate();
  const monthName = MONTHS_FR[date.getMonth()];
  const year = date.getFullYear();
  return `${dayName} ${dayNumber} ${monthName} ${year}`;
}

export function formatDateHeaderLabel(date: Date, today: Date): string {
  const isSameDay =
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();

  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const isTomorrow =
    date.getDate() === tomorrow.getDate() &&
    date.getMonth() === tomorrow.getMonth() &&
    date.getFullYear() === tomorrow.getFullYear();

  const full = formatDateToFrench(date);

  if (isSameDay) return `Aujourd'hui, ${full}`;
  if (isYesterday) return `Hier, ${full}`;
  if (isTomorrow) return `Demain, ${full}`;
  return full;
}

export function getDailyWorkshopData(targetDate: Date): DailyWorkshopData {
  const today = new Date();
  const isToday =
    targetDate.getDate() === today.getDate() &&
    targetDate.getMonth() === today.getMonth() &&
    targetDate.getFullYear() === today.getFullYear();

  const isPast = targetDate.getTime() < new Date(today.setHours(0, 0, 0, 0)).getTime();
  const isFuture = targetDate.getTime() > new Date(today.setHours(23, 59, 59, 999)).getTime();

  const dayOfWeek = targetDate.getDay(); // 0 = Dimanche, 1 = Lundi, ..., 6 = Samedi
  const isSunday = dayOfWeek === 0;
  const isSaturday = dayOfWeek === 6;

  // Calcul d'un petit offset pseudo-déterministe basé sur le jour du mois pour un rendu naturel
  const dateSeed = (targetDate.getDate() * 7 + (targetDate.getMonth() + 1) * 31) % 5;

  const isoYear = targetDate.getFullYear();
  const isoMonth = String(targetDate.getMonth() + 1).padStart(2, '0');
  const isoDay = String(targetDate.getDate()).padStart(2, '0');
  const dateIsoString = `${isoYear}-${isoMonth}-${isoDay}`;

  const liveBays: WorkshopBay[] = workshopSyncService.getWorkshopBays();
  const liveTechs: WorkshopTechnician[] = workshopSyncService.getWorkshopTechnicians();
  const liveSettings = workshopSyncService.getWorkshopSettings();
  const openBaysCount = liveBays.filter((b) => b.status === 'open').length;
  const isClosedInSettings =
    liveSettings.closedDates.includes(dateIsoString) || (isSaturday && !liveSettings.saturdayEnabled);

  const buildLiveTechnicians = (closedMode: boolean): DailyTechnician[] => {
    return liveTechs
      .filter((t) => t.active)
      .map((t) => {
        const availLabel =
          closedMode
            ? 'Atelier fermé'
            : t.availability === 'en_poste'
            ? t.assignedBayId
              ? `En poste (Pont ${t.assignedBayId})`
              : 'En poste · Dispo'
            : t.availability === 'en_pause'
            ? 'En pause'
            : t.availability === 'essai_route'
            ? 'En essai route'
            : 'Absent';
        const statusClass =
          closedMode
            ? 'text-on-surface-variant'
            : t.availability === 'en_poste'
            ? 'text-emerald-700'
            : t.availability === 'absent'
            ? 'text-secondary'
            : 'text-amber-700';
        return {
          id: t.id,
          name: t.name,
          initials: t.initials,
          role: t.role,
          badge: t.certifications.includes('Haute Tension EV/HEV')
            ? 'Habilité EV/HEV'
            : t.certifications[0] || t.role,
          status: availLabel,
          statusClass,
          loadPercent: closedMode ? 0 : t.availability === 'absent' ? 0 : t.currentLoadPercent,
          availableAt: `${t.shiftStart}–${t.shiftEnd}`,
          avatar: t.avatar,
          isAvailable: t.availability === 'en_poste',
        };
      });
  };

  const buildDynamicAlerts = (baseAlerts: DailyAlert[]): DailyAlert[] => {
    const impactAlerts: DailyAlert[] = workshopSyncService
      .getAssignmentImpactAlerts(INITIAL_ORDERS)
      .map((imp) => ({
        id: imp.id,
        icon: imp.type === 'ev_cert_mismatch' ? 'bolt' : imp.type === 'bay_maintenance' ? 'build' : 'person_off',
        title:
          imp.type === 'ev_cert_mismatch'
            ? 'Sécurité Haute Tension EV'
            : imp.type === 'bay_maintenance'
            ? `Pont fermé : ${imp.resourceName}`
            : `Technicien indisponible : ${imp.resourceName}`,
        description: imp.message,
        meta: `${imp.orderId || imp.plate} · Réaffectation requise`,
        urgency: imp.severity,
      }));

    const lowStockThreshold = liveSettings.lowStockThreshold ?? 3;
    const lowStockParts = workshopSyncService
      .getPartsStock()
      .filter((p) => p.stockCount <= lowStockThreshold);
    const stockAlerts: DailyAlert[] =
      lowStockParts.length > 0
        ? [
            {
              id: 'alt-stock-threshold',
              icon: 'inventory_2',
              title: `${lowStockParts.length} référence(s) sous le seuil (${lowStockThreshold} u.)`,
              description: lowStockParts
                .slice(0, 3)
                .map((p) => `${p.name} (${p.stockCount})`)
                .join(' · '),
              meta: 'Seuil Magasin Paramétré',
              urgency: lowStockParts.some((p) => p.stockCount === 0) ? 'high' : 'medium',
            },
          ]
        : [];

    return [...impactAlerts, ...stockAlerts, ...baseAlerts];
  };

  // 1. DIMANCHE OU JOUR DE FERMETURE PARAMÉTRÉ : Atelier Fermé
  if (isSunday || isClosedInSettings) {
    const closedReason = isSunday
      ? 'Atelier Central fermé le dimanche'
      : isSaturday && !liveSettings.saturdayEnabled
      ? 'Atelier fermé le samedi (Paramètres Atelier)'
      : `Fermeture exceptionnelle programmée (${dateIsoString})`;
    return {
      date: targetDate,
      isToday,
      isPast,
      isFuture,
      isSunday,
      isSaturday,
      isClosedBySettings: isClosedInSettings,
      formattedDateFull: formatDateToFrench(targetDate),
      formattedHeaderLabel: formatDateHeaderLabel(targetDate, today),
      dateIsoString,
      kpis: {
        rdvTotal: 0,
        rdvOk: 0,
        rdvArrives: 0,
        rdvRetard: 0,
        occupationRate: 0,
        occupiedPostsCount: 0,
        totalOpenPostsCount: openBaysCount,
        orEnCours: 0,
        cadenceMoy: 'Atelier Fermé',
        restitutionsTotal: 0,
        restitutionsPretes: 0,
        restitutionsLavage: 0,
        respectDelais: 100,
        respectDelta: 'Conforme',
        caPrevisionnel: '0.000 TND TTC',
      },
      timeline: [],
      posts: liveBays.map((b) => ({
        id: b.id,
        name: b.name,
        type: b.specialty,
        current: b.status === 'maintenance' ? 'En maintenance' : 'Standby Fermeture',
        status: b.status === 'maintenance' ? 'maintenance' : 'available',
        color: b.status === 'maintenance' ? 'maintenance' : 'outline',
        techName: b.leadTechnicianName,
        maintenanceReason: b.maintenanceReason,
      })),
      technicians: buildLiveTechnicians(true),
      alerts: [
        {
          id: 'alt-sun-1',
          icon: 'contact_support',
          title: closedReason,
          description: `Permanence d'astreinte City Cars Assistance active 24/7 au ${liveSettings.dealershipPhone}.`,
          meta: `${liveSettings.dealershipName}`,
          urgency: 'info',
        },
        ...buildDynamicAlerts([]),
      ],
    };
  }

  // Helper pour construire l'état réel des 12 ponts en tenant compte de la maintenance et de la charge
  const buildPostsFromLiveBays = (basePosts: DailyPostStatus[]): DailyPostStatus[] => {
    const baseById = new Map(basePosts.map((p) => [p.id, p]));
    return liveBays.map((bay) => {
      if (bay.status === 'maintenance') {
        return {
          id: bay.id,
          name: bay.name,
          type: bay.specialty,
          current: bay.maintenanceReason || 'En maintenance',
          status: 'maintenance',
          color: 'maintenance',
          techName: bay.leadTechnicianName,
          maintenanceReason: bay.maintenanceReason,
        };
      }
      const template = baseById.get(bay.id);
      return {
        id: bay.id,
        name: bay.name,
        type: bay.specialty,
        current: template?.status === 'active' ? template.current : 'Libre',
        status: template?.status === 'active' ? 'active' : 'available',
        color: template?.status === 'active' ? template.color : 'outline',
        techName: bay.leadTechnicianName || template?.techName,
        vehiclePlate: template?.vehiclePlate,
      };
    });
  };

  // 2. SAMEDI : Service Express & Réceptions Matinales
  if (isSaturday) {
    const rdvTotal = 12 + (dateSeed % 2);
    const satPostsTemplate: DailyPostStatus[] = [
      { id: '01', name: 'PONT 01', type: 'Express', current: 'Picanto', status: 'active', color: 'secondary', techName: 'Mehdi Gharbi' },
      { id: '02', name: 'PONT 02', type: 'Vidange', current: 'Rio', status: 'active', color: 'primary', techName: 'Karim Trabelsi' },
      { id: '03', name: 'PONT 03', type: 'Freinage', current: 'Seltos', status: 'active', color: 'secondary', techName: 'Karim Trabelsi' },
      { id: '04', name: 'PONT 04', type: 'Mécanique', current: 'Sportage', status: 'active', color: 'primary', techName: 'Sofiene Riahi' },
      { id: '05', name: 'PONT 05', type: 'Disponible', current: 'Libre', status: 'available', color: 'outline' },
      { id: '06', name: 'PONT 06', type: 'Express', current: 'Stonic', status: 'active', color: 'primary', techName: 'Mehdi Gharbi' },
      { id: '07', name: 'PONT 07', type: 'Disponible', current: 'Libre', status: 'available', color: 'outline' },
      { id: '08', name: 'PONT 08', type: 'Diag BMS', current: 'Niro EV', status: 'active', color: 'primary', techName: 'Anis Jaziri' },
      { id: '09', name: 'PONT 09', type: 'Disponible', current: 'Libre', status: 'available', color: 'outline' },
      { id: '10', name: 'PONT 10', type: 'Disponible', current: 'Libre', status: 'available', color: 'outline' },
      { id: '11', name: 'PONT 11', type: 'Disponible', current: 'Libre', status: 'available', color: 'outline' },
      { id: '12', name: 'PONT 12', type: "Express 60'", current: 'Sonet', status: 'active', color: 'secondary', techName: 'Karim Trabelsi' },
    ];
    const resolvedSatPosts = buildPostsFromLiveBays(satPostsTemplate);
    const satOccupied = resolvedSatPosts.filter((p) => p.status === 'active').length;
    const satRate = openBaysCount > 0 ? Math.min(100, Math.round((satOccupied / openBaysCount) * 100)) : 0;

    return {
      date: targetDate,
      isToday,
      isPast,
      isFuture,
      isSunday: false,
      isSaturday: true,
      formattedDateFull: formatDateToFrench(targetDate),
      formattedHeaderLabel: formatDateHeaderLabel(targetDate, today),
      dateIsoString,
      kpis: {
        rdvTotal,
        rdvOk: 8,
        rdvArrives: 3,
        rdvRetard: 1,
        occupationRate: satRate,
        occupiedPostsCount: satOccupied,
        totalOpenPostsCount: openBaysCount,
        orEnCours: 4,
        cadenceMoy: '1.2h moy. (Express)',
        restitutionsTotal: 9,
        restitutionsPretes: 7,
        restitutionsLavage: 2,
        respectDelais: 98,
        respectDelta: '+4.8% vs S-1',
        caPrevisionnel: '4 450 TND TTC',
      },
      timeline: [
        {
          id: 'sat-1',
          time: '08:15',
          bay: 'Pont 01 Express',
          vehicleName: 'Kia Picanto GT-Line',
          plate: '204 TU 8920',
          status: 'arrived',
          statusBadge: 'ARRIVÉ / EN ATTENTE CHECK-IN',
          badgeColor: 'secondary',
          clientName: 'Yassine Meddeb',
          clientPhone: '+216 98 312 450',
          service: 'Entretien express 15 000 km + Filtres',
          advisorOrTech: 'Conseiller: R. Mansouri',
          actionType: 'checkin',
        },
        {
          id: 'sat-2',
          time: '08:45',
          bay: 'Pont #04',
          vehicleName: 'Kia Rio 1.2 CVVT',
          plate: '215 TU 3201',
          status: 'in_progress',
          statusBadge: 'EN ATELIER (PONT #04)',
          badgeColor: 'secondary',
          clientName: 'Aymen Cherif',
          clientPhone: '+216 55 480 219',
          service: 'Vidange Total Quartz 9000 & Contrôle pneumatiques',
          advisorOrTech: 'Tech: Mehdi Gharbi',
          progressPercent: 50,
          remainingTime: '25 min restantes',
          actionType: 'view_or',
        },
        {
          id: 'sat-3',
          time: '09:30',
          bay: 'Baie Diag EV',
          vehicleName: 'Kia Niro EV',
          plate: '238 TU 5092',
          status: 'confirmed',
          statusBadge: 'RDV CONFIRMÉ',
          badgeColor: 'surface',
          clientName: 'Nadia Larbi',
          clientPhone: '+216 22 710 640',
          service: 'Diagnostic chargeur embarqué OBC',
          advisorOrTech: 'Tech: Anis Jaziri',
          actionType: 'reception',
        },
        {
          id: 'sat-4',
          time: '10:15',
          bay: 'Parking Livr.',
          vehicleName: 'Kia Seltos 1.6 SX',
          plate: '221 TU 9081',
          status: 'ready',
          statusBadge: 'PRÊT POUR RESTITUTION',
          badgeColor: 'emerald',
          clientName: 'Kamel Dridi',
          clientPhone: '+216 97 115 890',
          service: 'Plaquettes de frein avant • Facture réglée',
          advisorOrTech: 'Dossier #OR-48902',
          price: '280,000 TND',
          actionType: 'restitution',
        },
      ],
      posts: resolvedSatPosts,
      technicians: buildLiveTechnicians(false),
      alerts: buildDynamicAlerts([
        {
          id: 'sat-alt-1',
          icon: 'schedule',
          title: `Clôture de la réception samedi à ${liveSettings.saturdayClose}`,
          description: `L'atelier assure la dépose et les livraisons rapides ce samedi (${liveSettings.saturdayOpen} – ${liveSettings.saturdayClose}).`,
          meta: 'Planning Samedi • Horaires Paramétrés',
          urgency: 'info',
        },
        {
          id: 'sat-alt-2',
          icon: 'verified',
          title: '7 véhicules prêts pour restitution',
          description: 'Préparation et contrôles lavages achevés pour la remise des clés.',
          meta: 'Comptoir SAV • Accueil',
          urgency: 'high',
        },
      ]),
    };
  }

  // 3. EN SEMAINE (Lundi à Vendredi) : Adapté au jour
  // dayOfWeek: 1 = Lun, 2 = Mar, 3 = Mer, 4 = Jeu, 5 = Ven
  const weekdayProfiles = {
    1: { // Lundi : forte reprise après weekend
      rdvTotal: 23 + (dateSeed % 2),
      rdvOk: 15,
      rdvArrives: 6,
      rdvRetard: 2,
      occupationRate: 92,
      occupiedPostsCount: 11,
      orEnCours: 9,
      cadenceMoy: '1.9h moy.',
      restitutionsTotal: 11,
      restitutionsPretes: 7,
      restitutionsLavage: 4,
      respectDelais: 92,
      respectDelta: '+1.5% vs S-1',
      caPrevisionnel: '8 650 TND TTC',
    },
    2: { // Mardi : rythme régulier
      rdvTotal: 19 + (dateSeed % 2),
      rdvOk: 13,
      rdvArrives: 4,
      rdvRetard: 2,
      occupationRate: 83,
      occupiedPostsCount: 10,
      orEnCours: 8,
      cadenceMoy: '1.7h moy.',
      restitutionsTotal: 8,
      restitutionsPretes: 5,
      restitutionsLavage: 3,
      respectDelais: 95,
      respectDelta: '+3.1% vs S-1',
      caPrevisionnel: '7 200 TND TTC',
    },
    3: { // Mercredi : mi-semaine
      rdvTotal: 17 + (dateSeed % 2),
      rdvOk: 12,
      rdvArrives: 4,
      rdvRetard: 1,
      occupationRate: 75,
      occupiedPostsCount: 9,
      orEnCours: 7,
      cadenceMoy: '1.8h moy.',
      restitutionsTotal: 9,
      restitutionsPretes: 6,
      restitutionsLavage: 3,
      respectDelais: 94,
      respectDelta: '+2.0% vs S-1',
      caPrevisionnel: '6 850 TND TTC',
    },
    4: { // Jeudi : montée en charge
      rdvTotal: 21 + (dateSeed % 2),
      rdvOk: 14,
      rdvArrives: 5,
      rdvRetard: 2,
      occupationRate: 88,
      occupiedPostsCount: 10,
      orEnCours: 9,
      cadenceMoy: '1.8h moy.',
      restitutionsTotal: 12,
      restitutionsPretes: 8,
      restitutionsLavage: 4,
      respectDelais: 93,
      respectDelta: '+1.9% vs S-1',
      caPrevisionnel: '8 100 TND TTC',
    },
    5: { // Vendredi : pic d'activité avant week-end (100% ponts)
      rdvTotal: 25 + (dateSeed % 2),
      rdvOk: 17,
      rdvArrives: 6,
      rdvRetard: 2,
      occupationRate: 100,
      occupiedPostsCount: 12,
      orEnCours: 11,
      cadenceMoy: '1.6h moy.',
      restitutionsTotal: 16,
      restitutionsPretes: 11,
      restitutionsLavage: 5,
      respectDelais: 96,
      respectDelta: '+4.2% vs S-1',
      caPrevisionnel: '9 950 TND TTC',
    },
  };

  const kpis = weekdayProfiles[dayOfWeek as 1 | 2 | 3 | 4 | 5] || weekdayProfiles[5];

  // Modèles de véhicules variés selon le jour
  const timelinePerDay: Record<number, DailyTimelineItem[]> = {
    1: [ // Lundi (Matin + Après-midi / Soir)
      {
        id: 'mon-1',
        time: '08:00',
        bay: 'Pont 01',
        vehicleName: 'Kia Sportage GT-Line',
        plate: '228 TU 4591',
        status: 'arrived',
        statusBadge: 'ARRIVÉ / EN ATTENTE CHECK-IN',
        badgeColor: 'secondary',
        clientName: 'Sami Ben Amor',
        clientPhone: '+216 98 400 123',
        service: 'Révision 30 000 km + Contrôle freins',
        advisorOrTech: 'Conseiller: R. Mansouri',
        actionType: 'checkin',
      },
      {
        id: 'mon-2',
        time: '08:45',
        bay: 'Pont 02',
        vehicleName: 'Kia Seltos 1.6 SX',
        plate: '219 TU 3412',
        status: 'in_progress',
        statusBadge: 'EN ATELIER (PONT #02)',
        badgeColor: 'secondary',
        clientName: 'Mounir Zaouali',
        clientPhone: '+216 55 218 904',
        service: 'Remplacement plaquettes et disques avant',
        advisorOrTech: 'Tech: Karim Trabelsi',
        progressPercent: 70,
        remainingTime: '35 min restantes',
        actionType: 'view_or',
      },
      {
        id: 'mon-3',
        time: '09:30',
        bay: 'Baie EV',
        vehicleName: 'Kia EV6 GT 585 ch',
        plate: '234 TU 1120',
        status: 'confirmed',
        statusBadge: 'RDV CONFIRMÉ',
        badgeColor: 'surface',
        clientName: 'Moncef Khelifi',
        clientPhone: '+216 98 650 312',
        service: 'Mise à jour BMS v2.1 & Diagnostic Haute Tension',
        advisorOrTech: 'Tech: Anis Jaziri',
        actionType: 'reception',
      },
      {
        id: 'mon-4',
        time: '10:30',
        bay: 'Pont 06',
        vehicleName: 'Kia Picanto GT-Line',
        plate: '204 TU 8920',
        status: 'confirmed',
        statusBadge: 'RDV CONFIRMÉ',
        badgeColor: 'surface',
        clientName: 'Yassine Meddeb',
        clientPhone: '+216 98 312 450',
        service: 'Entretien annuel 15 000 km',
        advisorOrTech: 'Conseiller: H. Mansour',
        actionType: 'notify',
      },
      {
        id: 'mon-5',
        time: '11:15',
        bay: 'Parking Livr.',
        vehicleName: 'Kia Ceed Sportswagon',
        plate: '210 TU 5530',
        status: 'ready',
        statusBadge: 'PRÊT POUR RESTITUTION',
        badgeColor: 'emerald',
        clientName: 'Leila Ben Mahmoud',
        clientPhone: '+216 22 904 118',
        service: "Courroie d'accessoire & galets • Facture 428,500 TND",
        advisorOrTech: 'OR #48921',
        price: '428,500 TND',
        actionType: 'restitution',
      },
      {
        id: 'mon-6',
        time: '14:00',
        bay: 'Pont 03',
        vehicleName: 'Kia Sportage GT-Line 1.6 T-GDi',
        plate: '235 TU 8812',
        status: 'confirmed',
        statusBadge: 'RDV APRÈS-MIDI CONFIRMÉ',
        badgeColor: 'surface',
        clientName: 'Aziz Masghouni',
        clientPhone: '+216 98 123 456',
        service: 'Contrôle freinage & équilibrage pneumatiques',
        advisorOrTech: 'Conseiller: H. Mansour',
        actionType: 'checkin',
      },
      {
        id: 'mon-7',
        time: '15:30',
        bay: 'Pont 05',
        vehicleName: 'Kia Sonet Turbo',
        plate: '227 TU 6108',
        status: 'confirmed',
        statusBadge: 'RDV APRÈS-MIDI CONFIRMÉ',
        badgeColor: 'surface',
        clientName: 'Inès Ben Youssef',
        clientPhone: '+216 54 330 781',
        service: 'Recharge climatisation R1234yf & filtre habitacle',
        advisorOrTech: 'Tech: Mehdi Gharbi',
        actionType: 'reception',
      },
      {
        id: 'mon-8',
        time: '16:45',
        bay: 'Baie Diag KDS',
        vehicleName: 'Kia Niro HEV',
        plate: '232 TU 7740',
        status: 'confirmed',
        statusBadge: 'RDV FIN DE JOURNÉE / SOIR',
        badgeColor: 'surface',
        clientName: 'Nabil Bouazizi',
        clientPhone: '+216 99 412 605',
        service: 'Diagnostic valise KDS & contrôle hybride',
        advisorOrTech: 'Tech: Anis Jaziri',
        actionType: 'notify',
      },
    ],
    2: [ // Mardi (Matin + Après-midi / Soir)
      {
        id: 'tue-1',
        time: '08:30',
        bay: 'Pont 01',
        vehicleName: 'Kia Sorento HEV 4WD',
        plate: '219 TU 8874',
        status: 'arrived',
        statusBadge: 'ARRIVÉ / EN ATTENTE CHECK-IN',
        badgeColor: 'secondary',
        clientName: 'Sihem Bouazizi',
        clientPhone: '+216 98 712 004',
        service: 'Diagnostic train avant & purge de freins',
        advisorOrTech: 'Conseiller: R. Mansouri',
        actionType: 'checkin',
      },
      {
        id: 'tue-2',
        time: '09:15',
        bay: 'Pont 03',
        vehicleName: 'Kia Stonic 1.0 T-GDi',
        plate: '214 TU 5290',
        status: 'in_progress',
        statusBadge: 'EN ATELIER (PONT #03)',
        badgeColor: 'secondary',
        clientName: 'Tarak Hammami',
        clientPhone: '+216 52 890 134',
        service: 'Bougies d’allumage & décalaminage admission',
        advisorOrTech: 'Tech: Mehdi Gharbi',
        progressPercent: 45,
        remainingTime: '50 min restantes',
        actionType: 'view_or',
      },
      {
        id: 'tue-3',
        time: '10:00',
        bay: 'Baie Diag EV',
        vehicleName: 'Kia EV9 Earth 4WD',
        plate: '240 TU 7710',
        status: 'confirmed',
        statusBadge: 'RDV CONFIRMÉ',
        badgeColor: 'surface',
        clientName: 'Dr. Faouzi Belhaj',
        clientPhone: '+216 98 205 991',
        service: 'Contrôle ADAS & LiDAR + recharge rapide atelier',
        advisorOrTech: 'Spécialiste: Anis Jaziri',
        actionType: 'reception',
      },
      {
        id: 'tue-4',
        time: '11:45',
        bay: 'Parking Livr.',
        vehicleName: 'Kia Sonet Turbo',
        plate: '224 TU 6511',
        status: 'ready',
        statusBadge: 'PRÊT POUR RESTITUTION',
        badgeColor: 'emerald',
        clientName: 'Chiraz Ben Ayed',
        clientPhone: '+216 24 611 380',
        service: 'Entretien 20 000 km • Lavage offert OK',
        advisorOrTech: 'OR #49012',
        price: '385,000 TND',
        actionType: 'restitution',
      },
      {
        id: 'tue-5',
        time: '14:15',
        bay: 'Pont 04',
        vehicleName: 'Kia Cerato GT-Line',
        plate: '222 TU 4190',
        status: 'confirmed',
        statusBadge: 'RDV APRÈS-MIDI CONFIRMÉ',
        badgeColor: 'surface',
        clientName: 'Hichem Slama',
        clientPhone: '+216 97 530 221',
        service: 'Vidange boîte DCT7 & contrôle embrayage',
        advisorOrTech: 'Tech: Karim Trabelsi',
        actionType: 'checkin',
      },
      {
        id: 'tue-6',
        time: '16:30',
        bay: 'Pont 09',
        vehicleName: 'Kia Rio Berline',
        plate: '216 TU 8045',
        status: 'confirmed',
        statusBadge: 'RDV FIN DE JOURNÉE / SOIR',
        badgeColor: 'surface',
        clientName: 'Olfa Messaoudi',
        clientPhone: '+216 50 119 442',
        service: 'Géométrie 3D & permutation pneus',
        advisorOrTech: 'Conseiller: H. Mansour',
        actionType: 'notify',
      },
    ],
    3: [ // Mercredi (Matin + Après-midi / Soir)
      {
        id: 'wed-1',
        time: '08:15',
        bay: 'Pont 02',
        vehicleName: 'Kia K5 Fastback 2.5',
        plate: '225 TU 3109',
        status: 'arrived',
        statusBadge: 'ARRIVÉ / EN ATTENTE CHECK-IN',
        badgeColor: 'secondary',
        clientName: 'Mehdi Ben Romdhane',
        clientPhone: '+216 98 340 778',
        service: 'Géométrie 3D & équilibrage dynamique',
        advisorOrTech: 'Conseiller: R. Mansouri',
        actionType: 'checkin',
      },
      {
        id: 'wed-2',
        time: '09:00',
        bay: 'Pont 05',
        vehicleName: 'Kia Rio 1.2 CVVT',
        plate: '208 TU 1450',
        status: 'in_progress',
        statusBadge: 'EN ATELIER (PONT #05)',
        badgeColor: 'secondary',
        clientName: 'Salma Guedria',
        clientPhone: '+216 29 512 308',
        service: 'Remplacement amortisseurs avant & biellettes',
        advisorOrTech: 'Tech: Karim Trabelsi',
        progressPercent: 80,
        remainingTime: '20 min restantes',
        actionType: 'view_or',
      },
      {
        id: 'wed-3',
        time: '10:15',
        bay: 'Pont 08',
        vehicleName: 'Kia Carens 7 Places',
        plate: '218 TU 4412',
        status: 'confirmed',
        statusBadge: 'RDV CONFIRMÉ',
        badgeColor: 'surface',
        clientName: 'Khaled Ferchichi',
        clientPhone: '+216 95 604 119',
        service: 'Recharge climatisation R1234yf + filtre habitacle',
        advisorOrTech: 'Tech: Mehdi Gharbi',
        actionType: 'reception',
      },
      {
        id: 'wed-4',
        time: '11:30',
        bay: 'Parking Livr.',
        vehicleName: 'Kia Sportage Black Edition',
        plate: '226 TU 9980',
        status: 'ready',
        statusBadge: 'PRÊT POUR RESTITUTION',
        badgeColor: 'emerald',
        clientName: 'Houssem Trad',
        clientPhone: '+216 98 991 205',
        service: 'Vidange boîte DCT & purge liquide de freins',
        advisorOrTech: 'OR #49120',
        price: '540,000 TND',
        actionType: 'restitution',
      },
      {
        id: 'wed-5',
        time: '14:30',
        bay: 'Pont 01',
        vehicleName: 'Kia Picanto X-Line',
        plate: '229 TU 2271',
        status: 'confirmed',
        statusBadge: 'RDV APRÈS-MIDI CONFIRMÉ',
        badgeColor: 'surface',
        clientName: 'Marwa Kaddour',
        clientPhone: '+216 53 774 190',
        service: 'Révision 15 000 km & filtres OEM',
        advisorOrTech: 'Conseiller: H. Mansour',
        actionType: 'checkin',
      },
      {
        id: 'wed-6',
        time: '16:15',
        bay: 'Baie EV',
        vehicleName: 'Kia EV6 Air',
        plate: '241 TU 1044',
        status: 'confirmed',
        statusBadge: 'RDV FIN DE JOURNÉE / SOIR',
        badgeColor: 'surface',
        clientName: 'Rami Ben Ali',
        clientPhone: '+216 98 441 820',
        service: 'Diagnostic charge rapide DC & équilibrage cellules',
        advisorOrTech: 'Tech: Anis Jaziri',
        actionType: 'notify',
      },
    ],
    4: [ // Jeudi (Matin + Après-midi / Soir)
      {
        id: 'thu-1',
        time: '08:20',
        bay: 'Pont 01',
        vehicleName: 'Kia Cerato Sedan',
        plate: '211 TU 6632',
        status: 'arrived',
        statusBadge: 'ARRIVÉ / EN ATTENTE CHECK-IN',
        badgeColor: 'secondary',
        clientName: 'Zouhair Miled',
        clientPhone: '+216 98 220 417',
        service: 'Contrôle embrayage & révision 60 000 km',
        advisorOrTech: 'Conseiller: R. Mansouri',
        actionType: 'checkin',
      },
      {
        id: 'thu-2',
        time: '09:00',
        bay: 'Baie EV #08',
        vehicleName: 'Kia Niro PHEV',
        plate: '230 TU 4011',
        status: 'in_progress',
        statusBadge: 'EN DIAGNOSTIC KDS',
        badgeColor: 'secondary',
        clientName: 'Habib Boukhris',
        clientPhone: '+216 55 882 310',
        service: 'Mise à niveau calculateur hybride & test batterie',
        advisorOrTech: 'Tech: Anis Jaziri',
        progressPercent: 55,
        remainingTime: '40 min',
        actionType: 'view_or',
      },
      {
        id: 'thu-3',
        time: '10:30',
        bay: 'Pont 04',
        vehicleName: 'Kia Sportage 1.6 T-GDi',
        plate: '229 TU 1845',
        status: 'confirmed',
        statusBadge: 'RDV CONFIRMÉ',
        badgeColor: 'surface',
        clientName: 'Amel Karoui',
        clientPhone: '+216 21 664 902',
        service: 'Plaquettes arrière & liquide de refroidissement',
        advisorOrTech: 'Tech: Karim Trabelsi',
        actionType: 'notify',
      },
      {
        id: 'thu-4',
        time: '11:45',
        bay: 'Parking Livr.',
        vehicleName: 'Kia Ceed GT Line',
        plate: '217 TU 8021',
        status: 'ready',
        statusBadge: 'PRÊT POUR RESTITUTION',
        badgeColor: 'emerald',
        clientName: 'Bilel Trabelsi',
        clientPhone: '+216 97 309 551',
        service: 'Révision 45 000 km • Contrôle 75 points validé',
        advisorOrTech: 'OR #49280',
        price: '460,000 TND',
        actionType: 'restitution',
      },
      {
        id: 'thu-5',
        time: '14:00',
        bay: 'Pont 06',
        vehicleName: 'Kia Stonic Style',
        plate: '221 TU 7390',
        status: 'confirmed',
        statusBadge: 'RDV APRÈS-MIDI CONFIRMÉ',
        badgeColor: 'surface',
        clientName: 'Nourhène Jebali',
        clientPhone: '+216 58 190 432',
        service: 'Entretien 30 000 km & désinfection climatisation',
        advisorOrTech: 'Tech: Mehdi Gharbi',
        actionType: 'checkin',
      },
      {
        id: 'thu-6',
        time: '16:45',
        bay: 'Pont 02',
        vehicleName: 'Kia Sorento 2.2 CRDi',
        plate: '216 TU 5119',
        status: 'confirmed',
        statusBadge: 'RDV FIN DE JOURNÉE / SOIR',
        badgeColor: 'surface',
        clientName: 'Lotfi Gharbi',
        clientPhone: '+216 98 503 811',
        service: 'Vidange complète & remplacement filtre à gazole',
        advisorOrTech: 'Conseiller: H. Mansour',
        actionType: 'reception',
      },
    ],
    5: [ // Vendredi (Matin + Après-midi / Soir)
      {
        id: 'fri-1',
        time: '08:30',
        bay: 'Pont 01',
        vehicleName: 'Kia Sportage GT-Line',
        plate: '228 TU 4591',
        status: 'arrived',
        statusBadge: 'ARRIVÉ / EN ATTENTE CHECK-IN',
        badgeColor: 'secondary',
        clientName: 'Sami Ben Amor',
        clientPhone: '+216 98 400 123',
        service: 'Révision complète 30 000 km + Contrôle freins',
        advisorOrTech: 'Conseiller: R. Mansouri',
        actionType: 'checkin',
      },
      {
        id: 'fri-2',
        time: '09:15',
        bay: 'Baie EV',
        vehicleName: 'Kia EV6 GT 585 ch',
        plate: '234 TU 1120',
        status: 'confirmed',
        statusBadge: 'RDV CONFIRMÉ',
        badgeColor: 'surface',
        clientName: 'Moncef Khelifi',
        clientPhone: '+216 98 650 312',
        service: 'Diagnostic Batterie HV & Mise à jour BMS v2.1',
        advisorOrTech: 'Habilitation Haute Tension (A. Jaziri)',
        actionType: 'reception',
      },
      {
        id: 'fri-3',
        time: '10:00',
        bay: 'Pont #03',
        vehicleName: 'Kia Sorento HEV 4WD',
        plate: '219 TU 8874',
        status: 'in_progress',
        statusBadge: 'EN ATELIER (PONT #03)',
        badgeColor: 'secondary',
        clientName: 'Sihem Bouazizi',
        clientPhone: '+216 98 712 004',
        service: 'Bruit train avant & purge liquide frein',
        advisorOrTech: 'Tech: Karim Trabelsi',
        progressPercent: 65,
        remainingTime: '45 min restantes',
        actionType: 'view_or',
      },
      {
        id: 'fri-4',
        time: '10:45',
        bay: 'Pont 06',
        vehicleName: 'Kia Picanto GT-Line',
        plate: '204 TU 8920',
        status: 'confirmed',
        statusBadge: 'RDV CONFIRMÉ',
        badgeColor: 'surface',
        clientName: 'Yassine Meddeb',
        clientPhone: '+216 98 312 450',
        service: 'Entretien standard 15 000 km (Total Quartz + Filtres)',
        advisorOrTech: 'Conseiller: H. Mansour',
        actionType: 'notify',
      },
      {
        id: 'fri-5',
        time: '11:30',
        bay: 'Parking Livr.',
        vehicleName: 'Kia Ceed Sportswagon',
        plate: '210 TU 5530',
        status: 'ready',
        statusBadge: 'PRÊT POUR RESTITUTION',
        badgeColor: 'emerald',
        clientName: 'Leila Ben Mahmoud',
        clientPhone: '+216 22 904 118',
        service: "OR #48921 • Courroie d'accessoire & galets (Lavage OK)",
        advisorOrTech: 'Facture émise',
        price: '428,500 TND',
        actionType: 'restitution',
      },
      {
        id: 'fri-6',
        time: '14:30',
        bay: 'Pont 04',
        vehicleName: 'Kia Seltos SX',
        plate: '223 TU 6718',
        status: 'confirmed',
        statusBadge: 'RDV APRÈS-MIDI CONFIRMÉ',
        badgeColor: 'surface',
        clientName: 'Dr. Amine Khelil',
        clientPhone: '+216 97 840 112',
        service: 'Entretien 40 000 km & contrôle freinage',
        advisorOrTech: 'Tech: Karim Trabelsi',
        actionType: 'checkin',
      },
      {
        id: 'fri-7',
        time: '16:30',
        bay: 'Pont 10',
        vehicleName: 'Kia Carens 1.5',
        plate: '233 TU 9201',
        status: 'confirmed',
        statusBadge: 'RDV FIN DE JOURNÉE / SOIR',
        badgeColor: 'surface',
        clientName: 'Wissem Zouari',
        clientPhone: '+216 56 410 298',
        service: 'Recharge climatisation & diagnostic électronique',
        advisorOrTech: 'Conseiller: H. Mansour',
        actionType: 'reception',
      },
    ],
  };

  const timeline = timelinePerDay[dayOfWeek] || timelinePerDay[5];

  const basePostsTemplate: DailyPostStatus[] = [
    { id: '01', name: 'PONT 01', type: 'Check-in', current: 'Sportage GT', status: 'active', color: 'secondary', techName: 'Mehdi Gharbi', vehiclePlate: '228 TU 4591' },
    { id: '02', name: 'PONT 02', type: 'Mécanique', current: 'Seltos SX', status: 'active', color: 'primary', techName: 'Karim Trabelsi', vehiclePlate: '219 TU 3412' },
    { id: '03', name: 'PONT 03', type: 'Freinage', current: 'Sorento HEV', status: 'active', color: 'secondary', techName: 'Karim Trabelsi', vehiclePlate: '219 TU 8874' },
    { id: '04', name: 'PONT 04', type: 'Vidange Rapide', current: 'Rio 1.2', status: 'active', color: 'primary', techName: 'Karim Trabelsi', vehiclePlate: '208 TU 1450' },
    {
      id: '05',
      name: 'PONT 05',
      type: kpis.occupiedPostsCount >= 11 ? 'Embrayage' : 'Disponible',
      current: kpis.occupiedPostsCount >= 11 ? 'Cerato' : 'Libre',
      status: kpis.occupiedPostsCount >= 11 ? 'active' : 'available',
      color: kpis.occupiedPostsCount >= 11 ? 'primary' : 'outline',
      techName: kpis.occupiedPostsCount >= 11 ? 'Mehdi Gharbi' : undefined,
    },
    { id: '06', name: 'PONT 06', type: 'Service 15k', current: 'Picanto GT', status: 'active', color: 'primary', techName: 'Mehdi Gharbi', vehiclePlate: '204 TU 8920' },
    {
      id: '07',
      name: 'PONT 07',
      type: kpis.occupiedPostsCount >= 10 ? 'Suspension' : 'Disponible',
      current: kpis.occupiedPostsCount >= 10 ? 'Sonet Turbo' : 'Libre',
      status: kpis.occupiedPostsCount >= 10 ? 'active' : 'available',
      color: kpis.occupiedPostsCount >= 10 ? 'primary' : 'outline',
    },
    { id: '08', name: 'PONT 08', type: 'Diag BMS', current: 'EV6 GT', status: 'active', color: 'secondary', techName: 'Anis Jaziri', vehiclePlate: '234 TU 1120' },
    { id: '09', name: 'PONT 09', type: 'Géométrie', current: 'K5 Fastback', status: 'active', color: 'primary', techName: 'Sofiene Riahi', vehiclePlate: '225 TU 3109' },
    { id: '10', name: 'PONT 10', type: 'Climatisation', current: 'Carens 7P', status: 'active', color: 'primary', techName: 'Anis Jaziri', vehiclePlate: '218 TU 4412' },
    {
      id: '11',
      name: 'PONT 11',
      type: kpis.occupiedPostsCount >= 12 ? 'Distribution' : 'Disponible',
      current: kpis.occupiedPostsCount >= 12 ? 'Ceed SW' : 'Libre',
      status: kpis.occupiedPostsCount >= 12 ? 'active' : 'available',
      color: kpis.occupiedPostsCount >= 12 ? 'primary' : 'outline',
    },
    { id: '12', name: 'PONT 12', type: "Express 60'", current: 'Stonic 1.0', status: 'active', color: 'secondary', techName: 'Karim Trabelsi', vehiclePlate: '214 TU 5290' },
  ];

  const posts = buildPostsFromLiveBays(basePostsTemplate);
  const actualOccupiedCount = posts.filter((p) => p.status === 'active').length;
  const actualOccupationRate =
    openBaysCount > 0 ? Math.min(100, Math.round((actualOccupiedCount / openBaysCount) * 100)) : 0;

  const technicians = buildLiveTechnicians(false);

  // Alertes adaptées au jour
  const alertsPerDay: Record<number, DailyAlert[]> = {
    1: [
      {
        id: 'alt-1',
        icon: 'local_shipping',
        title: 'Arrivage Pièces d’Origine Kia Mobis',
        description: 'Livraison hebdomadaire de filtres, plaquettes et fluides certifiés réceptionnée au magasin.',
        meta: 'Magasin Central • 07:45',
        urgency: 'info',
      },
      {
        id: 'alt-2',
        icon: 'schedule',
        title: 'Afflux de réceptions lundi matin',
        description: '6 véhicules arrivés avant 08h30 pour prise en charge express début de semaine.',
        meta: 'Accueil SAV • En cours',
        urgency: 'high',
      },
    ],
    2: [
      {
        id: 'alt-3',
        icon: 'inventory_2',
        title: 'Pièce Réf 58101-D7A00 disponible',
        description: 'Jeu de plaquettes avant pour Sportage mis à disposition en Baie #03.',
        meta: 'Magasin Central • Il y a 10 min',
        urgency: 'info',
      },
      {
        id: 'alt-4',
        icon: 'sms',
        title: 'Retard client 09h15 notifié',
        description: 'Le propriétaire du Kia Sorento signale 15 min de décalage suite trafic autoroutier.',
        meta: 'SMS Automatique • 08:55',
        urgency: 'medium',
      },
    ],
    3: [
      {
        id: 'alt-5',
        icon: 'security_update',
        title: 'Mise à jour KDS Software v2.4',
        description: 'Nouvelle base de données cartographie injection disponible sur le serveur central Kia.',
        meta: 'Kia Global IT • Ce matin',
        urgency: 'info',
      },
      {
        id: 'alt-6',
        icon: 'verified',
        title: 'Audit Qualité Interne SAV',
        description: 'Contrôle des 75 points de sécurité sur 5 véhicules sortants conforme à 100%.',
        meta: 'Qualité City Cars • 11h00',
        urgency: 'info',
      },
    ],
    4: [
      {
        id: 'alt-7',
        icon: 'warning',
        title: 'Stock Huile 0W-30 Kia C2/C3 sous seuil',
        description: 'Réapprovisionnement automatique déclenché auprès de TotalEnergies Tunisie.',
        meta: 'Magasinier • 08:10',
        urgency: 'medium',
      },
      {
        id: 'alt-8',
        icon: 'car_repair',
        title: '12 restitutions programmées ce jour',
        description: 'Anticiper les lavages et fiches de clôture pour éviter l’attente en caisse.',
        meta: 'Supervision Chef • 09:00',
        urgency: 'high',
      },
    ],
    5: [ // Vendredi
      {
        id: 'alt-9',
        icon: 'speed',
        title: `Pic d’activité du vendredi (${actualOccupiedCount}/${openBaysCount} ponts ouverts)`,
        description: 'Les postes actifs sont mobilisés. Priorité aux restitutions avant week-end.',
        meta: 'Ordonnancement • Pleine charge',
        urgency: 'high',
      },
      {
        id: 'alt-10',
        icon: 'local_car_wash',
        title: 'Station de lavage finale opérationnelle',
        description: 'Cadence de 15 minutes par véhicule pour les sorties programmées.',
        meta: 'Baie Lavage • Fluide',
        urgency: 'info',
      },
    ],
  };

  const alerts = buildDynamicAlerts(alertsPerDay[dayOfWeek] || alertsPerDay[5]);

  return {
    date: targetDate,
    isToday,
    isPast,
    isFuture,
    isSunday: false,
    isSaturday: false,
    isClosedBySettings: false,
    formattedDateFull: formatDateToFrench(targetDate),
    formattedHeaderLabel: formatDateHeaderLabel(targetDate, today),
    dateIsoString,
    kpis: {
      ...kpis,
      occupiedPostsCount: actualOccupiedCount,
      totalOpenPostsCount: openBaysCount,
      occupationRate: actualOccupationRate,
    },
    timeline,
    posts,
    technicians,
    alerts,
  };
}
