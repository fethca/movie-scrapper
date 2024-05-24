import { Logger, MockedLogger } from '@fethcat/logger'
import { logger } from '../../../src/middlewares/logger.js'
import { mockReqRes } from '../../mock.js'

vi.mock('crypto', () => ({ randomBytes: vi.fn().mockReturnValue('instanceId') }))

describe('logger', () => {
  beforeEach(() => {
    vi.spyOn(Logger, 'create').mockReturnValue(new MockedLogger())
  })

  it('should create logger', () => {
    const { req, res, next } = mockReqRes()
    logger(req, res, next)
    expect(Logger.create).toHaveBeenCalledWith(
      'instanceId',
      { silent: true },
      {
        app: 'movie-scrapper',
        env: 'test',
        port: 3000,
        version: expect.any(String),
        req,
      },
    )
  })

  it('should add logger in request', () => {
    const loggerMock = new MockedLogger()
    vi.spyOn(Logger, 'create').mockReturnValue(loggerMock)
    const { req, res, next } = mockReqRes()
    logger(req, res, next)
    expect(req.logger).toEqual(loggerMock)
  })

  it('should call next', () => {
    const { req, res, next } = mockReqRes()
    logger(req, res, next)
    expect(next).toHaveBeenCalled()
  })
})
