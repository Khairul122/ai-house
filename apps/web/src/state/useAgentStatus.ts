import { useEffect, useReducer } from "react";
import {
  type AgentState,
  type AgentStatus,
  CELEBRATE_MS,
  visibleStatus,
} from "./reduce.ts";
import { useOffice } from "./store.ts";

// Status terlihat satu agen, ikut berganti dari "done" ke "idle" setelah perayaan selesai.
export function useAgentStatus(id: string): {
  agent: AgentState | undefined;
  status: AgentStatus;
} {
  const agent = useOffice((s) => s.agents[id]);
  const [, tick] = useReducer((n: number) => n + 1, 0);
  const status = visibleStatus(agent);

  useEffect(() => {
    if (status !== "done" || !agent) return;
    const t = setTimeout(
      tick,
      CELEBRATE_MS - (Date.now() - agent.changedAt) + 50,
    );
    return () => clearTimeout(t);
  }, [status, agent]);

  return { agent, status };
}
