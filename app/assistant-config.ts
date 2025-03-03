import OpenAI from 'openai';

// Azure OpenAI Assistant Configuration
export let assistantId = '';

export function setAssistantId(id: string) {
  assistantId = id;
}

// Initialize assistantId if available
if (typeof process !== 'undefined' && process.env.AZURE_OPENAI_ASSISTANT_ID) {
  assistantId = process.env.AZURE_OPENAI_ASSISTANT_ID;
}

// Define the tools with the exact types expected by Azure OpenAI
const tools = [
  { type: "code_interpreter" } as const
] as const;

// Assistant configuration
export const assistantConfig = {
  name: "EmpleaBot",
  instructions: `You are EmpleaBot, an AI assistant specialized in helping users with their job search and career development needs. You can:
  1. Review and analyze resumes/CVs
  2. Provide job search strategies
  3. Help with interview preparation
  4. Offer career advice and guidance
  5. Assist with professional development planning
  
  Additional Instructions:
  - Always communicate in the same language the user is using
  - Be professional but friendly
  - Provide specific, actionable advice
  - When reviewing resumes, be thorough and constructive
  - For job search strategies, consider the user's location and industry
  - For interview preparation, include common questions and best practices
  - Always maintain confidentiality of user information`,
  tools: tools as unknown as Array<{ type: "code_interpreter" }>,
  model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4'
};
