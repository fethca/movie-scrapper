import { ConfigService } from '@fethcat/config'
import { ITmdb } from '@fethcat/shared/types'
import { request } from '../services.js'
import { settings } from '../settings.js'

type Config = { formatItems: { format: number; score: number }[] }[]
const { url, key } = settings.radarr

export class RadarrService extends ConfigService<Config> {
  constructor(interval: number) {
    super(interval)
  }

  async fetch(): Promise<Config> {
    try {
      const { data } = await request<Config>(`${url}/qualityprofile`, { method: 'GET', params: { apiKey: key } })
      return data
    } catch (error) {
      throw new Error('Failed to load radarr config')
    }
  }

  async tmdbLookup(term: string) {
    const { data } = await request<ITmdb[]>(`${url}/movie/lookup`, { params: { term, apiKey: key } })
    return data
  }

  async getTmdb(tmdbId: number) {
    const { data } = await request<ITmdb>(`${url}/movie/lookup/tmdb`, { params: { tmdbId, apiKey: key } })
    return [data]
  }
}
