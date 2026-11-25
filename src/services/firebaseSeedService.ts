import { collection, doc, setDoc, getDocs, limit, query } from 'firebase/firestore';
import { db } from '../firebase';
import { DEFAULT_COMPTES } from './compteService';
import { INITIAL_PARTS_STOCK } from '../data/partsData';
import { KIA_MODELS_CATALOG } from '../data/kiaCatalog';

export interface SeedStatus {
  seeded: boolean;
  message: string;
  collectionsSeeded: string[];
}

/**
 * Service d'initialisation et de migration des données SAV Kia vers Firebase Firestore
 * Conforme aux 7 tables du schéma SQL officiel :
 * 1. users
 * 2. vehicles
 * 3. appointments
 * 4. repair_orders
 * 5. spare_parts
 * 6. repair_order_parts
 * 7. quotes
 */
class FirebaseSeedService {
  private hasRun = false;

  public async seedDatabaseIfNeeded(): Promise<SeedStatus> {
    if (this.hasRun) {
      return { seeded: true, message: 'Déjà initialisé', collectionsSeeded: [] };
    }

    try {
      // Vérifier si la collection users a déjà des documents
      const usersRef = collection(db, 'users');
      const q = query(usersRef, limit(1));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        this.hasRun = true;
        return {
          seeded: true,
          message: 'Base Firestore opérationnelle et connectée.',
          collectionsSeeded: [],
        };
      }

      console.info('🚀 Démarrage de la migration initiale des données vers Firestore...');
      const collectionsSeeded: string[] = [];

      // 1. Table des Utilisateurs (users)
      for (const compte of DEFAULT_COMPTES) {
        const roleSql =
          compte.role === 'client'
            ? 'CLIENT'
            : compte.role === 'chef'
            ? 'RECEPTIONNAIRE'
            : compte.role === 'tech'
            ? 'TECHNICIEN'
            : 'ADMIN';

        await setDoc(doc(db, 'users', compte.id), {
          id: compte.id,
          nom: compte.nom,
          prenom: compte.prenom,
          email: compte.email.toLowerCase(),
          password: compte.motDePasse,
          telephone: compte.telephone,
          role: roleSql,
          created_at: compte.dateCreation || new Date().toISOString(),
        });
      }
      collectionsSeeded.push('users');

      // 2. Table des Véhicules (vehicles)
      const initialVehicles = [
        {
          id: 'veh-aziz-01',
          client_id: 'cpt-client-aziz',
          immatriculation: '235 TU 8812',
          modele: 'Kia Sportage GT-Line 1.6 T-GDi',
          chassis_vin: 'KNA-AZ9823101',
          annee: 2024,
          kilometers: 18420,
          imageUrl: '/images/kia/sportage.jpg',
        },
        {
          id: 'veh-sami-01',
          client_id: 'cpt-client-001',
          immatriculation: '228 TU 4591',
          modele: 'Kia Sportage GT-Line',
          chassis_vin: 'KNA-SP8920147',
          annee: 2023,
          kilometers: 28420,
          imageUrl: '/images/kia/sportage.jpg',
        },
        {
          id: 'veh-picanto-01',
          client_id: 'cpt-client-001',
          immatriculation: '215 TU 8832',
          modele: 'Kia Picanto GT-Line 1.0L MPI',
          chassis_vin: 'KNA-PC330198',
          annee: 2021,
          kilometers: 42100,
          imageUrl: '/images/kia/picanto.jpg',
        },
      ];

      // Ajouter aussi les modèles du catalogue Kia comme références de véhicules
      for (const model of KIA_MODELS_CATALOG.slice(0, 5)) {
        initialVehicles.push({
          id: `veh-catalog-${model.id}`,
          client_id: 'cpt-client-001',
          immatriculation: `24${Math.floor(10 + Math.random() * 80)} TU ${Math.floor(1000 + Math.random() * 8999)}`,
          modele: `${model.name} (${model.defaultFinish})`,
          chassis_vin: `KNA-CAT-${model.id.toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`,
          annee: model.defaultYear,
          kilometers: model.defaultMileage,
          imageUrl: model.imageUrl,
        });
      }

      for (const vehicle of initialVehicles) {
        await setDoc(doc(db, 'vehicles', vehicle.id), vehicle);
      }
      collectionsSeeded.push('vehicles');

      // 3. Table des Rendez-vous (appointments)
      const initialAppointments = [
        {
          id: 'RDV-2026-901',
          vehicle_id: 'veh-aziz-01',
          client_name: 'M. Aziz Masghouni',
          client_phone: '+216 98 123 456',
          service_type: 'Révision 30 000 km + Contrôle freinage & purge',
          appointment_date: 'Vendredi 13 Novembre 2026 à 09:30',
          price: '280.000 TND',
          status: 'CONFIRMED',
        },
        {
          id: 'RDV-2026-902',
          vehicle_id: 'veh-sami-01',
          client_name: 'M. Sami Ben Amor',
          client_phone: '+216 98 400 123',
          service_type: 'Entretien Périodique & Diagnostic KDS 75 points',
          appointment_date: 'Vendredi 13 Novembre 2026 à 11:00',
          price: '190.000 TND',
          status: 'PENDING',
        },
      ];

      for (const appt of initialAppointments) {
        await setDoc(doc(db, 'appointments', appt.id), appt);
      }
      collectionsSeeded.push('appointments');

      // 4. Table des Ordres de Réparation (repair_orders)
      const initialRepairOrders = [
        {
          id: '#OR-2026-9104',
          appointment_id: 'RDV-2026-901',
          technician_id: 'cpt-tech-001',
          vehicle_name: 'Kia Sportage GT-Line 1.6 T-GDi',
          plate: '235 TU 8812',
          client_name: 'M. Aziz Masghouni',
          bay: 'Pont ciseaux #04 (Mécanique)',
          service: 'Révision 30 000 km + Contrôle freinage & purge',
          status: 'EN_REPARATION',
          current_step: 2,
          progress_percent: 50,
          fuel_level: 75,
          km_in: 18420,
          diagnostic_notes:
            'Contrôle KDS OK. Usure avancée des plaquettes avant constatée (2.1 mm restant). Devis complémentaire transmis.',
          created_at: new Date().toISOString(),
        },
        {
          id: '#OR-2026-9100',
          appointment_id: 'RDV-2026-902',
          technician_id: 'cpt-tech-001',
          vehicle_name: 'Kia Sorento HEV Hybride',
          plate: '235 TU 1189',
          client_name: 'M. Hédi Mansour',
          bay: 'Pont #02 (Mécanique)',
          service: 'Remplacement bras de suspension + Géométrie',
          status: 'EN_DIAGNOSTIC',
          current_step: 1,
          progress_percent: 30,
          fuel_level: 60,
          km_in: 32400,
          diagnostic_notes: 'Jeu rotule avant droit détecté lors de la réception atelier.',
          created_at: new Date().toISOString(),
        },
      ];

      for (const ro of initialRepairOrders) {
        await setDoc(doc(db, 'repair_orders', ro.id), ro);
      }
      collectionsSeeded.push('repair_orders');

      // 5. Table du Catalogue des Pièces de Rechange (spare_parts)
      for (const part of INITIAL_PARTS_STOCK) {
        await setDoc(doc(db, 'spare_parts', part.id), {
          id: part.id,
          reference_oem: part.oemRef,
          name: part.name,
          category: part.category,
          unit_price: part.unitPriceTND,
          stock_qty: part.stockCount,
          shelf_location: part.shelfLocation,
        });
      }
      collectionsSeeded.push('spare_parts');

      // 6. Table de liaison Ordre de Réparation <-> Pièces (repair_order_parts)
      const initialOrderParts = [
        {
          id: 'rop-01',
          repair_order_id: '#OR-2026-9104',
          spare_part_id: 'part-fr-01',
          quantity: 1,
          unit_price: 210.0,
          status: 'APPROVED',
        },
        {
          id: 'rop-02',
          repair_order_id: '#OR-2026-9104',
          spare_part_id: 'part-fl-01',
          quantity: 1,
          unit_price: 48.0,
          status: 'APPROVED',
        },
      ];

      for (const item of initialOrderParts) {
        await setDoc(doc(db, 'repair_order_parts', item.id), item);
      }
      collectionsSeeded.push('repair_order_parts');

      // 7. Table des Devis Complémentaires (quotes)
      const initialQuotes = [
        {
          id: 'QUOTE-2026-9104-01',
          repair_order_id: '#OR-2026-9104',
          vehicle_name: 'Kia Sportage GT-Line',
          plate: '228 TU 4591',
          client_id: 'cpt-client-001',
          client_name: 'M. Sami Ben Amor',
          client_email: 'client@kia.tn',
          bay: 'Pont #04 (Mécanique)',
          parts_price: 210,
          labor_price: 45,
          tax_price: 25,
          total_amount: 280.0,
          title: 'Remplacement du Jeu de Plaquettes de Frein Avant OEM',
          description:
            'Épaisseur résiduelle mesurée à 2.1 mm (seuil constructeur mini : 3.0 mm). Recommandé pour préserver les disques.',
          measured_thickness: '2.1 mm',
          min_thickness: '3.0 mm',
          photo_url:
            'https://lh3.googleusercontent.com/aida-public/AB6AXuC1iKzto1AwXzRBtysKFyPiG6WHB94lLLvCAxrJn3rpn7s6QeS2ssvQvs6PHK7anvRh7hj9lq14Z-60Gvt688JfNngSfG3LvxzbdMzlq4Xnrh4crqjeqzN4Ab_3Op5YQupWpXLY3UOVqxsL21__8u1pbrpXlz3kVnY16_lemy91Ctcbl4O_GisDw_1aApY0JQiW4fJEyHSgOexRPgaLdLRU-3vTax6gtMRsVCZMr7pWIvi9gRBbZmgHHw',
          status: 'PENDING',
        },
      ];

      for (const qItem of initialQuotes) {
        await setDoc(doc(db, 'quotes', qItem.id), qItem);
      }
      collectionsSeeded.push('quotes');

      this.hasRun = true;
      console.info('✅ Migration Firestore terminée avec succès (7 tables NoSQL synchronisées)');
      return {
        seeded: true,
        message: 'Base Firestore migrée avec succès avec les 7 collections NoSQL.',
        collectionsSeeded,
      };
    } catch (error) {
      console.warn('Initialisation Firestore:', error);
      return {
        seeded: false,
        message: 'Mode hors-ligne / Cache local actif.',
        collectionsSeeded: [],
      };
    }
  }
}

export const firebaseSeedService = new FirebaseSeedService();
