import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables
dotenv.config();

const BASE_URL = 'http://localhost:3001';

async function testSwarmService() {
  console.log('🔄 Testing Swarm Service...\n');
  
  try {
    // Test 1: Check swarm health
    console.log('1. Testing swarm health...');
    const healthResponse = await fetch(`${BASE_URL}/api/swarm/health`);
    const healthData = await healthResponse.json();
    
    if (healthData.success) {
      console.log('✅ Swarm health check passed');
      console.log(`   - Total agents: ${healthData.totalAgents}`);
      console.log(`   - Available agents: ${healthData.availableAgents.join(', ')}`);
    } else {
      console.log('❌ Swarm health check failed:', healthData.error);
      return;
    }
    
    // Test 2: Get all agents
    console.log('\n2. Testing get all agents...');
    const agentsResponse = await fetch(`${BASE_URL}/api/swarm/agents`);
    const agentsData = await agentsResponse.json();
    
    if (agentsData.success) {
      console.log('✅ Get all agents passed');
      console.log(`   - Available agents: ${agentsData.availableAgents.join(', ')}`);
      Object.keys(agentsData.agents).forEach(agentType => {
        const agent = agentsData.agents[agentType];
        console.log(`   - ${agentType}: ${agent.tools.length} tools`);
      });
    } else {
      console.log('❌ Get all agents failed:', agentsData.error);
    }
    
    // Test 3: Get specific agent info (Linear)
    console.log('\n3. Testing get Linear agent info...');
    const linearInfoResponse = await fetch(`${BASE_URL}/api/swarm/agents/linear`);
    const linearInfoData = await linearInfoResponse.json();
    
    if (linearInfoData.success) {
      console.log('✅ Get Linear agent info passed');
      console.log(`   - Agent type: ${linearInfoData.agent.agentType}`);
      console.log(`   - Tools: ${linearInfoData.agent.tools.length}`);
      console.log(`   - Status: ${linearInfoData.agent.status}`);
    } else {
      console.log('❌ Get Linear agent info failed:', linearInfoData.error);
    }
    
    // Test 4: Get specific agent info (ClickUp)
    console.log('\n4. Testing get ClickUp agent info...');
    const clickupInfoResponse = await fetch(`${BASE_URL}/api/swarm/agents/clickup`);
    const clickupInfoData = await clickupInfoResponse.json();
    
    if (clickupInfoData.success) {
      console.log('✅ Get ClickUp agent info passed');
      console.log(`   - Agent type: ${clickupInfoData.agent.agentType}`);
      console.log(`   - Tools: ${clickupInfoData.agent.tools.length}`);
      console.log(`   - Status: ${clickupInfoData.agent.status}`);
    } else {
      console.log('❌ Get ClickUp agent info failed:', clickupInfoData.error);
    }
    
    // Test 5: Process simple request with Linear agent
    console.log('\n5. Testing Linear agent processing...');
    const linearRequest = {
      request: 'List available Linear tools and their descriptions',
      meetingId: null
    };
    
    const linearProcessResponse = await fetch(`${BASE_URL}/api/swarm/agents/linear/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(linearRequest)
    });
    
    const linearProcessData = await linearProcessResponse.json();
    
    if (linearProcessData.success) {
      console.log('✅ Linear agent processing passed');
      console.log(`   - Agent type: ${linearProcessData.agentType}`);
      console.log(`   - Tool calls: ${linearProcessData.result.toolCalls || 0}`);
      console.log(`   - Response length: ${linearProcessData.result.response?.length || 0} characters`);
    } else {
      console.log('❌ Linear agent processing failed:', linearProcessData.error);
    }
    
    // Test 6: Process simple request with ClickUp agent
    console.log('\n6. Testing ClickUp agent processing...');
    const clickupRequest = {
      request: 'List available ClickUp tools and their descriptions',
      meetingId: null
    };
    
    const clickupProcessResponse = await fetch(`${BASE_URL}/api/swarm/agents/clickup/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(clickupRequest)
    });
    
    const clickupProcessData = await clickupProcessResponse.json();
    
    if (clickupProcessData.success) {
      console.log('✅ ClickUp agent processing passed');
      console.log(`   - Agent type: ${clickupProcessData.agentType}`);
      console.log(`   - Tool calls: ${clickupProcessData.result.toolCalls || 0}`);
      console.log(`   - Response length: ${clickupProcessData.result.response?.length || 0} characters`);
    } else {
      console.log('❌ ClickUp agent processing failed:', clickupProcessData.error);
    }
    
    // Test 7: Test invalid agent type
    console.log('\n7. Testing invalid agent type...');
    const invalidAgentResponse = await fetch(`${BASE_URL}/api/swarm/agents/invalid`);
    const invalidAgentData = await invalidAgentResponse.json();
    
    if (!invalidAgentData.success && invalidAgentResponse.status === 404) {
      console.log('✅ Invalid agent type handling passed');
      console.log(`   - Error message: ${invalidAgentData.error}`);
    } else {
      console.log('❌ Invalid agent type handling failed');
    }
    
    console.log('\n🎉 Swarm service testing completed!');
    
  } catch (error) {
    console.error('❌ Error during swarm testing:', error);
  }
}

// Mock transcript for testing
const mockTranscript = {
  segments: [
    {
      start: 0,
      end: 10,
      text: "Let's create a new Linear issue for the authentication bug",
      speaker: "John"
    },
    {
      start: 10,
      end: 20,
      text: "We should also create a ClickUp task for the UI improvements",
      speaker: "Sarah"
    },
    {
      start: 20,
      end: 30,
      text: "I'll assign the authentication issue to the backend team",
      speaker: "John"
    }
  ]
};

async function testMeetingTranscript() {
  console.log('\n🔄 Testing Meeting Transcript Processing...\n');
  
  try {
    // Test Linear agent with meeting transcript
    console.log('1. Testing Linear agent with meeting transcript...');
    const linearTranscriptResponse = await fetch(`${BASE_URL}/api/swarm/agents/linear/process-transcript`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        transcript: mockTranscript,
        meetingId: 'test-meeting-001'
      })
    });
    
    const linearTranscriptData = await linearTranscriptResponse.json();
    
    if (linearTranscriptData.success) {
      console.log('✅ Linear meeting transcript processing passed');
      console.log(`   - Meeting ID: ${linearTranscriptData.meetingId}`);
      console.log(`   - Agent type: ${linearTranscriptData.agentType}`);
    } else {
      console.log('❌ Linear meeting transcript processing failed:', linearTranscriptData.error);
    }
    
    // Test ClickUp agent with meeting transcript
    console.log('\n2. Testing ClickUp agent with meeting transcript...');
    const clickupTranscriptResponse = await fetch(`${BASE_URL}/api/swarm/agents/clickup/process-transcript`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        transcript: mockTranscript,
        meetingId: 'test-meeting-002'
      })
    });
    
    const clickupTranscriptData = await clickupTranscriptResponse.json();
    
    if (clickupTranscriptData.success) {
      console.log('✅ ClickUp meeting transcript processing passed');
      console.log(`   - Meeting ID: ${clickupTranscriptData.meetingId}`);
      console.log(`   - Agent type: ${clickupTranscriptData.agentType}`);
    } else {
      console.log('❌ ClickUp meeting transcript processing failed:', clickupTranscriptData.error);
    }
    
    console.log('\n🎉 Meeting transcript testing completed!');
    
  } catch (error) {
    console.error('❌ Error during meeting transcript testing:', error);
  }
}

// Run tests
async function runAllTests() {
  console.log('🚀 Starting comprehensive swarm testing...\n');
  
  // Check environment variables
  console.log('Checking environment...');
  const requiredEnvVars = ['OPENAI_API_KEY', 'COMPOSIO_API_KEY'];
  const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);
  
  if (missingEnvVars.length > 0) {
    console.log(`⚠️  Missing environment variables: ${missingEnvVars.join(', ')}`);
    console.log('   Some tests may fail without proper API keys');
  } else {
    console.log('✅ Environment variables are set');
  }
  
  // Check if server is running
  try {
    console.log('Checking if server is running...');
    const response = await fetch(`${BASE_URL}/health`);
    if (!response.ok) {
      throw new Error(`Server responded with status ${response.status}`);
    }
    console.log('✅ Server is running!\n');
  } catch (error) {
    console.error('❌ Server is not running or not accessible!');
    console.error(`   Error: ${error.message}`);
    console.error(`   Please start the server first with: npm start`);
    console.error(`   Or: node server.js`);
    console.error(`   Or: node start-and-test.js (to auto-start server and run tests)`);
    process.exit(1);
  }
  
  // Wait a bit for server to be ready
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  await testSwarmService();
  await testMeetingTranscript();
  
  console.log('\n✅ All tests completed!');
}

// Execute if run directly
runAllTests(); 