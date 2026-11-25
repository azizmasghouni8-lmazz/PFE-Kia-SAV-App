import { AdditionalQuote, ClientTab, Compte, Vehicle } from '../types';
import { workshopSyncService } from './workshopSyncService';

export type GuideActionType =
  | 'none'
  | 'tab_home'
  | 'tab_book'
  | 'tab_tracking'
  | 'tab_assistance'
  | 'open_advisor_chat'
  | 'open_add_vehicle';

export interface GuideAction {
  type: GuideActionType;
  label: string;
}

export interface ClientGuideContextPayload {
  activeTab: ClientTab;
  activeTabLabel: string;
  client: {
    firstName: string;
    fullName: string;
  };
  vehicles: Array<{
    name: string;
    plate: string;
    mileage: number;
    status: Vehicle['status'];
    waitingPartsReason?: string;
    warranty: string;
  }>;
  pendingChefAppointment: {
    id: string;
    vehicleName: string;
    plate: string;
    serviceName: string;
    date: string;
    time: string;
  } | null;
  upcomingAppointments: Array<{
    id: string;
    vehicleName: string;
    plate: string;
    serviceName: string;
    date: string;
    time: string;
    chefDecision: string;
    status: string;
  }>;
  longTermRequestsCount: number;
  liveWorkshop: {
    orderId: string;
    vehicleName: string;
    plate: string;
    serviceTitle: string;
    bay: string;
    technicianName: string;
    currentStep: number;
    progressPercent: number;
    status: string;
    waitingParts: boolean;
    waitingPartsReason?: string;
    invoiceAmount?: string;
  } | null;
  pendingQuotes: Array<{
    id: string;
    title: string;
    vehicle: string;
    plate: string;
    totalPriceTnd: number;
    requiresPartOrder: boolean;
    estimatedDeliveryDelay?: string;
  }>;
  archivedHistoryCount: number;
  workshop: {
    dealershipName: string;
    dealershipPhone: string;
    weekdayHours: string;
    saturdayEnabled: boolean;
    saturdayHours: string;
    minBookingLeadHours: number;
    clientModifyDeadlineHours: number;
    maintenancePricesTnd: {
      revision: number;
      freinage: number;
      diagnostic: number;
      climatisation: number;
      pneumatiques: number;
    };
  };
}

export const CLIENT_TAB_LABELS: Record<ClientTab, string> = {
  home: 'Accueil & Mes Véhicules',
  book: 'Prendre Rendez-vous',
  tracking: 'Suivi en Direct & Historique',
  assistance: 'Assistance & Devis',
};

export function buildClientGuideContext(
  activeTab: ClientTab,
  currentCompte: Compte | null,
  vehicles: Vehicle[],
  fallbackQuote: AdditionalQuote | null
): ClientGuideContextPayload {
  const settings = workshopSyncService.getWorkshopSettings();
  const appointments = workshopSyncService.getAppointmentsForClient(currentCompte, vehicles);
  const pendingChefAppt = workshopSyncService.getPendingChefAppointmentForClient(currentCompte, vehicles);
  const longTermRequests = workshopSyncService.getChefRequestsForClient(currentCompte);
  const live = workshopSyncService.getLiveProgressForClient(currentCompte);
  const syncedPendingQuotes = workshopSyncService.getPendingQuotesForClient(currentCompte, vehicles);
  const checkedOutHistory = workshopSyncService.getArchivedServiceHistoryForClient(currentCompte);

  const pendingQuotesList =
    syncedPendingQuotes.length > 0
      ? syncedPendingQuotes
      : fallbackQuote &&
          fallbackQuote.status === 'pending' &&
          workshopSyncService.doesQuoteBelongToClient(fallbackQuote, currentCompte, vehicles)
        ? [fallbackQuote]
        : [];

  const activeAppointments = appointments.filter(
    (a) => a.status !== 'cancelled' && a.status !== 'rejected' && a.status !== 'completed'
  );

  return {
    activeTab,
    activeTabLabel: CLIENT_TAB_LABELS[activeTab],
    client: {
      firstName: currentCompte?.prenom || 'Client',
      fullName: currentCompte ? `${currentCompte.prenom} ${currentCompte.nom}` : 'Client Kia',
    },
    vehicles: vehicles.map((v) => ({
      name: v.name,
      plate: v.plate,
      mileage: v.mileage,
      status: v.status,
      waitingPartsReason: v.waitingPartsReason,
      warranty: v.warranty,
    })),
    pendingChefAppointment: pendingChefAppt
      ? {
          id: pendingChefAppt.id,
          vehicleName: pendingChefAppt.vehicleName,
          plate: pendingChefAppt.plate,
          serviceName: pendingChefAppt.serviceName,
          date: pendingChefAppt.formattedDate || pendingChefAppt.dateStr,
          time: pendingChefAppt.time,
        }
      : null,
    upcomingAppointments: activeAppointments.slice(0, 4).map((a) => ({
      id: a.id,
      vehicleName: a.vehicleName,
      plate: a.plate,
      serviceName: a.serviceName,
      date: a.formattedDate || a.dateStr,
      time: a.time,
      chefDecision: a.chefDecision || 'pending',
      status: a.status,
    })),
    longTermRequestsCount: longTermRequests.filter((r) => r.status === 'PENDING').length,
    liveWorkshop: live
      ? {
          orderId: live.orderId,
          vehicleName: live.vehicleName,
          plate: live.plate,
          serviceTitle: live.serviceTitle,
          bay: live.bay,
          technicianName: live.technicianName,
          currentStep: live.currentStep,
          progressPercent: live.progressPercent,
          status: live.status,
          waitingParts: Boolean(live.waitingParts),
          waitingPartsReason: live.waitingPartsReason,
          invoiceAmount: live.invoiceAmount,
        }
      : null,
    pendingQuotes: pendingQuotesList.map((q) => ({
      id: q.id,
      title: q.title,
      vehicle: q.vehicle,
      plate: q.plate,
      totalPriceTnd: q.totalPrice,
      requiresPartOrder: Boolean(q.requiresPartOrder),
      estimatedDeliveryDelay: q.estimatedDeliveryDelay,
    })),
    archivedHistoryCount: checkedOutHistory.length,
    workshop: {
      dealershipName: settings.dealershipName,
      dealershipPhone: settings.dealershipPhone,
      weekdayHours: `${settings.weekdayOpen} - ${settings.weekdayClose}`,
      saturdayEnabled: settings.saturdayEnabled,
      saturdayHours: `${settings.saturdayOpen} - ${settings.saturdayClose}`,
      minBookingLeadHours: settings.minBookingLeadHours,
      clientModifyDeadlineHours: settings.clientModifyDeadlineHours,
      maintenancePricesTnd: settings.maintenancePrices,
    },
  };
}
