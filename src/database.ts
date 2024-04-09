import { closeSync, openSync, mkdirSync } from 'node:fs'
import { Database } from 'bun:sqlite'
import { isUuid, type Uuid } from './sharedtypes'
import { v4 as generateUuid } from 'uuid'
import migrations from '../migrations.json'

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
            this.db.exec(`PRAGMA user_version = ${migrations.length}`)
        })()
    }

    getGoogleAccount(googleId: string) {
        const query = `SELECT userUuid FROM googleAccount WHERE googleId = '${googleId}'`
        const result = this.db.query(query).get() as { userUuid: string } | null
        if (result) {
            if (isUuid(result.userUuid)) {
                this.db.exec(`UPDATE user SET loggedIn = TRUE WHERE userUuid = '${result.userUuid}'`)
                return result.userUuid
            }
            throw `found invalid uuid (${result.userUuid}) for google id (${googleId})`
        }
        return null
    }

    newGoogleAccount(googleId: string) {
        const uuid = generateUuid() as Uuid
        this.db.transaction(() => {
            this.db.exec(`INSERT INTO googleAccount(googleId, userUuid) VALUES ('${googleId}', '${uuid}')`)
            this.db.exec(`INSERT INTO user(userUuid, loggedIn) VALUES ('${uuid}', TRUE)`)
        })()
        return uuid
    }

    getAccount(username: string) {
        const query = `SELECT passwordHash, userUuid FROM account WHERE username = '${username}'`
        const result = this.db.query(query).get() as { passwordHash: string, userUuid: string } | null
        if (result) {
            if (isUuid(result.userUuid)) {
                this.db.exec(`UPDATE user SET loggedIn = TRUE WHERE userUuid = '${result.userUuid}'`)
                return { passwordHash: result.passwordHash, uuid: result.userUuid }
            }
            throw `found invalid uuid (${result.userUuid}) for user (${username})`
        }
        return null
    }

    newAccount(username: string, passwordHash: string) {
        const uuid = generateUuid() as Uuid
        this.db.transaction(() => {
            const query = `INSERT INTO account(username, passwordHash, userUuid) VALUES `
                + `('${username}', '${passwordHash}', '${uuid}')`
            this.db.exec(query)
            this.db.exec(`INSERT INTO user(userUuid, loggedIn) VALUES ('${uuid}', TRUE)`)
        })()
        return uuid
    }

    setUserLogout(uuid: Uuid) {
        this.db.exec(`UPDATE user SET loggedIn = FALSE WHERE userUuid = '${uuid}'`)
    }

    getUserBio(uuid: Uuid) {
        const query = `SELECT bio FROM userBio WHERE userUuid = '${uuid}'`
        const result = this.db.query(query).get() as { bio: string } | null
        return result?.bio
    }

    setUserBio(uuid: Uuid, body: string) {
        const query = (
            `INSERT INTO userBio(userUuid, bio) VALUES ('${uuid}', '${body}') ` +
            'ON CONFLICT(userUuid) DO UPDATE SET bio=excluded.bio'
        )
        this.db.exec(query)
    }

    getBankHistory(uuid: Uuid, limit: number, offset: number) {
        const query = (
            'SELECT balance, isoTimestamp FROM bank ' +
            `WHERE userUuid = '${uuid}' ORDER BY isoTimestamp DESC LIMIT ${limit} OFFSET ${offset}`
        )
        return this.db.query(query).all() as { balance: number, isoTimestamp: string }[] | null
    }

    newBalance(uuid: Uuid, isoTimestamp: string, balance: number) {
        const query = (
            'INSERT INTO bank(userUuid, isoTimestamp, balance) ' +
            `VALUES ('${uuid}', '${isoTimestamp}', ${balance})`
        )
        this.db.exec(query)
    }
}