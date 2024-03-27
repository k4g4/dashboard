import React, { type PropsWithChildren } from "react";
import { Navbar } from "./navbar";

export type PageName = 'home' | 'bank' | 'passwords' | 'shopping'

type PageProps = { pageName: PageName }

export function Page({ children, pageName }: PropsWithChildren<PageProps>) {
    return (
        <React.StrictMode>
            <Navbar pageName={pageName} />
            <div className='page-container'>
                {children}
            </div>
        </React.StrictMode>
    )
}