import { GoogleLogin, GoogleOAuthProvider, type CredentialResponse } from '@react-oauth/google'
import { env } from '../env_macro' with { type: 'macro' }
import {
    useState, type ChangeEvent, type Dispatch,
    type FormEvent, type SetStateAction, type MouseEvent,
    type CSSProperties,
} from 'react'
import { jwtDecode } from 'jwt-decode'
import {
    GOOGLE_ID_PARAM, GOOGLE_LOGIN_ENDPOINT,
    isApiError,
    isLoginBody, isLoginResponse, LOGIN_ENDPOINT, MAX_PASSWORD_LEN, MAX_USERNAME_LEN, MIN_LEN,
    type Uuid
} from '../sharedtypes'

const UNKNOWN_ERROR = 'an unknown error has occurred'
const FADE_OUT_TIME = 2_500

export function Login({ setUuid }: { setUuid: Dispatch<SetStateAction<Uuid | null>> }) {

    const [error, setError] = useState('')
    const [errorTimer, setErrorTimer] = useState<Timer>()

    const updateError = (error: string) => {
        setError(error)

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
        <GoogleOAuthProvider clientId={env('GOOGLE_CLIENT_ID')}>
            {
                errorTimer &&
                <div className='error-banner drop-shadow'>
                    <p>
                        {`Error: ${error}.`}
                    </p>
                </div>
            }
            <LoginPanel updateError={updateError} setUuid={setUuid} />
        </GoogleOAuthProvider>
    )
}

type LoginPanelProps = {
    updateError: (error: string) => void,
    setUuid: Dispatch<SetStateAction<Uuid | null>>,
}

function LoginPanel({ updateError, setUuid }: LoginPanelProps) {
    const [signingUp, setSigningUp] = useState(false)

    const onSignUpToggle = (event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault()
        setSigningUp(signingUp => !signingUp)
    }

    const [username, setUsername] = useState('')
    const [password, setPassword] = useState('')
    const [password2, setPassword2] = useState('') // used for signups

    const newOnFieldChange = (
        setField: Dispatch<SetStateAction<string>>,
        maxLen: number,
        regex: RegExp
    ) => {
        return (event: ChangeEvent<HTMLInputElement>) => {
            const field = event.target.value
            if (field.length <= maxLen) {
                if (regex.test(field)) {
                    setField(field)
                }
            }
        }
    }
    const onUsernameChange = newOnFieldChange(setUsername, MAX_USERNAME_LEN, /^[A-Za-z0-9_]*$/)
    const onPasswordChange = newOnFieldChange(setPassword, MAX_PASSWORD_LEN, /^[^ ]*$/)
    const onPassword2Change = newOnFieldChange(setPassword2, MAX_PASSWORD_LEN, /^[A-Za-z0-9_]*$/)

    const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()

        if (signingUp) {
            if (password != password2) {
                updateError('passwords do not match')
                return
            }
        }

        const loginBody = { username, password, signingUp }
        if (!isLoginBody(loginBody)) {
            updateError(`username and password must be at least ${MIN_LEN} characters`)
            return
        }

        const init = { body: JSON.stringify(loginBody), method: 'POST' }
        const response = await fetch(`/api/${LOGIN_ENDPOINT}`, init)
        const body = await response.json() as unknown
        if (response.status === 200) {
            if (isLoginResponse(body)) {
                setUuid(body.uuid)
            } else {
                updateError(UNKNOWN_ERROR)
            }
        } else if (isApiError(body)) {
            updateError(body.error)
        }
    }

    const leftButtonLabel = signingUp ? 'Submit' : 'Log in'
    const rightButtonLabel = signingUp ? 'Return' : 'Sign Up'
    const showOnSignUp: CSSProperties = signingUp ? {} : { visibility: 'hidden' }

    return (
        <form onSubmit={onSubmit}>
            <div className='login-panel drop-shadow'>
                <h1>Log In</h1>
                <div className='login-fields'>
                    <label>Username</label>
                    <input value={username} onChange={onUsernameChange} />
                    <label>Password</label>
                    <input type='password' value={password} onChange={onPasswordChange} />
                    <label style={showOnSignUp}>Retype Password</label>
                    <input style={showOnSignUp} type='password' value={password2} onChange={onPassword2Change} />
                </div>
                <div>
                    <button className='login-button' type='submit'>{leftButtonLabel}</button>
                    <button className='login-button' onClick={onSignUpToggle}>{rightButtonLabel}</button>
                </div>
                <GoogleLoginButton updateError={updateError} setUuid={setUuid} />
            </div>
        </form>

    )
}

function GoogleLoginButton({ updateError, setUuid }: LoginPanelProps) {
    const onGoogleLoginSuccess = async ({ credential }: CredentialResponse) => {
        if (!credential) {
            updateError('failed to log in with Google')
            return
        }

        const sub = jwtDecode(credential).sub
        if (!sub) {
            updateError(UNKNOWN_ERROR)
            return
        }

        const response = await fetch(`/api/${GOOGLE_LOGIN_ENDPOINT}?${GOOGLE_ID_PARAM}=${sub}`)
        const body = await response.json() as unknown
        if (response.status === 200) {
            if (isLoginResponse(body)) {
                setUuid(body.uuid)
            } else {
                updateError(UNKNOWN_ERROR)
            }
        } else if (isApiError(body)) {
            updateError(body.error)
        }
    }

    return (
        <div className='google-login'>
            <GoogleLogin
                onSuccess={onGoogleLoginSuccess}
                onError={() => updateError('failed to log in with Google')}
                context='use'
                theme='filled_black'
                shape='pill'
                width='200px'
            />
        </div>
    )
}