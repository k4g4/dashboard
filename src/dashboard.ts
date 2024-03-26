import { readdirSync, readFileSync } from 'node:fs'

const BUILD_DIR = Bun.env.BUILD_DIR ?? 'build'
const PORT = Bun.env.PORT ?? '3000'
const DEVELOPMENT = Bun.env.DEVELOPMENT === 'true'
const SRC = 'src'
const PAGES = 'pages'

export class Dashboard {
    scripts: Map<string, bigint>

    constructor() {
        this.scripts = new Map(
            DEVELOPMENT ?
                // cache the hash of each script to rebuild them if they change
                readdirSync('src').map(script => {
                    const hash = Bun.hash(readFileSync(`${SRC}/${script}`))
                    return [script, BigInt(hash)]
                }) :
                []
        )
    }

    async fetch(req: Request) {
        const { method, url } = req
        const { pathname, searchParams } = new URL(url)

        if (method === 'GET') {
            if (pathname === '/') {
                return new Response(Bun.file(`${PAGES}/index.htm`))
            } else if (pathname.endsWith('.js')) {
                return await this.fetchScript(pathname)
            } else {
                return await this.fetchPage(pathname)
            }
        }
        return await this.fetch404()
    }

    async fetchScript(pathname: string) {
        const builtScriptName = pathname.substring(1) // trim off leading /

        if (DEVELOPMENT) {
            const scriptName = builtScriptName.replace('.js', '.tsx')
            const scriptPath = `${SRC}/${scriptName}`

            const storedHash = this.scripts.get(scriptName)
            const hash = BigInt(Bun.hash(await Bun.file(scriptPath).text()))
            if (storedHash !== hash) {
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