import React from 'react';
import { Home, LayoutGrid, Sparkles } from 'lucide-react';
import { useNavigation } from '../../context/NavigationContext';
import { useMenu } from '../../context/MenuContext';

interface CustomerLayoutProps {
  children: React.ReactNode;
  activeCategoryName?: string;
}

export const CustomerLayout: React.FC<CustomerLayoutProps> = ({ children }) => {
  const { navigate, path } = useNavigation();
  const { customerMenuIdle, resumeCustomerMenu } = useMenu();

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
                </div>
                <p className="text-[11px] text-gold-light/70 font-light tracking-[0.16em] uppercase mt-1">
                  Sweets & Snacks
                </p>
              </div>
            </div>

          </div>
        </header>

        <main className="flex-1 pb-24">{children}</main>

        <footer className="mt-4 border-t border-gold/20 bg-ink text-ivory">
          <div className="max-w-6xl mx-auto px-4 sm:px-8 py-6" />
        </footer>
      </div>

      <nav aria-label="Customer navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-white/95 shadow-[0_-8px_24px_rgba(20,12,8,0.08)] backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-around px-6 py-3">
          <button
            type="button"
            onClick={() => navigate('/home')}
            aria-current={path === '/home' ? 'page' : undefined}
            className={`flex min-w-24 flex-col items-center gap-1 text-xs font-medium transition-colors ${path === '/home' ? 'text-gold-deep' : 'text-muted hover:text-ink'}`}
          >
            <Home className="h-6 w-6" aria-hidden="true" />
            <span>Home</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/menu')}
            aria-current={path.startsWith('/menu') ? 'page' : undefined}
            className={`flex min-w-24 flex-col items-center gap-1 text-xs font-medium transition-colors ${path.startsWith('/menu') ? 'text-gold-deep' : 'text-muted hover:text-ink'}`}
          >
            <LayoutGrid className="h-6 w-6" aria-hidden="true" />
            <span>Menu</span>
          </button>
        </div>
      </nav>

      {customerMenuIdle && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/80 px-5 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="menu-paused-title">
          <div className="w-full max-w-md rounded-3xl border border-gold/30 bg-ivory p-8 text-center shadow-2xl">
            <h2 id="menu-paused-title" className="font-serif text-3xl text-ink">Menu paused</h2>
            <p className="mt-3 text-sm leading-6 text-muted">This menu paused after 20 minutes without activity. Tap below to continue browsing.</p>
            <button type="button" onClick={resumeCustomerMenu} className="btn-gold mt-6">Continue to menu</button>
          </div>
        </div>
      )}

    </div>
  );
};
