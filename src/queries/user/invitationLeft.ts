import { InvitationStatusToLeftResolver } from 'definitions'
import { AuthenticationError } from 'common/errors'

const resolver: InvitationStatusToLeftResolver = async (
  { id },
  _,
  { viewer, dataSources: { userService } }
) => {
  if (!viewer.id) {
    throw new AuthenticationError('visitor has no permission')
  }

  if (viewer.id !== id && viewer.role !== 'admin') {
    throw Error('Not authorized')
  }

  const invitionCount = await userService.countInvitation(id)
  const mat = await userService.totalMAT(id)
  return Math.max(Math.floor(Math.log(mat)) - invitionCount, 0)
}

export default resolver