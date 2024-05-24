import { Router } from 'express'
import { getStatus } from '../../src/controllers/status.js'
import { router } from '../../src/router.js'

vi.mock('express')

describe('routes', () => {
  beforeEach(() => {
    vi.mocked(Router).mockReturnValue({ get: vi.fn(), post: vi.fn(), use: vi.fn() } as unknown as Router)
  })

  it('should create status route', () => {
    const routes = router()
    expect(routes.get).toHaveBeenCalledWith('/status', getStatus)
  })
})
