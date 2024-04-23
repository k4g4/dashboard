import ReactDOM from 'react-dom/client'
import { Page } from '../components/page'
import { useReducer } from 'react'
import type { PasswordsEntry, Uuid } from '../api_schema'

ReactDOM.createRoot(document.getElementById('root')!).render(
    <Page pageName='passwords'>
        <Passwords />
    </Page>
)

type Update =
    | { type: 'assign', entries: PasswordsEntry[] }
    | { type: 'add', newEntry: PasswordsEntry }
    | { type: 'remove', removedId: Uuid }
    | { type: 'edit', editedEntry: PasswordsEntry }

function updatePasswords(passwords: PasswordsEntry[], update: Update): PasswordsEntry[] {
    switch (update.type) {
        case 'assign': return update.entries
        case 'add': return [...passwords, update.newEntry]
        case 'remove': return passwords.filter(({ id }) => id !== update.removedId)
        case 'edit': return passwords.map(entry => entry.id === update.editedEntry.id ? update.editedEntry : entry)
    }
}

function Passwords() {
    const [passwords, passwordsUpdate] = useReducer(updatePasswords, [])



    return (
        <Options />
    )
}

function Options() {
    return (
        <></>
    )
}