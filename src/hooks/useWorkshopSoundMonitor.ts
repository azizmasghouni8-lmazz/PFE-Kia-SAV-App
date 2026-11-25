import { useEffect, useRef } from 'react';
import { AppRole, Compte, Vehicle } from '../types';
import { workshopSyncService } from '../services/workshopSyncService';
import { soundService } from '../services/soundService';
import { INITIAL_ORDERS } from '../data/mockData';

interface SnapshotState {
  initialized: boolean;
  sessionKey: string;
  // Client snapshots
  confirmedApptIds: Set<string>;
  pendingQuoteIds: Set<string>;
  liveOrderId: string | null;
  liveStep: number;
  liveStatus: string | null;
  // Chef snapshots
  chefNotifIds: Set<string>;
  chefRequestIds: Set<string>;
  clientPendingApptIds: Set<string>;
  chefReadyOrderSignature: string | null;
  impactAlertIds: Set<string>;
  // Tech snapshots
  techOrderSignatures: Map<string, string>;
  quoteStatuses: Map<string, string>;
  confirmedDeliveryQuoteIds: Set<string>;
}

function makeEmptySnapshot(sessionKey: string): SnapshotState {
  return {
    initialized: false,
    sessionKey,
    confirmedApptIds: new Set(),
    pendingQuoteIds: new Set(),
    liveOrderId: null,
    liveStep: 0,
    liveStatus: null,
    chefNotifIds: new Set(),
    chefRequestIds: new Set(),
    clientPendingApptIds: new Set(),
    chefReadyOrderSignature: null,
    impactAlertIds: new Set(),
    techOrderSignatures: new Map(),
    quoteStatuses: new Map(),
    confirmedDeliveryQuoteIds: new Set(),
  };
}

export function useWorkshopSoundMonitor(
  role: AppRole,
  currentCompte: Compte | null,
  vehicles: Vehicle[]
) {
  const sessionKey = `${role}:${currentCompte?.id || 'none'}`;
  const snapshotRef = useRef<SnapshotState>(makeEmptySnapshot(sessionKey));

  // Synchroniser le rôle actif et les paramètres globaux atelier
  useEffect(() => {
    soundService.setActiveRole(role);
    soundService.syncFromWorkshopSettings();
  }, [role]);

  useEffect(() => {
    if (role === 'auth') {
      snapshotRef.current = makeEmptySnapshot(sessionKey);
      return;
    }

    // Réinitialiser l'empreinte silencieusement lors d'un changement de rôle ou de compte
    if (snapshotRef.current.sessionKey !== sessionKey) {
      snapshotRef.current = makeEmptySnapshot(sessionKey);
    }

    const evaluateState = () => {
      const snap = snapshotRef.current;

      // 1. CALCUL DES DONNÉES ACTUELLES PAR RÔLE
      const allAppointments = workshopSyncService.getAppointments();
      const allQuotes = workshopSyncService.getQuotes();
      const liveGlobal = workshopSyncService.getLiveProgress();

      if (role === 'client') {
        const myAppts = workshopSyncService.getAppointmentsForClient(currentCompte, vehicles);
        const confirmedNow = new Set(
          myAppts
            .filter((a) => a.chefDecision === 'confirmed' && a.status !== 'cancelled' && a.status !== 'rejected')
            .map((a) => a.id)
        );
        const myPendingQuotes = workshopSyncService.getPendingQuotesForClient(currentCompte, vehicles);
        const pendingQNow = new Set(myPendingQuotes.map((q) => q.id));

        const clientLive = workshopSyncService.getLiveProgressForClient(currentCompte);
        const liveIdNow = clientLive?.orderId || null;
        const liveStepNow = clientLive?.currentStep || 0;
        const liveStatusNow = clientLive?.status || null;

        if (!snap.initialized) {
          snap.confirmedApptIds = confirmedNow;
          snap.pendingQuoteIds = pendingQNow;
          snap.liveOrderId = liveIdNow;
          snap.liveStep = liveStepNow;
          snap.liveStatus = liveStatusNow;
          snap.initialized = true;
          return;
        }

        // a) RDV confirmé par le Chef
        let hasNewConfirmedAppt = false;
        confirmedNow.forEach((id) => {
          if (!snap.confirmedApptIds.has(id)) hasNewConfirmedAppt = true;
        });
        if (hasNewConfirmedAppt) {
          soundService.play('client_rdv_confirmed');
        }

        // b) Nouveau devis complémentaire reçu
        let hasNewPendingQuote = false;
        pendingQNow.forEach((id) => {
          if (!snap.pendingQuoteIds.has(id)) hasNewPendingQuote = true;
        });
        if (hasNewPendingQuote) {
          soundService.play('client_quote_received');
        }

        // c) Évolution suivi en direct & Véhicule prêt
        if (liveIdNow && liveStatusNow !== snap.liveStatus && liveStatusNow === 'ready_for_restitution') {
          soundService.play('client_vehicle_ready');
        } else if (
          liveIdNow &&
          liveStatusNow !== snap.liveStatus &&
          liveStatusNow === 'completed_and_paid'
        ) {
          soundService.play('client_validation_check');
        } else if (
          liveIdNow &&
          liveIdNow === snap.liveOrderId &&
          liveStepNow > snap.liveStep &&
          liveStatusNow !== 'ready_for_restitution'
        ) {
          soundService.play('client_tracking_step');
        } else if (liveIdNow && liveIdNow !== snap.liveOrderId && liveStatusNow !== 'completed_and_paid') {
          soundService.play('client_tracking_step');
        }

        snap.confirmedApptIds = confirmedNow;
        snap.pendingQuoteIds = pendingQNow;
        snap.liveOrderId = liveIdNow;
        snap.liveStep = liveStepNow;
        snap.liveStatus = liveStatusNow;
        return;
      }

      if (role === 'chef') {
        const chefNotifsNow = new Set(
          workshopSyncService
            .getChefNotifications()
            .filter((n) => !n.read)
            .map((n) => n.id)
        );
        const chefReqNow = new Set(
          workshopSyncService
            .getChefRequests()
            .filter((r) => r.status === 'PENDING')
            .map((r) => r.id)
        );
        const clientPendingApptsNow = new Set(
          allAppointments
            .filter(
              (a) =>
                a.status === 'booked' &&
                (a.chefDecision === 'pending' || (!a.chefDecision && a.source === 'client_week'))
            )
            .map((a) => a.id)
        );
        const readySigNow =
          liveGlobal && liveGlobal.status === 'ready_for_restitution'
            ? `${liveGlobal.orderId}:${liveGlobal.status}`
            : null;

        const alertsNow = new Set(
          workshopSyncService
            .getAssignmentImpactAlerts(
              workshopSyncService.getOrders().length > 0
                ? workshopSyncService.getOrders()
                : INITIAL_ORDERS
            )
            .map((al) => al.id)
        );

        if (!snap.initialized) {
          snap.chefNotifIds = chefNotifsNow;
          snap.chefRequestIds = chefReqNow;
          snap.clientPendingApptIds = clientPendingApptsNow;
          snap.chefReadyOrderSignature = readySigNow;
          snap.impactAlertIds = alertsNow;
          snap.initialized = true;
          return;
        }

        // a) Nouveau RDV / Long Terme / Modif / Annulation client
        let hasNewChefActivity = false;
        chefNotifsNow.forEach((id) => {
          if (!snap.chefNotifIds.has(id)) hasNewChefActivity = true;
        });
        chefReqNow.forEach((id) => {
          if (!snap.chefRequestIds.has(id)) hasNewChefActivity = true;
        });
        clientPendingApptsNow.forEach((id) => {
          if (!snap.clientPendingApptIds.has(id)) hasNewChefActivity = true;
        });
        if (hasNewChefActivity) {
          soundService.play('chef_rdv_activity');
        }

        // b) Technicien termine un OR ("Prêt pour restitution")
        if (readySigNow && readySigNow !== snap.chefReadyOrderSignature) {
          soundService.play('chef_order_ready');
        }

        // c) Conflit ressource (Absent / Pont Maintenance avec OR actif)
        let hasNewConflict = false;
        alertsNow.forEach((id) => {
          if (!snap.impactAlertIds.has(id)) hasNewConflict = true;
        });
        if (hasNewConflict) {
          soundService.play('chef_resource_conflict');
        }

        snap.chefNotifIds = chefNotifsNow;
        snap.chefRequestIds = chefReqNow;
        snap.clientPendingApptIds = clientPendingApptsNow;
        snap.chefReadyOrderSignature = readySigNow;
        snap.impactAlertIds = alertsNow;
        return;
      }

      if (role === 'tech') {
        const currentOrders = workshopSyncService.getOrders();
        const orderSigNow = new Map<string, string>();
        for (const o of currentOrders) {
          if (!workshopSyncService.isTechOrderDismissed(o.id, o.plate)) {
            orderSigNow.set(o.id, `${o.technician}|${o.bay}`);
          }
        }

        const quoteStatusNow = new Map<string, string>();
        const confirmedDelivNow = new Set<string>();
        for (const q of allQuotes) {
          quoteStatusNow.set(q.id, q.status);
          if (q.chefDeliveryConfirmed) {
            confirmedDelivNow.add(q.id);
          }
        }

        if (!snap.initialized) {
          snap.techOrderSignatures = orderSigNow;
          snap.quoteStatuses = quoteStatusNow;
          snap.confirmedDeliveryQuoteIds = confirmedDelivNow;
          snap.initialized = true;
          return;
        }

        // a) Nouvel OR assigné ou réaffecté
        let hasNewOrReassigned = false;
        orderSigNow.forEach((sig, id) => {
          const prevSig = snap.techOrderSignatures.get(id);
          if (prevSig === undefined || prevSig !== sig) {
            hasNewOrReassigned = true;
          }
        });
        if (hasNewOrReassigned) {
          soundService.play('tech_new_order');
        }

        // b) Réponse du client sur un devis pièce (Accepté / Refusé)
        quoteStatusNow.forEach((status, id) => {
          const prev = snap.quoteStatuses.get(id);
          if (prev && prev === 'pending' && status === 'accepted') {
            soundService.play('tech_quote_accepted');
          } else if (prev && prev === 'pending' && status === 'refused') {
            soundService.play('tech_quote_refused');
          }
        });

        // c) Pièce reçue en stock (validée par le Chef)
        let hasPartArrived = false;
        confirmedDelivNow.forEach((id) => {
          if (!snap.confirmedDeliveryQuoteIds.has(id)) {
            hasPartArrived = true;
          }
        });
        if (hasPartArrived) {
          soundService.play('tech_part_arrived');
        }

        snap.techOrderSignatures = orderSigNow;
        snap.quoteStatuses = quoteStatusNow;
        snap.confirmedDeliveryQuoteIds = confirmedDelivNow;
      }
    };

    evaluateState();

    const events = [
      'k_dms_planning_updated',
      'k_dms_chef_notifications_updated',
      'k_dms_chef_requests_updated',
      'k_dms_orders_updated',
      'k_dms_quotes_updated',
      'k_dms_live_updated',
      'k_dms_parts_updated',
      'k_dms_team_updated',
      'k_dms_bays_updated',
      'k_dms_completed_orders_updated',
      'k_dms_history_updated',
      'storage',
    ];

    events.forEach((evt) => window.addEventListener(evt, evaluateState));
    const poll = setInterval(evaluateState, 1600);

    return () => {
      events.forEach((evt) => window.removeEventListener(evt, evaluateState));
      clearInterval(poll);
    };
  }, [role, sessionKey, currentCompte, vehicles]);
}
