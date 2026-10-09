import React from 'react';
import { Sparkles } from 'lucide-react';
import { useNavigation } from '../../context/NavigationContext';

interface CustomerLayoutProps {
  children: React.ReactNode;
  activeCategoryName?: string;
}

export const CustomerLayout: React.FC<CustomerLayoutProps> = ({ children }) => {
  const { navigate } = useNavigation();

  return (
    <div className="min-h-screen overflow-x-hidden bg-cream flex flex-col text-ink luxury-grain">
      <div className="relative z-[1] flex flex-col flex-1">
        <div className="bg-ink text-gold-light text-[11px] font-medium py-2 px-4 text-center tracking-[0.18em] uppercase">
          <span className="inline-flex flex-wrap items-center justify-center gap-2 px-4 leading-relaxed tracking-[0.12em] sm:tracking-[0.18em]">
            <Sparkles className="w-3.5 h-3.5 text-gold" />
            Fresh batches throughout the day · Pure ghee · Heritage recipes
          </span>
        </div>

        <header className="sticky top-0 z-30 border-b border-gold/20 bg-ink/92 backdrop-blur-xl">
          <div className="max-w-6xl mx-auto px-4 sm:px-8 py-4 flex items-center justify-between gap-4">
            <div
              onClick={() => navigate('/menu')}
              className="flex items-center gap-3 cursor-pointer group"
            >
              <img
                src="/waddodagi-logo.png"
                alt="Waddodagi Sweets and Snacks logo"
                className="w-11 h-11 shrink-0 rounded-full object-contain shadow-[0_0_24px_rgba(196,163,90,0.25)] group-hover:scale-105 transition-transform"
              />
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-serif font-semibold tracking-tight text-ivory leading-none">
                    Waddodagi<span className="text-gold italic"></span> 
                  </h1>
                  <span className="hidden sm:inline-block px-2 py-0.5 rounded-full text-[9px] font-semibold tracking-[0.14em] bg-gold/15 text-gold-light border border-gold/30">
                    PURE VEG
                  </span>
                </div>
                <p className="text-[11px] text-gold-light/70 font-light tracking-[0.16em] uppercase mt-1">
                  Sweets & Snacks
                </p>
              </div>
            </div>

          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="mt-4 border-t border-gold/20 bg-ink text-ivory">
          <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6" />
        </footer>
      </div>

    </div>
  );
};
