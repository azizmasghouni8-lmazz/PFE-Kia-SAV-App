import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  Car,
  Compass,
  Headset,
  HelpCircle,
  Loader2,
  PlusCircle,
  RotateCcw,
  Send,
  Sparkles,
  Wrench,
  X,
} from 'lucide-react';
import { AdditionalQuote, ClientTab, Compte, Vehicle } from '../../types';
import {
  buildClientGuideContext,
  CLIENT_TAB_LABELS,
  GuideAction,
  GuideActionType,
} from '../../services/clientGuideContext';
import { soundService } from '../../services/soundService';

interface ClientAiGuideWidgetProps {
  activeTab: ClientTab;
  currentCompte: Compte | null;
  vehicles: Vehicle[];
  quote: AdditionalQuote | null;
  onSelectTab: (tab: ClientTab) => void;
  onOpenChat: () => void;
  onOpenAddVehicle: () => void;
}

interface GuideMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  action?: GuideAction;
  followUps?: string[];
  timestamp: string;
}

const CONTEXT_QUICK_PROMPTS: Record<ClientTab, string[]> = {
  home: [
    'Comment fonctionne cet espace client ?',
    'Comment ajouter un nouveau véhicule ?',
    'Où voir l’état de ma garantie Kia ?',
  ],
  book: [
    'Pourquoi certains créneaux sont fermés ?',
    'Comment demander un RDV Long Terme ?',
    'Puis-je réserver un deuxième rendez-vous ?',
  ],
  tracking: [
    'Quelles sont les 4 étapes en atelier ?',
    'Que veut dire « En attente pièce » ?',
    'Comment télécharger mon justificatif PDF ?',
  ],
  assistance: [
    'Comment accepter ou refuser un devis ?',
    'Jusqu’à quand modifier ou annuler un RDV ?',
    'Comment parler à un conseiller SAV ?',
  ],
};

function getActionIcon(type: GuideActionType) {
  switch (type) {
    case 'tab_home':
      return <Car className="w-3.5 h-3.5" />;
    case 'tab_book':
      return <Calendar className="w-3.5 h-3.5" />;
    case 'tab_tracking':
      return <Wrench className="w-3.5 h-3.5" />;
    case 'tab_assistance':
      return <HelpCircle className="w-3.5 h-3.5" />;
    case 'open_advisor_chat':
      return <Headset className="w-3.5 h-3.5" />;
    case 'open_add_vehicle':
      return <PlusCircle className="w-3.5 h-3.5" />;
    default:
      return <ArrowRight className="w-3.5 h-3.5" />;
  }
}

export const ClientAiGuideWidget: React.FC<ClientAiGuideWidgetProps> = ({
  activeTab,
  currentCompte,
  vehicles,
  quote,
  onSelectTab,
  onOpenChat,
  onOpenAddVehicle,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<GuideMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);

  const [syncTick, setSyncTick] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const bump = () => setSyncTick((t) => t + 1);
    const events = [
      'k_dms_orders_updated',
      'k_dms_quotes_updated',
      'k_dms_live_updated',
      'k_dms_appointments_updated',
      'k_dms_history_updated',
      'k_dms_settings_updated',
    ];
    events.forEach((evt) => window.addEventListener(evt, bump));
    return () => {
      events.forEach((evt) => window.removeEventListener(evt, bump));
    };
  }, []);

  const liveContext = useMemo(
    () => buildClientGuideContext(activeTab, currentCompte, vehicles, quote),
    [activeTab, currentCompte, vehicles, quote, isOpen, syncTick]
  );

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      const timer = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(timer);
    }
  }, [isOpen, messages, isLoading, errorText]);

  const executeAction = (action: GuideAction) => {
    soundService.play('client_validation_check');
    switch (action.type) {
      case 'tab_home':
        onSelectTab('home');
        break;
      case 'tab_book':
        onSelectTab('book');
        break;
      case 'tab_tracking':
        onSelectTab('tracking');
        break;
      case 'tab_assistance':
        onSelectTab('assistance');
        break;
      case 'open_advisor_chat':
        setIsOpen(false);
        onOpenChat();
        break;
      case 'open_add_vehicle':
        onSelectTab('home');
        setIsOpen(false);
        onOpenAddVehicle();
        break;
      default:
        break;
    }
  };

  const sendQuestion = async (rawQuestion: string, appendUserBubble = true) => {
    const trimmed = rawQuestion.trim();
    if (!trimmed || isLoading) return;

    soundService.play('client_validation_check');
    setErrorText(null);
    setLastFailedPrompt(null);

    const historyForRequest = messages.map((m) => ({
      role: m.role,
      text: m.text,
    }));

    if (appendUserBubble) {
      const userMsg: GuideMessage = {
        id: `usr-${Date.now()}`,
        role: 'user',
        text: trimmed,
        timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
    }

    setIsLoading(true);
    try {
      const freshContext = buildClientGuideContext(activeTab, currentCompte, vehicles, quote);
      const response = await fetch('/api/client-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: historyForRequest,
          context: freshContext,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg =
          typeof data?.error === 'string' && data.error.trim()
            ? data.error
            : 'Le Guide Client est momentanément indisponible. Veuillez réessayer.';
        setErrorText(msg);
        setLastFailedPrompt(trimmed);
        return;
      }

      const assistantMsg: GuideMessage = {
        id: `ast-${Date.now()}`,
        role: 'assistant',
        text: typeof data?.reply === 'string' ? data.reply : 'Voici les informations demandées.',
        action:
          data?.action && typeof data.action.type === 'string'
            ? {
                type: data.action.type as GuideActionType,
                label: typeof data.action.label === 'string' ? data.action.label : '',
              }
            : { type: 'none', label: '' },
        followUps: Array.isArray(data?.followUps) ? data.followUps : [],
        timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
      soundService.play('client_chat_received');
    } catch {
      setErrorText('Connexion interrompue avec le serveur du Guide Client. Vérifiez votre réseau.');
      setLastFailedPrompt(trimmed);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendQuestion(input, true);
  };

  const handleReset = () => {
    soundService.play('client_validation_check');
    setMessages([]);
    setErrorText(null);
    setLastFailedPrompt(null);
  };

  const dossierBadges: Array<{ label: string; highlight?: boolean; onClick?: () => void }> = [];
  if (liveContext.vehicles.length > 0) {
    dossierBadges.push({
      label: `${liveContext.vehicles.length} véhicule${liveContext.vehicles.length > 1 ? 's' : ''}`,
      onClick: () => onSelectTab('home'),
    });
  }
  if (liveContext.pendingQuotes.length > 0) {
    dossierBadges.push({
      label: `${liveContext.pendingQuotes.length} devis en attente`,
      highlight: true,
      onClick: () => onSelectTab('assistance'),
    });
  }
  if (liveContext.liveWorkshop) {
    dossierBadges.push({
      label: liveContext.liveWorkshop.waitingParts
        ? 'Atelier : Attente pièce'
        : `Atelier : Étape ${liveContext.liveWorkshop.currentStep}/4`,
      highlight: true,
      onClick: () => onSelectTab('tracking'),
    });
  } else if (liveContext.pendingChefAppointment) {
    dossierBadges.push({
      label: '1 RDV en attente Chef',
      onClick: () => onSelectTab('assistance'),
    });
  }

  return (
    <div className="flex flex-col items-end gap-3">
      {/* Drawer / Popover Guide IA */}
      {isOpen && (
        <section
          aria-label="Guide Client Kia SAV"
          className="w-[calc(100vw-2rem)] sm:w-[400px] max-h-[76vh] flex flex-col bg-white rounded-2xl border border-[#e4e2e3] shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          {/* En-tête */}
          <div className="bg-[#05141f] text-white px-4 py-3.5 border-b border-white/10 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#b70f31] flex items-center justify-center shrink-0 shadow-sm">
                <Compass className="w-5 h-5 text-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-headline font-bold text-sm tracking-tight text-white truncate">
                    Guide Client Kia SAV
                  </h3>
                </div>
                <p className="text-[11px] text-[#b9c8d8] truncate">
                  Écran actif : {CLIENT_TAB_LABELS[activeTab]}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={handleReset}
                  title="Nouvelle discussion"
                  className="p-2 rounded-lg text-[#b9c8d8] hover:text-white hover:bg-white/10 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Fermer le Guide"
                className="p-2 rounded-lg text-[#b9c8d8] hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Barre contexte dossier client */}
          {dossierBadges.length > 0 && (
            <div className="bg-[#f5f3f4] border-b border-[#e4e2e3] px-3.5 py-2 flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#43474b] mr-1">
                Dossier :
              </span>
              {dossierBadges.map((badge, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={badge.onClick}
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-md border transition-colors ${
                    badge.highlight
                      ? 'bg-[#ffdad9]/60 text-[#920023] border-[#ffb3b4] hover:bg-[#ffdad9]'
                      : 'bg-white text-[#1b1c1c] border-[#e4e2e3] hover:bg-[#efedee]'
                  }`}
                >
                  {badge.label}
                </button>
              ))}
            </div>
          )}

          {/* Zone messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#fbf9f9] min-h-[260px] max-h-[46vh]">
            {messages.length === 0 ? (
              <div className="space-y-4">
                <div className="bg-white border border-[#e4e2e3] rounded-xl p-3.5 shadow-xs">
                  <div className="flex items-start gap-2.5">
                    <Sparkles className="w-4 h-4 text-[#b70f31] shrink-0 mt-0.5" />
                    <div className="space-y-1.5 text-xs text-[#1b1c1c] leading-relaxed">
                      <p className="font-semibold text-[#05141f]">
                        Bonjour {liveContext.client.firstName}, comment puis-je vous orienter ?
                      </p>
                      <p className="text-[#43474b]">
                        Posez-moi toute question sur l’utilisation de votre espace client, vos rendez-vous,
                        le suivi en atelier ou vos devis.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-[11px] font-mono uppercase tracking-wider text-[#74777c] px-0.5">
                    Questions fréquentes sur cet écran
                  </p>
                  <div className="flex flex-col gap-2">
                    {CONTEXT_QUICK_PROMPTS[activeTab].map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => sendQuestion(prompt, true)}
                        className="text-left text-xs font-medium text-[#0e1d28] bg-white hover:bg-[#f5f3f4] border border-[#e4e2e3] hover:border-[#0e1d28]/30 rounded-xl px-3.5 py-2.5 transition-all flex items-center justify-between gap-2 group"
                      >
                        <span>{prompt}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-[#74777c] group-hover:text-[#b70f31] group-hover:translate-x-0.5 transition-all shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, index) => {
                  const isLastAssistant =
                    msg.role === 'assistant' && index === messages.length - 1;
                  return (
                    <div
                      key={msg.id}
                      className={`flex flex-col ${
                        msg.role === 'user' ? 'items-end' : 'items-start'
                      } gap-1.5`}
                    >
                      <div
                        className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-line ${
                          msg.role === 'user'
                            ? 'bg-[#05141f] text-white rounded-br-sm shadow-xs'
                            : 'bg-white text-[#1b1c1c] border border-[#e4e2e3] rounded-bl-sm shadow-xs'
                        }`}
                      >
                        {msg.text}

                        {msg.role === 'assistant' &&
                          msg.action &&
                          msg.action.type !== 'none' && (
                            <div className="mt-3 pt-2.5 border-t border-[#efedee]">
                              <button
                                type="button"
                                onClick={() => executeAction(msg.action!)}
                                className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#0e1d28] hover:bg-[#b70f31] text-white font-semibold text-xs transition-colors"
                              >
                                <span className="flex items-center gap-2 truncate">
                                  {getActionIcon(msg.action.type)}
                                  <span className="truncate">
                                    {msg.action.label || 'Ouvrir cette section'}
                                  </span>
                                </span>
                                <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                              </button>
                            </div>
                          )}
                      </div>

                      {isLastAssistant &&
                        !isLoading &&
                        msg.followUps &&
                        msg.followUps.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 max-w-[92%] pt-0.5">
                            {msg.followUps.map((chip) => (
                              <button
                                key={chip}
                                type="button"
                                onClick={() => sendQuestion(chip, true)}
                                className="text-[11px] font-medium text-[#0e1d28] bg-white hover:bg-[#efedee] border border-[#c4c7cc] rounded-lg px-2.5 py-1 transition-colors text-left"
                              >
                                {chip}
                              </button>
                            ))}
                          </div>
                        )}
                    </div>
                  );
                })}
              </>
            )}

            {isLoading && (
              <div className="flex items-start">
                <div className="bg-white border border-[#e4e2e3] rounded-2xl rounded-bl-sm px-3.5 py-2.5 flex items-center gap-2 text-xs text-[#43474b] shadow-xs">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#b70f31]" />
                  <span>Analyse de votre demande…</span>
                </div>
              </div>
            )}

            {errorText && (
              <div className="bg-[#ffdad9]/50 border border-[#ffb3b4] rounded-xl p-3 text-xs text-[#40000a] space-y-2">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-[#b70f31] shrink-0 mt-0.5" />
                  <p className="leading-relaxed">{errorText}</p>
                </div>
                {lastFailedPrompt && (
                  <button
                    type="button"
                    onClick={() => sendQuestion(lastFailedPrompt, false)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#b70f31] hover:bg-[#920023] text-white font-semibold text-[11px] transition-colors"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Réessayer
                  </button>
                )}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Barre de saisie */}
          <form
            onSubmit={handleSubmit}
            className="p-3 bg-white border-t border-[#e4e2e3] flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Posez votre question (ex: modifier un RDV)..."
              maxLength={1200}
              disabled={isLoading}
              className="flex-1 text-xs bg-[#f5f3f4] text-[#1b1c1c] placeholder:text-[#74777c] px-3.5 py-2.5 rounded-xl border border-transparent focus:border-[#0e1d28] focus:bg-white focus:outline-hidden transition-all"
            />
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              title="Envoyer"
              className="w-9 h-9 rounded-xl bg-[#b70f31] hover:bg-[#920023] disabled:bg-[#dbd9da] disabled:text-[#74777c] text-white flex items-center justify-center transition-colors shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </section>
      )}

      {/* Bouton flottant Guide Client */}
      <button
        type="button"
        onClick={() => {
          soundService.play('client_validation_check');
          setIsOpen((prev) => !prev);
        }}
        className={`h-12 px-4 rounded-xl shadow-xl flex items-center gap-2.5 font-headline font-semibold text-sm transition-all active:scale-95 border ${
          isOpen
            ? 'bg-[#05141f] text-white border-white/15'
            : 'bg-[#b70f31] hover:bg-[#920023] text-white border-white/10'
        }`}
        title="Ouvrir le Guide Client SAV"
      >
        {isOpen ? <X className="w-4 h-4" /> : <Compass className="w-4 h-4" />}
        <span>{isOpen ? 'Fermer le Guide' : 'Guide IA'}</span>
      </button>
    </div>
  );
};
