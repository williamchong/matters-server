import { connectionFromPromisedArray, fromConnectionArgs } from 'common/utils'
import { OSSToSeedingUsersResolver } from 'definitions'

export const seedingUsers: OSSToSeedingUsersResolver = async (
  _,
  { input },
  { dataSources: { atomService } }
) => {
  const { take, skip } = fromConnectionArgs(input)

  const table = 'seeding_user'
  const countQuery = atomService.count({ table, where: {} })
  const usersQuery = atomService.findMany({
    table,
    skip,
    take,
    orderBy: [{ column: 'created_at', order: 'desc' }],
  })
  const [totalCount, users] = await Promise.all([countQuery, usersQuery])

  return connectionFromPromisedArray(
    atomService.userIdLoader.loadMany(users.map(({ userId }) => userId)),
    input,
    totalCount
  )
}
