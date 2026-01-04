import { confirm, error, input, output, select, tool } from "kly";
import { z } from "zod";
import type { ClaudeSettings } from "../types";
import { readLiveSettings } from "../utils/claude-settings";
import {
  addProvider,
  captureCurrentAsProvider,
  loadProviders,
  removeProvider,
  switchProvider,
} from "../utils/provider-storage";

const ADD_OPTION = "__add__";
const REMOVE_OPTION = "__remove__";

async function executeAdd() {
  const mode = await select({
    prompt: "How do you want to add a provider?",
    options: [
      {
        value: "capture",
        name: "Capture current config",
        description:
          "Save current ~/.claude/settings.json as a provider (recommended for subscription)",
      },
      {
        value: "manual",
        name: "Enter manually",
        description: "Enter API key and endpoint manually",
      },
    ],
  });

  const name = await input({
    prompt: "Provider name",
    placeholder: "e.g., subscription, personal-api, work",
  });

  if (!name) {
    error("Provider name is required");
    return;
  }

  const description = await input({
    prompt: "Description (optional)",
    placeholder: "e.g., My subscription account",
  });

  if (mode === "capture") {
    const liveSettings = await readLiveSettings();
    if (!liveSettings) {
      error("Could not read current Claude config from ~/.claude/settings.json");
      return;
    }

    const hasApiKey = liveSettings.env?.ANTHROPIC_AUTH_TOKEN?.startsWith("sk-ant-");
    const category = hasApiKey ? "api" : "subscription";

    try {
      const provider = await captureCurrentAsProvider(name, description || undefined, category);
      if (!provider) {
        error("Failed to capture current config");
        return;
      }

      output(`Provider '${name}' added (captured from current config)`);
      output(`  Type: ${category}`);
      if (liveSettings.env?.ANTHROPIC_BASE_URL) {
        output(`  Endpoint: ${liveSettings.env.ANTHROPIC_BASE_URL}`);
      }
    } catch (err) {
      error(`Failed to add provider: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else {
    const apiKey = await input({
      prompt: "API key (leave empty for subscription mode)",
      placeholder: "sk-ant-xxx",
      defaultValue: "",
    });

    const baseUrl = await input({
      prompt: "Custom API endpoint (optional)",
      placeholder: "e.g., https://api.example.com/v1",
      defaultValue: "",
    });

    let baseSettings = await readLiveSettings();
    if (!baseSettings) {
      baseSettings = {
        $schema: "https://json.schemastore.org/claude-code-settings.json",
        env: {},
      };
    }

    const settingsConfig: ClaudeSettings = {
      ...baseSettings,
      env: { ...baseSettings.env },
    };

    if (apiKey) {
      settingsConfig.env!.ANTHROPIC_AUTH_TOKEN = apiKey;
    } else {
      delete settingsConfig.env!.ANTHROPIC_AUTH_TOKEN;
    }

    if (baseUrl) {
      settingsConfig.env!.ANTHROPIC_BASE_URL = baseUrl;
    } else {
      delete settingsConfig.env!.ANTHROPIC_BASE_URL;
    }

    const category = apiKey ? "api" : "subscription";

    try {
      await addProvider({
        name,
        description: description || undefined,
        category,
        settingsConfig,
      });

      const modeLabel = apiKey ? "API key" : "subscription";
      const endpoint = baseUrl ? ` with custom endpoint` : "";
      output(`Provider '${name}' added (${modeLabel}${endpoint})`);
    } catch (err) {
      error(`Failed to add provider: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}

async function executeRemove() {
  const config = await loadProviders();

  if (config.providers.length === 0) {
    output("No providers configured");
    return;
  }

  const options = config.providers.map((p) => {
    const isCurrent = p.id === config.currentProviderId;
    const category = p.category === "subscription" ? "[subscription]" : "[api]";
    const currentMark = isCurrent ? " (current)" : "";

    return {
      name: p.name,
      description: `${category}${currentMark}`,
      value: p.id,
    };
  });

  const providerId = await select({
    prompt: "Select provider to remove",
    options,
  });

  const found = config.providers.find((p) => p.id === providerId);
  const providerName = found?.name || providerId;

  const confirmed = await confirm(`Remove provider '${providerName}'?`, false);

  if (!confirmed) {
    output("Cancelled");
    return;
  }

  const success = await removeProvider(providerId);

  if (success) {
    output(`Provider '${providerName}' removed`);
  } else {
    error(`Provider '${providerName}' not found`);
  }
}

export const startTool = tool({
  name: "start",
  description: "Switch provider and launch Claude Code",
  inputSchema: z.object({
    provider: z.string().optional().describe("Provider name or ID to switch to"),
  }),
  execute: async (args) => {
    const config = await loadProviders();

    // No providers configured, go to add flow
    if (config.providers.length === 0) {
      output("No providers configured. Let's add one.\n");
      await executeAdd();
      return;
    }

    let selectedProviderId = args.provider;

    // If provider specified, could be name or id
    if (selectedProviderId) {
      let found = config.providers.find((p) => p.id === selectedProviderId);
      if (!found) {
        found = config.providers.find((p) => p.name === selectedProviderId);
      }
      if (found) {
        selectedProviderId = found.id;
      } else {
        error(`Provider '${args.provider}' not found`);
        return;
      }
    }

    // If not specified, show selection menu
    if (!selectedProviderId) {
      const sortedProviders = [...config.providers].sort((a, b) => {
        if (a.id === config.currentProviderId) return -1;
        if (b.id === config.currentProviderId) return 1;
        return (b.createdAt || 0) - (a.createdAt || 0);
      });

      const providerOptions = sortedProviders.map((p) => {
        const isCurrent = p.id === config.currentProviderId;
        const category = p.category === "subscription" ? "[subscription]" : "[api]";
        const endpoint = p.settingsConfig.env?.ANTHROPIC_BASE_URL
          ? ` @ ${new URL(p.settingsConfig.env.ANTHROPIC_BASE_URL).host}`
          : "";
        const currentMark = isCurrent ? " (current)" : "";
        const desc = p.description || "";

        return {
          name: p.name,
          description: `${desc} ${category}${endpoint}${currentMark}`.trim(),
          value: p.id,
        };
      });

      // Add add/remove options
      const options = [
        ...providerOptions,
        { name: "➕ Add provider", description: "Add a new provider", value: ADD_OPTION },
        {
          name: "➖ Remove provider",
          description: "Remove an existing provider",
          value: REMOVE_OPTION,
        },
      ];

      selectedProviderId = await select({
        prompt: "Select a provider",
        options,
      });
    }

    // Handle add/remove options
    if (selectedProviderId === ADD_OPTION) {
      await executeAdd();
      return;
    }

    if (selectedProviderId === REMOVE_OPTION) {
      await executeRemove();
      return;
    }

    // Find selected provider
    const provider = config.providers.find((p) => p.id === selectedProviderId);

    if (!provider) {
      error(`Provider not found`);
      return;
    }

    // Switch provider
    try {
      await switchProvider(provider.id);

      const category = provider.category === "subscription" ? "subscription" : "API key";
      const endpoint = provider.settingsConfig.env?.ANTHROPIC_BASE_URL
        ? ` (${provider.settingsConfig.env.ANTHROPIC_BASE_URL})`
        : "";
      output(`Switched to provider: ${provider.name} [${category}${endpoint}]`);
    } catch (err) {
      error(`Failed to switch provider: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    // Launch Claude Code
    output("\nLaunching Claude Code...\n");

    try {
      const proc = Bun.spawn(["sh", "-c", "exec claude"], {
        stdin: "inherit",
        stdout: "inherit",
        stderr: "inherit",
      });

      await proc.exited;
      process.exit(proc.exitCode || 0);
    } catch (err) {
      error(`Failed to launch Claude Code: ${err instanceof Error ? err.message : String(err)}`);
      output("You can manually run: claude");
      process.exit(1);
    }
  },
});
