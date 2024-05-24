import { MockedLogger, mockAction } from '@fethcat/logger'
import * as mongo from '@fethcat/shared'
import cors from 'cors'
import express, { json, urlencoded } from 'express'
import helmet from 'helmet'
import { App } from '../../src/app.js'
import { limiter } from '../../src/middlewares/limiter.js'
import { logger } from '../../src/middlewares/logger.js'
import { router } from '../../src/router.js'
import { mockExpress, mockServer } from '../mock.js'

vi.mock('helmet')
vi.mock('cors')
vi.mock('../../src/jobs/MainJob')
vi.mock('express')
vi.mock('../../src/router.js')
vi.mock('@fethcat/shared', async () => {
  const shared = await vi.importActual('@fethcat/shared')
  return { ...shared, connect: vi.fn() }
})

describe('run', () => {
  function createApp() {
    const app = new App()
    app['logger'] = new MockedLogger()
    app['initDb'] = vi.fn()
    app['startServer'] = vi.fn()
    app['exit'] = vi.fn()
    return app
  }

  beforeEach(() => {
    vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
    vi.spyOn(process, 'on')
  })

  it('should init database', async () => {
    const app = createApp()
    await app.run('dbUri')
    expect(app['initDb']).toHaveBeenCalled()
  })

  it('should register exit event', async () => {
    const app = createApp()
    await app.run('dbUri')
    expect(process.on).toHaveBeenCalledWith('SIGTERM', expect.any(Function))
  })

  it('should log success', async () => {
    const app = createApp()
    const { success } = mockAction(app['logger'])
    await app.run('dbUri')
    expect(success).toHaveBeenCalled()
  })

  it('should log failure and exit process', async () => {
    const app = createApp()
    app['initDb'] = vi.fn().mockRejectedValue(new Error('500'))
    const { failure } = mockAction(app['logger'])
    await app.run('dbUri')
    expect(failure).toHaveBeenCalledWith(new Error('500'))
    expect(process.exit).toHaveBeenCalledWith(1)
  })
})

describe('initDb', () => {
  it('should connect to database', async () => {
    const app = new App()
    await app['initDb']('dbUri')
    expect(mongo.connect).toHaveBeenCalledWith('dbUri', { dbName: 'db' })
  })

  it('should log success', async () => {
    const app = new App()
    const { success } = mockAction(app['logger'])
    await app['initDb']('dbUri')
    expect(success).toHaveBeenCalled()
  })

  it('should log failure and throw', async () => {
    vi.spyOn(mongo, 'connect').mockRejectedValue(new Error('500'))
    const app = new App()
    const { failure } = mockAction(app['logger'])
    await expect(app['initDb']('dbUri')).rejects.toThrow(new Error('500'))
    expect(failure).toHaveBeenCalledWith(new Error('500'))
  })
})

describe('startServer', () => {
  beforeEach(() => {
    vi.mocked(express).mockReturnValue(mockExpress())
  })

  it('should create express', async () => {
    const app = new App()
    await app['startServer']()
    expect(express).toHaveBeenCalled()
  })

  it('should use helmet', async () => {
    const expressMock = mockExpress()
    vi.mocked(express).mockReturnValue(expressMock)
    const app = new App()
    await app['startServer']()
    expect(expressMock.use).toHaveBeenCalledWith(helmet())
  })

  it('should use limiter', async () => {
    const expressMock = mockExpress()
    vi.mocked(express).mockReturnValue(expressMock)
    const app = new App()
    await app['startServer']()
    expect(expressMock.use).toHaveBeenCalledWith(limiter)
  })

  it('should use json parser', async () => {
    const expressMock = mockExpress()
    vi.mocked(express).mockReturnValue(expressMock)
    const app = new App()
    await app['startServer']()
    expect(expressMock.use).toHaveBeenCalledWith(json())
  })

  it('should use urlencoded parser', async () => {
    const expressMock = mockExpress()
    vi.mocked(express).mockReturnValue(expressMock)
    const app = new App()
    await app['startServer']()
    expect(expressMock.use).toHaveBeenCalledWith(urlencoded())
  })

  it('should use cors', async () => {
    const expressMock = mockExpress()
    vi.mocked(express).mockReturnValue(expressMock)
    const app = new App()
    await app['startServer']()
    expect(expressMock.use).toHaveBeenCalledWith(cors({ origin: 'settings.cors.origin' }))
  })

  it('should use logger', async () => {
    const expressMock = mockExpress()
    vi.mocked(express).mockReturnValue(expressMock)
    const app = new App()
    await app['startServer']()
    expect(expressMock.use).toHaveBeenCalledWith(logger)
  })

  it('should use router', async () => {
    const expressMock = mockExpress()
    vi.mocked(express).mockReturnValue(expressMock)
    const app = new App()
    await app['startServer']()
    expect(expressMock.use).toHaveBeenCalledWith('/api', router())
  })

  it('should listen to port', async () => {
    const expressMock = mockExpress()
    vi.mocked(express).mockReturnValue(expressMock)
    const app = new App()
    await app['startServer']()
    expect(expressMock.listen).toHaveBeenCalledWith(3000)
  })

  it('should return server', async () => {
    const serverMock = mockServer()
    const expressMock = mockExpress(serverMock)
    vi.mocked(express).mockReturnValue(expressMock)
    const app = new App()
    const server = await app['startServer']()
    expect(server).toBe(serverMock)
  })

  it('should log success', async () => {
    const app = new App()
    const { success } = mockAction(app['logger'])
    await app['startServer']()
    expect(success).toHaveBeenCalledWith()
  })

  it('should log failure and throw', async () => {
    vi.mocked(express).mockImplementation(() => {
      throw new Error('500')
    })
    const app = new App()
    const { failure } = mockAction(app['logger'])
    await expect(app['startServer']()).rejects.toThrow(new Error('500'))
    expect(failure).toHaveBeenCalledWith(new Error('500'))
  })
})

describe('exit', () => {
  it('should listen to close event', async () => {
    const server = mockServer()
    const app = new App()
    await app['exit'](server)
    expect(server.on).toHaveBeenCalledWith('close', expect.any(Function))
  })

  it('should close server', async () => {
    const server = mockServer()
    const app = new App()
    await app['exit'](server)
    expect(server.close).toHaveBeenCalled()
  })

  it('should log', async () => {
    const app = new App()
    app['logger'].info = vi.fn()
    await app['exit'](mockServer())
    expect(app['logger'].info).toHaveBeenCalledWith('app_stop')
  })
})
