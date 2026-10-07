import type { Provider } from "@nestjs/common";
import { AGENT_RUNTIME, type AgentRuntime } from "./domain/agent-runtime.port.js";
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
        return new FakeAgentRuntime({ askFor: { "software-development": "npm install express" } });
      default:
        return new OpenCodeSdkRuntime();
    }
  }
};
