import { IMovieSC, ITmdb } from '@fethcat/shared/types'
import { distance } from 'fastest-levenshtein'

const versions = ['longue', 'integrale', 'restauree', 'couleur', 'noir (et|&) blanc', 'colorisee']
const editions = [
  "director['’]?s cut",
  'final cut',
  'extended( cut| edition)?',
  'black (and|&) white',
  'remastered',
  'unrated',
]
const edition = `version (${versions.join('|')})|${editions.join('|')}`
const editionPattern = new RegExp(`([\\s:,(\\[-]+(${edition})[\\s)\\]]*)+$`, 'i')

type ICandidate = ITmdb & { alternateTitles?: { title: string }[] }

const minSimilarity = 0.8
const minContainedLength = 5
const maxYearGap = 2
const maxRuntimeGap = 5 * 60

export function stripEdition(title: string) {
  return title
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(editionPattern, '')
    .trim()
}

export function normalizeTitle(title: string) {
  return stripEdition(title)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '')
}

export function similarity(a: string, b: string) {
  const [left, right] = [normalizeTitle(a), normalizeTitle(b)]
  const digits = (title: string) => title.replace(/\D/g, '')
  if (!left || !right || digits(left) !== digits(right)) return 0
  const [shorter, longer] = [left, right].sort((a, b) => a.length - b.length)
  const score = 1 - distance(left, right) / longer.length
  return shorter.length >= minContainedLength && longer.includes(shorter) ? Math.max(score, minSimilarity) : score
}

function yearGap(movie: IMovieSC, tmdb: ITmdb) {
  const years = [movie.yearOfProduction, Number(movie.dateRelease?.slice(0, 4))].filter(Boolean) as number[]
  if (!years.length || !tmdb.year) return 0
  return Math.min(...years.map((year) => Math.abs(year - tmdb.year)))
}

function titleSimilarity(movie: IMovieSC, tmdb: ICandidate) {
  const scTitles = [movie.title, movie.originalTitle].filter(Boolean) as string[]
  const alternateTitles = tmdb.alternateTitles?.map(({ title }) => title) || []
  const tmdbTitles = [tmdb.title, tmdb.originalTitle, ...alternateTitles].filter(Boolean)
  return Math.max(...scTitles.flatMap((scTitle) => tmdbTitles.map((tmdbTitle) => similarity(scTitle, tmdbTitle))))
}

function runtimeGap(movie: IMovieSC, tmdb: ITmdb) {
  return movie.duration && tmdb.runtime ? Math.abs(tmdb.runtime * 60 - movie.duration) : Infinity
}

function isAcceptable({ score, yearGap, runtimeGap }: { score: number; yearGap: number; runtimeGap: number }) {
  const sameTitle = score >= minSimilarity && yearGap <= maxYearGap
  const sameMovie = yearGap <= 1 && runtimeGap <= maxRuntimeGap
  return sameTitle || sameMovie
}

export function pickMatch(movie: IMovieSC, candidates: ICandidate[]): ITmdb | undefined {
  return candidates
    .map((tmdb) => ({
      tmdb,
      score: titleSimilarity(movie, tmdb),
      yearGap: yearGap(movie, tmdb),
      runtimeGap: runtimeGap(movie, tmdb),
    }))
    .filter(isAcceptable)
    .sort((a, b) => b.score - a.score || a.yearGap - b.yearGap || a.runtimeGap - b.runtimeGap)[0]?.tmdb
}

export function lookupTerms(movie: IMovieSC) {
  const year = movie.dateRelease?.slice(0, 4) || ''
  const original = movie.originalTitle && stripEdition(movie.originalTitle)
  const title = stripEdition(movie.title)
  const terms = [
    original && `${original} ${year}`,
    original && movie.yearOfProduction && `${original} ${movie.yearOfProduction}`,
    `${title} ${year}`,
    title,
  ]
  return [...new Set(terms.filter(Boolean).map((term) => String(term).trim()))]
}
