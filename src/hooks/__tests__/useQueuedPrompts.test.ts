// @vitest-environment jsdom
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// vi.mock is hoisted before static imports
vi.mock("@/lib/api", () => ({
  api: {
    getPromptQueue: vi.fn(),
    cancelQueuedPrompt: vi.fn(),
  },
}));

import type { QueuedPrompt } from "@/lib/api";
import { api } from "@/lib/api";
import { useQueuedPrompts } from "../useQueuedPrompts";

const ITEMS: QueuedPrompt[] = [
  { id: "1", prompt: "hello world", queued_at: "2026-04-20T10:00:00Z" },
  { id: "2", prompt: "do something", queued_at: "2026-04-20T10:00:01Z" },
];

describe("useQueuedPrompts", () => {
  beforeEach(() => {
    vi.mocked(api.getPromptQueue).mockResolvedValue(ITEMS);
    vi.mocked(api.cancelQueuedPrompt).mockResolvedValue({ status: "cancelled" });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("populates items after initial fetch", async () => {
    const { result } = renderHook(() => useQueuedPrompts("agent-1"));
    await waitFor(() => expect(result.current.items).toHaveLength(2));
    expect(result.current.items[0].id).toBe("1");
  });

  it("returns empty array while API is unreachable", async () => {
    vi.mocked(api.getPromptQueue).mockRejectedValue(new Error("network error"));
    const { result } = renderHook(() => useQueuedPrompts("agent-1"));
    await waitFor(() => expect(vi.mocked(api.getPromptQueue)).toHaveBeenCalled());
    expect(result.current.items).toHaveLength(0);
  });

  it("removes item optimistically on cancel", async () => {
    const { result } = renderHook(() => useQueuedPrompts("agent-1"));
    await waitFor(() => expect(result.current.items).toHaveLength(2));

    act(() => {
      result.current.cancel("1");
    });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].id).toBe("2");
  });

  it("does NOT re-sync when cancel returns 'cancelled'", async () => {
    vi.mocked(api.cancelQueuedPrompt).mockResolvedValue({ status: "cancelled" });
    const { result } = renderHook(() => useQueuedPrompts("agent-1"));
    await waitFor(() => expect(result.current.items).toHaveLength(2));

    const callsBefore = vi.mocked(api.getPromptQueue).mock.calls.length;
    await act(async () => {
      await result.current.cancel("1");
    });
    expect(vi.mocked(api.getPromptQueue).mock.calls.length).toBe(callsBefore);
  });

  it("does NOT re-sync when cancel returns 'already_drained' (idempotent success)", async () => {
    vi.mocked(api.cancelQueuedPrompt).mockResolvedValue({ status: "already_drained" });
    const { result } = renderHook(() => useQueuedPrompts("agent-1"));
    await waitFor(() => expect(result.current.items).toHaveLength(2));

    const callsBefore = vi.mocked(api.getPromptQueue).mock.calls.length;
    await act(async () => {
      await result.current.cancel("1");
    });
    expect(vi.mocked(api.getPromptQueue).mock.calls.length).toBe(callsBefore);
  });

  it("re-syncs via refresh after an actual failure (network / 404)", async () => {
    vi.mocked(api.cancelQueuedPrompt).mockRejectedValue(new Error("404 Not Found"));
    const { result } = renderHook(() => useQueuedPrompts("agent-1"));
    await waitFor(() => expect(result.current.items).toHaveLength(2));

    const callsBefore = vi.mocked(api.getPromptQueue).mock.calls.length;
    await act(async () => {
      await result.current.cancel("1");
    });
    await waitFor(() =>
      expect(vi.mocked(api.getPromptQueue).mock.calls.length).toBeGreaterThan(callsBefore),
    );
  });

  it("registers a 3 s polling interval on mount", () => {
    const spy = vi.spyOn(global, "setInterval");
    const { unmount } = renderHook(() => useQueuedPrompts("agent-1"));
    const intervals = spy.mock.calls.filter(([, ms]) => ms === 3000);
    expect(intervals).toHaveLength(1);
    unmount();
    spy.mockRestore();
  });
});
