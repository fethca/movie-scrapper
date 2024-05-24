import { Router } from 'express'
import { getStatus } from './controllers/status.js'

export function router(): Router {
  const router = Router()

  router.get('/status', getStatus)

  return router
}
