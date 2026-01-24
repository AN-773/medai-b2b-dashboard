import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  X,
  Target,
  Zap,
  AlertCircle,
  ChevronRight,
  CheckCircle2,
  LayoutGrid,
  Brain,
} from 'lucide-react';
import { OrganSystem } from '../types';
import { MOCK_ORGAN_SYSTEMS } from '../constants';

interface CurriculumAuditMapProps {
  onClose: () => void;
}

const SYSTEMS_METRICS = [
  {
    id: 'ORG-ENDO',
    coverage: 92,
    count: 245,
    status: 'Optimal',
    color: 'bg-[#1BD183]',
  },
  {
    id: 'ORG-CARDIO',
    coverage: 88,
    count: 412,
    status: 'Optimal',
    color: 'bg-[#1BD183]',
  },
  {
    id: 'ORG-RENAL',
    coverage: 42,
    count: 88,
    status: 'Critical',
    color: 'bg-rose-500',
  },
  {
    id: 'ORG-RESP',
    coverage: 65,
    count: 156,
    status: 'Under',
    color: 'bg-amber-500',
  },
  {
    id: 'ORG-NEURO',
    coverage: 78,
    count: 198,
    status: 'Acceptable',
    color: 'bg-[#1BD183]',
  },
  {
    id: 'ORG-GI',
    coverage: 81,
    count: 210,
    status: 'Optimal',
    color: 'bg-[#1BD183]',
  },
  {
    id: 'ORG-HEME',
    coverage: 35,
    count: 45,
    status: 'Critical',
    color: 'bg-rose-500',
  },
  {
    id: 'ORG-SKIN',
    coverage: 95,
    count: 120,
    status: 'Optimal',
    color: 'bg-[#1BD183]',
  },
  {
    id: 'ORG-MSK',
    coverage: 58,
    count: 92,
    status: 'Under',
    color: 'bg-amber-500',
  },
  {
    id: 'ORG-REPRO',
    coverage: 72,
    count: 144,
    status: 'Acceptable',
    color: 'bg-[#1BD183]',
  },
  {
    id: 'ORG-SOC',
    coverage: 98,
    count: 85,
    status: 'Optimal',
    color: 'bg-[#1BD183]',
  },
  {
    id: 'ORG-BIOSTAT',
    coverage: 88,
    count: 110,
    status: 'Optimal',
    color: 'bg-[#1BD183]',
  },
];

const CurriculumAuditMap: React.FC<CurriculumAuditMapProps> = ({ onClose }) => {
  const navigate = useNavigate();
  const systemsWithNames = useMemo(() => {
    return SYSTEMS_METRICS.map((metric) => {
      const sys = MOCK_ORGAN_SYSTEMS.find((s) => s.id === metric.id);
      return {
        ...metric,
        name: sys ? sys.name : metric.id,
      };
    });
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 lg:p-12">
      <div
        className="absolute inset-0 bg-slate-900/80 backdrop-blur-xl animate-in fade-in duration-300"
        onClick={onClose}
      />

      <div className="relative w-full max-w-7xl bg-white rounded-[3rem] shadow-2xl overflow-hidden border border-white/20 animate-in zoom-in-95 duration-500 flex flex-col max-h-full">
        {/* Header */}
        <div className="p-8 lg:p-12 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <LayoutGrid className="text-black" size={24} />
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">
                Curriculum Audit Map
              </h1>
            </div>
            <p className="text-slate-500 font-medium italic">
              Global spatial overview of educational assets vs USMLE Outline.
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Global Coverage
              </span>
              <span className="text-2xl font-black text-black">74.2%</span>
            </div>
            <button
              onClick={onClose}
              className="p-3 bg-white border border-slate-200 text-slate-400 hover:text-slate-900 rounded-2xl transition shadow-sm"
            >
              <X size={24} />
            </button>
          </div>
        </div>

        {/* Content - Heatmap Grid */}
        <div className="flex-grow p-8 lg:p-12 overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {systemsWithNames.map((sys) => (
              <div
                key={sys.id}
                onClick={() => {
                  navigate('/curriculum');
                  onClose();
                }}
                className="group p-6 bg-white border border-slate-100 rounded-[2rem] hover:border-indigo-200 hover:shadow-xl transition-all cursor-pointer relative overflow-hidden"
              >
                <div className="flex justify-between items-start mb-6">
                  <div
                    className={`w-3 h-3 rounded-full ${sys.status === 'Critical' ? 'bg-rose-500' : sys.status === 'Under' ? 'bg-amber-500' : 'bg-emerald-500'}`}
                  />
                  <span
                    className={`text-[10px] font-black uppercase tracking-widest ${sys.status === 'Critical' ? 'text-rose-600' : sys.status === 'Under' ? 'text-amber-600' : 'text-emerald-600'}`}
                  >
                    {sys.status}
                  </span>
                </div>

                <h3 className="text-lg font-black text-slate-900 mb-1 truncate">
                  {sys.name}
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-4">
                  {sys.count} Items Indexed
                </p>

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-slate-500 uppercase">Coverage</span>
                    <span className="text-black">{sys.coverage}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-1000 ${sys.color}`}
                      style={{ width: `${sys.coverage}%` }}
                    />
                  </div>
                </div>

                <div className="mt-6 flex justify-between items-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <span className="text-[10px] font-black text-black uppercase">
                    View Details
                  </span>
                  <ChevronRight size={14} className="text-black" />
                </div>
              </div>
            ))}
          </div>

          {/* Cognitive Balance Summary */}
          <div className="relative mt-12 p-10 bg-[#0F1110] rounded-[3rem] text-white flex flex-col lg:flex-row items-center gap-12">
            <div className="absolute rounded-[3rem] inset-0 bg-gradient-to-br from-[#1BD183]/20 via-transparent to-transparent pointer-events-none"></div>

            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-3">
                <Brain size={24} className="text-[#1BD183]" />
                <h2 className="text-2xl font-black uppercase tracking-tight">
                  Institutional Cognitive Weight
                </h2>
              </div>
              <p className="text-indigo-200 text-sm leading-relaxed font-medium">
                The current authoring velocity favors <strong>"Apply"</strong>{' '}
                level clinical reasoning. We recommend increasing{' '}
                <strong>"Analyze"</strong> level multi-step items in the Renal
                and Hematology blocks to match USMLE Step 1 difficulty
                benchmarks.
              </p>
              <div className="flex gap-4 pt-4">
                <div className="text-center">
                  <div className="text-xl font-black">42%</div>
                  <div className="text-[8px] font-black uppercase tracking-widest text-[#1BD183]">
                    Apply
                  </div>
                </div>
                <div className="w-px h-8 bg-indigo-800 self-center"></div>
                <div className="text-center">
                  <div className="text-xl font-black">28%</div>
                  <div className="text-[8px] font-black uppercase tracking-widest text-[#1BD183]">
                    Analyze
                  </div>
                </div>
                <div className="w-px h-8 bg-indigo-800 self-center"></div>
                <div className="text-center">
                  <div className="text-xl font-black">20%</div>
                  <div className="text-[8px] font-black uppercase tracking-widest text-[#1BD183]">
                    Understand
                  </div>
                </div>
                <div className="w-px h-8 bg-indigo-800 self-center"></div>
                <div className="text-center">
                  <div className="text-xl font-black">10%</div>
                  <div className="text-[8px] font-black uppercase tracking-widest text-[#1BD183]">
                    Recall
                  </div>
                </div>
              </div>
            </div>
            <div className="shrink-0">
              <button
                onClick={() => {
                  navigate('/workbench');
                  onClose();
                }}
                className="px-10 py-5 bg-primary-gradient text-white hover:bg-primary-gradient-hover rounded-[2rem] font-black text-sm uppercase tracking-widest  flex items-center gap-4"
              >
                <Zap size={20} fill="currentColor" /> Launch Remediation Lab
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CurriculumAuditMap;
