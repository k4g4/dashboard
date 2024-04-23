export function include(path: string): string {
    //@ts-ignore (bun will await promises in macros)
    return Bun.file(path).text()
}