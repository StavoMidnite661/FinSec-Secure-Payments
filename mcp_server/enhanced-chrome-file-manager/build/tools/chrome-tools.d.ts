import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { CallToolRequest } from './types.js';
export interface ChromeToolsConfig {
    headless?: boolean;
    browserUrl?: string;
    executablePath?: string;
    viewport?: {
        width: number;
        height: number;
    };
    proxyServer?: string;
    acceptInsecureCerts?: boolean;
}
export declare class ChromeTools {
    private browser;
    private config;
    constructor(config?: ChromeToolsConfig);
    listTools(): Promise<{
        tools: Tool[];
    }>;
    callTool(name: string, args: CallToolRequest): Promise<any>;
    private getBrowser;
    private getPage;
    private navigate;
    private screenshot;
    private click;
    private fill;
    private evaluate;
    private getUrl;
    private close;
}
