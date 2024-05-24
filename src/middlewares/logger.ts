import { Logger } from '@fethcat/logger'
import { NextFunction, Request, Response } from 'express'
import { Message, settings } from '../settings.js'

const { instanceId, logs, metadata } = settings

export function logger(req: Request, res: Response, next: NextFunction): void {
  req.logger = Logger.create<Message>(instanceId, logs, { ...metadata, req })
  next()
}
