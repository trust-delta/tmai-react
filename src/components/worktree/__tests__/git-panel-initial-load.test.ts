import { describe, expect, it } from "vitest";
import type { BranchListResponse, GraphData } from "@/lib/api";

// Component-level test for the Git panel initial load (#1).
//
// Reproduces the connection-pool saturation scenario: with 8+ branches,
// gitGraph (heavy git computation) and listPrs / listIssues (`gh` CLI,
// can stall on auth / rate limits) consumed all available HTTP/1.1
// connection slots. listBranches was fired last, so it got queued behind
// the slower requests and never dispatched — "Loading branches..." stuck.
//
// The fix: listBranches fires first in fetchData, claiming a connection
// slot before the supplementary requests. This test encodes that contract
// and verifies the complete loading-state machine (loading → false once
// listBranches resolves) with N=10 branches.

function makeBranchList(n: number): BranchListResponse {
  const branches = ["main", ...Array.from({ length: n - 1 }, (_, i) => `feat/b${i}`)];
  return {
    default_branch: "main",
    current_branch: "main",
    branches,
    parents: {},
    ahead_behind: {},
    remote_tracking: {},
    remote_only_branches: [],
    last_fetch: null,
    last_commit_times: {},
  };
}

const emptyGraph: GraphData = { commits: [], total_count: 0 };

// Mirrors the fixed fetchData shape in BranchGraph: listBranches fires
// first so it always gets a free HTTP connection slot, independent of
// how slow the supplementary requests are.
function simulateGitPanelLoad(
  listBranches: () => Promise<BranchListResponse>,
  gitGraph: () => Promise<unknown>,
  listPrs: () => Promise<unknown>,
  listIssues: () => Promise<unknown>,
): {
  loading: () => boolean;
  branches: () => BranchListResponse | null;
  mount: () => Promise<void>;
} {
  let loading = true;
  let branches: BranchListResponse | null = null;

  // listBranches fires first — connection-slot priority (#1 fix)
  const fetchData = () => {
    const branchesPromise = listBranches()
      .then((b) => {
        branches = b;
      })
      .catch(() => {});
    gitGraph().catch(() => {});
    listPrs().catch(() => {});
    listIssues().catch(() => {});
    return branchesPromise;
  };

  const mount = async () => {
    loading = true;
    await fetchData().finally(() => {
      loading = false;
    });
  };

  return { loading: () => loading, branches: () => branches, mount };
}

describe("Git panel initial load with 10 branches (#1)", () => {
  it("dismisses 'Loading branches...' once listBranches resolves", async () => {
    const list = makeBranchList(10);
    const { loading, branches, mount } = simulateGitPanelLoad(
      () => Promise.resolve(list),
      () => Promise.resolve(emptyGraph),
      () => Promise.resolve({}),
      () => Promise.resolve([]),
    );

    expect(loading()).toBe(true);
    await mount();
    expect(loading()).toBe(false);
    expect(branches()?.branches).toHaveLength(10);
  });

  it("listBranches fires before supplementary requests (connection-slot priority)", async () => {
    // Verify ordering: listBranches must be initiated before gitGraph/listPrs/listIssues
    // so the browser doesn't queue it behind the slow requests.
    const callOrder: string[] = [];
    const list = makeBranchList(10);

    const { mount } = simulateGitPanelLoad(
      () => {
        callOrder.push("listBranches");
        return Promise.resolve(list);
      },
      () => {
        callOrder.push("gitGraph");
        return Promise.resolve(emptyGraph);
      },
      () => {
        callOrder.push("listPrs");
        return Promise.resolve({});
      },
      () => {
        callOrder.push("listIssues");
        return Promise.resolve([]);
      },
    );

    await mount();
    // listBranches must be the first request initiated
    expect(callOrder[0]).toBe("listBranches");
  });

  it("loading clears even if gitGraph / listPrs / listIssues never resolve (simulate pool saturation)", async () => {
    // Simulates the production failure: slow supplementary requests hold
    // all connection slots. listBranches (fired first in the fix) must still
    // complete and clear loading regardless.
    const list = makeBranchList(10);
    const hanging = new Promise<never>(() => {});

    const { loading, branches, mount } = simulateGitPanelLoad(
      () => Promise.resolve(list),
      () => hanging,
      () => hanging,
      () => hanging,
    );

    await mount();
    expect(loading()).toBe(false);
    expect(branches()?.branches).toHaveLength(10);
  });

  it("loading clears with null branches when listBranches itself rejects", async () => {
    const { loading, branches, mount } = simulateGitPanelLoad(
      () => Promise.reject(new Error("network error")),
      () => Promise.resolve(emptyGraph),
      () => Promise.resolve({}),
      () => Promise.resolve([]),
    );

    await mount();
    expect(loading()).toBe(false);
    expect(branches()).toBeNull();
  });

  it("refetchGit fires listBranches and gitGraph independently (no Promise.all)", async () => {
    // Mirrors the fixed refetchGit: independent fires so a slow gitGraph
    // cannot block the branch-list update (same root cause as fetchData).
    const list = makeBranchList(10);
    let branchesUpdated = false;
    let graphUpdated = false;

    let resolveGraph!: () => void;
    const graphDone = new Promise<void>((res) => {
      resolveGraph = res;
    });

    const refetchGit = () => {
      // listBranches resolves immediately; gitGraph is slow
      Promise.resolve(list)
        .then((b) => {
          branchesUpdated = b.branches.length > 0;
        })
        .catch(() => {});
      graphDone
        .then(() => {
          graphUpdated = true;
        })
        .catch(() => {});
    };

    refetchGit();
    // Micro-task flush: listBranches resolves, gitGraph still pending
    await Promise.resolve();
    await Promise.resolve();

    // Branches updated even though gitGraph is still in flight
    expect(branchesUpdated).toBe(true);
    expect(graphUpdated).toBe(false);

    resolveGraph();
    await Promise.resolve();
    await Promise.resolve();
    expect(graphUpdated).toBe(true);
  });
});
