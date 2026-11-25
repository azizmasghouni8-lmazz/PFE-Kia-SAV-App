// Moteur de synthèse Web Audio multi-interfaces (Client, Chef d'Atelier, Technicien)
// Zéro fichier externe requis, déverrouillage automatique au premier geste, anti-spam intégré.

import { AppRole } from '../types';
import { SoundProfileMode, workshopSyncService } from './workshopSyncService';

export type SoundEffectId =
  // Client
  | 'client_rdv_confirmed'
  | 'client_quote_received'
  | 'client_tracking_step'
  | 'client_vehicle_ready'
  | 'client_chat_received'
  | 'client_validation_check'
  // Chef d'Atelier
  | 'chef_rdv_activity'
  | 'chef_order_ready'
  | 'chef_ev_safety_block'
  | 'chef_resource_conflict'
  // Technicien
  | 'tech_new_order'
  | 'tech_quote_accepted'
  | 'tech_quote_refused'
  | 'tech_part_arrived'
  | 'tech_checklist_click';

export interface SoundCatalogItem {
  id: SoundEffectId;
  role: 'client' | 'chef' | 'tech';
  label: string;
  description: string;
  categoryLabel: string;
}

export const SOUND_CATALOG: SoundCatalogItem[] = [
  // Interface Client
  {
    id: 'client_rdv_confirmed',
    role: 'client',
    label: 'Rendez-vous confirmé par le Chef',
    description: 'Carillon ascendant doux (2 notes claires, type accueil concession)',
    categoryLabel: 'Client · RDV',
  },
  {
    id: 'client_quote_received',
    role: 'client',
    label: 'Nouveau devis complémentaire reçu',
    description: 'Tonalité cristalline d’attention pour Assistance & Devis',
    categoryLabel: 'Client · Devis',
  },
  {
    id: 'client_tracking_step',
    role: 'client',
    label: 'Évolution suivi en direct',
    description: 'Note discrète à chaque étape franchie en atelier',
    categoryLabel: 'Client · Suivi',
  },
  {
    id: 'client_vehicle_ready',
    role: 'client',
    label: 'Véhicule prêt pour restitution',
    description: 'Jingle de clôture harmonieux (accord majeur doux)',
    categoryLabel: 'Client · Sortie',
  },
  {
    id: 'client_chat_received',
    role: 'client',
    label: 'Message Chat Atelier',
    description: '« Pop » feutré lors d’une réponse du conseiller SAV',
    categoryLabel: 'Client · Chat',
  },
  {
    id: 'client_validation_check',
    role: 'client',
    label: 'Validation & Justificatif / Paiement',
    description: 'Son court « check » lors d’un envoi ou ouverture justificatif PDF',
    categoryLabel: 'Client · Action',
  },
  // Interface Chef d'Atelier
  {
    id: 'chef_rdv_activity',
    role: 'chef',
    label: 'Nouveau RDV / Long Terme / Modif ou Annulation',
    description: 'Double-bip d’ordonnancement pro pour le poste d’accueil',
    categoryLabel: 'Chef · Planning',
  },
  {
    id: 'chef_order_ready',
    role: 'chef',
    label: 'OR terminé (« Prêt pour restitution »)',
    description: 'Tonalité montante nette annonçant le passage en facturation',
    categoryLabel: 'Chef · Restitution',
  },
  {
    id: 'chef_ev_safety_block',
    role: 'chef',
    label: 'Blocage Haute Tension EV/HEV',
    description: 'Double signal grave d’avertissement sécurité électrique',
    categoryLabel: 'Chef · Sécurité',
  },
  {
    id: 'chef_resource_conflict',
    role: 'chef',
    label: 'Conflit ressource (Absent / Pont Maintenance)',
    description: 'Tonalité d’attention ambrée sur dossiers actifs impactés',
    categoryLabel: 'Chef · Ressources',
  },
  // Interface Technicien
  {
    id: 'tech_new_order',
    role: 'tech',
    label: 'Nouvel Ordre de Réparation assigné',
    description: 'Signal dynamique court type « nouveau ticket baie »',
    categoryLabel: 'Tech · Baie',
  },
  {
    id: 'tech_quote_accepted',
    role: 'tech',
    label: 'Devis pièce accepté par le client',
    description: 'Accord majeur positif confirmant la commande ou le montage',
    categoryLabel: 'Tech · Devis +',
  },
  {
    id: 'tech_quote_refused',
    role: 'tech',
    label: 'Devis pièce refusé par le client',
    description: 'Note neutre signalant la décision client',
    categoryLabel: 'Tech · Devis -',
  },
  {
    id: 'tech_part_arrived',
    role: 'tech',
    label: 'Pièce reçue en stock (validée Chef)',
    description: 'Son de déblocage net pour reprise d’OR En attente pièce',
    categoryLabel: 'Tech · Stock',
  },
  {
    id: 'tech_checklist_click',
    role: 'tech',
    label: 'Validation checklist / Fin d’intervention',
    description: 'Clic mécanique sec et satisfaisant sur tablette atelier',
    categoryLabel: 'Tech · Tactile',
  },
];

export interface AudioPrefsState {
  muted: boolean;
  volume: number; // 0..100
  profile: SoundProfileMode;
  workshopEnabled: boolean;
}

const LOCAL_AUDIO_PREFS_KEY = 'k_dms_audio_session_prefs_v1';

const ROLE_GAIN_BALANCED: Record<'client' | 'chef' | 'tech', number> = {
  client: 0.55,
  chef: 0.72,
  tech: 0.92,
};

const ROLE_GAIN_DISCRETE: Record<'client' | 'chef' | 'tech', number> = {
  client: 0.36,
  chef: 0.44,
  tech: 0.54,
};

class SoundService {
  private ctx: AudioContext | null = null;
  private activeRole: AppRole = 'auth';
  private lastPlayedAt = new Map<string, number>();
  private unlockListenersBound = false;
  private prefs: AudioPrefsState;

  constructor() {
    this.prefs = this.loadInitialPrefs();
    if (typeof window !== 'undefined') {
      this.bindUnlockGestures();
      window.addEventListener('k_dms_settings_updated', () => {
        this.syncFromWorkshopSettings();
      });
    }
  }

  private loadInitialPrefs(): AudioPrefsState {
    const ws = workshopSyncService.getWorkshopSettings();
    const baseEnabled = ws.soundConfig?.enabled ?? true;
    const baseVolume = ws.soundConfig?.masterVolume ?? 75;
    const baseProfile: SoundProfileMode = ws.soundConfig?.profile === 'discrete' ? 'discrete' : 'balanced';

    try {
      const raw = localStorage.getItem(LOCAL_AUDIO_PREFS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AudioPrefsState>;
        return {
          muted: typeof parsed.muted === 'boolean' ? parsed.muted : !baseEnabled,
          volume:
            typeof parsed.volume === 'number'
              ? Math.max(0, Math.min(100, parsed.volume))
              : baseVolume,
          profile: baseProfile,
          workshopEnabled: baseEnabled,
        };
      }
    } catch {
      // ignore
    }

    return {
      muted: !baseEnabled,
      volume: baseVolume,
      profile: baseProfile,
      workshopEnabled: baseEnabled,
    };
  }

  private persistSessionPrefs() {
    try {
      localStorage.setItem(
        LOCAL_AUDIO_PREFS_KEY,
        JSON.stringify({ muted: this.prefs.muted, volume: this.prefs.volume })
      );
      window.dispatchEvent(new Event('k_dms_audio_prefs_updated'));
    } catch {
      // ignore
    }
  }

  syncFromWorkshopSettings() {
    const ws = workshopSyncService.getWorkshopSettings();
    const sc = ws.soundConfig;
    if (!sc) return;
    this.prefs = {
      muted: !sc.enabled,
      volume: Math.max(0, Math.min(100, sc.masterVolume)),
      profile: sc.profile === 'discrete' ? 'discrete' : 'balanced',
      workshopEnabled: sc.enabled,
    };
    this.persistSessionPrefs();
  }

  getPreferences(): AudioPrefsState {
    return { ...this.prefs };
  }

  setMuted(muted: boolean) {
    this.prefs = { ...this.prefs, muted };
    this.persistSessionPrefs();
  }

  toggleMuted(): boolean {
    const nextMuted = !this.prefs.muted;
    this.setMuted(nextMuted);
    if (!nextMuted) {
      this.unlockAudioContext();
    }
    return nextMuted;
  }

  setVolume(volume: number) {
    const clamped = Math.max(0, Math.min(100, Math.round(volume)));
    this.prefs = {
      ...this.prefs,
      volume: clamped,
      muted: clamped === 0 ? true : this.prefs.muted && clamped > 0 ? false : this.prefs.muted,
    };
    this.persistSessionPrefs();
  }

  setActiveRole(role: AppRole) {
    this.activeRole = role;
  }

  getActiveRole(): AppRole {
    return this.activeRole;
  }

  private bindUnlockGestures() {
    if (this.unlockListenersBound || typeof window === 'undefined') return;
    this.unlockListenersBound = true;
    const unlock = () => {
      this.unlockAudioContext();
    };
    window.addEventListener('pointerdown', unlock, { passive: true });
    window.addEventListener('keydown', unlock, { passive: true });
    window.addEventListener('touchstart', unlock, { passive: true });
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return null;
    if (!this.ctx) {
      this.ctx = new AudioCtx();
    }
    return this.ctx;
  }

  unlockAudioContext() {
    const ctx = this.ensureContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }

  private getSoundMeta(id: SoundEffectId): SoundCatalogItem | undefined {
    return SOUND_CATALOG.find((item) => item.id === id);
  }

  play(
    id: SoundEffectId,
    options?: { bypassRoleCheck?: boolean; force?: boolean; cooldownMs?: number }
  ): boolean {
    const bypass = Boolean(options?.bypassRoleCheck);
    const force = Boolean(options?.force);

    if (!force && (this.prefs.muted || !this.prefs.workshopEnabled || this.prefs.volume <= 0)) {
      return false;
    }

    const meta = this.getSoundMeta(id);
    if (!meta) return false;

    if (!bypass && this.activeRole !== meta.role) {
      return false;
    }

    const cooldown = options?.cooldownMs ?? (id === 'tech_checklist_click' ? 90 : 500);
    const now = Date.now();
    const prevTime = this.lastPlayedAt.get(id) ?? 0;
    if (!force && now - prevTime < cooldown) {
      return false;
    }
    this.lastPlayedAt.set(id, now);

    const ctx = this.ensureContext();
    if (!ctx) return false;

    if (ctx.state === 'suspended') {
      ctx
        .resume()
        .then(() => {
          this.synthesize(ctx, id, meta.role);
        })
        .catch(() => {});
      return true;
    }

    this.synthesize(ctx, id, meta.role);
    return true;
  }

  playSampleForCurrentRole() {
    const sampleId: SoundEffectId =
      this.activeRole === 'chef'
        ? 'chef_rdv_activity'
        : this.activeRole === 'tech'
        ? 'tech_new_order'
        : 'client_rdv_confirmed';
    this.play(sampleId, { bypassRoleCheck: true, force: true });
  }

  private computeGain(soundRole: 'client' | 'chef' | 'tech'): number {
    const volFactor = Math.max(0.05, this.prefs.volume / 100);
    const table = this.prefs.profile === 'discrete' ? ROLE_GAIN_DISCRETE : ROLE_GAIN_BALANCED;
    return Math.min(0.45, table[soundRole] * volFactor * 0.42);
  }

  private playTone(
    ctx: AudioContext,
    masterGain: GainNode,
    params: {
      freq: number;
      endFreq?: number;
      type?: OscillatorType;
      startOffset: number;
      duration: number;
      peak?: number;
      attack?: number;
      filterFreq?: number;
    }
  ) {
    const t0 = ctx.currentTime + params.startOffset;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = params.type ?? 'sine';
    osc.frequency.setValueAtTime(params.freq, t0);
    if (params.endFreq && params.endFreq !== params.freq) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(40, params.endFreq),
        t0 + params.duration
      );
    }

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(params.filterFreq ?? 4200, t0);

    const attack = Math.min(params.attack ?? 0.012, params.duration * 0.4);
    const peak = params.peak ?? 1.0;

    env.gain.setValueAtTime(0.0001, t0);
    env.gain.linearRampToValueAtTime(peak, t0 + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t0 + params.duration);

    osc.connect(filter);
    filter.connect(env);
    env.connect(masterGain);

    osc.start(t0);
    osc.stop(t0 + params.duration + 0.02);
  }

  private synthesize(
    ctx: AudioContext,
    id: SoundEffectId,
    soundRole: 'client' | 'chef' | 'tech'
  ) {
    const master = ctx.createGain();
    master.gain.setValueAtTime(this.computeGain(soundRole), ctx.currentTime);
    master.connect(ctx.destination);

    switch (id) {
      // ==========================================
      // INTERFACE CLIENT
      // ==========================================
      case 'client_rdv_confirmed': {
        // Carillon ascendant doux (2 notes claires, accueil concession)
        this.playTone(ctx, master, { freq: 523.25, type: 'sine', startOffset: 0, duration: 0.24, peak: 0.85, filterFreq: 3200 });
        this.playTone(ctx, master, { freq: 659.25, type: 'sine', startOffset: 0.14, duration: 0.36, peak: 0.95, filterFreq: 3400 });
        this.playTone(ctx, master, { freq: 1318.5, type: 'sine', startOffset: 0.14, duration: 0.25, peak: 0.18, filterFreq: 3400 });
        break;
      }

      case 'client_quote_received': {
        // Tonalité cristalline d'attention
        this.playTone(ctx, master, { freq: 987.77, type: 'triangle', startOffset: 0, duration: 0.22, peak: 0.65, filterFreq: 4800 });
        this.playTone(ctx, master, { freq: 1318.51, type: 'sine', startOffset: 0.1, duration: 0.34, peak: 0.78, filterFreq: 5200 });
        break;
      }

      case 'client_tracking_step': {
        // Petite note discrète à chaque étape franchie
        this.playTone(ctx, master, { freq: 783.99, endFreq: 830.61, type: 'sine', startOffset: 0, duration: 0.16, peak: 0.65, filterFreq: 2600 });
        break;
      }

      case 'client_vehicle_ready': {
        // Jingle de clôture harmonieux (accord majeur doux C5-E5-G5-C6)
        this.playTone(ctx, master, { freq: 523.25, type: 'sine', startOffset: 0, duration: 0.42, peak: 0.72, filterFreq: 3200 });
        this.playTone(ctx, master, { freq: 659.25, type: 'sine', startOffset: 0.09, duration: 0.42, peak: 0.75, filterFreq: 3400 });
        this.playTone(ctx, master, { freq: 783.99, type: 'sine', startOffset: 0.18, duration: 0.45, peak: 0.78, filterFreq: 3600 });
        this.playTone(ctx, master, { freq: 1046.5, type: 'triangle', startOffset: 0.27, duration: 0.55, peak: 0.65, filterFreq: 3800 });
        break;
      }

      case 'client_chat_received': {
        // « Pop » feutré pour nouveau message SAV
        this.playTone(ctx, master, { freq: 310, endFreq: 610, type: 'sine', startOffset: 0, duration: 0.09, attack: 0.005, peak: 0.85, filterFreq: 1800 });
        break;
      }

      case 'client_validation_check': {
        // Son court de validation (« check »)
        this.playTone(ctx, master, { freq: 740, type: 'sine', startOffset: 0, duration: 0.08, attack: 0.006, peak: 0.7, filterFreq: 3200 });
        this.playTone(ctx, master, { freq: 1046.5, type: 'sine', startOffset: 0.07, duration: 0.15, attack: 0.006, peak: 0.85, filterFreq: 3600 });
        break;
      }

      // ==========================================
      // INTERFACE CHEF D'ATELIER
      // ==========================================
      case 'chef_rdv_activity': {
        // Double-bip d'ordonnancement pro (calme mais audible)
        this.playTone(ctx, master, { freq: 659.25, type: 'triangle', startOffset: 0, duration: 0.1, attack: 0.006, peak: 0.85, filterFreq: 2800 });
        this.playTone(ctx, master, { freq: 659.25, type: 'triangle', startOffset: 0.14, duration: 0.12, attack: 0.006, peak: 0.9, filterFreq: 2800 });
        break;
      }

      case 'chef_order_ready': {
        // Tonalité montante nette (facturation / sortie)
        this.playTone(ctx, master, { freq: 587.33, type: 'sine', startOffset: 0, duration: 0.14, peak: 0.8, filterFreq: 3600 });
        this.playTone(ctx, master, { freq: 739.99, type: 'sine', startOffset: 0.1, duration: 0.14, peak: 0.85, filterFreq: 3800 });
        this.playTone(ctx, master, { freq: 880.0, type: 'triangle', startOffset: 0.2, duration: 0.28, peak: 0.9, filterFreq: 4200 });
        break;
      }

      case 'chef_ev_safety_block': {
        // Double signal grave d'avertissement sécurité Haute Tension EV/HEV
        this.playTone(ctx, master, { freq: 196, endFreq: 165, type: 'sawtooth', startOffset: 0, duration: 0.16, attack: 0.008, peak: 0.72, filterFreq: 780 });
        this.playTone(ctx, master, { freq: 175, endFreq: 140, type: 'sawtooth', startOffset: 0.21, duration: 0.22, attack: 0.008, peak: 0.8, filterFreq: 720 });
        break;
      }

      case 'chef_resource_conflict': {
        // Tonalité d'attention ambrée
        this.playTone(ctx, master, { freq: 440, type: 'triangle', startOffset: 0, duration: 0.16, peak: 0.8, filterFreq: 2100 });
        this.playTone(ctx, master, { freq: 392, type: 'triangle', startOffset: 0.17, duration: 0.22, peak: 0.75, filterFreq: 1900 });
        break;
      }

      // ==========================================
      // INTERFACE TECHNICIEN
      // ==========================================
      case 'tech_new_order': {
        // Signal dynamique court type « nouveau ticket baie » (distinct en atelier)
        this.playTone(ctx, master, { freq: 880, type: 'triangle', startOffset: 0, duration: 0.11, attack: 0.005, peak: 0.9, filterFreq: 4500 });
        this.playTone(ctx, master, { freq: 1174.66, type: 'triangle', startOffset: 0.1, duration: 0.11, attack: 0.005, peak: 0.95, filterFreq: 4800 });
        this.playTone(ctx, master, { freq: 1318.51, type: 'sine', startOffset: 0.2, duration: 0.22, attack: 0.005, peak: 1.0, filterFreq: 5200 });
        break;
      }

      case 'tech_quote_accepted': {
        // Accord positif client accepte devis pièce
        this.playTone(ctx, master, { freq: 523.25, type: 'triangle', startOffset: 0, duration: 0.22, peak: 0.8, filterFreq: 3600 });
        this.playTone(ctx, master, { freq: 659.25, type: 'triangle', startOffset: 0.08, duration: 0.25, peak: 0.85, filterFreq: 3800 });
        this.playTone(ctx, master, { freq: 783.99, type: 'sine', startOffset: 0.16, duration: 0.34, peak: 0.9, filterFreq: 4200 });
        break;
      }

      case 'tech_quote_refused': {
        // Note neutre client refuse devis pièce
        this.playTone(ctx, master, { freq: 349.23, type: 'sine', startOffset: 0, duration: 0.16, peak: 0.7, filterFreq: 1800 });
        this.playTone(ctx, master, { freq: 293.66, type: 'sine', startOffset: 0.15, duration: 0.22, peak: 0.65, filterFreq: 1500 });
        break;
      }

      case 'tech_part_arrived': {
        // Son de déblocage net (pièce reçue en stock)
        this.playTone(ctx, master, { freq: 659.25, type: 'triangle', startOffset: 0, duration: 0.11, peak: 0.85, filterFreq: 4200 });
        this.playTone(ctx, master, { freq: 830.61, type: 'triangle', startOffset: 0.09, duration: 0.11, peak: 0.9, filterFreq: 4500 });
        this.playTone(ctx, master, { freq: 1318.51, type: 'sine', startOffset: 0.18, duration: 0.3, peak: 0.95, filterFreq: 5000 });
        break;
      }

      case 'tech_checklist_click': {
        // Clic mécanique sec et satisfaisant
        this.playTone(ctx, master, { freq: 1550, endFreq: 520, type: 'triangle', startOffset: 0, duration: 0.045, attack: 0.002, peak: 0.95, filterFreq: 4200 });
        this.playTone(ctx, master, { freq: 920, endFreq: 380, type: 'sine', startOffset: 0.015, duration: 0.04, attack: 0.002, peak: 0.65, filterFreq: 3000 });
        break;
      }
    }
  }
}

export const soundService = new SoundService();
