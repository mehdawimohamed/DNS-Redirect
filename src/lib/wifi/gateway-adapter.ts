import { AuthorizeClientInput, AuthorizationResult, WifiGatewayAdapter } from '@/types';

/**
 * Mock Wi-Fi Gateway adapter for development and testing without physical router hardware.
 */
export class MockWifiGatewayAdapter implements WifiGatewayAdapter {
  async authorizeClient(input: AuthorizeClientInput): Promise<AuthorizationResult> {
    console.log(`[MockWifiGateway] Authorizing client: MAC=${input.clientMac}, IP=${input.clientIp}, Gateway=${input.gatewayId}, Token=${input.gatewaySessionToken}`);
    
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 300));

    return {
      success: true,
      redirectUrl: 'https://www.google.com',
      wifiSessionId: `mock-session-${Date.now()}`,
    };
  }

  async revokeClient(gatewayId: string, clientMac: string): Promise<boolean> {
    console.log(`[MockWifiGateway] Revoking client: Gateway=${gatewayId}, MAC=${clientMac}`);
    return true;
  }
}

/**
 * OpenNDS (Forwarding Authentication Service) production gateway adapter.
 */
export class OpenNDSWifiGatewayAdapter implements WifiGatewayAdapter {
  private gatewayApiUrl: string;

  constructor() {
    this.gatewayApiUrl = process.env.WIFI_GATEWAY_API_URL || 'http://192.168.1.1:2050';
  }

  async authorizeClient(input: AuthorizeClientInput): Promise<AuthorizationResult> {
    try {
      // openNDS FAS level 3/4 token confirmation or custom gateway unlock RPC endpoint
      const response = await fetch(`${this.gatewayApiUrl}/opennds_auth/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.WIFI_GATEWAY_API_KEY || ''}`,
        },
        body: JSON.stringify({
          tok: input.gatewaySessionToken,
          custom: input.userId,
          redir: 'https://www.google.com',
        }),
      });

      if (!response.ok) {
        throw new Error(`Gateway returned status ${response.status}`);
      }

      const data = await response.json();
      return {
        success: data.success ?? true,
        redirectUrl: data.redirectUrl || 'https://www.google.com',
        wifiSessionId: data.session_id,
      };
    } catch (err: any) {
      console.error('[OpenNDSWifiGateway] Authorization failed:', err.message);
      // Fallback response allowing testing/graceful recovery
      return {
        success: false,
        error: 'Unable to communicate with Wi-Fi Gateway.',
      };
    }
  }

  async revokeClient(gatewayId: string, clientMac: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.gatewayApiUrl}/opennds_deauth/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.WIFI_GATEWAY_API_KEY || ''}`,
        },
        body: JSON.stringify({ mac: clientMac }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Factory function returning active gateway adapter based on environment
export function getWifiGatewayAdapter(): WifiGatewayAdapter {
  if (process.env.NODE_ENV === 'production' && process.env.WIFI_GATEWAY_API_URL) {
    return new OpenNDSWifiGatewayAdapter();
  }
  return new MockWifiGatewayAdapter();
}
