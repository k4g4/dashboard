import { readdirSync, mkdirSync, statSync } from 'node:fs'
import { opendir, mkdir, stat, unlink } from 'node:fs/promises'
import { Db } from './database'
import {
    DELETE_GALLERY_ENDPOINT, LOGIN_ENDPOINT, LOGOUT_ENDPOINT, UPLOAD_GALLERY_ENDPOINT,
    GOOGLE_ID_PARAM, GOOGLE_LOGIN_ENDPOINT, IMAGE_NAME_PARAM, isUuid, LIST_GALLERY_ENDPOINT,
    UUID_PARAM, type ApiError, type LoginBody, type LoginResponse, type Uuid,
    BIO_ENDPOINT,
    type BioResponse,
    isLoginBody,
    isBioBody,
    type BioBody,
    BANK_TRANSACT_ENDPOINT,
    isBankTransactBody,
    type BankTransactBody,
    type BankTransactResponse,
    type BankHistoryResponse,
    BANK_HISTORY_ENDPOINT
} from './sharedtypes'

const BUILD_DIR = Bun.env.BUILD_DIR ?? 'build'
const PORT = Bun.env.PORT ?? '3000'
const DEVELOPMENT = Bun.env.DEVELOPMENT === 'true'

const SRC = 'src'
const PAGE_SCRIPTS = `${SRC}/scripts`
const PAGES = 'pages'
const ASSETS = 'assets'
const DATA = 'data'

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
            if (method === 'GET') {
                return await this.serveGetApi(endpoint, searchParams)
            } else {
                return await this.servePostApi(endpoint, req)
            }
        }

        if (method === 'GET') {
            if (pathname.endsWith('.js')) {
                return await this.fetchScript(pathname)
            }

            if (pathname.startsWith(`/${DATA}`)) {
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
            case GOOGLE_LOGIN_ENDPOINT: {
                return await this.googleLogin(searchParams.get(GOOGLE_ID_PARAM))
            }

            case LOGOUT_ENDPOINT: {
                const uuid = searchParams.get(UUID_PARAM)
                if (isUuid(uuid)) {
                    return await this.logout(uuid)
                }
                return this.serve400('no uuid provided')
            }

            case LIST_GALLERY_ENDPOINT: {
                const uuid = searchParams.get(UUID_PARAM)
                if (isUuid(uuid)) {
                    return await this.listGallery(uuid)
                }
                return this.serve400('no uuid provided')
            }

            case DELETE_GALLERY_ENDPOINT: {
                const uuid = searchParams.get(UUID_PARAM)
                if (!isUuid(uuid)) {
                    return this.serve400('no uuid provided')
                }
                const name = searchParams.get(IMAGE_NAME_PARAM)
                if (!name) {
                    return this.serve400('no image name provided')
                }
                return await this.deleteGallery(uuid, name)
            }

            case BIO_ENDPOINT: {
                const uuid = searchParams.get(UUID_PARAM)
                if (!isUuid(uuid)) {
                    return this.serve400('no uuid provided')
                }
                return await this.getBio(uuid)
            }

            case BANK_HISTORY_ENDPOINT: {
                const uuid = searchParams.get(UUID_PARAM)
                if (!isUuid(uuid)) {
                    return this.serve400('no uuid provided')
                }
                return await this.bankHistory(uuid)
            }
        }
        return this.serve404()
    }

    async servePostApi(endpoint: string, req: Request) {
        switch (endpoint) {
            case LOGIN_ENDPOINT: {
                let json
                try {
                    json = await req.json()
                } catch {
                    return this.serve400('invalid json body')
                }
                if (isLoginBody(json)) {
                    return await this.login(json)
                } else {
                    return this.serve400('invalid login body')
                }
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
                let json
                try {
                    json = await req.json()
                } catch {
                    return this.serve400('invalid json body')
                }
                if (isBioBody(json)) {
                    return await this.setBio(json)
                } else {
                    return this.serve400('invalid bio body')
                }
            }

            case BANK_TRANSACT_ENDPOINT: {
                let json
                try {
                    json = await req.json()
                } catch {
                    return this.serve400('invalid json body')
                }
                if (isBankTransactBody(json)) {
                    return await this.bankTransact(json)
                } else {
                    return this.serve400('invalid bank transact body')
                }
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
        return new Response(Bun.file(`${ASSETS}${asset}`))
    }

    async fetchPage(pathname: string) {
        const page = Bun.file(`${PAGES}${pathname}`)
        if (await page.exists()) {
            return new Response(page)
        } else {
            return this.serve404()
        }
    }

    serve400(error: string) {
        const body: ApiError = { error }
        return Response.json(body, { status: 400 })
    }

    serve404() {
        return new Response('404 - File not found', { status: 404 })
    }

    async googleLogin(googleId: string | null) {
        if (googleId) {
            let body: LoginResponse
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

    async login({ username, password, signingUp }: LoginBody) {
        let body: LoginResponse
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
        const dir = `${DATA}/${uuid}`
        await mkdir(dir, { recursive: true })

        let files: { mtimeMs: number, path: string }[] = []
        for await (const { name } of await opendir(dir)) {
            const path = `${dir}/${name}`
            const { mtimeMs } = await stat(path)
            files.push({ mtimeMs, path })
        }
        files.sort((left, right) => right.mtimeMs - left.mtimeMs)

        return Response.json(files.map(({ path }) => path))
    }

    async uploadGallery(formData: FormData) {
        const uuid = formData.get('uuid')
        if (typeof uuid !== 'string' || !isUuid(uuid)) {
            return this.serve400('invalid uuid')
        }
        const dir = `${DATA}/${uuid}`

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
            await unlink(`${DATA}/${uuid}/${name}`)
        } catch {
            return this.serve400('unknown file')
        }

        return new Response()
    }

    async getBio(uuid: Uuid) {
        const result = this.db.getUserBio(uuid)
        if (result) {
            const body: BioResponse = { bio: result }
            return Response.json(body)
        } else {
            return this.serve404()
        }
    }

    async setBio({ uuid, bio }: BioBody) {
        this.db.setUserBio(uuid, bio)
        return new Response()
    }

    async bankHistory(uuid: Uuid) {
        const result = this.db.getBankHistory(uuid, 20)
        let body: BankHistoryResponse
        if (result) {
            body = { hist: result }
        } else {
            body = { hist: [] }
        }
        return Response.json(body)
    }

    async bankTransact({ uuid, amount, adding }: BankTransactBody) {
        if (adding) {
            amount = -amount
        }
        const result = this.db.getBankHistory(uuid, 1)
        const newBalance = (result && result.length > 0 ? result[0].balance : 0) - amount
        this.db.newBalance(uuid, new Date().toISOString(), newBalance)
        const body: BankTransactResponse = { newBalance }
        return Response.json(body)
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