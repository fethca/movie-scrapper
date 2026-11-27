# TMDB matching

Each Senscritique movie is matched to a TMDB movie through Radarr's lookup (`src/helpers/tmdb.ts`).

## Order

1. A manual match (`tmdb.searchQuery`, set when picking a TMDB card in oklezzgo) is always trusted and kept.
2. The previous automatic match (`tmdb.tmdbId`) is re-checked with the rules below, so old wrong matches get replaced.
3. Radarr lookups, stopping at the first one that yields an acceptable candidate:
   `original title + release year`, `original title + production year`, `title + release year`, `title`.
4. Nothing acceptable: the movie is flagged `opsDatas.unfound` and can be fixed by hand from the "Introuvables" filter.

## Acceptable candidate

Titles are compared after removing accents, case, punctuation and a trailing edition marker
(`Version longue`, `Director's Cut`, `Final Cut`, `Noir et blanc`, `Black & White`, `Remastered`, ...).
Similarity is `1 - levenshtein / longest length` on the best pair between the Senscritique titles (title, original title)
and the TMDB titles (title, original title, Radarr alternate titles, which usually hold the French one).
A title of at least 5 characters contained in the other counts as `0.8` (`Arrietty` / `Arrietty - Le Petit monde des Chapardeurs`).
Titles with different numbers (`Alien` / `Alien 3`) never match.

A candidate is accepted when either:

- the title similarity is at least `0.8` and the year is within 2 years (Senscritique often uses the French release year), or
- the year is within 1 year and the runtime within 5 minutes. This catches titles that differ only by language
  (Senscritique gives a romanized original title, TMDB the native script: `Busanhaeng` / `부산행`).

The year is compared to both the production and the release year.
Among acceptable candidates, the highest similarity wins, then the closest year, then the closest runtime.

## Editions

Senscritique lists special editions (Version longue, Director's Cut, ...) as separate movies, TMDB does not.
Every Senscritique movie matched to the same TMDB id is considered the same film: the most rated one is the main
movie, the others get `edition: true`. The API hides editions from the list and returns them as `versions` of a movie.

Groups are recomputed for the new and the previous TMDB id each time a movie is processed.
