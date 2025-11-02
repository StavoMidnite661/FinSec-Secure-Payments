import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { CallToolRequest, ToolResult } from './types.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as fse from 'fs-extra';
import { glob } from 'glob';
import * as mime from 'mime-types';

export interface FileSystemConfig {
  allowedPaths?: string[];
  maxFileSize?: number; // in bytes
  enableSymlinks?: boolean;
}

export class FileManagementTools {
  private config: FileSystemConfig;

  constructor(config: FileSystemConfig = {}) {
    this.config = {
      maxFileSize: 50 * 1024 * 1024, // 50MB default
      enableSymlinks: false,
      ...config,
    };
  }

  async listTools(): Promise<{ tools: Tool[] }> {
    return {
      tools: [
        {
          name: 'file_read',
          description: 'Read the contents of a file (with full path access)',
          inputSchema: {
            type: 'object',
            properties: {
              filePath: {
                type: 'string',
                description: 'Full path to the file to read',
              },
              encoding: {
                type: 'string',
                description: 'File encoding (utf8, binary, etc.)',
                default: 'utf8',
              },
            },
            required: ['filePath'],
          },
        },
        {
          name: 'file_write',
          description: 'Write content to a file (creates directories as needed)',
          inputSchema: {
            type: 'object',
            properties: {
              filePath: {
                type: 'string',
                description: 'Full path where to write the file',
              },
              content: {
                type: 'string',
                description: 'Content to write to the file',
              },
              encoding: {
                type: 'string',
                description: 'File encoding',
                default: 'utf8',
              },
              createDirs: {
                type: 'boolean',
                description: 'Create parent directories if they don\'t exist',
                default: true,
              },
            },
            required: ['filePath', 'content'],
          },
        },
        {
          name: 'file_copy',
          description: 'Copy a file or directory to a new location',
          inputSchema: {
            type: 'object',
            properties: {
              sourcePath: {
                type: 'string',
                description: 'Full path to source file/directory',
              },
              destinationPath: {
                type: 'string',
                description: 'Full path to destination',
              },
              overwrite: {
                type: 'boolean',
                description: 'Overwrite destination if it exists',
                default: false,
              },
            },
            required: ['sourcePath', 'destinationPath'],
          },
        },
        {
          name: 'file_move',
          description: 'Move or rename a file or directory',
          inputSchema: {
            type: 'object',
            properties: {
              sourcePath: {
                type: 'string',
                description: 'Full path to source file/directory',
              },
              destinationPath: {
                type: 'string',
                description: 'Full path to destination',
              },
              overwrite: {
                type: 'boolean',
                description: 'Overwrite destination if it exists',
                default: false,
              },
            },
            required: ['sourcePath', 'destinationPath'],
          },
        },
        {
          name: 'file_delete',
          description: 'Delete a file or directory',
          inputSchema: {
            type: 'object',
            properties: {
              filePath: {
                type: 'string',
                description: 'Full path to file/directory to delete',
              },
              recursive: {
                type: 'boolean',
                description: 'Delete directories recursively',
                default: false,
              },
            },
            required: ['filePath'],
          },
        },
        {
          name: 'file_list',
          description: 'List contents of a directory (with full path access)',
          inputSchema: {
            type: 'object',
            properties: {
              dirPath: {
                type: 'string',
                description: 'Full path to directory to list',
              },
              recursive: {
                type: 'boolean',
                description: 'List contents recursively',
                default: false,
              },
              pattern: {
                type: 'string',
                description: 'Glob pattern to filter files',
              },
            },
            required: ['dirPath'],
          },
        },
        {
          name: 'file_info',
          description: 'Get detailed information about a file or directory',
          inputSchema: {
            type: 'object',
            properties: {
              filePath: {
                type: 'string',
                description: 'Full path to file/directory',
              },
            },
            required: ['filePath'],
          },
        },
        {
          name: 'file_search',
          description: 'Search for files using glob patterns across the filesystem',
          inputSchema: {
            type: 'object',
            properties: {
              pattern: {
                type: 'string',
                description: 'Glob pattern to search for',
              },
              rootDir: {
                type: 'string',
                description: 'Root directory to start search from',
                default: '/',
              },
              maxResults: {
                type: 'number',
                description: 'Maximum number of results to return',
                default: 100,
              },
            },
            required: ['pattern'],
          },
        },
        {
          name: 'file_mkdir',
          description: 'Create a directory (with parent directories)',
          inputSchema: {
            type: 'object',
            properties: {
              dirPath: {
                type: 'string',
                description: 'Full path to directory to create',
              },
              recursive: {
                type: 'boolean',
                description: 'Create parent directories as needed',
                default: true,
              },
            },
            required: ['dirPath'],
          },
        },
        {
          name: 'file_watch',
          description: 'Watch a directory for file changes',
          inputSchema: {
            type: 'object',
            properties: {
              dirPath: {
                type: 'string',
                description: 'Full path to directory to watch',
              },
              pattern: {
                type: 'string',
                description: 'Glob pattern to filter watched files',
              },
            },
            required: ['dirPath'],
          },
        },
      ],
    };
  }

  async callTool(name: string, args: CallToolRequest): Promise<any> {
    switch (name) {
      case 'file_read':
        return this.readFile(args.filePath as string, args.encoding as string);
      case 'file_write':
        return this.writeFile(
          args.filePath as string,
          args.content as string,
          args.encoding as string,
          args.createDirs as boolean
        );
      case 'file_copy':
        return this.copyFile(
          args.sourcePath as string,
          args.destinationPath as string,
          args.overwrite as boolean
        );
      case 'file_move':
        return this.moveFile(
          args.sourcePath as string,
          args.destinationPath as string,
          args.overwrite as boolean
        );
      case 'file_delete':
        return this.deleteFile(args.filePath as string, args.recursive as boolean);
      case 'file_list':
        return this.listDirectory(
          args.dirPath as string,
          args.recursive as boolean,
          args.pattern as string
        );
      case 'file_info':
        return this.getFileInfo(args.filePath as string);
      case 'file_search':
        return this.searchFiles(
          args.pattern as string,
          args.rootDir as string,
          args.maxResults as number
        );
      case 'file_mkdir':
        return this.createDirectory(args.dirPath as string, args.recursive as boolean);
      case 'file_watch':
        return this.watchDirectory(args.dirPath as string, args.pattern as string);
      default:
        throw new Error(`Unknown file management tool: ${name}`);
    }
  }

  private async readFile(filePath: string, encoding: string = 'utf8'): Promise<ToolResult> {
    try {
      await this.validatePath(filePath);

      const stats = await fs.stat(filePath);
      if (!stats.isFile()) {
        throw new Error(`Path is not a file: ${filePath}`);
      }

      if (stats.size > (this.config.maxFileSize || 50 * 1024 * 1024)) {
        throw new Error(`File too large: ${stats.size} bytes (max: ${this.config.maxFileSize})`);
      }

      const content = await fs.readFile(filePath, encoding as BufferEncoding);
      const mimeType = mime.lookup(filePath) || 'text/plain';

      return {
        content: [
          {
            type: 'text',
            text: `File: ${filePath}\nSize: ${stats.size} bytes\nMIME: ${mimeType}\n\n${content}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Read file failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async writeFile(
    filePath: string,
    content: string,
    encoding: string = 'utf8',
    createDirs: boolean = true
  ): Promise<ToolResult> {
    try {
      await this.validatePath(filePath);

      if (createDirs) {
        await fs.mkdir(path.dirname(filePath), { recursive: true });
      }

      await fs.writeFile(filePath, content, encoding as BufferEncoding);

      const stats = await fs.stat(filePath);
      return {
        content: [
          {
            type: 'text',
            text: `Successfully wrote ${stats.size} bytes to: ${filePath}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Write file failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async copyFile(sourcePath: string, destinationPath: string, overwrite: boolean = false): Promise<ToolResult> {
    try {
      await this.validatePath(sourcePath);
      await this.validatePath(destinationPath);

      if (!overwrite) {
        try {
          await fs.access(destinationPath);
          throw new Error(`Destination already exists: ${destinationPath}`);
        } catch (error: any) {
          if (error.code !== 'ENOENT') {
            throw error;
          }
        }
      }

      await fse.copy(sourcePath, destinationPath);

      return {
        content: [
          {
            type: 'text',
            text: `Successfully copied: ${sourcePath} -> ${destinationPath}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Copy file failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async moveFile(sourcePath: string, destinationPath: string, overwrite: boolean = false): Promise<ToolResult> {
    try {
      await this.validatePath(sourcePath);
      await this.validatePath(destinationPath);

      if (!overwrite) {
        try {
          await fs.access(destinationPath);
          throw new Error(`Destination already exists: ${destinationPath}`);
        } catch (error: any) {
          if (error.code !== 'ENOENT') {
            throw error;
          }
        }
      }

      await fse.move(sourcePath, destinationPath);

      return {
        content: [
          {
            type: 'text',
            text: `Successfully moved: ${sourcePath} -> ${destinationPath}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Move file failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async deleteFile(filePath: string, recursive: boolean = false): Promise<ToolResult> {
    try {
      await this.validatePath(filePath);

      const stats = await fs.stat(filePath);

      if (stats.isDirectory() && !recursive) {
        throw new Error(`Cannot delete directory without recursive flag: ${filePath}`);
      }

      if (recursive && stats.isDirectory()) {
        await fse.remove(filePath);
      } else {
        await fs.unlink(filePath);
      }

      return {
        content: [
          {
            type: 'text',
            text: `Successfully deleted: ${filePath}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Delete file failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async listDirectory(dirPath: string, recursive: boolean = false, pattern?: string): Promise<ToolResult> {
    try {
      await this.validatePath(dirPath);

      const stats = await fs.stat(dirPath);
      if (!stats.isDirectory()) {
        throw new Error(`Path is not a directory: ${dirPath}`);
      }

      let results: string[] = [];

      if (recursive && pattern) {
        results = await glob(pattern, {
          cwd: dirPath,
          absolute: true,
          ignore: ['**/node_modules/**', '**/.git/**'],
        });
      } else if (pattern) {
        results = await glob(pattern, {
          cwd: dirPath,
          absolute: true,
          ignore: ['**/node_modules/**', '**/.git/**'],
        });
      } else if (recursive) {
        results = await this.listRecursive(dirPath);
      } else {
        const entries = await fs.readdir(dirPath, { withFileTypes: true });
        results = entries.map(entry => path.join(dirPath, entry.name));
      }

      const formattedResults = results.map(filePath => {
        const relativePath = path.relative(dirPath, filePath);
        return `  ${relativePath}${dirPath !== filePath ? ` (${filePath})` : ''}`;
      }).join('\n');

      return {
        content: [
          {
            type: 'text',
            text: `Directory contents of: ${dirPath}\n\n${formattedResults}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`List directory failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async getFileInfo(filePath: string): Promise<ToolResult> {
    try {
      await this.validatePath(filePath);

      const stats = await fs.stat(filePath);
      const mimeType = mime.lookup(filePath) || 'application/octet-stream';

      const info = {
        path: filePath,
        name: path.basename(filePath),
        directory: path.dirname(filePath),
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        accessed: stats.atime,
        isFile: stats.isFile(),
        isDirectory: stats.isDirectory(),
        permissions: stats.mode.toString(8),
        mimeType,
      };

      return {
        content: [
          {
            type: 'text',
            text: `File Information:\n${JSON.stringify(info, null, 2)}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Get file info failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async searchFiles(pattern: string, rootDir: string = '/', maxResults: number = 100): Promise<ToolResult> {
    try {
      await this.validatePath(rootDir);

      const results = await glob(pattern, {
        cwd: rootDir,
        absolute: true,
        ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**'],
      });

      // Apply maxResults limit manually since it's not a built-in option
      const limitedResults = results.slice(0, maxResults);

      const formattedResults = limitedResults.map((filePath, index) => {
        const relativePath = path.relative(rootDir, filePath);
        return `${index + 1}. ${relativePath}\n   ${filePath}`;
      }).join('\n\n');

      return {
        content: [
          {
            type: 'text',
            text: `Search Results (${limitedResults.length} files, ${results.length > maxResults ? 'truncated' : 'complete'}):\n\n${formattedResults}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Search files failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async createDirectory(dirPath: string, recursive: boolean = true): Promise<ToolResult> {
    try {
      await this.validatePath(dirPath);

      await fs.mkdir(dirPath, { recursive });

      return {
        content: [
          {
            type: 'text',
            text: `Successfully created directory: ${dirPath}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Create directory failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async watchDirectory(dirPath: string, pattern?: string): Promise<ToolResult> {
    try {
      await this.validatePath(dirPath);

      const stats = await fs.stat(dirPath);
      if (!stats.isDirectory()) {
        throw new Error(`Path is not a directory: ${dirPath}`);
      }

      // Note: In a real implementation, you might want to return a watcher ID
      // and provide a way to stop watching. For now, we'll just confirm the watch started.

      return {
        content: [
          {
            type: 'text',
            text: `Started watching directory: ${dirPath}${pattern ? ` (pattern: ${pattern})` : ''}\nNote: Watch functionality is simulated in this implementation.`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Watch directory failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async listRecursive(dirPath: string): Promise<string[]> {
    const results: string[] = [];

    async function traverse(currentPath: string) {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);
        results.push(fullPath);

        if (entry.isDirectory()) {
          await traverse(fullPath);
        }
      }
    }

    await traverse(dirPath);
    return results;
  }

  private async validatePath(filePath: string): Promise<void> {
    // Basic path validation - in a production system, you might want more sophisticated checks
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('Invalid file path provided');
    }

    // Prevent directory traversal attacks
    const normalizedPath = path.normalize(filePath);
    if (normalizedPath.includes('../') || normalizedPath.startsWith('../')) {
      throw new Error('Directory traversal not allowed');
    }

    // Check if path exists and is accessible
    try {
      await fs.access(path.dirname(normalizedPath));
    } catch (error) {
      // For new files, we might not be able to access the parent directory yet
      // This is OK as long as we're not trying to read from a non-existent location
    }
  }
}