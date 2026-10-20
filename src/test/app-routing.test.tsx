import { QueryClient } from "@tanstack/react-query";
import { createMemoryHistory, createRouter } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

async function loadAt(path: string) {
  const router = createRouter({
    routeTree,
    context: { queryClient: new QueryClient() },
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  await router.load();
  return router.state.matches;
}

function failedMatches(matches: Awaited<ReturnType<typeof loadAt>>) {
  return matches.filter((m) => m.status !== "success").map((m) => [m.routeId, String(m.error)]);
}

describe("App routing", () => {
  it("loads the registration index route without a loader error", async () => {
    const matches = await loadAt("/");
    expect(failedMatches(matches)).toEqual([]);
  });

  it("loads the training route without a loader error", async () => {
    const matches = await loadAt("/training");
    expect(failedMatches(matches)).toEqual([]);
  });

  it("loads the next-step route without a loader error", async () => {
    const matches = await loadAt("/next-step");
    expect(failedMatches(matches)).toEqual([]);
  });

  it("loads the classfeesecrettunnel route without a loader error", async () => {
    const matches = await loadAt("/classfeesecrettunnel");
    expect(failedMatches(matches)).toEqual([]);
  });

  it("loads an unknown path without a loader error", async () => {
    const matches = await loadAt("/this-route-does-not-exist");
    expect(failedMatches(matches)).toEqual([]);
  });
});
