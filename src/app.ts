import { Logger } from '@fethcat/logger'
import { connect } from '@fethcat/shared'
import cors from 'cors'
import express, { json, urlencoded } from 'express'
import helmet from 'helmet'
import { Server } from 'http'
import { MainJob } from './jobs/MainJob.js'
import { limiter } from './middlewares/limiter.js'
import { logger } from './middlewares/logger.js'
import { router } from './router.js'
import { Message, settings } from './settings.js'

const { instanceId, logs, metadata } = settings

export class App {
  protected logger = Logger.create<Message>(instanceId, logs, metadata)

  async run(dbUri: string): Promise<void> {
    const { success, failure } = this.logger.action('app_start')
    try {
      await this.initDb(dbUri)
      const server = await this.startServer()
      void new MainJob().run()
      process.on('SIGTERM', this.exit.bind(this, server))
      success()
    } catch (error) {
      failure(error)
      process.exit(1)
    }
  }

  private async initDb(dbUri: string) {
    const { success, failure } = this.logger.action('init_db')
    try {
      await connect(dbUri, { dbName: settings.mongo.dbName })
      success()
    } catch (error) {
      failure(error)
      throw error
    }
  }

  private async startServer() {
    const { success, failure } = this.logger.action('start_server')
    try {
      const app = express()
      app.use(helmet())
      app.use(limiter)
      app.use(json())
      app.use(urlencoded({ extended: true }))
      app.use(cors({ origin: settings.cors.origin }))
      app.use(logger)
      app.use('/api', router())
      const server = app.listen(metadata.port)
      await new Promise<void>((resolve) => server.on('listening', resolve))
      success()
      return server
    } catch (error) {
      throw failure(error)
    }
  }

  private async exit(server: Server) {
    await new Promise((resolve) => {
      server.on('close', resolve)
      server.close()
    })
    this.logger.info('app_stop')
  }
}
