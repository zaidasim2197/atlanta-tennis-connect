// Fallback declarations for ws in serverless compilation
declare module "ws" {
  import { Server as HttpServer } from "node:http";
  import { Server as HttpsServer } from "node:https";
  import { EventEmitter } from "node:events";

  export class WebSocket extends EventEmitter {
    static OPEN: number;
    static CLOSED: number;
    static CLOSING: number;
    static CONNECTING: number;
    readyState: number;
    send(data: any, cb?: (err?: Error) => void): void;
    close(code?: number, data?: string): void;
  }

  export interface ServerOptions {
    server?: HttpServer | HttpsServer;
    port?: number;
    path?: string;
    noServer?: boolean;
    [key: string]: any;
  }

  export class WebSocketServer extends EventEmitter {
    constructor(options?: ServerOptions, callback?: () => void);
    clients: Set<WebSocket>;
    close(cb?: (err?: Error) => void): void;
  }
}
