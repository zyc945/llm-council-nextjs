/**
 * Custom development server with IP-based access control
 * Only allows localhost and Tailscale IP (100.64.155.41)
 */

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

// Allowed IP addresses
const ALLOWED_IPS = [
  '127.0.0.1',
  '::1',
  '::ffff:127.0.0.1',
  '100.64.155.41', // Tailscale IP
  '::ffff:100.64.155.41',
];

// Allowed IP ranges (Tailscale CGNAT range)
const ALLOWED_RANGES = [
  { start: '100.64.0.0', end: '100.127.255.255' },
];

function ipToNumber(ip) {
  return ip.split('.').reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function isIpInRange(ip, range) {
  const ipNum = ipToNumber(ip);
  const startNum = ipToNumber(range.start);
  const endNum = ipToNumber(range.end);
  return ipNum >= startNum && ipNum <= endNum;
}

function getClientIp(req) {
  // Check various headers for client IP
  const forwarded = req.headers['x-forwarded-for'];
  const realIp = req.headers['x-real-ip'];
  const socketIp = req.socket?.remoteAddress;

  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  if (realIp) {
    return realIp;
  }
  if (socketIp) {
    // Handle IPv4-mapped IPv6 addresses
    if (socketIp.startsWith('::ffff:')) {
      return socketIp.substring(7);
    }
    return socketIp;
  }
  return null;
}

function isAllowed(ip) {
  if (!ip) return false;

  // Check exact IP matches
  if (ALLOWED_IPS.includes(ip)) {
    return true;
  }

  // Check IP ranges
  for (const range of ALLOWED_RANGES) {
    if (isIpInRange(ip, range)) {
      return true;
    }
  }

  return false;
}

const PORT = parseInt(process.env.PORT || '3000', 10);
const HOSTNAME = process.env.HOSTNAME || '0.0.0.0';

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const clientIp = getClientIp(req);

    // Skip access control for internal paths (favicon, static files, etc.)
    const parsedUrl = parse(req.url, true);
    const skipPaths = [
      '/_next/static',
      '/favicon.ico',
    ];

    const shouldSkipAccessControl = skipPaths.some(path =>
      parsedUrl.pathname?.startsWith(path)
    );

    if (!shouldSkipAccessControl && !isAllowed(clientIp)) {
      console.log(`[ACCESS DENIED] ${clientIp} tried to access ${req.url}`);
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({
        error: 'Forbidden',
        message: 'Access denied. Your IP address is not authorized.',
        your_ip: clientIp,
        allowed_ips: ['localhost', '100.64.155.41 (Tailscale)'],
      }));
      return;
    }

    if (clientIp) {
      console.log(`[ACCESS ALLOWED] ${clientIp} -> ${req.url}`);
    }

    handle(req, res);
  });

  server.listen(PORT, HOSTNAME, (err) => {
    if (err) throw err;
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║           LLM Council Development Server                   ║
╠═══════════════════════════════════════════════════════════╣
║  Ready on http://${HOSTNAME === '0.0.0.0' ? 'localhost' : HOSTNAME}:${String(PORT).padEnd(5)}                    ║
║                                                           ║
║  Access Control: ENABLED                                  ║
║  - Allowed: localhost (127.0.0.1)                         ║
║  - Allowed: 100.64.155.41 (Tailscale)                     ║
║  - Allowed: 100.64.0.0 - 100.127.255.255 (Tailscale CGNAT)║
║                                                           ║
║  Press Ctrl-C to stop                                     ║
╚═══════════════════════════════════════════════════════════╝
    `);
  });
});
