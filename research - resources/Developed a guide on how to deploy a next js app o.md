<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" class="logo" width="120"/>

# Migrating Next.js Deployment from Vercel to Azure Static Web Apps via GitHub Actions

---

Deploying Next.js applications to Azure Static Web Apps (SWA) requires fundamental architectural and configuration changes compared to Vercel's managed platform. This guide provides a comprehensive analysis of required adjustments across infrastructure, CI/CD pipelines, and application code for hybrid-rendered Next.js projects[^1][^4][^6][^12].

## Key Architectural Differences Between Vercel and Azure SWA

### 1. Static Asset Handling

Azure SWA requires explicit static asset management via `output: 'standalone'` in `next.config.js` combined with manual file copying during build processes[^1][^6]. Unlike Vercel's automatic static optimization:

```javascript
// next.config.js
module.exports = {
  output: 'standalone', // Required for Azure SWA hybrid deployment
  experimental: {
    appDir: true,
    outputFileTracingRoot: path.join(__dirname, '../../')
  }
}
```

The build process must include explicit artifact preparation:

```json
// package.json
{
  "scripts": {
    "build:azure": "next build && cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/"
  }
}
```


### 2. Server-Side Rendering Constraints

Azure SWA implements Next.js SSR through Azure Functions with specific routing requirements[^4][^12]. Applications must:

1. Use `getStaticProps`/`getServerSideProps` with explicit ISR configurations
2. Avoid Vercel-specific optimizations like `next/image` automatic optimization
3. Implement custom cache headers through `next.config.js` headers configuration:
```javascript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable'
          }
        ]
      }
    ]
  }
}
```


### 3. Environment Variable Management

Azure SWA requires environment variables to be defined in GitHub Actions workflow files rather than Vercel's dashboard[^6][^11]:

```yaml
# .github/workflows/azure-static-web-app.yml
env:
  NEXT_PUBLIC_API_BASE: ${{ secrets.NEXT_PUBLIC_API_BASE }}
  IS_STATIC_EXPORT: true # Required for static optimization
```


## Required File Modifications

### 1. CI/CD Pipeline Configuration

Replace Vercel's `vercel.json` with GitHub Actions workflow:

```yaml
name: Azure Static Web Apps CI/CD

on:
  push:
    branches: [main]
  pull_request:
    types: [opened, synchronize, reopened, closed]
    branches: [main]

jobs:
  build_and_deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install dependencies
        run: npm install
        
      - name: Build standalone artifacts
        run: npm run build:azure
        
      - name: Deploy to Azure SWA
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_SWA_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          app_location: ".next/standalone"
          output_location: ".next/static"
          skip_app_build: true
```


### 2. Next.js Configuration

Essential modifications for Azure compatibility:

```javascript
// next.config.js
const path = require('path');

module.exports = {
  trailingSlash: true, // Required for Azure routing
  output: 'standalone',
  experimental: {
    appDir: true,
    outputFileTracingRoot: path.join(__dirname, '../../')
  },
  images: {
    unoptimized: true // Disable Vercel image optimization
  }
}
```


### 3. Server Initialization

Create custom server entry point for Azure Functions integration:

```typescript
// server/azure-server.ts
import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'

const dev = process.env.NODE_ENV !== 'production'
const app = next({ dev })
const handle = app.getRequestHandler()

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url!, true)
    handle(req, res, parsedUrl)
  }).listen(process.env.PORT || 3000, () => {
    console.log('> Ready on http://localhost:3000')
  })
})
```


## Deployment Workflow Optimization

### 1. Static Asset Versioning

Implement content hashing for cache invalidation:

```javascript
// next.config.js
module.exports = {
  generateBuildId: async () => {
    return process.env.GITHUB_SHA || 'local-build'
  }
}
```


### 2. Hybrid Rendering Configuration

Strategic route segmentation using `exportPathMap`:

```javascript
// next.config.js
module.exports = {
  exportPathMap: async function () {
    return {
      '/': { page: '/', _isStatic: true },
      '/blog': { page: '/blog', _isStatic: false }
    }
  }
}
```


### 3. Monitoring Integration

Add Azure-specific telemetry:

```typescript
// lib/telemetry.ts
export function trackPageView(path: string) {
  if (process.env.AZURE_INSTRUMENTATION_KEY) {
    fetch('https://dc.services.visualstudio.com/v2/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        iKey: process.env.AZURE_INSTRUMENTATION_KEY,
        name: `PageView:${path}`,
        time: new Date().toISOString()
      })
    })
  }
}
```


## Performance Optimization Strategies

### 1. Distributed Caching Configuration

Azure CDN cache rules in `staticwebapp.config.json`:

```json
{
  "routes": [
    {
      "route": "/_next/static/*",
      "headers": {
        "Cache-Control": "public, max-age=31536000, immutable"
      }
    }
  ],
  "responseOverrides": {
    "404": {
      "rewrite": "/404"
    }
  }
}
```


### 2. Edge Caching Strategies

Implement stale-while-revalidate caching:

```javascript
// pages/_document.tsx
import Document, { Html, Head } from 'next/document'

export default class MyDocument extends Document {
  render() {
    return (
      <Html>
        <Head>
          <meta 
            httpEquiv="Cache-Control" 
            content="public, max-age=31536000, stale-while-revalidate=604800" 
          />
        </Head>
      </Html>
    )
  }
}
```


### 3. Bundle Optimization

Custom webpack configuration for Azure environment:

```javascript
// next.config.js
module.exports = {
  webpack: (config, { isServer }) => {
    if (process.env.AZURE_SWA) {
      config.optimization.splitChunks = {
        chunks: 'all',
        maxInitialRequests: 25,
        minSize: 20000
      }
    }
    return config
  }
}
```


## Security Considerations

### 1. Authentication Configuration

Azure AD integration for protected routes:

```typescript
// pages/api/auth/[...nextauth].ts
import AzureADProvider from 'next-auth/providers/azure-ad'

export default NextAuth({
  providers: [
    AzureADProvider({
      clientId: process.env.AZURE_AD_CLIENT_ID,
      clientSecret: process.env.AZURE_AD_CLIENT_SECRET,
      tenantId: process.env.AZURE_AD_TENANT_ID
    })
  ]
})
```


### 2. Security Headers

Enhanced content security policy:

```javascript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: `default-src 'self' *.azurewebsites.net;`
          }
        ]
      }
    ]
  }
}
```


## Troubleshooting Common Issues

### 1. Missing Static Assets

Debugging steps for 404 errors:

1. Verify `output: 'standalone'` configuration
2. Check artifact copy commands in build script
3. Validate GitHub Actions output directory configuration

### 2. Server-Side Rendering Failures

Diagnostic checklist:

1. Confirm Azure Functions runtime version matches Node.js version
2. Validate environment variables in Azure portal
3. Check application insights for runtime errors

### 3. Deployment Pipeline Optimization

Performance metrics tracking:

```yaml
# .github/workflows/azure-static-web-app.yml
- name: Track deployment metrics
  uses: Azure/functions-deploy@v2
  with:
    app-name: ${{ env.AZURE_FUNCTIONAPP_NAME }}
    publish-profile: ${{ secrets.AZURE_FUNCTIONAPP_PUBLISH_PROFILE }}
    enable-oryx-build: true
    scm-do-build-during-deployment: true
```


## Conclusion

Migrating Next.js deployments from Vercel to Azure SWA requires careful consideration of static asset management, server-side rendering configurations, and CI/CD pipeline optimizations. Key adjustments include:

1. Implementing standalone output mode with manual artifact management
2. Configuring Azure-specific routing and caching strategies
3. Adapting environment variable handling for GitHub Actions
4. Implementing Azure AD authentication integration
5. Optimizing webpack configurations for Azure runtime

By following this structured approach, teams can maintain feature parity while leveraging Azure's global infrastructure. Continuous monitoring through Azure Application Insights and iterative performance tuning are essential for maintaining optimal application performance in production environments[^7][^12][^14].

<div style="text-align: center">⁂</div>

[^1]: https://learn.microsoft.com/en-us/answers/questions/1372829/unable-to-deploy-next-js-to-azure-static-web-app-v

[^2]: https://stackoverflow.com/questions/73666601/how-do-you-deploy-a-next-js-app-using-swa-cli-for-azure-static-apps

[^3]: https://firstsites.com.au/blog/vercel-vs-azure-static-web-app-for-nextjs

[^4]: https://github.com/Azure/static-web-apps/discussions/1066

[^5]: https://docs.github.com/en/actions/use-cases-and-examples/deploying/deploying-to-azure-static-web-app

[^6]: https://github.com/MicrosoftDocs/azure-docs/blob/main/articles/static-web-apps/deploy-nextjs-static-export.md

[^7]: https://dev.to/paulriviera/deploy-nextjs-14-app-to-linux-azure-app-service-3d34

[^8]: https://jamstacky.com/comparision/azure-static-web-apps-vs-vercel/

[^9]: https://www.youtube.com/watch?v=5Fq9chq0t4I

[^10]: https://stackoverflow.com/questions/60797746/nextjs-images-in-public-folder-not-found-on-deploy-but-are-found-locally

[^11]: https://www.reddit.com/r/nextjs/comments/1cbhwxn/weve_just_had_a_nightmare_deploying_a_nextjs/

[^12]: https://stackoverflow.com/questions/67742936/azure-next-js-deployment-required-structure

[^13]: https://www.getfishtank.com/insights/a-comprehensive-guide-deploying-from-azure-devops-to-vercel

[^14]: https://vercel.com/docs/projects/project-configuration

[^15]: https://vercel.com/docs/deployments/git/vercel-for-azure-pipelines

[^16]: https://vercel.com/guides/how-do-i-migrate-away-from-vercel-json-env-and-build-env

[^17]: https://docs.astro.build/en/guides/deploy/vercel/

[^18]: https://stackoverflow.com/questions/73191404/how-to-integrate-vercel-with-azure-repos

[^19]: https://qwik.dev/docs/deployments/vercel-edge/

[^20]: https://vercel.com/docs/deployments/git

[^21]: https://community.prismic.io/t/migrating-from-vercel-to-azure-devops/14476

[^22]: https://sdk.vercel.ai/docs/migration-guides/migration-guide-3-3

[^23]: https://www.reddit.com/r/nextjs/comments/ix1adj/help_deploying_nextjs_to_azure_swa_with/

[^24]: https://learn.microsoft.com/en-us/azure/static-web-apps/deploy-nextjs-hybrid

[^25]: https://stackoverflow.com/questions/76298546/how-to-manually-deploy-a-nextjs-spa-in-azure-static-web-apps

[^26]: https://bejamas.com/compare/azure-static-web-apps-vs-render-vs-vercel

[^27]: https://learn.microsoft.com/en-us/azure/static-web-apps/nextjs

[^28]: https://dev.to/ckgrafico/deploying-nextjs-to-azure-web-app-with-github-actions-1o9c

[^29]: https://www.youtube.com/watch?v=KT92ou3eC8M

[^30]: https://www.reddit.com/r/nextjs/comments/18fb8el/comparison_azure_with_vercel_how_much_does_the/

[^31]: https://github.com/Azure/static-web-apps/issues/1054

[^32]: https://speaktosteve.github.io/managing-environment-variables-in-nextjs-azure-static-web-apps

[^33]: https://www.youtube.com/watch?v=hk-js31zpqo

[^34]: https://bejamas.com/compare/azure-static-web-apps-vs-vercel

[^35]: https://github.com/vercel/next.js/discussions/28356

[^36]: https://learn.microsoft.com/es-es/azure/static-web-apps/deploy-nextjs-hybrid

[^37]: https://github.com/Azure/static-web-apps/discussions/921

[^38]: https://learn.microsoft.com/en-us/azure/static-web-apps/getting-started

[^39]: https://stackoverflow.com/questions/72131618/fonts-are-not-saved-on-deploying-on-vercel-next-js

[^40]: https://github.com/vercel/next.js/discussions/21640

[^41]: https://github.com/Azure/static-web-apps/issues/1503

[^42]: https://strapi.io/blog/vercel-ship-and-nextjs-15-features-and-migration-guide

[^43]: https://github.com/Azure/static-web-apps/discussions/1171

[^44]: https://github.com/Azure/static-web-apps/issues/1352

[^45]: https://stackoverflow.com/questions/69843860/how-to-remove-github-automated-checks-and-deployment-after-uninstalling-app

[^46]: https://vercel.com/docs/security/secure-backend-access/oidc/azure

[^47]: https://www.youtube.com/watch?v=ntsccU21NCs

[^48]: https://github.com/vercel/vercel/discussions/5081

[^49]: https://docs.astro.build/en/guides/integrations-guide/vercel/

[^50]: https://vercel.com/docs/deployments/configure-a-build

