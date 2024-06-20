import { readdirSync, mkdirSync, statSync } from 'node:fs'
import { opendir, mkdir, stat, unlink } from 'node:fs/promises'
import { Db } from './database'
import * as schema from './api_schema'
import { z } from 'zod'
import moment, { type Moment } from 'moment-timezone'
import { include } from './include_macro' with { type: 'macro' }

const BUILD_DIR = Bun.env.BUILD_DIR ?? 'build'
const PERSIST_DIR = Bun.env.PERSIST_DIR ?? 'persist'
const PORT = Bun.env.PORT ?? '3000'
const DEVELOPMENT = Bun.env.DEVELOPMENT === 'true'
const TIMEZONE = Bun.env.TIMEZONE ?? 'UTC'

const TEMPLATE = include('pages/template.htm')
const ASSET_EXTS = ['.ico', '.png', '.css', '.jpg', '.json']
const NAME_FIELD = '{NAME}'
const DEV_FIELD = '{DEVELOPMENT}'
const SRC_DIR = 'src'
const PAGE_SCRIPTS = `${SRC_DIR}/scripts`
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
            // strip leading /api/
            const endpoint = pathname.slice(5)
            if (schema.isEndpoint(endpoint)) {
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
                            const messages = `Parsing errors:\n${error.issues.map(issue => issue.message).join('\n')}`
                            return this.serve400(messages)
                        }
                    } else if (error instanceof SyntaxError) {
                        // this occurs if no JSON body was found when one was expected
                        return this.serve400('no JSON provided')
                    } else {
                        throw error
                    }
                }
            } else {
                return this.serve404()
            }
        }

        if (method === 'GET') {
            if (pathname.endsWith('.js')) {
                return await this.fetchScript(pathname)
            }

            if (pathname.startsWith(`/${DATA_DIR}`)) {
                // strip leading /
                const dataPath = pathname.slice(1)
                return new Response(Bun.file(dataPath))
            }

            if (ASSET_EXTS.some(ext => pathname.endsWith(ext))) {
                return new Response(Bun.file(`${ASSETS_DIR}${pathname}`))
            }

            const pageName = pathname.replace('/', '').replace('.html', '').replace('.htm', '') || 'home'
            if (schema.PAGE_NAMES.includes(pageName)) {
                const page = TEMPLATE.replaceAll(NAME_FIELD, pageName).replaceAll(DEV_FIELD, DEVELOPMENT.toString())
                return new Response(page, { headers: { 'content-type': 'text/html' } })
            }
        }

        return this.serve404()
    }

    async serveGetApi(endpoint: schema.Endpoint, searchParams: URLSearchParams) {
        const get = schema.getParam(searchParams)

        switch (endpoint) {
            case 'loggedin': return this.loggedIn(get('uuid'))

            case 'googlelogin': return this.googleLogin(get('googleid'))

            case 'logout': return this.logout(get('uuid'))

            case 'gallery': return await this.listGallery(get('uuid'))

            case 'deletegallery': return await this.deleteGallery(get('uuid'), get('name'))

            case 'bio': return this.getBio(get('uuid'))

            case 'bankaccount': return this.bankAccount(get('uuid'), get('page'))

            case 'passwords': return this.getPasswords(get('uuid'))

            default: return this.serve404()
        }
    }

    async servePostApi(endpoint: schema.Endpoint, req: Request) {
        switch (endpoint) {
            case 'login': return await this.login(schema.loginBody.parse(await req.json()))

            case 'gallery': {
                let formData
                try {
                    formData = await req.formData()
                } catch {
                    return this.serve400('invalid form data')
                }
                return await this.uploadGallery(formData)
            }

            case 'bio': return this.setBio(schema.bioBody.parse(await req.json()))

            case 'banktransact': return this.bankTransact(schema.bankTransactBody.parse(await req.json()))

            case 'setallowance': return this.setAllowance(schema.setAllowanceBody.parse(await req.json()))

            case 'passwords': return this.upsertPassword(schema.upsertPasswordBody.parse(await req.json()))

            case 'deletepassword': return this.deletePassword(schema.deletePasswordBody.parse(await req.json()))

            case 'importpasswords': return this.importPasswords(schema.importBitwardenBody.parse(await req.json()))

            default: return this.serve404()
        }
    }

    async fetchScript(pathname: string) {
        // strip leading /
        const builtScriptName = pathname.slice(1)

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
                    throw `build error for ${scriptPath}:\n${logs.join('\n')}`
                }
                this.scripts.set(scriptName, mtimeMs)
            }
        }

        return new Response(Bun.file(`${BUILD_DIR}/${builtScriptName}`))
    }

    serve400(error: string) {
        const body: z.infer<typeof schema.apiError> = { error }
        return Response.json(body, { status: 400 })
    }

    serve404() {
        return new Response('404 - File not found', { status: 404 })
    }

    loggedIn(uuid: schema.Uuid) {
        if (this.db.getUserLoggedIn(uuid)) {
            return new Response()
        }
        return this.serve400('not logged in')
    }

    googleLogin(googleId: number | null) {
        if (googleId) {
            let body: z.infer<typeof schema.loginResponse>
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

    async login({ username, password, signingUp }: z.infer<typeof schema.loginBody>) {
        let body: z.infer<typeof schema.loginResponse>
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

    logout(uuid: schema.Uuid) {
        this.db.setUserLogout(uuid)
        return new Response()
    }

    async listGallery(uuid: schema.Uuid) {
        const dir = `${DATA_DIR}/${uuid}/${GALLERY}` as const
        await mkdir(dir, { recursive: true })

        const files: { mtimeMs: number, path: string }[] = []
        for await (const { name } of await opendir(dir)) {
            const path = `${dir}/${name}`
            const { mtimeMs } = await stat(path)
            files.push({ mtimeMs, path })
        }
        files.sort((left, right) => right.mtimeMs - left.mtimeMs)

        const listGalleryResponse: z.infer<typeof schema.listGalleryResponse> = files.map(({ path }) => path)
        return Response.json(listGalleryResponse)
    }

    async uploadGallery(formData: FormData) {
        const uuid = schema.uuid.parse(formData.get('uuid'))
        const dir = `${DATA_DIR}/${uuid}/${GALLERY}` as const

        const files: File[] = []
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

    async deleteGallery(uuid: schema.Uuid, name: string) {
        try {
            await unlink(`${DATA_DIR}/${uuid}/${GALLERY}/${name}`)
        } catch {
            return this.serve400('unknown file')
        }

        return new Response()
    }

    getBio(uuid: schema.Uuid) {
        const result = this.db.getUserBio(uuid)
        const body: z.infer<typeof schema.bioResponse> = { bio: result || null }
        return Response.json(body)
    }

    setBio({ uuid, bio }: z.infer<typeof schema.bioBody>) {
        this.db.setUserBio(uuid, bio)
        return new Response()
    }

    calcNewBalance(balance: number, prevDate: Moment, allowance: number) {
        const days = moment.tz(TIMEZONE).startOf('day').diff(prevDate.tz(TIMEZONE).startOf('day'), 'days')
        return balance + (days * allowance)
    }

    bankAccount(uuid: schema.Uuid, page: number) {
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
        const hist = this.db.getBankHistory(uuid, schema.BANK_HISTORY_LENGTH, page * schema.BANK_HISTORY_LENGTH) || []
        const body: z.infer<typeof schema.bankAccountResponse> = { balance, allowance, hist }
        return Response.json(body)
    }

    bankTransact({ uuid, amount, adding }: z.infer<typeof schema.bankTransactBody>) {
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
        const body: z.infer<typeof schema.bankTransactResponse> = { newBalance }
        return Response.json(body)
    }

    setAllowance({ uuid, allowance }: z.infer<typeof schema.setAllowanceBody>) {
        this.db.setAllowance(uuid, allowance)
        return new Response()
    }

    getPasswords(uuid: schema.Uuid) {
        const entries = this.db.getPasswords(uuid)
        return Response.json(entries)
    }

    upsertPassword({ uuid, passwordsEntry }: z.infer<typeof schema.upsertPasswordBody>) {
        this.db.upsertPasswords(uuid, [passwordsEntry])
        return new Response()
    }

    deletePassword({ uuid, entryUuid }: z.infer<typeof schema.deletePasswordBody>) {
        if (entryUuid) {
            this.db.deletePassword(uuid, entryUuid)
        } else {
            this.db.deleteAllPasswords(uuid)
        }
        return new Response()
    }

    importPasswords({ uuid, bwJson: { items } }: z.infer<typeof schema.importBitwardenBody>) {
        // translate bitwarden password entries to database password entries
        const entries =
            items
                .map(item => {
                    const result = schema.bitwardenPasswordItem.safeParse(item)
                    if (result.success) {
                        const { id, favorite, name, login } = result.data
                        const { uris, password, username } = login
                        const siteUrl = uris.at(0)?.uri ?? null

                        const entry: schema.PasswordsEntry = {
                            entryUuid: id,
                            favorite,
                            siteName: name,
                            username,
                            password,
                            siteUrl,
                        }
                        return entry
                    } else {
                        return null
                    }
                })
                .filter(entry => entry !== null)

        this.db.upsertPasswords(uuid, entries)

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