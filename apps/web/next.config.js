const { securityHeaders } = require('./security-headers');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Media ticket query strings must not enter application request logs.
  logging: { incomingRequests: false },
  turbopack: { root: require('path').resolve(__dirname, '../..') },
  images: {
    // Remote artwork already renders unoptimized in our components. Do not
    // expose an unused general-purpose server-side image fetch proxy.
    remotePatterns: [],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders(process.env.NODE_ENV === 'production'),
      },
    ];
  },
};

module.exports = nextConfig;
