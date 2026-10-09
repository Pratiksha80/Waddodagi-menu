import React, { useState } from 'react';
import { X, Copy, Check, Database, ShieldCheck, Layers } from 'lucide-react';
import { SUPABASE_SQL_SCHEMA } from '../../services/supabaseSchema';
import { useToast } from '../common/Toast';

interface SupabaseGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SupabaseGuideModal: React.FC<SupabaseGuideModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const { showToast } = useToast();

  if (!isOpen) return null;

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
    setCopied(true);
    showToast('Supabase PostgreSQL SQL script copied!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />
      <div className="relative w-full max-w-2xl bg-ivory rounded-2xl shadow-2xl border border-[#e5d8b8] overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#e5d8b8] bg-parchment shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center font-bold">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#241a00]">Supabase PostgreSQL Schema</h3>
              <p className="text-[11px] text-[#745b00]">Zero-Sample Data Clean Architecture</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#4a4731] hover:text-[#241a00] p-1.5 rounded-lg hover:bg-black/5"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-4 text-left">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
            <h4 className="text-xs font-bold text-emerald-900 flex items-center gap-1.5 mb-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-700" />
              <span>Production Schema Prepared</span>
            </h4>
            <p className="text-xs text-emerald-800 leading-relaxed">
              The project is architected with complete database readiness. The tables below mirror the internal data models (<code className="font-mono bg-white px-1 py-0.5 rounded text-[11px]">categories</code> and <code className="font-mono bg-white px-1 py-0.5 rounded text-[11px]">products</code>) with zero initial sample items, ready to paste into your Supabase SQL editor.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 bg-white rounded-lg border border-[#ccc7aa]/60">
              <div className="font-bold text-[#241a00] flex items-center gap-1.5 mb-1">
                <Layers className="w-3.5 h-3.5 text-[#745b00]" />
                <span>categories table</span>
              </div>
              <ul className="text-[11px] text-[#4a4731] space-y-0.5 font-mono">
                <li>• id (UUID, PK)</li>
                <li>• name (VARCHAR)</li>
                <li>• description (TEXT)</li>
                <li>• created_at (TIMESTAMP)</li>
                <li>• updated_at (TIMESTAMP)</li>
              </ul>
            </div>
            <div className="p-3 bg-white rounded-lg border border-[#ccc7aa]/60">
              <div className="font-bold text-[#241a00] flex items-center gap-1.5 mb-1">
                <Layers className="w-3.5 h-3.5 text-[#745b00]" />
                <span>products table</span>
              </div>
              <ul className="text-[11px] text-[#4a4731] space-y-0.5 font-mono">
                <li>• id (UUID, PK)</li>
                <li>• category_id (FK - categories)</li>
                <li>• name (VARCHAR)</li>
                <li>• price (NUMERIC)</li>
                <li>• status ('available' | 'out_of_stock')</li>
              </ul>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#241a00] uppercase tracking-wider">
                SQL Migration Script (Supabase Editor)
              </span>
              <button
                onClick={handleCopySql}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#241a00] text-[#fdec00] rounded-md text-xs font-bold hover:bg-black transition"
              >
                {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                <span>{copied ? 'Copied!' : 'Copy SQL'}</span>
              </button>
            </div>
            <pre className="bg-[#1a1400] text-amber-200 p-4 rounded-xl text-[11px] font-mono overflow-x-auto max-h-60 border border-[#4a4731]">
              {SUPABASE_SQL_SCHEMA}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[#e5d8b8] bg-parchment flex items-center justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#241a00] text-[#fdec00] text-xs font-bold rounded-lg hover:bg-black transition"
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
