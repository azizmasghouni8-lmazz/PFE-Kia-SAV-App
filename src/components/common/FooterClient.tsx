export function FooterClient() {
  return (
    <footer className="w-full bg-[#0e1d28] text-[#778694] mt-auto border-t border-white/5 select-none">
      <div className="w-full px-4 sm:px-6 lg:px-8 py-8 flex flex-col md:flex-row items-center justify-between gap-6 max-w-7xl mx-auto">
        <div className="flex flex-col gap-1 text-center md:text-left">
          <div className="flex items-center justify-center md:justify-start gap-2">
            <span className="font-headline-sm text-base text-white font-bold tracking-tight">Kia City Cars</span>
            <span className="font-label-sm text-xs text-[#778694]">Concessionnaire Officiel en Tunisie</span>
          </div>
          <p className="font-body-sm text-xs text-[#778694]">
            Direction Après-Vente & Réparations Agréées - Zone Industrielle Le Kram, Tunis
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-6 text-[#778694] font-body-sm text-xs">
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-secondary text-base">support_agent</span>
            Assistance 24/7 : <strong className="text-white font-mono">36 406 000</strong>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-secondary text-base">verified</span>
            Garantie Constructeur 5 Ans
          </span>
        </div>

        <div className="font-label-sm text-[11px] text-[#778694] text-center md:text-right">
          © 2024 City Cars Kia Tunisie. Tous droits réservés.
        </div>
      </div>
    </footer>
  );
}
