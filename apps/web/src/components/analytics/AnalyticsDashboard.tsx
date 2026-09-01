'use client';

import React, { useState } from 'react';
import { AttackAnalytics } from './AttackAnalytics';
import { PlaymakingAnalytics } from './PlaymakingAnalytics';
import { DefendingAnalytics } from './DefendingAnalytics';
import { GoalkeepingAnalytics } from './GoalkeepingAnalytics';
import { DisciplineAnalytics } from './DisciplineAnalytics';

type Category = 'ATTACK' | 'PLAYMAKING' | 'DEFENDING' | 'GOALKEEPING' | 'DISCIPLINE';

export function AnalyticsDashboard({ players, teams, eventSlug }: { players: any[], teams: any[], eventSlug: string }) {
  const [activeCategory, setActiveCategory] = useState<Category>('ATTACK');

  const categories = [
    { id: 'ATTACK', label: 'Attack' },
    { id: 'PLAYMAKING', label: 'Playmaking' },
    { id: 'DEFENDING', label: 'Defending' },
    { id: 'GOALKEEPING', label: 'Goalkeeping' },
    { id: 'DISCIPLINE', label: 'Discipline' },
  ];

  return (
    <div className="space-y-6">
      {/* Category Navigation */}
      <div className="flex space-x-1 bg-zinc-900/50 p-1 rounded-xl overflow-x-auto border border-zinc-800">
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setActiveCategory(c.id as Category)}
            className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              activeCategory === c.id 
                ? 'bg-zinc-800 text-white' 
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Basic Filters placeholder (expanding this based on URL would be here) */}
      <div className="flex items-center gap-4 bg-zinc-900/50 p-4 rounded-xl border border-zinc-800">
        <div className="text-sm text-zinc-400">Filters:</div>
        <select className="bg-zinc-900 border border-zinc-700 rounded-md text-sm text-zinc-200 px-3 py-1.5 focus:outline-none focus:border-locofoot-500">
          <option value="all">Entire Tournament</option>
          <option value="group">Group Stage (Coming Soon)</option>
          <option value="knockout">Knockout Stage (Coming Soon)</option>
        </select>
        <select className="bg-zinc-900 border border-zinc-700 rounded-md text-sm text-zinc-200 px-3 py-1.5 focus:outline-none focus:border-locofoot-500">
          <option value="0">Min Attempts: 0</option>
          <option value="5">Min Attempts: 5</option>
          <option value="10">Min Attempts: 10</option>
        </select>
      </div>

      {/* Render Active Category */}
      <div className="min-h-[500px]">
        {activeCategory === 'ATTACK' && <AttackAnalytics players={players} teams={teams} eventSlug={eventSlug} />}
        {activeCategory === 'PLAYMAKING' && <PlaymakingAnalytics players={players} teams={teams} eventSlug={eventSlug} />}
        {activeCategory === 'DEFENDING' && <DefendingAnalytics players={players} teams={teams} eventSlug={eventSlug} />}
        {activeCategory === 'GOALKEEPING' && <GoalkeepingAnalytics players={players} teams={teams} eventSlug={eventSlug} />}
        {activeCategory === 'DISCIPLINE' && <DisciplineAnalytics players={players} teams={teams} eventSlug={eventSlug} />}
      </div>
    </div>
  );
}
