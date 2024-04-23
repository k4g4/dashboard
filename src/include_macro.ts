import { readFileSync } from 'node:fs'

export function include(path: string) {
    return readFileSync(path).toString()
}