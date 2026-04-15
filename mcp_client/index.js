const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { SSEClientTransport } = require("@modelcontextprotocol/sdk/client/sse.js");

async function main() {
  const transport = new SSEClientTransport(new URL("http://127.0.0.1:8080/mcp/sse"));
  const client = new Client({ name: "cli", version: "1.0.0" }, { capabilities: {} });
  
  await client.connect(transport);
  console.log("Connected");
  
  const tools = await client.listTools();
  console.log("Tools:", JSON.stringify(tools, null, 2));

  // Also query scene resources if available
  try {
     const resources = await client.listResources();
     console.log("Resources:", JSON.stringify(resources, null, 2));
  } catch(e) {
     console.log("Failed to list resources:", e.message);
  }

  process.exit(0);
}

main().catch(console.error);
