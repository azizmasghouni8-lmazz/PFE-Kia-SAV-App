import { AppRole, Compte, ServiceHistoryItem, Vehicle } from '../../types';
import { workshopSyncService } from '../../services/workshopSyncService';
import { soundService } from '../../services/soundService';

interface PdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  item?: ServiceHistoryItem | null;
  currentCompte?: Compte | null;
  activeVehicle?: Vehicle | null;
  role?: AppRole | null;
}

export function PdfPreviewModal({
  isOpen,
  onClose,
  item,
  currentCompte = null,
  activeVehicle = null,
  role = null,
}: PdfPreviewModalProps) {
  if (!isOpen) return null;

  // Un client connecté ne lit JAMAIS pendingCheckin (objet global partagé côté atelier/réception)
  const pending = role === 'client' ? null : workshopSyncService.getPendingCheckin();
  const settings = workshopSyncService.getWorkshopSettings();

  const compteFullName = currentCompte
    ? `${currentCompte.prenom} ${currentCompte.nom}`.trim()
    : '';

  const clientName =
    item?.clientName ||
    pending?.clientName ||
    compteFullName ||
    'Client Kia';

  const vehicleName =
    item?.vehicleName ||
    pending?.vehicleName ||
    activeVehicle?.name ||
    currentCompte?.modeleVehicule ||
    'Véhicule Kia';

  const vehiclePlate =
    item?.plate ||
    pending?.plate ||
    activeVehicle?.plate ||
    currentCompte?.immatriculation ||
    '—';

  const vehicleVin =
    item?.vin ||
    pending?.vin ||
    activeVehicle?.vin ||
    currentCompte?.vin ||
    '—';

  const clientPhone =
    item?.clientPhone ||
    pending?.clientPhone ||
    currentCompte?.telephone ||
    '—';

  const serviceName =
    pending?.serviceName ||
    (item ? item.title : 'Entretien & Diagnostic Kia');

  const mileageLabel =
    item?.mileage ||
    (activeVehicle?.mileage ? `${activeVehicle.mileage.toLocaleString('fr-FR')} km` : '—');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white text-[#1b1c1c] rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-300 flex flex-col my-auto">
        {/* Modal Toolbar */}
        <div className="bg-[#05141f] text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-secondary text-lg">picture_as_pdf</span>
            <span className="font-headline-sm text-sm font-bold">
              {item ? `Document Officiel — ${item.title}` : `Fiche de Réception — ${clientName}`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (role === 'client') {
                  soundService.play('client_validation_check');
                }
                window.print();
              }}
              className="px-3 py-1 bg-white/10 hover:bg-white/20 rounded text-xs font-semibold flex items-center gap-1 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">print</span>
              <span>Imprimer</span>
            </button>
            <button
              onClick={onClose}
              className="p-1 hover:bg-white/10 rounded transition-colors text-slate-300 hover:text-white"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>

        {/* Printable Document Paper */}
        <div className="p-6 sm:p-8 flex flex-col gap-6 font-sans text-xs bg-white text-slate-900">
          {/* Header */}
          <div className="flex items-start justify-between border-b pb-4 border-slate-200">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl font-extrabold tracking-wider">KIA</span>
                <span className="text-sm font-semibold text-slate-600">
                  | {settings.dealershipName || 'City Cars Kia Tunisie'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Direction Après-Vente & Réparations Agréées</p>
              <p className="text-[10px] text-slate-400">
                {settings.dealershipAddress || 'Zone Industrielle Le Kram, Tunis'} • Tél: {settings.dealershipPhone || '71 800 000'}
              </p>
              {settings.dealershipTaxId && (
                <p className="text-[10px] text-slate-400 font-mono">
                  MF : {settings.dealershipTaxId} · TVA {settings.vatRatePercent}%
                </p>
              )}
            </div>
            <div className="text-right">
              <span className="inline-block px-2 py-0.5 bg-red-100 text-red-800 text-[10px] font-bold rounded uppercase">
                Certifié Concessionnaire
              </span>
              <p className="font-mono text-[11px] font-bold text-slate-800 mt-1">
                {item ? item.orNumber : 'DOSSIER #CHK-2026-0892'}
              </p>
              <p className="text-[10px] text-slate-500 font-mono">
                {item?.paidAt ? `Clôturé le ${item.paidAt}` : `Date : ${new Date().toLocaleDateString('fr-FR')}`}
              </p>
            </div>
          </div>

          {/* Vehicle & Client Info */}
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200 text-[11px]">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Véhicule</span>
              <p className="font-bold text-sm text-slate-900">{vehicleName}</p>
              <p className="font-mono text-slate-700">Immatriculation: {vehiclePlate}</p>
              <p className="font-mono text-slate-500">VIN: {vehicleVin}</p>
              <p className="text-slate-600">Kilométrage certifié: {mileageLabel}</p>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Propriétaire</span>
              <p className="font-bold text-sm text-slate-900">{clientName}</p>
              <p className="text-slate-700">Client Enregistré City Cars</p>
              <p className="font-mono text-slate-600">Tél: {clientPhone}</p>
              {item?.amount && (
                <p className="text-emerald-700 font-bold font-mono">
                  Réglé : {item.amount} ({item.paymentMethod || 'Comptoir'})
                </p>
              )}
            </div>
          </div>

          {/* Service items */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] uppercase font-bold text-slate-500">Détail des Travaux & Prestations</span>
            <table className="w-full text-left border-collapse text-[11px]">
              <thead>
                <tr className="bg-slate-100 text-slate-600 border-b border-slate-200">
                  <th className="py-2 px-3">Opération</th>
                  <th className="py-2 px-3">Catégorie / Réf.</th>
                  <th className="py-2 px-3">Horodatage</th>
                  <th className="py-2 px-3 text-right">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {item?.operations && item.operations.length > 0 ? (
                  item.operations.map((op) => (
                    <tr key={op.id}>
                      <td className="py-2 px-3 font-medium">{op.label}</td>
                      <td className="py-2 px-3 font-mono text-slate-500">{op.category}</td>
                      <td className="py-2 px-3 font-mono">{op.completedAt}</td>
                      <td className="py-2 px-3 text-right text-emerald-700 font-bold">
                        {op.status === 'verified' ? 'Vérifié' : 'Conforme'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <>
                    <tr>
                      <td className="py-2 px-3 font-medium">{serviceName}</td>
                      <td className="py-2 px-3 font-mono text-slate-500">SH-0W20-KIA</td>
                      <td className="py-2 px-3 font-mono">2.0 h</td>
                      <td className="py-2 px-3 text-right text-emerald-700 font-bold">Conforme</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-medium">Contrôle circuit de freinage & purge liquide</td>
                      <td className="py-2 px-3 font-mono text-slate-500">DOT4-OEM</td>
                      <td className="py-2 px-3 font-mono">0.8 h</td>
                      <td className="py-2 px-3 text-right text-emerald-700 font-bold">Conforme</td>
                    </tr>
                    <tr>
                      <td className="py-2 px-3 font-medium">Diagnostic électronique Valise KDS Kia</td>
                      <td className="py-2 px-3 font-mono text-slate-500">OBD-II</td>
                      <td className="py-2 px-3 font-mono">0.5 h</td>
                      <td className="py-2 px-3 text-right text-emerald-700 font-bold">Zéro défaut</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* Signatures & Stamps */}
          <div className="grid grid-cols-2 gap-6 pt-4 border-t border-slate-200">
            <div className="flex flex-col items-center p-3 rounded border border-slate-200 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-500 mb-2">Signature Propriétaire</span>
              <div className="h-16 flex items-center justify-center font-serif italic text-lg text-slate-800">
                {clientName.replace(/^(m\.|mme\.)\s*/i, '')}
              </div>
              <span className="text-[9px] font-mono text-slate-400">Empreinte SHA-256 certifiée</span>
            </div>

            <div className="flex flex-col items-center p-3 rounded border border-slate-200 text-center">
              <span className="text-[10px] uppercase font-bold text-slate-500 mb-2">Visa Chef d'Atelier Agréé</span>
              <div className="h-16 flex items-center justify-center font-serif italic text-lg text-red-800">
                Hédi Mansour (Agent #4012)
              </div>
              <span className="text-[9px] font-mono text-slate-400">Badge NFC Horodaté {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
            </div>
          </div>

          <div className="text-center text-[10px] text-slate-400 border-t pt-3">
            Ce document électronique fait foi de carnet d'entretien numérique certifié Kia Corporation.
          </div>
        </div>
      </div>
    </div>
  );
}
