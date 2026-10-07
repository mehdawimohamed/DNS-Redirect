import { z } from 'zod';

export const wifiAuthorizeSchema = z.object({
  gatewayId: z.string().min(1, { message: 'Gateway identifier is required.' }),
  gatewaySessionToken: z.string().min(1, { message: 'Gateway session token is required.' }),
  clientMac: z.string().optional().default('00:00:00:00:00:00'),
  clientIp: z.string().optional().default('127.0.0.1'),
  durationMinutes: z.number().int().positive().optional().default(240), // 4 hours
});

export type WifiAuthorizeInput = z.infer<typeof wifiAuthorizeSchema>;
