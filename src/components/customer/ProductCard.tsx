import React from 'react';
import { ArrowUpRight, Image as ImageIcon } from 'lucide-react';
import { Product } from '../../types/database';
import { useNavigation } from '../../context/NavigationContext';

interface ProductCardProps {
  product: Product;
  categoryName?: string;
  layout?: 'vertical' | 'horizontal';
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, categoryName, layout = 'vertical' }) => {
  const { navigate } = useNavigation();
  const isOutOfStock = product.status === 'out_of_stock';
  const isHorizontal = layout === 'horizontal';

  return (
    <div
      onClick={() => navigate(`/menu/product/${product.id}`)}
      className={`group cursor-pointer transition-colors duration-200 ${isHorizontal ? 'flex flex-row-reverse items-center justify-between gap-4 min-h-[176px] py-5 border-b border-line bg-transparent hover:bg-ivory/60' : 'flex flex-col bg-ivory rounded-[1.4rem] overflow-hidden border border-line shadow-[0_18px_40px_rgba(20,12,8,0.06)] hover:shadow-[0_28px_60px_rgba(20,12,8,0.12)] hover:-translate-y-1 duration-300'} ${
        isOutOfStock ? 'opacity-80' : ''
      }`}
    >
      <div className={`relative bg-parchment overflow-hidden ${isHorizontal ? 'w-32 h-28 sm:w-44 sm:h-[136px] shrink-0 rounded-xl' : 'aspect-[4/3] w-full'}`}>
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className={`absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 ${
              isOutOfStock ? 'grayscale' : ''
            }`}
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-gold-deep/50 p-3">
            <ImageIcon className={`${isHorizontal ? 'w-7 h-7' : 'w-10 h-10 mb-2'}`} />
            <span className="text-[10px] uppercase tracking-[0.16em] font-medium">
              {isHorizontal ? 'Image soon' : 'Studio photograph soon'}
            </span>
          </div>
        )}

        {!isHorizontal && <div className="absolute inset-0 bg-gradient-to-t from-ink/55 via-transparent to-transparent opacity-80" />}

        {!isHorizontal && categoryName && (
          <div className="absolute top-3 left-3">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-medium tracking-[0.14em] uppercase bg-ivory/90 text-ink backdrop-blur-sm border border-white/40">
              {categoryName}
            </span>
          </div>
        )}

        {isOutOfStock && (
          <div className="absolute top-2 right-2">
            <span className="px-2 py-1 rounded-full text-[9px] font-semibold tracking-wide uppercase bg-rose-700 text-white">
              Sold out
            </span>
          </div>
        )}

        {!isHorizontal && (
          <div className="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-gold text-ink flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all">
            <ArrowUpRight className="w-4 h-4" />
          </div>
        )}
      </div>

      <div className={`flex-1 flex flex-col min-w-0 ${isHorizontal ? 'py-1 pr-2' : 'p-4 sm:p-5'}`}>
        <h3 className={`${isHorizontal ? 'font-sans font-medium text-2xl sm:text-[28px]' : 'font-serif text-2xl'} leading-tight text-ink group-hover:text-gold-deep transition-colors`}>
          {product.name}
        </h3>

        {isHorizontal && (
          <p className="font-price text-xl text-ink leading-none mt-1.5">
            ₹{product.price.toFixed(0)}
          </p>
        )}

        <p className={`text-xs text-muted mt-2 line-clamp-2 leading-relaxed ${isHorizontal ? '' : 'flex-1'}`}>
          {product.description || 'Prepared fresh with premium ingredients.'}
        </p>

        {!isHorizontal && (
          <div className="mt-4 pt-4 border-t border-line flex items-end justify-between">
            <div>
              <span className="text-[10px] uppercase tracking-[0.18em] text-gold-deep font-medium">From</span>
              <p className="font-price text-2xl text-ink leading-none mt-0.5">
                ₹{product.price.toFixed(0)}
              </p>
            </div>
            <span className="text-[11px] font-medium tracking-wide text-muted group-hover:text-ink">
              View details
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
