import ReactDOM from 'react-dom/client'
import { Page, UuidContext } from '../components/page'
import * as schema from '../api_schema'
import { useContext, useState, type ChangeEvent, type FormEvent } from 'react'
import useAsyncEffect from 'use-async-effect'
import { UpdateErrorContext, type UpdateError } from '../components/error'
import { ShowModalContext } from '../components/modal'
import { ICONS } from '../components/icons'
import { env } from '../env_macro' with { type: 'macro' }
import { z } from 'zod'

ReactDOM.createRoot(document.getElementById('root')!).render(
    <Page pageName='shopping'>
        <List />
    </Page>
)

function List() {
    const uuid = useContext(UuidContext)
    const updateError = useContext(UpdateErrorContext)

    const [list, setList] = useState<schema.ShoppingItem[]>([])
    const [newItem, setNewItem] = useState('')

    const [reload, setReload] = useState(false)
    const runReload = () => setReload(reload => !reload)

    useAsyncEffect(async isMounted => {
        const options = { params: { uuid }, schema: schema.shoppingListResponse, updateError }
        const response = await schema.apiFetch('shoppinglist', options)
        if (response && isMounted()) {
            setList(response)
        }
    }, [reload])

    const onNewItemChange = (event: ChangeEvent<HTMLInputElement>) => {
        setNewItem(event.target.value)
    }

    const onNewItemSubmit = async (event: FormEvent) => {
        event.preventDefault()

        const [searchCx, searchKey] = [env('CUSTOM_SEARCH_CX'), env('CUSTOM_SEARCH_KEY')]
        const res = await fetch(`https://www.googleapis.com/customsearch/v1?key=${searchKey}&cx=${searchCx}&q=${newItem}`)
        if (res.status !== 200) {
            updateError('failed to fetch Google search data')
            return
        }
        const resJson = await res.json()
        if (!resJson.items.length) {
            updateError(`no results found for '${newItem}'`)
            return
        }
        const item = resJson.items[0]
        const body: z.infer<typeof schema.newShoppingItemBody> = {
            uuid,
            name: newItem,
            imageUrl: item.pagemap.metatags[0]['og:image'],
            itemUrl: item.link,
            description: item.title,
        }
        await schema.apiFetch('shoppinglist', { body, updateError })

        runReload()
    }

    return (
        <>
            <form className='new-item-form' onSubmit={onNewItemSubmit}>
                <input
                    className='new-item-field'
                    placeholder='New item'
                    value={newItem}
                    onChange={onNewItemChange}
                />
                <input
                    className='new-item-add button'
                    type='submit'
                    value='Add'
                />
            </form>
            &nbsp;
            <ul className='shopping-list'>
                {
                    list.map(item => (
                        <li key={item.itemUuid}>
                            <Item uuid={uuid} updateError={updateError} item={item} />
                        </li>
                    ))
                }
            </ul>
        </>
    )
}

type ItemProps = { uuid: schema.Uuid, updateError: UpdateError, item: schema.ShoppingItem }
function Item({ uuid, updateError, item: { itemUuid, name, imageUrl, itemUrl, description } }: ItemProps) {
    const onDelete = () => {

    }

    return (
        <div className='shopping-item'>
            <a href={itemUrl} target='_blank'><img src={imageUrl} height='120' /></a>
            <div className='shopping-item-detail'>
                <div className='shopping-item-name'>{name}</div>
                <div className='shopping-item-desc'>{description}</div>
            </div>
            <button className='shopping-item-remove icon-button danger-button' onClick={onDelete}>
                {ICONS.XMARK}
            </button>
        </div>
    )
}