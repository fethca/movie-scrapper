import { extractPackageJson } from '@fethcat/shared/helpers'
import { logsValidators, mongoValidators, validateEnv } from '@fethcat/validator'
import { randomBytes } from 'crypto'
import { bool, num, str } from 'envalid'

const { name, version } = extractPackageJson()

const env = validateEnv({
  ...mongoValidators,
  ...logsValidators,
  CORS_ORIGIN: str(),
  CRON_INTERVAL: num({ default: 3600 }),
  DB_NAME: str(),
  FORCE_JOB: bool({ default: false }),
  OPTIONS_END_YEAR: num({ default: 0 }),
  OPTIONS_START_YEAR: num({ default: 0 }),
  PORT: num({ default: 3000 }),
  RADARR_CONFIG_REFRESH_INTERVAL: num({ default: 900000 }),
  RADARR_KEY: str(),
  RADARR_URL: str(),
  SC_URL: str(),
})

const instanceId = randomBytes(16).toString('hex')

export const settings = {
  instanceId,
  metadata: { app: name, version, port: env.PORT, env: env.APP_STAGE },
  logs: {
    silent: env.LOG_SILENT,
  },
  cors: {
    origin: env.CORS_ORIGIN,
  },
  mongo: {
    dbName: env.DB_NAME,
    url: env.DB_URL,
  },
  radarr: {
    url: env.RADARR_URL,
    key: env.RADARR_KEY,
    refreshConfig: env.RADARR_CONFIG_REFRESH_INTERVAL,
  },
  scrapper: {
    startYear: env.OPTIONS_START_YEAR,
    endYear: env.OPTIONS_END_YEAR,
    force: env.FORCE_JOB,
    interval: env.CRON_INTERVAL * 1000,
  },
  senscritique: {
    url: env.SC_URL,
  },
}

const messages = [
  'calculate_popularity',
  'format_movie',
  'handle_unfound_movie',
  'init_db',
  'main_job',
  'scrappe_job',
  'senscritique_parse',
  'senscritique_process_movie',
  'senscritique_scrappe',
  'should_update',
  'start_server',
  'tmdb_match',
  'tmdb_several_matches',
] as const

export type Message = (typeof messages)[number]
