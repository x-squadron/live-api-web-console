import { MultiSwarmManager } from './swarm/MultiSwarmManager.js';
import dotenv from 'dotenv';

dotenv.config();

async function testCompleteWorkflow() {
  console.log('🚀 Testing Complete Workflow: Linear → Slack Notification...\n');

  try {
    // Initialize the MultiSwarmManager
    const multiSwarmManager = new MultiSwarmManager();
    
    console.log('📊 System Status:');
    const health = multiSwarmManager.getHealth();
    console.log(`✅ Swarms: ${health.totalSwarms}, Agents: ${health.totalAgents}`);
    console.log('Available swarms:', Object.keys(health.swarms));
    console.log('');

    // Test: Simple Linear task that should automatically notify Slack
    console.log('🎯 Testing Linear Task with Automatic Slack Notification:');
    
    const simpleTask = `Create a Linear issue for implementing user authentication feature and notify the team via Slack using the communicate_with_swarm tool.
    
    
    Details:
    - Title: Implement User Authentication
    - Description: Add secure user authentication with OAuth2 support
    - Priority: High
    - Assign to: Achref Ben Yahia`;

    console.log('Sending task to project management swarm...');
    const result = await multiSwarmManager.processWithSwarm(
      'project-management', 
      simpleTask, 
      'demo_user'
    );

    if (result.success) {
      console.log('✅ Project management task completed');
      console.log('Response preview:', result.response?.slice(0, 200) + '...');
      console.log('Thread ID:', result.threadId);
    } else {
      console.log('❌ Task failed:', result.error);
    }
    console.log('');

    // Check communication history
    console.log('📜 Communication History:');
    const history = multiSwarmManager.getCommunicationHistory();
    console.log(`Total inter-swarm communications: ${history.length}`);
    if (history.length > 0) {
      console.log('Recent communications:');
      history.slice(-2).forEach((comm, idx) => {
        console.log(`  ${idx + 1}. ${comm.fromSwarmId} → ${comm.toSwarmId}: ${comm.status} (${comm.timestamp})`);
      });
    }
    console.log('');

    // Test direct Slack message
    /* console.log('💬 Testing Direct Slack Message:');
    const directSlackResult = await multiSwarmManager.processWithSwarm(
      'communication',
      'Send a message: "🎉 Demo workflow completed successfully! The multi-swarm system is working correctly."',
      'demo_user'
    );

    if (directSlackResult.success) {
      console.log('✅ Direct Slack message sent successfully');
    } else {
      console.log('❌ Slack message failed:', directSlackResult.error);
    } */

    console.log('\n🎉 Complete workflow demonstration finished!');
    console.log('Expected flow:');
    console.log('1. Linear agent creates issue');
    console.log('2. Linear agent automatically notifies communication swarm');
    console.log('3. Slack agent sends notification to channel D07T5M9JW6N');

  } catch (error) {
    console.error('❌ Workflow test failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testCompleteWorkflow(); 