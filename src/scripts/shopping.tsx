import ReactDOM from 'react-dom/client'
import { Page, UuidContext } from '../components/page'
import * as schema from '../api_schema'
import { useContext, useState } from 'react'
import useAsyncEffect from 'use-async-effect'
import { UpdateErrorContext } from '../components/error'
import { ShowModalContext } from '../components/modal'

ReactDOM.createRoot(document.getElementById('root')!).render(
    <Page pageName='shopping'>
        <List />
    </Page>
)

function List() {
    const uuid = useContext(UuidContext)
    const updateError = useContext(UpdateErrorContext)
    const showModal = useContext(ShowModalContext)

    const [list, setList] = useState<schema.ShoppingItem[]>([])

    const [reload, setReload] = useState(false)
    const runReload = () => setReload(reload => !reload)

    useAsyncEffect(async isMounted => {
        const options = { params: { uuid }, schema: schema.shoppingListResponse, updateError }
        const response = await schema.apiFetch('shoppinglist', options)
        if (response && isMounted()) {
            setList(response)
        }
    }, [reload])

    return (
        <ul>
            {list.map(item => <li key={item.itemUuid}><Item item={item} /></li>)}
        </ul>
    )
}

function Item({ item }: { item: schema.ShoppingItem }) {
    return (
        <div className='shopping-item'>{item.itemUuid} - {item.name} - {item.description}</div>
    )
}