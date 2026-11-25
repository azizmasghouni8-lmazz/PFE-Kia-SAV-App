import { useState, useEffect } from 'react';
import { Vehicle, AdditionalQuote, Compte } from '../../types';
import { workshopSyncService } from '../../services/workshopSyncService';

interface ClientHomeProps {
  vehicles: Vehicle[];
  quote: AdditionalQuote | null;
  onNavigateToBooking: () => void;
  onNavigateToTracking: () => void;
  onNavigateToAssistance: () => void;
  onOpenAddVehicle: () => void;
  onOpenChat: () => void;
  onDeleteVehicle?: (vehicleId: string) => void;
  clientName?: string;
  currentCompte?: Compte | null;
}

export function ClientHome({
  vehicles,
  quote,
  onNavigateToBooking,
  onNavigateToTracking,
  onNavigateToAssistance,
  onOpenAddVehicle,
  onOpenChat,
  onDeleteVehicle,
  clientName = 'Client',
  currentCompte = null,
}: ClientHomeProps) {
  const [vehicleToDelete, setVehicleToDelete] = useState<Vehicle | null>(null);
  const [deleteToast, setDeleteToast] = useState<string | null>(null);
  const [, setSyncTick] = useState(0);

  useEffect(() => {
    const refresh = () => setSyncTick((t) => t + 1);
    window.addEventListener('k_dms_quotes_updated', refresh);
    window.addEventListener('k_dms_orders_updated', refresh);
    window.addEventListener('k_dms_live_updated', refresh);
    return () => {
      window.removeEventListener('k_dms_quotes_updated', refresh);
      window.removeEventListener('k_dms_orders_updated', refresh);
      window.removeEventListener('k_dms_live_updated', refresh);
    };
  }, []);

  const pendingQuotes = workshopSyncService.getPendingQuotesForClient(currentCompte, vehicles);
  const urgentQuote =
    pendingQuotes[0] ||
    (quote &&
    quote.status === 'pending' &&
    workshopSyncService.doesQuoteBelongToClient(quote, currentCompte, vehicles)
      ? quote
      : null);

  const waitingVehicleEntry = vehicles
    .map((v) => ({
      vehicle: v,
      wait: workshopSyncService.isVehicleWaitingPartsForClient(currentCompte, v.plate, v.activeOrId),
    }))
    .find((item) => item.wait.waiting);

  const activeVehicle = vehicles.find((v) => v.status === 'in_workshop' || v.status === 'waiting_parts') || waitingVehicleEntry?.vehicle;
  const hasActiveIntervention = !!activeVehicle;

  return (
    <div className="w-full flex flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
      {/* Toast de confirmation suppression */}
      {deleteToast && (
        <div className="w-full rounded-xl bg-emerald-700 text-white p-3.5 px-4 shadow-md flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-xl">check_circle</span>
            <span className="font-headline-sm text-xs sm:text-sm font-semibold">{deleteToast}</span>
          </div>
          <button
            onClick={() => setDeleteToast(null)}
            type="button"
            className="p-1 hover:bg-white/20 rounded-lg transition-colors"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Top Visual Welcome Banner with Watermark */}
      <section className="relative w-full overflow-hidden bg-primary text-on-primary p-6 sm:p-8 rounded-2xl shadow-md border border-white/5">
        <div className="absolute -right-8 -bottom-10 select-none pointer-events-none opacity-5 font-headline-xl text-[120px] sm:text-[150px] tracking-tighter uppercase font-bold text-white">
          KIA SAV
        </div>

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex flex-col max-w-2xl gap-2">
            <div className="flex items-center gap-2">
              {waitingVehicleEntry ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500 text-[#05141f] font-label-sm text-xs uppercase tracking-wider font-bold shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#05141f] animate-pulse" />
                  En attente pièce
                </span>
              ) : hasActiveIntervention ? (
                <>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary text-on-secondary font-label-sm text-xs uppercase tracking-wider font-semibold shadow-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    Atelier Actif
                  </span>
                  {activeVehicle.activeOrId && (
                    <span className="font-label-sm text-xs text-on-primary-container tracking-wide uppercase font-mono">
                      Dossier OR #{activeVehicle.activeOrId}
                    </span>
                  )}
                </>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 font-label-sm text-xs uppercase tracking-wider font-semibold shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  Véhicule à Jour · Espace Connecté
                </span>
              )}
            </div>

            <h1 className="font-headline-lg text-2xl sm:text-3xl text-on-primary font-bold tracking-tight">
              Bonjour {clientName}, bienvenue sur votre Espace Client City Cars Kia
            </h1>

            <p className="font-body-md text-sm sm:text-base text-surface-container-highest">
              {waitingVehicleEntry ? (
                <>
                  Votre {waitingVehicleEntry.vehicle.name} est actuellement en état{' '}
                  <span className="text-amber-300 font-bold">« En attente pièce »</span> :{' '}
                  {waitingVehicleEntry.wait.reason}
                </>
              ) : hasActiveIntervention ? (
                <>
                  Votre centre de service agréé veille sur votre tranquillité.{' '}
                  <span className="text-white font-semibold underline underline-offset-4 decoration-secondary">
                    1 intervention est en cours
                  </span>{' '}
                  sur votre {activeVehicle.name} à l'atelier de Tunis La Goulette.
                </>
              ) : (
                <>
                  Votre centre de service agréé veille sur votre tranquillité. Votre carnet numérique et la garantie
                  constructeur de votre Kia sont synchronisés en direct.
                </>
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {hasActiveIntervention && (
              <button
                onClick={onNavigateToTracking}
                className="flex-1 lg:flex-initial inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-surface-container-lowest text-primary hover:bg-surface-container text-sm font-semibold transition-all shadow-sm active:scale-95"
              >
                <span className="material-symbols-outlined text-secondary text-[20px]">insights</span>
                <span>Suivre en direct</span>
              </button>
            )}

            <button
              onClick={onNavigateToBooking}
              className="flex-1 lg:flex-initial inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-secondary text-on-secondary hover:bg-secondary-container text-sm font-bold transition-all shadow-md group active:scale-95"
            >
              <span className="material-symbols-outlined transition-transform group-hover:rotate-12 text-[20px]">
                calendar_month
              </span>
              <span>Prendre un Rendez-vous SAV</span>
            </button>
          </div>
        </div>
      </section>

      {/* Urgent Action Banner : Devis en attente -> Redirection exclusive vers Assistance & Devis */}
      {urgentQuote && urgentQuote.status === 'pending' && (
        <section className="w-full bg-surface-container-lowest rounded-2xl p-4 sm:p-5 shadow-sm border-2 border-secondary/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-secondary-fixed flex items-center justify-center text-on-secondary-fixed shrink-0">
              <span className="material-symbols-outlined text-[24px]">notification_important</span>
            </div>

            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-label-sm text-xs uppercase font-bold tracking-wider text-secondary">
                  Devis Atelier à Valider
                </span>
                <span className="font-body-sm text-xs text-on-surface-variant font-mono">
                  {urgentQuote.vehicle} ({urgentQuote.plate})
                </span>
                {urgentQuote.requiresPartOrder && (
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900">
                    Pièce à commander · Délai {urgentQuote.estimatedDeliveryDelay || '48h–72h'}
                  </span>
                )}
              </div>
              <p className="font-body-md text-xs sm:text-sm text-on-surface truncate mt-0.5">
                <strong>{urgentQuote.title}</strong> — {urgentQuote.totalPrice.toFixed(3)} TND TTC
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
            <button
              onClick={onNavigateToAssistance}
              className="flex-1 md:flex-initial inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-secondary text-on-secondary hover:bg-secondary-container font-label-md text-xs uppercase font-bold transition-all shadow-sm whitespace-nowrap"
            >
              <span>Consulter & Donner mon Avis (Assistance & Devis)</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </button>
          </div>
        </section>
      )}

      {/* SECTION: Mes Véhicules Enregistrés */}
      <section className="w-full flex flex-col gap-4">
        <div className="flex items-end justify-between">
          <div className="flex flex-col">
            <div className="font-label-sm text-xs uppercase tracking-wider text-secondary font-bold">
              Garage Virtuel Certifié
            </div>
            <h2 className="font-headline-md text-xl sm:text-2xl font-bold text-on-surface">
              Mes Véhicules Enregistrés
            </h2>
          </div>
          <span className="font-label-sm text-xs text-on-surface-variant hidden sm:inline-block">
            {vehicles.length} Véhicule{vehicles.length > 1 ? 's' : ''} Associé{vehicles.length > 1 ? 's' : ''}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {vehicles.map((vehicle) => {
            const waitState = workshopSyncService.isVehicleWaitingPartsForClient(
              currentCompte,
              vehicle.plate,
              vehicle.activeOrId
            );
            const isVehicleWaitingParts = vehicle.status === 'waiting_parts' || waitState.waiting;
            const isVehicleInWorkshop = vehicle.status === 'in_workshop' || isVehicleWaitingParts;

            return (
              <div
                key={vehicle.id}
                className="bg-surface-container-lowest rounded-2xl shadow-sm hover:shadow-md transition-shadow overflow-hidden flex flex-col justify-between border border-surface-container-high"
              >
                <div className="p-5 flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex flex-col">
                      <span className="font-label-sm text-xs uppercase tracking-wider text-on-surface-variant">
                        Année {vehicle.year} · {vehicle.type}
                      </span>
                      <h3 className="font-headline-sm font-bold text-on-surface text-lg">
                        {vehicle.name}
                      </h3>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isVehicleWaitingParts ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 font-label-sm text-xs font-bold tracking-tight whitespace-nowrap">
                          <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
                          En attente pièce
                        </div>
                      ) : isVehicleInWorkshop ? (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-xs font-bold tracking-tight">
                          <span className="w-2 h-2 rounded-full bg-secondary animate-ping" />
                          Intervention en cours
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 font-label-sm text-xs font-semibold border border-emerald-200">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          À jour
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => setVehicleToDelete(vehicle)}
                        title="Supprimer ce véhicule"
                        className="p-1.5 rounded-lg text-on-surface-variant hover:text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </div>
                  </div>

                  {/* Vehicle Image */}
                  <div className="relative w-full h-44 rounded-xl overflow-hidden bg-surface-container flex items-center justify-center">
                    <img
                      className="w-full h-full object-cover"
                      src={vehicle.imageUrl}
                      alt={vehicle.name}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-white font-label-sm text-xs">
                      <span className="bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded font-mono font-semibold tracking-wider">
                        {vehicle.plate}
                      </span>
                      <span className="bg-black/60 backdrop-blur-sm px-2 py-0.5 rounded font-mono text-surface-container">
                        VIN: {vehicle.vin}
                      </span>
                    </div>
                  </div>

                  {/* Location or Status Badge */}
                  <div
                    className={`p-2.5 rounded-lg flex items-center gap-2 border ${
                      isVehicleWaitingParts
                        ? 'bg-amber-50 border-amber-200 text-amber-950'
                        : 'bg-surface-container-low border-surface-container-high text-on-surface'
                    }`}
                  >
                    <span
                      className={`material-symbols-outlined text-base ${
                        isVehicleWaitingParts ? 'text-amber-700' : 'text-secondary'
                      }`}
                    >
                      {isVehicleWaitingParts ? 'hourglass_empty' : isVehicleInWorkshop ? 'location_on' : 'verified'}
                    </span>
                    <span className="font-body-sm text-xs">
                      {isVehicleWaitingParts ? (
                        <>
                          <strong>En attente pièce :</strong> {waitState.reason || 'Commande en cours'}
                        </>
                      ) : isVehicleInWorkshop ? (
                        <>
                          En atelier à <strong>{vehicle.workshopLocation || 'Tunis La Goulette'}</strong> · Tech :{' '}
                          {vehicle.technicianName || 'K. Trabelsi'}
                        </>
                      ) : (
                        'Contrôle technique constructeur & Entretien à jour'
                      )}
                    </span>
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-surface-container-low p-2.5 rounded-lg border border-surface-container-high">
                      <span className="font-label-sm text-[10px] text-on-surface-variant uppercase">
                        Kilométrage Actuel
                      </span>
                      <div className="font-headline-sm text-base sm:text-lg font-bold text-on-surface font-mono">
                        {vehicle.mileage?.toLocaleString('fr-FR')}{' '}
                        <span className="text-xs font-normal text-on-surface-variant">km</span>
                      </div>
                    </div>

                    <div className="bg-surface-container-low p-2.5 rounded-lg border border-surface-container-high">
                      <span className="font-label-sm text-[10px] text-on-surface-variant uppercase">
                        {isVehicleInWorkshop ? 'Prochain Entretien' : 'Garantie 5 Ans'}
                      </span>
                      <div className="font-headline-sm text-base sm:text-lg font-bold text-secondary font-mono">
                        {isVehicleInWorkshop ? (
                          <>
                            {vehicle.nextServiceKm?.toLocaleString('fr-FR')}{' '}
                            <span className="text-xs font-normal text-on-surface-variant">km</span>
                          </>
                        ) : (
                          <span className="text-emerald-600">Active</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar if in workshop */}
                  {isVehicleInWorkshop && (
                    <div className="flex flex-col gap-1">
                      <div className="flex justify-between font-label-sm text-xs text-on-surface-variant">
                        <span>Avancement Réparation{vehicle.activeOrId ? ` (OR #${vehicle.activeOrId})` : ''}</span>
                        <span className="font-bold text-primary">{vehicle.progressPercent || 65}%</span>
                      </div>
                      <div className="w-full h-2 bg-surface-container rounded-full overflow-hidden">
                        <div
                          className="h-full bg-secondary rounded-full transition-all duration-500"
                          style={{ width: `${vehicle.progressPercent || 65}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {!isVehicleInWorkshop && (
                    <p className="font-body-sm text-xs text-on-surface-variant">
                      Aucune opération en attente. Votre carnet numérique Kia est parfaitement à jour.
                    </p>
                  )}
                </div>

                {/* Action Bar */}
                <div className="bg-surface-container-low px-5 py-3 flex flex-wrap items-center justify-between gap-2 border-t border-surface-container-high">
                  <div className="flex items-center gap-2">
                    {isVehicleInWorkshop ? (
                      <button
                        onClick={onNavigateToTracking}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary text-on-secondary hover:bg-secondary-container font-label-md text-xs font-bold uppercase transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">troubleshoot</span>
                        <span>Voir le suivi</span>
                      </button>
                    ) : null}
                    <button
                      onClick={onNavigateToBooking}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-lowest text-on-surface hover:bg-surface-container font-label-md text-xs font-semibold transition-colors border border-surface-container-high"
                    >
                      <span className="material-symbols-outlined text-sm">schedule</span>
                      <span>Prendre RDV</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setVehicleToDelete(vehicle)}
                      className="inline-flex items-center gap-1 text-on-surface-variant hover:text-red-600 font-body-sm text-xs font-semibold transition-colors px-2 py-1 rounded-lg hover:bg-red-50"
                      title="Supprimer ce véhicule de mon garage"
                    >
                      <span className="material-symbols-outlined text-sm">delete</span>
                      <span>Supprimer</span>
                    </button>

                    <button
                      onClick={onNavigateToTracking}
                      className="inline-flex items-center gap-1 text-on-surface-variant hover:text-on-surface font-body-sm text-xs font-semibold transition-colors"
                      type="button"
                    >
                      <span>Détails</span>
                      <span className="material-symbols-outlined text-sm">chevron_right</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {vehicles.length === 0 && (
            <div className="col-span-full md:col-span-2 p-8 rounded-2xl bg-surface-container-low border border-dashed border-surface-container-high flex flex-col items-center justify-center text-center gap-3 py-12">
              <div className="w-16 h-16 rounded-2xl bg-surface-container flex items-center justify-center text-secondary">
                <span className="material-symbols-outlined text-3xl">directions_car</span>
              </div>
              <h3 className="font-headline-sm text-base font-bold text-on-surface">
                Aucun véhicule enregistré dans votre garage
              </h3>
              <p className="font-body-sm text-xs text-on-surface-variant max-w-sm">
                Utilisez le bouton ci-contre pour associer votre première Kia à votre compte SAV City Cars Tunisie.
              </p>
            </div>
          )}

          {/* Add New Vehicle CTA Card */}
          <div
            onClick={onOpenAddVehicle}
            className="bg-surface-container-low rounded-2xl border-2 border-dashed border-surface-container-highest p-6 flex flex-col items-center justify-center text-center gap-3 hover:bg-surface-container hover:border-secondary transition-all group cursor-pointer min-h-[360px]"
          >
            <div className="w-14 h-14 rounded-full bg-surface-container-lowest text-primary group-hover:bg-secondary group-hover:text-on-secondary flex items-center justify-center transition-colors shadow-sm">
              <span className="material-symbols-outlined text-2xl font-bold">add</span>
            </div>

            <div className="flex flex-col gap-1">
              <h4 className="font-headline-sm font-bold text-on-surface text-base">Ajouter un véhicule</h4>
              <p className="font-body-sm text-xs text-on-surface-variant max-w-xs">
                Associez une autre Kia avec son numéro de châssis (VIN) et sa plaque d'immatriculation.
              </p>
            </div>

            <span className="font-label-sm text-xs text-secondary font-bold uppercase tracking-wider group-hover:underline mt-1">
              Enregistrer +
            </span>
          </div>
        </div>
      </section>

      {/* SECTION: Raccourcis & Accès Rapides */}
      <section className="w-full flex flex-col gap-4">
        <div className="flex flex-col">
          <div className="font-label-sm text-xs uppercase tracking-wider text-secondary font-bold">
            Navigation Express
          </div>
          <h2 className="font-headline-md text-xl sm:text-2xl font-bold text-on-surface">
            Services & Actions Rapides
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Module 1 */}
          <div
            onClick={onNavigateToBooking}
            className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container-high shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-4 cursor-pointer group"
          >
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-primary group-hover:bg-secondary group-hover:text-on-secondary transition-colors">
                <span className="material-symbols-outlined text-2xl">calendar_today</span>
              </div>
              <span className="font-mono text-xs text-on-surface-variant font-bold">01 //</span>
            </div>
            <div>
              <h3 className="font-headline-sm font-bold text-lg text-on-surface group-hover:text-secondary transition-colors">
                Prendre un Rendez-vous SAV
              </h3>
              <p className="font-body-sm text-xs text-on-surface-variant mt-1">
                Révision périodique, vidange moteur certifiée Kia, contrôle freinage ou climatisation en quelques clics.
              </p>
            </div>
            <div className="inline-flex items-center gap-1 font-label-md text-xs font-bold text-secondary uppercase tracking-wider group-hover:translate-x-1 transition-transform">
              <span>Choisir un créneau</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </div>
          </div>

          {/* Module 2 */}
          <div
            onClick={onNavigateToTracking}
            className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container-high shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-4 cursor-pointer group"
          >
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-primary group-hover:bg-secondary group-hover:text-on-secondary transition-colors">
                <span className="material-symbols-outlined text-2xl">build</span>
              </div>
              <span className="font-mono text-xs text-on-surface-variant font-bold">02 //</span>
            </div>
            <div>
              <h3 className="font-headline-sm font-bold text-lg text-on-surface group-hover:text-secondary transition-colors">
                Suivi d'Atelier en Direct
              </h3>
              <p className="font-body-sm text-xs text-on-surface-variant mt-1">
                Suivez le passage au banc, le diagnostic électronique et la préparation du véhicule en temps réel.
              </p>
            </div>
            <div className="inline-flex items-center gap-1 font-label-md text-xs font-bold text-secondary uppercase tracking-wider group-hover:translate-x-1 transition-transform">
              <span>Accéder au tracking</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </div>
          </div>

          {/* Module 3 */}
          <div
            onClick={onNavigateToAssistance}
            className="bg-surface-container-lowest p-6 rounded-2xl border border-surface-container-high shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-4 cursor-pointer group"
          >
            <div className="flex items-start justify-between">
              <div className="w-12 h-12 rounded-xl bg-surface-container flex items-center justify-center text-primary group-hover:bg-secondary group-hover:text-on-secondary transition-colors">
                <span className="material-symbols-outlined text-2xl">receipt_long</span>
              </div>
              <span className="font-mono text-xs text-on-surface-variant font-bold">03 //</span>
            </div>
            <div>
              <h3 className="font-headline-sm font-bold text-lg text-on-surface group-hover:text-secondary transition-colors">
                Devis & Carnet Numérique
              </h3>
              <p className="font-body-sm text-xs text-on-surface-variant mt-1">
                Historique complet des entretiens tamponnés, devis officiels à valider et factures téléchargeables en PDF.
              </p>
            </div>
            <div className="inline-flex items-center gap-1 font-label-md text-xs font-bold text-secondary uppercase tracking-wider group-hover:translate-x-1 transition-transform">
              <span>Consulter les documents</span>
              <span className="material-symbols-outlined text-sm">arrow_forward</span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION: Conseiller de Service Agréé */}
      <section className="w-full grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-surface-container-lowest p-6 rounded-2xl border border-surface-container-high shadow-sm flex flex-col justify-between gap-4">
          <div className="flex flex-col gap-1">
            <span className="font-label-sm text-xs text-secondary uppercase tracking-wider font-bold">
              Accompagnement Personnalisé
            </span>
            <h3 className="font-headline-sm text-xl font-bold text-on-surface">Votre Conseiller de Service Agréé</h3>
            <p className="font-body-sm text-xs text-on-surface-variant">
              Un interlocuteur unique dédié à vos interventions et au suivi administratif de votre flotte personnelle.
            </p>
          </div>

          <div className="flex items-center justify-between flex-wrap gap-4 pt-2">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center font-bold text-base shadow-sm">
                KT
              </div>
              <div>
                <h4 className="font-headline-sm text-sm font-bold text-on-surface">M. Karim Trabelsi</h4>
                <p className="font-body-sm text-xs text-on-surface-variant">
                  Conseiller Service Principal • Tunis La Goulette
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <a
                href="tel:71800000"
                className="px-4 py-2.5 rounded-xl bg-surface-container text-on-surface hover:bg-surface-container-high font-label-md text-xs font-bold font-mono flex items-center gap-2 transition-colors border border-surface-container-high"
              >
                <span className="material-symbols-outlined text-sm text-secondary">phone</span>
                <span>71 800 000</span>
              </a>
              <button
                onClick={onOpenChat}
                className="p-2.5 rounded-xl bg-surface-container text-on-surface hover:bg-secondary hover:text-white transition-colors"
                title="Message direct"
              >
                <span className="material-symbols-outlined text-base">chat</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 text-on-surface-variant font-label-sm text-[11px] pt-3 border-t border-surface-container-high">
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-sm text-secondary">schedule</span>
              Lun - Ven : 08h00 - 17h00 | Sam : 08h00 - 13h00
            </span>
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-sm text-secondary">verified</span>
              Garantie Pièces d'Origine Kia 100%
            </span>
          </div>
        </div>

        {/* Bloc Engagement Garantie */}
        <div className="lg:col-span-5 bg-gradient-to-br from-[#0e1d28] to-[#1a2f3f] text-white p-6 rounded-2xl shadow-md border border-white/5 flex flex-col justify-between gap-4 relative overflow-hidden">
          <div className="flex flex-col gap-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary text-white font-label-sm text-[11px] font-bold uppercase tracking-wider w-fit">
              Engagement Kia City Cars
            </div>
            <h3 className="font-headline-sm text-lg sm:text-xl font-bold">
              Garantie Constructeur 5 Ans ou 100 000 km
            </h3>
            <p className="font-body-sm text-xs text-[#a0b0c0] leading-relaxed">
              Votre Kia bénéficie d'une couverture complète. Respectez les intervalles d'entretien préconisés par
              le réseau officiel pour préserver l'ensemble de vos droits constructeur.
            </p>
          </div>

          <div className="pt-2 border-t border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary text-2xl">emergency</span>
              <div>
                <span className="font-label-sm text-[10px] text-[#a0b0c0] uppercase block">Assistance Dépannage</span>
                <span className="font-mono font-bold text-sm text-white">36 406 000</span>
              </div>
            </div>
            <a
              href="tel:36406000"
              className="px-3 py-1.5 rounded-lg bg-secondary text-white hover:bg-secondary-container text-xs font-bold transition-all shadow-sm"
            >
              Appeler 24/7
            </a>
          </div>
        </div>
      </section>

      {/* Modal de Confirmation de Suppression de Véhicule */}
      {vehicleToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface-container-lowest rounded-2xl p-6 sm:p-7 max-w-md w-full shadow-2xl border border-surface-container-high flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-2xl">delete_forever</span>
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="font-headline-sm text-base sm:text-lg font-bold text-on-surface">
                  Supprimer ce véhicule ?
                </h3>
                <p className="font-body-sm text-xs text-on-surface-variant leading-relaxed">
                  Êtes-vous sûr de vouloir retirer votre <strong className="text-on-surface">{vehicleToDelete.name}</strong> ({vehicleToDelete.plate}) de vos véhicules enregistrés ? Cette action supprimera la fiche de votre garage virtuel.
                </p>
              </div>
            </div>

            {vehicleToDelete.status === 'in_workshop' && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-600 text-base shrink-0">warning</span>
                <span>Attention : ce véhicule fait actuellement l'objet d'une intervention à l'atelier.</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setVehicleToDelete(null)}
                className="px-4 py-2 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteVehicle) {
                    onDeleteVehicle(vehicleToDelete.id);
                  }
                  setDeleteToast(`Le véhicule ${vehicleToDelete.name} (${vehicleToDelete.plate}) a été supprimé avec succès de votre garage.`);
                  setTimeout(() => setDeleteToast(null), 3500);
                  setVehicleToDelete(null);
                }}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-sm">delete</span>
                <span>Confirmer la suppression</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
