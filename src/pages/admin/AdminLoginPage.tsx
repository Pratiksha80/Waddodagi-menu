import React, { useState } from 'react';
import { Lock, Mail, Store, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigation } from '../../context/NavigationContext';
import { useToast } from '../../components/common/Toast';
import { GoldFlourish } from '../../components/common/GoldFlourish';

export const AdminLoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { login } = useAuth();
  const { navigate } = useNavigation();
  const { showToast } = useToast();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await login(email, password);
      if (res.success) {
        showToast('Logged in successfully', 'success');
        navigate('/admin/dashboard');
      } else {
        setError(res.error || 'Invalid credentials');
      }
    } catch (err: any) {
      setError(err?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-36px)] grid lg:grid-cols-2 bg-cream">
      <div className="relative hidden lg:block overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1601050690597-df0568f70950?auto=format&fit=crop&w=1400&q=80"
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/70 to-ink/30" />
        <div className="relative z-10 h-full flex flex-col justify-end p-12 text-ivory">
          <p className="text-[11px] tracking-[0.3em] uppercase text-gold-light">Private atelier</p>
          <h1 className="font-serif text-5xl mt-3 leading-tight">
            Compose the house menu
          </h1>
          <GoldFlourish className="w-36 mt-5 mx-0 text-gold-light" />
          <p className="mt-4 max-w-sm text-sm text-ivory/70 leading-relaxed">
            Add collections, prices, and availability. Guests scanning the table QR see every change instantly.
          </p>
        </div>
      </div>

      <div className="flex flex-col justify-center py-12 px-6 sm:px-12">
        <div className="max-w-md w-full mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 rounded-full bg-ink text-gold flex items-center justify-center">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <p className="font-serif text-2xl text-ink">Owner sign in</p>
              <p className="text-[11px] tracking-[0.16em] uppercase text-muted">Shakeer</p>
            </div>
          </div>

          <form className="space-y-5" onSubmit={handleLogin}>
            {error && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-medium">
                {error}
              </div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-ink uppercase tracking-[0.16em] mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@sweetshop.com"
                  className="input-luxury !pl-12"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-ink uppercase tracking-[0.16em] mb-1.5">
                  Password
              </label>
              <div className="relative">
                <Lock className="h-4 w-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-luxury !pl-12 !pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-gold py-3.5 text-sm disabled:opacity-60"
            >
              {loading ? 'Authenticating...' : 'log in'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
