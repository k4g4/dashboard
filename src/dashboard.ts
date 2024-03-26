import { readdirSync, readFileSync, mkdirSync } from 'node:fs'

const BUILD_DIR = Bun.env.BUILD_DIR ?? 'build'
const PORT = Bun.env.PORT ?? '3000'
const DEVELOPMENT = Bun.env.DEVELOPMENT === 'true'

const SRC = 'src'
const PAGE_SCRIPTS = `${SRC}/scripts`
const PAGES = 'pages'
const ASSETS = 'assets'

export class Dashboard {
    scripts: Map<string, bigint>

    constructor() {
        try { mkdirSync(BUILD_DIR) }
        catch { }

        this.scripts = new Map(
            DEVELOPMENT ?
                // cache the hash of each script to rebuild them if they change
                readdirSync(PAGE_SCRIPTS).map(script => {
                    const hash = Bun.hash(readFileSync(`${PAGE_SCRIPTS}/${script}`))
                    return [script, BigInt(hash)]
                }) :
                []
        )
    }

    async fetch(req: Request) {
        const { method, url } = req
        const { pathname, searchParams } = new URL(url)

        if (method === 'GET') {
            if (pathname.endsWith('.js')) {
                return await this.fetchScript(pathname)
            }

            if (pathname === '/favicon.ico') {
                return await this.fetchAsset('favicon.ico')
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

        return await this.fetch404()
    }

    async fetchScript(pathname: string) {
        const builtScriptName = pathname.substring(1) // trim off leading /

        if (DEVELOPMENT) {
            const scriptName = builtScriptName.replace('.js', '.tsx')
            const scriptPath = `${PAGE_SCRIPTS}/${scriptName}`

            const storedHash = this.scripts.get(scriptName)
            const hash = BigInt(Bun.hash(await Bun.file(scriptPath).text()))
            if (storedHash !== hash || !await Bun.file(`${BUILD_DIR}/${builtScriptName}`).exists()) {
                const { success, logs } = await Bun.build({
                    entrypoints: [scriptPath],
                    outdir: BUILD_DIR
                })
                if (!success) {
                    throw logs.toString()
                }
                this.scripts.set(scriptName, hash)
            }
        }

        return new Response(Bun.file(`${BUILD_DIR}/${builtScriptName}`))
    }

    async fetchAsset(asset: string) {
        return new Response(Bun.file(`${ASSETS}/${asset}`))
    }

    async fetchPage(pathname: string) {
        const page = Bun.file(`${PAGES}${pathname}`)
        if (await page.exists()) {
            return new Response(page)
        } else {
            return await this.fetch404()
        }
    }

    async fetch404() {
        return new Response(`404 - File not found`, { status: 404 })
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