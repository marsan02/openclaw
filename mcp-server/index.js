#!/usr/bin/env node
/**
 * Marketplace MCP Server
 * Dynamically loads tools from apps that have mcp.json definitions
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const REGISTRY_PATH = path.join(__dirname, '..', 'registry.json');
const APPS_DIR = path.join(__dirname, '..', 'apps');
const BASE_URL = process.env.MARKETPLACE_URL || 'https://openclaw-dln66gtk6q-ew.a.run.app';

// Load all tools from apps with mcp.json
function loadTools() {
  const tools = [];
  const toolMap = new Map(); // tool name -> { app, endpoint, method }

  let registry;
  try {
    registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf-8'));
  } catch (err) {
    console.error('Failed to load registry.json:', err.message);
    return { tools, toolMap };
  }

  for (const app of registry.apps) {
    const mcpPath = path.join(APPS_DIR, app.id, 'mcp.json');
    
    if (!fs.existsSync(mcpPath)) continue;

    let mcpConfig;
    try {
      mcpConfig = JSON.parse(fs.readFileSync(mcpPath, 'utf-8'));
    } catch (err) {
      console.error(`Failed to load ${mcpPath}:`, err.message);
      continue;
    }

    for (const tool of mcpConfig.tools || []) {
      const fullName = `${app.id.replace(/-/g, '_')}_${tool.name}`;
      
      // Build MCP tool schema
      const mcpTool = {
        name: fullName,
        description: `[${app.name}] ${tool.description}`,
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      };

      // Add parameters to schema
      if (tool.parameters) {
        for (const [paramName, paramDef] of Object.entries(tool.parameters)) {
          const isRequired = typeof paramDef === 'object' ? paramDef.required !== false : true;
          const paramType = typeof paramDef === 'object' ? paramDef.type : paramDef;
          const paramDesc = typeof paramDef === 'object' ? paramDef.description : undefined;

          mcpTool.inputSchema.properties[paramName] = {
            type: paramType || 'string',
            ...(paramDesc && { description: paramDesc })
          };

          if (isRequired && !tool.endpoint.includes(`{${paramName}}`)) {
            // Path params are implicitly required, only add body params to required[]
          }
          if (isRequired) {
            mcpTool.inputSchema.required.push(paramName);
          }
        }
      }

      tools.push(mcpTool);
      
      // Parse endpoint (e.g., "GET /lists" or "POST /lists/{listId}/items")
      const [method, endpointPath] = tool.endpoint.split(' ');
      // Derive apiBase from app id (e.g., "shopping-list" -> "/api/shopping-list")
      const apiBase = `/api/${app.id}`;
      toolMap.set(fullName, {
        app: app.id,
        apiBase,
        method: method.toUpperCase(),
        path: endpointPath,
        parameters: tool.parameters || {}
      });
    }
  }

  return { tools, toolMap };
}

// Execute a tool call
async function executeTool(toolName, args, toolMap) {
  const toolDef = toolMap.get(toolName);
  if (!toolDef) {
    throw new Error(`Unknown tool: ${toolName}`);
  }

  // Build URL with path parameters substituted
  let urlPath = toolDef.path;
  const bodyParams = { ...args };

  for (const [paramName, value] of Object.entries(args)) {
    if (urlPath.includes(`{${paramName}}`)) {
      urlPath = urlPath.replace(`{${paramName}}`, encodeURIComponent(value));
      delete bodyParams[paramName];
    }
  }

  const fullUrl = `${BASE_URL}${toolDef.apiBase}${urlPath}`;
  
  const fetchOptions = {
    method: toolDef.method,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  // Add body for POST/PATCH/PUT
  if (['POST', 'PATCH', 'PUT'].includes(toolDef.method) && Object.keys(bodyParams).length > 0) {
    fetchOptions.body = JSON.stringify(bodyParams);
  }

  // Add query params for GET/DELETE with remaining params
  if (['GET', 'DELETE'].includes(toolDef.method) && Object.keys(bodyParams).length > 0) {
    const queryString = new URLSearchParams(bodyParams).toString();
    fullUrl += (fullUrl.includes('?') ? '&' : '?') + queryString;
  }

  const response = await fetch(fullUrl, fetchOptions);
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || `HTTP ${response.status}`);
  }

  return data;
}

// MCP JSON-RPC handler
async function handleRequest(request, tools, toolMap) {
  const { method, params, id } = request;

  switch (method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: 'marketplace-mcp',
            version: '1.0.0'
          }
        }
      };

    case 'notifications/initialized':
      // No response needed for notifications
      return null;

    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          tools
        }
      };

    case 'tools/call': {
      const { name, arguments: args } = params;
      try {
        const result = await executeTool(name, args || {}, toolMap);
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: JSON.stringify(result, null, 2)
              }
            ]
          }
        };
      } catch (err) {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [
              {
                type: 'text',
                text: `Error: ${err.message}`
              }
            ],
            isError: true
          }
        };
      }
    }

    default:
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: `Method not found: ${method}`
        }
      };
  }
}

// Main: stdio JSON-RPC loop
async function main() {
  const { tools, toolMap } = loadTools();
  
  console.error(`[marketplace-mcp] Loaded ${tools.length} tools from ${toolMap.size > 0 ? [...new Set([...toolMap.values()].map(t => t.app))].join(', ') : 'no apps'}`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  rl.on('line', async (line) => {
    if (!line.trim()) return;

    try {
      const request = JSON.parse(line);
      const response = await handleRequest(request, tools, toolMap);
      
      if (response) {
        console.log(JSON.stringify(response));
      }
    } catch (err) {
      console.error('[marketplace-mcp] Parse error:', err.message);
      console.log(JSON.stringify({
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700,
          message: 'Parse error'
        }
      }));
    }
  });

  rl.on('close', () => {
    process.exit(0);
  });
}

main();
