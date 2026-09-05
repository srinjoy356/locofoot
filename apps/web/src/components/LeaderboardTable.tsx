import React from 'react';
import Link from 'next/link';
import { ExportControls } from '@/components/shared/ExportControls';

export type LeaderboardRowData = {
    event_player_id: string;
    player_unique_code?: string;
    player_name: string;
    team_name: string;
    team_registration_id?: string;
    matches_played: number;
    value: number;
};

export type LeaderboardTableProps = {
    title: string;
    metricLabel: string;
    data: LeaderboardRowData[];
    loading?: boolean;
    viewAllHref?: string;
    eventSlug?: string;
    showExport?: boolean;
    exportFilename?: string;
};

export const LeaderboardTable: React.FC<LeaderboardTableProps> = ({ title, metricLabel, data, loading, viewAllHref, eventSlug, showExport, exportFilename }) => {
    return (
        <div className="bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800 print:bg-white print:border-none print:shadow-none text-zinc-100 print:text-black">
            <div className="px-4 py-4 border-b border-zinc-800 bg-zinc-900 print:bg-transparent print:border-slate-300 flex justify-between items-center gap-2">
                <h3 className="font-bold text-zinc-100 print:text-black uppercase tracking-widest text-sm flex-1">{title}</h3>
                <div className="flex items-center gap-4">
                    {showExport && exportFilename && data.length > 0 && (
                        <ExportControls 
                            filename={exportFilename} 
                            data={data}
                            columns={[
                                { key: 'player_name', label: 'Player' },
                                { key: 'team_name', label: 'Team' },
                                { key: 'matches_played', label: 'MP' },
                                { key: 'value', label: metricLabel }
                            ]}
                        />
                    )}
                    {viewAllHref && (
                        <Link href={viewAllHref} className="text-xs font-semibold text-[#ccff00] hover:text-[#e6ff66] uppercase tracking-wider print:hidden">
                            View All
                        </Link>
                    )}
                </div>
            </div>
            
            {loading ? (
                <div className="p-4 text-center text-zinc-500">Loading...</div>
            ) : data.length === 0 ? (
                <div className="p-4 text-center text-zinc-500">No data available</div>
            ) : (
                <table className="min-w-full text-sm text-left">
                    <thead className="bg-zinc-800/50 print:bg-slate-100 text-zinc-400 print:text-black font-medium border-b border-zinc-800 print:border-slate-300">
                        <tr>
                            <th className="px-4 py-3 w-10 text-center">#</th>
                            <th className="px-4 py-3">Player</th>
                            <th className="px-4 py-3 hidden sm:table-cell">Team</th>
                            <th className="px-4 py-3 text-center w-16">MP</th>
                            <th className="px-4 py-3 text-right w-20">{metricLabel}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/50 print:divide-slate-200">
                        {data.map((row, idx) => (
                            <tr key={row.event_player_id} className="hover:bg-zinc-800/30 transition-colors">
                                <td className="px-4 py-3 text-center text-zinc-500 print:text-slate-600 font-bold">{idx + 1}</td>
                                <td className="px-4 py-3">
                                    <div className="font-bold text-zinc-100 print:text-black">
                                        {eventSlug ? (
                                            <Link href={`/events/${eventSlug}/players/${row.event_player_id}`} className="hover:underline">{row.player_name}</Link>
                                        ) : (
                                            row.player_name
                                        )}
                                    </div>
                                    <div className="text-xs text-zinc-500 sm:hidden">
                                        {eventSlug && row.team_registration_id ? (
                                            <Link href={`/events/${eventSlug}/teams/${row.team_registration_id}`} className="hover:underline">{row.team_name}</Link>
                                        ) : (
                                            row.team_name
                                        )}
                                    </div>
                                </td>
                                <td className="px-4 py-3 text-zinc-400 print:text-slate-700 hidden sm:table-cell">
                                    {eventSlug && row.team_registration_id ? (
                                        <Link href={`/events/${eventSlug}/teams/${row.team_registration_id}`} className="hover:underline">{row.team_name}</Link>
                                    ) : (
                                        row.team_name
                                    )}
                                </td>
                                <td className="px-4 py-3 text-center text-zinc-400 print:text-slate-700">{row.matches_played}</td>
                                <td className="px-4 py-3 text-right font-bold text-zinc-100 print:text-black">{row.value}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};
