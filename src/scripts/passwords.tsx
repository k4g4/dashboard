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
type ModalData = {
    uuid: schema.Uuid,
    entryUuid: schema.Uuid | null,
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

    const modalData: ModalData = {
        uuid,
        entryUuid: null,
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
                modalData={modalData}
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
            <Options modalData={modalData} />
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
    modalData: ModalData,
}
function Entry({ entry, visible, updateCopied, modalData }: EntryProps) {
    const { entryUuid, siteName, siteUrl, favorite, username, password } = entry
    const hiddenPassword = visible ? password : '•'.repeat(password.length)

    const entryModalData: ModalData = { ...modalData, entryUuid }

    const onFavToggle = () => {
        entryModalData.passwordsUpdate({ type: 'togglefav', entryUuid })
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
                    onClick={() => entryModalData.showModal(<Upsert modalData={entryModalData} />)}
                >
                    {ICONS.EDIT}
                </button>
                <button
                    className='icon-button passwords-entry-button passwords-entry-delete-button'
                    title='Delete'
                    onClick={() => entryModalData.showModal(<ConfirmDelete siteName={siteName} modalData={entryModalData} />)}
                >
                    {ICONS.XMARK}
                </button>
            </div>
        </ul>
    )
}

function Options({ modalData }: { modalData: ModalData }) {
    return (
        <div className='passwords-options'>
            <button
                className='button'
                onClick={() => modalData.showModal(<Upsert modalData={modalData} />)}
            >
                Add
            </button>
            <button
                className='button'
            >
                Import
            </button>
            <button
                className='button'
            >
                Export
            </button>
        </div>
    )
}

function Upsert({ modalData: { uuid, entryUuid, updateError, showModal, passwordsUpdate } }: { modalData: ModalData }) {
    const fields: { field: string, valueState: [string, Dispatch<SetStateAction<string>>], hide: boolean }[] = [
        {
            field: 'Website Name',
            valueState: useState(''),
            hide: false,
        },
        {
            field: 'Website URL',
            valueState: useState(''),
            hide: false,
        },
        {
            field: 'Username',
            valueState: useState(''),
            hide: false,
        },
        {
            field: 'Password',
            valueState: useState(''),
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
    }

    return (
        <form onSubmit={onUpsertSubmit}>
            <div className='passwords-modal'>
                <h1>{entryUuid ? 'Edit Entry' : 'Add New Entry'}</h1>
                <div className='modal-fields'>
                    {
                        fields.map(({ field, valueState: [value, setValue], hide }) => {
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
                <input type='submit' className='button submit-button' value={entryUuid ? 'Edit' : 'Add'} />
            </div>
        </form>
    )
}

function ConfirmDelete(
    {
        siteName,
        modalData: { uuid, entryUuid, updateError, showModal, passwordsUpdate },
    }: { siteName: string, modalData: ModalData }
) {
    const onConfirmDeleteClick = async (event: FormEvent) => {
        event.preventDefault()
    }

    return (
        <div className='passwords-modal'>
            <h1>Delete entry for '{siteName}'?</h1>
            <button className='button submit-button' onClick={onConfirmDeleteClick}>
                Confirm
            </button>
        </div>
    )
}

function Import({ runReload }: { runReload: () => void }) {

}

function Export() {

}