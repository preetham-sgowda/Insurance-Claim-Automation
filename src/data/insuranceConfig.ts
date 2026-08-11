import { InsuranceType, ClaimSubType, DocumentChecklistItem } from '../types/claim';

export interface InsuranceTypeConfig {
  type: InsuranceType;
  title: string;
  badgeColor: string;
  iconName: string;
  description: string;
  subTypes: { value: ClaimSubType; label: string; description: string }[];
  requiredDocs: DocumentChecklistItem[];
  fraudSignalsList: { name: string; category: 'base' | 'type_specific'; description: string }[];
  estimationRulesDescription: string;
}

export const INSURANCE_TYPES_CONFIG: Record<InsuranceType, InsuranceTypeConfig> = {
  life: {
    type: 'life',
    title: 'Life Insurance',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800',
    iconName: 'HeartPulse',
    description: 'Death claims, accidental death indemnity, and ULIP maturity benefit processing.',
    subTypes: [
      { value: 'natural_death', label: 'Natural Death Claim', description: 'Standard sum assured payout to nominee (100% SI).' },
      { value: 'accidental_death', label: 'Accidental Death Claim', description: 'Double indemnity rider payout (200% SI with FIR).' },
      { value: 'ulip_maturity', label: 'ULIP Policy Maturity', description: 'Full fund value + guaranteed rider additions payout.' }
    ],
    requiredDocs: [
      { id: 'death_cert', name: 'Death Certificate', description: 'Official municipal/govt issued death certificate', required: true, fileTypes: ['.pdf', '.jpg', '.png'] },
      { id: 'policy_doc', name: 'Policy Document', description: 'Original life insurance policy bond', required: true, fileTypes: ['.pdf', '.jpg', '.png'] },
      { id: 'aadhaar_nominee', name: 'Nominee Aadhaar Card', description: 'Identity proof of designated nominee', required: true, fileTypes: ['.pdf', '.jpg', '.png'] },
      { id: 'pan_nominee', name: 'Nominee PAN Card', description: 'PAN proof for payout tax processing', required: true, fileTypes: ['.pdf', '.jpg', '.png'] },
      { id: 'bank_proof', name: 'Cancelled Cheque / Passbook', description: 'Bank account verification proof for direct transfer', required: true, fileTypes: ['.pdf', '.jpg', '.png'] },
      { id: 'fir_record', name: 'FIR / Police Accident Report', description: 'Required for Accidental Death Rider benefit', required: false, fileTypes: ['.pdf', '.jpg', '.png'] },
      { id: 'hospital_death_summary', name: 'Hospital Summary / Cause of Death', description: 'Attending physician statement & medical history', required: false, fileTypes: ['.pdf', '.jpg', '.png'] }
    ],
    fraudSignalsList: [
      { name: 'Nominee Name Mismatch', category: 'base', description: 'Nominee identity on claim does not match stored policy record.' },
      { name: 'Early Death Claim (<2 yrs)', category: 'type_specific', description: 'Death occurs within 24 months of policy inception (contestable period).' },
      { name: 'Hospital Cause Mismatch', category: 'type_specific', description: 'Cause of death inconsistent between hospital summary and death cert.' },
      { name: 'Non-disclosure of Pre-existing Illness', category: 'type_specific', description: 'Medical history indicates prior chronic disease not disclosed.' }
    ],
    estimationRulesDescription: 'Natural Death = 100% Sum Assured. Accidental Death = 200% Sum Assured (Double Indemnity). ULIP = Fund Value.'
  },
  health: {
    type: 'health',
    title: 'Health Insurance',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800',
    iconName: 'Activity',
    description: 'Cashless, medical expense reimbursement, and critical illness lump-sum claims.',
    subTypes: [
      { value: 'cashless', label: 'Cashless Hospitalization', description: 'Direct network hospital pre-authorization settlement.' },
      { value: 'reimbursement', label: 'Medical Reimbursement', description: 'Post-treatment bill reimbursement up to Sum Insured.' },
      { value: 'critical_illness', label: 'Critical Illness Lump Sum', description: '% of Sum Insured paid upon diagnosed major illness.' }
    ],
    requiredDocs: [
      { id: 'discharge_summary', name: 'Discharge Summary', description: 'Complete hospital discharge summary with admission/discharge dates', required: true, fileTypes: ['.pdf', '.jpg', '.png'] },
      { id: 'medical_bills', name: 'Itemized Hospital Bills', description: 'Detailed final bill with breakups of room, meds, doctors', required: true, fileTypes: ['.pdf', '.jpg', '.png'] },
      { id: 'prescriptions', name: 'Pharmacy Receipts & Prescriptions', description: 'Doctor prescriptions and medicine purchase vouchers', required: true, fileTypes: ['.pdf', '.jpg', '.png'] },
      { id: 'diagnostic_reports', name: 'Diagnostic & Lab Reports', description: 'Blood tests, MRI, CT scans supporting diagnosis', required: true, fileTypes: ['.pdf', '.jpg', '.png'] },
      { id: 'pre_auth_form', name: 'Pre-Authorization Form', description: 'For cashless requests submitted prior to treatment', required: false, fileTypes: ['.pdf', '.jpg', '.png'] }
    ],
    fraudSignalsList: [
      { name: 'Inflated Hospital Bills', category: 'type_specific', description: 'Line items significantly exceed standard package rates.' },
      { name: 'Duplicate Bill Submission', category: 'type_specific', description: 'Bill receipt numbers match previously submitted claims.' },
      { name: 'Hospital-Diagnosis Mismatch', category: 'type_specific', description: 'Hospital specialty does not match treating illness.' },
      { name: 'Overlapping Hospitalization Dates', category: 'base', description: 'Inpatient dates overlap with another active claim or job attendance.' }
    ],
    estimationRulesDescription: 'Sum of eligible hospital bills up to Sum Insured, minus policy co-pay % (e.g. 10%) and deductibles. Critical Illness = Fixed % slab of Sum Insured.'
  },
  motor: {
    type: 'motor',
    title: 'Motor Insurance',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800',
    iconName: 'Car',
    description: 'Vehicle own damage, total loss, IDV valuation, and third-party liability.',
    subTypes: [
      { value: 'own_damage', label: 'Own Damage (Accident/Repair)', description: 'Garage repair costs minus depreciation and deductible excess.' },
      { value: 'total_loss', label: 'Total Loss / Vehicle Theft', description: 'Full Insured Declared Value (IDV) payout.' },
      { value: 'third_party', label: 'Third-Party Property/Injury', description: 'External damage/injury claim. Routed to agent review.' }
    ],
    requiredDocs: [
      { id: 'rc_copy', name: 'Registration Certificate (RC)', description: 'Valid vehicle RC book/card', required: true, fileTypes: ['.pdf', '.jpg', '.png'] },
      { id: 'dl_copy', name: 'Driving License', description: 'Driver license valid on the date of accident', required: true, fileTypes: ['.pdf', '.jpg', '.png'] },
      { id: 'repair_estimate', name: 'Garage Repair Estimate', description: 'Authorized workshop detailed repair cost estimate', required: true, fileTypes: ['.pdf', '.jpg', '.png'] },
      { id: 'damage_photos', name: 'Vehicle Damage Photographs', description: 'Clear photos showing license plate and damaged parts', required: true, fileTypes: ['.jpg', '.png'] },
      { id: 'fir_police', name: 'FIR / Police Accident Report', description: 'Mandatory for theft, major injury, or third-party damage', required: false, fileTypes: ['.pdf', '.jpg', '.png'] }
    ],
    fraudSignalsList: [
      { name: 'RC-Policy Vehicle Mismatch', category: 'type_specific', description: 'Chassis/Engine number on RC differs from policy schedule.' },
      { name: 'Expired Driving License', category: 'type_specific', description: 'Driver license was expired on the reported date of accident.' },
      { name: 'Pre-existing Vehicle Damage', category: 'type_specific', description: 'Photos reveal rust or prior un-repaired damage on affected panels.' },
      { name: 'Inflated Workshop Estimate', category: 'type_specific', description: 'Part replacement costs exceed OEM standard pricing by >30%.' }
    ],
    estimationRulesDescription: 'Own Damage = (Repair Estimate − Metal/Plastic Depreciation − Policy Excess), capped at IDV. Total Loss = 100% IDV. Third-Party = Routed to Agent.'
  },
  home: {
    type: 'home',
    title: 'Home Insurance',
    badgeColor: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950 dark:text-purple-300 dark:border-purple-800',
    iconName: 'Home',
    description: 'Structural property damage, natural disasters, theft, and content loss.',
    subTypes: [
      { value: 'structure_damage', label: 'Building Structural Damage', description: 'Fire, earthquake, flood structural repairs.' },
      { value: 'content_loss_theft', label: 'Household Content Loss / Burglary', description: 'Furniture, electronics, and valuable theft or damage.' }
    ],
    requiredDocs: [
      { id: 'ownership_proof', name: 'Property Ownership / Lease', description: 'Title deed, tax receipt, or registered lease agreement', required: true, fileTypes: ['.pdf', '.jpg', '.png'] },
      { id: 'fir_theft', name: 'FIR / Fire Department Report', description: 'Police FIR for burglary or Fire Brigade report for fire damage', required: true, fileTypes: ['.pdf', '.jpg', '.png'] },
      { id: 'damage_photos', name: 'Property Damage Photos / Video', description: 'Geotagged photos/videos showing affected structure & items', required: true, fileTypes: ['.jpg', '.png', '.pdf'] },
      { id: 'repair_quote', name: 'Contractor Repair / Replacement Estimate', description: 'Detailed bill of quantities from licensed contractor', required: true, fileTypes: ['.pdf', '.jpg', '.png'] }
    ],
    fraudSignalsList: [
      { name: 'Repeated Peril Claims', category: 'type_specific', description: 'Multiple claims filed for same location within 6 months.' },
      { name: 'Estimate vs Property Value Inflation', category: 'type_specific', description: 'Claimed repair cost exceeds total structural valuation.' },
      { name: 'Lack of Official Fire/Police Validation', category: 'type_specific', description: 'Fire department certificate missing for major fire claim.' }
    ],
    estimationRulesDescription: 'Lower of (Actual Repair/Replacement Cost, Property Sum Insured) minus policy deductible excess (e.g., ₹25,000).'
  },
  travel: {
    type: 'travel',
    title: 'Travel Insurance',
    badgeColor: 'bg-[#FFE1AF] text-[#8F6218] border-[#E2B59A]',
    iconName: 'Plane',
    description: 'International medical emergencies, flight cancellation/delay, and lost baggage.',
    subTypes: [
      { value: 'medical_emergency', label: 'Overseas Medical Emergency', description: 'Hospitalization and medical costs abroad.' },
      { value: 'trip_cancellation_delay', label: 'Trip Cancellation or Flight Delay', description: 'Fixed slab reimbursement for airline delays > 6 hrs.' },
      { value: 'baggage_loss', label: 'Baggage Loss / Delay', description: 'Property Irregularity Report (PIR) schedule payout.' }
    ],
    requiredDocs: [
      { id: 'passport_visa', name: 'Passport & Visa Stamps', description: 'Copy showing immigration entry/exit stamps', required: true, fileTypes: ['.pdf', '.jpg', '.png'] },
      { id: 'itinerary', name: 'Flight Ticket & Boarding Passes', description: 'Confirmed travel itinerary and ticket booking receipt', required: true, fileTypes: ['.pdf', '.jpg', '.png'] },
      { id: 'airline_cert', name: 'Airline Delay / PIR Report', description: 'Property Irregularity Report (PIR) or delay certificate from airline', required: true, fileTypes: ['.pdf', '.jpg', '.png'] },
      { id: 'medical_bills_overseas', name: 'Overseas Medical Receipts', description: 'Bills and hospital reports for emergency treatment', required: false, fileTypes: ['.pdf', '.jpg', '.png'] }
    ],
    fraudSignalsList: [
      { name: 'Out-of-Validity Travel Dates', category: 'type_specific', description: 'Incident occurred outside policy coverage start/end dates.' },
      { name: 'Duplicate Baggage Claim', category: 'type_specific', description: 'PIR reference number already compensated by airline or other insurer.' },
      { name: 'Self-Inflicted Cancellation', category: 'type_specific', description: 'Cancellation reason not covered under emergency policy terms.' }
    ],
    estimationRulesDescription: 'Medical = Actual bills up to sub-limit (₹50,00,000 max). Trip Cancellation = Fixed policy schedule slabs. Baggage Loss = ₹10,000 per bag up to ₹1,00,000 max.'
  },
  personal_accident: {
    type: 'personal_accident',
    title: 'Personal Accident Insurance',
    badgeColor: 'bg-[#FFE1AF] text-[#B77466] border-[#E2B59A]',
    iconName: 'ShieldAlert',
    description: 'Accidental death, permanent total/partial disability (PTD/PPD), and temporary disability.',
    subTypes: [
      { value: 'pa_accidental_death', label: 'Accidental Death Benefit', description: '100% Capital Sum Insured paid to nominee.' },
      { value: 'ptd', label: 'Permanent Total Disability (PTD)', description: '100% Capital Sum Insured paid for complete disability.' },
      { value: 'ppd', label: 'Permanent Partial Disability (PPD)', description: 'Scheduled % of Capital Sum Insured based on disability degree.' },
      { value: 'ttd', label: 'Temporary Total Disability (TTD)', description: 'Weekly income benefit for temporary wage loss.' }
    ],
    requiredDocs: [
      { id: 'fir_police_pa', name: 'FIR / Panchnama Report', description: 'Police accident report describing cause and incident', required: true, fileTypes: ['.pdf', '.jpg', '.png'] },
      { id: 'disability_cert', name: 'Disability Certificate', description: 'Govt Medical Board certificate showing disability percentage', required: true, fileTypes: ['.pdf', '.jpg', '.png'] },
      { id: 'hospital_admission', name: 'Hospital Inpatient Records', description: 'Treatment notes, operation summary, and discharge card', required: true, fileTypes: ['.pdf', '.jpg', '.png'] },
      { id: 'income_proof', name: 'Income Proof / Salary Slip', description: 'Required for TTD weekly wage loss benefit calculation', required: false, fileTypes: ['.pdf', '.jpg', '.png'] }
    ],
    fraudSignalsList: [
      { name: 'FIR-Hospital Timeline Mismatch', category: 'type_specific', description: 'Accident date on FIR does not match hospital admission date.' },
      { name: 'Inconsistent Disability Percentage', category: 'type_specific', description: 'Disability degree on claim exceeds medical board guidelines.' },
      { name: 'Pre-existing Disability Non-disclosure', category: 'type_specific', description: 'Medical history reveals prior disability before policy issue.' }
    ],
    estimationRulesDescription: 'Death / PTD = 100% Capital Sum Insured. PPD = Scheduled % (e.g., 50% for loss of one limb). TTD = ₹25,000/week for up to 52 weeks.'
  },
  liability: {
    type: 'liability',
    title: 'Liability & Business',
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800',
    iconName: 'Briefcase',
    description: 'Professional indemnity, public liability, and errors & omissions. Human Agent review mandatory.',
    subTypes: [
      { value: 'professional_indemnity', label: 'Professional Indemnity', description: 'Negligence or professional advice loss claims.' },
      { value: 'public_liability', label: 'Public Liability', description: 'Third-party injury or property damage on business premises.' },
      { value: 'errors_omissions', label: 'Errors & Omissions (E&O)', description: 'Contract breach or commercial service delivery failure.' }
    ],
    requiredDocs: [
      { id: 'legal_notice', name: 'Legal Notice / Demand Letter', description: 'Copy of legal notice or lawsuit filed by third-party claimant', required: true, fileTypes: ['.pdf', '.jpg', '.png'] },
      { id: 'engagement_contract', name: 'Contract / Engagement Agreement', description: 'Commercial agreement specifying scope and indemnity clause', required: true, fileTypes: ['.pdf', '.jpg', '.png'] },
      { id: 'incident_report_biz', name: 'Internal Incident Audit Report', description: 'Company incident report detailing timeline and root cause', required: true, fileTypes: ['.pdf', '.jpg', '.png'] },
      { id: 'business_reg', name: 'Business Registration Proof', description: 'GST / Incorporation certificate', required: true, fileTypes: ['.pdf', '.jpg', '.png'] }
    ],
    fraudSignalsList: [
      { name: 'Exceeding Policy Indemnity Limit', category: 'type_specific', description: 'Demanded liability amount exceeds maximum policy limit.' },
      { name: 'Inconsistent Legal Correspondence Dates', category: 'type_specific', description: 'Legal notice date precedes reported occurrence date.' },
      { name: 'Collusion / Non-arm Length Transaction', category: 'type_specific', description: 'Claimant company shares common directors or ownership.' }
    ],
    estimationRulesDescription: 'Exposure Ceiling = min(Claimed Amount, Policy Limit) minus policy deductible. Mandatory Agent & Legal Review (No Auto-Settlement).'
  }
};
