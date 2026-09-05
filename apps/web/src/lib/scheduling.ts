export function generateLeagueFixtures(teams: any[]): Array<[any, any]> {
  if (teams.length < 2) return [];
  
  const matches: Array<[any, any]> = [];
  const activeTeams = [...teams];
  
  if (activeTeams.length % 2 !== 0) {
    activeTeams.push(null); // Bye
  }
  
  const n = activeTeams.length;
  
  for (let round = 0; round < n - 1; round++) {
    for (let i = 0; i < n / 2; i++) {
      const home = activeTeams[i];
      const away = activeTeams[n - 1 - i];
      if (home !== null && away !== null) {
        matches.push([home, away]);
      }
    }
    // Rotate all except index 0
    activeTeams.splice(1, 0, activeTeams.pop());
  }
  
  return matches;
}

export function calculateSlotDuration(matchConfig: { halves: number, half_duration: number, half_time: number }): number {
  return (matchConfig.halves * matchConfig.half_duration) + (matchConfig.halves > 1 ? matchConfig.half_time : 0);
}

export function generateSlotSequence(startTime: Date, endTime: Date, slotDurationMinutes: number, bufferMinutes: number, numberOfFields: number): Array<{sequence: number, start: Date, end: Date}> {
  const slots: Array<{sequence: number, start: Date, end: Date}> = [];
  let currentStart = new Date(startTime);
  let sequence = 1;
  
  while (true) {
    const currentEnd = new Date(currentStart.getTime() + slotDurationMinutes * 60000);
    if (currentEnd > endTime) {
      break;
    }
    
    slots.push({
      sequence,
      start: new Date(currentStart),
      end: new Date(currentEnd)
    });
    
    currentStart = new Date(currentEnd.getTime() + bufferMinutes * 60000);
    sequence++;
  }
  
  return slots;
}

export function validateAIJSONResponse(jsonString: string): { valid: boolean, errors: string[] } {
  try {
    const data = JSON.parse(jsonString);
    const errors: string[] = [];
    
    if (!data.timezone) errors.push("Missing timezone");
    if (!Array.isArray(data.slots)) errors.push("Slots must be an array");
    else {
      let previousEnd: Date | null = null;
      const seenSequences = new Set<number>();
      
      data.slots.forEach((slot: any, idx: number) => {
        if (!slot.sequence || typeof slot.sequence !== 'number') errors.push(`Slot ${idx}: invalid sequence`);
        if (!slot.start || isNaN(Date.parse(slot.start))) errors.push(`Slot ${idx}: invalid start timestamp`);
        if (!slot.end || isNaN(Date.parse(slot.end))) errors.push(`Slot ${idx}: invalid end timestamp`);
        
        if (seenSequences.has(slot.sequence)) errors.push(`Slot ${idx}: duplicate sequence ${slot.sequence}`);
        seenSequences.add(slot.sequence);
        
        if (slot.start && slot.end) {
          const start = new Date(slot.start);
          const end = new Date(slot.end);
          if (start >= end) errors.push(`Slot ${idx}: start time must be before end time`);
          
          if (previousEnd && start < previousEnd) {
            errors.push(`Slot ${idx}: overlaps with previous slot`);
          }
          previousEnd = end;
        }
      });
    }
    
    return { valid: errors.length === 0, errors };
  } catch (e) {
    return { valid: false, errors: ["Invalid JSON format"] };
  }
}

export function isValidNoBackToBack(candidateTeams: Set<string>, precedingTeams: Set<string>): boolean {
  for (const team of candidateTeams) {
    if (precedingTeams.has(team)) {
      return false;
    }
  }
  return true;
}
