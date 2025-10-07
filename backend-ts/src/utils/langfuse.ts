import { CallbackHandler } from "@langfuse/langchain";

// Make sure you have OpenTelemetry set up
// https://langfuse.com/docs/observability/sdk/typescript/setup#initialize-opentelemetry
 
// Initialize Langfuse callback handler
export const langfuseHandler = new CallbackHandler();
 
/* // Your Langchain implementation
const chain = new LLMChain(...);
 
// Add handler as callback when running the Langchain agent
await chain.invoke(
  { input: "<user_input>" },
  { callbacks: [langfuseHandler] }
); */