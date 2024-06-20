import ReactDOM from 'react-dom/client'
import { Page } from '../components/page'

ReactDOM.createRoot(document.getElementById(`root`)!).render(
    <Page pageName='weather'>
        <h1>Weather</h1>
    </Page>
)