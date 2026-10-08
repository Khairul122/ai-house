import type { Provider } from "@nestjs/common";
import { FileDivisionRepository } from "../divisions/infrastructure/file-division.repository.js";
import {
  AGENT_RUNTIME,
  type AgentRuntime,
} from "./domain/agent-runtime.port.js";
import { FakeAgentRuntime } from "./infrastructure/fake-agent.runtime.js";
import { OpenCodeCliRuntime } from "./infrastructure/opencode-cli.runtime.js";
import { OpenCodeSdkRuntime } from "./infrastructure/opencode-sdk.runtime.js";

// AGENT_RUNTIME=sdk (bawaan, ke `opencode serve`) | cli | fake (tanpa model, untuk mencoba alur)
export const runtimeProvider: Provider = {
  provide: AGENT_RUNTIME,
  useFactory: (): AgentRuntime => {
    switch (process.env.AGENT_RUNTIME) {
      case "cli":
        return new OpenCodeCliRuntime();
      case "fake":
        return new FakeAgentRuntime({
          askFor: fakeAskFor(new FileDivisionRepository()),
        });
      default:
        return new OpenCodeSdkRuntime();
    }
  },
};

// Mode tiruan: divisi anggota pertama yang punya aturan bash "ask" meminta izin untuk perintah pertamanya.
function fakeAskFor(repo: FileDivisionRepository): Record<string, string> {
  const d = repo
    .loadAll()
    .find((x) => x.role !== "coordinator" && x.permission.bash.ask.length > 0);
  if (!d) return {};
  return { [d.id]: d.permission.bash.ask[0].replace(/\*/g, "").trim() };
}
