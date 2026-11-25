import { useState, useEffect, useMemo } from 'react';
import { RepairOrder } from '../../types';
import {
  workshopSyncService,
  WorkshopTechnician,
  WorkshopBay,
} from '../../services/workshopSyncService';
import { KIA_MODELS_CATALOG, resolveKiaModelImage } from '../../data/kiaCatalog';
import { soundService } from '../../services/soundService';

interface RepairOrdersProps {
  orders: RepairOrder[];
  onSelectOrder?: (order: RepairOrder) => void;
  onEmitOrderSuccess: (orderId: string) => void;
}

export function RepairOrders({ orders, onSelectOrder, onEmitOrderSuccess }: RepairOrdersProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [bayFilter, setBayFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priority, setPriority] = useState<'normal' | 'high' | 'vip'>('vip');

  const [technicians, setTechnicians] = useState<WorkshopTechnician[]>(() =>
    workshopSyncService.getWorkshopTechnicians()
  );
  const [bays, setBays] = useState<WorkshopBay[]>(() => workshopSyncService.getWorkshopBays());
  const [settings, setSettings] = useState(() => workshopSyncService.getWorkshopSettings());

  const [selectedTechId, setSelectedTechId] = useState<string>(() => {
    const avail = workshopSyncService
      .getWorkshopTechnicians()
      .filter((t) => workshopSyncService.isTechnicianAvailableForAssignment(t));
    return avail[0]?.id || '';
  });
  const [selectedBayId, setSelectedBayId] = useState<string>(() => {
    const open = workshopSyncService.getWorkshopBays().filter((b) => b.status === 'open');
    return open.find((b) => b.id === '04')?.id || open[0]?.id || '';
  });

  const [isEmitting, setIsEmitting] = useState(false);
  const [emittedOrderId, setEmittedOrderId] = useState<string | null>(null);
  const [emitError, setEmitError] = useState<string | null>(null);
  const [syncTick, setSyncTick] = useState(0);
  const [chefToast, setChefToast] = useState<string | null>(null);

  // Modal Consulter OR
  const [viewingOrder, setViewingOrder] = useState<RepairOrder | null>(null);

  // Modal Réassigner OR
  const [reassignTarget, setReassignTarget] = useState<RepairOrder | null>(null);
  const [reassignTechId, setReassignTechId] = useState<string>('');
  const [reassignBayId, setReassignBayId] = useState<string>('');
  const [reassignError, setReassignError] = useState<string | null>(null);
  const [reassignSuggestedEvTechs, setReassignSuggestedEvTechs] = useState<WorkshopTechnician[]>([]);

  // Modal Créer OR Manuel
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualModel, setManualModel] = useState<string>(KIA_MODELS_CATALOG[0]?.name || 'Kia Sportage');
  const [manualPlate, setManualPlate] = useState('241 TU 7710');
  const [manualVin, setManualVin] = useState('');
  const [manualClientName, setManualClientName] = useState('');
  const [manualClientPhone, setManualClientPhone] = useState('');
  const [manualService, setManualService] = useState('Révision Périodique Constructeur');
  const [manualEstHours, setManualEstHours] = useState<number>(2);
  const [manualTechId, setManualTechId] = useState<string>('');
  const [manualBayId, setManualBayId] = useState<string>('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualSuggestedEvTechs, setManualSuggestedEvTechs] = useState<WorkshopTechnician[]>([]);

  const showToast = (msg: string) => {
    setChefToast(msg);
    setTimeout(() => setChefToast(null), 4500);
  };

  useEffect(() => {
    const refresh = () => {
      const nextTechs = workshopSyncService.getWorkshopTechnicians();
      const nextBays = workshopSyncService.getWorkshopBays();
      setTechnicians(nextTechs);
      setBays(nextBays);
      setSettings(workshopSyncService.getWorkshopSettings());
      setSyncTick((t) => t + 1);
    };
    window.addEventListener('k_dms_orders_updated', refresh);
    window.addEventListener('k_dms_quotes_updated', refresh);
    window.addEventListener('k_dms_live_updated', refresh);
    window.addEventListener('k_dms_team_updated', refresh);
    window.addEventListener('k_dms_bays_updated', refresh);
    window.addEventListener('k_dms_settings_updated', refresh);
    return () => {
      window.removeEventListener('k_dms_orders_updated', refresh);
      window.removeEventListener('k_dms_quotes_updated', refresh);
      window.removeEventListener('k_dms_live_updated', refresh);
      window.removeEventListener('k_dms_team_updated', refresh);
      window.removeEventListener('k_dms_bays_updated', refresh);
      window.removeEventListener('k_dms_settings_updated', refresh);
    };
  }, []);

  const availableTechnicians = useMemo(
    () => technicians.filter((t) => workshopSyncService.isTechnicianAvailableForAssignment(t)),
    [technicians]
  );

  const unavailableTechnicians = useMemo(
    () => technicians.filter((t) => !workshopSyncService.isTechnicianAvailableForAssignment(t)),
    [technicians]
  );

  const openBays = useMemo(() => bays.filter((b) => b.status === 'open'), [bays]);
  const maintenanceBays = useMemo(() => bays.filter((b) => b.status === 'maintenance'), [bays]);

  // Maintenir une sélection valide dans Conversion Prioritaire si un tech devient absent ou un pont passe en maintenance
  useEffect(() => {
    if (!availableTechnicians.some((t) => t.id === selectedTechId)) {
      setSelectedTechId(availableTechnicians[0]?.id || '');
    }
  }, [availableTechnicians, selectedTechId]);

  useEffect(() => {
    if (!openBays.some((b) => b.id === selectedBayId)) {
      setSelectedBayId(openBays.find((b) => b.id === '04')?.id || openBays[0]?.id || '');
    }
  }, [openBays, selectedBayId]);

  const mergedOrders = useMemo(() => {
    const synced = workshopSyncService.getOrders();
    const byId = new Map<string, RepairOrder>();
    for (const o of synced) {
      const waitInfo = workshopSyncService.isVehicleWaitingParts(o.plate, o.id);
      byId.set(o.id, {
        ...o,
        imageUrl: resolveKiaModelImage(o.vehicleName),
        status: waitInfo.waiting ? 'waiting_parts' : o.status,
        statusLabel: waitInfo.waiting ? 'En attente pièce' : o.statusLabel,
        waitingPartsReason: waitInfo.reason || o.waitingPartsReason,
      });
    }
    for (const o of orders) {
      if (!byId.has(o.id)) {
        const waitInfo = workshopSyncService.isVehicleWaitingParts(o.plate, o.id);
        byId.set(o.id, {
          ...o,
          imageUrl: resolveKiaModelImage(o.vehicleName),
          status: waitInfo.waiting ? 'waiting_parts' : o.status,
          statusLabel: waitInfo.waiting ? 'En attente pièce' : o.statusLabel,
          waitingPartsReason: waitInfo.reason || o.waitingPartsReason,
        });
      }
    }
    return Array.from(byId.values());
  }, [orders, syncTick]);

  const impactAlerts = useMemo(
    () => workshopSyncService.getAssignmentImpactAlerts(mergedOrders),
    [mergedOrders, technicians, bays]
  );

  const filteredOrders = mergedOrders.filter((o) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      o.id.toLowerCase().includes(q) ||
      o.vehicleName.toLowerCase().includes(q) ||
      o.plate.toLowerCase().includes(q) ||
      o.technician.toLowerCase().includes(q);

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'in_progress' && o.status === 'in_progress') ||
      (statusFilter === 'waiting_parts' && o.status === 'waiting_parts') ||
      (statusFilter === 'quality_check' && o.status === 'quality_check') ||
      (statusFilter === 'pending' && o.status === 'pending');

    const bayNumMatch = (o.bay || '').match(/(\d{2})/);
    const bayNum = bayNumMatch ? parseInt(bayNumMatch[1], 10) : 0;
    const matchesBay =
      bayFilter === 'all' ||
      (bayFilter === 'meca' && bayNum >= 1 && bayNum <= 6) ||
      (bayFilter === 'diag' && bayNum >= 7 && bayNum <= 9) ||
      (bayFilter === 'chrono' && bayNum >= 10 && bayNum <= 12);

    return matchesSearch && matchesStatus && matchesBay;
  });

  // Données de conversion prioritaire
  const conversionBase = orders[0];
  const conversionVehicleName = conversionBase?.vehicleName || 'Kia Sportage GT-Line';
  const conversionPlate = conversionBase?.plate || '235 TU 8812';
  const conversionVin = conversionBase?.vin || 'KNA-AZ9823101';
  const conversionClientName = conversionBase?.clientName || 'M. Aziz Masghouni';
  const conversionService = conversionBase?.service || 'Révision Périodique & Contrôle KDS';

  const conversionValidation = useMemo(() => {
    if (!selectedTechId || !selectedBayId) {
      return {
        valid: false as const,
        code: 'tech_unavailable' as const,
        error: 'Sélectionnez un technicien disponible et un pont ouvert pour émettre l’OR.',
        suggestedEvTechs: [] as WorkshopTechnician[],
      };
    }
    return workshopSyncService.validateOrderAssignment({
      vehicleName: conversionVehicleName,
      service: conversionService,
      techId: selectedTechId,
      bayId: selectedBayId,
    });
  }, [conversionVehicleName, conversionService, selectedTechId, selectedBayId, technicians, bays]);

  const selectedBayObj = openBays.find((b) => b.id === selectedBayId);

  const activeOrdersCount = mergedOrders.filter((o) => o.status !== 'ready').length;
  const occupiedBaysCount = Math.min(openBays.length, activeOrdersCount);
  const chargePercent = openBays.length > 0 ? Math.round((occupiedBaysCount / openBays.length) * 100) : 0;

  const handleEmitOR = () => {
    if (!conversionValidation.valid) {
      setEmitError(conversionValidation.error || 'Affectation invalide.');
      if (conversionValidation.code === 'ev_cert_required') {
        soundService.play('chef_ev_safety_block');
      }
      return;
    }
    setEmitError(null);
    setIsEmitting(true);

    setTimeout(() => {
      const generatedId = `#CC-${new Date().getFullYear()}-${Math.floor(9105 + Math.random() * 800)}`;
      const res = workshopSyncService.createManualRepairOrder({
        id: generatedId,
        vehicleName: conversionVehicleName,
        plate: conversionPlate,
        vin: conversionVin,
        clientName: conversionClientName,
        service: conversionService,
        serviceCategory: priority === 'vip' ? 'VIP Express' : 'Entretien Constructeur',
        techId: selectedTechId,
        bayId: selectedBayId,
        estimatedHours: 3.3,
      });

      setIsEmitting(false);
      if (!res.success || !res.order) {
        setEmitError(res.error || 'Impossible d’émettre l’ordre de réparation.');
        return;
      }

      setEmittedOrderId(res.order.id);
      onEmitOrderSuccess(res.order.id);
      showToast(`Ordre ${res.order.id} émis et assigné à ${res.order.technician} (${res.order.bay}).`);
    }, 600);
  };

  const openReassignModal = (order: RepairOrder) => {
    const matchedTech = availableTechnicians.find(
      (t) => t.name.toLowerCase() === (order.technician || '').toLowerCase()
    );
    const bayNumMatch = (order.bay || '').match(/(\d{2})/);
    const currentBayId = bayNumMatch ? bayNumMatch[1] : '';
    const matchedBay = openBays.find((b) => b.id === currentBayId);

    setReassignTarget(order);
    setReassignTechId(matchedTech?.id || availableTechnicians[0]?.id || '');
    setReassignBayId(matchedBay?.id || openBays[0]?.id || '');
    setReassignError(null);
    setReassignSuggestedEvTechs([]);
  };

  const handleConfirmReassign = () => {
    if (!reassignTarget) return;
    const res = workshopSyncService.reassignRepairOrder(reassignTarget, reassignTechId, reassignBayId);
    if (!res.success) {
      setReassignError(res.error || 'Réaffectation bloquée.');
      setReassignSuggestedEvTechs(res.suggestedEvTechs || []);
      if (
        (res.suggestedEvTechs && res.suggestedEvTechs.length > 0) ||
        (res.error || '').includes('Haute Tension')
      ) {
        soundService.play('chef_ev_safety_block');
      }
      return;
    }
    showToast(`OR ${reassignTarget.id} réaffecté à ${res.order?.technician} (${res.order?.bay}).`);
    setReassignTarget(null);
    setReassignError(null);
    setReassignSuggestedEvTechs([]);
  };

  const openManualModal = () => {
    setManualModel(KIA_MODELS_CATALOG[0]?.name || 'Kia Sportage');
    setManualPlate('241 TU 7710');
    setManualVin('');
    setManualClientName('');
    setManualClientPhone('');
    setManualService('Révision Périodique Constructeur');
    setManualEstHours(2);
    setManualTechId(availableTechnicians[0]?.id || '');
    setManualBayId(openBays[0]?.id || '');
    setManualError(null);
    setManualSuggestedEvTechs([]);
    setIsManualModalOpen(true);
  };

  const handleCreateManualOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualPlate.trim() || !manualClientName.trim() || !manualService.trim()) {
      setManualError('Veuillez renseigner la plaque, le nom du client et la prestation.');
      return;
    }
    const res = workshopSyncService.createManualRepairOrder({
      vehicleName: manualModel,
      plate: manualPlate.trim().toUpperCase(),
      vin: manualVin.trim() || undefined,
      clientName: manualClientName.trim(),
      clientPhone: manualClientPhone.trim() || undefined,
      service: manualService.trim(),
      techId: manualTechId,
      bayId: manualBayId,
      estimatedHours: manualEstHours,
    });

    if (!res.success || !res.order) {
      setManualError(res.error || 'Création bloquée par les règles atelier.');
      setManualSuggestedEvTechs(res.suggestedEvTechs || []);
      if (
        (res.suggestedEvTechs && res.suggestedEvTechs.length > 0) ||
        (res.error || '').includes('Haute Tension')
      ) {
        soundService.play('chef_ev_safety_block');
      }
      return;
    }

    setIsManualModalOpen(false);
    setManualError(null);
    setManualSuggestedEvTechs([]);
    showToast(`Nouvel OR manuel ${res.order.id} créé pour ${res.order.vehicleName} (${res.order.bay}).`);
    onEmitOrderSuccess(res.order.id);
  };

  // Vérification en direct pour les modales
  const manualLiveCheck = useMemo(() => {
    if (!isManualModalOpen || !manualTechId || !manualBayId) return null;
    return workshopSyncService.validateOrderAssignment({
      vehicleName: manualModel,
      service: manualService,
      techId: manualTechId,
      bayId: manualBayId,
    });
  }, [isManualModalOpen, manualModel, manualService, manualTechId, manualBayId, technicians, bays]);

  const reassignLiveCheck = useMemo(() => {
    if (!reassignTarget || !reassignTechId || !reassignBayId) return null;
    return workshopSyncService.validateOrderAssignment({
      vehicleName: reassignTarget.vehicleName,
      service: reassignTarget.service,
      techId: reassignTechId,
      bayId: reassignBayId,
    });
  }, [reassignTarget, reassignTechId, reassignBayId, technicians, bays]);

  useEffect(() => {
    if (manualLiveCheck?.code === 'ev_cert_required' || reassignLiveCheck?.code === 'ev_cert_required') {
      soundService.play('chef_ev_safety_block');
    }
  }, [manualLiveCheck?.code, reassignLiveCheck?.code]);

  return (
    <div className="w-full flex flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-[1720px] mx-auto">
      {/* SECTION 1: En-tête Opérationnel & KPI Bar */}
      <section className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col gap-5 border border-surface-container-high">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-label-sm text-xs text-secondary uppercase font-bold tracking-wider">
                Workflow Atelier • Étape 02
              </span>
              <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
              <span className="font-label-sm text-xs text-on-surface-variant">
                {settings.dealershipName || 'Concessionnaire Kia La Goulette'}
              </span>
            </div>
            <h1 className="font-headline-lg text-2xl sm:text-3xl text-on-surface font-bold tracking-tight">
              Gestion des Ordres de Réparation (OR) & Affectations
            </h1>
            <p className="font-body-md text-xs sm:text-sm text-on-surface-variant">
              Supervision des travaux d'atelier, affectation filtrée sur les techniciens en poste et ponts ouverts (sécurité Haute Tension EV/HEV active).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-surface-container-low px-4 py-2 rounded-xl shadow-sm border border-surface-container-high tabular-nums">
              <span className="font-label-sm text-xs text-on-surface-variant uppercase font-semibold">Charge:</span>
              <span className="font-headline-sm text-base font-bold text-on-surface">{chargePercent}%</span>
              <span className="font-label-sm text-xs text-secondary font-semibold">
                ({occupiedBaysCount}/{openBays.length} Ponts Ouverts)
              </span>
            </div>

            <button
              type="button"
              onClick={openManualModal}
              className="flex items-center gap-1.5 bg-secondary text-on-secondary px-4 py-2.5 rounded-xl font-headline-sm text-xs sm:text-sm font-bold hover:bg-secondary-container transition-colors shadow-sm active:scale-95 whitespace-nowrap shrink-0"
            >
              <span className="material-symbols-outlined text-lg">add_circle</span>
              <span>Créer un Ordre de Réparation Manuel</span>
            </button>
          </div>
        </div>

        {/* Filters and search bar */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 pt-2 items-center">
          <div className="md:col-span-5 relative">
            <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-[20px]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher par N° d'OR, Immatriculation, Modèle, Technicien..."
              className="w-full bg-surface-container-low text-on-surface placeholder:text-on-surface-variant/60 font-body-md text-xs sm:text-sm pl-10 pr-4 py-2.5 rounded-xl border border-surface-container-high focus:outline-none focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="md:col-span-3">
            <select
              value={bayFilter}
              onChange={(e) => setBayFilter(e.target.value)}
              className="w-full bg-surface-container-low text-on-surface font-body-md text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-surface-container-high focus:outline-none cursor-pointer"
            >
              <option value="all">Toutes les Baies ({openBays.length} ouverts / {bays.length})</option>
              <option value="meca">Baies Mécanique / Service (01 à 06)</option>
              <option value="diag">Baies Diagnostic EV & KDS (07 à 09)</option>
              <option value="chrono">Chrono / Géométrie / Clim (10 à 12)</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-surface-container-low text-on-surface font-body-md text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-surface-container-high focus:outline-none cursor-pointer"
            >
              <option value="all">Tous les Statuts</option>
              <option value="in_progress">Travaux en Cours</option>
              <option value="waiting_parts">Attente Pièces</option>
              <option value="quality_check">Contrôle Qualité</option>
              <option value="pending">En Attente Prise en Main</option>
            </select>
          </div>

          <div className="md:col-span-2 flex items-center justify-end">
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setBayFilter('all');
                setStatusFilter('all');
              }}
              className="flex items-center gap-1.5 bg-surface-container-high text-on-surface px-4 py-2.5 rounded-xl font-label-md text-xs font-semibold hover:bg-surface-container-highest transition-colors w-full justify-center border border-surface-container-highest"
            >
              <span className="material-symbols-outlined text-[16px]">tune</span>
              <span>Réinitialiser</span>
            </button>
          </div>
        </div>
      </section>

      {/* Alertes d'impact temps réel (Technicien absent / Pont maintenance / EV non habilité) */}
      {impactAlerts.length > 0 && (
        <section className="p-4 sm:p-5 rounded-2xl bg-amber-50 border border-amber-300 flex flex-col gap-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-amber-950">
              <span className="material-symbols-outlined text-xl text-amber-700">warning</span>
              <span className="font-headline-sm text-sm font-bold">
                Alertes d'Affectation & Ressources ({impactAlerts.length})
              </span>
            </div>
            <span className="text-[11px] font-medium text-amber-900">
              Réaffectez les dossiers concernés vers un technicien en poste et un pont ouvert
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
            {impactAlerts.map((alert) => {
              const matchedOrder = alert.orderId
                ? mergedOrders.find((o) => o.id === alert.orderId)
                : undefined;
              return (
                <div
                  key={alert.id}
                  className="p-3 rounded-xl bg-white border border-amber-200 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <span className="font-bold text-amber-950 block">{alert.message}</span>
                    <span className="text-[11px] text-amber-800">
                      Ressource : {alert.resourceName}
                    </span>
                  </div>
                  {matchedOrder && (
                    <button
                      type="button"
                      onClick={() => openReassignModal(matchedOrder)}
                      className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary-container text-white text-xs font-bold whitespace-nowrap shrink-0"
                    >
                      Réassigner
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* SECTION 2: Panneau d'Affectation Haute Précision */}
      <section className="bg-surface-container-lowest rounded-2xl shadow-md overflow-hidden border border-surface-container-high">
        <div className="bg-[#0e1d28] text-white px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="px-2.5 py-1 rounded bg-secondary text-on-secondary font-label-sm text-[10px] font-bold tracking-wider uppercase">
              Conversion Prioritaire
            </span>
            <div className="flex items-center gap-2 font-label-lg text-xs sm:text-sm font-bold">
              <span className="text-[#778694]">Check-in #CHK-0892</span>
              <span className="material-symbols-outlined text-secondary text-base">arrow_forward</span>
              <span className="text-secondary-fixed-dim font-mono">
                {emittedOrderId ? `OR Émis ${emittedOrderId}` : 'Nouvel OR à Émettre'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-5 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="text-[#778694] uppercase font-label-sm text-[10px]">Techs En Poste :</span>
              <span className="font-semibold text-white">
                {availableTechnicians.length}/{technicians.length}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[#778694] uppercase font-label-sm text-[10px]">Ponts Ouverts :</span>
              <span className="text-secondary-fixed-dim font-bold">
                {openBays.length}/{bays.length}
              </span>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Col 1: Vehicle & Customer */}
          <div className="lg:col-span-4 flex flex-col gap-3.5 bg-surface-container-low p-4 rounded-xl border border-surface-container-high">
            <div className="flex items-start justify-between">
              <div>
                <span className="font-label-sm text-[10px] text-on-surface-variant uppercase font-semibold">
                  Fiche Véhicule & Client
                </span>
                <h2 className="font-headline-md text-base sm:text-lg font-bold text-on-surface">
                  {conversionVehicleName}
                </h2>
                <span className="font-label-md text-xs text-secondary font-bold font-mono">
                  {conversionPlate}
                </span>
              </div>
              <span className="bg-secondary text-on-secondary px-2.5 py-1 rounded-full font-label-sm text-[10px] font-bold flex items-center gap-1 shadow-sm">
                <span className="material-symbols-outlined text-xs fill">star</span> Client Enregistré
              </span>
            </div>

            <div className="relative w-full h-36 rounded-lg overflow-hidden bg-surface-container shadow-sm">
              <img
                className="w-full h-full object-cover"
                src={resolveKiaModelImage(conversionVehicleName)}
                alt={conversionVehicleName}
              />
              <div className="absolute bottom-2 left-2 bg-black/80 backdrop-blur-md px-2 py-0.5 rounded text-white font-label-sm text-[10px] font-mono">
                VIN: {conversionVin}
              </div>
            </div>

            <div className="flex flex-col gap-1.5 bg-surface-container-lowest p-3 rounded-lg border border-surface-container-high text-xs">
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant">Propriétaire:</span>
                <span className="font-semibold text-on-surface">{conversionClientName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant">Prestation:</span>
                <span className="font-label-sm font-medium text-secondary truncate max-w-[180px]">
                  {conversionService}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-on-surface-variant">Habilitation requise:</span>
                <span className="font-label-sm font-bold text-on-surface">
                  {workshopSyncService.isElectricVehicleOrder(conversionVehicleName, conversionService)
                    ? 'Haute Tension EV/HEV'
                    : 'Standard / KDS'}
                </span>
              </div>
            </div>

            <div>
              <span className="font-label-sm text-[10px] text-on-surface-variant uppercase font-semibold block mb-1.5">
                Niveau de Priorité d'Atelier
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {(['normal', 'high', 'vip'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriority(p)}
                    className={`py-1.5 text-center rounded-lg font-label-sm text-xs font-bold transition-colors border ${
                      priority === p
                        ? p === 'vip'
                          ? 'bg-secondary text-on-secondary border-secondary shadow-sm'
                          : 'bg-primary text-on-primary border-primary'
                        : 'bg-surface-container text-on-surface-variant border-surface-container-high'
                    }`}
                  >
                    {p === 'normal' ? 'Normale' : p === 'high' ? 'Haute' : 'VIP Express'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Col 2: Pack Prestations SAV */}
          <div className="lg:col-span-4 flex flex-col justify-between bg-surface-container-low p-4 rounded-xl border border-surface-container-high">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-label-sm text-[10px] text-on-surface-variant uppercase font-semibold">
                    Pack Prestations SAV
                  </span>
                  <h3 className="font-headline-sm text-sm sm:text-base font-bold text-on-surface">
                    Travaux Validés au Check-in
                  </h3>
                </div>
                <span className="material-symbols-outlined text-secondary text-2xl">assignment</span>
              </div>

              <div className="flex flex-col gap-2">
                <div className="bg-surface-container-lowest p-3 rounded-lg flex items-start justify-between shadow-sm border border-surface-container-high">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-primary text-on-primary flex items-center justify-center font-label-sm text-[10px] font-bold mt-0.5">
                      1
                    </span>
                    <div>
                      <h4 className="font-body-md text-xs font-bold text-on-surface">
                        Révision Périodique Constructeur
                      </h4>
                      <p className="font-body-sm text-[11px] text-on-surface-variant">
                        Vidange synthétique 0W20 + Filtre huile + Filtre habitacle
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-label-md text-xs font-bold text-on-surface font-mono">2.0 h</span>
                    <span className="block font-label-sm text-[10px] text-on-surface-variant">Barème Kia</span>
                  </div>
                </div>

                <div className="bg-surface-container-lowest p-3 rounded-lg flex items-start justify-between shadow-sm border border-surface-container-high">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-primary text-on-primary flex items-center justify-center font-label-sm text-[10px] font-bold mt-0.5">
                      2
                    </span>
                    <div>
                      <h4 className="font-body-md text-xs font-bold text-on-surface">
                        Contrôle circuit de freinage & purge
                      </h4>
                      <p className="font-body-sm text-[11px] text-on-surface-variant">
                        Remplacement liquide DOT4 et contrôle disques/plaquettes
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-label-md text-xs font-bold text-on-surface font-mono">0.8 h</span>
                    <span className="block font-label-sm text-[10px] text-on-surface-variant">Barème Kia</span>
                  </div>
                </div>

                <div className="bg-surface-container-lowest p-3 rounded-lg flex items-start justify-between shadow-sm border border-surface-container-high">
                  <div className="flex items-start gap-2.5">
                    <span className="w-5 h-5 rounded-full bg-primary text-on-primary flex items-center justify-center font-label-sm text-[10px] font-bold mt-0.5">
                      3
                    </span>
                    <div>
                      <h4 className="font-body-md text-xs font-bold text-on-surface">
                        Diagnostic électronique Valise KDS
                      </h4>
                      <p className="font-body-sm text-[11px] text-on-surface-variant">
                        Lecture codes défauts + reset échéance révision
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="font-label-md text-xs font-bold text-on-surface font-mono">0.5 h</span>
                    <span className="block font-label-sm text-[10px] text-on-surface-variant">Barème Kia</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-primary text-on-primary p-3.5 rounded-xl mt-3 shadow-sm border border-white/10">
              <div className="flex items-center justify-between mb-1">
                <span className="font-label-sm text-[10px] text-[#778694] uppercase tracking-wider">
                  Cumul Barème Facturable
                </span>
                <span className="font-label-sm text-[10px] bg-secondary px-2 py-0.5 rounded text-white font-bold">
                  3 Tâches
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="font-headline-lg text-2xl font-bold text-white font-mono">3h 18min</span>
                <span className="font-label-md text-xs text-[#778694]">
                  Taux M.O. {settings.hourlyLaborRateTnd} TND/h
                </span>
              </div>
            </div>
          </div>

          {/* Col 3: Dynamic Resource & Bay Allocation */}
          <div className="lg:col-span-4 flex flex-col justify-between bg-surface-container-low p-4 rounded-xl border border-surface-container-high">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="font-label-sm text-[10px] text-on-surface-variant uppercase font-semibold">
                    Ressource Humaine & Poste
                  </span>
                  <h3 className="font-headline-sm text-sm sm:text-base font-bold text-on-surface">
                    Techniciens Disponibles ({availableTechnicians.length})
                  </h3>
                </div>
                <span className="material-symbols-outlined text-secondary text-2xl">engineering</span>
              </div>

              {availableTechnicians.length === 0 ? (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs">
                  Aucun technicien actuellement « En poste ». Mettez à jour un statut dans Paramètres & Équipe.
                </div>
              ) : (
                <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
                  {availableTechnicians.map((tech) => {
                    const isSelected = selectedTechId === tech.id;
                    const isEvCapable = workshopSyncService.hasHighVoltageCert(tech);
                    return (
                      <button
                        key={tech.id}
                        type="button"
                        onClick={() => {
                          setSelectedTechId(tech.id);
                          setEmitError(null);
                          setEmittedOrderId(null);
                        }}
                        className={`p-2.5 rounded-xl flex items-center justify-between text-left transition-all border ${
                          isSelected
                            ? 'bg-surface-container-lowest ring-2 ring-secondary border-secondary shadow-sm'
                            : 'bg-surface-container-lowest/70 hover:bg-surface-container-lowest border-surface-container-high'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          {tech.avatar ? (
                            <img
                              src={tech.avatar}
                              alt={tech.name}
                              className="w-9 h-9 rounded-full object-cover shrink-0"
                            />
                          ) : (
                            <div className="w-9 h-9 rounded-full bg-primary text-white flex items-center justify-center font-bold text-xs shrink-0">
                              {tech.initials}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex items-center gap-1">
                              <span className="font-body-md text-xs font-bold text-on-surface truncate">
                                {tech.name}
                              </span>
                              {isEvCapable && (
                                <span
                                  className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] font-bold"
                                  title="Habilité Haute Tension EV/HEV"
                                >
                                  EV/HT
                                </span>
                              )}
                            </div>
                            <span className="block font-label-sm text-[10px] text-on-surface-variant truncate">
                              {tech.role}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0 ml-2">
                          <span
                            className={`font-label-sm text-xs font-bold block tabular-nums ${
                              tech.currentLoadPercent >= 85 ? 'text-secondary' : 'text-on-surface'
                            }`}
                          >
                            Charge: {tech.currentLoadPercent}%
                          </span>
                          <span className="block font-label-sm text-[10px] text-emerald-700 font-semibold">
                            En poste
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {unavailableTechnicians.length > 0 && (
                <p className="mt-2 text-[11px] text-on-surface-variant">
                  {unavailableTechnicians.length} technicien(s) exclu(s) automatiquement (Absent / Pause / Essai route / Inactif).
                </p>
              )}

              {/* Open Bay Selector */}
              <div className="mt-3 p-3 bg-surface-container-lowest rounded-xl border border-surface-container-high flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-label-sm text-[10px] text-on-surface-variant uppercase font-semibold">
                    Pont Ouvert Alloué ({openBays.length} dispo)
                  </span>
                  {selectedBayObj && (
                    <span className="font-label-sm text-[10px] px-2 py-0.5 rounded bg-surface-container-high text-on-surface font-semibold">
                      {selectedBayObj.specialty}
                    </span>
                  )}
                </div>
                <select
                  value={selectedBayId}
                  onChange={(e) => {
                    setSelectedBayId(e.target.value);
                    setEmitError(null);
                    setEmittedOrderId(null);
                  }}
                  className="w-full px-3 py-2 rounded-lg bg-surface-container-low border border-surface-container-high text-xs font-semibold text-on-surface"
                >
                  {openBays.length === 0 ? (
                    <option value="">Aucun pont ouvert</option>
                  ) : (
                    openBays.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} — {b.specialty}
                        {b.leadTechnicianName ? ` (${b.leadTechnicianName})` : ''}
                      </option>
                    ))
                  )}
                </select>
                {maintenanceBays.length > 0 && (
                  <span className="text-[10px] text-amber-800">
                    {maintenanceBays.length} pont(s) masqué(s) car en maintenance.
                  </span>
                )}
              </div>

              {/* EV High-Voltage Gate Alert */}
              {(!conversionValidation.valid || emitError) && (
                <div className="mt-3 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex flex-col gap-2">
                  <span className="font-bold">
                    {emitError || conversionValidation.error}
                  </span>
                  {conversionValidation.suggestedEvTechs &&
                    conversionValidation.suggestedEvTechs.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {conversionValidation.suggestedEvTechs.map((evTech) => (
                          <button
                            key={evTech.id}
                            type="button"
                            onClick={() => {
                              setSelectedTechId(evTech.id);
                              setEmitError(null);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold"
                          >
                            Affecter {evTech.name} (Habilité EV)
                          </button>
                        ))}
                      </div>
                    )}
                </div>
              )}
            </div>

            {emittedOrderId ? (
              <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-center flex items-center justify-center gap-2 font-bold text-xs">
                <span className="material-symbols-outlined text-base text-emerald-600 fill">check_circle</span>
                <span>OR {emittedOrderId} Émis & Synchronisé K-DMS</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleEmitOR}
                disabled={isEmitting || !conversionValidation.valid}
                className="mt-3 w-full bg-secondary hover:bg-secondary-container text-on-secondary py-3 px-4 rounded-xl font-headline-sm text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isEmitting ? (
                  <>
                    <span className="material-symbols-outlined text-base animate-spin">sync</span>
                    <span>Émission & Synchronisation K-DMS en cours...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-base">send_time_extension</span>
                    <span>Émettre l'Ordre de Réparation</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* SECTION 3: Pipeline des Ordres de Réparation en Cours */}
      <section className="bg-surface-container-lowest rounded-2xl shadow-md p-5 sm:p-6 border border-surface-container-high flex flex-col gap-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b border-surface-container-high">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-headline-md text-lg sm:text-xl font-bold text-on-surface">
                Pipeline d'Atelier en Direct
              </span>
              <span className="px-2 py-0.5 rounded bg-surface-container-high font-label-sm text-xs text-on-surface font-bold tabular-nums">
                {filteredOrders.length} Véhicules en Flux
              </span>
            </div>
            <p className="font-body-sm text-xs text-on-surface-variant">
              Suivi du barème, contrôle des habilitations EV/HEV et disponibilité réelle des techniciens & ponts.
            </p>
          </div>

          <div className="flex items-center gap-4 text-xs font-medium text-on-surface-variant">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-secondary" /> En Cours
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-error" /> Attente Pièces
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-primary" /> Contrôle Qualité
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-surface-container-low text-on-surface-variant font-label-sm text-[10px] uppercase tracking-wider">
                <th className="py-2.5 px-3 rounded-l-lg">N° OR / Horodatage</th>
                <th className="py-2.5 px-3">Véhicule & Immat.</th>
                <th className="py-2.5 px-3">Prestation / Travaux</th>
                <th className="py-2.5 px-3">Technicien Assigné</th>
                <th className="py-2.5 px-3">Baie / Pont</th>
                <th className="py-2.5 px-3">Statut Réparation</th>
                <th className="py-2.5 px-3">Temps Écoulé / Barème</th>
                <th className="py-2.5 px-3 text-right rounded-r-lg">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container-high">
              {filteredOrders.map((order) => {
                const isWaitParts = order.status === 'waiting_parts';
                const isQc = order.status === 'quality_check';
                const orderImpacts = impactAlerts.filter((a) => a.orderId === order.id);
                const hasConflict = orderImpacts.length > 0;

                return (
                  <tr
                    key={order.id}
                    onClick={() => onSelectOrder?.(order)}
                    className={`hover:bg-surface-container-low/70 transition-colors cursor-pointer ${
                      hasConflict ? 'bg-amber-50/40' : ''
                    }`}
                  >
                    <td className="py-3 px-3">
                      <span className="font-label-md text-xs font-bold text-on-surface block font-mono">
                        {order.id}
                      </span>
                      <span className="font-label-sm text-[10px] text-on-surface-variant">
                        Créé à {order.createdTime}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-10 h-7 rounded bg-surface-container overflow-hidden shrink-0 shadow-sm border border-surface-container-high">
                          <img src={order.imageUrl} alt={order.vehicleName} className="w-full h-full object-cover" />
                        </div>
                        <div>
                          <span className="font-semibold text-on-surface block leading-tight">
                            {order.vehicleName}
                          </span>
                          <span className="font-label-sm text-[10px] text-secondary font-bold font-mono">
                            {order.plate}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <span className="text-on-surface font-medium block leading-tight">{order.service}</span>
                      <span className="font-label-sm text-[10px] text-on-surface-variant">
                        {order.serviceCategory}
                      </span>
                    </td>

                    <td className="py-3 px-3">
                      <span className="font-semibold text-on-surface block">{order.technician}</span>
                      <span className="font-label-sm text-[10px] text-on-surface-variant">
                        {order.technicianRole}
                      </span>
                      {orderImpacts
                        .filter((a) => a.type === 'tech_unavailable' || a.type === 'ev_cert_mismatch')
                        .map((a) => (
                          <span
                            key={a.id}
                            className="mt-1 inline-block px-1.5 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-bold"
                          >
                            {a.type === 'ev_cert_mismatch' ? 'Non habilité EV' : 'Tech indisponible'}
                          </span>
                        ))}
                    </td>

                    <td className="py-3 px-3">
                      <span className="font-label-sm text-xs bg-surface-container px-2 py-0.5 rounded font-bold text-on-surface border border-surface-container-high inline-block">
                        {order.bay}
                      </span>
                      {orderImpacts
                        .filter((a) => a.type === 'bay_maintenance')
                        .map((a) => (
                          <span
                            key={a.id}
                            className="mt-1 block px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 text-[10px] font-bold w-fit"
                          >
                            Pont en maintenance
                          </span>
                        ))}
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isWaitParts ? 'bg-error' : isQc ? 'bg-primary' : 'bg-secondary'
                          }`}
                        />
                        <span
                          className={`font-label-sm text-[10px] font-bold uppercase ${
                            isWaitParts ? 'text-error' : isQc ? 'text-primary' : 'text-secondary'
                          }`}
                        >
                          {order.statusLabel}
                        </span>
                      </div>
                      <div className="w-24 bg-surface-container-high h-1 rounded-full mt-1 overflow-hidden">
                        <div
                          className={`h-full ${isWaitParts ? 'bg-error' : isQc ? 'bg-primary' : 'bg-secondary'}`}
                          style={{ width: `${order.progressPercent}%` }}
                        />
                      </div>
                    </td>

                    <td className="py-3 px-3 font-label-sm text-xs font-mono tabular-nums">
                      <span className={`font-bold ${isWaitParts ? 'text-error' : 'text-on-surface'}`}>
                        {order.timeElapsed}
                      </span>
                      <span className="text-on-surface-variant"> / {order.timeEstimated}</span>
                    </td>

                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingOrder(order);
                          }}
                          className="p-1.5 rounded-lg bg-surface-container-high hover:bg-surface-container-highest text-on-surface transition-colors"
                          title="Consulter la fiche OR"
                        >
                          <span className="material-symbols-outlined text-[16px]">visibility</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            openReassignModal(order);
                          }}
                          className={`px-2 py-1 rounded-lg text-[11px] font-bold transition-colors flex items-center gap-1 ${
                            hasConflict
                              ? 'bg-secondary text-white hover:bg-secondary-container'
                              : 'bg-surface-container-high hover:bg-surface-container-highest text-on-surface'
                          }`}
                          title="Réassigner technicien ou pont"
                        >
                          <span className="material-symbols-outlined text-[15px]">swap_horiz</span>
                          {hasConflict && <span>Réassigner</span>}
                        </button>
                        {isWaitParts && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const waitInfo = workshopSyncService.isVehicleWaitingParts(order.plate, order.id);
                              if (waitInfo.quote) {
                                workshopSyncService.confirmPartDeliveryByChef(waitInfo.quote.id);
                              } else {
                                workshopSyncService.setVehicleWaitingParts(order.plate, order.id, false);
                              }
                              showToast(`Réception pièce confirmée pour ${order.vehicleName} (${order.plate}).`);
                            }}
                            className="px-2 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold transition-colors flex items-center gap-1 whitespace-nowrap"
                            title="Confirmer réception pièce en stock (Chef d'Atelier)"
                            type="button"
                          >
                            <span className="material-symbols-outlined text-[14px]">inventory</span>
                            <span>Pièce Reçue</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {chefToast && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-emerald-700">check_circle</span>
            <span>{chefToast}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-surface-container-high text-xs text-on-surface-variant">
          <div className="flex items-center gap-2">
            <span>Affichage de {filteredOrders.length} ordres en atelier aujourd'hui</span>
            <span className="h-3 w-[1px] bg-surface-container-highest" />
            <span className="font-label-sm text-on-surface font-semibold">
              {openBays.length} ponts ouverts · {availableTechnicians.length} techniciens en poste
            </span>
          </div>
        </div>
      </section>

      {/* MODAL 1 : Consulter Fiche OR */}
      {viewingOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest max-w-lg w-full rounded-2xl p-6 shadow-2xl border border-surface-container-high flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
              <div>
                <span className="font-mono text-xs font-bold text-secondary">{viewingOrder.id}</span>
                <h3 className="font-headline-sm text-lg font-bold text-on-surface">
                  {viewingOrder.vehicleName} ({viewingOrder.plate})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setViewingOrder(null)}
                className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-surface-container-low p-4 rounded-xl border border-surface-container-high">
              <div>
                <span className="text-on-surface-variant block">Client</span>
                <span className="font-bold text-on-surface">{viewingOrder.clientName || 'Client Kia'}</span>
              </div>
              <div>
                <span className="text-on-surface-variant block">Statut</span>
                <span className="font-bold text-secondary">{viewingOrder.statusLabel}</span>
              </div>
              <div>
                <span className="text-on-surface-variant block">Technicien assigné</span>
                <span className="font-bold text-on-surface">{viewingOrder.technician}</span>
              </div>
              <div>
                <span className="text-on-surface-variant block">Pont / Baie</span>
                <span className="font-bold text-on-surface font-mono">{viewingOrder.bay}</span>
              </div>
              <div className="col-span-2">
                <span className="text-on-surface-variant block">Prestation</span>
                <span className="font-semibold text-on-surface">{viewingOrder.service}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-container-high">
              <button
                type="button"
                onClick={() => {
                  const target = viewingOrder;
                  setViewingOrder(null);
                  openReassignModal(target);
                }}
                className="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-bold"
              >
                Réassigner Tech / Pont
              </button>
              <button
                type="button"
                onClick={() => setViewingOrder(null)}
                className="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2 : Réassigner OR avec Contrôle EV Haute Tension & Ponts Ouverts */}
      {reassignTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest max-w-lg w-full rounded-2xl p-6 shadow-2xl border border-surface-container-high flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
              <div>
                <span className="font-mono text-xs font-bold text-secondary">{reassignTarget.id}</span>
                <h3 className="font-headline-sm text-lg font-bold text-on-surface">
                  Réassigner Technicien & Pont
                </h3>
                <p className="text-xs text-on-surface-variant">
                  {reassignTarget.vehicleName} ({reassignTarget.plate}) · {reassignTarget.service}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReassignTarget(null)}
                className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {workshopSyncService.isElectricVehicleOrder(reassignTarget.vehicleName, reassignTarget.service) && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-emerald-700">electric_bolt</span>
                <span>
                  Véhicule électrifié : seule une affectation vers un technicien certifié <strong>Haute Tension EV/HEV</strong> est autorisée.
                </span>
              </div>
            )}

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-on-surface">
                  Technicien disponible ({availableTechnicians.length} en poste)
                </label>
                <select
                  value={reassignTechId}
                  onChange={(e) => {
                    setReassignTechId(e.target.value);
                    setReassignError(null);
                  }}
                  className="px-3 py-2.5 rounded-xl bg-surface-container-low border border-surface-container-high text-xs font-semibold text-on-surface"
                >
                  {availableTechnicians.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} — {t.role} ({t.currentLoadPercent}% charge)
                      {workshopSyncService.hasHighVoltageCert(t) ? ' [Habilité EV/HEV]' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-on-surface">
                  Pont ouvert ({openBays.length} disponibles)
                </label>
                <select
                  value={reassignBayId}
                  onChange={(e) => {
                    setReassignBayId(e.target.value);
                    setReassignError(null);
                  }}
                  className="px-3 py-2.5 rounded-xl bg-surface-container-low border border-surface-container-high text-xs font-semibold text-on-surface"
                >
                  {openBays.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} — {b.specialty}
                    </option>
                  ))}
                </select>
              </div>

              {(reassignError || (reassignLiveCheck && !reassignLiveCheck.valid)) && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex flex-col gap-2">
                  <span className="font-bold">
                    {reassignError || reassignLiveCheck?.error}
                  </span>
                  {(reassignSuggestedEvTechs.length > 0
                    ? reassignSuggestedEvTechs
                    : reassignLiveCheck?.suggestedEvTechs || []
                  ).map((evTech) => (
                    <button
                      key={evTech.id}
                      type="button"
                      onClick={() => {
                        setReassignTechId(evTech.id);
                        setReassignError(null);
                        setReassignSuggestedEvTechs([]);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold w-fit"
                    >
                      Basculer sur {evTech.name} (Habilité Haute Tension)
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-container-high">
              <button
                type="button"
                onClick={() => setReassignTarget(null)}
                className="px-4 py-2 rounded-xl bg-surface-container text-on-surface text-xs font-semibold"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmReassign}
                disabled={Boolean(reassignLiveCheck && !reassignLiveCheck.valid)}
                className="px-5 py-2 rounded-xl bg-secondary hover:bg-secondary-container text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirmer la Réaffectation
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3 : Créer un Ordre de Réparation Manuel */}
      {isManualModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <form
            onSubmit={handleCreateManualOrder}
            className="bg-surface-container-lowest max-w-xl w-full rounded-2xl p-6 shadow-2xl border border-surface-container-high flex flex-col gap-4 my-auto"
          >
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
              <div>
                <span className="font-label-sm text-[10px] text-secondary uppercase font-bold">
                  Ordonnancement Direct K-DMS
                </span>
                <h3 className="font-headline-sm text-lg font-bold text-on-surface">
                  Créer un Ordre de Réparation Manuel
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsManualModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-on-surface">Modèle Kia</label>
                <select
                  value={manualModel}
                  onChange={(e) => {
                    setManualModel(e.target.value);
                    setManualError(null);
                  }}
                  className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface"
                >
                  {KIA_MODELS_CATALOG.map((m) => (
                    <option key={m.id} value={m.name}>
                      {m.name} ({m.category})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-on-surface">Immatriculation</label>
                <input
                  type="text"
                  value={manualPlate}
                  onChange={(e) => setManualPlate(e.target.value)}
                  placeholder="Ex: 241 TU 7710"
                  required
                  className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high text-xs font-mono text-on-surface"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-on-surface">Nom du Client</label>
                <input
                  type="text"
                  value={manualClientName}
                  onChange={(e) => setManualClientName(e.target.value)}
                  placeholder="Ex: M. Sami Ben Ali"
                  required
                  className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-on-surface">Téléphone (optionnel)</label>
                <input
                  type="text"
                  value={manualClientPhone}
                  onChange={(e) => setManualClientPhone(e.target.value)}
                  placeholder="Ex: 98 400 120"
                  className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high text-xs font-mono text-on-surface"
                />
              </div>

              <div className="sm:col-span-2 flex flex-col gap-1">
                <label className="text-xs font-bold text-on-surface">Prestation / Travaux</label>
                <input
                  type="text"
                  value={manualService}
                  onChange={(e) => {
                    setManualService(e.target.value);
                    setManualError(null);
                  }}
                  required
                  className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-on-surface">
                  Technicien en poste ({availableTechnicians.length})
                </label>
                <select
                  value={manualTechId}
                  onChange={(e) => {
                    setManualTechId(e.target.value);
                    setManualError(null);
                  }}
                  className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface"
                >
                  {availableTechnicians.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.role})
                      {workshopSyncService.hasHighVoltageCert(t) ? ' [EV/HT]' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-on-surface">
                  Pont ouvert ({openBays.length})
                </label>
                <select
                  value={manualBayId}
                  onChange={(e) => {
                    setManualBayId(e.target.value);
                    setManualError(null);
                  }}
                  className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface"
                >
                  {openBays.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} — {b.specialty}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-on-surface">Durée barème (h)</label>
                <input
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={manualEstHours}
                  onChange={(e) => setManualEstHours(Number(e.target.value) || 1)}
                  className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high text-xs font-mono text-on-surface"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-on-surface">VIN (optionnel)</label>
                <input
                  type="text"
                  value={manualVin}
                  onChange={(e) => setManualVin(e.target.value)}
                  placeholder="Ex: KNA-..."
                  className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high text-xs font-mono text-on-surface"
                />
              </div>
            </div>

            {(manualError || (manualLiveCheck && !manualLiveCheck.valid)) && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs flex flex-col gap-2">
                <span className="font-bold">{manualError || manualLiveCheck?.error}</span>
                {(manualSuggestedEvTechs.length > 0
                  ? manualSuggestedEvTechs
                  : manualLiveCheck?.suggestedEvTechs || []
                ).map((evTech) => (
                  <button
                    key={evTech.id}
                    type="button"
                    onClick={() => {
                      setManualTechId(evTech.id);
                      setManualError(null);
                      setManualSuggestedEvTechs([]);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold w-fit"
                  >
                    Sélectionner {evTech.name} (Habilité EV/HEV)
                  </button>
                ))}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-surface-container-high">
              <button
                type="button"
                onClick={() => setIsManualModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-surface-container text-on-surface text-xs font-semibold"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={Boolean(manualLiveCheck && !manualLiveCheck.valid)}
                className="px-5 py-2 rounded-xl bg-secondary hover:bg-secondary-container text-white text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Créer & Affecter l'OR
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
