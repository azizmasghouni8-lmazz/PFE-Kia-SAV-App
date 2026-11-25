import { useState, useEffect } from 'react';
import { AppRole, ChefTab, TechTab, Compte } from '../../types';
import { workshopSyncService } from '../../services/workshopSyncService';

interface SidebarProProps {
  role: 'chef' | 'tech';
  activeChefTab: ChefTab;
  onSelectChefTab: (tab: ChefTab) => void;
  activeTechTab: TechTab;
  onSelectTechTab: (tab: TechTab) => void;
  onLogout: () => void;
  currentCompte?: Compte | null;
}

export function SidebarPro({
  role,
  activeChefTab,
  onSelectChefTab,
  activeTechTab,
  onSelectTechTab,
  onLogout,
  currentCompte,
}: SidebarProProps) {
  const isChef = role === 'chef';
  const [hasRestitutionAlert, setHasRestitutionAlert] = useState(() =>
    workshopSyncService.getChefRestitutionAlert()
  );
  const [techUnread, setTechUnread] = useState(() =>
    workshopSyncService.getUnreadTechCount()
  );
  const [bays, setBays] = useState(() => workshopSyncService.getWorkshopBays());
  const [settings, setSettings] = useState(() => workshopSyncService.getWorkshopSettings());

  useEffect(() => {
    const checkAlerts = () => {
      setHasRestitutionAlert(workshopSyncService.getChefRestitutionAlert());
      setTechUnread(workshopSyncService.getUnreadTechCount());
    };
    const refreshConfig = () => {
      setBays(workshopSyncService.getWorkshopBays());
      setSettings(workshopSyncService.getWorkshopSettings());
    };
    window.addEventListener('k_dms_bays_updated', refreshConfig);
    window.addEventListener('k_dms_settings_updated', refreshConfig);
    const interval = setInterval(checkAlerts, 1200);
    return () => {
      window.removeEventListener('k_dms_bays_updated', refreshConfig);
      window.removeEventListener('k_dms_settings_updated', refreshConfig);
      clearInterval(interval);
    };
  }, []);

  const openBaysCount = bays.filter((b) => b.status === 'open').length;

  return (
    <aside className="w-64 lg:w-72 bg-[#0e1d28] text-white flex flex-col justify-between py-5 shrink-0 z-40 select-none shadow-xl border-r border-white/5">
      <div className="flex flex-col gap-6">
        {/* Brand Header */}
        <div className="px-6 flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-headline-lg font-bold tracking-wider text-white">KIA</span>
            <span className="h-4 w-[1px] bg-slate-600" />
            <span className="font-label-md uppercase tracking-wider text-[#778694] font-semibold">City Cars</span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="w-2 h-2 rounded-full bg-secondary" />
            <span className="font-label-sm uppercase tracking-wider text-[#778694] text-[10px]">
              {isChef ? 'Atelier & SAV Officiel' : 'Terminal Tech K-DMS'}
            </span>
          </div>
        </div>

        {/* Location & Bay Status Card */}
        <div className="px-5">
          <div className="bg-[#05141f] p-3 rounded-lg border border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-secondary">precision_manufacturing</span>
              <span className="font-label-sm text-white uppercase font-bold text-xs">
                {isChef ? 'La Goulette' : 'Baie #04 Méca'}
              </span>
            </div>
            <span className="font-label-sm text-[#778694] text-[11px] font-mono tabular-nums">
              {isChef ? `${openBaysCount}/${bays.length} Ponts Actifs` : currentCompte ? `${currentCompte.prenom} ${currentCompte.nom}` : 'Karim Trabelsi'}
            </span>
          </div>
        </div>

        {/* Navigation items */}
        <nav className="flex flex-col gap-1 px-3">
          {isChef ? (
            <>
              <button
                onClick={() => onSelectChefTab('planning')}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors font-body-md text-sm ${
                  activeChefTab === 'planning'
                    ? 'bg-secondary text-white font-bold shadow-sm'
                    : 'text-[#778694] hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">grid_view</span>
                <span>Planning & Dashboard</span>
              </button>

              <button
                onClick={() => onSelectChefTab('checkin')}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors font-body-md text-sm ${
                  activeChefTab === 'checkin'
                    ? 'bg-secondary text-white font-bold shadow-sm'
                    : 'text-[#778694] hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">fact_check</span>
                <span>Réception & Check-in</span>
              </button>

              <button
                onClick={() => onSelectChefTab('orders')}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors font-body-md text-sm ${
                  activeChefTab === 'orders'
                    ? 'bg-secondary text-white font-bold shadow-sm'
                    : 'text-[#778694] hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">build</span>
                <span>Ordres de Réparation</span>
              </button>

              <button
                onClick={() => onSelectChefTab('tracking')}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors font-body-md text-sm ${
                  activeChefTab === 'tracking'
                    ? 'bg-secondary text-white font-bold shadow-sm'
                    : 'text-[#778694] hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">request_quote</span>
                <span>Suivi Travaux & Devis</span>
              </button>

              <button
                onClick={() => onSelectChefTab('restitution')}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors font-body-md text-sm ${
                  activeChefTab === 'restitution'
                    ? 'bg-secondary text-white font-bold shadow-sm'
                    : 'text-[#778694] hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[20px]">key</span>
                  <span>Restitution & Sortie</span>
                </div>
                {hasRestitutionAlert && (
                  <span className="px-1.5 py-0.5 rounded-full bg-secondary text-white font-bold text-[10px] animate-pulse">
                    Prêt
                  </span>
                )}
              </button>

              <button
                onClick={() => onSelectChefTab('team')}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors font-body-md text-sm ${
                  activeChefTab === 'team'
                    ? 'bg-secondary text-white font-bold shadow-sm'
                    : 'text-[#778694] hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">tune</span>
                <span>Paramètres & Équipe</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onSelectTechTab('tasks')}
                className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors font-body-md text-sm ${
                  activeTechTab === 'tasks'
                    ? 'bg-secondary text-white font-bold shadow-sm'
                    : 'text-[#778694] hover:bg-white/5 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-[20px]">checklist</span>
                  <span>Mes Travaux du Jour</span>
                </div>
                {techUnread > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-secondary text-white font-bold text-[10px] animate-pulse">
                    +{techUnread}
                  </span>
                )}
              </button>

              <button
                onClick={() => onSelectTechTab('active')}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors font-body-md text-sm ${
                  activeTechTab === 'active'
                    ? 'bg-secondary text-white font-bold shadow-sm'
                    : 'text-[#778694] hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">build_circle</span>
                <span>Intervention en Cours</span>
              </button>

              <button
                onClick={() => onSelectTechTab('parts')}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors font-body-md text-sm ${
                  activeTechTab === 'parts'
                    ? 'bg-secondary text-white font-bold shadow-sm'
                    : 'text-[#778694] hover:bg-white/5 hover:text-white'
                }`}
              >
                <span className="material-symbols-outlined text-[20px]">request_quote</span>
                <span>Demande Pièces & Devis</span>
              </button>
            </>
          )}
        </nav>
      </div>

      {/* Footer Info & Logout */}
      <div className="px-5 flex flex-col gap-3">
        <div className="p-3 bg-[#05141f] rounded-lg border border-white/5 flex flex-col gap-1">
          <span className="font-label-sm text-[#778694] uppercase text-[10px]">Réseau Concessionnaire</span>
          <span className="font-body-sm text-white font-semibold text-xs truncate">
            {settings.dealershipName || 'Kia Tunisie • SAV Central'}
          </span>
          <div className="flex items-center justify-between text-[#778694] font-label-sm text-[10px] pt-1 border-t border-white/5 mt-1">
            <span>v4.8.2 K-DMS</span>
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              Sync OK
            </span>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-secondary-fixed-dim hover:bg-white/5 transition-colors text-xs font-semibold"
        >
          <span className="material-symbols-outlined text-[18px]">power_settings_new</span>
          <span>Déconnexion / Changer Rôle</span>
        </button>
      </div>
    </aside>
  );
}
