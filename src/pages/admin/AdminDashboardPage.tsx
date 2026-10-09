import React, { useState } from 'react';
import {
  ShoppingBag,
  FolderTree,
  CheckCircle2,
  AlertCircle,
  Plus,
  Leaf
} from 'lucide-react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { useAuth } from '../../context/AuthContext';
import { useMenu } from '../../context/MenuContext';
import { useNavigation } from '../../context/NavigationContext';
import { CategoryModal } from '../../components/admin/CategoryModal';
import { DeleteConfirmModal } from '../../components/admin/DeleteConfirmModal';
import { useToast } from '../../components/common/Toast';
import { ProductCard } from '../../components/customer/ProductCard';

export const AdminDashboardPage: React.FC = () => {
  const { user } = useAuth();
  const { categories, products, counts, addCategory, resetDatabase } = useMenu();
  const { navigate } = useNavigation();
  const { showToast } = useToast();

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  const handleAddCategory = async (data: { name: string; description?: string }) => {
    await addCategory(data);
    showToast(`Category "${data.name}" created successfully!`, 'success');
  };

  const handleResetData = async () => {
    await resetDatabase();
    setIsResetConfirmOpen(false);
    showToast('Catalog reset: All categories and products cleared (0 items)', 'info');
  };

  const stats = [
    { title: 'Menu Items', count: counts.totalProducts, icon: ShoppingBag, note: 'All menu items' },
    { title: 'Category', count: counts.totalCategories, icon: FolderTree, note: 'Dynamic sections' },
    { title: 'Available', count: counts.availableProducts, icon: CheckCircle2, note: 'Ready to order' },
    { title: 'Sold out', count: counts.outOfStockProducts, icon: AlertCircle, note: 'Temporarily unavailable' },
  ];

  return (
    <AdminLayout
      title="Dashboard"
      subtitle={`Welcome back, ${user?.name || 'Shakeer'} Â· live catalogue`}
      actionButton={
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCategoryModalOpen(true)}
            className="btn-outline-gold hidden sm:inline-flex"
          >
            <Plus className="w-3.5 h-3.5" />
            Category
          </button>
          <button
            onClick={() => navigate('/admin/products/add')}
            className="btn-gold !px-3.5 !py-2"
          >
            <Plus className="w-3.5 h-3.5" />
            Menu Item
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <div key={stat.title} className="card-luxury p-5">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-[10px] font-semibold text-gold-deep uppercase tracking-[0.16em]">
                    {stat.title}
                  </span>
                  <div className="p-2 rounded-full bg-parchment text-gold-deep">
                    <Icon className="w-4 h-4" />
                  </div>
                </div>
                <div className="font-serif text-4xl text-ink tracking-tight">{stat.count}</div>
                <p className="text-[11px] text-muted mt-1">{stat.note}</p>
              </div>
            );
          })}
        </div>

        <div className="max-w-[31.5rem] mx-auto rounded-xl border border-line bg-[#fffaf2] overflow-hidden shadow-[0_18px_40px_rgba(20,12,8,0.06)]">
            <div className="relative h-[11.5rem] overflow-hidden bg-[linear-gradient(135deg,#f4e3bd,#f8edda)] flex items-center justify-center">
              <div className="absolute top-3.5 flex items-center gap-2 text-gold/70" aria-hidden="true"><span className="h-px w-9 bg-gold/40" /><span className="text-[10px]">◇</span><span className="h-px w-9 bg-gold/40" /></div>
              <div className="absolute inset-x-[9%] top-3 h-36 rounded-t-[50%] border border-gold/50" aria-hidden="true" />
              <Leaf className="absolute left-[17%] top-[58%] w-6 h-6 text-[#7d8853] -rotate-45" aria-hidden="true" />
              <Leaf className="absolute right-[17%] top-[58%] w-6 h-6 text-[#7d8853] rotate-45" aria-hidden="true" />
              <div className="relative mt-9 flex flex-col items-center">
                <button type="button" aria-label="Create category" title="Create category" onClick={() => setIsCategoryModalOpen(true)} className="z-10 -mb-2 w-10 h-10 rounded-full bg-[#c28b2e] text-white shadow-md flex items-center justify-center transition hover:bg-[#a97622] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8d6b2b] focus-visible:ring-offset-2"><Plus className="w-5 h-5" /></button>
                <div className="w-36 h-3 border border-[#c28b2e] bg-[#fffaf2]" />
                <div className="w-32 h-10 border-x border-b border-[#c28b2e] bg-[#fffaf2] flex items-center justify-center"><span className="text-[8px] tracking-[0.35em] text-gold/50">· · ·</span></div>
              </div>
            </div>
            <div className="px-6 py-4 text-center">
              <h3 className="font-serif text-2xl text-ink">{products.length > 0 ? 'Add another menu item' : categories.length === 0 ? 'No categories yet' : 'No menu items yet'}</h3>
              <p className="max-w-md mx-auto mt-2 text-xs leading-5 text-muted">{products.length > 0 ? 'Keep building your catalogue with another sweet, snack, or gift box.' : categories.length === 0 ? 'Create your first category to organise your menu items like mithai, namkeen, snacks, gift boxes and more.' : 'Add your first menu item and start building your mithai and namkeen collection.'}</p>
              <div className="my-3 flex items-center justify-center gap-2 text-gold/70" aria-hidden="true"><span className="h-px w-9 bg-gold/40" /><span className="text-[10px]">◇</span><span className="h-px w-9 bg-gold/40" /></div>
              <button onClick={() => navigate('/admin/products/add')} className="inline-flex w-full max-w-[16.5rem] items-center justify-center gap-2 rounded-full bg-[#c28b2e] px-5 py-2.5 text-xs font-semibold text-white shadow-[0_10px_24px_rgba(153,100,20,0.2)] transition hover:bg-[#a97622]"><Plus className="w-3.5 h-3.5" />Create menu item</button>
            </div>
          </div>

        {products.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                categoryName={categories.find((category) => category.id === product.category_id)?.name}
              />
            ))}
          </div>
        )}
      </div>

      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onSubmit={handleAddCategory}
      />

      <DeleteConfirmModal
        isOpen={isResetConfirmOpen}
        title="Reset entire catalogue?"
        message="This will delete all categories and products, returning the database to 0 items and showing the coming-soon salon to guests."
        onClose={() => setIsResetConfirmOpen(false)}
        onConfirm={handleResetData}
      />
    </AdminLayout>
  );
};
