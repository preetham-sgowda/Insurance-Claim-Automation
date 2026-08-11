import React, { useState } from 'react';
import { InsuranceType, ClaimSubType, ClaimRecord, formatINR } from '../../types/claim';
import { INSURANCE_TYPES_CONFIG } from '../../data/insuranceConfig';
import { getStoredPolicies } from '../../lib/supabase';
import { generateClaimPDFReport } from '../../lib/pdfGenerator';
import {
  UploadCloud,
  CheckCircle,
  ChevronRight,
  ArrowLeft,
  Sparkles,
  Download
} from 'lucide-react';

interface NewClaimWizardProps {
  isOpen: boolean;
  onClose: () => void;
  onClaimSubmitted: (claim: ClaimRecord) => void;
  initialInsuranceType?: InsuranceType;
}

export const NewClaimWizard: React.FC<NewClaimWizardProps> = ({
  isOpen,
  onClose,
  onClaimSubmitted,
  initialInsuranceType = 'life'
}) => {
  const [step, setStep] = useState<number>(1);
  const [selectedType, setSelectedType] = useState<InsuranceType>(initialInsuranceType);
  const [selectedSubType, setSelectedSubType] = useState<ClaimSubType>('natural_death');
  const [policyNumber, setPolicyNumber] = useState<string>('');
  const [claimantName, setClaimantName] = useState<string>('Rahul Sharma');
  const [claimantEmail, setClaimantEmail] = useState<string>('rahul.sharma@example.com');
  const [claimedAmount, setClaimedAmount] = useState<number>(500000);

  // File Upload State
  const [uploadedFiles, setUploadedFiles] = useState<{ id: string; name: string; size: number; type: string; contentText?: string }[]>([]);

  // AI Pipeline Execution States
  const [isProcessing, setIsProcessing] = useState(false);
  const [pipelineProgress, setPipelineProgress] = useState<{ stepName: string; percent: number }>({ stepName: '', percent: 0 });
  const [processedClaimResult, setProcessedClaimResult] = useState<ClaimRecord | null>(null);

  if (!isOpen) return null;

  const config = INSURANCE_TYPES_CONFIG[selectedType];
  const policies = getStoredPolicies().filter(p => p.insuranceType === selectedType);

  const handleTypeSelect = (type: InsuranceType) => {
    setSelectedType(type);
    const newCfg = INSURANCE_TYPES_CONFIG[type];
    if (newCfg.subTypes.length > 0) {
      setSelectedSubType(newCfg.subTypes[0].value);
    }
    const availablePolicies = getStoredPolicies().filter(p => p.insuranceType === type);
    if (availablePolicies.length > 0) {
      setPolicyNumber(availablePolicies[0].policyNumber);
      setClaimantName(availablePolicies[0].holderName);
      setClaimantEmail(availablePolicies[0].holderEmail);
    } else {
      setPolicyNumber(`CX-${type.toUpperCase().slice(0, 3)}-99${Math.floor(10 + Math.random() * 89)}`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, docId: string) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const newFile = {
        id: docId,
        name: file.name,
        size: file.size,
        type: file.type || 'application/pdf',
        contentText: `Mock content for ${file.name} - ${docId}`
      };
      setUploadedFiles(prev => [...prev.filter(f => f.id !== docId), newFile]);
    }
  };

  const handleRunPipeline = async () => {
    setIsProcessing(true);
    setStep(5); // Progress Visualizer Step

    // Pipeline Animation Sequence
    const steps = [
      { name: '1/6 Input Validator & File Checklist', percent: 15 },
      { name: '2/6 Document Classification & OCR Parser', percent: 35 },
      { name: '3/6 Gemini Flash Field Extractor', percent: 55 },
      { name: '4/6 Base & Type-Specific Fraud Detection', percent: 75 },
      { name: '5/6 Policy Verification & Strategy Estimator', percent: 90 },
      { name: '6/6 PDF Report Generation & Masked Storage', percent: 100 }
    ];

    for (let i = 0; i < steps.length; i++) {
      setPipelineProgress({ stepName: steps[i].name, percent: steps[i].percent });
      await new Promise(r => setTimeout(r, 450));
    }

    try {
      const res = await fetch('/api/pipeline/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          insuranceType: selectedType,
          claimSubType: selectedSubType,
          policyNumber,
          claimantName,
          claimantEmail,
          claimedAmount,
          files: uploadedFiles
        })
      });

      const data = await res.json();
      if (data.success && data.claim) {
        setProcessedClaimResult(data.claim);
        onClaimSubmitted(data.claim);
        setStep(6); // Confirmation Step
      }
    } catch (err) {
      console.error('Failed to run AI pipeline endpoint:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!processedClaimResult) return;
    const dataUri = generateClaimPDFReport(processedClaimResult);
    const link = document.createElement('a');
    link.href = dataUri;
    link.download = `${processedClaimResult.claimNumber}_Settlement_Report.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white border border-[#E2B59A]/60 rounded-2xl max-w-3xl w-full my-6 shadow-xl overflow-hidden text-[#2C221E] animate-in fade-in zoom-in duration-200">
        
        {/* Wizard Top Bar */}
        <div className="px-6 py-4 bg-[#FAF7F2] border-b border-[#E2B59A]/40 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-[#FFE1AF] text-[#B77466] flex items-center justify-center font-bold">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#2C221E]">Multi-Line Claim Intake Engine</h3>
              <p className="text-[11px] text-[#957C62]">Step {step} of 6 — {config.title}</p>
            </div>
          </div>

          <button onClick={onClose} className="text-[#957C62] hover:text-[#2C221E] font-bold px-2 py-1">
            ✕
          </button>
        </div>

        {/* Wizard Body */}
        <div className="p-6 max-h-[75vh] overflow-y-auto">
          
          {/* STEP 1: Select Insurance Line */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-bold text-[#2C221E] mb-1">Select Insurance Product Category</h4>
                <p className="text-xs text-[#957C62]">ClaimX automatically adapts extraction schema, fraud signals, and estimation logic based on your product choice.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {(Object.keys(INSURANCE_TYPES_CONFIG) as InsuranceType[]).map((tKey) => {
                  const cfg = INSURANCE_TYPES_CONFIG[tKey];
                  const isSelected = selectedType === tKey;
                  return (
                    <div
                      key={tKey}
                      onClick={() => handleTypeSelect(tKey)}
                      className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-[#FFE1AF]/40 border-[#B77466] text-[#2C221E] shadow-xs'
                          : 'bg-[#FAF7F2] border-[#E2B59A]/40 text-[#2C221E] hover:border-[#E2B59A]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${cfg.badgeColor}`}>
                          {cfg.title}
                        </span>
                        {isSelected && <CheckCircle className="w-4 h-4 text-[#B77466]" />}
                      </div>
                      <p className="text-xs text-[#957C62] leading-snug">{cfg.description}</p>
                    </div>
                  );
                })}
              </div>

              <div className="pt-4 flex justify-end">
                <button
                  onClick={() => setStep(2)}
                  className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[#B77466] hover:bg-[#A36254] text-white font-bold text-xs shadow-xs"
                >
                  <span>Continue to Sub-type & Policy</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Select Sub-Type & Policy */}
          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-bold text-[#2C221E] mb-1">Select Claim Sub-Type for {config.title}</h4>
                <p className="text-xs text-[#957C62]">Each sub-type activates dedicated payout estimation rules.</p>
              </div>

              <div className="space-y-2">
                {config.subTypes.map((st) => (
                  <div
                    key={st.value}
                    onClick={() => setSelectedSubType(st.value)}
                    className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                      selectedSubType === st.value
                        ? 'bg-[#FFE1AF]/40 border-[#B77466] text-[#2C221E]'
                        : 'bg-[#FAF7F2] border-[#E2B59A]/40 text-[#2C221E] hover:border-[#E2B59A]'
                    }`}
                  >
                    <div>
                      <span className="text-xs font-bold text-[#2C221E] block">{st.label}</span>
                      <span className="text-[11px] text-[#957C62]">{st.description}</span>
                    </div>
                    {selectedSubType === st.value && <CheckCircle className="w-4 h-4 text-[#B77466]" />}
                  </div>
                ))}
              </div>

              {/* Policy Record Link */}
              <div className="pt-2">
                <label className="block text-xs font-medium text-[#957C62] mb-1">
                  Policy Number
                </label>
                {policies.length > 0 ? (
                  <select
                    value={policyNumber}
                    onChange={(e) => {
                      setPolicyNumber(e.target.value);
                      const p = policies.find(x => x.policyNumber === e.target.value);
                      if (p) {
                        setClaimantName(p.holderName);
                        setClaimantEmail(p.holderEmail);
                      }
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F2] border border-[#E2B59A]/60 text-[#2C221E] text-xs focus:outline-none focus:border-[#B77466]"
                  >
                    {policies.map(p => (
                      <option key={p.id} value={p.policyNumber}>
                        {p.policyNumber} — {p.holderName} (Coverage: {formatINR(p.sumInsuredOrIDV)})
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={policyNumber}
                    onChange={(e) => setPolicyNumber(e.target.value)}
                    placeholder="Enter Policy Number e.g. CX-LIFE-882190"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F2] border border-[#E2B59A]/60 text-[#2C221E] text-xs focus:outline-none focus:border-[#B77466]"
                  />
                )}
              </div>

              <div className="pt-4 flex justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-[#FAF7F2] border border-[#E2B59A]/60 text-[#957C62] hover:text-[#2C221E] text-xs font-semibold"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  onClick={() => setStep(3)}
                  className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[#B77466] hover:bg-[#A36254] text-white font-bold text-xs"
                >
                  <span>Claimant & Amount</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Claimant & Financial Details */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-bold text-[#2C221E] mb-1">Claimant Identity & Claim Amount</h4>
                <p className="text-xs text-[#957C62]">Specify details for verification and payout estimation in Indian Rupees (₹).</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-[#957C62] mb-1">Claimant Full Name</label>
                  <input
                    type="text"
                    value={claimantName}
                    onChange={(e) => setClaimantName(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F2] border border-[#E2B59A]/60 text-[#2C221E] text-xs focus:outline-none focus:border-[#B77466]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#957C62] mb-1">Claimant Email</label>
                  <input
                    type="email"
                    value={claimantEmail}
                    onChange={(e) => setClaimantEmail(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F2] border border-[#E2B59A]/60 text-[#2C221E] text-xs focus:outline-none focus:border-[#B77466]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#957C62] mb-1">
                  Total Claimed Amount (₹)
                </label>
                <input
                  type="number"
                  value={claimedAmount}
                  onChange={(e) => setClaimedAmount(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF7F2] border border-[#E2B59A]/60 text-[#2C221E] text-base font-bold text-emerald-800 focus:outline-none focus:border-[#B77466]"
                />
              </div>

              <div className="p-3 bg-[#FAF7F2] border border-[#E2B59A]/40 rounded-xl text-xs text-[#2C221E]">
                <span className="font-bold text-[#B77466] block mb-0.5">Estimation Rule Preview ({config.title}):</span>
                {config.estimationRulesDescription}
              </div>

              <div className="pt-4 flex justify-between">
                <button
                  onClick={() => setStep(2)}
                  className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-[#FAF7F2] border border-[#E2B59A]/60 text-[#957C62] hover:text-[#2C221E] text-xs font-semibold"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  onClick={() => setStep(4)}
                  className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[#B77466] hover:bg-[#A36254] text-white font-bold text-xs"
                >
                  <span>Document Upload Checklist</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Dynamic Document Checklist Upload */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-bold text-[#2C221E] mb-1">
                  Required Document Checklist ({config.title})
                </h4>
                <p className="text-xs text-[#957C62]">
                  Upload supporting files. Input Validator verifies presence before running AI extraction.
                </p>
              </div>

              <div className="space-y-2.5">
                {config.requiredDocs.map((doc) => {
                  const uploaded = uploadedFiles.find(f => f.id === doc.id);
                  return (
                    <div
                      key={doc.id}
                      className={`p-3.5 rounded-xl border flex items-center justify-between ${
                        uploaded
                          ? 'bg-emerald-50 border-emerald-300'
                          : doc.required
                          ? 'bg-[#FAF7F2] border-[#E2B59A]/60'
                          : 'bg-[#FAF7F2]/60 border-[#E2B59A]/40 opacity-80'
                      }`}
                    >
                      <div className="space-y-0.5 max-w-md">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-[#2C221E]">{doc.name}</span>
                          {doc.required ? (
                            <span className="text-[10px] text-rose-700 font-bold uppercase">Required</span>
                          ) : (
                            <span className="text-[10px] text-[#957C62]">Optional</span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#957C62]">{doc.description}</p>
                      </div>

                      <label className="cursor-pointer">
                        <input
                          type="file"
                          onChange={(e) => handleFileUpload(e, doc.id)}
                          className="hidden"
                          accept=".pdf,.png,.jpg,.jpeg"
                        />
                        <div className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                          uploaded
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-white hover:bg-[#FFE1AF]/40 border border-[#E2B59A] text-[#2C221E]'
                        }`}>
                          <UploadCloud className="w-3.5 h-3.5" />
                          <span>{uploaded ? 'Uploaded' : 'Choose File'}</span>
                        </div>
                      </label>
                    </div>
                  );
                })}
              </div>

              <div className="pt-4 flex justify-between">
                <button
                  onClick={() => setStep(3)}
                  className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-[#FAF7F2] border border-[#E2B59A]/60 text-[#957C62] hover:text-[#2C221E] text-xs font-semibold"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  onClick={handleRunPipeline}
                  className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-[#B77466] hover:bg-[#A36254] text-white font-extrabold text-xs shadow-xs active:scale-95"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Run AI Pipeline</span>
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: Live AI Pipeline Visualizer */}
          {step === 5 && (
            <div className="py-8 text-center space-y-6">
              <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-4 border-[#E2B59A] border-t-[#B77466] animate-spin" />
                <Sparkles className="w-8 h-8 text-[#B77466] animate-pulse" />
              </div>

              <div>
                <h4 className="text-lg font-bold text-[#2C221E] mb-1">ClaimX AI Pipeline Executing</h4>
                <p className="text-xs text-[#957C62]">{pipelineProgress.stepName}</p>
              </div>

              <div className="max-w-md mx-auto bg-[#FAF7F2] p-1 rounded-full border border-[#E2B59A]">
                <div
                  className="bg-[#B77466] h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${pipelineProgress.percent}%` }}
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-[#957C62] max-w-lg mx-auto pt-2">
                <span className="p-2 rounded bg-[#FAF7F2] border border-[#E2B59A]/40">Input Validator</span>
                <span className="p-2 rounded bg-[#FAF7F2] border border-[#E2B59A]/40">Gemini Extractor</span>
                <span className="p-2 rounded bg-[#FAF7F2] border border-[#E2B59A]/40">Identity Normalizer</span>
                <span className="p-2 rounded bg-[#FAF7F2] border border-[#E2B59A]/40">Fraud Signal Audit</span>
                <span className="p-2 rounded bg-[#FAF7F2] border border-[#E2B59A]/40">Policy Verifier</span>
                <span className="p-2 rounded bg-[#FAF7F2] border border-[#E2B59A]/40">Strategy Estimator</span>
              </div>
            </div>
          )}

          {/* STEP 6: Confirmation & PDF Report Preview */}
          {step === 6 && processedClaimResult && (
            <div className="space-y-5">
              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-800">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-emerald-800">Claim Processed Successfully!</h4>
                  <p className="text-xs text-emerald-700">Ref: {processedClaimResult.claimNumber} • Product: {config.title}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E2B59A]/40">
                  <span className="text-[10px] text-[#957C62] uppercase font-bold block mb-1">Claimed Amount</span>
                  <span className="text-base font-bold text-[#2C221E]">{formatINR(processedClaimResult.claimedAmount)}</span>
                </div>

                <div className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E2B59A]/40">
                  <span className="text-[10px] text-[#957C62] uppercase font-bold block mb-1">Calculated Payout</span>
                  <span className="text-base font-extrabold text-emerald-700">{formatINR(processedClaimResult.estimation.estimatedPayout)}</span>
                </div>

                <div className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#E2B59A]/40">
                  <span className="text-[10px] text-[#957C62] uppercase font-bold block mb-1">Fraud Score</span>
                  <span className={`text-base font-bold ${processedClaimResult.isFraudFlagged ? 'text-rose-700' : 'text-emerald-700'}`}>
                    {processedClaimResult.overallFraudScore} / 100
                  </span>
                </div>
              </div>

              <div className="pt-2 flex justify-between items-center">
                <button
                  onClick={handleDownloadPDF}
                  className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[#B77466] hover:bg-[#A36254] text-white font-bold text-xs shadow-xs"
                >
                  <Download className="w-4 h-4" />
                  <span>Download PDF Report</span>
                </button>

                <button
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl bg-[#FAF7F2] border border-[#E2B59A]/60 text-[#2C221E] font-semibold text-xs"
                >
                  Return to Dashboard
                </button>
              </div>
            </div>
          )}

        </div>

      </div>
    </div>
  );
};
