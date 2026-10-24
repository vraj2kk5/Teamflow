/** @type {import('next').NextConfig} */
const nextConfig = {
  devIndicators: false,
  async rewrites() {
    return [
      {
        source: "/api/files/:path*",
        destination: "http://localhost:5000/api/files/:path*",
      },
    ];
  },
};

export default nextConfig;
