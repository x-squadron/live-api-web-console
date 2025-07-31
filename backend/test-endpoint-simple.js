import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';

async function testEndpoint() {
  console.log('🧪 Testing the new inter-swarm endpoint...\n');

  try {
    // Test payload - simple format to test the new workflow
    const payload = {
      text: "Meeting: We need to fix the authentication bug. Achref will work on it."
    };

    console.log('📤 Sending request to /api/multi-swarm/process-transcript-workflow...');
    
    const response = await fetch(`${BASE_URL}/api/multi-swarm/process-transcript-workflow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    
    console.log('📥 Response received:');
    console.log('Status:', response.status);
    console.log('Success:', result.success);
    console.log('Full response:', JSON.stringify(result, null, 2));
    
    if (result.success) {
      console.log('✅ Endpoint working correctly!');
      console.log('Meeting ID:', result.meetingId);
      console.log('Agent Type:', result.agentType);
      console.log('Notifications:', result.notification.enabled ? 'Enabled' : 'Disabled');
      
      if (result.summary) {
        console.log('\n📋 Summary generated:', result.summary.summary.substring(0, 100) + '...');
      }
      
      if (result.swarmResult) {
        console.log('\n🤖 Swarm response:', result.swarmResult.response.substring(0, 100) + '...');
      }
    } else {
      console.log('❌ Endpoint failed:', result.error);
      if (result.details) {
        console.log('Details:', result.details);
      }
    }

  } catch (error) {
    console.error('❌ Error testing endpoint:', error.message);
  }
}

// Run the test
testEndpoint().catch(console.error); 