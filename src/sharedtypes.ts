// these types and functions are accessible both on the client and on the server

import { validate } from 'uuid'

export type Uuid = string & { readonly __tag: unique symbol }

export function isUuid(uuid: string | null): uuid is Uuid {
    if (uuid) {
        return validate(uuid)
    }
    return false
}

export const GOOGLE_LOGIN_ENDPOINT = 'googlelogin'

export type GoogleLoginBody = { uuid: Uuid }

export function isGoogleLoginBody(body: any): body is GoogleLoginBody {
    return 'uuid' in body
}