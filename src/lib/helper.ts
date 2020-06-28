import { List, Map } from 'immutable'
import { Context, Middleware as KoaMiddleware, Request } from 'koa'
import Router from '@koa/router'
import _ from 'lodash'
import { JsTypes } from 'luren-schema'
import Path from 'path'
import 'reflect-metadata'
import { MetadataKey } from '../constants'
import { ActionMetadata, CtrlMetadata } from '../decorators'
import { ParamMetadata } from '../decorators/Param'
import { INext } from '../types'
import { ActionExecutor, ActionModule } from './Action'
import { ControllerModule } from './Controller'
import { HttpException } from './HttpException'
import { IncomingFile } from './IncomingFile'
import { Middleware } from './Middleware'

const getParam = (source: any, metadata: ParamMetadata) => {
  if (metadata.root) {
    return source
  } else {
    return _.get(source, metadata.name)
  }
}

export const getParams = (ctx: Context, next: INext, paramsMetadata: List<ParamMetadata> = List()) => {
  return paramsMetadata.map((metadata) => {
    let value: any
    switch (metadata.source) {
      case 'query':
        value = getParam(ctx.query, metadata)
        break
      case 'path':
        value = getParam(ctx.params, metadata)
        break
      case 'body': {
        if (metadata.schema.type === 'file') {
          if (metadata.root) {
            const ifs: IncomingFile[] = []
            const files = _.get(ctx.request, 'files')
            const props = Object.getOwnPropertyNames(files)
            for (const p of props) {
              const file = files[p]
              const f = new IncomingFile(file.name, file.path, file.type, file.size)
              ifs.push(f)
            }
            value = ifs
          } else {
            const file = _.get(ctx.request, ['files', metadata.name])
            if (file) {
              value = new IncomingFile(file.name, file.path, file.type, file.size)
              return value
            }
          }
        } else {
          value = getParam(_.get(ctx.request, 'body'), metadata)
        }
        break
      }
      case 'header':
        value = getParam(ctx.header, metadata)
        break
      case 'context':
        value = getParam(ctx, metadata)
        break
      case 'session':
        value = getParam(_.get(ctx, 'session'), metadata)
        if (metadata.root) {
          return value
        }
        break
      case 'request':
        value = getParam(ctx.request, metadata)
        if (metadata.root) {
          return value
        }
        break
      case 'next':
        return next
      default:
        throw new TypeError('Invalid source:' + metadata.source)
    }
    if (value === undefined) {
      if (metadata.required) {
        throw HttpException.badRequest(
          metadata.name + ' is required' + (metadata.source ? ' in ' + metadata.source : '')
        )
      } else {
        return
      }
    }
    // not do type validation when it's built-in object
    if (metadata.root && ['query', 'header', 'context', 'request', 'session', 'next'].includes(metadata.source)) {
      return value
    }
    const schema = metadata.schema
    if (schema.type !== 'string' && typeof value === 'string') {
      try {
        value = JSON.parse(value)
      } catch (err) {
        throw HttpException.badRequest(`invalid value: '${value}' for argument '${metadata.name}'`)
      }
    }
    try {
      value = JsTypes.deserialize(value, schema)
    } catch (err) {
      throw HttpException.badRequest(err)
    }
    return value
  })
}

export function createActionModule(controller: object, propKey: string, actionMetadata: ActionMetadata) {
  const middleware: List<Middleware | KoaMiddleware> =
    Reflect.getMetadata(MetadataKey.MIDDLEWARE, controller, propKey) || List()
  const action = new ActionExecutor(controller, propKey)
  const actionModule = new ActionModule(actionMetadata.name, actionMetadata.method, actionMetadata.path, action)
  actionModule.middleware = middleware
  return actionModule
}

export function createActions(controller: object) {
  const actionMetadataMap: Map<string, ActionMetadata> = Reflect.getMetadata(MetadataKey.ACTIONS, controller)
  return actionMetadataMap
    .map((actionMetadata, prop) => {
      return createActionModule(controller, prop, actionMetadata)
    })
    .toList()
}
export function createControllerModule(ctrl: object) {
  const controllerModule = new ControllerModule(ctrl)
  const ctrlMetadata: CtrlMetadata | undefined = Reflect.getMetadata(MetadataKey.CONTROLLER, ctrl)
  if (!ctrlMetadata) {
    throw new TypeError('invalid controller instance')
  }
  controllerModule.name = ctrlMetadata.name
  controllerModule.plural = ctrlMetadata.plural
  controllerModule.prefix = ctrlMetadata.prefix
  controllerModule.path = ctrlMetadata.path
  controllerModule.version = ctrlMetadata.version
  controllerModule.desc = ctrlMetadata.desc
  const middleware = Reflect.getMetadata(MetadataKey.MIDDLEWARE, ctrl) || List()
  controllerModule.middleware = middleware
  controllerModule.actionModules = createActions(ctrl)
  return controllerModule
}

export function createControllerRouter(controllerModule: ControllerModule) {
  const router: any = new Router({ prefix: controllerModule.prefix })
  const middleware = controllerModule.middleware.map((m) => (m instanceof Middleware ? m.toRawMiddleware() : m))

  router.use(...(middleware as List<any>))
  for (const actionModule of controllerModule.actionModules) {
    const version = actionModule.version || controllerModule.version || ''
    let path = Path.join('/', version, controllerModule.path, actionModule.path)
    // strip the ending '/'
    if (path.endsWith('/')) {
      path = path.substr(0, path.length - 1)
    }
    router[actionModule.method.toLowerCase()](
      path,
      ...actionModule.middleware,
      actionModule.action.execute.bind(actionModule.action)
    )
  }
  return router
}

export function loadControllersRouter(controllers: List<ControllerModule>) {
  const router = new Router()
  controllers.forEach((ctrl) => {
    const ctrlRouter = createControllerRouter(ctrl)
    router.use(ctrlRouter.routes())
  })
  return router
}

export const getRequestParam = (request: Request, key: string, source: string) => {
  switch (source) {
    case 'header':
      return _.get(request, ['header', key.toLowerCase()])
    case 'path':
      return _.get(request, ['params', key])
    case 'query':
      return _.get(request, ['query', key])
    case 'body':
      return _.get(request, ['body', key])
  }
}
