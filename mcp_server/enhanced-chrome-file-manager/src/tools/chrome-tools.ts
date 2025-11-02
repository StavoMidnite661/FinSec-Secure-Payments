import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { CallToolRequest, ToolResult } from './types.js';
import * as puppeteer from 'puppeteer-core';
import { Browser, Page } from 'puppeteer-core';

export interface ChromeToolsConfig {
  headless?: boolean;
  browserUrl?: string;
  executablePath?: string;
  viewport?: { width: number; height: number };
  proxyServer?: string;
  acceptInsecureCerts?: boolean;
}

export class ChromeTools {
  private browser: Browser | null = null;
  private config: ChromeToolsConfig;

  constructor(config: ChromeToolsConfig = {}) {
    this.config = {
      headless: false,
      viewport: { width: 1280, height: 720 },
      acceptInsecureCerts: false,
      ...config,
    };
  }

  async listTools(): Promise<{ tools: Tool[] }> {
    return {
      tools: [
        {
          name: 'chrome_navigate',
          description: 'Navigate to a URL in the browser',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'URL to navigate to',
              },
            },
            required: ['url'],
          },
        },
        {
          name: 'chrome_screenshot',
          description: 'Take a screenshot of the current page',
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Name for the screenshot file',
              },
              selector: {
                type: 'string',
                description: 'CSS selector for element to screenshot (optional)',
              },
              fullPage: {
                type: 'boolean',
                description: 'Take full page screenshot',
                default: false,
              },
            },
            required: ['name'],
          },
        },
        {
          name: 'chrome_click',
          description: 'Click an element on the page',
          inputSchema: {
            type: 'object',
            properties: {
              selector: {
                type: 'string',
                description: 'CSS selector for element to click',
              },
            },
            required: ['selector'],
          },
        },
        {
          name: 'chrome_fill',
          description: 'Fill out an input field',
          inputSchema: {
            type: 'object',
            properties: {
              selector: {
                type: 'string',
                description: 'CSS selector for input field',
              },
              value: {
                type: 'string',
                description: 'Value to fill',
              },
            },
            required: ['selector', 'value'],
          },
        },
        {
          name: 'chrome_evaluate',
          description: 'Execute JavaScript in the browser console',
          inputSchema: {
            type: 'object',
            properties: {
              script: {
                type: 'string',
                description: 'JavaScript code to execute',
              },
            },
            required: ['script'],
          },
        },
        {
          name: 'chrome_get_url',
          description: 'Get the current URL of the browser page',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
        {
          name: 'chrome_close',
          description: 'Close the browser instance',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ],
    };
  }

  async callTool(name: string, args: CallToolRequest): Promise<any> {
    switch (name) {
      case 'chrome_navigate':
        return this.navigate(args.url as string);
      case 'chrome_screenshot':
        return this.screenshot(
          args.name as string,
          args.selector as string,
          args.fullPage as boolean
        );
      case 'chrome_click':
        return this.click(args.selector as string);
      case 'chrome_fill':
        return this.fill(args.selector as string, args.value as string);
      case 'chrome_evaluate':
        return this.evaluate(args.script as string);
      case 'chrome_get_url':
        return this.getUrl();
      case 'chrome_close':
        return this.close();
      default:
        throw new Error(`Unknown Chrome tool: ${name}`);
    }
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser && !this.browser.isConnected()) {
      this.browser = null;
    }

    if (!this.browser) {
      if (this.config.browserUrl) {
        this.browser = await puppeteer.connect({
          browserURL: this.config.browserUrl,
        });
      } else {
        this.browser = await puppeteer.launch({
          headless: this.config.headless,
          executablePath: this.config.executablePath,
          defaultViewport: this.config.viewport,
          args: [
            ...(this.config.proxyServer ? [`--proxy-server=${this.config.proxyServer}`] : []),
            ...(this.config.acceptInsecureCerts ? ['--allow-running-insecure-content'] : []),
          ],
        });
      }
    }

    return this.browser;
  }

  private async getPage(): Promise<Page> {
    const browser = await this.getBrowser();
    const pages = await browser.pages();
    return pages[0] || await browser.newPage();
  }

  private async navigate(url: string): Promise<ToolResult> {
    try {
      const page = await this.getPage();
      await page.goto(url, { waitUntil: 'networkidle0' });
      return {
        content: [
          {
            type: 'text',
            text: `Successfully navigated to: ${url}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Navigation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async screenshot(name: string, selector?: string, fullPage?: boolean): Promise<ToolResult> {
    try {
      const page = await this.getPage();

      let screenshotBuffer: Buffer;

      if (selector) {
        const element = await page.$(selector);
        if (!element) {
          throw new Error(`Element not found: ${selector}`);
        }
        screenshotBuffer = await element.screenshot() as Buffer;
      } else {
        screenshotBuffer = await page.screenshot({
          fullPage: fullPage || false,
        }) as Buffer;
      }

      // Convert to base64 for MCP transport
      const base64Data = screenshotBuffer.toString('base64');

      return {
        content: [
          {
            type: 'image',
            data: base64Data,
            mimeType: 'image/png',
          },
          {
            type: 'text',
            text: `Screenshot saved as: ${name}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Screenshot failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async click(selector: string): Promise<ToolResult> {
    try {
      const page = await this.getPage();
      await page.click(selector);
      return {
        content: [
          {
            type: 'text',
            text: `Successfully clicked element: ${selector}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Click failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async fill(selector: string, value: string): Promise<ToolResult> {
    try {
      const page = await this.getPage();
      await page.type(selector, value);
      return {
        content: [
          {
            type: 'text',
            text: `Successfully filled element ${selector} with: ${value}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Fill failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async evaluate(script: string): Promise<ToolResult> {
    try {
      const page = await this.getPage();
      const result = await page.evaluate(script);
      return {
        content: [
          {
            type: 'text',
            text: `Script executed successfully. Result: ${JSON.stringify(result)}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Script evaluation failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async getUrl(): Promise<ToolResult> {
    try {
      const page = await this.getPage();
      const url = page.url();
      return {
        content: [
          {
            type: 'text',
            text: `Current URL: ${url}`,
          },
        ],
      };
    } catch (error) {
      throw new Error(`Get URL failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async close(): Promise<ToolResult> {
    try {
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      return {
        content: [
          {
            type: 'text',
            text: 'Browser closed successfully',
          },
        ],
      };
    } catch (error) {
      throw new Error(`Browser close failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}