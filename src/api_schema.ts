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

export const BANK_ACCOUNT_ENDPOINT = 'bankaccount'
export const BANK_HISTORY_PAGE_PARAM = 'page'
export const BANK_HISTORY_LENGTH = 30

export const bankAccountResponseSchema = z.object({
    balance: z.number().finite(),
    allowance: z.number().finite(),
    hist: z.array(z.object({
        balance: z.number(),
        isoTimestamp: z.string().datetime(),
    })).max(BANK_HISTORY_LENGTH),
})

export const SET_ALLOWANCE_ENDPOINT = 'setallowance'

export const setAllowanceBodySchema = z.object({
    uuid: uuidSchema,
    allowance: z.number().finite().nonnegative(),
})

export const passwordsEntrySchema = z.object({
    entryUuid: uuidSchema,
    favorite: z.boolean(),
    siteName: z.string(),
    siteUrl: z.string(),
    username: z.string(),
    password: z.string(),
})
export type PasswordsEntry = z.infer<typeof passwordsEntrySchema>

export const GET_PASSWORDS_ENDPOINT = 'getpasswords'

export const getPasswordsResponseSchema = z.array(passwordsEntrySchema)

export const bitwardenSchema = z.object({
    uuid: uuidSchema,
    clientId: z.string(),
    clientSecret: z.string(),
    masterPassword: z.string(),
})

export const IMPORT_PASSWORDS_ENDPOINT = 'importpasswords'
export const EXPORT_PASSWORDS_ENDPOINT = 'exportpasswords'