import { useContext } from "react"
import { UuidContext } from "./page"

export function Greeting() {
    const uuid = useContext(UuidContext)

    return (
        <h1>Hello, {uuid}!</h1>
    )
}