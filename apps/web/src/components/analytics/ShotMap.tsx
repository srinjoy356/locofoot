'use client';

import React from 'react';

interface Shot {
  event_id: string;
  match_id: string;
  player_id: string;
  team_id: string;
  period: string;
  display_minute: number;
  result: string;
  shot_type: string;
  situation: string;
  x_norm: number;
  y_norm: number;
  distance: number;
}

interface ShotMapProps {
  shots: Shot[];
}

export function ShotMap({ shots }: ShotMapProps) {
  // Football pitch is typically 105m x 68m.
  // In our normalized coords:
  // x=0 to 100 (width of pitch, 0 is left touchline, 100 is right touchline)
  // y=0 to 100 (length of pitch, 0 is attacking goal line, 100 is defending goal line)
  // Wait, no. Standard coordinate: 
  // Let's draw the attacking half. So y goes from 0 to 50.
  // x goes from 0 to 100.
  
  // Actually, we can draw the entire pitch or just the half pitch. 
  // Let's draw the attacking half.
  // SVG coordinates: (0,0) is top-left.
  // If we map x_norm to x (width), and y_norm to y (height).
  // y_norm=0 is the top (goal line). y_norm=50 is the bottom (halfway line).

  const getShotColor = (result: string) => {
    switch (result) {
      case 'GOAL': return '#f97316'; // orange-500
      case 'SAVED': return '#3b82f6'; // blue-500
      case 'WOODWORK': return '#eab308'; // yellow-500
      case 'BLOCKED': return '#6b7280'; // gray-500
      case 'OFF_TARGET': return '#ef4444'; // red-500
      default: return '#a1a1aa'; // zinc-400
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col items-center">
      
      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-4 mb-6 text-sm font-semibold text-zinc-300">
        <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-500"></span> Goal</div>
        <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500"></span> Saved</div>
        <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-500"></span> Woodwork</div>
        <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500"></span> Off Target</div>
        <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-gray-500"></span> Blocked</div>
      </div>

      <div className="relative w-full aspect-[100/68] bg-emerald-700 border-4 border-white rounded-sm overflow-hidden shadow-2xl">
        {/* SVG Pitch Markings for ATTACKING HALF */}
        {/* We view the pitch vertically. Goal at the top. */}
        <svg viewBox="0 0 100 68" className="absolute inset-0 w-full h-full text-white/50" style={{ transform: 'rotate(0deg)' }}>
          {/* Halfway line (bottom of this half pitch) */}
          <line x1="0" y1="68" x2="100" y2="68" stroke="currentColor" strokeWidth="0.5" />
          
          {/* Penalty Area */}
          <rect x="21.1" y="0" width="57.8" height="16.5" fill="none" stroke="currentColor" strokeWidth="0.5" />
          
          {/* Goal Area */}
          <rect x="36.8" y="0" width="26.4" height="5.5" fill="none" stroke="currentColor" strokeWidth="0.5" />
          
          {/* Goal Line */}
          <line x1="45" y1="0" x2="55" y2="0" stroke="white" strokeWidth="1.5" />
          
          {/* Penalty Spot (x=50, y=11) */}
          <circle cx="50" cy="11" r="0.5" fill="currentColor" />
          
          {/* Penalty Arc */}
          {/* A standard arc. Radius = 9.15. Center = (50, 11). We only draw outside the penalty area (y > 16.5) */}
          <path d="M 43 16.5 A 9.15 9.15 0 0 0 57 16.5" fill="none" stroke="currentColor" strokeWidth="0.5" />

          {/* Center Circle Arc (at halfway line y=68) */}
          <path d="M 40.85 68 A 9.15 9.15 0 0 1 59.15 68" fill="none" stroke="currentColor" strokeWidth="0.5" />
          
          {/* Corner arcs */}
          <path d="M 0 2 A 2 2 0 0 0 2 0" fill="none" stroke="currentColor" strokeWidth="0.5" />
          <path d="M 100 2 A 2 2 0 0 1 98 0" fill="none" stroke="currentColor" strokeWidth="0.5" />
        </svg>

        {/* Shots */}
        <div className="absolute inset-0">
          {shots.map(shot => {
            // Note: x_norm is 0-100, y_norm is 0-100.
            // SVG viewBox is 0-100 width (x), 0-68 height (y).
            // To scale y_norm (0-100) to our 0-68 half-pitch representation:
            // Actually, if y_norm is the full length (0-100), then attacking half is y_norm 0 to 50.
            // We map y_norm 0-50 to SVG y 0-68.
            // Wait, if it's full length, y_norm goes to 100. Let's just scale y_norm directly: 
            // y_position = (shot.y_norm / 100) * 100% of container height.
            // But wait, SVG viewbox is 100x68. Is y_norm proportional to 100x100? Yes.
            const xPercent = shot.x_norm;
            const yPercent = shot.y_norm;
            
            // Only show shots in the attacking half (y_norm <= 60 to be safe and include some long shots)
            if (yPercent > 70) return null;

            return (
              <div 
                key={shot.event_id}
                className="absolute w-3 h-3 -ml-1.5 -mt-1.5 rounded-full border-2 border-zinc-900 shadow-md group cursor-pointer transition-transform hover:scale-150 hover:z-10"
                style={{ 
                  left: `${xPercent}%`, 
                  top: `${yPercent}%`,
                  backgroundColor: getShotColor(shot.result)
                }}
              >
                {/* Tooltip */}
                <div className="absolute opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity bottom-full left-1/2 -translate-x-1/2 mb-2 w-max bg-zinc-900 border border-zinc-700 text-white text-xs rounded p-2 shadow-xl z-50">
                  <div className="font-bold text-orange-400 mb-1">{shot.display_minute}' - {shot.result}</div>
                  <div className="text-zinc-300">Distance: {shot.distance.toFixed(1)}m</div>
                  <div className="text-zinc-400 text-[10px] uppercase mt-1">{shot.situation} • {shot.shot_type}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
