import OpenAI from 'openai';
import { assistantId, assistantConfig, setAssistantId } from '../assistant-config';

// Initialize the Azure OpenAI client
const openai = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY || '',
  baseURL: process.env.AZURE_OPENAI_ENDPOINT,
  defaultQuery: { 'api-version': '2024-02-15-preview' },
  defaultHeaders: { 'api-key': process.env.AZURE_OPENAI_API_KEY }
});

// Function to ensure assistant exists and is up to date
export async function ensureAssistant() {
  try {
    if (!assistantId) {
      console.log('Creating new assistant...');
      const newAssistant = await openai.beta.assistants.create({
        name: assistantConfig.name,
        tools: [{ type: "code_interpreter" }],
        model: assistantConfig.model,
      });
      console.log('New assistant created:', newAssistant.name);
      setAssistantId(newAssistant.id);
      return newAssistant;
    }

    // Try to retrieve the existing assistant
    const existingAssistant = await openai.beta.assistants.retrieve(assistantId);
    console.log('Assistant found:', existingAssistant.name);

    // Check if we need to update the assistant
    if (
      existingAssistant.name !== assistantConfig.name ||
      existingAssistant.model !== assistantConfig.model ||
      JSON.stringify(existingAssistant.tools) !== JSON.stringify(assistantConfig.tools)
    ) {
      console.log('Updating assistant configuration...');
      const updatedAssistant = await openai.beta.assistants.update(assistantId, {
        name: assistantConfig.name,
        tools: [{ type: "code_interpreter" }],
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