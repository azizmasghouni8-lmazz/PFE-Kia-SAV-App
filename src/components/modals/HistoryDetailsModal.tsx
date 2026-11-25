import { ServiceHistoryItem } from '../../types';

interface HistoryDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: ServiceHistoryItem | null;
  onOpenPdf: (item: ServiceHistoryItem) => void;
}

export function HistoryDetailsModal({ isOpen, onClose, item, onOpenPdf }: HistoryDetailsModalProps) {
  if (!isOpen || !item) return null;

  const operations =
    item.operations && item.operations.length > 0
      ? item.operations
      : [
          {
            id: 'default-op-1',
            label: item.title,
            category: 'Prestation principale',
            completedAt: item.date,
            status: 'completed' as const,
            notes: item.description,
          },
        ];

  const parts = item.parts || [];
  const qualityChecks =
    item.qualityChecks && item.qualityChecks.length > 0
      ? item.qualityChecks
      : [
          'Contrôle qualité atelier validé',
          'Pièces et consommables conformes Kia Motors',
        ];

  const partsTotal = parts.reduce((acc, p) => acc + p.quantity * p.unitPriceTND, 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-details-title"
    >
      <div className="bg-surface-container-lowest text-on-surface rounded-2xl shadow-2xl max-w-3xl w-full border border-surface-container-high overflow-hidden my-auto flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#0e1d28] text-white px-6 py-5 flex items-start justify-between gap-4 shrink-0">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-300 font-mono">
              <span>{item.orNumber}</span>
              <span aria-hidden="true">·</span>
              <span>
                {item.date} {item.year}
              </span>
              {item.durationLabel && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Durée {item.durationLabel}</span>
                </>
              )}
            </div>
            <h2 id="history-details-title" className="font-headline-md text-lg sm:text-xl font-bold text-white leading-snug">
              {item.title}
            </h2>
            <p className="text-xs text-slate-300 truncate">
              {item.vehicleName || 'Véhicule Kia'}
              {item.plate ? ` · ${item.plate}` : ''}
              {` · ${item.workshop}`}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-300 hover:bg-white/10 hover:text-white transition-colors shrink-0"
            aria-label="Fermer la fiche"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto flex flex-col gap-6">
          {/* Summary Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pb-5 border-b border-surface-container-high">
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-semibold text-on-surface-variant">Kilométrage relevé</span>
              <span className="font-mono tabular-nums text-sm font-bold text-on-surface">{item.mileage}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-semibold text-on-surface-variant">Intervenant / Conseiller</span>
              <span className="text-sm font-bold text-on-surface truncate">
                {item.technicianName || item.advisor}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-semibold text-on-surface-variant">Poste / Baie</span>
              <span className="text-sm font-semibold text-on-surface truncate">
                {item.bay || item.workshop}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[11px] font-semibold text-on-surface-variant">Montant acquitté</span>
              <span className="font-mono tabular-nums text-sm font-bold text-secondary">
                {item.amount || 'Inclus'}
              </span>
            </div>
          </div>

          {/* 1. Operations Detail List */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="font-headline-sm text-sm font-bold text-on-surface">
                Opérations effectuées ({operations.length})
              </h3>
              <span className="text-xs text-on-surface-variant">Ordre chronologique d’atelier</span>
            </div>

            <div className="border border-surface-container-high rounded-xl divide-y divide-surface-container-high overflow-hidden">
              {operations.map((op, idx) => (
                <div
                  key={op.id || idx}
                  className="p-3.5 bg-surface-container-lowest hover:bg-surface-container-low transition-colors flex items-start justify-between gap-3"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <span className="font-mono tabular-nums text-xs font-bold text-on-surface-variant w-6 pt-0.5 shrink-0">
                      {String(idx + 1).padStart(2, '0')}.
                    </span>
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="text-xs sm:text-sm font-semibold text-on-surface leading-snug">
                        {op.label}
                      </span>
                      <div className="flex items-center gap-2 text-[11px] text-on-surface-variant">
                        <span>{op.category}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{op.completedAt}</span>
                      </div>
                      {op.notes && (
                        <p className="text-xs text-on-surface-variant mt-1">{op.notes}</p>
                      )}
                    </div>
                  </div>

                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 shrink-0 whitespace-nowrap">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    {op.status === 'verified' ? 'Vérifié' : 'Effectué'}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* 2. OEM Spare Parts */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="font-headline-sm text-sm font-bold text-on-surface">
                Pièces d'Origine Kia & Consommables ({parts.length})
              </h3>
              {parts.length > 0 && (
                <span className="font-mono tabular-nums text-xs font-semibold text-on-surface-variant">
                  Sous-total pièces : {partsTotal.toFixed(3)} TND
                </span>
              )}
            </div>

            {parts.length > 0 ? (
              <div className="border border-surface-container-high rounded-xl overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-surface-container-low text-on-surface-variant border-b border-surface-container-high">
                      <th className="py-2.5 px-3.5 font-semibold">Référence OEM</th>
                      <th className="py-2.5 px-3.5 font-semibold">Désignation</th>
                      <th className="py-2.5 px-3.5 font-semibold text-right">Qté</th>
                      <th className="py-2.5 px-3.5 font-semibold text-right">Total TND</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-container-high">
                    {parts.map((part) => (
                      <tr key={part.oemRef} className="hover:bg-surface-container-low/60">
                        <td className="py-2.5 px-3.5 font-mono tabular-nums text-on-surface-variant whitespace-nowrap">
                          {part.oemRef}
                        </td>
                        <td className="py-2.5 px-3.5 font-medium text-on-surface">{part.name}</td>
                        <td className="py-2.5 px-3.5 font-mono tabular-nums text-right text-on-surface">
                          {part.quantity}
                        </td>
                        <td className="py-2.5 px-3.5 font-mono tabular-nums text-right font-semibold text-on-surface whitespace-nowrap">
                          {(part.quantity * part.unitPriceTND).toFixed(3)} TND
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-on-surface-variant p-3.5 rounded-xl bg-surface-container-low border border-surface-container-high">
                Aucune pièce de rechange facturée sur cette intervention (contrôle / prestation garantie).
              </p>
            )}
          </section>

          {/* 3. Quality Visa & Settlement */}
          <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container-high flex flex-col gap-2">
              <h4 className="font-headline-sm text-xs font-bold text-on-surface">
                Contrôle Qualité & Sortie
              </h4>
              <ul className="space-y-1.5">
                {qualityChecks.map((check, i) => (
                  <li key={i} className="flex items-center gap-2 text-xs text-on-surface">
                    <span className="material-symbols-outlined text-emerald-700 text-base shrink-0">verified</span>
                    <span>{check}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container-high flex flex-col justify-between gap-2">
              <div>
                <h4 className="font-headline-sm text-xs font-bold text-on-surface">
                  Règlement & Traçabilité
                </h4>
                <div className="mt-2 space-y-1 text-xs text-on-surface-variant">
                  <div className="flex justify-between gap-2">
                    <span>Facture :</span>
                    <span className="font-mono tabular-nums font-semibold text-on-surface">
                      {item.invoiceNumber || item.orNumber}
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span>Mode :</span>
                    <span className="font-semibold text-on-surface">
                      {item.paymentMethod || 'Comptoir SAV'}
                    </span>
                  </div>
                  {item.paidAt && (
                    <div className="flex justify-between gap-2">
                      <span>Date sortie :</span>
                      <span className="font-mono tabular-nums text-on-surface">{item.paidAt}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="pt-2 border-t border-surface-container-high flex items-center justify-between">
                <span className="text-xs font-semibold text-on-surface">Total TTC</span>
                <span className="font-mono tabular-nums text-base font-bold text-secondary">
                  {item.amount || 'Inclus'}
                </span>
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-surface-container-low border-t border-surface-container-high flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-surface-container-high bg-surface-container-lowest hover:bg-surface-container text-on-surface text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
          >
            Fermer
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenPdf(item);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#0e1d28] hover:bg-[#1a2a38] text-white text-xs font-semibold transition-colors shadow-sm whitespace-nowrap shrink-0"
          >
            <span className="material-symbols-outlined text-base">picture_as_pdf</span>
            <span>Facture PDF</span>
          </button>
        </div>
      </div>
    </div>
  );
}
