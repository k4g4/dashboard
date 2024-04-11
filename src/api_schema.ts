import { z } from 'zod'

export const apiErrorSchema = z.object({
    error: z.string(),
})

export const uuidSchema = z.string().uuid().brand<"Uuid">()
export type Uuid = z.infer<typeof uuidSchema>

export const GOOGLE_ID_PARAM = 'googleid'
export const UUID_PARAM = 'uuid'

export const LOGGED_IN_ENDPOINT = 'loggedin'

export const GOOGLE_LOGIN_ENDPOINT = 'googlelogin'

export const loginResponseSchema = z.object({
    uuid: uuidSchema,
})

export const LOGOUT_ENDPOINT = 'logout'

export const LOGIN_ENDPOINT = 'login'

export const MAX_USERNAME_LEN = 20
export const MAX_PASSWORD_LEN = 20
export const MIN_LEN = 5

export const loginBodySchema = z.object({
    username: z.string().max(MAX_USERNAME_LEN).min(MIN_LEN),
    password: z.string().max(MAX_PASSWORD_LEN).min(MIN_LEN),
    signingUp: z.boolean(),
})

export const LIST_GALLERY_ENDPOINT = 'listgallery'

export const listGalleryResponseSchema = z.array(z.string())

export const UPLOAD_GALLERY_ENDPOINT = 'uploadgallery'

export const DELETE_GALLERY_ENDPOINT = 'deletegallery'

export const IMAGE_NAME_PARAM = 'name'

export const BIO_ENDPOINT = 'bio'

export const bioResponseSchema = z.object({
    bio: z.string().nullable(),
})

export const bioBodySchema = z.object({
    uuid: uuidSchema,
    bio: z.string(),
})

export const BANK_TRANSACT_ENDPOINT = 'banktransact'

export const bankTransactBodySchema = z.object({
    uuid: uuidSchema,
    amount: z.number().finite().gt(-9999).lt(9999),
    adding: z.boolean().optional(),
})

export const bankTransactResponseSchema = z.object({
    newBalance: z.number(),
})

export const BANK_HISTORY_ENDPOINT = 'bankhist'
export const BANK_HISTORY_PAGE_PARAM = 'page'
export const BANK_HISTORY_LENGTH = 30

export const bankHistoryResponseSchema = z.object({
    balance: z.number().finite(),
    hist: z.array(z.object({
        balance: z.number(),
        isoTimestamp: z.string().datetime(),
    })).max(BANK_HISTORY_LENGTH),
})