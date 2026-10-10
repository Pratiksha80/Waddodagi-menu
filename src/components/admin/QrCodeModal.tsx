import React, { useState } from 'react';
import { X, Copy, Check, Printer } from 'lucide-react';
import { QrCodeSvg } from '../common/QrCodeSvg';
import { useToast } from '../common/Toast';

interface QrCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QrCodeModal: React.FC<QrCodeModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();

  if (!isOpen) return null;

  const menuUrl = 'https://waddodagi-menu.onrender.com/menu';

  const handleCopy = () => {
    navigator.clipboard.writeText(menuUrl).catch(() => {
      showToast('Could not copy the menu URL. Please copy it manually.', 'info');
    });
    setCopied(true);
    showToast('Customer Menu URL copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-ink/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-ivory rounded-[1.6rem] shadow-2xl border border-line overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-line">
          <div className="flex items-center gap-2">
              <img
                src="/waddodagi-logo.png"
                alt="Waddodagi Sweets and Snacks logo"
                className="w-9 h-9 shrink-0 rounded-full object-contain"
              />
            <div>
              <h3 className="font-serif text-xl text-ink">Table standee</h3>
              <p className="text-[11px] text-muted">Permanent live QR</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted hover:text-ink p-1.5 rounded-full hover:bg-parchment">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 text-center space-y-4">
          <div className="p-7 rounded-[1.4rem] bg-ink text-ivory">
            <p className="text-[10px] tracking-[0.28em] uppercase text-gold">Scan to dine</p>
            <h4 className="font-serif text-3xl mt-2">Waddodagi</h4>
            <div className="flex justify-center my-5 bg-ivory rounded-2xl p-3 w-fit mx-auto">
              <QrCodeSvg value={menuUrl} size={180} />
            </div>
            <p className="text-[11px] font-mono text-gold-light/70 truncate">{menuUrl}</p>
          </div>

          <p className="text-[11px] text-muted leading-relaxed text-left">
            This permanent link opens the shared live menu. Owner changes appear for customers after saving. Keep this same QR code as long as your website address stays the same.
          </p>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <button onClick={handleCopy} className="btn-outline-gold">
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copied' : 'Copy URL'}
            </button>
            <button onClick={handlePrint} className="btn-gold">
              <Printer className="w-4 h-4" />
              Print
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
