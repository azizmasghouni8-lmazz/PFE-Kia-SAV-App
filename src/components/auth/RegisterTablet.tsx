import { useState } from 'react';
import { compteService } from '../../services/compteService';

interface RegisterTabletProps {
  onRegisterSuccess: (email: string) => void;
  onNavigateToLogin: () => void;
}

const KIA_MODELS = [
  'Kia Sportage GT-Line',
  'Kia Sportage SX',
  'Kia Sorento HEV',
  'Kia Seltos',
  'Kia Sonet',
  'Kia Picanto GT-Line',
  'Kia Picanto LX',
  'Kia Rio Berline',
  'Kia Ceed',
  'Kia XCeed',
  'Kia K5',
  'Kia Carens',
  'Kia Niro EV / HEV',
  'Kia EV6 Electric',
  'Kia EV9 GT-Line',
  'Kia K2700 Utilitaire',
];

export function RegisterTablet({ onRegisterSuccess, onNavigateToLogin }: RegisterTabletProps) {
  const [nom, setNom] = useState('');
  const [prenom, setPrenom] = useState('');
  const [email, setEmail] = useState('');
  const [telephone, setTelephone] = useState('');
  const [modeleVehicule, setModeleVehicule] = useState('Kia Sportage GT-Line');
  const [immatriculation, setImmatriculation] = useState('');
  const [vin, setVin] = useState('');
  const [motDePasse, setMotDePasse] = useState('');
  const [confirmationMotDePasse, setConfirmationMotDePasse] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [emailFieldError, setEmailFieldError] = useState<string | null>(null);
  const [phoneFieldError, setPhoneFieldError] = useState<string | null>(null);
  const [plateFieldError, setPlateFieldError] = useState<string | null>(null);
  const [vinFieldError, setVinFieldError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleEmailChange = (val: string) => {
    setEmail(val);
    if (!val.trim()) {
      setEmailFieldError(null);
      return;
    }
    const check = compteService.validerEmailStrict(val);
    setEmailFieldError(check.valid ? null : check.error || 'Adresse email invalide.');
  };

  const handlePhoneChange = (rawVal: string) => {
    const digitsOnly = rawVal.replace(/\D/g, '').slice(0, 8);
    setTelephone(digitsOnly);
    if (digitsOnly.length === 8) {
      setPhoneFieldError(null);
    } else if (/[^0-9]/.test(rawVal)) {
      setPhoneFieldError('Uniquement des chiffres (8 chiffres requis).');
    } else {
      setPhoneFieldError(null);
    }
  };

  const handlePlateChange = (rawVal: string) => {
    const sanitized = rawVal.toUpperCase().replace(/[^A-Z0-9 ]/g, '').slice(0, 14);
    setImmatriculation(sanitized);
    if (!sanitized.trim()) {
      setPlateFieldError(null);
      return;
    }
    const check = compteService.validerImmatriculationTN(sanitized);
    if (check.valid) {
      setPlateFieldError(null);
    }
  };

  const handleVinChange = (rawVal: string) => {
    const sanitized = rawVal.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 17);
    setVin(sanitized);
    if (sanitized.length === 17) {
      setVinFieldError(null);
    } else if (/[^A-Z0-9]/i.test(rawVal)) {
      setVinFieldError('Uniquement lettres et chiffres (17 caractères exacts).');
    } else {
      setVinFieldError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validation stricte des champs
    if (!nom.trim() || !prenom.trim()) {
      setErrorMessage('Veuillez renseigner votre nom et prénom.');
      return;
    }

    const emailCheck = compteService.validerEmailStrict(email);
    if (!emailCheck.valid) {
      const msg = emailCheck.error || 'Veuillez renseigner une adresse email valide.';
      setEmailFieldError(msg);
      setErrorMessage(msg);
      return;
    }

    const phoneCheck = compteService.validerTelephoneStrict(telephone);
    if (!phoneCheck.valid) {
      const msg = phoneCheck.error || 'Le téléphone doit contenir uniquement 8 chiffres.';
      setPhoneFieldError(msg);
      setErrorMessage(msg);
      return;
    }

    const plateCheck = compteService.validerImmatriculationTN(immatriculation);
    if (!plateCheck.valid) {
      const msg = plateCheck.error || 'Plaque tunisienne (TN) valide requise (ex: 228 TU 4591).';
      setPlateFieldError(msg);
      setErrorMessage(msg);
      return;
    }

    const vinCheck = compteService.validerVinStrict(vin);
    if (!vinCheck.valid) {
      const msg = vinCheck.error || 'Le numéro de châssis doit comporter exactement 17 caractères.';
      setVinFieldError(msg);
      setErrorMessage(msg);
      return;
    }

    if (motDePasse.length < 4) {
      setErrorMessage('Le mot de passe doit comporter au moins 4 caractères.');
      return;
    }

    if (motDePasse !== confirmationMotDePasse) {
      setErrorMessage('Les mots de passe ne correspondent pas.');
      return;
    }

    setIsSubmitting(true);

    const result = await compteService.creerCompteClient({
      email,
      motDePasse,
      nom,
      prenom,
      telephone,
      modeleVehicule,
      immatriculation,
      vin,
    });

    setIsSubmitting(false);

    if (!result.success) {
      setErrorMessage(result.error || "Erreur lors de la création du compte.");
      return;
    }

    setIsSuccess(true);
    setTimeout(() => {
      onRegisterSuccess(email.trim().toLowerCase());
    }, 1200);
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
        <div className="absolute inset-0 bg-black/55 backdrop-blur-[2px]" />
      </div>

      {/* Main Tablet Frame */}
      <main className="relative z-10 w-full max-w-4xl flex items-center justify-center my-auto">
        <div className="p-3 sm:p-5 rounded-[2.5rem] sm:rounded-[3rem] w-full max-w-[850px] transition-all bg-gradient-to-br from-[#2b2e33] via-[#151719] to-[#0d0f11] shadow-[0_30px_70px_-10px_rgba(0,0,0,0.85),0_10px_25px_-5px_rgba(0,0,0,0.6),inset_0_1px_2px_rgba(255,255,255,0.25)] border border-white/10">
          {/* Tablet Screen */}
          <div className="relative rounded-[2rem] sm:rounded-[2.4rem] overflow-hidden border border-white/10 px-4 py-6 sm:px-10 sm:py-8 flex flex-col items-center justify-between min-h-[640px] max-h-[92vh] overflow-y-auto bg-[radial-gradient(circle_at_50%_15%,rgba(20,32,45,0.94)_0%,rgba(9,15,21,0.98)_100%)]">
            {/* Screen Glare Layer */}
            <div className="absolute inset-0 pointer-events-none bg-gradient-to-br from-white/[0.05] via-transparent to-transparent z-10" />

            {/* Tablet Camera dot */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center space-x-2 opacity-50 z-20">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-800 ring-1 ring-white/10" />
              <span className="w-2 h-2 rounded-full bg-[#0a0d11] ring-1 ring-white/20" />
            </div>

            {/* Screen Header */}
            <header className="relative z-20 w-full flex flex-col items-center text-center mt-1">
              <div className="flex items-center space-x-3 mb-3">
                {/* Kia Logo */}
                <svg viewBox="0 0 100 32" className="h-6 sm:h-7 w-auto text-white" fill="currentColor">
                  <path d="M4 27 L4 6 L12 6 L12 18 L26 6 L35 6 L18 20 L36 27 L26 27 L13 22 L12 23 L12 27 Z" />
                  <path d="M42 27 L42 6 L50 6 L50 27 Z" />
                  <path d="M57 27 L70 6 L80 6 L93 27 L84 27 L81 21 L69 21 L66 27 Z M72 16 L78 16 L75 10 Z" />
                </svg>
                <div className="flex items-center space-x-2">
                  <span className="text-xl font-light text-white/50 pl-1">|</span>
                  <span className="text-lg font-medium tracking-wide text-white pl-1 font-headline-sm">
                    City Cars
                  </span>
                </div>
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white leading-snug font-headline-md">
                Créer un Compte Client <span className="font-light">—</span> SAV Kia
              </h1>
              <p className="mt-1 text-xs sm:text-sm text-slate-400 font-normal tracking-wide">
                Enregistrez votre profil et votre véhicule pour accéder aux services d'atelier
              </p>
            </header>

            {/* Form Container */}
            <section className="relative z-20 w-full max-w-[560px] my-3">
              <div className="bg-[#101922]/85 backdrop-blur-md rounded-2xl border border-white/10 p-5 sm:p-7 shadow-2xl">
                {/* Success Banner */}
                {isSuccess && (
                  <div className="mb-4 p-3 bg-emerald-950/80 border border-emerald-500/50 rounded-xl flex items-center gap-3 text-emerald-200 animate-fadeIn">
                    <span className="material-symbols-outlined text-emerald-400 text-2xl">check_circle</span>
                    <div>
                      <p className="font-bold text-sm">Compte créé avec succès !</p>
                      <p className="text-xs text-emerald-300">Redirection vers la connexion en cours...</p>
                    </div>
                  </div>
                )}

                {/* Error Banner */}
                {errorMessage && (
                  <div className="mb-4 p-3 bg-red-950/80 border border-red-500/50 rounded-xl flex items-center gap-2.5 text-red-200 animate-shake">
                    <span className="material-symbols-outlined text-red-400 text-xl">error</span>
                    <p className="text-xs font-medium">{errorMessage}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit} noValidate className="space-y-3.5">
                  {/* Row 1: Nom & Prénom */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                        Prénom *
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <span className="material-symbols-outlined text-[18px]">badge</span>
                        </div>
                        <input
                          type="text"
                          value={prenom}
                          onChange={(e) => setPrenom(e.target.value)}
                          placeholder="Ex: Sami"
                          required
                          className="w-full pl-9 pr-3 py-2.5 bg-[#131b24]/90 border border-slate-700/70 text-slate-100 placeholder-slate-500 text-xs sm:text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                        Nom de famille *
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <span className="material-symbols-outlined text-[18px]">person</span>
                        </div>
                        <input
                          type="text"
                          value={nom}
                          onChange={(e) => setNom(e.target.value)}
                          placeholder="Ex: Ben Amor"
                          required
                          className="w-full pl-9 pr-3 py-2.5 bg-[#131b24]/90 border border-slate-700/70 text-slate-100 placeholder-slate-500 text-xs sm:text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent transition-colors"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Email & Téléphone */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                        Adresse Email *
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <span className="material-symbols-outlined text-[18px]">mail</span>
                        </div>
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => handleEmailChange(e.target.value)}
                          placeholder="client@domaine.tn"
                          required
                          className={`w-full pl-9 pr-3 py-2.5 bg-[#131b24]/90 border text-slate-100 placeholder-slate-500 text-xs sm:text-sm rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                            emailFieldError
                              ? 'border-red-500 focus:ring-red-500'
                              : 'border-slate-700/70 focus:ring-red-600 focus:border-transparent'
                          }`}
                        />
                      </div>
                      {emailFieldError && (
                        <p className="mt-1 text-[11px] text-red-400 font-medium leading-snug">
                          {emailFieldError}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                        Téléphone (8 chiffres) *
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center gap-1.5 pointer-events-none text-slate-400">
                          <span className="material-symbols-outlined text-[17px]">phone</span>
                          <span className="text-[11px] font-mono font-bold text-slate-300 bg-white/10 px-1.5 py-0.5 rounded">
                            +216
                          </span>
                        </div>
                        <input
                          type="tel"
                          inputMode="numeric"
                          pattern="[0-9]{8}"
                          maxLength={8}
                          value={telephone}
                          onChange={(e) => handlePhoneChange(e.target.value)}
                          onBlur={() => {
                            if (telephone && telephone.length !== 8) {
                              setPhoneFieldError('Le numéro doit contenir exactement 8 chiffres.');
                            }
                          }}
                          placeholder="98400123"
                          required
                          className={`w-full pl-20 pr-12 py-2.5 bg-[#131b24]/90 border text-slate-100 placeholder-slate-500 font-mono text-xs sm:text-sm rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                            phoneFieldError
                              ? 'border-red-500 focus:ring-red-500'
                              : telephone.length === 8
                              ? 'border-emerald-500/60 focus:ring-emerald-500'
                              : 'border-slate-700/70 focus:ring-red-600 focus:border-transparent'
                          }`}
                        />
                        <span
                          className={`absolute inset-y-0 right-0 pr-3 flex items-center text-[10px] font-mono font-bold ${
                            telephone.length === 8 ? 'text-emerald-400' : 'text-slate-400'
                          }`}
                        >
                          {telephone.length}/8
                        </span>
                      </div>
                      {phoneFieldError && (
                        <p className="mt-1 text-[11px] text-red-400 font-medium leading-snug">
                          {phoneFieldError}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Row 3: Véhicule Kia & Immatriculation */}
                  <div className="p-3 bg-white/[0.03] rounded-xl border border-white/5 space-y-3">
                    <span className="text-[11px] font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm">directions_car</span>
                      Véhicule Kia Associé
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-medium text-slate-300 mb-1">
                          Modèle Kia
                        </label>
                        <select
                          value={modeleVehicule}
                          onChange={(e) => setModeleVehicule(e.target.value)}
                          className="w-full px-3 py-2.5 bg-[#131b24]/90 border border-slate-700/70 text-slate-100 text-xs sm:text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent transition-colors"
                        >
                          {KIA_MODELS.map((model) => (
                            <option key={model} value={model} className="bg-[#131b24] text-white">
                              {model}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-300 mb-1">
                          Immatriculation (Plaque TN) *
                        </label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                            <span className="text-[10px] font-bold px-1 bg-white/10 rounded font-mono">TN</span>
                          </div>
                          <input
                            type="text"
                            value={immatriculation}
                            onChange={(e) => handlePlateChange(e.target.value)}
                            onBlur={() => {
                              if (immatriculation.trim()) {
                                const check = compteService.validerImmatriculationTN(immatriculation);
                                setPlateFieldError(check.valid ? null : check.error || 'Plaque TN invalide.');
                              }
                            }}
                            placeholder="Ex: 228 TU 4591"
                            required
                            className={`w-full pl-11 pr-3 py-2.5 bg-[#131b24]/90 border text-slate-100 placeholder-slate-500 font-mono text-xs sm:text-sm rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                              plateFieldError
                                ? 'border-red-500 focus:ring-red-500'
                                : immatriculation && compteService.validerImmatriculationTN(immatriculation).valid
                                ? 'border-emerald-500/60 focus:ring-emerald-500'
                                : 'border-slate-700/70 focus:ring-red-600 focus:border-transparent'
                            }`}
                          />
                        </div>
                        {plateFieldError && (
                          <p className="mt-1 text-[11px] text-red-400 font-medium leading-snug">
                            {plateFieldError}
                          </p>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-medium text-slate-300 mb-1">
                        Numéro de Châssis (VIN) * — 17 caractères exacts
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={vin}
                          onChange={(e) => handleVinChange(e.target.value)}
                          onBlur={() => {
                            if (vin && vin.length !== 17) {
                              setVinFieldError('Le numéro de châssis doit contenir exactement 17 caractères.');
                            }
                          }}
                          placeholder="Ex: KNAGU411BK5123456"
                          maxLength={17}
                          required
                          className={`w-full pl-3 pr-14 py-2 bg-[#131b24]/90 border text-slate-100 placeholder-slate-500 font-mono text-xs rounded-lg focus:outline-none focus:ring-2 transition-colors ${
                            vinFieldError
                              ? 'border-red-500 focus:ring-red-500'
                              : vin.length === 17
                              ? 'border-emerald-500/60 focus:ring-emerald-500'
                              : 'border-slate-700/70 focus:ring-red-600 focus:border-transparent'
                          }`}
                        />
                        <span
                          className={`absolute inset-y-0 right-0 pr-3 flex items-center text-[10px] font-mono font-bold ${
                            vin.length === 17 ? 'text-emerald-400' : 'text-slate-400'
                          }`}
                        >
                          {vin.length}/17
                        </span>
                      </div>
                      {vinFieldError && (
                        <p className="mt-1 text-[11px] text-red-400 font-medium leading-snug">
                          {vinFieldError}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Row 4: Mot de passe & Confirmation */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                        Mot de passe *
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <span className="material-symbols-outlined text-[18px]">lock</span>
                        </div>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={motDePasse}
                          onChange={(e) => setMotDePasse(e.target.value)}
                          placeholder="Min 4 caractères"
                          required
                          className="w-full pl-9 pr-8 py-2.5 bg-[#131b24]/90 border border-slate-700/70 text-slate-100 placeholder-slate-500 text-xs sm:text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent transition-colors"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">
                        Confirmer le mot de passe *
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                          <span className="material-symbols-outlined text-[18px]">lock_reset</span>
                        </div>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={confirmationMotDePasse}
                          onChange={(e) => setConfirmationMotDePasse(e.target.value)}
                          placeholder="Répétez le mot de passe"
                          required
                          className="w-full pl-9 pr-9 py-2.5 bg-[#131b24]/90 border border-slate-700/70 text-slate-100 placeholder-slate-500 text-xs sm:text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-red-600 focus:border-transparent transition-colors"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors focus:outline-none"
                        >
                          <span className="material-symbols-outlined text-[18px]">
                            {showPassword ? 'visibility_off' : 'visibility'}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting || isSuccess}
                      className="w-full py-3 px-4 bg-[#bb162b] hover:bg-[#a11324] active:scale-[0.99] disabled:opacity-50 text-white font-medium text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-150 flex items-center justify-center space-x-2 font-headline-sm"
                    >
                      <span className="material-symbols-outlined text-[20px]">person_add</span>
                      <span>{isSubmitting ? 'Enregistrement dans la base...' : 'Valider & Créer mon Compte'}</span>
                    </button>
                  </div>

                  {/* Return to login link */}
                  <div className="text-center pt-2 border-t border-white/10 flex items-center justify-center gap-2">
                    <span className="text-xs text-slate-400">Vous avez déjà un compte ?</span>
                    <button
                      type="button"
                      onClick={onNavigateToLogin}
                      className="text-xs font-semibold text-white underline underline-offset-4 decoration-red-500 hover:text-red-400 transition-colors"
                    >
                      Se Connecter
                    </button>
                  </div>
                </form>
              </div>
            </section>

            {/* Tablet Home Bar */}
            <div className="relative z-20 w-32 h-1 bg-white/20 rounded-full mt-1" />
          </div>
        </div>
      </main>
    </div>
  );
}
