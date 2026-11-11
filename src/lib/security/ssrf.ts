import dns from 'node:dns/promises';
import { URL } from 'node:url';

function isPrivateIpv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(isNaN)) return true;

  // 127.0.0.0/8 (Loopback)
  if (parts[0] === 127) return true;
  // 10.0.0.0/8 (Private network)
  if (parts[0] === 10) return true;
  // 172.16.0.0/12 (Private network)
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  // 192.168.0.0/16 (Private network)
  if (parts[0] === 192 && parts[1] === 168) return true;
  // 169.254.0.0/16 (Link-local & Cloud Metadata 169.254.169.254)
  if (parts[0] === 169 && parts[1] === 254) return true;
  // 0.0.0.0/8 (Current network)
  if (parts[0] === 0) return true;
  // 100.64.0.0/10 (Shared address space)
  if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
  // 198.18.0.0/15 (Benchmarking)
  if (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19)) return true;

  return false;
}

function isPrivateIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  // Loopback
  if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true;
  // Link-local (fe80::/10)
  if (normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb')) return true;
  // Unique local address (fc00::/7)
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  // IPv4 mapped (::ffff:192.168.1.1)
  if (normalized.includes('::ffff:')) {
    const ipv4 = normalized.split('::ffff:')[1];
    return isPrivateIpv4(ipv4);
  }
  return false;
}

export interface ValidationResult {
  valid: boolean;
  sanitizedUrl?: string;
  error?: string;
}

export async function validateUrl(rawUrl: string, options: { skipDns?: boolean } = {}): Promise<ValidationResult> {
  if (!rawUrl || typeof rawUrl !== 'string') {
    return { valid: false, error: 'URL must be a non-empty string' };
  }

  const trimmed = rawUrl.trim();
  let parsed: URL;

  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }

  // 1. Strict Protocol check
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, error: 'Only http and https protocols are allowed' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // 2. Reject obvious dangerous hostnames
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.lan') ||
    hostname === '0.0.0.0'
  ) {
    return { valid: false, error: 'Access to local and internal hostnames is prohibited' };
  }

  // 3. Check if hostname is direct IP literal
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(hostname)) {
    if (isPrivateIpv4(hostname)) {
      return { valid: false, error: 'Access to private and internal IPv4 ranges is prohibited' };
    }
  }

  if (hostname.includes(':')) {
    if (isPrivateIpv6(hostname)) {
      return { valid: false, error: 'Access to private and internal IPv6 ranges is prohibited' };
    }
  }

  if (options.skipDns) {
    return { valid: true, sanitizedUrl: parsed.toString() };
  }

  // 4. Resolve domain name and verify all returned addresses
  try {
    const records = await dns.lookup(hostname, { all: true });
    for (const record of records) {
      if (record.family === 4 && isPrivateIpv4(record.address)) {
        return { valid: false, error: `Domain resolves to restricted internal IP: ${record.address}` };
      }
      if (record.family === 6 && isPrivateIpv6(record.address)) {
        return { valid: false, error: `Domain resolves to restricted internal IP: ${record.address}` };
      }
    }
  } catch (err: any) {
    return { valid: false, error: `Failed to resolve domain: ${err.message}` };
  }

  return { valid: true, sanitizedUrl: parsed.toString() };
}
