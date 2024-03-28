import { Database } from 'bun:sqlite'
import type { Uuid } from './sharedtypes'
import * as uuid from 'uuid'

export class Db {
    db: Database

    constructor() {
        this.db = new Database()
    }

    async googleidToUuid(googleid: string) {
        return uuid.v4() as Uuid
    }
}