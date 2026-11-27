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

const minSimilarity = 0.8
const maxYearGap = 1

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
  return 1 - distance(left, right) / Math.max(left.length, right.length)
}

function yearGap(movie: IMovieSC, tmdb: ITmdb) {
  const years = [movie.yearOfProduction, Number(movie.dateRelease?.slice(0, 4))].filter(Boolean) as number[]
  if (!years.length || !tmdb.year) return 0
  return Math.min(...years.map((year) => Math.abs(year - tmdb.year)))
}

function titleSimilarity(movie: IMovieSC, tmdb: ITmdb) {
  const scTitles = [movie.title, movie.originalTitle].filter(Boolean) as string[]
  const tmdbTitles = [tmdb.title, tmdb.originalTitle].filter(Boolean)
  return Math.max(...scTitles.flatMap((scTitle) => tmdbTitles.map((tmdbTitle) => similarity(scTitle, tmdbTitle))))
}

function runtimeGap(movie: IMovieSC, tmdb: ITmdb) {
  return movie.duration && tmdb.runtime ? Math.abs(tmdb.runtime * 60 - movie.duration) : 0
}

export function pickMatch(movie: IMovieSC, candidates: ITmdb[]): ITmdb | undefined {
  return candidates
    .map((tmdb) => ({ tmdb, score: titleSimilarity(movie, tmdb), gap: yearGap(movie, tmdb) }))
    .filter(({ score, gap }) => score >= minSimilarity && gap <= maxYearGap)
    .sort((a, b) => b.score - a.score || a.gap - b.gap || runtimeGap(movie, a.tmdb) - runtimeGap(movie, b.tmdb))[0]
    ?.tmdb
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
