import {
  normalizeArticleHTML,
  sanitizeHTML,
} from '@matters/matters-editor/transformers'
import _ from 'lodash'
import { v4 } from 'uuid'

import {
  ARTICLE_STATE,
  ASSET_TYPE,
  CACHE_KEYWORD,
  CIRCLE_STATE,
  MAX_ARTICE_SUMMARY_LENGTH,
  MAX_ARTICE_TITLE_LENGTH,
  MAX_ARTICLE_CONTENT_LENGTH,
  MAX_ARTICLES_PER_COLLECTION_LIMIT,
  MAX_TAGS_PER_ARTICLE_LIMIT,
  NODE_TYPES,
  PUBLISH_STATE,
  USER_STATE,
} from 'common/enums'
import { environment } from 'common/environment'
import {
  ArticleCollectionReachLimitError,
  ArticleNotFoundError,
  AssetNotFoundError,
  AuthenticationError,
  CircleNotFoundError,
  DraftNotFoundError,
  ForbiddenByStateError,
  ForbiddenError,
  NotAllowAddOfficialTagError,
  TooManyTagsForArticleError,
  UserInputError,
} from 'common/errors'
import { extractAssetDataFromHtml, fromGlobalId } from 'common/utils'
import { DataSources, ItemData, MutationToPutDraftResolver } from 'definitions'

const resolver: MutationToPutDraftResolver = async (
  root,
  { input },
  {
    viewer,
    dataSources: {
      articleService,
      atomService,
      draftService,
      systemService,
      userService,
    },
    knex,
  }
) => {
  const {
    id,
    title,
    summary,
    content,
    tags,
    cover,
    collection: collectionGlobalId,
    circle: circleGlobalId,
    accessType,
    sensitive,
    license,
    requestForDonation,
    replyToDonator,
    iscnPublish,
    canComment,
  } = input
  if (!viewer.id) {
    throw new AuthenticationError('visitor has no permission')
  }

  if (
    [USER_STATE.archived, USER_STATE.banned, USER_STATE.frozen].includes(
      viewer.state
    )
  ) {
    throw new ForbiddenByStateError(`${viewer.state} user has no permission`)
  }

  if (!viewer.likerId) {
    throw new ForbiddenError('user has no liker id')
  }

  // check tags
  if (tags) {
    await validateTags({
      viewerId: viewer.id,
      tags,
      dataSources: { atomService },
    })
  }

  // check for asset existence
  let coverId
  if (cover) {
    const asset = await systemService.findAssetByUUID(cover)

    if (
      !asset ||
      [ASSET_TYPE.embed, ASSET_TYPE.cover].indexOf(asset.type) < 0 ||
      asset.authorId !== viewer.id
    ) {
      throw new AssetNotFoundError('Asset does not exists')
    }

    coverId = asset.id
  }

  // check collection
  const collection = collectionGlobalId
    ? _.uniq(
        collectionGlobalId
          .filter(_.isString)
          .map((articleId: string) => fromGlobalId(articleId).id)
      ).filter((articleId) => !!articleId)
    : collectionGlobalId // do not convert null or undefined
  if (collection) {
    await validateCollection({
      viewerId: viewer.id,
      collection,
      dataSources: { userService, articleService },
    })
  }

  // check circle
  let circleId // leave as undefined // = null
  if (circleGlobalId) {
    const { id: cId } = fromGlobalId(circleGlobalId)
    const circle = await atomService.findFirst({
      table: 'circle',
      where: { id: cId, state: CIRCLE_STATE.active },
    })

    if (!circle) {
      throw new CircleNotFoundError(`Cannot find circle ${circleGlobalId}`)
    } else if (circle.owner !== viewer.id) {
      throw new ForbiddenError(
        `Viewer isn't the owner of circle ${circleGlobalId}.`
      )
    } else if (circle.state !== CIRCLE_STATE.active) {
      throw new ForbiddenError(`Circle ${circleGlobalId} cannot be added.`)
    }

    if (!accessType) {
      throw new UserInputError('"accessType" is required on `circle`.')
    }

    circleId = cId
  }

  // assemble data
  const resetSummary = summary === null || summary === ''
  const resetCover = cover === null
  const resetCircle = circleGlobalId === null

  const data: ItemData = _.omitBy(
    {
      authorId: id ? undefined : viewer.id,
      title,
      summary,
      summaryCustomized: summary === undefined ? undefined : !resetSummary,
      content: content && normalizeArticleHTML(sanitizeHTML(content)),
      tags: tags?.length === 0 ? null : tags,
      cover: coverId,
      collection: collection?.length === 0 ? null : collection,
      circleId,
      access: accessType,
      sensitiveByAuthor: sensitive,
      license,
      requestForDonation,
      replyToDonator,
      iscnPublish,
      canComment,
    },
    _.isUndefined // to drop only undefined // _.isNil
  )

  // check for title, summary and content length limit
  if (data?.title?.length > MAX_ARTICE_TITLE_LENGTH) {
    throw new UserInputError('title reach length limit')
  }
  if (data?.summary?.length > MAX_ARTICE_SUMMARY_LENGTH) {
    throw new UserInputError('summary reach length limit')
  }
  if (data?.content?.length > MAX_ARTICLE_CONTENT_LENGTH) {
    throw new UserInputError('content reach length limit')
  }

  // Update
  if (id) {
    const { id: dbId } = fromGlobalId(id)
    const draft = await draftService.dataloader.load(dbId)

    // check for draft existence
    if (!draft) {
      throw new DraftNotFoundError('target draft does not exist')
    }

    // check for permission
    if (draft.authorId !== viewer.id) {
      throw new ForbiddenError('viewer has no permission')
    }

    // check for draft state
    if (
      draft.publishState === PUBLISH_STATE.pending ||
      draft.publishState === PUBLISH_STATE.published
    ) {
      throw new ForbiddenError(
        'current publishState is not allow to be updated'
      )
    }

    // check for tags limit
    if (tags) {
      const oldTagsLength = draft.tags == null ? 0 : draft.tags.length
      if (
        tags.length > MAX_TAGS_PER_ARTICLE_LIMIT &&
        tags.length > oldTagsLength
      ) {
        throw new TooManyTagsForArticleError(
          `Not allow more than ${MAX_TAGS_PER_ARTICLE_LIMIT} tags on an article`
        )
      }
    }

    // check for collection limit
    if (collection) {
      const oldCollectionLength =
        draft.collection == null ? 0 : draft.collection.length
      if (
        collection.length > MAX_ARTICLES_PER_COLLECTION_LIMIT &&
        collection.length > oldCollectionLength
      ) {
        throw new ArticleCollectionReachLimitError(
          `Not allow more than ${MAX_ARTICLES_PER_COLLECTION_LIMIT} articles in collection`
        )
      }
    }

    // handle candidate cover
    const isUpdateContent = content || content === ''
    if (
      (resetCover && !isUpdateContent) ||
      (resetCover && isUpdateContent && draft.cover) ||
      (!resetCover && isUpdateContent && !draft.cover)
    ) {
      const draftContent = isUpdateContent ? content : draft.content
      const uuids = (
        extractAssetDataFromHtml(draftContent, 'image') || []
      ).filter((uuid) => uuid && uuid !== 'embed')

      if (uuids.length > 0) {
        const candidateCover = await atomService.findFirst({
          table: 'asset',
          where: {
            uuid: uuids[0],
            type: ASSET_TYPE.embed,
            authorId: viewer.id,
          },
        })

        if (candidateCover) {
          data.cover = candidateCover.id
        }
      } else {
        data.cover = null
      }
    }

    // update
    return draftService.baseUpdate(dbId, {
      ...data,
      // reset fields
      summary: resetSummary ? null : data.summary || draft.summary,
      circleId: resetCircle ? null : data.circleId || draft.circleId,
      updatedAt: knex.fn.now(),
    })
  }

  // Create
  else {
    if (tags && tags.length > MAX_TAGS_PER_ARTICLE_LIMIT) {
      throw new TooManyTagsForArticleError(
        `Not allow more than ${MAX_TAGS_PER_ARTICLE_LIMIT} tags on an article`
      )
    }
    if (collection && collection.length > MAX_ARTICLES_PER_COLLECTION_LIMIT) {
      throw new ArticleCollectionReachLimitError(
        `Not allow more than ${MAX_ARTICLES_PER_COLLECTION_LIMIT} articles in collection`
      )
    }

    const draft = await draftService.baseCreate({ uuid: v4(), ...data })
    draft[CACHE_KEYWORD] = [
      {
        id: viewer.id,
        type: NODE_TYPES.User,
      },
    ]
    return draft
  }
}

const validateTags = async ({
  viewerId,
  tags,
  dataSources: { atomService },
}: {
  viewerId: string
  tags: string[]
  dataSources: Pick<DataSources, 'atomService'>
}) => {
  // check if tags includes matty's tag
  const isMatty = viewerId === environment.mattyId
  const mattyTagId = environment.mattyChoiceTagId
  if (mattyTagId && !isMatty) {
    const mattyTag = await atomService.findUnique({
      table: 'tag',
      where: { id: mattyTagId },
    })
    if (mattyTag && tags.includes(mattyTag.content)) {
      throw new NotAllowAddOfficialTagError('not allow to add official tag')
    }
  }
}

const validateCollection = async ({
  viewerId,
  collection,
  dataSources: { userService, articleService },
}: {
  viewerId: string
  collection: string[]
  dataSources: Pick<DataSources, 'userService' | 'articleService'>
}) => {
  await Promise.all(
    collection.map(async (articleId) => {
      const article = await articleService.baseFindById(articleId)

      if (!article) {
        throw new ArticleNotFoundError(`Cannot find article ${articleId}`)
      }

      if (article.state !== ARTICLE_STATE.active) {
        throw new ForbiddenError(`Article ${articleId} cannot be collected.`)
      }

      const isBlocked = await userService.blocked({
        userId: article.authorId,
        targetId: viewerId,
      })
      if (isBlocked) {
        throw new ForbiddenError('viewer has no permission')
      }
    })
  )
}

export default resolver
