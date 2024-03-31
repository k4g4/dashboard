import { useContext } from 'react'
import { STORAGE_UUID_KEY, UuidContext, type PageName } from './page'
import { LOGOUT_ENDPOINT, UUID_PARAM } from '../sharedtypes'

export function Navbar({ pageName }: { pageName: PageName }) {
    const onHomeClick = () => {
        window.location.href = '/'
    }

    return (
        <nav>
            <img className='home-icon' src='home.png' onClick={onHomeClick}></img>
            <div className='nav'>
                <NavItem href='bank' label='Bank' selected={pageName === 'bank'} />
                <NavItem href='passwords' label='Passwords' selected={pageName === 'passwords'} />
                <NavItem href='shopping' label='Shopping List' selected={pageName === 'shopping'} />
            </div>
            <Logout />
        </nav>
    )
}

function NavItem({ href, label, selected }: { href: string, label: string, selected: boolean }) {
    return (
        <div className='nav-item'>
            <a className={selected ? 'selected' : ''} href={href}>{label}</a>
            <div className='nav-item-underline'></div>
        </div >
    )
}

function Logout() {
    const icon = (
        // Font Awesome Free 6.5.1 by @fontawesome - https://fontawesome.com
        // License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.
        <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'>
            <path d={
                'M502.6 278.6c12.5-12.5 12.5-32.8 0-45.3l-128-128c-12.5-12.5-32.8-12.5-45.3 ' +
                '0s-12.5 32.8 0 45.3L402.7 224 192 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l210.7 ' +
                '0-73.4 73.4c-12.5 12.5-12.5 32.8 0 45.3s32.8 12.5 45.3 0l128-128zM160 96c17.7 0 ' +
                '32-14.3 32-32s-14.3-32-32-32L96 32C43 32 0 75 0 128L0 384c0 53 43 96 96 96l64 ' +
                '0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-64 0c-17.7 0-32-14.3-32-32l0-256c0-17.7 14.3-32 32-32l64 0z'} />
        </svg>
    )

    const uuid = useContext(UuidContext)
    const onLogout = async () => {
        const response = await fetch(`/api/${LOGOUT_ENDPOINT}?${UUID_PARAM}=${uuid}`)
        if (response.status === 200) {
            localStorage.removeItem(STORAGE_UUID_KEY)
            window.location.href = '/'
        }
    }

    return (
        <div className='logout-icon' onClick={onLogout}>
            {icon}
        </div>
    )
}