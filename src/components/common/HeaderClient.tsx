import { useState, useEffect } from 'react';
import { ClientTab, Compte, Vehicle } from '../../types';
import { KiaLogo } from './KiaLogo';
import { SoundToggleControl } from './SoundToggleControl';
import { workshopSyncService } from '../../services/workshopSyncService';

interface HeaderClientProps {
  activeTab: ClientTab;
  onSelectTab: (tab: ClientTab) => void;
  onLogout: () => void;
  notificationCount?: number;
  onOpenNotifications?: () => void;
  currentCompte?: Compte | null;
  vehicles?: Vehicle[];
}

export function HeaderClient({
  activeTab,
  onSelectTab,
  onLogout,
  notificationCount = 0,
  onOpenNotifications,
  currentCompte,
  vehicles = [],
}: HeaderClientProps) {
  const [hasActiveWork, setHasActiveWork] = useState<boolean>(() =>
    workshopSyncService.hasActiveWorkshopIndicatorForClient(currentCompte ?? null)
  );
  const [pendingQuotesCount, setPendingQuotesCount] = useState<number>(() =>
    workshopSyncService.getPendingQuotesForClient(currentCompte ?? null, vehicles).length
  );

  useEffect(() => {
    const syncIndicator = () => {
      setHasActiveWork(workshopSyncService.hasActiveWorkshopIndicatorForClient(currentCompte ?? null));
      setPendingQuotesCount(
        workshopSyncService.getPendingQuotesForClient(currentCompte ?? null, vehicles).length
      );
    };
    syncIndicator();
    window.addEventListener('k_dms_live_updated', syncIndicator);
    window.addEventListener('k_dms_quotes_updated', syncIndicator);
    window.addEventListener('storage', syncIndicator);
    const interval = setInterval(syncIndicator, 1500);
    return () => {
      window.removeEventListener('k_dms_live_updated', syncIndicator);
      window.removeEventListener('k_dms_quotes_updated', syncIndicator);
      window.removeEventListener('storage', syncIndicator);
      clearInterval(interval);
    };
  }, [currentCompte, vehicles]);

  const effectiveNotifCount = Math.max(notificationCount, pendingQuotesCount);

  return (
    <header className="sticky top-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-xl border-b border-surface-container-high shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      <div className="h-20 w-full px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-4">
        {/* Brand & Concession Info */}
        <div className="flex items-center gap-3 sm:gap-4">
          <KiaLogo
            badge="Espace Client SAV"
            badgeColor="red"
            subtitle="City Cars"
          />

          <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container text-on-surface">
            <span className="material-symbols-outlined text-sm text-secondary">location_on</span>
            <span className="font-body-sm font-semibold text-xs">Tunis La Goulette</span>
          </div>
        </div>

        {/* Center Nav */}
        <nav className="hidden xl:flex items-center gap-1">
          <button
            onClick={() => onSelectTab('home')}
            className={`px-3 py-2 rounded-lg font-body-md text-sm transition-all ${
              activeTab === 'home'
                ? 'bg-primary text-on-primary font-semibold shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
            }`}
          >
            Accueil & Mes Véhicules
          </button>

          <button
            onClick={() => onSelectTab('book')}
            className={`px-3 py-2 rounded-lg font-body-md text-sm transition-all ${
              activeTab === 'book'
                ? 'bg-primary text-on-primary font-semibold shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
            }`}
          >
            Prendre Rendez-vous
          </button>

          <button
            onClick={() => onSelectTab('tracking')}
            className={`px-3 py-2 rounded-lg font-body-md text-sm transition-all relative inline-flex items-center whitespace-nowrap shrink-0 ${
              activeTab === 'tracking'
                ? 'bg-primary text-on-primary font-semibold shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
            }`}
          >
            <span>Suivi en Direct & Historique</span>
            {hasActiveWork && (
              <span
                className="inline-block w-2 h-2 rounded-full bg-secondary ml-2 animate-pulse"
                title="Travaux en cours en atelier"
                aria-label="Travaux en cours"
              />
            )}
          </button>

          <button
            onClick={() => onSelectTab('assistance')}
            className={`px-3 py-2 rounded-lg font-body-md text-sm transition-all inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
              activeTab === 'assistance'
                ? 'bg-primary text-on-primary font-semibold shadow-sm'
                : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
            }`}
          >
            <span>Assistance & Devis</span>
            {pendingQuotesCount > 0 && (
              <span className="px-1.5 py-0.5 rounded bg-secondary text-white font-mono tabular-nums text-[10px] font-bold">
                {pendingQuotesCount}
              </span>
            )}
          </button>
        </nav>

        {/* Right Actions: Audio, Notifications & Profile */}
        <div className="flex items-center gap-2 sm:gap-4">
          <SoundToggleControl variant="client" />

          <button
            aria-label="Notifications devis et atelier"
            onClick={onOpenNotifications}
            className="relative p-2 rounded-lg text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-colors"
            type="button"
          >
            <span className="material-symbols-outlined text-[22px]">notifications</span>
            {effectiveNotifCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-secondary text-white font-mono tabular-nums text-[10px] font-bold flex items-center justify-center ring-2 ring-surface">
                {effectiveNotifCount}
              </span>
            )}
          </button>

          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/40 text-emerald-400 border border-emerald-500/30 text-[11px] font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>Firestore Connecté</span>
          </div>

          {/* User badge */}
          <div className="flex items-center gap-2.5 pl-2 border-l border-surface-container-high">
            <div className="hidden md:flex flex-col text-right">
              <span className="font-body-md text-xs sm:text-sm font-semibold text-on-surface leading-tight">
                {currentCompte ? `${currentCompte.prenom} ${currentCompte.nom}` : 'Client Kia'}
              </span>
              <span className="font-label-sm text-[11px] text-on-surface-variant">
                {currentCompte?.immatriculation ? `Client • ${currentCompte.immatriculation}` : 'Client Particulier'}
              </span>
            </div>
            <img
              alt={currentCompte ? `${currentCompte.prenom} ${currentCompte.nom}` : 'Client Kia'}
              className="w-8 h-8 rounded-full object-cover ring-2 ring-surface-container-highest"
              src={
                currentCompte?.avatarUrl ||
                'https://lh3.googleusercontent.com/aida/AEtjO1WHiyRtIyGSJiPUfxy7S0syNbwDRM1nZgFQmJSrurHXG9pusQP3otU-iWEz069Nk-Jc2SRupjUe16z5vjs57mD6GERo479C_Q-dtbO1_7OeOqFBPZS2MGYNKdzCvZchTuvmW2Ycl8rhwx4iDP1dUzg1LjUqAx-o9pYK_M95tNF_23gHVqX0HOoHszXS0XvvUkMexVORK1fia7qVEkssmcpg21YbDI_ld-glPKbzNp51nTzpIkbKRabjySabJW4Vr99vEPjllEVQY4k'
              }
            />
          </div>

          {/* Logout / Switch */}
          <button
            onClick={onLogout}
            className="p-2 rounded-lg text-on-surface-variant hover:bg-secondary-fixed hover:text-on-secondary-fixed transition-colors"
            title="Se déconnecter / Écran d'accueil"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
          </button>
        </div>
      </div>

      {/* Mobile nav subbar */}
      <div className="xl:hidden flex items-center justify-around border-t border-surface-container-high px-2 py-1.5 bg-surface-container-low text-xs">
        <button
          onClick={() => onSelectTab('home')}
          className={`px-2 py-1 rounded font-medium ${
            activeTab === 'home' ? 'bg-primary text-on-primary font-bold' : 'text-on-surface-variant'
          }`}
        >
          Véhicules
        </button>
        <button
          onClick={() => onSelectTab('book')}
          className={`px-2 py-1 rounded font-medium ${
            activeTab === 'book' ? 'bg-primary text-on-primary font-bold' : 'text-on-surface-variant'
          }`}
        >
          Prendre RDV
        </button>
        <button
          onClick={() => onSelectTab('tracking')}
          className={`px-2 py-1 rounded font-medium flex items-center gap-1 whitespace-nowrap shrink-0 ${
            activeTab === 'tracking' ? 'bg-primary text-on-primary font-bold' : 'text-on-surface-variant'
          }`}
        >
          {hasActiveWork && <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />}
          Suivi Direct
        </button>
        <button
          onClick={() => onSelectTab('assistance')}
          className={`px-2 py-1 rounded font-medium flex items-center gap-1 whitespace-nowrap shrink-0 ${
            activeTab === 'assistance' ? 'bg-primary text-on-primary font-bold' : 'text-on-surface-variant'
          }`}
        >
          <span>Assistance</span>
          {pendingQuotesCount > 0 && (
            <span className="px-1 rounded bg-secondary text-white font-mono text-[10px] font-bold">
              {pendingQuotesCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
