import { Context, Middleware } from 'koa'
import { AuthenticationType, HttpStatusCode } from '../constants'
import { getRequestParam } from './helper'
import Processor from './Processor'
import { adaptMiddleware } from './utils'

export default abstract class AuthenticationProcessor extends Processor<boolean> {
  public abstract type: AuthenticationType
  public abstract async process(...args: any[]): Promise<boolean>
  public toMiddleware(): Middleware {
    return adaptMiddleware(this, async (res, ctx, next) => {
      if (res) {
        await next()
      } else {
        ctx.status = HttpStatusCode.UNAUTHORIZED
        ctx.body = 'Unauthorized'
      }
    })
  }
  public abstract equals(another: AuthenticationProcessor): boolean
}

// tslint:disable-next-line: max-classes-per-file
export class APIKeyAuthentication extends AuthenticationProcessor {
  public type = AuthenticationType.API_KEY
  public key: string
  public source: string
  private validateKey: (key: string) => Promise<boolean>
  constructor(key: string, source: string, validateKey: (key: string) => Promise<boolean>) {
    super()
    this.key = key
    this.validateKey = validateKey
    this.source = source
  }
  public async process(context: Context): Promise<boolean> {
    const apiKey = getRequestParam(context.request, this.key, this.source)
    if (apiKey) {
      return this.validateKey(apiKey)
    } else {
      return false
    }
  }
  public equals(another: AuthenticationProcessor) {
    if (this === another) {
      return true
    }
    if (another instanceof APIKeyAuthentication) {
      if (this.type !== another.type) {
        return false
      }
      if (this.name !== another.name) {
        return false
      }
      if (this.key !== another.key) {
        return false
      }
      if (this.source !== another.source) {
        return false
      }
      if (this.validateKey !== another.validateKey) {
        return false
      }
      return true
    } else {
      return false
    }
  }
}

// tslint:disable-next-line: max-classes-per-file
export class NoneAuthentication extends AuthenticationProcessor {
  public type = AuthenticationType.NONE
  constructor() {
    super()
  }
  public async process(): Promise<boolean> {
    return true
  }
  public equals(another: AuthenticationProcessor) {
    return another.type === AuthenticationType.NONE
  }
}