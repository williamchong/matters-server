import { DraftToContentResolver } from 'definitions'

// ACL for article content
const resolver: DraftToContentResolver = async (
  { authorId, content },
  _,
  { viewer }
) => {
  const isAdmin = viewer.hasRole('admin')
  const isAuthor = authorId === viewer.id

  if (isAdmin || isAuthor) {
    return content
  }

  return ''
}

export default resolver
