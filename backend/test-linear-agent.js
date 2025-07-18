import { createLinearAgent } from './LinearMeetingAgent.js';
import dotenv from 'dotenv';

dotenv.config();

async function testLinearAgentLoopPrevention() {
  console.log('🧪 Testing Linear Agent Loop Prevention');
  console.log('=====================================\n');

  try {
    console.log('📋 Creating Linear agent...');
    const agent = createLinearAgent();
    await agent.initialize();
    
    console.log('✅ Agent initialized successfully');
    
    // Test with a simple meeting summary
    const testSummary = `
**1. Key takeaways**
The team discussed creating a new feature for user authentication and updating the backend API.

**2. Action items**
- John Doe: Create a new issue for user authentication feature
- Jane Smith: Update the existing backend API issue to in-progress status
- Bob Johnson: Add comments to the frontend issue about testing requirements

**3. Small talk**
None

**4. Summary**
## Technical Issues
The team identified the need for a new authentication system and agreed to prioritize backend API updates.
`;

    console.log('📝 Testing with meeting summary...');
    console.log('Summary:', testSummary);
    
    const result = await agent.invoke(`Process this meeting summary and manage Linear issues accordingly:

MEETING SUMMARY:
${testSummary}

INSTRUCTIONS:
Follow the workflow to:
1. Get current project and team information
2. Analyze the summary for actionable items
3. Create, update, or delete Linear issues as needed
4. Provide a comprehensive summary of all actions taken

Be thorough and execute all necessary operations based on the meeting summary above.`);

    console.log('\n📥 Agent Response:');
    console.log('===================');
    console.log(result.output);
    
    console.log('\n✅ Test completed successfully!');
    console.log('The agent should have stopped after completing its tasks without infinite loops.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.message.includes('OPENAI_API_KEY')) {
      console.log('\n💡 Make sure to set your OPENAI_API_KEY environment variable');
    }
    
    if (error.message.includes('COMPOSIO_API_KEY')) {
      console.log('\n💡 Make sure to set your COMPOSIO_API_KEY environment variable');
    }
  }
}

// Run the test
testLinearAgentLoopPrevention().catch(console.error); 