import { useState } from 'react'
import ReactDOM from 'react-dom/client'
import { Page } from '../page'

ReactDOM.createRoot(document.getElementById(`root`)!).render(
    <Component />
)

function Component() {
    const [n, setN] = useState(0)

    return (
        <Page>
            <h1>Hello, world!</h1>
        </Page>
    )
}