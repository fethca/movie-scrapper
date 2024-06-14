const movieQL = `{
  id
  title
  originalTitle
  category
  dateRelease
  dateReleaseOriginal
  frenchReleaseDate
  yearOfProduction
  duration
  rating
  slug
  synopsis
  countries {
    name
  }
  genresInfos {
    label
  }
  directors {
    name
    contact {
      id
      picture
    }
  }
  actors {
    name
    role
    contact {
      id
      picture
    }
  }
  stats {
    ratingCount
    recommendCount
    reviewCount
    wishCount
  }
  polls(limit: 100) {
    poll {
      id
      label
      cover
      participationCount
    }
  }
  medias {
    videos {
      id
      image
      provider
      type
    }
  }
  pictures(limit: 6) {
    backdrops
    posters
    screenshots
  }
}`

const query = `
        query SearchProductExplorer(
            $query: String, 
            $offset: Int, 
            $limit: Int, 
            $filters: [SearchFilter], 
            $sortBy: SearchProductExplorerSort
    
        ) {
            searchProductExplorer(
              query: $query
              filters: $filters
              sortBy: $sortBy
              offset: $offset
              limit: $limit
    
          ) {
              total
              items {
                ...ProductList
    
            }
        }
      }
        fragment ProductList on Product ${movieQL}
      `

export const getMoviesQuery = (options: { offset: number; startYear?: number; endYear?: number }) => {
  const currentYear = new Date().getFullYear()
  const { offset, startYear, endYear } = options

  return {
    operationName: 'SearchProductExplorer',
    variables: {
      offset,
      limit: offset > 9900 ? 10000 - offset : 100,
      filters: [
        {
          identifier: 'universe',
          termValues: ['movie'],
        },
        {
          identifier: 'year',
          rangeValue: {
            min: startYear || currentYear,
            max: endYear || currentYear,
          },
        },
      ],
      sortBy: 'RELEVANCE',
    },
    query,
  }
}

export const getMovieQuery = (id: number) => {
  return {
    variables: { id },
    query: `query GetProduct($id: Int!) {
          product(id: $id) ${movieQL}
        }`,
  }
}
