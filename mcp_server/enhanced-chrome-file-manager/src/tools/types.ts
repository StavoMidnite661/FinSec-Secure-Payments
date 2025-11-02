export interface CallToolRequest {
  [key: string]: any;
}

export interface ToolResult {
  content: Array<{
    type: string;
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
}

// MCP SDK expects this format for tool call results
export interface MCPToolResult {
  content: Array<{
    type: string;
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  _meta?: { [key: string]: unknown };
}

export interface FileSystemEntry {
  name: string;
  path: string;
  type: 'file' | 'directory';
  size?: number;
  modified?: Date;
  mimeType?: string;
}

export interface FileSearchResult {
  matches: FileSystemEntry[];
  totalCount: number;
  searchTime: number;
}

export interface WatchEvent {
  type: 'created' | 'modified' | 'deleted';
  filePath: string;
  stats?: any;
}