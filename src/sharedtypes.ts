// these types and functions are accessible both on the client and on the server

import { validate } from 'uuid'

export type Uuid = string & { readonly __tag: unique symbol }

export function isUuid(uuid: string | null): uuid is Uuid {
    if (uuid) {
        return validate(uuid)
    }
    return false
}

export const GOOGLE_ID_PARAM = 'googleid'
export const UUID_PARAM = 'uuid'

export const GOOGLE_LOGIN_ENDPOINT = 'googlelogin'

export type LoginResponse = { uuid: Uuid }

export function isLoginResponse(body: any): body is LoginResponse {
    return 'uuid' in body
}

export const LOGOUT_ENDPOINT = 'logout'

export const LOGIN_ENDPOINT = 'login'