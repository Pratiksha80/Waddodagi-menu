import React from 'react';
import {
  LayoutDashboard,
  FolderTree,
  ShoppingBag,
  BookOpen,
  PlusCircle,
  ExternalLink,
  LogOut
} from 'lucide-react';
import { useNavigation } from '../../context/NavigationContext';
import { useAuth } from '../../context/AuthContext';

interface AdminSidebarProps {
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const AdminSidebar: React.FC<AdminSidebarProps> = ({
  isMobileOpen = false,
  onCloseMobile,
}) => {
  const { path, navigate } = useNavigation();
  const { user, logout } = useAuth();

  const navItems = [
    { label: 'Dashboard', icon: LayoutDashboard, route: '/admin/dashboard' },
    { label: 'Categories', icon: FolderTree, route: '/admin/categories' },
    { label: 'Menu Items', icon: ShoppingBag, route: '/admin/products' },
  ];

  const handleNavigate = (route: string) => {
    navigate(route);
    if (onCloseMobile) onCloseMobile();
  };

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  const content = (
    <aside className="w-64 bg-ink text-ivory flex flex-col h-full border-r border-gold/15">
      <div className="p-6 border-b border-gold/15 flex items-center gap-3">
        <img
          src="/waddodagi-logo.png"
          alt="Waddodagi Sweets and Snacks logo"
          className="w-11 h-11 shrink-0 rounded-full object-contain shadow-[0_0_20px_rgba(196,163,90,0.3)]"
        />
        <div>
          <h1 className="font-serif text-xl leading-tight text-ivory">Shakeer</h1>
          <span className="text-[10px] tracking-[0.18em] uppercase text-gold/80">Owner atelier</span>
        </div>
      </div>

      <div className="flex-1 py-5 px-3 space-y-1">
        <div className="px-3 pb-2 text-[10px] font-semibold tracking-[0.2em] text-gold/50 uppercase">
          Catalogue
        </div>
        {navItems.map((item) => {
          const isActive = path === item.route || (item.route === '/admin/products' && path.startsWith('/admin/products/edit'));
          const Icon = item.icon;
          return (
            <button
              key={item.route}
              onClick={() => handleNavigate(item.route)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-full text-sm transition-all text-left ${
                isActive
                  ? 'bg-gold text-ink font-semibold'
                  : 'text-ivory/75 hover:bg-white/5 hover:text-ivory'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-ink' : 'text-gold'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}

        <div className="pt-6 px-3 pb-2 text-[10px] font-semibold tracking-[0.2em] text-gold/50 uppercase">
          Menu
        </div>

        <button
          onClick={() => handleNavigate('/menu')}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-full text-sm text-ivory/75 hover:bg-white/5 hover:text-ivory transition-all text-left"
        >
          <BookOpen className="w-4 h-4 text-gold shrink-0" />
          Menu
        </button>

      </div>

      <div className="p-4 border-t border-gold/15 bg-black/20">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-ivory truncate">
              {user?.name || 'Shakeer'}
            </p>
            <p className="text-[11px] text-gold-light/60 truncate">
              {user?.email || 'shakeer@sweetshop.com'}
            </p>
          </div>
          <button
            onClick={handleLogout}
            title="Log out"
            className="p-2 text-gold-light/60 hover:text-rose-300 hover:bg-white/10 rounded-full transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden md:block shrink-0 h-screen sticky top-0">
        {content}
      </div>

      {isMobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onCloseMobile}
          />
          <div className="relative z-10 w-72 h-full">
            {content}
          </div>
        </div>
      )}
    </>
  );
};
