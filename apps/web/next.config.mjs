/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  skipTrailingSlashRedirect: true,
  async rewrites() {
    const api = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
    return [
      { source: '/api/:path*', destination: `${api}/api/:path*` },
      { source: '/socket.io', destination: `${api}/socket.io/` },
      { source: '/socket.io/', destination: `${api}/socket.io/` },
      { source: '/socket.io/:path*', destination: `${api}/socket.io/:path*` },
      { source: '/uploads/:path*', destination: `${api}/uploads/:path*` },
    ];
  },
  images: {
    remotePatterns: [{ protocol: 'http', hostname: 'localhost' }, { protocol: 'https', hostname: '**' }],
  },
};

export default nextConfig;
