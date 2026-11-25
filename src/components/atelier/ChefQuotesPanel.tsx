import { useState, useEffect, useMemo } from 'react';
import { AdditionalQuote } from '../../types';
import { workshopSyncService } from '../../services/workshopSyncService';

export function ChefQuotesPanel() {
  const [quotes, setQuotes] = useState<AdditionalQuote[]>(() => workshopSyncService.getQuotes());
  const [filter, setFilter] = useState<'all' | 'pending' | 'waiting_parts' | 'confirmed'>('all');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [, setSyncTick] = useState(0);

  useEffect(() => {
    const refresh = () => {
      setQuotes(workshopSyncService.getQuotes());
      setSyncTick((t) => t + 1);
    };
    refresh();
    window.addEventListener('k_dms_quotes_updated', refresh);
    window.addEventListener('k_dms_orders_updated', refresh);
    window.addEventListener('k_dms_live_updated', refresh);
    return () => {
      window.removeEventListener('k_dms_quotes_updated', refresh);
      window.removeEventListener('k_dms_orders_updated', refresh);
      window.removeEventListener('k_dms_live_updated', refresh);
    };
  }, []);

  const handleConfirmDelivery = (q: AdditionalQuote) => {
    const updated = workshopSyncService.confirmPartDeliveryByChef(q.id);
    if (updated) {
      setQuotes(workshopSyncService.getQuotes());
      setToastMsg(
        `Réception de la pièce confirmée pour ${q.vehicle} (${q.plate}). L'état « En attente pièce » a été levé et les travaux peuvent reprendre.`
      );
      setTimeout(() => setToastMsg(null), 5000);
    }
  };

  const waitingPartsCount = useMemo(
    () =>
      quotes.filter((q) => workshopSyncService.isVehicleWaitingParts(q.plate, q.orId).waiting).length,
    [quotes]
  );

  const filteredQuotes = useMemo(() => {
    return quotes.filter((q) => {
      const waitInfo = workshopSyncService.isVehicleWaitingParts(q.plate, q.orId);
      if (filter === 'pending') return q.status === 'pending';
      if (filter === 'waiting_parts') return waitInfo.waiting && !q.chefDeliveryConfirmed;
      if (filter === 'confirmed') return q.chefDeliveryConfirmed;
      return true;
    });
  }, [quotes, filter]);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1720px] mx-auto flex flex-col gap-6">
      {toastMsg && (
        <div className="fixed top-20 right-8 z-50 bg-[#05141f] text-white p-4 rounded-xl shadow-2xl flex items-center gap-3 border border-emerald-500 max-w-md">
          <span className="material-symbols-outlined text-emerald-400">verified</span>
          <div>
            <p className="font-bold text-sm">Validation Réception Stock</p>
            <p className="text-xs text-slate-300">{toastMsg}</p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="font-label-sm text-xs text-secondary uppercase font-bold tracking-wider">
            Suivi Pièces, Devis & Arrivages Stock · Exclusif Chef d'Atelier
          </span>
          <h1 className="font-headline-lg text-2xl sm:text-3xl font-bold text-on-surface tracking-tight">
            Devis Complémentaires & Validation Réception Pièces
          </h1>
          <p className="font-body-sm text-xs sm:text-sm text-on-surface-variant">
            Supervisez les devis envoyés par les techniciens, les avis des clients et confirmez l'arrivée des pièces commandées pour lever l'état « En attente pièce ».
          </p>
        </div>

        <div className="inline-flex flex-wrap bg-surface-container-low p-1 rounded-xl border border-surface-container-high gap-1 self-start md:self-auto">
          {(
            [
              { id: 'all', label: `Tous (${quotes.length})` },
              { id: 'pending', label: `Attente client (${quotes.filter((q) => q.status === 'pending').length})` },
              { id: 'waiting_parts', label: `En attente pièce (${waitingPartsCount})` },
              { id: 'confirmed', label: `Pièces reçues (${quotes.filter((q) => q.chefDeliveryConfirmed).length})` },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setFilter(t.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                filter === t.id
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 4 KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container-high flex flex-col justify-between">
          <span className="font-label-sm text-[11px] uppercase font-semibold text-on-surface-variant">
            Total Devis Atelier
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-headline-xl text-3xl font-bold text-on-surface tabular-nums">
              {quotes.length}
            </span>
            <span className="text-xs text-on-surface-variant">dossiers</span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container-high flex flex-col justify-between">
          <span className="font-label-sm text-[11px] uppercase font-semibold text-on-surface-variant">
            Acceptés par Clients
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-headline-xl text-3xl font-bold text-emerald-700 tabular-nums">
              {quotes.filter((q) => q.status === 'accepted').length}
            </span>
            <span className="text-xs text-on-surface-variant">validés</span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container-high flex flex-col justify-between">
          <span className="font-label-sm text-[11px] uppercase font-semibold text-on-surface-variant">
            Véhicules « En attente pièce »
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-headline-xl text-3xl font-bold text-amber-700 tabular-nums">
              {waitingPartsCount}
            </span>
            <span className="text-xs text-on-surface-variant">attente réception</span>
          </div>
        </div>

        <div className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container-high flex flex-col justify-between">
          <span className="font-label-sm text-[11px] uppercase font-semibold text-on-surface-variant">
            Pièces Reçues & Confirmées
          </span>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-headline-xl text-3xl font-bold text-primary tabular-nums">
              {quotes.filter((q) => q.chefDeliveryConfirmed).length}
            </span>
            <span className="text-xs text-on-surface-variant">prêtes au montage</span>
          </div>
        </div>
      </div>

      {/* Quotes List */}
      <div className="flex flex-col gap-4">
        {filteredQuotes.length === 0 ? (
          <div className="bg-surface-container-lowest p-10 rounded-2xl border border-surface-container-high text-center text-sm text-on-surface-variant">
            Aucun dossier de devis dans cette catégorie pour le moment.
          </div>
        ) : (
          filteredQuotes.map((q) => {
            const waitState = workshopSyncService.isVehicleWaitingParts(q.plate, q.orId);
            const isOut = q.requiresPartOrder || q.partAvailability === 'out_of_stock';

            return (
              <div
                key={q.id}
                className="bg-surface-container-lowest p-5 rounded-2xl shadow-sm border border-surface-container-high flex flex-col gap-4"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-surface-container-high">
                  <div className="flex items-start gap-3.5">
                    <img
                      src={q.photoUrl}
                      alt={q.title}
                      className="w-16 h-14 rounded-xl object-cover shrink-0 border border-surface-container-high"
                    />
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-headline-sm text-base font-bold text-on-surface">{q.title}</span>
                        <span className="font-mono text-xs bg-primary text-on-primary px-2 py-0.5 rounded font-bold">
                          {q.plate}
                        </span>
                        {q.orId && (
                          <span className="font-mono text-xs text-on-surface-variant">{q.orId}</span>
                        )}
                        {waitState.waiting && (
                          <span className="px-2.5 py-0.5 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold flex items-center gap-1 whitespace-nowrap">
                            <span className="material-symbols-outlined text-xs">hourglass_empty</span>
                            <span>En attente pièce</span>
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-on-surface-variant mt-1">
                        Véhicule : <strong className="text-on-surface">{q.vehicle}</strong> · Client :{' '}
                        <strong className="text-on-surface">{q.clientName || 'Client Kia'}</strong> · Émis par {q.issuedBy} à {q.issuedTime}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    <span
                      className={`text-xs px-3 py-1 rounded-lg font-bold whitespace-nowrap ${
                        q.status === 'accepted'
                          ? 'bg-emerald-100 text-emerald-800'
                          : q.status === 'refused'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-secondary-fixed text-on-secondary-fixed'
                      }`}
                    >
                      {q.status === 'accepted'
                        ? 'Accepté par le client'
                        : q.status === 'refused'
                        ? 'Refusé par le client'
                        : 'En attente client'}
                    </span>

                    <span className="font-mono font-bold text-lg text-secondary tabular-nums">
                      {q.totalPrice.toFixed(3)} TND TTC
                    </span>
                  </div>
                </div>

                {/* Details + Client comment + Stock status */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 text-xs">
                  <div className="lg:col-span-6 p-3.5 rounded-xl bg-surface-container-low border border-surface-container-high flex flex-col gap-1.5">
                    <span className="font-bold text-on-surface uppercase text-[11px]">
                      Diagnostic & Disponibilité Pièce
                    </span>
                    <p className="text-on-surface-variant">{q.description}</p>
                    <div className="pt-1 flex items-center gap-2">
                      <span
                        className={`font-semibold px-2 py-0.5 rounded ${
                          q.chefDeliveryConfirmed
                            ? 'bg-emerald-100 text-emerald-800'
                            : isOut
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-emerald-50 text-emerald-800'
                        }`}
                      >
                        {q.chefDeliveryConfirmed
                          ? `Pièce livrée & confirmée en stock (${q.chefDeliveryConfirmedAt || 'Validé'})`
                          : isOut
                          ? `À commander · Délai estimé : ${q.estimatedDeliveryDelay || '48h – 72h'}`
                          : 'Disponible en stock magasin'}
                      </span>
                    </div>
                  </div>

                  <div className="lg:col-span-6 p-3.5 rounded-xl bg-surface-container-low border border-surface-container-high flex flex-col justify-between gap-2">
                    <div>
                      <span className="font-bold text-on-surface uppercase text-[11px] block mb-1">
                        Avis du Client & Coordination Stock
                      </span>
                      {q.clientComment ? (
                        <p className="italic text-on-surface bg-surface-container-lowest p-2 rounded-lg border border-surface-container-high">
                          « {q.clientComment} »
                        </p>
                      ) : (
                        <p className="text-on-surface-variant">Aucun avis écrit saisi par le client.</p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-surface-container-high">
                      <span className="text-on-surface-variant">
                        Équipe Stock (Tech) :{' '}
                        <strong className={q.techStockConfirmed ? 'text-emerald-700' : 'text-on-surface'}>
                          {q.techStockConfirmed
                            ? `Confirmé (${q.techStockConfirmedAt || 'OK'})`
                            : 'Non confirmé'}
                        </strong>
                      </span>

                      {q.chefDeliveryConfirmed ? (
                        <span className="px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-900 font-bold flex items-center gap-1 whitespace-nowrap">
                          <span className="material-symbols-outlined text-sm">check_circle</span>
                          <span>Arrivée pièce confirmée ({q.chefDeliveryConfirmedAt || 'OK'})</span>
                        </span>
                      ) : q.status !== 'refused' ? (
                        <button
                          type="button"
                          onClick={() => handleConfirmDelivery(q)}
                          className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-sm transition-all flex items-center gap-1.5 whitespace-nowrap shrink-0"
                        >
                          <span className="material-symbols-outlined text-sm">inventory</span>
                          <span>Confirmer Réception Pièce en Stock</span>
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
