import { SwarmManager, MeetingSummarizer } from './swarm/index.js';
import dotenv from 'dotenv';

dotenv.config();

console.log('🔄 Testing Fixed Swarm System...');

// Test data
const testTranscript = {
  segments: [
    {
      start: 0,
      speaker: "John",
      text: "We need to fix the login bug affecting user access. Alice, can you create a Linear issue for this?"
    },
    {
      start: 30,
      speaker: "Alice", 
      text: "Sure, I'll create a Linear issue to track the login bug fix. It should be high priority."
    },
    {
      start: 60,
      speaker: "Sarah",
      text: "Also, we should implement A2A functionality for the AI agent. Can we create a subtask for that?"
    }
  ]
};

const meetingId = "test-meeting-123";
const agentType = "linear";
const userId = "test_user";

async function testFixedSwarm() {
  try {
    console.log('\n📋 Testing Swarm Manager initialization...');
    const swarmManager = new SwarmManager();
    
    console.log('✅ Swarm Manager initialized successfully');
    
    console.log('\n📋 Testing Meeting Summarizer...');
    const meetingSummarizer = new MeetingSummarizer();
    
    console.log('✅ Meeting Summarizer initialized successfully');
    
    console.log('\n📋 Testing agent info...');
    const agentInfo = swarmManager.getAgentInfo(agentType);
    console.log('Agent info:', JSON.stringify(agentInfo, null, 2));
    
    console.log('\n📋 Testing complete workflow...');
    
    // Step 1: Process transcript with summarizer
    console.log('Step 1: Processing transcript with summarizer...');
    const summaryResult = await meetingSummarizer.processCompleteWorkflow(testTranscript, meetingId);
    
    if (!summaryResult.success) {
      console.error('❌ Summary failed:', summaryResult.error);
      return;
    }
    
    console.log('✅ Summary completed');
    console.log('Summary length:', summaryResult.summary.length);
    console.log('Action items length:', summaryResult.actionItems?.length || 0);
    
    // Step 2: Send to Linear agent
    console.log('\nStep 2: Sending to Linear agent...');
    const agentPrompt = `
Based on this meeting analysis, please create appropriate tasks/issues:

MEETING ID: ${meetingId}

MEETING SUMMARY:
${summaryResult.summary}

EXTRACTED ACTION ITEMS:
${summaryResult.actionItems || 'No specific action items extracted'}

Instructions:
1. Create tasks/issues for each actionable item
2. Use appropriate titles, descriptions, and priorities
3. Include meeting context and relevant quotes
4. Set proper assignees if mentioned
5. Apply relevant labels/tags (e.g., "meeting", "action-item")

Please process these items and create the appropriate tasks/issues.
`;

    const swarmResult = await swarmManager.routeRequest(agentType, agentPrompt, userId);
    
    if (swarmResult.success) {
      console.log('✅ Linear agent processing completed successfully');
      console.log('Response length:', swarmResult.result.response.length);
      console.log('Tool calls made:', swarmResult.result.toolCalls);
      console.log('Messages exchanged:', swarmResult.result.messages.length);
    } else {
      console.error('❌ Linear agent processing failed:', swarmResult.error);
    }
    
    console.log('\n🎉 Test completed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testFixedSwarm(); 