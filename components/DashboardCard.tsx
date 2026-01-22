
import React from 'react';

interface DashboardCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

const DashboardCard: React.FC<DashboardCardProps> = ({ title, subtitle, children, footer, className = "" }) => {
  return (
    <div className={`bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col ${className}`}>
      <div className="p-5 border-b border-slate-100">
        <h3 className="text-lg font-semibold text-slate-800">{title}</h3>
        {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
      </div>
      <div className="p-5 flex-grow">
        {children}
      </div>
      {footer && (
        <div className="p-4 bg-slate-50 border-t border-slate-100 mt-auto">
          {footer}
        </div>
      )}
    </div>
  );
};

export default DashboardCard;
