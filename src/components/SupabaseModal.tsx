import React, { useState } from 'react';
import { Database, CheckCircle, Copy, Check, Key, ExternalLink } from 'lucide-react';
import { getSupabaseCredentials, saveSupabaseCredentials, SUPABASE_SQL_DDL } from '../lib/supabase';

interface SupabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCredentialsUpdated: () => void;
}

export const SupabaseModal: React.FC<SupabaseModalProps> = ({
  isOpen,
  onClose,
  onCredentialsUpdated
}) => {
  const currentCreds = getSupabaseCredentials();
  const [url, setUrl] = useState(currentCreds.url);
  const [key, setKey] = useState(currentCreds.key);
  const [activeTab, setActiveTab] = useState<'config' | 'schema'>('config');
  const [copied, setCopied] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveSupabaseCredentials(url, key);
    setSavedSuccess(true);
    onCredentialsUpdated();
    setTimeout(() => {
      setSavedSuccess(false);
      onClose();
    }, 1200);
  };

  const handleCopySQL = () => {
    navigator.clipboard.writeText(SUPABASE_SQL_DDL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="bg-white border border-[#E2B59A]/60 rounded-2xl max-w-2xl w-full shadow-xl overflow-hidden text-[#2C221E] animate-in fade-in zoom-in duration-200">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-[#FAF7F2] border-b border-[#E2B59A]/40 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-[#FFE1AF] text-[#B77466] border border-[#E2B59A]">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-[#2C221E]">Supabase PostgreSQL Integration</h3>
              <p className="text-xs text-[#957C62]">Database Connection & DDL Migrations</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-[#957C62] hover:text-[#2C221E] text-lg font-bold px-2 py-1"
          >
            ✕
          </button>
        </div>

        {/* Tab Toggle */}
        <div className="flex border-b border-[#E2B59A]/40 bg-[#FAF7F2]/50 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('config')}
            className={`flex-1 py-3 px-4 text-center border-b-2 transition-colors ${
              activeTab === 'config'
                ? 'border-[#B77466] text-[#B77466] bg-white font-bold'
                : 'border-transparent text-[#957C62] hover:text-[#2C221E]'
            }`}
          >
            Connection Settings
          </button>
          <button
            onClick={() => setActiveTab('schema')}
            className={`flex-1 py-3 px-4 text-center border-b-2 transition-colors ${
              activeTab === 'schema'
                ? 'border-[#B77466] text-[#B77466] bg-white font-bold'
                : 'border-transparent text-[#957C62] hover:text-[#2C221E]'
            }`}
          >
            SQL DDL Schema Export
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 max-h-[70vh] overflow-y-auto">
          {activeTab === 'config' ? (
            <form onSubmit={handleSave} className="space-y-4">
              <p className="text-xs text-[#2C221E] leading-relaxed">
                Connect your live <strong className="text-[#B77466]">Supabase Managed PostgreSQL</strong> database for production persistence across claims, fraud audit logs, and policy records. If left unconfigured, ClaimX uses its high-fidelity local state engine.
              </p>

              <div>
                <label className="block text-xs font-medium text-[#957C62] mb-1">
                  Supabase Project URL
                </label>
                <input
                  type="text"
                  placeholder="https://your-project-id.supabase.co"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F2] border border-[#E2B59A]/60 text-[#2C221E] text-xs focus:outline-none focus:border-[#B77466]"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-[#957C62] mb-1">
                  Supabase Anon API Key
                </label>
                <div className="relative">
                  <input
                    type="password"
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-[#FAF7F2] border border-[#E2B59A]/60 text-[#2C221E] text-xs focus:outline-none focus:border-[#B77466]"
                  />
                  <Key className="w-4 h-4 text-[#957C62] absolute left-3 top-3" />
                </div>
              </div>

              {savedSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center space-x-2 text-emerald-800 text-xs">
                  <CheckCircle className="w-4 h-4 text-emerald-600" />
                  <span>Supabase credentials saved successfully! Client reloaded.</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-between">
                <a
                  href="https://supabase.com/dashboard"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-[#B77466] hover:underline flex items-center space-x-1"
                >
                  <span>Open Supabase Dashboard</span>
                  <ExternalLink className="w-3 h-3" />
                </a>

                <button
                  type="submit"
                  className="px-5 py-2.5 bg-[#B77466] hover:bg-[#A36254] text-white font-bold text-xs rounded-xl shadow-xs transition-all"
                >
                  Save Connection Settings
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-[#957C62]">
                  PostgreSQL DDL Migration Script
                </span>
                <button
                  onClick={handleCopySQL}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#FAF7F2] hover:bg-[#FFE1AF]/40 text-xs font-medium text-[#B77466] border border-[#E2B59A]/60 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied to Clipboard' : 'Copy SQL'}</span>
                </button>
              </div>

              <pre className="p-4 rounded-xl bg-[#FAF7F2] border border-[#E2B59A]/60 text-[11px] text-[#2C221E] font-mono overflow-x-auto max-h-72 leading-relaxed">
                {SUPABASE_SQL_DDL}
              </pre>

              <p className="text-[11px] text-[#957C62]">
                Paste and execute this SQL snippet into your Supabase SQL Editor to provision the <code className="text-[#2C221E]">claims</code>, <code className="text-[#2C221E]">policy_holder_data</code>, and <code className="text-[#2C221E]">fraud_logs</code> schema tables.
              </p>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
