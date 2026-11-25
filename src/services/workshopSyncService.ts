// Service de synchronisation persistante (Firestore & Cache local) entre Client, Chef d'Atelier et Technicien
// Assure que chaque action dans un rôle se répercute instantanément dans les autres interfaces
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, doc, setDoc, deleteDoc, updateDoc, onSnapshot, getDocs, query, where } from 'firebase/firestore';
import {
  ServiceHistoryItem,
  AdditionalQuote,
  PartItem,
  QuotePartEntry,
  Compte,
  Vehicle,
} from '../types';
import { INITIAL_PARTS_STOCK } from '../data/partsData';
import { INITIAL_QUOTE } from '../data/mockData';
import { resolveKiaModelImage, normalizeKiaVehicleImageUrl } from '../data/kiaCatalog';

export interface ClientAppointment {
  id: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  clientId?: string;
  vehicleName: string;
  plate: string;
  vin?: string;
  mileage?: number | string;
  serviceName: string;
  price: string;
  dateStr: string; // ex: "2026-11-18"
  formattedDate: string; // ex: "Mercredi 18 Novembre 2026"
  time: string;
  createdAt: string;
  status: 'booked' | 'checked_in' | 'in_progress' | 'completed' | 'rejected' | 'cancelled';
  chefDecision?: 'pending' | 'confirmed' | 'rejected';
  updatedAt?: string;
  modificationNote?: string;
  source?: 'client_week' | 'chef_long_term';
  notes?: string;
  checkinId?: string;
  orId?: string;
}

export interface ChefNotification {
  id: string;
  type: 'rdv_modified' | 'rdv_cancelled' | 'rdv_new';
  appointmentId: string;
  clientName: string;
  clientPhone?: string;
  plate: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface ChefLongTermRequest {
  id: string;
  clientId?: string;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  vehicleName: string;
  plate: string;
  channel: 'sav_message' | 'email' | 'call';
  preferredPeriod: string;
  serviceType: string;
  message: string;
  status: 'PENDING' | 'SCHEDULED' | 'ARCHIVED';
  scheduledDate?: string;
  scheduledTime?: string;
  createdAt: string;
}

export interface SyncRepairOrder {
  id: string;
  createdTime: string;
  vehicleName: string;
  plate: string;
  vin?: string;
  service: string;
  serviceCategory: string;
  technician: string;
  technicianRole: string;
  bay: string;
  status: 'in_progress' | 'quality_check' | 'waiting_parts' | 'ready' | 'pending';
  statusLabel: string;
  progressPercent: number;
  timeElapsed: string;
  timeEstimated: string;
  estimatedHours: number;
  imageUrl: string;
  clientId?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  mileage?: number | string;
  isNewForTech?: boolean;
  waitingPartsReason?: string;
}

export interface WorkshopLiveStage {
  step: 1 | 2 | 3 | 4;
  title: string;
  shortDesc: string;
  percent: number;
  timeLabel: string;
  status: 'pending' | 'in_progress' | 'completed';
}

export interface CompletedTechOrder {
  id: string;
  plate: string;
  vehicleName: string;
  clientId?: string;
  clientEmail?: string;
  clientName: string;
  service: string;
  completedAt: string;
  dateStr: string;
  durationMinutes: number;
  durationLabel: string;
  standardHours: number;
  qualityCheck: boolean;
  technicianName: string;
  chefStatus: 'waiting_payment' | 'restituted';
  invoiceAmount?: string;
}

export interface WorkshopLiveProgress {
  orderId: string;
  vehicleName: string;
  plate: string;
  vin?: string;
  clientId?: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  technicianName: string;
  technicianRole: string;
  bay: string;
  serviceTitle: string;
  estimatedDuration: string;
  startedAt: string;
  startedTimestamp?: number;
  currentStep: 1 | 2 | 3 | 4;
  progressPercent: number;
  stages: WorkshopLiveStage[];
  status: 'accepted' | 'in_progress' | 'ready_for_restitution' | 'completed_and_paid';
  lastUpdatedMessage: string;
  lastUpdatedAt: string;
  waitingParts?: boolean;
  waitingPartsReason?: string;
  invoiceAmount?: string;
  paymentMethod?: 'Carte Bancaire' | 'Espèces' | 'Chèque Certifié';
  paidAt?: string;
}

export type TechnicianRole =
  | 'Master Tech'
  | 'Tech Généraliste'
  | 'Spécialiste EV/HEV'
  | 'Contrôleur Qualité';

export type KiaCertification =
  | 'Haute Tension EV/HEV'
  | 'Diagnostic KDS'
  | 'Freinage/ADAS'
  | 'Climatisation';

export type TechnicianAvailability = 'en_poste' | 'en_pause' | 'essai_route' | 'absent';

export interface WorkshopTechnician {
  id: string;
  name: string;
  initials: string;
  role: TechnicianRole;
  certifications: KiaCertification[];
  availability: TechnicianAvailability;
  shiftStart: string;
  shiftEnd: string;
  maxLoadPercent: number;
  currentLoadPercent: number;
  active: boolean;
  assignedBayId?: string;
  phone?: string;
  avatar?: string;
}

export type BaySpecialty =
  | 'Service Rapide'
  | 'Mécanique lourde'
  | 'Diag EV/BMS'
  | 'Géométrie'
  | 'Climatisation'
  | 'Check-in';

export interface WorkshopBay {
  id: string;
  name: string;
  specialty: BaySpecialty;
  status: 'open' | 'maintenance';
  maintenanceReason?: string;
  leadTechnicianId?: string;
  leadTechnicianName?: string;
}

export interface MaintenancePriceGrid {
  revision: number;
  freinage: number;
  diagnostic: number;
  climatisation: number;
  pneumatiques: number;
}

export type SoundProfileMode = 'balanced' | 'discrete';

export interface WorkshopSoundConfig {
  enabled: boolean;
  profile: SoundProfileMode;
  masterVolume: number; // 0 à 100
}

export interface WorkshopSettings {
  id: string;
  weekdayOpen: string;
  weekdayClose: string;
  saturdayOpen: string;
  saturdayClose: string;
  saturdayEnabled: boolean;
  closedDates: string[];
  maxBookingsPerSlot: number;
  minBookingLeadHours: number;
  clientModifyDeadlineHours: number;
  hourlyLaborRateTnd: number;
  vatRatePercent: number;
  maintenancePrices: MaintenancePriceGrid;
  lowStockThreshold: number;
  autoConfirmAppointments: boolean;
  autoNotifyReadyClient: boolean;
  dealershipName: string;
  dealershipAddress: string;
  dealershipPhone: string;
  dealershipTaxId: string;
  soundConfig?: WorkshopSoundConfig;
}

export interface AssignmentImpactAlert {
  id: string;
  type: 'tech_unavailable' | 'bay_maintenance' | 'ev_cert_mismatch';
  severity: 'high' | 'medium';
  orderId?: string;
  appointmentId?: string;
  vehicleName: string;
  plate: string;
  resourceName: string;
  message: string;
}

export const DEFAULT_WORKSHOP_TECHNICIANS: WorkshopTechnician[] = [
  {
    id: 'tech-kt',
    name: 'Karim Trabelsi',
    initials: 'KT',
    role: 'Master Tech',
    certifications: ['Haute Tension EV/HEV', 'Diagnostic KDS', 'Freinage/ADAS'],
    availability: 'en_poste',
    shiftStart: '08:00',
    shiftEnd: '17:00',
    maxLoadPercent: 90,
    currentLoadPercent: 65,
    active: true,
    assignedBayId: '03',
    phone: '+216 98 210 401',
  },
  {
    id: 'tech-mg',
    name: 'Mehdi Gharbi',
    initials: 'MG',
    role: 'Tech Généraliste',
    certifications: ['Freinage/ADAS', 'Climatisation'],
    availability: 'en_poste',
    shiftStart: '08:00',
    shiftEnd: '17:00',
    maxLoadPercent: 90,
    currentLoadPercent: 85,
    active: true,
    assignedBayId: '01',
    phone: '+216 98 210 402',
  },
  {
    id: 'tech-aj',
    name: 'Anis Jaziri',
    initials: 'AJ',
    role: 'Spécialiste EV/HEV',
    certifications: ['Haute Tension EV/HEV', 'Diagnostic KDS', 'Climatisation'],
    availability: 'en_poste',
    shiftStart: '08:00',
    shiftEnd: '17:00',
    maxLoadPercent: 85,
    currentLoadPercent: 40,
    active: true,
    assignedBayId: '08',
    phone: '+216 98 210 403',
  },
  {
    id: 'tech-sr',
    name: 'Sofiene Riahi',
    initials: 'SR',
    role: 'Contrôleur Qualité',
    certifications: ['Diagnostic KDS', 'Freinage/ADAS'],
    availability: 'en_poste',
    shiftStart: '08:30',
    shiftEnd: '17:30',
    maxLoadPercent: 80,
    currentLoadPercent: 55,
    active: true,
    assignedBayId: '09',
    phone: '+216 98 210 404',
  },
];

export const DEFAULT_WORKSHOP_BAYS: WorkshopBay[] = [
  { id: '01', name: 'PONT 01', specialty: 'Check-in', status: 'open', leadTechnicianId: 'tech-mg', leadTechnicianName: 'Mehdi Gharbi' },
  { id: '02', name: 'PONT 02', specialty: 'Mécanique lourde', status: 'open', leadTechnicianId: 'tech-kt', leadTechnicianName: 'Karim Trabelsi' },
  { id: '03', name: 'PONT 03', specialty: 'Mécanique lourde', status: 'open', leadTechnicianId: 'tech-kt', leadTechnicianName: 'Karim Trabelsi' },
  { id: '04', name: 'PONT 04', specialty: 'Service Rapide', status: 'open', leadTechnicianId: 'tech-kt', leadTechnicianName: 'Karim Trabelsi' },
  { id: '05', name: 'PONT 05', specialty: 'Mécanique lourde', status: 'open', leadTechnicianId: 'tech-mg', leadTechnicianName: 'Mehdi Gharbi' },
  { id: '06', name: 'PONT 06', specialty: 'Service Rapide', status: 'open', leadTechnicianId: 'tech-mg', leadTechnicianName: 'Mehdi Gharbi' },
  { id: '07', name: 'PONT 07', specialty: 'Mécanique lourde', status: 'open', leadTechnicianId: 'tech-sr', leadTechnicianName: 'Sofiene Riahi' },
  { id: '08', name: 'PONT 08', specialty: 'Diag EV/BMS', status: 'open', leadTechnicianId: 'tech-aj', leadTechnicianName: 'Anis Jaziri' },
  { id: '09', name: 'PONT 09', specialty: 'Géométrie', status: 'open', leadTechnicianId: 'tech-sr', leadTechnicianName: 'Sofiene Riahi' },
  { id: '10', name: 'PONT 10', specialty: 'Climatisation', status: 'open', leadTechnicianId: 'tech-aj', leadTechnicianName: 'Anis Jaziri' },
  { id: '11', name: 'PONT 11', specialty: 'Mécanique lourde', status: 'open', leadTechnicianId: 'tech-sr', leadTechnicianName: 'Sofiene Riahi' },
  { id: '12', name: 'PONT 12', specialty: 'Service Rapide', status: 'open', leadTechnicianId: 'tech-kt', leadTechnicianName: 'Karim Trabelsi' },
];

export const DEFAULT_WORKSHOP_SETTINGS: WorkshopSettings = {
  id: 'default',
  weekdayOpen: '08:00',
  weekdayClose: '17:00',
  saturdayOpen: '08:00',
  saturdayClose: '12:30',
  saturdayEnabled: true,
  closedDates: [],
  maxBookingsPerSlot: 3,
  minBookingLeadHours: 2,
  clientModifyDeadlineHours: 24,
  hourlyLaborRateTnd: 65,
  vatRatePercent: 19,
  maintenancePrices: {
    revision: 420,
    freinage: 280,
    diagnostic: 140,
    climatisation: 165,
    pneumatiques: 95,
  },
  lowStockThreshold: 3,
  autoConfirmAppointments: false,
  autoNotifyReadyClient: true,
  dealershipName: 'City Cars Tunisie — La Goulette',
  dealershipAddress: 'Zone Industrielle Le Kram, 2015 Tunis',
  dealershipPhone: '36 406 000',
  dealershipTaxId: 'MF 0001248/P/A/M/000',
  soundConfig: {
    enabled: true,
    profile: 'balanced',
    masterVolume: 75,
  },
};

const STORAGE_KEYS = {
  APPOINTMENTS: 'k_dms_client_appointments',
  ORDERS: 'k_dms_workshop_orders',
  PENDING_CHECKIN: 'k_dms_pending_checkin_appointment',
  TECH_NOTIF_COUNT: 'k_dms_tech_unread_count',
  LIVE_PROGRESS: 'k_dms_live_progress',
  CLIENT_TOAST: 'k_dms_client_live_toast',
  CHEF_RESTITUTION_ALERT: 'k_dms_chef_restitution_alert',
  CHECKED_OUT_ITEMS: 'k_dms_checked_out_items',
  COMPLETED_TECH_ORDERS: 'k_dms_completed_tech_orders',
  DISMISSED_TECH_ORDERS: 'k_dms_dismissed_tech_orders',
  SERVICE_HISTORY: 'k_dms_service_history',
  CHEF_REQUESTS: 'k_dms_chef_requests',
  CHEF_NOTIFICATIONS: 'k_dms_chef_notifications',
  QUOTES: 'k_dms_workshop_quotes',
  PARTS_STOCK: 'k_dms_spare_parts_stock',
  WORKSHOP_TEAM: 'k_dms_workshop_team',
  WORKSHOP_BAYS: 'k_dms_workshop_bays',
  WORKSHOP_SETTINGS: 'k_dms_workshop_settings',
};

const MONTHS_FR_MAP: Record<string, string> = {
  janvier: '01',
  fevrier: '02',
  février: '02',
  mars: '03',
  avril: '04',
  mai: '05',
  juin: '06',
  juillet: '07',
  aout: '08',
  août: '08',
  septembre: '09',
  octobre: '10',
  novembre: '11',
  decembre: '12',
  décembre: '12',
};

const parseAppointmentDateFields = (
  appointmentDateStr?: string
): { dateStr?: string; time?: string } => {
  if (!appointmentDateStr) return {};
  const result: { dateStr?: string; time?: string } = {};
  const timeMatch = appointmentDateStr.match(/(\d{1,2}:\d{2})/);
  if (timeMatch) {
    result.time = timeMatch[1].padStart(5, '0');
  }
  const dateMatch = appointmentDateStr
    .toLowerCase()
    .match(/(\d{1,2})\s+([a-zàâäéèêëïîôöùûüç]+)\s+(\d{4})/);
  if (dateMatch) {
    const day = dateMatch[1].padStart(2, '0');
    const month = MONTHS_FR_MAP[dateMatch[2]];
    const year = dateMatch[3];
    if (month) {
      result.dateStr = `${year}-${month}-${day}`;
    }
  }
  return result;
};

const addDaysIso = (daysAhead: number): { dateStr: string; formattedDate: string } => {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const raw = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return {
    dateStr: `${y}-${m}-${day}`,
    formattedDate: raw.charAt(0).toUpperCase() + raw.slice(1),
  };
};

const buildInitialLongTermAppointments = (): ClientAppointment[] => {
  const d7 = addDaysIso(8);
  const d12 = addDaysIso(12);
  const d18 = addDaysIso(18);
  const d28 = addDaysIso(29);
  return [
    {
      id: 'RDV-LT-101',
      clientName: 'Mme Rim Gharbi',
      clientPhone: '+216 98 512 340',
      clientEmail: 'rim.gharbi@tunisie.tn',
      vehicleName: 'Kia Sorento HEV 4WD',
      plate: '231 TU 4410',
      serviceName: 'Révision Constructeur 45 000 km & Bougies',
      price: '540 DT',
      dateStr: d7.dateStr,
      formattedDate: d7.formattedDate,
      time: '09:00',
      createdAt: new Date().toISOString(),
      status: 'booked',
      source: 'chef_long_term',
      notes: 'Planifié avec le Chef d’Atelier pour semaine prochaine.',
    },
    {
      id: 'RDV-LT-102',
      clientName: 'M. Nidhal Ben Salem',
      clientPhone: '+216 55 210 987',
      clientEmail: 'nidhal.bs@mail.tn',
      vehicleName: 'Kia EV6 GT-Line RWD',
      plate: '239 TU 1904',
      serviceName: 'Contrôle Batterie Haute Tension & Mise à jour BMS',
      price: '190 DT',
      dateStr: d12.dateStr,
      formattedDate: d12.formattedDate,
      time: '10:30',
      createdAt: new Date().toISOString(),
      status: 'booked',
      source: 'chef_long_term',
      notes: 'Immobilisation demi-journée baie EV.',
    },
    {
      id: 'RDV-LT-103',
      clientName: 'Dr. Amine Khelil',
      clientPhone: '+216 97 840 112',
      vehicleName: 'Kia Seltos 1.6 SX',
      plate: '223 TU 6718',
      serviceName: 'Remplacement Disques & Plaquettes Avant + Purge DOT4',
      price: '480 DT',
      dateStr: d18.dateStr,
      formattedDate: d18.formattedDate,
      time: '14:00',
      createdAt: new Date().toISOString(),
      status: 'booked',
      source: 'chef_long_term',
      notes: 'Pièces OEM réservées au magasin central.',
    },
    {
      id: 'RDV-LT-104',
      clientName: 'Mme Sonia Ferjani',
      clientPhone: '+216 22 490 315',
      vehicleName: 'Kia Picanto GT-Line 1.2',
      plate: '220 TU 3345',
      serviceName: 'Entretien Annuel 30 000 km + Recharge Climatisation',
      price: '420 DT',
      dateStr: d28.dateStr,
      formattedDate: d28.formattedDate,
      time: '08:30',
      createdAt: new Date().toISOString(),
      status: 'booked',
      source: 'chef_long_term',
      notes: 'RDV mensuel confirmé par appel Chef d’Atelier.',
    },
  ];
};

const buildInitialChefRequests = (): ChefLongTermRequest[] => [
  {
    id: 'REQ-LT-901',
    clientName: 'M. Karim Zouaoui',
    clientPhone: '+216 98 765 110',
    clientEmail: 'karim.zouaoui@topnet.tn',
    vehicleName: 'Kia Niro Hybride 2024',
    plate: '236 TU 5120',
    channel: 'sav_message',
    preferredPeriod: 'Semaine prochaine (Mardi ou Jeudi matin)',
    serviceType: 'Révision Périodique Constructeur',
    message: 'Bonjour M. Mansour, je serai en déplacement cette semaine. Pouvez-vous me réserver un créneau mardi ou jeudi matin la semaine prochaine ?',
    status: 'PENDING',
    createdAt: new Date(Date.now() - 3600 * 1000 * 3).toISOString(),
  },
  {
    id: 'REQ-LT-902',
    clientName: 'Mme Meriem Chaouch',
    clientPhone: '+216 52 104 880',
    clientEmail: 'meriem.chaouch@gmail.com',
    vehicleName: 'Kia Stonic GT-Line',
    plate: '227 TU 9014',
    channel: 'email',
    preferredPeriod: 'Début du mois prochain',
    serviceType: 'Freinage & Sécurité',
    message: 'Demande de rendez-vous début du mois prochain pour contrôle complet du freinage et géométrie avant contrôle technique.',
    status: 'PENDING',
    createdAt: new Date(Date.now() - 3600 * 1000 * 18).toISOString(),
  },
];

const INITIAL_COMPLETED_ORDERS: CompletedTechOrder[] = [
  {
    id: '#OR-2026-9088',
    plate: '219 TU 7741',
    vehicleName: 'Kia Picanto GT-Line 1.2 MPI',
    clientName: 'Mme Inès Dridi',
    service: 'Révision Annuelle 10 000 km & Filtres d\'Origine',
    completedAt: '09:45',
    dateStr: "Aujourd'hui",
    durationMinutes: 48,
    durationLabel: '48 min',
    standardHours: 1.0,
    qualityCheck: true,
    technicianName: 'Karim Trabelsi',
    chefStatus: 'restituted',
    invoiceAmount: '285.000 TND',
  },
  {
    id: '#OR-2026-9094',
    plate: '204 TU 3910',
    vehicleName: 'Kia Cerato Berline 1.6 Gamma',
    clientName: 'M. Walid Chaabane',
    service: 'Remplacement Plaquettes Avant OEM + Purge DOT4',
    completedAt: '11:10',
    dateStr: "Aujourd'hui",
    durationMinutes: 72,
    durationLabel: '1h 12m',
    standardHours: 1.4,
    qualityCheck: true,
    technicianName: 'Karim Trabelsi',
    chefStatus: 'restituted',
    invoiceAmount: '440.000 TND',
  },
];

const DEFAULT_STAGES: WorkshopLiveStage[] = [
  {
    step: 1,
    title: 'Diagnostic & Inspection',
    shortDesc: 'Contrôle valise Kia KDS 75 points & état d’entrée',
    percent: 25,
    timeLabel: '09:15',
    status: 'in_progress',
  },
  {
    step: 2,
    title: 'En Réparation / Entretien',
    shortDesc: 'Opérations mécaniques & pièces d’origine Kia',
    percent: 50,
    timeLabel: '10:30',
    status: 'pending',
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
    title: 'Clôture & Restitution',
    shortDesc: 'Lavage offert, facture & remise en main propre',
    percent: 100,
    timeLabel: '12:30',
    status: 'pending',
  },
];

class WorkshopSyncService {
  // ==========================================
  // GESTION DES RENDEZ-VOUS CLIENTS
  // ==========================================
  getAppointments(): ClientAppointment[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.APPOINTMENTS);
      if (data === null) {
        const seeded = buildInitialLongTermAppointments();
        localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(seeded));
        return seeded;
      }
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  saveAppointment(appointment: Omit<ClientAppointment, 'id' | 'createdAt' | 'status'>): ClientAppointment {
    const list = this.getAppointments();
    const settings = this.getWorkshopSettings();
    const initialChefDecision: 'pending' | 'confirmed' | 'rejected' =
      appointment.source === 'chef_long_term' || settings.autoConfirmAppointments
        ? 'confirmed'
        : appointment.chefDecision || 'pending';

    const newAppointment: ClientAppointment = {
      ...appointment,
      source: appointment.source || 'client_week',
      id: `RDV-${Date.now().toString().slice(-6)}`,
      createdAt: new Date().toISOString(),
      status: 'booked',
      chefDecision: initialChefDecision,
    };
    const updated = [newAppointment, ...list];
    try {
      localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(updated));
      window.dispatchEvent(new Event('k_dms_planning_updated'));
    } catch (e) {
      console.error('Erreur sauvegarde RDV', e);
    }

    // Persistance asynchrone Firestore (Table appointments)
    try {
      setDoc(doc(db, 'appointments', newAppointment.id), {
        id: newAppointment.id,
        vehicle_id: newAppointment.plate,
        vehicle_name: newAppointment.vehicleName,
        client_id: newAppointment.clientId || '',
        client_name: newAppointment.clientName,
        client_phone: newAppointment.clientPhone || '',
        client_email: newAppointment.clientEmail || '',
        service_type: newAppointment.serviceName,
        appointment_date: `${newAppointment.formattedDate} à ${newAppointment.time}`,
        date_str: newAppointment.dateStr,
        time: newAppointment.time,
        price: newAppointment.price,
        source: newAppointment.source || 'client_week',
        notes: newAppointment.notes || '',
        created_at: newAppointment.createdAt,
        chef_decision: initialChefDecision.toUpperCase(),
        status: initialChefDecision === 'confirmed' ? 'CONFIRMED' : 'PENDING',
      }).catch((e) => handleFirestoreError(e, OperationType.WRITE, `appointments/${newAppointment.id}`));
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `appointments/${newAppointment.id}`);
    }

    if (initialChefDecision === 'pending') {
      this.addChefNotification({
        type: 'rdv_new',
        appointmentId: newAppointment.id,
        clientName: newAppointment.clientName,
        clientPhone: newAppointment.clientPhone,
        plate: newAppointment.plate,
        title: 'Nouveau RDV à confirmer',
        message: `${newAppointment.clientName} (${newAppointment.plate}) demande un créneau le ${newAppointment.formattedDate} à ${newAppointment.time} — ${newAppointment.serviceName}.`,
      });
    }

    return newAppointment;
  }

  /**
   * Règle d'isolation stricte : un enregistrement appartient à un client UNIQUEMENT
   * si son identifiant (clientId) OU son adresse email (clientEmail) correspond au compte connecté.
   */
  doesRecordBelongToClient(
    record: { clientId?: string; clientEmail?: string } | null | undefined,
    compte: Compte | null
  ): boolean {
    if (!compte || !record) return false;
    if (compte.id && record.clientId && record.clientId.trim() === compte.id.trim()) {
      return true;
    }
    const compteEmail = (compte.email || '').trim().toLowerCase();
    const recordEmail = (record.clientEmail || '').trim().toLowerCase();
    if (compteEmail && recordEmail && compteEmail === recordEmail) {
      return true;
    }
    return false;
  }

  private matchesClientAccount(
    appt: ClientAppointment,
    compte: Compte | null,
    _vehicles: Vehicle[] = []
  ): boolean {
    return this.doesRecordBelongToClient(appt, compte);
  }

  getAppointmentsForClient(compte: Compte | null, _vehicles: Vehicle[] = []): ClientAppointment[] {
    if (!compte) return [];
    return this.getAppointments().filter(
      (a) => !this.isCheckedOut({ id: a.id }) && this.doesRecordBelongToClient(a, compte)
    );
  }

  getChefRequestsForClient(compte: Compte | null): ChefLongTermRequest[] {
    if (!compte) return [];
    return this.getChefRequests().filter((r) => this.doesRecordBelongToClient(r, compte));
  }

  /**
   * Retourne le RDV en attente de réponse Chef d'Atelier pour ce client.
   * Tant qu'un RDV est en attente de réponse Chef, la prise d'un nouveau RDV est bloquée.
   */
  getPendingChefAppointmentForClient(
    compte: Compte | null,
    vehicles: Vehicle[] = []
  ): ClientAppointment | null {
    const mine = this.getAppointmentsForClient(compte, vehicles);
    return (
      mine.find((a) => {
        if (a.status === 'completed' || a.status === 'rejected' || a.status === 'cancelled') return false;
        if (a.status === 'checked_in' || a.status === 'in_progress') return false;
        if (a.source === 'chef_long_term') return false;
        const decision = a.chefDecision || 'pending';
        return decision === 'pending';
      }) || null
    );
  }

  /**
   * Vérifie en temps réel si un horaire précis de dépose est disponible
   * selon les paramètres atelier (horaires, samedi, jours fermés, délai min. +2h, capacité par créneau)
   */
  isSlotAvailableInRealTime(
    dateInput: Date | string,
    timeStr: string,
    nowMs: number = Date.now(),
    minLeadHoursOverride?: number
  ): {
    available: boolean;
    reason?: 'past' | 'lead_time' | 'closed' | 'capacity';
    minAllowedTimeStr: string;
  } {
    const settings = this.getWorkshopSettings();
    const leadHours = minLeadHoursOverride ?? settings.minBookingLeadHours ?? 2;
    const minAllowedMs = nowMs + leadHours * 60 * 60 * 1000;
    const minDate = new Date(minAllowedMs);
    const minAllowedTimeStr = `${String(minDate.getHours()).padStart(2, '0')}:${String(
      minDate.getMinutes()
    ).padStart(2, '0')}`;

    let year = 0;
    let monthIndex = 0;
    let day = 0;
    if (dateInput instanceof Date) {
      year = dateInput.getFullYear();
      monthIndex = dateInput.getMonth();
      day = dateInput.getDate();
    } else {
      const [y, m, d] = (dateInput || '').split('-').map(Number);
      if (!y || !m || !d) {
        return { available: false, reason: 'past', minAllowedTimeStr };
      }
      year = y;
      monthIndex = m - 1;
      day = d;
    }

    const isoStr = `${year}-${String(monthIndex + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const targetDayDate = new Date(year, monthIndex, day, 0, 0, 0, 0);
    const dow = targetDayDate.getDay();

    if (dow === 0) {
      return { available: false, reason: 'closed', minAllowedTimeStr };
    }
    if (dow === 6 && !settings.saturdayEnabled) {
      return { available: false, reason: 'closed', minAllowedTimeStr };
    }
    if (settings.closedDates.includes(isoStr)) {
      return { available: false, reason: 'closed', minAllowedTimeStr };
    }

    const openBaysCount = this.getWorkshopBays().filter((b) => b.status === 'open').length;
    if (openBaysCount === 0) {
      return { available: false, reason: 'closed', minAllowedTimeStr };
    }

    const [hh, mm] = (timeStr || '').split(':').map(Number);
    if (Number.isNaN(hh) || Number.isNaN(mm)) {
      return { available: false, reason: 'past', minAllowedTimeStr };
    }

    const toMinutes = (t: string, fallback: number) => {
      const [h, m] = (t || '').split(':').map(Number);
      return Number.isNaN(h) || Number.isNaN(m) ? fallback : h * 60 + m;
    };
    const slotMinutes = hh * 60 + mm;
    const openMin = toMinutes(dow === 6 ? settings.saturdayOpen : settings.weekdayOpen, 480);
    const closeMin = toMinutes(dow === 6 ? settings.saturdayClose : settings.weekdayClose, dow === 6 ? 750 : 1020);

    if (slotMinutes < openMin || slotMinutes > closeMin) {
      return { available: false, reason: 'closed', minAllowedTimeStr };
    }

    const slotMs = new Date(year, monthIndex, day, hh, mm, 0, 0).getTime();
    if (slotMs <= nowMs) {
      return { available: false, reason: 'past', minAllowedTimeStr };
    }
    if (slotMs < minAllowedMs) {
      return { available: false, reason: 'lead_time', minAllowedTimeStr };
    }

    const maxSlotCap = Math.max(1, Math.min(settings.maxBookingsPerSlot || 3, openBaysCount));
    const existingInSlot = this.getAppointments().filter(
      (a) =>
        a.dateStr === isoStr &&
        a.time === timeStr &&
        a.status !== 'cancelled' &&
        a.status !== 'rejected'
    ).length;

    if (existingInSlot >= maxSlotCap) {
      return { available: false, reason: 'capacity', minAllowedTimeStr };
    }

    return { available: true, minAllowedTimeStr };
  }

  /**
   * Vérifie la règle de modification / annulation client selon `clientModifyDeadlineHours`
   */
  canClientModifyOrCancelAppointment(appt: ClientAppointment): {
    allowed: boolean;
    hoursRemaining: number;
    reason?: string;
  } {
    if (appt.status === 'cancelled') {
      return { allowed: false, hoursRemaining: 0, reason: 'Ce rendez-vous est déjà annulé.' };
    }
    if (appt.status === 'rejected') {
      return { allowed: false, hoursRemaining: 0, reason: 'Ce rendez-vous a été refusé par le Chef.' };
    }
    if (appt.status === 'completed' || appt.status === 'checked_in' || appt.status === 'in_progress') {
      return {
        allowed: false,
        hoursRemaining: 0,
        reason: 'Véhicule déjà pris en charge à l’atelier.',
      };
    }

    const [y, m, d] = (appt.dateStr || '').split('-').map(Number);
    const [hh, mm] = (appt.time || '09:00').split(':').map(Number);
    if (!y || !m || !d) {
      return { allowed: false, hoursRemaining: 0, reason: 'Date du rendez-vous invalide.' };
    }

    const rdvDate = new Date(y, m - 1, d, Number.isNaN(hh) ? 9 : hh, Number.isNaN(mm) ? 0 : mm, 0, 0);
    const diffMs = rdvDate.getTime() - Date.now();
    const hoursRemaining = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMs <= 0) {
      return {
        allowed: false,
        hoursRemaining: 0,
        reason: 'La date et l’heure du rendez-vous sont déjà passées.',
      };
    }

    const deadlineHours = Math.max(1, this.getWorkshopSettings().clientModifyDeadlineHours || 24);
    if (diffMs < deadlineHours * 60 * 60 * 1000) {
      return {
        allowed: false,
        hoursRemaining: Math.max(0, hoursRemaining),
        reason: `Délai de ${deadlineHours}h dépassé (${Math.max(0, hoursRemaining)}h restantes) : modification et annulation bloquées à moins de ${deadlineHours}h du RDV.`,
      };
    }

    return { allowed: true, hoursRemaining };
  }

  confirmAppointmentByChef(id: string): ClientAppointment | null {
    const list = this.getAppointments();
    const existing = list.find((a) => a.id === id);
    if (!existing) return null;

    const updatedAppt: ClientAppointment = {
      ...existing,
      chefDecision: 'confirmed',
      status: existing.status === 'rejected' || existing.status === 'cancelled' ? 'booked' : existing.status,
      updatedAt: new Date().toISOString(),
    };
    const updated = list.map((a) => (a.id === id ? updatedAppt : a));

    try {
      localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(updated));
      window.dispatchEvent(new Event('k_dms_planning_updated'));
    } catch {}

    try {
      updateDoc(doc(db, 'appointments', id), {
        status: 'CONFIRMED',
        chef_decision: 'CONFIRMED',
        updated_at: updatedAppt.updatedAt,
      }).catch(() => {});
    } catch {}

    this.setClientToast(
      `Votre rendez-vous du ${updatedAppt.formattedDate} à ${updatedAppt.time} (${updatedAppt.plate}) a été confirmé par le Chef d'Atelier !`,
      {
        plate: updatedAppt.plate,
        clientEmail: updatedAppt.clientEmail,
        clientId: updatedAppt.clientId,
      }
    );
    return updatedAppt;
  }

  rejectAppointmentByChef(id: string, reason?: string): ClientAppointment | null {
    const list = this.getAppointments();
    const existing = list.find((a) => a.id === id);
    if (!existing) return null;

    const updatedAppt: ClientAppointment = {
      ...existing,
      status: 'rejected',
      chefDecision: 'rejected',
      modificationNote: reason || 'Créneau refusé par le Chef d’Atelier — veuillez choisir une autre disponibilité.',
      updatedAt: new Date().toISOString(),
    };
    const updated = list.map((a) => (a.id === id ? updatedAppt : a));

    try {
      localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(updated));
      window.dispatchEvent(new Event('k_dms_planning_updated'));
    } catch {}

    try {
      updateDoc(doc(db, 'appointments', id), {
        status: 'REJECTED',
        chef_decision: 'REJECTED',
        modification_note: updatedAppt.modificationNote,
        updated_at: updatedAppt.updatedAt,
      }).catch(() => {});
    } catch {}

    this.setClientToast(
      `Réponse Chef d'Atelier : votre demande de RDV du ${updatedAppt.formattedDate} n'a pas pu être retenue. Vous pouvez réserver un autre créneau.`,
      {
        plate: updatedAppt.plate,
        clientEmail: updatedAppt.clientEmail,
        clientId: updatedAppt.clientId,
      }
    );
    return updatedAppt;
  }

  modifyAppointmentByClient(
    id: string,
    updates: {
      dateStr: string;
      formattedDate: string;
      time: string;
      serviceName?: string;
      price?: string;
      notes?: string;
    }
  ): { success: boolean; appointment?: ClientAppointment; error?: string } {
    const list = this.getAppointments();
    const existing = list.find((a) => a.id === id);
    if (!existing) {
      return { success: false, error: 'Rendez-vous introuvable.' };
    }

    const check = this.canClientModifyOrCancelAppointment(existing);
    if (!check.allowed) {
      return {
        success: false,
        error: check.reason || 'Modification impossible à moins de 24h du rendez-vous.',
      };
    }

    const slotCheck = this.isSlotAvailableInRealTime(updates.dateStr, updates.time);
    if (!slotCheck.available) {
      const leadHours = this.getWorkshopSettings().minBookingLeadHours || 2;
      return {
        success: false,
        error:
          slotCheck.reason === 'past'
            ? "L'horaire choisi est déjà passé. Veuillez sélectionner un créneau ultérieur."
            : slotCheck.reason === 'closed'
            ? "L'atelier est fermé à cette date ou sur cette plage horaire."
            : slotCheck.reason === 'capacity'
            ? 'Ce créneau a atteint sa capacité maximale de réception.'
            : `Délai minimum de ${leadHours}h requis : veuillez choisir un créneau à partir de ${slotCheck.minAllowedTimeStr}.`,
      };
    }

    const prevSummary = `${existing.formattedDate} à ${existing.time}`;
    const nextService = updates.serviceName || existing.serviceName;
    const modNote = `Modifié par le client le ${new Date().toLocaleDateString('fr-FR')} (ancien créneau : ${prevSummary})`;

    const updatedAppt: ClientAppointment = {
      ...existing,
      dateStr: updates.dateStr,
      formattedDate: updates.formattedDate,
      time: updates.time,
      serviceName: nextService,
      price: updates.price || existing.price,
      notes: updates.notes !== undefined ? updates.notes : existing.notes,
      updatedAt: new Date().toISOString(),
      modificationNote: modNote,
    };

    const updated = list.map((a) => (a.id === id ? updatedAppt : a));
    try {
      localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(updated));
      window.dispatchEvent(new Event('k_dms_planning_updated'));
    } catch {}

    try {
      updateDoc(doc(db, 'appointments', id), {
        date_str: updatedAppt.dateStr,
        appointment_date: `${updatedAppt.formattedDate} à ${updatedAppt.time}`,
        time: updatedAppt.time,
        service_type: updatedAppt.serviceName,
        price: updatedAppt.price,
        notes: updatedAppt.notes || '',
        updated_at: updatedAppt.updatedAt,
        modification_note: modNote,
      }).catch(() => {});
    } catch {}

    this.addChefNotification({
      type: 'rdv_modified',
      appointmentId: updatedAppt.id,
      clientName: updatedAppt.clientName,
      clientPhone: updatedAppt.clientPhone,
      plate: updatedAppt.plate,
      title: 'RDV modifié par le client (> 24h)',
      message: `${updatedAppt.clientName} (${updatedAppt.plate}) a déplacé son RDV du ${prevSummary} au ${updatedAppt.formattedDate} à ${updatedAppt.time} (${updatedAppt.serviceName}).`,
    });

    return { success: true, appointment: updatedAppt };
  }

  cancelAppointmentByClient(
    id: string,
    reason?: string
  ): { success: boolean; appointment?: ClientAppointment; error?: string } {
    const list = this.getAppointments();
    const existing = list.find((a) => a.id === id);
    if (!existing) {
      return { success: false, error: 'Rendez-vous introuvable.' };
    }

    const check = this.canClientModifyOrCancelAppointment(existing);
    if (!check.allowed) {
      return {
        success: false,
        error: check.reason || 'Annulation impossible à moins de 24h du rendez-vous.',
      };
    }

    const cancelNote = reason?.trim() || 'Annulé par le client depuis Assistance & Devis (>= 24h avant le RDV).';
    const updatedAppt: ClientAppointment = {
      ...existing,
      status: 'cancelled',
      updatedAt: new Date().toISOString(),
      modificationNote: cancelNote,
    };

    const updated = list.map((a) => (a.id === id ? updatedAppt : a));
    try {
      localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(updated));
      window.dispatchEvent(new Event('k_dms_planning_updated'));
    } catch {}

    try {
      updateDoc(doc(db, 'appointments', id), {
        status: 'CANCELLED',
        updated_at: updatedAppt.updatedAt,
        modification_note: cancelNote,
      }).catch(() => {});
    } catch {}

    this.addChefNotification({
      type: 'rdv_cancelled',
      appointmentId: updatedAppt.id,
      clientName: updatedAppt.clientName,
      clientPhone: updatedAppt.clientPhone,
      plate: updatedAppt.plate,
      title: 'RDV annulé par le client (> 24h)',
      message: `${updatedAppt.clientName} (${updatedAppt.plate}) a annulé son rendez-vous du ${updatedAppt.formattedDate} à ${updatedAppt.time}. Motif : ${cancelNote}`,
    });

    return { success: true, appointment: updatedAppt };
  }

  // ==========================================
  // NOTIFICATIONS CHEF D'ATELIER (FIRESTORE)
  // ==========================================
  getChefNotifications(): ChefNotification[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CHEF_NOTIFICATIONS);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  addChefNotification(input: Omit<ChefNotification, 'id' | 'read' | 'createdAt'>): ChefNotification {
    const newNotif: ChefNotification = {
      ...input,
      id: `NOTIF-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      read: false,
      createdAt: new Date().toISOString(),
    };
    const current = this.getChefNotifications();
    const updated = [newNotif, ...current].slice(0, 50);
    try {
      localStorage.setItem(STORAGE_KEYS.CHEF_NOTIFICATIONS, JSON.stringify(updated));
      window.dispatchEvent(new Event('k_dms_chef_notifications_updated'));
    } catch {}

    try {
      setDoc(doc(db, 'chef_notifications', newNotif.id), {
        id: newNotif.id,
        type: newNotif.type,
        appointment_id: newNotif.appointmentId,
        client_name: newNotif.clientName,
        client_phone: newNotif.clientPhone || '',
        plate: newNotif.plate,
        title: newNotif.title,
        message: newNotif.message,
        read: false,
        created_at: newNotif.createdAt,
      }).catch(() => {});
    } catch {}

    return newNotif;
  }

  markChefNotificationRead(id: string) {
    const updated = this.getChefNotifications().map((n) => (n.id === id ? { ...n, read: true } : n));
    try {
      localStorage.setItem(STORAGE_KEYS.CHEF_NOTIFICATIONS, JSON.stringify(updated));
      window.dispatchEvent(new Event('k_dms_chef_notifications_updated'));
    } catch {}
    try {
      updateDoc(doc(db, 'chef_notifications', id), { read: true }).catch(() => {});
    } catch {}
  }

  markAllChefNotificationsRead() {
    const current = this.getChefNotifications();
    const unreadIds = current.filter((n) => !n.read).map((n) => n.id);
    const updated = current.map((n) => ({ ...n, read: true }));
    try {
      localStorage.setItem(STORAGE_KEYS.CHEF_NOTIFICATIONS, JSON.stringify(updated));
      window.dispatchEvent(new Event('k_dms_chef_notifications_updated'));
    } catch {}
    for (const id of unreadIds) {
      try {
        updateDoc(doc(db, 'chef_notifications', id), { read: true }).catch(() => {});
      } catch {}
    }
  }

  // ==========================================
  // DEMANDES RDV LONG TERME CLIENT -> CHEF D'ATELIER
  // ==========================================
  getChefRequests(): ChefLongTermRequest[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CHEF_REQUESTS);
      if (data === null) {
        const seeded = buildInitialChefRequests();
        localStorage.setItem(STORAGE_KEYS.CHEF_REQUESTS, JSON.stringify(seeded));
        return seeded;
      }
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  saveChefRequest(
    req: Omit<ChefLongTermRequest, 'id' | 'createdAt' | 'status'>
  ): ChefLongTermRequest {
    const list = this.getChefRequests();
    const newReq: ChefLongTermRequest = {
      ...req,
      id: `REQ-${Date.now().toString().slice(-6)}`,
      status: 'PENDING',
      createdAt: new Date().toISOString(),
    };
    const updated = [newReq, ...list];
    try {
      localStorage.setItem(STORAGE_KEYS.CHEF_REQUESTS, JSON.stringify(updated));
      window.dispatchEvent(new Event('k_dms_chef_requests_updated'));
    } catch (e) {
      console.error('Erreur sauvegarde demande Chef', e);
    }

    // Persistance Firestore (Table chef_requests)
    try {
      setDoc(doc(db, 'chef_requests', newReq.id), {
        id: newReq.id,
        client_id: newReq.clientId || '',
        client_name: newReq.clientName,
        client_phone: newReq.clientPhone || '',
        client_email: newReq.clientEmail || '',
        vehicle_name: newReq.vehicleName,
        plate: newReq.plate,
        channel: newReq.channel,
        preferred_period: newReq.preferredPeriod,
        service_type: newReq.serviceType,
        message: newReq.message,
        status: newReq.status,
        created_at: newReq.createdAt,
      }).catch((e) => console.warn('Sync Firestore chef_requests non-bloquant:', e));
    } catch {}

    return newReq;
  }

  scheduleChefRequest(
    requestId: string,
    dateStr: string,
    formattedDate: string,
    time: string
  ): ClientAppointment | null {
    const requests = this.getChefRequests();
    const target = requests.find((r) => r.id === requestId);
    if (!target) return null;

    const appt = this.saveAppointment({
      clientName: target.clientName,
      clientEmail: target.clientEmail,
      clientPhone: target.clientPhone,
      clientId: target.clientId,
      vehicleName: target.vehicleName,
      plate: target.plate,
      serviceName: target.serviceType,
      price: 'Sur barème Kia',
      dateStr,
      formattedDate,
      time,
      source: 'chef_long_term',
      notes: `Planifié suite demande ${target.channel === 'email' ? 'Email' : target.channel === 'call' ? 'Appel' : 'Message SAV'} : ${target.preferredPeriod}`,
    });

    const updatedRequests = requests.map((r) =>
      r.id === requestId
        ? { ...r, status: 'SCHEDULED' as const, scheduledDate: dateStr, scheduledTime: time }
        : r
    );
    try {
      localStorage.setItem(STORAGE_KEYS.CHEF_REQUESTS, JSON.stringify(updatedRequests));
      window.dispatchEvent(new Event('k_dms_chef_requests_updated'));
    } catch {}

    try {
      updateDoc(doc(db, 'chef_requests', requestId), {
        status: 'SCHEDULED',
        scheduled_date: dateStr,
        scheduled_time: time,
      }).catch(() => {});
    } catch {}

    return appt;
  }

  archiveChefRequest(requestId: string) {
    const requests = this.getChefRequests();
    const updated = requests.map((r) =>
      r.id === requestId ? { ...r, status: 'ARCHIVED' as const } : r
    );
    try {
      localStorage.setItem(STORAGE_KEYS.CHEF_REQUESTS, JSON.stringify(updated));
      window.dispatchEvent(new Event('k_dms_chef_requests_updated'));
    } catch {}

    try {
      updateDoc(doc(db, 'chef_requests', requestId), { status: 'ARCHIVED' }).catch(() => {});
    } catch {}
  }

  updateAppointmentStatus(id: string, status: ClientAppointment['status'], extra?: { checkinId?: string; orId?: string }) {
    const list = this.getAppointments();
    const updated = list.map((a) =>
      a.id === id
        ? {
            ...a,
            status,
            chefDecision: status === 'rejected' ? ('rejected' as const) : ('confirmed' as const),
            ...extra,
          }
        : a
    );
    try {
      localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(updated));
      window.dispatchEvent(new Event('k_dms_planning_updated'));
    } catch (e) {
      console.error('Erreur mise à jour RDV', e);
    }

    // Mise à jour Firestore
    try {
      const statusMap: Record<string, string> = {
        booked: 'CONFIRMED',
        checked_in: 'CONFIRMED',
        in_progress: 'CONFIRMED',
        completed: 'COMPLETED',
        rejected: 'REJECTED',
        cancelled: 'CANCELLED',
      };
      updateDoc(doc(db, 'appointments', id), {
        status: statusMap[status] || status,
        ...(status !== 'rejected' && status !== 'cancelled' ? { chef_decision: 'CONFIRMED' } : {}),
        ...(extra?.orId ? { or_id: extra.orId } : {}),
      }).catch(() => {});
    } catch {}
  }

  // Suppression d'un rendez-vous du planning après règlement et restitution
  removeAppointment(id: string) {
    const list = this.getAppointments();
    const updated = list.filter((a) => a.id !== id);
    try {
      localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(updated));
      window.dispatchEvent(new Event('k_dms_planning_updated'));
    } catch (e) {
      console.error('Erreur suppression RDV', e);
    }

    // Suppression Firestore
    try {
      deleteDoc(doc(db, 'appointments', id)).catch(() => {});
    } catch {}
  }

  removeAppointmentByPlateOrClient(plate?: string, clientName?: string, orderId?: string) {
    const cleanPlate = (plate || '').replace(/\s+/g, '').toLowerCase();
    const cleanClient = (clientName || '').trim().toLowerCase();
    const list = this.getAppointments();
    const completedIds: string[] = [];

    // Clôturer uniquement les rendez-vous déjà pris en charge (checked_in / in_progress / lié à l'OR)
    // sans supprimer les nouveaux rendez-vous futurs réservés par le même client !
    const updated = list.map((a) => {
      const aPlate = (a.plate || '').replace(/\s+/g, '').toLowerCase();
      const aClient = (a.clientName || '').trim().toLowerCase();
      const isMatchingOr = Boolean(orderId && a.orId === orderId);
      const isMatchingActive =
        (a.status === 'checked_in' || a.status === 'in_progress') &&
        ((cleanPlate && aPlate === cleanPlate) || (cleanClient && aClient === cleanClient));

      if (isMatchingOr || isMatchingActive) {
        completedIds.push(a.id);
        return { ...a, status: 'completed' as const };
      }
      return a;
    });

    try {
      localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(updated));
      window.dispatchEvent(new Event('k_dms_planning_updated'));
    } catch (e) {
      console.error('Erreur clôture RDV par plaque/client', e);
    }

    for (const apptId of completedIds) {
      try {
        updateDoc(doc(db, 'appointments', apptId), { status: 'COMPLETED' }).catch(() => {});
      } catch {}
    }
  }

  getCheckedOutItems(): string[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.CHECKED_OUT_ITEMS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  addCheckedOutItem(identifier?: string) {
    if (!identifier) return;
    const clean = identifier.trim().toLowerCase();
    const items = this.getCheckedOutItems();
    if (!items.includes(clean)) {
      items.push(clean);
      try {
        localStorage.setItem(STORAGE_KEYS.CHECKED_OUT_ITEMS, JSON.stringify(items));
      } catch (e) {
        console.error('Erreur ajout checked out item', e);
      }
    }
  }

  isCheckedOut(item: { id?: string; plate?: string; clientName?: string }): boolean {
    const list = this.getCheckedOutItems();
    if (item.id && list.includes(item.id.trim().toLowerCase())) return true;
    if (item.plate) {
      const cleanPlate = item.plate.replace(/\s+/g, '').toLowerCase();
      if (list.includes(cleanPlate) || list.includes(item.plate.trim().toLowerCase())) return true;
    }
    if (item.clientName && list.includes(item.clientName.trim().toLowerCase())) return true;
    return false;
  }

  // Rendez-vous actuellement sélectionné pour être inspecté au check-in
  getPendingCheckin(): ClientAppointment | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.PENDING_CHECKIN);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  setPendingCheckin(appointment: ClientAppointment | null) {
    try {
      if (appointment) {
        localStorage.setItem(STORAGE_KEYS.PENDING_CHECKIN, JSON.stringify(appointment));
      } else {
        localStorage.removeItem(STORAGE_KEYS.PENDING_CHECKIN);
      }
    } catch (e) {
      console.error('Erreur sauvegarde pending check-in', e);
    }
  }

  // ==========================================
  // GESTION DES ORDRES DE RÉPARATION (CHEF -> TECH)
  // ==========================================
  getOrders(): SyncRepairOrder[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.ORDERS);
      const parsed: SyncRepairOrder[] = data ? JSON.parse(data) : [];
      return parsed.map((o) => ({
        ...o,
        imageUrl: normalizeKiaVehicleImageUrl(o.imageUrl, o.vehicleName),
      }));
    } catch {
      return [];
    }
  }

  addOrder(order: SyncRepairOrder): SyncRepairOrder {
    const list = this.getOrders();
    const orderWithFlag: SyncRepairOrder = {
      ...order,
      isNewForTech: true,
    };
    const updated = [orderWithFlag, ...list.filter((o) => o.id !== order.id)];
    try {
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(updated));
      // Incrémenter le badge non-lu pour le technicien
      const unreadCount = this.getUnreadTechCount() + 1;
      localStorage.setItem(STORAGE_KEYS.TECH_NOTIF_COUNT, String(unreadCount));
    } catch (e) {
      console.error('Erreur sauvegarde OR', e);
    }

    // Persistance asynchrone Firestore (Table repair_orders)
    try {
      setDoc(doc(db, 'repair_orders', order.id), {
        id: order.id,
        vehicle_name: order.vehicleName,
        plate: order.plate,
        vin: order.vin || '',
        client_id: order.clientId || '',
        client_name: order.clientName || 'Client Kia',
        client_email: order.clientEmail || '',
        client_phone: order.clientPhone || '',
        service: order.service,
        technician_id: 'cpt-tech-001',
        bay: order.bay,
        status: 'EN_REPARATION',
        current_step: 1,
        progress_percent: order.progressPercent || 25,
        km_in: typeof order.mileage === 'number' ? order.mileage : 18420,
        diagnostic_notes: `Ordre généré le ${new Date().toLocaleDateString('fr-FR')} - ${order.service}`,
        created_at: new Date().toISOString(),
      }).catch((e) => console.warn('Sync Firestore OR non-bloquant:', e));
    } catch {}

    return orderWithFlag;
  }

  getUnreadTechCount(): number {
    try {
      const count = localStorage.getItem(STORAGE_KEYS.TECH_NOTIF_COUNT);
      return count ? parseInt(count, 10) : 0;
    } catch {
      return 0;
    }
  }

  removeActiveOrder(orderId?: string, plate?: string) {
    const list = this.getOrders();
    const cleanPlate = (plate || '').replace(/\s+/g, '').toLowerCase();
    const cleanId = (orderId || '').trim().toLowerCase();
    const updated = list.filter((o) => {
      if (cleanId && o.id.trim().toLowerCase() === cleanId) return false;
      if (cleanPlate && o.plate && o.plate.replace(/\s+/g, '').toLowerCase() === cleanPlate) return false;
      return true;
    });
    if (orderId) this.dismissTechOrder(orderId);
    if (plate) this.dismissTechOrder(plate);
    try {
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(updated));
      window.dispatchEvent(new Event('k_dms_orders_updated'));
    } catch (e) {
      console.error('Erreur suppression ordre actif', e);
    }

    // Suppression Firestore
    try {
      if (orderId) {
        deleteDoc(doc(db, 'repair_orders', orderId)).catch(() => {});
      }
    } catch {}
  }

  getDismissedTechOrders(): string[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.DISMISSED_TECH_ORDERS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  dismissTechOrder(idOrPlate: string) {
    if (!idOrPlate) return;
    const clean = idOrPlate.replace(/\s+/g, '').toLowerCase();
    const list = this.getDismissedTechOrders();
    if (!list.includes(clean)) {
      list.push(clean);
      try {
        localStorage.setItem(STORAGE_KEYS.DISMISSED_TECH_ORDERS, JSON.stringify(list));
        window.dispatchEvent(new Event('k_dms_orders_updated'));
      } catch (e) {
        console.error('Erreur rejet ordre tech', e);
      }
    }
  }

  isTechOrderDismissed(id?: string, plate?: string): boolean {
    const list = this.getDismissedTechOrders();
    if (id && list.includes(id.trim().toLowerCase())) return true;
    if (plate) {
      const cleanPlate = plate.replace(/\s+/g, '').toLowerCase();
      if (list.includes(cleanPlate)) return true;
    }
    return false;
  }

  removeCompletedOrder(id: string) {
    const list = this.getCompletedOrdersToday();
    const updated = list.filter((o) => o.id !== id);
    try {
      localStorage.setItem(STORAGE_KEYS.COMPLETED_TECH_ORDERS, JSON.stringify(updated));
      window.dispatchEvent(new Event('k_dms_completed_orders_updated'));
    } catch (e) {
      console.error('Erreur suppression ordre terminé', e);
    }
  }

  markTechOrdersRead() {
    try {
      localStorage.setItem(STORAGE_KEYS.TECH_NOTIF_COUNT, '0');
      const list = this.getOrders();
      const updated = list.map((o) => ({ ...o, isNewForTech: false }));
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(updated));
    } catch (e) {
      console.error('Erreur acquittement notifications tech', e);
    }
  }

  // ==========================================
  // PHASE 2 : PROGRESSION EN DIRECT (TECH -> CLIENT & CHEF)
  // ==========================================
  getLiveProgress(): WorkshopLiveProgress | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.LIVE_PROGRESS);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  setLiveProgress(progress: WorkshopLiveProgress | null) {
    try {
      if (progress) {
        localStorage.setItem(STORAGE_KEYS.LIVE_PROGRESS, JSON.stringify(progress));
      } else {
        localStorage.removeItem(STORAGE_KEYS.LIVE_PROGRESS);
      }
      window.dispatchEvent(new Event('k_dms_live_updated'));
    } catch (e) {
      console.error('Erreur sauvegarde live progress', e);
    }
  }

  /**
   * Suivi en direct filtré strictement par compte client (clientId ou clientEmail uniquement)
   */
  getLiveProgressForClient(compte: Compte | null): WorkshopLiveProgress | null {
    const live = this.getLiveProgress();
    if (!live || !compte) return null;
    return this.doesRecordBelongToClient(live, compte) ? live : null;
  }

  /**
   * Indicateur rouge barre client :
   * Allumé uniquement si l'intervention en cours (Étapes 1 à 3) appartient au client connecté.
   */
  hasActiveWorkshopIndicator(): boolean {
    const live = this.getLiveProgress();
    if (!live) return false;
    if (live.status === 'ready_for_restitution' || live.status === 'completed_and_paid') {
      return false;
    }
    return live.currentStep < 4;
  }

  hasActiveWorkshopIndicatorForClient(compte: Compte | null): boolean {
    const live = this.getLiveProgressForClient(compte);
    if (!live) return false;
    if (live.status === 'ready_for_restitution' || live.status === 'completed_and_paid') {
      return false;
    }
    return live.currentStep < 4;
  }

  getArchivedServiceHistory(): ServiceHistoryItem[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SERVICE_HISTORY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  /**
   * Historique archivé filtré strictement par clientId et clientEmail du compte connecté
   */
  getArchivedServiceHistoryForClient(compte: Compte | null): ServiceHistoryItem[] {
    if (!compte) return [];
    return this.getArchivedServiceHistory().filter((item) =>
      this.doesRecordBelongToClient(item, compte)
    );
  }

  saveServiceHistoryItem(item: ServiceHistoryItem): ServiceHistoryItem[] {
    const current = this.getArchivedServiceHistory();
    const updated = [item, ...current.filter((h) => h.id !== item.id && h.orNumber !== item.orNumber)];
    try {
      localStorage.setItem(STORAGE_KEYS.SERVICE_HISTORY, JSON.stringify(updated));
      window.dispatchEvent(new Event('k_dms_history_updated'));
    } catch (e) {
      console.error('Erreur sauvegarde historique client', e);
    }

    // Persistance Firestore (Table service_history)
    try {
      const docId = item.id.replace(/[^a-zA-Z0-9_-]/g, '_');
      setDoc(doc(db, 'service_history', docId), {
        ...item,
        or_number: item.orNumber,
        vehicle_name: item.vehicleName || '',
        vin: item.vin || '',
        client_id: item.clientId || '',
        client_name: item.clientName || '',
        client_email: item.clientEmail || '',
        client_phone: item.clientPhone || '',
        payment_method: item.paymentMethod || '',
        paid_at: item.paidAt || new Date().toISOString(),
        archived_at: new Date().toISOString(),
      }).catch((e) => console.warn('Sync Firestore service_history non-bloquant:', e));
    } catch {}

    return updated;
  }

  // 1. Acceptation de l'ordre par le technicien -> Début Étape 01 & Message Client
  acceptOrderByTech(orderId?: string): WorkshopLiveProgress {
    const orders = this.getOrders();
    const targetOrder = orders.find((o) => (orderId ? o.id === orderId : true)) || orders[0];

    const plate = targetOrder?.plate || '228 TU 4591';
    const resolvedIdentity = this.resolveClientIdentityByPlate(plate);
    const clientId = targetOrder?.clientId || resolvedIdentity.clientId;
    const clientEmail = targetOrder?.clientEmail || resolvedIdentity.clientEmail;
    const clientPhone = targetOrder?.clientPhone || resolvedIdentity.clientPhone;
    const clientName = targetOrder?.clientName || resolvedIdentity.clientName || 'Client Kia';
    const vehicleName = targetOrder?.vehicleName || 'Véhicule Kia';
    const serviceTitle = targetOrder?.service || 'Entretien Constructeur & Révision 75 points';

    const now = new Date();
    const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const startedTimestamp = Date.now() - (6326 * 1000);

    const newLive: WorkshopLiveProgress = {
      orderId: targetOrder?.id || '#OR-2026-9104',
      vehicleName,
      plate,
      vin: targetOrder?.vin,
      clientId,
      clientName,
      clientEmail,
      clientPhone,
      technicianName: 'Karim Trabelsi',
      technicianRole: 'Master Tech Certifié',
      bay: 'Pont ciseaux #04 (Mécanique)',
      serviceTitle,
      estimatedDuration: '2h 30m',
      startedAt: timeStr,
      startedTimestamp,
      currentStep: 1,
      progressPercent: 25,
      stages: DEFAULT_STAGES.map((s) => ({
        ...s,
        status: s.step === 1 ? ('in_progress' as const) : ('pending' as const),
      })),
      status: 'accepted',
      lastUpdatedMessage: `Votre véhicule est pris en charge par Karim Trabelsi (Master Tech) • Baie #04 • Durée estimée : 2h30 • Pont ciseaux #04`,
      lastUpdatedAt: timeStr,
    };

    this.setLiveProgress(newLive);
    this.setClientToast(newLive.lastUpdatedMessage, {
      plate: newLive.plate,
      clientEmail: newLive.clientEmail,
      clientId: newLive.clientId,
    });
    return newLive;
  }

  getElapsedSeconds(live: WorkshopLiveProgress | null): number {
    if (!live) return 6326;
    if (live.startedTimestamp) {
      return Math.max(0, Math.floor((Date.now() - live.startedTimestamp) / 1000));
    }
    return 6326;
  }

  // Gestion de l'historique des travaux terminés du jour
  getCompletedOrdersToday(): CompletedTechOrder[] {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.COMPLETED_TECH_ORDERS);
      if (!data) {
        localStorage.setItem(STORAGE_KEYS.COMPLETED_TECH_ORDERS, JSON.stringify(INITIAL_COMPLETED_ORDERS));
        return INITIAL_COMPLETED_ORDERS;
      }
      return JSON.parse(data);
    } catch {
      return INITIAL_COMPLETED_ORDERS;
    }
  }

  archiveTechOrder(progress: WorkshopLiveProgress): CompletedTechOrder {
    const list = this.getCompletedOrdersToday();
    const now = new Date();
    const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    let durationMinutes = 105;
    if (progress.startedTimestamp) {
      durationMinutes = Math.max(15, Math.round((Date.now() - progress.startedTimestamp) / 60000));
    }
    const hours = Math.floor(durationMinutes / 60);
    const mins = durationMinutes % 60;
    const durationLabel = hours > 0 ? `${hours}h ${mins.toString().padStart(2, '0')}m` : `${mins} min`;

    const newCompleted: CompletedTechOrder = {
      id: progress.orderId,
      plate: progress.plate,
      vehicleName: progress.vehicleName,
      clientId: progress.clientId,
      clientEmail: progress.clientEmail,
      clientName: progress.clientName,
      service: progress.serviceTitle,
      completedAt: timeStr,
      dateStr: "Aujourd'hui",
      durationMinutes,
      durationLabel,
      standardHours: 2.5,
      qualityCheck: true,
      technicianName: progress.technicianName,
      chefStatus: 'waiting_payment',
    };

    const updated = [newCompleted, ...list.filter((o) => o.id !== newCompleted.id)];
    try {
      localStorage.setItem(STORAGE_KEYS.COMPLETED_TECH_ORDERS, JSON.stringify(updated));
      window.dispatchEvent(new Event('k_dms_completed_orders_updated'));
    } catch (e) {
      console.error('Erreur archivage ordre terminé', e);
    }
    return newCompleted;
  }

  // 2. Progression en 4 étapes
  advanceOrderStep(targetStep: 2 | 3 | 4): WorkshopLiveProgress | null {
    const current = this.getLiveProgress();
    if (!current) return null;

    const now = new Date();
    const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    let percent = 25;
    let message = '';
    let status: WorkshopLiveProgress['status'] = 'in_progress';

    if (targetStep === 2) {
      percent = 50;
      message = 'Étape 01 terminée : Diagnostic & Inspection validés. Début des travaux d’entretien et réparations.';
    } else if (targetStep === 3) {
      percent = 75;
      message = 'Étape 02 terminée : Travaux d’atelier achevés. Lancement du contrôle qualité & essai dynamique.';
    } else if (targetStep === 4) {
      percent = 100;
      status = 'ready_for_restitution';
      message = 'Étape 03 & 04 terminées avec succès : Contrôle qualité zéro défaut et clôture des travaux ! Véhicule prêt pour la restitution.';
      this.setChefRestitutionAlert(true);
    }

    const updatedStages = current.stages.map((stage) => {
      if (stage.step < targetStep) {
        return { ...stage, status: 'completed' as const };
      }
      if (stage.step === targetStep) {
        return { ...stage, status: targetStep === 4 ? ('completed' as const) : ('in_progress' as const), timeLabel: timeStr };
      }
      return { ...stage, status: 'pending' as const };
    });

    const updated: WorkshopLiveProgress = {
      ...current,
      currentStep: targetStep,
      progressPercent: percent,
      stages: updatedStages,
      status,
      lastUpdatedMessage: message,
      lastUpdatedAt: timeStr,
    };

    this.setLiveProgress(updated);
    this.setClientToast(message, {
      plate: updated.plate,
      clientEmail: updated.clientEmail,
      clientId: updated.clientId,
    });

    // Mise à jour de la progression dans Firestore (repair_orders)
    try {
      const statusSql = targetStep === 4 ? 'PRET' : targetStep === 3 ? 'CONTROLE_QUALITE' : 'EN_REPARATION';
      updateDoc(doc(db, 'repair_orders', updated.orderId), {
        status: statusSql,
        current_step: targetStep,
        progress_percent: percent,
        ...(targetStep === 4 ? { completed_at: new Date().toISOString() } : {}),
      }).catch(() => {});
    } catch {}

    if (targetStep === 4) {
      this.archiveTechOrder(updated);
      this.removeActiveOrder(updated.orderId, updated.plate);
      try {
        window.dispatchEvent(new Event('k_dms_orders_updated'));
      } catch {}
    }

    return updated;
  }

  // Écouteurs temps réel Firestore
  private hasInitializedListeners = false;
  initFirestoreListeners() {
    if (this.hasInitializedListeners) return;
    this.hasInitializedListeners = true;

    try {
      // Écoute temps réel des rendez-vous
      onSnapshot(
        collection(db, 'appointments'),
        (snapshot) => {
          const loadedAppts: ClientAppointment[] = [];
          snapshot.forEach((d) => {
            const data = d.data();
            const parsed = parseAppointmentDateFields(data.appointment_date);
            const fallbackToday = new Date().toISOString().split('T')[0];
            const rawDecision = String(data.chef_decision || '').toUpperCase();
            const derivedDecision: 'pending' | 'confirmed' | 'rejected' =
              rawDecision === 'REJECTED' || data.status === 'REJECTED'
                ? 'rejected'
                : rawDecision === 'CONFIRMED' ||
                  data.status === 'CONFIRMED' ||
                  data.status === 'COMPLETED' ||
                  data.source === 'chef_long_term'
                ? 'confirmed'
                : 'pending';

            const derivedStatus: ClientAppointment['status'] =
              data.status === 'COMPLETED'
                ? 'completed'
                : data.status === 'REJECTED'
                ? 'rejected'
                : data.status === 'CANCELLED'
                ? 'cancelled'
                : data.or_id || data.checkin_id
                ? 'checked_in'
                : 'booked';

            loadedAppts.push({
              id: data.id || d.id,
              clientId: data.client_id,
              clientName: data.client_name || 'Client Kia',
              clientPhone: data.client_phone,
              clientEmail: data.client_email,
              vehicleName: data.vehicle_name || 'Kia Gamme Récente',
              plate: data.vehicle_id || data.plate || '',
              serviceName: data.service_type || 'Entretien & Contrôle',
              price: data.price || '280.000 TND',
              dateStr: data.date_str || parsed.dateStr || fallbackToday,
              formattedDate: String(data.appointment_date || "Aujourd'hui").replace(/\s+à\s+\d{1,2}:\d{2}$/, ''),
              time: data.time || parsed.time || '09:00',
              createdAt: data.created_at || new Date().toISOString(),
              updatedAt: data.updated_at,
              modificationNote: data.modification_note,
              source: data.source === 'chef_long_term' ? 'chef_long_term' : 'client_week',
              notes: data.notes,
              orId: data.or_id,
              chefDecision: derivedDecision,
              status: derivedStatus,
            });
          });

          if (loadedAppts.length > 0) {
            const local = this.getAppointments();
            const mapById = new Map<string, ClientAppointment>();
            for (const item of local) {
              mapById.set(item.id, item);
            }
            for (const remote of loadedAppts) {
              const existing = mapById.get(remote.id);
              mapById.set(
                remote.id,
                existing
                  ? {
                      ...existing,
                      ...remote,
                      clientId: remote.clientId || existing.clientId,
                      clientPhone: remote.clientPhone || existing.clientPhone,
                      clientEmail: remote.clientEmail || existing.clientEmail,
                      vehicleName: remote.vehicleName || existing.vehicleName,
                      formattedDate: remote.formattedDate || existing.formattedDate,
                      status:
                        existing.status === 'checked_in' && remote.status === 'booked'
                          ? 'checked_in'
                          : remote.status,
                    }
                  : remote
              );
            }
            const merged = Array.from(mapById.values()).sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(merged));
            window.dispatchEvent(new Event('k_dms_planning_updated'));
          }
        },
        (err) => handleFirestoreError(err, OperationType.GET, 'appointments')
      );

      // Écoute temps réel des notifications Chef d'Atelier (chef_notifications)
      onSnapshot(
        collection(db, 'chef_notifications'),
        (snapshot) => {
          if (!snapshot.empty) {
            const loadedNotifs: ChefNotification[] = [];
            snapshot.forEach((d) => {
              const data = d.data();
              loadedNotifs.push({
                id: data.id || d.id,
                type: (data.type || 'rdv_modified') as ChefNotification['type'],
                appointmentId: data.appointment_id || '',
                clientName: data.client_name || 'Client Kia',
                clientPhone: data.client_phone,
                plate: data.plate || '',
                title: data.title || 'Alerte Rendez-vous',
                message: data.message || '',
                read: Boolean(data.read),
                createdAt: data.created_at || new Date().toISOString(),
              });
            });
            if (loadedNotifs.length > 0) {
              const local = this.getChefNotifications();
              const mapById = new Map(local.map((n) => [n.id, n]));
              for (const n of loadedNotifs) {
                const existing = mapById.get(n.id);
                mapById.set(n.id, existing ? { ...n, read: existing.read || n.read } : n);
              }
              const merged = Array.from(mapById.values()).sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
              );
              localStorage.setItem(STORAGE_KEYS.CHEF_NOTIFICATIONS, JSON.stringify(merged.slice(0, 50)));
              window.dispatchEvent(new Event('k_dms_chef_notifications_updated'));
            }
          }
        },
        (err) => console.warn('Snapshot chef_notifications (mode hors-ligne):', err)
      );

      // Écoute temps réel des demandes clients RDV long terme (chef_requests)
      onSnapshot(collection(db, 'chef_requests'), (snapshot) => {
        if (!snapshot.empty) {
          const loadedReqs: ChefLongTermRequest[] = [];
          snapshot.forEach((d) => {
            const data = d.data();
            loadedReqs.push({
              id: data.id || d.id,
              clientId: data.client_id,
              clientName: data.client_name || 'Client Kia',
              clientPhone: data.client_phone,
              clientEmail: data.client_email,
              vehicleName: data.vehicle_name || 'Kia',
              plate: data.plate || '',
              channel: (data.channel || 'sav_message') as ChefLongTermRequest['channel'],
              preferredPeriod: data.preferred_period || 'Après cette semaine',
              serviceType: data.service_type || 'Entretien Périodique',
              message: data.message || '',
              status: (data.status || 'PENDING') as ChefLongTermRequest['status'],
              scheduledDate: data.scheduled_date,
              scheduledTime: data.scheduled_time,
              createdAt: data.created_at || new Date().toISOString(),
            });
          });
          if (loadedReqs.length > 0) {
            const local = this.getChefRequests();
            const mapById = new Map(local.map((r) => [r.id, r]));
            for (const item of loadedReqs) {
              mapById.set(item.id, item);
            }
            const merged = Array.from(mapById.values()).sort(
              (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            );
            localStorage.setItem(STORAGE_KEYS.CHEF_REQUESTS, JSON.stringify(merged));
            window.dispatchEvent(new Event('k_dms_chef_requests_updated'));
          }
        }
      }, (err) => console.warn('Snapshot chef_requests (mode hors-ligne):', err));

      // Écoute temps réel du Carnet d'Entretien Numérique (service_history)
      onSnapshot(collection(db, 'service_history'), (snapshot) => {
        if (!snapshot.empty) {
          const loadedHistory: ServiceHistoryItem[] = [];
          snapshot.forEach((d) => {
            const data = d.data();
            loadedHistory.push({
              id: data.id || d.id,
              date: data.date || 'Auj.',
              year: data.year || String(new Date().getFullYear()),
              title: data.title || 'Intervention Atelier Kia',
              mileage: data.mileage || '18 420 km',
              description: data.description || '',
              workshop: data.workshop || 'City Cars Kia La Goulette',
              advisor: data.advisor || 'Hédi Mansour',
              status: 'completed',
              orNumber: data.orNumber || data.or_number || '#OR-2026',
              invoiceNumber: data.invoiceNumber,
              amount: data.amount,
              category: data.category,
              vehicleName: data.vehicleName || data.vehicle_name,
              plate: data.plate,
              vin: data.vin,
              clientId: data.clientId || data.client_id,
              clientName: data.clientName || data.client_name,
              clientEmail: data.clientEmail || data.client_email,
              clientPhone: data.clientPhone || data.client_phone,
              technicianName: data.technicianName,
              bay: data.bay,
              durationLabel: data.durationLabel,
              paymentMethod: data.paymentMethod || data.payment_method,
              paidAt: data.paidAt || data.paid_at,
              operations: data.operations,
              parts: data.parts,
              qualityChecks: data.qualityChecks,
              movedFromLive: Boolean(data.movedFromLive),
            });
          });
          if (loadedHistory.length > 0) {
            const local = this.getArchivedServiceHistory();
            const mapByOr = new Map<string, ServiceHistoryItem>(
              local.map((h) => [h.orNumber, h])
            );
            for (const item of loadedHistory) {
              const existing = mapByOr.get(item.orNumber);
              mapByOr.set(
                item.orNumber,
                existing
                  ? {
                      ...existing,
                      ...item,
                      clientId: item.clientId || existing.clientId,
                      clientEmail: item.clientEmail || existing.clientEmail,
                      clientPhone: item.clientPhone || existing.clientPhone,
                      vin: item.vin || existing.vin,
                    }
                  : item
              );
            }
            localStorage.setItem(STORAGE_KEYS.SERVICE_HISTORY, JSON.stringify(Array.from(mapByOr.values())));
            window.dispatchEvent(new Event('k_dms_history_updated'));
          }
        }
      }, (err) => console.warn('Snapshot service_history (mode hors-ligne):', err));

      // Écoute temps réel des Devis & Commandes Pièces (quotes)
      onSnapshot(
        collection(db, 'quotes'),
        (snapshot) => {
          if (!snapshot.empty) {
            const loadedQuotes: AdditionalQuote[] = [];
            snapshot.forEach((d) => {
              const data = d.data();
              const statusMap: Record<string, AdditionalQuote['status']> = {
                PENDING: 'pending',
                APPROVED: 'accepted',
                REJECTED: 'refused',
                pending: 'pending',
                accepted: 'accepted',
                refused: 'refused',
              };
              loadedQuotes.push({
                id: data.id || d.id,
                orId: data.repair_order_id || data.orId,
                vehicle: data.vehicle_name || data.vehicle || 'Kia Sportage GT-Line',
                plate: data.plate || '228 TU 4591',
                clientId: data.client_id || data.clientId,
                clientName: data.client_name || data.clientName,
                clientEmail: data.client_email || data.clientEmail,
                clientPhone: data.client_phone || data.clientPhone,
                bay: data.bay || 'Pont #04 (Mécanique)',
                title: data.title || 'Devis Complémentaire Pièce',
                description: data.description || '',
                issuedTime: data.issued_time || data.issuedTime || '10:30',
                issuedBy: data.issued_by || data.issuedBy || 'Karim Trabelsi',
                criticalWearPercent: Number(data.critical_wear_percent ?? 80),
                measuredThickness: data.measured_thickness || 'Usure critique',
                minThickness: data.min_thickness || 'Seuil constructeur',
                photoUrl:
                  data.photo_url ||
                  INITIAL_QUOTE.photoUrl,
                partsPrice: Number(data.parts_price ?? data.total_amount ?? 0),
                laborPrice: Number(data.labor_price ?? 0),
                taxPrice: Number(data.tax_price ?? 0),
                totalPrice: Number(data.total_amount ?? data.totalPrice ?? 0),
                status: statusMap[data.status] || 'pending',
                acceptedAt: data.responded_at || data.acceptedAt,
                respondedAt: data.responded_at || data.respondedAt,
                clientComment: data.client_comment ?? data.clientComment ?? '',
                partAvailability: data.part_availability === 'out_of_stock' ? 'out_of_stock' : 'in_stock',
                requiresPartOrder: Boolean(data.requires_part_order ?? (data.part_availability === 'out_of_stock')),
                estimatedDeliveryDelay: data.estimated_delivery_delay || data.estimatedDeliveryDelay,
                parts: Array.isArray(data.parts) ? data.parts : undefined,
                techStockConfirmed: Boolean(data.tech_stock_confirmed ?? data.techStockConfirmed),
                techStockConfirmedAt: data.tech_stock_confirmed_at || data.techStockConfirmedAt,
                chefDeliveryConfirmed: Boolean(data.chef_delivery_confirmed ?? data.chefDeliveryConfirmed),
                chefDeliveryConfirmedAt: data.chef_delivery_confirmed_at || data.chefDeliveryConfirmedAt,
                createdAt: data.created_at || data.createdAt || new Date().toISOString(),
              });
            });

            if (loadedQuotes.length > 0) {
              const local = this.getQuotes();
              const mapById = new Map<string, AdditionalQuote>(local.map((q) => [q.id, q]));
              for (const remote of loadedQuotes) {
                const existing = mapById.get(remote.id);
                mapById.set(
                  remote.id,
                  existing
                    ? {
                        ...existing,
                        ...remote,
                        parts: remote.parts || existing.parts,
                        vehicle: remote.vehicle || existing.vehicle,
                        plate: remote.plate || existing.plate,
                        clientId: remote.clientId || existing.clientId,
                        clientName: remote.clientName || existing.clientName,
                        clientEmail: remote.clientEmail || existing.clientEmail,
                        clientPhone: remote.clientPhone || existing.clientPhone,
                      }
                    : remote
                );
              }
              const merged = Array.from(mapById.values()).sort(
                (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
              );
              localStorage.setItem(STORAGE_KEYS.QUOTES, JSON.stringify(merged));
              window.dispatchEvent(new Event('k_dms_quotes_updated'));
            }
          }
        },
        (err) => console.warn('Snapshot quotes (mode hors-ligne):', err)
      );

      // Écoute temps réel du Stock Magasin (spare_parts)
      onSnapshot(
        collection(db, 'spare_parts'),
        (snapshot) => {
          if (!snapshot.empty) {
            const local = this.getPartsStock();
            const mapById = new Map<string, PartItem>(local.map((p) => [p.id, p]));
            snapshot.forEach((d) => {
              const data = d.data();
              const existing = mapById.get(data.id || d.id);
              if (existing) {
                const qty = typeof data.stock_qty === 'number' ? data.stock_qty : existing.stockCount;
                mapById.set(existing.id, {
                  ...existing,
                  stockCount: qty,
                  inStock: qty > 0,
                });
              }
            });
            localStorage.setItem(STORAGE_KEYS.PARTS_STOCK, JSON.stringify(Array.from(mapById.values())));
            window.dispatchEvent(new Event('k_dms_parts_updated'));
          }
        },
        (err) => console.warn('Snapshot spare_parts (mode hors-ligne):', err)
      );

      // Écoute temps réel des Ordres de Réparation (repair_orders -> statut En attente pièce / En cours)
      onSnapshot(
        collection(db, 'repair_orders'),
        (snapshot) => {
          if (!snapshot.empty) {
            const localOrders = this.getOrders();
            const mapById = new Map<string, SyncRepairOrder>(localOrders.map((o) => [o.id, o]));
            let changed = false;

            snapshot.forEach((d) => {
              const data = d.data();
              const id = data.id || d.id;
              const existing = mapById.get(id);
              const mappedStatus: SyncRepairOrder['status'] =
                data.status === 'ATTENTE_PIECES'
                  ? 'waiting_parts'
                  : data.status === 'CONTROLE_QUALITE'
                  ? 'quality_check'
                  : data.status === 'PRET'
                  ? 'ready'
                  : data.status === 'VEHICULE_RECU'
                  ? 'pending'
                  : 'in_progress';

              if (data.status === 'COMPLETED_AND_PAID') {
                if (existing) {
                  mapById.delete(id);
                  changed = true;
                }
                return;
              }

              if (existing) {
                if (
                  existing.status !== mappedStatus ||
                  existing.waitingPartsReason !== data.waiting_parts_reason
                ) {
                  mapById.set(id, {
                    ...existing,
                    status: mappedStatus,
                    statusLabel:
                      mappedStatus === 'waiting_parts'
                        ? 'En attente pièce'
                        : mappedStatus === 'quality_check'
                        ? 'Contrôle Qualité'
                        : 'Travaux en cours',
                    waitingPartsReason: data.waiting_parts_reason || existing.waitingPartsReason,
                  });
                  changed = true;
                }
              } else {
                mapById.set(id, {
                  id,
                  createdTime: data.created_at
                    ? new Date(data.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                    : '09:00',
                  vehicleName: data.vehicle_name || 'Véhicule Kia',
                  plate: data.plate || '',
                  vin: data.vin,
                  service: data.service || 'Entretien Atelier',
                  serviceCategory: 'Mécanique & Diagnostic',
                  technician: 'Karim Trabelsi',
                  technicianRole: 'Master Tech',
                  bay: data.bay || 'Pont #04',
                  status: mappedStatus,
                  statusLabel:
                    mappedStatus === 'waiting_parts'
                      ? 'En attente pièce'
                      : mappedStatus === 'quality_check'
                      ? 'Contrôle Qualité'
                      : 'Travaux en cours',
                  progressPercent: Number(data.progress_percent ?? 25),
                  timeElapsed: '0h 30m',
                  timeEstimated: '2h 30m',
                  estimatedHours: 2.5,
                  imageUrl: resolveKiaModelImage(data.vehicle_name),
                  clientId: data.client_id || data.clientId,
                  clientName: data.client_name,
                  clientEmail: data.client_email || data.clientEmail,
                  clientPhone: data.client_phone || data.clientPhone,
                  waitingPartsReason: data.waiting_parts_reason,
                });
                changed = true;
              }
            });

            if (changed) {
              localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(Array.from(mapById.values())));
              window.dispatchEvent(new Event('k_dms_orders_updated'));
            }
          }
        },
        (err) => console.warn('Snapshot repair_orders (mode hors-ligne):', err)
      );

      // Écoute temps réel de l'Équipe & Habilitations (workshop_team)
      onSnapshot(
        collection(db, 'workshop_team'),
        (snapshot) => {
          if (!snapshot.empty) {
            const loadedTeam: WorkshopTechnician[] = [];
            snapshot.forEach((d) => {
              const data = d.data() as Partial<WorkshopTechnician>;
              if (data && data.name) {
                loadedTeam.push({
                  id: data.id || d.id,
                  name: data.name,
                  initials:
                    data.initials ||
                    data.name
                      .split(' ')
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((w) => w[0]?.toUpperCase())
                      .join(''),
                  role: (data.role as TechnicianRole) || 'Tech Généraliste',
                  certifications: Array.isArray(data.certifications) ? data.certifications : [],
                  availability: (data.availability as TechnicianAvailability) || 'en_poste',
                  shiftStart: data.shiftStart || '08:00',
                  shiftEnd: data.shiftEnd || '17:00',
                  maxLoadPercent: Number(data.maxLoadPercent ?? 85),
                  currentLoadPercent: Number(data.currentLoadPercent ?? 50),
                  active: data.active !== false,
                  assignedBayId: data.assignedBayId,
                  phone: data.phone,
                  avatar: data.avatar,
                });
              }
            });
            if (loadedTeam.length > 0) {
              localStorage.setItem(STORAGE_KEYS.WORKSHOP_TEAM, JSON.stringify(loadedTeam));
              window.dispatchEvent(new Event('k_dms_team_updated'));
            }
          }
        },
        (err) => console.warn('Snapshot workshop_team (mode hors-ligne):', err)
      );

      // Écoute temps réel des Ponts & Baies (workshop_bays)
      onSnapshot(
        collection(db, 'workshop_bays'),
        (snapshot) => {
          if (!snapshot.empty) {
            const local = this.getWorkshopBays();
            const byId = new Map<string, WorkshopBay>(local.map((b) => [b.id, b]));
            snapshot.forEach((d) => {
              const data = d.data() as Partial<WorkshopBay>;
              const id = data.id || d.id;
              const prev = byId.get(id);
              byId.set(id, {
                id,
                name: data.name || prev?.name || `PONT ${id}`,
                specialty: (data.specialty as BaySpecialty) || prev?.specialty || 'Mécanique lourde',
                status: data.status === 'maintenance' ? 'maintenance' : 'open',
                maintenanceReason: data.maintenanceReason || '',
                leadTechnicianId: data.leadTechnicianId ?? prev?.leadTechnicianId,
                leadTechnicianName: data.leadTechnicianName ?? prev?.leadTechnicianName,
              });
            });
            const sorted = Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));
            localStorage.setItem(STORAGE_KEYS.WORKSHOP_BAYS, JSON.stringify(sorted));
            window.dispatchEvent(new Event('k_dms_bays_updated'));
          }
        },
        (err) => console.warn('Snapshot workshop_bays (mode hors-ligne):', err)
      );

      // Écoute temps réel des Paramètres Atelier (workshop_settings)
      onSnapshot(
        collection(db, 'workshop_settings'),
        (snapshot) => {
          if (!snapshot.empty) {
            snapshot.forEach((d) => {
              if (d.id === 'default' || d.data()?.id === 'default') {
                const data = d.data() as Partial<WorkshopSettings>;
                const merged: WorkshopSettings = {
                  ...DEFAULT_WORKSHOP_SETTINGS,
                  ...data,
                  maintenancePrices: {
                    ...DEFAULT_WORKSHOP_SETTINGS.maintenancePrices,
                    ...(data.maintenancePrices || {}),
                  },
                  closedDates: Array.isArray(data.closedDates) ? data.closedDates : [],
                };
                localStorage.setItem(STORAGE_KEYS.WORKSHOP_SETTINGS, JSON.stringify(merged));
                window.dispatchEvent(new Event('k_dms_settings_updated'));
              }
            });
          }
        },
        (err) => console.warn('Snapshot workshop_settings (mode hors-ligne):', err)
      );
    } catch (e) {
      console.warn('initFirestoreListeners error:', e);
    }
  }

  // ==========================================
  // GESTION STOCK PIÈCES & DEVIS COMPLÉMENTAIRES (TECH -> CLIENT -> STOCK -> CHEF)
  // ==========================================
  getPartsStock(): PartItem[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.PARTS_STOCK);
      if (raw === null) {
        localStorage.setItem(STORAGE_KEYS.PARTS_STOCK, JSON.stringify(INITIAL_PARTS_STOCK));
        return INITIAL_PARTS_STOCK;
      }
      return JSON.parse(raw);
    } catch {
      return INITIAL_PARTS_STOCK;
    }
  }

  savePartsStock(parts: PartItem[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.PARTS_STOCK, JSON.stringify(parts));
      window.dispatchEvent(new Event('k_dms_parts_updated'));
    } catch (e) {
      console.error('Erreur sauvegarde stock pièces', e);
    }
  }

  getQuotes(): AdditionalQuote[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.QUOTES);
      if (raw === null) {
        const seeded: AdditionalQuote[] = [
          {
            ...INITIAL_QUOTE,
            orId: '#OR-2026-9104',
            clientId: 'cpt-client-001',
            clientName: 'M. Sami Ben Amor',
            clientEmail: 'client@kia.tn',
            clientPhone: '+216 98 400 123',
            bay: 'Pont #04 (Mécanique)',
            partAvailability: 'in_stock',
            requiresPartOrder: false,
            techStockConfirmed: false,
            chefDeliveryConfirmed: false,
            createdAt: new Date().toISOString(),
            parts: [
              {
                partId: 'part-fr-01',
                oemRef: '58101-D7A00',
                name: 'Jeu de Plaquettes de Frein Avant',
                unitPrice: 210,
                quantity: 1,
                shelfLocation: 'Allée B · Rayon 04 · Casier 12',
                inStock: true,
                status: 'reserved',
              },
            ],
          },
        ];
        localStorage.setItem(STORAGE_KEYS.QUOTES, JSON.stringify(seeded));
        return seeded;
      }
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  saveQuotes(quotes: AdditionalQuote[]) {
    try {
      localStorage.setItem(STORAGE_KEYS.QUOTES, JSON.stringify(quotes));
      window.dispatchEvent(new Event('k_dms_quotes_updated'));
    } catch (e) {
      console.error('Erreur sauvegarde devis', e);
    }
  }

  doesQuoteBelongToClient(quote: AdditionalQuote, compte: Compte | null, _vehicles: Vehicle[] = []): boolean {
    if (!compte) return false;
    if (this.doesRecordBelongToClient(quote, compte)) return true;

    const isDemoClient = compte.id === 'cpt-client-001' || compte.email.toLowerCase() === 'client@kia.tn';
    if (isDemoClient && (quote.id === INITIAL_QUOTE.id || quote.id === 'QUOTE-2026-9104-01')) {
      return true;
    }
    return false;
  }

  getQuotesForClient(compte: Compte | null, vehicles: Vehicle[] = []): AdditionalQuote[] {
    if (!compte) return [];
    const all = this.getQuotes();
    return all.filter((q) => this.doesQuoteBelongToClient(q, compte, vehicles));
  }

  getPendingQuotesForClient(compte: Compte | null, vehicles: Vehicle[] = []): AdditionalQuote[] {
    return this.getQuotesForClient(compte, vehicles).filter((q) => q.status === 'pending');
  }

  private persistQuoteToFirestore(quote: AdditionalQuote) {
    try {
      const statusMap: Record<AdditionalQuote['status'], string> = {
        pending: 'PENDING',
        accepted: 'APPROVED',
        refused: 'REJECTED',
      };
      setDoc(doc(db, 'quotes', quote.id), {
        id: quote.id,
        repair_order_id: quote.orId || '#OR-2026-9104',
        vehicle_name: quote.vehicle,
        plate: quote.plate,
        client_id: quote.clientId || '',
        client_name: quote.clientName || 'Client Kia',
        client_email: quote.clientEmail || '',
        client_phone: quote.clientPhone || '',
        issued_by: quote.issuedBy,
        issued_time: quote.issuedTime,
        bay: quote.bay || 'Pont #04',
        total_amount: quote.totalPrice,
        parts_price: quote.partsPrice,
        labor_price: quote.laborPrice,
        tax_price: quote.taxPrice,
        title: quote.title,
        description: quote.description,
        measured_thickness: quote.measuredThickness,
        min_thickness: quote.minThickness,
        photo_url: quote.photoUrl,
        part_availability: quote.partAvailability || 'in_stock',
        requires_part_order: Boolean(quote.requiresPartOrder),
        estimated_delivery_delay: quote.estimatedDeliveryDelay || '',
        client_comment: quote.clientComment || '',
        responded_at: quote.respondedAt || '',
        tech_stock_confirmed: Boolean(quote.techStockConfirmed),
        tech_stock_confirmed_at: quote.techStockConfirmedAt || '',
        chef_delivery_confirmed: Boolean(quote.chefDeliveryConfirmed),
        chef_delivery_confirmed_at: quote.chefDeliveryConfirmedAt || '',
        parts: quote.parts || [],
        status: statusMap[quote.status] || 'PENDING',
        created_at: quote.createdAt || new Date().toISOString(),
      }).catch((e) => console.warn('Sync Firestore quotes non-bloquant:', e));
    } catch {}
  }

  private resolveClientIdentityByPlate(plate: string): {
    clientId?: string;
    clientName?: string;
    clientEmail?: string;
    clientPhone?: string;
  } {
    const cleanTarget = (plate || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
    if (!cleanTarget) return {};

    // 1. Chercher dans les comptes enregistrés
    try {
      const rawComptes = localStorage.getItem('kia_sav_comptes_db');
      if (rawComptes) {
        const comptes = JSON.parse(rawComptes) as Compte[];
        const matchedCompte = comptes.find(
          (c) => c.role === 'client' && (c.immatriculation || '').replace(/[^a-z0-9]/gi, '').toLowerCase() === cleanTarget
        );
        if (matchedCompte) {
          return {
            clientId: matchedCompte.id,
            clientName: `${matchedCompte.prenom} ${matchedCompte.nom}`,
            clientEmail: matchedCompte.email,
            clientPhone: matchedCompte.telephone,
          };
        }
      }
    } catch {}

    // 2. Chercher dans les rendez-vous existants
    const matchedAppt = this.getAppointments().find(
      (a) => (a.plate || '').replace(/[^a-z0-9]/gi, '').toLowerCase() === cleanTarget
    );
    if (matchedAppt) {
      return {
        clientId: matchedAppt.clientId,
        clientName: matchedAppt.clientName,
        clientEmail: matchedAppt.clientEmail,
        clientPhone: matchedAppt.clientPhone,
      };
    }

    return {};
  }

  sendTechQuote(input: {
    orId?: string;
    vehicle: string;
    plate: string;
    bay: string;
    clientId?: string;
    clientName: string;
    clientEmail?: string;
    clientPhone?: string;
    part: PartItem;
    description: string;
    laborPrice?: number;
    requiresPartOrder: boolean;
    estimatedDeliveryDelay?: string;
    setWaitingPartsImmediately?: boolean;
  }): AdditionalQuote {
    const now = new Date();
    const settings = this.getWorkshopSettings();
    const issuedTime = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const labor = input.laborPrice ?? Math.round(input.part.laborTimeHours * (settings.hourlyLaborRateTnd || 65));
    const partsPrice = input.part.unitPriceTND;
    const totalPrice = partsPrice + labor;

    const resolved = this.resolveClientIdentityByPlate(input.plate);
    const finalClientId = input.clientId || resolved.clientId;
    const finalClientEmail = input.clientEmail || resolved.clientEmail;
    const finalClientPhone = input.clientPhone || resolved.clientPhone;
    const finalClientName =
      input.clientName && input.clientName !== 'Client Kia' && input.clientName !== 'Cher Client'
        ? input.clientName
        : resolved.clientName || input.clientName;

    // Décrémenter le stock si disponible
    if (!input.requiresPartOrder && input.part.stockCount > 0) {
      const stock = this.getPartsStock();
      const updatedStock = stock.map((p) => {
        if (p.id === input.part.id) {
          const nextQty = Math.max(0, p.stockCount - 1);
          try {
            updateDoc(doc(db, 'spare_parts', p.id), { stock_qty: nextQty }).catch(() => {});
          } catch {}
          return { ...p, stockCount: nextQty, inStock: nextQty > 0 };
        }
        return p;
      });
      this.savePartsStock(updatedStock);
    }

    const partEntry: QuotePartEntry = {
      partId: input.part.id,
      oemRef: input.part.oemRef,
      name: input.part.name,
      unitPrice: input.part.unitPriceTND,
      quantity: 1,
      shelfLocation: input.part.shelfLocation,
      inStock: !input.requiresPartOrder,
      status: input.requiresPartOrder ? 'to_order' : 'reserved',
    };

    const newQuote: AdditionalQuote = {
      id: `QUOTE-${now.getFullYear()}-${Date.now().toString().slice(-5)}`,
      orId: input.orId || `#OR-${now.getFullYear()}-9104`,
      vehicle: input.vehicle,
      plate: input.plate,
      bay: input.bay,
      clientId: finalClientId,
      clientName: finalClientName,
      clientEmail: finalClientEmail,
      clientPhone: finalClientPhone,
      title: input.requiresPartOrder
        ? `Commande Pièce & Remplacement : ${input.part.name}`
        : `Remplacement Pièce : ${input.part.name}`,
      issuedTime,
      issuedBy: 'Karim Trabelsi (Master Tech)',
      criticalWearPercent: 90,
      measuredThickness: input.requiresPartOrder ? 'Pièce hors stock' : 'Disponible magasin',
      minThickness: `Réf OEM ${input.part.oemRef}`,
      description: input.description,
      photoUrl: input.part.imageUrl || INITIAL_QUOTE.photoUrl,
      partsPrice,
      laborPrice: labor,
      taxPrice: Math.round(totalPrice * ((settings.vatRatePercent ?? 19) / 100)),
      totalPrice,
      status: 'pending',
      partAvailability: input.requiresPartOrder ? 'out_of_stock' : 'in_stock',
      requiresPartOrder: input.requiresPartOrder,
      estimatedDeliveryDelay: input.requiresPartOrder
        ? input.estimatedDeliveryDelay || '48h – 72h (fournisseur Kia)'
        : undefined,
      parts: [partEntry],
      techStockConfirmed: false,
      chefDeliveryConfirmed: false,
      createdAt: now.toISOString(),
    };

    const currentQuotes = this.getQuotes();
    this.saveQuotes([newQuote, ...currentQuotes]);
    this.persistQuoteToFirestore(newQuote);

    // Si rupture de stock ou demandé immédiatement -> passer l'état véhicule en « En attente pièce »
    if (input.requiresPartOrder || input.setWaitingPartsImmediately) {
      this.setVehicleWaitingParts(
        input.plate,
        input.orId,
        true,
        `En attente pièce : ${input.part.name} (à commander · Délai ${newQuote.estimatedDeliveryDelay})`
      );
    }

    const clientMsg = input.requiresPartOrder
      ? `Nouveau devis envoyé dans Assistance & Devis : ${input.part.name} (pièce à commander — attente livraison ${newQuote.estimatedDeliveryDelay}).`
      : `Nouveau devis complémentaire disponible dans Assistance & Devis : ${input.part.name} (pièce en stock).`;
    this.setClientToast(clientMsg, {
      plate: newQuote.plate,
      clientEmail: newQuote.clientEmail,
      clientId: newQuote.clientId,
    });

    return newQuote;
  }

  respondToQuoteByClient(
    quoteId: string,
    status: 'accepted' | 'refused',
    clientComment: string
  ): AdditionalQuote | null {
    const quotes = this.getQuotes();
    const existing = quotes.find((q) => q.id === quoteId);
    if (!existing) return null;

    const nowTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const nextParts: QuotePartEntry[] | undefined = existing.parts?.map((p) => ({
      ...p,
      status:
        status === 'accepted'
          ? existing.requiresPartOrder
            ? ('ordered' as const)
            : ('reserved' as const)
          : p.status,
    }));
    const updatedTarget: AdditionalQuote = {
      ...existing,
      status,
      clientComment: clientComment.trim(),
      respondedAt: `${nowTime} CET`,
      acceptedAt: status === 'accepted' ? `${nowTime} CET` : undefined,
      parts: nextParts,
    };

    const updated = quotes.map((q) => (q.id === quoteId ? updatedTarget : q));

    this.saveQuotes(updated);
    this.persistQuoteToFirestore(updatedTarget);

    // Si le client accepte une pièce qui doit être commandée, on confirme l'état "En attente pièce" partout
    if (status === 'accepted' && updatedTarget.requiresPartOrder) {
      this.setVehicleWaitingParts(
        updatedTarget.plate,
        updatedTarget.orId,
        true,
        `En attente pièce commandée (${updatedTarget.estimatedDeliveryDelay || 'Livraison en cours'})`
      );
    }

    window.dispatchEvent(new Event('k_dms_quotes_updated'));
    window.dispatchEvent(new Event('k_dms_orders_updated'));
    return updatedTarget;
  }

  confirmWithStockTeamByTech(quoteId: string): AdditionalQuote | null {
    const quotes = this.getQuotes();
    const existing = quotes.find((q) => q.id === quoteId);
    if (!existing) return null;

    const nowTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const nextParts: QuotePartEntry[] | undefined = existing.parts?.map((p) => ({
      ...p,
      status:
        existing.status === 'accepted'
          ? existing.requiresPartOrder
            ? ('ordered' as const)
            : ('reserved' as const)
          : p.status,
    }));
    const updatedTarget: AdditionalQuote = {
      ...existing,
      techStockConfirmed: true,
      techStockConfirmedAt: nowTime,
      parts: nextParts,
    };

    const updated = quotes.map((q) => (q.id === quoteId ? updatedTarget : q));

    this.saveQuotes(updated);
    this.persistQuoteToFirestore(updatedTarget);

    // Lorsque le technicien confirme avec l'équipe stock pour une pièce acceptée (en attente livraison / préparation),
    // mettre l'état de la voiture en "En attente pièce" jusqu'à validation réception par le Chef
    if (updatedTarget.status === 'accepted' && !updatedTarget.chefDeliveryConfirmed) {
      const partLabel = updatedTarget.parts?.[0]?.name || updatedTarget.title;
      const reason = updatedTarget.requiresPartOrder
        ? `En attente pièce commandée : ${partLabel} (Délai ${updatedTarget.estimatedDeliveryDelay || 'en cours'})`
        : `En attente sortie / préparation pièce magasin : ${partLabel}`;
      this.setVehicleWaitingParts(updatedTarget.plate, updatedTarget.orId, true, reason);
      this.setClientToast(
        `Confirmation équipe stock : votre véhicule est en état « En attente pièce » (${partLabel}).`,
        {
          plate: updatedTarget.plate,
          clientEmail: updatedTarget.clientEmail,
          clientId: updatedTarget.clientId,
        }
      );
    }

    return updatedTarget;
  }

  confirmPartDeliveryByChef(quoteId: string): AdditionalQuote | null {
    const quotes = this.getQuotes();
    const existing = quotes.find((q) => q.id === quoteId);
    if (!existing) return null;

    const nowTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const nextParts: QuotePartEntry[] | undefined = existing.parts?.map((p) => ({
      ...p,
      inStock: true,
      status: 'delivered_to_stock' as const,
    }));
    const updatedTarget: AdditionalQuote = {
      ...existing,
      chefDeliveryConfirmed: true,
      chefDeliveryConfirmedAt: nowTime,
      partAvailability: 'in_stock',
      parts: nextParts,
    };

    const updated = quotes.map((q) => (q.id === quoteId ? updatedTarget : q));

    this.saveQuotes(updated);
    this.persistQuoteToFirestore(updatedTarget);

    // Mettre à jour le stock magasin si la pièce était à 0
    if (updatedTarget.parts?.length) {
      const stock = this.getPartsStock();
      let stockChanged = false;
      const updatedStock = stock.map((sp) => {
        const matched = updatedTarget.parts?.find((qp) => qp.partId === sp.id || qp.oemRef === sp.oemRef);
        if (matched && sp.stockCount === 0) {
          stockChanged = true;
          try {
            updateDoc(doc(db, 'spare_parts', sp.id), { stock_qty: 1 }).catch(() => {});
          } catch {}
          return { ...sp, stockCount: 1, inStock: true };
        }
        return sp;
      });
      if (stockChanged) {
        this.savePartsStock(updatedStock);
      }
    }

    // Lever l'état "En attente pièce" sur le véhicule / OR
    this.setVehicleWaitingParts(updatedTarget.plate, updatedTarget.orId, false);
    this.setClientToast(
      `Réception pièce confirmée par le Chef d'Atelier (${updatedTarget.vehicle}) : les travaux peuvent reprendre !`,
      {
        plate: updatedTarget.plate,
        clientEmail: updatedTarget.clientEmail,
        clientId: updatedTarget.clientId,
      }
    );

    return updatedTarget;
  }

  setVehicleWaitingParts(
    plate?: string,
    orId?: string,
    isWaiting: boolean = true,
    reason?: string
  ) {
    const cleanPlate = (plate || '').replace(/\s+/g, '').toLowerCase();
    const cleanOr = (orId || '').trim().toLowerCase();

    // 1. Mettre à jour les ordres synchronisés
    const orders = this.getOrders();
    let updatedOrderIds: string[] = [];
    const updatedOrders = orders.map((o) => {
      const oPlate = (o.plate || '').replace(/\s+/g, '').toLowerCase();
      const oId = (o.id || '').trim().toLowerCase();
      if ((cleanPlate && oPlate === cleanPlate) || (cleanOr && oId === cleanOr)) {
        updatedOrderIds.push(o.id);
        return {
          ...o,
          status: isWaiting ? ('waiting_parts' as const) : ('in_progress' as const),
          statusLabel: isWaiting ? 'En attente pièce' : 'Travaux en cours (Pièce reçue)',
          waitingPartsReason: isWaiting ? reason || 'En attente pièce' : undefined,
        };
      }
      return o;
    });
    try {
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(updatedOrders));
      window.dispatchEvent(new Event('k_dms_orders_updated'));
    } catch {}

    // 2. Mettre à jour le liveProgress s'il correspond
    const live = this.getLiveProgress();
    if (live) {
      const lPlate = (live.plate || '').replace(/\s+/g, '').toLowerCase();
      const lId = (live.orderId || '').trim().toLowerCase();
      if ((cleanPlate && lPlate === cleanPlate) || (cleanOr && lId === cleanOr)) {
        this.setLiveProgress({
          ...live,
          waitingParts: isWaiting,
          waitingPartsReason: isWaiting ? reason || 'En attente de livraison pièce' : undefined,
          lastUpdatedMessage: isWaiting
            ? reason || 'Véhicule placé en état : En attente pièce.'
            : 'Pièce reçue et confirmée en stock par le Chef d’Atelier. Reprise des travaux.',
          lastUpdatedAt: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        });
      }
    }

    // 3. Synchroniser Firestore repair_orders
    const idsToSync = Array.from(new Set([...(orId ? [orId] : []), ...updatedOrderIds]));
    for (const targetId of idsToSync) {
      try {
        updateDoc(doc(db, 'repair_orders', targetId), {
          status: isWaiting ? 'ATTENTE_PIECES' : 'EN_REPARATION',
          waiting_parts_reason: isWaiting ? reason || 'En attente pièce' : '',
        }).catch(() => {});
      } catch {}
    }
  }

  isVehicleWaitingParts(plate?: string, orId?: string): {
    waiting: boolean;
    reason?: string;
    quote?: AdditionalQuote;
  } {
    const cleanPlate = (plate || '').replace(/\s+/g, '').toLowerCase();
    const cleanOr = (orId || '').trim().toLowerCase();

    // Check active quotes first
    const quotes = this.getQuotes();
    const waitingQuote = quotes.find((q) => {
      if (q.chefDeliveryConfirmed || q.status === 'refused') return false;
      const qPlate = (q.plate || '').replace(/\s+/g, '').toLowerCase();
      const qOr = (q.orId || '').trim().toLowerCase();
      const matches = (cleanPlate && qPlate === cleanPlate) || (cleanOr && qOr === cleanOr);
      if (!matches) return false;
      return Boolean(
        q.requiresPartOrder ||
          (q.techStockConfirmed && q.status === 'accepted' && !q.chefDeliveryConfirmed)
      );
    });
    if (waitingQuote) {
      const partName = waitingQuote.parts?.[0]?.name || waitingQuote.title;
      return {
        waiting: true,
        reason: waitingQuote.requiresPartOrder
          ? `Commande pièce en attente de livraison (${waitingQuote.estimatedDeliveryDelay || 'en cours'}) — ${partName}`
          : `En attente confirmation réception stock — ${partName}`,
        quote: waitingQuote,
      };
    }

    // Check synced orders
    const orders = this.getOrders();
    const waitingOrder = orders.find((o) => {
      if (o.status !== 'waiting_parts') return false;
      const oPlate = (o.plate || '').replace(/\s+/g, '').toLowerCase();
      const oId = (o.id || '').trim().toLowerCase();
      return (cleanPlate && oPlate === cleanPlate) || (cleanOr && oId === cleanOr);
    });
    if (waitingOrder) {
      return {
        waiting: true,
        reason: waitingOrder.waitingPartsReason || waitingOrder.statusLabel || 'En attente pièce',
      };
    }

    // Check liveProgress
    const live = this.getLiveProgress();
    if (live?.waitingParts) {
      const lPlate = (live.plate || '').replace(/\s+/g, '').toLowerCase();
      const lId = (live.orderId || '').trim().toLowerCase();
      if ((cleanPlate && lPlate === cleanPlate) || (cleanOr && lId === cleanOr)) {
        return {
          waiting: true,
          reason: live.waitingPartsReason || 'En attente pièce',
        };
      }
    }

    return { waiting: false };
  }

  /**
   * Statut "En attente pièce" isolé strictement au compte client connecté (clientId / clientEmail)
   */
  isVehicleWaitingPartsForClient(
    compte: Compte | null,
    plate?: string,
    orId?: string
  ): {
    waiting: boolean;
    reason?: string;
    quote?: AdditionalQuote;
  } {
    if (!compte) return { waiting: false };
    const cleanPlate = (plate || '').replace(/\s+/g, '').toLowerCase();
    const cleanOr = (orId || '').trim().toLowerCase();

    const quotes = this.getQuotesForClient(compte);
    const waitingQuote = quotes.find((q) => {
      if (q.chefDeliveryConfirmed || q.status === 'refused') return false;
      const qPlate = (q.plate || '').replace(/\s+/g, '').toLowerCase();
      const qOr = (q.orId || '').trim().toLowerCase();
      const matches = (cleanPlate && qPlate === cleanPlate) || (cleanOr && qOr === cleanOr);
      if (!matches) return false;
      return Boolean(
        q.requiresPartOrder ||
          (q.techStockConfirmed && q.status === 'accepted' && !q.chefDeliveryConfirmed)
      );
    });
    if (waitingQuote) {
      const partName = waitingQuote.parts?.[0]?.name || waitingQuote.title;
      return {
        waiting: true,
        reason: waitingQuote.requiresPartOrder
          ? `Commande pièce en attente de livraison (${waitingQuote.estimatedDeliveryDelay || 'en cours'}) — ${partName}`
          : `En attente confirmation réception stock — ${partName}`,
        quote: waitingQuote,
      };
    }

    const orders = this.getOrders().filter((o) => this.doesRecordBelongToClient(o, compte));
    const waitingOrder = orders.find((o) => {
      if (o.status !== 'waiting_parts') return false;
      const oPlate = (o.plate || '').replace(/\s+/g, '').toLowerCase();
      const oId = (o.id || '').trim().toLowerCase();
      return (cleanPlate && oPlate === cleanPlate) || (cleanOr && oId === cleanOr);
    });
    if (waitingOrder) {
      return {
        waiting: true,
        reason: waitingOrder.waitingPartsReason || waitingOrder.statusLabel || 'En attente pièce',
      };
    }

    const live = this.getLiveProgressForClient(compte);
    if (live?.waitingParts) {
      const lPlate = (live.plate || '').replace(/\s+/g, '').toLowerCase();
      const lId = (live.orderId || '').trim().toLowerCase();
      if ((cleanPlate && lPlate === cleanPlate) || (cleanOr && lId === cleanOr)) {
        return {
          waiting: true,
          reason: live.waitingPartsReason || 'En attente pièce',
        };
      }
    }

    return { waiting: false };
  }

  // Vérification automatique et clôture complète de l'ordre avec confirmation client & chef
  verifyAndCompleteOrder(orderId?: string, plate?: string): { success: boolean; progress: WorkshopLiveProgress | null; message: string } {
    const updated = this.advanceOrderStep(4);
    if (updated) {
      this.setChefRestitutionAlert(true);
      const confirmationMsg = `Confirmation K-DMS : Travaux 100% terminés avec succès pour ${updated.vehicleName} (${updated.plate}) ! Contrôle qualité zéro défaut validé. Véhicule prêt pour la restitution.`;
      this.setClientToast(confirmationMsg, {
        plate: updated.plate,
        clientEmail: updated.clientEmail,
        clientId: updated.clientId,
      });
      try {
        window.dispatchEvent(new Event('k_dms_orders_updated'));
        window.dispatchEvent(new Event('k_dms_completed_orders_updated'));
        window.dispatchEvent(new Event('k_dms_planning_updated'));
      } catch {}
      return { success: true, progress: updated, message: confirmationMsg };
    }
    return { success: false, progress: null, message: "Erreur lors de la clôture de l'ordre." };
  }

  /**
   * Calcule le détail de facturation pour la restitution :
   * Prix de l'entretien de base + somme des devis de pièces confirmés ('accepted') par le client.
   */
  getRestitutionBillingSummary(live: WorkshopLiveProgress | null): {
    maintenancePrice: number;
    maintenanceLabel: string;
    confirmedQuotes: AdditionalQuote[];
    confirmedQuotesTotal: number;
    pendingQuotesCount: number;
    totalAmount: number;
    formattedTotal: string;
  } {
    if (!live) {
      return {
        maintenancePrice: 0,
        maintenanceLabel: 'Entretien Atelier',
        confirmedQuotes: [],
        confirmedQuotesTotal: 0,
        pendingQuotesCount: 0,
        totalAmount: 0,
        formattedTotal: '0.000',
      };
    }

    const cleanLiveOr = (live.orderId || '').replace(/^#/, '').trim().toLowerCase();
    const cleanLivePlate = (live.plate || '').replace(/[^a-z0-9]/gi, '').toLowerCase();

    // 1. Retrouver le prix de l'entretien depuis le RDV lié (ou estimation barème selon le libellé)
    const appointments = this.getAppointments();
    const linkedAppt =
      appointments.find((a) => a.orId && a.orId.replace(/^#/, '').trim().toLowerCase() === cleanLiveOr) ||
      appointments.find((a) => {
        if (a.status === 'cancelled' || a.status === 'rejected') return false;
        const aPlate = (a.plate || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
        return Boolean(cleanLivePlate && aPlate === cleanLivePlate);
      });

    const parseNumericTnd = (raw?: string): number | null => {
      if (!raw) return null;
      const lower = raw.toLowerCase();
      if (lower.includes('gratuit')) return 0;
      const cleaned = raw.replace(/\s+/g, '').replace(',', '.').replace(/[^0-9.]/g, '');
      if (!cleaned) return null;
      const num = parseFloat(cleaned);
      return Number.isFinite(num) && num > 0 ? num : null;
    };

    const prices = this.getWorkshopSettings().maintenancePrices;
    const inferServiceBasePrice = (title: string): number => {
      const t = (title || '').toLowerCase();
      if (t.includes('frein')) return prices.freinage;
      if (t.includes('diag')) return prices.diagnostic;
      if (t.includes('clim')) return prices.climatisation;
      if (t.includes('pneu') || t.includes('géom')) return prices.pneumatiques;
      if (t.includes('garantie')) return 0;
      return prices.revision;
    };

    const parsedApptPrice = parseNumericTnd(linkedAppt?.price);
    const maintenancePrice = parsedApptPrice !== null ? parsedApptPrice : inferServiceBasePrice(live.serviceTitle);
    const maintenanceLabel = linkedAppt?.serviceName || live.serviceTitle || 'Entretien Constructeur';

    // 2. Retrouver les devis / commandes de pièces associés à cette intervention
    const allQuotes = this.getQuotes();
    const matchingQuotes = allQuotes.filter((q) => {
      const qOr = (q.orId || '').replace(/^#/, '').trim().toLowerCase();
      if (qOr && cleanLiveOr) {
        return qOr === cleanLiveOr;
      }
      const qPlate = (q.plate || '').replace(/[^a-z0-9]/gi, '').toLowerCase();
      if (cleanLivePlate && qPlate === cleanLivePlate) {
        if (live.clientId && q.clientId) return live.clientId === q.clientId;
        if (live.clientEmail && q.clientEmail) {
          return live.clientEmail.toLowerCase() === q.clientEmail.toLowerCase();
        }
        return true;
      }
      return false;
    });

    const confirmedQuotes = matchingQuotes.filter((q) => q.status === 'accepted');
    const pendingQuotesCount = matchingQuotes.filter((q) => q.status === 'pending').length;
    const confirmedQuotesTotal = confirmedQuotes.reduce((sum, q) => sum + (Number(q.totalPrice) || 0), 0);
    const totalAmount = maintenancePrice + confirmedQuotesTotal;

    return {
      maintenancePrice,
      maintenanceLabel,
      confirmedQuotes,
      confirmedQuotesTotal,
      pendingQuotesCount,
      totalAmount,
      formattedTotal: totalAmount.toFixed(3),
    };
  }

  // 3. Clôture financière & Restitution par le Chef d'Atelier -> Déplacement vers Historique & Sortie Véhicule
  completePaymentAndRestitution(paymentData: {
    method: 'Carte Bancaire' | 'Espèces' | 'Chèque Certifié';
    amount: string;
  }): WorkshopLiveProgress | null {
    const current = this.getLiveProgress();
    if (!current) return null;

    const billing = this.getRestitutionBillingSummary(current);

    const now = new Date();
    const timeStr = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    const dayMonth = now.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }).replace('.', '');
    const yearStr = String(now.getFullYear());
    const paidAtLabel = `${now.toLocaleDateString('fr-FR')} à ${timeStr}`;

    let durationMinutes = 105;
    if (current.startedTimestamp) {
      durationMinutes = Math.max(15, Math.round((Date.now() - current.startedTimestamp) / 60000));
    }
    const hours = Math.floor(durationMinutes / 60);
    const mins = durationMinutes % 60;
    const durationLabel = hours > 0 ? `${hours}h ${mins.toString().padStart(2, '0')}m` : `${mins} min`;

    const updated: WorkshopLiveProgress = {
      ...current,
      status: 'completed_and_paid',
      invoiceAmount: paymentData.amount,
      paymentMethod: paymentData.method,
      paidAt: paidAtLabel,
      lastUpdatedMessage: `Facture acquittée (${paymentData.amount}) par ${paymentData.method}. Véhicule restitué — Intervention archivée dans votre Carnet d'Entretien.`,
      lastUpdatedAt: timeStr,
    };

    // Créer l'entrée structurée pour le Carnet d'Entretien Numérique (avec détails des opérations & pièces + identité propriétaire stricte)
    const resolvedIdentity =
      !current.clientId || !current.clientEmail
        ? this.resolveClientIdentityByPlate(current.plate)
        : {};
    const ownerClientId = current.clientId || resolvedIdentity.clientId;
    const ownerClientEmail = current.clientEmail || resolvedIdentity.clientEmail;
    const ownerClientPhone = current.clientPhone || resolvedIdentity.clientPhone;

    const confirmedOperations = billing.confirmedQuotes.map((q, idx) => ({
      id: `quote-op-${idx + 1}`,
      label: `${q.title} (+${q.totalPrice.toFixed(3)} TND · Validé client)`,
      category: 'Pièce & Devis Confirmé',
      completedAt: q.acceptedAt || q.respondedAt || timeStr,
      status: 'verified' as const,
      notes: q.clientComment ? `Avis client : ${q.clientComment}` : 'Devis complémentaire approuvé par le client.',
    }));

    const confirmedParts = billing.confirmedQuotes.flatMap((q) =>
      (q.parts || []).map((p) => ({
        oemRef: p.oemRef,
        name: p.name,
        quantity: p.quantity || 1,
        unitPriceTND: p.unitPrice,
      }))
    );

    const billingSummaryText =
      billing.confirmedQuotes.length > 0
        ? `Entretien : ${billing.maintenancePrice.toFixed(3)} TND + Devis pièce(s) confirmé(s) : ${billing.confirmedQuotesTotal.toFixed(3)} TND.`
        : '';

    const cleanOr = current.orderId.replace(/^#/, '');
    const historyEntry: ServiceHistoryItem = {
      id: `hist-${cleanOr}-${Date.now()}`,
      date: dayMonth,
      year: yearStr,
      title: current.serviceTitle,
      mileage: '18 420 km',
      description: `Intervention complète réalisée en ${current.bay} par ${current.technicianName}. ${billingSummaryText} Réglée par ${paymentData.method} (${paymentData.amount}).`.trim(),
      workshop: 'City Cars Kia La Goulette',
      advisor: 'Hédi Mansour',
      status: 'completed',
      orNumber: current.orderId,
      invoiceNumber: `FAC-${cleanOr}`,
      amount: paymentData.amount,
      category: current.serviceTitle.toLowerCase().includes('ev') || current.serviceTitle.toLowerCase().includes('bms')
        ? 'electrique'
        : current.serviceTitle.toLowerCase().includes('frein') || current.serviceTitle.toLowerCase().includes('suspension')
        ? 'mecanique'
        : 'entretien',
      vehicleName: current.vehicleName,
      plate: current.plate,
      vin: current.vin,
      clientId: ownerClientId,
      clientName: current.clientName,
      clientEmail: ownerClientEmail,
      clientPhone: ownerClientPhone,
      technicianName: current.technicianName,
      bay: current.bay,
      durationLabel,
      paymentMethod: paymentData.method,
      paidAt: paidAtLabel,
      movedFromLive: true,
      operations: [
        {
          id: 'op-1',
          label: 'Diagnostic électronique valise Kia KDS & inspection 75 points',
          category: 'Diagnostic',
          completedAt: current.stages?.[0]?.timeLabel || current.startedAt || '09:15',
          status: 'verified',
          notes: 'Zéro défaut calculateur ECU/TCU détecté.',
        },
        {
          id: 'op-2',
          label: 'Vidange huile moteur 0W-20 Shell Helix Ultra & remplacement filtre OEM',
          category: 'Entretien',
          completedAt: current.stages?.[1]?.timeLabel || '10:30',
          status: 'completed',
          notes: 'Couple de serrage bouchon carter conforme (35 Nm).',
        },
        {
          id: 'op-3',
          label: 'Remplacement filtre d’habitacle antipollen & contrôle freinage',
          category: 'Sécurité',
          completedAt: current.stages?.[1]?.timeLabel || '10:55',
          status: 'completed',
          notes: 'Purge et mise à niveau DOT4 effectuées.',
        },
        ...confirmedOperations,
        {
          id: 'op-4',
          label: 'Contrôle qualité final, essai dynamique sur piste & lavage offert',
          category: 'Qualité',
          completedAt: current.stages?.[2]?.timeLabel || timeStr,
          status: 'verified',
          notes: 'Validation finale Master Tech & Chef d’atelier.',
        },
      ],
      parts: [
        { oemRef: '26300-35505', name: 'Filtre à huile d’origine Kia Mobis', quantity: 1, unitPriceTND: 38.0 },
        { oemRef: 'SH-0W20-5L', name: 'Huile Shell Helix Ultra 0W-20 (4.5 L)', quantity: 1, unitPriceTND: 165.0 },
        { oemRef: '97133-L1000', name: 'Filtre d’habitacle charbon actif Kia', quantity: 1, unitPriceTND: 62.0 },
        ...confirmedParts,
      ],
      qualityChecks: [
        'Diagnostic valise KDS : 0 Défaut',
        'Couples de serrage châssis & roue conformes',
        'Essai routier dynamique validé',
        'Lavage finition offert effectué',
      ],
    };

    // Sauvegarder dans l'historique (localStorage + Firestore)
    this.saveServiceHistoryItem(historyEntry);

    // Mettre à jour l'OR dans Firestore
    try {
      updateDoc(doc(db, 'repair_orders', current.orderId), {
        status: 'COMPLETED_AND_PAID',
        completed_at: now.toISOString(),
        invoice_amount: paymentData.amount,
        payment_method: paymentData.method,
      }).catch(() => {});
    } catch {}

    // Vider le suivi en direct actif car le client est sorti avec son véhicule
    this.setLiveProgress(null);
    this.setClientToast(updated.lastUpdatedMessage, {
      plate: current.plate,
      clientEmail: ownerClientEmail,
      clientId: ownerClientId,
    });
    this.clearChefRestitutionAlert();

    // Mettre à jour le statut dans l'historique des travaux terminés du jour (Atelier Tech)
    try {
      const completedList = this.getCompletedOrdersToday();
      const updatedCompletedList = completedList.map((item) => {
        const matchPlate = current.plate && item.plate.replace(/\s+/g, '').toLowerCase() === current.plate.replace(/\s+/g, '').toLowerCase();
        const matchId = current.orderId && item.id === current.orderId;
        if (matchPlate || matchId) {
          return {
            ...item,
            chefStatus: 'restituted' as const,
            invoiceAmount: paymentData.amount,
          };
        }
        return item;
      });
      localStorage.setItem(STORAGE_KEYS.COMPLETED_TECH_ORDERS, JSON.stringify(updatedCompletedList));
      window.dispatchEvent(new Event('k_dms_completed_orders_updated'));
    } catch (e) {
      console.error('Erreur mise à jour statut restitué', e);
    }

    // Clôture du rendez-vous lié à cet OR (sans bloquer les prochains RDV du même client/plaque)
    if (current.orderId) {
      this.addCheckedOutItem(current.orderId);
    }
    this.removeAppointmentByPlateOrClient(current.plate, current.clientName, current.orderId);

    try {
      window.dispatchEvent(new Event('k_dms_planning_updated'));
      window.dispatchEvent(new Event('k_dms_live_updated'));
      window.dispatchEvent(new Event('k_dms_history_updated'));
    } catch {}

    return updated;
  }

  // Notifications Client (scopées par plaque / email / clientId si précisé)
  getClientToast(): string | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CLIENT_TOAST);
      if (!raw) return null;
      if (raw.startsWith('{')) {
        const parsed = JSON.parse(raw) as { message?: string };
        return parsed.message || null;
      }
      return raw;
    } catch {
      return null;
    }
  }

  getClientToastForClient(compte: Compte | null, _vehicles: Vehicle[] = []): string | null {
    if (!compte) return null;
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.CLIENT_TOAST);
      if (!raw || !raw.startsWith('{')) return null;
      const parsed = JSON.parse(raw) as {
        message?: string;
        plate?: string;
        clientEmail?: string;
        clientId?: string;
      };
      if (!parsed.message) return null;
      return this.doesRecordBelongToClient(parsed, compte) ? parsed.message : null;
    } catch {
      return null;
    }
  }

  // ==========================================
  // GARAGE VÉHICULES ISOLÉ PAR COMPTE CLIENT
  // ==========================================
  getClientGarageVehicles(compte: Compte | null): Vehicle[] | null {
    if (!compte?.id) return null;
    try {
      const raw = localStorage.getItem(`k_dms_client_vehicles_${compte.id}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as Vehicle[];
      if (!Array.isArray(parsed)) return null;
      return parsed.map((v) => ({
        ...v,
        imageUrl: normalizeKiaVehicleImageUrl(v.imageUrl, v.name),
      }));
    } catch {
      return null;
    }
  }

  saveClientGarageVehicles(compte: Compte | null, vehicles: Vehicle[]) {
    if (!compte?.id) return;
    try {
      localStorage.setItem(`k_dms_client_vehicles_${compte.id}`, JSON.stringify(vehicles));
    } catch (e) {
      console.error('Erreur sauvegarde garage client', e);
    }
  }

  async addVehicleForClient(compte: Compte | null, vehicle: Vehicle) {
    if (!compte?.id) return;
    const current = this.getClientGarageVehicles(compte) || [];
    const next = [...current.filter((v) => v.id !== vehicle.id), vehicle];
    this.saveClientGarageVehicles(compte, next);
    try {
      await setDoc(doc(db, 'vehicles', vehicle.id), {
        id: vehicle.id,
        client_id: compte.id,
        immatriculation: vehicle.plate,
        modele: vehicle.name,
        chassis_vin: vehicle.vin,
        annee: vehicle.year,
        kilometers: vehicle.mileage,
        status: vehicle.status,
        imageUrl: vehicle.imageUrl,
      });
    } catch {}
  }

  async removeVehicleForClient(compte: Compte | null, vehicleId: string) {
    if (!compte?.id) return;
    const current = this.getClientGarageVehicles(compte) || [];
    const next = current.filter((v) => v.id !== vehicleId);
    this.saveClientGarageVehicles(compte, next);
    try {
      await deleteDoc(doc(db, 'vehicles', vehicleId));
    } catch {}
  }

  async fetchClientVehiclesFromFirestore(compte: Compte | null): Promise<Vehicle[] | null> {
    if (!compte?.id) return null;
    try {
      const snap = await getDocs(
        query(collection(db, 'vehicles'), where('client_id', '==', compte.id))
      );
      if (snap.empty) return null;
      const fetched: Vehicle[] = [];
      snap.forEach((d) => {
        const data = d.data();
        fetched.push({
          id: data.id || d.id,
          name: data.modele || compte.modeleVehicule || 'Véhicule Kia',
          finish: 'Finition Concessionnaire',
          plate: data.immatriculation || compte.immatriculation || '',
          vin: data.chassis_vin || compte.vin || '',
          year: Number(data.annee || 2024),
          type: 'Véhicule Client',
          color: 'Gris Météore',
          mileage: Number(data.kilometers || 1000),
          nextServiceKm: 10000,
          warranty: 'Garantie Constructeur 5 Ans ou 150 000 km',
          warrantyActive: true,
          status: (data.status as Vehicle['status']) || 'up_to_date',
          imageUrl: normalizeKiaVehicleImageUrl(
            data.imageUrl,
            data.modele || compte.modeleVehicule
          ),
        });
      });
      return fetched.length > 0 ? fetched : null;
    } catch {
      return null;
    }
  }

  setClientToast(
    msg: string,
    target?: { plate?: string; clientEmail?: string; clientId?: string }
  ) {
    try {
      if (target && (target.plate || target.clientEmail || target.clientId)) {
        localStorage.setItem(
          STORAGE_KEYS.CLIENT_TOAST,
          JSON.stringify({ message: msg, ...target })
        );
      } else {
        localStorage.setItem(STORAGE_KEYS.CLIENT_TOAST, msg);
      }
    } catch {}
  }

  clearClientToast() {
    try {
      localStorage.removeItem(STORAGE_KEYS.CLIENT_TOAST);
    } catch {}
  }

  // Alerte Restitution pour Chef
  getChefRestitutionAlert(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEYS.CHEF_RESTITUTION_ALERT) === 'true';
    } catch {
      return false;
    }
  }

  setChefRestitutionAlert(val: boolean) {
    try {
      if (val) {
        localStorage.setItem(STORAGE_KEYS.CHEF_RESTITUTION_ALERT, 'true');
      } else {
        localStorage.removeItem(STORAGE_KEYS.CHEF_RESTITUTION_ALERT);
      }
    } catch {}
  }

  clearChefRestitutionAlert() {
    this.setChefRestitutionAlert(false);
  }

  // ==========================================
  // ÉQUIPE, HABILITATIONS EV, PONTS (01-12) & PARAMÈTRES ATELIER
  // ==========================================
  getWorkshopTechnicians(): WorkshopTechnician[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.WORKSHOP_TEAM);
      if (raw === null) {
        localStorage.setItem(STORAGE_KEYS.WORKSHOP_TEAM, JSON.stringify(DEFAULT_WORKSHOP_TECHNICIANS));
        return DEFAULT_WORKSHOP_TECHNICIANS;
      }
      const parsed = JSON.parse(raw) as WorkshopTechnician[];
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_WORKSHOP_TECHNICIANS;
    } catch {
      return DEFAULT_WORKSHOP_TECHNICIANS;
    }
  }

  saveWorkshopTechnicians(list: WorkshopTechnician[], changedTech?: WorkshopTechnician) {
    try {
      localStorage.setItem(STORAGE_KEYS.WORKSHOP_TEAM, JSON.stringify(list));
      window.dispatchEvent(new Event('k_dms_team_updated'));
    } catch (e) {
      console.error('Erreur sauvegarde équipe atelier', e);
    }

    const toSync = changedTech ? [changedTech] : list;
    for (const tech of toSync) {
      try {
        setDoc(doc(db, 'workshop_team', tech.id), {
          ...tech,
          updated_at: new Date().toISOString(),
        }).catch(() => {});
      } catch {}
    }
  }

  upsertWorkshopTechnician(tech: WorkshopTechnician): WorkshopTechnician[] {
    const list = this.getWorkshopTechnicians();
    const exists = list.some((t) => t.id === tech.id);
    const next = exists ? list.map((t) => (t.id === tech.id ? tech : t)) : [...list, tech];
    this.saveWorkshopTechnicians(next, tech);
    return next;
  }

  updateTechnicianAvailability(
    techId: string,
    availability: TechnicianAvailability
  ): WorkshopTechnician[] {
    const list = this.getWorkshopTechnicians();
    let target: WorkshopTechnician | undefined;
    const next = list.map((t) => {
      if (t.id === techId) {
        target = { ...t, availability };
        return target;
      }
      return t;
    });
    this.saveWorkshopTechnicians(next, target);
    return next;
  }

  deleteWorkshopTechnician(techId: string): WorkshopTechnician[] {
    const list = this.getWorkshopTechnicians().filter((t) => t.id !== techId);
    try {
      localStorage.setItem(STORAGE_KEYS.WORKSHOP_TEAM, JSON.stringify(list));
      window.dispatchEvent(new Event('k_dms_team_updated'));
      deleteDoc(doc(db, 'workshop_team', techId)).catch(() => {});
    } catch {}

    // Nettoyer le technicien titulaire des ponts s'il était affecté
    const bays = this.getWorkshopBays();
    let bayChanged = false;
    const nextBays = bays.map((b) => {
      if (b.leadTechnicianId === techId) {
        bayChanged = true;
        return { ...b, leadTechnicianId: undefined, leadTechnicianName: undefined };
      }
      return b;
    });
    if (bayChanged) {
      this.saveWorkshopBays(nextBays);
    }
    return list;
  }

  getWorkshopBays(): WorkshopBay[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.WORKSHOP_BAYS);
      if (raw === null) {
        localStorage.setItem(STORAGE_KEYS.WORKSHOP_BAYS, JSON.stringify(DEFAULT_WORKSHOP_BAYS));
        return DEFAULT_WORKSHOP_BAYS;
      }
      const parsed = JSON.parse(raw) as WorkshopBay[];
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_WORKSHOP_BAYS;
    } catch {
      return DEFAULT_WORKSHOP_BAYS;
    }
  }

  saveWorkshopBays(list: WorkshopBay[], changedBay?: WorkshopBay) {
    try {
      localStorage.setItem(STORAGE_KEYS.WORKSHOP_BAYS, JSON.stringify(list));
      window.dispatchEvent(new Event('k_dms_bays_updated'));
    } catch (e) {
      console.error('Erreur sauvegarde ponts atelier', e);
    }

    const toSync = changedBay ? [changedBay] : list;
    for (const bay of toSync) {
      try {
        setDoc(doc(db, 'workshop_bays', bay.id), {
          ...bay,
          updated_at: new Date().toISOString(),
        }).catch(() => {});
      } catch {}
    }
  }

  updateWorkshopBay(bayId: string, patch: Partial<WorkshopBay>): WorkshopBay[] {
    const list = this.getWorkshopBays();
    let changedBay: WorkshopBay | undefined;
    const next = list.map((b) => {
      if (b.id === bayId) {
        changedBay = { ...b, ...patch };
        return changedBay;
      }
      return b;
    });
    this.saveWorkshopBays(next, changedBay);
    return next;
  }

  toggleBayMaintenance(
    bayId: string,
    status: 'open' | 'maintenance',
    reason?: string
  ): WorkshopBay[] {
    return this.updateWorkshopBay(bayId, {
      status,
      maintenanceReason: status === 'maintenance' ? (reason?.trim() || 'Maintenance préventive / étalonnage') : '',
    });
  }

  getWorkshopSettings(): WorkshopSettings {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.WORKSHOP_SETTINGS);
      if (raw === null) {
        localStorage.setItem(STORAGE_KEYS.WORKSHOP_SETTINGS, JSON.stringify(DEFAULT_WORKSHOP_SETTINGS));
        return DEFAULT_WORKSHOP_SETTINGS;
      }
      const parsed = JSON.parse(raw) as Partial<WorkshopSettings>;
      return {
        ...DEFAULT_WORKSHOP_SETTINGS,
        ...parsed,
        maintenancePrices: {
          ...DEFAULT_WORKSHOP_SETTINGS.maintenancePrices,
          ...(parsed.maintenancePrices || {}),
        },
        soundConfig: {
          enabled: parsed.soundConfig?.enabled ?? DEFAULT_WORKSHOP_SETTINGS.soundConfig!.enabled,
          profile: parsed.soundConfig?.profile === 'discrete' ? 'discrete' : 'balanced',
          masterVolume:
            typeof parsed.soundConfig?.masterVolume === 'number'
              ? Math.max(0, Math.min(100, parsed.soundConfig.masterVolume))
              : DEFAULT_WORKSHOP_SETTINGS.soundConfig!.masterVolume,
        },
        closedDates: Array.isArray(parsed.closedDates) ? parsed.closedDates : [],
      };
    } catch {
      return DEFAULT_WORKSHOP_SETTINGS;
    }
  }

  saveWorkshopSettings(next: WorkshopSettings): WorkshopSettings {
    const normalized: WorkshopSettings = {
      ...DEFAULT_WORKSHOP_SETTINGS,
      ...next,
      id: 'default',
      maintenancePrices: {
        ...DEFAULT_WORKSHOP_SETTINGS.maintenancePrices,
        ...(next.maintenancePrices || {}),
      },
      soundConfig: {
        enabled: next.soundConfig?.enabled ?? DEFAULT_WORKSHOP_SETTINGS.soundConfig!.enabled,
        profile: next.soundConfig?.profile === 'discrete' ? 'discrete' : 'balanced',
        masterVolume:
          typeof next.soundConfig?.masterVolume === 'number'
            ? Math.max(0, Math.min(100, next.soundConfig.masterVolume))
            : DEFAULT_WORKSHOP_SETTINGS.soundConfig!.masterVolume,
      },
      closedDates: Array.from(new Set(next.closedDates || [])).sort(),
    };
    try {
      localStorage.setItem(STORAGE_KEYS.WORKSHOP_SETTINGS, JSON.stringify(normalized));
      window.dispatchEvent(new Event('k_dms_settings_updated'));
      window.dispatchEvent(new Event('k_dms_planning_updated'));
    } catch (e) {
      console.error('Erreur sauvegarde paramètres atelier', e);
    }

    try {
      setDoc(doc(db, 'workshop_settings', 'default'), {
        ...normalized,
        updated_at: new Date().toISOString(),
      }).catch(() => {});
    } catch {}
    return normalized;
  }

  resetWorkshopSettingsToDefaults(): WorkshopSettings {
    return this.saveWorkshopSettings(DEFAULT_WORKSHOP_SETTINGS);
  }

  isElectricVehicleOrder(vehicleName?: string, service?: string): boolean {
    const combined = `${vehicleName || ''} ${service || ''}`;
    return /\b(ev6|ev9|niro\s*ev|e-niro|soul\s*ev|haute\s*tension|bms|800v|diag\s*ev|baie\s*ev|électrique)\b/i.test(
      combined
    );
  }

  hasHighVoltageCert(tech?: WorkshopTechnician | null): boolean {
    return Boolean(tech && tech.certifications.includes('Haute Tension EV/HEV'));
  }

  isTechnicianAvailableForAssignment(tech?: WorkshopTechnician | null): boolean {
    return Boolean(tech && tech.active && tech.availability === 'en_poste');
  }

  validateOrderAssignment(input: {
    vehicleName: string;
    service: string;
    techId: string;
    bayId: string;
  }): {
    valid: boolean;
    error?: string;
    code?: 'tech_unavailable' | 'bay_maintenance' | 'ev_cert_required';
    suggestedEvTechs?: WorkshopTechnician[];
    tech?: WorkshopTechnician;
    bay?: WorkshopBay;
  } {
    const techs = this.getWorkshopTechnicians();
    const bays = this.getWorkshopBays();
    const tech = techs.find((t) => t.id === input.techId || t.name.toLowerCase() === input.techId.toLowerCase());
    const bay = bays.find(
      (b) =>
        b.id === input.bayId ||
        b.name.toLowerCase() === input.bayId.toLowerCase() ||
        `Pont #${b.id}`.toLowerCase() === input.bayId.toLowerCase()
    );

    if (!tech || !this.isTechnicianAvailableForAssignment(tech)) {
      const statusTxt = !tech
        ? 'introuvable'
        : !tech.active
        ? 'désactivé'
        : tech.availability === 'absent'
        ? 'Absent'
        : tech.availability === 'en_pause'
        ? 'En pause'
        : 'En essai route';
      return {
        valid: false,
        code: 'tech_unavailable',
        error: `Affectation impossible : ${tech?.name || 'Ce technicien'} est actuellement indisponible (${statusTxt}).`,
      };
    }

    if (!bay || bay.status !== 'open') {
      return {
        valid: false,
        code: 'bay_maintenance',
        error: `Poste indisponible : ${bay?.name || input.bayId} est actuellement fermé en maintenance (${bay?.maintenanceReason || 'hors service'}).`,
      };
    }

    const isEv = this.isElectricVehicleOrder(input.vehicleName, input.service);
    if (isEv && !this.hasHighVoltageCert(tech)) {
      const suggestedEvTechs = techs.filter(
        (t) => this.isTechnicianAvailableForAssignment(t) && this.hasHighVoltageCert(t)
      );
      return {
        valid: false,
        code: 'ev_cert_required',
        error: `Blocage Sécurité Haute Tension : ${input.vehicleName} requiert un technicien certifié « Haute Tension EV/HEV ». ${tech.name} n'est pas habilité.`,
        suggestedEvTechs,
        tech,
        bay,
      };
    }

    return { valid: true, tech, bay };
  }

  reassignRepairOrder(
    baseOrder: SyncRepairOrder,
    newTechId: string,
    newBayId: string
  ): {
    success: boolean;
    error?: string;
    suggestedEvTechs?: WorkshopTechnician[];
    order?: SyncRepairOrder;
  } {
    const check = this.validateOrderAssignment({
      vehicleName: baseOrder.vehicleName,
      service: baseOrder.service,
      techId: newTechId,
      bayId: newBayId,
    });

    if (!check.valid || !check.tech || !check.bay) {
      return {
        success: false,
        error: check.error,
        suggestedEvTechs: check.suggestedEvTechs,
      };
    }

    const formattedBay = `Pont #${check.bay.id}`;
    const updatedOrder: SyncRepairOrder = {
      ...baseOrder,
      technician: check.tech.name,
      technicianRole: check.tech.role,
      bay: formattedBay,
    };

    const existing = this.getOrders();
    const hasExisting = existing.some((o) => o.id === baseOrder.id);
    const nextOrders = hasExisting
      ? existing.map((o) => (o.id === baseOrder.id ? updatedOrder : o))
      : [updatedOrder, ...existing];

    try {
      localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(nextOrders));
      window.dispatchEvent(new Event('k_dms_orders_updated'));
    } catch {}

    const live = this.getLiveProgress();
    if (live && (live.orderId === baseOrder.id || live.plate === baseOrder.plate)) {
      this.setLiveProgress({
        ...live,
        technicianName: check.tech.name,
        technicianRole: check.tech.role,
        bay: `${formattedBay} (${check.bay.specialty})`,
      });
    }

    try {
      setDoc(
        doc(db, 'repair_orders', updatedOrder.id),
        {
          id: updatedOrder.id,
          vehicle_name: updatedOrder.vehicleName,
          plate: updatedOrder.plate,
          service: updatedOrder.service,
          technician_id: check.tech.id,
          technician_name: check.tech.name,
          bay: formattedBay,
          updated_at: new Date().toISOString(),
        },
        { merge: true }
      ).catch(() => {});
    } catch {}

    return { success: true, order: updatedOrder };
  }

  createManualRepairOrder(input: {
    id?: string;
    vehicleName: string;
    plate: string;
    vin?: string;
    clientName: string;
    clientPhone?: string;
    service: string;
    serviceCategory?: string;
    techId: string;
    bayId: string;
    estimatedHours?: number;
  }): {
    success: boolean;
    error?: string;
    suggestedEvTechs?: WorkshopTechnician[];
    order?: SyncRepairOrder;
  } {
    const check = this.validateOrderAssignment({
      vehicleName: input.vehicleName,
      service: input.service,
      techId: input.techId,
      bayId: input.bayId,
    });

    if (!check.valid || !check.tech || !check.bay) {
      return {
        success: false,
        error: check.error,
        suggestedEvTechs: check.suggestedEvTechs,
      };
    }

    const now = new Date();
    const estHours = input.estimatedHours ?? 2.0;
    const estMins = Math.round(estHours * 60);
    const h = Math.floor(estMins / 60);
    const m = estMins % 60;
    const newOrder: SyncRepairOrder = {
      id: input.id || `#OR-${now.getFullYear()}-${Date.now().toString().slice(-4)}`,
      createdTime: now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      vehicleName: input.vehicleName,
      plate: input.plate,
      vin: input.vin,
      service: input.service,
      serviceCategory: input.serviceCategory || check.bay.specialty,
      technician: check.tech.name,
      technicianRole: check.tech.role,
      bay: `Pont #${check.bay.id}`,
      status: 'in_progress',
      statusLabel: 'Travaux en cours (15%)',
      progressPercent: 15,
      timeElapsed: '0h 05m',
      timeEstimated: `${h}h ${String(m).padStart(2, '0')}m`,
      estimatedHours: estHours,
      imageUrl: resolveKiaModelImage(input.vehicleName),
      clientName: input.clientName,
      clientPhone: input.clientPhone,
    };

    this.addOrder(newOrder);
    window.dispatchEvent(new Event('k_dms_orders_updated'));
    return { success: true, order: newOrder };
  }

  getAssignmentImpactAlerts(extraOrders: SyncRepairOrder[] = []): AssignmentImpactAlert[] {
    const techs = this.getWorkshopTechnicians();
    const bays = this.getWorkshopBays();
    const ordersMap = new Map<string, SyncRepairOrder>();
    for (const o of extraOrders) ordersMap.set(o.id, o);
    for (const o of this.getOrders()) ordersMap.set(o.id, o);
    const orders = Array.from(ordersMap.values());

    const alerts: AssignmentImpactAlert[] = [];

    for (const order of orders) {
      if (order.status === 'ready') continue;
      const tech = techs.find((t) => t.name.toLowerCase() === (order.technician || '').toLowerCase());
      if (tech && !this.isTechnicianAvailableForAssignment(tech)) {
        const statusTxt = !tech.active
          ? 'désactivé'
          : tech.availability === 'absent'
          ? 'Absent'
          : tech.availability === 'en_pause'
          ? 'En pause'
          : 'En essai route';
        alerts.push({
          id: `imp-tech-${order.id}`,
          type: 'tech_unavailable',
          severity: tech.availability === 'absent' || !tech.active ? 'high' : 'medium',
          orderId: order.id,
          vehicleName: order.vehicleName,
          plate: order.plate,
          resourceName: tech.name,
          message: `OR ${order.id} (${order.vehicleName} · ${order.plate}) assigné à ${tech.name} actuellement ${statusTxt}. Réaffectation recommandée.`,
        });
      }

      const bayNumMatch = (order.bay || '').match(/(\d{2})/);
      const bayId = bayNumMatch ? bayNumMatch[1] : '';
      const bay = bays.find((b) => b.id === bayId || b.name.toLowerCase() === (order.bay || '').toLowerCase());
      if (bay && bay.status === 'maintenance') {
        alerts.push({
          id: `imp-bay-${order.id}`,
          type: 'bay_maintenance',
          severity: 'high',
          orderId: order.id,
          vehicleName: order.vehicleName,
          plate: order.plate,
          resourceName: bay.name,
          message: `OR ${order.id} (${order.plate}) immobilisé sur ${bay.name} qui est en maintenance (${bay.maintenanceReason || 'indisponible'}).`,
        });
      }

      if (tech && this.isElectricVehicleOrder(order.vehicleName, order.service) && !this.hasHighVoltageCert(tech)) {
        alerts.push({
          id: `imp-ev-${order.id}`,
          type: 'ev_cert_mismatch',
          severity: 'high',
          orderId: order.id,
          vehicleName: order.vehicleName,
          plate: order.plate,
          resourceName: tech.name,
          message: `Alerte Haute Tension : OR ${order.id} (${order.vehicleName}) confié à ${tech.name} sans habilitation EV/HEV.`,
        });
      }
    }

    // Vérifier aussi les ponts ouverts dont le technicien titulaire est absent ou désactivé
    for (const bay of bays) {
      if (bay.status === 'open' && bay.leadTechnicianId) {
        const lead = techs.find((t) => t.id === bay.leadTechnicianId);
        if (lead && (!lead.active || lead.availability === 'absent')) {
          alerts.push({
            id: `imp-bay-lead-${bay.id}`,
            type: 'tech_unavailable',
            severity: 'medium',
            vehicleName: bay.specialty,
            plate: bay.name,
            resourceName: lead.name,
            message: `${bay.name} (${bay.specialty}) a pour titulaire ${lead.name}, actuellement ${!lead.active ? 'désactivé' : 'Absent'}.`,
          });
        }
      }
    }

    return alerts;
  }

  // Effacer tout pour réinitialisation
  resetAll() {
    try {
      localStorage.removeItem(STORAGE_KEYS.APPOINTMENTS);
      localStorage.removeItem(STORAGE_KEYS.ORDERS);
      localStorage.removeItem(STORAGE_KEYS.PENDING_CHECKIN);
      localStorage.removeItem(STORAGE_KEYS.TECH_NOTIF_COUNT);
      localStorage.removeItem(STORAGE_KEYS.LIVE_PROGRESS);
      localStorage.removeItem(STORAGE_KEYS.CLIENT_TOAST);
      localStorage.removeItem(STORAGE_KEYS.CHEF_RESTITUTION_ALERT);
      localStorage.removeItem(STORAGE_KEYS.CHECKED_OUT_ITEMS);
      localStorage.removeItem(STORAGE_KEYS.COMPLETED_TECH_ORDERS);
      localStorage.removeItem(STORAGE_KEYS.DISMISSED_TECH_ORDERS);
      localStorage.removeItem(STORAGE_KEYS.SERVICE_HISTORY);
      localStorage.removeItem(STORAGE_KEYS.CHEF_REQUESTS);
      localStorage.removeItem(STORAGE_KEYS.QUOTES);
      localStorage.removeItem(STORAGE_KEYS.PARTS_STOCK);
      window.dispatchEvent(new Event('k_dms_planning_updated'));
      window.dispatchEvent(new Event('k_dms_completed_orders_updated'));
      window.dispatchEvent(new Event('k_dms_live_updated'));
      window.dispatchEvent(new Event('k_dms_history_updated'));
      window.dispatchEvent(new Event('k_dms_chef_requests_updated'));
      window.dispatchEvent(new Event('k_dms_quotes_updated'));
      window.dispatchEvent(new Event('k_dms_parts_updated'));
    } catch {}
  }
}

export const workshopSyncService = new WorkshopSyncService();
