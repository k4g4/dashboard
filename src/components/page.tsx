import React, { createContext, useEffect, useState, type PropsWithChildren } from 'react'
import { Navbar } from './navbar'
import { Login } from './login'
import { isUuid } from '../sharedtypes'

export type PageName = 'home' | 'bank' | 'passwords' | 'shopping'

type PageProps = { pageName: PageName }

export const UuidContext = createContext('')

export function Page({ children, pageName }: PropsWithChildren<PageProps>) {
    const storageResult = localStorage.getItem('uuid')
    const [uuid, setUuid] = useState(isUuid(storageResult) ? storageResult : null)

    // the id is stored in local storage after a successful login
    useEffect(() => {
        uuid && localStorage.setItem('uuid', uuid)
    }, [uuid])

    return (
        <React.StrictMode>
            {
                uuid ?
                    <UuidContext.Provider value={uuid}>
                        <Navbar pageName={pageName} />
                        <div className='page-container'>
                            {children}
                        </div>
                    </UuidContext.Provider>
                    :
                    <Login setUuid={setUuid} />
            }
        </React.StrictMode>
    )
}