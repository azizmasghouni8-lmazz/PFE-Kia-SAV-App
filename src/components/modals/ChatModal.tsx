import { useState, useEffect } from 'react';
import { Compte } from '../../types';
import { soundService } from '../../services/soundService';

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentCompte?: Compte | null;
}

interface ChatMessage {
  sender: string;
  time: string;
  text: string;
  isMe: boolean;
}

function buildInitialMessages(compte: Compte | null): ChatMessage[] {
  const clientLabel = compte ? `${compte.prenom} ${compte.nom}`.trim() : 'Client Kia';
  return [
    {
      sender: 'Karim Trabelsi',
      time: 'Atelier SAV',
      text: `Bonjour ${clientLabel}. Notre équipe technique City Cars est à votre écoute pour toute question concernant votre véhicule Kia.`,
      isMe: false,
    },
  ];
}

export function ChatModal({ isOpen, onClose, currentCompte = null }: ChatModalProps) {
  const storageKey = `k_dms_chat_messages_${currentCompte?.id || 'guest'}`;
  const clientFullName = currentCompte
    ? `${currentCompte.prenom} ${currentCompte.nom}`.trim()
    : 'Client Kia';
  const clientShortName = currentCompte?.prenom || 'Client';

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return buildInitialMessages(currentCompte);
  });
  const [inputVal, setInputVal] = useState('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          setInputVal('');
          return;
        }
      }
    } catch {
      // ignore
    }
    setMessages(buildInitialMessages(currentCompte));
    setInputVal('');
  }, [storageKey, currentCompte]);

  if (!isOpen) return null;

  const persistMessages = (next: ChatMessage[]) => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;

    const userMsg: ChatMessage = {
      sender: clientFullName,
      time: 'Maintenant',
      text: inputVal.trim(),
      isMe: true,
    };

    setMessages((prev) => {
      const next = [...prev, userMsg];
      persistMessages(next);
      return next;
    });
    soundService.play('client_validation_check');
    setInputVal('');

    setTimeout(() => {
      const replyMsg: ChatMessage = {
        sender: 'Karim Trabelsi',
        time: 'À l’instant',
        text: `Bien reçu ${clientShortName} ! Votre message est transmis à votre conseiller atelier pour votre dossier personnel.`,
        isMe: false,
      };
      setMessages((prev) => {
        const next = [...prev, replyMsg];
        persistMessages(next);
        return next;
      });
      soundService.play('client_chat_received');
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-surface-container-lowest text-on-surface rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-surface-container-high flex flex-col">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 flex items-center justify-between border-b border-surface-container-high bg-surface-container-low">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-secondary text-on-secondary flex items-center justify-center font-bold text-sm shadow-sm">
                KT
              </div>
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
            </div>
            <div className="flex flex-col">
              <span className="font-headline-sm text-sm sm:text-base font-bold">Karim Trabelsi</span>
              <span className="font-label-sm text-[11px] text-on-surface-variant">
                Conseiller Service & Diagnostic SAV • La Goulette
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-container text-on-surface-variant transition-colors"
            type="button"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Messages */}
        <div className="p-4 sm:p-5 flex flex-col gap-3 max-h-80 overflow-y-auto bg-surface">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-2xl max-w-[85%] text-xs sm:text-sm flex flex-col gap-1 shadow-sm ${
                m.isMe
                  ? 'bg-primary text-on-primary self-end rounded-br-none'
                  : 'bg-surface-container-low text-on-surface self-start rounded-bl-none border border-surface-container-high'
              }`}
            >
              <p className="leading-relaxed">{m.text}</p>
              <span
                className={`font-label-sm text-[10px] self-end ${
                  m.isMe ? 'text-white/70' : 'text-on-surface-variant'
                }`}
              >
                {m.time}
              </span>
            </div>
          ))}
        </div>

        {/* Input */}
        <form onSubmit={handleSend} className="p-3.5 border-t border-surface-container-high bg-surface-container-low flex items-center gap-2">
          <input
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            placeholder="Écrire votre message à Karim..."
            className="flex-1 px-3.5 py-2.5 rounded-xl bg-surface-container text-on-surface font-body-sm text-xs sm:text-sm focus:outline-none focus:ring-1 focus:ring-primary border border-surface-container-high"
          />
          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl bg-secondary text-on-secondary font-label-md text-xs font-bold hover:bg-secondary-container transition-colors flex items-center justify-center gap-1 shadow-sm active:scale-95"
          >
            <span>Envoyer</span>
            <span className="material-symbols-outlined text-sm">send</span>
          </button>
        </form>
      </div>
    </div>
  );
}
