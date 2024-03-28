export function env(key: string) {
    const value = Bun.env[key]
    if (!value) {
        throw `env var '${key}' not configured`
    }
    return value
}