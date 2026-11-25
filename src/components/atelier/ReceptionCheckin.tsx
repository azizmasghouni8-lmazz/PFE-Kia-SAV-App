import { useState, useRef, useEffect, useMemo } from 'react';
import { INITIAL_DEFECTS } from '../../data/mockData';
import { workshopSyncService } from '../../services/workshopSyncService';
import { compteService } from '../../services/compteService';
import { ServiceHistoryItem } from '../../types';

interface ReceptionCheckinProps {
  onGenerateOrder: (orderData: {
    checkinId: string;
    vehicle: string;
    plate: string;
    vin: string;
    km: number;
    fuelLevel: string;
    clientId?: string;
    clientName?: string;
    clientEmail?: string;
    clientPhone?: string;
    serviceName?: string;
  }) => void;
  onOpenPdfPreview: (previewItem?: ServiceHistoryItem) => void;
}

export function ReceptionCheckin({ onGenerateOrder, onOpenPdfPreview }: ReceptionCheckinProps) {
  const pendingCheckin = workshopSyncService.getPendingCheckin();

  // Résolution intelligente du compte client associé (via email, plaque ou nom)
  const matchedCompte = useMemo(() => {
    if (!pendingCheckin) {
      const activeSession = compteService.getSessionActive();
      if (activeSession && activeSession.role === 'client') return activeSession;
      const all = compteService.getComptes();
      return all.find((c) => c.role === 'client') || null;
    }
    if (pendingCheckin.clientEmail) {
      const byEmail = compteService.trouverCompteParEmail(pendingCheckin.clientEmail);
      if (byEmail) return byEmail;
    }
    if (pendingCheckin.plate) {
      const byPlate = compteService.trouverCompteParIdentifiant(pendingCheckin.plate);
      if (byPlate) return byPlate;
    }
    const all = compteService.getComptes();
    const clean = (pendingCheckin.clientName || '')
      .toLowerCase()
      .replace(/^(m\.|mme\.|cher\s+client)\s*/i, '')
      .trim();
    return (
      all.find((c) => {
        const full = `${c.prenom} ${c.nom}`.toLowerCase();
        const rev = `${c.nom} ${c.prenom}`.toLowerCase();
        return (clean && (full.includes(clean) || rev.includes(clean))) || (c.email && c.email.toLowerCase().includes(clean));
      }) || null
    );
  }, [pendingCheckin]);

  // Identité dynamique du client
  const clientName = useMemo(() => {
    if (pendingCheckin?.clientName && pendingCheckin.clientName !== 'Cher Client') {
      return pendingCheckin.clientName;
    }
    if (matchedCompte) {
      return `${matchedCompte.prenom} ${matchedCompte.nom}`;
    }
    return 'Client Kia';
  }, [pendingCheckin, matchedCompte]);

  const clientDisplayName = useMemo(() => {
    if (clientName === 'Client Kia') return clientName;
    return clientName.startsWith('M.') || clientName.startsWith('Mme') ? clientName : `M. ${clientName}`;
  }, [clientName]);

  const clientInitials = useMemo(() => {
    const clean = clientName.replace(/^(m\.|mme\.|cher\s+client)\s*/i, '').trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    if (parts.length === 1 && parts[0].length >= 2) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    return 'CK';
  }, [clientName]);

  // Coordonnées & véhicule dynamiques
  const clientId = pendingCheckin?.clientId || matchedCompte?.id;
  const clientEmail = pendingCheckin?.clientEmail || matchedCompte?.email || '';
  const clientPhone = pendingCheckin?.clientPhone || matchedCompte?.telephone || '—';
  const vehicleName = pendingCheckin?.vehicleName || matchedCompte?.modeleVehicule || 'Véhicule Kia';
  const vehiclePlate = pendingCheckin?.plate || matchedCompte?.immatriculation || '—';
  const vehicleVin = pendingCheckin?.vin || matchedCompte?.vin || '—';
  const serviceName = pendingCheckin?.serviceName || 'Révision Périodique & Entretien Constructeur';
  const clientIdCode = matchedCompte?.id ? `CLIENT #${matchedCompte.id.slice(-6).toUpperCase()}` : 'CLIENT SAV';
  const customerBadge = matchedCompte?.role === 'client' ? `Particulier • Kia ${vehicleName}` : 'Particulier • Client Propriétaire Kia';

  // Kilométrage cohérent selon le client et le véhicule
  const initialKm = useMemo(() => {
    if (pendingCheckin?.mileage) return String(pendingCheckin.mileage);
    if (clientEmail.toLowerCase().includes('aziz')) return '18 420';
    return '28 420';
  }, [pendingCheckin, clientEmail]);

  const [km, setKm] = useState(initialKm);

  useEffect(() => {
    setKm(initialKm);
  }, [initialKm]);

  const parsedKm = parseInt(km.replace(/\s/g, '')) || 18420;
  const lastPassageKm = Math.max(1000, parsedKm - 6920);

  const [fuelPct, setFuelPct] = useState(65);
  const [fuelLabel, setFuelLabel] = useState('65% (~35 L)');
  const [selectedTool, setSelectedTool] = useState<string>('Rayure');
  const [checkEngine, setCheckEngine] = useState(false);
  const [tpms, setTpms] = useState(false);
  const [serviceDue, setServiceDue] = useState(true);
  const [activeDefectId, setActiveDefectId] = useState<number | null>(1);
  const [toastSuccess, setToastSuccess] = useState(false);
  const [draftToast, setDraftToast] = useState<string | null>(null);

  // Inventaire
  const [inventory, setInventory] = useState({
    carteGrise: true,
    ecrou: true,
    triangle: true,
    secours: true,
    objetsRetires: true,
  });

  // Canvas Signature
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawing = useRef(false);
  const [hasClientSigned, setHasClientSigned] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = canvas.parentElement?.clientWidth || 300;
    canvas.height = 120;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#05141f';
  }, []);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    isDrawing.current = true;
    setHasClientSigned(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const handleMouseUp = () => {
    isDrawing.current = false;
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasClientSigned(false);
  };

  const setFuel = (pct: number, label: string) => {
    setFuelPct(pct);
    setFuelLabel(label);
  };

  const buildCheckinPreviewItem = (): ServiceHistoryItem => ({
    id: `preview-chk-${Date.now()}`,
    date: new Date().toLocaleDateString('fr-FR'),
    year: String(new Date().getFullYear()),
    mileage: `${parsedKm.toLocaleString('fr-FR')} km`,
    title: `Fiche de Réception — ${serviceName}`,
    description: `Check-in atelier avec niveau carburant ${fuelLabel}.`,
    workshop: 'City Cars Kia La Goulette (Tunis)',
    advisor: 'M. Hédi Mansour',
    orNumber: `DOSSIER #CHK-${new Date().getFullYear()}-0892`,
    status: 'in_progress',
    vehicleName,
    plate: vehiclePlate,
    vin: vehicleVin,
    clientId,
    clientName: clientDisplayName,
    clientEmail,
    clientPhone,
  });

  const handleValidateCheckin = () => {
    setToastSuccess(true);
    setTimeout(() => {
      onGenerateOrder({
        checkinId: `#CHK-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
        vehicle: vehicleName,
        plate: vehiclePlate,
        vin: vehicleVin,
        km: parsedKm,
        fuelLevel: fuelLabel,
        clientId,
        clientName: clientDisplayName,
        clientEmail,
        clientPhone,
        serviceName,
      });
    }, 1200);
  };

  const confirmedInventoryCount = Object.values(inventory).filter(Boolean).length;

  return (
    <div className="w-full flex flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-[1720px] mx-auto">
      {/* Toast Notification */}
      {toastSuccess && (
        <div className="fixed bottom-6 right-6 bg-[#05141f] text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 z-50 border border-secondary animate-bounce">
          <span className="w-9 h-9 rounded-full bg-secondary flex items-center justify-center text-white shrink-0">
            <span className="material-symbols-outlined text-lg">done_all</span>
          </span>
          <div className="flex flex-col">
            <span className="font-headline-sm text-sm font-bold text-white">Dossier Validé avec Succès</span>
            <span className="font-body-sm text-xs text-[#778694]">
              OR généré pour {clientDisplayName} ({vehiclePlate}) — Transmis à l'atelier
            </span>
          </div>
        </div>
      )}

      {/* Official Header Bar */}
      <div className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4 border border-surface-container-high">
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-secondary text-on-secondary font-label-sm text-xs uppercase px-2.5 py-0.5 rounded-full font-bold tracking-wider">
              Réception Certifiée
            </span>
            <span className="font-label-md text-xs text-on-surface font-semibold tracking-tight font-mono">
              DOSSIER #CHK-{new Date().getFullYear()}-0892
            </span>
            <span className="text-outline-variant font-label-md text-xs">•</span>
            <span className="font-label-sm text-xs text-on-surface-variant flex items-center gap-1 font-mono">
              <span className="material-symbols-outlined text-sm">schedule</span>{' '}
              {new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} —{' '}
              {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <h1 className="font-headline-lg text-2xl sm:text-3xl text-on-surface font-bold tracking-tight">
            Fiche de Réception Véhicule <span className="text-on-surface-variant font-normal text-xl">(Check-in Officiel)</span>
          </h1>
        </div>

        <div className="flex items-center gap-2.5 self-start lg:self-center">
          <div className="flex items-center gap-1.5 bg-surface-container-low px-3 py-1.5 rounded-xl text-on-surface-variant border border-surface-container-high">
            <span className="material-symbols-outlined text-secondary text-base fill">verified_user</span>
            <span className="font-label-sm text-xs uppercase tracking-wider text-on-surface font-bold">
              Protocole SAV Kia v4.8
            </span>
          </div>
          <button
            onClick={() => onOpenPdfPreview(buildCheckinPreviewItem())}
            className="bg-surface-container px-3.5 py-1.5 rounded-xl font-label-sm text-xs text-on-surface hover:bg-surface-container-high transition-colors flex items-center gap-1.5 border border-surface-container-high"
            type="button"
          >
            <span className="material-symbols-outlined text-sm">print</span>
            <span>Export Brouillon</span>
          </button>
        </div>
      </div>

      {/* Bento Grid: Vehicle & Customer Identity */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* Vehicle (7 cols) */}
        <div className="md:col-span-7 bg-surface-container-lowest rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col justify-between border border-surface-container-high">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 rounded-xl bg-surface-container-low flex items-center justify-center shrink-0 border border-surface-container-high">
                <span className="material-symbols-outlined text-3xl text-on-surface">directions_car</span>
              </div>
              <div className="flex flex-col">
                <span className="font-label-sm text-xs uppercase tracking-wider text-secondary font-bold">
                  Véhicule Pris en Charge • Client : {clientName}
                </span>
                <span className="font-headline-md text-xl font-bold text-on-surface">{vehicleName}</span>
                <span className="font-body-md text-xs sm:text-sm text-on-surface-variant">
                  {serviceName}
                </span>
              </div>
            </div>
            <span className="bg-[#05141f] text-white font-label-md text-xs px-3 py-1 rounded-lg tracking-widest font-mono shrink-0 shadow-sm">
              {vehiclePlate}
            </span>
          </div>

          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 bg-surface-container-low p-3.5 rounded-xl border border-surface-container-high">
            <div className="flex flex-col">
              <span className="font-label-sm text-[10px] text-on-surface-variant uppercase">Châssis (VIN)</span>
              <span className="font-label-md text-xs font-bold text-on-surface font-mono">{vehicleVin}</span>
            </div>
            <div className="flex flex-col">
              <span className="font-label-sm text-[10px] text-on-surface-variant uppercase">Garantie Usine</span>
              <span className="font-label-md text-xs font-bold text-on-surface">Actif (5 ans / 150k)</span>
            </div>
            <div className="flex flex-col">
              <span className="font-label-sm text-[10px] text-on-surface-variant uppercase">Dernier Passage</span>
              <span className="font-label-md text-xs font-bold text-on-surface font-mono">{lastPassageKm.toLocaleString('fr-FR')} km</span>
            </div>
            <div className="flex flex-col">
              <span className="font-label-sm text-[10px] text-on-surface-variant uppercase">Poste Atelier</span>
              <span className="font-label-md text-xs font-bold text-secondary flex items-center gap-1 font-mono">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary" /> Pont #04 (Méca)
              </span>
            </div>
          </div>
        </div>

        {/* Customer (5 cols) */}
        <div className="md:col-span-5 bg-surface-container-lowest rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col justify-between border border-surface-container-high">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-xs uppercase tracking-wider text-on-surface-variant font-bold">
              Titulaire de la Carte Grise
            </span>
            <span className="bg-surface-container px-2 py-0.5 rounded font-label-sm text-xs text-on-surface font-mono">
              {clientIdCode}
            </span>
          </div>

          <div className="my-3 flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-full bg-primary/20 text-primary border border-primary/30 flex items-center justify-center font-headline-sm text-base font-bold shadow-sm">
              {clientInitials}
            </div>
            <div className="flex flex-col">
              <span className="font-headline-sm text-base font-bold text-on-surface">{clientDisplayName}</span>
              <span className="font-body-sm text-xs text-on-surface-variant">
                {customerBadge}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <a
              className="flex items-center gap-1.5 p-2 bg-surface-container-low rounded-lg text-on-surface hover:bg-surface-container transition-colors border border-surface-container-high"
              href={`tel:${clientPhone}`}
            >
              <span className="material-symbols-outlined text-base text-secondary">phone</span>
              <span className="font-label-md text-xs font-semibold">{clientPhone}</span>
            </a>
            <a
              className="flex items-center gap-1.5 p-2 bg-surface-container-low rounded-lg text-on-surface border border-surface-container-high hover:bg-surface-container transition-colors"
              href={`mailto:${clientEmail}`}
              title={clientEmail}
            >
              <span className="material-symbols-outlined text-base text-on-surface-variant">mail</span>
              <span className="font-label-sm text-xs truncate">{clientEmail}</span>
            </a>
          </div>
        </div>
      </div>

      {/* Compteur, Jauge & Tableau de Bord */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* 1. Kilométrage */}
        <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col justify-between border border-surface-container-high">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-xs uppercase tracking-wider font-bold text-on-surface-variant">
              Relevé Kilométrique
            </span>
            <span className="inline-flex items-center gap-1 font-label-sm text-[10px] bg-surface-container px-2 py-0.5 rounded text-on-surface font-semibold">
              <span className="material-symbols-outlined text-xs text-secondary fill">check_circle</span> ODO Certifié
            </span>
          </div>

          <div className="my-4 flex flex-col items-center justify-center text-center">
            <div className="bg-surface-container-low px-4 py-3 rounded-xl flex items-baseline gap-2 w-full justify-center border border-surface-container-high">
              <input
                className="bg-transparent font-headline-xl text-3xl font-bold tracking-tight text-on-surface text-center w-40 focus:outline-none font-mono"
                value={km}
                onChange={(e) => setKm(e.target.value)}
              />
              <span className="font-label-lg text-sm text-on-surface-variant font-bold">KM</span>
            </div>
            <div className="mt-2 flex items-center gap-1 text-on-surface-variant text-xs">
              <span>+6 920 km depuis dernière révision (Conforme)</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs bg-surface-container-low p-2 rounded-lg border border-surface-container-high">
            <span className="text-on-surface-variant">Dernier index : 21 500 km</span>
            <span className="text-secondary font-semibold font-label-sm text-xs">Delta : +32.1%</span>
          </div>
        </div>

        {/* 2. Jauge Carburant */}
        <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col justify-between border border-surface-container-high">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-xs uppercase tracking-wider font-bold text-on-surface-variant">
              Jauge Réservoir
            </span>
            <span className="font-label-md text-xs font-bold text-secondary font-mono">{fuelLabel}</span>
          </div>

          <div className="my-3 flex flex-col gap-2">
            <div className="flex justify-between items-center text-on-surface-variant font-label-sm text-[10px]">
              <span>R</span>
              <span>1/4</span>
              <span>1/2</span>
              <span>3/4</span>
              <span>1/1</span>
            </div>
            <div className="w-full bg-surface-container-high h-3.5 rounded-full overflow-hidden p-0.5 border border-surface-container-highest">
              <div
                className="h-full bg-primary rounded-full transition-all duration-300"
                style={{ width: `${fuelPct}%` }}
              />
            </div>
            <div className="flex justify-between items-center text-on-surface-variant font-label-sm text-xs">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-xs text-secondary">local_gas_station</span> Sans Plomb 95
              </span>
              <span className="text-on-surface font-semibold font-mono">Autonomie : ~480 km</span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-1.5 pt-1">
            {[
              { pct: 25, label: '25% (~13 L)', text: '1/4' },
              { pct: 50, label: '50% (~27 L)', text: '1/2' },
              { pct: 65, label: '65% (~35 L)', text: '~3/4' },
              { pct: 100, label: '100% (~54 L)', text: 'Plein' },
            ].map((f) => (
              <button
                key={f.text}
                type="button"
                onClick={() => setFuel(f.pct, f.label)}
                className={`py-1 text-center font-label-sm text-xs rounded-lg transition-colors border ${
                  fuelPct === f.pct
                    ? 'bg-secondary text-on-secondary font-bold border-secondary shadow-sm'
                    : 'bg-surface-container-low hover:bg-surface-container text-on-surface border-surface-container-high'
                }`}
              >
                {f.text}
              </button>
            ))}
          </div>
        </div>

        {/* 3. Voyants Tableau de Bord */}
        <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm flex flex-col justify-between border border-surface-container-high">
          <div className="flex items-center justify-between">
            <span className="font-label-sm text-xs uppercase tracking-wider font-bold text-on-surface-variant">
              Voyants Combiné
            </span>
            <span className="font-label-sm text-xs text-secondary font-semibold">
              {[checkEngine, tpms, serviceDue].filter(Boolean).length} Notification Active
            </span>
          </div>

          <div className="flex flex-col gap-1.5 my-2">
            <label className="flex items-center justify-between p-2 rounded-lg bg-surface-container-low hover:bg-surface-container cursor-pointer transition-colors border border-surface-container-high">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-on-surface-variant">warning</span>
                <span className="font-body-sm text-xs text-on-surface">Anomalie Moteur (Check Engine)</span>
              </div>
              <input
                type="checkbox"
                checked={checkEngine}
                onChange={(e) => setCheckEngine(e.target.checked)}
                className="w-4 h-4 accent-secondary rounded"
              />
            </label>

            <label className="flex items-center justify-between p-2 rounded-lg bg-surface-container-low hover:bg-surface-container cursor-pointer transition-colors border border-surface-container-high">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-on-surface-variant">tire_repair</span>
                <span className="font-body-sm text-xs text-on-surface">Pression pneumatiques (TPMS)</span>
              </div>
              <input
                type="checkbox"
                checked={tpms}
                onChange={(e) => setTpms(e.target.checked)}
                className="w-4 h-4 accent-secondary rounded"
              />
            </label>

            <label className="flex items-center justify-between p-2 rounded-lg bg-surface-container-high cursor-pointer transition-colors border border-secondary/30">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-secondary">build</span>
                <span className="font-body-sm text-xs font-semibold text-on-surface">Échéance Service / Révision</span>
              </div>
              <input
                type="checkbox"
                checked={serviceDue}
                onChange={(e) => setServiceDue(e.target.checked)}
                className="w-4 h-4 accent-secondary rounded"
              />
            </label>
          </div>

          <div className="flex items-center justify-between pt-1 font-label-sm text-xs text-on-surface-variant">
            <span>Scan OBD-II : Non exécuté</span>
            <button
              onClick={() => alert('Diagnostic OBD-II lancé via l’interface Bluetooth VCI #09... Aucun code défaut DTC actif.')}
              className="text-secondary font-semibold hover:underline"
              type="button"
            >
              Lancer pré-diagnostic
            </button>
          </div>
        </div>
      </div>

      {/* Inspection Carrosserie & Dommages 360° */}
      <div className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col gap-5 border border-surface-container-high">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-headline-md text-lg sm:text-xl font-bold text-on-surface">
                Cartographie Carrosserie 360°
              </span>
              <span className="bg-secondary-fixed text-on-secondary-fixed font-label-sm text-xs px-2.5 py-0.5 rounded-full font-bold">
                {INITIAL_DEFECTS.length} Défauts Relevés
              </span>
            </div>
            <p className="font-body-sm text-xs text-on-surface-variant">
              Sélectionnez un type d'anomalie puis touchez le schéma pour positionner ou inspecter l'observation.
            </p>
          </div>

          {/* Type tools */}
          <div className="flex flex-wrap items-center gap-1.5">
            {['Rayure', 'Bosse / Impact', 'Fissure', 'Pièce Manquante'].map((tool) => (
              <button
                key={tool}
                onClick={() => setSelectedTool(tool)}
                className={`px-3 py-1.5 rounded-lg font-label-sm text-xs flex items-center gap-1.5 border transition-all ${
                  selectedTool === tool
                    ? 'bg-primary text-on-primary border-primary shadow-sm'
                    : 'bg-surface-container text-on-surface hover:bg-surface-container-high border-surface-container-high'
                }`}
                type="button"
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    selectedTool === tool ? 'bg-secondary' : 'bg-on-surface-variant'
                  }`}
                />
                <span>{tool}</span>
              </button>
            ))}

            <button
              onClick={() => alert('Appareil photo tablette activé pour capture de défaut.')}
              className="bg-secondary text-on-secondary px-3 py-1.5 rounded-lg font-label-sm text-xs flex items-center gap-1.5 font-semibold hover:bg-secondary-container transition-colors shadow-sm ml-auto sm:ml-0"
              type="button"
            >
              <span className="material-symbols-outlined text-sm">photo_camera</span>
              <span>Prendre Photo</span>
            </button>
          </div>
        </div>

        {/* Blueprint Layout & Defect Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
          {/* Blueprint SVG (7 cols) */}
          <div className="lg:col-span-7 bg-surface-container-low rounded-2xl p-4 flex flex-col items-center justify-center relative min-h-[380px] border border-surface-container-high">
            <div className="absolute top-3 left-3 flex items-center gap-2">
              <span className="font-label-sm text-xs uppercase tracking-wider text-on-surface-variant font-semibold">
                Vue Aérienne & Profil SUV (Sportage)
              </span>
            </div>

            {/* Technical Car Blueprint SVG */}
            <div className="relative w-full max-w-lg aspect-[16/9] flex items-center justify-center">
              <svg className="w-full h-full text-outline-variant select-none" viewBox="0 0 700 360">
                <defs>
                  <pattern id="grid-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
                    <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeWidth="0.5" />
                  </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid-pattern)" />

                {/* Car Chassis */}
                <path
                  d="M220,70 Q350,55 480,70 Q530,75 550,110 L560,180 Q560,200 550,250 Q530,285 480,290 Q350,305 220,290 Q170,285 150,250 L140,180 Q140,160 150,110 Q170,75 220,70 Z"
                  fill="#F5F3F4"
                  stroke="#43474B"
                  strokeWidth="2.5"
                />
                {/* Windshield */}
                <path d="M230,105 Q350,95 470,105 L450,145 Q350,140 250,145 Z" fill="#E4E2E3" stroke="#74777C" strokeWidth="1.5" />
                {/* Panoramic Sunroof */}
                <rect x="255" y="155" width="190" height="60" rx="6" fill="#0E1D28" fillOpacity="0.12" stroke="#74777C" strokeWidth="1.2" />
                {/* Rear Window */}
                <path d="M245,225 Q350,220 455,225 L470,255 Q350,262 230,255 Z" fill="#E4E2E3" stroke="#74777C" strokeWidth="1.5" />
                {/* Hood Lines */}
                <line x1="310" y1="72" x2="310" y2="100" stroke="#C4C7CC" strokeWidth="1.5" />
                <line x1="390" y1="72" x2="390" y2="100" stroke="#C4C7CC" strokeWidth="1.5" />
                {/* Side Mirrors */}
                <path d="M142,125 L118,120 Q112,125 118,135 L144,136 Z" fill="#43474B" />
                <path d="M558,125 L582,120 Q588,125 582,135 L556,136 Z" fill="#43474B" />
                {/* Wheels */}
                <rect x="120" y="80" width="22" height="42" rx="3" fill="#1B1C1C" />
                <rect x="558" y="80" width="22" height="42" rx="3" fill="#1B1C1C" />
                <rect x="120" y="238" width="22" height="42" rx="3" fill="#1B1C1C" />
                <rect x="558" y="238" width="22" height="42" rx="3" fill="#1B1C1C" />
                {/* Grille Accent */}
                <path d="M320,62 Q350,65 380,62" fill="none" stroke="#B70F31" strokeWidth="3" strokeLinecap="round" />
                <text x="350" y="52" fill="#74777C" fontSize="10" fontFamily="JetBrains Mono" letterSpacing="1" textAnchor="middle">
                  AVANT (MOTEUR)
                </text>
                <text x="350" y="325" fill="#74777C" fontSize="10" fontFamily="JetBrains Mono" letterSpacing="1" textAnchor="middle">
                  ARRIÈRE (HAYON)
                </text>
              </svg>

              {/* Hotspots */}
              {INITIAL_DEFECTS.map((defect) => (
                <button
                  key={defect.id}
                  onClick={() => setActiveDefectId(defect.id)}
                  style={{ top: `${defect.y}%`, left: `${defect.x}%` }}
                  className={`group absolute transform -translate-x-1/2 -translate-y-1/2 focus:outline-none transition-transform ${
                    activeDefectId === defect.id ? 'scale-125 z-20' : 'hover:scale-110 z-10'
                  }`}
                  title={defect.title}
                  type="button"
                >
                  <span className="w-7 h-7 rounded-full bg-secondary text-on-secondary font-label-sm text-xs font-bold flex items-center justify-center shadow-lg ring-2 ring-white">
                    {defect.id}
                  </span>
                  {activeDefectId === defect.id && (
                    <span className="absolute inset-0 w-7 h-7 rounded-full bg-secondary/40 animate-ping pointer-events-none" />
                  )}
                </button>
              ))}
            </div>

            <div className="w-full flex items-center justify-between text-on-surface-variant font-label-sm text-xs mt-2 pt-2 border-t border-surface-container-high">
              <span className="flex items-center gap-1.5 font-semibold text-secondary">
                <span className="w-2 h-2 rounded-full bg-secondary" /> 3 points signalés au client
              </span>
              <span>Contrôle visuel bilatéral contradictoire</span>
            </div>
          </div>

          {/* Defect Cards List (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-2.5">
            {INITIAL_DEFECTS.map((item) => {
              const isActive = activeDefectId === item.id;
              return (
                <div
                  key={item.id}
                  onClick={() => setActiveDefectId(item.id)}
                  className={`p-3.5 rounded-xl flex items-start gap-3 transition-all cursor-pointer border ${
                    isActive
                      ? 'bg-surface-container ring-2 ring-secondary border-transparent shadow-sm'
                      : 'bg-surface-container-low hover:bg-surface-container border-surface-container-high'
                  }`}
                >
                  <span className="w-6 h-6 rounded-full bg-secondary text-on-secondary font-label-sm text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                    {item.id}
                  </span>
                  <div className="flex-1 flex flex-col gap-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-headline-sm text-sm font-bold text-on-surface">{item.title}</span>
                      <span className="font-label-sm text-xs text-secondary font-mono">{item.type}</span>
                    </div>
                    <p className="font-body-sm text-xs text-on-surface-variant leading-snug">{item.description}</p>
                    {item.photoUrl ? (
                      <div className="mt-1 flex items-center gap-2">
                        <img
                          src={item.photoUrl}
                          alt={item.title}
                          className="w-12 h-12 rounded-lg object-cover border border-surface-container-high shadow-sm"
                        />
                        <span className="font-label-sm text-[11px] text-on-surface-variant flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm text-emerald-600 fill">check_circle</span>
                          Photo HD horodatée
                        </span>
                      </div>
                    ) : (
                      <span className="font-label-sm text-[10px] text-on-surface-variant italic mt-0.5">
                        Photo optionnelle non requise (&lt; 2mm)
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Inventaire de Bord & Conformité Sécurité */}
      <div className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col gap-4 border border-surface-container-high">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="font-headline-md text-lg sm:text-xl font-bold text-on-surface">
              Inventaire de Bord & Équipements de Sécurité
            </span>
            <span className="font-body-sm text-xs text-on-surface-variant">
              Vérification physique contradictoire en présence du propriétaire
            </span>
          </div>
          <span className="bg-surface-container px-3 py-1 rounded-lg font-label-sm text-xs text-on-surface font-semibold border border-surface-container-high">
            {confirmedInventoryCount}/5 Confirmés
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-1">
          <label className="p-3 bg-surface-container-low rounded-xl flex items-center justify-between cursor-pointer hover:bg-surface-container transition-colors border border-surface-container-high">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-lg text-on-surface">badge</span>
              <span className="font-body-sm text-xs font-medium text-on-surface">Carte Grise</span>
            </div>
            <input
              type="checkbox"
              checked={inventory.carteGrise}
              onChange={(e) => setInventory({ ...inventory, carteGrise: e.target.checked })}
              className="w-4 h-4 accent-secondary rounded"
            />
          </label>

          <label className="p-3 bg-surface-container-low rounded-xl flex items-center justify-between cursor-pointer hover:bg-surface-container transition-colors border border-surface-container-high">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-lg text-on-surface">key</span>
              <span className="font-body-sm text-xs font-medium text-on-surface">Écrou antivol</span>
            </div>
            <input
              type="checkbox"
              checked={inventory.ecrou}
              onChange={(e) => setInventory({ ...inventory, ecrou: e.target.checked })}
              className="w-4 h-4 accent-secondary rounded"
            />
          </label>

          <label className="p-3 bg-surface-container-low rounded-xl flex items-center justify-between cursor-pointer hover:bg-surface-container transition-colors border border-surface-container-high">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-lg text-on-surface">warning_amber</span>
              <span className="font-body-sm text-xs font-medium text-on-surface">Gilet & Triangle</span>
            </div>
            <input
              type="checkbox"
              checked={inventory.triangle}
              onChange={(e) => setInventory({ ...inventory, triangle: e.target.checked })}
              className="w-4 h-4 accent-secondary rounded"
            />
          </label>

          <label className="p-3 bg-surface-container-low rounded-xl flex items-center justify-between cursor-pointer hover:bg-surface-container transition-colors border border-surface-container-high">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-lg text-on-surface">tire_repair</span>
              <span className="font-body-sm text-xs font-medium text-on-surface">Roue / Kit Secours</span>
            </div>
            <input
              type="checkbox"
              checked={inventory.secours}
              onChange={(e) => setInventory({ ...inventory, secours: e.target.checked })}
              className="w-4 h-4 accent-secondary rounded"
            />
          </label>

          <label className="p-3 bg-surface-container-low rounded-xl flex items-center justify-between cursor-pointer hover:bg-surface-container transition-colors border border-surface-container-high">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-lg text-on-surface">lock</span>
              <span className="font-body-sm text-xs font-medium text-on-surface">Objets retirés</span>
            </div>
            <input
              type="checkbox"
              checked={inventory.objetsRetires}
              onChange={(e) => setInventory({ ...inventory, objetsRetires: e.target.checked })}
              className="w-4 h-4 accent-secondary rounded"
            />
          </label>
        </div>
      </div>

      {/* Validation Juridique & Double Signature Numérique */}
      <div className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 shadow-sm flex flex-col gap-5 border border-surface-container-high">
        <div className="flex flex-col">
          <span className="font-headline-md text-lg sm:text-xl font-bold text-on-surface">
            Validation Juridique & Double Signature Numérique
          </span>
          <span className="font-body-sm text-xs text-on-surface-variant">
            L'apposition de la signature engage la responsabilité des parties sur l'état des lieux d'entrée.
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Pad Client */}
          <div className="bg-surface-container-low p-4 rounded-xl flex flex-col justify-between border border-surface-container-high">
            <div className="flex items-center justify-between mb-2">
              <span className="font-label-sm text-xs uppercase font-bold text-on-surface">
                Signature Client ({clientDisplayName})
              </span>
              <button
                onClick={clearSignature}
                className="text-on-surface-variant hover:text-secondary font-label-sm text-xs flex items-center gap-1"
                type="button"
              >
                <span className="material-symbols-outlined text-sm">refresh</span>
                <span>Effacer</span>
              </button>
            </div>

            <div className="bg-surface-container-lowest rounded-xl h-32 relative overflow-hidden flex items-center justify-center border border-surface-container-high">
              <canvas
                ref={canvasRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                className="w-full h-full cursor-crosshair"
              />
              {!hasClientSigned && (
                <span className="pointer-events-none absolute text-on-surface-variant/40 font-body-sm text-xs font-medium">
                  Tracez la signature du client ici (tactile ou souris)
                </span>
              )}
            </div>

            <div className="mt-2.5 flex items-center justify-between text-on-surface-variant font-label-sm text-[11px] font-mono">
              <span className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-secondary" /> SHA-256: 7f8c...391a
              </span>
              <span>
                {new Date().toLocaleDateString('fr-FR')} • {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>

          {/* Signature Chef d'Atelier */}
          <div className="bg-surface-container-low p-4 rounded-xl flex flex-col justify-between border border-surface-container-high">
            <div className="flex items-center justify-between mb-2">
              <span className="font-label-sm text-xs uppercase font-bold text-on-surface">
                Conseiller SAV / Chef d'Atelier
              </span>
              <span className="font-label-sm text-[10px] bg-surface-container px-2 py-0.5 rounded text-on-surface font-mono">
                Agent #4012
              </span>
            </div>

            <div className="bg-surface-container-lowest rounded-xl h-32 relative overflow-hidden flex flex-col items-center justify-center p-3 border border-surface-container-high">
              <svg className="w-48 h-14 text-primary" viewBox="0 0 300 70">
                <path
                  d="M 20 45 C 50 20, 80 15, 110 35 C 130 50, 150 60, 180 30 C 200 10, 210 25, 230 40 C 250 55, 270 45, 280 20 M 60 55 L 240 35"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span className="font-headline-sm text-sm font-bold text-on-surface mt-1">Hédi Mansour</span>
              <span className="font-label-sm text-[10px] text-on-surface-variant">
                Chef d'Atelier Principal • Kia La Goulette
              </span>
            </div>

            <div className="mt-2.5 flex items-center justify-between text-on-surface-variant font-label-sm text-[11px] font-mono">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-xs text-secondary fill">verified</span>
                Certifié Badge NFC
              </span>
              <span>Horodaté 08:48:12</span>
            </div>
          </div>
        </div>

        {/* Action Footer CTA */}
        {draftToast && (
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs font-medium flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-emerald-700">check_circle</span>
            <span>{draftToast}</span>
          </div>
        )}
        <div className="pt-3 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-surface-container">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => {
                setDraftToast(`Brouillon de la fiche de réception enregistré localement pour ${clientDisplayName} (${vehiclePlate}).`);
                setTimeout(() => setDraftToast(null), 4000);
              }}
              className="w-full sm:w-auto bg-surface-container text-on-surface hover:bg-surface-container-high px-4 py-2.5 rounded-xl font-headline-sm text-xs font-semibold transition-colors border border-surface-container-high"
              type="button"
            >
              Enregistrer Brouillon
            </button>

            <button
              onClick={() => onOpenPdfPreview(buildCheckinPreviewItem())}
              className="w-full sm:w-auto bg-surface-container text-on-surface hover:bg-surface-container-high px-4 py-2.5 rounded-xl font-label-md text-xs flex items-center justify-center gap-1.5 transition-colors border border-surface-container-high"
              type="button"
            >
              <span className="material-symbols-outlined text-base">picture_as_pdf</span>
              <span>Fiche PDF</span>
            </button>
          </div>

          <button
            onClick={handleValidateCheckin}
            className="w-full sm:w-auto bg-secondary text-on-secondary hover:bg-secondary-container px-6 py-3 rounded-xl font-headline-sm text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-md group active:scale-95"
            type="button"
          >
            <span>Valider la Réception & Générer l'OR</span>
            <span className="material-symbols-outlined text-base group-hover:translate-x-1 transition-transform">
              arrow_forward
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
