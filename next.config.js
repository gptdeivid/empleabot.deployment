/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  distDir: '.next',
  images: {
    unoptimized: true // Required for Azure Static Web Apps
  },
  webpack: (config) => {
    // Disable workers for PDF.js
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
  // Add environment variables
  env: {
    AZURE_OPENAI_API_KEY: process.env.AZURE_OPENAI_API_KEY,
    AZURE_OPENAI_ENDPOINT: process.env.AZURE_OPENAI_ENDPOINT,
    AZURE_OPENAI_DEPLOYMENT_NAME: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
    AZURE_OPENAI_ASSISTANT_ID: process.env.AZURE_OPENAI_ASSISTANT_ID
  },
  // Error handling
  onError: async (err, req, res) => {
    console.error('Application error:', err);
    res.statusCode = 500;
    res.end('Internal Server Error');
  },
  // Static resource optimization
  optimizeFonts: true,
  staticPageGenerationTimeout: 120,
  experimental: {
    optimizePackageImports: ['@next/font']
  },
  // Production settings
  productionBrowserSourceMaps: true,
  reactStrictMode: true,
  swcMinify: true,
  // API configuration
  async rewrites() {
    return [
      {
        source: '/api/assistants/:path*',
        destination: '/api/assistants/:path*'
      },
      {
        source: '/api/:path*',
        destination: '/api/:path*'
      }
    ]
  }
}

module.exports = nextConfig 