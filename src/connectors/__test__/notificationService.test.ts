import { NotificationType } from 'definitions'
import { NotificationService } from '../notificationService'
import { UserService } from '../userService'

import { knex } from 'connectors/db'
import { sharedQueueOpts } from 'connectors/queue/utils'

afterAll(async () => {
  await knex.destroy()
  const redisClient = sharedQueueOpts.createClient()
  // TODO: still have asynchronous operations running
  redisClient.disconnect()
})

const notificationService = new NotificationService()
const userService = new UserService()
const recipientId = '1'

/**
 * Notification Service
 */
describe('user notify setting', async () => {
  const noticeTypes: NotificationType[] = [
    'user_new_follower',
    'article_published',
    'article_new_downstream',
    'article_new_appreciation',
    'article_new_subscriber',
    'article_new_comment',
    'subscribed_article_new_comment',
    'upstream_article_archived',
    'downstream_article_archived',
    'comment_pinned',
    'comment_new_reply',
    'comment_new_upvote',
    'comment_mentioned_you',
    'official_announcement',
    'user_banned',
    'user_frozen',
    'comment_banned',
    'article_banned',
    'comment_reported',
    'article_reported'
  ]
  const defaultNoifySetting: { [key in NotificationType]: boolean } = {
    user_new_follower: true,
    article_published: true,
    article_new_downstream: true,
    article_new_appreciation: true,
    article_new_subscriber: false,
    article_new_comment: true,
    subscribed_article_new_comment: false,
    upstream_article_archived: true,
    downstream_article_archived: true,
    comment_pinned: true,
    comment_new_reply: true,
    comment_new_upvote: false,
    comment_mentioned_you: true,
    official_announcement: true,
    user_banned: true,
    user_frozen: true,
    comment_banned: false,
    article_banned: false,
    comment_reported: false,
    article_reported: false
  }

  test('user receives notifications', async () => {
    await Promise.all(
      noticeTypes.map(async type => {
        const {
          canPush
        } = await notificationService.push.checkUserNotifySetting({
          event: type,
          userId: recipientId
        })
        expect(canPush).toBe(defaultNoifySetting[type])
      })
    )
  })
  test('user disable "user_new_follower"', async () => {
    const notifySetting = await userService.findNotifySetting(recipientId)
    await userService.updateNotifySetting(notifySetting.id, { follow: false })
    await Promise.all(
      noticeTypes.map(async type => {
        const {
          canPush
        } = await notificationService.push.checkUserNotifySetting({
          event: type,
          userId: recipientId
        })
        expect(canPush).toBe(
          type === 'user_new_follower' ? false : defaultNoifySetting[type]
        )
      })
    )
  })
})

/**
 * Notice Service
 */
const getBundleableUserNewFollowerNoticeId = () =>
  notificationService.notice.getBundleableNoticeId({
    type: 'user_new_follower',
    actorIds: ['4'],
    recipientId
  })
describe('find notice', async () => {
  test('find one notice', async () => {
    const notice = await notificationService.notice.dataloader.load('1')
    expect(notice.id).toBe('1')
  })
  test('find many notices', async () => {
    const notices = await notificationService.notice.findByUser({
      userId: recipientId
    })
    expect(notices.length).toBeGreaterThan(5)
  })
})

describe('bundle notices', async () => {
  test('bundleable', async () => {
    // bundleable
    const userNewFollowerNoticeId = await getBundleableUserNewFollowerNoticeId()
    expect(userNewFollowerNoticeId).not.toBeUndefined()
  })

  test('unbundleable', async () => {
    // notice without actors
    const articleNewDownstreamNoticeId = await notificationService.notice.getBundleableNoticeId(
      {
        type: 'article_new_downstream',
        recipientId,
        entities: [
          { type: 'target', entityTable: 'article', entity: { id: '1' } },
          { type: 'downstream', entityTable: 'article', entity: { id: '3' } }
        ]
      }
    )
    expect(articleNewDownstreamNoticeId).toBeUndefined()
  })

  test('getBundleActorIds', async () => {
    const noticeId = await getBundleableUserNewFollowerNoticeId()
    if (!noticeId) {
      throw new Error('expect notice is bundleable')
    }
    const donothingActorIds = await notificationService.notice.getBundleActorIds(
      {
        noticeId,
        actorIds: ['2']
      }
    )
    expect(donothingActorIds.length).toBe(0)

    const bundleActorIds = await notificationService.notice.getBundleActorIds({
      noticeId,
      actorIds: ['2', '4']
    })
    expect(bundleActorIds.length).toBe(1)
    expect(bundleActorIds[0]).toBe('4')
  })

  test('bundle successs', async () => {
    const noticeId = await getBundleableUserNewFollowerNoticeId()
    if (!noticeId) {
      throw new Error('expect notice is bundleable')
    }
    const noticeActors = await notificationService.notice.findActors(noticeId)
    expect(noticeActors.length).toBe(2)
    await notificationService.notice.addNoticeActors({
      noticeId,
      actorIds: ['4']
    })
    await new Promise(resolve => setTimeout(resolve, 1000))
    const notice2Actors = await notificationService.notice.findActors(noticeId)
    expect(notice2Actors.length).toBe(3)
  })

  test('bundle failed if the notice actor is duplicate', async () => {
    const noticeId = await getBundleableUserNewFollowerNoticeId()
    if (!noticeId) {
      throw new Error('expect notice is bundleable')
    }
    try {
      await notificationService.notice.addNoticeActors({
        noticeId,
        actorIds: ['2']
      })
    } catch (e) {
      expect(() => {
        throw e
      }).toThrowError('unique constraint')
    }
  })

  test('mark notice as read then it becomes unbundleable', async () => {
    const noticeId = await getBundleableUserNewFollowerNoticeId()
    if (!noticeId) {
      throw new Error('expect notice is bundleable')
    }
    await notificationService.notice.baseUpdate(
      noticeId,
      { unread: false },
      'notice'
    )
    const unbundleableNotice = await getBundleableUserNewFollowerNoticeId()
    expect(unbundleableNotice).toBeUndefined()
  })
})

describe('update notices', async () => {
  test('markAllNoticesAsRead', async () => {
    const notices = await notificationService.notice.knex
      .select()
      .where({ recipientId, unread: true })
      .from('notice')
    expect(notices.length).not.toBe(0)

    await notificationService.notice.markAllNoticesAsRead(recipientId)

    const readNotices = await notificationService.notice.knex
      .select()
      .where({ recipientId, unread: true })
      .from('notice')
    expect(readNotices.length).toBe(0)
  })
})