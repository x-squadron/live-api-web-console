import dotenv from 'dotenv';
import { ChatOpenAI } from '@langchain/openai';
import { LangchainToolSet, OpenAIToolSet } from 'composio-core';
import { createOpenAIFunctionsAgent, AgentExecutor } from 'langchain/agents';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';

dotenv.config();

async function compareLangchainToolSet() {
  console.log('🧪 Testing LangchainToolSet (as shown in docs)...\n');

  const llm = new ChatOpenAI({
    modelName: 'gpt-4o-mini',
    temperature: 0.1,
  });

  const toolset = new LangchainToolSet({
    apiKey: process.env.COMPOSIO_API_KEY,
  });

  try {
    const tools = await toolset.getTools({
      actions: ['LINEAR_LIST_LINEAR_ISSUES']
    });

    console.log(`📊 LangchainToolSet got ${tools.length} tools`);
    console.log('🔧 Tool details:');
    tools.forEach((tool, i) => {
      console.log(`  ${i + 1}. Name: ${tool.name}`);
      console.log(`     Description: ${tool.description}`);
      console.log(`     Type: ${tool.constructor.name}`);
      console.log(`     Has invoke: ${typeof tool.invoke === 'function'}`);
      console.log(`     Has _call: ${typeof tool._call === 'function'}`);
    });

    // Create prompt
    const prompt = ChatPromptTemplate.fromMessages([
      ["system", "You are a helpful assistant."],
      ["human", "{input}"],
      new MessagesPlaceholder("agent_scratchpad")
    ]);

    // Create agent as shown in docs
    const agent = await createOpenAIFunctionsAgent({
      llm: llm,
      tools: tools,
      prompt: prompt
    });

    const agentExecutor = new AgentExecutor({
      agent: agent,
      tools: tools,
      verbose: true,
      returnIntermediateSteps: true,
      maxIterations: 3
    });

    console.log('\n🎯 Testing LangchainToolSet agent...');
    const result = await agentExecutor.invoke({ input: "List Linear issues" });
    
    console.log('\n📋 LangchainToolSet Result:');
    console.log('- Output:', result.output);
    console.log('- Steps:', result.intermediateSteps?.length || 0);
    
    return result;

  } catch (error) {
    console.error('❌ LangchainToolSet Error:', error.message);
    return null;
  }
}

async function compareOpenAIToolSet() {
  console.log('\n🧪 Testing OpenAIToolSet (our working approach)...\n');

  const llm = new ChatOpenAI({
    modelName: 'gpt-4o-mini',
    temperature: 0.1,
  });

  const toolset = new OpenAIToolSet({
    apiKey: process.env.COMPOSIO_API_KEY,
  });

  try {
    const rawTools = await toolset.getTools({
      actions: ['LINEAR_LIST_LINEAR_ISSUES']
    });

    console.log(`📊 OpenAIToolSet got ${rawTools.length} raw tools`);
    console.log('🔧 Raw tool details:');
    rawTools.forEach((tool, i) => {
      console.log(`  ${i + 1}. Name: ${tool.function?.name}`);
      console.log(`     Type: ${tool.constructor?.name || typeof tool}`);
      console.log(`     Function: ${tool.function ? 'Yes' : 'No'}`);
    });

    // Test direct tool execution
    console.log('\n🧪 Testing direct tool execution...');
    try {
      const toolCall = {
        id: `test_${Date.now()}`,
        type: 'function',
        function: {
          name: 'LINEAR_LIST_LINEAR_ISSUES',
          arguments: '{}'
        }
      };

      const directResult = await toolset.executeToolCall(toolCall, process.env.COMPOSIO_API_KEY);
      console.log('✅ Direct execution works, data length:', JSON.stringify(directResult).length);
    } catch (err) {
      console.log('❌ Direct execution failed:', err.message);
    }

    return { rawTools };

  } catch (error) {
    console.error('❌ OpenAIToolSet Error:', error.message);
    return null;
  }
}

async function main() {
  console.log('🔍 Comparing LangchainToolSet vs OpenAIToolSet\n');
  
  // Test the documented approach
  const langchainResult = await compareLangchainToolSet();
  
  // Test our working approach 
  const openaiResult = await compareOpenAIToolSet();
  
  console.log('\n📊 COMPARISON SUMMARY:');
  console.log('- LangchainToolSet (docs):', langchainResult ? 'Works' : 'Failed');
  console.log('- OpenAIToolSet (working):', openaiResult ? 'Works' : 'Failed');
}

main().catch(console.error); 