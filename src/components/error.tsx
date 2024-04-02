import { createContext, useState, type PropsWithChildren } from "react"

const UNKNOWN_ERROR = 'an unknown error has occurred'
const FADE_OUT_TIME = 2_500

export const UpdateErrorContext = createContext<((error?: string) => void)>(() => { })

export function ErrorProvider({ children }: PropsWithChildren) {
    const [error, setError] = useState('')
    const [errorTimer, setErrorTimer] = useState<Timer>()

    const updateError = (error?: string) => {
        setError(error ?? UNKNOWN_ERROR)

        // if there's already an error banner, reset its animation
        const errorBanner = document.querySelector('.error-banner')
        if (errorBanner) {
            for (const animation of errorBanner.getAnimations()) {
                animation.cancel()
                animation.play()
            }
        }

        if (errorTimer) {
            clearTimeout(errorTimer)
        }
        setErrorTimer(setTimeout(() => setErrorTimer(undefined), FADE_OUT_TIME))
    }

    return (
        <UpdateErrorContext.Provider value={updateError}>
            {children}
            {
                errorTimer &&
                <div className='error-banner drop-shadow'>
                    <h3>Error</h3>
                    <p>{error.slice(0, 1).toUpperCase() + error.slice(1) + '.'}</p>
                </div>
            }
        </UpdateErrorContext.Provider>
    )
}