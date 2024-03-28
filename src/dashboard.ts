import { readdirSync, mkdirSync, statSync } from 'node:fs'
import { stat } from 'node:fs/promises'
import { Db } from './database'
import { GoogleidToUuidEndpoint, type GoogleidToUuidBody } from './sharedtypes'

const BUILD_DIR = Bun.env.BUILD_DIR ?? 'build'
const PORT = Bun.env.PORT ?? '3000'
const DEVELOPMENT = Bun.env.DEVELOPMENT === 'true'

const SRC = 'src'
const PAGE_SCRIPTS = `${SRC}/scripts`
const PAGES = 'pages'
const ASSETS = 'assets'

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

        if (method === 'GET') {
            if (pathname.endsWith('.js')) {
                return await this.fetchScript(pathname)
            }

            if (['.ico', '.png', '.css'].some(ext => pathname.endsWith(ext))) {
                return await this.fetchAsset(pathname);
            }

            if (pathname.startsWith('/api')) {
                // trim off /api/
                switch (pathname.slice(5)) {
                    case GoogleidToUuidEndpoint:
                        await this.googleidToUuid(searchParams.get('googleid'))
                        break
                }
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

        return await this.respond404()
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
            return await this.respond404()
        }
    }

    async respond404() {
        return new Response(`404 - File not found`, { status: 404 })
    }

    async googleidToUuid(googleid: string | null) {
        if (googleid) {
            const uuid = await this.db.googleidToUuid(googleid)
            const body: GoogleidToUuidBody = { uuid }
            return Response.json(body)
        } else {
            return await this.respond404()
        }
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