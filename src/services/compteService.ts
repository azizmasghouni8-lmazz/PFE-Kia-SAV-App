import { Compte } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, doc, setDoc, getDocs } from 'firebase/firestore';
import { resolveKiaModelImage } from '../data/kiaCatalog';

const STORAGE_KEY_COMPTES = 'kia_sav_comptes_db';
const STORAGE_KEY_SESSION = 'kia_sav_active_session';

// Comptes par défaut pré-configurés pour tester immédiatement
export const DEFAULT_COMPTES: Compte[] = [
  {
    id: 'cpt-client-001',
    email: 'client@kia.tn',
    motDePasse: 'client123',
    role: 'client',
    nom: 'Ben Amor',
    prenom: 'Sami',
    telephone: '+216 98 400 123',
    immatriculation: '228 TU 4591',
    modeleVehicule: 'Kia Sportage GT-Line 1.6 T-GDi',
    vin: 'KNA-SP8920147',
    dateCreation: '2024-01-15T09:00:00.000Z',
    avatarUrl:
      'https://lh3.googleusercontent.com/aida/AEtjO1WHiyRtIyGSJiPUfxy7S0syNbwDRM1nZgFQmJSrurHXG9pusQP3otU-iWEz069Nk-Jc2SRupjUe16z5vjs57mD6GERo479C_Q-dtbO1_7OeOqFBPZS2MGYNKdzCvZchTuvmW2Ycl8rhwx4iDP1dUzg1LjUqAx-o9pYK_M95tNF_23gHVqX0HOoHszXS0XvvUkMexVORK1fia7qVEkssmcpg21YbDI_ld-glPKbzNp51nTzpIkbKRabjySabJW4Vr99vEPjllEVQY4k',
  },
  {
    id: 'cpt-chef-001',
    email: 'chef@kia.tn',
    motDePasse: 'chef123',
    role: 'chef',
    nom: 'Mansour',
    prenom: 'Hédi',
    telephone: '+216 71 800 000',
    immatriculation: 'CHEF-ATELIER-01',
    modeleVehicule: 'Atelier Central Tunis La Goulette',
    dateCreation: '2023-05-10T08:00:00.000Z',
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBrKR47oxBFsIOk5dVzZ0EUorphjxsbNSImnaIpjtAnqbe1Uxsj5djcrIIotxFbFsc6m_g8E4M8RsSzLoqMUmftSFIowAMpY3Bj5jVk_kr02giBIQgLyI4fG8cTKS0QmdAIs63MtXE-gkTPXM2xfSkzPyaQBWvQIal-ERyyUhAf6jcYacefT81zM43prHJcc_JicHmTtPm18i7253bgzZPJYznMWnLpPQifjGAW2iKSa2mdJ7aAtba9zQ',
  },
  {
    id: 'cpt-tech-001',
    email: 'tech@kia.tn',
    motDePasse: 'tech123',
    role: 'tech',
    nom: 'Trabelsi',
    prenom: 'Karim',
    telephone: '+216 71 800 001',
    immatriculation: 'TECH-BAIE-04',
    modeleVehicule: 'Master Tech • Baie Mécanique #04',
    dateCreation: '2023-06-20T08:00:00.000Z',
    avatarUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBCpyoqg87or7K7NKKFGD6hWzt1oLDCFyMFhzdtcC1XAR-t-VGe36vFId6PzNwiyIIjjncCxFteAoT6DOmi6C6PzVr3OZ2zQ2s9EXmHERQk9cdbg9xV95sIYLS5C0TOY7sLTlTnWYggi8k1vkeNfI-tpNaWp0cuPWhWC5wu64k7EXAXfiBqg3jyuq1QF1Qp5uRF3Y2SRVKR9zpphhk0zMIKzKSp2Ya1XByM7kUTEfXWvXKgKVyddQlwdg',
  },
  {
    id: 'cpt-client-aziz',
    email: 'azizmasghouni8@gmail.com',
    motDePasse: 'aziz123',
    role: 'client',
    nom: 'Masghouni',
    prenom: 'Aziz',
    telephone: '+216 98 123 456',
    immatriculation: '235 TU 8812',
    modeleVehicule: 'Kia Sportage GT-Line 1.6 T-GDi',
    vin: 'KNA-AZ9823101',
    dateCreation: '2024-03-01T10:00:00.000Z',
    avatarUrl:
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&q=80&w=200',
  },
];

class CompteService {
  /**
   * Récupère tous les comptes enregistrés dans la base
   */
  public getComptes(): Compte[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_COMPTES);
      if (!stored) {
        // Initialiser avec les comptes par défaut
        localStorage.setItem(STORAGE_KEY_COMPTES, JSON.stringify(DEFAULT_COMPTES));
        return DEFAULT_COMPTES;
      }
      const parsed = JSON.parse(stored) as Compte[];
      // Si la liste est vide, réinitialiser avec les comptes de test
      if (!Array.isArray(parsed) || parsed.length === 0) {
        localStorage.setItem(STORAGE_KEY_COMPTES, JSON.stringify(DEFAULT_COMPTES));
        return DEFAULT_COMPTES;
      }
      // S'assurer que les comptes par défaut sont toujours présents et synchronisés
      let modified = false;
      for (const defCompte of DEFAULT_COMPTES) {
        const idx = parsed.findIndex(
          (c) => c.email.toLowerCase() === defCompte.email.toLowerCase()
        );
        if (idx === -1) {
          parsed.push(defCompte);
          modified = true;
        } else if (
          defCompte.email.toLowerCase() === 'azizmasghouni8@gmail.com' &&
          parsed[idx].motDePasse !== defCompte.motDePasse
        ) {
          parsed[idx].motDePasse = defCompte.motDePasse;
          modified = true;
        }
      }
      if (modified) {
        localStorage.setItem(STORAGE_KEY_COMPTES, JSON.stringify(parsed));
      }
      return parsed;
    } catch {
      return DEFAULT_COMPTES;
    }
  }

  /**
   * Trouve un compte par son adresse email (insensible à la casse)
   */
  public trouverCompteParEmail(email: string): Compte | undefined {
    const comptes = this.getComptes();
    const cleanEmail = email.trim().toLowerCase();
    return comptes.find((c) => c.email.toLowerCase() === cleanEmail);
  }

  /**
   * Vérifie si un compte existe par email ou par plaque d'immatriculation
   */
  public trouverCompteParIdentifiant(identifiant: string): Compte | undefined {
    const comptes = this.getComptes();
    const query = identifiant.trim().toLowerCase();
    return comptes.find(
      (c) =>
        c.email.toLowerCase() === query ||
        (c.immatriculation && c.immatriculation.toLowerCase().replace(/\s+/g, '') === query.replace(/\s+/g, ''))
    );
  }

  /**
   * Authentifie un utilisateur avec son email/matricule et son mot de passe
   */
  public authentifier(
    identifiant: string,
    motDePasse: string
  ): { success: boolean; compte?: Compte; error?: string } {
    if (!identifiant || !identifiant.trim()) {
      return { success: false, error: 'Veuillez saisir votre adresse email ou matricule.' };
    }
    if (!motDePasse) {
      return { success: false, error: 'Veuillez saisir votre mot de passe.' };
    }

    const compte = this.trouverCompteParIdentifiant(identifiant);
    if (!compte) {
      return {
        success: false,
        error: "Aucun compte trouvé avec cet identifiant. Veuillez vérifier vos données ou créer un compte.",
      };
    }

    if (compte.motDePasse !== motDePasse) {
      return {
        success: false,
        error: 'Mot de passe incorrect. Veuillez réessayer.',
      };
    }

    // Sauvegarder la session active
    this.sauvegarderSession(compte);
    return { success: true, compte };
  }

  /**
   * Validation stricte d'une adresse email (@, structure locale, domaine et extension obligatoires)
   */
  public validerEmailStrict(rawEmail: string): { valid: boolean; error?: string } {
    const trimmed = (rawEmail || '').trim();
    if (!trimmed) {
      return { valid: false, error: 'Veuillez saisir une adresse email.' };
    }
    if (/\s/.test(trimmed)) {
      return {
        valid: false,
        error: "L'adresse email ne doit contenir aucun espace.",
      };
    }
    if (!trimmed.includes('@')) {
      return {
        valid: false,
        error: "Adresse email invalide : le caractère « @ » est obligatoire (ex: nom@domaine.tn).",
      };
    }
    const parts = trimmed.split('@');
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
      return {
        valid: false,
        error: 'Format email invalide : vérifiez la partie avant et après « @ ».',
      };
    }
    if (trimmed.includes('..')) {
      return {
        valid: false,
        error: 'Adresse email invalide : points consécutifs interdits.',
      };
    }
    const strictEmailRegex =
      /^[a-zA-Z0-9](?:[a-zA-Z0-9._+-]*[a-zA-Z0-9])?@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*\.[a-zA-Z]{2,}$/;
    if (!strictEmailRegex.test(trimmed)) {
      return {
        valid: false,
        error:
          'Adresse email invalide : utilisez un format valide avec domaine et extension (ex: client@kia.tn).',
      };
    }
    return { valid: true };
  }

  /**
   * Vérifie en direct dans Firestore + cache local si une adresse email existe déjà dans la BD
   */
  public async verifierEmailExisteEnBD(email: string): Promise<boolean> {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) return false;

    if (this.trouverCompteParEmail(cleanEmail)) {
      return true;
    }

    try {
      const usersSnap = await getDocs(collection(db, 'users'));
      let foundInFirestore = false;
      usersSnap.forEach((d) => {
        const data = d.data();
        const docEmail = String(data.email || '').trim().toLowerCase();
        if (docEmail === cleanEmail) {
          foundInFirestore = true;
        }
      });
      return foundInFirestore;
    } catch {
      // En cas d'indisponibilité réseau ponctuelle, repli sur le cache local déjà vérifié
      return Boolean(this.trouverCompteParEmail(cleanEmail));
    }
  }

  /**
   * Validation stricte du numéro de téléphone : uniquement 8 chiffres (0-9)
   */
  public validerTelephoneStrict(rawPhone: string): { valid: boolean; normalized?: string; error?: string } {
    const trimmed = (rawPhone || '').trim();
    if (!trimmed) {
      return {
        valid: false,
        error: 'Veuillez saisir un numéro de téléphone composé uniquement de 8 chiffres.',
      };
    }
    if (!/^\d{8}$/.test(trimmed)) {
      return {
        valid: false,
        error: 'Numéro de téléphone invalide : saisissez uniquement 8 chiffres (ex: 98400123).',
      };
    }
    return {
      valid: true,
      normalized: `+216 ${trimmed.slice(0, 2)} ${trimmed.slice(2, 5)} ${trimmed.slice(5, 8)}`,
    };
  }

  /**
   * Validation stricte d'une plaque d'immatriculation tunisienne (Plaque TN : ex 228 TU 4591 ou RS 123456)
   */
  public validerImmatriculationTN(rawPlate: string): { valid: boolean; normalized?: string; error?: string } {
    const cleaned = (rawPlate || '').trim().toUpperCase().replace(/\s+/g, ' ');
    if (!cleaned) {
      return {
        valid: false,
        error: "Veuillez renseigner une plaque d'immatriculation tunisienne (ex: 228 TU 4591).",
      };
    }

    const tuMatch = cleaned.match(/^(\d{1,3})\s*TU\s*(\d{1,4})$/);
    if (tuMatch) {
      const serie = Number(tuMatch[1]);
      const numero = Number(tuMatch[2]);
      if (serie > 0 && numero > 0) {
        return {
          valid: true,
          normalized: `${tuMatch[1]} TU ${tuMatch[2]}`,
        };
      }
    }

    const rsMatch = cleaned.match(/^RS\s*(\d{1,6})$/) || cleaned.match(/^(\d{1,6})\s*RS$/);
    if (rsMatch && Number(rsMatch[1]) > 0) {
      return {
        valid: true,
        normalized: `RS ${rsMatch[1]}`,
      };
    }

    return {
      valid: false,
      error:
        "Immatriculation invalide : seule une plaque tunisienne (TN) est acceptée (ex: 228 TU 4591 ou RS 123456).",
    };
  }

  /**
   * Validation stricte du numéro de châssis (VIN) : exactement 17 caractères alphanumériques
   */
  public validerVinStrict(rawVin: string): { valid: boolean; normalized?: string; error?: string } {
    const cleaned = (rawVin || '').trim().toUpperCase();
    if (!cleaned) {
      return {
        valid: false,
        error: 'Veuillez saisir le numéro de châssis (VIN) à 17 caractères.',
      };
    }
    if (!/^[A-Z0-9]{17}$/.test(cleaned)) {
      return {
        valid: false,
        error:
          'Numéro de châssis (VIN) invalide : il doit contenir uniquement 17 caractères alphanumériques (sans espaces ni tirets).',
      };
    }
    return { valid: true, normalized: cleaned };
  }

  /**
   * Crée un nouveau compte Client dans la base 'compte' (après contrôle strict email, téléphone, plaque TN, VIN 17 chars + doublon BD Firestore)
   */
  public async creerCompteClient(data: {
    email: string;
    motDePasse: string;
    nom: string;
    prenom: string;
    telephone: string;
    immatriculation: string;
    modeleVehicule: string;
    vin?: string;
  }): Promise<{ success: boolean; compte?: Compte; error?: string }> {
    const cleanEmail = data.email.trim().toLowerCase();

    // 1. Validation stricte des champs & caractéristiques email / téléphone / plaque TN / châssis
    if (!data.nom.trim() || !data.prenom.trim()) {
      return { success: false, error: 'Veuillez renseigner votre nom et votre prénom.' };
    }

    const emailCheck = this.validerEmailStrict(cleanEmail);
    if (!emailCheck.valid) {
      return { success: false, error: emailCheck.error };
    }

    const phoneCheck = this.validerTelephoneStrict(data.telephone);
    if (!phoneCheck.valid || !phoneCheck.normalized) {
      return { success: false, error: phoneCheck.error };
    }

    const plateCheck = this.validerImmatriculationTN(data.immatriculation);
    if (!plateCheck.valid || !plateCheck.normalized) {
      return { success: false, error: plateCheck.error };
    }

    const vinCheck = this.validerVinStrict(data.vin || '');
    if (!vinCheck.valid || !vinCheck.normalized) {
      return { success: false, error: vinCheck.error };
    }

    if (!data.motDePasse || data.motDePasse.length < 4) {
      return { success: false, error: 'Le mot de passe doit comporter au moins 4 caractères.' };
    }

    // 2. Vérifier si l'email existe déjà dans la Base de Données (Firestore + local)
    const alreadyExists = await this.verifierEmailExisteEnBD(cleanEmail);
    if (alreadyExists) {
      return {
        success: false,
        error:
          'Refus sécurité : cette adresse email existe déjà dans notre base de données. Veuillez vous connecter avec votre compte existant.',
      };
    }

    const nouveauCompte: Compte = {
      id: `cpt-client-${Date.now()}`,
      email: cleanEmail,
      motDePasse: data.motDePasse,
      role: 'client',
      nom: data.nom.trim(),
      prenom: data.prenom.trim(),
      telephone: phoneCheck.normalized,
      immatriculation: plateCheck.normalized,
      modeleVehicule: data.modeleVehicule.trim() || 'Kia Nouvelle Gamme',
      vin: vinCheck.normalized,
      dateCreation: new Date().toISOString(),
      avatarUrl:
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=200',
    };

    const comptes = this.getComptes();
    comptes.unshift(nouveauCompte);

    try {
      localStorage.setItem(STORAGE_KEY_COMPTES, JSON.stringify(comptes));

      // Synchronisation directe avec Firestore (users & vehicles)
      try {
        await Promise.all([
          setDoc(doc(db, 'users', nouveauCompte.id), {
            id: nouveauCompte.id,
            nom: nouveauCompte.nom,
            prenom: nouveauCompte.prenom,
            email: nouveauCompte.email,
            password: nouveauCompte.motDePasse,
            telephone: nouveauCompte.telephone,
            role: 'CLIENT',
            created_at: nouveauCompte.dateCreation,
          }),
          setDoc(doc(db, 'vehicles', `veh-${nouveauCompte.id}`), {
            id: `veh-${nouveauCompte.id}`,
            client_id: nouveauCompte.id,
            immatriculation: nouveauCompte.immatriculation,
            modele: nouveauCompte.modeleVehicule,
            chassis_vin: nouveauCompte.vin,
            annee: 2024,
            kilometers: 1000,
            imageUrl: resolveKiaModelImage(nouveauCompte.modeleVehicule),
          }),
        ]);
      } catch (err) {
        console.warn('Sync Firestore nouveau compte (non bloquant):', err);
      }

      return { success: true, compte: nouveauCompte };
    } catch {
      return {
        success: false,
        error: "Erreur lors de l'enregistrement du compte dans la base.",
      };
    }
  }

  /**
   * Synchronise les comptes et véhicules associés depuis Firestore
   */
  public async syncFromFirestore(): Promise<Compte[]> {
    try {
      const [usersSnap, vehiclesSnap] = await Promise.all([
        getDocs(collection(db, 'users')),
        getDocs(collection(db, 'vehicles')),
      ]);

      const vehicleByClientId = new Map<
        string,
        { immatriculation?: string; modele?: string; chassis_vin?: string }
      >();
      vehiclesSnap.forEach((vDoc) => {
        const v = vDoc.data();
        if (v.client_id && !vehicleByClientId.has(v.client_id)) {
          vehicleByClientId.set(v.client_id, {
            immatriculation: v.immatriculation,
            modele: v.modele,
            chassis_vin: v.chassis_vin,
          });
        }
      });

      if (usersSnap.empty) return this.getComptes();

      const loaded: Compte[] = [];
      usersSnap.forEach((d) => {
        const u = d.data();
        const userId = u.id || d.id;
        const veh = vehicleByClientId.get(userId);
        loaded.push({
          id: userId,
          email: u.email,
          motDePasse: u.password || 'client123',
          role:
            u.role === 'CLIENT'
              ? 'client'
              : u.role === 'RECEPTIONNAIRE'
              ? 'chef'
              : u.role === 'TECHNICIEN'
              ? 'tech'
              : 'client',
          nom: u.nom,
          prenom: u.prenom,
          telephone: u.telephone || '',
          immatriculation: u.immatriculation || veh?.immatriculation,
          modeleVehicule: u.modele_vehicule || veh?.modele,
          vin: u.vin || veh?.chassis_vin,
          dateCreation: u.created_at || new Date().toISOString(),
        });
      });

      const current = this.getComptes();
      if (loaded.length > 0) {
        const merged = [...current];
        for (const item of loaded) {
          const idx = merged.findIndex(
            (c) => c.email.toLowerCase() === (item.email || '').toLowerCase()
          );
          if (idx >= 0) {
            merged[idx] = {
              ...merged[idx],
              ...item,
              immatriculation: item.immatriculation || merged[idx].immatriculation,
              modeleVehicule: item.modeleVehicule || merged[idx].modeleVehicule,
              vin: item.vin || merged[idx].vin,
            };
          } else {
            merged.push(item);
          }
        }
        localStorage.setItem(STORAGE_KEY_COMPTES, JSON.stringify(merged));

        // Mettre à jour la session active si elle vient d'être enrichie depuis Firestore
        const active = this.getSessionActive();
        if (active) {
          const refreshed = merged.find(
            (c) => c.email.toLowerCase() === active.email.toLowerCase()
          );
          if (refreshed) {
            this.sauvegarderSession(refreshed);
            window.dispatchEvent(new Event('k_dms_compte_synced'));
          }
        }
        return merged;
      }
      return current;
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'users');
      return this.getComptes();
    }
  }

  /**
   * Gestion de la session active
   */
  public getSessionActive(): Compte | null {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_SESSION);
      if (!stored) return null;
      return JSON.parse(stored) as Compte;
    } catch {
      return null;
    }
  }

  public sauvegarderSession(compte: Compte): void {
    try {
      localStorage.setItem(STORAGE_KEY_SESSION, JSON.stringify(compte));
    } catch (e) {
      console.error('Erreur sauvegarde session:', e);
    }
  }

  public deconnecterSession(): void {
    try {
      localStorage.removeItem(STORAGE_KEY_SESSION);
    } catch (e) {
      console.error('Erreur déconnexion:', e);
    }
  }

  public reinitialiserBase(): void {
    try {
      localStorage.setItem(STORAGE_KEY_COMPTES, JSON.stringify(DEFAULT_COMPTES));
      this.deconnecterSession();
    } catch (e) {
      console.error('Erreur réinitialisation:', e);
    }
  }
}

export const compteService = new CompteService();
