import React from 'react';
import { Clock, ShieldCheck, Leaf } from 'lucide-react';
import { GoldFlourish } from '../common/GoldFlourish';

export const EmptyMenuState: React.FC = () => {
  return (
    <div className="px-4 sm:px-8 py-12 sm:py-16 max-w-3xl mx-auto text-center">
      <GoldFlourish className="w-40 mb-6 mx-auto" />

      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-parchment text-gold-deep text-[11px] font-semibold uppercase tracking-[0.18em] border border-gold/25">
        <Clock className="w-3.5 h-3.5" />
         opening soon
      </span>

      <h2 className="mt-5 text-3xl sm:text-5xl leading-tight font-serif font-semibold text-ink tracking-tight break-words">
        The day’s selection is being plated
      </h2>
      <p className="mt-4 text-sm sm:text-base text-muted leading-relaxed max-w-xl mx-auto">
        Our live catalogue will appear here the moment the shop owner publishes sweets and snacks.
        Until then, our counter is happy to guide you.
      </p>

      <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto">
        <div className="p-5 rounded-2xl bg-ivory border border-line text-left">
          <ShieldCheck className="w-5 h-5 text-gold mb-2" />
          <p className="font-serif text-lg text-ink">Small-batch fresh</p>
          <p className="text-xs text-muted mt-1">Prepared throughout the day in pure ghee.</p>
        </div>
        <div className="p-5 rounded-2xl bg-ivory border border-line text-left">
          <Leaf className="w-5 h-5 text-gold mb-2" />
          <p className="font-serif text-lg text-ink">Pure vegetarian</p>
          <p className="text-xs text-muted mt-1">Finest ingredients, traditional recipes.</p>
        </div>
      </div>

    </div>
  );
};
