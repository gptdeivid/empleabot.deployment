import OpenAI from 'openai';

// Azure OpenAI Assistant Configuration
export let assistantId = process.env.AZURE_OPENAI_ASSISTANT_ID || '';

export function setAssistantId(id: string) {
  assistantId = id;
}

// Validate assistant ID is set
if (!assistantId) {
  throw new Error('AZURE_OPENAI_ASSISTANT_ID environment variable is not set');
}

// Define tool types
type AssistantToolType = "code_interpreter" | "retrieval";
interface AssistantTool {
  type: AssistantToolType;
}

// Define the tools
const tools = [
  { type: "code_interpreter" as const },
  { type: "retrieval" as const }
];

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
  tools,
  model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4'
};
