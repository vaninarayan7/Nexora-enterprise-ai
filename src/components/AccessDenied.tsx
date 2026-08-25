import { motion } from "motion/react";
import { ShieldAlert, ArrowLeft, Lock } from "lucide-react";

interface AccessDeniedProps {
  onBackToDashboard: () => void;
  requiredRoles?: string[];
  currentRole?: string;
}

export default function AccessDenied({
  onBackToDashboard,
  requiredRoles = ["Admin", "Manager"],
  currentRole = "Employee"
}: AccessDeniedProps) {
  return (
    <div id="access-denied-container" className="flex flex-col items-center justify-center min-h-[70vh] px-6 text-center">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="max-w-md w-full bg-white dark:bg-[#111318] border border-slate-200/60 dark:border-slate-800/60 rounded-2xl p-8 shadow-xl relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-500 to-rose-400" />
        
        {/* Shield Icon with concentric rings */}
        <div className="relative flex items-center justify-center w-20 h-20 mx-auto mb-6">
          <div className="absolute inset-0 rounded-full bg-red-500/10 dark:bg-red-500/5 animate-pulse" />
          <div className="absolute inset-2 rounded-full bg-red-500/10 dark:bg-red-500/10" />
          <div className="relative flex items-center justify-center w-12 h-12 rounded-full bg-red-500 text-white shadow-md">
            <Lock className="w-5 h-5" />
          </div>
        </div>

        <h1 className="text-2xl font-extrabold text-slate-950 dark:text-white tracking-tight mb-2">
          Access Restricted
        </h1>
        
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
          Your current security profile (<span className="font-extrabold text-red-500 dark:text-red-400 uppercase tracking-wide">{currentRole}</span>) does not possess the permissions necessary to view this node.
        </p>

        <div className="bg-slate-50 dark:bg-slate-850/30 border border-slate-100 dark:border-slate-800/40 rounded-xl p-4 mb-8 text-left">
          <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
            Authorization Requirements
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Required Roles:</span>
              <div className="flex gap-1">
                {requiredRoles.map((r) => (
                  <span key={r} className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    {r}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex justify-between items-center text-xs border-t border-slate-100 dark:border-slate-800/40 pt-1.5">
              <span className="text-slate-500 dark:text-slate-400 font-medium">Your Role:</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-500/10 text-red-600 dark:text-red-400 uppercase">
                {currentRole}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={onBackToDashboard}
          className="w-full py-2.5 px-4 text-xs font-bold rounded-xl bg-slate-900 dark:bg-slate-800 text-white hover:opacity-95 dark:hover:bg-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Dashboard</span>
        </button>
      </motion.div>
    </div>
  );
}
