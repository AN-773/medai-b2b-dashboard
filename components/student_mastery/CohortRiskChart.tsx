
import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface CohortRiskChartProps {
  data: { range: string; count: number }[];
  height?: number | string;
}

export const CohortRiskChart: React.FC<CohortRiskChartProps> = ({ data, height = 250 }) => {
  return (
    <div style={{ height: height, width: '100%' }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
          <XAxis 
            dataKey="range" 
            axisLine={false} 
            tickLine={false} 
            tick={{fontSize: 10, fontWeight: 700, fill: '#64748b'}} 
          />
          <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10}} />
          <Tooltip 
            cursor={{fill: '#f1f5f9'}} 
            contentStyle={{
              borderRadius: '12px', 
              border: 'none', 
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'
            }} 
          />
          <Bar dataKey="count" fill="#1BA6D1" radius={[6, 6, 0, 0]} barSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
