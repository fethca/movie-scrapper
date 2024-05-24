import { ILogger } from '@fethcat/logger'
import http from 'http'

declare module 'express-serve-static-core' {
  export interface Request extends http.IncomingMessage, Express.Request {}
}

declare global {
  namespace Express {
    interface Request {
      logger: ILogger<string>
    }
  }
}
