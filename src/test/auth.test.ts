import { describe, it, expect, beforeEach, vi } from 'vitest';
import { authApi, getAuthToken, setAuthToken, documentsApi } from '../common/services/api';

describe('Frontend Auth API & Security Lifecycle (R4-13, BUG-034)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    setAuthToken(null);
    vi.restoreAllMocks();
  });

  it('stores and retrieves authentication token via localStorage', () => {
    expect(getAuthToken()).toBe('');

    setAuthToken('mock-jwt-token-12345');
    expect(getAuthToken()).toBe('mock-jwt-token-12345');
    expect(localStorage.getItem('docqa_auth_token')).toBe('mock-jwt-token-12345');
  });

  it('logout() completely purges token and all cached docqa_* entries from localStorage (R4-13)', () => {
    // Populate localStorage with user session & cached state
    setAuthToken('test-token');
    localStorage.setItem('docqa_user', JSON.stringify({ id: 'usr-1', name: 'Admin' }));
    localStorage.setItem('docqa_cached_docs', '[]');
    localStorage.setItem('docqa_active_role', 'Project Admin');
    localStorage.setItem('other_app_key', 'keep-me');

    authApi.logout();

    expect(getAuthToken()).toBe('');
    expect(localStorage.getItem('docqa_auth_token')).toBeNull();
    expect(localStorage.getItem('docqa_user')).toBeNull();
    expect(localStorage.getItem('docqa_cached_docs')).toBeNull();
    expect(localStorage.getItem('docqa_active_role')).toBeNull();
    // Non-docqa keys should not be touched
    expect(localStorage.getItem('other_app_key')).toBe('keep-me');
  });

  it('dispatches docqa:unauthorized event on 401 responses to force re-authentication (R4-13)', async () => {
    let unauthorizedEventFired = false;
    const listener = () => {
      unauthorizedEventFired = true;
    };
    window.addEventListener('docqa:unauthorized', listener);

    // Mock global fetch returning 401
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 401,
      ok: false,
      json: async () => ({ success: false, error: 'Unauthorized: Session expired' })
    } as any);

    try {
      await expect(documentsApi.getAll()).rejects.toThrow();
      expect(unauthorizedEventFired).toBe(true);
    } finally {
      window.removeEventListener('docqa:unauthorized', listener);
      globalThis.fetch = originalFetch;
    }
  });

  it('changePassword() validates parameters and sends POST /auth/change-password', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ success: true, data: { success: true }, message: 'Đổi mật khẩu thành công' })
    } as any);

    try {
      setAuthToken('auth-token-xyz');
      const res = await authApi.changePassword('oldPass123', 'newPass4567');
      expect(res).toBe(true);
      expect(globalThis.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/auth/change-password'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer auth-token-xyz'
          }),
          body: JSON.stringify({
            currentPassword: 'oldPass123',
            newPassword: 'newPass4567'
          })
        })
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
