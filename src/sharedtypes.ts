// these types and functions are accessible both on the client and on the server

import { validate } from 'uuid'

export type ApiError = { error: string }

export function isApiError(body: any): body is ApiError {
    return ('error' in body && typeof body.error === 'string')
}

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
    return 'uuid' in body && typeof body.uuid === 'string'
}

export const LOGOUT_ENDPOINT = 'logout'

export const LOGIN_ENDPOINT = 'login'

export const MAX_USERNAME_LEN = 20
export const MAX_PASSWORD_LEN = 20
export const MIN_LEN = 5
export type LoginBody = { username: string, password: string, signingUp: boolean }

export function isLoginBody(body: any): body is LoginBody {
    return ('username' in body && typeof body.username === 'string'
        && body.username.length <= MAX_USERNAME_LEN && body.username.length >= MIN_LEN
        && 'password' in body && typeof body.password === 'string'
        && body.password.length <= MAX_PASSWORD_LEN && body.password.length >= MIN_LEN
        && 'signingUp' in body && typeof body.signingUp === 'boolean')
}