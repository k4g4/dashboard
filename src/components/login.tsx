import { GoogleLogin, GoogleOAuthProvider, type CredentialResponse } from '@react-oauth/google'
import { env } from '../env_macro' with { type: 'macro' }
import {
    useState, type ChangeEvent, type Dispatch,
    type FormEvent, type SetStateAction, type MouseEvent,
    type CSSProperties,
    useContext,
} from 'react'
import { jwtDecode } from 'jwt-decode'
import {
    apiErrorSchema,
    GOOGLE_ID_PARAM, GOOGLE_LOGIN_ENDPOINT, LOGIN_ENDPOINT, loginBodySchema, loginResponseSchema, MAX_PASSWORD_LEN, MAX_USERNAME_LEN, MIN_LEN,
    type Uuid
} from '../api_schema'
import { UpdateErrorContext } from './error'

type LoginProps = { setUuid: Dispatch<SetStateAction<Uuid | null>> }

export function Login({ setUuid }: LoginProps) {
    const updateError = useContext(UpdateErrorContext)

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

    const onSubmit = async (event: FormEvent) => {
        event.preventDefault()

        if (signingUp) {
            if (password != password2) {
                updateError('passwords do not match')
                return
            }
        }

        const loginBody = loginBodySchema.safeParse({ username, password, signingUp })
        if (!loginBody.success) {
            updateError(`username and password must be at least ${MIN_LEN} characters`)
            return
        }

        const init = { body: JSON.stringify(loginBody.data), method: 'POST' }
        try {
            const response = await fetch(`/api/${LOGIN_ENDPOINT}`, init)
            const body = await response.json()
            if (response.status === 200) {
                setUuid(loginResponseSchema.parse(body).uuid)
            } else {
                updateError(apiErrorSchema.parse(body).error)
            }
        } catch {
            updateError()
        }
    }

    const leftButtonLabel = signingUp ? 'Submit' : 'Log in'
    const rightButtonLabel = signingUp ? 'Return' : 'Sign Up'
    const showOnSignUp: CSSProperties = signingUp ? {} : { visibility: 'hidden' }

    return (
        <GoogleOAuthProvider clientId={env('GOOGLE_CLIENT_ID')}>
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
                        <button className='button login-button' type='submit'>{leftButtonLabel}</button>
                        <button className='button login-button' onClick={onSignUpToggle}>{rightButtonLabel}</button>
                    </div>
                    <GoogleLoginButton setUuid={setUuid} />
                </div>
            </form>
        </GoogleOAuthProvider>
    )
}

function GoogleLoginButton({ setUuid }: LoginProps) {
    const updateError = useContext(UpdateErrorContext)

    const onGoogleLoginSuccess = async ({ credential }: CredentialResponse) => {
        if (!credential) {
            updateError('failed to log in with Google')
            return
        }
        const sub = jwtDecode(credential).sub
        if (!sub) {
            updateError()
            return
        }
        try {
            const response = await fetch(`/api/${GOOGLE_LOGIN_ENDPOINT}?${GOOGLE_ID_PARAM}=${sub}`)
            const body = await response.json() as unknown
            if (response.status === 200) {
                setUuid(loginResponseSchema.parse(body).uuid)
            } else {
                updateError(apiErrorSchema.parse(body).error)
            }
        } catch {
            updateError()
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