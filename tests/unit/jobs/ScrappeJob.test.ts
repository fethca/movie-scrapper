import { MockedLogger } from '@fethcat/logger'
import { getMax } from '@fethcat/shared/helpers'
import { Movie } from '@fethcat/shared/mongo'
import { IMovie, IMovieSC, ITmdb } from '@fethcat/shared/types'
import { DateTime } from 'luxon'
import mockdate from 'mockdate'
import { ScrappeJob } from '../../../src/jobs/ScrappeJob.js'
import { radarr } from '../../../src/services.js'
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

describe('processMovie', () => {
  const scMovie = { id: 1, title: 'Unfound', stats: { ratingCount: 500, wishCount: 500 } } as IMovieSC
  const force = settings.scrapper.force
  beforeEach(() => {
    settings.scrapper.force = false
  })
  afterAll(() => {
    settings.scrapper.force = force
  })

  it('should only touch lastJobDate when no update is needed so the unfound flag is kept', async () => {
    const existingRecord = { id: 1, opsDatas: { lastJobDate: daysAgo(1), lastUpdateDate: daysAgo(10), unfound: true } }
    vi.spyOn(Movie, 'findOne').mockResolvedValue(existingRecord)
    const updateOne = vi.spyOn(Movie, 'updateOne').mockResolvedValue({} as never)

    await createJob().processMovie(scMovie, 0)

    expect(updateOne).toHaveBeenCalledWith({ id: 1 }, { 'opsDatas.lastJobDate': DateTime.now().toMillis() })
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

describe('matchTMDB', () => {
  const scMovie = { id: 1, title: 'Inside Men', originalTitle: 'Nae-bu-ja-deul', yearOfProduction: 2015 } as IMovieSC
  const radarrMovie = {
    genres: [],
    images: [],
    originalLanguage: { id: 1, name: 'Korean' },
    popularity: 1,
    ratings: {},
    runtime: 130,
    sortTitle: '',
    searchQuery: 0,
    studio: '',
    year: 2015,
  }
  const insideOut = { ...radarrMovie, title: 'Inside Out', originalTitle: 'Inside Out', cleanTitle: '', tmdbId: 1 }
  const insideMen = { ...radarrMovie, title: 'Inside Men', originalTitle: 'Nae-bu-ja-deul', cleanTitle: '', tmdbId: 2 }

  it('should trust a manual searchQuery and keep it', async () => {
    vi.spyOn(radarr, 'getTmdb').mockResolvedValue([insideOut])
    const tmdb = await createJob().matchTMDB(scMovie, { tmdbId: 1, searchQuery: 1 } as ITmdb)
    expect(tmdb).toEqual(expect.objectContaining({ tmdbId: 1, searchQuery: 1 }))
  })

  it('should replace a previous wrong match with a lookup', async () => {
    vi.spyOn(radarr, 'getTmdb').mockResolvedValue([insideOut])
    vi.spyOn(radarr, 'tmdbLookup').mockResolvedValue([insideOut, insideMen])
    const tmdb = await createJob().matchTMDB(scMovie, { tmdbId: 1, searchQuery: 0 } as ITmdb)
    expect(tmdb.tmdbId).toBe(2)
  })

  it('should flag the movie as unfound when no candidate matches', async () => {
    vi.spyOn(radarr, 'tmdbLookup').mockResolvedValue([insideOut])
    vi.spyOn(Movie, 'findOneAndUpdate').mockResolvedValue(null)
    const job = createJob()
    const handleUnfound = vi.spyOn(job, 'handleUnfound').mockResolvedValue()
    await expect(job.matchTMDB(scMovie)).rejects.toThrow("can't find movie")
    expect(handleUnfound).toHaveBeenCalledWith(scMovie)
  })
})
