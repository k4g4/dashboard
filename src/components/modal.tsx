import { createContext, useRef, useState, type MouseEvent, type PropsWithChildren, type ReactNode } from "react"

export type ShowModal = (children?: ReactNode) => void

export const ShowModalContext = createContext<ShowModal>(() => { })

export function ModalProvider({ children }: PropsWithChildren) {
    const [modalChildren, setModalChildren] = useState<ReactNode>()
    const modal = useRef<HTMLDivElement | null>(null)

    const onOutsideClick = (event: MouseEvent) => {
        if (event.target instanceof Element && !modal.current?.contains(event.target)) {
            setModalChildren(null)
        }
    }

    return (
        <ShowModalContext.Provider value={setModalChildren}>
            {children}
            {
                modalChildren &&
                <div className='modal-container' onClick={onOutsideClick}>
                    <div className='modal' ref={modal}>
                        {modalChildren}
                    </div>
                </div>
            }
        </ShowModalContext.Provider>
    )
}