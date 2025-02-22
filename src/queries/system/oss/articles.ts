import { connectionFromPromisedArray, fromConnectionArgs } from 'common/utils'
import { OSSToArticlesResolver } from 'definitions'

export const articles: OSSToArticlesResolver = async (
  _,
  { input },
  { dataSources: { articleService, draftService } }
) => {
  const { take, skip } = fromConnectionArgs(input)

  const [totalCount, items] = await Promise.all([
    articleService.baseCount(),
    articleService.baseFind({ skip, take }),
  ])
  return connectionFromPromisedArray(
    draftService.dataloader.loadMany(items.map((item) => item.draftId)),
    input,
    totalCount
  )
}
