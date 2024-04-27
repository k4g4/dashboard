import { z } from 'zod'
import type { UpdateError } from './components/error'

export const apiError = z.object({
    error: z.string(),
})

export const uuid = z.string().uuid().brand<"Uuid">()
export type Uuid = z.infer<typeof uuid>

export const MAX_USERNAME_LEN = 20
export const MAX_PASSWORD_LEN = 20
export const MIN_LEN = 5

export const loginBody = z.object({
    username: z.string().max(MAX_USERNAME_LEN).min(MIN_LEN),
    password: z.string().max(MAX_PASSWORD_LEN).min(MIN_LEN),
    signingUp: z.boolean(),
})

export const loginResponse = z.object({
    uuid,
})

export const listGalleryResponse = z.array(z.string())

export const bioResponse = z.object({
    bio: z.string().nullable(),
})

export const bioBody = z.object({
    uuid,
    bio: z.string(),
})

export const bankTransactBody = z.object({
    uuid,
    amount: z.number().finite().gt(-9999).lt(9999),
    adding: z.boolean().optional(),
})

export const bankTransactResponse = z.object({
    newBalance: z.number(),
})

export const BANK_HISTORY_LENGTH = 30

export const bankAccountResponse = z.object({
    balance: z.number().finite(),
    allowance: z.number().finite(),
    hist: z.array(z.object({
        balance: z.number(),
        isoTimestamp: z.string().datetime(),
    })).max(BANK_HISTORY_LENGTH),
})

export const setAllowanceBody = z.object({
    uuid,
    allowance: z.number().finite().nonnegative(),
})

export const passwordsEntry = z.object({
    entryUuid: uuid,
    favorite: z.boolean(),
    siteName: z.string(),
    siteUrl: z.string().nullable(),
    username: z.string(),
    password: z.string(),
})
export type PasswordsEntry = z.infer<typeof passwordsEntry>

export const getPasswordsResponse = z.array(passwordsEntry)

export const bitwardenPasswordItem = z.object({
    id: uuid,
    object: z.literal('item'),
    type: z.literal(1),
    deletedDate: z.null(),
    name: z.string(),
    favorite: z.boolean(),
    login: z.object({
        uris: z.array(z.object({
            uri: z.string().nullable(),
        })),
        username: z.string(),
        password: z.string(),
    }),
}).omit({ object: true, type: true, deletedDate: true })

export const importBitwardenBody = z.object({
    uuid,
    items: z.array(z.unknown()),
})

const endpoints = [
    'loggedin',
    'googlelogin',
    'logout',
    'login',
    'gallery',
    'deletegallery',
    'bio',
    'banktransact',
    'bankaccount',
    'setallowance',
    'passwords',
    'importpasswords',
    'exportpasswords',
] as const

export type Endpoint = typeof endpoints[number]

export function isEndpoint(endpoint: string): endpoint is Endpoint {
    return endpoint in endpoints
}

const params = {
    googleid: z.string(),
    uuid,
    name: z.string(),
    page: z.number(),
}

export function getParam(
    searchParams: URLSearchParams
): <Param extends keyof typeof params>(param: Param) => z.infer<typeof params[Param]> {
    return param => params[param].parse(searchParams.get(param))
}

type Params = { [param in keyof typeof params]: z.infer<typeof params[param]> }

export async function apiFetch<Schema extends z.ZodTypeAny>(
    endpoint: Endpoint,
    { }: {
        params?: Partial<Params>,
        body?: unknown,
        schema: Schema,
        updateError?: UpdateError,
    },
): Promise<z.TypeOf<Schema> | null>
export async function apiFetch(
    endpoint: Endpoint,
    { }: {
        params?: Partial<Params>,
        body?: unknown,
        schema?: undefined,
        updateError?: UpdateError,
    },
): Promise<boolean>
export async function apiFetch<Schema extends z.ZodTypeAny>(
    endpoint: Endpoint,
    { params, body, schema, updateError }: {
        updateError?: UpdateError,
        params?: Partial<Params>,
        body?: unknown,
        schema?: Schema,
    },
) {
    const searchParams = new URLSearchParams()
    for (const [key, value] of Object.entries(params ?? {})) {
        searchParams.append(key, value.toString())
    }
    try {
        const response = await fetch(`/api/${endpoint}/${searchParams}`, body ?? { method: 'POST', body: JSON.stringify(body) })
        if (response.status === 200) {
            if (schema) {
                return schema.parse(await response.json())
            }
            return true
        } else if (response.status === 404) {
            updateError?.('file not found')
        } else {
            updateError?.(apiError.parse(await response.json()).error)
        }
    } catch {
        updateError?.()
    }
    if (schema) {
        return null
    }
    return false
}