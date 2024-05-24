import { ILogger, Logger } from '@fethcat/logger'
import { Message, settings } from '../settings.js'
import { ScrappeJob } from './ScrappeJob.js'

const { instanceId, logs, metadata } = settings

export class MainJob {
  protected logger: ILogger<Message> = Logger.create<Message>(instanceId, logs, metadata)
  static id: NodeJS.Timeout

  async run(): Promise<void> {
    const { success, failure } = this.logger.action('main_job')
    try {
      this.stop()
      const { startYear, endYear } = settings.scrapper
      const currentYear = new Date().getFullYear()
      const start = settings.scrapper.startYear ? startYear : currentYear - 1
      const end = settings.scrapper.endYear ? endYear : currentYear
      await new ScrappeJob(start, end).run()
      MainJob.id = setTimeout(() => this.run(), settings.scrapper.interval)
      success()
    } catch (error) {
      failure(error)
      throw error
    }
  }

  stop() {
    clearTimeout(MainJob.id)
  }
}
