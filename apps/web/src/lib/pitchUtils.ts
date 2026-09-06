export function getInitials(name: string | null | undefined): string {
  if (!name || name.trim() === '') return 'P';
  // Replace underscores and dashes with spaces to handle mock names like test_team_6_688464
  const normalized = name.replace(/_|-/g, ' ');
  const parts = normalized.trim().split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function getGeometricPositions(count: number, isHome: boolean, possession: 'home' | 'away' | 'neutral' = 'neutral'): {x: string, y: string}[] {
  const positions: {x: string, y: string}[] = [];
  if (count === 0) return positions;
  
  // Base shift logic: home pushes up (-10%), away drops back (+10%)
  // When away has possession: away pushes up (+10%), home drops back (-10%)
  let shift = 0;
  if (possession === 'home') shift = -10;
  if (possession === 'away') shift = 10;
  
  // Place GK (shifts slightly with the team)
  positions.push({ x: '50%', y: isHome ? `${90 + (shift*0.2)}%` : `${10 + (shift*0.2)}%` });
  
  if (count === 1) return positions;
  
  const fieldPlayers = count - 1;
  const rows = Math.ceil(Math.sqrt(fieldPlayers));
  const cols = Math.ceil(fieldPlayers / rows);
  
  let currentIdx = 0;
  for (let r = 0; r < rows; r++) {
    // Distribute rows between 80% and 55% for home, 20% and 45% for away
    const rowProgress = rows > 1 ? r / (rows - 1) : 0.5;
    let rowY = isHome 
      ? 80 - (rowProgress * 25) // 80 to 55
      : 20 + (rowProgress * 25); // 20 to 45
      
    // Apply shift
    rowY += shift;
      
    const playersInRow = Math.min(cols, fieldPlayers - currentIdx);
    for (let c = 0; c < playersInRow; c++) {
      const colX = 10 + ((80 / (playersInRow + 1)) * (c + 1));
      positions.push({ x: `${colX}%`, y: `${rowY}%` });
      currentIdx++;
    }
  }
  return positions;
}
