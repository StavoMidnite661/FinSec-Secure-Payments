import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { CallToolRequest } from './types.js';
export interface FileSystemConfig {
    allowedPaths?: string[];
    maxFileSize?: number;
    enableSymlinks?: boolean;
}
export declare class FileManagementTools {
    private config;
    constructor(config?: FileSystemConfig);
    listTools(): Promise<{
        tools: Tool[];
    }>;
    callTool(name: string, args: CallToolRequest): Promise<any>;
    private readFile;
    private writeFile;
    private copyFile;
    private moveFile;
    private deleteFile;
    private listDirectory;
    private getFileInfo;
    private searchFiles;
    private createDirectory;
    private watchDirectory;
    private listRecursive;
    private validatePath;
}
