import { createLinearAgent } from './LinearMeetingAgent.js';

async function testLinearAgent() {
  console.log('🧪 Testing Simple Linear Agent...\n');
  
  const agent = createLinearAgent();
  await agent.initialize();
  
  try {
    /* // Test 1: Get project setup information (new functionality)
    console.log('🔧 Test 1: Get Faktions project setup...');
    const setupResult = await agent.getProjectSetup("Faktions");
    console.log('✅ Result:', setupResult.output || 'No output');

    // Test 2: List states (new tool)
    console.log('\n📊 Test 2: List Linear states...');
    const statesResult = await agent.invoke('List all Linear states with their UUIDs using LINEAR_LIST_LINEAR_STATES');
    console.log('✅ Result:', statesResult.output || 'No output');
 */
    /* // Test 3: Create an issue with specific state
    console.log('\n➕ Test 3: Create a test issue with state...');
    const createResult = await agent.invoke('Create a Linear issue with title "Test Agent Issue" and description "Created by the agent with enhanced workflow". Use the appropriate state_id for "To Do" status.');
    console.log('✅ Result:', createResult.output || 'No output'); */

    // Test 4: Process meeting transcript with enhanced workflow  
    console.log('\n🎙️ Test 4: Process meeting transcript with enhanced workflow...');
    const transcript = `
TEAM MEETING - FAKTIONS PROJECT STATUS UPDATE

00:10 Achref: Hi everyone, let's review our Linear issues and see what needs to be updated.

00:15 Amine: Great! I completed the user authentication system yesterday, so we can mark that issue as done.

00:20 Youssef: I'm currently working on the database integration, it's in progress but not finished yet.

00:30 Achref: Perfect. We also need to add a new task for the API documentation - I forgot to create an issue for that.

00:40 Amine: And we discussed implementing the notification system, that should be a high priority issue.

00:50 Youssef: What about the old payment gateway integration? We decided not to do that anymore in the last sprint.

01:00 Achref: Good point, we can delete that issue. Also, the frontend components task should be moved to in progress since Sarah started working on it.

`;
    const transcriptResult = await agent.invoke(`Process this meeting transcript: ${transcript}`);
    console.log('✅ Result:', transcriptResult.output || 'No output');

  } catch (error) {
    console.error('🚨 Test failed:', error);
  }
}

testLinearAgent().catch(console.error); 