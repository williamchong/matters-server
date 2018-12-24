import jwt from 'jsonwebtoken'

import { environment } from 'common/environment'
import {
  ArticleService,
  CommentService,
  DraftService,
  SystemService,
  TagService,
  UserService
} from 'connectors'

export const initSubscriptions = (): { onConnect: any } => ({
  onConnect: async (connectionParams: { 'x-access-token': string }) => {
    const userService = new UserService()

    let viewer
    try {
      const token = connectionParams['x-access-token']
      const decoded = jwt.verify(token, environment.jwtSecret) as {
        uuid: string
      }
      viewer = await userService.baseFindByUUID(decoded.uuid)
    } catch (err) {
      console.log('User is not logged in, viewing as guest')
    }
    return {
      viewer,
      userService,
      articleService: new ArticleService(),
      commentService: new CommentService(),
      draftService: new DraftService(),
      systemService: new SystemService(),
      tagService: new TagService()
    }
  }
})