'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Loader2, Calendar, Clock, CheckCircle2, AlertCircle, X, Calculator, Edit, Save } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
      setError('Please provide start time.');
      return;
    }
    
    const half = parseInt(matchHalf) || 0;
    const breakTime = parseInt(halfTime) || 0;
    const totalMatchMins = (half * 2) + breakTime;
    
    if (totalMatchMins === 0) {
      setError('Invalid match times.');
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
      setError('Please provide a valid start time for the slot.');
      return;
    }
    
    const half = parseInt(matchHalf) || 0;
    const breakTime = parseInt(halfTime) || 0;
    const totalMatchMins = (half * 2) + breakTime;
    
    const newStart = new Date(editStart).getTime();
    let newEnd = 0;
    
    if (slots[index].isCustom) {
      if (!editEnd) {
        setError('Please provide a valid end time for the custom slot.');
        return;
      }
      newEnd = new Date(editEnd).getTime();
      if (newEnd <= newStart) {
        setError('End time must be after start time.');
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
      setError('This slot conflicts with an existing slot.');
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
        throw new Error(data.detail || 'Failed to finalize slots');
      }

      router.push(`/admin/events/${eventId}/scheduling-live`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container max-w-6xl py-10 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent drop-shadow-sm">Slot Configurator</h1>
          <p className="text-muted-foreground mt-2 text-lg font-medium">Design the timeblocks for your tournament fields before live scheduling.</p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="border-red-500/50 bg-red-50 dark:bg-red-950/200/10 text-red-600 shadow-sm">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle className="font-bold text-base">Error</AlertTitle>
          <AlertDescription className="text-sm font-medium">{error}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-8 lg:grid-cols-1 max-w-4xl mx-auto">
        <Card className="border-slate-200 dark:border-zinc-800/60 shadow-lg shadow-indigo-100/50 backdrop-blur-xl bg-white dark:bg-zinc-900/70 overflow-hidden transition-all duration-300 hover:shadow-indigo-200/50">
          <div className="h-2 w-full bg-gradient-to-r from-orange-400 to-red-500" />
          <CardHeader className="pb-4">
            <CardTitle className="text-2xl flex items-center gap-2">
              <Calculator className="h-6 w-6 text-red-500" />
              Batch Slot Generator
            </CardTitle>
            <CardDescription className="text-base">
              Calculate slots based on match duration, breaks, and buffers.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 dark:text-zinc-300">First Match Start Time</label>
              <Input
                type="datetime-local"
                value={batchStart}
                onChange={(e) => setBatchStart(e.target.value)}
                className="w-full"
              />
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-zinc-300">Match Half (mins)</label>
                <Input
                  type="number"
                  value={matchHalf}
                  onChange={(e) => setMatchHalf(e.target.value)}
                  className="w-full"
                  min="1"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-zinc-300">Half Time (mins)</label>
                <Input
                  type="number"
                  value={halfTime}
                  onChange={(e) => setHalfTime(e.target.value)}
                  className="w-full"
                  min="0"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-zinc-300">Buffer (mins)</label>
                <Input
                  type="number"
                  value={bufferMins}
                  onChange={(e) => setBufferMins(e.target.value)}
                  className="w-full"
                  min="0"
                />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <label className="text-sm font-semibold text-slate-700 dark:text-zinc-300">Total Matches</label>
                  <span className="text-xs text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded">Auto-calculated</span>
                </div>
                <Input
                  type="number"
                  value={totalMatches}
                  onChange={(e) => setTotalMatches(parseInt(e.target.value) || 0)}
                  className="w-full bg-slate-50 dark:bg-zinc-900/50"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 dark:text-zinc-300">Fields Available</label>
                <Input
                  type="number"
                  value={fieldsCount}
                  onChange={(e) => setFieldsCount(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-zinc-900/50"
                  min="1"
                />
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100">
              <div className="flex justify-between items-center">
                <label className="text-sm font-bold text-slate-900 dark:text-zinc-100">Final Slots to Generate</label>
                <span className="text-xs text-slate-500 dark:text-zinc-400">Matches ÷ Fields</span>
              </div>
              <Input
                type="number"
                value={numSlots}
                onChange={(e) => setNumSlots(e.target.value)}
                className="w-full font-bold text-lg border-slate-300 dark:border-zinc-700"
                min="1"
              />
            </div>

            <Button 
              onClick={handleGenerateBatch} 
              disabled={loading || !batchStart} 
              className="w-full bg-slate-800 hover:bg-slate-900 text-white shadow-md hover:shadow-lg transition-all h-12 text-base font-semibold rounded-xl mt-2"
            >
              Generate Batch
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-1 mt-8">

        <Card className="border-slate-200 dark:border-zinc-800/60 shadow-lg shadow-indigo-100/50 backdrop-blur-xl bg-white dark:bg-zinc-900/70 flex flex-col h-full overflow-hidden transition-all duration-300 hover:shadow-indigo-200/50 max-w-4xl mx-auto w-full">
          <div className="h-2 w-full bg-gradient-to-r from-teal-400 to-emerald-500" />
          <CardHeader className="pb-4 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <Calendar className="h-6 w-6 text-emerald-500" />
                Generated Slots
              </CardTitle>
              <CardDescription className="text-base mt-1">
                Review and finalize the generated timeblocks. Once finalized, you can proceed to the live scheduling command center.
              </CardDescription>
            </div>
            <Button onClick={handleAddCustomSlot} variant="outline" className="border-indigo-200 hover:bg-indigo-50 text-indigo-700">
              + Add Custom Slot
            </Button>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-0">
            {slots.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[250px] text-slate-400 space-y-3 p-6 bg-slate-50 dark:bg-zinc-900/50/30 m-6 rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800">
                <Clock className="h-12 w-12 text-slate-300 mb-2" />
                <p className="text-lg font-medium text-slate-500 dark:text-zinc-400">No slots generated yet.</p>
                <p className="text-sm text-center">Use the AI generator to create a slot sequence based on your event settings.</p>
              </div>
            ) : (
              <div className="space-y-3 p-6 pt-2">
                {slots.map((slot, idx) => (
                  <div key={idx} className="flex flex-col p-4 rounded-xl border border-slate-200 dark:border-zinc-800/60 bg-white dark:bg-zinc-900 shadow-sm hover:shadow-md transition-shadow group">
                    {editingSlotIndex === idx ? (
                      <div className="flex flex-col gap-3 w-full">
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-bold">
                            {slot.sequence}
                          </div>
                          <div className="flex-1 grid grid-cols-2 gap-4 items-center">
                            <Input type="datetime-local" value={editStart} onChange={e => setEditStart(e.target.value)} />
                            {slot.isCustom ? (
                              <Input type="datetime-local" value={editEnd} onChange={e => setEditEnd(e.target.value)} />
                            ) : (
                              <div className="text-sm font-medium text-slate-600 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-md px-3 py-2 flex items-center h-10 shadow-inner">
                                Ends at: {editStart ? new Date(new Date(editStart).getTime() + ((parseInt(matchHalf) || 0) * 2 + (parseInt(halfTime) || 0)) * 60000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                              </div>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Button variant="default" size="icon" onClick={() => handleSaveSlot(idx)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                              <Save className="h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="icon" onClick={handleCancelEdit}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 font-bold">
                            {slot.sequence}
                          </div>
                          <div className="space-y-1">
                            <p className="font-semibold text-slate-800 dark:text-zinc-200 flex items-center gap-2">
                              <Clock className="h-4 w-4 text-slate-400" />
                              {new Date(slot.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(slot.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEditSlot(idx)} className="text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:bg-blue-950/20">
                            <Edit className="h-5 w-5" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleRemoveSlot(idx)} className="text-slate-400 hover:text-red-500 hover:bg-red-50 dark:bg-red-950/20">
                            <X className="h-5 w-5" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          {slots.length > 0 && (
            <CardFooter className="pt-4 border-t bg-slate-50 dark:bg-zinc-900/50/50 p-6">
              <Button 
                onClick={handleFinalize} 
                disabled={loading} 
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:shadow-lg transition-all h-12 text-base font-semibold rounded-xl"
              >
                {loading ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-2 h-5 w-5" />
                )}
                Finalize Structure & Proceed
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  );
}
