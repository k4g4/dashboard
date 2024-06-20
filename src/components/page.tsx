import { createContext, StrictMode, useEffect, useState, type PropsWithChildren } from 'react'
import { Navbar } from './navbar'
import { Login } from './login'
import { ErrorProvider } from './error'
import { NIL } from 'uuid'
import * as schema from '../api_schema'
import useAsyncEffect from 'use-async-effect'
import { ModalProvider } from './modal'

export const UuidContext = createContext(NIL as schema.Uuid)
export const STORAGE_UUID_KEY = 'uuid'

export function Page({ children, pageName }: PropsWithChildren<{ pageName: schema.PageName }>) {
    const storageResult = schema.uuid.safeParse(localStorage.getItem(STORAGE_UUID_KEY))
    const [uuid, setUuid] = useState(storageResult.success ? storageResult.data : null)
    const [dim, setDim] = useState(false)

    // the id is stored in local storage after a successful login
    useEffect(() => {
        uuid && localStorage.setItem(STORAGE_UUID_KEY, uuid)
    }, [uuid])

    useAsyncEffect(async isMounted => {
        if (uuid) {
            const response = await schema.apiFetch('loggedin', { params: { uuid } })
            if (!response && isMounted()) {
                setUuid(null)
            }
        }
    }, [])

    const page = (
        <ErrorProvider>
            {
                uuid ?
                    <UuidContext.Provider value={uuid}>
                        <ModalProvider>
                            <Navbar pageName={pageName} setDim={setDim} />
                            <div className={dim ? 'page-container dim' : 'page-container'}>
                                {children}
                            </div>
                        </ModalProvider>
                    </UuidContext.Provider>
                    :
                    <Login setUuid={setUuid} />
            }
        </ErrorProvider>
    )

    const development = document.querySelector<HTMLElement>('#root')!.dataset.development === 'true'

    return development ? <StrictMode>{page}</StrictMode> : page
}