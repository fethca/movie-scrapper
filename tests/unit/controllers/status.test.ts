import { getStatus } from '../../../src/controllers/status.js'
import { mockReqRes } from '../../mock.js'

describe('getStatus', () => {
  it('should return app name and version', () => {
    const { req, res } = mockReqRes()
    getStatus(req, res)
    expect(res.json).toHaveBeenCalledWith({
      app: 'movie-scrapper',
      env: 'test',
      port: 3000,
      version: expect.any(String),
    })
  })
})
