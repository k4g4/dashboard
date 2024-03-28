import { validate } from 'uuid'

export type Uuid = string & { readonly __tag: unique symbol }

export function isUuid(uuid: string | null): uuid is Uuid {
    if (uuid) {
        return validate(uuid)
    }
    return false
}

export const GoogleidToUuidEndpoint = 'googleid_to_uuid'

export type GoogleidToUuidBody = { uuid: Uuid }

export function isGoogleidToUuidBody(body: any): body is GoogleidToUuidBody {
    return 'uuid' in body
}