import fetch from 'node-fetch';

async function registerAgent(agentConfig) {
  try {
    console.log(`🔄 Registering agent: ${agentConfig.name}`);
    
    const response = await fetch('http://localhost:3001/api/agents/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(agentConfig)
    });

    const result = await response.json();
    if (result.success) {
      console.log(`✅ Agent "${agentConfig.name}" registered successfully!`);
      console.log(`   ID: ${result.agent.id}`);
      console.log(`   URL: ${result.agent.url}`);
      console.log(`   Tools: ${result.agent.actions.join(', ')}`);
    } else {
      console.error(`❌ Failed to register agent "${agentConfig.name}":`, result.error);
    }
  } catch (error) {
    console.error(`❌ Error registering agent "${agentConfig.name}":`, error.message);
  }
}

async function listAgents() {
  try {
    console.log(`\n🔍 Listing all agents...`);
    
    const response = await fetch('http://localhost:3001/api/agents');
    const result = await response.json();
    
    if (result.success) {
      console.log(`\nFound ${result.agents.length} agents:`);
      result.agents.forEach(agent => {
        console.log(`  📡 ${agent.name} (${agent.id})`);
        console.log(`     App: ${agent.appName}`);
        console.log(`     Type: ${agent.type || 'dynamic'}`);
        console.log(`     Tools: ${agent.actions.join(', ')}`);
        console.log(`     URL: ${agent.url}\n`);
      });
    }
  } catch (error) {
    console.error(`❌ Error listing agents:`, error.message);
  }
}

async function main() {
  console.log('🚀 Testing Standalone Agent Registration\n');
  
  // Register a custom agent
  await registerAgent({
    id: 'my-custom-agent',
    name: 'My Custom Agent',
    description: 'A custom agent I created for special tasks',
    url: 'http://localhost:8888',
    appName: 'Custom Service',
    tools: ['do_magic', 'solve_problems', 'make_coffee']
  });

  // Register another agent
  await registerAgent({
    id: 'data-agent',
    name: 'Data Processing Agent',
    description: 'Handles data analysis and processing',
    url: 'http://localhost:7777',
    appName: 'Data Analytics',
    tools: ['analyze_data', 'generate_charts', 'export_reports']
  });

  // List all agents
  await listAgents();
  
  console.log('✅ Done! Now test in the Live API by saying:');
  console.log('   "discover agents" or "find available agents"');
  console.log('   Then try: "delegate task to my-custom-agent: make me some coffee"');
}

main().catch(console.error); 