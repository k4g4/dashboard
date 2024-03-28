import ReactDOM from 'react-dom/client'
import { Page } from '../components/page'
import { Greeting } from '../components/greeting'

ReactDOM.createRoot(document.getElementById(`root`)!).render(
    <Page pageName='home'>
        <Greeting />
    </Page>
)