import React, { useMemo, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import { CustomerLayout } from '../../components/customer/CustomerLayout';
import { useMenu } from '../../context/MenuContext';
import { EmptyMenuState } from '../../components/customer/EmptyMenuState';
import { ProductCard } from '../../components/customer/ProductCard';

export const CustomerMenuPage: React.FC = () => {
  const { categories, products, loading } = useMenu();

  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');

  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      if (selectedCategoryId !== 'all' && prod.category_id !== selectedCategoryId) {
        return false;
      }
      return true;
    });
  }, [products, selectedCategoryId]);

  const isMenuEmpty = categories.length === 0 && products.length === 0;

  return (
    <CustomerLayout>
      {loading ? (
        <div className="py-20 text-center">
          <div className="w-10 h-10 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs tracking-[0.16em] uppercase text-muted">Loading today’s selection</p>
        </div>
      ) : isMenuEmpty ? (
        <EmptyMenuState />
      ) : (
        <div className="max-w-6xl mx-auto px-4 sm:px-8 py-10 space-y-8">
          <div>
            <p className="text-[11px] tracking-[0.22em] uppercase text-gold-deep font-semibold">The catalogue</p>
            <h3 className="font-serif text-3xl sm:text-4xl text-ink mt-1">Today’s specialities</h3>
          </div>

          {categories.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setSelectedCategoryId('all')}
                className={`px-5 py-2.5 rounded-full text-xs font-semibold shrink-0 transition-all ${
                  selectedCategoryId === 'all'
                    ? 'bg-ink text-gold-light shadow-md'
                    : 'bg-ivory border border-line text-muted hover:border-gold hover:text-ink'
                }`}
              >
                All · {products.length}
              </button>
              {categories.map((cat) => {
                const count = products.filter((p) => p.category_id === cat.id).length;
                const isSelected = selectedCategoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategoryId(cat.id)}
                    className={`px-5 py-2.5 rounded-full text-xs font-semibold shrink-0 transition-all ${
                      isSelected
                        ? 'bg-ink text-gold-light shadow-md'
                        : 'bg-ivory border border-line text-muted hover:border-gold hover:text-ink'
                    }`}
                  >
                    {cat.name}
                    <span className="ml-1.5 opacity-70">{count}</span>
                  </button>
                );
              })}
            </div>
          )}

          {selectedCategoryId !== 'all' && (
            <div className="flex items-center justify-between text-xs text-muted bg-parchment/70 px-4 py-2.5 rounded-2xl border border-line">
              <span>
                Showing <strong className="text-ink">{categoryMap.get(selectedCategoryId)}</strong>
              </span>
              <button
                onClick={() => setSelectedCategoryId('all')}
                className="font-semibold text-gold-deep hover:text-ink"
              >
                Show all
              </button>
            </div>
          )}

          {filteredProducts.length === 0 ? (
            <div className="card-luxury p-12 text-center max-w-md mx-auto">
              <AlertCircle className="w-8 h-8 text-gold mx-auto mb-3" />
              <h3 className="font-serif text-2xl text-ink mb-1">Nothing matches</h3>
              <p className="text-xs text-muted mb-5">Try another word or a different category.</p>
              <button
                onClick={() => setSelectedCategoryId('all')}
                className="btn-gold"
              >
                Reset filter
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProducts.map((prod) => (
                <ProductCard
                  key={prod.id}
                  product={prod}
                  categoryName={categoryMap.get(prod.category_id)}
                />
              ))}
            </div>
          )}

          <p className="text-center text-[11px] text-muted tracking-wide">
            {filteredProducts.length} handcrafted items on the floor
          </p>
        </div>
      )}
    </CustomerLayout>
  );
};
