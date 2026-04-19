import { useCallback, useEffect, useState } from "react";
import type { QueuedPrompt } from "@/lib/api";
import { api } from "@/lib/api";

// Polls the pending send_prompt queue for an agent every 3 s.
// Optimistically removes cancelled items; re-syncs on cancel failure
// (race: agent became idle and flushed the queue simultaneously).
export function useQueuedPrompts(agentId: string) {
  const [items, setItems] = useState<QueuedPrompt[]>([]);

  const refresh = useCallback(async () => {
    try {
      const queue = await api.getPromptQueue(agentId);
      setItems(queue);
    } catch {
      // Endpoint not yet reachable (backend may be starting up); treat as empty.
    }
  }, [agentId]);

  const cancel = useCallback(
    async (promptId: string) => {
      setItems((prev) => prev.filter((item) => item.id !== promptId));
      try {
        await api.cancelQueuedPrompt(agentId, promptId);
      } catch {
        // "Already delivered" is a benign race; re-sync to get accurate state.
        refresh();
      }
    },
    [agentId, refresh],
  );

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { items, cancel, refresh };
}
