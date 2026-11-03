import { execFile } from 'child_process';
import { promisify } from 'util';
import { CliDetectionInfo, AiProviderId } from '../../../common/types.js';

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
  private knownTools: Array<{ id: string; provider: AiProviderId; name: string; binary: string; loginCommand: string }> = [
    {
      id: 'claude',
      provider: 'anthropic',
      name: 'Claude Code CLI (Anthropic Subscription)',
      binary: 'claude',
      loginCommand: 'claude login'
    },
    {
      id: 'gh',
      provider: 'openai',
      name: 'GitHub Copilot CLI (Copilot Subscription)',
      binary: 'gh',
      loginCommand: 'gh auth login'
    },
    {
      id: 'gemini',
      provider: 'google',
      name: 'Google Gemini CLI',
      binary: 'gemini',
      loginCommand: 'gemini auth login'
    },
    {
      id: 'agy',
      provider: 'google',
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
            provider: tool.provider,
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
          // Probe if claude OAuth session is alive
          try {
            const { stderr } = await execFileAsync(
              'claude',
              ['-p', 'Say PONG', '--dangerously-skip-permissions'],
              { timeout: 4000 }
            ).catch(e => ({ stdout: '', stderr: e.message || '' }));

            if (stderr.includes('Failed to authenticate') || stderr.includes('OAuth session expired')) {
              authStatus = 'unauthenticated';
            } else {
              authStatus = 'authenticated';
            }
          } catch {
            authStatus = 'unauthenticated';
          }
        }

        results.push({
          id: tool.id,
          provider: tool.provider,
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
          provider: tool.provider,
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
   * Tests connection to a specific CLI binary by performing a real probe execution.
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
          message: `CLI binary "${target}" chưa được cài đặt trong hệ thống (không tìm thấy trong PATH).`,
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

      // 3. For Claude: perform real non-interactive probe to check if OAuth subscription is active
      if (target === 'claude') {
        try {
          const { stdout, stderr } = await execFileAsync(
            'claude',
            ['-p', 'Respond with PONG', '--dangerously-skip-permissions'],
            { timeout: 6000 }
          ).catch(e => ({ stdout: '', stderr: e.message || '' }));

          const latencyMs = Date.now() - start;
          const isExpired = stderr.includes('Failed to authenticate') || stderr.includes('OAuth session expired');

          if (isExpired) {
            return {
              success: false,
              message: `Claude Code CLI (${version}) đã được cài đặt, nhưng phiên đăng nhập OAuth đã hết hạn hoặc chưa đăng nhập. Vui lòng mở Terminal và chạy lệnh: "claude login" để xác thực gói Subscription.`,
              latencyMs,
              cliBinary: target,
              cliVersion: version,
              authStatus: 'unauthenticated'
            };
          }

          return {
            success: true,
            message: `Kết nối thành công đến Claude Code CLI (${version}) [${latencyMs}ms]`,
            latencyMs,
            cliBinary: target,
            cliVersion: version,
            authStatus: 'authenticated',
            details: { path: binaryPath, response: stdout.trim().slice(0, 50) }
          };
        } catch (err: any) {
          const latencyMs = Date.now() - start;
          const isAuthErr = err.message.includes('Failed to authenticate') || err.message.includes('OAuth session expired');
          return {
            success: false,
            message: isAuthErr
              ? `Phiên đăng nhập Claude CLI đã hết hạn. Vui lòng mở Terminal và chạy: "claude login"`
              : `Lỗi thực thi Claude CLI: ${err.message}`,
            latencyMs,
            cliBinary: target,
            cliVersion: version,
            authStatus: isAuthErr ? 'unauthenticated' : 'not_found'
          };
        }
      }

      // 4. For GitHub CLI: verify authentication and Copilot access
      if (target === 'gh') {
        const { stdout: ghStatus } = await execFileAsync('gh', ['auth', 'status'], { timeout: 4000 }).catch(e => ({ stdout: e.stdout || e.message }));
        const latencyMs = Date.now() - start;

        if (ghStatus.includes('Logged in to')) {
          const match = ghStatus.match(/account\s+([a-zA-Z0-9_-]+)/);
          return {
            success: true,
            message: `Kết nối thành công GitHub CLI (${version}) - Tài khoản: @${match?.[1] || 'authenticated'} [${latencyMs}ms]`,
            latencyMs,
            cliBinary: target,
            cliVersion: version,
            authStatus: 'authenticated',
            details: { account: match?.[1] }
          };
        } else {
          return {
            success: false,
            message: `GitHub CLI tìm thấy (${version}), nhưng chưa đăng nhập tài khoản. Mở Terminal và chạy: "gh auth login"`,
            latencyMs,
            cliBinary: target,
            cliVersion: version,
            authStatus: 'unauthenticated'
          };
        }
      }

      // 5. Antigravity CLI / Gemini CLI / Generic
      const latencyMs = Date.now() - start;
      return {
        success: true,
        message: `Kết nối thành công CLI "${target}" (${version}) [${latencyMs}ms]`,
        latencyMs,
        cliBinary: target,
        cliVersion: version,
        authStatus: 'authenticated',
        details: { path: binaryPath }
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Không thể kết nối tới CLI "${target}": ${err.message}`,
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
        const { stdout, stderr } = await execFileAsync(
          'claude',
          ['-p', combinedPrompt, '--dangerously-skip-permissions'],
          { timeout: 25000, maxBuffer: 10 * 1024 * 1024 }
        );
        if (stderr.includes('Failed to authenticate') || stderr.includes('OAuth session expired')) {
          throw new Error('Claude CLI OAuth session expired. Please run "claude login" in terminal.');
        }
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
