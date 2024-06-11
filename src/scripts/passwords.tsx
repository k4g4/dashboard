import ReactDOM from 'react-dom/client'
import { Page, UuidContext } from '../components/page'
import {
    Fragment, useContext, useReducer, useRef, useState,
    type ChangeEvent, type Dispatch, type FormEvent, type MouseEvent, type SetStateAction
} from 'react'
import * as schema from '../api_schema'
import useAsyncEffect from 'use-async-effect'
import { UpdateErrorContext, type UpdateError } from '../components/error'
import { ICONS } from '../components/icons'
import { ShowModalContext, type ShowModal } from '../components/modal'
import { z } from 'zod'
import { v4 as generateUuid } from 'uuid'
import moment from 'moment'

ReactDOM.createRoot(document.getElementById('root')!).render(
    <Page pageName='passwords'>
        <Passwords />
    </Page>
)

type Update =
    | { type: 'assign', entries: schema.PasswordsEntry[] }
    | { type: 'add', newEntry: schema.PasswordsEntry }
    | { type: 'remove', entryUuid: schema.Uuid }
    | { type: 'edit', editedEntry: schema.PasswordsEntry }
    | { type: 'togglefav', entryUuid: schema.Uuid }

function updateEntries(entries: schema.PasswordsEntry[], update: Update): schema.PasswordsEntry[] {
    switch (update.type) {
        case 'assign': return update.entries

        case 'add': return [...entries, update.newEntry]

        case 'remove': return entries.filter(({ entryUuid }) => entryUuid !== update.entryUuid)

        case 'edit': return entries.map(entry =>
            entry.entryUuid === update.editedEntry.entryUuid ? update.editedEntry : entry
        )

        case 'togglefav': return entries.map(entry =>
            entry.entryUuid === update.entryUuid ?
                {
                    ...entry,
                    favorite: !entry.favorite,
                }
                :
                entry
        )
    }
}

// this is just to manage prop-drilling
type Context = {
    uuid: schema.Uuid,
    entry: schema.PasswordsEntry | null,
    updateError: UpdateError,
    showModal: ShowModal,
    runReload: () => void,
    entriesUpdate: Dispatch<Update>,
}

const FADE_OUT_TIME = 1_000

function Passwords() {
    const uuid = useContext(UuidContext)
    const updateError = useContext(UpdateErrorContext)
    const showModal = useContext(ShowModalContext)

    const [entries, entriesUpdate] = useReducer(updateEntries, [])
    const [search, setSearch] = useState('')
    const [visible, setVisible] = useState(false)
    const [reload, setReload] = useState(false)
    const runReload = () => setReload(reload => !reload)

    const context: Context = {
        uuid,
        entry: null,
        updateError,
        showModal,
        runReload,
        entriesUpdate,
    }

    const onSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
        setSearch(event.target.value)
    }

    const foundEntries = entries.filter(entry =>
        entry.siteName.toLowerCase().includes(search.toLowerCase()) ||
        entry.siteUrl?.toLowerCase().includes(search.toLowerCase())
    )

    useAsyncEffect(async isMounted => {
        const options = { params: { uuid }, schema: schema.getPasswordsResponse, updateError }
        const response = await schema.apiFetch('passwords', options)
        if (response && isMounted()) {
            entriesUpdate({ type: 'assign', entries: response })
        }
    }, [reload])

    const copiedBanner = useRef<HTMLDivElement>(null)
    const [copiedTimer, setCopiedTimer] = useState<Timer>()

    // show 'Copied' banner next to cursor
    const updateCopied = (x: number, y: number) => {
        if (copiedBanner.current) {
            copiedBanner.current.style.left = `${x + 12}px`
            copiedBanner.current.style.top = `${y + 24}px`
            copiedBanner.current.style.display = 'block'
            for (const animation of copiedBanner.current.getAnimations()) {
                animation.cancel()
                animation.play()
            }
        }
        if (copiedTimer) {
            clearTimeout(copiedTimer)
        }
        setCopiedTimer(setTimeout(() => setCopiedTimer(undefined), FADE_OUT_TIME))
    }

    const entryMapper = (entries: schema.PasswordsEntry[]) => {
        return entries.map(entry => (
            <Entry
                key={entry.entryUuid}
                entry={entry}
                visible={visible}
                updateCopied={updateCopied}
                context={context}
            />
        ))
    }

    return (
        <div className='passwords-container'>
            {
                entries.length ?
                    <>
                        <div className='passwords-header'>
                            <input
                                className='passwords-search'
                                value={search}
                                placeholder='Search...'
                                onChange={onSearchChange}
                            />
                            <button className='icon-button' onClick={() => setVisible(visible => !visible)}>
                                {visible ? ICONS.EYE_DISABLED : ICONS.EYE_ENABLED}
                            </button>
                        </div>
                        <li className='passwords-list'>
                            {entryMapper(foundEntries.filter(entry => entry.favorite))}
                            {entryMapper(foundEntries.filter(entry => !entry.favorite))}
                        </li>
                    </>
                    :
                    <></>
            }
            <Options context={context} entries={entries} />
            <div className='copied-banner drop-shadow' ref={copiedBanner}>
                <h3>Copied!</h3>
            </div>
        </div>
    )
}

type EntryProps = {
    entry: schema.PasswordsEntry,
    visible: boolean,
    updateCopied: (x: number, y: number) => void,
    context: Context,
}
function Entry({ entry, visible, updateCopied, context }: EntryProps) {
    const { entryUuid, siteName, siteUrl, favorite, username, password } = entry
    const fixedSiteUrl = siteUrl && (siteUrl.startsWith('http://') ? siteUrl : `http://${siteUrl}`)
    const hiddenPassword = visible ? password : '•'.repeat(password.length)

    const onFavToggle = async () => {
        const body: z.infer<typeof schema.upsertPasswordBody> = {
            uuid: context.uuid,
            passwordsEntry: { ...entry, favorite: !entry.favorite },
        }
        if (await schema.apiFetch('passwords', { body, updateError: context.updateError })) {
            context.entriesUpdate({ type: 'togglefav', entryUuid })
        }
    }

    const entryContext: Context = { ...context, entry }

    const onCopy = (copyText: string) => {
        return async (event: MouseEvent) => {
            await navigator.clipboard.writeText(copyText)
            updateCopied(event.clientX, event.clientY)
        }
    }

    const onShowPassword = (event: MouseEvent<HTMLSpanElement>) => {
        event.currentTarget.textContent = password
    }

    const onHidePassword = (event: MouseEvent<HTMLSpanElement>) => {
        event.currentTarget.textContent = hiddenPassword
    }

    return (
        <ul className='passwords-entry'>
            <button
                className='icon-button passwords-entry-button'
                title={favorite ? 'Unfavorite' : 'Favorite'}
                onClick={onFavToggle}
            >
                {favorite ? ICONS.FULL_STAR : ICONS.EMPTY_STAR}
            </button>

            <div className='passwords-entry-contents'>
                <div className='passwords-entry-site'>
                    {siteName}
                    {siteName && siteUrl && ' - '}
                    {
                        fixedSiteUrl &&
                        <a className='passwords-entry-link' href={fixedSiteUrl} target='_blank'>{siteUrl}</a>
                    }
                </div>
                <div className='passwords-entry-credentials'>
                    <div
                        className='credential'
                        onClick={onCopy(username)}
                    >
                        {username}
                    </div>
                    &nbsp;
                    <div
                        className='credential credential-password'
                        onClick={onCopy(password)}
                        onMouseEnter={onShowPassword}
                        onMouseLeave={onHidePassword}
                    >
                        {hiddenPassword}
                    </div>
                </div>
            </div>

            <div className='passwords-entry-options'>
                <button
                    className='icon-button passwords-entry-button'
                    title='Edit'
                    onClick={() => entryContext.showModal(<Upsert context={entryContext} />)}
                >
                    {ICONS.EDIT}
                </button>
                <button
                    className='icon-button passwords-entry-button passwords-entry-delete-button'
                    title='Delete'
                    onClick={() => entryContext.showModal(<ConfirmDelete context={entryContext} />)}
                >
                    {ICONS.XMARK}
                </button>
            </div>
        </ul>
    )
}

function Options({ context, entries }: { context: Context, entries: schema.PasswordsEntry[] }) {
    const uploader = useRef<HTMLInputElement>(null)
    const downloader = useRef<HTMLAnchorElement>(null)

    const onImport = async (event: ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            const json = await event.target.files.item(0)?.text()
            if (json) {
                const result = schema.bitwardenOuterFormat.safeParse(json)
                if (result.success) {
                    const body: z.infer<typeof schema.importBitwardenBody> = {
                        uuid: context.uuid,
                        bwJson: result.data,
                    }
                    if (await schema.apiFetch('importpasswords', { body, updateError: context.updateError })) {
                        context.runReload()
                    }
                } else {
                    context.updateError('invalid JSON file')
                }
            } else {
                context.updateError('invalid JSON file')
            }
        } else {
            context.updateError('no file provided')
        }
    }

    const onExport = () => {
        type BitwardenItem =
            & z.infer<typeof schema.bitwardenPasswordItem>
            & {
                object: 'item',
                type: 1,
                deletedDate: null,
            }

        if (downloader.current) {
            const items =
                entries.map((entry): BitwardenItem => ({
                    id: entry.entryUuid,
                    deletedDate: null,
                    object: 'item',
                    type: 1,
                    favorite: entry.favorite,
                    name: entry.siteName,
                    login: {
                        uris: [{ uri: entry.siteUrl }],
                        username: entry.username,
                        password: entry.password,
                    },
                }))
            const data = {
                encrypted: false,
                folders: [],
                items,
            }
            const file = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
            downloader.current.href = URL.createObjectURL(file)
            downloader.current.download = `bitwarden_export_${moment().format('YYYYMMDDHHmmss')}.json`
            downloader.current.click()
            URL.revokeObjectURL(downloader.current.href)
        }
    }

    return (
        <div className='passwords-options'>
            <button
                className='button'
                onClick={() => context.showModal(<Upsert context={context} />)}
            >
                Add
            </button>
            <input type='file' accept='.json' onChange={onImport} ref={uploader} hidden />
            <button className='button' onClick={() => uploader.current?.click()}>
                Import
            </button>
            <a ref={downloader} hidden />
            <button className='button' onClick={onExport}>
                Export
            </button>
            <button
                className='button danger-button'
                onClick={() => context.showModal(<ConfirmDelete context={context} />)}
            >
                Delete All
            </button>
        </div>
    )
}

function Upsert({ context: { uuid, entry, updateError, showModal, entriesUpdate: passwordsUpdate } }: { context: Context }) {
    const [siteName, setSiteName] = useState(entry?.siteName ?? '')
    const [siteUrl, setSiteUrl] = useState(entry?.siteUrl ?? '')
    const [username, setUsername] = useState(entry?.username ?? '')
    const [password, setPassword] = useState(entry?.password ?? '')
    const [favorite, setFavorite] = useState(entry?.favorite ?? false)
    const fields: { field: string, value: string, setValue: Dispatch<SetStateAction<string>>, hide: boolean }[] = [
        {
            field: 'Website Name',
            value: siteName,
            setValue: setSiteName,
            hide: false,
        },
        {
            field: 'Website URL',
            value: siteUrl,
            setValue: setSiteUrl,
            hide: false,
        },
        {
            field: 'Username',
            value: username,
            setValue: setUsername,
            hide: false,
        },
        {
            field: 'Password',
            value: password,
            setValue: setPassword,
            hide: true,
        },
    ]

    const onFieldChange = (setValue: Dispatch<SetStateAction<string>>) => {
        return (event: ChangeEvent<HTMLInputElement>) => {
            setValue(event.target.value)
        }
    }

    const onUpsertSubmit = async (event: FormEvent) => {
        event.preventDefault()

        const upsertEntry: schema.PasswordsEntry = {
            entryUuid: entry?.entryUuid ?? schema.uuid.parse(generateUuid()),
            favorite,
            siteName,
            siteUrl,
            username,
            password,
        }
        const body: z.infer<typeof schema.upsertPasswordBody> = {
            uuid,
            passwordsEntry: upsertEntry,
        }
        if (await schema.apiFetch('passwords', { body, updateError })) {
            passwordsUpdate(entry ? { type: 'edit', editedEntry: upsertEntry } : { type: 'add', newEntry: upsertEntry })
            showModal()
        }
    }

    const onFavClick = (event: MouseEvent) => {
        event.preventDefault()
        setFavorite(favorite => !favorite)
    }

    return (
        <form onSubmit={onUpsertSubmit}>
            <div className='passwords-modal'>
                <h1>{entry ? 'Edit Entry' : 'Add New Entry'}</h1>
                <div className='modal-fields'>
                    {
                        fields.map(({ field, value, setValue, hide }) => {
                            return (
                                <Fragment key={field}>
                                    <label>{field}</label>
                                    <input
                                        className='modal-field'
                                        type={hide ? 'password' : 'text'}
                                        value={value}
                                        onChange={onFieldChange(setValue)}
                                    />
                                </Fragment>
                            )
                        })
                    }
                    {
                        entry ?
                            <></>
                            :
                            <>
                                <label>Favorite</label>
                                <button className={`modal-field-fav ${favorite ? 'faved' : ''}`} onClick={onFavClick} />
                            </>
                    }
                </div>
                <input type='submit' className='button submit-button' value={entry ? 'Edit' : 'Add'} />
            </div>
        </form>
    )
}

function ConfirmDelete({ context: { uuid, entry, updateError, showModal, entriesUpdate } }: { context: Context }) {
    const onConfirmDeleteClick = async () => {
        const body: z.infer<typeof schema.deletePasswordBody> = {
            uuid,
            entryUuid: entry?.entryUuid ?? null,
        }
        if (await schema.apiFetch('deletepassword', { body, updateError })) {
            if (entry) {
                entriesUpdate({ type: 'remove', entryUuid: entry.entryUuid })
            } else {
                entriesUpdate({ type: 'assign', entries: [] })
            }
            showModal()
        }
    }

    return (
        <div className='passwords-modal'>
            <h1>{entry ? `Delete entry for '${entry.siteName}'?` : 'Delete all entries?'}</h1>
            <button className='button submit-button danger-button' onClick={onConfirmDeleteClick}>
                Confirm
            </button>
        </div>
    )
}