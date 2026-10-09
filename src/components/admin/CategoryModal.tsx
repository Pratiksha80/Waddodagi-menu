import React, { useState, useEffect } from 'react';
import { X, FolderPlus, Edit3, Loader2 } from 'lucide-react';
import { Category } from '../../types/database';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { name: string; description?: string }) => Promise<void>;
  categoryToEdit?: Category | null;
}

export const CategoryModal: React.FC<CategoryModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  categoryToEdit,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (categoryToEdit) {
      setName(categoryToEdit.name);
      setDescription(categoryToEdit.description || '');
    } else {
      setName('');
      setDescription('');
    }
    setError(null);
  }, [categoryToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError('Please provide a category name');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSubmit({ name: cleanName, description: description.trim() });
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save category');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-ink/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-ivory rounded-[1.4rem] shadow-2xl border border-line overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-ink text-gold flex items-center justify-center">
              {categoryToEdit ? <Edit3 className="w-4 h-4" /> : <FolderPlus className="w-4 h-4" />}
            </div>
            <h3 className="font-serif text-2xl text-ink">
              {categoryToEdit ? 'Edit category' : 'New category'}
            </h3>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink p-1.5 rounded-full hover:bg-parchment">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-[11px] font-semibold text-ink uppercase tracking-[0.14em] mb-1.5">
              Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Traditional Mithai, Savoury Snacks..."
              className="input-luxury"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-ink uppercase tracking-[0.14em] mb-1.5">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief note for this category"
              className="input-luxury resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-3 border-t border-line">
            <button type="button" onClick={onClose} disabled={isSubmitting} className="btn-outline-gold">
              Cancel
            </button>
            <button type="submit" disabled={isSubmitting} className="btn-gold disabled:opacity-50">
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Saving...
                </>
              ) : (
                <span>{categoryToEdit ? 'Save changes' : 'Create category'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
