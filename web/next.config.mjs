/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow the Arena/e2b preview proxy to load /_next/* assets cross-origin.
  allowedDevOrigins: ["*.e2b.app"],
};

export default nextConfig;
