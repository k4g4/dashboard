import ReactDOM from 'react-dom/client'
import { Page } from '../components/page'

ReactDOM.createRoot(document.getElementById(`root`)!).render(
    <Page pageName='home'>
        <h1>Hello, world!</h1>
    </Page>
)