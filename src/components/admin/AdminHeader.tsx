import React from 'react';
import { Menu as MenuIcon, BookOpen } from 'lucide-react';
import { useNavigation } from '../../context/NavigationContext';

interface AdminHeaderProps {
  title: string;
  subtitle?: string;
  onOpenMobileMenu: () => void;
  actionButton?: React.ReactNode;
}

export const AdminHeader: React.FC<AdminHeaderProps> = ({
  title,
  subtitle,
  onOpenMobileMenu,
  actionButton,
}) => {
  const { navigate } = useNavigation();

  return (
    <header className="sticky top-0 z-30 bg-cream/90 backdrop-blur-xl border-b border-line px-4 sm:px-8 py-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenMobileMenu}
            className="md:hidden p-2 text-ink hover:bg-parchment rounded-full"
            aria-label="Open navigation menu"
          >
            <MenuIcon className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl sm:text-3xl font-serif text-ink tracking-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs text-muted mt-1 font-medium">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => navigate('/menu')}
            className="hidden sm:inline-flex items-center gap-2 px-3.5 py-2 rounded-full border border-gold/35 bg-ivory hover:bg-parchment text-xs font-semibold text-gold-deep transition"
          >
            <BookOpen className="w-4 h-4" />
            Menu
          </button>

          {actionButton}
        </div>
      </div>
    </header>
  );
};
