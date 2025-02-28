import { AzureOpenAI } from "openai";

export const openai = new AzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiVersion: "2024-02-15-preview",
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT_NAME
});
