/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["@bagsfm/bags-sdk", "@solana/web3.js"]
  }
};

export default nextConfig;
