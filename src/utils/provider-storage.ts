import { existsSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import type { Provider, ProvidersConfig } from "../types";
import { readLiveSettings, writeLiveSnapshot } from "./claude-settings";

const CONFIG_DIR = join(homedir(), ".cc");
const CONFIG_FILE = join(CONFIG_DIR, "providers.json");

/**
 * Generate a unique ID
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Atomic write - write to temp file then rename to prevent corruption
 */
async function atomicWrite(path: string, data: string): Promise<void> {
  const dir = dirname(path);
  const timestamp = Date.now();
  const tmpPath = join(dir, `.providers.json.tmp.${timestamp}`);

  try {
    await writeFile(tmpPath, data, "utf-8");
    await rename(tmpPath, path);
  } catch (error) {
    try {
      if (existsSync(tmpPath)) {
        const { unlink } = await import("node:fs/promises");
        await unlink(tmpPath);
      }
    } catch {
      // ignore cleanup errors
    }
    throw error;
  }
}

async function ensureConfigDir() {
  if (!existsSync(CONFIG_DIR)) {
    await mkdir(CONFIG_DIR, { recursive: true });
  }
}

export async function loadProviders(): Promise<ProvidersConfig> {
  await ensureConfigDir();

  if (!existsSync(CONFIG_FILE)) {
    return { providers: [] };
  }

  const content = await readFile(CONFIG_FILE, "utf-8");
  return JSON.parse(content);
}

export async function saveProviders(config: ProvidersConfig): Promise<void> {
  await ensureConfigDir();
  const content = JSON.stringify(config, null, 2);
  await atomicWrite(CONFIG_FILE, content);
}

/**
 * Add a new provider
 */
export async function addProvider(provider: Omit<Provider, "id" | "createdAt">): Promise<Provider> {
  const config = await loadProviders();

  const newProvider: Provider = {
    ...provider,
    id: generateId(),
    createdAt: Date.now(),
  };

  config.providers.push(newProvider);
  await saveProviders(config);

  return newProvider;
}

/**
 * Update a provider
 */
export async function updateProvider(id: string, updates: Partial<Omit<Provider, "id" | "name" | "settingsConfig">> & {
  name?: string;
  settingsConfig?: Provider["settingsConfig"];
}): Promise<boolean> {
  const config = await loadProviders();
  const index = config.providers.findIndex((p) => p.id === id);

  if (index === -1) {
    return false;
  }

  const existingProvider = config.providers[index]!;
  config.providers[index] = {
    id: existingProvider.id,
    name: updates.name ?? existingProvider.name,
    settingsConfig: updates.settingsConfig ?? existingProvider.settingsConfig,
    description: updates.description ?? existingProvider.description,
    category: updates.category ?? existingProvider.category,
    createdAt: existingProvider.createdAt,
    icon: updates.icon ?? existingProvider.icon,
    iconColor: updates.iconColor ?? existingProvider.iconColor,
  };

  await saveProviders(config);
  return true;
}

/**
 * Remove a provider
 */
export async function removeProvider(id: string): Promise<boolean> {
  const config = await loadProviders();
  const initialLength = config.providers.length;

  config.providers = config.providers.filter((p) => p.id !== id);

  if (config.providers.length < initialLength) {
    // Clear currentProviderId if the deleted provider was the current one
    if (config.currentProviderId === id) {
      config.currentProviderId = undefined;
    }
    await saveProviders(config);
    return true;
  }

  return false;
}

/**
 * Get provider by id
 */
export async function getProvider(id: string): Promise<Provider | undefined> {
  const config = await loadProviders();
  return config.providers.find((p) => p.id === id);
}

/**
 * Get provider by name
 */
export async function getProviderByName(name: string): Promise<Provider | undefined> {
  const config = await loadProviders();
  return config.providers.find((p) => p.name === name);
}

/**
 * Get current provider
 */
export async function getCurrentProvider(): Promise<Provider | undefined> {
  const config = await loadProviders();
  if (!config.currentProviderId) {
    return undefined;
  }
  return config.providers.find((p) => p.id === config.currentProviderId);
}

/**
 * Backfill mechanism - inspired by cc-switch
 * Save current live config back to current provider to preserve user modifications
 */
async function backfillCurrentProvider(config: ProvidersConfig): Promise<void> {
  if (!config.currentProviderId) {
    return;
  }

  const currentProvider = config.providers.find((p) => p.id === config.currentProviderId);
  if (!currentProvider) {
    return;
  }

  // Read current live config
  const liveSettings = await readLiveSettings();
  if (!liveSettings) {
    return;
  }

  // Update provider's settingsConfig
  currentProvider.settingsConfig = liveSettings;
}

/**
 * Switch provider - inspired by cc-switch's switch_normal implementation
 * 1. Backfill: save current live config to current provider
 * 2. Update currentProviderId
 * 3. Write target provider's settingsConfig to live config
 */
export async function switchProvider(id: string): Promise<Provider> {
  const config = await loadProviders();

  // 1. Verify target provider exists
  const targetProvider = config.providers.find((p) => p.id === id);
  if (!targetProvider) {
    throw new Error(`Provider ${id} not found`);
  }

  // 2. Backfill: save current live config to current provider (if exists and different)
  if (config.currentProviderId && config.currentProviderId !== id) {
    await backfillCurrentProvider(config);
  }

  // 3. Update currentProviderId
  config.currentProviderId = id;
  await saveProviders(config);

  // 4. Write target provider's settingsConfig to live config
  await writeLiveSnapshot(targetProvider.settingsConfig);

  return targetProvider;
}

/**
 * Capture current live config as a new provider
 * Useful for adding subscription accounts
 */
export async function captureCurrentAsProvider(
  name: string,
  description?: string,
  category?: "subscription" | "api"
): Promise<Provider | null> {
  const liveSettings = await readLiveSettings();
  if (!liveSettings) {
    return null;
  }

  return addProvider({
    name,
    description,
    category,
    settingsConfig: liveSettings,
  });
}
