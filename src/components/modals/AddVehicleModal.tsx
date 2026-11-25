import { useState } from 'react';
import { Vehicle } from '../../types';
import { KIA_MODELS_CATALOG, KiaCatalogModel } from '../../data/kiaCatalog';

interface AddVehicleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddVehicle: (newVehicle: Vehicle) => void;
}

export function AddVehicleModal({ isOpen, onClose, onAddVehicle }: AddVehicleModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>('Tous');
  const [selectedModel, setSelectedModel] = useState<KiaCatalogModel>(KIA_MODELS_CATALOG[0]);
  const [finish, setFinish] = useState(KIA_MODELS_CATALOG[0].defaultFinish);
  const [plate, setPlate] = useState('238 TU 1044');
  const [vin, setVin] = useState('KNA-SP8920147');
  const [year, setYear] = useState(String(KIA_MODELS_CATALOG[0].defaultYear));
  const [mileage, setMileage] = useState(String(KIA_MODELS_CATALOG[0].defaultMileage));
  const [selectedColor, setSelectedColor] = useState(KIA_MODELS_CATALOG[0].colors[0] || 'Gris Météore Métallisé');

  if (!isOpen) return null;

  const handleSelectModel = (model: KiaCatalogModel) => {
    setSelectedModel(model);
    setFinish(model.defaultFinish);
    setYear(String(model.defaultYear));
    setMileage(String(model.defaultMileage));
    setSelectedColor(model.colors[0] || 'Gris Météore');
    // Génération d'un VIN réaliste pour le modèle choisi
    const prefix = model.id.slice(0, 3).toUpperCase();
    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    setVin(`KNA-${prefix}${randomDigits}`);
  };

  const categories = ['Tous', 'SUV & Crossover', 'Citadine & Compacte', 'Électrique & Hybride', 'Berline', 'Utilitaire'];

  const filteredModels = selectedCategory === 'Tous'
    ? KIA_MODELS_CATALOG
    : KIA_MODELS_CATALOG.filter((m) => m.category === selectedCategory);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newCar: Vehicle = {
      id: `car-${Date.now()}`,
      name: `${selectedModel.name} ${selectedModel.shortName === 'EV6' || selectedModel.shortName === 'EV9' ? 'GT-Line' : ''}`.trim(),
      finish,
      plate: plate.toUpperCase().trim(),
      vin: vin.toUpperCase().trim(),
      year: parseInt(year, 10) || selectedModel.defaultYear,
      type: selectedModel.type,
      color: selectedColor,
      mileage: parseInt(mileage, 10) || selectedModel.defaultMileage,
      nextServiceKm: 10000,
      warranty: selectedModel.warranty,
      warrantyActive: true,
      status: 'up_to_date',
      imageUrl: selectedModel.imageUrl,
    };
    onAddVehicle(newCar);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-3 sm:p-5 overflow-y-auto">
      <div className="bg-surface-container-lowest text-on-surface rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] overflow-hidden border border-surface-container-high flex flex-col my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-4 sm:p-5 flex items-center justify-between border-b border-surface-container-high bg-surface-container-low shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary text-on-secondary flex items-center justify-center font-bold shadow-sm">
              <span className="material-symbols-outlined text-xl">directions_car</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-headline-sm text-base sm:text-lg font-bold text-on-surface">
                  Ajouter un Véhicule Kia
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-secondary-fixed text-on-secondary-fixed font-label-sm text-[10px] font-bold uppercase">
                  Catalogue Officiel City Cars
                </span>
              </div>
              <p className="font-body-sm text-xs text-on-surface-variant">
                Sélectionnez votre modèle parmi toute la gamme Kia Tunisie avec visuel officiel
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-2 rounded-xl hover:bg-surface-container text-on-surface-variant hover:text-on-surface transition-colors"
          >
            <span className="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        {/* Modal Body with Two Columns */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Model Selector & Filter (7 cols) */}
          <div className="lg:col-span-7 flex flex-col gap-4">
            {/* Category Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                    selectedCategory === cat
                      ? 'bg-secondary text-white shadow-sm'
                      : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container hover:text-on-surface border border-surface-container-high'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Grid of Kia Models */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-[360px] overflow-y-auto p-1 pr-1.5 border border-surface-container-high rounded-xl bg-surface-container-low">
              {filteredModels.map((item) => {
                const isSelected = selectedModel.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectModel(item)}
                    className={`p-2.5 rounded-xl border text-left flex flex-col gap-2 transition-all group relative overflow-hidden ${
                      isSelected
                        ? 'bg-surface-container-lowest border-secondary shadow-md ring-2 ring-secondary/40'
                        : 'bg-surface-container-lowest border-surface-container-high hover:border-secondary/50 hover:bg-surface-container'
                    }`}
                  >
                    <div className="relative w-full h-20 rounded-lg overflow-hidden bg-slate-900">
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm text-[9px] text-white font-mono uppercase">
                        {item.type.split(' ')[0]}
                      </span>
                    </div>

                    <div className="flex flex-col min-w-0">
                      <span className="font-headline-sm text-xs font-bold text-on-surface truncate">
                        {item.name}
                      </span>
                      <span className="font-label-sm text-[10px] text-on-surface-variant truncate">
                        {item.engine}
                      </span>
                    </div>

                    {isSelected && (
                      <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-secondary text-white flex items-center justify-center shadow-sm">
                        <span className="material-symbols-outlined text-xs font-bold">check</span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Selected Model Showcase Card */}
            <div className="p-4 rounded-xl bg-surface-container-low border border-surface-container-high flex items-center gap-4">
              <div className="w-24 h-16 rounded-lg overflow-hidden bg-slate-900 shrink-0 border border-surface-container-high">
                <img
                  src={selectedModel.imageUrl}
                  alt={selectedModel.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-headline-sm text-sm font-bold text-on-surface">
                    {selectedModel.name}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-primary text-white text-[10px] font-bold">
                    {selectedModel.type}
                  </span>
                </div>
                <span className="font-body-sm text-xs text-on-surface-variant mt-0.5">
                  Motorisation : {selectedModel.engine} • {selectedModel.warranty}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Vehicle Details Form (5 cols) */}
          <form onSubmit={handleSubmit} className="lg:col-span-5 flex flex-col justify-between gap-4">
            <div className="flex flex-col gap-3.5">
              <span className="font-label-sm text-xs text-secondary font-bold uppercase tracking-wider">
                Caractéristiques d'Identification
              </span>

              {/* Finition Dropdown */}
              <div>
                <label className="font-label-sm text-[11px] uppercase font-bold text-on-surface-variant block mb-1">
                  Finition & Motorisation
                </label>
                <select
                  value={finish}
                  onChange={(e) => setFinish(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-surface-container-low border border-surface-container-high font-medium text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary"
                >
                  {selectedModel.finishes.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </div>

              {/* Immatriculation & Année */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-label-sm text-[11px] uppercase font-bold text-on-surface-variant block mb-1">
                    Immatriculation (TU)
                  </label>
                  <input
                    type="text"
                    required
                    value={plate}
                    onChange={(e) => setPlate(e.target.value)}
                    placeholder="238 TU 1044"
                    className="w-full p-2.5 rounded-xl bg-surface-container-low border border-surface-container-high font-mono font-bold text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary tracking-wider"
                  />
                </div>

                <div>
                  <label className="font-label-sm text-[11px] uppercase font-bold text-on-surface-variant block mb-1">
                    Année
                  </label>
                  <input
                    type="number"
                    min="2012"
                    max="2026"
                    required
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-surface-container-low border border-surface-container-high font-medium text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary"
                  />
                </div>
              </div>

              {/* Numéro de Châssis (VIN) */}
              <div>
                <label className="font-label-sm text-[11px] uppercase font-bold text-on-surface-variant block mb-1">
                  Numéro de Châssis (VIN - 17 caractères)
                </label>
                <input
                  type="text"
                  required
                  maxLength={17}
                  value={vin}
                  onChange={(e) => setVin(e.target.value.toUpperCase())}
                  placeholder="KNA-SP8920147"
                  className="w-full p-2.5 rounded-xl bg-surface-container-low border border-surface-container-high font-mono uppercase font-bold text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary tracking-wider"
                />
              </div>

              {/* Kilométrage & Couleur */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-label-sm text-[11px] uppercase font-bold text-on-surface-variant block mb-1">
                    Kilométrage Actuel
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min="0"
                      value={mileage}
                      onChange={(e) => setMileage(e.target.value)}
                      className="w-full p-2.5 pr-8 rounded-xl bg-surface-container-low border border-surface-container-high font-mono font-bold text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary"
                    />
                    <span className="absolute right-2.5 top-2.5 font-label-sm text-[10px] text-on-surface-variant font-mono">
                      km
                    </span>
                  </div>
                </div>

                <div>
                  <label className="font-label-sm text-[11px] uppercase font-bold text-on-surface-variant block mb-1">
                    Couleur Carrosserie
                  </label>
                  <select
                    value={selectedColor}
                    onChange={(e) => setSelectedColor(e.target.value)}
                    className="w-full p-2.5 rounded-xl bg-surface-container-low border border-surface-container-high font-medium text-xs text-on-surface focus:outline-none focus:ring-1 focus:ring-secondary"
                  >
                    {selectedModel.colors.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Official Seal Badge */}
              <div className="p-2.5 rounded-xl bg-primary text-white flex items-center gap-2.5 text-xs">
                <span className="material-symbols-outlined text-secondary text-xl">workspace_premium</span>
                <span className="font-body-sm text-[11px] leading-tight">
                  Véhicule éligible au carnet d'entretien numérique certifié City Cars Kia Tunisie.
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-surface-container-high">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl bg-surface-container hover:bg-surface-container-high text-on-surface font-semibold text-xs transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-secondary hover:bg-secondary-container text-on-secondary font-headline-sm text-xs font-bold shadow-md transition-all flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-base">add_circle</span>
                <span>Ajouter au Garage Virtuel</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
