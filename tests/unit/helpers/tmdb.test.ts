import { IMovieSC, ITmdb } from '@fethcat/shared/types'
import { lookupTerms, pickMatch, similarity, stripEdition } from '../../../src/helpers/tmdb.js'

function sc(title: string, year: number, originalTitle = '', duration = 0) {
  return { title, originalTitle, yearOfProduction: year, dateRelease: `${year}-06-01`, duration } as IMovieSC
}

function tmdb(title: string, year: number, runtime = 0, originalTitle = title, alternateTitles: string[] = []) {
  return {
    title,
    originalTitle,
    year,
    runtime,
    tmdbId: year,
    alternateTitles: alternateTitles.map((alternateTitle) => ({ title: alternateTitle })),
  } as unknown as ITmdb
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

  it('should match a title contained in a longer one', () => {
    expect(similarity('Arrietty', 'Arrietty - Le Petit monde des Chapardeurs')).toBe(0.8)
    expect(similarity('Mamma Mia!', 'Mamma Mia! The Movie')).toBe(0.8)
  })

  it('should not match very short contained titles', () => {
    expect(similarity('Up', 'Up in the Air')).toBeLessThan(0.8)
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

  it('should reject a candidate released more than two years apart', () => {
    expect(pickMatch(sc('Dune', 2021), [tmdb('Dune', 1984)])).toBeUndefined()
    expect(
      pickMatch(sc('Le Vent se lève', 2013), [tmdb('Le vent se lève', 1959), tmdb('Le vent se lève', 2025)]),
    ).toBeUndefined()
  })

  it('should accept a French release two years after the TMDB year', () => {
    const match = tmdb('Tucker and Dale vs. Evil', 2010)
    expect(pickMatch(sc('Tucker & Dale fightent le mal', 2012, 'Tucker & Dale vs. Evil'), [match])).toBe(match)
  })

  it('should match through an alternate title', () => {
    const howl = tmdb("Howl's Moving Castle", 2004, 119, 'ハウルの動く城', ['Le Château ambulant'])
    expect(pickMatch(sc('Le Château ambulant', 2004, 'Hauru no ugoku shiro'), [howl])).toBe(howl)
  })

  it('should match a different-language title when year and runtime agree', () => {
    const busan = tmdb('Train to Busan', 2016, 118, '부산행')
    expect(pickMatch(sc('Dernier train pour Busan', 2016, 'Busanhaeng', 118 * 60), [busan])).toBe(busan)
  })

  it('should reject a different title when the runtime differs', () => {
    expect(pickMatch(sc('I', 2015, '', 188 * 60), [tmdb('Interstellar', 2014, 169)])).toBeUndefined()
    expect(pickMatch(sc('Inside Men', 2015, '', 130 * 60), [tmdb('Inside Out', 2015, 95)])).toBeUndefined()
  })

  it('should prefer the matching year over an exact title from another year', () => {
    const windRises = tmdb('The Wind Rises', 2013, 126, '風立ちぬ', ['Le vent se lève'])
    const candidates = [tmdb('Le vent se lève', 1959), tmdb('Le vent se lève', 2025), windRises]
    expect(pickMatch(sc('Le Vent se lève', 2013, 'Kaze tachinu'), candidates)).toBe(windRises)
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
