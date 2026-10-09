import React, { useState, useMemo } from 'react';
import { 
  ShoppingBag, 
  Plus, 
  Edit3, 
  Trash2, 
  Search, 
  Filter, 
  CheckCircle2, 
  AlertCircle,
  Image as ImageIcon
} from 'lucide-react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { useMenu } from '../../context/MenuContext';
import { useNavigation } from '../../context/NavigationContext';
import { Product, ProductStatus } from '../../types/database';
import { DeleteConfirmModal } from '../../components/admin/DeleteConfirmModal';
import { useToast } from '../../components/common/Toast';

export const AdminProductsPage: React.FC = () => {
  const { products, categories, deleteProduct, toggleProductStatus } = useMenu();
  const { navigate } = useNavigation();
  const { showToast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);

  // Map category id to name
  const categoryMap = useMemo(() => {
    const map = new Map<string, string>();
    categories.forEach((c) => map.set(c.id, c.name));
    return map;
  }, [categories]);

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter((prod) => {
      // Category filter
      if (selectedCategory !== 'all' && prod.category_id !== selectedCategory) {
        return false;
      }
      // Status filter
      if (selectedStatus !== 'all' && prod.status !== selectedStatus) {
        return false;
      }
      // Search filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchesName = prod.name.toLowerCase().includes(q);
        const matchesDesc = prod.description.toLowerCase().includes(q);
        return matchesName || matchesDesc;
      }
      return true;
    });
  }, [products, selectedCategory, selectedStatus, searchTerm]);

  const handleToggleStatus = async (prod: Product) => {
    await toggleProductStatus(prod.id);
    const newStatus = prod.status === 'available' ? 'Out of Stock' : 'Available';
    showToast(`"${prod.name}" status changed to ${newStatus}`, 'info');
  };

  const handleConfirmDelete = async () => {
    if (!deletingProduct) return;
    await deleteProduct(deletingProduct.id);
    showToast(`Menu item "${deletingProduct.name}" deleted`, 'info');
    setDeletingProduct(null);
  };

  return (
    <AdminLayout
      title="Menu Items"
      subtitle={`Total Menu Items: ${products.length}`}
      actionButton={
        <button
          onClick={() => navigate('/admin/products/add')}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#241a00] hover:bg-black text-[#fdec00] text-xs font-bold shadow-xs transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add Menu Item</span>
        </button>
      }
    >
      <div className="space-y-6">
        {/* Filter and Search Bar */}
        <div className="bg-ivory p-4 rounded-xl border border-[#e5d8b8] space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            {/* Search */}
            <div className="sm:col-span-6 relative">
              <Search className="w-4 h-4 text-[#745b00] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search menu items by name or description..."
                disabled={products.length === 0}
                className="w-full pl-9 pr-4 py-2 rounded-lg border border-[#ccc7aa] bg-white text-xs sm:text-sm text-[#241a00] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#fdec00] disabled:bg-stone-100 disabled:cursor-not-allowed"
              />
            </div>

            {/* Category Filter */}
            <div className="sm:col-span-3">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                disabled={categories.length === 0}
                className="w-full px-3 py-2 rounded-lg border border-[#ccc7aa] bg-white text-xs sm:text-sm text-[#241a00] focus:outline-none focus:ring-2 focus:ring-[#fdec00] disabled:bg-stone-100"
              >
                <option value="all">All Categories ({categories.length})</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="sm:col-span-3">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                disabled={products.length === 0}
                className="w-full px-3 py-2 rounded-lg border border-[#ccc7aa] bg-white text-xs sm:text-sm text-[#241a00] focus:outline-none focus:ring-2 focus:ring-[#fdec00] disabled:bg-stone-100"
              >
                <option value="all">All Statuses</option>
                <option value="available">Available Only</option>
                <option value="out_of_stock">Out of Stock Only</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-[#745b00] pt-1">
            <span>
              Showing {filteredProducts.length} of {products.length} menu items
            </span>
            {(selectedCategory !== 'all' || selectedStatus !== 'all' || searchTerm) && (
              <button
                onClick={() => {
                  setSelectedCategory('all');
                  setSelectedStatus('all');
                  setSearchTerm('');
                }}
                className="font-bold underline text-[#241a00]"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>

        {/* Empty state when the catalog has no menu items */}
        {products.length === 0 ? (
          <div className="bg-ivory rounded-2xl border-2 border-dashed border-[#d7ab01] p-10 text-center max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-[#ffecc2] text-[#745b00] flex items-center justify-center mx-auto mb-4">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-[#241a00] mb-1">
              No Menu Items Added Yet
            </h3>
            <p className="text-xs text-[#745b00] leading-relaxed mb-6">
              The customer menu is currently displaying <em>"Menu Coming Soon"</em>. Add your sweets, snacks, and beverage items with prices and descriptions to launch your digital menu.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              {categories.length === 0 ? (
                <button
                  onClick={() => navigate('/admin/categories')}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-[#d7ab01] bg-[#ffecc2] text-[#241a00] text-xs font-bold transition hover:bg-[#fdec00]"
                >
                  <span>Step 1: Create Category First</span>
                </button>
              ) : (
                <button
                  onClick={() => navigate('/admin/products/add')}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#241a00] hover:bg-black text-[#fdec00] text-xs font-bold shadow-md transition"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add First Menu Item</span>
                </button>
              )}
            </div>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="bg-ivory rounded-xl p-8 text-center border border-[#e5d8b8]">
            <p className="text-sm font-semibold text-[#241a00]">No menu items match the selected filters.</p>
            <button
              onClick={() => {
                setSelectedCategory('all');
                setSelectedStatus('all');
                setSearchTerm('');
              }}
              className="mt-2 text-xs font-bold text-[#745b00] underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          /* Menu items table */
          <div className="bg-ivory rounded-2xl border border-[#e5d8b8] overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="bg-[#ffecc2] border-b border-[#e5d8b8] text-[11px] font-bold text-[#241a00] uppercase tracking-wider">
                    <th className="py-3.5 px-4 sm:px-6">Menu Item</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4">Price</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5d8b8]/70">
                  {filteredProducts.map((prod) => {
                    const catName = categoryMap.get(prod.category_id) || 'Unassigned';
                    const isAvailable = prod.status === 'available';

                    return (
                      <tr key={prod.id} className="hover:bg-white/40 transition">
                        {/* Name and Image */}
                        <td className="py-3.5 px-4 sm:px-6">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-lg bg-stone-100 border border-[#ccc7aa]/60 shrink-0 overflow-hidden flex items-center justify-center">
                              {prod.image_url ? (
                                <img
                                  src={prod.image_url}
                                  alt={prod.name}
                                  className="w-full h-full object-cover"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                  }}
                                />
                              ) : (
                                <ImageIcon className="w-5 h-5 text-stone-400" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <h4 className="font-bold text-[#241a00] truncate max-w-[200px] sm:max-w-xs">
                                {prod.name}
                              </h4>
                              <p className="text-[11px] text-[#4a4731] truncate max-w-[200px] sm:max-w-xs">
                                {prod.description || <span className="italic text-stone-400">No description</span>}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Category */}
                        <td className="py-3.5 px-4 text-xs">
                          <span className="inline-block px-2.5 py-1 rounded-md bg-[#ffecc2] text-[#745b00] font-medium border border-[#e5d8b8]">
                            {catName}
                          </span>
                        </td>

                        {/* Price */}
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-[#241a00] text-sm">
                            ₹{prod.price.toFixed(2)}
                          </span>
                        </td>

                        {/* Status Toggle */}
                        <td className="py-3.5 px-4">
                          <button
                            onClick={() => handleToggleStatus(prod)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border transition ${
                              isAvailable
                                ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                                : 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100'
                            }`}
                            title="Click to toggle status"
                          >
                            {isAvailable ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Available</span>
                              </>
                            ) : (
                              <>
                                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                                <span>Out of Stock</span>
                              </>
                            )}
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 sm:px-6 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => navigate(`/admin/products/edit/${prod.id}`)}
                              className="p-1.5 text-[#4a4731] hover:text-[#241a00] hover:bg-[#ffecc2] rounded-md transition"
                              title="Edit Menu Item"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setDeletingProduct(prod)}
                              className="p-1.5 text-stone-500 hover:text-red-600 hover:bg-red-50 rounded-md transition"
                              title="Delete Menu Item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <DeleteConfirmModal
        isOpen={!!deletingProduct}
        title={`Delete "${deletingProduct?.name}"?`}
        message="This menu item will be permanently removed from the database and customer menu."
        onClose={() => setDeletingProduct(null)}
        onConfirm={handleConfirmDelete}
      />
    </AdminLayout>
  );
};
