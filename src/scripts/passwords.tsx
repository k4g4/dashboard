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

const FADE_OUT_TIME = 1_000

function Passwords() {
    const uuid = useContext(UuidContext)
    const updateError = useContext(UpdateErrorContext)
    const showModal = useContext(ShowModalContext)

    const [passwords, passwordsUpdate] = useReducer(updatePasswords, [])
    const [search, setSearch] = useState('')
    const [reload, setReload] = useState(false)
    const runReload = () => setReload(reload => !reload)

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
                showModal={showModal}
                passwordsUpdate={passwordsUpdate}
                updateCopied={updateCopied}
            />
        ))
    }

    return (
        <div>
            {
                passwords.length ?
                    <>
                        <div className='passwords-search-container'>
                            <input
                                className='passwords-search'
                                value={search}
                                placeholder='Search...'
                                onChange={onSearchChange}
                            />
                        </div>
                        <li className='passwords-list'>
                            {entryMapper(foundPasswords.filter(entry => entry.favorite))}
                            {entryMapper(foundPasswords.filter(entry => !entry.favorite))}
                        </li>
                    </>
                    :
                    <></>
            }
            <Options
                showModal={showModal}
                passwordsUpdate={passwordsUpdate}
                runReload={runReload}
            />
            <div className='copied-banner drop-shadow' ref={copiedBanner}>
                <h3>Copied!</h3>
            </div>
        </div>
    )
}

type EntryProps = {
    entry: schema.PasswordsEntry,
    showModal: ShowModal,
    passwordsUpdate: Dispatch<Update>,
    updateCopied: (x: number, y: number) => void,
}
function Entry({ entry, showModal, passwordsUpdate, updateCopied }: EntryProps) {
    const { entryUuid, siteName, siteUrl, favorite, username, password } = entry
    const hiddenPassword = '•'.repeat(password.length)

    const onFavToggle = () => {
        passwordsUpdate({ type: 'togglefav', entryUuid })
    }

    const onEditClick = () => {
        showModal(<Edit entryUuid={entryUuid} passwordsUpdate={passwordsUpdate} />)
    }

    const onDeleteClick = () => {
        showModal(
            <ConfirmDelete
                entryUuid={entryUuid}
                siteName={siteName}
                passwordsUpdate={passwordsUpdate}
            />
        )
    }

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
                    {siteName}{siteUrl && ` - ${siteUrl}`}
                </div>
                <div className='passwords-entry-credentials'>
                    <span
                        className='credential'
                        onClick={onCopy(username)}
                    >
                        {username}
                    </span>
                    &nbsp;
                    <span
                        className='credential credential-password'
                        onClick={onCopy(password)}
                        onMouseEnter={onShowPassword}
                        onMouseLeave={onHidePassword}
                    >
                        {hiddenPassword}
                    </span>
                </div>
            </div>

            <div className='passwords-entry-options'>
                <button
                    className='icon-button passwords-entry-button'
                    title='Edit'
                    onClick={onEditClick}
                >
                    {ICONS.EDIT}
                </button>
                <button
                    className='icon-button passwords-entry-button passwords-entry-delete-button'
                    title='Delete'
                    onClick={onDeleteClick}
                >
                    {ICONS.XMARK}
                </button>
            </div>
        </ul>
    )
}

type OptionsProps = {
    showModal: ShowModal,
    passwordsUpdate: Dispatch<Update>,
    runReload: () => void,
}
function Options({ showModal, passwordsUpdate, runReload }: OptionsProps) {
    return (
        <div className='passwords-options'>
            <button
                className='button'
                onClick={() => showModal(<Add passwordsUpdate={passwordsUpdate} />)}
            >
                Add
            </button>
            <button
                className='button'
                onClick={() => showModal(<Import runReload={runReload} />)}
            >
                Import
            </button>
            <button
                className='button'
                onClick={() => showModal(<Export />)}
            >
                Export
            </button>
        </div>
    )
}

type PasswordsModalField = {
    field: string,
    value: string,
    setValue: Dispatch<SetStateAction<string>>,
    hide: boolean,
}
type PasswordsModalProps = {
    title: string,
    fields: PasswordsModalField[],
    submitLabel: string,
    onSubmit: (uuid: schema.Uuid, updateError: UpdateError, showModal: ShowModal) => Promise<any>,
}
function PasswordsModal({ title, fields, submitLabel, onSubmit }: PasswordsModalProps) {
    const uuid = useContext(UuidContext)
    const updateError = useContext(UpdateErrorContext)
    const showModal = useContext(ShowModalContext)

    const onFieldChange = (setValue: Dispatch<SetStateAction<string>>) => {
        return (event: ChangeEvent<HTMLInputElement>) => {
            setValue(event.target.value)
        }
    }

    const onModalSubmit = async (event: FormEvent) => {
        event.preventDefault()
        await onSubmit(uuid, updateError, showModal)
    }

    return (
        <form onSubmit={onModalSubmit}>
            <div className='passwords-modal'>
                <h1>{title}</h1>
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
                </div>
                <input type='submit' className='button submit-button' value={submitLabel} />
            </div>
        </form>
    )
}

function Edit({ entryUuid, passwordsUpdate }: { entryUuid: schema.Uuid, passwordsUpdate: Dispatch<Update> }) {
    const [siteName, setSiteName] = useState('')
    const [siteUrl, setSiteUrl] = useState('')
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')

    const onEditSubmit = (uuid: schema.Uuid, updateError: UpdateError, showModal: ShowModal) => {
        return new Promise(() => {
            console.log(uuid, entryUuid, siteName, siteUrl, username, password)
        })
    }

    const fields: PasswordsModalField[] = [
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

    return <PasswordsModal
        title='Add Password Entry'
        fields={fields}
        submitLabel='Edit'
        onSubmit={onEditSubmit}
    />
}

type ConfirmDeleteProps = {
    entryUuid: schema.Uuid,
    siteName: string,
    passwordsUpdate: Dispatch<Update>,
}
function ConfirmDelete({ entryUuid, siteName, passwordsUpdate }: ConfirmDeleteProps) {
    const onConfirmDeleteSubmit = (uuid: schema.Uuid, updateError: UpdateError, showModal: ShowModal) => {
        return new Promise(() => {
            console.log(uuid, entryUuid)
        })
    }

    return <PasswordsModal
        title={`Delete entry for '${siteName}'?`}
        fields={[]}
        submitLabel='Confirm'
        onSubmit={onConfirmDeleteSubmit}
    />
}

function Add({ passwordsUpdate }: { passwordsUpdate: Dispatch<Update> }) {
    const [siteName, setSiteName] = useState('')
    const [siteUrl, setSiteUrl] = useState('')
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')

    const onConfirmDeleteSubmit = (uuid: schema.Uuid, updateError: UpdateError, showModal: ShowModal) => {
        return new Promise(() => {
            console.log(uuid, siteName, siteUrl, username, password)
        })
    }

    const fields: PasswordsModalField[] = [
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

    return <PasswordsModal
        title='Add Password Entry'
        fields={fields}
        submitLabel='Add'
        onSubmit={onConfirmDeleteSubmit}
    />
}

function Import({ runReload }: { runReload: () => void }) {
    const onImportSubmit = async (uuid: schema.Uuid, updateError: UpdateError, showModal: ShowModal) => {
        return new Promise(() => {
            console.log()
        })
    }

    const fields: PasswordsModalField[] = [
    ]

    return <PasswordsModal
        title='Import from Bitwarden'
        fields={fields}
        submitLabel='Import'
        onSubmit={onImportSubmit}
    />
}

function Export() {
    const onExportSubmit = (uuid: schema.Uuid, updateError: UpdateError, showModal: ShowModal) => {
        return new Promise(() => {
            console.log()
        })
    }

    const fields: PasswordsModalField[] = [
    ]

    return <PasswordsModal
        title='Export to Bitwarden'
        fields={fields}
        submitLabel='Export'
        onSubmit={onExportSubmit}
    />
}