import React, { useEffect, useState } from 'react';
import { 
  ArrowLeft, 
  Upload, 
  Camera,
  Image as ImageIcon, 
  Plus, 
  CheckCircle2, 
  AlertCircle,
  Loader2
} from 'lucide-react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { useMenu } from '../../context/MenuContext';
import { useNavigation } from '../../context/NavigationContext';
import { ProductStatus } from '../../types/database';
import { CategoryModal } from '../../components/admin/CategoryModal';
import { useToast } from '../../components/common/Toast';
import { deleteUnattachedProductImage, uploadProductImage } from '../../services/database';

export const AdminProductAddPage: React.FC = () => {
  const { categories, addProduct, addCategory } = useMenu();
  const { navigate } = useNavigation();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState(categories[0]?.id || '');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [status, setStatus] = useState<ProductStatus>('available');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);

  useEffect(() => () => { if (imageUrl.startsWith('blob:')) URL.revokeObjectURL(imageUrl); }, [imageUrl]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setError(null);
      if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)) { setError('Choose a JPEG, PNG, WebP, or GIF image.'); return; }
      if (file.size < 1 || file.size > 5 * 1024 * 1024) { setError('Image must be smaller than 5 MiB.'); return; }
      setImageFile(file);
      setImageUrl(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = name.trim();
    if (!cleanName) {
      setError('Menu item name is required');
      return;
    }

    if (!categoryId) {
      setError('Please select a category for this item');
      return;
    }

    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice < 0) {
      setError('Please enter a valid price (greater than or equal to 0)');
      return;
    }

    try {
      setIsSubmitting(true);
      const storedImageUrl = imageFile ? await uploadProductImage(imageFile) : imageUrl.trim();
      try {
        await addProduct({
          name: cleanName,
          category_id: categoryId,
          price: numPrice,
          description: description.trim(),
          image_url: storedImageUrl,
          status,
        });
      } catch (saveError) {
        if (imageFile && storedImageUrl.startsWith('http')) await deleteUnattachedProductImage(storedImageUrl);
        throw saveError;
      }

      showToast(`"${cleanName}" added to the menu!`, 'success');
      navigate('/admin/products');
    } catch (err: any) {
      setError(err?.message || 'Failed to add menu item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateCategory = async (data: { name: string; description?: string; image_url?: string }) => {
    const created = await addCategory(data);
    setCategoryId(created.id);
    showToast(`Category "${created.name}" created and selected!`, 'success');
  };

  return (
    <AdminLayout
      title="Add Menu Item"
      subtitle="Create a new sweet, savoury snack, or beverage item"
    >
      <div className="max-w-2xl mx-auto space-y-6">
        <button
          onClick={() => navigate('/admin/products')}
          className="inline-flex items-center gap-2 text-xs font-bold text-[#745b00] hover:text-[#241a00] transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Menu Items</span>
        </button>

        <div className="bg-ivory rounded-2xl border border-[#e5d8b8] shadow-xs overflow-hidden">
          <form onSubmit={handleSubmit} className="p-6 sm:p-8 space-y-5">
            {error && (
              <div className="p-3.5 bg-red-100 border border-red-300 text-red-800 text-xs rounded-xl font-medium">
                {error}
              </div>
            )}

            {/* Menu Item Name */}
            <div>
              <label className="block text-xs font-bold text-[#241a00] uppercase tracking-wider mb-1.5">
                Menu Item Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Special Badam Halwa, Masala Cashew, Gulab Jamun..."
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#ccc7aa] bg-white text-sm text-[#241a00] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#fdec00]"
              />
            </div>

            {/* Category Selection */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-[#241a00] uppercase tracking-wider">
                  Category <span className="text-red-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="text-xs font-bold text-[#745b00] hover:text-[#241a00] inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>New Category</span>
                </button>
              </div>

              {categories.length === 0 ? (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg flex items-center justify-between gap-3 text-xs text-amber-900">
                  <span>No categories exist yet. You must create one first.</span>
                  <button
                    type="button"
                    onClick={() => setIsCategoryModalOpen(true)}
                    className="px-3 py-1.5 bg-[#241a00] text-[#fdec00] rounded-md font-bold shrink-0 hover:bg-black transition"
                  >
                    Create Category
                  </button>
                </div>
              ) : (
                <select
                  required
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-[#ccc7aa] bg-white text-sm text-[#241a00] focus:outline-none focus:ring-2 focus:ring-[#fdec00]"
                >
                  <option value="" disabled>
                    -- Select a Category --
                  </option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Price & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#241a00] uppercase tracking-wider mb-1.5">
                  Price (₹) <span className="text-red-500">*</span>
                </label>
                <div className="relative rounded-lg">
                  <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center text-stone-500 font-bold text-sm">
                    ₹
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="250.00"
                    className="w-full pl-8 pr-3.5 py-2.5 rounded-lg border border-[#ccc7aa] bg-white text-sm text-[#241a00] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#fdec00]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#241a00] uppercase tracking-wider mb-1.5">
                  Availability Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setStatus('available')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border transition ${
                      status === 'available'
                        ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                        : 'bg-white text-stone-700 border-[#ccc7aa] hover:bg-[#fff8f1]'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Available</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus('out_of_stock')}
                    className={`py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 border transition ${
                      status === 'out_of_stock'
                        ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
                        : 'bg-white text-stone-700 border-[#ccc7aa] hover:bg-[#fff8f1]'
                    }`}
                  >
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Out of Stock</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-bold text-[#241a00] uppercase tracking-wider mb-1.5">
                Menu Item Description
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Key ingredients, net weight (e.g. 250g / 500g box), or serving notes..."
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#ccc7aa] bg-white text-sm text-[#241a00] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#fdec00] resize-none"
              />
            </div>

            {/* Image Upload / URL */}
            <div className="space-y-3">
              <label className="block text-xs font-bold text-[#241a00] uppercase tracking-wider">
                Menu Item Image (Upload or Web URL)
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                <div className="sm:col-span-6">
                  <input
                    type="text"
                    inputMode="url"
                    value={imageUrl}
                    onChange={(e) => { setImageFile(null); setImageUrl(e.target.value); }}
                    placeholder="https://example.com/item.jpg"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#ccc7aa] bg-white text-xs sm:text-sm text-[#241a00] placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-[#fdec00]"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-[#ccc7aa] bg-white hover:bg-[#ffecc2] text-xs font-bold text-[#4a4731] cursor-pointer transition shadow-2xs">
                    <Camera className="w-4 h-4 text-[#745b00]" />
                    <span>Capture Photo</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      capture="environment"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
                <div className="sm:col-span-3">
                  <label className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-[#ccc7aa] bg-white hover:bg-[#ffecc2] text-xs font-bold text-[#4a4731] cursor-pointer transition shadow-2xs">
                    <Upload className="w-4 h-4 text-[#745b00]" />
                    <span>Upload File</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Preview image */}
              {imageUrl && (
                <div className="p-3 bg-white rounded-xl border border-[#e5d8b8] flex items-center gap-3">
                  <div className="w-16 h-16 rounded-lg bg-stone-100 overflow-hidden border shrink-0">
                    <img
                      src={imageUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      onError={() => setError('Image URL appears broken or inaccessible')}
                    />
                  </div>
                  <div className="text-xs text-[#745b00] min-w-0">
                    <p className="font-bold text-[#241a00]">Image Preview Attached</p>
                    <p className="truncate text-[11px] text-stone-500">{imageUrl}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-[#e5d8b8] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => navigate('/admin/products')}
                disabled={isSubmitting}
                className="px-4 py-2.5 rounded-lg border border-[#ccc7aa] text-xs font-semibold text-[#4a4731] hover:bg-white transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || categories.length === 0}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#241a00] hover:bg-black text-[#fdec00] text-xs font-bold shadow-sm transition disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save & Publish Menu Item</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      <CategoryModal
        isOpen={isCategoryModalOpen}
        onClose={() => setIsCategoryModalOpen(false)}
        onSubmit={handleCreateCategory}
      />
    </AdminLayout>
  );
};
