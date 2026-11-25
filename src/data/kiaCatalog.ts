export interface KiaCatalogModel {
  id: string;
  name: string;
  shortName: string;
  category: 'SUV & Crossover' | 'Citadine & Compacte' | 'Électrique & Hybride' | 'Berline' | 'Utilitaire';
  type: string;
  defaultFinish: string;
  finishes: string[];
  imageUrl: string;
  defaultYear: number;
  defaultMileage: number;
  engine: string;
  warranty: string;
  colors: string[];
}

export const KIA_MODELS_CATALOG: KiaCatalogModel[] = [
  {
    id: 'sportage',
    name: 'Kia Sportage',
    shortName: 'Sportage',
    category: 'SUV & Crossover',
    type: 'SUV',
    defaultFinish: '1.6 T-GDi GT-Line Pack Premium BVA',
    finishes: [
      '1.6 T-GDi GT-Line Pack Premium BVA',
      '1.6 CRDi 136ch EX BVA',
      '1.6 T-GDi Hybride 230ch AWD',
      '1.6 T-GDi 150ch BVM',
    ],
    imageUrl: '/images/kia/sportage.jpg',
    defaultYear: 2024,
    defaultMileage: 18400,
    engine: 'Essence Turbo 1.6 T-GDi',
    warranty: '5 Ans ou 150 000 km',
    colors: ['Gris Météore Métallisé', 'Blanc Nacré', 'Noir Ébène', 'Vert Jungle', 'Rouge Infra'],
  },
  {
    id: 'sorento',
    name: 'Kia Sorento',
    shortName: 'Sorento',
    category: 'SUV & Crossover',
    type: 'Grand SUV 7 Places',
    defaultFinish: '1.6 T-GDi HEV Hybride 230ch 4WD SX',
    finishes: [
      '1.6 T-GDi HEV Hybride 230ch 4WD SX',
      '2.2 CRDi 202ch DCT8 4WD Premium',
      '1.6 T-GDi PHEV Hybride Rechargeable 265ch',
    ],
    imageUrl: '/images/kia/sorento.png',
    defaultYear: 2023,
    defaultMileage: 32000,
    engine: 'Full Hybrid 1.6 T-GDi HEV',
    warranty: '5 Ans ou 150 000 km',
    colors: ['Blanc Neige Nacré', 'Gris Platine', 'Noir Aurore', 'Bleu Minéral'],
  },
  {
    id: 'ev6',
    name: 'Kia EV6',
    shortName: 'EV6',
    category: 'Électrique & Hybride',
    type: 'Crossover 100% Électrique',
    defaultFinish: 'AWD Long Range 77.4 kWh (325 ch) GT-Line',
    finishes: [
      'AWD Long Range 77.4 kWh (325 ch) GT-Line',
      'RWD Long Range 77.4 kWh (229 ch) Air Design',
      'GT 585 ch AWD Performance',
    ],
    imageUrl: '/images/kia/ev6.jpg',
    defaultYear: 2024,
    defaultMileage: 11500,
    engine: '100% Électrique 800V E-GMP',
    warranty: '7 Ans / 150 000 km (Batterie 8 Ans)',
    colors: ['Gris Mat Moonscape', 'Blanc Glaçon', 'Bleu Yacht', 'Rouge Piment'],
  },
  {
    id: 'ev9',
    name: 'Kia EV9',
    shortName: 'EV9',
    category: 'Électrique & Hybride',
    type: 'Grand SUV Électrique 7 Places',
    defaultFinish: 'AWD 99.8 kWh 384 ch GT-Line 6/7 Places',
    finishes: [
      'AWD 99.8 kWh 384 ch GT-Line 6/7 Places',
      'RWD Long Range 99.8 kWh 204 ch Earth',
    ],
    imageUrl: '/images/kia/ev9.jpg',
    defaultYear: 2025,
    defaultMileage: 4800,
    engine: 'Double Moteur Électrique 384 ch',
    warranty: '7 Ans / 150 000 km',
    colors: ['Bleu Océan Mat', 'Gris Ivoire', 'Noir Aurore'],
  },
  {
    id: 'seltos',
    name: 'Kia Seltos',
    shortName: 'Seltos',
    category: 'SUV & Crossover',
    type: 'SUV Compact',
    defaultFinish: '1.6 MPI 123ch EX BVA',
    finishes: [
      '1.6 MPI 123ch EX BVA',
      '1.6 MPI 123ch SX High-Spec BVA',
      '1.5 CRDi 115ch Diesel BVA',
    ],
    imageUrl: '/images/kia/seltos.jpg',
    defaultYear: 2023,
    defaultMileage: 24500,
    engine: 'Essence 1.6L 4-Cylindres',
    warranty: '5 Ans ou 100 000 km',
    colors: ['Gris Gravité', 'Blanc Perle', 'Bleu Intense', 'Bicolore Noir/Orange'],
  },
  {
    id: 'sonet',
    name: 'Kia Sonet',
    shortName: 'Sonet',
    category: 'SUV & Crossover',
    type: 'Crossover Urbain',
    defaultFinish: '1.5L MPI 115ch EX Pack BVA',
    finishes: [
      '1.5L MPI 115ch EX Pack BVA',
      '1.5L MPI 115ch LX BVM',
      '1.0 T-GDi Turbo 120ch 7DCT',
    ],
    imageUrl: '/images/kia/sonet.png',
    defaultYear: 2024,
    defaultMileage: 14200,
    engine: 'Essence 1.5 Smartstream',
    warranty: '5 Ans ou 100 000 km',
    colors: ['Rouge Intense', 'Gris Acier', 'Blanc Glacier', 'Noir Ébène'],
  },
  {
    id: 'picanto',
    name: 'Kia Picanto',
    shortName: 'Picanto',
    category: 'Citadine & Compacte',
    type: 'Citadine',
    defaultFinish: '1.0L MPI 67ch GT-Line BVA',
    finishes: [
      '1.0L MPI 67ch GT-Line BVA',
      '1.2L MPI 84ch GT-Line BVA',
      '1.0L MPI 67ch Motion BVM',
    ],
    imageUrl: '/images/kia/picanto.jpg',
    defaultYear: 2023,
    defaultMileage: 28000,
    engine: 'Essence 1.0L / 1.2L',
    warranty: '5 Ans ou 100 000 km',
    colors: ['Blanc Nacré', 'Jaune Miel', 'Gris Titane', 'Bleu Pop', 'Rouge Éclat'],
  },
  {
    id: 'rio',
    name: 'Kia Rio',
    shortName: 'Rio',
    category: 'Citadine & Compacte',
    type: 'Berline Citadine 5 Portes',
    defaultFinish: '1.4L MPI 100ch SX Pack BVA',
    finishes: [
      '1.4L MPI 100ch SX Pack BVA',
      '1.2L MPI 84ch EX BVM',
      'Rio Berline 4 Portes 1.4L BVA',
    ],
    imageUrl: '/images/kia/rio.jpg',
    defaultYear: 2022,
    defaultMileage: 46000,
    engine: 'Essence 1.4L 100ch',
    warranty: '5 Ans ou 100 000 km',
    colors: ['Gris Plomb', 'Blanc Pur', 'Noir Ébène', 'Bleu Azur'],
  },
  {
    id: 'ceed',
    name: 'Kia Ceed',
    shortName: 'Ceed',
    category: 'Citadine & Compacte',
    type: 'Berline & Break Compact',
    defaultFinish: '1.5 T-GDi 160ch GT-Line DCT7',
    finishes: [
      '1.5 T-GDi 160ch GT-Line DCT7',
      'Ceed Sportswagon Break 1.6 CRDi 136ch',
      '1.0 T-GDi 120ch Active BVM6',
    ],
    imageUrl: '/images/kia/ceed.jpg',
    defaultYear: 2023,
    defaultMileage: 38000,
    engine: 'Essence Turbo 1.5 T-GDi',
    warranty: '5 Ans ou 150 000 km',
    colors: ['Gris Éclipse', 'Blanc Casa', 'Bleu Fusion', 'Noir Perle'],
  },
  {
    id: 'xceed',
    name: 'Kia XCeed',
    shortName: 'XCeed',
    category: 'SUV & Crossover',
    type: 'Crossover Coupé Urbain',
    defaultFinish: '1.5 T-GDi 160ch GT-Line Premium DCT7',
    finishes: [
      '1.5 T-GDi 160ch GT-Line Premium DCT7',
      '1.6 GDi PHEV Hybride Rechargeable 141ch',
    ],
    imageUrl: '/images/kia/xceed.jpg',
    defaultYear: 2024,
    defaultMileage: 19500,
    engine: 'Essence 1.5 Turbo DCT7',
    warranty: '5 Ans ou 150 000 km',
    colors: ['Jaune Éclatant', 'Gris Céleste', 'Noir Fantôme', 'Orange Cuivre'],
  },
  {
    id: 'k5',
    name: 'Kia K5',
    shortName: 'K5',
    category: 'Berline',
    type: 'Berline Fastback Premium',
    defaultFinish: '2.0L MPI 152ch BVA6 Executive',
    finishes: [
      '2.0L MPI 152ch BVA6 Executive',
      '1.6 T-GDi 180ch GT-Line BVA8',
    ],
    imageUrl: '/images/kia/k5.jpg',
    defaultYear: 2023,
    defaultMileage: 29000,
    engine: 'Essence 2.0L / 1.6 T-GDi',
    warranty: '5 Ans ou 150 000 km',
    colors: ['Gris Interstellaire', 'Blanc Neige', 'Noir Ébène', 'Bleu Pacifique'],
  },
  {
    id: 'carens',
    name: 'Kia Carens',
    shortName: 'Carens',
    category: 'SUV & Crossover',
    type: 'Monospace Crossover 7 Places',
    defaultFinish: '1.5L MPI 115ch Prestige 7 Places BVA',
    finishes: [
      '1.5L MPI 115ch Prestige 7 Places BVA',
      '1.4 T-GDi Turbo 140ch 7DCT Luxe',
    ],
    imageUrl: '/images/kia/carens.jpg',
    defaultYear: 2024,
    defaultMileage: 16800,
    engine: 'Essence 1.5L Smartstream',
    warranty: '5 Ans ou 100 000 km',
    colors: ['Bleu Impérial', 'Gris Mousse', 'Blanc Glacier', 'Noir Aurore'],
  },
  {
    id: 'niro',
    name: 'Kia Niro EV & HEV',
    shortName: 'Niro',
    category: 'Électrique & Hybride',
    type: 'Crossover Électrifié',
    defaultFinish: 'EV 64.8 kWh 204 ch 100% Électrique',
    finishes: [
      'EV 64.8 kWh 204 ch 100% Électrique',
      '1.6 GDi Hybride 141 ch HEV',
      '1.6 GDi Hybride Rechargeable 183 ch PHEV',
    ],
    imageUrl: '/images/kia/niro.jpg',
    defaultYear: 2024,
    defaultMileage: 15200,
    engine: 'Électrique 204 ch / Hybride 141 ch',
    warranty: '7 Ans ou 150 000 km',
    colors: ['Vert Minéral', 'Blanc Céleste', 'Gris Acier', 'Noir Aurore'],
  },
  {
    id: 'k2700',
    name: 'Kia K2700',
    shortName: 'K2700',
    category: 'Utilitaire',
    type: 'Utilitaire / Pick-up Plateau',
    defaultFinish: '2.7L Diesel J2 Plateau Ridelles BVM5',
    finishes: [
      '2.7L Diesel J2 Plateau Ridelles BVM5',
      '2.7L Diesel Double Cabine 6 Places',
      'K2500 2.5L Turbo Diesel CRDi BVM6',
    ],
    imageUrl: '/images/kia/k2700.jpg',
    defaultYear: 2023,
    defaultMileage: 52000,
    engine: 'Diesel Robuste 2.7L / 2.5 CRDi',
    warranty: '3 Ans ou 100 000 km',
    colors: ['Blanc Concessionnaire', 'Bleu Marine'],
  },
];

export function resolveKiaModelImage(modelName?: string): string {
  const name = (modelName || '').toLowerCase();
  if (name.includes('xceed')) return '/images/kia/xceed.jpg';
  if (name.includes('ceed')) return '/images/kia/ceed.jpg';
  if (name.includes('sportage')) return '/images/kia/sportage.jpg';
  if (name.includes('sorento')) return '/images/kia/sorento.png';
  if (name.includes('ev6')) return '/images/kia/ev6.jpg';
  if (name.includes('ev9')) return '/images/kia/ev9.jpg';
  if (name.includes('seltos')) return '/images/kia/seltos.jpg';
  if (name.includes('sonet')) return '/images/kia/sonet.png';
  if (name.includes('picanto')) return '/images/kia/picanto.jpg';
  if (name.includes('rio')) return '/images/kia/rio.jpg';
  if (name.includes('k5') || name.includes('optima')) return '/images/kia/k5.jpg';
  if (name.includes('carens')) return '/images/kia/carens.jpg';
  if (name.includes('niro')) return '/images/kia/niro.jpg';
  if (name.includes('k2700') || name.includes('k2500') || name.includes('bongo')) {
    return '/images/kia/k2700.jpg';
  }
  return '/images/kia/sportage.jpg';
}

export function normalizeKiaVehicleImageUrl(currentUrl?: string, modelName?: string): string {
  if (!currentUrl || currentUrl.includes('images.unsplash.com') || currentUrl.includes('lh3.googleusercontent.com')) {
    return resolveKiaModelImage(modelName);
  }
  if (currentUrl.startsWith('/images/kia/')) {
    return currentUrl;
  }
  return resolveKiaModelImage(modelName);
}
