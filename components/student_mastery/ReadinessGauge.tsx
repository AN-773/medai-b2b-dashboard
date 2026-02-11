
import React from 'react';

export const ReadinessGauge = ({ 
  value, 
  size = 'small', 
  showText = true,
  label
}: { 
  value: number; 
  size?: 'small' | 'medium' | 'large'; 
  showText?: boolean;
  label?: string;
}) => {
    // Map size to dimension in pixels
    const sizeMap = {
      small: 80,
      medium: 120,
      large: 160,
    };
    
    const dimension = sizeMap[size];
    const center = dimension / 2;
    // Adjust stroke width based on size
    const strokeWidth = size === 'small' ? 8 : size === 'medium' ? 12 : 16;
    const radius = center - strokeWidth;
    const circumference = 2 * Math.PI * radius;
    // Calculate offset for the progress arc
    const offset = circumference - (value / 100) * circumference;

    // Font size mapping
    const fontSize = size === 'small' ? 'text-lg' : size === 'medium' ? 'text-3xl' : 'text-5xl';
    
    // Color logic
    const getColor = (v: number) => {
        if (v < 60) return '#f43f5e'; // rose-500
        if (v < 80) return '#fbbf24'; // amber-400
        return '#1BD183'; // theme green
    };

    const color = getColor(value);

    return (
      <div className="relative flex items-center justify-center">
        {/* SVG Ring */}
        <svg 
            width={dimension} 
            height={dimension} 
            className="transform -rotate-90 origin-center"
        >
          {/* Background Track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke="currentColor"
            strokeOpacity={0.1}
            strokeWidth={strokeWidth}
            className="text-slate-500" 
          />
          {/* Progress Arc */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="transparent"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        {/* Centered Text */}
        {showText && (
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className={`${fontSize} font-black ${getColor(value) === '#1BD183' ? 'text-white' : 'text-white'} drop-shadow-md leading-none`}>
                    {value}%
                </span>
                {label && (
                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">
                      {label}
                   </span>
                )}
            </div>
        )}
      </div>
    );
};
