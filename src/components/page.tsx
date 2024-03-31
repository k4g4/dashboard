import React, { createContext, useEffect, useState, type PropsWithChildren } from 'react'
import { Navbar } from './navbar'
import { Login } from './login'
import { NIL } from 'uuid'
import { isUuid, type Uuid } from '../sharedtypes'

export type PageName = 'home' | 'bank' | 'passwords' | 'shopping'

export const UuidContext = createContext(NIL as Uuid)
export const STORAGE_UUID_KEY = 'uuid'

export function Page({ children, pageName }: PropsWithChildren<{ pageName: PageName }>) {
    const storageResult = localStorage.getItem(STORAGE_UUID_KEY)
    const [uuid, setUuid] = useState(isUuid(storageResult) ? storageResult : null)
    const [dim, setDim] = useState(false)

    // the id is stored in local storage after a successful login
    useEffect(() => {
        uuid && localStorage.setItem(STORAGE_UUID_KEY, uuid)
    }, [uuid])

    return (
        <React.StrictMode>
            {
                uuid ?
                    <UuidContext.Provider value={uuid}>
                        <Navbar pageName={pageName} setDim={setDim} />
                        <div className={dim ? 'page-container dim' : 'page-container'}>
                            {children}
                        </div>
                    </UuidContext.Provider>
                    :
                    <Login setUuid={setUuid} />
            }
        </React.StrictMode>
    )
}