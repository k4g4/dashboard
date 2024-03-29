import { readdirSync, mkdirSync, statSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { Db } from './database'
import { GOOGLE_ID_PARAM, GOOGLE_LOGIN_ENDPOINT, isGoogleLoginBody, isUuid, LOGOUT_ENDPOINT, UUID_PARAM, type GoogleLoginBody, type Uuid } from './sharedtypes'

const BUILD_DIR = Bun.env.BUILD_DIR ?? 'build'
const PORT = Bun.env.PORT ?? '3000'
const DEVELOPMENT = Bun.env.DEVELOPMENT === 'true'

const SRC = 'src'
const PAGE_SCRIPTS = `${SRC}/scripts`
const PAGES = 'pages'
const ASSETS = 'assets'

type Get = URLSearchParams
type Post = any // JSON body
type ApiRequest = Get | Post

function isGet(req: Get | Post): req is Get {
    return req instanceof URLSearchParams
}

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
            const apiReq = method === 'GET' ? searchParams : await req.json()
            return await this.serveApi(endpoint, apiReq)
        }

        if (method === 'GET') {
            if (pathname.endsWith('.js')) {
                return await this.fetchScript(pathname)
            }

            if (['.ico', '.png', '.css'].some(ext => pathname.endsWith(ext))) {
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

    async serveApi(endpoint: string, req: ApiRequest) {
        if (isGet(req)) {
            switch (endpoint) {
                case GOOGLE_LOGIN_ENDPOINT:
                    return await this.googleLogin(req.get(GOOGLE_ID_PARAM))

                case LOGOUT_ENDPOINT:
                    const uuid = req.get(UUID_PARAM)
                    if (isUuid(uuid)) {
                        return await this.logout(uuid)
                    }
                    return this.serve400()
            }
            return this.serve404()
        } else {
            return this.serve404()
        }
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

    serve200() {
        return new Response(null, { status: 200 })
    }

    serve400() {
        return new Response('400 - Bad Request', { status: 400 })
    }

    serve404() {
        return new Response('404 - File not found', { status: 404 })
    }

    async googleLogin(googleId: string | null) {
        if (googleId) {
            let body: GoogleLoginBody
            const uuid = this.db.getGoogleAccount(googleId)
            if (uuid) {
                body = { uuid }
            } else {
                const uuid = this.db.newGoogleAccount(googleId)
                body = { uuid }
            }
            return Response.json(body)
        } else {
            return this.serve400()
        }
    }

    async logout(uuid: Uuid) {
        this.db.setUserLogout(uuid)
        return this.serve200()
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