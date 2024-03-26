import { useState } from 'react'
import ReactDOM from 'react-dom/client'

ReactDOM.createRoot(document.getElementById(`root`)!).render(
    <Component />
)

function Component() {
    const [n, setN] = useState(0)

    return (
        <>
            <h2>{n}</h2>
            <button onClick={() => setN(n => n + 1)}>Click!</button>
        </>
    )
}