import { MutationToUpdateArticleStateResolver } from 'definitions'
import { fromGlobalId } from 'common/utils'

const resolver: MutationToUpdateArticleStateResolver = async (
  _,
  { input: { id, state } },
  { viewer, dataSources: { userService, articleService, notificationService } }
) => {
  const { id: dbId } = fromGlobalId(id)

  const article = await articleService.baseUpdate(dbId, {
    state,
    updatedAt: new Date()
  })

  // trigger notification
  if (state === 'banned') {
    const user = await userService.dataloader.load(article.authorId)
    notificationService.trigger({
      event: 'article_banned',
      entities: [{ type: 'target', entityTable: 'article', entity: article }],
      recipientId: user.id
    })
  }

  return article
}

export default resolver