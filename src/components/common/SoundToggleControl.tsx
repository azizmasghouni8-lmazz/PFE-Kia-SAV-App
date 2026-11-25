import { useState, useEffect, useRef } from 'react';
import { soundService, AudioPrefsState } from '../../services/soundService';

interface SoundToggleControlProps {
  variant?: 'client' | 'pro';
}

export function SoundToggleControl({ variant = 'pro' }: SoundToggleControlProps) {
  const [prefs, setPrefs] = useState<AudioPrefsState>(() => soundService.getPreferences());
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sync = () => setPrefs(soundService.getPreferences());
    window.addEventListener('k_dms_audio_prefs_updated', sync);
    window.addEventListener('k_dms_settings_updated', sync);
    return () => {
      window.removeEventListener('k_dms_audio_prefs_updated', sync);
      window.removeEventListener('k_dms_settings_updated', sync);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isOpen]);

  const effectiveMuted = prefs.muted || !prefs.workshopEnabled || prefs.volume === 0;
  const iconName = effectiveMuted
    ? 'volume_off'
    : prefs.volume < 45
    ? 'volume_down'
    : 'volume_up';

  const handleToggleMute = () => {
    soundService.toggleMuted();
    setPrefs(soundService.getPreferences());
  };

  const handleVolumeChange = (val: number) => {
    soundService.unlockAudioContext();
    soundService.setVolume(val);
    setPrefs(soundService.getPreferences());
  };

  const handleTest = () => {
    soundService.unlockAudioContext();
    if (effectiveMuted) {
      soundService.setMuted(false);
      if (prefs.volume === 0) soundService.setVolume(70);
    }
    soundService.playSampleForCurrentRole();
    setPrefs(soundService.getPreferences());
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className={`relative p-2 rounded-lg transition-colors flex items-center gap-1 whitespace-nowrap shrink-0 ${
          effectiveMuted
            ? 'text-on-surface-variant/70 hover:bg-surface-container-high hover:text-on-surface'
            : variant === 'client'
            ? 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'
            : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
        }`}
        title={effectiveMuted ? 'Notifications sonores coupées (cliquer pour régler)' : `Notifications sonores actives (${prefs.volume}%)`}
        aria-label="Contrôle volume et mode muet"
      >
        <span className={`material-symbols-outlined text-[20px] ${effectiveMuted ? 'text-on-surface-variant' : 'text-secondary'}`}>
          {iconName}
        </span>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl border border-slate-200 shadow-2xl z-50 overflow-hidden">
          <div className="px-4 py-3 bg-[#0e1d28] text-white flex items-center justify-between gap-2">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider">Audio & Notifications</h4>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Profil : {prefs.profile === 'discrete' ? 'Discret Accueil' : 'Équilibré Atelier'}
              </p>
            </div>
            <button
              type="button"
              onClick={handleToggleMute}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-colors whitespace-nowrap shrink-0 ${
                effectiveMuted
                  ? 'bg-rose-600 hover:bg-rose-500 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white'
              }`}
            >
              {effectiveMuted ? 'Muet' : 'Actif'}
            </button>
          </div>

          <div className="p-4 flex flex-col gap-3.5 text-xs text-slate-800">
            {!prefs.workshopEnabled && (
              <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-[11px]">
                Désactivé dans Paramètres Atelier.
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-600">Volume session</span>
                <span className="font-mono tabular-nums font-bold text-slate-900">
                  {effectiveMuted ? '0%' : `${prefs.volume}%`}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={effectiveMuted ? 0 : prefs.volume}
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                className="w-full accent-secondary cursor-pointer"
                aria-label="Volume des notifications sonores"
              />
            </div>

            <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={handleToggleMute}
                className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold transition-colors whitespace-nowrap"
              >
                {effectiveMuted ? 'Réactiver le son' : 'Couper (Muet)'}
              </button>

              <button
                type="button"
                onClick={handleTest}
                className="px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary-container text-white font-bold transition-colors flex items-center gap-1 whitespace-nowrap"
              >
                <span className="material-symbols-outlined text-sm">play_arrow</span>
                <span>Tester</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
