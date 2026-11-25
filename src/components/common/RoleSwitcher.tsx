import { AppRole, ClientTab, ChefTab, TechTab } from '../../types';

interface RoleSwitcherProps {
  currentRole: AppRole;
  onSelectRole: (role: AppRole) => void;
  activeClientTab: ClientTab;
  onSelectClientTab: (tab: ClientTab) => void;
  activeChefTab: ChefTab;
  onSelectChefTab: (tab: ChefTab) => void;
  activeTechTab: TechTab;
  onSelectTechTab: (tab: TechTab) => void;
  pendingQuoteCount?: number;
}

export function RoleSwitcher({
  currentRole,
  onSelectRole,
  activeClientTab,
  onSelectClientTab,
  activeChefTab,
  onSelectChefTab,
  activeTechTab,
  onSelectTechTab,
  pendingQuoteCount = 1,
}: RoleSwitcherProps) {
  return (
    <div className="sticky top-0 z-50 bg-[#05141f] text-white border-b border-white/10 px-3 py-1.5 shadow-md flex flex-wrap items-center justify-between gap-2 text-xs">
      {/* Role Picker */}
      <div className="flex items-center gap-1.5">
        <span className="font-label-sm uppercase tracking-wider text-white/50 text-[10px] hidden sm:inline">
          Espace & Rôle :
        </span>
        <div className="inline-flex bg-white/10 p-0.5 rounded-lg">
          <button
            onClick={() => onSelectRole('client')}
            className={`px-2.5 py-1 rounded font-body-sm text-xs font-semibold transition-all flex items-center gap-1.5 ${
              currentRole === 'client'
                ? 'bg-secondary text-white shadow-sm'
                : 'text-white/80 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">person</span>
            <span>Client (Sami)</span>
            {pendingQuoteCount > 0 && currentRole !== 'client' && (
              <span className="w-2 h-2 rounded-full bg-secondary animate-ping" />
            )}
          </button>

          <button
            onClick={() => onSelectRole('chef')}
            className={`px-2.5 py-1 rounded font-body-sm text-xs font-semibold transition-all flex items-center gap-1.5 ${
              currentRole === 'chef'
                ? 'bg-secondary text-white shadow-sm'
                : 'text-white/80 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">engineering</span>
            <span>Chef d'Atelier (Hédi)</span>
          </button>

          <button
            onClick={() => onSelectRole('tech')}
            className={`px-2.5 py-1 rounded font-body-sm text-xs font-semibold transition-all flex items-center gap-1.5 ${
              currentRole === 'tech'
                ? 'bg-secondary text-white shadow-sm'
                : 'text-white/80 hover:text-white hover:bg-white/5'
            }`}
          >
            <span className="material-symbols-outlined text-[15px]">build_circle</span>
            <span>Tech Master (Karim)</span>
          </button>

          <button
            onClick={() => onSelectRole('auth')}
            className={`px-2.5 py-1 rounded font-body-sm text-xs font-semibold transition-all flex items-center gap-1.5 ${
              currentRole === 'auth'
                ? 'bg-secondary text-white shadow-sm'
                : 'text-white/80 hover:text-white hover:bg-white/5'
            }`}
            title="Afficher l'écran de connexion Tablette"
          >
            <span className="material-symbols-outlined text-[15px]">tablet_mac</span>
            <span>Écran Connexion</span>
          </button>
        </div>
      </div>

      {/* Sub-screens quick jump */}
      <div className="flex items-center gap-1 overflow-x-auto">
        {currentRole === 'client' && (
          <>
            <span className="text-[10px] text-white/50 uppercase font-label-sm hidden md:inline">Écrans Client:</span>
            <button
              onClick={() => onSelectClientTab('home')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                activeClientTab === 'home' ? 'bg-white/20 text-white font-bold' : 'text-white/70 hover:text-white'
              }`}
            >
              Accueil & Véhicules
            </button>
            <button
              onClick={() => onSelectClientTab('book')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                activeClientTab === 'book' ? 'bg-white/20 text-white font-bold' : 'text-white/70 hover:text-white'
              }`}
            >
              Prendre RDV
            </button>
            <button
              onClick={() => onSelectClientTab('tracking')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1 ${
                activeClientTab === 'tracking' ? 'bg-white/20 text-white font-bold' : 'text-white/70 hover:text-white'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
              <span>Suivi en Direct & Carnet</span>
            </button>
            <button
              onClick={() => onSelectClientTab('assistance')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                activeClientTab === 'assistance' ? 'bg-white/20 text-white font-bold' : 'text-white/70 hover:text-white'
              }`}
            >
              Assistance & Devis
            </button>
          </>
        )}

        {currentRole === 'chef' && (
          <>
            <span className="text-[10px] text-white/50 uppercase font-label-sm hidden md:inline">Écrans Atelier:</span>
            <button
              onClick={() => onSelectChefTab('planning')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                activeChefTab === 'planning' ? 'bg-white/20 text-white font-bold' : 'text-white/70 hover:text-white'
              }`}
            >
              Planning & Pilotage
            </button>
            <button
              onClick={() => onSelectChefTab('checkin')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                activeChefTab === 'checkin' ? 'bg-white/20 text-white font-bold' : 'text-white/70 hover:text-white'
              }`}
            >
              Réception & Check-in 360°
            </button>
            <button
              onClick={() => onSelectChefTab('orders')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                activeChefTab === 'orders' ? 'bg-white/20 text-white font-bold' : 'text-white/70 hover:text-white'
              }`}
            >
              Ordres de Réparation (OR)
            </button>
          </>
        )}

        {currentRole === 'tech' && (
          <>
            <span className="text-[10px] text-white/50 uppercase font-label-sm hidden md:inline">Écrans Tech:</span>
            <button
              onClick={() => onSelectTechTab('tasks')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors ${
                activeTechTab === 'tasks' ? 'bg-white/20 text-white font-bold' : 'text-white/70 hover:text-white'
              }`}
            >
              Mes Travaux du Jour
            </button>
            <button
              onClick={() => onSelectTechTab('active')}
              className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors flex items-center gap-1 ${
                activeTechTab === 'active' ? 'bg-white/20 text-white font-bold' : 'text-white/70 hover:text-white'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-ping" />
              <span>Intervention en Cours</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
