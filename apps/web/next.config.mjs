/** @type {import('next').NextConfig} */
const config = {
  output: 'standalone',
  experimental: { serverActions: { allowedOrigins: ['*'] } },
  images: { remotePatterns: [{ protocol: 'https', hostname: '**' }] },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL}/api/:path*`,
      },
    ];
  },
};

export default config;
