import { connectionFromPromisedArray } from 'common/utils'

import { InvitationStatusToSentResolver } from 'definitions'

const resolver: InvitationStatusToSentResolver = async (
  { id },
  { input },
  { dataSources: { userService } }
) => {
  return connectionFromPromisedArray(userService.findInvitations(id), input)
}

export default resolver