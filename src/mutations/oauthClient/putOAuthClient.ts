import _ from 'lodash'
import nanoid from 'nanoid'

import {
  AssetNotFoundError,
  AuthenticationError,
  UserInputError
} from 'common/errors'
import { fromGlobalId } from 'common/utils'
import { MutationToPutOAuthClientResolver } from 'definitions'

const resolver: MutationToPutOAuthClientResolver = async (
  root,
  {
    input: {
      id,
      secret,
      name,
      description,
      avatar,
      scope,
      grantTypes,
      website,
      redirectURIs,
      user
    }
  },
  { viewer, dataSources: { oauthService, systemService } }
) => {
  if (!viewer.id) {
    throw new AuthenticationError('visitor has no permission')
  }

  let oauthClient: any = {
    clientId: id || nanoid(32),
    clientSecret: secret,
    name,
    description,
    avatar,
    scope,
    websiteUrl: website,
    grantTypes,
    redirectUri: redirectURIs,
    userId: user ? fromGlobalId(user).id : user
  }

  if (avatar) {
    const asset = await systemService.findAssetByUUID(avatar)
    if (
      !asset ||
      asset.type !== 'oauthClientAvatar' ||
      asset.authorId !== viewer.id
    ) {
      throw new AssetNotFoundError('avatar asset does not exists')
    }
    oauthClient.avatar = asset.id
  }

  /**
   * Create
   */
  if (!id) {
    if (!name) {
      throw new UserInputError(`"name" is required in creation`)
    }

    // client secret
    if (!secret) {
      oauthClient = {
        ...oauthClient,
        clientSecret: nanoid(64)
      }
    }

    // grant types
    if (!grantTypes) {
      oauthClient = {
        ...oauthClient,
        grantTypes: ['refresh_token', 'authorization_code']
      }
    }
  }

  return oauthService.updateOrCreateClient(oauthClient)
}

export default resolver