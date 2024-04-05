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

export const LIST_GALLERY_ENDPOINT = 'listgallery'

export type ListGalleryResponse = string[]

export function isListGalleryResponse(body: any): body is ListGalleryResponse {
    return Array.isArray(body) && body.every(image => typeof image === 'string')
}

export const UPLOAD_GALLERY_ENDPOINT = 'uploadgallery'

export const DELETE_GALLERY_ENDPOINT = 'deletegallery'

export const IMAGE_NAME_PARAM = 'name'

export const BIO_ENDPOINT = 'bio'

export type BioResponse = { bio: string }

export function isBioResponse(body: any): body is BioResponse {
    return 'bio' in body && typeof body.bio === 'string'
}

export type BioBody = { uuid: Uuid, bio: string }

export function isBioBody(body: any): body is BioBody {
    return ('bio' in body && typeof body.bio === 'string'
        && 'uuid' in body && isUuid(body.uuid))
}

export const BANK_TRANSACT_ENDPOINT = 'banktransact'

export type BankTransactBody = { uuid: Uuid, amount: number, adding?: boolean }

export function isBankTransactBody(body: any): body is BankTransactBody {
    return ('uuid' in body && isUuid(body.uuid)
        && 'amount' in body && typeof body.amount === 'number'
        && ('adding' in body ? typeof body.adding === 'boolean' : true))
}

export type BankTransactResponse = { newBalance: number }

export function isBankTransactResponse(body: any): body is BankTransactResponse {
    return 'newBalance' in body && typeof body.newBalance === 'number'
}

export const BANK_HISTORY_ENDPOINT = 'bankhist'
export const BANK_HISTORY_PAGE_PARAM = 'page'
export const BANK_HISTORY_LENGTH = 30

export type BankHistoryResponse = { hist: { balance: number, isoTimestamp: string }[] }

export function isBankHistoryResponse(body: any): body is BankHistoryResponse {
    return 'hist' in body && body.hist instanceof Array
}