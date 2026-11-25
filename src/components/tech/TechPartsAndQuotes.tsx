import { useState, useMemo, useEffect } from 'react';
import { PartItem, PartCategory, AdditionalQuote } from '../../types';
import { PART_CATEGORIES } from '../../data/partsData';
import { INITIAL_ORDERS } from '../../data/mockData';
import { workshopSyncService } from '../../services/workshopSyncService';
import { compteService } from '../../services/compteService';

interface TechPartsAndQuotesProps {
  currentQuote: AdditionalQuote;
  onUpdateQuote?: (quote: AdditionalQuote) => void;
  onNavigateToActive?: () => void;
}

interface WorkshopVehicleTarget {
  key: string;
  orId: string;
  vehicleName: string;
  plate: string;
  bay: string;
  clientId?: string;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  badge: string;
}

const DELIVERY_DELAY_PRESETS = [
  '24h – 48h (Dépôt National)',
  '48h – 72h (Fournisseur Kia)',
  '3 à 5 jours ouvrables (Import)',
  '5 à 7 jours ouvrables (Commande Spéciale)',
];

export function TechPartsAndQuotes({
  currentQuote,
  onUpdateQuote,
  onNavigateToActive,
}: TechPartsAndQuotesProps) {
  const [activeTab, setActiveTab] = useState<'stock' | 'quotes'>('stock');
  const [selectedCategory, setSelectedCategory] = useState<PartCategory>('all');
  const [partsStock, setPartsStock] = useState<PartItem[]>(() => workshopSyncService.getPartsStock());
  const [quotes, setQuotes] = useState<AdditionalQuote[]>(() => workshopSyncService.getQuotes());
  const [settings, setSettings] = useState(() => workshopSyncService.getWorkshopSettings());
  const [syncTick, setSyncTick] = useState(0);

  // Modal de création / envoi de devis pièce (en stock OU à commander)
  const [selectedPart, setSelectedPart] = useState<PartItem | null>(null);
  const [selectedVehicleKey, setSelectedVehicleKey] = useState<string>('');
  const [quoteJustification, setQuoteJustification] = useState<string>('');
  const [customLabor, setCustomLabor] = useState<number>(45);
  const [deliveryDelay, setDeliveryDelay] = useState<string>(DELIVERY_DELAY_PRESETS[1]);
  const [setWaitingImmediately, setSetWaitingImmediately] = useState<boolean>(true);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  useEffect(() => {
    const refresh = () => {
      setPartsStock(workshopSyncService.getPartsStock());
      setQuotes(workshopSyncService.getQuotes());
      setSettings(workshopSyncService.getWorkshopSettings());
      setSyncTick((t) => t + 1);
    };
    refresh();
    window.addEventListener('k_dms_parts_updated', refresh);
    window.addEventListener('k_dms_quotes_updated', refresh);
    window.addEventListener('k_dms_orders_updated', refresh);
    window.addEventListener('k_dms_live_updated', refresh);
    window.addEventListener('k_dms_planning_updated', refresh);
    window.addEventListener('k_dms_settings_updated', refresh);
    return () => {
      window.removeEventListener('k_dms_parts_updated', refresh);
      window.removeEventListener('k_dms_quotes_updated', refresh);
      window.removeEventListener('k_dms_orders_updated', refresh);
      window.removeEventListener('k_dms_live_updated', refresh);
      window.removeEventListener('k_dms_planning_updated', refresh);
      window.removeEventListener('k_dms_settings_updated', refresh);
    };
  }, []);

  // Liste dynamique de tous les véhicules présents en atelier, en RDV ou enregistrés
  const workshopTargets = useMemo<WorkshopVehicleTarget[]>(() => {
    const targets: WorkshopVehicleTarget[] = [];
    const seenPlates = new Set<string>();
    const normPlate = (p?: string) => (p || '').replace(/[^a-z0-9]/gi, '').toLowerCase();

    const comptesClients = compteService.getComptes().filter((c) => c.role === 'client');
    const appointments = workshopSyncService.getAppointments();

    const resolveIdentity = (plate: string, fallbackName?: string, fallbackEmail?: string, fallbackPhone?: string, fallbackId?: string) => {
      const clean = normPlate(plate);
      const matchedCompte = comptesClients.find((c) => normPlate(c.immatriculation) === clean);
      const matchedAppt = appointments.find((a) => normPlate(a.plate) === clean);
      const resolvedName =
        (fallbackName && fallbackName !== 'Client Kia' && fallbackName !== 'Cher Client' ? fallbackName : undefined) ||
        matchedAppt?.clientName ||
        (matchedCompte ? `${matchedCompte.prenom} ${matchedCompte.nom}` : undefined) ||
        'Client Kia';

      return {
        clientId: fallbackId || matchedCompte?.id || matchedAppt?.clientId,
        clientName: resolvedName,
        clientEmail: fallbackEmail || matchedCompte?.email || matchedAppt?.clientEmail,
        clientPhone: fallbackPhone || matchedCompte?.telephone || matchedAppt?.clientPhone,
      };
    };

    const pushTarget = (t: WorkshopVehicleTarget) => {
      const cleanPlate = normPlate(t.plate);
      if (!cleanPlate || seenPlates.has(cleanPlate)) return;
      if (workshopSyncService.isCheckedOut({ plate: t.plate, id: t.orId })) return;
      seenPlates.add(cleanPlate);
      const identity = resolveIdentity(t.plate, t.clientName, t.clientEmail, t.clientPhone, t.clientId);
      targets.push({
        ...t,
        ...identity,
      });
    };

    // 1. Véhicules en rendez-vous client actifs (non annulés / non refusés / non terminés)
    for (const appt of appointments) {
      if (appt.status === 'completed' || appt.status === 'rejected' || appt.status === 'cancelled') continue;
      pushTarget({
        key: `appt-${appt.id}`,
        orId: appt.orId || `#OR-${appt.id.replace(/[^0-9]/g, '').slice(-4) || '9201'}`,
        vehicleName: appt.vehicleName,
        plate: appt.plate,
        bay: 'Pont #01 (Réception)',
        clientId: appt.clientId,
        clientName: appt.clientName,
        clientEmail: appt.clientEmail,
        clientPhone: appt.clientPhone,
        badge: appt.status === 'checked_in' ? 'Check-in validé' : 'RDV Client',
      });
    }

    // 2. Ordre actuellement actif en baie (liveProgress)
    const live = workshopSyncService.getLiveProgress();
    if (live && live.status !== 'completed_and_paid') {
      pushTarget({
        key: `live-${live.orderId}`,
        orId: live.orderId,
        vehicleName: live.vehicleName,
        plate: live.plate,
        bay: live.bay,
        clientId: live.clientId,
        clientName: live.clientName,
        clientEmail: live.clientEmail,
        badge: live.waitingParts ? 'En attente pièce' : 'En cours',
      });
    }

    // 3. Ordres de réparation synchronisés (Chef -> Tech)
    for (const ord of workshopSyncService.getOrders()) {
      if (workshopSyncService.isTechOrderDismissed(ord.id, ord.plate)) continue;
      pushTarget({
        key: `ord-${ord.id}`,
        orId: ord.id,
        vehicleName: ord.vehicleName,
        plate: ord.plate,
        bay: ord.bay,
        clientId: ord.clientId,
        clientName: ord.clientName || 'Client Kia',
        clientEmail: ord.clientEmail,
        clientPhone: ord.clientPhone,
        badge: ord.status === 'waiting_parts' ? 'En attente pièce' : ord.statusLabel || 'Actif',
      });
    }

    // 4. Comptes clients enregistrés (permet d'envoyer un devis à tout client inscrit)
    for (const cpt of comptesClients) {
      if (!cpt.immatriculation) continue;
      pushTarget({
        key: `cpt-${cpt.id}`,
        orId: `#OR-${new Date().getFullYear()}-${cpt.id.replace(/[^0-9]/g, '').slice(-4) || '9001'}`,
        vehicleName: cpt.modeleVehicule || 'Véhicule Kia',
        plate: cpt.immatriculation,
        bay: 'Pont #04 (Mécanique)',
        clientId: cpt.id,
        clientName: `${cpt.prenom} ${cpt.nom}`,
        clientEmail: cpt.email,
        clientPhone: cpt.telephone,
        badge: 'Client Enregistré',
      });
    }

    // 5. Ordres initiaux de démonstration
    for (const initOrd of INITIAL_ORDERS) {
      if (workshopSyncService.isTechOrderDismissed(initOrd.id, initOrd.plate)) continue;
      pushTarget({
        key: `init-${initOrd.id}`,
        orId: initOrd.id,
        vehicleName: initOrd.vehicleName,
        plate: initOrd.plate,
        bay: initOrd.bay,
        clientName: initOrd.clientName || 'Client Kia',
        badge: initOrd.status === 'waiting_parts' ? 'En attente pièce' : 'Atelier',
      });
    }

    return targets;
  }, [syncTick]);

  const openPartQuoteModal = (part: PartItem) => {
    const isOut = part.stockCount === 0;
    const defaultTarget = workshopTargets[0];
    setSelectedPart(part);
    setSelectedVehicleKey(defaultTarget?.key || '');
    const hourlyRate = settings.hourlyLaborRateTnd || 65;
    setCustomLabor(Math.max(30, Math.round(part.laborTimeHours * hourlyRate)));
    setDeliveryDelay(DELIVERY_DELAY_PRESETS[1]);
    setSetWaitingImmediately(isOut);
    setQuoteJustification(
      isOut
        ? `Pièce nécessaire détectée lors du contrôle : ${part.name} (Réf ${part.oemRef}). Actuellement indisponible en stock atelier — commande fournisseur requise (attente de livraison estimée) avant montage.`
        : `Pièce d'usure constatée lors de l'intervention : ${part.name} (Réf ${part.oemRef}). Pièce disponible immédiatement en stock magasin (${part.shelfLocation}).`
    );
  };

  const handleConfirmSendQuote = () => {
    if (!selectedPart) return;
    const target = workshopTargets.find((t) => t.key === selectedVehicleKey) || workshopTargets[0];
    if (!target) {
      showToast('Aucun véhicule actif sélectionné.');
      return;
    }

    const requiresOrder = selectedPart.stockCount === 0;
    const created = workshopSyncService.sendTechQuote({
      orId: target.orId,
      vehicle: target.vehicleName,
      plate: target.plate,
      bay: target.bay,
      clientId: target.clientId,
      clientName: target.clientName,
      clientEmail: target.clientEmail,
      clientPhone: target.clientPhone,
      part: selectedPart,
      description: quoteJustification.trim() || selectedPart.description,
      laborPrice: customLabor,
      requiresPartOrder: requiresOrder,
      estimatedDeliveryDelay: requiresOrder ? deliveryDelay : undefined,
      setWaitingPartsImmediately: requiresOrder ? setWaitingImmediately : false,
    });

    if (onUpdateQuote) {
      onUpdateQuote(created);
    }

    showToast(
      requiresOrder
        ? `Devis avec commande pièce envoyé à ${target.clientName} (${target.plate}). Véhicule placé en état « En attente pièce ».`
        : `Pièce ${selectedPart.oemRef} réservée et devis envoyé dans Assistance & Devis de ${target.clientName}.`
    );
    setSelectedPart(null);
    setActiveTab('quotes');
  };

  const handleConfirmWithStockTeam = (q: AdditionalQuote) => {
    const updated = workshopSyncService.confirmWithStockTeamByTech(q.id);
    if (updated) {
      if (onUpdateQuote && updated.id === currentQuote.id) {
        onUpdateQuote(updated);
      }
      showToast(
        updated.status === 'accepted'
          ? `Confirmation transmise à l'équipe Stock pour ${updated.plate}. Statut véhicule : « En attente pièce » jusqu'à réception validée par le Chef.`
          : `Demande coordonnée avec l'équipe Stock pour ${updated.plate}.`
      );
    }
  };

  const filteredParts = useMemo(() => {
    if (selectedCategory === 'all') return partsStock;
    return partsStock.filter((p) => p.category === selectedCategory);
  }, [partsStock, selectedCategory]);

  const totalStockCount = useMemo(
    () => partsStock.reduce((acc, p) => acc + p.stockCount, 0),
    [partsStock]
  );

  const availableRefRatio = useMemo(() => {
    if (partsStock.length === 0) return 0;
    const inStockCount = partsStock.filter((p) => p.inStock).length;
    return Math.round((inStockCount / partsStock.length) * 100);
  }, [partsStock]);

  const pendingClientCount = useMemo(
    () => quotes.filter((q) => q.status === 'pending').length,
    [quotes]
  );

  const waitingStockConfirmationCount = useMemo(
    () =>
      quotes.filter(
        (q) => q.status === 'accepted' && (!q.techStockConfirmed || !q.chefDeliveryConfirmed)
      ).length,
    [quotes]
  );

  return (
    <div className="w-full flex flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-[1720px] mx-auto">
      {/* Toast Alert */}
      {toastMessage && (
        <div className="fixed top-20 right-8 z-50 bg-[#05141f] text-white p-4 rounded-xl shadow-2xl flex items-center gap-3 border border-secondary max-w-md">
          <span className="material-symbols-outlined text-secondary">inventory_2</span>
          <div>
            <p className="font-bold text-sm">Magasin & Devis K-DMS</p>
            <p className="text-xs text-slate-300">{toastMessage}</p>
          </div>
        </div>
      )}

      {/* Header & Subtitle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-label-sm text-xs text-secondary uppercase font-bold tracking-wider">
              K-DMS · Magasin Central City Cars
            </span>
            <span className="text-outline-variant font-label-sm">·</span>
            <span className="font-label-sm text-xs text-on-surface-variant font-mono">
              Vérification Stock, Commande Pièce & Devis Client
            </span>
          </div>
          <h1 className="font-headline-lg text-2xl sm:text-3xl text-on-surface font-bold tracking-tight">
            Demande Pièces & Devis Complémentaires
          </h1>
          <p className="font-body-md text-xs sm:text-sm text-on-surface-variant">
            Vérifiez la disponibilité en stock, envoyez un devis (pièce dispo ou commande avec attente livraison) et confirmez avec l'équipe stock après retour du client.
          </p>
        </div>

        {/* 2 Tabs Switcher */}
        <div className="inline-flex bg-surface-container-low p-1.5 rounded-2xl shadow-sm border border-surface-container-high self-start md:self-auto">
          <button
            onClick={() => setActiveTab('stock')}
            className={`px-4 py-2 rounded-xl font-label-md text-xs sm:text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'stock'
                ? 'bg-secondary text-on-secondary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
            type="button"
          >
            <span className="material-symbols-outlined text-base">inventory</span>
            <span>Stock Magasin ({partsStock.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('quotes')}
            className={`px-4 py-2 rounded-xl font-label-md text-xs sm:text-sm font-bold transition-all flex items-center gap-2 whitespace-nowrap shrink-0 ${
              activeTab === 'quotes'
                ? 'bg-secondary text-on-secondary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
            type="button"
          >
            <span className="material-symbols-outlined text-base">request_quote</span>
            <span>Devis & Suivi Stock ({quotes.length})</span>
          </button>
        </div>
      </div>

      {/* KPI Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-container-lowest p-4 rounded-2xl shadow-sm border border-surface-container-high flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
              Disponibilité Immédiate
            </span>
            <span className="material-symbols-outlined text-emerald-600 text-lg">verified</span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="font-headline-xl text-3xl font-bold text-on-surface tabular-nums">
              {availableRefRatio}%
            </span>
            <span className="font-label-sm text-xs text-on-surface-variant">des références</span>
          </div>
          <span className="font-label-sm text-[10px] text-on-surface-variant mt-2">
            {partsStock.filter((p) => p.stockCount === 0).length} référence(s) en rupture / sur commande
          </span>
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-2xl shadow-sm border border-surface-container-high flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
              Total Pièces en Rayon
            </span>
            <span className="material-symbols-outlined text-primary text-lg">shelves</span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="font-headline-xl text-3xl font-bold text-on-surface font-mono tabular-nums">
              {totalStockCount}
            </span>
            <span className="font-label-sm text-xs text-on-surface-variant">unités physiques</span>
          </div>
          <span className="font-label-sm text-[10px] text-on-surface-variant mt-2">
            Inventaire certifié Kia Mobis
          </span>
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-2xl shadow-sm border border-surface-container-high flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
              Devis en Attente Client
            </span>
            <span className="material-symbols-outlined text-secondary text-lg">hourglass_top</span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="font-headline-xl text-3xl font-bold text-secondary tabular-nums">
              {pendingClientCount}
            </span>
            <span className="font-label-sm text-xs text-on-surface-variant">dossiers</span>
          </div>
          <span className="font-label-sm text-[10px] text-on-surface-variant mt-2">
            Notifiés dans Assistance & Devis client
          </span>
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-2xl shadow-sm border border-surface-container-high flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-[10px] text-on-surface-variant uppercase tracking-wider font-semibold">
              Coordination Stock / Attente Pièce
            </span>
            <span className="material-symbols-outlined text-amber-600 text-lg">local_shipping</span>
          </div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="font-headline-xl text-3xl font-bold text-amber-700 tabular-nums">
              {waitingStockConfirmationCount}
            </span>
            <span className="font-label-sm text-xs text-on-surface-variant">dossiers actifs</span>
          </div>
          <span className="font-label-sm text-[10px] text-on-surface-variant mt-2">
            Confirmés client · Suivi équipe Stock & Chef
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ONGLET 1 : STOCK MAGASIN PIÈCES                                          */}
      {/* ========================================================================= */}
      {activeTab === 'stock' && (
        <div className="flex flex-col gap-6">
          <div className="bg-surface-container-lowest p-3.5 rounded-2xl shadow-sm border border-surface-container-high flex flex-col gap-2">
            <div className="flex items-center justify-between pb-2 border-b border-surface-container-high">
              <span className="font-label-sm text-xs uppercase text-on-surface-variant font-bold tracking-wider">
                Filtrer par Catégorie de Pièces
              </span>
              <span className="font-label-sm text-xs text-on-surface-variant font-mono">
                {filteredParts.length} référence{filteredParts.length > 1 ? 's' : ''} affichée
                {filteredParts.length > 1 ? 's' : ''}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {PART_CATEGORIES.map((cat) => {
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-3.5 py-2 rounded-xl font-label-md text-xs font-semibold transition-all flex items-center gap-2 shadow-sm whitespace-nowrap shrink-0 ${
                      isSelected
                        ? 'bg-primary text-on-primary font-bold shadow-md'
                        : 'bg-surface-container-low text-on-surface hover:bg-surface-container border border-surface-container-high'
                    }`}
                    type="button"
                  >
                    <span className="material-symbols-outlined text-sm">{cat.icon}</span>
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {filteredParts.map((part) => {
              const effectiveThreshold = Math.max(part.minThreshold, settings.lowStockThreshold || 0);
              const isLowStock = part.stockCount > 0 && part.stockCount <= effectiveThreshold;
              const isOutOfStock = part.stockCount === 0;

              return (
                <div
                  key={part.id}
                  className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm border border-surface-container-high flex flex-col justify-between gap-4 hover:border-secondary transition-all group"
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col">
                        <span className="font-label-sm text-[11px] text-on-surface-variant uppercase font-semibold">
                          {part.categoryLabel}
                        </span>
                        <h3 className="font-headline-sm text-base font-bold text-on-surface leading-snug group-hover:text-secondary transition-colors">
                          {part.name}
                        </h3>
                      </div>

                      <div className="text-right shrink-0">
                        {isOutOfStock ? (
                          <span className="font-label-sm text-[11px] font-bold text-rose-800 bg-rose-100 px-2.5 py-1 rounded-lg block whitespace-nowrap">
                            Indisponible · À commander
                          </span>
                        ) : isLowStock ? (
                          <span className="font-label-sm text-[11px] font-bold text-amber-800 bg-amber-100 px-2.5 py-1 rounded-lg block whitespace-nowrap">
                            Stock Faible ({part.stockCount} restants)
                          </span>
                        ) : (
                          <span className="font-label-sm text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded-lg block whitespace-nowrap">
                            En Stock ({part.stockCount} dispo)
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="p-3 bg-surface-container-low rounded-xl border border-surface-container-high flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-on-surface-variant font-label-sm text-[11px]">Réf Constructeur :</span>
                        <span className="font-mono font-bold text-primary tracking-wider bg-surface-container px-2 py-0.5 rounded">
                          {part.oemRef}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-on-surface-variant font-label-sm text-[11px]">Emplacement Rayon :</span>
                        <span className="font-mono text-secondary font-bold text-[11px] flex items-center gap-1">
                          <span className="material-symbols-outlined text-xs">location_on</span>
                          {part.shelfLocation}
                        </span>
                      </div>
                    </div>

                    <p className="font-body-sm text-xs text-on-surface-variant line-clamp-2 leading-relaxed">
                      {part.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-1 text-[11px] text-on-surface-variant">
                      <span className="font-semibold text-on-surface">Compatibilité :</span>
                      {part.compatibleModels.map((model, idx) => (
                        <span key={idx} className="bg-surface-container px-2 py-0.5 rounded font-mono text-[10px]">
                          {model}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-surface-container flex items-center justify-between gap-3">
                    <div className="flex flex-col">
                      <span className="font-label-sm text-[10px] text-on-surface-variant uppercase">Tarif Pièce TTC</span>
                      <span className="font-headline-sm text-lg font-bold text-on-surface font-mono tabular-nums">
                        {part.unitPriceTND.toFixed(3)} TND
                      </span>
                      <span className="font-label-sm text-[10px] text-secondary">
                        Pose : ~ {part.laborTimeHours}h de M.O.
                      </span>
                    </div>

                    {isOutOfStock ? (
                      <button
                        onClick={() => openPartQuoteModal(part)}
                        className="px-3.5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-label-md text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 whitespace-nowrap shrink-0"
                        type="button"
                      >
                        <span className="material-symbols-outlined text-sm">schedule_send</span>
                        <span>Commander & Envoyer Devis</span>
                      </button>
                    ) : (
                      <button
                        onClick={() => openPartQuoteModal(part)}
                        className="px-3.5 py-2.5 rounded-xl bg-secondary hover:bg-secondary-container text-on-secondary font-label-md text-xs font-bold transition-all shadow-md active:scale-95 flex items-center gap-1.5 whitespace-nowrap shrink-0"
                        type="button"
                      >
                        <span className="material-symbols-outlined text-sm">add_shopping_cart</span>
                        <span>Réserver & Envoyer Devis</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ONGLET 2 : DEVIS & SUIVI STOCK / ATTENTE PIÈCE                           */}
      {/* ========================================================================= */}
      {activeTab === 'quotes' && (
        <div className="flex flex-col gap-5">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="font-headline-sm text-base font-bold text-on-surface">
              Dossiers Devis, Réponses Client & Coordination Équipe Stock
            </span>
            <span className="font-label-sm text-xs text-on-surface-variant font-mono">
              {quotes.length} dossier{quotes.length > 1 ? 's' : ''} synchronisé{quotes.length > 1 ? 's' : ''} Firestore
            </span>
          </div>

          <div className="flex flex-col gap-4">
            {quotes.map((dossier) => {
              const waitState = workshopSyncService.isVehicleWaitingParts(dossier.plate, dossier.orId);
              const isOut = dossier.requiresPartOrder || dossier.partAvailability === 'out_of_stock';

              return (
                <div
                  key={dossier.id}
                  className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm border border-surface-container-high flex flex-col gap-4"
                >
                  {/* Header row */}
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-surface-container-high">
                    <div className="flex items-start gap-3">
                      <div className="p-2.5 rounded-xl bg-secondary-fixed text-on-secondary-fixed shrink-0">
                        <span className="material-symbols-outlined text-xl">directions_car</span>
                      </div>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-headline-sm text-base font-bold text-on-surface">
                            {dossier.vehicle}
                          </span>
                          <span className="font-label-sm text-xs bg-primary text-on-primary px-2 py-0.5 rounded font-mono font-bold tracking-wider">
                            {dossier.plate}
                          </span>
                          {dossier.orId && (
                            <span className="font-mono text-xs text-on-surface-variant font-semibold">
                              {dossier.orId}
                            </span>
                          )}
                          {dossier.bay && (
                            <span className="font-label-sm text-xs text-secondary font-semibold">
                              ({dossier.bay})
                            </span>
                          )}
                        </div>
                        <span className="font-body-sm text-xs text-on-surface-variant block mt-0.5">
                          Client : <strong className="text-on-surface">{dossier.clientName || 'Client Kia'}</strong> · Émis à {dossier.issuedTime} par {dossier.issuedBy}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 self-start lg:self-center">
                      {waitState.waiting && (
                        <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 font-label-sm text-xs font-bold flex items-center gap-1 whitespace-nowrap shrink-0">
                          <span className="material-symbols-outlined text-sm">hourglass_empty</span>
                          <span>En attente pièce</span>
                        </span>
                      )}

                      <span
                        className={`font-label-sm text-xs px-3 py-1 rounded-lg font-bold whitespace-nowrap shrink-0 ${
                          dossier.status === 'accepted'
                            ? 'bg-emerald-100 text-emerald-800'
                            : dossier.status === 'refused'
                            ? 'bg-rose-100 text-rose-800'
                            : 'bg-secondary-fixed text-on-secondary-fixed'
                        }`}
                      >
                        {dossier.status === 'accepted'
                          ? `Accepté par le client${dossier.respondedAt ? ` (${dossier.respondedAt})` : ''}`
                          : dossier.status === 'refused'
                          ? 'Refusé par le client'
                          : 'En attente accord client'}
                      </span>

                      <span className="font-headline-sm text-lg font-bold text-secondary font-mono tabular-nums ml-1">
                        {dossier.totalPrice.toFixed(3)} TND TTC
                      </span>
                    </div>
                  </div>

                  {/* Disponibilité stock / commande + Justification tech */}
                  <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
                    <div className="lg:col-span-7 p-3.5 rounded-xl bg-surface-container-low border border-surface-container-high flex flex-col gap-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="font-label-sm text-xs font-bold text-on-surface">{dossier.title}</span>
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded whitespace-nowrap ${
                            dossier.chefDeliveryConfirmed
                              ? 'bg-emerald-100 text-emerald-800'
                              : isOut
                              ? 'bg-amber-100 text-amber-900'
                              : 'bg-emerald-50 text-emerald-800'
                          }`}
                        >
                          {dossier.chefDeliveryConfirmed
                            ? `Pièce livrée & validée par le Chef (${dossier.chefDeliveryConfirmedAt || 'confirmé'})`
                            : isOut
                            ? `Hors stock · Commande requise (${dossier.estimatedDeliveryDelay || 'Délai fournisseur'})`
                            : 'Disponible en stock magasin'}
                        </span>
                      </div>
                      <p className="text-xs text-on-surface-variant leading-relaxed">{dossier.description}</p>

                      {dossier.parts && dossier.parts.length > 0 && (
                        <div className="flex flex-col gap-1.5 pt-2 border-t border-surface-container-high">
                          {dossier.parts.map((p, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-xs bg-surface-container-lowest p-2 rounded-lg border border-surface-container-high"
                            >
                              <div className="min-w-0">
                                <span className="font-semibold text-on-surface block truncate">{p.name}</span>
                                <span className="font-mono text-[11px] text-on-surface-variant">
                                  Réf : {p.oemRef} · {p.shelfLocation}
                                </span>
                              </div>
                              <span className="font-mono font-bold text-on-surface shrink-0 ml-2">
                                {p.unitPrice.toFixed(3)} TND
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Retour Client & Avis écrit */}
                    <div className="lg:col-span-5 p-3.5 rounded-xl bg-surface-container-low border border-surface-container-high flex flex-col justify-between gap-2.5">
                      <div>
                        <span className="font-label-sm text-[11px] uppercase tracking-wider font-bold text-on-surface-variant block mb-1">
                          Réponse & Avis du Client (via Assistance & Devis)
                        </span>
                        {dossier.clientComment ? (
                          <div className="p-2.5 rounded-lg bg-surface-container-lowest border border-surface-container-high text-xs text-on-surface italic">
                            « {dossier.clientComment} »
                          </div>
                        ) : (
                          <p className="text-xs text-on-surface-variant">
                            {dossier.status === 'pending'
                              ? 'En attente de la décision et du commentaire du client dans Assistance & Devis.'
                              : 'Aucun commentaire additionnel laissé par le client.'}
                          </p>
                        )}
                      </div>

                      {/* Statut Stock & Chef */}
                      <div className="flex flex-col gap-1.5 pt-2 border-t border-surface-container-high text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-on-surface-variant">Équipe Stock :</span>
                          <span
                            className={`font-semibold ${
                              dossier.techStockConfirmed ? 'text-emerald-700' : 'text-on-surface-variant'
                            }`}
                          >
                            {dossier.techStockConfirmed
                              ? `Confirmé (${dossier.techStockConfirmedAt || 'OK'})`
                              : 'Non confirmé'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-on-surface-variant">Réception Pièce (Chef d'Atelier) :</span>
                          <span
                            className={`font-semibold ${
                              dossier.chefDeliveryConfirmed ? 'text-emerald-700' : 'text-amber-700'
                            }`}
                          >
                            {dossier.chefDeliveryConfirmed
                              ? `Reçue en stock (${dossier.chefDeliveryConfirmedAt || 'Validé'})`
                              : 'Validation Chef attendue'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions Tech */}
                  <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {dossier.status !== 'refused' && !dossier.techStockConfirmed && (
                        <button
                          onClick={() => handleConfirmWithStockTeam(dossier)}
                          className="px-4 py-2 bg-primary hover:bg-[#1a2a38] text-on-primary rounded-xl font-label-md text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 whitespace-nowrap shrink-0"
                          type="button"
                        >
                          <span className="material-symbols-outlined text-sm">local_shipping</span>
                          <span>Confirmer avec Équipe Stock & Mettre en Attente Pièce</span>
                        </button>
                      )}

                      {dossier.techStockConfirmed && !dossier.chefDeliveryConfirmed && (
                        <span className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-sm text-amber-700">schedule</span>
                          <span>Équipe Stock prévenue · En attente validation arrivée pièce par le Chef d'Atelier</span>
                        </span>
                      )}

                      {dossier.status === 'pending' && (
                        <button
                          onClick={() =>
                            showToast(
                              `Rappel envoyé dans Assistance & Devis du client ${dossier.clientName || dossier.plate}.`
                            )
                          }
                          className="px-3.5 py-2 bg-surface-container hover:bg-surface-container-high text-on-surface rounded-xl font-label-md text-xs font-semibold transition-all border border-surface-container-high flex items-center gap-1.5 whitespace-nowrap shrink-0"
                          type="button"
                        >
                          <span className="material-symbols-outlined text-sm">notifications_active</span>
                          <span>Relancer Client</span>
                        </button>
                      )}
                    </div>

                    {onNavigateToActive && (
                      <button
                        onClick={onNavigateToActive}
                        className="px-3.5 py-2 text-secondary hover:text-on-surface font-label-md text-xs font-bold transition-colors flex items-center gap-1 whitespace-nowrap shrink-0"
                        type="button"
                      >
                        <span>Ouvrir Intervention Active</span>
                        <span className="material-symbols-outlined text-sm">arrow_forward</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE RÉSERVATION / COMMANDE & ENVOI DE DEVIS AU CLIENT                */}
      {/* ========================================================================= */}
      {selectedPart && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-container-lowest max-w-xl w-full rounded-3xl p-6 shadow-2xl border border-surface-container-high flex flex-col gap-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-surface-container-high">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    selectedPart.stockCount === 0
                      ? 'bg-amber-100 text-amber-800'
                      : 'bg-secondary-fixed text-on-secondary-fixed'
                  }`}
                >
                  <span className="material-symbols-outlined text-xl">
                    {selectedPart.stockCount === 0 ? 'schedule_send' : 'inventory_2'}
                  </span>
                </div>
                <div>
                  <h3 className="font-headline-sm text-base font-bold text-on-surface">
                    {selectedPart.stockCount === 0
                      ? 'Pièce Indisponible — Envoyer Devis avec Commande'
                      : 'Pièce En Stock — Réserver & Envoyer Devis Client'}
                  </h3>
                  <span className="font-label-sm text-xs text-on-surface-variant font-mono">
                    Réf OEM : {selectedPart.oemRef} · {selectedPart.name}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedPart(null)}
                className="p-1.5 rounded-lg text-on-surface-variant hover:bg-surface-container"
                type="button"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Part Summary */}
            <div className="p-3.5 bg-surface-container-low rounded-2xl border border-surface-container-high flex flex-col gap-1.5 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-on-surface">{selectedPart.name}</span>
                {selectedPart.stockCount === 0 ? (
                  <span className="font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded">
                    Stock : 0 (Commande requise)
                  </span>
                ) : (
                  <span className="font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                    {selectedPart.stockCount} disponible(s) en rayon
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between text-on-surface-variant font-mono">
                <span>Emplacement : {selectedPart.shelfLocation}</span>
                <span className="font-bold text-secondary">
                  Pièce : {selectedPart.unitPriceTND.toFixed(3)} TND
                </span>
              </div>
            </div>

            {/* Target Vehicle Selection */}
            <div className="flex flex-col gap-2">
              <label className="font-label-sm text-xs font-bold text-on-surface uppercase tracking-wider">
                Véhicule concerné en atelier / rendez-vous :
              </label>
              <div className="flex flex-col gap-2 max-h-44 overflow-y-auto pr-1">
                {workshopTargets.map((target) => (
                  <label
                    key={target.key}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${
                      selectedVehicleKey === target.key
                        ? 'border-secondary bg-secondary/5'
                        : 'border-surface-container-high bg-surface-container-low hover:border-secondary/60'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <input
                        type="radio"
                        name="vehicleChoice"
                        value={target.key}
                        checked={selectedVehicleKey === target.key}
                        onChange={() => setSelectedVehicleKey(target.key)}
                        className="accent-secondary w-4 h-4 shrink-0"
                      />
                      <div className="min-w-0">
                        <span className="font-bold text-xs text-on-surface block truncate">
                          {target.vehicleName} ({target.plate})
                        </span>
                        <span className="text-[11px] text-on-surface-variant block truncate">
                          {target.orId} · Client : {target.clientName} · {target.bay}
                        </span>
                      </div>
                    </div>
                    <span className="font-label-sm text-[10px] bg-surface-container px-2 py-0.5 rounded font-bold shrink-0 ml-2">
                      {target.badge}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Delivery Delay if Out of Stock */}
            {selectedPart.stockCount === 0 && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex flex-col gap-2.5">
                <div className="flex items-center gap-2 text-amber-900 text-xs font-bold">
                  <span className="material-symbols-outlined text-base text-amber-700">local_shipping</span>
                  <span>Pièce hors stock : Délai estimé de livraison fournisseur</span>
                </div>
                <select
                  value={deliveryDelay}
                  onChange={(e) => setDeliveryDelay(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-amber-300 text-xs font-semibold text-on-surface focus:outline-none"
                >
                  {DELIVERY_DELAY_PRESETS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-xs text-amber-950 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={setWaitingImmediately}
                    onChange={(e) => setSetWaitingImmediately(e.target.checked)}
                    className="accent-amber-700 w-4 h-4"
                  />
                  <span>
                    Mettre immédiatement l'état du véhicule à <strong>« En attente pièce »</strong>
                  </span>
                </label>
              </div>
            )}

            {/* Justification & Labor */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 flex flex-col gap-1">
                <label className="font-label-sm text-xs font-bold text-on-surface">
                  Message & Justification technique envoyée au client :
                </label>
                <textarea
                  rows={3}
                  value={quoteJustification}
                  onChange={(e) => setQuoteJustification(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface focus:outline-none focus:ring-2 focus:ring-secondary/40 resize-none"
                />
              </div>

              <div className="flex flex-col gap-1 justify-between bg-surface-container-low p-3 rounded-xl border border-surface-container-high">
                <div>
                  <label className="font-label-sm text-[11px] font-bold text-on-surface block mb-1">
                    Main d'œuvre (TND)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step={5}
                    value={customLabor}
                    onChange={(e) => setCustomLabor(Number(e.target.value) || 0)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-surface-container-high font-mono text-xs font-bold text-on-surface"
                  />
                </div>
                <div className="pt-2 border-t border-surface-container-high">
                  <span className="text-[10px] text-on-surface-variant block">Total Devis TTC</span>
                  <span className="font-mono text-base font-bold text-secondary tabular-nums">
                    {(selectedPart.unitPriceTND + customLabor).toFixed(3)} TND
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-3 pt-2 border-t border-surface-container-high">
              <button
                onClick={() => setSelectedPart(null)}
                className="px-4 py-2.5 rounded-xl text-on-surface-variant hover:bg-surface-container text-xs font-semibold"
                type="button"
              >
                Annuler
              </button>
              <button
                onClick={handleConfirmSendQuote}
                className="px-5 py-2.5 rounded-xl bg-secondary hover:bg-secondary-container text-on-secondary text-xs font-bold shadow-md transition-all active:scale-95 flex items-center gap-1.5"
                type="button"
              >
                <span className="material-symbols-outlined text-sm">send</span>
                <span>
                  {selectedPart.stockCount === 0
                    ? 'Envoyer Devis Attente Livraison'
                    : 'Réserver & Envoyer Devis Client'}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
