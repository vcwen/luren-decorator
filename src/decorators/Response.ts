import { Map } from 'immutable'
import 'reflect-metadata'
import { HttpStatusCode } from '../constants'
import { MetadataKey } from '../constants/MetadataKey'
import { IJsonSchema, normalizeSimpleSchema } from '../lib/utils'
import { PropertyDecorator } from '../types/PropertyDecorator'
export interface IResponseOptions {
  status?: number
  type?: any
  schema?: any
  desc?: string
  strict?: boolean
}

export class ResponseMetadata {
  public status: number = HttpStatusCode.OK
  public schema: IJsonSchema
  public strict: boolean = false
  public desc?: string
  constructor(status: number, schema: IJsonSchema, strict: boolean = false, desc?: string) {
    this.status = status
    this.schema = schema
    this.strict = strict
    this.desc = desc
  }
}

export function Response(options: IResponseOptions): PropertyDecorator {
  return (target: any, propertyKey: string) => {
    let resMetadata: Map<number, ResponseMetadata> =
      Reflect.getOwnMetadata(MetadataKey.RESPONSE, target, propertyKey) || Map()
    const status = options.status || HttpStatusCode.OK
    const schema = options.schema ? options.schema : normalizeSimpleSchema(options.type || 'string')
    const metadata = new ResponseMetadata(status, schema, options.strict, options.desc)
    resMetadata = resMetadata.set(metadata.status, metadata)
    Reflect.defineMetadata(MetadataKey.RESPONSE, resMetadata, target, propertyKey)
  }
}

export interface IErrorOptions {
  status: number
  type?: any
  schema?: IJsonSchema
  strict?: boolean
  desc?: string
}

export function ErrorResponse(options: IErrorOptions): PropertyDecorator {
  return (target: any, propertyKey: string) => {
    let resMetadata: Map<number, ResponseMetadata> =
      Reflect.getOwnMetadata(MetadataKey.RESPONSE, target, propertyKey) || Map()
    const status = options.status || HttpStatusCode.OK
    const schema = options.schema ? options.schema : normalizeSimpleSchema(options.type || 'string')
    const metadata = new ResponseMetadata(status, schema, options.strict, options.desc)
    resMetadata = resMetadata.set(metadata.status, metadata)
    Reflect.defineMetadata(MetadataKey.RESPONSE, resMetadata, target, propertyKey)
  }
}