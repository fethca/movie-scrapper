import { Request, Response } from 'express'
import { settings } from '../settings.js'

export function getStatus(req: Request, res: Response): void {
  req.logger.info('get_status')
  res.json(settings.metadata)
}
