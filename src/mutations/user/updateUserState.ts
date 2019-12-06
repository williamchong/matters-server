import { USER_STATE } from 'common/enums'
import { fromGlobalId } from 'common/utils'
import { MutationToUpdateUserStateResolver } from 'definitions'

const resolver: MutationToUpdateUserStateResolver = async (
  _,
  { input: { id, state, banDays } },
  { viewer, dataSources: { userService, notificationService } }
) => {
  const { id: dbId } = fromGlobalId(id)

  const user = await userService.updateInfo(dbId, {
    state
  })

  // trigger notification
  if (state === USER_STATE.banned) {
    notificationService.trigger({
      event: 'user_banned',
      recipientId: user.id
    })
  } else if (state === USER_STATE.frozen) {
    notificationService.trigger({
      event: 'user_frozen',
      recipientId: user.id
    })
  }

  return user
}

export default resolver
