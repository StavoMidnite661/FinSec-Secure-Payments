#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { z } from 'zod';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';

// Import our tool implementations
import { ChromeTools } from './tools/chrome-tools.js';
import { FileManagementTools } from './tools/file-management-tools.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class EnhancedChromeFileManagerServer {
  private server: Server;
  private chromeTools: ChromeTools;
  private fileTools: FileManagementTools;

  constructor() {
    this.server = new Server(
      {
        name: 'enhanced-chrome-file-manager',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.chromeTools = new ChromeTools();
    this.fileTools = new FileManagementTools();

    this.setupHandlers();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      const chromeToolsList = await this.chromeTools.listTools();
      const fileToolsList = await this.fileTools.listTools();

      return {
        tools: [
          ...chromeToolsList.tools,
          ...fileToolsList.tools,
        ],
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args = {} } = request.params;

      try {
        // Route to appropriate tool handler
        let result: any;
        if (name.startsWith('chrome_')) {
          result = await this.chromeTools.callTool(name, args as any);
        } else if (name.startsWith('file_')) {
          result = await this.fileTools.callTool(name, args as any);
        } else {
          throw new McpError(
            ErrorCode.MethodNotFound,
            `Unknown tool: ${name}`
          );
        }

        // Return in the format expected by MCP SDK
        return result;
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });

    // List available resources
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      return {
        resources: [
          {
            uri: 'file:///system-info',
            name: 'System Information',
            description: 'Current system and environment information',
            mimeType: 'application/json',
          },
        ],
      };
    });

    // Handle resource reads
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const { uri } = request.params;

      if (uri === 'file:///system-info') {
        const systemInfo = {
          platform: process.platform,
          nodeVersion: process.version,
          cwd: process.cwd(),
          pid: process.pid,
          memory: process.memoryUsage(),
          uptime: process.uptime(),
        };

        return {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(systemInfo, null, 2),
            },
          ],
        };
      }

      throw new McpError(ErrorCode.InvalidRequest, `Unknown resource: ${uri}`);
    });

    // Handle server lifecycle
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Enhanced Chrome File Manager MCP server running on stdio');
  }
}

// Start the server
const server = new EnhancedChromeFileManagerServer();
server.run().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});