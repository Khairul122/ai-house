import type { Provider } from "@nestjs/common";
import {
  AGENT_RUNTIME,
  type AgentRuntime,
} from "./domain/agent-runtime.port.js";
import { OpenCodeCliRuntime } from "./infrastructure/opencode-cli.runtime.js";
import { OpenCodeSdkRuntime } from "./infrastructure/opencode-sdk.runtime.js";

// AGENT_RUNTIME=sdk (bawaan, ke `opencode serve`) | cli (`opencode run`)
export const runtimeProvider: Provider = {
  provide: AGENT_RUNTIME,
  useFactory: (): AgentRuntime =>
    process.env.AGENT_RUNTIME === "cli"
      ? new OpenCodeCliRuntime()
      : new OpenCodeSdkRuntime(),
};
