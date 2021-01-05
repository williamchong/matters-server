import { NotificationType, SkippedListItemType } from 'definitions'

import { DB_NOTICE_TYPE, OFFICIAL_NOTICE_EXTEND_TYPE } from './notification'

export * from './action'
export * from './email'
export * from './language'
export * from './notification'
export * from './payment'
export * from './permission'
export * from './queue'
export * from './table'
export * from './upload'
export * from './time'
export * from './cookie'
export * from './cache'
export * from './verification'
export * from './file'
export * from './hardcode'
export * from './cors'

export const GRAPHQL_COST_LIMIT = 500

export const BCRYPT_ROUNDS = 12

export const BATCH_SIZE = 10

export const LOCAL_S3_ENDPOINT = 'http://localhost:4569'

export const IPFS_PREFIX = 'article'

export const APPRECIATION_PURPOSE = {
  appreciate: 'appreciate',
  superlike: 'superlike',
  appreciateComment: 'appreciate-comment',
  appreciateSubsidy: 'appreciate-subsidy',
  invitationAccepted: 'invitation-accepted',
  joinByInvitation: 'join-by-invitation',
  joinByTask: 'join-by-task',
  firstPost: 'first-post',
  systemSubsidy: 'system-subsidy',
}

export const VOTE = {
  up: 'up',
  down: 'down',
}

export const COMMENT_STATE = {
  active: 'active',
  archived: 'archived',
  banned: 'banned',
  collapsed: 'collapsed',
}

export const USER_STATE = {
  frozen: 'frozen',
  onboarding: 'onboarding',
  active: 'active',
  banned: 'banned',
  archived: 'archived',
}

export const ARTICLE_STATE = {
  active: 'active',
  archived: 'archived',
  banned: 'banned',
}

export const PUBLISH_STATE = {
  unpublished: 'unpublished',
  pending: 'pending',
  error: 'error',
  published: 'published',
}

export const CIRCLE_STATE = {
  active: 'active',
  archived: 'archived',
  banned: 'banned',
}

export const PRICE_STATE = {
  active: 'active',
  archived: 'archived',
  banned: 'banned',
}

export const SUBSCRIPTION_STATE = {
  active: 'active',
  pastDue: 'past_due',
  unpaid: 'unpaid',
  canceled: 'canceled',
  incomplete: 'incomplete',
  incompleteExpired: 'incomplete_expired',
  trialing: 'trialing',
}

export const APPRECIATION_REWARD = {
  invitationCalculate: 20,
  invitationAccepted: 5,
  joinByInvitation: 5,
  joinByTask: 10,
  firstPost: 10,
}

export const ARTICLE_APPRECIATE_LIMIT = 5
export const ARTICLE_PIN_COMMENT_LIMIT = 3

export const MIGRATION_DELAY = 1000

export const IMAGE_DIMENSION_LIMIT = 1400

export const LOG_RECORD_TYPES = {
  ReadFolloweeArticles: 'read_followee_articles',
  ReadResponseInfoPopUp: 'read_response_info_pop_up',
  SentNewRegisterChurnEmail: 'sent_new_register_churn_email',
  SentMediumTermChurnEmail: 'sent_medium_term_churn_email',
}

export const UTM_PARAMETER = {
  SOURCE: {
    IPFS: 'utm_source=ipfs',
  },
}

export const OAUTH_CALLBACK_ERROR_CODE = {
  userNotFound: 1,
  // likecoin
  likerNotFound: 2,
  likerExists: 3,
  // stripe
  stripeAccountNotFound: 4,
  stripeAuthFailed: 5,
  stripeAccountExists: 6,
}

export const NODE_TYPES = {
  article: 'Article',
  comment: 'Comment',
  draft: 'Draft',
  user: 'User',
  tag: 'Tag',
  appreciation: 'Appreciation',
  transaction: 'Transaction',
  circle: 'Circle',
  price: 'Price',

  // Unions & Interfaces
  node: 'Node',
  notice: 'Notice',
  response: 'Response',
  transactionTarget: 'TransactionTarget',
}

export const APPRECIATION_TYPES = {
  like: 'LIKE',
  mat: 'MAT',
}

export const SEARCH_KEY_TRUNCATE_LENGTH = 100
export const SEARCH_ARTICLE_URL_REGEX = /^(https:\/\/([a-z0-9-]+.)?matters.news\/)@([a-zA-Z0-9_-]+)\/(.+?)-([0-9a-zA-Z]{49,59})$/gi

// this is the base64 representation of a vector of [0] * 20, the rank of our ALS model is 20
export const ALS_DEFAULT_VECTOR = {
  factor:
    '0|0 1|0 2|0 3|0 4|0 5|0 6|0 7|0 8|0 9|0 10|0 11|0 12|0 13|0 14|0 15|0 16|0 17|0 18|0 19|0',
  embedding:
    'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
}

export const OAUTH_PROVIDER = {
  facebbook: 'facebook',
  google: 'google',
}

export const MIGTATION_SOURCE = {
  medium: 'medium',
}

export const NOTIFICATION_TYPES: NotificationType[] = [
  ...Object.values(DB_NOTICE_TYPE),
  ...Object.values(OFFICIAL_NOTICE_EXTEND_TYPE),
]

export const SKIPPED_LIST_ITEM_TYPES: Record<string, SkippedListItemType> = {
  AGENT_HASH: 'agent_hash',
  EMAIL: 'email',
  DOMAIN: 'domain',
}
