import { AuthenticationError, UserInputError } from 'apollo-server'
import { MutationToReportCommentResolver } from 'definitions'
import { fromGlobalId } from 'common/utils'

const resolver: MutationToReportCommentResolver = async (
  root,
  { input: { id, category, description, contact, assetIds: assetUUIDs } },
  { viewer, dataSources: { commentService, systemService } }
) => {
  if (!viewer.id && !contact) {
    throw new UserInputError('"contact" is required with visitor')
  }

  const { id: dbId } = fromGlobalId(id)
  const comment = await commentService.dataloader.load(dbId)
  if (!comment) {
    throw new UserInputError('target comment does not exists')
  }

  let assetIds
  if (assetUUIDs) {
    const assets = await systemService.findAssetByUUIDs(assetUUIDs)
    if (!assets || assets.length <= 0) {
      throw new UserInputError('Asset does not exists')
    }
    assetIds = assets.map((asset: any) => asset.id)
  }

  await commentService.report({
    commentId: comment.id,
    userId: viewer.id,
    category,
    description,
    contact,
    assetIds
  })

  return true
}

export default resolver
