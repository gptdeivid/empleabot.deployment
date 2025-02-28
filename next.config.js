/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    unoptimized: true // Required for Azure Static Web Apps
  },
  webpack: (config) => {
    // Deshabilitar el uso de workers para PDF.js
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      worker_threads: false,
    };
    
    return config;
  },
  // Optimize for Azure Static Web Apps
  poweredByHeader: false,
  generateEtags: true,
  compress: true,
}

module.exports = nextConfig 