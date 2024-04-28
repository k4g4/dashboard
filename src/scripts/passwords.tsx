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
import type { z } from 'zod'
import { v4 as generateUuid } from 'uuid'

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

function updatePasswords(passwords: schema.PasswordsEntry[], update: Update): schema.PasswordsEntry[] {
    switch (update.type) {
        case 'assign': return update.entries

        case 'add': return [...passwords, update.newEntry]

        case 'remove': return passwords.filter(({ entryUuid }) => entryUuid !== update.entryUuid)

        case 'edit': return passwords.map(entry =>
            entry.entryUuid === update.editedEntry.entryUuid ? update.editedEntry : entry
        )

        case 'togglefav': return passwords.map(entry =>
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
    passwordsUpdate: Dispatch<Update>,
}

const FADE_OUT_TIME = 1_000

function Passwords() {
    const uuid = useContext(UuidContext)
    const updateError = useContext(UpdateErrorContext)
    const showModal = useContext(ShowModalContext)

    const [passwords, passwordsUpdate] = useReducer(updatePasswords, [])
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
        passwordsUpdate,
    }

    const onSearchChange = (event: ChangeEvent<HTMLInputElement>) => {
        setSearch(event.target.value)
    }

    const foundPasswords = passwords.filter(password =>
        password.siteName.toLowerCase().includes(search.toLowerCase()) ||
        password.siteUrl?.toLowerCase().includes(search.toLowerCase())
    )

    useAsyncEffect(async isMounted => {
        const options = { params: { uuid }, schema: schema.getPasswordsResponse, updateError }
        const response = await schema.apiFetch('passwords', options)
        if (response && isMounted()) {
            passwordsUpdate({ type: 'assign', entries: response })
        }
    }, [reload])

    const copiedBanner = useRef<HTMLDivElement>(null)
    const [copiedTimer, setCopiedTimer] = useState<Timer>()

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

    const entryMapper = (passwords: schema.PasswordsEntry[]) => {
        return passwords.map(entry => (
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
                passwords.length ?
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
                            {entryMapper(foundPasswords.filter(entry => entry.favorite))}
                            {entryMapper(foundPasswords.filter(entry => !entry.favorite))}
                        </li>
                    </>
                    :
                    <></>
            }
            <Options context={context} />
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
    const hiddenPassword = visible ? password : '•'.repeat(password.length)

    const onFavToggle = async () => {
        const body: z.infer<typeof schema.upsertPasswordBody> = {
            uuid: context.uuid,
            passwordsEntry: { ...entry, favorite: !entry.favorite },
        }
        if (await schema.apiFetch('passwords', { body, updateError: context.updateError })) {
            context.passwordsUpdate({ type: 'togglefav', entryUuid })
        }
    }

    const entryContext: Context = { ...context, entry }

    const onCopy = (copyText: string) => {
        return (event: MouseEvent) => {
            navigator.clipboard.writeText(copyText)
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
                    {siteName}{siteName && siteUrl && ' - '}{siteUrl}
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

function Options({ context }: { context: Context }) {
    const uploader = useRef<HTMLInputElement>(null)

    const onImport = async (event: ChangeEvent<HTMLInputElement>) => {
        if (event.target.files && event.target.files.length > 0) {
            const json = await event.target.files.item(0)?.text()
            if (json) {
                const body: z.infer<typeof schema.importBitwardenBody> = {
                    uuid: context.uuid,
                    bwJson: JSON.parse(json)
                }
                if (await schema.apiFetch('importpasswords', { body, updateError: context.updateError })) {
                    context.runReload()
                }
            } else {
                context.updateError('invalid JSON file')
            }
        } else {
            context.updateError('no file provided')
        }
    }

    const onExport = () => {

    }

    return (
        <div className='passwords-options'>
            <button
                className='button'
                onClick={() => context.showModal(<Upsert context={context} />)}
            >
                Add
            </button>
            <input type='file' accept='.json' onChange={onImport} ref={uploader} />
            <button className='button' onClick={() => uploader.current?.click()}>
                Import
            </button>
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

function Upsert({ context: { uuid, entry, updateError, showModal, passwordsUpdate } }: { context: Context }) {
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

function ConfirmDelete({ context: { uuid, entry, updateError, showModal, passwordsUpdate } }: { context: Context }) {
    const onConfirmDeleteClick = async (event: FormEvent) => {
        const body: z.infer<typeof schema.deletePasswordBody> = {
            uuid,
            entryUuid: entry?.entryUuid ?? null,
        }
        if (await schema.apiFetch('deletepassword', { body, updateError })) {
            if (entry) {
                passwordsUpdate({ type: 'remove', entryUuid: entry.entryUuid })
            } else {
                passwordsUpdate({ type: 'assign', entries: [] })
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