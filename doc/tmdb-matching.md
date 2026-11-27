# TMDB matching

Each Senscritique movie is matched to a TMDB movie through Radarr's lookup (`src/helpers/tmdb.ts`).

## Order

1. A manual match (`tmdb.searchQuery`, set when picking a TMDB card in oklezzgo) is always trusted and kept.
2. The previous automatic match (`tmdb.tmdbId`) is re-checked with the rules below, so old wrong matches get replaced.
3. Radarr lookups, stopping at the first one that yields an acceptable candidate:
   `original title + release year`, `original title + production year`, `title + release year`, `title`.
4. Nothing acceptable: the movie is flagged `opsDatas.unfound` and can be fixed by hand from the "Introuvables" filter.

## Acceptable candidate

- Titles are compared after removing accents, case, punctuation and a trailing edition marker
  (`Version longue`, `Director's Cut`, `Final Cut`, `Noir et blanc`, `Black & White`, `Remastered`, ...).
- Similarity is `1 - levenshtein / longest length` on the best Senscritique/TMDB title pair, and must be at least `0.8`.
  Titles with different numbers (`Alien` / `Alien 3`) never match.
- The TMDB year must be within 1 year of the production year or the release year.

Among acceptable candidates, the highest similarity wins, then the closest year, then the closest runtime.
