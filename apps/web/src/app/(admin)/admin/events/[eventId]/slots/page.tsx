'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Loader2, Calendar, Clock, CheckCircle2, AlertCircle, X, Calculator, Edit, Save, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function AdminSlotsPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.eventId as string;
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slots, setSlots] = useState<any[]>([]);

  const [editingSlotIndex, setEditingSlotIndex] = useState<number | null>(null);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');

  const [batchStart, setBatchStart] = useState('');
  const [matchHalf, setMatchHalf] = useState('20');
  const [halfTime, setHalfTime] = useState('2');
  const [bufferMins, setBufferMins] = useState('2');
  const [numSlots, setNumSlots] = useState('5');
  const [fieldsCount, setFieldsCount] = useState('1');
  const [totalMatches, setTotalMatches] = useState(0);

  const [isFinalized, setIsFinalized] = useState(false);

  useEffect(() => {
    async function loadEventData() {
      try {
        const { data: eData } = await supabase.from('events').select('slot_structure_state, venue_id').eq('id', eventId).single();
        if (eData?.slot_structure_state === 'FINALIZED') {
          setIsFinalized(true);
        }

        const { data: settings } = await supabase.from('event_settings').select('*').eq('event_id', eventId).single();
        if (settings) {
          setMatchHalf((settings.first_half_minutes || 20).toString());
          setHalfTime((settings.half_time_minutes || 2).toString());
          setBufferMins((settings.buffer_minutes || 5).toString());
          
          const { count: teamCount, error: teamErr } = await supabase.from('event_team_registrations').select('*', { count: 'exact', head: true })
            .eq('event_id', eventId).eq('status', 'APPROVED');
            
          if (teamErr) console.error("Error fetching teams:", teamErr);
            
          let matches = 0;
          const n = teamCount || 0;
          if (settings.tournament_format === 'ROUND_ROBIN') {
            matches = (n * (n - 1)) / 2;
          } else if (settings.tournament_format === 'KNOCKOUT') {
            matches = n > 0 ? n - 1 : 0;
          } else {
            matches = n; 
          }
          setTotalMatches(matches);
        }
        
        if (eData && eData.venue_id) {
          const { count: fCount, error: fErr } = await supabase.from('venue_fields').select('*', { count: 'exact', head: true })
            .eq('venue_id', eData.venue_id);
          if (fErr) console.error("Error fetching fields:", fErr);
          if (fCount) setFieldsCount(fCount.toString());
        }

        const { data: existingSlots } = await supabase.from('schedule_slots').select('*').eq('event_id', eventId).order('sequence_number', { ascending: true });
        if (existingSlots && existingSlots.length > 0) {
          setSlots(existingSlots.map(s => ({
            id: s.id,
            sequence: s.sequence_number,
            start: s.scheduled_start,
            end: s.scheduled_end,
            status: s.status,
            isCustom: false
          })));
        }
      } catch (error) {
        console.error("Error loading event data:", error);
      }
    }
    loadEventData();
  }, [eventId]);

  useEffect(() => {
    const fCount = parseInt(fieldsCount) || 1;
    if (totalMatches > 0 && fCount > 0) {
      setNumSlots(Math.ceil(totalMatches / fCount).toString());
    }
  }, [totalMatches, fieldsCount]);


  const handleGenerateBatch = () => {
    if (!batchStart) {
      setError('PLEASE PROVIDE START TIME.');
      return;
    }
    
    const half = parseInt(matchHalf) || 0;
    const breakTime = parseInt(halfTime) || 0;
    const totalMatchMins = (half * 2) + breakTime;
    
    if (totalMatchMins === 0) {
      setError('INVALID MATCH TIMES.');
      return;
    }

    const newSlots = [];
    let currentStartTime = new Date(batchStart);
    
    const targetSlots = parseInt(numSlots) || 1;
    for (let i = 0; i < targetSlots; i++) {
      const startIso = currentStartTime.toISOString();
      const endTime = new Date(currentStartTime.getTime() + totalMatchMins * 60000);
      const endIso = endTime.toISOString();
      
      newSlots.push({
        sequence: slots.length + i + 1,
        start: startIso,
        end: endIso
      });
      
      currentStartTime = new Date(endTime.getTime() + (parseInt(bufferMins) || 0) * 60000);
    }
    
    setSlots([...slots, ...newSlots]);
    setError(null);
  };
  
  const handleRemoveSlot = (indexToRemove: number) => {
    const updated = slots.filter((_, idx) => idx !== indexToRemove).map((slot, idx) => ({
      ...slot,
      sequence: idx + 1
    }));
    setSlots(updated);
  };

  const handleEditSlot = (index: number) => {
    setEditingSlotIndex(index);
    setEditStart(slots[index].start.substring(0, 16));
    setEditEnd(slots[index].end.substring(0, 16));
  };

  const handleCancelEdit = () => {
    setEditingSlotIndex(null);
  };

  const handleAddCustomSlot = () => {
    const now = new Date();
    const startIso = now.toISOString();
    const endIso = new Date(now.getTime() + 120 * 60000).toISOString();
    
    const newSlot = {
      sequence: slots.length + 1,
      start: startIso,
      end: endIso,
      isCustom: true
    };
    
    setSlots([...slots, newSlot]);
  };

  const handleSaveSlot = (index: number) => {
    if (!editStart) {
      setError('PLEASE PROVIDE A VALID START TIME FOR THE SLOT.');
      return;
    }
    
    const half = parseInt(matchHalf) || 0;
    const breakTime = parseInt(halfTime) || 0;
    const totalMatchMins = (half * 2) + breakTime;
    
    const newStart = new Date(editStart).getTime();
    let newEnd = 0;
    
    if (slots[index].isCustom) {
      if (!editEnd) {
        setError('PLEASE PROVIDE A VALID END TIME FOR THE CUSTOM SLOT.');
        return;
      }
      newEnd = new Date(editEnd).getTime();
      if (newEnd <= newStart) {
        setError('END TIME MUST BE AFTER START TIME.');
        return;
      }
    } else {
      newEnd = newStart + (totalMatchMins * 60000);
    }
    
    const hasConflict = slots.some((s, idx) => {
      if (idx === index) return false;
      const sStart = new Date(s.start).getTime();
      const sEnd = new Date(s.end).getTime();
      return (newStart < sEnd && newEnd > sStart);
    });
    
    if (hasConflict) {
      setError('THIS SLOT CONFLICTS WITH AN EXISTING SLOT.');
      return;
    }
    
    const updated = [...slots];
    updated[index] = {
      ...updated[index],
      start: new Date(newStart).toISOString(),
      end: new Date(newEnd).toISOString()
    };
    
    updated.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    const finalSlots = updated.map((slot, idx) => ({
      ...slot,
      sequence: idx + 1
    }));
    
    setSlots(finalSlots);
    setEditingSlotIndex(null);
    setError(null);
  };

  const handleFinalize = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token || '';
      
      let res;
      if (isFinalized) {
        const newSlots = slots.filter((s: any) => !s.id);
        if (newSlots.length === 0) {
           router.push(`/admin/events/${eventId}/scheduling-live`);
           return;
        }
        res = await fetch(`/api/v1/events/${eventId}/slots/append`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ slots: newSlots })
        });
      } else {
        res = await fetch(`/api/v1/events/${eventId}/slots/finalize`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ slots })
        });
      }

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'FAILED TO FINALIZE SLOTS');
      }

      router.push(`/admin/events/${eventId}/scheduling-live`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full bg-background min-h-[calc(100vh-64px)] text-on-surface">
      {/* Top Bar */}
      <div className="border-b border-outline-variant bg-surface sticky top-0 z-10">
        <div className="max-w-container-max mx-auto px-margin-mobile md:px-gutter h-14 flex items-center justify-between">
          <Link href={`/admin/events/${eventId}`} className="flex items-center gap-2 text-on-surface-variant hover:text-on-surface transition-colors">
            <ArrowLeft size={16} />
            <span className="font-label-caps text-label-caps uppercase tracking-widest">EVENT DASHBOARD</span>
          </Link>
        </div>
      </div>

      <div className="max-w-[1000px] mx-auto px-margin-mobile md:px-gutter py-8 space-y-12">
        <div className="relative overflow-hidden border border-outline-variant bg-[#151816]">
          <div className="absolute inset-0 z-0">
            <img alt="" aria-hidden="true" className="w-full h-full object-cover object-center  opacity-25 " src="/turf/pitch-lines.jpg" />
            <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/40 z-10" />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent z-10" />
          </div>
          <div className="relative z-20 p-6 md:p-8">
            <span className="mb-3 block font-label-caps text-label-caps text-primary-container uppercase tracking-widest">
              Pre-Match Setup
            </span>
            <h1 className="font-display-lg text-display-lg md:text-[56px] uppercase tracking-tighter leading-none text-on-surface">
              SLOT CONFIGURATOR
            </h1>
            <p className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant mt-4 max-w-xl">
              DESIGN THE TIMEBLOCKS FOR YOUR TOURNAMENT FIELDS BEFORE LIVE SCHEDULING.
            </p>
          </div>
        </div>

        {error && (
          <div className="border border-error bg-error/10 p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-headline-sm uppercase tracking-tighter text-error">ERROR</h3>
              <p className="font-body-sm text-error mt-1">{error}</p>
            </div>
          </div>
        )}

        <div className="grid gap-12 lg:grid-cols-1">
          <div className="border border-outline-variant bg-surface">
            <div className="p-6 border-b border-outline-variant bg-surface-container flex flex-col md:flex-row md:items-center gap-4 justify-between">
              <div className="flex items-center gap-3">
                <Calculator className="text-on-surface" size={20} />
                <div>
                  <h2 className="font-headline-sm uppercase tracking-tighter text-on-surface">BATCH SLOT GENERATOR</h2>
                  <p className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">CALCULATE SLOTS BASED ON MATCH DURATION, BREAKS, AND BUFFERS.</p>
                </div>
              </div>
            </div>
            
            <div className="p-6 space-y-6">
              <div>
                <label className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant block mb-2">FIRST MATCH START TIME</label>
                <input
                  type="datetime-local"
                  value={batchStart}
                  onChange={(e) => setBatchStart(e.target.value)}
                  className="w-full bg-background border border-outline-variant text-on-surface font-mono p-3 rounded-none focus:outline-none focus:border-primary-container transition-colors"
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant block mb-2">MATCH HALF (MINS)</label>
                  <input
                    type="number"
                    value={matchHalf}
                    onChange={(e) => setMatchHalf(e.target.value)}
                    className="w-full bg-background border border-outline-variant text-on-surface font-mono p-3 rounded-none focus:outline-none focus:border-primary-container transition-colors"
                    min="1"
                  />
                </div>
                <div>
                  <label className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant block mb-2">HALF TIME (MINS)</label>
                  <input
                    type="number"
                    value={halfTime}
                    onChange={(e) => setHalfTime(e.target.value)}
                    className="w-full bg-background border border-outline-variant text-on-surface font-mono p-3 rounded-none focus:outline-none focus:border-primary-container transition-colors"
                    min="0"
                  />
                </div>
                <div>
                  <label className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant block mb-2">BUFFER (MINS)</label>
                  <input
                    type="number"
                    value={bufferMins}
                    onChange={(e) => setBufferMins(e.target.value)}
                    className="w-full bg-background border border-outline-variant text-on-surface font-mono p-3 rounded-none focus:outline-none focus:border-primary-container transition-colors"
                    min="0"
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-outline-variant">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">TOTAL MATCHES</label>
                    <span className="font-label-caps text-[8px] uppercase tracking-widest px-2 py-0.5 bg-surface-variant text-on-surface border border-outline-variant">AUTO-CALCULATED</span>
                  </div>
                  <input
                    type="number"
                    value={totalMatches}
                    onChange={(e) => setTotalMatches(parseInt(e.target.value) || 0)}
                    className="w-full bg-surface-variant border border-outline-variant text-on-surface font-mono p-3 rounded-none focus:outline-none"
                  />
                </div>
                <div>
                  <label className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant block mb-2">FIELDS AVAILABLE</label>
                  <input
                    type="number"
                    value={fieldsCount}
                    onChange={(e) => setFieldsCount(e.target.value)}
                    className="w-full bg-surface-variant border border-outline-variant text-on-surface font-mono p-3 rounded-none focus:outline-none"
                    min="1"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-outline-variant space-y-4">
                <div className="flex justify-between items-center bg-background border border-outline-variant p-4">
                  <div>
                    <label className="font-headline-sm uppercase tracking-tighter text-on-surface">FINAL SLOTS TO GENERATE</label>
                    <p className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">MATCHES ÷ FIELDS</p>
                  </div>
                  <input
                    type="number"
                    value={numSlots}
                    onChange={(e) => setNumSlots(e.target.value)}
                    className="w-24 bg-transparent border-none text-right font-display-lg text-3xl tracking-tighter text-on-surface focus:outline-none"
                    min="1"
                  />
                </div>
                
                <button 
                  onClick={handleGenerateBatch} 
                  disabled={loading || !batchStart} 
                  className="w-full bg-on-surface text-surface hover:bg-on-surface-variant py-4 font-headline-sm uppercase tracking-tighter transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  GENERATE BATCH
                </button>
              </div>
            </div>
          </div>

          <div className="border border-outline-variant bg-surface">
            <div className="p-6 border-b border-outline-variant bg-surface-container flex flex-col md:flex-row md:items-center gap-4 justify-between">
              <div className="flex items-center gap-3">
                <Calendar className="text-on-surface" size={20} />
                <div>
                  <h2 className="font-headline-sm uppercase tracking-tighter text-on-surface">GENERATED SLOTS</h2>
                  <p className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">REVIEW AND FINALIZE THE GENERATED TIMEBLOCKS.</p>
                </div>
              </div>
              <button 
                onClick={handleAddCustomSlot} 
                className="border border-outline-variant bg-background text-on-surface hover:bg-surface-variant px-4 py-2 font-label-caps text-[10px] uppercase tracking-widest transition-colors flex-shrink-0"
              >
                + ADD CUSTOM SLOT
              </button>
            </div>
            
            <div className="p-0">
              {slots.length === 0 ? (
                <div className="p-12 text-center bg-background">
                  <Clock className="w-8 h-8 text-on-surface-variant mx-auto mb-4" />
                  <p className="font-label-caps text-[10px] uppercase tracking-widest text-on-surface-variant">NO SLOTS GENERATED YET.</p>
                </div>
              ) : (
                <div className="divide-y divide-outline-variant">
                  {slots.map((slot, idx) => (
                    <div key={idx} className="p-4 hover:bg-surface-variant/30 transition-colors">
                      {editingSlotIndex === idx ? (
                        <div className="flex flex-col md:flex-row items-center gap-4">
                          <div className="flex items-center justify-center w-12 h-12 border border-outline-variant bg-background font-headline-sm uppercase tracking-tighter text-on-surface">
                            {slot.sequence}
                          </div>
                          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                            <input 
                              type="datetime-local" 
                              value={editStart} 
                              onChange={e => setEditStart(e.target.value)} 
                              className="bg-background border border-outline-variant p-3 font-mono text-sm focus:outline-none focus:border-primary-container"
                            />
                            {slot.isCustom ? (
                              <input 
                                type="datetime-local" 
                                value={editEnd} 
                                onChange={e => setEditEnd(e.target.value)} 
                                className="bg-background border border-outline-variant p-3 font-mono text-sm focus:outline-none focus:border-primary-container"
                              />
                            ) : (
                              <div className="flex items-center bg-surface-variant border border-outline-variant p-3 font-mono text-sm text-on-surface-variant h-full">
                                ENDS AT: {editStart ? new Date(new Date(editStart).getTime() + ((parseInt(matchHalf) || 0) * 2 + (parseInt(halfTime) || 0)) * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => handleSaveSlot(idx)} className="bg-primary-container text-on-primary-container p-3 hover:bg-primary-container/90 transition-colors">
                              <Save size={18} />
                            </button>
                            <button onClick={handleCancelEdit} className="border border-outline-variant bg-background p-3 text-on-surface hover:bg-surface-variant transition-colors">
                              <X size={18} />
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center justify-center w-12 h-12 border border-outline-variant bg-background font-headline-sm uppercase tracking-tighter text-on-surface">
                              {slot.sequence}
                            </div>
                            <div className="font-mono text-base text-on-surface flex items-center gap-2">
                              {new Date(slot.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} 
                              <span className="text-on-surface-variant">→</span> 
                              {new Date(slot.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button onClick={() => handleEditSlot(idx)} className="text-on-surface-variant hover:text-primary-container p-2 transition-colors">
                              <Edit size={16} />
                            </button>
                            <button onClick={() => handleRemoveSlot(idx)} className="text-on-surface-variant hover:text-error p-2 transition-colors">
                              <X size={16} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            {slots.length > 0 && (
              <div className="p-6 border-t border-outline-variant bg-background">
                <button 
                  onClick={handleFinalize} 
                  disabled={loading} 
                  className="w-full bg-primary-container text-on-primary-container hover:bg-primary-container/90 py-4 font-headline-sm uppercase tracking-tighter transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-5 w-5" />
                  )}
                  FINALIZE STRUCTURE & PROCEED TO SCHEDULING
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
