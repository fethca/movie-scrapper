# movie-scrapper

Scrapper of senscritique.com and themoviedb.org stored in a mongoDB to be used by the oklezzgo app.

## Prerequisites

Before installing movie-scrapper, ensure you have the following prerequisites met:

- Node.js installed on your system
- pnpm package manager installed
- A mongoDB with a .pem certificate
- A TMDB token and key, see their [documentation](https://developer.themoviedb.org/docs/authentication-application)

### Installation

To install the required node modules for movie-scrapper, run the following command:

```sh
pnpm install
```

### Environment Setup

Create a `.env` file at the root directory of your project and include the following environment variables:

```
APP_STAGE=dev

```
