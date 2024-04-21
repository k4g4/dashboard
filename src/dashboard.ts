import { $ } from 'bun'
import { readdirSync, mkdirSync, statSync } from 'node:fs'
import { opendir, mkdir, stat, unlink } from 'node:fs/promises'
import { Db } from './database'
import {
    DELETE_GALLERY_ENDPOINT, LOGIN_ENDPOINT, LOGOUT_ENDPOINT, UPLOAD_GALLERY_ENDPOINT,
    GOOGLE_ID_PARAM, GOOGLE_LOGIN_ENDPOINT, IMAGE_NAME_PARAM, LIST_GALLERY_ENDPOINT,
    UUID_PARAM, BIO_ENDPOINT, BANK_TRANSACT_ENDPOINT, BANK_ACCOUNT_ENDPOINT,
    BANK_HISTORY_LENGTH, BANK_HISTORY_PAGE_PARAM, LOGGED_IN_ENDPOINT,
    uuidSchema,
    type Uuid,
    loginBodySchema,
    bioBodySchema,
    bankTransactBodySchema,
    apiErrorSchema,
    loginResponseSchema,
    listGalleryResponseSchema,
    bioResponseSchema,
    bankAccountResponseSchema,
    bankTransactResponseSchema,
    SET_ALLOWANCE_ENDPOINT,
    setAllowanceBodySchema
} from './api_schema'
import { z } from 'zod'
import moment, { type Moment } from 'moment-timezone'

const BUILD_DIR = Bun.env.BUILD_DIR ?? 'build'
const PERSIST_DIR = Bun.env.PERSIST_DIR ?? 'persist'
const PORT = Bun.env.PORT ?? '3000'
const DEVELOPMENT = Bun.env.DEVELOPMENT === 'true'
const TIMEZONE = Bun.env.TIMEZONE ?? 'UTC'

const SRC_DIR = 'src'
const PAGE_SCRIPTS = `${SRC_DIR}/scripts`
const PAGES_DIR = 'pages'
const ASSETS_DIR = 'assets'
const DATA_DIR = `${PERSIST_DIR}/data`
const GALLERY = 'gallery'

export class Dashboard {
    scripts: Map<string, number>
    db: Db

    constructor() {
        try { mkdirSync(BUILD_DIR) }
        catch { }

        this.scripts = new Map(
            DEVELOPMENT ?
                // cache the modified time of each script to rebuild them if they change
                readdirSync(PAGE_SCRIPTS).map(script => {
                    const { mtimeMs } = statSync(`${PAGE_SCRIPTS}/${script}`)
                    return [script, mtimeMs]
                }) :
                []
        )

        this.db = new Db()
    }

    async fetch(req: Request) {
        const { method, url } = req
        const { pathname, searchParams } = new URL(url)

        if (pathname.startsWith('/api')) {
            // trim off /api/
            const endpoint = pathname.slice(5)
            try {
                if (method === 'GET') {
                    return await this.serveGetApi(endpoint, searchParams)
                } else {
                    return await this.servePostApi(endpoint, req)
                }
            } catch (error) {
                if (error instanceof z.ZodError) {
                    if (error.issues.length == 1) {
                        return this.serve400(`Parsing error: ${error.issues[0].message}`)
                    } else {
                        const messages = 'Parsing errors:\n' + error.issues.map(issue => `${issue.message}\n`)
                        return this.serve400(messages)
                    }
                } else if (error instanceof SyntaxError) { // this occurs if no JSON body was found when one was expected
                    return this.serve400('no JSON provided')
                } else {
                    throw error
                }
            }
        }

        if (method === 'GET') {
            if (pathname.endsWith('.js')) {
                return await this.fetchScript(pathname)
            }

            if (pathname.startsWith(`/${DATA_DIR}`)) {
                return await this.fetchData(pathname)
            }

            if (['.ico', '.png', '.css', '.jpg'].some(ext => pathname.endsWith(ext))) {
                return await this.fetchAsset(pathname);
            }

            let page;
            if (pathname === '/') {
                page = '/index.htm'
            } else if (!pathname.endsWith('.htm')) {
                page = `${pathname}.htm`
            } else {
                page = pathname
            }
            return await this.fetchPage(page)
        }

        return this.serve404()
    }

    async serveGetApi(endpoint: string, searchParams: URLSearchParams) {
        switch (endpoint) {
            case LOGGED_IN_ENDPOINT: {
                const uuid = uuidSchema.parse(searchParams.get(UUID_PARAM))
                return await this.loggedIn(uuid)
            }
            case GOOGLE_LOGIN_ENDPOINT: {
                return await this.googleLogin(searchParams.get(GOOGLE_ID_PARAM))
            }
            case LOGOUT_ENDPOINT: {
                const uuid = uuidSchema.parse(searchParams.get(UUID_PARAM))
                return await this.logout(uuid)
            }
            case LIST_GALLERY_ENDPOINT: {
                const uuid = uuidSchema.parse(searchParams.get(UUID_PARAM))
                return await this.listGallery(uuid)
            }
            case DELETE_GALLERY_ENDPOINT: {
                const uuid = uuidSchema.parse(searchParams.get(UUID_PARAM))
                const name = z.string().parse(searchParams.get(IMAGE_NAME_PARAM))
                return await this.deleteGallery(uuid, name)
            }
            case BIO_ENDPOINT: {
                const uuid = uuidSchema.parse(searchParams.get(UUID_PARAM))
                return await this.getBio(uuid)
            }
            case BANK_ACCOUNT_ENDPOINT: {
                const uuid = uuidSchema.parse(searchParams.get(UUID_PARAM))
                const page = z.string().regex(/[0-9]+/).parse(searchParams.get(BANK_HISTORY_PAGE_PARAM))
                return await this.bankAccount(uuid, Number(page))
            }
        }
        return this.serve404()
    }

    async servePostApi(endpoint: string, req: Request) {
        switch (endpoint) {
            case LOGIN_ENDPOINT: {
                const loginBody = loginBodySchema.parse(await req.json())
                return await this.login(loginBody)
            }
            case UPLOAD_GALLERY_ENDPOINT: {
                let formData
                try {
                    formData = await req.formData()
                } catch {
                    return this.serve400('invalid form data')
                }
                return await this.uploadGallery(formData)
            }
            case BIO_ENDPOINT: {
                const bioBody = bioBodySchema.parse(await req.json())
                return await this.setBio(bioBody)
            }
            case BANK_TRANSACT_ENDPOINT: {
                const bankTransactBody = bankTransactBodySchema.parse(await req.json())
                return await this.bankTransact(bankTransactBody)
            }
            case SET_ALLOWANCE_ENDPOINT: {
                const setAllowanceBody = setAllowanceBodySchema.parse(await req.json())
                return await this.setAllowance(setAllowanceBody)
            }
        }
        return this.serve404()
    }

    async fetchScript(pathname: string) {
        const builtScriptName = pathname.slice(1) // trim off leading /

        if (DEVELOPMENT) {
            const scriptName = builtScriptName.replace('.js', '.tsx')
            const scriptPath = `${PAGE_SCRIPTS}/${scriptName}`

            const storedMtimeMs = this.scripts.get(scriptName)
            const { mtimeMs } = await stat(scriptPath)
            if (storedMtimeMs !== mtimeMs || !await Bun.file(`${BUILD_DIR}/${builtScriptName}`).exists()) {
                const { success, logs } = await Bun.build({
                    entrypoints: [scriptPath],
                    outdir: BUILD_DIR
                })
                if (!success) {
                    throw `build error for ${scriptPath}:\n${logs}`
                }
                this.scripts.set(scriptName, mtimeMs)
            }
        }

        return new Response(Bun.file(`${BUILD_DIR}/${builtScriptName}`))
    }

    async fetchData(data: string) {
        const path = data.slice(1) // strip leading /
        return new Response(Bun.file(path))
    }

    async fetchAsset(asset: string) {
        return new Response(Bun.file(`${ASSETS_DIR}${asset}`))
    }

    async fetchPage(pathname: string) {
        const page = Bun.file(`${PAGES_DIR}${pathname}`)
        if (await page.exists()) {
            return new Response(page)
        } else {
            return this.serve404()
        }
    }

    serve400(error: string) {
        const body: z.infer<typeof apiErrorSchema> = { error }
        return Response.json(body, { status: 400 })
    }

    serve404() {
        return new Response('404 - File not found', { status: 404 })
    }

    async loggedIn(uuid: Uuid) {
        if (this.db.getUserLoggedIn(uuid)) {
            return new Response()
        }
        return this.serve400('not logged in')
    }

    async googleLogin(googleId: string | null) {
        if (googleId) {
            let body: z.infer<typeof loginResponseSchema>
            const uuid = this.db.getGoogleAccount(googleId)
            if (uuid) {
                body = { uuid }
            } else {
                const uuid = this.db.newGoogleAccount(googleId)
                body = { uuid }
            }
            return Response.json(body)
        } else {
            return this.serve400('google id could not be read')
        }
    }

    async login({ username, password, signingUp }: z.infer<typeof loginBodySchema>) {
        let body: z.infer<typeof loginResponseSchema>
        const result = this.db.getAccount(username)
        if (result) {
            if (signingUp) {
                return this.serve400('this username is taken')
            }
            if (await Bun.password.verify(password, result.passwordHash)) {
                body = { ...result }
            } else {
                return this.serve400('invalid username/password')
            }
        } else if (signingUp) {
            const uuid = this.db.newAccount(username, await Bun.password.hash(password))
            body = { uuid }
        } else {
            return this.serve400('invalid username/password')
        }

        return Response.json(body)
    }

    async logout(uuid: Uuid) {
        this.db.setUserLogout(uuid)
        return new Response()
    }

    async listGallery(uuid: Uuid) {
        const dir = `${DATA_DIR}/${uuid}/${GALLERY}`
        await mkdir(dir, { recursive: true })

        const files: { mtimeMs: number, path: string }[] = []
        for await (const { name } of await opendir(dir)) {
            const path = `${dir}/${name}`
            const { mtimeMs } = await stat(path)
            files.push({ mtimeMs, path })
        }
        files.sort((left, right) => right.mtimeMs - left.mtimeMs)

        const listGalleryResponse: z.infer<typeof listGalleryResponseSchema> = files.map(({ path }) => path)
        return Response.json(listGalleryResponse)
    }

    async uploadGallery(formData: FormData) {
        const uuid = uuidSchema.parse(formData.get('uuid'))
        const dir = `${DATA_DIR}/${uuid}/${GALLERY}`

        let files: File[] = []
        formData.forEach(file => {
            if (file instanceof File) {
                files.push(file)
            }
        })

        for (const file of files) {
            await Bun.write(`${dir}/${file.name}`, file)
        }

        return new Response()
    }

    async deleteGallery(uuid: Uuid, name: string) {
        try {
            await unlink(`${DATA_DIR}/${uuid}/${GALLERY}/${name}`)
        } catch {
            return this.serve400('unknown file')
        }

        return new Response()
    }

    async getBio(uuid: Uuid) {
        const result = this.db.getUserBio(uuid)
        const body: z.infer<typeof bioResponseSchema> = { bio: result || null }
        return Response.json(body)
    }

    async setBio({ uuid, bio }: z.infer<typeof bioBodySchema>) {
        this.db.setUserBio(uuid, bio)
        return new Response()
    }

    calcNewBalance(balance: number, prevDate: Moment, allowance: number) {
        const days = moment.tz(TIMEZONE).startOf('day').diff(prevDate.startOf('day'), 'days')
        return balance + (days * allowance)
    }

    async bankAccount(uuid: Uuid, page: number) {
        const allowance = this.db.getBankAllowance(uuid)
        if (allowance === undefined) {
            return this.serve400('user not found')
        }
        const result = this.db.getBankBalance(uuid)
        const balance = this.calcNewBalance(
            result ? result.balance : 0,
            moment(result?.isoTimestamp),
            allowance,
        )
        const hist = this.db.getBankHistory(uuid, BANK_HISTORY_LENGTH, page * BANK_HISTORY_LENGTH) || []
        const body: z.infer<typeof bankAccountResponseSchema> = { balance, allowance, hist }
        return Response.json(body)
    }

    async bankTransact({ uuid, amount, adding }: z.infer<typeof bankTransactBodySchema>) {
        if (adding) {
            amount = -amount
        }
        const allowance = this.db.getBankAllowance(uuid)
        if (allowance === undefined) {
            return this.serve400('user not found')
        }
        const result = this.db.getBankBalance(uuid)
        const balance = this.calcNewBalance(
            result ? result.balance : 0,
            moment(result?.isoTimestamp),
            allowance,
        )
        const newBalance = balance - amount
        this.db.newBalance(uuid, new Date().toISOString(), newBalance)
        const body: z.infer<typeof bankTransactResponseSchema> = { newBalance }
        return Response.json(body)
    }

    async setAllowance({ uuid, allowance }: z.infer<typeof setAllowanceBodySchema>) {
        this.db.setAllowance(uuid, allowance)
        return new Response()
    }

    serve() {
        const server = Bun.serve({
            fetch: req => this.fetch(req),
            development: DEVELOPMENT,
            port: PORT,
        })
        return server.url
    }
}