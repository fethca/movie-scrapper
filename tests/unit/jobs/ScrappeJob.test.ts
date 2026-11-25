import { MockedLogger } from '@fethcat/logger'
import { getMax } from '@fethcat/shared/helpers'
import { IMovie } from '@fethcat/shared/types'
import { DateTime } from 'luxon'
import mockdate from 'mockdate'
import { ScrappeJob } from '../../../src/jobs/ScrappeJob.js'
import { settings } from '../../../src/settings.js'

mockdate.set(1779611588000) //2026

vi.mock('@fethcat/shared/helpers', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@fethcat/shared/helpers')>()),
  getMax: vi.fn(),
}))

function createJob() {
  const job = new ScrappeJob(2020, 2024)
  job['logger'] = new MockedLogger()
  return job
}

function daysAgo(days: number) {
  return DateTime.now().minus({ days }).toMillis()
}

function record(lastJobDays: number, lastUpdateDays: number) {
  return { opsDatas: { lastJobDate: daysAgo(lastJobDays), lastUpdateDate: daysAgo(lastUpdateDays) } } as IMovie
}

describe('shouldUpdate', () => {
  const force = settings.scrapper.force
  beforeEach(() => {
    settings.scrapper.force = false
  })
  afterAll(() => {
    settings.scrapper.force = force
  })

  it('should return true when there is no existing record', () => {
    expect(createJob().shouldUpdate(null)).toBe(true)
  })

  it('should return true when force is set', () => {
    settings.scrapper.force = true
    expect(createJob().shouldUpdate(record(0, 0))).toBe(true)
  })

  it('should return false when the movie was scrapped less than 3 days ago', () => {
    expect(createJob().shouldUpdate(record(1, 10))).toBe(false)
  })

  it('should return false when the movie has not changed in over a year', () => {
    expect(createJob().shouldUpdate(record(10, 400))).toBe(false)
  })

  it('should return true when all checks pass', () => {
    expect(createJob().shouldUpdate(record(10, 10))).toBe(true)
  })
})

describe('calculatePopularity', () => {
  function movie(tmdbPopularity?: number) {
    return {
      senscritique: { dateRelease: '2000-01-01', popularity: 0, stats: { ratingCount: 0, wishCount: 0 } },
      tmdb: tmdbPopularity === undefined ? undefined : { popularity: tmdbPopularity },
    } as unknown as IMovie
  }

  beforeEach(() => {
    vi.mocked(getMax).mockResolvedValue(100)
  })

  it('should scale tmdb popularity to a 0-10 score', async () => {
    expect(await createJob().calculatePopularity(movie(100))).toBe(10)
    expect(await createJob().calculatePopularity(movie(50))).toBe(5)
  })

  it('should count a missing tmdb popularity as 0', async () => {
    expect(await createJob().calculatePopularity(movie())).toBe(0)
  })

  it('should return 0 when a max is missing', async () => {
    vi.mocked(getMax).mockResolvedValue(0)
    expect(await createJob().calculatePopularity(movie(100))).toBe(0)
  })
})
