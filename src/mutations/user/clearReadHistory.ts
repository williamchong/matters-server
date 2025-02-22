import { AuthenticationError } from 'common/errors'
import { fromGlobalId } from 'common/utils'
import { MutationToClearReadHistoryResolver } from 'definitions'

const resolver: MutationToClearReadHistoryResolver = async (
  _,
  { input: { id } },
  { viewer, dataSources: { userService, atomService } }
) => {
  if (!viewer.id) {
    throw new AuthenticationError('visitor has no permission')
  }

  await userService.clearReadHistory({
    userId: viewer.id,
    ...(id ? { articleId: fromGlobalId(id).id } : {}),
  })

  const user = await atomService.findFirst({
    table: 'user',
    where: { id: viewer.id },
  })

  return user
}

export default resolver
