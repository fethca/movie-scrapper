import { App } from './app.js'
import { settings } from './settings.js'

void new App().run(settings.mongo.url)
