import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, 
  Upload, 
  Camera,
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  Image as ImageIcon
} from 'lucide-react';
import { AdminLayout } from '../../components/admin/AdminLayout';
import { useMenu } from '../../context/MenuContext';
import { useNavigation } from '../../context/NavigationContext';
import { ProductStatus } from '../../types/database';
import { DeleteConfirmModal } from '../../components/admin/DeleteConfirmModal';
import { useToast } from '../../components/common/Toast';

export const AdminProductEditPage: React.FC = () => {
  const { products, categories, updateProduct, deleteProduct } = useMenu();
  const { navigate, getParam } = useNavigation();
  const { showToast } = useToast();

  const productId = getParam('id');
  const targetProduct = products.find((p) => p.id === productId);

  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [status, setStatus] = useState<ProductStatus>('available');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  useEffect(() => {
    if (targetProduct) {
      setName(targetProduct.name);
      setCategoryId(targetProduct.category_id);
      setPrice(targetProduct.price.toString());
      setDescription(targetProduct.description || '');
      setImageUrl(targetProduct.image_url || '');
      setStatus(targetProduct.status);
    }
  }, [targetProduct]);

  if (!targetProduct) {
    return (
      <AdminLayout title="Menu Item Not Found">
        <div className="bg-ivory rounded-2xl border border-[#e5d8b8] p-10 text-center max-w-md mx-auto">
          <p className="text-sm font-semibold text-[#241a00] mb-4">
            The requested menu item could not be located in the catalog.
          </p>
          <button
            onClick={() => navigate('/admin/products')}
            className="px-4 py-2 bg-[#241a00] text-[#fdec00] rounded-lg text-xs font-bold"
          >
            Return to Menu Items
          </button>
        </div>
      </AdminLayout>
    );
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        setError('Image file must be under 2MB');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setImageUrl(reader.result as string);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanName = name.trim();
    if (!cleanName) {
      setError('Menu item name cannot be empty');
      return;
    }

    if (!categoryId) {
      setError('Please select a valid category');
      return;
    }

    const numPrice = parseFloat(price);
    if (isNaN(numPrice) || numPrice < 0) {
      setError('Please enter a valid price (>= 0)');
      return;
    }

    try {
      setIsSubmitting(true);
      await updateProduct(targetProduct.id, {
        name: cleanName,
        category_id: categoryId,
        price: numPrice,
        description: description.trim(),
        image_url: imageUrl.trim(),
        status,
      });

      showToast(`Updated "${cleanName}" successfully!`, 'success');
      navigate('/admin/products');
    } catch (err: any) {
      setError(err?.message || 'Failed to update menu item');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    await deleteProduct(targetProduct.id);
    showToast(`Menu item "${targetProduct.name}" deleted`, 'info');
    navigate('/admin/products');
  };

  return (
    <AdminLayout
      title="Edit Menu Item"
      subtitle={`Editing catalog item: ${targetProduct.name}`}
      actionButton={
        <button
          onClick={() => setIsDeleteModalOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 text-xs font-bold text-red-700 transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>Delete Item</span>
        </button>
      }
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

            <div>
              <label className="block text-xs font-bold text-[#241a00] uppercase tracking-wider mb-1.5">
                Menu Item Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#ccc7aa] bg-white text-sm text-[#241a00] focus:outline-none focus:ring-2 focus:ring-[#fdec00]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#241a00] uppercase tracking-wider mb-1.5">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                required
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#ccc7aa] bg-white text-sm text-[#241a00] focus:outline-none focus:ring-2 focus:ring-[#fdec00]"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

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
                    className="w-full pl-8 pr-3.5 py-2.5 rounded-lg border border-[#ccc7aa] bg-white text-sm text-[#241a00] focus:outline-none focus:ring-2 focus:ring-[#fdec00]"
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

            <div>
              <label className="block text-xs font-bold text-[#241a00] uppercase tracking-wider mb-1.5">
                Menu Item Description
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg border border-[#ccc7aa] bg-white text-sm text-[#241a00] focus:outline-none focus:ring-2 focus:ring-[#fdec00] resize-none"
              />
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-[#241a00] uppercase tracking-wider">
                Menu Item Image (Upload or Web URL)
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                <div className="sm:col-span-6">
                  <input
                    type="url"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="https://example.com/item.jpg"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-[#ccc7aa] bg-white text-xs sm:text-sm text-[#241a00] focus:outline-none focus:ring-2 focus:ring-[#fdec00]"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-[#ccc7aa] bg-white hover:bg-[#ffecc2] text-xs font-bold text-[#4a4731] cursor-pointer transition shadow-2xs">
                    <Camera className="w-4 h-4 text-[#745b00]" />
                    <span>Capture Photo</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
                <div className="sm:col-span-3">
                  <label className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg border border-[#ccc7aa] bg-white hover:bg-[#ffecc2] text-xs font-bold text-[#4a4731] cursor-pointer transition shadow-2xs">
                    <Upload className="w-4 h-4 text-[#745b00]" />
                    <span>Change File</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {imageUrl && (
                <div className="p-3 bg-white rounded-xl border border-[#e5d8b8] flex items-center gap-3">
                  <div className="w-16 h-16 rounded-lg bg-stone-100 overflow-hidden border shrink-0">
                    <img
                      src={imageUrl}
                      alt="Preview"
                      className="w-full h-full object-cover"
                      onError={() => setError('Image failed to render')}
                    />
                  </div>
                  <div className="text-xs text-[#745b00] min-w-0">
                    <p className="font-bold text-[#241a00]">Current Image Preview</p>
                    <p className="truncate text-[11px] text-stone-500">{imageUrl}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-[#e5d8b8] flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setIsDeleteModalOpen(true)}
                className="text-xs text-red-600 font-bold hover:underline"
              >
                Delete this menu item
              </button>

              <div className="flex items-center gap-3">
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
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-[#241a00] hover:bg-black text-[#fdec00] text-xs font-bold shadow-sm transition disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Update Menu Item</span>
                  )}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <DeleteConfirmModal
        isOpen={isDeleteModalOpen}
        title={`Delete "${targetProduct.name}"?`}
        message="This menu item will be permanently deleted from the database and customer menu."
        onClose={() => setIsDeleteModalOpen(false)}
        onConfirm={handleDelete}
      />
    </AdminLayout>
  );
};
