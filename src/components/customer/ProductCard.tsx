import React from 'react';
import { ArrowUpRight, Image as ImageIcon } from 'lucide-react';
import { Product } from '../../types/database';
import { useNavigation } from '../../context/NavigationContext';

interface ProductCardProps {
  product: Product;
  categoryName?: string;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, categoryName }) => {
  const { navigate } = useNavigation();
  const isOutOfStock = product.status === 'out_of_stock';

  return (
    <div
      onClick={() => navigate(`/menu/product/${product.id}`)}
      className={`group cursor-pointer flex flex-col bg-ivory rounded-[1.4rem] overflow-hidden border border-line shadow-[0_18px_40px_rgba(20,12,8,0.06)] hover:shadow-[0_28px_60px_rgba(20,12,8,0.12)] hover:-translate-y-1 transition-all duration-300 ${
        isOutOfStock ? 'opacity-80' : ''
      }`}
    >
      <div className="relative aspect-[4/3] w-full bg-parchment overflow-hidden">
        {product.image_url ? (
          <img
            src={product.image_url}
            alt={product.name}
            className={`w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 ${
              isOutOfStock ? 'grayscale' : ''
            }`}
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-gold-deep/50 p-4">
            <ImageIcon className="w-10 h-10 mb-2" />
            <span className="text-[10px] uppercase tracking-[0.2em] font-medium">Studio photograph soon</span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-ink/55 via-transparent to-transparent opacity-80" />

        {categoryName && (
          <div className="absolute top-3 left-3">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-medium tracking-[0.14em] uppercase bg-ivory/90 text-ink backdrop-blur-sm border border-white/40">
              {categoryName}
            </span>
          </div>
        )}

        {isOutOfStock && (
          <div className="absolute top-3 right-3">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold tracking-[0.12em] uppercase bg-rose-700 text-white">
              Sold out
            </span>
          </div>
        )}

        <div className="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-gold text-ink flex items-center justify-center opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all">
          <ArrowUpRight className="w-4 h-4" />
        </div>
      </div>

      <div className="p-5 flex-1 flex flex-col">
        <h3 className="font-serif text-2xl leading-tight text-ink group-hover:text-gold-deep transition-colors">
          {product.name}
        </h3>
        <p className="text-xs text-muted mt-2 line-clamp-2 leading-relaxed flex-1">
          {product.description || 'Prepared fresh with premium ingredients.'}
        </p>
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
      </div>
    </div>
  );
};
