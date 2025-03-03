import OpenAI from 'openai';
import { assistantId, assistantConfig, setAssistantId } from '../assistant-config';

// Initialize the Azure OpenAI client
const openai = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY || '',
  baseURL: process.env.AZURE_OPENAI_ENDPOINT ? 
    `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT_NAME}` : '',
  defaultQuery: { 'api-version': '2024-02-15-preview' },
  defaultHeaders: { 'api-key': process.env.AZURE_OPENAI_API_KEY }
});

// Function to ensure assistant exists and is up to date
export async function ensureAssistant() {
  try {
    // Check if we're in a browser environment
    if (typeof window !== 'undefined') {
      return;
    }

    // Validate required environment variables
    if (!process.env.AZURE_OPENAI_API_KEY || !process.env.AZURE_OPENAI_ENDPOINT) {
      console.warn('Azure OpenAI credentials not configured');
      return;
    }

    // Try to use existing assistant ID
    let currentAssistantId = assistantId;

    if (!currentAssistantId) {
      console.log('Creating new assistant...');
      try {
        const newAssistant = await openai.beta.assistants.create({
          name: assistantConfig.name,
          tools: [{ type: "code_interpreter" }],
          model: assistantConfig.model,
          instructions: assistantConfig.instructions
        });
        console.log('New assistant created:', newAssistant.name);
        setAssistantId(newAssistant.id);
        return newAssistant;
      } catch (error) {
        console.error('Error creating assistant:', error);
        return;
      }
    }

    // Try to retrieve the existing assistant
    try {
      const existingAssistant = await openai.beta.assistants.retrieve(currentAssistantId);
      console.log('Assistant found:', existingAssistant.name);

      // Check if we need to update the assistant
      if (
        existingAssistant.name !== assistantConfig.name ||
        existingAssistant.model !== assistantConfig.model ||
        JSON.stringify(existingAssistant.tools) !== JSON.stringify(assistantConfig.tools)
      ) {
        console.log('Updating assistant configuration...');
        const updatedAssistant = await openai.beta.assistants.update(currentAssistantId, {
          name: assistantConfig.name,
          tools: [{ type: "code_interpreter" }],
          model: assistantConfig.model,
          instructions: assistantConfig.instructions
        });
        console.log('Assistant updated:', updatedAssistant.name);
        return updatedAssistant;
      }

      return existingAssistant;
    } catch (error) {
      console.error('Error managing assistant:', error);
      return;
    }
  } catch (error) {
    console.error('Error in ensureAssistant:', error);
    return;
  }
}

export { openai }; 