import { useState, useEffect, useMemo } from 'react';
import { AdditionalQuote, Compte, Vehicle } from '../../types';
import {
  workshopSyncService,
  ChefLongTermRequest,
  ClientAppointment,
} from '../../services/workshopSyncService';
import { soundService } from '../../services/soundService';

interface AssistanceDevisProps {
  quote: AdditionalQuote | null;
  onUpdateQuoteStatus: (status: 'accepted' | 'refused') => void;
  onOpenChat: () => void;
  vehicles?: Vehicle[];
  currentCompte?: Compte | null;
}

const WEEK_SLOTS_MORNING = ['08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00'];
const WEEK_SLOTS_AFTERNOON = ['13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'];

const PERIOD_OPTIONS = [
  'Semaine prochaine (Lun – Sam)',
  'Dans 2 semaines',
  'Fin de ce mois',
  'Mois prochain',
  'Date précise à convenir avec le Chef',
];

const SERVICE_OPTIONS = [
  'Révision Périodique Constructeur',
  'Freinage & Sécurité',
  'Diagnostic Électronique / Valise KDS',
  'Climatisation & Habitacle',
  'Pneumatiques & Géométrie',
  'Carrosserie / Peinture / Autre',
];

export function AssistanceDevis({
  quote,
  onUpdateQuoteStatus,
  onOpenChat,
  vehicles = [],
  currentCompte = null,
}: AssistanceDevisProps) {
  const [requestedQuote, setRequestedQuote] = useState('');
  const [quoteSent, setQuoteSent] = useState(false);

  // Formulaire dédié : Contacter le Chef d'Atelier pour un RDV après cette semaine
  const [contactChannel, setContactChannel] = useState<'sav_message' | 'email'>('sav_message');
  const [selectedVehicleIdx, setSelectedVehicleIdx] = useState<number>(0);
  const [preferredPeriod, setPreferredPeriod] = useState<string>(PERIOD_OPTIONS[0]);
  const [preferredDateInput, setPreferredDateInput] = useState<string>('');
  const [serviceType, setServiceType] = useState<string>(SERVICE_OPTIONS[0]);
  const [chefMessage, setChefMessage] = useState<string>('');
  const [requestFeedback, setRequestFeedback] = useState<string | null>(null);
  const [callLogged, setCallLogged] = useState(false);
  const [chefRequests, setChefRequests] = useState<ChefLongTermRequest[]>(() =>
    workshopSyncService.getChefRequestsForClient(currentCompte)
  );
  const [syncedQuotes, setSyncedQuotes] = useState<AdditionalQuote[]>(() =>
    workshopSyncService.getQuotesForClient(currentCompte, vehicles)
  );
  const [commentByQuoteId, setCommentByQuoteId] = useState<Record<string, string>>({});
  const [quoteActionFeedback, setQuoteActionFeedback] = useState<string | null>(null);
  const [myAppointments, setMyAppointments] = useState<ClientAppointment[]>(() =>
    workshopSyncService.getAppointmentsForClient(currentCompte, vehicles)
  );
  const [editingApptId, setEditingApptId] = useState<string | null>(null);
  const [editDateStr, setEditDateStr] = useState<string>('');
  const [editTime, setEditTime] = useState<string>('09:00');
  const [editServiceName, setEditServiceName] = useState<string>(SERVICE_OPTIONS[0]);
  const [editNotes, setEditNotes] = useState<string>('');
  const [confirmCancelApptId, setConfirmCancelApptId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState<string>('');
  const [rdvFeedback, setRdvFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [settings, setSettings] = useState(() => workshopSyncService.getWorkshopSettings());
  const [, setSyncTick] = useState(0);

  const deadlineHours = settings.clientModifyDeadlineHours || 24;

  // Jours réservables de la semaine en cours (Lun -> Sam) selon Paramètres Atelier
  const currentWeekDays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dow = today.getDay();
    const mondayOffset = dow === 0 ? -6 : 1 - dow;
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    return Array.from({ length: 6 }, (_, idx) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + idx);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const iso = `${y}-${m}-${day}`;
      const raw = d.toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
      const isSat = d.getDay() === 6;
      const isClosedBySettings =
        (isSat && !settings.saturdayEnabled) || settings.closedDates.includes(iso);
      return {
        iso,
        formatted: raw.charAt(0).toUpperCase() + raw.slice(1),
        isSaturday: isSat,
        isPast: d.getTime() < today.getTime() || isClosedBySettings,
      };
    });
  }, [settings.saturdayEnabled, settings.closedDates]);

  useEffect(() => {
    setEditingApptId(null);
    setConfirmCancelApptId(null);
    setQuoteActionFeedback(null);
    setRdvFeedback(null);
    setRequestFeedback(null);
    setCommentByQuoteId({});
    setSelectedVehicleIdx(0);
  }, [currentCompte?.id]);

  useEffect(() => {
    const refreshRequests = () => {
      setChefRequests(workshopSyncService.getChefRequestsForClient(currentCompte));
    };
    const refreshQuotes = () => {
      setSyncedQuotes(workshopSyncService.getQuotesForClient(currentCompte, vehicles));
      setSyncTick((t) => t + 1);
    };
    const refreshAppointments = () => {
      setMyAppointments(workshopSyncService.getAppointmentsForClient(currentCompte, vehicles));
      setSettings(workshopSyncService.getWorkshopSettings());
      setSyncTick((t) => t + 1);
    };
    const refreshSettings = () => {
      setSettings(workshopSyncService.getWorkshopSettings());
      setSyncTick((t) => t + 1);
    };
    refreshRequests();
    refreshQuotes();
    refreshAppointments();
    window.addEventListener('k_dms_chef_requests_updated', refreshRequests);
    window.addEventListener('k_dms_quotes_updated', refreshQuotes);
    window.addEventListener('k_dms_orders_updated', refreshQuotes);
    window.addEventListener('k_dms_live_updated', refreshQuotes);
    window.addEventListener('k_dms_compte_synced', refreshQuotes);
    window.addEventListener('k_dms_planning_updated', refreshAppointments);
    window.addEventListener('k_dms_settings_updated', refreshSettings);
    window.addEventListener('storage', refreshQuotes);
    const interval = setInterval(refreshQuotes, 1500);
    return () => {
      window.removeEventListener('k_dms_chef_requests_updated', refreshRequests);
      window.removeEventListener('k_dms_quotes_updated', refreshQuotes);
      window.removeEventListener('k_dms_orders_updated', refreshQuotes);
      window.removeEventListener('k_dms_live_updated', refreshQuotes);
      window.removeEventListener('k_dms_compte_synced', refreshQuotes);
      window.removeEventListener('k_dms_planning_updated', refreshAppointments);
      window.removeEventListener('k_dms_settings_updated', refreshSettings);
      window.removeEventListener('storage', refreshQuotes);
      clearInterval(interval);
    };
  }, [currentCompte, vehicles]);

  const displayedQuotes: AdditionalQuote[] = (() => {
    if (syncedQuotes.length > 0) return syncedQuotes;
    if (quote && workshopSyncService.doesQuoteBelongToClient(quote, currentCompte, vehicles)) {
      return [quote];
    }
    return [];
  })();

  const handleRespondToQuote = (targetQuote: AdditionalQuote, decision: 'accepted' | 'refused') => {
    const comment = (commentByQuoteId[targetQuote.id] || '').trim();
    const updated = workshopSyncService.respondToQuoteByClient(targetQuote.id, decision, comment);
    soundService.play('client_validation_check');
    onUpdateQuoteStatus(decision);
    setSyncedQuotes(workshopSyncService.getQuotesForClient(currentCompte, vehicles));
    setQuoteActionFeedback(
      decision === 'accepted'
        ? targetQuote.requiresPartOrder
          ? `Devis accepté et avis transmis au technicien. La pièce va être commandée (${targetQuote.estimatedDeliveryDelay || 'délai fournisseur'}) — état véhicule : En attente pièce.`
          : 'Devis accepté et avis transmis au technicien pour confirmation avec l’équipe stock.'
        : 'Votre refus et votre avis ont bien été transmis au technicien.'
    );
    if (updated) {
      setCommentByQuoteId((prev) => ({ ...prev, [targetQuote.id]: '' }));
    }
    setTimeout(() => setQuoteActionFeedback(null), 6500);
  };

  const activeVehicle = vehicles[selectedVehicleIdx] || vehicles[0];
  const clientFullName = currentCompte
    ? `${currentCompte.prenom} ${currentCompte.nom}`.trim()
    : 'Client Kia';
  const clientEmail = currentCompte?.email || '';
  const clientPhone = currentCompte?.telephone || '';

  // Demandes déjà filtrées strictement par identifiant / email du compte connecté
  const myRequests = chefRequests;

  // Calcul du lundi de la semaine prochaine comme date minimale suggérée pour les RDV long terme
  const minNextWeekIso = (() => {
    const today = new Date();
    const dow = today.getDay();
    const daysUntilNextMonday = dow === 0 ? 1 : 8 - dow;
    const nextMon = new Date(today);
    nextMon.setDate(today.getDate() + daysUntilNextMonday);
    const y = nextMon.getFullYear();
    const m = String(nextMon.getMonth() + 1).padStart(2, '0');
    const d = String(nextMon.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  })();

  const handleSubmitQuote = (e: React.FormEvent) => {
    e.preventDefault();
    if (requestedQuote.trim()) {
      setQuoteSent(true);
      setRequestedQuote('');
      setTimeout(() => setQuoteSent(false), 5000);
    }
  };

  const handleSendChefRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chefMessage.trim()) return;

    const periodSummary = preferredDateInput
      ? `${preferredPeriod} (Souhait : ${preferredDateInput})`
      : preferredPeriod;

    const vName = activeVehicle?.name || currentCompte?.modeleVehicule || 'Véhicule Kia';
    const vPlate = activeVehicle?.plate || currentCompte?.immatriculation || 'À préciser';

    workshopSyncService.saveChefRequest({
      clientId: currentCompte?.id,
      clientName: clientFullName,
      clientPhone,
      clientEmail,
      vehicleName: vName,
      plate: vPlate,
      channel: contactChannel,
      preferredPeriod: periodSummary,
      serviceType,
      message: chefMessage.trim(),
    });
    soundService.play('client_validation_check');

    if (contactChannel === 'email') {
      const subject = encodeURIComponent(
        `[SAV Kia] Demande RDV Long Terme — ${vName} (${vPlate})`
      );
      const body = encodeURIComponent(
        `Bonjour M. Hédi Mansour (Chef d'Atelier),\n\n` +
          `Client : ${clientFullName} (${clientPhone})\n` +
          `Véhicule : ${vName} — Immatriculation : ${vPlate}\n` +
          `Prestation souhaitée : ${serviceType}\n` +
          `Période souhaitée (après cette semaine) : ${periodSummary}\n\n` +
          `Message :\n${chefMessage.trim()}\n\nCordialement.`
      );
      // Ouverture discrète du client mail via lien temporaire sans popup bloquée
      const mailtoLink = document.createElement('a');
      mailtoLink.href = `mailto:chef.atelier@citycars-kia.tn?subject=${subject}&body=${body}`;
      mailtoLink.click();
      setRequestFeedback(
        'Votre demande par Email a été enregistrée dans Firestore et préparée pour le Chef d’Atelier (M. Hédi Mansour).'
      );
    } else {
      setRequestFeedback(
        'Votre Message SAV direct a été transmis et enregistré dans Firestore. Le Chef d’Atelier vous confirmera votre créneau sur son grand calendrier.'
      );
    }

    setChefMessage('');
    setPreferredDateInput('');
    setTimeout(() => setRequestFeedback(null), 6500);
  };

  const handleCallChef = () => {
    const vName = activeVehicle?.name || currentCompte?.modeleVehicule || 'Véhicule Kia';
    const vPlate = activeVehicle?.plate || currentCompte?.immatriculation || 'À préciser';
    workshopSyncService.saveChefRequest({
      clientId: currentCompte?.id,
      clientName: clientFullName,
      clientPhone,
      clientEmail,
      vehicleName: vName,
      plate: vPlate,
      channel: 'call',
      preferredPeriod: 'Après cette semaine (appel téléphonique)',
      serviceType,
      message: `Demande d'appel téléphonique initiée vers le Chef d'Atelier (71 800 000) pour planification après cette semaine.`,
    });
    setCallLogged(true);
    setTimeout(() => setCallLogged(false), 5000);
  };

  return (
    <div className="w-full flex flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1.5 text-secondary font-label-md text-xs uppercase tracking-wider font-bold">
          <span className="material-symbols-outlined text-sm">support_agent</span>
          <span>SERVICE RELATION CLIENT & PLANIFICATION CHEF D'ATELIER</span>
        </div>
        <h1 className="font-headline-lg text-2xl sm:text-3xl font-bold text-on-surface">
          Assistance SAV & Contact Chef d'Atelier
        </h1>
        <p className="font-body-md text-xs sm:text-sm text-on-surface-variant">
          Planifiez vos rendez-vous au-delà de cette semaine avec le Chef d'Atelier, suivez vos devis et accédez à l'assistance 24/7.
        </p>
      </div>

      {/* Direct Hotlines 2-Column Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Card 1: 24/7 Breakdown */}
        <div className="bg-[#0e1d28] text-white p-6 rounded-2xl shadow-md flex items-center justify-between gap-4 border border-white/5 relative overflow-hidden">
          <div className="flex items-center gap-4 z-10">
            <div className="w-14 h-14 rounded-2xl bg-secondary flex items-center justify-center text-white shrink-0 shadow-md">
              <span className="material-symbols-outlined text-3xl">emergency</span>
            </div>
            <div className="flex flex-col">
              <span className="font-label-sm text-[11px] text-secondary-fixed uppercase font-bold tracking-wider">
                Assistance Dépannage 24/7
              </span>
              <h2 className="font-headline-md text-2xl font-bold font-mono tabular-nums">36 406 000</h2>
              <span className="font-body-sm text-xs text-[#778694]">Remorquage agréé sur tout le territoire</span>
            </div>
          </div>
          <a
            href="tel:36406000"
            className="w-11 h-11 rounded-full bg-secondary text-white hover:bg-secondary-container flex items-center justify-center transition-all shrink-0 z-10 shadow-sm active:scale-95"
            title="Appeler l'assistance dépannage"
          >
            <span className="material-symbols-outlined text-xl">call</span>
          </a>
        </div>

        {/* Card 2: Atelier Tunis La Goulette */}
        <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm flex items-center justify-between gap-4 border border-surface-container-high">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-surface-container flex items-center justify-center text-primary shrink-0">
              <span className="material-symbols-outlined text-3xl">build_circle</span>
            </div>
            <div className="flex flex-col">
              <span className="font-label-sm text-[11px] text-on-surface-variant uppercase font-semibold">
                Chef d'Atelier · M. Hédi Mansour
              </span>
              <span className="font-headline-md text-2xl font-bold text-on-surface font-mono tabular-nums">
                {settings.dealershipPhone || '71 800 000'}
              </span>
              <span className="font-body-sm text-xs text-on-surface-variant">
                {settings.dealershipName || 'La Goulette'} · Lun–Ven {settings.weekdayOpen}–{settings.weekdayClose} ·{' '}
                {settings.saturdayEnabled ? `Sam ${settings.saturdayOpen}–${settings.saturdayClose}` : 'Sam Fermé'}
              </span>
            </div>
          </div>
          <button
            onClick={onOpenChat}
            type="button"
            className="px-4 py-2 rounded-xl bg-primary text-on-primary font-label-md text-xs font-semibold hover:bg-[#1a2a38] transition-colors flex items-center gap-1.5 shadow-sm whitespace-nowrap shrink-0"
          >
            <span className="material-symbols-outlined text-sm">chat</span>
            <span>Messagerie Directe</span>
          </button>
        </div>
      </div>

      {/* SECTION SÉCURITÉ RDV : Mes Rendez-vous & Modification / Annulation (Règle stricte délai configuré) */}
      <section className="bg-surface-container-lowest p-5 sm:p-6 rounded-2xl shadow-sm border border-surface-container-high flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-surface-container-high">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-primary text-on-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl">event_repeat</span>
            </div>
            <div>
              <span className="font-label-sm text-xs text-secondary uppercase font-bold tracking-wider block">
                Suivi & Contrôle Délai {deadlineHours} Heures
              </span>
              <h2 className="font-headline-sm text-lg font-bold text-on-surface">
                Mes Rendez-vous Atelier ({myAppointments.length})
              </h2>
            </div>
          </div>

          <span className="text-[11px] font-semibold px-3 py-1.5 rounded-lg bg-surface-container text-on-surface-variant border border-surface-container-high flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-secondary">schedule</span>
            <span>Modification ou annulation autorisée au moins {deadlineHours}h avant le RDV</span>
          </span>
        </div>

        {rdvFeedback && (
          <div
            className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 ${
              rdvFeedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-rose-50 border-rose-200 text-rose-900'
            }`}
          >
            <span className="material-symbols-outlined text-base shrink-0">
              {rdvFeedback.type === 'success' ? 'check_circle' : 'error'}
            </span>
            <span>{rdvFeedback.text}</span>
          </div>
        )}

        {myAppointments.length === 0 ? (
          <div className="p-5 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface-variant flex items-center gap-3">
            <span className="material-symbols-outlined text-xl text-secondary">event_busy</span>
            <span>
              Vous n'avez aucun rendez-vous actif ou récent enregistré sur votre compte.
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            {myAppointments.map((appt) => {
              const rule24h = workshopSyncService.canClientModifyOrCancelAppointment(appt);
              const decision = appt.chefDecision || (appt.source === 'chef_long_term' ? 'confirmed' : 'pending');
              const isEditing = editingApptId === appt.id;
              const isConfirmingCancel = confirmCancelApptId === appt.id;

              const selectedDayMeta = currentWeekDays.find((d) => d.iso === editDateStr);
              const availableTimeSlots = selectedDayMeta?.isSaturday
                ? WEEK_SLOTS_MORNING
                : [...WEEK_SLOTS_MORNING, ...WEEK_SLOTS_AFTERNOON];

              return (
                <div
                  key={appt.id}
                  className="p-4 sm:p-5 rounded-2xl bg-surface-container-low border border-surface-container-high flex flex-col gap-3.5"
                >
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-headline-sm text-base font-bold text-on-surface">
                          {appt.formattedDate} à <span className="font-mono text-secondary">{appt.time}</span>
                        </span>
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-primary text-on-primary font-bold">
                          {appt.plate}
                        </span>
                        <span className="font-mono text-[11px] text-on-surface-variant">{appt.id}</span>
                      </div>
                      <div className="text-xs text-on-surface-variant flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-on-surface">{appt.vehicleName}</span>
                        <span aria-hidden="true">·</span>
                        <span>{appt.serviceName}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono font-bold text-secondary">{appt.price}</span>
                      </div>
                      {appt.modificationNote && (
                        <p className="text-[11px] text-on-surface-variant italic mt-0.5">
                          {appt.modificationNote}
                        </p>
                      )}
                    </div>

                    {/* Statuts Chef & Règle 24h */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <span
                        className={`text-[11px] font-bold px-2.5 py-1 rounded-lg whitespace-nowrap ${
                          appt.status === 'cancelled'
                            ? 'bg-slate-200 text-slate-700'
                            : appt.status === 'rejected'
                            ? 'bg-rose-100 text-rose-800'
                            : appt.status === 'checked_in' || appt.status === 'in_progress'
                            ? 'bg-blue-100 text-blue-800'
                            : decision === 'confirmed'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {appt.status === 'cancelled'
                          ? 'Annulé par vous'
                          : appt.status === 'rejected'
                          ? 'Refusé par le Chef'
                          : appt.status === 'checked_in' || appt.status === 'in_progress'
                          ? 'Véhicule à l’atelier'
                          : decision === 'confirmed'
                          ? 'Confirmé par le Chef'
                          : 'En attente réponse Chef'}
                      </span>

                      {appt.status !== 'cancelled' && appt.status !== 'rejected' && appt.status !== 'completed' && (
                        <span
                          className={`text-[11px] font-mono font-semibold px-2.5 py-1 rounded-lg border whitespace-nowrap ${
                            rule24h.allowed
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                              : 'bg-amber-50 text-amber-900 border-amber-300'
                          }`}
                        >
                          {rule24h.allowed
                            ? `${rule24h.hoursRemaining}h avant RDV (≥ ${deadlineHours}h)`
                            : `< ${deadlineHours}h avant RDV (${rule24h.hoursRemaining}h)`}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions Modifier / Supprimer si >= deadlineHours, sinon verrouillé */}
                  {appt.status !== 'cancelled' && appt.status !== 'rejected' && appt.status !== 'completed' && (
                    <div className="pt-3 border-t border-surface-container-high flex flex-col gap-3">
                      {rule24h.allowed ? (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[11px] text-emerald-800 font-medium flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm">verified</span>
                            <span>Délai ≥ {deadlineHours}h respecté : vous pouvez modifier ou supprimer ce rendez-vous (le Chef sera notifié).</span>
                          </span>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                if (isEditing) {
                                  setEditingApptId(null);
                                } else {
                                  const validDay = currentWeekDays.find((d) => !d.isPast && d.iso === appt.dateStr)
                                    || currentWeekDays.find((d) => !d.isPast)
                                    || currentWeekDays[0];
                                  setEditingApptId(appt.id);
                                  setConfirmCancelApptId(null);
                                  setEditDateStr(validDay?.iso || appt.dateStr);
                                  setEditTime(appt.time || '09:00');
                                  setEditServiceName(
                                    SERVICE_OPTIONS.includes(appt.serviceName) ? appt.serviceName : SERVICE_OPTIONS[0]
                                  );
                                  setEditNotes(appt.notes || '');
                                }
                              }}
                              className="px-3.5 py-1.5 rounded-xl bg-primary hover:bg-[#1a2a38] text-white text-xs font-bold flex items-center gap-1.5 transition-colors"
                            >
                              <span className="material-symbols-outlined text-sm">edit_calendar</span>
                              <span>{isEditing ? 'Fermer' : 'Modifier le RDV'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setConfirmCancelApptId(isConfirmingCancel ? null : appt.id);
                                setEditingApptId(null);
                                setCancelReason('');
                              }}
                              className="px-3.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold flex items-center gap-1.5 transition-colors"
                            >
                              <span className="material-symbols-outlined text-sm">delete</span>
                              <span>Supprimer / Annuler</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-950 text-xs flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-base text-amber-700 shrink-0">lock</span>
                            <span>
                              <strong>RDV non modifiable :</strong> {rule24h.reason || `Le délai de ${deadlineHours}h avant le rendez-vous est dépassé.`}
                            </span>
                          </div>
                          <span className="text-[11px] font-semibold text-amber-800">
                            Appelez le {settings.dealershipPhone || '71 800 000'} en cas d'urgence
                          </span>
                        </div>
                      )}

                      {/* Formulaire de modification inline (>= 24h) */}
                      {isEditing && rule24h.allowed && (
                        <div className="p-4 rounded-xl bg-surface-container-lowest border border-primary/20 flex flex-col gap-3">
                          <span className="text-xs font-bold text-on-surface flex items-center gap-1.5">
                            <span className="material-symbols-outlined text-sm text-secondary">event_available</span>
                            Replanifier votre rendez-vous (semaine en cours) et notifier le Chef d'Atelier :
                          </span>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="flex flex-col gap-1">
                              <label className="text-[11px] font-semibold text-on-surface-variant">Nouveau jour (Lun–Sam)</label>
                              <select
                                value={editDateStr}
                                onChange={(e) => {
                                  const nextIso = e.target.value;
                                  setEditDateStr(nextIso);
                                  const meta = currentWeekDays.find((d) => d.iso === nextIso);
                                  const nextPool = meta?.isSaturday
                                    ? WEEK_SLOTS_MORNING
                                    : [...WEEK_SLOTS_MORNING, ...WEEK_SLOTS_AFTERNOON];
                                  if (
                                    !nextPool.includes(editTime) ||
                                    !workshopSyncService.isSlotAvailableInRealTime(nextIso, editTime).available
                                  ) {
                                    const firstOpen = nextPool.find(
                                      (slot) => workshopSyncService.isSlotAvailableInRealTime(nextIso, slot).available
                                    );
                                    if (firstOpen) setEditTime(firstOpen);
                                  }
                                }}
                                className="px-3 py-2 rounded-lg bg-surface-container-low border border-surface-container-high text-xs text-on-surface"
                              >
                                {currentWeekDays
                                  .filter((d) => !d.isPast)
                                  .map((d) => (
                                    <option key={d.iso} value={d.iso}>
                                      {d.formatted}
                                    </option>
                                  ))}
                              </select>
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[11px] font-semibold text-on-surface-variant">Nouvel horaire</label>
                              <select
                                value={editTime}
                                onChange={(e) => setEditTime(e.target.value)}
                                className="px-3 py-2 rounded-lg bg-surface-container-low border border-surface-container-high text-xs font-mono text-on-surface"
                              >
                                {availableTimeSlots.map((slot) => {
                                  const slotCheck = workshopSyncService.isSlotAvailableInRealTime(editDateStr, slot);
                                  return (
                                    <option key={slot} value={slot} disabled={!slotCheck.available}>
                                      {slotCheck.available ? slot : `${slot} (Fermé)`}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>
                            <div className="flex flex-col gap-1">
                              <label className="text-[11px] font-semibold text-on-surface-variant">Prestation / Motif</label>
                              <select
                                value={editServiceName}
                                onChange={(e) => setEditServiceName(e.target.value)}
                                className="px-3 py-2 rounded-lg bg-surface-container-low border border-surface-container-high text-xs text-on-surface"
                              >
                                {SERVICE_OPTIONS.map((srv) => (
                                  <option key={srv} value={srv}>
                                    {srv}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <input
                            type="text"
                            value={editNotes}
                            onChange={(e) => setEditNotes(e.target.value)}
                            placeholder="Précision ou commentaire pour le Chef d'Atelier (facultatif)"
                            className="px-3 py-2 rounded-lg bg-surface-container-low border border-surface-container-high text-xs text-on-surface"
                          />
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingApptId(null)}
                              className="px-3 py-1.5 rounded-lg bg-surface-container text-xs font-semibold text-on-surface"
                            >
                              Annuler
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const dayMeta = currentWeekDays.find((d) => d.iso === editDateStr);
                                const res = workshopSyncService.modifyAppointmentByClient(appt.id, {
                                  dateStr: editDateStr,
                                  formattedDate: dayMeta?.formatted || appt.formattedDate,
                                  time: editTime,
                                  serviceName: editServiceName,
                                  notes: editNotes,
                                });
                                if (res.success) {
                                  soundService.play('client_validation_check');
                                  setEditingApptId(null);
                                  setRdvFeedback({
                                    type: 'success',
                                    text: `Rendez-vous modifié (${dayMeta?.formatted || editDateStr} à ${editTime}). Le Chef d'Atelier vient d'être notifié en temps réel.`,
                                  });
                                } else {
                                  setRdvFeedback({
                                    type: 'error',
                                    text: res.error || 'Modification impossible.',
                                  });
                                }
                                setTimeout(() => setRdvFeedback(null), 6500);
                              }}
                              className="px-4 py-1.5 rounded-lg bg-secondary hover:bg-secondary-container text-white text-xs font-bold shadow-sm"
                            >
                              Valider la modification & Notifier le Chef
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Confirmation suppression / annulation inline (>= 24h) */}
                      {isConfirmingCancel && rule24h.allowed && (
                        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex flex-col gap-3">
                          <span className="text-xs font-bold text-rose-950">
                            Confirmez-vous l'annulation définitive du RDV du {appt.formattedDate} à {appt.time} ? Le Chef d'Atelier sera notifié.
                          </span>
                          <input
                            type="text"
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                            placeholder="Motif de l'annulation (facultatif)"
                            className="px-3 py-2 rounded-lg bg-white border border-rose-200 text-xs text-on-surface"
                          />
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setConfirmCancelApptId(null)}
                              className="px-3 py-1.5 rounded-lg bg-white border border-surface-container-high text-xs font-semibold text-on-surface"
                            >
                              Conserver le RDV
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const res = workshopSyncService.cancelAppointmentByClient(appt.id, cancelReason);
                                if (res.success) {
                                  soundService.play('client_validation_check');
                                  setConfirmCancelApptId(null);
                                  setRdvFeedback({
                                    type: 'success',
                                    text: `Rendez-vous du ${appt.formattedDate} à ${appt.time} annulé et supprimé du planning. Notification envoyée au Chef d'Atelier.`,
                                  });
                                } else {
                                  setRdvFeedback({
                                    type: 'error',
                                    text: res.error || 'Annulation impossible.',
                                  });
                                }
                                setTimeout(() => setRdvFeedback(null), 6500);
                              }}
                              className="px-4 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white text-xs font-bold shadow-sm"
                            >
                              Confirmer la suppression & Notifier le Chef
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* SECTION PRINCIPALE : Contacter le Chef d'Atelier pour RDV après cette semaine */}
      <section className="bg-surface-container-lowest p-5 sm:p-6 rounded-2xl shadow-sm border border-surface-container-high flex flex-col gap-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-surface-container-high">
          <div className="flex flex-col gap-1">
            <span className="font-label-sm text-xs uppercase tracking-wider text-secondary font-bold">
              Rendez-vous après cette semaine (Long Terme)
            </span>
            <h2 className="font-headline-sm text-lg sm:text-xl font-bold text-on-surface">
              Contacter le Chef d'Atelier pour planifier une date ultérieure
            </h2>
            <p className="font-body-sm text-xs text-on-surface-variant">
              Les réservations directes étant limitées à la semaine en cours, M. Hédi Mansour planifie vos rendez-vous à moyen et long terme par Appel, Message SAV ou Email.
            </p>
          </div>

          {/* 3 Canaux d'action immédiate */}
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <a
              href={`tel:${(settings.dealershipPhone || '71800000').replace(/\s+/g, '')}`}
              onClick={handleCallChef}
              className="px-3.5 py-2.5 rounded-xl bg-[#05141f] hover:bg-[#102536] text-white font-label-md text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm whitespace-nowrap shrink-0"
            >
              <span className="material-symbols-outlined text-base text-secondary">call</span>
              <span>Appeler ({settings.dealershipPhone || '71 800 000'})</span>
            </a>

            <button
              type="button"
              onClick={() => setContactChannel('sav_message')}
              className={`px-3.5 py-2.5 rounded-xl font-label-md text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 border ${
                contactChannel === 'sav_message'
                  ? 'bg-secondary text-white border-secondary shadow-sm'
                  : 'bg-surface-container-low text-on-surface border-surface-container-high hover:bg-surface-container'
              }`}
            >
              <span className="material-symbols-outlined text-base">forum</span>
              <span>Message SAV</span>
            </button>

            <button
              type="button"
              onClick={() => setContactChannel('email')}
              className={`px-3.5 py-2.5 rounded-xl font-label-md text-xs font-bold transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0 border ${
                contactChannel === 'email'
                  ? 'bg-secondary text-white border-secondary shadow-sm'
                  : 'bg-surface-container-low text-on-surface border-surface-container-high hover:bg-surface-container'
              }`}
            >
              <span className="material-symbols-outlined text-base">mail</span>
              <span>Email au Chef</span>
            </button>
          </div>
        </div>

        {callLogged && (
          <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-center gap-2.5">
            <span className="material-symbols-outlined text-base text-blue-700">phone_in_talk</span>
            <span>
              Appel vers le <strong>71 800 000</strong> (Chef d'Atelier M. Hédi Mansour) lancé et enregistré dans le suivi SAV.
            </span>
          </div>
        )}

        {requestFeedback && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2.5">
            <span className="material-symbols-outlined text-base text-emerald-600">check_circle</span>
            <span>{requestFeedback}</span>
          </div>
        )}

        {/* Formulaire unifié Message SAV direct / Email au Chef */}
        <form onSubmit={handleSendChefRequest} className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-4 flex flex-col gap-1.5">
            <label className="font-label-sm text-xs font-semibold text-on-surface">
              Véhicule concerné
            </label>
            <select
              value={selectedVehicleIdx}
              onChange={(e) => setSelectedVehicleIdx(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-surface-container-high text-xs sm:text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50"
            >
              {vehicles.length > 0 ? (
                vehicles.map((v, idx) => (
                  <option key={v.id} value={idx}>
                    {v.name} ({v.plate})
                  </option>
                ))
              ) : (
                <option value={0}>
                  {currentCompte?.modeleVehicule || 'Véhicule Kia'} ({currentCompte?.immatriculation || 'Immat'})
                </option>
              )}
            </select>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-1.5">
            <label className="font-label-sm text-xs font-semibold text-on-surface">
              Prestation souhaitée
            </label>
            <select
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-surface-container-high text-xs sm:text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50"
            >
              {SERVICE_OPTIONS.map((srv) => (
                <option key={srv} value={srv}>
                  {srv}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-1.5">
            <label className="font-label-sm text-xs font-semibold text-on-surface">
              Période souhaitée (après cette semaine)
            </label>
            <select
              value={preferredPeriod}
              onChange={(e) => setPreferredPeriod(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-surface-container-high text-xs sm:text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/50"
            >
              {PERIOD_OPTIONS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-4 flex flex-col gap-1.5">
            <label className="font-label-sm text-xs font-semibold text-on-surface">
              Date souhaitée indicative (facultatif)
            </label>
            <input
              type="date"
              min={minNextWeekIso}
              value={preferredDateInput}
              onChange={(e) => setPreferredDateInput(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-container-low border border-surface-container-high text-xs sm:text-sm text-on-surface font-mono focus:outline-none focus:ring-2 focus:ring-secondary/50"
            />
          </div>

          <div className="lg:col-span-8 flex flex-col gap-1.5">
            <label className="font-label-sm text-xs font-semibold text-on-surface">
              {contactChannel === 'email'
                ? 'Objet & Message Email destiné à chef.atelier@citycars-kia.tn'
                : 'Votre Message SAV direct au Chef d’Atelier'}
            </label>
            <textarea
              value={chefMessage}
              onChange={(e) => setChefMessage(e.target.value)}
              rows={2}
              required
              placeholder="Ex : Je souhaite planifier ma révision des 30 000 km la semaine prochaine de préférence le matin vers 09h00..."
              className="w-full p-3 rounded-xl bg-surface-container-low border border-surface-container-high text-xs sm:text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-secondary/50 resize-none"
            />
          </div>

          <div className="lg:col-span-12 flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="text-xs text-on-surface-variant flex items-center gap-2">
              <span className="material-symbols-outlined text-sm text-secondary">
                {contactChannel === 'email' ? 'mail' : 'mark_chat_unread'}
              </span>
              <span>
                {contactChannel === 'email'
                  ? 'Enregistré dans Firestore + ouverture de votre messagerie vers chef.atelier@citycars-kia.tn'
                  : 'Transmission directe au tableau du Chef d’Atelier (synchronisation Firestore en temps réel)'}
              </span>
            </div>

            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-secondary hover:bg-secondary-container text-white font-headline-sm text-xs font-bold transition-all shadow-sm flex items-center gap-2 whitespace-nowrap shrink-0 active:scale-95"
            >
              <span className="material-symbols-outlined text-base">
                {contactChannel === 'email' ? 'forward_to_inbox' : 'send'}
              </span>
              <span>
                {contactChannel === 'email'
                  ? 'Envoyer par Email au Chef'
                  : 'Envoyer le Message SAV au Chef'}
              </span>
            </button>
          </div>
        </form>

        {/* Liste des demandes envoyées par le client et leur statut */}
        {myRequests.length > 0 && (
          <div className="pt-4 border-t border-surface-container-high flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="font-headline-sm text-sm font-bold text-on-surface">
                Mes demandes transmises au Chef d'Atelier ({myRequests.length})
              </h3>
              <span className="text-[11px] text-on-surface-variant">Suivi synchronisé</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {myRequests.slice(0, 4).map((req) => (
                <div
                  key={req.id}
                  className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container-high flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-on-surface truncate">
                      {req.serviceType}
                    </span>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded whitespace-nowrap shrink-0 ${
                        req.status === 'SCHEDULED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {req.status === 'SCHEDULED'
                        ? `Planifié : ${req.scheduledDate || ''} ${req.scheduledTime || ''}`
                        : 'En attente Chef'}
                    </span>
                  </div>
                  <div className="text-[11px] text-on-surface-variant flex flex-wrap items-center gap-1.5">
                    <span>
                      {req.channel === 'email' ? 'Email' : req.channel === 'call' ? 'Appel' : 'Message SAV'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono">{req.plate}</span>
                    <span aria-hidden="true">·</span>
                    <span>{req.preferredPeriod}</span>
                  </div>
                  <p className="text-xs text-on-surface-variant line-clamp-2">{req.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* Devis Complémentaires Atelier & Réponse Client avec Avis */}
      <section className="bg-surface-container-lowest p-5 sm:p-6 rounded-2xl shadow-sm border border-surface-container-high flex flex-col gap-4">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-surface-container-high">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-secondary-fixed text-on-secondary-fixed flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl">receipt_long</span>
            </div>
            <div>
              <span className="font-label-sm text-xs text-secondary uppercase font-bold tracking-wider block">
                Notifications Devis & Pièces Atelier
              </span>
              <h2 className="font-headline-sm text-lg font-bold text-on-surface">
                Devis Complémentaires à Valider ({displayedQuotes.length})
              </h2>
            </div>
          </div>

          <span className="font-mono tabular-nums text-xs font-bold px-3 py-1 rounded-lg bg-surface-container text-on-surface border border-surface-container-high whitespace-nowrap">
            {displayedQuotes.filter((q) => q.status === 'pending').length} en attente de votre réponse
          </span>
        </div>

        {quoteActionFeedback && (
          <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2.5">
            <span className="material-symbols-outlined text-base text-emerald-600 shrink-0">check_circle</span>
            <span>{quoteActionFeedback}</span>
          </div>
        )}

        {displayedQuotes.length > 0 ? (
          <div className="flex flex-col gap-4">
            {displayedQuotes.map((q) => {
              const waitState = workshopSyncService.isVehicleWaitingPartsForClient(currentCompte, q.plate, q.orId);
              const isOut = q.requiresPartOrder || q.partAvailability === 'out_of_stock';
              const draftComment = commentByQuoteId[q.id] ?? '';

              return (
                <div
                  key={q.id}
                  className={`p-4 sm:p-5 rounded-2xl border flex flex-col gap-4 ${
                    q.status === 'pending'
                      ? 'bg-surface-container-low border-secondary/60'
                      : 'bg-surface-container-low border-surface-container-high'
                  }`}
                >
                  {/* Top Info Row */}
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div className="w-16 h-14 rounded-xl overflow-hidden bg-surface-container-high shrink-0 border border-surface-container-high">
                        <img src={q.photoUrl} alt="Inspection pièce" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex flex-col gap-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-headline-sm text-base font-bold text-on-surface">{q.title}</span>
                          <span className="font-label-sm text-xs bg-primary text-on-primary px-2 py-0.5 rounded font-mono font-bold">
                            {q.plate}
                          </span>
                          {q.orId && (
                            <span className="font-mono text-xs text-on-surface-variant">{q.orId}</span>
                          )}
                        </div>
                        <p className="font-body-sm text-xs text-on-surface-variant leading-relaxed">
                          {q.description}
                        </p>
                        <span className="font-label-sm text-[11px] text-secondary font-semibold">
                          Émis par {q.issuedBy} à {q.issuedTime} · {q.vehicle}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col md:items-end gap-1.5 shrink-0">
                      <span className="font-headline-sm text-xl font-bold text-secondary font-mono tabular-nums">
                        {q.totalPrice.toFixed(3)} TND TTC
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {waitState.waiting && (
                          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 flex items-center gap-1 whitespace-nowrap">
                            <span className="material-symbols-outlined text-xs">hourglass_empty</span>
                            <span>En attente pièce</span>
                          </span>
                        )}
                        <span
                          className={`font-label-sm text-xs px-2.5 py-0.5 rounded-lg font-bold whitespace-nowrap ${
                            q.status === 'accepted'
                              ? 'bg-emerald-100 text-emerald-800'
                              : q.status === 'refused'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-secondary-fixed text-on-secondary-fixed'
                          }`}
                        >
                          {q.status === 'accepted'
                            ? 'Accepté par vous'
                            : q.status === 'refused'
                            ? 'Refusé par vous'
                            : 'En attente de votre réponse'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Disponibilité stock / Commande nécessaire */}
                  <div
                    className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                      q.chefDeliveryConfirmed
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                        : isOut
                        ? 'bg-amber-50 border-amber-200 text-amber-950'
                        : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                    }`}
                  >
                    <span className="material-symbols-outlined text-base shrink-0 mt-0.5">
                      {q.chefDeliveryConfirmed
                        ? 'inventory'
                        : isOut
                        ? 'local_shipping'
                        : 'check_circle'}
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <span className="font-bold">
                        {q.chefDeliveryConfirmed
                          ? `Pièce livrée et confirmée en stock par le Chef d'Atelier (${q.chefDeliveryConfirmedAt || 'confirmé'})`
                          : isOut
                          ? `Pièce non disponible en stock : commande nécessaire — Délai de livraison estimé : ${q.estimatedDeliveryDelay || '48h – 72h'}`
                          : 'Pièce disponible immédiatement en stock atelier'}
                      </span>
                      {!q.chefDeliveryConfirmed && isOut && (
                        <span>
                          Si vous acceptez ce devis, la pièce sera commandée et votre véhicule restera en état{' '}
                          <strong>« En attente pièce »</strong> jusqu’à confirmation de livraison en stock par le Chef d’Atelier.
                        </span>
                      )}
                      {q.techStockConfirmed && !q.chefDeliveryConfirmed && (
                        <span className="font-semibold text-amber-900">
                          Technicien & équipe stock informés · En attente de confirmation de réception par le Chef d'Atelier.
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Zone Avis & Validation / Refus */}
                  {q.status === 'pending' ? (
                    <div className="flex flex-col gap-3 pt-2 border-t border-surface-container-high">
                      <div className="flex flex-col gap-1.5">
                        <label
                          htmlFor={`quote-comment-${q.id}`}
                          className="font-label-sm text-xs font-semibold text-on-surface"
                        >
                          Votre avis ou commentaire pour le technicien (transmis avec votre décision) :
                        </label>
                        <textarea
                          id={`quote-comment-${q.id}`}
                          rows={2}
                          value={draftComment}
                          onChange={(e) =>
                            setCommentByQuoteId((prev) => ({ ...prev, [q.id]: e.target.value }))
                          }
                          placeholder="Ex : D'accord pour commander la pièce et attendre la livraison, merci de me tenir informé..."
                          className="w-full p-3 rounded-xl bg-surface-container-lowest border border-surface-container-high text-xs sm:text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-secondary/50 resize-none"
                        />
                      </div>

                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="text-[11px] text-on-surface-variant">
                          Pièces : <strong className="font-mono">{q.partsPrice.toFixed(3)} TND</strong> · M.O. :{' '}
                          <strong className="font-mono">{q.laborPrice.toFixed(3)} TND</strong>
                        </span>
                        <div className="flex items-center gap-2.5">
                          <button
                            type="button"
                            onClick={() => handleRespondToQuote(q, 'refused')}
                            className="px-4 py-2 rounded-xl bg-surface-container text-on-surface hover:bg-rose-50 hover:text-rose-800 border border-surface-container-high text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
                          >
                            Refuser
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRespondToQuote(q, 'accepted')}
                            className="px-5 py-2 rounded-xl bg-secondary text-on-secondary hover:bg-secondary-container text-xs font-bold shadow-sm transition-all whitespace-nowrap shrink-0"
                          >
                            {isOut ? 'Accepter & Commander la Pièce' : 'Accepter & Valider le Devis'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    q.clientComment && (
                      <div className="p-3 rounded-xl bg-surface-container-lowest border border-surface-container-high text-xs">
                        <span className="font-bold text-on-surface">Votre avis transmis à l'atelier : </span>
                        <span className="text-on-surface-variant italic">« {q.clientComment} »</span>
                      </div>
                    )
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-6 rounded-xl bg-surface-container-low flex flex-col items-center justify-center text-center gap-2">
            <div className="w-12 h-12 rounded-2xl bg-surface-container flex items-center justify-center text-secondary shadow-sm">
              <span className="material-symbols-outlined text-2xl">verified</span>
            </div>
            <h3 className="font-headline-sm text-base font-bold text-on-surface">
              Aucun Devis Complémentaire en Attente
            </h3>
            <p className="font-body-md text-xs sm:text-sm text-on-surface-variant max-w-lg">
              Si le technicien détecte le besoin d'une nouvelle pièce lors de votre intervention, le devis (en stock ou sur commande) apparaîtra ici pour validation et avis.
            </p>
          </div>
        )}
      </section>

      {/* Online Estimation Request Form */}
      <section className="bg-surface-container-lowest p-5 sm:p-6 rounded-2xl shadow-sm border border-surface-container-high flex flex-col gap-4">
        <div>
          <span className="font-label-sm text-xs uppercase tracking-wider text-secondary font-bold">
            Tarification Garantie
          </span>
          <h2 className="font-headline-sm text-lg font-bold text-on-surface">Demander une Estimation Officielle SAV</h2>
          <p className="font-body-sm text-xs text-on-surface-variant mt-0.5">
            Décrivez votre besoin : carrosserie, pneumatiques, recharge climatisation ou accessoires officiels.
          </p>
        </div>

        {quoteSent && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <span className="material-symbols-outlined text-sm text-emerald-600">check_circle</span>
            <span>Votre demande de devis a été transmise à notre service chiffrage. Vous recevrez une réponse sous 24h.</span>
          </div>
        )}

        <form onSubmit={handleSubmitQuote} className="flex flex-col gap-3">
          <textarea
            value={requestedQuote}
            onChange={(e) => setRequestedQuote(e.target.value)}
            placeholder="Ex : Je souhaite obtenir un devis pour le remplacement des balais d'essuie-glace avant et une vidange boîte DCT7..."
            rows={3}
            className="w-full p-3.5 rounded-xl bg-surface-container-low border border-surface-container-high text-xs sm:text-sm placeholder:text-on-surface-variant focus:outline-none focus:ring-2 focus:ring-secondary/50 font-body-sm text-on-surface resize-none"
            required
          />
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-secondary text-on-secondary hover:bg-secondary-container font-headline-sm text-xs font-bold transition-all shadow-sm flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <span className="material-symbols-outlined text-base">send</span>
              <span>Transmettre ma demande</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
