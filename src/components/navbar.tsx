import type { PageName } from './page'

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