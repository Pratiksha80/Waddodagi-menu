import React from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Share2,
  Image as ImageIcon,
  ShieldCheck,
} from 'lucide-react';
import { CustomerLayout } from '../../components/customer/CustomerLayout';
import { useMenu } from '../../context/MenuContext';
import { useNavigation } from '../../context/NavigationContext';
import { useToast } from '../../components/common/Toast';
import { GoldFlourish } from '../../components/common/GoldFlourish';

export const CustomerProductDetailsPage: React.FC = () => {
  const { products, categories } = useMenu();
  const { navigate, getParam } = useNavigation();
  const { showToast } = useToast();

  const productId = getParam('id');
  const product = products.find((p) => p.id === productId);
  const category = categories.find((c) => c.id === product?.category_id);

  if (!product) {
    return (
      <CustomerLayout>
        <div className="py-20 text-center max-w-md mx-auto px-4">
          <AlertCircle className="w-10 h-10 text-gold mx-auto mb-3" />
          <h2 className="font-serif text-3xl text-ink mb-2">Item not found</h2>
          <p className="text-sm text-muted mb-6">
            This piece may have been updated or removed from the live menu.
          </p>
          <button onClick={() => navigate('/menu')} className="btn-gold">
            Return to menu
          </button>
        </div>
      </CustomerLayout>
    );
  }

  const isOutOfStock = product.status === 'out_of_stock';

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `${product.name} - Mithai & Namkeen`,
        text: `Check out ${product.name} on our digital menu!`,
        url: window.location.href,
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(window.location.href);
      showToast('Item link copied to clipboard!', 'info');
    }
  };

  return (
    <CustomerLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-8 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate('/menu')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted hover:text-ink transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to menu
          </button>
          <button
            onClick={handleShare}
            className="btn-outline-gold"
          >
            <Share2 className="w-3.5 h-3.5" />
            Share
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 overflow-hidden rounded-[1.8rem] border border-line bg-ivory shadow-[0_30px_80px_rgba(20,12,8,0.08)]">
          <div className="relative min-h-[320px] bg-parchment flex items-center justify-center">
            {product.image_url ? (
              <img
                src={product.image_url}
                alt={product.name}
                className={`w-full h-full object-cover absolute inset-0 ${isOutOfStock ? 'grayscale' : ''}`}
              />
            ) : (
              <div className="p-8 text-center text-gold-deep/50">
                <ImageIcon className="w-16 h-16 mx-auto mb-2" />
                <span className="text-[10px] tracking-[0.2em] uppercase font-medium">
                  Freshly prepared item
                </span>
              </div>
            )}
            <div className="absolute top-4 left-4">
              {isOutOfStock ? (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-rose-700 text-white">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Sold out today
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-emerald-800 text-emerald-50">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Available today
                </span>
              )}
            </div>
          </div>

          <div className="p-7 sm:p-10 flex flex-col justify-between">
            <div>
              {category && (
                <button
                  onClick={() => navigate(`/menu/category/${category.id}`)}
                  className="text-[11px] tracking-[0.2em] uppercase text-gold-deep font-semibold hover:text-ink"
                >
                  {category.name}
                </button>
              )}
              <h1 className="mt-2 font-serif text-4xl text-ink leading-tight">{product.name}</h1>
              <GoldFlourish className="w-28 mt-4 mx-0" />
              <p className="mt-5 text-sm text-muted leading-relaxed">
                {product.description ||
                  'Handcrafted in our kitchen with authentic ingredients, pure ghee, and traditional techniques.'}
              </p>
              <div className="mt-8">
                <span className="text-[10px] tracking-[0.2em] uppercase text-gold-deep font-medium">Price, tax included</span>
                <p className="font-serif text-5xl text-ink mt-1">₹{product.price.toFixed(0)}</p>
              </div>
            </div>

            <div className="mt-8 p-4 rounded-2xl bg-cream border border-line">
              <div className="flex items-center gap-2 text-sm font-medium text-ink">
                <ShieldCheck className="w-4 h-4 text-gold" />
                House promise
              </div>
              <p className="text-xs text-muted mt-2 leading-relaxed">
                To order this piece or request gift packaging, please speak with our counter staff or scan the table QR.
              </p>
            </div>
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
};
