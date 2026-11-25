import { useState, useEffect, useMemo } from 'react';
import {
  workshopSyncService,
  WorkshopTechnician,
  WorkshopBay,
  WorkshopSettings,
  TechnicianRole,
  KiaCertification,
  TechnicianAvailability,
  BaySpecialty,
  SoundProfileMode,
} from '../../services/workshopSyncService';
import { INITIAL_ORDERS } from '../../data/mockData';
import { soundService, SOUND_CATALOG, SoundEffectId } from '../../services/soundService';

interface ChefTeamSettingsModuleProps {
  onNavigateToOrders?: () => void;
}

const ROLES: TechnicianRole[] = [
  'Master Tech',
  'Tech Généraliste',
  'Spécialiste EV/HEV',
  'Contrôleur Qualité',
];

const CERTIFICATIONS: KiaCertification[] = [
  'Haute Tension EV/HEV',
  'Diagnostic KDS',
  'Freinage/ADAS',
  'Climatisation',
];

const BAY_SPECIALTIES: BaySpecialty[] = [
  'Service Rapide',
  'Mécanique lourde',
  'Diag EV/BMS',
  'Géométrie',
  'Climatisation',
  'Check-in',
];

const AVAILABILITY_OPTIONS: {
  id: TechnicianAvailability;
  label: string;
  short: string;
  activeClass: string;
}[] = [
  { id: 'en_poste', label: 'En poste', short: 'En poste', activeClass: 'bg-emerald-700 text-white border-emerald-700' },
  { id: 'en_pause', label: 'En pause', short: 'Pause', activeClass: 'bg-amber-600 text-white border-amber-600' },
  { id: 'essai_route', label: 'En essai route', short: 'Essai route', activeClass: 'bg-primary text-white border-primary' },
  { id: 'absent', label: 'Absent', short: 'Absent', activeClass: 'bg-secondary text-white border-secondary' },
];

type SubTab = 'team' | 'bays' | 'settings';

export function ChefTeamSettingsModule({ onNavigateToOrders }: ChefTeamSettingsModuleProps) {
  const [subTab, setSubTab] = useState<SubTab>('team');
  const [technicians, setTechnicians] = useState<WorkshopTechnician[]>(() =>
    workshopSyncService.getWorkshopTechnicians()
  );
  const [bays, setBays] = useState<WorkshopBay[]>(() =>
    workshopSyncService.getWorkshopBays()
  );
  const [settings, setSettings] = useState<WorkshopSettings>(() =>
    workshopSyncService.getWorkshopSettings()
  );

  const [techSearch, setTechSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | TechnicianRole>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | TechnicianAvailability | 'inactive'>('all');

  const [toast, setToast] = useState<string | null>(null);

  // Formulaire ajout / édition technicien
  const [isTechModalOpen, setIsTechModalOpen] = useState(false);
  const [editingTechId, setEditingTechId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formRole, setFormRole] = useState<TechnicianRole>('Tech Généraliste');
  const [formPhone, setFormPhone] = useState('');
  const [formShiftStart, setFormShiftStart] = useState('08:00');
  const [formShiftEnd, setFormShiftEnd] = useState('17:00');
  const [formMaxLoad, setFormMaxLoad] = useState(85);
  const [formCurrentLoad, setFormCurrentLoad] = useState(30);
  const [formCerts, setFormCerts] = useState<KiaCertification[]>(['Diagnostic KDS']);
  const [formActive, setFormActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  // Gestion motif maintenance pont
  const [maintDraftBayId, setMaintDraftBayId] = useState<string | null>(null);
  const [maintDraftReason, setMaintDraftReason] = useState('');

  // Gestion date de fermeture exceptionnelle
  const [newClosedDate, setNewClosedDate] = useState('');

  // Banc de test sonore dans Paramètres Atelier
  const [soundTestRole, setSoundTestRole] = useState<'client' | 'chef' | 'tech'>('client');
  const [lastTestedSoundId, setLastTestedSoundId] = useState<SoundEffectId | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  useEffect(() => {
    const refreshTeam = () => setTechnicians(workshopSyncService.getWorkshopTechnicians());
    const refreshBays = () => setBays(workshopSyncService.getWorkshopBays());
    const refreshSettings = () => setSettings(workshopSyncService.getWorkshopSettings());

    window.addEventListener('k_dms_team_updated', refreshTeam);
    window.addEventListener('k_dms_bays_updated', refreshBays);
    window.addEventListener('k_dms_settings_updated', refreshSettings);
    return () => {
      window.removeEventListener('k_dms_team_updated', refreshTeam);
      window.removeEventListener('k_dms_bays_updated', refreshBays);
      window.removeEventListener('k_dms_settings_updated', refreshSettings);
    };
  }, []);

  const impactAlerts = useMemo(
    () => workshopSyncService.getAssignmentImpactAlerts(INITIAL_ORDERS),
    [technicians, bays]
  );

  const activeTechs = technicians.filter((t) => t.active);
  const inPostTechs = activeTechs.filter((t) => t.availability === 'en_poste');
  const evCertifiedAvailableCount = inPostTechs.filter((t) =>
    t.certifications.includes('Haute Tension EV/HEV')
  ).length;
  const openBaysCount = bays.filter((b) => b.status === 'open').length;

  const filteredTechs = useMemo(() => {
    return technicians.filter((t) => {
      const q = techSearch.trim().toLowerCase();
      const matchesSearch =
        !q ||
        t.name.toLowerCase().includes(q) ||
        t.role.toLowerCase().includes(q) ||
        t.certifications.some((c) => c.toLowerCase().includes(q));
      const matchesRole = roleFilter === 'all' || t.role === roleFilter;
      const matchesStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'inactive'
          ? !t.active
          : t.active && t.availability === statusFilter;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [technicians, techSearch, roleFilter, statusFilter]);

  const openCreateTechModal = () => {
    setEditingTechId(null);
    setFormName('');
    setFormRole('Tech Généraliste');
    setFormPhone('+216 98 ');
    setFormShiftStart('08:00');
    setFormShiftEnd('17:00');
    setFormMaxLoad(85);
    setFormCurrentLoad(20);
    setFormCerts(['Diagnostic KDS']);
    setFormActive(true);
    setFormError(null);
    setIsTechModalOpen(true);
  };

  const openEditTechModal = (tech: WorkshopTechnician) => {
    setEditingTechId(tech.id);
    setFormName(tech.name);
    setFormRole(tech.role);
    setFormPhone(tech.phone || '');
    setFormShiftStart(tech.shiftStart);
    setFormShiftEnd(tech.shiftEnd);
    setFormMaxLoad(tech.maxLoadPercent);
    setFormCurrentLoad(tech.currentLoadPercent);
    setFormCerts([...tech.certifications]);
    setFormActive(tech.active);
    setFormError(null);
    setIsTechModalOpen(true);
  };

  const toggleFormCert = (cert: KiaCertification) => {
    setFormCerts((prev) =>
      prev.includes(cert) ? prev.filter((c) => c !== cert) : [...prev, cert]
    );
  };

  const handleSaveTech = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = formName.trim();
    if (cleanName.length < 3) {
      setFormError('Veuillez saisir le nom complet du technicien.');
      return;
    }

    const initials = cleanName
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || '')
      .join('');

    const existing = editingTechId
      ? technicians.find((t) => t.id === editingTechId)
      : undefined;

    const payload: WorkshopTechnician = {
      id: existing?.id || `tech-${Date.now().toString().slice(-5)}`,
      name: cleanName,
      initials: initials || 'TK',
      role: formRole,
      certifications: formCerts,
      availability: existing?.availability || 'en_poste',
      shiftStart: formShiftStart,
      shiftEnd: formShiftEnd,
      maxLoadPercent: Math.max(20, Math.min(100, Number(formMaxLoad) || 85)),
      currentLoadPercent: Math.max(0, Math.min(100, Number(formCurrentLoad) || 0)),
      active: formActive,
      assignedBayId: existing?.assignedBayId,
      phone: formPhone.trim() || undefined,
      avatar: existing?.avatar,
    };

    const next = workshopSyncService.upsertWorkshopTechnician(payload);
    setTechnicians(next);
    setIsTechModalOpen(false);
    showToast(
      existing
        ? `Fiche de ${payload.name} mise à jour et synchronisée.`
        : `${payload.name} ajouté à l'équipe d'atelier.`
    );
  };

  const handleToggleAvailability = (tech: WorkshopTechnician, avail: TechnicianAvailability) => {
    const next = workshopSyncService.updateTechnicianAvailability(tech.id, avail);
    setTechnicians(next);
    const label = AVAILABILITY_OPTIONS.find((o) => o.id === avail)?.label || avail;
    if (avail === 'absent') {
      const currentOrders = workshopSyncService.getOrders();
      const alerts = workshopSyncService.getAssignmentImpactAlerts(
        currentOrders.length > 0 ? currentOrders : INITIAL_ORDERS
      );
      if (alerts.some((a) => a.resourceName === tech.name)) {
        soundService.play('chef_resource_conflict');
      }
    }
    showToast(`${tech.name} passé en statut : ${label}`);
  };

  const handleToggleActive = (tech: WorkshopTechnician) => {
    const nextTech: WorkshopTechnician = {
      ...tech,
      active: !tech.active,
      availability: !tech.active ? 'en_poste' : 'absent',
    };
    const next = workshopSyncService.upsertWorkshopTechnician(nextTech);
    setTechnicians(next);
    if (!nextTech.active) {
      const currentOrders = workshopSyncService.getOrders();
      const alerts = workshopSyncService.getAssignmentImpactAlerts(
        currentOrders.length > 0 ? currentOrders : INITIAL_ORDERS
      );
      if (alerts.some((a) => a.resourceName === tech.name)) {
        soundService.play('chef_resource_conflict');
      }
    }
    showToast(
      nextTech.active
        ? `Compte atelier de ${tech.name} réactivé.`
        : `${tech.name} désactivé et exclu des nouvelles affectations.`
    );
  };

  const handleBaySpecialtyChange = (bayId: string, specialty: BaySpecialty) => {
    const next = workshopSyncService.updateWorkshopBay(bayId, { specialty });
    setBays(next);
    showToast(`Spécialité de PONT ${bayId} mise à jour (${specialty}).`);
  };

  const handleBayLeadChange = (bayId: string, leadTechId: string) => {
    const tech = technicians.find((t) => t.id === leadTechId);
    const next = workshopSyncService.updateWorkshopBay(bayId, {
      leadTechnicianId: tech ? tech.id : undefined,
      leadTechnicianName: tech ? tech.name : undefined,
    });
    setBays(next);
    showToast(
      tech
        ? `${tech.name} défini comme titulaire sur PONT ${bayId}.`
        : `Titulaire retiré sur PONT ${bayId}.`
    );
  };

  const handleConfirmBayMaintenance = (bay: WorkshopBay) => {
    const next = workshopSyncService.toggleBayMaintenance(
      bay.id,
      'maintenance',
      maintDraftReason || 'Maintenance préventive / vérification hydraulique'
    );
    setBays(next);
    setMaintDraftBayId(null);
    setMaintDraftReason('');
    const currentOrders = workshopSyncService.getOrders();
    const alerts = workshopSyncService.getAssignmentImpactAlerts(
      currentOrders.length > 0 ? currentOrders : INITIAL_ORDERS
    );
    if (alerts.some((a) => a.type === 'bay_maintenance' && a.resourceName.includes(bay.id))) {
      soundService.play('chef_resource_conflict');
    }
    showToast(`${bay.name} basculé en maintenance — capacité atelier ajustée.`);
  };

  const handleReopenBay = (bay: WorkshopBay) => {
    const next = workshopSyncService.toggleBayMaintenance(bay.id, 'open');
    setBays(next);
    showToast(`${bay.name} rouvert et disponible pour les affectations.`);
  };

  const handleAddClosedDate = () => {
    if (!newClosedDate) return;
    if (settings.closedDates.includes(newClosedDate)) {
      setNewClosedDate('');
      return;
    }
    const nextSettings = {
      ...settings,
      closedDates: [...settings.closedDates, newClosedDate].sort(),
    };
    setSettings(nextSettings);
    setNewClosedDate('');
  };

  const handleRemoveClosedDate = (dateIso: string) => {
    setSettings({
      ...settings,
      closedDates: settings.closedDates.filter((d) => d !== dateIso),
    });
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    const saved = workshopSyncService.saveWorkshopSettings(settings);
    setSettings(saved);
    soundService.syncFromWorkshopSettings();
    showToast('Paramètres atelier enregistrés (Firestore & temps réel actifs).');
  };

  const handleResetSettings = () => {
    const restored = workshopSyncService.resetWorkshopSettingsToDefaults();
    setSettings(restored);
    soundService.syncFromWorkshopSettings();
    showToast('Paramètres par défaut City Cars Kia restaurés.');
  };

  const handleTestCatalogSound = (id: SoundEffectId) => {
    soundService.unlockAudioContext();
    soundService.play(id, { bypassRoleCheck: true, force: true });
    setLastTestedSoundId(id);
    setTimeout(() => setLastTestedSoundId((prev) => (prev === id ? null : prev)), 900);
  };

  return (
    <div className="w-full flex flex-col gap-6 p-4 sm:p-6 lg:p-8 max-w-[1720px] mx-auto">
      {/* Toast discret */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-primary text-white px-4 py-2.5 rounded-xl shadow-lg border border-white/15 flex items-center gap-2 text-xs font-semibold">
          <span className="material-symbols-outlined text-base text-emerald-400">check_circle</span>
          <span>{toast}</span>
        </div>
      )}

      {/* En-tête & Indicateurs de Capacité */}
      <section className="bg-surface-container-lowest rounded-2xl p-5 sm:p-6 border border-surface-container-high flex flex-col gap-5">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-secondary uppercase font-bold tracking-wider mb-1">
              <span>Pilotage Ressources & Règles K-DMS</span>
              <span aria-hidden="true">·</span>
              <span className="text-on-surface-variant font-semibold">{settings.dealershipName}</span>
            </div>
            <h1 className="font-headline-lg text-2xl sm:text-3xl font-bold text-on-surface tracking-tight">
              Équipe, Ponts & Paramètres Atelier
            </h1>
            <p className="text-xs sm:text-sm text-on-surface-variant mt-0.5">
              Chaque modification met immédiatement à jour la capacité du planning, les affectations d’OR et les créneaux clients.
            </p>
          </div>

          {/* Segmented Tabs */}
          <div className="inline-flex bg-surface-container-low p-1 rounded-xl border border-surface-container-high self-start xl:self-auto">
            <button
              type="button"
              onClick={() => setSubTab('team')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                subTab === 'team'
                  ? 'bg-primary text-white'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-base">groups</span>
              <span>Équipe & Habilitations</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('bays')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                subTab === 'bays'
                  ? 'bg-primary text-white'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-base">precision_manufacturing</span>
              <span>Ponts & Baies ({openBaysCount}/{bays.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setSubTab('settings')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                subTab === 'settings'
                  ? 'bg-primary text-white'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <span className="material-symbols-outlined text-base">tune</span>
              <span>Paramètres Atelier</span>
            </button>
          </div>
        </div>

        {/* Bandeau Capacité Réelle */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-4 border-t border-surface-container-high">
          <div className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container-high flex items-center justify-between">
            <div>
              <span className="text-[11px] uppercase font-semibold text-on-surface-variant block">
                Techniciens en poste
              </span>
              <span className="font-mono tabular-nums text-xl font-bold text-on-surface">
                {inPostTechs.length} / {activeTechs.length}
              </span>
            </div>
            <span className="material-symbols-outlined text-xl text-emerald-700">engineering</span>
          </div>

          <div className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container-high flex items-center justify-between">
            <div>
              <span className="text-[11px] uppercase font-semibold text-on-surface-variant block">
                Habilités Haute Tension EV
              </span>
              <span className="font-mono tabular-nums text-xl font-bold text-on-surface">
                {evCertifiedAvailableCount} dispo
              </span>
            </div>
            <span className="material-symbols-outlined text-xl text-secondary">bolt</span>
          </div>

          <div className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container-high flex items-center justify-between">
            <div>
              <span className="text-[11px] uppercase font-semibold text-on-surface-variant block">
                Capacité Ponts Ouverts
              </span>
              <span className="font-mono tabular-nums text-xl font-bold text-on-surface">
                {openBaysCount} / {bays.length}
              </span>
            </div>
            <span className="material-symbols-outlined text-xl text-primary">garage</span>
          </div>

          <div className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container-high flex items-center justify-between">
            <div>
              <span className="text-[11px] uppercase font-semibold text-on-surface-variant block">
                Alertes d’affectation
              </span>
              <span
                className={`font-mono tabular-nums text-xl font-bold ${
                  impactAlerts.length > 0 ? 'text-secondary' : 'text-emerald-700'
                }`}
              >
                {impactAlerts.length}
              </span>
            </div>
            <span
              className={`material-symbols-outlined text-xl ${
                impactAlerts.length > 0 ? 'text-secondary' : 'text-emerald-700'
              }`}
            >
              {impactAlerts.length > 0 ? 'warning' : 'verified'}
            </span>
          </div>
        </div>
      </section>

      {/* Bannière Alertes d'Impact sur OR existants */}
      {impactAlerts.length > 0 && (
        <section className="bg-rose-50 rounded-2xl p-4 sm:p-5 border border-rose-200 flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-xl text-secondary">report</span>
              <div>
                <h2 className="font-headline-sm text-sm font-bold text-rose-950">
                  {impactAlerts.length} alerte(s) sur les dossiers actifs suite aux statuts actuels
                </h2>
                <p className="text-xs text-rose-900">
                  Les ressources indisponibles ou en maintenance sont exclues des nouvelles affectations. Réaffectez les dossiers concernés.
                </p>
              </div>
            </div>
            {onNavigateToOrders && (
              <button
                type="button"
                onClick={onNavigateToOrders}
                className="px-3.5 py-2 rounded-xl bg-secondary hover:bg-secondary-container text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
              >
                <span className="material-symbols-outlined text-sm">swap_horiz</span>
                <span>Réaffecter dans les OR</span>
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {impactAlerts.map((alert) => (
              <div
                key={alert.id}
                className="bg-white px-3.5 py-2.5 rounded-xl border border-rose-200 text-xs text-rose-950 flex items-start gap-2"
              >
                <span className="material-symbols-outlined text-base text-secondary shrink-0 mt-0.5">
                  {alert.type === 'ev_cert_mismatch'
                    ? 'bolt'
                    : alert.type === 'bay_maintenance'
                    ? 'build'
                    : 'person_off'}
                </span>
                <span>{alert.message}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ONGLET 1 : ÉQUIPE & HABILITATIONS */}
      {subTab === 'team' && (
        <section className="flex flex-col gap-4">
          {/* Barre Filtres & Action Ajouter */}
          <div className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container-high flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[260px]">
              <div className="relative flex-1 min-w-[220px] max-w-sm">
                <span className="material-symbols-outlined absolute left-3 top-2.5 text-on-surface-variant text-[18px]">
                  search
                </span>
                <input
                  type="text"
                  value={techSearch}
                  onChange={(e) => setTechSearch(e.target.value)}
                  placeholder="Rechercher technicien, rôle ou habilitation..."
                  className="w-full bg-surface-container-low text-xs pl-9 pr-3 py-2 rounded-xl border border-surface-container-high focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as 'all' | TechnicianRole)}
                className="bg-surface-container-low text-xs px-3 py-2 rounded-xl border border-surface-container-high focus:outline-none"
              >
                <option value="all">Tous les rôles</option>
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) =>
                  setStatusFilter(e.target.value as 'all' | TechnicianAvailability | 'inactive')
                }
                className="bg-surface-container-low text-xs px-3 py-2 rounded-xl border border-surface-container-high focus:outline-none"
              >
                <option value="all">Tous les statuts</option>
                <option value="en_poste">En poste</option>
                <option value="en_pause">En pause</option>
                <option value="essai_route">En essai route</option>
                <option value="absent">Absent</option>
                <option value="inactive">Désactivés</option>
              </select>
            </div>

            <button
              type="button"
              onClick={openCreateTechModal}
              className="px-4 py-2 rounded-xl bg-secondary hover:bg-secondary-container text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
            >
              <span className="material-symbols-outlined text-base">person_add</span>
              <span>Ajouter un Technicien</span>
            </button>
          </div>

          {/* Liste Techniciens */}
          {filteredTechs.length === 0 ? (
            <div className="bg-surface-container-lowest p-8 rounded-2xl border border-surface-container-high text-center text-xs text-on-surface-variant">
              Aucun technicien ne correspond aux filtres sélectionnés.
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {filteredTechs.map((tech) => {
                const isEvCertified = tech.certifications.includes('Haute Tension EV/HEV');
                const loadRatio = tech.maxLoadPercent > 0 ? Math.min(100, Math.round((tech.currentLoadPercent / tech.maxLoadPercent) * 100)) : 0;

                return (
                  <div
                    key={tech.id}
                    className={`bg-surface-container-lowest p-5 rounded-2xl border border-surface-container-high flex flex-col gap-4 ${
                      !tech.active ? 'opacity-65' : ''
                    }`}
                  >
                    {/* Header Technicien */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-11 h-11 rounded-xl bg-primary text-white font-headline-sm text-sm font-bold flex items-center justify-center shrink-0">
                          {tech.initials}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-headline-sm text-base font-bold text-on-surface truncate">
                              {tech.name}
                            </h3>
                            {!tech.active && (
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-200 text-slate-700">
                                Désactivé
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-on-surface-variant">
                            {tech.role}
                            <span aria-hidden="true"> · </span>
                            <span className="font-mono tabular-nums">
                              Shift {tech.shiftStart}–{tech.shiftEnd}
                            </span>
                            {tech.assignedBayId && (
                              <>
                                <span aria-hidden="true"> · </span>
                                <span className="font-mono">Pont #{tech.assignedBayId}</span>
                              </>
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => openEditTechModal(tech)}
                          className="p-2 rounded-lg bg-surface-container-low hover:bg-surface-container border border-surface-container-high text-on-surface transition-colors"
                          title="Modifier la fiche et les habilitations"
                        >
                          <span className="material-symbols-outlined text-[16px]">edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleActive(tech)}
                          className={`px-2.5 py-1.5 rounded-lg border text-[11px] font-semibold whitespace-nowrap shrink-0 transition-colors ${
                            tech.active
                              ? 'bg-surface-container-low hover:bg-rose-50 text-on-surface border-surface-container-high hover:text-secondary'
                              : 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                          }`}
                        >
                          {tech.active ? 'Désactiver' : 'Réactiver'}
                        </button>
                      </div>
                    </div>

                    {/* Certifications Kia */}
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                      <span className="text-on-surface-variant font-semibold mr-1">Habilitations :</span>
                      {tech.certifications.length === 0 ? (
                        <span className="text-on-surface-variant italic">Aucune certification enregistrée</span>
                      ) : (
                        tech.certifications.map((cert) => (
                          <span
                            key={cert}
                            className={`px-2 py-0.5 rounded font-medium border ${
                              cert === 'Haute Tension EV/HEV'
                                ? 'bg-secondary/10 text-secondary border-secondary/30 font-bold'
                                : 'bg-surface-container-low text-on-surface border-surface-container-high'
                            }`}
                          >
                            {cert}
                          </span>
                        ))
                      )}
                      {!isEvCertified && (
                        <span className="text-[11px] text-amber-800 ml-auto font-medium">
                          Non habilité EV/HEV
                        </span>
                      )}
                    </div>

                    {/* Charge de travail */}
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-on-surface-variant">Charge atelier actuelle / plafond</span>
                        <span className="font-mono tabular-nums font-bold text-on-surface">
                          {tech.currentLoadPercent}% / {tech.maxLoadPercent}% max
                        </span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-surface-container-high overflow-hidden">
                        <div
                          className={`h-full transition-all ${
                            tech.currentLoadPercent >= tech.maxLoadPercent
                              ? 'bg-secondary'
                              : 'bg-primary'
                          }`}
                          style={{ width: `${loadRatio}%` }}
                        />
                      </div>
                    </div>

                    {/* Bascule disponibilité en temps réel */}
                    <div className="pt-3 border-t border-surface-container-high flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold text-on-surface-variant">
                        Statut temps réel :
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {AVAILABILITY_OPTIONS.map((opt) => {
                          const isSelected = tech.availability === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              disabled={!tech.active}
                              onClick={() => handleToggleAvailability(tech, opt.id)}
                              className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition-colors whitespace-nowrap shrink-0 disabled:opacity-40 ${
                                isSelected
                                  ? opt.activeClass
                                  : 'bg-surface-container-low text-on-surface-variant border-surface-container-high hover:text-on-surface'
                              }`}
                            >
                              {opt.short}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ONGLET 2 : PONTS & BAIES (01 À 12) */}
      {subTab === 'bays' && (
        <section className="flex flex-col gap-4">
          <div className="bg-surface-container-lowest p-4 rounded-2xl border border-surface-container-high flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="text-on-surface">
              <strong>{openBaysCount} ponts ouverts</strong> sur {bays.length} postes installés
              <span aria-hidden="true"> · </span>
              <span className="text-on-surface-variant">
                Fermer un pont réduit automatiquement la capacité affichée sur le Planning Journalier et le bloque dans les Ordres de Réparation.
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {bays.map((bay) => {
              const isMaintenance = bay.status === 'maintenance';
              const leadTech = technicians.find((t) => t.id === bay.leadTechnicianId);
              const leadUnavailable = leadTech && (!leadTech.active || leadTech.availability === 'absent');
              const isConfirmingMaint = maintDraftBayId === bay.id;

              return (
                <div
                  key={bay.id}
                  className={`p-5 rounded-2xl border flex flex-col justify-between gap-4 ${
                    isMaintenance
                      ? 'bg-amber-50/70 border-amber-300'
                      : 'bg-surface-container-lowest border-surface-container-high'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-xs font-bold text-secondary uppercase">
                        Baie #{bay.id}
                      </span>
                      <h3 className="font-headline-sm text-lg font-bold text-on-surface">{bay.name}</h3>
                    </div>
                    <span
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold whitespace-nowrap shrink-0 ${
                        isMaintenance
                          ? 'bg-amber-200 text-amber-950'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {isMaintenance ? 'En maintenance' : 'Ouvert'}
                    </span>
                  </div>

                  <div className="flex flex-col gap-3 text-xs">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-semibold text-on-surface-variant">
                        Spécialité affectée
                      </label>
                      <select
                        value={bay.specialty}
                        onChange={(e) => handleBaySpecialtyChange(bay.id, e.target.value as BaySpecialty)}
                        className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface"
                      >
                        {BAY_SPECIALTIES.map((sp) => (
                          <option key={sp} value={sp}>
                            {sp}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-semibold text-on-surface-variant">
                        Technicien titulaire
                      </label>
                      <select
                        value={bay.leadTechnicianId || ''}
                        onChange={(e) => handleBayLeadChange(bay.id, e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high text-xs text-on-surface"
                      >
                        <option value="">Non attribué</option>
                        {activeTechs.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} ({t.role})
                          </option>
                        ))}
                      </select>
                      {leadUnavailable && (
                        <span className="text-[11px] text-secondary font-semibold">
                          Titulaire {leadTech.name} indisponible ({!leadTech.active ? 'désactivé' : 'Absent'})
                        </span>
                      )}
                    </div>

                    {isMaintenance && bay.maintenanceReason && (
                      <div className="p-2.5 rounded-xl bg-white border border-amber-200 text-[11px] text-amber-950">
                        Motif : {bay.maintenanceReason}
                      </div>
                    )}
                  </div>

                  {isConfirmingMaint ? (
                    <div className="pt-3 border-t border-surface-container-high flex flex-col gap-2">
                      <input
                        type="text"
                        value={maintDraftReason}
                        onChange={(e) => setMaintDraftReason(e.target.value)}
                        placeholder="Motif (ex: Vérin hydraulique, étalonnage géométrie)"
                        className="w-full px-3 py-2 rounded-xl bg-white border border-surface-container-high text-xs"
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setMaintDraftBayId(null);
                            setMaintDraftReason('');
                          }}
                          className="px-3 py-1.5 rounded-lg bg-surface-container text-xs font-semibold"
                        >
                          Annuler
                        </button>
                        <button
                          type="button"
                          onClick={() => handleConfirmBayMaintenance(bay)}
                          className="px-3 py-1.5 rounded-lg bg-amber-700 text-white text-xs font-bold whitespace-nowrap"
                        >
                          Confirmer fermeture
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-3 border-t border-surface-container-high flex items-center justify-end">
                      {isMaintenance ? (
                        <button
                          type="button"
                          onClick={() => handleReopenBay(bay)}
                          className="px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">check_circle</span>
                          <span>Rouvrir le pont</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setMaintDraftBayId(bay.id);
                            setMaintDraftReason('');
                          }}
                          className="px-3.5 py-2 rounded-xl bg-surface-container-low hover:bg-amber-50 text-on-surface hover:text-amber-900 border border-surface-container-high text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors"
                        >
                          <span className="material-symbols-outlined text-sm">build</span>
                          <span>Mettre en maintenance</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ONGLET 3 : PARAMÈTRES ATELIER */}
      {subTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="flex flex-col gap-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* 1. Horaires & Jours fermés */}
            <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container-high flex flex-col gap-4">
              <div>
                <h2 className="font-headline-sm text-base font-bold text-on-surface">
                  Horaires d’ouverture & Fermetures exceptionnelles
                </h2>
                <p className="text-xs text-on-surface-variant">
                  Pilote les créneaux disponibles côté prise de rendez-vous client et planning.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-on-surface-variant">Ouverture Lun–Ven</label>
                  <input
                    type="time"
                    value={settings.weekdayOpen}
                    onChange={(e) => setSettings({ ...settings, weekdayOpen: e.target.value })}
                    className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-on-surface-variant">Fermeture Lun–Ven</label>
                  <input
                    type="time"
                    value={settings.weekdayClose}
                    onChange={(e) => setSettings({ ...settings, weekdayClose: e.target.value })}
                    className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-surface-container-high flex flex-col gap-3 text-xs">
                <label className="flex items-center justify-between gap-2 cursor-pointer">
                  <span className="font-semibold text-on-surface">Ouverture le samedi (Service Express)</span>
                  <input
                    type="checkbox"
                    checked={settings.saturdayEnabled}
                    onChange={(e) => setSettings({ ...settings, saturdayEnabled: e.target.checked })}
                    className="accent-secondary w-4 h-4"
                  />
                </label>

                {settings.saturdayEnabled && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="font-semibold text-on-surface-variant">Ouverture Samedi</label>
                      <input
                        type="time"
                        value={settings.saturdayOpen}
                        onChange={(e) => setSettings({ ...settings, saturdayOpen: e.target.value })}
                        className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high font-mono"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="font-semibold text-on-surface-variant">Fermeture Samedi</label>
                      <input
                        type="time"
                        value={settings.saturdayClose}
                        onChange={(e) => setSettings({ ...settings, saturdayClose: e.target.value })}
                        className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high font-mono"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-surface-container-high flex flex-col gap-2 text-xs">
                <label className="font-semibold text-on-surface-variant">
                  Jours fériés / fermetures exceptionnelles
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    value={newClosedDate}
                    onChange={(e) => setNewClosedDate(e.target.value)}
                    className="flex-1 px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high font-mono"
                  />
                  <button
                    type="button"
                    onClick={handleAddClosedDate}
                    className="px-3.5 py-2 rounded-xl bg-primary text-white font-semibold whitespace-nowrap shrink-0"
                  >
                    Ajouter
                  </button>
                </div>
                {settings.closedDates.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {settings.closedDates.map((d) => (
                      <span
                        key={d}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-container-low border border-surface-container-high font-mono text-[11px]"
                      >
                        <span>{d}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveClosedDate(d)}
                          className="text-secondary hover:text-rose-900 font-bold"
                          title="Retirer cette date"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 2. Règles de Prise de RDV & Capacité */}
            <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container-high flex flex-col gap-4">
              <div>
                <h2 className="font-headline-sm text-base font-bold text-on-surface">
                  Règles de Rendez-vous & Automatisations
                </h2>
                <p className="text-xs text-on-surface-variant">
                  Contrôle les délais de réservation temps réel et les seuils d’alerte magasin.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-on-surface-variant">Délai min. dépose (h)</label>
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={settings.minBookingLeadHours}
                    onChange={(e) =>
                      setSettings({ ...settings, minBookingLeadHours: Math.max(1, Number(e.target.value) || 2) })
                    }
                    className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high font-mono tabular-nums"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-on-surface-variant">Délai modif./annul. (h)</label>
                  <input
                    type="number"
                    min={1}
                    max={72}
                    value={settings.clientModifyDeadlineHours}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        clientModifyDeadlineHours: Math.max(1, Number(e.target.value) || 24),
                      })
                    }
                    className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high font-mono tabular-nums"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-on-surface-variant">Max RDV / créneau</label>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={settings.maxBookingsPerSlot}
                    onChange={(e) =>
                      setSettings({ ...settings, maxBookingsPerSlot: Math.max(1, Number(e.target.value) || 3) })
                    }
                    className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high font-mono tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs pt-2 border-t border-surface-container-high">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-on-surface-variant">Taux horaire MO (TND/h)</label>
                  <input
                    type="number"
                    min={10}
                    value={settings.hourlyLaborRateTnd}
                    onChange={(e) =>
                      setSettings({ ...settings, hourlyLaborRateTnd: Math.max(10, Number(e.target.value) || 65) })
                    }
                    className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high font-mono tabular-nums"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-on-surface-variant">TVA Atelier (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={settings.vatRatePercent}
                    onChange={(e) =>
                      setSettings({ ...settings, vatRatePercent: Math.max(0, Number(e.target.value) || 19) })
                    }
                    className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high font-mono tabular-nums"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-on-surface-variant">Seuil alerte stock (u.)</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={settings.lowStockThreshold}
                    onChange={(e) =>
                      setSettings({ ...settings, lowStockThreshold: Math.max(1, Number(e.target.value) || 3) })
                    }
                    className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high font-mono tabular-nums"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-surface-container-high flex flex-col gap-2.5 text-xs">
                <label className="flex items-center justify-between gap-2 cursor-pointer">
                  <span className="text-on-surface font-medium">
                    Confirmation automatique des demandes de RDV client
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.autoConfirmAppointments}
                    onChange={(e) =>
                      setSettings({ ...settings, autoConfirmAppointments: e.target.checked })
                    }
                    className="accent-secondary w-4 h-4"
                  />
                </label>
                <label className="flex items-center justify-between gap-2 cursor-pointer">
                  <span className="text-on-surface font-medium">
                    Notification automatique client dès validation contrôle qualité final
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.autoNotifyReadyClient}
                    onChange={(e) =>
                      setSettings({ ...settings, autoNotifyReadyClient: e.target.checked })
                    }
                    className="accent-secondary w-4 h-4"
                  />
                </label>
              </div>
            </div>

            {/* 3. Grille Tarifaire Entretien */}
            <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container-high flex flex-col gap-4">
              <div>
                <h2 className="font-headline-sm text-base font-bold text-on-surface">
                  Grille Tarifaire Entretien Constructeur (TND)
                </h2>
                <p className="text-xs text-on-surface-variant">
                  Appliquée aux estimations client en ligne et à la facturation de restitution.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-on-surface-variant">Révision Périodique</label>
                  <input
                    type="number"
                    min={0}
                    value={settings.maintenancePrices.revision}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        maintenancePrices: {
                          ...settings.maintenancePrices,
                          revision: Math.max(0, Number(e.target.value) || 0),
                        },
                      })
                    }
                    className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high font-mono tabular-nums"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-on-surface-variant">Freinage & Sécurité</label>
                  <input
                    type="number"
                    min={0}
                    value={settings.maintenancePrices.freinage}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        maintenancePrices: {
                          ...settings.maintenancePrices,
                          freinage: Math.max(0, Number(e.target.value) || 0),
                        },
                      })
                    }
                    className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high font-mono tabular-nums"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-on-surface-variant">Diagnostic KDS</label>
                  <input
                    type="number"
                    min={0}
                    value={settings.maintenancePrices.diagnostic}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        maintenancePrices: {
                          ...settings.maintenancePrices,
                          diagnostic: Math.max(0, Number(e.target.value) || 0),
                        },
                      })
                    }
                    className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high font-mono tabular-nums"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-on-surface-variant">Climatisation</label>
                  <input
                    type="number"
                    min={0}
                    value={settings.maintenancePrices.climatisation}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        maintenancePrices: {
                          ...settings.maintenancePrices,
                          climatisation: Math.max(0, Number(e.target.value) || 0),
                        },
                      })
                    }
                    className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high font-mono tabular-nums"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-on-surface-variant">Pneumatiques & Géométrie</label>
                  <input
                    type="number"
                    min={0}
                    value={settings.maintenancePrices.pneumatiques}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        maintenancePrices: {
                          ...settings.maintenancePrices,
                          pneumatiques: Math.max(0, Number(e.target.value) || 0),
                        },
                      })
                    }
                    className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high font-mono tabular-nums"
                  />
                </div>
              </div>
            </div>

            {/* 4. Coordonnées Concession & Facture PDF */}
            <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container-high flex flex-col gap-4">
              <div>
                <h2 className="font-headline-sm text-base font-bold text-on-surface">
                  Identité Concessionnaire & Factures PDF
                </h2>
                <p className="text-xs text-on-surface-variant">
                  Affichée sur les fiches de réception, factures acquittées et carnet d’entretien PDF.
                </p>
              </div>

              <div className="flex flex-col gap-3 text-xs">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-on-surface-variant">Nom de la concession</label>
                  <input
                    type="text"
                    value={settings.dealershipName}
                    onChange={(e) => setSettings({ ...settings, dealershipName: e.target.value })}
                    className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-on-surface-variant">Adresse complète</label>
                  <input
                    type="text"
                    value={settings.dealershipAddress}
                    onChange={(e) => setSettings({ ...settings, dealershipAddress: e.target.value })}
                    className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-on-surface-variant">Téléphone Accueil SAV</label>
                    <input
                      type="text"
                      value={settings.dealershipPhone}
                      onChange={(e) => setSettings({ ...settings, dealershipPhone: e.target.value })}
                      className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high font-mono"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="font-semibold text-on-surface-variant">Matricule Fiscal</label>
                    <input
                      type="text"
                      value={settings.dealershipTaxId}
                      onChange={(e) => setSettings({ ...settings, dealershipTaxId: e.target.value })}
                      className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 5. Notifications Sonores & Banc de Test Multi-Interfaces */}
          <div className="bg-surface-container-lowest p-5 rounded-2xl border border-surface-container-high flex flex-col gap-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-surface-container-high">
              <div>
                <h2 className="font-headline-sm text-base font-bold text-on-surface">
                  Notifications Sonores & Banc de Test Audio (Client / Chef / Technicien)
                </h2>
                <p className="text-xs text-on-surface-variant">
                  Synthèse Web Audio intégrée par rôle. Configurez le profil acoustique et écoutez chaque alerte en un clic.
                </p>
              </div>

              <label className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-surface-container-low border border-surface-container-high cursor-pointer text-xs self-start md:self-auto">
                <input
                  type="checkbox"
                  checked={settings.soundConfig?.enabled ?? true}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      soundConfig: {
                        enabled: e.target.checked,
                        profile: settings.soundConfig?.profile || 'balanced',
                        masterVolume: settings.soundConfig?.masterVolume ?? 75,
                      },
                    })
                  }
                  className="accent-secondary w-4 h-4"
                />
                <span className="font-semibold text-on-surface whitespace-nowrap">
                  Activer les effets sonores
                </span>
              </label>
            </div>

            {/* Réglage Profil & Volume Maître */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container-high flex flex-col gap-2">
                <span className="font-semibold text-on-surface-variant">Profil sonore par défaut</span>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      { id: 'balanced', label: 'Équilibré par rôle', hint: 'Client doux · Chef posé · Tech atelier' },
                      { id: 'discrete', label: 'Discret Concession', hint: 'Volume réduit sur tous les postes' },
                    ] as const
                  ).map((prof) => {
                    const active = (settings.soundConfig?.profile || 'balanced') === prof.id;
                    return (
                      <button
                        key={prof.id}
                        type="button"
                        onClick={() =>
                          setSettings({
                            ...settings,
                            soundConfig: {
                              enabled: settings.soundConfig?.enabled ?? true,
                              profile: prof.id as SoundProfileMode,
                              masterVolume: settings.soundConfig?.masterVolume ?? 75,
                            },
                          })
                        }
                        className={`p-2.5 rounded-xl border text-left transition-colors ${
                          active
                            ? 'bg-primary text-white border-primary'
                            : 'bg-surface-container-lowest text-on-surface border-surface-container-high hover:bg-surface-container'
                        }`}
                      >
                        <span className="font-bold block">{prof.label}</span>
                        <span className={`text-[11px] block mt-0.5 ${active ? 'text-white/80' : 'text-on-surface-variant'}`}>
                          {prof.hint}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-surface-container-low border border-surface-container-high flex flex-col justify-between gap-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-on-surface-variant">Volume maître par défaut</span>
                  <span className="font-mono tabular-nums text-sm font-bold text-on-surface">
                    {settings.soundConfig?.masterVolume ?? 75}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={settings.soundConfig?.masterVolume ?? 75}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      soundConfig: {
                        enabled: settings.soundConfig?.enabled ?? true,
                        profile: settings.soundConfig?.profile || 'balanced',
                        masterVolume: Number(e.target.value),
                      },
                    })
                  }
                  className="w-full accent-secondary cursor-pointer"
                />
                <span className="text-[11px] text-on-surface-variant">
                  Les utilisateurs peuvent aussi couper le son (Muet) à tout moment depuis l’icône haut-parleur en en-tête.
                </span>
              </div>
            </div>

            {/* Banc de test par interface */}
            <div className="flex flex-col gap-3 pt-2 border-t border-surface-container-high">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-on-surface">
                  Banc de test interactif des signatures sonores
                </span>
                <div className="inline-flex bg-surface-container-low p-1 rounded-xl border border-surface-container-high gap-1">
                  {(
                    [
                      { id: 'client', label: 'Interface Client (6)' },
                      { id: 'chef', label: "Chef d'Atelier (4)" },
                      { id: 'tech', label: 'Technicien (5)' },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSoundTestRole(tab.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                        soundTestRole === tab.id
                          ? 'bg-primary text-white'
                          : 'text-on-surface-variant hover:text-on-surface'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
                {SOUND_CATALOG.filter((s) => s.role === soundTestRole).map((item) => {
                  const isTesting = lastTestedSoundId === item.id;
                  return (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl bg-surface-container-low border border-surface-container-high flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <span className="text-[11px] text-secondary font-semibold block">
                          {item.categoryLabel}
                        </span>
                        <h4 className="text-xs font-bold text-on-surface truncate">{item.label}</h4>
                        <p className="text-[11px] text-on-surface-variant line-clamp-1">{item.description}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleTestCatalogSound(item.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors ${
                          isTesting
                            ? 'bg-emerald-700 text-white'
                            : 'bg-surface-container-lowest hover:bg-secondary hover:text-white text-on-surface border border-surface-container-high'
                        }`}
                      >
                        <span className="material-symbols-outlined text-sm">
                          {isTesting ? 'graphic_eq' : 'play_arrow'}
                        </span>
                        <span>{isTesting ? 'Lecture' : 'Tester'}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={handleResetSettings}
              className="px-4 py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface text-xs font-semibold border border-surface-container-high whitespace-nowrap shrink-0 transition-colors"
            >
              Rétablir valeurs par défaut
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-secondary hover:bg-secondary-container text-white text-xs font-bold flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors"
            >
              <span className="material-symbols-outlined text-base">save</span>
              <span>Enregistrer les Paramètres Atelier</span>
            </button>
          </div>
        </form>
      )}

      {/* MODAL AJOUT / ÉDITION TECHNICIEN */}
      {isTechModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-surface-container-lowest rounded-2xl max-w-lg w-full border border-surface-container-high shadow-2xl overflow-hidden">
            <div className="bg-primary text-white px-5 py-4 flex items-center justify-between">
              <h3 className="font-headline-sm text-base font-bold">
                {editingTechId ? 'Modifier la fiche technicien' : 'Nouveau technicien d’atelier'}
              </h3>
              <button
                type="button"
                onClick={() => setIsTechModalOpen(false)}
                className="p-1 rounded hover:bg-white/10"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <form onSubmit={handleSaveTech} className="p-5 flex flex-col gap-4 text-xs">
              {formError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 font-semibold">
                  {formError}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-on-surface-variant">Nom complet *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Ex: Youssef Ben Ali"
                    className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-on-surface-variant">Rôle atelier</label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as TechnicianRole)}
                    className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high"
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-on-surface-variant">Début shift</label>
                  <input
                    type="time"
                    value={formShiftStart}
                    onChange={(e) => setFormShiftStart(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-on-surface-variant">Fin shift</label>
                  <input
                    type="time"
                    value={formShiftEnd}
                    onChange={(e) => setFormShiftEnd(e.target.value)}
                    className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-on-surface-variant">Charge (%)</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={formCurrentLoad}
                    onChange={(e) => setFormCurrentLoad(Number(e.target.value))}
                    className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high font-mono"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="font-semibold text-on-surface-variant">Max (%)</label>
                  <input
                    type="number"
                    min={20}
                    max={100}
                    value={formMaxLoad}
                    onChange={(e) => setFormMaxLoad(Number(e.target.value))}
                    className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high font-mono"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label className="font-semibold text-on-surface-variant">Téléphone interne</label>
                <input
                  type="text"
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-surface-container-low border border-surface-container-high font-mono"
                />
              </div>

              <div className="flex flex-col gap-2">
                <label className="font-semibold text-on-surface-variant">Certifications Kia</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {CERTIFICATIONS.map((cert) => {
                    const checked = formCerts.includes(cert);
                    return (
                      <label
                        key={cert}
                        className={`p-2.5 rounded-xl border flex items-center gap-2 cursor-pointer ${
                          checked
                            ? 'bg-secondary/10 border-secondary text-on-surface font-semibold'
                            : 'bg-surface-container-low border-surface-container-high text-on-surface-variant'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleFormCert(cert)}
                          className="accent-secondary"
                        />
                        <span>{cert}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <label className="flex items-center justify-between pt-2 border-t border-surface-container-high cursor-pointer">
                <span className="font-semibold text-on-surface">Compte technicien actif</span>
                <input
                  type="checkbox"
                  checked={formActive}
                  onChange={(e) => setFormActive(e.target.checked)}
                  className="accent-secondary w-4 h-4"
                />
              </label>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsTechModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-surface-container text-on-surface font-semibold"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-secondary hover:bg-secondary-container text-white font-bold"
                >
                  {editingTechId ? 'Enregistrer' : 'Ajouter à l’équipe'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
