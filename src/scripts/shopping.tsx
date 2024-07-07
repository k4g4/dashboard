import ReactDOM from 'react-dom/client'
import { Page, UuidContext } from '../components/page'
import * as schema from '../api_schema'
import { useContext, useState, type ChangeEvent, type FormEvent } from 'react'
import useAsyncEffect from 'use-async-effect'
import { UpdateErrorContext, type UpdateError } from '../components/error'
import { ShowModalContext, type ShowModal } from '../components/modal'
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
    const showModal = useContext(ShowModalContext)

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

        const customSearch = new URL('https://www.googleapis.com/customsearch/v1')
        customSearch.searchParams.append('key', env('CUSTOM_SEARCH_KEY'))
        customSearch.searchParams.append('cx', env('CUSTOM_SEARCH_CX'))
        customSearch.searchParams.append('q', newItem)

        const res = await fetch(customSearch)
        if (res.status !== 200) {
            updateError('failed to fetch Google search data')
            return
        }
        const resJson = await res.json()
        if (!resJson.items || !resJson.items.length) {
            updateError(`no results found for '${newItem}'`)
            return
        }
        try {
            const item = resJson.items[0]
            const body: z.infer<typeof schema.newShoppingItemBody> = {
                uuid,
                name: newItem,
                imageUrl: item.pagemap.cse_thumbnail[0].src,
                itemUrl: item.link,
                description: item.title,
            }
            await schema.apiFetch('shoppinglist', { body, updateError })

            setNewItem('')
            runReload()
        }
        catch {
            updateError(`failed to add '${newItem}'`)
        }
    }

    const onClearAll = () => {
        showModal(
            <ClearAllModal uuid={uuid} updateError={updateError} runReload={runReload} showModal={showModal} />
        )
    }

    return (
        <>
            <div className='shopping-list-controls'>
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
                <button
                    className='shopping-list-clear button danger-button'
                    onClick={onClearAll}
                    disabled={!list.length}
                >
                    Clear All
                </button>
            </div>
            &nbsp;
            <ul className='shopping-list'>
                {
                    list.map(item => (
                        <li key={item.itemUuid}>
                            <Item uuid={uuid} updateError={updateError} item={item} runReload={runReload} />
                        </li>
                    ))
                }
            </ul>
        </>
    )
}

type ClearAllModalProps = { uuid: schema.Uuid, updateError: UpdateError, runReload: () => void, showModal: ShowModal }
function ClearAllModal({ uuid, updateError, runReload, showModal }: ClearAllModalProps) {
    const onClearAll = async () => {
        if (await schema.apiFetch('clearshopping', { body: { uuid }, updateError })) {
            runReload()
            showModal()
        }
    }

    return (
        <div className='clear-all-modal'>
            <h1>Clear all items?</h1>
            <button className='button submit-button danger-button' onClick={onClearAll}>
                Confirm
            </button>
        </div>
    )
}

type ItemProps = { uuid: schema.Uuid, updateError: UpdateError, item: schema.ShoppingItem, runReload: () => void }
function Item({ uuid, updateError, item: { itemUuid, name, imageUrl, itemUrl, description }, runReload }: ItemProps) {
    const titleName = name.split(' ').map(word => word[0].toUpperCase() + word.substring(1)).join(' ')
    //remove unneeded suffix from the custom search
    const trimmedDesc = description.split(' - ')[0].split(' – ')[0]

    const onDelete = async () => {
        const body: z.infer<typeof schema.deleteShoppingItemBody> = { uuid, itemUuid }
        if (await schema.apiFetch('deleteshopping', { body, updateError })) {
            runReload()
        }
    }

    return (
        <div className='shopping-item'>
            <a href={itemUrl} target='_blank'><img src={imageUrl} height='120' /></a>
            <div className='shopping-item-detail'>
                <div className='shopping-item-name'>{titleName}</div>
                <div className='shopping-item-desc'>{trimmedDesc}</div>
            </div>
            <button className='shopping-item-remove icon-button danger-button' onClick={onDelete}>
                {ICONS.XMARK}
            </button>
        </div>
    )
}