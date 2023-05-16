import { getLogger } from 'common/logger'

const logger = getLogger('middleware-logger')

export const loggerMiddleware = async (
  resolve: any,
  root: { [key: string]: any },
  args: any,
  context: any,
  info: any
) => {
  try {
    const result = await resolve(root, args, context, info)
    return result
  } catch (error) {
    logger.info('args: %j', args)
    if (error.extensions) {
      // expected errors
      logger.warn('%s: %s', error.name, error.message)
    } else {
      // unexpected errors
      logger.error(error)
    }
    throw error
  }
}