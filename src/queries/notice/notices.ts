import {
  connectionFromArray,
  cursorToIndex,
  filterMissingFieldNotices
} from 'common/utils'
import { UserToNoticesResolver } from 'definitions'

const resolver: UserToNoticesResolver = async (
  { id },
  { input },
  { dataSources: { notificationService } }
) => {
  const { first, after } = input
  const offset = cursorToIndex(after) + 1
  const totalCount = await notificationService.noticeService.countNotice({
    userId: id
  })
  let notices = await notificationService.noticeService.findByUser({
    userId: id,
    offset,
    limit: first
  })
  notices = filterMissingFieldNotices(notices)

  return connectionFromArray(notices, input, totalCount)
}

export default resolver
