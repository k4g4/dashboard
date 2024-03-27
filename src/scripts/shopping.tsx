import ReactDOM from 'react-dom/client'
import { Page } from '../components/page'

ReactDOM.createRoot(document.getElementById(`root`)!).render(
    <Page pageName='shopping'>
        <h1>Shopping List</h1>
    </Page>
)