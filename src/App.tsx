import { useState, useEffect } from 'react';
import { firebaseSeedService } from './services/firebaseSeedService';
import { testConnection } from './firebase';
import {
  AppRole,
  ClientTab,
  ChefTab,
  TechTab,
  Vehicle,
  AdditionalQuote,
  RepairOrder,
  ServiceHistoryItem,
} from './types';
import {
  INITIAL_VEHICLES,
  INITIAL_QUOTE,
  INITIAL_ORDERS,
  INITIAL_SERVICE_HISTORY,
} from './data/mockData';
import { resolveKiaModelImage, normalizeKiaVehicleImageUrl } from './data/kiaCatalog';

// Common Components
import { HeaderClient } from './components/common/HeaderClient';
import { FooterClient } from './components/common/FooterClient';
import { SidebarPro } from './components/common/SidebarPro';
import { HeaderPro } from './components/common/HeaderPro';

// Client Screens
import { ClientHome } from './components/client/ClientHome';
import { BookAppointment } from './components/client/BookAppointment';
import { LiveTracking } from './components/client/LiveTracking';
import { AssistanceDevis } from './components/client/AssistanceDevis';

// Pro Screens
import { PlanningDashboard } from './components/atelier/PlanningDashboard';
import { ReceptionCheckin } from './components/atelier/ReceptionCheckin';
import { RepairOrders } from './components/atelier/RepairOrders';
import { ChefRestitutionModule } from './components/atelier/ChefRestitutionModule';
import { ChefQuotesPanel } from './components/atelier/ChefQuotesPanel';
import { ChefTeamSettingsModule } from './components/atelier/ChefTeamSettingsModule';

// Tech Screens
import { TechDailyTasks } from './components/tech/TechDailyTasks';
import { TechActiveIntervention } from './components/tech/TechActiveIntervention';
import { TechPartsAndQuotes } from './components/tech/TechPartsAndQuotes';

// Auth Screens & Services
import { LoginTablet } from './components/auth/LoginTablet';
import { RegisterTablet } from './components/auth/RegisterTablet';
import { Compte } from './types';
import { compteService } from './services/compteService';
import { workshopSyncService } from './services/workshopSyncService';
import { soundService } from './services/soundService';
import { useWorkshopSoundMonitor } from './hooks/useWorkshopSoundMonitor';

// Modals
import { ChatModal } from './components/modals/ChatModal';
import { PdfPreviewModal } from './components/modals/PdfPreviewModal';
import { AddVehicleModal } from './components/modals/AddVehicleModal';

export default function App() {
  const [currentCompte, setCurrentCompte] = useState<Compte | null>(() => compteService.getSessionActive());
  const [role, setRole] = useState<AppRole>(() => {
    const session = compteService.getSessionActive();
    return session ? session.role : 'auth';
  });
  const [authView, setAuthView] = useState<'login' | 'register'>('login');
  const [registeredEmail, setRegisteredEmail] = useState<string>('');
  const [authSuccessMessage, setAuthSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    // Test de connectivité serveur Firestore & initialisation des données
    testConnection();
    firebaseSeedService.seedDatabaseIfNeeded();
    compteService.syncFromFirestore();
    workshopSyncService.initFirestoreListeners();

    const active = compteService.getSessionActive();
    if (active && active.role === 'client') {
      workshopSyncService.fetchClientVehiclesFromFirestore(active).then((remoteVehicles) => {
        if (remoteVehicles && remoteVehicles.length > 0) {
          workshopSyncService.saveClientGarageVehicles(active, remoteVehicles);
          setVehicles(remoteVehicles);
        }
      });
    }

    const handleCompteSynced = () => {
      const updated = compteService.getSessionActive();
      if (updated) {
        setCurrentCompte(updated);
        if (updated.role === 'client') {
          setVehicles(loadVehiclesForSession(updated));
        }
      }
    };

    const syncVehiclesFromCheckout = () => {
      const activeSession = compteService.getSessionActive();
      setVehicles((prev) =>
        prev.map((v) => {
          if (workshopSyncService.isCheckedOut({ plate: v.plate, id: v.activeOrId })) {
            return {
              ...v,
              status: 'up_to_date',
              activeOrId: undefined,
              workshopLocation: undefined,
              waitingPartsReason: undefined,
            };
          }
          const waitInfo =
            activeSession && activeSession.role === 'client'
              ? workshopSyncService.isVehicleWaitingPartsForClient(activeSession, v.plate, v.activeOrId)
              : workshopSyncService.isVehicleWaitingParts(v.plate, v.activeOrId);
          if (waitInfo.waiting) {
            return {
              ...v,
              status: 'waiting_parts',
              waitingPartsReason: waitInfo.reason,
            };
          }
          if (v.status === 'waiting_parts' && !waitInfo.waiting) {
            return {
              ...v,
              status: 'in_workshop',
              waitingPartsReason: undefined,
            };
          }
          return v;
        })
      );
      setQuotesTick((t) => t + 1);
    };

    syncVehiclesFromCheckout();
    window.addEventListener('k_dms_compte_synced', handleCompteSynced);
    window.addEventListener('k_dms_history_updated', syncVehiclesFromCheckout);
    window.addEventListener('k_dms_live_updated', syncVehiclesFromCheckout);
    window.addEventListener('k_dms_quotes_updated', syncVehiclesFromCheckout);
    window.addEventListener('k_dms_orders_updated', syncVehiclesFromCheckout);
    return () => {
      window.removeEventListener('k_dms_compte_synced', handleCompteSynced);
      window.removeEventListener('k_dms_history_updated', syncVehiclesFromCheckout);
      window.removeEventListener('k_dms_live_updated', syncVehiclesFromCheckout);
      window.removeEventListener('k_dms_quotes_updated', syncVehiclesFromCheckout);
      window.removeEventListener('k_dms_orders_updated', syncVehiclesFromCheckout);
    };
  }, []);

  const [clientTab, setClientTab] = useState<ClientTab>('home');
  const [chefTab, setChefTab] = useState<ChefTab>('planning');
  const [techTab, setTechTab] = useState<TechTab>('tasks');

  const isDemo = (c: Compte | null) => c?.id === 'cpt-client-001' || c?.email === 'client@kia.tn';

  // Helper pour dériver le garage et l'historique personnalisés du client connecté
  const getClientVehicles = (session: Compte): Vehicle[] => {
    const isAziz = session.email.toLowerCase().includes('aziz');
    return [
      {
        id: `veh-${session.id}`,
        name: session.modeleVehicule || (isAziz ? 'Kia Sportage GT-Line 1.6 T-GDi' : 'Kia Nouvelle Gamme'),
        finish: isAziz ? 'GT-Line Pack Premium' : 'Finition Concessionnaire',
        plate: session.immatriculation || (isAziz ? '235 TU 8812' : '—'),
        vin: session.vin || (isAziz ? 'KNA-AZ9823101' : '—'),
        year: 2024,
        type: 'Véhicule Client',
        color: isAziz ? 'Gris Météore' : 'Noir Ébène',
        mileage: isAziz ? 18420 : 1200,
        nextServiceKm: isAziz ? 25000 : 10000,
        warranty: 'Garantie Constructeur 5 Ans ou 150 000 km',
        warrantyActive: true,
        status: 'up_to_date',
        imageUrl: resolveKiaModelImage(session.modeleVehicule || 'Kia Sportage'),
      },
    ];
  };

  const loadVehiclesForSession = (session: Compte | null): Vehicle[] => {
    if (!session || session.role !== 'client') {
      return INITIAL_VEHICLES;
    }
    const stored = workshopSyncService.getClientGarageVehicles(session);
    if (stored) {
      return stored.map((v) => ({
        ...v,
        imageUrl: normalizeKiaVehicleImageUrl(v.imageUrl, v.name),
      }));
    }
    const initialList = isDemo(session) ? [...INITIAL_VEHICLES] : getClientVehicles(session);
    workshopSyncService.saveClientGarageVehicles(session, initialList);
    return initialList;
  };

  const getClientHistory = (session: Compte): ServiceHistoryItem[] => {
    const isAziz = session.email.toLowerCase().includes('aziz');
    if (isAziz) {
      return [
        {
          id: 'hist-az-1',
          date: '15 Sep',
          year: '2025',
          mileage: '10 000 km',
          title: 'Entretien Rodage & Révision 10 000 km',
          description: 'Vidange huile Total Quartz Ineo Xtra EC6 0W-20, filtre à huile OEM, contrôle 35 points et mise à jour KDS.',
          amount: '380.000 TND',
          workshop: 'City Cars Kia La Goulette (Tunis)',
          advisor: 'Hédi Mansour',
          orNumber: 'OR-2025-4190',
          invoiceNumber: 'FAC-2025-4190',
          status: 'completed',
          category: 'entretien',
          vehicleName: 'Kia Sportage GT-Line 1.6 T-GDi',
          plate: session.immatriculation || '235 TU 8812',
          vin: session.vin || 'KNA-AZ9823101',
          clientId: session.id,
          clientName: 'M. Aziz Masghouni',
          clientEmail: session.email,
          clientPhone: session.telephone,
          technicianName: 'Karim Trabelsi',
          bay: 'Pont #04 (Mécanique)',
          durationLabel: '1h 15m',
          paymentMethod: 'Carte Bancaire',
          paidAt: '15/09/2025 à 11:20',
          operations: [
            {
              id: 'az-op-1',
              label: 'Vidange huile moteur Total Quartz Ineo Xtra EC6 0W-20',
              category: 'Lubrification',
              completedAt: '10:25',
              status: 'completed',
              notes: 'Huile homologuée Kia 1.6 T-GDi (4.5 L).',
            },
            {
              id: 'az-op-2',
              label: 'Remplacement filtre à huile d’origine & joint d’étanchéité',
              category: 'Filtration',
              completedAt: '10:40',
              status: 'completed',
            },
            {
              id: 'az-op-3',
              label: 'Contrôle 35 points de sécurité & mise à jour calculateur KDS',
              category: 'Diagnostic',
              completedAt: '11:05',
              status: 'verified',
              notes: 'Aucune mise à jour critique en attente.',
            },
          ],
          parts: [
            { oemRef: '26300-35505', name: 'Filtre à huile Kia Mobis OEM', quantity: 1, unitPriceTND: 38.0 },
            { oemRef: 'TQ-0W20-5L', name: 'Huile Total Quartz Ineo Xtra 0W-20', quantity: 1, unitPriceTND: 195.0 },
          ],
          qualityChecks: [
            'Diagnostic valise KDS : 0 Défaut',
            'Pression pneumatiques & niveaux conformes',
            'Essai routier validé',
          ],
        },
        {
          id: 'hist-az-2',
          date: '20 Mar',
          year: '2024',
          mileage: '1 500 km',
          title: 'Contrôle Gratuit de Garantie (1 500 km)',
          description: 'Vérification des niveaux, serrage des trains roulants, contrôle pression des pneus et essai dynamique.',
          amount: 'Gratuit (Garantie)',
          workshop: 'City Cars Kia Charguia',
          advisor: 'Hédi Mansour',
          orNumber: 'OR-2024-1102',
          invoiceNumber: 'GAR-2024-1102',
          status: 'completed',
          category: 'mecanique',
          vehicleName: 'Kia Sportage GT-Line 1.6 T-GDi',
          plate: session.immatriculation || '235 TU 8812',
          vin: session.vin || 'KNA-AZ9823101',
          clientId: session.id,
          clientName: 'M. Aziz Masghouni',
          clientEmail: session.email,
          clientPhone: session.telephone,
          technicianName: 'Mehdi Gharbi',
          bay: 'Pont #02 (Garantie)',
          durationLabel: '40 min',
          paymentMethod: 'Prise en charge Garantie',
          paidAt: '20/03/2024 à 09:50',
          operations: [
            {
              id: 'az-op-4',
              label: 'Vérification des niveaux moteur, refroidissement & freinage',
              category: 'Niveaux',
              completedAt: '09:20',
              status: 'completed',
            },
            {
              id: 'az-op-5',
              label: 'Serrage trains roulants au couple constructeur & essai dynamique',
              category: 'Châssis',
              completedAt: '09:42',
              status: 'verified',
              notes: 'Comportement routier nominal.',
            },
          ],
          parts: [],
          qualityChecks: [
            'Contrôle premier rodage 1 500 km validé',
            'Garantie 5 ans / 150 000 km active',
          ],
        },
      ];
    }
    return [];
  };

  // Shared Data State - Initialized according to active account
  const [vehicles, setVehicles] = useState<Vehicle[]>(() => {
    const session = compteService.getSessionActive();
    return loadVehiclesForSession(session);
  });

  const [quote, setQuote] = useState<AdditionalQuote | null>(() => {
    const session = compteService.getSessionActive();
    if (session && session.role === 'client' && !isDemo(session)) {
      return null;
    }
    return INITIAL_QUOTE;
  });

  const [orders, setOrders] = useState<RepairOrder[]>(INITIAL_ORDERS);

  const [serviceHistory, setServiceHistory] = useState<ServiceHistoryItem[]>(() => {
    const session = compteService.getSessionActive();
    if (session && session.role === 'client' && !isDemo(session)) {
      return getClientHistory(session);
    }
    return INITIAL_SERVICE_HISTORY;
  });

  // Modals state
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isPdfOpen, setIsPdfOpen] = useState(false);
  const [pdfItem, setPdfItem] = useState<ServiceHistoryItem | null>(null);
  const [isAddVehicleOpen, setIsAddVehicleOpen] = useState(false);
  const [, setQuotesTick] = useState(0);

  // Moniteur global des notifications sonores temps réel selon le rôle actif
  useWorkshopSoundMonitor(role, currentCompte, vehicles);

  // Quotation approval sync across all roles
  const handleUpdateQuoteStatus = (status: 'accepted' | 'refused') => {
    setQuote((prev) =>
      prev
        ? {
            ...prev,
            status,
            acceptedAt: status === 'accepted' ? '10:48 CET' : undefined,
          }
        : null
    );
  };

  // Add new vehicle to user's garage (isolated per client account + Firestore)
  const handleAddVehicle = (newCar: Vehicle) => {
    setVehicles((prev) => {
      const next = [...prev, newCar];
      if (currentCompte?.role === 'client') {
        workshopSyncService.saveClientGarageVehicles(currentCompte, next);
      }
      return next;
    });
    if (currentCompte?.role === 'client') {
      workshopSyncService.addVehicleForClient(currentCompte, newCar);
    }
  };

  // Delete vehicle from user's garage (isolated per client account + Firestore)
  const handleDeleteVehicle = (vehicleId: string) => {
    setVehicles((prev) => {
      const next = prev.filter((v) => v.id !== vehicleId);
      if (currentCompte?.role === 'client') {
        workshopSyncService.saveClientGarageVehicles(currentCompte, next);
      }
      return next;
    });
    if (currentCompte?.role === 'client') {
      workshopSyncService.removeVehicleForClient(currentCompte, vehicleId);
    }
  };

  // Generate order from check-in
  const handleGenerateOrderFromCheckin = (checkinData: {
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
  }) => {
    const pending = workshopSyncService.getPendingCheckin();
    const serviceLabel = checkinData.serviceName || pending?.serviceName || 'Entretien & Diagnostic officiel Kia';
    const clientTitle = checkinData.clientName || pending?.clientName || (currentCompte ? `${currentCompte.prenom} ${currentCompte.nom}` : 'Client Kia');
    const clientId = checkinData.clientId || pending?.clientId;
    const clientEmail = checkinData.clientEmail || pending?.clientEmail;
    const clientPhone = checkinData.clientPhone || pending?.clientPhone;

    const newOr: RepairOrder = {
      id: `#OR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      createdTime: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      vehicleName: checkinData.vehicle,
      plate: checkinData.plate,
      service: serviceLabel,
      serviceCategory: 'Mécanique & Diagnostic',
      technician: 'Karim Trabelsi',
      technicianRole: 'Master Tech',
      bay: 'Pont #04 (Mécanique)',
      status: 'pending',
      statusLabel: 'Nouveau / Attente Prise en Main',
      progressPercent: 0,
      timeElapsed: '0h 00m',
      timeEstimated: '2h 30m',
      estimatedHours: 2.5,
      clientName: clientTitle,
      vin: checkinData.vin,
      imageUrl: resolveKiaModelImage(checkinData.vehicle),
    };

    // Synchronisation persistante inter-rôles avec clientId, clientName et métadonnées
    workshopSyncService.addOrder({
      ...newOr,
      clientId,
      clientName: clientTitle,
      clientEmail,
      clientPhone,
      vin: checkinData.vin,
      mileage: checkinData.km,
    });

    if (pending) {
      workshopSyncService.updateAppointmentStatus(pending.id, 'checked_in', {
        checkinId: checkinData.checkinId,
        orId: newOr.id,
      });
      workshopSyncService.setPendingCheckin(null);
    }

    setOrders((prev) => [newOr, ...prev]);
    setChefTab('orders');
  };

  // Appointment booked from client booking screen
  const handleAppointmentBooked = (appointment: {
    vehicleName: string;
    plate: string;
    vin?: string;
    mileage?: number;
    serviceName: string;
    price: string;
    date: string;
    time: string;
    dateIso?: string;
    notes?: string;
  }) => {
    const todayIso = new Date().toISOString().split('T')[0];
    const dateStr = appointment.dateIso || todayIso;
    const clientName = currentCompte ? `${currentCompte.prenom} ${currentCompte.nom}` : 'Cher Client';

    workshopSyncService.saveAppointment({
      clientName,
      clientEmail: currentCompte?.email,
      clientPhone: currentCompte?.telephone,
      clientId: currentCompte?.id,
      vehicleName: appointment.vehicleName,
      plate: appointment.plate,
      vin: appointment.vin || currentCompte?.vin,
      mileage: appointment.mileage,
      serviceName: appointment.serviceName,
      price: appointment.price,
      dateStr,
      formattedDate: appointment.date,
      time: appointment.time,
      notes: appointment.notes,
    });

    setVehicles((prev) =>
      prev.map((v) =>
        v.plate === appointment.plate
          ? {
              ...v,
              status: 'scheduled',
              workshopLocation: `Atelier Central La Goulette • Prévu le ${appointment.date} à ${appointment.time}`,
            }
          : v
      )
    );
  };

  // Scroll to bottom helper
  const handleScrollDown = () => {
    window.scrollBy({ top: 600, behavior: 'smooth' });
  };

  // Auth lifecycle handlers
  const handleLoginSuccess = (compte: Compte) => {
    setIsChatOpen(false);
    setIsPdfOpen(false);
    setPdfItem(null);
    setIsAddVehicleOpen(false);
    setClientTab('home');
    setChefTab('planning');
    setTechTab('tasks');

    setCurrentCompte(compte);
    setRole(compte.role);

    if (compte.role === 'client') {
      const initialGarage = loadVehiclesForSession(compte);
      setVehicles(initialGarage);
      workshopSyncService.fetchClientVehiclesFromFirestore(compte).then((remote) => {
        if (remote && remote.length > 0) {
          workshopSyncService.saveClientGarageVehicles(compte, remote);
          setVehicles(remote);
        }
      });

      if (isDemo(compte)) {
        setQuote(INITIAL_QUOTE);
        setServiceHistory(INITIAL_SERVICE_HISTORY);
      } else {
        setQuote(null);
        setServiceHistory(getClientHistory(compte));
      }
    } else {
      setVehicles(INITIAL_VEHICLES);
      setQuote(INITIAL_QUOTE);
      setServiceHistory(INITIAL_SERVICE_HISTORY);
    }
  };

  const handleRegisterSuccess = (newEmail: string) => {
    setRegisteredEmail(newEmail);
    setAuthSuccessMessage('Votre compte client a été créé avec succès dans la base ! Veuillez vous connecter.');
    setAuthView('login');
  };

  const handleLogout = () => {
    compteService.deconnecterSession();
    setIsChatOpen(false);
    setIsPdfOpen(false);
    setPdfItem(null);
    setIsAddVehicleOpen(false);
    setClientTab('home');
    setChefTab('planning');
    setTechTab('tasks');
    setVehicles([]);
    setQuote(null);
    setServiceHistory([]);
    setCurrentCompte(null);
    setRole('auth');
    setAuthView('login');
    setRegisteredEmail('');
    setAuthSuccessMessage(null);
  };

  const workshopQuote = quote || INITIAL_QUOTE;

  return (
    <div className="min-h-screen flex flex-col bg-[#fbf9f9] text-[#1b1c1c] antialiased">
      {/* AUTH SCREEN (TABLET KIOSK) */}
      {role === 'auth' && authView === 'login' && (
        <LoginTablet
          onLoginSuccess={handleLoginSuccess}
          onNavigateToRegister={() => {
            setAuthSuccessMessage(null);
            setAuthView('register');
          }}
          initialEmail={registeredEmail}
          successNotification={authSuccessMessage}
        />
      )}

      {role === 'auth' && authView === 'register' && (
        <RegisterTablet
          onRegisterSuccess={handleRegisterSuccess}
          onNavigateToLogin={() => {
            setAuthSuccessMessage(null);
            setAuthView('login');
          }}
        />
      )}

      {/* ESPACE CLIENT */}
      {role === 'client' && (
        <div className="flex-1 flex flex-col min-h-screen">
          <HeaderClient
            activeTab={clientTab}
            onSelectTab={setClientTab}
            onLogout={handleLogout}
            notificationCount={
              workshopSyncService.getPendingQuotesForClient(currentCompte, vehicles).length ||
              (quote &&
              quote.status === 'pending' &&
              workshopSyncService.doesQuoteBelongToClient(quote, currentCompte, vehicles)
                ? 1
                : 0)
            }
            onOpenNotifications={() => setClientTab('assistance')}
            currentCompte={currentCompte}
            vehicles={vehicles}
          />

          <main className="flex-1">
            {clientTab === 'home' && (
              <ClientHome
                vehicles={vehicles}
                quote={quote}
                onNavigateToBooking={() => setClientTab('book')}
                onNavigateToTracking={() => setClientTab('tracking')}
                onNavigateToAssistance={() => setClientTab('assistance')}
                onOpenAddVehicle={() => setIsAddVehicleOpen(true)}
                onOpenChat={() => setIsChatOpen(true)}
                onDeleteVehicle={handleDeleteVehicle}
                clientName={currentCompte ? currentCompte.prenom : 'Client'}
                currentCompte={currentCompte}
              />
            )}

            {clientTab === 'book' && (
              <BookAppointment
                vehicles={vehicles}
                onConfirmSuccess={handleAppointmentBooked}
                onNavigateToAssistance={() => setClientTab('assistance')}
                clientName={currentCompte ? `${currentCompte.prenom} ${currentCompte.nom}` : 'Client Kia'}
                currentCompte={currentCompte}
              />
            )}

            {clientTab === 'tracking' && (
              <LiveTracking
                quote={quote}
                onUpdateQuoteStatus={handleUpdateQuoteStatus}
                serviceHistory={serviceHistory}
                onOpenChat={() => setIsChatOpen(true)}
                onOpenPdf={(item) => {
                  soundService.play('client_validation_check');
                  setPdfItem(item || null);
                  setIsPdfOpen(true);
                }}
                activeVehicle={vehicles[0] || null}
                onNavigateToBooking={() => setClientTab('book')}
                onNavigateToAssistance={() => setClientTab('assistance')}
                currentCompte={currentCompte}
              />
            )}

            {clientTab === 'assistance' && (
              <AssistanceDevis
                quote={quote}
                onUpdateQuoteStatus={handleUpdateQuoteStatus}
                onOpenChat={() => setIsChatOpen(true)}
                vehicles={vehicles}
                currentCompte={currentCompte}
              />
            )}
          </main>

          <FooterClient />

          {/* Floating scroll down button */}
          <div className="fixed bottom-6 right-6 z-30">
            <button
              onClick={handleScrollDown}
              className="w-12 h-12 rounded-full bg-[#0e1d28] text-white shadow-xl hover:bg-secondary transition-all flex items-center justify-center active:scale-95 group border border-white/10"
              title="Faire défiler"
              type="button"
            >
              <span className="material-symbols-outlined text-2xl group-hover:translate-y-0.5 transition-transform">
                keyboard_arrow_down
              </span>
            </button>
          </div>
        </div>
      )}

      {/* ESPACE PRO : CHEF D'ATELIER (M. HÉDI MANSOUR) */}
      {role === 'chef' && (
        <div className="flex-1 flex min-h-screen">
          <SidebarPro
            role="chef"
            activeChefTab={chefTab}
            onSelectChefTab={setChefTab}
            activeTechTab={techTab}
            onSelectTechTab={setTechTab}
            onLogout={handleLogout}
            currentCompte={currentCompte}
          />

          <div className="flex-1 flex flex-col min-w-0 bg-[#fbf9f9]">
            <HeaderPro
              role="chef"
              onNavigateToPlanning={() => setChefTab('planning')}
              currentCompte={currentCompte}
            />

            <main className="flex-1 pb-16">
              {chefTab === 'planning' && (
                <PlanningDashboard
                  onNavigateToCheckin={() => setChefTab('checkin')}
                  onNavigateToOrders={() => setChefTab('orders')}
                  onNavigateToRestitution={() => setChefTab('restitution')}
                />
              )}

              {chefTab === 'checkin' && (
                <ReceptionCheckin
                  onGenerateOrder={handleGenerateOrderFromCheckin}
                  onOpenPdfPreview={(previewItem) => {
                    setPdfItem(previewItem || null);
                    setIsPdfOpen(true);
                  }}
                />
              )}

              {chefTab === 'orders' && (
                <RepairOrders
                  orders={orders}
                  onEmitOrderSuccess={() => {}}
                />
              )}

              {chefTab === 'tracking' && <ChefQuotesPanel />}

              {chefTab === 'restitution' && (
                <ChefRestitutionModule
                  onNavigateToPlanning={() => setChefTab('planning')}
                  onOpenPdfPreview={(item) => {
                    setPdfItem(item);
                    setIsPdfOpen(true);
                  }}
                />
              )}

              {chefTab === 'team' && (
                <ChefTeamSettingsModule
                  onNavigateToOrders={() => setChefTab('orders')}
                />
              )}
            </main>

            {/* Floating scroll down */}
            <div className="fixed bottom-6 right-6 z-30">
              <button
                onClick={handleScrollDown}
                className="w-12 h-12 rounded-full bg-secondary text-white shadow-xl hover:bg-secondary-container transition-all flex items-center justify-center active:scale-95 group"
                title="Faire défiler"
                type="button"
              >
                <span className="material-symbols-outlined text-2xl group-hover:translate-y-0.5 transition-transform">
                  keyboard_arrow_down
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ESPACE TECHNICIEN : KARIM TRABELSI (MASTER TECH) */}
      {role === 'tech' && (
        <div className="flex-1 flex min-h-screen">
          <SidebarPro
            role="tech"
            activeChefTab={chefTab}
            onSelectChefTab={setChefTab}
            activeTechTab={techTab}
            onSelectTechTab={setTechTab}
            onLogout={handleLogout}
            currentCompte={currentCompte}
          />

          <div className="flex-1 flex flex-col min-w-0 bg-[#fbf9f9]">
            <HeaderPro
              role="tech"
              currentCompte={currentCompte}
            />

            <main className="flex-1 pb-16">
              {techTab === 'tasks' && (
                <TechDailyTasks
                  quote={workshopQuote}
                  orders={orders}
                  onNavigateToActive={() => setTechTab('active')}
                />
              )}

              {techTab === 'active' && (
                <TechActiveIntervention
                  quote={workshopQuote}
                  onFinishIntervention={() => {
                    setTechTab('tasks');
                  }}
                  onNavigateToParts={() => setTechTab('parts')}
                />
              )}

              {techTab === 'parts' && (
                <TechPartsAndQuotes
                  currentQuote={workshopQuote}
                  onUpdateQuote={setQuote}
                  onNavigateToActive={() => setTechTab('active')}
                />
              )}
            </main>

            {/* Floating scroll down */}
            <div className="fixed bottom-6 right-6 z-30">
              <button
                onClick={handleScrollDown}
                className="w-12 h-12 rounded-full bg-primary text-white shadow-xl hover:bg-secondary transition-all flex items-center justify-center active:scale-95 group border border-white/10"
                title="Faire défiler"
                type="button"
              >
                <span className="material-symbols-outlined text-2xl group-hover:translate-y-0.5 transition-transform">
                  keyboard_arrow_down
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Modals */}
      <ChatModal
        key={currentCompte?.id || 'guest'}
        isOpen={isChatOpen}
        onClose={() => setIsChatOpen(false)}
        currentCompte={currentCompte}
      />
      <PdfPreviewModal
        isOpen={isPdfOpen}
        onClose={() => setIsPdfOpen(false)}
        item={pdfItem}
        currentCompte={currentCompte}
        activeVehicle={vehicles[0] || null}
        role={role === 'auth' ? null : role}
      />
      <AddVehicleModal
        isOpen={isAddVehicleOpen}
        onClose={() => setIsAddVehicleOpen(false)}
        onAddVehicle={handleAddVehicle}
      />
    </div>
  );
}
