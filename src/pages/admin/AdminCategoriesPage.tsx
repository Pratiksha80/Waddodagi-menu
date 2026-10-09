import React, { useState, useMemo } from 'react';
import { 
  FolderTree, 
  Plus, 
  Edit3, 
  Trash2, 
  Search, 
  ShoppingBag, 
  Calendar,
  AlertCircle
} from 'lucide-react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { useMenu } from '../../context/MenuContext';
import { Category } from '../../types/database';
import { CategoryModal } from '../../components/admin/CategoryModal';
import { DeleteConfirmModal } from '../../components/admin/DeleteConfirmModal';
import { useToast } from '../../components/common/Toast';

export const AdminCategoriesPage: React.FC = () => {
  const { categories, products, addCategory, updateCategory, deleteCategory } = useMenu();
  const { showToast } = useToast();

  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);

  // Calculate count of products per category
  const categoriesWithCounts = useMemo(() => {
    return categories.map((cat) => {
      const count = products.filter((p) => p.category_id === cat.id).length;
      return { ...cat, product_count: count };
    });
  }, [categories, products]);

  // Filtered by search term
  const filteredCategories = useMemo(() => {
    if (!searchTerm.trim()) return categoriesWithCounts;
    const q = searchTerm.toLowerCase();
    return categoriesWithCounts.filter(
      (c) => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
    );
  }, [categoriesWithCounts, searchTerm]);

  const handleOpenAdd = () => {
    setEditingCategory(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (cat: Category) => {
    setEditingCategory(cat);
    setIsModalOpen(true);
  };

  const handleSaveCategory = async (data: { name: string; description?: string }) => {
    if (editingCategory) {
      await updateCategory(editingCategory.id, data);
      showToast(`Category "${data.name}" updated!`, 'success');
    } else {
      await addCategory(data);
      showToast(`Category "${data.name}" created!`, 'success');
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingCategory) return;
    try {
      setDeleteError(null);
      await deleteCategory(deletingCategory.id);
      showToast(`Category "${deletingCategory.name}" removed`, 'info');
      setDeletingCategory(null);
    } catch (err: any) {
      setDeleteError(err?.message || 'Failed to delete category');
    }
  };

  const visibleIds = filteredCategories.map((category) => category.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedCategoryIds.includes(id));

  const toggleCategorySelection = (id: string) => {
    setSelectedCategoryIds((selected) => selected.includes(id)
      ? selected.filter((selectedId) => selectedId !== id)
      : [...selected, id]);
  };

  const toggleVisibleSelection = () => {
    setSelectedCategoryIds((selected) => allVisibleSelected
      ? selected.filter((id) => !visibleIds.includes(id))
      : [...new Set([...selected, ...visibleIds])]);
  };

  const handleBulkDelete = async () => {
    const selectedCategories = categoriesWithCounts.filter((category) => selectedCategoryIds.includes(category.id));
    const deletable = selectedCategories.filter((category) => category.product_count === 0);
    const blocked = selectedCategories.length - deletable.length;
    setBulkDeleteError(null);

    if (deletable.length === 0) {
      setBulkDeleteError('None of the selected categories can be deleted because they contain menu items.');
      return;
    }

    let deletedCount = 0;
    const failedIds: string[] = [];
    for (const category of deletable) {
      try {
        await deleteCategory(category.id);
        deletedCount += 1;
      } catch {
        failedIds.push(category.id);
      }
    }

    const remainingIds = [...selectedCategories.filter((category) => category.product_count > 0).map((category) => category.id), ...failedIds];
    setSelectedCategoryIds(remainingIds);
    setIsBulkDeleteOpen(false);
    if (deletedCount > 0) {
      showToast(`Deleted ${deletedCount} categor${deletedCount === 1 ? 'y' : 'ies'}${blocked + failedIds.length ? `; ${blocked + failedIds.length} could not be deleted` : ''}.`, blocked + failedIds.length ? 'info' : 'success');
    }
  };

  return (
    <AdminLayout
      title="Categories"
      subtitle={`Total Categories: ${categories.length}`}
      actionButton={
        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#241a00] hover:bg-black text-[#fdec00] text-xs font-bold shadow-xs transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add Category</span>
        </button>
      }
    >
      <div className="space-y-6">
        {/* Search & Actions Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-ivory p-3.5 rounded-xl border border-[#e5d8b8]">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-[#745b00] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search categories by name..."
              disabled={categories.length === 0}
              className="w-full pl-9 pr-4 py-2 rounded-lg border border-[#ccc7aa] bg-white text-xs sm:text-sm text-[#241a00] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#fdec00] disabled:bg-stone-100 disabled:cursor-not-allowed"
            />
          </div>
          <div className="flex items-center justify-between sm:justify-end gap-3 text-xs font-semibold text-[#745b00]">
            <span>Showing {filteredCategories.length} of {categories.length} categories</span>
            {selectedCategoryIds.length > 0 && (
              <button
                onClick={() => {
                  setBulkDeleteError(null);
                  setIsBulkDeleteOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-lg bg-rose-600 px-3 py-2 text-white transition hover:bg-rose-700"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete selected ({selectedCategoryIds.length})
              </button>
            )}
          </div>
        </div>

        {/* Empty State when 0 categories in database */}
        {categories.length === 0 ? (
          <div className="bg-ivory rounded-2xl border-2 border-dashed border-[#d7ab01] p-10 text-center max-w-lg mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-[#ffecc2] text-[#745b00] flex items-center justify-center mx-auto mb-4">
              <FolderTree className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-[#241a00] mb-1">
              No Categories Created Yet
            </h3>
            <p className="text-xs text-[#745b00] leading-relaxed mb-6">
              Categories allow you to organize sweets, snacks, bakery, and drinks on the customer menu. As requested, your catalog starts 100% empty.
            </p>
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#241a00] hover:bg-black text-[#fdec00] text-xs font-bold shadow-md transition"
            >
              <Plus className="w-4 h-4" />
              <span>Create Your First Category</span>
            </button>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="bg-ivory rounded-xl p-8 text-center border border-[#e5d8b8]">
            <p className="text-sm font-semibold text-[#241a00]">No categories match your search.</p>
            <button
              onClick={() => setSearchTerm('')}
              className="mt-2 text-xs font-bold text-[#745b00] underline"
            >
              Clear search filter
            </button>
          </div>
        ) : (
          /* Categories Table/Card Grid */
          <div className="bg-ivory rounded-2xl border border-[#e5d8b8] overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="bg-[#ffecc2] border-b border-[#e5d8b8] text-[11px] font-bold text-[#241a00] uppercase tracking-wider">
                    <th className="py-3.5 px-4 sm:px-6">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={allVisibleSelected}
                          onChange={toggleVisibleSelection}
                          aria-label="Select all visible categories"
                          className="h-4 w-4 accent-[#a97705]"
                        />
                        <span>Category Name</span>
                      </div>
                    </th>
                    <th className="py-3.5 px-4 hidden md:table-cell">Description</th>
                    <th className="py-3.5 px-4 text-center">Menu Items</th>
                    <th className="py-3.5 px-4 hidden sm:table-cell">Created Date</th>
                    <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e5d8b8]/70">
                  {filteredCategories.map((cat) => (
                    <tr key={cat.id} className="hover:bg-white/40 transition">
                      <td className="py-3.5 px-4 sm:px-6 font-semibold text-[#241a00]">
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            checked={selectedCategoryIds.includes(cat.id)}
                            onChange={() => toggleCategorySelection(cat.id)}
                            aria-label={`Select ${cat.name}`}
                            className="h-4 w-4 shrink-0 accent-[#a97705]"
                          />
                          <div className="w-7 h-7 rounded-lg bg-[#ffecc2] text-[#745b00] flex items-center justify-center shrink-0">
                            <FolderTree className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <span className="block">{cat.name}</span>
                            <span className="text-[10px] text-[#745b00] md:hidden truncate max-w-[180px] block font-normal">
                              {cat.description || 'No description'}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[#4a4731] hidden md:table-cell max-w-xs truncate">
                        {cat.description || <span className="italic text-stone-400">None</span>}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                          cat.product_count > 0 
                            ? 'bg-amber-200 text-amber-950' 
                            : 'bg-stone-200 text-stone-700'
                        }`}>
                          <ShoppingBag className="w-3 h-3" />
                          <span>{cat.product_count}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-[#745b00] hidden sm:table-cell">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{new Date(cat.created_at).toLocaleDateString()}</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 sm:px-6 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenEdit(cat)}
                            className="p-1.5 text-[#4a4731] hover:text-[#241a00] hover:bg-[#ffecc2] rounded-md transition"
                            title="Edit Category"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              setDeleteError(null);
                              setDeletingCategory(cat);
                            }}
                            className="p-1.5 text-stone-500 hover:text-red-600 hover:bg-red-50 rounded-md transition"
                            title="Delete Category"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <CategoryModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSaveCategory}
        categoryToEdit={editingCategory}
      />

      <DeleteConfirmModal
        isOpen={!!deletingCategory}
        title={`Delete Category "${deletingCategory?.name}"?`}
        message={
          deleteError
            ? deleteError
            : "Are you sure you want to delete this category? (Note: A category cannot be deleted if products are still assigned to it)."
        }
        onClose={() => {
          setDeletingCategory(null);
          setDeleteError(null);
        }}
        onConfirm={handleConfirmDelete}
      />

      <DeleteConfirmModal
        isOpen={isBulkDeleteOpen}
        title={`Delete ${selectedCategoryIds.length} selected categor${selectedCategoryIds.length === 1 ? 'y' : 'ies'}?`}
        message={bulkDeleteError || (() => {
          const selected = categoriesWithCounts.filter((category) => selectedCategoryIds.includes(category.id));
          const blockedCount = selected.filter((category) => category.product_count > 0).length;
          return `This permanently removes the selected empty categories. ${blockedCount > 0 ? `${blockedCount} categor${blockedCount === 1 ? 'y contains' : 'ies contain'} menu items and will be skipped.` : 'Categories containing menu items cannot be deleted.'}`;
        })()}
        onClose={() => {
          setIsBulkDeleteOpen(false);
          setBulkDeleteError(null);
        }}
        onConfirm={handleBulkDelete}
      />
    </AdminLayout>
  );
};
