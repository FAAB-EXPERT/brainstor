import React, { useState, useMemo, useEffect } from 'react';
import { 
  FolderOpen, Target, Settings, Menu, 
  Plus, Briefcase, X, Home, Trash2, Network, Lightbulb, BookOpen,
  Mail, Phone, AlertCircle, Download, Upload, Printer, RotateCcw,
  CheckCircle2, Filter
} from 'lucide-react';

// --- TYPESCRIPT INTERFACES ---
export interface ResourceItem {
  label: string;
  amount: string;
}

export interface ProblemDetail {
  contrainte: string;
  cause: string[];
  besoin: string[];
}

export interface ProblemBranch {
  axeName: string;
  central: string;
  details: ProblemDetail[];
}

export interface ProjectSolution {
  extrant: string;
  extrantCmr?: string;
  activites: string[];
  intrants_rh: ResourceItem[][];
  intrants_mat: ResourceItem[][];
  couts: string[];
  cout?: string;
  responsable?: string;
  periode?: string;
}

export interface AxeSolution {
  nom: string;
  effet: string;
  budget: string;
  projets: ProjectSolution[];
}

export interface BrainstormIdea {
  id: string;
  textNegative: string;
  textPositive: string;
  color: string;
  text?: string;
}

export interface Stakeholder {
  nom: string;
  intervention?: string;
  competence?: string;
  attentes?: string;
  contraintes?: string;
  pointFort?: string;
  pointFaible?: string;
  problemes?: string;
  axe: number;
  projetIndex: number;
}

export interface RiskItem {
  id: string;
  niveau: string;
  logique?: string;
  hypothese?: string;
  contrainte?: string;
  cause?: string;
  level?: string;
  responsable?: string;
  mitigation?: string;
  axe: number;
  linkedAxeIndex?: number | null;
  linkedBranchIndex?: number | null;
}

export interface GARData {
  brainstorming: BrainstormIdea[];
  stakeholders: {
    beneficiaires: Stakeholder[];
    instCentralises: Stakeholder[];
    instDecentralises: Stakeholder[];
    operateursTechniques: Stakeholder[];
    ptf: Stakeholder[];
    [key: string]: Stakeholder[];
  };
  problems: {
    consequenceGlobale: string;
    branches: ProblemBranch[];
  };
  rendement: {
    impact: string;
    axes: AxeSolution[];
  };
  risks: RiskItem[];
  fiche?: {
    lieu?: string;
    duree?: string;
    moa?: string;
    moe?: string;
    partenaires?: string;
    strategie?: string;
  };
  cadrageStrategique?: {
    vision?: string;
    mission?: string;
    objectifGeneral?: string;
  };
}

export interface Portfolio {
  id: string;
  name: string;
  institution: string;
  description: string;
  serviceName?: string;
  budget?: string;
  status: string;
  isEditable: boolean;
  isTrashed: boolean;
  entityLevel?: string;
  displayName?: string;
  garData: GARData;
}

export interface FilterContext {
  type: 'all' | 'axe' | 'projet';
  focusedBranches: { axeIndex: number; projetIndex: number }[];
  focusedAxes: number[];
}

// HELPER: Garantit que les données sont toujours un tableau
const ensureArray = <T,>(val: T | T[] | undefined | null): T[] => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    return (val.split('\n').map(s => s.trim()).filter(Boolean) as unknown) as T[];
  }
  return [val];
};

// HELPERS DE DONNÉES 2D (Pour gérer multiples intrants par activité)
const getSafe2D = (arr: ResourceItem[][] | undefined | null, k: number): ResourceItem[] => {
  if (!Array.isArray(arr)) return [];
  if (arr.length > 0 && !Array.isArray(arr[0])) {
    return k === 0 ? ((arr as unknown) as ResourceItem[]) : [];
  }
  return arr[k] || [];
};

// HELPER: Formatage et calculs financiers
const parseAmount = (val: string | number | undefined | null): number => {
  if (!val) return 0;
  const strVal = val.toString();
  const cleaned = strVal.replace(/\s+/g, '').replace(/FCFA|CFA|F/gi, '').replace(',', '.');
  const match = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!match) return 0;
  const num = parseFloat(match[0]);
  return isNaN(num) ? 0 : num;
};

const formatAmount = (num: number): string => {
  return new Intl.NumberFormat('fr-FR').format(num) + ' FCFA';
};

const calculateActivityTotal = (proj: ProjectSolution | undefined, k: number): { sum: number; hasAmounts: boolean } => {
  let sum = 0;
  let hasAmounts = false;
  const process = (items: ResourceItem[]) => {
    if (!Array.isArray(items)) return;
    items.forEach(item => {
      if (typeof item === 'object' && item?.amount) {
        const val = parseAmount(item.amount);
        if (val > 0) {
          sum += val;
          hasAmounts = true;
        }
      }
    });
  };
  if (proj) {
    process(getSafe2D(proj.intrants_rh, k));
    process(getSafe2D(proj.intrants_mat, k));
  }
  return { sum, hasAmounts };
};

const getProjectEffectiveCost = (proj: ProjectSolution | undefined): number => {
  if (!proj) return 0;
  const actCount = Math.max(ensureArray(proj.activites).length, 1);
  let total = 0;
  for (let k = 0; k < actCount; k++) {
    const { sum } = calculateActivityTotal(proj, k);
    total += sum;
  }
  return total;
};

// COMPOSANT: Cellule Editable générique avec support de Préfixe Fixe
interface EditableCellProps {
  isEditable: boolean;
  value: string | string[] | undefined;
  onChange: (val: string | string[]) => void;
  type?: 'text' | 'textarea' | 'list' | 'numberList';
  placeholder?: string;
  fixedPrefix?: string;
}

const EditableCell: React.FC<EditableCellProps> = ({
  isEditable,
  value,
  onChange,
  type = 'text',
  placeholder = '...',
  fixedPrefix = ''
}) => {
  let displayValue: string | string[] = value ?? '';
  if (fixedPrefix && typeof displayValue === 'string' && !displayValue.startsWith(fixedPrefix)) {
    displayValue = fixedPrefix;
  }

  if (!isEditable) {
    if (type === 'list') {
      const arr = ensureArray(displayValue);
      if (arr.length === 0) return <span className="text-slate-400 italic text-xs">-</span>;
      return <ul className="list-disc pl-4 space-y-1">{arr.map((v, i) => <li key={i}>{v}</li>)}</ul>;
    }
    if (type === 'numberList') {
      const arr = ensureArray(displayValue);
      if (arr.length === 0) return <span className="text-slate-400 italic text-xs">-</span>;
      return <ul className="list-decimal pl-4 space-y-1">{arr.map((v, i) => <li key={i}>{v}</li>)}</ul>;
    }
    return <span className="whitespace-pre-line text-xs font-medium text-slate-800">{(displayValue as string) || '-'}</span>;
  }

  if (type === 'textarea' || type === 'list' || type === 'numberList') {
    const textVal = Array.isArray(displayValue) ? displayValue.join('\n') : displayValue;
    return (
      <textarea
        className="w-full bg-orange-50/70 border border-orange-300 rounded p-2 text-slate-800 text-xs font-medium focus:ring-2 focus:ring-orange-500 min-h-[50px] shadow-inner transition-all leading-snug custom-scrollbar outline-none"
        value={textVal || ''}
        onChange={(e) => {
          let val = e.target.value;
          if (fixedPrefix && !val.startsWith(fixedPrefix)) val = fixedPrefix;
          onChange(type === 'list' || type === 'numberList' ? val.split('\n') : val);
        }}
        placeholder={placeholder}
      />
    );
  }

  return (
    <input
      type="text"
      className="w-full bg-orange-50/70 border border-orange-300 rounded p-2 text-slate-800 text-xs font-medium focus:ring-2 focus:ring-orange-500 shadow-inner transition-all outline-none"
      value={(displayValue as string) || ''}
      onChange={(e) => {
        let val = e.target.value;
        if (fixedPrefix && !val.startsWith(fixedPrefix)) val = fixedPrefix;
        onChange(val);
      }}
      placeholder={placeholder}
    />
  );
};

// COMPOSANT: Liste de Ressources Éditable (RH & Matériel)
interface EditableResourceListProps {
  isEditable: boolean;
  items: ResourceItem[] | undefined;
  onChange: (items: ResourceItem[]) => void;
  placeholderLabel?: string;
}

const EditableResourceList: React.FC<EditableResourceListProps> = ({
  isEditable,
  items,
  onChange,
  placeholderLabel = 'Désignation...'
}) => {
  const normalizedArr = useMemo(() => {
    if (!items) return [];
    if (!Array.isArray(items)) {
      if (typeof items === 'string') {
        return (items as string).split('\n').filter(s => s.trim()).map(s => ({ label: s.trim(), amount: '' }));
      }
      return [];
    }
    return items.map(item => (typeof item === 'string' ? { label: item, amount: '' } : item));
  }, [items]);

  if (!isEditable) {
    if (normalizedArr.length === 0) return <p className="text-[10px] italic text-slate-400">Non défini</p>;
    return (
      <ul className="text-[10px] leading-tight font-medium text-slate-800 list-disc pl-4 space-y-0.5">
        {normalizedArr.map((item, idx) => (
          <li key={idx} className="break-words">
            {item.label} {item.amount && <span className="font-bold text-emerald-700 ml-1">({item.amount})</span>}
          </li>
        ))}
      </ul>
    );
  }

  const updateItem = (idx: number, field: keyof ResourceItem, val: string) => {
    const newArr = [...normalizedArr];
    newArr[idx] = { ...newArr[idx], [field]: val };
    onChange(newArr);
  };

  const addItem = () => onChange([...normalizedArr, { label: '', amount: '' }]);
  const removeItem = (idx: number) => onChange(normalizedArr.filter((_, i) => i !== idx));

  return (
    <div className="space-y-1.5 w-full">
      {normalizedArr.map((item, idx) => (
        <div key={idx} className="flex items-center gap-1 bg-white/90 p-1 rounded border border-slate-200 shadow-sm">
          <input
            type="text"
            className="flex-1 min-w-0 bg-transparent text-[9px] font-bold text-slate-800 focus:outline-none placeholder:text-slate-400"
            value={item.label || ''}
            onChange={e => updateItem(idx, 'label', e.target.value)}
            placeholder={placeholderLabel}
          />
          <input
            type="text"
            className="w-16 min-w-0 bg-emerald-50 text-[9px] font-bold text-emerald-800 border-l border-slate-200 pl-1 focus:outline-none placeholder:text-emerald-400"
            value={item.amount || ''}
            onChange={e => updateItem(idx, 'amount', e.target.value)}
            placeholder="Coût..."
          />
          <button
            onClick={() => removeItem(idx)}
            className="text-red-400 hover:text-red-600 px-0.5 cursor-pointer"
            title="Supprimer"
          >
            <X size={12} />
          </button>
        </div>
      ))}
      <button
        onClick={addItem}
        className="flex items-center justify-center w-full gap-1 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded border border-dashed border-slate-300 transition-colors text-[9px] font-bold uppercase tracking-wider cursor-pointer"
      >
        <Plus size={10} /> Ajouter
      </button>
    </div>
  );
};

// HELPER UI: Rendu du budget par activité
const renderActivityCost = (proj: ProjectSolution | undefined, k: number) => {
  const { sum } = calculateActivityTotal(proj, k);
  return (
    <div className="text-center p-1.5 bg-emerald-50 rounded border border-emerald-300 shadow-inner w-full">
      <span className="text-[11px] font-black text-emerald-900 block tabular-nums">{formatAmount(sum)}</span>
      <span className="text-[7px] uppercase font-bold text-emerald-700 block mt-0.5 opacity-90 tracking-widest">Calcul auto</span>
    </div>
  );
};

// LIGNES RÉUTILISABLES POUR LES TABLEAUX
const AxeRow: React.FC<{ axe: AxeSolution; colSpan: number }> = ({ axe, colSpan }) => (
  <tr className="bg-slate-200 border-y-2 border-slate-300">
    <td colSpan={colSpan} className="sticky left-0 z-10 px-3 py-2 font-black text-slate-900 bg-slate-200 uppercase tracking-widest text-xs">
      {axe?.nom || 'Axe sans nom'}
    </td>
  </tr>
);

const ProjRow: React.FC<{ proj: ProjectSolution; pIdx: number; colSpan: number }> = ({ proj, pIdx, colSpan }) => (
  <tr className="bg-slate-100 border-y border-slate-200">
    <td colSpan={colSpan} className="sticky left-0 z-10 px-3 py-1.5 font-bold text-slate-700 bg-slate-100 uppercase text-[10px] tracking-wider">
      Sous-Problème {pIdx + 1} (Projet {pIdx + 1}) : {proj?.extrant || 'Projet sans nom'}
    </td>
  </tr>
);

// COMPOSANT: Sélecteur d'idées depuis le Brainstorming
interface BrainstormingSelectProps {
  value: string | undefined;
  onChange: (negativeText: string, positiveText: string) => void;
  className?: string;
  placeholder?: string;
  ideas: BrainstormIdea[] | undefined;
}

const BrainstormingSelect: React.FC<BrainstormingSelectProps> = ({
  value,
  onChange,
  className = '',
  placeholder = 'Choisir une idée...',
  ideas = []
}) => {
  const options = (ideas || []).filter(
    i => (i.textNegative && i.textNegative.trim() !== '') || (i.text && i.text.trim() !== '')
  );

  const selectedIdea = options.find(o => (o.textNegative || o.text) === value);
  const selectValue = selectedIdea ? selectedIdea.id : value ? 'custom_value' : '';

  return (
    <select
      className={`w-full p-2 outline-none cursor-pointer text-center font-bold text-xs rounded transition-all shadow-sm ${className}`}
      value={selectValue}
      onChange={(e) => {
        const selectedId = e.target.value;
        const idea = options.find(i => i.id === selectedId);
        if (idea) {
          onChange(idea.textNegative || idea.text || '', idea.textPositive || '');
        }
      }}
      title={value || placeholder}
    >
      <option value="" disabled>
        {placeholder}
      </option>
      {options.map(idea => {
        const negText = idea.textNegative || idea.text || '';
        return (
          <option key={idea.id} value={idea.id}>
            {negText.length > 70 ? negText.substring(0, 70) + '...' : negText}
          </option>
        );
      })}
      {value && !selectedIdea && (
        <option value="custom_value" disabled>
          {value.length > 70 ? value.substring(0, 70) + '...' : value}
        </option>
      )}
    </select>
  );
};

// --- BASE DE DONNÉES INITIALE ---
const initialData: Portfolio[] = [
  {
    id: 'port-demo',
    name: 'Programme National Santé Maternelle & Néonatale',
    institution: 'Ministère de la Santé Publique',
    description: 'Modèle GAR complet démontrant le passage des idées de brainstorming à l\'arbre à problèmes, solutions, intrants chiffrés et registre parties prenantes.',
    serviceName: 'Direction Santé Familiale',
    budget: '14 500 000 FCFA',
    status: 'Validé',
    isEditable: true,
    isTrashed: false,
    garData: {
      brainstorming: [
        {
          id: 'idea-1',
          textNegative: 'Taux de mortalité maternelle élevé lors des accouchements dans les centres ruraux.',
          textPositive: 'Baisse significative du taux de mortalité maternelle en zones rurales.',
          color: 'bg-rose-100'
        },
        {
          id: 'idea-2',
          textNegative: 'Insuffisance de sages-femmes formées aux urgences obstétricales néonatales.',
          textPositive: 'Personnel obstétrical qualifié et certifié aux gestes d\'urgence.',
          color: 'bg-amber-100'
        },
        {
          id: 'idea-3',
          textNegative: 'Pénurie récurrente de kits d\'accouchement stérile et sang pour transfusion.',
          textPositive: 'Approvisionnement continu et traçabilité des kits d\'urgence et poches de sang.',
          color: 'bg-emerald-100'
        },
        {
          id: 'idea-4',
          textNegative: 'Rupture de la chaîne du froid pour les vaccins néonatals.',
          textPositive: 'Chaîne de conservation solaire opérationnelle 24/7 dans tous les dispensaires.',
          color: 'bg-sky-100'
        }
      ],
      stakeholders: {
        beneficiaires: [
          { nom: 'Femmes enceintes et nouveau-nés des districts cibles', axe: 1, projetIndex: 0 },
          { nom: 'Communautés villageoises et comités de santé (COGES)', axe: 1, projetIndex: 0 }
        ],
        instCentralises: [
          { nom: 'Direction de la Santé Maternelle et Infantile (DSMI)', axe: 1, projetIndex: 0 }
        ],
        instDecentralises: [
          { nom: 'Directions Régionales de la Santé et Chefs de Districts', axe: 1, projetIndex: 0 }
        ],
        operateursTechniques: [
          { nom: 'Ordre National des Sages-Femmes & Société de Gynécologie', axe: 1, projetIndex: 0 }
        ],
        ptf: [
          { nom: 'OMS, UNICEF, Fonds Mondial', axe: 1, projetIndex: 0 }
        ]
      },
      problems: {
        consequenceGlobale: 'Taux de mortalité maternelle élevé lors des accouchements dans les centres ruraux.',
        branches: [
          {
            axeName: 'Service 1 : Prise en charge obstétricale',
            central: 'Insuffisance de sages-femmes formées aux urgences obstétricales néonatales.',
            details: [
              {
                contrainte: 'Pénurie récurrente de kits d\'accouchement stérile et sang pour transfusion.',
                cause: ['Rupture d\'approvisionnement au niveau du dépôt central pharmaceutique regional'],
                besoin: ['Mise en place d\'une réserve tampon sécurisée et protocole de réapprovisionnement sous 48h']
              }
            ]
          }
        ]
      },
      rendement: {
        impact: 'Baisse significative du taux de mortalité maternelle en zones rurales.',
        axes: [
          {
            nom: 'Service 1 : Prise en charge obstétricale',
            effet: 'Personnel obstétrical qualifié et certifié aux gestes d\'urgence.',
            budget: '14 500 000 FCFA',
            projets: [
              {
                extrant: 'Approvisionnement continu et traçabilité des kits d\'urgence et poches de sang.',
                activites: [
                  'Organisation de sessions de formation pratique et dotation en kits stériles d\'intervention'
                ],
                intrants_rh: [
                  [
                    { label: 'Médecin formateur obstétricien (3 jrs)', amount: '600000 FCFA' },
                    { label: 'Superviseur de district (5 jrs)', amount: '350000 FCFA' }
                  ]
                ],
                intrants_mat: [
                  [
                    { label: 'Kits d\'urgence obstétricale complète (50 unités)', amount: '3500000 FCFA' },
                    { label: 'Mannequins de simulation clinique', amount: '1200000 FCFA' }
                  ]
                ],
                couts: ['5650000 FCFA'],
                responsable: 'Dr. Kouadio - Coordinateur Santé Rurale',
                periode: 'T1 - T3 2026'
              }
            ]
          }
        ]
      },
      risks: [
        {
          id: 'risk-1',
          niveau: 'EFFET',
          logique: 'Formation continue',
          hypothese: 'Stabilité des affectations du personnel de santé en zone rurale',
          level: 'MOYEN',
          axe: 1
        }
      ],
      fiche: {
        lieu: 'Districts Sanitaires Région Ouest',
        duree: '12 Mois (2026)',
        moa: 'Ministère de la Santé',
        moe: 'Direction Régionale de la Santé',
        partenaires: 'UNICEF / OMS',
        strategie: 'Décentralisation des capacités obstétricales d\'urgence'
      }
    }
  },
  {
    id: 'port-1',
    name: 'Nouveau Portefeuille (À nommer)',
    institution: 'Institution par défaut',
    description: 'Espace d\'expérimentation libre pour simuler et concevoir un portefeuille selon la méthodologie GAR.',
    serviceName: 'Service 1',
    budget: '0 FCFA',
    status: 'Brouillon',
    isEditable: true,
    isTrashed: false,
    garData: {
      brainstorming: [],
      stakeholders: { beneficiaires: [], instCentralises: [], instDecentralises: [], operateursTechniques: [], ptf: [] },
      problems: {
        consequenceGlobale: '',
        branches: [{ axeName: 'Service 1', central: '', details: [{ contrainte: '', cause: [''], besoin: [''] }] }]
      },
      rendement: {
        impact: '',
        axes: [
          {
            nom: 'Service 1',
            effet: '',
            budget: '0 FCFA',
            projets: [{ extrant: '', extrantCmr: '', activites: [''], intrants_rh: [[]], intrants_mat: [[]], couts: [''], responsable: '', periode: '' }]
          }
        ]
      },
      risks: [],
      fiche: { lieu: '', duree: '', moa: '', moe: '', partenaires: '', strategie: '' }
    }
  }
];

const MAX_SANDBOXES = 10;
const STORAGE_KEY = 'faab_gar_portfolios_v1';

// BOUTONS ET COMPOSANTS GÉNÉRIQUES
interface ButtonProps {
  children: React.ReactNode;
  onClick?: (e?: React.MouseEvent) => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  icon?: React.ElementType;
  className?: string;
  disabled?: boolean;
  title?: string;
}

const Button: React.FC<ButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  icon: Icon,
  className = '',
  disabled = false,
  title = ''
}) => {
  const baseStyle =
    'flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg font-medium text-xs transition-all cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-50 disabled:cursor-not-allowed';
  const variants = {
    primary: 'bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm border border-emerald-700/20 active:translate-y-px',
    secondary: 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-300 shadow-xs active:translate-y-px',
    danger: 'bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 active:translate-y-px',
    ghost: 'text-slate-600 hover:bg-slate-100'
  };
  return (
    <button onClick={onClick} className={`${baseStyle} ${variants[variant]} ${className}`} disabled={disabled} title={title}>
      {Icon && <Icon size={16} />}
      <span>{children}</span>
    </button>
  );
};

const Card: React.FC<{ children: React.ReactNode; className?: string; onClick?: () => void }> = ({
  children,
  className = '',
  onClick
}) => (
  <div onClick={onClick} className={`bg-white rounded-xl shadow-xs border border-slate-200 p-6 ${className}`}>
    {children}
  </div>
);

const NoProjectScreen: React.FC<{ setActiveTab: (tab: string) => void }> = ({ setActiveTab }) => (
  <div className="flex flex-col items-center justify-center h-full text-slate-500 py-16">
    <div className="w-16 h-16 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 border border-emerald-100">
      <FolderOpen size={32} />
    </div>
    <h2 className="text-xl font-black text-slate-800">Aucun Portefeuille Actif</h2>
    <p className="mt-2 text-center max-w-md text-sm text-slate-500">
      Pour accéder aux outils de la méthodologie GAR (Brainstorming, Arbres, Registre), veuillez d'abord ouvrir un portefeuille dans la section <strong>Dossiers & Projets</strong>.
    </p>
    <Button className="mt-6" onClick={() => setActiveTab('dossier')} icon={FolderOpen}>
      Consulter les Dossiers
    </Button>
  </div>
);

// --- APPLICATION PRINCIPALE ---
export default function App() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('accueil');
  const [activeSubTab, setActiveSubTab] = useState('');

  // Persistance dans LocalStorage
  const [portfolios, setPortfolios] = useState<Portfolio[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return initialData;
  });

  const [activeProject, setActiveProject] = useState<Portfolio | null>(() => {
    return portfolios.find(p => !p.isTrashed) || null;
  });

  // Sauvegarde automatique
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(portfolios));
    } catch {
      // ignore
    }
  }, [portfolios]);

  // SYSTÈME DE FILTRE MULTI-BRANCHES
  const [filterContext, setFilterContext] = useState<FilterContext>({
    type: 'all',
    focusedBranches: [],
    focusedAxes: []
  });

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: (() => void) | null;
  }>({ isOpen: false, title: '', message: '', onConfirm: null });

  const openConfirmModal = (title: string, message: string, onConfirm: () => void) =>
    setConfirmModal({ isOpen: true, title, message, onConfirm });
  const closeConfirmModal = () =>
    setConfirmModal({ isOpen: false, title: '', message: '', onConfirm: null });

  // HELPERS DE VISIBILITÉ POUR LE MULTI-FOCUS
  const isAxeFocused = (axeIdx: number) => {
    if (filterContext.type === 'all') return true;
    if (filterContext.type === 'axe') return (filterContext.focusedAxes || []).includes(axeIdx);
    return (filterContext.focusedBranches || []).some(f => f.axeIndex === axeIdx);
  };

  const isProjFocused = (axeIdx: number, projIdx: number) => {
    if (filterContext.type === 'all') return true;
    if (filterContext.type === 'axe') return (filterContext.focusedAxes || []).includes(axeIdx);
    return (filterContext.focusedBranches || []).some(f => f.axeIndex === axeIdx && f.projetIndex === projIdx);
  };

  const menuItems = [
    { id: 'accueil', label: 'Accueil', icon: Home },
    { id: 'dossier', label: 'Dossiers & Projets', icon: FolderOpen },
    { id: 'brainstorming', label: 'Brainstorming', icon: Lightbulb },
    { id: 'arbre', label: 'Arbre à problèmes', icon: Network },
    { id: 'solutions', label: 'Arbre à solutions', icon: Target },
    { id: 'registre_parties', label: 'Registre Parties Prenantes', icon: BookOpen }
  ];

  const handleTabClick = (item: (typeof menuItems)[0]) => {
    setActiveTab(item.id);
  };

  const handleEnterGAR = (entity: Portfolio) => {
    setActiveProject({ ...entity });
    setFilterContext({ type: 'all', focusedBranches: [], focusedAxes: [] });
    setActiveTab('brainstorming');
  };

  const updateProject = (updaterFn: (clone: Portfolio) => void) => {
    if (!activeProject?.isEditable) return;
    const clone = JSON.parse(JSON.stringify(activeProject)) as Portfolio;
    updaterFn(clone);
    setActiveProject(clone);
    setPortfolios(prev => prev.map(p => (p.id === clone.id ? clone : p)));
  };

  const currentSandboxesCount = portfolios.filter(p => p.isEditable && !p.isTrashed).length;
  const canCreateNew = currentSandboxesCount < MAX_SANDBOXES;

  const createNewSandbox = () => {
    if (!canCreateNew) return;
    const newSandbox: Portfolio = JSON.parse(JSON.stringify(initialData[1]));
    newSandbox.id = `port-${Date.now()}`;
    newSandbox.name = `Projet GAR #${portfolios.length + 1}`;
    const updated = [...portfolios, newSandbox];
    setPortfolios(updated);
    setActiveProject(newSandbox);
  };

  const handleTrashPortfolio = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    openConfirmModal('Mettre à la corbeille', 'Voulez-vous placer ce portefeuille dans la corbeille ?', () => {
      setPortfolios(prev => prev.map(p => (p.id === id ? { ...p, isTrashed: true } : p)));
      if (activeProject?.id === id) {
        const remaining = portfolios.find(p => p.id !== id && !p.isTrashed);
        setActiveProject(remaining || null);
      }
    });
  };

  // Réinitialisation aux données démo
  const handleResetDemoData = () => {
    openConfirmModal(
      'Réinitialiser les données',
      'Voulez-vous restaurer les modèles officiels de démonstration ? Toutes les modifications non sauvegardées seront réinitialisées.',
      () => {
        setPortfolios(initialData);
        setActiveProject(initialData[0]);
      }
    );
  };

  // Export JSON
  const handleExportJSON = () => {
    if (!activeProject) return;
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(activeProject, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `${activeProject.name.replace(/\s+/g, '_')}_GAR.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import JSON
  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = event => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (imported && imported.garData) {
          imported.id = `port-${Date.now()}`;
          imported.isEditable = true;
          imported.isTrashed = false;
          setPortfolios(prev => [...prev, imported]);
          setActiveProject(imported);
        }
      } catch {
        // ignore
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // --- ACTIONS BRAINSTORMING ---
  const handleAddIdea = () => {
    updateProject(p => {
      if (!p.garData.brainstorming) p.garData.brainstorming = [];
      p.garData.brainstorming.push({
        id: Date.now().toString(),
        textNegative: '',
        textPositive: '',
        color: 'bg-amber-100'
      });
    });
  };

  const handleDeleteIdea = (id: string) => {
    updateProject(p => {
      p.garData.brainstorming = (p.garData.brainstorming || []).filter(idea => idea.id !== id);
    });
  };

  const updateIdeaText = (id: string, field: 'textNegative' | 'textPositive', text: string) => {
    updateProject(p => {
      const idea = (p.garData.brainstorming || []).find(i => i.id === id);
      if (idea) idea[field] = text;
    });
  };

  const updateIdeaColor = (id: string, color: string) => {
    updateProject(p => {
      const idea = (p.garData.brainstorming || []).find(i => i.id === id);
      if (idea) idea.color = color;
    });
  };

  // --- ACTIONS GAR ---
  const handleAddAxe = () => {
    updateProject(p => {
      const idx = (p.garData.rendement.axes || []).length + 1;
      if (!p.garData.rendement.axes) p.garData.rendement.axes = [];
      if (!p.garData.problems.branches) p.garData.problems.branches = [];
      p.garData.rendement.axes.push({ nom: `Service ${idx}`, effet: '', budget: '0 FCFA', projets: [] });
      p.garData.problems.branches.push({ axeName: `Service ${idx}`, central: '', details: [] });
    });
  };

  const handleAddProject = (axeIndex: number) => {
    updateProject(p => {
      const pIdx = (p.garData.rendement.axes[axeIndex].projets || []).length + 1;
      p.garData.rendement.axes[axeIndex].projets.push({
        extrant: `Nouveau Projet ${pIdx}`,
        activites: [''],
        intrants_rh: [[]],
        intrants_mat: [[]],
        couts: [''],
        cout: '',
        responsable: '',
        periode: ''
      });
      p.garData.problems.branches[axeIndex].details.push({ contrainte: '', cause: [''], besoin: [''] });
    });
  };

  const handleDeleteAxe = (axeIndex: number, axeName: string) => {
    openConfirmModal("Supprimer l'Axe", `Supprimer l'axe "${axeName}" et tous ses projets ?`, () => {
      updateProject(p => {
        p.garData.rendement.axes.splice(axeIndex, 1);
        p.garData.problems.branches.splice(axeIndex, 1);
      });
    });
  };

  const handleDeleteProject = (axeIndex: number, projetIndex: number, projetName: string) => {
    openConfirmModal('Supprimer le Projet', `Supprimer le projet "${projetName || `Branche ${projetIndex + 1}`}" ?`, () => {
      updateProject(p => {
        p.garData.rendement.axes[axeIndex].projets.splice(projetIndex, 1);
        p.garData.problems.branches[axeIndex].details.splice(projetIndex, 1);
      });
    });
  };

  const handleAddCauseActivity = (axeIdx: number, projIdx: number) => {
    updateProject(p => {
      const detail = p.garData.problems.branches[axeIdx].details[projIdx];
      const proj = p.garData.rendement.axes[axeIdx].projets[projIdx];

      detail.cause = ensureArray(detail.cause);
      detail.cause.push('');
      detail.besoin = ensureArray(detail.besoin);
      detail.besoin.push('');

      proj.activites = ensureArray(proj.activites);
      proj.activites.push('');

      if (!Array.isArray(proj.intrants_rh)) {
        proj.intrants_rh = [];
      }
      proj.intrants_rh.push([]);

      if (!Array.isArray(proj.intrants_mat)) {
        proj.intrants_mat = [];
      }
      proj.intrants_mat.push([]);

      if (!Array.isArray(proj.couts)) proj.couts = [proj.cout || ''];
      proj.couts.push('');
    });
  };

  const handleRemoveCauseActivity = (axeIdx: number, projIdx: number, itemIdx: number) => {
    updateProject(p => {
      const detail = p.garData.problems.branches[axeIdx].details[projIdx];
      const proj = p.garData.rendement.axes[axeIdx].projets[projIdx];

      const causes = ensureArray(detail.cause);
      const besoins = ensureArray(detail.besoin);
      const acts = ensureArray(proj.activites);
      const rh: ResourceItem[][] = Array.isArray(proj.intrants_rh) ? [...proj.intrants_rh] : [];
      const mat: ResourceItem[][] = Array.isArray(proj.intrants_mat) ? [...proj.intrants_mat] : [];
      const couts = Array.isArray(proj.couts) ? [...proj.couts] : [proj.cout || ''];

      const removeAt = <T,>(arr: T[], fallback: T) => {
        if (arr.length > 1) arr.splice(itemIdx, 1);
        else arr[0] = fallback;
      };

      removeAt(causes, '');
      removeAt(besoins, '');
      removeAt(acts, '');
      removeAt(rh, []);
      removeAt(mat, []);
      removeAt(couts, '');

      detail.cause = causes;
      detail.besoin = besoins;
      proj.activites = acts;
      proj.intrants_rh = rh;
      proj.intrants_mat = mat;
      proj.couts = couts;
    });
  };

  const updateIntrants = (
    axeIdx: number,
    projIdx: number,
    actIdx: number,
    field: 'intrants_rh' | 'intrants_mat',
    val: ResourceItem[]
  ) => {
    updateProject(p => {
      const proj = p.garData.rendement.axes[axeIdx].projets[projIdx];
      let arr = proj[field];
      if (!Array.isArray(arr)) arr = [];
      while (arr.length <= actIdx) arr.push([]);
      arr[actIdx] = val;
      proj[field] = arr;
    });
  };

  const updateRisk = (axeIdx: number, niveau: string, field: string, value: unknown) => {
    updateProject(p => {
      let row = (p.garData.risks || []).find(c => c.axe === axeIdx && c.niveau === niveau);
      if (!row) {
        row = {
          id: Date.now().toString(),
          niveau,
          logique: '',
          hypothese: '',
          contrainte: '',
          cause: '',
          level: 'MOYEN',
          responsable: '',
          mitigation: '',
          axe: axeIdx
        };
        if (!p.garData.risks) p.garData.risks = [];
        p.garData.risks.push(row);
      }
      (row as unknown as Record<string, unknown>)[field] = value;
    });
  };

  const addStakeholder = (key: string, axeIdx: number, pIdx: number) => {
    updateProject(p => {
      if (!p.garData.stakeholders[key]) p.garData.stakeholders[key] = [];
      p.garData.stakeholders[key].push({
        nom: '',
        intervention: '',
        competence: '',
        attentes: '',
        contraintes: '',
        pointFort: '',
        pointFaible: '',
        problemes: '',
        axe: axeIdx,
        projetIndex: pIdx
      });
    });
  };

  const updateStakeholder = (key: string, _axeIdx: number, _pIdx: number, absIdx: number, field: keyof Stakeholder, value: unknown) => {
    updateProject(p => {
      if (p.garData.stakeholders[key]?.[absIdx]) {
        (p.garData.stakeholders[key][absIdx] as unknown as Record<string, unknown>)[field] = value;
      }
    });
  };

  const deleteStakeholder = (key: string, absIdx: number) => {
    updateProject(p => {
      if (p.garData.stakeholders[key]) p.garData.stakeholders[key].splice(absIdx, 1);
    });
  };

  // Calcul du budget total de tous les projets du portefeuille actif
  const totalActiveBudget = useMemo(() => {
    if (!activeProject?.garData?.rendement?.axes) return 0;
    let sum = 0;
    activeProject.garData.rendement.axes.forEach(axe => {
      (axe.projets || []).forEach(proj => {
        sum += getProjectEffectiveCost(proj);
      });
    });
    return sum;
  }, [activeProject]);

  return (
    <div className="flex h-screen bg-slate-100 font-sans text-slate-800 overflow-hidden relative selection:bg-emerald-200">
      {/* BARRE LATÉRALE */}
      <aside
        className={`bg-slate-900 text-slate-200 flex flex-col transition-all duration-300 ${
          isSidebarOpen ? 'w-72' : 'w-20'
        } z-20 shadow-xl shrink-0 border-r border-slate-800`}
      >
        <div className="h-16 flex items-center justify-between px-4 bg-slate-950 border-b border-slate-800">
          {isSidebarOpen && (
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="bg-emerald-600 text-white font-black rounded-lg w-9 h-9 flex items-center justify-center text-sm shadow-xs shrink-0">
                GAR
              </div>
              <div className="flex flex-col overflow-hidden">
                <span className="font-bold text-white text-sm leading-tight truncate">
                  FAAB GAR
                </span>
                <span className="text-[10px] font-medium text-emerald-400 tracking-wider uppercase">
                  Gestion axée résultats
                </span>
              </div>
            </div>
          )}
          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white cursor-pointer transition-colors"
            title={isSidebarOpen ? 'Réduire le menu' : 'Agrandir le menu'}
          >
            <Menu size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-4 custom-scrollbar space-y-1">
          {/* Navigation principale */}
          <button
            onClick={() => handleTabClick(menuItems[0])}
            className={`w-full flex items-center px-4 py-3 transition-colors cursor-pointer text-left ${
              activeTab === 'accueil'
                ? 'bg-emerald-700 text-white font-semibold'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Home size={18} className={isSidebarOpen ? 'mr-3 text-emerald-400' : 'mx-auto text-emerald-400'} />
            {isSidebarOpen && <span className="text-xs font-semibold whitespace-nowrap">Accueil</span>}
          </button>

          <button
            onClick={() => handleTabClick(menuItems[1])}
            className={`w-full flex items-center px-4 py-3 transition-colors cursor-pointer text-left ${
              activeTab === 'dossier'
                ? 'bg-emerald-700 text-white font-semibold'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <FolderOpen size={18} className={isSidebarOpen ? 'mr-3 text-emerald-400' : 'mx-auto text-emerald-400'} />
            {isSidebarOpen && (
              <div className="flex items-center justify-between flex-1">
                <span className="text-xs font-semibold whitespace-nowrap">Dossiers & Projets</span>
                <span className="text-[10px] bg-slate-800 text-slate-300 px-1.5 py-0.5 rounded font-mono">
                  {portfolios.filter(p => !p.isTrashed).length}
                </span>
              </div>
            )}
          </button>

          {/* PHASE MÉTHODOLOGIQUE GAR */}
          {isSidebarOpen && (
            <div className="px-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 mt-6 pt-4 border-t border-slate-800">
              Démarche GAR
            </div>
          )}

          {menuItems.slice(2).map(item => (
            <button
              key={item.id}
              onClick={() => handleTabClick(item)}
              className={`w-full flex items-center px-4 py-3 transition-colors cursor-pointer text-left ${
                activeTab === item.id
                  ? 'bg-emerald-700 text-white font-semibold'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <item.icon size={18} className={isSidebarOpen ? 'mr-3 text-emerald-400' : 'mx-auto text-emerald-400'} />
              {isSidebarOpen && <span className="text-xs font-medium whitespace-nowrap flex-1">{item.label}</span>}
            </button>
          ))}
        </div>

        {/* Pied de barre latérale */}
        {isSidebarOpen && activeProject && (
          <div className="p-3.5 bg-slate-950 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
            <div className="text-[10px] uppercase font-bold text-slate-400">Portefeuille Actif :</div>
            <div className="font-bold text-slate-200 truncate">{activeProject.name}</div>
            <div className="text-[10px] text-emerald-400 font-mono tabular-nums">
              Budget total : {formatAmount(totalActiveBudget)}
            </div>
          </div>
        )}
      </aside>

      {/* ZONE CENTRALE */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* HEADER TOP-BAR */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-8 flex items-center justify-between shadow-xs z-10 shrink-0">
          <div className="flex items-center gap-4">
            <h1 className="text-base font-bold text-slate-900 hidden md:block">
              {menuItems.find(m => m.id === activeTab)?.label}
            </h1>

            {activeProject && activeTab !== 'accueil' && activeTab !== 'dossier' && (
              <div className="flex items-center gap-2 bg-slate-100 border border-slate-200 rounded-lg px-3 py-1.5 shadow-2xs">
                <span className="text-xs font-semibold text-slate-800 truncate max-w-xs md:max-w-md">
                  {activeProject.displayName || activeProject.name}
                </span>

                {filterContext.type !== 'all' && (
                  <button
                    onClick={() => {
                      setFilterContext({ type: 'all', focusedBranches: [], focusedAxes: [] });
                      setActiveProject({
                        ...activeProject,
                        entityLevel: 'Portefeuille',
                        displayName: activeProject.name
                      });
                    }}
                    className="ml-2 text-[10px] font-bold bg-white border border-slate-300 px-2 py-0.5 rounded text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                  >
                    Voir tout
                  </button>
                )}
              </div>
            )}
          </div>

          {/* ACTIONS D'ENTÊTE */}
          <div className="flex items-center gap-2">
            {activeProject && (
              <>
                <Button
                  variant="secondary"
                  icon={Download}
                  onClick={handleExportJSON}
                  title="Exporter ce portefeuille en fichier JSON"
                >
                  <span className="hidden sm:inline">Exporter JSON</span>
                </Button>
                <Button
                  variant="secondary"
                  icon={Printer}
                  onClick={() => window.print()}
                  title="Imprimer ou enregistrer en PDF"
                >
                  <span className="hidden sm:inline">Imprimer</span>
                </Button>
              </>
            )}
          </div>
        </header>

        {/* CONTENU PRINCIPAL */}
        <main className="flex-1 flex flex-col overflow-y-auto px-4 md:px-8 pb-8 pt-6 bg-slate-50 relative custom-scrollbar">
          {/* ONGLET : ACCUEIL */}
          {activeTab === 'accueil' && (
            <div className="flex-1 flex flex-col justify-between max-w-5xl mx-auto w-full space-y-6">
              <div className="space-y-6">
                {/* HERO BANNER INSTITUTIONNEL */}
                <div className="bg-slate-900 rounded-2xl p-8 md:p-10 text-white shadow-lg border border-slate-800 relative overflow-hidden">
                  <div className="relative z-10">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-emerald-500/20 text-emerald-300 font-bold text-xs mb-4 uppercase tracking-wider">
                      <Target size={14} /> Méthodologie GAR Institutionnelle
                    </div>
                    <h2 className="text-3xl md:text-4xl font-black mb-4 leading-tight tracking-tight">
                      Plateforme Intégrée de <br />
                      <span className="text-emerald-400">Gestion Axée sur les Résultats</span>
                    </h2>
                    <p className="text-sm md:text-base text-slate-300 max-w-3xl leading-relaxed mb-6">
                      <strong>FAAB GAR</strong> standardise le cheminement rigoureux de la GAR : de la capture des idées au <strong>Brainstorming</strong>, à l'<strong>Arbre à problèmes</strong>, la dérivation vers l'<strong>Arbre à solutions</strong>, l'estimation des intrants financiers et la gestion du <strong>Registre des parties prenantes</strong>.
                    </p>

                    <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center pt-2">
                      <Button
                        icon={FolderOpen}
                        onClick={() => handleTabClick(menuItems.find(m => m.id === 'dossier')!)}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 text-sm font-bold"
                      >
                        Ouvrir les Portefeuilles
                      </Button>
                      <Button
                        variant="secondary"
                        icon={RotateCcw}
                        onClick={handleResetDemoData}
                        className="bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
                      >
                        Restaurer Exemple Démo Santé
                      </Button>
                    </div>
                  </div>
                </div>

                {/* ENCART CONCEPTEUR & INFORMATIONS */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs">
                    <span className="text-[10px] text-emerald-700 font-black uppercase tracking-widest block mb-1">
                      Conception et Ingénierie
                    </span>
                    <h3 className="text-lg font-black text-slate-900">KOFFIE FABIEN MICHAEL</h3>
                    <p className="text-xs text-slate-500 mt-1 mb-4">
                      Expert en ingénierie de planification stratégique et systèmes de gestion axée sur les résultats.
                    </p>
                    <div className="space-y-2 text-xs font-medium text-slate-700 border-t border-slate-100 pt-3">
                      <div className="flex items-center gap-2">
                        <Mail size={14} className="text-slate-400 shrink-0" />
                        <a href="mailto:fabien.frikupgeneration@gmail.com" className="hover:text-emerald-600 transition-colors">
                          fabien.frikupgeneration@gmail.com
                        </a>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone size={14} className="text-slate-400 shrink-0" />
                        <span className="font-mono">00225 07480827393</span>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-xs flex flex-col justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest block mb-1">
                        Cadre Méthodologique
                      </span>
                      <h3 className="text-lg font-black text-slate-900">Cycle Logique GAR</h3>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        Chaque problème identifié engendre son miroir en solution : la <em>Conséquence Globale</em> devient l'<em>Impact</em>, les <em>Problèmes Centraux</em> se traduisent en <em>Effets</em>, les <em>Contraintes</em> en <em>Extrants</em>, et les <em>Causes</em> en <em>Activités</em>.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-100 text-[11px] text-emerald-700 font-bold">
                      <CheckCircle2 size={16} /> Conformité aux normes internationales de développement
                    </div>
                  </div>
                </div>

                {/* ACCORD DE CONFIDENTIALITÉ */}
                <div className="bg-slate-100 border border-slate-200 p-5 rounded-xl text-slate-700">
                  <h4 className="text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-2 text-slate-800">
                    <AlertCircle size={15} className="text-amber-600" /> Accord de Confidentialité & Propriété Intellectuelle
                  </h4>
                  <p className="text-xs text-slate-600 leading-relaxed text-justify">
                    La présente plateforme, incluant sa structure logique, ses algorithmes de dépendance inter-services et son interface fonctionnelle, constitue une œuvre protégée appartenant à son concepteur. Toute reproduction, copie ou diffusion non autorisée est rigoureusement interdite.
                  </p>
                </div>
              </div>

              <footer className="pt-6 pb-2 text-center text-xs text-slate-400">
                © {new Date().getFullYear()} Koffié Fabien Michael · Plateforme GAR · Tous droits réservés.
              </footer>
            </div>
          )}

          {/* ONGLET : DOSSIERS & PROJETS */}
          {activeTab === 'dossier' && (
            <div className="flex-1 space-y-6 w-full max-w-7xl mx-auto">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div>
                  <h2 className="text-lg font-black text-slate-900">Portefeuilles & Projets</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Gérez jusqu'à {MAX_SANDBOXES} portefeuilles méthodologiques simultanés ({currentSandboxesCount}/{MAX_SANDBOXES} utilisés).
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-lg font-medium text-xs bg-white text-slate-700 hover:bg-slate-100 border border-slate-300 shadow-xs cursor-pointer">
                    <Upload size={16} />
                    <span>Importer JSON</span>
                    <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
                  </label>
                  {canCreateNew && (
                    <Button icon={Plus} onClick={createNewSandbox}>
                      Nouveau Projet
                    </Button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {portfolios
                  .filter(p => !p.isTrashed)
                  .map(port => {
                    const isSelected = activeProject?.id === port.id;
                    const totalCost = (port.garData?.rendement?.axes || []).reduce((acc, axe) => {
                      return acc + (axe.projets || []).reduce((pAcc, pr) => pAcc + getProjectEffectiveCost(pr), 0);
                    }, 0);

                    return (
                      <Card
                        key={port.id}
                        className={`transition-all hover:shadow-md flex flex-col justify-between ${
                          isSelected ? 'ring-2 ring-emerald-600 border-emerald-500' : 'border-slate-200'
                        }`}
                      >
                        <div>
                          <div className="flex justify-between items-start mb-3">
                            <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-700">
                              <Briefcase size={22} />
                            </div>
                            <div className="flex items-center gap-2">
                              {isSelected && (
                                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">
                                  Actif
                                </span>
                              )}
                              <button
                                onClick={e => handleTrashPortfolio(e, port.id)}
                                className="p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 rounded transition-colors cursor-pointer"
                                title="Mettre à la corbeille"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </div>

                          {port.isEditable ? (
                            <div className="mb-4 space-y-2">
                              <input
                                type="text"
                                value={port.institution}
                                onChange={e =>
                                  setPortfolios(prev =>
                                    prev.map(p => (p.id === port.id ? { ...p, institution: e.target.value } : p))
                                  )
                                }
                                className="w-full font-bold text-xs text-slate-500 bg-transparent border-b border-dashed border-slate-300 focus:border-emerald-500 outline-none uppercase tracking-wider py-1"
                                placeholder="Nom de l'Institution..."
                              />
                              <input
                                type="text"
                                value={port.name}
                                onChange={e =>
                                  setPortfolios(prev =>
                                    prev.map(p => (p.id === port.id ? { ...p, name: e.target.value } : p))
                                  )
                                }
                                className="w-full font-black text-base text-slate-900 bg-transparent border-b border-dashed border-slate-300 focus:border-emerald-500 outline-none py-1"
                                placeholder="Nom du Portefeuille..."
                              />
                              <textarea
                                value={port.description}
                                onChange={e =>
                                  setPortfolios(prev =>
                                    prev.map(p => (p.id === port.id ? { ...p, description: e.target.value } : p))
                                  )
                                }
                                className="w-full text-xs text-slate-600 bg-transparent border-b border-dashed border-slate-300 focus:border-emerald-500 outline-none h-16 resize-none custom-scrollbar py-1"
                                placeholder="Description stratégique du portefeuille..."
                              />
                            </div>
                          ) : (
                            <div className="mb-4">
                              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                                {port.institution}
                              </div>
                              <h3 className="font-black text-base text-slate-900 mb-1">{port.name}</h3>
                              <p className="text-xs text-slate-600 line-clamp-3">{port.description}</p>
                            </div>
                          )}

                          <div className="flex items-center justify-between text-xs font-medium text-slate-500 border-t border-slate-100 pt-3 mb-3">
                            <span>Axes : {port.garData?.rendement?.axes?.length || 0}</span>
                            <span className="font-mono text-emerald-700 font-bold tabular-nums">
                              {formatAmount(totalCost)}
                            </span>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            className="w-full"
                            icon={Settings}
                            onClick={() => handleEnterGAR(port)}
                          >
                            Ouvrir GAR
                          </Button>
                        </div>
                      </Card>
                    );
                  })}

                {canCreateNew && (
                  <button
                    onClick={createNewSandbox}
                    className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-8 cursor-pointer flex flex-col items-center justify-center text-slate-500 hover:text-emerald-700 bg-white/50 transition-all min-h-[240px] group"
                  >
                    <div className="w-12 h-12 rounded-full bg-slate-100 group-hover:bg-emerald-50 flex items-center justify-center text-slate-400 group-hover:text-emerald-600 transition-colors mb-3">
                      <Plus size={24} />
                    </div>
                    <h3 className="font-bold text-sm text-slate-800 group-hover:text-emerald-700">Créer un Nouveau Dossier</h3>
                    <p className="text-xs text-slate-400 mt-1">Espace d'analyse vierge prêt à l'emploi</p>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ONGLET : BRAINSTORMING */}
          {activeTab === 'brainstorming' &&
            (!activeProject ? (
              <NoProjectScreen setActiveTab={setActiveTab} />
            ) : (
              <div className="flex-1 flex flex-col w-full max-w-7xl mx-auto space-y-4">
                <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                  <div>
                    <h2 className="text-xl font-black text-slate-900">Tableau de Brainstorming</h2>
                    <p className="text-xs text-slate-500 mt-1">
                      Capturez et formulez vos idées par paire : <strong>Problème (Négatif)</strong> vers sa <strong>Solution (Positif)</strong>.
                    </p>
                  </div>
                  {activeProject.isEditable && (
                    <Button onClick={handleAddIdea} icon={Plus}>
                      Nouvelle Idée
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                  {(activeProject.garData?.brainstorming || []).map(idea => (
                    <div
                      key={idea.id}
                      className={`p-4 rounded-xl shadow-xs border border-black/10 relative group ${idea.color} flex flex-col h-80 transition-transform hover:-translate-y-0.5`}
                    >
                      {activeProject.isEditable && (
                        <button
                          onClick={() => handleDeleteIdea(idea.id)}
                          className="absolute -top-2 -right-2 bg-white hover:bg-red-500 text-slate-400 hover:text-white border border-slate-300 rounded-full p-1 opacity-80 group-hover:opacity-100 transition-all shadow-xs cursor-pointer z-10"
                          title="Supprimer cette idée"
                        >
                          <X size={14} />
                        </button>
                      )}

                      <div className="flex-1 flex flex-col gap-3">
                        <div className="flex-1 flex flex-col">
                          <span className="text-[10px] font-black uppercase text-slate-700 mb-1 border-b border-black/10 pb-0.5">
                            Problème (Négatif)
                          </span>
                          <textarea
                            className="w-full flex-1 bg-transparent resize-none outline-none font-medium text-slate-900 placeholder-slate-500/60 custom-scrollbar text-xs leading-relaxed"
                            placeholder="Formulez la situation insatisfaisante ou le problème constaté..."
                            value={idea.textNegative || idea.text || ''}
                            onChange={e => updateIdeaText(idea.id, 'textNegative', e.target.value)}
                            readOnly={!activeProject.isEditable}
                          />
                        </div>

                        <div className="h-px w-full bg-black/10"></div>

                        <div className="flex-1 flex flex-col">
                          <span className="text-[10px] font-black uppercase text-emerald-800 mb-1 border-b border-black/10 pb-0.5">
                            Solution (Positif)
                          </span>
                          <textarea
                            className="w-full flex-1 bg-transparent resize-none outline-none font-medium text-emerald-950 placeholder-emerald-700/60 custom-scrollbar text-xs leading-relaxed"
                            placeholder="Formulez l'état positif souhaité ou le résultat attendu..."
                            value={idea.textPositive || ''}
                            onChange={e => updateIdeaText(idea.id, 'textPositive', e.target.value)}
                            readOnly={!activeProject.isEditable}
                          />
                        </div>
                      </div>

                      {activeProject.isEditable && (
                        <div className="flex items-center justify-center gap-2 mt-3 pt-2.5 border-t border-black/10">
                          {['bg-amber-100', 'bg-sky-100', 'bg-emerald-100', 'bg-rose-100', 'bg-purple-100', 'bg-orange-100'].map(c => (
                            <button
                              key={c}
                              onClick={() => updateIdeaColor(idea.id, c)}
                              className={`w-5 h-5 rounded-full border border-black/20 cursor-pointer ${c} ${
                                idea.color === c ? 'ring-2 ring-slate-800 scale-110' : 'hover:scale-105'
                              }`}
                              title="Changer la couleur"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {(activeProject.garData?.brainstorming || []).length === 0 && (
                  <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-slate-200">
                    <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center mb-4">
                      <Lightbulb size={32} />
                    </div>
                    <h3 className="text-base font-bold text-slate-800">Aucune idée enregistrée</h3>
                    <p className="text-xs text-slate-500 mt-1 max-w-sm text-center">
                      Commencez par consigner vos constats et hypothèses sous forme de paires Problème / Solution.
                    </p>
                    <Button onClick={handleAddIdea} icon={Plus} className="mt-4">
                      Ajouter une première idée
                    </Button>
                  </div>
                )}
              </div>
            ))}

          {/* ONGLET : ARBRE À PROBLÈMES */}
          {activeTab === 'arbre' &&
            (!activeProject ? (
              <NoProjectScreen setActiveTab={setActiveTab} />
            ) : (
              <div className="flex-1 flex flex-col w-full max-w-full mx-auto space-y-4">
                <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h2 className="text-lg font-black text-slate-900">Arbre à Problèmes</h2>
                    <p className="text-xs text-slate-500">
                      Hiérarchisez la <strong>Conséquence Globale</strong>, les <strong>Problèmes Centraux (Axes)</strong>, les <strong>Contraintes</strong> et les <strong>Causes profondes</strong>.
                    </p>
                  </div>
                  {activeProject.isEditable && (
                    <Button onClick={handleAddAxe} icon={Plus}>
                      Ajouter un Axe / Service
                    </Button>
                  )}
                </div>

                <div className="bg-slate-200/60 rounded-xl border border-slate-300 p-8 overflow-auto flex-1 min-h-[600px] custom-scrollbar">
                  <div className="min-w-max flex justify-center pb-12">
                    <div className="flex flex-col items-center">
                      {/* RACINE: CONSÉQUENCE GLOBALE */}
                      <div className="bg-rose-950 text-white p-5 rounded-xl shadow-md border-2 border-rose-700 w-[520px] max-w-[90vw] text-center z-10 relative">
                        <h4 className="text-[10px] uppercase font-black mb-2 text-rose-300 tracking-widest">
                          Conséquence Globale (Impact Négatif)
                        </h4>
                        {activeProject.isEditable ? (
                          <BrainstormingSelect
                            ideas={activeProject.garData?.brainstorming}
                            value={activeProject.garData?.problems?.consequenceGlobale}
                            onChange={(neg, pos) =>
                              updateProject(p => {
                                p.garData.problems.consequenceGlobale = neg;
                                if (pos) p.garData.rendement.impact = pos;
                              })
                            }
                            className="bg-rose-900 text-white border border-rose-500 rounded"
                            placeholder="Sélectionner l'impact négatif depuis le brainstorming..."
                          />
                        ) : (
                          <p className="font-bold text-xs">{activeProject.garData?.problems?.consequenceGlobale}</p>
                        )}
                      </div>

                      {/* CONNECTEUR AJOUT AXE */}
                      <div className="flex flex-col items-center">
                        <div className="w-0.5 h-6 bg-slate-400"></div>
                        {activeProject.isEditable && (
                          <button
                            onClick={handleAddAxe}
                            className="bg-slate-700 text-white rounded-full p-1.5 hover:bg-slate-800 shadow-xs cursor-pointer z-20 relative transition-transform hover:scale-110"
                            title="Ajouter un service / axe"
                          >
                            <Plus size={14} />
                          </button>
                        )}
                        {(activeProject.garData?.problems?.branches || []).length > 0 && (
                          <div className="w-0.5 h-6 bg-slate-400"></div>
                        )}
                      </div>

                      {/* AXES (SERVICES) */}
                      <div className="flex justify-center relative">
                        {(activeProject.garData?.problems?.branches || []).map((branch, i) => {
                          const branches = activeProject.garData.problems.branches || [];
                          const isOnlyAxe = branches.length === 1;
                          return (
                            <div key={i} className="flex flex-col items-center relative px-4">
                              {isOnlyAxe ? (
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-8 bg-slate-400"></div>
                              ) : (
                                <>
                                  {i !== 0 && <div className="absolute top-0 left-0 w-1/2 h-0.5 bg-slate-400"></div>}
                                  {i !== branches.length - 1 && (
                                    <div className="absolute top-0 right-0 w-1/2 h-0.5 bg-slate-400"></div>
                                  )}
                                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-8 bg-slate-400"></div>
                                </>
                              )}

                              <div className="bg-rose-50 text-rose-950 p-4 rounded-xl shadow-xs border-2 border-rose-300 w-[420px] max-w-[85vw] text-center z-10 relative mt-8">
                                <div className="flex justify-between items-center mb-2 gap-2">
                                  <div className="flex-1 flex items-center text-[10px] uppercase font-black text-rose-700">
                                    {activeProject.isEditable ? (
                                      <input
                                        type="text"
                                        className="bg-white border border-rose-200 text-rose-900 px-2 py-0.5 rounded outline-none focus:border-rose-400 w-36 font-black uppercase text-[10px] mr-1.5 shadow-2xs"
                                        value={branch.axeName || `Service ${i + 1}`}
                                        onChange={e => {
                                          const val = e.target.value;
                                          updateProject(p => {
                                            p.garData.problems.branches[i].axeName = val;
                                            if (p.garData.rendement.axes[i]) p.garData.rendement.axes[i].nom = val;
                                          });
                                        }}
                                      />
                                    ) : (
                                      <span className="mr-1">{branch.axeName || `Service ${i + 1}`}</span>
                                    )}
                                    <span>: PROBLÈME CENTRAL</span>
                                  </div>
                                  {activeProject.isEditable && (
                                    <button
                                      onClick={() => handleDeleteAxe(i, branch.axeName)}
                                      className="text-rose-400 hover:text-rose-700 cursor-pointer shrink-0 p-1"
                                      title="Supprimer cet axe"
                                    >
                                      <Trash2 size={13} />
                                    </button>
                                  )}
                                </div>

                                {activeProject.isEditable ? (
                                  <BrainstormingSelect
                                    ideas={activeProject.garData?.brainstorming}
                                    value={branch.central}
                                    onChange={(neg, pos) =>
                                      updateProject(p => {
                                        p.garData.problems.branches[i].central = neg;
                                        if (pos && p.garData.rendement.axes[i]) {
                                          p.garData.rendement.axes[i].effet = pos;
                                        }
                                      })
                                    }
                                    className="bg-white text-rose-950 border border-rose-300 rounded"
                                    placeholder="Choisir le problème central..."
                                  />
                                ) : (
                                  <p className="font-bold text-xs">{branch.central}</p>
                                )}
                              </div>

                              {/* CONNECTEUR AJOUT PROJET */}
                              <div className="flex flex-col items-center">
                                <div className="w-0.5 h-6 bg-slate-300"></div>
                                {activeProject.isEditable && (
                                  <button
                                    onClick={() => handleAddProject(i)}
                                    className="bg-slate-600 text-white rounded-full p-1.5 hover:bg-slate-700 shadow-xs cursor-pointer z-20 relative transition-transform hover:scale-110"
                                    title="Ajouter un sous-problème (projet)"
                                  >
                                    <Plus size={13} />
                                  </button>
                                )}
                                {(branch.details || []).length > 0 && <div className="w-0.5 h-6 bg-slate-300"></div>}
                              </div>

                              {/* SOUS-PROBLÈMES / CONTRAINTES */}
                              <div className="flex justify-center relative">
                                {(branch.details || []).map((detail, j) => {
                                  const details = branch.details || [];
                                  const isOnlyDetail = details.length === 1;
                                  const causesArr = ensureArray(detail.cause);
                                  const besoinsArr = ensureArray(detail.besoin);
                                  const actArr = ensureArray(
                                    activeProject.garData.rendement.axes[i]?.projets?.[j]?.activites
                                  );
                                  const maxLen = Math.max(causesArr.length, actArr.length, besoinsArr.length, 1);
                                  const causes = Array.from({ length: maxLen }, (_, idx) => causesArr[idx] || '');
                                  const besoins = Array.from({ length: maxLen }, (_, idx) => besoinsArr[idx] || '');

                                  return (
                                    <div key={j} className="flex flex-col items-center relative px-2">
                                      {isOnlyDetail ? (
                                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-8 bg-slate-300"></div>
                                      ) : (
                                        <>
                                          {j !== 0 && (
                                            <div className="absolute top-0 left-0 w-1/2 h-0.5 bg-slate-300"></div>
                                          )}
                                          {j !== details.length - 1 && (
                                            <div className="absolute top-0 right-0 w-1/2 h-0.5 bg-slate-300"></div>
                                          )}
                                          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-8 bg-slate-300"></div>
                                        </>
                                      )}

                                      <div className="bg-white p-4 rounded-xl shadow-xs border border-slate-300 w-auto inline-flex flex-col items-center z-10 relative mt-8">
                                        {activeProject.isEditable && (
                                          <div className="absolute -top-2.5 -right-2.5 z-20">
                                            <button
                                              onClick={() => handleDeleteProject(i, j, detail.contrainte)}
                                              className="bg-white text-rose-500 rounded-full p-1 hover:bg-rose-50 border border-rose-200 shadow-xs cursor-pointer"
                                              title="Supprimer cette branche"
                                            >
                                              <Trash2 size={12} />
                                            </button>
                                          </div>
                                        )}

                                        <div className="text-[10px] font-black uppercase text-slate-500 tracking-wider mb-2 bg-slate-100 px-3 py-0.5 rounded-full border border-slate-200">
                                          Branche {j + 1}
                                        </div>

                                        {/* CONTRAINTE */}
                                        <div className="bg-orange-50/70 p-2.5 rounded-lg border border-orange-200 w-64 text-center z-10 shadow-2xs">
                                          <h5 className="text-[9px] uppercase font-black text-orange-700 mb-1">
                                            Contrainte {j + 1}
                                          </h5>
                                          {activeProject.isEditable ? (
                                            <BrainstormingSelect
                                              ideas={activeProject.garData?.brainstorming}
                                              value={detail.contrainte}
                                              onChange={(neg, pos) =>
                                                updateProject(p => {
                                                  p.garData.problems.branches[i].details[j].contrainte = neg;
                                                  if (pos && p.garData.rendement.axes[i]?.projets[j]) {
                                                    p.garData.rendement.axes[i].projets[j].extrant = pos;
                                                  }
                                                })
                                              }
                                              className="bg-white text-orange-950 text-xs border border-orange-300 rounded"
                                              placeholder="Choisir la contrainte..."
                                            />
                                          ) : (
                                            <p className="text-xs font-bold text-orange-950">{detail.contrainte}</p>
                                          )}

                                          {activeProject.isEditable && (
                                            <button
                                              onClick={() => handleAddCauseActivity(i, j)}
                                              className="mt-2 text-[9px] font-bold uppercase text-orange-700 bg-orange-100 hover:bg-orange-200 px-2 py-1 rounded w-full flex items-center justify-center gap-1 border border-orange-300 border-dashed cursor-pointer"
                                            >
                                              <Plus size={10} /> Ajouter Cause Profonde & Besoin
                                            </button>
                                          )}
                                        </div>

                                        <div className="w-0.5 h-6 bg-slate-300"></div>

                                        {/* CAUSES ET BESOINS */}
                                        <div className="flex justify-center relative w-full">
                                          {causes.map((c, k) => (
                                            <div key={k} className="flex flex-col items-center relative px-2">
                                              {causes.length > 1 && (
                                                <>
                                                  {k !== 0 && (
                                                    <div className="absolute top-0 left-0 w-1/2 h-0.5 bg-slate-300"></div>
                                                  )}
                                                  {k !== causes.length - 1 && (
                                                    <div className="absolute top-0 right-0 w-1/2 h-0.5 bg-slate-300"></div>
                                                  )}
                                                </>
                                              )}
                                              <div className="w-0.5 h-6 bg-slate-300"></div>

                                              <div className="bg-amber-50/70 p-2.5 rounded-lg border border-amber-200 w-52 text-center z-10 relative group shadow-2xs">
                                                {activeProject.isEditable && causes.length > 1 && (
                                                  <button
                                                    onClick={() => handleRemoveCauseActivity(i, j, k)}
                                                    className="absolute -top-2 -right-2 bg-white text-rose-500 rounded-full p-1 opacity-0 group-hover:opacity-100 border border-rose-200 cursor-pointer z-20 shadow-xs"
                                                    title="Supprimer cette cause"
                                                  >
                                                    <Trash2 size={10} />
                                                  </button>
                                                )}
                                                <h5 className="text-[9px] uppercase font-black text-amber-800 mb-1">
                                                  Cause Profonde {k + 1}
                                                </h5>
                                                {activeProject.isEditable ? (
                                                  <BrainstormingSelect
                                                    ideas={activeProject.garData?.brainstorming}
                                                    value={c}
                                                    onChange={(neg, pos) =>
                                                      updateProject(p => {
                                                        const arr = ensureArray(
                                                          p.garData.problems.branches[i].details[j].cause
                                                        );
                                                        arr[k] = neg;
                                                        p.garData.problems.branches[i].details[j].cause = arr;
                                                        if (pos && p.garData.rendement.axes[i]?.projets[j]) {
                                                          const actArr = ensureArray(
                                                            p.garData.rendement.axes[i].projets[j].activites
                                                          );
                                                          actArr[k] = pos;
                                                          p.garData.rendement.axes[i].projets[j].activites = actArr;
                                                        }
                                                      })
                                                    }
                                                    className="bg-white text-amber-950 text-xs border border-amber-300 rounded"
                                                    placeholder={`Choisir la cause ${k + 1}...`}
                                                  />
                                                ) : (
                                                  <p className="text-xs font-medium text-amber-950">{c}</p>
                                                )}
                                              </div>

                                              <div className="w-0.5 h-6 bg-slate-300"></div>

                                              <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 w-52 text-center z-10 relative shadow-2xs">
                                                <h5 className="text-[9px] uppercase font-black text-slate-700 mb-1">
                                                  Besoin {k + 1}
                                                </h5>
                                                {activeProject.isEditable ? (
                                                  <BrainstormingSelect
                                                    ideas={activeProject.garData?.brainstorming}
                                                    value={besoins[k]}
                                                    onChange={neg =>
                                                      updateProject(p => {
                                                        const arr = ensureArray(
                                                          p.garData.problems.branches[i].details[j].besoin
                                                        );
                                                        arr[k] = neg;
                                                        p.garData.problems.branches[i].details[j].besoin = arr;
                                                      })
                                                    }
                                                    className="bg-white text-slate-900 text-xs border border-slate-300 rounded"
                                                    placeholder="Choisir le besoin..."
                                                  />
                                                ) : (
                                                  <p className="text-xs font-medium text-slate-800">{besoins[k]}</p>
                                                )}
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

          {/* ONGLET : ARBRE À SOLUTIONS */}
          {activeTab === 'solutions' &&
            (!activeProject ? (
              <NoProjectScreen setActiveTab={setActiveTab} />
            ) : (
              <div className="flex-1 flex flex-col w-full max-w-full mx-auto space-y-4">
                <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h2 className="text-lg font-black text-slate-900">Arbre à Solutions & Intrants</h2>
                    <p className="text-xs text-slate-500">
                      Du <strong>Livrable (Extrant)</strong> aux <strong>Activités</strong>, chiffrez les <strong>Ressources Humaines</strong>, <strong>Matérielles</strong> et calculez le budget global.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500">Coût estimé portefeuille :</span>
                    <span className="text-sm font-black font-mono text-emerald-800 bg-emerald-50 px-3 py-1 rounded-md border border-emerald-200 tabular-nums">
                      {formatAmount(totalActiveBudget)}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-200/60 rounded-xl border border-slate-300 p-8 overflow-auto flex-1 min-h-[600px] custom-scrollbar">
                  <div className="min-w-max flex justify-center pb-12">
                    <div className="flex flex-col items-center">
                      {/* RACINE: IMPACT GLOBAL */}
                      <div className="bg-emerald-900 text-white p-5 rounded-xl shadow-md border-2 border-emerald-600 w-[520px] max-w-[90vw] text-center z-10 relative">
                        <h4 className="text-[10px] uppercase font-black mb-2 text-emerald-200 tracking-widest">
                          Impact Global (Objectif Général)
                        </h4>
                        <div className="font-bold text-xs bg-emerald-950/60 p-2.5 rounded border border-emerald-700 leading-relaxed">
                          {activeProject.garData?.rendement?.impact || (
                            <span className="text-emerald-300 italic">
                              Sélectionnez une conséquence globale dans l'arbre à problèmes pour générer automatiquement l'impact correspondant.
                            </span>
                          )}
                        </div>
                      </div>

                      {/* CONNECTEUR AXE */}
                      {(activeProject.garData?.rendement?.axes || []).length > 0 && (
                        <div className="w-0.5 h-10 bg-slate-400"></div>
                      )}

                      <div className="flex justify-center relative">
                        {(activeProject.garData?.rendement?.axes || []).map((axe, i) => {
                          const axes = activeProject.garData.rendement.axes || [];
                          const isOnlyAxe = axes.length === 1;

                          const isFocused = filterContext.type === 'axe' && (filterContext.focusedAxes || []).includes(i);
                          const dependentAxes: number[] = [];
                          axes.forEach((_, aIdx) => {
                            if (aIdx === i) return;
                            const targetRisk = (activeProject.garData.risks || []).find(
                              r => r.axe === aIdx + 1 && r.niveau === 'EFFET'
                            );
                            if (
                              targetRisk &&
                              (targetRisk.linkedAxeIndex === i ||
                                (targetRisk.hypothese && targetRisk.hypothese === axe.effet))
                            ) {
                              dependentAxes.push(aIdx);
                            }
                          });

                          return (
                            <div key={i} className="flex flex-col items-center relative px-4">
                              {isOnlyAxe ? (
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-8 bg-slate-400"></div>
                              ) : (
                                <>
                                  {i !== 0 && <div className="absolute top-0 left-0 w-1/2 h-0.5 bg-slate-400"></div>}
                                  {i !== axes.length - 1 && (
                                    <div className="absolute top-0 right-0 w-1/2 h-0.5 bg-slate-400"></div>
                                  )}
                                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-8 bg-slate-400"></div>
                                </>
                              )}

                              <div
                                className={`bg-white text-slate-900 p-4 rounded-xl shadow-xs border-2 ${
                                  isFocused
                                    ? 'border-emerald-600 ring-2 ring-emerald-200'
                                    : dependentAxes.length > 0
                                    ? 'border-rose-400 ring-1 ring-rose-100'
                                    : 'border-slate-300'
                                } w-[420px] max-w-[85vw] text-center z-10 relative mt-8 transition-all`}
                              >
                                <div className="flex justify-between items-center mb-1 gap-2">
                                  <div className="flex-1 flex items-center text-[10px] uppercase font-black text-emerald-800">
                                    <span className="mr-1">{axe.nom || `Service ${i + 1}`}</span>
                                    <span>: EFFET ATTENDU</span>
                                  </div>
                                </div>

                                <div className="flex flex-col gap-1.5 w-full mb-3 mt-2">
                                  {isFocused && (
                                    <div className="bg-emerald-100 text-emerald-900 text-[10px] font-black px-2 py-1 rounded border border-emerald-300 text-center uppercase tracking-wider shadow-2xs">
                                      Service en cours de traitement (Focus)
                                    </div>
                                  )}
                                  {dependentAxes.map(depIdx => (
                                    <div
                                      key={depIdx}
                                      className="bg-rose-50 text-rose-800 text-[10px] font-bold px-2 py-1 rounded border border-rose-200 flex justify-between items-center"
                                    >
                                      <span>Condition préalable pour {axes[depIdx].nom || `Service ${depIdx + 1}`}</span>
                                      {activeProject.isEditable && (
                                        <button
                                          onClick={() => {
                                            updateRisk(depIdx + 1, 'EFFET', 'hypothese', '');
                                            updateRisk(depIdx + 1, 'EFFET', 'linkedAxeIndex', null);
                                          }}
                                          className="text-rose-500 hover:text-rose-800 cursor-pointer p-0.5"
                                          title="Retirer cette condition"
                                        >
                                          <X size={12} />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>

                                <div className="mb-3 w-full text-left">
                                  <select
                                    className="w-full bg-slate-50 border border-slate-300 text-[10px] font-bold rounded p-1.5 outline-none cursor-pointer hover:border-emerald-500 transition-all"
                                    value=""
                                    onChange={e => {
                                      const val = e.target.value;
                                      if (!val) return;
                                      if (val === 'focus_axe') {
                                        const currentFocused = filterContext.focusedAxes || [];
                                        const newFocused = [...currentFocused, i];
                                        setFilterContext({ type: 'axe', focusedAxes: newFocused, focusedBranches: [] });
                                        setActiveProject({
                                          ...activeProject,
                                          entityLevel: 'Focus Service',
                                          displayName: `Focus : ${axes[i].nom}`
                                        });
                                      } else if (val === 'unfocus_axe') {
                                        const currentFocused = filterContext.focusedAxes || [];
                                        const newFocused = currentFocused.filter(f => f !== i);
                                        if (newFocused.length === 0) {
                                          setFilterContext({ type: 'all', focusedBranches: [], focusedAxes: [] });
                                          setActiveProject({
                                            ...activeProject,
                                            entityLevel: 'Portefeuille',
                                            displayName: activeProject.name
                                          });
                                        } else {
                                          setFilterContext({ type: 'axe', focusedAxes: newFocused, focusedBranches: [] });
                                          setActiveProject({
                                            ...activeProject,
                                            entityLevel: 'Focus Multiple',
                                            displayName: `Focus (${newFocused.length} services)`
                                          });
                                        }
                                      } else if (val.startsWith('add_hypo_axe_')) {
                                        const targetIdx = parseInt(val.split('_')[3]);
                                        const textHypo = `${axe.effet || 'Effet non défini'}`;
                                        updateRisk(targetIdx + 1, 'EFFET', 'hypothese', textHypo);
                                        updateRisk(targetIdx + 1, 'EFFET', 'linkedAxeIndex', i);
                                      }
                                      e.target.value = '';
                                    }}
                                  >
                                    <option value="">Actions sur cet Effet...</option>
                                    <optgroup label="1. FOCUS SUR L'ÉTUDE">
                                      {isFocused ? (
                                        <option value="unfocus_axe">Annuler le focus (Voir tout)</option>
                                      ) : (
                                        <option value="focus_axe">Traiter uniquement cet Effet (Focus)</option>
                                      )}
                                    </optgroup>
                                    {activeProject.isEditable && axes.length > 1 && (
                                      <optgroup label="2. DÉFINIR COMME CONDITION/HYPOTHÈSE POUR :">
                                        {axes.map((a, aIdx) => {
                                          if (aIdx === i) return null;
                                          const targetRisk = (activeProject.garData.risks || []).find(
                                            r => r.axe === aIdx + 1 && r.niveau === 'EFFET'
                                          );
                                          const isAlreadyConditioned =
                                            targetRisk?.linkedAxeIndex !== undefined &&
                                            targetRisk?.linkedAxeIndex !== null;
                                          if (!dependentAxes.includes(aIdx) && !isAlreadyConditioned) {
                                            return (
                                              <option key={aIdx} value={`add_hypo_axe_${aIdx}`}>
                                                {a.nom || `Service ${aIdx + 1}`}
                                              </option>
                                            );
                                          }
                                          return null;
                                        })}
                                      </optgroup>
                                    )}
                                  </select>
                                </div>

                                <div className="font-bold text-xs bg-emerald-50 text-emerald-950 p-2.5 rounded border border-emerald-200">
                                  {axe.effet || (
                                    <span className="text-slate-400 italic">
                                      Associez un problème central dans l'arbre à problèmes pour dériver cet effet.
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* CONNECTEUR PROJET */}
                              {(axe.projets || []).length > 0 && <div className="w-0.5 h-10 bg-slate-300"></div>}

                              {/* PROJETS / EXTRANTS */}
                              <div className="flex justify-center relative">
                                {(axe.projets || []).map((proj, j) => {
                                  const projs = axe.projets || [];
                                  const isOnlyProj = projs.length === 1;
                                  const isFocusedBranch =
                                    filterContext.type === 'projet' &&
                                    (filterContext.focusedBranches || []).some(
                                      f => f.axeIndex === i && f.projetIndex === j
                                    );

                                  const dependentBranches: number[] = [];
                                  projs.forEach((_, pIndex) => {
                                    if (pIndex === j) return;
                                    const targetRisk = (activeProject.garData.risks || []).find(
                                      r => r.axe === i + 1 && r.niveau === `EXTRANT ${pIndex + 1}`
                                    );
                                    if (targetRisk && targetRisk.linkedBranchIndex === j) {
                                      dependentBranches.push(pIndex);
                                    }
                                  });

                                  const activites = Array.from(
                                    {
                                      length: Math.max(
                                        ensureArray(
                                          activeProject.garData.problems?.branches?.[i]?.details?.[j]?.cause
                                        ).length,
                                        ensureArray(proj.activites).length,
                                        1
                                      )
                                    },
                                    (_, idx) => ensureArray(proj.activites)[idx] || ''
                                  );

                                  return (
                                    <div key={j} className="flex flex-col items-center relative px-2">
                                      {isOnlyProj ? (
                                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-8 bg-slate-300"></div>
                                      ) : (
                                        <>
                                          {j !== 0 && (
                                            <div className="absolute top-0 left-0 w-1/2 h-0.5 bg-slate-300"></div>
                                          )}
                                          {j !== projs.length - 1 && (
                                            <div className="absolute top-0 right-0 w-1/2 h-0.5 bg-slate-300"></div>
                                          )}
                                          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-0.5 h-8 bg-slate-300"></div>
                                        </>
                                      )}

                                      <div
                                        className={`bg-white p-4 rounded-xl shadow-xs border ${
                                          isFocusedBranch
                                            ? 'border-emerald-600 ring-2 ring-emerald-200'
                                            : dependentBranches.length > 0
                                            ? 'border-rose-400 ring-1 ring-rose-100'
                                            : 'border-slate-300'
                                        } w-auto inline-flex flex-col items-center z-10 relative mt-8 transition-all`}
                                      >
                                        <div className="text-[10px] font-black uppercase text-slate-500 tracking-wider mb-2 bg-slate-100 px-3 py-0.5 rounded-full border border-slate-200">
                                          Branche {j + 1}
                                        </div>

                                        <div className="flex flex-col gap-1.5 w-64 mb-3">
                                          {isFocusedBranch && (
                                            <div className="bg-emerald-100 text-emerald-900 text-[10px] font-black px-2 py-1 rounded border border-emerald-300 text-center uppercase tracking-wider">
                                              Branche en cours de traitement
                                            </div>
                                          )}
                                          {dependentBranches.map(depIdx => (
                                            <div
                                              key={depIdx}
                                              className="bg-rose-50 text-rose-800 text-[10px] font-bold px-2 py-1 rounded border border-rose-200 flex justify-between items-center"
                                            >
                                              <span>Condition pour Branche {depIdx + 1}</span>
                                              {activeProject.isEditable && (
                                                <button
                                                  onClick={() => {
                                                    const targetNiveau = `EXTRANT ${depIdx + 1}`;
                                                    updateRisk(i + 1, targetNiveau, 'hypothese', '');
                                                    updateRisk(i + 1, targetNiveau, 'linkedBranchIndex', null);
                                                  }}
                                                  className="text-rose-500 hover:text-rose-800 cursor-pointer p-0.5"
                                                  title="Retirer cette condition"
                                                >
                                                  <X size={12} />
                                                </button>
                                              )}
                                            </div>
                                          ))}
                                        </div>

                                        {/* SÉLECTEUR D'ACTIONS BRANCHE */}
                                        <div className="mb-4 w-64">
                                          <select
                                            className="w-full bg-slate-50 border border-slate-300 text-[10px] font-bold rounded p-1.5 outline-none cursor-pointer hover:border-emerald-500 transition-all"
                                            value=""
                                            onChange={e => {
                                              const val = e.target.value;
                                              if (!val) return;
                                              if (val === 'focus') {
                                                const currentFocused = filterContext.focusedBranches || [];
                                                const newFocused = [
                                                  ...currentFocused,
                                                  { axeIndex: i, projetIndex: j }
                                                ];
                                                setFilterContext({ type: 'projet', focusedBranches: newFocused, focusedAxes: [] });
                                                setActiveProject({
                                                  ...activeProject,
                                                  entityLevel: 'Focus Branche',
                                                  displayName: `Focus : Branche ${j + 1}`
                                                });
                                              } else if (val === 'unfocus') {
                                                const currentFocused = filterContext.focusedBranches || [];
                                                const newFocused = currentFocused.filter(
                                                  f => !(f.axeIndex === i && f.projetIndex === j)
                                                );
                                                if (newFocused.length === 0) {
                                                  setFilterContext({ type: 'all', focusedBranches: [], focusedAxes: [] });
                                                  setActiveProject({
                                                    ...activeProject,
                                                    entityLevel: 'Portefeuille',
                                                    displayName: activeProject.name
                                                  });
                                                } else {
                                                  setFilterContext({ type: 'projet', focusedBranches: newFocused, focusedAxes: [] });
                                                  setActiveProject({
                                                    ...activeProject,
                                                    entityLevel: 'Focus Multiple',
                                                    displayName: `Focus (${newFocused.length} branches)`
                                                  });
                                                }
                                              } else if (val.startsWith('add_hypo_')) {
                                                const targetIdx = parseInt(val.split('_')[2]);
                                                const targetNiveau = `EXTRANT ${targetIdx + 1}`;
                                                const textHypo = `${proj.extrant || 'Extrant non défini'}`;
                                                updateRisk(i + 1, targetNiveau, 'hypothese', textHypo);
                                                updateRisk(i + 1, targetNiveau, 'linkedBranchIndex', j);
                                              }
                                              e.target.value = '';
                                            }}
                                          >
                                            <option value="">Actions sur Branche {j + 1}...</option>
                                            <optgroup label="1. FOCUS SUR L'ÉTUDE">
                                              {isFocusedBranch ? (
                                                <option value="unfocus">Annuler le focus (Voir tout)</option>
                                              ) : (
                                                <option value="focus">Traiter cette branche (Focus)</option>
                                              )}
                                            </optgroup>
                                            {activeProject.isEditable && projs.length > 1 && (
                                              <optgroup label="2. DÉFINIR COMME HYPOTHÈSE POUR :">
                                                {projs.map((p, pIndex) => {
                                                  if (pIndex === j) return null;
                                                  const targetRisk = (activeProject.garData.risks || []).find(
                                                    r => r.axe === i + 1 && r.niveau === `EXTRANT ${pIndex + 1}`
                                                  );
                                                  const isAlreadyConditioned =
                                                    targetRisk?.linkedBranchIndex !== undefined &&
                                                    targetRisk?.linkedBranchIndex !== null;
                                                  if (!dependentBranches.includes(pIndex) && !isAlreadyConditioned) {
                                                    return (
                                                      <option key={pIndex} value={`add_hypo_${pIndex}`}>
                                                        La Branche {pIndex + 1}
                                                      </option>
                                                    );
                                                  }
                                                  return null;
                                                })}
                                              </optgroup>
                                            )}
                                          </select>
                                        </div>

                                        {/* EXTRANT (LIVRABLE) */}
                                        <div className="bg-teal-50/70 p-2.5 rounded-lg border border-teal-200 w-64 text-center z-10 shadow-2xs">
                                          <h5 className="text-[9px] uppercase font-black text-teal-800 mb-1">
                                            Extrant {j + 1} (Livrable)
                                          </h5>
                                          <p className="text-xs font-bold text-teal-950 bg-white/80 p-2 rounded border border-teal-200">
                                            {proj.extrant || (
                                              <span className="text-slate-400 italic">
                                                Dérivé de la contrainte correspondante
                                              </span>
                                            )}
                                          </p>
                                        </div>

                                        <div className="w-0.5 h-6 bg-slate-300"></div>

                                        {/* ACTIVITÉS & INTRANTS */}
                                        <div className="flex justify-center relative w-full">
                                          {activites.map((act, k) => (
                                            <div key={k} className="flex flex-col items-center relative px-2">
                                              {activites.length > 1 && (
                                                <>
                                                  {k !== 0 && (
                                                    <div className="absolute top-0 left-0 w-1/2 h-0.5 bg-slate-300"></div>
                                                  )}
                                                  {k !== activites.length - 1 && (
                                                    <div className="absolute top-0 right-0 w-1/2 h-0.5 bg-slate-300"></div>
                                                  )}
                                                </>
                                              )}
                                              <div className="w-0.5 h-6 bg-slate-300"></div>

                                              <div className="bg-emerald-50/70 p-2.5 rounded-lg border border-emerald-200 w-64 text-center z-10 relative shadow-2xs">
                                                <h5 className="text-[9px] uppercase font-black text-emerald-800 mb-1">
                                                  Activité {k + 1}
                                                </h5>
                                                <p className="text-xs font-medium text-emerald-950 bg-white/80 p-2 rounded border border-emerald-200">
                                                  {act || (
                                                    <span className="text-slate-400 italic">
                                                      Dérivée de la cause profonde
                                                    </span>
                                                  )}
                                                </p>
                                              </div>

                                              <div className="w-0.5 h-6 bg-slate-300"></div>

                                              <div className="bg-slate-50 p-3 rounded-lg border border-slate-300 w-64 text-left z-10 shadow-2xs relative">
                                                <h5 className="text-[9px] uppercase font-black text-slate-800 mb-2 text-center border-b border-slate-200 pb-1">
                                                  Intrants & Chiffrage #{k + 1}
                                                </h5>
                                                <div className="space-y-3">
                                                  <div>
                                                    <h6 className="text-[8px] uppercase font-bold text-slate-500 mb-1">
                                                      Ressources Humaines (RH)
                                                    </h6>
                                                    <EditableResourceList
                                                      isEditable={activeProject.isEditable}
                                                      items={getSafe2D(proj?.intrants_rh, k)}
                                                      onChange={v =>
                                                        updateIntrants(i, j, k, 'intrants_rh', v)
                                                      }
                                                      placeholderLabel="Poste / Profil..."
                                                    />
                                                  </div>
                                                  <div>
                                                    <h6 className="text-[8px] uppercase font-bold text-slate-500 mb-1">
                                                      Ressources Matérielles
                                                    </h6>
                                                    <EditableResourceList
                                                      isEditable={activeProject.isEditable}
                                                      items={getSafe2D(proj?.intrants_mat, k)}
                                                      onChange={v =>
                                                        updateIntrants(i, j, k, 'intrants_mat', v)
                                                      }
                                                      placeholderLabel="Équipement..."
                                                    />
                                                  </div>
                                                  <div className="pt-2 border-t border-slate-200">
                                                    <h6 className="text-[8px] uppercase font-bold text-emerald-800 mb-1 text-center">
                                                      Ressources Financières
                                                    </h6>
                                                    {renderActivityCost(proj, k)}
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

          {/* ONGLET : REGISTRE PARTIES PRENANTES */}
          {activeTab === 'registre_parties' &&
            (!activeProject ? (
              <NoProjectScreen setActiveTab={setActiveTab} />
            ) : (
              <div className="flex-1 flex flex-col w-full max-w-full mx-auto space-y-4">
                <div className="bg-white rounded-xl shadow-xs border border-slate-200 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h2 className="text-lg font-black text-slate-900">Registre des Parties Prenantes</h2>
                    <p className="text-xs text-slate-500">
                      Cartographie des acteurs clés par axe et par projet (bénéficiaires, institutions internes, partenaires externes, opérateurs techniques et financiers).
                    </p>
                  </div>
                  {filterContext.type !== 'all' && (
                    <div className="flex items-center gap-2 text-xs bg-emerald-50 text-emerald-800 px-3 py-1.5 rounded-lg border border-emerald-200">
                      <Filter size={14} />
                      <span className="font-bold">Affichage filtré par focus actif</span>
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-xl shadow-xs border border-slate-300 overflow-auto flex-1 min-h-[500px] relative custom-scrollbar">
                  <table className="w-full text-left text-xs text-slate-700 border-collapse mb-0 min-w-[1200px]">
                    <thead className="bg-slate-900 text-white text-[11px] uppercase tracking-wider">
                      <tr>
                        <th style={{ width: '20%' }} className="sticky top-0 z-30 px-3 py-3 border-r border-slate-800 bg-slate-900 font-bold">
                          Bénéficiaires
                        </th>
                        <th style={{ width: '20%' }} className="sticky top-0 z-20 px-3 py-3 border-r border-slate-800 bg-slate-900 font-bold">
                          Interne à l'Institution
                        </th>
                        <th style={{ width: '20%' }} className="sticky top-0 z-20 px-3 py-3 border-r border-slate-800 bg-slate-900 font-bold">
                          Externe à l'Institution
                        </th>
                        <th style={{ width: '20%' }} className="sticky top-0 z-20 px-3 py-3 border-r border-slate-800 bg-slate-900 font-bold">
                          Partenaires Techniques
                        </th>
                        <th style={{ width: '20%' }} className="sticky top-0 z-20 px-3 py-3 bg-slate-900 font-bold">
                          Partenaires Financiers
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {(activeProject.garData.rendement?.axes || []).map((axe, i) => {
                        if (!isAxeFocused(i)) return null;
                        return (
                          <React.Fragment key={i}>
                            <AxeRow axe={axe} colSpan={5} />
                            {(axe.projets || []).map((proj, pIdx) => {
                              if (!isProjFocused(i, pIdx)) return null;
                              const cats = [
                                { key: 'beneficiaires', label: 'Bénéficiaires' },
                                { key: 'instCentralises', label: "Interne à l'Institution" },
                                { key: 'instDecentralises', label: "Externe à l'Institution" },
                                { key: 'operateursTechniques', label: 'Techniques' },
                                { key: 'ptf', label: 'Financiers' }
                              ];
                              return (
                                <React.Fragment key={pIdx}>
                                  <ProjRow proj={proj} pIdx={pIdx} colSpan={5} />
                                  <tr className="border-b border-slate-200 bg-white">
                                    {cats.map((cat, catIdx) => {
                                      const actors = (
                                        activeProject.garData.stakeholders?.[cat.key] || []
                                      )
                                        .map((a, idx) => ({ ...a, absIdx: idx }))
                                        .filter(a => a.axe === i + 1 && a.projetIndex === pIdx);

                                      return (
                                        <td
                                          key={cat.key}
                                          className={`p-2.5 align-top ${
                                            catIdx < cats.length - 1 ? 'border-r border-slate-200' : ''
                                          }`}
                                        >
                                          <div className="space-y-2">
                                            {actors.map(act => (
                                              <div
                                                key={act.absIdx}
                                                className="flex items-start gap-1 bg-slate-50 p-2 rounded-lg border border-slate-200 shadow-2xs group"
                                              >
                                                <div className="flex-1">
                                                  <EditableCell
                                                    isEditable={activeProject.isEditable}
                                                    value={act.nom}
                                                    onChange={v =>
                                                      updateStakeholder(
                                                        cat.key,
                                                        i + 1,
                                                        pIdx,
                                                        act.absIdx,
                                                        'nom',
                                                        v
                                                      )
                                                    }
                                                    type="textarea"
                                                    placeholder="Désignation de la partie prenante..."
                                                  />
                                                </div>
                                                {activeProject.isEditable && (
                                                  <button
                                                    onClick={() => deleteStakeholder(cat.key, act.absIdx)}
                                                    className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer opacity-70 group-hover:opacity-100 transition-opacity"
                                                    title="Supprimer"
                                                  >
                                                    <Trash2 size={13} />
                                                  </button>
                                                )}
                                              </div>
                                            ))}
                                            {activeProject.isEditable && (
                                              <button
                                                onClick={() => addStakeholder(cat.key, i + 1, pIdx)}
                                                className="flex w-full items-center justify-center gap-1 py-1.5 bg-slate-50 hover:bg-emerald-50 hover:text-emerald-800 text-slate-500 rounded-lg border border-dashed border-slate-300 text-[10px] font-bold uppercase transition-colors cursor-pointer"
                                              >
                                                <Plus size={11} /> Ajouter
                                              </button>
                                            )}
                                          </div>
                                        </td>
                                      );
                                    })}
                                  </tr>
                                </React.Fragment>
                              );
                            })}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
        </main>
      </div>

      {/* CONFIRMATION MODAL */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full border border-slate-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 bg-rose-50 text-rose-600 rounded-xl">
                <AlertCircle size={22} />
              </div>
              <h3 className="text-base font-black text-slate-900">{confirmModal.title}</h3>
            </div>
            <p className="text-slate-600 mb-6 text-xs leading-relaxed">{confirmModal.message}</p>
            <div className="flex justify-end gap-2.5">
              <Button variant="secondary" onClick={closeConfirmModal}>
                Annuler
              </Button>
              <Button
                variant="danger"
                onClick={() => {
                  if (confirmModal.onConfirm) confirmModal.onConfirm();
                  closeConfirmModal();
                }}
              >
                Confirmer
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
