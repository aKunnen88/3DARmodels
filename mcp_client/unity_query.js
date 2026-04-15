const { Client } = require("@modelcontextprotocol/sdk/client/index.js");
const { StreamableHTTPClientTransport } = require("@modelcontextprotocol/sdk/client/streamableHttp.js");

async function callTool(client, name, args) {
  try { return await client.callTool({ name, arguments: args }); }
  catch (e) { return { error: e.message }; }
}
function getText(result) {
  if (!result || result.error) return JSON.stringify(result);
  if (result.content) return result.content.map(c => c.text || "").join("\n");
  return JSON.stringify(result);
}

async function main() {
  const transport = new StreamableHTTPClientTransport(new URL("http://127.0.0.1:8080/mcp"));
  const client = new Client({ name: "fix-client", version: "1.0.0" }, { capabilities: {} });
  await client.connect(transport);
  console.log("✅ Connected\n");

  console.log("\n=== SAVING SCENE ===");
  let r = await callTool(client, "manage_scene", { action: "save", scene_path: "Assets/Scenes/SampleScene.unity" });
  console.log(getText(r));

  process.exit(0);
}

main().catch(e => { console.error("Error:", e.message); process.exit(1); });
