import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Save,
  Trash2,
  AlertTriangle,
  Layers,
  Plus,
  X,
  CheckCircle2,
  RefreshCw,
  ShoppingBag,
  Cpu,
  Gamepad2,
  Thermometer,
  Monitor,
  Battery,
  FileText,
} from 'lucide-react';
import { api } from '../lib/api.ts';
import type {
  ExtractedDataPayload,
  ConfigurationMatchResult,
  BenchmarkResult,
  GamingResult,
  ThermalResult,
} from '../../shared/types/index.ts';
import { Panel } from '../components/ui/Panel.tsx';
import { StatusBadge } from '../components/ui/StatusBadge.tsx';

interface ReviewPageProps {
  jobId: string;
  onCommitSuccess: (configurationId: string) => void;
  onCancel: () => void;
}

export const ReviewPage: React.FC<ReviewPageProps> = ({
  jobId,
  onCommitSuccess,
  onCancel,
}) => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ExtractedDataPayload | null>(null);
  const [matches, setMatches] = useState<ConfigurationMatchResult[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);

  // Retail inputs
  const [amazonUrl, setAmazonUrl] = useState('');
  const [flipkartUrl, setFlipkartUrl] = useState('');
  const [amazonManualPrice, setAmazonManualPrice] = useState<string>('');
  const [flipkartManualPrice, setFlipkartManualPrice] = useState<string>('');
  const [manualImageUrl, setManualImageUrl] = useState('');
  const [retailPreview, setRetailPreview] = useState<{
    amazon?: any;
    flipkart?: any;
  }>({});
  const [previewingRetail, setPreviewingRetail] = useState(false);

  // Active section tab for review
  const [activeTab, setActiveTab] = useState<
    'specs' | 'benchmarks' | 'gaming' | 'thermals' | 'display_battery' | 'verdict' | 'retail'
  >('specs');

  // Load Job and Matches
  useEffect(() => {
    let isSubscribed = true;

    async function loadData() {
      setLoading(true);
      try {
        const job = await api.getJob(jobId);
        if (!isSubscribed) return;

        if (job.raw_extraction) {
          setData(job.raw_extraction);
        }

        // Fetch matches
        try {
          const matchRes = await api.getJobMatches(jobId);
          if (isSubscribed && matchRes.matches) {
            setMatches(matchRes.matches);
            const exact = matchRes.matches.find((m) => m.classification === 'EXACT MATCH');
            if (exact && exact.matchedConfiguration) {
              setSelectedConfigId(exact.matchedConfiguration.id);
            }
          }
        } catch (matchErr) {
          console.warn('Match fetching notice:', matchErr);
        }
      } catch (err: any) {
        if (!isSubscribed) return;
        setCommitError(err.message || 'Failed to load extraction job');
      } finally {
        if (isSubscribed) setLoading(false);
      }
    }

    loadData();

    return () => {
      isSubscribed = false;
    };
  }, [jobId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-16 space-y-3 font-mono text-xs">
        <RefreshCw className="w-6 h-6 animate-spin text-[#F27D26]" />
        <span>Loading extracted data for human verification...</span>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 border-2 border-red-600 bg-red-50 text-red-800 font-mono text-xs space-y-4">
        <p className="font-bold">Error loading extraction payload.</p>
        <p>{commitError || 'No extraction data available.'}</p>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-[#141414] text-white hover:bg-neutral-800 cursor-pointer"
        >
          Return to Extract
        </button>
      </div>
    );
  }

  // Spec update helpers
  const updateLaptopIdentity = (field: keyof ExtractedDataPayload['laptop'], val: string) => {
    setData((prev) => (prev ? { ...prev, laptop: { ...prev.laptop, [field]: val } } : prev));
  };

  const updateConfigField = (field: keyof ExtractedDataPayload['configuration'], val: any) => {
    setData((prev) =>
      prev ? { ...prev, configuration: { ...prev.configuration, [field]: val } } : prev
    );
  };

  const updateDisplayField = (field: keyof NonNullable<ExtractedDataPayload['display']>, val: any) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            display: {
              ...(prev.display || {}),
              [field]: val,
            },
          }
        : prev
    );
  };

  const updateBatteryField = (field: keyof NonNullable<ExtractedDataPayload['battery']>, val: any) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            battery: {
              ...(prev.battery || {}),
              [field]: val,
            },
          }
        : prev
    );
  };

  const updateReviewMeta = (field: keyof ExtractedDataPayload['review_meta'], val: any) => {
    setData((prev) =>
      prev
        ? {
            ...prev,
            review_meta: {
              ...prev.review_meta,
              [field]: val,
            },
          }
        : prev
    );
  };

  // Preview retail URL scraper
  const handlePreviewRetail = async (retailer: 'amazon' | 'flipkart', url: string) => {
    if (!url.trim()) return;
    setPreviewingRetail(true);
    try {
      const res = await api.previewRetailUrl(url.trim());
      setRetailPreview((prev) => ({ ...prev, [retailer]: res.result }));
    } catch (err: any) {
      console.warn(`Retail preview error for ${retailer}:`, err);
    } finally {
      setPreviewingRetail(false);
    }
  };

  // Final Commit Handler
  const handleCommit = async () => {
    setIsCommitting(true);
    setCommitError(null);

    try {
      const payload = {
        data,
        useExistingConfigId: selectedConfigId,
        reviewerIdentity: 'admin_reviewer',
        retailListings: {
          amazonUrl: amazonUrl.trim() || null,
          flipkartUrl: flipkartUrl.trim() || null,
          manualImageUrl: manualImageUrl.trim() || null,
          amazonManualPrice: amazonManualPrice ? parseFloat(amazonManualPrice) : null,
          flipkartManualPrice: flipkartManualPrice ? parseFloat(flipkartManualPrice) : null,
        },
      };

      const result = await api.commitJob(jobId, payload);
      onCommitSuccess(result.configuration_id);
    } catch (err: any) {
      setCommitError(err.message || 'Transaction commit failed');
    } finally {
      setIsCommitting(false);
    }
  };

  const handleDiscard = async () => {
    if (!confirm('Are you sure you want to discard this extraction?')) return;
    try {
      await api.discardJob(jobId);
      onCancel();
    } catch (err: any) {
      alert(err.message || 'Discard failed');
    }
  };

  // Missing spec warnings
  const missingSpecs: string[] = [];
  if (!data.configuration.cpu) missingSpecs.push('CPU Processor');
  if (!data.configuration.gpu) missingSpecs.push('GPU Graphics');
  if (!data.configuration.ram_gb) missingSpecs.push('RAM Capacity');
  if (!data.configuration.storage_gb) missingSpecs.push('Storage Capacity');
  if (!data.configuration.display_resolution) missingSpecs.push('Display Resolution');

  return (
    <div className="space-y-6">
      {/* Human Review Banner */}
      <div className="border-2 border-[#141414] bg-[#F9F8F6] p-4 sm:p-5 shadow-[4px_4px_0px_#141414]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 font-mono text-[10px] uppercase font-bold bg-[#141414] text-white">
                <ShieldCheck className="w-3 h-3 text-[#F27D26]" />
                <span>Human Verification Protocol</span>
              </span>
              <span className="font-mono text-xs text-neutral-500">Job: {jobId.slice(0, 8)}</span>
            </div>
            <h1 className="font-serif text-2xl font-bold text-[#141414] mt-1">
              Verify & Confirm Extraction: {data.laptop.brand} {data.laptop.model}
            </h1>
            <p className="text-xs text-neutral-600 mt-0.5">
              Reviewer: <strong>{data.review_meta.reviewer}</strong> • Video: &ldquo;
              {data.review_meta.title}&rdquo;
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={handleDiscard}
              disabled={isCommitting}
              className="px-3.5 py-2 border-2 border-red-700 text-red-700 hover:bg-red-50 font-mono text-xs uppercase font-bold transition-colors cursor-pointer flex items-center space-x-1"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Discard</span>
            </button>

            <button
              onClick={handleCommit}
              disabled={isCommitting}
              className="px-5 py-2 bg-[#141414] text-white hover:bg-[#F27D26] disabled:opacity-40 font-mono text-xs uppercase font-bold tracking-wider transition-colors cursor-pointer flex items-center space-x-2 border-2 border-[#141414]"
            >
              {isCommitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Committing...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Confirm & Commit to DB</span>
                </>
              )}
            </button>
          </div>
        </div>

        {commitError && (
          <div className="mt-4 p-3 border-2 border-red-600 bg-red-50 text-red-800 text-xs font-mono">
            <strong>Commit Notice: </strong>
            <span>{commitError}</span>
          </div>
        )}
      </div>

      {/* Missing Spec Warnings */}
      {missingSpecs.length > 0 && (
        <div className="p-3 border-2 border-amber-600 bg-amber-50 text-amber-900 text-xs font-mono flex items-start space-x-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <strong>Missing Specs in Review: </strong>
            <span>The video did not explicitly test or state: {missingSpecs.join(', ')}. Stored strictly as NULL per zero-guessing policy.</span>
          </div>
        </div>
      )}

      {/* Configuration Matching Section */}
      <Panel
        title="Configuration Matching & Deduplication"
        badge={<Layers className="w-4 h-4 text-[#F27D26]" />}
      >
        <div className="space-y-3">
          <p className="text-xs text-neutral-600">
            Compare candidate configurations in the database. Choose whether to associate this review
            with an existing verified configuration or create a new distinct hardware profile.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Create as New Option */}
            <div
              onClick={() => setSelectedConfigId(null)}
              className={`border-2 p-3.5 cursor-pointer transition-colors ${
                selectedConfigId === null
                  ? 'border-[#F27D26] bg-[#FFF9F3]'
                  : 'border-[#141414] bg-white hover:bg-neutral-50'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-mono text-xs font-bold uppercase">
                  Create New Configuration
                </span>
                {selectedConfigId === null && (
                  <CheckCircle2 className="w-4 h-4 text-[#F27D26]" />
                )}
              </div>
              <p className="text-xs text-neutral-600">
                Register a new hardware configuration row for {data.laptop.brand} {data.laptop.model}.
              </p>
            </div>

            {/* Existing Matches */}
            {matches.map((m, idx) => {
              const conf = m.matchedConfiguration;
              if (!conf) return null;
              const isSelected = selectedConfigId === conf.id;

              return (
                <div
                  key={idx}
                  onClick={() => setSelectedConfigId(conf.id)}
                  className={`border-2 p-3.5 cursor-pointer transition-colors ${
                    isSelected
                      ? 'border-[#F27D26] bg-[#FFF9F3]'
                      : 'border-[#141414] bg-white hover:bg-neutral-50'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-2">
                      <StatusBadge status={m.classification} size="sm" />
                      <span className="font-mono text-[11px] font-bold">
                        {m.confidenceScore}% Match
                      </span>
                    </div>
                    {isSelected && <CheckCircle2 className="w-4 h-4 text-[#F27D26]" />}
                  </div>

                  <p className="font-mono text-xs font-semibold text-[#141414] mt-1">
                    {conf.cpu || 'Unknown CPU'} • {conf.gpu || 'Unknown GPU'} • {conf.ram_gb || '?'}GB RAM
                  </p>

                  <div className="mt-1 space-y-0.5 text-[11px] font-mono text-neutral-600">
                    <div>Matches: {m.matchingReasons.join(', ')}</div>
                    {m.differingFields.length > 0 && (
                      <div className="text-amber-700">Diff: {m.differingFields.join('; ')}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Panel>

      {/* Review Tab Navigation */}
      <div className="flex border-b-2 border-[#141414] bg-[#EBEAE7] overflow-x-auto">
        {[
          { id: 'specs', label: '1. Specs & Identity', icon: Cpu },
          { id: 'benchmarks', label: `2. Benchmarks (${data.benchmarks.length})`, icon: Layers },
          { id: 'gaming', label: `3. Gaming FPS (${data.gaming.length})`, icon: Gamepad2 },
          { id: 'thermals', label: `4. Thermals (${data.thermals.length})`, icon: Thermometer },
          { id: 'display_battery', label: '5. Display & Battery', icon: Monitor },
          { id: 'verdict', label: '6. Reviewer Verdict', icon: FileText },
          { id: 'retail', label: '7. Retail & Pricing', icon: ShoppingBag },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 font-mono text-xs uppercase font-bold tracking-wider whitespace-nowrap border-r-2 border-[#141414] transition-colors cursor-pointer flex items-center space-x-1.5 ${
                activeTab === tab.id ? 'bg-[#141414] text-white' : 'text-neutral-700 hover:bg-white'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Specs & Identity */}
      {activeTab === 'specs' && (
        <div className="space-y-6">
          <Panel title="Laptop Identity">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block font-mono text-[11px] uppercase font-bold text-neutral-700 mb-1">
                  Brand *
                </label>
                <input
                  type="text"
                  value={data.laptop.brand}
                  onChange={(e) => updateLaptopIdentity('brand', e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#141414] font-mono text-xs bg-white"
                />
              </div>

              <div>
                <label className="block font-mono text-[11px] uppercase font-bold text-neutral-700 mb-1">
                  Model *
                </label>
                <input
                  type="text"
                  value={data.laptop.model}
                  onChange={(e) => updateLaptopIdentity('model', e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#141414] font-mono text-xs bg-white"
                />
              </div>

              <div>
                <label className="block font-mono text-[11px] uppercase font-bold text-neutral-700 mb-1">
                  Series
                </label>
                <input
                  type="text"
                  value={data.laptop.series || ''}
                  onChange={(e) => updateLaptopIdentity('series', e.target.value)}
                  placeholder="e.g. Legion, ROG, XPS"
                  className="w-full px-3 py-1.5 border border-[#141414] font-mono text-xs bg-white"
                />
              </div>

              <div>
                <label className="block font-mono text-[11px] uppercase font-bold text-neutral-700 mb-1">
                  Generation / Year
                </label>
                <input
                  type="text"
                  value={data.laptop.generation || ''}
                  onChange={(e) => updateLaptopIdentity('generation', e.target.value)}
                  placeholder="e.g. Gen 9, 2024"
                  className="w-full px-3 py-1.5 border border-[#141414] font-mono text-xs bg-white"
                />
              </div>
            </div>
          </Panel>

          <Panel title="Hardware Specifications (Tested Unit)">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block font-mono text-[11px] uppercase font-bold text-neutral-700 mb-1">
                  CPU Processor
                </label>
                <input
                  type="text"
                  value={data.configuration.cpu || ''}
                  onChange={(e) => updateConfigField('cpu', e.target.value || null)}
                  placeholder="e.g. Intel Core i9-14900HX"
                  className="w-full px-3 py-1.5 border border-[#141414] font-mono text-xs bg-white"
                />
              </div>

              <div>
                <label className="block font-mono text-[11px] uppercase font-bold text-neutral-700 mb-1">
                  GPU Graphics
                </label>
                <input
                  type="text"
                  value={data.configuration.gpu || ''}
                  onChange={(e) => updateConfigField('gpu', e.target.value || null)}
                  placeholder="e.g. NVIDIA RTX 4080 Laptop GPU"
                  className="w-full px-3 py-1.5 border border-[#141414] font-mono text-xs bg-white"
                />
              </div>

              <div>
                <label className="block font-mono text-[11px] uppercase font-bold text-neutral-700 mb-1">
                  GPU Type
                </label>
                <select
                  value={data.configuration.gpu_type || 'unknown'}
                  onChange={(e) => updateConfigField('gpu_type', e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#141414] font-mono text-xs bg-white"
                >
                  <option value="dedicated">Dedicated (dGPU)</option>
                  <option value="integrated">Integrated (iGPU)</option>
                  <option value="unknown">Unknown</option>
                </select>
              </div>

              <div>
                <label className="block font-mono text-[11px] uppercase font-bold text-neutral-700 mb-1">
                  GPU TGP (Watts)
                </label>
                <input
                  type="number"
                  value={data.configuration.gpu_tgp_w || ''}
                  onChange={(e) =>
                    updateConfigField(
                      'gpu_tgp_w',
                      e.target.value ? parseInt(e.target.value, 10) : null
                    )
                  }
                  placeholder="e.g. 175"
                  className="w-full px-3 py-1.5 border border-[#141414] font-mono text-xs bg-white"
                />
              </div>

              <div>
                <label className="block font-mono text-[11px] uppercase font-bold text-neutral-700 mb-1">
                  RAM Capacity (GB)
                </label>
                <input
                  type="number"
                  value={data.configuration.ram_gb || ''}
                  onChange={(e) =>
                    updateConfigField('ram_gb', e.target.value ? parseInt(e.target.value, 10) : null)
                  }
                  placeholder="e.g. 32"
                  className="w-full px-3 py-1.5 border border-[#141414] font-mono text-xs bg-white"
                />
              </div>

              <div>
                <label className="block font-mono text-[11px] uppercase font-bold text-neutral-700 mb-1">
                  RAM Speed (MT/s)
                </label>
                <input
                  type="number"
                  value={data.configuration.ram_speed_mt_s || ''}
                  onChange={(e) =>
                    updateConfigField(
                      'ram_speed_mt_s',
                      e.target.value ? parseInt(e.target.value, 10) : null
                    )
                  }
                  placeholder="e.g. 5600"
                  className="w-full px-3 py-1.5 border border-[#141414] font-mono text-xs bg-white"
                />
              </div>

              <div>
                <label className="block font-mono text-[11px] uppercase font-bold text-neutral-700 mb-1">
                  Storage Capacity (GB)
                </label>
                <input
                  type="number"
                  value={data.configuration.storage_gb || ''}
                  onChange={(e) =>
                    updateConfigField(
                      'storage_gb',
                      e.target.value ? parseInt(e.target.value, 10) : null
                    )
                  }
                  placeholder="e.g. 1024 for 1TB"
                  className="w-full px-3 py-1.5 border border-[#141414] font-mono text-xs bg-white"
                />
              </div>

              <div>
                <label className="block font-mono text-[11px] uppercase font-bold text-neutral-700 mb-1">
                  Storage Type / Interface
                </label>
                <input
                  type="text"
                  value={data.configuration.storage_type || ''}
                  onChange={(e) => updateConfigField('storage_type', e.target.value || null)}
                  placeholder="e.g. PCIe 4.0 NVMe SSD"
                  className="w-full px-3 py-1.5 border border-[#141414] font-mono text-xs bg-white"
                />
              </div>

              <div>
                <label className="block font-mono text-[11px] uppercase font-bold text-neutral-700 mb-1">
                  Measured SSD Read (MB/s)
                </label>
                <input
                  type="number"
                  value={data.configuration.ssd_read_mb_s || ''}
                  onChange={(e) =>
                    updateConfigField(
                      'ssd_read_mb_s',
                      e.target.value ? parseFloat(e.target.value) : null
                    )
                  }
                  placeholder="e.g. 7100"
                  className="w-full px-3 py-1.5 border border-[#141414] font-mono text-xs bg-white"
                />
              </div>

              <div>
                <label className="block font-mono text-[11px] uppercase font-bold text-neutral-700 mb-1">
                  Measured SSD Write (MB/s)
                </label>
                <input
                  type="number"
                  value={data.configuration.ssd_write_mb_s || ''}
                  onChange={(e) =>
                    updateConfigField(
                      'ssd_write_mb_s',
                      e.target.value ? parseFloat(e.target.value) : null
                    )
                  }
                  placeholder="e.g. 6400"
                  className="w-full px-3 py-1.5 border border-[#141414] font-mono text-xs bg-white"
                />
              </div>

              <div>
                <label className="block font-mono text-[11px] uppercase font-bold text-neutral-700 mb-1">
                  Screen Size (Inches)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={data.configuration.display_size_inch || ''}
                  onChange={(e) =>
                    updateConfigField(
                      'display_size_inch',
                      e.target.value ? parseFloat(e.target.value) : null
                    )
                  }
                  placeholder="e.g. 16.0"
                  className="w-full px-3 py-1.5 border border-[#141414] font-mono text-xs bg-white"
                />
              </div>

              <div>
                <label className="block font-mono text-[11px] uppercase font-bold text-neutral-700 mb-1">
                  Display Resolution
                </label>
                <input
                  type="text"
                  value={data.configuration.display_resolution || ''}
                  onChange={(e) => updateConfigField('display_resolution', e.target.value || null)}
                  placeholder="e.g. 2560x1600"
                  className="w-full px-3 py-1.5 border border-[#141414] font-mono text-xs bg-white"
                />
              </div>

              <div>
                <label className="block font-mono text-[11px] uppercase font-bold text-neutral-700 mb-1">
                  Refresh Rate (Hz)
                </label>
                <input
                  type="number"
                  value={data.configuration.refresh_rate_hz || ''}
                  onChange={(e) =>
                    updateConfigField(
                      'refresh_rate_hz',
                      e.target.value ? parseInt(e.target.value, 10) : null
                    )
                  }
                  placeholder="e.g. 240"
                  className="w-full px-3 py-1.5 border border-[#141414] font-mono text-xs bg-white"
                />
              </div>

              <div>
                <label className="block font-mono text-[11px] uppercase font-bold text-neutral-700 mb-1">
                  Panel Type
                </label>
                <input
                  type="text"
                  value={data.configuration.panel_type || ''}
                  onChange={(e) => updateConfigField('panel_type', e.target.value || null)}
                  placeholder="e.g. IPS, OLED, Mini-LED"
                  className="w-full px-3 py-1.5 border border-[#141414] font-mono text-xs bg-white"
                />
              </div>

              <div>
                <label className="block font-mono text-[11px] uppercase font-bold text-neutral-700 mb-1">
                  Battery Capacity (Wh)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={data.configuration.battery_wh || ''}
                  onChange={(e) =>
                    updateConfigField('battery_wh', e.target.value ? parseFloat(e.target.value) : null)
                  }
                  placeholder="e.g. 99.9"
                  className="w-full px-3 py-1.5 border border-[#141414] font-mono text-xs bg-white"
                />
              </div>

              <div>
                <label className="block font-mono text-[11px] uppercase font-bold text-neutral-700 mb-1">
                  Weight (kg)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={data.configuration.weight_kg || ''}
                  onChange={(e) =>
                    updateConfigField('weight_kg', e.target.value ? parseFloat(e.target.value) : null)
                  }
                  placeholder="e.g. 2.45"
                  className="w-full px-3 py-1.5 border border-[#141414] font-mono text-xs bg-white"
                />
              </div>

              <div>
                <label className="block font-mono text-[11px] uppercase font-bold text-neutral-700 mb-1">
                  Thickness (mm)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={data.configuration.thickness_mm || ''}
                  onChange={(e) =>
                    updateConfigField(
                      'thickness_mm',
                      e.target.value ? parseFloat(e.target.value) : null
                    )
                  }
                  placeholder="e.g. 21.9"
                  className="w-full px-3 py-1.5 border border-[#141414] font-mono text-xs bg-white"
                />
              </div>

              <div>
                <label className="block font-mono text-[11px] uppercase font-bold text-neutral-700 mb-1">
                  Webcam Spec
                </label>
                <input
                  type="text"
                  value={data.configuration.webcam || ''}
                  onChange={(e) => updateConfigField('webcam', e.target.value || null)}
                  placeholder="e.g. 1080p + IR, 720p"
                  className="w-full px-3 py-1.5 border border-[#141414] font-mono text-xs bg-white"
                />
              </div>

              <div className="sm:col-span-2 lg:col-span-3">
                <label className="block font-mono text-[11px] uppercase font-bold text-neutral-700 mb-1">
                  Build Quality Notes
                </label>
                <input
                  type="text"
                  value={data.configuration.build_quality || ''}
                  onChange={(e) => updateConfigField('build_quality', e.target.value || null)}
                  placeholder="e.g. All-metal aluminum chassis, solid hinge with minimal screen wobble"
                  className="w-full px-3 py-1.5 border border-[#141414] font-mono text-xs bg-white"
                />
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* Tab 2: Benchmarks */}
      {activeTab === 'benchmarks' && (
        <Panel
          title="Synthetic Benchmarks (Max 8)"
          actions={
            <button
              onClick={() => {
                const newB: BenchmarkResult = {
                  benchmark_name: 'Cinebench R23',
                  benchmark_version: 'R23',
                  variant: 'Multi-Core',
                  category: 'cpu',
                  score: 0,
                  unit: 'pts',
                  power_mode: 'Performance',
                  notes: null,
                };
                setData((prev) => (prev ? { ...prev, benchmarks: [...prev.benchmarks, newB] } : prev));
              }}
              className="flex items-center space-x-1 px-2 py-1 bg-[#141414] text-white text-xs font-mono cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Add Row</span>
            </button>
          }
        >
          {data.benchmarks.length === 0 ? (
            <p className="text-xs font-mono text-neutral-500 italic py-4">
              No benchmarks were tested in this review video.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono border-collapse border border-neutral-300">
                <thead>
                  <tr className="bg-neutral-100 text-neutral-700 border-b border-neutral-300">
                    <th className="p-2 text-left">Benchmark Name</th>
                    <th className="p-2 text-left">Version</th>
                    <th className="p-2 text-left">Variant / Subtest</th>
                    <th className="p-2 text-left">Category</th>
                    <th className="p-2 text-left">Score</th>
                    <th className="p-2 text-left">Unit</th>
                    <th className="p-2 text-left">Power Mode</th>
                    <th className="p-2 text-center w-10">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.benchmarks.map((b, idx) => (
                    <tr key={idx} className="border-b border-neutral-200 hover:bg-neutral-50">
                      <td className="p-2">
                        <input
                          type="text"
                          value={b.benchmark_name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setData((prev) => {
                              if (!prev) return prev;
                              const updated = [...prev.benchmarks];
                              updated[idx].benchmark_name = val;
                              return { ...prev, benchmarks: updated };
                            });
                          }}
                          className="w-36 px-2 py-1 border border-neutral-300 bg-white font-bold"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={b.benchmark_version || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setData((prev) => {
                              if (!prev) return prev;
                              const updated = [...prev.benchmarks];
                              updated[idx].benchmark_version = val || null;
                              return { ...prev, benchmarks: updated };
                            });
                          }}
                          placeholder="e.g. R23"
                          className="w-20 px-2 py-1 border border-neutral-300 bg-white"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={b.variant || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setData((prev) => {
                              if (!prev) return prev;
                              const updated = [...prev.benchmarks];
                              updated[idx].variant = val || null;
                              return { ...prev, benchmarks: updated };
                            });
                          }}
                          placeholder="Multi-Core"
                          className="w-28 px-2 py-1 border border-neutral-300 bg-white"
                        />
                      </td>
                      <td className="p-2">
                        <select
                          value={b.category}
                          onChange={(e) => {
                            const val = e.target.value as any;
                            setData((prev) => {
                              if (!prev) return prev;
                              const updated = [...prev.benchmarks];
                              updated[idx].category = val;
                              return { ...prev, benchmarks: updated };
                            });
                          }}
                          className="px-2 py-1 border border-neutral-300 bg-white"
                        >
                          <option value="cpu">CPU</option>
                          <option value="gpu">GPU</option>
                          <option value="storage">Storage</option>
                          <option value="system">System</option>
                        </select>
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          value={b.score ?? ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setData((prev) => {
                              if (!prev) return prev;
                              const updated = [...prev.benchmarks];
                              updated[idx].score = isNaN(val) ? (null as any) : val;
                              return { ...prev, benchmarks: updated };
                            });
                          }}
                          className="w-24 px-2 py-1 border border-neutral-300 bg-white font-bold text-[#F27D26]"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={b.unit || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setData((prev) => {
                              if (!prev) return prev;
                              const updated = [...prev.benchmarks];
                              updated[idx].unit = val || null;
                              return { ...prev, benchmarks: updated };
                            });
                          }}
                          placeholder="pts"
                          className="w-16 px-2 py-1 border border-neutral-300 bg-white"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={b.power_mode || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setData((prev) => {
                              if (!prev) return prev;
                              const updated = [...prev.benchmarks];
                              updated[idx].power_mode = val || null;
                              return { ...prev, benchmarks: updated };
                            });
                          }}
                          placeholder="Turbo / Balanced"
                          className="w-24 px-2 py-1 border border-neutral-300 bg-white"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => {
                            setData((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    benchmarks: prev.benchmarks.filter((_, i) => i !== idx),
                                  }
                                : prev
                            );
                          }}
                          className="text-red-600 hover:text-red-800 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {/* Tab 3: Gaming FPS */}
      {activeTab === 'gaming' && (
        <Panel
          title="Gaming Performance (Max 5 Games)"
          actions={
            <button
              onClick={() => {
                const newG: GamingResult = {
                  game: 'Cyberpunk 2077',
                  resolution: '1920x1080',
                  preset: 'Ultra',
                  ray_tracing: false,
                  upscaling: false,
                  upscaling_mode: null,
                  frame_generation: false,
                  avg_fps: 60,
                  one_percent_low_fps: null,
                  notes: null,
                };
                setData((prev) => (prev ? { ...prev, gaming: [...prev.gaming, newG] } : prev));
              }}
              className="flex items-center space-x-1 px-2 py-1 bg-[#141414] text-white text-xs font-mono cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Add Game</span>
            </button>
          }
        >
          {data.gaming.length === 0 ? (
            <p className="text-xs font-mono text-neutral-500 italic py-4">
              No gaming benchmarks were tested in this review video.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono border-collapse border border-neutral-300">
                <thead>
                  <tr className="bg-neutral-100 text-neutral-700 border-b border-neutral-300">
                    <th className="p-2 text-left">Game Title</th>
                    <th className="p-2 text-left">Resolution</th>
                    <th className="p-2 text-left">Preset</th>
                    <th className="p-2 text-left">Ray Tracing</th>
                    <th className="p-2 text-left">Upscaling / DLSS</th>
                    <th className="p-2 text-left">Frame Gen</th>
                    <th className="p-2 text-left">Avg FPS</th>
                    <th className="p-2 text-left">1% Low FPS</th>
                    <th className="p-2 text-center w-10">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.gaming.map((g, idx) => (
                    <tr key={idx} className="border-b border-neutral-200 hover:bg-neutral-50">
                      <td className="p-2">
                        <input
                          type="text"
                          value={g.game}
                          onChange={(e) => {
                            const val = e.target.value;
                            setData((prev) => {
                              if (!prev) return prev;
                              const updated = [...prev.gaming];
                              updated[idx].game = val;
                              return { ...prev, gaming: updated };
                            });
                          }}
                          className="w-36 px-2 py-1 border border-neutral-300 bg-white font-bold"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={g.resolution || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setData((prev) => {
                              if (!prev) return prev;
                              const updated = [...prev.gaming];
                              updated[idx].resolution = val || null;
                              return { ...prev, gaming: updated };
                            });
                          }}
                          placeholder="1920x1080"
                          className="w-24 px-2 py-1 border border-neutral-300 bg-white"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="text"
                          value={g.preset || ''}
                          onChange={(e) => {
                            const val = e.target.value;
                            setData((prev) => {
                              if (!prev) return prev;
                              const updated = [...prev.gaming];
                              updated[idx].preset = val || null;
                              return { ...prev, gaming: updated };
                            });
                          }}
                          placeholder="Ultra"
                          className="w-20 px-2 py-1 border border-neutral-300 bg-white"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={Boolean(g.ray_tracing)}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setData((prev) => {
                              if (!prev) return prev;
                              const updated = [...prev.gaming];
                              updated[idx].ray_tracing = val;
                              return { ...prev, gaming: updated };
                            });
                          }}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={Boolean(g.upscaling)}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setData((prev) => {
                              if (!prev) return prev;
                              const updated = [...prev.gaming];
                              updated[idx].upscaling = val;
                              return { ...prev, gaming: updated };
                            });
                          }}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="checkbox"
                          checked={Boolean(g.frame_generation)}
                          onChange={(e) => {
                            const val = e.target.checked;
                            setData((prev) => {
                              if (!prev) return prev;
                              const updated = [...prev.gaming];
                              updated[idx].frame_generation = val;
                              return { ...prev, gaming: updated };
                            });
                          }}
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          value={g.avg_fps ?? ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setData((prev) => {
                              if (!prev) return prev;
                              const updated = [...prev.gaming];
                              updated[idx].avg_fps = isNaN(val) ? (null as any) : val;
                              return { ...prev, gaming: updated };
                            });
                          }}
                          className="w-20 px-2 py-1 border border-neutral-300 bg-white font-bold text-emerald-700"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          value={g.one_percent_low_fps ?? ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setData((prev) => {
                              if (!prev) return prev;
                              const updated = [...prev.gaming];
                              updated[idx].one_percent_low_fps = isNaN(val) ? null : val;
                              return { ...prev, gaming: updated };
                            });
                          }}
                          placeholder="e.g. 45"
                          className="w-20 px-2 py-1 border border-neutral-300 bg-white"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => {
                            setData((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    gaming: prev.gaming.filter((_, i) => i !== idx),
                                  }
                                : prev
                            );
                          }}
                          className="text-red-600 hover:text-red-800 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {/* Tab 4: Thermals */}
      {activeTab === 'thermals' && (
        <Panel
          title="Thermal & Acoustics Test Results"
          actions={
            <button
              onClick={() => {
                const newT: ThermalResult = {
                  test_name: 'Combined Stress Test',
                  cpu_peak_c: 85,
                  gpu_peak_c: 72,
                  keyboard_max_c: 42,
                  cpu_peak_power_w: 110,
                  gpu_peak_power_w: 140,
                  fan_noise_db: 48,
                  notes: null,
                };
                setData((prev) => (prev ? { ...prev, thermals: [...prev.thermals, newT] } : prev));
              }}
              className="flex items-center space-x-1 px-2 py-1 bg-[#141414] text-white text-xs font-mono cursor-pointer"
            >
              <Plus className="w-3 h-3" />
              <span>Add Thermal Row</span>
            </button>
          }
        >
          {data.thermals.length === 0 ? (
            <p className="text-xs font-mono text-neutral-500 italic py-4">
              No thermal tests were recorded in this review video.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono border-collapse border border-neutral-300">
                <thead>
                  <tr className="bg-neutral-100 text-neutral-700 border-b border-neutral-300">
                    <th className="p-2 text-left">Test Name</th>
                    <th className="p-2 text-left">CPU Peak (°C)</th>
                    <th className="p-2 text-left">GPU Peak (°C)</th>
                    <th className="p-2 text-left">Keyboard Hotspot (°C)</th>
                    <th className="p-2 text-left">CPU Peak (W)</th>
                    <th className="p-2 text-left">GPU Peak (W)</th>
                    <th className="p-2 text-left">Fan Noise (dB)</th>
                    <th className="p-2 text-center w-10">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.thermals.map((t, idx) => (
                    <tr key={idx} className="border-b border-neutral-200 hover:bg-neutral-50">
                      <td className="p-2">
                        <input
                          type="text"
                          value={t.test_name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setData((prev) => {
                              if (!prev) return prev;
                              const updated = [...prev.thermals];
                              updated[idx].test_name = val;
                              return { ...prev, thermals: updated };
                            });
                          }}
                          className="w-36 px-2 py-1 border border-neutral-300 bg-white font-bold"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          value={t.cpu_peak_c ?? ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setData((prev) => {
                              if (!prev) return prev;
                              const updated = [...prev.thermals];
                              updated[idx].cpu_peak_c = isNaN(val) ? null : val;
                              return { ...prev, thermals: updated };
                            });
                          }}
                          className="w-20 px-2 py-1 border border-neutral-300 bg-white"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          value={t.gpu_peak_c ?? ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setData((prev) => {
                              if (!prev) return prev;
                              const updated = [...prev.thermals];
                              updated[idx].gpu_peak_c = isNaN(val) ? null : val;
                              return { ...prev, thermals: updated };
                            });
                          }}
                          className="w-20 px-2 py-1 border border-neutral-300 bg-white"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          value={t.keyboard_max_c ?? ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setData((prev) => {
                              if (!prev) return prev;
                              const updated = [...prev.thermals];
                              updated[idx].keyboard_max_c = isNaN(val) ? null : val;
                              return { ...prev, thermals: updated };
                            });
                          }}
                          className="w-20 px-2 py-1 border border-neutral-300 bg-white"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          value={t.cpu_peak_power_w ?? ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setData((prev) => {
                              if (!prev) return prev;
                              const updated = [...prev.thermals];
                              updated[idx].cpu_peak_power_w = isNaN(val) ? null : val;
                              return { ...prev, thermals: updated };
                            });
                          }}
                          className="w-20 px-2 py-1 border border-neutral-300 bg-white"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          value={t.gpu_peak_power_w ?? ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setData((prev) => {
                              if (!prev) return prev;
                              const updated = [...prev.thermals];
                              updated[idx].gpu_peak_power_w = isNaN(val) ? null : val;
                              return { ...prev, thermals: updated };
                            });
                          }}
                          className="w-20 px-2 py-1 border border-neutral-300 bg-white"
                        />
                      </td>
                      <td className="p-2">
                        <input
                          type="number"
                          value={t.fan_noise_db ?? ''}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            setData((prev) => {
                              if (!prev) return prev;
                              const updated = [...prev.thermals];
                              updated[idx].fan_noise_db = isNaN(val) ? null : val;
                              return { ...prev, thermals: updated };
                            });
                          }}
                          className="w-20 px-2 py-1 border border-neutral-300 bg-white"
                        />
                      </td>
                      <td className="p-2 text-center">
                        <button
                          onClick={() => {
                            setData((prev) =>
                              prev
                                ? {
                                    ...prev,
                                    thermals: prev.thermals.filter((_, i) => i !== idx),
                                  }
                                : prev
                            );
                          }}
                          className="text-red-600 hover:text-red-800 cursor-pointer"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      )}

      {/* Tab 5: Display & Battery */}
      {activeTab === 'display_battery' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Panel title="Lab Display Measurements">
            <div className="space-y-3 font-mono text-xs">
              <div>
                <label className="block font-bold text-neutral-700 mb-1">Measured SDR Brightness (nits)</label>
                <input
                  type="number"
                  value={data.display?.brightness_sdr_nits ?? ''}
                  onChange={(e) => updateDisplayField('brightness_sdr_nits', e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="e.g. 500"
                  className="w-full px-3 py-1.5 border border-[#141414] bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">Measured HDR Peak Brightness (nits)</label>
                <input
                  type="number"
                  value={data.display?.brightness_hdr_nits ?? ''}
                  onChange={(e) => updateDisplayField('brightness_hdr_nits', e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="e.g. 1000"
                  className="w-full px-3 py-1.5 border border-[#141414] bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">sRGB Color Gamut Coverage (%)</label>
                <input
                  type="number"
                  value={data.display?.srgb_percent ?? ''}
                  onChange={(e) => updateDisplayField('srgb_percent', e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="e.g. 100"
                  className="w-full px-3 py-1.5 border border-[#141414] bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">DCI-P3 Color Gamut Coverage (%)</label>
                <input
                  type="number"
                  value={data.display?.dci_p3_percent ?? ''}
                  onChange={(e) => updateDisplayField('dci_p3_percent', e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="e.g. 99"
                  className="w-full px-3 py-1.5 border border-[#141414] bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">Response Time (ms)</label>
                <input
                  type="number"
                  step="0.1"
                  value={data.display?.response_time_ms ?? ''}
                  onChange={(e) => updateDisplayField('response_time_ms', e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="e.g. 3.0"
                  className="w-full px-3 py-1.5 border border-[#141414] bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">Contrast Ratio</label>
                <input
                  type="text"
                  value={data.display?.contrast_ratio ?? ''}
                  onChange={(e) => updateDisplayField('contrast_ratio', e.target.value || null)}
                  placeholder="e.g. 1200:1 or Infinite (OLED)"
                  className="w-full px-3 py-1.5 border border-[#141414] bg-white"
                />
              </div>
            </div>
          </Panel>

          <Panel title="Battery & Power Results">
            <div className="space-y-3 font-mono text-xs">
              <div>
                <label className="block font-bold text-neutral-700 mb-1">Battery Runtime (Hours)</label>
                <input
                  type="number"
                  step="0.1"
                  value={data.battery?.battery_life_hours ?? ''}
                  onChange={(e) => updateBatteryField('battery_life_hours', e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="e.g. 7.5"
                  className="w-full px-3 py-1.5 border border-[#141414] bg-white font-bold text-emerald-700"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">Test Method / Workload</label>
                <input
                  type="text"
                  value={data.battery?.test_method ?? ''}
                  onChange={(e) => updateBatteryField('test_method', e.target.value || null)}
                  placeholder="e.g. YouTube 1080p playback @ 150 nits"
                  className="w-full px-3 py-1.5 border border-[#141414] bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">Included Charger Wattage (W)</label>
                <input
                  type="number"
                  value={data.battery?.charging_adapter_w ?? ''}
                  onChange={(e) => updateBatteryField('charging_adapter_w', e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="e.g. 300"
                  className="w-full px-3 py-1.5 border border-[#141414] bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">Supported USB-C Charging (W)</label>
                <input
                  type="number"
                  value={data.battery?.usb_c_charging_w ?? ''}
                  onChange={(e) => updateBatteryField('usb_c_charging_w', e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="e.g. 140"
                  className="w-full px-3 py-1.5 border border-[#141414] bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-neutral-700 mb-1">0% to 100% Charge Time (Minutes)</label>
                <input
                  type="number"
                  value={data.battery?.full_charge_min ?? ''}
                  onChange={(e) => updateBatteryField('full_charge_min', e.target.value ? parseFloat(e.target.value) : null)}
                  placeholder="e.g. 80"
                  className="w-full px-3 py-1.5 border border-[#141414] bg-white"
                />
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* Tab 6: Reviewer Verdict */}
      {activeTab === 'verdict' && (
        <Panel title="Review Metadata & Qualitative Verdict">
          <div className="space-y-4 font-mono text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-neutral-700 mb-1">Review Title</label>
                <input
                  type="text"
                  value={data.review_meta.title}
                  onChange={(e) => updateReviewMeta('title', e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#141414] bg-white font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-neutral-700 mb-1">Reviewer / Channel Name</label>
                <input
                  type="text"
                  value={data.review_meta.reviewer}
                  onChange={(e) => updateReviewMeta('reviewer', e.target.value)}
                  className="w-full px-3 py-1.5 border border-[#141414] bg-white font-bold"
                />
              </div>
            </div>

            <div>
              <label className="block font-bold text-neutral-700 mb-1">Verdict Summary / Conclusion</label>
              <textarea
                rows={3}
                value={data.review_meta.verdict_summary || ''}
                onChange={(e) => updateReviewMeta('verdict_summary', e.target.value || null)}
                placeholder="Brief summary of the reviewer's verdict..."
                className="w-full p-2.5 border border-[#141414] bg-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-emerald-800 mb-1">Top Pros (One per line)</label>
                <textarea
                  rows={4}
                  value={data.review_meta.verdict_pros?.join('\n') || ''}
                  onChange={(e) =>
                    updateReviewMeta(
                      'verdict_pros',
                      e.target.value.split('\n').map((s) => s.trim()).filter(Boolean)
                    )
                  }
                  placeholder="Pro 1&#10;Pro 2&#10;Pro 3"
                  className="w-full p-2.5 border border-emerald-600 bg-white"
                />
              </div>

              <div>
                <label className="block font-bold text-red-800 mb-1">Top Cons (One per line)</label>
                <textarea
                  rows={4}
                  value={data.review_meta.verdict_cons?.join('\n') || ''}
                  onChange={(e) =>
                    updateReviewMeta(
                      'verdict_cons',
                      e.target.value.split('\n').map((s) => s.trim()).filter(Boolean)
                    )
                  }
                  placeholder="Con 1&#10;Con 2&#10;Con 3"
                  className="w-full p-2.5 border border-red-600 bg-white"
                />
              </div>
            </div>
          </div>
        </Panel>
      )}

      {/* Tab 7: Retail & Pricing */}
      {activeTab === 'retail' && (
        <Panel title="Optional Retail Listings & Direct Indian Pricing">
          <div className="space-y-6">
            <p className="text-xs text-neutral-600 font-mono">
              Enter product URLs to automatically scrape price & image via JSON-LD Product schema.
              Failed scrapes will not block the extraction save.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Amazon Section */}
              <div className="border-2 border-neutral-300 p-4 space-y-3 bg-white">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold uppercase text-amber-800">Amazon India Listing</span>
                  {retailPreview.amazon && (
                    <span className="font-mono text-[10px] text-emerald-700 font-bold">Auto-Scraped</span>
                  )}
                </div>

                <div>
                  <label className="block font-mono text-[11px] text-neutral-600 mb-1">Amazon Product URL</label>
                  <div className="flex space-x-2">
                    <input
                      type="url"
                      value={amazonUrl}
                      onChange={(e) => setAmazonUrl(e.target.value)}
                      placeholder="https://www.amazon.in/dp/..."
                      className="flex-1 px-3 py-1.5 border border-neutral-300 font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => handlePreviewRetail('amazon', amazonUrl)}
                      disabled={previewingRetail || !amazonUrl.trim()}
                      className="px-3 py-1.5 bg-[#141414] text-white text-xs font-mono font-bold cursor-pointer disabled:opacity-40"
                    >
                      Test Scrape
                    </button>
                  </div>
                </div>

                {retailPreview.amazon && (
                  <div className="p-2.5 bg-neutral-50 border border-neutral-200 text-xs font-mono space-y-1">
                    <div>Scraped Price: <strong>{retailPreview.amazon.price ? `₹${retailPreview.amazon.price.toLocaleString()}` : 'Not found'}</strong></div>
                    {retailPreview.amazon.image && (
                      <div className="flex items-center space-x-2 mt-1">
                        <img src={retailPreview.amazon.image} alt="Preview" className="w-12 h-12 object-contain border" />
                        <span className="text-[10px] text-neutral-500 truncate">{retailPreview.amazon.image}</span>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block font-mono text-[11px] text-neutral-600 mb-1">Manual Price Override (INR ₹)</label>
                  <input
                    type="number"
                    value={amazonManualPrice}
                    onChange={(e) => setAmazonManualPrice(e.target.value)}
                    placeholder="e.g. 179990"
                    className="w-full px-3 py-1.5 border border-neutral-300 font-mono text-xs"
                  />
                </div>
              </div>

              {/* Flipkart Section */}
              <div className="border-2 border-neutral-300 p-4 space-y-3 bg-white">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold uppercase text-blue-800">Flipkart Listing</span>
                  {retailPreview.flipkart && (
                    <span className="font-mono text-[10px] text-emerald-700 font-bold">Auto-Scraped</span>
                  )}
                </div>

                <div>
                  <label className="block font-mono text-[11px] text-neutral-600 mb-1">Flipkart Product URL</label>
                  <div className="flex space-x-2">
                    <input
                      type="url"
                      value={flipkartUrl}
                      onChange={(e) => setFlipkartUrl(e.target.value)}
                      placeholder="https://www.flipkart.com/..."
                      className="flex-1 px-3 py-1.5 border border-neutral-300 font-mono text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => handlePreviewRetail('flipkart', flipkartUrl)}
                      disabled={previewingRetail || !flipkartUrl.trim()}
                      className="px-3 py-1.5 bg-[#141414] text-white text-xs font-mono font-bold cursor-pointer disabled:opacity-40"
                    >
                      Test Scrape
                    </button>
                  </div>
                </div>

                {retailPreview.flipkart && (
                  <div className="p-2.5 bg-neutral-50 border border-neutral-200 text-xs font-mono space-y-1">
                    <div>Scraped Price: <strong>{retailPreview.flipkart.price ? `₹${retailPreview.flipkart.price.toLocaleString()}` : 'Not found'}</strong></div>
                    {retailPreview.flipkart.image && (
                      <div className="flex items-center space-x-2 mt-1">
                        <img src={retailPreview.flipkart.image} alt="Preview" className="w-12 h-12 object-contain border" />
                        <span className="text-[10px] text-neutral-500 truncate">{retailPreview.flipkart.image}</span>
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <label className="block font-mono text-[11px] text-neutral-600 mb-1">Manual Price Override (INR ₹)</label>
                  <input
                    type="number"
                    value={flipkartManualPrice}
                    onChange={(e) => setFlipkartManualPrice(e.target.value)}
                    placeholder="e.g. 184990"
                    className="w-full px-3 py-1.5 border border-neutral-300 font-mono text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Manual Image Fallback */}
            <div className="border border-neutral-300 p-4 bg-white space-y-2">
              <label className="block font-mono text-xs font-bold text-neutral-800">
                Fallback Product Image URL
              </label>
              <p className="text-[11px] text-neutral-500 font-mono">
                Only used if auto-detection returns no image from retailer schema.
              </p>
              <input
                type="url"
                value={manualImageUrl}
                onChange={(e) => setManualImageUrl(e.target.value)}
                placeholder="https://images.example.com/laptop.jpg"
                className="w-full px-3 py-1.5 border border-neutral-300 font-mono text-xs"
              />
            </div>
          </div>
        </Panel>
      )}
    </div>
  );
};
