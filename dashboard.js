// src/dashboard.ts
var {readdirSync, mkdirSync, statSync} = (()=>({}));
var {stat} = (()=>({}));
var BUILD_DIR = Bun.env.BUILD_DIR ?? "build";
var PORT = Bun.env.PORT ?? "3000";
var DEVELOPMENT = Bun.env.DEVELOPMENT === "true";
var SRC = "src";
var PAGE_SCRIPTS = `${SRC}/scripts`;
var PAGES = "pages";
var ASSETS = "assets";

class Dashboard {
  scripts;
  constructor() {
    try {
      mkdirSync(BUILD_DIR);
    } catch {
    }
    this.scripts = new Map(DEVELOPMENT ? readdirSync(PAGE_SCRIPTS).map((script) => {
      const { mtimeMs } = statSync(`${PAGE_SCRIPTS}/${script}`);
      return [script, mtimeMs];
    }) : []);
  }
  async fetch(req) {
    const { method, url } = req;
    const { pathname, searchParams } = new URL(url);
    if (method === "GET") {
      if (pathname.endsWith(".js")) {
        return await this.fetchScript(pathname);
      }
      if ([".ico", ".png", ".css"].some((ext) => pathname.endsWith(ext))) {
        return await this.fetchAsset(pathname);
      }
      let page;
      if (pathname === "/") {
        page = "/index.htm";
      } else if (!pathname.endsWith(".htm")) {
        page = `${pathname}.htm`;
      } else {
        page = pathname;
      }
      return await this.fetchPage(page);
    }
    return await this.fetch404();
  }
  async fetchScript(pathname) {
    const builtScriptName = pathname.substring(1);
    if (DEVELOPMENT) {
      const scriptName = builtScriptName.replace(".js", ".tsx");
      const scriptPath = `${PAGE_SCRIPTS}/${scriptName}`;
      const storedMtimeMs = this.scripts.get(scriptName);
      const { mtimeMs } = await stat(scriptPath);
      if (storedMtimeMs !== mtimeMs || !await Bun.file(`${BUILD_DIR}/${builtScriptName}`).exists()) {
        const { success, logs } = await Bun.build({
          entrypoints: [scriptPath],
          outdir: BUILD_DIR
        });
        if (!success) {
          throw `build error for ${scriptPath}:\n${logs}`;
        }
        this.scripts.set(scriptName, mtimeMs);
      }
    }
    return new Response(Bun.file(`${BUILD_DIR}/${builtScriptName}`));
  }
  async fetchAsset(asset) {
    return new Response(Bun.file(`${ASSETS}${asset}`));
  }
  async fetchPage(pathname) {
    const page = Bun.file(`${PAGES}${pathname}`);
    if (await page.exists()) {
      return new Response(page);
    } else {
      return await this.fetch404();
    }
  }
  async fetch404() {
    return new Response(`404 - File not found`, { status: 404 });
  }
  serve() {
    const server = Bun.serve({
      fetch: (req) => this.fetch(req),
      development: DEVELOPMENT,
      port: PORT
    });
    return server.url;
  }
}

// src/index.ts
var dashboard2 = new Dashboard;
var url = dashboard2.serve();
console.log(`listening on ${url}`);
