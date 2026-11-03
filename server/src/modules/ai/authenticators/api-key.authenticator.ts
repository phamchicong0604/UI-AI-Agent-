import { AiProviderId } from '../../../common/types.js';

export interface ApiKeyTestResult {
  success: boolean;
  message: string;
  latencyMs: number;
  details?: Record<string, any>;
}

export class APIKeyAuthenticator {
  /**
   * Tests connection with the given provider, model, apiKey, and optional baseUrl.
   */
  async testConnection(
    provider: AiProviderId,
    apiKey: string,
    model: string,
    baseUrl?: string
  ): Promise<ApiKeyTestResult> {
    if (!apiKey) {
      return {
        success: false,
        message: 'API Key is missing. Please provide a valid key.',
        latencyMs: 0
      };
    }

    const start = Date.now();

    try {
      if (provider === 'google') {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-1.5-flash'}:generateContent?key=${apiKey}`;
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'Respond with "PONG" only.' }] }]
          })
        });

        const latencyMs = Date.now() - start;
        if (!res.ok) {
          const errText = await res.text();
          let parsedMsg = errText;
          try {
            const parsed = JSON.parse(errText);
            parsedMsg = parsed.error?.message || errText;
          } catch {}
          return {
            success: false,
            message: `Google Gemini API Error (${res.status}): ${parsedMsg}`,
            latencyMs
          };
        }

        return {
          success: true,
          message: `Connected successfully to Google Gemini (${latencyMs}ms)`,
          latencyMs,
          details: { provider: 'Google Gemini', model }
        };
      }

      if (provider === 'anthropic') {
        const url = 'https://api.anthropic.com/v1/messages';
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: model || 'claude-3-5-haiku-20241022',
            max_tokens: 10,
            messages: [{ role: 'user', content: 'Respond with "PONG" only.' }]
          })
        });

        const latencyMs = Date.now() - start;
        if (!res.ok) {
          const errText = await res.text();
          let parsedMsg = errText;
          try {
            const parsed = JSON.parse(errText);
            parsedMsg = parsed.error?.message || errText;
          } catch {}
          return {
            success: false,
            message: `Anthropic Claude API Error (${res.status}): ${parsedMsg}`,
            latencyMs
          };
        }

        return {
          success: true,
          message: `Connected successfully to Anthropic Claude (${latencyMs}ms)`,
          latencyMs,
          details: { provider: 'Anthropic', model }
        };
      }

      if (provider === 'openai' || provider === 'custom') {
        const rootUrl = baseUrl ? baseUrl.replace(/\/+$/, '') : 'https://api.openai.com/v1';
        const url = `${rootUrl}/chat/completions`;

        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: model || 'gpt-4o-mini',
            messages: [{ role: 'user', content: 'Respond with "PONG" only.' }],
            max_tokens: 10
          })
        });

        const latencyMs = Date.now() - start;
        if (!res.ok) {
          const errText = await res.text();
          let parsedMsg = errText;
          try {
            const parsed = JSON.parse(errText);
            parsedMsg = parsed.error?.message || errText;
          } catch {}
          return {
            success: false,
            message: `${provider === 'custom' ? 'Custom Provider' : 'OpenAI'} Error (${res.status}): ${parsedMsg}`,
            latencyMs
          };
        }

        return {
          success: true,
          message: `Connected successfully to ${provider === 'custom' ? 'Custom Endpoint' : 'OpenAI'} (${latencyMs}ms)`,
          latencyMs,
          details: { provider, model, endpoint: rootUrl }
        };
      }

      return {
        success: false,
        message: `Unsupported provider: ${provider}`,
        latencyMs: 0
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Network or Connection Error: ${err.message}`,
        latencyMs: Date.now() - start
      };
    }
  }

  /**
   * Executes completion prompt with API Key.
   */
  async generateCompletion(
    provider: AiProviderId,
    apiKey: string,
    model: string,
    systemPrompt: string,
    userPrompt: string,
    baseUrl?: string,
    options?: { maxTokens?: number; effortLevel?: string }
  ): Promise<string> {
    const maxTokens = options?.maxTokens || 4096;

    if (provider === 'google') {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-1.5-pro'}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: maxTokens,
            responseMimeType: 'application/json'
          }
        })
      });

      if (!res.ok) {
        throw new Error(`Gemini API Error: ${await res.text()}`);
      }

      const data = await res.json() as any;
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }

    if (provider === 'anthropic') {
      const url = 'https://api.anthropic.com/v1/messages';
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: model || 'claude-3-5-sonnet-20241022',
          system: systemPrompt,
          max_tokens: maxTokens,
          messages: [{ role: 'user', content: userPrompt }]
        })
      });

      if (!res.ok) {
        throw new Error(`Claude API Error: ${await res.text()}`);
      }

      const data = await res.json() as any;
      return data.content?.[0]?.text || '';
    }

    // OpenAI or Custom
    const rootUrl = baseUrl ? baseUrl.replace(/\/+$/, '') : 'https://api.openai.com/v1';
    const res = await fetch(`${rootUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model || 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: maxTokens,
        temperature: 0.2
      })
    });

    if (!res.ok) {
      throw new Error(`API Error: ${await res.text()}`);
    }

    const data = await res.json() as any;
    return data.choices?.[0]?.message?.content || '';
  }
}
