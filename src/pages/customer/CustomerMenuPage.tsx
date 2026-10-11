import React, { useMemo, useState } from 'react';
import { AlertCircle, Image as ImageIcon, Search, X } from 'lucide-react';
import { CustomerLayout } from '../../components/customer/CustomerLayout';
import { useMenu } from '../../context/MenuContext';
import { EmptyMenuState } from '../../components/customer/EmptyMenuState';
import { ProductCard } from '../../components/customer/ProductCard';

interface CategoryTileProps {
  label: string;
  count: number;
  imageUrl?: string;
  active: boolean;
  onClick: () => void;
}

const CategoryTile: React.FC<CategoryTileProps> = ({ label, count, imageUrl, active, onClick }) => (
  <button
    type="button"
    aria-pressed={active}
    onClick={onClick}
    className={`shrink-0 flex flex-col items-center gap-2 px-2 py-1 rounded-2xl text-xs font-semibold transition-all ${
      active
        ? 'text-ink'
        : 'text-muted hover:text-ink'
    }`}
  >
    <span className={`flex h-12 w-14 items-center justify-center overflow-hidden rounded-xl border ${active ? 'border-gold bg-ivory shadow-sm' : 'border-line bg-ivory'}`}>
      {imageUrl ? <img src={imageUrl} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-4 w-4 text-gold/50" aria-hidden="true" />}
    </span>
    <span className={`rounded-full border px-4 py-2 ${active ? 'border-gold bg-ink text-gold-light shadow-md' : 'border-line bg-ivory text-muted hover:border-gold'}`}>
      {label}<span className="ml-1.5 opacity-70">{count}</span>
    </span>
  </button>
);

export const CustomerMenuPage: React.FC = () => {
  const { categories, products, loading, loadError } = useMenu();
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((category) => map.set(category.id, category.name));
    return map;
  }, [categories]);

  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return products.filter((product) => (
      (selectedCategoryId === 'all' || product.category_id === selectedCategoryId)
      && (!query || product.name.toLowerCase().includes(query) || product.description.toLowerCase().includes(query))
    ));
  }, [products, selectedCategoryId, searchQuery]);

  const isMenuEmpty = categories.length === 0 && products.length === 0;

  return (
    <CustomerLayout>
      {loading ? (
        <div className="py-20 text-center">
          <div className="w-10 h-10 border-2 border-gold border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs tracking-[0.16em] uppercase text-muted">Loading today's selection</p>
        </div>
      ) : loadError ? (
        <div className="max-w-xl mx-auto my-16 px-6 py-8 text-center rounded-2xl border border-rose-200 bg-rose-50 text-rose-900">
          <h2 className="font-serif text-2xl">Menu temporarily unavailable</h2>
          <p className="mt-2 text-sm">Please try again in a moment.</p>
        </div>
      ) : isMenuEmpty ? (
        <EmptyMenuState />
      ) : (
        <div className="w-full px-4 sm:px-8 lg:px-12 py-10 space-y-8">
          <div>
            <p className="text-[11px] tracking-[0.22em] uppercase text-gold-deep font-semibold">The catalogue</p>
            <h3 className="font-serif text-3xl sm:text-4xl text-ink mt-1">Today's specialities</h3>
          </div>

          <label className="flex items-center gap-3 w-full rounded-2xl border border-line bg-ivory px-4 py-3 text-muted shadow-sm focus-within:border-gold focus-within:ring-2 focus-within:ring-gold/20">
            <Search className="h-5 w-5 shrink-0 text-gold-deep" aria-hidden="true" />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search menu items..."
              aria-label="Search menu items"
              className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-muted/70"
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery('')} aria-label="Clear search" className="rounded-full p-1 hover:bg-parchment">
                <X className="h-4 w-4" />
              </button>
            )}
          </label>

          {categories.length > 0 && (
            <div className="flex flex-nowrap items-start gap-4 sm:gap-6 min-w-0 w-full overflow-x-auto pb-3 scrollbar-none">
              <CategoryTile
                label="All"
                count={products.length}
                active={selectedCategoryId === 'all'}
                onClick={() => setSelectedCategoryId('all')}
              />
              {categories.map((category) => {
                const categoryProducts = products.filter((product) => product.category_id === category.id);
                return (
                  <CategoryTile
                    key={category.id}
                    label={category.name}
                    count={categoryProducts.length}
                    imageUrl={category.image_url}
                    active={selectedCategoryId === category.id}
                    onClick={() => setSelectedCategoryId(category.id)}
                  />
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
              <button onClick={() => setSelectedCategoryId('all')} className="btn-gold">
                Reset filter
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 border-t border-line">
              {filteredProducts.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  categoryName={categoryMap.get(product.category_id)}
                  layout="horizontal"
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
