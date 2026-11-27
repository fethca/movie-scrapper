import { IMovieSC, ITmdb } from '@fethcat/shared/types'
import { lookupTerms, pickMatch, similarity, stripEdition } from '../../../src/helpers/tmdb.js'

function sc(title: string, year: number, originalTitle = '', duration = 0) {
  return { title, originalTitle, yearOfProduction: year, dateRelease: `${year}-06-01`, duration } as IMovieSC
}

function tmdb(title: string, year: number, runtime = 0, originalTitle = title) {
  return { title, originalTitle, year, runtime, tmdbId: year } as ITmdb
}

describe('stripEdition', () => {
  it.each([
    ['Le Seigneur des anneaux : Version longue', 'Le Seigneur des anneaux'],
    ['Blade Runner (Final Cut)', 'Blade Runner'],
    ["Kingdom of Heaven - Director's Cut", 'Kingdom of Heaven'],
    ['Mad Max: Fury Road - Black & White Chrome Edition', 'Mad Max: Fury Road - Black & White Chrome Edition'],
    ['Mad Max: Fury Road - Black & White', 'Mad Max: Fury Road'],
    ['Godzilla Minus One - Version noir et blanc', 'Godzilla Minus One'],
    ['Les Enfants du paradis (Version restaurée)', 'Les Enfants du paradis'],
  ])('should strip the edition from %s', (title, expected) => {
    expect(stripEdition(title)).toBe(expected)
  })

  it('should keep titles that only contain an edition word', () => {
    expect(stripEdition('La Couleur des sentiments')).toBe('La Couleur des sentiments')
    expect(stripEdition('La Nuit intégrale')).toBe('La Nuit integrale')
  })
})

describe('similarity', () => {
  it('should ignore case, accents and punctuation', () => {
    expect(similarity('Amélie', 'amelie')).toBe(1)
    expect(similarity('Spider-Man: No Way Home', 'Spider Man No Way Home')).toBe(1)
  })

  it('should be low for obvious mismatches', () => {
    expect(similarity('I', 'Interstellar')).toBeLessThan(0.8)
    expect(similarity('Inside Men', 'Inside Out')).toBeLessThan(0.8)
  })

  it('should tell sequels apart', () => {
    expect(similarity('Alien 3', 'Alien')).toBe(0)
    expect(similarity('Kill Bill: Volume 2', 'Kill Bill: Volume 1')).toBe(0)
  })
})

describe('pickMatch', () => {
  it('should reject a candidate whose title does not match', () => {
    expect(pickMatch(sc('I', 2015), [tmdb('Interstellar', 2014)])).toBeUndefined()
    expect(pickMatch(sc('Inside Men', 2015), [tmdb('Inside Out', 2015)])).toBeUndefined()
  })

  it('should reject a candidate released more than a year apart', () => {
    expect(pickMatch(sc('Dune', 2021), [tmdb('Dune', 1984)])).toBeUndefined()
  })

  it('should match on the original title', () => {
    const match = tmdb('Inside Men', 2015, 130, 'Nae-bu-ja-deul')
    expect(pickMatch(sc('Inside Men', 2015, 'Nae-bu-ja-deul'), [tmdb('Inside Out', 2015), match])).toBe(match)
  })

  it('should prefer the closest year then the closest runtime', () => {
    const remake = tmdb('Dune', 2020, 155)
    const sameYearShort = tmdb('Dune', 2021, 60)
    const sameYear = tmdb('Dune', 2021, 155)
    expect(pickMatch(sc('Dune', 2021, '', 155 * 60), [remake, sameYearShort, sameYear])).toBe(sameYear)
  })

  it('should match a special edition with its original movie', () => {
    const original = tmdb('Blade Runner', 1982)
    expect(pickMatch(sc('Blade Runner (Final Cut)', 1982), [original])).toBe(original)
  })
})

describe('lookupTerms', () => {
  it('should search without the edition and without duplicates', () => {
    expect(lookupTerms(sc('Blade Runner (Final Cut)', 1982, 'Blade Runner (Final Cut)'))).toEqual([
      'Blade Runner 1982',
      'Blade Runner',
    ])
  })
})
