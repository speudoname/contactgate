import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use basePath for routing when served from subpath
  basePath: process.env.NODE_ENV === 'production' ? '/contacts' : '',
  
  // Allow images from the gateway domain in production
  images: {
    domains: ['localhost', 'komunate.com', 'numgate.vercel.app'],
  },
  
  // Disable strict mode for development to avoid double renders
  reactStrictMode: false,
  
  // Disable trailing slash enforcement
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
