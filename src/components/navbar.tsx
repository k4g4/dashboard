import { useContext, useEffect, useState, type Dispatch, type PropsWithChildren, type SetStateAction } from 'react'
import { STORAGE_UUID_KEY, UuidContext, type PageName } from './page'
import { LOGOUT_ENDPOINT, UUID_PARAM } from '../sharedtypes'

type MenuState = 'show' | 'hide' | 'init'

export function Navbar({ pageName, setDim }: { pageName: PageName, setDim: Dispatch<SetStateAction<boolean>> }) {
    const [menuState, setMenuState] = useState<MenuState>('init')

    useEffect(() => setDim(menuState === 'show'), [menuState])

    const navItems = (underline: boolean) => [
        <NavItem key={0} href='bank' label='Bank' selected={pageName === 'bank'} underline={underline} />,
        <NavItem key={1} href='passwords' label='Passwords' selected={pageName === 'passwords'} underline={underline} />,
        <NavItem key={2} href='shopping' label='Shopping List' selected={pageName === 'shopping'} underline={underline} />,
    ]

    return (
        <>
            <nav>
                <img className='home-icon' src='home.png' onClick={() => window.location.href = '/'}></img>
                <div className='nav'>
                    {navItems(true)}
                </div>
                <Logout />
                <Hamburger setMenuState={setMenuState} />
            </nav>
            <Menu menuState={menuState}>
                {navItems(false)}
                <Logout />
            </Menu>
        </>
    )
}

type NavItemProps = { href: string, label: string, selected: boolean, underline: boolean }
function NavItem({ href, label, selected, underline }: NavItemProps) {
    return (
        <div className='nav-item'>
            <a className={selected ? 'selected' : ''} href={href}>{label}</a>
            {underline && <div className='nav-item-underline'></div>}
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
                '0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-64 0c-17.7 0-32-14.3-32-32l0-256c0-17.7 14.3-32 32-32l64 0z'}
            />
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

function Hamburger({ setMenuState }: { setMenuState: Dispatch<SetStateAction<MenuState>> }) {
    const icon = (
        // Font Awesome Free 6.5.1 by @fontawesome - https://fontawesome.com
        // License - https://fontawesome.com/license/free Copyright 2024 Fonticons, Inc.
        <svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 448 512'>
            <path d={
                'M0 96C0 78.3 14.3 64 32 64H416c17.7 0 32 14.3 32 32s-14.3 32-32 32H32C14.3 128 0 113.7 ' +
                '0 96zM0 256c0-17.7 14.3-32 32-32H416c17.7 0 32 14.3 32 32s-14.3 32-32 32H32c-17.7 0-32-14.3-32-32zM448 ' +
                '416c0 17.7-14.3 32-32 32H32c-17.7 0-32-14.3-32-32s14.3-32 32-32H416c17.7 0 32 14.3 32 32z'}
            />
        </svg>
    )

    const onHamburgerClick = () => {
        setMenuState(menuState => (menuState === 'init' || menuState === 'hide') ? 'show' : 'hide')
    }

    return (
        <div className='hamburger-icon' onClick={onHamburgerClick}>
            {icon}
        </div>
    )
}

function Menu({ menuState, children }: PropsWithChildren<{ menuState: MenuState }>) {
    return (
        <div className={'menu ' + menuState}>
            {children}
        </div>
    )
}