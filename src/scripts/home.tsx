import ReactDOM from 'react-dom/client'
import { Page } from '../components/page'
import { Greeting } from '../components/greeting'

ReactDOM.createRoot(document.getElementById(`root`)!).render(
    <Page pageName='home'>
        <Greeting />
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => <p key={n} style={{ marginBottom: 200 }}>{n}</p>)}
    </Page >
)