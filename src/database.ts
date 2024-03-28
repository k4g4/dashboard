import { closeSync, openSync } from 'node:fs'
import { Database } from 'bun:sqlite'
import { isUuid, type Uuid } from './sharedtypes'
import { v4 as generateUuid } from 'uuid'
import migrations from '../db/migrations.json'

const SQLITE_PATH = Bun.env.SQLITE_PATH ?? 'db/dashboard.sqlite'

export class Db {
    db: Database

    constructor() {
        closeSync(openSync(SQLITE_PATH, 'a'))
        this.db = new Database(SQLITE_PATH)

        const result = this.db.query('PRAGMA user_version').get() as { 'user_version': number }
        this.db.transaction(() => {
            for (const migration of migrations.slice(result['user_version'])) {
                for (const query of migration) {
                    this.db.exec(query)
                }
            }
        })()
        this.db.exec(`PRAGMA user_version = ${migrations.length}`)
    }

    getGoogleAccount(googleId: string) {
        const query = `SELECT userUuid FROM googleAccount WHERE googleId = '${googleId}'`
        const result = this.db.query(query).get() as { userUuid: string } | null
        console.log(result)
        if (result) {
            if (isUuid(result.userUuid)) {
                return result.userUuid
            }
            throw `found invalid uuid (${result.userUuid}) for google id (${googleId})`
        }
        return null
    }

    newGoogleAccount(googleId: string) {
        const uuid = generateUuid() as Uuid
        this.db.exec(`INSERT INTO googleAccount(googleId, userUuid) VALUES ('${googleId}', '${uuid}')`)
        return uuid
    }

    debug() {
        console.log(this.db.query('SELECT * FROM googleAccount').all())
    }
}