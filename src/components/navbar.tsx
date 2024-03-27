import { useState } from "react"

export function Navbar() {
    const onHomeClick = () => {
        window.location.href = '/'
    }

    return (
        <nav>
            <img className='home-icon' src='home.png' onClick={onHomeClick}></img>
            <div className='nav'>
                <NavItem href='bank' label='Bank' />
                <NavItem href='passwords' label='Passwords' />
                <NavItem href='shopping' label='Shopping List' />
            </div>
        </nav>
    )
}

function NavItem({ href, label }: { href: string, label: string }) {
    return (
        <div className='nav-item'>
            <a href={href}>{label}</a>
            <div className='nav-item-underline'></div>
        </div >
    )
}