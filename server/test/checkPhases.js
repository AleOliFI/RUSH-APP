// Test script to evaluate phase breakdown across all totalWeeks from 4 to 24
for (let totalWeeks = 4; totalWeeks <= 24; totalWeeks++) {
  const phases = [];
  for (let weekNumber = 1; weekNumber <= totalWeeks; weekNumber++) {
    const phase = weekNumber <= Math.round(totalWeeks * 0.33) ? 'base'
      : weekNumber <= Math.round(totalWeeks * 0.66) ? 'build'
      : weekNumber <= totalWeeks - 2 ? 'peak'
      : 'taper';
    phases.push(phase);
  }
  const uniquePhases = [...new Set(phases)];
  const hasPeak = uniquePhases.includes('peak');
  const hasAll4 = uniquePhases.length === 4;
  console.log(`Duration ${totalWeeks.toString().padStart(2)} weeks: [${phases.join(', ')}] -> Has Peak: ${hasPeak ? 'YES' : 'NO '}, All 4 Phases: ${hasAll4 ? 'YES' : 'NO '}`);
}
