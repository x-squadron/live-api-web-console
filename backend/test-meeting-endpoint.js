import fetch from 'node-fetch';

const API_BASE = 'http://localhost:3001';

async function testMeetingEndpoint() {
  console.log('🧪 Testing Meeting Transcript API Endpoint');
  console.log('==========================================\n');

  // Test data - Updated to match expected format with segments array
  const testPayload = {
    meetingId: "test-meeting-123",
    transcript: {
      id: "test-meeting-123",
      platform: "test",
      native_meeting_id: "test-123",
      constructed_meeting_url: "https://test.com/meeting/123",
      status: "completed",
      start_time: "2024-01-01T10:00:00Z",
      end_time: "2024-01-01T11:00:00Z",
      segments: [
        {
          speaker: "John Doe",
          text: "We need to create a subtask to add the A2A functionality to the AI agent",
          start: 10,
          end: 15
        },
        {
          speaker: "Jane Smith", 
          text: "Let's change the status of the frontend task to In review and add a comment on it to state that the admin dashboard still needs auth logic",
          start: 16,
          end: 25
        },
        {
          speaker: "John Doe",
          text: "Update the backend folder creation issue's status to in progress and assign it to achref and set the deadline as next friday",
          start: 26,
          end: 35
        },
        {
          speaker: "Jane Smith",
          text: "We should delete the infrastructure issue as it's no longer needed",
          start: 36,
          end: 40
        },
        {
          speaker: "John Doe",
          text: "Create a new issue for VPS config - this is important for our deployment",
          start: 41,
          end: 45
        }
      ]
    }
  };

  try {
    console.log('📤 Sending request to POST /api/meeting/transcript');
    console.log('Payload:', JSON.stringify(testPayload, null, 2));
    console.log('');

    const response = await fetch(`${API_BASE}/api/meeting/transcript`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(testPayload)
    });

    console.log(`📨 Response Status: ${response.status} ${response.statusText}`);
    
    const result = await response.json();
    console.log('📥 Response Body:');
    console.log(JSON.stringify(result, null, 2));

    /* // Test validation errors
    console.log('\n🧪 Testing validation errors...');
    
    // Test missing fields
    const invalidPayload = { meetingId: "test" }; // missing transcript
    
    const invalidResponse = await fetch(`${API_BASE}/api/meeting/transcript`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invalidPayload)
    });

    console.log(`📨 Validation Test Status: ${invalidResponse.status} ${invalidResponse.statusText}`);
    const validationResult = await invalidResponse.json();
    console.log('📥 Validation Response:');
    console.log(JSON.stringify(validationResult, null, 2)); */

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Make sure the backend server is running:');
      console.log('   cd backend && npm start');
    }
  }
}

// Run the test
testMeetingEndpoint().catch(console.error); 