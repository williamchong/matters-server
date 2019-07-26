require('newrelic')
require('module-alias/register')
require('dotenv').config()

// external
import * as Sentry from '@sentry/node'
import express, { Express } from 'express'
import { ApolloServer, GraphQLOptions } from 'apollo-server-express'
import costAnalysis from 'graphql-cost-analysis'
import depthLimit from 'graphql-depth-limit'

// internal
import logger from 'common/logger'
import { UPLOAD_FILE_SIZE_LIMIT, CORS_OPTIONS } from 'common/enums'
import { environment, isProd } from 'common/environment'
import { DataSources } from 'definitions'
import { makeContext, initSubscriptions } from 'common/utils'
import {
  ArticleService,
  CommentService,
  DraftService,
  SystemService,
  TagService,
  UserService,
  NotificationService
} from 'connectors'
import { ActionLimitExceededError } from 'common/errors'

// local
import schema from '../schema'
import costMap from '../costMap'

class ProtectedApolloServer extends ApolloServer {
  async createGraphQLServerOptions(
    req: express.Request,
    res: express.Response
  ): Promise<GraphQLOptions> {
    const options = await super.createGraphQLServerOptions(req, res)
    const maximumCost = 500

    return {
      ...options,
      validationRules: [
        ...(options.validationRules || []),
        costAnalysis({
          variables: req.body.variables,
          maximumCost,
          defaultCost: 1,
          costMap,
          createError: (max: number, actual: number) => {
            const err = new ActionLimitExceededError(
              `GraphQL query exceeds maximum complexity,` +
                `please remove some nesting or fields and try again. (max: ${max}, actual: ${actual})`
            )
            return err
          },
          onComplete: (costs: number) =>
            logger.info(
              `[graphql-cost-analysis] costs: ${costs} (max: ${maximumCost})`
            )
        })
      ]
    }
  }
}

const server = new ProtectedApolloServer({
  schema,
  context: makeContext,
  engine: {
    apiKey: environment.apiKey
  },
  subscriptions: initSubscriptions(),
  dataSources: (): DataSources => ({
    userService: new UserService(),
    articleService: new ArticleService(),
    commentService: new CommentService(),
    draftService: new DraftService(),
    systemService: new SystemService(),
    tagService: new TagService(),
    notificationService: new NotificationService()
  }),
  uploads: {
    maxFileSize: UPLOAD_FILE_SIZE_LIMIT,
    maxFiles: 10
  },
  debug: !isProd,
  formatError: (error: any) => {
    // catch error globally
    Sentry.captureException(error)
    return error
  },
  validationRules: [depthLimit(15)]
})

export const graphql = (app: Express) => {
  server.applyMiddleware({
    app,
    path: '/graphql',
    cors: CORS_OPTIONS
  })

  return server
}