/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // Deshabilitar el uso de workers para PDF.js
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      worker_threads: false,
    };
    
    return config;
  },
}

module.exports = nextConfig 