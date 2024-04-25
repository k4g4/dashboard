import { closeSync, openSync, mkdirSync } from 'node:fs'
import { Database } from 'bun:sqlite'
import { uuidSchema, type PasswordsEntry, type Uuid } from './api_schema'
import { v4 as generateUuid } from 'uuid'
import migrations from '../migrations.json'
import type { z } from 'zod'

const PERSIST_DIR = Bun.env.PERSIST_DIR ?? 'persist'
const DB_DIR = `${PERSIST_DIR}/db`
const SQLITE_PATH = `${DB_DIR}/dashboard.sqlite`

export class Db {
    db: Database

    constructor() {
        try { mkdirSync(DB_DIR) }
        catch { }
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
            const parsed = uuidSchema.safeParse(result.userUuid)
            if (parsed.success) {
                this.db.exec(`UPDATE user SET loggedIn = TRUE WHERE userUuid = '${parsed.data}'`)
                return parsed.data
            }
        }
        return null
    }

    newGoogleAccount(googleId: string) {
        const uuid = uuidSchema.parse(generateUuid())
        this.db.transaction(() => {
            this.db.exec(`INSERT INTO googleAccount(googleId, userUuid) VALUES ('${googleId}', '${uuid}')`)
            this.db.exec(`INSERT INTO user(userUuid, loggedIn, allowance) VALUES ('${uuid}', TRUE, 0)`)
        })()
        return uuid
    }

    getAccount(username: string) {
        const query = `SELECT passwordHash, userUuid FROM account WHERE username = '${username}'`
        const result = this.db.query(query).get() as { passwordHash: string, userUuid: string } | null
        if (result) {
            const parsed = uuidSchema.safeParse(result.userUuid)
            if (parsed.success) {
                this.db.exec(`UPDATE user SET loggedIn = TRUE WHERE userUuid = '${result.userUuid}'`)
                return { passwordHash: result.passwordHash, uuid: parsed.data }
            }
        }
        return null
    }

    newAccount(username: string, passwordHash: string) {
        const uuid = uuidSchema.parse(generateUuid())
        this.db.transaction(() => {
            const query = `INSERT INTO account(username, passwordHash, userUuid) VALUES `
                + `('${username}', '${passwordHash}', '${uuid}')`
            this.db.exec(query)
            this.db.exec(`INSERT INTO user(userUuid, loggedIn, allowance) VALUES ('${uuid}', TRUE, 0)`)
        })()
        return uuid
    }

    getUserLoggedIn(uuid: Uuid) {
        const query = `SELECT loggedIn FROM user WHERE userUuid = '${uuid}'`
        const result = this.db.query(query).get() as { loggedIn: boolean } | null
        if (result) {
            return result.loggedIn
        }
        return false
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

    getBankBalance(uuid: Uuid) {
        const query = `SELECT balance, isoTimestamp FROM bank WHERE userUuid = '${uuid}' ORDER BY isoTimestamp DESC`
        return this.db.query(query).get() as { balance: number, isoTimestamp: string } | null
    }

    newBalance(uuid: Uuid, isoTimestamp: string, balance: number) {
        const query = (
            'INSERT INTO bank(userUuid, isoTimestamp, balance) ' +
            `VALUES ('${uuid}', '${isoTimestamp}', ${balance})`
        )
        this.db.exec(query)
    }

    getBankAllowance(uuid: Uuid) {
        const query = `SELECT allowance FROM user WHERE userUuid = '${uuid}'`
        const result = this.db.query(query).get() as { allowance: number } | null
        return result?.allowance
    }

    setAllowance(uuid: Uuid, allowance: number) {
        const query = `UPDATE user SET allowance = ${allowance} WHERE userUuid = '${uuid}'`
        this.db.exec(query)
    }

    getPasswords(uuid: Uuid) {
        const query = (
            'SELECT passUuid, siteUrl, siteName, username, password, favorite FROM password ' +
            `WHERE userUuid = '${uuid}' ORDER BY siteName`
        )
        type GetPasswordsResult = {
            passUuid: string,
            siteUrl: string,
            siteName: string,
            username: string,
            password: string,
            favorite: number,
        }
        const results = this.db.query(query).all() as GetPasswordsResult[] | null
        if (results) {
            return results.map((result): PasswordsEntry => ({
                entryUuid: uuidSchema.parse(result.passUuid),
                siteUrl: result.siteUrl.length ? result.siteUrl : null,
                siteName: result.siteName,
                username: result.username,
                password: result.password,
                favorite: result.favorite == 1,
            }))
        }
        return []
    }

    upsertPasswords(uuid: Uuid, entries: PasswordsEntry[]) {
        this.db.transaction(() => {
            for (let { entryUuid, siteUrl, siteName, username, password, favorite } of entries) {
                siteUrl = siteUrl?.replaceAll('\'', '\'\'') ?? ''
                siteName = siteName.replaceAll('\'', '\'\'')
                username = username.replaceAll('\'', '\'\'')
                password = password.replaceAll('\'', '\'\'')
                const query = (
                    'INSERT INTO password(passUuid, userUuid, siteUrl, siteName, username, password, favorite) ' +
                    `VALUES ('${entryUuid}', '${uuid}', '${siteUrl}', ` +
                    `'${siteName}', '${username}', '${password}', ${favorite ? 1 : 0}) ` +
                    'ON CONFLICT(passUuid) DO UPDATE SET siteUrl=excluded.siteUrl, siteName=excluded.siteName, ' +
                    'username=excluded.username, password=excluded.password, favorite=excluded.favorite'
                )
                this.db.exec(query)
            }
        })()
    }
}