import { useState, useEffect } from 'react';
import { Compte } from '../../types';
import { compteService } from '../../services/compteService';

interface LoginTabletProps {
  onLoginSuccess: (compte: Compte) => void;
  onNavigateToRegister: () => void;
  initialEmail?: string;
  successNotification?: string | null;
}

export function LoginTablet({
  onLoginSuccess,
  onNavigateToRegister,
  initialEmail = '',
  successNotification,
}: LoginTabletProps) {
  const [identifiant, setIdentifiant] = useState(initialEmail || '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(successNotification || null);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [recoveredInfo, setRecoveredInfo] = useState<{ email: string; mdp: string; nom: string } | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);

  useEffect(() => {
    setIdentifiant(initialEmail || '');
    setPassword('');
    if (successNotification) {
      setNotification(successNotification);
    }
  }, [initialEmail, successNotification]);

  const handleOpenForgot = () => {
    const candidate = identifiant.trim() || 'azizmasghouni8@gmail.com';
    setForgotEmail(candidate);
    setForgotError(null);
    setRecoveredInfo(null);
    setShowForgotModal(true);
    // Auto-check if candidate email exists
    const compte = compteService.trouverCompteParIdentifiant(candidate);
    if (compte) {
      setRecoveredInfo({
        email: compte.email,
        mdp: compte.motDePasse,
        nom: `${compte.prenom} ${compte.nom}`,
      });
    }
  };

  const handleSearchPassword = (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setRecoveredInfo(null);
    const compte = compteService.trouverCompteParIdentifiant(forgotEmail.trim());
    if (compte) {
      setRecoveredInfo({
        email: compte.email,
        mdp: compte.motDePasse,
        nom: `${compte.prenom} ${compte.nom}`,
      });
    } else {
      setForgotError(`Aucun compte trouvé avec l'adresse "${forgotEmail}".`);
    }
  };

  const handleUseRecoveredPassword = () => {
    if (!recoveredInfo) return;
    setIdentifiant(recoveredInfo.email);
    setPassword(recoveredInfo.mdp);
    setShowForgotModal(false);
    setNotification(`Mot de passe renseigné pour ${recoveredInfo.email}. Cliquez sur "Se Connecter".`);
  };

  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setNotification(null);
    setIsLoggingIn(true);

    try {
      let result = compteService.authentifier(identifiant, password);

      if (!result.success) {
        await compteService.syncFromFirestore();
        result = compteService.authentifier(identifiant, password);
      }

      if (!result.success || !result.compte) {
        setErrorMessage(result.error || 'Identifiant ou mot de passe incorrect.');
        return;
      }

      onLoginSuccess(result.compte);
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center relative overflow-hidden p-3 sm:p-6 select-none">
      {/* Showroom Background */}
      <div className="fixed inset-0 z-0 overflow-hidden">
        <img
          alt="Kia Showroom Interior"
          className="w-full h-full object-cover object-center filter blur-[2px] brightness-90 scale-105"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuCefZyUVJQ0WFywyYaLUELnxojGF5INgJjjFkN0DZWfS5ZkD2zIB4dC9lC23Sn26xDdrE0eku2UpJ_qT5GUA6STPOl91lVwh4A1fTJ6JDe7Vyv2ShreirOpwUoVUcduFAcnHiAbsp3M9FxBUjgeLaQC7Ar6vBobuPybvuAGSCjtHJkkRWC0WTiOr3nCnUH5gGDRq3Q3B9rFgQttvLTFZdIS68iESu2hLu4Q8VHpSd83Qa_TJL4EAvP9THu8TmpXpBrUz3Q"
        />
        <div className="absolute inset-0 bg-black/45 backdrop-blur-[2px]" />
      </div>

      {/* Main Tablet Frame */}
      <main className="relative z-10 w-full max-w-4xl flex items-center justify-center my-auto">
        <div className="p-3 sm:p-5 rounded-[2.5rem] sm:rounded-[3rem] w-full max-w-[850px] transition-all bg-gradient-to-br from-[#2b2e33] via-[#151719] to-[#0d0f11] shadow-[0_30px_70px_-10px_rgba(0,0,0,0.85),0_10px_25px_-5px_rgba(0,0,0,0.6),inset_0_1px_2px_rgba(255,255,255,0.25)] border border-white/10">
          {/* Tablet Screen */}
          <div className="relative rounded-[2rem] sm:rounded-[2.4rem] overflow-hidden border border-white/10 px-5 py-7 sm:px-12 sm:py-9 flex flex-col items-center justify-between min-h-[560px] sm:min-h-[600px] bg-[radial-gradient(circle_at_50%_20%,rgba(20,32,45,0.92)_0%,rgba(9,15,21,0.97)_100%)]">
            {/* Screen Diagonal Glare Layer */}
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-white/[0.06] via-transparent to-transparent z-10" />

            {/* Tablet Camera dot */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center space-x-2 opacity-50 z-20">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-800 ring-1 ring-white/10" />
              <span className="w-2 h-2 rounded-full bg-[#0a0d11] ring-1 ring-white/20" />
            </div>

            {/* Screen Header */}
            <header className="relative z-20 w-full flex flex-col items-center text-center mt-1">
              <div className="flex items-center space-x-3 mb-4 sm:mb-6">
                {/* Kia Logo */}
                <svg viewBox="0 0 100 32" className="h-6 sm:h-7 w-auto text-white" fill="currentColor">
                  <path d="M4 27 L4 6 L12 6 L12 18 L26 6 L35 6 L18 20 L36 27 L26 27 L13 22 L12 23 L12 27 Z" />
                  <path d="M42 27 L42 6 L50 6 L50 27 Z" />
                  <path d="M57 27 L70 6 L80 6 L93 27 L84 27 L81 21 L69 21 L66 27 Z M72 16 L78 16 L75 10 Z" />
                </svg>
                <div className="flex items-center space-x-2">
                  <span className="text-xl sm:text-2xl font-light text-white/50 pl-1">|</span>
                  <span className="text-lg sm:text-xl font-medium tracking-wide text-white pl-1 font-headline-sm">
                    City Cars
                  </span>
                </div>
              </div>

              <h1 className="text-2xl sm:text-3xl md:text-[2rem] font-bold tracking-tight text-white leading-snug max-w-xl font-headline-md">
                Espace Personnel & Atelier <br className="hidden sm:inline" />
                <span className="font-light">—</span> City Cars Kia
              </h1>
              <p className="mt-1 text-sm text-slate-400 font-normal tracking-wide">
                Service Après-Vente (SAV) • Authentification Sécurisée
              </p>
            </header>

            {/* Login Card */}
            <section className="relative z-20 w-full max-w-[420px] mt-3 mb-2">
              <div className="bg-[#101922]/85 backdrop-blur-md rounded-2xl border border-white/10 p-5 sm:p-7 shadow-2xl">
                {/* Success Notification */}
                {notification && (
                  <div className="mb-4 p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-xl flex items-center gap-2.5 text-emerald-200">
                    <span className="material-symbols-outlined text-emerald-400 text-xl">check_circle</span>
                    <p className="text-xs font-medium">{notification}</p>
                  </div>
                )}

                {/* Error Banner */}
                {errorMessage && (
                  <div className="mb-4 p-3 bg-red-950/80 border border-red-500/50 rounded-xl flex items-center gap-2.5 text-red-200">
                    <span className="material-symbols-outlined text-red-400 text-xl">error</span>
                    <p className="text-xs font-medium">{errorMessage}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Email / Matricule */}
                  <div className="relative">
                    <label className="sr-only" htmlFor="identifiant">
                      Email ou Immatriculation
                    </label>
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <span className="material-symbols-outlined text-[20px]">person</span>
                    </div>
                    <input
                      id="identifiant"
                      type="text"
                      value={identifiant}
                      onChange={(e) => setIdentifiant(e.target.value)}
                      placeholder="Email ou Immatriculation"
                      autoComplete="off"
                      className="w-full pl-11 pr-4 py-3 bg-[#131b24]/90 border border-slate-700/70 text-slate-100 placeholder-slate-400 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent transition-colors font-body-md"
                      required
                    />
                  </div>

                  {/* Password */}
                  <div className="relative">
                    <label className="sr-only" htmlFor="password">
                      Mot de passe
                    </label>
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <span className="material-symbols-outlined text-[20px]">lock</span>
                    </div>
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mot de passe"
                      autoComplete="current-password"
                      className="w-full pl-11 pr-11 py-3 bg-[#131b24]/90 border border-slate-700/70 text-slate-100 placeholder-slate-400 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent transition-colors font-body-md"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors focus:outline-none"
                    >
                      <span className="material-symbols-outlined text-[20px]">
                        {showPassword ? 'visibility_off' : 'visibility'}
                      </span>
                    </button>
                  </div>

                  {/* Forgot Password Link */}
                  <div className="flex justify-end -mt-1">
                    <button
                      type="button"
                      onClick={handleOpenForgot}
                      className="text-[12px] text-slate-400 hover:text-red-400 transition-colors flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[14px]">help</span>
                      <span>Mot de passe oublié ?</span>
                    </button>
                  </div>

                  {/* Submit button */}
                  <div className="pt-1">
                    <button
                      type="submit"
                      disabled={isLoggingIn}
                      className="w-full py-3 px-4 bg-[#bb162b] hover:bg-[#a11324] disabled:opacity-60 active:scale-[0.99] text-white font-medium text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-150 flex items-center justify-center space-x-2 font-headline-sm"
                    >
                      <span>{isLoggingIn ? 'Vérification...' : 'Se Connecter'}</span>
                    </button>
                  </div>

                  {/* Register Account Link */}
                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={onNavigateToRegister}
                      className="text-xs text-slate-300 hover:text-white font-medium group transition-colors inline-flex items-center gap-1.5"
                    >
                      <span>Pas encore de compte ?</span>
                      <span className="text-red-400 group-hover:text-red-300 font-bold underline underline-offset-4">
                        Créer un compte client
                      </span>
                    </button>
                  </div>

                  {/* Quick demo profiles shortcuts */}
                  <div className="pt-2">
                    <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 text-center">
                      Profils de test rapides (Firebase Firestore)
                    </p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setIdentifiant('azizmasghouni8@gmail.com');
                          setPassword('aziz123');
                        }}
                        className="px-2 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-left transition-colors"
                      >
                        <p className="text-xs font-bold text-white leading-tight">Aziz Masghouni</p>
                        <p className="text-[10px] text-slate-400">Client • Sportage GT</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIdentifiant('client@kia.tn');
                          setPassword('client123');
                        }}
                        className="px-2 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-left transition-colors"
                      >
                        <p className="text-xs font-bold text-white leading-tight">Sami Ben Amor</p>
                        <p className="text-[10px] text-slate-400">Client • 228 TU 4591</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIdentifiant('chef@kia.tn');
                          setPassword('chef123');
                        }}
                        className="px-2 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-left transition-colors"
                      >
                        <p className="text-xs font-bold text-white leading-tight">Hédi Mansour</p>
                        <p className="text-[10px] text-slate-400">Chef d'Atelier</p>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIdentifiant('tech@kia.tn');
                          setPassword('tech123');
                        }}
                        className="px-2 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-left transition-colors"
                      >
                        <p className="text-xs font-bold text-white leading-tight">Karim Trabelsi</p>
                        <p className="text-[10px] text-slate-400">Technicien Master</p>
                      </button>
                    </div>
                  </div>

                  {/* Notice & Firebase Badge */}
                  <div className="flex flex-col items-center justify-center pt-3 text-[11px] text-slate-400 border-t border-white/5 gap-1">
                    <div className="flex items-center space-x-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-emerald-300 font-medium">Connecté à Firebase Firestore (7 tables NoSQL)</span>
                    </div>
                    <span className="text-slate-500 text-[10px]">City Cars Kia Tunisie • Base temps réel</span>
                  </div>
                </form>
              </div>
            </section>

            {/* Tablet Home Bar */}
            <div className="relative z-20 w-32 h-1 bg-white/20 rounded-full mt-2" />
          </div>
        </div>
      </main>

      {/* Modal Récupération Mot de Passe */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#121b25] border border-white/15 rounded-2xl p-6 w-full max-w-md shadow-2xl relative text-left">
            <button
              onClick={() => setShowForgotModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-2xl">close</span>
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-400">
                <span className="material-symbols-outlined text-2xl">lock_reset</span>
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Récupération de mot de passe</h3>
                <p className="text-xs text-slate-400">Consultez ou récupérez instantanément vos accès</p>
              </div>
            </div>

            <form onSubmit={handleSearchPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  Adresse email ou immatriculation
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="ex: azizmasghouni8@gmail.com"
                    className="flex-1 px-3.5 py-2.5 bg-[#0d141b] border border-slate-700 rounded-lg text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-600"
                    required
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold border border-white/10 transition-colors"
                  >
                    Vérifier
                  </button>
                </div>
              </div>
            </form>

            {forgotError && (
              <div className="mt-4 p-3 bg-red-950/70 border border-red-500/40 rounded-xl text-red-200 text-xs flex items-center gap-2">
                <span className="material-symbols-outlined text-red-400 text-base">error</span>
                <span>{forgotError}</span>
              </div>
            )}

            {recoveredInfo && (
              <div className="mt-4 p-4 bg-emerald-950/40 border border-emerald-500/40 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-emerald-400 font-medium flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">check_circle</span>
                    Compte identifié ({recoveredInfo.nom})
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-900/60 text-emerald-200">Actif</span>
                </div>

                <div className="bg-[#0b1016] p-3 rounded-lg border border-emerald-500/20">
                  <div className="text-[11px] text-slate-400 mb-0.5">Votre mot de passe associé :</div>
                  <div className="flex items-center justify-between">
                    <span className="text-base font-mono font-bold tracking-wider text-emerald-300 select-all">
                      {recoveredInfo.mdp}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(recoveredInfo.mdp)}
                      className="text-xs text-slate-400 hover:text-emerald-300 flex items-center gap-1"
                      title="Copier le mot de passe"
                    >
                      <span className="material-symbols-outlined text-sm">content_copy</span>
                      <span>Copier</span>
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleUseRecoveredPassword}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow transition-colors flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-base">login</span>
                  <span>Remplir et se connecter</span>
                </button>
              </div>
            )}

            <div className="mt-5 pt-3 border-t border-white/10 flex justify-end">
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
