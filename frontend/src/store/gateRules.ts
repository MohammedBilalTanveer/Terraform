// Which readiness items are satisfied by ANY ONE of their tasks because the tasks are SUBSTITUTES
// (pits OR raised beds OR containers; stone lines OR half-moons), and which are COMPLEMENTARY
// (mulch AND compost AND organic matter all matter even though the gate counts any one of them).
// Complementary tasks must never be demoted to optional "alternatives" just because a sibling is done.
const COMPLEMENTARY_GATES = new Set<string>(["gate_organic_matter_mulch_ready"]);

export const tasksAreSubstitutes = (gate: { id: string; satisfied_by_tasks?: string[] }) =>
  !COMPLEMENTARY_GATES.has(gate.id) && (gate.satisfied_by_tasks?.length ?? 0) > 1;
