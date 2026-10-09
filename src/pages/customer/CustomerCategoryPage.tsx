import React, { useMemo } from 'react';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import { CustomerLayout } from '../../components/customer/CustomerLayout';
import { useMenu } from '../../context/MenuContext';
import { useNavigation } from '../../context/NavigationContext';
import { ProductCard } from '../../components/customer/ProductCard';
import { GoldFlourish } from '../../components/common/GoldFlourish';

export const CustomerCategoryPage: React.FC = () => {
  const { categories, products } = useMenu();
  const { navigate, getParam } = useNavigation();

  const categoryId = getParam('id');
  const currentCategory = categories.find((c) => c.id === categoryId);

  const categoryProducts = useMemo(() => {
    if (!categoryId) return [];
    return products.filter((p) => p.category_id === categoryId);
  }, [products, categoryId]);

  if (!currentCategory) {
    return (
      <CustomerLayout>
        <div className="py-20 text-center max-w-md mx-auto px-4">
          <AlertCircle className="w-10 h-10 text-gold mx-auto mb-3" />
          <h2 className="font-serif text-3xl text-ink mb-2">Category not found</h2>
          <p className="text-sm text-muted mb-6">
            This collection may have been retired from the live menu.
          </p>
          <button onClick={() => navigate('/menu')} className="btn-gold">
            Return to full menu
          </button>
        </div>
      </CustomerLayout>
    );
  }

  return (
    <CustomerLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-8 space-y-8">
        <button
          onClick={() => navigate('/menu')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted hover:text-ink transition"
        >
          <ArrowLeft className="w-4 h-4" />
          All collections
        </button>

        <div className="relative overflow-hidden rounded-[1.8rem] bg-ink text-ivory px-6 sm:px-10 py-10 gold-frame">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_80%_20%,#c4a35a,transparent_45%)]" />
          <div className="relative">
            <p className="text-[11px] tracking-[0.28em] uppercase text-gold-light/80">Collection</p>
            <h1 className="font-serif text-4xl sm:text-5xl mt-2">{currentCategory.name}</h1>
            <GoldFlourish className="w-32 mt-4 mx-0 text-gold-light" />
            {currentCategory.description && (
              <p className="text-sm text-ivory/70 mt-4 max-w-2xl leading-relaxed">
                {currentCategory.description}
              </p>
            )}
            <p className="mt-6 text-[11px] tracking-[0.16em] uppercase text-gold">
              {categoryProducts.length} pieces in this collection
            </p>
          </div>
        </div>

        {categoryProducts.length === 0 ? (
          <div className="card-luxury p-12 text-center max-w-md mx-auto">
            <p className="font-serif text-2xl text-ink mb-1">No items yet in {currentCategory.name}</p>
            <p className="text-xs text-muted mb-4">The shop will add pieces to this collection soon.</p>
            <button onClick={() => navigate('/menu')} className="btn-gold">
              Browse other collections
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {categoryProducts.map((prod) => (
              <ProductCard
                key={prod.id}
                product={prod}
                categoryName={currentCategory.name}
              />
            ))}
          </div>
        )}
      </div>
    </CustomerLayout>
  );
};
