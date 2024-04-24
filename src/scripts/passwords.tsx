import ReactDOM from 'react-dom/client'
import { Page, UuidContext } from '../components/page'
import {
    Fragment, useContext, useReducer, useState,
    type ChangeEvent, type Dispatch, type SetStateAction
} from 'react'
import {
    apiErrorSchema, GET_PASSWORDS_ENDPOINT, getPasswordsResponseSchema, UUID_PARAM, uuidSchema,
    type PasswordsEntry, type Uuid
} from '../api_schema'
import useAsyncEffect from 'use-async-effect'
import { UpdateErrorContext } from '../components/error'
import { ICONS } from '../components/icons'
import { ShowModalContext, type ShowModal } from '../components/modal'

ReactDOM.createRoot(document.getElementById('root')!).render(
    <Page pageName='passwords'>
        <Passwords />
    </Page>
)

type Update =
    | { type: 'assign', entries: PasswordsEntry[] }
    | { type: 'add', newEntry: PasswordsEntry }
    | { type: 'remove', entryUuid: Uuid }
    | { type: 'edit', editedEntry: PasswordsEntry }
    | { type: 'togglefav', entryUuid: Uuid }

function updatePasswords(passwords: PasswordsEntry[], update: Update): PasswordsEntry[] {
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

function Passwords() {
    const uuid = useContext(UuidContext)
    const updateError = useContext(UpdateErrorContext)
    const showModal = useContext(ShowModalContext)

    const [_passwords, passwordsUpdate] = useReducer(updatePasswords, [])
    const passwords: PasswordsEntry[] = [
        { favorite: true, entryUuid: uuidSchema.parse('d290a748-ddfb-419d-8385-7bbe762aa01a'), password: '123', siteName: 'quick', siteUrl: 'www.foo.com', username: 'lazy' },
        { favorite: false, entryUuid: uuidSchema.parse('f0eea526-31c9-4a21-8f44-77d3779bbb68'), password: '456', siteName: 'brown', siteUrl: 'www.foo.gov', username: 'dogs' },
        { favorite: true, entryUuid: uuidSchema.parse('013a97fe-4fd9-4101-960c-f70297589b94'), password: '789', siteName: 'foxes', siteUrl: 'www.foo.net', username: 'blah' },
        { favorite: false, entryUuid: uuidSchema.parse('04c7ebf2-ac3c-48ed-bf1c-00e8498df01f'), password: 'foobar', siteName: 'jumping', siteUrl: 'http://www.blah.com', username: 'blahh' },
        { favorite: false, entryUuid: uuidSchema.parse('bdde9844-aefd-4dae-b68e-22f7d2daf20a'), password: 'bazqux', siteName: 'over', siteUrl: 'https://foo.com/', username: 'blah' },
    ]

    useAsyncEffect(async isMounted => {
        try {
            const response = await fetch(`/api/${GET_PASSWORDS_ENDPOINT}?${UUID_PARAM}=${uuid}`)
            const body = await response.json()
            if (isMounted()) {
                if (response.status === 200) {
                    const entries = getPasswordsResponseSchema.parse(body)
                    passwordsUpdate({ type: 'assign', entries })
                } else {
                    updateError(apiErrorSchema.parse(body).error)
                }
            }
        } catch {
            updateError()
        }
    }, [])

    const entryMapper = (passwords: PasswordsEntry[]) => {
        return passwords.map(entry => (
            <Entry
                key={entry.entryUuid}
                entry={entry}
                showModal={showModal}
                passwordsUpdate={passwordsUpdate}
            />
        ))
    }

    return (
        <div>
            {
                passwords.length ?
                    <li className='passwords-list'>
                        {entryMapper(passwords.filter(entry => entry.favorite))}
                        {entryMapper(passwords.filter(entry => !entry.favorite))}
                    </li>
                    :
                    <></>
            }
            <Options showModal={showModal} passwordsUpdate={passwordsUpdate} />
        </div>
    )
}

type EntryProps = {
    entry: PasswordsEntry,
    showModal: ShowModal,
    passwordsUpdate: Dispatch<Update>,
}
function Entry({ entry, showModal, passwordsUpdate }: EntryProps) {
    const { entryUuid, siteName, siteUrl, favorite, username, password } = entry

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
                    {siteName} - {siteUrl}
                </div>
                <div className='passwords-entry-credentials'>
                    {username}: {password}
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

function Options({ showModal, passwordsUpdate }: { showModal: ShowModal, passwordsUpdate: Dispatch<Update> }) {
    return (
        <div className='passwords-options'>
            <button className='button' onClick={() => showModal(<Add passwordsUpdate={passwordsUpdate} />)}>Add</button>
            <button className='button' onClick={() => showModal(<Import />)}>Import</button>
            <button className='button' onClick={() => showModal(<Export />)}>Export</button>
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
    onSubmit: (uuid: Uuid) => Promise<any>,
}
function PasswordsModal({ title, fields, submitLabel, onSubmit }: PasswordsModalProps) {
    const uuid = useContext(UuidContext)

    const onFieldChange = (setValue: Dispatch<SetStateAction<string>>) => {
        return (event: ChangeEvent<HTMLInputElement>) => {
            setValue(event.target.value)
        }
    }

    const onSubmitClick = async () => {
        await onSubmit(uuid)
    }

    return (
        <div className='passwords-modal'>
            <h1>{title}</h1>
            <div className='modal-fields'>
                {
                    fields.map(({ field, value, setValue, hide }) => {
                        return (
                            <Fragment key={field}>
                                <label>{field}</label>
                                <input
                                    type={hide ? 'password' : 'text'}
                                    value={value}
                                    onChange={onFieldChange(setValue)}
                                />
                            </Fragment>
                        )
                    })
                }
            </div>
            <button className='button submit-button' onClick={onSubmitClick}>{submitLabel}</button>
        </div>
    )
}

function Edit({ entryUuid, passwordsUpdate }: { entryUuid: Uuid, passwordsUpdate: Dispatch<Update> }) {
    const [siteName, setSiteName] = useState('')
    const [siteUrl, setSiteUrl] = useState('')
    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')

    const onAddSubmit = (uuid: Uuid) => {
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
        onSubmit={onAddSubmit}
    />
}

type ConfirmDeleteProps = {
    entryUuid: Uuid,
    siteName: string,
    passwordsUpdate: Dispatch<Update>,
}
function ConfirmDelete({ entryUuid, siteName, passwordsUpdate }: ConfirmDeleteProps) {
    const onConfirmDeleteSubmit = (uuid: Uuid) => {
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

    const onAddSubmit = (uuid: Uuid) => {
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
        onSubmit={onAddSubmit}
    />
}

function Import() {
    const [clientId, setClientId] = useState('')
    const [clientSecret, setClientSecret] = useState('')
    const [password, setPassword] = useState('')

    const onImportSubmit = (uuid: Uuid) => {
        return new Promise(() => {
            console.log(uuid, clientId, clientSecret, password)
        })
    }

    const fields: PasswordsModalField[] = [
        {
            field: 'Client ID',
            value: clientId,
            setValue: setClientId,
            hide: false,
        },
        {
            field: 'Client Secret',
            value: clientSecret,
            setValue: setClientSecret,
            hide: true,
        },
        {
            field: 'Master Password',
            value: password,
            setValue: setPassword,
            hide: true,
        },
    ]

    return <PasswordsModal
        title='Import from Bitwarden'
        fields={fields}
        submitLabel='Import'
        onSubmit={onImportSubmit}
    />
}

function Export() {
    const [clientId, setClientId] = useState('')
    const [clientSecret, setClientSecret] = useState('')
    const [password, setPassword] = useState('')

    const onExportSubmit = (uuid: Uuid) => {
        return new Promise(() => {
            console.log(uuid, clientId, clientSecret, password)
        })
    }

    const fields: PasswordsModalField[] = [
        {
            field: 'Client ID',
            value: clientId,
            setValue: setClientId,
            hide: false,
        },
        {
            field: 'Client Secret',
            value: clientSecret,
            setValue: setClientSecret,
            hide: true,
        },
        {
            field: 'Master Password',
            value: password,
            setValue: setPassword,
            hide: true,
        },
    ]

    return <PasswordsModal
        title='Export to Bitwarden'
        fields={fields}
        submitLabel='Export'
        onSubmit={onExportSubmit}
    />
}