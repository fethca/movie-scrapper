import { MockedLogger, mockAction } from '@fethcat/logger'
import mockdate from 'mockdate'
import { MainJob } from '../../../src/jobs/MainJob.js'
import { ScrappeJob } from '../../../src/jobs/ScrappeJob.js'

mockdate.set(1779611588000) //2026
vi.mock('../../../src/jobs/ScrappeJob.js')

describe('run', () => {
  function createJob() {
    const job = new MainJob()
    job['stop'] = vi.fn()
    job['logger'] = new MockedLogger()
    return job
  }

  it('should run scrappe job between given dates', async () => {
    const job = createJob()
    await job.run()
    expect(ScrappeJob.prototype.run).toHaveBeenCalledWith()
  })

  it('should log success', async () => {
    const job = createJob()
    const { success } = mockAction(job['logger'])
    await job.run()
    expect(success).toHaveBeenCalledWith()
  })

  it('should log failure and throw', async () => {
    vi.spyOn(ScrappeJob.prototype, 'run').mockRejectedValue(new Error('500'))
    const job = createJob()
    const { failure } = mockAction(job['logger'])
    await expect(job.run()).rejects.toThrow(new Error('500'))
    expect(failure).toHaveBeenCalledWith(new Error('500'))
  })
})
