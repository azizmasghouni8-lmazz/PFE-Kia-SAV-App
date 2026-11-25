import { useState, useEffect, useRef } from 'react';
import { Compte } from '../../types';
import { workshopSyncService, ChefNotification } from '../../services/workshopSyncService';
import { SoundToggleControl } from './SoundToggleControl';

interface HeaderProProps {
  role: 'chef' | 'tech';
  onEmergencyClick?: () => void;
  onNotificationClick?: () => void;
  onNavigateToPlanning?: () => void;
  currentCompte?: Compte | null;
}

export function HeaderPro({
  role,
  onEmergencyClick,
  onNotificationClick,
  onNavigateToPlanning,
  currentCompte,
}: HeaderProProps) {
  const isChef = role === 'chef';
  const [notifications, setNotifications] = useState<ChefNotification[]>(() =>
    isChef ? workshopSyncService.getChefNotifications() : []
  );
  const [pendingChefCount, setPendingChefCount] = useState<number>(() =>
    isChef
      ? workshopSyncService
          .getAppointments()
          .filter((a) => a.status === 'booked' && (a.chefDecision === 'pending' || (!a.chefDecision && a.source === 'client_week')))
          .length
      : 0
  );
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [emergencyActive, setEmergencyActive] = useState(false);
  const notifContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isChef) return;
    const refresh = () => {
      setNotifications(workshopSyncService.getChefNotifications());
      setPendingChefCount(
        workshopSyncService
          .getAppointments()
          .filter(
            (a) =>
              a.status === 'booked' &&
              (a.chefDecision === 'pending' || (!a.chefDecision && a.source === 'client_week'))
          ).length
      );
    };
    refresh();
    window.addEventListener('k_dms_chef_notifications_updated', refresh);
    window.addEventListener('k_dms_planning_updated', refresh);
    return () => {
      window.removeEventListener('k_dms_chef_notifications_updated', refresh);
      window.removeEventListener('k_dms_planning_updated', refresh);
    };
  }, [isChef]);

  useEffect(() => {
    if (!isNotifOpen) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (notifContainerRef.current && !notifContainerRef.current.contains(event.target as Node)) {
        setIsNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isNotifOpen]);

  const unreadNotifications = notifications.filter((n) => !n.read);
  const badgeCount = isChef ? unreadNotifications.length : 0;

  const handleBellClick = () => {
    if (onNotificationClick) {
      onNotificationClick();
      return;
    }
    setIsNotifOpen((prev) => !prev);
  };

  const handleEmergency = () => {
    if (onEmergencyClick) {
      onEmergencyClick();
      return;
    }
    setEmergencyActive((prev) => !prev);
  };

  const formatNotifIcon = (type: ChefNotification['type']) => {
    if (type === 'rdv_cancelled') return { icon: 'event_busy', cls: 'text-red-600 bg-red-50' };
    if (type === 'rdv_modified') return { icon: 'edit_calendar', cls: 'text-amber-600 bg-amber-50' };
    return { icon: 'event_available', cls: 'text-blue-600 bg-blue-50' };
  };

  return (
    <header className="h-16 bg-surface/90 backdrop-blur-xl border-b border-surface-container-high z-30 flex items-center justify-between px-6 lg:px-8 shadow-sm">
      {/* Workshop status indicator */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 bg-surface-container-low px-3 py-1 rounded-full border border-surface-container-high">
          <span className={`w-2 h-2 rounded-full ${emergencyActive ? 'bg-red-600 animate-ping' : 'bg-secondary animate-pulse'}`} />
          <span className="font-label-sm text-xs text-on-surface font-semibold uppercase tracking-wider">
            {emergencyActive ? 'Alerte Prioritaire Atelier Active' : 'Atelier La Goulette : 12 ponts actifs'}
          </span>
        </div>
        <div className="hidden sm:flex items-center gap-1.5 bg-surface-container-low px-3 py-1 rounded-full border border-surface-container-high">
          <span className="material-symbols-outlined text-xs text-secondary">calendar_today</span>
          <span className="font-label-sm text-xs text-on-surface font-semibold capitalize">
            {new Date().toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        </div>
        <span className="font-body-sm text-xs text-on-surface-variant hidden xl:inline">
          Flux nominal • Prise en charge 08:00 - 18:30
        </span>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <SoundToggleControl variant="pro" />

          <button
            onClick={handleEmergency}
            className={`relative p-2 rounded-lg transition-colors ${
              emergencyActive
                ? 'bg-red-100 text-red-700'
                : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
            }`}
            title="Alerte Atelier"
            type="button"
          >
            <span className="material-symbols-outlined text-[20px] text-secondary">emergency_home</span>
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-secondary" />
          </button>

          <div className="relative" ref={notifContainerRef}>
            <button
              onClick={handleBellClick}
              className="relative p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface transition-colors"
              title="Notifications K-DMS"
              type="button"
            >
              <span className="material-symbols-outlined text-[20px]">notifications</span>
              {badgeCount > 0 ? (
                <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-secondary text-white text-[10px] font-bold flex items-center justify-center shadow-sm">
                  {badgeCount > 9 ? '9+' : badgeCount}
                </span>
              ) : isChef && pendingChefCount > 0 ? (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-500" />
              ) : null}
            </button>

            {isNotifOpen && (
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-xl border border-slate-200 shadow-2xl z-50 overflow-hidden">
                <div className="px-4 py-3 bg-[#0e1d28] text-white flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider">
                      {isChef ? 'Notifications Chef d’Atelier' : 'Notifications Atelier'}
                    </h4>
                    {isChef && (
                      <p className="text-[11px] text-slate-300 mt-0.5">
                        {unreadNotifications.length} non lue(s) • {pendingChefCount} RDV à valider
                      </p>
                    )}
                  </div>
                  {isChef && unreadNotifications.length > 0 && (
                    <button
                      type="button"
                      onClick={() => workshopSyncService.markAllChefNotificationsRead()}
                      className="text-[11px] font-semibold text-amber-300 hover:text-amber-200 transition-colors"
                    >
                      Tout marquer lu
                    </button>
                  )}
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                  {!isChef ? (
                    <div className="p-4 text-xs text-slate-500 text-center">
                      Aucune nouvelle alerte technique pour votre baie.
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="p-5 text-xs text-slate-500 text-center">
                      Aucune notification RDV client récente.
                    </div>
                  ) : (
                    notifications.slice(0, 8).map((notif) => {
                      const style = formatNotifIcon(notif.type);
                      return (
                        <button
                          key={notif.id}
                          type="button"
                          onClick={() => {
                            workshopSyncService.markChefNotificationRead(notif.id);
                            setIsNotifOpen(false);
                            onNavigateToPlanning?.();
                          }}
                          className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-slate-50 transition-colors ${
                            !notif.read ? 'bg-blue-50/40' : ''
                          }`}
                        >
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${style.cls}`}>
                            <span className="material-symbols-outlined text-[18px]">{style.icon}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-xs font-bold text-[#0e1d28] truncate">{notif.title}</span>
                              {!notif.read && <span className="w-2 h-2 rounded-full bg-secondary shrink-0" />}
                            </div>
                            <p className="text-[11px] text-slate-600 mt-0.5 line-clamp-2">{notif.message}</p>
                            <span className="text-[10px] text-slate-400 font-mono mt-1 block">
                              {notif.clientName} • {notif.plate}
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>

                {isChef && onNavigateToPlanning && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsNotifOpen(false);
                      onNavigateToPlanning();
                    }}
                    className="w-full py-2.5 px-4 bg-slate-50 hover:bg-slate-100 text-xs font-bold text-[#0e1d28] border-t border-slate-200 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span>Ouvrir le Planning & Actions Chef</span>
                    <span className="material-symbols-outlined text-sm">arrow_forward</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="h-6 w-[1px] bg-surface-container-highest" />

        {/* User Card */}
        <div className="flex items-center gap-3">
          <div className="flex flex-col text-right">
            <span className="font-headline-sm text-xs sm:text-sm leading-tight text-on-surface font-bold">
              {currentCompte ? `${currentCompte.prenom} ${currentCompte.nom}` : isChef ? 'M. Hédi Mansour' : 'Karim Trabelsi'}
            </span>
            <span className="font-label-sm text-[10px] text-secondary font-semibold uppercase">
              {isChef ? "Chef d'Atelier Principal" : 'Technicien Master Certifié'}
            </span>
          </div>
          <img
            alt={currentCompte ? `${currentCompte.prenom} ${currentCompte.nom}` : isChef ? 'M. Hédi Mansour' : 'Karim Trabelsi'}
            className="w-9 h-9 rounded-full object-cover ring-2 ring-surface-container-highest shadow-sm"
            src={
              currentCompte?.avatarUrl ||
              (isChef
                ? 'https://lh3.googleusercontent.com/aida-public/AB6AXuBrKR47oxBFsIOk5dVzZ0EUorphjxsbNSImnaIpjtAnqbe1Uxsj5djcrIIotxFbFsc6m_g8E4M8RsSzLoqMUmftSFIowAMpY3Bj5jVk_kr02giBIQgLyI4fG8cTKS0QmdAIs63MtXE-gkTPXM2xfSkzPyaQBWvQIal-ERyyUhAf6jcYacefT81zM43prHJcc_JicHmTtPm18i7253bgzZPJYznMWnLpPQifjGAW2iKSa2mdJ7aAtba9zQ'
                : 'https://lh3.googleusercontent.com/aida-public/AB6AXuBCpyoqg87or7K7NKKFGD6hWzt1oLDCFyMFhzdtcC1XAR-t-VGe36vFId6PzNwiyIIjjncCxFteAoT6DOmi6C6PzVr3OZ2zQ2s9EXmHERQk9cdbg9xV95sIYLS5C0TOY7sLTlTnWYggi8k1vkeNfI-tpNaWp0cuPWhWC5wu64k7EXAXfiBqg3jyuq1QF1Qp5uRF3Y2SRVKR9zpphhk0zMIKzKSp2Ya1XByM7kUTEfXWvXKgKVyddQlwdg')
            }
          />
        </div>
      </div>
    </header>
  );
}
