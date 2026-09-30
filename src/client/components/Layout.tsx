import React, { useState, useEffect } from 'react';
import {
  Laptop,
  Layers,
  Sparkles,
  ListTodo,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  RefreshCw,
} from 'lucide-react';
import { api } from '../lib/api.ts';
import { SystemStatusResponse } from '../../shared/types/index.ts';
import { Modal } from './ui/Modal.tsx';
import { StatusBadge } from './ui/StatusBadge.tsx';
import { ModelSelector } from './ModelSelector.tsx';

interface LayoutProps {
  currentTab: 'browse' | 'compare' | 'extract' | 'jobs' | 'report';
  onSelectTab: (tab: 'browse' | 'compare' | 'extract' | 'jobs' | 'report') => void;
  activeReportConfigId?: string | null;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({
  currentTab,
  onSelectTab,
  activeReportConfigId,
  children,
}) => {
  const [status, setStatus] = useState<SystemStatusResponse | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusModalOpen, setStatusModalOpen] = useState(false);

  const fetchStatus = async () => {
    setStatusLoading(true);
    try {
      const data = await api.getStatus();
      setStatus(data);
    } catch (err) {
      console.warn('Status check warning:', err);
    } finally {
      setStatusLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (st?: string) => {
    if (st === 'LIVE') return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />;
    if (st === 'WARNING') return <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />;
    if (st === 'ERROR') return <XCircle className="w-3.5 h-3.5 text-red-600" />;
    return <HelpCircle className="w-3.5 h-3.5 text-neutral-400" />;
  };

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] flex flex-col font-sans selection:bg-[#F27D26] selection:text-white">
      {/* Top Header Bar */}
      <header className="border-b-2 border-[#141414] bg-[#F9F8F6] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between h-14">
          {/* Logo & Brand Identity */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => onSelectTab('browse')}
              className="flex items-center space-x-2 text-left group cursor-pointer"
            >
              <div className="w-8 h-8 bg-[#141414] text-white flex items-center justify-center font-mono font-bold text-sm border border-[#141414] group-hover:bg-[#F27D26] transition-colors">
                AI
              </div>
              <div>
                <div className="flex items-center space-x-1.5">
                  <span className="font-mono font-bold text-sm tracking-tight text-[#141414] uppercase">
                    AI Laptop Review
                  </span>
                  <span className="font-mono text-[10px] px-1 py-0.2 bg-[#F27D26] text-white font-bold">
                    V2.0
                  </span>
                </div>
                <div className="font-mono text-[9px] text-neutral-500 uppercase tracking-widest hidden sm:block">
                  Verified Hardware Data Platform
                </div>
              </div>
            </button>
          </div>

          {/* Center Navigation Tabs */}
          <nav className="flex items-center space-x-1">
            <button
              onClick={() => onSelectTab('browse')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 font-mono text-xs uppercase tracking-wider font-semibold border transition-all cursor-pointer ${
                currentTab === 'browse'
                  ? 'bg-[#141414] text-white border-[#141414]'
                  : 'bg-transparent text-neutral-700 border-transparent hover:border-[#141414] hover:bg-white'
              }`}
            >
              <Laptop className="w-3.5 h-3.5" />
              <span>Browse</span>
            </button>

            <button
              onClick={() => onSelectTab('compare')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 font-mono text-xs uppercase tracking-wider font-semibold border transition-all cursor-pointer ${
                currentTab === 'compare'
                  ? 'bg-[#141414] text-white border-[#141414]'
                  : 'bg-transparent text-neutral-700 border-transparent hover:border-[#141414] hover:bg-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Compare</span>
            </button>

            <button
              onClick={() => onSelectTab('extract')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 font-mono text-xs uppercase tracking-wider font-semibold border transition-all cursor-pointer ${
                currentTab === 'extract'
                  ? 'bg-[#141414] text-white border-[#141414]'
                  : 'bg-transparent text-neutral-700 border-transparent hover:border-[#141414] hover:bg-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-[#F27D26]" />
              <span>Extract</span>
            </button>

            <button
              onClick={() => onSelectTab('jobs')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 font-mono text-xs uppercase tracking-wider font-semibold border transition-all cursor-pointer ${
                currentTab === 'jobs'
                  ? 'bg-[#141414] text-white border-[#141414]'
                  : 'bg-transparent text-neutral-700 border-transparent hover:border-[#141414] hover:bg-white'
              }`}
            >
              <ListTodo className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Jobs</span>
            </button>

            {activeReportConfigId && (
              <button
                onClick={() => onSelectTab('report')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 font-mono text-xs uppercase tracking-wider font-semibold border transition-all cursor-pointer ${
                  currentTab === 'report'
                    ? 'bg-[#141414] text-white border-[#141414]'
                    : 'bg-neutral-100 text-[#141414] border-[#141414]'
                }`}
              >
                <span>Report</span>
              </button>
            )}
          </nav>

          {/* Right Status & System Tools */}
          <div className="flex items-center space-x-2">
            {/* System Status Button */}
            <button
              onClick={() => setStatusModalOpen(true)}
              title="System Connectivity Diagnostics"
              className="flex items-center space-x-1.5 px-2.5 py-1 border border-[#141414] bg-white hover:bg-[#EBEAE7] text-xs font-mono transition-colors cursor-pointer"
            >
              <Activity className="w-3.5 h-3.5 text-neutral-600" />
              <span className="hidden md:inline font-bold">SYSTEM</span>
              {status ? (
                <div className="flex items-center space-x-1">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      status.application.status === 'LIVE'
                        ? 'bg-emerald-500'
                        : status.application.status === 'WARNING'
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                    }`}
                  />
                  <span className="text-[10px] text-neutral-600">
                    {status.application.status}
                  </span>
                </div>
              ) : (
                <span className="text-[10px] text-neutral-400">...</span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t-2 border-[#141414] bg-[#F9F8F6] py-4 px-6 mt-auto">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between text-xs font-mono text-neutral-600 space-y-2 sm:space-y-0">
          <div>
            AI Laptop Review Platform V2 —{' '}
            <span className="text-[#141414] font-semibold">
              AI Assists Data Collection. Human Verification Ensures Trust.
            </span>
          </div>
          <div className="flex items-center space-x-4">
            <span>Supabase Postgres</span>
            <span>•</span>
            <span>Gemini 3.8 Flash</span>
            <span>•</span>
            <span>Zero Hallucination Protocol</span>
          </div>
        </div>
      </footer>

      {/* System Status Diagnostics Modal */}
      <Modal
        isOpen={statusModalOpen}
        onClose={() => setStatusModalOpen(false)}
        title="Live System Diagnostics & Model Selector"
        maxWidth="lg"
      >
        <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-300">
            <div>
              <p className="font-mono text-xs text-neutral-500 uppercase">Architecture</p>
              <p className="font-bold text-sm">Full-Stack TypeScript (V2)</p>
            </div>
            <button
              onClick={fetchStatus}
              disabled={statusLoading}
              className="flex items-center space-x-1 px-2.5 py-1 text-xs font-mono border border-[#141414] bg-white hover:bg-neutral-100 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${statusLoading ? 'animate-spin' : ''}`} />
              <span>Retest System</span>
            </button>
          </div>

          {/* Split Supabase Diagnostics: 1. Connection */}
          <div className="border border-[#141414] p-3 bg-white space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold uppercase tracking-wider">
                1. Supabase PostgreSQL Connection
              </span>
              {status && (
                <StatusBadge
                  status={status.supabase.connectionStatus || (status.supabase.reachable ? 'LIVE' : 'ERROR')}
                  size="sm"
                />
              )}
            </div>
            <p className="text-xs text-neutral-600">
              Direct connection verification to Supabase backend via server service role client.
            </p>
            {status?.supabase.latencyMs != null && (
              <p className="font-mono text-[11px] text-neutral-500">
                Connection Latency: <span className="font-bold text-neutral-800">{status.supabase.latencyMs}ms</span>
              </p>
            )}
            {status?.supabase.error && !status.supabase.schemaDetails && (
              <p className="font-mono text-[10px] text-red-600 bg-red-50 p-1.5 border border-red-200 break-words">
                {status.supabase.error}
              </p>
            )}
          </div>

          {/* Split Supabase Diagnostics: 2. Schema Contract */}
          <div className="border border-[#141414] p-3 bg-white space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs font-bold uppercase tracking-wider">
                2. Supabase Database Schema Contract
              </span>
              {status && (
                <StatusBadge
                  status={status.supabase.schemaStatus || 'HEALTHY'}
                  size="sm"
                />
              )}
            </div>

            {status?.supabase.schemaStatus === 'SCHEMA_MISMATCH' ? (
              <div className="space-y-2 text-xs">
                <p className="text-amber-800 font-mono text-[11px] bg-amber-50 p-2 border border-amber-300">
                  Database connected, but schema is missing required V2 columns, tables, or atomic RPC functions.
                </p>

                {status.supabase.schemaDetails && (
                  <div className="space-y-1 font-mono text-[11px] bg-neutral-50 p-2 border border-neutral-300">
                    {status.supabase.schemaDetails.missingTables?.length > 0 && (
                      <p className="text-red-700">
                        • Missing Tables: <span className="font-bold">{status.supabase.schemaDetails.missingTables.join(', ')}</span>
                      </p>
                    )}
                    {status.supabase.schemaDetails.missingColumns?.length > 0 && (
                      <p className="text-amber-700">
                        • Missing Columns: <span className="font-bold">{status.supabase.schemaDetails.missingColumns.map(c => `${c.table}.${c.column}`).join(', ')}</span>
                      </p>
                    )}
                    {status.supabase.schemaDetails.missingFunctions?.length > 0 && (
                      <p className="text-red-700">
                        • Missing RPC: <span className="font-bold">{status.supabase.schemaDetails.missingFunctions.join(', ')}</span>
                      </p>
                    )}
                  </div>
                )}

                <div className="border border-neutral-300 p-2 bg-neutral-100 font-mono text-[11px]">
                  <p className="font-bold text-neutral-800 mb-1">Required Remediation Migration:</p>
                  <code className="block bg-white p-1.5 border border-neutral-300 text-neutral-900 select-all break-all">
                    {status.supabase.schemaDetails?.remedyMigration || 'supabase/migrations/20260922000002_v2_schema_contract.sql'}
                  </code>
                  <p className="text-[10px] text-neutral-600 mt-1">
                    Execute this SQL script inside your Supabase project SQL editor to align all tables and enable atomic RPC commits.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-neutral-600">
                All V2 database tables, columns, constraints, and stored procedures are in full alignment.
              </p>
            )}
          </div>

          {/* AI Model: Gemini Health & Model Selector */}
          <div className="border border-[#141414] p-3 bg-white space-y-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-mono text-xs font-bold uppercase tracking-wider">
                3. Google Gemini AI Models & Health
              </span>
              {status && (
                <StatusBadge
                  status={
                    status.gemini.status === 'LIVE'
                      ? 'CONNECTED'
                      : status.gemini.status === 'AUTH_ERROR'
                      ? 'AUTH_ERROR'
                      : status.gemini.status === 'QUOTA_LIMITED'
                      ? 'QUOTA_LIMITED'
                      : status.gemini.status === 'WARNING'
                      ? 'HIGH_DEMAND'
                      : status.gemini.status
                  }
                  size="sm"
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 font-mono text-xs">
              <div className="p-2 border border-neutral-200 bg-neutral-50">
                <span className="text-[10px] text-neutral-500 uppercase block">Gemini Authentication</span>
                <span className="font-bold text-neutral-800">
                  {status?.gemini.status === 'LIVE' || status?.gemini.status === 'WARNING' || status?.gemini.status === 'QUOTA_LIMITED'
                    ? 'CONNECTED'
                    : status?.gemini.status === 'AUTH_ERROR'
                    ? 'AUTH FAILED (401)'
                    : status?.gemini.status === 'NOT_CONFIGURED'
                    ? 'NOT CONFIGURED'
                    : status?.gemini.status || 'CHECKING'}
                </span>
              </div>
              <div className="p-2 border border-neutral-200 bg-neutral-50">
                <span className="text-[10px] text-neutral-500 uppercase block">Current Active Model</span>
                <span className="font-bold text-[#F27D26]">
                  {status?.gemini.model || 'gemini-3.8-flash'}
                </span>
                {status?.gemini.latencyMs != null && (
                  <span className="text-[10px] text-neutral-500 ml-1">({status.gemini.latencyMs}ms)</span>
                )}
              </div>
            </div>

            {status?.gemini.error && (
              <p className="font-mono text-[10px] text-red-600 bg-red-50 p-2 border border-red-200 break-words">
                {status.gemini.error}
              </p>
            )}

            {/* Embedded Full Model Selector */}
            <div className="pt-2 border-t border-neutral-200">
              <ModelSelector
                mode="full"
                showSetActive={true}
                onSelectModel={async (modelId) => {
                  try {
                    await api.setActiveModel(modelId);
                    fetchStatus();
                  } catch (e) {
                    console.error(e);
                  }
                }}
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
