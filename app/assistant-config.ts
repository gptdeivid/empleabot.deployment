export let assistantId = ""; // set your assistant ID here

if (assistantId === "") {
  assistantId = process.env.AZURE_OPENAI_ASSISTANT_ID;
}
