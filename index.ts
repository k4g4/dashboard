const development = Bun.env.DEVELOPMENT === 'true'

let files: Map<string, string>
if (development) {
    files = new Map([["/", "index.htm"]])
} else {
    const { success, logs, outputs } = await Bun.build({
        entrypoints: ["index.htm"],
        outdir: Bun.env.OUT_DIR,
    })

    if (!success) {
        throw logs.toString()
    }
    files = new Map([["/", require(outputs[0].path)]])
}

async function fetch(req: Request) {
    const { method, url } = req
    const { pathname, searchParams } = new URL(url)

    if (method === 'GET') {
        const page = files.get(pathname)
        if (!page) {
            return new Response(`404 - File not found`, { status: 404 })
        }
        return new Response(Bun.file(page))
    }

    return new Response(`404 - File not found`, { status: 404 })
}

const server = Bun.serve({
    fetch,
    development,
    port: Bun.env.PORT,
})

console.log(`listening on ${server.url}`)