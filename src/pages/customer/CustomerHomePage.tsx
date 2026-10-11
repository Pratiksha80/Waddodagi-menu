import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { CustomerLayout } from '../../components/customer/CustomerLayout';
import { useNavigation } from '../../context/NavigationContext';

export const CustomerHomePage: React.FC = () => {
  const { navigate } = useNavigation();

  return (
    <CustomerLayout>
      <section
        className="relative isolate flex min-h-[70vh] items-center justify-center overflow-hidden px-5 py-14"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(194,139,46,0.18) 1px, transparent 1.5px), radial-gradient(circle at 50% 50%, rgba(255,250,242,0.95), rgba(245,236,220,0.72))',
          backgroundSize: '24px 24px, 100% 100%',
        }}
      >
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
          <div className="absolute -left-20 -top-24 h-72 w-72 rounded-full border border-gold/20" />
          <div className="absolute -left-12 -top-16 h-56 w-56 rounded-full border border-gold/15" />
          <div className="absolute -bottom-28 -right-16 h-80 w-80 rounded-full border border-gold/20" />
          <div className="absolute -bottom-20 -right-8 h-64 w-64 rounded-full border border-gold/15" />
        </div>

        <div className="w-full max-w-lg rounded-[2rem] border border-line bg-ivory/95 px-8 py-10 text-center shadow-[0_24px_70px_rgba(35,23,13,0.14)] sm:px-14 sm:py-14">
          <img
            src="/waddodagi-logo.png"
            alt="Waddodagi Sweets and Snacks"
            className="mx-auto h-28 w-28 rounded-full object-contain shadow-[0_8px_28px_rgba(196,163,90,0.25)] sm:h-32 sm:w-32"
          />
          <p className="mt-6 inline-flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.24em] text-gold-deep">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Fresh batches throughout the day
          </p>
          <h2 className="mt-2 font-serif text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Waddodagi</h2>
          <p className="mt-2 text-xs uppercase tracking-[0.2em] text-muted">Sweets &amp; Snacks</p>
          <button
            type="button"
            onClick={() => navigate('/menu')}
            className="mt-9 inline-flex items-center justify-center gap-3 rounded-xl bg-gold px-7 py-3.5 text-sm font-semibold text-ink shadow-lg transition hover:-translate-y-0.5 hover:bg-gold-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-deep focus-visible:ring-offset-2"
          >
            View Menu
            <ArrowRight className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
      </section>
    </CustomerLayout>
  );
};
