import React, { useState } from 'react';
import { Store, QrCode, Sparkles, LogIn } from 'lucide-react';
import { useNavigation } from '../../context/NavigationContext';
import { QrCodeModal } from '../admin/QrCodeModal';

interface CustomerLayoutProps {
  children: React.ReactNode;
  activeCategoryName?: string;
}

export const CustomerLayout: React.FC<CustomerLayoutProps> = ({ children }) => {
  const { navigate } = useNavigation();
  const [isQrOpen, setIsQrOpen] = useState(false);

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
              <div className="w-11 h-11 rounded-full border border-gold/50 bg-gradient-to-br from-gold-light to-gold text-ink flex items-center justify-center shadow-[0_0_24px_rgba(196,163,90,0.25)] group-hover:scale-105 transition-transform">
                <Store className="w-5 h-5" />
              </div>
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

            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={() => setIsQrOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-gold/35 text-gold-light hover:bg-gold/10 text-xs font-medium tracking-wide transition"
                title="Share or Scan Menu QR"
              >
                <QrCode className="w-4 h-4" />
                <span className="hidden sm:inline">QR Menu</span>
              </button>

              <button
                onClick={() => navigate('/admin/login')}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-gold text-ink hover:bg-gold-light text-xs font-semibold tracking-wide transition"
                title="Shop Owner Login"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Owner</span>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="mt-4 border-t border-gold/20 bg-ink text-ivory">
          <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6" />
        </footer>
      </div>

      <QrCodeModal
        isOpen={isQrOpen}
        onClose={() => setIsQrOpen(false)}
      />
    </div>
  );
};
