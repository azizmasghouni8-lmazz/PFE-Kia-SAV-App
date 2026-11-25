export type AppRole = 'client' | 'chef' | 'tech' | 'auth';

export interface Compte {
  id: string;
  email: string;
  motDePasse: string;
  role: 'client' | 'chef' | 'tech';
  nom: string;
  prenom: string;
  telephone: string;
  immatriculation?: string;
  modeleVehicule?: string;
  vin?: string;
  dateCreation: string;
  avatarUrl?: string;
}

export type ClientTab = 'home' | 'book' | 'tracking' | 'assistance';
export type ChefTab = 'planning' | 'checkin' | 'orders' | 'tracking' | 'restitution' | 'team';
export type TechTab = 'tasks' | 'active' | 'parts';

export interface Vehicle {
  id: string;
  name: string;
  finish: string;
  plate: string;
  vin: string;
  year: number;
  type: string;
  color: string;
  mileage: number;
  nextServiceKm: number;
  warranty: string;
  warrantyActive: boolean;
  status: 'in_workshop' | 'waiting_parts' | 'up_to_date' | 'scheduled';
  activeOrId?: string;
  workshopLocation?: string;
  technicianName?: string;
  progressPercent?: number;
  waitingPartsReason?: string;
  imageUrl: string;
}

export interface DefectItem {
  id: number;
  x: number;
  y: number;
  title: string;
  type: 'Rayure' | 'Bosse / Impact' | 'Fissure' | 'Pièce Manquante' | 'Frottement' | 'Micro-Impact';
  description: string;
  photoUrl?: string;
  isMandatoryPhoto: boolean;
}

export interface RepairOrder {
  id: string;
  createdTime: string;
  vehicleName: string;
  plate: string;
  service: string;
  serviceCategory: string;
  technician: string;
  technicianRole: string;
  bay: string;
  status: 'in_progress' | 'quality_check' | 'waiting_parts' | 'ready' | 'pending';
  statusLabel: string;
  progressPercent: number;
  timeElapsed: string;
  timeEstimated: string;
  estimatedHours: number;
  imageUrl: string;
  blockedMinutes?: number;
  clientName?: string;
  clientId?: string;
  clientEmail?: string;
  clientPhone?: string;
  vin?: string;
  waitingPartsReason?: string;
}

export interface QuotePartEntry {
  partId?: string;
  oemRef: string;
  name: string;
  unitPrice: number;
  quantity: number;
  shelfLocation?: string;
  inStock: boolean;
  status: 'reserved' | 'to_order' | 'ordered' | 'delivered_to_stock' | 'delivered_to_bay';
}

export interface AdditionalQuote {
  id: string;
  orId?: string;
  clientId?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  bay?: string;
  vin?: string;
  title: string;
  vehicle: string;
  plate: string;
  issuedTime: string;
  issuedBy: string;
  criticalWearPercent: number;
  measuredThickness: string;
  minThickness: string;
  description: string;
  photoUrl: string;
  partsPrice: number;
  laborPrice: number;
  taxPrice: number;
  totalPrice: number;
  status: 'pending' | 'accepted' | 'refused';
  acceptedAt?: string;
  respondedAt?: string;
  clientComment?: string;
  partAvailability?: 'in_stock' | 'out_of_stock';
  requiresPartOrder?: boolean;
  estimatedDeliveryDelay?: string;
  parts?: QuotePartEntry[];
  techStockConfirmed?: boolean;
  techStockConfirmedAt?: string;
  chefDeliveryConfirmed?: boolean;
  chefDeliveryConfirmedAt?: string;
  createdAt?: string;
}

export interface ServiceOperationDetail {
  id: string;
  label: string;
  category: string;
  completedAt: string;
  status: 'completed' | 'verified';
  notes?: string;
}

export interface ServicePartDetail {
  oemRef: string;
  name: string;
  quantity: number;
  unitPriceTND: number;
}

export interface ServiceHistoryItem {
  id: string;
  date: string;
  year: string;
  title: string;
  mileage: string;
  description: string;
  workshop: string;
  advisor: string;
  status: 'completed' | 'in_progress';
  orNumber: string;
  invoiceNumber?: string;
  amount?: string;
  category?: 'entretien' | 'mecanique' | 'electrique' | 'livraison';
  vehicleName?: string;
  plate?: string;
  vin?: string;
  clientId?: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  technicianName?: string;
  bay?: string;
  durationLabel?: string;
  paymentMethod?: string;
  paidAt?: string;
  operations?: ServiceOperationDetail[];
  parts?: ServicePartDetail[];
  qualityChecks?: string[];
  movedFromLive?: boolean;
}

export type PartCategory =
  | 'all'
  | 'freinage'
  | 'filtration'
  | 'electrique_ev'
  | 'moteur'
  | 'suspension'
  | 'climatisation';

export interface PartItem {
  id: string;
  name: string;
  oemRef: string;
  category: PartCategory;
  categoryLabel: string;
  compatibleModels: string[];
  stockCount: number;
  minThreshold: number;
  shelfLocation: string;
  unitPriceTND: number;
  laborTimeHours: number;
  imageUrl: string;
  description: string;
  inStock: boolean;
  warrantyMonths: number;
}

