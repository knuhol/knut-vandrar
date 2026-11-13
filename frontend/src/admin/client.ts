import type {
  BaseRecord,
  DataProvider,
  GetListParams,
  GetOneParams,
  CreateParams,
  UpdateParams,
  DeleteOneParams,
} from '@refinedev/core'

import type { Json } from './resources'

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message)
  }
}

export async function api(path: string, method = 'GET', body?: Json | File): Promise<Json> {
  const response = await fetch(`/api/admin/backend/${path}`, {
    method,
    headers:
      body instanceof File
        ? { 'Content-Type': 'application/octet-stream' }
        : { 'Content-Type': 'application/json' },
    body: body instanceof File ? body : body === undefined ? undefined : JSON.stringify(body),
  })
  if (response.status === 401) {
    window.location.assign('/admin')
  }
  if (response.status === 204) {
    return null
  }
  const value = (await response.json()) as Json
  if (!response.ok) {
    throw new ApiError(JSON.stringify(value), response.status)
  }
  return value
}

export const dataProvider: DataProvider = {
  getApiUrl: () => '/api/admin/backend',
  getList: async <TData extends BaseRecord>({ resource, pagination }: GetListParams) => {
    const pageSize = pagination?.pageSize || 10
    const current = pagination?.currentPage || 1
    const value = (await api(
      `${resource}?locale=en&limit=${String(pageSize)}&offset=${String((current - 1) * pageSize)}`,
    )) as { items: BaseRecord[]; total: number }
    return { data: value.items as TData[], total: value.total }
  },
  getOne: async <TData extends BaseRecord>({ resource, id }: GetOneParams) => ({
    data: (await api(`${resource}/${String(id)}?locale=en`)) as TData,
  }),
  create: async <TData extends BaseRecord, TVariables>({
    resource,
    variables,
  }: CreateParams<TVariables>) => ({
    data: (await api(resource, 'POST', variables as Json)) as TData,
  }),
  update: async <TData extends BaseRecord, TVariables>({
    resource,
    id,
    variables,
  }: UpdateParams<TVariables>) => ({
    data: (await api(`${resource}/${String(id)}`, 'PUT', variables as Json)) as TData,
  }),
  deleteOne: async <TData extends BaseRecord, TVariables>({
    resource,
    id,
  }: DeleteOneParams<TVariables>) => ({
    data: (await api(`${resource}/${String(id)}`, 'DELETE')) as TData,
  }),
}
