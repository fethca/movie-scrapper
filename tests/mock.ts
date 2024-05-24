import { MockedLogger } from '@fethcat/logger'
import { Express, NextFunction, Request, Response } from 'express'
import { Server } from 'http'

export function mockServer() {
  return {
    on: vi.fn().mockImplementation((_, fn) => fn()),
    close: vi.fn(),
  } as unknown as Server
}

export function mockExpress(server?: unknown) {
  return {
    get: vi.fn(),
    use: vi.fn(),
    listen: vi.fn().mockReturnValue(server || mockServer()),
    options: vi.fn(),
    json: vi.fn(),
    urlencoded: vi.fn(),
  } as unknown as Express
}

export function mockReqRes(request?: Request): { req: Request; res: Response; next: NextFunction } {
  const req = { ...request } as unknown as Request
  const res = { json: vi.fn() } as unknown as Response
  req.logger = new MockedLogger()
  const next = vi.fn()
  return { req, res, next }
}
