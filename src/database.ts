import { closeSync, openSync, mkdirSync } from 'node:fs'
import { Database } from 'bun:sqlite'
import * as schema from './api_schema'
import { v4 as generateUuid } from 'uuid'
import migrations from '../migrations.json'

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

    getGoogleAccount(googleId: number) {
        const query = `SELECT userUuid FROM googleAccount WHERE googleId = '${googleId}'`
        const result = this.db.query(query).get() as { userUuid: string } | null
        if (result) {
            const parsed = schema.uuid.safeParse(result.userUuid)
            if (parsed.success) {
                this.db.exec(`UPDATE user SET loggedIn = TRUE WHERE userUuid = '${parsed.data}'`)
                return parsed.data
            }
        }
        return null
    }

    newGoogleAccount(googleId: number) {
        const uuid = schema.uuid.parse(generateUuid())
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
            const parsed = schema.uuid.safeParse(result.userUuid)
            if (parsed.success) {
                this.db.exec(`UPDATE user SET loggedIn = TRUE WHERE userUuid = '${result.userUuid}'`)
                return { passwordHash: result.passwordHash, uuid: parsed.data }
            }
        }
        return null
    }

    newAccount(username: string, passwordHash: string) {
        const uuid = schema.uuid.parse(generateUuid())
        this.db.transaction(() => {
            const query = `INSERT INTO account(username, passwordHash, userUuid) VALUES `
                + `('${username}', '${passwordHash}', '${uuid}')`
            this.db.exec(query)
            this.db.exec(`INSERT INTO user(userUuid, loggedIn, allowance) VALUES ('${uuid}', TRUE, 0)`)
        })()
        return uuid
    }

    getUserLoggedIn(uuid: schema.Uuid) {
        const query = `SELECT loggedIn FROM user WHERE userUuid = '${uuid}'`
        const result = this.db.query(query).get() as { loggedIn: boolean } | null
        if (result) {
            return result.loggedIn
        }
        return false
    }

    setUserLogout(uuid: schema.Uuid) {
        this.db.exec(`UPDATE user SET loggedIn = FALSE WHERE userUuid = '${uuid}'`)
    }

    getUserBio(uuid: schema.Uuid) {
        const query = `SELECT bio FROM userBio WHERE userUuid = '${uuid}'`
        const result = this.db.query(query).get() as { bio: string } | null
        return result?.bio
    }

    setUserBio(uuid: schema.Uuid, body: string) {
        const query = (
            `INSERT INTO userBio(userUuid, bio) VALUES ('${uuid}', '${body}') ` +
            'ON CONFLICT(userUuid) DO UPDATE SET bio=excluded.bio'
        )
        this.db.exec(query)
    }

    getBankHistory(uuid: schema.Uuid, limit: number, offset: number) {
        const query = (
            'SELECT balance, isoTimestamp FROM bank ' +
            `WHERE userUuid = '${uuid}' ORDER BY isoTimestamp DESC LIMIT ${limit} OFFSET ${offset}`
        )
        return this.db.query(query).all() as { balance: number, isoTimestamp: string }[] | null
    }

    getBankBalance(uuid: schema.Uuid) {
        const query = `SELECT balance, isoTimestamp FROM bank WHERE userUuid = '${uuid}' ORDER BY isoTimestamp DESC`
        return this.db.query(query).get() as { balance: number, isoTimestamp: string } | null
    }

    newBalance(uuid: schema.Uuid, isoTimestamp: string, balance: number) {
        const query = (
            'INSERT INTO bank(userUuid, isoTimestamp, balance) ' +
            `VALUES ('${uuid}', '${isoTimestamp}', ${balance})`
        )
        this.db.exec(query)
    }

    getBankAllowance(uuid: schema.Uuid) {
        const query = `SELECT allowance FROM user WHERE userUuid = '${uuid}'`
        const result = this.db.query(query).get() as { allowance: number } | null
        return result?.allowance
    }

    setAllowance(uuid: schema.Uuid, allowance: number) {
        this.db.exec(`UPDATE user SET allowance = ${allowance} WHERE userUuid = '${uuid}'`)
    }

    getPasswords(uuid: schema.Uuid) {
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
            return results.map((result): schema.PasswordsEntry => ({
                entryUuid: schema.uuid.parse(result.passUuid),
                siteUrl: result.siteUrl.length ? result.siteUrl : null,
                siteName: result.siteName,
                username: result.username,
                password: result.password,
                favorite: result.favorite == 1,
            }))
        }
        return []
    }

    upsertPasswords(uuid: schema.Uuid, entries: schema.PasswordsEntry[]) {
        this.db.transaction(() => {
            for (const entry of entries) {
                const { entryUuid, favorite } = entry
                let { siteUrl, siteName, username, password } = entry
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

    deletePassword(uuid: schema.Uuid, entryUuid: schema.Uuid) {
        this.db.exec(`DELETE FROM password WHERE passUuid = '${entryUuid}' AND userUuid = '${uuid}'`)
    }

    deleteAllPasswords(uuid: schema.Uuid) {
        this.db.exec(`DELETE FROM password WHERE userUuid = '${uuid}'`)
    }

    getShoppingList(uuid: schema.Uuid) {
        const query = (
            'SELECT itemUuid, name, imageUrl, itemUrl, description FROM shopping ' +
            `WHERE userUuid = '${uuid}'`
        )
        const results = this.db.query(query).all() as schema.ShoppingItem[] | null
        return results ?? []
    }

    newShoppingItem(uuid: schema.Uuid, name: string, imageUrl: string, itemUrl: string, description: string) {
        const itemUuid = schema.uuid.parse(generateUuid())
        name = name.replaceAll('\'', '\'\'')
        imageUrl = imageUrl.replaceAll('\'', '\'\'')
        itemUrl = itemUrl.replaceAll('\'', '\'\'')
        description = description.replaceAll('\'', '\'\'')
        const query = (
            'INSERT INTO shopping(itemUuid, userUuid, name, imageUrl, itemUrl, description) ' +
            `VALUES ('${itemUuid}', '${uuid}', '${name}' ,'${imageUrl}', '${itemUrl}', '${description}') `
        )
        this.db.exec(query)
    }

    deleteShoppingItem(uuid: schema.Uuid, itemUuid: schema.Uuid) {
        this.db.exec(`DELETE FROM shopping WHERE itemUuid = '${itemUuid}' AND userUuid = '${uuid}'`)
    }

    deleteShoppingList(uuid: schema.Uuid) {
        this.db.exec(`DELETE FROM shopping WHERE userUuid = '${uuid}'`)
    }
}