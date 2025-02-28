import OpenAI from 'openai';
import { ASSISTANT_ID, assistantConfig } from '../assistant-config';

// Initialize the Azure OpenAI client
const openai = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT_NAME}`,
  defaultQuery: { 'api-version': '2024-02-15-preview' },
  defaultHeaders: { 'api-key': process.env.AZURE_OPENAI_API_KEY }
});

// Function to ensure assistant exists and is up to date
export async function ensureAssistant() {
  try {
    if (!ASSISTANT_ID) {
      console.log('Creating new assistant...');
      const newAssistant = await openai.beta.assistants.create({
        name: assistantConfig.name,
        instructions: assistantConfig.instructions,
        tools: assistantConfig.tools.map(tool => ({ ...tool })),
        model: assistantConfig.model,
      });
      console.log('New assistant created:', newAssistant.name);
      return newAssistant;
    }

    // Try to retrieve the existing assistant
    const existingAssistant = await openai.beta.assistants.retrieve(ASSISTANT_ID);
    console.log('Assistant found:', existingAssistant.name);

    // Check if we need to update the assistant
    if (
      existingAssistant.name !== assistantConfig.name ||
      existingAssistant.instructions !== assistantConfig.instructions ||
      existingAssistant.model !== assistantConfig.model ||
      JSON.stringify(existingAssistant.tools) !== JSON.stringify(assistantConfig.tools)
    ) {
      console.log('Updating assistant configuration...');
      const updatedAssistant = await openai.beta.assistants.update(ASSISTANT_ID, {
        name: assistantConfig.name,
        instructions: assistantConfig.instructions,
        tools: assistantConfig.tools.map(tool => ({ ...tool })),
        model: assistantConfig.model,
      });
      console.log('Assistant updated:', updatedAssistant.name);
      return updatedAssistant;
    }

    return existingAssistant;
  } catch (error) {
    console.error('Error managing assistant:', error);
    throw error;
  }
}

export { openai }; 