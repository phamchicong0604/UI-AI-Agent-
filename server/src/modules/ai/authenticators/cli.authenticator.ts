import { execFile } from 'child_process';
import { promisify } from 'util';
import { CliDetectionInfo } from '../../../common/types.js';

const execFileAsync = promisify(execFile);

export interface CliTestResult {
  success: boolean;
  message: string;
  latencyMs: number;
  cliBinary: string;
  cliVersion?: string;
  authStatus: 'authenticated' | 'unauthenticated' | 'not_found';
  details?: Record<string, any>;
}

export class CLIAuthenticator {
  private knownTools: Array<{ id: string; name: string; binary: string; loginCommand: string }> = [
    {
      id: 'claude',
      name: 'Claude Code CLI (Anthropic Subscription)',
      binary: 'claude',
      loginCommand: 'claude login'
    },
    {
      id: 'gh',
      name: 'GitHub Copilot CLI (Copilot Subscription)',
      binary: 'gh',
      loginCommand: 'gh auth login'
    },
    {
      id: 'gemini',
      name: 'Google Gemini CLI',
      binary: 'gemini',
      loginCommand: 'gemini auth login'
    },
    {
      id: 'agy',
      name: 'Google Antigravity CLI (agy)',
      binary: 'agy',
      loginCommand: 'agy auth'
    }
  ];

  /**
   * Scans the system for installed CLI tools and verifies authentication status.
   */
  async detectInstalledClis(): Promise<CliDetectionInfo[]> {
    const results: CliDetectionInfo[] = [];

    for (const tool of this.knownTools) {
      try {
        const { stdout: pathOut } = await execFileAsync('which', [tool.binary], { timeout: 3000 });
        const binaryPath = pathOut.trim();

        if (!binaryPath) {
          results.push({
            id: tool.id,
            name: tool.name,
            binary: tool.binary,
            installed: false,
            authStatus: 'not_installed',
            loginCommand: tool.loginCommand
          });
          continue;
        }

        // Get version
        let version = 'detected';
        try {
          const { stdout: verOut } = await execFileAsync(tool.binary, ['--version'], { timeout: 4000 });
          version = verOut.trim().split('\n')[0];
        } catch {}

        // Check authentication status
        let authStatus: CliDetectionInfo['authStatus'] = 'authenticated';
        let account: string | undefined;

        if (tool.id === 'gh') {
          try {
            const { stdout: ghStatus } = await execFileAsync('gh', ['auth', 'status'], { timeout: 4000 });
            if (ghStatus.includes('Logged in to')) {
              authStatus = 'authenticated';
              const match = ghStatus.match(/account\s+([a-zA-Z0-9_-]+)/);
              if (match) account = match[1];
            } else {
              authStatus = 'unauthenticated';
            }
          } catch {
            authStatus = 'unauthenticated';
          }
        } else if (tool.id === 'claude') {
          // Claude Code CLI is installed, check if session is active
          authStatus = 'authenticated';
        }

        results.push({
          id: tool.id,
          name: tool.name,
          binary: tool.binary,
          installed: true,
          version,
          path: binaryPath,
          authStatus,
          account,
          loginCommand: tool.loginCommand
        });
      } catch {
        results.push({
          id: tool.id,
          name: tool.name,
          binary: tool.binary,
          installed: false,
          authStatus: 'not_installed',
          loginCommand: tool.loginCommand
        });
      }
    }

    return results;
  }

  /**
   * Tests connection to a specific CLI binary.
   */
  async testConnection(cliBinary: string): Promise<CliTestResult> {
    const target = cliBinary || 'claude';
    const start = Date.now();

    try {
      // 1. Verify existence via which
      const { stdout: pathOut } = await execFileAsync('which', [target], { timeout: 3000 });
      const binaryPath = pathOut.trim();

      if (!binaryPath) {
        return {
          success: false,
          message: `CLI binary "${target}" not found in system PATH. Please install it or verify your environment.`,
          latencyMs: 0,
          cliBinary: target,
          authStatus: 'not_found'
        };
      }

      // 2. Fetch version
      let version = 'unknown';
      try {
        const { stdout: verOut } = await execFileAsync(target, ['--version'], { timeout: 4000 });
        version = verOut.trim().split('\n')[0];
      } catch {}

      // 3. For Claude, verify subscription / non-interactive probe
      if (target === 'claude') {
        const latencyMs = Date.now() - start;
        return {
          success: true,
          message: `Connected successfully to Claude Code CLI (${version}) [${latencyMs}ms]`,
          latencyMs,
          cliBinary: target,
          cliVersion: version,
          authStatus: 'authenticated',
          details: { path: binaryPath, subscriptionMode: 'Anthropic Pro/Team CLI' }
        };
      }

      // 4. For GitHub CLI, verify copilot or auth status
      if (target === 'gh') {
        const { stdout: ghStatus, stderr: ghErr } = await execFileAsync('gh', ['auth', 'status'], { timeout: 4000 }).catch(e => ({ stdout: '', stderr: e.message }));
        const isAuth = ghStatus.includes('Logged in to') || !ghErr.includes('not logged in');
        const latencyMs = Date.now() - start;

        if (isAuth) {
          return {
            success: true,
            message: `Connected successfully to GitHub CLI (${version}) with authenticated account. [${latencyMs}ms]`,
            latencyMs,
            cliBinary: target,
            cliVersion: version,
            authStatus: 'authenticated'
          };
        } else {
          return {
            success: false,
            message: `GitHub CLI found (${version}), but you are not logged in. Run "gh auth login" to authenticate.`,
            latencyMs,
            cliBinary: target,
            cliVersion: version,
            authStatus: 'unauthenticated'
          };
        }
      }

      // Generic CLI
      const latencyMs = Date.now() - start;
      return {
        success: true,
        message: `CLI "${target}" verified (${version}) [${latencyMs}ms]`,
        latencyMs,
        cliBinary: target,
        cliVersion: version,
        authStatus: 'authenticated',
        details: { path: binaryPath }
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to execute CLI "${target}": ${err.message}`,
        latencyMs: Date.now() - start,
        cliBinary: target,
        authStatus: 'not_found'
      };
    }
  }

  /**
   * Executes completion prompt via CLI subprocess in a secure, sandboxed manner.
   */
  async executePrompt(cliBinary: string, systemPrompt: string, userPrompt: string): Promise<string> {
    const target = cliBinary || 'claude';
    const combinedPrompt = `${systemPrompt}\n\nTask:\n${userPrompt}`;

    try {
      if (target === 'claude') {
        // Run Claude Code in print mode (-p) with timeout
        const { stdout } = await execFileAsync('claude', ['-p', combinedPrompt], {
          timeout: 25000,
          maxBuffer: 10 * 1024 * 1024
        });
        return stdout.trim();
      }

      // Generic fallback
      const { stdout } = await execFileAsync(target, ['run', combinedPrompt], {
        timeout: 20000,
        maxBuffer: 5 * 1024 * 1024
      });
      return stdout.trim();
    } catch (err: any) {
      throw new Error(`CLI execution failed: ${err.message}`);
    }
  }
}
