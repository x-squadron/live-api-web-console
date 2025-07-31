import fetch from 'node-fetch';
import fs from 'fs';
import FormData from 'form-data';

const BASE_URL = 'http://localhost:3001';

async function testTextInput() {
  console.log('\n🧪 Testing TEXT INPUT format...');
  
  const payload = {
    text: "Welcome to our standup meeting. I need to fix the authentication bug that's blocking users. Also, we should update the documentation for the new API endpoints. Please create Linear issues for these tasks.",
    enableNotifications: true
  };

  try {
    const response = await fetch(`${BASE_URL}/api/multi-swarm/process-transcript-workflow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    console.log('✅ Text input test:', result.success ? 'SUCCESS' : 'FAILED');
    console.log('Input source:', result.inputSource);
    console.log('Meeting ID:', result.meetingId);
    
    if (result.success) {
      console.log('Summary preview:', result.summary.summary.substring(0, 100) + '...');
    } else {
      console.log('Error:', result.error);
    }
  } catch (error) {
    console.error('❌ Text input test failed:', error.message);
  }
}

async function testTranscriptObject() {
  console.log('\n🧪 Testing TRANSCRIPT OBJECT format...');
  
  const payload = {
    transcript: {
      segments: [
        {
          start: 0,
          speaker: "Achref",
          text: "Welcome to our standup. I need to fix the authentication bug that's blocking users."
        },
        {
          start: 15,
          speaker: "Achref", 
          text: "I can help with that. Let's create a Linear issue to track it."
        }
      ]
    },
    enableNotifications: true
  };

  try {
    const response = await fetch(`${BASE_URL}/api/multi-swarm/process-transcript-workflow`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();
    console.log('✅ Transcript object test:', result.success ? 'SUCCESS' : 'FAILED');
    console.log('Input source:', result.inputSource);
    console.log('Meeting ID:', result.meetingId);
    
    if (result.success) {
      console.log('Summary preview:', result.summary.summary.substring(0, 100) + '...');
    } else {
      console.log('Error:', result.error);
    }
  } catch (error) {
    console.error('❌ Transcript object test failed:', error.message);
  }
}

async function testFileUpload() {
  console.log('\n🧪 Testing FILE UPLOAD format...');
  
  // Create a temporary text file
  const testContent = "This is a test meeting transcript. We discussed the new feature requirements and need to create tasks for the development team.";
  const tempFile = 'temp_test.txt';
  
  try {
    fs.writeFileSync(tempFile, testContent);
    
    const form = new FormData();
    form.append('file', fs.createReadStream(tempFile));
    form.append('enableNotifications', 'true');

    const response = await fetch(`${BASE_URL}/api/multi-swarm/process-transcript-workflow`, {
      method: 'POST',
      body: form
    });

    const result = await response.json();
    console.log('✅ File upload test:', result.success ? 'SUCCESS' : 'FAILED');
    console.log('Input source:', result.inputSource);
    console.log('Meeting ID:', result.meetingId);
    
    if (result.success) {
      console.log('Summary preview:', result.summary.summary.substring(0, 100) + '...');
    } else {
      console.log('Error:', result.error);
    }
    
    // Clean up temp file
    fs.unlinkSync(tempFile);
  } catch (error) {
    console.error('❌ File upload test failed:', error.message);
    // Clean up temp file if it exists
    if (fs.existsSync(tempFile)) {
      fs.unlinkSync(tempFile);
    }
  }
}

async function runAllTests() {
  console.log('🚀 Testing multi-format endpoint...\n');
  
  await testTextInput();
  await testTranscriptObject();
  await testFileUpload();
  
  console.log('\n✨ All tests completed!');
}

// Run tests if this file is executed directly
if (process.argv[1] && process.argv[1].includes('test-multi-format.js')) {
  runAllTests().catch(console.error);
}

export { testTextInput, testTranscriptObject, testFileUpload, runAllTests }; 