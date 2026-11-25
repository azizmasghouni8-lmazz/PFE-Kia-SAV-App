import { useState, useEffect, useMemo } from 'react';
import { workshopSyncService, WorkshopLiveProgress } from '../../services/workshopSyncService';
import { ServiceHistoryItem } from '../../types';

interface ChefRestitutionModuleProps {
  onOpenPdfPreview?: (item: ServiceHistoryItem) => void;
  onNavigateToPlanning?: () => void;
}

export function ChefRestitutionModule({ onOpenPdfPreview, onNavigateToPlanning }: ChefRestitutionModuleProps) {
  const [liveProgress, setLiveProgress] = useState<WorkshopLiveProgress | null>(() =>
    workshopSyncService.getLiveProgress()
  );
  const [paidSnapshot, setPaidSnapshot] = useState<WorkshopLiveProgress | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<'Carte Bancaire' | 'Espèces' | 'Chèque Certifié'>('Carte Bancaire');
  const [quoteTick, setQuoteTick] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Synchronisation en direct avec le service de l'atelier (travaux + devis + planning)
  useEffect(() => {
    const checkStatus = () => {
      const current = workshopSyncService.getLiveProgress();
      if (current) {
        setLiveProgress(current);
        setPaidSnapshot(null);
      } else if (!paidSnapshot) {
        setLiveProgress(null);
      }
      setQuoteTick((t) => t + 1);
    };
    const refreshQuotes = () => setQuoteTick((t) => t + 1);
    window.addEventListener('k_dms_quotes_updated', refreshQuotes);
    window.addEventListener('k_dms_planning_updated', refreshQuotes);
    window.addEventListener('k_dms_live_updated', checkStatus);
    const interval = setInterval(checkStatus, 1500);
    return () => {
      window.removeEventListener('k_dms_quotes_updated', refreshQuotes);
      window.removeEventListener('k_dms_planning_updated', refreshQuotes);
      window.removeEventListener('k_dms_live_updated', checkStatus);
      clearInterval(interval);
    };
  }, [paidSnapshot]);

  const activeDisplay = paidSnapshot || liveProgress;
  const isReadyForRestitution = activeDisplay?.status === 'ready_for_restitution';
  const isPaid = activeDisplay?.status === 'completed_and_paid';

  const billingSummary = useMemo(
    () => workshopSyncService.getRestitutionBillingSummary(activeDisplay),
    [activeDisplay, quoteTick]
  );

  const amountTnd = billingSummary.formattedTotal;

  const handleProcessPayment = () => {
    setIsProcessing(true);
    setTimeout(() => {
      const updated = workshopSyncService.completePaymentAndRestitution({
        method: selectedMethod,
        amount: `${amountTnd} TND`,
      });
      setPaidSnapshot(updated);
      setLiveProgress(updated);
      setIsProcessing(false);
      setShowSuccessModal(true);
    }, 700);
  };

  return (
    <div className="p-6 sm:p-8 max-w-[1720px] mx-auto flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-label-sm text-xs text-secondary uppercase font-bold tracking-wider">
              Poste Contrôle Final & Caisse SAV
            </span>
            {isReadyForRestitution && (
              <span className="px-2.5 py-0.5 rounded-full bg-secondary text-white text-[10px] font-bold uppercase animate-pulse">
                Check-Out & Règlement en Attente
              </span>
            )}
            {isPaid && (
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase">
                Check-Out Effectué · RDV Clôturé du Planning
              </span>
            )}
          </div>
          <h1 className="font-headline-md text-2xl sm:text-3xl font-black text-on-surface tracking-tight mt-1">
            Restitution, Check-Out & Sortie d'Atelier
          </h1>
          <p className="font-body-sm text-xs sm:text-sm text-on-surface-variant mt-0.5">
            Validation de la conformité des travaux, encaissement de la facture, remise des clés et clôture définitive du rendez-vous dans le planning d'atelier.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {onNavigateToPlanning && (
            <button
              onClick={onNavigateToPlanning}
              type="button"
              className="px-3.5 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-label-md text-xs font-semibold flex items-center gap-1.5 border border-surface-container-high transition-colors"
            >
              <span className="material-symbols-outlined text-sm">grid_view</span>
              <span>Voir Planning & Dashboard</span>
            </button>
          )}

          <div className="px-3.5 py-2 rounded-xl bg-surface-container-low border border-surface-container-high flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-base">point_of_sale</span>
            <span className="font-mono text-xs font-bold text-on-surface">Caisse Centrale N°1 • TPE Connecté</span>
          </div>
        </div>
      </div>

      {/* Main Restitution Card for Active Order */}
      {activeDisplay ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Vehicle, Client & Service Summary (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-5">
            {/* Alert banner if ready for restitution */}
            {isReadyForRestitution && (
              <div className="p-4 rounded-2xl bg-secondary/10 border-2 border-secondary flex items-start gap-3.5 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-secondary text-white flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl">notifications_active</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="font-headline-sm text-sm font-bold text-on-surface">
                    Notification Technicien : Travaux 100% Terminés !
                  </span>
                  <p className="font-body-sm text-xs text-on-surface-variant">
                    {activeDisplay.technicianName} ({activeDisplay.bay}) vient de clôturer l'ordre de réparation.
                    Le contrôle qualité dynamique et le lavage offert ont été validés avec succès. Le client attend la remise des clés.
                  </p>
                </div>
              </div>
            )}

            {isPaid && (
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 flex items-start gap-3.5 shadow-sm">
                <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-2xl">task_alt</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="font-headline-sm text-sm font-bold text-emerald-950">
                    Restitution et Règlement Confirmés
                  </span>
                  <p className="font-body-sm text-xs text-emerald-800">
                    Paiement acquitté de {activeDisplay.invoiceAmount} par {activeDisplay.paymentMethod} le {activeDisplay.paidAt}.
                    Le suivi en direct a été archivé automatiquement dans le carnet d'entretien numérique du client (Firestore).
                  </p>
                </div>
              </div>
            )}

            {/* Vehicle & Client Details Card */}
            <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border border-surface-container-high flex flex-col gap-5">
              <div className="flex items-start justify-between gap-4 border-b border-surface-container-high pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-secondary shrink-0">
                    <span className="material-symbols-outlined text-2xl">directions_car</span>
                  </div>
                  <div>
                    <span className="font-label-sm text-xs text-secondary font-bold uppercase">
                      Dossier Ordre de Réparation {activeDisplay.orderId}
                    </span>
                    <h2 className="font-headline-sm text-lg font-bold text-on-surface">
                      {activeDisplay.vehicleName}
                    </h2>
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-surface-container-high text-on-surface font-bold tracking-wider">
                      {activeDisplay.plate}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-label-sm text-[11px] text-on-surface-variant block">Client Propriétaire</span>
                  <span className="font-headline-sm text-sm font-bold text-on-surface block">
                    {activeDisplay.clientName}
                  </span>
                  <span className="font-label-sm text-xs text-emerald-700 font-semibold flex items-center justify-end gap-1 mt-0.5">
                    <span className="material-symbols-outlined text-xs">verified</span>
                    Client Présent à l'Accueil
                  </span>
                </div>
              </div>

              {/* Intervention Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container-high flex flex-col gap-1">
                  <span className="font-label-sm text-[11px] text-on-surface-variant uppercase font-semibold">
                    Prestation Réalisée
                  </span>
                  <span className="font-body-sm text-xs font-bold text-on-surface">
                    {activeDisplay.serviceTitle}
                  </span>
                  <span className="font-label-sm text-[11px] text-on-surface-variant">
                    75 points de contrôle Kia homologués
                  </span>
                </div>

                <div className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container-high flex flex-col gap-1">
                  <span className="font-label-sm text-[11px] text-on-surface-variant uppercase font-semibold">
                    Intervenant & Poste
                  </span>
                  <span className="font-body-sm text-xs font-bold text-on-surface">
                    {activeDisplay.technicianName} ({activeDisplay.technicianRole})
                  </span>
                  <span className="font-label-sm text-[11px] text-on-surface-variant">
                    {activeDisplay.bay} • Durée : {activeDisplay.estimatedDuration}
                  </span>
                </div>
              </div>

              {/* Checklist & Quality Approval status */}
              <div className="flex flex-col gap-2.5 pt-2">
                <span className="font-label-sm text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                  Points de Contrôle & Visa Technique
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 text-emerald-950 text-xs">
                    <span className="material-symbols-outlined text-emerald-700 text-base">check_circle</span>
                    <span className="font-semibold">Diagnostic valise KDS : 0 Défaut</span>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 text-emerald-950 text-xs">
                    <span className="material-symbols-outlined text-emerald-700 text-base">check_circle</span>
                    <span className="font-semibold">Couples de serrage conformes</span>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 text-emerald-950 text-xs">
                    <span className="material-symbols-outlined text-emerald-700 text-base">check_circle</span>
                    <span className="font-semibold">Essai routier dynamique validé</span>
                  </div>
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-emerald-50/70 border border-emerald-200 text-emerald-950 text-xs">
                    <span className="material-symbols-outlined text-emerald-700 text-base">check_circle</span>
                    <span className="font-semibold">Lavage finition offert effectué</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Payment & Handover Actions (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-5">
            <div className="bg-surface-container-lowest p-6 rounded-2xl shadow-sm border-2 border-surface-container-high flex flex-col gap-5">
              <div>
                <span className="font-label-sm text-xs text-secondary font-bold uppercase tracking-wider">
                  Facturation & Règlement
                </span>
                <h3 className="font-headline-sm text-lg font-bold text-on-surface mt-0.5">
                  Quittance de Paiement SAV
                </h3>
              </div>

              {/* Détail Entretien + Devis Pièces Confirmés */}
              <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container-high flex flex-col gap-3">
                <div className="flex flex-col gap-2 text-xs pb-3 border-b border-surface-container-high">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-on-surface-variant font-medium">
                      Prix de l'entretien ({billingSummary.maintenanceLabel})
                    </span>
                    <span className="font-mono font-bold text-on-surface shrink-0">
                      {billingSummary.maintenancePrice.toFixed(3)} TND
                    </span>
                  </div>

                  {billingSummary.confirmedQuotes.length > 0 ? (
                    <div className="flex flex-col gap-1.5 pt-1">
                      <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">check_circle</span>
                        Pièce(s) & Devis Confirmé(s) par le Client ({billingSummary.confirmedQuotes.length})
                      </span>
                      {billingSummary.confirmedQuotes.map((q) => (
                        <div
                          key={q.id}
                          className="flex items-start justify-between gap-2 pl-2 border-l-2 border-emerald-500 py-0.5"
                        >
                          <div className="flex flex-col min-w-0">
                            <span className="font-semibold text-on-surface truncate">{q.title}</span>
                            <span className="text-[11px] text-on-surface-variant">
                              Pièce : {q.partsPrice.toFixed(3)} TND + M.O : {q.laborPrice.toFixed(3)} TND
                            </span>
                          </div>
                          <span className="font-mono font-bold text-emerald-700 shrink-0">
                            + {q.totalPrice.toFixed(3)} TND
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2 text-[11px] text-on-surface-variant">
                      <span>Devis pièce complémentaire confirmé</span>
                      <span className="font-mono">0.000 TND</span>
                    </div>
                  )}

                  {billingSummary.pendingQuotesCount > 0 && (
                    <div className="mt-1 px-2.5 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-amber-700 shrink-0">hourglass_top</span>
                      <span>
                        {billingSummary.pendingQuotesCount} devis pièce en attente de confirmation client (non inclus dans le total).
                      </span>
                    </div>
                  )}
                </div>

                {/* Amount Display */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-label-sm text-xs text-on-surface font-bold block">Montant Total Net TTC</span>
                    <span className="font-body-sm text-[11px] text-on-surface-variant">
                      {billingSummary.confirmedQuotes.length > 0
                        ? 'Entretien + Devis pièce(s) confirmé(s)'
                        : "Pièces d'origine & Main d'œuvre incluses"}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-headline-lg text-2xl font-black text-secondary font-mono">
                      {amountTnd}
                    </span>
                    <span className="font-headline-sm text-sm font-bold text-secondary font-mono ml-1">TND</span>
                  </div>
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="flex flex-col gap-2">
                <label className="font-label-sm text-xs font-bold text-on-surface uppercase tracking-wider">
                  Mode d'Encaissement
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Carte Bancaire', 'Espèces', 'Chèque Certifié'] as const).map((method) => (
                    <button
                      key={method}
                      type="button"
                      disabled={isPaid}
                      onClick={() => setSelectedMethod(method)}
                      className={`p-3 rounded-xl border text-center flex flex-col items-center justify-center gap-1 transition-all text-xs ${
                        selectedMethod === method
                          ? 'bg-secondary text-white border-secondary font-bold shadow-sm'
                          : 'bg-surface-container-low border-surface-container-high text-on-surface hover:bg-surface-container'
                      } ${isPaid ? 'opacity-60 cursor-not-allowed' : ''}`}
                    >
                      <span className="material-symbols-outlined text-lg">
                        {method === 'Carte Bancaire'
                          ? 'credit_card'
                          : method === 'Espèces'
                          ? 'payments'
                          : 'account_balance'}
                      </span>
                      <span className="leading-tight">{method}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Handover Protocol */}
              <div className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container-high flex flex-col gap-2">
                <span className="font-label-sm text-xs font-bold text-on-surface uppercase">
                  Protocole de Restitution des Clés & Check-Out
                </span>
                <div className="space-y-1.5 text-xs text-on-surface-variant">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-secondary">key</span>
                    <span>Trousseau de clés original vérifié</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-secondary">description</span>
                    <span>Facture acquittée et carnet digital synchronisé</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-emerald-600 font-bold">event_busy</span>
                    <span className="text-emerald-800 font-medium">Suppression automatique du RDV dans le planning & dashboard</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-secondary">sms</span>
                    <span>Notification instantanée envoyée au client</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col gap-2.5 pt-2">
                {!isPaid ? (
                  <button
                    type="button"
                    onClick={handleProcessPayment}
                    disabled={isProcessing}
                    className="w-full py-4 rounded-xl bg-secondary hover:bg-secondary-container text-white font-headline-sm text-sm font-bold shadow-md hover:shadow-lg transition-all active:scale-[0.99] flex items-center justify-center gap-2"
                  >
                    {isProcessing ? (
                      <>
                        <span className="material-symbols-outlined animate-spin text-lg">progress_activity</span>
                        <span>Traitement du Check-Out en cours...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-xl">payments</span>
                        <span>Valider le Check-Out & Règlement (Clôturer le RDV)</span>
                      </>
                    )}
                  </button>
                ) : (
                  <div className="flex flex-col gap-2">
                    <div className="w-full py-3 rounded-xl bg-emerald-600 text-white font-headline-sm text-sm font-bold flex items-center justify-center gap-2 shadow-sm">
                      <span className="material-symbols-outlined text-xl">check_circle</span>
                      <span>Check-Out Effectué · RDV Clôturé du Planning</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {onOpenPdfPreview && (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenPdfPreview({
                              id: `final-inv-${activeDisplay.orderId}`,
                              date: new Date().toLocaleDateString('fr-FR'),
                              year: String(new Date().getFullYear()),
                              mileage: '18 420 km',
                              title: 'Facture d’Atelier Acquittée',
                              description:
                                billingSummary.confirmedQuotes.length > 0
                                  ? `Entretien (${billingSummary.maintenancePrice.toFixed(3)} TND) + Devis pièce(s) confirmé(s) (${billingSummary.confirmedQuotesTotal.toFixed(3)} TND).`
                                  : activeDisplay.serviceTitle || 'Entretien constructeur et révision officielle 75 points avec pièces d’origine Kia.',
                              amount: `${amountTnd} TND`,
                              workshop: 'City Cars Kia La Goulette (Tunis)',
                              advisor: 'M. Hédi Mansour',
                              orNumber: activeDisplay.orderId,
                              status: 'completed',
                              vehicleName: activeDisplay.vehicleName,
                              plate: activeDisplay.plate,
                              vin: activeDisplay.vin,
                              clientId: activeDisplay.clientId,
                              clientName: activeDisplay.clientName,
                              clientEmail: activeDisplay.clientEmail,
                              clientPhone: activeDisplay.clientPhone,
                              technicianName: activeDisplay.technicianName,
                              bay: activeDisplay.bay,
                              paymentMethod: activeDisplay.paymentMethod || selectedMethod,
                              paidAt: activeDisplay.paidAt,
                              operations: [
                                {
                                  id: 'inv-maint',
                                  label: `${billingSummary.maintenanceLabel} (${billingSummary.maintenancePrice.toFixed(3)} TND)`,
                                  category: 'Entretien',
                                  completedAt: activeDisplay.startedAt || '09:30',
                                  status: 'verified',
                                },
                                ...billingSummary.confirmedQuotes.map((q, idx) => ({
                                  id: `inv-q-${idx}`,
                                  label: `${q.title} (+${q.totalPrice.toFixed(3)} TND)`,
                                  category: 'Devis Pièce Confirmé',
                                  completedAt: q.acceptedAt || q.respondedAt || 'Validé',
                                  status: 'verified' as const,
                                })),
                              ],
                              parts: billingSummary.confirmedQuotes.flatMap((q) =>
                                (q.parts || []).map((p) => ({
                                  oemRef: p.oemRef,
                                  name: p.name,
                                  quantity: p.quantity || 1,
                                  unitPriceTND: p.unitPrice,
                                }))
                              ),
                            })
                          }
                          className="py-2.5 px-3 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-headline-sm text-xs font-semibold flex items-center justify-center gap-1.5 border border-surface-container-high transition-colors"
                        >
                          <span className="material-symbols-outlined text-base">picture_as_pdf</span>
                          <span>Imprimer Facture</span>
                        </button>
                      )}

                      {onNavigateToPlanning && (
                        <button
                          type="button"
                          onClick={onNavigateToPlanning}
                          className="py-2.5 px-3 rounded-xl bg-primary text-on-primary hover:bg-[#1a2a38] font-headline-sm text-xs font-semibold flex items-center justify-center gap-1.5 shadow-sm transition-colors"
                        >
                          <span className="material-symbols-outlined text-base">calendar_month</span>
                          <span>Vérifier Planning</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Empty state when no live progress exists */
        <div className="bg-surface-container-lowest p-8 rounded-2xl shadow-sm border border-surface-container-high flex flex-col items-center justify-center text-center gap-3 py-12">
          <div className="w-16 h-16 rounded-2xl bg-surface-container flex items-center justify-center text-secondary shadow-sm">
            <span className="material-symbols-outlined text-3xl">key</span>
          </div>
          <h2 className="font-headline-sm text-lg font-bold text-on-surface">
            Aucun véhicule en attente immédiate de restitution
          </h2>
          <p className="font-body-sm text-xs sm:text-sm text-on-surface-variant max-w-lg">
            Dès que le technicien valide l'Étape 04 (Clôture des Travaux) sur son terminal d'atelier, le dossier s'affichera automatiquement ici pour encaissement, check-out et suppression du planning.
          </p>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-surface-container-high flex flex-col items-center text-center gap-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center">
              <span className="material-symbols-outlined text-3xl">check_circle</span>
            </div>
            <div>
              <span className="font-label-sm text-xs text-secondary uppercase font-bold tracking-wider">
                Check-Out & Règlement Réussis
              </span>
              <h3 className="font-headline-md text-xl font-bold text-on-surface mt-1">
                Restitution & Paiement Confirmés !
              </h3>
              <p className="font-body-sm text-xs text-on-surface-variant mt-2">
                Le montant de <strong className="text-on-surface">{amountTnd} TND</strong> a été enregistré par {selectedMethod}.
                Le client <strong className="text-on-surface">{activeDisplay?.clientName}</strong> a été notifié et le suivi en direct a été archivé dans son historique.
              </p>
              <div className="mt-3 p-2.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium flex items-center gap-2 text-left">
                <span className="material-symbols-outlined text-emerald-700 text-base shrink-0">check_box</span>
                <span>RDV clôturé du planning et dossier transféré vers le Carnet d'Entretien client (Firestore).</span>
              </div>
            </div>

            <div className="w-full flex flex-col gap-2">
              {onNavigateToPlanning && (
                <button
                  type="button"
                  onClick={() => {
                    setShowSuccessModal(false);
                    onNavigateToPlanning();
                  }}
                  className="w-full py-3 rounded-xl bg-secondary text-white font-headline-sm text-sm font-bold shadow-md hover:bg-secondary-container transition-all flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-base">grid_view</span>
                  <span>Voir le Planning Actualisé</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowSuccessModal(false)}
                className="w-full py-2.5 rounded-xl bg-surface-container text-on-surface font-headline-sm text-xs font-semibold hover:bg-surface-container-high transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
