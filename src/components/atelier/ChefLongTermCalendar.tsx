import { useState, useMemo, useEffect } from 'react';
import {
  workshopSyncService,
  ClientAppointment,
  ChefLongTermRequest,
} from '../../services/workshopSyncService';

interface ChefLongTermCalendarProps {
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onLaunchCheckinFromAppointment?: (appt: ClientAppointment) => void;
  onNotify?: (msg: string) => void;
}

const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const WEEKDAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

const formatIso = (d: Date): string => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const formatFrenchFull = (d: Date): string => {
  const raw = d.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return raw.charAt(0).toUpperCase() + raw.slice(1);
};

export function ChefLongTermCalendar({
  selectedDate,
  onSelectDate,
  onLaunchCheckinFromAppointment,
  onNotify,
}: ChefLongTermCalendarProps) {
  const [viewMonth, setViewMonth] = useState<Date>(
    () => new Date(selectedDate.getFullYear(), selectedDate.getMonth(), 1)
  );
  const [sourceFilter, setSourceFilter] = useState<'all' | 'client_week' | 'chef_long_term'>('all');
  const [appointments, setAppointments] = useState<ClientAppointment[]>(() =>
    workshopSyncService.getAppointments()
  );
  const [chefRequests, setChefRequests] = useState<ChefLongTermRequest[]>(() =>
    workshopSyncService.getChefRequests()
  );

  // Formulaire ajout manuel RDV long terme par le Chef
  const [isAddingRdv, setIsAddingRdv] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [newVehicleName, setNewVehicleName] = useState('Kia Sportage GT-Line');
  const [newPlate, setNewPlate] = useState('');
  const [newServiceName, setNewServiceName] = useState('Révision Périodique Constructeur');
  const [newTime, setNewTime] = useState('09:00');
  const [newNotes, setNewNotes] = useState('');

  // État planification directe d'une demande Assistance client
  const [schedulingRequestId, setSchedulingRequestId] = useState<string | null>(null);
  const [scheduleDateIso, setScheduleDateIso] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    if (d.getDay() === 0) d.setDate(d.getDate() + 1);
    return formatIso(d);
  });
  const [scheduleTime, setScheduleTime] = useState<string>('09:30');

  useEffect(() => {
    const refreshAll = () => {
      setAppointments(workshopSyncService.getAppointments());
      setChefRequests(workshopSyncService.getChefRequests());
    };
    refreshAll();
    window.addEventListener('k_dms_planning_updated', refreshAll);
    window.addEventListener('k_dms_chef_requests_updated', refreshAll);
    return () => {
      window.removeEventListener('k_dms_planning_updated', refreshAll);
      window.removeEventListener('k_dms_chef_requests_updated', refreshAll);
    };
  }, []);

  // Rendez-vous actifs filtrés (hors clôturés, refusés, annulés)
  const activeAppointments = useMemo(() => {
    return appointments.filter((app) => {
      if (app.status === 'completed' || app.status === 'rejected' || app.status === 'cancelled') return false;
      if (workshopSyncService.isCheckedOut({ id: app.id })) {
        return false;
      }
      if (sourceFilter === 'client_week' && app.source === 'chef_long_term') return false;
      if (sourceFilter === 'chef_long_term' && app.source !== 'chef_long_term') return false;
      return true;
    });
  }, [appointments, sourceFilter]);

  // Indexation par date ISO (YYYY-MM-DD)
  const appointmentsByDate = useMemo(() => {
    const map = new Map<string, ClientAppointment[]>();
    for (const appt of activeAppointments) {
      const key = appt.dateStr;
      const list = map.get(key) || [];
      list.push(appt);
      map.set(key, list);
    }
    return map;
  }, [activeAppointments]);

  const selectedIso = formatIso(selectedDate);
  const selectedDayAppointments = appointmentsByDate.get(selectedIso) || [];
  const pendingRequests = chefRequests.filter((r) => r.status === 'PENDING');

  // Construction de la grille mensuelle (Lundi -> Dimanche)
  const monthCells = useMemo(() => {
    const year = viewMonth.getFullYear();
    const month = viewMonth.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayIndex = new Date(year, month, 1).getDay(); // 0=Dim...6=Sam
    const startOffset = (firstDayIndex + 6) % 7;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const cells: Array<{
      date: Date | null;
      iso: string;
      dayNumber: number;
      isToday: boolean;
      isSunday: boolean;
      isPast: boolean;
      isSelected: boolean;
      items: ClientAppointment[];
    }> = [];

    for (let i = 0; i < startOffset; i++) {
      cells.push({
        date: null,
        iso: `empty-${i}`,
        dayNumber: 0,
        isToday: false,
        isSunday: false,
        isPast: false,
        isSelected: false,
        items: [],
      });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const cellDate = new Date(year, month, d);
      cellDate.setHours(0, 0, 0, 0);
      const iso = formatIso(cellDate);
      const isSunday = cellDate.getDay() === 0;
      const isToday = cellDate.getTime() === today.getTime();
      const isPast = cellDate.getTime() < today.getTime();
      const isSelected = iso === selectedIso;
      const items = (appointmentsByDate.get(iso) || []).sort((a, b) =>
        (a.time || '').localeCompare(b.time || '')
      );

      cells.push({
        date: cellDate,
        iso,
        dayNumber: d,
        isToday,
        isSunday,
        isPast,
        isSelected,
        items,
      });
    }

    return cells;
  }, [viewMonth, selectedIso, appointmentsByDate]);

  const monthTotalCount = useMemo(() => {
    const prefix = `${viewMonth.getFullYear()}-${String(viewMonth.getMonth() + 1).padStart(2, '0')}`;
    return activeAppointments.filter((a) => a.dateStr.startsWith(prefix)).length;
  }, [activeAppointments, viewMonth]);

  const handlePrevMonth = () => {
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1));
  };

  const handleJumpToday = () => {
    const now = new Date();
    setViewMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    onSelectDate(now);
  };

  const handleAddLongTermAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClientName.trim() || !newPlate.trim()) return;
    if (selectedDate.getDay() === 0) {
      onNotify?.('L’atelier est fermé le dimanche. Veuillez sélectionner un jour entre Lundi et Samedi.');
      return;
    }

    workshopSyncService.saveAppointment({
      clientName: newClientName.trim(),
      clientPhone: newClientPhone.trim() || '+216 98 000 000',
      vehicleName: newVehicleName.trim(),
      plate: newPlate.trim().toUpperCase(),
      serviceName: newServiceName,
      price: 'Sur barème Kia',
      dateStr: selectedIso,
      formattedDate: formatFrenchFull(selectedDate),
      time: newTime,
      source: 'chef_long_term',
      notes: newNotes.trim() || 'RDV long terme planifié par le Chef d’Atelier.',
    });

    setNewClientName('');
    setNewClientPhone('');
    setNewPlate('');
    setNewNotes('');
    setIsAddingRdv(false);
    onNotify?.(`RDV long terme enregistré pour le ${formatFrenchFull(selectedDate)} à ${newTime}.`);
  };

  const handleConfirmScheduleRequest = (req: ChefLongTermRequest) => {
    if (!scheduleDateIso) return;
    const [y, m, d] = scheduleDateIso.split('-').map(Number);
    const targetDate = new Date(y, m - 1, d);
    if (targetDate.getDay() === 0) {
      onNotify?.('L’atelier est fermé le dimanche. Choisissez un jour entre Lundi et Samedi.');
      return;
    }

    workshopSyncService.scheduleChefRequest(
      req.id,
      scheduleDateIso,
      formatFrenchFull(targetDate),
      scheduleTime
    );

    setSchedulingRequestId(null);
    setViewMonth(new Date(targetDate.getFullYear(), targetDate.getMonth(), 1));
    onSelectDate(targetDate);
    onNotify?.(
      `Demande de ${req.clientName} planifiée au ${formatFrenchFull(targetDate)} à ${scheduleTime} dans le Grand Calendrier.`
    );
  };

  return (
    <section className="flex flex-col gap-6">
      {/* En-tête Grand Calendrier Long Terme Chef */}
      <div className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 shadow-sm border border-surface-container-high flex flex-col gap-5">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 border-b border-surface-container-high">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-xs font-semibold text-secondary">
              <span className="material-symbols-outlined text-base">calendar_month</span>
              <span>Réservé Exclusivement au Chef d'Atelier</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-on-surface">
                {activeAppointments.length} RDV actifs au total
              </span>
            </div>
            <h2 className="font-headline-md text-xl sm:text-2xl font-bold text-on-surface">
              Grand Calendrier Long Terme — Tous les Rendez-vous
            </h2>
            <p className="font-body-sm text-xs text-on-surface-variant">
              Visualisez et pilotez tous les rendez-vous sur plusieurs semaines et mois, et planifiez les demandes envoyées depuis l'espace Assistance.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Filtre Origine RDV */}
            <div className="inline-flex bg-surface-container-low p-1 rounded-xl border border-surface-container-high">
              <button
                type="button"
                onClick={() => setSourceFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                  sourceFilter === 'all'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Tous ({appointments.filter((a) => a.status !== 'completed' && a.status !== 'rejected' && a.status !== 'cancelled' && !workshopSyncService.isCheckedOut({ id: a.id })).length})
              </button>
              <button
                type="button"
                onClick={() => setSourceFilter('client_week')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                  sourceFilter === 'client_week'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Semaine Client
              </button>
              <button
                type="button"
                onClick={() => setSourceFilter('chef_long_term')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap shrink-0 ${
                  sourceFilter === 'chef_long_term'
                    ? 'bg-secondary text-white shadow-sm'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                Long Terme Chef
              </button>
            </div>

            {/* Navigation Multi-Mois */}
            <div className="flex items-center bg-surface-container-low p-1 rounded-xl border border-surface-container-high">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-2 rounded-lg hover:bg-surface-container text-on-surface transition-colors"
                title="Mois précédent"
              >
                <span className="material-symbols-outlined text-base">chevron_left</span>
              </button>
              <span className="px-3 font-headline-sm text-sm font-bold text-on-surface min-w-[155px] text-center whitespace-nowrap">
                {MONTHS_FR[viewMonth.getMonth()]} {viewMonth.getFullYear()}
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-2 rounded-lg hover:bg-surface-container text-on-surface transition-colors"
                title="Mois suivant"
              >
                <span className="material-symbols-outlined text-base">chevron_right</span>
              </button>
            </div>

            <button
              type="button"
              onClick={handleJumpToday}
              className="px-3 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-bold border border-surface-container-high whitespace-nowrap shrink-0"
            >
              Aujourd'hui
            </button>
          </div>
        </div>

        {/* Grille Principale 12 cols : Grand Calendrier (8 cols) + Détail du Jour & Ajout Long Terme (4 cols) */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Calendrier Mensuel Grand Format */}
          <div className="xl:col-span-8 flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs text-on-surface-variant px-1">
              <span>
                Mois affiché : <strong className="text-on-surface">{MONTHS_FR[viewMonth.getMonth()]} {viewMonth.getFullYear()}</strong>
              </span>
              <span className="font-mono tabular-nums font-semibold text-secondary">
                {monthTotalCount} RDV programmé{monthTotalCount > 1 ? 's' : ''} sur ce mois
              </span>
            </div>

            {/* En-tête jours */}
            <div className="grid grid-cols-7 gap-1.5 text-center py-2 bg-surface-container-low rounded-xl border border-surface-container-high">
              {WEEKDAYS_FR.map((day, idx) => (
                <span
                  key={day}
                  className={`text-xs font-bold uppercase tracking-wider ${
                    idx === 6 ? 'text-red-500' : 'text-on-surface-variant'
                  }`}
                >
                  {day}
                </span>
              ))}
            </div>

            {/* Cases du Mois */}
            <div className="grid grid-cols-7 gap-1.5">
              {monthCells.map((cell) => {
                if (!cell.date) {
                  return (
                    <div
                      key={cell.iso}
                      className="min-h-[108px] rounded-xl bg-surface-container-low/40 border border-transparent"
                    />
                  );
                }

                return (
                  <button
                    key={cell.iso}
                    type="button"
                    onClick={() => onSelectDate(cell.date!)}
                    className={`min-h-[108px] p-2 rounded-xl flex flex-col items-stretch justify-between gap-1.5 text-left transition-all border ${
                      cell.isSelected
                        ? 'bg-primary text-white border-primary shadow-md ring-2 ring-secondary/60'
                        : cell.isSunday
                        ? 'bg-surface-container/50 text-on-surface-variant/60 border-surface-container-high hover:border-outline/30'
                        : 'bg-surface-container-lowest hover:bg-surface-container-low text-on-surface border-surface-container-high'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className={`font-mono tabular-nums text-xs font-bold ${
                          cell.isSelected
                            ? 'text-white'
                            : cell.isToday
                            ? 'text-secondary underline underline-offset-4'
                            : ''
                        }`}
                      >
                        {cell.dayNumber}
                      </span>
                      {cell.items.length > 0 && (
                        <span
                          className={`font-mono tabular-nums text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            cell.isSelected
                              ? 'bg-secondary text-white'
                              : 'bg-secondary/10 text-secondary'
                          }`}
                        >
                          {cell.items.length}
                        </span>
                      )}
                    </div>

                    {/* Aperçu des RDV du jour */}
                    <div className="flex flex-col gap-1 overflow-hidden">
                      {cell.isSunday && cell.items.length === 0 ? (
                        <span className="text-[10px] text-red-500/80 font-medium">Fermé</span>
                      ) : (
                        <>
                          {cell.items.slice(0, 2).map((appt) => (
                            <div
                              key={appt.id}
                              className={`text-[10px] px-1.5 py-1 rounded truncate font-medium ${
                                cell.isSelected
                                  ? 'bg-white/15 text-white'
                                  : appt.source === 'chef_long_term'
                                  ? 'bg-[#05141f] text-white'
                                  : 'bg-secondary/10 text-secondary'
                              }`}
                              title={`${appt.time} - ${appt.clientName} (${appt.vehicleName})`}
                            >
                              <span className="font-mono">{appt.time}</span> · {appt.clientName}
                            </div>
                          ))}
                          {cell.items.length > 2 && (
                            <span
                              className={`text-[10px] font-mono tabular-nums font-bold px-1 ${
                                cell.isSelected ? 'text-white/80' : 'text-on-surface-variant'
                              }`}
                            >
                              +{cell.items.length - 2} autre{cell.items.length - 2 > 1 ? 's' : ''}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Panneau Latéral Droit : Détail du Jour & Planification Long Terme */}
          <div className="xl:col-span-4 flex flex-col gap-4 bg-surface-container-low p-4 sm:p-5 rounded-2xl border border-surface-container-high">
            <div className="flex items-start justify-between gap-2 pb-3 border-b border-surface-container-high">
              <div>
                <span className="text-[11px] font-bold uppercase text-secondary tracking-wider">
                  Date sélectionnée
                </span>
                <h3 className="font-headline-sm text-base font-bold text-on-surface">
                  {formatFrenchFull(selectedDate)}
                </h3>
                <span className="text-xs text-on-surface-variant font-mono tabular-nums">
                  {selectedDayAppointments.length} rendez-vous long/court terme
                </span>
              </div>

              {selectedDate.getDay() !== 0 && (
                <button
                  type="button"
                  onClick={() => setIsAddingRdv((v) => !v)}
                  className="px-3 py-1.5 rounded-xl bg-secondary hover:bg-secondary-container text-white text-xs font-bold flex items-center gap-1 whitespace-nowrap shrink-0 shadow-sm"
                >
                  <span className="material-symbols-outlined text-sm">
                    {isAddingRdv ? 'close' : 'add'}
                  </span>
                  <span>{isAddingRdv ? 'Fermer' : 'Nouveau RDV'}</span>
                </button>
              )}
            </div>

            {/* Formulaire Chef d'ajout d'un RDV Long Terme sur la date cliquée */}
            {isAddingRdv && (
              <form
                onSubmit={handleAddLongTermAppointment}
                className="p-3.5 rounded-xl bg-surface-container-lowest border border-secondary/30 flex flex-col gap-2.5"
              >
                <span className="text-xs font-bold text-on-surface">
                  Ajouter un RDV Long Terme le {selectedIso}
                </span>
                <input
                  type="text"
                  required
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="Nom complet du client *"
                  className="w-full px-3 py-2 rounded-lg bg-surface-container-low border border-surface-container-high text-xs text-on-surface"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    value={newPlate}
                    onChange={(e) => setNewPlate(e.target.value)}
                    placeholder="Plaque (ex: 235 TU 8812) *"
                    className="w-full px-3 py-2 rounded-lg bg-surface-container-low border border-surface-container-high text-xs font-mono text-on-surface"
                  />
                  <input
                    type="time"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-surface-container-low border border-surface-container-high text-xs font-mono text-on-surface"
                  />
                </div>
                <input
                  type="text"
                  value={newVehicleName}
                  onChange={(e) => setNewVehicleName(e.target.value)}
                  placeholder="Modèle Kia"
                  className="w-full px-3 py-2 rounded-lg bg-surface-container-low border border-surface-container-high text-xs text-on-surface"
                />
                <input
                  type="text"
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  placeholder="Prestation prévue"
                  className="w-full px-3 py-2 rounded-lg bg-surface-container-low border border-surface-container-high text-xs text-on-surface"
                />
                <input
                  type="text"
                  value={newClientPhone}
                  onChange={(e) => setNewClientPhone(e.target.value)}
                  placeholder="Téléphone client"
                  className="w-full px-3 py-2 rounded-lg bg-surface-container-low border border-surface-container-high text-xs font-mono text-on-surface"
                />
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Note atelier (facultatif)"
                  className="w-full px-3 py-2 rounded-lg bg-surface-container-low border border-surface-container-high text-xs text-on-surface"
                />
                <button
                  type="submit"
                  className="w-full py-2 rounded-lg bg-primary hover:bg-[#1a2a38] text-white text-xs font-bold transition-colors"
                >
                  Enregistrer sur le Grand Calendrier
                </button>
              </form>
            )}

            {/* Liste des RDV de cette date */}
            {selectedDayAppointments.length === 0 ? (
              <div className="py-8 text-center flex flex-col items-center gap-2 text-on-surface-variant">
                <span className="material-symbols-outlined text-3xl opacity-40">event_available</span>
                <p className="text-xs font-medium">
                  {selectedDate.getDay() === 0
                    ? 'Atelier fermé le dimanche.'
                    : 'Aucun rendez-vous enregistré pour cette date.'}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 max-h-[420px] overflow-y-auto pr-1">
                {selectedDayAppointments.map((appt) => (
                  <div
                    key={appt.id}
                    className="p-3.5 rounded-xl bg-surface-container-lowest border border-surface-container-high flex flex-col gap-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono tabular-nums text-xs font-bold text-secondary">
                        {appt.time} · {appt.plate}
                      </span>
                      <span className="text-[10px] font-semibold text-on-surface-variant">
                        {appt.source === 'chef_long_term' ? 'Long Terme Chef' : 'Semaine Client'}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-xs font-bold text-on-surface">{appt.clientName}</span>
                        {appt.clientPhone && (
                          <a
                            href={`tel:${appt.clientPhone.replace(/\s+/g, '')}`}
                            className="inline-flex items-center gap-1 font-mono tabular-nums text-[11px] font-semibold text-primary hover:text-secondary"
                          >
                            <span className="material-symbols-outlined text-xs">call</span>
                            {appt.clientPhone}
                          </a>
                        )}
                      </div>
                      <div className="text-[11px] text-on-surface-variant">
                        {appt.vehicleName} · {appt.serviceName}
                      </div>
                      {appt.notes && (
                        <p className="text-[11px] text-on-surface-variant/80 mt-1 italic">{appt.notes}</p>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-surface-container-high flex-wrap">
                      {(appt.chefDecision || 'pending') === 'pending' && appt.source !== 'chef_long_term' ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              workshopSyncService.confirmAppointmentByChef(appt.id);
                              onNotify?.(`RDV de ${appt.clientName} confirmé !`);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-xs">check</span>
                            <span>Confirmer</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              workshopSyncService.rejectAppointmentByChef(appt.id);
                              onNotify?.(`RDV de ${appt.clientName} refusé.`);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-900 text-[11px] font-bold flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-xs">close</span>
                            <span>Refuser</span>
                          </button>
                        </div>
                      ) : (
                        onLaunchCheckinFromAppointment && (
                          <button
                            type="button"
                            onClick={() => onLaunchCheckinFromAppointment(appt)}
                            className="text-xs font-bold text-primary hover:text-secondary flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-sm">play_arrow</span>
                            <span>Check-in</span>
                          </button>
                        )
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          workshopSyncService.removeAppointment(appt.id);
                          onNotify?.(`RDV de ${appt.clientName} retiré du calendrier.`);
                        }}
                        className="text-xs font-semibold text-red-600 hover:underline flex items-center gap-1 ml-auto"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                        <span>Retirer</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* File des Demandes RDV Long Terme envoyées depuis Assistance (Messages SAV, Emails, Appels) */}
      <div className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 shadow-sm border border-surface-container-high flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-surface-container-high">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-secondary text-xl">inbox_customize</span>
            <div>
              <h3 className="font-headline-sm text-base sm:text-lg font-bold text-on-surface">
                Demandes Clients RDV Long Terme (Assistance SAV)
              </h3>
              <p className="text-xs text-on-surface-variant">
                Messages SAV, Emails et Appels reçus des clients souhaitant un rendez-vous après la semaine en cours.
              </p>
            </div>
          </div>
          <span className="font-mono tabular-nums text-xs font-bold text-secondary whitespace-nowrap shrink-0">
            {pendingRequests.length} demande{pendingRequests.length > 1 ? 's' : ''} en attente
          </span>
        </div>

        {chefRequests.length === 0 ? (
          <div className="py-8 text-center text-xs text-on-surface-variant">
            Aucune demande client long terme pour le moment.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {chefRequests.map((req) => {
              const isScheduling = schedulingRequestId === req.id;
              return (
                <div
                  key={req.id}
                  className="p-4 rounded-xl bg-surface-container-low border border-surface-container-high flex flex-col justify-between gap-3"
                >
                  <div className="flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-headline-sm text-sm font-bold text-on-surface">
                            {req.clientName}
                          </span>
                          <span className="font-mono text-xs font-semibold text-primary">
                            {req.plate}
                          </span>
                        </div>
                        <div className="text-[11px] text-on-surface-variant flex flex-wrap items-center gap-1.5 mt-0.5">
                          <span>
                            {req.channel === 'email'
                              ? 'Email'
                              : req.channel === 'call'
                              ? 'Appel'
                              : 'Message SAV'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{req.vehicleName}</span>
                          {req.clientPhone && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono">{req.clientPhone}</span>
                            </>
                          )}
                        </div>
                      </div>

                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded whitespace-nowrap shrink-0 ${
                          req.status === 'SCHEDULED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : req.status === 'ARCHIVED'
                            ? 'bg-surface-container text-on-surface-variant'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {req.status === 'SCHEDULED'
                          ? `Planifié ${req.scheduledDate || ''}`
                          : req.status === 'ARCHIVED'
                          ? 'Archivé'
                          : 'À planifier'}
                      </span>
                    </div>

                    <div className="text-xs font-semibold text-secondary">
                      {req.serviceType} · Souhait : {req.preferredPeriod}
                    </div>
                    <p className="text-xs text-on-surface leading-relaxed bg-surface-container-lowest p-3 rounded-lg border border-surface-container-high">
                      {req.message}
                    </p>
                  </div>

                  {req.status === 'PENDING' && (
                    <div className="flex flex-col gap-2 pt-2 border-t border-surface-container-high">
                      {isScheduling ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="date"
                            value={scheduleDateIso}
                            onChange={(e) => setScheduleDateIso(e.target.value)}
                            className="px-2.5 py-1.5 rounded-lg bg-surface-container-lowest border border-surface-container-high text-xs font-mono text-on-surface"
                          />
                          <input
                            type="time"
                            value={scheduleTime}
                            onChange={(e) => setScheduleTime(e.target.value)}
                            className="px-2.5 py-1.5 rounded-lg bg-surface-container-lowest border border-surface-container-high text-xs font-mono text-on-surface"
                          />
                          <button
                            type="button"
                            onClick={() => handleConfirmScheduleRequest(req)}
                            className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold whitespace-nowrap shrink-0"
                          >
                            Valider sur Calendrier
                          </button>
                          <button
                            type="button"
                            onClick={() => setSchedulingRequestId(null)}
                            className="px-2.5 py-1.5 rounded-lg bg-surface-container text-on-surface text-xs font-semibold"
                          >
                            Annuler
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setSchedulingRequestId(req.id)}
                            className="px-3.5 py-2 rounded-lg bg-secondary hover:bg-secondary-container text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0"
                          >
                            <span className="material-symbols-outlined text-sm">event_available</span>
                            <span>Planifier sur le Grand Calendrier</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => workshopSyncService.archiveChefRequest(req.id)}
                            className="px-3 py-2 rounded-lg bg-surface-container hover:bg-surface-container-high text-on-surface-variant text-xs font-semibold whitespace-nowrap shrink-0"
                          >
                            Archiver
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
