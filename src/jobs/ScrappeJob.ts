import { ILogger, Logger } from '@fethcat/logger'
import {
  IMovie,
  IMovieSC,
  IRequestSC,
  ITmdb,
  Movie,
  formatNgrams,
  getMax,
  movieSchema,
  rate,
  scMovieSchema,
  slugTitle,
  tmdbSchemaFormat,
} from '@fethcat/shared'
import isEqual from 'lodash.isequal'
import uniq from 'lodash.uniq'
import { DateTime } from 'luxon'
import { getMoviesQuery } from '../helpers/graphql.js'
import { radarr, request } from '../services.js'
import { Message, settings } from '../settings.js'

const { instanceId, logs, metadata } = settings

export class ScrappeJob {
  protected logger: ILogger<Message> = Logger.create<Message>(instanceId, logs, metadata)
  private startYear
  private endYear

  constructor(startYear: number, endYear: number) {
    this.startYear = startYear
    this.endYear = endYear
  }

  async run() {
    const { success, failure } = this.logger.action('scrappe_job')
    try {
      // await wait(2000) //tsx faster than ts-node, use it when debugging
      const diff = this.endYear - this.startYear
      for (let i = 0; i <= diff; i++) {
        const year = this.endYear - i
        await this.scrappe({ startYear: year, endYear: year })
      }
      success()
    } catch (error) {
      failure(error)
    }
  }

  private async scrappe(options?: { startYear?: number; endYear?: number }) {
    this.logger.addMeta({ options })
    const { success, failure } = this.logger.action('senscritique_scrappe', { options })
    try {
      let offset = 0
      while (offset !== -1 && offset < 9999) {
        this.logger.addMeta({ offset })
        const query = getMoviesQuery({ offset, ...options })
        const { url } = settings.senscritique
        const { data } = await request<IRequestSC>(url, { method: 'POST', data: query })
        const movies = data.data.searchProductExplorer.items
        let popularity = 10000 - offset
        for (const movie of movies) {
          const parsedMovie = this.parseMovie(movie)
          if (parsedMovie) await this.processMovie(parsedMovie, popularity)
          popularity--
        }
        offset = movies.length ? offset + 100 : -1
      }
      success()
    } catch (error) {
      failure(error)
    }
  }

  parseMovie(movie: unknown) {
    const { success, failure } = this.logger.action('senscritique_parse')
    try {
      const data = scMovieSchema.parse(movie)
      success()
      return data
    } catch (error) {
      failure(error)
    }
  }

  async processMovie(movie: IMovieSC, scPopularity: number) {
    this.logger.addMeta({ title: movie.title })
    const { success, failure, skip } = this.logger.action('senscritique_process_movie')
    try {
      if (movie.stats.ratingCount < 100 && movie.stats.wishCount < 100) {
        skip('small_movie')
        return
      }

      const existingRecord = await Movie.findOne({ id: movie.id })
      const now = DateTime.now().toMillis()
      const opsDatas = { lastJobDate: now, lastUpdateDate: existingRecord?.opsDatas.lastUpdateDate || now }

      const shouldUpdate = this.shouldUpdate(existingRecord)
      if (!shouldUpdate) {
        skip('no_update_needed')
        await Movie.findOneAndUpdate({ id: movie.id }, { opsDatas }, { upsert: true })
        return
      }

      const tmdb = await this.matchTMDB(movie, existingRecord?.tmdb?.searchQuery || existingRecord?.tmdb?.tmdbId || 0)
      const body = this.formatMovie(movie, tmdb, scPopularity, existingRecord)

      if (!this.isEqual(body, existingRecord)) opsDatas.lastUpdateDate = now
      const popularity = await this.calculatePopularity(body)
      await Movie.findOneAndUpdate({ id: movie.id }, { ...body, popularity, opsDatas }, { upsert: true })
      success()
    } catch (error) {
      failure(error)
    }
  }

  shouldUpdate(existingRecord: IMovie | null): boolean {
    const { success, failure, skip } = this.logger.action('should_update')
    try {
      if (!existingRecord || settings.scrapper.force) return true
      const { lastJobDate, lastUpdateDate } = existingRecord.opsDatas
      const diffScrapper = Math.abs(DateTime.fromMillis(lastJobDate).diffNow('days').days)
      const diffUpdate = Math.abs(DateTime.fromMillis(lastUpdateDate).diffNow('days').days)
      if (diffScrapper < 3) {
        skip('recently_updated')
        return false
      }
      if (diffUpdate > 365) {
        skip('never_changed_in_a_year')
        return false
      }
      success()
      return false
    } catch (error) {
      throw failure(error)
    }
  }

  isEqual(movie: IMovie, existingRecord: IMovie | null): boolean {
    if (!existingRecord) return false
    const schema = movieSchema.omit({ providers: true, popularity: true, updatedAt: true, opsDatas: true })
    return isEqual(schema.parse(movie), schema.parse(existingRecord))
  }

  async matchTMDB(movie: IMovieSC, searchQuery: number): Promise<ITmdb> {
    const { success, failure } = this.logger.action('tmdb_match')
    try {
      let matches: ITmdb[] = []
      if (searchQuery) matches = await radarr.getTmdb(searchQuery)
      const { yearOfProduction: prodYear, originalTitle: original, title, duration, dateRelease } = movie
      const year = dateRelease?.slice(0, 4) || ''
      if (!matches.length && original) matches = await radarr.tmdbLookup(`${original} ${year}`)
      if (!matches.length && prodYear && original) matches = await radarr.tmdbLookup(`${original} ${prodYear}`)
      if (!matches.length) matches = await radarr.tmdbLookup(`${title} ${year}`)
      if (!matches.length) matches = await radarr.tmdbLookup(`${title}`)
      if (!matches.length) {
        await this.handleUnfound(movie)
        throw new Error("can't find movie")
      }

      const ratedMatches: { tmdb: ITmdb; score: number }[] = []
      for (const match of matches) {
        const { title, originalTitle, cleanTitle } = match
        const set = [title, originalTitle, cleanTitle, slugTitle(originalTitle)].filter(Boolean)

        const titleScore = rate(set, title)
        const originalTitleScore = rate(set, original)

        ratedMatches.push({ tmdb: match, score: titleScore > originalTitleScore ? originalTitleScore : titleScore })
      }

      const bestScore = ratedMatches.sort((a, b) => a.score - b.score)[0].score
      const bestMatches = ratedMatches.filter((match) => match.score === bestScore)

      let [bestMatch] = bestMatches
      if (bestMatches.length > 1) {
        const metaRated = bestMatches.map((match) => {
          let score = 0
          if (duration) score += Math.abs(match.tmdb.runtime * 60 - duration)
          const tmdbInCinemas = Number(match.tmdb.inCinemas?.slice(0, 4))
          const scDate = Number(dateRelease?.slice(0, 4) || 0)
          if (tmdbInCinemas) score += Math.abs(tmdbInCinemas - scDate)
          score += Math.abs(match.tmdb.year - scDate)
          return { ...match, score }
        })

        this.logger.info('tmdb_several_matches', { matches: metaRated })
        bestMatch = metaRated.sort((a, b) => a.score - b.score)[0]
      }

      success()
      return tmdbSchemaFormat.parse(bestMatch.tmdb)
    } catch (error) {
      throw failure(error)
    }
  }

  async handleUnfound(movie: IMovieSC) {
    const { success, failure } = this.logger.action('handle_unfound_movie')
    try {
      const now = DateTime.now().toMillis()
      const opsDatas = { lastJobDate: now, lastUpdateDate: now, unfound: true }
      const data = { id: movie.id, senscritique: { ...movie, popularity: 0 }, opsDatas }
      const body = movieSchema.parse(data)
      await Movie.findOneAndUpdate({ id: movie.id }, { ...body, opsDatas }, { upsert: true })
      success()
    } catch (error) {
      throw failure(error)
    }
  }

  formatMovie(senscritique: IMovieSC, tmdb: ITmdb, scPopularity: number, existingRecord: IMovie | null): IMovie {
    const { success, failure } = this.logger.action('format_movie')
    try {
      const videos = senscritique.medias.videos
      const search = this.formatSearch(senscritique, tmdb)
      const released = existingRecord?.released || this.isReleased(senscritique, tmdb)
      const { id } = senscritique
      const data = { id, search, released, senscritique: { ...senscritique, videos, popularity: scPopularity }, tmdb }
      const movie = movieSchema.parse(data)
      success()
      return movie
    } catch (error) {
      throw failure(error)
    }
  }

  formatSearch(senscritique: IMovieSC, tmdb: ITmdb) {
    const ngrams = []
    ngrams.push(...formatNgrams(senscritique.title))
    ngrams.push(...formatNgrams(senscritique.originalTitle))
    ngrams.push(...formatNgrams(tmdb.title))
    ngrams.push(...formatNgrams(tmdb.originalTitle))
    ngrams.push(...formatNgrams(tmdb.sortTitle))
    const search = uniq(ngrams).join(' ')
    return search
  }

  async calculatePopularity(movie: IMovie): Promise<number> {
    const { success, failure } = this.logger.action('calculate_popularity')
    try {
      const now = DateTime.now()
      const currentYear = now.year
      const { dateRelease } = movie.senscritique
      const age = currentYear - Number(dateRelease?.slice(0, 4) || 0)
      const $gte = `${currentYear - 1}-${now.toFormat('LL')}-${now.toFormat('dd')}`
      const wishMax = await getMax(Movie, 'senscritique.stats.wishCount', { 'senscritique.dateRelease': { $gte } })
      const ratingMax = await getMax(Movie, 'senscritique.stats.ratingCount')
      const tmdbPopMax = await getMax(Movie, 'tmdb.popularity')
      const { ratingCount, wishCount } = movie.senscritique.stats

      if (!wishMax || !ratingMax || !tmdbPopMax) return 0

      let ageBonus = 0
      if (age <= 1) ageBonus = (wishCount * 10) / wishMax
      const ratingScore = (ratingCount * 10) / ratingMax + ageBonus
      const tmdbScore = (movie.tmdb?.popularity || 0 * 10) / tmdbPopMax
      const scScore = (movie.senscritique.popularity * 10) / 10000
      const popularity = ratingScore + tmdbScore + scScore
      success({ popularity })
      return popularity
    } catch (error) {
      throw failure(error)
    }
  }

  isReleased(senscritique: IMovieSC, tmdb: ITmdb): boolean {
    const now = DateTime.now()
    const { digitalRelease, physicalRelease } = tmdb
    const isReleasedOnline = Boolean(digitalRelease && DateTime.fromISO(digitalRelease).toMillis() < now.toMillis())
    const isReleasedPhysic = Boolean(physicalRelease && DateTime.fromISO(physicalRelease).toMillis() < now.toMillis())
    const dateRelease = senscritique.dateRelease ? DateTime.fromISO(senscritique.dateRelease) : now
    const diff = Math.abs(dateRelease.diffNow('months').months)
    if (isReleasedOnline || isReleasedPhysic || diff > 12) return true
    return false
  }
}
