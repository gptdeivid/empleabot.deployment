### Key Points

- It seems likely that deploying a Next.js app from Vercel to Azure Static Web Apps (SWA) via GitHub Actions requires adjusting configuration files and setting up a new deployment pipeline.  
- Research suggests you’ll need to remove Vercel-specific files like `vercel.json`, update `next.config.js` for Azure compatibility, and ensure build scripts in `package.json` are standard.  
- The evidence leans toward using Azure’s build presets for Next.js and the `Azure/static-web-apps-deploy` GitHub Action for deployment, with potential adjustments for authentication or custom domains.

### Setting Up Azure Static Web Apps

To start, create an Azure Static Web Apps resource through the [Azure portal](https://portal.azure.com). Link it to your GitHub repository, select "Next.js" from the build presets, and set the build command to `next build` with an output directory of `.next`. This automates much of the setup, but you’ll need to verify it aligns with your project.

### Adjusting Files from Vercel

Since your app was set up for Vercel, check for:

- A `vercel.json` file, which can be removed as it’s Vercel-specific.  
- `next.config.js` for any Vercel environment variables or settings, adjusting or removing them for Azure.  
- `package.json` to ensure the build script (e.g., `next build`) is standard and compatible.  
- Code that relies on Vercel’s environment, like `process.env.VERCEL`, and update it for Azure.

### Configuring GitHub Actions

Azure will create a GitHub Actions workflow, but verify it. Use the `Azure/static-web-apps-deploy` action, ensuring the build step runs `yarn install` and `yarn build`, and the deploy step points to the `.next` output directory. An example workflow is provided below for reference.

### Unexpected Detail: Authentication Considerations

If your app uses Vercel’s authentication, you’ll need to set up Azure SWA’s authentication separately, which might involve additional configuration not covered here.

---

### Survey Note: Detailed Deployment Guide for Next.js App from Vercel to Azure SWA

This comprehensive guide outlines the process of transitioning a Next.js application, originally configured for deployment on Vercel, to Azure Static Web Apps (SWA) using GitHub Actions. Given the original setup and the target platform, we’ll cover necessary adjustments, setup steps, and considerations for a smooth migration as of February 26, 2025\.

#### Background and Context

Next.js, a popular React framework, is commonly deployed on Vercel due to its seamless integration and zero-configuration setup. However, deploying to Azure SWA, which supports both static and hybrid rendering, requires adapting configurations and leveraging GitHub Actions for CI/CD. Azure SWA offers features like automatic scaling and global CDN, but it operates differently from Vercel, necessitating specific adjustments.

#### Project Preparation: Adjusting from Vercel to Azure SWA

Given the app’s Vercel origins, several files and configurations may need modification:

- **Vercel-Specific Files**:  
    
  - Check for a `vercel.json` file, which is used for Vercel-specific build and deployment settings. This file can be removed, as Azure SWA does not utilize it. For example, `vercel.json` might override build commands, which are handled differently in Azure.


- **Next.js Configuration (`next.config.js`)**:  
    
  - Review `next.config.js` for any Vercel-specific settings, such as environment variables like `VERCEL_ENV`. These may need removal or adjustment, as Azure SWA uses its own environment variable system. For instance, if the file includes Vercel’s Edge Function configurations, these should be removed, as Azure SWA handles dynamic rendering differently in its hybrid mode.


- **Package.json Scripts**:  
    
  - Ensure the build script in `package.json` is standard for Next.js, typically `"build": "next build"`. If customized for Vercel (e.g., additional Vercel CLI commands), simplify it to ensure compatibility with Azure SWA’s build process, which relies on Oryx for detection.


- **Environment Variables and Code**:  
    
  - Scan the codebase for dependencies on Vercel’s environment, such as conditional logic using `process.env.VERCEL`. For example, if there’s code like `if (process.env.VERCEL) { /* Vercel-specific logic */ }`, adjust it to remove Vercel-specific behavior, as Azure SWA does not provide these variables by default.


- **Vercel-Specific Features**:  
    
  - If the app uses Vercel’s Edge Functions or image optimization via Vercel-specific APIs, note that Azure SWA supports Next.js’s built-in `next/image` and hybrid rendering, but may require reconfiguring for performance. For instance, Vercel’s CDN caching might differ from Azure’s global CDN, so test for compatibility.

#### Setting Up Azure Static Web Apps

To deploy, create an Azure Static Web Apps resource:

- **Creation Process**:  
    
  - Navigate to the [Azure portal](https://portal.azure.com) and search for "Static Web Apps." Create a new resource, selecting your subscription and resource group. Name the app and choose a region close to your users for optimal latency.  
  - Link the resource to your GitHub repository containing the Next.js app. Select the branch (e.g., `main`) for deployment.


- **Build Configuration**:  
    
  - In the build details, choose "Next.js" from the build presets. This automatically sets the build command to `next build` and output directory to `.next`, aligning with Next.js’s standard output. For hybrid deployment, ensure the app supports App Router and React Server Components, as Azure SWA’s hybrid mode (in preview) supports these features.

#### GitHub Actions Configuration for Deployment

Azure SWA integrates with GitHub Actions, automatically generating a workflow. However, verify and potentially customize it:

- **Workflow Example**: Below is a typical GitHub Actions workflow for deploying a Next.js app to Azure SWA, using the `Azure/static-web-apps-deploy` action:  
    
  name: Build and Deploy  
    
  on:  
    
    push:  
    
      branches:  
    
        \- main  
    
    workflow\_dispatch:  
    
  jobs:  
    
    build\_and\_deploy:  
    
      runs-on: UbuntuLatest  
    
      steps:  
    
        \- uses: actions/Checkout@v2  
    
        \- name: Build  
    
          run: |  
    
            yarn install  
    
            yarn build  
    
        \- name: Deploy  
    
          uses: Azure/static-web-apps-deploy@v1  
    
          with:  
    
            azure\_static\_web\_apps\_api\_token: ${{ secrets.AZURE\_STATIC\_WEB\_APPS\_API\_TOKEN }}  
    
            repo\_token: ${{ secrets.GITHUB\_TOKEN }}  
    
            action: "upload"  
    
            app\_location: "/" \# App source code path  
    
            output\_location: ".next" \# Built app content directory  
    
  - Ensure the build step matches your package manager (e.g., `yarn` or `npm`). The deploy step uses tokens stored as GitHub secrets, which Azure sets up during resource creation.  
  - The `output_location` is critical; for Next.js, it should be `.next`, but verify in `next.config.js` if a custom output directory is set.


- **Build Output Considerations**:  
    
  - Azure SWA’s hybrid mode expects the `.next` directory for dynamic content. If your app uses static HTML export (`output: 'export'` in `next.config.js`), adjust the workflow to reflect the `out` directory, but note this limits dynamic features.

#### Deployment Verification and Additional Considerations

After pushing changes, monitor the deployment in the GitHub Actions tab. Once complete, access the app via the URL provided in the Azure portal.

- **Authentication and Authorization**:  
    
  - If the app used Vercel’s authentication, note that Azure SWA offers built-in authentication. You’ll need to configure this separately, potentially using Azure AD or other identity providers, which is outside this guide’s scope but crucial for functionality.


- **Custom Domains and Performance**:  
    
  - To use a custom domain, follow Azure SWA’s documentation for DNS configuration. Performance is enhanced by Azure’s global CDN, but test for any caching differences compared to Vercel.


- **Limitations and Unsupported Features**:  
    
  - In hybrid mode (preview), Azure SWA does not support linked APIs (e.g., Azure Functions) or SWA CLI local emulation. Ensure your app doesn’t rely on these for deployment.

#### Tables for Clarity

| File/Configuration | Vercel Setup | Azure SWA Adjustment |
| :---- | :---- | :---- |
| `vercel.json` | May exist for build overrides | Remove, not used by Azure SWA |
| `next.config.js` | May have Vercel-specific settings | Remove Vercel env vars, ensure compatibility |
| `package.json` | Build script may be customized | Ensure standard `next build` command |
| Environment Variables | May use `VERCEL_ENV`, etc. | Adjust for Azure, remove Vercel dependencies |
| Code Features | May use Vercel Edge Functions | Reconfigure for Azure SWA hybrid mode |

| Deployment Step | Action | Notes |
| :---- | :---- | :---- |
| Create Azure Resource | Link to GitHub, select Next.js preset | Ensures automatic workflow setup |
| GitHub Actions Setup | Use `Azure/static-web-apps-deploy` action | Verify build and output settings match `.next` |
| Verify Deployment | Monitor in GitHub Actions, access via URL | Check for errors, test functionality |

#### Conclusion

This guide provides a structured approach to migrate your Next.js app from Vercel to Azure SWA, addressing file adjustments, setup, and deployment via GitHub Actions. Given the differences in platforms, testing post-deployment is crucial, especially for dynamic features and authentication.

### Key Citations

- [Tutorial Deploy hybrid Next.js websites on Azure Static Web Apps](https://learn.microsoft.com/en-us/azure/static-web-apps/deployment-guides/nextjs/hybrid)  
- [Next.js on Vercel framework documentation](https://vercel.com/docs/frameworks/nextjs)  
- [Azure Static Web Apps documentation](https://learn.microsoft.com/en-us/azure/static-web-apps/)  
- [Configuring projects with vercel.json](https://vercel.com/docs/projects/project-configuration)  
- [Build configuration for Azure Static Web Apps](https://learn.microsoft.com/en-us/azure/static-web-apps/build-configuration)  
- [GitHub Azure static-web-apps-deploy action](https://github.com/Azure/static-web-apps-deploy)

