import { useContext, useEffect, useState, type Dispatch, type PropsWithChildren, type SetStateAction } from 'react'
import { STORAGE_UUID_KEY, UuidContext, type PageName } from './page'
import { LOGOUT_ENDPOINT, UUID_PARAM } from '../api_schema'
import { ICONS } from './icons'

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
                <Hamburger menuState={menuState} setMenuState={setMenuState} />
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
            {ICONS.LOGOUT}
        </div>
    )
}

type HamburgerProps = { menuState: MenuState, setMenuState: Dispatch<SetStateAction<MenuState>> }
function Hamburger({ menuState, setMenuState }: HamburgerProps) {
    const onHamburgerClick = () => {
        setMenuState(menuState => (menuState === 'init' || menuState === 'hide') ? 'show' : 'hide')
    }

    return (
        <div className='hamburger-icon' onClick={onHamburgerClick}>
            {menuState === 'show' ? ICONS.XMARK : ICONS.HAMBURGER}
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