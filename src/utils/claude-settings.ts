import { existsSync } from "node:fs";
import { readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import type { ClaudeSettings } from "../types";

const CLAUDE_SETTINGS_PATH = join(homedir(), ".claude", "settings.json");

/**
 * Load current Claude Code live config
 */
export async function loadClaudeSettings(): Promise<ClaudeSettings | null> {
  if (!existsSync(CLAUDE_SETTINGS_PATH)) {
    return null;
  }

  const content = await readFile(CLAUDE_SETTINGS_PATH, "utf-8");
  return JSON.parse(content);
}

/**
 * Atomic write - inspired by cc-switch
 * Write to temp file then rename to prevent corruption during write
 */
async function atomicWrite(path: string, data: string): Promise<void> {
  const dir = dirname(path);
  const timestamp = Date.now();
  const tmpPath = join(dir, `.settings.json.tmp.${timestamp}`);

  try {
    // Write to temp file
    await writeFile(tmpPath, data, "utf-8");
    // Atomic rename
    await rename(tmpPath, path);
  } catch (error) {
    // Cleanup temp file
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

/**
 * Save Claude Code config (using atomic write)
 */
export async function saveClaudeSettings(settings: ClaudeSettings): Promise<void> {
  const content = JSON.stringify(settings, null, 2);
  await atomicWrite(CLAUDE_SETTINGS_PATH, content);
}

/**
 * Write live config snapshot - inspired by cc-switch's write_live_snapshot
 * Write provider's settingsConfig to ~/.claude/settings.json
 */
export async function writeLiveSnapshot(settingsConfig: ClaudeSettings): Promise<void> {
  await saveClaudeSettings(settingsConfig);
}

/**
 * Read current live config - used for backfill mechanism
 */
export async function readLiveSettings(): Promise<ClaudeSettings | null> {
  return loadClaudeSettings();
}

/**
 * Get Claude config file path
 */
export function getClaudeSettingsPath(): string {
  return CLAUDE_SETTINGS_PATH;
}
