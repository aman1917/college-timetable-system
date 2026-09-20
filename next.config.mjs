/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: false },
  experimental: {
    // exceljs and jspdf are CommonJS and heavy; keep them out of the bundle
    // trace and load them on the server only.
    serverComponentsExternalPackages: ['exceljs', 'jspdf', 'bcryptjs'],
  },
};

export default nextConfig;
