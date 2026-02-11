
import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';

interface SystemMasteryChartProps {
  data: { system: string; mastery: number }[];
  height?: number | string;
}

export const SystemMasteryChart: React.FC<SystemMasteryChartProps> = ({ data, height }) => {
  // Calculate dynamic height if not explicitly provided to prevent squashed bars
  // approx 50px per bar slot ensures readability
  const calculatedHeight = data.length > 0 ? Math.max(250, data.length * 50) : 250;
  const finalHeight = height || calculatedHeight;

  return (
    <div style={{ height: finalHeight, width: '100%', minHeight: '250px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart layout="vertical" data={data} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
          <XAxis type="number" domain={[0, 100]} hide />
          <YAxis 
            dataKey="system" 
            type="category" 
            width={110} 
            tick={{fontSize: 11, fontWeight: 700, fill: '#64748b'}} 
            axisLine={false} 
            tickLine={false} 
            interval={0}
          />
          <Tooltip 
            cursor={{fill: 'transparent'}} 
            contentStyle={{
              borderRadius: '12px', 
              border: 'none', 
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
              fontFamily: 'Inter, sans-serif'
            }} 
          />
          <Bar dataKey="mastery" radius={[0, 6, 6, 0]} barSize={24}>
            {data.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={entry.mastery < 60 ? '#f43f5e' : entry.mastery < 80 ? '#fbbf24' : '#10b981'} 
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
