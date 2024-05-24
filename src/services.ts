import axios, { AxiosRequestConfig, AxiosResponse } from 'axios'
import { RadarrService } from './services/radarr.js'
import { settings } from './settings.js'

const timeout = 60000

export function request<T = never>(url: string, config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
  const headers = {
    'Content-Type': 'application/json',
    ...config.headers,
  }
  return axios.request<T>({ ...config, headers, baseURL: url, timeout })
}

export const radarr = new RadarrService(settings.radarr.refreshConfig)
