I will create a high-level guide on deploying a Next.js app on Azure Static Web Apps (SWA) via GitHub Actions, especially when the app was initially configured for deployment on Vercel. This guide will cover the necessary file adjustments, GitHub Actions configuration, and key considerations for a smooth transition.

I will let you know once the guide is ready.

# Deploying a Next.js App to Azure Static Web Apps via GitHub Actions

This guide walks through migrating a Next.js application from Vercel to **Azure Static Web Apps (SWA)** with GitHub Actions. It covers the necessary configuration changes (like `next.config.js` and `package.json`), environment variable handling, setting up a CI/CD workflow, and tips to avoid common pitfalls. The sections below break down each part of the process with clear steps and explanations.

## Understanding the Transition from Vercel to Azure SWA

When moving from Vercel to Azure Static Web Apps, there are key differences in how your app is built, deployed, and configured:

- **Deployment Pipeline**: Vercel provides an all-in-one platform that automatically builds and deploys your app on each push. In contrast, Azure SWA separates the build and deploy process into two parts – your site is built via an external pipeline (GitHub Actions) and then hosted on Azure’s infrastructure ([Which service? Netlify vs Vercel vs Azure Static Web App · Elio Struyf](https://www.eliostruyf.com/netlify-vs-vercel-vs-azure-static-web-app/#:~:text=into%20two%20pieces,file%20will%20automatically%20be%20configured)). You’ll need to set up a GitHub Actions workflow to compile and publish your app to Azure (covered below). This means your code repository now controls the deployment process via a YAML workflow file, rather than Vercel’s integrated system.  
    
- **Serverless Functions & APIs**: On Vercel, Next.js API routes and server-side functions run on Vercel’s serverless infrastructure automatically. Azure SWA supports Next.js API routes by running them as Azure Functions under the hood. The project structure might conceptually split into a frontend app and an optional `/api` backend. In practice, Azure’s build will detect and bundle Next.js API routes as functions. The main difference is that Azure may require explicit configuration of the API location in the workflow (if you have a separate functions folder), whereas Vercel required no additional setup. The Azure SWA action can deploy both static files and API function code.  
    
- **Environment Variables**: Vercel makes environment variables easy – you configure them in the Vercel dashboard, and it automatically injects them into both the build process and runtime. Azure SWA **does not auto-inject build env variables**; instead, you must explicitly pass them in your GitHub Actions workflow and configure them in Azure for runtime ([Fixing the Stripe API Key Error When Migrating Next.js from Vercel to Azure Static Web Apps \- DEV Community](https://dev.to/rajeshkumaryadavdotcom/fixing-the-stripe-api-key-error-when-migrating-nextjs-from-vercel-to-azure-static-web-apps-3e7l#:~:text=The%20Difference%20Between%20Vercel%20and,Azure%20Static%20Web%20Apps)). This is a common stumbling block when migrating. For example, a Next.js app that was working on Vercel might fail on Azure if environment variables (like API keys) aren’t provided to the build. We’ll see how to map and set these variables in a later section.  
    
- **SSR and Next.js Features**: If your Next.js app uses Server-Side Rendering or dynamic features, note that Azure SWA’s support for Next.js SSR is currently in **preview**. Many features that “just work” on Vercel might need consideration on Azure. During this preview, some capabilities are not supported or have limitations – for example, Azure SWA SSR doesn’t support certain Azure Functions integrations or the use of a `staticwebapp.config.json` for routing (you must use Next.js configuration instead) ([Its possible deploy a hybrid NEXT.js application in Azure? \- Stack Overflow](https://stackoverflow.com/questions/77828269/its-possible-deploy-a-hybrid-next-js-application-in-azure#:~:text=can%20use%20the%20Next,HTML%20export%20is%20fully%20supported)). Also, Next.js 13+ (with the new app router and React Server Components) has only limited support on Azure SWA SSR as of now ([Its possible deploy a hybrid NEXT.js application in Azure? \- Stack Overflow](https://stackoverflow.com/questions/77828269/its-possible-deploy-a-hybrid-next-js-application-in-azure#:~:text=,HTML%20export%20is%20fully%20supported)). This means if your app heavily relies on cutting-edge Next.js 13 features, you may encounter issues or need to ensure those pages can fallback to static generation. On the other hand, **static-exported** Next.js sites (fully pre-rendered) are fully supported on Azure SWA ([Its possible deploy a hybrid NEXT.js application in Azure? \- Stack Overflow](https://stackoverflow.com/questions/77828269/its-possible-deploy-a-hybrid-next-js-application-in-azure#:~:text=,HTML%20export%20is%20fully%20supported)). In summary, most typical Next.js features (pages, API routes, SSR) can work on Azure SWA, but you should be aware of these differences and test accordingly.  
    
- **Configuration and Routing**: Vercel might use a `vercel.json` for custom routes or rely on file-based routing with automatic behavior. Azure SWA typically uses a `staticwebapp.config.json` for routing rules in static sites, but for Next.js with SSR (preview) it **ignores** that file. Instead, you should handle redirects, rewrites, and headers via Next.js config or middleware, as Azure will defer to Next.js routing logic ([Its possible deploy a hybrid NEXT.js application in Azure? \- Stack Overflow](https://stackoverflow.com/questions/77828269/its-possible-deploy-a-hybrid-next-js-application-in-azure#:~:text=can%20use%20the%20Next,HTML%20export%20is%20fully%20supported)). This means any redirects you had in Vercel’s config should be translated to Next.js `redirects()` in `next.config.js`, and so on (we’ll cover this below).  
    
- **Deployment URLs and Previews**: On Vercel, each deployment (including previews for pull requests) gets a unique URL and your production domain is pointed at the latest production deployment. Azure SWA provides a similar feature: when you set up the GitHub Action, it can create staging environments for pull requests automatically (with URLs like `<hash>.<your-swa-name>.zone.azurestaticapps.net`). When the PR is closed, it tears down that environment. This behavior is configurable in the workflow and is very similar to Vercel’s preview deployments.

Overall, migrating requires adjusting your config to match Azure’s build process and ensuring all necessary settings (like environment variables and routes) are carried over. Next, we’ll dive into how to modify your Next.js app’s configuration for Azure.

## Modifying Next.js Configuration for Azure SWA

To prepare your Next.js app for Azure Static Web Apps, you’ll likely need to adjust some configuration and code, especially if the app was tuned for Vercel’s environment. Focus on your `next.config.js` and any server-side code:

- **Enable Standalone Build (for SSR)**: If your app uses Server-Side Rendering or Node.js APIs, it’s recommended to use Next.js’s **Standalone Output** mode. This bundles your app and its necessary Node modules into a smaller package for deployment. Add the following to your `next.config.js`:  
    
  // next.config.js  
    
  module.exports \= {  
    
    output: "standalone",  
    
    // ... other config ...  
    
  }  
    
  This `output: "standalone"` setting directs Next.js to output a standalone server bundle (in the `.next/standalone` directory) after building ([Tutorial: Deploy hybrid Next.js websites on Azure Static Web Apps | Microsoft Learn](https://learn.microsoft.com/en-us/azure/static-web-apps/deploy-nextjs-hybrid#:~:text=In%20order%20to%20enable%20the,next.config.js)). Azure will use this bundle to run your app without needing a full `node_modules` install, which keeps the deployment small and efficient. (Azure SWA currently has a 250 MB size limit for Next.js apps, so optimizing size is important ([Tutorial: Deploy hybrid Next.js websites on Azure Static Web Apps | Microsoft Learn](https://learn.microsoft.com/en-us/azure/static-web-apps/deploy-nextjs-hybrid#:~:text=Note)).)  
    
- **Copying Static Assets in Build**: When using standalone mode, Next.js places the server code in `.next/standalone`, but you must ensure static files (like the `.next/static` folder and your `public/` assets) are present in that output so they can be served. You can adjust your **build script** in `package.json` to handle this. For example, change the build script to:  
    
  "scripts": {  
    
    "build": "next build && cp \-r .next/static .next/standalone/.next/ && cp \-r public .next/standalone/"  
    
  }  
    
  This runs the normal `next build` and then copies the generated static files and public assets into the standalone directory, so that `.next/standalone` becomes a self-contained bundle of your app ([Tutorial: Deploy hybrid Next.js websites on Azure Static Web Apps | Microsoft Learn](https://learn.microsoft.com/en-us/azure/static-web-apps/deploy-nextjs-hybrid#:~:text=%7B%20...%20,...%20%7D)). Azure’s deployment action can then simply deploy the `.next/standalone` folder (if configured), or you can let the action handle it (more on that in the GitHub Actions section).  
    
- **API Routes and Middleware**: If your app uses Next.js API routes or middleware, you generally do not need to change the code of those routes – they will be deployed as Azure Functions automatically via the build process. However, one important tweak is needed to ensure Azure can properly serve the app: Azure Static Web Apps performs a health check on a special route `/.swa/healthz` or similar during deployment. If you have custom middleware or rewrite rules, you **must exclude paths starting with `/.swa`** from being intercepted. Otherwise, the health check could be rerouted and Azure might think the app failed to deploy. To handle this:  
    
  - In your `middleware.js/ts` (if you have one), add a matcher pattern to ignore `/.swa` paths. For example:  
      
    export const config \= {  
      
      matcher: \[  
      
        // Ignore all paths that start with ".swa" (Azure Static Web Apps)  
      
        '/((?\!.swa).\*)',  
      
      \],  
      
    }  
      
    This tells Next’s middleware to run on all paths *except* those beginning with `.swa` ([Tutorial: Deploy hybrid Next.js websites on Azure Static Web Apps | Microsoft Learn](https://learn.microsoft.com/en-us/azure/static-web-apps/deploy-nextjs-hybrid#:~:text=1,file%20in%20your%20middleware%20configuration)).  
      
  - Similarly, if you define `async redirects()` or `async rewrites()` in `next.config.js`, ensure they do not catch `.swa` paths. For instance, you might pattern your source as `/(?!\.swa).*/...` to exclude `.swa`. The Azure docs recommend configuring redirects/rewrites to exclude `.swa` in Next.js config ([Tutorial: Deploy hybrid Next.js websites on Azure Static Web Apps | Microsoft Learn](https://learn.microsoft.com/en-us/azure/static-web-apps/deploy-nextjs-hybrid#:~:text=2,swa)). This allows Azure’s system paths to function normally for things like health checks or other internal routes.


- **Routing Rules and Custom Domains**: On Vercel, you might have used `vercel.json` for things like redirects, custom headers, or trailing slash settings. On Azure SWA with Next.js, the **`staticwebapp.config.json`** (which is Azure’s equivalent for static site configuration) is not used in the SSR preview. Instead, put your routing rules in Next.js config. For example, define `async redirects()` and `async rewrites()` in `next.config.js` for any route changes, and use Next.js’s built-in support for custom headers (via the `headers()` function in config) if needed. Azure will respect these because the Next.js app itself handles them. In fact, Azure’s SSR preview **ignores** `staticwebapp.config.json` for things like routing and headers – Next.js is in charge of those ([Its possible deploy a hybrid NEXT.js application in Azure? \- Stack Overflow](https://stackoverflow.com/questions/77828269/its-possible-deploy-a-hybrid-next-js-application-in-azure#:~:text=can%20use%20the%20Next,HTML%20export%20is%20fully%20supported)). So, ensure all the custom routing logic your app needs is implemented within the app (similar to how it would run locally or on Vercel).  
    
- **Build Target**: Ensure your Next.js build is targeting a Node.js environment (which is default). You do **not** want to use `next export` (which outputs a static HTML site) unless you intend to deploy a static-only version. If your app was fully static on Vercel (using `getStaticProps` everywhere and no server-side code), you could use `next export` and host the site as pure static content on Azure SWA. In that case, set `output: 'export'` in `next.config.js` or run `next export` and adjust the workflow (with `IS_STATIC_EXPORT: true`) ([azure-docs/articles/static-web-apps/deploy-nextjs-static-export.md at main · MicrosoftDocs/azure-docs · GitHub](https://github.com/MicrosoftDocs/azure-docs/blob/main/articles/static-web-apps/deploy-nextjs-static-export.md#:~:text=api_location%3A%20%22%22%20,environment%20variables%20here%20IS_STATIC_EXPORT%3A%20true)) ([azure-docs/articles/static-web-apps/deploy-nextjs-static-export.md at main · MicrosoftDocs/azure-docs · GitHub](https://github.com/MicrosoftDocs/azure-docs/blob/main/articles/static-web-apps/deploy-nextjs-static-export.md#:~:text=env%3A%20,here%20IS_STATIC_EXPORT%3A%20true)). But if you need SSR or API routes, stick with the default build (which produces `.next` output and possibly standalone server).  
    
- **Next.js Version Considerations**: If you are on Next.js 13 or newer (using the app directory, server components, etc.), be mindful that Azure’s support is evolving. Some features like React Server Components should work, but others (like certain streaming or incremental revalidation) might not fully work yet ([Its possible deploy a hybrid NEXT.js application in Azure? \- Stack Overflow](https://stackoverflow.com/questions/77828269/its-possible-deploy-a-hybrid-next-js-application-in-azure#:~:text=routing%20can%20be%20controlled%20using,HTML%20export%20is%20fully%20supported)). It’s a good idea to test critical functionality (like authentication or data fetching methods) in an Azure environment. In some cases, you might need to adjust configuration (for example, disabling ISR or using fallback static paths) to accommodate current limitations.

After updating your `next.config.js` and scripts as above, your app is ready for the Azure build process. Now, let's ensure all the environment variables carry over properly from Vercel to Azure.

## Updating Environment Variables

One major difference when leaving Vercel is how environment variables are provided to your app in build and runtime. On Vercel, you likely added your API keys and settings in the Vercel dashboard, and Vercel injected those into both the build step and the serverless functions at runtime automatically. With Azure Static Web Apps, you need to explicitly handle environment variables in two places: **GitHub (for build)** and **Azure (for runtime)**.

**Key points to consider:**

- **Build-Time vs Runtime Variables**: Next.js needs certain variables at build-time (especially any variable used in frontend code, which must be inlined at build). Any variable that is used in your React code (and prefixed with `NEXT_PUBLIC_`) or used in `getStaticProps` or during `next build` must be present during the build process. Other secrets that are only used in API routes or `getServerSideProps` can be provided at runtime only. We will handle these separately.  
    
- **Mapping Vercel Vars to GitHub Secrets**: Go through the environment variables you had on Vercel. For each one:  
    
  - If it’s needed at build-time or is a public var (e.g. `NEXT_PUBLIC_API_URL` or a public API key), create a **GitHub Actions secret** for it. In your GitHub repository, go to **Settings \> Secrets and Variables \> Actions** and add a new **Repository Secret**. The name should match what your code expects (e.g. `NEXT_PUBLIC_STRIPE_PUBLIC_KEY`) and the value should be the same as you used on Vercel. Repeat this for each relevant variable. (Do *not* commit these values to your repo; using secrets keeps them encrypted).  
  - If it’s a secret only needed server-side (like a database password or Stripe secret key used in an API route), you *could* also provide it at build (it won’t be exposed to client, but isn’t necessary if not used in build). Instead, you will configure this in Azure for runtime.


- **Passing Build-Time Secrets to Next.js**: In your GitHub Actions workflow file, you need to pass the secrets as environment variables so that `npm run build` can see them. The Azure Static Web Apps Deploy action allows you to set env vars in the workflow. For example, if you added `MY_API_KEY` and `NEXT_PUBLIC_STRIPE_PUBLIC_KEY` as secrets, your workflow YAML might include:  
    
  \- name: Build And Deploy  
    
    uses: Azure/static-web-apps-deploy@v1    
    
    with:  
    
      azure\_static\_web\_apps\_api\_token: ${{ secrets.AZURE\_STATIC\_WEB\_APPS\_API\_TOKEN }}  
    
      repo\_token: ${{ secrets.GITHUB\_TOKEN }}  
    
      action: "upload"  
    
      app\_location: "/"       \# root of your app  
    
      api\_location: ""        \# Next.js API routes are inside the app  
    
      output\_location: ""     \# output (leave empty to auto-detect)  
    
    env:  
    
      NEXT\_PUBLIC\_STRIPE\_PUBLIC\_KEY: ${{ secrets.NEXT\_PUBLIC\_STRIPE\_PUBLIC\_KEY }}  
    
      MY\_API\_KEY: ${{ secrets.MY\_API\_KEY }}  
    
  In this snippet, we inject the secrets as env variables during the build step. This is crucial – **Azure SWA (via GitHub Actions) will not automatically include your repository secrets unless you specify them**. Vercel would handle this for you, but in Azure’s case, we explicitly pass them in the workflow ([Fixing the Stripe API Key Error When Migrating Next.js from Vercel to Azure Static Web Apps \- DEV Community](https://dev.to/rajeshkumaryadavdotcom/fixing-the-stripe-api-key-error-when-migrating-nextjs-from-vercel-to-azure-static-web-apps-3e7l#:~:text=Vercel%3A%20Automatically%20injects%20environment%20variables,to%20the%20GitHub%20Actions%20workflow)) ([Fixing the Stripe API Key Error When Migrating Next.js from Vercel to Azure Static Web Apps \- DEV Community](https://dev.to/rajeshkumaryadavdotcom/fixing-the-stripe-api-key-error-when-migrating-nextjs-from-vercel-to-azure-static-web-apps-3e7l#:~:text=env%3A%20NEXT_PUBLIC_STRIPE_PUBLIC_KEY%3A%20%24)). As a result, when Next.js builds, `process.env.NEXT_PUBLIC_STRIPE_PUBLIC_KEY` will have the correct value and be embedded into the client bundle (avoiding errors like "Missing value for Stripe() apiKey" ([Fixing the Stripe API Key Error When Migrating Next.js from Vercel to Azure Static Web Apps \- DEV Community](https://dev.to/rajeshkumaryadavdotcom/fixing-the-stripe-api-key-error-when-migrating-nextjs-from-vercel-to-azure-static-web-apps-3e7l#:~:text=Vercel%3A%20Automatically%20injects%20environment%20variables,to%20the%20GitHub%20Actions%20workflow))).  
    
- **Setting Runtime Variables in Azure**: For secret keys or any variables used server-side at runtime (for example, an API route reading `process.env.STRIPE_SECRET_KEY`), set these in the Azure portal:  
    
  1. Navigate to your Static Web App in the Azure Portal.  
  2. Under **Settings**, find **Configuration** (or an **Application Settings** section). This is where you can define environment variables for the Azure Functions backend of your static web app.  
  3. Add a new Application Setting for each secret. For instance, create a setting named `STRIPE_SECRET_KEY` and put your secret key as the value. ([Fixing the Stripe API Key Error When Migrating Next.js from Vercel to Azure Static Web Apps \- DEV Community](https://dev.to/rajeshkumaryadavdotcom/fixing-the-stripe-api-key-error-when-migrating-nextjs-from-vercel-to-azure-static-web-apps-3e7l#:~:text=Access%20Configuration%3A))  
  4. Save the settings. Azure will usually prompt to restart the functions or it will apply on the next deployment. These settings will be available as `process.env.STRIPE_SECRET_KEY` in your Next.js API routes or `getServerSideProps` on Azure.


  Azure SWA’s application settings are analogous to Vercel’s environment variables for runtime. The difference is you manage them in Azure’s UI (or CLI) instead of Vercel’s. By splitting build-time and runtime like this, you ensure sensitive secrets (like a private API key) are **not** exposed during build (they stay only in Azure), whereas public or build-needed vars are provided as needed.


- **Verification**: After deployment, if something is undefined (for example, your app crashes because `process.env.SOME_KEY` is not set), double-check that you either passed it in the workflow (for build) or configured it in Azure. Remember, **Azure will not know about any of your Vercel settings** automatically – you have to migrate them over.

In summary, map all your Vercel env vars to GitHub secrets or Azure Application Settings as appropriate. A good rule of thumb: anything with `NEXT_PUBLIC_` or used during build goes into GitHub Actions env, anything secret and only needed at runtime goes into Azure’s settings. Next, we’ll configure the GitHub Actions workflow that ties everything together.

## Setting Up GitHub Actions for Azure SWA Deployment

Azure Static Web Apps are typically deployed via an automated GitHub Actions workflow. If you used the Azure portal to create your Static Web App and linked your repository, Azure might have already suggested a YAML workflow file. You can use that as a starting point or create one from scratch. Here’s what you need to set up:

- **1\. Create the Azure Static Web App Resource**: In the Azure portal, create a new *Static Web App*. Choose the subscription, resource group, etc., and for deployment source, you can select **Other** (since we will set up manually) or GitHub and provide the repo. If you select GitHub in the wizard, Azure will auto-generate the YAML file in your repo (you'll see a PR or commit). In either case, once the resource is created, note the **Deployment Token** (find this in the Azure portal under your Static Web App’s settings, there’s a menu for **Deployment token**). Copy this token.  
    
- **2\. Add Deployment Token to GitHub**: In your GitHub repo settings, add a new secret named `AZURE_STATIC_WEB_APPS_API_TOKEN` (or the name Azure’s workflow used, sometimes `AZURE_STATIC_WEB_APPS_TOKEN`). Paste the deployment token value here ([Deploying to Azure Static Web App \- GitHub Docs](https://docs.github.com/en/actions/use-cases-and-examples/deploying/deploying-to-azure-static-web-app#:~:text=site%20in%20the%20Azure%20portal,in%20the%20Azure%20documentation)). This token allows the GitHub Action to authenticate and push your build to the Azure Static Web App.  
    
- **3\. Create the Workflow File**: Add a YAML file (for example, `.github/workflows/azure-static-web-apps.yml`) in your repository. This file will describe the CI/CD pipeline. A typical Azure SWA workflow might look like:  
    
  name: Deploy Next.js to Azure Static Web Apps  
    
  on:  
    
    push:  
    
      branches: \[ main \]    \# or your deployment branch  
    
    pull\_request:  
    
      types: \[opened, synchronize, reopened, closed\]  
    
      branches: \[ main \]  
    
  permissions:  
    
    contents: read    \# allow actions to fetch code  
    
    issues: write     \# (optional) for SWA to post PR comments  
    
    pull-requests: write  
    
  jobs:  
    
    build\_and\_deploy:  
    
      if: github.event\_name \== 'push' || (github.event\_name \== 'pull\_request' && github.event.action \!= 'closed')  
    
      runs-on: ubuntu-latest  
    
      name: Build and Deploy  
    
      steps:  
    
        \- uses: actions/checkout@v4  
    
        \- name: Build And Deploy  
    
          uses: Azure/static-web-apps-deploy@v1  
    
          with:  
    
            azure\_static\_web\_apps\_api\_token: ${{ secrets.AZURE\_STATIC\_WEB\_APPS\_API\_TOKEN }}  
    
            repo\_token: ${{ secrets.GITHUB\_TOKEN }}  
    
            action: upload  
    
            app\_location: "/"       \# path to Next.js app, "/" if repo root  
    
            api\_location: ""        \# path to API, empty if using Next.js API routes  
    
            output\_location: ""     \# build output, empty to auto-detect (.next or out)  
    
          env:  
    
            NEXT\_PUBLIC\_API\_URL: ${{ secrets.NEXT\_PUBLIC\_API\_URL }}  
    
            OTHER\_VAR: ${{ secrets.OTHER\_VAR }}  
    
    \# Optionally, a job to close staging environments on PR close:  
    
    close\_pull\_request:  
    
      if: github.event\_name \== 'pull\_request' && github.event.action \== 'closed'  
    
      runs-on: ubuntu-latest  
    
      steps:  
    
        \- name: Close SWA Preview  
    
          uses: Azure/static-web-apps-deploy@v1  
    
          with:  
    
            azure\_static\_web\_apps\_api\_token: ${{ secrets.AZURE\_STATIC\_WEB\_APPS\_API\_TOKEN }}  
    
            action: close  
    
  Let’s break down what’s happening here:  
    
  - We trigger on pushes to main (you can adjust branch name) and pull request events, so that we deploy on each commit and also create temporary previews for PRs.  
  - We use the official **Azure Static Web Apps Deploy** action (`Azure/static-web-apps-deploy@v1`). This action will handle installing dependencies, building the app, and deploying it, all in one step. We provide it the necessary parameters:  
    - `azure_static_web_apps_api_token`: the secret token we added, used to authenticate with Azure ([Deploying to Azure Static Web App \- GitHub Docs](https://docs.github.com/en/actions/use-cases-and-examples/deploying/deploying-to-azure-static-web-app#:~:text=deploy%401a947af9992250f3bc2e68ad0754c0b0c11566c9%20with%3A%20azure_static_web_apps_api_token%3A%20%24,env.OUTPUT_LOCATION)).  
    - `repo_token`: GitHub’s token for posting status (used for PR comments about the deployment, for example).  
    - `action: upload`: means we want to build and upload a new deployment (as opposed to `close` which is used to tear down previews).  
    - `app_location`: the path to our app code. In most Next.js projects, the root of the repo is the app, so "/" is fine. If your Next.js project is in a subfolder, specify it (e.g., `app_location: "webapp"` if your Next.js code is in `webapp/` folder).  
    - `api_location`: for a separate Azure Functions API backend. Since Next.js API routes are inside the app, we leave this blank or `api` if we had an `/api` directory outside of Next (not common here).  
    - `output_location`: where the built site resides. This can often be left blank. The action is smart for many frameworks – for Next.js, it knows the default output is the `.next` folder (or `.next/standalone` if standalone mode). If you were doing a static export, you’d set this to `out` (or wherever `next export` outputs). In our case with SSR, leave it empty or specify `.next`.  
  - Under `env:`, we pass the needed env variables for build (as discussed in the previous section). This ensures the build step has access to those secrets ([Fixing the Stripe API Key Error When Migrating Next.js from Vercel to Azure Static Web Apps \- DEV Community](https://dev.to/rajeshkumaryadavdotcom/fixing-the-stripe-api-key-error-when-migrating-nextjs-from-vercel-to-azure-static-web-apps-3e7l#:~:text=env%3A%20NEXT_PUBLIC_STRIPE_PUBLIC_KEY%3A%20%24)).  
  - The second job `close_pull_request` is optional and comes from the starter workflow. It simply calls the action with `action: close` to tell Azure to remove the staging environment when a PR is closed (to avoid piling up unused environments). It uses the same token.


  Once this workflow file is in place (commit it to your repo), GitHub Actions will trigger on the next push or PR. The Azure Static Web Apps action will log into Azure with the token, install your dependencies, run `npm run build` (by default), detect the Next.js app, and upload the build output to Azure. You should see output logs in GitHub Actions for each step. If everything is configured correctly, it will conclude with a message that the app was uploaded and provide a URL to your site.


- **Azure Authentication Note**: We used the deployment token for simplicity, which is the most straightforward way (just ensure the token is kept secret). Azure Static Web Apps also supports GitHub OIDC authentication (tokenless deploy) if you prefer not to manage a secret, but that requires setting up a federated identity in Azure AD and adjusting the workflow. The token method is fine for most cases and what Azure’s quickstart uses by default ([Deploying to Azure Static Web App \- GitHub Docs](https://docs.github.com/en/actions/use-cases-and-examples/deploying/deploying-to-azure-static-web-app#:~:text=site%20in%20the%20Azure%20portal,in%20the%20Azure%20documentation)).  
    
- **Verify Workflow Settings**: Double-check that `app_location`, `output_location`, etc., match your project. If your Next.js app is not in the root directory, or if you decided to do a static export, these values need to point to the correct folders. For instance, if static exporting, you might use `output_location: "out"` and even set an environment variable `IS_STATIC_EXPORT: true` in the job to let Azure know (Azure’s docs mention setting `IS_STATIC_EXPORT: true` for static Next.js sites ([azure-docs/articles/static-web-apps/deploy-nextjs-static-export.md at main · MicrosoftDocs/azure-docs · GitHub](https://github.com/MicrosoftDocs/azure-docs/blob/main/articles/static-web-apps/deploy-nextjs-static-export.md#:~:text=api_location%3A%20%22%22%20,environment%20variables%20here%20IS_STATIC_EXPORT%3A%20true)) ([azure-docs/articles/static-web-apps/deploy-nextjs-static-export.md at main · MicrosoftDocs/azure-docs · GitHub](https://github.com/MicrosoftDocs/azure-docs/blob/main/articles/static-web-apps/deploy-nextjs-static-export.md#:~:text=env%3A%20,here%20IS_STATIC_EXPORT%3A%20true))).

By setting up this workflow, you essentially replicate what Vercel was doing behind the scenes: every git push triggers a build and deploy. Now you have control over this process via the YAML file. Next, ensure your package configuration and scripts are aligned with Azure’s requirements.

## Adjusting Dependencies and Scripts

Deploying to Azure SWA might require a few tweaks to your `package.json` and dependencies, especially if your project was configured for Vercel. Here are some adjustments to consider:

- **Remove Vercel-Specific Config**: If you were using any Vercel CLI or config files (`vercel.json`), they won't be used in Azure. You can remove the Vercel CLI from devDependencies if it’s there. Azure doesn’t need a `vercel.json`; any redirects or headers from it should be moved into Next.js config (as discussed). In Azure, a file called `staticwebapp.config.json` is typically used for static sites, but since we rely on Next.js, you likely don’t need that either (and it’s not fully supported for SSR) ([Its possible deploy a hybrid NEXT.js application in Azure? \- Stack Overflow](https://stackoverflow.com/questions/77828269/its-possible-deploy-a-hybrid-next-js-application-in-azure#:~:text=can%20use%20the%20Next,HTML%20export%20is%20fully%20supported)).  
    
- **Add Necessary Dependencies (e.g. Sharp)**: Vercel’s platform provides some optimizations out-of-the-box. One notable example is image optimization – on Vercel, if you use Next.js `<Image>` component, Vercel handles image processing. Outside of Vercel, Next.js will attempt to optimize images at runtime using the `sharp` library (if available) or a fallback. Azure Static Web Apps *does not automatically include `sharp`*. For best performance (and to avoid warnings), add **`sharp`** to your dependencies if you use image optimization. This ensures that during the Azure build, the `sharp` package is installed and can be bundled. (Azure’s build won’t add it for you by default ([Tutorial: Deploy hybrid Next.js websites on Azure Static Web Apps | Microsoft Learn](https://learn.microsoft.com/en-us/azure/static-web-apps/deploy-nextjs-hybrid#:~:text=Web%20Apps%20does%20not%20remove,Image%20caching%20isn%27t%20supported)), whereas Vercel’s environment might have had it.) In your `package.json`, run `npm install sharp` and then commit the updated file. The Azure build will include it in the bundle (especially if using the standalone output, it will trace and include `sharp`).  
    
- **Check Node.js Version**: Azure SWA currently supports Node 18 for Functions runtime (at the time of writing, Node 18 is generally used). If your app needs a specific Node version to build, you can specify an `engines` field in `package.json`, for example:  
    
  "engines": {  
    
    "node": "18.x"  
    
  }  
    
  This isn’t strictly required, but it can help document the expected Node version. Azure will try to use a compatible version (and the Static Web Apps build environment typically uses Node 16 or 18). If you ran into build issues due to Node version differences, set this field ([Tutorial: Deploy hybrid Next.js websites on Azure Static Web Apps | Microsoft Learn](https://learn.microsoft.com/en-us/azure/static-web-apps/deploy-nextjs-hybrid#:~:text=specific%20Node%20version%2C%20you%20can,file%20to%20designate%20a%20version)) and ensure the GitHub Actions uses the same (you can add a step `uses: actions/setup-node@v3` to set Node 18 in the workflow, if needed).  
    
- **Scripts**: We updated the `"build"` script earlier to handle copying static files for standalone mode ([Tutorial: Deploy hybrid Next.js websites on Azure Static Web Apps | Microsoft Learn](https://learn.microsoft.com/en-us/azure/static-web-apps/deploy-nextjs-hybrid#:~:text=%7B%20...%20,...%20%7D)). Ensure this script runs correctly on a Linux environment (GitHub runner). The `cp -r` commands should work in Linux; if you’re developing on Windows, just be mindful that the build runs in Linux on GH Actions. Alternatively, you could use a cross-platform copy solution or a Node script to copy files. The provided one-liner is simple and effective on Ubuntu runners.  
    
  Also, confirm that your **start script** (if any) is appropriate. Azure SWA doesn’t actually use `npm start` (it auto-launches the Next.js server as part of the Functions startup with the built files). But if you want to test the standalone output locally, you might run `node .next/standalone/server.js` (after building) to simulate it. If you configured output standalone correctly, `npm start` might still just run Next in dev mode or not be used at all in deployment. It’s fine to leave as is, or you can set `"start": "next start"` for clarity. Just know that Azure itself won’t call `npm start` – the deployment package itself is what runs.  
    
- **Dev Dependencies**: Azure’s build action will run `npm install` (or `yarn`) to install all dependencies. By default it installs production dependencies only when building the app for deployment (since in Azure Functions, devDependencies would be pruned). With Next.js standalone mode, a lot of your code including some dependencies are bundled, but ensure anything you need at runtime is listed as a normal dependency (not devDependency). For example, if you have a library used inside `getServerSideProps`, it should be under "dependencies". DevDependencies (like linters, testing libs) won’t be shipped to Azure. In most cases, your setup from Vercel will already reflect this, but it’s worth double-checking.  
    
- **Testing the Build**: After these changes, test building your app locally one more time: run `npm run build` and see that it completes without errors. Check that `.next/standalone` exists (if using SSR) and contains the expected files. This local confirmation can catch issues with missing dependencies or config before you push to GitHub.

By updating dependencies and scripts as above, you align your project with Azure’s requirements and avoid build-time surprises.

Now that everything is configured, let’s go through the actual deployment process step-by-step and see it in action.

## Deployment Process: From Code to Azure

With all pieces in place (Next.js config adjusted, environment variables set, GitHub Actions workflow created, and Azure resource ready), deploying is straightforward. Here’s how to execute the deployment and verify it:

1. **Push Code to GitHub**: Commit all your changes (`next.config.js`, `package.json`, workflow YAML, etc.) and push to the branch that triggers the deployment (e.g., `main`). This will kick off the GitHub Actions workflow.  
     
2. **GitHub Actions Build**: Go to the **Actions** tab of your repository on GitHub. You should see the workflow running. It will go through steps: checkout code, then **Build And Deploy** (which internally does installation, build, and deploy). Monitor the logs. If there are any errors during install or build, fix them as needed (common errors might be missing packages or environment variables not set, which you can address and push again). A successful run will end with a message that the app was uploaded to Azure, and often it will list the URL of your Static Web App.  
     
3. **Visit the Azure SWA URL**: Once deployed, Azure gives your app a default domain like `https://<unique-name>.azurestaticapps.net`. Navigate to this URL in your browser. You should see your Next.js application running. Test the basic functionality:  
     
   - Navigate through pages (the static ones should load quickly via Azure’s global CDN).  
   - If you have SSR pages or API routes, trigger them to ensure they work (this will test that the Azure Functions backend is working and that runtime environment variables are set).  
   - If you set up environment variables in Azure, verify that those features are behaving correctly (for example, if your app calls a third-party API using a secret, test that workflow).

   

4. **Custom Domain (Optional)**: If you had a custom domain on Vercel, you can now configure that domain for your Azure Static Web App. In the Azure portal, under your Static Web App, there’s a **Custom domains** section where you can add your domain and follow the steps (Azure will require you to configure a CNAME or TXT record to verify domain ownership). Once set, you can use your app on the custom domain. Remember to update any references in your app or environment (e.g., if you had a BASE\_URL env variable).  
     
5. **Continuous Deployment**: Going forward, any push to the configured branch will trigger the workflow again. Your team’s development process remains similar to Vercel’s – just commit code, and the CI/CD takes care of deploying it. Pull Request workflows will provide staging URLs (you’ll see them in the Azure Static Web Apps section of the GitHub PR as a comment, if the workflow is configured for PRs). This is great for previewing feature branches, much like Vercel’s preview deployments.  
     
6. **Testing after Deployment**: It’s a good practice to test critical user paths on the deployed site. Also, check Azure’s Metrics/Logs (Azure Static Web Apps has a minimal monitoring, but you can view function logs in the Azure portal under **Functions** for your site). Ensure no runtime errors are occurring. If something isn’t working, you may need to adjust configurations or check the logs (which leads us to the next section on troubleshooting).  
     
7. **Iterate if Needed**: If the deployment fails or the app isn’t working as expected, don’t worry. Use the logs to pinpoint the issue (the error messages in the GitHub Actions log or in the browser console/Azure logs). Common fixes might be adding a missing environment variable, including a package that was assumed to be present, or tweaking a path in the workflow. Commit the fix and push again – the workflow will redeploy the app.

By following these steps, you’ve effectively transitioned the deployment process from Vercel to Azure. You should have a live app on Azure Static Web Apps, with CI/CD set up via GitHub Actions. Finally, let’s cover some common pitfalls and how to troubleshoot them during this migration.

## Common Pitfalls and Troubleshooting

Migrating platforms can introduce some hiccups. Below are common issues developers face when deploying Next.js to Azure Static Web Apps (and how to resolve them):

- **Environment Variables Not Working**: The most frequent issue is missing or undefined env vars in your deployed app. If you see errors like “undefined is not an object” or missing API keys (for example, the Stripe public key error mentioned earlier ([Fixing the Stripe API Key Error When Migrating Next.js from Vercel to Azure Static Web Apps \- DEV Community](https://dev.to/rajeshkumaryadavdotcom/fixing-the-stripe-api-key-error-when-migrating-nextjs-from-vercel-to-azure-static-web-apps-3e7l#:~:text=Vercel%3A%20Automatically%20injects%20environment%20variables,to%20the%20GitHub%20Actions%20workflow))), it means the variable wasn’t passed correctly. Double-check:  
    
  - Did you add the variable as a secret in GitHub **and** include it under `env:` in the workflow? ([Fixing the Stripe API Key Error When Migrating Next.js from Vercel to Azure Static Web Apps \- DEV Community](https://dev.to/rajeshkumaryadavdotcom/fixing-the-stripe-api-key-error-when-migrating-nextjs-from-vercel-to-azure-static-web-apps-3e7l#:~:text=Vercel%3A%20Automatically%20injects%20environment%20variables,to%20the%20GitHub%20Actions%20workflow))  
  - Is the name spelled exactly the same? (Names are case-sensitive.)  
  - For server-side secrets, did you add them in Azure portal under Application Settings and hit Save? ([Fixing the Stripe API Key Error When Migrating Next.js from Vercel to Azure Static Web Apps \- DEV Community](https://dev.to/rajeshkumaryadavdotcom/fixing-the-stripe-api-key-error-when-migrating-nextjs-from-vercel-to-azure-static-web-apps-3e7l#:~:text=Access%20Configuration%3A))  
  - If you added a new secret, remember to re-run the workflow (push a new commit) because adding a secret alone doesn’t trigger a build.  
  - You can also verify what env vars are present by temporarily printing them in your code or the build log (not the secret values, but you could `console.log(process.env.MY_VAR)` in a server-side piece to see if it’s defined).


- **Build Failures**: If the GitHub Action fails during the **build** step:  
    
  - Look at the error message in the log. A common one might be an out-of-memory or process killed if your app is very large – using the standalone output helps prevent this by reducing what needs to be bundled.  
  - Another common failure is if your project requires a newer Node version than the default. For example, if you use Node 18 features but the build used Node 16\. To fix this, explicitly set up Node in the workflow (`uses: actions/setup-node@v3` with `node-version: 18`) and/or specify the engine in package.json.  
  - If you see an error about `sharp` or image optimization, that indicates `sharp` wasn’t installed. Solve by adding `sharp` to dependencies as mentioned earlier ([Tutorial: Deploy hybrid Next.js websites on Azure Static Web Apps | Microsoft Learn](https://learn.microsoft.com/en-us/azure/static-web-apps/deploy-nextjs-hybrid#:~:text=Web%20Apps%20does%20not%20remove,Image%20caching%20isn%27t%20supported)).  
  - If the error complains about not finding a module at runtime, it could mean that module was not bundled. Ensure it’s listed as a dependency (not devDependency). With `output: standalone`, Next.js should include all needed files in `.next/standalone`. If something is missing, you might need to tweak the build or manually ensure it’s present.


- **Functions / API Issues**: If your pages that rely on API routes or SSR are not working (but static pages are), it could be an Azure Functions issue:  
    
  - Check the Azure portal: under your Static Web App, there is a section for **Functions** where you can see logs for each function (each Next.js API route or SSR route is essentially a function). See if there are runtime errors there.  
  - A common oversight is forgetting to set a server-side env var in Azure, so the function crashes when trying to access it. Fix by setting the env in Azure.  
  - If you used Node.js APIs that require certain polyfills or native modules, ensure they are supported on Azure Functions. Most Node modules work, but something like Puppeteer (headless Chrome) wouldn’t run on SWA (not without additional config).  
  - Cold start: Azure Functions may cold start on the first request, making the first request slow. This is usually fine (and similar to Vercel’s lambda cold starts), just something to be aware of.


- **Azure SWA SSR Limitations**: As mentioned, Azure’s SSR is in preview. Some known limitations:  
    
  - **Authentication/Authorization**: Azure Static Web Apps has built-in auth (with social logins, etc.), but that **does not work with Next.js SSR yet** ([Its possible deploy a hybrid NEXT.js application in Azure? \- Stack Overflow](https://stackoverflow.com/questions/77828269/its-possible-deploy-a-hybrid-next-js-application-in-azure#:~:text=,demand%20revalidation)). If you were hoping to use Azure’s authentication, you’ll need to implement auth at the app level (e.g., using NextAuth or another library). NextAuth can work on Azure SWA, but you must configure callbacks and secrets properly. If you run into auth issues, consider that Azure SWA’s built-in Easy Auth is off for SSR – rely on Next.js for auth.  
  - **ISR (Incremental Static Regeneration)**: While static regeneration (revalidating pages after a certain time) might be partially working, Azure documentation notes that image caching and on-demand revalidation are not supported yet ([Its possible deploy a hybrid NEXT.js application in Azure? \- Stack Overflow](https://stackoverflow.com/questions/77828269/its-possible-deploy-a-hybrid-next-js-application-in-azure#:~:text=routing%20can%20be%20controlled%20using,HTML%20export%20is%20fully%20supported)). If your app uses `getStaticProps` with revalidate or on-demand ISR (API to revalidate pages), this may not function on Azure SWA. As a workaround, you could switch those pages to SSR or purely static.  
  - **Next.js Version**: If using Next 13/14 with the app directory, some features like streaming, suspense boundaries might not work perfectly. Keep an eye on Azure updates, as support is improving. If a feature doesn’t work, you might have to adjust your app (e.g., use traditional pages for that part or remove experimental features).  
  - **No Local Testing with SWA CLI (for SSR)**: Azure’s Static Web Apps CLI does not support emulating Next.js SSR functions as of the preview ([Its possible deploy a hybrid NEXT.js application in Azure? \- Stack Overflow](https://stackoverflow.com/questions/77828269/its-possible-deploy-a-hybrid-next-js-application-in-azure#:~:text=,not%20support%20caching%20images%20and)). This means you cannot fully replicate the Azure environment locally via the SWA CLI. Instead, test by deploying to a staging environment, or use `next start` in standalone mode to test basic functionality.


- **Routing and 404s**: If you encounter unexpected 404 errors on Azure that didn’t happen on Vercel:  
    
  - Ensure that any dynamic routes are properly generated or handled. Vercel might gracefully handle fallback routes differently. On Azure, if you did not pre-generate and not using SSR for a dynamic page, it would 404\. The solution is to use SSR or provide `fallback: 'blocking'` in `getStaticPaths` if needed.  
  - If you had a catch-all route on Vercel via config, replicate it in Next.js (e.g., using `[...catchAll].js` page or appropriate rewrites).  
  - The special `/.swa` routes should be excluded as we did. If you missed that, Azure’s health check could be getting a 307/308 redirect by your app, causing deployment to be marked as failed. Fix middleware/redirects to ignore `.swa` path as shown earlier ([Tutorial: Deploy hybrid Next.js websites on Azure Static Web Apps | Microsoft Learn](https://learn.microsoft.com/en-us/azure/static-web-apps/deploy-nextjs-hybrid#:~:text=1,file%20in%20your%20middleware%20configuration)).  
  - Also, if you use a basePath in Next.js (uncommon on Vercel unless you configured it), ensure Azure is configured accordingly. Usually no basePath is simpler.


- **Performance Considerations**: Azure Static Web Apps globally distributes your static content (much like Vercel does with CDN). Functions (SSR/API) will run in a specific region (the one you chose for your SWA). If global performance is crucial and your app is heavily dynamic, consider that Vercel might have had an edge network advantage. Azure SWA is still great for worldwide delivery of static assets. For dynamic functions, you might experience slightly different latency. Generally this isn’t a problem, but just monitor if your app’s performance profile changes and adjust if needed (for example, enable caching for certain responses, or use Azure Front Door/CDN for functions if advanced scenario).  
    
- **Logging and Monitoring**: Use Azure’s monitoring tools to your advantage. Under the SWA resource, you can find logs for both your front-end (application insights integration, if enabled) and your functions. Azure may also surface errors in the **Notifications** area if deployment failed. On GitHub, check the Action logs for any hints (the Static Web Apps action can output errors from the Azure side too).  
    
- **Rollback**: If a deployment goes bad, Azure SWA keeps previous deployments (similar to Vercel). You can use the Azure portal to swap to a previous deployment if needed (look under the **Actions** or **Deployment history** in the SWA resource). This can serve as a quick fix while you troubleshoot the issue in a new commit.

By keeping these potential issues in mind, you can quickly diagnose and fix problems during the transition. Many of these pitfalls (like env vars and config differences) only need to be solved once during the initial setup. After that, your Next.js app should run smoothly on Azure Static Web Apps with a deployment process very much like what you were used to on Vercel.

**References:**

- Azure Static Web Apps vs Vercel – Deployment model differences ([Which service? Netlify vs Vercel vs Azure Static Web App · Elio Struyf](https://www.eliostruyf.com/netlify-vs-vercel-vs-azure-static-web-app/#:~:text=into%20two%20pieces,file%20will%20automatically%20be%20configured))  
- Environment variable handling on Vercel vs Azure SWA ([Fixing the Stripe API Key Error When Migrating Next.js from Vercel to Azure Static Web Apps \- DEV Community](https://dev.to/rajeshkumaryadavdotcom/fixing-the-stripe-api-key-error-when-migrating-nextjs-from-vercel-to-azure-static-web-apps-3e7l#:~:text=The%20Difference%20Between%20Vercel%20and,Azure%20Static%20Web%20Apps))  
- Azure Static Web Apps Next.js SSR preview limitations ([Its possible deploy a hybrid NEXT.js application in Azure? \- Stack Overflow](https://stackoverflow.com/questions/77828269/its-possible-deploy-a-hybrid-next-js-application-in-azure#:~:text=,demand%20revalidation)) ([Its possible deploy a hybrid NEXT.js application in Azure? \- Stack Overflow](https://stackoverflow.com/questions/77828269/its-possible-deploy-a-hybrid-next-js-application-in-azure#:~:text=,HTML%20export%20is%20fully%20supported))  
- Enabling Next.js standalone output for Azure deployment ([Tutorial: Deploy hybrid Next.js websites on Azure Static Web Apps | Microsoft Learn](https://learn.microsoft.com/en-us/azure/static-web-apps/deploy-nextjs-hybrid#:~:text=In%20order%20to%20enable%20the,next.config.js))  
- Build script adjustment for standalone output ([Tutorial: Deploy hybrid Next.js websites on Azure Static Web Apps | Microsoft Learn](https://learn.microsoft.com/en-us/azure/static-web-apps/deploy-nextjs-hybrid#:~:text=%7B%20...%20,...%20%7D))  
- Middleware and routing config to allow Azure SWA health checks ([Tutorial: Deploy hybrid Next.js websites on Azure Static Web Apps | Microsoft Learn](https://learn.microsoft.com/en-us/azure/static-web-apps/deploy-nextjs-hybrid#:~:text=1,file%20in%20your%20middleware%20configuration)) ([Tutorial: Deploy hybrid Next.js websites on Azure Static Web Apps | Microsoft Learn](https://learn.microsoft.com/en-us/azure/static-web-apps/deploy-nextjs-hybrid#:~:text=2,swa))  
- GitHub Actions workflow for Azure Static Web Apps (with token and paths) ([Deploying to Azure Static Web App \- GitHub Docs](https://docs.github.com/en/actions/use-cases-and-examples/deploying/deploying-to-azure-static-web-app#:~:text=deploy%401a947af9992250f3bc2e68ad0754c0b0c11566c9%20with%3A%20azure_static_web_apps_api_token%3A%20%24,env.OUTPUT_LOCATION))  
- Passing secrets (Stripe key example) via GitHub Actions env ([Fixing the Stripe API Key Error When Migrating Next.js from Vercel to Azure Static Web Apps \- DEV Community](https://dev.to/rajeshkumaryadavdotcom/fixing-the-stripe-api-key-error-when-migrating-nextjs-from-vercel-to-azure-static-web-apps-3e7l#:~:text=env%3A%20NEXT_PUBLIC_STRIPE_PUBLIC_KEY%3A%20%24))  
- Setting runtime app settings in Azure (Azure portal steps) ([Fixing the Stripe API Key Error When Migrating Next.js from Vercel to Azure Static Web Apps \- DEV Community](https://dev.to/rajeshkumaryadavdotcom/fixing-the-stripe-api-key-error-when-migrating-nextjs-from-vercel-to-azure-static-web-apps-3e7l#:~:text=Access%20Configuration%3A))  
- Azure SWA not automatically including `sharp` – add as dependency ([Tutorial: Deploy hybrid Next.js websites on Azure Static Web Apps | Microsoft Learn](https://learn.microsoft.com/en-us/azure/static-web-apps/deploy-nextjs-hybrid#:~:text=Web%20Apps%20does%20not%20remove,Image%20caching%20isn%27t%20supported))  
- Specifying Node engine in package.json for Azure build ([Tutorial: Deploy hybrid Next.js websites on Azure Static Web Apps | Microsoft Learn](https://learn.microsoft.com/en-us/azure/static-web-apps/deploy-nextjs-hybrid#:~:text=specific%20Node%20version%2C%20you%20can,file%20to%20designate%20a%20version))

